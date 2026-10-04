import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt.js';

describe('parseReceiptText', () => {
  it('extraherar digital faktura från Supabase korrekt', () => {
    const text = `
      INVOICE
      Supabase Inc.
      Invoice Number: INV-2024-001
      Date: 2024-05-12
      Bill To: Mitt Bolag AB
      Description: Supabase Pro Plan
      Subtotal: $25.00
      Total: 193,75 SEK
      VAT: 0%
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-12');
    expect(result.amount).toBe(193.75);
    expect(result.vatRate).toBe(0);
    expect(result.supplier).toBe('Supabase');
    expect(result.accountCode).toBe('6540');
  });

  it('extraherar kvitto från ICA med 12% moms och konto 6071', () => {
    const text = `
      ICA Supermarket
      Org.nr: 556000-1234
      Datum: 2024-03-15
      Mjölk 18,50
      Bröd 32,90
      Kaffe 54,00
      Totalt SEK 105,40
      Varav moms 12%: 11,29
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-03-15');
    expect(result.amount).toBe(105.4);
    expect(result.vatRate).toBe(12);
    expect(result.supplier).toBe('ICA');
    expect(result.accountCode).toBe('7690');
  });

  it('extraherar bensin kvitto från Circle K med 25% moms och konto 5611', () => {
    const text = `
      CIRCLE K SVERIGE AB
      Station: Nacka
      2024-01-20 14:22
      Miles 95 Bensin
      Liter: 42,50  Pris/l: 21,19
      ATT BETALA SEK 900,58
      Moms 25%: 180,12
      KORT VISA **** 1234
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-01-20');
    expect(result.amount).toBe(900.58);
    expect(result.vatRate).toBe(25);
    expect(result.supplier).toBe('Circle K');
    expect(result.accountCode).toBe('5611');
  });

  it('extraherar SL-biljett med 6% moms och konto 5810', () => {
    const text = `
      SL Enkelbiljett
      Datum: 12/04/2024
      Pris: 42,00 kr
      Moms 6%: 2,38
      Totalt 42,00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-04-12');
    expect(result.amount).toBe(42);
    expect(result.vatRate).toBe(6);
    expect(result.supplier).toBe('SL');
    expect(result.accountCode).toBe('5810');
  });

  it('hanterar tom eller ogiltig text utan att krascha', () => {
    const res1 = parseReceiptText('');
    expect(res1.date).toBeNull();
    expect(res1.amount).toBeNull();

    const res2 = parseReceiptText(null);
    expect(res2.date).toBeNull();
    expect(res2.amount).toBeNull();
  });

  // ── Engelskspråkiga kvitton ─────────────────────────────────────────────
  // Utländska leverantörer och kvitton på engelska ska tolkas lika bra som
  // svenska — Tesseract-workern läser båda språken i samma pass (se
  // createWorker(['swe', 'eng'], ...) i ocrFile), och den här funktionen
  // måste kunna hitta fälten oavsett vilket språk siffrorna omgärdas av.
  it('extraherar ett helt engelskspråkigt kvitto (textdatum, engelska nyckelord)', () => {
    const text = `
      GITHUB, INC.
      Receipt
      Date: May 12, 2024
      Description: GitHub Team plan
      Subtotal: 799.00
      Total Amount: 799.00 SEK
      VAT: 0%
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-12');
    expect(result.amount).toBe(799);
    expect(result.vatRate).toBe(0);
    expect(result.supplier).toBe('GitHub');
    expect(result.accountCode).toBe('6540');
  });

  it('extraherar ett engelskt kvitto med DD/MM/YYYY-datum och "Amount Due"', () => {
    const text = `
      DHL Express
      Invoice Date: 03/11/2024
      Shipment from Stockholm to Malmö
      Amount Due: 245.00
      Tax 25%: 49.00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-11-03');
    expect(result.amount).toBe(245);
    expect(result.vatRate).toBe(25);
    expect(result.supplier).toBe('DHL');
    // 5711 "Fraktkostnader" — rättat, låg tidigare felaktigt på 6230
    // ("Datakommunikation"), se accountCategories.js:s filkommentar.
    expect(result.accountCode).toBe('5711');
  });

  it('känner fortfarande igen operatören "3" som fristående ord (men inte som en del av ett annat tal)', () => {
    const text = `
      3 Sverige AB
      Mobilabonnemang
      2024-02-10
      Totalt 399,00
    `;
    const result = parseReceiptText(text);
    expect(result.accountCode).toBe('6212');
  });

  // ── Valuta ──────────────────────────────────────────────────────────────
  // Bokix bokför bara i SEK — ett belopp i en annan valuta får aldrig
  // tolkas som kronor. Se kommentaren vid "## Valuta" i ocrReceipt.js.
  it('flaggar ett kvitto i dollar istället för att gissa att beloppet är kronor', () => {
    const text = `
      Some US Shop
      Date: 2024-06-01
      Total: $45.00
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(45);
    expect(result.currency).toBe('USD');
  });

  it('flaggar pund och euro likadant', () => {
    const gbp = parseReceiptText('Amount Due: £120.00\n2024-06-02');
    expect(gbp.currency).toBe('GBP');

    const eur = parseReceiptText('Total: €89.90\n2024-06-03');
    expect(eur.currency).toBe('EUR');
  });

  it('flaggar INTE när totalraden uttryckligen säger SEK, även om en dollarsumma nämns tidigare på kvittot', () => {
    // Vanligt mönster på utländska SaaS-fakturor (Vercel, GitHub …): en
    // delsumma i originalvalutan ovanför en redan SEK-omräknad total.
    const text = `
      Vercel Inc.
      Subtotal: $20.00
      Total: 215,60 SEK
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(215.6);
    expect(result.currency).toBeNull();
  });

  // ── Amerikanska datum (MM/DD) vs svenska (DD/MM) ───────────────────────────
  // Bugkritiskt: fel dag/månad-ordning ger fel datum, som ger fel valutakurs
  // (convertToSek slår upp kursen för DEN dagen) — helt utan att synas som
  // ett fel, eftersom det fortfarande blir ett giltigt datum. Se
  // resolveDayMonth i ocrReceipt.js.
  it('tolkar ett omöjligt DD/MM-datum ("15:e i månad 02") som amerikanskt MM/DD istället för att ge ett ogiltigt datum', () => {
    // 02/15/2022 kan bara vara den amerikanska konventionen (15 februari)
    // — ingen månad heter 15. Innan fixen blev det här "2022-15-02".
    const text = `
      Some US Shop Inc.
      Invoice Date: 02/15/2022
      Total: $48.99
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2022-02-15');
    expect(result.currency).toBe('USD');
  });

  it('tolkar ett äkta tvetydigt datum (båda talen ≤ 12) som MM/DD när kvittot är i dollar', () => {
    // 03/05/2022 är tvetydigt i sig — men dollartecknet avslöjar att det
    // är amerikanskt (5 mars), inte svenskt (3 maj).
    const text = `
      US Shop
      Date: 03/05/2022
      Total: $20.00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2022-03-05');
  });

  it('behåller svensk DD/MM-tolkning för ett tvetydigt datum utan dollartecken', () => {
    const text = `
      Svenska Butiken AB
      Datum: 03/05/2024
      Totalt: 200,00 kr
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-03');
  });

  // ── Fler valutor (USD, GBP, NOK, DKK, EUR, JPY, CNY — de vanligaste) ────────
  it('läser av ett japanskt kvitto — yen skrivs praktiskt taget aldrig med decimaler', () => {
    // "¥5,000" är femtusen yen, INTE 5,00 — kommatecknet är en
    // tusentalsgruppering, inte ett decimaltecken. Se parseMoneyToken.
    const text = `
      Tokyo Camera Store
      Date: 2024-03-10
      Total: ¥5,000
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('JPY');
  });

  it('läser av ett japanskt kvitto utan tusentalsgruppering också ("¥3500")', () => {
    const result = parseReceiptText('Sony Store Tokyo\nTotal ¥3500\n2024-03-11');
    expect(result.amount).toBe(3500);
    expect(result.currency).toBe('JPY');
  });

  it('läser av ett kinesiskt kvitto (CNY/RMB och tecknet 元)', () => {
    const byCode = parseReceiptText('Shanghai Trading Co\nTotal: CNY 580.00\n2024-03-12');
    expect(byCode.amount).toBe(580);
    expect(byCode.currency).toBe('CNY');

    const byYuanSign = parseReceiptText('Total 元1200\n2024-03-13');
    expect(byYuanSign.currency).toBe('CNY');
  });

  it('läser av norska och danska kronor via valutakoden (skiljer dem från svenska kr)', () => {
    const nok = parseReceiptText('Oslo Sport AS\nTotal: NOK 450,00\n2024-03-14');
    expect(nok.amount).toBe(450);
    expect(nok.currency).toBe('NOK');

    const dkk = parseReceiptText('København Butik\nTotal: DKK 320,00\n2024-03-15');
    expect(dkk.amount).toBe(320);
    expect(dkk.currency).toBe('DKK');
  });

  it('förväxlar inte ett kvittonummer med ett heltalsbelopp utan decimaler (yen-liknande)', () => {
    // Samma bugg som "Ref 88213" tidigare, fast med ett belopp UTAN
    // decimaler också inblandat — kvittonumret (större tal) ska inte
    // vinna över det faktiska totalbeloppet.
    const text = `
      Osaka Diner
      Kvitto nr 900123
      2024-03-16
      Total ¥1500
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(1500);
  });

  it('kraschar inte och ger ändå ett belopp för en okänd, blandad kvittotext', () => {
    const text = `
      Some Random Shop AB
      Ref 88213
      2024-07-01
      Item A          49,00
      Item B          120,00
      Card payment approved
      169,00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-07-01');
    expect(result.amount).toBe(169);
    // Ingen känd leverantör eller kontoregel matchar. Det ÄR ett kvitto, så
    // 6990 Övriga externa kostnader föreslås, men märkt som en gissning
    // (accountGuessed) så att det visas som "kontrollera", inte som avläst.
    expect(result.accountCode).toBe('6990');
    expect(result.accountGuessed).toBe(true);
    expect(result.accountSource).toBe('fallback');
  });
});

