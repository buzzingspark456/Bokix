import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Book, Sparkles, FileText, MessageSquare, AlertCircle, ArrowLeft, ChevronRight, ExternalLink, Receipt, BookOpen, Upload, Cog, Landmark, Inbox, UsersRound, Percent, Lock, BarChart3, Download, CreditCard, Image, Fingerprint, Users, Building2, Laptop, PlayCircle, HelpCircle, X, Maximize2, ChevronLeft } from './icons';
import Drawer from './Drawer';
import { t } from '../i18n';
import { HELP_ARTICLES, HELP_CATEGORIES, articlesForTab, searchArticles } from '../content/help/articles';
import { GUIDE_GROUPS } from '../content/marketing/guides';
import { FAQ_GROUPS } from './marketing/faqData';

// Hjälp och support (omgjord 2026-11-11, andra versionen). Ett litet
// hjälpcenter i panelen:
// - Stor sökruta överst som letar i hjälptexterna och ordlistan.
// - "Den här sidan": hjälpen för sidan man står på.
// - Ämnen som rutor med ikon; ett klick visar ämnets guider.
// - Guide: steg för steg och en knapp som öppnar rätt sida direkt.
// - Rundtur, fakturaguide, ordlista och kontakt med support.
// Texterna ligger i src/content/help/articles.js.

const GLOSSARY = Array.from({ length: 18 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { term: t(`glossary.g${n}.term`), def: t(`glossary.g${n}.def`) };
});

// Ikon och färg per ämne (appens statusfärger, ljus och mörk variant).
const CATEGORY_META = {
  start: { icon: Sparkles, tone: 'green' },
  in: { icon: FileText, tone: 'blue' },
  out: { icon: Receipt, tone: 'amber' },
  books: { icon: BookOpen, tone: 'pink' },
  move: { icon: Upload, tone: 'blue' },
  account: { icon: Cog, tone: 'gray' },
};
// Egen ikon per guide, samma som sidan i menyn.
const ARTICLE_META = {
  kvitto: [Receipt, 'amber'], faktura: [FileText, 'blue'], bankgiro: [Building2, 'green'], kund: [Users, 'blue'],
  offert: [FileText, 'green'], leverantorsfaktura: [Inbox, 'amber'], lon: [UsersRound, 'pink'], bank: [Landmark, 'amber'],
  moms: [Percent, 'green'], bokslut: [Lock, 'pink'], verifikation: [BookOpen, 'blue'], rapporter: [BarChart3, 'green'],
  'sie-import': [Upload, 'blue'], export: [Download, 'green'], anvandare: [Users, 'pink'], prenumeration: [CreditCard, 'blue'],
  logotyp: [Image, 'amber'], 'face-id': [Fingerprint, 'green'], hemskarm: [Laptop, 'blue'],
};

// Videoguiderna (samma filmer som bokix.se/guider), spelas här i panelen.
const VIDEOS = GUIDE_GROUPS.flatMap(g => g.guides);
const VIDEO_FOR_ARTICLE = {
  kvitto: 'ladda-upp-kvitto', faktura: 'skapa-faktura', kund: 'lagg-upp-kund', offert: 'skapa-offert',
  lon: 'ny-anstalld', moms: 'momsdeklaration', verifikation: 'ny-verifikation', rapporter: 'rapporter',
};
const fmtDuration = (iso) => {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return '';
  return `${Number(m[1] || 0)}:${String(Number(m[2] || 0)).padStart(2, '0')}`;
};
const isDark = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

// Vanliga frågor ur samma källa som bokix.se/vanliga-fragor, utan säljfrågorna.
// Inloggade kunder behöver inte säljfrågorna (kom igång, pris); hur-frågorna först.
const FAQ_ORDER = ['bokforing', 'fakturor', 'lon', 'sakerhet'];
const FAQ_SECTIONS = FAQ_ORDER.map(id => FAQ_GROUPS.find(g => g.id === id)).filter(Boolean);
const FAQ = FAQ_SECTIONS.flatMap(g => g.items.map(i => ({ q: i.q, a: i.a, group: g.title })));

