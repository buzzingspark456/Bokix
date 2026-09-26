import React, { useMemo, useState } from 'react';
import { X, FileText, Folder, UploadCloud, CheckCircle2, Loader2 } from './icons';
import { BRAND } from '../utils/brandColors';
import { uploadFileToStorage } from '../utils/fileUpload';
import { importedFiscalYears, matchAttachments, buildAttachmentUpdates, ATTACHMENT_EXTENSIONS } from '../utils/sieAttachments';
import { StepPills, Notice } from './SkattekontoImportModal';

// Underlag till SIE-importerad bokföring: filer eller en hel mapp kopplas
// till verifikationerna via verifikatnumret i filnamnet, inom ETT
// räkenskapsår. Matchningen bor i utils/sieAttachments.js. Ingenting laddas
// upp förrän användaren trycker Koppla i granskningssteget.
const STEPS = ['Välj filer', 'Granska', 'Resultat'];

const SKIP_REASON = {
  attached: 'Sitter redan på verifikatet',
  'no-number': 'Inget verifikatnummer i filnamnet',
  'not-found': 'Inget verifikat med det numret det året',
  'other-year': 'Filnamnet anger ett annat år',
  ambiguous: 'Flera verifikat har det numret',
  unsupported: 'Filtypen stöds inte',
};

