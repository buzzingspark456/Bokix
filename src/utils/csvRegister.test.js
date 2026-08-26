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
  it('round-trips an article through export and import', () => {
    const articles = [{ articleNumber: '1001', description: 'Konsulttimme', unitPrice: 995, vatRate: 25, account: '3001' }]
    const back = csvToArticles(articlesToCsv(articles))
    expect(back).toEqual(articles)
  })

  it('is tolerant of reordered columns (e.g. re-saved from Excel)', () => {
    const csv = 'Benämning;Artikelnr;Moms;Pris;Konto\r\nKonsulttimme;1001;25;995;3001'
    expect(csvToArticles(csv)).toEqual([{ articleNumber: '1001', description: 'Konsulttimme', unitPrice: 995, vatRate: 25, account: '3001' }])
  })

  it('drops rows without an article number', () => {
    const csv = 'Artikelnr;Benämning;Pris;Moms;Konto\r\n;Saknar nummer;100;25;3001'
    expect(csvToArticles(csv)).toEqual([])
  })

  it('falls back to 25% vat and account 3001 for missing/invalid values', () => {
    const csv = 'Artikelnr;Benämning;Pris;Moms;Konto\r\n1002;Test;100;;'
    expect(csvToArticles(csv)).toEqual([{ articleNumber: '1002', description: 'Test', unitPrice: 100, vatRate: 25, account: '3001' }])
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