import { crossCheckVat, findReceiptNumber } from './ocrReceipt.js';

describe('momskontroll mot beloppen', () => {
  const ica = `
    ICA Supermarket
    Datum: 2024-03-15
    Totalt SEK 105,40
    Varav moms 12%: 11,29
  `;
  it('verifierar momsen när beloppen stämmer mot en svensk sats', () => {
    const r = parseReceiptText(ica);
    expect(r.vatAmount).toBe(11.29);
    expect(r.vatRate).toBe(12);
    expect(r.vatVerified).toBe(true)
    expect(r.vatMismatch).toBe(false)
    expect(r.vatRateGuessed).toBe(false)
  });

  it('läser satsen ur siffrorna när kvittot inte skriver ut den', () => {
    const r = parseReceiptText('Kaffebaren\nDatum: 2024-05-02\nTotalt 125,00\nMoms 25,00')
    expect(r.vatRate).toBe(25)
    expect(r.vatVerified).toBe(true)
    expect(r.vatRateGuessed).toBe(false)
  });

  it('blandade momssatser som inte går ihop flaggas', () => {
    const r = parseReceiptText('Butiken\nTotalt 106,00\nMoms 6%  6,00\nMoms 25% 6,00')
    // Två rader ger 12,00 i moms, vilket inte stämmer mot någon sats på 106 kr.
    expect(r.vatMismatch).toBe(true)
    expect(r.vatVerified).toBe(false)
  });

  it('en verklig avvikelse flaggas i stället för att verifieras', () => {
    const r = parseReceiptText('Butiken\nTotalt 100,00\nMoms 25%: 9,99')
    expect(r.vatVerified).toBe(false)
    expect(r.vatMismatch).toBe(true)
    expect(r.vatRate).toBe(25)
  });

  it('utan momsrad eller i utländsk valuta kontrolleras inget', () => {
    const r = parseReceiptText('Butiken\nTotalt 100,00')
    expect(r.vatVerified).toBe(false)
    expect(r.vatMismatch).toBe(false)
    expect(r.vatAmount).toBeNull()
    expect(crossCheckVat({ lines: ['Moms 5,00'], amount: 50, vatRate: 25, vatRateGuessed: true, currency: 'USD' }).verified).toBe(false)
  });

  it('en momsrad med bara procent räknas inte som belopp', () => {
    const r = parseReceiptText('Butiken\nTotalt 100,00\nMoms 25%')
    expect(r.vatAmount).toBeNull()
    expect(r.vatRate).toBe(25)
  });

  it('avrundning per rad inom några ören godkänns', () => {
    expect(crossCheckVat({ lines: ['Moms 25%: 20,01'], amount: 100, vatRate: 25, vatRateGuessed: false, currency: null }).verified).toBe(true)
    expect(crossCheckVat({ lines: ['Moms 25%: 20,10'], amount: 100, vatRate: 25, vatRateGuessed: false, currency: null }).verified).toBe(false)
  });
});

describe('kvitto- och fakturanummer', () => {
  it('läser fakturanummer med kolon', () => {
    expect(findReceiptNumber(['Supabase Inc.', 'Invoice Number: INV-2024-001', 'Date: 2024-05-12'])).toBe('INV-2024-001')
  });
  it('läser svenska varianter', () => {
    expect(findReceiptNumber(['Fakturanummer 100234'])).toBe('100234')
    expect(findReceiptNumber(['Kvitto nr 45871'])).toBe('45871')
    expect(findReceiptNumber(['Kvittonr: A-77120'])).toBe('A-77120')
    expect(findReceiptNumber(['Ordernr 998877'])).toBe('998877')
  });
  it('fakturanummer går före ordernummer', () => {
    expect(findReceiptNumber(['Ordernr 111222', 'Fakturanr 333444'])).toBe('333444')
  });
  it('ignorerar datum, org.nr, telefon och ord utan siffror', () => {
    expect(findReceiptNumber(['Invoice', 'Order 2024-05-12'])).toBeNull()
    expect(findReceiptNumber(['Org.nr 556016-0680', 'Tel 08-123456'])).toBeNull()
    expect(findReceiptNumber(['Kvitto tack'])).toBeNull()
    expect(findReceiptNumber(['Faktura 556016-0680'])).toBeNull()
  });
  it('tom text ger null och parse tar med numret', () => {
    expect(findReceiptNumber([])).toBeNull()
    expect(findReceiptNumber(undefined)).toBeNull()
    expect(parseReceiptText('Bolaget\nFaktura nr 20240123\nTotalt 500,00').receiptNumber).toBe('20240123')
  });
});

describe('kvittonummer utan bindestreck', () => {
  it('ett tiosiffrigt kvittonummer är ett kvittonummer, inte ett organisationsnummer', () => {
    expect(findReceiptNumber(['Kvitto nr 2024051277'])).toBe('2024051277')
    expect(findReceiptNumber(['Faktura 5560351234'])).toBe('5560351234')
  });
});

import { findReceiptNumberDetailed, repairNumberLabels } from './ocrReceipt.js';

