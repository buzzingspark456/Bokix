import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import FixedAssets from './FixedAssets'
import Accruals from './Accruals'
import Inventory from './Inventory'
import PricingTool from './PricingTool'

// Rendertest: sidorna ska gå att rita med riktig data (och utan) utan att
// kasta. Logiken är testad i utils/*.test.js — det här fångar trasiga
// importer, felstavade props och undefined-läsningar i själva vyerna.
const accounts = [
  { code: '1224', name: 'Datorer', type: 'tillgang' },
  { code: '1229', name: 'Ack. avskrivningar', type: 'tillgang' },
  { code: '7832', name: 'Avskrivningar', type: 'kostnad' },
  { code: '5010', name: 'Lokalhyra', type: 'kostnad' },
]
const noop = () => {}

const company = {
  fixedAssets: [{
    id: 'a1', name: 'MacBook', category: 'dator', acquisitionDate: '2026-01-15', cost: 12000, residualValue: 0,
    usefulLifeMonths: 36, assetAccount: '1224', accumulatedAccount: '1229', expenseAccount: '7832',
  }],
  accruals: [{ id: 'p1', kind: 'prepaid_expense', description: 'Hyra jan', date: '2026-12-31', amount: 5000, counterAccount: '5010', reversalDate: '2027-01-01' }],
  stockMovements: [{ id: 'm1', articleId: 'art1', type: 'in', date: '2026-01-01', qty: 10, unitCost: 40 }],
}
const verifications = [
  { id: 'v1', date: '2026-02-01', description: 'Köp dator', rows: [{ account: '1224', debet: 15000, kredit: 0 }, { account: '1930', debet: 0, kredit: 15000 }] },
]
const articles = [{ id: 'art1', type: 'vara', description: 'Kaffe', unitPrice: 100, purchasePrice: 40, vatRate: 25 }]

const html = (el) => renderToString(el)

