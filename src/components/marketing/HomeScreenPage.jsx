import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitFaq, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { INK, INK_SOFT, MUTED } from './marketingTokens';
import BokixWordmark from '../shared/BokixWordmark';
import { PageMeta, JsonLd } from '../../utils/seo';

// ── Bokix på hemskärmen (/lagg-till-pa-hemskarmen) ──────────────────────
// Visar hur man lägger Bokix som app på telefonens hemskärm, för iPhone
// (Safari) och Android (Chrome). Telefonen till vänster är en ritad kopia av
// det man ser på skärmen, steg för steg; stegen till höger följer med och
// går att trycka på. Appen öppnas i helskärm tack vare manifest.webmanifest
// och apple-mobile-web-app-taggarna i index.html. Ändras webbläsarnas menyer,
// ändra texten i STEPS och scenerna nedan.

const STEPS = {
  iphone: [
    { title: 'Öppna bokix.se i Safari', body: 'Gå till www.bokix.se i Safari på din iPhone.' },
    { title: 'Tryck på Dela-knappen', body: 'Fyrkanten med en pil uppåt. Ser du den inte, tryck först på de tre prickarna.' },
    { title: 'Välj Lägg till på hemskärmen', body: 'Skrolla ner i listan tills du ser den.' },
    { title: 'Tryck på Lägg till', body: 'Namnet är redan ifyllt. Bokix hamnar bland dina appar.' },
    { title: 'Öppna Bokix', body: 'Tryck på ikonen. Bokix öppnas i helskärm, som en vanlig app.' },
  ],
  android: [
    { title: 'Öppna bokix.se i Chrome', body: 'Gå till www.bokix.se i Google Chrome, på Samsung, Pixel, Xiaomi eller annan Android.' },
    { title: 'Tryck på de tre prickarna', body: 'Menyn uppe i högra hörnet.' },
    { title: 'Välj Installera app', body: 'Heter det Lägg till på startskärmen hos dig fungerar det likadant.' },
    { title: 'Tryck på Installera', body: 'Bokix hamnar på startskärmen och bland dina appar.' },
    { title: 'Öppna Bokix', body: 'Tryck på ikonen. Bokix öppnas i helskärm, som en vanlig app.' },
  ],
};

const FAQ = [
  { q: 'Är det en riktig app?', a: 'Det är samma Bokix som på webben, men den får en egen ikon och öppnas i helskärm utan adressfält. Du behöver inte ladda ner något från App Store eller Google Play, och den uppdateras av sig själv.' },
  { q: 'Måste jag logga in varje gång?', a: 'Nej. I appen på hemskärmen förblir du inloggad tills du själv loggar ut. Telefonen kan också spara din e-post och ditt lösenord, så att du slipper skriva dem nästa gång.' },
  { q: 'Fungerar det i andra webbläsare?', a: 'Ja. På iPhone går det även från Chrome, via Dela-knappen. På Android fungerar det i de flesta webbläsare, till exempel Samsung Internet och Firefox, via webbläsarens meny.' },
  { q: 'Hur tar jag bort den?', a: 'Som vilken app som helst: håll fingret på ikonen och välj Ta bort. Ditt konto och din bokföring påverkas inte.' },
];

const SCHEMA = [
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Lägg till Bokix på hemskärmen på iPhone',
    inLanguage: 'sv-SE',
    totalTime: 'PT1M',
    step: STEPS.iphone.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.body })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Lägg till Bokix på startskärmen på Android',
    inLanguage: 'sv-SE',
    totalTime: 'PT1M',
    step: STEPS.android.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.body })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
];

