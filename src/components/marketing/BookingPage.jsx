import React, { useState } from 'react';
import { Video, ExternalLink } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { PageMeta } from '../../utils/seo';

// Kundens ursprungliga korta länk — funkar fint som vanlig länk (öppnas i ny
// flik), används bara som reservlänk under iframen nedan om någon har en
// blockerare eller webbläsarinställning som stoppar Google-iframen.
const BOOKING_SHORT_URL = 'https://calendar.app.google/kiPs7EEUFvnNWeec8';

// Google Calendar Appointment Schedule, bäddas in direkt nedan istället för
// att skicka besökaren till en annan sida (tidigare öppnades bara
// BOOKING_SHORT_URL i en ny flik, se git-historiken för MarketingLayout.jsx).
//
// VARFÖR just den här längre URL:en och inte kundens korta länk ovan: den
// korta länken svarar SJÄLV med "X-Frame-Options: SAMEORIGIN" på sin egen
// 302-omdirigering — en webbläsare vägrar rendera DEN responsen i en iframe
// redan innan den hinner följa omdirigeringen vidare, oavsett vad den pekar
// på. Den faktiska destinationssidan nedan (calendar.google.com/calendar/
// appointments/schedules/...) skickar däremot varken X-Frame-Options eller
// någon frame-ancestors-CSP (verifierat med `curl -sD -` mot båda stegen
// 2026-08-28) — så genom att peka iframen direkt på destinationen istället
// för på omvägen via den korta länken, fungerar inbäddningen fint.
//
// Om kunden någon gång bygger om sitt bokningsschema i Google Kalender
// (ny schemal-URL) måste konstanten uppdateras på samma sätt:
// `curl -sD - -o /dev/null <BOOKING_SHORT_URL>` och läs av den NYA
// Location-headern i svaret.
//
// `?hl=sv` i slutet tvingar Googles UI till svenska — annars visas den på
// engelska (bl.a. "10:00am"/"9:00pm" istället för svenskans 24-timmarsformat
// "10:00"/"21:00"), verifierat med en Playwright-probe mot sidan.
const BOOKING_EMBED_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1yaOxguHUd877kkjZUSI3Sj0UaBNNDTtsEP7h5twjejsj81XS1xfgHXL0uX3wgg1ZZrA7TxVem?hl=sv';

export default function BookingPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <MarketingLayout>
      <PageMeta
        title="Boka en genomgång | Bokix"
        description="Boka en kostnadsfri, personlig genomgång av Bokix — 20–30 minuter, inga förpliktelser. Välj en ledig tid direkt här på sidan."
        path="/boka-genomgang"
      />
      <style>{`
        @keyframes bookingSpin { to { transform: rotate(360deg); } }
        .booking-spin { animation: bookingSpin 0.8s linear infinite; }
        .booking-fallback-link { transition: color 0.15s; }
        .booking-fallback-link:hover { color: ${BRAND.green} !important; }
      `}</style>

      <section style={{ padding: '150px 24px 40px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 60, height: 60, borderRadius: '17px', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Video size={26} color="white" />
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.16 }}>
            Boka en genomgång
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.75 }}>
            20–30 minuter, inga förpliktelser. Vi visar dig runt i Bokix live och svarar på det du undrar över. Välj en ledig tid nedan.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div
            style={{
              position: 'relative',
              // Fast vitt (INTE var(--mkt-card-bg), som blir mörkgrön i mörkt
              // tema) — Googles bokningssida målar sin EGEN bakgrund
              // transparent när den körs inbäddad i en iframe (bekräftat med
              // en Playwright-probe: identisk sida, identisk `?hl=sv`-URL,
              // men transparent body bara i iframe-läge, inte vid vanlig
              // navigering). Den antar då att den ligger ovanpå en ljus sida
              // och ritar sin text i en mörk färg som är i praktiken
              // osynlig mot en mörk bakgrund. Vi kan inte styra det (annan
              // origin, ingen CSS-åtkomst) — enda robusta fixen är att alltid
              // ge den en vit bakgrund att stå på, oavsett Bokix eget tema.
              background: '#ffffff',
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: '22px',
              boxShadow: CARD_SHADOW,
              overflow: 'hidden',
              height: 'clamp(600px, 82vh, 800px)',
            }}
          >
            {!loaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${BRAND.greenLight}`, borderTopColor: BRAND.green }} className="booking-spin" />
              </div>
            )}
            <iframe
              src={BOOKING_EMBED_URL}
              title="Boka en genomgång"
              onLoad={() => setLoaded(true)}
              style={{ width: '100%', height: '100%', border: 'none', opacity: loaded ? 1 : 0, transition: 'opacity 0.25s' }}
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: MUTED }}>
            Visas inte bokningskalendern ovan?{' '}
            <a
              href={BOOKING_SHORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="booking-fallback-link"
              style={{ color: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              Öppna den i en ny flik <ExternalLink size={12} />
            </a>
          </p>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
