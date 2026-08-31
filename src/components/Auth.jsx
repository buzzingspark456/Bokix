import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, UserPlus, Mail, Lock,
  ArrowRight, ArrowLeft, ShieldCheck, Check, User, Hash,
  RefreshCw,
  FileText, BarChart3, Receipt, Users, Shield, Briefcase,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import Turnstile from './Turnstile';

// ── Litet Stripe-märke — se motsvarande kommentar i PaymentRequiredGate.jsx
// (samma lokala-kopia-mönster). ──
function StripeBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: 4, background: '#635BFF', color: 'white', fontSize: '10px', fontWeight: 800, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        S
      </span>
      <span style={{ fontWeight: 700, color: '#425466' }}>Stripe</span>
    </span>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px',
  fontSize: '14.5px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const REGISTER_STEPS = ['Personlig info', 'Bekräfta e-post', 'Företag', 'Lösenord'];

// ── Autouppslag mot FöretagsAPI på registreringens "Ditt företag"-steg
// (useCompanyLookup, se api/company-access.js). Företagsnamnet skrivs inte
// längre in för hand här — organisationsnumret är det enda fältet, och när
// 10 siffror är ifyllda slår handleOrgNrChange upp och fyller regCompany
// automatiskt (se companyLookup nedan). lookupStatusStyle visar resultatet
// av det uppslaget under fältet. ──
const lookupStatusStyle = { fontSize: '12px', marginTop: '8px', lineHeight: 1.5, color: 'var(--text-secondary)' };

// Säkerhetsgranskningen: bara en längdgräns (8 tecken) fanns tidigare,
// ingen som helst indikation till användaren om hur starkt lösenordet
// faktiskt är. Modern vägledning (NIST 800-63B) säger längd > påtvingade
// teckenklasser — så det här BLOCKERAR inget extra utöver 8-tecknersgränsen,
// bara visar en mätare som uppmuntrar längre/mer varierade lösenord.
// Det egentliga läckage-skyddet (kolla mot kända läckta lösenord via
// HaveIBeenPwned) är istället en inställning i Supabase Dashboard →
// Authentication → Policies → "Leaked password protection" — går inte att
// koda fram här, måste slås på där (verifierar server-side vid signup,
// mer robust än något klienten skulle kunna göra ändå).
function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Svagt — lägg till fler tecken', color: '#ef4444', pct: 25 };
  if (score === 2) return { label: 'Okej', color: '#f59e0b', pct: 50 };
  if (score <= 3) return { label: 'Bra', color: '#84cc16', pct: 75 };
  return { label: 'Starkt', color: '#3d7a2e', pct: 100 };
}

// ── Översikt över appens faktiska huvudsektioner (samma sex som den
// riktiga inloggade sidomenyn i App.jsx), visad på sista registrerings-
// steget — en snabb "karta" över vad som väntar innan man ens loggat in
// första gången, inte en påhittad funktionslista. ──
const APP_SECTIONS_OVERVIEW = [
  { icon: FileText, label: 'Fakturering' },
  { icon: BarChart3, label: 'Bokföring' },
  { icon: Receipt, label: 'Utgifter' },
  { icon: Briefcase, label: 'Projekt' },
  { icon: Users, label: 'Anställda och lön' },
  { icon: Shield, label: 'Skatt och bokslut' },
];

// Sessionstoken satt av InviteRedeem.jsx när någon öppnar en inbjudningslänk
// — samma nyckel som App.jsx:s redeemPendingInvite läser vid nästa lyckade
// inloggning/registrering. sessionStorage (inte localStorage): tokenet ska
// inte överleva längre än den här enskilda flikens session, och rensas
// ändå bort explicit av redeemPendingInvite oavsett utfall.
const PENDING_INVITE_KEY = 'bokix_pending_invite_token';

