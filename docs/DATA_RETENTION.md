# Vilken data Bokix sparar, hur länge, och varför

Två regelverk drar åt olika håll, och båda måste följas samtidigt:

- **Bokföringslagen (1999:1078)** säger att räkenskapsinformation **måste**
  sparas länge.
- **GDPR** (artikel 5.1 c och 5.1 e) säger att personuppgifter **inte får**
  sparas längre, eller i större mängd, än vad ändamålet kräver.

Regeln som löser konflikten: *arkivkravet vinner för räkenskapsinformation,
minimering gäller för allt annat.* Det är den principen koden implementerar.

---

## Vad lagen kräver

**Arkiveringstiden.** Räkenskapsinformation ska bevaras till och med det
sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades
(bokföringslagen 7 kap. 2 §). För ett räkenskapsår som slutar 2026-12-31
betyder det till och med 2033-12-31 — i praktiken sju år plus upp till tolv
månader, inte exakt sju år från fakturadatum.

**Vad som räknas som räkenskapsinformation** (7 kap. 1 §, med definitionen i
1 kap. 2 §): verifikationer och deras underlag, grund- och huvudbok,
årsredovisning och årsbokslut, samt avtal och andra handlingar som är av
särskild betydelse för att belysa verksamhetens ekonomiska förhållanden. I
Bokix: verifikationer, kvitton och uppladdade underlag, fakturor,
leverantörsfakturor, lönekörningar, momsunderlag och de importerade
banktransaktioner som ligger till grund för bokförda poster.

**Formen.** Information ska bevaras i den form den hade när den kom till
företaget (7 kap. 1 §). Sedan 1 juli 2024 får ett papperskvitto förstöras
direkt när det fotograferats eller skannats, om överföringen inte innebär
risk att uppgifter ändras eller försvinner (7 kap. 6 §). Bilden måste då
sparas hela arkivtiden.

> **Att stämma av mot lagtexten.** Reglerna om förvaring utomlands (7 kap.
> 3 a–4 §§) har ändrats de senaste åren och är den punkt jag är minst säker
> på — det är också den som faktiskt berör oss, eftersom Supabase och Vercel
> inte nödvändigtvis lagrar i Sverige. När du skickar lagtexten går vi
> igenom just det avsnittet först. Resten ovan är jag trygg med.

---

## Vad Bokix faktiskt lagrar

| Vad | Var | Raderas |
|---|---|---|
| All appdata (företag, verifikationer, fakturor, kunder, löner, banktransaktioner) | En JSON-post per användare i `user_data.state` | Vid nästa sparning efter att posten tagits bort i appen |
| Uppladdade filer (kvitton, underlag, logotyper) | Supabase Storage, `bokix-uploads` och `companylogo` | Vid borttagning i appen + nattlig städning av föräldralösa filer |
| Prenumerationsstatus | `subscriptions` | Behålls så länge kontot finns |
| Stripe-händelser (betalningar, utbetalningar) | `stripe_payment_events`, `stripe_ledger_events` | Behålls — underlag till bokförda poster |
| Inloggningskonto | Supabase Auth | Raderas med kontot |

**Bankfiler lagras inte.** En uppladdad CSV/XLSX läses i webbläsaren
(`src/utils/bankImport.js`) och kastas när fliken stängs. Det som sparas är
de normaliserade transaktionsraderna, inte filen. Tas de bort i bankvyn —
en rad eller hela importomgången — är de borta ur databasen vid nästa
sparning. Det finns alltså ingenting kvar att städa efteråt.

---

## Arkivet (sjuårslöftet)

Kod: `api/_archive.js`, `api/archive.js`. Allt ligger i den privata bucketen
`bokix-arkiv` i samma Supabase-projekt (Stockholm). Bucketen har inga
RLS-regler för användare, så bara servern kan läsa och skriva den; en
användare kan inte radera sitt eget arkiv.

