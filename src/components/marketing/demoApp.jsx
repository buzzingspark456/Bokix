import React from 'react';
import {
  LayoutDashboard, ClipboardCheck, Users, Package, NavQuotesIcon, NavInvoicesIcon, NavReceiptsIcon,
  Inbox, Landmark, BookOpen, BarChart3, Shield, Briefcase, UsersRound, Settings, Search, Lock, Check,
  ChevronDown, HelpCircle, PlayCircle, X,
} from '../icons';
import BokixWordmark from '../shared/BokixWordmark';

// ── Miniatyren av appen som demoscenerna (DemoPlayer) spelar upp i.
// Byggd efter den riktiga appen (App.jsx, index.css): samma gröna sidomeny
// med grupperna Verksamhet/Ekonomi/Rapporter/Administration, samma vita
// innehållsyta, tabeller med versala kolumnrubriker och samma statusfärger
// (--status-*-tokens). Det är en ritad kopia, inte appen själv: den ska
// kunna animeras fritt och hållas lätt. Ändras appens utseende mycket
// ska det här följa med, annars slutar demon se ut som produkten.

export function AppStyles() {
  return (
    <style>{`
      .ax { --ax-page: #f4f7f5; --ax-card: #ffffff; --ax-border: #e5e7eb; --ax-soft: #f3f4f6; --ax-head: #f3f4f2; --ax-text: #111827; --ax-sub: #4b5563; --ax-muted: #9ca3af; --ax-accent: #0b6329;
        --ax-g-bg: #eaf3de; --ax-g-tx: #27500a; --ax-a-bg: #faeeda; --ax-a-tx: #633806; --ax-r-bg: #fcebeb; --ax-r-tx: #791f1f; --ax-gray-bg: #eceef0; --ax-gray-tx: #4b5563;
        --ax-row-paid: #bbf7d0; --ax-row-unpaid: #fcefbd; --ax-row-late: #fbd3d3; --ax-unpaid-bg: #f6cb45; --ax-late-bg: #cc4b4b;
        position: absolute; inset: 0; display: flex; background: var(--ax-page); color: var(--ax-text); font-size: 12.5px; text-align: left; overflow: hidden; }
      html[data-theme="dark"] #lp-root .ax { --ax-page: #0f1a13; --ax-card: #17281c; --ax-border: #2a3d2c; --ax-soft: #1d3323; --ax-head: #1a2e20; --ax-text: #eef3ea; --ax-sub: #a9baa9; --ax-muted: #85987f;
        --ax-g-bg: #1f3a22; --ax-g-tx: #9fd98a; --ax-a-bg: #3a2c14; --ax-a-tx: #f0c98a; --ax-r-bg: #3d1d1d; --ax-r-tx: #f2a7a7; --ax-gray-bg: #243329; --ax-gray-tx: #b7c4b5;
        --ax-row-paid: rgba(34,197,94,0.32); --ax-row-unpaid: rgba(245,158,11,0.32); --ax-row-late: rgba(239,68,68,0.30); --ax-unpaid-bg: #facc15; --ax-late-bg: #e04848; }

      /* Sidomenyn */
      .ax-side { width: 168px; flex-shrink: 0; background: #0b6329; color: #fff; display: flex; flex-direction: column; padding: 12px 0 10px; }
      html[data-theme="dark"] #lp-root .ax-side { background: #0c1f14; }
      .ax-side-logo { padding: 0 14px 10px; border-bottom: 1px solid rgba(255,255,255,0.15); margin: 0 10px 6px; }
      .ax-grp { display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); padding: 7px 14px 3px 18px; border-top: 1px solid rgba(255,255,255,0.12); margin: 3px 10px 0 0; }
      .ax-grp svg { width: 9px; height: 9px; }
      .ax-side-foot { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 4px; }
      .ax-side-foot .ax-nav { font-weight: 500; }
      .ax-side-foot .ax-out { color: #fca5a5; }
      .ax-nav { display: flex; align-items: center; gap: 8px; padding: 4.5px 18px; font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.92); position: relative; white-space: nowrap; }
      .ax-nav svg { width: 13px; height: 13px; flex-shrink: 0; opacity: 0.9; }
      .ax-nav.on { background: rgba(255,255,255,0.13); color: #fff; font-weight: 700; }
      .ax-nav.on::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #facc15; }
      .ax-nav.on svg { color: #facc15; }
      .ax-badge { margin-left: auto; min-width: 15px; height: 15px; border-radius: 999px; background: #22c55e; color: #fff; font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; }

      /* Innehållet */
      .ax-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--ax-card); margin: 8px 8px 8px 0; border-radius: 12px; overflow: hidden; position: relative; }
      .ax-full { margin: 0; border-radius: 0; }
      .ax-top { padding: 14px 18px 0; border-bottom: 1px solid var(--ax-border); }
      .ax-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .ax-title-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .ax-how { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; color: var(--ax-sub); background: var(--ax-soft); border-radius: 999px; padding: 2px 7px; letter-spacing: 0; }
      .ax-how svg { width: 9px; height: 9px; }
      .ax-title-r { display: flex; align-items: center; gap: 7px; }
      .ax-next { font-size: 10.5px; font-weight: 500; color: var(--ax-muted); white-space: nowrap; }
      .ax-next b { color: var(--ax-text); }
      .ax-seg { display: inline-flex; background: var(--ax-soft); border-radius: 999px; padding: 2px; font-size: 10.5px; font-weight: 700; }
      .ax-seg span { padding: 3px 9px; border-radius: 999px; color: var(--ax-sub); }
      .ax-seg span.on { background: var(--ax-card); color: var(--ax-text); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }

      /* Inställningar: vänstermeny med grupper och platta avsnitt, som appen */
      .ax-set { flex: 1; min-height: 0; display: flex; }
      .ax-set-nav { width: 138px; flex-shrink: 0; border-right: 1px solid var(--ax-border); padding: 9px 8px; font-size: 10.5px; }
      .ax-set-nav .ax-search { max-width: none; padding: 4px 7px; font-size: 10px; margin-bottom: 4px; }
      .ax-set-grp { font-size: 8px; font-weight: 700; letter-spacing: 0.08em; color: var(--ax-muted); padding: 7px 7px 2px; }
      .ax-set-item { padding: 3.5px 7px; border-radius: 6px; color: var(--ax-sub); white-space: nowrap; }
      .ax-set-item.on { background: var(--ax-soft); color: var(--ax-text); font-weight: 700; }
      .ax-set-main { flex: 1; min-width: 0; padding: 14px 22px; overflow: hidden; }
      .ax-set-h1 { font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; margin-bottom: 8px; letter-spacing: -0.01em; }
      .ax-set-cap { font-size: 8.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ax-sub); padding: 9px 0 6px; border-bottom: 1px solid var(--ax-border); }
      .ax-set-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--ax-border); font-size: 11.5px; }
      .ax-set-row small { display: block; font-size: 10px; color: var(--ax-muted); font-weight: 400; margin-top: 1px; }

      /* Granskningskort och stegchips i dialoger */
      .ax-rq { display: flex; gap: 10px; padding: 11px 18px; border-bottom: 1px solid var(--ax-border); background: var(--ax-card); }
      .ax-rq-box { width: 12px; height: 12px; border: 1.5px solid var(--ax-border); border-radius: 3px; margin-top: 3px; flex-shrink: 0; }
      .ax-rq-ic { width: 22px; height: 22px; border-radius: 6px; background: var(--ax-soft); color: var(--ax-sub); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .ax-rq-ic svg { width: 12px; height: 12px; }
      .ax-rq-meta { font-size: 8.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ax-muted); }
      .ax-rq-title { font-size: 12.5px; font-weight: 700; margin: 2px 0 8px; }
      .ax-steps { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 5px; margin-bottom: 10px; }
      .ax-steps span { text-align: center; font-size: 9.5px; font-weight: 700; padding: 4px 6px; border-radius: 999px; background: var(--ax-soft); color: var(--ax-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ax-steps span.on { background: var(--ax-g-bg); color: var(--ax-g-tx); }
      .ax-subtitle { font-size: 11px; color: var(--ax-muted); margin-top: 2px; }
      .ax-tabs { display: flex; gap: 18px; margin-top: 10px; font-size: 11.5px; color: var(--ax-sub); }
      .ax-tab { padding-bottom: 8px; border-bottom: 2px solid transparent; white-space: nowrap; }
      .ax-tab.on { color: var(--ax-text); font-weight: 700; border-color: var(--ax-accent); }
      html[data-theme="dark"] #lp-root .ax-tab.on { border-color: #7fcf6a; }
      .ax-body { flex: 1; min-height: 0; overflow: hidden; padding: 12px 18px; background: var(--ax-page); }
      .ax-body.white { background: var(--ax-card); }
      .ax-bar { display: flex; gap: 8px; align-items: center; padding: 10px 18px; border-bottom: 1px solid var(--ax-border); }
      .ax-search { flex: 1; max-width: 220px; display: flex; align-items: center; gap: 6px; border: 1px solid var(--ax-border); border-radius: 7px; padding: 5px 9px; color: var(--ax-muted); font-size: 11px; background: var(--ax-card); }
      .ax-search svg { width: 11px; height: 11px; }

      .ax-btn { display: inline-flex; align-items: center; gap: 5px; background: #0b6329; color: #fff; font-weight: 700; font-size: 11px; border-radius: 7px; padding: 6px 11px; white-space: nowrap; position: relative; }
      .ax-btn-ghost { display: inline-flex; align-items: center; gap: 5px; background: var(--ax-card); color: var(--ax-text); border: 1px solid var(--ax-border); font-weight: 700; font-size: 11px; border-radius: 7px; padding: 5px 10px; white-space: nowrap; position: relative; }
      .ax-field { border: 1px solid var(--ax-border); border-radius: 7px; padding: 6px 9px; font-size: 11.5px; background: var(--ax-card); min-height: 27px; display: flex; align-items: center; position: relative; }
      .ax-label { font-size: 10.5px; font-weight: 700; margin-bottom: 4px; color: var(--ax-text); }
      .ax-chip { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ax-border); border-radius: 7px; padding: 5px 8px; font-size: 11px; font-weight: 600; background: var(--ax-card); }
      .ax-chip.on { border-color: #0b6329; background: var(--ax-g-bg); color: var(--ax-g-tx); }

      /* Tabeller */
      .ax-table { width: 100%; }
      .ax-tr { display: grid; align-items: center; gap: 10px; padding: 0 18px; min-height: 34px; border-bottom: 1px solid var(--ax-border); font-size: 11.5px; }
      .ax-th { background: var(--ax-head); font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ax-sub); min-height: 28px; }
      .ax-month { display: flex; justify-content: space-between; padding: 8px 18px 5px; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
      .ax-month span:last-child { font-weight: 500; color: var(--ax-muted); letter-spacing: 0; text-transform: none; }
      .ax-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .ax-b { font-weight: 700; }
      .ax-m { color: var(--ax-muted); }
      .ax-s { color: var(--ax-sub); }

      /* Statusetiketter, samma färger som appen */
      .ax-pill { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px; white-space: nowrap; justify-self: start; }
      .ax-pill svg { width: 9px; height: 9px; }
      .ax-ok { background: var(--ax-g-bg); color: var(--ax-g-tx); }
      .ax-warn { background: var(--ax-a-bg); color: var(--ax-a-tx); }
      .ax-bad { background: var(--ax-r-bg); color: var(--ax-r-tx); }
      .ax-gray { background: var(--ax-gray-bg); color: var(--ax-gray-tx); }
      .ax-paid { background: #0b6329; color: #fff; border-radius: 999px; }
      .ax-late { background: var(--ax-late-bg); color: #fff; border-radius: 999px; }
      .ax-unpaid { background: var(--ax-unpaid-bg); color: #422006; border-radius: 999px; }
      .ax-draft { background: var(--ax-card); color: var(--ax-sub); border: 1px solid var(--ax-border); border-radius: 999px; }

      .ax-card { background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: 10px; }

      /* Modal ovanpå sidan */
      .ax-scrim { position: absolute; inset: 0; background: rgba(15, 23, 20, 0.38); display: flex; align-items: center; justify-content: center; z-index: 5; }
      .ax-modal { background: var(--ax-card); border-radius: 12px; box-shadow: 0 24px 60px -20px rgba(0,0,0,0.45); width: min(92%, 440px); overflow: hidden; }
      .ax-modal-head { padding: 12px 16px; border-bottom: 1px solid var(--ax-border); font-weight: 700; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
      .ax-modal-body { padding: 14px 16px; }
      .ax-modal-foot { padding: 10px 16px; border-top: 1px solid var(--ax-border); display: flex; justify-content: flex-end; gap: 8px; }

      /* Notis nere till höger och nedladdningsrad */
      .ax-toast { position: absolute; right: 14px; bottom: 14px; z-index: 8; display: flex; align-items: center; gap: 8px; background: #111827; color: #fff; font-size: 11.5px; font-weight: 600; padding: 9px 13px; border-radius: 9px; box-shadow: 0 12px 30px -10px rgba(0,0,0,0.5); }
      .ax-toast svg { width: 13px; height: 13px; color: #4ade80; }
      .ax-dl { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--ax-card); border-top: 1px solid var(--ax-border); font-size: 11.5px; box-shadow: 0 -8px 20px -12px rgba(0,0,0,0.25); }
      .ax-dl-file { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--ax-border); border-radius: 7px; padding: 5px 9px; font-weight: 600; }
      .ax-doc { width: 11px; height: 14px; border: 1.5px solid var(--ax-sub); border-radius: 2px 5px 2px 2px; position: relative; flex-shrink: 0; background: linear-gradient(var(--ax-sub), var(--ax-sub)) 2px 4px / 5px 1.2px no-repeat, linear-gradient(var(--ax-sub), var(--ax-sub)) 2px 7px / 5px 1.2px no-repeat, linear-gradient(var(--ax-sub), var(--ax-sub)) 2px 10px / 3px 1.2px no-repeat; }

      /* Webbläsarens adressrad och flikar (för scener utanför Bokix) */
      .ax-browser { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--ax-page); }
      .ax-url { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--ax-card); border-bottom: 1px solid var(--ax-border); }
      .ax-url-box { flex: 1; display: flex; align-items: center; gap: 6px; background: var(--ax-soft); border-radius: 999px; padding: 5px 12px; font-size: 11.5px; color: var(--ax-sub); }
      .ax-url-box svg { width: 11px; height: 11px; color: #16a34a; }

      /* Klick: en pekare glider in mot elementet och en ring pulserar. */
      .ax-click { position: relative; }
      .ax-click::after { content: ''; position: absolute; left: 60%; top: 55%; width: 18px; height: 18px; z-index: 9; pointer-events: none;
        background: no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 3l14 8-6 1.5L10 19z' fill='%23111827' stroke='white' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E");
        animation: axPointer 1.1s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--c, 0s) - 0.7s) both; }
      .ax-click::before { content: ''; position: absolute; inset: -4px; border-radius: 10px; border: 2px solid #22c55e; opacity: 0; pointer-events: none; animation: axRing 0.7s ease var(--c, 0s) both; }
      @keyframes axPointer { 0% { opacity: 0; transform: translate(60px, 40px); } 55% { opacity: 1; transform: none; } 70% { transform: scale(0.85); } 85% { transform: none; opacity: 1; } 100% { opacity: 0; } }
      @keyframes axRing { 0% { opacity: 0.9; transform: scale(0.9); } 100% { opacity: 0; transform: scale(1.15); } }

      /* Kvittot (fotot) */
      .ax-receipt { background: #fbfaf5; color: #1c1c1c; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; line-height: 1.65; padding: 14px 16px 18px; width: 170px; transform: rotate(-2.5deg); box-shadow: 0 18px 40px -12px rgba(0,0,0,0.7); position: relative; overflow: hidden;
        -webkit-mask: linear-gradient(#000, #000) top/100% calc(100% - 6px) no-repeat, radial-gradient(circle 4px at 50% 100%, transparent 3.5px, #000 4px) bottom/9px 7px repeat-x;
        mask: linear-gradient(#000, #000) top/100% calc(100% - 6px) no-repeat, radial-gradient(circle 4px at 50% 100%, transparent 3.5px, #000 4px) bottom/9px 7px repeat-x; }
      .ax-receipt-hl { border-radius: 3px; animation: axHl 1s ease var(--d, 0s) both; }
      @keyframes axHl { 0% { background: transparent; } 40% { background: rgba(34,197,94,0.35); } 100% { background: rgba(34,197,94,0.14); } }

      @media (max-width: 640px) {
        .ax-side { display: none; }
        .ax-main { margin: 0; border-radius: 0; }
        .ax-hide-sm { display: none !important; }
        .ax-set-nav { display: none; }
        .ax-set-main { padding: 12px 16px; }
        .ax-click::after { display: none; }
        .ax-tr.m-ver { grid-template-columns: 12px 80px 1fr 72px !important; }
        .ax-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .ax-tr.m-inv { grid-template-columns: 70px minmax(0, 1fr) 74px 84px !important; }
        .ax-tr.m-bank { grid-template-columns: 12px 1fr 84px 80px !important; }
        .ax-tr.m-sie { grid-template-columns: 52px 1fr 72px !important; }
        .ax-tr.m-pay { grid-template-columns: 1fr 58px 58px 58px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ax-click::after, .ax-click::before { display: none; }
        .ax-receipt-hl { animation: none; background: rgba(34,197,94,0.14); }
      }
    `}</style>
  );
}

