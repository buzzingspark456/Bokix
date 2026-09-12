import { describe, it, expect } from 'vitest'
import { markdownToHtml, estimateReadingMinutes } from './markdown'

describe('markdownToHtml', () => {
  it('rubriker: # blir h2 (h1 är sidans egen titel)', () => {
    expect(markdownToHtml('# Hej')).toBe('<h2>Hej</h2>')
    expect(markdownToHtml('## Hej')).toBe('<h3>Hej</h3>')
    expect(markdownToHtml('### Hej')).toBe('<h4>Hej</h4>')
  })

  it('stycken: en tomrad separerar två <p>, radbrytning utan tomrad slås ihop', () => {
    const html = markdownToHtml('Första raden\nandra raden på samma stycke.\n\nEtt nytt stycke.')
    expect(html).toBe('<p>Första raden andra raden på samma stycke.</p>\n<p>Ett nytt stycke.</p>')
  })

  it('fetstil, kursiv och kod', () => {
    expect(markdownToHtml('Det här är **fetstil**.')).toContain('<strong>fetstil</strong>')
    expect(markdownToHtml('Det här är *kursivt*.')).toContain('<em>kursivt</em>')
    expect(markdownToHtml('Kör `npm install`.')).toContain('<code>npm install</code>')
  })

  it('länkar: säkert protokoll släpps igenom, javascript: blockeras', () => {
    expect(markdownToHtml('[Bokix](https://bokix.se)')).toContain('href="https://bokix.se"')
    expect(markdownToHtml('[Klicka](javascript:alert(1))')).toContain('href="#"')
    expect(markdownToHtml('[Klicka](javascript:alert(1))')).not.toContain('javascript:')
  })

  it('bilder', () => {
    const html = markdownToHtml('![Alt-text](https://example.com/bild.png)')
    expect(html).toContain('<img src="https://example.com/bild.png" alt="Alt-text"')
  })

  it('oordnad och ordnad lista', () => {
    expect(markdownToHtml('- Ett\n- Två')).toBe('<ul><li>Ett</li><li>Två</li></ul>')
    expect(markdownToHtml('1. Ett\n2. Två')).toBe('<ol><li>Ett</li><li>Två</li></ol>')
  })

  it('citat och horisontell linje', () => {
    expect(markdownToHtml('> Ett citat')).toBe('<blockquote>Ett citat</blockquote>')
    expect(markdownToHtml('---')).toBe('<hr />')
  })

  it('kodblock behåller radbrytningar och escapar HTML', () => {
    const html = markdownToHtml('```\nconst x = 1;\n<script>\n```')
    expect(html).toBe('<pre><code>const x = 1;\n&lt;script&gt;</code></pre>')
  })

  it('escapar rå HTML i vanlig text — ett oavsiktligt <script> exekverar aldrig', () => {
    const html = markdownToHtml('Text med <script>alert(1)</script> i sig.')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('tomt innehåll ger tom sträng, inte ett fel', () => {
    expect(markdownToHtml('')).toBe('')
    expect(markdownToHtml(undefined)).toBe('')
  })
})

describe('estimateReadingMinutes', () => {
  it('räknar minst 1 minut även för en kort text', () => {
    expect(estimateReadingMinutes('Bara några ord.')).toBe(1)
  })

  it('ungefär 200 ord per minut', () => {
    const text = new Array(400).fill('ord').join(' ')
    expect(estimateReadingMinutes(text)).toBe(2)
  })
})
