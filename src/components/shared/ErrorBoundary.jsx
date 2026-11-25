import { Component } from 'react'
// Språket läses direkt ur det sparade valet, inte via i18n/index.js: den
// importen drog in alla appens texter (sv.json, ~290 kB) på startsidan, där
// felrutan är det enda som behöver språket (Lighthouse 2026-11-07).
const LANGUAGE_KEY = 'bokix_language'
import { reportClientError } from '../../utils/errorReporting.js'
import { isChunkLoadError, isReloadingForNewBuild, reloadOnceForNewBuild } from '../../utils/staleBuild.js'

// Fångar en krasch någonstans i appen och visar en enkel sida med en
// Ladda om-knapp i stället för en helt vit sida. Själva felet rapporteras
// till /api/client-error. Står utanför allt annat, så den använder inga
// av appens komponenter och bara inbäddade stilar.
const TEXT = {
  sv: { title: 'Något gick fel', body: 'Sidan kunde inte visas. Det du redan sparat finns kvar. Vi har fått en felrapport.', reload: 'Ladda om' },
  en: { title: 'Something went wrong', body: 'The page could not be shown. Everything you saved is still there. We have received an error report.', reload: 'Reload' },
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // Gammal flik efter en ny deploy: ladda om en gång i stället för att
    // visa felet (se utils/staleBuild.js).
    if (isReloadingForNewBuild()) return
    if (isChunkLoadError(error) && reloadOnceForNewBuild()) return
    if (import.meta.env.PROD) reportClientError(error, 'boundary')
  }

  render() {
    if (!this.state.failed) return this.props.children
    // Omladdning pågår redan (ny deploy): visa inget fel, bara tomt en stund.
    if (isReloadingForNewBuild()) return null
    let lang = 'sv'
    try { lang = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'sv' } catch { /* standard: svenska */ }
    const text = TEXT[lang]
    return (
      <main role="alert" style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fff', color: '#111' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{text.title}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: '#444', margin: '0 0 20px' }}>{text.body}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ font: 'inherit', fontSize: 15, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#0b6329', color: '#fff', cursor: 'pointer' }}>
            {text.reload}
          </button>
        </div>
      </main>
    )
  }
}
