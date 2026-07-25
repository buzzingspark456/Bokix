import React, { useState } from 'react';
import { BarChart3, PieChart, Download, FileText, FileDown, X } from 'lucide-react';

export default function Reports({ balances, accounts }) {
  const [reportType, setReportType] = useState('resultat'); 
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val);

  const assetAccounts = accounts.filter(a => a.type === 'tillgang');
  const equityLiabilityAccounts = accounts.filter(a => a.type === 'skuld_kapital');
  const incomeAccounts = accounts.filter(a => a.type === 'intakt');
  const expenseAccounts = accounts.filter(a => a.type === 'kostnad');

  const totalRevenues = incomeAccounts.reduce((sum, a) => sum + (-(balances[a.code] || 0)), 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  const netProfit = totalRevenues - totalExpenses;

  const totalAssets = assetAccounts.reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  const totalLiabilitiesEquity = equityLiabilityAccounts.reduce((sum, a) => sum + (-(balances[a.code] || 0)), 0);
  const totalBalancedEquityLiabilities = totalLiabilitiesEquity + netProfit;

  const buttonStyle = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
    background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', 
    fontWeight: 600, cursor: 'pointer', color: '#374151', transition: 'all 0.15s'
  };

  const rowStyle0 = { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontWeight: 700, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderRadius: '8px' };
  const rowStyle1 = { display: 'flex', justifyContent: 'space-between', padding: '16px', fontWeight: 700, fontSize: '14px', color: '#111827', borderTop: '2px solid #e2e8f0', marginTop: '8px' };
  const rowStyle2 = { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: '13.5px', color: '#334155', borderBottom: '1px solid #f1f5f9' };
  const rowStyleTotal = { display: 'flex', justifyContent: 'space-between', padding: '20px 16px', fontWeight: 800, fontSize: '16px', color: '#111827', borderTop: '3px solid #111827', marginTop: '16px', background: '#f8fafc', borderRadius: '0 0 12px 12px' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '5px' }}>
            Rapporter
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13.5px', fontWeight: 400 }}>
            Resultat- och balansräkning, momsrapport
          </p>
        </div>
        <button onClick={() => setShowPdfPreview(true)} style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
        >
          <Download size={14} /> Exportera PDF
        </button>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'resultat', label: 'Resultaträkning', icon: BarChart3 },
          { id: 'balans', label: 'Balansräkning', icon: PieChart },
          { id: 'moms', label: 'Momsrapport', icon: FileText }
        ].map(f => (
          <button key={f.id} onClick={() => setReportType(f.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: reportType === f.id ? 600 : 500, cursor: 'pointer',
            background: reportType === f.id ? '#111827' : 'white',
            color: reportType === f.id ? 'white' : '#6b7280',
            border: `1px solid ${reportType === f.id ? '#111827' : '#e5e7eb'}`,
            transition: 'all 0.15s', fontFamily: 'inherit'
          }}>
            <f.icon size={14} /> {f.label}
          </button>
        ))}
      </div>

      {/* ── REPORT CONTENT ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '40px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        
        {reportType === 'resultat' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 8px 0' }}>Resultaträkning</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Ackumulerat för räkenskapsåret 2026</p>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Rörelsens intäkter</div>
              {incomeAccounts.map(acc => {
                const val = -(balances[acc.code] || 0);
                if (val === 0) return null;
                return (
                  <div key={acc.code} style={rowStyle2}>
                    <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>{acc.code}</strong> {acc.name}</span>
                    <span>{formatSEK(val)}</span>
                  </div>
                );
              })}
              <div style={rowStyle1}>
                <span>Summa rörelseintäkter</span>
                <span style={{ color: '#16a34a' }}>{formatSEK(totalRevenues)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Rörelsens kostnader</div>
              {expenseAccounts.map(acc => {
                const val = balances[acc.code] || 0;
                if (val === 0) return null;
                return (
                  <div key={acc.code} style={rowStyle2}>
                    <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>{acc.code}</strong> {acc.name}</span>
                    <span>-{formatSEK(val)}</span>
                  </div>
                );
              })}
              <div style={rowStyle1}>
                <span>Summa rörelsekostnader</span>
                <span style={{ color: '#dc2626' }}>-{formatSEK(totalExpenses)}</span>
              </div>
            </div>

            <div style={{ ...rowStyleTotal, background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
              <span>Beräknat resultat</span>
              <span style={{ color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatSEK(netProfit)}</span>
            </div>
          </div>
        )}

        {reportType === 'balans' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 8px 0' }}>Balansräkning</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Aktuella saldon för tillgångar och skulder</p>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Tillgångar</div>
              {assetAccounts.map(acc => {
                const val = balances[acc.code] || 0;
                if (val === 0) return null;
                return (
                  <div key={acc.code} style={rowStyle2}>
                    <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>{acc.code}</strong> {acc.name}</span>
                    <span>{formatSEK(val)}</span>
                  </div>
                );
              })}
              <div style={rowStyle1}>
                <span>Summa tillgångar</span>
                <span style={{ color: '#16a34a' }}>{formatSEK(totalAssets)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Eget kapital och skulder</div>
              {equityLiabilityAccounts.map(acc => {
                const val = -(balances[acc.code] || 0);
                if (val === 0) return null;
                return (
                  <div key={acc.code} style={rowStyle2}>
                    <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>{acc.code}</strong> {acc.name}</span>
                    <span>{formatSEK(val)}</span>
                  </div>
                );
              })}
              <div style={{ ...rowStyle2, fontStyle: 'italic', color: '#2563eb', fontWeight: 500 }}>
                <span>Beräknat resultat för perioden</span>
                <span>{formatSEK(netProfit)}</span>
              </div>
              <div style={rowStyle1}>
                <span>Summa eget kapital & skulder</span>
                <span>{formatSEK(totalBalancedEquityLiabilities)}</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '12px', textAlign: 'center', fontWeight: 600, fontSize: '14px', background: Math.abs(totalAssets - totalBalancedEquityLiabilities) < 0.01 ? '#f0fdf4' : '#fef2f2', color: Math.abs(totalAssets - totalBalancedEquityLiabilities) < 0.01 ? '#16a34a' : '#dc2626', border: `1px solid ${Math.abs(totalAssets - totalBalancedEquityLiabilities) < 0.01 ? '#bbf7d0' : '#fecaca'}` }}>
              {Math.abs(totalAssets - totalBalancedEquityLiabilities) < 0.01 
                ? '✔ Balansräkningen balanserar! (Tillgångar = Skulder + Eget Kapital)' 
                : `⚠ Varning: Balansräkningen balanserar inte. Differens: ${formatSEK(Math.abs(totalAssets - totalBalancedEquityLiabilities))}`}
            </div>
          </div>
        )}

        {reportType === 'moms' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 8px 0' }}>Momsredovisning</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Beräknad utgående och ingående moms</p>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Utgående moms (Försäljning)</div>
              <div style={rowStyle2}>
                <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>2611</strong> Utgående moms försäljning 25%</span>
                <span>{formatSEK(-(balances['2611'] || 0))}</span>
              </div>
              <div style={rowStyle2}>
                <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>2621</strong> Utgående moms försäljning 12%</span>
                <span>{formatSEK(-(balances['2621'] || 0))}</span>
              </div>
              <div style={rowStyle2}>
                <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>2631</strong> Utgående moms försäljning 6%</span>
                <span>{formatSEK(-(balances['2631'] || 0))}</span>
              </div>
              <div style={rowStyle1}>
                <span>Summa utgående moms (Ruta 10)</span>
                <span style={{ color: '#dc2626' }}>{formatSEK((-(balances['2611'] || 0)) + (-(balances['2621'] || 0)) + (-(balances['2631'] || 0)))}</span>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={rowStyle0}>Ingående moms (Inköp)</div>
              <div style={rowStyle2}>
                <span><strong style={{ color: '#2563eb', marginRight: '8px' }}>2641</strong> Debiterad ingående moms</span>
                <span>{formatSEK(balances['2641'] || 0)}</span>
              </div>
              <div style={rowStyle1}>
                <span>Summa ingående moms (Ruta 48)</span>
                <span style={{ color: '#16a34a' }}>{formatSEK(balances['2641'] || 0)}</span>
              </div>
            </div>

            {(() => {
              const utg = (-(balances['2611'] || 0)) + (-(balances['2621'] || 0)) + (-(balances['2631'] || 0));
              const ing = (balances['2641'] || 0);
              const attBetala = utg - ing;

              return (
                <div style={{ ...rowStyleTotal, background: '#f8fafc', borderColor: '#111827' }}>
                  <span>Moms att {attBetala >= 0 ? 'betala in' : 'få tillbaka'} (Ruta 49)</span>
                  <span style={{ color: attBetala >= 0 ? '#dc2626' : '#16a34a' }}>{formatSEK(Math.abs(attBetala))}</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── PDF PREVIEW MODAL ── */}
      {showPdfPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setShowPdfPreview(false)}>
          <div style={{ background: '#f3f4f6', borderRadius: '16px', width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#eef6fb', color: '#3a8fc1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                    {reportType === 'resultat' ? 'Resultaträkning' : reportType === 'balans' ? 'Balansräkning' : 'Momsrapport'}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Förhandsgranskning (A4)</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => alert('Laddar ner PDF...')} style={{ ...buttonStyle, background: '#5ba85a', color: 'white' }} onMouseEnter={e => e.currentTarget.style.background = '#4a8d49'} onMouseLeave={e => e.currentTarget.style.background = '#5ba85a'}>
                  <FileDown size={14} /> Ladda ner PDF
                </button>
                <button onClick={() => setShowPdfPreview(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <div style={{ 
                width: '210mm', minHeight: '297mm', background: 'white', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', 
                padding: '20mm', boxSizing: 'border-box', position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>NORDSTRÖM KONSULT AB</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {reportType === 'resultat' ? 'Resultaträkning' : reportType === 'balans' ? 'Balansräkning' : 'Momsrapport'}
                    </div>
                    <div style={{ fontSize: '12px' }}>Org. nr: 556123-4567</div>
                  </div>
                </div>

                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  {reportType === 'resultat' && (
                    <>
                      <h4 style={{ borderBottom: '1px solid #ccc', margin: '20px 0 10px 0' }}>Intäkter</h4>
                      {incomeAccounts.map(acc => {
                        const val = -(balances[acc.code] || 0);
                        return val !== 0 && <div key={acc.code} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{acc.code} {acc.name}</span><span>{formatSEK(val)}</span></div>
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', margin: '10px 0 20px 0' }}><span>Summa Intäkter</span><span>{formatSEK(totalRevenues)}</span></div>

                      <h4 style={{ borderBottom: '1px solid #ccc', margin: '20px 0 10px 0' }}>Kostnader</h4>
                      {expenseAccounts.map(acc => {
                        const val = balances[acc.code] || 0;
                        return val !== 0 && <div key={acc.code} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{acc.code} {acc.name}</span><span>-{formatSEK(val)}</span></div>
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', margin: '10px 0 20px 0' }}><span>Summa Kostnader</span><span>-{formatSEK(totalExpenses)}</span></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '2px solid #000', paddingTop: '10px' }}><span>Resultat</span><span>{formatSEK(netProfit)}</span></div>
                    </>
                  )}

                  {reportType === 'balans' && (
                    <>
                      <h4 style={{ borderBottom: '1px solid #ccc', margin: '20px 0 10px 0' }}>Tillgångar</h4>
                      {assetAccounts.map(acc => {
                        const val = balances[acc.code] || 0;
                        return val !== 0 && <div key={acc.code} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{acc.code} {acc.name}</span><span>{formatSEK(val)}</span></div>
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', margin: '10px 0 20px 0' }}><span>Summa Tillgångar</span><span>{formatSEK(totalAssets)}</span></div>

                      <h4 style={{ borderBottom: '1px solid #ccc', margin: '20px 0 10px 0' }}>Skulder & Eget kapital</h4>
                      {equityLiabilityAccounts.map(acc => {
                        const val = -(balances[acc.code] || 0);
                        return val !== 0 && <div key={acc.code} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{acc.code} {acc.name}</span><span>{formatSEK(val)}</span></div>
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'normal', fontStyle: 'italic', margin: '5px 0' }}><span>Beräknat resultat</span><span>{formatSEK(netProfit)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '2px solid #000', paddingTop: '10px', marginTop: '10px' }}><span>Summa Skulder & Eget kapital</span><span>{formatSEK(totalBalancedEquityLiabilities)}</span></div>
                    </>
                  )}

                  {reportType === 'moms' && (
                    <div style={{ textAlign: 'center', marginTop: '50px', fontStyle: 'italic', color: '#6b7280' }}>
                      (Momssammanställning genereras baserat på period)
                    </div>
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
