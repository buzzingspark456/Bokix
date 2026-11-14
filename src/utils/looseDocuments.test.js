import { describe, it, expect } from 'vitest'
import { newDocument, unlinkedDocuments, staleDocuments, dateFromName, suggestVerifications, linkDocument } from './looseDocuments'

describe('underlag att koppla', () => {
  it('skapar en post och hittar okopplade och gamla', () => {
    const now = new Date('2026-11-14T10:00:00Z')
    const d1 = newDocument({ url: 'u/a.jpg', name: 'a.jpg', type: 'image/jpeg' }, 'u1', new Date('2026-10-01T10:00:00Z'))
    const d2 = { ...newDocument({ url: 'u/b.pdf', name: 'b.pdf' }, 'u1', now), linkedVerificationId: 'v1' }
    expect(d1.id).toMatch(/^doc_/)
    expect(unlinkedDocuments([d1, d2])).toEqual([d1])
    expect(staleDocuments([d1, d2], now)).toEqual([d1])
  })
  it('läser datum ur filnamnet', () => {
    expect(dateFromName('kvitto_2026-03-15.jpg')).toBe('2026-03-15')
    expect(dateFromName('IMG_20260315_1203.jpg')).toBe('2026-03-15')
    expect(dateFromName('faktura 15-03-2026.pdf')).toBe('2026-03-15')
    expect(dateFromName('scan.pdf')).toBeNull()
  })
  it('föreslår verifikationer utan underlag närmast datumet', () => {
    const vers = [
      { id: 'v1', date: '2026-03-01', rows: [] },
      { id: 'v2', date: '2026-03-16', rows: [] },
      { id: 'v3', date: '2026-03-15', rows: [], attachmentUrl: 'x' },
      { id: 'v4', date: '2026-03-14', source: 'invoice', rows: [] },
      { id: 'v5', date: '2026-03-15', status: 'draft', rows: [] },
    ]
    expect(suggestVerifications({ name: 'kvitto 2026-03-15.jpg' }, vers).map(v => v.id)).toEqual(['v2', 'v1'])
  })
  it('kopplar till verifikationen och lägger en andra fil i attachments', () => {
    const docs = [{ id: 'd1', url: 'u/a.jpg', name: 'a.jpg', type: 'image/jpeg' }, { id: 'd2', url: 'u/b.pdf', name: 'b.pdf' }]
    let r = linkDocument([{ id: 'v1', rows: [] }], docs, 'd1', 'v1')
    expect(r.verifications[0]).toMatchObject({ attachmentUrl: 'u/a.jpg', attachmentName: 'a.jpg' })
    expect(r.documents[0].linkedVerificationId).toBe('v1')
    r = linkDocument(r.verifications, r.documents, 'd2', 'v1')
    expect(r.verifications[0].attachments).toEqual([{ url: 'u/b.pdf', name: 'b.pdf', type: undefined }])
  })
})
