/** "2026-10-11" → "2026-10-11T08:00:00+02:00". Google varnar ("tidszon
 * saknas") för datum utan tid i uploadDate/datePublished/dateModified.
 * Klockan 08 svensk tid; sommartid sista söndagen i mars till sista
 * söndagen i oktober. Värden som redan har tid lämnas orörda. */
export function schemaDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [y, m, d] = date.split('-').map(Number);
  const lastSunday = month => { const last = new Date(Date.UTC(y, month, 0)); return last.getUTCDate() - last.getUTCDay(); };
  const summer = (m > 3 && m < 10) || (m === 3 && d >= lastSunday(3)) || (m === 10 && d < lastSunday(10));
  return `${date}T08:00:00${summer ? '+02:00' : '+01:00'}`;
}