describe('nummer på kvitton, fakturor och order', () => {
  const kindOf = (lines) => findReceiptNumberDetailed(lines)?.kind ?? null;

  it('ett kvitto som bara har ett ordernummer får just det, med rätt benämning', () => {
    const r = findReceiptNumberDetailed(['Webbshopen AB', 'Ordernummer: 9988776', 'Datum 2024-05-12'])
    expect(r).toEqual({ number: '9988776', kind: 'order', label: 'Ordernummer' })
  });
  it('olika stavningar av ordernummer', () => {
    for (const line of ['Ordernr 4455667', 'Order nr: 4455667', 'Order-ID 4455667', 'Order #4455667', 'Order number 4455667', 'Beställningsnummer 4455667', 'Best.nr 4455667']) {
      expect(findReceiptNumberDetailed([line])?.number, line).toBe('4455667')
    }
  });
  it('bokning, transaktion, bon, köp och referens', () => {
    expect(kindOf(['Bokningsnummer AB12345'])).toBe('bokning')
    expect(kindOf(['Booking reference: XY778899'])).toBe('bokning')
    expect(kindOf(['Transaktions-ID 123456789'])).toBe('transaktion')
    expect(kindOf(['Bonnr 20415'])).toBe('bon')
    expect(kindOf(['Köpnummer 778812'])).toBe('bon')
    expect(kindOf(['Referensnummer 5566778'])).toBe('referens')
  });
  it('fakturanummer går före kvittonummer, som går före ordernummer och referens', () => {
    expect(kindOf(['Referens 111222', 'Ordernr 333444', 'Kvitto nr 555666', 'Fakturanr 777888'])).toBe('faktura')
    expect(kindOf(['Referens 111222', 'Ordernr 333444', 'Kvitto nr 555666'])).toBe('kvitto')
    expect(kindOf(['Referens 111222', 'Ordernr 333444'])).toBe('order')
  });
  it('numret på raden under nyckelordet läses också', () => {
    expect(findReceiptNumberDetailed(['Fakturanummer', '100234', 'Fakturadatum'])?.number).toBe('100234')
    expect(findReceiptNumberDetailed(['Ordernummer:', 'A-77120'])?.number).toBe('A-77120')
  });
  it('en digital PDF med allt på en rad ger numret direkt efter nyckelordet', () => {
    expect(findReceiptNumberDetailed(['Faktura Fakturanummer 100234 Fakturadatum 2024-05-12 Förfallodatum 2024-06-11'])?.number).toBe('100234')
  });
  it('belopp, datum och kundnummer är inga nummer', () => {
    expect(findReceiptNumberDetailed(['Order 250 kr'])).toBeNull()
    expect(findReceiptNumberDetailed(['Order 250 SEK'])).toBeNull()
    expect(findReceiptNumberDetailed(['Orderdatum 2024-05-12'])).toBeNull()
    expect(findReceiptNumberDetailed(['Kundnummer 12345'])).toBeNull()
    expect(findReceiptNumberDetailed(['Order Date: 2024-05-12'])).toBeNull()
  });
  it('inget nummer ger null, inte ett hittepå', () => {
    expect(findReceiptNumberDetailed(['ICA Supermarket', 'Mjölk 18,50', 'Totalt 105,40'])).toBeNull()
    expect(parseReceiptText('ICA\nTotalt 105,40').receiptNumber).toBeNull()
    expect(parseReceiptText('ICA\nTotalt 105,40').receiptNumberLabel).toBeNull()
  });
  it('parse tar med benämningen', () => {
    const r = parseReceiptText('Webbshop\nOrdernummer 9988776\nTotalt 500,00')
    expect(r.receiptNumber).toBe('9988776')
    expect(r.receiptNumberKind).toBe('order')
    expect(r.receiptNumberLabel).toBe('Ordernummer')
  });
});

describe('utländsk valuta utan tecken på totalraden', () => {
  it('ett dokument som bara talar om dollar är i dollar', () => {
    const r = parseReceiptText('Acme Inc.\nInvoice Number: 20240501\nCurrency: USD\nDate: 2024-05-12\nTotal 25.00')
    expect(r.currency).toBe('USD')
    expect(r.amount).toBe(25)
  });
  it('kronor någonstans i dokumentet betyder kronor', () => {
    expect(parseReceiptText('Butiken\nPris i USD 10\nTotalt 193,75 kr').currency).toBeNull()
    expect(parseReceiptText('Butiken\nTotalt 193,75 SEK\nRef $ 12').currency).toBeNull()
  });
  it('utan något valutatecken förblir det kronor', () => {
    expect(parseReceiptText('Butiken\nDatum 2024-05-12\nTotalt 193,75').currency).toBeNull()
  });
});

import { classifyDocument } from './ocrReceipt.js';

const CV = `
  Anna Andersson
  Curriculum Vitae
  Telefon: 070-123 45 67
  anna.andersson@example.se
  linkedin.com/in/annaandersson

  Arbetslivserfarenhet
  2019 - 2021  Säljare, Elgiganten, Stockholm
  2021 - 2024  Butikschef, Clas Ohlson, Uppsala
  Ansvarade för en omsättning på 12 miljoner kr och 14 medarbetare.

  Utbildning
  2016 - 2019  Ekonomprogrammet, Uppsala universitet
  Kompetenser
  Excel, försäljning, ledarskap
  Körkort B
  Språk: svenska, engelska
`;

describe('dokument som inte är kvitton eller fakturor', () => {
  it('ett CV som nämner Elgiganten blir inget Elgiganten-kvitto', () => {
    const r = parseReceiptText(CV)
    expect(r.notReceipt).toBe(true)
    expect(r.documentKind).toBe('other')
    expect(r.supplier).toBeNull()
    expect(r.amount).toBeNull()
    expect(r.accountCode).toBeNull()
    expect(r.date).toBeNull()
    expect(r.vatAmount).toBeNull()
    expect(r.receiptNumber).toBeNull()
  })

  it('classifyDocument ger CV negativ poäng och ett kvitto positiv', () => {
    expect(classifyDocument(CV).isReceipt).toBe(false)
    expect(classifyDocument(CV).score).toBeLessThan(2)
    expect(classifyDocument('Circle K\nDatum: 2024-05-12\nBensin 500,00\nTotalt 500,00\nMoms 25% 100,00').isReceipt).toBe(true)
  })

  it('ett personligt brev, ett avtal och ren text utan belopp är inga kvitton', () => {
    expect(parseReceiptText('Hej!\nJag söker tjänsten som säljare hos er. Med vänlig hälsning, Anna').notReceipt).toBe(true)
    expect(parseReceiptText('Anställningsavtal\nMellan Bolaget AB och Anna Andersson\nAvtalet gäller från 2024-01-01').notReceipt).toBe(true)
    expect(parseReceiptText('Personligt brev\nJag har arbetat på Elgiganten i tre år och sålt för 400 000 kr').notReceipt).toBe(true)
  })

  it('en text utan siffror eller belopp är inget kvitto', () => {
    expect(parseReceiptText('Bara lite text utan några belopp alls').notReceipt).toBe(true)
  })

  it('tomt gör inget felaktigt, men flaggas inte som "inte ett kvitto"', () => {
    expect(parseReceiptText('').notReceipt).toBe(false)
    expect(parseReceiptText(null).amount).toBeNull()
  })
});

