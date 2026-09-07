import { describe, it, expect } from 'vitest'
import { parseStorageUrl, collectStorageUrls, collectStoragePaths } from './storageUrls'

const receipt = 'https://abc.supabase.co/storage/v1/object/public/bokix-uploads/user-1/files/1730000000_ab12.pdf'
const logo = 'https://abc.supabase.co/storage/v1/object/public/companylogo/user-1/logo-c1.png?v=3'

describe('parseStorageUrl', () => {
  it('plockar ut bucket och sökväg', () => {
    expect(parseStorageUrl(receipt)).toEqual({
      bucket: 'bokix-uploads',
      path: 'user-1/files/1730000000_ab12.pdf',
    })
  })

  // Settings.jsx lägger på ?v=… som cachebuster — den hör inte till sökvägen
  // och måste bort, annars matchar jämförelsen mot bucketen aldrig.
  it('ignorerar cachebustern', () => {
    expect(parseStorageUrl(logo).path).toBe('user-1/logo-c1.png')
  })

  it('en vanlig länk är inte en Storage-URL', () => {
    expect(parseStorageUrl('https://example.com/bild.png')).toBeNull()
    expect(parseStorageUrl(null)).toBeNull()
    expect(parseStorageUrl(42)).toBeNull()
  })
})

describe('collectStorageUrls', () => {
  // Poängen med att leta efter MÖNSTRET i stället för kända fältnamn: en ny
  // filreferens någon lägger till i framtiden hittas utan kodändring här.
  it('hittar filer oavsett hur djupt de ligger, och oavsett fältnamn', () => {
    const state = {
      companies: {
        c1: {
          company: { name: 'Exempel AB', logoUrl: logo },
          expenses: [{ id: 'x1', receiptUrl: receipt }],
          verifications: [{ id: 'v1', attachmentUrl: receipt }],
          nagotHeltNytt: { framtidaFalt: 'https://abc.supabase.co/storage/v1/object/public/bokix-uploads/user-1/quote-attachments/9.pdf' },
        },
      },
    }
    const urls = collectStorageUrls(state)
    expect(urls).toHaveLength(3)      // kvittot förekommer två gånger, räknas en gång
    expect(urls).toContain(logo)
    expect(urls).toContain(receipt)
  })

  it('tom eller irrelevant data ger en tom lista', () => {
    expect(collectStorageUrls(null)).toEqual([])
    expect(collectStorageUrls({ a: 1, b: 'text', c: ['https://example.com/x.png'] })).toEqual([])
  })

  it('hänger sig inte på cirkulära referenser', () => {
    const a = { url: receipt }
    a.self = a
    expect(collectStorageUrls(a)).toEqual([receipt])
  })
})

describe('collectStoragePaths', () => {
  it('ger bucket/sökväg, formen en städrutin jämför mot', () => {
    const paths = collectStoragePaths({ a: receipt, b: logo })
    expect(paths.has('bokix-uploads/user-1/files/1730000000_ab12.pdf')).toBe(true)
    expect(paths.has('companylogo/user-1/logo-c1.png')).toBe(true)
    expect(paths.size).toBe(2)
  })
})
