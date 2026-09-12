import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Check, X, ChevronDown, ChevronUp, ShieldCheck, CreditCard, Landmark, HelpCircle, FileText, Receipt, Info, RotateCcw } from 'lucide-react';
import { AccountSearch } from './shared/SearchInputs';
import ListPageHeader from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { supabase } from '../supabaseClient';
import { VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './AccountsData';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatMoney = (val, currency) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: (currency || 'sek').toUpperCase(), maximumFractionDigits: 2 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
const formatDateTime = (iso) => {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; }
};

const KIND_LABEL = { receipt: 'kvitto', supplier_invoice: 'leverantörsfaktura' };
const KIND_LABEL_PLURAL = { receipt: 'kvitton', supplier_invoice: 'leverantörsfakturor' };

/** "2 dagar sedan" till metaraden. Ett datum säger vilken dag posten är
 * från; ålder säger hur länge den legat och väntat — det är det senare man
 * granskar efter, så båda står i raden. */
const agoLabel = (d) => {
  if (!d) return null;
  const then = new Date(d);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'i dag';
  if (days === 1) return '1 dag sedan';
  if (days < 30) return `${days} dagar sedan`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 månad sedan' : `${months} månader sedan`;
};

// ── Radlayouten för granskningslistan ───────────────────────────────────
// Korten var tidigare fristående boxar i hela fönstrets bredd. På en stor
// skärm blev en rad på fyra ord över 1 500 px bred, med ett tomrum mellan
// texten till vänster och ingenting till höger — kundens invändning. Nu:
// EN inramad lista med tunna avdelare, centrerad och maxbreddad, så raden
// har samma längd oavsett skärm. På mobil krymper sidopaddingen i stället
// (16 px), eftersom marginalerna där tar av det som faktiskt ska läsas.
// Korten låg tidigare i en 980px-bred, centrerad spalt med 20px luft
// ovanför — de svävade då som ett eget kort mitt på sidan i stället för att
// sitta ihop med sidhuvudet, som alla andra listsidor gör (kundönskemål:
// "i granskning ska den vara ihopfogad med headern, i vår stil, och på alla
// sidor"). Nu samma förhållande som ListTable → ListFilterBar: kanten flush
// mot headern, rak överkant, avrundad först mot sidbakgrunden nedtill.

const REVIEW_LIST_CSS = `
  .rq-list { width: 100%; padding: 0 0 24px; box-sizing: border-box; }
  .rq-card { background: var(--bg-card); border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
  .rq-row { display: flex; gap: 14px; padding: 16px 20px; align-items: flex-start; }
  .rq-row + .rq-row { border-top: 1px solid var(--border-light); }
  .rq-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .rq-meta { font-size: 11px; font-weight: 700; letter-spacing: 0.055em; text-transform: uppercase; color: var(--text-muted); line-height: 1.5; }
  .rq-title { font-size: 14.5px; font-weight: 600; color: var(--text-main); margin-top: 5px; line-height: 1.45; }
  .rq-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
  @media (max-width: 640px) {
    .rq-list { padding: 0 0 18px; }
    .rq-row { padding: 14px 14px; gap: 11px; }
    .rq-head { flex-direction: column; gap: 6px; }
    .rq-actions button { flex: 1 1 auto; justify-content: center; }
  }
`;

/** Knappstil för radens åtgärder — samma höjd och radie som listsidornas
 * övriga knappar (shared/ListPageHeader.jsx), bara en aning nättare
 * eftersom de sitter inuti en rad och inte i ett sidhuvud. */
function rowButtonStyle(variant = 'secondary') {
  const tone = {
    primary: { background: 'var(--accent)', color: 'white', border: 'none' },
    danger: { background: 'var(--bg-card)', color: 'var(--status-red-text)', border: '1px solid var(--border)' },
    secondary: { background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' },
    ghost: { background: 'none', color: 'var(--text-secondary)', border: '1px solid transparent' },
  }[variant];
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    height: '32px', padding: '0 13px', boxSizing: 'border-box',
    borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    ...tone,
  };
}

