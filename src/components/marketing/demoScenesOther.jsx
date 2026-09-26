import React from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Plus, UploadCloud, Download, Upload, X } from '../icons';
import BokixWordmark from '../shared/BokixWordmark';
import { Shell, Top, Toast, DownloadBar, Doc, Browser } from './demoApp';

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

const BankPageTop = () => (
  <Top title="Bank" action={<span className="ax-btn ax-click" style={c(0.7)}><UploadCloud size={11} /> Importera transaktioner</span>} tabs={['Alla · 8', 'Ej hanterade · 2', 'Matchade · 1', 'Bokförda · 4', 'Avstämning']} on="Alla · 8" />
);

const BankUpload = (
  <Shell active="bank" review={1}>
    <BankPageTop />
    <div className="ax-body" />
    <div className="ax-scrim dp-in" style={d(1)}>
      <div className="ax-modal">
        <div className="ax-modal-head">Importera transaktioner<X size={13} className="ax-m" /></div>
        <div className="ax-modal-body">
          <div style={{ border: '1.5px dashed var(--ax-border)', borderRadius: 10, padding: '18px 14px', textAlign: 'center', position: 'relative' }}>
            <UploadCloud size={22} className="ax-m" />
            <div className="ax-b" style={{ marginTop: 6 }}>Dra in filen här</div>
            <div className="ax-m" style={{ fontSize: 10.5 }}>CSV, TXT, XLSX eller XLS · upp till 10 MB</div>
            <div className="dp-slide" style={{ ...d(1.6), marginTop: 10, display: 'inline-flex' }}><span className="ax-dl-file"><Doc />kontoutdrag-2026-09.csv</span></div>
          </div>
          <div className="dp-in" style={{ ...d(2.2), marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}><span className="ax-s">Läser filen…</span><span className="ax-m">14 kB</span></div>
            <div style={{ height: 5, borderRadius: 5, background: 'var(--ax-soft)', overflow: 'hidden' }}><div className="dp-grow" style={{ ...d(2.3), '--t': '1.2s', height: '100%', background: '#0b6329' }} /></div>
          </div>
          <div className="dp-in" style={{ ...d(3.6), marginTop: 10 }}><Pill><Check strokeWidth={3} />8 transaktioner hittade</Pill></div>
        </div>
      </div>
    </div>
  </Shell>
);

const BankColumns = (
  <Shell active="bank" review={1}>
    <BankPageTop />
    <div className="ax-body" />
    <div className="ax-scrim">
      <div className="ax-modal" style={{ width: 'min(94%, 520px)' }}>
        <div className="ax-modal-head">Bekräfta kolumnerna<span className="ax-m" style={{ fontWeight: 500, fontSize: 11 }}>Steg 2 av 3</span></div>
        <div className="ax-modal-body">
          <div className="ax-m" style={{ fontSize: 11, marginBottom: 8 }}>Bokix har gissat vad varje kolumn är. Rätta om något blev fel.</div>
          <div style={{ border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', background: 'var(--ax-head)' }}>
              {[['Bokföringsdag', 'Datum', 0.6], ['Transaction text', 'Text', 1.1], ['Amount', 'Belopp', 1.6]].map(([h, m, t]) => (
                <div key={h} style={{ padding: '7px 9px', borderRight: '1px solid var(--ax-border)' }}>
                  <div className="ax-m" style={{ fontSize: 9.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>{h}</div>
                  <div className="ax-field dp-flash" style={{ ...d(t), marginTop: 4, justifyContent: 'space-between', padding: '3px 7px', minHeight: 22 }}><b>{m}</b><ChevronDown size={10} /></div>
                </div>
              ))}
            </div>
            {[['2026-09-26', 'Swish Testkunden AB', '15000,00'], ['2026-09-24', 'Kortköp EXEMPELMACKEN', '-890,00'], ['2026-09-22', 'Lokalhyra september', '-45000,00']].map(r => (
              <div key={r[1]} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', fontSize: 11, borderTop: '1px solid var(--ax-border)' }}>
                {r.map((x, i) => <span key={i} style={{ padding: '6px 9px' }} className={i === 2 ? 'ax-num' : ''}>{x}</span>)}
              </div>
            ))}
          </div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Tillbaka</span><span className="ax-btn ax-click" style={c(2.6)}>Läs in 8 rader</span></div>
      </div>
    </div>
    <Toast delay={3.2} top>8 transaktioner inlästa</Toast>
  </Shell>
);

const BankMatch = (
  <Shell active="bank" review={1}>
    <Top title="Bank" action={<span className="ax-btn"><UploadCloud size={11} /> Importera transaktioner</span>} tabs={['Alla · 8', 'Ej hanterade · 2', 'Matchade · 1', 'Bokförda · 4', 'Avstämning']} on="Ej hanterade · 2" />
    <div className="ax-tr ax-th m-bank" style={BANK_COLS}><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span>Status</span></div>
    <div className="ax-tr m-bank" style={BANK_COLS}><span className="ax-s ax-hide-sm">2026-09-26</span><span>Swish Testkunden AB<span className="ax-m" style={{ display: 'block', fontSize: 10 }}>Ref: Faktura 1013</span></span><span className="ax-num ax-b" style={{ color: 'var(--ax-g-tx)' }}>+15 000,00</span><Swap from={<Pill kind="warn">Ej hanterad</Pill>} to={<Pill>Matchad</Pill>} at={1.8} /></div>
    <div className="dp-collapse" style={{ ...d(2.2), '--h': '80px', padding: '8px 18px 10px', background: 'var(--ax-g-bg)', borderBottom: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11.5 }}>
      <span><b>Förslag:</b> Faktura 1013 · Testkunden AB · 15 000,00 kr</span>
      <span className="ax-btn ax-click" style={c(1.5)}>Matcha</span>
    </div>
    <div className="ax-tr m-bank" style={BANK_COLS}><span className="ax-s ax-hide-sm">2026-09-24</span><span>Kortköp EXEMPELMACKEN</span><span className="ax-num ax-b">−890,00</span><Swap from={<Pill kind="warn">Ej hanterad</Pill>} to={<Pill>Bokförd 5611</Pill>} at={3.4} /></div>
    <div className="dp-in" style={{ ...d(2.5), padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, borderBottom: '1px solid var(--ax-border)' }}>
      <span className="ax-m">Snabbokför på</span><span className="ax-field" style={{ minHeight: 24, padding: '3px 8px' }}>5611 Drivmedel</span><span className="ax-btn ax-click" style={c(3.2)}>Bokför</span>
    </div>
    <div className="ax-tr m-bank" style={BANK_COLS}><span className="ax-s ax-hide-sm">2026-09-22</span><span>Lokalhyra september</span><span className="ax-num ax-b">−45 000,00</span><Pill>Bokförd</Pill></div>
    <div className="ax-tr m-bank" style={BANK_COLS}><span className="ax-s ax-hide-sm">2026-09-18</span><span>Bg-bet Exempelkontor AB</span><span className="ax-num ax-b">−4 250,00</span><Pill>Matchad</Pill></div>
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
      <Shell active="review" review={0}>
        <Top title="Granskning" tabs={['Väntar · 0', 'Stripe · 4', 'Zettle · 3', 'Historik']} on="Stripe · 4" />
        <div className="ax-tr ax-th" style={{ gridTemplateColumns: '1fr 90px 90px' }}><span>Betalning</span><span className="ax-num">Belopp</span><span>Status</span></div>
        <div className="ax-tr dp-flash" style={{ gridTemplateColumns: '1fr 90px 90px', ...d(3.2), minHeight: 44 }}>
          <span><b>Kortbetalning · Faktura 1013</b><span className="ax-m" style={{ display: 'block', fontSize: 10 }}>Testkunden AB · Stripe-avgift bokförd separat</span></span>
          <span className="ax-num ax-b">15 000,00</span><Pill className="dp-pop" style={d(3.5)}><Check strokeWidth={3} />Bokförd</Pill>
        </div>
        <div className="ax-tr" style={{ gridTemplateColumns: '1fr 90px 90px', minHeight: 44 }}><span><b>Kortbetalning · Faktura 1011</b><span className="ax-m" style={{ display: 'block', fontSize: 10 }}>Testfastigheter AB</span></span><span className="ax-num ax-b">72 500,00</span><Pill>Bokförd</Pill></div>
      </Shell>
    </div>
  </div>
);

const ZettleScene = (
  <Shell active="review" review={1}>
    <Top title="Granskning" tabs={['Väntar · 1', 'Stripe · 3', 'Zettle · 3', 'Historik']} on="Zettle · 3" />
    <div className="ax-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="ax-card dp-slide" style={{ ...d(0.3), padding: '11px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div className="ax-m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em' }}>ZETTLE · DAGSAVSLUT</div>
            <div className="ax-b" style={{ fontSize: 13, margin: '2px 0' }}>Lördag 26 september · 3 240,00 kr</div>
            <div className="ax-s" style={{ fontSize: 11 }}>14 köp · kort 2 890,00 · Swish 350,00</div>
          </div>
          <Swap from={<span className="ax-btn ax-click" style={c(2.2)}>Bokför</span>} to={<Pill><Check strokeWidth={3} />Bokförd</Pill>} at={2.5} align="end" />
        </div>
        <div className="dp-in" style={{ ...d(1), marginTop: 9, border: '1px solid var(--ax-border)', borderRadius: 8, overflow: 'hidden' }}>
          {[['1580 Fordran Zettle', '3 240,00', ''], ['3001 Försäljning 25 %', '', '2 592,00'], ['2611 Utgående moms 25 %', '', '648,00']].map(([k, de, kr], i) => (
            <div key={k} className="ax-tr" style={{ gridTemplateColumns: '1fr 70px 70px', padding: '0 10px', minHeight: 25, borderBottom: i < 2 ? '1px solid var(--ax-border)' : 'none' }}><span>{k}</span><span className="ax-num">{de}</span><span className="ax-num">{kr}</span></div>
          ))}
        </div>
      </div>
      <div className="ax-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="ax-b">Fredag 25 september · 2 180,00 kr</div><div className="ax-s" style={{ fontSize: 11 }}>9 köp</div></div><Pill>Bokförd</Pill>
      </div>
    </div>
  </Shell>
);

const BolagsverketScene = (
  <div className="ax" style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div className="ax-card" style={{ width: 'min(92%, 400px)', padding: '20px 22px', boxShadow: '0 20px 50px -24px rgba(0,0,0,0.35)' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}><BokixWordmark height={28} /></div>
      <div className="ax-b" style={{ fontSize: 15, textAlign: 'center' }}>Lägg till ditt företag</div>
      <div className="ax-m" style={{ fontSize: 11, textAlign: 'center', marginBottom: 14 }}>Vi hämtar resten från Bolagsverket</div>
      <div className="ax-label">Organisationsnummer</div>
      <div style={{ display: 'flex', gap: 7 }}>
        <div className="ax-field" style={{ flex: 1 }}><Typed text="559123-4567" at={0.3} dur={0.7} /></div>
        <span className="ax-btn ax-click" style={c(1.3)}>Hämta</span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['Företagsnamn', 'Testkunden AB'], ['Bolagsform', 'Aktiebolag'], ['Adress', 'Linnégatan 12, 413 04 Göteborg']].map(([k, v], i) => (
          <div key={k} className="dp-in" style={{ ...d(1.8 + i * 0.25), display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--ax-border)', fontSize: 11.5 }}><span className="ax-m">{k}</span><span className="ax-b">{v}</span></div>
        ))}
      </div>
      <div className="dp-in" style={{ ...d(2.8), marginTop: 10, padding: '7px 10px', borderRadius: 7, background: 'var(--ax-g-bg)', color: 'var(--ax-g-tx)', fontSize: 11, fontWeight: 600 }}>Bolagsformen avgör vilka regler som gäller. Du behöver inte välja själv.</div>
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

const KONTO_ROWS = [['1930', 'Företagskonto / checkkonto', 'Tillgång'], ['3001', 'Försäljning inom Sverige, 25 %', 'Intäkt'], ['5410', 'Förbrukningsinventarier', 'Kostnad'], ['5611', 'Drivmedel för personbilar', 'Kostnad'], ['6071', 'Representation, avdragsgill', 'Kostnad'], ['6570', 'Bankkostnader', 'Kostnad']];
const BasScene = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" sub="Verifikationer, kontoplan och bokföringsposter" tabs={['Verifikationer', 'Kontoplan']} on="Kontoplan" />
    <div className="ax-bar"><div className="ax-search" style={{ maxWidth: 260, color: 'var(--ax-text)' }}>⌕ <Typed text="drivm" at={0.8} dur={0.5} /></div><span className="ax-m" style={{ fontSize: 11 }}>Hela BAS-kontoplanen</span></div>
    <div className="ax-tr ax-th" style={{ gridTemplateColumns: '60px 1fr 80px' }}><span>Konto</span><span>Namn</span><span>Typ</span></div>
    {KONTO_ROWS.map(([k, n, t]) => {
      const hit = k === '5611';
      return (
        <div key={k} className={`ax-tr ${hit ? 'dp-flash' : 'dp-collapse'}`} style={{ gridTemplateColumns: '60px 1fr 80px', ...(hit ? d(1.7) : { ...d(1.4), '--h': '40px' }) }}>
          <span className="ax-b">{k}</span><span>{n}</span><span className="ax-s">{t}</span>
        </div>
      );
    })}
  </Shell>
);

const INTEGRATION_SCENES = {
  stripe: { title: 'Stripe', where: 'Kundens betalsida → Bokix', scene: StripeScene },
  zettle: { title: 'Zettle', where: 'Bokix · Granskning · Zettle', scene: ZettleScene },
  bolagsverket: { title: 'Bolagsverket', where: 'Bokix · Nytt företag', scene: BolagsverketScene },
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

const SettingsAdvanced = ({ children }) => (
  <Shell active="settings" review={1}>
    <Top title="Inställningar" tabs={['Företag', 'Fakturor', 'Användare', 'Säkerhet', 'Avancerat']} on="Avancerat" />
    <div className="ax-body" style={{ position: 'relative' }}>{children}</div>
  </Shell>
);

const SettingCard = ({ title, desc, children, style }) => (
  <div className="ax-card" style={{ padding: '12px 14px', ...style }}>
    <div className="ax-b" style={{ fontSize: 12.5 }}>{title}</div>
    <div className="ax-m" style={{ fontSize: 10.5, margin: '1px 0 9px' }}>{desc}</div>
    {children}
  </div>
);

const SieImport = (
  <SettingsAdvanced>
    <div className="ax-b" style={{ fontSize: 13, marginBottom: 2 }}>Ta med dig din bokföring</div>
    <div className="ax-m" style={{ fontSize: 11, marginBottom: 10 }}>Din bokföring är din. Ladda ner den när du vill.</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <SettingCard title="SIE4" desc="Formatet alla svenska bokföringsprogram läser."><span className="ax-btn-ghost"><Download size={11} /> Ladda ner SIE4</span></SettingCard>
      <SettingCard title="Flytta hit bokföringen" desc="Från ett annat program, via SIE4."><span className="ax-btn-ghost ax-click" style={c(0.7)}><Upload size={11} /> Importera SIE4-fil</span></SettingCard>
    </div>
    <div className="ax-scrim dp-in" style={{ ...d(1), position: 'absolute' }}>
      <div className="ax-modal">
        <div className="ax-modal-head">Importera från annat bokföringsprogram<X size={13} className="ax-m" /></div>
        <div className="ax-modal-body">
          <div className="dp-slide" style={{ ...d(1.4), display: 'inline-flex', marginBottom: 10 }}><span className="ax-dl-file"><Doc />bokforing-2026.se</span></div>
          <div style={{ height: 5, borderRadius: 5, background: 'var(--ax-soft)', overflow: 'hidden', marginBottom: 10 }}><div className="dp-grow" style={{ ...d(1.7), '--t': '1s', height: '100%', background: '#0b6329' }} /></div>
          {[['Konton', '142'], ['Verifikationer', '1 318'], ['Ingående balanser', 'Ja'], ['Räkenskapsår', '2026-01-01 – 2026-12-31']].map(([k, v], i) => (
            <div key={k} className="dp-in" style={{ ...d(2.8 + i * 0.2), display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--ax-border)', fontSize: 11.5 }}><span className="ax-m">{k}</span><span className="ax-b">{v}</span></div>
          ))}
        </div>
        <div className="ax-modal-foot"><span className="ax-btn dp-in" style={d(3.6)}>Fortsätt till kontomappning</span></div>
      </div>
    </div>
  </SettingsAdvanced>
);

const MAP_COLS = { gridTemplateColumns: '1fr 1fr 110px', padding: '0 10px' };
const SieMapping = (
  <SettingsAdvanced>
    <div className="ax-scrim" style={{ position: 'absolute' }}>
      <div className="ax-modal" style={{ width: 'min(94%, 500px)' }}>
        <div className="ax-modal-head">Kontomappning<span className="ax-m" style={{ fontWeight: 500, fontSize: 11 }}>Steg 3 av 4</span></div>
        <div className="ax-modal-body" style={{ padding: '10px 14px' }}>
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
        <div className="ax-modal-foot"><span className="ax-btn-ghost">Tillbaka</span><span className="ax-btn ax-click" style={c(2.7)}>Bekräfta importen</span></div>
      </div>
    </div>
  </SettingsAdvanced>
);

const SieDone = (
  <Shell active="verifications" review={1}>
    <Top title="Bokföring" sub="Verifikationer, kontoplan och bokföringsposter" tabs={['Verifikationer', 'Kontoplan']} on="Verifikationer" />
    <div className="ax-tr ax-th m-sie" style={{ gridTemplateColumns: '64px 78px 1fr 84px 62px' }}><span>Ver.</span><span className="ax-hide-sm">Datum</span><span>Beskrivning</span><span className="ax-num">Belopp</span><span className="ax-hide-sm">Status</span></div>
    {[['A1318', '2026-09-26', 'Hyra oktober', '9 500,00'], ['A1317', '2026-09-25', 'Faktura 1082', '18 750,00'], ['A1316', '2026-09-24', 'Kontorsmaterial', '1 240,00'], ['A1315', '2026-09-22', 'Lön september', '31 668,00'], ['A1314', '2026-09-20', 'Faktura 1081', '9 400,00'], ['A1313', '2026-09-18', 'Telefoni', '449,00'], ['A1312', '2026-09-15', 'Programvara', '1 190,00']].map((r, i) => (
      <div key={r[0]} className="ax-tr m-sie dp-slide" style={{ gridTemplateColumns: '64px 78px 1fr 84px 62px', ...d(0.3 + i * 0.18) }}>
        <span className="ax-b">{r[0]}</span><span className="ax-s ax-hide-sm">{r[1]}</span><span>{r[2]}</span><span className="ax-num ax-b">{r[3]}</span><Pill className="ax-hide-sm">Bokförd</Pill>
      </div>
    ))}
    <Toast delay={1.9}>1 318 verifikationer importerade</Toast>
  </Shell>
);

export const makeSwitchDemo = (steps) => zip(steps, [
  { where: 'Ditt nuvarande program', scene: OldProgram },
  { where: 'Bokix · Inställningar · Avancerat', scene: SieImport },
  { where: 'Bokix · Importera SIE4', scene: SieMapping },
  { where: 'Bokix · Bokföring', scene: SieDone },
]);

// ── Säkerhet ─────────────────────────────────────────────────────────────

const LoginCard = ({ children }) => (
  <div className="ax" style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div className="ax-card" style={{ width: 'min(92%, 360px)', padding: '22px 22px', boxShadow: '0 20px 50px -24px rgba(0,0,0,0.35)', textAlign: 'center' }}>
      <div style={{ marginBottom: 12 }}><BokixWordmark height={28} /></div>
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

const Sec2fa = (
  <LoginCard>
    <div className="ax-b" style={{ fontSize: 14 }}>Tvåstegsverifiering</div>
    <div className="ax-m" style={{ fontSize: 11, margin: '3px 0 14px' }}>Ange koden från din autentiseringsapp</div>
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {['4', '8', '2', '1', '9', '0'].map((n, i) => (
        <span key={i} className="ax-field" style={{ width: 34, height: 40, justifyContent: 'center', fontSize: 17, fontWeight: 700 }}><span className="dp-pop" style={d(0.5 + i * 0.22)}>{n}</span></span>
      ))}
    </div>
    <span className="ax-btn ax-click" style={{ ...c(2.2), marginTop: 14, width: '100%', justifyContent: 'center', padding: 9 }}>Verifiera</span>
    <div className="dp-in" style={{ ...d(2.6), marginTop: 10 }}><Pill><Check strokeWidth={3} />Inloggad</Pill></div>
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
        <Shell active="verifications" review={1}><Top title="Bokföring" sub="Verifikationer, kontoplan och bokföringsposter" /><div className="ax-body" /></Shell>
      </div>
      <div className="dp-in" style={{ ...d(2), position: 'absolute', inset: 0 }}>
        <LoginCard>
          <div className="ax-b" style={{ fontSize: 14 }}>Logga in</div>
          <div className="ax-m" style={{ fontSize: 11, margin: '3px 0 12px' }}>Inloggningen fanns bara i fliken du stängde.</div>
          <div className="ax-field" style={{ marginBottom: 7 }}><span className="ax-m">E-post</span></div>
          <div className="ax-field" style={{ marginBottom: 10 }}><span className="ax-m">Lösenord</span></div>
          <span className="ax-btn" style={{ width: '100%', justifyContent: 'center', padding: 8 }}>Logga in</span>
        </LoginCard>
      </div>
    </div>
  </div>
);

const USER_COLS = { gridTemplateColumns: '1fr 110px 90px' };
const SecInvite = (
  <Shell active="settings" review={1}>
    <Top title="Inställningar" tabs={['Företag', 'Fakturor', 'Användare', 'Säkerhet', 'Avancerat']} on="Användare" />
    <div className="ax-bar" style={{ justifyContent: 'space-between' }}><span className="ax-s" style={{ fontSize: 11.5 }}>2 av 3 användare</span><span className="ax-btn ax-click" style={c(0.6)}><Plus size={11} /> Bjud in</span></div>
    <div className="ax-tr ax-th" style={USER_COLS}><span>Användare</span><span>Roll</span><span>Status</span></div>
    <div className="ax-tr" style={USER_COLS}><span className="ax-b">du@linnearkitekter.se</span><span>Administratör</span><Pill>Aktiv</Pill></div>
    <div className="ax-tr" style={USER_COLS}><span>ekonomi@linnearkitekter.se</span><span>Användare</span><Pill>Aktiv</Pill></div>
    <div className="ax-tr dp-slide" style={{ ...USER_COLS, ...d(3) }}><span>sara@revisionsbyra.se</span><span>Revisor</span><Pill kind="warn">Inbjuden</Pill></div>
    <div className="ax-scrim dp-gone" style={d(2.7)}>
      <div className="ax-modal dp-pop" style={d(0.9)}>
        <div className="ax-modal-head">Bjud in användare<X size={13} className="ax-m" /></div>
        <div className="ax-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><div className="ax-label">E-post</div><div className="ax-field"><Typed text="sara@revisionsbyra.se" at={1.2} dur={0.8} /></div></div>
          <div><div className="ax-label">Roll</div><div className="ax-field" style={{ justifyContent: 'space-between' }}>Revisor<ChevronDown size={10} /></div></div>
          <div className="ax-m" style={{ fontSize: 10.5 }}>Inbjudan är en engångslänk. Behörigheten kontrolleras i databasen.</div>
        </div>
        <div className="ax-modal-foot"><span className="ax-btn ax-click" style={c(2.3)}>Skicka inbjudan</span></div>
      </div>
    </div>
    <Toast delay={3}>Engångslänk skickad till sara@revisionsbyra.se</Toast>
  </Shell>
);

const SecEu = (
  <Shell active="settings" review={1}>
    <Top title="Inställningar" tabs={['Företag', 'Fakturor', 'Användare', 'Säkerhet', 'Avancerat']} on="Säkerhet" />
    <div className="ax-body">
      <div className="ax-card" style={{ padding: '12px 14px' }}>
        <div className="ax-b" style={{ fontSize: 12.5, marginBottom: 8 }}>Var din data ligger</div>
        {[['Databasen', 'Frankfurt, Tyskland'], ['Kvitton och filer', 'Frankfurt, Tyskland'], ['Säkerhetskopia', 'Varje natt, sparas 14 dagar'], ['Bokföringen efter uppsägning', 'Sparas i 7 år']].map(([k, v], i) => (
          <div key={k} className="dp-slide" style={{ ...d(0.3 + i * 0.35), display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid var(--ax-border)', fontSize: 11.5 }}><span className="ax-m">{k}</span><span className="ax-b">{v}</span></div>
        ))}
        <div className="dp-in" style={{ ...d(1.9), marginTop: 6 }}><Pill><Check strokeWidth={3} />Lagras inom EU</Pill></div>
      </div>
    </div>
  </Shell>
);

const SecExport = (
  <SettingsAdvanced>
    <div className="ax-b" style={{ fontSize: 13, marginBottom: 2 }}>Ta med dig din bokföring</div>
    <div className="ax-m" style={{ fontSize: 11, marginBottom: 10 }}>Din bokföring är din. Ladda ner den när du vill.</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <SettingCard title="SIE4" desc="Formatet alla svenska bokföringsprogram läser.">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span className="ax-field" style={{ minHeight: 24, padding: '3px 8px' }}>2026 <ChevronDown size={10} /></span><span className="ax-btn ax-click" style={c(0.9)}><Download size={11} /> Ladda ner SIE4</span></div>
      </SettingCard>
      <SettingCard title="Säkerhetskopia" desc="Allt i en JSON-fil."><span className="ax-btn-ghost"><Download size={11} /> Ladda ner</span></SettingCard>
    </div>
    <div className="dp-in ax-m" style={{ ...d(1.8), marginTop: 12, fontSize: 11 }}>Ingen behöver godkänna exporten. Den är din.</div>
    <DownloadBar file="bokforing-2026.se" delay={1.3} />
  </SettingsAdvanced>
);

export const makeSecurityDemo = (facts) => zip(facts, [
  { where: 'www.bokix.se', scene: SecEncrypt },
  { where: 'Bokix · Logga in', scene: Sec2fa },
  { where: 'Webbläsaren', scene: SecSession },
  { where: 'Bokix · Inställningar · Användare', scene: SecInvite },
  { where: 'Bokix · Inställningar · Säkerhet', scene: SecEu },
  { where: 'Bokix · Inställningar · Avancerat', scene: SecExport },
]);
