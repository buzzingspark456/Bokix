import { describe, it, expect } from 'vitest'
import { parseCsv, rowsToCsv, articlesToCsv, csvToArticles, contactsToCsv, csvToContacts } from './csvRegister'

describe('parseCsv / rowsToCsv', () => {
  it('round-trips plain semicolon-delimited fields', () => {
    const csv = rowsToCsv(['A', 'B'], [['1', '2'], ['3', '4']])
    expect(parseCsv(csv)).toEqual([['A', 'B'], ['1', '2'], ['3', '4']])
  })

  it('quotes and restores a field containing the delimiter itself', () => {
    // Regression: en adress skriven som "Storgatan 1; 2 tr" ska inte tolkas
    // som två kolumner vid import.
    const csv = rowsToCsv(['Adress'], [['Storgatan 1; 2 tr']])
    expect(parseCsv(csv)).toEqual([['Adress'], ['Storgatan 1; 2 tr']])
  })

  it('escapes and restores embedded quote characters', () => {
    const csv = rowsToCsv(['Namn'], [['Bolaget "Alfa" AB']])
    expect(parseCsv(csv)).toEqual([['Namn'], ['Bolaget "Alfa" AB']])
  })

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿A;B\r\n1;2')).toEqual([['A', 'B'], ['1', '2']])
  })
})

describe('articlesToCsv / csvToArticles', () => {
  // Benämning (inte Artikelnr) är den riktiga identiteten sen Articles.jsx
  // gjorde artikelnummer valfritt — nya kolumner (Typ/Enhet/Inköpspris/EAN/
  // ROT-RUT/engelsk benämning/Anteckningar) får sina defaultvärden när de
  // saknas i CSV:n, precis som Moms/Konto redan gjorde.
  const withDefaults = (a) => ({
    type: 'tjanst', unit: 'st', ean: '', rotRut: 'none', descriptionEn: '', notes: '', purchasePrice: '', ...a,
  })

  it('round-trips an article through export and import', () => {
    const articles = [withDefaults({ articleNumber: '1001', description: 'Konsulttimme', unitPrice: 995, vatRate: 25, account: '3001' })]
    const back = csvToArticles(articlesToCsv(articles))
    expect(back).toEqual(articles)
  })

  it('is tolerant of reordered columns (e.g. re-saved from Excel)', () => {
    const csv = 'Benämning;Artikelnr;Moms;Pris;Konto\r\nKonsulttimme;1001;25;995;3001'
    expect(csvToArticles(csv)).toEqual([withDefaults({ articleNumber: '1001', description: 'Konsulttimme', unitPrice: 995, vatRate: 25, account: '3001' })])
  })

  it('keeps a row with no article number (now optional) but drops one with no benämning', () => {
    const csv = 'Artikelnr;Benämning;Pris;Moms;Konto\r\n;Saknar nummer;100;25;3001\r\n2001;;100;25;3001'
    expect(csvToArticles(csv)).toEqual([withDefaults({ articleNumber: '', description: 'Saknar nummer', unitPrice: 100, vatRate: 25, account: '3001' })])
  })

  it('falls back to 25% vat and account 3001 for missing/invalid values', () => {
    const csv = 'Artikelnr;Benämning;Pris;Moms;Konto\r\n1002;Test;100;;'
    expect(csvToArticles(csv)).toEqual([withDefaults({ articleNumber: '1002', description: 'Test', unitPrice: 100, vatRate: 25, account: '3001' })])
  })
})

describe('contactsToCsv / csvToContacts', () => {
  it('round-trips a customer through export and import', () => {
    const customers = [{ customerNumber: 'K1', name: 'Acme AB', orgNr: '556677-8899', vatNumber: '', contactPerson: '', email: 'a@acme.se', phone: '', address: '', postalCode: '', city: '', country: 'Sverige', paymentTerms: 30, notes: '' }]
    expect(csvToContacts('customer', contactsToCsv('customer', customers))).toEqual(customers)
  })

  it('drops rows without a name', () => {
    const csv = 'Kundnummer;Namn\r\nK1;'
    expect(csvToContacts('customer', csv)).toEqual([])
  })
})

