import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { collectUnderlag, buildUnderlagZip } from './underlagExport'

const vers = [
  { id: '1', number: 'A1', date: '2026-01-05', description: 'Lunch', attachmentUrl: 'https://x/storage/v1/object/public/bokix-uploads/u/files/a.jpg', rows: [] },
  { id: '2', number: 'A2', date: '2026-01-06', description: 'Faktura 1', source: 'invoice', rows: [] },
  { id: '3', number: 'A3', date: '2026-01-07', description: 'Okänt köp', rows: [] },
  { id: '4', number: 'A4', date: '2026-02-01', description: 'Två filer', attachmentUrl: 'u/files/b.pdf', attachmentType: 'application/pdf', attachments: [{ url: 'u/files/c.png' }], rows: [] },
  { id: '5', number: 'A5', date: '2027-01-01', description: 'Nästa år', attachmentUrl: 'u/files/d.jpg', rows: [] },
]
const range = { from: '2026-01-01', to: '2026-12-31' }

describe('underlag i zip', () => {
  it('namnger filerna efter verifikationen och hittar de som saknar underlag', () => {
    const { files, index } = collectUnderlag(vers, range)
    expect(files.map(f => f.fileName)).toEqual(['A1.jpg', 'A4-1.pdf', 'A4-2.png'])
    expect(index).toEqual([
      expect.objectContaining({ number: 'A2', status: 'Skapad av Bokix' }),
      expect.objectContaining({ number: 'A3', status: 'Saknar underlag' }),
    ])
  })
  it('bygger zip med förteckning och noterar filer som inte gick att hämta', async () => {
    const fetchFile = async (url) => { if (url.includes('c.png')) throw new Error('404'); return new Uint8Array([7, 7]) }
    const r = await buildUnderlagZip(vers, range, { XLSX, fetchFile })
    expect(r.fileCount).toBe(2)
    expect(r.failed).toBe(1)
    expect(r.missing).toBe(1)
    const text = new TextDecoder().decode(r.zip)
    expect(text).toContain('Forteckning.xlsx')
    expect(text).toContain('A1.jpg')
    expect(text).not.toContain('A4-2.png\u0000\u0007')
  })
})
