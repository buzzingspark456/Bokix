import { getDebet, getKredit } from './verificationAmounts';
import { classifyAccount, isBooked } from './reportCalculations';
import { round2 } from './fixedAssets';

/**
 * Förändring av eget kapital — hur det egna kapitalet gick från ingående till
 * utgående saldo under räkenskapsåret: insättningar, uttag, utdelning och
 * årets resultat.
 *
 * Eget kapital = konto 2000–2099 (BAS-klass 20). Saldot räknas kreditsida
 * positivt. Bokslutsverifikationen (`year_end_close`) inom perioden lämnas
 * utanför, så årets resultat visas som en egen rad i stället för att ligga
 * gömt i ett redan omfört saldo. Resultat från tidigare, ännu inte
 * bokslutade år visas som en egen ingående post så att summan alltid går
 * ihop med balansräkningen.
 */

export const isEquityAccount = (code) => /^20[0-9]{2}$/.test(String(code || ''));

export function computeEquityStatement(verifications, accounts, start, end) {
  const byCode = new Map((accounts || []).map(a => [a.code, a]));
  const opening = new Map();
  const movement = new Map();
  let yearResult = 0;
  let priorResult = 0;

  (verifications || []).forEach(v => {
    if (!isBooked(v) || !v.date || v.date > end) return;
    // Omföringen vid årets början räknas till det ingående kapitalet, så
    // årets uttag och insättningar inte syns som minskade av den.
    const inYear = v.date >= start && v.source !== 'year_open_transfer';
    if (v.source === 'year_end_close' && inYear) return;
    (v.rows || []).forEach(r => {
      const net = getKredit(r) - getDebet(r); // kreditsida positiv
      if (isEquityAccount(r.account)) {
        const target = inYear ? movement : opening;
        target.set(r.account, (target.get(r.account) || 0) + net);
        return;
      }
      const type = classifyAccount(byCode.get(r.account) || { code: r.account });
      if (type === 'intakt' || type === 'kostnad') {
        if (inYear) yearResult += net; else priorResult += net;
      }
    });
  });

  const codes = [...new Set([...opening.keys(), ...movement.keys()])].sort();
  const rows = codes
    .map(code => {
      const o = round2(opening.get(code) || 0);
      const m = round2(movement.get(code) || 0);
      return { code, name: byCode.get(code)?.name || 'Okänt konto', opening: o, movement: m, closing: round2(o + m) };
    })
    .filter(r => Math.abs(r.opening) + Math.abs(r.movement) > 0.004);

  const priorAmount = round2(priorResult);
  const yearAmount = round2(yearResult);
  if (priorAmount !== 0) {
    rows.push({ code: '', name: 'Tidigare års resultat (ej bokslutat)', opening: priorAmount, movement: 0, closing: priorAmount, synthetic: true });
  }
  rows.push({ code: '', name: 'Årets resultat', opening: 0, movement: yearAmount, closing: yearAmount, synthetic: true, isResult: true });

  const total = (pick) => round2(rows.reduce((s, r) => s + r[pick], 0));
  return {
    rows,
    yearResult: yearAmount,
    totals: { opening: total('opening'), movement: total('movement'), closing: total('closing') },
  };
}
