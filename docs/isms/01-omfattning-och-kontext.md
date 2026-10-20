# Omfattning och sammanhang

Avsnitt 4.1–4.4 i ISO/IEC 27001:2022. Senast granskad 2026-10-18.

## Verksamheten

Bokix är ett webbaserat bokföringsprogram för små svenska företag: enskild
firma, aktiebolag, handels- och kommanditbolag, ekonomiska och ideella
föreningar. Kunderna bokför, fakturerar, fotograferar kvitton, kör lön och tar
fram moms, arbetsgivardeklaration, inkomstdeklaration och årsredovisning.
Bokix drivs av två grundare utan anställda. All drift sker i molntjänster;
Bokix har inga egna servrar eller lokaler.

## Omfattning

Ledningssystemet omfattar utveckling, drift och support av tjänsten Bokix
(app och webbplats på bokix.se) och den information tjänsten hanterar:

- kundernas bokföring, fakturor, kvitton och underlag, lönedata och
  personuppgifter om kundernas anställda, kunder och leverantörer
- kundkonton, inloggning och betalningar
- källkoden och driftmiljöerna
- grundarnas datorer och telefoner när de används för Bokix

Utanför omfattningen: grundarnas privata användning av datorer och konton,
och marknadsföringsmaterial som inte innehåller kunddata.

Bokix ansvarar inte för leverantörernas egna datacenter. De styrs genom
leverantörshanteringen (se [05-rutiner.md](05-rutiner.md#leverantörer) och
[06-register.md](06-register.md#leverantörer)).

## Yttre och inre förhållanden

Yttre:
- Bokföringslagen: räkenskapsinformation ska bevaras sju år efter
  räkenskapsårets utgång, läsbar och oförändrad.
- GDPR: Bokix är personuppgiftsbiträde åt kunderna för deras data och
  personuppgiftsansvarig för kundkonton. Personuppgiftsincidenter anmäls till
  IMY inom 72 timmar.
- Skatteverkets och Bolagsverkets filformat (SRU, eSKD, AGI) ändras varje år.
- Kunderna litar på att siffrorna stämmer: ett fel i moms eller skatt kostar
  kunden pengar.
- Angripare riktar in sig på ekonomisystem för att komma åt bankuppgifter,
  personnummer och fakturor (bedrägerier med ändrade bankgiron).
- Driften beror helt på några få molnleverantörer.

Inre:
- Två personer: få händer, men korta beslutsvägar.
- All data för en kund ligger i en rad i databasen (user_data.state). Ett fel
  vid sparning kan påverka hela kundens bokföring, därför finns
  sammanslagning vid krock och kopia vid krympning.
- Begränsad budget: gratisplaner används där det går (Supabase är i dag på
  gratisplanen).
- Mycket kod skrivs med hjälp av AI-verktyg; granskning och tester är därför
  viktiga.

## Intressenter och deras krav

| Intressent | Vad de förväntar sig |
|---|---|
| Kunder (företagare) | Att bokföringen är rätt, finns kvar i sju år, inte läcker och går att exportera |
| Kundernas redovisningskonsulter | Att bara se de företag de bjudits in till, med rätt behörighet |
| Kundernas anställda, kunder och leverantörer | Att deras personuppgifter skyddas (GDPR) |
| Skatteverket, Bolagsverket | Korrekta filer och underlag |
| IMY | Anmälan av personuppgiftsincidenter, laglig behandling |
| Leverantörer (Supabase, Vercel, Stripe m.fl.) | Att deras villkor följs |
| Grundarna | En tjänst som håller och inte riskerar företaget |

## Gränssnitt och beroenden

Tjänsten består av:
- webbappen (React) som körs i kundens webbläsare
- serverfunktioner på Vercel (`api/`) för betalningar, e-post, delning med
  konsult, nattjobb och administration
- databas, inloggning och fillagring i Supabase (Stockholm, Sverige)
- en krypterad kopia varje natt till Cloudflare R2 (EU)

Fullständig lista över leverantörer: [06-register.md](06-register.md#leverantörer).
