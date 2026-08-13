import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, ChevronRight, ChevronDown, Check, X,
  AlertCircle, Paperclip, RotateCcw, FileText, RefreshCw,
  UploadCloud, Tag, LayoutTemplate, Save, Trash2
} from 'lucide-react';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { PartySearch, ProjectSearch, AccountSearch } from './shared/SearchInputs';
import { findLockedVatPeriod } from '../utils/vatCalculation';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// ─── BAS Account reference ────────────────────────────────────────────────────
const BAS_GROUPS = [
  { range: [1000, 1999], label: '1000–1999 Tillgångar', code: '1' },
  { range: [2000, 2999], label: '2000–2999 Eget kapital och skulder', code: '2' },
  { range: [3000, 3999], label: '3000–3999 Intäkter', code: '3' },
  { range: [4000, 4999], label: '4000–4999 Kostnader, varuinköp', code: '4' },
  { range: [5000, 5999], label: '5000–5999 Övriga externa kostnader', code: '5' },
  { range: [6000, 6999], label: '6000–6999 Övriga externa kostnader', code: '6' },
  { range: [7000, 7999], label: '7000–7999 Personalkostnader', code: '7' },
  { range: [8000, 8999], label: '8000–8999 Finansiella poster och skatt', code: '8' },
];

function getGroup(code) {
  const n = parseInt(code, 10);
  return BAS_GROUPS.find(g => n >= g.range[0] && n <= g.range[1]);
}

// ─── De fyra kontoklasserna (verksamt.se) ──────────────────────────────────────
// Tillgångar (1) och Kostnader (4–8) ökar normalt i debet.
// Skulder inkl. eget kapital (2) och Intäkter (3) ökar normalt i kredit.
// Rättelser går giltigt åt andra hållet — därför är detta en varning, aldrig en spärr.
function getAccountClass(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return null;
  if (n >= 1000 && n <= 1999) return { key: 'tillgang', label: 'tillgång', normalSide: 'debet' };
  if (n >= 2000 && n <= 2999) return { key: 'skuld_ek', label: 'skuld/eget kapital', normalSide: 'kredit' };
  if (n >= 3000 && n <= 3999) return { key: 'intakt', label: 'intäkt', normalSide: 'kredit' };
  if (n >= 4000 && n <= 8999) return { key: 'kostnad', label: 'kostnad', normalSide: 'debet' };
  return null;
}

// Reskontrakonton — kundfordringar (151x–159x) och leverantörsskulder (24xx) —
// kräver enligt bokföringslagen att motparten framgår.
function isReskontraAccount(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return false;
  return (n >= 1510 && n <= 1599) || (n >= 2400 && n <= 2449);
}

function rowSideWarning(row) {
  if (!row.account) return null;
  const cls = getAccountClass(row.account);
  if (!cls) return null;
  const debit = parseFloat(row.debet) || 0;
  const credit = parseFloat(row.kredit) || 0;
  if (debit <= 0 && credit <= 0) return null;
  const bookedSide = debit > 0 ? 'debet' : 'kredit';
  if (bookedSide === cls.normalSide) return null;
  return `Ovanligt: en ${cls.label} ökar normalt i ${cls.normalSide}. Det här är okej vid en rättelse — annars, dubbelkolla kontot.`;
}

// PartySearch/ProjectSearch/AccountSearch delas nu från ./shared/SearchInputs
// så samma combobox återanvänds i Kontakter (standardkonto för leverantörer).

