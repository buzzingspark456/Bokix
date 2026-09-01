import React, { useState } from 'react';
import { CreditCard, LogOut, AlertCircle, Lock } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import { supabase } from '../supabaseClient';

// ── Litet Stripe-märke — inte loggans exakta glyf (för riskabelt att
// pixel-återskapa träffsäkert som SVG-path), utan samma konvention som
// Stripes egna "Powered by Stripe"-märken: deras faktiska varumärkeslila
// (#635BFF) på en enkel rundad platta + ordmärket som text. Talar om VEM
// som hanterar kortuppgifterna, inte Bokix — viktigt förtroendesignal
// precis innan man skickas iväg dit. ──
function StripeBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, background: '#635BFF', color: 'white', fontSize: '11px', fontWeight: 800, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        S
      </span>
      <span style={{ fontWeight: 700, color: '#425466' }}>Stripe</span>
    </span>
  );
}

// ── Visas istället för appen när en inloggad Supabase-användare INTE har
// en giltig rad i public.subscriptions (trialing/active/past_due) — antingen
// KONTOTS ORIGINALSPÄRR (App.jsx: subscriptionGate === 'blocked', legacy-
// raden, oförändrad sedan innan betala-per-företag) eller (kundkrav) ett
// SPECIFIKT företags EGNA obetalda abonnemang (App.jsx: !isActiveCompanyPaid,
// `company` prop satt då) — t.ex. om Stripe-fliken stängdes innan
// betalningsuppgifter lades in, eller om webhooken (customer.subscription.*)
// av någon anledning inte hunnit skriva statusen än. Aldrig ett silent-block:
// alltid en tydlig väg vidare till Stripe, eller ut igen. ──
export default function PaymentRequiredGate({ user, company, onSignedOut }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const forCompany = Boolean(company?.requiresOwnPayment);

  const handleContinueToPayment = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const { session } = await createStripeSubscriptionCheckout({
        user_id: user.id,
        customer_email: user.email,
        company_id: forCompany ? company.id : undefined,
      });
      if (!session?.url) throw new Error('Ingen betalningslänk mottogs från Stripe.');
      window.location.href = session.url;
    } catch (err) {
      // requestStripeApi (stripeApi.js) har redan försökt tre gånger — det
      // här är ett kvarstående, troligen infrastrukturellt fel (Vercels
      // edge/bot-skydd), inte något användaren kan rätta till genom att
      // skriva rätt. Ett tekniskt "Stripe API error (404)" hjälper ingen,
      // så en generisk statuskod-formad text bytes ut mot vanligt språk.
      const friendly = /^Stripe API error \(\d+\)$/.test(err.message)
        ? 'Kunde inte nå betalningstjänsten just nu. Vänta en liten stund och försök igen.'
        : (err.message || 'Något gick fel. Försök igen om en stund.');
      setErrorMsg(friendly);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (onSignedOut) onSignedOut();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, fontFamily: "'Inter', sans-serif", padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-card)', borderRadius: '20px', boxShadow: '0 4px 20px rgba(15,23,42,0.10)', padding: '40px 36px', textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <BokixWordmark height={32} />
        </div>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CreditCard size={26} color={BRAND.greenDark} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px', letterSpacing: '-0.01em' }}>
          {forCompany ? 'Slutför betalningen för det här företaget' : 'Slutför din betalning för att fortsätta'}
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '28px' }}>
          {forCompany
            ? <>Varje företag i Bokix betalas för sig — <strong>{company?.name || 'det här företaget'}</strong> väntar fortfarande på betalningsuppgifter hos Stripe. 30 dagar gratis, sedan 99 kr/mån — avsluta innan dess så kostar det ingenting.</>
            : <>Ditt konto ({user?.email}) är skapat, men du har inte lagt in betalningsuppgifter hos Stripe än. 30 dagar gratis, sedan 99 kr/mån — avsluta innan dess så kostar det ingenting.</>}
        </p>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: 'var(--status-red-bg)', borderRadius: '8px', fontSize: '13px', color: 'var(--status-red-text)', fontWeight: 600, marginBottom: '18px', textAlign: 'left' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {errorMsg}
          </div>
        )}

        <button
          onClick={handleContinueToPayment}
          disabled={loading}
          style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginBottom: '14px' }}
        >
          {loading ? 'Skickar dig till Stripe...' : 'Fortsätt till betalning'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <Lock size={12} /> Säker betalning via <StripeBadge />
        </div>

        <button
          onClick={handleSignOut}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <LogOut size={14} /> Logga ut
        </button>
      </div>
    </div>
  );
}