const btn = { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn = (enabled) => ({ padding: '9px 18px', background: enabled ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit' });

/** Alla filer i det som släpptes, även inuti släppta mappar. */
async function filesFromDrop(dataTransfer) {
  const entries = [...(dataTransfer.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length === 0) return [...(dataTransfer.files || [])];
  const out = [];
  const walk = async (entry) => {
    if (entry.isFile) {
      out.push(await new Promise((res, rej) => entry.file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries ger högst ~100 poster per anrop; läs tills det tar slut.
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (batch.length === 0) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

export default function SieAttachmentsModal({ company, verifications = [], user, onAttach, onClose, uploadFn = uploadFileToStorage }) {
  const years = useMemo(() => importedFiscalYears(verifications, company?.fiscalYear), [verifications, company?.fiscalYear]);
  const [yearStart, setYearStart] = useState(years.length === 1 ? years[0].start : '');
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);

  const matches = useMemo(
    () => (yearStart && files.length ? matchAttachments(files, verifications, { fiscalYearStart: yearStart, companyFiscalYear: company?.fiscalYear }) : []),
    [files, verifications, yearStart, company?.fiscalYear],
  );
  const toAttach = matches.filter(m => m.status === 'match');
  const skipped = matches.filter(m => m.status !== 'match');
  const year = years.find(y => y.start === yearStart);

  const pickFiles = (list) => {
    const arr = [...(list || [])];
    if (arr.length === 0) return;
    setFiles(arr);
    setStep(1);
  };

  const handleAttach = async () => {
    if (!user?.id || toAttach.length === 0) return;
    setStep(2);
    setProgress({ done: 0, total: toAttach.length });
    const uploaded = [];
    const failed = [];
    let next = 0;
    const worker = async () => {
      while (next < toAttach.length) {
        const index = next++;
        const m = toAttach[index];
        try {
          const url = await uploadFn(user.id, m.file, 'verifications');
          uploaded.push({ index, verificationId: m.verification.id, url, name: m.file.name, type: m.file.type || '' });
        } catch (e) {
          failed.push({ name: m.file.name, message: e.message || 'okänt fel' });
        }
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Samma ordning som filerna listades i, så "första filen" blir
    // huvudunderlaget oavsett vilken uppladdning som blev klar först.
    uploaded.sort((a, b) => a.index - b.index);
    const updates = buildAttachmentUpdates(uploaded, verifications);
    if (updates.length) onAttach(updates);
    setResult({ files: uploaded.length, verifications: updates.length, failed });
    setProgress(null);
  };

  return (
    <div className="modal-overlay" onClick={progress ? undefined : onClose}>
      <div className="modal-content" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Koppla underlag till importerad bokföring</span>
          {!progress && <button className="modal-close" onClick={onClose} aria-label="Stäng"><X size={18} /></button>}
        </div>

        <StepPills steps={STEPS} step={step} />

        {step === 0 && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
              En SIE-fil innehåller bokföringen men inte underlagen. Om ditt gamla program namngav varje underlag efter sitt verifikat kopplas de automatiskt, utan AI-tolkning.
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
              Filnamn som fungerar: A31_abc123.pdf, A31.pdf, A-31 kvitto.pdf, 2024-A-31.pdf. Matchningen sker mot verifikatnumret i ditt gamla program, inte mot numret här.
            </p>

            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Vilket räkenskapsår gäller underlagen?</div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
              Numret i filnamnet börjar om varje år i det gamla programmet, så A31 pekar bara ut ett verifikat inom ett år. Välj året exporten kommer från. Filerna kopplas aldrig till något annat år.
            </p>

            {years.length === 0 ? (
              <Notice>Det finns ingen bokföring importerad via SIE ännu. Importera SIE-filen först, sedan kan underlagen kopplas här.</Notice>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {years.map(y => (
                  <button
                    key={y.start} type="button" onClick={() => setYearStart(y.start)}
                    style={{ padding: '8px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${yearStart === y.start ? BRAND.green : 'var(--border)'}`, background: yearStart === y.start ? BRAND.greenLight : 'var(--bg-card)', color: yearStart === y.start ? BRAND.greenDark : 'var(--text-main)' }}
                  >
                    {y.label} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {y.count} verifikat</span>
                  </button>
                ))}
              </div>
            )}

            {years.length > 0 && !yearStart && (
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                Välj ett räkenskapsår ovan för att fortsätta. Saknas året du söker har bokföringen för det året inte importerats via SIE.
              </p>
            )}

            {yearStart && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={async e => { e.preventDefault(); setDragging(false); pickFiles(await filesFromDrop(e.dataTransfer)); }}
                style={{ border: `1.5px dashed ${dragging ? BRAND.green : 'var(--gray-300)'}`, background: dragging ? 'rgba(234,243,222,0.4)' : 'var(--bg-card)', borderRadius: '12px', padding: '26px 20px', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '999px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <UploadCloud size={20} color={BRAND.greenDark} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Dra hit filer eller en mapp, eller välj nedan</div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label style={btn}>
                    <FileText size={15} /> Välj filer
                    <input type="file" multiple accept={ATTACHMENT_EXTENSIONS.map(e => `.${e}`).join(',')} style={{ display: 'none' }} onChange={e => pickFiles(e.target.files)} />
                  </label>
                  <label style={btn}>
                    <Folder size={15} /> Välj mapp
                    <input type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={e => pickFiles(e.target.files)} />
                  </label>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>PDF, JPG, PNG eller WEBP</div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Räkenskapsår {year?.label}. {files.length === 1 ? '1 fil vald' : `${files.length} filer valda`}.
            </p>
            {toAttach.length === 0 ? (
              <Notice>Ingen av filerna gick att koppla. Kontrollera att filnamnen börjar med verifikatnumret och att rätt räkenskapsår är valt.</Notice>
            ) : (
              <Notice tone="green">{toAttach.length === 1 ? '1 fil kopplas' : `${toAttach.length} filer kopplas`} till {new Set(toAttach.map(m => m.verification.id)).size} verifikat.</Notice>
            )}

            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', maxHeight: '340px', overflowY: 'auto' }}>
              {[...toAttach, ...skipped].map((m, i) => (
                <div key={`${m.name}-${i}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: i ? '1px solid var(--border-light)' : 'none', opacity: m.status === 'match' ? 1 : 0.7 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {m.status === 'match'
                        ? `${m.ref} → ${m.verification.number} · ${m.verification.date} · ${m.verification.description || ''}`
                        : `${m.ref ? `${m.ref}: ` : ''}${SKIP_REASON[m.status]}`}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: m.status === 'match' ? 'var(--status-green-bg)' : 'var(--bg-muted)', color: m.status === 'match' ? 'var(--status-green-text)' : 'var(--text-muted)' }}>
                    {m.status === 'match' ? 'Kopplas' : 'Hoppas över'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
            {progress ? (
              <>
                <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', margin: '10px 0 10px' }}>Laddar upp {progress.done} av {progress.total}…</div>
                <div style={{ height: 6, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden', maxWidth: 360, margin: '0 auto' }}>
                  <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: BRAND.green, transition: 'width 0.2s' }} />
                </div>
              </>
            ) : result && (
              <>
                <div style={{ width: 48, height: 48, borderRadius: '999px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <CheckCircle2 size={24} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {result.files === 1 ? '1 underlag kopplat' : `${result.files} underlag kopplade`}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px auto 0', maxWidth: '440px', lineHeight: 1.6 }}>
                  Till {result.verifications} verifikat. Du ser underlaget när du fäller ut verifikatet i Bokföring.
                </p>
                {result.failed.length > 0 && (
                  <div style={{ textAlign: 'left', marginTop: '14px' }}>
                    <Notice tone="red">
                      {result.failed.length} filer kunde inte laddas upp: {result.failed.map(f => f.name).join(', ')}. Försök igen med bara dem.
                    </Notice>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="modal-footer">
          {step === 1 && <button style={{ ...btn, padding: '9px 16px' }} onClick={() => { setStep(0); setFiles([]); }}>Tillbaka</button>}
          <span style={{ flex: 1 }} />
          {step < 2 && <button style={{ ...btn, padding: '9px 16px', color: 'var(--text-secondary)' }} onClick={onClose}>Avbryt</button>}
          {step === 1 && (
            <button style={primaryBtn(toAttach.length > 0 && user?.id)} disabled={toAttach.length === 0 || !user?.id} onClick={handleAttach}>
              {toAttach.length === 1 ? 'Koppla 1 fil' : `Koppla ${toAttach.length} filer`}
            </button>
          )}
          {step === 2 && !progress && <button style={primaryBtn(true)} onClick={onClose}>Klar</button>}
        </div>
      </div>
    </div>
  );
}
