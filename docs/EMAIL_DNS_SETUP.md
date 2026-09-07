# E-postsäkerhet (SPF/DKIM/DMARC) — checklista

**Status 2026-09-05: klart.** Allt nedan är genomfört och verifierat mot
publika resolvers (1.1.1.1 och 8.8.8.8):

- **SPF** — På plats ✅ (`-all`, strikt)
- **DKIM** — På plats ✅ (selector hittad)
- **DMARC** — På plats ✅ `p=reject` (se steg 2 — högsta nivån, nyss höjd
  från `p=quarantine`)
- **DNSSEC** — Signerad ✅
- **security.txt** — Giltig ✅ (se Relaterat längst ner)

Den här filen skrevs 2026-08-25 som en åtgärdslista efter en
säkerhetsskanning som då visade SPF ✅, DKIM ❌ och DMARC ❌. Stegen står
kvar som dokumentation av vad som gjordes och varför — och som underlag om
posterna någon gång behöver läggas om (byte av DNS-leverantör, ny
avsändartjänst).

Det här är **inte** något som fixas i appens kod — det är TXT-poster hos
den DNS-leverantör där `bokix.se` hanteras (er registrar, eller Cloudflare
om domänen proxas där). Den här filen är en checklista för att lägga in
dem manuellt. Ingen agent/CI kan göra det här steget åt er eftersom det
kräver inloggning hos DNS-leverantören.

