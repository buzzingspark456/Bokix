import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Check, X, ChevronDown, ChevronUp, ShieldCheck, CreditCard, Landmark, HelpCircle, FileText, Receipt, Info, RotateCcw, Paperclip, Pencil } from './icons';
import { AccountSearch } from './shared/SearchInputs';
import ListPageHeader from './shared/ListPageHeader';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import { supabase } from '../supabaseClient';
import { VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './AccountsData';
import { t } from '../i18n';
import { StripeLogo, ZettleLogo } from './shared/BrandLogos';
import { categorizeStripeItem, buildStripeVerification, isSafeStripeItem, STRIPE_FEE_ACCOUNT, BANK_ACCOUNT } from '../utils/stripeLedger';
import { uploadFileToStorage } from '../utils/fileUpload';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const formatSEK = (val) => numberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const formatMoney = (val, currency) => numberFormat('sv-SE', { style: 'currency', currency: (currency || 'sek').toUpperCase(), maximumFractionDigits: 2 }).format(val || 0);
const formatDate = (d) => {
  if (!d) return '—';
  try { return dateTimeFormat('sv-SE').format(new Date(d)); } catch { return d; }
};
const formatDateTime = (iso) => {
  if (!iso) return '—';
  try { return dateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; }
};

const KIND_LABEL = { receipt: t('ui.kvitto_2'), supplier_invoice: t('ui.leverantorsfaktura_liten') };
const KIND_LABEL_PLURAL = { receipt: t('ui.kvitton_2'), supplier_invoice: t('ui.leverantorsfakturor_liten') };

/** "2 dagar sedan" till metaraden. Ett datum säger vilken dag posten är
 * från; ålder säger hur länge den legat och väntat — det är det senare man
 * granskar efter, så båda står i raden. */
const agoLabel = (d) => {
  if (!d) return null;
  const then = new Date(d);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return t('ui.i_dag');
  if (days === 1) return t('ui.n1_dag_sedan');
  if (days < 30) return t('ui.dagar_sedan', { days });
  const months = Math.floor(days / 30);
  return months === 1 ? t('ui.n1_manad_sedan') : t('ui.manader_sedan', { months });
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
  .rq-brand { display: inline-flex; vertical-align: -3px; margin-right: 7px; }
  .rq-meta { font-size: 11px; font-weight: 700; letter-spacing: 0.055em; text-transform: uppercase; color: var(--text-muted); line-height: 1.5; }
  .rq-title { font-size: 14.5px; font-weight: 600; color: var(--text-main); margin-top: 5px; line-height: 1.45; }
  .rq-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
  .rq-src { display: flex; gap: 14px; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--border); background: var(--bg-card); }
  .rq-src-logo { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--bg-card); border: 1px solid var(--border); overflow: hidden; color: var(--text-secondary); }
  .rq-src-title { font-size: 15px; font-weight: 700; color: var(--text-main); }
  .rq-src-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
  .rq-src-stats { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0; }
  .rq-stat { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .rq-src-wordmark { display: flex; align-items: center; height: 28px; margin-bottom: 4px; }
  .rq-section { position: sticky; top: 0; z-index: 2; padding: 9px 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.055em; text-transform: uppercase; color: var(--text-muted); background: var(--bg-muted); border-bottom: 1px solid var(--border-light); }
  .rq-row + .rq-section { border-top: 1px solid var(--border-light); }
  .rq-more { display: block; width: 100%; padding: 12px; border: none; border-top: 1px solid var(--border-light); background: var(--bg-card); color: var(--accent-text); font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .rq-booking { display: flex; gap: 8px 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
  /* Ändra konto och Lägg till underlag: små knappar med ram, lätta att träffa. */
  .rq-chip-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .rq-chip-btn:hover { border-color: var(--accent); color: var(--accent-text); }
  .rq-chip-btn svg { color: var(--accent-text); }
  .rq-booking-account { font-weight: 600; color: var(--text-main); }
  @media (max-width: 640px) { .rq-chip-btn { height: 36px; } }
  .rq-link { border: 0; background: none; padding: 0; color: var(--accent-text); font-weight: 700; cursor: pointer; font-size: inherit; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; }
  .rq-file { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; background: var(--bg-muted); color: var(--text-main); font-size: 12px; font-weight: 600; max-width: 240px; }
  .rq-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Loggor med en ljus och en mörk variant (ThemedLogo i BrandLogos.jsx):
     webbplatsen döljer den ena, i appen måste det göras här. */
  .rq-src .lp-logo-dark { display: none; }
  :root[data-theme="dark"] .rq-src .lp-logo-light { display: none; }
  :root[data-theme="dark"] .rq-src .lp-logo-dark { display: inline-block; }
  @media (max-width: 640px) {
    .rq-src { flex-wrap: wrap; padding: 14px; gap: 12px; }
    .rq-src-stats { justify-content: flex-start; width: 100%; }
    .rq-section { padding: 8px 14px; }
    .rq-account-picker { flex-direction: column; align-items: stretch !important; }
    .rq-account-picker button { justify-content: center; height: 38px; }
    .rq-list { padding: 0 0 18px; }
    .rq-row { padding: 14px 14px; gap: 11px; }
    .rq-head { flex-direction: column; gap: 6px; }
    .rq-actions button { flex: 1 1 auto; justify-content: center; }
    .rq-meta-mid { display: none; }
    .rq-title { font-size: 15px; }
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
  // Tjänstens logga (Stripe, Zettle) först på metaraden, så man ser var
  // raden kommer ifrån innan man läser den.
  brand,
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
          className="rq-check"
          checked={selected}
          disabled={!selectable}
          onChange={onToggleSelect}
          title={selectable ? t('ui.markera_for_att_godkanna_flera_pa_en_gang') : selectHint}
          aria-label={selectable ? t('ui.markera', { title }) : selectHint}
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
            <div className="rq-meta">
              {brand && <span className="rq-brand">{brand}</span>}
              {/* Första och sista delen (typ, ålder) syns alltid; förklaringarna
                  däremellan döljs på telefon, där de tog tre rader. */}
              {meta.filter(Boolean).map((part, i, all) => (
                <span key={i} className={i > 0 && i < all.length - 1 ? 'rq-meta-mid' : undefined}>{i > 0 ? ' · ' : ''}{part}</span>
              ))}
            </div>
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

/**
 * Rutan överst i varje flik: varifrån posterna kommer (tjänstens logga en
 * gång, i egen ruta, i stället för liten på varje rad), vad Bokix gör med
 * dem och hur många som är klara, behöver ett val eller är manuella.
 */
function SourcePanel({ logo, wordmark, title, text, stats }) {
  return (
    <div className="rq-src">
      {/* Stripe och Zettle: tjänstens eget ordmärke som rubrik, utan ruta. */}
      {!wordmark && <span className="rq-src-logo">{logo}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {wordmark ? <div className="rq-src-wordmark" role="heading" aria-level={2} aria-label={title}>{wordmark}</div> : <div className="rq-src-title">{title}</div>}
        <div className="rq-src-text">{text}</div>
      </div>
      <div className="rq-src-stats">
        {stats.filter(stat => stat.n > 0).map(stat => {
          const tone = BADGE_TONES[stat.tone];
          return <span key={stat.label} className="rq-stat" style={{ background: tone.bg, color: tone.fg }}>{stat.label}</span>;
        })}
      </div>
    </div>
  );
}

/** Raderna i grupper (Klart att bokföra, Behöver ditt val, ...); tomma
 * grupper hoppas över. Långa grupper visar 20 rader åt gången, så 50 eller
 * 200 Stripe-transaktioner inte blir en vägg; gruppetiketten följer med när
 * man scrollar. */
const GROUP_PAGE = 20;
function GroupedRows({ groups }) {
  const [shown, setShown] = useState({});
  return groups.filter(group => group.items.length > 0).map(group => {
    const limit = shown[group.label] || GROUP_PAGE;
    const rest = group.items.length - limit;
    return (
      <React.Fragment key={group.label}>
        <div className="rq-section">{group.label} · {group.items.length}</div>
        {group.items.slice(0, limit).map(group.render)}
        {rest > 0 && (
          <button type="button" className="rq-more" onClick={() => setShown(prev => ({ ...prev, [group.label]: limit + GROUP_PAGE }))}>
            {t('ui.rq_visa_fler', { n: Math.min(rest, GROUP_PAGE), total: rest })}
          </button>
        )}
      </React.Fragment>
    );
  });
}

/** Underlag till en verifikation: en fil som laddas upp när raden bokförs. */
function AttachmentPicker({ file, onChange }) {
  const inputRef = React.useRef(null);
  if (file) {
    return (
      <span className="rq-file">
        <Paperclip size={12} /><span>{file.name}</span>
        <button type="button" className="rq-link" onClick={() => onChange(null)} aria-label={t('ui.rq_ta_bort_underlag')} title={t('ui.rq_ta_bort_underlag')}><X size={12} /></button>
      </span>
    );
  }
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { onChange(e.target.files?.[0] || null); e.target.value = ''; }} />
      <button type="button" className="rq-chip-btn" onClick={() => inputRef.current?.click()}><Paperclip size={14} /> {t('ui.rq_lagg_till_underlag')}</button>
    </>
  );
}

/** Hur en post i historiken hanterades: godkänt förslag, i klump eller manuellt. */
function MethodPill({ method }) {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
      background: method === 'manual' ? 'var(--border-light)' : 'var(--status-green-bg)',
      color: method === 'manual' ? 'var(--text-main)' : 'var(--status-green-text)',
    }}>
      {method === 'bulk' ? t('ui.godkand_i_klump') : method === 'manual' ? t('ui.manuellt_vald') : t('ui.forslag_godkant')}
    </span>
  );
}

