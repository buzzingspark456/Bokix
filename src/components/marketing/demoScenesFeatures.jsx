import React from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Eye, Info, Lock, Mail, MessageSquare, PlayCircle, Plus, ReceiptText, RotateCcw, Send, Sparkles, Trash2, Upload, X } from '../icons';
import { Shell, Top, SearchBox, Toast, DownloadBar, Doc, ReviewItem, ModalClose } from './demoApp';

// ── Scenerna för /funktioner, uppspelade i DemoPlayer. Varje steg är en
// ritad kopia av den RIKTIGA sidan i appen (se demoApp.jsx): kvittots
// detaljvy, Bokföring, Granskning, Kundfakturor, Skatt och bokslut,
// Anställda och lön. Allt som händer i scenerna finns i produkten; namn
// och belopp är exempel.

const d = (s) => ({ '--d': `${s}s` });
const c = (s) => ({ '--c': `${s}s` });
const dc = (a, b) => ({ '--d': `${a}s`, '--c': `${b}s` });

const Pill = ({ kind = 'ok', children, style, className = '' }) => <span className={`ax-pill ax-${kind} ${className}`} style={style}>{children}</span>;
const Typed = ({ text, at, dur = 0.6 }) => <span className="dp-type" style={{ '--n': text.length, '--t': `${dur}s`, ...d(at) }}>{text}</span>;

// ── Bokföring ────────────────────────────────────────────────────────────

const KVITTO_CSS = `
  .axk { position: absolute; inset: 0; display: flex; background: var(--ax-card); }
  .axk-photo { flex: 1; background: #141c17; display: flex; flex-direction: column; min-width: 0; }
  .axk-photo-head { display: flex; align-items: center; gap: 7px; padding: 9px 14px; color: rgba(255,255,255,0.75); font-size: 11px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .axk-photo-body { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }
  .axk-form { width: 54%; display: flex; flex-direction: column; border-left: 1px solid var(--ax-border); }
  .axk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .axk-tiles { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--ax-border); border-radius: 8px; background: var(--ax-soft); }
  .axk-tiles > div { padding: 6px 9px; }
  .axk-tiles > div + div { border-left: 1px solid var(--ax-border); }
  .axk-k { font-size: 8.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--ax-muted); text-transform: uppercase; }
  .axk-fields .ax-field { min-height: 25px; padding: 4px 9px; }
  .axk-fields .ax-label { margin-bottom: 3px; }
  .axk-fields .ax-chip { padding: 4px 6px; }
  @media (max-width: 640px) {
    .axk { flex-direction: column; }
    .axk-photo { flex: 0 0 112px; min-height: 0; overflow: hidden; }
    .axk-photo-head { display: none; }
    .axk-photo .ax-receipt { transform: rotate(-2.5deg) scale(0.5); }
    .axk-tiles, .axk-sub { display: none !important; }
    .axk-form { width: 100%; border-left: none; flex: 1; min-height: 0; }
  }
`;

