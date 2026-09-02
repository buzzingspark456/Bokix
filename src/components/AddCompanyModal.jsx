import React, { useState } from 'react';
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
export default function AddCompanyModal({ isOpen, onClose, onSubmit, submitting }) {
  const [companyName, setCompanyName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [address, setAddress] = useState('');

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
    companyLookup.clearNameResults();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyName.trim() || submitting) return;
    onSubmit({ companyName: companyName.trim(), orgNr, address });
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
            />
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
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 4px' }}>
            Du betalar separat för det här företaget, precis som för ditt första — 30 dagar gratis, sedan 179 kr/mån.
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
              Avbryt
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !companyName.trim()}>
              {submitting ? 'Skapar...' : 'Skapa och fortsätt till betalning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
