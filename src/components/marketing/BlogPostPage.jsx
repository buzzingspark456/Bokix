import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Copy, Info, Sparkles, AlertTriangle } from '../icons';
import { ProgramLogo } from '../shared/BrandLogos';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import BlogDiagram from './BlogDiagrams';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL, schemaDate } from '../../utils/seo';
import { ALL_ARTICLES } from '../../content/marketing/news';
import { MIGRATION_SOURCES } from '../../utils/migrationSources';
import { SHOTS, SHOT_WIDTH, SHOT_HEIGHT } from '../../content/marketing/screenshots';

// ── En bloggartikel (/blogg/<slug>) ─────────────────────────────────────
// Renderar ett inlägg ur BLOG_POSTS (content/marketing/blog.js) som har ett
// `body`. Ett nytt inlägg behöver ingen ny komponent: lägg till det i
// blog.js (blocktyperna står beskrivna där). Nyheter (news.js, /nyheter/<slug>)
// använder samma mall; `news: true` byter brödsmulor, schema och "Fler".
//
// Mallen är gjord för att läsas: kort svar överst, innehållsförteckning
// (sidokolumn på dator, hopfällbar på mobil), stegkort, faktarutor, tabell,
// kodruta med förklaring, FAQ och relaterade artiklar. Brödtexten ligger
// i vanliga block, INTE i <Reveal>: Reveal väntar tills 15 % av elementets
// höjd syns, och en hel artikel är flera tusen pixlar hög, så den låg
// osynlig tills man skrollat en bra bit.

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function slugify(s) {
  return s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// [länktext](/sökväg) blir en riktig <Link>, **fetstil** blir <strong>.
const INLINE_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
function renderText(str) {
  if (!str) return null;
  return str.split(INLINE_RE).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: 'var(--mkt-ink)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={i} to={link[2]} style={{ color: BRAND.greenDark, fontWeight: 600 }}>{link[1]}</Link>;
    return part;
  });
}

