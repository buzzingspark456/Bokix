# Riskhantering

Avsnitt 6.1.2, 6.1.3, 8.2 och 8.3 i ISO/IEC 27001:2022. Första bedömningen
gjord 2026-10-18. Ska godkännas av båda grundarna.

## Metod

Varje risk bedöms på två skalor, 1–5:

| Värde | Sannolikhet | Konsekvens |
|---|---|---|
| 1 | Mindre än en gång på tio år | Ingen kund märker något |
| 2 | En gång på 5–10 år | Enstaka kund störs kort, ingen data förlorad |
| 3 | En gång på 1–5 år | Flera kunder störs eller enstaka kunds data röjs/skadas, går att rätta |
| 4 | Ungefär en gång per år | Många kunder drabbas, anmälan till IMY, förtroendeskada |
| 5 | Flera gånger per år | Kunddata förlorad eller röjd i stor skala, företaget hotas |

Risknivå = sannolikhet × konsekvens.

| Nivå | Beslut |
|---|---|
| 1–6 | Godtas. Ses över vid nästa årliga bedömning |
| 8–12 | Ska åtgärdas enligt åtgärdsplanen, eller godtas uttryckligen av båda grundarna med motivering |
| 15–25 | Ska åtgärdas först. Får inte godtas utan att nivån sänks |

Riskägare är den som ansvarar för åtgärden. Bedömningen görs om minst en gång
per år, efter varje allvarlig incident och när en ny leverantör eller en
funktion som hanterar en ny sorts data läggs till.

## Riskregister

S = sannolikhet, K = konsekvens, N = nivå. "Efter" är bedömd nivå när
åtgärderna i planen är gjorda.

