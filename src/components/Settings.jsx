import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, CreditCard, Shield, Check, Download, Upload,
  Trash2, Mail, Laptop, Lock, KeyRound, Image as ImageIcon,
  Palette, Hash, Calendar, X, ZoomIn, ZoomOut, Maximize2, ExternalLink, Sun, Moon,
  UserRound, Users, Cog, ArrowLeft, ArrowRight,
  Sparkles, CheckCircle2, HelpCircle, LogOut, Search, ChevronRight, Fingerprint, CalendarFilled, MailFilled, BankFilled, Inbox, Copy,
} from './icons';
import { supabase } from '../supabaseClient';
import { passkeysAvailable, isPasskeyCancel, appLockEnabledFor, setAppLock, rememberPasskeyOnDevice } from '../utils/sessionPolicy';
import { sendInvoiceEmail } from '../emailApi';
import { cancelStripeSubscription, reactivateStripeSubscription, openBillingPortal, getSubscriptionInvoices } from '../stripeApi';
import { BRAND } from '../utils/brandColors';
import InvoiceDocument, { INVOICE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import ListTable from './shared/ListTable';
import ListPageHeader from './shared/ListPageHeader';
import { sendReauthCode, verifyReauthCode, changePassword } from '../utils/reauthVerification';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';
import { reconcileSieOpenings } from '../utils/sieOpeningReconcile';
import { sieImportBatches } from '../utils/sieImportBatches';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { resultAccountFor } from '../utils/yearEnd';
import { getGreeting } from '../utils/greeting';
import { confirmDialog } from './shared/ConfirmDialog';
import { newCalendarKey, calendarFeedUrl, calendarChoices } from '../utils/calendarFeed';
import { downloadSie4 } from '../utils/sieExport';
import { planFromId, PLAN_TIERS } from '../utils/plans';
import { ACCESS_PAGES, ACCESS_LEVELS, defaultPageAccess, accessForPage, canWriteField, ACCOUNTANT_PRESET, accountantPageAccess } from '../utils/pageAccess';
import { isUfCompany, ufSettingsSections, ufFreePeriod, UF_FREE_MONTHS } from '../utils/ufMode';
import { closeUfYear } from '../utils/ufClose';
import SieImportModal from './SieImportModal';
import Turnstile from './Turnstile';
import SkattekontoImportModal from './SkattekontoImportModal';
import SieAttachmentsModal from './SieAttachmentsModal';
import { ProgramLogo } from './shared/BrandLogos';
import { MIGRATION_SOURCES } from '../utils/migrationSources';
import { VERIFICATION_SERIES, getMaxUsedNumber } from '../utils/verificationNumbering';
import { DATE_FORMATS, getDateFormatPreference, setDateFormatPreference } from '../utils/dateFormat';
import { logAuditEvent } from '../utils/auditLog';
import { detectDevice } from '../utils/deviceInfo';
import { t as tr, useTranslation, getLanguage, dateLocale } from '../i18n';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

// Visas istället för att faktiskt anropa Supabase när `readOnly` (Sida
// landningssidans demo, se DemoWorkspace.jsx) — samma text överallt i den
// här filen, en enda plats att ändra den på.
const DEMO_BLOCKED_MSG = tr('ui.det_har_ar_bara_en_demo_skapa_ett_gratis_konto_f');

// Stripes eget ordmärke ("stripe"-texten, inte S-monogrammet) — vektorpaths
// hämtade rakt av från Stripes egen Wikimedia Commons-fil (deras officiella
// logga för "stripe" solo, färgen #635BFF är deras dokumenterade "blurple").
// Används bara här, bredvid Anslut Stripe-knappen, så det syns TYDLIGT
// vilken tjänst kortbetalningar går via — inte en generisk ikon.
function StripeLogo({ height = 16 }) {
  const width = (height * 360.02) / 149.84;
  return (
    <svg viewBox="54 36 360.02 149.84" width={width} height={height} xmlns="http://www.w3.org/2000/svg" aria-label={tr('ui.stripe')}>
      <path fill="#635BFF" fillRule="evenodd" clipRule="evenodd" d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z" />
      <path fill="#635BFF" fillRule="evenodd" clipRule="evenodd" d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z" />
      <polygon fill="#635BFF" fillRule="evenodd" clipRule="evenodd" points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3" />
      <rect x="223.8" y="69.3" fill="#635BFF" fillRule="evenodd" clipRule="evenodd" width="25.1" height="87.5" />
      <path fill="#635BFF" fillRule="evenodd" clipRule="evenodd" d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z" />
      <path fill="#635BFF" fillRule="evenodd" clipRule="evenodd" d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z" />
      <path fill="#635BFF" fillRule="evenodd" clipRule="evenodd" d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z" />
    </svg>
  );
}

// Knapp i Stripes egen stil för "Anslut X"-flöden (vit botten, deras logga
// + egen call-to-action-text) istället för en generisk enfärgad knapp —
// samma mönster som t.ex. "Logga in med Google" använder.
// Alla knappar på inställningssidan utgår från samma form (kundönskemål
// 2026-09-27: "knapparna ska se likadana ut överallt"): samma höjd, hörn,
// textstorlek och vikt. Ansluta/skapa = vit med kant, spara = grön,
// radera = röd.
const BTN = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
  height: '36px', padding: '0 16px', boxSizing: 'border-box', borderRadius: '9px',
  fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600, lineHeight: 1,
  whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer', border: '1px solid transparent',
};
const BTN_OUTLINE = { ...BTN, background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' };
const btnStripeConnect = BTN_OUTLINE;

// Zettles eget kombinerade ordmärke ("Zettle" + "by PayPal") — en riktig
// rasterbild (public/zettle-logo.png, hämtad rakt av från Zettles egen
// Wikimedia Commons-fil — public domain, "consists only of simple
// geometric shapes or text", se filens licenssida), INTE ett handritat
// SVG-försök. Ett tidigare försök att bygga om loggan i vektorform (från
// en äldre, 2018-daterad "iZettle"-fil med annat, kantigare typsnitt) såg
// sämre ut än originalet — kundfeedback och en skickad skärmdump av den
// riktiga, nuvarande loggan visade tydligt att typsnittet inte matchade.
// --zettle-logo-filter (index.css) gör hela märket vitt i mörkt läge
// (`brightness(0) invert(1)`) istället för fill på enskilda paths, eftersom
// en rasterbild inte har separata, färgbara delar.
// Kopplingskorten har vit logoruta även i mörkt läge, så den vanliga blå
// loggan används alltid här (den mörka varianten, vit text, är för
// marknadssajtens mörka rutor).
function ZettleLogo({ height = 18 }) {
  const width = height * (320 / 144);
  return (
    <img
      src="/zettle-blue.png" alt={tr('ui.zettle_by_paypal')} height={height} width={width}
      style={{ height, width, objectFit: 'contain' }}
    />
  );
}

// Gmails eget ikon (2020-varianten, den röda kuvertformen) — kundönskemål,
// samma "riktig rasterbild, inte handritad"-princip som ZettleLogo ovan:
// public/gmail-icon.png, hämtad rakt av från Wikimedia Commons (fri fil,
// se dess licenssida). Används bara i integrationskatalogens Gmail-bricka
// (den som representerar TJÄNSTEN) — "Fortsätt med Google"-knappen inuti
// panelen behåller sin egen GoogleGlyph (den flerfärgade G:n), eftersom
// den knappen bokstavligen är ett Google-inloggningsflöde, inte "öppna
// Gmail", och Googles egna riktlinjer för såna knappar pekar på just G:n.
// Fullfärgad ikon, inget mörkläges-filter behövs (till skillnad från
// Zettles svarta ordmärke ovan).
function GmailLogo({ height = 18 }) {
  const width = height * (3840 / 2880);
  return (
    <img
      src="/gmail-icon.png" alt={tr('ui.gmail')} height={height} width={width}
      style={{ height, width, objectFit: 'contain' }}
    />
  );
}

// ── Flikarna, i den ordning de visas överst på sidan ────────────────────
// Kundfeedback: "jag gillar inte att inställningarna ligger i sidan i
// stället för i toppen — och saker ligger på fel ställe: utseendet ligger
// under Data och inställningar medan hälsningen på startsidan ligger under
// Min profil."
//
// Två ändringar därför: navigeringen är samma flikrad som ALLA andra sidor
// i appen använder (ListPageHeader `tabs`), och grupperingen följer nu vad
// man vill GÖRA, inte var koden råkade ligga.
//
// Kundönskemål (skärmdump av en referensbild, åtta kort exakt i den här
// ordningen och med de här namnen): sektionerna döptes om och sorterades
// om för att matcha den bilden rakt av, i stället för de tidigare "Min
// profil"/"Din data"-flikarna:
//   · Företag       — företagets egna uppgifter, bank, räkenskapsår, logotyp
//   · Fakturamallar — hur mina fakturor ser ut
//   · Integrationer — Stripe, Zettle och egen avsändardomän för mejl
//   · Prenumeration — vad Bokix kostar mig
//   · Användare     — vem mer som kommer åt företaget
//   · Utseende      — hur appen ser ut för mig (tema, hälsning, sidomeny)
//   · Notiser       — automatiska påminnelser (låg tidigare under Företag)
//   · Säkerhet      — namn, e-post, lösenord, 2FA, sessioner (hette Min
//                      profil) — referensbilden hade inget eget "profil"-
//                      kort, så profiluppgifterna fick följa med hit i
//                      stället för att försvinna från sidan helt.
// Uppföljning: kunden skickade en NY referensbild — tio kort, egna namn.
// Momsperiod, Kontoplan, export/import och radera-företagsdata flyttade ut
// ur Företag (som blev mindre, ren identitet) in i två nya flikar (System,
// Avancerat) som referensbilden nu har egna kort för. "Fakturamallar" döptes
// om till "Fakturor" och tog med sig alla fakturainställningar (nummer,
// datum, förfallodagar, påminnelser, betalningsuppgifter, e-post) på en
// gång, inte bara mallen. "Användare" blev "Användare & behörigheter".
const SETTINGS_TABS = [
  { id: 'profile', label: tr('ui.profil') },
  { id: 'company', label: tr('ui.foretag') },
  { id: 'invoice', label: tr('ui.fakturor') },
  { id: 'integrations', label: tr('ui.integrationer') },
  { id: 'system', label: tr('ui.system') },
  { id: 'users', label: tr('ui.anvandare_behorigheter') },
  { id: 'subscription', label: tr('ui.prenumeration') },
  { id: 'appearance', label: tr('ui.utseende') },
  { id: 'notifications', label: tr('ui.notiser') },
  { id: 'security', label: tr('ui.sakerhet') },
  { id: 'advanced', label: tr('ui.avancerat') },
];

// ── Inställningarnas ingång ──────────────────────────────────────────────
// Kundfeedback, upprepad: sidan öppnade alltid i "Min profil" och kastade
// därmed in en som skulle till något helt annat mitt i ett formulär. Nu
// öppnar den i stället på en översikt där man VÄLJER område — och varje
// område beskrivs med en rad, så man slipper gissa vad "Din data" innehåller.
//
// Beskrivningen visas under namnet i telefonens meny och används av sökfältet.
const SECTION_META = {
  profile: { desc: tr('ui.namn_bild_och_kontaktuppgifter') },
  company: { desc: tr('ui.namn_organisationsnummer_adress_och_bankuppgifte') },
  invoice: { desc: tr('ui.nummer_datum_paminnelser_mall_och_e_post') },
  integrations: { desc: tr('ui.stripe_zettle_och_egen_avsandardoman_for_mejl') },
  system: { desc: tr('ui.moms_kontoplan_verifikationsserier_valuta_och_ex') },
  users: { desc: tr('ui.lagg_till_anvandare_roller_och_behorigheter') },
  subscription: { desc: tr('ui.plan_betalningar_och_kvitton') },
  appearance: { desc: tr('ui.tema_fargtema_layout_och_sprak') },
  notifications: { desc: tr('ui.kvitton_betalningar_paminnelser_och_deklaratione') },
  security: { desc: tr('ui.losenord_tvastegsverifiering_och_inloggningshist') },
  advanced: { desc: tr('ui.importera_exportera_eller_radera_din_bokforing') },
};

// Samma grupper i datorns vänstermeny (SettingsNav) och telefonens lista.
const HUB_GROUPS = [
  { title: tr('ui.sg_du'), ids: ['profile', 'security', 'appearance', 'notifications'] },
  { title: tr('ui.sg_foretaget'), ids: ['company', 'users', 'subscription'] },
  { title: tr('ui.sg_bokforing'), ids: ['system', 'advanced'] },
  { title: tr('ui.sg_forsaljning'), ids: ['invoice', 'integrations'] },
];

// Vänstermenyn på dator, som Accounted: grupprubriker, en rad per avsnitt,
// sökfält överst. Inga ikoner, den valda raden får en dämpad bakgrund.
function SettingsNav({ sections, activeId, onPick }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (s) => !q || s.label.toLowerCase().includes(q) || (SECTION_META[s.id]?.desc || '').toLowerCase().includes(q);
  const groups = HUB_GROUPS
    .map(g => ({ ...g, items: g.ids.map(id => sections.find(s => s.id === id)).filter(s => s && matches(s)) }))
    .filter(g => g.items.length > 0);
  return (
    <nav className="settings-nav" aria-label={tr('ui.installningar')}>
      <div className="settings-nav-search">
        <Search size={15} />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('ui.sok_installning')} aria-label={tr('ui.sok_installning')} />
      </div>
      {groups.map(group => (
        <div key={group.title} className="settings-nav-group">
          <div className="settings-nav-group-title">{group.title}</div>
          {group.items.map(s => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item${s.id === activeId ? ' is-active' : ''}`}
              aria-current={s.id === activeId ? 'page' : undefined}
              onClick={() => onPick(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ))}
      {groups.length === 0 && <div className="settings-nav-empty">{tr('ui.inga_traffar')}</div>}
    </nav>
  );
}

/** Telefonens ingång till inställningarna: samma meny som datorns
 * vänstermeny (SettingsNav), med sökfält, samma grupper och inga ikoner,
 * men med stora rader och en rad som säger vad avsnittet innehåller. */
function SettingsHub({ sections, onPick }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (s) => !q || s.label.toLowerCase().includes(q) || (SECTION_META[s.id]?.desc || '').toLowerCase().includes(q);
  const placed = new Set(HUB_GROUPS.flatMap(g => g.ids));
  const groups = HUB_GROUPS
    .map(g => ({ ...g, items: g.ids.map(id => sections.find(s => s.id === id)).filter(Boolean) }));
  const rest = sections.filter(s => !placed.has(s.id));
  if (rest.length > 0) groups.push({ title: tr('ui.ovrigt'), ids: [], items: rest });
  const shown = groups.map(g => ({ ...g, items: g.items.filter(matches) })).filter(g => g.items.length > 0);
  return (
    <div className="settings-mnav">
      <label className="settings-mnav-search">
        <Search size={17} />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('ui.sok_installning')} aria-label={tr('ui.sok_installning')} />
      </label>
      {shown.map(group => (
        <div key={group.title}>
          <div className="settings-mnav-group-title">{group.title}</div>
          <div className="settings-mnav-list">
            {group.items.map(section => (
              <button key={section.id} type="button" className="settings-mnav-row" onClick={() => onPick(section.id)}>
                <span className="settings-mnav-text">
                  <span className="settings-mnav-label">{section.label}</span>
                  {SECTION_META[section.id]?.desc && <span className="settings-mnav-desc">{SECTION_META[section.id].desc}</span>}
                </span>
                <ChevronRight size={18} className="settings-mnav-chev" />
              </button>
            ))}
          </div>
        </div>
      ))}
      {shown.length === 0 && <div className="settings-mnav-empty">{tr('ui.inga_traffar')}</div>}
    </div>
  );
}

// ── Delade stilar ──
// Bugkritiskt (Sida 15): varje sektion är ett fullbrett, ljust kort — inte
// smala vita kort med stor luft runt om.
// Kundönskemål ("mycket space, gör mindre — ska se ut som en bra
// settings-sida"): kortets egen padding/marginBottom trimmade ett steg
// nedåt (16→13px, 12→9px) — samma neddragning som IdentityCard/
// SettingsSection/FieldGroup nedan fick, så hela sidans rytm blir jämnt
// tätare i stället för att bara ett enskilt kort krymper.
// Uppföljning ("emerged, ingen space under eller bredvid"): kortets EGEN
// marginBottom (9px) var en andra, DOLD marginal ovanpå den som redan
// finns på containern runt om — SettingsSection har sin egen
// marginBottom, .settings-split forcerar sin egen via !important, och
// "Min profil"-rutnätet har sitt eget gap. Samma dubblerade-marginal-bugg
// som redan fixades för AutoField/grid2 (se den kommentaren) — kortets
// EGEN marginal borttagen helt, containern äger nu hela mellanrummet
// ensam i stället för att två lager lägger på var sitt.
// padding: 'var(--density-card-p)' i stället för ett hårdkodat px-tal —
// index.css definierar --density-card-p (13px normalt, 9px under
// [data-density="compact"], se Inställningar → Utseende → Kompakt/normal)
// så EN CSS-variabel styr rytmen i stället för att dubblera värdet här.
// Accounted-stil (2026-09-27): ingen låda, bara en linje under avsnittet.
const card = {
  padding: '18px 0 14px', width: '100%', boxSizing: 'border-box',
  borderBottom: '1px solid var(--border-light)',
};
// Sida 38, punkt 2: kolumnbredden lever i CSS-klassen .form-row-2
// (index.css) istället för här, så mobilens 1-kolumns-överskrivning
// (@media max-width 768px) kan träffa den — se samma kommentar i
// Contacts.jsx/EmployeeForm.jsx. Varje användning nedan får
// className="form-row-2" också.
const grid2 = { display: 'grid', gap: '10px' };
// Takbredden på en formulärrad. Kundfeedback ("i helskärm är det så mycket
// space"): tvåkolumnsraderna stod fast på 672px mitt i ett kort som är
// dubbelt så brett på en stor skärm, så halva kortet var tomt. 920px låter
// raden fylla kortet betydligt bättre utan att ett enskilt fält blir en
// löpmeter brett — och betyder ingenting på mobil, där .form-row-2 ändå
// staplar till en kolumn (index.css).
const FORM_MAX = '920px';

// Serverns leverantörslista (api/_smtp.js PROVIDERS) i kopia, som reserv
// när statusanropet inte gick igenom. Utan den stod användaren med en tom
// rullgardin och kunde inte fylla i formuläret alls — precis det som
// rapporterades. Servern vinner alltid när svaret kommer fram.
const FALLBACK_MAIL_PROVIDERS = [
  { id: 'gmail', label: tr('ui.gmail_google_workspace'), host: 'smtp.gmail.com', port: 465, secure: true, appPasswordUrl: 'https://myaccount.google.com/apppasswords', help: tr('ui.kraver_tvastegsverifiering_pa_google_kontot_skap') },
  { id: 'outlook', label: tr('ui.outlook_hotmail_microsoft_365'), host: 'smtp-mail.outlook.com', port: 587, secure: false, appPasswordUrl: 'https://account.microsoft.com/security', help: tr('ui.kraver_tvastegsverifiering_skapa_ett_app_losenor') },
  { id: 'onecom', label: 'one.com', host: 'send.one.com', port: 465, secure: true, appPasswordUrl: null, help: tr('ui.anvand_samma_losenord_som_till_webbmejlen_hos_on') },
  { id: 'loopia', label: tr('ui.loopia'), host: 'mailcluster.loopia.se', port: 465, secure: true, appPasswordUrl: null, help: tr('ui.anvand_samma_losenord_som_till_webbmejlen_hos_lo') },
  { id: 'custom', label: tr('ui.annan_leverantor'), host: '', port: 465, secure: true, appPasswordUrl: null, help: tr('ui.fyll_i_serveradress_och_port_fran_din_leverantor') },
];
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' };
const inputBase = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
  // Säkerhetsgranskningen/mörkgrön-önskemålet: ingen background/color satt
  // här tidigare alls — inputs föll tillbaka på webbläsarens EGEN vita
  // standardbakgrund oavsett tema, vilket lämnade varje formulärfält vitt
  // mitt i en annars mörk sida.
  background: 'var(--bg-card)', color: 'var(--text-main)',
};
const btnPrimary = { ...BTN, background: BRAND.green, color: 'white' };
// Knappen i en integrationsbricka — liten, tydlig, samma i alla brickor.
const btnTile = BTN_OUTLINE;
// Kundönskemål ("gör integrationssidan större"): samma knapp, bara skalad
// upp till de nu större IntegrationTile-korten — en EGEN variant i
// stället för att förstora btnTile självt, som även delas av helt andra,
// oförstorade knappar (Användare-flikens "Markera alla"/"Rensa" m.fl.).
const btnTileLg = BTN_OUTLINE;

const btnSecondary = BTN_OUTLINE;
const btnGhost = { ...BTN, padding: '0 12px', background: 'transparent', color: 'var(--text-secondary)' };
const btnDanger = { ...BTN, background: '#dc2626', color: 'white' };
// Säkerhetsförsvagande handling (t.ex. stänga av tvåstegsverifiering) — dämpad
// varningston (amberBg/amberText), inte samma neutrala grå som vanliga
// sekundärknappar och inte heller Bokix grönt (det är en primär, positiv
// handling-färg, fel signal för något som gör kontot mindre skyddat).
const btnWarning = { ...BTN, background: BRAND.amberBg, color: BRAND.amberText };
// Sällan använd säkerhetsåtgärd (utloggning av andra enheter) — tydligt röd
// men ghost/outline, inte en vardaglig spara-knapp.
const btnDangerGhost = { ...BTN, background: 'var(--bg-card)', color: 'var(--status-red-text)', border: '1px solid var(--status-red-bg)' };

// Samma lilla versala rubrik som SettingCard (Accounted-stil), utan ikon.
function SectionHeading({ children }) {
  return <h3 className="settings-block-title" style={{ margin: 0 }}>{children}</h3>;
}

// ── Av/på-växel ── Egen liten switch istället för en vanlig kryssruta —
// samma visuella språk (pill + rund handtag, Bokix grönt när på) som
// resten av inställningssidan redan bygger på för statuspunkter (Badge
// ovan). Den underliggande <input type="checkbox"> ligger kvar men osynlig
// (opacity 0) ovanpå, så tangentbord/skärmläsare/klick fungerar precis som
// en riktig checkbox — bara utseendet är egengjort.
// `label`/`hint` är valfria: inuti en SettingRow står texten redan till
// vänster om kontrollen, och växeln ska då bara vara växeln — annars får
// raden två etiketter som säger samma sak.
export function ToggleSwitch({ checked, onChange, label, hint, disabled = false }) {
  if (!label && !hint) {
    return (
      <label style={{ position: 'relative', display: 'inline-block', flexShrink: 0, width: '40px', height: '22px', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: checked ? BRAND.green : 'var(--border)', transition: 'background 0.15s', pointerEvents: 'none' }} />
        <span style={{ position: 'absolute', top: '2px', left: checked ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
      </label>
    );
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '480px' }}>{hint}</span>}
      </span>
      <span style={{ position: 'relative', flexShrink: 0, width: '40px', height: '22px' }}>
        <input
          type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: checked ? BRAND.green : 'var(--border)', transition: 'background-color 0.15s ease', pointerEvents: 'none' }} />
        <span style={{ position: 'absolute', top: '2px', left: checked ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s ease', pointerEvents: 'none' }} />
      </span>
    </label>
  );
}


/** Googles G, ritad. Fyra färgfält, samma proportioner som märket. */
function GoogleGlyph({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.7 5.2-.1.3C7.9 41 15.4 46 24 46" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-.3l-6.8-5.3-.2.1C3 17.1 2.2 20.5 2.2 24s.8 6.9 2.3 9.9z" />
      <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.3 29.9 1 24 1 15.4 1 7.9 6 4.5 14.1l6.9 5.4C13.3 13.3 18.2 9.5 24 9.5" />
    </svg>
  );
}

function Badge({ tone = 'warning', children }) {
  const map = {
    positive: { bg: BRAND.greenLight, color: BRAND.greenDark },
    warning: { bg: BRAND.amberBg, color: BRAND.amberText },
    danger: { bg: 'var(--status-red-bg)', color: 'var(--status-red-text)' },
  };
  const t = map[tone] || map.warning;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: t.bg, color: t.color }}>{children}</span>;
}

// ── Designprimitiver för inställningssidan ──────────────────────────────
// Kundfeedback: "det ser kodat ut — man förstår inte vad saker är. Data?
// Vad är data? Våra konkurrenter har inställningar som inte bara är enkla
// utan välorganiserade och snygga."
//
// Grundproblemet var att sidan bestod av ETT element: ett vitt kort. Allt
// hade samma vikt — ett kryss för scrollbaren såg ut som företagets
// organisationsnummer. De tre primitiverna nedan ger sidan en hierarki att
// läsa i stället:
//
//   SettingsSection  rubrik + en mening om VAD avsnittet är till för.
//                    Meningen är inte utfyllnad: det är den som gör att
//                    "Din data" inte behöver heta något kryptiskt.
//   SettingCard      ytan. Valfri rubrikrad med ikon och statusbricka.
//   SettingRow       etikett + förklaring till vänster, kontrollen till
//                    höger, hårfin linje mellan raderna. Formen som gör en
//                    inställningslista läsbar i stället för en vägg av
//                    kryssrutor.
//
// Serifen (--font-voice, samma som Startsidans hälsning) används på EN
// plats: företagets/personens namn i identitetskortet högst upp i en flik.
// Det är sidans enda "designade" moment — resten är medvetet tyst.
// Måtten här är sidans lodräta rytm, och de är MEDVETET snåla:
// kundinvändningen mot inställningarna var återkommande och handlade om
// summan av luft — sektionsmarginal plus rubrikmarginal plus kortets egen
// innerpadding, tre gånger per skärm. Ändra dem här, inte i en enskild
// flik, annars driver flikarna isär igen.
// Uppföljning (skärmdump, "mycket space — ska se ut som en bra settings-
// sida"): 12px var fortfarande för mycket i praktiken (staplat ovanpå
// SAMMA sorts marginal på varje kort/rubrik under den) — 8px.
// Ännu en uppföljning ("emerged, ingen space mellan/under/över"): kortets
// EGEN marginal togs bort helt (se card-kommentaren) så den här är nu den
// ENDA marginalen kvar mellan två sektioner — pressad till 4px, ett
// hårfint mellanrum bara till för att nästa rubrik inte ska sitta klistrad
// mot kortkanten ovanför, inte längre en riktig "luft"-marginal.
function SettingsSection({ title, children, actions }) {
  return (
    <section style={{ marginBottom: '8px' }}>
      {(title || actions) && (
        <div className="settings-block-head">
          <h2 className="settings-block-title" style={{ margin: 0, flex: 1, minWidth: 0 }}>{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// 2026-09-27, Accounted-stil: inga lådor och inga färgade ikonplattor.
// Ett avsnitt är en liten versal rubrik med en hårfin linje under, och
// innehållet står direkt på sidan. `icon`/`tone` tas fortfarande emot så
// anropen inte behöver ändras, men ritas inte.
function SettingCard({ title, badge, children, danger, style, flush = false }) {
  const { borderRadius: _ignored, ...rest } = style || {};
  return (
    <section className="settings-block" style={{ minWidth: 0, ...rest }}>
      {(title || badge) && (
        <div className="settings-block-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-block-title" style={danger ? { color: 'var(--status-red-text)' } : undefined}>{title}</div>
          </div>
          {badge}
        </div>
      )}
      {children != null && <div className={flush ? 'settings-block-body is-flush' : 'settings-block-body'}>{children}</div>}
    </section>
  );
}

function SettingRow({ label, description, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      padding: 'calc(var(--density-row-py, 8px) + 4px) 0',
      borderBottom: last ? 'none' : '1px solid var(--border-light)',
    }}>
      <div style={{ minWidth: '180px', flex: 1 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)' }}>{label}</div>
        {description && <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.55, maxWidth: '460px' }}>{description}</div>}
      </div>
      {/* På telefon blir fält och val fullbreda under etiketten (index.css). */}
      <div className="settings-row-ctl" style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/** En rad i en lista som leder vidare, som Accounteds import- och
 * kopplingslistor: logga, titel (med valfri status), en rad om vad det är,
 * och en pil. Hela raden är klickbar. `right` ersätter pilen med en egen
 * kontroll (t.ex. Anslut) när raden inte leder till en egen sida. */
function SettingsLinkRow({ logo, logoLarge = false, title, status, aside, description, onClick, right, danger, children }) {
  const clickable = Boolean(onClick);
  // En div med knapproll, inte en <button>: raden kan bära en egen knapp
  // (Anslut), och knappar får inte ligga i varandra.
  return (
    <div
      className={`settings-link-row${clickable ? ' is-clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } } : undefined}
    >
      {logo && <span className={logoLarge ? 'settings-link-logo is-large' : 'settings-link-logo'}>{logo}</span>}
      <span className="settings-link-text">
        <span className="settings-link-title" style={danger ? { color: 'var(--status-red-text)' } : undefined}>
          {title}
          {status}
        </span>
        {description && <span className="settings-link-desc">{description}</span>}
        {children}
      </span>
      {aside && <span className="settings-link-aside">{aside}</span>}
      {right != null ? <span className="settings-link-right" onClick={e => e.stopPropagation()}>{right}</span> : clickable && <ChevronRight size={18} className="settings-link-chevron" />}
    </div>
  );
}

/** Liten statusmarkering bredvid titeln i en SettingsLinkRow. */
function LinkStatus({ on, children }) {
  return <span className={`settings-link-status${on ? ' is-on' : ''}`}>{children}</span>;
}

/** Ett fält som visar en uppgift man inte får ändra — ser ut som ett
 * inputfält (samma etikett, samma höjd, samma rytm som fälten omkring) men
 * med dämpad botten och ett hänglås. Används för företagets registrerade
 * identitet: namnet och organisationsnumret. Formen är medvetet ett FÄLT
 * och inte bara en textrad, så raden inte hoppar i formuläret. */
function LockedField({ label, value }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{
        ...inputBase, background: 'var(--bg-muted)', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default',
      }}>
        <Lock size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      </div>
    </div>
  );
}

/** Underrubrik INUTI ett kort — det som gör att företagsuppgifterna kan
 * ligga som EN familj (grunduppgifter, kontakt, bank) i stället för tre
 * separata kort man måste leta mellan. Kundfeedback: exakt den familjen. */
function FieldGroup({ title, children }) {
  return (
    <section className="settings-block">
      <div className="settings-block-head"><div className="settings-block-title">{title}</div></div>
      <div className="settings-block-body">{children}</div>
    </section>
  );
}

/** Välj vad en inbjuden person får göra, sida för sida.
 *
 * En rad per sida med tre lägen (ingen åtkomst / kan se / kan redigera).
 * Rollen är ett tak: en läsare kan aldrig få "kan redigera" här, och
 * väljaren visar det i stället för att låtsas att valet finns.
 *
 * Behörigheten är inte bara en gömd meny — api/company-access.js vägrar
 * skrivningar till fält som hör till stängda sidor. Delade fält (t.ex.
 * verifikationer, som både fakturor och bokföring skriver) står i texten
 * längst ner, för det är den ärliga gränsen för hur finmaskigt det går
 * att stänga av.
 */
function PageAccessPicker({ value, role = 'editor', onChange, compact }) {
  const levels = role === 'editor' ? ACCESS_LEVELS : ACCESS_LEVELS.filter(l => l.id !== 'edit');
  const setPage = (pageId, level) => onChange({ ...(value || {}), [pageId]: level });
  const setAll = (level) => onChange(Object.fromEntries(ACCESS_PAGES.map(p => [p.id, level])));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.sidor')}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tr('ui.vad_personen_ser_och_far_andra')}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={() => setAll(role === 'editor' ? 'edit' : 'view')} style={btnTile}>{tr('ui.markera_alla')}</button>
          <button type="button" onClick={() => setAll('none')} style={btnTile}>{tr('ui.rensa')}</button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        {ACCESS_PAGES.map((page, i) => {
          const current = accessForPage(value, page.id, role);
          return (
            <div
              key={page.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap',
                padding: compact ? '9px 12px' : '10px 14px',
                borderBottom: i === ACCESS_PAGES.length - 1 ? 'none' : '1px solid var(--border-light)',
                background: current === 'none' ? 'var(--bg-muted)' : 'transparent',
              }}
            >
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: current === 'none' ? 'var(--text-muted)' : 'var(--text-main)' }}>{page.label}</span>
              <div style={{ display: 'flex', gap: '3px', padding: '3px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '999px' }}>
                {levels.map(level => {
                  const active = current === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setPage(page.id, level.id)}
                      aria-pressed={active}
                      style={{
                        padding: '4px 11px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '12px', fontWeight: active ? 700 : 600,
                        background: active ? 'var(--bg-card)' : 'transparent',
                        color: active ? BRAND.greenDark : 'var(--text-secondary)',
                        boxShadow: active ? '0 1px 2px rgba(15,23,42,0.10)' : 'none',
                      }}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '9px 0 0', lineHeight: 1.6 }}>
        {tr('ui.den_som_far_redigera_fakturor_utgifter_eller_ban')}
      </p>
    </div>
  );
}

function relativeTimeSv(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return tr('ui.just_nu');
  if (mins < 60) return tr('ui.for_sedan_5', { mins, v1: mins === 1 ? 'minut' : 'minuter' });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr('ui.for_sedan_4', { hours, v1: hours === 1 ? 'timme' : 'timmar' });
  const days = Math.floor(hours / 24);
  if (days < 30) return tr('ui.for_sedan_3', { days, v1: days === 1 ? 'dag' : 'dagar' });
  const months = Math.floor(days / 30);
  if (months < 12) return tr('ui.for_sedan_2', { months, v1: months === 1 ? 'månad' : 'månader' });
  const years = Math.floor(months / 12);
  return tr('ui.for_sedan', { years, v1: years === 1 ? 'år' : 'år' });
}

// detectDevice flyttad till ../utils/deviceInfo.js (importerad ovan) — delad
// med App.jsx (inloggningshistorik, login_events).

// ── Autosave-fält ──
// Race-condition-skydd: om `value` ändras utifrån (t.ex. samma företag öppet
// i en annan flik) medan användaren har en osparad ändring liggande i debounce-
// fönstret, ska den INTE tystas skrivas över — annars kan ett halvfärdigt
// fältvärde radera det användaren precis skrev innan det hann sparas.
function AutoField({ label, type = 'text', value, onChange, hint, required, placeholder, showSaveState = true }) {
  const [val, setVal] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const timer = useRef(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setVal(value || '');
  }, [value]);

  const handleChange = (e) => {
    const newVal = e.target.value;
    setVal(newVal);
    dirtyRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    setIsSaving(true);
    setIsSaved(false);
    timer.current = setTimeout(() => {
      onChange(newVal);
      dirtyRef.current = false;
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }, 600);
  };

  return (
    // Fältets egen bottenmarginal (kundfeedback om luften på hela
    // inställningssidan): 16px ovanpå rutnätets gap gav nästan 30px mellan
    // två fältrader. Uppföljning (skärmdump, "mycket space" igen): 10px
    // ovanpå grid2:s EGET gap (samma sorts dubblerad marginal som card/
    // SettingsSection redan fixades för) gav fortfarande ~22px mellan två
    // staplade fältrader — 6px räcker, grid-gapet gör resten.
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        {/* showSaveState=false (Grunduppgifter/Kontaktuppgifter, se
            anropsställena): fältet skriver bara till lokal companyDraft-
            state, inte till kontot — "Sparat ✓" hade ljugit om det (såg ut
            som en riktig autosave fast inget var sparat än, bara ett klick
            på "Spara ändringar" + reauth-koden längre ner faktiskt
            persisterar). Ingen indikator alls här istället; den riktiga
            sparknappen har sin egen busy/success-text. */}
        {showSaveState && (
          <div style={{ fontSize: '12px', minHeight: '18px', display: 'flex', alignItems: 'center' }}>
            {isSaving && <span style={{ color: 'var(--text-muted)' }}>{tr('ui.sparar_2')}</span>}
            {isSaved && <span style={{ color: BRAND.greenDark, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}><Check size={12} /> {tr('ui.sparat')}</span>}
          </div>
        )}
      </div>
      <input
        type={type} value={val} onChange={handleChange} placeholder={placeholder}
        style={inputBase}
        onFocus={e => e.target.style.borderColor = BRAND.green}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      {hint && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

// ── Bilduppladdning (profilbild / logotyp) ──
// Riktig uppladdning till Supabase Storage — inte en bildlänk att klistra
// in. Två separata buckets (se supabase-setup.sql): "profile" för
// profilbilder, "companylogo" för företagslogotyper. Buckets måste skapas i
// Supabase-projektet en gång; tills dess visas ett tydligt, ärligt
// felmeddelande istället för att låtsas lyckas.
function ImageUploadField({ label, value, onChange, uploadPath, bucket, hint, readOnly = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // JPG/PNG + 3MB är inte bara UI-text — samma gräns är satt direkt på
  // Storage-bucketen (allowed_mime_types/file_size_limit), så den gäller
  // even om någon går förbi den här komponenten och anropar Storage-API:et
  // direkt. Kollen här är bara för en snabb, tydlig felindikering INNAN
  // en onödig uppladdning påbörjas — den riktiga spärren sitter på servern.
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); if (inputRef.current) inputRef.current.value = ''; return; }
    if (!ALLOWED_TYPES.includes(file.type)) { setError(tr('ui.filen_maste_vara_jpg_eller_png')); return; }
    if (file.size > 3 * 1024 * 1024) { setError(tr('ui.bilden_far_vara_max_3_mb')); return; }
    setBusy(true); setError('');
    try {
      // Säkerhetsfix (säkerhetsgranskningen): sanera filändelsen — se
      // motsvarande kommentar i src/utils/fileUpload.js.
      const rawExt = (file.name.split('.').pop() || 'png').toLowerCase();
      const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'png';
      const path = `${uploadPath}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(`${data.publicUrl}?v=${Date.now()}`); // cache-bust så en ny bild syns direkt, inte den gamla från webbläsarcachen
    } catch (err) {
      const msg = err.message || '';
      let friendly = msg || tr('ui.uppladdningen_misslyckades');
      if (/bucket not found/i.test(msg)) friendly = `Bildlagring är inte konfigurerad ännu (bucket "${bucket}" saknas — kör storage-delen av supabase-setup.sql).`;
      else if (/mime type/i.test(msg)) friendly = tr('ui.filen_jpg_png');
      else if (/exceeded the maximum allowed size/i.test(msg)) friendly = tr('ui.bilden_max_3mb');
      else if (/row-level security/i.test(msg)) friendly = tr('ui.bilden_kunde_inte_sparas_behorighet');
      setError(friendly);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ ...btnSecondary, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          <Upload size={14} /> {busy ? tr('ui.laddar_upp') : value ? tr('ui.byt_bild') : tr('ui.ladda_upp_bild')}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} disabled={busy} style={btnGhost}>{tr('ui.ta_bort')}</button>}
      </div>
      {hint && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>{hint}</div>}
      {error && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginTop: '6px' }}>{error}</div>}
    </div>
  );
}

// ── Fakturamall (Sida 24) ──
// Exempeldata bara för förhandsvisningen/mallkorten här i Inställningar —
// samma InvoiceDocument-komponent som fångas för den riktiga PDF-exporten
// (se Invoices.jsx), aldrig en förenklad egen mockup.
const SAMPLE_ROWS = [
  { id: 'sample-1', description: tr('ui.konsultation_webbutveckling'), qty: 14, unitPrice: 950, vatRate: 25, discount: 0 },
  { id: 'sample-2', description: tr('ui.programvarulicens_arsavgift'), qty: 1, unitPrice: 3200, vatRate: 25, discount: 0 },
  { id: 'sample-3', description: tr('ui.resekostnader'), qty: 1, unitPrice: 640, vatRate: 25, discount: 0 },
];
const SAMPLE_NET = SAMPLE_ROWS.reduce((s, r) => s + r.qty * r.unitPrice, 0);
const SAMPLE_TOTALS = { net: SAMPLE_NET, vat: SAMPLE_NET * 0.25, total: SAMPLE_NET * 1.25 };
const SAMPLE_CUSTOMER = { name: 'Storängens Handel AB', address: 'Sveavägen 48, 113 59 Stockholm', email: 'faktura@storangenshandel.se' };
const SAMPLE_INVOICE = { invoiceNumber: '1042', date: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] };

// A4 vid 96dpi (samma antagande som .a4-paper i index.css: 210mm/297mm).
// Höjden på tumnageln räknas ALLTID fram från scale — annars klipper en
// för liten fast höjd bort tabellen/totalsumman och bara headern syns
// (det var buggen: kortet var 210px högt men fakturan skalades till 381px).
const A4_PAGE_WIDTH = 794;
const A4_PAGE_HEIGHT = 1123;

// Kundfeedback (två omgångar): en FAST skala uträknad för en enda
// skärmbredd (se den gamla MOBILE_TEMPLATE_THUMB_SCALE-kommentaren) botade
// först en överflödande tumnagel — men lämnade den mindre än sin egen
// container på alla ANDRA bredder ("rutorna ... täcker inte allt"), tom
// gråmarkerad kant synlig runtom. En ResizeObserver på wrappern mäter den
// FAKTISKA tillgängliga bredden och räknar om skalan därefter, så
// tumnageln fyller sin container exakt — kortkort, stort förhandsgranskning-
// kort, mobil, desktop, surfplatta — utan att någon behöver räkna om ett
// magiskt scale-tal för varje ny brytpunkt. `scale`-propen finns kvar som
// en explicit override för anrop som medvetet vill ett fast värde.
function TemplateThumb({ tplId, previewProps, scale }) {
  const wrapRef = useRef(null);
  const [autoScale, setAutoScale] = useState(scale ?? 0.34);

  useEffect(() => {
    if (scale != null) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width;
      if (width > 0) setAutoScale(width / A4_PAGE_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  const effectiveScale = scale ?? autoScale;
  const h = Math.round(A4_PAGE_HEIGHT * effectiveScale);
  return (
    <div ref={wrapRef} style={{ width: scale != null ? Math.round(A4_PAGE_WIDTH * scale) : '100%', height: h, margin: '0 auto', overflow: 'hidden', background: 'var(--border)', position: 'relative' }}>
      <div style={{ width: `${A4_PAGE_WIDTH}px`, transform: `scale(${effectiveScale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
        <InvoiceDocument template={tplId} {...previewProps} />
      </div>
    </div>
  );
}

function TemplateCard({ tpl, selected, onSelect, previewProps, scale }) {
  return (
    <div
      onClick={onSelect} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
      style={{
        position: 'relative', border: `2px solid ${selected ? BRAND.green : 'var(--border)'}`, borderRadius: '12px',
        overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-card)', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <TemplateThumb tplId={tpl.id} previewProps={previewProps} scale={scale} />
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{tpl.label}</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tpl.description}</div>
      </div>
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          <Check size={13} color="white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

// ── Reauthentication (emailad engångskod) ──
// Delad av alla tre känsliga flöden som kräver den (byt lösenord här,
// Företagsuppgifters "Spara ändringar", Stripe-anslutning i App.jsx) — se
// src/utils/reauthVerification.js och api/auth/request-password-reset.js:s
// send-reauth-code/verify-reauth-code. Skickar koden automatiskt när
// steget mountas (föräldern renderar den bara när en reauth faktiskt
// behövs) — samma "kolla din inkorg, skriv sexsiffrig kod"-mönster som
// Auth.jsx:s registreringssteg 1, men i Settings-sidans egna kort-/
// knappstilar istället för auth-sidans (helt separat visuell stil, se
// Auth.jsx:s toppkommentar om varför den ser ut som den gör).
function ReauthCodeStep({ onVerified, onCancel }) {
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [status, setStatus] = useState('sending'); // sending|idle|verifying
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const send = async () => {
    setStatus('sending'); setError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const token = await sendReauthCode(session?.access_token);
      setOtpToken(token);
      setCode('');
      setResendCooldown(30);
    } catch (err) {
      setError(err?.message || tr('ui.kunde_inte_skicka_koden_just_nu_forsok_igen_om_e'));
    } finally {
      setStatus('idle');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { send(); }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) { setError(tr('ui.ange_den_sexsiffriga_koden_fran_mejlet')); return; }
    setStatus('verifying'); setError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const reauthToken = await verifyReauthCode({ accessToken: session?.access_token, code, token: otpToken });
      onVerified(reauthToken);
    } catch (err) {
      setError(err?.message || tr('ui.fel_kod_forsok_igen'));
      setStatus('idle');
    }
  };

  return (
    <div style={{ background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', borderRadius: '12px', padding: '18px', maxWidth: '360px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', marginBottom: '6px' }}>{tr('ui.bekrafta_med_kod')}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
        {tr('ui.vi_skickade_en_sexsiffrig_kod_till_din_e_post_sk')}
      </div>
      <input
        type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        style={{ ...inputBase, textAlign: 'center', fontSize: '22px', fontWeight: 700, letterSpacing: '8px' }}
      />
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', marginTop: '10px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px' }}>
        <button type="button" onClick={onCancel} style={btnGhost}>{tr('ui.avbryt')}</button>
        <button
          type="button" onClick={verify} disabled={status === 'verifying' || code.length !== 6}
          style={{ ...btnPrimary, opacity: (status === 'verifying' || code.length !== 6) ? 0.5 : 1, cursor: (status === 'verifying' || code.length !== 6) ? 'not-allowed' : 'pointer' }}
        >
          {status === 'verifying' ? tr('ui.bekraftar') : tr('ui.bekrafta')}
        </button>
      </div>
      <button
        type="button" onClick={send} disabled={resendCooldown > 0 || status === 'sending'}
        style={{ marginTop: '10px', background: 'none', border: 'none', borderRadius: '8px', padding: '4px 8px', color: resendCooldown > 0 ? 'var(--text-muted)' : BRAND.green, fontWeight: 700, fontSize: '12px', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
      >
        {status === 'sending' ? tr('ui.skickar_2') : resendCooldown > 0 ? tr('ui.skicka_koden_igen_s', { resendCooldown }) : tr('ui.fick_du_ingen_kod_skicka_igen')}
      </button>
    </div>
  );
}

// ── Lösenordssektion ──
// Nuvarande lösenord verifieras genom att faktiskt logga in med det (Supabase
// kräver det inte för updateUser, men en aktiv session i webbläsaren ska inte
// räcka för att byta lösenord — annars skyddar fältet "Nuvarande lösenord"
// ingenting alls). Reauthentication (ReauthCodeStep ovan) är ett ANDRA,
// oberoende steg efter det — se filkommentaren i request-password-reset.js:s
// handleChangePassword för varför bytet själv numera görs server-side.
function PasswordSection({ user, readOnly = false, bare = false }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  // Kontrollen av nuvarande lösenord är en riktig inloggning, så Supabase
  // kräver captcha även här när Turnstile är påslaget.
  const captchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  // Bara relevant i `bare`-läget (kombinerat "Säkerhet"-kort, kundönskemål
  // från en mockup): formuläret ligger dolt tills man klickar "Byt
  // lösenord" på raden, i stället för att alltid stå uppfällt — annars
  // hade kortet blivit lika högt som förut, bara med en extra rad ovanpå.
  // I det ICKE-bara läget (kortet ensamt, som förut) är formuläret alltid
  // synligt, ingen egen vy-växling.
  const [expanded, setExpanded] = useState(false);

  const changedAt = user?.user_metadata?.password_changed_at;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    if (newPw.length < 8) { setError(tr('ui.nytt_losenord_maste_vara_minst_8_tecken')); return; }
    if (newPw !== confirmPw) { setError(tr('ui.losenorden_matchar_inte_varandra')); return; }
    setBusy(true);
    let captchaToken = null;
    try { captchaToken = await captchaRef.current?.execute(); } catch {
      setBusy(false);
      setCaptchaRound(n => n + 1);
      setError('Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen. Har du en annonsblockerare, pausa den för bokix.se.');
      return;
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email, password: currentPw,
      options: captchaToken ? { captchaToken } : undefined,
    });
    setBusy(false);
    setCaptchaRound(n => n + 1);
    if (reauthError) {
      setError(tr('ui.nuvarande_losenord_stammer_inte'));
      return;
    }
    setShowReauth(true);
  };

  const handleReauthVerified = async (reauthToken) => {
    setBusy(true); setError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      await changePassword({ accessToken: session?.access_token, newPassword: newPw, reauthToken });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowReauth(false);
      setExpanded(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setShowReauth(false);
      setError(err?.message || tr('ui.kunde_inte_byta_losenord_forsok_igen_om_en_stund'));
    } finally {
      setBusy(false);
    }
  };

  const statusText = changedAt ? tr('ui.senast_andrat', { v0: relativeTimeSv(changedAt) }) : null;

  const form = (
    <>
      {showReauth ? (
        <ReauthCodeStep onVerified={handleReauthVerified} onCancel={() => setShowReauth(false)} />
      ) : (
        <form onSubmit={submit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{tr('ui.nuvarande_losenord')}</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{ ...inputBase, maxWidth: '340px' }} autoComplete="current-password" required />
          </div>
          <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
            <div>
              <label style={labelStyle}>{tr('ui.nytt_losenord')}</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label style={labelStyle}>{tr('ui.bekrafta_nytt_losenord')}</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
            </div>
          </div>
          <Turnstile key={captchaRound} ref={captchaRef} onDemand />
          {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button type="submit" disabled={busy || !currentPw || !newPw || !confirmPw} style={{ ...btnPrimary, opacity: (busy || !currentPw || !newPw || !confirmPw) ? 0.5 : 1, cursor: (busy || !currentPw || !newPw || !confirmPw) ? 'not-allowed' : 'pointer' }}>
              {busy ? tr('ui.kontrollerar') : tr('ui.byt_losenord')}
            </button>
            {bare && <button type="button" onClick={() => { setExpanded(false); setError(''); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} style={btnGhost}>{tr('ui.avbryt')}</button>}
          </div>
        </form>
      )}
    </>
  );

  if (bare) {
    // "Säkerhet"-kortets radformat (kundönskemål, mockup): etikett + en
    // kort statusrad till vänster, en knapp till höger — samma SettingRow
    // som resten av appen redan använder för den sortens rad. Formuläret
    // fälls ut UNDER raden (expanded) i stället för att alltid stå synligt
    // — annars hade "Säkerhet"-kortet bara varit lika högt som förut med
    // en extra rad ovanpå, inte den kompakta rad-med-knapp mockupen visar.
    // last={false} alltid: den här raden ligger i praktiken aldrig sist i
    // "Säkerhet"-kortet — antingen fälls formuläret ut direkt under den,
    // eller så följer Tvåfaktorsautentisering-raden näst efter. En
    // bottenkant hör hemma i båda fallen.
    return (
      <>
        <SettingRow label={tr('ui.losenord')} description={success ? tr('ui.losenordet_ar_uppdaterat') : statusText} last={false}>
          {!expanded && <button type="button" onClick={() => setExpanded(true)} style={btnSecondary}>{tr('ui.byt_losenord')}</button>}
        </SettingRow>
        {expanded && <div style={{ paddingBottom: '14px' }}>{form}</div>}
      </>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
        <SectionHeading icon={Lock} tone="blue">{tr('ui.losenord')}</SectionHeading>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{statusText}</span>
      </div>
      {success && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginBottom: '10px', fontWeight: 600 }}>{tr('ui.losenordet_ar_uppdaterat')}</div>}
      {form}
    </div>
  );
}

// ── Tvåstegsverifiering ──
// Riktig TOTP-registrering via Supabase Auth MFA (auth.mfa.*) — ingen
// simulerad på/av-switch. Status läses från faktiskt registrerade,
// verifierade faktorer på kontot.
function TwoFactorSection({ bare = false }) {
  const [factors, setFactors] = useState(null); // null = laddar
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(null); // { factorId, qrCode, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFactors = () => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) { setError(error.message); setFactors([]); }
      else setFactors(data?.totp || []);
    });
  };
  useEffect(loadFactors, []);

  const verifiedFactor = (factors || []).find(f => f.status === 'verified');

  const startEnroll = async () => {
    setError(''); setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirmEnroll = async () => {
    if (!enrolling) return;
    setBusy(true); setError('');
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (chErr) { setBusy(false); setError(chErr.message); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: challenge.id, code });
    setBusy(false);
    if (vErr) { setError(tr('ui.fel_kod_kontrollera_att_klockan_i_autentiserings')); return; }
    setEnrolling(null); setCode('');
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId }).catch(() => {});
    setEnrolling(null); setCode(''); setError('');
  };

  const disable = async () => {
    if (!verifiedFactor) return;
    if (!(await confirmDialog(tr('ui.inaktivera_tvastegsverifiering_kontot_blir_skydd'), { danger: true }))) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setBusy(false);
    if (error) { setError(error.message); return; }
    loadFactors();
  };

  const enrollPanel = enrolling && (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 12px' }}>{tr('ui.skanna_koden_med_din_autentiseringsapp_ange_seda')}</p>
      <img src={enrolling.qrCode} alt={tr('ui.qr_kod_for_tvastegsverifiering')} style={{ width: 160, height: 160, border: '1px solid var(--border)', borderRadius: '8px', display: 'block', marginBottom: '8px' }} />
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{tr('ui.kan_du_inte_skanna_ange_koden_manuellt')} <code style={{ background: 'var(--border-light)', padding: '2px 6px', borderRadius: '4px' }}>{enrolling.secret}</code></div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" style={{ ...inputBase, width: '120px' }} />
        <button onClick={confirmEnroll} disabled={busy || code.length !== 6} style={{ ...btnPrimary, opacity: (busy || code.length !== 6) ? 0.5 : 1 }}>{tr('ui.bekrafta')}</button>
        <button onClick={cancelEnroll} disabled={busy} style={btnGhost}>{tr('ui.avbryt')}</button>
      </div>
    </div>
  );

  if (bare) {
    // "Säkerhet"-kortets radformat (kundönskemål, mockup): "Aktiv"-badgen
    // (samma gröna check-badge som mockupen) i stället för på/av-texten,
    // Aktivera/Inaktivera-knappen kvar (borttagen hade varit en riktig
    // funktionsförlust, inte bara en stilfråga) — QR-registreringen fälls
    // ut under raden precis som lösenordsformuläret ovan.
    // last={true} alltid: den här är genuint sista raden i "Säkerhet"-
    // kortet — enrollPanel har sin egen ovankant, ingen dubbel linje.
    return (
      <>
        <SettingRow label={tr('ui.tvafaktorsautentisering')} last>
          {factors !== null && !enrolling && (
            verifiedFactor
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Badge tone="positive">{tr('ui.aktiv')}</Badge><button onClick={disable} disabled={busy} style={btnGhost}>{tr('ui.inaktivera')}</button></span>
              : <button onClick={startEnroll} disabled={busy} style={btnSecondary}>{tr('ui.aktivera')}</button>
          )}
        </SettingRow>
        {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '-6px', marginBottom: '10px' }}>{error}</div>}
        {enrolling && <div style={{ paddingBottom: '14px' }}>{enrollPanel}</div>}
      </>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <SectionHeading icon={KeyRound} tone={verifiedFactor ? 'green' : 'amber'}>{tr('ui.tvastegsverifiering')}</SectionHeading>
            {factors !== null && <Badge tone={verifiedFactor ? 'positive' : 'warning'}>{verifiedFactor ? tr('ui.pa') : tr('ui.av_2')}</Badge>}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px' }}>{tr('ui.kraver_en_engangskod_fran_en_autentiseringsapp_t')}</div>
        </div>
        {factors !== null && !enrolling && (
          verifiedFactor
            ? <button onClick={disable} disabled={busy} style={btnWarning}>{tr('ui.inaktivera')}</button>
            : <button onClick={startEnroll} disabled={busy} style={btnPrimary}>{tr('ui.aktivera')}</button>
        )}
      </div>
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
      {enrollPanel}
    </div>
  );
}

// ── Face ID och fingeravtryck (passkeys) ──
// Supabase Auth, beta (se utils/sessionPolicy.js). En passkey per enhet:
// iPhonen, datorn och så vidare. Den privata nyckeln stannar i telefonens
// nyckelring; Supabase har bara den publika.
function PasskeySection() {
  const [passkeys, setPasskeys] = useState(null); // null = laddar
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(null);
  const [lockOn, setLockOn] = useState(false);

  const load = () => {
    supabase.auth.passkey.list()
      .then(({ data, error: err }) => {
        if (err) { setError(tr('ui.passkey_kunde_inte_hamtas')); setPasskeys([]); }
        else {
          const list = Array.isArray(data) ? data : [];
          setPasskeys(list);
          rememberPasskeyOnDevice(list.length > 0);
        }
      })
      .catch(() => { setError(tr('ui.passkey_kunde_inte_hamtas')); setPasskeys([]); });
  };
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id || null;
      setUserId(id);
      setLockOn(appLockEnabledFor(id));
    });
  }, []);

  const add = async () => {
    setError(''); setBusy(true);
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      // Face ID finns nu på den här enheten: spärra appen med det direkt.
      if (userId) { setAppLock(userId); setLockOn(true); }
      load();
    } catch (err) {
      if (!isPasskeyCancel(err)) setError(tr('ui.passkey_kunde_inte_laggas_till'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!(await confirmDialog(tr('ui.passkey_ta_bort_fraga'), { danger: true }))) return;
    setBusy(true);
    const { error: err } = await supabase.auth.passkey.delete({ passkeyId: p.id });
    setBusy(false);
    if (err) { setError(err.message); return; }
    load();
  };

  const toggleLock = () => {
    const next = !lockOn;
    setAppLock(next ? userId : null);
    setLockOn(next);
  };

  const hasAny = (passkeys || []).length > 0;
  return (
    <SettingCard title={tr('ui.passkey_rubrik')}>
      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: '520px' }}>{tr('ui.passkey_beskrivning')}</p>
      {(passkeys || []).map((p) => (
        <SettingRow key={p.id} label={p.friendly_name || tr('ui.passkey_enhet')} description={p.last_used_at ? `${tr('ui.passkey_senast_anvand')} ${new Date(p.last_used_at).toLocaleDateString('sv-SE')}` : undefined}>
          <button onClick={() => remove(p)} disabled={busy} style={btnGhost}>{tr('ui.ta_bort')}</button>
        </SettingRow>
      ))}
      {hasAny && (
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
          <ToggleSwitch checked={lockOn} onChange={toggleLock} label={tr('ui.passkey_las_appen')} hint={tr('ui.passkey_las_appen_beskr')} />
        </div>
      )}
      {passkeys !== null && (
        <button type="button" className="passkey-add-btn" onClick={add} disabled={busy}>
          <Fingerprint size={22} />
          {hasAny ? tr('ui.passkey_lagg_till_en_till') : tr('ui.passkey_lagg_till_knapp')}
        </button>
      )}
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
    </SettingCard>
  );
}

// ── Aktiva sessioner ──
// Supabase Auth ger ingen klient-API för att lista andra inloggade enheter
// (det kräver ett serverstöd som inte finns byggt) — så istället för att
// hitta på en lista med påhittade enheter/platser visas bara den riktiga,
// verkliga enheten man sitter på just nu, plus en riktig knapp som faktiskt
// loggar ut alla ANDRA sessioner (auth.signOut({ scope: 'others' })). Det
// löser samma underliggande behov ("logga ut en glömd/delad enhet") utan att
// fabricera säkerhetsrelaterad data.
function ActiveSessionsSection({ user, readOnly = false }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const device = useMemo(() => detectDevice(), []);

  const signOutOthers = async () => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setBusy(true); setError(''); setDone(false);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div style={{ ...card, borderRadius: 0 }}>
      <div style={{ marginBottom: '8px' }}><SectionHeading icon={Laptop} tone="blue">{tr('ui.aktiva_sessioner')}</SectionHeading></div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: '560px' }}>
        {tr('ui.bokix_kan_i_dagslaget_inte_visa_en_lista_over_di')}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Laptop size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>{device}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
        </div>
        <Badge tone="positive">{tr('ui.denna_enhet')}</Badge>
      </div>
      <button
        onClick={signOutOthers} disabled={busy}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--status-red-bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
        style={{ ...btnDangerGhost, opacity: busy ? 0.6 : 1, transition: 'background-color 0.12s' }}
      >{busy ? tr('ui.loggar_ut') : tr('ui.logga_ut_fran_alla_andra_enheter')}</button>
      {done && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>{tr('ui.klart_alla_andra_sessioner_ar_utloggade')}</div>}
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
    </div>
  );
}

