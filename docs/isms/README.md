# Bokix ledningssystem för informationssäkerhet (ISMS)

Underlag för att arbeta enligt ISO/IEC 27001:2022 och, när det blir aktuellt,
certifieras. Skrivet 2026-10-18. Gäller Bokix (bokföringsprogrammet på
bokix.se) och de två grundarna som driver det.

Viktigt: Bokix är **inte certifierat**. Skriv aldrig "ISO 27001" på
webbplatsen, i avtal eller i säljmaterial förrän ett ackrediterat
certifieringsorgan har utfärdat ett certifikat. Det som får sägas i dag är
att arbetet följer standardens struktur.

Standarden själv (SS-EN ISO/IEC 27001:2022) köps från SIS. Dokumenten här är
skrivna med egna ord och följer standardens avsnitt 4–10 och bilaga A.

## Dokumenten

| Fil | Vad den svarar på | Avsnitt i standarden |
|---|---|---|
| [01-omfattning-och-kontext.md](01-omfattning-och-kontext.md) | Vad som omfattas, vilka som berörs, vilka krav som gäller | 4.1–4.4 |
| [02-policy-roller-och-mal.md](02-policy-roller-och-mal.md) | Informationssäkerhetspolicy, vem som gör vad, mätbara mål | 5.1–5.3, 6.2, 7.1–7.5 |
| [03-riskhantering.md](03-riskhantering.md) | Metod, riskregister och åtgärdsplan | 6.1, 8.2, 8.3 |
| [04-tillampbarhet.md](04-tillampbarhet.md) | Alla 93 åtgärder i bilaga A: gäller den, hur, var finns beviset | 6.1.3 d |
| [05-rutiner.md](05-rutiner.md) | Rutiner per område: åtkomst, kryptering, säkerhetskopior, incidenter, leverantörer, utveckling, enheter m.m. | 5.37 m.fl. |
| [06-register.md](06-register.md) | Tillgångar och leverantörer | 5.9, 5.19–5.23 |
| [07-uppfoljning.md](07-uppfoljning.md) | Mätning, internrevision, ledningens genomgång, avvikelser | 9.1–10.2 |
| [08-svensk-lag.md](08-svensk-lag.md) | Bokföringslagen, GDPR, dataskyddslagen, LEK, cybersäkerhetslagen m.fl. | 4.2, 5.31 |

## Läget i dag

Mycket av det tekniska finns redan i koden (radnivåskydd i databasen,
kryptering, nattliga krypterade kopior, sjuårsarkiv, rate limits, felrapporter
och larmmejl). Det som saknas är främst rutiner som följs och sparas som
bevis, plus några tekniska luckor. Allt öppet står i åtgärdsplanen i
[03-riskhantering.md](03-riskhantering.md#åtgärdsplan).

## Vägen till certifikat

1. Grundarna går igenom och godkänner dokumenten (signera och datera policyn).
2. Åtgärdsplanen genomförs. De punkter som bara grundarna kan göra är märkta
   "Grundarna".
3. Systemet körs i minst tre månader med sparade bevis: genomgång av
   behörigheter, återställningsprov, incidentlogg, mätvärden.
4. En internrevision och en ledningens genomgång görs och protokollförs
   (mallar i [07-uppfoljning.md](07-uppfoljning.md)).
5. Offert från två–tre certifieringsorgan som är ackrediterade av Swedac.
   Revisionen görs i två steg: först dokumenten, sedan att de följs.
6. Därefter uppföljande revision varje år och ny certifiering vart tredje år.

## Underhåll

Dokumenten ägs av informationssäkerhetsansvarig (se
[02-policy-roller-och-mal.md](02-policy-roller-och-mal.md)). De ses över minst
en gång per år och när något större ändras: ny leverantör, ny funktion som
hanterar ny sorts data, en incident. Ändringar görs i git, så historiken är
versionshanteringen.
