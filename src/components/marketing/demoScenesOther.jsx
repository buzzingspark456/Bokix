import React from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronRight, CreditCard, Info, Lock, Mail, Plus, Search, Settings2, ShieldCheck, UploadCloud, Download, Upload, X } from '../icons';
import BokixWordmark from '../shared/BokixWordmark';
import { Shell, Top, Toast, DownloadBar, Doc, Browser, SettingsShell, SetCap, SetRow, ModalSteps, ModalClose, ReviewItem } from './demoApp';

const INV_COLS2 = { gridTemplateColumns: '72px 1fr 100px 80px 98px' };

// ── Scener till DemoPlayer för /koppla-bank, /integrationer,
// /byt-bokforingsprogram och /sakerhet. Varje steg visar den riktiga sidan
// där det händer: Bokix egna vyer (ritade efter appen, se demoApp.jsx) och,
// där steget sker utanför Bokix, en neutral webbsida utan annans varumärke
// (internetbanken, Skatteverkets e-tjänst, det gamla programmet).
// Texten (titel + brödtext) kommer från respektive sidas egen lista.

const d = (s) => ({ '--d': `${s}s` });
const c = (s) => ({ '--c': `${s}s` });
const dc = (a, b) => ({ '--d': `${a}s`, '--c': `${b}s` });
const Pill = ({ kind = 'ok', children, style, className = '' }) => <span className={`ax-pill ax-${kind} ${className}`} style={style}>{children}</span>;
const Typed = ({ text, at, dur = 0.6 }) => <span className="dp-type" style={{ '--n': text.length, '--t': `${dur}s`, ...d(at) }}>{text}</span>;
const zip = (steps, scenes) => steps.map((s, i) => ({ title: s.title, body: s.body, ...scenes[i] }));
const Swap = ({ from, to, at, align = 'start' }) => (
  <span className="dp-swap" style={{ justifyItems: align }}>
    <span className="dp-gone" style={d(at)}>{from}</span>
    <span className="dp-pop" style={d(at + 0.15)}>{to}</span>
  </span>
);

