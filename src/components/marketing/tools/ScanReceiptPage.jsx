import React, { useRef, useState } from 'react';
import Turnstile from '../../Turnstile';
import { Check } from '../../icons';
import { INK, INK_SOFT, MUTED } from '../marketingTokens';
import { BRAND } from '../../../utils/brandColors';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolNote } from './ToolShell';
import { ocrFile } from '../../../utils/ocrReceipt';
import { analyzeReceipt, buildReceiptPlan } from '../../../utils/receiptScan';
import { freeGoogleReadLeft, readFreeWithGoogle } from '../../../utils/ocrFree';
import { DEFAULT_ACCOUNTS } from '../../AccountsData';
import { MIN_SCAN_MS, REVEAL_STEP_MS, SCAN_MESSAGES, photoHintText } from '../../shared/ScanExperience';

const tool = toolBySlug('skanna-kvitto');

// Bara för VISNING på den här fristående sidan ("5010 Lokalhyra" i
// stället för en bar kod) — samma DEFAULT_ACCOUNTS som varje nytt Bokix-
// konto faktiskt får, inte en egen påhittad lista. Skriver aldrig
// någonstans, precis som resten av sidan.
const ACCOUNT_NAME = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.code, a.name]));

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Grov, ärlig uppskattning av var i hela läsningen (fil → text → klar) ett
// givet statusmeddelande från ocrReceipt.js:s onProgress-callback ligger,
// 0–100. Tesseract-fasen ("Läser av kvitto… NN%") skickar en riktig,
// mätbar procent — den använder vi rakt av. De andra faserna (hämta filen,
// ladda modeller, extrahera PDF-text) skickar bara ett meddelande utan
// tal, så de får en fast platshållarnivå i rätt ordning. Poängen är INTE
// exakthet (ingen ser skillnad på 24 % och 27 %) — poängen är att strålen
// nedan alltid rör sig FRAMÅT i takt med var läsningen faktiskt är, aldrig
// hänger stilla eller hoppar bakåt.
function stagePctFor(msg) {
  const text = String(msg || '');
  const inline = text.match(/(\d{1,3})\s*%\s*$/);
  if (inline) return Math.min(96, Math.max(30, Number(inline[1])));
  if (/Läser digital PDF/.test(text)) return 55;
  if (/Skannad PDF/.test(text)) return 20;
  if (/Laddar språkmodeller/.test(text)) return 26;
  if (/Startar OCR-motor|Förbereder OCR/.test(text)) return 18;
  if (/Hämtar kvittofil/.test(text)) return 8;
  return 6; // "Startar läsning…" och allt okänt — precis igång
}