// Stripe-ledgerns typsträngar → svensk etikett, bara för visning (samma
// princip som SUBSCRIPTION_STATUS_LABELS i Settings.jsx — ingen omkodning
// av själva datan, bara UI-text).
const STRIPE_TYPE_LABEL = {
  transfer: t('ui.stripe_overforing'), payout: t('ui.stripe_utbetalning'), charge: t('ui.stripe_betalning'), payment: t('ui.stripe_betalning'),
  refund: t('ui.stripe_aterbetalning'), adjustment: t('ui.stripe_justering'), stripe_fee: t('ui.stripe_avgift'),
};

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
  // Saknas förslag är kontovalet det enda som återstår: visa det direkt.
  const [rejecting, setRejecting] = useState(!item.account);
  const [manualAccount, setManualAccount] = useState('');

  const isSupplierInvoice = item.type === 'supplier_invoice';
  const kindLabel = KIND_LABEL[item.type] || t('ui.post_liten');
  const suggestedAccountObj = accounts.find(a => a.code === item.account);
  // Ett mejlat underlag har ofta varken leverantör eller belopp ännu: visa
  // mejlets ämne i stället för 'okänt inköpsställe 0 kr'.
  const who = item.supplier || item.description || t('ui.okant_inkopsstalle');
  const amountText = Number(item.amount) ? formatSEK(item.amount) : '';

  // "Föreslaget ur tidigare konteringar" är ordagrant vad suggestAccount
  // gör (samma leverantör, samma konto förra gången) — aldrig "föreslaget
  // av AI", som hade varit ett påstående koden inte kan backa upp.
  const meta = [
    isSupplierInvoice ? t('ui.leverantorsfaktura_stor') : t('ui.kvitto'),
    item.account ? t('ui.foreslaget_ur_tidigare') : t('ui.ingen_tidigare_matchning'),
    agoLabel(item.date),
  ];

  const title = item.account
    ? `Kontera ${who} ${formatSEK(item.amount)} som ${item.account} ${suggestedAccountObj?.name || ''}`.trim()
    : t('ui.ange_konto_for', { who, v1: amountText }).trim();

  const badge = item.account
    ? (item.confident ? { label: t('ui.sakert_forslag'), tone: 'green' } : { label: t('ui.osakert_forslag'), tone: 'amber' })
    : { label: t('ui.konto_saknas'), tone: 'neutral' };

  // Utan förslag: bara fältet och knappen, direkt under meningen.
  const pickerRow = (
    <div className="rq-account-picker" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <AccountSearch value={manualAccount} onChange={setManualAccount} accounts={accounts} placeholder={t('ui.sok_konto_2')} />
      </div>
      <button
        disabled={!manualAccount}
        onClick={() => onReject(item, manualAccount)}
        style={{ ...rowButtonStyle(manualAccount ? 'primary' : 'secondary'), opacity: manualAccount ? 1 : 0.6, cursor: manualAccount ? 'pointer' : 'not-allowed' }}
      >
        <Check size={14} /> {t('ui.bokfor_med_detta_konto')}
      </button>
    </div>
  );
  const picker = !item.account ? <div style={{ marginTop: '12px' }}>{pickerRow}</div> : rejecting && (
      <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
          {item.account ? t('ui.fel_forslag_ange_ratt_konto') : t('ui.ange_konto')}
        </div>
        <div className="rq-account-picker" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AccountSearch value={manualAccount} onChange={setManualAccount} accounts={accounts} placeholder={t('ui.sok_konto_2')} />
          </div>
          <button
            disabled={!manualAccount}
            onClick={() => onReject(item, manualAccount)}
            style={{ ...rowButtonStyle(manualAccount ? 'primary' : 'secondary'), opacity: manualAccount ? 1 : 0.6, cursor: manualAccount ? 'pointer' : 'not-allowed' }}
          >
            {t('ui.bokfor_med_detta_konto')}
          </button>
        </div>
        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('ui.posten_bokfors_direkt_med_kontot_du_valjer_den_f')}
        </p>
      </div>
  );

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
      selectHint={t('ui.posten_saknar_konto')}
      extra={!item.account && picker}
      actions={
        <>
          {item.account && (
            <button onClick={() => onApprove(item)} style={rowButtonStyle('primary')}>
              <Check size={14} /> {t('ui.godkann')}
            </button>
          )}
          {item.account && (
            <button onClick={() => setRejecting(r => !r)} style={rowButtonStyle('danger')}>
              <X size={14} /> {t('ui.avvisa')}
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> {t('ui.visa_detaljer')} {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {item.account && picker}

      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.typ_2')}</span> {kindLabel}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.datum_2')}</span> {formatDate(item.date)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.belopp_3')}</span> {formatSEK(item.amount)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.moms_5')}</span> {item.vatAmount ? formatSEK(item.vatAmount) : '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>{t('ui.inkopsstalle_leverantor_2')}</span> {item.supplier || '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>{t('ui.underlag_2')}</span> {t('ui.inget_bifogat_underlag_ar_sparat_for_denna_post')}</div>
        </div>
      )}
    </ReviewRowShell>
  );
}
const VAT_RATES = [25, 12, 6, 0];

