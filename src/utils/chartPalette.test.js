import { describe, it, expect } from 'vitest'
import {
  lighten,
  resolveChartPalette,
  makeAmountFormatters,
  CHART_COLOR_FAMILIES,
  DEFAULT_CHART_COLORS,
  kpiInk,
  LOSS_COLOR,
  kpiGradient,
} from './chartPalette'

// Intl använder ett HÅRT mellanslag (U+00A0) som tusentalsavgränsare — en
// jämförelse mot en literal med vanligt mellanslag ser identisk ut i en diff
// men är en annan sträng. Normaliseras därför innan jämförelsen.
const sp = (str) => str.replace(/ /g, ' ')


describe('resolveChartPalette', () => {
  it('förvalet: in loggans blå, ut grått, kvar loggans gröna', () => {
    const p = resolveChartPalette()
    expect(p.income).toBe(CHART_COLOR_FAMILIES.demoBlue.base)
    expect(p.cost).toBe(CHART_COLOR_FAMILIES.demoCoral.base)
    expect(p.profit).toBe(CHART_COLOR_FAMILIES.demoGreen.base)
    expect(p.roles).toEqual(DEFAULT_CHART_COLORS)
  })

  it('byter familj för en roll utan att röra de andra', () => {
    const p = resolveChartPalette({ income: 'green', cost: 'blue' })
    expect(p.income).toBe(CHART_COLOR_FAMILIES.green.base)
    expect(p.cost).toBe(CHART_COLOR_FAMILIES.blue.base)
    expect(p.costRamp).toEqual(CHART_COLOR_FAMILIES.blue.ramp)
    expect(p.profit).toBe(CHART_COLOR_FAMILIES.demoGreen.base)
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

  it('tkr: tusental, men belopp under 10 000 kr i hela kronor (aldrig "0 tkr")', () => {
    const f = makeAmountFormatters('tkr')
    expect(f.value(203400)).toBe('203 tkr')
    expect(f.value(10000)).toBe('10 tkr')
    expect(sp(f.value(9999))).toBe('9 999 kr')
    expect(f.value(295)).toBe('295 kr')
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
  // Guld som resultatfärg här: grafiten har egna mörka toner, se nästa block.
  const light = resolveChartPalette({ income: 'green', cost: 'blue', profit: 'gold' })
  const dark = resolveChartPalette({ income: 'green', cost: 'blue', profit: 'gold' }, { dark: true })

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
    // profit är guld i det här blocket — guldets
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

// Bokix grönt (Resultatets förval) och grafit är för mörka för en linje på mörk botten.
describe('mörka resultatfärger i mörkt läge', () => {
  it('resultatlinjen blir ljus i mörkt läge, mörk i ljust', () => {
    expect(resolveChartPalette().profit).toBe(CHART_COLOR_FAMILIES.demoGreen.base)
    expect(resolveChartPalette({ profit: 'lime' }, { dark: true }).profit).toBe(CHART_COLOR_FAMILIES.lime.darkLine)
    expect(resolveChartPalette({ profit: 'ink' }, { dark: true }).profit).toBe(CHART_COLOR_FAMILIES.ink.darkLine)
    expect(resolveChartPalette({ profit: 'lime' }, { dark: true }).marginTones).toEqual(CHART_COLOR_FAMILIES.lime.darkMargins)
  })

  it('nyckeltalskortet byter till en ljusare grafit i mörkt läge', () => {
    expect(kpiGradient('ink')).toEqual([CHART_COLOR_FAMILIES.ink.base, CHART_COLOR_FAMILIES.ink.soft])
    expect(kpiGradient('ink', true)).toEqual(CHART_COLOR_FAMILIES.ink.darkCard)
    expect(kpiGradient('green', true)).toEqual([CHART_COLOR_FAMILIES.green.base, CHART_COLOR_FAMILIES.green.soft])
  })
})

describe('kpiGradient med egen kortgradient', () => {
  it('använder `card` när familjen har en, annars base→soft', () => {
    expect(kpiGradient('sky')).toEqual(CHART_COLOR_FAMILIES.sky.card)
    expect(kpiGradient('mint', true)).toEqual(CHART_COLOR_FAMILIES.mint.card)
  })
})

describe('ljusa kort och förlust', () => {
  it('mintkortet har mörk text, övriga vit', () => {
    expect(kpiInk('mint')).toBe('#064e3b')
    expect(kpiInk('royal')).toBe('#fff')
  })

  it('förlust har en egen röd färg, aldrig kostnadsfärgen', () => {
    const p = resolveChartPalette()
    expect(p.loss).toBe(LOSS_COLOR.base)
    expect(p.loss).not.toBe(p.cost)
  })
})

describe('grått kostnadskort i mörkt läge', () => {
  it('blir mörkgrått med ljus text i mörkt läge, ljust med mörk text annars', () => {
    expect(kpiGradient('grey')).toEqual(CHART_COLOR_FAMILIES.grey.card)
    expect(kpiInk('grey')).toBe('#334155')
    expect(kpiGradient('grey', true)).toEqual(CHART_COLOR_FAMILIES.grey.darkCard)
    expect(kpiInk('grey', true)).toBe('#f1f5f9')
  })
})

describe('kostnadsstapeln', () => {
  it('grått har en egen fast stapelton, andra familjer dämpas', () => {
    expect(resolveChartPalette({ cost: 'grey' }).costBar).toBe(CHART_COLOR_FAMILIES.grey.bar)
    expect(resolveChartPalette({ cost: 'grey' }).costBarOpacity).toBe(1)
    expect(resolveChartPalette({ cost: 'grey' }, { dark: true }).costBar).toBe(CHART_COLOR_FAMILIES.grey.darkBar)
    expect(resolveChartPalette({ cost: 'blue' }).costBarOpacity).toBe(0.28)
  })
})

describe('egna toner för mörkt läge (darkBase)', () => {
  it('förvalets blå, korall och gröna byter till sina ljusare toner i mörkt läge', () => {
    const d = resolveChartPalette(undefined, { dark: true })
    expect(d.income).toBe(CHART_COLOR_FAMILIES.demoBlue.darkBase)
    expect(d.cost).toBe(CHART_COLOR_FAMILIES.demoCoral.darkBase)
    expect(d.costBar).toBe(CHART_COLOR_FAMILIES.demoCoral.darkBase)
    expect(d.profit).toBe(CHART_COLOR_FAMILIES.demoGreen.darkBase)
  })
})