describe('bokföringsverktygens vyer', () => {
  it('Anläggningstillgångar ritar registret, summeringen och förslag på obokförda inköp', () => {
    const out = html(React.createElement(FixedAssets, { company, accounts, verifications, onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('MacBook')
    expect(out).toContain('Bokfört värde')
    expect(out).toContain('Köp dator')
  })

  it('Anläggningstillgångar ritar tomt läge utan data', () => {
    const out = html(React.createElement(FixedAssets, { company: {}, accounts, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('Inga anläggningstillgångar')
  })

  it('Periodiseringar ritar listan och tomt läge', () => {
    expect(html(React.createElement(Accruals, { company, accounts, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))).toContain('Hyra jan')
    expect(html(React.createElement(Accruals, { company: {}, accounts, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))).toContain('Inga periodiseringar')
  })

  it('Lager värderar varan och visar lagervärdet', () => {
    const out = html(React.createElement(Inventory, { articles, company, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('Kaffe')
    expect(out).toContain('Lagervärde att bokföra')
  })

  it('Lager ritar utan lagerlogg', () => {
    const out = html(React.createElement(Inventory, { articles: [], company: {}, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('Inget lager värderat')
  })

  it('Prissättning visar marginalen och de fyra räknarna', () => {
    const out = html(React.createElement(PricingTool, { articles, setArticles: noop, company: {}, setCompanyInfo: noop }))
    expect(out).toContain('Kaffe')
    expect(out).toContain('Vilket pris ska jag ta?')
    expect(out).toContain('Vad tål jag för rabatt?')
    expect(out).toContain('Vilket timpris behöver jag?')
  })
})

describe('avstämning', () => {
  it('ritar bankkontot, kassan och historiken', async () => {
    const { default: Reconciliation } = await import('./Reconciliation')
    const out = html(React.createElement(Reconciliation, {
      bankAccounts: [{ id: 'default', name: 'Huvudkonto', ledgerAccount: '1930' }],
      bankTransactions: [], verifications,
      accounts: [{ code: '1910', name: 'Kassa' }],
      reconciliations: [{ id: 'r1', ledgerAccount: '1930', accountName: 'Huvudkonto', date: '2026-12-31', statementBalance: 100, ledgerBalance: 100, difference: 0 }],
      onSave: noop, onDelete: noop,
    }))
    expect(out).toContain('Huvudkonto')
    expect(out).toContain('Kassa')
    expect(out).toContain('Avstämt')
  })
})

describe('handelsbolag och aktiebolag', () => {
  const partners = [{ id: 'p1', name: 'Anna', sharePct: 60 }, { id: 'p2', name: 'Bo', sharePct: 40 }]

  it('Delägare ritar delägarna, fördelningsstatus och N3A-underlag', async () => {
    const { default: Partners } = await import('./Partners')
    const out = html(React.createElement(Partners, {
      company: { partners, lockedFiscalYears: { 2026: { result: 50000 } } }, verifications: [], year: '2026', yearResult: 50000,
      onAddVerification: noop, setCompanyInfo: noop,
    }))
    expect(out).toContain('Anna')
    expect(out).toContain('Bokför resultatfördelning')
    expect(out).toContain('Underlag för N3A')
  })

  it('Delägare ritar tomt läge', async () => {
    const { default: Partners } = await import('./Partners')
    expect(html(React.createElement(Partners, { company: {}, verifications: [], year: '2026', yearResult: 0, onAddVerification: noop, setCompanyInfo: noop }))).toContain('Inga delägare')
  })

  it('Utdelning ritar fritt eget kapital och beslutslistan', async () => {
    const { default: Dividend } = await import('./Dividend')
    const out = html(React.createElement(Dividend, {
      company: { dividends: [{ id: 'd1', date: '2026-06-01', amount: 40000, sourceAccount: '2091', note: 'Årsstämma' }] },
      accounts, verifications: [], onAddVerification: noop, setAccounts: noop, setCompanyInfo: noop,
    }))
    expect(out).toContain('Fritt eget kapital')
    expect(out).toContain('Årsstämma')
    expect(out).toContain('Beslut ej bokfört')
  })
})

describe('semesterlöneskuld', () => {
  it('Periodiseringar visar semesterlöneskulden när det finns anställda', () => {
    const employee = { id: 'e1', name: 'Eva', active: true, startDate: '2025-01-01', monthlySalary: 30000, vacationDays: 25 }
    const out = html(React.createElement(Accruals, { company: {}, accounts, verifications: [], employees: [employee], payrollRuns: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('Semesterlöneskuld')
  })
})

describe('enkel bokföring', () => {
  const simpleAccounts = [
    { code: '1930', name: 'Företagskonto', type: 'tillgang', active: true },
    { code: '1910', name: 'Kassa', type: 'tillgang', active: true },
    { code: '5460', name: 'Förbrukningsmaterial', type: 'kostnad' },
    { code: '2641', name: 'Ingående moms', type: 'skuld_kapital' },
  ]
  const fields = (kind, extra = {}) => ({ kind, amount: '1000', vatRate: 25, account: '5460', payAccount: '1930', payPrivate: false, fromAccount: '1930', toAccount: '1910', ...extra })
  const rows = [
    { account: '5460', debet: 800, kredit: 0 },
    { account: '2641', debet: 200, kredit: 0 },
    { account: '1930', debet: 0, kredit: 1000 },
  ]

  it('ritar frågan, förhandsvisningen på vanlig svenska och inget debet/kredit', async () => {
    const { default: SimpleBookingPanel } = await import('./shared/SimpleBookingPanel')
    const out = html(React.createElement(SimpleBookingPanel, { fields: fields('expense'), setFields: noop, accounts: simpleAccounts, orgType: 'Aktiebolag (AB)', rows, errors: [] }))
    expect(out).toContain('Vad har hänt?')
    expect(out).toContain('Jag har köpt något')
    expect(out).toContain('Pengar ut från Företagskonto')
    expect(out).toContain('Moms du får dra av')
    expect(out).toContain('Det går ihop')
    expect(out).not.toMatch(/[Dd]ebet|[Kk]redit/)
    expect(out).not.toContain('Jag har satt in egna pengar')
  })

  it('enskild firma får egna insättningar och uttag, och kan betala privat', async () => {
    const { default: SimpleBookingPanel } = await import('./shared/SimpleBookingPanel')
    const out = html(React.createElement(SimpleBookingPanel, { fields: fields('expense'), setFields: noop, accounts: simpleAccounts, orgType: 'Enskild firma', rows: [], errors: ['Fyll i ett belopp.'] }))
    expect(out).toContain('Jag har satt in egna pengar')
    expect(out).toContain('Jag har tagit ut pengar')
    expect(out).toContain('Med egna pengar (privat)')
    expect(out).toContain('Fyll i ett belopp.')
  })

  it('ritar alla händelsetyper utan att kasta', async () => {
    const { default: SimpleBookingPanel } = await import('./shared/SimpleBookingPanel')
    for (const kind of ['expense', 'income', 'transfer', 'owner_in', 'owner_out']) {
      const out = html(React.createElement(SimpleBookingPanel, { fields: fields(kind), setFields: noop, accounts: simpleAccounts, orgType: 'Enskild firma', rows: [], errors: [] }))
      expect(out).toContain('Så här bokförs det'.toUpperCase())
    }
  })
})

describe('lönekörningens bokföringsvisning', () => {
  it('visar lönebokföringen på vanlig svenska utan debet och kredit', async () => {
    const { VerificationBlock } = await import('./PayrollRunDetail')
    const rows = [
      { account: '7210', description: 'Lön Anna', debet: 30000, kredit: 0 },
      { account: '2710', description: 'Personalskatt', debet: 0, kredit: 7000 },
      { account: '1930', description: 'Utbetalning', debet: 0, kredit: 23000 },
    ]
    const out = html(React.createElement(VerificationBlock, {
      title: 'Block 1 — Lön', rows,
      accounts: [{ code: '7210', name: 'Löner till tjänstemän' }, { code: '2710', name: 'Personalskatt' }, { code: '1930', name: 'Företagskonto' }],
    }))
    expect(out).toContain('Kostnad: Löner till tjänstemän')
    expect(out).toContain('Skuld ökar: Personalskatt')
    expect(out).toContain('Pengar ut från Företagskonto')
    expect(out).toContain('Lön Anna')
    expect(out).not.toMatch(/[Dd]ebet|[Kk]redit/)
  })
})

describe('lager från fakturor', () => {
  const invoices = [{ id: 'i1', invoiceNumber: '1001', date: '2026-03-01', status: 'sent', rows: [{ description: 'Kaffe', qty: 4, unitPrice: 100 }] }]
  const on = { ...company, inventorySettings: { stockFromInvoices: true, stockFromInvoicesSince: '2026-01-01' } }

  it('ritar valet, antalet efter fakturan och raden som såld på faktura', () => {
    const out = html(React.createElement(Inventory, { articles, invoices, company: on, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).toContain('Dra av lagret automatiskt när jag fakturerar')
    expect(out).toContain('Såld på faktura')
    expect(out).toContain('faktura 1001')
    expect(out).toContain('1 fakturarader räknas med')
  })

  it('utan valet påverkas inte lagret av fakturor', () => {
    const out = html(React.createElement(Inventory, { articles, invoices, company, verifications: [], onAddVerification: noop, setCompanyInfo: noop }))
    expect(out).not.toContain('Såld på faktura')
    expect(out).toContain('Dra av lagret automatiskt när jag fakturerar')
  })
})
