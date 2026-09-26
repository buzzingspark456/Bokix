import { getDebet, getKredit } from './verificationAmounts';
import { round2 } from './fixedAssets';

/**
 * Delägare i handels- och kommanditbolag.
 *
 * Ett HB/KB betalar ingen egen bolagsskatt: resultatet fördelas på
 * delägarna, som var och en deklarerar sin andel (N3A, eller K10 för
 * fåmansföretagare). Varje delägare har en egen kontoserie i BAS:
 *
 *   delägare 1: 2010–2019   delägare 2: 2020–2029   delägare 3: 2030–2039   delägare 4: 2040–2049
 *
 * med samma sista siffra i varje serie: 0 eget kapital, 1 egna varuuttag,
 * 3 övriga egna uttag, 7 årets kapitaltillskott, 8 övriga egna insättningar,
 * 9 årets resultat. Kontoplanen har serierna för fyra delägare, så fler
 * än fyra stöds inte här.
 *
 * Resultatfördelningen bokförs efter bokslutet: bokslutet flyttar årets
 * resultat till 2099, fördelningen flyttar det vidare från 2099 till varje
 * delägares resultatkonto (20N9) i förhållande till andelen.
 */

export const MAX_PARTNERS = 4;

export function partnerAccounts(index) {
  const base = 2010 + index * 10;
  const s = (n) => String(base + n);
  return { equity: s(0), varuuttag: s(1), avrakning: s(2), uttag: s(3), tillskott: s(7), insattning: s(8), resultat: s(9) };
}

/** Kontroll av delägarlistan. Returnerar en lista fel; tom lista = ok. */
export function validatePartners(partners) {
  const errors = [];
  const list = partners || [];
  if (list.length === 0) errors.push('Lägg till minst en delägare.');
  if (list.length > MAX_PARTNERS) errors.push(`Högst ${MAX_PARTNERS} delägare stöds.`);
  if (list.some(p => !String(p.name || '').trim())) errors.push('Alla delägare behöver ett namn.');
  const total = round2(list.reduce((s, p) => s + (Number(p.sharePct) || 0), 0));
  if (list.length > 0 && Math.abs(total - 100) > 0.005) errors.push(`Andelarna summerar till ${total} %, de ska bli 100 %.`);
  return errors;
}

/** Fördelar ett belopp på delägarna efter andel, till hela ören. Den sista
 * delägaren får resten, så summan alltid blir exakt beloppet. */
export function allocateResult(result, partners) {
  const list = partners || [];
  let assigned = 0;
  return list.map((p, i) => {
    const amount = i === list.length - 1
      ? round2(result - assigned)
      : round2(result * (Number(p.sharePct) || 0) / 100);
    assigned = round2(assigned + amount);
    return { partnerId: p.id, amount };
  });
}

/** Bokslutets resultat (2099) fördelas på delägarnas resultatkonton. */
export function buildAllocationVerification(year, result, partners, date = `${year}-12-31`) {
  const shares = allocateResult(result, partners);
  const rows = [];
  if (result >= 0) rows.push({ account: '2099', debet: round2(result), kredit: 0 });
  else rows.push({ account: '2099', debet: 0, kredit: round2(-result) });
  shares.forEach((s, i) => {
    if (s.amount === 0) return;
    const account = partnerAccounts(i).resultat;
    if (s.amount > 0) rows.push({ account, debet: 0, kredit: s.amount });
    else rows.push({ account, debet: -s.amount, kredit: 0 });
  });
  return {
    date,
    description: `Resultatfördelning ${year}`,
    source: 'partner_allocation',
    sourceId: `partner_allocation_${year}`,
    rows,
  };
}

export function isAllocationBooked(verifications, year) {
  return (verifications || []).some(v => v.sourceId === `partner_allocation_${year}` && (v.status || 'booked') !== 'draft');
}

/**
 * Underlag per delägare för ett räkenskapsår: andel av resultatet, samt
 * insättningar och uttag under året (bokförda på delägarens egna konton).
 * Bokslutsverifikationen räknas inte — resultatet kommer från `yearResult`.
 */
export function computePartnerStatement(verifications, partners, start, end, yearResult) {
  const shares = allocateResult(yearResult, partners);
  return (partners || []).map((partner, i) => {
    const acc = partnerAccounts(i);
    let insattningar = 0;
    let uttag = 0;
    (verifications || []).forEach(v => {
      if ((v.status || 'booked') === 'draft' || !v.date || v.date < start || v.date > end) return;
      (v.rows || []).forEach(r => {
        const net = getKredit(r) - getDebet(r);
        if (r.account === acc.insattning || r.account === acc.tillskott) insattningar += net;
        else if (r.account === acc.uttag || r.account === acc.varuuttag || r.account === acc.avrakning) uttag -= net;
      });
    });
    return {
      partner,
      accounts: acc,
      share: shares[i].amount,
      insattningar: round2(insattningar),
      uttag: round2(uttag),
    };
  });
}