export default function Auth({ onLogin, onBackToLanding }) {
  const [isLogin, setIsLogin] = useState(true);
  // En inbjuden person ska aldrig behöva ange ett eget företagsnamn/orgnr
  // eller betala för en egen prenumeration — de ska bara skapa ett lösenord
  // och komma in. Läses en gång vid mount (inte varje render) eftersom
  // sessionStorage inte kan ändras av något ANNAT än InviteRedeem.jsx medan
  // det här formuläret är öppet.
  const [hasPendingInvite] = useState(() => typeof window !== 'undefined' && Boolean(sessionStorage.getItem(PENDING_INVITE_KEY)));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [regStep, setRegStep] = useState(0); // 0=personal, 1=email-confirm, 2=company, 3=password
  // Kontot är skapat och vi väntar på Stripe Checkout-URL:en innan sidan
  // navigerar bort — egen flagga (inte bara `loading`) så steg 2 kan visa en
  // tydlig "skickar dig vidare"-vy istället för företagsformuläret igen.
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // "Glömt lösenord?" — egen liten vy ovanpå inloggningsformuläret, inte ett
  // eget steg i REGISTER_STEPS (det är bara för nytt-konto-flödet). Visar
  // ALLTID samma bekräftelse oavsett om e-postadressen faktiskt finns eller
  // ej (se handleForgotPassword) — att svara olika hade läckt vilka
  // e-postadresser som är registrerade i Bokix.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState('');

  // Bot-/captcha-spärr (säkerhetsgranskningen) — se Turnstile.jsx för
  // aktivering. Egna tokens per formulär eftersom det är separata
  // widget-instanser (olika steg/vyer).
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [regCaptchaToken, setRegCaptchaToken] = useState('');

  // Step 0 – Personal info
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

  // Step 2 – Company
  const [regCompany, setRegCompany] = useState('');
  const [regOrgNr, setRegOrgNr] = useState('');
  // Register's own answer for the legal form (FöretagsAPI's `legalForm`,
  // via applyCompany) — authoritative, unlike the digit-position guess
  // below. Empty until a lookup actually resolves.
  const [regLegalForm, setRegLegalForm] = useState('');

  // Fallback only: a local heuristic from the org number's own digits, used
  // when a real lookup hasn't resolved a legal form yet (or failed) so the
  // step still shows *something*. Can be wrong — see orgType.js's own
  // caveat — so regLegalForm below is always preferred once present.
  const orgType = detectOrgType(regOrgNr);
  const displayedOrgType = (regLegalForm && formatLegalForm(regLegalForm)) || orgType;

  // Autouppslag mot FöretagsAPI — det här steget har bara namn + org.nummer
  // (till skillnad från Contacts.jsx finns ingen adress/postnr/ort-fält
  // här ännu, det fylls i senare i OnboardingFlow.jsx efter inloggning),
  // så adaptern nedan ignorerar de flesta fälten från useCompanyLookup —
  // utom 'legalForm' (se regLegalForm ovan), som ersätter den lokala
  // gissningen i orgType.js med registrets faktiska svar så fort ett
  // uppslag lyckas. org.nummer formateras via SAMMA formatOrgNr som
  // fältets egen onChange använder, så en ifylld post-lookup-siffersträng
  // ser likadan ut (556123-4567) som en manuellt inskriven.
  const handleLookupField = (key, value) => {
    if (key === 'name') setRegCompany(value);
    else if (key === 'orgNr') setRegOrgNr(formatOrgNr(value));
    else if (key === 'legalForm') setRegLegalForm(value);
  };
  const companyLookup = useCompanyLookup(handleLookupField);

  // Switch between login/register and reset step
  const switchMode = (login) => {
    setIsLogin(login);
    setRegStep(0);
    setErrorMsg('');
    setShowForgotPassword(false);
    setForgotSent(false);
  };

  // Skickar återställningslänken via EGEN server-rutt (api/auth/
  // request-password-reset.js) istället för direkt mot Supabase — den
  // rutten är den enda platsen som faktiskt kan hålla koll på "max 5
  // återställningsmejl/dygn per e-postadress" (kundönskemål), eftersom en
  // klient aldrig kan lita på sig själv för en gräns (öppna DevTools, kör
  // om anropet). Se den filen för redirectTo/felresonemanget som tidigare
  // låg här (bugkritiskt: window.location.origin vs Supabases
  // Redirect URLs-allowlist) — samma logik, bara flyttad server-side.
  // App.jsx (onAuthStateChange, PASSWORD_RECOVERY-eventet) är oförändrad.
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;
    setErrorMsg('');
    setForgotLoading(true);
    try {
      if (!forgotEmail.trim()) throw new Error('Ange din e-postadress');
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), captchaToken: forgotCaptchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      // Samma "alltid samma svar" som innan — servern svarar med fel bara
      // för sådant som captcha/nätverk/hastighetsbegränsning (inklusive
      // vår EGEN 5/dygn-gräns, 429), ALDRIG för att adressen saknar konto.
      if (!res.ok) throw new Error(data?.error || 'Kunde inte skicka återställningslänken.');
      setForgotSent(true);
    } catch (err) {
      // Bugkritiskt (kundfeedback): en trasig/oväntad felrespons från
      // Supabase (t.ex. serverfel utan strukturerad body, sett efter att
      // custom SMTP kopplades in) gav ett `error`-objekt UTAN läsbart
      // `.message` — `setErrorMsg(err.message)` satte då bokstavligen
      // "undefined" eller (om något längre upp i kedjan redan gjort
      // `JSON.stringify` på en tom felkropp) den tomma strängen "{}",
      // rakt av som text i rutan. Ett äkta, läsbart meddelande visas
      // fortfarande om det finns — annars en generisk text istället för
      // att någonsin visa den råa felrepresentationen för användaren.
      const readable = typeof err?.message === 'string' && err.message.trim() && err.message.trim() !== '{}'
        ? err.message
        : 'Något gick fel. Försök igen om en stund, eller kontakta support@bokix.se om det upprepas.';
      setErrorMsg(readable);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (!loginEmail || !loginPassword) throw new Error('Fyll i alla fält');
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
        options: loginCaptchaToken ? { captchaToken: loginCaptchaToken } : undefined,
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (regStep === 0) {
      if (!regFirstName.trim()) { setErrorMsg('Ange ditt förnamn'); return; }
      if (!regEmail.trim()) { setErrorMsg('Ange din e-postadress'); return; }
      setRegStep(1);
      return;
    }

    if (regStep === 1) {
      // Email step – just a placeholder, user confirms and moves to company.
      // En inbjuden person hoppar rakt förbi företagssteget (3) — de ska
      // aldrig ombes namnge ett eget företag för att gå med i någon ANNANS.
      setRegStep(hasPendingInvite ? 3 : 2);
      return;
    }

    if (regStep === 2) {
      if (!regOrgNr.trim() || regOrgNr.replace(/\D/g, '').length < 10) {
        setErrorMsg('Ange ett giltigt organisationsnummer (10 siffror)');
        return;
      }
      // Företagsnamnet fylls i automatiskt av ett lyckat FöretagsAPI-uppslag
      // (regCompany sätts då av companyLookup.applyCompany via
      // handleLookupField), men fältet nedan är ALLTID redigerbart för
      // hand — se motiveringen vid namnfältet: en enskild firma har inget
      // eget bolagsregister att slå upp (bara ägarens personnummer, se
      // orgType.js), och ett FöretagsAPI-avbrott/slut kredit-kvot (402)
      // ska aldrig kunna blockera en registrering helt. Så den här
      // kontrollen är bara ett vanligt obligatoriskt-fält-krav numera,
      // inte ett bevis på ett lyckat uppslag.
      if (!regCompany.trim()) {
        setErrorMsg('Ange företagsnamnet.');
        return;
      }
      setRegStep(3);
      return;
    }

    if (regStep === 3) {
      if (regPassword.length < 8) { setErrorMsg('Lösenordet måste vara minst 8 tecken'); return; }
      if (regPassword !== regPassword2) { setErrorMsg('Lösenorden matchar inte'); return; }
      setLoading(true);
      // Egen flagga (inte bara "kom vi förbi signUp") — annars skulle ett
      // fel i själva Stripe-anropet felaktigt visa "kontot skapades" när
      // det egentligen var signUp() som aldrig lyckades.
      let accountCreated = false;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              first_name: regFirstName,
              last_name: regLastName,
              // Tomma för en inbjuden person — de skapar inget eget företag
              // här (se hasPendingInvite ovan). App.jsx:s fetchUserData
              // hoppar då över "skapa tomt företag"-grenen helt, eftersom
              // den bara körs när varken egen data eller delad åtkomst finns.
              company_name: hasPendingInvite ? '' : regCompany,
              org_nr: hasPendingInvite ? '' : regOrgNr,
            },
            ...(regCaptchaToken ? { captchaToken: regCaptchaToken } : {}),
          }
        });
        if (error) throw error;
        accountCreated = true;

        // Inbjuden person: inget eget företag, ingen egen prenumeration att
        // betala för — de rider på ägarens (se supabase-setup.sql:
        // company_members, App.jsx: fetchUserData/hasSharedAccess). Själva
        // inlösningen av inbjudan sker i App.jsx (redeemPendingInvite) så
        // fort en riktig session finns — här är det klart, invänta bara att
        // onAuthStateChange (App.jsx) tar över (kräver bekräftad e-post
        // beroende på projektets Supabase-inställningar, precis som annars).
        if (hasPendingInvite) {
          setLoading(false);
          return;
        }

        // Kontot finns nu (oavsett om data.session är satt — det kräver
        // bekräftad e-post beroende på Supabase-projektets inställningar,
        // men data.user.id finns redan). Skickas direkt vidare till Stripe
        // för betalningsuppgifter: 30 dagars gratis provperiod, sedan 99
        // kr/mån (create-subscription-checkout.js) — email-bekräftelsen
        // sköts parallellt via länken i mejlet, blockerar inte det här.
        setRedirectingToPayment(true);
        const { session } = await createStripeSubscriptionCheckout({
          user_id: data.user.id,
          customer_email: regEmail,
        });
        if (!session?.url) throw new Error('Ingen betalningslänk mottogs från Stripe.');
        window.location.href = session.url;
        return; // Lämnar sidan — inget mer att göra här.
      } catch (err) {
        setRedirectingToPayment(false);
        // requestStripeApi (stripeApi.js) har redan försökt tre gånger
        // innan den ger upp — ett kvarstående "Stripe API error (xxx)" är
        // troligen infrastrukturellt (Vercels edge/bot-skydd), inte något
        // fel i det användaren skrev in.
        const stripeIssue = /^Stripe API error \(\d+\)$/.test(err.message)
          ? 'kunde inte nå betalningstjänsten just nu'
          : err.message;
        setErrorMsg(
          accountCreated
            ? `Kontot skapades, men vi kunde inte skicka dig vidare till betalning (${stripeIssue}). Kontakta support@bokix.se så hjälper vi dig igång.`
            : err.message
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div id="auth-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, fontFamily: "'Inter', sans-serif", padding: '32px 20px' }}>
      <style>{`
        #auth-root, #auth-root *, #auth-root *::before, #auth-root *::after { box-sizing: border-box; }
        #auth-root button { -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent; }
        /* Kundfeedback (samma skärmdump som flik-fixet ovan): webbläsarens
           egen ifyllningsfärg (Chrome/Edge autofill) målar över inputens
           background: var(--bg-muted) med sin egen ljusblå/gula ton via
           en UA-stilregel som vanlig CSS-specificitet inte kommer åt — syns
           tydligt som en ljus ruta mitt i det mörka kortet i mörkt läge.
           webkit-box-shadow inset "målar över" den tvingade bakgrunden med
           samma temafärg som inputen redan har; den orimligt långa
           transitionen stoppar Chromes gula infärgnings-animation vid
           autofill. */
        #auth-root input:-webkit-autofill,
        #auth-root input:-webkit-autofill:hover,
        #auth-root input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--text-main);
          -webkit-box-shadow: 0 0 0 1000px var(--bg-muted) inset;
          box-shadow: 0 0 0 1000px var(--bg-muted) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
        .auth-logo-link { display: inline-flex; text-decoration: none; transition: opacity 0.2s ease; }
        .auth-logo-link:hover { opacity: 0.85; }
        @keyframes authSpin { to { transform: rotate(360deg); } }
        .auth-spin { animation: authSpin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .auth-spin { animation: none !important; } }
        @media (max-width: 480px) {
          .auth-form-panel { padding: 32px 22px !important; }
        }
      `}</style>

      {/* Kundfeedback: den tidigare tvåkolumns-layouten (varumärkespanel med
          funktionslista + "100% Säkert/GDPR/Krypterat"-märken bredvid
          formuläret) var säljande text som inte hör hemma på en inloggnings-
          sida — det är inte här man övertygar någon om att köpa Bokix, det
          är här en redan övertygad besökare snabbt ska komma in. Ett enda
          centrerat kort istället: bara loggan (identitet, inte reklam) och
          själva formuläret. Smalare maxbredd (440px, inte 960px) eftersom
          kortet inte längre behöver rymma två kolumner. */}
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,23,42,0.10)' }}>
        <div className="auth-form-panel" style={{ padding: '44px 40px' }}>
          {/* Bugkritiskt: LandingPage/Auth växlar via lokalt state
              (App.jsx: showLanding), inte skilda routes — en vanlig
              <Link to="/"> är ett no-op när man redan står på "/", vilket
              gjorde loggan verkningslös här. onBackToLanding (App.jsx)
              nollställer det state:t direkt; e.preventDefault() stoppar
              Link:ens egen (verkningslösa) navigeringsförsök så de två
              aldrig krockar. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <Link
              to="/"
              className="auth-logo-link"
              aria-label="Till startsidan"
              onClick={(e) => { if (onBackToLanding) { e.preventDefault(); onBackToLanding(); } }}
            >
              <BokixWordmark height={32} />
            </Link>
          </div>

        {/* Mode tabs — bugkritiskt (kundfeedback, med skärmdump): den aktiva
            fliken hade en HÅRDKODAD `background: 'white'` medan texten
            använde den tema-medvetna `var(--text-main)` — i mörkt läge blir
            den ljus/vit, så vit text på vit bakgrund gjorde "Logga in"-
            fliken praktiskt taget osynlig så fort appens tema (satt
            tidigare, t.ex. innan utloggning) var mörkt. `var(--bg-card)`
            istället: vit i ljust läge (ingen synlig skillnad där) men
            korrekt mörk i mörkt läge, matchar texten igen. */}
        <div style={{ display: 'flex', background: 'var(--border-light)', borderRadius: '12px', padding: '4px', marginBottom: '32px' }}>
          <button onClick={() => switchMode(true)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: isLogin ? 'var(--bg-card)' : 'transparent', color: isLogin ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} /> Logga in
          </button>
          <button onClick={() => switchMode(false)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: !isLogin ? 'var(--bg-card)' : 'transparent', color: !isLogin ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={16} /> Nytt konto
          </button>
        </div>

        {/* LOGIN */}
        {isLogin ? (
          showForgotPassword ? (
            /* "Glömt lösenord?" — se handleForgotPassword för varför samma
               bekräftelse alltid visas, oavsett om kontot faktiskt finns. */
            <>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Glömt lösenord?</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ange din e-postadress så skickar vi en återställningslänk.</p>
              </div>
              {forgotSent ? (
                <div style={{ padding: '24px', background: 'var(--status-green-bg)', borderRadius: '14px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Mail size={24} color="white" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)', marginBottom: '8px' }}>Kolla din inkorg</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Om det finns ett konto med den adressen har vi skickat en återställningslänk dit.
                  </div>
                  <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); }} style={{ marginTop: '18px', background: 'none', border: 'none', color: BRAND.green, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowLeft size={14} /> Tillbaka till inloggning
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>E-postadress</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                      <input type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                    </div>
                  </div>
                  <Turnstile onVerify={setForgotCaptchaToken} onExpire={() => setForgotCaptchaToken('')} />
                  {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
                  <button type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: forgotLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Skickar...' : 'Skicka återställningslänk'} <ArrowRight size={16} />
                  </button>
                  <button type="button" onClick={() => { setShowForgotPassword(false); setErrorMsg(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <ArrowLeft size={14} /> Tillbaka till inloggning
                  </button>
                </form>
              )}
            </>
          ) : (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Välkommen tillbaka</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Logga in på ditt konto nedan.</p>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>E-postadress</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={labelStyle}>Lösenord</label>
                  <button type="button" onClick={() => { setShowForgotPassword(true); setErrorMsg(''); setForgotEmail(loginEmail); }} style={{ background: 'none', border: 'none', color: BRAND.green, fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '6px' }}>
                    Glömt lösenord?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input type="password" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                </div>
              </div>
              <Turnstile onVerify={setLoginCaptchaToken} onExpire={() => setLoginCaptchaToken('')} />
              {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={16} />
              </button>
            </form>
          </>
          )
        ) : (
          /* REGISTER - Multi-step */
          <>
            {/* Step indicator */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {REGISTER_STEPS.map((s, i) => (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ height: '4px', borderRadius: '2px', background: i <= regStep ? BRAND.green : 'var(--border)', transition: 'background 0.3s' }} />
                    <span style={{ fontSize: '11px', fontWeight: i === regStep ? 700 : 500, color: i <= regStep ? BRAND.green : 'var(--text-muted)' }}>{s}</span>
                  </div>
                ))}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {regStep === 0 && 'Personlig info'}
                {regStep === 1 && 'Bekräfta e-post'}
                {regStep === 2 && 'Ditt företag'}
                {regStep === 3 && 'Skapa lösenord'}
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                {regStep === 0 && 'Fyll i dina uppgifter för att skapa ett konto.'}
                {regStep === 1 && `Vi skickar ett bekräftelsemail till ${regEmail}.`}
                {regStep === 2 && 'Ange ditt företag – det här är obligatoriskt.'}
                {regStep === 3 && 'Sista steget — sedan skickas du vidare till betalning.'}
              </p>
            </div>

            <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* STEP 0 – Personal info */}
              {regStep === 0 && (
                <>
                  <div className="form-row-2" style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Förnamn *</label>
                      <div style={{ position: 'relative' }}>
                        <User size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                        <input type="text" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Anna" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Efternamn</label>
                      <input type="text" style={inputStyle} placeholder="Svensson" value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>E-postadress *</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="email" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="anna@foretag.se" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}

              {/* STEP 1 – Confirm email */}
              {regStep === 1 && (
                <div style={{ padding: '24px', background: 'var(--status-green-bg)', borderRadius: '14px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Mail size={24} color="white" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)', marginBottom: '8px' }}>Kontrollera din inkorg</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Vi kommer att skicka ett bekräftelsemail till<br />
                    <strong>{regEmail}</strong><br />
                    efter att kontot skapats. Klicka på länken i mailet för att aktivera ditt konto.
                  </div>
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: BRAND.greenLight, borderRadius: '8px', fontSize: '12.5px', color: BRAND.greenDark, fontWeight: 600 }}>
                    Ingen brådska — klicka på länken när du vill. Nästa steg här är företagsuppgifter, sedan lösenord och betalning.
                  </div>
                </div>
              )}

              {/* STEP 2 – Company. handleOrgNrChange slår upp mot
                  FöretagsAPI så fort 10 siffror är ifyllda och fyller
                  regCompany automatiskt (se companyLookup ovan) — men
                  namnfältet nedan är ALLTID ett vanligt redigerbart fält,
                  aldrig bara en bekräftelsetext. Tre fall där uppslaget
                  aldrig ger ett namn och manuell inmatning är den ENDA
                  vägen framåt: (1) enskild firma — inget eget
                  bolagsregister att slå upp (personnumret ÄR numret, se
                  orgType.js/useCompanyLookup.js), (2) FöretagsAPI:s
                  månadskvot slut (402), (3) registret helt otillgängligt
                  (502/nätverksfel). Innan den här ändringen fanns inget
                  namnfält alls här — vilket blockerade registrering HELT
                  i alla tre fallen (se git-historiken för den borttagna
                  varianten). */}
              {regStep === 2 && (
                <>
                  <div>
                    <label style={labelStyle}>Organisationsnummer * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(10 siffror)</span></label>
                    <div style={{ position: 'relative' }}>
                      <Hash size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input
                        type="text"
                        inputMode="numeric"
                        style={{ ...inputStyle, paddingLeft: '38px' }}
                        placeholder="556123-4567"
                        value={regOrgNr}
                        onChange={e => { const formatted = formatOrgNr(e.target.value); setRegOrgNr(formatted); setRegCompany(''); setRegLegalForm(''); companyLookup.handleOrgNrChange(formatted); }}
                        required
                      />
                    </div>
                    {companyLookup.orgLookup.status === 'loading' && <div style={lookupStatusStyle}>Hämtar företagsuppgifter…</div>}
                    {companyLookup.orgLookup.status === 'error' && <div style={lookupStatusStyle}>{companyLookup.orgLookup.message}</div>}
                  </div>

                  <div>
                    <label style={labelStyle}>Företagsnamn *</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="Ex. Mitt Företag AB"
                      value={regCompany}
                      onChange={e => setRegCompany(e.target.value)}
                      required
                    />
                    {/* Kort, flyktig bekräftelse direkt efter ett lyckat
                        uppslag — fältet ovan är annars identiskt oavsett om
                        namnet kom från registret eller skrevs in för hand;
                        det ena är inte "mer rätt" eller mer låst än det andra. */}
                    {companyLookup.orgLookup.status === 'done' && regCompany && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark }}>
                        <Check size={12} /> Hämtat från bolagsregistret — ändra gärna om något stämmer bättre.
                      </div>
                    )}
                    {displayedOrgType && (
                      <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: BRAND.greenLight, borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: BRAND.greenDark }}>
                        <Check size={12} /> Identifierad som: {displayedOrgType}
                      </div>
                    )}
                  </div>

                  {/* Översikt — vad som väntar efter lösenord och betalning,
                      så resan inte känns som ett svart hål innan man loggat
                      in första gången. */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '9px' }}>
                      Det här väntar sen
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px' }}>
                      {APP_SECTIONS_OVERVIEW.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '9px' }}>
                          <s.icon size={13} color={BRAND.greenDark} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 – Password, sedan konto + betalning */}
              {regStep === 3 && redirectingToPayment && (
                <div style={{ padding: '24px', background: 'var(--status-green-bg)', borderRadius: '14px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <RefreshCw size={24} color="white" className="auth-spin" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)', marginBottom: '8px' }}>Kontot är skapat</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Skickar dig vidare till Stripe för betalningsuppgifter...
                  </div>
                </div>
              )}
              {regStep === 3 && !redirectingToPayment && (
                <>
                  <div>
                    <label style={labelStyle}>Lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="password" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Minst 8 tecken" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
                    </div>
                    {passwordStrength(regPassword) && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${passwordStrength(regPassword).pct}%`, background: passwordStrength(regPassword).color, transition: 'all 0.2s' }} />
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: passwordStrength(regPassword).color }}>{passwordStrength(regPassword).label}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Bekräfta lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="password" style={{ ...inputStyle, paddingLeft: '38px', borderColor: regPassword2 && regPassword2 !== regPassword ? '#f43f5e' : undefined }} placeholder="Upprepa lösenord" value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required />
                    </div>
                  </div>

                  {/* Ärligt om vad som händer efter "Skapa konto och lägg
                      till betalning" — nästa steg är Stripes egen
                      betalningssida, inte direkt in i appen. */}
                  <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '9px' }}>
                    <ShieldCheck size={15} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Näst skickas du till <StripeBadge /> för att lägga in betalningsuppgifter. 30 dagar gratis, sedan 99 kr/mån — avsluta innan dess så kostar det ingenting.
                    </span>
                  </div>
                  <Turnstile onVerify={setRegCaptchaToken} onExpire={() => setRegCaptchaToken('')} />
                </>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>
              )}

              {!redirectingToPayment && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  {regStep > 0 && (
                    <button type="button" onClick={() => { setRegStep(s => s - 1); setErrorMsg(''); }} style={{ padding: '12px 20px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <ArrowLeft size={14} /> Tillbaka
                    </button>
                  )}
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                    {loading
                      ? (regStep === REGISTER_STEPS.length - 1 ? 'Skapar konto...' : 'Fortsätt...')
                      : regStep === REGISTER_STEPS.length - 1 ? 'Skapa konto och lägg till betalning' : 'Fortsätt'} <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