describe('leverantör och konto', () => {
  it('en butik som bara nämns längre ned blir inte leverantör', () => {
    const r = parseReceiptText('Bolagets Kontor AB\nFaktura\nFakturadatum 2024-05-01\nOrg.nr 556000-1234\nBankgiro 999-9999\nBetalningsvillkor 30 dagar\nRabatt vid köp hos Elgiganten\nAtt betala 500,00')
    expect(r.supplier).not.toBe('Elgiganten')
    expect(r.supplierMatched).toBe(false)
  })

  it('ICA inne i ett annat ord ("Africa") är inte ICA', () => {
    const r = parseReceiptText('Africa Travel AB\nDatum 2024-05-01\nTotalt 900,00\nMoms 6% 50,94')
    expect(r.supplier).not.toBe('ICA')
  })

  it('en känd leverantör i huvudet känns fortfarande igen', () => {
    const r = parseReceiptText('Elgiganten\nOrg.nr 556000-1234\nDatum: 2024-05-12\nTotalt 1 999,00\nMoms 25% 399,80')
    expect(r.supplier).toBe('Elgiganten')
    expect(r.supplierMatched).toBe(true)
    expect(r.accountCode).toBe('5410')
  })

  it('generiska ord som "mat" i ett annat ord ger inte ett restaurangkonto', () => {
    const r = parseReceiptText('Bolaget AB\nDatum 2024-05-01\nSystematisk kvalitetsgranskning\nTotalt 500,00\nMoms 25% 100,00')
    expect(r.accountCode).not.toBe('6071')
  })
});

describe('en riktig faktura får ett konto och exakta belopp', () => {
  const invoice = `
    Konsultbolaget i Stockholm AB
    Faktura
    Fakturanummer 20240117
    Fakturadatum 2024-05-01
    Förfallodatum 2024-05-31
    Org.nr 556123-4567
    Bankgiro 123-4567
    Konsulttjänster maj 800,00
    Summa exkl. moms 800,00
    Moms 25% 200,00
    Att betala 1 000,00
  `;
  it('läser totalen, momsen, numret och föreslår konto', () => {
    const r = parseReceiptText(invoice)
    expect(r.notReceipt).toBe(false)
    expect(r.documentKind).toBe('invoice')
    expect(r.amount).toBe(1000)
    expect(r.vatRate).toBe(25)
    expect(r.vatVerified).toBe(true)
    expect(r.amountVerified).toBe(true)
    expect(r.receiptNumber).toBe('20240117')
    expect(r.date).toBe('2024-05-01')
    expect(r.accountCode).toBe('6550')
    expect(r.accountGuessed).toBe(false)
    expect(r.accountSource).toBe('keyword')
  })

  it('en faktura utan någon regel som matchar får 6990 som en märkt gissning', () => {
    const r = parseReceiptText('Okänt Bolag AB\nFaktura\nFakturanummer 5544\nFakturadatum 2024-05-01\nBankgiro 999-9999\nDiverse\nAtt betala 750,00\nVarav moms 25% 150,00')
    expect(r.accountCode).toBe('6990')
    expect(r.accountGuessed).toBe(true)
    expect(r.amount).toBe(750)
  })

  it('totalen är inte nettobeloppet eller momsraden', () => {
    const r = parseReceiptText('Bolaget AB\nFaktura\nFakturadatum 2024-05-01\nBankgiro 999-9999\nSumma exkl. moms 800,00\nMoms 25% 200,00\nTotalt inkl. moms 1 000,00')
    expect(r.amount).toBe(1000)
  })

  it('netto + moms = totalt kontrollerar beloppet, och en avvikande total rättas till summan', () => {
    const r = parseReceiptText('Bolaget AB\nFaktura\nFakturadatum 2024-05-01\nBankgiro 999-9999\nSumma exkl. moms 800,00\nMoms 25% 200,00\nAtt betala 1 000,00')
    expect(r.amountVerified).toBe(true)
    // Ett belopp som plockats fel (här "Summa 800,00", nettot) rättas när
    // summan av netto och moms finns som ett annat belopp i dokumentet.
    const off = parseReceiptText('Bolaget AB\nFaktura\nFakturadatum 2024-05-01\nBankgiro 999-9999\nNettobelopp 800,00\nMoms 25% 200,00\nSumma 800,00\nBelopp inkl moms 1 000,00')
    expect(off.amount).toBe(1000)
    expect(off.amountVerified).toBe(true)
    // Stämmer inget annat belopp rörs inte totalen.
    const keep = parseReceiptText('Bolaget AB\nFaktura\nFakturadatum 2024-05-01\nBankgiro 999-9999\nNettobelopp 800,00\nMoms 25% 200,00\nAtt betala 1 234,00')
    expect(keep.amount).toBe(1234)
    expect(keep.amountVerified).toBe(false)
  })
});

describe('belopp: gissningar märks som gissningar', () => {
  it('ett belopp utan totalrad är en gissning att kontrollera', () => {
    const r = parseReceiptText('Kiosken\nDatum 2024-05-12\nGodis 12,50\nTidning 39,00')
    expect(r.amount).toBe(39)
    expect(r.amountGuessed).toBe(true)
  })
  it('ett belopp på en totalrad är inte en gissning', () => {
    const r = parseReceiptText('Kiosken\nDatum 2024-05-12\nGodis 12,50\nTotalt 12,50')
    expect(r.amount).toBe(12.5)
    expect(r.amountGuessed).toBe(false)
  })
  it('hela tal utan valutamarkering plockas inte som belopp', () => {
    const r = parseReceiptText('Butiken\nDatum 2024-05-12\nKassa 4\nMjölk 18,50\nBrod 32,90\nArtikelnummer 550123')
    expect(r.amount).toBe(32.9)
  })
});

describe('numret på raden under etiketten (Elgiganten-kvittot)', () => {
  it('etikett med datum och tid på samma rad, numret på nästa', () => {
    const lines = ['ELGIGANTEN', 'Kvitto', 'Elgiganten Skellefteå', 'Ordernummer: 2026-05-26 18:34 SMILLA', '2302039269', '--------']
    const r = findReceiptNumberDetailed(lines)
    expect(r).toEqual({ number: '2302039269', kind: 'order', label: 'Ordernummer' })
  })
  it('etikett med bara kolon och numret på nästa rad', () => {
    expect(findReceiptNumberDetailed(['Ordernummer:', '2302039269'])?.number).toBe('2302039269')
    expect(findReceiptNumberDetailed(['Fakturanr', '20240117'])?.number).toBe('20240117')
  })
  it('hela kvittot som OCR kan läsa det ger ordernumret, totalen och momsen rätt', () => {
    const text = `ELGIGANTEN
Kvitto
Elgiganten Skellefteå
Varugatan 6
93176 Skellefteå
Ordernummer: 2026-05-26 18:34 SMILLA
2302039269
Hanna Gotthardsson
Svannäs 42
Telefon: +46705667610
Take now
26th May 2026
220282 25% 899.00
PlayStation 5 (PS5) DualSense trådlös kontroll (vit)
Totalt inkl. moms 899.00
Card 899.00
Betald summa 899.00
Återstår att betala 0.00
Moms Belopp Moms Totalt
25% 719.20 179.80 899.00
Sum 719.20 179.80 899.00
Datum: 2026-05-26 Tid: 18:33:40
Betalningssätt: Swish
Totalt: SEK 899,00`
    const r = parseReceiptText(text)
    expect(r.receiptNumber).toBe('2302039269')
    expect(r.receiptNumberLabel).toBe('Ordernummer')
    expect(r.supplier).toBe('Elgiganten')
    expect(r.accountCode).toBe('5410')
    expect(r.vatRate).toBe(25)
  })
  it('rubriker och belopp på nästa rad blir inget nummer', () => {
    expect(findReceiptNumberDetailed(['Kvitto', '12345 Storgatan'])).toBeNull()
    expect(findReceiptNumberDetailed(['Ordernr', '899,00'])).toBeNull()
    expect(findReceiptNumberDetailed(['Order nr: 2026-05-26', 'Item 12345'])).toBeNull()
    expect(findReceiptNumberDetailed(['Ordernummer:', '123'])).toBeNull()
  })
});

