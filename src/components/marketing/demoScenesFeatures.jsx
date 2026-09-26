import React from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Plus } from '../icons';
import { Shell, Top, SearchBox, Toast, DownloadBar, Doc } from './demoApp';

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
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}><span className="ax-receipt-hl" style={d(2.1)}>CIRCLE K</span></div>
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
          <div><div className="ax-label">Inköpsställe / Leverantör</div><div className="ax-field"><Typed text="Circle K" at={2.2} dur={0.4} /></div></div>
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
        <div style={{ padding: '9px 14px', borderTop: '1px solid var(--ax-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <span className="ax-btn-ghost">Stäng</span>
          <span className="ax-btn ax-click" style={c(5)}>Spara och bokför</span>
        </div>
      </div>
    </div>
    <Toast delay={5.4} top>Kvittot är bokfört som A034</Toast>
  </div>
);

const VER_COLS = { gridTemplateColumns: '14px 74px 78px 1fr 84px 62px' };
const VerRow = ({ v, date, text, amount, style, className = '' }) => (
  <div className={`ax-tr m-ver ${className}`} style={{ ...VER_COLS, ...style }}>
    <ChevronRight size={11} className="ax-m" /><span className="ax-b">{v}</span><span className="ax-s ax-hide-sm">{date}</span><span>{text}</span><span className="ax-num ax-b">{amount}</span><Pill className="ax-hide-sm">Bokförd</Pill>
  </div>
);

const BokforingScene = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" sub="Verifikationer, kontoplan och bokföringsposter" action={<span className="ax-btn"><Plus size={11} /> Ny verifikation</span>} tabs={['Verifikationer', 'Kontoplan']} on="Verifikationer" />
    <div className="ax-bar"><SearchBox text="Sök verifikation, text, belopp…" /><span className="ax-btn-ghost ax-hide-sm">Alla serier <ChevronDown size={10} /></span><span className="ax-btn-ghost ax-hide-sm">Alla månader <ChevronDown size={10} /></span></div>
    <div className="ax-tr ax-th m-ver" style={VER_COLS}><span /><span>Verifikation</span><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span className="ax-hide-sm">Status</span></div>
    <div className="ax-month"><span>September 2026</span><span>8 verifikationer</span></div>
    <div className="dp-slide dp-flash" style={d(0.6)}>
      <div className="ax-tr m-ver" style={{ ...VER_COLS, background: 'var(--ax-g-bg)' }}>
        <ChevronDown size={11} className="dp-in" style={d(1.6)} /><span className="ax-b">A034</span><span className="ax-s ax-hide-sm">2026-09-24</span><span>Circle K</span><span className="ax-num ax-b">890,00</span><Pill className="ax-hide-sm">Bokförd</Pill>
      </div>
      <div className="dp-in" style={{ ...d(1.8), padding: '6px 18px 10px 42px', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-card)' }}>
        <div className="ax-tr ax-th" style={{ gridTemplateColumns: '1fr 70px 70px', padding: '0 10px', minHeight: 22 }}><span>Konto</span><span className="ax-num">Debet</span><span className="ax-num">Kredit</span></div>
        {[['5611 Drivmedel för personbilar', '712,00', ''], ['2641 Ingående moms', '178,00', ''], ['1930 Företagskonto', '', '890,00']].map(([k, de, kr], i) => (
          <div key={k} className="ax-tr dp-slide" style={{ gridTemplateColumns: '1fr 70px 70px', padding: '0 10px', minHeight: 24, ...d(2.1 + i * 0.3) }}><span>{k}</span><span className="ax-num">{de}</span><span className="ax-num">{kr}</span></div>
        ))}
        <div className="dp-in" style={{ ...d(3.2), marginTop: 7, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}><Doc /><span className="ax-s">Underlag:</span><span className="ax-b" style={{ textDecoration: 'underline' }}>IMG_4821.jpg</span></div>
      </div>
    </div>
    <VerRow v="A033" date="2026-09-22" text="Betalning faktura 1008" amount="72 500,00" />
    <VerRow v="A032" date="2026-09-18" text="Lokalhyra" amount="45 000,00" />
    <VerRow v="A031" date="2026-09-16" text="Lön Johanna Ek" amount="23 656,00" />
  </Shell>
);

const GranskningScene = (
  <Shell active="review" review={1}>
    <Top title="Granskning" tabs={['Väntar · 1', 'Stripe · 3', 'Zettle · 3', 'Historik']} on="Väntar · 1" />
    <div className="ax-body" style={{ padding: 0 }}>
      <div className="dp-collapse" style={{ ...d(3.6), '--h': '280px', background: 'var(--ax-card)', borderBottom: '1px solid var(--ax-border)' }}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="ax-m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em' }}>KVITTO · LIKNANDE KÖP TIDIGARE · IDAG</div>
            <div className="ax-b" style={{ fontSize: 13, margin: '3px 0 8px' }}>Ange konto för Kjell &amp; Company 349 kr</div>
            <span className="ax-btn ax-click" style={c(1)}>Ange konto</span>
          </div>
          <Pill kind="gray" style={{ alignSelf: 'flex-start' }}>Konto saknas</Pill>
        </div>
        <div className="dp-in" style={{ ...d(1.3), margin: '0 18px 14px', border: '1px solid var(--ax-border)', borderRadius: 9, overflow: 'hidden', maxWidth: 420 }}>
          <div className="ax-field" style={{ border: 'none', borderBottom: '1px solid var(--ax-border)', borderRadius: 0 }}><span className="ax-m">Sök konto…</span></div>
          <div className="ax-th" style={{ padding: '5px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ax-sub)', background: 'var(--ax-head)' }}>FÖRSLAG FRÅN DINA TIDIGARE KÖP</div>
          <div className="ax-click dp-flash" style={{ ...dc(2.4, 2.6), display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--ax-card)' }}>
            <span><b>5410</b> Förbrukningsinventarier</span><span className="ax-m">använt 3 gånger</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderTop: '1px solid var(--ax-border)' }}><span><b>6110</b> Kontorsmateriel</span></div>
        </div>
      </div>
      <div className="dp-in" style={{ ...d(3.9), textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><Check size={18} strokeWidth={3} /></div>
        <div className="ax-b" style={{ fontSize: 13.5 }}>Allt är granskat</div>
        <div className="ax-m" style={{ fontSize: 11.5, marginTop: 3 }}>Kjell &amp; Company bokfördes på 5410.</div>
      </div>
    </div>
  </Shell>
);

export const BOKFORING_DEMO = [
  { title: 'Kvittot läses av', where: 'Bokix · Kvitton', body: 'Fota kvittot eller dra in en PDF. Datum, belopp, leverantör och moms läses av, och kontot föreslås utifrån hur du bokförde förra gången.', scene: KvittoScene },
  { title: 'Verifikationen skrivs', where: 'Bokix · Bokföring', body: 'Verifikationen skrivs med rätt konton och momsen uppdelad. Kvittot sitter kvar som underlag, så det går att ta fram vid en granskning.', scene: BokforingScene },
  { title: 'Det osäkra granskas', where: 'Bokix · Granskning', body: 'Det Bokix inte är säker på gissas inte. Det hamnar i Granskning med förslag ur din egen historik, och du väljer med ett klick.', scene: GranskningScene },
];

// ── Fakturering ─────────────────────────────────────────────────────────

const EDITOR_CSS = `
  .axf { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; height: 100%; }
  .axf-paper { background: #fff; color: #1c1c1c; border-radius: 4px; box-shadow: 0 10px 30px -12px rgba(0,0,0,0.35); padding: 16px 16px 14px; font-size: 10px; height: 100%; overflow: hidden; }
  .axf-prow { display: grid; grid-template-columns: 1fr 34px 58px; gap: 6px; padding: 4px 0; border-bottom: 1px solid #eee; }
  @media (max-width: 640px) { .axf { grid-template-columns: 1fr; } .axf-paper { display: none; } }
`;

const InvoiceRow = ({ text, qty, price, sum, at }) => (
  <div className="ax-tr dp-slide" style={{ gridTemplateColumns: '1fr 34px 56px 66px', padding: '0 8px', minHeight: 28, ...d(at) }}>
    <span>{text}</span><span className="ax-num">{qty}</span><span className="ax-num">{price}</span><span className="ax-num ax-b">{sum}</span>
  </div>
);

const EditorScene = (
  <Shell active="invoices" review={1}>
    <style>{EDITOR_CSS}</style>
    <Top title="Ny kundfaktura" sub="Faktura 1013" action={<span className="ax-btn">Spara och fortsätt</span>} />
    <div className="ax-body">
      <div className="axf">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          <div><div className="ax-label">Kund</div><div className="ax-field"><Typed text="Linné Arkitekter AB" at={0.4} dur={0.8} /></div></div>
          <div className="dp-in" style={{ ...d(1.3), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div className="ax-label">Fakturadatum</div><div className="ax-field">2026-09-26</div></div>
            <div><div className="ax-label">Förfallodatum</div><div className="ax-field">2026-10-26</div></div>
          </div>
          <div className="ax-card" style={{ overflow: 'hidden' }}>
            <div className="ax-tr ax-th" style={{ gridTemplateColumns: '1fr 34px 56px 66px', padding: '0 8px' }}><span>Beskrivning</span><span className="ax-num">Antal</span><span className="ax-num">Pris</span><span className="ax-num">Summa</span></div>
            <InvoiceRow text="Konsulttimmar" qty="12" price="950" sum="11 400,00" at={1.8} />
            <InvoiceRow text="Resa till kund" qty="1" price="600" sum="600,00" at={2.6} />
            <div style={{ padding: '6px 8px' }}><span className="ax-btn-ghost ax-click" style={c(2.4)}><Plus size={10} /> Lägg till rad</span></div>
          </div>
          <div className="dp-in" style={{ ...d(3.1), display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="ax-b">Att betala</span><span className="ax-b ax-num">15 000,00 kr</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['Klassisk', 'Kraftfull', 'Minimal', 'Rutnät'].map(m => <span key={m} className={`ax-chip${m === 'Minimal' ? ' on' : ''}`} style={{ padding: '3px 7px', fontSize: 10 }}>{m}</span>)}
          </div>
          <div className="axf-paper">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#0b6329' }}>Ditt Företag AB</span>
              <span style={{ textAlign: 'right' }}><b style={{ fontSize: 11 }}>FAKTURA</b><br />Nr 1013</span>
            </div>
            <div style={{ marginBottom: 10, minHeight: 26 }}><span style={{ color: '#888' }}>Till</span><br /><b className="dp-in" style={d(1.2)}>Linné Arkitekter AB</b></div>
            <div className="axf-prow" style={{ color: '#888', fontWeight: 700 }}><span>Beskrivning</span><span style={{ textAlign: 'right' }}>Antal</span><span style={{ textAlign: 'right' }}>Belopp</span></div>
            <div className="axf-prow dp-in" style={d(2)}><span>Konsulttimmar</span><span style={{ textAlign: 'right' }}>12</span><span style={{ textAlign: 'right' }}>11 400,00</span></div>
            <div className="axf-prow dp-in" style={d(2.8)}><span>Resa till kund</span><span style={{ textAlign: 'right' }}>1</span><span style={{ textAlign: 'right' }}>600,00</span></div>
            <div className="dp-in" style={{ ...d(3.2), marginTop: 8, textAlign: 'right', lineHeight: 1.7 }}>Moms 25 %: 3 000,00<br /><b style={{ fontSize: 11.5 }}>Att betala: 15 000,00 kr</b></div>
          </div>
        </div>
      </div>
    </div>
  </Shell>
);

const INV_COLS = { gridTemplateColumns: '38px 1fr 76px 72px 104px' };
const InvRow = ({ nr, kund, due, amount, children, tint, style, className = '' }) => (
  <div className={`ax-tr m-inv ${className}`} style={{ ...INV_COLS, background: tint ? `var(--ax-row-${tint})` : undefined, ...style }}>
    <span className="ax-b">{nr}</span><span>{kund}</span><span className="ax-s ax-hide-sm">{due}</span><span className="ax-num ax-b">{amount}</span><span>{children}</span>
  </div>
);
const InvHead = () => <div className="ax-tr ax-th m-inv" style={INV_COLS}><span>Nr</span><span>Kund</span><span className="ax-hide-sm">Förfaller</span><span className="ax-num">Belopp</span><span>Status</span></div>;
const InvFilters = () => (
  <div className="ax-bar" style={{ gap: 6, flexWrap: 'wrap' }}>
    <span className="ax-chip" style={{ borderRadius: 999, borderColor: 'var(--ax-text)' }}>Alla 13</span>
    <span className="ax-pill ax-unpaid">Obetald 2</span><span className="ax-pill ax-late">Förfallen 1</span><span className="ax-pill ax-paid">Betald 9</span>
  </div>
);

const SendScene = (
  <Shell active="invoices" review={1}>
    <Top title="Kundfakturor" sub="Fakturor du skickar till dina kunder" action={<span className="ax-btn"><Plus size={11} /> Skapa faktura</span>} />
    <InvFilters />
    <InvHead />
    <style>{`@keyframes axToUnpaid { from { background: transparent; } to { background: var(--ax-row-unpaid); } } .ax-tounpaid { animation: axToUnpaid 0.6s ease var(--d) both; }`}</style>
    <InvRow nr="1013" kund="Linné Arkitekter AB" due="2026-10-26" amount="15 000,00" className="ax-tounpaid" style={d(3.8)}><span className="dp-swap" style={{ justifyItems: 'start' }}><Pill kind="gray" className="dp-gone" style={d(3.6)}>Ej skickad</Pill><Pill kind="unpaid" className="dp-pop" style={d(3.8)}>Obetald</Pill></span></InvRow>
    <InvRow nr="1012" kund="Almbring Bygg AB" due="2026-10-22" amount="75 000,00" tint="unpaid"><Pill kind="unpaid">Obetald</Pill></InvRow>
    <InvRow nr="1011" kund="Lindgren Fastigheter AB" due="2026-10-15" amount="72 500,00" tint="paid"><Pill kind="paid"><Check strokeWidth={3} />Betald</Pill></InvRow>
    <InvRow nr="1010" kund="Sjöstrand Design" due="2026-10-23" amount="69 000,00" tint="unpaid"><Pill kind="unpaid">Obetald</Pill></InvRow>
    <InvRow nr="1009" kund="Almbring Bygg AB" due="2026-09-20" amount="47 500,00" tint="late"><Pill kind="late">Förfallen</Pill></InvRow>
    <InvRow nr="1008" kund="Sjöstrand Design" due="2026-09-26" amount="72 500,00" tint="paid"><Pill kind="paid"><Check strokeWidth={3} />Betald</Pill></InvRow>
    <div className="ax-scrim dp-gone" style={d(3.3)}>
      <div className="ax-modal dp-pop" style={d(0.2)}>
        <div className="ax-modal-head">Skicka faktura 1013<span className="ax-m" style={{ fontWeight: 400 }}>✕</span></div>
        <div className="ax-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><div className="ax-label">Till</div><div className="ax-field">ekonomi@linnearkitekter.se</div></div>
          <div><div className="ax-label">Från</div><div className="ax-field">faktura@dittforetag.se<span className="ax-m" style={{ marginLeft: 'auto', fontSize: 10 }}>din egen domän</span></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span className="dp-swap"><span style={{ width: 14, height: 14, border: '1.5px solid var(--ax-sub)', borderRadius: 3 }} /><span className="dp-pop" style={{ ...d(1.4), width: 14, height: 14, borderRadius: 3, background: '#0b6329', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} strokeWidth={3} /></span></span>
            <span className="ax-click" style={c(1.3)}>Låt kunden betala med kort (Stripe)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}><Doc /> Faktura-1013.pdf bifogas</div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span><span className="ax-btn ax-click" style={c(2.8)}>Skicka</span></div>
      </div>
    </div>
    <Toast delay={3.5}>Faktura 1013 skickad till Linné Arkitekter AB</Toast>
  </Shell>
);

const PaidScene = (
  <Shell active="invoices" review={1}>
    <style>{`@keyframes axToPaid { from { background: var(--ax-row-unpaid); } to { background: var(--ax-row-paid); } } .ax-topaid { background: var(--ax-row-paid); animation: axToPaid 0.6s ease var(--d) both; }`}</style>
    <Top title="Kundfakturor" sub="Fakturor du skickar till dina kunder" action={<span className="ax-btn"><Plus size={11} /> Skapa faktura</span>} />
    <InvFilters />
    <InvHead />
    <InvRow nr="1013" kund="Linné Arkitekter AB" due="2026-10-26" amount="15 000,00" className="ax-topaid" style={d(3)}>
      <span className="dp-swap" style={{ justifyItems: 'start' }}><Pill kind="unpaid" className="dp-gone" style={d(3)}>Obetald</Pill><Pill kind="paid" className="dp-pop" style={d(3.1)}><Check strokeWidth={3} />Betald 2026-10-02</Pill></span>
    </InvRow>
    <InvRow nr="1010" kund="Sjöstrand Design" due="2026-10-23" amount="69 000,00" tint="unpaid"><Pill kind="unpaid">Obetald</Pill></InvRow>
    <InvRow nr="1009" kund="Almbring Bygg AB" due="2026-09-20" amount="47 500,00" tint="late">
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}><Pill kind="late">Förfallen</Pill><span className="ax-m dp-in" style={{ ...d(1.1), fontSize: 9.5 }}>Påminnelse skickad</span></span>
    </InvRow>
    <InvRow nr="1008" kund="Sjöstrand Design" due="2026-09-26" amount="72 500,00" tint="paid"><Pill kind="paid"><Check strokeWidth={3} />Betald 2026-10-01</Pill></InvRow>
    <InvRow nr="1007" kund="Almbring Bygg AB" due="2026-08-27" amount="107 500,00" tint="paid"><Pill kind="paid"><Check strokeWidth={3} />Betald 2026-09-01</Pill></InvRow>
    <InvRow nr="1006" kund="Sjöstrand Design" due="2026-07-28" amount="98 750,00" tint="paid"><Pill kind="paid"><Check strokeWidth={3} />Betald 2026-08-02</Pill></InvRow>
    <div className="ax-toast dp-in" style={{ ...d(1.2), bottom: 58 }}><Check strokeWidth={3} />Påminnelse skickad för faktura 1009</div>
    <Toast delay={3.4}>Kortbetalning mottagen · 15 000 kr</Toast>
  </Shell>
);

export const FAKTURERING_DEMO = [
  { title: 'Fakturan skapas', where: 'Bokix · Ny kundfaktura', body: 'Välj kund och lägg till rader. Förhandsvisningen bredvid är exakt den PDF kunden får, i den mall och med den logotyp du valt.', scene: EditorScene },
  { title: 'Den skickas med kortbetalning', where: 'Bokix · Kundfakturor', body: 'Fakturan går ut från din egen e-postdomän, med PDF:en bifogad och en länk där kunden kan betala med kort via Stripe.', scene: SendScene },
  { title: 'Påminnelse och betalning', where: 'Bokix · Kundfakturor', body: 'En förfallen faktura får en påminnelse av sig själv. När kunden betalar blir raden grön och betalningen bokförs.', scene: PaidScene },
];

// ── Skatt och bokslut ───────────────────────────────────────────────────

const Stepper = ({ at }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 12px' }}>
    {['Kontrollera', 'Granska', 'Bokför', 'Lämna in'].map((s, i) => {
      const done = i < at; const on = i === at;
      return (
        <React.Fragment key={s}>
          {i > 0 && <span style={{ flex: 1, height: 2, background: done || on ? '#0b6329' : 'var(--ax-border)' }} />}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? 'var(--ax-text)' : 'var(--ax-sub)' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, background: on ? '#0b6329' : done ? 'var(--ax-g-bg)' : 'var(--ax-soft)', color: on ? '#fff' : done ? 'var(--ax-g-tx)' : 'var(--ax-muted)' }}>{done ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
            <span className="ax-hide-sm">{s}</span>
          </span>
        </React.Fragment>
      );
    })}
  </div>
);
const TAX_TABS = ['Översikt', 'Moms', 'Årsbokslut', 'Inkomstdeklaration', 'Utdelning'];

const MomsScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" tabs={TAX_TABS} on="Moms" />
    <div className="ax-body">
      <div className="ax-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="ax-b" style={{ fontSize: 13.5 }}>Momsdeklaration</div><div className="ax-m" style={{ fontSize: 10.5 }}>1 juli – 30 september 2026 · 11 underliggande transaktioner</div></div>
          <span className="ax-btn-ghost ax-hide-sm">Kvartal 3 (jul–sep) <ChevronDown size={10} /></span>
        </div>
        <Stepper at={1} />
        <div className="dp-in" style={{ ...d(0.3), display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', fontWeight: 600, fontSize: 11 }}><Check size={12} strokeWidth={3} /> Inga blockerande fel hittades för perioden.</div>
        <div style={{ marginTop: 10, border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div className="ax-tr ax-th" style={{ gridTemplateColumns: '40px 1fr 80px', padding: '0 10px' }}><span>Ruta</span><span>Beskrivning</span><span className="ax-num">Belopp</span></div>
          {[['05', 'Momspliktig försäljning', '28 150'], ['10', 'Utgående moms 25 %', '7 038'], ['48', 'Ingående moms att dra av', '441'], ['49', 'Moms att betala', '6 597']].map(([r, t, v], i) => (
            <div key={r} className={`ax-tr dp-slide${i === 3 ? ' ax-b' : ''}`} style={{ gridTemplateColumns: '40px 1fr 80px', padding: '0 10px', minHeight: 28, ...d(0.9 + i * 0.45), background: i === 3 ? 'var(--ax-soft)' : undefined }}>
              <span className="ax-b">{r}</span><span>{t}</span><span className="ax-num">{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><span className="ax-btn ax-click dp-in" style={dc(2.9, 3.8)}>Gå vidare till Bokför <ChevronRight size={11} /></span></div>
      </div>
    </div>
  </Shell>
);

const LamnaScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" tabs={TAX_TABS} on="Moms" />
    <div className="ax-body">
      <div className="ax-card" style={{ padding: '12px 14px' }}>
        <div className="ax-b" style={{ fontSize: 13.5 }}>Momsdeklaration</div>
        <div className="ax-m" style={{ fontSize: 10.5 }}>Kvartal 3 2026 · bokförd som A036 · senast 12 nov. 2026</div>
        <Stepper at={3} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="ax-btn-ghost">Ladda ner PDF</span>
          <span className="ax-btn ax-click" style={c(1)}>Ladda ner eSKD-fil</span>
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
    </div>
    <DownloadBar file="moms-2026-kv3.xml" delay={1.4} />
  </Shell>
);

const BokslutScene = (
  <Shell active="taxes" review={1}>
    <Top title="Skatt och bokslut" tabs={TAX_TABS} on="Årsbokslut" />
    <div className="ax-body">
      <div className="ax-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ax-b" style={{ fontSize: 13.5 }}>Årsbokslut 2026</span><span className="ax-s" style={{ fontSize: 11 }}>
          <span className="dp-swap"><span className="dp-gone" style={d(2.6)}>2 av 6 steg klara</span><span className="dp-in" style={d(2.7)}>6 av 6 steg klara</span></span></span></div>
        <style>{`@keyframes axProg { from { transform: scaleX(0.33); } } .ax-prog { height: 100%; background: #0b6329; transform-origin: left; animation: axProg 2.2s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both; } @media (prefers-reduced-motion: reduce) { .ax-prog { animation: none; } }`}</style>
        <div style={{ height: 5, borderRadius: 5, background: 'var(--ax-soft)', margin: '8px 0 10px', overflow: 'hidden' }}><div className="ax-prog" /></div>
        {['Stäm av banken', 'Stäm av momsen', 'Periodiseringar', 'Avskrivningar', 'Bokslutsverifikationer', 'Granska resultat och balans'].map((t, i) => (
          <div key={t} className="ax-tr" style={{ gridTemplateColumns: '20px 1fr auto', padding: '0 2px', minHeight: 27 }}>
            <span className={i < 2 ? '' : 'dp-pop'} style={{ ...(i < 2 ? {} : d(0.6 + (i - 2) * 0.5)), width: 16, height: 16, borderRadius: '50%', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} strokeWidth={3} /></span>
            <span>{t}</span><span className="ax-m" style={{ fontSize: 10 }}>Klart</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><span className="ax-btn ax-click" style={c(3.3)}><Lock size={11} /> Lås räkenskapsåret</span></div>
      </div>
    </div>
    <Toast delay={3.8}>Räkenskapsåret 2026 är låst</Toast>
  </Shell>
);

export const SKATT_DEMO = [
  { title: 'Momsen ruta för ruta', where: 'Bokix · Skatt och bokslut · Moms', body: 'Bokix kontrollerar perioden och fyller i momsdeklarationen från bokföringen, med samma rutnummer som på Skatteverkets blankett.', scene: MomsScene },
  { title: 'Filen till Skatteverket', where: 'Bokix · Skatt och bokslut · Moms', body: 'Du får deklarationen som PDF och som eSKD-fil att ladda upp. Du signerar själv hos Skatteverket, Bokix skickar aldrig något i ditt namn.', scene: LamnaScene },
  { title: 'Bokslutet låser året', where: 'Bokix · Skatt och bokslut · Årsbokslut', body: 'Bokslutet går steg för steg. När allt stämmer låser du räkenskapsåret, så inget kan ändras i efterhand.', scene: BokslutScene },
];

// ── Lön ─────────────────────────────────────────────────────────────────

const PAY_TABS = ['Anställda', 'Lönekörningar', 'Semester'];
const PAY_COLS = { gridTemplateColumns: '1fr 70px 70px 70px' };

const KorningScene = (
  <Shell active="payroll" review={1}>
    <Top title="Anställda och lön" action={<span className="ax-btn ax-click" style={c(0.6)}><Plus size={11} /> Ny lönekörning</span>} tabs={PAY_TABS} on="Lönekörningar" />
    <div className="ax-body">
      <div className="ax-card dp-in" style={{ ...d(1), overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ax-border)' }}>
          <div><div className="ax-b" style={{ fontSize: 13 }}>Lönekörning september</div><div className="ax-m" style={{ fontSize: 10.5 }}>Utbetalning 25 september 2026</div></div>
          <Pill kind="gray">Utkast</Pill>
        </div>
        <div className="ax-tr ax-th m-pay" style={PAY_COLS}><span>Anställd</span><span className="ax-num">Brutto</span><span className="ax-num">Skatt</span><span className="ax-num">Netto</span></div>
        {[['Johanna Ek', '38 500', '−9 468', '29 032'], ['Oskar Lind', '42 000', '−10 332', '31 668']].map(([n, b, s, ne], i) => (
          <div key={n} className="ax-tr m-pay" style={PAY_COLS}>
            <span className="ax-b">{n}</span><span className="ax-num">{b}</span>
            <span className="ax-num ax-s dp-in" style={d(1.8 + i * 0.3)}>{s}</span><span className="ax-num ax-b dp-in" style={d(2.2 + i * 0.3)}>{ne}</span>
          </div>
        ))}
        <div className="ax-tr m-pay dp-in ax-b" style={{ ...PAY_COLS, ...d(2.9), background: 'var(--ax-soft)' }}><span>Totalt</span><span className="ax-num">80 500</span><span className="ax-num">−19 800</span><span className="ax-num">60 700</span></div>
        <div className="dp-in ax-s" style={{ ...d(3.3), padding: '8px 14px', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}><span>Arbetsgivaravgift 31,42 %</span><span className="ax-b">25 293 kr</span></div>
      </div>
    </div>
  </Shell>
);

const LonebeskedScene = (
  <Shell active="payroll" review={1}>
    <Top title="Anställda och lön" tabs={PAY_TABS} on="Lönekörningar" />
    <div className="ax-body" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="dp-pop" style={{ ...d(0.2), background: '#fff', color: '#1c1c1c', width: 'min(100%, 340px)', borderRadius: 4, boxShadow: '0 14px 36px -14px rgba(0,0,0,0.4)', padding: '16px 18px', fontSize: 10.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><b style={{ color: '#0b6329', fontSize: 12 }}>Ditt Företag AB</b><span style={{ textAlign: 'right' }}><b>LÖNEBESKED</b><br />September 2026</span></div>
        <div style={{ marginBottom: 10 }}><b>Johanna Ek</b><br /><span style={{ color: '#777' }}>Utbetalning 2026-09-25</span></div>
        {[['Månadslön', '38 500,00', 0.7], ['Skatteavdrag enligt tabell', '−9 468,00', 1.1], ['Semesterdagar kvar', '18', 1.5]].map(([k, v, t]) => (
          <div key={k} className="dp-in" style={{ ...d(t), display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}><span>{k}</span><span>{v}</span></div>
        ))}
        <div className="dp-in" style={{ ...d(1.9), display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: 800, fontSize: 12 }}><span>Att utbetala</span><span>29 032,00 kr</span></div>
      </div>
    </div>
  </Shell>
);

const GodkannScene = (
  <Shell active="payroll" review={1}>
    <Top title="Anställda och lön" tabs={PAY_TABS} on="Lönekörningar" />
    <div className="ax-body">
      <div className="ax-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="ax-b" style={{ fontSize: 13 }}>Lönekörning september</div><div className="ax-m" style={{ fontSize: 10.5 }}>2 anställda · netto 60 700 kr</div></div>
          <span className="dp-swap" style={{ justifyItems: 'end' }}><span className="ax-btn ax-click dp-gone" style={dc(1.1, 0.9)}>Godkänn och bokför</span><Pill className="dp-pop" style={d(1.2)}><Check strokeWidth={3} />Godkänd</Pill></span>
        </div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--ax-border)' }}>
          {[['Lönebesked', '2 st, PDF'], ['Betalfil till banken', 'ISO 20022 pain.001'], ['AGI-fil till Skatteverket', 'Arbetsgivardeklaration, XML']].map(([t, m], i) => (
            <div key={t} className="dp-slide" style={{ ...d(1.6 + i * 0.4), display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--ax-border)' }}>
              <Doc /><span style={{ flex: 1 }}><b>{t}</b><span className="ax-m" style={{ display: 'block', fontSize: 10.5 }}>{m}</span></span><span className="ax-btn-ghost">Ladda ner</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <Toast delay={3.2}>Verifikation A037 bokförd</Toast>
  </Shell>
);

export const LON_DEMO = [
  { title: 'Lönekörningen', where: 'Bokix · Anställda och lön', body: 'Alla anställda i samma körning. Skatten räknas enligt Skatteverkets tabeller och arbetsgivaravgiften efter ålder.', scene: KorningScene },
  { title: 'Lönebeskedet', where: 'Bokix · Lönebesked', body: 'Varje anställd får ett lönebesked som PDF, med lön, skatteavdrag och semesterdagar.', scene: LonebeskedScene },
  { title: 'Filerna och bokföringen', where: 'Bokix · Anställda och lön', body: 'När du godkänner körningen får du betalfilen till banken och AGI-filen till Skatteverket, och lönen bokförs samtidigt.', scene: GodkannScene },
];
