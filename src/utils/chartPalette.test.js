import { describe, it, expect } from 'vitest'
import {
  lighten,
  resolveChartPalette,
  makeAmountFormatters,
  CHART_COLOR_FAMILIES,
  DEFAULT_CHART_COLORS,
} from './chartPalette'

// Intl använder ett HÅRT mellanslag (U+00A0) som tusentalsavgränsare — en
// jämförelse mot en literal med vanligt mellanslag ser identisk ut i en diff
// men är en annan sträng. Normaliseras därför innan jämförelsen.
const sp = (str) => str.replace(/ /g, ' ')


describe('resolveChartPalette', () => {
  it('förvalet: in grönt, ut blått, kvar guld', () => {
    const p = resolveChartPalette()
    expect(p.income).toBe(CHART_COLOR_FAMILIES.green.base)
    expect(p.cost).toBe(CHART_COLOR_FAMILIES.blue.base)
    expect(p.profit).toBe(CHART_COLOR_FAMILIES.gold.base)
    expect(p.roles).toEqual(DEFAULT_CHART_COLORS)
  })

  it('byter familj för en roll utan att röra de andra', () => {
    const p = resolveChartPalette({ income: 'green', cost: 'blue' })
    expect(p.income).toBe(CHART_COLOR_FAMILIES.green.base)
    expect(p.cost).toBe(CHART_COLOR_FAMILIES.blue.base)
    expect(p.costRamp).toEqual(CHART_COLOR_FAMILIES.blue.ramp)
    expect(p.profit).toBe(CHART_COLOR_FAMILIES.gold.base)
  })

  // En sparad inställning från en äldre version (eller en handredigerad
  // företagspost) får aldrig ge en osynlig graf.
  it('okänt färgnamn faller tillbaka i stället för att ge undefined', () => {
    const p = resolveChartPalette({ income: 'magenta' })
    expect(p.income).toBe(CHART_COLOR_FAMILIES.blue.base)
  })

  it('kassaflödet hör till intäkternas familj, en ton ljusare', () => {
    const p = resolveChartPalette({ income: 'green' })
    expect(p.cash).toBe(CHART_COLOR_FAMILIES.green.soft)
  })

  it('marginaltrappan går från ljus till mörk inom resultatfamiljen', () => {
    const p = resolveChartPalette({ profit: 'blue' })
    expect(p.marginTones).toEqual([
      CHART_COLOR_FAMILIES.blue.soft,
      CHART_COLOR_FAMILIES.blue.base,
      CHART_COLOR_FAMILIES.blue.ramp[0],
    ])
  })

  it('neutral är skiffer i alla paletter, aldrig en av rollernas färger', () => {
    const a = resolveChartPalette({ income: 'green', cost: 'green', profit: 'green' })
    expect(a.neutral).toBe('#4a5568')
  })
})

describe('makeAmountFormatters', () => {
  it('auto: kronor under 100 000, tusental över', () => {
    const f = makeAmountFormatters('auto')
    expect(f.value(295)).toBe('295 kr')
    expect(f.value(203400)).toBe('203 tkr')
  })

  it('tkr: alltid tusental, även för små belopp', () => {
    const f = makeAmountFormatters('tkr')
    expect(f.value(203400)).toBe('203 tkr')
    expect(f.value(295)).toBe('0 tkr')
  })

  it('kr: alltid hela kronor, aldrig avrundat till tusental', () => {
    const f = makeAmountFormatters('kr')
    expect(sp(f.value(203400))).toBe('203 400 kr')
    expect(f.value(295)).toBe('295 kr')
  })

  // Axeln måste ha samma enhet på varje streck oavsett storlek — annars blir
  // skalan oläsbar ("0 kr", "150 tkr", "300 tkr" på samma axel).
  it('axeln håller EN enhet i auto-läget', () => {
    const f = makeAmountFormatters('auto')
    expect(f.axis(0)).toBe('0 tkr')
    expect(f.axis(150000)).toBe('150 tkr')
  })

  it('tooltipen visar alltid exakta kronor, oavsett vald enhet', () => {
    expect(sp(makeAmountFormatters('tkr').exact(203400))).toBe('203 400 kr')
    expect(makeAmountFormatters('auto').exact(295)).toBe('295 kr')
  })

  it('okänd enhet beter sig som auto', () => {
    expect(makeAmountFormatters('parsec').value(203400)).toBe('203 tkr')
  })
})

// Mörkt läge (kundfeedback: "mörk text/mörka toner i mörkt läge"). De VALDA
// rollfärgerna får aldrig ändras av temat — bara de två toner som är valda
// för ett ljust ark.
describe('resolveChartPalette i mörkt läge', () => {
  const light = resolveChartPalette()
  const dark = resolveChartPalette(undefined, { dark: true })

  it('rör inte de valda rollfärgerna', () => {
    expect(dark.income).toBe(light.income)
    expect(dark.cost).toBe(light.cost)
    expect(dark.profit).toBe(light.profit)
    expect(dark.costRamp).toEqual(light.costRamp)
  })

  it('byter den nästan vita spårfärgen mot en genomskinlig', () => {
    expect(light.costWash).toMatch(/^#/)
    expect(dark.costWash).toBe('rgba(255,255,255,0.10)')
  })

  it('lyfter marginaltrappans mörkaste ton så den syns mot mörk botten', () => {
    // profit är guld som förval (se DEFAULT_CHART_COLORS) — guldets
    // mörkaste ramp-ton, inte grönt.
    expect(light.marginTones[2]).toBe(CHART_COLOR_FAMILIES.gold.ramp[0])
    expect(dark.marginTones[2]).not.toBe(light.marginTones[2])
    expect(lighten(CHART_COLOR_FAMILIES.gold.ramp[0], 0.5)).toBe(dark.marginTones[2])
    // De två ljusare stegen är redan läsbara och ska vara oförändrade.
    expect(dark.marginTones.slice(0, 2)).toEqual(light.marginTones.slice(0, 2))
  })
})

describe('lighten', () => {
  it('0 lämnar färgen orörd, 1 ger vitt', () => {
    expect(lighten('#1c5c28', 0)).toBe('#1c5c28')
    expect(lighten('#1c5c28', 1)).toBe('#ffffff')
  })

  it('returnerar indata oförändrad när det inte är en hexfärg', () => {
    expect(lighten('rgba(0,0,0,0.5)')).toBe('rgba(0,0,0,0.5)')
  })
})