// Samma grupper och namn som appens sidomeny sedan november 2026 (Pengar in,
// Pengar ut, Koll på ekonomin). Inställningar står längst ned, som i appen.
const NAV = [
  { items: [['dashboard', 'Start', LayoutDashboard], ['review', 'Att granska', ClipboardCheck]] },
  { title: 'Pengar in', items: [['contacts', 'Kunder', Users], ['quotes', 'Offerter', NavQuotesIcon], ['invoices', 'Kundfakturor', NavInvoicesIcon], ['articles', 'Artiklar och lager', Package], ['projects', 'Projekt och tid', Briefcase]] },
  { title: 'Pengar ut', items: [['expenses', 'Kvitton', NavReceiptsIcon], ['supplier', 'Leverantörsfakturor', Inbox], ['payroll', 'Anställda och lön', UsersRound]] },
  { title: 'Koll på ekonomin', items: [['bank', 'Bank', Landmark], ['verifications', 'Bokföring', BookOpen], ['reports', 'Rapporter', BarChart3], ['taxes', 'Skatt och bokslut', Shield]] },
];

/** Appens skal: sidomenyn med `active` markerad, och innehållet bredvid. */
export function Shell({ active, review = 0, children }) {
  return (
    <div className="ax">
      <aside className="ax-side" aria-hidden>
        <div className="ax-side-logo"><BokixWordmark height={24} /></div>
        {NAV.map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="ax-grp">{g.title}<ChevronDown /></div>}
            {g.items.map(([id, label, Icon]) => {
              if (id === 'review' && !review && active !== 'review') return null;
              return (
                <div key={id} className={`ax-nav${active === id ? ' on' : ''}`}>
                  <Icon /> {label}
                  {id === 'review' && review > 0 && <span className="ax-badge">{review}</span>}
                </div>
              );
            })}
          </div>
        ))}
        <div className="ax-side-foot">
          <div className={`ax-nav${active === 'settings' ? ' on' : ''}`}><Settings /> Inställningar</div>
          <div className="ax-nav"><HelpCircle /> Hjälp och support</div>
        </div>
      </aside>
      <div className="ax-main">{children}</div>
    </div>
  );
}

