import React, { useState } from 'react';
import { Check, Download } from './icons';
import { BRAND } from '../utils/brandColors';
import { getSignedStorageUrl } from '../utils/signedUrls';
import { downloadText } from '../utils/rotRutRequest';
import { t as tr } from '../i18n';

// En import av ROT/RUT-uppdrag från en annan app (RotRutBookingImport) som
// väntar på Skatteverket: filerna kan laddas ner igen, markeras som
// inskickade och få sin utbetalning registrerad. Betalar Skatteverket
// mindre än begärt bokförs resten som en fordran på kunderna (App.jsx).

const fmt = (n) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const inp = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' };
const small = { padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' };
const primary = { ...small, background: BRAND.green, color: 'white', border: 'none' };

// Filerna ligger i den privata lagringen: hämtas via en tidsbegränsad länk.
async function downloadStored(f) {
  try {
    const res = await fetch(await getSignedStorageUrl(f.url));
    if (!res.ok) throw new Error(String(res.status));
    downloadText(await res.text(), f.fileName);
  } catch {
    window.alert(tr('rotRut.batch.downloadFailed'));
  }
}

export default function RotRutBatchRow({ batch, onRequested, onPayout }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(String(batch.deduction));
  const n = Number(String(amount).replace(',', '.'));
  const valid = date && Number.isFinite(n) && n >= 0 && n <= batch.deduction;

  return (
    <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {batch.type.toUpperCase()} · {tr('rotRut.batch.title', { from: batch.from, to: batch.to, n: batch.count })}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {batch.fileName} · {batch.status === 'requested' ? tr('rotRut.requestedOn', { date: batch.requestedAt || '' }) : tr('rotRut.batch.notSent')}
          </div>
        </div>
        <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(batch.deduction)} kr</div>
      </div>

      {(batch.files || []).some(f => f.url) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {batch.files.filter(f => f.url).map(f => (
            <button key={f.fileName} type="button" style={small} onClick={() => downloadStored(f)}><Download size={13} /> {f.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '10px' }}>
        {batch.status !== 'requested' ? (
          <button type="button" style={primary} onClick={onRequested}><Check size={13} /> {tr('rotRut.markRequested')}</button>
        ) : (
          <>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {tr('rotRut.payoutDate')}
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </label>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {tr('rotRut.batch.amount')}
              <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inp, width: '120px' }} />
            </label>
            <button type="button" disabled={!valid} style={{ ...primary, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }} onClick={() => onPayout(date, n)}>
              <Check size={13} /> {tr('rotRut.batch.registerPayout')}
            </button>
          </>
        )}
      </div>
      {batch.status === 'requested' && valid && n < batch.deduction && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--status-amber-text)' }}>
          {tr('rotRut.batch.partial', { amount: fmt(batch.deduction - n) })}
        </div>
      )}
    </div>
  );
}
