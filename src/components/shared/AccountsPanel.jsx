import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Lock, X } from '../icons';
import { accountMatches } from '../../utils/accountSearch';
import { t } from '../../i18n';
import { BAS_ACCOUNT_GROUPS } from '../AccountsData';

const byCode = (a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true });

// Kontoplanen — bruten ut ur Bokforing (Verifications.jsx), där den låg som
// en egen flik ("Kontoplan"). Flyttad hit så EXAKT samma vy (sök, "Mina
// konton"/"Alla konton", gruppering per BAS-klass, aktivera/inaktivera,
// lägg till konto) kan återanvändas rakt av i Inställningar > System >
// Kontoplan, utan att bygga om funktionen en andra gång. Verifications.jsx
// använder den här komponenten oförändrat — ingen beteendeskillnad där.
export const BAS_GROUPS = [
  { range: [1000, 1999], label: t('ui.n1000_1999_tillgangar'), code: '1' },
  { range: [2000, 2999], label: t('ui.n2000_2999_eget_kapital_och_skulder'), code: '2' },
  { range: [3000, 3999], label: t('ui.n3000_3999_intakter'), code: '3' },
  { range: [4000, 4999], label: t('ui.n4000_4999_kostnader_varuinkop'), code: '4' },
  { range: [5000, 5999], label: t('ui.n5000_5999_ovriga_externa_kostnader'), code: '5' },
  { range: [6000, 6999], label: t('ui.n6000_6999_ovriga_externa_kostnader'), code: '6' },
  { range: [7000, 7999], label: '7000–7999 Personalkostnader', code: '7' },
  { range: [8000, 8999], label: t('ui.n8000_8999_finansiella_poster_och_skatt'), code: '8' },
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
      .filter(a => accountView === 'all' || a.active || a.system)
      .sort(byCode);
  };

  const getGroupBalance = (groupCode) => {
    const g = BAS_GROUPS.find(g => g.code === groupCode);
    if (!g) return 0;
    return accounts
      .filter(a => { const n = parseInt(a.code, 10); return n >= g.range[0] && n <= g.range[1]; })
      .reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  };

  const usedCount = useMemo(() => {
    const m = {};
    for (const v of verifications) {
      const seen = new Set();
      for (const r of v.rows || []) if (r.account && !seen.has(r.account)) { seen.add(r.account); m[r.account] = (m[r.account] || 0) + 1; }
    }
    return m;
  }, [verifications]);

  const handleAddAccount = () => {
    if (!newAccCode || !newAccName) return;
    if (accounts.find(a => a.code === newAccCode)) { alert(t('ui.konto_finns_redan', { newAccCode })); return; }
    setAccounts(prev => [...prev, { code: newAccCode, name: newAccName }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    setNewAccCode(''); setNewAccName(''); setShowNewAccountForm(false);
  };

  const handleDeactivateAccount = (code) => {
    const used = usedCount[code] || 0;
    if (used > 0) { alert(t('ui.kontot_anvands_i_verifikationer_och_kan_inte_tas', { used })); return; }
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
          <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder={t('ui.sok_kontonummer_eller_namn')} style={{ padding: '5px 8px 5px 26px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', width: '220px', outline: 'none' }} />
        </div>
        <div className="rc-segmented">
          <button type="button" onClick={() => setAccountView('mine')} className={accountView === 'mine' ? 'active' : ''}>{t('ui.mina_konton')}</button>
          <button type="button" onClick={() => setAccountView('all')} className={accountView === 'all' ? 'active' : ''}>{t('ui.alla_konton')}</button>
        </div>
        <button
          type="button"
          onClick={() => setShowNewAccountForm(v => !v)}
          style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: '999px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          {t('ui.nytt_konto')}
        </button>
      </div>

      {showNewAccountForm && (
        <div style={{ background: 'var(--lime-50)', border: '1px solid var(--border)', borderTop: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-text)' }}>{t('ui.nytt_konto')}</span>
          <input value={newAccCode} onChange={e => setNewAccCode(e.target.value)} placeholder={t('ui.kontonummer')} style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '110px' }} />
          <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder={t('ui.kontonamn')} style={{ padding: '5px 8px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '240px' }} />
          <button type="button" onClick={handleAddAccount} style={{ padding: '5px 14px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>{t('ui.spara')}</button>
          <button type="button" onClick={() => setShowNewAccountForm(false)} style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--text-muted)', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>{t('ui.avbryt')}</button>
          {newAccCode && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('ui.kontoklass')} {getGroup(newAccCode)?.label || '—'}</span>}
        </div>
      )}

      {/* Ingen egen scroll-låda: hela sidan scrollar och klassrubriken
          står kvar överst (sticky). Raderna är ett eget rutnät som alltid
          får plats i bredden, se .acc-* i index.css. */}
      <div className="acc-list">
        {BAS_GROUPS.map(g => {
          const groupAccs = getGroupAccounts(g.code);
          const groupBal = getGroupBalance(g.code);
          const isOpen = expandedGroups[g.code];
          if (accountSearch && groupAccs.length === 0) return null;
          // Underrubriker per BAS-kontogrupp (de två första siffrorna).
          const sections = [];
          for (const a of groupAccs) {
            const key = String(a.code).slice(0, 2);
            if (!sections.length || sections[sections.length - 1].key !== key) sections.push({ key, accounts: [] });
            sections[sections.length - 1].accounts.push(a);
          }
          return (
            <section key={g.code} className="acc-class">
              <button type="button" className="acc-class-head" aria-expanded={Boolean(isOpen)} onClick={() => setExpandedGroups(prev => ({ ...prev, [g.code]: !prev[g.code] }))}>
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span className="acc-class-name">{g.label}</span>
                <span className="acc-class-count">{groupAccs.length} {t('ui.konton_2')}</span>
                <span className={`acc-class-bal${groupBal < 0 ? ' neg' : ''}`}>{format(groupBal)}</span>
              </button>
              {isOpen && (
                groupAccs.length === 0 ? (
                  <div className="acc-empty">{t('ui.inga_matchande_konton')}</div>
                ) : (
                  <div className="acc-rows" role="table" aria-label={g.label}>
                    <div className="acc-row acc-row-head" role="row">
                      <span role="columnheader">{t('ui.konto_2')}</span>
                      <span role="columnheader">{t('ui.kontonamn')}</span>
                      <span role="columnheader" className="acc-bal">{t('ui.saldo')}</span>
                      <span role="columnheader" className="acc-active">{t('ui.aktiv')}</span>
                      <span role="columnheader" aria-label={t('ui.ta_bort_konto')} />
                    </div>
                    {sections.map(sec => (
                      <React.Fragment key={sec.key}>
                        <div className="acc-sub" role="row">
                          <span className="acc-sub-code">{sec.key}</span>
                          <span className="acc-sub-name">{BAS_ACCOUNT_GROUPS[sec.key] || ''}</span>
                          <span className="acc-sub-count">{sec.accounts.length}</span>
                        </div>
                        {sec.accounts.map(a => {
                          const bal = balances[a.code] || 0;
                          const used = usedCount[a.code] || 0;
                          const balText = bal !== 0 ? format(bal) : '—';
                          return (
                            <div key={a.code} className="acc-row" role="row">
                              <span className="acc-code" role="cell">{a.code}</span>
                              <span className="acc-name" role="cell">
                                {a.name}
                                {bal !== 0 && <span className={`acc-bal-inline${bal > 0 ? ' pos' : ' neg'}`}>{balText}</span>}
                              </span>
                              <span className={`acc-bal${bal > 0 ? ' pos' : bal < 0 ? ' neg' : ''}`} role="cell">{balText}</span>
                              <span className="acc-active" role="cell">
                                {a.system ? (
                                  <span className="acc-locked" title={t('ui.karnkonto_bokforingen_bokfor_automatiskt_mot_det')}>
                                    <Lock size={11} /> <span className="acc-locked-text">{t('ui.alltid_pa')}</span>
                                  </span>
                                ) : (
                                  <ToggleSwitchInline checked={Boolean(a.active)} onChange={() => handleToggleAccountActive(a.code)} />
                                )}
                              </span>
                              <span role="cell" className="acc-del-cell">
                                <button
                                  type="button"
                                  className="acc-del"
                                  onClick={() => handleDeactivateAccount(a.code)}
                                  disabled={used > 0}
                                  title={used > 0 ? t('ui.anvands_i_verifikationer_kan_inte_tas_bort', { usedInVers: used }) : t('ui.ta_bort_konto')}
                                  aria-label={t('ui.ta_bort_konto')}
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