const BADGE_TONES = {
  green: { bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  amber: { bg: 'var(--status-amber-bg)', fg: 'var(--status-amber-text)' },
  blue: { bg: 'var(--status-blue-bg)', fg: 'var(--status-blue-text)' },
  neutral: { bg: 'var(--border-light)', fg: 'var(--text-secondary)' },
};

/**
 * Skalet varje granskningsrad delar: markeringsruta, ikon, metarad,
 * åtgärdsmening, statusetikett till höger och knapparna under. Både
 * utgifts- och Stripe-raderna använder det, så de två flikarna aldrig kan
 * driva isär visuellt.
 *
 * `selectable === false` betyder att posten inte går att godkänna som den
 * är (den saknar konto) — rutan visas ändå, men avstängd och med en
 * förklaring i title, i stället för att bara utelämnas: en lucka i
 * kolumnen ser ut som en bugg, en avstängd ruta förklarar sig själv.
 */
function ReviewRowShell({
  icon: Icon, tone = 'neutral', meta, title, badge, exiting,
  selectable = false, selected = false, onToggleSelect, selectHint,
  // `extra` sitter MELLAN meningen och knapparna — för de val som måste
  // göras innan knappen går att trycka (momssats och intäktskonto på en
  // Stripe-betalning utan matchande faktura). Under knapparna hade det
  // varit fel ordning: man fyller i först och bekräftar sedan.
  extra, actions, children,
}) {
  const badgeTone = BADGE_TONES[badge?.tone || 'neutral'];
  const iconTone = BADGE_TONES[tone];
  return (
    <div className="rq-row" style={{
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'translateX(24px)' : 'none',
      transition: 'opacity 0.22s ease, transform 0.22s ease',
    }}>
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggleSelect}
          title={selectable ? 'Markera för att godkänna flera på en gång' : selectHint}
          aria-label={selectable ? `Markera: ${title}` : selectHint}
          style={{ width: '16px', height: '16px', marginTop: '9px', accentColor: 'var(--accent)', cursor: selectable ? 'pointer' : 'not-allowed', flexShrink: 0 }}
        />
      )}
      <span style={{
        width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
        background: iconTone.bg, color: iconTone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="rq-head">
          <div style={{ minWidth: 0 }}>
            <div className="rq-meta">{meta.filter(Boolean).join(' · ')}</div>
            <div className="rq-title">{title}</div>
          </div>
          {badge && (
            <span style={{
              flexShrink: 0, padding: '4px 10px', borderRadius: '999px',
              fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap',
              background: badgeTone.bg, color: badgeTone.fg,
            }}>
              {badge.label}
            </span>
          )}
        </div>
        {extra}
        {actions && <div className="rq-actions">{actions}</div>}
        {children}
      </div>
    </div>
  );
}

// Stripe-ledgerns typsträngar → svensk etikett, bara för visning (samma
// princip som SUBSCRIPTION_STATUS_LABELS i Settings.jsx — ingen omkodning
// av själva datan, bara UI-text).
const STRIPE_TYPE_LABEL = {
  transfer: 'Överföring från Bokix', payout: 'Utbetalning till bank', charge: 'Betalning', payment: 'Betalning',
  refund: 'Återbetalning', adjustment: 'Justering', stripe_fee: 'Stripe-avgift',
};

/** Avgör vilket av de tre kortlägena en Stripe-ledgerrad ska visas som —
 * se den långa kommentaren i supabase-setup.sql (stripe_ledger_events) för
 * VARFÖR "avgift" här betyder Bokix egen plattformsavgift (skillnaden
 * mellan fakturans bokförda belopp och vad som faktiskt landade i
 * Stripe-saldot), inte Stripes egen korttjänstavgift. */
function categorizeStripeItem(item) {
  if (item.type === 'transfer' && item.matched_invoice_id && Number(item.platform_fee_amount) > 0 && item.currency === 'sek') {
    return 'platform_fee';
  }
  if (item.type === 'payout') return 'payout';
  if (item.currency === 'sek' && (item.type === 'charge' || item.type === 'payment')) return 'unmatched_sale';
  return 'manual';
}

/**
 * Föreslår ett konto baserat på tidigare, redan konterade poster från samma
 * leverantör/inköpsställe — en riktig, uträknad heuristik (inte en fejkad
 * "AI-matchning"). Säker (confident) bara om ALLA tidigare poster från samma
 * leverantör landat på exakt samma konto.
 */
