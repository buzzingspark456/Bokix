// Vad som händer med ett kvitto EFTER att texten lästs: tolkning, var på
// fotot uppgifterna stod, leverantören i EU:s momsregister, omräkning från
// utländsk valuta och planen för vilka fält som fylls i och hur säkert.
// Delas av appens kvittovy (Expenses.jsx) och gratisverktyget Skanna kvitto
// (ScanReceiptPage.jsx), så att de alltid ger samma resultat för samma kvitto.
import { parseReceiptText, READING_SEPARATOR } from './ocrReceipt';
import { readInvoiceDetails } from './invoiceDetails';
import { rowsFromLayout } from './visionRows';
import { locateFieldBoxes } from './ocrFieldBoxes';
import { sellerTaxIds, prettifyCompanyName } from './supplierRegistry';
import { lookupVatName } from './companyLookup';
import { convertToSek } from './currencyConversion';
import { amountToInput } from './foreignCurrency';
import { t as tr } from '../i18n';

const REGISTRY_TIMEOUT_MS = 7000;

/**
 * Tolkar en läsning ({ text, confidence, weakTokens, quality, layout }).
 * `ownCompany` ({ orgNr, vatNr }) hindrar att köparens egna nummer slås upp
 * som säljarens. `onMessage` får statustexten medan registret och kursen hämtas.
 * Svarar { parsed, boxes, registryName, supplierName, hint, amountSek, foreignInfo,
 * details, netAmount, readText }. `details` är fakturauppgifterna
 * (invoiceDetails.js), `readText` texten som lästes, för Visa texten som lästes.
 */
export async function analyzeReceipt(read, { ownCompany = {}, onMessage = () => {} } = {}) {
  const { confidence, weakTokens, quality, layout } = read;
  // Google läser kolumn för kolumn: raderna byggs om efter var de står på bilden.
  const text = (layout && rowsFromLayout(layout)) || read.text;
  const parsed = parseReceiptText(text, { confidence, weakTokens });
  const boxes = layout ? locateFieldBoxes(layout, parsed) : null;
  const readText = String(text || '').split(READING_SEPARATOR)[0].trim();
  const details = parsed.notReceipt
    ? null
    : readInvoiceDetails(readText, { own: ownCompany, invoiceDate: parsed.date });
  const netAmount = !parsed.notReceipt && parsed.amount && parsed.vatAmount !== null && parsed.vatAmount !== undefined
    ? Math.round((parsed.amount - parsed.vatAmount) * 100) / 100 : null;

  // Leverantören inte säkert känd: slå upp säljarens momsnummer eller
  // organisationsnummer i EU:s momsregister. Registrets namn är det
  // juridiska och slår en gissad rad. Går registret inte att nå blir det
  // som förut.
  let registryName = '';
  if (!parsed.notReceipt && !parsed.supplierMatched) {
    const ids = sellerTaxIds(text, { orgNr: ownCompany?.orgNr, vatNr: ownCompany?.vatNr });
    for (const id of ids) {
      try {
        onMessage(tr('ui.slar_upp_leverantoren'));
        const hit = await Promise.race([lookupVatName(id), new Promise(r => setTimeout(() => r(null), REGISTRY_TIMEOUT_MS))]);
        if (hit?.name) { registryName = prettifyCompanyName(hit.name); break; }
      } catch { /* registret svarar inte: fortsätt utan */ }
    }
  }
  const supplierName = registryName || parsed.supplier;

  // Rådet om fotot visas bara när avläsningen inte blev bra: blev beloppet
  // avläst och kontrollerat mot momsen spelar det ingen roll att bilden
  // kunde varit skarpare.
  const hint = (quality?.advice && (parsed.notReceipt || !parsed.amount || parsed.amountGuessed || parsed.vatMismatch))
    ? quality.advice : null;

  // Utländsk valuta — räkna om till kronor med DAGSKURSEN FÖR KÖPDATUMET
  // (Skatteverkets rekommendation) innan beloppet fylls i. Går omräkningen
  // inte att göra (okänd valutakod, inget nät) fylls beloppet INTE i som om
  // talet redan vore kronor — se convertToSek.
  let amountSek = parsed.currency ? null : parsed.amount;
  let foreignInfo = null;
  if (parsed.amount && parsed.currency) {
    onMessage(tr('ui.raknar_om_till_kronor', { currency: parsed.currency }));
    const converted = await convertToSek(parsed.amount, parsed.currency, parsed.date);
    if (converted) amountSek = converted.sek;
    foreignInfo = { code: parsed.currency, amount: parsed.amount, converted };
  }

  return { parsed, boxes: boxes && Object.keys(boxes).length > 0 ? boxes : null, registryName, supplierName, hint, amountSek, foreignInfo, details, netAmount, readText };
}

/**
 * Vilka fält som fylls i, i vilken ordning och hur säkert. `state`: 'found'
 * = det stod på kvittot, 'guess' = ett förslag att kontrollera, 'history' =
 * som företaget bokfört samma leverantör förut. Kontot fylls bara i när det
 * är känt (historik eller omvänd moms); en regel blir ett förslag (`suggest`),
 * aldrig ett ifyllt konto. `hist` är företagets historik för leverantören,
 * eller null (gratisverktyget har ingen).
 */
