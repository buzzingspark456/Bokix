import React, { useMemo } from 'react';
import { ChevronLeft, AlertTriangle } from './icons';
import { AccountSearch } from './shared/SearchInputs';
import { MobileFormMode, MobileFormBar } from './shared/MobileForm';
import { numberFormat } from '../utils/intlCache';
import { t } from '../i18n';

// Artikelkortet (2026-11-24, admin): en sida i fyra delar (artikel, pris,
// lager och bokföring) med spara uppe till höger. Täckningsgraden och
// priset inklusive moms räknas medan man skriver. Nya artiklar får nästa
// lediga artikelnummer förifyllt.
const UNITS = ['st', 'tim', 'kr', 'm', 'm²', 'kg', 'dag', 'paket', 'l'];
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));

export function nextArticleNumber(articles = []) {
  const nums = articles.map(a => String(a.articleNumber || '').trim()).filter(n => /^\d{1,9}$/.test(n)).map(Number);
  return nums.length ? String(Math.max(...nums) + 1) : '';
}

export default function ArticleForm({ article, setArticle, isNew, articles = [], accounts = [], onSave, onCancel }) {
  const set = (patch) => setArticle(s => ({ ...s, ...patch }));
  const price = num(article.unitPrice) || 0;
  const cost = article.purchasePrice === '' || article.purchasePrice == null ? null : num(article.purchasePrice);
  const tg = cost != null && price > 0 ? price - cost : null;
  const tgPct = tg != null ? Math.round((tg / price) * 1000) / 10 : null;
  const withVat = price * (1 + (Number(article.vatRate) || 0) / 100);
  const isGood = article.type === 'vara';
  const suppliers = useMemo(() => [...new Set(articles.map(a => a.supplier).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'sv')), [articles]);
  const dupNumber = article.articleNumber && articles.some(a => a.id !== article.id && String(a.articleNumber || '').trim().toLowerCase() === String(article.articleNumber).trim().toLowerCase());
  const canSave = Boolean(String(article.description || '').trim()) && !dupNumber;
  const submit = (e) => { e.preventDefault(); if (canSave) onSave(); };

  return (
    <div className="af-page">
      <MobileFormMode />
      <form id="article-form" onSubmit={submit}>
        <div className="af-head">
          <button type="button" className="af-back" onClick={onCancel}><ChevronLeft size={16} /> {t('artForm.back')}</button>
          <div className="af-title">
            <h2>{isNew ? t('ui.ny_artikel') : (article.description || t('ui.andra_artikel'))}</h2>
            {!isNew && <span>{[article.articleNumber, isGood ? t('ui.vara') : t('ui.tjanst')].filter(Boolean).join(' · ')}</span>}
          </div>
          <span className="af-head-actions">
            <button type="button" className="agi-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
            <button type="submit" className="agi-btn primary" disabled={!canSave}>{t('ui.spara_artikel')}</button>
          </span>
        </div>
        <MobileFormBar>
          <button type="submit" form="article-form" className="mform-bar-primary" disabled={!canSave}>{t('ui.spara_artikel')}</button>
        </MobileFormBar>

        <div className="af-body">
          <div className="af-main">
            <section className="af-card">
              <h3>{t('artForm.secArticle')}</h3>
              <div className="af-type" role="radiogroup" aria-label={t('ui.typ')}>
                {[['vara', t('ui.vara'), t('artForm.typeGood')], ['tjanst', t('ui.tjanst'), t('artForm.typeService')]].map(([id, label, sub]) => (
                  <button key={id} type="button" role="radio" aria-checked={article.type === id} className={article.type === id ? 'on' : ''} onClick={() => set({ type: id })}>
                    <strong>{label}</strong><small>{sub}</small>
                  </button>
                ))}
              </div>
              <div className="af-grid">
                <label className="af-f af-wide">
                  <span>{t('ui.benamning')} <em>*</em></span>
                  <input className="ws-input" autoFocus={isNew} value={article.description} onChange={e => set({ description: e.target.value })} placeholder={isGood ? t('artForm.namePhGood') : t('ui.t_ex_konsulttimme')} />
                </label>
                <label className="af-f">
                  <span>{t('ui.artikelnummer')}</span>
                  <input className="ws-input" value={article.articleNumber} onChange={e => set({ articleNumber: e.target.value })} placeholder={t('ui.t_ex_1001')} />
                  {dupNumber && <small className="af-err"><AlertTriangle size={12} /> {t('artForm.dupNumber')}</small>}
                </label>
                <label className="af-f">
                  <span>{t('ui.enhet')}</span>
                  <select className="ws-input" value={article.unit} onChange={e => set({ unit: e.target.value })}>
                    {[...new Set([...UNITS, article.unit].filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="af-card">
              <h3>{t('artForm.secPrice')}</h3>
              <div className="af-grid af-grid-3">
                <label className="af-f">
                  <span>{t('ui.inkopspris')}</span>
                  <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={article.purchasePrice ?? ''} onChange={e => set({ purchasePrice: e.target.value === '' ? '' : e.target.value })} placeholder="0" /><span>kr</span></div>
                </label>
                <label className="af-f">
                  <span>{t('artForm.salePrice')}</span>
                  <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={article.unitPrice ?? ''} onChange={e => set({ unitPrice: e.target.value })} placeholder="0" /><span>kr</span></div>
                </label>
                <label className="af-f">
                  <span>{t('ui.moms')}</span>
                  <select className="ws-input" value={article.vatRate} onChange={e => set({ vatRate: Number(e.target.value) })}>
                    {[25, 12, 6, 0].map(r => <option key={r} value={r}>{r} %</option>)}
                  </select>
                </label>
              </div>
              <div className="af-figures">
                <div><span>{t('artForm.tg')}</span><strong className={tg != null && tg < 0 ? 'neg' : ''}>{tg == null ? '–' : `${fmt(tg)} kr`}</strong></div>
                <div><span>{t('artForm.tgPct')}</span><strong className={tgPct != null && tgPct < 0 ? 'neg' : ''}>{tgPct == null ? '–' : `${String(tgPct).replace('.', ',')} %`}</strong></div>
                <div><span>{t('artForm.inclVat')}</span><strong>{price > 0 ? `${fmt(withVat)} kr` : '–'}</strong></div>
              </div>
            </section>

            {isGood && (
              <section className="af-card">
                <h3>{t('artForm.secStock')}</h3>
                <div className="af-grid">
                  <label className="af-f">
                    <span>{t('artForm.supplier')}</span>
                    <input className="ws-input" list="af-suppliers" value={article.supplier || ''} onChange={e => set({ supplier: e.target.value })} placeholder={t('artForm.supplierPh')} />
                    <datalist id="af-suppliers">{suppliers.map(x => <option key={x} value={x} />)}</datalist>
                  </label>
                  <label className="af-f">
                    <span>{t('artForm.location')}</span>
                    <input className="ws-input" value={article.location || ''} onChange={e => set({ location: e.target.value })} placeholder={t('artForm.locationPh')} />
                  </label>
                  <label className="af-f">
                    <span>{t('ui.ean_streckkod')}</span>
                    <input className="ws-input" inputMode="numeric" value={article.ean || ''} onChange={e => set({ ean: e.target.value })} placeholder={t('ui.t_ex_7350000000000')} />
                  </label>
                </div>
              </section>
            )}

            <section className="af-card">
              <h3>{t('artForm.secBooking')}</h3>
              <div className="af-grid">
                <div className="af-f">
                  <span>{t('ui.bokforingskonto')}</span>
                  <AccountSearch value={article.account} onChange={code => set({ account: code })} accounts={accounts} placeholder={t('ui.sok_konto')} />
                </div>
                {!isGood && (
                  <label className="af-f">
                    <span>{t('ui.rot_rut')}</span>
                    <select className="ws-input" value={article.rotRut || 'none'} onChange={e => set({ rotRut: e.target.value })}>
                      <option value="none">{t('ui.ingen')}</option>
                      <option value="rot">ROT</option>
                      <option value="rut">RUT</option>
                    </select>
                  </label>
                )}
                <label className="af-f af-wide">
                  <span>{t('ui.benamning_engelska')}</span>
                  <input className="ws-input" value={article.descriptionEn || ''} onChange={e => set({ descriptionEn: e.target.value })} placeholder={t('ui.t_ex_consulting_hour')} />
                </label>
                <label className="af-f af-wide">
                  <span>{t('ui.anteckningar')}</span>
                  <textarea className="ws-input" rows={3} value={article.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder={t('ui.interna_anteckningar_om_artikeln')} />
                </label>
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}