Bokix skickar transaktionsmejl (fakturor m.m.) via **Resend**
(`EMAIL_FROM=Bokix <support@bokix.se>`, se `.env` och
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

## 2. DMARC — klar, ligger på `p=reject`

Nuvarande post (TXT på `_dmarc.bokix.se`), verifierad 2026-09-05:

```
v=DMARC1; p=reject; pct=100; rua=mailto:support@bokix.se
```

Det är den strängaste nivån: mejl som utger sig för att komma från
`@bokix.se` men inte klarar SPF/DKIM-kontrollen **avvisas** av mottagaren.

### Hur vi kom hit (och varför ordningen spelade roll)

DMARC skärptes stegvis, aldrig direkt till `reject`:

| Steg | Policy | Innebörd |
|---|---|---|
| 1 | `p=none` | Observera, blockera inget — samla bara in rapporter |
| 2 | `p=quarantine` | Misstänkta mejl hamnar i skräpposten |
| 3 | `p=reject` | Misstänkta mejl avvisas helt ← **här är vi nu** |

Poängen med trappan: under `none`/`quarantine` är priset för en felaktigt
uppsatt avsändare att mejlet hamnar i skräp. Under `reject` uteblir det
helt. Fakturor till kunder går ut från den här domänen, så det är inte ett
läge man vill nå innan SPF och DKIM bevisligen är rätt för *alla*
avsändare.

### `pct` är inte samma sak som policystyrka

Vanligt missförstånd, värt att skriva ner: `pct=100` betyder "tillämpa
policyn på 100 % av mejlen" — alltså täckningsgrad, inte stränghet. En
skanner som ändå ger DMARC delpoäng tittar på `p=`, inte på `pct`. Med
`pct=100; p=quarantine` är täckningen alltså redan maximal medan policyn
är den mellersta av tre.

Att jämföra med (Bokios post): `adkim=r; aspf=r` är bara
standardvärdet (relaxed) utskrivet — det gör ingen post starkare, så det
finns inget att hämta i att kopiera in dem.

### Att hålla ett öga på

Aggregatrapporterna (`rua`) går till `support@bokix.se` och kommer som rå
XML i bilagor — läsbara men obekväma. Vill man faktiskt följa upp vilka
avsändare som failar alignment är en gratis DMARC-rapporttjänst som
`rua`-mottagare betydligt mer användbar än supportinkorgen.

Efter höjningen till `reject`: håll utkik efter studsar ett par veckor.
Trafiken som berörs är Resend (fakturor via HTTP-API:t, plus Supabase
auth-mejl via `smtp.resend.com`, se steg 5).

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

`dig` finns inte på Windows som standard — PowerShell-motsvarigheten, med
`-Server` för att gå förbi den lokala DNS-cachen (annars kan man få kvar
den gamla posten i upp till TTL:ens längd efter en ändring):

```powershell
Resolve-DnsName _dmarc.bokix.se -Type TXT -Server 1.1.1.1 | Select -Expand Strings
```

Fråga gärna två oberoende resolvers (t.ex. `1.1.1.1` och `8.8.8.8`) efter
en ändring — svarar båda likadant har den spridit sig.

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
| Sender email | `support@bokix.se` |
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
kontrollera dels att mejlet kommer fram från `support@bokix.se`, dels
**Resend → Logs** (visar om det gick via SMTP eller inte). App.jsx lyssnar
på Supabases `PASSWORD_RECOVERY`-event (se `passwordRecovery`-state:t och
`PasswordRecoveryScreen`) och visar ett "ange nytt lösenord"-formulär när
länken i mejlet klickas.

## Flytta INTE nameservrarna till Vercel

Vercel visar en uppmaning i stil med *"your nameservers are still pointed
at another DNS provider — replace them with `ns1.vercel-dns.com` /
`ns2.vercel-dns.com`"*. Den är en rekommendation, inte ett fel, och ska
inte följas för `bokix.se`.

Nuvarande uppsättning (kontrollerad mot 8.8.8.8 2026-09-07, allt fungerar):

| Post | Värde | Vad den gör |
|---|---|---|
| NS | `ns01.one.com`, `ns02.one.com` | DNS ligger hos one.com |
| A (apex) | `76.76.21.21` | Vercel, `bokix.se` → 307 till www |
| CNAME `www` | `…vercel-dns-017.com` | Vercel, giltigt certifikat, svarar 200 |
| MX | `smtp.google.com` | Google Workspace tar emot post |
| TXT (apex) | `v=spf1 include:_spf.google.com include:_custspf.one.com -all` | SPF för post skickad från apex |
| TXT `send` | `v=spf1 include:amazonses.com include:_custspf.one.com ~all` | SPF för Resends return-path |
| TXT `resend._domainkey` | DKIM-nyckeln | Det som gör att Resend-mejlen klarar DMARC |
| TXT `_dmarc` | `p=reject` | Se steg 2 |
| DS | keytag 25571, algoritm 13 | DNSSEC, signerad via one.com |

Tre skäl att låta det vara:

1. **DNSSEC skulle brytas.** Domänen har en DS-post hos .se-registret och
   Vercel DNS stödjer inte DNSSEC. Byter man nameservrar UTAN att först ta
   bort DS-posten slutar `bokix.se` att gå att slå upp överhuvudtaget hos
   validerande resolvers — sajt och e-post ryker samtidigt. Även gjort i
   rätt ordning innebär flytten att DNSSEC försvinner, en punkt som
   säkerhetsskanningen ovan räknar som godkänd idag.
2. **All e-postuppsättning skulle behöva byggas om för hand** — MX, båda
   SPF-posterna, DKIM, DMARC och `send`-subdomänen. Med `p=reject` betyder
   varje missad post inte "lite sämre leverans" utan avvisade mejl.
3. **Ingenting vinns.** A/CNAME-uppsättningen är Vercels egen fullt
   stödda variant (deras "Alternative setup with A or CNAME records"),
   certifikatet förnyas automatiskt ändå, och domänen behöver inga fler
   poster hos Vercel än de två som redan finns.

Byt bara om DNS *ska* flyttas av något annat skäl — och då: ta bort
DS-posten först, vänta ut TTL:en, flytta nameservrarna, och lägg in
tabellen ovan hos Vercel innan trafiken svänger över.

## Relaterat

- `security.txt` (samma skanning, separat kontaktväg för sårbarhets-
  rapportering) — se [public/.well-known/security.txt](../public/.well-known/security.txt)
  och [public/security.txt](../public/security.txt) (duplicerad på
  rot-nivå för skannrar som inte kollar `.well-known/`, se
  [vercel.json](../vercel.json) för varför bara `.well-known/`-versionen
  annars fastnade i SPA-catch-all-regeln).
