import React, { useMemo, useState } from 'react';
import { Search, Book, PlayCircle, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
import Drawer from './Drawer';

// Egna körvägar i drawern, inte separata modaler — "Ordlista" byter bara
// innehållet i SAMMA drawer (view-state nedan) istället för att öppna ännu
// en overlay ovanpå. `action` körs på klick; `view` (om satt) byter
// synligt innehåll internt i drawern istället.
const SHORTCUTS = [
  { icon: PlayCircle, color: '#3a8fc1', bg: '#eef5fb', label: 'Kom igång-guide', action: 'guide' },
  { icon: Book, color: '#9333ea', bg: '#fdf4ff', label: 'Ordlista', action: 'glossary' },
];

// En första, enkel ordlista över de bokföringstermer som faktiskt
// förekommer i Bokix självt (kontoplan, moms, verifikationer osv.) —
// medvetet kort och i vardagsspråk, samma ton som resten av appen
// ("vardagliga etiketter, inte bokföringsjargong", se Dashboard.jsx).
// Kan byggas ut senare, men täcker det en ny användare stöter på först.
const GLOSSARY = [
  { term: 'Avskrivning', def: 'Att en dyrare tillgångs kostnad delas upp och bokförs över flera år istället för direkt vid köpet.' },
  { term: 'Balansräkning', def: 'Sammanställning av vad företaget äger (tillgångar) och är skyldigt (skulder och eget kapital) vid en viss tidpunkt.' },
  { term: 'BAS-kontoplan', def: 'Den gemensamma svenska standarden för hur bokföringskonton numreras och grupperas. Bokix använder BAS 2025 som standard.' },
  { term: 'Bokslut', def: 'Avslutningen av räkenskapsåret, då resultat- och balansräkning ställs samman för hela året.' },
  { term: 'Debet och kredit', def: 'Bokföringens två sidor. Varje verifikation ska ha lika stort belopp i debet som i kredit.' },
  { term: 'Enskild firma', def: 'En företagsform utan egen juridisk person — du och firman är samma skattesubjekt.' },
  { term: 'F-skatt', def: 'Skattsedeln som visar att företaget själv ansvarar för att betala in sin skatt och sina avgifter.' },
  { term: 'Ingående moms', def: 'Momsen du betalar på det du köper in till företaget. Går oftast att dra av mot den utgående momsen.' },
  { term: 'Kontoplan', def: 'Listan över alla konton ett företag bokför sina affärshändelser mot.' },
  { term: 'Kontrolluppgift (KU)', def: 'Årlig rapport till Skatteverket, bland annat om utbetald lön till anställda.' },
  { term: 'Kundfaktura', def: 'Fakturan du skickar till en kund för sålda varor eller tjänster.' },
  { term: 'Leverantörsfaktura', def: 'Fakturan du tar emot och ska betala, för det du själv köpt in.' },
  { term: 'Momsdeklaration', def: 'Den periodiska rapporten till Skatteverket som visar utgående minus ingående moms — mellanskillnaden betalas in eller får tillbaka.' },
  { term: 'Räkenskapsår', def: 'Den tolvmånadersperiod som bokföringen och bokslutet följer, för de flesta samma som kalenderåret.' },
  { term: 'Resultaträkning', def: 'Sammanställning av intäkter minus kostnader under en period — visar om det blev vinst eller förlust.' },
  { term: 'Utgående moms', def: 'Momsen du tar ut av dina kunder när du säljer. Betalas in till Skatteverket, med avdrag för ingående moms.' },
  { term: 'Verifikation', def: 'Det bokförda underlaget för en affärshändelse — datum, belopp och vilka konton som påverkas.' },
  { term: 'Årsredovisning', def: 'Det formella dokument som sammanfattar bokslutet och (för bland annat aktiebolag) lämnas in till Bolagsverket.' },
];

const shortcutBtnStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition)', fontFamily: 'var(--font-sans)',
};

// `onOpenGuide`: stänger drawern och startar OnboardingFlow (App.jsx:
// showOnboarding) — samma flöde som Dashboards "Fortsätt registreringen".
const HelpDrawer = ({ isOpen, onClose, onOpenGuide }) => {
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
    if (action === 'guide') onOpenGuide?.();
    else if (action === 'glossary') { setView('glossary'); setSearch(''); }
  };

  // Stäng och nollställ till menyvyn — annars öppnar drawern nästa gång
  // mitt i ordlistan istället för på förstasidan.
  const handleClose = () => { setView('menu'); setSearch(''); onClose(); };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={view === 'glossary' ? 'Ordlista' : 'Hjälp och support'}>
      {view === 'glossary' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <button
            onClick={() => { setView('menu'); setSearch(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', padding: 0 }}
          >
            <ArrowLeft size={15} /> Tillbaka
          </button>

          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Sök term, t.ex. moms"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredGlossary.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Inga termer matchar "{search}".</p>
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
              placeholder="Vad behöver du hjälp med?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div>
            <h3 style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Genvägar</h3>
            {filteredShortcuts.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '4px 0' }}>Inga genvägar matchar "{search}".</p>
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
            <a
              href="mailto:support@bokix.se?subject=Support%20-%20Bokix"
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <MessageSquare size={16} /> Kontakta support
            </a>
            <a
              href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'color var(--transition)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <AlertCircle size={15} /> Rapportera ett fel
            </a>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default HelpDrawer;
