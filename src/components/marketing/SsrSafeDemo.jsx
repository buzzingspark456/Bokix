import React from 'react';
import DemoWorkspace from '../DemoWorkspace';
import { IVORY, CARD_BORDER } from './marketingTokens';

// DemoWorkspace monterar HELA den riktiga inloggade appen (Dashboard,
// Fakturor, Recharts-diagram, html2canvas m.m.) — allt sånt förutsätter en
// riktig webbläsar-DOM (ResizeObserver, canvas, window) och kraschar under
// Node-rendering. Den här wrappern gör exakt en sak: `typeof window ===
// 'undefined'` är sant ENDAST under scripts/prerender.mjs:s server-side
// rendering (se den filens kommentar), aldrig i en riktig webbläsare — så
// riktiga besökare får alltid det riktiga, klickbara demot precis som
// förut. Prerenderingen får istället en enkel statisk platshållare, vilket
// är helt ofarligt: main.jsx monterar appen med `createRoot(...).render()`
// (ingen hydrateRoot), så klienten skriver ändå över hela sidan med sitt
// eget, riktiga render-träd så fort JS:en laddat — platshållaren syns bara
// för sökmotor-/AI-crawlers som aldrig kör JS, inte för en enda mänsklig
// besökare.
export default function SsrSafeDemo() {
  if (typeof window === 'undefined') {
    return (
      <div style={{
        border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', background: IVORY,
        padding: '48px 24px', textAlign: 'center', color: 'var(--mkt-muted)', fontSize: '14.5px',
      }}>
        Den interaktiva produktvisningen laddas när sidan öppnas i en webbläsare.
      </div>
    );
  }
  return <DemoWorkspace />;
}
