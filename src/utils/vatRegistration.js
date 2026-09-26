/**
 * Företag som inte är momsregistrerade (company.vatRegistered === false).
 *
 * De tar inte ut moms på sin försäljning och får inte dra av ingående moms.
 * Momsen på ett inköp är då en del av kostnaden. null (aldrig besvarat,
 * äldre företag) behandlas som momsregistrerat, precis som appen alltid gjort.
 */

export function isVatExempt(company) {
  return company?.vatRegistered === false;
}

const num = (v) => Number(String(v ?? 0).replace(',', '.')) || 0;
const round2 = (n) => Math.round(n * 100) / 100;
const isInputVat = (code) => /^264\d$/.test(String(code)) && String(code) !== '2645';
const isOutputVat = (code) => /^26[1-3][1-3]$/.test(String(code));

/**
 * Tar bort momsraderna ur en automatisk bokning och lägger beloppen där de
 * hör hemma för ett företag utan momsregistrering: ingående moms på den
 * största kostnadsraden i debet, utgående moms på den största intäktsraden
 * i kredit. Hittas ingen sådan rad lämnas momsraden kvar hellre än att
 * bokningen går sönder. Omvänd skattskyldighet (2645/2614 m.fl.) rörs inte.
 * Raderna behåller sitt format (tal eller strängar med två decimaler).
 */
export function stripVatRows(rows) {
  if (!Array.isArray(rows)) return rows;
  const out = rows.map(r => ({ ...r }));
  const asString = out.some(r => typeof r.debet === 'string' || typeof r.kredit === 'string');
  const fmt = (n) => (asString ? (n ? round2(n).toFixed(2) : '') : round2(n));

  const largest = (pred, side) => out
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => pred(String(r.account)) && num(r[side]) > 0)
    .sort((a, b) => num(b.r[side]) - num(a.r[side]))[0];

  const isCost = (code) => /^[4-7]/.test(code) || /^1[0-2]/.test(code) || /^14/.test(code);
  const isRevenue = (code) => /^3/.test(code);

  const remove = new Set();
  out.forEach((r, i) => {
    const code = String(r.account);
    if (isInputVat(code)) {
      const amount = num(r.debet) - num(r.kredit);
      const target = largest(isCost, 'debet');
      if (!target || !amount) return;
      out[target.i].debet = fmt(num(out[target.i].debet) + amount);
      remove.add(i);
    } else if (isOutputVat(code)) {
      const amount = num(r.kredit) - num(r.debet);
      const target = largest(isRevenue, 'kredit');
      if (!target || !amount) return;
      out[target.i].kredit = fmt(num(out[target.i].kredit) + amount);
      remove.add(i);
    }
  });
  return out.filter((_, i) => !remove.has(i));
}