export function buildReceiptPlan({ parsed, registryName, supplierName, amountSek }, history = null) {
  // I en butik som säljer allt möjligt säger förra kvittot inget om det här:
  // stod varan på kvittot gäller den, inte vad som bokfördes förra gången.
  const hist = history && parsed.accountFromItems && history.costAccount !== parsed.accountCode
    ? { ...history, costAccount: null } : history;
  // Inget kvitto eller ingen faktura (ett CV, ett brev): inget fylls i.
  const nr = Boolean(parsed.notReceipt);
  const reverse = parsed.reverseCharge;
  // Förra kvittot säger inget om momsen i en butik som säljer allt möjligt.
  const variedStore = Boolean(parsed.accountChoices || parsed.accountFromItems);
  const vatFromHistory = !reverse && !variedStore && Boolean(hist && parsed.vatRateGuessed && hist.vatRate !== null);
  // Satsen stod inte på kvittot: ingen sats väljs, användaren väljer själv.
  const vatUnread = !reverse && !vatFromHistory && Boolean(parsed.vatRateGuessed) && !parsed.vatRates;
  // Moms i flera satser (mat 12 % och hushåll 25 %): momsbeloppet på
  // kvittot bokförs som det står, i stället för en sats som blir fel.
  const mixedVat = !nr && !reverse && !parsed.currency && Boolean(parsed.vatRates && parsed.vatAmount);
  return [
    { key: 'supplier', found: !nr && Boolean(supplierName), state: (registryName || parsed.supplierConfirmed) ? 'found' : 'guess', patch: { supplier: supplierName || '' } },
    { key: 'date', found: !nr && Boolean(parsed.date), state: parsed.dateGuessed ? 'guess' : 'found', patch: { date: parsed.date } },
    { key: 'receiptNumber', found: !nr && Boolean(parsed.receiptNumber), state: parsed.receiptNumberGuessed ? 'guess' : 'found', patch: { receiptNumber: parsed.receiptNumber || '' } },
    { key: 'amount', found: !nr && Boolean(amountSek), state: parsed.amountGuessed ? 'guess' : 'found', patch: { amount: amountToInput(amountSek), refund: Boolean(parsed.creditNote) } },
    {
      key: 'vatRate', found: !nr && parsed.vatRate !== null && parsed.vatRate !== undefined,
      state: reverse ? 'found' : (vatFromHistory ? 'history' : (vatUnread ? 'missing' : 'found')),
      patch: mixedVat
        ? { vatRate: 'mixed', vatAmount: amountToInput(parsed.vatAmount) }
        : { vatRate: vatUnread ? '' : (vatFromHistory ? hist.vatRate : parsed.vatRate) },
    },
    {
      // Tjänst från utlandet: kontot följer av dokumentet (4535 EU, 4531
      // utanför EU), inte av tidigare kvitton som kan vara bokförda utan
      // omvänd moms.
      //
      // Kundfeedback, uttryckligt: inga gissningar, och ett tomt konto är
      // bättre än ett konto avläsningen inte vet. Kontot fylls därför bara i
      // när det är känt: användaren har själv bokfört samma leverantör förut
      // (historik), eller det är en utländsk tjänst där omvänd moms ger
      // kontot. En regel (leverantören eller ett ord på kvittot) är ett
      // FÖRSLAG som visas överst i kontolistan, inte något som skrivs in.
      key: 'costAccount', found: !nr && Boolean(reverse ? parsed.accountCode : hist?.costAccount),
      state: reverse ? 'found' : 'history',
      patch: { costAccount: reverse ? parsed.accountCode : hist?.costAccount },
      // Inga förslag ur texten (användaren 2026-11-03): de gjorde det svårare.
      suggest: null,
      // Spel och spelkonsoler: inget förslag, men en förklaring till varför.
      note: !nr && !reverse && !hist?.costAccount && parsed.privateItem ? 'private' : null,
    },
  ];
}

/**
 * Verifikationen som kvittot skulle bli, för gratisverktyget. Bara när beloppet
 * och momsen stod på dokumentet; omvänd moms, retur och utländsk valuta
 * räknas fram i appen och visas inte här. En faktura med förfallodatum blir
 * en leverantörsskuld, ett kvitto är redan betalt. Utan känt konto står
 * kostnadsraden utan konto, så att användaren ser att det ska väljas.
 */
export function bookingPreview({ parsed, details, netAmount }, costAccount = null) {
  if (parsed.notReceipt || parsed.currency || parsed.reverseCharge || parsed.creditNote) return null;
  if (!parsed.amount || netAmount === null || !parsed.vatVerified) return null;
  const unpaid = parsed.documentKind === 'invoice' && Boolean(details?.dueDate);
  const paidFrom = unpaid ? '2440' : (parsed.paymentMethod === 'cash' ? '1910' : '1930');
  const rows = [{ account: costAccount, debit: netAmount }];
  if (parsed.vatAmount > 0) rows.push({ account: '2641', debit: parsed.vatAmount });
  rows.push({ account: paidFrom, credit: parsed.amount });
  return rows;
}

