import { paymentAccounts } from './plainBooking';

// Vilket konto pengarna kom ifrån. Svaret säger också HUR säkert det är, så
// att gränssnittet aldrig presenterar en gissning som ett facit:
//   history  företaget har bokfört samma leverantör förut med det här kontot
//   found    kvittot självt visar det (kort, Swish, kontant, obetald faktura)
//   guess    inget säger något, förvalt bankkonto som man ska kontrollera
//
// Kort och Swish dras från bankkontot, kontant från kassan (1910), och en
// faktura som inte visar någon betalning är ännu obetald (2440).
const METHOD_TEXT = {
  card: 'kvittot visar kortbetalning',
  swish: 'kvittot visar Swish',
  cash: 'kvittot visar kontant betalning',
  invoice: 'fakturan är inte betald ännu',
};

export function decidePayAccount({ history, paymentMethod, accounts }) {
  const list = accounts || [];
  const exists = (code) => list.some(a => String(a.code) === String(code));
  const bank = (() => {
    const banks = paymentAccounts(list).filter(a => String(a.code) !== '1910');
    return (banks.find(a => a.code === '1930') || banks[0] || { code: '1930' }).code;
  })();

  if (history?.payAccount && exists(history.payAccount)) {
    return { code: String(history.payAccount), state: 'history', source: 'Samma som förra gången för leverantören' };
  }
  if (paymentMethod === 'card' || paymentMethod === 'swish') {
    return { code: bank, state: 'found', source: METHOD_TEXT[paymentMethod] };
  }
  if (paymentMethod === 'cash' && exists('1910')) {
    return { code: '1910', state: 'found', source: METHOD_TEXT.cash };
  }
  if (paymentMethod === 'invoice' && exists('2440')) {
    return { code: '2440', state: 'found', source: METHOD_TEXT.invoice };
  }
  return { code: bank, state: 'guess', source: 'Vi hittade inget om hur det betalades' };
}