const KvittoScene = (
  <div className="ax">
    <style>{KVITTO_CSS}</style>
    <div className="axk">
      <div className="axk-photo">
        <div className="axk-photo-head"><Doc /> IMG_4821.jpg</div>
        <div className="axk-photo-body">
          <div className="ax-receipt dp-in" style={d(0.1)}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}><span className="ax-receipt-hl" style={d(2.1)}>EXEMPELMACKEN</span></div>
            <div style={{ textAlign: 'center', fontSize: 9 }}>Kungsgatan 12, Göteborg</div>
            <div style={{ marginTop: 6 }}><span className="ax-receipt-hl" style={d(1.5)}>2026-09-24</span> 14:12</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diesel 38,2 l</span><span>890,00</span></div>
            <div style={{ borderTop: '1px dashed #999', margin: '5px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>TOTALT</span><span className="ax-receipt-hl" style={d(1.8)}>890,00</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Moms 25 %</span><span className="ax-receipt-hl" style={d(2.5)}>178,00</span></div>
            <div style={{ marginTop: 6, textAlign: 'center', fontSize: 9 }}>Kort ****4821</div>
            <span className="dp-scan" style={d(0.5)} />
          </div>
        </div>
      </div>
      <div className="axk-form">
        <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--ax-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="ax-b" style={{ fontSize: 13.5 }}>Kvittodetaljer</div><div className="ax-m axk-sub" style={{ fontSize: 10.5 }}>Fyll i uppgifterna från kvittot</div></div>
          <Pill kind="warn">Ej hanterad</Pill>
        </div>
        <div className="axk-fields" style={{ padding: '9px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="axk-grid">
            <div><div className="ax-label">Datum</div><div className="ax-field"><Typed text="2026-09-24" at={1.6} /></div></div>
            <div><div className="ax-label">Belopp ink moms (kr)</div><div className="ax-field"><Typed text="890,00" at={1.9} dur={0.4} /></div></div>
          </div>
          <div><div className="ax-label">Inköpsställe / Leverantör</div><div className="ax-field"><Typed text="Exempelmacken" at={2.2} dur={0.4} /></div></div>
          <div>
            <div className="ax-label">Momssats</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
              <span className="dp-swap" style={{ display: 'grid', justifyItems: 'stretch' }}><span className="ax-chip">25%</span><span className="ax-chip on dp-pop" style={d(2.6)}>25%</span></span>
              {['12%', '6%', '0%', 'Flera'].map(x => <span key={x} className="ax-chip">{x}</span>)}
            </div>
          </div>
          <div className="axk-tiles">
            {[['Netto', '712,00 kr'], ['Moms 25%', '178,00 kr'], ['Totalt', '890,00 kr']].map(([k, v]) => (
              <div key={k}><div className="axk-k">{k}</div><div className="ax-b dp-in" style={d(2.9)}>{v}</div></div>
            ))}
          </div>
          <div>
            <div className="ax-label">Konto</div>
            <div className="ax-field" style={{ justifyContent: 'space-between' }}>
              <span className="dp-swap" style={{ justifyItems: 'start' }}>
                <span className="ax-m dp-gone" style={d(4)}>Sök konto, t.ex. 6110 eller kontorsmaterial</span>
                <span className="ax-b dp-in" style={d(4.1)}>5611 Drivmedel för personbilar</span>
              </span>
            </div>
            <div className="dp-in" style={{ ...d(3.3), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, padding: '6px 9px', borderRadius: 7, background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', fontSize: 11 }}>
              <span>Förslag: <b>5611 Drivmedel</b> · samma som förra gången</span>
              <span className="ax-btn ax-click" style={c(3.9)}>Använd</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '9px 14px', borderTop: '1px solid var(--ax-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <span className="ax-b" style={{ marginRight: 'auto', fontSize: 11, color: 'var(--ax-r-tx)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={11} /> Ta bort</span>
          <span className="ax-btn-ghost">Stäng</span>
          <span className="ax-btn ax-click" style={c(5)}>Spara och bokför</span>
        </div>
      </div>
    </div>
    <Toast delay={5.4} top>Kvittot är bokfört som A034</Toast>
  </div>
);

const VER_COLS = { gridTemplateColumns: '14px 84px 74px 1fr 80px 58px 44px' };
const Ratta = () => <span className="ax-btn-ghost ax-hide-sm" style={{ padding: '2px 6px', fontSize: 9.5, justifySelf: 'end' }}><RotateCcw size={9} /> Rätta</span>;
const VerRow = ({ v, date, text, amount, style, className = '' }) => (
  <div className={`ax-tr m-ver ${className}`} style={{ ...VER_COLS, ...style }}>
    <ChevronRight size={11} className="ax-m" /><span className="ax-b">{v}</span><span className="ax-s ax-hide-sm">{date}</span><span>{text}</span><span className="ax-num ax-b">{amount}</span><Pill className="ax-hide-sm">Bokförd</Pill><Ratta />
  </div>
);
const LEDGER_COLS = { gridTemplateColumns: '44px 1fr 70px 70px', padding: '0 10px' };

const BokforingScene = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" how action={<><span className="ax-next ax-hide-sm">Nästa: <b>A035</b></span><span className="ax-btn"><Plus size={11} /> Ny verifikation</span></>} tabs={['Verifikationer', 'Kontoplan']} on="Verifikationer" />
    <div className="ax-bar"><SearchBox text="Sök verifikation, text, belopp…" /><span className="ax-btn-ghost ax-hide-sm">Alla serier <ChevronDown size={10} /></span><span className="ax-btn-ghost ax-hide-sm">Alla månader <ChevronDown size={10} /></span><span className="ax-seg ax-hide-sm"><span className="on">Grupperat</span><span>Lista</span></span></div>
    <div className="ax-tr ax-th m-ver" style={VER_COLS}><span /><span>Verifikation</span><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span className="ax-hide-sm">Status</span><span className="ax-hide-sm" /></div>
    <div className="ax-month"><span>September 2026</span><span>8 verifikationer · 162 046 kr</span></div>
    <div className="dp-slide dp-flash" style={d(0.6)}>
      <div className="ax-tr m-ver" style={{ ...VER_COLS, background: 'var(--ax-g-bg)' }}>
        <ChevronDown size={11} className="dp-in" style={d(1.6)} /><span className="ax-b">A034</span><span className="ax-s ax-hide-sm">2026-09-24</span><span>Exempelmacken</span><span className="ax-num ax-b">890,00</span><Pill className="ax-hide-sm">Bokförd</Pill><Ratta />
      </div>
      <div className="dp-in" style={{ ...d(1.8), padding: '7px 18px 9px 32px', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-g-bg)', fontSize: 11 }}>
        <div className="ax-b ax-s" style={{ fontSize: 10, marginBottom: 3 }}>Så här bokfördes det</div>
        {[['5611', 'Drivmedel för personbilar', '712,00 kr'], ['2641', 'Ingående moms att dra av', '178,00 kr'], ['1930', 'Pengar ut från Företagskonto', '890,00 kr']].map(([k, t, v], i) => (
          <div key={k} className="dp-slide" style={{ ...d(2.1 + i * 0.25), display: 'grid', gridTemplateColumns: '34px minmax(0, 180px) auto', gap: 6, lineHeight: 1.75 }}><span className="ax-m">{k}</span><span>{t}</span><span className="ax-b ax-num">{v}</span></div>
        ))}
        <div className="dp-in ax-hide-sm" style={{ ...d(2.9), marginTop: 6, borderRadius: 7, overflow: 'hidden', background: 'var(--ax-card)' }}>
          <div className="ax-tr ax-th" style={{ ...LEDGER_COLS, minHeight: 20, fontSize: 8.5 }}><span>Konto</span><span>Kontonamn</span><span className="ax-num">Debet</span><span className="ax-num">Kredit</span></div>
          {[['5611', 'Drivmedel för personbilar', '712,00', ''], ['2641', 'Debiterad ingående moms', '178,00', ''], ['1930', 'Företagskonto', '', '890,00']].map(([k, n, de, kr]) => (
            <div key={k} className="ax-tr" style={{ ...LEDGER_COLS, minHeight: 21, fontSize: 10.5 }}><span className="ax-b">{k}</span><span className="ax-s">{n}</span><span className="ax-num">{de}</span><span className="ax-num">{kr}</span></div>
          ))}
          <div className="ax-tr ax-b" style={{ ...LEDGER_COLS, minHeight: 21, fontSize: 10.5, borderBottom: 'none', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)' }}><span>Summa</span><span /><span className="ax-num">890,00</span><span className="ax-num">890,00</span></div>
        </div>
        <div className="dp-in" style={{ ...d(3.3), marginTop: 7, display: 'flex', gap: 6, alignItems: 'center' }}><Doc /><span className="ax-s">Kvitto eller fil:</span><span className="ax-b" style={{ textDecoration: 'underline' }}>IMG_4821.jpg</span></div>
      </div>
    </div>
    <VerRow v="C012" date="2026-09-22" text="Betalning faktura 1008" amount="72 500,00" />
    <VerRow v="A033" date="2026-09-18" text="Lokalhyra" amount="45 000,00" />
    <VerRow v="K009" date="2026-09-16" text="Lön Johanna Exempel" amount="23 656,00" />
  </Shell>
);

// Granskning med ett förslag ur historiken (ReviewQueue.jsx ReviewCard):
// "Kontera … som 5410", etiketten Osäkert förslag, Godkänn / Avvisa.
const GranskningScene = (
  <Shell active="review" review={1}>
    <Top title="Granskning" tabs={['Väntar · 1', 'Stripe', 'Zettle', 'Historik']} on="Väntar · 1" />
    <div className="ax-body" style={{ padding: 0 }}>
      <div className="dp-collapse" style={{ ...d(2.6), '--h': '200px' }}>
        <ReviewItem
          icon={ReceiptText}
          meta="Kvitto · föreslaget utifrån tidigare verifikationer · idag"
          title="Kontera Kjell & Company 349 kr som 5410 Förbrukningsinventarier"
          badge={<Pill kind="warn">Osäkert förslag</Pill>}
          actions={<>
            <span className="ax-btn ax-click" style={c(2.1)}><Check size={11} strokeWidth={3} /> Godkänn</span>
            <span className="ax-btn-ghost" style={{ color: 'var(--ax-r-tx)' }}><X size={11} /> Avvisa</span>
            <span className="ax-m ax-hide-sm" style={{ marginLeft: 'auto', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Info size={10} /> Visa detaljer <ChevronUp size={10} /></span>
          </>}
        >
          <div className="dp-in" style={{ ...d(0.6), marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--ax-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 10.5 }}>
            <span><span className="ax-m">Inköpsställe/leverantör:</span> Kjell &amp; Company</span>
            <span><span className="ax-m">Datum:</span> 2026-09-26</span>
            <span><span className="ax-m">Belopp:</span> 349,00 kr</span>
            <span><span className="ax-m">Moms:</span> 69,80 kr</span>
            <span style={{ gridColumn: '1 / -1' }}><span className="ax-m">Kvitto eller fil:</span> <b style={{ textDecoration: 'underline' }}>kjell-kvitto.pdf</b></span>
          </div>
        </ReviewItem>
      </div>
      <div className="dp-in" style={{ ...d(2.9), textAlign: 'center', padding: '44px 20px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><CheckCircle2 size={26} strokeWidth={1.6} /></div>
        <div className="ax-b" style={{ fontSize: 15 }}>Allt är genomgånget</div>
        <div className="ax-s" style={{ fontSize: 11.5, marginTop: 4 }}>Det finns inga poster kvar att granska just nu.</div>
      </div>
    </div>
    <Toast delay={2.6}>Kjell &amp; Company bokförd på 5410</Toast>
  </Shell>
);

export const BOKFORING_DEMO = [
  { title: 'Kvittot läses av', where: 'Bokix · Kvitton', body: 'Fota kvittot eller dra in en PDF. Datum, belopp, leverantör och moms läses av, och kontot föreslås utifrån hur du bokförde förra gången.', scene: KvittoScene },
  { title: 'Verifikationen skrivs', where: 'Bokix · Bokföring', body: 'Verifikationen skrivs med rätt konton och momsen uppdelad. Kvittot sitter kvar som underlag, så det går att ta fram vid en granskning.', scene: BokforingScene },
  { title: 'Det osäkra granskas', where: 'Bokix · Granskning', body: 'Det Bokix inte är säker på gissas inte. Det hamnar i Granskning med förslag ur din egen historik, och du väljer med ett klick.', scene: GranskningScene },
];

// ── Fakturering ─────────────────────────────────────────────────────────

// Fakturaeditorn i hel bredd som i appen (Invoices.jsx): Tillbaka + titel,
// verktygsrad, Fakturauppgifter, Fakturarader och summarutan. Förhandsvisningen
// ligger inte bredvid längre, den öppnas i helskärm med Förhandsgranska.
const EDITOR_CSS = `
  .axf-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--ax-border); }
  .axf-tools { display: flex; align-items: center; gap: 6px; padding: 7px 16px; border-bottom: 1px solid var(--ax-border); }
  .axf-tools .ax-btn-ghost { padding: 3px 8px; font-size: 10px; }
  .axf-sec { padding: 10px 16px; border-bottom: 1px solid var(--ax-border); }
  .axf-h { font-size: 11.5px; font-weight: 700; margin-bottom: 7px; }
  .axf-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 8px; }
  .axf-rows { display: grid; grid-template-columns: 1fr 44px 62px 52px 76px; gap: 6px; align-items: center; }
  .axf-rows .ax-field { min-height: 25px; padding: 3px 8px; }
  .axf-paper { background: #fff; color: #1c1c1c; border-radius: 4px; box-shadow: 0 10px 30px -12px rgba(0,0,0,0.35); padding: 18px 20px 16px; font-size: 10px; width: min(100%, 330px); margin: 0 auto; }
  .axf-prow { display: grid; grid-template-columns: 1fr 34px 58px; gap: 6px; padding: 4px 0; border-bottom: 1px solid #eee; }
  @media (max-width: 640px) {
    .axf-grid { grid-template-columns: 1fr 1fr; }
    .axf-rows { grid-template-columns: 1fr 34px 70px; }
    .axf-hide-sm { display: none !important; }
  }
`;

const EditRow = ({ text, qty, price, sum, at, typed }) => (
  <div className="axf-rows dp-slide" style={{ ...d(at), marginBottom: 5 }}>
    <span className="ax-field">{typed ? <Typed text={text} at={at + 0.2} dur={0.5} /> : text}</span>
    <span className="ax-field" style={{ justifyContent: 'flex-end' }}>{qty}</span>
    <span className="ax-field axf-hide-sm" style={{ justifyContent: 'flex-end' }}>{price}</span>
    <span className="ax-field axf-hide-sm" style={{ justifyContent: 'space-between' }}>25% <ChevronDown size={9} /></span>
    <span className="ax-field ax-b" style={{ justifyContent: 'flex-end', background: 'var(--ax-soft)' }}>{sum}</span>
  </div>
);

const EditorScene = (
  <Shell active="invoices" review={1}>
    <style>{EDITOR_CSS}</style>
    <div className="axf-head">
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}><span className="ax-s ax-b" style={{ fontSize: 11 }}>← Tillbaka</span><span className="ax-b" style={{ fontSize: 15 }}>Ny faktura</span><span className="ax-m ax-hide-sm" style={{ fontSize: 9.5 }}>OCR: 0001013</span></span>
      <span style={{ display: 'flex', gap: 6 }}><span className="ax-btn-ghost ax-hide-sm">Avbryt</span><span className="ax-btn"><Check size={11} strokeWidth={3} /> Skapa faktura</span></span>
    </div>
    <div className="axf-tools ax-hide-sm">
      <span className="ax-btn-ghost"><MessageSquare size={10} /> Kommentar</span>
      <span style={{ flex: 1 }} />
      <span className="ax-btn-ghost"><Send size={10} /> Skicka via e-post</span>
      <span className="ax-btn-ghost"><Download size={10} /> Ladda ner PDF</span>
      <span className="ax-btn-ghost ax-click" style={c(3.6)}><Eye size={10} /> Förhandsgranska</span>
    </div>
    <div className="axf-sec">
      <div className="axf-h">Fakturauppgifter</div>
      <div className="axf-grid">
        <div><div className="ax-label">Kund</div><div className="ax-field" style={{ justifyContent: 'space-between' }}><Typed text="Testkunden AB" at={0.4} dur={0.7} /><ChevronDown size={10} /></div></div>
        <div><div className="ax-label">Fakturadatum</div><div className="ax-field">2026-09-26</div></div>
        <div className="axf-hide-sm"><div className="ax-label">Förfallodatum</div><div className="ax-field">2026-10-26</div></div>
        <div className="axf-hide-sm"><div className="ax-label">Fakturatyp</div><span className="ax-seg" style={{ borderRadius: 7, width: '100%' }}><span className="on" style={{ flex: 1, textAlign: 'center', borderRadius: 6, background: '#0b6329', color: '#fff' }}>Faktura</span><span style={{ flex: 1, textAlign: 'center' }}>Kontant</span></span></div>
      </div>
    </div>
    <div className="axf-sec" style={{ borderBottom: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="axf-h">Fakturarader</div><span className="ax-seg ax-hide-sm" style={{ fontSize: 9 }}><span className="on">Pris exkl. moms</span><span>Pris inkl. moms</span></span></div>
      <div className="axf-rows ax-th" style={{ background: 'none', minHeight: 18, marginBottom: 4 }}><span>Benämning</span><span className="ax-num">Antal</span><span className="ax-num axf-hide-sm">À-pris</span><span className="axf-hide-sm">Moms</span><span className="ax-num">Summa</span></div>
      <EditRow text="Konsulttimmar" qty="12" price="950" sum="11 400,00" at={1.2} typed />
      <EditRow text="Resa till kund" qty="1" price="600" sum="600,00" at={2.1} typed />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
        <span className="ax-btn-ghost ax-click" style={{ ...c(1.9), fontSize: 10, padding: '3px 8px' }}><Plus size={10} /> Lägg till rad</span>
        <div className="ax-card dp-in" style={{ ...d(2.8), padding: '8px 11px', minWidth: 170, background: 'var(--ax-soft)', fontSize: 10.5, lineHeight: 1.75 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ax-s">Netto (exkl. moms)</span><span className="ax-num">12 000,00 SEK</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ax-s">Moms</span><span className="ax-num">3 000,00 SEK</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ax-border)', marginTop: 3, paddingTop: 3, fontSize: 12 }}><b>Att betala</b><b className="ax-num">15 000,00 SEK</b></div>
        </div>
      </div>
    </div>
    <div className="ax-scrim dp-in" style={{ ...d(4), alignItems: 'stretch', padding: '14px 0' }}>
      <div style={{ width: 'min(94%, 420px)', display: 'flex', flexDirection: 'column', background: 'var(--ax-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45)' }}>
        <div className="ax-modal-head" style={{ fontSize: 12 }}>Förhandsgranskning · Faktura 1013<ModalClose /></div>
        <div style={{ display: 'flex', gap: 5, padding: '7px 14px' }}>
          {['Klassisk', 'Kraftfull', 'Minimal', 'Rutnät'].map(m => <span key={m} className={`ax-chip${m === 'Minimal' ? ' on' : ''}`} style={{ padding: '2px 7px', fontSize: 9.5, borderRadius: 999 }}>{m}</span>)}
        </div>
        <div style={{ flex: 1, minHeight: 0, background: 'var(--ax-soft)', padding: '12px 14px', overflow: 'hidden' }}>
          <div className="axf-paper dp-pop" style={d(4.2)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#0f766e' }}>Ditt Företag AB</span>
              <span style={{ textAlign: 'right' }}><b style={{ fontSize: 11 }}>FAKTURA</b><br />Nr 1013</span>
            </div>
            <div style={{ marginBottom: 10 }}><span style={{ color: '#888' }}>Till</span><br /><b>Testkunden AB</b></div>
            <div className="axf-prow" style={{ color: '#888', fontWeight: 700 }}><span>Benämning</span><span style={{ textAlign: 'right' }}>Antal</span><span style={{ textAlign: 'right' }}>Belopp</span></div>
            <div className="axf-prow"><span>Konsulttimmar</span><span style={{ textAlign: 'right' }}>12</span><span style={{ textAlign: 'right' }}>11 400,00</span></div>
            <div className="axf-prow"><span>Resa till kund</span><span style={{ textAlign: 'right' }}>1</span><span style={{ textAlign: 'right' }}>600,00</span></div>
            <div style={{ marginTop: 8, textAlign: 'right', lineHeight: 1.7 }}>Moms 25 %: 3 000,00<br /><b style={{ fontSize: 11.5 }}>Att betala: 15 000,00 kr</b></div>
          </div>
        </div>
      </div>
    </div>
  </Shell>
);

// Kundfakturor (Invoices.jsx): filterpiller, kolumnerna Fakturanr, Kund,
// Fakturadatum, Förfallodatum, Belopp, Status och hela raden färgad.
const INV_COLS = { gridTemplateColumns: '72px 1fr 92px 100px 76px 92px' };
const InvRow = ({ nr, kund, date, due, amount, children, tint, style, className = '' }) => (
  <div className={`ax-tr m-inv ${className}`} style={{ ...INV_COLS, background: tint ? `var(--ax-row-${tint})` : undefined, ...style }}>
    <span className="ax-b">{nr}</span><span className="ax-b">{kund}</span><span className="ax-s ax-hide-sm">{date}</span><span className="ax-s ax-hide-sm">{due}</span><span className="ax-num ax-b">{amount}</span><span>{children}</span>
  </div>
);
const InvHead = () => <div className="ax-tr ax-th m-inv" style={INV_COLS}><span>Fakturanr</span><span>Kund</span><span className="ax-hide-sm">Fakturadatum</span><span className="ax-hide-sm">Förfallodatum</span><span className="ax-num">Belopp</span><span>Status</span></div>;
const InvTop = () => <Top title="Kundfakturor" how sub="Fakturor du skickar till dina kunder" action={<span className="ax-btn-ghost ax-hide-sm"><Sparkles size={10} /> Så funkar fakturering</span>} />;
const InvFilters = ({ draft = 1, unpaid = 1, paid = 9 }) => (
  <>
    <div className="ax-bar" style={{ justifyContent: 'space-between' }}><SearchBox text="Fakturanr eller kundnamn" /><span className="ax-btn"><Plus size={11} /> Skapa faktura</span></div>
    <div className="ax-bar" style={{ gap: 6, flexWrap: 'wrap' }}>
      <span className="ax-chip" style={{ borderRadius: 999, borderColor: 'var(--ax-text)', padding: '3px 9px' }}>Alla {draft + unpaid + paid + 1}</span>
      <span className="ax-pill ax-draft">Ej bokförd {draft}</span><span className="ax-pill ax-unpaid">Obetald {unpaid}</span><span className="ax-pill ax-late">Förfallen 1</span><span className="ax-pill ax-paid">Betald {paid}</span>
    </div>
  </>
);
const Paid = ({ children = 'Betald', ...p }) => <Pill kind="paid" {...p}><Check strokeWidth={3} />{children}</Pill>;

const SendScene = (
  <Shell active="invoices" review={1}>
    <InvTop />
    <InvFilters />
    <InvHead />
    <style>{`@keyframes axToUnpaid { from { background: var(--ax-soft); } to { background: var(--ax-row-unpaid); } } .ax-tounpaid { animation: axToUnpaid 0.6s ease var(--d) both; }`}</style>
    <InvRow nr="1013" kund="Testkunden AB" date="2026-09-26" due="2026-10-26" amount="15 000,00" className="ax-tounpaid" style={d(3.8)}><span className="dp-swap" style={{ justifyItems: 'start' }}><Pill kind="draft" className="dp-gone" style={d(3.6)}>Ej bokförd</Pill><Pill kind="unpaid" className="dp-pop" style={d(3.8)}>Obetald</Pill></span></InvRow>
    <InvRow nr="1012" kund="Exempelbygg AB" date="2026-09-22" due="2026-10-22" amount="75 000,00" tint="unpaid"><Pill kind="unpaid">Obetald</Pill></InvRow>
    <InvRow nr="1011" kund="Testfastigheter AB" date="2026-09-15" due="2026-10-15" amount="72 500,00" tint="paid"><Paid /></InvRow>
    <InvRow nr="1009" kund="Exempelbygg AB" date="2026-08-21" due="2026-09-20" amount="47 500,00" tint="late"><Pill kind="late">Förfallen</Pill></InvRow>
    <InvRow nr="1008" kund="Testdesign AB" date="2026-08-27" due="2026-09-26" amount="72 500,00" tint="paid"><Paid /></InvRow>
    <div className="ax-scrim dp-gone" style={d(3.3)}>
      <div className="ax-modal dp-pop" style={d(0.2)}>
        <div className="ax-modal-head">Skicka faktura 1013<ModalClose /></div>
        <div className="ax-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><div className="ax-label">Till</div><div className="ax-field">ekonomi@testkunden.se</div></div>
          <div><div className="ax-label">Ämne</div><div className="ax-field">Faktura 1013 från Ditt Företag AB</div></div>
          <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ax-label">Meddelande</span><span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ax-g-tx)' }}>Återställ standardtexten</span></div>
            <div className="ax-field" style={{ alignItems: 'flex-start', flexDirection: 'column', fontSize: 10.5, lineHeight: 1.5 }}><span>Hej,</span><span>Bifogat finner du faktura 1013 på 15 000,00 kr.</span></div></div>
          <div style={{ background: 'var(--ax-soft)', border: '1px solid var(--ax-border)', borderRadius: 8, padding: '7px 9px', fontSize: 10.5 }}>
            <div className="ax-s">Följer med automatiskt: fakturan som PDF och en rad med fakturanummer, belopp och förfallodatum.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
              <span className="dp-swap"><span style={{ width: 12, height: 12, border: '1.5px solid var(--ax-sub)', borderRadius: 3 }} /><span className="dp-pop" style={{ ...d(1.4), width: 12, height: 12, borderRadius: 3, background: '#0b6329', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={9} strokeWidth={3} /></span></span>
              <span className="ax-click" style={c(1.3)}>Lägg med en <b>Betala nu</b>-knapp (kortbetalning via Stripe)</span>
            </div>
          </div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span><span className="ax-btn ax-click" style={c(2.8)}>Skicka</span></div>
      </div>
    </div>
    <Toast delay={3.5}>Faktura 1013 skickad till ekonomi@testkunden.se</Toast>
  </Shell>
);

const PaidScene = (
  <Shell active="invoices" review={1}>
    <style>{`@keyframes axToPaid { from { background: var(--ax-row-unpaid); } to { background: var(--ax-row-paid); } } .ax-topaid { background: var(--ax-row-paid); animation: axToPaid 0.6s ease var(--d) both; }`}</style>
    <InvTop />
    <InvFilters draft={0} unpaid={1} paid={10} />
    <InvHead />
    <InvRow nr="1013" kund="Testkunden AB" date="2026-09-26" due="2026-10-26" amount="15 000,00" className="ax-topaid" style={d(3)}>
      <span className="dp-swap" style={{ justifyItems: 'start' }}><Pill kind="unpaid" className="dp-gone" style={d(3)}>Obetald</Pill><Paid className="dp-pop" style={d(3.1)} /></span>
    </InvRow>
    <InvRow nr="1012" kund="Exempelbygg AB" date="2026-09-22" due="2026-10-22" amount="75 000,00" tint="unpaid"><Pill kind="unpaid">Obetald</Pill></InvRow>
    <InvRow nr="1009" kund="Exempelbygg AB" date="2026-08-21" due="2026-09-20" amount="47 500,00" tint="late">
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}><Pill kind="late">Förfallen</Pill><span className="ax-s dp-in" style={{ ...d(1.1), fontSize: 9.5 }}>Påminnelse skickad</span></span>
    </InvRow>
    <InvRow nr="1008" kund="Testdesign AB" date="2026-08-27" due="2026-09-26" amount="72 500,00" tint="paid"><Paid /></InvRow>
    <InvRow nr="1007" kund="Exempelbygg AB" date="2026-07-28" due="2026-08-27" amount="107 500,00" tint="paid"><Paid /></InvRow>
    <InvRow nr="1006" kund="Testdesign AB" date="2026-06-28" due="2026-07-28" amount="98 750,00" tint="paid"><Paid /></InvRow>
    <div className="ax-toast dp-in" style={{ ...d(1.2), bottom: 58 }}><Check strokeWidth={3} />Påminnelse skickad för faktura 1009</div>
    <Toast delay={3.4}>Kortbetalning mottagen · 15 000 kr</Toast>
  </Shell>
);

export const FAKTURERING_DEMO = [
  { title: 'Fakturan skapas', where: 'Bokix · Ny faktura', body: 'Välj kund och lägg till rader. Förhandsgranska visar exakt den PDF kunden får, i den mall och med den logotyp du valt.', scene: EditorScene },
  { title: 'Den skickas med kortbetalning', where: 'Bokix · Kundfakturor', body: 'Fakturan mejlas med PDF:en bifogad, från din egen adress om du vill, och med en knapp där kunden kan betala med kort via Stripe.', scene: SendScene },
  { title: 'Påminnelse och betalning', where: 'Bokix · Kundfakturor', body: 'En förfallen faktura får en påminnelse av sig själv. När kunden betalar blir raden grön och betalningen bokförs.', scene: PaidScene },
];

// ── Skatt och bokslut ───────────────────────────────────────────────────

// Momsens fyra steg som i appen (Taxes.jsx): numrerade cirklar med
// etiketten under, en linje mellan.
const Stepper = ({ at }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', margin: '10px 0 12px' }}>
    {['Kontrollera', 'Granska', 'Bokför', 'Lämna in'].map((s, i) => {
      const done = i < at; const on = i === at;
      return (
        <React.Fragment key={s}>
          {i > 0 && <span style={{ flex: 1, height: 1.5, marginTop: 9, background: done || on ? '#0b6329' : 'var(--ax-border)' }} />}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: on ? 700 : 500, color: on ? 'var(--ax-text)' : 'var(--ax-sub)', minWidth: 44 }}>
            <span style={{ width: 19, height: 19, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, background: on ? '#0b6329' : done ? 'var(--ax-g-bg)' : 'var(--ax-soft)', color: on ? '#fff' : done ? 'var(--ax-g-tx)' : 'var(--ax-muted)' }}>{done ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
            <span className="ax-hide-sm">{s}</span>
          </span>
        </React.Fragment>
      );
    })}
  </div>
);
const TAX_TABS = ['Översikt', 'Moms', 'Lön', 'Årsavslut'];

const MomsHead = () => (
  <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
    <div>
      <div className="ax-b" style={{ fontSize: 13.5 }}>Momsdeklaration kvartal 3 2026</div>
      <div style={{ fontSize: 10.5, marginTop: 2 }}>Lämnas och betalas senast 12 november 2026 · <b>om 31 dagar</b></div>
      <div className="ax-m ax-hide-sm" style={{ fontSize: 9.5, marginTop: 1 }}>1 juli – 30 september 2026 · 11 underliggande transaktioner · Moms per kvartal</div>
    </div>
    <span className="ax-btn-ghost ax-hide-sm">Kvartal 3 2026 (jul–sep) <ChevronDown size={10} /></span>
  </div>
);

const MomsScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" how tabs={TAX_TABS} on="Moms" />
    <MomsHead />
    <div className="ax-body white" style={{ paddingTop: 2 }}>
      <Stepper at={1} />
      <div className="dp-in" style={{ ...d(0.3), display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--ax-g-bg)', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', fontWeight: 600, fontSize: 11 }}><CheckCircle2 size={12} /> Inga blockerande fel hittades för perioden.</div>
      <div style={{ marginTop: 9, border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
        <div className="ax-tr ax-th" style={{ gridTemplateColumns: '40px 1fr 80px', padding: '0 10px' }}><span>Ruta</span><span>Beskrivning</span><span className="ax-num">Belopp</span></div>
        {[['05', 'Momspliktig försäljning', '28 150'], ['10', 'Utgående moms 25 %', '7 038'], ['48', 'Ingående moms att dra av', '441'], ['49', 'Moms att betala', '6 597']].map(([r, t, v], i) => (
          <div key={r} className={`ax-tr dp-slide${i === 3 ? ' ax-b' : ''}`} style={{ gridTemplateColumns: '40px 1fr 80px', padding: '0 10px', minHeight: 26, ...d(0.9 + i * 0.45), background: i === 3 ? 'var(--ax-soft)' : undefined, borderBottom: i === 3 ? 'none' : undefined }}>
            <span className="ax-b">{r}</span><span>{t}</span><span className="ax-num">{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><span className="ax-btn ax-click dp-in" style={dc(2.9, 3.8)}>Gå vidare till Bokför <ChevronRight size={11} /></span></div>
    </div>
  </Shell>
);

const LamnaScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" how tabs={TAX_TABS} on="Moms" />
    <MomsHead />
    <div className="ax-body white" style={{ paddingTop: 2 }}>
      <Stepper at={3} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', fontWeight: 600, fontSize: 11 }}><CheckCircle2 size={12} /> Perioden är bokförd som M003. Ladda ner filen och lämna in hos Skatteverket.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <span className="ax-btn ax-click" style={c(1)}><Download size={11} /> Ladda ner fil för uppladdning (XML)</span>
        <span className="ax-btn-ghost"><Download size={11} /> Ladda ner momsdeklaration (PDF)</span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {['Logga in på skatteverket.se med BankID', 'Välj att lämna momsdeklarationen via fil', 'Ladda upp filen, granska och signera'].map((t, i) => (
          <div key={t} className="dp-in" style={{ ...d(1.8 + i * 0.4), display: 'flex', gap: 9, alignItems: 'center', fontSize: 11.5 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--ax-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>{t}
          </div>
        ))}
      </div>
      <div className="dp-in ax-m" style={{ ...d(3.2), marginTop: 12, fontSize: 11 }}>Bokix skickar ingenting själv. Det är du som signerar.</div>
    </div>
    <DownloadBar file="moms-2026-kv3.xml" delay={1.4} />
  </Shell>
);

// Årsavslut: delstegen överst, Årsbokslut med steglistan till vänster och
// det valda steget till höger (YearEndWizard).
const YEAR_STEPS = ['Avstämning bankkonto', 'Bokför årets sista kundfakturor', 'Bokför årets sista leverantörsfakturor', 'Gör årets sista lönekörning', 'Periodisera upplupna och förutbetalda poster', 'Inventering och lager (om tillämpligt)', 'Lås räkenskapsåret'];
const BokslutScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" how tabs={TAX_TABS} on="Årsavslut" />
    <div className="ax-bar" style={{ gap: 6 }}>
      {['1. Årsbokslut', '2. Årsredovisning', '3. Inkomstdeklaration', '4. Utdelning'].map((t, i) => <span key={t} className={i === 0 ? 'ax-chip on' : 'ax-s ax-hide-sm'} style={{ fontSize: 10.5, fontWeight: 600, padding: i === 0 ? '3px 8px' : '3px 6px' }}>{t}</span>)}
    </div>
    <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--ax-border)' }}>
      <div className="ax-b" style={{ fontSize: 13.5 }}>Årsbokslut 2026</div>
      <div style={{ fontSize: 10.5, margin: '2px 0 6px' }}><span className="dp-swap" style={{ justifyItems: 'start' }}><span className="dp-gone" style={d(2.4)}>2 av 6 steg klara</span><span className="dp-in" style={d(2.5)}>6 av 6 steg klara</span></span></div>
      <style>{`@keyframes axProg { from { transform: scaleX(0.33); } } .ax-prog { height: 100%; background: #22c55e; border-radius: 4px; transform-origin: left; animation: axProg 2s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both; } @media (prefers-reduced-motion: reduce) { .ax-prog { animation: none; } }`}</style>
      <div style={{ height: 4, width: 160, borderRadius: 4, background: 'var(--ax-soft)', overflow: 'hidden' }}><div className="ax-prog" /></div>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div className="ax-hide-sm" style={{ width: 168, borderRight: '1px solid var(--ax-border)', padding: '6px 8px' }}>
        {YEAR_STEPS.map((t, i) => {
          const last = i === 6;
          return (
            <div key={t} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '4px 6px', borderRadius: 7, fontSize: 9.5, lineHeight: 1.3, ...(last ? { background: 'var(--ax-soft)', fontWeight: 700 } : {}) }}>
              <span style={{ width: 15, height: 15, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--ax-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, position: 'relative' }}>
                {last ? 7 : i < 2 ? <Check size={9} strokeWidth={3} color="#16a34a" /> : <span className="dp-swap"><span className="dp-gone" style={d(0.6 + (i - 2) * 0.45)}>{i + 1}</span><span className="dp-pop" style={d(0.65 + (i - 2) * 0.45)}><Check size={9} strokeWidth={3} color="#16a34a" /></span></span>}
              </span>
              <span>{t}</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '12px 18px' }}>
        <div className="ax-m ax-b" style={{ fontSize: 9, letterSpacing: '0.06em' }}>STEG 7 AV 7</div>
        <div className="ax-b" style={{ fontSize: 14, margin: '3px 0 6px' }}>Lås räkenskapsåret</div>
        <div className="ax-s" style={{ fontSize: 11, lineHeight: 1.55, maxWidth: 320 }}>Årets resultat bokförs och året låses. Efter det går bokföringen för året inte att ändra.</div>
        <div style={{ marginTop: 10 }}><span className="dp-swap" style={{ justifyItems: 'start' }}><span className="ax-btn ax-click dp-gone" style={dc(3.4, 3.2)}><Lock size={11} /> Lås räkenskapsåret</span><Pill className="dp-pop" style={{ ...d(3.5), fontSize: 10.5, padding: '4px 9px' }}><Lock size={10} /> Räkenskapsåret är låst</Pill></span></div>
      </div>
    </div>
    <Toast delay={3.8}>Räkenskapsåret 2026 är låst</Toast>
  </Shell>
);

export const SKATT_DEMO = [
  { title: 'Momsen ruta för ruta', where: 'Bokix · Skatt och bokslut · Moms', body: 'Bokix kontrollerar perioden och fyller i momsdeklarationen från bokföringen, med samma rutnummer som på Skatteverkets blankett.', scene: MomsScene },
  { title: 'Filen till Skatteverket', where: 'Bokix · Skatt och bokslut · Moms', body: 'Du får deklarationen som PDF och som fil att ladda upp. Du signerar själv hos Skatteverket, Bokix skickar aldrig något i ditt namn.', scene: LamnaScene },
  { title: 'Bokslutet låser året', where: 'Bokix · Skatt och bokslut · Årsavslut', body: 'Bokslutet går steg för steg. När allt stämmer låser du räkenskapsåret, så inget kan ändras i efterhand.', scene: BokslutScene },
];

// ── Lön ─────────────────────────────────────────────────────────────────

// Lönekörningen steg för steg som i appen (PayrollRunDetail.jsx): rubrik med
// Utkast, sju steg i en rad, nyckeltal i rutor och ett avsnitt per steg.
const PAY_STEPS = ['Beräkna', 'Godkänn', 'Betala', 'Lönebesked', 'Bokför', 'AGI och skatt', 'Klart'];
const PayHead = ({ at, status = 'Utkast', statusKind = 'gray', swapAt }) => (
  <div style={{ padding: '11px 18px 9px', borderBottom: '1px solid var(--ax-border)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="ax-b" style={{ fontSize: 15 }}>Lönekörning 2026-09</span><Pill kind={statusKind}>{status}</Pill><span className="ax-how ax-hide-sm"><PlayCircle size={9} /> Se hur</span></span>
      <span className="ax-btn-ghost ax-hide-sm" style={{ fontSize: 10 }}><ChevronLeft size={10} /> Tillbaka till lönekörningar</span>
    </div>
    <div className="ax-m" style={{ fontSize: 9.5, marginTop: 2 }}>Utbetalningsdatum: 2026-09-25 · 2 anställda</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
      {PAY_STEPS.map((s, i) => {
        const cur = swapAt != null && i === at + 1 ? 'next' : i === at ? 'on' : i < at ? 'done' : '';
        const dot = (state) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px 2px 2px', borderRadius: 999, background: state === 'on' ? 'var(--ax-g-bg)' : 'transparent', fontSize: 9.5, fontWeight: state === 'on' ? 700 : 500, color: state === 'on' ? 'var(--ax-text)' : 'var(--ax-sub)', whiteSpace: 'nowrap' }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 800, background: state === 'on' ? '#0b6329' : state === 'done' ? 'var(--ax-g-bg)' : 'var(--ax-soft)', color: state === 'on' ? '#fff' : state === 'done' ? 'var(--ax-g-tx)' : 'var(--ax-muted)' }}>{state === 'done' ? <Check size={8} strokeWidth={3} /> : i + 1}</span>
            <span className={state === 'on' ? '' : 'ax-hide-sm'}>{s}</span>
          </span>
        );
        return (
          <React.Fragment key={s}>
            {i > 0 && <span className="ax-hide-sm" style={{ flex: '1 1 6px', minWidth: 4, maxWidth: 22, height: 1, background: 'var(--ax-border)' }} />}
            {cur === 'next' || (swapAt != null && i === at)
              ? <span className="dp-swap"><span className="dp-gone" style={d(swapAt)}>{dot(i === at ? 'on' : '')}</span><span className="dp-pop" style={d(swapAt + 0.1)}>{dot(i === at ? 'done' : 'on')}</span></span>
              : dot(cur)}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);
const StatBoxes = ({ at = 0 }) => (
  <div className="ax-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 1.3fr', border: '1px solid var(--ax-border)', borderRadius: 9, overflow: 'hidden' }}>
    {[['Brutto', '80 500 kr'], ['Skatt', '17 101 kr'], ['Netto', '63 399 kr', 'betalas ut'], ['Avgifter', '28 028 kr'], ['Total kostnad', '117 236 kr', 'lön, skatt, avgifter och semester']].map(([k, v, s], i) => (
      <div key={k} className={`dp-in${i > 1 && i < 4 ? ' ax-hide-sm' : ''}`} style={{ ...d(at + i * 0.15), padding: '7px 9px', borderLeft: i ? '1px solid var(--ax-border)' : 'none', background: i === 4 ? 'var(--ax-soft)' : undefined }}>
        <div className="ax-s" style={{ fontSize: 9 }}>{k}</div>
        <div className="ax-b" style={{ fontSize: i === 4 ? 14 : 12.5, marginTop: 2 }}>{v}</div>
        {s && <div className="ax-m ax-hide-sm" style={{ fontSize: 8.5, marginTop: 1 }}>{s}</div>}
      </div>
    ))}
  </div>
);

const KorningScene = (
  <Shell active="payroll" review={1}>
    <PayHead at={0} />
    <div className="ax-body white">
      <div className="ax-b" style={{ fontSize: 12.5 }}>Lön och timmar</div>
      <div className="ax-s" style={{ fontSize: 10.5, margin: '2px 0 8px', maxWidth: 420 }}>Kontrollera att varje anställd har rätt lön. Fyll i timmar för timanställda och lägg till övertid, OB eller avdrag genom att öppna personen.</div>
      <StatBoxes at={0.4} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 4px' }}><span className="ax-b" style={{ fontSize: 11.5 }}>Anställda i körningen</span><span className="ax-btn-ghost ax-hide-sm" style={{ fontSize: 10 }}><Upload size={10} /> Importera timmar</span></div>
      {[['Johanna Exempel', 'Skatt 8 039 kr · netto 30 461 kr · semester 25 d kvar', '38 500 kr'], ['Oskar Test', 'Skatt 9 062 kr · netto 32 938 kr · semester 21 d kvar', '42 000 kr']].map(([n, m, b], i) => (
        <div key={n} className="dp-slide" style={{ ...d(1.4 + i * 0.35), display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'var(--ax-soft)', marginBottom: 5 }}>
          <span><b style={{ fontSize: 11.5 }}>{n}</b><span className="ax-s" style={{ display: 'block', fontSize: 9.5 }}>{m}</span></span>
          <span style={{ textAlign: 'right' }}><b>{b}</b><span className="ax-m" style={{ display: 'block', fontSize: 9 }}>brutto</span></span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}><span className="ax-btn ax-click dp-in" style={dc(2.4, 3.2)}>Beräkna lönerna <ChevronRight size={11} /></span></div>
    </div>
  </Shell>
);

const LonebeskedScene = (
  <Shell active="payroll" review={1}>
    <PayHead at={3} status="Godkänd" statusKind="ok" />
    <div className="ax-body white" style={{ display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ax-b" style={{ fontSize: 12.5 }}>Lönebesked</div>
        <div className="ax-s" style={{ fontSize: 10.5, margin: '2px 0 9px' }}>Varje anställd ska få ett lönebesked. Se hur det ser ut, ladda ner alla i en PDF eller mejla dem direkt.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <span className="ax-btn-ghost"><Download size={11} /> Ladda ner alla (en PDF)</span>
          <span className="ax-btn ax-click" style={c(2.4)}><Mail size={11} /> Mejla till alla med e-post (2)</span>
        </div>
        <div className="dp-in" style={{ ...d(2.9), marginTop: 9 }}><Pill><Check strokeWidth={3} />2 lönebesked skickade.</Pill></div>
      </div>
      <div className="ax-hide-sm" style={{ width: 210, flexShrink: 0, background: 'var(--ax-soft)', borderRadius: 9, padding: 10 }}>
        <div className="ax-s ax-b" style={{ fontSize: 9.5, marginBottom: 6 }}>Så ser lönebeskedet ut</div>
        <div className="dp-pop" style={{ ...d(0.2), background: '#fff', color: '#1c1c1c', borderRadius: 3, boxShadow: '0 10px 26px -12px rgba(0,0,0,0.35)', padding: '11px 12px', fontSize: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><b style={{ color: '#0b6329' }}>Ditt Företag AB</b><span style={{ textAlign: 'right' }}><b>LÖNEBESKED</b><br />September 2026</span></div>
          <div style={{ marginBottom: 6 }}><b>Johanna Exempel</b><br /><span style={{ color: '#777' }}>Utbetalning 2026-09-25</span></div>
          {[['Månadslön', '38 500,00', 0.7], ['Skatteavdrag', '−8 039,00', 1.0], ['Semesterdagar kvar', '25', 1.3]].map(([k, v, t]) => (
            <div key={k} className="dp-in" style={{ ...d(t), display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #eee' }}><span>{k}</span><span>{v}</span></div>
          ))}
          <div className="dp-in" style={{ ...d(1.6), display: 'flex', justifyContent: 'space-between', paddingTop: 6, fontWeight: 800, fontSize: 10 }}><span>Att utbetala</span><span>30 461,00 kr</span></div>
        </div>
      </div>
    </div>
  </Shell>
);

const GodkannScene = (
  <Shell active="payroll" review={1}>
    <PayHead at={4} status="Godkänd" statusKind="ok" swapAt={2.4} />
    <div className="ax-body white" style={{ position: 'relative' }}>
      <div className="dp-gone" style={d(2.4)}>
        <div className="ax-b" style={{ fontSize: 12.5 }}>Bokför</div>
        <div className="ax-s" style={{ fontSize: 10.5, margin: '2px 0 8px' }}>Lönen bokförs som tre verifikationer: lön, arbetsgivaravgifter och semesteravsättning. Så här blir de.</div>
        {[['Lön september', '7210 Löner till tjänstemän', '80 500'], ['Arbetsgivaravgifter', '7510 Lagstadgade sociala avgifter', '25 293'], ['Semesteravsättning', '7290 Förändring av semesterlöneskuld', '8 707']].map(([t, k, v], i) => (
          <div key={t} className="dp-slide" style={{ ...d(0.4 + i * 0.3), display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', border: '1px solid var(--ax-border)', borderRadius: 8, marginBottom: 5 }}>
            <span><b style={{ fontSize: 11.5 }}>{t}</b><span className="ax-s" style={{ display: 'block', fontSize: 9.5 }}>{k}</span></span><b className="ax-num">{v} kr</b>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}><span className="ax-btn ax-click" style={c(2)}>Bokför lönen</span></div>
      </div>
      <div className="dp-in" style={{ ...d(2.6), position: 'absolute', inset: '12px 18px' }}>
        <div className="ax-b" style={{ fontSize: 12.5 }}>AGI och skatt</div>
        <div className="ax-s" style={{ fontSize: 10.5, margin: '2px 0 9px', maxWidth: 420 }}>Lämna arbetsgivardeklarationen till Skatteverket och betala skatten och avgifterna senast den 12:e månaden efter.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <span className="ax-btn ax-click" style={c(3.4)}><Download size={11} /> Ladda ner AGI-fil för Skatteverket (XML)</span>
          <span className="ax-btn-ghost"><Download size={11} /> Ladda ner AGI-sammanställning (PDF)</span>
        </div>
      </div>
    </div>
    <Toast delay={2.5} top>Lönen bokförd som K010–K012</Toast>
    <DownloadBar file="agi-2026-09.xml" delay={3.8} />
  </Shell>
);

export const LON_DEMO = [
  { title: 'Lönekörningen', where: 'Bokix · Anställda och lön', body: 'Alla anställda i samma körning. Skatten räknas enligt Skatteverkets tabeller och arbetsgivaravgiften efter ålder.', scene: KorningScene },
  { title: 'Lönebeskedet', where: 'Bokix · Lönekörning · Lönebesked', body: 'Varje anställd får ett lönebesked som PDF, med lön, skatteavdrag och semesterdagar. Ladda ner alla eller mejla dem direkt.', scene: LonebeskedScene },
  { title: 'Bokföringen och AGI', where: 'Bokix · Lönekörning · Bokför', body: 'Körningen går steg för steg: betalfil till banken, lönen bokförs som verifikationer och AGI-filen laddas ner till Skatteverket.', scene: GodkannScene },
];
