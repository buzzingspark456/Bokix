import React from 'react';
import { CheckCircle2, ChevronRight, ExternalLink } from './icons';
import { t, dateLocale } from '../i18n';
import { dateTimeFormat } from '../utils/intlCache';

// Översikten i Skatt och bokslut: allt man behöver göra, i den ordning det brådskar, med en
// tydlig knapp för varje sak. Bokix har ingen koppling till Skatteverket, så varje rad leder
// till en uppgift där Bokix förbereder en fil (eller ett underlag) som man laddar upp själv.
// Raden har också "Markera som inlämnad", eftersom Bokix inte kan se om man har lämnat in.
//
// `items` byggs i Taxes.jsx (overviewItems): { key, section, title, subtitle, dueLabel,
// daysLabel, urgency, done, status, cta, filedKey, canMark }.
// Datumrutan till vänster: dag och månad för när det ska vara inne, en bock
// när det är klart, ett streck när uppgiften saknar datum.
function DateTile({ item }) {
  if (item.done) return <span className="tax-date done" aria-hidden="true"><CheckCircle2 size={22} /></span>;
  if (!item.dueDate) return <span className="tax-date none" aria-label={t('taxOverview.noDate')}>–</span>;
  const d = new Date(item.dueDate);
  const month = dateTimeFormat(dateLocale(), { month: 'short' }).format(d).replace('.', '');
  return (
    <span className={`tax-date${item.urgency ? ` ${item.urgency}` : ''}`} aria-hidden="true">
      <span className="tax-date-day">{d.getDate()}</span>
      <span className="tax-date-month">{month}</span>
    </span>
  );
}

// Nu: det som ska in inom 45 dagar, är försenat eller saknar datum.
// Längre fram: resten. Klart: det som är inlämnat eller låst.
const SOON_DAYS = 45;

export default function TaxOverview({ items, summary, onOpen, onToggleFiled, vatExempt = false }) {
  const groups = [
    { id: 'now', label: t('taxOverview.now'), rows: items.filter(i => !i.done && (i.daysLeft == null || i.daysLeft <= SOON_DAYS)) },
    { id: 'later', label: t('taxOverview.later'), rows: items.filter(i => !i.done && i.daysLeft != null && i.daysLeft > SOON_DAYS) },
    { id: 'done', label: t('taxOverview.done'), rows: items.filter(i => i.done) },
  ].filter(g => g.rows.length > 0);
  return (
    <div className="tax-ov">
      <section className="tax-ov-card" aria-label={t('ui.att_gora')}>
        <div className="tax-ov-head">
          <h2 className="tax-ov-title">{t('ui.att_gora')}</h2>
          <p className="tax-ov-summary">{summary}</p>
        </div>
        {groups.map(g => (
        <div key={g.id} className="tax-todo-group">
        {groups.length > 1 && <h3 className="tax-todo-group-title">{g.label}</h3>}
        <ul className="tax-todo-list">
          {g.rows.map(item => (
            <li key={item.key} className={`tax-todo-row${item.done ? ' done' : ''}`}>
              <DateTile item={item} />
              <div className="tax-todo-main">
                <div className="tax-todo-title">{item.title}</div>
                <div className="tax-todo-sub">
                  {item.subtitle}{item.dueLabel ? t('ui.senast_2', { dueLabel: item.dueLabel }) : ''}
                </div>
                <div className="tax-todo-status">{item.status}</div>
              </div>
              <div className="tax-todo-side">
                {!item.done && item.daysLabel && (
                  <span className={`tax-todo-days${item.urgency ? ` ${item.urgency}` : ''}`}>{item.daysLabel}</span>
                )}
                <button type="button" className="tax-todo-cta" onClick={() => onOpen(item.section, item)}>
                  {item.cta} <ChevronRight size={16} />
                </button>
                {item.filedKey && (item.canMark || item.done) && (
                  <button type="button" className="tax-todo-link" onClick={() => onToggleFiled(item.filedKey)}>
                    {item.done ? t('ui.angra_inlamnad') : t('ui.markera_som_inlamnad')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        </div>
        ))}
      </section>

      <section className="tax-ov-card tax-how" aria-label={t('ui.sa_lamnar_du_in')}>
        <h3 className="tax-how-title">{t('ui.sa_lamnar_du_in')}</h3>
        <p className="tax-how-lead">
          {t('ui.bokix_skickar_inte_in_at_dig_vi_raknar_ut_och_fo')}
        </p>
        <ol className="tax-how-steps">
          <li>
            <span className="tax-how-num">1</span>
            <div>
              <strong>{t('ui.forbered_i_bokix')}</strong>
              <small>{t('ui.oppna_uppgiften_ovan_bokix_kontrollerar_bokforin')}</small>
            </div>
          </li>
          <li>
            <span className="tax-how-num">2</span>
            <div>
              <strong>{t('ui.ladda_ner_filen')}</strong>
              <small>{vatExempt ? t('ui.inkomstdeklaration_som_sru_filer_arbetsgivardekl') : t('ui.moms_som_xml_fil_inkomstdeklaration_som_sru_file')}</small>
            </div>
          </li>
          <li>
            <span className="tax-how-num">3</span>
            <div>
              <strong>{t('ui.ladda_upp_hos_skatteverket')}</strong>
              <small>{t('ui.logga_in_med_bankid_valj_att_deklarera_via_fil_g')}</small>
            </div>
          </li>
        </ol>
        <a className="tax-how-link" href="https://www.skatteverket.se/foretag" target="_blank" rel="noopener noreferrer">
          {t('ui.oppna_skatteverket_se')} <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}
