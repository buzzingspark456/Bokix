import { round2 } from './fixedAssets';
import { isReverseChargePurchaseAccount, withReverseChargeRows } from './reverseCharge';

/**
 * Enkel bokföring: verifikationsrader byggda ur en vanlig händelse ("jag har
 * köpt något") i stället för att användaren själv ska välja debet och kredit.
 * Raderna lagras som vanligt med debet/kredit, så resten av bokföringen är
 * oförändrad. Här finns också beskrivningar av rader på vanlig svenska
 * ("Pengar ut från 1930 Företagskonto") som visas i stället för D/K.
 */

export const VAT_RATES = [25, 12, 6, 0];

const OUTPUT_VAT = { 25: '2611', 12: '2621', 6: '2631' };
const INPUT_VAT = '2641';
const REVENUE = { 25: '3001', 12: '3002', 6: '3003', 0: '3004' };
const OWNER_DEPOSIT = '2018'; // Övriga egna insättningar (enskild firma)
const OWNER_WITHDRAWAL = '2013'; // Övriga egna uttag (enskild firma)
const DEFAULT_BANK = '1930';

export const SIMPLE_KINDS = [
  { id: 'expense', title: 'Jag har köpt något', hint: 'Material, hyra, programvara, resor och andra kostnader' },
  { id: 'income', title: 'Jag har fått betalt', hint: 'Försäljning som redan är betald, till exempel Swish eller kontant' },
  { id: 'transfer', title: 'Jag har flyttat pengar', hint: 'Mellan bank, kassa och skattekonto' },
  { id: 'owner_in', title: 'Jag har satt in egna pengar', hint: 'Pengar från dig privat till firman', soleProp: true },
  { id: 'owner_out', title: 'Jag har tagit ut pengar', hint: 'Uttag till dig själv från firman', soleProp: true },
];

export function simpleKindsFor(orgType) {
  return SIMPLE_KINDS.filter(k => !k.soleProp || orgType === 'Enskild firma');
}

/** Delar ett belopp inklusive moms i netto och moms, till hela ören. */
export function splitVat(gross, rate) {
  const g = round2(Number(gross) || 0);
  const net = rate > 0 ? round2(g / (1 + rate / 100)) : g;
  return { net, vat: round2(g - net) };
}

/** Bank- och kassakonton (1900–1999) i kontoplanen. Bara de som är aktiva
 * (eller systemkonton) visas, med 1930 som reserv om inget är markerat. */
export function paymentAccounts(accounts) {
  const cash = (accounts || []).filter(a => /^19\d\d$/.test(String(a.code)));
  const active = cash.filter(a => a.active || a.system);
  const list = active.length > 0 ? active : cash.filter(a => a.code === DEFAULT_BANK);
  return list.length > 0 ? list : [{ code: DEFAULT_BANK, name: 'Företagskonto' }];
}

/** Konton man kan flytta pengar mellan: bank/kassa plus skattekontot. */
export function transferAccounts(accounts) {
  const tax = (accounts || []).find(a => a.code === '1630');
  return [...paymentAccounts(accounts), ...(tax ? [tax] : [])];
}

const num = (v) => round2(Number(String(v ?? '').replace(',', '.')) || 0);

/**
 * Bygger verifikationsrader ur en enkel händelse. Returnerar
 * `{ rows, errors }` där varje rad är `{ account, debet, kredit }` (tal).
 * `rows` är tom så länge något saknas; `errors` säger vad.
 *
 * fields: kind, amount (inklusive moms), vatRate, account, payAccount,
 * fromAccount, toAccount, payPrivate (enskild firma betalade med egna pengar).
 */