describe('Elgiganten-kvittot såsom OCR faktiskt läser det', () => {
  const ocr = `Kvitto
Elgiganten Skellefteå
Varugatan 6
93176 Skellefteå

Ordernummer: 2026-05-26 18:34

SMILLA
2302039269
Hanna Elisabet Gotthardsson
Svannas 42
+46705667610
Take now
26th May 2026
220282 25% 899.00
PlayStation 5 (PS5) DualSense trådlös kontroll (vit)
Totalt inkl. moms 899.00
Card 899.00
Betald summa 899.00
Återstår att betala 0.00
Moms Belopp Moms Totalt
25% 719.20 179.80 899.00
Sum 719.20 179.80 899.00
Kortbetalningsinformation
Datum: 2026-05-26 Tid: 18:33:40 Korttyp:
Swish Betalningssatt: Swish
Anbud: CN2E001779813220014 referens:
d69c9169927149ffa251e656
b055ac6-2302039269 Typ: VAROR TJÄNSTER Totalt:
SEK 899,00`
  it('ordernumret hoppar förbi namnet SMILLA och tas, inte terminalens referens', () => {
    const r = parseReceiptText(ocr)
    expect(r.receiptNumber).toBe('2302039269')
    expect(r.receiptNumberKind).toBe('order')
    expect(r.supplier).toBe('Elgiganten')
    expect(r.amount).toBe(899)
    expect(r.vatRate).toBe(25)
    expect(r.accountCode).toBe('5410')
    expect(r.date).toBe('2026-05-26')
  })
  it('en kortterminals referens (hex-hash) är inget kvittonummer', () => {
    expect(findReceiptNumberDetailed(['Anbud: CN2E001779813220014 referens:', 'd69c9169927149ffa251e656'])).toBeNull()
    expect(findReceiptNumberDetailed(['Referensnummer d69c9169927149ffa251e656'])).toBeNull()
  })
  it('rader med siffror eller fler ord mellan etiketten och numret stoppar sökningen', () => {
    expect(findReceiptNumberDetailed(['Ordernummer:', '2026-05-26 18:34', '2302039269'])).toBeNull()
    expect(findReceiptNumberDetailed(['Ordernummer:', 'Kund Anna Andersson Stockholm', '2302039269'])).toBeNull()
    expect(findReceiptNumberDetailed(['Ordernummer:', 'SMILLA', 'KASSA 2', '2302039269'])).toBeNull()
    expect(findReceiptNumberDetailed(['Ordernummer:', 'SMILLA', 'KASSA', '2302039269'])?.number).toBe('2302039269')
  })
});

describe('momstabell utan ordet moms på raden', () => {
  it('sats, belopp, moms och totalt på en rad verifierar momsen', () => {
    const r = parseReceiptText('Elgiganten\nKvitto\nDatum 2026-05-26\nTotalt inkl. moms 899.00\nMoms Belopp Moms Totalt\n25% 719.20 179.80 899.00\nSum 719.20 179.80 899.00')
    expect(r.amount).toBe(899)
    expect(r.vatAmount).toBe(179.8)
    expect(r.vatRate).toBe(25)
    expect(r.vatVerified).toBe(true)
  })
  it('en tabellrad som inte går ihop används inte', () => {
    const r = parseReceiptText('Butiken\nDatum 2026-05-26\nTotalt 899.00\n25% 700.00 179.80 899.00')
    expect(r.vatVerified).toBe(false)
  })
});

import { pdfItemsToText } from './ocrReceipt.js';

describe('PDF-text med radbrytningar', () => {
  const item = (str, y, extra = {}) => ({ str, transform: [1, 0, 0, 1, 10, y], ...extra });

  it('delar upp text på y-koordinat och behåller ordningen', () => {
    const text = pdfItemsToText([
      item('ICA', 700), item('SUPERMARKET', 700),
      item('Datum:', 680), item('2026-09-14', 680),
      item('Mjölk', 660), item('18,90', 660),
      item('Totalt:', 640), item('135,00 kr', 640),
    ]);
    expect(text.split('\n')).toEqual(['ICA SUPERMARKET', 'Datum: 2026-09-14', 'Mjölk 18,90', 'Totalt: 135,00 kr']);
  });

  it('bryter också vid radslut som pdf.js markerar', () => {
    const text = pdfItemsToText([item('Rad ett', 700, { hasEOL: true }), item('Rad två', 700)]);
    expect(text).toBe('Rad ett\nRad två');
  });

  it('ger rätt belopp och leverantör ur ett kvitto-PDF (var förut allt på en rad)', () => {
    const text = pdfItemsToText([
      item('ICA SUPERMARKET', 700), item('Exempelgatan 1', 690), item('Datum: 2026-09-14', 670),
      item('Mjölk', 650), item('18,90', 650), item('Ost', 640), item('84,10', 640),
      item('Totalt: 135,00 kr', 620), item('Moms 12 %: 14,46', 610), item('Kortköp Mastercard', 600), item('Kvittonr 48213', 590),
    ]);
    const p = parseReceiptText(text);
    expect(p.amount).toBe(135);
    expect(p.supplier).toBe('ICA');
    expect(p.date).toBe('2026-09-14');
  });
});

describe('dokument som inte är kvitton', () => {
  it('ett CV som nämner en butik och ett pris fylls inte i', () => {
    const p = parseReceiptText('Anna Andersson\nCurriculum Vitae\nArbetslivserfarenhet\n2021-2024 Säljare, Elgiganten, Stockholm. Kampanjer till 359 kr.\nUtbildning\nGymnasieexamen 2020\nKompetenser\nKundservice, Excel');
    expect(p.notReceipt).toBe(true);
    expect(p.supplier).toBeNull();
    expect(p.amount).toBeNull();
  });
});

describe('confidence skiljer på oläsbart och fel dokumenttyp', () => {
  // Text som varken har kvitto-ord, belopp eller CV-ord — klassisk
  // gråzon: kan vara riktig text om något annat, eller brus ur ett dåligt
  // foto. Låg Tesseract-confidence ska avgöra det åt "oläsbart".
  const AMBIGUOUS_TEXT = 'xj kfl mno rst pqw abcd efgh ijkl';

  it('låg confidence gör tvetydig text oläsbar, inte "fel dokument"', () => {
    const p = parseReceiptText(AMBIGUOUS_TEXT, { confidence: 30 });
    expect(p.notReceipt).toBe(true);
    expect(p.unreadable).toBe(true);
  });

  it('hög confidence på samma tvetydiga text ger "fel dokument", inte oläsbart', () => {
    const p = parseReceiptText(AMBIGUOUS_TEXT, { confidence: 92 });
    expect(p.notReceipt).toBe(true);
    expect(p.unreadable).toBe(false);
  });

  it('utan confidence (digital text, cachad avläsning) avgör innehållet ensamt, som förut', () => {
    const p = parseReceiptText(AMBIGUOUS_TEXT);
    expect(p.notReceipt).toBe(true);
    expect(p.unreadable).toBe(false);
  });

  it('tydliga CV-ord vinner över låg confidence — en riktig CV-bild ska aldrig kallas oläsbar', () => {
    const p = parseReceiptText('Curriculum Vitae\nArbetslivserfarenhet\nUtbildning', { confidence: 20 });
    expect(p.notReceipt).toBe(true);
    expect(p.unreadable).toBe(false);
  });
});

