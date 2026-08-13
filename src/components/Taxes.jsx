import React, { useState } from 'react';
import {
  CheckCircle2, Clock, Circle, Lock, Calculator
} from 'lucide-react';
import VatDeclaration from './VatDeclaration';

export default function Taxes({
  company, verifications = [], invoices = [], expenses = [], accounts = [],
  vatPeriods = {}, onBookVatPeriod, onNavigateToVerification,
}) {
  const steps = [
    { id: 1, title: 'Avstämning bankkonto', status: 'Klar' },
    { id: 2, title: 'Bokför årets sista kundfakturor', status: 'Klar' },
    { id: 3, title: 'Bokför årets sista leverantörsfakturor', status: 'Pågår' },
    { id: 4, title: 'Gör årets sista lönekörning', status: 'Ej påbörjad' },
    { id: 5, title: 'Inventering och lager (om tillämpligt)', status: 'Ej påbörjad' },
    { id: 6, title: 'Beräkna och bokför årets resultat', status: 'Ej påbörjad' },
    { id: 7, title: 'Lås räkenskapsåret', status: 'Ej påbörjad' },
  ];

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Klar': return <CheckCircle2 size={18} color="#16a34a" />;
      case 'Pågår': return <Clock size={18} color="#f59e0b" />;
      default: return <Circle size={18} color="#cbd5e1" />;
    }
  };

  const getStatusBg = (status) => {
    switch(status) {
      case 'Klar': return '#dcfce7';
      case 'Pågår': return '#fef3c7';
      default: return '#f8fafc';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Klar': return '#15803d';
      case 'Pågår': return '#b45309';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* ── Header ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '24px 32px', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Skatt och bokslut</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', maxWidth: '600px', lineHeight: '1.5' }}>
          Sammanställning för momsredovisning, checklista för årsbokslut och kommande viktiga datum för skatter och avgifter.
        </p>
      </div>

      {/* ── Content Area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Momsdeklaration */}
          <VatDeclaration
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            accounts={accounts}
            company={company}
            vatPeriods={vatPeriods}
            onBookPeriod={onBookVatPeriod}
            onNavigateToVerification={onNavigateToVerification}
          />

          {/* Årsbokslut */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e4e4e7' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111' }}>Årsbokslut</h2>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>
                Följ stegen nedan för att stänga räkenskapsåret. När alla steg är klara kan du låsa året och generera årsredovisningen.
              </p>
            </div>
            
            <div style={{ padding: '0' }}>
              {steps.map((step, index) => (
                <div key={step.id} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '16px 24px', 
                  borderBottom: index < steps.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: step.status === 'Klar' ? '#fafafa' : 'white'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '28px', height: '28px', borderRadius: '50%', 
                      background: '#f1f5f9', color: '#64748b', fontSize: '13px', fontWeight: 700, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      {step.id}
                    </div>
                    <span style={{ 
                      fontSize: '14px', fontWeight: 500, 
                      color: step.status === 'Klar' ? '#94a3b8' : '#111',
                      textDecoration: step.status === 'Klar' ? 'line-through' : 'none'
                    }}>
                      {step.title}
                    </span>
                  </div>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    background: getStatusBg(step.status), color: getStatusColor(step.status)
                  }}>
                    {getStatusIcon(step.status)}
                    {step.status}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                <Calculator size={16} /> Beräknat resultat: <strong>124 500 kr</strong>
              </div>
              <button disabled style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#94a3b8', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'not-allowed' }}>
                <Lock size={16} /> Lås räkenskapsår och skapa bokslut
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
