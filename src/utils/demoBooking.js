// Bokning av en genomgång (/boka-genomgang). Delas av sidan
// (BookingPage.jsx) och servern (api/contact.js), så att tiderna som visas
// och tiderna som godtas alltid är samma. Alla tider är svensk tid.

export const BOOKING_TOPIC = 'Genomgång';
export const BOOKING_MINUTES = 30;
export const BOOKING_DAYS_AHEAD = 21;
export const BOOKING_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
export const BOOKING_MODES = { video: 'Videomöte', phone: 'Telefonsamtal' };

const TZ = 'Europe/Stockholm';
const SLOT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

// "2026-10-04" i svensk tid.
export function stockholmToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Vardagar från i morgon och BOOKING_DAYS_AHEAD dagar framåt.
export function bookableDays(now = new Date()) {
  const today = stockholmToday(now);
  const days = [];
  for (let i = 1; i <= BOOKING_DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    const wd = weekday(day);
    if (wd !== 0 && wd !== 6) days.push(day);
  }
  return days;
}

export function slotKey(date, time) {
  return `${date} ${time}`;
}

export function isValidSlot(slot, now = new Date()) {
  const m = SLOT_RE.exec(slot || '');
  if (!m) return false;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return bookableDays(now).includes(date) && BOOKING_TIMES.includes(`${m[4]}:${m[5]}`);
}

// Svensk lokal tid → UTC-tidpunkt (tar hänsyn till sommartid).
export function stockholmToUtc(slot) {
  const [, y, mo, d, h, mi] = SLOT_RE.exec(slot).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).map(p => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}

// "tisdag 6 oktober kl. 10:00"
export function formatSlot(slot) {
  const [date, time] = slot.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const label = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${label} kl. ${time}`;
}

// Raden som sparas först i meddelandet i Inkorgen, och som upptagna tider
// läses tillbaka ur (contact_messages har ingen egen kolumn för tiden).
export function bookingMessage({ slot, mode, company, phone, note }) {
  return [
    `Tid: ${slot}`,
    `Form: ${BOOKING_MODES[mode] || BOOKING_MODES.video}`,
    company ? `Företag: ${company}` : null,
    phone ? `Telefon: ${phone}` : null,
    note ? `\n${note}` : null,
  ].filter(Boolean).join('\n');
}

export function slotFromMessage(message) {
  const m = /^Tid: (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(message || '');
  return m ? m[1] : null;
}

function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);
}

export function bookingIcs({ slot, mode, uid, now = new Date() }) {
  const start = stockholmToUtc(slot);
  const end = new Date(start.getTime() + BOOKING_MINUTES * 60000);
  const how = mode === 'phone' ? 'Vi ringer dig på numret du angav.' : 'Vi mejlar en länk till videomötet innan dess.';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bokix//Genomgang//SV',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || `${icsStamp(start)}-genomgang@bokix.se`}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    'SUMMARY:Genomgång av Bokix',
    `DESCRIPTION:${icsText(`${BOOKING_MODES[mode] || BOOKING_MODES.video}, ${BOOKING_MINUTES} minuter. ${how}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