/** Sidhuvud: titel (med "Se hur" om sidan har en guide), knapp till höger,
 *  valfri undertitel och flikar. */
export function Top({ title, sub, action, tabs, on, how = false }) {
  return (
    <div className="ax-top" style={tabs ? undefined : { paddingBottom: 12 }}>
      <div className="ax-title">
        <span className="ax-title-l">{title}{how && <span className="ax-how ax-hide-sm"><PlayCircle /> Se hur</span>}</span>
        {action && <span className="ax-title-r">{action}</span>}
      </div>
      {sub && <div className="ax-subtitle">{sub}</div>}
      {tabs && (
        <div className="ax-tabs">
          {tabs.map(t => <span key={t} className={`ax-tab${t === on ? ' on' : ''}`}>{t}</span>)}
        </div>
      )}
    </div>
  );
}

export const SearchBox = ({ text }) => <div className="ax-search"><Search /> {text}</div>;

/** En sida utanför Bokix (internetbanken, Skatteverket, gamla programmet). */
export function Browser({ url, secure = true, children }) {
  return (
    <div className="ax" style={{ flexDirection: 'column' }}>
      <div className="ax-url">
        <div className="ax-url-box">{secure && <Lock />}{url}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

export const Doc = () => <span className="ax-doc" />;

export function Toast({ children, delay, top = false }) {
  return <div className="ax-toast dp-in" style={{ '--d': `${delay}s`, ...(top ? { top: 12, bottom: 'auto' } : {}) }}><Check strokeWidth={3} />{children}</div>;
}

export function DownloadBar({ file, delay }) {
  return (
    <div className="ax-dl dp-in" style={{ '--d': `${delay}s` }}>
      <span className="ax-m">Hämtade filer</span>
      <span className="ax-dl-file"><Doc />{file}</span>
    </div>
  );
}

// Inställningar har en egen vänstermeny med grupper (Settings.jsx), inte flikar.
const SETTINGS_NAV = [
  ['FÖRETAGET', ['Företag och profil', 'Användare', 'Prenumeration', 'Funktioner']],
  ['EKONOMI', ['Fakturor', 'Bokföring', 'Kopplingar', 'Import och export']],
  ['MITT KONTO', ['Utseende', 'Notiser', 'Säkerhet']],
];

/** Inställningar med `section` vald i vänstermenyn och avsnittets rubrik. */
export function SettingsShell({ section, review = 1, children }) {
  return (
    <Shell active="settings" review={review}>
      <Top title="Inställningar" />
      <div className="ax-set">
        <div className="ax-set-nav" aria-hidden>
          <div className="ax-search"><Search /> Sök inställning</div>
          {SETTINGS_NAV.map(([grp, items]) => (
            <div key={grp}>
              <div className="ax-set-grp">{grp}</div>
              {items.map(it => <div key={it} className={`ax-set-item${it === section ? ' on' : ''}`}>{it}</div>)}
            </div>
          ))}
        </div>
        <div className="ax-set-main">
          <div className="ax-set-h1">{section}</div>
          {children}
        </div>
      </div>
    </Shell>
  );
}

export const SetCap = ({ children }) => <div className="ax-set-cap">{children}</div>;

export function SetRow({ title, desc, children, className = '', style }) {
  return (
    <div className={`ax-set-row ${className}`} style={style}>
      <span className="ax-b">{title}{desc && <small>{desc}</small>}</span>
      {children}
    </div>
  );
}

/** Stegchipsen överst i appens importdialoger ("1. Fil", "2. Kolumner" …). */
export function ModalSteps({ steps, on }) {
  return <div className="ax-steps">{steps.map((s, i) => <span key={s} className={i === on ? 'on' : ''}>{i + 1}. {s}</span>)}</div>;
}

/** En rad i Granskning (ReviewQueue.jsx): kryssruta, ikon, metarad i
 *  versaler, åtgärdsmening, knappar under och etikett till höger. */
export function ReviewItem({ icon: Icon, meta, title, badge, extra, actions, children, className = '', style }) {
  return (
    <div className={`ax-rq ${className}`} style={style}>
      <span className="ax-rq-box ax-hide-sm" />
      <span className="ax-rq-ic ax-hide-sm">{Icon && <Icon />}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div className="ax-rq-meta">{meta}</div>
          {badge}
        </div>
        <div className="ax-rq-title">{title}</div>
        {extra}
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{actions}</div>}
        {children}
      </div>
    </div>
  );
}

export const ModalClose = () => <X size={13} className="ax-m" />;