function plain(str) {
  return String(str || '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function countWords(post) {
  const parts = [post.title, post.excerpt, ...(post.tldr || [])];
  for (const b of post.body) {
    if (typeof b.x === 'string') parts.push(b.x);
    else if (Array.isArray(b.x)) b.x.forEach(i => parts.push(typeof i === 'string' ? i : `${i.h} ${i.p}`));
    if (b.rows) b.rows.forEach(r => parts.push(r.join(' ')));
  }
  (post.faq || []).forEach(f => parts.push(f.q, f.a));
  return plain(parts.join(' ')).split(/\s+/).filter(Boolean).length;
}

const CALLOUT = {
  info: { Icon: Info, fg: 'var(--mkt-accent-blue-fg)', bg: 'var(--mkt-accent-blue-soft)' },
  tips: { Icon: Sparkles, fg: 'var(--mkt-accent-green-fg)', bg: 'var(--mkt-accent-green-soft)' },
  warn: { Icon: AlertTriangle, fg: 'var(--mkt-accent-red-fg)', bg: 'var(--mkt-accent-red-soft)' },
};

function Callout({ block }) {
  const c = CALLOUT[block.kind] || CALLOUT.info;
  const Icon = c.Icon;
  return (
    <aside className="bxp-callout" style={{ '--bx-fg': c.fg, '--bx-bg': c.bg }}>
      <span className="bxp-callout-ic"><Icon size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="bxp-callout-t">{block.title}</div>
        <p>{renderText(block.x)}</p>
        {block.logo ? (
          <span className="bxp-callout-logo"><img src={block.logo} alt={block.logoAlt || ''} loading="lazy" draggable={false} /></span>
        ) : null}
      </div>
    </aside>
  );
}

// Färgar SIE-etiketter (#TAG), text i citattecken och klammerparenteser.
function highlight(line) {
  const out = [];
  const re = /(#[A-Z0-9]+)|("[^"]*")|(\{\}|[{}])/g;
  let last = 0;
  let k = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    out.push(<span key={k++} className={m[1] ? 'bxc-t' : m[2] ? 'bxc-s' : 'bxc-b'}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(block.x).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    } catch { /* ingen urklippsåtkomst: knappen gör inget */ }
  };
  return (
    <figure className="bxc">
      <div className="bxc-bar">
        <span className="bxc-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="bxc-title">{block.title}</span>
        <button type="button" className="bxc-copy" onClick={copy}>
          {copied ? <><Check size={13} /> Kopierad</> : <><Copy size={13} /> Kopiera</>}
        </button>
      </div>
      <pre className="bxc-pre"><code>{block.x.split('\n').map((line, i) => <span key={i} className="bxc-l">{highlight(line)}{'\n'}</span>)}</code></pre>
      {block.notes ? (
        <dl className="bxc-notes">
          {block.notes.map(n => (
            <React.Fragment key={n.k}>
              <dt>{n.k}</dt>
              <dd>{n.v}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </figure>
  );
}

function DataTable({ block }) {
  const numeric = block.head.map((_, ci) => {
    const cells = block.rows.map(r => plain(r[ci]).trim()).filter(Boolean);
    return cells.length > 0 && cells.every(c => /^[\d\s.,−-]+$/.test(c));
  });
  return (
    <figure className="bxt">
      {block.caption ? <figcaption className="bxt-cap">{block.caption}</figcaption> : null}
      <div className="bxt-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>{block.head.map((h, i) => <th key={i} style={numeric[i] ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => <td key={ci} style={numeric[ci] ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : undefined}>{renderText(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Programs() {
  return (
    <div className="bxg">
      {MIGRATION_SOURCES.map(p => (
        <div className="bxg-card" key={p.id}>
          <div className="bxg-head">
            <span className="bxg-logo"><ProgramLogo src={p.logo} alt={`${p.name} logotyp`} size={30} /></span>
            <div>
              <div className="bxg-name">{p.name}</div>
              {p.note ? <div className="bxg-note">{p.note}</div> : null}
            </div>
          </div>
          <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      ))}
    </div>
  );
}

function Block({ block, id }) {
  switch (block.t) {
    case 'h2': return <h2 id={id}>{block.x}</h2>;
    case 'h3': return <h3>{block.x}</h3>;
    case 'p': return <p>{renderText(block.x)}</p>;
    case 'ul': return <ul>{block.x.map((li, i) => <li key={i}>{renderText(li)}</li>)}</ul>;
    case 'ol': return <ol>{block.x.map((li, i) => <li key={i}>{renderText(li)}</li>)}</ol>;
    case 'steps':
      return (
        <ol className="bxs">
          {block.x.map((s, i) => (
            <li key={i}>
              <span className="bxs-n">{i + 1}</span>
              <div>
                <h3>{s.h}</h3>
                <p>{renderText(s.p)}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'checklist':
      return (
        <ul className="bxk">
          {block.x.map((li, i) => <li key={i}><span className="bxk-c"><Check size={14} /></span><span>{renderText(li)}</span></li>)}
        </ul>
      );
    case 'callout': return <Callout block={block} />;
    case 'code': return <CodeBlock block={block} />;
    case 'table': return <DataTable block={block} />;
    case 'diagram': return <BlogDiagram id={block.id} caption={block.caption} />;
    case 'programs': return <Programs />;
    // Skärmbild ur appen (content/marketing/screenshots.js): { t: 'image', shot: 'stripe' }.
    case 'image': {
      const shot = SHOTS[block.shot];
      if (!shot) return null;
      return (
        <figure className="bp-shot" style={{ margin: '28px 0' }}>
          <img src={shot.src} alt={shot.alt} width={SHOT_WIDTH} height={SHOT_HEIGHT} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px', border: '1px solid var(--mkt-card-border)' }} />
          <figcaption style={{ fontSize: '14px', color: 'var(--mkt-muted)', marginTop: '10px' }}>{block.caption || shot.caption}</figcaption>
        </figure>
      );
    }
    default: return null;
  }
}

// Läsprogress som RIDER PÅ linjen i stället för att flyta som en egen
// bricka uppe i hörnet — kundfeedback: den gamla brickan låg rakt ovanpå
// "Kom igång"-knappen i headern. Linjen ligger nu direkt UNDER headern
// (top: HEADER_H, headerns egen höjd i MarketingLayout.jsx) i stället för
// på rad 0, så den aldrig kan krocka med knappen eller logotypen oavsett
// hur långt man läst. En liten lysande pigg glider längs linjens framkant
// och en procentbricka följer med, båda positionerade med samma `left:
// pct%` mot viewporten (samma gradient som resten av varumärket, ingen ny
// färg). Vid 100 % byts texten mot en bock — en liten belöning för att
// faktiskt ha läst klart, inte bara ett tal som försvinner.
const HEADER_H = 84;

function ReadingProgress({ targetRef }) {
  const fillRef = useRef(null);
  // Positionen (left: NN%) sätts imperativt på puck/bricka via ref, precis
  // som fill-stapelns scaleX — en scroll-handler i React state hade
  // triggat en omrendering per scroll-event, kännbart hackigt på en sida
  // med tunga bilder/diagram. Bara SIFFRAN och synlighets-/klart-läget
  // (som faktiskt behöver rendera om text/ikon) ligger i state.
  const puckRef = useRef(null);
  const pctElRef = useRef(null);
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const [done, setDoneFlag] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = targetRef.current;
      const fill = fillRef.current;
      const puck = puckRef.current;
      const pctEl = pctElRef.current;
      if (!el || !fill || !puck || !pctEl) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.2 - rect.top) / Math.max(total, 1)));
      const leftPct = `${(progress * 100).toFixed(2)}%`;
      fill.style.transform = `scaleX(${progress})`;
      puck.style.left = leftPct;
      pctEl.style.left = leftPct;
      setPct(Math.round(progress * 100));
      setVisible(progress > 0.01);
      setDoneFlag(progress >= 0.985);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [targetRef]);
  return (
    <div className="bxp-progress" aria-hidden="true">
      <div className="bxp-progress-track"><div ref={fillRef} className="bxp-progress-fill" /></div>
      <div ref={puckRef} className={`bxp-progress-puck${visible ? ' is-visible' : ''}${done ? ' is-done' : ''}`} />
      <div ref={pctElRef} className={`bxp-progress-pct${visible ? ' is-visible' : ''}${done ? ' is-done' : ''}`}>
        {done ? <><Check size={11} strokeWidth={3} /> Klart</> : `${pct} %`}
      </div>
    </div>
  );
}

const CSS = `
  #lp-root { overflow-x: clip !important; }

  /* Läsprogressen ligger under headern (top: ${HEADER_H}px = MarketingLayout.jsx:s
     navhöjd), aldrig ovanpå den — se kommentaren vid ReadingProgress. */
  .bxp-progress { position: fixed; top: ${HEADER_H}px; left: 0; right: 0; height: 0; z-index: 999; pointer-events: none; }
  .bxp-progress-track { position: absolute; left: 0; right: 0; top: 0; height: 3px; background: var(--mkt-border-soft, rgba(0,0,0,0.08)); overflow: hidden; }
  .bxp-progress-fill { height: 100%; transform: scaleX(0); transform-origin: 0 50%; background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16); transition: transform 0.08s linear; }

  .bxp-progress-puck {
    position: absolute; top: 0; width: 11px; height: 11px; margin: -4px 0 0 -5.5px; border-radius: 50%;
    background: linear-gradient(135deg, #0ea5e9, #14b8a6, #84cc16);
    opacity: 0; transition: left 0.08s linear, opacity 0.25s, transform 0.25s;
    animation: bxpPulse 2.4s ease-in-out infinite;
  }
  .bxp-progress-puck.is-visible { opacity: 1; }
  .bxp-progress-puck.is-done { animation: none; transform: scale(1.15); box-shadow: 0 0 0 5px rgba(20, 184, 166, 0.16); }
  @keyframes bxpPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14); }
    50% { box-shadow: 0 0 0 6px rgba(20, 184, 166, 0.22); }
  }

  .bxp-progress-pct {
    position: absolute; top: 14px; transform: translateX(-50%) translateY(-4px);
    display: flex; align-items: center; gap: 4px;
    font-size: 11.5px; font-weight: 800; letter-spacing: 0.02em; color: ${INK}; white-space: nowrap;
    background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; box-shadow: ${CARD_SHADOW};
    padding: 4px 9px; border-radius: 999px; opacity: 0; transition: left 0.08s linear, opacity 0.25s, transform 0.25s;
    font-variant-numeric: tabular-nums;
  }
  .bxp-progress-pct.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
  .bxp-progress-pct.is-done { color: var(--mkt-accent-green-fg); border-color: transparent; background: var(--mkt-accent-green-soft); }
  @media (max-width: 560px) { .bxp-progress-pct { font-size: 11px; padding: 3.5px 8px; } }
  @media (prefers-reduced-motion: reduce) { .bxp-progress-puck { animation: none; } }

  .bxp-head { max-width: 992px; margin: 0 auto; }
  .bxp-h1, .bxp-lede { max-width: 760px; }
  .bxp-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; font-size: 13.5px; color: ${MUTED}; margin-bottom: 22px; }
  .bxp-crumbs a { color: ${MUTED}; text-decoration: none; font-weight: 600; }
  .bxp-crumbs a:hover { color: ${INK}; text-decoration: underline; }
  .bxp-cat { display: inline-block; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkt-accent-green-fg); background: var(--mkt-accent-green-soft); padding: 5px 12px; border-radius: 999px; text-decoration: none; margin-bottom: 18px; }
  .bxp-h1 { font-family: ${SERIF}; font-size: clamp(31px, 5vw, 50px); font-weight: 700; letter-spacing: -0.018em; color: ${INK}; margin: 0 0 18px; line-height: 1.1; }
  .bxp-lede { font-size: clamp(17px, 2.1vw, 20px); line-height: 1.6; color: ${INK_SOFT}; margin: 0 0 24px; }
  .bxp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 13.5px; color: ${MUTED}; font-weight: 500; }
  .bxp-meta img { width: 34px; height: 34px; border-radius: 50%; display: block; border: 1px solid ${CARD_BORDER}; }
  .bxp-meta strong { color: ${INK}; font-weight: 700; }
  .bxp-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: ${MUTED}; opacity: 0.6; }
  @media (max-width: 560px) { .bxp-meta .dot { display: none; } .bxp-meta { gap: 6px 16px; } .bxp-meta img { margin-right: -6px; } }

  .bxp-hero { max-width: 1040px; margin: 0 auto; padding: 36px 24px 0; }
  .bxp-hero img { width: 100%; height: auto; aspect-ratio: 1200 / 630; display: block; border-radius: 20px; border: 1px solid ${CARD_BORDER}; box-shadow: ${CARD_SHADOW}; background: var(--mkt-card-bg); }

  .bxp-layout { max-width: 1040px; margin: 0 auto; padding: 40px 24px 24px; }
  .bxp-main { max-width: 720px; min-width: 0; }



  .bxp-main > p, .bxp-main li, .bxp-main dd { font-size: clamp(16.5px, 2vw, 18px); line-height: 1.8; color: ${INK_SOFT}; }
  .bxp-main > p { margin: 0 0 20px; }
  .bxp-main > h2 { font-family: ${SERIF}; font-size: clamp(24px, 3vw, 31px); font-weight: 700; letter-spacing: -0.012em; color: ${INK}; margin: 54px 0 16px; line-height: 1.2; scroll-margin-top: 100px; }
  .bxp-main > h2:first-of-type { margin-top: 12px; }
  .bxp-main > h3 { font-size: 19px; font-weight: 800; color: ${INK}; margin: 30px 0 8px; line-height: 1.3; }
  .bxp-main > ul, .bxp-main > ol { margin: 0 0 24px; padding-left: 1.3em; }
  .bxp-main > ul > li, .bxp-main > ol > li { margin: 0 0 10px; }

  .bxs { list-style: none; margin: 8px 0 28px; padding: 0; display: grid; gap: 14px; counter-reset: none; }
  .bxs > li { display: grid; grid-template-columns: 40px 1fr; gap: 16px; padding: 18px 20px 16px 18px; border: 1px solid ${CARD_BORDER}; border-radius: 16px; background: var(--mkt-card-bg); box-shadow: var(--mkt-card-shadow-sm); margin: 0; }
  @media (max-width: 520px) { .bxs > li { grid-template-columns: 34px 1fr; gap: 12px; padding: 15px 14px 14px 14px; } .bxs-n { width: 34px !important; height: 34px !important; font-size: 15px !important; } }
  .bxs-n { width: 38px; height: 38px; border-radius: 50%; background: ${BRAND.green}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
  .bxs h3 { font-size: 17.5px; font-weight: 800; color: ${INK}; margin: 6px 0 4px; line-height: 1.3; }
  .bxs p { margin: 0; font-size: 16px; line-height: 1.7; color: ${INK_SOFT}; }

  .bxk { list-style: none; margin: 8px 0 28px; padding: 0; display: grid; gap: 11px; }
  .bxk > li { display: grid; grid-template-columns: 26px 1fr; gap: 12px; align-items: start; margin: 0; }
  .bxk-c { width: 24px; height: 24px; border-radius: 7px; background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg); display: flex; align-items: center; justify-content: center; margin-top: 4px; }

  .bxp-callout { display: grid; grid-template-columns: 34px 1fr; gap: 14px; margin: 26px 0; padding: 18px 20px 16px 18px; border-radius: 16px; background: var(--bx-bg); border-left: 4px solid var(--bx-fg); }
  .bxp-callout-ic { width: 32px; height: 32px; border-radius: 10px; background: var(--mkt-card-bg); color: var(--bx-fg); display: flex; align-items: center; justify-content: center; }
  .bxp-callout-t { font-weight: 800; font-size: 16px; color: ${INK}; margin: 4px 0 5px; }
  .bxp-callout p { margin: 0; font-size: 16px; line-height: 1.7; color: ${INK}; }
  .bxp-callout-logo { display: inline-flex; margin-top: 14px; padding: 9px 14px; background: #fff; border-radius: 12px; border: 1px solid rgba(28,36,32,0.08); }
  .bxp-callout-logo img { height: 38px; width: auto; display: block; }

  .bxc { margin: 26px 0 30px; border-radius: 16px; overflow: hidden; background: #0f1a13; border: 1px solid #22352a; box-shadow: var(--mkt-card-shadow-sm); }
  .bxc-bar { display: flex; align-items: center; gap: 12px; padding: 11px 14px; background: #16261c; border-bottom: 1px solid #22352a; }
  .bxc-dots { display: inline-flex; gap: 6px; }
  .bxc-dots i { width: 10px; height: 10px; border-radius: 50%; background: #35503f; display: block; }
  .bxc-title { font-family: 'Cascadia Mono', Consolas, Menlo, monospace; font-size: 13px; color: #9db3a2; flex: 1; }
  .bxc-copy { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #2c4636; background: transparent; color: #c3d6c6; border-radius: 8px; padding: 5px 10px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .bxc-copy:hover { background: #1c3324; }
  .bxc-pre { margin: 0; padding: 18px 20px; overflow-x: auto; font-family: 'Cascadia Mono', Consolas, Menlo, monospace; font-size: 13.5px; line-height: 1.7; color: #d5e4d8; tab-size: 3; }
  .bxc-t { color: #5cc6f5; font-weight: 700; } .bxc-s { color: #a6e08a; } .bxc-b { color: #7f9a86; }
  .bxc-notes { margin: 0; padding: 6px 20px 16px; display: grid; grid-template-columns: max-content 1fr; gap: 0 18px; background: var(--mkt-card-bg); border-top: 1px solid #22352a; }
  .bxc-notes dt { font-family: 'Cascadia Mono', Consolas, Menlo, monospace; font-size: 13px; font-weight: 700; color: var(--mkt-accent-blue-fg); padding: 11px 0 0; }
  .bxc-notes dd { margin: 0; padding: 9px 0 9px; font-size: 15px !important; line-height: 1.6 !important; border-bottom: 1px solid ${CARD_BORDER}; }
  .bxc-notes dt, .bxc-notes dd { border-bottom: 1px solid ${CARD_BORDER}; }
  .bxc-notes dt { padding-bottom: 9px; }
  @media (max-width: 560px) { .bxc-notes { grid-template-columns: 1fr; } .bxc-notes dt { border-bottom: 0; padding-bottom: 0; } }

  .bxt { margin: 26px 0 30px; }
  .bxt-cap { font-size: 12.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; margin: 0 2px 10px; }
  .bxt-wrap { overflow-x: auto; border: 1px solid ${CARD_BORDER}; border-radius: 14px; background: var(--mkt-card-bg); }
  .bxt table { width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.5; min-width: 460px; }
  .bxt th { text-align: left; font-size: 12.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: ${MUTED}; padding: 12px 16px; background: var(--mkt-ivory); border-bottom: 1px solid ${CARD_BORDER}; white-space: nowrap; }
  .bxt td { padding: 13px 16px; color: ${INK_SOFT}; border-bottom: 1px solid ${CARD_BORDER}; vertical-align: top; }
  .bxt tr:last-child td { border-bottom: 0; }
  .bxt td:first-child { color: ${INK}; font-weight: 600; min-width: 92px; }

  .bxg { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; margin: 22px 0 26px; }
  .bxg-card { border: 1px solid ${CARD_BORDER}; border-radius: 16px; background: var(--mkt-card-bg); padding: 18px 18px 8px; box-shadow: var(--mkt-card-shadow-sm); }
  .bxg-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .bxg-logo { width: 46px; height: 46px; border-radius: 12px; background: #fff; border: 1px solid rgba(28,36,32,0.09); display: flex; align-items: center; justify-content: center; flex: none; }
  .bxg-name { font-weight: 800; font-size: 16.5px; color: ${INK}; line-height: 1.2; }
  .bxg-note { font-size: 12.5px; color: ${MUTED}; margin-top: 2px; }
  .bxg-card ol { margin: 0; padding-left: 1.2em; }
  .bxg-card li { font-size: 14.5px !important; line-height: 1.55 !important; margin: 0 0 9px; }


  .bxp-rel { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
  .bxp-rel a { display: block; text-decoration: none; border: 1px solid ${CARD_BORDER}; border-radius: 16px; overflow: hidden; background: var(--mkt-card-bg); box-shadow: var(--mkt-card-shadow-sm); }
  .bxp-rel img { width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; display: block; }
  .bxp-rel div { padding: 16px 18px 18px; }
  .bxp-rel small { font-size: 12px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--mkt-accent-green-fg); }
  .bxp-rel b { display: block; font-family: ${SERIF}; font-size: 18px; color: ${INK}; line-height: 1.3; margin-top: 6px; }
`;

export default function BlogPostPage({ slug }) {
  const navigate = useNavigate();
  const articleRef = useRef(null);
  const post = ALL_ARTICLES.find(p => p.slug === slug && p.body);

  const h2Ids = post ? post.body.filter(b => b.t === 'h2').map(b => slugify(b.x)) : [];

  if (!post) return null;
  const isNews = Boolean(post.news);
  const section = isNews
    ? { name: 'Nyheter', path: '/nyheter', schema: { '@type': 'CollectionPage', '@id': `${SITE_URL}/nyheter`, name: 'Nyheter från Bokix' } }
    : { name: 'Blogg', path: '/blogg', schema: { '@type': 'Blog', '@id': `${SITE_URL}/blogg`, name: 'Bokix-bloggen' } };
  const others = ALL_ARTICLES.filter(p => p.slug !== slug && Boolean(p.news) === isNews);
  const startSignup = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  let h2i = 0;

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': isNews ? 'NewsArticle' : 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}${post.path}`,
      inLanguage: 'sv-SE',
      // Omslaget först, sedan skärmbilderna i texten: alla är bilder som hör till artikeln.
      image: [post.image, ...post.body.filter(b => b.t === 'image' && SHOTS[b.shot]).map(b => SHOTS[b.shot].src)].map(src => `${SITE_URL}${src}`),
      datePublished: schemaDate(post.datePublished),
      dateModified: schemaDate(post.dateModified),
      articleSection: post.category,
      wordCount: countWords(post),
      author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
      description: post.excerpt,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${post.path}` },
      isPartOf: section.schema,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bokix', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: section.name, item: `${SITE_URL}${section.path}` },
        { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}${post.path}` },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <PageMeta
        title={`${post.seoTitle || post.title} | Bokix`}
        description={post.seoDescription || post.excerpt}
        path={post.path}
        image={`${SITE_URL}${post.image}`}
        type="article"
        publishedTime={post.datePublished}
        modifiedTime={post.dateModified}
      />
      {schema.map((s, i) => <JsonLd key={i} data={s} />)}
      <style>{CSS}</style>
      <ReadingProgress targetRef={articleRef} />

      <section style={{ padding: '132px 24px 0', background: IVORY }}>
        <div className="bxp-head">
          <nav className="bxp-crumbs" aria-label="Brödsmulor">
            <Link to="/">Bokix</Link><span aria-hidden="true">/</span>
            <Link to={section.path}>{section.name}</Link><span aria-hidden="true">/</span>
            <span>{post.category}</span>
          </nav>
          <Link to={section.path} className="bxp-cat">{post.category}</Link>
          <h1 className="bxp-h1">{post.title}</h1>
          <p className="bxp-lede">{post.excerpt}</p>
          <div className="bxp-meta">
            <img src="/icon-192.png" alt="Bokix logotyp" width="34" height="34" />
            <strong>Bokix-teamet</strong>
            <span className="dot" aria-hidden="true" />
            <span>Publicerad {formatDate(post.datePublished)}</span>
            {post.dateModified !== post.datePublished ? <><span className="dot" aria-hidden="true" /><span>Uppdaterad {formatDate(post.dateModified)}</span></> : null}
            <span className="dot" aria-hidden="true" />
            <span>{post.readTime}</span>
          </div>
        </div>
      </section>

      <div style={{ background: IVORY }}>
        <div className="bxp-hero">
          <img src={post.image} alt={post.imageAlt} width="1200" height="630" fetchPriority="high" />
        </div>

        <div className="bxp-layout">
          <article className="bxp-main" ref={articleRef}>
            {post.body.map((block, i) => (
              <Block key={i} block={block} id={block.t === 'h2' ? h2Ids[h2i++] : undefined} />
            ))}
          </article>
        </div>
      </div>

      {others.length > 0 && (
        <section style={{ padding: '30px 24px 64px', background: IVORY }}>
          <Reveal style={{ maxWidth: '1040px', margin: '0 auto', borderTop: `1px solid ${CARD_BORDER}`, paddingTop: '36px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: '16px' }}>
              {isNews ? 'Fler nyheter' : 'Fler artiklar'}
            </div>
            <div className="bxp-rel">
              {others.map(o => (
                <Link key={o.slug} to={o.path}>
                  <img src={o.image} alt={o.imageAlt} loading="lazy" width="1200" height="630" />
                  <div>
                    <small>{o.category}</small>
                    <b>{o.title}</b>
                  </div>
                </Link>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      <section style={{ padding: '64px 24px 100px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 29px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 11px' }}>
            Se det på riktigt, inte bara läs om det
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.65, margin: '0 0 26px' }}>
            30 dagar gratis, inga kortuppgifter som debiteras i förväg. Avsluta innan dess och det kostar dig ingenting.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startSignup} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 26px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis <ArrowRight size={15} />
            </button>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', textDecoration: 'none' }}>
              Alla funktioner
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}

// path -> sidkomponent för varje artikel med body. Läses av entry-server.jsx
// (förrendering) och AppRouter.jsx (klientroutes), så en ny artikel i
// blog.js får båda utan att de filerna behöver ändras.
export const BLOG_ARTICLE_PAGES = Object.fromEntries(
  ALL_ARTICLES.filter(p => p.body).map(p => [p.path, () => <BlogPostPage slug={p.slug} />])
);
