export function generateSIE4(company, accounts, verifications) {
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const orgNr = company?.orgNumber ? company.orgNumber.replace(/\D/g, '') : '';
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

  // Räkenskapsår (vi antar nuvarande kalenderår för enkelhetens skull i MVP)
  const currentYear = new Date().getFullYear();
  sieString += `#RAR 0 ${currentYear}0101 ${currentYear}1231\r\n`;

  // Kontoplan
  accounts.forEach(acc => {
    sieString += `#KONTO ${acc.code} "${acc.name}"\r\n`;
  });

  // Verifikationer
  // #VER A {nummer} {datum YYYYMMDD} "{beskrivning}"
  verifications.forEach(ver => {
    const verDate = ver.date.replace(/-/g, '');
    const vNum = ver.number.replace(/\D/g, ''); // Extract numeric part of ver number
    
    // Säkerställ att vi skickar rätt format, #VER kräver serie, nr, datum, text
    sieString += `#VER A ${vNum} ${verDate} "${ver.description}"\r\n`;
    sieString += '{\r\n';
    
    ver.rows.forEach(row => {
      // #TRANS {konto} {} {belopp}
      // Belopp i SIE4: debet är positivt, kredit är negativt
      const amount = (row.debet || 0) - (row.kredit || 0);
      if (amount !== 0) {
        // Formatera med max 2 decimaler
        sieString += `    #TRANS ${row.account} {} ${amount.toFixed(2)}\r\n`;
      }
    });
    
    sieString += '}\r\n';
  });

  return sieString;
}
