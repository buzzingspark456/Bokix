import { dateTimeFormat } from './intlCache.js';
// Bokning av en genomgång (/boka-genomgang). Delas av sidan
// (BookingPage.jsx) och servern (api/contact.js), så att tiderna som visas
// och tiderna som godtas alltid är samma. Alla tider är svensk tid.

export const BOOKING_TOPIC = 'Genomgång';
export const BOOKING_MINUTES = 25;
export const BOOKING_DAYS_AHEAD = 21;
export const BOOKING_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
export const BOOKING_MODES = { video: 'Videomöte', phone: 'Telefonsamtal' };

// Vad genomgången gäller. Länkar hit skickar med ?om=<nyckel> så att
// rubriken passar sidan man kom från, och så att bokningen i Inkorgen och
// mejlet visar vad mötet handlar om. Okänd eller saknad nyckel: 'allmant'.
// Mötena är olika långa; ett långt möte blockerar tiderna det går in i.
export const BOOKING_REASONS = {
  allmant: {
    label: 'Genomgång av Bokix',
    minutes: 25,
    title: 'Boka en genomgång av Bokix',
    lead: 'Boka 25 minuter med någon av oss som bygger Bokix. Vi visar hur Bokix fungerar och svarar på dina frågor.',
  },
  passar: {
    label: 'Passar Bokix mitt företag?',
    minutes: 25,
    title: 'Osäker på om Bokix passar dig?',
    lead: 'Boka 25 minuter med någon av oss som bygger Bokix. Du får raka svar på dina frågor och ser hur Bokix fungerar för just ditt företag.',
  },
  byte: {
    label: 'Hjälp med bytet',
    minutes: 45,
    title: 'Få hjälp att byta till Bokix',
    lead: 'Boka 45 minuter så går vi igenom bytet tillsammans: hur du tar ut SIE4-filen ur ditt gamla program, läser in den i Bokix och ser att allt kom med.',
  },
  bank: {
    label: 'Banken i Bokix',
    minutes: 15,
    title: 'Få hjälp att komma igång med banken',
    lead: 'Boka 15 minuter så visar vi hur du läser in kontoutdraget och hur betalningarna matchas mot dina fakturor och kvitton.',
  },
};

export function bookingReason(key) {
  return Object.hasOwn(BOOKING_REASONS, key) ? key : 'allmant';
}

export function bookingMinutes(reason) {
  return BOOKING_REASONS[bookingReason(reason)].minutes;
}

function slotStart(slot) {
  const [h, m] = slot.slice(11).split(':').map(Number);
  return h * 60 + m;
}

// Är tiden ledig för ett möte på `minutes` minuter? `busy` är bokade möten
// som [{ slot, minutes }]; två möten krockar om de överlappar samma dag.
export function isSlotFree(slot, minutes, busy) {
  const start = slotStart(slot);
  return !busy.some(b => b.slot.slice(0, 10) === slot.slice(0, 10)
    && start < slotStart(b.slot) + b.minutes
    && slotStart(b.slot) < start + minutes);
}

const TZ = 'Europe/Stockholm';
const SLOT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

// "2026-10-04" i svensk tid.
export function stockholmToday(now = new Date()) {
  return dateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
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
    dateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).map(p => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}

// "tisdag 6 oktober kl. 10:00"
export function formatSlot(slot) {
  const [date, time] = slot.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const label = dateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${label} kl. ${time}`;
}

// Raden som sparas först i meddelandet i Inkorgen, och som upptagna tider
// läses tillbaka ur (contact_messages har ingen egen kolumn för tiden).
export function bookingMessage({ slot, mode, reason, company, phone, note }) {
  return [
    `Tid: ${slot}`,
    `Gäller: ${BOOKING_REASONS[bookingReason(reason)].label}`,
    `Längd: ${bookingMinutes(reason)} min`,
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

// Bokningar från före olika längder saknar "Längd:" och var BOOKING_MINUTES.
export function busyFromMessage(message) {
  const slot = slotFromMessage(message);
  if (!slot) return null;
  const m = /^Längd: (\d+) min$/m.exec(message);
  return { slot, minutes: m ? Number(m[1]) : BOOKING_MINUTES };
}

function icsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);
}

export function bookingIcs({ slot, mode, reason, uid, now = new Date() }) {
  const minutes = bookingMinutes(reason);
  const start = stockholmToUtc(slot);
  const end = new Date(start.getTime() + minutes * 60000);
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
    `SUMMARY:${icsText(`Bokix: ${BOOKING_REASONS[bookingReason(reason)].label}`)}`,
    `DESCRIPTION:${icsText(`${BOOKING_MODES[mode] || BOOKING_MODES.video}, ${minutes} minuter. ${how}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
