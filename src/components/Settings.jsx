import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User, Building2, CreditCard, Users, Shield, Sliders, Check, Download, Upload,
  AlertTriangle, Trash2, Mail, Plug, Laptop, FileText, Lock, KeyRound, Image as ImageIcon,
  Palette, Landmark, Hash, Calendar, Phone,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BRAND } from '../utils/brandColors';
import InvoiceDocument, { INVOICE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE } from './InvoiceDocument';

// ── Delade stilar ──
// Bugkritiskt (Sida 15): varje sektion är ett fullbrett, ljust kort — inte
// smala vita kort med stor luft runt om.
const card = {
  background: 'white', borderRadius: '14px', padding: '22px', marginBottom: '16px', width: '100%', boxSizing: 'border-box',
  border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const inputBase = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
};
const btnPrimary = { padding: '9px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(61, 122, 46, 0.25)' };
const btnSecondary = { padding: '9px 18px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };
const btnGhost = { padding: '9px 14px', background: 'transparent', color: '#6b7280', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' };
// Säkerhetsförsvagande handling (t.ex. stänga av tvåstegsverifiering) — dämpad
// varningston (amberBg/amberText), inte samma neutrala grå som vanliga
// sekundärknappar och inte heller Bokix grönt (det är en primär, positiv
// handling-färg, fel signal för något som gör kontot mindre skyddat).
const btnWarning = { padding: '9px 18px', background: BRAND.amberBg, color: BRAND.amberText, border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };
// Sällan använd säkerhetsåtgärd (utloggning av andra enheter) — tydligt röd
// men ghost/outline, inte en vardaglig spara-knapp.
const btnDangerGhost = { padding: '9px 18px', background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' };

// Färgad ikon-i-cirkel framför ett kortnamn — gör varje sektion visuellt
// identifierbar på en snabb blick istället för en lång lista av likadana
// svarta rubriker, och ger sidan starkare färg utan att den blir stökig.
const SECTION_TONES = {
  green: { bg: BRAND.greenLight, color: BRAND.greenDark },
  amber: { bg: BRAND.amberBg, color: BRAND.amberText },
  red: { bg: BRAND.redBg, color: BRAND.redText },
  gray: { bg: BRAND.grayBg, color: '#3f3f46' },
};
function SectionHeading({ icon: Icon, tone = 'green', children }) {
  const t = SECTION_TONES[tone] || SECTION_TONES.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '10px', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} strokeWidth={2.3} />
      </div>
      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111' }}>{children}</h3>
    </div>
  );
}

function Badge({ tone = 'warning', children }) {
  const map = {
    positive: { bg: BRAND.greenLight, color: BRAND.greenDark },
    warning: { bg: BRAND.amberBg, color: BRAND.amberText },
    danger: { bg: '#fee2e2', color: '#991b1b' },
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
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <div style={{ fontSize: '12px', minHeight: '18px', display: 'flex', alignItems: 'center' }}>
          {isSaving && <span style={{ color: '#9ca3af' }}>Sparar...</span>}
          {isSaved && <span style={{ color: BRAND.greenDark, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}><Check size={12} /> Sparat</span>}
        </div>
      </div>
      <input
        type={type} value={val} onChange={handleChange} placeholder={placeholder}
        style={inputBase}
        onFocus={e => e.target.style.borderColor = BRAND.green}
        onBlur={e => e.target.style.borderColor = '#d1d5db'}
      />
      {hint && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

// ── Bilduppladdning (profilbild / logotyp) ──
// Riktig uppladdning till Supabase Storage (bucket "bokix-uploads", se
// supabase-setup.sql) — inte en bildlänk att klistra in. Bucketen måste
// skapas i Supabase-projektet en gång (SQL-filen gör det); tills dess
// visas ett tydligt, ärligt felmeddelande istället för att låtsas lyckas.
function ImageUploadField({ label, value, onChange, uploadPath, hint }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Filen måste vara en bild.'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Bilden får vara max 3 MB.'); return; }
    setBusy(true); setError('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${uploadPath}.${ext}`;
      const { error: upErr } = await supabase.storage.from('bokix-uploads').upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('bokix-uploads').getPublicUrl(path);
      onChange(`${data.publicUrl}?v=${Date.now()}`); // cache-bust så en ny bild syns direkt, inte den gamla från webbläsarcachen
    } catch (err) {
      const notConfigured = /bucket not found/i.test(err.message || '');
      setError(notConfigured ? 'Bildlagring är inte konfigurerad i Supabase-projektet ännu (kör storage-delen av supabase-setup.sql).' : (err.message || 'Uppladdningen misslyckades.'));
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
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} disabled={busy} style={btnGhost}>Ta bort</button>}
      </div>
      {hint && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>{hint}</div>}
      {error && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{error}</div>}
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

function TemplateThumb({ tplId, previewProps, scale = 0.34 }) {
  const w = Math.round(A4_PAGE_WIDTH * scale);
  const h = Math.round(A4_PAGE_HEIGHT * scale);
  return (
    <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden', background: '#e4e4e7', position: 'relative' }}>
      <div style={{ width: `${A4_PAGE_WIDTH}px`, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
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
        position: 'relative', border: `2px solid ${selected ? BRAND.green : '#e4e4e7'}`, borderRadius: '12px',
        overflow: 'hidden', cursor: 'pointer', background: 'white', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <TemplateThumb tplId={tpl.id} previewProps={previewProps} scale={scale} />
      <div style={{ padding: '10px 12px', borderTop: '1px solid #e4e4e7' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#111' }}>{tpl.label}</div>
        <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>{tpl.description}</div>
      </div>
      {selected && (
        <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          <Check size={13} color="white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

// ── Lösenordssektion ──
// Nuvarande lösenord verifieras genom att faktiskt logga in med det (Supabase
// kräver det inte för updateUser, men en aktiv session i webbläsaren ska inte
// räcka för att byta lösenord — annars skyddar fältet "Nuvarande lösenord"
// ingenting alls).
function PasswordSection({ user }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changedAt = user?.user_metadata?.password_changed_at;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (newPw.length < 8) { setError('Nytt lösenord måste vara minst 8 tecken.'); return; }
    if (newPw !== confirmPw) { setError('Lösenorden matchar inte varandra.'); return; }
    setBusy(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
    if (reauthError) {
      setBusy(false);
      setError('Nuvarande lösenord stämmer inte.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
      data: { password_changed_at: new Date().toISOString() },
    });
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
        <SectionHeading icon={Lock} tone="gray">Lösenord</SectionHeading>
        <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>
          {changedAt ? `Senast ändrat ${relativeTimeSv(changedAt)}` : 'Inte spårat ännu — byt lösenord här för att börja spåra det'}
        </span>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Nuvarande lösenord</label>
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{ ...inputBase, maxWidth: '340px' }} autoComplete="current-password" required />
        </div>
        <div style={{ ...grid2, maxWidth: '672px' }}>
          <div>
            <label style={labelStyle}>Nytt lösenord</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <label style={labelStyle}>Bekräfta nytt lösenord</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputBase} autoComplete="new-password" minLength={8} required />
          </div>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
        {success && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>Lösenordet är uppdaterat.</div>}
        <button type="submit" disabled={busy || !currentPw || !newPw || !confirmPw} style={{ ...btnPrimary, marginTop: '14px', opacity: (busy || !currentPw || !newPw || !confirmPw) ? 0.5 : 1, cursor: (busy || !currentPw || !newPw || !confirmPw) ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Sparar...' : 'Byt lösenord'}
        </button>
      </form>
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
          <div style={{ fontSize: '13px', color: '#6b7280', maxWidth: '480px' }}>Kräver en engångskod från en autentiseringsapp (t.ex. Google Authenticator eller Authy) utöver lösenordet vid inloggning.</div>
        </div>
        {factors !== null && !enrolling && (
          verifiedFactor
            ? <button onClick={disable} disabled={busy} style={btnWarning}>Inaktivera</button>
            : <button onClick={startEnroll} disabled={busy} style={btnPrimary}>Aktivera</button>
        )}
      </div>
      {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
      {enrolling && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e4e4e7' }}>
          <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 12px' }}>Skanna koden med din autentiseringsapp, ange sedan den 6-siffriga koden den visar.</p>
          <img src={enrolling.qrCode} alt="QR-kod för tvåstegsverifiering" style={{ width: 160, height: 160, border: '1px solid #e4e4e7', borderRadius: '8px', display: 'block', marginBottom: '8px' }} />
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>Kan du inte skanna? Ange koden manuellt: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{enrolling.secret}</code></div>
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
function ActiveSessionsSection({ user }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const device = useMemo(() => detectDevice(), []);

  const signOutOthers = async () => {
    setBusy(true); setError(''); setDone(false);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div style={card}>
      <div style={{ marginBottom: '8px' }}><SectionHeading icon={Laptop} tone="gray">Aktiva sessioner</SectionHeading></div>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 14px', maxWidth: '560px' }}>
        Bokix kan i dagsläget inte visa en lista över dina enskilda inloggade enheter. Du kan däremot logga ut alla andra sessioner än den du sitter på just nu — t.ex. om du glömt logga ut på en delad dator eller en gammal telefon.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: '10px', marginBottom: '14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Laptop size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#111' }}>{device}</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{user?.email}</div>
        </div>
        <Badge tone="positive">Denna enhet</Badge>
      </div>
      <button
        onClick={signOutOthers} disabled={busy}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#fef2f2'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
        style={{ ...btnDangerGhost, opacity: busy ? 0.6 : 1, transition: 'background-color 0.12s' }}
      >{busy ? 'Loggar ut...' : 'Logga ut från alla andra enheter'}</button>
      {done && <div style={{ color: BRAND.greenDark, fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>Klart — alla andra sessioner är utloggade.</div>}
      {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
    </div>
  );
}

// ── Fakturamall-väljare (Sida 24) ──
// Valt mall-id sparas som `company.invoiceTemplateId` (företagsnivå, samma
// jsonb-företagsobjekt som redan rond-trippar till Supabase för logotyp/
// bankuppgifter etc — ingen separat tabell behövs). Redan sparade fakturor
// fryser sitt utseende vid sparningstillfället (se invoiceTemplateSnapshot
// i Invoices.jsx) — ett mallbyte här påverkar bara FRAMTIDA fakturor.
function InvoiceTemplateSection({ company, setCompanyInfo, user }) {
  const selectedId = company?.invoiceTemplateId || DEFAULT_INVOICE_TEMPLATE;
  const activeTpl = INVOICE_TEMPLATES[selectedId] || INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
  const accentColor = company?.invoiceAccentColor || activeTpl.defaultAccent;

  const previewProps = {
    invoice: SAMPLE_INVOICE, customer: SAMPLE_CUSTOMER, company, rows: SAMPLE_ROWS, totals: SAMPLE_TOTALS,
    currency: 'SEK', logoUrl: company?.logoUrl, footerText: company?.invoiceFooterText, accentColor,
  };

  return (
    <>
      <div style={card}>
        <div style={{ marginBottom: '6px' }}><SectionHeading icon={Palette} tone="green">Välj mall</SectionHeading></div>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', maxWidth: '672px' }}>
          Välj utseendet på dina utgående kund- och leverantörsfakturor. Redan skickade fakturor behåller sitt utseende — bara nya fakturor använder mallen du väljer här.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '720px' }}>
          {Object.values(INVOICE_TEMPLATES).map(tpl => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              selected={selectedId === tpl.id}
              onSelect={() => setCompanyInfo({ ...company, invoiceTemplateId: tpl.id })}
              previewProps={{ ...previewProps, accentColor: company?.invoiceAccentColor || tpl.defaultAccent }}
              scale={0.44}
            />
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="green">Anpassa mallen</SectionHeading></div>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', maxWidth: '380px' }}>
            <div style={{ marginBottom: '18px' }}>
              <ImageUploadField label="Logotyp" value={company?.logoUrl || ''} onChange={(v) => setCompanyInfo({ ...company, logoUrl: v })} uploadPath={`${user?.id}/logo-${company?.id}`} hint="JPG eller PNG, max 3 MB." />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Accentfärg</label>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 8px' }}>Din egen varumärkesfärg på fakturan — fritt val, inte begränsat till Bokix grönt.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color" value={accentColor}
                  onChange={e => setCompanyInfo({ ...company, invoiceAccentColor: e.target.value })}
                  style={{ width: '44px', height: '36px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', background: 'white' }}
                />
                <span style={{ fontSize: '13px', color: '#374151', fontFamily: 'monospace' }}>{accentColor}</span>
                <button
                  type="button" onClick={() => setCompanyInfo({ ...company, invoiceAccentColor: BRAND.green })}
                  title="Använd Bokix grönt som accentfärg"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'white', border: '1px solid #d1d5db', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: BRAND.green, display: 'inline-block' }} /> Bokix grönt
                </button>
              </div>
            </div>

            <AutoField label="Tilläggsinformation / fottext" value={company?.invoiceFooterText || ''} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} hint="Visas längst ner på fakturan, t.ex. betalningsvillkor eller en hälsning." />
          </div>

          <div style={{ flex: 1, minWidth: '300px', maxWidth: '500px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live-förhandsvisning</div>
            <div style={{ border: '1px solid #e4e4e7', borderRadius: '10px', overflow: 'hidden', background: '#e4e4e7', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
              <TemplateThumb tplId={selectedId} previewProps={previewProps} scale={0.6} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Settings({
  company = {}, setCompanyInfo, accounts = [], verifications = [], invoices = [], expenses = [],
  contacts = [], projects = [], onImport, onReset, stripeAccountId, onConnectStripe, onDisconnectStripe,
  onConnectEmailDomain, onCheckEmailDomainStatus, onDisconnectEmailDomain, user,
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
  const avatarUrl = user?.user_metadata?.avatar_url || '';
  const initials = ((firstName[0] || user?.email?.[0] || '?') + (lastName[0] || '')).toUpperCase();

  const updateUserMeta = (patch) => supabase.auth.updateUser({ data: patch });

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
    const payload = { exportedAt: new Date().toISOString(), company, accounts, verifications, invoices, expenses, contacts, projects };
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
    <div style={{ padding: '32px 40px 48px', minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page, #f4f7f5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <div style={{
          width: 46, height: 46, borderRadius: '13px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenHover})`, color: 'white', boxShadow: '0 6px 16px rgba(61, 122, 46, 0.3)',
        }}>
          <Sliders size={22} strokeWidth={2.2} />
        </div>
        <div>
          <h1 style={{ fontSize: '27px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.01em' }}>Inställningar</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Hantera din profil, ditt företag och hur Bokix ser ut och beter sig.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        {/* Undermeny — fast bredd, aldrig centrerad, grupperad i tre block */}
        <div style={{ width: '232px', flexShrink: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '18px', position: 'sticky', top: '24px' }}>
          {navGroups.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 14px', marginBottom: '6px' }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSetTab(item.id)}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#eef2f6'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', width: '100%',
                        border: 'none', background: active ? BRAND.green : 'transparent',
                        color: active ? 'white' : '#3f3f46',
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

        {/* Innehåll — fyller resterande bredd */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: '28px' }}>

          {/* 1. Min profil */}
          {activeTab === 'profile' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Min profil</h2>

              <div style={card}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profilbild" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800 }}>
                      {initials}
                    </div>
                  )}
                  <div style={{ flex: 1, maxWidth: '380px' }}>
                    <ImageUploadField label="Profilbild" value={avatarUrl} onChange={(v) => updateUserMeta({ avatar_url: v })} uploadPath={`${user?.id}/avatar`} hint="JPG, PNG eller liknande, max 3 MB." />
                  </div>
                </div>

                <div style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Förnamn" value={firstName} onChange={(v) => updateUserMeta({ first_name: v })} />
                  <AutoField label="Efternamn" value={lastName} onChange={(v) => updateUserMeta({ last_name: v })} />
                  <div style={{ gridColumn: '1 / 3' }}>
                    <AutoField label="E-post (inloggning)" type="email" value={user?.email || ''} onChange={(v) => supabase.auth.updateUser({ email: v })} hint="Kräver att du bekräftar via e-post innan ändringen gäller." required />
                  </div>
                </div>
              </div>

              <PasswordSection user={user} />
              <TwoFactorSection />
              <ActiveSessionsSection user={user} />
            </div>
          )}

          {/* 2. Företag */}
          {activeTab === 'company' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Företag</h2>
              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={Building2} tone="green">Grunduppgifter</SectionHeading></div>
                <div style={{ maxWidth: '672px' }}>
                  <AutoField label="Företagsnamn" value={company?.name || ''} onChange={(v) => setCompanyInfo({ ...company, name: v })} required />
                </div>
                <div style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Organisationsnummer" value={company?.orgNr || ''} onChange={(v) => setCompanyInfo({ ...company, orgNr: v })} />
                  <AutoField label="Momsregistreringsnummer" value={company?.vatNr || ''} onChange={(v) => setCompanyInfo({ ...company, vatNr: v })} />
                </div>
                <div style={{ maxWidth: '672px' }}>
                  <AutoField label="Adress" value={company?.address || ''} onChange={(v) => setCompanyInfo({ ...company, address: v })} />
                </div>
                {/* F-skattsedel skrivs ut på varenda faktura/offert (se InvoiceDocument)
                    men gick tidigare inte att ändra någonstans — den föll tillbaka på
                    en hårdkodad text ("Innehar F-skattsedel") som INTE nödvändigtvis
                    stämmer för alla företagsformer. Görs redigerbar här istället för
                    att tyst påstå något om företaget som kanske inte är sant. */}
                <div style={{ maxWidth: '672px' }}>
                  <AutoField
                    label="F-skattsedel (text på faktura)" value={company?.fSkatt || 'Innehar F-skattsedel'}
                    onChange={(v) => setCompanyInfo({ ...company, fSkatt: v })}
                    hint="Skrivs ut på fakturor/offerter under företagsuppgifterna. Ändra eller töm om det inte stämmer för ditt företag."
                  />
                </div>
              </div>

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={Phone} tone="green">Kontaktuppgifter</SectionHeading></div>
                <div style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="E-post" type="email" value={company?.email || ''} onChange={(v) => setCompanyInfo({ ...company, email: v })} hint="Visas som kontaktväg längst ner på fakturor." />
                  <AutoField label="Telefon" type="tel" value={company?.phone || ''} onChange={(v) => setCompanyInfo({ ...company, phone: v })} />
                </div>
              </div>

              <div style={card}>
                <div style={{ marginBottom: '16px' }}><SectionHeading icon={ImageIcon} tone="green">Logotyp</SectionHeading></div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px', maxWidth: '440px' }}>
                    <ImageUploadField label="Logotyp" value={company?.logoUrl || ''} onChange={(v) => setCompanyInfo({ ...company, logoUrl: v })} uploadPath={`${user?.id}/logo-${company?.id}`} hint="Används överst på dina utgående fakturor. Max 3 MB." />
                  </div>
                  <div style={{ width: '200px', padding: '16px', border: '1px solid #e4e4e7', borderRadius: '8px', background: '#f9fafb' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase' }}>Förhandsvisning faktura</div>
                    {company?.logoUrl ? (
                      <img src={company.logoUrl} alt="Logotyp" style={{ maxHeight: '40px', maxWidth: '100%', marginBottom: '16px', display: 'block' }} />
                    ) : (
                      <div style={{ height: '40px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '16px' }} />
                    )}
                    <div style={{ height: '8px', width: '60%', background: '#e4e4e7', borderRadius: '2px', marginBottom: '4px' }} />
                    <div style={{ height: '8px', width: '40%', background: '#e4e4e7', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>

              {/* Räkenskapsår + momsperiod styr verkliga beräkningar (Taxes,
                  VatDeclaration, Reports, Verifications) — fanns tidigare BARA
                  på en separat, svårhittad "Företag"-sida utanför Inställningar
                  (CompanySettings.jsx), inte här där man faktiskt letar. */}
              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Calendar} tone="green">Räkenskapsår och moms</SectionHeading></div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', maxWidth: '672px' }}>Styr periodiseringen i Rapporter, Momsdeklaration och Skatter.</p>
                <div style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Räkenskapsår startar" type="date" value={company?.fiscalYear || ''} onChange={(v) => setCompanyInfo({ ...company, fiscalYear: v })} />
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Momsperiod</label>
                    <select
                      value={company?.vatPeriod || 'quarterly'}
                      onChange={e => setCompanyInfo({ ...company, vatPeriod: e.target.value })}
                      style={{ ...inputBase, background: 'white' }}
                    >
                      <option value="monthly">Månadsvis</option>
                      <option value="quarterly">Kvartalsvis</option>
                      <option value="yearly">Helårlig</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Betalning */}
          {activeTab === 'billing' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Betalning</h2>

              <div style={card}>
                <div style={{ marginBottom: '4px' }}><SectionHeading icon={Landmark} tone="green">Bankuppgifter för inbetalning</SectionHeading></div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', maxWidth: '672px' }}>Dessa uppgifter visas på dina utgående fakturor så kunder vet var de ska betala.</p>
                <div style={{ ...grid2, maxWidth: '672px' }}>
                  <AutoField label="Bankgiro" value={company?.bankgiro || ''} onChange={(v) => setCompanyInfo({ ...company, bankgiro: v })} />
                  <AutoField label="Plusgiro" value={company?.plusgiro || ''} onChange={(v) => setCompanyInfo({ ...company, plusgiro: v })} />
                  <AutoField label="IBAN" value={company?.iban || ''} onChange={(v) => setCompanyInfo({ ...company, iban: v })} />
                  <AutoField label="BIC/SWIFT" value={company?.bic || ''} onChange={(v) => setCompanyInfo({ ...company, bic: v })} />
                </div>
              </div>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={CreditCard} tone={stripeAccountId ? 'green' : 'amber'}>Ta emot kortbetalningar</SectionHeading></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, maxWidth: '480px' }}>
                    {stripeAccountId
                      ? 'Stripe är anslutet — kunder kan betala dina fakturor med kort direkt online.'
                      : 'Anslut Stripe för att låta kunder betala fakturor med kort direkt online.'}
                  </p>
                  {stripeAccountId
                    ? <button onClick={onDisconnectStripe} style={btnGhost}>Koppla från</button>
                    : <button onClick={onConnectStripe} style={btnPrimary}>Anslut Stripe</button>}
                </div>
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
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 14px', maxWidth: '520px' }}>
                      Skicka fakturor och kvitton från din egen domän (t.ex. <code>faktura@{company?.name ? company.name.toLowerCase().replace(/[^a-z0-9]+/g, '') : 'dittforetag'}.se</code>) istället för en delad Bokix-adress. Utan detta skickas mejl via Bokix reservadress.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text" value={emailDomainInput} onChange={e => { setEmailDomainInput(e.target.value); setEmailDomainError(''); }}
                        placeholder="dittforetag.se" style={{ ...inputBase, width: '240px' }}
                        onFocus={e => e.target.style.borderColor = BRAND.green}
                        onBlur={e => e.target.style.borderColor = '#d1d5db'}
                      />
                      <button onClick={handleConnectDomainClick} disabled={emailDomainBusy} style={{ ...btnPrimary, opacity: emailDomainBusy ? 0.6 : 1, cursor: emailDomainBusy ? 'not-allowed' : 'pointer' }}>
                        {emailDomainBusy ? 'Kopplar...' : 'Anslut domän'}
                      </button>
                    </div>
                    {emailDomainError && <div style={{ color: '#b91c1c', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{emailDomainError}</div>}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#111' }}>{company.emailDomain}</div>
                        <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '2px' }}>
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
                        <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 10px' }}>
                          Lägg till dessa DNS-poster hos din domänleverantör, samma sätt som för bokix.se:
                        </p>
                        <div style={{ overflowX: 'auto', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e4e4e7' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Typ</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Namn</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Värde</th>
                              </tr>
                            </thead>
                            <tbody>
                              {company.emailDomainRecords.map((r, i) => (
                                <tr key={i} style={{ borderBottom: i < company.emailDomainRecords.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#111' }}>{r.type || r.record}</td>
                                  <td style={{ padding: '8px 10px', color: '#374151', fontFamily: 'monospace' }}>{r.name}</td>
                                  <td style={{ padding: '8px 10px', color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all' }}>{r.value}{r.priority != null ? ` (prio ${r.priority})` : ''}</td>
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
                    {emailDomainError && <div style={{ color: '#b91c1c', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{emailDomainError}</div>}
                  </>
                )}
              </div>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Hash} tone="green">Standardinställningar för nya fakturor</SectionHeading></div>
                <div style={{ maxWidth: '672px' }}>
                  <AutoField label="Betalningsvillkor (dagar)" type="number" value={company?.paymentTermsDays ?? '30'} onChange={(v) => setCompanyInfo({ ...company, paymentTermsDays: Number(v) || 30 })} />
                  <AutoField label="Standardtext på faktura" value={company?.invoiceFooterText || 'Tack för er affär! Dröjsmålsränta debiteras enligt räntelagen.'} onChange={(v) => setCompanyInfo({ ...company, invoiceFooterText: v })} />
                </div>

                <div style={{ marginTop: '20px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', maxWidth: '672px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 600, marginBottom: '8px' }}>
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
                        style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5', background: 'white', color: '#991b1b', boxSizing: 'border-box' }}
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
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Fakturamall</h2>
              <InvoiceTemplateSection company={company} setCompanyInfo={setCompanyInfo} user={user} />
            </div>
          )}

          {/* 5. Användare och Åtkomst */}
          {activeTab === 'users' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111' }}>Användare och Åtkomst</h2>
                <button disabled title="Inbjudan av fler användare till samma företag är inte byggt ännu" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#e5e7eb', color: '#9ca3af', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'not-allowed' }}>
                  <Mail size={16} /> Bjud in användare
                </button>
              </div>
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e4e4e7' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Användare</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Roll</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: '#111' }}>{[firstName, lastName].filter(Boolean).join(' ') || 'Ditt konto'}</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{user?.email}</div>
                      </td>
                      <td style={{ padding: '16px' }}>Administratör</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '10px', maxWidth: '560px' }}>Fler användare per företag (t.ex. en redovisningsbyrå med egen inloggning) är planerat men inte byggt ännu.</p>
            </div>
          )}

          {/* 6. Prenumeration */}
          {activeTab === 'subscription' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Prenumeration</h2>
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Shield size={20} style={{ color: BRAND.green, flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#111', marginBottom: '4px' }}>Ingen aktiv betalprenumeration ännu</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', maxWidth: '520px' }}>Bokix har i dagsläget ingen betald abonnemangsplan kopplad till kontot — vi visar aldrig en påhittad plan eller ett fakturadatum här. Prislistan uppdateras och wire:as in när faktureringen är på plats.</div>
                  </div>
                </div>
              </div>
              <div style={card}>
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: '0 0 10px', color: '#111' }}>Betalhistorik</h3>
                <div style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 0' }}>Ingen betalhistorik ännu.</div>
              </div>
            </div>
          )}

          {/* 7. Data och Inställningar */}
          {activeTab === 'data' && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: '#111' }}>Data och Inställningar</h2>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Download} tone="green">Exportera och importera data</SectionHeading></div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', maxWidth: '672px' }}>
                  Ladda ner all bokföringsdata för det här företaget (konton, verifikationer, fakturor, kvitton/utgifter, kunder/leverantörer). Vi låser aldrig in din data.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    <Download size={16} /> Ladda ner allt (JSON)
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: importBusy ? 'not-allowed' : 'pointer', opacity: importBusy ? 0.6 : 1 }}>
                    <Upload size={16} /> {importBusy ? 'Importerar...' : 'Importera från fil'}
                    <input type="file" accept="application/json" onChange={handleImportFile} disabled={importBusy} style={{ display: 'none' }} />
                  </label>
                  {importMsg && <span style={{ fontSize: '13px', color: importMsg.startsWith('Kunde inte') ? '#dc2626' : BRAND.greenDark, fontWeight: 600 }}>{importMsg}</span>}
                </div>
              </div>

              <div style={card}>
                <div style={{ marginBottom: '14px' }}><SectionHeading icon={Plug} tone="gray">Integrationer</SectionHeading></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#111' }}>Stripe</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{stripeAccountId ? 'Anslutet — hanteras under Betalning och Faktura' : 'Inte anslutet'}</div>
                  </div>
                  <Badge tone={stripeAccountId ? 'positive' : 'warning'}>{stripeAccountId ? 'Ansluten' : 'Av'}</Badge>
                </div>
              </div>

              <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca' }}>
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
