import React, { useState } from 'react';
import { Bell, Banknote, CalendarClock, ChevronRight, ChevronLeft, X, Cog, Mail, CreditCard } from './icons';
import { notificationWhen } from '../utils/notificationFeed';

// Notispanelen under klockan (2026-11-12). Delas av appen (App.jsx) och
// demon (DemoWorkspace.jsx), så att de alltid ser likadana ut.
// Nytt och Tidigare, rubrik + detalj, färgad ikon per sort, Att göra längst
// ner. Stilarna ligger i index.css (.np-*).
const ICON = { paid: Banknote, integration: Banknote, deadline: CalendarClock, inbox: Mail, payment: CreditCard };

// Belopp ("72 500 kr") och fakturanummer ("Faktura 1011") i fetstil, så att
// det viktiga syns direkt.
const STRONG = /(\d[\d\s\u00a0]*(?:,\d+)?\s?kr|Faktura \d+|Invoice \d+)/g;
function emphasize(text) {
  return String(text || '').split(STRONG).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

// Ett av/på-reglage i panelens inställningar.
function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`np-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}><i /></button>
  );
}

export default function NotificationPanel({ t, title, notifications, openedUnread, onOpen, onTodo, onDismiss, onSettings, quickSettings }) {
  // Kugghjulet (2026-11-22): på datorn visas inställningarna här i panelen, så
  // att man stannar på sidan man är på. På telefon går det till Inställningar.
  const [view, setView] = useState('list');
  const openSettings = () => {
    const wide = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 769px)').matches;
    if (wide && quickSettings) setView('settings'); else onSettings?.();
  };
  if (view === 'settings' && quickSettings) {
    return (
      <div className="profile-dropdown notif-dropdown np">
        <div className="np-head">
          <button type="button" className="np-back" onClick={() => setView('list')} aria-label={t('notifFeed.back')}><ChevronLeft size={18} /></button>
          <span className="np-h">{t('notifFeed.settings')}</span>
        </div>
        <div className="np-set">
          <div className="np-set-row">
            <span className="np-set-ic"><Bell size={16} /></span>
            <span className="np-set-text"><strong>{t('notifFeed.setSound')}</strong><small>{t('notifFeed.setSoundHint')} <button type="button" className="np-link" onClick={quickSettings.onPreview}>{t('notifFeed.setListen')}</button></small></span>
            <Switch on={quickSettings.sound} onChange={quickSettings.onSound} label={t('notifFeed.setSound')} />
          </div>
          {quickSettings.inboxNotify != null && (
            <div className="np-set-row">
              <span className="np-set-ic"><Mail size={16} /></span>
              <span className="np-set-text"><strong>{t('notifFeed.setInbox')}</strong><small>{t('notifFeed.setInboxHint')}</small></span>
              <Switch on={quickSettings.inboxNotify} onChange={quickSettings.onInboxNotify} label={t('notifFeed.setInbox')} />
            </div>
          )}
          <div className="np-set-row">
            <span className="np-set-ic"><Banknote size={16} /></span>
            <span className="np-set-text"><strong>{t('notifFeed.setAlways')}</strong><small>{t('notifFeed.setAlwaysHint')}</small></span>
          </div>
        </div>
        <button type="button" className="np-foot" onClick={onSettings}>
          {t('notifFeed.setAll')} <ChevronRight size={15} />
        </button>
      </div>
    );
  }
  const freshList = notifications.filter(n => openedUnread.has(n.keys.join('|')));
  const olderList = notifications.filter(n => !openedUnread.has(n.keys.join('|')));
  const row = (n, fresh) => {
    const Icon = ICON[n.kind] || Bell;
    return (
      <div key={n.keys.join('|')} className={fresh ? 'np-item fresh' : 'np-item'}>
        <button type="button" className="np-main" onClick={() => onOpen(n)}>
          {/* Ikonen visar vad det gäller (2026-11-27): röd betalning, blått mejl, grön
              inbetalning, gul deadline; Stripe och Zettle med sin egen färg. */}
          <span className={`np-icon np-tone-${n.tone}${n.source ? ` np-src-${n.source}` : ''}`}>{n.source ? <b>{n.source === 'zettle' ? 'Z' : 'S'}</b> : <Icon size={17} />}</span>
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
          <button type="button" className="np-gear" onClick={openSettings} aria-label={t('notifFeed.settings')} title={t('notifFeed.settings')}><Cog size={17} /></button>
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