// ── Små ikoner som hör till webbläsarnas egna knappar ──
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
);
const DotsV = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);
const StatusIcons = () => (
  <svg width="62" height="12" viewBox="0 0 62 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="4.5" y="5.5" width="3" height="6.5" rx="1" /><rect x="9" y="3" width="3" height="9" rx="1" /><rect x="13.5" y="0.5" width="3" height="11.5" rx="1" /><path d="M28 3.2a9 9 0 0 1 11 0l-1.3 1.5a7 7 0 0 0-8.4 0zM30.2 5.8a5.5 5.5 0 0 1 6.6 0l-1.3 1.5a3.5 3.5 0 0 0-4 0zM33.5 8.2l1.6 1.8-1.6 1.8-1.6-1.8z" /><rect x="43.5" y="1" width="15" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity=".45" /><rect x="45" y="2.5" width="11" height="7" rx="1.6" /><rect x="59.5" y="4" width="1.6" height="4" rx=".8" opacity=".45" /></svg>
);
const PlusSquare = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
);

// En förenklad bokix.se, som den ser ut i telefonens webbläsare.
const MiniSite = () => (
  <div className="hs-site">
    <div className="hs-site-nav"><BokixWordmark height={16} /><span className="hs-site-btn">Kom igång</span></div>
    <div className="hs-site-h">Bokföring utan gissningar.</div>
    <div className="hs-site-p">Fakturor, kvitton, moms och lön i ett verktyg.</div>
    <span className="hs-site-cta">Prova gratis</span>
    <div className="hs-site-card"><i /><i /><i style={{ width: '60%' }} /></div>
  </div>
);

// Neutrala appikoner på hemskärmen, utan andras varumärken.
const TILE_COLORS = ['#8e9bab', '#b7c0cc', '#a3b1a6', '#c8b9a6', '#9fa9c2', '#b5a3b8', '#aab8b8', '#c2b2a1', '#98a7b5', '#b9c4ae', '#a8a2c0'];
const HomeGrid = ({ android }) => (
  <div className={`hs-home${android ? ' hs-home-android' : ''}`}>
    <div className="hs-home-grid">
      {TILE_COLORS.map((c, i) => <span key={i} className="hs-tile" style={{ background: c }} />)}
      <span className="hs-app-new">
        <img src={android ? '/icon-maskable-512.png' : '/icon-192.png'} alt="Bokix-appens ikon" className="hs-app-icon" />
        <small>Bokix</small>
      </span>
    </div>
    <div className="hs-dock">{[0, 1, 2, 3].map(i => <span key={i} className="hs-tile" style={{ background: TILE_COLORS[i + 4] }} />)}</div>
  </div>
);

// Bokix öppnat från hemskärmen: helskärm, ingen adressrad.
const OpenedApp = () => (
  <div className="hs-app">
    <div className="hs-app-top"><BokixWordmark height={22} /></div>
    <div className="hs-app-h">Logga in</div>
    <div className="hs-app-field">E-post</div>
    <div className="hs-app-field">Lösenord</div>
    <span className="hs-app-btn">Logga in</span>
    <div className="hs-app-note">Ingen adressrad, bara Bokix.</div>
  </div>
);

function IphoneScreen({ step }) {
  return (
    <>
      {/* 0–2: Safari */}
      <div className={`hs-scene${step <= 2 ? ' on' : ''}`}>
        <div className="hs-browser-body"><MiniSite /></div>
        <div className="hs-ios-bar">
          <div className="hs-ios-url"><span>bokix.se</span></div>
          <div className="hs-ios-tools">
            <span>‹</span><span>›</span>
            <span className={`hs-ios-share${step === 1 ? ' hs-tap' : ''}`}><ShareIcon /></span>
            <span>▢</span><span>⧉</span>
          </div>
        </div>
        <div className={`hs-sheet${step === 2 ? ' up' : ''}`}>
          <div className="hs-sheet-head"><img src="/icon-192.png" alt="Bokix-appens ikon" /><div><b>Bokix</b><small>bokix.se</small></div></div>
          <div className="hs-sheet-list">
            <div>Kopiera</div>
            <div>Lägg till bokmärke</div>
            <div>Lägg till i favoriter</div>
            <div className={`hs-sheet-hit${step === 2 ? ' hs-tap' : ''}`}>Lägg till på hemskärmen <PlusSquare /></div>
            <div>Sök på sidan</div>
          </div>
        </div>
      </div>
      {/* 3: Lägg till-dialogen */}
      <div className={`hs-scene hs-ios-add${step === 3 ? ' on' : ''}`}>
        <div className="hs-ios-add-bar"><span>Avbryt</span><b>Lägg till på hemskärmen</b><span className={`hs-ios-add-btn${step === 3 ? ' hs-tap' : ''}`}>Lägg till</span></div>
        <div className="hs-ios-add-row"><img src="/icon-192.png" alt="Bokix-appens ikon" /><div><div className="hs-ios-add-name">Bokix</div><small>https://www.bokix.se</small></div></div>
        <div className="hs-ios-add-hint">En symbol läggs till på hemskärmen så att du snabbt kommer åt webbplatsen.</div>
      </div>
      {/* 4: hemskärmen, sedan appen */}
      {step === 4 && <div className="hs-scene on hs-fadein"><HomeGrid /></div>}
      {step === 4 && <div className="hs-scene on hs-opened"><OpenedApp /></div>}
    </>
  );
}

