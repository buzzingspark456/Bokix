import { getDebet, getKredit } from './verificationAmounts';
import { isBooked } from './reportCalculations';

// Ingående balanser från en SIE4-import får inte räknas två gånger.
//
// buildOpeningVerification (sieImport.js) bokar filens #IB som en verifikation
// på räkenskapsårets första dag. Saldona i Bokix räknas ur ALL bokförd historik
// (computeLedger, computeBalanceSheet), så om föregående års verifikationer
// också finns i företaget, t.ex. för att både 2025 och 2026 importerats, bär
// de redan saldot in i det nya året. Att då dessutom boka hela #IB dubblade
// varje balanskonto (kund: "Övriga bankkonton visar dubbelt", 2026-10-09).
//
// Rättelsen: varje importerad ingående balans bokar bara skillnaden mellan
// filens #IB och det saldo som historiken före dagen redan ger. Utan historik
// är skillnaden hela #IB, som förut. Stämmer historiken exakt försvinner
// verifikationen. Körs efter varje SIE-import, oavsett i vilken ordning åren
// läses in, och kan köras på redan importerad data (Inställningar → Avancerat).
//
// Har föregående år inte bokslutats i Bokix ligger förra årets resultat kvar
// på resultatkontona, medan filens #IB redan har det i eget kapital. Den
// skillnaden lämnas på resultatkontot (equityAccount, 2099/2019) tills året
// bokslutas här, precis som för ett år som bokförts i Bokix från början, så
// att verifikationen alltid balanserar.

export const SIE_OPENING_DESCRIPTION = 'Ingående balanser (SIE4-import)';

const EPS = 0.005;
const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;
const isBalanceAccount = (code) => /^[12]/.test(String(code || ''));

/** En importerad ingående balans-verifikation (ny eller från före rättelsen). */
export function isSieOpening(v) {
  if (!v) return false;
  if (v.sieOpening === true) return true;
  return String(v.source || '').startsWith('sie_import') && v.description === SIE_OPENING_DESCRIPTION;
}

function netByAccount(rows) {
  const out = new Map();
  for (const r of rows || []) {
    const net = (getDebet(r) || 0) - (getKredit(r) || 0);
    if (!net) continue;
    out.set(r.account, (out.get(r.account) || 0) + net);
  }
  return out;
}

function rowFor(account, amount, accountName) {
  const abs = Math.abs(amount).toFixed(2);
  return amount > 0
    ? { account, accountName, debet: abs, kredit: '0' }
    : { account, accountName, debet: '0', kredit: abs };
}

function sameRows(a, b) {
  const na = netByAccount(a);
  const nb = netByAccount(b);
  const codes = new Set([...na.keys(), ...nb.keys()]);
  for (const c of codes) if (Math.abs(cents(na.get(c)) - cents(nb.get(c))) > EPS) return false;
  return true;
}

/**
 * Vad som behöver ändras för att varje importerad ingående balans bara ska
 * boka skillnaden mot historiken. Ändrar ingenting själv.
 *
 * `target` är filens fullständiga #IB: `sieOpeningTarget` om den sparats,
 * annars verifikationens rader (de bokades som hela #IB före rättelsen).
 *
 * Returnerar { updates: [{ id, rows, sieOpeningTarget }], removals: [id],
 * needsRepair }, där needsRepair säger om något saldo faktiskt ändras.
 */
export function reconcileSieOpenings(verifications, { equityAccount = '2099', accountsByCode } = {}) {
  const list = (verifications || []).filter(v => isBooked(v) && v.date);
  const openings = list.filter(isSieOpening).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (openings.length === 0) return { updates: [], removals: [] };

  // Arbetskopia: en tidigare ingående balans som ändras här påverkar
  // historiken för en senare.
  const currentRows = new Map(openings.map(v => [v.id, v.rows || []]));
  const removed = new Set();
  const updates = [];
  const removals = [];
  let repairs = 0;

  for (const opening of openings) {
    const target = opening.sieOpeningTarget || opening.rows || [];
    const nameOf = new Map(target.map(r => [r.account, r.accountName]));

    const history = new Map();
    for (const v of list) {
      if (v.id === opening.id || removed.has(v.id) || !(v.date < opening.date)) continue;
      const rows = currentRows.has(v.id) ? currentRows.get(v.id) : v.rows;
      for (const [code, net] of netByAccount(rows)) {
        if (isBalanceAccount(code)) history.set(code, (history.get(code) || 0) + net);
      }
    }

    const diff = new Map();
    const targetNet = netByAccount(target);
    for (const code of new Set([...targetNet.keys(), ...history.keys()])) {
      const d = cents((targetNet.get(code) || 0) - (history.get(code) || 0));
      if (Math.abs(d) > EPS) diff.set(code, d);
    }
    // Förra årets ej bokslutade resultat, se kommentaren överst.
    const residual = cents([...diff.values()].reduce((s, d) => s + d, 0));
    if (Math.abs(residual) > EPS) {
      const d = cents((diff.get(equityAccount) || 0) - residual);
      if (Math.abs(d) > EPS) diff.set(equityAccount, d); else diff.delete(equityAccount);
    }

    const rows = [...diff.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([code, amount]) => rowFor(code, amount, nameOf.get(code) || accountsByCode?.get?.(code)?.name || code));

    if (rows.length === 0) {
      removed.add(opening.id);
      removals.push(opening.id);
      continue;
    }
    const changed = !sameRows(rows, opening.rows);
    currentRows.set(opening.id, changed ? rows : opening.rows);
    if (changed) {
      updates.push({ id: opening.id, rows, sieOpeningTarget: target });
      repairs += 1;
    } else if (!opening.sieOpeningTarget) {
      // Raderna stämmer redan; spara bara #IB så att en senare körning vet
      // vad den ska räkna mot.
      updates.push({ id: opening.id, rows: opening.rows, sieOpeningTarget: target });
    }
  }

  return { updates, removals, needsRepair: repairs > 0 || removals.length > 0 };
}

/** Tillämpar reconcileSieOpenings på en verifikationslista. */
export function applySieOpeningReconcile(verifications, result) {
  if (!result || (result.updates.length === 0 && result.removals.length === 0)) return verifications;
  const byId = new Map(result.updates.map(u => [u.id, u]));
  const removals = new Set(result.removals);
  return verifications
    .filter(v => !removals.has(v.id))
    .map(v => {
      const u = byId.get(v.id);
      return u ? { ...v, rows: u.rows, sieOpening: true, sieOpeningTarget: u.sieOpeningTarget } : v;
    });
}
