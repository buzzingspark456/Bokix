// Googles text kommer block för block: en kolumn rubriker och sedan en kolumn
// belopp ("TOTAL / CASH / CHANGE / 33,90 / 50,00 / 16,10"). Då hör inget
// belopp ihop med sin rubrik. Google skickar också var varje rad står på
// bilden (api/_visionLayout.js), så raderna läggs här ihop igen efter höjd,
// vänster till höger, som de står på papperet: "TOTAL 33,90".
//
// `lines` = [{ text, box: { x, y, w, h } }] som andelar av bilden.

// Ett mobilfoto är nästan alltid lite snett: beloppen till höger står lägre
// (eller högre) än rubriken till vänster. Lutningen prövas i små steg, och den
// som lägger flest delar på samma rad vinner.
const SLOPES = Array.from({ length: 61 }, (_, i) => (i - 30) * 0.005);

function groupRows(geo, slope) {
  const items = geo.map(g => ({ ...g, cy: g.cy - slope * g.cx })).sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const g of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(g.cy - row.cy) <= Math.min(g.size, row.size) * 0.5) {
      row.items.push(g);
      row.cy = row.items.reduce((s, i) => s + i.cy, 0) / row.items.length;
    } else {
      rows.push({ cy: g.cy, size: g.size, items: [g] });
    }
  }
  return rows;
}

/**
 * Med textens vinkel (api/_visionLayout.js) vrids alla lägen till textens egen
 * riktning: ett iPhone-foto som ligger på sidan, står på huvudet eller är snett
 * blir rader som på papperet. Vinkeln är medelriktningen av alla rader.
 */
function rowsByAngle(items) {
  const withAngle = items.filter(l => typeof l.angle === 'number');
  if (withAngle.length < 3) return null;
  let vx = 0; let vy = 0;
  withAngle.forEach(l => { const w = l.text.length; vx += Math.cos(l.angle) * w; vy += Math.sin(l.angle) * w; });
  const theta = Math.atan2(vy, vx);
  const cos = Math.cos(theta); const sin = Math.sin(theta);
  const aspect = withAngle[0].aspect || 1;
  const geo = items.map(l => {
    const { x, y, w, h } = l.box;
    const X = (x + w / 2) * aspect; const Y = y + h / 2;
    // Radhöjden vinkelrätt mot texten.
    const size = Math.abs(sin) > Math.abs(cos) ? w * aspect : h;
    return { text: l.text, cx: X * cos + Y * sin, cy: -X * sin + Y * cos, size };
  });
  return groupRows(geo, 0).map(r => r.items.sort((a, b) => a.cx - b.cx).map(i => i.text.trim()).join(' ')).join('\n');
}

/** Raderna i läsordning, eller null när läget saknas. */
export function rowsFromLayout(lines) {
  const items = (lines || []).filter(l => l && l.text && l.box && l.box.h > 0 && l.box.w > 0);
  if (items.length < 3) return null;
  const byAngle = rowsByAngle(items);
  if (byAngle) return byAngle;
  // Ett foto som ligger på sidan: raderna är högre än breda. Då byts axlarna.
  const sideways = items.filter(l => l.box.h > l.box.w * 1.5).length > items.length / 2;
  const geo = items.map(l => {
    const { x, y, w, h } = l.box;
    return sideways
      ? { text: l.text, cy: x + w / 2, cx: 1 - (y + h / 2), size: w }
      : { text: l.text, cy: y + h / 2, cx: x + w / 2, size: h };
  });
  // Google ger varje rads lutning (api/_visionLayout.js): medianen är fotots.
  const measured = sideways ? [] : items.map(l => l.slope).filter(k => typeof k === 'number' && Math.abs(k) < 0.3).sort((a, b) => a - b);
  if (measured.length >= 3) {
    const slope = measured[Math.floor(measured.length / 2)];
    return groupRows(geo, slope).map(r => r.items.sort((a, b) => a.cx - b.cx).map(i => i.text.trim()).join(' ')).join('\n');
  }
  let best = null;
  for (const slope of SLOPES) {
    const rows = groupRows(geo, slope);
    if (!best || rows.length < best.rows.length || (rows.length === best.rows.length && Math.abs(slope) < Math.abs(best.slope))) {
      best = { slope, rows };
    }
  }
  return best.rows.map(r => r.items.sort((a, b) => a.cx - b.cx).map(i => i.text.trim()).join(' ')).join('\n');
}