describe('csvToArticles: Fortnox artikelregister', () => {
  const head = '"Artikelnummer","Benämning","EAN","Artikelgrupper","Aktiv","Enhet","Leverantör","Leverantörsnamn","Tillverkare","Tillverkarens artikelnummer","Anteckning","Husarbete","Typ av husarbete","Typ av artikel","Lagervara","Extern webbshop","Utgående artikel","A-pris (Förvald prislista)","Inköp","Försäljning","Försäljning EU omvänd skattskyldighet","Försäljning EU momspliktig","Försäljning SE omvänd skattskyldighet","Försäljning Export","Bredd (mm)","Höjd (mm)","Djup (mm)","Vikt (g)","Skrymmande","Paketartikel","I lager","Lagervarning","Statistisk varukod","Lagerplats","Kalkylkostnad","Prislista A"';
  const rows = [
    '"2296","Kallskum 38 kg/m³, 5 cm","",,"Ja","st",,,"SVENSKA DYNOR AB",,"L:120 x50 cm","Nej",,"Vara","Nej","Nej","Nej",119.2,4000,3001,3108,3106,,3105,,,,,"Nej","Nej",0,,,"",65,"119.2"',
    '"2257","LOXX övre del med stort huvud ""Hatt"" nickel pläter","",,"Ja",,,,,,"","Nej",,"Vara","Nej","Nej","Nej",25.68,4000,3001,3108,3106,,3105,,,,,"Nej","Nej",0,,,"",0,"25.68"',
    '"2020","Sy upp  byxor NR:","",,"Ja","st",,,"Norrtailor","1001","Sy upp  byxor ,skjol,skorta ..... enkel","Nej",,"Vara","Nej","Nej","Nej",150,4000,3002,3108,3106,,3105,,,,,"Nej","Nej",0,,,"",90,"150"',
    '"2073","Frakt till kommer ","",,"Ja","st",,,,,"","Nej",,"Vara","Nej","Nej","Nej",,4000,3001,3108,3106,,3105,,,,,"Nej","Nej",0,,,"",0,""',
    '"9999","Gammal artikel","",,"Nej","st",,,,,"","Nej",,"Tjänst","Nej","Nej","Nej",10,4000,3001,3108,3106,,3105,,,,,"Nej","Nej",0,,,"",0,"10"',
  ];
  const list = csvToArticles([head, ...rows].join('\r\n'));
  it('läser kommaseparerat med Fortnox rubriker', () => {
    expect(list.map(a => a.articleNumber)).toEqual(['2296', '2257', '2020', '2073']); // inaktiv följer inte med
    expect(list[0]).toMatchObject({ description: 'Kallskum 38 kg/m³, 5 cm', unitPrice: 119.2, account: '3001', vatRate: 25, type: 'vara', unit: 'st', purchasePrice: 65, notes: 'L:120 x50 cm' });
    expect(list[1].description).toBe('LOXX övre del med stort huvud "Hatt" nickel pläter');
  });
  it('momsen kommer från försäljningskontot', () => {
    expect(list[2]).toMatchObject({ account: '3002', vatRate: 12, unitPrice: 150, purchasePrice: 90 });
  });
  it('tomt pris blir 0', () => {
    expect(list[3].unitPrice).toBe(0);
  });
  it('decimalkomma och husarbete', () => {
    const csv = 'Benämning;Pris;Husarbete;Typ av husarbete;Typ av artikel\nMålning;1 250,50;Ja;Målning och tapetsering;Tjänst\nStädning;400;Ja;Städning;Tjänst';
    const [a, b] = csvToArticles(csv);
    expect(a).toMatchObject({ unitPrice: 1250.5, rotRut: 'rot', type: 'tjanst' });
    expect(b.rotRut).toBe('rut');
  });
});
