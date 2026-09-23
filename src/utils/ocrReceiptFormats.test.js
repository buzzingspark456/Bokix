import { describe, it, expect } from 'vitest';
import { parseReceiptText, cleanSupplierName } from './ocrReceipt.js';

// Kvittoformat från riktiga svenska kassaregister och fakturasystem. Poängen
// är BREDDEN: tolkningen ska inte vara inpassad efter de två kvitton som råkade
// felanmälas, utan klara matbutik, restaurang, drivmedel, parkering, hotell,
// taxi, apotek, faktura, utländsk tjänst, retur och kvitton med flera
// momssatser. Varje fall kontrollerar det som faktiskt blir bokföring:
// beloppet, momsen och om avläsningen vågar kalla dem kontrollerade.
//
// Skrivs ett nytt fall in här: kontrollera facit för hand (netto + moms =
// brutto, och momsen mot satsen) innan det läggs till. Ett test som låser fast
// ett fel är värre än inget test.

const receipt = (lines) => parseReceiptText(lines.join('\n'));

describe('kvittoformat: belopp och moms', () => {
  it('matbutik med en momssats (12 %)', () => {
    const r = receipt([
      'ICA Supermarket Vasastan', 'Org.nr: 556000-1234', '2026-03-15 17:44',
      'Mjolk 1,5l 18,50', 'Brod 32,90', 'Kaffe 54,00',
      'Totalt SEK 105,40', 'Varav moms 12%: 11,29', 'Kort ****1234',
    ]);
    expect(r.amount).toBe(105.4);
    expect(r.vatRate).toBe(12);
    expect(r.vatAmount).toBe(11.29);
    expect(r.vatVerified).toBe(true);
    expect(r.paymentMethod).toBe('card');
  });

  it('restaurang: dricks ligger utanför momsen men i totalen', () => {
    const r = receipt([
      'Restaurang Gasten AB', 'Bord 12  2026-05-11 20:15',
      'Dagens ratt 2 st 298,00', 'Lattol 2 st 98,00',
      'Summa 396,00', 'Moms 12% 42,43', 'Dricks 40,00', 'Att betala 436,00', 'Kortbetalning',
    ]);
    // Momsen gäller maten (396,00), inte dricksen: 42,43 stämmer mot 396,00.
    expect(r.amount).toBe(396);
    expect(r.vatRate).toBe(12);
    expect(r.vatVerified).toBe(true);
  });

  it('drivmedel med literpris på egen rad', () => {
    const r = receipt([
      'Circle K Solna', '2026-06-01 08:12', 'Diesel 34,52 l', 'Pris/l 19,49',
      'TOTALT 672,80', 'Moms 25% 134,56', 'Kortkop Mastercard', 'Pumpnr 4',
    ]);
    expect(r.amount).toBe(672.8);
    expect(r.vatAmount).toBe(134.56);
    expect(r.vatVerified).toBe(true);
    expect(r.accountCode).toBe('5611');
  });

  it('hotell: 12 % på rum och frukost', () => {
    const r = receipt([
      'Scandic Hotel', 'Org.nr 556200-3456', '2026-04-20',
      'Rum 1 natt 1 190,00', 'Frukost 145,00', 'Totalt 1 335,00', 'Moms 12% 143,04', 'Betalt med kort',
    ]);
    expect(r.amount).toBe(1335);
    expect(r.vatRate).toBe(12);
    expect(r.vatVerified).toBe(true);
  });

  it('taxi och tåg: 6 % på persontransport', () => {
    const taxi = receipt(['Taxi Stockholm', 'Kvitto 4455', '2026-05-02 23:10', 'Resa Arlanda - City 589,00', 'Totalt 589,00', 'Moms 6% 33,34', 'Kort']);
    expect(taxi.amount).toBe(589);
    expect(taxi.vatRate).toBe(6);
    expect(taxi.vatVerified).toBe(true);
    const tag = receipt(['SJ AB', 'Bokningsnummer SJ44231', '2026-10-01', 'Stockholm - Goteborg 645,00', 'Totalt 645,00', 'Moms 6% 36,51']);
    expect(tag.amount).toBe(645);
    expect(tag.vatRate).toBe(6);
    expect(tag.receiptNumber).toBe('SJ44231');
  });

  it('öresavrundning: det som ska betalas är totalen', () => {
    const r = receipt([
      'Byggmax', '2026-06-14', 'Skruv 89,50', 'Plank 245,30',
      'Summa 334,80', 'Oresavrundning 0,20', 'ATT BETALA 335,00', 'Moms 25% 67,00', 'Kort',
    ]);
    expect(r.amount).toBe(335);
    expect(r.vatAmount).toBe(67);
  });

  it('totalen står överst på kvittot', () => {
    const r = receipt([
      'Systembolaget', 'ATT BETALA 289,00', '2026-09-18 16:30',
      'Alkoholfri dryck 3 st 89,00', 'Vatten 2 st 100,00', 'Moms 25% 57,80', 'Kvittonr 55123',
    ]);
    expect(r.amount).toBe(289);
    expect(r.vatVerified).toBe(true);
    expect(r.receiptNumber).toBe('55123');
  });

  it('kortterminalens rader blir varken belopp eller moms', () => {
    const r = receipt([
      'HEMKOP', 'Org nr 556400-5678', '2026-09-05 18:22', 'Varor 4 st',
      'TOTALT 342,50', 'Moms 12% 36,70', 'KORTKOP', 'Debit Mastercard',
      '**** **** **** 2056', 'AID: A0000000041010', 'TVR: 0000008002', 'Butiksnr: 20007131',
    ]);
    expect(r.amount).toBe(342.5);
    expect(r.vatAmount).toBe(36.7);
    expect(r.vatVerified).toBe(true);
  });

  it('faktura: netto plus moms blir att betala', () => {
    const r = receipt([
      'Nordlund Konsult AB', 'Faktura', 'Fakturanummer 2026104', 'Fakturadatum 2026-03-01',
      'Konsultarvode mars 10 000,00', 'Summa exkl. moms 10 000,00', 'Moms 25% 2 500,00',
      'Att betala 12 500,00', 'Bankgiro 123-4567',
    ]);
    expect(r.amount).toBe(12500);
    expect(r.vatAmount).toBe(2500);
    expect(r.amountVerified).toBe(true);
    expect(r.receiptNumber).toBe('2026104');
    expect(r.paymentMethod).toBe('invoice');
  });

  it('kvitto utan momsrad fyller ingen moms i', () => {
    const r = receipt(['Loppis Kungsholmen', '2026-09-12', 'Stol 150,00', 'Totalt 150,00', 'Kontant']);
    expect(r.amount).toBe(150);
    expect(r.vatAmount).toBeNull();
    expect(r.vatRateGuessed).toBe(true);
    expect(r.paymentMethod).toBe('cash');
  });
});