// ── Verifikationsserier (Allmänt) ── En rad per serie: namnet går att
// ändra, och till höger står senaste använda nummer. Serierna och vilka
// bokningar som hamnar i vilken står i utils/verificationNumbering.js.
function VerificationSeriesList({ company, setCompanyInfo, verifications, readOnly }) {
  const saved = company?.verificationSeriesNames || {};
  const [names, setNames] = useState(saved);
  useEffect(() => { setNames(company?.verificationSeriesNames || {}); }, [company?.verificationSeriesNames]);
  const dirty = VERIFICATION_SERIES.some(l => (names[l] || '').trim() !== (saved[l] || '').trim());
  const save = () => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    const cleaned = Object.fromEntries(VERIFICATION_SERIES.map(l => [l, (names[l] || '').trim()]).filter(([, v]) => v));
    setCompanyInfo({ ...company, verificationSeriesNames: cleaned });
  };
  return (
    <>
      {VERIFICATION_SERIES.map((letter, i) => {
        const latest = getMaxUsedNumber(verifications, letter);
        return (
          <SettingRow
            key={letter}
            label={`${tr('ui.serie')} ${letter}`}
            description={latest > 0 ? tr('ui.senaste_nr', { n: latest }) : tr('ui.inga_verifikat_annu')}
            last={i === VERIFICATION_SERIES.length - 1}
          >
            <input
              value={names[letter] || ''}
              onChange={e => setNames(n => ({ ...n, [letter]: e.target.value }))}
              placeholder={tr(`ui.serienamn_${letter}`)}
              aria-label={`${tr('ui.serie')} ${letter}`}
              style={{ ...inputBase, width: '260px' }}
            />
          </SettingRow>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
        <button type="button" onClick={save} disabled={!dirty} style={{ ...btnPrimary, opacity: dirty ? 1 : 0.45, cursor: dirty ? 'pointer' : 'not-allowed' }}>
          {tr('ui.spara_namn')}
        </button>
      </div>
    </>
  );
}

// ── Händelselogg (System > Händelselogg) ── Läser audit_log (supabase-
// setup.sql), skriven av logAuditEvent (utils/auditLog.js) vid varje
// instrumenterad handling (se anropen i den här filen: företagsuppgifter,
// användarinbjudan, prenumeration m.fl.).
function AuditLogCard({ company, readOnly = false }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (readOnly || !company?.id) { setEvents([]); return; }
    let cancelled = false;
    supabase
      .from('audit_log')
      .select('id, actor_email, description, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setEvents(data || []);
      });
    return () => { cancelled = true; };
  }, [company?.id, readOnly]);

  return (
    <div>
      {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '10px' }}>{error}</div>}
      {events === null ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tr('ui.laser_in_2')}</div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tr('ui.inga_handelser_loggade_annu')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((e, i) => (
            <SettingRow key={e.id} label={e.description} description={`${e.actor_email} · ${dateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.created_at))}`} last={i === events.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fakturamall-väljare (Sida 24) ──
// Valt mall-id sparas som `company.invoiceTemplateId` (företagsnivå, samma
// jsonb-företagsobjekt som redan rond-trippar till Supabase för logotyp/
// bankuppgifter etc — ingen separat tabell behövs). Redan sparade fakturor
// fryser sitt utseende vid sparningstillfället (se invoiceTemplateSnapshot
// i Invoices.jsx) — ett mallbyte här påverkar bara FRAMTIDA fakturor.
// (Tidigare stod här en FAST, för hand uträknad mobil-skala för
// TemplateThumb — se dess egen kommentar för varför den byttes mot en
// ResizeObserver som mäter riktig containerbredd istället.)
function InvoiceTemplateSection({ company, setCompanyInfo, user, readOnly = false }) {
  const isMobile = useIsMobileViewport();
  const selectedId = company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE;
  const activeTpl = INVOICE_TEMPLATES[selectedId] || INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
  const accentColor = company?.invoiceAccentColor || activeTpl.defaultAccent;

  // Kundönskemål: en riktig, läsbar förhandsgranskning av fakturan direkt
  // från mallvalet — inte bara den lilla, nedskalade "Live-förhandsvisning"-
  // tumnageln (254-476px bred beroende på breakpoint, olæslig på en
  // telefon). Samma fullskärms-.a4-document-preview-mönster och
  // +/--zoomkontroller som redan finns i fakturaredigeraren (Invoices.jsx)
  // — samma InvoiceDocument-komponent, bara med exempeldata (SAMPLE_ROWS
  // m.fl.) istället för en riktig fakturas rader.
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  // Kundönskemål: "man ska kunna se hela fakturan på mobilen" — .a4-paper
  // är en riktig 210mm-bred sida (~794px), vilket bara ryms halvvägs på en
  // telefonskärm vid 100% zoom. 100% är fortfarande rätt default på desktop
  // (skärmen är bredare än sidan där), men på mobil öppnar vi nu på samma
  // 0.5x-golv som zoom-ut-knappen ändå stannar vid, så hela sidans BREDD
  // syns direkt istället för att kräva två-tre tryck på zoom-ut först.
  useEffect(() => { if (showFullPreview) setPreviewZoom(isMobile ? 0.5 : 1); }, [showFullPreview, isMobile]);

  const previewProps = {
    invoice: SAMPLE_INVOICE, customer: SAMPLE_CUSTOMER, company, rows: SAMPLE_ROWS, totals: SAMPLE_TOTALS,
    currency: 'SEK', logoUrl: company?.logoUrl, logoSize: company?.invoiceLogoSize || 'medium', showCompanyName: company?.invoiceShowCompanyName ?? false, footerText: company?.invoiceFooterText, accentColor,
  };

  return (
    <>
      <div style={card}>
        <div style={{ marginBottom: '6px' }}><SectionHeading icon={Palette} tone="pink">{tr('ui.valj_mall')}</SectionHeading></div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>
          {tr('ui.valj_utseendet_pa_dina_utgaende_kund_och_leveran')}
        </p>
        {/* Bugkritiskt: satt tidigare fast till exakt 2 kolumner (`.form-row-2`)
            inom ett `maxWidth: 720px`-tak — på en bred skärm lämnade det ett
            enormt tomt fält till höger i det annars fullbreda kortet. Ingen
            maxWidth-spärr längre, och auto-fill låter fler mallkort få plats
            per rad ju bredare fönstret är, istället för att bara två kort
            flyter i en smal remsa mitt i kortet. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {Object.values(INVOICE_TEMPLATES).map(tpl => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              selected={selectedId === tpl.id}
              onSelect={() => setCompanyInfo({ ...company, invoiceTemplateId: tpl.id })}
              previewProps={{ ...previewProps, accentColor: company?.invoiceAccentColor || tpl.defaultAccent }}
            />
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="pink">{tr('ui.anpassa_mallen')}</SectionHeading></div>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', maxWidth: '380px' }}>
            <div style={{ marginBottom: '18px' }}>
              <ImageUploadField label={tr('ui.logotyp')} value={company?.logoUrl || ''} onChange={(v) => setCompanyInfo({ ...company, logoUrl: v })} uploadPath={`${user?.id}/logo-${company?.id}`} bucket="companylogo" hint={tr('ui.jpg_eller_png_max_3_mb')} readOnly={readOnly} />
            </div>

            {/* Storlek och namn bredvid logotypen (InvoiceDocument.jsx). Sparas
                i fakturans mallögonblicksbild som mallen och färgen. */}
            {company?.logoUrl && (
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>{tr('ui.logotypens_storlek')}</label>
                <div role="radiogroup" aria-label={tr('ui.logotypens_storlek')} style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {[['small', tr('ui.liten')], ['medium', tr('ui.mellan')], ['large', tr('ui.stor')]].map(([id, label]) => {
                    const active = (company?.invoiceLogoSize || 'medium') === id;
                    return (
                      <button
                        key={id} type="button" role="radio" aria-checked={active} disabled={readOnly}
                        onClick={() => setCompanyInfo({ ...company, invoiceLogoSize: id })}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: readOnly ? 'default' : 'pointer', border: `1px solid ${active ? BRAND.green : 'var(--border)'}`, background: active ? 'var(--bg-subtle, var(--bg-page))' : 'var(--bg-card)', color: 'var(--text-main)' }}
                      >{label}</button>
                    );
                  })}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: readOnly ? 'default' : 'pointer' }}>
                  <span>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{tr('ui.visa_foretagsnamnet_vid_logotypen')}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{tr('ui.visa_foretagsnamnet_vid_logotypen_desc')}</span>
                  </span>
                  <ToggleSwitch
                    checked={company?.invoiceShowCompanyName ?? false}
                    onChange={(e) => setCompanyInfo({ ...company, invoiceShowCompanyName: e.target.checked })}
                    disabled={readOnly}
                  />
                </label>
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>{tr('ui.accentfarg')}</label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>{tr('ui.din_egen_varumarkesfarg_pa_fakturan_fritt_val_in')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color" value={accentColor}
                  onChange={e => setCompanyInfo({ ...company, invoiceAccentColor: e.target.value })}
                  style={{ width: '44px', height: '36px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'var(--bg-card)' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{accentColor}</span>
                <button
                  type="button" onClick={() => setCompanyInfo({ ...company, invoiceAccentColor: BRAND.green })}
                  title={tr('ui.anvand_bokix_gront_som_accentfarg')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: BRAND.green, display: 'inline-block' }} /> {tr('ui.bokix_gront')}
                </button>
              </div>
            </div>

            <AutoField label={tr('ui.tillaggsinformation_fottext')} value={company?.invoiceFooterText || ''} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} hint={tr('ui.visas_langst_ner_pa_fakturan_t_ex_betalningsvill')} />
          </div>

          {/* minWidth 300px (mobil: 0) — annars vann minWidth-golvet över
              flexWrap på en 375px-skärm och tvingade förhandsvisningen
              lika brett-överskuret som gallerikorten ovan gjorde. */}
          <div style={{ flex: 1, minWidth: isMobile ? 0 : '300px', maxWidth: '500px', width: isMobile ? '100%' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('ui.live_forhandsvisning')}</div>
              <button
                type="button" onClick={() => setShowFullPreview(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: BRAND.greenDark, fontSize: '11.5px', fontWeight: 700, padding: '2px' }}
              >
                <Maximize2 size={12} /> {tr('ui.forhandsgranska')}
              </button>
            </div>
            {/* Tumnageln öppnar samma fullskärmsvy — en genväg för den som
                trycker direkt på bilden istället för att leta efter knappen. */}
            <div
              role="button" tabIndex={0} onClick={() => setShowFullPreview(true)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowFullPreview(true)}
              style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--border)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', cursor: 'pointer' }}
            >
              <TemplateThumb tplId={selectedId} previewProps={previewProps} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullskärms-förhandsgranskning — samma .a4-document-preview-
          mönster (och samma +/--zoom) som fakturaredigerarens egen
          "Förhandsgranska" i Invoices.jsx, så mallen faktiskt går att
          LÄSA istället för att skymta i en 254-476px tumnagel. ── */}
      {showFullPreview && (
        <div className="modal-overlay a4-preview-overlay" onClick={() => setShowFullPreview(false)}>
          <div className="modal-content a4-document-preview" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <h2 className="modal-title" style={{ margin: 0, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr('ui.forhandsgranskning')} {activeTpl.label}</h2>
                <button className="modal-close" onClick={() => setShowFullPreview(false)} style={{ flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tr('ui.exempeldata_sa_har_ser_mallen_ut_inte_en_riktig')}</span>
                <div style={{ flex: 1, minWidth: '8px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                    disabled={previewZoom <= 0.5} title={tr('ui.zooma_ut')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom <= 0.5 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom <= 0.5 ? 'not-allowed' : 'pointer' }}
                  ><ZoomOut size={14} /></button>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '38px', textAlign: 'center', flexShrink: 0 }}>{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    disabled={previewZoom >= 2} title={tr('ui.zooma_in')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom >= 2 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom >= 2 ? 'not-allowed' : 'pointer' }}
                  ><ZoomIn size={14} /></button>
                </div>
              </div>
            </div>
            <div style={{ overflow: 'auto', touchAction: 'pinch-zoom' }}>
              <div style={{ zoom: previewZoom, transition: 'zoom 0.15s ease' }}>
                <InvoiceDocument template={selectedId} {...previewProps} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Användare och Åtkomst (max 3 per företag — ägare + upp till 2 inbjudna,
// se supabase-setup.sql: company_members) ──────────────────────────────────
// companyName/inviterName kommer från fält användaren själv äger och kan
// sätta till vad som helst (t.ex. "<a href=...>") — utan escaping hade det
// injicerats rakt in i mejlets HTML och skickats till en riktig kollega via
// Resend som om det kom från Bokix.
function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Bygger inbjudningsmejlets HTML — samma "Hej ... Med vänlig hälsning"-ton
// som fakturautskicket (Invoices.jsx), grönt CTA-knapp i samma märkesfärg.
function buildInviteEmailHtml({ companyName, inviterName, inviteUrl, role }) {
  const roleLabel = role === 'editor' ? 'redigera' : tr('ui.se_lasbehorighet');
  const safeInviter = escHtml(inviterName) || tr('ui.nagon');
  const safeCompany = escHtml(companyName) || tr('ui.sitt_foretag');
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p>Hej,</p>
      <p>${safeInviter} har bjudit in dig till <strong>${safeCompany}</strong> på Bokix — du kommer kunna ${roleLabel} företagets bokföring.</p>
      <p style="margin: 28px 0;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #0b6329; color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">Acceptera inbjudan</a>
      </p>
      <p style="font-size: 13px; color: #666;">Länken är giltig i 7 dagar. Har du redan ett Bokix-konto loggar du bara in — annars skapar du ett nytt.</p>
      <p>Med vänlig hälsning<br/>Bokix</p>
    </div>
  `;
}

const ROLE_LABELS = { editor: tr('ui.kan_redigera'), viewer: tr('ui.kan_bara_lasa') };
const STATUS_LABELS = { pending: tr('ui.vantar_pa_svar'), active: tr('ui.aktiv'), revoked: tr('ui.aterkallad') };
const STATUS_COLORS = {
  pending: { bg: BRAND.amberBg, text: BRAND.amberText },
  active: { bg: BRAND.greenLight, text: BRAND.greenDark },
  revoked: { bg: 'var(--border-light)', text: 'var(--text-muted)' },
};

function UsersAndAccessSection({ company, setCompanyInfo, user, firstName, lastName, sharedAccess, readOnly = false }) {
  // Roller & behörigheter (företagets sparade FÖRVAL per roll — se
  // defaultPageAccess i utils/pageAccess.js). Bara ägaren ser/ändrar detta;
  // en inbjuden gäst har ingen egen mall att sätta.
  const [editingRoleTemplate, setEditingRoleTemplate] = useState(null); // 'editor' | 'viewer' | null
  // Jag är ägaren om jag inte själv är en INBJUDEN gäst på det här
  // företaget (App.jsx skickar sharedAccess bara för ett delat företag).
  // Bara ägaren får bjuda in/ändra roll/återkalla — RLS (supabase-setup.sql)
  // stoppar det ändå server-side om någon skulle lura klienten, men UI:t
  // ska aldrig ens ERBJUDA knappar en inbjuden gäst inte får använda.
  const isOwner = !sharedAccess;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  // 'accountant' är ett förval i formuläret (utils/pageAccess.js) och sparas som redigerare.
  const [inviteRole, setInviteRole] = useState('editor');
  const inviteDbRole = inviteRole === ACCOUNTANT_PRESET ? 'editor' : inviteRole;
  // Sidbehörigheter (utils/pageAccess.js). Förvalet är allt utom lön —
  // ägaren ändrar fritt innan inbjudan skickas.
  const [invitePages, setInvitePages] = useState(() => defaultPageAccess('editor', company?.roleTemplates?.editor));
  // Vilken redan inbjuden persons behörigheter som är öppna för ändring.
  const [editingAccessId, setEditingAccessId] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  // Länk att skicka själv när mejlet inte gick iväg: { url, reason }.
  const [inviteLink, setInviteLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState('');
  const inviteUrlFor = (token, email) => `${window.location.origin}/invite?token=${token}&email=${encodeURIComponent(email)}`;
  const copyInviteLink = async (url) => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt(tr('ui.kopiera_lanken'), url); return; }
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(c => (c === url ? '' : c)), 2000);
  };

  const loadMembers = async () => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    // RLS avgör själv vad som faktiskt kommer tillbaka: ägaren ser hela
    // listan, en inbjuden gäst ser bara sin EGEN rad (se "Se egna
    // medlemskapsrader" i supabase-setup.sql) — inget extra filter behövs
    // här för att uppnå det, policyn gör jobbet.
    const { data, error } = await supabase
      .from('company_members')
      .select('id, invited_email, role, status, invited_at, expires_at, page_access, invite_token')
      .eq('company_id', company.id)
      .order('invited_at', { ascending: true });
    if (!error) setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Max 3 användare" = ägaren + högst 2 aktiva/väntande — samma gräns som
  // databasens INSERT-policy (company_members) redan hårdkodar, upprepad
  // här bara för att kunna visa/dölja "Bjud in"-knappen proaktivt istället
  // för att låta ett insert-försök alltid gå fram till servern och 403:a.
  const activeOrPendingCount = members.filter(m => m.status !== 'revoked').length;
  const atCap = activeOrPendingCount >= 2;

  // `viaLink`: skapa bara inbjudan och visa länken, inget mejl (t.ex. när
  // ägaren hellre skickar länken själv till sin redovisningskonsult).
  const handleInvite = async (e, viaLink = false) => {
    e.preventDefault();
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setInviteError(''); setInviteSuccess(''); setInviteLink(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { setInviteError(tr('ui.ange_en_giltig_e_postadress_2')); return; }
    setInviteBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from('company_members')
        .insert({ owner_user_id: user.id, company_id: company.id, invited_email: email, role: inviteDbRole, page_access: invitePages })
        .select()
        .single();
      if (error) throw error;

      // Skickar inbjudningsmejlet via samma Resend-relä som fakturautskick
      // (emailApi.js → api/email/send-invoice.js) — det bryr sig aldrig om
      // VILKET dokument som skickas, bara mottagare/ämne/HTML. Misslyckas
      // SJÄLVA UTSKICKET (t.ex. Resend nere) tas raden inte bort — ägaren
      // kan bjuda in igen, eller dela länken manuellt.
      const inviteUrl = inviteUrlFor(inserted.invite_token, email);
      if (viaLink) {
        setInviteLink({ url: inviteUrl, reason: '', viaLink: true });
        setInviteEmail('');
        setShowInviteForm(false);
        loadMembers();
        return;
      }
      const html = buildInviteEmailHtml({
        companyName: company.name,
        inviterName: [firstName, lastName].filter(Boolean).join(' ') || user?.email,
        inviteUrl,
        role: inviteDbRole,
      });
      try {
        await sendInvoiceEmail({
          to: email,
          subject: `Du är inbjuden till ${company.name || 'ett företag'} på Bokix`,
          html,
          company_id: company.id,
          invite_id: inserted.id,
        });
      } catch (sendErr) {
        console.error('Kunde inte skicka inbjudningsmejlet:', sendErr);
        setInviteLink({ url: inviteUrl, reason: sendErr?.message || '' });
        setInviteEmail('');
        setShowInviteForm(false);
        loadMembers();
        return;
      }

      setInviteSuccess(`Inbjudan skickad till ${email}.`);
      setInviteEmail('');
      setShowInviteForm(false);
      loadMembers();
    } catch (err) {
      const isDuplicate = err?.code === '23505';
      setInviteError(isDuplicate ? tr('ui.den_har_personen_ar_redan_inbjuden_till_foretage') : (err?.message || tr('ui.kunde_inte_skicka_inbjudan')));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRoleChange = async (memberId, role) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    await supabase.from('company_members').update({ role }).eq('id', memberId);
    loadMembers();
  };

  const handlePageAccessChange = async (memberId, pageAccess) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, page_access: pageAccess } : m)));
    await supabase.from('company_members').update({ page_access: pageAccess }).eq('id', memberId);
  };

  const handleRevoke = async (memberId) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    if (!(await confirmDialog(tr('ui.aterkalla_den_har_personens_atkomst_till_foretag'), { danger: true }))) return;
    await supabase.from('company_members').update({ status: 'revoked' }).eq('id', memberId);
    loadMembers();
  };

  // Tar bort en redan återkallad rad helt ur listan. Databasen tillåter
  // bara det för återkallade rader (policyn "Ägare tar bort återkallad
  // inbjudan"), så en aktiv medlem måste alltid återkallas först.
  const handleDeleteRevoked = async (memberId) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    if (!(await confirmDialog(tr('ui.ta_bort_aterkallad_inbjudan'), { danger: true }))) return;
    const { data: deleted, error } = await supabase.from('company_members').delete().eq('id', memberId).select('id');
    if (error || !deleted?.length) {
      console.error('Kunde inte ta bort inbjudan:', error);
      setInviteError(tr('ui.kunde_inte_ta_bort_inbjudan'));
      return;
    }
    loadMembers();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        {/* Rubriken kommer från SettingsSection ovanför — den här sa samma
            sak en gång till. Knappen ligger ensam till höger; den tomma
            platshållar-diven som höll isär dem är borta (den lade bara till
            en rad luft mellan rubriken och tabellen). */}
        {isOwner && (
          <button
            onClick={() => setShowInviteForm(v => !v)}
            disabled={atCap && !showInviteForm}
            title={atCap ? tr('ui.max_3_anvandare_per_foretag_agare_2_inbjudna_ate') : undefined}
            style={atCap ? { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--border)', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'not-allowed' } : btnPrimary}
          >
            <Mail size={16} style={{ marginRight: 6, verticalAlign: '-3px' }} /> {showInviteForm ? tr('ui.avbryt') : tr('ui.bjud_in_anvandare')}
          </button>
        )}
      </div>

      {isOwner && atCap && !showInviteForm && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>{tr('ui.max_3_anvandare_per_foretag_ar_natt_du_2_inbjudn')}</p>
      )}

      {isOwner && showInviteForm && (
        <form onSubmit={handleInvite} style={{ ...card, marginBottom: '16px' }}>
          <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
            <div>
              <label style={labelStyle}>{tr('ui.e_postadress')}</label>
              <input type="email" required autoFocus value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={inputBase} placeholder={tr('ui.namn_exempel_se')} />
            </div>
            <div>
              <label style={labelStyle}>{tr('ui.roll')}</label>
              <select
                value={inviteRole}
                onChange={e => {
                  const next = e.target.value;
                  setInviteRole(next);
                  setInvitePages(next === ACCOUNTANT_PRESET ? accountantPageAccess() : defaultPageAccess(next, company?.roleTemplates?.[next]));
                }}
                style={inputBase}
              >
                <option value="editor">{tr('ui.kan_redigera')}</option>
                <option value="viewer">{tr('ui.kan_bara_lasa')}</option>
                <option value={ACCOUNTANT_PRESET}>{tr('ui.roll_revisor')}</option>
              </select>
              {inviteRole === ACCOUNTANT_PRESET && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{tr('ui.roll_revisor_hint')}</p>
              )}
            </div>
          </div>

          {/* Kundönskemål: "man ska kunna välja vilka sidor hen kan se och
              redigera". Rollen är taket, listan nedan är detaljerna. */}
          <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
            <PageAccessPicker
              value={invitePages}
              role={inviteDbRole}
              onChange={setInvitePages}
            />
          </div>
          {inviteError && <p style={{ color: BRAND.redText, fontSize: '13px', marginTop: '10px' }}>{inviteError}</p>}
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={inviteBusy} style={{ ...btnPrimary, opacity: inviteBusy ? 0.6 : 1 }}>{inviteBusy ? tr('ui.skickar_2') : tr('ui.skicka_inbjudan')}</button>
            <button type="button" disabled={inviteBusy} onClick={e => handleInvite(e, true)} style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '6px', opacity: inviteBusy ? 0.6 : 1 }}><Copy size={14} />{tr('ui.skapa_lank_i_stallet')}</button>
            <button type="button" onClick={() => setShowInviteForm(false)} style={btnSecondary}>{tr('ui.avbryt')}</button>
          </div>
        </form>
      )}

      {inviteLink && (
        <div style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', maxWidth: '560px' }}>
          <div style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>{inviteLink.viaLink ? tr('ui.inbjudningslank_skapad') : tr('ui.inbjudan_skapad_mejl_ej')}</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
            {tr('ui.skicka_lanken_sjalv')}{inviteLink.reason ? ` (${inviteLink.reason})` : ''}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input readOnly value={inviteLink.url} onFocus={e => e.target.select()} style={{ ...inputBase, flex: 1, minWidth: 0, fontSize: '13px', padding: '8px 10px', textOverflow: 'ellipsis' }} />
            <button type="button" onClick={() => copyInviteLink(inviteLink.url)} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copiedLink === inviteLink.url ? <Check size={15} /> : <Copy size={15} />}
              {copiedLink === inviteLink.url ? tr('ui.kopierad_kort') : tr('ui.kopiera_lanken')}
            </button>
          </div>
        </div>
      )}

      {inviteSuccess && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
          <Check size={15} style={{ flexShrink: 0, marginTop: '1px' }} /> <span>{inviteSuccess}</span>
        </div>
      )}

      <ListTable
        rowKey={row => row.id}
        rows={[{ id: '__owner__', isOwnerRow: true }, ...members]}
        columns={[
          {
            key: 'user', label: tr('ui.anvandare'), wrap: true, render: row => row.isOwnerRow ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{isOwner ? ([firstName, lastName].filter(Boolean).join(' ') || tr('ui.ditt_konto_2')) : tr('ui.agare')}</div>
                {isOwner && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.email}</div>}
              </div>
            ) : (
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.invited_email}</div>
            ),
          },
          {
            key: 'role', label: tr('ui.roll'), render: row => row.isOwnerRow ? tr('ui.administrator') : (
              isOwner && row.status !== 'revoked' ? (
                <select value={row.role} onChange={e => handleRoleChange(row.id, e.target.value)} style={{ ...inputBase, width: 'auto', padding: '4px 8px', fontSize: '13px' }}>
                  <option value="editor">{tr('ui.kan_redigera')}</option>
                  <option value="viewer">{tr('ui.kan_bara_lasa')}</option>
                </select>
              ) : ROLE_LABELS[row.role] || row.role
            ),
          },
          {
            key: 'status', label: tr('ui.status'), render: row => row.isOwnerRow ? (
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.greenLight, color: BRAND.greenDark }}>{tr('ui.aktiv')}</span>
            ) : (
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: STATUS_COLORS[row.status]?.bg, color: STATUS_COLORS[row.status]?.text }}>
                {STATUS_LABELS[row.status] || row.status}
              </span>
            ),
          },
          ...(isOwner ? [{
            key: 'access', label: tr('ui.sidor'), align: 'right', render: row => (!row.isOwnerRow && row.status !== 'revoked') ? (
              <button
                type="button"
                onClick={() => setEditingAccessId(editingAccessId === row.id ? null : row.id)}
                style={btnTile}
              >
                {editingAccessId === row.id ? tr('ui.dolj') : tr('ui.andra')}
              </button>
            ) : null,
          }] : []),
          ...(isOwner ? [{
            key: 'actions', label: '', align: 'right', render: row => (!row.isOwnerRow && row.status === 'revoked') ? (
              <button onClick={() => handleDeleteRevoked(row.id)} title={tr('ui.ta_bort')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Trash2 size={15} />
              </button>
            ) : (!row.isOwnerRow && row.status !== 'revoked') ? (
              <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                {/* Väntande inbjudan: länken går alltid att hämta igen. */}
                {row.status === 'pending' && row.invite_token && (() => {
                  const url = inviteUrlFor(row.invite_token, row.invited_email);
                  return (
                    <button onClick={() => copyInviteLink(url)} title={tr('ui.kopiera_inbjudningslanken')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedLink === url ? BRAND.greenDark : 'var(--text-muted)' }}>
                      {copiedLink === url ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  );
                })()}
                <button onClick={() => handleRevoke(row.id)} title={tr('ui.aterkalla_atkomst')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : null,
          }] : []),
        ]}
      />
      {/* Behörighetspanelen för den medlem man valt — under tabellen i
          stället för inuti en cell, så den får plats att vara läsbar. */}
      {isOwner && editingAccessId && (() => {
        const member = members.find(m => m.id === editingAccessId);
        if (!member) return null;
        return (
          <div style={{ marginTop: '14px', padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
              {tr('ui.sidor_for')} {member.invited_email}
            </div>
            <PageAccessPicker
              value={member.page_access}
              role={member.role}
              onChange={(next) => handlePageAccessChange(member.id, next)}
              compact
            />
            <div style={{ marginTop: '12px' }}>
              <button type="button" onClick={() => setEditingAccessId(null)} style={btnSecondary}>{tr('ui.klar')}</button>
            </div>
          </div>
        );
      })()}

      {!loading && members.length === 0 && isOwner && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px' }}>{tr('ui.inga_andra_anvandare_inbjudna_annu')}</p>
      )}
      {isOwner ? (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px', maxWidth: '560px' }}>{tr('ui.max_3_anvandare_per_foretag_du_2_inbjudna_rollen')}</p>
      ) : (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px', maxWidth: '560px' }}>{tr('ui.du_har_blivit_inbjuden_till_det_har_foretaget_av')}{ROLE_LABELS[sharedAccess.role] || sharedAccess.role}{tr('ui.behorighet')}</p>
      )}

      {/* Roller & behörigheter — sparar FÖRVALET för NYA inbjudningar, inte
          en specifik persons behörighet (det gör "Sidor"-knappen på
          medlemsraden ovan, ograverad). Bara ägaren ser detta. */}
      {isOwner && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.roller_behorigheter')}</div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '3px 0 0', maxWidth: '560px' }}>{tr('ui.satt_vilka_sidor_en_ny_inbjudan_far_som_forval_p')}</p>
          </div>
          {editingRoleTemplate ? (
            <div>
              <PageAccessPicker
                value={company?.roleTemplates?.[editingRoleTemplate] || defaultPageAccess(editingRoleTemplate)}
                role={editingRoleTemplate}
                onChange={(next) => setCompanyInfo({ ...company, roleTemplates: { ...(company?.roleTemplates || {}), [editingRoleTemplate]: next } })}
              />
              <div style={{ marginTop: '12px' }}>
                <button type="button" onClick={() => setEditingRoleTemplate(null)} style={btnSecondary}>{tr('ui.klar')}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['editor', 'viewer'].map(role => (
                <button key={role} type="button" onClick={() => setEditingRoleTemplate(role)} style={btnTile}>
                  {ROLE_LABELS[role]} {tr('ui.andra_forval')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const fmtDateSv = (d) => {
  if (!d) return '—';
  try { return dateTimeFormat(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)); } catch { return d; }
};

const SUBSCRIPTION_STATUS_LABELS = {
  trialing: tr('ui.provperiod'), active: tr('ui.aktiv'), past_due: tr('ui.betalning_misslyckades_forsoker'),
  canceled: tr('ui.avslutad'), unpaid: tr('ui.obetald'), incomplete: tr('ui.ofullstandig'), incomplete_expired: tr('ui.utgangen'),
};

/** Knappen för prenumerationens fakturor hämtar historiken för alla företag
 * på kontot. Kortbytesknappen går fortsatt till Stripes Billing Portal. */
function BillingPortalButton({ companyId, label, showInvoices = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState(null);
  const open = async () => {
    setBusy(true); setError('');
    try {
      if (showInvoices) {
        if (invoices !== null) {
          setInvoices(null);
          return;
        }
        setInvoices(await getSubscriptionInvoices());
        return;
      }
      const url = await openBillingPortal(companyId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || tr('ui.kunde_inte_oppna_betalningsportalen'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" onClick={open} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>
        {showInvoices ? <Download size={14} style={{ verticalAlign: 'middle', marginRight: '7px' }} /> : <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: '7px' }} />}
        {busy ? tr('ui.laddar') : showInvoices && invoices !== null ? tr('ui.dolj_fakturor') : label}
      </button>
      {error && <div style={{ fontSize: '12px', color: 'var(--status-red-text)', marginTop: '6px' }}>{error}</div>}
      {invoices && (
        <div style={{ width: 'min(680px, calc(100vw - 48px))', marginTop: '12px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', background: 'var(--bg-muted)' }}>
            {tr('ui.prenumerationsfakturor_kvitton')}
          </div>
          {invoices.length === 0 ? (
            <p style={{ margin: 0, padding: '14px', color: 'var(--text-secondary)', fontSize: '13px' }}>{tr('ui.inga_prenumerationsfakturor')}</p>
          ) : (
            <div>
              {invoices.map((invoice, index) => {
                const amount = invoice.status === 'paid' ? invoice.amount_paid : invoice.amount_due;
                const currency = (invoice.currency || 'sek').toUpperCase();
                const formattedAmount = numberFormat(getLanguage(), { style: 'currency', currency }).format((amount || 0) / 100);
                const statusLabel = invoice.status === 'paid'
                  ? tr('ui.betald')
                  : invoice.status === 'draft'
                    ? tr('ui.utkast')
                    : invoice.status === 'void'
                      ? tr('ui.faktura_makulerad')
                      : invoice.status === 'open' || invoice.status === 'uncollectible'
                        ? tr('ui.obetald')
                        : invoice.status;
                return (
                  <div key={invoice.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 14px', borderTop: index === 0 ? 'none' : '1px solid var(--border-light)' }}>
                    <div style={{ minWidth: '180px', flex: 1 }}>
                      <div style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>
                        {invoice.number || invoice.id} · {formattedAmount}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>
                        {new Date(invoice.created * 1000).toLocaleDateString(getLanguage())} · {statusLabel}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {invoice.hosted_invoice_url && (
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.greenDark, fontSize: '12.5px', fontWeight: 600 }}>
                          {tr('ui.visa_faktura')}
                        </a>
                      )}
                      {invoice.invoice_pdf && (
                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.greenDark, fontSize: '12.5px', fontWeight: 600 }}>
                          {tr('ui.ladda_ner_kvitto')}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Användning (Prenumeration) — räknat helt klientsidan ur redan inläst
 * state, ingen egen mätning/backend behövs för de här enkla räknarna. */
function UsageCard({ invoices, verifications, contacts, expenses }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const countThisMonth = (list, dateField) => list.filter(x => (x?.[dateField] || '').startsWith(thisMonth)).length;
  const rows = [
    { label: tr('ui.fakturor_skapade_denna_manad'), value: countThisMonth(invoices, 'date') },
    { label: tr('ui.fakturor_totalt'), value: invoices.length },
    { label: tr('ui.bokforda_verifikationer_totalt'), value: verifications.length },
    { label: tr('ui.kvitton_underlag_totalt'), value: expenses.length },
    { label: tr('ui.kunder_och_leverantorer'), value: contacts.length },
  ];
  return (
    <SettingCard>
      {rows.map((r, i) => (
        <SettingRow key={r.label} label={r.label} last={i === rows.length - 1}>
          <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{r.value}</strong>
        </SettingRow>
      ))}
    </SettingCard>
  );
}

/** Inställningar → Prenumeration. Läser kontots EGEN rad i
 * public.subscriptions (RLS: bara sin egen, se supabase-setup.sql) och ger
 * en riktig väg att avsluta/återaktivera — se api/stripe/create-
 * subscription-checkout.js (action: 'cancel'/'reactivate'). Ersätter den
 * tidigare statiska platshållartexten som alltid stod kvar oavsett faktisk
 * status, och som gjorde TermsPolicy.jsx:s löfte ("Uppsägning sker under
 * Inställningar i tjänsten") osant i praktiken. */
// Gratisperioden för ett UF-konto, som den ser ut i Inställningar →
// Prenumeration. Räknar aldrig själv: ufFreePeriod (utils/ufMode.js) är
// samma uträkning som betalspärren vid inloggning använder, så kortet
// aldrig kan säga "12 dagar kvar" om spärren redan tycker att perioden
// löpt ut.
function UfSubscriptionCard({ company, canClose = true }) {
  const period = ufFreePeriod(company?.ufStartedAt);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  // Klara med UF-året före gratisperiodens slut? Samma avslut som i
  // betalspärren (utils/ufClose.js). Efteråt laddas appen om, så att den
  // skrivskyddade vyn med raderingsdatumet visas.
  const handleClose = async () => {
    setCloseError('');
    setClosing(true);
    try {
      const result = await closeUfYear();
      if (result) window.location.reload();
      else setClosing(false);
    } catch (err) {
      setCloseError(err.message);
      setClosing(false);
    }
  };
  const endsLabel = period.endsAt
    ? dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(period.endsAt)
    : null;
  const daysLabel = typeof period.daysLeft === 'number' ? ' (' + period.daysLeft + ' dagar kvar)' : '';
  return (
    <SettingCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: BRAND.greenLight, color: BRAND.greenDark, fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {tr('ui.uf_konto')}
        </span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.gratis')}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {period.expired ? (
          <>{tr('ui.gratisperioden_pa')} {UF_FREE_MONTHS} {tr('ui.manader_tog_slut')} {endsLabel}{tr('ui.vill_ni_fortsatta_valjer_ni_en_prenumeration_ann')}</>
        ) : period.known ? (
          <>{tr('ui.gratis_till_och_med')} <strong style={{ color: 'var(--text-main)' }}>{endsLabel}</strong>{daysLabel}{tr('ui.inga_betaluppgifter_ar_registrerade_och_ingentin')}</>
        ) : (
          <>{tr('ui.kontot_ar_gratis_i')} {UF_FREE_MONTHS} {tr('ui.manader_inga_betaluppgifter_ar_registrerade_och')}</>
        )}
      </div>
      {canClose && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{tr('ui.klara_med_uf_aret')}</div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 10px' }}>
            {tr('ui.avsluta_kontot_nar_ni_ar_klara_ni_kan_ladda_ner')}
          </p>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={closing}>
            {closing ? tr('ui.avslutar') : tr('ui.avsluta_uf_aret')}
          </button>
          {closeError && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', fontWeight: 600, marginTop: '8px' }}>{closeError}</div>}
        </div>
      )}
    </SettingCard>
  );
}

function SubscriptionSection({ user, company, sharedAccess, readOnly = false }) {
  // Samma "jag är ägare om jag inte är en inbjuden gäst"-regel som
  // UsersAndAccessSection ovan. En inbjuden gäst rider på ÄGARENS
  // prenumeration (App.jsx: hasSharedAccess) och har ingen egen rad att
  // avsluta här.
  const isOwner = !sharedAccess;
  // Betala-per-företag (kundkrav): '' = kontots legacy-rad (allt som fanns
  // innan denna ändring, samt kontots första företag), ett riktigt id =
  // det AKTIVA företagets EGNA rad — se supabase-setup.sql:s kommentar vid
  // public.subscriptions. Sidan visar/hanterar alltså alltid DET företag
  // man just nu står på, inte kontot som helhet.
  const companyId = company?.requiresOwnPayment ? company.id : '';

  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loadSubscription = async () => {
    if (readOnly || !isOwner || !user?.id) { setLoading(false); return; }
    setLoading(true);
    // .eq('company_id', companyId) krävs numera — utan den matchar frågan
    // ALLA företags rader för kontot, och .maybeSingle() kraschar så fort
    // det finns mer än en (dvs. så fort ett andra företag köpts).
    const { data } = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .maybeSingle();
    setSub(data || null);
    setLoading(false);
  };

  useEffect(() => { loadSubscription(); }, [user?.id, isOwner, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setBusy(true); setError('');
    try {
      await cancelStripeSubscription(companyId || null);
      await loadSubscription();
      setConfirmCancel(false);
    } catch (err) {
      setError(err.message || tr('ui.kunde_inte_avsluta_prenumerationen_forsok_igen_o'));
    } finally {
      setBusy(false);
    }
  };

  const handleReactivate = async () => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setBusy(true); setError('');
    try {
      await reactivateStripeSubscription(companyId || null);
      await loadSubscription();
    } catch (err) {
      setError(err.message || tr('ui.kunde_inte_ateraktivera_prenumerationen_forsok_i'));
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Shield size={20} style={{ color: BRAND.green, flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '520px' }}>
            {tr('ui.du_har_atkomst_till_det_har_foretaget_via_en_inb')}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={card}><div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tr('ui.laser_in')}</div></div>;
  }

  if (!sub) {
    // Inget abonnemang ännu. I stället för en tom rad text: vad de två
    // nivåerna kostar och vad som skiljer dem — samma katalog som prissidan
    // läser (utils/plans.js), aldrig en egen kopia av priserna.
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 18px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '14px' }}>
          <Shield size={18} style={{ color: BRAND.green, flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {tr('ui.ingen_betald_plan_ar_kopplad_till_det_har_foreta')}
          </div>
        </div>
        {/* Egen, smalare kolumnbredd än settings-grid: nivåkorten ligger i
            den vänstra halvan av prenumerationsfliken och ska ändå få plats
            bredvid varandra. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '12px' }}>
          {PLAN_TIERS.map(tier => (
            <div
              key={tier.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
                padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${BRAND.green}, #0a4d20)` }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '10px', background: BRAND.greenLight, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {tier.includesPayroll ? <Users size={16} style={{ color: BRAND.greenDark }} /> : <Shield size={16} style={{ color: BRAND.greenDark }} />}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-voice)', fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{tier.name}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tier.subtitle}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{tier.monthlyPrice}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tr('ui.kr_man_2')}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>· {tier.yearlyMonthlyPrice} {tr('ui.kr_man_pa_arsplan')}</span>
              </div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {[
                  tr('ui.plan_rad_bokforing'),
                  tr('ui.plan_rad_rapporter'),
                  tier.includesPayroll ? tr('ui.loner_och_arbetsgivardeklaration') : null,
                ].filter(Boolean).map(row => (
                  <div key={row} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <Check size={13} style={{ color: BRAND.green, flexShrink: 0 }} /> {row}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isTrialing = sub.status === 'trialing';
  const endDate = isTrialing ? sub.trial_ends_at : sub.current_period_end;
  // Priset här stod hårdkodat som "179 kr/mån" — alltså fel belopp för
  // alla utom "Med personal, månadsvis", sedan nivåerna infördes. Nu läses
  // det ur planen som faktiskt sparats på prenumerationsraden. Saknas den
  // (konton som skapades innan nivåerna fanns) gäller 179 kr, av exakt
  // samma skäl som planIncludesPayroll ger dem full funktionalitet.
  const plan = planFromId(sub.plan);
  const priceLabel = tr('ui.kr_man', { v0: plan ? plan.price : 179 });
  const statusBadge = sub.cancel_at_period_end
    ? { bg: 'var(--status-amber-bg)', text: 'var(--status-amber-text)', label: tr('ui.avslutas') }
    : (sub.status === 'active' || sub.status === 'trialing')
      ? { bg: 'var(--status-green-bg)', text: 'var(--status-green-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status }
      : { bg: 'var(--status-red-bg)', text: 'var(--status-red-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Planen som ett riktigt plankort — kundönskemål ("gör den mycket
          mer aptitlig"): den tidigare versionen var ett platt vitt kort,
          samma yta som varenda annan inställningsrad. Ett mörkgrönt
          gradient-huvud (samma märkesgrönt som sidopanelen/loggan,
          BRAND.green) ger planen en egen, firad yta i stället för att
          smälta in — statusen/priset i vitt ovanpå, funktionerna i ett
          ljust kort under. */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '18px',
        overflow: 'hidden', boxShadow: '0 4px 20px -8px color-mix(in srgb, var(--accent) 28%, transparent)',
      }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, ${BRAND.green}, #0a4d20)`,
          padding: '24px 26px',
        }}>
          {/* Dekorativ glow, samma trick som Dashboardens KPI-kort — en
              ren yta hade känts platt trots gradienten. */}
          <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div className="settings-main" style={{ minWidth: 0, flex: '1 1 220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: 'white', background: 'rgba(255,255,255,0.16)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <Sparkles size={12} /> {tr('ui.din_plan')}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, background: statusBadge.bg, color: statusBadge.text }}>{statusBadge.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <span style={{ fontFamily: 'var(--font-voice)', fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                  {tr('ui.bokix')}{plan ? ' ' + plan.name : ''}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{priceLabel}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.82)', maxWidth: '520px', marginTop: '8px', lineHeight: 1.6 }}>
                {sub.cancel_at_period_end
                  ? <>{tr('ui.avslutas')} {fmtDateSv(endDate)}{tr('ui.du_har_full_atkomst_fram_till_dess_sedan_tas_ing')}</>
                  : isTrialing
                    ? <>{tr('ui.kostnadsfri_provperiod_till')} {fmtDateSv(endDate)}{tr('ui.darefter')} {priceLabel} {tr('ui.automatiskt_2')}</>
                    : sub.status === 'past_due'
                      ? <>{tr('ui.senaste_betalningen_misslyckades_stripe_forsoker')}</>
                      : <>{tr('ui.fornyas_automatiskt')} {fmtDateSv(endDate)}.</>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              {!sub.cancel_at_period_end && sub.status !== 'canceled' && !confirmCancel && (
                <button onClick={() => setConfirmCancel(true)} style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{tr('ui.avsluta')}</button>
              )}
              {sub.cancel_at_period_end && (
                <button onClick={handleReactivate} disabled={busy} style={{ border: 0, background: 'white', color: BRAND.greenDark, borderRadius: '10px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? tr('ui.ateraktiverar') : tr('ui.angra_uppsagning')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vad planen ger. Lönemodulen är den enda riktiga skillnaden mellan
            nivåerna (se utils/plans.js), så den står som en egen rad i
            stället för att gömmas i en punktlista alla planer delar. */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 24px', display: 'grid', gap: '10px' }}>
          {[
            { text: tr('ui.plan_rad_bokforing'), included: true },
            { text: tr('ui.plan_rad_rapporter'), included: true },
            { text: tr('ui.loner_och_arbetsgivardeklaration'), included: plan ? plan.includesPayroll : true },
            { text: tr('ui.upp_till_tre_anvandare_per_foretag'), included: true },
          ].map(row => (
            <div key={row.text} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', color: row.included ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {row.included
                ? <CheckCircle2 size={16} style={{ color: BRAND.green, flexShrink: 0 }} />
                : <X size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span style={{ textDecoration: row.included ? 'none' : 'line-through' }}>{row.text}</span>
              {!row.included && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tr('ui.ingar_i_med_personal')}</span>}
            </div>
          ))}
        </div>
      </div>

      {confirmCancel && (
        <div style={{ padding: '16px 18px', background: 'var(--status-red-bg)', borderRadius: '14px' }}>
          <div style={{ fontSize: '13.5px', color: 'var(--status-red-text)', fontWeight: 700, marginBottom: '4px' }}>{tr('ui.avsluta_prenumerationen')}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px', lineHeight: 1.6 }}>
            {tr('ui.du_behaller_full_atkomst_till_och_med')} {fmtDateSv(endDate)}{tr('ui.redan_betald_tid_aterbetalas_inte_men_inget_mer')}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleCancel} disabled={busy} style={{ ...btnDanger, opacity: busy ? 0.6 : 1 }}>
              {busy ? tr('ui.avslutar') : tr('ui.ja_avsluta')}
            </button>
            <button onClick={() => setConfirmCancel(false)} disabled={busy} style={btnGhost}>{tr('ui.behall_prenumerationen')}</button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

export default function Settings({
  company = {}, setCompanyInfo, accounts = [], verifications = [], invoices = [], quotes = [], expenses = [],
  contacts = [], projects = [], onImport, onReset, onBulkImportSie, onRepairSieOpenings, onDeleteSieImport, onCloseImportedYears, onOpenRotRutImport, enabledFeatures = null, onAttachVerificationFiles, stripeAccountId, onConnectStripe, onDisconnectStripe,
  zettleConnected = false, onConnectZettle,
  user,
  // Hjälp och Logga ut ligger i Inställningar på telefon (på dator finns de
  // längst ned i sidomenyn). Skickas inte ned i landningssidans demo.
  onOpenHelp, onLogout,
  activeCompanyId,
  // Radera företag (Avancerat) — samma handler App.jsx redan underhåller,
  // bara utan en UI som anropar den sedan företagsväxlaren togs bort.
  onDeleteCompany,
  // Färgtema/Kompakt layout (Utseende) — localStorage + attribut på <html>,
  // ägda av App.jsx, exakt samma mönster som tema/sidopanel ovan.
  density = 'normal', onSetDensity,
  // Tema-preferensen kan vara 'system' (se App.jsx) — `theme` nedan förblir
  // det FAKTISKT tillämpade värdet, som allt annat i den här filen redan
  // förväntar sig.
  themePreference = 'dark', onSetThemePreference,
  // Desktop-scrollbar på/av (Sida: "have in setting users chose to have
  // scroll bar or not in desktop") — state/localStorage/attributet på
  // <html> ägs av App.jsx (samma mönster som `theme`/`toggleTheme`), den
  // här komponenten visar bara växeln. hideScrollbar=false (scrollbaren
  // syns, webbläsarens standard) om App.jsx av något skäl inte skickar ner
  // den — t.ex. landningssidans demo, se DemoWorkspace.jsx.
  hideScrollbar = false, onToggleHideScrollbar,
  // Sidomenyns färg i ljust läge — se index.css (data-sidebar-style) och
  // App.jsx (sidebarStyle/toggleSidebarStyle) för resten av mekaniken.
  sidebarStyle = 'green', onToggleSidebarStyle,
  // Satt av App.jsx (currentCompany.__shared) bara när det AKTIVA företaget
  // är någon ANNANS som jag blivit inbjuden till — se UsersAndAccessSection.
  sharedAccess = null,
  // Landningssidans demo (DemoWorkspace.jsx) monterar den HÄR, riktiga
  // Inställningar-sidan (istället för en handbyggd efterlikning) så en
  // besökare kan se den på riktigt, men utan inloggning finns ingen
  // session att spara mot — readOnly stänger av det enda stället i den
  // här filen som annars skulle göra ett Supabase-anrop direkt vid mount
  // (TwoFactorSection nedan), inte bara vid klick.
  readOnly = false,
  // Öppna sidan direkt på en viss flik (App.jsx: sidomenyns Företag-punkt,
  // som tidigare ledde till en EGEN, halvt överlappande företagssida).
  initialSection,
}) {
  // Kundönskemål (uppföljning, ny referensbild): tillbaka till att
  // "Inställningar" i sidomenyn landar på ÖVERSIKTEN (SettingsHub-
  // rutnätet, alla tio kort) där man VÄLJER vad man vill ändra, i stället
  // för att kastas rakt in i en specifik flik (Säkerhet). `null` = hubben.
  // Direktlänkar (App.jsx:s initialSection, t.ex. sidomenyns gamla
  // Företag-genväg, eller ett #settings/<flik>-hash) fortsätter hoppa
  // förbi hubben rakt till rätt flik — se de två useEffects nedan, ingen
  // av dem ändrad.
  const [pickedTab, setActiveTab] = useState(null);
  // Dator: vänstermenyn syns alltid, så sidan öppnar direkt på Profil i
  // stället för en översikt. Telefon: listan (SettingsHub) är ingången.
  const isPhone = useIsMobileViewport();
  const activeTab = pickedTab ?? (isPhone ? null : 'profile');
  const { t, language, setLanguage } = useTranslation();
  const [dateFormatPref, setDateFormatPref] = useState(getDateFormatPreference());
  const saveDateFormatPref = (fmt) => { setDateFormatPreference(fmt); setDateFormatPref(fmt); };
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // Radera FÖRETAG (Avancerat) — egen bekräftelsetext, skild från
  // deleteConfirmText ovan (Radera DATA) eftersom båda korten kan synas
  // samtidigt på sidan; att dela samma state hade låst upp fel knapp.
  const [deleteCompanyConfirmText, setDeleteCompanyConfirmText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [showSieImport, setShowSieImport] = useState(false);
  const [showSkattekontoImport, setShowSkattekontoImport] = useState(false);
  const [showSieAttachments, setShowSieAttachments] = useState(false);
  const [nextInvoiceNumberInput, setNextInvoiceNumberInput] = useState('');
  // Vilken integration som är öppen för inställningar.
  const [openIntegration, setOpenIntegration] = useState(null);
  // Undersida i Import och export (radera data / radera företag), samma
  // idé som openIntegration: listan först, en egen sida när man valt.
  const [advancedView, setAdvancedView] = useState(null);
  const [calendarCopied, setCalendarCopied] = useState(false);
  // E-postinkorgen (api/inbox/index.js): adressen, senast mottaget mejl och
  // Gmails bekräftelsekod. Hämtas när Kopplingar öppnas, och var tjugonde
  // sekund medan inkorgens sida är öppen (koden från Gmail kommer inom en minut).
  const [inboxInfo, setInboxInfo] = useState(null);
  const [inboxError, setInboxError] = useState('');
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxTab, setInboxTab] = useState('gmail');
  const [inboxCopied, setInboxCopied] = useState('');
  const [senderInput, setSenderInput] = useState('');
  const [senderError, setSenderError] = useState('');
  const loadInbox = async (action = 'get', extra = {}) => {
    // Demot (readOnly) har ingen databas: visa hur det ser ut med en påhittad adress.
    if (readOnly) {
      setInboxInfo(prev => prev || {
        address: 'exempelforetag-k29fq7m@inbox.bokix.se',
        lastReceivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        gmailCode: null,
        allowedSenders: ['@exempelel.se', '@exempeltelefoni.se'],
        lastBlockedFrom: null,
        lastBlockedAt: null,
      });
      return;
    }
    if (!activeCompanyId) return;
    setInboxBusy(true);
    setInboxError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ companyId: activeCompanyId, action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('ui.inkorg_fel'));
      setInboxInfo(json);
    } catch (err) {
      setInboxError(err?.message || tr('ui.inkorg_fel'));
    } finally {
      setInboxBusy(false);
    }
  };
  useEffect(() => {
    if (activeTab !== 'integrations') return undefined;
    loadInbox();
    if (openIntegration !== 'email-inbox') return undefined;
    const timer = setInterval(() => loadInbox(), 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, openIntegration, activeCompanyId]);
  // Godkända avsändare: adress ("faktura@telia.se") eller domän ("@telia.se").
  const normalizeSenderInput = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (/^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return s;
    const d = s.replace(/^@/, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? `@${d}` : null;
  };
  const saveSenders = (list) => {
    if (readOnly) { setInboxInfo(i => ({ ...i, allowedSenders: list })); return; }
    loadInbox('senders', { senders: list });
  };
  const addSender = (value) => {
    const entry = normalizeSenderInput(value);
    if (!entry) { setSenderError(tr('ui.inkorg_avsandare_ogiltig')); return; }
    setSenderError('');
    setSenderInput('');
    const current = inboxInfo?.allowedSenders || [];
    if (!current.includes(entry)) saveSenders([...current, entry]);
  };
  const copyInbox = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setInboxCopied(key); setTimeout(() => setInboxCopied(''), 2000); } catch { /* urklipp blockerat */ }
  };
  const backupInputRef = useRef(null);
  const [invoiceNumberError, setInvoiceNumberError] = useState('');

  // ── Företagsuppgifter: "Spara ändringar" + Reauthentication ──
  // Till skillnad från resten av company-fälten (som fortfarande autosparar
  // direkt via setCompanyInfo på varje tangenttryckning) håller de HÄR
  // fälten (Grunduppgifter + Kontaktuppgifter-korten nedan — namn, org.nr,
  // momsreg.nr, adress, F-skatt, e-post, telefon) ett lokalt utkast och
  // sparas bara vid ett uttryckligt klick, EFTERSOM skrivningen måste
  // kunna kräva ett server-verifierat reauthToken (se ReauthCodeStep ovan)
  // — ett rent klient-anrop kan aldrig bevisa det. Skickas därför till
  // /api/company-access (field: 'company') istället för direkt via
  // setCompanyInfo, se saveCompanyInfo nedan.
  // KÄND BEGRÄNSNING: resyncas mot `company` varje gång den propen ändras
  // (t.ex. en autosparning i en ANNAN flik, som Bankuppgifter) — ett
  // osparat utkast här kan då tappas om en sådan autosparning hinner före.
  // Sällsynt (kräver att man redigerar två flikar "samtidigt" i samma
  // session) och accepterat, inte åtgärdat här.
  const [companyDraft, setCompanyDraft] = useState(company);
  useEffect(() => { setCompanyDraft(company); }, [company]);
  // Stripe-anslutningens eget reauth-läge (Betalning-fliken) — null|'connect'|'disconnect'.
  const [stripeReauthAction, setStripeReauthAction] = useState(null);
  const [companySaveBusy, setCompanySaveBusy] = useState(false);
  const [companySaveError, setCompanySaveError] = useState('');
  const [companySaveSuccess, setCompanySaveSuccess] = useState(false);
  const COMPANY_INFO_KEYS = ['name', 'orgNr', 'vatNr', 'address', 'fSkatt', 'email', 'phone', 'invoiceDisplayName'];
  const companyInfoDirty = COMPANY_INFO_KEYS.some(k => (companyDraft?.[k] || '') !== (company?.[k] || ''));

  // Registrerat företagsnamn LÅST efter en genomförd registrering — se
  // api/company-access.js:s motsvarande, faktiska serverspärr (den här
  // flaggan styr bara VISNINGEN, servern är den riktiga gränsen). Ett tomt
  // orgNr betyder "Jag har inget företag än" valdes vid registreringen
  // (Auth.jsx) — inget nytt fält att hålla i synk, samma signal servern
  // redan använder.
  // Ett UF-företag räknas som färdigregistrerat utan organisationsnummer:
  // de flesta har inget, och "Slutför din företagsregistrering"-vyn nedan
  // hade då stått kvar hela läsåret och bett om ett nummer som inte finns.
  // Vilket företag som helst KAN fortfarande fylla i ett org.nummer under
  // Grunduppgifter om de fått ett.
  const companyRegistrationComplete = Boolean(company?.orgNr) || isUfCompany(company);
  // Org.nummer-uppslaget för "Slutför din företagsregistrering" nedan —
  // samma hook/mönster som Auth.jsx:s registreringssteg 2 och
  // Contacts.jsx, skriver bara till companyDraft istället för regX-state.
  const [companyRegLegalForm, setCompanyRegLegalForm] = useState('');
  const companyRegLookup = useCompanyLookup((key, value) => {
    if (key === 'name') setCompanyDraft(d => ({ ...d, name: value }));
    else if (key === 'orgNr') setCompanyDraft(d => ({ ...d, orgNr: formatOrgNr(value) }));
    else if (key === 'legalForm') setCompanyRegLegalForm(value);
  });
  // ── "Hämta uppgifter" på ett REDAN registrerat företag ────────────────
  // Kundfeedback: "väljer man företaget ska det direkt ha organisations-
  // numret och företagsnamnet — och adressen, bankuppgifterna, telefon och
  // momsregistreringsnumret." Uppslaget fanns bara i registreringsflödet
  // (companyRegLookup ovan) och i kundregistret; här fick man skriva av
  // adressen för hand trots att appen redan kan slå upp den.
  //
  // Skriver in i samma companyDraft som fälten — alltså sparas den INTE
  // förrän man klickar Spara ändringar, precis som en manuell ändring.
  // Adressen är ETT fält här (till skillnad från kundregistrets tre), så
  // gata/postnummer/ort sätts ihop i den ordning de skrivs på ett kuvert.
  const companyDetailsLookup = useCompanyLookup((key, value) => {
    // Uppslaget svarar med gata/postnummer/ort var för sig — och nu tar
    // formuläret emot dem var för sig också, i stället för att klistra ihop
    // dem till en rad.
    if (key === 'address' || key === 'street') setCompanyDraft(d => ({ ...d, address: value }));
    else if (key === 'postalCode') setCompanyDraft(d => ({ ...d, postalCode: value }));
    else if (key === 'city') setCompanyDraft(d => ({ ...d, city: value }));
  });

  /** Svenskt momsregistreringsnummer härleds ur organisationsnumret:
   * SE + de tio siffrorna + 01. Ingen gissning — det är formeln
   * Skatteverket använder. Fylls bara i om fältet är tomt, så en manuellt
   * ifylld avvikelse (t.ex. gruppregistrering) aldrig skrivs över. */
  const vatNrFromOrgNr = (orgNr) => {
    const digits = String(orgNr || '').replace(/\D/g, '');
    return digits.length === 10 ? `SE${digits}01` : '';
  };

  const handleFetchCompanyDetails = () => {
    const digits = String(companyDraft?.orgNr || '').replace(/\D/g, '');
    if (digits.length !== 10) return;
    companyDetailsLookup.lookupByOrgNr(companyDraft.orgNr);
    const vat = vatNrFromOrgNr(companyDraft.orgNr);
    if (vat && !companyDraft?.vatNr) setCompanyDraft(d => ({ ...d, vatNr: vat }));
  };

  // Samma "auktoritativt uppslagssvar före lokal siffer-gissning"-prioritet
  // som Auth.jsx:s displayedOrgType.
  const companyRegOrgType = detectOrgType(companyDraft?.orgNr);
  const companyRegDisplayedOrgType = (companyRegLegalForm && formatLegalForm(companyRegLegalForm)) || companyRegOrgType;

  const saveCompanyInfo = async () => {
    setCompanySaveBusy(true); setCompanySaveError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/company-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: activeCompanyId, field: 'company', value: companyDraft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || tr('ui.kunde_inte_spara', { status: response.status }));
      setCompanyInfo(companyDraft);
      setCompanySaveSuccess(true);
      setTimeout(() => setCompanySaveSuccess(false), 4000);
    } catch (err) {
      setCompanySaveError(err?.message || tr('ui.kunde_inte_spara_andringarna_forsok_igen_om_en_s'));
    } finally {
      setCompanySaveBusy(false);
    }
  };

  // Djuplänk in i ett visst avsnitt.
  //
  // Bugkritiskt (kundrapporterat: "när jag gör något hamnar jag på en gammal
  // sida"): avsnittet skrevs tidigare som en NAKEN hash — #data, #appearance,
  // #integrations. Men hashen är appens GLOBALA sidväljare (App.jsx:
  // resolveTab), och de orden är inga sidor där. Laddade man om med
  // #data i adressfältet slog switchens default till och man landade på
  // Startsidan i stället för i inställningarna man just stod i. Numera
  // skrivs "settings/<avsnitt>", och resolveTab läser bara delen före
  // snedstrecket — hashen pekar alltså alltid på en riktig sida, och
  // avsnittet åker med som en underdel av den.
  //
  // De gamla, nakna formerna (#profile/#company/#users) läses fortfarande:
  // de finns som alias i App.jsx sedan tidigare och kan ligga i någons
  // bokmärke.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    const section = hash.startsWith('settings/') ? hash.slice('settings/'.length) : hash;
    if (SETTINGS_TABS.some(t => t.id === section)) setActiveTab(section);
  }, []);

  // App.jsx kan öppna sidan direkt på en viss flik (t.ex. den gamla
  // "Företag"-sidan i sidomenyn, som numera ÄR den här sidans Företag-flik
  // i stället för en egen, halvt överlappande kopia).
  useEffect(() => {
    if (initialSection && SETTINGS_TABS.some(t => t.id === initialSection)) setActiveTab(initialSection);
  }, [initialSection]);

  const handleSetTab = (tab) => {
    setActiveTab(tab);
    setOpenIntegration(null);
    setAdvancedView(null);
    // Se kommentaren vid hash-avläsningen ovan för varför den är
    // namnrymdad. `null` = tillbaka till översikten, som inte har något
    // eget avsnitt att peka ut.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', tab ? `#settings/${tab}` : '#settings');
    }
  };

  // Etiketterna hämtas via t() istället för direkt från SETTINGS_TABS.label
  // — se src/i18n/index.js: bara flikraden är översatt hittills (Utseende →
  // Språk), resten av sidans text är fortsatt hårdkodad svenska.
  const visibleSections = ufSettingsSections(company, SETTINGS_TABS).map(s => ({ ...s, label: t(`settings.tabs.${s.id}`) }));
  // `null` när man står på översikten. Styr sidhuvudet, flikraden och
  // vilken vy som renderas — ETT värde, inte tre villkor som kan glida isär.
  const activeSection = visibleSections.find(t => t.id === activeTab) || null;
  // Undersidor (en koppling, eller radering i Import och export): egen
  // rubrik och en väg tillbaka till listan.
  const subPage = activeTab === 'integrations' && openIntegration
    ? { title: ({ stripe: 'Stripe', zettle: 'Zettle', calendar: tr('ui.kalender'), gmail: 'Gmail', 'business-email': tr('ui.egen_e_postadress'), bank: tr('ui.din_bank'), 'email-inbox': tr('ui.inkorg_namn') })[openIntegration] || '', back: () => setOpenIntegration(null) }
    : activeTab === 'advanced' && advancedView
      ? { title: advancedView === 'delete-data' ? tr('ui.radera_foretagets_bokforingsdata') : tr('ui.radera_foretag'), back: () => setAdvancedView(null) }
      : null;

  // Notiser-fliken: huvudströmbrytaren, läst en gång här (samma fält som
  // api/cron/reminders.js och App.jsx:s handleRegisterInvoicePayment
  // kollar server-/klientsidan) — styr både sin egen växel och om de
  // undanförda kategorierna nedan visas avstängda.
  const emailNotificationsOn = company?.notifications?.emailNotificationsEnabled ?? true;

  const firstName = user?.user_metadata?.first_name || '';
  const lastName = user?.user_metadata?.last_name || '';
  const phone = user?.user_metadata?.phone || '';
  // Bara för toggle-hintens exempeltext nedan — samma tidsberoende hälsning
  // som Startsidan faktiskt visar, inte en hårdkodad "Hej".
  const { greeting: greetingPreview } = getGreeting();

  const updateUserMeta = (patch) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    supabase.auth.updateUser({ data: patch });
  };

  // Ingående balanser från SIE-import som räknas dubbelt (utils/sieOpeningReconcile.js).
  const sieOpeningsNeedRepair = useMemo(
    () => reconcileSieOpenings(verifications, { equityAccount: resultAccountFor(detectOrgType(company?.orgNr)) }).needsRepair,
    [verifications, company?.orgNr],
  );
  // Importerade SIE-filer, var och en går att ta bort (App.jsx handleDeleteSieImport).
  const sieBatches = useMemo(() => sieImportBatches(verifications), [verifications]);
  // Ägaren alltid; en inbjuden bara som redigerare med rätt att ändra
  // verifikationer (samma kontroll som api/company-access.js gör).
  const canDeleteSieImport = Boolean(onDeleteSieImport) && !readOnly
    && (!sharedAccess || (sharedAccess.role === 'editor' && canWriteField(sharedAccess.pageAccess, 'verifications', sharedAccess.role)));
  const handleDeleteSieImport = async (batch) => {
    const lockedIds = new Set(batch.ids);
    const locked = verifications.find(v => lockedIds.has(v.id) && lockedPeriodFor(v.date, company?.lockedFiscalYears));
    if (locked) {
      window.alert(tr('ui.sie_import_last_ar', { year: lockedPeriodFor(locked.date, company?.lockedFiscalYears) }));
      return;
    }
    const laterImports = sieBatches.some(o => o.tag !== batch.tag && o.from && batch.to && o.from > batch.to);
    const message = tr('ui.sie_import_ta_bort_fraga', { file: batch.fileName, count: batch.count })
      + (laterImports ? '\n\n' + tr('ui.sie_import_senare_ar') : '');
    if (!(await confirmDialog(message, { danger: true, confirmLabel: tr('ui.ta_bort') }))) return;
    onDeleteSieImport(batch.tag);
  };
  const maxUsedInvoiceNumber = useMemo(() => Math.max(0, ...invoices.map(i => Number(i.invoiceNumber) || 0)), [invoices]);

  const saveNextInvoiceNumber = () => {
    const n = Number(nextInvoiceNumberInput);
    if (!nextInvoiceNumberInput || !Number.isInteger(n) || n <= 0) {
      setInvoiceNumberError(tr('ui.ange_ett_positivt_heltal'));
      return;
    }
    if (n <= maxUsedInvoiceNumber) {
      setInvoiceNumberError(tr('ui.maste_vara_hogre_an_hogsta_redan_anvanda_faktura', { maxUsedInvoiceNumber }));
      return;
    }
    setInvoiceNumberError('');
    setCompanyInfo({ ...company, nextInvoiceNumber: n });
  };

  const handleExport = () => {
    const payload = { exportedAt: new Date().toISOString(), company, accounts, verifications, invoices, quotes, expenses, contacts, projects };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bokix-export-${(company?.name || 'foretag').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Kundönskemål/kodgranskningsfynd: landningssidans FAQ och prissidan
  // påstår redan "SIE4-export — din bokföring är alltid din", men fram
  // till nu fanns ingen knapp någonstans som faktiskt utlöste den —
  // sieExport.js var aldrig kopplad till UI, bara till sitt eget test.
  // Den här knappen är den konkreta fixen som gör påståendet sant.
  const handleExportSie = () => {
    downloadSie4(company, accounts, verifications);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        onImport?.(parsed);
        setImportMsg(tr('ui.data_importerad'));
      } catch (err) {
        setImportMsg(tr('ui.kunde_inte_lasa_filen_2', { message: err.message }));
      } finally {
        setImportBusy(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => { setImportMsg(tr('ui.kunde_inte_lasa_filen')); setImportBusy(false); };
    reader.readAsText(file);
  };

  const deleteMatches = deleteConfirmText.trim().length > 0 && deleteConfirmText.trim() === (company?.name || '').trim();
  const deleteCompanyMatches = deleteCompanyConfirmText.trim().length > 0 && deleteCompanyConfirmText.trim() === (company?.name || '').trim();

  // ── Kort som flyttats ur den gamla Betalning-fliken ──────────────────
  // Kundfeedback: "Grunduppgifter borde vara en familj — företagsnamn,
  // org.nummer, momsnummer, adress, mejl och bankuppgifterna", och
  // integrationerna ska vara sin egen sak, inte gömda under Data.
  // Blocken är ordagrant desamma som förut, bara renderade från de nya
  // flikarna: bankuppgifterna hör till företaget, Stripe och e-postdomänen
  // till Integrationer, fakturainställningarna till Fakturor.
  // Bankuppgifterna är INTE ett eget kort längre — de ligger som en grupp
  // inuti företagsuppgifterna, där kundfeedbacken ville ha dem ("namn,
  // org.nummer, momsnummer, adress, mejl och bankuppgifterna" som en
  // familj). De autosparar (setCompanyInfo) till skillnad från fälten
  // ovanför dem i samma kort, vilket gruppens hjälptext säger rakt ut.
  const bankFieldsGroup = (
    <FieldGroup title={tr('ui.bank')}>
      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
        <AutoField label={tr('ui.bankgiro')} value={company?.bankgiro || ''} onChange={(v) => setCompanyInfo({ ...company, bankgiro: v })} />
        <AutoField label={tr('ui.plusgiro')} value={company?.plusgiro || ''} onChange={(v) => setCompanyInfo({ ...company, plusgiro: v })} />
        <AutoField label="IBAN" value={company?.iban || ''} onChange={(v) => setCompanyInfo({ ...company, iban: v })} />
        <AutoField label="BIC/SWIFT" value={company?.bic || ''} onChange={(v) => setCompanyInfo({ ...company, bic: v })} />
      </div>
    </FieldGroup>
  );

  // Kundönskemål: "bank ska vara två saker" — dels sidan där man importerar
  // kontoutdrag (oförändrad, länken nedan), dels de BETALUPPGIFTER kunden
  // faktiskt ser på fakturan (bankgiro/plusgiro/IBAN/BIC — samma fält som
  // Företag → Grunduppgifter redan äger, återanvänt rakt av här i stället
  // för ett duplicerat fält-par som kan glida isär). #bank som href (inte
  // en ny prop genom App.jsx) — samma hashchange-routing appen redan
  // lyssnar på för alla andra sidbyten.
  // Zettle: egen sida som de andra kopplingarna (kundönskemål), i stället
  // för en Anslut-knapp direkt i listan.
  // Kalenderlänken (.ics, api/calendar.js). Ingen Google-inloggning: Google
  // Kalender, Apple och Outlook prenumererar på länken och hämtar den själva.
  const calendarSettings = company?.calendar || {};
  const calendarChoicesNow = calendarChoices(calendarSettings);
  const calendarUrl = calendarSettings.key && typeof window !== 'undefined'
    ? calendarFeedUrl(window.location.origin, sharedAccess?.ownerUserId || user?.id, activeCompanyId, calendarSettings.key)
    : '';
  const calendarWebcal = calendarUrl.replace(/^https?:/, 'webcal:');
  const saveCalendar = (patch) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setCompanyInfo({ ...company, calendar: { ...calendarSettings, ...patch } });
  };
  const copyCalendarUrl = async () => {
    try { await navigator.clipboard.writeText(calendarUrl); setCalendarCopied(true); setTimeout(() => setCalendarCopied(false), 2000); } catch { /* urklipp blockerat, fältet går att markera */ }
  };
  const calendarCard = !calendarSettings.key ? (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '480px' }}>{tr('ui.kalender_intro')}</p>
        <button type="button" onClick={() => saveCalendar({ key: newCalendarKey() })} style={btnSecondary}>{tr('ui.skapa_kalenderlank')}</button>
      </div>
    </div>
  ) : (
    <>
      <SettingCard title={tr('ui.lagg_till_i_kalendern')}>
        <SettingRow label="Google Kalender">
          <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarWebcal)}`} target="_blank" rel="noopener noreferrer" style={btnSecondary}>
            {tr('ui.lagg_till')} <ExternalLink size={13} />
          </a>
        </SettingRow>
        <SettingRow label={tr('ui.apple_kalender')}>
          <a href={calendarWebcal} style={btnSecondary}>{tr('ui.lagg_till')}</a>
        </SettingRow>
        <SettingRow label={tr('ui.kalenderlank_ovriga')} description={tr('ui.kalender_google_uppdaterar')} last>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input readOnly value={calendarUrl} onFocus={e => e.target.select()} aria-label={tr('ui.kalenderlank_ovriga')} style={{ ...inputBase, width: '220px', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }} />
            <button type="button" onClick={copyCalendarUrl} style={btnTile}>{calendarCopied ? tr('ui.kopierad') : tr('ui.kopiera')}</button>
          </div>
        </SettingRow>
      </SettingCard>
      <SettingCard title={tr('ui.innehall_i_kalendern')}>
        {[
          { id: 'vat', label: tr('ui.momsdeklaration'), description: tr('ui.kal_moms_desc') },
          { id: 'agi', label: tr('ui.arbetsgivardeklaration'), description: tr('ui.kal_agi_desc') },
          { id: 'invoices', label: tr('ui.kundfakturor'), description: tr('ui.nar_obetalda_fakturor_forfaller') },
          { id: 'supplierInvoices', label: tr('ui.leverantorsfakturor_stor'), description: tr('ui.kal_lev_desc') },
        ].map((row, i, all) => (
          <SettingRow key={row.id} label={row.label} description={row.description} last={i === all.length - 1}>
            <ToggleSwitch checked={calendarChoicesNow[row.id]} onChange={() => saveCalendar({ ...calendarChoicesNow, [row.id]: !calendarChoicesNow[row.id] })} />
          </SettingRow>
        ))}
      </SettingCard>
      <SettingCard>
        <SettingRow label={tr('ui.skapa_ny_lank')} description={tr('ui.den_gamla_lanken_slutar_fungera')} last>
          <button
            type="button"
            onClick={async () => { if (await confirmDialog(tr('ui.skapa_ny_kalenderlank_fraga'))) saveCalendar({ key: newCalendarKey() }); }}
            style={btnSecondary}
          >
            {tr('ui.skapa_ny_lank')}
          </button>
        </SettingRow>
      </SettingCard>
    </>
  );

  // E-postinkorgen: adressen, om något kommit, Gmails kod och hur man
  // vidarebefordrar från Gmail, Outlook och Apple Mail.
  const GMAIL_FILTER = 'has:attachment (faktura OR kvitto OR invoice OR receipt OR kvittering)';
  const inboxSteps = {
    gmail: [tr('ui.inkorg_gmail_1'), tr('ui.inkorg_gmail_2'), tr('ui.inkorg_gmail_3'), tr('ui.inkorg_gmail_4')],
    outlook: [tr('ui.inkorg_outlook_1'), tr('ui.inkorg_outlook_2'), tr('ui.inkorg_outlook_3')],
    apple: [tr('ui.inkorg_apple_1'), tr('ui.inkorg_apple_2'), tr('ui.inkorg_apple_3')],
    other: [tr('ui.inkorg_annan_1')],
  };
  const inboxNotes = { outlook: tr('ui.inkorg_outlook_not'), apple: tr('ui.inkorg_apple_not') };
  const emailInboxCard = (
    <>
      <SettingCard title={tr('ui.inkorg_adress_rubrik')}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: '560px', lineHeight: 1.55 }}>{tr('ui.inkorg_intro')}</p>
        {!inboxInfo ? (
          <div style={{ fontSize: '13px', color: inboxError ? 'var(--status-red-text)' : 'var(--text-muted)' }}>{inboxError || tr('ui.inkorg_hamtar')}</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input readOnly value={inboxInfo.address} onFocus={e => e.target.select()} aria-label={tr('ui.inkorg_adress_rubrik')} style={{ ...inputBase, flex: '1 1 260px', maxWidth: '420px', fontFamily: 'ui-monospace, monospace', fontSize: '13.5px' }} />
              <button type="button" onClick={() => copyInbox(inboxInfo.address, 'address')} style={btnTile}>{inboxCopied === 'address' ? tr('ui.kopierad') : tr('ui.kopiera')}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13px', color: inboxInfo.lastReceivedAt ? 'var(--status-green-text)' : 'var(--text-muted)' }}>
              {inboxInfo.lastReceivedAt && <CheckCircle2 size={16} />}
              {inboxInfo.lastReceivedAt ? tr('ui.inkorg_mottaget', { v: relativeTimeSv(inboxInfo.lastReceivedAt) }) : tr('ui.inkorg_inget_mottaget')}
            </div>
            {inboxInfo.gmailCode && (
              <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-green-text)' }}>{tr('ui.inkorg_gmail_kod')}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-main)', fontFamily: 'ui-monospace, monospace' }}>{inboxInfo.gmailCode}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tr('ui.inkorg_gmail_kod_hjalp')}</div>
                </div>
                <button type="button" onClick={() => copyInbox(inboxInfo.gmailCode, 'code')} style={btnTile}>{inboxCopied === 'code' ? tr('ui.kopierad') : tr('ui.kopiera')}</button>
              </div>
            )}
          </>
        )}
      </SettingCard>
      {inboxInfo && (
        <SettingCard title={tr('ui.inkorg_vidarebefordra')}>
          <div role="tablist" style={{ display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '10px', background: 'var(--bg-muted)', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[['gmail', 'Gmail'], ['outlook', 'Outlook'], ['apple', 'Apple Mail'], ['other', tr('ui.inkorg_annan')]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={inboxTab === id}
                onClick={() => setInboxTab(id)}
                style={{ padding: '7px 14px', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', fontWeight: inboxTab === id ? 600 : 500, background: inboxTab === id ? 'var(--bg-card)' : 'transparent', color: inboxTab === id ? 'var(--text-main)' : 'var(--text-muted)', boxShadow: inboxTab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
              >
                {label}
              </button>
            ))}
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '620px' }}>
            {inboxSteps[inboxTab].map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                <span style={{ flex: 'none', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-muted)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {inboxTab === 'gmail' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{tr('ui.inkorg_filter')}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input readOnly value={GMAIL_FILTER} onFocus={e => e.target.select()} aria-label={tr('ui.inkorg_filter')} style={{ ...inputBase, flex: '1 1 260px', maxWidth: '520px', fontFamily: 'ui-monospace, monospace', fontSize: '12.5px' }} />
                <button type="button" onClick={() => copyInbox(GMAIL_FILTER, 'filter')} style={btnTile}>{inboxCopied === 'filter' ? tr('ui.kopierad') : tr('ui.kopiera')}</button>
              </div>
            </div>
          )}
          {inboxNotes[inboxTab] && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '14px 0 0' }}>{inboxNotes[inboxTab]}</p>}
        </SettingCard>
      )}
      {inboxInfo && (
        <SettingCard title={tr('ui.inkorg_avsandare_rubrik')}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px', maxWidth: '600px', lineHeight: 1.55 }}>{tr('ui.inkorg_avsandare_text')}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {(inboxInfo.allowedSenders || []).length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tr('ui.inkorg_avsandare_tom')}</span>
            ) : (inboxInfo.allowedSenders || []).map(entry => (
              <span key={entry} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 6px 5px 10px', borderRadius: '999px', background: 'var(--bg-muted)', fontSize: '12.5px', color: 'var(--text-main)', fontFamily: 'ui-monospace, monospace' }}>
                {entry}
                <button type="button" aria-label={tr('ui.ta_bort')} disabled={inboxBusy} onClick={() => saveSenders((inboxInfo.allowedSenders || []).filter(e => e !== entry))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); addSender(senderInput); }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={senderInput} onChange={e => { setSenderInput(e.target.value); setSenderError(''); }} placeholder="faktura@telia.se eller @telia.se" aria-label={tr('ui.inkorg_avsandare_rubrik')} style={{ ...inputBase, flex: '1 1 240px', maxWidth: '360px' }} />
            <button type="submit" disabled={inboxBusy || !senderInput.trim()} style={btnTile}>{tr('ui.lagg_till')}</button>
          </form>
          {senderError && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginTop: '8px' }}>{senderError}</div>}
          {inboxInfo.lastBlockedFrom && (inboxInfo.allowedSenders || []).length > 0 && (
            <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 240px' }}>{tr('ui.inkorg_stoppat', { v: inboxInfo.lastBlockedFrom, when: relativeTimeSv(inboxInfo.lastBlockedAt) })}</span>
              {inboxInfo.lastBlockedFrom.includes('@') && (
                <button type="button" disabled={inboxBusy} onClick={() => addSender('@' + inboxInfo.lastBlockedFrom.split('@').pop().replace(/>$/, ''))} style={btnTile}>
                  {tr('ui.inkorg_godkann', { v: '@' + inboxInfo.lastBlockedFrom.split('@').pop().replace(/>$/, '') })}
                </button>
              )}
            </div>
          )}
        </SettingCard>
      )}
      {inboxInfo && (
        <SettingCard>
          <SettingRow label={tr('ui.inkorg_ny_adress')} description={tr('ui.inkorg_ny_adress_desc')} last>
            <button
              type="button"
              disabled={inboxBusy}
              onClick={async () => { if (await confirmDialog(tr('ui.inkorg_ny_adress_fraga'))) loadInbox('rotate'); }}
              style={btnSecondary}
            >
              {tr('ui.inkorg_ny_adress')}
            </button>
          </SettingRow>
        </SettingCard>
      )}
    </>
  );

  const zettleCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}><SectionHeading>{tr('ui.kassaforsaljning')}</SectionHeading></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '480px' }}>
          {zettleConnected ? tr('ui.zettle_ansluten_text') : tr('ui.dagens_kassaforsaljning_hamtas_in_som_underlag_a')}
        </p>
        {!zettleConnected && (
          <button
            type="button"
            onClick={() => { if (readOnly || !onConnectZettle) { window.alert(DEMO_BLOCKED_MSG); return; } onConnectZettle(); }}
            style={btnSecondary}
          >
            {tr('ui.anslut_zettle')}
          </button>
        )}
      </div>
    </div>
  );

  const stripeCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}><SectionHeading icon={CreditCard} tone={stripeAccountId ? 'green' : 'amber'}>{tr('ui.ta_emot_kortbetalningar')}</SectionHeading></div>
      {/* Reauthentication (se ReauthCodeStep ovan) — koppla till/från
          ett Stripe-konto styr var pengarna hamnar, minst lika
          känsligt som lösenord/företagsuppgifter. onConnectStripe/
          onDisconnectStripe (App.jsx) tar numera emot reauthToken
          som argument och skickar med det till /api/stripe/connect,
          se App.jsx:s handlers. */}
      {/* stripeReauthAction blir numera bara 'disconnect' — anslutning
          kräver inte längre en kod, se kommentaren vid api/stripe/
          connect.js och integrationCatalogue-brickans onClick. */}
      {stripeReauthAction ? (
        <ReauthCodeStep
          onVerified={async (reauthToken) => {
            setStripeReauthAction(null);
            await onDisconnectStripe?.(reauthToken);
          }}
          onCancel={() => setStripeReauthAction(null)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '480px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              {stripeAccountId
                ? tr('ui.stripe_ar_anslutet_kunder_kan_betala_dina_faktur')
                : tr('ui.anslut_stripe_for_att_lata_kunder_betala_fakturo')}
            </p>
            {/* Kundbeslut: Bokix egen avgift = Stripes EGEN avgift
                (beror på korttyp, känd först efter betalningen)
                plus en egen marginal ovanpå — INTE en fast,
                orelaterad procentsats. En sann dynamisk "Stripes
                verkliga avgift"-modell visade sig inte stödjas av
                Stripe för den här kontotypen (direct charges på
                Standard-konton, se _invoiceLineItems.js:s
                kommentar för källan) — så siffran nedan är en
                UPPSKATTNING satt i förväg (europeiskt kort-
                antagande: Stripes 1,5% + 1,80 kr, plus Bokix egen
                marginal på 2% + 0,50 kr = totalt 3,5% + 2,30 kr),
                inte en exakt efterhandsberäkning. Måste hållas i
                synk för hand med STRIPE_PLATFORM_FEE_PERCENT/
                _FIXED_ORE (env, samma förvalda 3,5/230 om de inte
                är satta) om de någonsin ändras i Vercel. */}
            {/* Avgiftstexten var ett helt stycke om Stripes korttaxa,
                Bokix marginal och skillnaden mellan europeiska och
                utländska kort — kundfeedback: skriv inte det här.
                Exakt avgift per betalning står ändå i Stripes egen
                dashboard, som knappen bredvid går till. */}
            {stripeAccountId && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
                {tr('ui.saldo_utbetalningar_och_avgifter_foljer_du_i_din')}{' '}
                <a href="https://dashboard.stripe.com/settings/branding" target="_blank" rel="noopener noreferrer" style={{ color: BRAND.green }}>{tr('ui.stripe_varumarke')}</a>.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {stripeAccountId && (
              <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer" style={btnSecondary}>
                {tr('ui.oppna_stripe_dashboard')} <ExternalLink size={13} />
              </a>
            )}
            {stripeAccountId
              ? <button onClick={() => { if (readOnly) { onDisconnectStripe?.(); return; } setStripeReauthAction('disconnect'); }} style={btnGhost}>{tr('ui.koppla_fran')}</button>
              : (
                <button onClick={() => onConnectStripe?.()} style={btnStripeConnect}>
                  <StripeLogo height={15} /> {tr('ui.anslut_stripe')}
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Skicka från din egen adress (SMTP) ────────────────────────────────
  // För alla som inte äger en domän: i stället för att verifiera DNS
  // kopplar man sitt befintliga mejlkonto, och fakturan går ut därifrån.
  // All hantering av lösenordet sker på servern (api/_smtp.js) — det här
  // formuläret skickar det EN gång och får aldrig tillbaka det.
  const [ownSender, setOwnSender] = useState(null);
  // Reservlista, identisk med serverns PROVIDERS (api/_smtp.js). Servern
  // är källan, men ett tomt urval är värre än en kopia som råkar bli en
  // version gammal — då står användaren med en tom rullgardin.
  const [ownSenderProviders, setOwnSenderProviders] = useState(FALLBACK_MAIL_PROVIDERS);
  const [ownSenderGoogle, setOwnSenderGoogle] = useState(false);
  const [ownSenderStatusError, setOwnSenderStatusError] = useState('');
  const [ownSenderLoaded, setOwnSenderLoaded] = useState(false);
  const [ownSenderBusy, setOwnSenderBusy] = useState(false);
  const [ownSenderError, setOwnSenderError] = useState('');
  const [ownSenderForm, setOwnSenderForm] = useState({
    fromEmail: '', fromName: '', password: '', provider: 'custom', host: '', port: 465, secure: true,
  });

  const senderApi = async (init) => {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const auth = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    const res = await fetch(init.url, {
      method: init.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...auth },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || tr('ui.nagot_gick_fel', { status: res.status }));
    return payload;
  };

  useEffect(() => {
    if (!activeCompanyId || ownSenderLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await senderApi({ url: `/api/email/domains?resource=sender&company_id=${encodeURIComponent(activeCompanyId)}` });
        if (cancelled) return;
        setOwnSender(payload.sender || null);
        if (payload.providers?.length) setOwnSenderProviders(payload.providers);
        setOwnSenderGoogle(Boolean(payload.googleAvailable));
      } catch (err) {
        if (!cancelled) setOwnSenderStatusError(err.message || tr('ui.kunde_inte_hamta_status'));
      } finally {
        if (!cancelled) setOwnSenderLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId, ownSenderLoaded]);

  // Fyller i serveruppgifterna när adressen skrivs, så en gmail-adress
  // aldrig behöver se ordet SMTP.
  const pickProviderFor = (email) => {
    const addr = String(email || '').toLowerCase();
    const hit = ownSenderProviders.find(pr => (
      (pr.id === 'gmail' && /@(gmail|googlemail)\.com$/.test(addr))
      || (pr.id === 'outlook' && /@(outlook|hotmail|live)\.[a-z.]+$/.test(addr))
      || (pr.id === 'msn' && /@msn\.com$/.test(addr))
    ));
    return hit || null;
  };

  const activeProvider = ownSenderProviders.find(pr => pr.id === ownSenderForm.provider) || null;

  const handleOwnSenderEmailChange = (value) => {
    const guess = pickProviderFor(value);
    setOwnSenderForm(f => ({
      ...f,
      fromEmail: value,
      ...(guess ? { provider: guess.id, host: guess.host, port: guess.port, secure: guess.secure } : {}),
    }));
    setOwnSenderError('');
  };

  const handleOwnSenderProviderChange = (id) => {
    const pr = ownSenderProviders.find(x => x.id === id);
    setOwnSenderForm(f => ({ ...f, provider: id, host: pr?.host || '', port: pr?.port || 465, secure: pr?.secure ?? true }));
    setOwnSenderError('');
  };

  // Google-vägen: servern bygger inloggningsadressen (den bär en signerad
  // state som binder ihop inloggningen med rätt företag), klienten öppnar
  // den. Vi begär bara rätten att SKICKA — se api/_gmail.js.
  const handleConnectGoogle = async () => {
    setOwnSenderBusy(true); setOwnSenderError('');
    try {
      const payload = await senderApi({
        url: '/api/email/domains',
        method: 'POST',
        body: { resource: 'sender', action: 'oauth-url', company_id: activeCompanyId },
      });
      if (!payload?.url) throw new Error(tr('ui.fick_ingen_inloggningsadress_fran_servern'));
      window.location.href = payload.url;
    } catch (err) {
      setOwnSenderError(err.message || tr('ui.kunde_inte_starta_inloggningen_mot_google'));
      setOwnSenderBusy(false);
    }
  };

  const handleOwnSenderSave = async () => {
    setOwnSenderBusy(true); setOwnSenderError('');
    try {
      const payload = await senderApi({
        url: '/api/email/domains',
        method: 'POST',
        body: {
          resource: 'sender',
          company_id: activeCompanyId,
          fromEmail: ownSenderForm.fromEmail.trim(),
          fromName: ownSenderForm.fromName.trim() || company?.name || '',
          password: ownSenderForm.password,
          provider: ownSenderForm.provider,
          host: ownSenderForm.host,
          port: ownSenderForm.port,
          secure: ownSenderForm.secure,
        },
      });
      setOwnSender(payload.sender || null);
      setOwnSenderForm(f => ({ ...f, password: '' }));
    } catch (err) {
      setOwnSenderError(err.message || tr('ui.kunde_inte_spara_avsandaren'));
    } finally {
      setOwnSenderBusy(false);
    }
  };

  const handleOwnSenderRemove = async () => {
    if (!(await confirmDialog(tr('ui.koppla_fran_din_egen_avsandaradress_fakturor_ski')))) return;
    setOwnSenderBusy(true); setOwnSenderError('');
    try {
      await senderApi({ url: '/api/email/domains', method: 'POST', body: { resource: 'sender', action: 'remove', company_id: activeCompanyId } });
      setOwnSender(null);
    } catch (err) {
      setOwnSenderError(err.message || tr('ui.kunde_inte_koppla_fran'));
    } finally {
      setOwnSenderBusy(false);
    }
  };

  // Google (Gmail-konto) och app-lösenordsvägen (verksamhetsmejl hos t.ex.
  // Outlook eller one.com) delar samma email_senders-rad — bara EN adress
  // kan vara aktiv sändare åt gången — men visas nu i VARSITT kort i
  // stället för att den ena döljas bakom en textlänk under den andra. Kund
  // önskade det tydligt isär: privat Gmail är sin egen koppling, mejl på
  // den egna verksamhetens domän en annan.
  const isGoogleSender = ownSender?.provider === 'google';
  const isManualSender = Boolean(ownSender) && !isGoogleSender;

  const gmailCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}>
        <SectionHeading icon={Mail} tone={isGoogleSender ? 'green' : 'gray'}>
          {tr('ui.koppla_ditt_gmail_konto')}
        </SectionHeading>
      </div>

      {isGoogleSender ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{ownSender.fromEmail}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {tr('ui.kopplat_med_google_bokix_kan_skicka_i_ditt_namn')}
              </div>
            </div>
            <Badge tone={ownSender.verifiedAt ? 'positive' : 'warning'}>
              {ownSender.verifiedAt ? tr('ui.ansluten') : tr('ui.ej_testad')}
            </Badge>
          </div>
          {ownSender.lastError && (
            <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', background: 'var(--status-red-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', maxWidth: FORM_MAX }}>
              {tr('ui.senaste_utskicket_gick_inte_via_ditt_gmail_konto')} {ownSender.lastError} {tr('ui.fakturan_skickades_via_bokix_adress_i_stallet')}
            </div>
          )}
          <button onClick={handleOwnSenderRemove} disabled={ownSenderBusy} style={btnGhost}>{tr('ui.koppla_fran')}</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '560px' }}>
            {tr('ui.skicka_fakturor_fran_ditt_eget_gmail_konto_i_sta')}
          </p>

          {ownSenderStatusError && (
            <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px', fontWeight: 600 }}>
              {tr('ui.kunde_inte_lasa_statusen')} {ownSenderStatusError}
            </div>
          )}

          {isManualSender && (
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', maxWidth: '560px' }}>
              {tr('ui.du_skickar_just_nu_via')} {ownSender.fromEmail}{tr('ui.ansluter_du_gmail_har_ersatts_den_kopplingen')}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start', maxWidth: '560px' }}>
            <button
              onClick={handleConnectGoogle}
              disabled={ownSenderBusy || !ownSenderGoogle}
              style={{ ...btnSecondary, cursor: (ownSenderBusy || !ownSenderGoogle) ? 'not-allowed' : 'pointer', opacity: (ownSenderBusy || !ownSenderGoogle) ? 0.55 : 1 }}
            >
              <GoogleGlyph size={16} />
              {ownSenderBusy ? tr('ui.oppnar_google') : tr('ui.fortsatt_med_google')}
            </button>

            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {ownSenderGoogle
                ? tr('ui.google_fragar_om_en_enda_behorighet_att_skicka_e')
                : tr('ui.google_inloggningen_ar_inte_paslagen_pa_servern')}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const businessEmailCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}>
        <SectionHeading icon={Mail} tone={isManualSender ? 'green' : 'gray'}>
          {tr('ui.skicka_fran_din_verksamhets_e_post')}
        </SectionHeading>
      </div>

      {isManualSender ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{ownSender.fromEmail}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {tr('ui.fakturor_och_offerter_skickas_harifran_och_hamna')}
              </div>
            </div>
            <Badge tone={ownSender.verifiedAt ? 'positive' : 'warning'}>
              {ownSender.verifiedAt ? tr('ui.ansluten') : tr('ui.ej_testad')}
            </Badge>
          </div>
          {ownSender.lastError && (
            <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', background: 'var(--status-red-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', maxWidth: FORM_MAX }}>
              {tr('ui.senaste_utskicket_gick_inte_via_din_adress')} {ownSender.lastError} {tr('ui.fakturan_skickades_via_bokix_adress_i_stallet')}
            </div>
          )}
          <button onClick={handleOwnSenderRemove} disabled={ownSenderBusy} style={btnGhost}>{tr('ui.koppla_fran')}</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '560px' }}>
            {tr('ui.skicka_fakturor_fran_din_verksamhets_mejladress_2')}
          </p>

          {isGoogleSender && (
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', maxWidth: FORM_MAX }}>
              {tr('ui.du_skickar_just_nu_via_ditt_gmail_konto')}{ownSender.fromEmail}{tr('ui.fyll_i_nedan_for_att_byta_till_den_har_adressen')}
            </div>
          )}

          <div style={{ maxWidth: FORM_MAX }}>
            <div className="form-row-stack" style={grid2}>
              <AutoField label={tr('ui.din_e_postadress')} value={ownSenderForm.fromEmail} onChange={handleOwnSenderEmailChange} placeholder={tr('ui.namn_dittforetag_se')} />
              <AutoField label={tr('ui.avsandarnamn_visas_for_kunden')} value={ownSenderForm.fromName} onChange={(v) => setOwnSenderForm(f => ({ ...f, fromName: v }))} placeholder={company?.name || tr('ui.ditt_foretag')} />
            </div>
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{tr('ui.leverantor')}</label>
              <select
                value={ownSenderForm.provider}
                onChange={e => handleOwnSenderProviderChange(e.target.value)}
                style={{ ...inputBase, width: '100%', maxWidth: '360px' }}
              >
                {ownSenderProviders.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </select>
            </div>

            {activeProvider?.help && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.55, maxWidth: '620px' }}>
                {activeProvider.help}
                {activeProvider.appPasswordUrl && (
                  <> <a href={activeProvider.appPasswordUrl} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.greenDark, fontWeight: 600 }}>{tr('ui.skapa_app_losenord')}</a></>
                )}
              </div>
            )}

            {ownSenderForm.provider === 'custom' && (
              <div className="form-row-stack" style={{ ...grid2, gridTemplateColumns: '3fr 1fr', marginTop: '12px' }}>
                <AutoField label={tr('ui.serveradress_smtp')} value={ownSenderForm.host} onChange={(v) => setOwnSenderForm(f => ({ ...f, host: v }))} placeholder="smtp.leverantor.se" />
                <AutoField label={tr('ui.port')} type="number" value={String(ownSenderForm.port)} onChange={(v) => setOwnSenderForm(f => ({ ...f, port: Number(v) || 465, secure: Number(v) === 465 }))} />
              </div>
            )}

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{activeProvider?.appPasswordUrl ? tr('ui.app_losenord') : tr('ui.losenord')}</label>
              <input
                type="password"
                value={ownSenderForm.password}
                onChange={e => { setOwnSenderForm(f => ({ ...f, password: e.target.value })); setOwnSenderError(''); }}
                placeholder={activeProvider?.appPasswordUrl ? tr('ui.klistra_in_app_losenordet') : tr('ui.losenordet_till_din_e_post')}
                autoComplete="new-password"
                style={{ ...inputBase, width: '100%' }}
              />
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {tr('ui.losenordet_krypteras_innan_det_sparas_och_visas')}
              </div>
            </div>

            {ownSenderError && (
              <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', marginTop: '10px', fontWeight: 600 }}>{ownSenderError}</div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button onClick={handleOwnSenderSave} disabled={ownSenderBusy} style={{ ...btnPrimary, opacity: ownSenderBusy ? 0.6 : 1, cursor: ownSenderBusy ? 'not-allowed' : 'pointer' }}>
                {ownSenderBusy ? tr('ui.testar_inloggningen') : tr('ui.testa_och_spara')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Integrationskatalogen ────────────────────────────────────────────
  // En post per tjänst som FAKTISKT går att koppla in. Inga platshållare,
  // inget "kommer snart" — kundfeedback: "ha inte grejer som inte borde
  // vara där". Listan byggs här (inte i JSX) så sökningen och räknaren
  // ovanför korten läser exakt samma data som korten själva.
  //
  // Gmail och verksamhetens egen e-postadress är EGNA rutor här, precis
  // som Stripe och Zettle — inte en gemensam "e-post"-ruta man öppnar och
  // hittar båda under. Kundönskemål, ordagrant i sak: de ska inte ligga
  // under varandra, de ska vara lika separerade som Stripe och Zettle är
  // från varandra. Den tidigare domän-baserade rutan (verifiera DNS för
  // en egen domän, "Anslut domän") är borttagen — fungerade inte.
  const integrationCatalogue = [
    {
      id: 'stripe',
      name: 'Stripe',
      tagline: tr('ui.lat_kunden_betala_fakturan_med_kort_direkt_via_l'),
      logo: <StripeLogo height={30} />,
      connected: Boolean(stripeAccountId),
      detail: true,
      keywords: 'kort betalning checkout',
      // Kundönskemål (uppföljning): "Anslut ska gå direkt till anslut-
      // grejen" — INTE bara den öppnande beskrivningspanelen (redan
      // fixat), utan även UTAN kodsteget innan. "Anslut"-knappen ringer nu
      // onConnectStripe direkt, exakt samma mönster som Zettle-brickan
      // redan gör (ingen panel, ingen mellanhand) — API:et (api/stripe/
      // connect.js) kräver inte längre reauth för action:'start', bara
      // för 'disconnect' (se den filens kommentar för avvägningen: en
      // redirect till Stripes EGEN OAuth-sida ändrar ingenting själv,
      // frånkoppling river en redan aktiv betalväg direkt). Klicka på
      // SJÄLVA BRICKAN (inte knappen) öppnar fortfarande panelen med mer
      // info, som förut. Redan ansluten ("Hantera") oförändrat.
      action: (
        <button
          type="button"
          onClick={() => {
            if (stripeAccountId) { setOpenIntegration('stripe'); return; }
            // I demoläget (DemoWorkspace.jsx) ÄR onConnectStripe redan
            // "blocked" — en funktion som visar DEMO_BLOCKED_MSG själv.
            // Anropa den rakt av oavsett readOnly, samma mönster som
            // Zettle-brickan redan använder.
            onConnectStripe?.();
          }}
          style={btnTileLg}
        >
          {stripeAccountId ? tr('ui.hantera') : tr('ui.anslut')}
        </button>
      ),
    },
    {
      id: 'gmail',
      name: 'Gmail',
      tagline: tr('ui.skicka_fakturor_direkt_fran_ditt_eget_gmail_kont'),
      logo: <GmailLogo height={32} />,
      connected: isGoogleSender,
      connectedAs: isGoogleSender && ownSender?.fromEmail ? tr('ui.skickar_fran', { v: ownSender.fromEmail }) : null,
      statusLabel: isGoogleSender ? tr('ui.ansluten') : tr('ui.inte_ansluten'),
      detail: true,
      keywords: 'gmail google mejl avsändare',
      // Samma "ett klick, inte två"-fix som Stripe ovan: en oansluten
      // användare gick tidigare via panelen bara för att trycka en andra
      // "Fortsätt med Google"-knapp som gör exakt samma sak som den här
      // (handleConnectGoogle, en enkel omdirigering — ingen reauth-kod
      // behövs för Gmail, lägre känslighet än att koppla ett betalkonto).
      // Redan konfigurerat (ownSenderGoogle) går alltså rakt till Google;
      // annars öppnas panelen ändå, för att visa VARFÖR (servern saknar
      // GOOGLE_OAUTH_CLIENT_ID/SECRET) i stället för att bara inte hända
      // något. Redan ansluten ("Hantera") oförändrat.
      action: (
        <button
          type="button"
          onClick={() => {
            setOpenIntegration('gmail');
            // Panelen öppnas ändå (så en eventuell felrad/spinner har
            // någonstans att synas), men om servern redan vet att Google
            // är påslaget hoppar vi direkt vidare till redirecten i
            // stället för att vänta på ett andra klick där inne.
            if (!isGoogleSender && ownSenderGoogle && !readOnly) handleConnectGoogle();
          }}
          style={btnTileLg}
        >
          {isGoogleSender ? tr('ui.hantera') : tr('ui.anslut')}
        </button>
      ),
    },
    {
      id: 'business-email',
      name: tr('ui.egen_e_postadress'),
      tagline: tr('ui.skicka_fakturor_fran_din_verksamhets_mejladress'),
      logo: <MailFilled size={30} color="#1f2937" />,
      connected: isManualSender,
      connectedAs: isManualSender && ownSender?.fromEmail ? tr('ui.skickar_fran', { v: ownSender.fromEmail }) : null,
      statusLabel: isManualSender ? tr('ui.ansluten') : tr('ui.inte_ansluten'),
      detail: true,
      keywords: 'mejl smtp app-lösenord avsändare outlook',
      action: (
        <button type="button" onClick={() => setOpenIntegration('business-email')} style={btnTileLg}>
          {isManualSender ? tr('ui.hantera') : tr('ui.anslut')}
        </button>
      ),
    },
    {
      // Zettle visas alltid — kundfeedback: den ska synas. Saknas
      // inkopplingen (t.ex. i demon) står knappen kvar men säger ifrån
      // i stället för att kortet försvinner ur katalogen.
      id: 'zettle',
      name: 'Zettle',
      tagline: tr('ui.dagens_kassaforsaljning_hamtas_in_som_underlag_a'),
      logo: <ZettleLogo height={22} />,
      connected: zettleConnected,
      detail: true,
      keywords: 'kassa butik paypal',
      action: zettleConnected ? null : (
        <button
          type="button"
          onClick={() => { if (readOnly || !onConnectZettle) { window.alert(DEMO_BLOCKED_MSG); return; } onConnectZettle(); }}
          style={btnTileLg}
        >
          {tr('ui.anslut')}
        </button>
      ),
    },
    {
      id: 'email-inbox',
      name: tr('ui.inkorg_namn'),
      tagline: tr('ui.inkorg_tagline'),
      logo: <Inbox size={30} color="#1f2937" />,
      connected: Boolean(inboxInfo?.lastReceivedAt),
      connectedAs: inboxInfo?.address || null,
      statusLabel: inboxInfo?.lastReceivedAt ? tr('ui.inkorg_tar_emot') : tr('ui.inkorg_inte_installd'),
      detail: true,
      keywords: 'mejl vidarebefordra kvitto faktura inkorg gmail outlook',
    },
    {
      id: 'calendar',
      name: tr('ui.kalender'),
      tagline: tr('ui.kalender_tagline'),
      logo: <CalendarFilled size={30} color="#1f2937" />,
      connected: Boolean(company?.calendar?.key),
      statusLabel: company?.calendar?.key ? tr('ui.pa') : tr('ui.status_av'),
      detail: true,
    },
    {
      id: 'bank',
      name: tr('ui.din_bank'),
      tagline: tr('ui.betaluppgifter_pa_fakturan_och_kontoutdrag_som_u'),
      logo: <BankFilled size={30} color="#1f2937" />,
      connected: Boolean(company?.bankgiro || company?.plusgiro || company?.iban),
      connectedAs: company?.bankgiro ? 'Bankgiro ' + company.bankgiro : company?.plusgiro ? 'Plusgiro ' + company.plusgiro : company?.iban ? 'IBAN ' + company.iban : null,
      statusLabel: (company?.bankgiro || company?.plusgiro || company?.iban) ? tr('ui.ifyllt') : tr('ui.inte_ifyllt'),
      detail: true,
      keywords: 'bank kontoutdrag csv excel swedbank seb nordea handelsbanken bankgiro plusgiro iban betaluppgifter',
      action: (
        <button type="button" onClick={() => setOpenIntegration('bank')} style={btnTileLg}>
          {tr('ui.oppna')}
        </button>
      ),
    },
  ];

  const invoiceDefaultsCard = (
    <div style={card}>
      {/* Två fält på en rad i stället för under varandra: betalnings-
          villkoret är tre tecken brett och behöver ingen egen rad över
          hela kortet (kundfeedback om luften på inställningssidan). */}
      <div className="form-row-stack" style={{ ...grid2, gridTemplateColumns: '1fr 2fr', maxWidth: FORM_MAX }}>
        <AutoField label={tr('ui.betalningsvillkor_dagar')} type="number" value={company?.paymentTermsDays ?? '30'} onChange={(v) => setCompanyInfo({ ...company, paymentTermsDays: Number(v) || 30 })} />
        <AutoField label={tr('ui.standardtext_pa_faktura')} value={company?.invoiceFooterText || 'Tack för er affär! Dröjsmålsränta debiteras enligt räntelagen.'} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} />
      </div>

      {/* Bugkritiskt (mörkt läge): hela den här varningsrutan använde
          hårdkodad #991b1b/#fca5a5 istället för --status-red-text/
          -bg — de togs INTE om i mörkt läge (till skillnad från
          variablerna), så texten blev en nästan omöjlig-att-läsa
          mörk maroon mot en halvtransparent mörkröd bakgrund. Samma
          tema-variabler som resten av sidan överallt nu istället. */}
      <div style={{ marginTop: '14px', padding: '14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', maxWidth: FORM_MAX }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 700, marginBottom: '8px' }}>
          <Hash size={16} /> {tr('ui.numreringsserie')}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          {tr('ui.nasta_fakturanummer_raknas_normalt_automatiskt_f')}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{tr('ui.golv_for_nasta_fakturanummer')}</label>
            <input
              type="number" value={nextInvoiceNumberInput} onChange={e => { setNextInvoiceNumberInput(e.target.value); setInvoiceNumberError(''); }}
              placeholder={String(maxUsedInvoiceNumber + 1)}
              style={{ ...inputBase, width: '160px' }}
            />
          </div>
          <button onClick={saveNextInvoiceNumber} style={btnPrimary}>{tr('ui.spara_golv')}</button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {company?.nextInvoiceNumber ? tr('ui.aktivt_golv', { nextInvoiceNumber: company.nextInvoiceNumber }) : ''}{tr('ui.hogsta_anvanda_fakturanummer_just_nu')} {maxUsedInvoiceNumber || '—'}.
          </span>
        </div>
        {invoiceNumberError && <div style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{invoiceNumberError}</div>}
      </div>

      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX, marginTop: '14px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>{tr('ui.fakturadatum_pa_nya_fakturor')}</label>
          <select
            value={company?.invoiceDateMode || 'today'}
            onChange={e => setCompanyInfo({ ...company, invoiceDateMode: e.target.value })}
            style={{ ...inputBase, background: 'var(--bg-card)' }}
          >
            <option value="today">{tr('ui.dagens_datum')}</option>
            <option value="blank">{tr('ui.tomt_fylls_i_for_hand')}</option>
          </select>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>{tr('ui.betalningsuppgifter_pa_fakturan')}</label>
          <ToggleSwitch
            checked={company?.showPaymentDetailsOnInvoice !== false}
            onChange={() => setCompanyInfo({ ...company, showPaymentDetailsOnInvoice: !(company?.showPaymentDetailsOnInvoice !== false) })}
            label={tr('ui.visa_bankgiro_plusgiro_iban_pa_fakturan')}
          />
        </div>
      </div>
    </div>
  );

  // Påminnelser och e-post — dagarna var tidigare fasta (3/7, api/cron/
  // reminders.js), nu redigerbara per företag. Samma jsonb-plats som
  // notifications-fälten redan lever på (company.notifications), så ingen
  // ny sparväg behövs.
  const invoiceReminderCard = (
    <div style={card}>
      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
        <AutoField
          label={tr('ui.paminnelse_efter_forfallodatum_dagar')} type="number"
          value={company?.notifications?.invoiceReminderDays ?? 3}
          onChange={(v) => setCompanyInfo({ ...company, notifications: { ...(company?.notifications || {}), invoiceReminderDays: Number(v) || 3 } })}
        />
        <AutoField
          label={tr('ui.momsdeklaration_paminn_x_dagar_innan')} type="number"
          value={company?.notifications?.declarationReminderDays ?? 7}
          onChange={(v) => setCompanyInfo({ ...company, notifications: { ...(company?.notifications || {}), declarationReminderDays: Number(v) || 7 } })}
        />
      </div>

      <div style={{ marginTop: '18px', marginBottom: '10px' }}><SectionHeading icon={Mail} tone="blue">{tr('ui.e_postinstallningar')}</SectionHeading></div>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px', maxWidth: FORM_MAX }}>
        {tr('ui.taggar')} {'{{kundnamn}}'}, {'{{fakturanummer}}'}, {'{{belopp}}'}, {'{{förfallodatum}}'} {tr('ui.ersatts_automatiskt_nar_mejlet_skickas_tomt_falt')}
      </p>
      <div style={{ maxWidth: FORM_MAX }}>
        <AutoField label={tr('ui.amnesrad')} value={company?.invoiceEmailSubject || ''} onChange={(v) => setCompanyInfo({ ...company, invoiceEmailSubject: v })} placeholder={'Faktura {{fakturanummer}} från ' + (company?.name || 'ditt företag')} />
        <div style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>{tr('ui.meddelande')}</label>
          <textarea
            value={company?.invoiceEmailBody || ''}
            onChange={e => setCompanyInfo({ ...company, invoiceEmailBody: e.target.value })}
            placeholder={'Hej {{kundnamn}},\n\nBifogat finns faktura {{fakturanummer}} på {{belopp}}, med förfallodatum {{förfallodatum}}.'}
            rows={4}
            style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>
    </div>
  );

  return (
    // Kundfeedback (padding-genomgången, Skatt/Inställningar/Rapport): den
    // här sidan hade en egen, betydligt större kant-marginal (32/40/48px)
    // än resten av appens numera enhetliga 24px — kvarlämnad sedan innan
    // "ingen space"-städningen, eftersom .main-content-inners bas-padding
    // (index.css) redan nollställdes men den här sidans EGEN inline-padding
    // aldrig rördes. Trimmad vidare till 20px (uppföljning, "inte så mycket
    // space") — matchar ListPageHeaders eget 20px-sidoinset istället för
    // att vara en egen, större siffra bara den här sidan hade.
    <div className="settings-page" style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page, #f4f7f5)', display: 'flex', flexDirection: 'column' }}>
      {/* Samma sidhuvud och flikrad som varje annan sida i appen
          (Kunder, Fakturering, Bokföring …). Tidigare hade den här sidan
          ett eget, avvikande huvud med en stor grön ikonplatta och en 232px
          bred sidomeny — kundfeedback: "jag gillar inte att den ligger i
          sidan i stället för i toppen", och ikonen efterfrågades bort.
          Uppföljning (skärmdump av en ny referensbild): en LITEN
          ikonbadge bredvid "Inställningar" ville kunden ha tillbaka —
          bara på ÖVERSIKTEN (inte när man står i en flik), och bara här
          via `title` som ett JSX-nod i stället för en sträng, inte genom
          att ändra ListPageHeader självt. Ingen annan sida i appen
          påverkas, och den gamla stora ikonplattan/sidomenyn kommer
          inte tillbaka — bara en 34px badge inline med rubriktexten. */}
      {isPhone ? (
      <ListPageHeader
        title={activeSection ? (subPage ? subPage.title : activeSection.label) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: 34, height: 34, borderRadius: '10px', background: 'var(--bg-sidebar)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Cog size={18} />
            </span>
            {tr('ui.installningar')}
          </span>
        )}
        subtitle={activeSection ? (SECTION_META[activeSection.id]?.desc || '') : undefined}
        actions={activeSection
          ? [{ key: 'back', label: tr('ui.alla_installningar'), icon: ArrowLeft, onClick: () => handleSetTab(null) }]
          : []}
        // Piller-flikar (ListPageHeader): åtta flikar får inte plats på en
        // rad, och den understrukna standardraden skrollade då i sidled så
        // att de sista (Utseende, Din data) låg utanför skärmkanten —
        // kundfeedback: "man kan inte se dem, man måste skrolla". Pillren
        // radbryter i stället; alla åtta syns samtidigt och är ett tryck
        // bort, på bred skärm såväl som på telefon.
        // Ingen flikrad. Sektionerna väljs i översikten (SettingsHub) och
        // en väg tillbaka dit finns i sidhuvudet ("Alla inställningar")
        // när man står i en flik.
      />
      ) : (
        <ListPageHeader title={tr('ui.installningar')} />
      )}

      {/* Ett maxWidth/margin-auto-tak fanns tidigare inte alls här (se
          git-historik: togs bort medvetet, "ett tak lämnar bara tomma
          pixlar i var kant"). Kundönskemål, uppföljning: ÖVERSIKTEN
          (SettingsHub, hela rutnätet) ska fortfarande fylla hela bredden
          — den blev nyss BREDARE/större av det skälet — men EN VALD FLIK
          (formulärkort, en spalt) ska vara centrerad i stället för att
          klistra sig mot vänsterkanten på en bred/helskärmsmonitor: "allt
          ligger på vänster sida i helskärm, gör det i mitten". Taket
          gäller därför bara när `activeSection` är satt (en flik är
          öppen), aldrig hubben. 1200px räcker för `.settings-grid`s
          bredaste 3-kolumnersfall och för FORM_MAX (920px) med kortets
          egen padding runt om — brett nog för läsbart innehåll, smalt
          nog för att faktiskt centrera i stället för att fortsätta
          sträcka sig kant i kant. */}
      <div className={isPhone ? 'settings-shell' : 'settings-shell has-nav'}>
      {!isPhone && <SettingsNav sections={visibleSections} activeId={activeSection?.id} onPick={handleSetTab} />}
      <div data-tour="page-settings-nav" className="settings-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div className={isPhone ? undefined : 'settings-body'} style={{ minWidth: 0 }}>
          {subPage && (
            <button type="button" className="settings-back" onClick={subPage.back}>
              <ArrowLeft size={15} /> {activeSection.label}
            </button>
          )}
          {!isPhone && activeSection && (
            <header className="settings-title">
              <h1>{subPage ? subPage.title : activeSection.label}</h1>
            </header>
          )}
          {!activeSection && <SettingsHub sections={visibleSections} onPick={handleSetTab} />}
          {!activeSection && (onOpenHelp || onLogout) && (
            <div className="settings-account-rows">
              {onOpenHelp && (
                <button type="button" className="settings-account-row" onClick={onOpenHelp}>
                  <span className="settings-account-icon"><HelpCircle size={20} /></span>
                  <span className="settings-account-title">{tr('ui.hjalp_och_support')}</span>
                  <ArrowRight size={16} className="settings-account-arrow" />
                </button>
              )}
              {onLogout && (
                <button type="button" className="settings-account-row settings-account-row--danger" onClick={onLogout}>
                  <span className="settings-account-icon"><LogOut size={20} /></span>
                  <span className="settings-account-title">{tr('ui.logga_ut')}</span>
                </button>
              )}
            </div>
          )}
          {/* 1. Säkerhet (hette Min profil) — kundönskemål (skärmdump av en
              mockup): tre fullbreda kort staplade under varandra
              ("Profiluppgifter"/"Säkerhet"/aktiva sessioner), varje kort
              med en kort gråtonad underrubrik direkt under titeln, i
              stället för de fyra jämnstora korten i en 2-kolumns-split som
              låg här förut. Samma FÄRGER som resten av appen (BRAND/
              var(--...)-tokens) rakt igenom — mockupen var bara en
              formmall, inte en ny palett. IdentityCard-banderollen
              (namn+roll+företag i en egen remsa högst upp) togs bort
              HÄRIFRÅN specifikt: "Profiluppgifter"-kortets egen avatar+namn
              gör samma jobb nu, en remsa till hade bara upprepat samma
              namn två gånger på samma skärm.
              "Aviseringar" (en tidigare mockups tredje kort, e-post-
              påminnelser att slå på/av) fanns INTE med här — det fanns då
              ingen riktig inställning bakom en sådan växel att koppla den
              till. Det gör det nu: "Automatiska påminnelser" (den riktiga
              växeln, tidigare under Företag) har flyttat till en egen
              Notiser-flik, se activeTab === 'notifications' nedan — en helt
              annan flik än den här, inte samma kort.
              Fliken bytte id/etikett från 'profile'/"Min profil" till
              'security'/"Säkerhet" i samband med att sidans översikt (Settings-
              Hub) matchades mot en ny referensbild vars åtta kort inte hade
              något eget "profil"-kort — se SETTINGS_TABS-kommentaren högre
              upp i filen. Innehållet (Profiluppgifter/Säkerhet/sessioner)
              är oförändrat, bara flikens namn och plats i rutnätet. */}
          {activeTab === 'profile' && (
            <div style={{ animation: 'fadeIn 0.2s ease', display: 'grid', gap: 0 }}>
              <SettingCard title={tr('ui.profiluppgifter')} icon={UserRound} description={tr('ui.dina_uppgifter_visas_for_kollegor_och_i_det_du_g')} style={{ borderRadius: 0 }}>
                <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                  <AutoField label={tr('ui.fornamn')} value={firstName} onChange={(v) => updateUserMeta({ first_name: v })} hint={tr('ui.det_du_vill_bli_kallad')} />
                  <AutoField label={tr('ui.efternamn')} value={lastName} onChange={(v) => updateUserMeta({ last_name: v })} />
                  <AutoField label={tr('ui.e_post_inloggning')} type="email" value={user?.email || ''} onChange={(v) => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } supabase.auth.updateUser({ email: v }); }} hint={tr('ui.kraver_att_du_bekraftar_via_e_post_innan_andring')} required />
                  <AutoField label={tr('ui.telefon')} type="tel" value={phone} onChange={(v) => updateUserMeta({ phone: v })} hint={tr('ui.valfritt_2')} />
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ animation: 'fadeIn 0.2s ease', display: 'grid', gap: 0 }}>
              <SettingCard title={tr('ui.inloggning')} icon={Lock} tone="blue" description={tr('ui.skydda_kontot_och_hall_koll_pa_din_inloggning')} style={{ borderRadius: 0 }}>
                <PasswordSection user={user} readOnly={readOnly} bare />
                {/* readOnly (demo): TwoFactorSection hämtar riktiga
                    MFA-faktorer från Supabase direkt vid mount — hoppas över
                    helt istället för att göra ett Supabase-anrop från en
                    icke-inloggad besökare. */}
                {readOnly
                  ? <SettingRow label={tr('ui.tvafaktorsautentisering')} description={tr('ui.kraver_ett_riktigt_konto_att_visa_och_aktivera')} last />
                  : <TwoFactorSection bare />}
              </SettingCard>

              {!readOnly && passkeysAvailable() && <PasskeySection />}

              <ActiveSessionsSection user={user} readOnly={readOnly} />

              {/* Säkerhetsinställningar — bara ägaren (inte en inbjuden
                  medlem, sharedAccess) sätter policyn för HELA företaget. */}
              {!sharedAccess && (
                <div style={{ ...card, borderRadius: 0 }}>
                  <div style={{ marginBottom: '8px' }}><SectionHeading icon={Shield} tone="amber">{tr('ui.sakerhetsinstallningar')}</SectionHeading></div>
                  <ToggleSwitch
                    checked={Boolean(company?.requireMfaForAllUsers)}
                    onChange={() => {
                      if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
                      const next = !company?.requireMfaForAllUsers;
                      setCompanyInfo({ ...company, requireMfaForAllUsers: next });
                      logAuditEvent(supabase, { companyId: company?.id, ownerUserId: user?.id, actorUserId: user?.id, actorEmail: user?.email, action: 'security.requireMfa', description: next ? tr('ui.kravde_tvastegsverifiering_for_alla_anvandare') : tr('ui.tog_bort_kravet_pa_tvastegsverifiering') });
                    }}
                    label={tr('ui.krav_tvastegsverifiering_for_alla_anvandare')}
                    hint={tr('ui.anvandare_utan_aktiverad_tvastegsverifiering_ser')}
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. Företag */}
          {activeTab === 'company' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* IdentityCard-banderollen (namn/org.nr/räkenskapsår/moms-
                  chips) borttagen på kundönskemål — dubblerade bara
                  formulärfälten direkt under, och för ett nytt, ännu
                  ifyllt företag läste "Nytt företag / Organisationsnummer
                  saknas" mer som ett fel än som en neutral startpunkt. */}

              {/* Kundönskemål ("funkar fortfarande inte, ta bara bort den
                  här sektionen"): företagsväxlaren/bort-knappen tagen bort
                  helt. Byte av aktivt företag sker fortfarande via
                  App.jsx:s egna vägar (profilmenyn), bara inte längre
                  härifrån. */}

              {/* Kundönskemål ("ska vara emerged med headern"): den här
                  fliken hade rubriken sagd TRE gånger på fyra rader — sidans
                  egen header ("Företag" + SECTION_META.company.desc), sedan
                  en SettingsSection till med samma titel ("Företagsuppgifter")
                  och en egen beskrivning, och INNANFÖR den en tredje rubrik
                  ("Grunduppgifter"). De två sista togs bort helt — sidans
                  header räcker, och dess beskrivning fick istället med sig
                  detaljen ("visas på fakturor...") som SettingsSection-
                  beskrivningen ägde förut.
                  Badgen provade ett tag INUTI sidhuvudet (ListPageHeader:s
                  children-prop) men kundfeedback ("ser inte bra ut, ge den
                  lite space") — tillbaka som en egen rad här, bara med ett
                  litet mellanrum ovanför kortet i stället för sidhuvudets
                  egen ram/bakgrund. */}

              <div style={card}>
                {/* Kundfeedback ("vet inte vad som händer"): fälten här och i
                    Kontaktuppgifter nedan autosparar INTE (kräver klick på
                    "Spara ändringar", se knappen efter Kontaktuppgifter) —
                    till skillnad från praktiskt taget alla andra fält på
                    hela sidan. AutoField:s egen "Sparat ✓" är avstängd på
                    dem (showSaveState=false nedan) så den inte ljuger om att
                    något redan är sparat — badgen i sektionsrubriken ovan
                    säger uttryckligen vad som gäller i stället för att bara
                    vara tyst om det. */}
                {!companyRegistrationComplete ? (
                  // "Jag har inget företag än" valdes vid registreringen
                  // (Auth.jsx) — samma org.nummer-uppslag/badge-mönster som
                  // där, men skriver till companyDraft och sparas via samma
                  // Spara ändringar+reauth-knapp längst ner som allt annat i
                  // det här kortet. Namnet går att sätta FRITT här (se
                  // api/company-access.js:s lås — orgNr tomt = ej avslutad
                  // registrering) — LÅSES först i och med att det sparas.
                  <div style={{ maxWidth: '672px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                      {tr('ui.organisationsnumret_och_namnet_du_sparar_blir_fo')}
                    </p>
                    <div>
                      <label style={labelStyle}>{tr('ui.organisationsnummer')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{tr('ui.n10_siffror')}</span></label>
                      <input
                        type="text" inputMode="numeric" style={inputBase} placeholder="556123-4567"
                        value={companyDraft?.orgNr || ''}
                        onChange={e => {
                          const formatted = formatOrgNr(e.target.value);
                          setCompanyDraft(d => ({ ...d, orgNr: formatted, name: '' }));
                          setCompanyRegLegalForm('');
                          companyRegLookup.handleOrgNrChange(formatted);
                        }}
                      />
                      {companyRegLookup.orgLookup.status === 'loading' && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>{tr('ui.hamtar_foretagsuppgifter')}</div>}
                      {companyRegLookup.orgLookup.status === 'error' && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>{companyRegLookup.orgLookup.message}</div>}
                      {companyRegLookup.orgLookup.status === 'firma' && (
                        <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                          <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} /><span>{companyRegLookup.orgLookup.message}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '14px' }}>
                      <label style={labelStyle}>{tr('ui.foretagsnamn')}</label>
                      <input
                        type="text" style={inputBase} placeholder={tr('ui.ex_mitt_foretag_ab')}
                        // 'Mitt Företag AB' är App.jsx:s platshållarnamn för
                        // just den här (oavslutade) registreringen — visas
                        // aldrig som om det vore ett riktigt ifyllt värde,
                        // annars ser fältet ut att redan innehålla ett svar.
                        // Genererar samtidigt en användbar bieffekt: skrivs
                        // inget ÖVER platshållaren är companyDraft.name
                        // fortfarande bokstavligen oförändrat mot company.name,
                        // så companyInfoDirty (och därmed Spara-knappen)
                        // förblir avstängd tills man faktiskt skrivit något.
                        value={companyDraft?.name === 'Mitt Företag AB' ? '' : (companyDraft?.name || '')}
                        onChange={e => setCompanyDraft(d => ({ ...d, name: e.target.value }))}
                      />
                      {companyRegDisplayedOrgType && (
                        <div style={{ marginTop: '9px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: BRAND.greenLight, borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark }}>
                          <Check size={13} /> {tr('ui.identifierad_som')} {companyRegDisplayedOrgType}
                        </div>
                      )}
                    </div>

                    {/* Resten av företagsuppgifterna, samma fält som ett
                        färdigregistrerat företag har. Kundfeedback: rutan
                        innehöll bara organisationsnummer och företagsnamn —
                        allt annat gick inte att fylla i förrän registreringen
                        var klar, trots att uppgifterna behövs på första
                        fakturan. */}
                    <FieldGroup title={tr('ui.adress_2')}>
                      <div style={{ maxWidth: '672px' }}>
                        <AutoField label={tr('ui.gatuadress')} value={companyDraft?.address || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, address: v })} showSaveState={false} />
                      </div>
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label={tr('ui.postnummer')} value={companyDraft?.postalCode || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, postalCode: v })} showSaveState={false} />
                        <AutoField label={tr('ui.ort')} value={companyDraft?.city || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, city: v })} showSaveState={false} />
                      </div>
                    </FieldGroup>

                    <FieldGroup title={tr('ui.kontakt_2')}>
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label={tr('ui.e_post')} type="email" value={companyDraft?.email || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, email: v })} showSaveState={false} />
                        <AutoField label={tr('ui.telefon')} type="tel" value={companyDraft?.phone || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, phone: v })} showSaveState={false} />
                      </div>
                    </FieldGroup>

                    {bankFieldsGroup}
                  </div>
                ) : (
                  <>
                    {/* Företagets IDENTITET — namnet och organisationsnumret.
                        Båda sattes en gång, vid registreringen, ur bolags-
                        registret och sparades då automatiskt; härifrån är de
                        låsta. Kundfeedback: "organisationsnumret och företags-
                        namnet ska sparas automatiskt och inte gå att ändra."
                        Org.numret var tidigare ett vanligt redigerbart fält
                        trots att HELA appen använder det som företagets
                        identitet (fakturor, moms- och AGI-filer till
                        Skatteverket, SIE-exporten, bolagsuppslagen) — en
                        felskrivning där gav fel uppgifter i deklarationer utan
                        att något sa ifrån. Låset sitter på riktigt i
                        api/company-access.js (servern vägrar skrivningen även
                        med ett giltigt reauthToken); det här är bara
                        återspeglingen av samma regel. */}
                    <FieldGroup title={tr('ui.foretag')}>
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <LockedField label={tr('ui.foretagsnamn')} value={company?.name || '—'} />
                      <LockedField label={tr('ui.organisationsnummer')} value={company?.orgNr || '—'} />
                    </div>
                    {/* Förklaringen till låset och "hämta uppgifterna åt mig"
                        på SAMMA rad — de hör ihop (båda handlar om var
                        företagets uppgifter kommer ifrån) och tog tidigare
                        två egna rader med luft emellan.
                        Hämtar adress och momsnummer ur bolagsregistret i
                        stället för att man skriver av dem för hand — samma
                        uppslag som vid registrering och i kundregistret.
                        Fyller bara i utkastet; inget sparas förrän man
                        klickar Spara ändringar längst ner. */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', maxWidth: FORM_MAX, margin: '-2px 0 14px' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', flex: '1 1 300px', minWidth: 0, lineHeight: 1.55 }}>
                        {tr('ui.foretagets_registrerade_uppgifter_de_sparades_au')} <a href="mailto:support@bokix.se" style={{ color: BRAND.green }}>{tr('ui.support_bokix_se')}</a> {tr('ui.om_nagot_blivit_fel')}
                      </div>
                      {(!(companyDraft?.address && companyDraft?.postalCode && companyDraft?.city) || ['loading', 'done', 'error', 'firma'].includes(companyDetailsLookup.orgLookup.status)) && <div style={{ flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={handleFetchCompanyDetails}
                          disabled={String(companyDraft?.orgNr || '').replace(/\D/g, '').length !== 10 || companyDetailsLookup.orgLookup.status === 'loading'}
                          style={{
                            ...btnSecondary,
                            cursor: String(companyDraft?.orgNr || '').replace(/\D/g, '').length === 10 ? 'pointer' : 'not-allowed',
                            opacity: String(companyDraft?.orgNr || '').replace(/\D/g, '').length === 10 ? 1 : 0.55,
                          }}
                        >
                          <Building2 size={14} />
                          {companyDetailsLookup.orgLookup.status === 'loading' ? tr('ui.hamtar') : tr('ui.hamta_bolagsuppgifter')}
                        </button>
                        {companyDetailsLookup.orgLookup.status === 'done' && (
                          <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                            <Check size={13} /> {tr('ui.hamtat_kontrollera_falten_och_klicka_spara_andri')}
                          </div>
                        )}
                        {(companyDetailsLookup.orgLookup.status === 'error' || companyDetailsLookup.orgLookup.status === 'firma') && (
                          <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>{companyDetailsLookup.orgLookup.message}</div>
                        )}
                      </div>}
                    </div>
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <AutoField label={tr('ui.momsregistreringsnummer')} value={companyDraft?.vatNr || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, vatNr: v })} showSaveState={false} hint={tr('ui.se_organisationsnumret_01')} />
                      {/* Fritt visningsnamn för fakturor — separat från det
                          låsta registrerade namnet ovan (se InvoiceDocument.jsx:s
                          motsvarande fallback). Tomt = använd det registrerade
                          namnet, precis som innan den här möjligheten fanns. */}
                      <AutoField
                        label={tr('ui.visningsnamn_pa_faktura')} value={companyDraft?.invoiceDisplayName || ''}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, invoiceDisplayName: v })}
                        hint={tr('ui.anvands_pa_fakturor_om_ni_ar_kanda_under_ett_ann')}
                        showSaveState={false}
                      />
                    </div>
                    {/* Adressen som tre riktiga fält (kundönskemål) i stället
                        för en fritextrad. Gammal data ligger kvar i `address`
                        och skrivs ut precis som förut tills man fyller i
                        postnummer/ort — se utils/companyAddress.js.
                        Alla tre på EN rad (gata brett, postnummer och ort
                        smalt) i stället för tre rader under varandra — samma
                        uppgift, en tredjedel av höjden, och kortets bredd
                        används i stället för att stå tom till höger.
                        .form-row-stack staplar dem på mobil. */}
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <AutoField
                        label={tr('ui.f_skattsedel_text_pa_faktura')} value={companyDraft?.fSkatt || 'Innehar F-skattsedel'}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, fSkatt: v })}
                        hint={tr('ui.skrivs_ut_pa_fakturor_tom_om_det_inte_stammer')}
                        showSaveState={false}
                      />
                    </div>
                    </FieldGroup>

                    <FieldGroup title={tr('ui.adress_2')}>
                    <div className="form-row-stack" style={{ ...grid2, gridTemplateColumns: '2fr 1fr 1fr', maxWidth: FORM_MAX }}>
                      <AutoField label={tr('ui.gatuadress')} value={companyDraft?.address || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, address: v })} showSaveState={false} />
                      <AutoField label={tr('ui.postnummer')} value={companyDraft?.postalCode || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, postalCode: v })} showSaveState={false} />
                      <AutoField label={tr('ui.ort')} value={companyDraft?.city || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, city: v })} showSaveState={false} />
                    </div>
                    </FieldGroup>
                    {/* F-skattsedel skrivs ut på varenda faktura/offert (se InvoiceDocument)
                        men gick tidigare inte att ändra någonstans — den föll tillbaka på
                        en hårdkodad text ("Innehar F-skattsedel") som INTE nödvändigtvis
                        stämmer för alla företagsformer. Görs redigerbar här istället för
                        att tyst påstå något om företaget som kanske inte är sant. */}


                    {/* Kontakt och bank i SAMMA kort som grunduppgifterna —
                        kundfeedback: det ska vara en familj, inte tre kort
                        man letar mellan. */}
                    <FieldGroup title={tr('ui.kontakt_2')}>
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label={tr('ui.e_post')} type="email" value={companyDraft?.email || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, email: v })} showSaveState={false} />
                        <AutoField label={tr('ui.telefon')} type="tel" value={companyDraft?.phone || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, phone: v })} showSaveState={false} />
                      </div>
                    </FieldGroup>

                    {bankFieldsGroup}
                  </>
                )}
              </div>


              {/* Grunduppgifter/Kontaktuppgifter ovan autosparar INTE, de
                  kräver ett uttryckligt klick här — men ingen emailad kod
                  längre (borttaget, se saveCompanyInfo ovan): namn och
                  org.nummer är redan låsta oavsett, det är den riktiga
                  spärren (api/company-access.js), så koden skyddade i
                  praktiken bara adress/kontakt/momsnummer. Övriga
                  företagsfält (Logotyp, Räkenskapsår/moms, påminnelser,
                  Bankuppgifter i Betalning-fliken) är opåverkade, autosparar
                  som förut. */}
              <div style={{ marginBottom: '28px' }}>
                {/* Uttryckligen vad knappen sparar — utan den här raden
                    ser den ut som en global "spara hela sidan"-knapp,
                    trots att den bara gäller de två korten ovanför. */}
                <button
                  type="button"
                  onClick={() => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } saveCompanyInfo(); }}
                  disabled={!companyInfoDirty || companySaveBusy}
                  style={{ ...btnPrimary, opacity: (!companyInfoDirty || companySaveBusy) ? 0.5 : 1, cursor: (!companyInfoDirty || companySaveBusy) ? 'not-allowed' : 'pointer' }}
                >
                  {companySaveBusy ? tr('ui.sparar_2') : tr('ui.spara_andringar')}
                </button>
                {companyInfoDirty && !companySaveBusy && <span style={{ marginLeft: '12px' }}><Badge tone="warning">{tr('ui.osparade_andringar')}</Badge></span>}
                {companySaveError && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{companySaveError}</div>}
                {companySaveSuccess && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>{tr('ui.foretagsuppgifterna_ar_sparade')}</div>}
              </div>

              {/* Kundönskemål: sektionsrubriken ("Bokföringsår, logotyp och
                  påminnelser"/"Sparas direkt.") borttagen — korten under
                  säger redan var för sig vad de är, en extra rubrikrad
                  ovanför var bara upprepning. */}
              {/* De autosparande korten i ett rutnät — fyra fullbreda block
                  under varandra gjorde att man skrollade förbi tomma högerhalvor
                  för att hitta nästa inställning (kundfeedback om sidan). */}
              <div className="settings-grid">
              {/* Kundönskemål: logotypuppladdningen fanns dubblerad — samma
                  fält (company.logoUrl), samma "max 3 MB"-gräns, en gång här
                  och en gång i Fakturor → Mallar → Anpassa mallen
                  (InvoiceTemplateSection ovan, som dessutom visar den mot en
                  RIKTIG fakturaförhandsgranskning istället för den här
                  kortets tre grå skissrader). Den här kortet borttaget helt
                  — logotypen hör hemma där mallen faktiskt väljs och
                  förhandsgranskas, inte spridd på två ställen som kan se ut
                  att vara olika inställningar men skriver till samma fält. */}

              {/* Räkenskapsår styr verkliga beräkningar (Taxes, VatDeclaration,
                  Reports, Verifications). Momsperiod flyttad till System →
                  Moms (referensbildens gruppering) — samma fält,
                  company.vatPeriod, bara ett annat kort. */}
              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Calendar} tone="amber">{tr('ui.rakenskapsar')}</SectionHeading></div>
                <div style={{ maxWidth: '320px' }}>
                  <AutoField label={tr('ui.rakenskapsar_startar')} type="date" value={company?.fiscalYear || ''} onChange={(v) => setCompanyInfo({ ...company, fiscalYear: v })} />
                </div>
                {company?.firstFiscalYear?.start && (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '10px 0 0' }}>
                    {tr('ui.forsta_rakenskapsaret')} {company.firstFiscalYear.start} – {company.firstFiscalYear.end}.
                  </p>
                )}
              </div>

              </div>
            </div>
          )}

          {/* System — moms, kontoplan, verifikationsserier, valuta,
              datumformat och händelselogg.
              Kundfeedback (uppföljning): "fel gruppering/layout" på den
              tidigare versionen — Moms/Valuta/Datumformat låg ihop i EN
              generisk "Bokföringsinställningar"-grupp trots att de är tre
              olika SORTERS inställning (en bokföringsregel, en juridisk
              låsning, en ren visningspreferens), och en tom "Säkerhet"-
              platshållare som bara pekade vidare till en annan flik gjorde
              sidan kännas ofärdig i stället för att faktiskt hjälpa till.
              Omgrupperat efter VAD inställningen faktiskt styr:
                · Bokföring        — moms + verifikationsnumrering, båda
                                      regler bokföringen räknar efter.
                · Region och format — valuta + datumformat, båda rena
                                      visnings-/formatval, ingen
                                      bokföringslogik.
                · Kontoplan/Händelselogg — egna, tyngre verktyg, kvar som
                                      hela sektioner för sig (ett rutnät av
                                      korten ovanpå hade klämt in dem).
              "Säkerhet"-platshållaren borttagen helt — den upprepade bara
              flikens namn utan att tillföra något; den riktiga länken dit
              finns redan i sidhuvudets flikrad. */}
          {activeTab === 'system' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Accounted-stil: en rad per inställning, etiketten till vänster
                  och kontrollen till höger. */}
              {enabledFeatures && (
                <SettingCard title={tr('ui.funktioner_titel')} description={tr('ui.funktioner_beskrivning')}>
                  {[
                    { id: 'articles', label: tr('ui.funktion_artiklar'), description: tr('ui.funktion_artiklar_desc') },
                    { id: 'projects', label: tr('ui.funktion_projekt'), description: tr('ui.funktion_projekt_desc') },
                    { id: 'accruals', label: tr('ui.funktion_periodiseringar'), description: tr('ui.funktion_periodiseringar_desc') },
                    { id: 'fixed_assets', label: tr('ui.funktion_anlaggningstillgangar'), description: tr('ui.funktion_anlaggningstillgangar_desc') },
                  ].map((row, i, all) => (
                    <SettingRow key={row.id} label={row.label} description={row.description} last={i === all.length - 1}>
                      <ToggleSwitch
                        checked={Boolean(enabledFeatures[row.id])}
                        disabled={readOnly}
                        onChange={() => setCompanyInfo({ ...company, features: { ...(company?.features || {}), [row.id]: !enabledFeatures[row.id] } })}
                      />
                    </SettingRow>
                  ))}
                </SettingCard>
              )}
              <SettingCard title={tr('ui.moms')} description={tr('ui.hur_ofta_du_redovisar_moms')}>
                <SettingRow label={tr('ui.momsregistrerat_2')} last={company?.vatRegistered === false}>
                  <select
                    value={company?.vatRegistered === true ? 'yes' : company?.vatRegistered === false ? 'no' : ''}
                    onChange={e => setCompanyInfo({ ...company, vatRegistered: e.target.value === '' ? null : e.target.value === 'yes' })}
                    disabled={readOnly}
                    aria-label={tr('ui.momsregistrerat_2')}
                    style={{ ...inputBase, background: 'var(--bg-card)', width: '220px' }}
                  >
                    <option value="">{tr('ui.inte_angivet')}</option>
                    <option value="yes">{tr('ui.ja')}</option>
                    <option value="no">{tr('ui.nej')}</option>
                  </select>
                </SettingRow>
                {company?.vatRegistered !== false ? (
                  <SettingRow label={tr('ui.momsperiod')} last>
                    <select
                      value={company?.vatPeriod || 'quarterly'}
                      onChange={e => setCompanyInfo({ ...company, vatPeriod: e.target.value })}
                      aria-label={tr('ui.momsperiod')}
                      style={{ ...inputBase, background: 'var(--bg-card)', width: '220px' }}
                    >
                      <option value="monthly">{tr('ui.manadsvis')}</option>
                      <option value="quarterly">{tr('ui.kvartalsvis')}</option>
                      <option value="yearly">{tr('ui.helarlig')}</option>
                    </select>
                  </SettingRow>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.6 }}>
                    {tr('ui.ingen_moms_pa_fakturor_momsen_pa_inkop_bokfors_s')}
                  </p>
                )}
              </SettingCard>

              <SettingCard title={tr('ui.verifikationsserier')}>
                <VerificationSeriesList company={company} setCompanyInfo={setCompanyInfo} verifications={verifications} readOnly={readOnly} />
              </SettingCard>

              <SettingCard title={tr('ui.valuta_och_datum')}>
                <SettingRow label={tr('ui.redovisningsvaluta')}>
                  <select value="SEK" disabled aria-label={tr('ui.redovisningsvaluta')} style={{ ...inputBase, background: 'var(--bg-muted)', color: 'var(--text-secondary)', width: '220px', cursor: 'not-allowed' }}>
                    <option value="SEK">{tr('ui.svenska_kronor_sek')}</option>
                  </select>
                </SettingRow>
                <SettingRow label={tr('ui.datumformat')} last>
                  <select
                    value={dateFormatPref}
                    onChange={e => saveDateFormatPref(e.target.value)}
                    aria-label={tr('ui.datumformat')}
                    style={{ ...inputBase, background: 'var(--bg-card)', width: '220px' }}
                  >
                    {DATE_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label} {tr('ui.t_ex')} {f.example})</option>)}
                  </select>
                </SettingRow>
              </SettingCard>

              <SettingCard title={tr('ui.handelselogg')} description={tr('ui.vem_andrade_vad_i_foretaget_och_nar')}>
                <AuditLogCard company={company} readOnly={readOnly} />
              </SettingCard>
            </div>
          )}

          {/* Avancerat — export/import/radera. Låg tidigare i Företag; egen
              flik nu (referensbildens "🗑️ Avancerat") eftersom det är sällan
              använda, hög-blast-radius-handlingar som inte hör hemma bredvid
              vardagliga fält som adress och telefonnummer. */}
          {/* Import och export (hette Avancerat). Accounted-stil: en lista där
              varje rad gör en sak, och radering på en egen undersida. */}
          {activeTab === 'advanced' && !advancedView && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <input ref={backupInputRef} type="file" accept="application/json" onChange={handleImportFile} disabled={importBusy} style={{ display: 'none' }} />
              {sieOpeningsNeedRepair && onRepairSieOpenings && !readOnly && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', background: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{tr('ui.sie_ib_dubbel_titel')}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{tr('ui.sie_ib_dubbel_text')}</div>
                  <button type="button" onClick={onRepairSieOpenings} style={{ padding: '8px 14px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{tr('ui.sie_ib_dubbel_knapp')}</button>
                </div>
              )}
              <SettingCard title={tr('ui.importera')} flush>
                <SettingsLinkRow
                  title={tr('ui.flytta_hit_bokforingen')}
                  description={tr('ui.fran_ett_annat_program_via_sie4')}
                  onClick={() => setShowSieImport(true)}
                >
                  <span className="settings-link-chips">
                    {MIGRATION_SOURCES.map(p => (
                      <span key={p.id} className="settings-link-chip" title={p.note ? p.name + ' — ' + p.note : p.name}>
                        <span className="settings-link-chip-logo"><ProgramLogo src={p.logo} alt="" size={14} /></span> {p.name}
                      </span>
                    ))}
                  </span>
                </SettingsLinkRow>
                <SettingsLinkRow
                  title={tr('ui.skattekontoutdrag')}
                  description={tr('ui.bokfor_preliminarskatt_moms_rantor_och_inbetalni')}
                  onClick={readOnly ? undefined : () => setShowSkattekontoImport(true)}
                />
                {onOpenRotRutImport && (
                  <SettingsLinkRow
                    title={tr('rotRut.import.settingsTitle')}
                    description={tr('rotRut.import.settingsDescription')}
                    onClick={readOnly ? undefined : onOpenRotRutImport}
                  />
                )}
                <SettingsLinkRow
                  title={tr('ui.underlag_till_sie_import')}
                  description={tr('ui.filer_som_heter_som_verifikatet_till_exempel_a31')}
                  onClick={readOnly ? undefined : () => setShowSieAttachments(true)}
                />
                <SettingsLinkRow
                  title={importBusy ? tr('ui.importerar') : tr('ui.las_in_sakerhetskopia')}
                  description={tr('ui.las_in_sakerhetskopia_desc')}
                  onClick={importBusy ? undefined : () => backupInputRef.current?.click()}
                />
              </SettingCard>
              {importMsg && (
                <div style={{ fontSize: '12.5px', margin: '10px 0 0', fontWeight: 600, color: importMsg.startsWith('Kunde inte') ? 'var(--status-red-text)' : BRAND.greenDark }}>{importMsg}</div>
              )}

              {sieBatches.length > 0 && (
                <SettingCard title={tr('ui.sie_importer_titel')} description={tr('ui.sie_importer_beskrivning')} flush>
                  {sieBatches.map(b => (
                    <SettingsLinkRow
                      key={b.tag}
                      title={b.fileName}
                      description={tr('ui.sie_import_rad', { count: b.count, from: b.from || '', to: b.to || '' })}
                      right={canDeleteSieImport ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSieImport(b)}
                          style={{ padding: '6px 12px', background: 'transparent', color: 'var(--status-red-text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {tr('ui.ta_bort')}
                        </button>
                      ) : null}
                    />
                  ))}
                </SettingCard>
              )}

              <SettingCard title={tr('ui.exportera')} flush>
                <SettingsLinkRow
                  title={tr('ui.sie4_fil')}
                  description={tr('ui.ge_filen_till_din_revisor_eller_ta_med_bokforing')}
                  onClick={handleExportSie}
                  right={<Download size={18} className="settings-link-chevron" />}
                />
                <SettingsLinkRow
                  title={tr('ui.sakerhetskopia')}
                  description={tr('ui.konton_verifikationer_fakturor_kvitton_och_konta')}
                  onClick={handleExport}
                  right={<Download size={18} className="settings-link-chevron" />}
                />
              </SettingCard>

              <SettingCard title={tr('ui.radera')} flush>
                <SettingsLinkRow
                  danger
                  title={tr('ui.radera_foretagets_bokforingsdata')}
                  description={tr('ui.gar_inte_att_angra_ladda_ner_en_kopia_forst')}
                  onClick={() => setAdvancedView('delete-data')}
                />
                {onDeleteCompany && (
                  <SettingsLinkRow
                    danger
                    title={tr('ui.radera_foretag')}
                    description={tr('ui.tar_bort_hela_foretaget_inklusive_dess_prenumera')}
                    onClick={() => setAdvancedView('delete-company')}
                  />
                )}
              </SettingCard>
            </div>
          )}

          {activeTab === 'advanced' && advancedView === 'delete-data' && (
            <div style={{ animation: 'fadeIn 0.2s ease', paddingTop: '14px' }}>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 18px', maxWidth: '600px', lineHeight: 1.6 }}>
                  {tr('ui.detta_tommer_all_bokforing_alla_fakturor_kunder')} <strong>{company?.name || tr('ui.det_har_foretaget')}</strong> {tr('ui.i_appen_det_kan_inte_angras_har_bokforingslagen')}{user?.email}{tr('ui.paverkas_inte_och_du_loggas_inte_ut_foretaget_sj')}
                </p>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {tr('ui.skriv_foretagsnamnet')} <strong>{company?.name}</strong> {tr('ui.for_att_bekrafta')}
                </label>
                <input
                  value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ ...inputBase, width: '100%', maxWidth: '340px', marginBottom: '12px' }}
                />
                <div>
                  <button
                    disabled={!deleteMatches}
                    onClick={async () => { if (deleteMatches && (await onReset?.())) { setDeleteConfirmText(''); logAuditEvent(supabase, { companyId: activeCompanyId, ownerUserId: user?.id, actorUserId: user?.id, actorEmail: user?.email, action: 'data.delete', description: tr('ui.raderade_all_bokforingsdata_for', { v0: company?.name || 'företaget' }) }); } }}
                    style={{ ...btnDanger, opacity: deleteMatches ? 1 : 0.45, cursor: deleteMatches ? 'pointer' : 'not-allowed' }}
                  >
                    <Trash2 size={14} /> {tr('ui.radera_permanent')}
                  </button>
                </div>
            </div>
          )}

          {/* Radera företag — skild från Radera data: den här tar bort
              företaget självt (och avslutar dess prenumeration). */}
          {activeTab === 'advanced' && advancedView === 'delete-company' && onDeleteCompany && (
            <div style={{ animation: 'fadeIn 0.2s ease', paddingTop: '14px' }}>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 18px', maxWidth: '600px', lineHeight: 1.6 }}>
                      {tr('ui.foretaget_forsvinner_helt_fran_ditt_konto_och_en')}{user?.email}{tr('ui.paverkas_inte_men_du_maste_ha_minst_ett_foretag')}
                    </p>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {tr('ui.skriv_foretagsnamnet')} <strong>{company?.name}</strong> {tr('ui.for_att_bekrafta')}
                    </label>
                    <input
                      value={deleteCompanyConfirmText} onChange={e => setDeleteCompanyConfirmText(e.target.value)}
                      style={{ ...inputBase, width: '100%', maxWidth: '340px', marginBottom: '12px' }}
                    />
                    <div>
                      <button
                        disabled={!deleteCompanyMatches}
                        onClick={() => {
                          if (!deleteCompanyMatches) return;
                          if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
                          logAuditEvent(supabase, { companyId: activeCompanyId, ownerUserId: user?.id, actorUserId: user?.id, actorEmail: user?.email, action: 'company.delete', description: tr('ui.raderade_foretaget', { v0: company?.name || '' }) });
                          onDeleteCompany(activeCompanyId);
                          setDeleteCompanyConfirmText('');
                        }}
                        style={{ ...btnDanger, opacity: deleteCompanyMatches ? 1 : 0.45, cursor: deleteCompanyMatches ? 'pointer' : 'not-allowed' }}
                      >
                        <Trash2 size={14} /> {tr('ui.radera_foretaget_permanent')}
                      </button>
                    </div>

            </div>
          )}

          {/* Fakturor */}
          {activeTab === 'invoice' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title={tr('ui.standardvarden')}
                description={tr('ui.fylls_i_automatiskt_pa_nya_fakturor')}
              >
                {invoiceDefaultsCard}
              </SettingsSection>

              <SettingsSection
                title={tr('ui.paminnelser_och_e_post')}
                description={tr('ui.styr_utskicken_fran_api_cron_reminders_js')}
              >
                {invoiceReminderCard}
              </SettingsSection>

              <SettingsSection
                title={tr('ui.utseende')}
                description={tr('ui.forhandsvisningen_ar_vad_kunden_far')}
              >

                <InvoiceTemplateSection company={company} setCompanyInfo={setCompanyInfo} user={user} readOnly={readOnly} />
              </SettingsSection>
            </div>
          )}

          {/* 5. Användare och Åtkomst */}
          {activeTab === 'users' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title={tr('ui.vem_kommer_at_foretaget')}
                description={tr('ui.upp_till_tva_personer_utover_dig_var_och_en_med')}
              >
              <UsersAndAccessSection company={company} setCompanyInfo={setCompanyInfo} user={user} firstName={firstName} lastName={lastName} sharedAccess={sharedAccess} readOnly={readOnly} />
              </SettingsSection>
            </div>
          )}

          {/* Prenumeration */}
          {activeTab === 'subscription' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              
              {/* Plan och kvitton sida vid sida — kvittolistan är oftast en
                  rad och behöver ingen egen skärmhöjd (kundfeedback: för
                  mycket tomrum). */}
              <div className="settings-split">
                <SettingsSection title={tr('ui.din_plan')} description={tr('ui.vad_bokix_kostar_for_det_har_foretaget')}>
                  {/* UF-konton har ingen prenumerationsrad alls —
                      registreringen hoppar över Stripe helt (Auth.jsx). Den
                      vanliga vyn hade laddat, hittat noll rader och visat
                      "ingen aktiv prenumeration", vilket låter som ett fel
                      på ett konto som fungerar precis som det ska. */}
                  {isUfCompany(company)
                    ? <UfSubscriptionCard company={company} canClose={!sharedAccess && !readOnly} />
                    : <SubscriptionSection user={user} company={company} sharedAccess={sharedAccess} readOnly={readOnly} />}
                </SettingsSection>

                {!isUfCompany(company) && !sharedAccess ? (
                  <SettingsSection title={tr('ui.betalningsuppgifter')} description={tr('ui.byt_kort_eller_se_fakturor_kvitton_hos_stripe')}>
                    <SettingCard>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                        <BillingPortalButton companyId={company?.requiresOwnPayment ? company.id : null} label={tr('ui.byt_betalkort')} />
                        <BillingPortalButton companyId={company?.requiresOwnPayment ? company.id : null} label={tr('ui.se_fakturor_kvitton')} showInvoices />
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.6 }}>{tr('ui.oppnas_hos_stripe_i_en_ny_flik')}</p>
                    </SettingCard>
                  </SettingsSection>
                ) : (
                  <SettingsSection title={tr('ui.kvitton')} description={tr('ui.dyker_upp_efter_forsta_dragningen')}>
                    <SettingCard>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tr('ui.ingen_betalhistorik_annu')}</div>
                    </SettingCard>
                  </SettingsSection>
                )}
              </div>

              <SettingsSection title={tr('ui.anvandning')} description={tr('ui.hur_mycket_du_anvander_bokix_till')}>
                <UsageCard invoices={invoices} verifications={verifications} contacts={contacts} expenses={expenses} />
              </SettingsSection>
            </div>
          )}


          {/* 4. Integrationer — egen flik. Kundfeedback: "integrationsdelen
              ska vara sin egen sak och mycket bättre". Låg tidigare som ett
              kort längst ner under Data, medan Stripe och e-postdomänen låg
              på en tredje flik (Betalning) — tre ställen för samma fråga:
              vad är kopplat till mitt Bokix? */}
          {/* Kopplingar: en lista, och varje koppling öppnar en egen sida
              (kundönskemål: inte fälla ut detaljerna under listan). Anslut
              ligger kvar på raden för det som inte är anslutet ännu, så
              det fortfarande går att ansluta med ett klick. */}
          {activeTab === 'integrations' && !openIntegration && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingCard flush>
                {['email-inbox', 'stripe', 'zettle', 'gmail', 'business-email', 'calendar'].map(id => integrationCatalogue.find(i => i.id === id)).filter(Boolean).map(item => (
                  <SettingsLinkRow
                    key={item.id}
                    logo={item.logo}
                    logoLarge
                    title={item.name}
                    status={<span className="settings-link-status-inline"><LinkStatus on={item.connected}>{item.statusLabel || (item.connected ? tr('ui.ansluten') : tr('ui.inte_ansluten'))}</LinkStatus></span>}
                    description={item.connectedAs || item.tagline}
                    aside={<LinkStatus on={item.connected}>{item.statusLabel || (item.connected ? tr('ui.ansluten') : tr('ui.inte_ansluten'))}</LinkStatus>}
                    onClick={item.detail ? () => setOpenIntegration(item.id) : undefined}
                    right={item.detail ? undefined : item.action}
                  />
                ))}
              </SettingCard>
            </div>
          )}

          {activeTab === 'integrations' && openIntegration && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {openIntegration === 'stripe' && stripeCard}
              {openIntegration === 'zettle' && zettleCard}
              {openIntegration === 'calendar' && calendarCard}
              {openIntegration === 'email-inbox' && emailInboxCard}
              {openIntegration === 'gmail' && gmailCard}
              {openIntegration === 'business-email' && businessEmailCard}
            </div>
          )}

          {/* 7. Utseende — allt som handlar om hur appen SER UT för mig.
              Låg tidigare utspritt: temat bara i topbaren/profilmenyn,
              hälsningen under Min profil, sidomeny/scrollbar längst ner i
              Data. Kundfeedback pekade ut exakt den uppdelningen. */}
          {activeTab === 'appearance' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Tema och Visning sida vid sida. Var för sig är de två korta
                  listor som bredde ut sig över hela skärmbredden — en
                  av/på-växel hamnade en halv skärm från sin egen etikett
                  (kundfeedback: "i helskärm är det så mycket space"). */}
              <div className="settings-split">
              <SettingsSection
                title={t('settings.appearance.theme')}
                description={t('settings.appearance.themeHint')}
              >
                <SettingCard>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'light', label: t('settings.appearance.themeLight'), icon: Sun, hint: t('settings.appearance.themeLightHint') },
                      { id: 'dark', label: t('settings.appearance.themeDark'), icon: Moon, hint: t('settings.appearance.themeDarkHint') },
                      { id: 'system', label: t('settings.appearance.themeSystem'), icon: Laptop, hint: t('settings.appearance.themeSystemHint') },
                    ].map(opt => {
                      const active = themePreference === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onSetThemePreference?.(opt.id)}
                          aria-pressed={active}
                          style={{
                            flex: '1 1 160px', textAlign: 'left', padding: '14px 16px', borderRadius: '12px',
                            cursor: active ? 'default' : 'pointer', fontFamily: 'inherit',
                            border: '1.5px solid ' + (active ? BRAND.green : 'var(--border)'),
                            background: active ? BRAND.greenLight : 'var(--bg-card)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', fontWeight: 700, color: active ? BRAND.greenDark : 'var(--text-main)' }}>
                            <opt.icon size={16} /> {opt.label}
                            {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
                          </span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: active ? BRAND.greenDark : 'var(--text-secondary)', marginTop: '4px' }}>{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>
              </SettingsSection>

              <SettingsSection
                title={t('settings.appearance.density')}
                description={t('settings.appearance.densityHint')}
              >
                <SettingCard>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'normal', label: t('settings.appearance.densityNormal'), hint: t('settings.appearance.densityNormalHint') },
                      { id: 'compact', label: t('settings.appearance.densityCompact'), hint: t('settings.appearance.densityCompactHint') },
                    ].map(opt => {
                      const active = density === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onSetDensity?.(opt.id)}
                          aria-pressed={active}
                          style={{
                            flex: '1 1 160px', textAlign: 'left', padding: '14px 16px', borderRadius: '12px',
                            cursor: active ? 'default' : 'pointer', fontFamily: 'inherit',
                            border: '1.5px solid ' + (active ? BRAND.green : 'var(--border)'),
                            background: active ? BRAND.greenLight : 'var(--bg-card)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', fontWeight: 700, color: active ? BRAND.greenDark : 'var(--text-main)' }}>
                            {opt.label}
                            {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
                          </span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: active ? BRAND.greenDark : 'var(--text-secondary)', marginTop: '4px' }}>{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>
              </SettingsSection>

              <SettingsSection
                title={t('settings.appearance.language')}
                description={t('settings.appearance.languageHint')}
              >
                <SettingCard>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'sv', label: t('settings.appearance.languageSv') },
                      { id: 'en', label: t('settings.appearance.languageEn') },
                    ].map(opt => {
                      const active = language === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (opt.id === getLanguage()) return;
                            setLanguage(opt.id);
                            // En del texter räknas ut när sidan laddas (listor och
                            // tabellrubriker), så sidan laddas om för att allt ska byta språk.
                            window.location.reload();
                          }}
                          aria-pressed={active}
                          style={{
                            flex: '1 1 160px', textAlign: 'left', padding: '14px 16px', borderRadius: '12px',
                            cursor: active ? 'default' : 'pointer', fontFamily: 'inherit',
                            border: '1.5px solid ' + (active ? BRAND.green : 'var(--border)'),
                            background: active ? BRAND.greenLight : 'var(--bg-card)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', fontWeight: 700, color: active ? BRAND.greenDark : 'var(--text-main)' }}>
                            {opt.label}
                            {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>
              </SettingsSection>

              <SettingsSection
                title={tr('ui.visning')}
                description={tr('ui.sparas_direkt')}
              >
                <SettingCard>
                  <SettingRow
                    label={tr('ui.mork_sidomeny')}
                    description={tr('ui.mork_sidomeny_med_ljus_app_i_ovrigt')}
                  >
                    <ToggleSwitch checked={sidebarStyle === 'dark'} onChange={() => onToggleSidebarStyle?.()} />
                  </SettingRow>
                  <SettingRow
                    label={tr('ui.dolj_scrollbar')}
                    description={tr('ui.sidan_skrollar_som_vanligt_handtaget_syns_inte')}
                  >
                    <ToggleSwitch checked={hideScrollbar} onChange={() => onToggleHideScrollbar?.()} />
                  </SettingRow>
                  <SettingRow
                    label={tr('ui.halsning_pa_startsidan')}
                    description={tr('ui.halsning_av_doljer', { g: greetingPreview, name: firstName || tr('ui.anvandare') })}
                    last
                  >
                    <ToggleSwitch
                      checked={user?.user_metadata?.show_dashboard_greeting !== false}
                      onChange={(e) => updateUserMeta({ show_dashboard_greeting: e.target.checked })}
                      disabled={readOnly}
                    />
                  </SettingRow>
                </SettingCard>
              </SettingsSection>
              </div>
            </div>
          )}

          {/* 8. Notiser — egen flik (var tidigare ett kort längst ner under
              Företag). Referensbildens åtta kort hade ett eget "Notiser"-
              kort ("E-post, påminnelser och meddelanden"), så den enda
              riktiga notisinställningen som finns i appen — den automatiska
              påminnelse-cronen — flyttade hit i stället för att sidan
              skulle behöva hitta på ett kort utan riktigt innehåll bakom.
              Kundönskemål (en längre listad flikspec, sex kategorier: Fakturor/
              Betalningar/Förfallna fakturor/Moms & deklaration/System-
              meddelanden/E-postnotiser). Fem av sex är nu riktiga, kopplade
              till en verklig utskicksgren — inte bara etiketter:
                · E-postnotiser      huvudströmbrytare, gated i BÅDA
                                      utskicksställena (denna fil skriver
                                      bara fältet — se App.jsx:s
                                      handleRegisterInvoicePayment och
                                      api/cron/reminders.js för själva
                                      gaten)
                · Fakturor            betalningskvitto till KUNDEN när en
                                      faktura blir helt betald
                                      (App.jsx: handleRegisterInvoicePayment)
                · Betalningar         mejl till FÖRETAGET självt vid samma
                                      tillfälle
                · Förfallna fakturor  påminnelse till kunden, N dagar efter
                                      förfallodatum (api/cron/reminders.js,
                                      oförändrad sedan förra ronden)
                · Moms & deklaration  påminnelse till företaget, N dagar
                                      före moms-/AGI-deadline (samma fil)
              "Systemmeddelanden" (produktnyheter/driftmeddelanden) är
              INTE med — det finns ingen sådan funktion i Bokix än (inget
              att skicka), och en växel utan något att styra hade bara
              vilselett (samma princip som "1. Säkerhet"-kommentaren ovan om
              den borttagna Aviseringar-växeln). Kräver en egen funktion
              (ett changelog/driftstatus-innehåll att skicka FRÅN) innan
              den kan bli riktig — en TODO för sig, inte en enkel
              vidarekoppling som de fem andra. */}
          {activeTab === 'notifications' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title={tr('ui.automatiska_paminnelser')}
                description={tr('ui.e_postnotiser_styr_alla_kategorier_nedan_gemensa')}
              >
              <SettingCard>
                <SettingRow
                  label={tr('ui.e_postnotiser')}
                  description={tr('ui.huvudstrombrytare_av_stanger_alla_kategorier_ned')}
                >
                  <ToggleSwitch
                    checked={emailNotificationsOn}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, emailNotificationsEnabled: e.target.checked } })}
                    disabled={readOnly}
                  />
                </SettingRow>
                <SettingRow
                  label={tr('ui.fakturor')}
                  description={tr('ui.betalningskvitto_till_kunden_nar_en_faktura_blir')}
                >
                  <ToggleSwitch
                    checked={company?.notifications?.invoiceReceiptsEnabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, invoiceReceiptsEnabled: e.target.checked } })}
                    disabled={readOnly || !emailNotificationsOn}
                  />
                </SettingRow>
                <SettingRow
                  label={tr('ui.betalningar')}
                  description={tr('ui.mejl_till_er_nar_en_faktura_blir_helt_betald')}
                >
                  <ToggleSwitch
                    checked={company?.notifications?.paymentRemindersEnabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, paymentRemindersEnabled: e.target.checked } })}
                    disabled={readOnly || !emailNotificationsOn}
                  />
                </SettingRow>
                <SettingRow
                  label={tr('ui.forfallna_fakturor')}
                  description={tr('ui.paminnelse_till_kunden_3_dagar_efter_forfallodat')}
                >
                  <ToggleSwitch
                    checked={company?.notifications?.invoiceRemindersEnabled ?? company?.notifications?.enabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, invoiceRemindersEnabled: e.target.checked } })}
                    disabled={readOnly || !emailNotificationsOn}
                  />
                </SettingRow>
                <SettingRow
                  label={tr('ui.moms_deklaration')}
                  description={tr('ui.paminnelse_till_er_7_dagar_fore_moms_och_agi_dea')}
                >
                  <ToggleSwitch
                    checked={company?.notifications?.declarationRemindersEnabled ?? company?.notifications?.enabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, declarationRemindersEnabled: e.target.checked } })}
                    disabled={readOnly || !emailNotificationsOn}
                  />
                </SettingRow>
                {/* Daglig sammanfattning, api/cron/_inboxDigest.js. */}
                <SettingRow
                  label={tr('ui.nytt_i_e_postinkorgen')}
                  description={tr('ui.nytt_i_e_postinkorgen_desc')}
                >
                  <ToggleSwitch
                    checked={company?.notifications?.inboxDigestEnabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, inboxDigestEnabled: e.target.checked } })}
                    disabled={readOnly || !emailNotificationsOn}
                  />
                </SettingRow>
                <SettingRow
                  label={tr('ui.systemmeddelanden')}
                  description={tr('ui.kommer_senare_bokix_har_i_dagslaget_inga_produkt')}
                  last
                >
                  <ToggleSwitch checked={false} onChange={() => {}} disabled />
                </SettingRow>
              </SettingCard>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>
      </div>

      {showSkattekontoImport && (
        <SkattekontoImportModal
          company={company}
          accounts={accounts}
          verifications={verifications}
          onImport={(newVerifications, newAccounts, sourceTag) => onBulkImportSie?.(newVerifications, newAccounts, sourceTag)}
          onClose={() => setShowSkattekontoImport(false)}
        />
      )}

      {showSieAttachments && (
        <SieAttachmentsModal
          company={company}
          verifications={verifications}
          user={user}
          onAttach={(updates) => onAttachVerificationFiles?.(updates)}
          onClose={() => setShowSieAttachments(false)}
        />
      )}

      {showSieImport && (
        <SieImportModal
          accounts={accounts}
          verifications={verifications}
          company={company}
          onCloseYears={readOnly ? undefined : onCloseImportedYears}
          onOpenAttachments={readOnly ? undefined : () => setShowSieAttachments(true)}
          onImport={(newVerifications, newAccounts, sourceTag) => onBulkImportSie?.(newVerifications, newAccounts, sourceTag)}
          onClose={() => setShowSieImport(false)}
        />
      )}
    </div>
  );
}
