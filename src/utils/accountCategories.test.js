import { describe, it, expect } from 'vitest';
import { ACCOUNT_KEYWORD_RULES, guessAccountFromText } from './accountCategories';
import { parseReceiptText } from './ocrReceipt';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const kvitto = (rad) => `
  Fakturanummer 1234
  Datum 2026-05-10
  ${rad}
  Totalt 1 250,00
  Varav moms 25%: 250,00
`;

describe('kontoregler: varje kod finns i kontoplanen', () => {
  it('alla koder i nyckelordsreglerna är riktiga konton', () => {
    const codes = new Set(DEFAULT_ACCOUNTS.map(a => a.code));
    for (const { code } of ACCOUNT_KEYWORD_RULES) expect(codes.has(code), code).toBe(true);
  });
});

describe('kontoregler: träffar när texten säger vad det gäller', () => {
  const fall = [
    ['Städning av kontor, augusti', '5061'],
    ['Lokalvård kontoret', '5061'],
    ['Sophämtning kvartal 3', '5062'],
    ['Snöröjning vinter', '5064'],
    ['Fjärrvärme september', '5030'],
    ['Vattenavgift 2026', '5040'],
    ['Förbrukningsmaterial', '5460'],
    ['Städmaterial och rengöringsmedel', '5460'],
    ['Toalettpapper och hushållspapper', '5460'],
    ['Bilverkstad service', '5613'],
    ['Däckbyte 4 st', '5613'],
    ['Datorreparation', '5520'],
    ['Porto brev', '6250'],
    ['Frimärken 20 st', '6250'],
    ['Fast telefoni abonnemang', '6211'],
    ['Företagarna medlemsavgift', '6981'],
    ['Föreningsavgift branschorganisation', '6981'],
    ['Underentreprenör montage', '4610'],
    ['Legoarbete', '4670'],
    ['Bredband 1000 Mbit', '6230'],
  ];
  it.each(fall)('%s ger %s', (rad, kod) => {
    const parsed = parseReceiptText(kvitto(rad));
    expect(parsed.accountCode).toBe(kod);
    expect(parsed.accountGuessed).toBe(false);
  });
});

describe('kontoregler: gissar inte på det som kan betyda flera saker', () => {
  const tvetydiga = [
    'Reparation',
    'Medlemsavgift gym',
    'Kaffe till fikarummet',
    'Inköp varor',
    'Underhåll',
    'Diverse',
  ];
  it.each(tvetydiga)('"%s" blir ett förslag att kontrollera, inte ett facit', (rad) => {
    const parsed = parseReceiptText(kvitto(rad));
    expect(parsed.accountCode).toBe('6990');
    expect(parsed.accountGuessed).toBe(true);
  });

  it('"städmaterial" blir inte städning och "sopor" i ett annat ord träffar inte', () => {
    expect(parseReceiptText(kvitto('Städmaterial')).accountCode).toBe('5460');
    expect(guessAccountFromText('Konsultarvode september').accountCode).toBe('6550');
  });

  it('frakt och paket ligger kvar på fraktkontot', () => {
    expect(parseReceiptText(kvitto('Fraktkostnad paket')).accountCode).toBe('5711');
  });
});
