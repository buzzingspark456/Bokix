// ── Sökning i kontoplanen ───────────────────────────────────────────────
// EN matchningsregel för alla ställen där ett konto ska hittas: kontofältet
// i formulären (shared/SearchInputs.jsx), kontoplansrutan och
// kontoplansfliken under Bokföring (Verifications.jsx). De hade tidigare
// varsin egen variant, och den strängaste av dem — "kontonumret måste
// BÖRJA med det du skrivit" — gjorde att t.ex. "30" inte hittade 4030 och
// att ett halvt kontonummer sällan gav något alls.
//
// Ren logik utan React-beroenden, i utils/ i stället för i komponenten, av
// samma skäl som resten av räknemotorerna ligger här: då går den att testa
// (vitest kör bara .test.js i node-miljö, se vitest.config.js).

/** Kontoklasserna i BAS. 5 och 6 är samma klass i planen ("Övriga externa
 * rörelseutgifter/kostnader") och slås därför ihop till en rubrik i stället
 * för att visas som två identiskt namngivna grupper. */
export const ACCOUNT_CLASSES = [
  { key: '1', label: 'Tillgångar', test: c => String(c || '').startsWith('1') },
  { key: '2', label: 'Eget kapital och skulder', test: c => String(c || '').startsWith('2') },
  { key: '3', label: 'Rörelseintäkter', test: c => String(c || '').startsWith('3') },
  { key: '4', label: 'Varor och material', test: c => String(c || '').startsWith('4') },
  { key: '5-6', label: 'Övriga externa kostnader', test: c => String(c || '').startsWith('5') || String(c || '').startsWith('6') },
  { key: '7', label: 'Personalkostnader och avskrivningar', test: c => String(c || '').startsWith('7') },
  { key: '8', label: 'Finansiella poster och skatt', test: c => String(c || '').startsWith('8') },
];

/**
 * Matchar ett konto mot en fritextsökning.
 *
 * Siffror matchar var som helst i kontonumret (så "30" hittar både 3001 och
 * 4030), text matchar namnet. Flera ord måste alla finnas, i valfri ordning
 * — "kontor material" hittar "Kontorsmaterial" lika bra som "material
 * kontor". Tom sökning matchar allt, så ett tomt fält visar hela planen i
 * stället för ingenting.
 *
 * @param {{code: string, name: string}} account
 * @param {string} query
 */
export function accountMatches(account, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  if (!account) return false;
  const code = String(account.code || '').toLowerCase();
  const name = String(account.name || '').toLowerCase();
  return q.split(/\s+/).every(token => code.includes(token) || name.includes(token));
}

/** Kontoplanen grupperad per BAS-klass, med tomma grupper bortsorterade.
 * Konton utanför 1–8 hamnar sist under `null`-klassen i stället för att
 * tyst försvinna ur listan. */
export function groupAccountsByClass(accounts = []) {
  const groups = ACCOUNT_CLASSES
    .map(cls => ({ key: cls.key, label: cls.label, rows: accounts.filter(a => cls.test(a.code)) }))
    .filter(g => g.rows.length > 0);
  const rest = accounts.filter(a => !ACCOUNT_CLASSES.some(c => c.test(a.code)));
  return rest.length > 0 ? [...groups, { key: 'other', label: 'Övriga konton', rows: rest }] : groups;
}