| Nr | Risk | S | K | N | Befintliga skydd | Behandling | Efter |
|---|---|---|---|---|---|---|---|
| R1 | Någon tar över ett adminkonto hos GitHub, Vercel, Supabase, Stripe, Cloudflare eller Google och kommer åt all kunddata eller koden | 3 | 5 | 15 | Starka lösenord (antas) | Åtgärda: tvåfaktor med passkey överallt, egna jobbkonton, adminpanelen kräver tvåfaktor (Å1, Å2, Å3) | 5 |
| R2 | En hemlig nyckel läcker (service role-nyckeln, R2-nyckeln, Stripe) | 3 | 5 | 15 | Nycklar bara i Vercel och lokal .env, .env i .gitignore | Åtgärda: rulla R2-nyckeln som klistrats i en chatt, nyckelrutin, hemlighetsskanning i GitHub (Å4, Å5) | 5 |
| R3 | Nattkopior och återställning fungerar inte när de behövs | 3 | 5 | 15 | Krypterad nattkopia till R2, sjuårsarkiv, kopia vid krympning (user_data_history) | Åtgärda: återställningsprov varje kvartal, Supabase Pro för egna säkerhetskopior (Å6, Å7) | 5 |
| R4 | Nätfiske mot en grundare ger angriparen inloggning | 4 | 4 | 16 | Inga särskilda | Åtgärda: passkeys (nätfiskesäkra), årlig genomgång, lösenordshanterare (Å1, Å13) | 6 |
| R5 | Ett fel vid sparning skriver över eller tappar en kunds bokföring | 3 | 4 | 12 | Villkorad sparning med sammanslagning, ändringssparning, kopia vid krympning, tester | Åtgärda: återställningsprov per kund (Å6) | 6 |
| R6 | En kund ser en annan kunds data (fel i radnivåskydd eller i api/) | 2 | 5 | 10 | RLS på alla tabeller, provat med anon-nyckeln 2026-10-01, behörighetskontroller i api/company-access.js | Åtgärda: automatiskt RLS-test i CI (Å8) | 5 |
| R7 | En kunds konto tas över (lösenordsgissning, återanvänt lösenord) | 3 | 4 | 12 | Delad rate limit, Turnstile, tvåfaktor och passkeys finns för kunden | Åtgärda: skydd mot läckta lösenord (kräver Supabase Pro) (Å7) | 8 |
| R8 | Ett npm-paket har en känd sårbarhet eller är kapat | 3 | 4 | 12 | package-lock.json, CI kör tester och bygge | Åtgärda: Dependabot och npm audit i CI (Å9) | 6 |
| R9 | En grundares dator eller telefon blir stulen eller förlorad med inloggade sessioner | 3 | 4 | 12 | Okänt | Åtgärda: diskkryptering, skärmlås, fjärradering (Å10) | 4 |
| R10 | Kod skriven med AI-verktyg innehåller en säkerhetsbrist som inte upptäcks | 3 | 4 | 12 | Tester (över 1 500), app-harness-skript | Åtgärda: säkerhetsgranskning före större ändringar i api/ och SQL (Å11) | 6 |
| R11 | Personuppgiftsbiträdesavtal saknas med leverantörer, trots att integritetspolicyn lovar dem | 4 | 3 | 12 | Leverantörerna har standard-DPA:er | Åtgärda: godkänn och spara DPA för varje leverantör (Å12) | 3 |
| R12 | Angripare med en läckt nyckel raderar både databasen och kopiorna (utpressning) | 2 | 5 | 10 | Kopian ligger hos annan leverantör (Cloudflare) med egen nyckel | Åtgärda: versionering eller låsning av objekt i R2-bucketen (Å14) | 5 |
| R13 | Supabase eller Vercel ligger nere en längre tid | 2 | 4 | 8 | Kopian i R2, appen visar fel tydligt, localStorage-kopia i webbläsaren | Åtgärda: extern upptidsövervakning, beskriven reservplan (Å15) | 6 |
| R14 | En grundare blir sjuk eller lämnar, och den andra saknar åtkomst eller kunskap | 2 | 4 | 8 | Båda har konton, koden och dokumenten i git | Åtgärda: båda har åtkomst till allt via delat valv i lösenordshanteraren (Å13) | 4 |
| R15 | En personuppgiftsincident upptäcks men anmäls inte inom 72 timmar | 2 | 4 | 8 | Larmmejl vid systemfel (logSystemEvent) | Åtgärda: incidentrutinen i 05-rutiner.md, en övning per år (Å16) | 4 |
| R16 | Fel i moms- eller skatteberäkning ger kunden fel deklaration | 3 | 3 | 9 | Tester, filer provade i Skatteverkets testtjänst (AGI, INK4) | Godtas med befintliga skydd plus prov av NE-filen i december (Å17) | 6 |
| R17 | Inbjuden konsult har kvar åtkomst efter att uppdraget slutat | 3 | 3 | 9 | Kunden kan ta bort medlemmar; borttagen inbjudan raderas | Godtas: kundens ansvar enligt villkoren. Ses över årligen | 9 |
| R18 | Räkenskapsinformation raderas för tidigt eller sparas för länge | 2 | 4 | 8 | Sjuårsarkiv, gallringsjobb (api/cron/data-retention.js), DATA_RETENTION.md | Godtas med befintliga skydd | 8 |
| R19 | Sessionsinspelning (Clarity) eller analys fångar känsliga uppgifter | 2 | 3 | 6 | Text maskeras, samtycke för analys, PostHog bara sidvisningar | Godtas | 6 |
| R21 | Kundernas räkenskapsinformation förvaras i Tyskland (Supabase Frankfurt) utan att kunderna anmält det till Skatteverket (bokföringslagen 7 kap. 3 a §) | 4 | 3 | 12 | Data inom EU, nattkopia i EU | Åtgärda: daglig kopia till lagring i Sverige enligt Skatteverkets ställningstagande 2025-05-27 (Å18) | 3 |
| R22 | Personuppgifter behandlas i USA utan giltig grund (Vercels funktioner, amerikanska leverantörer) | 3 | 3 | 9 | Leverantörerna har DPF eller standardavtalsklausuler (ej kontrollerat) | Åtgärda: kontrollera per leverantör, kör Vercels funktioner i EU (Å12, Å19) | 4 |
| R20 | Överbelastning eller kostnadsattack mot Vercel | 2 | 3 | 6 | Vercels skydd, kostnadstak 50 dollar som pausar produktionen | Godtas | 6 |

## Åtgärdsplan

Status: Öppen, Pågår, Klar (med datum och bevis i bevisloggen).