/** Ett kort för en Stripe-ledgerrad (public.stripe_ledger_events). Läget
 * avgörs av categorizeStripeItem (utils/stripeLedger.js):
 *  - säkra lägen (avgift, utbetalning, fakturabetalning): allt kommer från
 *    Stripe, en knapp bokför.
 *  - 'sale'/'refund': momssats och intäktskonto väljs av användaren, ingen
 *    gissning. Senaste valet föreslås igen.
 *  - 'manual' (utländsk valuta, ovanliga typer): bara kvittera.
 */
function StripeLedgerCard({ item, accounts, onBook, onMarkHandled, exiting, onOpenInvoice, lastChoice }) {
  const [expanded, setExpanded] = useState(false);
  const [vatRate, setVatRate] = useState(lastChoice?.vatRate ?? 25);
  const [saleAccount, setSaleAccount] = useState(lastChoice?.account || REVENUE_ACCOUNTS[25]);
  // Avgifts- och bankkontot är förifyllda (6570 och 1930, eller det du valde
  // förra gången) och står som en rad text; Ändra visar kontosökningen.
  const [feeAccount, setFeeAccount] = useState(lastChoice?.feeAccount || STRIPE_FEE_ACCOUNT);
  const [bankAccount, setBankAccount] = useState(lastChoice?.bankAccount || BANK_ACCOUNT);
  const [editingAccount, setEditingAccount] = useState(false);
  const [file, setFile] = useState(null);

  const category = categorizeStripeItem(item);
  const typeLabel = STRIPE_TYPE_LABEL[item.type] || item.type;
  const isForeign = item.currency !== 'sek';
  const fee = Number(item.fee) || 0;
  const absAmount = Math.abs(Number(item.amount) || 0);
  const needsChoice = category === 'sale' || category === 'refund';
  const safeBadge = { label: t('ui.sakert_forslag'), tone: 'green' };

  const view = {
    platform_fee: {
      icon: ShieldCheck, tone: 'green',
      note: t('ui.beraknad_ur_fakturans_bokforda_belopp'),
      title: t('ui.bokfor_bokix_plattformsavgift_mot_6570_bankkostn', { v0: formatSEK(item.platform_fee_amount) }),
      badge: { label: t('ui.beraknad_avgift'), tone: 'green' },
      button: t('ui.bokfor_avgift'),
    },
    invoice_fee: {
      icon: ShieldCheck, tone: 'green',
      note: t('ui.stripe_rq_avgift_note'),
      title: t('ui.stripe_rq_avgift_title', { v0: formatSEK(fee) }),
      badge: safeBadge,
      button: t('ui.bokfor_avgift'),
    },
    invoice_paid: {
      icon: CheckCircle2, tone: 'green',
      note: t('ui.stripe_rq_betald_note'),
      title: t('ui.stripe_rq_betald_title', { v0: formatSEK(absAmount) }),
      badge: safeBadge,
    },
    payout: {
      icon: Landmark, tone: 'green',
      note: t('ui.stripe_rq_utbetalning_note'),
      title: t('ui.stripe_rq_utbetalning_title', { v0: formatSEK(absAmount) }),
      badge: safeBadge,
      button: t('ui.stripe_rq_bokfor'),
    },
    fee: {
      icon: HelpCircle, tone: 'amber',
      note: t('ui.stripe_rq_fristaende_note'),
      title: t('ui.stripe_rq_avgift_fristaende_title', { v0: formatSEK(absAmount) }),
      badge: { label: t('ui.stripe_rq_kontrollera'), tone: 'amber' },
      button: t('ui.bokfor_avgift'),
    },
    sale: {
      icon: CreditCard, tone: 'amber',
      note: t('ui.ingen_matchande_faktura'),
      title: t('ui.bokfor_betalning_valj_momssats_och_intaktskonto', { v0: formatSEK(absAmount) }),
      badge: { label: t('ui.kraver_val'), tone: 'amber' },
      button: t('ui.bokfor_forsaljning'),
    },
    refund: {
      icon: RotateCcw, tone: 'amber',
      note: typeLabel,
      title: t('ui.stripe_rq_aterbetalning_title', { v0: formatSEK(absAmount) }),
      badge: { label: t('ui.kraver_val'), tone: 'amber' },
      button: t('ui.stripe_rq_bokfor_aterbetalning'),
    },
    manual: {
      icon: HelpCircle, tone: 'neutral',
      note: isForeign ? t('ui.utlandsk_valuta') : t('ui.ingen_automatisk_kontering_annu'),
      title: t('ui.hanteras_manuellt', { typeLabel, v1: formatMoney(item.amount, item.currency) }),
      badge: { label: t('ui.manuell'), tone: 'neutral' },
    },
  }[category];

  const canBook = !needsChoice || Boolean(saleAccount);
  const book = () => onBook(item, {
    ...(needsChoice ? { account: saleAccount, vatRate, vatAccount: VAT_ACCOUNTS[vatRate] } : {}),
    feeAccount, bankAccount, file,
  });
  // Kontot som raden bokförs mot och som går att byta: banken för en
  // utbetalning, annars avgiftskontot (försäljning väljer intäktskonto ovan).
  const accountKind = category === 'payout' ? 'bank' : ['platform_fee', 'invoice_fee', 'fee'].includes(category) ? 'fee' : null;
  const mainAccount = accountKind === 'bank' ? bankAccount : feeAccount;
  const setMainAccount = accountKind === 'bank' ? setBankAccount : setFeeAccount;
  const accountName = (code) => accounts.find(a => a.code === code)?.name || '';
  const bookingLine = view.button && (
    <div className="rq-booking">
      {accountKind && (editingAccount ? (
        <div style={{ minWidth: '220px', flex: '1 1 260px' }}>
          <AccountSearch value={mainAccount} onChange={v => { setMainAccount(v); if (v) setEditingAccount(false); }} accounts={accounts} placeholder={t('ui.sok_konto_2')} />
        </div>
      ) : (
        <>
          <span>{t(accountKind === 'bank' ? 'ui.rq_bankkonto' : 'ui.rq_kostnadskonto')}: <span className="rq-booking-account">{mainAccount} {accountName(mainAccount)}</span></span>
          <button type="button" className="rq-chip-btn" onClick={() => setEditingAccount(true)}><Pencil size={14} /> {t('ui.rq_andra_konto')}</button>
        </>
      ))}
      <AttachmentPicker file={file} onChange={setFile} />
    </div>
  );

  return (
    <ReviewRowShell
      icon={view.icon}
      tone={view.tone}
      meta={[typeLabel, view.note, agoLabel(item.created_at_stripe)]}
      title={view.title}
      badge={view.badge}
      exiting={exiting}
      extra={needsChoice && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={vatRate} onChange={e => { const r = Number(e.target.value); setVatRate(r); setSaleAccount(REVENUE_ACCOUNTS[r]); }} style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}>
              {VAT_RATES.map(r => <option key={r} value={r}>{r}{t('ui.moms_6')}</option>)}
            </select>
            <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
              <AccountSearch value={saleAccount} onChange={setSaleAccount} accounts={accounts} placeholder={t('ui.intaktskonto')} />
            </div>
          </div>
          {fee > 0 && <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>{t('ui.stripe_rq_med_avgift', { v0: formatSEK(fee) })}</p>}
          {bookingLine}
        </div>
      ) || bookingLine}
      actions={
        <>
          {view.button && (
            <button
              disabled={!canBook}
              onClick={book}
              style={{ ...rowButtonStyle(canBook ? 'primary' : 'secondary'), opacity: canBook ? 1 : 0.6, cursor: canBook ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} /> {view.button}
            </button>
          )}
          {category === 'payout' && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle('secondary')}>
              {t('ui.stripe_rq_redan_i_banken')}
            </button>
          )}
          {(category === 'invoice_paid' || category === 'manual') && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle(category === 'invoice_paid' ? 'primary' : 'secondary')}>
              {t('ui.markera_som_hanterad')}
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> {t('ui.visa_detaljer')} {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.typ_2')}</span> {typeLabel} ({item.type})</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.datum_2')}</span> {formatDate(item.created_at_stripe)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.belopp_3')}</span> {formatMoney(item.amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.valuta_2')}</span> {(item.currency || '').toUpperCase()}</div>
          {item.matched_invoice_id && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('ui.kopplad_faktura')}</span>
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
                  {t('ui.visa_fakturan')}
                </button>
              ) : item.matched_invoice_id}
              <span style={{ color: 'var(--text-muted)' }}>{t('ui.basta_forsok_matchning_pa_tidsnarhet_inte_garant')}</span>
            </div>
          )}
          {item.description && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>{t('ui.stripe_beskrivning')}</span> {item.description}</div>}
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

