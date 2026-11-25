import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Skydd mot att en knapp anropar en funktion som inte längre finns
// (2026-11-24: Inleverans i Lager kraschade sedan funktionen följt med när
// en annan del togs bort; renderToString-testerna klickar aldrig).
// Varje namn som en händelse (onClick, onChange …) anropar ska vara
// deklarerat, importerat eller komma in som en prop i samma fil.
const dir = dirname(fileURLToPath(import.meta.url))
// Alla komponenter och App.jsx.
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(join(d, f.name)) : f.name.endsWith('.jsx') ? [join(d, f.name)] : []))
const files = [...walk(dir), join(dir, '..', 'App.jsx')]
const GLOBALS = new Set(['if', 'return', 'await', 'typeof', 'new', 'void', 'setTimeout', 'clearTimeout', 'confirm', 'alert', 'requestAnimationFrame', 'fetch', 'open', 'print'])

function undefinedHandlers(src) {
  const called = new Set()
  const handler = /\bon[A-Z]\w*=\{(?:async\s*)?(?:\([^)]*\)|\w+)?\s*(?:=>\s*)?\{?\s*(?:await\s+)?([a-z_]\w*)\s*\(/g
  const direct = /\bon[A-Z]\w*=\{([a-z_]\w*)\}/g
  for (const re of [handler, direct]) { let m; while ((m = re.exec(src))) called.add(m[1]) }
  return [...called].filter(name => {
    if (GLOBALS.has(name) || name.length < 2) return false
    const n = name.replace(/\$/g, '\\$')
    const declared = new RegExp(`(?:const|let|var|function)\\s+${n}\\b|\\[\\s*\\w+\\s*,\\s*${n}\\s*\\]|import[^;]*\\b${n}\\b|[{,]\\s*${n}\\s*(?:=[^,}]*)?[,}]`)
    return !declared.test(src)
  })
}

describe('händelser anropar funktioner som finns', () => {
  for (const f of files) {
    it(f.slice(f.indexOf('src')), () => {
      const src = readFileSync(f, 'utf8')
      expect(undefinedHandlers(src)).toEqual([])
    })
  }
  it('upptäcker en saknad funktion', () => {
    expect(undefinedHandlers('const a = 1; <button onClick={() => startDelivery()} />')).toEqual(['startDelivery'])
  })
})