| Nr | Åtgärd | Risker | Ansvarig | Klart senast | Status |
|---|---|---|---|---|---|
| Å1 | Tvåfaktor med passkey eller app (inte sms) på alla adminkonton: GitHub, Vercel, Supabase, Stripe, Cloudflare, Resend, Google, one.com, FöretagsAPI. Spara skärmdump per tjänst | R1, R4 | Grundarna | 2026-11-15 | Öppen |
| Å2 | Byt adminkontona i ADMIN_EMAILS från privata Gmail till @bokix.se-adresser (Google Workspace) med tvåfaktor | R1 | Grundarna, sedan kod | 2026-12-31 | Öppen |
| Å3 | Adminpanelen /internal och api/admin kräver inloggning med tvåfaktor (aal2) eller passkey | R1 | Kod | 2026-11-30 | Öppen |
| Å4 | Rulla R2-nyckeln (klistrades i en chatt 2026-10-01) och uppdatera OFFSITE_S3_* i Vercel | R2 | Grundarna | 2026-10-31 | Öppen |
| Å5 | Slå på secret scanning och push protection i GitHub-repot | R2 | Grundarna | 2026-11-15 | Öppen |
| Å6 | Återställningsprov: återställ ett företag från nattkopian till ett testkonto (scripts/restore-offsite-backup.mjs), protokollför tid och resultat. Varje kvartal | R3, R5 | Driftansvarig | 2026-11-30, sedan kvartalsvis | Öppen |
| Å7 | Uppgradera till Supabase Pro, slå på skydd mot läckta lösenord, kontrollera dagliga säkerhetskopior | R3, R7 | Grundarna | Före 250 kunder | Öppen |
| Å8 | Automatiskt test i CI som provar radnivåskyddet mot en testdatabas | R6 | Kod | 2027-01-31 | Öppen |
| Å9 | Dependabot för npm och GitHub Actions, npm audit --audit-level=high i CI | R8 | Kod | 2026-11-15 | Klar 2026-10-18 (npm audit fix: 2 kritiska, 1 hög åtgärdade) |
| Å10 | Diskkryptering (BitLocker/FileVault), skärmlås efter högst 5 minuter, uppdateringar på, Hitta min enhet på telefoner. Notera per enhet i 06-register.md | R9 | Grundarna | 2026-11-15 | Öppen |
| Å11 | Säkerhetsgranskning (/security-review eller motsvarande) före varje ändring i api/, SQL-filer eller inloggning; notera i commit-meddelandet | R10 | Kod | Från och med nu | Öppen |
| Å12 | Godkänn och spara personuppgiftsbiträdesavtal med Supabase, Vercel, Stripe, Resend, Cloudflare, Google, PostHog, Microsoft (Clarity) | R11 | Dataskydd | 2026-12-31 | Öppen |
| Å13 | Lösenordshanterare med ett delat valv för alla Bokix-konton och nödkoder | R4, R14 | Grundarna | 2026-11-15 | Öppen |
| Å14 | Versionering eller objektlås på R2-bucketen bokix-backup, så en raderad kopia går att få tillbaka | R12 | Driftansvarig | 2026-12-31 | Öppen |
| Å15 | Extern upptidsövervakare mot https://www.bokix.se/api/health med larm till båda | R13 | Driftansvarig | 2026-11-15 | Öppen |
| Å16 | Incidentövning: gå igenom ett påhittat läckage enligt incidentrutinen, notera lärdomar | R15 | Informationssäkerhetsansvarig | 2027-03-31 | Öppen |
| Å18 | Nattkopian (databas och filer) till en lagringstjänst med datacenter i Sverige, inom 24 timmar, så kunderna slipper anmälan enligt bokföringslagen 7 kap. 3 a §. Stäm av med revisor att krypterad kopia räknas | R21 | Grundarna (val av tjänst), sedan kod | 2027-01-31 | Öppen |
| Å19 | Kontrollera i Vercel vilken region funktionerna körs i och sätt Frankfurt eller Stockholm i vercel.json | R22 | Kod | 2026-11-15 | Klar 2026-10-18 (var iad1 i USA, nu fra1) |
| Å20 | Systemdokumentation för kunderna (bokföringslagen 5 kap. 11 §): hur verifikationer, serier, rättelser, låsning och arkiv fungerar i Bokix, som hjälpsida | R18 | Kod | 2027-03-31 | Öppen |
| Å21 | Registerförteckning enligt GDPR art. 30 | R11 | Dataskydd | 2026-12-31 | Öppen |
| Å17 | Prova NE-SRU-filen i Skatteverkets testtjänst när 2026P4 öppnar | R16 | Grundarna | 2027-01-15 | Öppen |

## Godtagna risker

Båda grundarna godtar risker R17–R20 på nivåerna ovan.

Signatur: ____________________ ____________________ Datum: __________
