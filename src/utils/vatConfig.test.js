import { describe, it, expect } from 'vitest'
import { OUTPUT_VAT_ACCOUNT_BY_RATE, SALES_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT } from './vatConfig'
import { VAT_ACCOUNTS, REVENUE_ACCOUNTS, DEFAULT_ACCOUNTS } from '../components/AccountsData'

// Regressionsvakt för buggen där 12/6 % utgående moms bokfördes mot
// 2612/2613 (finns inte i BAS) i stället för de riktiga kontona 2621/2631
// — se vatConfig.js:s filkommentar för hela historien. Två saker måste
// alltid stämma: (1) själva kontonumren är de riktiga BAS-kontona, och
// (2) AccountsData.js:s VAT_ACCOUNTS (som App.jsx/ReviewQueue.jsx bokför
// fakturor/kvitton mot) kan aldrig divergera från vatConfig.js:s
// OUTPUT_VAT_ACCOUNT_BY_RATE (som momsdeklarationen bokför mot) igen.
describe('utgående moms — kontokoppling', () => {
  it('pekar på de riktiga BAS-kontona, inte de påhittade 2612/2613', () => {
    expect(OUTPUT_VAT_ACCOUNT_BY_RATE).toEqual({ 25: '2611', 12: '2621', 6: '2631' })
  })

  it('AccountsData.js:s VAT_ACCOUNTS är samma källa som vatConfig.js, inte en egen kopia', () => {
    expect(VAT_ACCOUNTS[25]).toBe(OUTPUT_VAT_ACCOUNT_BY_RATE[25])
    expect(VAT_ACCOUNTS[12]).toBe(OUTPUT_VAT_ACCOUNT_BY_RATE[12])
    expect(VAT_ACCOUNTS[6]).toBe(OUTPUT_VAT_ACCOUNT_BY_RATE[6])
    expect(VAT_ACCOUNTS[0]).toBeNull()
  })

  it('varje konto i OUTPUT_VAT_ACCOUNT_BY_RATE finns i kontoplanen, aktivt och med rätt namn', () => {
    const byCode = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.code, a]))
    expect(byCode['2611']).toMatchObject({ name: 'Utgående moms på försäljning inom Sverige, 25 %', active: true })
    expect(byCode['2621']).toMatchObject({ name: 'Utgående moms på försäljning inom Sverige, 12 %', active: true })
    expect(byCode['2631']).toMatchObject({ name: 'Utgående moms på försäljning inom Sverige, 6 %', active: true })
  })

  // 2612/2613 användes en gång felaktigt för 12/6 % moms. I BAS 2026 är de
  // riktiga konton (moms på egna uttag och vid uthyrning, 25 %), så de får
  // finnas, men momsen på försäljning får aldrig bokas mot dem.
  it('2612/2613 används aldrig för 12/6 % moms och har BAS-namnen', () => {
    expect(Object.values(OUTPUT_VAT_ACCOUNT_BY_RATE)).not.toContain('2612')
    expect(Object.values(OUTPUT_VAT_ACCOUNT_BY_RATE)).not.toContain('2613')
    const byCode = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.code, a]))
    expect(byCode['2612']?.name).toBe('Utgående moms på egna uttag, 25 %')
    expect(byCode['2613']?.name).toBe('Utgående moms för uthyrning, 25 %')
  })

  it('försäljningskontona (3001-3004) och ingående moms (2641) är oförändrade', () => {
    expect(REVENUE_ACCOUNTS).toEqual({ 25: '3001', 12: '3002', 6: '3003', 0: '3004' })
    expect(SALES_ACCOUNT_BY_RATE).toEqual({ 25: '3001', 12: '3002', 6: '3003', 0: '3004' })
    expect(INPUT_VAT_ACCOUNT).toBe('2641')
  })
})
