# Produktionsberedskap — statusgenomgång

Den här filen svarar på en generell "produktionsberedskap"-checklista (~26
punkter, säkerhet/testning/resiliens/dokumentation) applicerad på Bokix.
Skriven 2026-08-17 efter en genomgång av kodbasen. Syftet är att vara
ärlig om vad som redan är på plats, vad som fixades i den här omgången,
och vad som medvetet är avvaktat — inte att bocka av varje punkt oavsett
om den är relevant.

## Redan på plats (ingen ändring behövdes)

- **Secrets management** — `.env` gitignorat, `STRIPE_SECRET_KEY` separat
  från publika `VITE_`-nycklar (se kommentar i [server.js](../server.js)),
  två Resend-nycklar med olika behörighet (sending vs. domänhantering).
- **HTTPS/TLS** — hanteras av Vercel (automatisk cert-rotation), HSTS-header
  satt explicit i [api/_security.js](../api/_security.js).
- **Rate limiting** — på plats för lokala dev-servern (`express-rate-limit`,
  striktare på Stripe/e-post-rutter). **Gap:** saknas för de faktiska
  produktions-serverless-funktionerna under `api/*.js`, eftersom var och en
  saknar delad state mellan anrop. Redan flaggat i koden som medveten
  uppföljning — kräver en extern datastore (Upstash Redis) eller Vercels
  Firewall-produkt, ett infrastrukturval jag inte tar åt mig att göra å
  dina vägar.
- **Multi-tenancy / dataisolering** — Supabase RLS på `user_data`
  (`auth.uid() = user_id` på samtliga CRUD-policyer), samt per-användarmapp
  i Storage-buckets (`(storage.foldername(name))[1] = auth.uid()`), se
  [supabase-setup.sql](../supabase-setup.sql).
- **Auth/session/token expiry** — Supabase-klienten hanterar JWT-refresh
  och sessionsutgång automatiskt (standardbeteende, ingen egen kod
  behövs eller bör skrivas för det).
- **PII/dataretention** — `data/` (riktig exporterad kunddata) är
  gitignorad explicit med kommentar om varför. Cookiebanner, cookiepolicy
  och integritetspolicy finns redan som egna sidor/komponenter.
- **Input-injektion** — ingen `dangerouslySetInnerHTML` någonstans i
  `src/`. Alla Vercel-rutter validerar body-fält innan de används.
- **Race conditions** — `set_company_stripe_account` (Postgres-funktion)
  gör en atomär `jsonb_set` istället för läs–ändra–skriv i
  applikationskod, med kommentar om varför.
- **Graceful degradation** — Stripe/Resend-rutter svarar 503 med tydligt
  svensk felmeddelande om nycklar saknas, istället för att krascha.
  E-postutskick med kunds egen domän faller tillbaka till systemadress vid
  fel (se `resolveSenderAddress`/`sendViaResend` i server.js).

## Fixat i den här omgången

- **Testning (var helt frånvarande)** — `vitest` installerat, `npm test`
  tillagt. Skrev 47 enhetstester över de mest finansiellt känsliga rena
  funktionerna (fel här = fel skatt/moms/fakturanummer för en riktig
  kund):
  - [personnummer.test.js](../src/utils/personnummer.test.js) — format,
    Luhn-kontroll, samordningsnummer, ogiltiga datum.
  - [vatCalculation.test.js](../src/utils/vatCalculation.test.js) —
    momsberäkning per period, obalanserade verifikationer, saknad
    momsrad, kvartalsintervall.
  - [validators.test.js](../src/utils/validators.test.js) — e-post,
    IBAN (mod-97-kontrollsumma).
  - [verificationAmounts.test.js](../src/utils/verificationAmounts.test.js)
    — regression för den tidigare sträng-adderings-buggen.
  - [invoiceNumbering.test.js](../src/utils/invoiceNumbering.test.js) —
    kollisionssäker fakturanumrering.

  Detta är en start, inte full täckning — se "Avvaktat" nedan.