| Vad | När | Sparas |
|---|---|---|
| Det bokförda (legalSubset) + kopior av bara de bokförda filerna, gzip | Innan Radera data eller Radera företag går igenom. Misslyckas arkiveringen stoppas raderingen. Finns inget bokfört skrivs inget. | Till arkivtidens slut, som står i mappnamnet (`-tÅÅÅÅ-MM-DD`); cronen raderar det sedan |
| Hela kontot, gzip, dagskopia (skydd mot buggar) | De nätter kontot ändrats | 14 dagar |
| Det bokförda, gzip, månadskopia | Bara när det bokförda ändrats sedan förra | Till arkivtidens slut |

**Bara det lagen kräver sparas.** `legalSubset` i `api/_archive.js` tar med
verifikationer, fakturor som lämnat utkastläget, bokförda kvitton och
leverantörsfakturor, bokförda lönekörningar, matchade/bokförda
banktransaktioner, moms- och AGI-rapporter, samt de konton och kontakter
de pekar på och företagsuppgifterna utan lösenord och nycklar. Utkast,
offerter, artiklar, projekt, tid, mallar, anställdas profiler och en
bankimport man ångrat sparas inte. På riktig data 2026-09-24 blev ett konto
på 103 kB ett arkiv på 1,5 kB.

Arkivtiden räknas som senaste året i bokföringen (eller i år) plus ett år
för ett räkenskapsår som kan sluta året efter, plus sju hela år. Det kan ge
ett år för mycket, aldrig för lite.

En kund som slutat betala ser betalspärren, men den visar också "Din
bokföring finns kvar" med SIE4 och JSON per företag, så ingen stängs ute
från sina egna räkenskaper. Kvitton och underlag lämnas ut via support ur
arkivet eller den vanliga bucketen.

Att hämta ut ett arkiv i dag: Supabase Dashboard > Storage > bokix-arkiv >
`<user_id>/`. Det finns inget gränssnitt för det än.

---

## Vad som städas automatiskt

Båda jobben körs en gång per dygn från `api/cron/reminders.js` (via
`api/cron/_dataRetention.js`). Ingen egen endpoint — Vercels Hobby-plan
tillåter tolv serverfunktioner och vi ligger på tolv.

**1. Föräldralösa filer, efter 7 dagar.** Filer i Storage som ingen post
längre pekar på. Respiten finns för att en uppladdning alltid ska hinna
före sparningen av posten som refererar den. Jämförelsen görs per användare
och bara inom användarens eget prefix, så en bugg i en användares data
aldrig kan träffa någon annans filer. Referenserna hittas via *mönstret* för
en Storage-URL (`src/utils/storageUrls.js`), inte via en lista med kända
fältnamn — ett nytt filfält städas då rätt utan kodändring.

**2. Övergivna registreringar, efter 30 dagar.** Konton som skapades, kom
fram till betalsteget och aldrig betalade. De hade annars blivit liggande
med namn, mejladress och företagsuppgifter utan ändamål.

### Vad städningen aldrig rör

- Konton med en rad i `subscriptions`, oavsett status — även uppsagd. Har
  någon varit kund finns räkenskapsinformation, och den är arkivpliktig.
- Konton med verifikationer, fakturor, utgifter, lönekörningar eller
  banktransaktioner, även utan prenumeration. Samma skäl.
- Allt som är nyare än respitperioderna ovan.

Ordningen vid radering är filer → datapost → inloggningskonto. Kraschar
rutinen mitt i blir resultatet ett tomt konto utan data, inte data utan
ägare som ingen kan komma åt eller radera.

---

## Det som inte är automatiserat än

- **Gallring av den levande datan.** Arkiven gallras när arkivtiden gått ut
  (`pruneExpiredArchives`), men ett aktivt konto behåller all sin data så
  länge det finns.
- **Kontoavslut på begäran** är fortfarande manuellt. En adminknapp som
  arkiverar och sedan raderar kontot är förberedd som idé men inte byggd:
  den raderar för gott och kräver ett eget beslut.
- **Kontoavslut på begäran.** En användare som vill avsluta får i dag mejla
  supporten. Räkenskapsinformationen kan ändå inte raderas före arkivtidens
  slut — det står i integritetspolicyn, men flödet är manuellt.
- **Loggar hos underleverantörer.** Vercel och Supabase har sina egna
  loggar med IP-adresser och förfrågningar, med sina egna gallringstider.
  De styr vi inte över utöver vad avtalen säger.