describe('kvitton med flera momssatser', () => {
  it('momstabell med två satser: momsen är avläst men inte EN sats', () => {
    const r = receipt([
      'COOP KONSUM', 'Org nr 556021-2345', '2026-04-02',
      'Bananer 24,90', 'Tvattmedel 89,00', 'TOTALT 113,90',
      'Moms% Netto Moms Brutto',
      '12,00 22,23 2,67 24,90',
      '25,00 71,20 17,80 89,00',
      'TOTAL MOMS 20,47', 'KONTOKORT 113,90',
    ]);
    expect(r.amount).toBe(113.9);
    expect(r.vatAmount).toBe(20.47);
    expect(r.vatRates).toEqual([25, 12]);
    // Inte en avvikelse: siffrorna går ihop, de är bara uppdelade.
    expect(r.vatMismatch).toBe(false);
    expect(r.amountGuessed).toBe(false);
  });

  it('två momsrader utan tabell räknas också ihop', () => {
    const r = receipt([
      'Apotek Hjartat', '2026-09-01', 'Receptfritt 129,00', 'Tidning 39,00',
      'TOTALT 168,00', 'Moms 25% 25,80', 'Moms 6% 2,21', 'TOTAL MOMS 28,01',
      'Kontant 200,00', 'Vaxel 32,00',
    ]);
    expect(r.amount).toBe(168);
    expect(r.vatAmount).toBe(28.01);
    expect(r.vatRates).toEqual([25, 6]);
    expect(r.vatMismatch).toBe(false);
  });

  it('en enda sats ger fortfarande en vanlig verifierad avläsning', () => {
    const r = receipt(['Butiken', 'TOTALT 899,00', '25% 719,20 179,80 899,00']);
    expect(r.vatRates).toBeNull();
    expect(r.vatRate).toBe(25);
    expect(r.vatVerified).toBe(true);
  });
});

