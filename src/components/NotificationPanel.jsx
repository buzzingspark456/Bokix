import React from 'react';
import { Bell, Banknote, CalendarClock, ChevronRight, X, Cog } from './icons';
import { notificationWhen } from '../utils/notificationFeed';

// Notispanelen under klockan (2026-11-12). Delas av appen (App.jsx) och
// demon (DemoWorkspace.jsx), så att de alltid ser likadana ut.
// Nytt och Tidigare, rubrik + detalj, färgad ikon per sort, Att göra längst
// ner. Stilarna ligger i index.css (.np-*).
const ICON = { paid: Banknote, integration: Banknote, deadline: CalendarClock };

// Belopp ("72 500 kr") och fakturanummer ("Faktura 1011") i fetstil, så att
// det viktiga syns direkt.
const STRONG = /(\d[\d\s\u00a0]*(?:,\d+)?\s?kr|Faktura \d+|Invoice \d+)/g;
function emphasize(text) {
  return String(text || '').split(STRONG).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export default function NotificationPanel({ t, title, notifications, openedUnread, onOpen, onTodo, onDismiss, onSettings }) {
  const freshList = notifications.filter(n => openedUnread.has(n.keys.join('|')));
  const olderList = notifications.filter(n => !openedUnread.has(n.keys.join('|')));
  const row = (n, fresh) => {
    const Icon = ICON[n.kind] || Bell;
    return (
      <div key={n.keys.join('|')} className={fresh ? 'np-item fresh' : 'np-item'}>
        <button type="button" className="np-main" onClick={() => onOpen(n)}>
          <span className="np-icon" style={{ background: `var(--status-${n.tone}-bg)`, color: `var(--status-${n.tone}-text)` }}><Icon size={17} /></span>
          <span className="np-body">
            <span className="np-title">{emphasize(n.title || n.text)}</span>
            {n.detail && <span className="np-detail">{emphasize(n.detail)}</span>}
            <span className="np-when">{fresh && <span className="np-dot" aria-hidden="true" />}{notificationWhen(t, n.at)}</span>
          </span>
        </button>
        {onDismiss && (
          <button type="button" className="np-x" onClick={() => onDismiss(n)} aria-label={t('notifFeed.dismiss')} title={t('notifFeed.dismiss')}><X size={15} /></button>
        )}
      </div>
    );
  };
  return (
    <div className="profile-dropdown notif-dropdown np">
      <div className="np-head">
        <span className="np-h">{title}</span>
        {freshList.length > 0 && <span className="np-badge">{freshList.length === 1 ? t('notifFeed.newOne') : t('notifFeed.newCount', { count: freshList.length })}</span>}
        {onSettings && (
          <button type="button" className="np-gear" onClick={onSettings} aria-label={t('notifFeed.settings')} title={t('notifFeed.settings')}><Cog size={17} /></button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="np-empty">
          <span className="np-empty-icon"><Bell size={20} /></span>
          <div className="np-empty-title">{t('notifFeed.emptyTitle')}</div>
          <div className="np-empty-text">{t('notifFeed.emptyText')}</div>
        </div>
      ) : (
        <div className="np-list">
          {freshList.length > 0 && <div className="np-group">{t('notifFeed.fresh')}</div>}
          {freshList.map(n => row(n, true))}
          {olderList.length > 0 && freshList.length > 0 && <div className="np-group">{t('notifFeed.earlier')}</div>}
          {olderList.map(n => row(n, false))}
        </div>
      )}
      <button type="button" className="np-foot" onClick={onTodo}>
        {t('notifFeed.todo')} <ChevronRight size={15} />
      </button>
    </div>
  );
}
