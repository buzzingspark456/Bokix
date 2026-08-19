import React, { useState } from 'react';
import { CreditCard, LogOut, AlertCircle } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import { supabase } from '../supabaseClient';

// ── Visas istället för appen (App.jsx: subscriptionGate === 'blocked') när
// en inloggad Supabase-användare INTE har en giltig rad i public.
// subscriptions (trialing/active/past_due) — t.ex. om de stängde
// Stripe-fliken innan de la in betalningsuppgifter, eller om webhooken
// (customer.subscription.*) av någon anledning inte hunnit skriva statusen
// än. Aldrig ett silent-block: alltid en tydlig väg vidare till Stripe,
// eller ut igen. ──
export default function PaymentRequiredGate({ user, onSignedOut }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleContinueToPayment = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const { session } = await createStripeSubscriptionCheckout({
        user_id: user.id,
        customer_email: user.email,
      });
      if (!session?.url) throw new Error('Ingen betalningslänk mottogs från Stripe.');
      window.location.href = session.url;
    } catch (err) {
      setErrorMsg(err.message || 'Något gick fel. Försök igen om en stund.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (onSignedOut) onSignedOut();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, fontFamily: "'Inter', sans-serif", padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(15,23,42,0.10)', padding: '40px 36px', textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <BokixWordmark height={32} />
        </div>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CreditCard size={26} color={BRAND.greenDark} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '10px', letterSpacing: '-0.01em' }}>
          Slutför din betalning för att fortsätta
        </h1>
        <p style={{ fontSize: '14.5px', color: '#64748b', lineHeight: 1.65, marginBottom: '28px' }}>
          Ditt konto ({user?.email}) är skapat, men du har inte lagt in betalningsuppgifter hos Stripe än. 30 dagar gratis, sedan 99 kr/mån — avsluta innan dess så kostar det ingenting.
        </p>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: '#fee2e2', borderRadius: '8px', fontSize: '13px', color: '#b91c1c', fontWeight: 600, marginBottom: '18px', textAlign: 'left' }}>
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

        <button
          onClick={handleSignOut}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <LogOut size={14} /> Logga ut
        </button>
      </div>
    </div>
  );
}
