/**
 * SRU-fil (INFO.SRU + BLANKETTER.SRU) för hela INK2R — balansräkningen
 * (`computeInk2r`, ink2r.js) och resultaträkningen (`computeInk2rResultat`,
 * ink2rResultat.js) — byggd av samma sorts rader `{ fieldCode, amount }`
 * från båda modulerna. Fältkoderna är hämtade kontonummer-exakt ur
 * BAS-intressenternas Förenings officiella kopplingstabell (bas.se,
 * utgåva 2024-11-19) — se respektive modul för detaljer och de enstaka
 * fall (INK2R rad 2.45–2.50 fick fel kod i en tidigare, föråldrad källa
 * men är nu verifierade; se git-historiken om du undrar) som krävde extra
 * eftertanke.
 */
export function generateInk2rSru(company, ink2r, resultRows, periodEndISO) {
  const orgNr = (company?.orgNr || '').replace(/\D/g, '');
  const cName = company?.name || 'Okänt Företag';
  const genDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const periodDate = (periodEndISO || '').replace(/-/g, '');

  let infoSru = '';
  infoSru += '#DATABESKRIVNING_START\r\n';
  infoSru += '#PRODUKT SRU\r\n';
  infoSru += '#SKAPAD ' + genDate + '\r\n';
  infoSru += '#PROGRAM Bokix 1.0\r\n';
  infoSru += '#FILNAMN BLANKETTER.SRU\r\n';
  infoSru += '#DATABESKRIVNING_SLUT\r\n';
  infoSru += '#MEDIELEV_START\r\n';
  infoSru += `#ORGNR ${orgNr}\r\n`;
  infoSru += '#MEDIELEV_SLUT\r\n';

  let blankettSru = '';
  blankettSru += '#BLANKETT INK2R-2026P4\r\n';
  blankettSru += `#IDENTITET ${orgNr} ${periodDate}\r\n`;
  blankettSru += `#NAMN ${cName}\r\n`;
  [...ink2r.rows, ...(resultRows || [])]
    .filter(r => r.fieldCode)
    .forEach(r => {
      blankettSru += `#UPPGIFT ${r.fieldCode} ${Math.round(r.amount)}\r\n`;
    });
  blankettSru += '#BLANKETTSLUT\r\n';
  blankettSru += '#FIL_SLUT\r\n';

  return { infoSru, blankettSru };
}

// Bugkritiskt: `new Blob([sträng], {type: '...charset=windows-1252'})`
// kodar INTE själva bytesen som windows-1252 bara för att `type` säger
// det — Blob-konstruktorn kodar alltid JS-strängar som UTF-8, oavsett
// deklarerad charset (webbplattformens `TextEncoder` kan bara producera
// UTF-8). Utan den här funktionen blev filen alltså deklarerad som
// windows-1252 men innehöll UTF-8-bytes — å/ä/ö i ett bolagsnamn (t.ex.
// "Åkeriet i Norr AB") hade blivit rappakalja för en läsare (inklusive
// Skatteverkets egen filöverföringstjänst) som litar på deklarationen.
// windows-1252 delar Latin-1:s kodpunkter rakt av för 0x00–0xFF utom
// 0x80–0x9F (typografiska citattecken, euro-tecken m.m.) — ett spann som
// aldrig förekommer i organisationsnamn — så en enkel per-tecken-
// avkortning täcker allt som faktiskt kan stå i en SRU-fil. Tecken
// utanför Latin-1 (i praktiken aldrig i ett svenskt företagsnamn) blir
// "?" hellre än att tyst korrumpera resten av filen.
export function encodeWindows1252(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code <= 0xFF ? code : 0x3F;
  }
  return bytes;
}

function triggerDownload(filename, content) {
  const blob = new Blob([encodeWindows1252(content)], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Laddar ner INFO.SRU och BLANKETTER.SRU som två separata filer — det är
 * så Skatteverkets filöverföringstjänst förväntar sig dem (ett par filer
 * med just de namnen, inte en enda kombinerad fil). */
export function downloadInk2rSru(company, ink2r, resultRows, periodEndISO) {
  const { infoSru, blankettSru } = generateInk2rSru(company, ink2r, resultRows, periodEndISO);
  triggerDownload('INFO.SRU', infoSru);
  triggerDownload('BLANKETTER.SRU', blankettSru);
}
