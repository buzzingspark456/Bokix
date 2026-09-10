import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encryptSecret, decryptSecret, guessProvider, publicView, friendlySmtpError, PROVIDERS } from './_smtp.js'

// Krypteringen är den enda delen av den egna avsändaren där ett tyst fel
// är dyrt: går en sparad hemlighet inte att läsa tillbaka slutar kundens
// fakturautskick fungera, och lösenordet finns inte kvar någon annanstans
// att rätta det med. Därför testas den, inte SMTP-uppkopplingen (som
// kräver en riktig server).
const OLD_KEY = process.env.EMAIL_SECRET_KEY

beforeAll(() => { process.env.EMAIL_SECRET_KEY = 'test-nyckel-som-inte-anvands-skarpt' })
afterAll(() => { if (OLD_KEY === undefined) delete process.env.EMAIL_SECRET_KEY; else process.env.EMAIL_SECRET_KEY = OLD_KEY })

describe('kryptering av app-lösenordet', () => {
  it('går att läsa tillbaka oförändrat', () => {
    const secret = 'abcd efgh ijkl mnop'
    expect(decryptSecret(encryptSecret(secret))).toBe(secret)
  })

  it('klarar svenska tecken och emoji', () => {
    const secret = 'lösenÖrd-åäö-🔐'
    expect(decryptSecret(encryptSecret(secret))).toBe(secret)
  })

  it('ger olika chiffertext varje gång (slumpad IV)', () => {
    const a = encryptSecret('samma')
    const b = encryptSecret('samma')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('samma')
    expect(decryptSecret(b)).toBe('samma')
  })

  it('vägrar läsa en manipulerad hemlighet i stället för att ge fel klartext', () => {
    const payload = encryptSecret('hemligt')
    const parts = payload.split('.')
    // Ändra en byte i chiffertexten — GCM:s authTag ska fånga det.
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('annat innehåll').toString('base64')].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('vägrar okänt format', () => {
    expect(() => decryptSecret('bara-en-strang')).toThrow(/format/i)
  })
})

describe('leverantörsgissning', () => {
  it('känner igen Gmail', () => {
    expect(guessProvider('anna@gmail.com')).toBe('gmail')
  })
  it('känner igen Outlook-familjen', () => {
    expect(guessProvider('anna@hotmail.se')).toBe('outlook')
    expect(guessProvider('anna@live.se')).toBe('outlook')
  })
  it('faller tillbaka på custom för egen domän', () => {
    expect(guessProvider('faktura@nordvikbygg.se')).toBe('custom')
  })
  it('varje leverantör har de uppgifter formuläret behöver', () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.label).toBeTruthy()
      expect(typeof p.port).toBe('number')
      expect(typeof p.secure).toBe('boolean')
      expect(p.help).toBeTruthy()
    }
  })
})

describe('publicView', () => {
  it('lämnar ALDRIG ut hemligheten', () => {
    const row = {
      from_email: 'anna@gmail.com', from_name: 'Anna AB', provider: 'gmail',
      host: 'smtp.gmail.com', port: 465, secure: true, username: 'anna@gmail.com',
      secret: 'v1.aaa.bbb.ccc', verified_at: '2026-09-10T10:00:00Z', last_error: null,
    }
    const view = publicView(row)
    expect(JSON.stringify(view)).not.toContain('v1.aaa')
    expect(view).not.toHaveProperty('secret')
    expect(view).not.toHaveProperty('username')
    expect(view.fromEmail).toBe('anna@gmail.com')
  })

  it('ger null för ingen rad', () => {
    expect(publicView(null)).toBeNull()
  })
})

describe('felmeddelanden', () => {
  it('översätter nekad inloggning till något som går att åtgärda', () => {
    const msg = friendlySmtpError({ response: '535 5.7.8 Username and Password not accepted' })
    expect(msg).toMatch(/app-lösenord/i)
  })
  it('översätter okänd värd', () => {
    expect(friendlySmtpError({ message: 'getaddrinfo ENOTFOUND smtp.fel.se' })).toMatch(/serveradress/i)
  })
  it('översätter timeout', () => {
    expect(friendlySmtpError({ message: 'connect ETIMEDOUT' })).toMatch(/port/i)
  })
})

// ── Google-inloggningens state ──────────────────────────────────────────
// state binder ihop "vem startade kopplingen" med "vilket företag". Går den
// att förfalska kan någon länka SITT Google-konto till ett annat företags
// avsändare, och därmed skicka fakturor i deras namn. Därför testas den.
describe('signerad state för Google-kopplingen', async () => {
  const { signState, verifyState } = await import('./_gmail.js')

  it('läser tillbaka det som signerades', () => {
    const state = signState({ uid: 'user-1', cid: 'company-9' })
    const claims = verifyState(state)
    expect(claims.uid).toBe('user-1')
    expect(claims.cid).toBe('company-9')
  })

  it('avvisar ändrat innehåll', () => {
    const state = signState({ uid: 'user-1', cid: 'company-9' })
    const [json, sig] = state.split('.')
    const tampered = Buffer.from(JSON.stringify({ uid: 'angripare', cid: 'company-9', ts: Date.now() }), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(verifyState(`${tampered}.${sig}`)).toBeNull()
    expect(verifyState(`${json}.${sig.slice(0, -2)}xx`)).toBeNull()
  })

  it('avvisar trasigt format', () => {
    expect(verifyState('')).toBeNull()
    expect(verifyState('bara-en-del')).toBeNull()
  })

  it('avvisar en för gammal state', async () => {
    const gammal = Buffer.from(JSON.stringify({ uid: 'u', cid: 'c', ts: Date.now() - 60 * 60 * 1000 }), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    // Rätt signatur, men tidsstämpeln är en timme gammal (taket är 15 min).
    const crypto = await import('node:crypto')
    const sig = crypto.createHmac('sha256', process.env.EMAIL_SECRET_KEY).update(gammal).digest()
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(verifyState(`${gammal}.${sig}`)).toBeNull()
  })
})
