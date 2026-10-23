import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
import { sellerTaxIds } from './supplierRegistry';

// NetOnNets faktura som textlagret i PDF:en ger den (felrapport 2026-10-23):
// namnet står bara i logotypen överst och i sidfoten, och mitt på sidan står
// en ruta om att fordran är överlåten till Resurs Bank, med bankens orgnr.
const NETONNET = [
  'Faktura',
  'Fakturaadress Leveransadress',
  'Aspegren Peter Roman Pavlovich',
  'Toras Väg 4 Lgh 1104 Synchuk',
  '37165 Lyckeby Sweden ,Rösholme',
  'n 225 ,city',
  'Kungshamn ,456 31',
  'Fakturanummer Kundnummer Fakturadatum Er ref / projektnummer',
  '98391069 2024-02-18 undefined',
  'Betalningsreferens/OCR Betalningsvillkor Förfallodatum',
  '109325916350003 45 dagar 2024-02-18',
  'Betalnummer Dröjsmålsränta',
  '35783198 20,00 %',
  'Art. Nr. Beskrivning Antal A-pris inkl. moms Moms Belopp',
  '208757 Brennenstuhl Primera-Tec 15.000A 1 299,00 kr 25 % 299,00 kr',
  'Totalt SEK exkl. moms 239,20 kr',
  'Momsbelopp 59,80 kr',
  'Totalt SEK inkl. moms 299,00 kr',
  'Leverantörens fordran enligt denna faktura har överlåtits till Resurs Bank AB. Betalning kan därför',
  'med befriande verkan endast ske till Resurs Bank AB. Använd OCR-referens vid betalning.',
  'Resurs Bank Tel: 042-38 20 90 Org nr: 516401-0208',
  'Box 22209 Fax: 042-38 20 77 Bankgiro 735-5837',
  '250 24 Helsingborg kundservice@resurs.se',
  'Sverige www.resursbank.se',
  'NetOnNet AB Telefon: +46 33-488 488 Momsreg.nr: SE556520413701',
  'Box 1719 Fax: Orgnr: 556520-4137',
  'SE-501 17 Borås E-post',
  'Sverige Webbadress www.netonnet.se Företaget innehar F-skattesedel.',
].join('\n');

describe('NetOnNet-fakturan', () => {
  it('känner igen NetOnNet, inte banken som fordran överlåtits till', () => {
    const p = parseReceiptText(NETONNET);
    expect(p.supplier).toBe('NetOnNet');
    expect(p.supplierMatched).toBe(true);
    expect(p.amount).toBe(299);
    expect(p.date).toBe('2024-02-18');
    expect(p.vatRate).toBe(25);
  });

  it('slår upp NetOnNets momsnummer, inte Resurs Banks orgnr', () => {
    expect(sellerTaxIds(NETONNET)[0]).toBe('SE556520413701');
    expect(sellerTaxIds(NETONNET)).not.toContain('SE516401020801');
  });
});
