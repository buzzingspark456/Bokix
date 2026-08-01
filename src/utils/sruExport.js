export function generateSRU(company, raOmsattning, raKostnader, raResultat) {
  const orgNr = company?.orgNumber ? company.orgNumber.replace(/\D/g, '') : '';
  const cName = company?.name || 'Okänt Företag';
  
  // INFO.SRU
  let infoSru = '';
  infoSru += `*DATABESKRIVNING_START\r\n`;
  infoSru += `*PRODUKT "Bokix" 1.0\r\n`;
  infoSru += `*FILMNAMN INFO.SRU\r\n`;
  infoSru += `*DATABESKRIVNING_SLUT\r\n`;
  infoSru += `*UPPGIFTSLAMNARE_START\r\n`;
  infoSru += `*ORGNR ${orgNr}\r\n`;
  infoSru += `*NAMN ${cName}\r\n`;
  infoSru += `*UPPGIFTSLAMNARE_SLUT\r\n`;

  // BLANKETTER.SRU
  // Vi gör en förenklad NE-blankett (enskild firma) eller INK2 (AB) 
  // Detta är ett mock-exempel på SRU format
  let blankettSru = '';
  blankettSru += `*BLANKETT INK2-2026\r\n`;
  blankettSru += `*IDENTITET ${orgNr} ${new Date().toISOString().split('T')[0].replace(/-/g, '')} \r\n`;
  blankettSru += `*NAMN ${cName}\r\n`;
  blankettSru += `#7010 ${Math.round(raResultat)}\r\n`; // Exempel på skattekod för resultat
  blankettSru += `#7020 ${Math.round(raOmsattning)}\r\n`; // Exempel
  blankettSru += `#7030 ${Math.round(raKostnader)}\r\n`; // Exempel
  blankettSru += `*BLANKETTSLUT\r\n`;
  blankettSru += `*FILSLUT\r\n`;

  return { infoSru, blankettSru };
}
