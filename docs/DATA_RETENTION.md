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
företaget (7 kap. 1 §). Ett kvitto som kommit på papper och skannats in får
enligt 7 kap. 6 § förstöras i original först från och med det fjärde året
efter räkenskapsårets utgång — den digitala kopian måste ändå sparas hela
arkivtiden.

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

- **Gallring efter arkivtidens slut.** Ingen raderar data som passerat sju
  år. Det är rätt ordning att bygga det i: hellre spara för länge än att
  radera för tidigt. Men det är nästa steg om lagringen ska hållas nere.
- **Kontoavslut på begäran.** En användare som vill avsluta får i dag mejla
  supporten. Räkenskapsinformationen kan ändå inte raderas före arkivtidens
  slut — det står i integritetspolicyn, men flödet är manuellt.
- **Loggar hos underleverantörer.** Vercel och Supabase har sina egna
  loggar med IP-adresser och förfrågningar, med sina egna gallringstider.
  De styr vi inte över utöver vad avtalen säger.
