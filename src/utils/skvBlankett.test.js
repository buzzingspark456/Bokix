import { describe, it, expect } from 'vitest'
import { rowFromFieldName, buildSkvFieldValues, skvRowsFromBokix } from './skvBlankett'

const P = 'BlankettTaxFormular[0].Sida3[0].subSida4[0].subSkattemassigaJusteringar[0]'
const names = [
  `${P}.subVanster[0].subRad41[0].txt7650[0]`,
  `${P}.subVanster[0].subRad43[0].subHoger[0].txt7651[0]`,
  `${P}.subVanster[0].subRad43[0].subHoger[0].txt7652[0]`,
  `${P}.subVanster[0].subRad43[0].subHoger[0].txt7653[0]`,
  `${P}.subHoger[0].subRad413[0].subHoger[0].txt7663[0]`,
  `${P}.subHoger[0].subRad413[0].subHoger[0].txt7762[0]`,
  `${P}.subHoger[0].subRad415[0].txt7670[0]`,
  'BlankettTaxFormular[0].Sida1[0].subSida1[0].subVanster_Hoger[0].subInkomstskatt[0].subUnderlInkSkatt[0].subRad11[0].txt7104[0]',
  'BlankettTaxFormular[0].Sida1[0].subSida1[0].subHuvud[0].SubHuvudHoger[0].SubOrgNummerDatum[0].txtPersOrgNr[0]',
]

describe('Skatteverkets blankett SKV 2002', () => {
  it('läser raden ur fältnamnet', () => {
    expect(rowFromFieldName(names[1])).toBe('4.3')
    expect(rowFromFieldName(names[6])).toBe('4.15')
    expect(rowFromFieldName('x.subRAd417[0].txt8020[0]')).toBe('4.17')
    expect(rowFromFieldName(names[7])).toBe('1.1')
  })
  it('lägger delrader, plus/minus och överskott i rätt fält', () => {
    const ink2s = { arsResultatVinst: 18145, arsResultatForlust: 0, rows: [{ key: '4.3c', value: 1200 }, { key: '4.13', value: -500 }], overskott: 18845, underskott: 0 }
    const v = buildSkvFieldValues(names, { orgNr: '556677-8899', rows: skvRowsFromBokix({ ink2r: { rows: [] }, resultRows: [], ink2s }) })
    expect(v[names[0]]).toBe('18145')
    expect(v[names[3]]).toBe('1200')
    expect(v[names[5]]).toBe('500')
    expect(v[names[4]]).toBeUndefined()
    expect(v[names[6]]).toBe('18845')
    expect(v[names[7]]).toBe('18845')
    expect(v[names[8]]).toBe('556677-8899')
  })
})