describe('leverantör på fakturor', () => {
  it('tar namnet, inte en fältrad som Fakturanummer eller Org.nr', () => {
    const p = parseReceiptText([
      'Faktura', 'Fakturanummer: 20261042', 'Fakturadatum: 2026-09-10', 'Förfallodatum: 2026-10-10',
      'Kontorsbolaget AB, Org.nr 556123-4567', 'Bankgiro 123-4567',
      'Kontorsstol 1 200,00', 'Moms 25 % 300,00', 'Att betala: 1 500,00 kr',
    ].join('\n'));
    expect(p.supplier).toBe('Kontorsbolaget AB');
    expect(p.amount).toBe(1500);
    expect(p.receiptNumber).toBe('20261042');
  });
});

describe('Elgiganten-kvittot, riktig avläsning av fotot', () => {
  // Texten Tesseract ger för fotot: numret två rader under etiketten (SMILLA
  // emellan) och med brus efter sig.
  const lines = ['ELGIGANTEN)', 'Kvitto', '~ Ordernummer: 2026-05-26 18:34', '| SMILLA', '2302039269 ES', 'Hanna Elisabet Gotthardsson |']
  it('hittar ordernumret trots brus och en rad emellan', () => {
    expect(findReceiptNumberDetailed(lines)).toEqual({ number: '2302039269', kind: 'order', label: 'Ordernummer' })
  })
  it('ett belopp med valuta efter etiketten blir inget nummer', () => {
    expect(findReceiptNumberDetailed(['Ordernummer:', '| SMILLA', '12345 kr'])).toBeNull()
  })
})

// Telefonfoton av Elgiganten-kvittot (suddigt, snett, ojämnt ljus). Raderna är
// de OCR faktiskt gav vid en simulerad fotoserie, utan kundens uppgifter.
describe('kvittonummer på ett fotat kvitto', () => {
  it('rättar felstavade etiketter', () => {
    expect(repairNumberLabels(['Ordermummer: SMILLA', 'Orgernummer 2026', '0rdernummer:', 'Fakturanurnmer 123'])).toEqual(
      ['Ordernummer: SMILLA', 'Ordernummer 2026', 'Ordernummer:', 'Fakturanummer 123'])
  })
  it('rör inte vanliga ord eller ord med många siffror', () => {
    expect(repairNumberLabels(['Organisationsnummer 556677', 'Kundnummer 12345', 'Kvitto', '2302039269'])).toEqual(
      ['Organisationsnummer 556677', 'Kundnummer 12345', 'Kvitto', '2302039269'])
  })
  it('läser numret trots "Ordermummer" och brus efter numret', () => {
    const r = findReceiptNumberDetailed(['ELGIGANTEN', 'Kvitto', 'a Ordermummer: SMILLA', '2302039269 Bas EE', 'Take now'])
    expect(r).toEqual({ number: '2302039269', kind: 'order', label: 'Ordernummer' })
  })
  it('datum och tid efter etiketten är inget nummer, även utan bindestreck', () => {
    expect(findReceiptNumberDetailed(['Ordernummer 20260526 10.34 |', '2302039269 |'])?.number).toBe('2302039269')
    expect(findReceiptNumberDetailed(['Ordernummer 202605261834 SMILLA', '2302039269 |'])?.number).toBe('2302039269')
  })
  it('ett 8-siffrigt fakturanummer utan klockslag är fortfarande ett nummer', () => {
    expect(findReceiptNumberDetailed(['Fakturanummer 20240117', 'Datum 2024-01-17'])?.number).toBe('20240117')
  })
  it('utan läsbar etikett räcker ett nummer som står två gånger', () => {
    const r = findReceiptNumberDetailed(['Kvitto', 'a 2302039269', 'Totalt 899.00', 'b055ac6-2302039269 Typ:'])
    expect(r).toEqual({ number: '2302039269', kind: 'unknown', label: 'Nummer' })
  })
  it('utan etikett och utan upprepning används en ensam siffersträng högt upp', () => {
    const r = findReceiptNumberDetailed(['Elgiganten', 'Kvitto', 'ol 2302039269 SMILL', 'Take now', 'Totalt 899.00'])
    expect(r?.number).toBe('2302039269')
  })
  it('kortterminalens referens och telefonnummer blir aldrig kvittonummer', () => {
    expect(findReceiptNumberDetailed(['Anbud: CN2E001779813220014 referens:', 'G6CD169927149ffa251e656'])).toBeNull()
    expect(findReceiptNumberDetailed(['Kvitto', '+46705667610', 'Telefon: +46705667610', 'Totalt 899.00'])).toBeNull()
    expect(findReceiptNumberDetailed(['Kvitto', '0705667610', 'Ordernummer:', 'Kund Anna Andersson', '0705667610'])).toBeNull()
  })
})

import { totalFromVatAmount, photoAdvice } from './ocrReceipt.js';

// Kvitton från butik skriver ofta hela kronor utan decimaler och utan "kr", och
// momsen på en egen rad utan decimaler. Det gick tidigare sönder på värsta
// möjliga sätt: totalraden syntes inte alls, och momsbeloppet på raden under
// fylldes i som totalbelopp (24 kr blev 4,80 kr).
describe('belopp i hela kronor utan decimaler', () => {
  it('läser "TOTALT 24" och verifierar mot momsraden', () => {
    const r = parseReceiptText(['DOLLARSTORE', 'Datum 2026-09-14', 'Skal 12', 'Penna 12', 'TOTALT 24', 'Moms 25% 4,80', 'Kort'].join('\n'))
    expect(r.amount).toBe(24)
    expect(r.amountVerified).toBe(true)
    expect(r.vatRate).toBe(25)
    expect(r.vatAmount).toBe(4.8)
    expect(r.vatVerified).toBe(true)
  })

  it('läser moms utan decimaler: "Moms 25% 3" mot "Totalt 15"', () => {
    const r = parseReceiptText(['Kiosken', '2026-09-14 14:02', 'Godis 15', 'Totalt 15', 'Moms 25% 3'].join('\n'))
    expect(r.amount).toBe(15)
    expect(r.vatAmount).toBe(3)
    expect(r.vatVerified).toBe(true)
    expect(r.vatRateGuessed).toBe(false)
  })

  it('ett kvitto utan en enda decimal är fortfarande ett kvitto', () => {
    const r = parseReceiptText(['COOP', '2026-09-01', 'Bulle 15', 'SUMMA 15', 'MOMS 3', 'ORG NR 556123-4567'].join('\n'))
    expect(r.notReceipt).toBe(false)
    expect(r.amount).toBe(15)
    expect(r.vatAmount).toBe(3)
  })

  it('kortnummer och antal artiklar är inte belopp', () => {
    const r = parseReceiptText(['COOP', 'Kort XXXX XXXX 1234', 'Totalt antal artiklar 3', 'TOTALT 15', 'Moms 3'].join('\n'))
    expect(r.amount).toBe(15)
  })
})

