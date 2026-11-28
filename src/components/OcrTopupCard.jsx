import React, { useEffect, useState } from 'react';
import { subscriptionCardAction } from '../stripeApi';

// Kvittoavläsningar per månad och köp av fler (2026-11-28). Planens gräns
// (Solo 100, Team 300, Handel 1 000) plus det som köpts den här månaden.
// Köpet läggs på nästa faktura och gäller direkt (api/stripe/_ocrTopups.js).
export default function OcrTopupCard({ companyKey = '' }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    subscriptionCardAction('ocr-usage', companyKey || null).then(r => alive && setInfo(r)).catch(() => alive && setInfo({ plan: null }));
    return () => { alive = false; };
  }, [companyKey]);

  if (!info?.plan || !info.limit) return null;
  const total = info.limit + (info.extra || 0);
  const buy = async () => {
    if (!window.confirm(`Köpa ${info.reads} extra kvittoavläsningar för ${info.price} kr? Beloppet läggs på nästa faktura och avläsningarna gäller resten av månaden.`)) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await subscriptionCardAction('ocr-topup', companyKey || null);
      setInfo(i => ({ ...i, extra: r.extra }));
      setNote({ ok: true, text: `Klart. ${info.reads} extra avläsningar gäller nu, ${info.price} kr läggs på nästa faktura.` });
    } catch (err) {
      setNote({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ocr-topup">
      <div className="ocr-topup-main">
        <div>
          <h4>Kvittoavläsningar</h4>
          <p><b>{total.toLocaleString('sv-SE')}</b> per månad i {info.planName}{info.extra ? ` (varav ${info.extra.toLocaleString('sv-SE')} köpta den här månaden)` : ''}. Räknas om den 1:a.</p>
        </div>
        <button type="button" className="ocr-topup-btn" onClick={buy} disabled={busy}>{busy ? 'Köper …' : `Köp ${info.reads} till för ${info.price} kr`}</button>
      </div>
      <p className="ocr-topup-small">När avläsningarna tar slut sparas kvittot ändå, du fyller bara i det själv.</p>
      {note && <p className={note.ok ? 'ocr-topup-ok' : 'ocr-topup-err'}>{note.text}</p>}
    </div>
  );
}