function AndroidScreen({ step }) {
  return (
    <>
      {/* 0–2: Chrome */}
      <div className={`hs-scene${step <= 2 ? ' on' : ''}`}>
        <div className="hs-and-bar">
          <div className="hs-and-url">bokix.se</div>
          <span className="hs-and-tabs">2</span>
          <span className={`hs-and-dots${step === 1 ? ' hs-tap' : ''}`}><DotsV /></span>
        </div>
        <div className="hs-browser-body hs-and-body"><MiniSite /></div>
        <div className={`hs-and-menu${step === 2 ? ' open' : ''}`}>
          <div>Ny flik</div>
          <div>Ny inkognitoflik</div>
          <div>Historik</div>
          <div>Nedladdningar</div>
          <div>Dela…</div>
          <div className={`hs-and-hit${step === 2 ? ' hs-tap' : ''}`}>Installera app</div>
          <div>Inställningar</div>
        </div>
      </div>
      {/* 3: installationsdialogen */}
      <div className={`hs-scene${step === 3 ? ' on' : ''}`}>
        <div className="hs-and-bar"><div className="hs-and-url">bokix.se</div><span className="hs-and-tabs">2</span><span className="hs-and-dots"><DotsV /></span></div>
        <div className="hs-browser-body hs-and-body"><MiniSite /></div>
        <div className="hs-dim-all" />
        <div className="hs-and-dialog">
          <b>Installera app</b>
          <div className="hs-and-dialog-row"><img src="/icon-maskable-512.png" alt="Bokix-appens ikon" /><div><div>Bokix</div><small>www.bokix.se</small></div></div>
          <div className="hs-and-dialog-btns"><span>Avbryt</span><span className={`hs-and-install${step === 3 ? ' hs-tap' : ''}`}>Installera</span></div>
        </div>
      </div>
      {/* 4: startskärmen, sedan appen */}
      {step === 4 && <div className="hs-scene on hs-fadein"><HomeGrid android /></div>}
      {step === 4 && <div className="hs-scene on hs-opened"><OpenedApp /></div>}
    </>
  );
}

function Phone({ platform, step }) {
  return (
    <div className={`hs-phone hs-${platform}`} aria-hidden="true">
      <div className="hs-screen">
        <div className="hs-status"><span>9:41</span>{platform === 'iphone' ? <span className="hs-island" /> : <span className="hs-cam" />}<span className="hs-status-r"><StatusIcons /></span></div>
        {platform === 'iphone' ? <IphoneScreen step={step} /> : <AndroidScreen step={step} />}
      </div>
    </div>
  );
}

