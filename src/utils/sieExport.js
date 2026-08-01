const quote = (value = '') => `"${String(value).replaceAll('"', '""')}"`;

const formatDate = (date) => String(date || '').replaceAll('-', '');

export function generateSIE4({ company = {}, accounts = [], verifications = [] }) {
  const lines = [
    '#FLAGGA 0',
    '#FORMAT PC8',
    '#PROGRAM "Bokix" 1.0',
    `#GEN ${formatDate(new Date().toISOString().split('T')[0])}`,
    '#SIETYP 4',
    `#FNAMN ${quote(company.name || '')}`,
    `#ORGNR ${company.orgNr || ''}`,
    '#VALUTA SEK',
  ];

  accounts.forEach(account => {
    lines.push(`#KONTO ${account.code} ${quote(account.name || '')}`);
  });

  verifications
    .slice()
    .sort((a, b) => `${a.date}${a.number}`.localeCompare(`${b.date}${b.number}`))
    .forEach(verification => {
      lines.push(`#VER "A" ${verification.number || ''} ${formatDate(verification.date)} ${quote(verification.description || '')}`);
      verification.rows.forEach(row => {
        const amount = Number(row.debet || 0) - Number(row.kredit || 0);
        if (amount !== 0) {
          lines.push(`#TRANS ${row.account} {} ${amount.toFixed(2)} ${quote('')}`);
        }
      });
      lines.push('');
    });

  return `${lines.join('\n')}\n`;
}
