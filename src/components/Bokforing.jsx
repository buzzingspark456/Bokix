import React, { useState } from 'react';
import Verifications from './Verifications';
import Accounts from './Accounts';

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          position: 'relative',
          padding: '10px 18px', background: 'none', border: 'none',
          borderBottom: active === t.id ? '2px solid #2563eb' : '2px solid transparent',
          fontSize: '13px', fontWeight: active === t.id ? 700 : 500,
          color: active === t.id ? '#111827' : '#6b7280',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: '-1px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          {t.label}
          {t.badge != null && t.badge > 0 && (
            <span style={{
              minWidth: '18px', height: '18px', padding: '0 5px',
              background: '#ef4444', color: 'white', borderRadius: '9px',
              fontSize: '10px', fontWeight: 700, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', lineHeight: 1
            }}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Bokforing({ verifications, accounts, balances, onAdd, setVerifications, setAccounts, globalAction, clearGlobalAction, reviewCount }) {
  const [pageTab, setPageTab] = useState('verifications');

  // If a new_verification global action arrives, switch to verifications tab
  React.useEffect(() => {
    if (globalAction?.type === 'new_verification') {
      setPageTab('verifications');
    }
  }, [globalAction]);

  const tabs = [
    { id: 'verifications', label: 'Verifikationer', badge: null },
    { id: 'accounts',      label: 'Kontoplan',      badge: null },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: '#111827', marginBottom: '4px' }}>
          Bokföring
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '13.5px' }}>Verifikationer, kontoplan och bokföringsposter</p>
      </div>

      <TabBar tabs={tabs} active={pageTab} onChange={setPageTab} />

      {pageTab === 'verifications' && (
        <Verifications
          verifications={verifications}
          accounts={accounts}
          onAdd={onAdd}
          setVerifications={setVerifications}
          globalAction={globalAction}
          clearGlobalAction={clearGlobalAction}
        />
      )}

      {pageTab === 'accounts' && (
        <Accounts
          accounts={accounts}
          balances={balances}
          setAccounts={setAccounts}
        />
      )}
    </div>
  );
}