// En neutral internetbank / e-tjänst: grå rubrikrad, inget varumärke.
const SiteHead = ({ name, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1f2a37', color: '#fff', fontSize: 12, fontWeight: 700 }}>
    <span>{name}</span><span style={{ fontWeight: 500, opacity: 0.75, fontSize: 11 }}>{right}</span>
  </div>
);

// ── Koppla banken ────────────────────────────────────────────────────────
const BANK_COLS = { gridTemplateColumns: '78px 1fr 96px 92px' };

const BankExport = (
  <Browser url="internetbank.dinbank.se/foretag/konton">
    <div className="ax" style={{ position: 'absolute', flexDirection: 'column' }}>
      <SiteHead name="Din bank · Företag" right="Inloggad" />
      <div style={{ padding: '14px 16px', flex: 1, background: 'var(--ax-card)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div><div className="ax-m" style={{ fontSize: 10.5 }}>Företagskonto · 1234 56 789 01</div><div className="ax-b" style={{ fontSize: 18 }}>184 320,55 kr</div></div>
          <span className="ax-btn-ghost ax-click" style={c(0.9)}><Download size={11} /> Exportera <ChevronDown size={10} /></span>
        </div>
        <div className="ax-tr ax-th" style={{ ...BANK_COLS, padding: '0 8px' }}><span>Datum</span><span>Text</span><span className="ax-num">Belopp</span><span className="ax-num ax-hide-sm">Saldo</span></div>
        {[['2026-09-26', 'Swish Testkunden AB', '+15 000,00', '184 320,55'], ['2026-09-24', 'Kortköp EXEMPELMACKEN', '−890,00', '169 320,55'], ['2026-09-22', 'Lokalhyra september', '−45 000,00', '170 210,55'], ['2026-09-18', 'Bg-bet Exempelkontor AB', '−4 250,00', '215 210,55']].map(r => (
          <div key={r[1]} className="ax-tr" style={{ ...BANK_COLS, padding: '0 8px' }}><span className="ax-s">{r[0]}</span><span>{r[1]}</span><span className="ax-num ax-b">{r[2]}</span><span className="ax-num ax-s ax-hide-sm">{r[3]}</span></div>
        ))}
        <div className="ax-card dp-pop" style={{ ...d(1.1), position: 'absolute', right: 16, top: 50, width: 150, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 3 }}>
          {['CSV (Excel)', 'Excel (.xlsx)', 'PDF'].map((f, i) => (
            <div key={f} className={i === 0 ? 'ax-click dp-flash' : ''} style={{ ...(i === 0 ? dc(1.9, 2) : {}), padding: '7px 11px', fontSize: 11.5, borderTop: i ? '1px solid var(--ax-border)' : 'none' }}>{f}</div>
          ))}
        </div>
      </div>
      <DownloadBar file="kontoutdrag-2026-09.csv" delay={2.5} />
    </div>
  </Browser>
);

// Bank (Bank.jsx): Bankkonton och Importera transaktioner uppe till höger,
// flikarna med antal och Kontroll mot banken sist.
const BANK_TABS = ['Alla · 8', 'Ej hanterade · 2', 'Matchade · 1', 'Bokförda · 4', 'Ignorerade · 1', 'Kontroll mot banken'];
const BankPageTop = ({ click = false, on = 'Alla · 8' }) => (
  <Top title="Bank" action={<><span className="ax-btn-ghost ax-hide-sm"><Settings2 size={10} /> Bankkonton</span><span className={`ax-btn${click ? ' ax-click' : ''}`} style={click ? c(0.7) : undefined}><Upload size={11} /> Importera transaktioner</span></>} tabs={BANK_TABS} on={on} />
);
const IMPORT_STEPS = ['Fil', 'Kolumner', 'Förhandsgranskning'];

const BankUpload = (
  <Shell active="bank" review={1}>
    <BankPageTop click />
    <div className="ax-body" />
    <div className="ax-scrim dp-in" style={d(1)}>
      <div className="ax-modal" style={{ width: 'min(94%, 460px)' }}>
        <div className="ax-modal-head">Importera banktransaktioner<ModalClose /></div>
        <div className="ax-modal-body">
          <ModalSteps steps={IMPORT_STEPS} on={0} />
          <div className="ax-s ax-b" style={{ fontSize: 10, marginBottom: 7 }}>+ Fler bankkonton? Lägg till ett innan du importerar</div>
          <div style={{ border: '1.5px dashed var(--ax-border)', borderRadius: 10, padding: '16px 14px', textAlign: 'center', position: 'relative' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><UploadCloud size={15} /></span>
            <div className="ax-b" style={{ marginTop: 6 }}>Ladda upp kontoutdrag</div>
            <div style={{ fontSize: 10.5 }}>Dra och släpp filen här, eller klicka för att välja</div>
            <div className="ax-m" style={{ fontSize: 9.5 }}>CSV, TXT, XLSX eller XLS (max 10 MB) — exporterat från er internetbank</div>
            <div className="dp-slide" style={{ ...d(1.6), marginTop: 9, display: 'inline-flex' }}><span className="ax-dl-file"><Doc />kontoutdrag-2026-09.csv</span></div>
          </div>
          <div className="dp-in" style={{ ...d(2.2), marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}><span className="ax-s">Läser filen...</span><span className="ax-m">14 kB</span></div>
            <div style={{ height: 5, borderRadius: 5, background: 'var(--ax-soft)', overflow: 'hidden' }}><div className="dp-grow" style={{ ...d(2.3), '--t': '1.2s', height: '100%', background: '#0b6329' }} /></div>
          </div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span></div>
      </div>
    </div>
  </Shell>
);

const COLUMN_FIELDS = [['Datum', 'Bokföringsdag', '2026-09-26', 0.6], ['Beskrivning', 'Transaction text', 'Swish Testkunden AB', 1.1], ['Belopp', 'Amount', '15000,00', 1.6]];
const BankColumns = (
  <Shell active="bank" review={1}>
    <BankPageTop />
    <div className="ax-body" />
    <div className="ax-scrim">
      <div className="ax-modal" style={{ width: 'min(94%, 480px)' }}>
        <div className="ax-modal-head">Importera banktransaktioner<ModalClose /></div>
        <div className="ax-modal-body" style={{ position: 'relative' }}>
          <span className="dp-swap" style={{ display: 'grid' }}>
            <span className="dp-gone" style={d(2.7)}><ModalSteps steps={IMPORT_STEPS} on={1} /></span>
            <span className="dp-in" style={d(2.8)}><ModalSteps steps={IMPORT_STEPS} on={2} /></span>
          </span>
          <div className="dp-gone" style={d(2.7)}>
            <div className="ax-s" style={{ fontSize: 10.5, marginBottom: 8 }}>Bokix har försökt gissa vilka kolumner som är vilka — kontrollera och rätta vid behov innan förhandsgranskning.</div>
            {COLUMN_FIELDS.map(([label, col, ex, t]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span className="ax-label" style={{ margin: 0 }}>{label}</span>
                <span className="ax-field dp-flash" style={{ ...d(t), justifyContent: 'space-between', minHeight: 24, padding: '3px 8px' }}><b style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5 }}>{col}</b><ChevronDown size={10} /></span>
              </div>
            ))}
            <div className="ax-m" style={{ fontSize: 10, marginTop: 4 }}>Exempel från första raden: 2026-09-26 · Swish Testkunden AB · +15 000,00 kr</div>
          </div>
          <div className="dp-in" style={{ ...d(2.9), position: 'absolute', left: 16, right: 16, top: 48 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><Pill>8 nya</Pill><Pill kind="gray">0 redan importerade (hoppas över)</Pill></div>
            {[['2026-09-26', 'Swish Testkunden AB', '+15 000,00'], ['2026-09-24', 'Kortköp EXEMPELMACKEN', '−890,00'], ['2026-09-22', 'Lokalhyra september', '−45 000,00']].map(r => (
              <div key={r[1]} className="ax-tr" style={{ gridTemplateColumns: '74px 1fr 76px', padding: '0 2px', minHeight: 25, fontSize: 10.5 }}><span className="ax-s">{r[0]}</span><span>{r[1]}</span><span className="ax-num ax-b">{r[2]}</span></div>
            ))}
          </div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Tillbaka</span>
          <span className="dp-swap" style={{ justifyItems: 'end' }}><span className="ax-btn ax-click dp-gone" style={dc(2.7, 2.4)}>Förhandsgranska</span><span className="ax-btn ax-click dp-in" style={dc(2.8, 3.8)}>Importera 8 transaktioner</span></span>
        </div>
      </div>
    </div>
    <Toast delay={4.1} top>8 transaktioner importerade</Toast>
  </Shell>
);

// En ej hanterad rad öppnad (Bank.jsx): Matcha mot kundfaktura, Bekräfta
// matchning, och Bokför direkt / Ignorera under.
const BANK_ROW = { gridTemplateColumns: '14px 78px 1fr 96px 84px' };
const BankRow = ({ date, text, refText, amount, plus, status, open, style, className = '' }) => (
  <div className={`ax-tr m-bank ${className}`} style={{ ...BANK_ROW, minHeight: refText ? 40 : 34, ...style }}>
    {open ? <ChevronDown size={11} className="ax-m" /> : <span />}<span className="ax-s ax-hide-sm">{date}</span>
    <span>{text}{refText && <span className="ax-m" style={{ display: 'block', fontSize: 9.5 }}>{refText}</span>}</span>
    <span className="ax-num ax-b" style={plus ? { color: 'var(--ax-g-tx)' } : undefined}>{amount}</span>{status}
  </div>
);
const BankMatch = (
  <Shell active="bank" review={1}>
    <BankPageTop />
    <div className="ax-tr ax-th m-bank" style={BANK_ROW}><span /><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span>Status</span></div>
    <BankRow date="2026-09-26" text="Testkunden AB" refText="Ref: Swish" amount="+15 000,00 kr" plus open style={{ background: 'var(--ax-g-bg)' }} status={<Swap from={<Pill kind="warn">Ej hanterad</Pill>} to={<Pill>Matchad</Pill>} at={2.5} />} />
    <div className="dp-collapse" style={{ ...d(2.7), '--h': '120px', padding: '8px 18px 10px', background: 'var(--ax-g-bg)', borderBottom: '1px solid var(--ax-border)', fontSize: 11 }}>
      <div className="ax-b" style={{ marginBottom: 5 }}>Matcha mot kundfaktura</div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ax-field ax-click" style={{ ...c(0.9), minHeight: 24, padding: '3px 8px', minWidth: 210, justifyContent: 'space-between' }}><Swap from={<span className="ax-m">Välj faktura...</span>} to={<b>1013 · Testkunden AB · 15 000,00 kr</b>} at={1.2} /><ChevronDown size={10} /></span>
        <span className="ax-btn ax-click" style={c(2.2)}><CheckCircle2 size={11} /> Bekräfta matchning</span>
      </div>
      <div className="ax-m ax-hide-sm" style={{ fontSize: 9.5, marginTop: 4 }}>Fakturan markeras betald med den här transaktionens datum (2026-09-26), inte dagens.</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 7 }}><span className="ax-btn-ghost" style={{ fontSize: 10 }}>Bokför direkt</span><span className="ax-btn-ghost" style={{ fontSize: 10 }}>Ignorera</span></div>
    </div>
    <BankRow date="2026-09-24" text="Kortköp EXEMPELMACKEN" amount="−890,00 kr" status={<Pill kind="warn">Ej hanterad</Pill>} />
    <BankRow date="2026-09-22" text="Exempelvärden AB" refText="Ref: Lokalhyra" amount="−45 000,00 kr" status={<Pill>Bokförd</Pill>} />
    <BankRow date="2026-09-18" text="Exempelkontor AB" refText="Ref: KM-3381" amount="−4 250,00 kr" status={<Pill>Matchad</Pill>} />
    <BankRow date="2026-09-16" text="Swish inbetalning" amount="+1 250,00 kr" plus status={<Pill kind="gray">Ignorerad</Pill>} />
    <Toast delay={2.8}>Faktura 1013 markerad som betald</Toast>
  </Shell>
);

export const makeBankDemo = (steps) => zip(steps, [
  { where: 'Din internetbank', scene: BankExport },
  { where: 'Bokix · Bank', scene: BankUpload },
  { where: 'Bokix · Bank · Importera', scene: BankColumns },
  { where: 'Bokix · Bank', scene: BankMatch },
]);

// ── Integrationer ───────────────────────────────────────────────────────

const StripeScene = (
  <div className="ax" style={{ flexDirection: 'column' }}>
    <Browser url="checkout.stripe.com">
      <div className="ax" style={{ position: 'absolute', background: 'var(--ax-card)' }}>
        <div className="ax-hide-sm" style={{ width: '44%', background: 'var(--ax-soft)', padding: '26px 24px', borderRight: '1px solid var(--ax-border)' }}>
          <div className="ax-s" style={{ fontSize: 11.5, fontWeight: 700 }}>Ditt Företag AB</div>
          <div className="ax-m" style={{ fontSize: 11, marginTop: 14 }}>Faktura 1013</div>
          <div className="ax-b" style={{ fontSize: 24, margin: '2px 0 14px' }}>15 000,00 kr</div>
          <div className="ax-tr" style={{ gridTemplateColumns: '1fr auto', padding: 0 }}><span>Konsulttimmar</span><span className="ax-num">11 400,00</span></div>
          <div className="ax-tr" style={{ gridTemplateColumns: '1fr auto', padding: 0 }}><span>Resa till kund</span><span className="ax-num">600,00</span></div>
          <div className="ax-tr" style={{ gridTemplateColumns: '1fr auto', padding: 0 }}><span className="ax-m">Moms</span><span className="ax-num">3 000,00</span></div>
        </div>
        <div style={{ flex: 1, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="ax-b" style={{ fontSize: 13 }}>Betala med kort</div>
          <div><div className="ax-label">Kortnummer</div><div className="ax-field"><Typed text="4242 4242 4242 4242" at={0.4} dur={0.9} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div className="ax-label">Utgångsdatum</div><div className="ax-field"><Typed text="08 / 28" at={1.4} dur={0.3} /></div></div>
            <div><div className="ax-label">CVC</div><div className="ax-field"><Typed text="123" at={1.8} dur={0.2} /></div></div>
          </div>
          <span className="ax-btn ax-click" style={{ ...c(2.3), justifyContent: 'center', padding: '9px' }}>Betala 15 000,00 kr</span>
          <div className="ax-m" style={{ fontSize: 10, textAlign: 'center' }}><Lock size={9} /> Säker betalning via Stripe</div>
        </div>
      </div>
    </Browser>
    <div className="dp-in" style={{ ...d(2.9), position: 'absolute', inset: 0, zIndex: 6 }}>
      <Shell active="invoices" review={1}>
        <style>{`@keyframes axToPaid2 { from { background: var(--ax-row-unpaid); } to { background: var(--ax-row-paid); } } .ax-topaid2 { background: var(--ax-row-paid); animation: axToPaid2 0.6s ease var(--d) both; }`}</style>
        <Top title="Kundfakturor" how sub="Fakturor du skickar till dina kunder" />
        <div className="ax-tr ax-th m-inv" style={INV_COLS2}><span>Fakturanr</span><span>Kund</span><span className="ax-hide-sm">Förfallodatum</span><span className="ax-num">Belopp</span><span>Status</span></div>
        <div className="ax-tr m-inv ax-topaid2" style={{ ...INV_COLS2, ...d(3.3) }}>
          <span className="ax-b">1013</span><span className="ax-b">Testkunden AB</span><span className="ax-s ax-hide-sm">2026-10-26</span><span className="ax-num ax-b">15 000,00</span>
          <Swap from={<Pill kind="unpaid">Obetald</Pill>} to={<Pill kind="paid"><Check strokeWidth={3} />Betald</Pill>} at={3.3} />
        </div>
        <div className="ax-tr m-inv" style={{ ...INV_COLS2, background: 'var(--ax-row-paid)' }}><span className="ax-b">1011</span><span className="ax-b">Testfastigheter AB</span><span className="ax-s ax-hide-sm">2026-10-15</span><span className="ax-num ax-b">72 500,00</span><Pill kind="paid"><Check strokeWidth={3} />Betald</Pill></div>
        <Toast delay={3.6}>Faktura 1013 är betald via Betala nu, 15 000 kr</Toast>
      </Shell>
    </div>
  </div>
);

// Zettle-fliken i Granskning (ReviewQueue.jsx ZettleLedgerCard): ett kort per
// köp, momssatsen gissad ur Zettles eget momsbelopp, intäktskontot föreslaget.
const ZettleScene = (
  <Shell active="review" review={1}>
    <Top title="Granskning" tabs={['Väntar · 1', 'Stripe', 'Zettle · 2', 'Historik']} on="Zettle · 2" />
    <div className="ax-body" style={{ padding: 0 }}>
      <div className="dp-collapse" style={{ ...d(2.6), '--h': '160px' }}>
        <ReviewItem
          icon={CreditCard}
          meta="Kortbetalning · ingen kopplad faktura — all Zettle-försäljning är kontantförsäljning · idag"
          title="Bokför försäljning 3 240 kr — kvitto 1482"
          badge={<Pill kind="warn">Kräver val</Pill>}
          extra={
            <div className="dp-in" style={{ ...d(0.6), display: 'flex', gap: 7, margin: '-2px 0 9px', flexWrap: 'wrap' }}>
              <span className="ax-field" style={{ minHeight: 24, padding: '3px 8px', gap: 6 }}>25% moms <ChevronDown size={10} /></span>
              <span className="ax-field dp-flash" style={{ ...d(1.1), minHeight: 24, padding: '3px 8px', flex: 1, minWidth: 180 }}><b>3001</b>&nbsp;Försäljning inom Sverige, 25 %</span>
            </div>
          }
          actions={<>
            <span className="ax-btn ax-click" style={c(2.2)}><Check size={11} strokeWidth={3} /> Bokför försäljning</span>
            <span className="ax-m ax-hide-sm" style={{ marginLeft: 'auto', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Info size={10} /> Visa detaljer <ChevronDown size={10} /></span>
          </>}
        />
      </div>
      <ReviewItem
        icon={CreditCard}
        meta="Kortbetalning · ingen kopplad faktura — all Zettle-försäljning är kontantförsäljning · idag"
        title="Bokför försäljning 480 kr — kvitto 1483"
        badge={<Pill kind="warn">Kräver val</Pill>}
        actions={<span className="ax-btn"><Check size={11} strokeWidth={3} /> Bokför försäljning</span>}
      />
    </div>
    <Toast delay={2.6}>Försäljningen bokförd som L014</Toast>
  </Shell>
);

// Skicka faktura (Invoices.jsx), när Gmail är kopplad under Inställningar →
// Kopplingar går mejlet från den egna adressen.
const GmailScene = (
  <Shell active="invoices" review={1}>
    <Top title="Kundfakturor" how sub="Fakturor du skickar till dina kunder" />
    <div className="ax-body" />
    <div className="ax-scrim">
      <div className="ax-modal" style={{ width: 'min(94%, 440px)' }}>
        <div className="ax-modal-head">Skicka faktura 1013<ModalClose /></div>
        <div className="ax-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><div className="ax-label">Till</div><div className="ax-field"><Typed text="ekonomi@testkunden.se" at={0.4} dur={0.8} /></div></div>
          <div><div className="ax-label">Ämne</div><div className="ax-field">Faktura 1013 från Ditt Företag AB</div></div>
          <div><div className="ax-label">Meddelande</div><div className="ax-field" style={{ alignItems: 'flex-start', flexDirection: 'column', fontSize: 10.5, lineHeight: 1.5 }}><span>Hej,</span><span>Bifogat finner du faktura 1013 på 15 000,00 kr.</span></div></div>
          <div style={{ background: 'var(--ax-soft)', border: '1px solid var(--ax-border)', borderRadius: 8, padding: '7px 9px', fontSize: 10.5 }} className="ax-s">Följer med automatiskt: fakturan som PDF och en rad med fakturanummer, belopp och förfallodatum.</div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span><span className="ax-btn ax-click" style={c(1.8)}>Skicka</span></div>
      </div>
    </div>
    <Toast delay={2.3} top>Skickad från dittforetag@gmail.com</Toast>
  </Shell>
);

const BolagsverketScene = (
  <div className="ax" style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div className="ax-card" style={{ width: 'min(92%, 400px)', padding: '20px 22px', boxShadow: '0 20px 50px -24px rgba(0,0,0,0.35)' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}><BokixWordmark height={28} /></div>
      <div className="ax-b" style={{ fontSize: 15, textAlign: 'center', marginBottom: 14 }}>Lägg till företag</div>
      <div className="ax-label">Organisationsnummer</div>
      <div style={{ display: 'flex', gap: 7 }}>
        <div className="ax-field" style={{ flex: 1 }}><Typed text="559123-4567" at={0.3} dur={0.7} /></div>
      </div>
      <div className="ax-s dp-in" style={{ ...d(1.1), fontSize: 10.5, marginTop: 6 }}><span className="dp-swap" style={{ justifyItems: 'start' }}><span className="dp-gone" style={d(1.8)}>Hämtar företagsuppgifter…</span><span className="dp-in" style={{ ...d(1.9), color: 'var(--ax-g-tx)', fontWeight: 600 }}>Hämtat från Bolagsverket. Ändra gärna om något inte stämmer.</span></span></div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['Företagsnamn', 'Testkunden AB'], ['Bolagsform', 'Aktiebolag'], ['Adress', 'Linnégatan 12, 413 04 Göteborg']].map(([k, v], i) => (
          <div key={k} className="dp-in" style={{ ...d(1.8 + i * 0.25), display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--ax-border)', fontSize: 11.5 }}><span className="ax-m">{k}</span><span className="ax-b">{v}</span></div>
        ))}
      </div>
    </div>
  </div>
);

const SkatteverketScene = (
  <Browser url="skatteverket.se/e-tjanster/moms">
    <div className="ax" style={{ position: 'absolute', flexDirection: 'column' }}>
      <SiteHead name="E-tjänst: Momsdeklaration" right="Testkunden AB" />
      <div style={{ flex: 1, padding: '16px 18px', background: 'var(--ax-card)', position: 'relative' }}>
        <div className="ax-b" style={{ fontSize: 13.5 }}>Lämna momsdeklaration via fil</div>
        <div className="ax-m" style={{ fontSize: 11, marginBottom: 10 }}>Period: juli – september 2026</div>
        <div style={{ border: '1.5px dashed var(--ax-border)', borderRadius: 9, padding: '14px', textAlign: 'center' }}>
          <div className="ax-m" style={{ fontSize: 11 }}>Välj fil att ladda upp</div>
          <div className="dp-slide" style={{ ...d(0.5), marginTop: 7, display: 'inline-flex' }}><span className="ax-dl-file"><Doc />moms-2026-kv3.xml</span></div>
        </div>
        <div className="dp-in" style={{ ...d(1.3), marginTop: 10, border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
          {[['05', '28 150'], ['10', '7 038'], ['48', '441'], ['49 Att betala', '6 597']].map(([r, v], i) => (
            <div key={r} className="ax-tr" style={{ gridTemplateColumns: '1fr auto', padding: '0 10px', minHeight: 24, fontWeight: i === 3 ? 700 : 400, borderBottom: i < 3 ? '1px solid var(--ax-border)' : 'none' }}><span>Ruta {r}</span><span className="ax-num">{v}</span></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><span className="ax-btn ax-click" style={c(2.2)}>Signera</span></div>
        <div className="ax-scrim dp-in" style={{ ...d(2.6), position: 'absolute' }}>
          <div className="ax-modal" style={{ width: 'min(88%, 280px)', textAlign: 'center', padding: '18px 16px' }}>
            <div className="dp-spin" style={{ margin: '0 auto 10px', '--d': '6s' }} />
            <div className="ax-b" style={{ fontSize: 13 }}>Öppna BankID-appen</div>
            <div className="ax-m" style={{ fontSize: 11, marginTop: 3 }}>Du signerar deklarationen själv.</div>
          </div>
        </div>
      </div>
    </div>
  </Browser>
);

// Kontoplanen (AccountsPanel.jsx): kontoklasserna som hopfällbara rader med
// antal konton och saldo; en sökning öppnar klassen med träffarna.
const KONTO_CLASSES = [['1000–1999 Tillgångar', 41, '465 151,00'], ['2000–2999 Eget kapital och skulder', 96, '−133 318,00'], ['3000–3999 Intäkter', 38, '−676 200,00'], ['4000–4999 Kostnader, varuinköp', 52, '0,00'], ['5000–5999 Övriga externa kostnader', 84, '215 200,00'], ['6000–6999 Övriga externa kostnader', 79, '91 799,00'], ['7000–7999 Personalkostnader', 88, '70 968,00'], ['8000–8999 Finansiella poster och skatt', 61, '0,00']];
const ACC_ROW = { gridTemplateColumns: '50px 1fr 84px 40px', padding: '0 12px', minHeight: 27, fontSize: 11 };
const BasScene = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" how tabs={['Verifikationer', 'Kontoplan']} on="Kontoplan" />
    <div className="ax-body">
      <div className="ax-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--ax-border)' }}>
          <div className="ax-search" style={{ maxWidth: 190, color: 'var(--ax-text)' }}><Search size={11} /><span className="dp-swap" style={{ justifyItems: 'start' }}><span className="ax-m dp-gone" style={d(0.8)}>Sök kontonummer eller namn...</span><Typed text="drivm" at={0.8} dur={0.5} /></span></div>
          <span className="ax-seg ax-hide-sm"><span>Mina konton</span><span className="on">Alla konton</span></span>
          <span className="ax-pill ax-paid ax-hide-sm" style={{ marginLeft: 'auto', padding: '3px 9px' }}>Nytt konto</span>
        </div>
        {KONTO_CLASSES.map(([label, n, sum]) => {
          const hit = label.startsWith('5000');
          const neg = sum.startsWith('−');
          const head = (
            <div className="ax-tr" style={{ gridTemplateColumns: '12px 1fr auto auto', padding: '0 12px', minHeight: 29 }}>
              {hit ? <span className="dp-swap"><ChevronRight size={10} className="dp-gone" style={d(1.5)} /><ChevronDown size={10} className="dp-in" style={d(1.5)} /></span> : <ChevronRight size={10} />}
              <span className="ax-b" style={{ fontSize: 11 }}>{label}</span>
              <span className="ax-m ax-hide-sm" style={{ fontSize: 9.5 }}>{hit ? <Swap from={`${n} konton`} to="1 konto" at={1.4} /> : `${n} konton`}</span>
              <span className="ax-num ax-b" style={{ fontSize: 11, color: neg ? 'var(--ax-r-tx)' : 'var(--ax-g-tx)', minWidth: 74 }}>{sum}</span>
            </div>
          );
          if (!hit) return <div key={label} className="dp-collapse" style={{ ...d(1.4), '--h': '30px' }}>{head}</div>;
          return (
            <div key={label}>
              {head}
              <div className="dp-in" style={{ ...d(1.6), background: 'var(--ax-soft)' }}>
                <div className="ax-tr ax-th" style={{ ...ACC_ROW, minHeight: 21, fontSize: 8.5 }}><span>Konto</span><span>Kontonamn</span><span className="ax-num">Saldo</span><span>Aktiv</span></div>
                <div className="ax-tr dp-flash" style={{ ...ACC_ROW, ...d(1.9), borderBottom: 'none' }}><span className="ax-b">5611</span><span>Drivmedel för personbilar</span><span className="ax-num">1 424,00</span><span style={{ width: 22, height: 12, borderRadius: 999, background: '#16a34a', position: 'relative' }}><span style={{ position: 'absolute', right: 2, top: 2, width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /></span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </Shell>
);

const INTEGRATION_SCENES = {
  stripe: { title: 'Stripe', where: 'Kundens betalsida → Bokix', scene: StripeScene },
  zettle: { title: 'Zettle', where: 'Bokix · Granskning · Zettle', scene: ZettleScene },
  gmail: { title: 'Gmail', where: 'Bokix · Kundfakturor · Skicka', scene: GmailScene },
  bolagsverket: { title: 'Bolagsverket', where: 'Bokix · Lägg till företag', scene: BolagsverketScene },
  skatteverket: { title: 'Skatteverket', where: 'Skatteverkets e-tjänst', scene: SkatteverketScene },
  bas: { title: 'BAS-kontoplanen', where: 'Bokix · Bokföring · Kontoplan', scene: BasScene },
};
export const makeIntegrationDemo = (connections) => connections
  .filter(conn => INTEGRATION_SCENES[conn.key])
  .map(conn => ({ ...INTEGRATION_SCENES[conn.key], body: conn.body }));

// ── Byt till Bokix ───────────────────────────────────────────────────────

const OldProgram = (
  <Browser url="app.dittgamlaprogram.se">
    <div className="ax" style={{ position: 'absolute', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 16, padding: '8px 14px', background: 'var(--ax-soft)', borderBottom: '1px solid var(--ax-border)', fontSize: 11.5 }}>
        <span className="ax-b ax-click" style={c(0.6)}>Arkiv</span><span>Redigera</span><span>Rapporter</span><span>Hjälp</span>
      </div>
      <div style={{ flex: 1, background: 'var(--ax-card)', padding: 14, position: 'relative' }}>
        <div className="ax-m" style={{ fontSize: 11 }}>Verifikationslista 2026</div>
        {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 9, borderRadius: 4, background: 'var(--ax-soft)', margin: '10px 0', width: `${90 - i * 9}%` }} />)}
        <div className="ax-card dp-pop" style={{ ...d(0.8), position: 'absolute', left: 10, top: 0, width: 180, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.3)', zIndex: 3, overflow: 'hidden' }}>
          {['Nytt räkenskapsår', 'Importera', 'Exportera', 'Skriv ut'].map(x => (
            <div key={x} className={x === 'Exportera' ? 'dp-flash' : ''} style={{ ...(x === 'Exportera' ? d(1.3) : {}), padding: '7px 11px', fontSize: 11.5, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ax-border)' }}>{x}{x === 'Exportera' && <ChevronRight size={10} />}</div>
          ))}
        </div>
        <div className="ax-card dp-pop" style={{ ...d(1.6), position: 'absolute', left: 186, top: 60, width: 170, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.3)', zIndex: 4, overflow: 'hidden' }}>
          {['SIE typ 4 (.se)', 'Excel', 'PDF'].map((x, i) => <div key={x} className={i === 0 ? 'ax-click dp-flash' : ''} style={{ ...(i === 0 ? dc(2.3, 2.4) : {}), padding: '7px 11px', fontSize: 11.5, borderTop: i ? '1px solid var(--ax-border)' : 'none' }}>{x}</div>)}
        </div>
      </div>
      <DownloadBar file="bokforing-2026.se" delay={2.9} />
    </div>
  </Browser>
);

// Inställningar → Import och export (Settings.jsx): platta rader under
// Importera / Exportera, och SIE-importen som en guide i fyra steg.
const ImportExport = ({ children, clickRow }) => (
  <SettingsShell section="Import och export">
    <SetCap>Importera</SetCap>
    <SetRow title="Flytta hit bokföringen" desc="Från ett annat program, via SIE4." {...clickable(clickRow === 'import')}><ChevronRight size={11} className="ax-m" /></SetRow>
    <SetRow title="Skattekontoutdrag" desc="Bokför preliminärskatt, moms, räntor och inbetalningar på skattekontot."><ChevronRight size={11} className="ax-m" /></SetRow>
    <SetRow title="Underlag till SIE-import" desc="Filer som heter som verifikatet, till exempel A31.pdf."><ChevronRight size={11} className="ax-m" /></SetRow>
    <SetCap>Exportera</SetCap>
    <SetRow title="SIE4-fil" desc="Ge filen till din revisor, eller ta med bokföringen till ett annat program." {...clickable(clickRow === 'sie')}><Download size={11} className="ax-m" /></SetRow>
    <SetRow title="Säkerhetskopia" desc="Konton, verifikationer, fakturor, kvitton och kontakter."><Download size={11} className="ax-m" /></SetRow>
    {children}
  </SettingsShell>
);
const clickable = (on) => (on ? { className: 'ax-click', style: c(0.8) } : {});
const SIE_STEPS = ['Program', 'Fil', 'Kontomappning', 'Förhandsgranskning'];

const SieImport = (
  <ImportExport clickRow="import">
    <div className="ax-scrim dp-in" style={d(1)}>
      <div className="ax-modal" style={{ width: 'min(94%, 460px)' }}>
        <div className="ax-modal-head">Importera bokföring (SIE4)<ModalClose /></div>
        <div className="ax-modal-body">
          <ModalSteps steps={SIE_STEPS} on={1} />
          <div style={{ border: '1.5px dashed var(--ax-border)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div className="ax-s" style={{ fontSize: 10.5 }}>Dra in SIE-filen här, eller klicka för att välja</div>
            <div className="dp-slide" style={{ ...d(1.4), marginTop: 7, display: 'inline-flex' }}><span className="ax-dl-file"><Doc />bokforing-2026.se</span></div>
          </div>
          <div style={{ height: 5, borderRadius: 5, background: 'var(--ax-soft)', overflow: 'hidden', margin: '10px 0' }}><div className="dp-grow" style={{ ...d(1.7), '--t': '1s', height: '100%', background: '#0b6329' }} /></div>
          {[['Konton', '142'], ['Verifikationer', '1 318'], ['Ingående balanser', 'Ja'], ['Räkenskapsår', '2026-01-01 – 2026-12-31']].map(([k, v], i) => (
            <div key={k} className="dp-in" style={{ ...d(2.8 + i * 0.2), display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--ax-border)', fontSize: 11.5 }}><span className="ax-m">{k}</span><span className="ax-b">{v}</span></div>
          ))}
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span><span className="ax-btn dp-in" style={d(3.6)}>Fortsätt till kontomappning</span></div>
      </div>
    </div>
  </ImportExport>
);

const MAP_COLS = { gridTemplateColumns: '1fr 1fr 96px', padding: '0 10px' };
const SieMapping = (
  <ImportExport>
    <div className="ax-scrim">
      <div className="ax-modal" style={{ width: 'min(94%, 500px)' }}>
        <div className="ax-modal-head">Importera bokföring (SIE4)<ModalClose /></div>
        <div className="ax-modal-body" style={{ padding: '10px 14px' }}>
          <ModalSteps steps={SIE_STEPS} on={2} />
          <div style={{ border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="ax-tr ax-th" style={MAP_COLS}><span>I filen</span><span>I Bokix</span><span>Status</span></div>
            <div className="ax-tr" style={MAP_COLS}><span>6071 Representation</span><span>6071 Representation</span><Pill>Finns</Pill></div>
            <div className="ax-tr" style={MAP_COLS}><span>1920 Plusgiro</span><span>1920 Plusgiro</span><Pill>Finns</Pill></div>
            <div className="ax-tr dp-flash" style={{ ...MAP_COLS, ...d(0.5) }}>
              <span>1931 Swishkonto</span>
              <span className="ax-field ax-click" style={{ ...c(1.2), minHeight: 22, padding: '2px 7px', justifyContent: 'space-between' }}><Swap from={<span className="ax-m">Välj…</span>} to={<b>Lägg till som nytt</b>} at={1.6} /><ChevronDown size={10} /></span>
              <Swap from={<Pill kind="warn">Saknas</Pill>} to={<Pill>Nytt konto</Pill>} at={1.7} />
            </div>
            <div className="ax-tr" style={{ ...MAP_COLS, borderBottom: 'none' }}><span>2640 Ingående moms</span><span>2640 Ingående moms</span><Pill>Finns</Pill></div>
          </div>
          <div className="ax-m" style={{ fontSize: 10.5, marginTop: 8 }}>Ingenting skrivs in i bokföringen förrän du bekräftar.</div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Tillbaka</span><span className="ax-btn ax-click" style={c(2.7)}>Vidare till förhandsgranskning</span></div>
      </div>
    </div>
  </ImportExport>
);

const SIE_COLS = { gridTemplateColumns: '14px 84px 78px 1fr 84px 62px' };
const SieDone = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" how action={<><span className="ax-next ax-hide-sm">Nästa: <b>A1319</b></span><span className="ax-btn"><Plus size={11} /> Ny verifikation</span></>} tabs={['Verifikationer', 'Kontoplan']} on="Verifikationer" />
    <div className="ax-tr ax-th m-sie" style={SIE_COLS}><span className="ax-hide-sm" /><span>Verifikation</span><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span className="ax-hide-sm">Status</span></div>
    <div className="ax-month"><span>September 2026</span><span>112 verifikationer</span></div>
    {[['A1318', '2026-09-26', 'Hyra oktober', '9 500,00'], ['A1317', '2026-09-25', 'Faktura 1082', '18 750,00'], ['A1316', '2026-09-24', 'Kontorsmaterial', '1 240,00'], ['A1315', '2026-09-22', 'Lön september', '31 668,00'], ['A1314', '2026-09-20', 'Faktura 1081', '9 400,00'], ['A1313', '2026-09-18', 'Telefoni', '449,00']].map((r, i) => (
      <div key={r[0]} className="ax-tr m-sie dp-slide" style={{ ...SIE_COLS, ...d(0.3 + i * 0.18) }}>
        <ChevronRight size={11} className="ax-m ax-hide-sm" /><span className="ax-b">{r[0]}</span><span className="ax-s ax-hide-sm">{r[1]}</span><span>{r[2]}</span><span className="ax-num ax-b">{r[3]}</span><Pill className="ax-hide-sm">Bokförd</Pill>
      </div>
    ))}
    <Toast delay={1.9}>1 318 verifikationer importerade</Toast>
  </Shell>
);

export const makeSwitchDemo = (steps) => zip(steps, [
  { where: 'Ditt nuvarande program', scene: OldProgram },
  { where: 'Bokix · Inställningar · Import och export', scene: SieImport },
  { where: 'Bokix · Importera bokföring (SIE4)', scene: SieMapping },
  { where: 'Bokix · Bokföring', scene: SieDone },
]);

// ── Säkerhet ─────────────────────────────────────────────────────────────

const LoginCard = ({ children }) => (
  <div className="ax" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--ax-g-bg)' }}>
    <div className="ax-card" style={{ width: 'min(92%, 340px)', padding: '22px 22px', borderRadius: 18, boxShadow: '0 20px 50px -24px rgba(0,0,0,0.35)', textAlign: 'center', border: 'none' }}>
      {children}
    </div>
  </div>
);

const SecEncrypt = (
  <Browser url="www.bokix.se">
    <div className="ax" style={{ position: 'absolute' }}>
      <Shell active="dashboard" review={1}>
        <Top title="Hej Testkunden AB" sub="Räkenskapsår 2026" />
        <div className="ax-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, alignContent: 'start' }}>
          {[['Intäkter', '1 284 500 kr'], ['Kostnader', '812 300 kr'], ['Resultat', '472 200 kr']].map(([k, v]) => (
            <div key={k} className="ax-card" style={{ padding: '10px 12px' }}><div className="ax-m" style={{ fontSize: 10.5 }}>{k}</div><div className="ax-b" style={{ fontSize: 15 }}>{v}</div></div>
          ))}
        </div>
      </Shell>
    </div>
    <div className="ax-card dp-pop" style={{ ...d(0.8), position: 'absolute', left: 14, top: 6, width: 260, padding: '12px 14px', zIndex: 7, boxShadow: '0 16px 40px -14px rgba(0,0,0,0.4)' }}>
      <div className="ax-b" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Lock size={12} color="#16a34a" /> Anslutningen är säker</div>
      <div className="ax-m" style={{ fontSize: 11, margin: '4px 0 8px' }}>Allt du skickar till www.bokix.se är krypterat, och webbläsaren tvingas alltid använda HTTPS.</div>
      <div className="dp-in" style={{ ...d(1.8), display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 7, borderTop: '1px solid var(--ax-border)' }}><span className="ax-m">Data i databasen</span><span className="ax-b">Krypterad i vila</span></div>
    </div>
  </Browser>
);

// Inloggningens tvåstegsruta (App.jsx MfaChallenge): grön sköld, sex rutor.
const Sec2fa = (
  <LoginCard>
    <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(160deg, #0b6329, #0e3a2a)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><ShieldCheck size={20} /></span>
    <div className="ax-b" style={{ fontSize: 15 }}>Tvåstegsverifiering</div>
    <div className="ax-s" style={{ fontSize: 11, margin: '3px 0 14px' }}>Ange den 6-siffriga koden från din autentiseringsapp.</div>
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {['4', '8', '2', '1', '9', '0'].map((n, i) => (
        <span key={i} className="ax-field" style={{ width: 32, height: 40, justifyContent: 'center', fontSize: 17, fontWeight: 700, fontFamily: 'monospace', background: 'var(--ax-soft)' }}><span className="dp-pop" style={d(0.5 + i * 0.22)}>{n}</span></span>
      ))}
    </div>
    <span className="ax-btn ax-click" style={{ ...c(2.2), marginTop: 14, width: '100%', justifyContent: 'center', padding: 9, boxSizing: 'border-box' }}>Verifiera</span>
    <div className="ax-s" style={{ fontSize: 10.5, marginTop: 8 }}>Avbryt och logga ut</div>
    <div className="dp-in" style={{ ...d(2.6), marginTop: 8 }}><Pill><Check strokeWidth={3} />Inloggad</Pill></div>
  </LoginCard>
);

const SecSession = (
  <div className="ax" style={{ flexDirection: 'column' }}>
    <div style={{ display: 'flex', gap: 4, padding: '7px 10px 0', background: 'var(--ax-soft)', borderBottom: '1px solid var(--ax-border)' }}>
      <span style={{ padding: '6px 12px', fontSize: 11, borderRadius: '7px 7px 0 0' }} className="ax-s">Mejl</span>
      <span className="dp-collapse-x" style={{ ...d(1.1), padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: '7px 7px 0 0', background: 'var(--ax-card)', display: 'inline-flex', gap: 10, alignItems: 'center' }}>Bokix · Bokföring <span className="ax-click" style={c(0.9)}><X size={10} /></span></span>
      <span className="dp-in" style={{ ...d(1.8), padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: '7px 7px 0 0', background: 'var(--ax-card)' }}>www.bokix.se</span>
    </div>
    <div style={{ flex: 1, position: 'relative' }}>
      <div className="dp-gone" style={{ ...d(1.1), position: 'absolute', inset: 0 }}>
        <Shell active="verifications" review={1}><Top title="Bokföring" how tabs={['Verifikationer', 'Kontoplan']} on="Verifikationer" /><div className="ax-body" /></Shell>
      </div>
      <div className="dp-in" style={{ ...d(2), position: 'absolute', inset: 0 }}>
        <LoginCard>
          <div style={{ marginBottom: 10 }}><BokixWordmark height={26} /></div>
          <div className="ax-b" style={{ fontSize: 14 }}>Logga in</div>
          <div className="ax-m" style={{ fontSize: 11, margin: '3px 0 12px' }}>Inloggningen fanns bara i fliken du stängde.</div>
          <div className="ax-field" style={{ marginBottom: 7 }}><span className="ax-m">E-post</span></div>
          <div className="ax-field" style={{ marginBottom: 10 }}><span className="ax-m">Lösenord</span></div>
          <span className="ax-btn" style={{ width: '100%', justifyContent: 'center', padding: 8, boxSizing: 'border-box' }}>Logga in</span>
        </LoginCard>
      </div>
    </div>
  </div>
);

// Inställningar → Användare (Settings.jsx): tabellen Användare, Roll, Status, Sidor.
const USER_COLS = { gridTemplateColumns: '1.4fr 1fr 74px', padding: '0 12px' };
const SecInvite = (
  <SettingsShell section="Användare">
    <SetCap>Vem kommer åt företaget</SetCap>
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '7px 0' }}><span className="ax-btn ax-click" style={c(0.6)}><Mail size={11} /> Bjud in användare</span></div>
    <div className="ax-card" style={{ overflow: 'hidden' }}>
      <div className="ax-tr ax-th" style={USER_COLS}><span>Användare</span><span>Roll</span><span>Status</span></div>
      <div className="ax-tr" style={{ ...USER_COLS, minHeight: 38 }}><span><b>Du</b><span className="ax-s" style={{ display: 'block', fontSize: 10 }}>du@testkunden.se</span></span><span>Administratör</span><Pill>Aktiv</Pill></div>
      <div className="ax-tr dp-slide" style={{ ...USER_COLS, ...d(3), minHeight: 38, borderBottom: 'none' }}><span><b>Sara</b><span className="ax-s" style={{ display: 'block', fontSize: 10 }}>sara@revisionsbyra.se</span></span><span>Kan bara läsa</span><Pill kind="warn">Inbjuden</Pill></div>
    </div>
    <div className="ax-m" style={{ fontSize: 10, marginTop: 7 }}>Max 3 användare per företag (du + 2 inbjudna).</div>
    <div className="ax-scrim dp-gone" style={d(2.7)}>
      <div className="ax-modal dp-pop" style={d(0.9)}>
        <div className="ax-modal-head">Bjud in användare<ModalClose /></div>
        <div className="ax-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><div className="ax-label">E-post</div><div className="ax-field"><Typed text="sara@revisionsbyra.se" at={1.2} dur={0.8} /></div></div>
          <div><div className="ax-label">Roll</div><div className="ax-field" style={{ justifyContent: 'space-between' }}>Kan bara läsa<ChevronDown size={10} /></div></div>
          <div className="ax-m" style={{ fontSize: 10.5 }}>Inbjudan är en engångslänk. Behörigheten kontrolleras i databasen.</div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Avbryt</span><span className="ax-btn ax-click" style={c(2.3)}>Skicka inbjudan</span></div>
      </div>
    </div>
    <Toast delay={3}>Inbjudan skickad till sara@revisionsbyra.se</Toast>
  </SettingsShell>
);

// Var datan ligger står i integritetspolicyn, inte i appen, så scenen visar
// den riktiga sidan på www.bokix.se.
const SecEu = (
  <Browser url="www.bokix.se/integritetspolicy">
    <div className="ax" style={{ position: 'absolute', flexDirection: 'column', background: 'var(--ax-card)' }}>
      <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--ax-border)' }}><BokixWordmark height={20} /></div>
      <div style={{ padding: '14px 22px', maxWidth: 520 }}>
        <div className="ax-m ax-b" style={{ fontSize: 9.5, letterSpacing: '0.06em' }}>INTEGRITETSPOLICY</div>
        <div className="ax-b" style={{ fontSize: 15, margin: '6px 0 6px' }}>4. Vilka vi delar uppgifter med</div>
        <div className="ax-s" style={{ fontSize: 11, lineHeight: 1.6 }}>
          <b style={{ color: 'var(--ax-text)' }}>Supabase</b> — databas- och autentiseringsleverantör. All bokförings- och kontodata, inklusive de kvitton och underlag du laddar upp, lagras hos Supabase på våra vägnar <span className="ax-receipt-hl" style={{ ...d(0.9), color: 'var(--ax-text)', fontWeight: 600 }}>i ett datacenter inom EU (Frankfurt, Tyskland)</span>.
        </div>
        <div className="ax-b dp-in" style={{ ...d(1.6), fontSize: 15, margin: '14px 0 6px' }}>6. Överföring utanför EU/EES</div>
        <div className="ax-s dp-in" style={{ ...d(1.8), fontSize: 11, lineHeight: 1.6 }}>Själva lagringen av din bokföring — databasen och de filer du laddar upp — sker <span className="ax-receipt-hl" style={{ ...d(2.3), color: 'var(--ax-text)', fontWeight: 600 }}>inom EU, i Frankfurt, Tyskland</span>.</div>
      </div>
    </div>
  </Browser>
);

const SecExport = (
  <ImportExport clickRow="sie">
    <div className="dp-in ax-m" style={{ ...d(1.8), marginTop: 10, fontSize: 11 }}>Ingen behöver godkänna exporten. Den är din.</div>
    <DownloadBar file="bokforing-2026.se" delay={1.3} />
  </ImportExport>
);

export const makeSecurityDemo = (facts) => zip(facts, [
  { where: 'www.bokix.se', scene: SecEncrypt },
  { where: 'Bokix · Logga in', scene: Sec2fa },
  { where: 'Webbläsaren', scene: SecSession },
  { where: 'Bokix · Inställningar · Användare', scene: SecInvite },
  { where: 'www.bokix.se · Integritetspolicy', scene: SecEu },
  { where: 'Bokix · Inställningar · Import och export', scene: SecExport },
]);
