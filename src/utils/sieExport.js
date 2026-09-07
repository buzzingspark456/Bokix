import { getDebet, getKredit } from './verificationAmounts';
import { encodeCp437 } from './sieCharset';
import { computeLedger, fiscalYearBounds } from './reportCalculations';

// Bugkritiskt (kodgranskning, se git-historiken): den här filen var
// tidigare aldrig faktiskt kopplad till en knapp någonstans i appen —
// bara #GEN/#RAR/kontoplan/verifikationer skrevs, ingen #IB/#UB, och tre
// egna fel gjorde den orealistisk att lita på om den NÅGONSIN skulle
// användas: `company.orgNumber` (fältet heter `orgNr` överallt annars i
// appen — #ORGNR föll alltså alltid bort tyst), en hårdkodad serie "A"
// (oavsett verifikationens EGNA `series`), och `#RAR` som alltid använde
// INNEVARANDE kalenderår istället för företagets faktiska `fiscalYear`.
// Landningssidans FAQ och prissidan påstår redan idag "SIE4-export — din
// bokföring är alltid din" — ett påstående som inte varit sant förrän nu.
export function generateSIE4(company, accounts, verifications) {
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const orgNr = company?.orgNr ? company.orgNr.replace(/\D/g, '') : '';
  const cName = company?.name || 'Okänt Företag';

  let sieString = '';

  // Header
  sieString += '#FLAGGA 0\r\n';
  sieString += '#PROGRAM "Bokix" 1.0\r\n';
  sieString += '#FORMAT PC8\r\n';
  sieString += `#GEN ${currentDate}\r\n`;
  sieString += '#SIETYP 4\r\n';
  sieString += `#FNAMN "${cName}"\r\n`;
  if (orgNr) {
    sieString += `#ORGNR "${orgNr}"\r\n`;
  }

  // Räkenskapsår — företagets EGNA fiscalYear (samma helper som resten av
  // appens rapporter redan använder för att räkna ut aktuellt
  // räkenskapsårs start/slut), inte alltid innevarande kalenderår.
  const { start: rarStart, end: rarEnd } = fiscalYearBounds(company?.fiscalYear, new Date());
  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  sieString += `#RAR 0 ${fmt(rarStart)} ${fmt(rarEnd)}\r\n`;

  // Kontoplan
  accounts.forEach(acc => {
    sieString += `#KONTO ${acc.code} "${acc.name}"\r\n`;
  });

  // Ingående/utgående balanser — härledda ur samma bokförda historik som
  // resten av appens rapporter (computeLedger), inte en egen separat
  // balansberäkning. Det här är det som gör en exporterad fil faktiskt
  // återimporterbar (av Bokix egen nya SIE4-import, eller ett annat
  // program) — utan #IB/#UB "börjar" varje konto om från noll för den som
  // läser filen.
  const ledger = computeLedger(verifications, accounts, rarStart, rarEnd);
  ledger.accounts.forEach(acc => {
    if (Math.abs(acc.openingBalance) > 0.005) {
      sieString += `#IB 0 ${acc.code} ${acc.openingBalance.toFixed(2)}\r\n`;
    }
    if (Math.abs(acc.closingBalance) > 0.005) {
      sieString += `#UB 0 ${acc.code} ${acc.closingBalance.toFixed(2)}\r\n`;
    }
  });

  // Verifikationer
  // #VER {serie} {nummer} {datum YYYYMMDD} "{beskrivning}"
  verifications.forEach(ver => {
    if ((ver.status || 'booked') === 'draft') return; // utkast är inte bokförda och exporteras inte
    const verDate = ver.date.replace(/-/g, '');
    const vNum = ver.number.replace(/\D/g, ''); // Extract numeric part of ver number
    const series = ver.series || 'A';

    sieString += `#VER ${series} ${vNum} ${verDate} "${ver.description}"\r\n`;
    sieString += '{\r\n';

    ver.rows.forEach(row => {
      // #TRANS {konto} {} {belopp}
      // Belopp i SIE4: debet är positivt, kredit är negativt
      const amount = getDebet(row) - getKredit(row);
      if (amount !== 0) {
        // Formatera med max 2 decimaler
        sieString += `    #TRANS ${row.account} {} ${amount.toFixed(2)}\r\n`;
      }
    });

    sieString += '}\r\n';
  });

  return sieString;
}

// Bugkritiskt: precis som sruExport.js:s encodeWindows1252 löser för
// windows-1252 — `new Blob([sträng], {type:'...charset=X'})` kodar
// ALLTID JS-strängen som UTF-8 oavsett deklarerad charset. Utan det här
// steget hade filen deklarerat `#FORMAT PC8` men innehållit UTF-8-bytes,
// och å/ä/ö i bolags-/kontonamn hade blivit fel för varje program som
// litar på deklarationen (exakt den bugg den här filen hade innan den
// någonsin kopplades till en nedladdningsknapp). encodeCp437 (delad med
// den nya SIE4-importern i sieImport.js/sieCharset.js) gör den faktiska
// byte-kodningen.
function triggerDownload(filename, content) {
  const blob = new Blob([encodeCp437(content)], { type: 'text/plain;charset=x-user-defined' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Bygger och laddar ner en SIE4-fil (.se) för hela företagets bokföring.
 * `.se` (inte `.si`) eftersom det här är en fullständig engångsexport av
 * allt, i linje med SIE4E-konventionen — inte ett inkrementellt
 * import-underlag (`.si`). */
export function downloadSie4(company, accounts, verifications) {
  const sieString = generateSIE4(company, accounts, verifications);
  const filename = `${(company?.name || 'bokforing').replace(/[^a-zA-Z0-9åäöÅÄÖ_ -]/g, '')}.se`;
  triggerDownload(filename, sieString);
}
