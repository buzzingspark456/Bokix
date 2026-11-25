import { describe, it, expect, beforeEach, vi } from 'vitest'
import { signResendDomain, hasValidResendDomainToken, resolveSenderAddress, sendViaResend } from './_resend.js'
import { redactCompany, mergeMemberCompanyWrite } from './_memberView.js'

beforeEach(() => {
  process.env.EMAIL_SECRET_KEY = 'test-nyckel'
  process.env.RESEND_ADMIN_API_KEY = 're_admin'
  vi.unstubAllGlobals()
})

describe('svarsadress', () => {
  const sent = async (payload) => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    await sendViaResend(payload)
    return JSON.parse(fetchMock.mock.calls[0][1].body)
  }

  it('mejl från Bokix får en svarsadress som tar emot mejl', async () => {
    delete process.env.CONTACT_INBOX
    expect((await sent({ from: 'Bokix <support@bokix.se>', to: ['a@b.se'] })).reply_to).toBe('support@bokix.se')
    expect((await sent({ from: '"Ab via Bokix" <support@bokix.se>', to: ['a@b.se'] })).reply_to).toBe('support@bokix.se')
  })

  it('angiven svarsadress och företagets egen domän rörs inte', async () => {
    expect((await sent({ from: 'Bokix <support@bokix.se>', reply_to: 'kund@ab.se' })).reply_to).toBe('kund@ab.se')
    expect((await sent({ from: 'Ab <faktura@ab.se>', to: ['a@b.se'] })).reply_to).toBeUndefined()
  })
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
