import React from 'react';
import { CheckCircle2, ChevronRight, ExternalLink } from './icons';

// Översikten i Skatt och bokslut: allt man behöver göra, i den ordning det brådskar, med en
// tydlig knapp för varje sak. Bokix har ingen koppling till Skatteverket, så varje rad leder
// till en uppgift där Bokix förbereder en fil (eller ett underlag) som man laddar upp själv.
// Raden har också "Markera som inlämnad", eftersom Bokix inte kan se om man har lämnat in.
//
// `items` byggs i Taxes.jsx (overviewItems): { key, section, title, subtitle, dueLabel,
// daysLabel, urgency, done, status, cta, filedKey, canMark }.
export default function TaxOverview({ items, summary, onOpen, onToggleFiled, vatExempt = false }) {
  return (
    <div className="tax-ov">
      <section className="tax-ov-card" aria-label="Att göra">
        <div className="tax-ov-head">
          <h2 className="tax-ov-title">Att göra</h2>
          <p className="tax-ov-summary">{summary}</p>
        </div>
        <ul className="tax-todo-list">
          {items.map(item => (
            <li key={item.key} className={`tax-todo-row${item.done ? ' done' : ''}`}>
              <span className="tax-todo-mark" aria-hidden="true">
                {item.done ? <CheckCircle2 size={22} /> : <span className="tax-todo-ring" />}
              </span>
              <div className="tax-todo-main">
                <div className="tax-todo-title">{item.title}</div>
                <div className="tax-todo-sub">
                  {item.subtitle}{item.dueLabel ? ` · senast ${item.dueLabel}` : ''}
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
                    {item.done ? 'Ångra inlämnad' : 'Markera som inlämnad'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tax-ov-card tax-how" aria-label="Så lämnar du in">
        <h3 className="tax-how-title">Så lämnar du in</h3>
        <p className="tax-how-lead">
          Bokix skickar inte in åt dig. Vi räknar ut och förbereder allt, och du laddar upp filen hos
          Skatteverket med ditt BankID. Det tar några minuter.
        </p>
        <ol className="tax-how-steps">
          <li>
            <span className="tax-how-num">1</span>
            <div>
              <strong>Förbered i Bokix</strong>
              <small>Öppna uppgiften ovan. Bokix kontrollerar bokföringen och fyller i beloppen.</small>
            </div>
          </li>
          <li>
            <span className="tax-how-num">2</span>
            <div>
              <strong>Ladda ner filen</strong>
              <small>{vatExempt ? 'Inkomstdeklaration som SRU-filer, arbetsgivardeklaration som underlag.' : 'Moms som XML-fil, inkomstdeklaration som SRU-filer, arbetsgivardeklaration som underlag.'}</small>
            </div>
          </li>
          <li>
            <span className="tax-how-num">3</span>
            <div>
              <strong>Ladda upp hos Skatteverket</strong>
              <small>Logga in med BankID, välj att deklarera via fil, granska och signera.</small>
            </div>
          </li>
        </ol>
        <a className="tax-how-link" href="https://www.skatteverket.se/foretag" target="_blank" rel="noopener noreferrer">
          Öppna skatteverket.se <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}
