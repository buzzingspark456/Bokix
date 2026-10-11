// Daglig sammanfattning av e-postinkorgen (Inställningar → Notiser →
// "E-postinkorgen"). Körs i api/cron/reminders.js kl. 08 svensk tid
// och tar med det som kom in under GÅRDAGEN (svensk tid) och fortfarande
// står som nytt. Ett fast dygn i stället för "senaste 24 timmarna" gör att
// samma mejl aldrig räknas två dagar i rad, utan att något behöver sparas.
// Det som kommer in mellan midnatt och körningen tas med nästa morgon.

const SE_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Svenskt datum (ÅÅÅÅ-MM-DD) för en tidpunkt. */
export function stockholmDate(at) {
  return SE_DATE.format(new Date(at));
}

/** Gårdagens svenska datum, sett från `now`. */
export function yesterdayInStockholm(now = new Date()) {
  return stockholmDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/** Rader från inbox_items → Map "<ägare>|<företag>" → rader från gårdagen. */
export function groupInboxItems(rows, now = new Date()) {
  const day = yesterdayInStockholm(now);
  const groups = new Map();
  for (const r of rows || []) {
    if (r.status !== 'new' || !r.received_at || stockholmDate(r.received_at) !== day) continue;
    const key = `${r.owner_user_id}|${r.company_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

// Avsändare och ämne kommer från vem som helst som mejlar adressen.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Ett mejl med tre bilagor ger tre rader men är ett mejl.
function byEmail(items) {
  const mails = new Map();
  for (const it of items) {
    const key = String(it.email_id || it.id).split(':')[0];
    if (!mails.has(key)) mails.set(key, { from: it.from_name || it.from_email || '', subject: it.subject || '', files: 0 });
    mails.get(key).files += 1;
  }
  return [...mails.values()];
}

const MAX_ROWS = 10;

export function inboxDigestSubject(items) {
  const n = items.length;
  return n === 1 ? '1 nytt kvitto i e-postinkorgen' : `${n} nya kvitton i e-postinkorgen`;
}

export function buildInboxDigestHtml({ company, items, siteUrl }) {
  const mails = byEmail(items);
  const rows = mails.slice(0, MAX_ROWS).map((m) => {
    const files = m.files > 1 ? ` (${m.files} filer)` : '';
    const subject = m.subject ? `: ${esc(m.subject)}` : '';
    return `<li style="margin: 4px 0;">${esc(m.from) || 'Okänd avsändare'}${subject}${files}</li>`;
  }).join('');
  const more = mails.length > MAX_ROWS ? `<p>…och ${mails.length - MAX_ROWS} mejl till.</p>` : '';
  const n = items.length;
  return `
    <p>Hej${company?.name ? ' ' + esc(company.name) : ''},</p>
    <p>I går kom ${n === 1 ? 'ett nytt kvitto' : `${n} nya kvitton`} in till företagets e-postinkorg. ${n === 1 ? 'Det ligger' : 'De ligger'} under Kvitton som Ej hanterade.</p>
    <ul style="padding-left: 20px;">${rows}</ul>
    ${more}
    ${siteUrl ? `<p style="margin: 20px 0;"><a href="${siteUrl}/" style="display:inline-block;padding:12px 26px;background:#0b6329;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Granska i Bokix</a></p>` : ''}
    <p style="color:#6b7280;font-size:13px;">Du får det här mejlet en gång om dagen, bara de dagar något kommer in. Stäng av under Inställningar → Notiser.</p>
    <p>Med vänlig hälsning<br/>Bokix</p>
  `;
}