/** Vad en Zettle-rad är: köp (sale), återbetalning (refund), köp med flera
 * betalsätt (split), dagens avgifter (fee) eller utbetalning till banken
 * (payout). Avgifter och utbetalningar hämtas från Zettles Finance API
 * sedan 2026-10-17 (kind i zettle_ledger_events). */
function zettleCategory(item) {
  if (item.kind === 'fee') return 'fee';
  if (item.kind === 'payout') return 'payout';
  if (item.is_refund) return 'refund';
  if (item.payment_type === 'SPLIT') return 'split';
  return 'sale';
}

// Kontanter ligger i kassan. Kortpengar är en fordran på Zettle (1686) tills
// Zettle betalar ut dem till banken, med avgiften avdragen.
const ZETTLE_BALANCE_ACCOUNT = '1686';
const zettlePayAccount = (item) => (item.payment_type === 'CASH' ? '1910' : ZETTLE_BALANCE_ACCOUNT);
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Zettle skickar momsbeloppet. Stämmer det på kronan med en momssats
 * (25, 12 eller 6 %) är förslaget säkert; 0 kr moms räknas inte som säkert,
 * det kan lika gärna betyda att momsen saknas i Zettle. */
function isCertainZettleVat(item) {
  if (zettleCategory(item) !== 'sale') return false;
  const gross = Number(item.amount) || 0;
  const vat = Number(item.vat_amount) || 0;
  if (gross <= 0 || vat <= 0) return false;
  const rate = guessVatRate(item);
  return rate > 0 && Math.abs(vat - gross * rate / (100 + rate)) <= 1;
}

