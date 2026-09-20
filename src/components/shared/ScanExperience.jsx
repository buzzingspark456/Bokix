import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, Minus, ScanLine } from '../icons';

// Avläsningsupplevelsen som kvitton och verifikationer delar: skannerlinjen
// över dokumentet och checklistan över vad som hittades. Här ligger också
// tiderna, så att båda ställena känns likadana.

// Läsningen tar minst så här lång tid, även när texten hinner bli klar
// fortare (en digital PDF läses på några hundra millisekunder). Ett svar på
// en tiondels sekund ser ut som en gissning; en tydlig genomläsning där
// skannerlinjen hinner svepa några varv över kvittot känns som det den är,
// en kontrollerad avläsning, och ger användaren tid att se att något händer.
export const MIN_SCAN_MS = 5000;
// Fälten fylls i ett i taget med den här fördröjningen, i stället för alla
// på en gång, så att man ser vad som hittades och i vilken ordning.
export const REVEAL_STEP_MS = 280;
// Ett dokument som redan lästs tidigare (text i cachen) behöver ingen lång
// genomläsning, bara en kort uppvisning.
export const CACHED_SCAN_MS = 900;

// Vad skannern säger medan den läser. De beskriver vad avläsningen faktiskt
// gör i tur och ordning, och byts var 1,1 sekund.
export const SCAN_MESSAGES = [
  'Läser texten på kvittot…',
  'Letar efter leverantören…',
  'Läser datum och nummer…',
  'Läser beloppet…',
  'Kontrollerar momsen mot beloppen…',
  'Väljer konto…',
];

// Fälten som avläsningen försöker fylla i, i den ordning de visas upp.
export const OCR_ITEMS = [
  { key: 'supplier', label: 'Leverantör' },
  { key: 'date', label: 'Datum' },
  { key: 'receiptNumber', label: 'Nummer' },
  { key: 'amount', label: 'Belopp' },
  { key: 'vatRate', label: 'Moms' },
  { key: 'costAccount', label: 'Konto' },
];

/** Skannerlinjen som sveper uppifrån och ned över dokumentet medan det läses. */
export function ScanOverlay({ detail, flush = false }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % SCAN_MESSAGES.length), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`rc-scan${flush ? ' rc-scan-flush' : ''}`} role="status" aria-live="polite">
      <span className="rc-scan-corner rc-scan-tl" />
      <span className="rc-scan-corner rc-scan-tr" />
      <span className="rc-scan-corner rc-scan-bl" />
      <span className="rc-scan-corner rc-scan-br" />
      <div className="rc-scan-line" />
      <div className="rc-scan-pill">
        <ScanLine size={16} />
        <div className="rc-scan-text">
          <div className="rc-scan-msg" key={i}>{SCAN_MESSAGES[i]}</div>
          {detail && <div className="rc-scan-detail">{detail}</div>}
          <div className="rc-scan-bar"><span /></div>
        </div>
      </div>
    </div>
  );
}

/** Checklistan över vad som hittades, som fylls i medan fälten visas upp. */
export function OcrChecklist({ scanning, revealed, items = OCR_ITEMS }) {
  return (
    <div className="rc-ocr-list" aria-live="polite">
      {items.map(item => {
        const st = revealed[item.key];
        return (
          <div key={item.key} className={`rc-ocr-item${st ? ` rc-ocr-${st === 'history' ? 'found' : st}` : ''}`}>
            <span className="rc-ocr-icon">
              {st === 'found' || st === 'history' ? <Check size={12} strokeWidth={3} />
                : st === 'guess' ? <AlertCircle size={12} strokeWidth={2.5} />
                  : st === 'missing' ? <Minus size={12} strokeWidth={3} />
                    : <span className={scanning ? 'rc-ocr-spin' : 'rc-ocr-wait'} />}
            </span>
            <span className="rc-ocr-label">{item.label}</span>
            <span className="rc-ocr-state">{st === 'found' ? 'Avläst' : st === 'history' ? 'Som tidigare' : st === 'guess' ? 'Kontrollera' : st === 'missing' ? 'Hittades inte' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
