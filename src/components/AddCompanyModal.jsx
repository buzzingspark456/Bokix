import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { formatOrgNr } from '../utils/orgType';

// Kundfeedback: "Lägg till företag" återanvände tidigare hela
// <OnboardingFlow> (samma fyrstegs-guide med progressbar/Tillbaka/
// Fortsätt som kontots FÖRSTA registrering) — kändes för tungt för att
// bara lägga till ETT till företag på ett konto som redan finns. Den
// här är istället en vanlig, enkel modal (samma .modal-overlay/
// .modal-content/.form-group-mönster som "Rapportera fel", App.jsx) —
// två fält, org.nummerslagningen (samma hook som Kunder/registreringen)
// autofyller resten. Räkenskapsår/momsperiod/kontoplan väljs INTE här
// längre — samma förnuftiga förval som createEmptyCompanyData redan
// sätter, ändringsbart i Inställningar sen, precis som kontots första
// företag redan tillåter.
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
  const canSubmit = Boolean(companyName.trim()) && orgNrValid && !submitting;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ companyName: companyName.trim(), orgNr, address, email: email.trim() });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Lägg till företag</h2>
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
            <label className="form-label">Organisationsnummer</label>
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
              <span className="form-hint">Ange ett giltigt organisationsnummer (10 siffror).</span>
            )}
            {companyLookup.orgLookup.status === 'loading' && (
              <span className="form-hint">Hämtar företagsuppgifter…</span>
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
                <Check size={12} /> Hämtat från bolagsregistret — ändra gärna om något stämmer bättre.
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Företagsnamn</label>
            <input
              className="form-control"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Bokix AB"
              required
            />
          </div>
          {/* Frivilligt — förvalt till kontots egen e-post (kundönskemål:
              inte bara tyst i bakgrunden), men ett vanligt, redigerbart
              fält precis som adress/bank/telefon senare i Inställningar. */}
          <div className="form-group">
            <label className="form-label">E-post <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(valfritt, kan ändras senare)</span></label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="info@bokix.se"
            />
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 4px' }}>
            Du betalar separat för det här företaget, precis som för ditt första — 30 dagar gratis, sedan 179 kr/mån.
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
              Avbryt
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Skapar...' : 'Skapa och fortsätt till betalning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
