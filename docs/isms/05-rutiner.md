# Rutiner

Områdesrutiner som stödjer informationssäkerhetspolicyn. Version 1,
2026-10-18. Ägare: informationssäkerhetsansvarig.

## Klassning

| Nivå | Exempel | Regler |
|---|---|---|
| Konfidentiell | Kundernas bokföring, kvitton, löner, personnummer, inloggningsuppgifter, hemliga nycklar, nattkopior | Bara i Supabase, R2 och leverantörernas system. Aldrig i git, chatt, mejl eller på egna diskar. Läses bara när kunden bett om hjälp eller vid incident |
| Intern | Källkod, dessa dokument, statistik utan personuppgifter, felrapporter | Privat GitHub-repo och delad mapp. Delas inte utanför Bokix |
| Öppen | Webbplatsen, bloggen, guider, villkor | Får publiceras |

Kunddata som tas ut för support (t.ex. en export för att hitta ett fel) raderas
när ärendet är löst och noteras i bevisloggen.

## Behörigheter

- Varje person har eget konto hos varje leverantör. Inga delade inloggningar.
- Tvåfaktor med passkey eller app krävs på alla adminkonton (Å1). Nödkoder
  sparas i lösenordshanterarens delade valv (Å13).
- Service role-nyckeln för Supabase finns bara i Vercels miljövariabler och i
  grundarnas lokala `.env`. Den används lokalt bara för läsning och
  felsökning, eller för skript som är beskrivna i koden.
- Ändringar direkt i produktionsdatabasen (SQL i Supabase-konsolen) görs bara
  med en SQL-fil i git (`supabase-ÅÅÅÅ-MM-DD-*.sql`) och meddelas den andra
  grundaren.
- Att läsa en kunds data görs bara när kunden bett om hjälp eller vid
  incident, och noteras i bevisloggen med datum, kund och orsak.
