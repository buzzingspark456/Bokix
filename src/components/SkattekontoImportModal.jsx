import React, { useMemo, useState } from 'react';
import { UploadCloud, AlertCircle, AlertTriangle, X, CheckCircle2, ExternalLink } from './icons';
import { BRAND } from '../utils/brandColors';
import { AccountSearch } from './shared/SearchInputs';
import { detectOrgType } from '../utils/orgType';
import { lockedPeriodFor } from '../utils/fiscalYear';
import {
  decodeSkattekontoFile, parseSkattekontoFile, buildSkattekontoPreview, buildSkattekontoVerification,
  taxAccountBalance, SKATTEKONTO_ACCOUNT_NAMES,
} from '../utils/skattekontoImport';

// Skattekontoutdrag → verifikationer mot 1630. Samma tre steg och samma
// grundregel som SIE-importen: ingenting skrivs förrän användaren trycker
// Bokför i förhandsgranskningen. Tolkningen och kontoförslagen bor i
// utils/skattekontoImport.js.
const STEPS = ['Ladda upp', 'Förhandsgranskning', 'Resultat'];

const fmt = (n) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n || 0) + ' kr';
const normalizeOrgNr = (s) => String(s || '').replace(/\D/g, '').slice(-10);

const STATUS = {
  ready: { label: 'Klar', bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  check: { label: 'Kontrollera', bg: 'var(--status-amber-bg)', fg: 'var(--status-amber-text)' },
  booked: { label: 'Redan bokförd', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  imported: { label: 'Redan importerad', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  locked: { label: 'Låst år', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
};

export function StepPills({ steps, step }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
      {steps.map((label, i) => (
        <div key={label} style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', fontWeight: 700, padding: '6px 0', borderRadius: '999px', background: i <= step ? BRAND.greenLight : 'var(--bg-muted)', color: i <= step ? BRAND.greenDark : 'var(--text-muted)' }}>
          {i + 1}. {label}
        </div>
      ))}
    </div>
  );
}

export function Notice({ tone = 'amber', children }) {
  const colors = {
    amber: ['var(--status-amber-bg)', 'var(--status-amber-text)', AlertTriangle],
    red: ['var(--status-red-bg)', 'var(--status-red-text)', AlertCircle],
    green: ['var(--status-green-bg)', 'var(--status-green-text)', CheckCircle2],
  }[tone];
  const Icon = colors[2];
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: colors[0], color: colors[1], borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12.5px', lineHeight: 1.55 }}>
      <Icon size={14} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{children}</span>
    </div>
  );
}

const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn = (enabled) => ({ padding: '9px 18px', background: enabled ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit' });

export default function SkattekontoImportModal({ company, accounts = [], verifications = [], onImport, onClose, onOpenBookkeeping }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);

  const orgType = detectOrgType(company?.orgNr);
  const lockedYears = company?.lockedFiscalYears || {};

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const text = decodeSkattekontoFile(await file.arrayBuffer());
      const p = parseSkattekontoFile(text);
      if (p.events.length === 0) throw new Error('Hittade inga kontohändelser i filen. Kontrollera att det är kontoutdraget från Skattekonto (.csv eller .skv).');
      setParsed({ ...p, fileName: file.name });
      setRows(buildSkattekontoPreview(p.events, verifications, { orgType }).map(r => (
        lockedPeriodFor(r.date, lockedYears) && r.include ? { ...r, status: 'locked', include: false } : r
      )));
      setStep(1);
    } catch (e) {
      setError(e.message || 'Kunde inte läsa filen.');
    }
  };

  const update = (key, patch) => setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  const selectable = (r) => r.status === 'ready' || r.status === 'check';
  const chosen = rows.filter(r => r.include && selectable(r));
  const missingAccount = chosen.filter(r => !r.account);
  const orgMismatch = parsed?.orgNr && company?.orgNr && normalizeOrgNr(parsed.orgNr) !== normalizeOrgNr(company.orgNr);
  const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [rows]);

  const accountName = (code) => accounts.find(a => a.code === code)?.name || SKATTEKONTO_ACCOUNT_NAMES[code] || code;
  // Förslagens konton går att välja även om de inte finns i kontoplanen än
  // (t.ex. 2518); de läggs till när man bokför.
  const pickerAccounts = useMemo(() => {
    const have = new Set(accounts.map(a => a.code));
    const extra = Object.entries(SKATTEKONTO_ACCOUNT_NAMES).filter(([code]) => !have.has(code)).map(([code, name]) => ({ code, name, active: true }));
    return [...accounts, ...extra];
  }, [accounts]);

  const handleCommit = () => {
    if (chosen.length === 0 || missingAccount.length > 0) return;
    const newVerifications = chosen.map(r => buildSkattekontoVerification(r, accountName));
    const existing = new Set(accounts.map(a => a.code));
    const needed = new Set(newVerifications.flatMap(v => v.rows.map(r => r.account)));
    const newAccounts = [...needed].filter(code => !existing.has(code)).map(code => ({ code, name: accountName(code) }));
    onImport(newVerifications, newAccounts, 'skattekonto_import');
    const balanceAfter = taxAccountBalance([...verifications, ...newVerifications.map(v => ({ ...v, status: 'booked' }))], parsed.dateTo);
    setResult({ count: newVerifications.length, skipped: rows.length - newVerifications.length, balanceAfter });
    setStep(2);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Importera skattekontoutdrag</span>
          <button className="modal-close" onClick={onClose} aria-label="Stäng"><X size={18} /></button>
        </div>

        <StepPills steps={STEPS} step={step} />
        {error && <Notice tone="red">{error}</Notice>}

        {step === 0 && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
              Ladda ner kontohändelserna från Skatteverkets e-tjänst Skattekonto och ladda upp filen här. Bokix föreslår konto för varje händelse och hoppar över det som redan är bokfört.
            </p>
            <label
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
              style={{ display: 'block', border: `1.5px dashed ${dragging ? BRAND.green : 'var(--gray-300)'}`, background: dragging ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)', borderRadius: '12px', padding: '36px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
            >
              <input type="file" accept=".csv,.skv,.txt,text/csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
              <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <UploadCloud size={20} color={BRAND.greenDark} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Ladda upp skattekontoutdrag</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Dra och släpp filen här, eller klicka för att välja</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>.csv från nya e-tjänsten, eller äldre .skv-filer</div>
            </label>

            <div style={{ marginTop: '16px', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Så hämtar du kontoutdraget</div>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <li>Logga in på skatteverket.se med BankID och gå till Mina sidor.</li>
                <li>Öppna Skattekonto och sedan Kontohändelser.</li>
                <li>Välj period och tryck Ladda ner.</li>
              </ol>
              <a href="https://www7.skatteverket.se/portal/skattekonto" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent-text)' }}>
                Öppna Skattekonto hos Skatteverket <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {step === 1 && parsed && (
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              {[parsed.companyName, parsed.orgNr && `Org.nr ${parsed.orgNr}`, `${parsed.dateFrom || '—'} – ${parsed.dateTo || '—'}`].filter(Boolean).map((part, i) => (
                <React.Fragment key={part}>{i > 0 && ' · '}<span style={{ whiteSpace: 'nowrap' }}>{part}</span></React.Fragment>
              ))}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1px', background: 'var(--border-light)', border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              {[
                ['Ingående saldo', parsed.openingBalance === null ? '—' : fmt(parsed.openingBalance)],
                ['Utgående saldo', parsed.closingBalance === null ? '—' : fmt(parsed.closingBalance)],
                ['Händelser', String(rows.length)],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg-card)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>

            {orgMismatch && <Notice tone="red">Filen gäller org.nr {parsed.orgNr}, men företaget har {company.orgNr}. Kontrollera att du laddat ner rätt företags kontoutdrag.</Notice>}
            {parsed.sumOk === false && <Notice>Ingående saldo plus händelserna stämmer inte med utgående saldo (skillnad {fmt(parsed.sumDifference)}). Filen kan vara ofullständig; ladda gärna ner den på nytt.</Notice>}
            {counts.check > 0 && <Notice>{counts.check === 1 ? '1 händelse' : `${counts.check} händelser`} behöver ett konto. Bokix gissar inte när texten inte säger säkert vad det är.</Notice>}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {Object.entries(STATUS).filter(([k]) => counts[k]).map(([k, s]) => (
                <span key={k} style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: s.bg, color: s.fg }}>{counts[k]} {s.label.toLowerCase()}</span>
              ))}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', maxHeight: '340px', overflowY: 'auto' }}>
              {rows.map((r, i) => {
                const s = STATUS[r.status];
                const canPick = selectable(r);
                return (
                  <div key={r.key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderTop: i ? '1px solid var(--border-light)' : 'none', opacity: canPick && !r.include ? 0.55 : 1 }}>
                    <input
                      type="checkbox" checked={r.include} disabled={!canPick}
                      onChange={e => update(r.key, { include: e.target.checked })}
                      aria-label={`Bokför ${r.description}`}
                      style={{ marginTop: '3px', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', minWidth: 0 }}>{r.description}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: r.amount < 0 ? 'var(--text-main)' : 'var(--status-green-text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.date}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 8px', borderRadius: '999px', background: s.bg, color: s.fg }}>
                          {s.label}{r.status === 'booked' && r.matchedNumber ? ` · ${r.matchedNumber}` : ''}
                        </span>
                        {r.status === 'check' && <span>{r.reason}</span>}
                      </div>
                      {canPick && r.include && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Motkonto</span>
                          <div style={{ minWidth: '220px', flex: '0 1 300px' }}>
                            <AccountSearch value={r.account || ''} onChange={code => update(r.key, { account: code, status: code ? 'ready' : 'check' })} accounts={pickerAccounts} placeholder="Välj konto…" compact />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {parsed.warnings.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {parsed.warnings.map(w => <div key={w}>{w}</div>)}
              </div>
            )}
          </div>
        )}

        {step === 2 && result && (
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={24} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {result.count === 1 ? '1 händelse bokförd' : `${result.count} händelser bokförda`}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px auto 16px', maxWidth: '460px', lineHeight: 1.6 }}>
              {result.skipped > 0 ? `${result.skipped} hoppades över. ` : ''}Verifikationerna ligger i Bokföring med texten "Skattekonto".
            </p>
            {parsed.closingBalance !== null && (
              <div style={{ display: 'inline-block', textAlign: 'left', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>Saldo enligt Skatteverket {parsed.dateTo}: <strong style={{ color: 'var(--text-main)' }}>{fmt(parsed.closingBalance)}</strong></div>
                <div>Konto 1630 i bokföringen samma dag: <strong style={{ color: 'var(--text-main)' }}>{fmt(result.balanceAfter)}</strong></div>
                <div style={{ fontWeight: 700, color: Math.abs(result.balanceAfter - parsed.closingBalance) < 0.005 ? 'var(--status-green-text)' : 'var(--status-amber-text)' }}>
                  {Math.abs(result.balanceAfter - parsed.closingBalance) < 0.005
                    ? 'Skattekontot stämmer.'
                    : `Skiljer ${fmt(result.balanceAfter - parsed.closingBalance)}. Vanligt om bokföringen började efter utdragets start.`}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          {step === 1 && <button style={btn} onClick={() => { setStep(0); setParsed(null); setRows([]); }}>Tillbaka</button>}
          <span style={{ flex: 1 }} />
          {step < 2 && <button style={btn} onClick={onClose}>Avbryt</button>}
          {step === 1 && (
            <button style={primaryBtn(chosen.length > 0 && missingAccount.length === 0)} disabled={chosen.length === 0 || missingAccount.length > 0} onClick={handleCommit}>
              {missingAccount.length > 0 ? `Välj konto för ${missingAccount.length} till` : `Bokför ${chosen.length} ${chosen.length === 1 ? 'händelse' : 'händelser'}`}
            </button>
          )}
          {step === 2 && onOpenBookkeeping && <button style={btn} onClick={() => { onClose(); onOpenBookkeeping(); }}>Visa i Bokföring</button>}
          {step === 2 && <button style={primaryBtn(true)} onClick={onClose}>Klar</button>}
        </div>
      </div>
    </div>
  );
}