function suggestAccount(item, allExpenses) {
  const name = (item.supplier || '').trim().toLowerCase();
  if (!name) return { account: null, confident: false };
  const matches = allExpenses.filter(e =>
    e.costAccount && e.type === item.type && (e.supplier || '').trim().toLowerCase() === name
  );
  if (matches.length === 0) return { account: null, confident: false };
  const distinct = [...new Set(matches.map(m => m.costAccount))];
  if (distinct.length === 1) return { account: distinct[0], confident: true };
  // Flera olika konton använda tidigare för samma leverantör — inte säkert
  // nog för automatik, men den senaste kan vara en rimlig utgångspunkt.
  const latest = [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  return { account: latest.costAccount, confident: false };
}

/**
 * En post som saknar kontering. Raden säger tre saker i den ordning man
 * faktiskt granskar dem: VAD det är (metaraden), VAD som händer om du
 * godkänner (åtgärdsmeningen), och HUR säkert förslaget är (etiketten).
 *
 * Saknas förslag helt heter knappen "Ange konto", inte "Avvisa" — det
 * finns inget att avvisa, och kundönskemålet var uttryckligen att en
 * leverantörsfaktura utan kontering ska leda till just det valet.
 */
function ReviewCard({ item, accounts, onApprove, onReject, exiting, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [manualAccount, setManualAccount] = useState('');

  const isSupplierInvoice = item.type === 'supplier_invoice';
  const kindLabel = KIND_LABEL[item.type] || 'post';
  const suggestedAccountObj = accounts.find(a => a.code === item.account);
  const who = item.supplier || item.description || 'okänt inköpsställe';

  // "Föreslaget ur tidigare konteringar" är ordagrant vad suggestAccount
  // gör (samma leverantör, samma konto förra gången) — aldrig "föreslaget
  // av AI", som hade varit ett påstående koden inte kan backa upp.
  const meta = [
    isSupplierInvoice ? 'Leverantörsfaktura' : 'Kvitto',
    item.account ? 'föreslaget ur tidigare konteringar' : 'ingen tidigare matchning',
    agoLabel(item.date),
  ];

  const title = item.account
    ? `Kontera ${who} ${formatSEK(item.amount)} som ${item.account} ${suggestedAccountObj?.name || ''}`.trim()
    : `Ange konto för ${who} ${formatSEK(item.amount)}`;

  const badge = item.account
    ? (item.confident ? { label: 'Säkert förslag', tone: 'green' } : { label: 'Osäkert förslag', tone: 'amber' })
    : { label: 'Konto saknas', tone: 'neutral' };

  return (
    <ReviewRowShell
      icon={isSupplierInvoice ? FileText : Receipt}
      tone={badge.tone}
      meta={meta}
      title={title}
      badge={badge}
      exiting={exiting}
      selectable={Boolean(item.account)}
      selected={selected}
      onToggleSelect={onToggleSelect}
      selectHint="Posten saknar konto — ange ett konto innan den kan godkännas."
      actions={
        <>
          {item.account && (
            <button onClick={() => onApprove(item)} style={rowButtonStyle('primary')}>
              <Check size={14} /> Godkänn
            </button>
          )}
          <button
            onClick={() => setRejecting(r => !r)}
            style={rowButtonStyle(item.account ? 'danger' : 'primary')}
          >
            {item.account ? <><X size={14} /> Avvisa</> : 'Ange konto'}
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> Visa detaljer {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {rejecting && (
        <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
            {item.account ? 'Fel förslag — ange rätt konto:' : 'Ange konto:'}
          </div>
          <div className="rq-account-picker" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AccountSearch value={manualAccount} onChange={setManualAccount} accounts={accounts} placeholder="Sök konto..." />
            </div>
            <button
              disabled={!manualAccount}
              onClick={() => onReject(item, manualAccount)}
              style={{ ...rowButtonStyle(manualAccount ? 'primary' : 'secondary'), opacity: manualAccount ? 1 : 0.6, cursor: manualAccount ? 'pointer' : 'not-allowed' }}
            >
              Bokför med detta konto
            </button>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
            Posten bokförs direkt med kontot du väljer — den försvinner aldrig obokförd.
          </p>
        </div>
      )}

      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Typ:</span> {kindLabel}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Datum:</span> {formatDate(item.date)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Belopp:</span> {formatSEK(item.amount)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Moms:</span> {item.vatAmount ? formatSEK(item.vatAmount) : '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Inköpsställe/leverantör:</span> {item.supplier || '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Underlag:</span> Inget bifogat underlag är sparat för denna post.</div>
        </div>
      )}
    </ReviewRowShell>
  );
}
const VAT_RATES = [25, 12, 6, 0];

/** Ett kort för en Stripe-ledgerrad (public.stripe_ledger_events) — samma
 * visuella mönster som ReviewCard ovan, men tre olika lägen istället för
 * ett enda "föreslå konto":
 *  - 'platform_fee': säkert förslag (mellanskillnaden är räknad, inte
 *    gissad), en Godkänn-knapp precis som ett säkert kvittoförslag.
 *  - 'payout': rent informativt — inget att bokföra HÄR (se filkommentaren
 *    i supabase-setup.sql: att bokföra utbetalningen separat hade krävt
 *    att även fakturabetalningens befintliga bokföring skrevs om), bara en
 *    avstämningshjälp mot bankkontoutdraget.
 *  - 'unmatched_sale': en SEK-betalning som inte kunde kopplas till en
 *    känd Bokix-faktura — momssats/konto måste väljas manuellt, ingen
 *    gissning.
 *  - allt annat (utländsk valuta, ovanliga typer): "kräver manuell
 *    hantering", bara en kvittera-knapp, ingen automatisk kontering.
 */
function StripeLedgerCard({ item, accounts, onBookPlatformFee, onBookSale, onMarkHandled, exiting, onOpenInvoice }) {
  const [expanded, setExpanded] = useState(false);
  const [vatRate, setVatRate] = useState(25);
  const [saleAccount, setSaleAccount] = useState(REVENUE_ACCOUNTS[25]);

  const category = categorizeStripeItem(item);
  const typeLabel = STRIPE_TYPE_LABEL[item.type] || item.type;
  const isForeign = item.currency !== 'sek';

  // Samma tre delar som utgiftsraden: metarad, åtgärdsmening, etikett.
  // Meningen säger vad knappen gör — inte bara vad raden är.
  const view = {
    platform_fee: {
      icon: ShieldCheck, tone: 'green',
      note: 'beräknad ur fakturans bokförda belopp',
      title: `Bokför Bokix plattformsavgift ${formatSEK(item.platform_fee_amount)} mot 6570 Bankkostnader`,
      badge: { label: 'Beräknad avgift', tone: 'green' },
    },
    payout: {
      icon: Landmark, tone: 'blue',
      note: 'inget att bokföra här',
      title: `Utbetalning till bank ${formatMoney(item.amount, item.currency)} — jämför mot ditt bankkontoutdrag`,
      badge: { label: 'Avstämning', tone: 'blue' },
    },
    unmatched_sale: {
      icon: CreditCard, tone: 'amber',
      note: 'ingen matchande faktura',
      title: `Bokför betalning ${formatSEK(item.amount)} — välj momssats och intäktskonto`,
      badge: { label: 'Kräver val', tone: 'amber' },
    },
    manual: {
      icon: HelpCircle, tone: 'neutral',
      note: isForeign ? 'utländsk valuta' : 'ingen automatisk kontering ännu',
      title: `${typeLabel} ${formatMoney(item.amount, item.currency)} — hanteras manuellt`,
      badge: { label: 'Manuell', tone: 'neutral' },
    },
  }[category];

  return (
    <ReviewRowShell
      icon={view.icon}
      tone={view.tone}
      meta={[typeLabel, view.note, agoLabel(item.created_at_stripe)]}
      title={view.title}
      badge={view.badge}
      exiting={exiting}
      extra={category === 'unmatched_sale' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
          <select value={vatRate} onChange={e => { const r = Number(e.target.value); setVatRate(r); setSaleAccount(REVENUE_ACCOUNTS[r]); }} style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}>
            {VAT_RATES.map(r => <option key={r} value={r}>{r}% moms</option>)}
          </select>
          <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
            <AccountSearch value={saleAccount} onChange={setSaleAccount} accounts={accounts} placeholder="Intäktskonto..." />
          </div>
        </div>
      )}
      actions={
        <>
          {category === 'platform_fee' && (
            <button onClick={() => onBookPlatformFee(item)} style={rowButtonStyle('primary')}>
              <Check size={14} /> Bokför avgift
            </button>
          )}
          {category === 'unmatched_sale' && (
            <button
              disabled={!saleAccount}
              onClick={() => onBookSale(item, saleAccount, vatRate)}
              style={{ ...rowButtonStyle(saleAccount ? 'primary' : 'secondary'), opacity: saleAccount ? 1 : 0.6, cursor: saleAccount ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} /> Bokför försäljning
            </button>
          )}
          {(category === 'payout' || category === 'manual') && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle('secondary')}>
              Markera som hanterad
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> Visa detaljer {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Typ:</span> {typeLabel} ({item.type})</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Datum:</span> {formatDate(item.created_at_stripe)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Belopp:</span> {formatMoney(item.amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Valuta:</span> {(item.currency || '').toUpperCase()}</div>
          {item.matched_invoice_id && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kopplad faktura:</span>
              {onOpenInvoice ? (
                // Kundönskemål: "visa fakturan" — tidigare bara fakturans
                // rå-id som text, ingen väg att faktiskt se den härifrån.
                // Öppnar samma faktura-visningsläge som Fakturor-sidans
                // egen radklick (Invoices.jsx: globalAction 'open_invoice').
                <button
                  type="button"
                  onClick={() => onOpenInvoice(item.matched_invoice_id)}
                  style={{ border: 0, background: 'none', padding: 0, color: 'var(--accent-text)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
                >
                  Visa fakturan
                </button>
              ) : item.matched_invoice_id}
              <span style={{ color: 'var(--text-muted)' }}>(bästa-försök-matchning på tidsnärhet, inte garanterad)</span>
            </div>
          )}
          {item.description && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Stripe-beskrivning:</span> {item.description}</div>}
        </div>
      )}
    </ReviewRowShell>
  );
}

const ZETTLE_PAYMENT_LABEL = { IZETTLE_CARD: 'Kortbetalning', CASH: 'Kontant', SPLIT: 'Delad betalning' };

/** Gissar den momssats [25,12,6,0] som ligger närmast förhållandet
 * vat_amount/amount på en Zettle-rad — Zettle skickar redan momsbeloppet
 * (till skillnad från Stripe, som inte vet något om svensk moms alls), så
 * det här är en riktig beräkning, inte en gissning ur tomma intet. Bara
 * ett startvärde i selecten — användaren kan alltid ändra det. */
function guessVatRate(item) {
  const gross = Number(item.amount) || 0;
  if (gross <= 0) return 25;
  const ratio = (Number(item.vat_amount) || 0) / gross;
  let best = 25, bestDiff = Infinity;
  for (const r of VAT_RATES) {
    const diff = Math.abs(ratio - r / (100 + r));
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best;
}

/** Ett kort för en Zettle-ledgerrad (public.zettle_ledger_events) — samma
 * visuella mönster som StripeLedgerCard ovan, men bara TVÅ lägen: Zettle
 * gör ingen fakturamatchning alls (varje Zettle-köp är en ny, obokförd
 * kontantförsäljning, aldrig en betalning på en redan bokförd Bokix-
 * faktura), och det finns ingen Bokix-avgift att bryta ut.
 *  - 'sale': en försäljning — momssats/intäktskonto föreslagna (guessVatRate),
 *    användaren godkänner eller ändrar innan bokföring.
 *  - 'refund': en återbetalning — kräver manuell hantering (att bokföra
 *    den rätt betyder att hitta och reversera EN specifik tidigare
 *    försäljning, inget den här vyn kan gissa sig till säkert).
 */
function ZettleLedgerCard({ item, accounts, onBookSale, onMarkHandled, exiting }) {
  const [expanded, setExpanded] = useState(false);
  const initialVat = guessVatRate(item);
  const [vatRate, setVatRate] = useState(initialVat);
  const [saleAccount, setSaleAccount] = useState(REVENUE_ACCOUNTS[initialVat]);

  const category = item.is_refund ? 'refund' : 'sale';
  const paymentLabel = ZETTLE_PAYMENT_LABEL[item.payment_type] || item.payment_type || 'Okänd betalmetod';

  const view = {
    sale: {
      icon: CreditCard, tone: 'amber',
      note: 'ingen kopplad faktura — all Zettle-försäljning är kontantförsäljning',
      title: `Bokför försäljning ${formatSEK(item.amount)}${item.purchase_number ? ` — kvitto ${item.purchase_number}` : ''}`,
      badge: { label: 'Kräver val', tone: 'amber' },
    },
    refund: {
      icon: RotateCcw, tone: 'neutral',
      note: 'återbetalning — hanteras manuellt',
      title: `Återbetalning ${formatSEK(item.amount)}${item.purchase_number ? ` — kvitto ${item.purchase_number}` : ''}`,
      badge: { label: 'Manuell', tone: 'neutral' },
    },
  }[category];

  return (
    <ReviewRowShell
      icon={view.icon}
      tone={view.tone}
      meta={[paymentLabel, view.note, agoLabel(item.created_at_zettle)]}
      title={view.title}
      badge={view.badge}
      exiting={exiting}
      extra={category === 'sale' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
          <select value={vatRate} onChange={e => { const r = Number(e.target.value); setVatRate(r); setSaleAccount(REVENUE_ACCOUNTS[r]); }} style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}>
            {VAT_RATES.map(r => <option key={r} value={r}>{r}% moms</option>)}
          </select>
          <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
            <AccountSearch value={saleAccount} onChange={setSaleAccount} accounts={accounts} placeholder="Intäktskonto..." />
          </div>
        </div>
      )}
      actions={
        <>
          {category === 'sale' && (
            <button
              disabled={!saleAccount}
              onClick={() => onBookSale(item, saleAccount, vatRate)}
              style={{ ...rowButtonStyle(saleAccount ? 'primary' : 'secondary'), opacity: saleAccount ? 1 : 0.6, cursor: saleAccount ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} /> Bokför försäljning
            </button>
          )}
          {category === 'refund' && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle('secondary')}>
              Markera som hanterad
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> Visa detaljer {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Datum:</span> {formatDate(item.created_at_zettle)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Belopp:</span> {formatMoney(item.amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Moms (från Zettle):</span> {formatMoney(item.vat_amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Betalmetod:</span> {paymentLabel}</div>
          {item.purchase_number && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Zettle-kvitto:</span> #{item.purchase_number}</div>}
        </div>
      )}
    </ReviewRowShell>
  );
}

// `initialTab`: låter en genväg utifrån (Toast.jsx: "Visa i Granskning"
// efter en lyckad Stripe/Zettle-anslutning, App.jsx: reviewInitialTab)
// öppna direkt på rätt flik, i stället för att alltid landa på "Väntar"
// och tvinga ett extra klick för att hitta de nyss hämtade transaktionerna.
export default function ReviewQueue({ expenses = [], accounts = [], reviewHistory = [], onResolve, user, company, onAddVerification, demoStripeItems, demoZettleItems, initialTab = 'pending', handleGlobalAction }) {
  const [tab, setTab] = useState(initialTab); // 'pending' | 'stripe' | 'zettle' | 'history'
  const [exitingIds, setExitingIds] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Härleds alltid live från expenses-propen — ingen separat kopia av listan
  // som kan bli inaktuell. Om en post redan konterats (t.ex. av en annan
  // flik/session vars ändring hunnit sparas) försvinner den härifrån av sig
  // själv vid nästa render, utan att kräva särskild synk-logik.
  const pendingItems = useMemo(() => {
    return expenses
      .filter(e => !e.costAccount)
      .map(e => ({ ...e, ...suggestAccount(e, expenses) }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [expenses]);

  const visiblePending = pendingItems.filter(i => !exitingIds.has(i.id));
  const eligibleForBulk = visiblePending.filter(i => i.confident);

  // ── Markerade poster ────────────────────────────────────────────────
  // "Godkänn alla" tar bara de säkra förslagen och är ett allt-eller-inget-
  // val. Markeringsrutorna ger mellanläget: granska raderna, kryssa i de du
  // godkänner (även ett osäkert förslag du själv läst igenom) och bekräfta
  // dem i en klump. Poster utan konto går aldrig att kryssa i — det finns
  // inget att godkänna förrän ett konto valts.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelected = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Rensar bort id:n som inte längre finns kvar i listan (godkända,
  // konterade i en annan flik) så räknaren aldrig visar fler än som syns.
  const selectedItems = visiblePending.filter(i => selectedIds.has(i.id) && i.account);
  const bulkTargets = selectedItems.length > 0 ? selectedItems : eligibleForBulk;
  const bulkIsSelection = selectedItems.length > 0;

  const finishResolve = (item, account, method) => {
    setExitingIds(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      onResolve?.(item.id, account, { method });
      setExitingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }, 220);
  };

  const handleApprove = (item) => finishResolve(item, item.account, 'suggested');
  const handleReject = (item, account) => finishResolve(item, account, 'manual');

  const bulkSummary = useMemo(() => {
    const groups = {};
    bulkTargets.forEach(i => {
      const accName = accounts.find(a => a.code === i.account)?.name || i.account;
      const key = `${i.type}|${accName}`;
      groups[key] = (groups[key] || 0) + 1;
    });
    const parts = Object.entries(groups).map(([key, count]) => {
      const [type, accName] = key.split('|');
      const label = count === 1 ? KIND_LABEL[type] : KIND_LABEL_PLURAL[type];
      return `${count} ${label} kategoriseras som ${accName}`;
    });
    return `Detta godkänner ${bulkTargets.length} ${bulkTargets.length === 1 ? 'post' : 'poster'}: ${parts.join(', ')}.`;
  }, [bulkTargets, accounts]);

  const handleBulkApprove = () => {
    bulkTargets.forEach(item => finishResolve(item, item.account, 'bulk'));
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
  };

  // ── Stripe-bokföringsunderlag (public.stripe_ledger_events) — egen
  // datakälla, hämtad direkt härifrån (samma självförsörjande mönster som
  // SubscriptionSection/UsersAndAccessSection i Settings.jsx) istället för
  // att trädas genom App.jsx:s redan stora props-graf. Se filkommentaren i
  // supabase-setup.sql för hela flödet: cronen (api/cron/reminders.js)
  // loggar rader, den här komponenten föreslår en kontering, användaren
  // godkänner — aldrig auto-bokfört.
  // `demoStripeItems` (landningssidans DemoWorkspace) matar in samma rader
  // som en riktig Supabase-hämtning skulle ge, och stänger av både hämtningen
  // och reviewed_at-skrivningen nedan — demon har varken session eller
  // databas, men ska ändå kunna visa Stripe-fliken med riktigt innehåll.
  const isDemo = Array.isArray(demoStripeItems);
  const [stripeItems, setStripeItems] = useState(isDemo ? demoStripeItems : []);
  const [stripeLoading, setStripeLoading] = useState(!isDemo);

  const loadStripeItems = async () => {
    if (isDemo) { setStripeLoading(false); return; }
    if (!user?.id || !company?.id) { setStripeLoading(false); return; }
    setStripeLoading(true);
    const { data } = await supabase
      .from('stripe_ledger_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', company.id)
      .is('reviewed_at', null)
      .order('created_at_stripe', { ascending: false });
    setStripeItems(data || []);
    setStripeLoading(false);
  };

  useEffect(() => { loadStripeItems(); }, [user?.id, company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleStripeItems = stripeItems.filter(i => !exitingIds.has(i.id));

  // Samma exitingIds-Set som receipt-korten ovan delas — Stripe-radernas
  // id:n (riktiga UUID:er från Supabase) krockar aldrig med utgifternas
  // ("exp_..."), så en gemensam mängd är ofarlig och enklare än en andra.
  const finishResolveStripe = (item) => {
    setExitingIds(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      setStripeItems(prev => prev.filter(i => i.id !== item.id));
      setExitingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }, 220);
  };

  // Alla tre skriver samma sak till DB (reviewed_at) — bara VAD som
  // bokförs (om något) skiljer. RLS ("Apply own stripe ledger events" i
  // supabase-setup.sql) begränsar skrivningen till kontots egen rad.
  const markStripeReviewed = (item) => (isDemo
    ? Promise.resolve()
    : supabase.from('stripe_ledger_events').update({ reviewed_at: new Date().toISOString() }).eq('id', item.id));

  // ── Zettle-bokföringsunderlag (public.zettle_ledger_events) — samma
  // självförsörjande mönster som Stripe-blocket ovan. Cronen (api/cron/
  // reminders.js) loggar rader från kundens anslutna Zettle-konto, den här
  // komponenten föreslår en kontering, användaren godkänner.
  // `demoZettleItems` (landningssidans DemoWorkspace) matar in samma rader
  // som en riktig Supabase-hämtning skulle ge, och stänger av både
  // hämtningen och reviewed_at-skrivningen nedan — samma isDemo-mönster
  // som Stripe-blocket.
  const isZettleDemo = Array.isArray(demoZettleItems);
  const [zettleItems, setZettleItems] = useState(isZettleDemo ? demoZettleItems : []);
  const [zettleLoading, setZettleLoading] = useState(!isZettleDemo);

  const loadZettleItems = async () => {
    if (isZettleDemo) { setZettleLoading(false); return; }
    if (!user?.id || !company?.id) { setZettleLoading(false); return; }
    setZettleLoading(true);
    const { data } = await supabase
      .from('zettle_ledger_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', company.id)
      .is('reviewed_at', null)
      .order('created_at_zettle', { ascending: false });
    setZettleItems(data || []);
    setZettleLoading(false);
  };

  useEffect(() => { loadZettleItems(); }, [user?.id, company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleZettleItems = zettleItems.filter(i => !exitingIds.has(i.id));

  const finishResolveZettle = (item) => {
    setExitingIds(prev => new Set(prev).add(item.id));
    setTimeout(() => {
      setZettleItems(prev => prev.filter(i => i.id !== item.id));
      setExitingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }, 220);
  };

  const markZettleReviewed = (item) => (isZettleDemo
    ? Promise.resolve()
    : supabase.from('zettle_ledger_events').update({ reviewed_at: new Date().toISOString() }).eq('id', item.id));

  // Ingen fakturamatchning att falla tillbaka på (till skillnad från
  // handleBookSale/Stripe) — varje Zettle-försäljning bokförs alltid som en
  // NY intäkt: bank i debet, moms + intäktskonto i kredit.
  const handleBookZettleSale = (item, account, vatRate) => {
    if (!account) return;
    const gross = Math.round(Number(item.amount) || 0);
    const net = vatRate > 0 ? Math.round(gross / (1 + vatRate / 100)) : gross;
    const vat = gross - net;
    const rows = [
      { account: '1930', debet: gross, kredit: 0 },
      { account, debet: 0, kredit: net },
    ];
    if (vat > 0 && VAT_ACCOUNTS[vatRate]) rows.push({ account: VAT_ACCOUNTS[vatRate], debet: 0, kredit: vat });
    onAddVerification?.({
      date: (item.created_at_zettle || '').split('T')[0],
      description: `Zettle-försäljning${item.purchase_number ? ` — kvitto ${item.purchase_number}` : ''}`,
      source: 'zettle_ledger', sourceId: item.id,
      rows,
    });
    finishResolveZettle(item);
    markZettleReviewed(item);
  };

  const handleMarkZettleHandled = (item) => {
    finishResolveZettle(item);
    markZettleReviewed(item);
  };

  const handleBookPlatformFee = (item) => {
    const feeAmount = Math.round(Number(item.platform_fee_amount) || 0);
    if (feeAmount <= 0) return;
    onAddVerification?.({
      date: (item.created_at_stripe || '').split('T')[0],
      description: `Stripe plattformsavgift${item.matched_invoice_id ? ` — faktura ${item.matched_invoice_id}` : ''}`,
      source: 'stripe_ledger', sourceId: item.id,
      rows: [
        { account: '6570', debet: feeAmount, kredit: 0 },
        { account: '1930', debet: 0, kredit: feeAmount },
      ],
    });
    finishResolveStripe(item);
    markStripeReviewed(item);
  };

  // Ny, tidigare obokförd intäkt (till skillnad från handleBookPlatformFee
  // ovan, som bara RÄTTAR en redan bokförd fakturabetalning) — momsen
  // bryts därför ut precis som en riktig kontantförsäljning skulle, inte
  // en enda odelad rad.
  const handleBookSale = (item, account, vatRate) => {
    if (!account) return;
    const gross = Math.round(Number(item.amount) || 0);
    const net = vatRate > 0 ? Math.round(gross / (1 + vatRate / 100)) : gross;
    const vat = gross - net;
    const rows = [
      { account: '1930', debet: gross, kredit: 0 },
      { account, debet: 0, kredit: net },
    ];
    if (vat > 0 && VAT_ACCOUNTS[vatRate]) rows.push({ account: VAT_ACCOUNTS[vatRate], debet: 0, kredit: vat });
    onAddVerification?.({
      date: (item.created_at_stripe || '').split('T')[0],
      description: 'Stripe-betalning utan kopplad faktura',
      source: 'stripe_ledger', sourceId: item.id,
      rows,
    });
    finishResolveStripe(item);
    markStripeReviewed(item);
  };

  const handleMarkStripeHandled = (item) => {
    finishResolveStripe(item);
    markStripeReviewed(item);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <style>{REVIEW_LIST_CSS}</style>
      {/* Header i samma mönster som Kunder/Anställda och lön/Projekt/Bokföring. */}
      <ListPageHeader
        title="Granskning"
        // Antalet står i knappen, inte bara i bekräftelserutan: hur många
        // poster ett klick omfattar ska gå att se INNAN man klickar.
        actions={tab === 'pending' && bulkTargets.length > 0 ? [
          {
            key: 'bulk-approve',
            label: `${bulkIsSelection ? 'Godkänn markerade' : 'Godkänn alla'} (${bulkTargets.length})`,
            icon: CheckCircle2, onClick: () => setShowBulkConfirm(true), variant: 'primary',
          },
        ] : []}
        tabs={{
          items: [
            { id: 'pending', label: 'Väntar', badge: pendingItems.length },
            // Kundfeedback (uppföljning): en Stripe/Zettle-flik som bara
            // leder till "Ingen anslutning ännu" är brus för alla som inte
            // har kopplat den tjänsten — visas bara när företaget faktiskt
            // ÄR anslutet (eller i landningssidans demo, som simulerar en
            // anslutning via demoStripeItems/demoZettleItems).
            ...(company?.stripeAccountId || isDemo ? [{ id: 'stripe', label: 'Stripe', badge: visibleStripeItems.length }] : []),
            ...(company?.zettleAccessToken || isZettleDemo ? [{ id: 'zettle', label: 'Zettle', badge: visibleZettleItems.length }] : []),
            { id: 'history', label: 'Historik' },
          ],
          activeId: tab,
          onChange: setTab,
        }}
      />

      {/* Ingen padding på den yttre raden längre — matchar "facit"
          (Bokföring/Verifikationer): Historik-tabellen (nedan) ska sitta
          flush direkt under sidhuvudet. Väntar-fliken (kort, inte en
          tabell) behåller sin egen lokala padding. */}
      <div data-tour="page-review-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {tab === 'pending' && (
        visiblePending.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Allt är genomgånget</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>Det finns inga poster kvar att granska just nu.</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              {visiblePending.map(item => (
                <ReviewCard
                  key={item.id} item={item} accounts={accounts}
                  onApprove={handleApprove} onReject={handleReject}
                  exiting={exitingIds.has(item.id)}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                />
              ))}
            </div>
          </div>
        )
      )}

      {tab === 'stripe' && (
        !company?.stripeAccountId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CreditCard size={40} color="var(--text-muted)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Ingen Stripe-anslutning ännu</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '420px' }}>Anslut Stripe under Inställningar → Betalning för att få betalningar, utbetalningar och avgifter hämtade hit som bokföringsunderlag.</p>
          </div>
        ) : stripeLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Läser in...</div>
        ) : visibleStripeItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Allt är genomgånget</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>Inga Stripe-transaktioner väntar på granskning just nu. Nya rader hämtas en gång om dagen.</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              {visibleStripeItems.map(item => (
                <StripeLedgerCard
                  key={item.id} item={item} accounts={accounts}
                  onBookPlatformFee={handleBookPlatformFee}
                  onBookSale={handleBookSale}
                  onMarkHandled={handleMarkStripeHandled}
                  exiting={exitingIds.has(item.id)}
                  onOpenInvoice={handleGlobalAction && (id => handleGlobalAction({ type: 'open_invoice', payload: { id } }, 'invoices'))}
                />
              ))}
            </div>
          </div>
        )
      )}

      {tab === 'zettle' && (
        !company?.zettleAccessToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CreditCard size={40} color="var(--text-muted)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Ingen Zettle-anslutning ännu</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '420px' }}>Anslut Zettle under Inställningar → Betalning för att få kortförsäljningen hämtad hit som bokföringsunderlag.</p>
          </div>
        ) : zettleLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Läser in...</div>
        ) : visibleZettleItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>Allt är genomgånget</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>Ingen Zettle-försäljning väntar på granskning just nu. Nya rader hämtas en gång om dagen.</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              {visibleZettleItems.map(item => (
                <ZettleLedgerCard
                  key={item.id} item={item} accounts={accounts}
                  onBookSale={handleBookZettleSale}
                  onMarkHandled={handleMarkZettleHandled}
                  exiting={exitingIds.has(item.id)}
                />
              ))}
            </div>
          </div>
        )
      )}

      {tab === 'history' && (
        <ListTable
          rowKey={h => h.id}
          emptyMessage="Inget har hanterats än."
          rows={reviewHistory}
          columns={[
            { key: 'post', label: 'Post', fontWeight: 600, color: 'var(--text-main)', render: h => `${h.title} · ${formatSEK(h.amount)}` },
            { key: 'account', label: 'Konto', color: 'var(--text-main)', render: h => `${h.account} ${h.accountName}` },
            { key: 'resolvedBy', label: 'Hanterad av', color: 'var(--text-main)', render: h => h.resolvedBy },
            { key: 'resolvedAt', label: 'När', render: h => formatDateTime(h.resolvedAt) },
            {
              key: 'method', label: 'Metod', render: h => (
                <span style={{
                  padding: '3px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600,
                  background: h.method === 'manual' ? 'var(--border-light)' : 'var(--status-green-bg)',
                  color: h.method === 'manual' ? 'var(--text-main)' : 'var(--status-green-text)',
                }}>
                  {h.method === 'bulk' ? 'Godkänd i klump' : h.method === 'manual' ? 'Manuellt vald' : 'Förslag godkänt'}
                </span>
              ),
            },
          ]}
        />
      )}

      {/* Bekräftelsedialog för "Godkänn alla" — aldrig en tyst massoperation */}
      {showBulkConfirm && (
        <div className="modal-overlay" onClick={() => setShowBulkConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{bulkIsSelection ? 'Godkänn markerade?' : 'Godkänn alla?'}</h2>
              <button className="modal-close" onClick={() => setShowBulkConfirm(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, margin: '0 0 8px' }}>{bulkSummary}</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                {bulkIsSelection
                  ? 'Bara de poster du markerat ingår. Poster utan konto går inte att markera — de behöver ett konto först.'
                  : 'Poster med osäkra förslag ingår inte — de kräver individuell hantering under Väntar.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowBulkConfirm(false)} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>Avbryt</button>
                <button onClick={handleBulkApprove} style={{ padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'white' }}>Fortsätt</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
