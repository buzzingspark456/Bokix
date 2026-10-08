import React, { useMemo, useRef, useState } from 'react';
import { Download, Upload, Check } from './icons';
import { Notice } from './SkattekontoImportModal';
import { parseBookingCsv, groupBookingsByDay, buyerTotals, bookingTemplateCsv } from '../utils/bookingImport';
import { buildRotRutXml, casesBatchErrors, priorClaims, splitIntoFiles, workTypesFor, downloadText, RUT_FLAT_RATE_TYPES } from '../utils/rotRutRequest';
import { uploadFileToStorage } from '../utils/fileUpload';
import { BRAND } from '../utils/brandColors';
import { t as tr } from '../i18n';

// Fliken "Från annan app" i ROT/RUT-fönstret: läser en export med uppdrag
// från en annan app (bookingImport.js), bokför en verifikation per betaldag
// och gör filerna till Skatteverket ur samma rader. Filen och de färdiga
// XML-filerna laddas upp som underlag, så att de finns kvar i sju år och kan
// laddas ner igen under Väntar på utbetalning.

const fmt = (n) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0);
const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' };
const primaryBtn = (enabled) => ({ padding: '9px 18px', background: enabled ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' });
const inp = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' };
const lbl = { fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' };
const errText = (e) => tr(`rotRut.err.${e.key}`, e.vars);
const COLUMN_LABELS = { paidDate: 'Betaldatum', buyer: 'Personnummer', labor: 'Arbetskostnad', hours: 'Timmar' };
const PAY_ACCOUNTS = ['1930', '1580'];

export default function RotRutBookingImport({ type, company, invoices, contacts, batches, uid, onImport, onDone }) {
  const fileRef = useRef(null);
  const [workType, setWorkType] = useState(type === 'rut' ? 'Stadning' : '');
  const [payAccount, setPayAccount] = useState('1930');
  const [file, setFile] = useState(null); // { name, text, raw }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { batch, files: [{ name, xml, url }], warning }

  const parsed = useMemo(() => (file ? parseBookingCsv(file.text, { type, defaultWorkType: workType, company }) : null), [file, type, workType, company]);
  const rows = parsed?.rows || [];
  const bad = rows.filter(r => r.errors.length > 0);
  const days = useMemo(() => groupBookingsByDay(rows), [rows]);
  const cases = rows.map(r => r.case);
  const prior = priorClaims(invoices, contacts, batches);
  const batchErrors = rows.length ? casesBatchErrors(cases, prior) : [];
  const totals = {
    customerPaid: rows.reduce((s, r) => s + r.customerPaid, 0),
    deduction: rows.reduce((s, r) => s + r.case.deduction, 0),
    fee: Math.round(rows.reduce((s, r) => s + (r.fee || 0), 0) * 100) / 100,
  };
  const fileChunks = splitIntoFiles(cases);
  const from = days[0]?.date;
  const to = days[days.length - 1]?.date;
  const duplicate = parsed && batches.find(b => b.hash === parsed.hash);
  const overlap = !duplicate && from && batches.find(b => b.type === type && b.from <= to && b.to >= from);
  const missing = parsed?.missingColumns || [];
  const canImport = rows.length > 0 && bad.length === 0 && missing.length === 0 && batchErrors.length === 0 && !duplicate && !busy;

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setFile({ name: f.name, text: String(ev.target.result || ''), raw: f });
    reader.readAsText(f, 'utf-8');
  };

  const handleImport = async () => {
    if (!canImport) return;
    setBusy(true);
    const year = Number(from.slice(0, 4));
    const id = `rrb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const files = fileChunks.map((chunk, i) => {
      const name = fileChunks.length > 1 ? `${type.toUpperCase()} ${from.slice(0, 7)} ${i + 1}/${fileChunks.length}` : `${type.toUpperCase()} ${from}`;
      return { name, fileName: `${type}-begaran-${from}-${i + 1}.xml`, xml: buildRotRutXml({ type, name, cases: chunk }), count: chunk.length };
    });
    let attachment = null;
    let warning = '';
    if (uid) {
      try {
        attachment = { url: await uploadFileToStorage(uid, file.raw, 'rotrut'), name: file.name };
        for (const f of files) {
          f.url = await uploadFileToStorage(uid, new File([f.xml], f.fileName, { type: 'application/xml' }), 'rotrut');
        }
      } catch {
        warning = tr('rotRut.import.uploadFailed');
      }
    }
    const batch = {
      id, type, year, from, to, hash: parsed.hash, fileName: file.name, createdAt: new Date().toISOString(),
      count: rows.length, days: days.length, customerPaid: totals.customerPaid, deduction: totals.deduction, fee: totals.fee,
      payAccount, status: 'booked', buyerTotals: buyerTotals(rows), attachmentUrl: attachment?.url,
      files: files.map(f => ({ name: f.name, fileName: f.fileName, url: f.url, count: f.count })),
    };
    onImport({ batch, days, payAccount, attachment });
    setResult({ batch, files, warning });
    setBusy(false);
  };

  if (result) {
    return (
      <>
        <Notice tone="green">{tr('rotRut.import.booked', { days: result.batch.days, n: result.batch.count, amount: fmt(result.batch.deduction) })}</Notice>
        {result.warning && <Notice tone="amber">{result.warning}</Notice>}
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{tr('rotRut.import.downloadNow')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {result.files.map(f => (
            <button key={f.fileName} type="button" style={btn} onClick={() => downloadText(f.xml, f.fileName)}>
              <Download size={14} /> {f.name} ({f.count})
            </button>
          ))}
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" style={primaryBtn(true)} onClick={() => onDone(result.batch.id)}>
            <Check size={14} /> {tr('rotRut.markRequested')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{tr('rotRut.import.intro')}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <label style={lbl}>
          {tr('rotRut.import.defaultWork')}
          <select value={workType} onChange={e => setWorkType(e.target.value)} style={inp}>
            <option value="">{tr('rotRut.chooseWorkType')}</option>
            {workTypesFor(type).filter(w => !RUT_FLAT_RATE_TYPES.includes(w)).map(w => <option key={w} value={w}>{tr(`rotRut.work.${w}`)}</option>)}
          </select>
        </label>
        <label style={lbl}>
          {tr('rotRut.import.payAccount')}
          <select value={payAccount} onChange={e => setPayAccount(e.target.value)} style={inp}>
            {PAY_ACCOUNTS.map(a => <option key={a} value={a}>{tr(`rotRut.import.account${a}`)}</option>)}
          </select>
        </label>
        <button type="button" style={btn} onClick={() => downloadText(bookingTemplateCsv(type), `${type}-uppdrag-mall.csv`, 'text/csv;charset=utf-8')}>
          <Download size={14} /> {tr('rotRut.import.template')}
        </button>
        <button type="button" style={primaryBtn(true)} onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> {file ? tr('rotRut.import.otherFile') : tr('rotRut.import.chooseFile')}
        </button>
        <input type="file" ref={fileRef} accept=".csv,text/csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {parsed && (
        <>
          {missing.length > 0 && (
            <Notice tone="red">{tr('rotRut.import.missingColumns', { cols: missing.map(k => COLUMN_LABELS[k]).join(', ') })}</Notice>
          )}
          {rows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                [tr('rotRut.import.statJobs'), fmt(rows.length)],
                [tr('rotRut.import.statDays'), `${fmt(days.length)}${from ? ` (${from} – ${to})` : ''}`],
                [tr('rotRut.import.statPaid'), `${fmt(totals.customerPaid)} kr`],
                [tr('rotRut.import.statDeduction'), `${fmt(totals.deduction)} kr`],
                [tr('rotRut.import.statFiles'), fmt(fileChunks.length)],
                ...(totals.fee > 0 ? [[tr('rotRut.import.statFee'), `${fmt(totals.fee)} kr`]] : []),
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-muted)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{k}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {duplicate && <Notice tone="red">{tr('rotRut.import.duplicate', { date: duplicate.createdAt.slice(0, 10) })}</Notice>}
          {overlap && <Notice tone="amber">{tr('rotRut.import.overlap', { from: overlap.from, to: overlap.to })}</Notice>}
          {batchErrors.map((e, i) => <Notice key={i} tone="red">{errText(e)}</Notice>)}
          {bad.length > 0 && (
            <>
              <Notice tone="red">{tr('rotRut.import.rowErrors', { n: bad.length })}</Notice>
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '12px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                {bad.slice(0, 100).map(r => (
                  <div key={r.line} style={{ padding: '7px 12px', borderBottom: '1px solid var(--border-light)', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{tr('rotRut.import.row', { line: r.line })}{r.case.ref ? ` (${r.case.ref})` : ''}: </span>
                    <span style={{ color: 'var(--status-red-text)' }}>{r.errors.map(errText).join(' ')}</span>
                  </div>
                ))}
                {bad.length > 100 && <div style={{ padding: '7px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{tr('rotRut.import.more', { n: bad.length - 100 })}</div>}
              </div>
            </>
          )}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" disabled={!canImport} style={primaryBtn(canImport)} onClick={handleImport}>
              <Check size={14} /> {busy ? tr('rotRut.import.working') : tr('rotRut.import.book', { days: days.length })}
            </button>
          </div>
        </>
      )}
    </>
  );
}
