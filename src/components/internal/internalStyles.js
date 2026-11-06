// All stil för /internal på ett ställe. Läggs in en gång av InternalApp.
// Appens färgvariabler (--bg-card, --border, --text-main, --status-*) gör
// att ljust och mörkt tema följer med utan egna värden. Sidomenyn har samma
// gröna som appens (#0b6329 med 22 % svart över, se sidomeny-färgen i appen).
//
// Klassprefix:
//   ix-   ramen (sidomeny, telefonens rad, sidhuvud, sektioner, siffror, kort)
//   ixl-  radlistan (AdminList.jsx)
//   cc-   kundkortet (CustomerCard.jsx)

export const INTERNAL_CSS = `
/* ── Ramen ─────────────────────────────────────────────────────────── */
.ix { min-height: calc(100vh / var(--app-zoom, 1)); display: flex; background: var(--bg-page); color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 14px; }
.ix *, .ix *::before, .ix *::after { box-sizing: border-box; }
.ix button { font-family: inherit; }
.ix :focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }

.ix-side { width: 232px; flex-shrink: 0; position: sticky; top: 0; height: calc(100vh / var(--app-zoom, 1)); display: flex; flex-direction: column; padding: 22px 12px 16px;
  background: linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22)), #0b6329; color: #fff; }
.ix-brand { display: flex; align-items: center; gap: 9px; padding: 0 10px 18px; }
.ix-brand-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.62); }
.ix-nav { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.ix-nav-group { display: flex; flex-direction: column; gap: 1px; }
.ix-nav-label { padding: 0 12px 5px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
.ix-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 7px 10px 7px 12px; border: none; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.84); font-size: 13.5px; font-weight: 600; text-align: left; cursor: pointer; }
.ix-nav-item:hover { background: rgba(255,255,255,0.09); color: #fff; }
.ix-nav-item.on { background: rgba(255,255,255,0.18); color: #fff; }
.ix-nav-item svg { flex-shrink: 0; opacity: 0.9; }
.ix-nav-item:focus-visible { outline-color: #fff; }
.ix-nav-text { flex: 1; min-width: 0; }
.ix-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; background: rgba(255,255,255,0.18); color: #fff; }
.ix-count.alert { background: #fff; color: #8a2b14; }
.ix-foot { margin-top: 14px; padding: 14px 10px 0; border-top: 1px solid rgba(255,255,255,0.14); }
.ix-email { font-size: 12px; color: rgba(255,255,255,0.7); overflow-wrap: anywhere; margin-bottom: 8px; }
.ix-out { display: inline-flex; align-items: center; gap: 7px; padding: 6px 0; border: none; background: none; color: rgba(255,255,255,0.86); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.ix-out:hover { color: #fff; }
.ix-out:focus-visible { outline-color: #fff; }

.ix-top, .ix-tabs { display: none; }
.ix-main { flex: 1; min-width: 0; }

/* ── Sidan ─────────────────────────────────────────────────────────── */
.ix-page { max-width: 1120px; padding: 30px 36px 56px; }
.ix-page.narrow { max-width: 920px; }
.ix-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.ix-title { margin: 0; font-size: 24px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.2; }
.ix-desc { margin: 6px 0 0; max-width: 620px; font-size: 13.5px; line-height: 1.55; color: var(--text-muted); }
.ix-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ix-refresh { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

.ix-section { margin-top: 28px; }
.ix-section:first-of-type { margin-top: 0; }
.ix-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.ix-section-title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.ix-section-note { font-size: 12.5px; color: var(--text-muted); }
.ix-section-side { display: inline-flex; align-items: center; gap: 14px; margin-left: auto; }

.ix-stack { display: flex; flex-direction: column; gap: 14px; }
.ix-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }

/* ── Siffror ───────────────────────────────────────────────────────── */
.ix-stats { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: 12px; }
.ix-stat { position: relative; min-width: 0; padding: 15px 16px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card); color: inherit; text-align: left; font: inherit; }
button.ix-stat { cursor: pointer; }
button.ix-stat:hover { border-color: var(--gray-300); }
.ix-stat-label { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--text-secondary); }
.ix-stat-value { margin-top: 8px; font-size: 26px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--text-main); }
.ix-stat-sub { margin-top: 5px; font-size: 12.5px; line-height: 1.45; color: var(--text-muted); }
.ix-stat-go { position: absolute; top: 14px; right: 14px; color: var(--text-muted); opacity: 0; transition: opacity 120ms ease; }
button.ix-stat:hover .ix-stat-go, button.ix-stat:focus-visible .ix-stat-go { opacity: 1; }

.ix-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--text-muted); }
.ix-dot.green { background: var(--status-green-text); }
.ix-dot.amber { background: var(--status-amber-text); }
.ix-dot.red { background: var(--status-red-text); }
.ix-dot.blue { background: var(--status-blue-text); }

/* ── Kort ──────────────────────────────────────────────────────────── */
.ix-card { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card); }
.ix-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border-light); }
.ix-card-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; }
.ix-card-title svg { color: var(--text-muted); }
.ix-card-body { padding: 14px 18px 16px; }
.ix-card-body.flush { padding: 0; }
.ix-muted { font-size: 13px; color: var(--text-muted); line-height: 1.55; }
.ix-ok { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--accent-text); }

/* Rader inne i ett kort: etikett till vänster, värde till höger. */
.ix-kv { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 8px 0; font-size: 13.5px; }
.ix-kv + .ix-kv { border-top: 1px solid var(--border-light); }
.ix-kv-label { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--text-secondary); }
.ix-kv-value { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.ix-kv-value.muted { font-weight: 500; color: var(--text-muted); }

/* Händelser: rubrik + tid på en rad, detaljer under. */
.ix-event { padding: 11px 18px; font-size: 13px; line-height: 1.5; }
.ix-event + .ix-event { border-top: 1px solid var(--border-light); }
.ix-event-head { display: flex; justify-content: space-between; gap: 12px; }
.ix-event-title { font-weight: 650; color: var(--text-main); }
.ix-event-time { flex-shrink: 0; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.ix-event-detail { margin-top: 2px; color: var(--text-secondary); white-space: pre-line; overflow-wrap: anywhere; }
a.ix-event { display: block; color: inherit; text-decoration: none; }
a.ix-event:hover { background: var(--bg-muted); }

/* ── Att göra (Översikten) ─────────────────────────────────────────── */
.ix-todo { display: flex; align-items: center; gap: 12px; padding: 12px 18px; font-size: 13.5px; }
.ix-todo + .ix-todo { border-top: 1px solid var(--border-light); }
.ix-todo-text { flex: 1; min-width: 0; line-height: 1.45; }
.ix-todo-text strong { font-weight: 700; }
.ix-todo-sub { display: block; font-size: 12.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Notiser ───────────────────────────────────────────────────────── */
.ix-notice { display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-radius: 12px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); background: var(--bg-muted); margin-bottom: 18px; }
.ix-notice svg { flex-shrink: 0; margin-top: 2px; }
.ix-notice.amber { background: var(--status-amber-bg); }
.ix-notice.amber svg { color: var(--status-amber-text); }
.ix-notice.red { background: var(--status-red-bg); }
.ix-notice.red svg { color: var(--status-red-text); }
.ix-notice.blue { background: var(--status-blue-bg); }
.ix-notice.blue svg { color: var(--status-blue-text); }
.ix-loading { font-size: 13.5px; color: var(--text-muted); padding: 8px 0; }

/* ── Knappar, filter, fält ─────────────────────────────────────────── */
.ix-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 12.5px; font-weight: 650; white-space: nowrap; cursor: pointer; text-decoration: none; }
.ix-btn:hover { border-color: var(--gray-300); }
.ix-btn:disabled { opacity: 0.55; cursor: default; }
.ix-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ix-btn.danger { color: var(--status-red-text); }
.ix-btn.quiet { border-color: transparent; background: transparent; color: var(--text-secondary); padding: 0 8px; }
.ix-btn.quiet:hover { background: var(--bg-muted); }
.ix-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 650; color: var(--accent-text); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; }

.ix-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 10px; background: var(--bg-muted); }
.ix-seg button { height: 30px; padding: 0 12px; border: none; border-radius: 8px; background: transparent; color: var(--text-secondary); font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.ix-seg button:hover { color: var(--text-main); }
.ix-seg button.on { background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.ix-seg-n { margin-left: 5px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

.ix-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.ix-search { position: relative; width: min(320px, 100%); }
.ix-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.ix-input { width: 100%; height: 36px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font: inherit; font-size: 13.5px; }
.ix-search .ix-input { padding-left: 34px; }
textarea.ix-input { height: auto; min-height: 84px; padding: 9px 12px; resize: vertical; line-height: 1.5; }
.ix-field { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.ix-field > span { font-size: 12.5px; font-weight: 650; color: var(--text-secondary); }
.ix-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 14px; }
.ix-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.ix-chips .ix-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.ix-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

/* Mätare (lagring) */
.ix-meter + .ix-meter { margin-top: 14px; }
.ix-meter-head { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 6px; }
.ix-meter-head span:last-child { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.ix-meter-bar { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; }
.ix-meter-bar > div { height: 100%; border-radius: 999px; background: var(--accent-text); }
.ix-meter-bar > div.amber { background: var(--status-amber-text); }
.ix-meter-bar > div.red { background: var(--status-red-text); }

.ix-chart { height: 240px; }

/* ── Radlistan (AdminList) ─────────────────────────────────────────── */
.ixl { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card); overflow: hidden; }
.ixl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--border-light); }
.ixl-title { font-size: 14px; font-weight: 700; }
.ixl-count { font-size: 12.5px; font-weight: 600; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.ixl-row { display: grid; grid-template-columns: 34px minmax(0, 1.7fr) minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 11px 18px; }
.ixl-row.plain { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) auto; }
.ixl-row + .ixl-row { border-top: 1px solid var(--border-light); }
.ixl-row.clickable { cursor: pointer; }
.ixl-row.clickable:hover { background: var(--bg-muted); }
.ixl-row.muted .ixl-main, .ixl-row.muted .ixl-avatar { opacity: 0.55; }
.ixl-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13.5px; font-weight: 700; text-transform: uppercase; background: var(--bg-muted); color: var(--text-secondary); }
.ixl-main { min-width: 0; }
.ixl-primary-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ixl-primary { min-width: 0; font-size: 13.5px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ixl-secondary { margin-top: 2px; font-size: 12.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ixl-pills { display: inline-flex; flex-wrap: wrap; gap: 5px; flex-shrink: 0; }
.ixl-pill { padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 650; white-space: nowrap; }
.ixl-meta { min-width: 0; font-size: 12.5px; line-height: 1.6; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.ixl-meta { text-align: right; }
.ixl-meta > span { white-space: nowrap; }
.ixl-meta > span + span::before { content: " · "; color: var(--text-muted); }
.ixl-meta-label { color: var(--text-muted); }
.ixl-action { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
.ix-group-note { margin: -4px 0 10px; font-size: 12.5px; color: var(--text-muted); }
.cc-danger { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 0 4px; border-top: 1px solid var(--border-light); margin-top: 4px; }
.ixl-empty { padding: 26px 18px; text-align: center; font-size: 13.5px; color: var(--text-muted); }

/* ── Kundkortet ────────────────────────────────────────────────────── */
.cc-back { position: fixed; inset: 0; z-index: 300; background: rgba(15, 23, 42, 0.32); }
.cc { position: fixed; top: 0; right: 0; bottom: 0; z-index: 301; width: min(560px, 100vw); display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-main); font-family: 'Inter', sans-serif; box-shadow: -12px 0 40px rgba(0,0,0,0.18); animation: ccIn 0.18s ease; }
@keyframes ccIn { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.cc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border); }
.cc-title { font-size: 17px; font-weight: 750; overflow-wrap: anywhere; }
.cc-sub { margin-top: 3px; font-size: 13px; color: var(--text-muted); }
.cc-close { width: 34px; height: 34px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); cursor: pointer; }
.cc-body { flex: 1; overflow-y: auto; padding: 16px 20px 32px; display: flex; flex-direction: column; gap: 12px; }
.cc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 6px; }
.cc-num { padding: 10px 12px; border-radius: 10px; background: var(--bg-muted); }
.cc-num b { display: block; font-size: 19px; font-weight: 750; font-variant-numeric: tabular-nums; }
.cc-num span { font-size: 12px; color: var(--text-muted); }
.cc-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.cc-warn { color: var(--status-amber-text) !important; }

@media (prefers-reduced-motion: reduce) { .cc { animation: none; } .ix-stat-go { transition: none; } }

/* ── Mellanstor skärm ──────────────────────────────────────────────── */
@media (max-width: 1080px) {
  .ix-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ix-fields { grid-template-columns: 1fr 1fr; }
}

/* ── Telefon ───────────────────────────────────────────────────────── */
@media (max-width: 760px) {
  .ix { flex-direction: column; }
  .ix-side { display: none; }
  .ix-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px; background: var(--bg-card); }
  .ix-top .ix-brand-tag { color: var(--text-muted); }
  .ix-top .ix-out { color: var(--status-red-text); }
  .ix-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 4px 16px 10px; position: sticky; top: 0; z-index: 5; background: var(--bg-card); border-bottom: 1px solid var(--border); scrollbar-width: none; }
  .ix-tabs::-webkit-scrollbar { display: none; }
  .ix-tabs .ix-nav-item { width: auto; flex-shrink: 0; min-height: 34px; padding: 0 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-card); color: var(--text-secondary); font-size: 13px; }
  .ix-tabs .ix-nav-item.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ix-tabs .ix-count { background: var(--bg-muted); color: var(--text-secondary); }
  .ix-tabs .ix-nav-item.on .ix-count { background: rgba(255,255,255,0.25); color: #fff; }
  .ix-tabs .ix-count.alert { background: var(--status-red-bg); color: var(--status-red-text); }
  .ix-page, .ix-page.narrow { max-width: none; padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 32px); }
  .ix-head { margin-bottom: 18px; align-items: flex-start; }
  .ix-title { font-size: 21px; }
  .ix-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .ix-stat-value { font-size: 22px; }
  .ix-two, .ix-fields { grid-template-columns: 1fr; }
  .ix-section-head { flex-direction: column; gap: 2px; }
  .ix-card-head, .ix-card-body, .ix-event, .ix-todo, .ixl-head { padding-left: 14px; padding-right: 14px; }
  .ixl-row, .ixl-row.plain { grid-template-columns: 34px minmax(0, 1fr); gap: 4px 12px; padding: 13px 14px; align-items: start; }
  .ixl-row.plain { grid-template-columns: minmax(0, 1fr); }
  .ixl-avatar { grid-row: span 2; }
  .ixl-primary-line { flex-wrap: wrap; row-gap: 4px; }
  .ixl-meta { text-align: left; }
  .ixl-row:not(.plain) .ixl-meta, .ixl-row:not(.plain) .ixl-action { grid-column: 2; }
  .ixl-meta > span { white-space: normal; }
  .ixl-action { justify-content: flex-start; margin-top: 6px; }
  .ix-btn { height: 36px; }
  .cc-head { padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px; }
  .cc-body { padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 28px); }
  .cc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
