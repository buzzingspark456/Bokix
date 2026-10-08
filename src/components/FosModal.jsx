import React, { useMemo, useRef, useState } from 'react';
import { X, Download, Upload, Check } from './icons';
import { Notice } from './SkattekontoImportModal';
import { buildFosQuery, fosMissingFields, parseFosAnswer, fosChanges, latin1Bytes, FOS_MAX_PERSONS } from '../utils/fosRequest';
import { BRAND } from '../utils/brandColors';
import { t } from '../i18n';

// Skattetabell och jämkning direkt från Skatteverket (utils/fosRequest.js),
// så att ingen behöver veta eller gissa vilken tabell en anställd har.
//   1. Ladda ner frågefilen och skicka in den i e-tjänsten Fråga om
//      skatteavdrag (BankID).
//   2. Svaret kommer inom två till tre dagar. Läs in svarsfilen här, så
//      uppdateras de anställda.

const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' };
const primaryBtn = (on) => ({ ...btn, background: on ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed' });
const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit', boxSizing: 'border-box' };
const stepBox = { border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' };
const CONTACT_KEY = 'bokix_fos_contact';

function loadContact(company) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}'); } catch { /* privat läge */ }
  return {
    name: saved.name || '',
    address: saved.address || company.address || '',
    postalCode: saved.postalCode || company.postalCode || '',
    city: saved.city || company.city || '',
    phone: saved.phone || company.phone || '',
    email: saved.email || company.email || '',
  };
}

export default function FosModal({ company = {}, employees = [], onApply, onClose }) {
  const fileRef = useRef(null);
  const now = new Date();
  const years = [now.getFullYear(), ...(now.getMonth() >= 10 ? [now.getFullYear() + 1] : [])];
  // I december frågar man oftast om nästa år.
  const [year, setYear] = useState(now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear());
  const [contact, setContact] = useState(() => loadContact(company));
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(null);

  const active = employees.filter(e => !e.endDate || e.endDate >= `${year}-01-01`);
  const missing = fosMissingFields({ company, contact });
  const changes = useMemo(() => (answer ? fosChanges(employees, answer) : []), [answer, employees]);
  const toApply = changes.filter(c => c.patch);
  const changed = toApply.filter(c => c.changes.length > 0);
  const problems = changes.filter(c => c.problem);

  const set = (k, v) => setContact(c => ({ ...c, [k]: v }));

  const handleDownload = () => {
    if (missing.length) return;
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: contact.name, phone: contact.phone, email: contact.email })); } catch { /* ok */ }
    const xml = buildFosQuery({ company, contact, year, employees: active });
    const blob = new Blob([latin1Bytes(xml)], { type: 'application/xml;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fraga-skatteavdrag-${year}.xml`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(''); setApplied(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseFosAnswer(String(ev.target.result || ''));
        if (parsed.answers.length === 0) throw new Error(t('fos.noAnswers'));
        setAnswer(parsed);
      } catch (err) {
        setAnswer(null);
        setError(err.message);
      }
    };
    // Svarsfilen är ISO-8859-1, precis som frågefilen.
    reader.readAsText(f, 'iso-8859-1');
  };

  const handleApply = () => {
    onApply(toApply.map(c => ({ id: c.employeeId, patch: c.patch })));
    setApplied(toApply.length);
  };

  const field = (k, label, props = {}) => (
    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label}
      <input value={contact[k]} onChange={e => set(k, e.target.value)} style={{ ...inp, borderColor: missing.includes(k) ? '#ef4444' : 'var(--border)' }} {...props} />
    </label>
  );
  const changeText = (c) => t(`fos.change.${c.key}`, c.vars);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('fos.title')}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('fos.intro')}</p>

        <div style={stepBox}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{t('fos.step1')}</div>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t('fos.step1Text')}</p>
          {(missing.includes('orgNr') || missing.includes('companyName')) && <Notice tone="red">{t('fos.missingCompany')}</Notice>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
            {field('name', t('fos.contactName'))}
            {field('phone', t('fos.phone'))}
            {field('email', t('fos.email'), { type: 'email' })}
            {field('address', t('fos.address'))}
            {field('postalCode', t('fos.postalCode'), { inputMode: 'numeric' })}
            {field('city', t('fos.city'))}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: 'auto' }}>
              {years.map(y => <option key={y} value={y}>{t('fos.year', { year: y })}</option>)}
            </select>
            <button type="button" disabled={missing.length > 0 || active.length === 0} style={primaryBtn(missing.length === 0 && active.length > 0)} onClick={handleDownload}>
              <Download size={14} /> {t('fos.download', { n: Math.min(active.length, FOS_MAX_PERSONS) })}
            </button>
          </div>
        </div>

        <div style={stepBox}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{t('fos.step2')}</div>
          <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t('fos.step2Text')}</p>
          <button type="button" style={btn} onClick={() => fileRef.current?.click()}><Upload size={14} /> {t('fos.chooseAnswer')}</button>
          <input type="file" ref={fileRef} accept=".xml,text/xml,application/xml" style={{ display: 'none' }} onChange={handleFile} />
          {error && <div style={{ marginTop: '10px' }}><Notice tone="red">{error}</Notice></div>}

          {answer && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                {changes.map((c, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}: </span>
                    {c.problem && c.problem !== '9'
                      ? <span style={{ color: 'var(--status-red-text)' }}>{t(`fos.problem.${c.problem.startsWith('ag') ? 'ag' : c.problem}`)}</span>
                      : <span style={{ color: 'var(--text-secondary)' }}>{c.changes.length ? c.changes.map(changeText).join(', ') : t('fos.unchanged')}{c.problem === '9' ? ` ${t('fos.problem.9')}` : ''}</span>}
                  </div>
                ))}
              </div>
              {applied != null ? (
                <div style={{ marginTop: '10px' }}><Notice tone="green">{t('fos.applied', { n: applied })}</Notice></div>
              ) : (
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{t('fos.summary', { changed: changed.length, total: toApply.length, problems: problems.filter(p => p.problem !== '9').length })}</span>
                  <button type="button" disabled={toApply.length === 0} style={primaryBtn(toApply.length > 0)} onClick={handleApply}>
                    <Check size={14} /> {t('fos.apply', { n: toApply.length })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
