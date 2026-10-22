import { describe, it, expect, beforeEach, vi } from 'vitest'
import { signResendDomain, hasValidResendDomainToken, resolveSenderAddress } from './_resend.js'
import { redactCompany, mergeMemberCompanyWrite } from './_memberView.js'

beforeEach(() => {
  process.env.EMAIL_SECRET_KEY = 'test-nyckel'
  process.env.RESEND_ADMIN_API_KEY = 're_admin'
  vi.unstubAllGlobals()
})

describe('resendDomainToken', () => {
  it('godtar bara id:t för företaget det signerades för', () => {
    const token = signResendDomain('dom_1', 'c1')
    expect(hasValidResendDomainToken({ id: 'c1', resendDomainId: 'dom_1', resendDomainToken: token })).toBe(true)
    expect(hasValidResendDomainToken({ id: 'c2', resendDomainId: 'dom_1', resendDomainToken: token })).toBe(false)
    expect(hasValidResendDomainToken({ id: 'c1', resendDomainId: 'dom_2', resendDomainToken: token })).toBe(false)
    expect(hasValidResendDomainToken({ id: 'c1', resendDomainId: 'dom_1' })).toBe(false)
  })

  it('ett annat företags id utan rätt signatur ger systemadressen utan att fråga Resend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await resolveSenderAddress({ id: 'c2', name: 'Ab', emailDomain: 'offer.se', resendDomainId: 'dom_1', resendDomainToken: 'fel' })
    expect(result.usingCustomDomain).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('egen signerad domän används när Resend säger verified', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'verified', name: 'ab.se' }) })))
    const company = { id: 'c1', name: 'Ab', emailDomain: 'ab.se', resendDomainId: 'dom_1', resendDomainToken: signResendDomain('dom_1', 'c1') }
    const result = await resolveSenderAddress(company)
    expect(result).toEqual({ from: 'Ab <faktura@ab.se>', usingCustomDomain: true })
  })

  it('medlemmar ser inte signaturen och kan inte skriva den', () => {
    expect(redactCompany({ resendDomainId: 'dom_1', resendDomainToken: 'x' })).toEqual({ resendDomainId: 'dom_1' })
    expect(mergeMemberCompanyWrite({ resendDomainToken: 'ägarens' }, { resendDomainToken: 'annan' }).resendDomainToken).toBe('ägarens')
  })
})
