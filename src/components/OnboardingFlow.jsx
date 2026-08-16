import React, { useMemo, useState } from 'react';
import { ArrowRight, Building2, UserRound, Workflow } from 'lucide-react';
import { BRAND } from '../utils/brandColors';

const steps = [
  { title: 'Välkommen', description: 'Skapa din företagsprofil och börja bokföra med Bokix.' },
  { title: 'Företagsuppgifter', description: 'Lägg in organisationsnummer, adress och kontaktinformation.' },
  { title: 'Bokföringsinställningar', description: 'Välj räkenskapsår, momsperiod och BAS 2025.' },
  { title: 'Klart', description: 'Bekräfta din information och gå vidare till dashboarden.' },
];

export default function OnboardingFlow({ onComplete, onSkip, initialCompanyName, initialCompanyData }) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState(initialCompanyName || '');
  const [logoUrl, setLogoUrl] = useState(initialCompanyData?.company?.logoUrl || '');
  const [orgNr, setOrgNr] = useState(initialCompanyData?.company?.orgNr || '');
  const [address, setAddress] = useState(initialCompanyData?.company?.address || '');
  const [email, setEmail] = useState(initialCompanyData?.company?.email || '');
  const [phone, setPhone] = useState(initialCompanyData?.company?.phone || '');
  const [fiscalYear, setFiscalYear] = useState(initialCompanyData?.company?.fiscalYear || `${new Date().getFullYear()}-01-01`);
  const [vatPeriod, setVatPeriod] = useState(initialCompanyData?.company?.vatPeriod || 'quarterly');
  const [chartPlan, setChartPlan] = useState(initialCompanyData?.company?.chartPlan || 'bas2025');

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const handleNext = () => {
    if (step === steps.length - 1) {
      onComplete({ companyName, logoUrl, orgNr, address, email, phone, fiscalYear, vatPeriod, chartPlan });
      return;
    }
    setStep((prev) => prev + 1);
  };

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Företagsnamn</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Bokix AB"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Logotyp (bildlänk)</label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.svg"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Organisationsnummer</label>
              <input
                value={orgNr}
                onChange={(e) => setOrgNr(e.target.value)}
                placeholder="556123-4567"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Adress</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Gatufält 1, 123 45 Stockholm"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>E-post</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@bokix.se"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Telefon</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="070-123 45 67"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Bokföringsår</label>
              <input
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="2026-01-01"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Momsperiod</label>
              <select
                value={vatPeriod}
                onChange={(e) => setVatPeriod(e.target.value)}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', background: 'white' }}
              >
                <option value="monthly">Månadsvis</option>
                <option value="quarterly">Kvartalsvis</option>
                <option value="yearly">Årsvis</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Kontoplan</label>
              <select
                value={chartPlan}
                onChange={(e) => setChartPlan(e.target.value)}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', background: 'white' }}
              >
                <option value="bas2025">BAS 2025</option>
                <option value="bas2015">BAS 2015</option>
              </select>
            </div>
          </div>
        );
      case 3:
        return (
          <div style={{ padding: '20px', borderRadius: '18px', background: 'white', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '18px' }}>Sammanfattning</div>
              <div style={{ display: 'grid', gap: '10px', fontSize: '14px', color: '#334155' }}>
                <div><strong>Företagsnamn:</strong> {companyName || 'Ej angivet'}</div>
                <div><strong>Organisationsnummer:</strong> {orgNr || 'Ej angivet'}</div>
                <div><strong>Adress:</strong> {address || 'Ej angivet'}</div>
                <div><strong>Kontakt:</strong> {email || 'Ej angivet'} · {phone || 'Ej angivet'}</div>
                <div><strong>Bokföringsår:</strong> {fiscalYear}</div>
                <div><strong>Momsperiod:</strong> {vatPeriod}</div>
                <div><strong>Kontoplan:</strong> {chartPlan === 'bas2025' ? 'BAS 2025' : 'BAS 2015'}</div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const currentStepValid = () => {
    if (step === 0) return companyName.trim();
    if (step === 1) return orgNr.trim() && address.trim() && email.trim();
    if (step === 2) return fiscalYear.trim() && vatPeriod && chartPlan;
    return true;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: BRAND.greenLight }}>
      <div style={{ width: '100%', maxWidth: '900px', background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '28px', boxShadow: '0 4px 20px rgba(15,23,42,0.10)', overflow: 'hidden' }}>
        <div style={{ padding: '28px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: BRAND.green, display: 'grid', placeItems: 'center', color: 'white' }}>
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>Bokix onboarding</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Slutför din företagsprofil och börja bokföra direkt.</div>
              </div>
            </div>
            <button onClick={onSkip} style={{ border: 0, background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Hoppa över</button>
          </div>

          <div style={{ height: '8px', borderRadius: '999px', background: '#eef2f7', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: BRAND.green, transition: 'width 0.25s ease' }} />
          </div>
        </div>

        <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: '1fr 0.95fr', gap: '24px' }}>
          <div style={{ padding: '24px', borderRadius: '24px', background: BRAND.greenLight, border: '1px solid rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: '#4a944a', background: 'rgba(91,168,90,0.12)', marginBottom: '16px' }}>
              <Workflow size={14} /> {steps[step].title}
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '8px' }}>{steps[step].title}</h2>
            <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.7, marginBottom: '20px' }}>{steps[step].description}</p>
            {stepContent()}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <button
                onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                style={{ border: 0, background: 'transparent', color: '#64748b', fontWeight: 700, cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.6 : 1 }}
                disabled={step === 0}
              >
                Tillbaka
              </button>
              <button
                onClick={handleNext}
                disabled={!currentStepValid()}
                style={{ border: 0, borderRadius: '999px', padding: '11px 16px', background: BRAND.green, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                {step === steps.length - 1 ? 'Gå till dashboard' : 'Fortsätt'} <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '24px', background: 'white', border: '1px solid rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: '#f1f8f1', color: '#5ba85a', display: 'grid', placeItems: 'center' }}>
                <Building2 size={18} />
              </div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>Vad Bokix hjälper dig med</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { icon: UserRound, title: 'Företagsprofil', detail: 'Ej längre manuell inmatning i flera system.' },
                { icon: Building2, title: 'Full överblick', detail: 'Bokföring, fakturering och moms på samma plats.' },
                { icon: Workflow, title: 'Premiummål', detail: 'Snabb start med rätt inställningar för Bokix.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '14px', background: '#f8fbff', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '10px', background: '#eef6fb', color: '#3a8fc1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{item.title}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