describe('retur och utländsk valuta', () => {
  it('returkvitto märks som retur', () => {
    const r = receipt(['Clas Ohlson', '2026-07-07', 'RETUR Batterier -89,00', 'Totalt -89,00', 'Moms 25% -17,80']);
    expect(r.creditNote).toBe(true);
  });

  it('ett vanligt kvitto märks inte som retur, inte ens med kreditkort', () => {
    expect(receipt(['Butiken', 'Totalt 100,00', 'Moms 25% 20,00', 'Kreditkort']).creditNote).toBe(false);
  });

  it('svensk faktura i euro behåller valutan', () => {
    const r = receipt([
      'Nordic Design AB', 'Org.nr 556300-4567', 'Invoice 2026-45',
      'Design services 1 200,00 EUR', 'VAT 25% 300,00 EUR', 'Total EUR 1 500,00',
      'Momsreg.nr SE556300456701',
    ]);
    expect(r.currency).toBe('EUR');
    expect(r.amount).toBe(1500);
  });

  it('utländsk molntjänst blir omvänd skattskyldighet, inte svensk moms', () => {
    const r = receipt([
      'Stripe, Inc.', '354 Oyster Point Blvd', 'South San Francisco, CA',
      'Invoice 4F2E-0001', 'Date: 2026-02-01', 'Stripe Billing subscription $49.00', 'Total $49.00', 'VAT 0%',
    ]);
    expect(r.currency).toBe('USD');
    expect(r.vatRate).toBe(0);
    expect(r.reverseCharge).not.toBeNull();
  });
});

describe('leverantörens namn ur en logotyp', () => {
  it('väljer det rent utskrivna namnet framför den sönderlästa logotypen', () => {
    // Exakt så här läste OCR Dollarstores kvitto: logotypen i bitar överst,
    // namnet rent utskrivet raden under.
    const r = receipt([
      'MÅ', '-', '\ 1', '(DOLL ARS TORE ;', 'Ny fine pr: ices SS 7 very D',
      'Dollarstore', 'Org ne: 556537 1662', 'Gysnasievagen 18',
      'Totalt 4 24,00', 'Moms Belopp Netto Brutto', '6,00 1,36 22,64 24,00',
    ]);
    expect(r.supplier).toBe('Dollarstore');
    expect(r.supplierMatched).toBe(false);
  });

  it('dollartecken i en logotyp är ett S', () => {
    expect(cleanSupplierName('(DOLLAR$TORE ;')).toBe('DOLLARSTORE');
    expect(cleanSupplierName('| ~ICA MAXI~ |')).toBe('ICA MAXI');
  });

  it('namn på två rader hålls ihop', () => {
    const r = receipt(['JACKS IMPORT', '& VARUHUS', 'TELNR: 0910-373 75', 'SUMMA: 15.00', 'TOTAL MOMS 3.00']);
    expect(r.supplier).toBe('JACKS IMPORT & VARUHUS');
  });

  it('adress, org.nr och slogan blir aldrig leverantörsnamn', () => {
    const r = receipt([
      'Storgatan 4, Uppsala', 'Org nr 556123-4567', 'Kvitto',
      'Bokhandeln AB', 'Totalt 100,00', 'Moms 25% 20,00',
    ]);
    expect(r.supplier).toBe('Bokhandeln AB');
  });

  it('känd leverantör vinner fortfarande över radgissningen', () => {
    const r = receipt(['ICA Supermarket Vasastan', 'Totalt SEK 105,40', 'Varav moms 12%: 11,29']);
    expect(r.supplier).toBe('ICA');
    expect(r.supplierMatched).toBe(true);
  });
});
