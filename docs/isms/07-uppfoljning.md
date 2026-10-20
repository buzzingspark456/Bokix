# Uppföljning, revision och förbättring

Avsnitt 9.1–10.2 i ISO/IEC 27001:2022. Version 1, 2026-10-18.

## Årshjul

| När | Vad | Vem |
|---|---|---|
| Varje månad | Titta igenom Systemstatus och händelser i /internal, larmmejl, Vercels fel | Driftansvarig |
| Varje kvartal | Behörighetsgenomgång hos alla leverantörer, enhetskontroll, återställningsprov, mätvärdena nedan | Driftansvarig |
| Varje år (januari) | Riskbedömning, genomgång av register och lagförteckning | Informationssäkerhetsansvarig |
| Varje år (februari) | Genomgång av rutinerna tillsammans (medvetenhet) | Båda |
| Varje år (mars) | Internrevision | Se nedan |
| Varje år (april) | Ledningens genomgång | Båda |
| Vid behov | Riskbedömning efter incident, ny leverantör eller ny sorts data | Informationssäkerhetsansvarig |

## Mätvärden

Följs upp varje kvartal mot målen i [02-policy-roller-och-mal.md](02-policy-roller-och-mal.md#mål-för-20262027).

| Kvartal | Återställningsprov (ok/fel, tid) | Inaktuella konton borttagna | Tvåfaktor % | Öppna höga sårbarheter | Incidenter | Upptid % |
|---|---|---|---|---|---|---|
| 2026 K4 | | | | | | |
| 2027 K1 | | | | | | |
| 2027 K2 | | | | | | |
| 2027 K3 | | | | | | |

## Internrevision

Med två personer granskar grundarna varandras områden (den som äger ett
område reviderar det inte själv), eller så anlitas en extern internrevisor.

Plan per revision:
1. Omfattning: vilka avsnitt i standarden och vilka åtgärder i bilaga A.
   Under tre år ska allt ha granskats.
2. Kontrollera mot bevis: följs rutinen, finns protokollen, stämmer
   tillämpbarhetsförklaringen med verkligheten?
3. Skriv rapport: omfattning, vad som granskades, avvikelser (större,
   mindre), förbättringsförslag, slutsats.
4. Varje avvikelse förs in i avvikelseloggen nedan.

Mall för rapport:

```
Internrevision ÅÅÅÅ-MM-DD
Revisor:
Omfattning:
Granskat (dokument, bevis, stickprov):
Avvikelser (nr, krav, vad, större/mindre):
Förbättringsförslag:
Slutsats: fungerar ledningssystemet som avsett? Ja/Delvis/Nej
```

## Ledningens genomgång

Minst en gång per år. Protokollet är bevis för revisorn.

Mall:

```
Ledningens genomgång ÅÅÅÅ-MM-DD
Närvarande:
1. Status på åtgärder från förra genomgången
2. Ändringar i yttre och inre förhållanden (lagar, kunder, leverantörer, ny funktionalitet)
3. Intressenternas behov och förväntningar
4. Resultat: avvikelser och korrigerande åtgärder, mätvärden, revisionsresultat, måluppfyllelse
5. Synpunkter från kunder och andra intressenter
6. Riskbedömningen och åtgärdsplanen
7. Möjligheter till förbättring
Beslut:
- Ändringar i policy, mål, risknivåer
- Resurser (tid, pengar)
- Nya åtgärder (ansvarig, datum)
```

## Avvikelser och incidenter

En avvikelse är när ett krav (standarden, en rutin, en lag) inte uppfylls.
En incident är en händelse som skadat eller kunnat skada informationen.
Båda förs in här.

För varje post: åtgärda direkt det som går, hitta orsaken, gör en
korrigerande åtgärd så det inte händer igen, och kontrollera senare att
åtgärden fungerade.

| Nr | Datum | Typ (avvikelse/incident) | Vad hände | Orsak | Åtgärd | Ansvarig | Klar | Effekt kontrollerad |
|---|---|---|---|---|---|---|---|---|
| A1 | 2026-10-01 | Incident (risk) | R2-nyckel klistrades in i en chatt med AI-verktyg | Nyckel hanterades i klartext | Rulla nyckeln (Å4) | Driftansvarig | | |
| A2 | 2026-10-18 | Avvikelse | Startfel kunde tolkas som nytt konto och spara ett tomt företag över kundens data | Fel i felhanteringen vid inloggning | Rättat i commit 6c67bc6 | Kod | 2026-10-18 | Test av startflödet (app-harness-start-kopia.mjs) |

## Bevislogg

Allt som visar att rutinerna följs. Själva filerna sparas i den delade
mappen (inte i git om de innehåller kunddata eller nycklar).

| Datum | Vad | Fil/plats | Vem |
|---|---|---|---|
| 2026-10-01 | Radnivåskyddet provat med anon-nyckeln, allt stängt | Anteckning i projektets minne | Grundarna |
| 2026-10-13 | INK4-fil godkänd i Skatteverkets testtjänst | Testfiler i Downloads | Grundarna |
| 2026-10-18 | Ledningssystemets dokument version 1 | docs/isms/ i git | Grundarna |
| 2026-10-18 | npm audit: 2 kritiska och 1 hög sårbarhet åtgärdade; Dependabot och audit i CI på | .github/ i git | Kod |
| 2026-10-18 | Vercels funktioner flyttade från Washington (iad1) till Frankfurt (fra1) | vercel.json, x-vercel-id-huvudet | Kod |
| 2026-10-18 | Adminpanelen kräver Face ID eller tvåfaktor; nekade försök loggas som admin_weak_login | api/admin/index.js | Kod |
| 2026-10-20 | Supabase flyttat från Frankfurt till Stockholm (exakt kopia, rad för rad kontrollerad) och funktionerna från fra1 till arn1 | Jämförelseskript, x-vercel-id arn1, inloggning i Stockholm | Grundarna och kod |
| | | | |