export function buildSimpleBooking(fields, { orgType } = {}) {
  const f = fields || {};
  const amount = num(f.amount);
  const errors = [];
  const fail = (msg) => { errors.push(msg); return { rows: [], errors }; };
  if (!(amount > 0)) return fail('Fyll i ett belopp.');

  const isSoleProp = orgType === 'Enskild firma';

  if (f.kind === 'expense') {
    const rate = Number(f.vatRate) || 0;
    const pay = f.payPrivate && isSoleProp ? OWNER_DEPOSIT : (f.payAccount || DEFAULT_BANK);
    if (!f.account) return fail('Välj vad du har köpt.');
    if (!/^[14-8]/.test(f.account) || /^19/.test(f.account)) return fail('Välj ett konto för kostnaden eller tillgången du köpt.');
    if (f.account === pay) return fail('Kostnaden och betalkontot kan inte vara samma konto.');
    // Tjänst från utlandet (omvänd skattskyldighet): ingen svensk moms på
    // kvittot, och momsen bokförs av oss med 2645/2614.
    if (isReverseChargePurchaseAccount(f.account)) {
      return { rows: withReverseChargeRows([{ account: f.account, debet: amount, kredit: 0 }, { account: pay, debet: 0, kredit: amount }]), errors };
    }
    const { net, vat } = splitVat(amount, rate);
    const rows = [{ account: f.account, debet: net, kredit: 0 }];
    if (vat > 0) rows.push({ account: INPUT_VAT, debet: vat, kredit: 0 });
    rows.push({ account: pay, debet: 0, kredit: amount });
    return { rows, errors };
  }

  if (f.kind === 'income') {
    const rate = Number(f.vatRate) || 0;
    const pay = f.payAccount || DEFAULT_BANK;
    const account = f.account || REVENUE[rate];
    if (!account || !/^[38]/.test(account)) return fail('Välj ett intäktskonto.');
    if (rate > 0 && !OUTPUT_VAT[rate]) return fail('Välj en momssats.');
    const { net, vat } = splitVat(amount, rate);
    const rows = [{ account: pay, debet: amount, kredit: 0 }, { account, debet: 0, kredit: net }];
    if (vat > 0) rows.push({ account: OUTPUT_VAT[rate], debet: 0, kredit: vat });
    return { rows, errors };
  }

  if (f.kind === 'transfer') {
    const from = f.fromAccount || DEFAULT_BANK;
    if (!f.toAccount) return fail('Välj vart pengarna ska.');
    if (from === f.toAccount) return fail('Pengarna kan inte flyttas till samma konto.');
    if (!/^1/.test(from) || !/^1/.test(f.toAccount)) return fail('Bara bank, kassa och skattekonto kan väljas här.');
    return { rows: [{ account: f.toAccount, debet: amount, kredit: 0 }, { account: from, debet: 0, kredit: amount }], errors };
  }

  if (f.kind === 'owner_in' || f.kind === 'owner_out') {
    if (!isSoleProp) return fail('Egna insättningar och uttag gäller enskild firma.');
    const bank = f.payAccount || DEFAULT_BANK;
    return f.kind === 'owner_in'
      ? { rows: [{ account: bank, debet: amount, kredit: 0 }, { account: OWNER_DEPOSIT, debet: 0, kredit: amount }], errors }
      : { rows: [{ account: OWNER_WITHDRAWAL, debet: amount, kredit: 0 }, { account: bank, debet: 0, kredit: amount }], errors };
  }

  return fail('Välj vad som har hänt.');
}

/** Kontots typ efter BAS-nummer: tillgang, skuld, eget_kapital, intakt, kostnad. */
export function accountKindOf(code) {
  const n = parseInt(code, 10);
  if (Number.isNaN(n)) return null;
  if (n >= 1000 && n < 2000) return 'tillgang';
  if (n >= 2000 && n < 2100) return 'eget_kapital';
  if (n >= 2100 && n < 3000) return 'skuld';
  if (n >= 3000 && n < 4000) return 'intakt';
  if (n >= 8000 && n < 8400) return 'intakt'; // ränte- och andra finansiella intäkter
  if (n >= 4000 && n < 9000) return 'kostnad';
  return null;
}

const isCashCode = (code) => /^19\d\d$/.test(String(code));
const isOutputVat = (code) => ['2611', '2621', '2631', '2612', '2622', '2632', '2614', '2624', '2634'].includes(String(code));

/**
 * En kontorad på vanlig svenska, utan debet och kredit.
 * Returnerar `{ text, amount, increases }` där `increases` säger om kontots
 * saldo går upp eller ner.
 */
export function describeRow(row, accounts) {
  const code = String(row?.account || '');
  const debet = Number(row?.debet) || 0;
  const kredit = Number(row?.kredit) || 0;
  const isDebet = debet > 0;
  const amount = isDebet ? debet : kredit;
  const name = (accounts || []).find(a => a.code === code)?.name || row?.accountName || code;
  const kind = accountKindOf(code);

  let text;
  if (kind === 'tillgang' && isCashCode(code)) {
    text = isDebet ? `Pengar in på ${name}` : `Pengar ut från ${name}`;
  } else if (kind === 'tillgang') {
    text = isDebet ? `${name} ökar` : `${name} minskar`;
  } else if (kind === 'skuld' && isOutputVat(code)) {
    text = isDebet ? `Utgående moms minskar (${name})` : `Moms du ska betala in (${name})`;
  } else if (kind === 'skuld' && code === INPUT_VAT) {
    text = isDebet ? `Moms du får dra av (${name})` : `Avdragen moms minskar (${name})`;
  } else if (kind === 'skuld') {
    text = isDebet ? `Skuld minskar: ${name}` : `Skuld ökar: ${name}`;
  } else if (kind === 'eget_kapital') {
    text = isDebet ? `Eget kapital minskar: ${name}` : `Eget kapital ökar: ${name}`;
  } else if (kind === 'intakt') {
    text = isDebet ? `Intäkt minskar: ${name}` : `Intäkt: ${name}`;
  } else if (kind === 'kostnad') {
    text = isDebet ? `Kostnad: ${name}` : `Kostnad minskar: ${name}`;
  } else {
    text = isDebet ? `${name} ökar` : `${name} minskar`;
  }

  // Kontots saldo ökar när raden ligger på kontots normala sida: debet för
  // tillgångar och kostnader, kredit för skulder, eget kapital och intäkter.
  const increases = (kind === 'tillgang' || kind === 'kostnad' || kind === null) ? isDebet : !isDebet;
  return { text, amount, increases };
}

/** Alla rader i en verifikation som vanliga meningar. */
export function describeVerification(rows, accounts) {
  return (rows || [])
    .filter(r => (Number(r.debet) || 0) > 0 || (Number(r.kredit) || 0) > 0)
    .map(r => ({ account: String(r.account || ''), ...describeRow(r, accounts) }));
}
