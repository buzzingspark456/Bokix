# Informationssäkerhetspolicy, roller och mål

Avsnitt 5.1–5.3, 6.2 och 7.1–7.5 i ISO/IEC 27001:2022.

## Informationssäkerhetspolicy

Godkänd av: ____________________ och ____________________ Datum: __________

Bokix finns för att små företag ska kunna lita på sin bokföring. Därför
gäller följande:

1. **Konfidentialitet.** Kundernas bokföring och personuppgifter är bara
   tillgängliga för kunden själv och de personer kunden bjuder in. Grundarna
   läser inte kunddata utan att kunden bett om hjälp eller en incident kräver
   det, och det loggas.
2. **Riktighet.** Det som bokförs ska inte kunna ändras eller försvinna utan
   spår. Ändringar av sparad data görs bara via appens egna flöden.
3. **Tillgänglighet.** Kundernas data ska gå att få tillbaka efter fel, och
   räkenskapsinformation ska finnas kvar i sju år, även om kunden slutar.
4. **Lagar och avtal.** Bokföringslagen, GDPR och avtalen med kunder och
   leverantörer följs.
5. **Riskbaserat.** Åtgärder väljs utifrån en riskbedömning som görs om minst
   en gång per år och vid större ändringar.
6. **Ständig förbättring.** Incidenter, avvikelser och revisioner leder till
   åtgärder som följs upp.
7. **Alla ansvarar.** Den som arbetar med Bokix följer rutinerna i
   [05-rutiner.md](05-rutiner.md) och rapporterar misstänkta incidenter direkt.

Policyn ses över minst en gång per år vid ledningens genomgång.

## Roller och ansvar

Bokix har två grundare. Fyll i namnen.

| Roll | Vem | Ansvar |
|---|---|---|
| Högsta ledning | Båda grundarna | Godkänner policy och risknivåer, ger tid och pengar, leder ledningens genomgång |
| Informationssäkerhetsansvarig | Grundare: __________ | Äger dokumenten, riskregistret och åtgärdsplanen; rapporterar till ledningen |
| Driftansvarig | Grundare: __________ | Konton hos leverantörer, behörigheter, säkerhetskopior, övervakning |
| Incidentansvarig | Den som upptäcker en incident leder den tills den andra tar över | Följer incidentrutinen |
| Dataskydd (GDPR) | Informationssäkerhetsansvarig | Registerförteckning, personuppgiftsbiträdesavtal, anmälan till IMY |

Med bara två personer kan alla uppgifter inte delas upp. Därför gäller att
de känsligaste åtgärderna (radera kunddata, ändra produktionsdatabasen för
hand, rulla nycklar) ska meddelas den andra grundaren i förväg eller direkt
efteråt, och loggas (se [05-rutiner.md](05-rutiner.md#behörigheter)).

## Mål för 2026–2027

Mätbara, följs upp vid ledningens genomgång.

| Mål | Mått | Mål­värde |
|---|---|---|
| Kunddata går att återställa | Lyckat återställningsprov av ett företag från nattkopian | 1 gång per kvartal |
| Inga obehöriga konton | Genomgång av behörigheter hos alla leverantörer | 1 gång per kvartal, 0 inaktuella konton kvar |
| Tvåfaktor överallt | Andel adminkonton (GitHub, Vercel, Supabase, Stripe, Cloudflare, Resend, Google) med tvåfaktor | 100 % |
| Sårbarheter åtgärdas | Kritiska och höga sårbarheter i beroenden | Åtgärdade inom 14 dagar |
| Incidenter hanteras | Incidenter med åtgärd och lärdom dokumenterad | 100 % |
| Tjänsten är uppe | Upptid för bokix.se mätt av extern övervakare | 99,5 % per månad |

## Resurser, kompetens och medvetenhet

- Tid: informationssäkerhetsansvarig avsätter minst en halv dag i månaden för
  uppföljning, plus tid för åtgärdsplanen.
- Pengar: Supabase Pro och betalda planer där det behövs för säkerheten
  (säkerhetskopior, skydd mot läckta lösenord) budgeteras.
- Kompetens: båda grundarna läser rutinerna och går igenom dem tillsammans en
  gång per år. Genomgången noteras i [07-uppfoljning.md](07-uppfoljning.md#bevislogg).
- Medvetenhet: nätfiske, lösenord, tvåfaktor och vad som räknas som incident
  tas upp i den årliga genomgången.

## Kommunikation

| Vad | Till vem | Hur | Vem |
|---|---|---|---|
| Personuppgiftsincident | IMY | IMY:s e-tjänst inom 72 timmar | Dataskydd |
| Incident som påverkar kunder | Berörda kunder | E-post och /nyheter | Informationssäkerhetsansvarig |
| Säkerhetsfrågor från kunder | Kunden | support@bokix.se | Den som svarar |
| Ändrade villkor eller underbiträden | Alla kunder | E-post i förväg | Dataskydd |

## Dokumenterad information

Dokumenten ligger i `docs/isms/` i git. Versionshistoriken i git är
ändringsloggen. Bevis (protokoll, skärmdumpar, loggutdrag) sparas i en
privat mapp som båda grundarna når, med datum i filnamnet, och listas i
bevisloggen i [07-uppfoljning.md](07-uppfoljning.md#bevislogg). Bevis som
innehåller kunddata sparas aldrig i git.
