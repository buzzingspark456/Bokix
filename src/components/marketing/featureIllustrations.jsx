import React from 'react';

// ── Handritade platta vektorillustrationer, en per huvudfunktion — INTE en
// generisk ikon-i-cirkel-chip. Varje illustration bygger en liten "scen" ur
// riktiga produktobjekt (kvitto, faktura, bokslutsmapp, lönebesked) i given
// accentfärg (se marketingTokens.js ACCENT), mot en tonad färgpanel. Ren
// geometri (rects/circles/paths), inga fotorealistiska eller AI-genererade
// bilder. Delad mellan Startsidan (LandingPage.jsx) och Funktioner-sidan
// (FeaturesPage.jsx) så samma fyra bilder aldrig ritas två gånger. ──

export function IllBokforing({ accent }) {
  return (
    <svg viewBox="0 0 200 132" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(34,10) rotate(-5 62 56)">
        <path d="M0 0H124V94L116 102L108 94L100 102L92 94L84 102L76 94L68 102L60 94L52 102L44 94L36 102L28 94L20 102L12 94L4 102L0 94Z" fill="white" stroke="#e7e4db" strokeWidth="1.5" />
        <rect x="16" y="17" width="66" height="7" rx="3.5" fill={accent.fg} />
        <rect x="16" y="34" width="92" height="4" rx="2" fill="#e7e4db" />
        <rect x="16" y="46" width="92" height="4" rx="2" fill="#e7e4db" />
        <rect x="16" y="58" width="58" height="4" rx="2" fill="#e7e4db" />
        <rect x="16" y="76" width="38" height="8" rx="4" fill="#eee8dc" />
      </g>
      <circle cx="152" cy="34" r="21" fill={accent.fg} />
      <path d="M142 34L149 41L162 26" stroke="white" strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IllFakturering({ accent }) {
  return (
    <svg viewBox="0 0 200 132" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(112,50) rotate(8 37 23)">
        <rect x="0" y="0" width="74" height="46" rx="7" fill={accent.fg} />
        <rect x="9" y="11" width="26" height="6" rx="3" fill="white" opacity="0.9" />
        <circle cx="59" cy="31" r="9" fill="white" opacity="0.3" />
      </g>
      <g transform="translate(28,10)">
        <rect x="0" y="0" width="112" height="98" rx="9" fill="white" stroke="#e7e4db" strokeWidth="1.5" />
        <rect x="15" y="15" width="42" height="8" rx="4" fill={accent.fg} />
        <rect x="15" y="36" width="84" height="4" rx="2" fill="#e7e4db" />
        <rect x="15" y="48" width="84" height="4" rx="2" fill="#e7e4db" />
        <rect x="15" y="60" width="60" height="4" rx="2" fill="#e7e4db" />
        <line x1="15" y1="75" x2="97" y2="75" stroke="#e7e4db" strokeWidth="1.5" />
        <rect x="68" y="83" width="29" height="10" rx="5" fill={accent.fg} />
      </g>
    </svg>
  );
}

export function IllSkatt({ accent }) {
  return (
    <svg viewBox="0 0 200 132" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(28,26)">
        <path d="M0 10a8 8 0 0 1 8-8h28l10 12h58a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8Z" fill="white" stroke="#e7e4db" strokeWidth="1.5" />
        <rect x="14" y="32" width="66" height="4" rx="2" fill="#e7e4db" />
        <rect x="14" y="44" width="66" height="4" rx="2" fill="#e7e4db" />
        <rect x="14" y="56" width="44" height="4" rx="2" fill="#e7e4db" />
      </g>
      <g transform="translate(122,14)">
        <path d="M29 0 35 9 46 6 44 17 53 23 44 29 46 40 35 37 29 46 23 37 12 40 14 29 5 23 14 17 12 6 23 9Z" fill={accent.fg} />
        <path d="M20 23 27 30 40 14" stroke="white" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function IllPersonal({ accent }) {
  return (
    <svg viewBox="0 0 200 132" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <circle cx="156" cy="28" r="18" fill={accent.fg} opacity="0.85" />
      <circle cx="174" cy="46" r="13" fill={accent.fg} opacity="0.4" />
      <g transform="translate(26,16)">
        <rect x="0" y="0" width="104" height="92" rx="9" fill="white" stroke="#e7e4db" strokeWidth="1.5" />
        <circle cx="25" cy="26" r="13" fill={accent.fg} />
        <rect x="45" y="19" width="46" height="6" rx="3" fill={accent.fg} />
        <rect x="45" y="31" width="30" height="4" rx="2" fill="#e7e4db" />
        <line x1="12" y1="52" x2="92" y2="52" stroke="#e7e4db" strokeWidth="1.5" />
        <rect x="12" y="62" width="36" height="5" rx="2.5" fill="#e7e4db" />
        <rect x="60" y="61" width="32" height="11" rx="5.5" fill={accent.fg} />
      </g>
    </svg>
  );
}