- **Varje kvartal** går driftansvarig igenom vem som har åtkomst hos varje
  leverantör i [06-register.md](06-register.md#leverantörer), tar bort det som
  inte behövs och noterar genomgången i bevisloggen.
- Adminpanelen (`/internal`, `api/admin`) är bara öppen för adresserna i
  `ADMIN_EMAILS` (api/_systemEvents.js).

## Kryptering och nycklar

- All trafik går över HTTPS. HSTS är på (api/_security.js).
- Data i vila krypteras av Supabase, Vercel och Cloudflare.
- Nattkopian krypteras med AES-256-GCM innan den lämnar Supabase
  (`BACKUP_ENCRYPTION_KEY`). Kundernas e-postlösenord och Gmail-tokens
  krypteras med `EMAIL_SECRET_KEY`.
- Hemliga nycklar finns bara i Vercels miljövariabler och lokal `.env`
  (som är i .gitignore). De skickas aldrig i chatt, mejl eller ärenden.
- En nyckel rullas direkt om den kan ha visats för någon annan, och annars
  när en person slutar. `BACKUP_ENCRYPTION_KEY` rullas inte utan att gamla
  kopior först går att läsa; den gamla nyckeln sparas i valvet så länge
  kopior krypterade med den finns.
- Förteckning över nycklarna och var de används: miljövariablerna i
  `.env.example` och listan i api/admin/index.js (Systemstatus).

## Säkerhetskopior och återställning

- Varje natt kl. 02.00 krypteras databasens tabeller och filerna och kopieras
  till R2-bucketen `bokix-backup` (EU) av api/cron/offsite-backup.js.
- Räkenskapsinformation arkiveras i sjuårsarkivet (bucket `bokix-arkiv`)
  innan något raderas.
- När en kunds data krymper kraftigt sparas förra versionen i
  `user_data_history` i 30 dagar.
- Supabase Pro ger dessutom dagliga säkerhetskopior hos Supabase (Å7).
- **Varje kvartal**: återställ ett företag från nattkopian till ett testkonto
  med `scripts/restore-offsite-backup.mjs`. Notera tid, resultat och fel i
  bevisloggen (Å6). Ett misslyckat prov är en avvikelse.
- Systemstatus i `/internal` visar om nattkopian gått igenom; ett
  misslyckande ger larmmejl (backup_failed).

## Incidenter

En incident är allt som kan ha röjt, ändrat eller gjort kunddata eller
tjänsten otillgänglig: läckt nyckel, misstänkt intrång, en kund som ser fel
företags data, borttappad dator, nätfiske som lyckats, längre avbrott.

1. **Upptäck och meddela.** Den som märker något meddelar den andra grundaren
   direkt (telefon, inte bara mejl). Skriv ned tid och vad som syns.
2. **Begränsa.** Rulla nycklar, logga ut sessioner, stäng av konton eller
   funktioner som läcker. Spara loggar (Vercel, Supabase, system_events)
   innan något ändras.
3. **Bedöm.** Vilka kunder och vilka uppgifter berörs? Är det en
   personuppgiftsincident?
4. **Anmäl.** Personuppgiftsincident som inte är osannolik att medföra risk:
   anmäl till IMY inom 72 timmar från upptäckt. Hög risk för de registrerade:
   informera berörda kunder utan onödigt dröjsmål. Brott: polisanmälan.
   Leverantörens fel: kontakta leverantören.
5. **Åtgärda och återställ.** Rätta orsaken, återställ data vid behov.
6. **Lär.** Skriv incidentrapport i [07-uppfoljning.md](07-uppfoljning.md#avvikelser-och-incidenter):
   vad hände, orsak, åtgärd, lärdom, ny eller ändrad risk.

Kontakter: IMY (imy.se, e-tjänst för anmälan), CERT-SE (cert.se), Supabase,
Vercel och Stripes supportsidor.

## Leverantörer

- Innan en ny tjänst får hantera konfidentiell information: kontrollera var
  data lagras (EU föredras), om personuppgiftsbiträdesavtal finns, vilka
  certifieringar leverantören har och hur man kommer ut (export). Lägg in den
  i [06-register.md](06-register.md#leverantörer).
- Personuppgiftsbiträdesavtal godkänns och sparas för varje leverantör som
  behandlar personuppgifter (Å12). Underbiträden listas i integritetspolicyn.
- En gång per år: gå igenom registret, ändrade villkor och leverantörernas
  säkerhetsincidenter.

## Utveckling och ändringar

- All kod och alla databasändringar finns i git. Drift sker bara genom push
  till `main`, som Vercel bygger.
- CI (.github/workflows/ci.yml) kör lint, tester och bygge på varje push.
- Före ändringar i `api/`, SQL-filer, inloggning, betalning eller delning med
  konsult: säkerhetsgranskning och tester som täcker ändringen (Å11).
- Krav på ny kod: klienten når bara data genom radnivåskydd; allt som kräver
  service role-nyckeln görs i `api/` med kontroll av inloggning och
  behörighet; indata valideras; inga hemligheter i klientkoden (bara
  `VITE_`-variabler som är publika).
- Testdata är påhittad (scripts/big-company-seed.mjs, demoföretaget). Riktig
  kunddata kopieras aldrig till utveckling.
- Beroenden: package-lock.json checkas in. Säkerhetsuppdateringar från
  Dependabot tas inom 14 dagar för höga och kritiska (Å9).

## Enheter och distansarbete

- Datorer: krypterad disk (BitLocker eller FileVault), skärmlås efter högst
  5 minuter, automatiska uppdateringar, inbyggt skydd mot skadlig kod på.
- Telefoner: kodlås eller biometri, Hitta min enhet på, uppdateringar på.
- Kunddata sparas inte på USB-minnen eller externa diskar.
- Offentliga nätverk: bara HTTPS-tjänster; inga ändringar i produktion från
  delade datorer.
- En enhet som säljs eller kasseras återställs först till fabriksläge.
- Förlorad enhet är en incident: logga ut alla sessioner och rulla nycklar som
  fanns på enheten.

## Personal

Bokix har i dag inga anställda. När någon börjar:
- sekretessavtal och dessa rutiner innan åtkomst till kunddata
- eget konto med minsta möjliga behörighet hos varje leverantör
- genomgång av rutinerna, noterad i bevisloggen

När någon slutar: alla konton stängs samma dag, nycklar personen kunnat se
rullas, utrustning lämnas tillbaka. Sekretessen gäller även efter avslut.

## Kontinuitet

Om Supabase eller Vercel ligger nere länge:
1. Meddela kunderna på /nyheter och via e-post att tjänsten är nere och att
   datan är säker.
2. Kunderna har en kopia av det de senast öppnat i sin webbläsare.
3. Vid längre avbrott: återställ från nattkopian i R2 till ett nytt
   Supabase-projekt (samma skript som vid återställningsprovet) och peka om
   miljövariablerna i Vercel.
4. Om en grundare blir otillgänglig har den andra åtkomst till allt via det
   delade valvet (Å13).
