import React, { useState } from 'react';
import { FileCheck, Landmark, CalendarCheck, ExternalLink, Clock, PieChart, FileText, CheckCircle, AlertCircle, Calendar, ArrowDownRight, ArrowUpRight, CheckCircle2, FileDown, X } from 'lucide-react';
import Moms from './Moms';

const TABS = [
  { id: 'moms', label: 'Moms', icon: FileCheck },
  { id: 'deklarationer', label: 'Deklarationer (PDF)', icon: FileText },
  { id: 'deadlines', label: 'Deadlines', icon: Clock },
  { id: 'periodiseringar', label: 'Periodiseringar', icon: PieChart },
  { id: 'bokslut', label: 'Bokslut', icon: CalendarCheck },
  { id: 'inkomstdeklaration', label: 'Inkomstdeklaration', icon: FileText },
];

const deadlines = [
  { date: '2026-08-12', label: 'Momsdeklaration (kvartal 2)', type: 'moms', status: 'upcoming' },
  { date: '2026-08-12', label: 'Arbetsgivardeklaration Juli', type: 'arbetsgivar', status: 'upcoming' },
  { date: '2026-09-15', label: 'Preliminär skatt September', type: 'skatt', status: 'future' },
  { date: '2026-11-12', label: 'Momsdeklaration (kvartal 3)', type: 'moms', status: 'future' },
  { date: '2027-07-01', label: 'Inkomstdeklaration (INK2)', type: 'deklaration', status: 'future' },
  { date: '2027-07-31', label: 'Årsredovisning till Bolagsverket', type: 'arsredovisning', status: 'future' },
];

const periodiseringar = [
  { description: 'Förutbetald hyra (Jul–Sep)', account: '1710', amount: 24000, type: 'Förutbetald kostnad', remaining: 2 },
  { description: 'Upplupna konsultintäkter Juni', account: '1790', amount: 18500, type: 'Upplupen intäkt', remaining: 0 },
  { description: 'Förutbetalt abonnemang SaaS', account: '1710', amount: 3600, type: 'Förutbetald kostnad', remaining: 5 },
];

const typeColors = {
  moms: { bg: '#eff6ff', color: '#2563eb', label: 'Moms', border: '#bfdbfe' },
  arbetsgivar: { bg: '#faf5ff', color: '#7c3aed', label: 'Arbetsgivar', border: '#e9d5ff' },
  skatt: { bg: '#fff7ed', color: '#ea580c', label: 'Skatt', border: '#ffedd5' },
  deklaration: { bg: '#f0fdf4', color: '#16a34a', label: 'Deklaration', border: '#bbf7d0' },
  arsredovisning: { bg: '#fef2f2', color: '#dc2626', label: 'Bolagsverket', border: '#fecaca' },
};