const tile = (tone, size = 36) => ({
  width: size, height: size, borderRadius: size > 30 ? '11px' : '9px', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-text)`,
});

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function CategoryIcon({ id, size = 36, iconSize = 18 }) {
  const meta = CATEGORY_META[id] || CATEGORY_META.start;
  const Icon = meta.icon;
  return <span style={tile(meta.tone, size)}><Icon size={iconSize} /></span>;
}

function ArticleIcon({ id, category, size = 34, iconSize = 17 }) {
  const meta = ARTICLE_META[id];
  if (!meta) return <CategoryIcon id={category} size={size} iconSize={iconSize} />;
  const [Icon, tone] = meta;
  return <span style={tile(tone, size)}><Icon size={iconSize} /></span>;
}

function VideoCard({ video, onPlay, wide = false }) {
  const file = isDark() ? `${video.slug}-dark` : video.slug;
  return (
    <button type="button" className={wide ? 'hc-video hc-video-wide' : 'hc-video'} onClick={() => onPlay(video)}>
      <span className="hc-video-thumb">
        <img src={`/videos/${file}.jpg`} alt="" loading="lazy" />
        <span className="hc-video-play"><PlayCircle size={wide ? 26 : 22} /></span>
        <span className="hc-video-time">{fmtDuration(video.duration)}</span>
      </span>
      <span className="hc-video-title">{video.title}</span>
    </button>
  );
}

function VideoModal({ video, onClose, onPlay }) {
  useEffect(() => {
    // Fångas före panelens egen Esc (Drawer.jsx lyssnar på window), så att
    // Esc bara stänger filmen.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = prev; };
  }, [onClose]);
  const file = isDark() ? `${video.slug}-dark` : video.slug;
  const group = GUIDE_GROUPS.find(g => g.guides.some(v => v.slug === video.slug));
  const idx = VIDEOS.findIndex(v => v.slug === video.slug);
  const next = VIDEOS[(idx + 1) % VIDEOS.length];
  return createPortal(
    <div className="hc-vm" role="dialog" aria-modal="true" aria-label={`Videoguide: ${video.title}`} onClick={onClose}>
      <div className="hc-vm-box" onClick={e => e.stopPropagation()}>
        <div className="hc-vm-head">
          <div style={{ minWidth: 0 }}>
            {group && <div className="hc-vm-eyebrow">{group.title}</div>}
            <h2 className="hc-vm-title">{video.title}</h2>
          </div>
          <button type="button" className="hc-vm-close" onClick={onClose} aria-label="Stäng"><X size={20} /></button>
        </div>
        <video key={file} className="hc-vm-player" src={`/videos/${file}.mp4`} poster={`/videos/${file}.jpg`} controls autoPlay playsInline preload="metadata" />
        <div className="hc-vm-foot">
          <p className="hc-vm-lead">{video.lead}</p>
          {next && next.slug !== video.slug && (
            <button type="button" className="hc-vm-next" onClick={() => onPlay(next)}>
              Nästa: {next.title} <ChevronRight size={16} />
            </button>
          )}
        </div>
        <VideoRow videos={VIDEOS.filter(v => v.slug !== video.slug)} onPlay={onPlay} className="hc-vm-more" />
      </div>
    </div>,
    document.body,
  );
}

function VideoRow({ videos, onPlay, className = 'hc-videos' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update, videos]);
  const go = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' }); };
  return (
    <div className="hc-row">
      <div ref={ref} className={className}>{videos.map(v => <VideoCard key={v.slug} video={v} onPlay={onPlay} />)}</div>
      {edge.left && <button type="button" className="hc-arrow hc-arrow-left" onClick={() => go(-1)} aria-label="Föregående filmer"><ChevronLeft size={18} /></button>}
      {edge.right && <button type="button" className="hc-arrow hc-arrow-right" onClick={() => go(1)} aria-label="Fler filmer"><ChevronRight size={18} /></button>}
    </div>
  );
}

function FaqItem({ item }) {
  return (
    <details className="hc-faq">
      <summary>{item.q}<ChevronRight size={15} /></summary>
      <p>{item.a}</p>
    </details>
  );
}

function GuideCard({ article, onOpen }) {
  return (
    <button type="button" className="hc-card" onClick={() => onOpen(article)}>
      <ArticleIcon id={article.id} category={article.category} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="hc-card-title">{article.title}</span>
        <span className="hc-card-sub">{article.summary}</span>
      </span>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  );
}

const HelpDrawer = ({ isOpen, onClose, onStartTour, onStartInvoiceTour, onContactSupport, currentTab, onNavigate, hiddenTabs = [] }) => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('home'); // home | category | article | glossary
  const [article, setArticle] = useState(null);
  const [category, setCategory] = useState(null);
  const [from, setFrom] = useState('home');
  const [video, setVideo] = useState(null);

  // Texter för sidor som är gömda för företaget (t.ex. Lön) visas inte.
  const visible = useMemo(() => HELP_ARTICLES.filter(a => !hiddenTabs.includes(a.tab)), [hiddenTabs]);
  const forPage = useMemo(() => articlesForTab(currentTab).filter(a => visible.includes(a)), [currentTab, visible]);
  const results = useMemo(() => searchArticles(search, visible), [search, visible]);
  const words = useMemo(() => norm(search).split(/\s+/).filter(w => w.length > 1), [search]);
  const videoHits = useMemo(() => (words.length ? VIDEOS.filter(v => words.every(w => norm(v.title + ' ' + v.lead).includes(w))) : []), [words]);
  const faqHits = useMemo(() => (words.length ? FAQ.filter(i => words.every(w => norm(i.q + ' ' + i.a).includes(w))) : []), [words]);
  const glossaryHits = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(g => norm(g.term).includes(q) || norm(g.def).includes(q));
  }, [search]);

  const reset = () => { setView('home'); setSearch(''); setArticle(null); setCategory(null); setVideo(null); setBigVideo(false); };
  const [bigVideo, setBigVideo] = useState(false);
  const playVideo = (v) => { if (view !== 'video') setFrom(view); setVideo(v); setView('video'); };
  const handleClose = () => { reset(); onClose(); };
  const openArticle = (a) => { setFrom(view); setArticle(a); setView('article'); };
  const openCategory = (id) => { setCategory(id); setView('category'); };
  const goTo = (a) => {
    if (a.link) { window.open(a.link, '_blank', 'noopener'); return; }
    handleClose();
    onNavigate?.(a.tab, a.action);
  };
  const contact = (topic) => (e) => {
    if (!onContactSupport) return;
    e.preventDefault();
    handleClose();
    onContactSupport(topic);
  };

  const back = (to) => (
    <button type="button" className="hc-back" onClick={() => setView(to)}><ArrowLeft size={15} /> {t('ui.tillbaka_2')}</button>
  );

  const supportCard = (
    <div className="hc-support">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={tile('green', 38)}><MessageSquare size={18} /></span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Hittar du inte svaret?</div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Skriv till oss, så hjälper vi dig.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
        <a href="mailto:support@bokix.se?subject=Support%20-%20Bokix" onClick={contact('Support')} className="hc-primary">{t('ui.kontakta_support')}</a>
        <a href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix" onClick={contact('Felrapport')} className="hc-ghost"><AlertCircle size={15} /> {t('ui.rapportera_ett_fel')}</a>
      </div>
    </div>
  );

  let body;
  if (view === 'article' && article) {
    body = (
      <div className="hc-stack">
        {back(from === 'article' ? 'home' : from)}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CategoryIcon id={article.category} size={30} iconSize={15} />
          <span className="hc-eyebrow" style={{ margin: 0 }}>{HELP_CATEGORIES.find(c => c.id === article.category)?.label}</span>
        </div>
        <div>
          <h2 className="hc-h1">{article.title}</h2>
          <p className="hc-lead">{article.summary}</p>
        </div>
        {VIDEO_FOR_ARTICLE[article.id] && (() => {
          const v = VIDEOS.find(x => x.slug === VIDEO_FOR_ARTICLE[article.id]);
          return v ? <VideoCard video={v} onPlay={playVideo} wide /> : null;
        })()}
        <ol className="hc-steps">
          {article.steps.map((step, i) => (
            <li key={i}><span className="hc-num">{i + 1}</span><span>{step}</span></li>
          ))}
        </ol>
        {(article.tab || article.link) && (
          <button type="button" onClick={() => goTo(article)} className="help-open-btn">
            {article.open} {article.link ? <ExternalLink size={15} /> : <ChevronRight size={16} />}
          </button>
        )}
        {supportCard}
      </div>
    );
  } else if (view === 'category' && category) {
    const c = HELP_CATEGORIES.find(x => x.id === category);
    const items = visible.filter(a => a.category === category);
    body = (
      <div className="hc-stack">
        {back('home')}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <CategoryIcon id={category} size={44} iconSize={22} />
          <div>
            <h2 className="hc-h1" style={{ fontSize: '21px' }}>{c?.label}</h2>
            <div className="hc-lead" style={{ marginTop: '2px' }}>{items.length} {items.length === 1 ? 'guide' : 'guider'}</div>
          </div>
        </div>
        <div className="hc-list">{items.map(a => <GuideCard key={a.id} article={a} onOpen={openArticle} />)}</div>
        {supportCard}
      </div>
    );
  } else if (view === 'video' && video) {
    const file = isDark() ? `${video.slug}-dark` : video.slug;
    const idx = VIDEOS.findIndex(v => v.slug === video.slug);
    const next = VIDEOS[(idx + 1) % VIDEOS.length];
    body = (
      <div className="hc-stack">
        {back(from === 'video' ? 'home' : from)}
        <div className="hc-pv">
          {bigVideo ? (
            <img className="hc-player" src={`/videos/${file}.jpg`} alt="" />
          ) : (
            <video key={file} className="hc-player" src={`/videos/${file}.mp4`} poster={`/videos/${file}.jpg`} controls autoPlay playsInline preload="metadata" aria-label={`Videoguide: ${video.title}`} />
          )}
          <button type="button" className="hc-pv-big" onClick={() => setBigVideo(true)} aria-label="Förstora filmen"><Maximize2 size={15} /> Förstora</button>
        </div>
        <div>
          <h2 className="hc-h1" style={{ fontSize: '21px' }}>{video.title}</h2>
          <p className="hc-lead">{video.lead}</p>
        </div>
        {next && next.slug !== video.slug && (
          <button type="button" className="hc-vm-next" style={{ alignSelf: 'flex-start' }} onClick={() => playVideo(next)}>Nästa: {next.title} <ChevronRight size={16} /></button>
        )}
        <section>
          <div className="hc-eyebrow">Fler videoguider</div>
          <VideoRow videos={VIDEOS.filter(v => v.slug !== video.slug)} onPlay={playVideo} />
        </section>
        {supportCard}
      </div>
    );
  } else if (view === 'videos') {
    body = (
      <div className="hc-stack">
        {back('home')}
        <h2 className="hc-h1" style={{ fontSize: '21px' }}>Videoguider</h2>
        {GUIDE_GROUPS.map(g => (
          <section key={g.title}>
            <div className="hc-eyebrow">{g.title}</div>
            <div className="hc-video-grid">{g.guides.map(v => <VideoCard key={v.slug} video={v} onPlay={playVideo} />)}</div>
          </section>
        ))}
        {supportCard}
      </div>
    );
  } else if (view === 'faq') {
    body = (
      <div className="hc-stack">
        {back('home')}
        <h2 className="hc-h1" style={{ fontSize: '21px' }}>Vanliga frågor</h2>
        {FAQ_SECTIONS.map(g => (
          <section key={g.id}>
            <div className="hc-eyebrow">{g.title}</div>
            <div className="hc-faqs">{g.items.map(i => <FaqItem key={i.q} item={i} />)}</div>
          </section>
        ))}
        {supportCard}
      </div>
    );
  } else if (view === 'glossary') {
    body = (
      <div className="hc-stack">
        {back('home')}
        <h2 className="hc-h1" style={{ fontSize: '21px' }}>{t('ui.ordlista')}</h2>
        <div className="hc-search">
          <Search size={18} />
          <input type="search" placeholder={t('ui.sok_term_t_ex_moms')} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div>
          {glossaryHits.length === 0 ? (
            <p className="hc-lead" style={{ textAlign: 'center', padding: '20px 0' }}>{t('ui.inga_termer_matchar')}{search}".</p>
          ) : glossaryHits.map(({ term, def }) => (
            <div key={term} className="hc-term"><div className="hc-term-t">{term}</div><div className="hc-term-d">{def}</div></div>
          ))}
        </div>
      </div>
    );
  } else {
    const searching = Boolean(search.trim());
    body = (
      <div className="hc-stack">
        <div className="hc-hero">
          <h2 className="hc-h1">Hur kan vi hjälpa dig?</h2>
          <p className="hc-lead">Sök bland guider, filmer, vanliga frågor och ord.</p>
          <div className="hc-search" style={{ marginTop: '16px' }}>
            <Search size={18} />
            <input type="search" placeholder={t('ui.vad_behover_du_hjalp_med')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('ui.vad_behover_du_hjalp_med')} />
          </div>
        </div>

        {searching ? (
          <>
            <section>
              <div className="hc-eyebrow">Guider</div>
              {results.length ? (
                <div className="hc-list">{results.map(a => <GuideCard key={a.id} article={a} onOpen={openArticle} />)}</div>
              ) : (
                <p className="hc-lead" style={{ margin: 0 }}>Ingen guide matchar "{search}".</p>
              )}
            </section>
            {videoHits.length > 0 && (
              <section>
                <div className="hc-eyebrow">Videoguider</div>
                <VideoRow videos={videoHits} onPlay={playVideo} />
              </section>
            )}
            {faqHits.length > 0 && (
              <section>
                <div className="hc-eyebrow">Vanliga frågor</div>
                <div className="hc-faqs">{faqHits.slice(0, 5).map(i => <FaqItem key={i.q} item={i} />)}</div>
              </section>
            )}
            {glossaryHits.length > 0 && glossaryHits.length < GLOSSARY.length && (
              <section>
                <div className="hc-eyebrow">{t('ui.ordlista')}</div>
                {glossaryHits.slice(0, 4).map(({ term, def }) => (
                  <div key={term} className="hc-term"><div className="hc-term-t">{term}</div><div className="hc-term-d">{def}</div></div>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            {forPage.length > 0 && (
              <section>
                <div className="hc-eyebrow">Den här sidan</div>
                <div className="hc-list">{forPage.map(a => <GuideCard key={a.id} article={a} onOpen={openArticle} />)}</div>
              </section>
            )}

            <section>
              <div className="hc-eyebrow">Ämnen</div>
              <div className="hc-grid">
                {HELP_CATEGORIES.map(c => {
                  const n = visible.filter(a => a.category === c.id).length;
                  if (!n) return null;
                  return (
                    <button key={c.id} type="button" className="hc-tile" onClick={() => openCategory(c.id)}>
                      <CategoryIcon id={c.id} />
                      <span className="hc-tile-title">{c.label}</span>
                      <span className="hc-tile-sub">{n} {n === 1 ? 'guide' : 'guider'}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="hc-section-head"><div className="hc-eyebrow">Vanliga frågor</div><button type="button" className="hc-more" onClick={() => setView('faq')}>Alla {FAQ.length}</button></div>
              <div className="hc-faqs">{FAQ.slice(0, 5).map(i => <FaqItem key={i.q} item={i} />)}</div>
            </section>

            <section>
              <div className="hc-section-head"><div className="hc-eyebrow">Ord att kunna</div><button type="button" className="hc-more" onClick={() => { setView('glossary'); setSearch(''); }}>Hela ordlistan</button></div>
              <div className="hc-words">
                {GLOSSARY.slice(0, 4).map(({ term, def }) => (
                  <div key={term} className="hc-word"><div className="hc-term-t">{term}</div><div className="hc-term-d">{def}</div></div>
                ))}
              </div>
            </section>

            <section>
              <div className="hc-eyebrow">Visa mig</div>
              <div className="hc-chips">
                <button type="button" className="hc-chip" onClick={() => onStartTour?.()}><Sparkles size={15} /> Rundtur i appen</button>
                <button type="button" className="hc-chip" onClick={() => onStartInvoiceTour?.()}><FileText size={15} /> {t('ui.fakturaguide')}</button>
                <button type="button" className="hc-chip" onClick={() => { setView('glossary'); setSearch(''); }}><Book size={15} /> {t('ui.ordlista')}</button>
              </div>
            </section>

            <section>
              <div className="hc-section-head"><div className="hc-eyebrow">Videoguider</div><button type="button" className="hc-more" onClick={() => setView('videos')}>Alla {VIDEOS.length}</button></div>
              <VideoRow videos={VIDEOS} onPlay={playVideo} />
            </section>
          </>
        )}

        {supportCard}
      </div>
    );
  }

  return (
    <>
      <Drawer isOpen={isOpen} onClose={handleClose} title={view === 'home' ? t('ui.hjalp_och_support') : ''} width="500px">
        {body}
      </Drawer>
      {video && bigVideo && <VideoModal video={video} onClose={() => setBigVideo(false)} onPlay={setVideo} />}
    </>
  );
};

export default HelpDrawer;
