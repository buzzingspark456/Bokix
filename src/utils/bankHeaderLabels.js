// Svenska namn på kolumnrubriker som banker exporterar på engelska (app-
// bankerna, engelskt språkval i internetbanken, utländska konton). Rubriken
// i filen går inte att ändra, men i kolumnvalet visas "Bokföringsdag
// (booking_date)" i stället för bara "booking_date". Svenska rubriker
// visas som de är.
const SWEDISH = {
  'booking date': 'Bokföringsdag',
  'transaction date': 'Transaktionsdag',
  'value date': 'Valutadag',
  'posting date': 'Bokföringsdag',
  'posted': 'Bokförd',
  'date': 'Datum',
  'description': 'Beskrivning',
  'narrative': 'Beskrivning',
  'details': 'Detaljer',
  'text': 'Text',
  'payee': 'Mottagare',
  'merchant': 'Butik',
  'counterparty': 'Motpart',
  'counterparty name': 'Motpart',
  'memo': 'Meddelande',
  'title': 'Rubrik',
  'amount': 'Belopp',
  'transaction amount': 'Belopp',
  'value': 'Belopp',
  'currency': 'Valuta',
  'debit': 'Uttag',
  'withdrawal': 'Uttag',
  'money out': 'Uttag',
  'paid out': 'Uttag',
  'outflow': 'Uttag',
  'credit': 'Insättning',
  'deposit': 'Insättning',
  'money in': 'Insättning',
  'paid in': 'Insättning',
  'inflow': 'Insättning',
  'balance': 'Saldo',
  'balance after': 'Saldo efter',
  'running balance': 'Saldo',
  'closing balance': 'Slutsaldo',
  'reference': 'Referens',
  'message': 'Meddelande',
  'note': 'Anteckning',
  'notes': 'Anteckning',
  'category': 'Kategori',
  'type': 'Typ',
  'transaction type': 'Typ',
  'status': 'Status',
  'id': 'Id',
  'transaction id': 'Transaktions-id',
  'account': 'Konto',
  'account number': 'Kontonummer',
};

const normalize = (h) => (h ?? '').toString().trim().toLowerCase().replace(/[.:]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

/** "booking_date" -> "Bokföringsdag (booking_date)". Okända rubriker oförändrade. */
export function bankHeaderLabel(header) {
  const sv = SWEDISH[normalize(header)];
  return sv && sv.toLowerCase() !== normalize(header) ? `${sv} (${header})` : header;
}
