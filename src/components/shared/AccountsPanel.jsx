import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Lock, X } from '../icons';
import { accountMatches } from '../../utils/accountSearch';
import ListTable from './ListTable';

// Kontoplanen — bruten ut ur Bokforing (Verifications.jsx), där den låg som
// en egen flik ("Kontoplan"). Flyttad hit så EXAKT samma vy (sök, "Mina
// konton"/"Alla konton", gruppering per BAS-klass, aktivera/inaktivera,
// lägg till konto) kan återanvändas rakt av i Inställningar > System >
// Kontoplan, utan att bygga om funktionen en andra gång. Verifications.jsx
// använder den här komponenten oförändrat — ingen beteendeskillnad där.
export const BAS_GROUPS = [
  { range: [1000, 1999], label: '1000–1999 Tillgångar', code: '1' },
  { range: [2000, 2999], label: '2000–2999 Eget kapital och skulder', code: '2' },
  { range: [3000, 3999], label: '3000–3999 Intäkter', code: '3' },
  { range: [4000, 4999], label: '4000–4999 Kostnader, varuinköp', code: '4' },
  { range: [5000, 5999], label: '5000–5999 Övriga externa kostnader', code: '5' },
  { range: [6000, 6999], label: '6000–6999 Övriga externa kostnader', code: '6' },
  { range: [7000, 7999], label: '7000–7999 Personalkostnader', code: '7' },
  { range: [8000, 8999], label: '8000–8999 Finansiella poster och skatt', code: '8' },
];

export function getGroup(code) {
  const n = parseInt(code, 10);
  return BAS_GROUPS.find(g => n >= g.range[0] && n <= g.range[1]);
}

// Egen liten ToggleSwitch-kopia hade dubblerat Settings.jsx — importerar
// istället från samma ställe Verifications.jsx redan gör (se dess egen
// kommentar om varför: en delad, redan finslipad switch).
function ToggleSwitchInline({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: 'absolute', inset: 0, opacity: 0, margin: 0, cursor: 'pointer' }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: checked ? 'var(--accent)' : 'var(--border)', transition: 'background 0.15s' }} />
      <span style={{ position: 'absolute', top: '2px', left: checked ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </label>
  );
}

