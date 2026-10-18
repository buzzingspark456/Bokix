# Register över tillgångar och leverantörer

Åtgärd 5.9 och 5.19–5.23. Version 1, 2026-10-18. Gås igenom varje kvartal
tillsammans med behörigheterna.

## Information

| Tillgång | Var den finns | Klass | Ägare | Skydd |
|---|---|---|---|---|
| Kundernas bokföring (user_data.state: verifikationer, fakturor, kontakter, löner m.m.) | Supabase Postgres, Frankfurt | Konfidentiell | Driftansvarig | Radnivåskydd, villkorad sparning, kopia vid krympning, nattkopia |
| Kvitton, underlag, logotyper (bucket bokix-uploads m.fl.) | Supabase Storage, Frankfurt | Konfidentiell | Driftansvarig | Privat bucket, signerade länkar i en timme, mapp per användare |
| Sjuårsarkivet (bokix-arkiv) | Supabase Storage | Konfidentiell | Driftansvarig | Bara service role, arkiv före radering |
| Nattkopior | Cloudflare R2, bucket bokix-backup (EU) | Konfidentiell | Driftansvarig | AES-256-GCM, egen nyckel |
| Kundkonton och inloggning | Supabase Auth | Konfidentiell | Driftansvarig | Lösenord, passkeys, tvåfaktor, rate limit |
| Prenumerationer och betalningar | Stripe, tabellen subscriptions | Konfidentiell | Grundarna | Stripe sköter kortuppgifter; Bokix sparar inga kortnummer |
| Kopplingar (Zettle-, Gmail-, SMTP-uppgifter) | user_data, krypterade fält | Konfidentiell | Driftansvarig | EMAIL_SECRET_KEY |
| Loggar (system_events, audit_log, inloggningshistorik) | Supabase | Konfidentiell | Informationssäkerhetsansvarig | Bara service role / ägaren |
| Källkod och dessa dokument | GitHub (privat repo) | Intern | Grundarna | Tvåfaktor (Å1), hemlighetsskanning (Å5) |
| Hemliga nycklar | Vercels miljövariabler, lokal .env | Konfidentiell | Driftansvarig | Se 05 Kryptering och nycklar |

## Enheter

Fyll i per enhet. Kontrolleras varje kvartal.

| Enhet | Användare | Diskkryptering | Skärmlås ≤ 5 min | Uppdateringar | Hitta/radera på distans |
|---|---|---|---|---|---|
| Dator: __________ | __________ | ☐ | ☐ | ☐ | ☐ |
| Dator: __________ | __________ | ☐ | ☐ | ☐ | ☐ |
| Telefon: __________ | __________ | ☐ | ☐ | ☐ | ☐ |
| Telefon: __________ | __________ | ☐ | ☐ | ☐ | ☐ |

## Leverantörer

Certifieringar och personuppgiftsbiträdesavtal kontrolleras i respektive
leverantörs trust center eller avtalssida och fylls i med datum. Kolumnen
"Tvåfaktor" gäller Bokix egna konton hos leverantören.

| Leverantör | Används till | Data | Plats | Certifieringar (kontrollerat datum) | Biträdesavtal | Tvåfaktor | Väg ut |
|---|---|---|---|---|---|---|---|
| Supabase | Databas, inloggning, filer | Allt konfidentiellt | Frankfurt (EU) | __________ | ☐ | ☐ | Nattkopian, SQL-dump |
| Vercel | Webbplats, serverfunktioner, nattjobb | Passerar funktionerna | Funktioner i Frankfurt (fra1) sedan 2026-10-18 | __________ | ☐ | ☐ | Koden i git, annan värd |
| Cloudflare | R2 (nattkopior), Turnstile | Krypterade kopior | EU | __________ | ☐ | ☐ | Annan S3-lagring |
| Stripe | Prenumerationer, kundbetalningar av fakturor | Namn, e-post, betalningar | USA/EU | __________ | ☐ | ☐ | Export från Stripe |
| Resend | Utskick av e-post | E-postadresser, fakturor och lönebesked som bilagor | __________ | __________ | ☐ | ☐ | Annan e-posttjänst |
| Google | Workspace (e-post), Gmail-koppling, Search Console, GA4 | Grundarnas e-post, analys efter samtycke | __________ | __________ | ☐ | ☐ | |
| PostHog | Sidvisningar efter samtycke | Pseudonym användning | EU | __________ | ☐ | ☐ | Stäng av |
| Microsoft Clarity | Sessionsinspelning i appen, text maskerad | Pseudonym användning | __________ | __________ | ☐ | ☐ | Stäng av |
| GitHub | Källkod, CI | Kod, inga kunddata | USA | __________ | Ej tillämpligt | ☐ | Annan git-värd |
| one.com | DNS för bokix.se | Inga kunddata | EU | __________ | Ej tillämpligt | ☐ | Flytta DNS |
| FöretagsAPI | Uppslag av företag vid registrering | Organisationsnummer | __________ | __________ | ☐ | ☐ | Bolagsverket |
| Bolagsverket | Företagsuppslag | Organisationsnummer | Sverige | Myndighet | Ej tillämpligt | ☐ | |
| Zettle (PayPal) | Kassakoppling för kunder som valt den | Försäljning, avgifter | __________ | __________ | ☐ | | Kunden kopplar bort |

Tjänster som inte hanterar kunddata (t.ex. röstgenerering för guidevideor)
behöver inte stå här.

## Exitplan i korthet

Kommer vi inte åt en leverantör längre, eller måste byta:
- Databas och filer: nattkopian i R2 återställs till ny Postgres och
  S3-lagring med scripts/restore-offsite-backup.mjs.
- Webbplats och funktioner: koden finns i git och kan byggas hos annan värd;
  miljövariablerna finns i valvet (Å13).
- E-post: byt Resend-nyckel mot annan tjänst i api/_resend.js.