const CSS = `
  .hs-hero { padding: 140px 24px 40px; text-align: center; background: var(--mkt-page-bg); }
  .hs-tabs { display: inline-flex; gap: 4px; padding: 4px; margin-top: 30px; border-radius: 14px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); }
  .hs-tabs button { border: none; background: none; font: inherit; font-size: 15px; font-weight: 600; color: ${MUTED}; padding: 10px 22px; border-radius: 10px; cursor: pointer; }
  .hs-tabs button[aria-selected="true"] { background: var(--mkt-page-bg); color: ${INK}; box-shadow: 0 2px 8px -3px rgba(0,0,0,.25); }

  .hs-demo { padding: 40px 24px 96px; background: var(--mkt-page-bg); }
  .hs-demo-grid { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 80px; align-items: center; }

  .hs-steps { list-style: none; margin: 0; padding: 0; counter-reset: hs; }
  .hs-steps li { counter-increment: hs; }
  .hs-steps button { width: 100%; display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px; text-align: left; background: none; border: none; border-top: 1px solid var(--mkt-border-soft); padding: 20px 0; font: inherit; cursor: pointer; opacity: .5; transition: opacity .3s; }
  .hs-steps li:last-child button { border-bottom: 1px solid var(--mkt-border-soft); }
  .hs-steps button::before { content: counter(hs); width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 14px; border: 1.5px solid var(--mkt-border-soft); color: ${MUTED}; transition: all .3s; }
  .hs-steps button.on { opacity: 1; }
  .hs-steps button.on::before { background: var(--mkt-accent-green-fg); border-color: var(--mkt-accent-green-fg); color: #fff; }
  .hs-steps button:hover { opacity: .85; }
  .hs-steps button.on:hover { opacity: 1; }
  .hs-step-t { display: block; font-size: 17px; font-weight: 700; color: ${INK}; margin: 4px 0 4px; }
  .hs-step-b { display: block; font-size: 15px; line-height: 1.55; color: ${INK_SOFT}; }
  .hs-replay { margin-top: 18px; background: none; border: none; padding: 0; font: inherit; font-size: 14px; font-weight: 600; color: var(--mkt-accent-green-fg); cursor: pointer; }

  /* Telefonen: ljus skärm i båda temana, som en riktig telefon i dagsljus. */
  .hs-phone { width: 300px; height: 620px; margin: 0 auto; border-radius: 50px; padding: 11px; background: #17191c; box-shadow: 0 0 0 2px #2b2e33, 0 50px 90px -40px rgba(0,0,0,.55); position: relative; }
  .hs-android { border-radius: 36px; }
  .hs-screen { position: relative; width: 100%; height: 100%; border-radius: 40px; overflow: hidden; background: #fff; font-family: -apple-system, 'Inter', system-ui, sans-serif; color: #111; }
  .hs-android .hs-screen { border-radius: 26px; font-family: 'Roboto', 'Inter', system-ui, sans-serif; }
  .hs-status { position: absolute; top: 0; left: 0; right: 0; height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 26px; font-size: 13px; font-weight: 600; z-index: 20; }
  .hs-android .hs-status { height: 32px; padding: 0 18px; font-size: 12px; }
  .hs-island { position: absolute; left: 50%; top: 10px; width: 92px; height: 26px; margin-left: -46px; border-radius: 20px; background: #000; }
  .hs-cam { position: absolute; left: 50%; top: 9px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: #000; }
  .hs-status-r { display: flex; }

  .hs-scene { position: absolute; inset: 0; opacity: 0; transition: opacity .45s ease; pointer-events: none; }
  .hs-scene.on { opacity: 1; }
  .hs-fadein { animation: hs-fade .45s ease both; }
  @keyframes hs-fade { from { opacity: 0; } to { opacity: 1; } }
  .hs-opened.on { animation: hs-open 3.2s ease forwards; }
  @keyframes hs-open { 0%, 45% { opacity: 0; transform: scale(.2); transform-origin: 78% 46%; } 60%, 100% { opacity: 1; transform: scale(1); transform-origin: 78% 46%; } }

  .hs-browser-body { position: absolute; top: 44px; left: 0; right: 0; bottom: 96px; overflow: hidden; background: #fff; }
  .hs-and-body { top: 86px; bottom: 0; }
  .hs-dim-all { position: absolute; inset: 0; background: rgba(0,0,0,.4); z-index: 4; }
  .hs-and-dialog { z-index: 6; }
  .hs-site { padding: 18px 18px; }
  .hs-site-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
  .hs-site-btn { font-size: 10px; font-weight: 700; color: #fff; background: #15803d; padding: 5px 9px; border-radius: 7px; }
  .hs-site-h { font-family: Georgia, serif; font-size: 27px; font-weight: 700; line-height: 1.12; margin-bottom: 10px; color: #111; }
  .hs-site-p { font-size: 12.5px; color: #5d6b60; line-height: 1.5; margin-bottom: 16px; }
  .hs-site-cta { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: #15803d; padding: 9px 15px; border-radius: 9px; }
  .hs-site-card { margin-top: 26px; border: 1px solid #e3e8e4; border-radius: 12px; padding: 14px; box-shadow: 0 10px 24px -16px rgba(0,0,0,.3); }
  .hs-site-card i { display: block; height: 8px; border-radius: 5px; background: #e8eee9; margin: 7px 0; }

  .hs-ios-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 96px; background: rgba(246,246,248,.96); border-top: 1px solid #ddd; padding: 8px 14px 0; }
  .hs-ios-url { height: 36px; border-radius: 12px; background: #e5e5ea; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
  .hs-ios-tools { display: flex; justify-content: space-between; align-items: center; padding: 10px 8px 0; color: #0a84ff; font-size: 20px; }
  .hs-ios-share { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; position: relative; }

  .hs-sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 330px; background: #f2f2f7; border-radius: 18px 18px 0 0; transform: translateY(105%); transition: transform .45s cubic-bezier(.2,.8,.2,1); box-shadow: 0 -10px 40px rgba(0,0,0,.2); z-index: 5; padding: 14px 14px; }
  .hs-sheet.up { transform: translateY(0); }
  .hs-sheet-head { display: flex; gap: 10px; align-items: center; padding: 4px 4px 14px; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
  .hs-sheet-head img { width: 38px; height: 38px; border-radius: 9px; }
  .hs-sheet-head b { display: block; font-size: 14px; }
  .hs-sheet-head small { font-size: 12px; color: #888; }
  .hs-sheet-list { background: #fff; border-radius: 12px; overflow: hidden; }
  .hs-sheet-list div { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; font-size: 14px; border-bottom: 1px solid #eee; position: relative; }
  .hs-sheet-hit { font-weight: 600; }

  .hs-ios-add { background: #f2f2f7; }
  .hs-ios-add-bar { position: absolute; top: 50px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 14px; font-size: 13px; }
  .hs-ios-add-bar span { color: #0a84ff; }
  .hs-ios-add-bar b { font-size: 12px; font-weight: 600; text-align: center; flex: 1; padding: 0 6px; }
  .hs-ios-add-btn { font-weight: 700; position: relative; padding: 6px; margin: -6px; border-radius: 8px; }
  .hs-ios-add-row { position: absolute; top: 100px; left: 14px; right: 14px; display: flex; gap: 12px; align-items: center; background: #fff; border-radius: 12px; padding: 12px; }
  .hs-ios-add-row img { width: 56px; height: 56px; border-radius: 13px; }
  .hs-ios-add-name { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px; }
  .hs-ios-add-row small { font-size: 11px; color: #888; }
  .hs-ios-add-hint { position: absolute; top: 196px; left: 22px; right: 22px; font-size: 11.5px; color: #888; line-height: 1.45; }

  .hs-and-bar { position: absolute; top: 32px; left: 0; right: 0; height: 54px; display: flex; align-items: center; gap: 10px; padding: 0 10px 0 14px; background: #fff; border-bottom: 1px solid #eee; }
  .hs-and-url { flex: 1; height: 36px; border-radius: 18px; background: #f1f3f4; display: flex; align-items: center; padding: 0 14px; font-size: 14px; }
  .hs-and-tabs { width: 20px; height: 20px; border: 2px solid #444; border-radius: 5px; display: grid; place-items: center; font-size: 10px; font-weight: 700; }
  .hs-and-dots { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: #444; position: relative; }
  .hs-and-menu { position: absolute; top: 40px; right: 8px; width: 196px; background: #fff; border-radius: 12px; box-shadow: 0 10px 34px rgba(0,0,0,.25); padding: 6px 0; transform-origin: top right; transform: scale(.6); opacity: 0; transition: all .3s ease; z-index: 5; }
  .hs-and-menu.open { transform: scale(1); opacity: 1; }
  .hs-and-menu div { padding: 11px 18px; font-size: 13.5px; position: relative; }
  .hs-and-hit { font-weight: 600; }
  .hs-and-dialog { position: absolute; left: 24px; right: 24px; top: 200px; background: #fff; border-radius: 24px; padding: 22px 20px 16px; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
  .hs-and-dialog b { font-size: 17px; font-weight: 500; }
  .hs-and-dialog-row { display: flex; gap: 12px; align-items: center; margin: 18px 0 20px; font-size: 14px; }
  .hs-and-dialog-row img { width: 44px; height: 44px; border-radius: 50%; }
  .hs-and-dialog-row small { font-size: 11px; color: #777; }
  .hs-and-dialog-btns { display: flex; justify-content: flex-end; gap: 22px; font-size: 13.5px; font-weight: 600; color: #1a73e8; }
  .hs-and-install { position: relative; padding: 6px 10px; margin: -6px -10px; border-radius: 18px; }

  .hs-home { position: absolute; inset: 0; background: linear-gradient(160deg, #b6c9d8, #c9d7c4 55%, #e3d6c4); padding: 64px 22px 0; }
  .hs-home-android { background: linear-gradient(170deg, #c4cfdc, #d6d0e2); }
  .hs-home-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px 16px; justify-items: center; }
  .hs-tile { width: 50px; height: 50px; border-radius: 13px; opacity: .85; }
  .hs-home-android .hs-tile { border-radius: 50%; }
  .hs-app-new { display: flex; flex-direction: column; align-items: center; gap: 4px; animation: hs-pop .7s cubic-bezier(.3,1.6,.5,1) .35s both; position: relative; }
  .hs-app-new small { font-size: 10.5px; color: #111; font-weight: 500; }
  .hs-app-icon { width: 50px; height: 50px; border-radius: 13px; box-shadow: 0 6px 14px -6px rgba(0,0,0,.5); }
  .hs-home-android .hs-app-icon { border-radius: 50%; }
  .hs-app-new::after { content: ''; position: absolute; left: 50%; top: 25px; width: 50px; height: 50px; margin: -25px 0 0 -25px; border-radius: 50%; border: 3px solid rgba(21,128,61,.8); opacity: 0; animation: hs-ring .6s ease-out 1.25s; }
  @keyframes hs-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .hs-dock { position: absolute; left: 14px; right: 14px; bottom: 16px; height: 74px; border-radius: 26px; background: rgba(255,255,255,.35); display: flex; justify-content: space-around; align-items: center; }

  .hs-app { position: absolute; inset: 0; background: #fff; padding: 70px 24px 0; }
  .hs-app-top { display: flex; justify-content: center; margin-bottom: 40px; }
  .hs-app-h { font-size: 22px; font-weight: 700; margin-bottom: 18px; color: #111; }
  .hs-app-field { height: 42px; border: 1px solid #d9e0da; border-radius: 10px; display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #8a948c; margin-bottom: 10px; }
  .hs-app-btn { display: flex; justify-content: center; align-items: center; height: 44px; border-radius: 11px; background: #15803d; color: #fff; font-weight: 700; font-size: 14px; margin-top: 8px; }
  .hs-app-note { margin-top: 26px; text-align: center; font-size: 12px; color: #5d6b60; }

  /* Tryckringen på det man ska trycka på. */
  .hs-tap::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(21,128,61,.28); border: 2px solid rgba(21,128,61,.85); animation: hs-ring 1.1s ease-out .9s infinite; pointer-events: none; }
  .hs-sheet-hit.hs-tap, .hs-and-hit.hs-tap { background: rgba(21,128,61,.1); transition: background .3s .9s; }
  .hs-sheet-hit.hs-tap::after, .hs-and-hit.hs-tap::after { left: auto; right: 30px; }
  @keyframes hs-ring { 0% { transform: scale(.4); opacity: 1; } 100% { transform: scale(1.35); opacity: 0; } }

  @media (max-width: 860px) {
    .hs-demo-grid { grid-template-columns: 1fr; gap: 40px; }
  }
  @media (max-width: 600px) {
    .hs-hero { padding: 116px 20px 28px; }
    .hs-demo { padding: 28px 20px 72px; }
    .hs-phone { transform: scale(.92); transform-origin: top center; margin-bottom: -48px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .hs-scene, .hs-sheet, .hs-and-menu { transition: none; }
    .hs-tap::after, .hs-app-new, .hs-app-new::after, .hs-opened.on, .hs-fadein { animation: none; }
  }
`;

