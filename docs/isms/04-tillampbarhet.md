# Tillämpbarhetsförklaring (Statement of Applicability)

Alla 93 åtgärder i bilaga A till ISO/IEC 27001:2022, med beslut om de gäller
för Bokix, hur de uppfylls och var beviset finns. Åtgärdernas namn följer den svenska
utgåvan SS-ISO/IEC 27002:2022 (SIS); beskrivningarna är egna. Version 1, 2026-10-18.

Status: **Införd**, **Delvis** (finns men saknar rutin eller bevis), **Saknas**,
**Ej tillämplig**. Å-nummer hänvisar till åtgärdsplanen i
[03-riskhantering.md](03-riskhantering.md#åtgärdsplan).

## 5 Organisatoriska åtgärder

| Nr | Åtgärd | Gäller | Hur Bokix uppfyller den | Status | Bevis |
|---|---|---|---|---|---|
| 5.1 | Policyer för informationssäkerhet | Ja | Policy i 02, områdesrutiner i 05 | Delvis | Signerad policy saknas |
| 5.2 | Roller och ansvar för informationssäkerhet | Ja | Rolltabell i 02 | Delvis | Namn fylls i |
| 5.3 | Uppdelning av arbetsuppgifter och ansvar | Ja | Två personer; känsliga åtgärder meddelas den andra och loggas | Delvis | 05 Behörigheter |
| 5.4 | Ledningens ansvar | Ja | Grundarna är ledning och godkänner policy och risker | Delvis | Protokoll från ledningens genomgång |
| 5.5 | Kontakt med myndigheter | Ja | IMY för personuppgiftsincidenter, polisen vid brott, Skatteverket | Införd | 05 Incidenter |
| 5.6 | Kontakt med särskilda intressegrupper | Ja | Följer CERT-SE, leverantörernas säkerhetsnyheter | Delvis | Prenumerationer noteras i 06 |
| 5.7 | Hotunderrättelser | Ja | CERT-SE, GitHub-varningar, Supabase och Vercels statusflöden | Delvis | Å9 |
| 5.8 | Informationssäkerhet i projektledning | Ja | Säkerhetsgranskning före ändringar i api/, SQL och inloggning | Delvis | Å11 |
| 5.9 | Förteckning över information och andra relaterade tillgångar | Ja | Tillgångsregister i 06 | Införd | 06 |
| 5.10 | Tillåten användning av information och andra relaterade tillgångar | Ja | Regler för enheter och konton i 05 | Delvis | 05 Enheter |
| 5.11 | Återlämnande av tillgångar | Ja | Rutin när någon lämnar Bokix i 05 | Delvis | 05 Personal |
| 5.12 | Informationsklassning | Ja | Tre nivåer: Öppen, Intern, Konfidentiell | Införd | 05 Klassning |
| 5.13 | Märkning av information | Ja | Konfidentiellt lagras bara i Supabase/R2; exporter märks med företagsnamn | Delvis | 05 Klassning |
| 5.14 | Informationsöverföring | Ja | Endast HTTPS (HSTS), lönebesked i lösenordsskyddad PDF, delning med konsult via inbjudan | Införd | api/_security.js, vercel.json |
| 5.15 | Åtkomstkontroll | Ja | Radnivåskydd i databasen, behörighet per sida för inbjudna | Införd | supabase-setup.sql, src/utils/pageAccess.js |
| 5.16 | Identitetshantering | Ja | Ett konto per person; inga delade konton hos leverantörer | Delvis | Å2 |
| 5.17 | Autentiseringsinformation | Ja | Supabase Auth, passkeys, tvåfaktor för kunder; lösenordshanterare för grundarna | Delvis | Å1, Å13 |
| 5.18 | Åtkomsträttigheter | Ja | Genomgång av behörigheter varje kvartal | Saknas | 05 Behörigheter |
| 5.19 | Informationssäkerhet i leverantörsrelationer | Ja | Leverantörsregister med bedömning | Införd | 06 Leverantörer |
| 5.20 | Hantering av informationssäkerhet inom leverantörsavtal | Ja | Leverantörernas villkor och personuppgiftsbiträdesavtal | Delvis | Å12 |
| 5.21 | Hantering av informationssäkerhet i IKT-leveranskedjan | Ja | npm-beroenden låsta, Dependabot | Delvis | Å9 |
| 5.22 | Övervakning, granskning och ändringshantering av leverantörstjänster | Ja | Årlig genomgång av registret och ändrade villkor | Delvis | 06 |
| 5.23 | Informationssäkerhet för användning av molntjänster | Ja | EU-regioner, tvåfaktor, exitplan per tjänst | Delvis | 06, Å1 |
| 5.24 | Planering och förberedelser för hantering av informationssäkerhetsincidenter | Ja | Incidentrutin | Införd | 05 Incidenter |
| 5.25 | Bedömning av och beslut om informationssäkerhetshändelser | Ja | Händelser i system_events och larmmejl bedöms enligt rutinen | Införd | api/_systemEvents.js |
| 5.26 | Hantering av informationssäkerhetsincidenter | Ja | Stegen i incidentrutinen | Delvis | Å16 |
| 5.27 | Att lära av informationssäkerhetsincidenter | Ja | Varje incident får en lärdom och vid behov en ny risk | Delvis | 07 Avvikelser |
| 5.28 | Insamling av bevis | Ja | Loggar exporteras och sparas med datum innan något ändras | Delvis | 05 Incidenter |
| 5.29 | Informationssäkerhet vid störning | Ja | Radnivåskydd och kryptering gäller även vid reservdrift | Införd | 05 Kontinuitet |
| 5.30 | Kontinuitetsberedskap inom IKT | Ja | Nattkopia i R2, återställningsskript, reservplan | Delvis | Å6, Å15 |
| 5.31 | Författningskrav och avtalskrav | Ja | Lagförteckning i 08: bokföringslagen, GDPR, dataskyddslagen, LEK, cybersäkerhetslagen | Delvis | 08, Å18 |
| 5.32 | Immateriella rättigheter | Ja | Licenser för npm-paket, egna bilder och texter | Delvis | package.json |
| 5.33 | Skydd av verksamhetsinformation | Ja | Räkenskapsinformation sparas sju år i sjuårsarkivet | Införd | api/_archive.js |
| 5.34 | Integritet och skydd av personuppgifter | Ja | Integritetspolicy, cookiebanner, gallring, export | Delvis | Å12 |
| 5.35 | Oberoende granskning av informationssäkerhet | Ja | Extern revision vid certifiering; till dess internrevision | Saknas | 07 |
| 5.36 | Efterlevnad av policyer, regler och standarder för informationssäkerhet | Ja | Internrevision varje år | Saknas | 07 |
| 5.37 | Dokumenterade driftsrutiner | Ja | Rutiner i 05 och README för skript | Införd | 05 |

## 6 Personrelaterade åtgärder

| Nr | Åtgärd | Gäller | Hur Bokix uppfyller den | Status | Bevis |
|---|---|---|---|---|---|
| 6.1 | Bakgrundskontroll | Ja | Grundarna känner varandra; framtida anställda kontrolleras före åtkomst till kunddata | Delvis | 05 Personal |
| 6.2 | Anställningsvillkor | Ja | Sekretess och säkerhetsansvar i avtal med framtida anställda och konsulter | Delvis | 05 Personal |
| 6.3 | Medvetenhet och utbildning om informationssäkerhet | Ja | Årlig genomgång av rutinerna | Saknas | 07 Bevislogg |
| 6.4 | Disciplinär process | Ja | Brott mot rutinerna tas upp mellan grundarna; för anställda enligt avtal | Delvis | 05 Personal |
| 6.5 | Ansvar efter upphörande eller ändring av anställning | Ja | Sekretess gäller efter avslut; åtkomst stängs samma dag | Delvis | 05 Personal |
| 6.6 | Avtal om konfidentialitet eller sekretess | Ja | Sekretessavtal mellan grundarna och med konsulter som ser kunddata | Saknas | Grundarna |
| 6.7 | Distansarbete | Ja | All arbete sker på distans; regler för enheter och nätverk | Införd | 05 Enheter |
| 6.8 | Rapportering av informationssäkerhetshändelser | Ja | Alla rapporterar misstänkta incidenter direkt till den andra grundaren | Införd | 05 Incidenter |

## 7 Fysiska åtgärder

Bokix har inga egna lokaler eller servrar. Datacentren sköts av
leverantörerna och omfattas av deras certifieringar (se 06).

| Nr | Åtgärd | Gäller | Hur Bokix uppfyller den | Status | Bevis |
|---|---|---|---|---|---|
| 7.1 | Fysiska skalskydd | Nej | Inga egna lokaler; datacenter hos leverantörerna | Ej tillämplig | 06 |
| 7.2 | Fysiskt tillträde | Nej | Som 7.1 | Ej tillämplig | 06 |
| 7.3 | Säkerställande av kontor, rum och anläggningar | Nej | Som 7.1 | Ej tillämplig | |
| 7.4 | Fysisk säkerhetsövervakning | Nej | Som 7.1 | Ej tillämplig | |
| 7.5 | Skydd mot fysiska och miljörelaterade hot | Nej | Som 7.1 | Ej tillämplig | 06 |
| 7.6 | Arbete i säkrade utrymmen | Nej | Som 7.1 | Ej tillämplig | |
| 7.7 | Rent skrivbord och tom skärm | Ja | Skärmlås, inga utskrifter av kunddata | Delvis | Å10 |
| 7.8 | Placering och skydd av utrustning | Nej | Ingen egen serverutrustning | Ej tillämplig | |
| 7.9 | Säkerhet för tillgångar utanför organisationens lokaler | Ja | Datorer och telefoner krypterade och låsta | Delvis | Å10 |
| 7.10 | Lagringsmedier | Ja | Ingen kunddata på USB-minnen eller externa diskar | Delvis | 05 Enheter |
| 7.11 | Tekniska försörjningssystem | Nej | Hanteras av leverantörerna | Ej tillämplig | |
| 7.12 | Kablagesäkerhet | Nej | Inga egna nätverk | Ej tillämplig | |
| 7.13 | Underhåll av utrustning | Ja | Uppdateringar på datorer och telefoner | Delvis | Å10 |
| 7.14 | Säker avveckling eller återanvändning av utrustning | Ja | Enheter återställs till fabriksläge före försäljning eller kassering | Delvis | 05 Enheter |

## 8 Tekniska åtgärder

| Nr | Åtgärd | Gäller | Hur Bokix uppfyller den | Status | Bevis |
|---|---|---|---|---|---|
| 8.1 | Användarklienter | Ja | Krypterad disk, skärmlås, uppdateringar | Delvis | Å10 |
| 8.2 | Privilegierade åtkomsträttigheter | Ja | Service role-nyckeln bara på servern; adminpanel för två e-postadresser | Delvis | Å2, Å3 |
| 8.3 | Begränsning av åtkomst till information | Ja | Radnivåskydd, sidbehörighet för inbjudna, signerade länkar till filer (1 timme) | Införd | supabase-setup.sql, src/utils/signedUrls.js |
| 8.4 | Tillgång till källkod | Ja | Privat GitHub-repo, bara grundarna | Delvis | Å1 |
| 8.5 | Säker autentisering | Ja | Passkeys, tvåfaktor, utloggning efter 30 dagar, rate limit, Turnstile; adminpanelen kräver Face ID eller tvåfaktor | Delvis | Å7 |
| 8.6 | Kapacitetshantering | Ja | Mätningar för 250 företag (2026-10-18), Supabase Pro planerat | Delvis | Å7 |
| 8.7 | Skydd mot skadlig kod | Ja | Inbyggt skydd i operativsystemen; uppladdade filer körs aldrig, bara visas | Delvis | Å10 |
| 8.8 | Hantering av tekniska sårbarheter | Ja | Supabase Advisor åtgärdad 2026-09-30; Dependabot och npm audit planerat | Delvis | Å9 |
| 8.9 | Konfigurationshantering | Ja | vercel.json, SQL-filer och CI i git | Införd | git |
| 8.10 | Radering av information | Ja | Gallringsjobb och arkiv före radering enligt bokföringslagen | Införd | api/cron/data-retention.js, docs/DATA_RETENTION.md |
| 8.11 | Datamaskning | Ja | Clarity maskerar text; testdata är påhittad | Införd | scripts/big-company-seed.mjs |
| 8.12 | Förhindrande av dataläckage | Ja | CSP, ingen kunddata i loggar eller git, signerade fillänkar | Delvis | vercel.json |
| 8.13 | Säkerhetskopiering av information | Ja | Krypterad nattkopia (AES-256-GCM) till R2 i EU, sjuårsarkiv, kopia vid krympning | Delvis | api/_offsiteBackup.js, Å6 |
| 8.14 | Redundans för informationsbehandlingsresurser | Ja | Leverantörernas redundans; kopia hos annan leverantör | Delvis | Å15 |
| 8.15 | Loggning | Ja | system_events, audit_log, inloggningshistorik, Vercels loggar | Införd | supabase-setup.sql |
| 8.16 | Övervakning | Ja | Larmmejl vid systemfel, felrapporter från appen | Delvis | Å15 |
| 8.17 | Synkronisering av tid | Ja | Leverantörernas tid (UTC) används för alla tidsstämplar | Införd | |
| 8.18 | Användning av privilegierade verktygsprogram | Ja | Skript med service role-nyckel körs bara lokalt av grundarna och loggas | Delvis | 05 Behörigheter |
| 8.19 | Installation av program i driftsatta system | Ja | Drift sker bara via git push och Vercels bygge | Införd | .github/workflows/ci.yml |
| 8.20 | Nätverkssäkerhet | Ja | Inga egna nätverk; leverantörernas nätskydd | Införd | 06 |
| 8.21 | Säkerhet i nätverkstjänster | Ja | HTTPS överallt, HSTS | Införd | api/_security.js |
| 8.22 | Separation av nätverk | Nej | Inga egna nätverk | Ej tillämplig | |
| 8.23 | Webbfiltrering | Nej | Två personer, inga egna nätverk; ersätts av skydd i webbläsare | Ej tillämplig | |
| 8.24 | Användning av kryptering | Ja | TLS, kryptering i vila hos leverantörerna, AES-256-GCM för kopior och e-postlösenord | Införd | 05 Kryptering |
| 8.25 | Säker utvecklingscykel | Ja | Tester, CI, granskning före säkerhetskänsliga ändringar | Delvis | Å11 |
| 8.26 | Säkerhetskrav för applikationer | Ja | Krav i 05 Utveckling | Införd | 05 |
| 8.27 | Säker systemarkitektur och tekniska principer | Ja | Klient pratar med databasen genom radnivåskydd; känsliga steg via servern | Införd | 01 |
| 8.28 | Säker kodning | Ja | Ingen dangerouslySetInnerHTML, validering i api/, parametriserade frågor via Supabase | Införd | docs/PRODUCTION_READINESS.md |
| 8.29 | Säkerhetstestning i utveckling och acceptans | Ja | Enhetstester, app-harness, RLS provat med anon-nyckel | Delvis | Å8 |
| 8.30 | Utkontrakterad utveckling | Nej | Ingen utveckling läggs ut; AI-verktyg räknas som eget arbete och granskas | Ej tillämplig | |
| 8.31 | Separation av utvecklings-, test- och produktionsmiljöer | Ja | Lokal utveckling och förhandsvisningar mot fejkad databas; produktion separat | Delvis | scripts/app-harness-*.mjs |
| 8.32 | Ändringshantering | Ja | Allt via git, CI måste gå igenom, SQL-filer daterade | Införd | 05 Utveckling |
| 8.33 | Testinformation | Ja | Påhittade företag; riktig kunddata används aldrig i test | Införd | scripts/big-company-seed.mjs |
| 8.34 | Skydd av informationssystem vid revisionstestning | Ja | Revisorer får läsåtkomst till dokument, aldrig till produktionsdata | Införd | 07 |

## Sammanställning

| Status | Antal |
|---|---|
| Införd | 29 |
| Delvis | 47 |
| Saknas | 5 |
| Ej tillämplig | 12 |
| Totalt | 93 |
