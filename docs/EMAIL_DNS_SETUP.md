# E-postsäkerhet (SPF/DKIM/DMARC) — checklista

Skriven 2026-08-25 efter en säkerhetsskanning som visade:

- **SPF** — Hittades ✅ (redan på plats för nuvarande avsändare)
- **DKIM** — Saknas ❌
- **DMARC** — Saknas ❌

Det här är **inte** något som fixas i appens kod — det är TXT-poster hos
den DNS-leverantör där `bokix.se` hanteras (er registrar, eller Cloudflare
om domänen proxas där). Den här filen är en checklista för att lägga in
dem manuellt. Ingen agent/CI kan göra det här steget åt er eftersom det
kräver inloggning hos DNS-leverantören.

Bokix skickar transaktionsmejl (fakturor m.m.) via **Resend**
(`EMAIL_FROM=Bokix <fakturor@bokix.se>`, se `.env` och
`resolveSenderAddress`/`sendViaResend` i [server.js](../server.js)) —
stegen nedan är skrivna utifrån det.

## 1. DKIM — via Resend

1. Logga in på [resend.com](https://resend.com) → **Domains**.
2. Öppna `bokix.se` (eller lägg till domänen om den inte redan finns där).
3. Resend visar en lista DNS-poster att lägga till — normalt en eller
   flera `CNAME`/`TXT`-poster med namn i stil med
   `resend._domainkey.bokix.se`. Kopiera dem exakt som Resend visar dem
   (värdena är unika för er domän/konto, gissa/återanvänd inte gamla).
4. Lägg in posterna hos DNS-leverantören för `bokix.se`.
5. Vänta på DNS-propagering (oftast minuter, kan ta upp till någon timme)
   och klicka **Verify** i Resend-dashboarden.
6. Resend brukar spärra skarp sändning från en domän tills DKIM är
   verifierat — så detta är värt att kontrollera även om utskick redan
   fungerar (kan idag gå via Resends delade onboarding-domän istället för
   `bokix.se` rakt av).

## 2. DMARC — ny TXT-post

Lägg till hos DNS-leverantören:

| Typ | Namn | Värde |
|-----|------|-------|
| TXT | `_dmarc.bokix.se` | `v=DMARC1; p=none; rua=mailto:support@bokix.se` |

**Börja alltid med `p=none`** ("observera, blockera inget") — det gör att
ni bara samlar in rapporter (skickas till `rua`-adressen) om vilka mejl
som skickas i domänens namn, utan att riskera att legitima mejl studsar.
Efter någon/några veckor, när rapporterna ser rena ut (inget oväntat
skickar mejl som `@bokix.se`), skärp stegvis:

```
v=DMARC1; p=quarantine; rua=mailto:support@bokix.se   # steg 2: karantän
v=DMARC1; p=reject; rua=mailto:support@bokix.se        # steg 3: avvisa
```

`p=reject` är slutmålet (starkast skydd mot att andra spoofar
`@bokix.se`), men hoppa inte dit direkt — då riskerar legitima mejl
(t.ex. från Resend om DKIM/SPF inte är helt korrekt inställt än) att
studsa istället för att levereras.

## 3. SPF — redan på plats, dubbelkolla vid ändringar

SPF hittades redan av skanningen, ingen åtgärd krävs nu. Kom bara ihåg:
en domän får bara ha **en** SPF-post (flera `v=spf1`-TXT-poster är
ogiltigt och gör att SPF failar helt) — om Resend eller en framtida
tjänst ber er lägga till ett nytt `include:`, redigera den befintliga
posten istället för att lägga till en ny.

## 4. Verifiera

Efter att posterna lagts in och hunnit propagera:

```bash
dig TXT bokix.se +short           # SPF
dig TXT _dmarc.bokix.se +short    # DMARC
dig TXT resend._domainkey.bokix.se +short   # DKIM (namnet Resend gav i steg 1)
```

Eller kör om samma säkerhetsskanning som gav resultatet högst upp i den
här filen.

## 5. Supabase Auth-mejl (bekräfta konto/återställ lösenord) — custom SMTP

De mejl som beskrivs ovan (fakturor/påminnelser) är EN sak, skickade av
Bokix egen kod via Resends HTTP-API. Supabase Auths egna mejl — bekräfta
konto, återställ lösenord, magisk länk, ändra e-post, återautentisering —
är en HELT SEPARAT sak: Supabase skickar dem själv, utlöst av sina egna
auth-flöden (t.ex. `supabase.auth.resetPasswordForEmail(...)` i
[Auth.jsx](../src/components/Auth.jsx)), inte av någon kod i den här
kodbasen.

Utan konfiguration skickar Supabase de här mejlen via sin egen delade
mailserver — hårt hastighetsbegränsad (några enstaka mejl/timme oavsett
plan) och från en generisk Supabase-adress, inte `@bokix.se`. Inte
produktionsdugligt: en verklig användarbas slår snabbt i taket, och en
missad återställningslänk syns aldrig som ett fel, mejlet bara uteblir.

Lösningen: Supabase stödjer "custom SMTP" — en egen mailserver för just de
här mejlen. Resend har, utöver sitt HTTP-API, ÄVEN en vanlig SMTP-relä
(`smtp.resend.com`) byggd exakt för såna här tredjepartsintegrationer.
Eftersom `bokix.se` redan är DKIM/SPF/DMARC-verifierat i Resend (steg 1–3
ovan) krävs **inga nya DNS-poster** — SMTP-reläet är bara en andra dörr in
till SAMMA redan verifierade Resend-konto/domän, inte en ny avsändare.

Konfiguration (Supabase Dashboard → Authentication → Emails → SMTP
Settings):

| Fält | Värde |
|---|---|
| Sender email | `noreply@bokix.se` |
| Sender name | `Bokix` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (bokstavligen, alltid samma för alla Resend-konton) |
| Password | en Resend API-nyckel (`re_...`), skapad separat från `RESEND_API_KEY` (se [.env.example](../.env.example) — den nyckeln används av fakturautskicken, se ovan) med behörigheten **"Sending access"**, inte "Full access" |

Två separata nycklar med avsikt: om den ena någonsin behöver återkallas
(läckt, misstänkt missbruk) ska det inte samtidigt slå ut den andra
funktionen.

**Testa**: logga in-sidan har en "Glömt lösenord?"-länk (Auth.jsx) som
triggar `resetPasswordForEmail` — använd den mot ett testkonto och
kontrollera dels att mejlet kommer fram från `noreply@bokix.se`, dels
**Resend → Logs** (visar om det gick via SMTP eller inte). App.jsx lyssnar
på Supabases `PASSWORD_RECOVERY`-event (se `passwordRecovery`-state:t och
`PasswordRecoveryScreen`) och visar ett "ange nytt lösenord"-formulär när
länken i mejlet klickas.

## Relaterat

- `security.txt` (samma skanning, separat kontaktväg för sårbarhets-
  rapportering) — se [public/.well-known/security.txt](../public/.well-known/security.txt)
  och [public/security.txt](../public/security.txt) (duplicerad på
  rot-nivå för skannrar som inte kollar `.well-known/`, se
  [vercel.json](../vercel.json) för varför bara `.well-known/`-versionen
  annars fastnade i SPA-catch-all-regeln).
