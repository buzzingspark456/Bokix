import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from './icons';
import { BokixWordmark } from './marketing/MarketingLayout';
import CloudShaderBackground from './marketing/CloudShaderBackground';
import { BRAND } from '../utils/brandColors';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { checkVatRegistration } from '../utils/companyLookup';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';
import { EMPTY_COMPANY_SETUP, companySetupFromCompany, companySetupToCompany } from './shared/FiscalYearVatFields';
import { firstYearEndOptions, defaultFirstYearEnd, todayIso, fiscalYearFields, suggestFiscalYear, isSoleTraderNumber, isPartnershipNumber, calendarYearRequired } from '../utils/fiscalYearSetup';
import { isValidSwedishOrgNr } from '../utils/personnummer';
import { keyDatesForSetup } from '../utils/setupDates';
import { dateTimeFormat } from '../utils/intlCache';
import { t, dateLocale } from '../i18n';

// Onboardingen för ett nytt konto (omgjord 2026-10-24): en fråga per skärm
// i samma kort och färger som inloggningen, en stegrad överst med svaret
// under varje klart steg, och svaren som knappar som går vidare av sig själva. Kontot
// (e-post, kod, lösenord) skapas i Auth.jsx; här frågas företaget en gång.
//
// Inget gissas tyst: räkenskapsåret och momsen förvals bara ur
// Bolagsverket och EU:s momsregister och ska bekräftas, momsperioden och
// F-skatten har inget förval alls. Sista skärmen visar företagsprofilen och
// de viktigaste datumen räknade på svaren.
// Visas av App.jsx när företaget har `needsSetup` (sätts när kontot skapas),
// så befintliga kunder ser den aldrig.

const F_TAX_TEXT = 'Godkänd för F-skatt';

const STEPS = [
  { id: 'company', label: t('ui.onb_steg_foretaget'), screen: 'company' },
  { id: 'fiscal', label: t('ui.onb2_steg_rakenskapsar'), screen: 'fiscal' },
  { id: 'vat', label: t('ui.onb2_steg_momsen'), screen: 'vatReg' },
  { id: 'tax', label: t('ui.onb_steg_fskatt'), screen: 'tax' },
  // Börjar från noll eller flyttar från ett annat program (2026-11-10).
  // Styr vilken lista startsidan visar (dashboard/GetStarted.jsx).
  { id: 'start', label: t('ui.onb_steg_start'), screen: 'start' },
  { id: 'done', label: t('ui.onb_steg_klart'), screen: 'done' },
];
const STEP_OF_SCREEN = { company: 0, firma: 0, address: 0, fiscal: 1, vatReg: 2, vatPeriod: 2, tax: 3, start: 4, done: 5 };

const VAT_PERIODS = [
  ['quarterly', t('ui.onb2_varje_kvartal'), t('ui.onb2_kort_kvartal')],
  ['monthly', t('ui.onb2_varje_manad'), t('ui.onb2_kort_manad')],
  ['yearly', t('ui.onb2_en_gang_om_aret'), t('ui.onb2_kort_ar')],
];

// Hur länge ett valt svar syns intryckt innan nästa fråga glider in.
const ADVANCE_MS = 200;