describe('momsbeloppet på kvittot som facit för totalen', () => {
  it('räknar fram totalen ur momsen när bara en svensk sats ger ett belopp i texten', () => {
    expect(totalFromVatAmount(4.8, [12, 24, 4.8])).toEqual({ rate: 25, amount: 24 })
    // Ingen av satserna ger ett belopp som finns i texten: ingen gissning.
    expect(totalFromVatAmount(7, [30, 7])).toBeNull()
  })

  it('rättar en felläst totalrad mot momsen ("TOTALT 2h" blir 24)', () => {
    const r = parseReceiptText(['KIOSK', '2026-09-14', 'Bulle 24,00', 'TOTALT 2h', 'Moms 25% 4,80'].join('\n'))
    expect(r.amount).toBe(24)
    expect(r.amountVerified).toBe(true)
    expect(r.vatRate).toBe(25)
  })

  it('går momsen inte ihop med beloppet märks BÅDA som något att kontrollera', () => {
    const r = parseReceiptText(['KIOSK', '2026-09-14', 'TOTALT 30,00', 'Moms 7,00'].join('\n'))
    expect(r.amount).toBe(30)
    expect(r.amountGuessed).toBe(true)
    expect(r.vatMismatch).toBe(true)
    expect(r.vatRateGuessed).toBe(true)
    expect(r.vatVerified).toBe(false)
  })

  it('momsregistreringsnummer är inte ett momsbelopp', () => {
    const r = parseReceiptText(['Firma AB', 'Momsreg.nr SE556123456701', 'Totalt 100,00', 'Moms 25% 20,00'].join('\n'))
    expect(r.vatAmount).toBe(20)
    expect(r.vatVerified).toBe(true)
  })
})

describe('råd om fotot', () => {
  it('mörkt och kontrastsvagt går före oskärpa', () => {
    expect(photoAdvice({ sharpness: 2, contrast: 120, brightness: 40, cropRatio: 0.8, longEdge: 1500 })).toBe('dark')
    expect(photoAdvice({ sharpness: 20, contrast: 20, brightness: 150, cropRatio: 0.8, longEdge: 1500 })).toBe('dark')
  })
  it('suddigt foto', () => {
    expect(photoAdvice({ sharpness: 3, contrast: 130, brightness: 200, cropRatio: 0.8, longEdge: 1500 })).toBe('blurry')
  })
  it('kvittot litet i bilden OCH litet i pixlar', () => {
    expect(photoAdvice({ sharpness: 25, contrast: 130, brightness: 200, cropRatio: 0.08, longEdge: 300 })).toBe('far')
    // Litet i bilden men fortfarande stort i pixlar: inget att klaga på.
    expect(photoAdvice({ sharpness: 25, contrast: 130, brightness: 200, cropRatio: 0.08, longEdge: 1600 })).toBeNull()
  })
  it('en bra bild får inget råd, och utan mätvärden sägs inget', () => {
    expect(photoAdvice({ sharpness: 20, contrast: 140, brightness: 210, cropRatio: 0.9, longEdge: 1800 })).toBeNull()
    expect(photoAdvice(null)).toBeNull()
  })
})

// Två riktiga kvitton som användaren fotade 2026-09-23 och som blev fel i
// appen. Texten här är formen kvittona faktiskt har (rätt avläst), så att
// samma fel inte kan komma tillbaka.
describe('riktiga butikskvitton', () => {
  it('Jacks Import: MOMS 1 och TOTAL MOMS är samma tre kronor, inte sex', () => {
    const r = parseReceiptText([
      'JACKS IMPORT', '& VARUHUS', 'TELNR: 0910-373 75',
      'KVITTO#855279 23/09/26 13:30', 'ORG.NR: 5563363893', '*KVITTO*',
      '1x 15.00 *15.00 A', 'FOTORAM SV 13X18CM',
      'SUMMA: *15.00',
      'MOMSBRUTTO1 *15.00', 'MOMS 1 *3.00', 'TOTAL MOMS *3.00',
      'POSTER 1Q', 'KONTANT *15.00',
    ].join('\n'))
    expect(r.amount).toBe(15)
    expect(r.vatAmount).toBe(3)
    expect(r.vatRate).toBe(25)
    expect(r.vatVerified).toBe(true)
    expect(r.vatMismatch).toBe(false)
    expect(r.paymentMethod).toBe('cash')
  })

  it('Dollarstore: momstabellen utan procenttecken ger 6 % och 1,36 kr', () => {
    const r = parseReceiptText([
      'DOLLARSTORE', 'Dollarstore', 'Org nr: 556537-1662',
      'Gymnasievagen 18', '931 57 SKELLEFTEA',
      '219ks01 Tor', '2026-09-23 13:22', 'Kvitto 2190100884216',
      'Produkt Ant SEK', 'Red Bull 250ml 1 St. 11,00', '(a 15,00)',
      'Pant 1 St. 1,00', 'Red Bull 250ml 1 St. 11,00', 'Pant 1 St. 1,00',
      'Totalt 4 24,00',
      'Betalt', 'MASTERCARD 24,00', 'Swedbank Pay',
      'Rabatt', '2 for 22', '8,00',
      'Moms Belopp Netto Brutto',
      '6,00 1,36 22,64 24,00',
    ].join('\n'))
    expect(r.amount).toBe(24)
    expect(r.vatRate).toBe(6)
    expect(r.vatAmount).toBe(1.36)
    expect(r.vatVerified).toBe(true)
    expect(r.paymentMethod).toBe('card')
  })

  it('en momstabell med flera satser summeras fortfarande', () => {
    const r = parseReceiptText(['Butiken', 'Totalt 106,00', 'Moms 25% 20,00', 'Moms 6% 1,00'].join('\n'))
    // 20,00 + 1,00 = 21,00, vilket inte är momsen på 106 kr med någon enskild
    // sats: avvikelsen ska synas i stället för att en av raderna väljs ut.
    expect(r.vatVerified).toBe(false)
    expect(r.vatMismatch).toBe(true)
  })

  it('"TOTAL MOMS" är momsen, aldrig summan att betala', () => {
    const r = parseReceiptText(['Butiken', 'SUMMA: 15.00', 'TOTAL MOMS 3.00'].join('\n'))
    expect(r.amount).toBe(15)
    expect(r.vatAmount).toBe(3)
  })
})

describe('datum och konto på butikskvitton', () => {
  it('läser tvåsiffrigt årtal med snedstreck hela vägen (23/09/26)', () => {
    const r = parseReceiptText(['JACKS IMPORT', 'KVITTO#855279 23/09/26 13:30', 'SUMMA: 15.00', 'TOTAL MOMS 3.00'].join('\n'))
    expect(r.date).toBe('2026-09-23')
  })

  it('butikens telefonnummer i sidhuvudet gör inte kvittot till en telefonkostnad', () => {
    const r = parseReceiptText(['JACKS IMPORT', 'TELNR: 0910-373 75', 'FOTORAM SV 13X18CM', 'SUMMA: 15.00', 'TOTAL MOMS 3.00'].join('\n'))
    expect(r.accountCode).toBe('6990')
    expect(r.accountGuessed).toBe(true)
  })

  it('villkorstexten längst ned styr inte kontot', () => {
    const r = parseReceiptText([
      'DOLLARSTORE', 'Red Bull 250ml 11,00', 'Totalt 4 24,00', 'Moms Belopp Netto Brutto', '6,00 1,36 22,64 24,00',
      'Inget byte eller öppet köp av livsmedel,', 'hygienartiklar, djurmat och underkläder.',
    ].join('\n'))
    expect(r.accountCode).toBe('6990')
    expect(r.accountGuessed).toBe(true)
  })
})

