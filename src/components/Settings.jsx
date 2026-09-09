import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, CreditCard, Shield, Check, Download, Upload,
  Trash2, Mail, Laptop, Lock, KeyRound, Image as ImageIcon,
  Palette, Landmark, Hash, Calendar, Plus, X, ZoomIn, ZoomOut, Maximize2, Bell, ExternalLink, Sun, Moon,
  UserRound, FileText, Plug, Users, Database, Cog, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sendInvoiceEmail } from '../emailApi';
import { cancelStripeSubscription, reactivateStripeSubscription } from '../stripeApi';
import { BRAND, VIVID } from '../utils/brandColors';
import InvoiceDocument, { INVOICE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import ListTable from './shared/ListTable';
import ListPageHeader from './shared/ListPageHeader';
import { sendReauthCode, verifyReauthCode, changePassword } from '../utils/reauthVerification';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';
import { getGreeting } from '../utils/greeting';
import { confirmDialog } from './shared/ConfirmDialog';
import { downloadSie4 } from '../utils/sieExport';
import { planFromId, PLAN_TIERS } from '../utils/plans';
import { ACCESS_PAGES, ACCESS_LEVELS, defaultPageAccess, accessForPage } from '../utils/pageAccess';
import { isUfCompany, ufSettingsSections, ufFreePeriod, UF_FREE_MONTHS } from '../utils/ufMode';
import SieImportModal from './SieImportModal';
import { ProgramLogo } from './shared/BrandLogos';
import { MIGRATION_SOURCES } from '../utils/migrationSources';

// Visas istället för att faktiskt anropa Supabase när `readOnly` (Sida
// landningssidans demo, se DemoWorkspace.jsx) — samma text överallt i den
// här filen, en enda plats att ändra den på.
const DEMO_BLOCKED_MSG = 'Det här är bara en demo — skapa ett gratis konto för att göra det här på riktigt.';

// Stripes eget ordmärke ("stripe"-texten, inte S-monogrammet) — vektorpaths
// hämtade rakt av från Stripes egen Wikimedia Commons-fil (deras officiella
// logga för "stripe" solo, färgen #635BFF är deras dokumenterade "blurple").
// Används bara här, bredvid Anslut Stripe-knappen, så det syns TYDLIGT
// vilken tjänst kortbetalningar går via — inte en generisk ikon.
function StripeLogo({ height = 16 }) {
  const width = (height * 360.02) / 149.84;
  return (
    <svg viewBox="54 36 360.02 149.84" width={width} height={height} xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
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
const btnStripeConnect = {
  display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '9px 18px 9px 16px',
  // Var hårdkodad #0a2540 (Stripes mörkblå) — osynlig mot det mörka
  // kortet i mörkt läge, samma sorts fel som resten av mörklägesronden.
  background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px',
  fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

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
function ZettleLogo({ height = 18 }) {
  const width = height * (3626 / 1612);
  return (
    <img
      src="/zettle-logo.png" alt="Zettle by PayPal" height={height} width={width}
      style={{ height, width, objectFit: 'contain', filter: 'var(--zettle-logo-filter, none)' }}
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
// man vill GÖRA, inte var koden råkade ligga:
//   · Min profil   — jag som person: namn, e-post, lösenord, 2FA, sessioner
//   · Företag      — företagets egna uppgifter, bank, räkenskapsår, logotyp
//   · Betalning    — hur kunder betalar mig (Stripe/Zettle, e-postdomän)
//   · Fakturamall  — hur mina fakturor ser ut
//   · Användare    — vem mer som kommer åt företaget
//   · Prenumeration— vad Bokix kostar mig
//   · Utseende     — hur appen ser ut för mig (tema, hälsning, sidomeny)
//   · Data         — exportera, importera, integrationer, radera
// "Utseende" är en egen flik just för att kundfeedbacken handlade om att
// den sortens val låg gömda längst ner i en flik som heter något annat.
//
// Namnen säger vad som finns bakom dem. "Data" var precis den sortens
// etikett kundfeedbacken tog som exempel ("Data? Vad är data?") — fliken
// heter fortfarande Din data, men varje sektion under den har en rubrik
// och en mening som svarar på frågan i stället för att lämna den öppen.
const SETTINGS_TABS = [
  { id: 'profile', label: 'Min profil' },
  { id: 'company', label: 'Företag' },
  { id: 'invoice', label: 'Fakturor' },
  { id: 'integrations', label: 'Integrationer' },
  { id: 'users', label: 'Användare' },
  { id: 'subscription', label: 'Prenumeration' },
  { id: 'appearance', label: 'Utseende' },
  { id: 'data', label: 'Din data' },
];

// ── Inställningarnas ingång ──────────────────────────────────────────────
// Kundfeedback, upprepad: sidan öppnade alltid i "Min profil" och kastade
// därmed in en som skulle till något helt annat mitt i ett formulär. Nu
// öppnar den i stället på en översikt där man VÄLJER område — och varje
// område beskrivs med en rad, så man slipper gissa vad "Din data" innehåller.
//
// Ikon och beskrivning bor här bredvid etiketten (SETTINGS_TABS ovan bär
// bara id + label eftersom flikraden inte har plats för mer).
const SECTION_META = {
  profile: { icon: UserRound, desc: 'Namn, e-post, lösenord och tvåstegsverifiering.' },
  company: { icon: Building2, desc: 'Företagsuppgifter, adress, räkenskapsår och kontoplan.' },
  invoice: { icon: FileText, desc: 'Fakturamall, logotyp, betalvillkor och numrering.' },
  integrations: { icon: Plug, desc: 'Stripe, Zettle och egen avsändardomän för mejl.' },
  users: { icon: Users, desc: 'Bjud in kollegor och styr vad de får se.' },
  subscription: { icon: CreditCard, desc: 'Din plan, kvitton och uppsägning.' },
  appearance: { icon: Palette, desc: 'Ljust eller mörkt, sidomeny och småsaker i gränssnittet.' },
  data: { icon: Database, desc: 'Exportera, importera SIE, säkerhetskopiera och radera.' },
};

/** Översikten. Ett tätt rutnät som fyller bredden — åtta kort på två rader
 * på en vanlig skärm, i stället för två små rutor och en halv skärm tom
 * yta (vilket var precis vad flikarna gav när man landade på en kort
 * flik). */
function SettingsHub({ sections, onPick }) {
  return (
    <div className="settings-hub">
      {sections.map(section => {
        const meta = SECTION_META[section.id] || {};
        const Icon = meta.icon || Cog;
        return (
          <button
            key={section.id}
            type="button"
            className="settings-hub-card"
            onClick={() => onPick(section.id)}
          >
            <span className="settings-hub-icon"><Icon size={17} /></span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{section.label}</span>
              {meta.desc && <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '2px' }}>{meta.desc}</span>}
            </span>
            <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0, alignSelf: 'center' }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Delade stilar ──
// Bugkritiskt (Sida 15): varje sektion är ett fullbrett, ljust kort — inte
// smala vita kort med stor luft runt om.
const card = {
  background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', marginBottom: '12px', width: '100%', boxSizing: 'border-box',
  border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};
// Sida 38, punkt 2: kolumnbredden lever i CSS-klassen .form-row-2
// (index.css) istället för här, så mobilens 1-kolumns-överskrivning
// (@media max-width 768px) kan träffa den — se samma kommentar i
// Contacts.jsx/EmployeeForm.jsx. Varje användning nedan får
// className="form-row-2" också.
const grid2 = { display: 'grid', gap: '12px' };
// Takbredden på en formulärrad. Kundfeedback ("i helskärm är det så mycket
// space"): tvåkolumnsraderna stod fast på 672px mitt i ett kort som är
// dubbelt så brett på en stor skärm, så halva kortet var tomt. 920px låter
// raden fylla kortet betydligt bättre utan att ett enskilt fält blir en
// löpmeter brett — och betyder ingenting på mobil, där .form-row-2 ändå
// staplar till en kolumn (index.css).
const FORM_MAX = '920px';
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
const btnPrimary = { padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(11, 99, 41, 0.25)' };
// Knappen i en integrationsbricka — liten, tydlig, samma i alla brickor.
const btnTile = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
  background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)',
  borderRadius: '999px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit',
};

const btnSecondary = { padding: '9px 18px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };
const btnGhost = { padding: '9px 14px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
// Säkerhetsförsvagande handling (t.ex. stänga av tvåstegsverifiering) — dämpad
// varningston (amberBg/amberText), inte samma neutrala grå som vanliga
// sekundärknappar och inte heller Bokix grönt (det är en primär, positiv
// handling-färg, fel signal för något som gör kontot mindre skyddat).
const btnWarning = { padding: '9px 18px', background: BRAND.amberBg, color: BRAND.amberText, border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };
// Sällan använd säkerhetsåtgärd (utloggning av andra enheter) — tydligt röd
// men ghost/outline, inte en vardaglig spara-knapp.
const btnDangerGhost = { padding: '9px 18px', background: 'var(--bg-card)', color: 'var(--status-red-text)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };

// Färgad ikon-i-cirkel framför ett kortnamn — gör varje sektion visuellt
// identifierbar på en snabb blick istället för en lång lista av likadana
// svarta rubriker, och ger sidan starkare färg utan att den blir stökig.
// Kundfeedback ("bättre UI/UX, färgsättning, organiserat"): 16 av sidans 17
// SectionHeading-anrop stod tidigare på tone="green" — samma bleka
// status-badge-grönt (BRAND.greenLight/greenDark) överallt, oavsett vad
// sektionen faktiskt handlade om, vilket gjorde en lång sida med likadana
// gröna cirklar svårare att skanna, inte lättare. Samma VIVID-solid-ikon-
// behandling som Dashboard nu (se brandColors.js) — en distinkt kulör per
// ÄMNE (säkerhet=blått, utseende/varumärke=rosa, deadlines/påminnelser=
// gult, kärnidentitet/pengar=grönt, verktyg=neutral skiffer, radera=rött)
// istället för en enda upprepad ton, så färgen faktiskt hjälper till att
// gruppera sidan i huvudet på en snabb titt.
const SECTION_TONES = {
  green: VIVID.green,
  blue:  VIVID.blue,
  pink:  VIVID.pink,
  amber: VIVID.amber,
  red:   VIVID.red,
  gray:  '#64748b', // Neutral skiffer (verktyg/integrationer) — medvetet INTE en VIVID-brandkulör.
};
function SectionHeading({ icon: Icon, tone = 'green', children }) {
  const bg = SECTION_TONES[tone] || SECTION_TONES.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '10px', background: bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${bg}4d` }}>
        <Icon size={17} strokeWidth={2.3} />
      </div>
      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{children}</h3>
    </div>
  );
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
function ToggleSwitch({ checked, onChange, label, hint, disabled = false }) {
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
function SettingsSection({ title, description, children, actions }) {
  return (
    <section style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</h2>
          {description && (
            <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '620px' }}>{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function SettingCard({ title, icon: Icon, tone = 'green', badge, description, children, danger, style }) {
  const toneColor = danger ? 'var(--status-red-text)' : undefined;
  return (
    <div style={{
      background: danger ? 'var(--status-red-bg)' : 'var(--bg-card)',
      border: `1px solid ${danger ? 'transparent' : 'var(--border)'}`,
      borderRadius: '12px',
      boxShadow: danger ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
      overflow: 'hidden',
      minWidth: 0,
      ...style,
    }}>
      {(title || badge) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 13px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          {Icon && <SectionHeadingIcon icon={Icon} tone={danger ? 'red' : tone} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: toneColor || 'var(--text-main)' }}>{title}</div>
            {description && <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>{description}</div>}
          </div>
          {badge}
        </div>
      )}
      {children != null && <div style={{ padding: '14px' }}>{children}</div>}
    </div>
  );
}

/** Bara ikonplattan ur SectionHeading — SettingCard ritar sin egen titel. */
function SectionHeadingIcon({ icon: Icon, tone = 'green' }) {
  const tones = {
    green: VIVID.green, blue: VIVID.blue, amber: VIVID.amber,
    pink: VIVID.pink, red: VIVID.red, gray: 'var(--text-muted)',
  };
  return (
    <span style={{
      width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
      background: tones[tone] || tones.green, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={15} />
    </span>
  );
}

function SettingRow({ label, description, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-light)',
    }}>
      <div style={{ minWidth: '180px', flex: 1 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{label}</div>
        {description && <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.55, maxWidth: '460px' }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
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
function FieldGroup({ title, hint, children, first }) {
  return (
    <div style={{ marginTop: first ? 0 : '16px', paddingTop: first ? 0 : '14px', borderTop: first ? 'none' : '1px solid var(--border-light)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: hint ? '4px' : '9px' }}>{title}</div>
      {hint && <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 9px', lineHeight: 1.55 }}>{hint}</p>}
      {children}
    </div>
  );
}

/** Identitetskortet högst upp i en flik: vem/vad är det jag ändrar på?
 * Appen är flerföretags — utan det här svarade sidan aldrig på frågan.
 * Chipsen är riktiga uppgifter (bolagsform, räkenskapsår, momsperiod),
 * inte dekoration. */
function IdentityCard({ monogram, logoUrl, name, meta, chips = [], action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px',
      padding: '12px 16px', marginBottom: '14px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Tunn färgremsa i varumärkets gröna — sidans enda dekorativa
          element, och det som gör att kortet läses som "det här är du/ditt
          företag" i stället för som ännu ett formulärkort. */}
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: BRAND.green }} />
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '11px', objectFit: 'contain', background: 'white', border: '1px solid var(--border)', flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
          background: BRAND.greenLight, color: BRAND.greenDark,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em',
        }}>{monogram}</span>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-voice)', fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
        {meta && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>{meta}</div>}
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {chips.filter(Boolean).map(c => (
              <span key={c.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 11px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600,
                background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>{c.value}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

/** En bricka i integrationskatalogen: logotypen stor nog att kännas igen,
 * namnet, en rad om vad tjänsten gör, statusen och en knapp. Hela brickan
 * är klickbar när det finns inställningar att öppna — kundönskemål med en
 * referensbild på just den formen (sökbar katalog, ett kort per tjänst). */
function IntegrationTile({ logo, name, tagline, connected, statusLabel, action, onOpen, open }) {
  const clickable = Boolean(onOpen);
  return (
    <div
      onClick={clickable ? onOpen : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={clickable ? 'lp-card-hover' : undefined}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${open ? BRAND.green : 'var(--border)'}`,
        borderRadius: '14px', padding: '20px 20px 18px', minWidth: 0,
        display: 'flex', flexDirection: 'column', gap: '14px',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: open ? '0 4px 14px rgba(11, 99, 41, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '13px' }}>
        {/* Vit platta bakom varje logga: flera av dem har vit bakgrund
            inbakad och skulle annars se ut som klistermärken i mörkt läge —
            samma lösning som importguidens programloggor. */}
        {/* Plattan är alltid vit, så loggan måste alltid vara sin
            ljusa variant. Utan nollställningen nedan slog mörklägesfiltret
            (--zettle-logo-filter: brightness(0) invert(1), index.css) till
            och gjorde Zettle-loggan vit på vit platta — alltså osynlig,
            precis det kundfeedbacken pekade på. */}
        <span style={{ width: 46, height: 46, borderRadius: '12px', background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '--zettle-logo-filter': 'none' }}>
          {logo}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{name}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>{tagline}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: 'auto' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.02em',
          color: connected ? BRAND.greenDark : 'var(--text-muted)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? BRAND.green : 'var(--border)' }} />
          {statusLabel || (connected ? 'Ansluten' : 'Inte ansluten')}
        </span>
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
      </div>
    </div>
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
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Sidor</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Vad personen ser och får ändra.</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={() => setAll(role === 'editor' ? 'edit' : 'view')} style={btnTile}>Markera alla</button>
          <button type="button" onClick={() => setAll('none')} style={btnTile}>Rensa</button>
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
        Den som får redigera fakturor, utgifter eller bank kan skapa verifikationer även med Bokföring stängd.
      </p>
    </div>
  );
}

function relativeTimeSv(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just nu';
  if (mins < 60) return `för ${mins} ${mins === 1 ? 'minut' : 'minuter'} sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `för ${hours} ${hours === 1 ? 'timme' : 'timmar'} sedan`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `för ${days} ${days === 1 ? 'dag' : 'dagar'} sedan`;
  const months = Math.floor(days / 30);
  if (months < 12) return `för ${months} ${months === 1 ? 'månad' : 'månader'} sedan`;
  const years = Math.floor(months / 12);
  return `för ${years} ${years === 1 ? 'år' : 'år'} sedan`;
}

/** Bästa möjliga ärliga enhetsbeskrivning från webbläsarens egen user agent —
 * det enda vi faktiskt vet om den enhet man sitter på just nu. */
function detectDevice() {
  if (typeof navigator === 'undefined') return 'Okänd enhet';
  const ua = navigator.userAgent;
  let os = 'okänt OS';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'okänd webbläsare';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  return `${browser} på ${os}`;
}

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
    // två fältrader. 10px räcker för att fält inte ska klibba ihop.
    <div style={{ marginBottom: '10px' }}>
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
            {isSaving && <span style={{ color: 'var(--text-muted)' }}>Sparar...</span>}
            {isSaved && <span style={{ color: BRAND.greenDark, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}><Check size={12} /> Sparat</span>}
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
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Filen måste vara JPG eller PNG.'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Bilden får vara max 3 MB.'); return; }
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
      let friendly = msg || 'Uppladdningen misslyckades.';
      if (/bucket not found/i.test(msg)) friendly = `Bildlagring är inte konfigurerad ännu (bucket "${bucket}" saknas — kör storage-delen av supabase-setup.sql).`;
      else if (/mime type/i.test(msg)) friendly = 'Filen måste vara JPG eller PNG.';
      else if (/exceeded the maximum allowed size/i.test(msg)) friendly = 'Bilden får vara max 3 MB.';
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
          <Upload size={14} /> {busy ? 'Laddar upp...' : value ? 'Byt bild' : 'Ladda upp bild'}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} disabled={busy} style={btnGhost}>Ta bort</button>}
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
  { id: 'sample-1', description: 'Konsultation, webbutveckling', qty: 14, unitPrice: 950, vatRate: 25, discount: 0 },
  { id: 'sample-2', description: 'Programvarulicens, årsavgift', qty: 1, unitPrice: 3200, vatRate: 25, discount: 0 },
  { id: 'sample-3', description: 'Resekostnader', qty: 1, unitPrice: 640, vatRate: 25, discount: 0 },
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
      setError(err?.message || 'Kunde inte skicka koden just nu. Försök igen om en stund.');
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
    if (!/^\d{6}$/.test(code)) { setError('Ange den sexsiffriga koden från mejlet.'); return; }
    setStatus('verifying'); setError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const reauthToken = await verifyReauthCode({ accessToken: session?.access_token, code, token: otpToken });
      onVerified(reauthToken);
    } catch (err) {
      setError(err?.message || 'Fel kod. Försök igen.');
      setStatus('idle');
    }
  };

  return (
    <div style={{ background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', borderRadius: '12px', padding: '18px', maxWidth: '360px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', marginBottom: '6px' }}>Bekräfta med kod</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
        Vi skickade en sexsiffrig kod till din e-post — skriv in den för att bekräfta ändringen.
      </div>
      <input
        type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        style={{ ...inputBase, textAlign: 'center', fontSize: '22px', fontWeight: 700, letterSpacing: '8px' }}
      />
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', marginTop: '10px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px' }}>
        <button type="button" onClick={onCancel} style={btnGhost}>Avbryt</button>
        <button
          type="button" onClick={verify} disabled={status === 'verifying' || code.length !== 6}
          style={{ ...btnPrimary, opacity: (status === 'verifying' || code.length !== 6) ? 0.5 : 1, cursor: (status === 'verifying' || code.length !== 6) ? 'not-allowed' : 'pointer' }}
        >
          {status === 'verifying' ? 'Bekräftar...' : 'Bekräfta'}
        </button>
      </div>
      <button
        type="button" onClick={send} disabled={resendCooldown > 0 || status === 'sending'}
        style={{ marginTop: '10px', background: 'none', border: 'none', borderRadius: '8px', padding: '4px 8px', color: resendCooldown > 0 ? 'var(--text-muted)' : BRAND.green, fontWeight: 700, fontSize: '12px', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
      >
        {status === 'sending' ? 'Skickar…' : resendCooldown > 0 ? `Skicka koden igen (${resendCooldown}s)` : 'Fick du ingen kod? Skicka igen'}
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
function PasswordSection({ user, readOnly = false }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showReauth, setShowReauth] = useState(false);

  const changedAt = user?.user_metadata?.password_changed_at;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    if (newPw.length < 8) { setError('Nytt lösenord måste vara minst 8 tecken.'); return; }
    if (newPw !== confirmPw) { setError('Lösenorden matchar inte varandra.'); return; }
    setBusy(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
    setBusy(false);
    if (reauthError) {
      setError('Nuvarande lösenord stämmer inte.');
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
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setShowReauth(false);
      setError(err?.message || 'Kunde inte byta lösenord. Försök igen om en stund.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
        <SectionHeading icon={Lock} tone="blue">Lösenord</SectionHeading>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {changedAt ? `Senast ändrat ${relativeTimeSv(changedAt)}` : 'Inte spårat ännu — byt lösenord här för att börja spåra det'}
        </span>
      </div>
      {showReauth ? (
        <ReauthCodeStep onVerified={handleReauthVerified} onCancel={() => setShowReauth(false)} />
      ) : (
        <form onSubmit={submit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Nuvarande lösenord</label>
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{ ...inputBase, maxWidth: '340px' }} autoComplete="current-password" required />
          </div>
          <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
            <div>
              <label style={labelStyle}>Nytt lösenord</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label style={labelStyle}>Bekräfta nytt lösenord</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
            </div>
          </div>
          {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
          {success && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>Lösenordet är uppdaterat.</div>}
          <button type="submit" disabled={busy || !currentPw || !newPw || !confirmPw} style={{ ...btnPrimary, marginTop: '14px', opacity: (busy || !currentPw || !newPw || !confirmPw) ? 0.5 : 1, cursor: (busy || !currentPw || !newPw || !confirmPw) ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Kontrollerar...' : 'Byt lösenord'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Tvåstegsverifiering ──
// Riktig TOTP-registrering via Supabase Auth MFA (auth.mfa.*) — ingen
// simulerad på/av-switch. Status läses från faktiskt registrerade,
// verifierade faktorer på kontot.
function TwoFactorSection() {
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
    if (vErr) { setError('Fel kod. Kontrollera att klockan i autentiseringsappen är rätt inställd och försök igen.'); return; }
    setEnrolling(null); setCode('');
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId }).catch(() => {});
    setEnrolling(null); setCode(''); setError('');
  };

  const disable = async () => {
    if (!verifiedFactor) return;
    if (!(await confirmDialog('Inaktivera tvåstegsverifiering? Kontot blir skyddat av enbart lösenord igen.', { danger: true }))) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setBusy(false);
    if (error) { setError(error.message); return; }
    loadFactors();
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <SectionHeading icon={KeyRound} tone={verifiedFactor ? 'green' : 'amber'}>Tvåstegsverifiering</SectionHeading>
            {factors !== null && <Badge tone={verifiedFactor ? 'positive' : 'warning'}>{verifiedFactor ? 'På' : 'Av'}</Badge>}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px' }}>Kräver en engångskod från en autentiseringsapp (t.ex. Google Authenticator eller Authy) utöver lösenordet vid inloggning.</div>
        </div>
        {factors !== null && !enrolling && (
          verifiedFactor
            ? <button onClick={disable} disabled={busy} style={btnWarning}>Inaktivera</button>
            : <button onClick={startEnroll} disabled={busy} style={btnPrimary}>Aktivera</button>
        )}
      </div>
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
      {enrolling && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 12px' }}>Skanna koden med din autentiseringsapp, ange sedan den 6-siffriga koden den visar.</p>
          <img src={enrolling.qrCode} alt="QR-kod för tvåstegsverifiering" style={{ width: 160, height: 160, border: '1px solid var(--border)', borderRadius: '8px', display: 'block', marginBottom: '8px' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Kan du inte skanna? Ange koden manuellt: <code style={{ background: 'var(--border-light)', padding: '2px 6px', borderRadius: '4px' }}>{enrolling.secret}</code></div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" style={{ ...inputBase, width: '120px' }} />
            <button onClick={confirmEnroll} disabled={busy || code.length !== 6} style={{ ...btnPrimary, opacity: (busy || code.length !== 6) ? 0.5 : 1 }}>Bekräfta</button>
            <button onClick={cancelEnroll} disabled={busy} style={btnGhost}>Avbryt</button>
          </div>
        </div>
      )}
    </div>
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
    <div style={card}>
      <div style={{ marginBottom: '8px' }}><SectionHeading icon={Laptop} tone="blue">Aktiva sessioner</SectionHeading></div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: '560px' }}>
        Bokix kan i dagsläget inte visa en lista över dina enskilda inloggade enheter. Du kan däremot logga ut alla andra sessioner än den du sitter på just nu — t.ex. om du glömt logga ut på en delad dator eller en gammal telefon.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Laptop size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>{device}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
        </div>
        <Badge tone="positive">Denna enhet</Badge>
      </div>
      <button
        onClick={signOutOthers} disabled={busy}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--status-red-bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
        style={{ ...btnDangerGhost, opacity: busy ? 0.6 : 1, transition: 'background-color 0.12s' }}
      >{busy ? 'Loggar ut...' : 'Logga ut från alla andra enheter'}</button>
      {done && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>Klart — alla andra sessioner är utloggade.</div>}
      {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
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
    currency: 'SEK', logoUrl: company?.logoUrl, footerText: company?.invoiceFooterText, accentColor,
  };

  return (
    <>
      <div style={card}>
        <div style={{ marginBottom: '6px' }}><SectionHeading icon={Palette} tone="pink">Välj mall</SectionHeading></div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>
          Välj utseendet på dina utgående kund- och leverantörsfakturor. Redan skickade fakturor behåller sitt utseende — bara nya fakturor använder mallen du väljer här.
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
        <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="pink">Anpassa mallen</SectionHeading></div>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', maxWidth: '380px' }}>
            <div style={{ marginBottom: '18px' }}>
              <ImageUploadField label="Logotyp" value={company?.logoUrl || ''} onChange={(v) => setCompanyInfo({ ...company, logoUrl: v })} uploadPath={`${user?.id}/logo-${company?.id}`} bucket="companylogo" hint="JPG eller PNG, max 3 MB." readOnly={readOnly} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Accentfärg</label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>Din egen varumärkesfärg på fakturan — fritt val, inte begränsat till Bokix grönt.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color" value={accentColor}
                  onChange={e => setCompanyInfo({ ...company, invoiceAccentColor: e.target.value })}
                  style={{ width: '44px', height: '36px', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'var(--bg-card)' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{accentColor}</span>
                <button
                  type="button" onClick={() => setCompanyInfo({ ...company, invoiceAccentColor: BRAND.green })}
                  title="Använd Bokix grönt som accentfärg"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: BRAND.green, display: 'inline-block' }} /> Bokix grönt
                </button>
              </div>
            </div>

            <AutoField label="Tilläggsinformation / fottext" value={company?.invoiceFooterText || ''} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} hint="Visas längst ner på fakturan, t.ex. betalningsvillkor eller en hälsning." />
          </div>

          {/* minWidth 300px (mobil: 0) — annars vann minWidth-golvet över
              flexWrap på en 375px-skärm och tvingade förhandsvisningen
              lika brett-överskuret som gallerikorten ovan gjorde. */}
          <div style={{ flex: 1, minWidth: isMobile ? 0 : '300px', maxWidth: '500px', width: isMobile ? '100%' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live-förhandsvisning</div>
              <button
                type="button" onClick={() => setShowFullPreview(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: BRAND.greenDark, fontSize: '11.5px', fontWeight: 700, padding: '2px' }}
              >
                <Maximize2 size={12} /> Förhandsgranska
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
                <h2 className="modal-title" style={{ margin: 0, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Förhandsgranskning · {activeTpl.label}</h2>
                <button className="modal-close" onClick={() => setShowFullPreview(false)} style={{ flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Exempeldata — så här ser mallen ut, inte en riktig faktura.</span>
                <div style={{ flex: 1, minWidth: '8px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                    disabled={previewZoom <= 0.5} title="Zooma ut"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'none', border: 'none', borderRadius: '4px', color: previewZoom <= 0.5 ? 'var(--border)' : 'var(--text-main)', cursor: previewZoom <= 0.5 ? 'not-allowed' : 'pointer' }}
                  ><ZoomOut size={14} /></button>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '38px', textAlign: 'center', flexShrink: 0 }}>{Math.round(previewZoom * 100)}%</span>
                  <button
                    type="button" onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                    disabled={previewZoom >= 2} title="Zooma in"
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
  const roleLabel = role === 'editor' ? 'redigera' : 'se (läsbehörighet)';
  const safeInviter = escHtml(inviterName) || 'Någon';
  const safeCompany = escHtml(companyName) || 'sitt företag';
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

const ROLE_LABELS = { editor: 'Kan redigera', viewer: 'Kan bara läsa' };
const STATUS_LABELS = { pending: 'Väntar på svar', active: 'Aktiv', revoked: 'Återkallad' };
const STATUS_COLORS = {
  pending: { bg: BRAND.amberBg, text: BRAND.amberText },
  active: { bg: BRAND.greenLight, text: BRAND.greenDark },
  revoked: { bg: 'var(--border-light)', text: 'var(--text-muted)' },
};

function UsersAndAccessSection({ company, user, firstName, lastName, sharedAccess, readOnly = false }) {
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
  const [inviteRole, setInviteRole] = useState('editor');
  // Sidbehörigheter (utils/pageAccess.js). Förvalet är allt utom lön —
  // ägaren ändrar fritt innan inbjudan skickas.
  const [invitePages, setInvitePages] = useState(() => defaultPageAccess('editor'));
  // Vilken redan inbjuden persons behörigheter som är öppna för ändring.
  const [editingAccessId, setEditingAccessId] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const loadMembers = async () => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    // RLS avgör själv vad som faktiskt kommer tillbaka: ägaren ser hela
    // listan, en inbjuden gäst ser bara sin EGEN rad (se "Se egna
    // medlemskapsrader" i supabase-setup.sql) — inget extra filter behövs
    // här för att uppnå det, policyn gör jobbet.
    const { data, error } = await supabase
      .from('company_members')
      .select('id, invited_email, role, status, invited_at, expires_at, page_access')
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

  const handleInvite = async (e) => {
    e.preventDefault();
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    setInviteError(''); setInviteSuccess('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { setInviteError('Ange en giltig e-postadress.'); return; }
    setInviteBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from('company_members')
        .insert({ owner_user_id: user.id, company_id: company.id, invited_email: email, role: inviteRole, page_access: invitePages })
        .select()
        .single();
      if (error) throw error;

      // Skickar inbjudningsmejlet via samma Resend-relä som fakturautskick
      // (emailApi.js → api/email/send-invoice.js) — det bryr sig aldrig om
      // VILKET dokument som skickas, bara mottagare/ämne/HTML. Misslyckas
      // SJÄLVA UTSKICKET (t.ex. Resend nere) tas raden inte bort — ägaren
      // kan bjuda in igen, eller dela länken manuellt.
      const inviteUrl = `${window.location.origin}/invite?token=${inserted.invite_token}`;
      const html = buildInviteEmailHtml({
        companyName: company.name,
        inviterName: [firstName, lastName].filter(Boolean).join(' ') || user?.email,
        inviteUrl,
        role: inviteRole,
      });
      try {
        await sendInvoiceEmail({
          to: email,
          subject: `Du är inbjuden till ${company.name || 'ett företag'} på Bokix`,
          html,
          company_id: company.id,
        });
      } catch (sendErr) {
        console.error('Kunde inte skicka inbjudningsmejlet:', sendErr);
        setInviteSuccess(`Inbjudan skapad, men mejlet kunde inte skickas. Dela länken manuellt: ${inviteUrl}`);
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
      setInviteError(isDuplicate ? 'Den här personen är redan inbjuden till företaget.' : (err?.message || 'Kunde inte skicka inbjudan.'));
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
    if (!(await confirmDialog('Återkalla den här personens åtkomst till företaget?', { danger: true }))) return;
    await supabase.from('company_members').update({ status: 'revoked' }).eq('id', memberId);
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
            title={atCap ? 'Max 3 användare per företag (ägare + 2 inbjudna) — återkalla någon för att bjuda in en ny.' : undefined}
            style={atCap ? { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--border)', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'not-allowed' } : btnPrimary}
          >
            <Mail size={16} style={{ marginRight: 6, verticalAlign: '-3px' }} /> {showInviteForm ? 'Avbryt' : 'Bjud in användare'}
          </button>
        )}
      </div>

      {isOwner && atCap && !showInviteForm && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>Max 3 användare per företag är nått (du + 2 inbjudna). Återkalla någon nedan för att bjuda in en ny.</p>
      )}

      {isOwner && showInviteForm && (
        <form onSubmit={handleInvite} style={{ ...card, marginBottom: '16px' }}>
          <div className="form-row-2" style={grid2}>
            <div>
              <label style={labelStyle}>E-postadress</label>
              <input type="email" required autoFocus value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={inputBase} placeholder="namn@exempel.se" />
            </div>
            <div>
              <label style={labelStyle}>Roll</label>
              <select
                value={inviteRole}
                onChange={e => { setInviteRole(e.target.value); setInvitePages(defaultPageAccess(e.target.value)); }}
                style={inputBase}
              >
                <option value="editor">Kan redigera</option>
                <option value="viewer">Kan bara läsa</option>
              </select>
            </div>
          </div>

          {/* Kundönskemål: "man ska kunna välja vilka sidor hen kan se och
              redigera". Rollen är taket, listan nedan är detaljerna. */}
          <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
            <PageAccessPicker
              value={invitePages}
              role={inviteRole}
              onChange={setInvitePages}
            />
          </div>
          {inviteError && <p style={{ color: BRAND.redText, fontSize: '13px', marginTop: '10px' }}>{inviteError}</p>}
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={inviteBusy} style={{ ...btnPrimary, opacity: inviteBusy ? 0.6 : 1 }}>{inviteBusy ? 'Skickar…' : 'Skicka inbjudan'}</button>
            <button type="button" onClick={() => setShowInviteForm(false)} style={btnSecondary}>Avbryt</button>
          </div>
        </form>
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
            key: 'user', label: 'Användare', wrap: true, render: row => row.isOwnerRow ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{isOwner ? ([firstName, lastName].filter(Boolean).join(' ') || 'Ditt konto') : 'Ägare'}</div>
                {isOwner && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.email}</div>}
              </div>
            ) : (
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.invited_email}</div>
            ),
          },
          {
            key: 'role', label: 'Roll', render: row => row.isOwnerRow ? 'Administratör' : (
              isOwner && row.status !== 'revoked' ? (
                <select value={row.role} onChange={e => handleRoleChange(row.id, e.target.value)} style={{ ...inputBase, width: 'auto', padding: '4px 8px', fontSize: '13px' }}>
                  <option value="editor">Kan redigera</option>
                  <option value="viewer">Kan bara läsa</option>
                </select>
              ) : ROLE_LABELS[row.role] || row.role
            ),
          },
          {
            key: 'status', label: 'Status', render: row => row.isOwnerRow ? (
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: BRAND.greenLight, color: BRAND.greenDark }}>Aktiv</span>
            ) : (
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: STATUS_COLORS[row.status]?.bg, color: STATUS_COLORS[row.status]?.text }}>
                {STATUS_LABELS[row.status] || row.status}
              </span>
            ),
          },
          ...(isOwner ? [{
            key: 'access', label: 'Sidor', align: 'right', render: row => (!row.isOwnerRow && row.status !== 'revoked') ? (
              <button
                type="button"
                onClick={() => setEditingAccessId(editingAccessId === row.id ? null : row.id)}
                style={{ ...btnTile, padding: '5px 11px' }}
              >
                {editingAccessId === row.id ? 'Dölj' : 'Ändra'}
              </button>
            ) : null,
          }] : []),
          ...(isOwner ? [{
            key: 'actions', label: '', align: 'right', render: row => (!row.isOwnerRow && row.status !== 'revoked') ? (
              <button onClick={() => handleRevoke(row.id)} title="Återkalla åtkomst" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Trash2 size={15} />
              </button>
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
              Sidor för {member.invited_email}
            </div>
            <PageAccessPicker
              value={member.page_access}
              role={member.role}
              onChange={(next) => handlePageAccessChange(member.id, next)}
              compact
            />
            <div style={{ marginTop: '12px' }}>
              <button type="button" onClick={() => setEditingAccessId(null)} style={btnSecondary}>Klar</button>
            </div>
          </div>
        );
      })()}

      {!loading && members.length === 0 && isOwner && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px' }}>Inga andra användare inbjudna ännu.</p>
      )}
      {isOwner ? (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px', maxWidth: '560px' }}>Max 3 användare per företag (du + 2 inbjudna). Rollen sätter taket — "Kan bara läsa" kan aldrig spara något — och under Sidor väljer du exakt vilka delar personen ser och får ändra.</p>
      ) : (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px', maxWidth: '560px' }}>Du har blivit inbjuden till det här företaget av ägaren ({ROLE_LABELS[sharedAccess.role] || sharedAccess.role}-behörighet).</p>
      )}
    </div>
  );
}

const fmtDateSv = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)); } catch { return d; }
};

const SUBSCRIPTION_STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckades — försöker igen',
  canceled: 'Avslutad', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

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
function UfSubscriptionCard({ company }) {
  const period = ufFreePeriod(company?.ufStartedAt);
  const endsLabel = period.endsAt
    ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }).format(period.endsAt)
    : null;
  const daysLabel = typeof period.daysLeft === 'number' ? ' (' + period.daysLeft + ' dagar kvar)' : '';
  return (
    <SettingCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', background: BRAND.greenLight, color: BRAND.greenDark, fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          UF-konto
        </span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Gratis</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {period.expired ? (
          <>Gratisperioden på {UF_FREE_MONTHS} månader tog slut {endsLabel}. Bokföringen ligger kvar — hör av er till support@bokix.se så löser vi fortsättningen.</>
        ) : period.known ? (
          <>Gratis till och med <strong style={{ color: 'var(--text-main)' }}>{endsLabel}</strong>{daysLabel}. Inga betaluppgifter är registrerade, och ingenting börjar kosta automatiskt när perioden tar slut.</>
        ) : (
          <>Kontot är gratis i {UF_FREE_MONTHS} månader. Inga betaluppgifter är registrerade, och ingenting börjar kosta automatiskt.</>
        )}
      </div>
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
      setError(err.message || 'Kunde inte avsluta prenumerationen. Försök igen om en stund.');
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
      setError(err.message || 'Kunde inte återaktivera prenumerationen. Försök igen om en stund.');
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
            Du har åtkomst till det här företaget via en inbjudan från ägaren — det finns ingen egen prenumeration att hantera här. Frågor om fakturering går till den som bjöd in dig.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={card}><div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Läser in...</div></div>;
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
            Ingen betald plan är kopplad till det här företaget ännu. Så här ser nivåerna ut.
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
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-voice)', fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{tier.name}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tier.subtitle}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{tier.monthlyPrice}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>kr/mån</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>· {tier.yearlyMonthlyPrice} kr/mån på årsplan</span>
              </div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {[
                  'Bokföring, fakturor, offerter, kvitton och moms',
                  'Rapporter, bokslutsunderlag och SIE-export',
                  tier.includesPayroll ? 'Löner och arbetsgivardeklaration' : null,
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
  const priceLabel = `${plan ? plan.price : 179} kr/mån`;
  const statusBadge = sub.cancel_at_period_end
    ? { bg: 'var(--status-amber-bg)', text: 'var(--status-amber-text)', label: 'Avslutas' }
    : (sub.status === 'active' || sub.status === 'trialing')
      ? { bg: 'var(--status-green-bg)', text: 'var(--status-green-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status }
      : { bg: 'var(--status-red-bg)', text: 'var(--status-red-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Planen som ett riktigt plankort: priset stort, vad som ingår
          uppräknat, och statusen som ett eget fält — i stället för en rad
          text där pris, status och förnyelsedatum satt ihopklämda.
          Kundönskemål: abonnemangen ska se bra ut. */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
        overflow: 'hidden', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', padding: '22px 24px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Din plan</span>
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, background: statusBadge.bg, color: statusBadge.text }}>{statusBadge.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
              <span style={{ fontFamily: 'var(--font-voice)', fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Bokix{plan ? ' ' + plan.name : ''}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: BRAND.greenDark }}>{priceLabel}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '520px', marginTop: '8px', lineHeight: 1.6 }}>
              {sub.cancel_at_period_end
                ? <>Avslutas {fmtDateSv(endDate)}. Du har full åtkomst fram till dess, sedan tas inget mer betalt.</>
                : isTrialing
                  ? <>Kostnadsfri provperiod till {fmtDateSv(endDate)}, därefter {priceLabel} automatiskt.</>
                  : sub.status === 'past_due'
                    ? <>Senaste betalningen misslyckades. Stripe försöker automatiskt igen — uppdatera kortet om det upprepas.</>
                    : <>Förnyas automatiskt {fmtDateSv(endDate)}.</>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            {!sub.cancel_at_period_end && sub.status !== 'canceled' && !confirmCancel && (
              <button onClick={() => setConfirmCancel(true)} style={btnSecondary}>Avsluta</button>
            )}
            {sub.cancel_at_period_end && (
              <button onClick={handleReactivate} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Återaktiverar…' : 'Ångra uppsägning'}
              </button>
            )}
          </div>
        </div>

        {/* Vad planen ger. Lönemodulen är den enda riktiga skillnaden mellan
            nivåerna (se utils/plans.js), så den står som en egen rad i
            stället för att gömmas i en punktlista alla planer delar. */}
        <div style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-muted)', padding: '16px 24px', display: 'grid', gap: '9px' }}>
          {[
            { text: 'Bokföring, fakturor, offerter, kvitton och moms', included: true },
            { text: 'Rapporter, bokslutsunderlag och SIE-export', included: true },
            { text: 'Löner och arbetsgivardeklaration', included: plan ? plan.includesPayroll : true },
            { text: 'Upp till tre användare per företag', included: true },
          ].map(row => (
            <div key={row.text} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: row.included ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {row.included
                ? <Check size={14} style={{ color: BRAND.green, flexShrink: 0 }} />
                : <X size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span style={{ textDecoration: row.included ? 'none' : 'line-through' }}>{row.text}</span>
              {!row.included && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>— ingår i Med personal</span>}
            </div>
          ))}
        </div>
      </div>

      {confirmCancel && (
        <div style={{ padding: '16px 18px', background: 'var(--status-red-bg)', borderRadius: '14px' }}>
          <div style={{ fontSize: '13.5px', color: 'var(--status-red-text)', fontWeight: 700, marginBottom: '4px' }}>Avsluta prenumerationen?</div>
          <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px', lineHeight: 1.6 }}>
            Du behåller full åtkomst till och med {fmtDateSv(endDate)}. Redan betald tid återbetalas inte, men inget mer dras efter det. Din bokföring ligger kvar och går att ladda ner.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleCancel} disabled={busy} style={{ ...btnPrimary, background: '#dc2626', boxShadow: 'none', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Avslutar…' : 'Ja, avsluta'}
            </button>
            <button onClick={() => setConfirmCancel(false)} disabled={busy} style={btnGhost}>Behåll prenumerationen</button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

export default function Settings({
  company = {}, setCompanyInfo, accounts = [], verifications = [], invoices = [], quotes = [], expenses = [],
  contacts = [], projects = [], onImport, onReset, onBulkImportSie, stripeAccountId, onConnectStripe, onDisconnectStripe,
  zettleConnected = false, onConnectZettle,
  onConnectEmailDomain, onCheckEmailDomainStatus, onDisconnectEmailDomain, user,
  companyList = [], activeCompanyId, onSwitchCompany, onAddCompany, onDeleteCompany,
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
  // Tema-växeln bor i App.jsx (localStorage + data-theme på <html>), men
  // hör hemma bland utseendevalen här också — kundfeedback: temat gick bara
  // att byta via en ikon i topbaren/profilmenyn, aldrig där man letar efter
  // en inställning.
  theme = 'light', onToggleTheme,
}) {
  // `null` = översikten (SettingsHub). Se kommentaren vid SECTION_META
  // för varför sidan inte längre öppnar mitt i ett formulär.
  const [activeTab, setActiveTab] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [showSieImport, setShowSieImport] = useState(false);
  const [emailDomainInput, setEmailDomainInput] = useState('');
  const [emailDomainBusy, setEmailDomainBusy] = useState(false);
  const [emailDomainError, setEmailDomainError] = useState('');
  const [nextInvoiceNumberInput, setNextInvoiceNumberInput] = useState('');
  // Vilken integration som är öppen för inställningar.
  const [openIntegration, setOpenIntegration] = useState(null);
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
  const [showCompanyReauth, setShowCompanyReauth] = useState(false);
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

  const saveCompanyInfo = async (reauthToken) => {
    setCompanySaveBusy(true); setCompanySaveError('');
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/company-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: activeCompanyId, field: 'company', value: companyDraft, reauthToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Kunde inte spara (${response.status})`);
      setCompanyInfo(companyDraft);
      setShowCompanyReauth(false);
      setCompanySaveSuccess(true);
      setTimeout(() => setCompanySaveSuccess(false), 4000);
    } catch (err) {
      setShowCompanyReauth(false);
      setCompanySaveError(err?.message || 'Kunde inte spara ändringarna. Försök igen om en stund.');
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
    // Se kommentaren vid hash-avläsningen ovan för varför den är
    // namnrymdad. `null` = tillbaka till översikten, som inte har något
    // eget avsnitt att peka ut.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', tab ? `#settings/${tab}` : '#settings');
    }
  };

  const visibleSections = ufSettingsSections(company, SETTINGS_TABS);
  // `null` när man står på översikten. Styr sidhuvudet, flikraden och
  // vilken vy som renderas — ETT värde, inte tre villkor som kan glida isär.
  const activeSection = visibleSections.find(t => t.id === activeTab) || null;

  const firstName = user?.user_metadata?.first_name || '';
  const lastName = user?.user_metadata?.last_name || '';
  // Bara för toggle-hintens exempeltext nedan — samma tidsberoende hälsning
  // som Startsidan faktiskt visar, inte en hårdkodad "Hej".
  const { greeting: greetingPreview } = getGreeting();
  const initials = ((firstName[0] || user?.email?.[0] || '?') + (lastName[0] || '')).toUpperCase();

  const updateUserMeta = (patch) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    supabase.auth.updateUser({ data: patch });
  };

  const maxUsedInvoiceNumber = useMemo(() => Math.max(0, ...invoices.map(i => Number(i.invoiceNumber) || 0)), [invoices]);

  const saveNextInvoiceNumber = () => {
    const n = Number(nextInvoiceNumberInput);
    if (!nextInvoiceNumberInput || !Number.isInteger(n) || n <= 0) {
      setInvoiceNumberError('Ange ett positivt heltal.');
      return;
    }
    if (n <= maxUsedInvoiceNumber) {
      setInvoiceNumberError(`Måste vara högre än högsta redan använda fakturanummer (${maxUsedInvoiceNumber}) — annars riskerar två fakturor att få samma nummer.`);
      return;
    }
    setInvoiceNumberError('');
    setCompanyInfo({ ...company, nextInvoiceNumber: n });
  };

  // ── E-postavsändare (Sida 33, Steg 2) ──────────────────────────────────
  const handleConnectDomainClick = async () => {
    const domain = emailDomainInput.trim().toLowerCase();
    if (!domain) { setEmailDomainError('Ange en domän, t.ex. nordstromkonsult.se.'); return; }
    setEmailDomainBusy(true); setEmailDomainError('');
    try {
      await onConnectEmailDomain(domain);
      setEmailDomainInput('');
    } catch (error) {
      setEmailDomainError(error.message || 'Kunde inte koppla domänen.');
    } finally {
      setEmailDomainBusy(false);
    }
  };

  const handleCheckDomainStatusClick = async () => {
    setEmailDomainBusy(true); setEmailDomainError('');
    try {
      await onCheckEmailDomainStatus();
    } catch (error) {
      setEmailDomainError(error.message || 'Kunde inte hämta domänstatus.');
    } finally {
      setEmailDomainBusy(false);
    }
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
        setImportMsg('Data importerad.');
      } catch (err) {
        setImportMsg(`Kunde inte läsa filen: ${err.message}`);
      } finally {
        setImportBusy(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => { setImportMsg('Kunde inte läsa filen.'); setImportBusy(false); };
    reader.readAsText(file);
  };

  const deleteMatches = deleteConfirmText.trim().length > 0 && deleteConfirmText.trim() === (company?.name || '').trim();

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
  // ── Integrationskatalogen ────────────────────────────────────────────
  // En post per tjänst som FAKTISKT går att koppla in. Inga platshållare,
  // inget "kommer snart" — kundfeedback: "ha inte grejer som inte borde
  // vara där". Listan byggs här (inte i JSX) så sökningen och räknaren
  // ovanför korten läser exakt samma data som korten själva.
  const integrationCatalogue = [
    {
      id: 'stripe',
      name: 'Stripe',
      tagline: 'Låt kunden betala fakturan med kort direkt via länken i mejlet.',
      logo: <StripeLogo height={21} />,
      connected: Boolean(stripeAccountId),
      detail: true,
      keywords: 'kort betalning checkout',
      action: (
        <button type="button" onClick={() => setOpenIntegration(openIntegration === 'stripe' ? null : 'stripe')} style={btnTile}>
          {stripeAccountId ? 'Hantera' : 'Anslut'}
        </button>
      ),
    },
    {
      id: 'email',
      name: 'Egen e-postdomän',
      tagline: 'Skicka fakturor från din egen adress i stället för en delad Bokix-adress.',
      logo: <Mail size={24} color="var(--text-secondary)" />,
      connected: company?.emailDomainStatus === 'verified',
      statusLabel: company?.emailDomainStatus === 'verified' ? 'Verifierad' : (company?.emailDomain ? 'Väntar på DNS' : 'Inte ansluten'),
      detail: true,
      keywords: 'mejl domän dns avsändare',
      action: (
        <button type="button" onClick={() => setOpenIntegration(openIntegration === 'email' ? null : 'email')} style={btnTile}>
          {company?.emailDomain ? 'Hantera' : 'Anslut'}
        </button>
      ),
    },
    {
      // Zettle visas alltid — kundfeedback: den ska synas. Saknas
      // inkopplingen (t.ex. i demon) står knappen kvar men säger ifrån
      // i stället för att kortet försvinner ur katalogen.
      id: 'zettle',
      name: 'Zettle',
      tagline: 'Dagens kassaförsäljning hämtas in som underlag att granska.',
      logo: <ZettleLogo height={18} />,
      connected: zettleConnected,
      keywords: 'kassa butik paypal',
      action: zettleConnected ? null : (
        <button
          type="button"
          onClick={() => { if (readOnly || !onConnectZettle) { window.alert(DEMO_BLOCKED_MSG); return; } onConnectZettle(); }}
          style={btnTile}
        >
          Anslut
        </button>
      ),
    },
    {
      id: 'bank',
      name: 'Din bank',
      tagline: 'Ladda upp kontoutdraget som CSV eller Excel — raderna matchas mot fakturor och kvitton.',
      logo: <Landmark size={24} color="var(--text-secondary)" />,
      connected: true,
      statusLabel: 'Klar att använda',
      keywords: 'bank kontoutdrag csv excel swedbank seb nordea handelsbanken',
      action: <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Finns under Bank</span>,
    },
  ];

  const bankFieldsGroup = (
    <FieldGroup title="Bank" hint="Visas på fakturan. Sparas direkt.">
      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
        <AutoField label="Bankgiro" value={company?.bankgiro || ''} onChange={(v) => setCompanyInfo({ ...company, bankgiro: v })} />
        <AutoField label="Plusgiro" value={company?.plusgiro || ''} onChange={(v) => setCompanyInfo({ ...company, plusgiro: v })} />
        <AutoField label="IBAN" value={company?.iban || ''} onChange={(v) => setCompanyInfo({ ...company, iban: v })} />
        <AutoField label="BIC/SWIFT" value={company?.bic || ''} onChange={(v) => setCompanyInfo({ ...company, bic: v })} />
      </div>
    </FieldGroup>
  );

  const stripeCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}><SectionHeading icon={CreditCard} tone={stripeAccountId ? 'green' : 'amber'}>Ta emot kortbetalningar</SectionHeading></div>
      {/* Reauthentication (se ReauthCodeStep ovan) — koppla till/från
          ett Stripe-konto styr var pengarna hamnar, minst lika
          känsligt som lösenord/företagsuppgifter. onConnectStripe/
          onDisconnectStripe (App.jsx) tar numera emot reauthToken
          som argument och skickar med det till /api/stripe/connect,
          se App.jsx:s handlers. */}
      {stripeReauthAction ? (
        <ReauthCodeStep
          onVerified={async (reauthToken) => {
            const act = stripeReauthAction;
            setStripeReauthAction(null);
            if (act === 'disconnect') await onDisconnectStripe?.(reauthToken);
            else await onConnectStripe?.(reauthToken);
          }}
          onCancel={() => setStripeReauthAction(null)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '480px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              {stripeAccountId
                ? 'Stripe är anslutet — kunder kan betala dina fakturor med kort direkt online.'
                : 'Anslut Stripe för att låta kunder betala fakturor med kort direkt online.'}
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
                Saldo, utbetalningar och avgifter följer du i din Stripe-dashboard.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {stripeAccountId && (
              <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Öppna Stripe-dashboard <ExternalLink size={13} />
              </a>
            )}
            {stripeAccountId
              ? <button onClick={() => { if (readOnly) { onDisconnectStripe?.(); return; } setStripeReauthAction('disconnect'); }} style={btnGhost}>Koppla från</button>
              : (
                <button onClick={() => { if (readOnly) { onConnectStripe?.(); return; } setStripeReauthAction('connect'); }} style={btnStripeConnect}>
                  <StripeLogo height={15} /> Anslut Stripe
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );

  const emailSenderCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}>
        <SectionHeading icon={Mail} tone={company?.emailDomainStatus === 'verified' ? 'green' : (company?.emailDomain ? 'amber' : 'gray')}>
          E-postavsändare
        </SectionHeading>
      </div>

      {!company?.emailDomain ? (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: '520px' }}>
            Adressen blir <code>faktura@{company?.name ? company.name.toLowerCase().replace(/[^a-z0-9]+/g, '') : 'dittforetag'}.se</code>. Utan en verifierad domän skickas mejlen via Bokix reservadress.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text" value={emailDomainInput} onChange={e => { setEmailDomainInput(e.target.value); setEmailDomainError(''); }}
              placeholder="dittforetag.se" style={{ ...inputBase, width: '240px' }}
              onFocus={e => e.target.style.borderColor = BRAND.green}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button onClick={handleConnectDomainClick} disabled={emailDomainBusy} style={{ ...btnPrimary, opacity: emailDomainBusy ? 0.6 : 1, cursor: emailDomainBusy ? 'not-allowed' : 'pointer' }}>
              {emailDomainBusy ? 'Kopplar...' : 'Anslut domän'}
            </button>
          </div>
          {emailDomainError && <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{emailDomainError}</div>}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{company.emailDomain}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {company.emailDomainStatus === 'verified'
                  ? `Fakturor skickas från faktura@${company.emailDomain}`
                  : `Reservläge just nu — fakturor skickas via Bokix egen adress tills domänen är verifierad`}
              </div>
            </div>
            <Badge tone={company.emailDomainStatus === 'verified' ? 'positive' : 'warning'}>
              {company.emailDomainStatus === 'verified' ? 'Verifierad' : 'Ej verifierad'}
            </Badge>
          </div>

          {company.emailDomainStatus !== 'verified' && company?.emailDomainRecords?.length > 0 && (
            <div style={{ marginBottom: '14px', maxWidth: '672px' }}>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                Lägg till dessa DNS-poster hos din domänleverantör, samma sätt som för bokix.se:
              </p>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Typ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Namn</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Värde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.emailDomainRecords.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < company.emailDomainRecords.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-main)' }}>{r.type || r.record}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{r.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-main)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{r.value}{r.priority != null ? ` (prio ${r.priority})` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleCheckDomainStatusClick} disabled={emailDomainBusy} style={{ ...btnSecondary, opacity: emailDomainBusy ? 0.6 : 1, cursor: emailDomainBusy ? 'not-allowed' : 'pointer' }}>
              {emailDomainBusy ? 'Kontrollerar...' : 'Kontrollera status'}
            </button>
            <button onClick={onDisconnectEmailDomain} style={btnGhost}>Koppla från</button>
          </div>
          {emailDomainError && <div style={{ color: 'var(--status-red-text)', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{emailDomainError}</div>}
        </>
      )}
    </div>
  );

  const invoiceDefaultsCard = (
    <div style={card}>
      <div style={{ marginBottom: '14px' }}><SectionHeading icon={Hash} tone="green">Standardinställningar för nya fakturor</SectionHeading></div>
      {/* Två fält på en rad i stället för under varandra: betalnings-
          villkoret är tre tecken brett och behöver ingen egen rad över
          hela kortet (kundfeedback om luften på inställningssidan). */}
      <div className="form-row-stack" style={{ ...grid2, gridTemplateColumns: '1fr 2fr', maxWidth: FORM_MAX }}>
        <AutoField label="Betalningsvillkor (dagar)" type="number" value={company?.paymentTermsDays ?? '30'} onChange={(v) => setCompanyInfo({ ...company, paymentTermsDays: Number(v) || 30 })} />
        <AutoField label="Standardtext på faktura" value={company?.invoiceFooterText || 'Tack för er affär! Dröjsmålsränta debiteras enligt räntelagen.'} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} />
      </div>

      {/* Bugkritiskt (mörkt läge): hela den här varningsrutan använde
          hårdkodad #991b1b/#fca5a5 istället för --status-red-text/
          -bg — de togs INTE om i mörkt läge (till skillnad från
          variablerna), så texten blev en nästan omöjlig-att-läsa
          mörk maroon mot en halvtransparent mörkröd bakgrund. Samma
          tema-variabler som resten av sidan överallt nu istället. */}
      <div style={{ marginTop: '14px', padding: '14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', maxWidth: FORM_MAX }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 700, marginBottom: '8px' }}>
          <Hash size={16} /> Numreringsserie
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Nästa fakturanummer räknas normalt automatiskt fram (högsta använda + 1). Detta fält höjer bara ett golv — det kan aldrig sättas till eller under ett nummer som redan använts, så det kan inte skapa krockar i bokföringen.
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Golv för nästa fakturanummer</label>
            <input
              type="number" value={nextInvoiceNumberInput} onChange={e => { setNextInvoiceNumberInput(e.target.value); setInvoiceNumberError(''); }}
              placeholder={String(maxUsedInvoiceNumber + 1)}
              style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid var(--status-red-text)', background: 'var(--bg-card)', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={saveNextInvoiceNumber} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Spara golv</button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {company?.nextInvoiceNumber ? `Aktivt golv: ${company.nextInvoiceNumber}. ` : ''}Högsta använda fakturanummer just nu: {maxUsedInvoiceNumber || '—'}.
          </span>
        </div>
        {invoiceNumberError && <div style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{invoiceNumberError}</div>}
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
          sidan i stället för i toppen", och ikonen efterfrågades bort. */}
      <ListPageHeader
        title={activeSection ? activeSection.label : 'Inställningar'}
        subtitle={activeSection ? (SECTION_META[activeSection.id]?.desc || '') : 'Välj vad du vill ändra.'}
        actions={activeSection
          ? [{ key: 'back', label: 'Alla inställningar', icon: ArrowLeft, onClick: () => handleSetTab(null) }]
          : []}
        // Piller-flikar (ListPageHeader): åtta flikar får inte plats på en
        // rad, och den understrukna standardraden skrollade då i sidled så
        // att de sista (Utseende, Din data) låg utanför skärmkanten —
        // kundfeedback: "man kan inte se dem, man måste skrolla". Pillren
        // radbryter i stället; alla åtta syns samtidigt och är ett tryck
        // bort, på bred skärm såväl som på telefon.
        // Flikraden hör till ett öppnat avsnitt, inte till översikten —
        // där ÄR korten navigeringen, och en flikrad ovanför dem hade varit
        // samma val två gånger på samma skärm.
        tabs={activeSection
          ? { items: visibleSections, activeId: activeTab, onChange: handleSetTab, variant: 'pills' }
          : undefined}
      />

      {/* Bredden begränsas av SPALTERNA, inte av behållaren: varje kort
          hamnar i en spalt på 380–520 px, vilket är den läsbara radlängd
          det gamla 1180-taket fanns för att skapa. Taket i sig lämnade
          bara flera hundra tomma pixlar i var kant på en bred skärm
          (kundrapporterat med skärmbild från en 1674 px-skärm). */}
      <div className="settings-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div data-tour="page-settings-nav" style={{ maxWidth: '1680px', margin: '0 auto', padding: 'clamp(12px, 1.2vw, 18px)' }}>
          {!activeSection && <SettingsHub sections={visibleSections} onPick={handleSetTab} />}
          {/* 1. Min profil */}
          {activeTab === 'profile' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              

              {/* Vem är inloggad — samma identitetskort som Företag-fliken
                  har, så de två flikarna öppnar likadant. */}
              <IdentityCard
                monogram={initials}
                name={[firstName, lastName].filter(Boolean).join(' ') || 'Din profil'}
                meta={user?.email || ''}
                chips={[
                  sharedAccess ? { label: 'Roll', value: sharedAccess.role === 'editor' ? 'Redigerare' : 'Läsare' } : { label: 'Roll', value: 'Ägare' },
                  company?.name ? { label: 'Företag', value: company.name } : null,
                ]}
              />

              {/* FYRA likvärdiga kort, inga rubriker utanför dem.
                  Tidigare låg korten under egna sektionsrubriker ("Säkerhet"
                  över ett kort som redan hette "Lösenord") — samma sak sagd
                  två gånger, och en extra rytmnivå som kostade luft på varje
                  skärm. Varje kort bär nu sin egen rubrik.
                  Fyra jämnstora block packar dessutom spalterna mycket bättre
                  än två block där det ena är dubbelt så högt som det andra —
                  det var därför högerspalten stod tom halva skärmen. */}
              <div className="settings-split">
                <SettingCard title="Dina uppgifter" icon={UserRound} description="E-postadressen är din inloggning.">
                  <div className="form-row-2" style={grid2}>
                    <AutoField label="Förnamn" value={firstName} onChange={(v) => updateUserMeta({ first_name: v })} hint="Det du vill bli kallad." />
                    <AutoField label="Efternamn" value={lastName} onChange={(v) => updateUserMeta({ last_name: v })} />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <AutoField label="E-post (inloggning)" type="email" value={user?.email || ''} onChange={(v) => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } supabase.auth.updateUser({ email: v }); }} hint="Kräver att du bekräftar via e-post innan ändringen gäller." required />
                    </div>
                  </div>
                </SettingCard>

                <PasswordSection user={user} readOnly={readOnly} />

                {/* readOnly (demo): TwoFactorSection hämtar riktiga
                    MFA-faktorer från Supabase direkt vid mount — hoppas över
                    helt istället för att göra ett Supabase-anrop från en
                    icke-inloggad besökare. */}
                {readOnly ? (
                  <SettingCard title="Tvåstegsverifiering" icon={KeyRound} description="Kräver ett riktigt konto att visa och aktivera." />
                ) : <TwoFactorSection />}

                <ActiveSessionsSection user={user} readOnly={readOnly} />
              </div>
            </div>
          )}

          {/* 2. Företag */}
          {activeTab === 'company' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Vilket företag är det jag ändrar på? Appen är flerföretags,
                  och den frågan besvarades tidigare ingenstans på sidan. */}
              <IdentityCard
                logoUrl={company?.logoUrl}
                monogram={(company?.name || 'F').charAt(0).toUpperCase()}
                name={company?.name || 'Namnlöst företag'}
                meta={company?.orgNr ? `Org.nr ${company.orgNr}` : 'Organisationsnummer saknas'}
                chips={[
                  companyRegDisplayedOrgType ? { label: 'Bolagsform', value: companyRegDisplayedOrgType } : null,
                  { label: 'Räkenskapsår', value: company?.fiscalYearStart || `${new Date().getFullYear()}-01-01` },
                  { label: 'Moms', value: company?.vatPeriod === 'monthly' ? 'Månadsvis' : company?.vatPeriod === 'yearly' ? 'Årsvis' : 'Kvartalsvis' },
                ]}
              />

              {companyList.length > 0 && (
              <SettingsSection
                title="Dina företag"
                description="Varje företag har sin egen bokföring och sin egen prenumeration."
              >
                {(
                <div style={card}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px', marginBottom: '12px' }}>
                    {companyList.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => onSwitchCompany?.(c.id)}
                          disabled={c.id === activeCompanyId}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px',
                            border: `1.5px solid ${c.id === activeCompanyId ? BRAND.green : 'var(--border)'}`,
                            background: c.id === activeCompanyId ? BRAND.greenLight : 'var(--bg-card)',
                            cursor: c.id === activeCompanyId ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', flex: 1, minWidth: 0, boxSizing: 'border-box',
                          }}
                        >
                          {c.id === activeCompanyId ? <Check size={15} color={BRAND.greenDark} /> : <span style={{ width: 15, flexShrink: 0 }} />}
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Namnlöst företag'}</span>
                        </button>
                        {/* Kundönskemål: en snabb städknapp — går inte att ta
                            bort det sista/enda kvarvarande företaget (samma
                            spärr som App.jsx:s handleDeleteCompany). En enkel
                            bekräftelsedialog istället för en tyngre "skriv
                            namnet"-modal (jämför Radera-bokföringsdata-kortet
                            nedan) — den här tar bort HELA företaget, inte
                            bara dess data, men efterfrågades uttryckligen
                            snabb/enkel för att kunna städa bort flera på en
                            gång. */}
                        <button
                          type="button"
                          title={`Ta bort ${c.name || 'företaget'}`}
                          disabled={companyList.length <= 1}
                          onClick={async () => {
                            if (companyList.length <= 1) return;
                            if (await confirmDialog(`Ta bort "${c.name || 'Namnlöst företag'}" permanent? All bokföring, alla fakturor och kunder för det företaget försvinner. Går inte att ångra.`, { danger: true })) {
                              onDeleteCompany?.(c.id);
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0,
                            background: 'none', border: '1.5px solid var(--border)', borderRadius: '8px',
                            color: companyList.length <= 1 ? 'var(--text-muted)' : 'var(--status-red-text)',
                            cursor: companyList.length <= 1 ? 'not-allowed' : 'pointer', opacity: companyList.length <= 1 ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddCompany?.()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'none', border: '1.5px dashed var(--border)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <Plus size={14} /> Lägg till företag
                  </button>
                </div>
                )}
              </SettingsSection>
              )}

              <SettingsSection
                title="Företagsuppgifter"
                description="Visas på fakturor, i e-post och i filer till myndigheter."
              >

              <div style={card}>
                {/* Kundfeedback ("vet inte vad som händer"): fälten här och i
                    Kontaktuppgifter nedan autosparar INTE (kräver klick på
                    "Spara ändringar" + en emailad kod, se reauth-blocket
                    efter Kontaktuppgifter) — till skillnad från praktiskt
                    taget alla andra fält på hela sidan. AutoField:s egen
                    "Sparat ✓" är avstängd på dem (showSaveState=false nedan)
                    så den inte ljuger om att något redan är sparat, och den
                    här badgen säger uttryckligen vad som gäller istället för
                    att bara vara tyst om det. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <SectionHeading icon={Building2} tone="green">Grunduppgifter</SectionHeading>
                  <Badge tone="warning">Kräver att du sparar</Badge>
                </div>
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
                      Organisationsnumret och namnet du sparar blir företagets registrerade uppgifter — dubbelkolla innan du sparar.
                    </p>
                    <div>
                      <label style={labelStyle}>Organisationsnummer <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(10 siffror)</span></label>
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
                      {companyRegLookup.orgLookup.status === 'loading' && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>Hämtar företagsuppgifter…</div>}
                      {companyRegLookup.orgLookup.status === 'error' && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>{companyRegLookup.orgLookup.message}</div>}
                      {companyRegLookup.orgLookup.status === 'firma' && (
                        <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                          <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} /><span>{companyRegLookup.orgLookup.message}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '14px' }}>
                      <label style={labelStyle}>Företagsnamn</label>
                      <input
                        type="text" style={inputBase} placeholder="Ex. Mitt Företag AB"
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
                          <Check size={13} /> Identifierad som: {companyRegDisplayedOrgType}
                        </div>
                      )}
                    </div>

                    {/* Resten av företagsuppgifterna, samma fält som ett
                        färdigregistrerat företag har. Kundfeedback: rutan
                        innehöll bara organisationsnummer och företagsnamn —
                        allt annat gick inte att fylla i förrän registreringen
                        var klar, trots att uppgifterna behövs på första
                        fakturan. */}
                    <FieldGroup title="Adress">
                      <div style={{ maxWidth: '672px' }}>
                        <AutoField label="Gatuadress" value={companyDraft?.address || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, address: v })} showSaveState={false} />
                      </div>
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label="Postnummer" value={companyDraft?.postalCode || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, postalCode: v })} showSaveState={false} />
                        <AutoField label="Ort" value={companyDraft?.city || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, city: v })} showSaveState={false} />
                      </div>
                    </FieldGroup>

                    <FieldGroup title="Kontakt">
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label="E-post" type="email" value={companyDraft?.email || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, email: v })} showSaveState={false} />
                        <AutoField label="Telefon" type="tel" value={companyDraft?.phone || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, phone: v })} showSaveState={false} />
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
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <LockedField label="Företagsnamn" value={company?.name || '—'} />
                      <LockedField label="Organisationsnummer" value={company?.orgNr || '—'} />
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
                        Företagets registrerade uppgifter. De sparades automatiskt vid registreringen och går inte att ändra här — kontakta <a href="mailto:support@bokix.se" style={{ color: BRAND.green }}>support@bokix.se</a> om något blivit fel.
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={handleFetchCompanyDetails}
                          disabled={String(companyDraft?.orgNr || '').replace(/\D/g, '').length !== 10 || companyDetailsLookup.orgLookup.status === 'loading'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                            cursor: String(companyDraft?.orgNr || '').replace(/\D/g, '').length === 10 ? 'pointer' : 'not-allowed',
                            opacity: String(companyDraft?.orgNr || '').replace(/\D/g, '').length === 10 ? 1 : 0.55,
                          }}
                        >
                          <Building2 size={14} />
                          {companyDetailsLookup.orgLookup.status === 'loading' ? 'Hämtar…' : 'Hämta bolagsuppgifter'}
                        </button>
                        {companyDetailsLookup.orgLookup.status === 'done' && (
                          <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                            <Check size={13} /> Hämtat — kontrollera fälten och klicka Spara ändringar.
                          </div>
                        )}
                        {(companyDetailsLookup.orgLookup.status === 'error' || companyDetailsLookup.orgLookup.status === 'firma') && (
                          <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--text-secondary)' }}>{companyDetailsLookup.orgLookup.message}</div>
                        )}
                      </div>
                    </div>
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <AutoField label="Momsregistreringsnummer" value={companyDraft?.vatNr || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, vatNr: v })} showSaveState={false} hint="SE + organisationsnumret + 01." />
                      {/* Fritt visningsnamn för fakturor — separat från det
                          låsta registrerade namnet ovan (se InvoiceDocument.jsx:s
                          motsvarande fallback). Tomt = använd det registrerade
                          namnet, precis som innan den här möjligheten fanns. */}
                      <AutoField
                        label="Visningsnamn på faktura" value={companyDraft?.invoiceDisplayName || ''}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, invoiceDisplayName: v })}
                        hint="Används på fakturor om ni är kända under ett annat namn."
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
                    <div className="form-row-stack" style={{ ...grid2, gridTemplateColumns: '2fr 1fr 1fr', maxWidth: FORM_MAX }}>
                      <AutoField label="Gatuadress" value={companyDraft?.address || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, address: v })} showSaveState={false} />
                      <AutoField label="Postnummer" value={companyDraft?.postalCode || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, postalCode: v })} showSaveState={false} />
                      <AutoField label="Ort" value={companyDraft?.city || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, city: v })} showSaveState={false} />
                    </div>
                    {/* F-skattsedel skrivs ut på varenda faktura/offert (se InvoiceDocument)
                        men gick tidigare inte att ändra någonstans — den föll tillbaka på
                        en hårdkodad text ("Innehar F-skattsedel") som INTE nödvändigtvis
                        stämmer för alla företagsformer. Görs redigerbar här istället för
                        att tyst påstå något om företaget som kanske inte är sant. */}
                    <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                      <AutoField
                        label="F-skattsedel (text på faktura)" value={companyDraft?.fSkatt || 'Innehar F-skattsedel'}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, fSkatt: v })}
                        hint="Skrivs ut på fakturor. Töm om det inte stämmer."
                        showSaveState={false}
                      />
                    </div>

                    {/* Kontakt och bank i SAMMA kort som grunduppgifterna —
                        kundfeedback: det ska vara en familj, inte tre kort
                        man letar mellan. */}
                    <FieldGroup title="Kontakt" hint="Visas längst ner på fakturor.">
                      <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                        <AutoField label="E-post" type="email" value={companyDraft?.email || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, email: v })} showSaveState={false} />
                        <AutoField label="Telefon" type="tel" value={companyDraft?.phone || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, phone: v })} showSaveState={false} />
                      </div>
                    </FieldGroup>

                    {bankFieldsGroup}
                  </>
                )}
              </div>


              {/* Reauthentication (se ReauthCodeStep ovan) — Grunduppgifter/
                  Kontaktuppgifter ovan autosparar INTE längre, de kräver ett
                  uttryckligt klick här + en emailad kod. Övriga företagsfält
                  (Logotyp, Räkenskapsår/moms, påminnelser, Bankuppgifter i
                  Betalning-fliken) är opåverkade, autosparar som förut. */}
              <div style={{ marginBottom: '28px' }}>
                {showCompanyReauth ? (
                  <ReauthCodeStep onVerified={saveCompanyInfo} onCancel={() => setShowCompanyReauth(false)} />
                ) : (
                  <>
                    {/* Uttryckligen vad knappen sparar — utan den här raden
                        ser den ut som en global "spara hela sidan"-knapp,
                        trots att den bara gäller de två korten ovanför. */}
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>Sparar uppgifterna ovan. Bankuppgifter sparas direkt.</p>
                    <button
                      type="button"
                      onClick={() => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } setShowCompanyReauth(true); }}
                      disabled={!companyInfoDirty || companySaveBusy}
                      style={{ ...btnPrimary, opacity: (!companyInfoDirty || companySaveBusy) ? 0.5 : 1, cursor: (!companyInfoDirty || companySaveBusy) ? 'not-allowed' : 'pointer' }}
                    >
                      {companySaveBusy ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                    {companySaveError && <div style={{ color: 'var(--status-red-text)', fontSize: '13px', marginTop: '10px' }}>{companySaveError}</div>}
                    {companySaveSuccess && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>Företagsuppgifterna är sparade.</div>}
                  </>
                )}
              </div>

              </SettingsSection>

              {/* Skiljelinjen behövs inte längre — sektionsrubriken nedan
                  säger samma sak tydligare: allt här sparas direkt. */}
              <SettingsSection
                title="Bokföringsår, logotyp och påminnelser"
                description="Sparas direkt."
              >

              {/* De autosparande korten i ett rutnät — fyra fullbreda block
                  under varandra gjorde att man skrollade förbi tomma högerhalvor
                  för att hitta nästa inställning (kundfeedback om sidan). */}
              <div className="settings-grid">
              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="pink">Logotyp</SectionHeading></div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px', maxWidth: '440px' }}>
                    <ImageUploadField label="Logotyp" value={company?.logoUrl || ''} onChange={(v) => setCompanyInfo({ ...company, logoUrl: v })} uploadPath={`${user?.id}/logo-${company?.id}`} bucket="companylogo" hint="Används överst på dina utgående fakturor. Max 3 MB." readOnly={readOnly} />
                  </div>
                  <div style={{ width: '200px', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-muted)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Förhandsvisning faktura</div>
                    {company?.logoUrl ? (
                      <img src={company.logoUrl} alt="Logotyp" style={{ maxHeight: '40px', maxWidth: '100%', marginBottom: '16px', display: 'block' }} />
                    ) : (
                      <div style={{ height: '40px', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '16px' }} />
                    )}
                    <div style={{ height: '8px', width: '60%', background: 'var(--border)', borderRadius: '2px', marginBottom: '4px' }} />
                    <div style={{ height: '8px', width: '40%', background: 'var(--border)', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>

              {/* Räkenskapsår + momsperiod styr verkliga beräkningar (Taxes,
                  VatDeclaration, Reports, Verifications) — fanns tidigare BARA
                  på en separat, svårhittad "Företag"-sida utanför Inställningar
                  (CompanySettings.jsx), inte här där man faktiskt letar. */}
              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Calendar} tone="amber">Räkenskapsår och moms</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>Styr periodiseringen i Rapporter, Momsdeklaration och Skatter.</p>
                <div className="form-row-2" style={{ ...grid2, maxWidth: FORM_MAX }}>
                  <AutoField label="Räkenskapsår startar" type="date" value={company?.fiscalYear || ''} onChange={(v) => setCompanyInfo({ ...company, fiscalYear: v })} />
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Momsperiod</label>
                    <select
                      value={company?.vatPeriod || 'quarterly'}
                      onChange={e => setCompanyInfo({ ...company, vatPeriod: e.target.value })}
                      style={{ ...inputBase, background: 'var(--bg-card)' }}
                    >
                      <option value="monthly">Månadsvis</option>
                      <option value="quarterly">Kvartalsvis</option>
                      <option value="yearly">Helårlig</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Enda kontrollen över api/cron/reminders.js (den automatiska
                  påminnelse-cronen) som finns i UI:t — annars en helt osynlig
                  bakgrundsprocess ingen kan stoppa utan att röra kod/Vercel-
                  miljövariabler. Dagarna (3/faktura, 7/deklaration) är fortfarande
                  hårdkodade förvalsvärden, inte redigerbara här — bara av/på. */}
              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Bell} tone="amber">Automatiska påminnelser</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>Påminnelse till kunden 3 dagar efter förfallodatum, och till er 7 dagar före moms- och AGI-deadline.</p>
                <div style={{ maxWidth: '480px' }}>
                  <ToggleSwitch
                    checked={company?.notifications?.enabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, enabled: e.target.checked } })}
                    label="Skicka automatiska påminnelser"
                    hint="Av stänger de automatiska utskicken. Manuella påminnelser påverkas inte."
                    disabled={readOnly}
                  />
                </div>
              </div>
              </div>
              </SettingsSection>
            </div>
          )}

          {/* Fakturor */}
          {activeTab === 'invoice' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title="Standardvärden"
                description="Fylls i automatiskt på nya fakturor."
              >
                {invoiceDefaultsCard}
              </SettingsSection>

              <SettingsSection
                title="Utseende"
                description="Förhandsvisningen är vad kunden får."
              >

                <InvoiceTemplateSection company={company} setCompanyInfo={setCompanyInfo} user={user} readOnly={readOnly} />
              </SettingsSection>
            </div>
          )}

          {/* 5. Användare och Åtkomst */}
          {activeTab === 'users' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title="Vem kommer åt företaget"
                description="Upp till två personer utöver dig, var och en med egen inloggning."
              >
              <UsersAndAccessSection company={company} user={user} firstName={firstName} lastName={lastName} sharedAccess={sharedAccess} readOnly={readOnly} />
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
                <SettingsSection title="Din plan" description="Vad Bokix kostar för det här företaget.">
                  {/* UF-konton har ingen prenumerationsrad alls —
                      registreringen hoppar över Stripe helt (Auth.jsx). Den
                      vanliga vyn hade laddat, hittat noll rader och visat
                      "ingen aktiv prenumeration", vilket låter som ett fel
                      på ett konto som fungerar precis som det ska. */}
                  {isUfCompany(company)
                    ? <UfSubscriptionCard company={company} />
                    : <SubscriptionSection user={user} company={company} sharedAccess={sharedAccess} readOnly={readOnly} />}
                </SettingsSection>

                <SettingsSection title="Kvitton" description="Dyker upp efter första dragningen.">
                  <SettingCard>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Ingen betalhistorik ännu.</div>
                  </SettingCard>
                </SettingsSection>
              </div>
            </div>
          )}


          {/* 4. Integrationer — egen flik. Kundfeedback: "integrationsdelen
              ska vara sin egen sak och mycket bättre". Låg tidigare som ett
              kort längst ner under Data, medan Stripe och e-postdomänen låg
              på en tredje flik (Betalning) — tre ställen för samma fråga:
              vad är kopplat till mitt Bokix? */}
          {activeTab === 'integrations' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Ett kort per tjänst, stora nog att loggan syns. Sökfältet är
                  borttaget (kundönskemål) — det fanns fyra tjänster, och en
                  sökruta över fyra kort är en kontroll som bara tar plats. */}
              <div className="integration-grid">
                {integrationCatalogue.map(item => (
                  <IntegrationTile
                    key={item.id}
                    logo={item.logo}
                    name={item.name}
                    tagline={item.tagline}
                    connected={item.connected}
                    statusLabel={item.statusLabel}
                    action={item.action}
                    onOpen={item.detail ? () => setOpenIntegration(openIntegration === item.id ? null : item.id) : undefined}
                    open={openIntegration === item.id}
                  />
                ))}
              </div>

              {/* Detaljerna för den tjänst man öppnat: hela inkopplingen,
                  inte en genväg till en annan flik. */}
              {openIntegration === 'stripe' && (
                <div style={{ marginTop: '18px' }}>{stripeCard}</div>
              )}
              {openIntegration === 'email' && (
                <div style={{ marginTop: '18px' }}>{emailSenderCard}</div>
              )}
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
                title="Tema"
                description="Gäller den här webbläsaren."
              >
                <SettingCard>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'light', label: 'Ljust', icon: Sun, hint: 'Vit bakgrund, mörk text.' },
                      { id: 'dark', label: 'Mörkt', icon: Moon, hint: 'Djupgrön bakgrund, ljus text.' },
                    ].map(opt => {
                      const active = (theme === 'dark') === (opt.id === 'dark');
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { if (!active) onToggleTheme?.(); }}
                          aria-pressed={active}
                          style={{
                            flex: '1 1 200px', textAlign: 'left', padding: '14px 16px', borderRadius: '12px',
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
                title="Visning"
                description="Sparas direkt."
              >
                <SettingCard>
                  <SettingRow
                    label="Mörk sidomeny"
                    description="Mörk sidomeny med ljus app i övrigt."
                  >
                    <ToggleSwitch checked={sidebarStyle === 'dark'} onChange={() => onToggleSidebarStyle?.()} />
                  </SettingRow>
                  <SettingRow
                    label="Dölj scrollbar"
                    description="Sidan skrollar som vanligt, handtaget syns inte."
                  >
                    <ToggleSwitch checked={hideScrollbar} onChange={() => onToggleHideScrollbar?.()} />
                  </SettingRow>
                  <SettingRow
                    label="Hälsning på Startsidan"
                    description={'Av döljer "' + greetingPreview + ', ' + (firstName || 'Användare') + ' 👋" och flyttar upp resten av sidan.'}
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

          {/* 8. Data */}
          {activeTab === 'data' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <SettingsSection
                title="Ta med dig din bokföring"
                description="Din bokföring är din. Ladda ner den när du vill."
              >
              <div className="settings-grid" style={{ gap: '14px' }}>
                <SettingCard title="Säkerhetskopia" icon={Download} tone="blue" description="Allt i en JSON-fil.">
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
                    Konton, verifikationer, fakturor, kvitton och kontakter. Kan läsas tillbaka här.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={handleExport} style={btnSecondary}>
                      <Download size={15} style={{ verticalAlign: 'middle', marginRight: '7px' }} />Ladda ner
                    </button>
                    <label style={{ ...btnSecondary, display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: importBusy ? 'not-allowed' : 'pointer', opacity: importBusy ? 0.6 : 1 }}>
                      <Upload size={15} /> {importBusy ? 'Importerar…' : 'Läs in fil'}
                      <input type="file" accept="application/json" onChange={handleImportFile} disabled={importBusy} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {importMsg && (
                    <div style={{ fontSize: '12.5px', marginTop: '10px', fontWeight: 600, color: importMsg.startsWith('Kunde inte') ? 'var(--status-red-text)' : BRAND.greenDark }}>{importMsg}</div>
                  )}
                </SettingCard>

                <SettingCard title="SIE4" icon={Download} tone="green" description="Formatet alla svenska bokföringsprogram läser.">
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
                    Ge filen till din revisor, eller ta med bokföringen till ett annat program.
                  </p>
                  <button onClick={handleExportSie} style={btnSecondary}>
                    <Download size={15} style={{ verticalAlign: 'middle', marginRight: '7px' }} />Ladda ner SIE4
                  </button>
                </SettingCard>

                <SettingCard title="Flytta hit bokföringen" icon={Upload} tone="amber" description="Från ett annat program, via SIE4.">
                  {/* Loggorna svarar på "gäller det här mitt program?" utan att
                      man först måste öppna guiden. Vit platta bakom varje —
                      flera filer har vit bakgrund inbakad. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {MIGRATION_SOURCES.map(p => (
                      <span
                        key={p.id} title={p.note ? p.name + ' — ' + p.note : p.name}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '8px', background: '#fff', border: '1px solid var(--border-light)' }}
                      >
                        <ProgramLogo src={p.logo} alt={p.name} size={22} />
                      </span>
                    ))}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>med flera</span>
                  </div>
                  <button onClick={() => setShowSieImport(true)} style={{ ...btnSecondary, background: BRAND.greenLight, color: BRAND.greenDark, border: 'none' }}>
                    <Upload size={15} style={{ verticalAlign: 'middle', marginRight: '7px' }} />Importera SIE4-fil
                  </button>
                </SettingCard>
              </div>
              </SettingsSection>

              <SettingsSection
                title="Ta bort bokföringen"
                description="Går inte att ångra. Ladda ner en kopia först."
              >
              <div style={{ ...card, background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)' }}>
                <div style={{ marginBottom: '10px' }}><SectionHeading icon={Trash2} tone="red">Radera företagets bokföringsdata</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--status-red-text)', margin: '0 0 12px', maxWidth: '600px' }}>
                  Detta raderar all bokföring, alla fakturor, kunder och verifikationer för <strong>{company?.name || 'det här företaget'}</strong> permanent. Det kan inte ångras. Din Bokix-inloggning ({user?.email}) påverkas inte och du loggas inte ut.
                </p>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-red-text)', marginBottom: '6px' }}>
                  Skriv företagsnamnet <strong>{company?.name}</strong> för att bekräfta
                </label>
                <input
                  value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ width: '100%', maxWidth: '340px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fca5a5', marginBottom: '12px', boxSizing: 'border-box' }}
                />
                <div>
                  <button
                    disabled={!deleteMatches}
                    onClick={() => { if (deleteMatches) { onReset?.(); setDeleteConfirmText(''); } }}
                    style={{ padding: '9px 18px', background: deleteMatches ? '#ef4444' : '#fca5a5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: deleteMatches ? 'pointer' : 'not-allowed' }}
                  >
                    <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Radera permanent
                  </button>
                </div>
              </div>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>

      {showSieImport && (
        <SieImportModal
          accounts={accounts}
          verifications={verifications}
          onImport={(newVerifications, newAccounts, sourceTag) => onBulkImportSie?.(newVerifications, newAccounts, sourceTag)}
          onClose={() => setShowSieImport(false)}
        />
      )}
    </div>
  );
}
