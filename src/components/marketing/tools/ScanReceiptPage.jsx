import React, { useRef, useState } from 'react';
import { UploadCloud, FileWarning, Check, AlertCircle, Minus } from '../../icons';
import { INK, MUTED, CARD_BORDER } from '../marketingTokens';
import { BRAND } from '../../../utils/brandColors';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolResultPanel, ToolNote } from './ToolShell';
import { ocrFile, parseReceiptText } from '../../../utils/ocrReceipt';
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

// Samma sex fält, samma ordning och samma tre lägen som kvittovyn i appen
// (Expenses.jsx): "Avläst" när det stod tydligt i dokumentet, "Kontrollera"
// när det är en rimlig gissning, "Hittades inte" när det saknas. Ett dokument
// som inte är ett kvitto eller en faktura (ett CV, ett brev) fyller ingenting
// i, och en tom avläsning gör detsamma. Avläsningen själv, parseReceiptText,
// är samma funktion som appen kör.
function fmtAmount(n) {
  return Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildFields(parsed, unreadable) {
  const nr = unreadable || Boolean(parsed.notReceipt);
  const has = (v) => !nr && v !== null && v !== undefined && v !== '' && v !== false;
  const currency = parsed.currency && parsed.currency !== 'SEK' ? parsed.currency : 'kr';
  return [
    { key: 'supplier', label: 'Leverantör', found: has(parsed.supplier), state: parsed.supplierMatched ? 'found' : 'guess', value: parsed.supplier },
    { key: 'date', label: 'Datum', found: has(parsed.date), state: parsed.dateGuessed ? 'guess' : 'found', value: parsed.date },
    { key: 'receiptNumber', label: 'Nummer', found: has(parsed.receiptNumber), state: 'found', value: parsed.receiptNumber, note: parsed.receiptNumberLabel || '' },
    { key: 'amount', label: 'Belopp', found: has(parsed.amount) && Number(parsed.amount) !== 0, state: parsed.amountGuessed ? 'guess' : 'found', value: parsed.amount != null ? `${fmtAmount(parsed.amount)} ${currency}` : '' },
    { key: 'vatRate', label: 'Moms', found: has(parsed.vatRate), state: parsed.vatRateGuessed ? 'guess' : 'found', value: parsed.vatRate != null ? `${parsed.vatRate} %` : '', note: parsed.vatRateGuessed ? 'Antagen, stod inte tydligt' : '' },
    { key: 'costAccount', label: 'Konto', found: has(parsed.accountCode), state: parsed.accountGuessed ? 'guess' : 'found', value: parsed.accountCode ? `${parsed.accountCode} ${ACCOUNT_NAME[parsed.accountCode] || ''}`.trim() : '' },
  ];
}

const STATE_TEXT = { found: 'Avläst', guess: 'Kontrollera', missing: 'Hittades inte' };
const STATE_STYLE = {
  found: { bg: 'rgba(132,204,22,0.22)', fg: '#a3e635', Icon: Check },
  guess: { bg: 'rgba(251,191,36,0.2)', fg: '#fbbf24', Icon: AlertCircle },
  missing: { bg: 'rgba(255,255,255,0.1)', fg: 'rgba(255,255,255,0.5)', Icon: Minus },
};

function ScanRow({ field, revealed }) {
  const st = !revealed ? null : (field.found ? field.state : 'missing');
  const style = st ? STATE_STYLE[st] : null;
  const Icon = style?.Icon;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: '12px', alignItems: 'center', padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', background: style ? style.bg : 'rgba(255,255,255,0.06)', color: style ? style.fg : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: style ? 'none' : '1.5px dashed rgba(255,255,255,0.25)' }}>
        {Icon ? <Icon size={11} strokeWidth={3} /> : null}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>
          {field.label}{revealed && field.found && field.note ? <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}> · {field.note}</span> : null}
        </div>
        <div style={{ fontSize: '15.5px', fontWeight: 700, color: st === 'missing' || !st ? 'rgba(255,255,255,0.32)' : 'white', overflowWrap: 'anywhere', marginTop: '1px' }}>
          {revealed && field.found ? field.value : '—'}
        </div>
      </div>
      <span style={{ fontSize: '11.5px', fontWeight: 800, color: style ? style.fg : 'transparent', whiteSpace: 'nowrap' }}>{st ? STATE_TEXT[st] : ''}</span>
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
// Kör exakt samma utils/ocrReceipt.js som Expenses.jsx i den inloggade
// appen — ingen egen kopia av tolkningslogiken. Allt sker i webbläsaren
// (Tesseract.js WebAssembly, samma sak Expenses.jsx redan gör); ingen
// bild skickas någonsin till en server eller sparas — se ToolNote i
// botten och FAQ:n, båda måste hålla den linjen ärlig.
export default function ScanReceiptPage() {
  const [status, setStatus] = useState('idle'); // idle | scanning | done | error
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null); // { fields, notReceipt, unreadable }
  const [revealedCount, setRevealedCount] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [beamPct, setBeamPct] = useState(0);
  const inputRef = useRef(null);
  const runIdRef = useRef(0);

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
      const { text, confidence, weakTokens, quality } = await ocrFile(file, msg => {
        if (runIdRef.current !== runId) return;
        setMessage(msg);
        setBeamPct(p => Math.max(p, stagePctFor(msg)));
      });
      if (runIdRef.current !== runId) return;
      const wait = MIN_SCAN_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (runIdRef.current !== runId) return;
      setBeamPct(100);
      const parsed = parseReceiptText(text, { confidence, weakTokens });
      // unreadable/notReceipt kommer nu från samma delade logik som appens
      // kvitto- och verifikationsvyer (ocrReceipt.js), i stället för en egen
      // kopia av gränsen här — se isUnreadableText/classifyDocument.
      const unreadable = Boolean(parsed.unreadable);
      const fields = buildFields(parsed, unreadable);
      // Rådet om fotot (suddigt, mörkt, för långt bort) visas bara när bilden
      // faktiskt stod i vägen — samma regel som i appens kvittovy.
      const photoHint = (quality?.advice && (parsed.notReceipt || !parsed.amount || parsed.amountGuessed || parsed.vatMismatch))
        ? quality.advice : null;
      setResult({ fields, notReceipt: !unreadable && Boolean(parsed.notReceipt), unreadable, photoHint });
      setStatus('done');
      fields.forEach((_, i) => {
        setTimeout(() => { if (runIdRef.current === runId) setRevealedCount(i + 1); }, 250 + i * REVEAL_STEP_MS);
      });
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
      metaTitle="Skanna kvitto — läs av kvitton automatiskt (OCR) | Bokix"
      metaDescription="Ladda upp en bild av ett kvitto och få datum, belopp, moms och bokföringskonto direkt — läses av i din egen webbläsare, ingenting laddas upp till en server."
      intro="Ladda upp en bild eller PDF av ett kvitto. Datum, belopp, momssats och ett förslag på bokföringskonto läses av på några sekunder — direkt i din webbläsare."
      calculator={
        <>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            style={{
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '30px 20px', borderRadius: '14px', border: `1.5px dashed ${CARD_BORDER}`,
              background: 'var(--mkt-ivory)', cursor: 'pointer', textAlign: 'center', minHeight: '160px',
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 4px 14px -6px rgba(28,36,32,0.35)' }} />
            ) : (
              <UploadCloud size={26} color={BRAND.greenDark} />
            )}
            <div style={{ fontSize: '14px', fontWeight: 700, color: INK }}>
              {fileName || 'Dra och släpp, eller klicka för att välja'}
            </div>
            <div style={{ fontSize: '12px', color: MUTED }}>JPG, PNG, WEBP eller PDF — max 10 MB</div>
            <input
              ref={inputRef} type="file" accept={ACCEPTED.join(',')} style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />

            {/* Samma stråle som startsidans "Kvitton läser sig själva"
                (marketing/ReceiptFlow.jsx) — kundens egna ord: den
                animationen är "super cool", gör likadan här i stället för
                en procentsiffra som räknar upp. Skillnaden mot
                ReceiptFlow: den där loopar på en fast timer med
                påhittad exempeldata, den här styrs av `top` i EKTA
                läsframsteg (beamPct, satt från ocrReceipt.js:s riktiga
                onProgress-meddelanden via stagePctFor ovan) — strålen
                rör sig alltså i takt med att DIN bild faktiskt läses,
                svepande hela vägen till botten och tonar bort exakt när
                resultatet är klart, aldrig innan. */}
            <span
              key={runIdRef.current}
              className="bx-scan-beam" aria-hidden
              style={{ top: `${status === 'scanning' ? beamPct : 100}%`, opacity: status === 'scanning' ? 1 : 0 }}
            />
          </div>

          {status === 'scanning' && (
            <p style={{ fontSize: '13px', color: MUTED, marginTop: '14px' }}>
              {SCAN_MESSAGES[msgIdx]}
            </p>
          )}
          {status === 'error' && (
            <p style={{ fontSize: '13px', color: '#b91c1c', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <FileWarning size={14} /> {message}
            </p>
          )}

          <style>{`
            .bx-scan-beam {
              position: absolute; left: 4%; right: 4%; height: 20px; margin-top: -10px;
              border-radius: 4px; pointer-events: none;
              background: linear-gradient(90deg, transparent, rgba(14,165,233,0.55), rgba(20,184,166,0.75), rgba(132,204,22,0.55), transparent);
              filter: blur(1.5px);
              box-shadow: 0 0 14px 2px rgba(20,184,166,0.45);
              transition: top 0.5s cubic-bezier(0.45, 0, 0.55, 1), opacity 0.35s;
            }
            @media (prefers-reduced-motion: reduce) {
              .bx-scan-beam { transition: opacity 0.35s; }
            }
          `}</style>
        </>
      }
      result={
        <ToolResultPanel
          title={status === 'done' ? 'Vad vi läste av' : 'Resultat'}
          footnote="Bilden lämnar aldrig din webbläsare — ingenting laddas upp eller sparas här. Vill du bokföra kvittot på riktigt, med underlaget kvar på verifikationen, gör Bokix det automatiskt."
        >
          {status === 'done' && result ? (
            <>
              {/* Samma bedömning som appen: en gissning ser aldrig ut som en
                  säker avläsning, och ett dokument som inte är ett kvitto
                  fylls aldrig i. */}
              <div>
                {result.fields.map((field, i) => (
                  <ScanRow key={field.key} field={field} revealed={i < revealedCount} />
                ))}
              </div>
              {revealedCount >= result.fields.length && (
                <div style={{ marginTop: '16px' }}>
                  {(result.notReceipt || result.unreadable || result.photoHint) ? (
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#fbbf24', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{result.unreadable
                        ? (photoHintText(result.photoHint) || 'Ingen text kunde läsas ur filen. Prova en skarpare bild eller en PDF.')
                        : result.notReceipt
                          ? 'Det här ser inte ut som ett kvitto eller en faktura, så inget har fyllts i.'
                          : photoHintText(result.photoHint)}</span>
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
                      Avläst betyder att det stod tydligt i dokumentet. Kontrollera betyder en rimlig gissning som du bör titta på. Hittades inte lämnas tomt i stället för att gissas.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>
              Ladda upp ett kvitto eller en faktura till vänster så visas leverantör, datum, nummer, belopp, moms och ett kontoförslag här.
            </p>
          )}
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Bilden stannar i din webbläsare',
          body: 'Läsningen körs lokalt (Tesseract.js WebAssembly) — kvittot skickas aldrig till en server och sparas ingenstans. Stänger du sidan är det borta.',
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
          a: 'Nej. Läsningen körs helt i din egen webbläsare och ingenting skickas till en server eller sparas — varken bilden eller det avlästa resultatet. Stänger eller laddar du om sidan är det borta.',
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
