# Svenska lagar och krav

Förteckning över lagar, föreskrifter och avtal som påverkar
informationssäkerheten (åtgärd 5.31 i SS-ISO/IEC 27002:2022). Version 1,
2026-10-18. Ses över varje år och när en lag ändras. Detta är ingen juridisk
rådgivning; punkter märkta **Kontrollera** bör stämmas av med jurist eller
revisor.

## Bokföringslagen (1999:1078)

Kunderna är bokföringsskyldiga; Bokix är verktyget och lagringen. Kraven
träffar därför kunden, men Bokix måste göra det möjligt att följa dem.

| Krav | Vad det betyder för Bokix | Hur det uppfylls | Status |
|---|---|---|---|
| Räkenskapsinformation bevaras till och med sjunde året efter kalenderåret då räkenskapsåret avslutades (7 kap. 2 §) | Kundens data får inte försvinna när kunden slutar betala eller avslutar | Sjuårsarkivet (api/_archive.js), gallring bara efter arkiv, docs/DATA_RETENTION.md | Införd |
| Informationen ska bevaras varaktigt, läsbar och i ursprungligt skick | Ändringar ska synas, inte skriva över | Verifikationer rättas med ny verifikation, låsta år, export (SIE, PDF) | Införd |
| Behandlingshistorik och systemdokumentation (5 kap. 11 §) | Kunden ska kunna visa hur bokföringen gjorts i programmet | Händelselogg (audit_log), verifikationsserier. Systemdokumentation för kunderna saknas | Delvis (Å20) |
| Förvaring i annat EU/EES-land: anmälan till Skatteverket, omedelbar elektronisk åtkomst och utskrift i Sverige på begäran (7 kap. 3 a §). Utanför EES krävs tillstånd (7 kap. 4 §) | Kundernas data ligger sedan 2026-10-20 i Supabase i Stockholm (eu-north-1), alltså i Sverige. Ingen anmälan behövs | Se nedan | Införd (Å18) |
| Pappersunderlag får förstöras när det överförts till elektronisk form (sedan 2024-07-01) | Fotograferade kvitton ska vara läsbara | Bildkvaliteten vid krympning (3,5 megapixel) är vald för att texten ska gå att läsa | Införd |

**Förvaring utomlands.** Löst 2026-10-20 genom att hela Supabase-projektet
flyttades till Stockholm; texten nedan är bakgrunden till beslutet.
 Skatteverkets ställningstagande 2025-05-27 (dnr
8-186619-2025): om elektroniska handlingar först förvaras i ett EES-land och
sedan, inom 24 timmar och i oförändrat skick, även förvaras i Sverige, räknas
det som synkron replikering till Sverige och någon anmälan enligt 7 kap. 3 a §
behövs inte. Åtgärd Å18: låt nattkopian (databasen och filerna) gå till en
lagringstjänst med datacenter i Sverige, varje dygn. Då behöver kunderna inte
anmäla något.

**Kontrollera** med revisor: om en krypterad kopia räknas som "oförändrat
skick" (innehållet är oförändrat och Bokix kan dekryptera den direkt), och
om kopian måste innehålla även sådant som inte är räkenskapsinformation.
Till dess Å18 är klar bör villkoren eller hjälpsidorna säga att datan lagras
inom EU och att kunden själv ansvarar för anmälan.

## Bokföringsnämnden

BFNAR 2013:2 Bokföring (allmänna råd om bland annat verifikationer,
systemdokumentation och arkivering). Används som tolkning av
bokföringslagen ovan.

## Dataskyddsförordningen (GDPR) och dataskyddslagen (2018:218)

| Krav | Vad det betyder för Bokix | Hur det uppfylls | Status |
|---|---|---|---|
| Roller | Personuppgiftsansvarig för kundkonton; personuppgiftsbiträde för kundernas bokföring (anställda, kunder, leverantörer) | Integritetspolicy och biträdesavtal i villkoren | Delvis |
| Biträdesavtal med kunderna (art. 28) | Kunden ska ha ett avtal med Bokix | Biträdesavtal i villkoren, ogranskat av jurist | Delvis |
| Avtal med underbiträden (art. 28.4) | Supabase, Vercel, Stripe, Resend, Cloudflare m.fl. | Leverantörernas DPA:er godkänns och sparas | Saknas (Å12) |
| Registerförteckning (art. 30) | Vilka personuppgifter, varför, hur länge, vilka mottagare | Saknas som eget dokument | Saknas (Å21) |
| Säkerhet i behandlingen (art. 32) | Lämpliga tekniska och organisatoriska åtgärder | Hela detta ledningssystem | Delvis |
| Personuppgiftsincident: anmälan till IMY inom 72 timmar (art. 33), information till de registrerade vid hög risk (art. 34); som biträde: meddela kunden utan onödigt dröjsmål | Incidentrutin | 05-rutiner.md, Incidenter | Införd |
| Överföring till tredje land (art. 44 och följande) | Vercel, Stripe, Google, Microsoft och Cloudflare är amerikanska bolag. Kräver EU-US Data Privacy Framework eller standardavtalsklausuler | Kontrollera per leverantör i 06-register.md, och att Vercels funktioner körs i EU (Å19) | Delvis |
| Personnummer får behandlas utan samtycke bara när det är klart motiverat (dataskyddslagen 3 kap. 10 §) | Personnummer används för lön (AGI), delägare (INK4) och NE | Bara där Skatteverket kräver det; visas inte i onödan | Införd |
| Lagringsminimering (art. 5.1 e) mot bokföringslagens arkivkrav | Arkivkravet vinner för räkenskapsinformation, minimering för resten | docs/DATA_RETENTION.md, gallringsjobbet | Införd |

## Lagen (2022:482) om elektronisk kommunikation

Kakor och liknande som inte är nödvändiga kräver samtycke (9 kap. 28 §).
Uppfylls med cookiebannern; analys (GA4, PostHog, Clarity) laddas först efter
samtycke. Status: Införd.

## Cybersäkerhetslagen (NIS2)

Den svenska lagen som genomför NIS2-direktivet gäller sedan januari 2026.
Den omfattar i huvudsak medelstora och stora verksamheter (minst 50 anställda
eller över 10 miljoner euro i omsättning) i vissa sektorer. Bokix omfattas
sannolikt inte i dag. **Kontrollera** varje år (tillsyn: Myndigheten för
civilt försvar) och om kunder som omfattas ställer krav i avtal.

## Skatteförfarandelagen (2011:1244)

Kunderna lämnar deklarationer och arbetsgivardeklarationer med filer som
Bokix tar fram. Fel i en fil kan ge kunden fel skatt. Hanteras som
riktighetsrisk (R16): tester och prov i Skatteverkets testtjänst innan en ny
filtyp används.

## Brottsbalken och lagen om företagshemligheter

- Dataintrång (brottsbalken 4 kap. 9 c §) polisanmäls, se incidentrutinen.
- Lagen (2018:558) om företagshemligheter skyddar Bokix källkod och
  kundernas uppgifter; sekretessavtal (åtgärd 6.6) gör skyddet tydligt.

## Avtal

| Avtal | Krav | Status |
|---|---|---|
| Kundvillkor och integritetspolicy | Lovar biträdesavtal, EU-lagring, sju års arkiv, export | Ogranskade av jurist (se rekommendationslistan) |
| Leverantörernas villkor | Följs; säkerhetsansvar delat enligt varje tjänst | 06-register.md |
