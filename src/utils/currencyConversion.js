/**
 * currencyConversion.js — Räknar om ett kvittobelopp i utländsk valuta till
 * svenska kronor med en RIKTIG, publicerad växelkurs. Inget hittepå-tal.
 *
 * Bokföringslagen 4 kap 6 § kräver att löpande bokföring sker i SEK, och
 * Skatteverkets rekommendation är att använda dagskursen för den dag köpet
 * gjordes (inte dagens kurs, och inte ett schablonvärde). Källan här är
 * frankfurter.dev — ett gratis, nyckelfritt API som speglar Europeiska
 * centralbankens dagliga referenskurser, samma typ av källa andra svenska
 * bokföringsprogram bygger på. Infaller köpdatumet på en helg/bankfridag
 * returnerar API:et automatiskt närmast föregående bankdags kurs, precis
 * det man ska använda.
 *
 * Anropet görs direkt från klienten, INTE via en egen serverless function
 * — Bokix ligger på Vercels Hobby-plan med ett hårt tak på antal functions
 * (se commit 69f00eb), och en ny backend-endpoint bara för det här hade
 * varit fel avvägning för något som redan är ett fritt, CORS-öppet API.
 */

const FX_BASE_URL = 'https://api.frankfurter.dev/v1';

/**
 * @param {number} amount — Beloppet i den utländska valutan (t.ex. 45 för $45).
 * @param {string} currency — Valutakod, t.ex. 'USD', 'GBP', 'JPY'.
 * @param {string} [dateStr] — Köpdatum som 'YYYY-MM-DD'. Saknas det (kvittot
 *   gick inte att datumtolka) används dagens kurs som bästa möjliga gissning
 *   — bättre än inget, men mindre exakt än köpdagens kurs.
 * @returns {Promise<{ sek: number, rate: number, date: string } | null>}
 *   `sek` är omräknat och avrundat till 2 decimaler. `null` betyder att
 *   kursen inte gick att hämta (okänd valutakod, inget nät, API nere) —
 *   anroparen ska då INTE gissa ett belopp, bara be användaren fylla i det
 *   omräknade beloppet själv.
 */
export async function convertToSek(amount, currency, dateStr) {
  if (!amount || amount <= 0 || !currency || currency === 'SEK') return null;
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? dateStr : 'latest';
  try {
    const url = `${FX_BASE_URL}/${datePart}?base=${encodeURIComponent(currency)}&symbols=SEK`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.SEK;
    if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
    const sek = Math.round(amount * rate * 100) / 100;
    return { sek, rate, date: data.date || (datePart === 'latest' ? null : datePart) };
  } catch (err) {
    console.warn('[currencyConversion] Kunde inte hämta växelkurs:', err);
    return null;
  }
}
