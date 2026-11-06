import React, { useMemo, useState } from 'react';
import { Search, Book, Sparkles, FileText, MessageSquare, AlertCircle, ArrowLeft } from './icons';
import Drawer from './Drawer';
import { t } from '../i18n';

// Egna körvägar i drawern, inte separata modaler — "Ordlista" byter bara
// innehållet i SAMMA drawer (view-state nedan) istället för att öppna ännu
// en overlay ovanpå. `action` körs på klick; `view` (om satt) byter
// synligt innehåll internt i drawern istället.
const SHORTCUTS = [
  // "Kom igång-guide" är borttagen (kundönskemål) — registreringsflödet
  // hör hemma vid registreringen, inte som en genväg i hjälpen.
  // Samma rundtur (driver.js, se utils/productTour.js) som visas
  // automatiskt första gången ett konto loggar in — den här genvägen är
  // den enda vägen tillbaka till den efteråt, se onStartTour/App.jsx.
  { icon: Sparkles, color: 'var(--status-amber-text)', bg: 'var(--status-amber-bg)', label: t('ui.starta_rundtur'), action: 'tour' },
  // Fakturor-sidans egen, kortare guide (utils/invoiceTour.js) — döljs där
  // efter första visningen, den här genvägen är den enda vägen tillbaka,
  // se onStartInvoiceTour/App.jsx.
  { icon: FileText, color: 'var(--status-green-text)', bg: 'var(--status-green-bg)', label: t('ui.fakturaguide'), action: 'invoice-tour' },
  { icon: Book, color: 'var(--status-pink-text)', bg: 'var(--status-pink-bg)', label: t('ui.ordlista'), action: 'glossary' },
];

// En första, enkel ordlista över de bokföringstermer som faktiskt
// förekommer i Bokix självt (kontoplan, moms, verifikationer osv.) —
// medvetet kort och i vardagsspråk, samma ton som resten av appen
// ("vardagliga etiketter, inte bokföringsjargong", se Dashboard.jsx).
// Kan byggas ut senare, men täcker det en ny användare stöter på först.
const GLOSSARY = [
  { term: t('glossary.g01.term'), def: t('glossary.g01.def') },
  { term: t('glossary.g02.term'), def: t('glossary.g02.def') },
  { term: t('glossary.g03.term'), def: t('glossary.g03.def') },
  { term: t('glossary.g04.term'), def: t('glossary.g04.def') },
  { term: t('glossary.g05.term'), def: t('glossary.g05.def') },
  { term: t('glossary.g06.term'), def: t('glossary.g06.def') },
  { term: t('glossary.g07.term'), def: t('glossary.g07.def') },
  { term: t('glossary.g08.term'), def: t('glossary.g08.def') },
  { term: t('glossary.g09.term'), def: t('glossary.g09.def') },
  { term: t('glossary.g10.term'), def: t('glossary.g10.def') },
  { term: t('glossary.g11.term'), def: t('glossary.g11.def') },
  { term: t('glossary.g12.term'), def: t('glossary.g12.def') },
  { term: t('glossary.g13.term'), def: t('glossary.g13.def') },
  { term: t('glossary.g14.term'), def: t('glossary.g14.def') },
  { term: t('glossary.g15.term'), def: t('glossary.g15.def') },
  { term: t('glossary.g16.term'), def: t('glossary.g16.def') },
  { term: t('glossary.g17.term'), def: t('glossary.g17.def') },
  { term: t('glossary.g18.term'), def: t('glossary.g18.def') },
];

const shortcutBtnStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition)', fontFamily: 'var(--font-sans)',
};

const HelpDrawer = ({ isOpen, onClose, onStartTour, onStartInvoiceTour, onContactSupport }) => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('menu'); // 'menu' | 'glossary'

  const filteredShortcuts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter(s => s.label.toLowerCase().includes(q));
  }, [search]);

  const filteredGlossary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(g => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
  }, [search]);

  const handleShortcut = (action) => {
    if (action === 'tour') onStartTour?.();
    else if (action === 'invoice-tour') onStartInvoiceTour?.();
    else if (action === 'glossary') { setView('glossary'); setSearch(''); }
  };

  // Stäng och nollställ till menyvyn — annars öppnar drawern nästa gång
  // mitt i ordlistan istället för på förstasidan.
  const handleClose = () => { setView('menu'); setSearch(''); onClose(); };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={view === 'glossary' ? t('ui.ordlista') : t('ui.hjalp_och_support')}>
      {view === 'glossary' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <button
            onClick={() => { setView('menu'); setSearch(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', padding: 0 }}
          >
            <ArrowLeft size={15} /> {t('ui.tillbaka_2')}
          </button>

          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={t('ui.sok_term_t_ex_moms')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredGlossary.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>{t('ui.inga_termer_matchar')}{search}".</p>
            ) : filteredGlossary.map(({ term, def }) => (
              <div key={term} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '3px' }}>{term}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{def}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={t('ui.vad_behover_du_hjalp_med')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div>
            <h3 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{t('ui.genvagar')}</h3>
            {filteredShortcuts.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '4px 0' }}>{t('ui.inga_genvagar_matchar')}{search}".</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredShortcuts.map(({ icon: Icon, color, bg, label, action }) => (
                  <button
                    key={label}
                    onClick={() => handleShortcut(action)}
                    style={shortcutBtnStyle}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} />
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Inne i appen öppnar båda knapparna supportformuläret, som
                skickar med sidan och företaget (App.jsx). Mejllänkarna är
                kvar för där formuläret inte finns. */}
            <a
              href="mailto:support@bokix.se?subject=Support%20-%20Bokix"
              onClick={onContactSupport ? (e) => { e.preventDefault(); onContactSupport('Support'); } : undefined}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <MessageSquare size={16} /> {t('ui.kontakta_support')}
            </a>
            <a
              href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix"
              onClick={onContactSupport ? (e) => { e.preventDefault(); onContactSupport('Felrapport'); } : undefined}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'color var(--transition)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <AlertCircle size={15} /> {t('ui.rapportera_ett_fel')}
            </a>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default HelpDrawer;
