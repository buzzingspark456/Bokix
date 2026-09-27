import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from './icons';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { formatOrgNr } from '../utils/orgType';
import CompanyLookupResults from './shared/CompanyLookupResults';
import FiscalYearVatFields, { EMPTY_COMPANY_SETUP, companySetupComplete, companySetupToCompany } from './shared/FiscalYearVatFields';
import { t } from '../i18n';

// Kundfeedback: "Lägg till företag" återanvände tidigare hela
// <OnboardingFlow> (samma fyrstegs-guide med progressbar/Tillbaka/
// Fortsätt som kontots FÖRSTA registrering) — kändes för tungt för att
// bara lägga till ETT till företag på ett konto som redan finns. Den
// här är istället en vanlig, enkel modal (samma .modal-overlay/
// .modal-content/.form-group-mönster som "Rapportera fel", App.jsx) —
// två fält, org.nummerslagningen (samma hook som Kunder/registreringen)
// autofyller resten. Räkenskapsår och momsregistrering frågas här (samma
// frågor som vid registreringen, se FiscalYearVatFields.jsx); momsperiod
// och kontoplan får createEmptyCompanyData:s förval, ändringsbara sen.
export default function AddCompanyModal({ isOpen, onClose, onSubmit, submitting, defaultEmail = '' }) {
  const [companyName, setCompanyName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [address, setAddress] = useState('');
  // Kundönskemål: det nya företaget ska inte bara TYST få kontots e-post
  // i bakgrunden (se App.jsx: createEmptyCompanyData) — man ska se den och
  // kunna ändra den redan här, precis som org.nummer/namnet. Förvalt till
  // kontots egen e-post (samma som annars hade hamnat där ändå), men ett
  // eget, synligt och redigerbart fält, inte gömt.
  const [email, setEmail] = useState(defaultEmail);
  useEffect(() => { if (isOpen) setEmail(defaultEmail); }, [isOpen, defaultEmail]);
  const [setup, setSetup] = useState(EMPTY_COMPANY_SETUP);
  const nameFieldRef = useRef(null);

  const companyLookup = useCompanyLookup((key, value) => {
    if (key === 'name') setCompanyName(value);
    else if (key === 'orgNr') setOrgNr(formatOrgNr(value));
    else if (key === 'address') setAddress(value);
  });

  if (!isOpen) return null;

  const handleClose = () => {
    if (submitting) return;
    setCompanyName('');
    setOrgNr('');
    setAddress('');
    setEmail(defaultEmail);
    setSetup(EMPTY_COMPANY_SETUP);
    companyLookup.clearNameResults();
    onClose();
  };

  // Kundönskemål: "organisationsnumret måste vara där, samma med
  // företagsnamnet" — samma 10-siffror-krav som registreringens steg 2
  // (Auth.jsx handleNextStep, regStep===2) redan ställer på det ALLRA
  // första företaget. Den här modalen körde tidigare ENDAST
  // companyName.trim() som spärr — orgNr gick att lämna helt tomt för ett
  // TILLAGT företag, en lucka det ursprungliga registreringsflödet aldrig
  // hade.
  const orgNrValid = orgNr.replace(/\D/g, '').length >= 10;
  const canSubmit = Boolean(companyName.trim()) && orgNrValid && companySetupComplete(setup) && !submitting;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ companyName: companyName.trim(), orgNr, address, email: email.trim(), setup: companySetupToCompany(setup, orgNr) });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('ui.lagg_till_foretag')}</h2>
          <button className="modal-close" onClick={handleClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Org.numret FÖRST (kundfeedback) — det är det man faktiskt vet
              utantill och skriver in direkt, uppslaget fyller sedan i
              företagsnamnet nedanför automatiskt istället för att fråga
              efter namnet man ändå inte visste hur bolagsregistret stavat. */}
          <div className="form-group">
            <label className="form-label">{t('ui.organisationsnummer')}</label>
            <input
              className="form-control"
              value={orgNr}
              onChange={e => {
                const formatted = formatOrgNr(e.target.value);
                setOrgNr(formatted);
                companyLookup.handleOrgNrChange(formatted);
              }}
              placeholder="556123-4567"
              autoFocus
              required
            />
            {orgNr && !orgNrValid && companyLookup.orgLookup.status !== 'loading' && (
              <span className="form-hint">{t('ui.ange_ett_giltigt_organisationsnummer_10_siffror')}</span>
            )}
            {companyLookup.orgLookup.status === 'loading' && (
              <span className="form-hint">{t('ui.hamtar_foretagsuppgifter')}</span>
            )}
            {companyLookup.orgLookup.status === 'error' && (
              <span className="form-hint">{companyLookup.orgLookup.message}</span>
            )}
            {companyLookup.orgLookup.status === 'firma' && (
              <span className="form-hint" style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                <Check size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {companyLookup.orgLookup.message}
              </span>
            )}
            {companyLookup.orgLookup.status === 'done' && (
              <span className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Check size={12} /> {t('ui.hamtat_fran_bolagsregistret_andra_garna_om_nagot')}
              </span>
            )}
          </div>
          <div className="form-group" ref={nameFieldRef}>
            <label className="form-label">{t('ui.foretagsnamn')}</label>
            <input
              className="form-control"
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); if (!orgNr.replace(/\D/g, '')) companyLookup.queueNameSearch(e.target.value); }}
              placeholder={t('ui.bokix_ab')}
              required
            />
            {companyLookup.nameSearch.status === 'loading' && <span className="form-hint">{t('ui.soker_i_foretagsregistret')}</span>}
            <CompanyLookupResults results={companyLookup.nameResults} onPick={companyLookup.applyCompany} anchorRef={nameFieldRef} />
          </div>
          <div className="form-group">
            <FiscalYearVatFields value={setup} onChange={setSetup} orgNr={orgNr} registry={companyLookup.lastCompany} />
          </div>
          {/* Frivilligt — förvalt till kontots egen e-post (kundönskemål:
              inte bara tyst i bakgrunden), men ett vanligt, redigerbart
              fält precis som adress/bank/telefon senare i Inställningar. */}
          <div className="form-group">
            <label className="form-label">{t('ui.e_post')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('ui.valfritt_kan_andras_senare')}</span></label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('ui.info_bokix_se')}
            />
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 4px' }}>
            {t('ui.du_betalar_separat_for_det_har_foretaget_precis')}
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
              {t('ui.avbryt')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? t('ui.skapar') : t('ui.skapa_och_fortsatt_till_betalning')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
