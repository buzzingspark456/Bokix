// Googles text kommer block för block: en kolumn rubriker och sedan en kolumn
// belopp ("TOTAL / CASH / CHANGE / 33,90 / 50,00 / 16,10"). Då hör inget
// belopp ihop med sin rubrik. Google skickar också var varje rad står på
// bilden (api/_visionLayout.js), så raderna läggs här ihop igen efter höjd,
// vänster till höger, som de står på papperet: "TOTAL 33,90".
//
// `lines` = [{ text, box: { x, y, w, h } }] som andelar av bilden.

/** Raderna i läsordning, eller null när läget saknas. */
export function rowsFromLayout(lines) {
  const items = (lines || []).filter(l => l && l.text && l.box && l.box.h > 0 && l.box.w > 0);
  if (items.length < 3) return null;
  // Ett foto som ligger på sidan: raderna är högre än breda. Då byts axlarna.
  const sideways = items.filter(l => l.box.h > l.box.w * 1.5).length > items.length / 2;
  const geo = items.map(l => {
    const { x, y, w, h } = l.box;
    return sideways
      ? { text: l.text, cy: x + w / 2, cx: 1 - (y + h / 2), size: w }
      : { text: l.text, cy: y + h / 2, cx: x + w / 2, size: h };
  }).sort((a, b) => a.cy - b.cy);

  // En rad tar med det som står inom halva radhöjden från radens mitt.
  const rows = [];
  for (const g of geo) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(g.cy - row.cy) <= Math.min(g.size, row.size) * 0.5) {
      row.items.push(g);
      row.cy = row.items.reduce((s, i) => s + i.cy, 0) / row.items.length;
    } else {
      rows.push({ cy: g.cy, size: g.size, items: [g] });
    }
  }
  return rows.map(r => r.items.sort((a, b) => a.cx - b.cx).map(i => i.text.trim()).join(' ')).join('\n');
}