// Exakt den text Tesseract gav för Jacks-kvittot på ett telefonfoto: versalt M
// blir N eller H, och kvittots stjärna framför beloppen blir ett dollartecken.
describe('felläst text från ett riktigt telefonfoto', () => {
  const jacks = [
    'JACKS IMPORT', '& VARUHUS', 'TELNR: 0910-373 79',
    'KVI1108855279 — 23/09/26 13:30', '01130556069 — OPERA0007 (0007)',
    'ORG.NR: 5563753893', 'KVITTO:',
    '1x 15.00 $15.00 A', 'FOTORAN SV 13X18CH',
    'SUNMA: +15. 00', 'NONSBRUTTO1 415. 00', 'HONS. 1 43.00', 'TOTAL MONS «3. 00',
    'POSTER 1Q', 'KONTANT 215. 00',
  ].join('\n');

  it('"TOTAL MONS" är fortfarande momsen, inte totalen', () => {
    const r = parseReceiptText(jacks, { confidence: 66 })
    expect(r.amount).toBe(15)
    expect(r.vatAmount).toBe(3)
    expect(r.vatRate).toBe(25)
    expect(r.vatVerified).toBe(true)
  })

  it('ett ensamt dollartecken på ett svenskt kvitto är inte dollar', () => {
    expect(parseReceiptText(jacks, { confidence: 66 }).currency).toBeNull()
  })

  it('men en uttrycklig valutakod gäller fortfarande', () => {
    const r = parseReceiptText(['Cloud Inc', 'Invoice', 'Total: USD 25.00', 'VAT 0%'].join('\n'))
    expect(r.currency).toBe('USD')
  })

  it('"Simonsson" och liknande namn blir inte momsrader', () => {
    const r = parseReceiptText(['Simonsson Bygg AB', 'Totalt 125,00', 'Moms 25% 25,00'].join('\n'))
    expect(r.vatAmount).toBe(25)
    expect(r.amount).toBe(125)
  })
})

describe('leverantör trots felstavning', () => {
  const supplierOf = (lines) => parseReceiptText(lines.join('\n'))

  it.each([
    ['C00P KONSUM', 'Coop'],
    ['1CA Supermarket Vasastan', 'ICA'],
    ['HEMKOP', 'Hemköp'],
    ['PRE5SBYRAN Centralen', 'Pressbyrån'],
    ['CLAS OHL SON', 'Clas Ohlson'],
    ['C1RCLE K Solna', 'Circle K'],
    ['E1giganten Kungens Kurva', 'Elgiganten'],
  ])('%s blir %s', (head, name) => {
    const r = supplierOf([head, 'Totalt 100,00', 'Moms 25% 20,00'])
    expect(r.supplier).toBe(name)
    expect(r.supplierMatched).toBe(true)
  })

  it('gissar inte en kedja för en okänd butik', () => {
    const r = supplierOf(['Blomsterhandeln Pärlan AB', 'Totalt 249,00', 'Moms 25% 49,80'])
    expect(r.supplier).toBe('Blomsterhandeln Pärlan AB')
    expect(r.supplierMatched).toBe(false)
  })

  it('MAT blir inte MAX', () => {
    const r = supplierOf(['MAT & DRYCK AB', 'Totalt 100,00', 'Moms 12% 10,71'])
    expect(r.supplierMatched).toBe(false)
  })

  it('en gatuadress med kedjenamn är ingen kedja', () => {
    const r = supplierOf(['Bygg & Fix AB', 'Lidlvagen 4', 'Totalt 100,00', 'Moms 25% 20,00'])
    expect(r.supplier).toBe('Bygg & Fix AB')
    expect(r.supplierMatched).toBe(false)
  })
})

describe('datum som kan vara felläst', () => {
  const today = new Date(2026, 8, 24)
  const parse = (lines, opts = {}) => parseReceiptText(lines.join('\n'), { today, ...opts })

  it('ett tydligt datum är avläst', () => {
    const r = parse(['ICA Nära', '2026-05-26 14:02', 'Totalt 100,00', 'Moms 12% 10,71'])
    expect(r.date).toBe('2026-05-26')
    expect(r.dateGuessed).toBe(false)
  })

  it('ett datum OCR var osäker på märks Kontrollera', () => {
    const r = parse(['ICA Nära', '2026-08-26 14:02', 'Totalt 100,00', 'Moms 12% 10,71'], { weakTokens: ['2026-08-26'] })
    expect(r.date).toBe('2026-08-26')
    expect(r.dateGuessed).toBe(true)
  })

  it('ett osäkert belopp fäller inte datumet', () => {
    const r = parse(['ICA Nära', '2026-05-26 14:02', 'Totalt 26,00', 'Moms 12% 2,79'], { weakTokens: ['26,00'] })
    expect(r.dateGuessed).toBe(false)
  })

  it('ett datum i framtiden rättas om en förväxlad siffra förklarar det', () => {
    const r = parse(['ICA Nära', '2026-11-05', 'Totalt 100,00', 'Moms 12% 10,71'])
    expect(r.date < '2026-09-26').toBe(true)
    expect(r.dateGuessed).toBe(true)
  })

  it('kvittot och kortterminalen säger olika datum', () => {
    const r = parse(['ICA Nära', '2026-08-26', 'Totalt 100,00', 'Moms 12% 10,71', 'KORTKÖP', '2026-05-26'])
    expect(r.dateGuessed).toBe(true)
  })

  it('förfallodatum är inte köpdatum', () => {
    const r = parse(['Konsult AB', 'Faktura', 'Förfallodatum 2026-10-20', 'Fakturadatum 2026-09-20', 'Att betala 1 250,00', 'Moms 25% 250,00'])
    expect(r.date).toBe('2026-09-20')
    expect(r.dateGuessed).toBe(false)
  })

  it('ett datum som inte finns i kalendern används inte', () => {
    const r = parse(['ICA Nära', '2026-02-30', 'Totalt 100,00', 'Moms 12% 10,71'])
    expect(r.date).toBeNull()
  })
})

import { supplierHasOrgNumber, parseReceiptText as parseForDollarstore } from './ocrReceipt.js';

describe('Dollarstore-kvittot (riktigt foto, 2026-09-29)', () => {
  // Råtexten som Tesseract gav för ett fotat kvitto från Dollarstore.
  const text = [
    'DOILAK TORE) |', 'Dollarstore', 'Org nr: 556537 1662', 'Gysnasievagen 18',
    '219ks01 Tor', '2026-09-23 13:22', 'Kvitto 21901 384216', 'Produkt Ant SEK',
    'ed BL 250m) 1st. 11,00', '8 a 24,00', 'MASTERCARD 24,00', 'Debit Mastercard',
    'Moms Belopp Netto Brutto', '6,0( 1,36 22,64 24,00',
  ].join('\n');

  it('ett nummer som OCR klyvt läses ihop men markeras som osäkert', () => {
    const r = findReceiptNumberDetailed(['Kvitto 21901 384216']);
    expect(r?.number).toBe('21901384216');
    expect(r?.uncertain).toBe(true);
  });

  it('ett helt nummer är inte osäkert', () => {
    expect(findReceiptNumberDetailed(['Kvittonummer 2190100884216'])?.uncertain).toBeFalsy();
  });

  it('butiksnamnet räknas som avläst när org.-numret står under', () => {
    expect(supplierHasOrgNumber(['Dollarstore', 'Org nr: 556537 1662'], 'Dollarstore')).toBe(true);
    expect(supplierHasOrgNumber(['Dollarstore', 'Gymnasievägen 18'], 'Dollarstore')).toBe(false);
  });

  it('hela kvittot: rätt värden, och nummer att kontrollera', () => {
    const p = parseForDollarstore(text, { confidence: 71 });
    expect(p.supplier).toBe('Dollarstore');
    expect(p.supplierConfirmed).toBe(true);
    expect(p.date).toBe('2026-09-23');
    expect(p.amount).toBe(24);
    expect(p.vatRate).toBe(6);
    expect(p.vatAmount).toBeCloseTo(1.36, 2);
    expect(p.receiptNumberGuessed).toBe(true);
  });
});