const digitsOf = (v) => String(v || '').replace(/\D/g, '');
const monthName = (m, month = 'long') => dateTimeFormat(dateLocale(), { month }).format(new Date(2026, m - 1, 1)).replace(/\.$/, '');
const fmtIso = (iso) => (iso ? dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`)) : '');
const fmtDate = (d) => dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const fmtOrg = (n) => (/^\d{10}$/.test(n || '') ? `${n.slice(0, 6)}-${n.slice(6)}` : (n || ''));

/** Första och sista månaden i ett räkenskapsår som börjar `startMonth`. */
const yearSpan = (startMonth) => [startMonth, startMonth === 1 ? 12 : startMonth - 1];

// `addMode`: Lägg till företag på ett konto som redan finns. Samma frågor, men
// strängare: företaget måste hittas hos Bolagsverket och vara aktivt, får inte
// redan finnas på kontot, och den som lägger till det intygar uppgifterna.
// Bara när registret inte går att nå får numret skrivas in för hand, och då
// kontrollerar servern igen innan betalningen (api/stripe/_registryGuard.js).
// { existingOrgNrs, defaultEmail, submitting, onCancel }
//
// `embedded`: inne i registreringens kort (Auth.jsx), som har egen
// bakgrund och stegrad. Tillbaka från första frågan anropar då `onExit`, och
// sista knappen heter `finishLabel` (till lösenordet i stället för appen).
export default function OnboardingFlow({ onComplete, initialCompanyData, firstName, embedded = false, onExit, finishLabel, addMode = null }) {
  const saved = initialCompanyData?.company || {};
  // Platshållarföretaget från registreringen ("Mitt Företag AB", inget
  // org.nr) ska inte stå förifyllt som om det vore ett riktigt svar.
  const startsKnown = Boolean(digitsOf(saved.orgNr).length === 10 || (saved.isUf && saved.name));
  const [screen, setScreen] = useState('company');
  const [history, setHistory] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);

  const [companyName, setCompanyName] = useState(startsKnown ? saved.name || '' : '');
  const [orgNr, setOrgNr] = useState(startsKnown ? saved.orgNr || '' : '');
  const [address, setAddress] = useState(saved.address || '');
  const [postalCode, setPostalCode] = useState(saved.postalCode || '');
  const [city, setCity] = useState(saved.city || '');
  const [legalForm, setLegalForm] = useState('');
  const [query, setQuery] = useState(startsKnown ? saved.name || '' : '');
  const [manual, setManual] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pendingAdvance, setPendingAdvance] = useState(false);

  const [companySetup, setCompanySetup] = useState(() => companySetupFromCompany(saved));
  const [fyEdit, setFyEdit] = useState(''); // '' | 'other' | 'first'
  const [vatCheck, setVatCheck] = useState('idle'); // idle | checking | done | error
  // Ingen förvald period och ingen förvald F-skatt: båda avgör skatten och
  // ska komma från användaren, inte från oss.
  const [vatPeriod, setVatPeriod] = useState('');
  const [fTax, setFTax] = useState(null); // true | false | null
  const [startPath, setStartPath] = useState(null); // 'new' | 'move' | null
  const [email, setEmail] = useState(addMode?.defaultEmail || '');
  const [attested, setAttested] = useState(false);

  const companyLookup = useCompanyLookup((key, value) => {
    if (key === 'name') { setCompanyName(value); setQuery(value); }
    else if (key === 'orgNr') setOrgNr(formatOrgNr(value));
    else if (key === 'address') setAddress(value);
    else if (key === 'postalCode') setPostalCode(value);
    else if (key === 'city') setCity(value);
    else if (key === 'legalForm') setLegalForm(value);
  });
  const { orgLookup, nameResults, nameSearch, lastCompany } = companyLookup;

  const orgDigits = digitsOf(orgNr);
  // Enskild firma: personnumret är firmans nummer och den finns inte hos
  // Bolagsverket. Egen väg genom onboardingen: namn och personnummer, sedan
  // adressen (som annars kommer ur registret), och bara frågan om firman
  // startade i år eftersom räkenskapsåret alltid är kalenderår.
  const [firma, setFirma] = useState(() => startsKnown && isSoleTraderNumber(digitsOf(saved.orgNr)));
  const soleTrader = firma || isSoleTraderNumber(orgDigits);
  // Rätt kontrollsiffra: Bokix är bara för svenska företag (2026-10-28).
  const orgNrValid = isValidSwedishOrgNr(orgDigits);
  const pnrValid = orgNrValid && isSoleTraderNumber(orgDigits);
  const companyValid = Boolean(companyName.trim()) && (firma ? pnrValid : (orgNrValid || Boolean(saved.isUf)));
  const deregistered = lastCompany?.active === false;
  const isAdding = Boolean(addMode);
  const inRegistry = orgLookup.status === 'done' && digitsOf(lastCompany?.orgNumber).slice(-10) === orgDigits;
  const registryDown = orgLookup.status === 'error' && !orgLookup.notFound;
  const duplicate = isAdding && orgDigits.length === 10 && (addMode.existingOrgNrs || []).some(n => digitsOf(n).slice(-10) === orgDigits);
  const canContinue = companyValid && !(isAdding && (duplicate || deregistered)) && (!isAdding || firma || inRegistry || registryDown);
  const industry = lastCompany?.sni?.[0]?.text || '';
  const vatRegistered = companySetup.vatRegistered === true;
  // Handelsbolag med personer som delägare: bara kalenderår (calendarYearRequired).
  const partnership = !firma && isPartnershipNumber(orgDigits);
  const calendarOnly = calendarYearRequired(orgDigits, companySetup.legalPartnersOnly);
  const fyValid = Boolean(companySetup.mode) && !fiscalYearFields({ ...companySetup, calendarOnly }).error;

  // Räkenskapsåret ur registret när en träff valts, så länge användaren inte själv valt.
  useEffect(() => {
    if (!lastCompany) return;
    const suggestion = suggestFiscalYear(lastCompany);
    setCompanySetup(cur => {
      if (cur.fySource === 'user') return cur;
      if (!suggestion) return { ...cur, mode: '', fySource: '', fyNote: '' };
      const legal = isPartnershipNumber(lastCompany.orgNumber) && suggestion.choice.mode === 'other' ? { legalPartnersOnly: true } : {};
      return { ...EMPTY_COMPANY_SETUP, ...cur, ...suggestion.choice, ...legal, fySource: 'registry', fyNote: suggestion.note };
    });
  }, [lastCompany]);

  // Momsregistreringen ur EU:s momsregister (VIES) när org.nr är känt.
  // Ett eget svar skrivs aldrig över.
  const lastVatChecked = useRef('');
  useEffect(() => {
    if (orgDigits.length !== 10 || lastVatChecked.current === orgDigits) return;
    lastVatChecked.current = orgDigits;
    let cancelled = false;
    setVatCheck('checking');
    checkVatRegistration(orgDigits)
      .then(res => {
        if (cancelled || !res) return;
        setVatCheck('done');
        setCompanySetup(cur => (cur.vatSource === 'user' ? cur : { ...cur, vatRegistered: res.registered, vatNr: res.registered ? res.vatNr : '', vatSource: 'vies' }));
      })
      .catch(() => { if (!cancelled) setVatCheck('error'); });
    return () => { cancelled = true; };
  }, [orgDigits]);

  // En enskild firma har alltid kalenderår.
  useEffect(() => {
    if (soleTrader && companySetup.mode === 'other') setCompanySetup(cur => ({ ...cur, mode: 'calendar' }));
  }, [soleTrader, companySetup.mode]);

  const go = (next) => {
    setHistory(h => [...h, screen]);
    setScreen(next);
    setHelpOpen(false);
    setFyEdit('');
  };
  const back = () => {
    if (!history.length) return;
    setScreen(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setHelpOpen(false);
    setFyEdit('');
  };
  const advanceSoon = (next) => setTimeout(() => go(next), ADVANCE_MS);
  const afterFiscal = () => (companySetup.vatSource === 'vies' && vatRegistered ? 'vatPeriod' : 'vatReg');

  // Vald träff eller uppslaget org.nr: vänta in uppslaget, sedan nästa fråga.
  // Ett avregistrerat företag stannar kvar så att varningen hinner läsas.
  useEffect(() => {
    if (!pendingAdvance || screen !== 'company' || orgLookup.status === 'loading') return;
    setPendingAdvance(false);
    if (orgLookup.status === 'done' && canContinue && !deregistered) advanceSoon('fiscal');
  }, [pendingAdvance, orgLookup.status, canContinue, screen, deregistered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ett personnummer i sökfältet: det är en enskild firma, vidare till dess frågor.
  useEffect(() => {
    if (screen !== 'company' || orgLookup.status !== 'firma') return;
    setPendingAdvance(false);
    setFirma(true);
    setCompanyName('');
    go('firma');
  }, [orgLookup]); // eslint-disable-line react-hooks/exhaustive-deps
  // Inskrivet för hand: registret gav ingen adress, så den frågas efteråt.
  const goManual = () => {
    if (isSoleTraderNumber(orgDigits)) setFirma(true);
    go('address');
  };
  const startFirma = () => {
    companyLookup.clearNameResults();
    resetCompany();
    setFirma(true);
    go('firma');
  };

  const resetCompany = () => {
    setCompanyName(''); setOrgNr(''); setLegalForm('');
    setAddress(''); setPostalCode(''); setCity('');
    setCompanySetup(cur => ({ ...EMPTY_COMPANY_SETUP, ...(cur.fySource === 'user' ? { mode: cur.mode, startMonth: cur.startMonth, firstStart: cur.firstStart, firstEnd: cur.firstEnd, fySource: 'user' } : {}) }));
    lastVatChecked.current = '';
    setVatCheck('idle');
  };

  const onQueryChange = (value) => {
    setQuery(value);
    setHighlight(0);
    setFirma(false);
    resetCompany();
    if (/^[\d\s-]+$/.test(value.trim()) && value.trim()) {
      companyLookup.clearNameResults();
      const formatted = formatOrgNr(value);
      if (digitsOf(formatted).length === 10) {
        setQuery(formatted);
        setOrgNr(formatted);
        setPendingAdvance(true);
        companyLookup.lookupByOrgNr(formatted);
      }
      return;
    }
    companyLookup.queueNameSearch(value);
  };

  const pick = (c) => {
    companyLookup.applyCompany(c);
    setPendingAdvance(true);
    // Hela posten (räkenskapsår, registreringsdatum) kommer bara med
    // uppslaget på org.nr, inte med namnsökningen.
    if (digitsOf(c.orgNumber).length === 10) companyLookup.lookupByOrgNr(c.orgNumber);
  };

  const onQueryKey = (e) => {
    if (nameResults.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, nameResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); pick(nameResults[highlight] || nameResults[0]); return; }
    }
    if (e.key === 'Enter' && canContinue) { e.preventDefault(); go('fiscal'); }
  };

  const setup = useMemo(() => companySetupToCompany(companySetup, orgNr), [companySetup, orgNr]);
  const keyDates = useMemo(() => keyDatesForSetup({
    orgNr, fiscalYear: setup.fiscalYear, firstFiscalYear: setup.firstFiscalYear, vatRegistered, vatPeriod,
  }), [orgNr, setup, vatRegistered, vatPeriod]);

  const finish = () => {
    onComplete({
      companyName: companyName.trim(), orgNr, address, postalCode, city, email: isAdding ? email.trim() : saved.email || '', phone: saved.phone || '',
      fiscalYear: setup.fiscalYear, setup,
      vatPeriod: vatRegistered ? vatPeriod : undefined,
      fSkatt: fTax ? F_TAX_TEXT : '',
      ...(startPath ? { startPath } : {}),
      ...(isAdding ? { registryVerified: inRegistry } : {}),
    });
  };

  // ── Svaren som står under prickarna och i företagsprofilen ──
  const fyLabel = (() => {
    if (!fyValid) return '';
    if (companySetup.mode === 'calendar') return t('ui.onb2_kalenderar');
    if (companySetup.mode === 'first') return t('ui.onb2_kort_forsta');
    const [from, to] = yearSpan(Number(companySetup.startMonth));
    return t('ui.onb2_kort_brutet', { from: monthName(from, 'short'), to: monthName(to, 'short') });
  })();
  const vatLabel = companySetup.vatRegistered === false
    ? t('ui.onb2_kort_ej_moms')
    : (VAT_PERIODS.find(([id]) => id === vatPeriod)?.[2] || '');
  const fTaxLabel = fTax === null ? '' : (fTax ? t('ui.ja') : t('ui.nej'));
  const startLabel = startPath === 'move' ? t('ui.onb_start_kort_flytt') : startPath === 'new' ? t('ui.onb_start_kort_noll') : '';
  const answers = [companyValid ? companyName : '', fyLabel, vatLabel, fTaxLabel, startLabel, ''];
  const currentStep = STEP_OF_SCREEN[screen];

  const legalFormLabel = (legalForm && formatLegalForm(legalForm)) || detectOrgType(orgNr) || '';

  // ── Skärmarna ──
  const Help = ({ text }) => (
    <>
      <button type="button" className="onb-help" aria-expanded={helpOpen} aria-label={t('ui.onb2_vad_betyder')} title={t('ui.onb2_vad_betyder')} onClick={() => setHelpOpen(o => !o)}>?</button>
      {helpOpen && <span className="onb-help-text">{text}</span>}
    </>
  );

  const Option = ({ active, onClick, children }) => (
    <button type="button" className="onb-opt" aria-pressed={Boolean(active)} onClick={onClick}>{children}</button>
  );

  const renderCompany = () => {
    const showList = !manual && nameResults.length > 0 && !companyValid;
    return (
      <>
        <h1 className="onb-q">{t('ui.onb2_vilket_foretag')}</h1>
        {manual ? (
          <div className="onb-fields">
            <input className="onb-line" aria-label={t('ui.foretagsnamn')} placeholder={t('ui.foretagsnamn')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
            <input
              className="onb-line" aria-label={t('ui.organisationsnummer')} placeholder="556123-4567" inputMode="numeric" value={orgNr}
              onChange={(e) => setOrgNr(formatOrgNr(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) goManual(); }}
            />
            {orgDigits.length === 10 && !orgNrValid && <span className="onb-warn">{t('ui.onb2_orgnr_fel')}</span>}
            {duplicate && <span className="onb-warn">{t('ui.onb3_finns_redan')}</span>}
            <div className="onb-row">
              <button type="button" className="onb-primary" disabled={!canContinue} onClick={goManual}>{t('ui.fortsatt')} <ArrowRight size={18} /></button>
            </div>
            <button type="button" className="onb-link" onClick={() => { setManual(false); setQuery(''); resetCompany(); }}>{t('ui.onb2_sok_i_registret')}</button>
          </div>
        ) : (
          <div className="onb-search">
            <input
              className="onb-line" aria-label={t('ui.onb2_sok_placeholder')} placeholder={t('ui.onb2_sok_placeholder')}
              value={query} onChange={(e) => onQueryChange(e.target.value)} onKeyDown={onQueryKey}
              autoFocus autoComplete="off" spellCheck={false}
              role="combobox" aria-expanded={showList} aria-controls="onb-results"
            />
            {showList ? (
              <ul id="onb-results" className="onb-results" role="listbox">
                {nameResults.map((c, i) => (
                  <li key={c.orgNumber || c.name} role="option" aria-selected={i === highlight}>
                    <button type="button" className={i === highlight ? 'on' : ''} onMouseEnter={() => setHighlight(i)} onClick={() => pick(c)}>
                      <span className="onb-res-name">{c.name}</span>
                      <span className="onb-res-meta">{fmtOrg(digitsOf(c.orgNumber))}{c.city ? ` · ${c.city}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="onb-status">
                {(nameSearch.status === 'loading' || orgLookup.status === 'loading') && <span className="onb-muted"><Loader2 size={12} className="onb-spin" /> {t('ui.onb2_soker')}</span>}
                {duplicate && <span className="onb-warn">{t('ui.onb3_finns_redan')}</span>}
                {companyValid && !deregistered && !duplicate && (inRegistry || !isAdding) && (
                  <span className="onb-found"><Check size={13} /> {[legalFormLabel, city, industry].filter(Boolean).join(' · ') || fmtOrg(orgDigits)}</span>
                )}
                {companyValid && deregistered && <span className="onb-warn">{t(isAdding ? 'ui.onb3_avregistrerad_stopp' : 'ui.onb2_avregistrerad')}</span>}
                {(nameSearch.status === 'error' || orgLookup.status === 'error') && (
                  <span className={isAdding && orgLookup.notFound ? 'onb-warn' : 'onb-muted'}>{orgLookup.status === 'error' ? (isAdding && orgLookup.notFound ? t('ui.onb3_hittas_inte') : orgLookup.message) : t('ui.onb2_inga_traffar')}</span>
                )}
              </div>
            )}
            {canContinue && !pendingAdvance && (
              <div className="onb-row" style={{ marginTop: '22px' }}>
                <button type="button" className="onb-primary" onClick={() => go('fiscal')}>{t('ui.fortsatt')} <ArrowRight size={18} /></button>
              </div>
            )}
            {!companyValid && (
              <div className="onb-alt">
                <button type="button" className="onb-opt" onClick={startFirma}>{t('ui.onb2_enskild_firma_knapp')}</button>
                {(!isAdding || registryDown) && <button type="button" className="onb-link" onClick={() => { setManual(true); setCompanyName(/d{6}/.test(query) ? '' : query); companyLookup.clearNameResults(); }}>{t('ui.onb2_skriv_sjalv')}</button>}
              </div>
            )}
          </div>
        )}
        <p className="onb-trust">{t('ui.onb2_trygg')}</p>
      </>
    );
  };

  const renderFirma = () => {
    const pnrTyped = orgDigits.length === 10;
    return (
      <>
        <h1 className="onb-q">{t('ui.onb2_firma_q')}</h1>
        <p className="onb-sub">{t('ui.onb2_firma_sub')}</p>
        <div className="onb-fields">
          <label className="onb-field-label" htmlFor="onb-firma-name">{t('ui.onb2_firmanamn')}</label>
          <input id="onb-firma-name" className="onb-line" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus={!companyName} autoComplete="organization" />
          <label className="onb-field-label" htmlFor="onb-firma-pnr">{t('ui.onb2_personnummer')}</label>
          <input
            id="onb-firma-pnr" className="onb-line" value={orgNr} placeholder="ÅÅMMDD-XXXX" inputMode="numeric" autoComplete="off"
            onChange={(e) => { setOrgNr(formatOrgNr(e.target.value)); lastVatChecked.current = ''; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) go('address'); }}
          />
          {pnrTyped && !pnrValid && <span className="onb-warn">{t('ui.onb2_personnummer_fel')}</span>}
          {duplicate && <span className="onb-warn">{t('ui.onb3_finns_redan')}</span>}
          <div className="onb-row">
            <button type="button" className="onb-primary" disabled={!canContinue} onClick={() => go('address')}>{t('ui.fortsatt')} <ArrowRight size={18} /></button>
          </div>
        </div>
      </>
    );
  };

  const renderAddress = () => {
    const ok = Boolean(address.trim() && postalCode.trim() && city.trim());
    const onEnter = (e) => { if (e.key === 'Enter' && ok) go('fiscal'); };
    return (
      <>
        <h1 className="onb-q">{soleTrader ? t('ui.onb2_adress_q') : t('ui.onb2_adress_q_foretag')}</h1>
        <p className="onb-sub">{t('ui.onb2_adress_sub')}</p>
        <div className="onb-fields">
          <label className="onb-field-label" htmlFor="onb-street">{t('ui.onb2_gatuadress')}</label>
          <input id="onb-street" className="onb-line" value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={onEnter} autoFocus autoComplete="street-address" />
          <div className="onb-two">
            <div>
              <label className="onb-field-label" htmlFor="onb-postal">{t('ui.onb_postnummer')}</label>
              <input id="onb-postal" className="onb-line" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} onKeyDown={onEnter} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <div>
              <label className="onb-field-label" htmlFor="onb-city">{t('ui.onb_ort')}</label>
              <input id="onb-city" className="onb-line" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={onEnter} autoComplete="address-level2" />
            </div>
          </div>
          <div className="onb-row">
            <button type="button" className="onb-primary" disabled={!ok} onClick={() => go('fiscal')}>{t('ui.fortsatt')} <ArrowRight size={18} /></button>
          </div>
        </div>
      </>
    );
  };

  // Enskild firma: alltid kalenderår, så den enda frågan är om första året pågår.
  const renderFirmaFiscal = () => {
    const thisYear = new Date().getFullYear();
    const startedThisYear = companySetup.mode === 'first';
    const chooseEarlier = () => { setCompanySetup(cur => ({ ...cur, mode: 'calendar', fySource: 'user' })); advanceSoon(afterFiscal()); };
    const chooseThisYear = () => {
      const start = companySetup.firstStart && companySetup.firstStart.startsWith(String(thisYear)) ? companySetup.firstStart : todayIso();
      const ends = firstYearEndOptions(start).filter(d => d.endsWith('-12-31'));
      setCompanySetup(cur => ({ ...cur, mode: 'first', firstStart: start, firstEnd: ends.includes(cur.firstEnd) ? cur.firstEnd : (ends[0] || `${thisYear}-12-31`), fySource: 'user' }));
    };
    const endOptions = firstYearEndOptions(companySetup.firstStart).filter(d => d.endsWith('-12-31'));
    return (
      <>
        <h1 className="onb-q">{t('ui.onb2_firma_fy_q')}</h1>
        <p className="onb-sub">{t('ui.onb2_firma_fy_sub')}</p>
        <div className="onb-opts" role="group">
          <Option active={companySetup.mode === 'calendar' && companySetup.fySource === 'user'} onClick={chooseEarlier}>{t('ui.onb2_nej_tidigare')}</Option>
          <Option active={startedThisYear} onClick={chooseThisYear}>{t('ui.onb2_ja_i_ar')}</Option>
        </div>
        {startedThisYear && (
          <div className="onb-fields onb-pop">
            <div className={endOptions.length > 1 ? 'onb-two' : ''}>
              <div>
                <label className="onb-field-label" htmlFor="onb-firma-start">{t('ui.onb2_firman_startade')}</label>
                <input
                  id="onb-firma-start" type="date" className="onb-select" value={companySetup.firstStart}
                  onChange={(e) => { const start = e.target.value; const ends = firstYearEndOptions(start).filter(d => d.endsWith('-12-31')); setCompanySetup(cur => ({ ...cur, firstStart: start, firstEnd: ends.includes(cur.firstEnd) ? cur.firstEnd : (ends[0] || ''), fySource: 'user' })); }}
                />
              </div>
              {endOptions.length > 1 && (
                <div>
                  <label className="onb-field-label" htmlFor="onb-firma-end">{t('ui.onb2_forsta_slutar')}</label>
                  <select id="onb-firma-end" className="onb-select" value={companySetup.firstEnd} onChange={(e) => setCompanySetup(cur => ({ ...cur, firstEnd: e.target.value, fySource: 'user' }))}>
                    {endOptions.map(d => <option key={d} value={d}>{fmtIso(d)}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="onb-row"><button type="button" className="onb-primary" disabled={!fyValid} onClick={() => go(afterFiscal())}>{t('ui.fortsatt')} <ArrowRight size={18} /></button></div>
          </div>
        )}
      </>
    );
  };

  const renderFiscal = () => {
    if (soleTrader) return renderFirmaFiscal();
    const fromRegistry = companySetup.fySource === 'registry';
    const chooseFirst = () => {
      const start = companySetup.firstStart || todayIso();
      setCompanySetup(cur => ({ ...cur, mode: 'first', firstStart: start, firstEnd: firstYearEndOptions(start).includes(cur.firstEnd) ? cur.firstEnd : defaultFirstYearEnd(start), fySource: 'user' }));
      setFyEdit('first');
    };
    const chooseOther = () => {
      setCompanySetup(cur => ({ ...cur, mode: 'other', startMonth: cur.mode === 'other' ? cur.startMonth : 7, fySource: 'user' }));
      setFyEdit('other');
    };
    const chooseCalendar = () => { setCompanySetup(cur => ({ ...cur, mode: 'calendar', fySource: 'user' })); advanceSoon(afterFiscal()); };
    const confirmRegistry = () => { setCompanySetup(cur => ({ ...cur, fySource: 'user' })); advanceSoon(afterFiscal()); };

    let lead = '';
    if (fromRegistry && companySetup.mode === 'first') lead = t('ui.onb2_fy_forsta_enligt_bv', { date: fmtIso(companySetup.firstStart), end: fmtIso(companySetup.firstEnd) });
    else if (fromRegistry) {
      const [from, to] = yearSpan(companySetup.mode === 'calendar' ? 1 : Number(companySetup.startMonth));
      lead = t('ui.onb2_fy_enligt_bv', { from: monthName(from), to: monthName(to) });
    }
    const endOptions = firstYearEndOptions(companySetup.firstStart).filter(d => !calendarOnly || d.endsWith('-12-31'));
    const partnerCheck = partnership && (
      <label className="onb-sub" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: 0, cursor: 'pointer', textAlign: 'left' }}>
        <input
          type="checkbox" checked={Boolean(companySetup.legalPartnersOnly)} style={{ marginTop: '4px', width: '18px', height: '18px', flexShrink: 0 }}
          onChange={(e) => { const on = e.target.checked; setCompanySetup(cur => ({ ...cur, legalPartnersOnly: on, fySource: 'user', ...(!on && cur.firstEnd && !cur.firstEnd.endsWith('-12-31') ? { firstEnd: defaultFirstYearEnd(cur.firstStart) } : {}) })); }}
        />
        <span><strong>{t('ui.hb_bara_bolag_som_delagare')}</strong><br />{t('ui.hb_kalenderar_annars')}</span>
      </label>
    );

    return (
      <>
        <h1 className="onb-q">{fromRegistry && !fyEdit ? t('ui.onb2_stammer_fy') : t('ui.onb2_vilket_fy')}</h1>
        <p className="onb-sub">{lead}{lead ? ' ' : ''}<Help text={t('ui.onb2_fy_hjalp')} /></p>
        <div className="onb-opts" role="group">
          {fromRegistry && !fyEdit ? (
            <Option onClick={confirmRegistry}>{t('ui.onb2_ja_stammer')}</Option>
          ) : (
            <Option active={companySetup.mode === 'calendar' && !fyEdit} onClick={chooseCalendar}>{t('ui.onb2_kalenderar')}</Option>
          )}
          {!soleTrader && <Option active={fyEdit === 'other'} onClick={chooseOther}>{t('ui.onb2_annat_fy')}</Option>}
          <Option active={fyEdit === 'first'} onClick={chooseFirst}>{t('ui.onb2_forsta_aret')}</Option>
        </div>
        {fyEdit === 'other' && (
          <div className="onb-fields onb-pop">
            <label className="onb-field-label" htmlFor="onb-fy-month">{t('ui.onb2_fy_borjar')}</label>
            <select id="onb-fy-month" className="onb-select" value={companySetup.startMonth} onChange={(e) => setCompanySetup(cur => ({ ...cur, startMonth: Number(e.target.value), fySource: 'user' }))}>
              {Array.from({ length: 11 }, (_, i) => i + 2).map(m => <option key={m} value={m}>1 {monthName(m)}</option>)}
            </select>
            {partnerCheck}
            <div className="onb-row"><button type="button" className="onb-primary" disabled={!fyValid} onClick={() => go(afterFiscal())}>{t('ui.fortsatt')} <ArrowRight size={18} /></button></div>
          </div>
        )}
        {fyEdit === 'first' && (
          <div className="onb-fields onb-pop">
            <div className="onb-two">
              <div>
                <label className="onb-field-label" htmlFor="onb-fy-first-start">{t('ui.onb2_forsta_borjar')}</label>
                <input
                  id="onb-fy-first-start" type="date" className="onb-select" value={companySetup.firstStart}
                  onChange={(e) => { const start = e.target.value; setCompanySetup(cur => ({ ...cur, firstStart: start, firstEnd: firstYearEndOptions(start).includes(cur.firstEnd) ? cur.firstEnd : defaultFirstYearEnd(start), fySource: 'user' })); }}
                />
              </div>
              <div>
                <label className="onb-field-label" htmlFor="onb-fy-first-end">{t('ui.onb2_forsta_slutar')}</label>
                <select id="onb-fy-first-end" className="onb-select" value={companySetup.firstEnd} disabled={!endOptions.length} onChange={(e) => setCompanySetup(cur => ({ ...cur, firstEnd: e.target.value, fySource: 'user' }))}>
                  {endOptions.map(d => <option key={d} value={d}>{fmtIso(d)}</option>)}
                </select>
              </div>
            </div>
            <p className="onb-sub" style={{ margin: 0 }}>{t('ui.forsta_aret_far_vara_kortare_eller_upp_till_18_m')}</p>
            {partnerCheck}
            <div className="onb-row"><button type="button" className="onb-primary" disabled={!fyValid} onClick={() => go(afterFiscal())}>{t('ui.fortsatt')} <ArrowRight size={18} /></button></div>
          </div>
        )}
      </>
    );
  };

  const renderVatReg = () => {
    let lead = '';
    if (vatCheck === 'checking') lead = t('ui.onb2_kollar_vies');
    else if (vatCheck === 'done' && companySetup.vatSource === 'vies') lead = vatRegistered ? t(soleTrader ? 'ui.onb2_vies_ja_du' : 'ui.onb2_vies_ja', { vatNr: companySetup.vatNr }) : t(soleTrader ? 'ui.onb2_vies_nej_du' : 'ui.onb2_vies_nej');
    else if (vatCheck === 'error') lead = t('ui.onb2_vies_fel');
    const answer = (val) => {
      setCompanySetup(cur => ({ ...cur, vatRegistered: val, vatNr: val ? (cur.vatNr || (orgDigits.length === 10 ? `SE${orgDigits}01` : '')) : '', vatSource: 'user' }));
      if (!val) setVatPeriod('');
      advanceSoon(val ? 'vatPeriod' : 'tax');
    };
    return (
      <>
        <h1 className="onb-q">{t(soleTrader ? 'ui.onb2_ar_du_momsreg' : 'ui.onb2_ar_ni_momsreg')}</h1>
        <p className="onb-sub">
          {vatCheck === 'checking' && <Loader2 size={12} className="onb-spin" style={{ marginRight: 6, verticalAlign: '-1px' }} />}
          {lead}{lead ? ' ' : ''}<Help text={t('ui.onb2_moms_hjalp')} />
        </p>
        <div className="onb-opts" role="group">
          <Option active={companySetup.vatRegistered === true} onClick={() => answer(true)}>{t('ui.ja')}</Option>
          <Option active={companySetup.vatRegistered === false} onClick={() => answer(false)}>{t('ui.nej')}</Option>
        </div>
      </>
    );
  };

  const renderVatPeriod = () => (
    <>
      <h1 className="onb-q">{t(soleTrader ? 'ui.onb2_hur_ofta_moms_du' : 'ui.onb2_hur_ofta_moms')}</h1>
      <p className="onb-sub">
        {t(soleTrader ? 'ui.onb2_du_ar_momsreg' : 'ui.onb2_ni_ar_momsreg')}{' '}
        <button type="button" className="onb-inline-link" onClick={() => go('vatReg')}>{t('ui.onb2_andra')}</button>{' '}
        <Help text={t('ui.onb_momsperiod_hjalp')} />
      </p>
      <div className="onb-opts" role="group" aria-label={t('ui.momsperiod')}>
        {VAT_PERIODS.map(([id, label]) => (
          <Option key={id} active={vatPeriod === id} onClick={() => { setVatPeriod(id); advanceSoon('tax'); }}>{label}</Option>
        ))}
      </div>
    </>
  );

  const renderTax = () => (
    <>
      <h1 className="onb-q">{t(soleTrader ? 'ui.onb2_har_du_fskatt' : 'ui.onb2_har_fskatt')}</h1>
      <p className="onb-sub"><Help text={fTax === false ? t('ui.onb_fskatt_nej_hjalp') : t('ui.onb_fskatt_hjalp')} /></p>
      <div className="onb-opts" role="group">
        <Option active={fTax === true} onClick={() => { setFTax(true); advanceSoon(isAdding ? 'done' : 'start'); }}>{t('ui.ja')}</Option>
        <Option active={fTax === false} onClick={() => { setFTax(false); advanceSoon(isAdding ? 'done' : 'start'); }}>{t('ui.nej')}</Option>
      </div>
    </>
  );

  const renderStart = () => (
    <>
      <h1 className="onb-q">{t('ui.onb_start_fraga')}</h1>
      <p className="onb-sub">{t('ui.onb_start_hjalp')}</p>
      <div className="onb-opts onb-opts-col" role="group">
        <Option active={startPath === 'new'} onClick={() => { setStartPath('new'); advanceSoon('done'); }}>
          <span className="onb-opt-title">{t('ui.onb_start_noll')}</span>
          <span className="onb-opt-detail">{t('ui.onb_start_noll_hjalp')}</span>
        </Option>
        <Option active={startPath === 'move'} onClick={() => { setStartPath('move'); advanceSoon('done'); }}>
          <span className="onb-opt-title">{t('ui.onb_start_flytt')}</span>
          <span className="onb-opt-detail">{t('ui.onb_start_flytt_hjalp')}</span>
        </Option>
      </div>
    </>
  );

  const renderDone = () => {
    const rows = [
      [t('ui.onb2_bolagsform'), legalFormLabel],
      [soleTrader ? t('ui.onb2_personnummer') : t('ui.organisationsnummer'), orgNr],
      [soleTrader ? t('ui.onb2_gatuadress') : null, soleTrader ? [address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''],
      [soleTrader ? null : t('ui.onb2_sate'), soleTrader ? '' : city],
      [t('ui.onb2_verksamhet'), industry],
      [t('ui.rakenskapsar'), fyLabel],
      [t('ui.onb_steg_fskatt'), fTaxLabel],
      [t('ui.onb_moms'), companySetup.vatRegistered === false ? t('ui.inte_momsregistrerat') : vatLabel],
      [isAdding ? null : t('ui.onb_steg_start'), startLabel],
    ].filter(([label, value]) => label && value);
    const name = String(firstName || '').trim();
    return (
      <>
        <h1 className="onb-q">{isAdding ? t('ui.onb3_stammer_allt') : name ? t('ui.onb2_valkommen', { name }) : t('ui.onb2_valkommen_utan_namn')}</h1>
        <div className="onb-card">
          <div className="onb-card-kicker">{t('ui.onb2_foretagsprofil')}</div>
          <div className="onb-card-title">{companyName}</div>
          {rows.map(([label, value]) => (
            <div key={label} className="onb-card-row"><span>{label}</span><span>{value}</span></div>
          ))}
        </div>
        {keyDates.length > 0 && (
          <div className="onb-card" style={{ marginTop: '14px' }}>
            <div className="onb-card-kicker">{t('ui.onb_viktiga_datum')}</div>
            {keyDates.map(row => (
              <div key={row.key} className="onb-card-row">
                <span>{row.label}{row.note && <small>{row.note}</small>}</span>
                <span>{fmtDate(row.date)}</span>
              </div>
            ))}
          </div>
        )}
        {isAdding ? (
          <div className="onb-fields" style={{ marginTop: '18px' }}>
            <label className="onb-field-label" htmlFor="onb-add-email">{t('ui.onb3_e_post_foretag')}</label>
            <input id="onb-add-email" className="onb-line" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label className="onb-check">
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
              <span>{t('ui.onb3_intyg')}</span>
            </label>
            <p className="onb-sub" style={{ margin: 0 }}>{t('ui.du_betalar_separat_for_det_har_foretaget_precis')}</p>
            <div className="onb-row">
              <button type="button" className="onb-primary" disabled={!attested || addMode.submitting} onClick={finish}>{addMode.submitting ? t('ui.skapar') : t('ui.skapa_och_fortsatt_till_betalning')} <ArrowRight size={18} /></button>
            </div>
          </div>
        ) : (
          <>
            <p className="onb-sub" style={{ marginTop: '16px' }}>{t('ui.onb_andra_senare')}</p>
            <div className="onb-row">
              <button type="button" className="onb-primary" onClick={finish}>{finishLabel || t('ui.onb_borja_bokfora')} <ArrowRight size={18} /></button>
            </div>
          </>
        )}
      </>
    );
  };

  const body = { company: renderCompany, firma: renderFirma, address: renderAddress, fiscal: renderFiscal, vatReg: renderVatReg, vatPeriod: renderVatPeriod, tax: renderTax, start: renderStart, done: renderDone }[screen]();

  const stepReachable = (i) => i < currentStep || (i === 5 && currentStep === 5);
  const openStep = (i) => {
    if (i === currentStep || !stepReachable(i)) return;
    go(i === 2 && companySetup.vatSource === 'vies' && vatRegistered ? 'vatPeriod' : STEPS[i].screen);
  };

  return (
    <div className={embedded ? 'onb-page onb-embedded' : 'onb-page'}>
      {/* Startsidans molnhimmel, samma som hjälten på bokix.se. */}
      {!embedded && <CloudShaderBackground className="onb-sky" style={{ position: 'fixed', inset: 0, minHeight: 0, zIndex: 0 }} />}

      <div className={embedded ? 'onb-shell-embedded' : 'onb-shell'}>
        {!embedded && <div className="onb-logo"><BokixWordmark height={34} /></div>}
        {!embedded && <nav className="onb-steps" aria-label={t('ui.onb_steg')}>
          <ol>
            {STEPS.map((s, i) => {
              const current = i === currentStep;
              const done = i < currentStep;
              return (
                <li key={s.id} className={current ? 'is-current' : done ? 'is-done' : ''}>
                  <button type="button" onClick={() => openStep(i)} disabled={!done} aria-current={current ? 'step' : undefined}>
                    <span className="onb-bar" aria-hidden><span style={{ transform: `scaleX(${i <= currentStep ? 1 : 0})` }} /></span>
                    <span className="onb-step-label">{s.label}</span>
                    <span className="onb-step-answer">{done ? answers[i] : ' '}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>}

        <main key={screen} className="onb-screen">{body}</main>

        {(history.length > 0 || isAdding || (embedded && onExit)) && (
          <div className="onb-foot">
            {(history.length > 0 || !isAdding) && <button type="button" className="onb-back" onClick={history.length ? back : onExit}><ArrowLeft size={15} /> {t('ui.tillbaka_2')}</button>}
            {isAdding && <button type="button" className="onb-back onb-cancel" onClick={addMode.onCancel}>{t('ui.avbryt')}</button>}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600&display=swap');
        /* Samma ytor som inloggningen (Auth.jsx): ljus grågrön sida, vitt
           kort, djupgrönt i mörkt läge. */
        .onb-page { --onb-serif: 'Newsreader', Georgia, serif; --onb-green: ${BRAND.green}; --onb-green-text: ${BRAND.greenDark}; --onb-green-bg: ${BRAND.greenLight};
          position: relative; min-height: calc(100vh / var(--app-zoom, 1)); background: #f4f7f5; color: var(--text-main); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 16px 56px; box-sizing: border-box; }
        :root[data-theme="dark"] .onb-page { background: #0f1a13; --onb-green: #16803a; --onb-green-text: #8fd67a; --onb-green-bg: rgba(143, 214, 122, 0.12); }
        .onb-page button { font-family: inherit; }
        .onb-page.onb-embedded { min-height: 0; background: transparent !important; padding: 0; display: block; }
        .onb-shell-embedded { width: 100%; }

        .onb-logo { display: flex; margin-bottom: 26px; }
        .onb-alt { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 18px; margin-top: 18px; }
        .onb-alt .onb-link { margin-top: 0; align-self: center; }
        .onb-warn { color: var(--status-red-text, #b91c1c); font-weight: 600; font-size: 13px; }

        .onb-shell { position: relative; z-index: 1; width: 100%; max-width: 640px; box-sizing: border-box; background: var(--bg-card); border: 1px solid #e3e8e4; border-radius: 22px; box-shadow: 0 24px 60px -30px rgba(15, 40, 25, 0.28); padding: 44px 56px 48px; animation: onbRise .5s cubic-bezier(.16,1,.3,1) both; }
        :root[data-theme="dark"] .onb-shell { border-color: #243a2a; box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.7); }
        @keyframes onbRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

        /* Stegraden: samma staplar som registreringen, med svaret under. */
        .onb-steps ol { list-style: none; margin: 0 0 36px; padding: 0; display: flex; gap: 8px; }
        .onb-steps li { flex: 1; min-width: 0; transition: flex .3s ease; }
        .onb-steps button { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; background: none; border: 0; padding: 0; cursor: default; color: inherit; text-align: left; }
        .onb-steps .is-done button { cursor: pointer; }
        .onb-bar { position: relative; width: 100%; height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }
        .onb-bar > span { position: absolute; inset: 0; border-radius: 2px; background: #0b6329; transform-origin: left; transition: transform .35s ease; }
        :root[data-theme="dark"] .onb-bar > span { background: #8fd67a; }
        .onb-step-label { font-size: 13px; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .is-done .onb-step-label { color: var(--onb-green-text); }
        .is-current .onb-step-label { color: var(--onb-green-text); font-weight: 700; }
        .onb-step-answer { font-size: 11.5px; color: var(--text-secondary); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: -3px; }
        .is-done button:hover .onb-step-label { text-decoration: underline; text-underline-offset: 3px; }

        .onb-screen { display: flex; flex-direction: column; align-items: stretch; animation: onbIn .32s ease both; }
        @keyframes onbIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .onb-q { font-family: var(--onb-serif); font-weight: 600; font-size: clamp(26px, 7vw, 34px); letter-spacing: -0.01em; line-height: 1.2; margin: 0 0 8px; color: var(--text-main); }
        .onb-sub { font-size: 14px; line-height: 1.6; color: var(--text-secondary); margin: 0 0 22px; }
        .onb-help { width: 19px; height: 19px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; vertical-align: 1px; }
        .onb-help:hover, .onb-help[aria-expanded="true"] { border-color: var(--onb-green-text); color: var(--onb-green-text); }
        .onb-help-text { display: block; margin-top: 10px; padding: 12px 14px; border-radius: 10px; background: var(--bg-muted); font-size: 13px; line-height: 1.6; color: var(--text-secondary); animation: onbIn .25s ease both; }

        .onb-opts { display: flex; flex-wrap: wrap; gap: 10px; }
        .onb-opt { padding: 15px 22px; border-radius: 13px; border: 1.5px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 15.5px; font-weight: 600; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease; }
        @media (hover: hover) { .onb-opt:hover { border-color: var(--text-muted); background: var(--bg-muted); } }
        .onb-opt:active { transform: scale(.98); }
        .onb-opts-col { flex-direction: column; align-items: stretch; }
        .onb-opts-col .onb-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; padding: 18px 22px; }
        .onb-opt-title { font-size: 16px; font-weight: 700; }
        .onb-opt-detail { font-size: 13.5px; font-weight: 500; color: var(--text-secondary); line-height: 1.45; }
        .onb-opt[aria-pressed="true"] { border-color: var(--onb-green); background: var(--onb-green-bg); color: var(--onb-green-text); }

        .onb-search, .onb-fields { display: flex; flex-direction: column; align-items: stretch; gap: 14px; }
        .onb-search { gap: 0; margin-top: 10px; }
        .onb-line { width: 100%; box-sizing: border-box; padding: 16px 18px; border: 1px solid var(--border); border-radius: 11px; font: inherit; font-size: 17px; color: var(--text-main); background: var(--bg-muted); outline: none; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
        .onb-line::placeholder { color: var(--text-muted); }
        .onb-line:hover { border-color: var(--text-muted); }
        .onb-line:focus { border-color: #0b6329; box-shadow: 0 0 0 3px rgba(11,99,41,0.16); background: var(--bg-card); }
        :root[data-theme="dark"] .onb-line:focus { border-color: #8fd67a; box-shadow: 0 0 0 3px rgba(143, 214, 122, 0.18); }
        .onb-status { min-height: 20px; margin-top: 10px; font-size: 13px; }
        .onb-muted { color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px; }
        .onb-found { color: var(--onb-green-text); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
        .onb-spin { animation: onbSpin 1s linear infinite; }
        @keyframes onbSpin { to { transform: rotate(360deg); } }
        .onb-results { list-style: none; margin: 8px 0 0; padding: 5px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); box-shadow: 0 16px 36px -20px rgba(15, 40, 25, .35); animation: onbIn .2s ease both; }
        .onb-results button { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 11px 13px; border: 0; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; color: inherit; }
        .onb-results button.on { background: var(--bg-muted); }
        .onb-res-name { font-size: 15px; font-weight: 600; color: var(--text-main); }
        .onb-res-meta { font-size: 12.5px; color: var(--text-secondary); }
        .onb-link { align-self: flex-start; margin-top: 16px; background: none; border: 0; padding: 0; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .onb-link:hover { color: var(--text-main); }
        .onb-inline-link { background: none; border: 0; padding: 0; font-size: inherit; font-weight: 600; color: var(--onb-green-text); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .onb-trust { margin: 32px 0 0; font-size: 12.5px; color: var(--text-muted); }

        .onb-pop { margin-top: 22px; animation: onbIn .25s ease both; }
        .onb-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .onb-field-label { display: block; font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 7px; }
        .onb-fields > .onb-field-label { margin-bottom: -7px; }
        .onb-select { width: 100%; box-sizing: border-box; padding: 14px 16px; border: 1px solid var(--border); border-radius: 11px; font: inherit; font-size: 16px; background: var(--bg-muted); color: var(--text-main); }

        .onb-row { display: flex; margin-top: 8px; }
        .onb-primary { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 13px; padding: 18px 22px; background: var(--onb-green); color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(11,99,41,0.25); transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .onb-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(11,99,41,0.32); }
        .onb-primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }

        .onb-card { margin-top: 18px; padding: 18px 20px 6px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-muted); animation: onbIn .4s ease .06s both; }
        .onb-card-kicker { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-secondary); }
        .onb-card-title { font-family: var(--onb-serif); font-weight: 600; font-size: 22px; margin: 4px 0 8px; color: var(--text-main); }
        .onb-card-row { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-top: 1px solid var(--border); font-size: 14px; }
        .onb-card-row > span:first-child { color: var(--text-secondary); display: flex; flex-direction: column; gap: 2px; }
        .onb-card-row > span:last-child { color: var(--text-main); font-weight: 600; text-align: right; white-space: nowrap; }
        .onb-card-row small { font-size: 12px; color: var(--text-muted); font-weight: 400; }

        .onb-foot { display: flex; margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--border); }
        .onb-cancel { margin-left: auto; }
        .onb-check { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.5; color: var(--text-main); cursor: pointer; }
        .onb-check input { width: 18px; height: 18px; margin: 2px 0 0; flex-shrink: 0; accent-color: var(--onb-green); }
        .onb-back { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; border: 1px solid var(--border); border-radius: 11px; background: var(--bg-card); color: var(--text-secondary); font-size: 14.5px; font-weight: 600; cursor: pointer; }
        .onb-back:hover { background: var(--bg-muted); color: var(--text-main); }

        .onb-page button:focus-visible, .onb-page select:focus-visible { outline: 2px solid #0b6329; outline-offset: 2px; }

        @media (max-width: 640px) {
          .onb-page { padding: 16px 12px 32px; justify-content: flex-start; }
          .onb-logo { margin-bottom: 20px; }
          .onb-shell { padding: 28px 20px 32px; border-radius: 18px; }
          .onb-steps ol { margin-bottom: 26px; gap: 5px; }
          .onb-step-answer { display: none; }
          .onb-steps li:not(.is-current) .onb-step-label { visibility: hidden; }
          .onb-steps li.is-current { flex: 2.4; }
          .onb-two { grid-template-columns: 1fr; }
          .onb-opt { flex: 1 1 auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-shell, .onb-screen, .onb-card, .onb-pop, .onb-results, .onb-help-text { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