// ─── Verification Form (inline full-screen) ───────────────────────────────────
const MAX_ATTACHMENT_MB = 10;
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function VerificationForm({ accounts, contacts, projects = [], balances, templates, onSaveTemplate, onSave, onClose, nextNumber, getNextNumber, initial, vatPeriods }) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState(initial?.description || '');
  const [projectId, setProjectId] = useState(initial?.projectId || '');
  const [counterpartyId, setCounterpartyId] = useState(initial?.counterpartyId || '');
  const [originalLocation, setOriginalLocation] = useState(initial?.originalLocation || '');
  const [series, setSeries] = useState(initial?.series || 'A');
  const [costCenter, setCostCenter] = useState(initial?.costCenter || '');
  const [internalNote, setInternalNote] = useState(initial?.internalNote || '');
  const [showReview, setShowReview] = useState(false);
  const [rows, setRows] = useState(
    initial?.rows
      // Läs tolerant — äldre verifikationer kan ha sparats med debit/credit
      // (den gamla, felaktiga fältnamngivningen) innan denna bugg fixades.
      ? initial.rows.map(r => ({
          ...r, accountName: r.accountName || '',
          debet: getDebet(r) ? String(getDebet(r)) : '',
          kredit: getKredit(r) ? String(getKredit(r)) : '',
          desc: r.desc || '',
        }))
      : [
          { account: '', accountName: '', debet: '', kredit: '', desc: '' }
        ]
  );

  const [attachment, setAttachment] = useState(null);
  const [attachmentUrl, setAttachmentUrl] = useState(null);
  const [showAttachmentLightbox, setShowAttachmentLightbox] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRowOverride = (i) => setExpandedRows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const fileInputRef = useRef(null);

  // Ett underlag ska faktiskt kunna ses, inte bara visas som ett filnamn —
  // skapa en object-URL för förhandsvisning och städa upp den när den byts ut.
  useEffect(() => {
    if (!attachment) { setAttachmentUrl(null); return; }
    const url = URL.createObjectURL(attachment);
    setAttachmentUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);
  const attachmentIsImage = attachment?.type?.startsWith('image/');

  // "PDF eller bild (max 10 MB)" är inte bara text i gränssnittet — den
  // regeln kontrolleras faktiskt här, med ett tydligt felmeddelande.
  const acceptFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      setFileError(`"${file.name}" är inte en PDF eller bild och kunde inte läggas till.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setFileError(`"${file.name}" är för stor (max ${MAX_ATTACHMENT_MB} MB).`);
      return;
    }
    setFileError('');
    setAttachment(file);
  };

  // Mild varning — inte en spärr — om ett reskontrakonto (kundfordringar/
  // leverantörsskulder) används utan att motparten är ifylld.
  const usesReskontraAccount = rows.some(r => isReskontraAccount(r.account));
  const missingCounterparty = usesReskontraAccount && !counterpartyId;

  const updateRow = (i, field, val) => {
    setRows(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (field === 'debet' && val) next[i].kredit = '';
      if (field === 'kredit' && val) next[i].debet = '';
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, { account: '', accountName: '', debet: '', kredit: '', desc: '' }]);

  const handleBlurAmount = (i) => {
    const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debet) || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.kredit) || 0), 0);
    const diff = totalDebit - totalCredit;

    if (Math.abs(diff) >= 0.01) {
       setRows(prev => {
         const next = [...prev];
         const emptyRowIndex = next.findIndex(r => !r.account && !r.debet && !r.kredit);
         if (emptyRowIndex !== -1 && emptyRowIndex === next.length - 1) {
            if (diff > 0) {
              next[emptyRowIndex].kredit = diff.toFixed(2);
            } else {
              next[emptyRowIndex].debet = Math.abs(diff).toFixed(2);
            }
         }
         return next;
       });
    }
  };

  const removeRow = (i) => {
    if (rows.length > 1) {
      setRows(r => r.filter((_, idx) => idx !== i));
    }
  };

  const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debet) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.kredit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;

  // Ett bokfört utkast måste balansera precis som en färdig verifikation —
  // men ett utkast som fortfarande är under arbete får sparas obalanserat,
  // annars går det inte att spara och fortsätta senare.
  const handleSave = (status = 'booked') => {
    if (status === 'booked' && !isBalanced) return;
    // Ett bokfört utkast kräver riktiga konteringsrader; ett utkast under
    // arbete får spara vilka påbörjade rader som helst, bara inte tomma.
    const validRows = status === 'draft'
      ? rows.filter(r => r.account || r.debet || r.kredit || r.desc)
      : rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0));
    if (status === 'booked' && validRows.length < 2) return;
    if (status === 'draft' && validRows.length === 0 && !desc.trim()) return;
    onSave({
      date, description: desc, projectId, counterpartyId, rows: validRows, amount: totalDebit,
      series, costCenter, internalNote, status,
      originalLocation: attachment ? '' : originalLocation,
      // Upprättandedatum är alltid en systemgenererad tidsstämpel — användaren
      // kan aldrig sätta eller ändra den, annars går spårbarheten att manipulera.
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
  };

  const inp = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' };

  // Förhandsvisning av nästa nummer, i den serie som faktiskt är vald —
  // det riktiga numret sätts vid sparande så att det alltid är aktuellt.
  const previewNumber = initial?.number || (getNextNumber ? getNextNumber(series) : nextNumber);

  const fieldLabel = { display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', marginBottom: '5px' };

  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eceef1', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>
          {initial ? `Verifikation ${initial.number}` : 'Ny verifikation'}
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
      </div>

      {/* Datum / Beskrivning / Serie */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
        </div>
        <div style={{ flex: 3 }}>
          <label style={fieldLabel}>Beskrivning</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Verifikationstext..." style={inp} autoFocus />
        </div>
        <div style={{ width: '90px' }}>
          <label style={fieldLabel}>Serie</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={{ ...inp, background: 'white', textAlign: 'center' }}>
            {['A', 'B', 'C'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {(() => {
        const lockedPeriod = findLockedVatPeriod(date, vatPeriods);
        if (!lockedPeriod) return null;
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Denna period är redan momsredovisad. Ändringar här påverkar inte den redan inlämnade deklarationen och kräver en separat rättelse hos Skatteverket.</span>
          </div>
        );
      })()}

      {/* Räkenskapsår + nästa nummer + valuta, som en informationsrad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12.5px', color: '#6b7280', marginBottom: '18px', flexWrap: 'wrap' }}>
        <span>Räkenskapsår: <strong style={{ color: '#374151' }}>Räkenskapsår {(date || '').slice(0, 4) || new Date().getFullYear()}</strong> <strong style={{ color: '#374151' }}>{previewNumber}</strong></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Valuta
          <select disabled title="Bokix stödjer i dagsläget bara SEK — ingen valutaomräkning görs på andra valutor" style={{ padding: '3px 8px', border: '1px solid #e4e4e7', borderRadius: '999px', fontSize: '12px', color: '#374151', background: '#f8fafc', fontFamily: 'inherit' }}>
            <option>SEK</option>
          </select>
        </span>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label style={fieldLabel}>Intern anteckning (valfritt)</label>
        <textarea
          value={internalNote}
          onChange={e => setInternalNote(e.target.value)}
          placeholder="T.ex. anledning till bokning, referens till mejl, etc."
          rows={2}
          style={{ ...inp, resize: 'vertical', minHeight: '54px', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Kostnadsställe</label>
          <input value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder="Ange kostnadsställe" style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Projekt</label>
          <ProjectSearch value={projectId} onChange={setProjectId} projects={projects} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Motpart</label>
          <PartySearch value={counterpartyId} onChange={setCounterpartyId} contacts={contacts} />
        </div>
      </div>
      <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '0', marginBottom: '20px' }}>Gäller alla rader utan egen märkning.</p>

      {missingCounterparty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '20px', fontSize: '12.5px', color: '#92400e' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          Ett reskontrakonto (kundfordringar/leverantörsskulder) är använt — ange motparten så det syns vem affärshändelsen gäller.
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Rows table */}
        <div style={{ flex: 2 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: '#9ca3af', borderBottom: '1px solid #eceef1', width: 130 }}>KONTO</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: '#9ca3af', borderBottom: '1px solid #eceef1' }}>BESKRIVNING</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: '#9ca3af', borderBottom: '1px solid #eceef1', width: 100 }}>DEBET</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: '#9ca3af', borderBottom: '1px solid #eceef1', width: 100 }}>KREDIT</th>
                <th style={{ padding: '0 8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.03em', color: '#9ca3af', borderBottom: '1px solid #eceef1', width: 120 }}>SALDO</th>
                <th style={{ width: 52, borderBottom: '1px solid #eceef1' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const warning = rowSideWarning(row);
                const currentBalance = row.account ? (balances?.[row.account] || 0) : null;
                const rowSigned = (parseFloat(row.debet) || 0) - (parseFloat(row.kredit) || 0);
                const projectedBalance = currentBalance !== null ? currentBalance + rowSigned : null;
                const hasOverride = row.costCenter || row.projectId;
                const overrideOpen = expandedRows.has(i);
                return (
                <React.Fragment key={i}>
                <tr style={{ borderBottom: '1px solid #f4f5f7' }}>
                  <td style={{ padding: '6px 8px 6px 0' }}>
                    <AccountSearch
                      value={row.account}
                      accounts={accounts}
                      compact
                      onChange={(code, name) => { updateRow(i, 'account', code); updateRow(i, 'accountName', name); }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', color: '#374151', fontSize: '13px' }}>
                    <input
                      value={row.desc || ''}
                      onChange={e => updateRow(i, 'desc', e.target.value)}
                      placeholder="Radtext..."
                      style={{ ...inp, padding: '9px 12px' }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="number" min="0" value={row.debet}
                      onChange={e => updateRow(i, 'debet', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 14px', textAlign: 'left', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f8fafc' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="number" min="0" value={row.kredit}
                      onChange={e => updateRow(i, 'kredit', e.target.value)}
                      onBlur={() => handleBlurAmount(i)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBlurAmount(i); }}
                      style={{ ...inp, padding: '9px 14px', textAlign: 'left', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f8fafc' }}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} title="Kontots saldo före och efter denna rad (baserat på nuvarande bokförda saldo)">
                    {projectedBalance !== null ? (
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{fmt(currentBalance)} kr</div>
                        <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>→ {fmt(projectedBalance)} kr</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#c7cbd1' }}>–</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {warning && (
                      <span title={warning} style={{ display: 'inline-flex', color: '#d97706', cursor: 'help', marginRight: '4px' }}>
                        <AlertCircle size={14} />
                      </span>
                    )}
                    <button onClick={() => toggleRowOverride(i)} title="Egen kostnadsställe/projekt för denna rad" style={{ background: 'none', border: 'none', cursor: 'pointer', color: hasOverride || overrideOpen ? '#111827' : '#c7cbd1', padding: '2px', marginRight: '2px' }}>
                      <Tag size={15} />
                    </button>
                    {rows.length > 1 && (row.account || row.debet || row.kredit) && (
                      <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c7cbd1', padding: '2px' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
                {overrideOpen && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2px 8px 12px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>Kostnadsställe (denna rad)</label>
                          <input value={row.costCenter || ''} onChange={e => updateRow(i, 'costCenter', e.target.value)} placeholder={costCenter || 'Ärver från verifikationen'} style={{ ...inp, padding: '6px 10px', fontSize: '12.5px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...fieldLabel, marginBottom: '3px' }}>Projekt (denna rad)</label>
                          <ProjectSearch value={row.projectId} onChange={v => updateRow(i, 'projectId', v)} projects={projects} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #eceef1' }}>
                <td colSpan={2} style={{ padding: '12px 8px', fontWeight: 700, fontSize: '13px', color: '#111' }}>Summa</td>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, color: isBalanced ? '#111' : '#dc2626' }}>{fmt(totalDebit)}</td>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, color: isBalanced ? '#111' : '#dc2626' }}>{fmt(totalCredit)}</td>
                <td colSpan={2} />
              </tr>
              {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
                <tr>
                  <td colSpan={6} style={{ padding: '0 8px 8px', fontSize: '12px', color: '#dc2626' }}>Obalanserad — differens: {fmt(diff)} kr</td>
                </tr>
              )}
            </tfoot>
          </table>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={13} /> Lägg till rad
            </button>
            {templates && templates.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid #e4e4e7', borderRadius: '999px', background: 'white' }}>
                <LayoutTemplate size={13} style={{ position: 'absolute', left: 12, color: '#374151', pointerEvents: 'none' }} />
                <select
                  value=""
                  onChange={e => {
                    const tpl = templates.find(t => t.id === e.target.value);
                    if (!tpl) return;
                    if (rows.some(r => r.account || r.debet || r.kredit)) {
                      if (!window.confirm('Ersätt raderna i formuläret med mallens rader?')) return;
                    }
                    setDesc(tpl.description || '');
                    setProjectId(tpl.projectId || '');
                    setCostCenter(tpl.costCenter || '');
                    setRows(tpl.rows.map(r => ({ ...r })));
                  }}
                  style={{ padding: '7px 14px 7px 30px', border: 'none', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: '#374151', fontFamily: 'inherit', background: 'transparent', appearance: 'none' }}
                >
                  <option value="">Använd mall</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {onSaveTemplate && (
              <button
                onClick={() => {
                  const name = window.prompt('Namn på mallen:', desc || '');
                  if (name && name.trim()) onSaveTemplate({ name: name.trim(), description: desc, projectId, costCenter, rows });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: 'white', border: '1px solid #e4e4e7', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Save size={13} /> Spara som mall
              </button>
            )}
          </div>
        </div>

        {/* Right side: Attachment */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Underlag</div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            style={{ flex: 1, border: `1px dashed ${dragOver ? '#111827' : '#d1d5db'}`, borderRadius: '10px', background: dragOver ? '#f8fafc' : 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', minHeight: '160px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => acceptFile(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg,.webp" />
            {attachment ? (
              attachmentIsImage ? (
                <>
                  <img
                    src={attachmentUrl}
                    alt={attachment.name}
                    onClick={e => { e.stopPropagation(); setShowAttachmentLightbox(true); }}
                    style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '8px', objectFit: 'contain', marginBottom: '8px', cursor: 'zoom-in', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                  />
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111', wordBreak: 'break-all' }}>{attachment.name}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={e => { e.stopPropagation(); setShowAttachmentLightbox(true); }} style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>Visa i fullstorlek</button>
                    <button onClick={(e) => { e.stopPropagation(); setAttachment(null); }} style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', cursor: 'pointer', color: '#64748b' }}>Ta bort</button>
                  </div>
                </>
              ) : (
                <>
                  <FileText size={28} color="#111827" style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111', wordBreak: 'break-all' }}>{attachment.name}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <a href={attachmentUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', color: '#374151', textDecoration: 'none' }}>Visa PDF</a>
                    <button onClick={(e) => { e.stopPropagation(); setAttachment(null); }} style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', cursor: 'pointer', color: '#64748b' }}>Ta bort</button>
                  </div>
                </>
              )
            ) : (
              <>
                <UploadCloud size={26} color="#9ca3af" style={{ marginBottom: '10px' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111' }}>Dra och släpp filer här</span>
                <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>PDF eller bild (max {MAX_ATTACHMENT_MB} MB)</span>
              </>
            )}
          </div>
          {fileError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#b91c1c' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {fileError}
            </div>
          )}
          {!attachment && (
            <div style={{ marginTop: '12px' }} onClick={e => e.stopPropagation()}>
              <label style={labelStyle}>Var förvaras originalet?</label>
              <input
                value={originalLocation}
                onChange={e => setOriginalLocation(e.target.value)}
                placeholder="T.ex. pärm 2026 nr 14, eller e-post 2026-08-12"
                style={inp}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Frivilligt, men bra att fylla i när inget underlag är uppladdat här.</span>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const validRowCount = rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0)).length;
        const validationMessages = [];
        if (!desc.trim()) validationMessages.push('Ange en beskrivning');
        if (validRowCount < 2) validationMessages.push('Minst två rader med konto och belopp krävs');
        const canReview = isBalanced && validationMessages.length === 0;
        return (
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #eceef1' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              if (!window.confirm('Rensa formuläret? Ifylld information försvinner.')) return;
              setDesc(''); setProjectId(''); setCostCenter(''); setInternalNote('');
              setCounterpartyId(''); setOriginalLocation(''); setAttachment(null);
              setRows([{ account: '', accountName: '', debet: '', kredit: '', desc: '' }]);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: 'none', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#6b7280', cursor: 'pointer', marginRight: 'auto' }}
          ><RefreshCw size={13} /> Rensa</button>
          <button onClick={() => handleSave('draft')} style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            Spara som utkast
          </button>
          <button onClick={() => canReview && setShowReview(true)} disabled={!canReview} style={{
            padding: '10px 22px', background: canReview ? '#18181b' : '#e4e4e7',
            border: 'none', borderRadius: '8px', color: canReview ? 'white' : '#9ca3af', fontWeight: 600,
            fontSize: '13.5px', cursor: canReview ? 'pointer' : 'not-allowed'
          }}>
            {initial ? 'Granska & spara' : 'Granska & skapa'}
          </button>
        </div>
        {validationMessages.length > 0 && (
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            {validationMessages.map(m => (
              <div key={m} style={{ fontSize: '12px', color: '#dc2626' }}>{m}</div>
            ))}
          </div>
        )}
      </div>
        );
      })()}

      {/* ── Underlag i fullstorlek ──────────────────────────────── */}
      {showAttachmentLightbox && attachmentUrl && (
        <div onClick={() => setShowAttachmentLightbox(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 32 }}>
          <img src={attachmentUrl} alt={attachment?.name} style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} />
          <button onClick={() => setShowAttachmentLightbox(false)} style={{ position: 'fixed', top: 20, right: 24, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '999px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* ── Granska innan bokföring ─────────────────────────────── */}
      {showReview && (
        <div onClick={() => setShowReview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#111' }}>Granska verifikation</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#6b7280' }}>{date} · Serie {series} · {desc || 'Ingen beskrivning'}</p>
            <div style={{ border: '1px solid #e4e4e7', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              {rows.filter(r => r.account && (parseFloat(r.debet) > 0 || parseFloat(r.kredit) > 0)).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}>
                  <span><strong style={{ color: '#1a3028' }}>{r.account}</strong> {r.accountName}</span>
                  <span style={{ fontWeight: 600, color: r.debet ? '#2e7d32' : '#c62828' }}>{r.debet ? `D ${fmt(r.debet)}` : `K ${fmt(r.kredit)}`}</span>
                </div>
              ))}
              {missingCounterparty && (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#92400e', background: '#fffbeb' }}>Observera: reskontrakonto utan motpart.</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowReview(false)} style={{ padding: '9px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Tillbaka och ändra</button>
              <button onClick={() => { handleSave('booked'); setShowReview(false); }} style={{ padding: '9px 20px', background: '#16a34a', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}>
                {initial ? 'Spara ändringar' : 'Bokför'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Bokföring Component ──────────────────────────────────────────────────
export default function Bokforing({ verifications = [], accounts = [], balances = {}, contacts = [], projects = [], templates = [], onSaveTemplate, onAdd, setVerifications, setAccounts, highlightVerificationId, onClearHighlight, vatPeriods }) {
  const [activeTab, setActiveTab] = useState('verifications');
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVer, setEditingVer] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [series, setSeries] = useState('all');

  // Kontoplan state
  const [accountSearch, setAccountSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(
    Object.fromEntries(BAS_GROUPS.map(g => [g.code, parseInt(g.code) <= 3]))
  );
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');

  // Varje serie (A/B/C) har sin egen löpande, oberoende nummerserie.
  const getNextNumber = (seriesLetter = 'A') => {
    const max = verifications.reduce((m, v) => {
      if (!(v.number || '').startsWith(seriesLetter)) return m;
      const n = parseInt((v.number || '').replace(/\D/g, ''), 10);
      return !isNaN(n) && n > m ? n : m;
    }, 0);
    return `${seriesLetter}${String(max + 1).padStart(3, '0')}`;
  };

  const nextNumber = getNextNumber('A');

  // Hoppa direkt till en specifik verifikation — används av Momsdeklarationens
  // Steg 1 för att låta felposter i valideringslistan vara klickbara.
  useEffect(() => {
    if (!highlightVerificationId) return;
    setActiveTab('verifications');
    setSearch(''); setDateFrom(''); setDateTo(''); setSeries('all');
    setExpandedId(highlightVerificationId);
    const t = setTimeout(() => {
      document.getElementById(`ver-row-${highlightVerificationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onClearHighlight?.();
    }, 80);
    return () => clearTimeout(t);
  }, [highlightVerificationId]); // eslint-disable-line

  const handleSaveVerification = (data) => {
    // Fortsätter man ett sparat utkast, behåller det sitt redan tilldelade
    // nummer. En ny verifikation eller en rättelse får ett nytt, i rätt serie.
    const number = editingVer?.number || getNextNumber(data.series || 'A');
    onAdd({ number, ...data });
    setShowForm(false);
    setEditingVer(null);
  };

  // Filter verifications
  const filteredVers = verifications.filter(v => {
    if (search) {
      const s = search.toLowerCase();
      if (!v.number?.toLowerCase().includes(s) && !v.description?.toLowerCase().includes(s)) return false;
    }
    if (dateFrom && v.date < dateFrom) return false;
    if (dateTo && v.date > dateTo) return false;
    if (series !== 'all' && !v.number?.startsWith(series)) return false;
    return true;
  }).slice().reverse(); // newest first

  // Kontoplan grouping
  const getGroupAccounts = (groupCode) => {
    return accounts.filter(a => {
      const n = parseInt(a.code, 10);
      const g = BAS_GROUPS.find(g => g.code === groupCode);
      return g && n >= g.range[0] && n <= g.range[1];
    }).filter(a =>
      !accountSearch || a.code.startsWith(accountSearch) || a.name.toLowerCase().includes(accountSearch.toLowerCase())
    );
  };

  const getGroupBalance = (groupCode) => {
    const g = BAS_GROUPS.find(g => g.code === groupCode);
    if (!g) return 0;
    return accounts
      .filter(a => { const n = parseInt(a.code, 10); return n >= g.range[0] && n <= g.range[1]; })
      .reduce((sum, a) => sum + (balances[a.code] || 0), 0);
  };

  useEffect(() => {
    if (accountSearch) setExpandedGroups(Object.fromEntries(BAS_GROUPS.map(g => [g.code, true])));
  }, [accountSearch]);

  const handleAddAccount = () => {
    if (!newAccCode || !newAccName) return;
    if (accounts.find(a => a.code === newAccCode)) { alert(`Konto ${newAccCode} finns redan.`); return; }
    setAccounts(prev => [...prev, { code: newAccCode, name: newAccName }].sort((a, b) => a.code.localeCompare(b.code)));
    setNewAccCode(''); setNewAccName(''); setShowNewAccountForm(false);
  };

  const handleDeactivateAccount = (code) => {
    const used = verifications.filter(v => v.rows?.some(r => r.account === code)).length;
    if (used > 0) { alert(`Kontot används i ${used} verifikationer och kan inte tas bort. Det kan inaktiveras.`); return; }
    setAccounts(prev => prev.filter(a => a.code !== code));
  };

  // Form is rendered inline now.

  const thSt = {
    padding: '7px 10px', fontSize: '11px', fontWeight: 700, color: '#555',
    background: '#f5f5f5', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', textAlign: 'left',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

      {/* ── Top section: title + tabs ─────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Bokföring</h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>Verifikationer, kontoplan och bokföringsposter</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'verifications' && (
              <>
                <span style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>Nästa: <strong style={{ color: '#1a3028' }}>{nextNumber}</strong></span>
                <button onClick={() => { setEditingVer(null); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#2e7d32', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                  <Plus size={14} /> Ny verifikation
                </button>
              </>
            )}
            {activeTab === 'accounts' && (
              <button onClick={() => setShowNewAccountForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#2e7d32', border: 'none', borderRadius: '5px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                <Plus size={14} /> Nytt konto
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {[{ id: 'verifications', label: 'Verifikationer' }, { id: 'accounts', label: 'Kontoplan' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? '#1a3028' : '#666',
              background: 'none',
              borderBottom: activeTab === t.id ? '3px solid #1a3028' : '3px solid transparent',
              marginBottom: '-1px',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── VERIFIKATIONER TAB ───────────────────────────────────── */}
      {activeTab === 'verifications' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {showForm && (
            <div style={{ padding: '24px 20px 0 20px' }}>
              <VerificationForm
                accounts={accounts}
                contacts={contacts}
                projects={projects}
                balances={balances}
                templates={templates}
                onSaveTemplate={onSaveTemplate}
                nextNumber={nextNumber}
                getNextNumber={getNextNumber}
                initial={editingVer}
                onSave={handleSaveVerification}
                onClose={() => { setShowForm(false); setEditingVer(null); }}
                vatPeriods={vatPeriods}
              />
            </div>
          )}

          {/* Filter bar */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap', marginTop: showForm ? '0' : '0' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök verifikation, text, belopp..." style={{ padding: '5px 8px 5px 26px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', width: '220px', outline: 'none' }} />
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }} />
            <span style={{ fontSize: '12px', color: '#999' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }} />
            <select value={series} onChange={e => setSeries(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}>
              <option value="all">Alla serier</option>
              <option value="A">Serie A</option>
              <option value="B">Serie B</option>
              <option value="C">Serie C</option>
            </select>
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setSeries('all'); }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555' }}>
              <RefreshCw size={12} /> Rensa
            </button>
            <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>{filteredVers.length} verifikationer</span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={thSt}>VERIFIKATION</th>
                  <th style={thSt}>DATUM</th>
                  <th style={thSt}>BESKRIVNING</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>BELOPP</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>STATUS</th>
                  <th style={thSt}></th>
                </tr>
              </thead>
              <tbody>
                {filteredVers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '14px', background: 'white' }}>
                      <FileText size={40} style={{ color: '#e4e4e7', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                      Inga verifikationer bokförda
                    </td>
                  </tr>
                ) : filteredVers.map((v, i) => {
                  const isExpanded = expandedId === v.id;
                  const amount = v.rows?.reduce((s, r) => s + getDebet(r), 0) || v.amount || 0;
                  const isDraft = (v.status || 'booked') === 'draft';
                  return (
                    <React.Fragment key={v.id}>
                      <tr
                        id={`ver-row-${v.id}`}
                        onClick={() => setExpandedId(isExpanded ? null : v.id)}
                        style={{ borderBottom: '1px solid #e8e8e8', background: isExpanded ? '#f0f9f0' : (i % 2 === 0 ? 'white' : '#fafafa'), cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f5fdf5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? '#f0f9f0' : (i % 2 === 0 ? 'white' : '#fafafa'); }}
                      >
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1a3028' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {v.number}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: '#555' }}>{v.date}</td>
                        <td style={{ padding: '10px 10px', color: '#333' }}>{v.description}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#222' }}>{fmt(amount)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          {isDraft ? (
                            <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>Utkast</span>
                          ) : (
                            <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32' }}>Bokförd</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px' }} onClick={e => e.stopPropagation()}>
                          {isDraft ? (
                            <button
                              onClick={() => { setEditingVer(v); setShowForm(true); }}
                              title="Fortsätt redigera utkastet"
                              style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              Fortsätt
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const newRows = v.rows ? v.rows.map(r => ({ ...r, accountName: r.accountName || '', debet: getKredit(r) || 0, kredit: getDebet(r) || 0 })) : [];
                                setEditingVer({ ...v, description: `Rätta: ${v.number} – ${v.description}`, rows: newRows, number: undefined, status: 'booked', createdAt: undefined });
                                setShowForm(true);
                              }}
                              title="Skapa rättelseverifikation"
                              style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <RotateCcw size={11} /> Rätta
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && v.rows && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 0 0 32px', background: '#f8fdf8', borderBottom: '2px solid #c8e6c9' }}>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '10px 8px 0', fontSize: '11.5px', color: '#666' }}>
                              <span>Motpart: <strong style={{ color: '#333' }}>{contacts.find(c => c.id === v.counterpartyId)?.name || '—'}</strong></span>
                              <span>Upprättad: <strong style={{ color: '#333' }}>{v.createdAt ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v.createdAt)) : '—'}</strong></span>
                              {v.originalLocation && <span>Original förvaras: <strong style={{ color: '#333' }}>{v.originalLocation}</strong></span>}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '8px 0' }}>
                              <thead>
                                <tr>
                                  {['Konto', 'Kontonamn', 'Debet', 'Kredit'].map(h => (
                                    <th key={h} style={{ padding: '4px 8px', textAlign: h === 'Debet' || h === 'Kredit' ? 'right' : 'left', color: '#888', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {v.rows.map((r, ri) => {
                                  const rd = getDebet(r), rk = getKredit(r);
                                  return (
                                  <tr key={ri} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: 700, color: '#1a3028' }}>{r.account}</td>
                                    <td style={{ padding: '5px 8px', color: '#555' }}>
                                      {accounts.find(a => a.code === r.account)?.name || r.accountName || '—'}
                                      {r.desc && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.desc}</div>}
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', color: rd > 0 ? '#2e7d32' : '#ccc', fontWeight: rd > 0 ? 600 : 400 }}>
                                      {rd > 0 ? fmt(rd) : '—'}
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', color: rk > 0 ? '#c62828' : '#ccc', fontWeight: rk > 0 ? 600 : 400 }}>
                                      {rk > 0 ? fmt(rk) : '—'}
                                    </td>
                                  </tr>
                                  );
                                })}
                                <tr style={{ background: '#f0f9f0', borderTop: '1px solid #c8e6c9' }}>
                                  <td colSpan={2} style={{ padding: '5px 8px', fontWeight: 700, fontSize: '12px', color: '#2e7d32' }}>Summa</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(v.rows.reduce((s, r) => s + getDebet(r), 0))}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(v.rows.reduce((s, r) => s + getKredit(r), 0))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KONTOPLAN TAB ────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Search + new account form */}
          <div style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Sök kontonummer eller namn..." style={{ padding: '5px 8px 5px 26px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', width: '240px', outline: 'none' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>{accounts.length} konton</span>
          </div>

          {/* New account form */}
          {showNewAccountForm && (
            <div style={{ background: '#f0f9f0', borderBottom: '1px solid #c8e6c9', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2e7d32' }}>Nytt konto</span>
              <input value={newAccCode} onChange={e => setNewAccCode(e.target.value)} placeholder="Kontonummer" style={{ padding: '5px 8px', border: '1px solid #bbb', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '110px' }} />
              <input value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Kontonamn" style={{ padding: '5px 8px', border: '1px solid #bbb', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', width: '260px' }} />
              <button onClick={handleAddAccount} style={{ padding: '5px 14px', background: '#2e7d32', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Spara</button>
              <button onClick={() => setShowNewAccountForm(false)} style={{ padding: '5px 10px', background: 'none', border: '1px solid #bbb', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Avbryt</button>
              {newAccCode && <span style={{ fontSize: '11px', color: '#888' }}>Kontoklass: {getGroup(newAccCode)?.label || '—'}</span>}
            </div>
          )}

          {/* Grouped account list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {BAS_GROUPS.map(g => {
              const groupAccs = getGroupAccounts(g.code);
              const groupBal = getGroupBalance(g.code);
              const isOpen = expandedGroups[g.code];
              const hasMatch = !accountSearch || groupAccs.length > 0;

              if (!hasMatch) return null;

              return (
                <div key={g.code} style={{ borderBottom: '1px solid #ddd' }}>
                  {/* Group header */}
                  <div
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [g.code]: !prev[g.code] }))}
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#f0f2f5', cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e8eaed'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f0f2f5'}
                  >
                    {isOpen ? <ChevronDown size={15} style={{ marginRight: 8, color: '#555' }} /> : <ChevronRight size={15} style={{ marginRight: 8, color: '#555' }} />}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#333', flex: 1 }}>{g.label}</span>
                    <span style={{ fontSize: '12px', color: '#888', marginRight: 12 }}>{groupAccs.length} konton</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: groupBal >= 0 ? '#2e7d32' : '#c62828', minWidth: 100, textAlign: 'right' }}>
                      {fmt(groupBal)}
                    </span>
                  </div>

                  {/* Account rows */}
                  {isOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          <th style={{ padding: '5px 20px 5px 36px', textAlign: 'left', color: '#888', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #eee' }}>KONTO</th>
                          <th style={{ padding: '5px 10px', textAlign: 'left', color: '#888', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #eee' }}>KONTONAMN</th>
                          <th style={{ padding: '5px 20px 5px 10px', textAlign: 'right', color: '#888', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #eee' }}>SALDO</th>
                          <th style={{ width: 50, borderBottom: '1px solid #eee' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {groupAccs.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: '16px 36px', color: '#bbb', fontSize: '12px' }}>Inga matchande konton</td></tr>
                        ) : groupAccs.map((a, ai) => {
                          const bal = balances[a.code] || 0;
                          const usedInVers = verifications.filter(v => v.rows?.some(r => r.account === a.code)).length;
                          return (
                            <tr key={a.code} style={{ borderBottom: '1px solid #f5f5f5', background: ai % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '7px 10px 7px 36px', fontWeight: 700, color: '#1a3028' }}>{a.code}</td>
                              <td style={{ padding: '7px 10px', color: '#333' }}>{a.name}</td>
                              <td style={{ padding: '7px 20px 7px 10px', textAlign: 'right', fontWeight: bal !== 0 ? 700 : 400, color: bal > 0 ? '#2e7d32' : bal < 0 ? '#c62828' : '#bbb' }}>
                                {bal !== 0 ? fmt(bal) : '—'}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeactivateAccount(a.code)}
                                  title={usedInVers > 0 ? `Används i ${usedInVers} verifikationer — kan inte tas bort` : 'Ta bort konto'}
                                  style={{ background: 'none', border: 'none', cursor: usedInVers > 0 ? 'not-allowed' : 'pointer', color: usedInVers > 0 ? '#ddd' : '#ef4444', padding: '2px' }}
                                >
                                  <X size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
