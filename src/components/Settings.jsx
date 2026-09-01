import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User, Building2, CreditCard, Users, Shield, Sliders, Check, Download, Upload,
  AlertTriangle, Trash2, Mail, Plug, Laptop, FileText, Lock, KeyRound, Image as ImageIcon,
  Palette, Landmark, Hash, Calendar, Phone, Plus, X, ZoomIn, ZoomOut, Maximize2, Bell, ExternalLink,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sendInvoiceEmail } from '../emailApi';
import { cancelStripeSubscription, reactivateStripeSubscription } from '../stripeApi';
import { BRAND } from '../utils/brandColors';
import InvoiceDocument, { INVOICE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import ListTable from './shared/ListTable';
import { sendReauthCode, verifyReauthCode, changePassword } from '../utils/reauthVerification';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';

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
  background: 'var(--bg-card)', color: '#0a2540', border: '1px solid var(--border)', borderRadius: '8px',
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

// Samma "vit botten, riktig logga"-mönster som btnStripeConnect ovan.
const btnZettleConnect = {
  display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '9px 18px 9px 16px',
  background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px',
  fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

// ── Delade stilar ──
// Bugkritiskt (Sida 15): varje sektion är ett fullbrett, ljust kort — inte
// smala vita kort med stor luft runt om.
const card = {
  background: 'var(--bg-card)', borderRadius: '14px', padding: '22px', marginBottom: '16px', width: '100%', boxSizing: 'border-box',
  border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};
// Sida 38, punkt 2: kolumnbredden lever i CSS-klassen .form-row-2
// (index.css) istället för här, så mobilens 1-kolumns-överskrivning
// (@media max-width 768px) kan träffa den — se samma kommentar i
// Contacts.jsx/EmployeeForm.jsx. Varje användning nedan får
// className="form-row-2" också.
const grid2 = { display: 'grid', gap: '14px' };
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
const btnPrimary = { padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(61, 122, 46, 0.25)' };
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
const SECTION_TONES = {
  green: { bg: BRAND.greenLight, color: BRAND.greenDark },
  amber: { bg: BRAND.amberBg, color: BRAND.amberText },
  red: { bg: BRAND.redBg, color: BRAND.redText },
  gray: { bg: BRAND.grayBg, color: 'var(--status-gray-text)' },
};
function SectionHeading({ icon: Icon, tone = 'green', children }) {
  const t = SECTION_TONES[tone] || SECTION_TONES.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '10px', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
function ToggleSwitch({ checked, onChange, label, hint, disabled = false }) {
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
    danger: { bg: 'var(--status-red-bg)', color: '#991b1b' },
  };
  const t = map[tone] || map.warning;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: t.bg, color: t.color }}>{children}</span>;
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
function AutoField({ label, type = 'text', value, onChange, hint, required, placeholder }) {
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
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <div style={{ fontSize: '12px', minHeight: '18px', display: 'flex', alignItems: 'center' }}>
          {isSaving && <span style={{ color: 'var(--text-muted)' }}>Sparar...</span>}
          {isSaved && <span style={{ color: BRAND.greenDark, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}><Check size={12} /> Sparat</span>}
        </div>
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
        <SectionHeading icon={Lock} tone="gray">Lösenord</SectionHeading>
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
          <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
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
    if (!window.confirm('Inaktivera tvåstegsverifiering? Kontot blir skyddat av enbart lösenord igen.')) return;
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
      <div style={{ marginBottom: '8px' }}><SectionHeading icon={Laptop} tone="gray">Aktiva sessioner</SectionHeading></div>
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
        <div style={{ marginBottom: '6px' }}><SectionHeading icon={Palette} tone="green">Välj mall</SectionHeading></div>
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
        <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="green">Anpassa mallen</SectionHeading></div>
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
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #3d7a2e; color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">Acceptera inbjudan</a>
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
      .select('id, invited_email, role, status, invited_at, expires_at')
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
        .insert({ owner_user_id: user.id, company_id: company.id, invited_email: email, role: inviteRole })
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

  const handleRevoke = async (memberId) => {
    if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; }
    if (!window.confirm('Återkalla den här personens åtkomst till företaget?')) return;
    await supabase.from('company_members').update({ status: 'revoked' }).eq('id', memberId);
    loadMembers();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Användare och Åtkomst</h2>
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
              <label style={labelStyle}>Behörighet</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={inputBase}>
                <option value="editor">Kan redigera</option>
                <option value="viewer">Kan bara läsa</option>
              </select>
            </div>
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
            key: 'actions', label: '', align: 'right', render: row => (!row.isOwnerRow && row.status !== 'revoked') ? (
              <button onClick={() => handleRevoke(row.id)} title="Återkalla åtkomst" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Trash2 size={15} />
              </button>
            ) : null,
          }] : []),
        ]}
      />
      {!loading && members.length === 0 && isOwner && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px' }}>Inga andra användare inbjudna ännu.</p>
      )}
      {isOwner ? (
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '10px', maxWidth: '560px' }}>Max 3 användare per företag totalt (du + 2 inbjudna). "Kan redigera" ger samma åtkomst som du har; "Kan bara läsa" kan se men aldrig spara ändringar.</p>
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
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Shield size={20} style={{ color: BRAND.green, flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Ingen aktiv betalprenumeration ännu</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '520px' }}>Bokix har i dagsläget ingen betald abonnemangsplan kopplad till kontot.</div>
          </div>
        </div>
      </div>
    );
  }

  const isTrialing = sub.status === 'trialing';
  const endDate = isTrialing ? sub.trial_ends_at : sub.current_period_end;
  const statusBadge = sub.cancel_at_period_end
    ? { bg: 'var(--status-amber-bg)', text: 'var(--status-amber-text)', label: 'Avslutas' }
    : (sub.status === 'active' || sub.status === 'trialing')
      ? { bg: 'var(--status-green-bg)', text: 'var(--status-green-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status }
      : { bg: 'var(--status-red-bg)', text: 'var(--status-red-text)', label: SUBSCRIPTION_STATUS_LABELS[sub.status] || sub.status };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Shield size={20} style={{ color: BRAND.green, flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Bokix — 99 kr/mån</span>
              <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: statusBadge.bg, color: statusBadge.text }}>{statusBadge.label}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px' }}>
              {sub.cancel_at_period_end
                ? <>Avslutas {fmtDateSv(endDate)} — du har full åtkomst fram till dess, sedan tas inget mer betalt.</>
                : isTrialing
                  ? <>Kostnadsfri provperiod till {fmtDateSv(endDate)}, därefter 99 kr/mån automatiskt.</>
                  : sub.status === 'past_due'
                    ? <>Senaste betalningen misslyckades — Stripe försöker automatiskt igen. Uppdatera ditt kort om det upprepas.</>
                    : <>Förnyas automatiskt {fmtDateSv(endDate)}.</>}
            </div>
          </div>
        </div>

        {!sub.cancel_at_period_end && sub.status !== 'canceled' && !confirmCancel && (
          <button onClick={() => setConfirmCancel(true)} style={{ ...btnSecondary, flexShrink: 0 }}>Avsluta prenumeration</button>
        )}
        {sub.cancel_at_period_end && (
          <button onClick={handleReactivate} disabled={busy} style={{ ...btnPrimary, flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Återaktiverar...' : 'Ångra uppsägning'}
          </button>
        )}
      </div>

      {confirmCancel && (
        <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>Avsluta prenumerationen?</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Du behåller full åtkomst till och med {fmtDateSv(endDate)} — redan betald tid återbetalas inte, men inget mer dras efter det.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCancel} disabled={busy} style={{ ...btnPrimary, background: '#dc2626', boxShadow: 'none', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Avslutar...' : 'Ja, avsluta'}
            </button>
            <button onClick={() => setConfirmCancel(false)} disabled={busy} style={btnGhost}>Avbryt</button>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--status-red-text)', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

export default function Settings({
  company = {}, setCompanyInfo, accounts = [], verifications = [], invoices = [], quotes = [], expenses = [],
  contacts = [], projects = [], onImport, onReset, stripeAccountId, onConnectStripe, onDisconnectStripe,
  zettleConnected = false, onConnectZettle,
  onConnectEmailDomain, onCheckEmailDomainStatus, onDisconnectEmailDomain, user,
  companyList = [], activeCompanyId, onSwitchCompany, onAddCompany,
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
}) {
  const [activeTab, setActiveTab] = useState('profile');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [emailDomainInput, setEmailDomainInput] = useState('');
  const [emailDomainBusy, setEmailDomainBusy] = useState(false);
  const [emailDomainError, setEmailDomainError] = useState('');
  const [nextInvoiceNumberInput, setNextInvoiceNumberInput] = useState('');
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
  const companyRegistrationComplete = Boolean(company?.orgNr);
  // Org.nummer-uppslaget för "Slutför din företagsregistrering" nedan —
  // samma hook/mönster som Auth.jsx:s registreringssteg 2 och
  // Contacts.jsx, skriver bara till companyDraft istället för regX-state.
  const [companyRegLegalForm, setCompanyRegLegalForm] = useState('');
  const companyRegLookup = useCompanyLookup((key, value) => {
    if (key === 'name') setCompanyDraft(d => ({ ...d, name: value }));
    else if (key === 'orgNr') setCompanyDraft(d => ({ ...d, orgNr: formatOrgNr(value) }));
    else if (key === 'legalForm') setCompanyRegLegalForm(value);
  });
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['profile', 'company', 'billing', 'invoice', 'users', 'subscription', 'data'].includes(hash)) {
        setActiveTab(hash);
      }
    }
  }, []);

  const handleSetTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${tab}`);
  };

  // Grupperad undermeny — rent visuellt (påverkar inte activeTab-logiken,
  // bara hur knapparna radas upp), så sidan känns organiserad istället för
  // en odifferentierad lista på sju rader.
  const navGroups = [
    { label: 'Konto', items: [
      { id: 'profile', label: 'Min profil', icon: User },
    ] },
    { label: 'Företag', items: [
      { id: 'company', label: 'Företag', icon: Building2 },
      { id: 'billing', label: 'Betalning', icon: CreditCard },
      { id: 'invoice', label: 'Fakturamall', icon: FileText },
    ] },
    { label: 'System', items: [
      { id: 'users', label: 'Användare och Åtkomst', icon: Users },
      { id: 'subscription', label: 'Prenumeration', icon: Shield },
      { id: 'data', label: 'Data och Inställningar', icon: Sliders },
    ] },
  ];

  const firstName = user?.user_metadata?.first_name || '';
  const lastName = user?.user_metadata?.last_name || '';
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

  return (
    // Kundfeedback (padding-genomgången, Skatt/Inställningar/Rapport): den
    // här sidan hade en egen, betydligt större kant-marginal (32/40/48px)
    // än resten av appens numera enhetliga 24px — kvarlämnad sedan innan
    // "ingen space"-städningen, eftersom .main-content-inners bas-padding
    // (index.css) redan nollställdes men den här sidans EGEN inline-padding
    // aldrig rördes. Trimmad vidare till 20px (uppföljning, "inte så mycket
    // space") — matchar ListPageHeaders eget 20px-sidoinset istället för
    // att vara en egen, större siffra bara den här sidan hade.
    <div className="settings-page" style={{ padding: '20px', minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page, #f4f7f5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div style={{
          width: 46, height: 46, borderRadius: '13px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: BRAND.green, color: 'white', boxShadow: '0 2px 6px rgba(61, 122, 46, 0.25)',
        }}>
          <Sliders size={22} strokeWidth={2.2} />
        </div>
        <div>
          {/* Kundfeedback ("luft i sidhuvudet"): 2px mellan rubrik och
              undertext kändes hopklämt — samma 6-8px-rytm som Dashboard/
              ListPageHeader fick nu. */}
          <h1 style={{ fontSize: '27px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>Inställningar</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Hantera din profil, ditt företag och hur Bokix ser ut och beter sig.</p>
        </div>
      </div>

      {/* Mobil: dropdown-väljare istället för den fasta sidomenyn nedan —
          en sju rader lång, 232px bred kolumn skulle annars äta upp
          merparten av en 375px-skärm och klämma innehållet till en
          oläsbar remsa (se .settings-nav-desktop/.settings-nav-mobile i
          index.css för hur de två växlas med display:none per breakpoint,
          samma mönster som .global-top-bar/.desktop-top-bar). */}
      <select
        className="settings-nav-mobile"
        value={activeTab}
        onChange={e => handleSetTab(e.target.value)}
        aria-label="Inställningssektion"
      >
        {navGroups.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="settings-layout" style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        {/* Undermeny — fast bredd, aldrig centrerad, grupperad i tre block.
            Bara på desktop/tablet — se .settings-nav-desktop i index.css. */}
        <div data-tour="page-settings-nav" className="settings-nav-desktop" style={{ width: '232px', flexShrink: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '18px', position: 'sticky', top: '24px' }}>
          {navGroups.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 14px', marginBottom: '6px' }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSetTab(item.id)}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-muted)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', width: '100%',
                        border: 'none', background: active ? BRAND.green : 'transparent',
                        color: active ? 'white' : 'var(--text-main)',
                        fontWeight: active ? 700 : 500,
                        borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '14px',
                        boxShadow: active ? '0 4px 12px rgba(61, 122, 46, 0.28)' : 'none',
                        transition: 'background-color 0.12s, box-shadow 0.12s',
                      }}
                    >
                      <item.icon size={17} strokeWidth={active ? 2.4 : 2} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Innehåll — fyller resterande bredd (hela bredden på mobil, se
            .settings-content i index.css) */}
        <div className="settings-content" style={{ flex: 1, minWidth: 0, paddingLeft: '28px' }}>

          {/* 1. Min profil */}
          {activeTab === 'profile' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Min profil</h2>

              <div style={card}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, flexShrink: 0 }}>
                    {initials}
                  </div>
                </div>

                <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Förnamn" value={firstName} onChange={(v) => updateUserMeta({ first_name: v })} />
                  <AutoField label="Efternamn" value={lastName} onChange={(v) => updateUserMeta({ last_name: v })} />
                  <div style={{ gridColumn: '1 / 3' }}>
                    <AutoField label="E-post (inloggning)" type="email" value={user?.email || ''} onChange={(v) => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } supabase.auth.updateUser({ email: v }); }} hint="Kräver att du bekräftar via e-post innan ändringen gäller." required />
                  </div>
                </div>
              </div>

              <PasswordSection user={user} readOnly={readOnly} />
              {/* readOnly (demo): TwoFactorSection hämtar riktiga MFA-faktorer
                  från Supabase direkt vid mount (ingen klickbar åtgärd att
                  spärra) — hoppas över helt istället för att göra ett
                  Supabase-anrop från en icke-inloggad besökare. */}
              {readOnly ? (
                <div style={card}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>Tvåstegsverifiering</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Kräver ett riktigt konto att visa och aktivera.</p>
                </div>
              ) : <TwoFactorSection />}
              <ActiveSessionsSection user={user} readOnly={readOnly} />
            </div>
          )}

          {/* 2. Företag */}
          {activeTab === 'company' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Företag</h2>

              {/* Sida 38: flyttad hit från sidomenyns tidigare dropdown —
                  samma byt-företag/lägg-till-företag-funktion, bara UI:t
                  flyttat till en plats man faktiskt letar efter den. */}
              {companyList.length > 0 && (
                <div style={card}>
                  <div style={{ marginBottom: '16px' }}><SectionHeading icon={Landmark} tone="green">Dina företag</SectionHeading></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px', marginBottom: '12px' }}>
                    {companyList.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSwitchCompany?.(c.id)}
                        disabled={c.id === activeCompanyId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px',
                          border: `1.5px solid ${c.id === activeCompanyId ? BRAND.green : 'var(--border)'}`,
                          background: c.id === activeCompanyId ? BRAND.greenLight : 'var(--bg-card)',
                          cursor: c.id === activeCompanyId ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
                        }}
                      >
                        {c.id === activeCompanyId ? <Check size={15} color={BRAND.greenDark} /> : <span style={{ width: 15, flexShrink: 0 }} />}
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Namnlöst företag'}</span>
                      </button>
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

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={Building2} tone="green">Grunduppgifter</SectionHeading></div>
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
                      Slutför din företagsregistrering — organisationsnumret och namnet du sparar här blir företagets registrerade uppgifter (namnet går att låsa upp igen bara via support@bokix.se, så dubbelkolla innan du sparar).
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
                  </div>
                ) : (
                  <>
                    <div style={{ maxWidth: '672px' }}>
                      <label style={labelStyle}>Företagsnamn</label>
                      <div style={{ ...inputBase, background: 'var(--bg-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                        {company?.name || '—'}
                      </div>
                      {/* Låst — se api/company-access.js:s serverspärr. Bara
                          UI-återspeglingen av den regeln, inte själva
                          skyddet (det sitter server-side, verifierat även
                          med ett giltigt reauthToken). */}
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Registrerat företagsnamn — kontakta <a href="mailto:support@bokix.se" style={{ color: BRAND.green }}>support@bokix.se</a> för att ändra det. Vill du visa ett annat namn på fakturor, använd fältet nedan istället.
                      </div>
                    </div>
                    <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
                      <AutoField label="Organisationsnummer" value={companyDraft?.orgNr || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, orgNr: v })} />
                      <AutoField label="Momsregistreringsnummer" value={companyDraft?.vatNr || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, vatNr: v })} />
                    </div>
                    <div style={{ maxWidth: '672px' }}>
                      <AutoField label="Adress" value={companyDraft?.address || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, address: v })} />
                    </div>
                    {/* F-skattsedel skrivs ut på varenda faktura/offert (se InvoiceDocument)
                        men gick tidigare inte att ändra någonstans — den föll tillbaka på
                        en hårdkodad text ("Innehar F-skattsedel") som INTE nödvändigtvis
                        stämmer för alla företagsformer. Görs redigerbar här istället för
                        att tyst påstå något om företaget som kanske inte är sant. */}
                    <div style={{ maxWidth: '672px' }}>
                      <AutoField
                        label="F-skattsedel (text på faktura)" value={companyDraft?.fSkatt || 'Innehar F-skattsedel'}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, fSkatt: v })}
                        hint="Skrivs ut på fakturor/offerter under företagsuppgifterna. Ändra eller töm om det inte stämmer för ditt företag."
                      />
                    </div>
                    {/* Fritt visningsnamn för fakturor — separat från det
                        låsta registrerade namnet ovan (se InvoiceDocument.jsx:s
                        motsvarande fallback). Tomt = använd det registrerade
                        namnet, precis som innan den här möjligheten fanns. */}
                    <div style={{ maxWidth: '672px' }}>
                      <AutoField
                        label="Visningsnamn på faktura" value={companyDraft?.invoiceDisplayName || ''}
                        onChange={(v) => setCompanyDraft({ ...companyDraft, invoiceDisplayName: v })}
                        hint="Visas på fakturor/offerter istället för det registrerade företagsnamnet, om ifyllt — t.ex. om ni är kända under ett annat namn. Lämna tomt för att visa det registrerade namnet."
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={Phone} tone="green">Kontaktuppgifter</SectionHeading></div>
                <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="E-post" type="email" value={companyDraft?.email || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, email: v })} hint="Visas som kontaktväg längst ner på fakturor." />
                  <AutoField label="Telefon" type="tel" value={companyDraft?.phone || ''} onChange={(v) => setCompanyDraft({ ...companyDraft, phone: v })} />
                </div>
              </div>

              {/* Reauthentication (se ReauthCodeStep ovan) — Grunduppgifter/
                  Kontaktuppgifter ovan autosparar INTE längre, de kräver ett
                  uttryckligt klick här + en emailad kod. Övriga företagsfält
                  (Logotyp, Räkenskapsår/moms, påminnelser, Bankuppgifter i
                  Betalning-fliken) är opåverkade, autosparar som förut. */}
              <div style={{ marginBottom: '20px' }}>
                {showCompanyReauth ? (
                  <ReauthCodeStep onVerified={saveCompanyInfo} onCancel={() => setShowCompanyReauth(false)} />
                ) : (
                  <>
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

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="green">Logotyp</SectionHeading></div>
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
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Calendar} tone="green">Räkenskapsår och moms</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>Styr periodiseringen i Rapporter, Momsdeklaration och Skatter.</p>
                <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
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
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Bell} tone="green">Automatiska påminnelser</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>Skickas automatiskt, en gång om dagen: en betalningspåminnelse till kunden 3 dagar efter förfallodatum om en faktura är obetald, och en påminnelse till er själva 7 dagar innan moms-/AGI-deadline.</p>
                <div style={{ maxWidth: '480px' }}>
                  <ToggleSwitch
                    checked={company?.notifications?.enabled ?? true}
                    onChange={(e) => setCompanyInfo({ ...company, notifications: { ...company?.notifications, enabled: e.target.checked } })}
                    label="Skicka automatiska påminnelser"
                    hint="Av stänger alla automatiska utskick för det här företaget — manuell påminnelse-knappen på fakturor påverkas inte."
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Betalning */}
          {activeTab === 'billing' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Betalning</h2>

              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Landmark} tone="green">Bankuppgifter för inbetalning</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>Dessa uppgifter visas på dina utgående fakturor så kunder vet var de ska betala.</p>
                <div className="form-row-2" style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Bankgiro" value={company?.bankgiro || ''} onChange={(v) => setCompanyInfo({ ...company, bankgiro: v })} />
                  <AutoField label="Plusgiro" value={company?.plusgiro || ''} onChange={(v) => setCompanyInfo({ ...company, plusgiro: v })} />
                  <AutoField label="IBAN" value={company?.iban || ''} onChange={(v) => setCompanyInfo({ ...company, iban: v })} />
                  <AutoField label="BIC/SWIFT" value={company?.bic || ''} onChange={(v) => setCompanyInfo({ ...company, bic: v })} />
                </div>
              </div>

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
                      {/* Kundbeslut: Bokix egen avgift ska INTE vara en fast,
                          orelaterad procentsats (var tidigare 5%) — den ska
                          följa Stripes EGEN avgift (beror på korttyp, känd
                          först efter betalningen) plus en liten egen
                          marginal (1%) ovanpå. En sådan dynamisk "kostnad
                          plus"-avgift kan bara Stripe själva räkna ut per
                          betalning (Platform Pricing Tool, ställs in i
                          Stripe Dashboard — se create-checkout-session.js:s
                          kommentar för hela resonemanget om varför koden
                          INTE längre sätter något fast belopp). Ingen
                          konstant att visa här längre, bara en ärlig
                          förklaring av modellen + en hänvisning dit den
                          faktiska summan syns. */}
                      {stripeAccountId && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
                          Du har tillgång till din egen Stripe-dashboard för att följa saldo, utbetalningar och avgifter. Avgiften per betalning är Stripes egen korttransaktionsavgift (normalt 1,5% + 1,80 kr för europeiska kort, upp till 3,15% + 1,80 kr för utländska — beror på kundens kort) plus en liten Bokix-marginal på 1% ovanpå. Exakt belopp per betalning syns i din Stripe-dashboard.
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

              {/* E-postavsändare (Sida 33) — egen domän för utgående fakturor/kvitton/
                  notiser, istället för en generisk Bokix-adress. Så länge domänen inte
                  är verifierad skickas allt via Bokix reservadress (se Inställningar-
                  texten nedan) — aldrig tyst, alltid synligt vilket läge man är i. */}
              <div style={card}>
                <div style={{ marginBottom: '14px' }}>
                  <SectionHeading icon={Mail} tone={company?.emailDomainStatus === 'verified' ? 'green' : (company?.emailDomain ? 'amber' : 'gray')}>
                    E-postavsändare
                  </SectionHeading>
                </div>

                {!company?.emailDomain ? (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', maxWidth: '520px' }}>
                      Skicka fakturor och kvitton från din egen domän (t.ex. <code>faktura@{company?.name ? company.name.toLowerCase().replace(/[^a-z0-9]+/g, '') : 'dittforetag'}.se</code>) istället för en delad Bokix-adress. Utan detta skickas mejl via Bokix reservadress.
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

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Hash} tone="green">Standardinställningar för nya fakturor</SectionHeading></div>
                <div style={{ maxWidth: '672px' }}>
                  <AutoField label="Betalningsvillkor (dagar)" type="number" value={company?.paymentTermsDays ?? '30'} onChange={(v) => setCompanyInfo({ ...company, paymentTermsDays: Number(v) || 30 })} />
                  <AutoField label="Standardtext på faktura" value={company?.invoiceFooterText || 'Tack för er affär! Dröjsmålsränta debiteras enligt räntelagen.'} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} />
                </div>

                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', maxWidth: '672px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-red-text)', fontWeight: 600, marginBottom: '8px' }}>
                    <AlertTriangle size={16} /> Numreringsserie
                  </div>
                  <div style={{ fontSize: '13px', color: '#991b1b', marginBottom: '12px' }}>
                    Nästa fakturanummer räknas normalt automatiskt fram (högsta använda + 1). Detta fält höjer bara ett golv — det kan aldrig sättas till eller under ett nummer som redan använts, så det kan inte skapa krockar i bokföringen.
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#991b1b', marginBottom: '4px' }}>Golv för nästa fakturanummer</label>
                      <input
                        type="number" value={nextInvoiceNumberInput} onChange={e => { setNextInvoiceNumberInput(e.target.value); setInvoiceNumberError(''); }}
                        placeholder={String(maxUsedInvoiceNumber + 1)}
                        style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5', background: 'var(--bg-card)', color: '#991b1b', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button onClick={saveNextInvoiceNumber} style={{ padding: '8px 16px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Spara golv</button>
                    <span style={{ fontSize: '12px', color: '#991b1b' }}>
                      {company?.nextInvoiceNumber ? `Aktivt golv: ${company.nextInvoiceNumber}. ` : ''}Högsta använda fakturanummer just nu: {maxUsedInvoiceNumber || '—'}.
                    </span>
                  </div>
                  {invoiceNumberError && <div style={{ color: '#991b1b', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{invoiceNumberError}</div>}
                </div>
              </div>
            </div>
          )}

          {/* 4. Fakturamall */}
          {activeTab === 'invoice' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Fakturamall</h2>
              <InvoiceTemplateSection company={company} setCompanyInfo={setCompanyInfo} user={user} readOnly={readOnly} />
            </div>
          )}

          {/* 5. Användare och Åtkomst */}
          {activeTab === 'users' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <UsersAndAccessSection company={company} user={user} firstName={firstName} lastName={lastName} sharedAccess={sharedAccess} readOnly={readOnly} />
            </div>
          )}

          {/* 6. Prenumeration */}
          {activeTab === 'subscription' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Prenumeration</h2>
              <SubscriptionSection user={user} company={company} sharedAccess={sharedAccess} readOnly={readOnly} />
              <div style={card}>
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: '0 0 10px', color: 'var(--text-main)' }}>Betalhistorik</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '12px 0' }}>Ingen betalhistorik ännu.</div>
              </div>
            </div>
          )}

          {/* 7. Data och Inställningar */}
          {activeTab === 'data' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--text-main)' }}>Data och Inställningar</h2>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Download} tone="green">Exportera och importera data</SectionHeading></div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '672px' }}>
                  Ladda ner all bokföringsdata för det här företaget (konton, verifikationer, fakturor, kvitton/utgifter, kunder/leverantörer). Vi låser aldrig in din data.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: 'var(--border-light)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    <Download size={16} /> Ladda ner allt (JSON)
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: 'var(--border-light)', color: 'var(--text-secondary)', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: importBusy ? 'not-allowed' : 'pointer', opacity: importBusy ? 0.6 : 1 }}>
                    <Upload size={16} /> {importBusy ? 'Importerar...' : 'Importera från fil'}
                    <input type="file" accept="application/json" onChange={handleImportFile} disabled={importBusy} style={{ display: 'none' }} />
                  </label>
                  {importMsg && <span style={{ fontSize: '13px', color: importMsg.startsWith('Kunde inte') ? 'var(--status-red-text)' : BRAND.greenDark, fontWeight: 600 }}>{importMsg}</span>}
                </div>
              </div>

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={Plug} tone="gray">Integrationer</SectionHeading></div>

                {/* ── Stripe-raden — riktig logga + statusbricka, en egen
                       "Anslut"-knapp i Stripes stil när den inte redan
                       hanteras via Betalning-fliken (som har sin egen,
                       fullständiga Stripe-sektion) ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px 18px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StripeLogo height={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>Stripe</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kortbetalningar på dina fakturor</div>
                    </div>
                  </div>
                  <Badge tone={stripeAccountId ? 'positive' : 'warning'}>{stripeAccountId ? 'Ansluten' : 'Inte ansluten'}</Badge>
                </div>

                {/* ── Zettle-raden — samma layout, egen logga/färg ── */}
                {onConnectZettle && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px 18px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ZettleLogo height={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>Zettle</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kassaförsäljning som bokföringsunderlag</div>
                      </div>
                    </div>
                    {zettleConnected ? (
                      <Badge tone="positive">Ansluten</Badge>
                    ) : (
                      <button onClick={() => { if (readOnly) { window.alert(DEMO_BLOCKED_MSG); return; } onConnectZettle(); }} style={btnZettleConnect}>
                        <ZettleLogo height={15} /> Anslut
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Laptop} tone="gray">Utseende på datorn</SectionHeading></div>
                <ToggleSwitch
                  checked={hideScrollbar}
                  onChange={() => onToggleHideScrollbar?.()}
                  label="Dölj scrollbar"
                  hint="Göm det synliga scrollfältet i webbläsarfönstret på datorn. Sidan skrollar precis som förut — bara handtaget syns inte. Mobilen döljer sitt redan alltid, oavsett den här inställningen."
                />
                <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
                  <ToggleSwitch
                    checked={sidebarStyle === 'dark'}
                    onChange={() => onToggleSidebarStyle?.()}
                    label="Mörk sidomeny"
                    hint="Sidomenyn blir mörkgrön medan resten av appen fortfarande är ljus. Har ingen effekt om du redan kör mörkt läge — där är sidomenyn mörk ändå."
                  />
                </div>
              </div>

              <div style={{ ...card, background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)' }}>
                <div style={{ marginBottom: '10px' }}><SectionHeading icon={Trash2} tone="red">Radera företagets bokföringsdata</SectionHeading></div>
                <p style={{ fontSize: '13px', color: '#991b1b', margin: '0 0 12px', maxWidth: '600px' }}>
                  Detta raderar all bokföring, alla fakturor, kunder och verifikationer för <strong>{company?.name || 'det här företaget'}</strong> permanent. Det kan inte ångras. Din Bokix-inloggning ({user?.email}) påverkas inte och du loggas inte ut.
                </p>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
