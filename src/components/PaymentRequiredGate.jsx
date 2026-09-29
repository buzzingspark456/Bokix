import React, { useEffect, useState } from 'react';
import { CreditCard, LogOut, AlertCircle, Lock, Download } from './icons';
import { downloadSie4 } from '../utils/sieExport';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import { supabase } from '../supabaseClient';
import { closeUfYear, ufClosedInfo, ufAutoCloseLabel } from '../utils/ufClose';
import { t } from '../i18n';

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
        {t('ui.s')}
      </span>
      <span style={{ fontWeight: 700, color: '#425466' }}>{t('ui.stripe')}</span>
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
export default function PaymentRequiredGate({ user, company, onSignedOut, ownerUnpaid = false, onSwitchCompany }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Inbjuden medlem vars företagsägare slutat betala. Medlemmen kan inte
  // betala åt ägaren, så ingen betalknapp: bara förklaringen, ett byte till
  // ett företag som fungerar (om det finns) och utloggning.
  const memberLocked = Boolean(ownerUnpaid);
  const forCompany = !memberLocked && Boolean(company?.requiresOwnPayment);
  // UF-konto vars gratisperiod är slut (eller som avslutat UF-året): två val,
  // fortsätta och betala, eller avsluta. Ett avslutat konto går att läsa i
  // tre månader och stängs sedan; bokföringen sparas i sju år i arkivet (se
  // utils/ufClose.js och api/_ufAccount.js).
  const isUf = !forCompany && !memberLocked && Boolean(user?.user_metadata?.uf);
  const [ufClosed, setUfClosed] = useState(() => ufClosedInfo(user));
  const [closing, setClosing] = useState(false);
  const handleCloseUf = async () => {
    setErrorMsg('');
    setClosing(true);
    try {
      const result = await closeUfYear();
      if (result) setUfClosed(result);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setClosing(false);
    }
  };
  // Den som slutat betala äger fortfarande sin bokföring och måste enligt
  // bokföringslagen kunna visa upp den i sju år. Betalspärren får därför
  // aldrig stänga ute någon från sina egna räkenskaper: har kontot bokföring
  // visas en nedladdning här, utan att man behöver betala först.
  const [ownCompanies, setOwnCompanies] = useState([]);
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    supabase.from('user_data').select('state').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const list = Object.values(data?.state?.companies || {}).filter(c => (
        (c?.verifications?.length || 0) + (c?.invoices?.length || 0) + (c?.expenses?.length || 0)
      ) > 0);
      setOwnCompanies(list);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Har kontot bokföring är det en tidigare kund, inte en ny registrering.
  const returning = !forCompany && ownCompanies.length > 0;

  const downloadBackup = (c) => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...c }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bokix-export-${(c.company?.name || 'foretag').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleContinueToPayment = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const { session } = await createStripeSubscriptionCheckout({
        user_id: user.id,
        customer_email: user.email,
        company_id: forCompany ? company.id : undefined,
      });
      if (!session?.url) throw new Error(t('ui.ingen_betalningslank_mottogs_fran_stripe'));
      window.location.href = session.url;
    } catch (err) {
      // requestStripeApi (stripeApi.js) har redan försökt tre gånger — det
      // här är ett kvarstående, troligen infrastrukturellt fel (Vercels
      // edge/bot-skydd), inte något användaren kan rätta till genom att
      // skriva rätt. Ett tekniskt "Stripe API error (404)" hjälper ingen,
      // så en generisk statuskod-formad text bytes ut mot vanligt språk.
      const friendly = /^Stripe API error \(\d+\)$/.test(err.message)
        ? t('ui.kunde_inte_na_betalningstjansten_just_nu_vanta_e')
        : (err.message || t('ui.nagot_gick_fel_forsok_igen_om_en_stund'));
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
          {memberLocked ? t('ui.foretaget_ar_last_just_nu') : isUf ? (ufClosed ? t('ui.uf_aret_ar_avslutat') : t('ui.ert_uf_ar_ar_slut')) : forCompany ? t('ui.slutfor_betalningen_for_det_har_foretaget') : returning ? t('ui.din_prenumeration_ar_inte_aktiv') : t('ui.slutfor_din_betalning_for_att_fortsatta')}
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '28px' }}>
          {memberLocked
            ? <>{company?.name ? <><strong>{company.name}</strong> {t('ui.delas')}</> : t('ui.foretagen_du_ar_inbjuden_till_delas')} {t('ui.med_dig_av_foretagets_agare_och_agarens_prenumer')}</>
            : isUf
            ? (ufClosed
              ? <>{t('ui.kontot_ar_skrivskyddat_och_stangs_den')} <strong>{ufClosed.deleteLabel}</strong>{t('ui.ladda_ner_det_ni_behover_innan_dess_bokforingen')}</>
              : <>{t('ui.gratisperioden_ar_slut_vill_ni_driva_foretaget_v')}{ufAutoCloseLabel(user) && <> {t('ui.valjer_ni_inget_stangs_kontot')} <strong>{ufAutoCloseLabel(user)}</strong>.</>}</>)
            : forCompany
            ? <>{t('ui.varje_foretag_i_bokix_betalas_for_sig')} <strong>{company?.name || t('ui.det_har_foretaget')}</strong> {t('ui.vantar_fortfarande_pa_betalningsuppgifter_hos_st')}</>
            : returning
              ? <>{t('ui.kontot')} {user?.email} {t('ui.har_ingen_aktiv_prenumeration_starta_den_igen_fo')}</>
              : <>{t('ui.ditt_konto')}{user?.email}{t('ui.ar_skapat_men_du_har_inte_lagt_in_betalningsuppg')}</>}
        </p>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: 'var(--status-red-bg)', borderRadius: '8px', fontSize: '13px', color: 'var(--status-red-text)', fontWeight: 600, marginBottom: '18px', textAlign: 'left' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {errorMsg}
          </div>
        )}

        {memberLocked && onSwitchCompany && (
          <button
            type="button"
            onClick={onSwitchCompany}
            style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '14px' }}
          >
            {t('ui.byt_till_ett_annat_foretag')}
          </button>
        )}

        {!memberLocked && (<>
        <button
          onClick={handleContinueToPayment}
          disabled={loading}
          style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', boxShadow: '0 2px 6px color-mix(in srgb, var(--accent) 25%, transparent)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginBottom: '14px' }}
        >
          {loading ? t('ui.skickar_dig_till_stripe') : isUf ? t('ui.fortsatt_med_bokix') : t('ui.fortsatt_till_betalning')}
        </button>

        {isUf && !ufClosed && (
          <button
            type="button"
            onClick={handleCloseUf}
            disabled={closing}
            style={{ width: '100%', padding: '13px', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)', cursor: closing ? 'wait' : 'pointer', fontFamily: 'inherit', marginBottom: '14px' }}
          >
            {closing ? t('ui.avslutar') : t('ui.avsluta_uf_aret')}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <Lock size={12} /> {t('ui.saker_betalning_via')} <StripeBadge />
        </div>
        </>)}

        {ownCompanies.length > 0 && (
          <div style={{ textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: '18px', marginBottom: '18px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{ufClosed ? t('ui.kan_laddas_ner_till', { deleteLabel: ufClosed.deleteLabel }) : t('ui.din_bokforing_finns_kvar')}</div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>
              {isUf
                ? t('ui.ladda_ner_den_utan_att_betala_till_exempel_som_u')
                : t('ui.du_kan_ladda_ner_den_utan_att_betala_sie4_lases')}
            </p>
            {ownCompanies.map(c => (
              <div key={c.company?.id || c.company?.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0' }}>
                <span style={{ flex: '1 1 140px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{c.company?.name || t('ui.foretag')}</span>
                <span style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => downloadSie4(c.company, c.accounts, c.verifications)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={13} /> {t('ui.sie4')}
                </button>
                <button type="button" onClick={() => downloadBackup(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={13} /> {t('ui.allt_json')}
                </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSignOut}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <LogOut size={14} /> {t('ui.logga_ut')}
        </button>
      </div>
    </div>
  );
}