// Samma sex fält, samma ordning och samma bedömning som kvittovyn i appen:
// analyzeReceipt och buildReceiptPlan (utils/receiptScan.js) är exakt den
// kod appen kör. "Avläst" när det stod tydligt i dokumentet, "Kontrollera"
// när det är en rimlig gissning, "Förslag" för ett konto appen skulle
// föreslå men inte fylla i, och inget alls när det saknas. Ett dokument som
// inte är ett kvitto eller en faktura fyller ingenting i.
function fmtAmount(n) {
  return Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FIELD_NAMES = { supplier: 'Leverantör', date: 'Datum', receiptNumber: 'Nummer', amount: 'Belopp', vatRate: 'Moms', costAccount: 'Konto' };

function buildFields(analysis, plan) {
  const { parsed, supplierName, amountSek, foreignInfo } = analysis;
  const blocked = Boolean(parsed.unreadable || parsed.notReceipt);
  return plan.map(step => {
    const field = { key: step.key, label: FIELD_NAMES[step.key], found: !blocked && step.found, state: step.state, value: '', note: '' };
    if (step.key === 'supplier') field.value = supplierName;
    if (step.key === 'date') field.value = parsed.date;
    if (step.key === 'receiptNumber') { field.value = parsed.receiptNumber; field.note = parsed.receiptNumberLabel || ''; }
    if (step.key === 'amount') {
      if (amountSek) {
        field.value = `${fmtAmount(amountSek)} kr`;
        if (foreignInfo) field.note = `${fmtAmount(foreignInfo.amount)} ${foreignInfo.code} omräknat med dagskursen`;
      } else if (!blocked && foreignInfo) {
        // Kursen gick inte att hämta: beloppet visas som det stod, att kontrollera.
        Object.assign(field, { found: true, state: 'guess', value: `${fmtAmount(foreignInfo.amount)} ${foreignInfo.code}`, note: 'Kursen kunde inte hämtas' });
      }
    }
    if (step.key === 'vatRate') {
      const mixed = step.patch.vatRate === 'mixed';
      field.value = mixed
        ? `Flera satser · ${fmtAmount(parsed.vatAmount)} kr`
        : `${parsed.vatRate} %${parsed.vatVerified && parsed.vatAmount ? ` · ${fmtAmount(parsed.vatAmount)} ${parsed.currency || 'kr'}` : ''}`;
      if (parsed.reverseCharge) field.note = 'Omvänd skattskyldighet';
      else if (step.state === 'guess') field.note = 'Antagen, stod inte tydligt';
    }
    if (step.key === 'costAccount') {
      const code = step.found ? step.patch.costAccount : step.suggest?.code;
      if (!blocked && code) {
        Object.assign(field, { found: true, state: step.found ? step.state : 'suggest', value: `${code} ${ACCOUNT_NAME[code] || ''}`.trim() });
      }
    }
    return field;
  });
}

// Samma ord som appens checklista (ScanExperience.jsx).
const STATE_TEXT = { found: 'Avläst', guess: 'Kontrollera', suggest: 'Förslag', missing: 'Hittades inte' };

// Vilken ruta på kvittot varje rad hör till (ocrFieldBoxes.js). Kontot står
// inte på kvittot, så det har ingen.
const BOX_FOR = { supplier: 'supplier', date: 'date', receiptNumber: 'receiptNumber', amount: 'amount', vatRate: 'vatAmount' };

// Fältens namn, så att formuläret syns redan innan något kvitto valts.
const FIELD_LABELS = ['Leverantör', 'Datum', 'Nummer', 'Belopp', 'Moms', 'Konto'];

/** En rad i "Ny utgift": namn, värde och en liten statustext. Utan värde
 * (inget kvitto än, eller raden inte uppläst ännu) visas en grå platshållare,
 * som i appens kvittovy. */
function ScanRow({ label, field, revealed, scanning, hasBox, onPoint }) {
  const st = !revealed || !field ? null : (field.found ? field.state : 'missing');
  const pointable = hasBox && st && st !== 'missing';
  return (
    <div
      className={`bx-scan-row${st ? ` is-${st}` : ''}${pointable ? ' has-box' : ''}`}
      onMouseEnter={pointable ? () => onPoint(true) : undefined}
      onMouseLeave={pointable ? () => onPoint(false) : undefined}
    >
      <span className="bx-scan-label">{label}</span>
      <span className="bx-scan-value">
        {st && st !== 'missing'
          ? <span className="bx-scan-in">{field.value}{field.note ? <small>{field.note}</small> : null}</span>
          : st === 'missing' ? '—' : <span className={`bx-scan-skel${scanning ? ' is-busy' : ''}`} />}
      </span>
      <span className="bx-scan-state">
        {st === 'found' && <Check size={13} />}
        {st ? STATE_TEXT[st] : ''}
      </span>
    </div>
  );
}

// ── /verktyg/skanna-kvitto ───────────────────────────────────────────────
// Kundönskemål, uttryckligt: OCR-läsningen ska ha en EGEN sida — inte
// öppna produktdemot — där vem som helst kan ladda upp ett RIKTIGT kvitto
// och få RIKTIGA, faktiska värden tillbaka, ingen exempeldata. Samma
// familj som de andra gratisverktygen (ToolShell) — precis den sortens
// innehåll ToolShell.jsx:s egen filkommentar beskriver: "användbart för
// någon som INTE är kund ännu, utan att vara reklam".
//
// Tolkningen är samma utils/ocrReceipt.js som appen kör. Första kvittot
// läses av Google Cloud Vision, som i appen (api/ocr-free.js, en gång per
// person), och visar då som i appens kvittovy var på kvittot varje uppgift
// stod. Därefter läses kvitton i webbläsaren (Tesseract). Texterna på
// sidan, i FAQ:n och i integritetspolicyn måste säga exakt det.
export default function ScanReceiptPage() {
  const [status, setStatus] = useState('idle'); // idle | scanning | done | error
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null); // { fields, notReceipt, unreadable }
  const [revealedCount, setRevealedCount] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [beamPct, setBeamPct] = useState(0);
  const [boxes, setBoxes] = useState(null); // { supplier, date, … } andelar av bilden
  const [activeBox, setActiveBox] = useState(null);
  const [engine, setEngine] = useState(null); // 'google' | 'local'
  const [googleLeft, setGoogleLeft] = useState(() => freeGoogleReadLeft());
  const inputRef = useRef(null);
  const runIdRef = useRef(0);
  const captchaRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setStatus('error'); setMessage('Filen måste vara JPG, PNG, WEBP eller PDF.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error'); setMessage('Filen får vara max 10 MB.'); return;
    }
    const runId = ++runIdRef.current;
    setFileName(file.name);
    // Egen React-key per körning (nedan, `key={runId}`) — utan den
    // ANIMERAR CSS-transitionen strålen från sin FÖREGÅENDE viloläge
    // (botten, osynlig efter en klar/misslyckad läsning) upp till det
    // nya startläget, vilket sett ut som att strålen sveper BAKLÄNGES
    // ett ögonblick innan den riktiga, framåtgående sveparbetet börjar.
    // Ett nytt key gör att elementet monteras helt nytt vid varje
    // uppladdning: dess första `top` sätts direkt, ingen transition från
    // ett gammalt läge att glida bort ifrån.
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return file.type === 'application/pdf' ? null : URL.createObjectURL(file); });
    setStatus('scanning'); setMessage('Startar läsning…'); setResult(null); setBeamPct(4); setRevealedCount(0); setMsgIdx(0);
    setBoxes(null); setActiveBox(null); setEngine(null);
    const startedAt = Date.now();
    // Läsningen tar minst lika lång tid som i appen (MIN_SCAN_MS): ett svar
    // på en tiondels sekund ser ut som en gissning. Strålen och texterna
    // fortsätter under tiden, så det syns att dokumentet kontrolleras.
    const ticker = setInterval(() => {
      if (runIdRef.current !== runId) return;
      const pct = 30 + 66 * Math.min(1, (Date.now() - startedAt) / MIN_SCAN_MS);
      setBeamPct(p => Math.max(p, Math.min(96, pct)));
    }, 200);
    const msgTicker = setInterval(() => { if (runIdRef.current === runId) setMsgIdx(n => (n + 1) % SCAN_MESSAGES.length); }, 1100);
    try {
      let read = null;
      if (googleLeft) {
        // Turnstile körs osynligt; utan token (annonsblockerare, ingen
        // nyckel lokalt) försöker servern ändå och läsningen faller tillbaka.
        const token = await Promise.race([
          captchaRef.current?.execute?.().catch(() => null) ?? null,
          new Promise(r => setTimeout(() => r(null), 8000)),
        ]);
        const google = await readFreeWithGoogle(file, token);
        if (runIdRef.current !== runId) return;
        if (google?.text) read = { text: google.text, confidence: null, weakTokens: null, quality: null, lines: google.lines };
        if (google !== null || !freeGoogleReadLeft()) setGoogleLeft(freeGoogleReadLeft());
      }
      if (!read) {
        read = await ocrFile(file, msg => {
          if (runIdRef.current !== runId) return;
          setMessage(msg);
          setBeamPct(p => Math.max(p, stagePctFor(msg)));
        });
      }
      if (runIdRef.current !== runId) return;
      // Exakt samma tolkning som appens kvittovy: leverantören i EU:s
      // momsregister, omräkning från utländsk valuta och samma kontoregel.
      const analysis = await analyzeReceipt({ ...read, layout: read.lines || null }, {
        onMessage: msg => { if (runIdRef.current === runId) setMessage(msg); },
      });
      if (runIdRef.current !== runId) return;
      const wait = MIN_SCAN_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (runIdRef.current !== runId) return;
      setBeamPct(100);
      const { parsed } = analysis;
      const unreadable = Boolean(parsed.unreadable);
      const fields = buildFields(analysis, buildReceiptPlan(analysis, null));
      const found = !unreadable && !parsed.notReceipt ? analysis.boxes : null;
      setBoxes(found);
      setEngine(read.lines !== undefined ? 'google' : 'local');
      setResult({ fields, notReceipt: !unreadable && Boolean(parsed.notReceipt), unreadable, photoHint: analysis.hint });
      setStatus('done');
      fields.forEach((field, i) => {
        setTimeout(() => {
          if (runIdRef.current !== runId) return;
          setRevealedCount(i + 1);
          if (field.found && found?.[BOX_FOR[field.key]]) setActiveBox(BOX_FOR[field.key]);
        }, 250 + i * REVEAL_STEP_MS);
      });
      setTimeout(() => { if (runIdRef.current === runId) setActiveBox(null); }, 250 + fields.length * REVEAL_STEP_MS + 700);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setStatus('error'); setMessage(err?.message || 'Kunde inte läsa kvittot. Prova en tydligare bild.');
    } finally {
      clearInterval(ticker);
      clearInterval(msgTicker);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <ToolShell
      tool={tool}
      metaTitle="Skanna kvitto: läs av kvitton automatiskt | Bokix"
      metaDescription="Ladda upp en bild av ett kvitto och få leverantör, datum, belopp, moms och bokföringskonto direkt. Första kvittot läses av Google, som i Bokix-appen. Gratis, utan konto."
      intro="Ladda upp en bild eller PDF av ett kvitto. Leverantör, datum, belopp, moms och ett förslag på bokföringskonto läses av på några sekunder, och du ser var på kvittot varje uppgift stod."
      calculator={
        <div
          className={`bx-scan-drop${previewUrl ? ' has-image' : ''}${status === 'scanning' ? ' is-scanning' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => { if (status !== 'scanning') inputRef.current?.click(); }}
          role="button" tabIndex={0}
          aria-label="Välj ett kvitto att läsa av"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        >
          <input
            ref={inputRef} type="file" accept={ACCEPTED.join(',')} style={{ display: 'none' }}
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {previewUrl ? (
            // Kvittot visas stort, och strålen sveper över själva bilden i
            // takt med den riktiga läsningen (beamPct, från ocrReceipt.js).
            <div className="bx-scan-image">
              <img src={previewUrl} alt="Ditt kvitto" />
              {activeBox && boxes?.[activeBox] && (
                <span
                  key={activeBox}
                  className="bx-scan-mark" aria-hidden
                  style={{
                    left: `${boxes[activeBox].x * 100}%`, top: `${boxes[activeBox].y * 100}%`,
                    width: `${boxes[activeBox].w * 100}%`, height: `${boxes[activeBox].h * 100}%`,
                  }}
                />
              )}
              <span
                key={runIdRef.current}
                className="bx-scan-beam" aria-hidden
                style={{ top: `${status === 'scanning' ? beamPct : 100}%`, opacity: status === 'scanning' ? 1 : 0 }}
              />
            </div>
          ) : status === 'scanning' ? (
            // PDF utan förhandsbild: ett tomt papper som strålen sveper över.
            <div className="bx-scan-image bx-scan-pdf">
              <span>PDF</span>
              <span key={runIdRef.current} className="bx-scan-beam" aria-hidden style={{ top: `${beamPct}%` }} />
            </div>
          ) : (
            <div className="bx-scan-empty">
              <span className="bx-scan-btn">Välj kvitto</span>
              <span className="bx-scan-hint">eller dra hit en bild eller PDF</span>
            </div>
          )}
          <p className="bx-scan-caption">
            {status === 'scanning' ? SCAN_MESSAGES[msgIdx]
              : status === 'error' ? <span className="bx-scan-error">{message}</span>
                : fileName ? 'Klicka för att läsa ett annat kvitto'
                  : 'JPG, PNG, WEBP eller PDF, högst 10 MB'}
          </p>
          {googleLeft && <Turnstile ref={captchaRef} onDemand />}
        </div>
      }
      result={
        <div className="bx-scan-panel">
          <style>{`
            .bx-scan-drop {
              height: 100%; min-height: 360px; box-sizing: border-box;
              display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
              padding: 20px; border-radius: 16px; cursor: pointer; text-align: center;
              background: var(--mkt-ivory); border: 1.5px dashed var(--mkt-card-border);
              transition: border-color 0.2s ease;
            }
            .bx-scan-drop:hover, .bx-scan-drop:focus-visible { border-color: ${BRAND.green}; outline: none; }
            .bx-scan-drop.has-image, .bx-scan-drop.is-scanning { border-style: solid; }
            .bx-scan-drop.is-scanning { cursor: progress; }
            .bx-scan-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; }
            .bx-scan-btn {
              display: inline-block; padding: 12px 24px; border-radius: 10px;
              background: ${BRAND.green}; color: #fff; font-size: 15px; font-weight: 600;
            }
            .bx-scan-hint { font-size: 14px; color: ${INK_SOFT}; }
            .bx-scan-caption { margin: 0; font-size: 13px; color: ${MUTED}; min-height: 18px; overflow-wrap: anywhere; }
            .bx-scan-error { color: var(--mkt-accent-red-fg); font-weight: 600; }
            .bx-scan-image {
              position: relative; line-height: 0; border-radius: 10px; overflow: hidden;
              box-shadow: 0 1px 2px rgba(15,23,20,0.08), 0 16px 34px -20px rgba(15,23,20,0.45);
            }
            .bx-scan-image img { display: block; max-height: min(420px, 60vh); max-width: 100%; object-fit: contain; }
            .bx-scan-pdf {
              width: 180px; height: 240px; background: #fff; line-height: normal;
              display: flex; align-items: center; justify-content: center;
              font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: #9ca3af;
            }
            .bx-scan-beam {
              position: absolute; left: 0; right: 0; height: 3px; margin-top: -1.5px; pointer-events: none;
              background: linear-gradient(90deg, transparent, #14b8a6 15%, #84cc16 85%, transparent);
              box-shadow: 0 0 16px 3px rgba(20,184,166,0.45);
              transition: top 0.5s cubic-bezier(0.45, 0, 0.55, 1), opacity 0.35s;
            }

            .bx-scan-mark {
              position: absolute; box-sizing: content-box; margin: -3px 0 0 -4px; padding: 3px 4px;
              border: 2px solid #f59e0b; border-radius: 5px; background: rgba(245,158,11,0.16);
              box-shadow: 0 0 0 9999px rgba(15,23,20,0.22); pointer-events: none;
              animation: bxMarkIn 0.18s ease-out both;
            }
            @keyframes bxMarkIn { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: none; } }
            .bx-scan-row.has-box { cursor: default; }
            .bx-scan-row.has-box:hover .bx-scan-label { color: ${INK}; }
            .bx-scan-engine { display: flex; gap: 10px; align-items: flex-start; margin: 18px 0 0; padding: 12px 14px; border-radius: 12px; background: var(--mkt-ivory); border: 1px solid var(--mkt-border-soft); font-size: 13.5px; line-height: 1.55; color: ${INK_SOFT}; }
            .bx-scan-engine strong { color: ${INK}; }
            .bx-scan-panel { padding: clamp(24px, 4vw, 34px); display: flex; flex-direction: column; border-left: 1px solid var(--mkt-border-soft); }
            .bx-scan-title { margin: 0 0 6px; font-size: 17px; font-weight: 700; color: ${INK}; }
            .bx-scan-sub { margin: 0 0 14px; font-size: 13.5px; color: ${MUTED}; line-height: 1.55; }
            .bx-scan-row {
              display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 12px; align-items: center;
              padding: 13px 0; border-top: 1px solid var(--mkt-border-soft);
            }
            .bx-scan-label { font-size: 13.5px; color: ${MUTED}; }
            .bx-scan-value { font-size: 15px; font-weight: 600; color: ${INK}; min-width: 0; overflow-wrap: anywhere; }
            .bx-scan-value small { display: block; margin-top: 2px; font-size: 12px; font-weight: 500; color: ${MUTED}; }
            .bx-scan-row.is-missing .bx-scan-value { color: ${MUTED}; font-weight: 500; }

            .bx-scan-in { animation: bxScanIn 0.4s cubic-bezier(0.22, 1, 0.36, 1); }
            @keyframes bxScanIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
            .bx-scan-skel { display: block; height: 9px; width: 62%; border-radius: 5px; background: var(--mkt-border-soft); }
            .bx-scan-skel.is-busy { animation: bxScanPulse 1.2s ease-in-out infinite; }
            @keyframes bxScanPulse { 50% { opacity: 0.45; } }
            .bx-scan-state { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; white-space: nowrap; color: ${MUTED}; }
            .bx-scan-row.is-found .bx-scan-state { color: var(--mkt-accent-green-fg); }
            .bx-scan-row.is-guess .bx-scan-state, .bx-scan-row.is-suggest .bx-scan-state { color: #b45309; }
            html[data-theme="dark"] .bx-scan-row.is-guess .bx-scan-state, html[data-theme="dark"] .bx-scan-row.is-suggest .bx-scan-state { color: #fbbf24; }
            .bx-scan-note { margin: 16px 0 0; font-size: 13px; line-height: 1.6; color: ${INK_SOFT}; }
            .bx-scan-note.is-warn { color: #b45309; font-weight: 600; }
            html[data-theme="dark"] .bx-scan-note.is-warn { color: #fbbf24; }
            .bx-scan-foot { margin: auto 0 0; padding-top: 18px; font-size: 12.5px; line-height: 1.6; color: ${MUTED}; }

            @media (max-width: 760px) {
              .bx-scan-drop { min-height: 240px; }
              .bx-scan-panel { border-left: none; border-top: 1px solid var(--mkt-border-soft); }
              .bx-scan-row { grid-template-columns: 80px minmax(0, 1fr) auto; }
            }
            @media (prefers-reduced-motion: reduce) {
              .bx-scan-beam { transition: opacity 0.35s; }
              .bx-scan-in, .bx-scan-skel.is-busy, .bx-scan-mark { animation: none; }
            }
          `}</style>

          <h2 className="bx-scan-title">Ny utgift</h2>
          <p className="bx-scan-sub">
            {status === 'done' ? 'Det här läste Bokix av från kvittot.' : 'Fälten fylls i från kvittot du väljer.'}
          </p>

          {/* Samma bedömning som appen: en gissning ser aldrig ut som en
              säker avläsning, och ett dokument som inte är ett kvitto fylls
              aldrig i. */}
          <div>
            {FIELD_LABELS.map((label, i) => (
              <ScanRow
                key={label} label={label}
                field={status === 'done' && result ? result.fields[i] : null}
                revealed={status === 'done' && i < revealedCount}
                scanning={status === 'scanning'}
                hasBox={Boolean(status === 'done' && result && boxes?.[BOX_FOR[result.fields[i].key]])}
                onPoint={on => setActiveBox(on ? BOX_FOR[result.fields[i].key] : null)}
              />
            ))}
          </div>

          {status === 'done' && result && revealedCount >= result.fields.length && (
            (result.notReceipt || result.unreadable || result.photoHint) ? (
              <p className="bx-scan-note is-warn">
                {result.unreadable
                  ? (photoHintText(result.photoHint) || 'Ingen text kunde läsas ur filen. Prova en skarpare bild eller en PDF.')
                  : result.notReceipt
                    ? 'Det här ser inte ut som ett kvitto eller en faktura, så inget har fyllts i.'
                    : photoHintText(result.photoHint)}
              </p>
            ) : (
              <p className="bx-scan-note">
                Avläst betyder att det stod tydligt på kvittot. Kontrollera betyder att det är ett förslag du bör titta på.
              </p>
            )
          )}

          {status === 'done' && engine === 'google' && result && revealedCount >= result.fields.length && (
            <p className="bx-scan-engine">
              <span><strong>Läst av Google, som i appen.</strong>{boxes ? ' Peka på en rad så ser du var den stod på kvittot.' : ''} Nästa kvitto läses i din webbläsare.</span>
            </p>
          )}

          <p className="bx-scan-foot">
            {status === 'done' && engine === 'google'
              ? 'Kvittot lästes av Google Cloud Vision inom EU och sparades inte, varken hos Google eller hos oss.'
              : googleLeft
                ? 'Ditt första kvitto läses av Google Cloud Vision inom EU och sparas inte. Sedan läses kvitton i din webbläsare.'
                : 'Kvittot läses i din webbläsare och sparas ingenstans.'}
          </p>
        </div>
      }
      steps={[
        {
          title: 'Första kvittot läses av Google, som i appen',
          body: 'Ditt första kvitto läses av Google Cloud Vision, samma läsning som Bokix-appen använder. Det sker inom EU och Google sparar inte bilden. Du ser också var på kvittot varje uppgift stod. Efter det läses kvitton direkt i din webbläsare (Tesseract.js), utan att skickas någonstans.',
        },
        {
          title: 'Texten tolkas rad för rad',
          body: 'Datum, nummer, ett totalbelopp och momssatsen hittas genom mönster och nyckelord (”totalt”, ”att betala”, ”moms”), inte bara det första talet som råkar stå på kvittot. Först kontrolleras att dokumentet överhuvudtaget är ett kvitto eller en faktura.',
        },
        {
          title: 'Kontot föreslås utifrån vem som sålde',
          body: 'Känns handlaren igen (en bensinmack, en matbutik, ett vanligt molntjänstabonnemang) föreslås ett bokföringskonto också. Ett okänt namn lämnas tomt i stället för att gissas fel.',
        },
      ]}
      faq={[
        {
          q: 'Sparas min kvittobild eller mina uppgifter någonstans?',
          a: 'Nej. Ditt första kvitto skickas till Google Cloud Vision inom EU för att läsas och sparas inte där, och inte hos oss. Därefter läses kvitton helt i din webbläsare. Varken bilden eller resultatet sparas, och stänger du sidan är det borta.',
        },
        {
          q: 'Varför bara ett kvitto med Google?',
          a: 'Googles läsning kostar för varje kvitto, så på den här gratissidan får varje besökare en. Vi räknar på din IP-adress, som sparas krypterat (hashad) i högst ett år och aldrig i klartext. I Bokix läses alla kvitton med Google.',
        },
        {
          q: 'Vilka filformat fungerar?',
          a: 'JPG, PNG, WEBP och PDF (både digitala PDF-fakturor och skannade/fotograferade kvitton), max 10 MB.',
        },
        {
          q: 'Är avläsningen alltid rätt?',
          a: 'Nej, och det ska den inte låtsas vara. Ett suddigt kvitto eller en ovanlig layout kan ge fel eller tomma fält — precis som i appen är varje värde ett förslag att kontrollera, aldrig ett facit som bokförs blint.',
        },
        {
          q: 'Vad händer om jag laddar upp något som inte är ett kvitto?',
          a: 'Då fylls ingenting i. Ett CV, ett brev eller en bild utan text ger "Hittades inte" på alla fält, i stället för en gissning som ser ut som ett kvitto.',
        },
        {
          q: 'Bokförs kvittot åt mig här?',
          a: 'Nej, den här sidan bara läser av och visar värdena. I ett Bokix-konto blir samma läsning en färdig kvittopost med underlaget kvar, klar att granska och bokföra.',
        },
      ]}
    >
      <ToolNote title="Kontoförslaget är en startpunkt, inte ett facit">
        Kontot föreslås bara för handlare Bokix känner igen (kända kedjor inom drivmedel, dagligvaror, molntjänster m.fl.) — ett okänt kvitto lämnar fältet tomt i stället för att gissa. I appen är det alltid granskningsbart och redigerbart innan något bokförs.
      </ToolNote>
    </ToolShell>
  );
}