export default function Taxes({ verifications, balances }) {
  const [activeTab, setActiveTab] = useState('moms');
  const [previewPdf, setPreviewPdf] = useState(null); // 'moms' | 'arbetsgivar'

  const fmt = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

  const now = new Date();
  const daysUntil = (dateStr) => {
    const d = new Date(dateStr);
    return Math.round((d - now) / (1000 * 60 * 60 * 24));
  };

  let raOmsattning = 0;
  let raKostnader = 0;
  const year = new Date().getFullYear().toString();
  verifications?.forEach(v => {
    if (!v.date.startsWith(year)) return;
    v.rows.forEach(r => {
      if (r.account.startsWith('3')) raOmsattning += (r.kredit - r.debet);
      else if (['4','5','6','7'].some(p => r.account.startsWith(p))) raKostnader += (r.debet - r.kredit);
    });
  });
  const raResultat = raOmsattning - raKostnader;
  const skattebelopp = Math.max(0, Math.round(raResultat * 0.2006));

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: '#5ba85a', border: 'none', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: 'white', transition: 'all 0.15s'
  };

  const secondaryButtonStyle = {
    ...buttonStyle, background: 'white', border: '1px solid #e5e7eb', color: '#374151'
  };

  const handleDownloadPDF = () => {
    // In a real app, use jsPDF or html2canvas
    alert('Laddar ner PDF...');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Skatt & Bokslut
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Hantera momsdeklarationer, skattedeklarationer, deadlines och förberedelser inför bokslut.
          </p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap', background: '#f3f4f6', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 500,
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            <tab.icon size={14} style={{ color: activeTab === tab.id ? '#5ba85a' : '#9ca3af' }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      {activeTab === 'moms' && (
        <Moms balances={balances} verifications={verifications} />
      )}

      {activeTab === 'deklarationer' && (
        <div>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Skattedeklarationer via PDF</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px', maxWidth: '600px' }}>
              Skapa deklarationer som PDF-dokument. Dessa kan du sedan granska och ladda ner för att manuellt ladda upp på Skatteverkets portal.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#eef6fb', color: '#3a8fc1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <FileText size={24} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Momsdeklaration</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Exportera momsrapporten för vald period som en PDF redo för inlämning.</p>
                <button onClick={() => setPreviewPdf('moms')} style={buttonStyle}>
                  Skapa Moms-PDF
                </button>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#f1f8f1', color: '#5ba85a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <FileText size={24} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Arbetsgivardeklaration (AGI)</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Exportera löner och arbetsgivaravgifter för inlämning till Skatteverket.</p>
                <button onClick={() => setPreviewPdf('arbetsgivar')} style={buttonStyle}>
                  Skapa AGI-PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'deadlines' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fafb' }}>
            <Calendar size={18} style={{ color: '#5ba85a' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>Kommande skattedeadlines</h3>
          </div>
          <div>
            {deadlines.map((d, i) => {
              const days = daysUntil(d.date);
              const tc = typeColors[d.type] || typeColors.skatt;
              const isUrgent = days <= 14;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px', borderBottom: i < deadlines.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: isUrgent ? '#dc2626' : '#111827' }}>
                      {d.date}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontWeight: 500 }}>
                      {days > 0 ? `om ${days} dagar` : `${Math.abs(days)} dagar sedan`}
                    </div>
                  </div>
                  <div style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: '#374151' }}>{d.label}</div>
                  <div>
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                      {tc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'periodiseringar' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fafb' }}>
            <PieChart size={18} style={{ color: '#5ba85a' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111827' }}>Aktiva Periodiseringar</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: 'white' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: '#6b7280' }}>Beskrivning</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: '#6b7280' }}>Konto</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Totalt Belopp</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: '#6b7280', textAlign: 'center' }}>Månader Kvar</th>
              </tr>
            </thead>
            <tbody>
              {periodiseringar.map((p, i) => (
                <tr key={i} style={{ borderBottom: i < periodiseringar.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 600, color: '#111827' }}>
                    {p.description}
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400, marginTop: '2px' }}>{p.type}</div>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#2563eb', fontWeight: 600 }}>{p.account}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700 }}>{fmt(p.amount)}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    {p.remaining > 0 ? (
                      <span style={{ background: '#f3f4f6', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>{p.remaining} mån</span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Avslutad
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bokslut' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Räknat resultat innan skatt</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Baserat på årets hittills bokförda verifikationer (klass 3 och 4-8).</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Omsättning (Klass 3)</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{fmt(raOmsattning)}</div>
            </div>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Kostnader (Klass 4-8)</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{fmt(raKostnader)}</div>
            </div>
            <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Beräknat Resultat</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8' }}>{fmt(raResultat)}</div>
            </div>
          </div>

          <div style={{ padding: '20px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'white', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <Landmark size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: '4px' }}>Uppskattad Bolagsskatt (20.6%)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', letterSpacing: '-0.02em', marginBottom: '8px' }}>{fmt(skattebelopp)}</div>
              <p style={{ fontSize: '13px', color: '#9a3412', margin: 0, opacity: 0.8 }}>
                Detta är en preliminär beräkning. Avsätt detta belopp inför bokslutet för att undvika likviditetsproblem.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inkomstdeklaration' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '40px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '16px', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FileText size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Inkomstdeklaration (INK2)</h2>
          <p style={{ color: '#6b7280', fontSize: '15px', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.5 }}>
            Din inkomstdeklaration för aktiebolag skapas automatiskt i samband med årsbokslutet. För närvarande finns inga aktiva deklarationer att fylla i.
          </p>
          <button style={{ ...secondaryButtonStyle, margin: '0 auto' }}>Läs mer om INK2</button>
        </div>
      )}

      {/* ── PDF PREVIEW MODAL ── */}
      {previewPdf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setPreviewPdf(null)}>
          <div style={{ background: '#f3f4f6', borderRadius: '16px', width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#eef6fb', color: '#3a8fc1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                    {previewPdf === 'moms' ? 'Momsdeklaration' : 'Arbetsgivardeklaration'}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Förhandsgranskning (A4)</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleDownloadPDF} style={buttonStyle}>
                  <FileDown size={14} /> Ladda ner PDF
                </button>
                <button onClick={() => setPreviewPdf(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* A4 Paper Container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ 
                width: '210mm', minHeight: '297mm', background: 'white', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', 
                padding: '20mm', boxSizing: 'border-box', position: 'relative'
              }}>
                {/* Simulated Skatteverket Form Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>SKATTEVERKET</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {previewPdf === 'moms' ? 'MOMSDEKLARATION' : 'ARBETSGIVARDEKLARATION'}
                    </div>
                    <div style={{ fontSize: '12px' }}>Organisationsnummer: 556123-4567</div>
                  </div>
                </div>

                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  <p><strong>Period:</strong> Juli 2026</p>
                  
                  {previewPdf === 'moms' && (
                    <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr><td style={{ padding: '8px 0' }}>Momspliktig försäljning 25%</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>124 500 SEK</td></tr>
                        <tr><td style={{ padding: '8px 0' }}>Utgående moms 25%</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>31 125 SEK</td></tr>
                        <tr style={{ borderBottom: '1px solid #ccc' }}><td style={{ padding: '8px 0' }}>Ingående moms</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>14 200 SEK</td></tr>
                        <tr><td style={{ padding: '16px 0', fontWeight: 'bold' }}>Moms att betala</td><td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>16 925 SEK</td></tr>
                      </tbody>
                    </table>
                  )}

                  {previewPdf === 'arbetsgivar' && (
                    <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr><td style={{ padding: '8px 0' }}>Avdragen preliminär skatt</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>25 500 SEK</td></tr>
                        <tr style={{ borderBottom: '1px solid #ccc' }}><td style={{ padding: '8px 0' }}>Arbetsgivaravgifter (31.42%)</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>26 690 SEK</td></tr>
                        <tr><td style={{ padding: '16px 0', fontWeight: 'bold' }}>Summa att betala</td><td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>52 190 SEK</td></tr>
                      </tbody>
                    </table>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