export default function AccountsPanel({ accounts = [], balances = {}, verifications = [], setAccounts, fmt }) {
  const format = fmt || (n => (n || 0).toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountView, setAccountView] = useState('mine');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');

  useEffect(() => {
    if (accountSearch) setExpandedGroups(Object.fromEntries(BAS_GROUPS.map(g => [g.code, true])));
  }, [accountSearch]);

  const getGroupAccounts = (groupCode) => {
    return accounts.filter(a => {
      const n = parseInt(a.code, 10);
      const g = BAS_GROUPS.find(g => g.code === groupCode);
      return g && n >= g.range[0] && n <= g.range[1];
    }).filter(a => accountMatches(a, accountSearch))
      .filter(a => accountView === 'all' || a.active || a.system);
  };

  const getGroupBalance = (groupCode) => {
    const g = BAS_GROUPS.find(g => g.code === groupCode);
    if (!g) return 0;
    return accounts
      .filter(a => { const n = parseInt(a.code, 10); return n >= g.range[0] && n <= g.range[1]; })
      .reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  };

  const handleAddAccount = () => {
    if (!newAccCode || !newAccName) return;
    if (accounts.find(a => a.code === newAccCode)) { alert(`Konto ${newAccCode} finns redan.`); return; }
    setAccounts(prev => [...prev, { code: newAccCode, name: newAccName }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    setNewAccCode(''); setNewAccName(''); setShowNewAccountForm(false);
  };

  const handleDeactivateAccount = (code) => {
    const used = verifications.filter(v => v.rows?.some(r => r.account === code)).length;
    if (used > 0) { alert(`Kontot används i ${used} verifikationer och kan inte tas bort. Det kan inaktiveras.`); return; }
    setAccounts(prev => prev.filter(a => a.code !== code));
  };

  const handleToggleAccountActive = (code) => {
    setAccounts(prev => prev.map(a => a.code === code ? { ...a, active: !a.active } : a));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Sök kontonummer eller namn..." style={{ padding: '5px 8px 5px 26px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', width: '220px', outline: 'none' }} />
        </div>
        <div className="rc-segmented">
          <button type="button" onClick={() => setAccountView('mine')} className={accountView === 'mine' ? 'active' : ''}>Mina konton</button>
          <button type="button" onClick={() => setAccountView('all')} className={accountView === 'all' ? 'active' : ''}>Alla konton</button>
        </div>
        <button
          type="button"
          onClick={() => setShowNewAccountForm(v => !v)}
          style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: '999px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          Nytt konto
        </button>
      </div>

      {showNewAccountForm && (
        <div style={{ background: 'var(--lime-50)', border: '1px solid var(--border)', borderTop: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-text)' }}>Nytt konto</span>
          <input value={newAccCode} onChange={e => setNewAccCode(e.target.value)} placeholder="Kontonummer" style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '110px' }} />
          <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Kontonamn" style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '240px' }} />
          <button type="button" onClick={handleAddAccount} style={{ padding: '5px 14px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Spara</button>
          <button type="button" onClick={() => setShowNewAccountForm(false)} style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--text-muted)', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Avbryt</button>
          {newAccCode && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kontoklass: {getGroup(newAccCode)?.label || '—'}</span>}
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', maxHeight: '520px', overflowY: 'auto' }}>
        {BAS_GROUPS.map(g => {
          const groupAccs = getGroupAccounts(g.code);
          const groupBal = getGroupBalance(g.code);
          const isOpen = expandedGroups[g.code];
          const hasMatch = !accountSearch || groupAccs.length > 0;
          if (!hasMatch) return null;

          return (
            <div key={g.code} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setExpandedGroups(prev => ({ ...prev, [g.code]: !prev[g.code] }))}
                style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-page)', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--border)' }}
              >
                {isOpen ? <ChevronDown size={15} style={{ marginRight: 8, color: 'var(--text-secondary)' }} /> : <ChevronRight size={15} style={{ marginRight: 8, color: 'var(--text-secondary)' }} />}
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>{g.label}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 12 }}>{groupAccs.length} konton</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: groupBal >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)', minWidth: 100, textAlign: 'right' }}>
                  {format(groupBal)}
                </span>
              </div>

              {isOpen && (
                <ListTable
                  rowKey={a => a.code}
                  emptyMessage="Inga matchande konton"
                  rows={groupAccs}
                  columns={[
                    { key: 'code', label: 'Konto', fontWeight: 700, color: 'var(--text-main)', render: a => a.code },
                    { key: 'name', label: 'Kontonamn', color: 'var(--text-main)', render: a => a.name },
                    {
                      key: 'balance', label: 'Saldo', align: 'right', render: a => {
                        const bal = balances[a.code] || 0;
                        return <span style={{ fontWeight: bal !== 0 ? 700 : 400, color: bal > 0 ? 'var(--status-green-text)' : bal < 0 ? 'var(--status-red-text)' : 'var(--text-muted)' }}>{bal !== 0 ? format(bal) : '—'}</span>;
                      },
                    },
                    {
                      key: 'active', label: 'Aktiv', align: 'center', render: a => (
                        a.system ? (
                          <span title="Kärnkonto — bokföringen bokför automatiskt mot det här kontot, det går inte att stänga av" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            <Lock size={11} /> Alltid på
                          </span>
                        ) : (
                          <ToggleSwitchInline checked={Boolean(a.active)} onChange={() => handleToggleAccountActive(a.code)} />
                        )
                      ),
                    },
                    {
                      key: 'actions', label: '', align: 'center', render: a => {
                        const usedInVers = verifications.filter(v => v.rows?.some(r => r.account === a.code)).length;
                        return (
                          <button
                            type="button"
                            onClick={() => handleDeactivateAccount(a.code)}
                            title={usedInVers > 0 ? `Används i ${usedInVers} verifikationer — kan inte tas bort` : 'Ta bort konto'}
                            style={{ background: 'none', border: 'none', cursor: usedInVers > 0 ? 'not-allowed' : 'pointer', color: usedInVers > 0 ? 'var(--border)' : '#ef4444', padding: '2px' }}
                          >
                            <X size={13} />
                          </button>
                        );
                      },
                    },
                  ]}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
