import { defineConfig, loadEnv } from 'vite'
import fs from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Förladdning av den inloggade appen. Utan den börjar App-bunten hämtas först
// när hela startsidans bunt laddats och körts (AppRouter avgör då att appen
// ska visas), på en mellanklass-telefon ca 1,8 s av ren väntan. Ett litet
// skript högst upp i index.html gör samma kontroll som shouldLoadAppImmediately
// i AppRouter.jsx (inloggad, ?app=1, hemskärmsappen, inloggningslänk) och
// börjar då hämta appen och Startsidan direkt, parallellt med resten.
function preloadAppPlugin(supabaseUrl) {
  let ref = ''
  try { ref = new URL(supabaseUrl).hostname.split('.')[0] } catch { /* inget Supabase: ingen förladdning */ }
  // Ett eget litet skript (/app-preload.js), inte inline: sajtens
  // Content-Security-Policy (vercel.json) tillåter bara skript från 'self'.
  // async, så det aldrig väntas in av startsidan.
  return {
    name: 'bokix-preload-app',
    apply: 'build',
    transformIndexHtml() {
      if (!ref) return []
      return [{ tag: 'script', attrs: { src: '/app-preload.js', async: true }, injectTo: 'head-prepend' }]
    },
    writeBundle(options, bundle) {
      if (!ref || !options.dir) return
      const chunks = Object.values(bundle).filter(c => c.type === 'chunk')
      if (!chunks.length) return
      const byName = new Map(chunks.map(c => [c.fileName, c]))
      const entry = chunks.find(c => c.isEntry)
      // Det startsidans bunt redan hämtar behöver inte förladdas.
      const already = new Set()
      const walk = (c) => {
        if (!c || already.has(c.fileName)) return
        already.add(c.fileName)
        c.imports.forEach(f => walk(byName.get(f)))
      }
      walk(entry)
      const files = new Set()
      const add = (c) => {
        if (!c || files.has(c.fileName) || already.has(c.fileName)) return
        files.add(c.fileName)
        c.imports.forEach(f => add(byName.get(f)))
        ;(c.viteMetadata?.importedCss || []).forEach(css => files.add(css))
      }
      const facade = (suffix) => chunks.find(c => c.facadeModuleId && c.facadeModuleId.replace(/\\/g, '/').endsWith(suffix))
      add(facade('/src/App.jsx'))
      add(facade('/src/components/Dashboard.jsx'))
      if (!files.size) return
      const js = `// Skapad vid bygget (vite.config.js, preloadAppPlugin). Börjar hämta den
// inloggade appen direkt när det är den som ska visas, samma kontroll som
// shouldLoadAppImmediately i src/AppRouter.jsx.
(function () {
  try {
    var k = 'sb-${ref}-auth-token', s = location.search, h = location.hash, sa = false;
    try { sa = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
    var on = location.pathname === '/' && (/[?&]app=1\\b/.test(s) || /[?&](stripe_connect|subscription_checkout)=/.test(s)
      || /access_token=|refresh_token=|type=(recovery|signup|invite)/.test(h) || sa || !!(sa ? localStorage : sessionStorage).getItem(k));
    if (!on) return;
    // Den förrenderade startsidan i index.html ska inte målas upp bara för att
    // ersättas av appen: dölj den direkt (appen ersätter innehållet i #root).
    var st = document.createElement('style');
    st.textContent = '#lp-root{display:none!important}';
    document.head.appendChild(st);
    ${JSON.stringify([...files])}.forEach(function (f) {
      var l = document.createElement('link');
      if (/\\.css$/.test(f)) { l.rel = 'preload'; l.as = 'style'; } else { l.rel = 'modulepreload'; l.crossOrigin = ''; }
      l.href = '/' + f;
      document.head.appendChild(l);
    });
  } catch (e) { /* förladdning är bara en genväg */ }
})();
`
      fs.writeFileSync(path.join(options.dir, 'app-preload.js'), js)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // tailwindcss(): ENDAST för Tremor-diagramkomponenterna (src/components/
    // tremor/) — appens ~100 övriga komponenter är handstylade med inline
    // style-objekt och egna CSS-variabler (index.css) sedan tidigare, det
    // rörs inte. Tailwinds "preflight"-reset (som annars nollställer
    // marginaler/kantlinjer/rubrikstilar GLOBALT) är medvetet AVSTÄNGD, se
    // src/tremor.css — utan det skulle hela resten av appen kunna se
    // annorlunda ut efter den här installationen.
    plugins: [react(), tailwindcss(), preloadAppPlugin(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL)],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    },
  }
})
