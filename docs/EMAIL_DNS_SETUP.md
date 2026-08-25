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

## Relaterat

- `security.txt` (samma skanning, separat kontaktväg för sårbarhets-
  rapportering) — se [public/.well-known/security.txt](../public/.well-known/security.txt)
  och [public/security.txt](../public/security.txt) (duplicerad på
  rot-nivå för skannrar som inte kollar `.well-known/`, se
  [vercel.json](../vercel.json) för varför bara `.well-known/`-versionen
  annars fastnade i SPA-catch-all-regeln).