- **Dependency scanning** — kört `npm audit`. Ett fynd (inaktuell
  `react-router-dom`) fanns redan på senaste 6.x-versionen; det krävs en
  major-uppgradering till 7.x för fixen (se nedan).

## Medvetet avvaktat (och varför)

- **`npm audit`: 4 sårbarheter kvar (1 kritisk, 3 måttliga)** — båda
  kräver en brytande major-uppgradering av ett kärnbibliotek jag inte vill
  byta blint utan att kunna klicka igenom appen efteråt:
  - `dompurify` (via `jspdf` → 4.2.1): sårbarheterna sitter alla i
    jsPDF:s `.html()`-renderingsväg. Koden använder aldrig den — samtliga
    5 PDF-exportfilerna (`agiExport.js`, `exportInvoicePdf.js`, m.fl.)
    bygger PDF:er med text/tabell-API:er, inte `.html()`. Verklig
    exponering just nu bedöms som låg, men flaggas här istället för att
    tystas ner.
  - `react-router-dom` 6.x → 7.x: open redirect-sårbarheten kräver att en
    `Link`/`navigate()`-destination byggs från användarstyrd indata —
    grepp genom `App.jsx` visar bara hårdkodade navigeringsmål, så samma
    låga-exponering-bedömning. En 6→7-uppgradering rör hela routingen i
    appen; bör göras med en människa som klickar igenom flödena efteråt,
    inte som en tyst rad i ett audit-svep.
- **Load/stress-testning, chaos engineering, RTO/RPO, DR-plan** — kräver
  en driftsatt miljö, monitoring och organisatoriska beslut (vem är
  on-call, vilken nedtid är acceptabel) som ligger utanför vad kod i det
  här repot kan svara på. Rätt nästa steg när/om appen har riktiga
  användare, inte innan.
- **Circuit breakers, cachningsstrategi** — appen anropar ett fåtal
  externa API:er (Stripe, Resend, Supabase) utan höga volymer eller
  kedjade beroenden ännu; att bygga circuit breakers/cache-lager nu vore
  komplexitet utan ett verkligt problem att lösa.
- **Coverage-trösklar i CI, kodgranskningsstandard** — det finns ingen
  CI-pipeline i repot att sätta en tröskel i. `npm test` körs nu lokalt;
  att koppla in CI (GitHub Actions) är ett rimligt nästa steg men är ett
  separat, uttryckligt beslut (kräver t.ex. att välja var/hur det körs).
- **Regulatorisk efterlevnad** — GDPR är relevant (svenskt företag,
  persondata) och grunderna finns redan (cookiebanner, integritetspolicy,
  RLS-isolerad data, gitignorad kunddata). **HIPAA gäller inte** — det är
  amerikansk lagstiftning för sjukvårdsdata, inte tillämplig på svensk
  bokföring.
- **Tillgänglighet (a11y)** — ingen audit gjord i den här omgången; kräver
  en egen genomgång (skärmläsare, kontrast, tangentbordsnavigering) som
  jag inte vill göra ytligt.
- **Arkitekturdiagram/ADR:er** — finns inte ännu. Kodkommentarerna i
  server.js/api/_security.js/supabase-setup.sql fungerar redan som
  de facto-ADR:er för enskilda beslut (Swedish, punktvis, med motivering)
  men är inte samlade på ett ställe.

## Nästa steg, prioritetsordning

1. Klicka igenom appen manuellt (eller med `/run`) efter en
   `react-router-dom`-uppgradering till 7.x, i en egen commit.
2. Sätt upp en enkel CI-workflow som kör `npm test` + `npm run lint` på
   varje push/PR.
3. Bygg ut testtäckningen till fler `src/utils`-filer
   (`payrollCalculation.js`, `sieExport.js`, `reportCalculations.js`).
4. Om/när appen får riktiga betalande kunder: rate limiting på
   `api/*.js` (Upstash Redis), och en enkel DR-plan (vad händer om
   Supabase eller Vercel har driftstopp).