const STEP_MS = 3000;
const LAST_MS = 5200;

export default function HomeScreenPage() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState('iphone');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const demoRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Rätt flik från början: Android-telefoner får Android.
  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) setPlatform('android');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  // Spela bara när demon syns.
  useEffect(() => {
    const el = demoRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return undefined;
    const last = step === STEPS[platform].length - 1;
    const t = setTimeout(() => setStep(last ? 0 : step + 1), last ? LAST_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [step, playing, visible, platform]);

  const pick = (p) => { setPlatform(p); setStep(0); setPlaying(true); };
  const jump = (i) => { setStep(i); setPlaying(false); };
  const steps = STEPS[platform];

  return (
    <MarketingLayout>
      <PageMeta
        title="Lägg till Bokix på hemskärmen i iPhone och Android"
        description="Så lägger du Bokix som en app på telefonens hemskärm, på iPhone och Android. Tar tio sekunder, inget att ladda ner, öppnas i helskärm."
        path="/lagg-till-pa-hemskarmen"
      />
      {SCHEMA.map((s, i) => <JsonLd key={i} data={s} />)}
      <KitStyles />
      <style>{CSS}</style>

      <section className="hs-hero">
        <Reveal style={{ maxWidth: '660px', margin: '0 auto' }}>
          <h1 className="kx-h1">Bokix på hemskärmen</h1>
          <p className="kx-lead" style={{ margin: '0 auto' }}>Lägg Bokix som en app på telefonen. Det tar tio sekunder, och du behöver inte ladda ner något.</p>
          <div className="hs-tabs" role="tablist" aria-label="Välj telefon">
            <button type="button" role="tab" aria-selected={platform === 'iphone'} onClick={() => pick('iphone')}>iPhone</button>
            <button type="button" role="tab" aria-selected={platform === 'android'} onClick={() => pick('android')}>Android</button>
          </div>
        </Reveal>
      </section>

      <section className="hs-demo" ref={demoRef}>
        <div className="hs-demo-grid">
          <Phone platform={platform} step={step} />
          <div>
            <h2 className="kx-h2" style={{ marginBottom: 18 }}>{platform === 'iphone' ? 'På iPhone' : 'På Android'}</h2>
            <ol className="hs-steps">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <button type="button" className={i === step ? 'on' : undefined} onClick={() => jump(i)} aria-current={i === step ? 'step' : undefined}>
                    <span><span className="hs-step-t">{s.title}</span><span className="hs-step-b">{s.body}</span></span>
                  </button>
                </li>
              ))}
            </ol>
            {!playing && <button type="button" className="hs-replay" onClick={() => { setStep(0); setPlaying(true); }}>Spela upp igen</button>}
          </div>
        </div>
      </section>

      <section className="kx-section" style={{ background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className="kx-h2" style={{ marginBottom: 18 }}>Vanliga frågor</h2>
          <KitFaq items={FAQ} />
        </div>
      </section>

      <KitCta title="Har du inget konto än?" lead="Prova Bokix gratis i 30 dagar, på telefonen eller datorn.">
        <PrimaryButton onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })}>Kom igång</PrimaryButton>
        <GhostLink to="/guider">Se videoguiderna</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