/** Klart att bokföra utan val: säkra köp, avgifter och utbetalningar. */
const isSafeZettleItem = (item) => ['fee', 'payout'].includes(zettleCategory(item)) || isCertainZettleVat(item);

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
function ZettleLedgerCard({ item, accounts, onBookSale, onBookFinance, onMarkHandled, exiting }) {
  const [expanded, setExpanded] = useState(false);
  const initialVat = guessVatRate(item);
  const [vatRate, setVatRate] = useState(initialVat);
  const [saleAccount, setSaleAccount] = useState(REVENUE_ACCOUNTS[initialVat]);
  const certain = isCertainZettleVat(item);
  // Säkert förslag: valen visas som en rad text, väljarna först på Ändra.
  const [editing, setEditing] = useState(!certain);
  const [file, setFile] = useState(null);

  const category = zettleCategory(item);
  const paymentLabel = category === 'fee' ? t('ui.rq_zettle_avgifter') : category === 'payout' ? t('ui.rq_zettle_utbetalning')
    : (ZETTLE_PAYMENT_LABEL[item.payment_type] || item.payment_type || t('ui.okand_betalmetod'));
  const safeBadge = { label: t('ui.sakert_forslag'), tone: 'green' };

  const view = {
    fee: {
      icon: ShieldCheck, tone: 'green',
      title: t('ui.rq_zettle_avgift_title', { date: formatDate(item.created_at_zettle), v0: formatMoney(item.amount, item.currency) }),
      badge: safeBadge,
    },
    payout: {
      icon: Landmark, tone: 'green',
      title: t('ui.rq_zettle_utbetalning_title', { v0: formatMoney(item.amount, item.currency) }),
      badge: safeBadge,
    },
    split: {
      icon: HelpCircle, tone: 'neutral',
      title: t('ui.rq_zettle_delad_title', { v0: formatMoney(item.amount, item.currency), v1: item.purchase_number ? ` — kvitto ${item.purchase_number}` : '' }),
      badge: { label: t('ui.manuell'), tone: 'neutral' },
    },
    sale: {
      icon: certain ? ShieldCheck : CreditCard, tone: certain ? 'green' : 'amber',
      title: t('ui.bokfor_forsaljning_2', { v0: formatMoney(item.amount, item.currency), v1: item.purchase_number ? ` — kvitto ${item.purchase_number}` : '' }),
      badge: certain ? { label: t('ui.sakert_forslag'), tone: 'green' } : { label: t('ui.kraver_val'), tone: 'amber' },
    },
    refund: {
      icon: RotateCcw, tone: 'neutral',
      title: t('ui.aterbetalning', { v0: formatMoney(item.amount, item.currency), v1: item.purchase_number ? ` — kvitto ${item.purchase_number}` : '' }),
      badge: { label: t('ui.manuell'), tone: 'neutral' },
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
      extra={category === 'sale' && !editing && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>{t('ui.rq_zettle_moms_enligt', { rate: vatRate })} · {saleAccount} {accounts.find(a => a.code === saleAccount)?.name || ''} · {t(item.payment_type === 'CASH' ? 'ui.rq_zettle_till_kassan' : 'ui.rq_zettle_till_fordran')}</span>
          <button type="button" className="rq-chip-btn" onClick={() => setEditing(true)}><Pencil size={14} /> {t('ui.rq_andra_konto')}</button>
          <AttachmentPicker file={file} onChange={setFile} />
        </div>
      ) || category === 'sale' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
          <select value={vatRate} onChange={e => { const r = Number(e.target.value); setVatRate(r); setSaleAccount(REVENUE_ACCOUNTS[r]); }} style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}>
            {VAT_RATES.map(r => <option key={r} value={r}>{r}{t('ui.moms_6')}</option>)}
          </select>
          <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
            <AccountSearch value={saleAccount} onChange={setSaleAccount} accounts={accounts} placeholder={t('ui.intaktskonto')} />
          </div>
          <div className="rq-booking" style={{ width: '100%', marginTop: 0 }}><AttachmentPicker file={file} onChange={setFile} /></div>
        </div>
      )}
      actions={
        <>
          {category === 'sale' && (
            <button
              disabled={!saleAccount}
              onClick={() => onBookSale(item, saleAccount, vatRate, file)}
              style={{ ...rowButtonStyle(saleAccount ? 'primary' : 'secondary'), opacity: saleAccount ? 1 : 0.6, cursor: saleAccount ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} /> {t('ui.bokfor_forsaljning')}
            </button>
          )}
          {(category === 'fee' || category === 'payout') && (
            <button onClick={() => onBookFinance(item)} style={rowButtonStyle('primary')}>
              <Check size={14} /> {category === 'fee' ? t('ui.bokfor_avgift') : t('ui.stripe_rq_bokfor')}
            </button>
          )}
          {category === 'payout' && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle('secondary')}>
              {t('ui.stripe_rq_redan_i_banken')}
            </button>
          )}
          {(category === 'refund' || category === 'split') && (
            <button onClick={() => onMarkHandled(item)} style={rowButtonStyle('secondary')}>
              {t('ui.markera_som_hanterad')}
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ ...rowButtonStyle('ghost'), marginLeft: 'auto' }}>
            <Info size={14} /> {t('ui.visa_detaljer')} {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
    >
      {(category === 'fee' || category === 'payout') && (
        <div className="rq-booking">
          {category === 'fee' ? t('ui.rq_zettle_avgift_kontering') : t('ui.rq_zettle_utbetalning_kontering')}
        </div>
      )}
      {expanded && (
        <div className="form-row-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.datum_2')}</span> {formatDate(item.created_at_zettle)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.belopp_3')}</span> {formatMoney(item.amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.moms_fran_zettle')}</span> {formatMoney(item.vat_amount, item.currency)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('ui.betalmetod')}</span> {paymentLabel}</div>
          {item.purchase_number && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>{t('ui.zettle_kvitto')}</span> #{item.purchase_number}</div>}
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
      return t('ui.kategoriseras_som', { count, label, accName });
    });
    return t('ui.detta_godkanner', { length: bulkTargets.length, v1: bulkTargets.length === 1 ? 'post' : 'poster', v2: parts.join(', ') });
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

  const safeZettleItems = visibleZettleItems.filter(isSafeZettleItem);
  const handleBookAllSafeZettle = async () => {
    if (safeZettleItems.length === 0) return;
    if (!(await confirmDialog(t('ui.rq_zettle_bokfor_alla_fraga', { n: safeZettleItems.length })))) return;
    safeZettleItems.forEach(item => {
      if (zettleCategory(item) !== 'sale') { handleBookZettleFinance(item); return; }
      const rate = guessVatRate(item);
      handleBookZettleSale(item, REVENUE_ACCOUNTS[rate], rate);
    });
  };

  const markZettleReviewed = (item) => (isZettleDemo
    ? Promise.resolve()
    : supabase.from('zettle_ledger_events').update({ reviewed_at: new Date().toISOString() }).eq('id', item.id));

  // Ingen fakturamatchning att falla tillbaka på (till skillnad från
  // handleBookSale/Stripe) — varje Zettle-försäljning bokförs alltid som en
  // NY intäkt: bank i debet, moms + intäktskonto i kredit.
  // Underlaget laddas upp när raden bokförs, samma som på Stripe-raderna.
  const uploadAttachment = async (file) => {
    if (!file) return {};
    if (isDemo || isZettleDemo || !user?.id) return { attachmentName: file.name };
    const attachmentUrl = await uploadFileToStorage(user.id, file, 'verifications');
    return { attachmentUrl, attachmentName: file.name, attachmentType: file.type };
  };

  const handleBookZettleSale = async (item, account, vatRate, file) => {
    if (!account) return;
    let attachment = {};
    try { attachment = await uploadAttachment(file); } catch (error) {
      setStripeSync({ running: false, message: t('ui.rq_underlag_fel', { v0: error.message || error }) });
      return;
    }
    // Öresbelopp (Zettle skickar ören), inte avrundat till hela kronor. Momsen
    // tas från Zettle när den stämmer med momssatsen, annars räknas den fram.
    const gross = round2(item.amount);
    const vat = vatRate > 0
      ? (isCertainZettleVat(item) && guessVatRate(item) === vatRate ? round2(item.vat_amount) : round2(gross - gross / (1 + vatRate / 100)))
      : 0;
    const net = round2(gross - vat);
    const rows = [
      { account: zettlePayAccount(item), debet: gross, kredit: 0 },
      { account, debet: 0, kredit: net },
    ];
    if (vat > 0 && VAT_ACCOUNTS[vatRate]) rows.push({ account: VAT_ACCOUNTS[vatRate], debet: 0, kredit: vat });
    onAddVerification?.({
      date: (item.created_at_zettle || '').split('T')[0],
      description: `Zettle-försäljning${item.purchase_number ? ` — kvitto ${item.purchase_number}` : ''}`,
      source: 'zettle_ledger', sourceId: item.id,
      rows,
      ...attachment,
    });
    finishResolveZettle(item);
    markZettleReviewed(item);
  };

  // Avgifter: 6570 mot fordran på Zettle. Utbetalning: banken mot fordran.
  const handleBookZettleFinance = (item) => {
    const amount = round2(item.amount);
    const isFee = zettleCategory(item) === 'fee';
    const date = (item.created_at_zettle || '').split('T')[0];
    onAddVerification?.({
      date,
      description: isFee ? `Zettle-avgifter ${date}` : 'Zettle-utbetalning till bankkontot',
      source: 'zettle_ledger', sourceId: item.id,
      rows: [
        { account: isFee ? '6570' : '1930', debet: amount, kredit: 0 },
        { account: ZETTLE_BALANCE_ACCOUNT, debet: 0, kredit: amount },
      ],
    });
    finishResolveZettle(item);
    markZettleReviewed(item);
  };

  const handleMarkZettleHandled = (item) => {
    finishResolveZettle(item);
    markZettleReviewed(item);
  };

  // Senaste momssats/intäktskonto för Stripe-försäljning föreslås igen på
  // nästa rad (bara ett startvärde, märkt Kräver val). Per företag, i
  // webbläsaren; försvinner det börjar man om på 25 %.
  const stripeChoiceKey = `bokix_stripe_sale_choice_${company?.id || 'demo'}`;
  const [lastStripeChoice, setLastStripeChoice] = useState(() => {
    try { return JSON.parse(localStorage.getItem(stripeChoiceKey) || 'null'); } catch { return null; }
  });

  // Allt Stripe-bokförande går genom utils/stripeLedger.js, så konteringen
  // (1686 Stripe-saldo, 6570 avgift, 1930 vid utbetalning) finns på ett ställe.
  const handleBookStripe = async (item, choice = {}) => {
    const { file, ...picked } = choice;
    const verification = buildStripeVerification(item, { ...lastStripeChoice, ...picked });
    if (verification && file) {
      try { Object.assign(verification, await uploadAttachment(file)); } catch (error) {
        setStripeSync({ running: false, message: t('ui.rq_underlag_fel', { v0: error.message || error }) });
        return;
      }
    }
    if (verification?.rows?.length) onAddVerification?.(verification);
    // Valen sparas och föreslås nästa gång (momssats, intäkts-, avgifts- och bankkonto).
    const next = { ...lastStripeChoice };
    if (picked.account) { next.account = picked.account; next.vatRate = picked.vatRate; }
    if (picked.feeAccount) next.feeAccount = picked.feeAccount;
    if (picked.bankAccount) next.bankAccount = picked.bankAccount;
    setLastStripeChoice(next);
    try { localStorage.setItem(stripeChoiceKey, JSON.stringify(next)); } catch { /* bara en bekvämlighet */ }
    finishResolveStripe(item);
    markStripeReviewed(item);
  };

  const handleMarkStripeHandled = (item) => {
    finishResolveStripe(item);
    markStripeReviewed(item);
  };

  const safeStripeItems = visibleStripeItems.filter(isSafeStripeItem);
  const handleBookAllSafeStripe = async () => {
    if (safeStripeItems.length === 0) return;
    if (!(await confirmDialog(t('ui.stripe_rq_bokfor_alla_sakra_fraga', { n: safeStripeItems.length })))) return;
    safeStripeItems.forEach(item => handleBookStripe(item, {}));
  };

  // "Hämta från Stripe": samma hämtning som nattens cron, men nu och 90
  // dagar bakåt (api/stripe/connect.js, action 'sync').
  const [stripeSync, setStripeSync] = useState({ running: false, message: '' });
  const handleSyncStripe = async () => {
    if (isDemo || stripeSync.running || !company?.id) return;
    setStripeSync({ running: true, message: '' });
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: company.id, action: 'sync', days: 90 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || String(response.status));
      await loadStripeItems();
      setStripeSync({ running: false, message: t('ui.stripe_rq_hamtade', { n: payload.count || 0 }) });
    } catch (error) {
      setStripeSync({ running: false, message: t('ui.stripe_rq_hamta_fel', { v0: error.message || error }) });
    }
  };

  const headerActions = tab === 'pending' && bulkTargets.length > 0 ? [
    {
      key: 'bulk-approve',
      label: t(bulkIsSelection ? 'ui.godkann_markerade_n' : 'ui.godkann_alla_n', { n: bulkTargets.length }),
      icon: CheckCircle2, onClick: () => setShowBulkConfirm(true), variant: 'primary',
    },
  ] : tab === 'stripe' && company?.stripeAccountId ? [
    ...(isDemo ? [] : [{
      key: 'stripe-sync',
      label: stripeSync.running ? t('ui.stripe_rq_hamtar') : t('ui.stripe_rq_hamta_nu'),
      icon: RotateCcw, onClick: handleSyncStripe, disabled: stripeSync.running, variant: safeStripeItems.length > 0 ? 'secondary' : 'primary',
    }]),
    ...(safeStripeItems.length > 0 ? [{
      key: 'stripe-bulk',
      label: t('ui.stripe_rq_bokfor_alla_sakra', { n: safeStripeItems.length }),
      icon: CheckCircle2, onClick: handleBookAllSafeStripe, variant: 'primary',
    }] : []),
  ] : tab === 'zettle' && safeZettleItems.length > 0 ? [
    {
      key: 'zettle-bulk',
      label: t('ui.stripe_rq_bokfor_alla_sakra', { n: safeZettleItems.length }),
      icon: CheckCircle2, onClick: handleBookAllSafeZettle, variant: 'primary',
    },
  ] : [];

  const pendingSafe = visiblePending.filter(i => i.account && i.confident);
  const pendingCheck = visiblePending.filter(i => i.account && !i.confident);
  const pendingMissing = visiblePending.filter(i => !i.account);
  const stripeSafe = visibleStripeItems.filter(isSafeStripeItem);
  const stripeManual = visibleStripeItems.filter(i => categorizeStripeItem(i) === 'manual');
  const stripeChoice = visibleStripeItems.filter(i => !isSafeStripeItem(i) && categorizeStripeItem(i) !== 'manual');
  const zettleSafe = visibleZettleItems.filter(isSafeZettleItem);
  const zettleRefunds = visibleZettleItems.filter(i => ['refund', 'split'].includes(zettleCategory(i)));
  const zettleChoice = visibleZettleItems.filter(i => zettleCategory(i) === 'sale' && !isCertainZettleVat(i));

  const renderPending = item => (
    <ReviewCard
      key={item.id} item={item} accounts={accounts}
      onApprove={handleApprove} onReject={handleReject}
      exiting={exitingIds.has(item.id)}
      selected={selectedIds.has(item.id)}
      onToggleSelect={() => toggleSelected(item.id)}
    />
  );
  const renderStripe = item => (
    <StripeLedgerCard
      key={item.id} item={item} accounts={accounts}
      onBook={handleBookStripe}
      onMarkHandled={handleMarkStripeHandled}
      lastChoice={lastStripeChoice}
      exiting={exitingIds.has(item.id)}
      onOpenInvoice={handleGlobalAction && (id => handleGlobalAction({ type: 'open_invoice', payload: { id } }, 'invoices'))}
    />
  );
  const renderZettle = item => (
    <ZettleLedgerCard
      key={item.id} item={item} accounts={accounts}
      onBookSale={handleBookZettleSale}
      onBookFinance={handleBookZettleFinance}
      onMarkHandled={handleMarkZettleHandled}
      exiting={exitingIds.has(item.id)}
    />
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <style>{REVIEW_LIST_CSS}</style>
      {/* Header i samma mönster som Kunder/Anställda och lön/Projekt/Bokföring. */}
      <ListPageHeader
        title={t('ui.granskning')}
        // Antalet står i knappen, inte bara i bekräftelserutan: hur många
        // poster ett klick omfattar ska gå att se INNAN man klickar.
        actions={headerActions}
        tabs={{
          items: [
            { id: 'pending', label: t('ui.vantar'), badge: pendingItems.length },
            // Kundfeedback (uppföljning): en Stripe/Zettle-flik som bara
            // leder till "Ingen anslutning ännu" är brus för alla som inte
            // har kopplat den tjänsten — visas bara när företaget faktiskt
            // ÄR anslutet (eller i landningssidans demo, som simulerar en
            // anslutning via demoStripeItems/demoZettleItems).
            ...(company?.stripeAccountId || isDemo ? [{ id: 'stripe', label: t('ui.stripe'), badge: visibleStripeItems.length }] : []),
            ...(company?.zettleAccessToken || isZettleDemo ? [{ id: 'zettle', label: t('ui.zettle'), badge: visibleZettleItems.length }] : []),
            { id: 'history', label: t('ui.historik') },
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(50vh / var(--app-zoom, 1))', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>{t('ui.allt_ar_genomganget')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>{t('ui.det_finns_inga_poster_kvar_att_granska_just_nu')}</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              <SourcePanel
                logo={<Receipt size={22} />}
                title={t('ui.rq_src_vantar_titel')}
                text={t('ui.rq_src_vantar_text')}
                stats={[
                  { n: pendingSafe.length, tone: 'green', label: t('ui.rq_stat_klara', { n: pendingSafe.length }) },
                  { n: pendingCheck.length, tone: 'amber', label: t('ui.rq_stat_val', { n: pendingCheck.length }) },
                  { n: pendingMissing.length, tone: 'neutral', label: t('ui.rq_stat_saknar_konto', { n: pendingMissing.length }) },
                ]}
              />
              <GroupedRows groups={[
                { label: t('ui.rq_sec_klart'), items: pendingSafe, render: renderPending },
                { label: t('ui.rq_sec_kontrollera'), items: pendingCheck, render: renderPending },
                { label: t('ui.rq_sec_saknar_konto'), items: pendingMissing, render: renderPending },
              ]} />
            </div>
          </div>
        )
      )}

      {(tab === 'stripe' || tab === 'zettle') && stripeSync.message && (
        <div role="status" style={{ margin: '16px 24px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{stripeSync.message}</div>
      )}
      {tab === 'stripe' && (
        !company?.stripeAccountId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(50vh / var(--app-zoom, 1))', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CreditCard size={40} color="var(--text-muted)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>{t('ui.ingen_stripe_anslutning_annu')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '420px' }}>{t('ui.anslut_stripe_under_installningar_betalning_for')}</p>
          </div>
        ) : stripeLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{t('ui.laser_in')}</div>
        ) : visibleStripeItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(50vh / var(--app-zoom, 1))', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>{t('ui.allt_ar_genomganget')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>{t('ui.inga_stripe_transaktioner_vantar_pa_granskning_j')}</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              <SourcePanel
                wordmark={<StripeLogo height={26} />}
                title="Stripe"
                text={t('ui.rq_src_stripe_text')}
                stats={[
                  { n: stripeSafe.length, tone: 'green', label: t('ui.rq_stat_klara', { n: stripeSafe.length }) },
                  { n: stripeChoice.length, tone: 'amber', label: t('ui.rq_stat_val', { n: stripeChoice.length }) },
                  { n: stripeManual.length, tone: 'neutral', label: t(stripeManual.length === 1 ? 'ui.rq_stat_manuell' : 'ui.rq_stat_manuella', { n: stripeManual.length }) },
                ]}
              />
              <GroupedRows groups={[
                { label: t('ui.rq_sec_klart'), items: stripeSafe, render: renderStripe },
                { label: t('ui.rq_sec_val'), items: stripeChoice, render: renderStripe },
                { label: t('ui.rq_sec_manuellt'), items: stripeManual, render: renderStripe },
              ]} />
            </div>
          </div>
        )
      )}

      {tab === 'zettle' && (
        !company?.zettleAccessToken ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(50vh / var(--app-zoom, 1))', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CreditCard size={40} color="var(--text-muted)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>{t('ui.ingen_zettle_anslutning_annu')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: '420px' }}>{t('ui.anslut_zettle_under_installningar_betalning_for')}</p>
          </div>
        ) : zettleLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>{t('ui.laser_in')}</div>
        ) : visibleZettleItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(50vh / var(--app-zoom, 1))', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={48} color="var(--status-green-text)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px' }}>{t('ui.allt_ar_genomganget')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>{t('ui.ingen_zettle_forsaljning_vantar_pa_granskning_ju')}</p>
          </div>
        ) : (
          <div className="rq-list">
            <div className="rq-card">
              <SourcePanel
                wordmark={<ZettleLogo height={28} />}
                title="Zettle"
                text={t('ui.rq_src_zettle_text')}
                stats={[
                  { n: zettleSafe.length, tone: 'green', label: t('ui.rq_stat_klara', { n: zettleSafe.length }) },
                  { n: zettleChoice.length, tone: 'amber', label: t('ui.rq_stat_val', { n: zettleChoice.length }) },
                  { n: zettleRefunds.length, tone: 'neutral', label: t(zettleRefunds.length === 1 ? 'ui.rq_stat_manuell' : 'ui.rq_stat_manuella', { n: zettleRefunds.length }) },
                ]}
              />
              <GroupedRows groups={[
                { label: t('ui.rq_sec_klart'), items: zettleSafe, render: renderZettle },
                { label: t('ui.rq_sec_val'), items: zettleChoice, render: renderZettle },
                { label: t('ui.rq_sec_manuellt'), items: zettleRefunds, render: renderZettle },
              ]} />
            </div>
          </div>
        )
      )}

      {tab === 'history' && (
        <ListTable
          rowKey={h => h.id}
          emptyMessage={t('ui.inget_har_hanterats_an')}
          rows={reviewHistory}
          // Telefon: en rad per post, som resten av appens listor, i stället
          // för datortabellens fem kolumner som klipptes i högerkanten.
          mobileList={h => ({
            dot: h.method === 'manual' ? 'var(--text-muted)' : 'var(--status-green-text)',
            primary: h.title,
            amount: formatSEK(h.amount),
            meta: `${h.account} ${h.accountName} · ${h.resolvedBy} · ${formatDateTime(h.resolvedAt)}`,
            pill: <MethodPill method={h.method} />,
          })}
          columns={[
            { key: 'post', label: t('ui.post'), fontWeight: 600, color: 'var(--text-main)', render: h => `${h.title} · ${formatSEK(h.amount)}` },
            { key: 'account', label: t('ui.konto_2'), color: 'var(--text-main)', render: h => `${h.account} ${h.accountName}` },
            { key: 'resolvedBy', label: t('ui.hanterad_av'), color: 'var(--text-main)', render: h => h.resolvedBy },
            { key: 'resolvedAt', label: t('ui.nar'), render: h => formatDateTime(h.resolvedAt) },
            { key: 'method', label: t('ui.metod'), render: h => <MethodPill method={h.method} /> },
          ]}
        />
      )}

      {/* Bekräftelsedialog för "Godkänn alla" — aldrig en tyst massoperation */}
      {showBulkConfirm && (
        <div className="modal-overlay" onClick={() => setShowBulkConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{bulkIsSelection ? t('ui.godkann_markerade') : t('ui.godkann_alla')}</h2>
              <button className="modal-close" onClick={() => setShowBulkConfirm(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, margin: '0 0 8px' }}>{bulkSummary}</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                {bulkIsSelection
                  ? t('ui.bara_de_poster_du_markerat_ingar_poster_utan_kon')
                  : t('ui.poster_med_osakra_forslag_ingar_inte_de_kraver_i')}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowBulkConfirm(false)} style={{ padding: '9px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>{t('ui.avbryt')}</button>
                <button onClick={handleBulkApprove} style={{ padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'white' }}>{t('ui.fortsatt')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
