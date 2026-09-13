import { useEffect, useRef } from 'react';

// ── Molnbakgrund för Hero — DEN HÄR GÅNGEN en riktig port av Aceternitys
// egna CloudShader, inte en egen tolkning. Deras dokumentationssida
// (ui.aceternity.com/components/cloud-shader) visar inte källkoden rakt
// av, men CLI:ns registry-endpoint gör det:
// https://ui.aceternity.com/registry/cloud-shader.json — VERT/FRAG och
// hela render-loopen nedan är hämtade DÄRIFRÅN, oförändrade i sak. Bara
// tre saker är ändrade mot originalet:
//   1. TypeScript-typerna bortstrippade (projektet är .jsx, ingen tsconfig).
//   2. "use client" borttaget (Next.js-direktiv, betyder inget i Vite).
//   3. Tailwind-klassnamnen (className="relative h-full ...") + cn()-
//      anropet ersatta med inline style — Tailwind är medvetet AVSTÄNGT
//      utanför Tremor-diagrammen (se vite.config.js), så de klasserna
//      hade renderat som overksamma no-ops på den här sidan.
// Utöver själva porten: en egen liten tema-medveten färgomkoppling
// (PALETTES + MutationObserver längst ner) så molnen byter till Bokix
// mörka palett automatiskt när #lp-root[data-theme="dark"] slår om —
// den delen är VÅR tillägg, inte del av originalkomponenten.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Original cloud shader for Aceternity UI.
// Each cloud is an asymmetric envelope (dome top, flat base) filled with
// domain-warped billow noise. A second density sample above the pixel
// approximates self-shadowing. Clouds drift horizontally and wrap around.
const FRAG = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform vec3 u_cloud;
uniform vec3 u_skyTop;
uniform vec3 u_skyBottom;

const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = R * p * 2.03 + 19.19;
    amp *= 0.5;
  }
  return sum;
}

// billow noise: sharp puffy ridges, like cauliflower cloud tops
float billow(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = R * p * 2.11 + 13.37;
    amp *= 0.5;
  }
  return sum;
}

// raw density for one cloud at point p
float cloudDensity(vec2 p, vec2 c, vec2 r, float seed, float t) {
  vec2 q = p - c;

  // envelope: dome above the center, flat base below
  float ry = q.y > 0.0 ? r.y : r.y * 0.42;
  float env = 1.0 - length(vec2(q.x / r.x, q.y / ry));
  if (env < -0.35) return 0.0;

  // domain-warped billow detail, moves with the cloud, evolves slowly
  vec2 dp = q * (2.4 / r.x) + seed;
  dp += 0.6 * vec2(
    fbm(dp * 1.4 + t * 0.04),
    fbm(dp * 1.4 + 7.7 - t * 0.03)
  );
  float detail = billow(dp * 1.6);

  return env + (detail - 0.62) * 0.62;
}

// shades one cloud and blends it over the current color
vec3 shadeCloud(vec3 color, vec3 sky, vec2 p, vec2 c, vec2 r, float seed, float t, float dist) {
  float d = cloudDensity(p, c, r, seed, t);
  if (d < 0.02) return color;

  // sample density toward the sun (straight up) for self-shadowing
  float dUp = cloudDensity(p + vec2(0.0, r.y * 0.55), c, r, seed, t);
  float occl = clamp((dUp - d) * 1.1 + d * 0.55, 0.0, 1.0);

  vec3 lit = u_cloud * 1.04;
  vec3 shadow = mix(u_cloud * 0.60, sky, 0.38);
  vec3 cloudCol = mix(lit, shadow, occl * 0.85);

  float alpha = smoothstep(0.02, 0.38, d);

  // silver lining on thin edges
  float rim = smoothstep(0.02, 0.14, d) * (1.0 - smoothstep(0.14, 0.40, d));
  cloudCol += rim * 0.10;

  // atmospheric perspective: far clouds fade into the sky
  cloudCol = mix(cloudCol, sky, dist * 0.35);
  alpha *= mix(1.0, 0.8, dist);

  return mix(color, cloudCol, alpha);
}

// one drifting cloud: horizontal wrap + gentle vertical bob
vec3 cloudPass(vec3 color, vec3 sky, vec2 p, float aspect, float t,
               float spd, float phase, float y, vec2 r, float seed, float dist) {
  float cx = mix(-r.x - 0.25, aspect + r.x + 0.25, fract(t * spd + phase));
  float cy = y + sin(t * 0.05 + phase * 6.2831) * 0.012;
  return shadeCloud(color, sky, p, vec2(cx, cy), r, seed, t, dist);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time;

  vec3 sky = mix(u_skyBottom, u_skyTop, v_uv.y);
  vec3 color = sky;

  // faint haze band near the horizon
  color = mix(color, u_skyBottom * 1.06, smoothstep(0.35, 0.0, v_uv.y) * 0.5);

  // soft sun glow, upper area
  vec2 sunPos = vec2(aspect * 0.78, 0.92);
  float sunDist = length(p - sunPos);
  color += vec3(1.0, 0.95, 0.82) * exp(-sunDist * sunDist * 5.0) * 0.28;

  // thin cirrus streaks, stretched horizontally, high in the sky
  float cirrusBand = smoothstep(0.55, 0.8, v_uv.y) * (1.0 - smoothstep(0.9, 1.0, v_uv.y));
  if (cirrusBand > 0.01) {
    float streak = fbm(vec2(p.x * 1.6 - t * 0.006, p.y * 12.0));
    float wisp = smoothstep(0.52, 0.78, streak) * cirrusBand;
    color = mix(color, u_cloud * 0.98, wisp * 0.35);
  }

  // far layer: small, high, slow
  if (u_count > 5.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.006, 0.10, 0.84, vec2(0.20, 0.10), 43.7, 1.0);
  }
  if (u_count > 4.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.008, 0.62, 0.73, vec2(0.24, 0.12), 71.3, 0.85);
  }

  // middle layer
  if (u_count > 3.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.011, 0.33, 0.60, vec2(0.34, 0.16), 17.3, 0.55);
  }
  if (u_count > 2.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.013, 0.80, 0.47, vec2(0.30, 0.15), 29.9, 0.45);
  }

  // near layer: big, low, fast
  if (u_count > 1.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.016, 0.05, 0.35, vec2(0.46, 0.20), 91.1, 0.15);
  }
  color = cloudPass(color, sky, p, aspect, t, 0.020, 0.48, 0.20, vec2(0.56, 0.24), 57.2, 0.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

function parseHex(color) {
  const value = color.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const rgb = value.match(/[\d.]+/g);
  if (rgb && rgb.length >= 3) {
    return [Number(rgb[0]) / 255, Number(rgb[1]) / 255, Number(rgb[2]) / 255];
  }
  return [0.95, 0.95, 0.95];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('CloudShaderBackground: shader compile error', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Bokix egen ljus/mörk-palett (mynta/turkos→ivory i ljust läge, djupgrönt
// i mörkt) — VÅR tillägg ovanpå den riktiga komponenten, inte del av
// originalet. Används bara som förval när anroparen inte själv skickar in
// cloudColor/skyTopColor/skyBottomColor (se CloudShaderBackground nedan).
const PALETTES = {
  // Blå himmel — Bokix egen loggblå (#0ea5e9, GRAD.blueTeal i LandingPage.jsx)
  // istället för en påhittad himmelsfärg, samma "Bokix egna färger"-princip
  // som resten av filen.
  // skyTop ljusare än loggans exakta blå (#0ea5e9) — den rakt av tonen
  // gjorde "Bokix" i headern (transparent tills man skrollar, se
  // MarketingHeader) nästan osynlig mot en lika blå himmel däruppe.
  light: { skyTop: '#6cc6f5', skyBottom: '#dff1fc', cloud: '#ffffff' },
  dark: { skyTop: '#0b3a5c', skyBottom: '#0a1622', cloud: '#274a63' },
};

// Himlen som CSS, för tiden innan WebGL hunnit rita sin första bildruta
// (och permanent för den som saknar WebGL). Färgerna är PALETTES ovan —
// ändras paletten måste den här strängen ändras med, annars blinkar
// hjälten om från en himmel till en annan vid varje sidladdning. Det är
// exakt det felet den finns för att ta bort.
//
// Temat läses från <html data-theme>, samma flagga som resolveColors
// nedan och useMarketingTheme (MarketingLayout.jsx) redan använder.
// Hur många pixlar shadern faktiskt ritar, som andel av skärmens egna.
// Se den långa kommentaren i resize() för mätvärdena bakom siffran.
const RENDER_SCALE = 0.6;

const SKY_FALLBACK_CSS = `
  .bx-cloudsky { background: linear-gradient(180deg, ${PALETTES.light.skyTop} 0%, ${PALETTES.light.skyBottom} 100%); }
  :root[data-theme="dark"] .bx-cloudsky { background: linear-gradient(180deg, ${PALETTES.dark.skyTop} 0%, ${PALETTES.dark.skyBottom} 100%); }
`;

/** Ren port av Aceternitys CloudShader (se filkommentaren högst upp) —
 * samma props-yta som originalet (speed/count/cloudColor/skyTopColor/
 * skyBottomColor/className/children), plus tema-medveten färgomkoppling
 * när färgprops utelämnas. */
export default function CloudShaderBackground({
  className, style, children,
  speed = 1, count = 6,
  cloudColor, skyTopColor, skyBottomColor,
}) {
  const canvasRef = useRef(null);
  const paramsRef = useRef({ speed, count, cloudColor, skyTopColor, skyBottomColor });
  paramsRef.current = { speed, count, cloudColor, skyTopColor, skyBottomColor };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return undefined; // Inget WebGL — Hero visar bara sin egna --mkt-ivory-botten, aldrig trasigt.

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return undefined;

    const program = gl.createProgram();
    if (!program) return undefined;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, 'a_pos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('CloudShaderBackground: program link error', gl.getProgramInfoLog(program));
      return undefined;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      res: gl.getUniformLocation(program, 'u_res'),
      time: gl.getUniformLocation(program, 'u_time'),
      count: gl.getUniformLocation(program, 'u_count'),
      cloud: gl.getUniformLocation(program, 'u_cloud'),
      skyTop: gl.getUniformLocation(program, 'u_skyTop'),
      skyBottom: gl.getUniformLocation(program, 'u_skyBottom'),
    };

    let frame = 0;
    let running = true;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      // PRESTANDA. Den här shadern är den dyraste enskilda saken på hela
      // marknadssajten: en helskärms-fragmentshader med femoktavs billow-
      // brus per pixel, och kostnaden växer linjärt med antalet pixlar.
      // Uppmätt i ett headless Chromium (mjukvaru-WebGL, alltså värsta
      // fallet men samma proportioner som en svag mobil-GPU): 2 336 ms
      // långa uppgifter och 4 fps med dpr 2 mot 61 ms och 20 fps med
      // hjälten helt avstängd.
      //
      // dpr 2 × full upplösning = fyra gånger så många pixlar som dpr 1.
      // Moln är mjuka gradienter utan skarpa kanter — de överlever att
      // ritas i lägre upplösning och skalas upp av webbläsaren, till
      // skillnad från text eller en logotyp. RENDER_SCALE 0.6 vid dpr-tak
      // 1.5 ger ~0.8 enheter per CSS-pixel, alltså knappt en femtedel av
      // pixlarna mot förut, och skillnaden går inte att se på en himmel.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const w = Math.max(1, Math.floor(width * dpr));
      const h = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
      // Att sätta canvas.width nollställer ritbufferten. Rullar loopen
      // fyller nästa bildruta i den igen — gör den inte det (nödbromsen,
      // pausen, reducerad rörelse) skulle hjälten annars bli tom vid varje
      // fönsterändring.
      if (!running && loc.res) drawFrame();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    // VÅRT tillägg: när anroparen inte skickar egna färger, används Bokix
    // ljus/mörk-palett istället för originalets bokstavligt himmelsblå
    // förval — samma document.documentElement.dataset.theme-flagga som
    // useMarketingTheme() (MarketingLayout.jsx) redan sätter.
    const resolveColors = (p) => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      const palette = isDark ? PALETTES.dark : PALETTES.light;
      return {
        cloud: parseHex(p.cloudColor || palette.cloud),
        skyTop: parseHex(p.skyTopColor || palette.skyTop),
        skyBottom: parseHex(p.skyBottomColor || palette.skyBottom),
      };
    };

    // Molnen driver långsamt. 60 bildrutor i sekunden är dubbelt så dyrt
    // som 30 utan att se annorlunda ut för en rörelse i den här takten.
    const MIN_FRAME_MS = 1000 / 30;
    let lastDraw = 0;
    // ── Nödbromsen, TVÅ steg ──
    // Mjukvaru-WebGL (ingen GPU-drivrutin, äldre laptop, vissa mobiler i
    // strömsparläge, headless Chrome — dvs. exakt vad Lighthouse mäter
    // med) ritar den här shadern i enstaka bildrutor per sekund, och en
    // enda sådan bildruta kan kosta SEKUNDER av huvudtråden (uppmätt: upp
    // mot 2,3 s per bildruta). Det gamla, tidsbaserade varvet ("mät i en
    // sekund, se hur många bildrutor det blev") ser bra ut på papper men
    // straffar sig självt exakt när det behövs mest: är EN bildruta redan
    // dyrare än hela mätfönstret hinner ändå den fulla kostnaden tas innan
    // varvet ens vet att det ska stanna.
    //
    // 1) Känn igen känd mjukvaru-rendering INNAN en enda bildruta ritas
    //    (WEBGL_debug_renderer_info — SwiftShader/llvmpipe/Mesa-software
    //    är de vanliga namnen). Träff = rita EN bildruta i lägsta
    //    komplexitet (u_count sänkt, se drawFrame) och stanna direkt,
    //    utan att någonsin starta loopen. Ingen gissning, ingen kostnad
    //    utöver den ena bildrutan.
    // 2) Har GPU:n ett okänt/dolt namn (extension saknas, vanligt när
    //    sajten INTE körs i Chrome) mäts i stället en riktig ritnings
    //    faktiska kostnad direkt — men på en MIKROSKOPISK 16×16-yta, inte
    //    hela canvasen, så själva mätningen aldrig kan bli den dyra
    //    kostnaden den försöker undvika (se MAX_ACCEPTABLE_FRAME_MS).
    //    performance.now() + gl.finish() tvingar GPU:n klar innan klockan
    //    stoppas, annars mäter man bara hur snabbt JS kunde KÖA arbetet.
    //    Över budget = stanna efter den enda (fullstora) bildrutan som
    //    ritas om provet gick bra respektive det sista provet om det inte
    //    gjorde det — exakt samma slutläge som (1).
    // Resultatet i båda fallen: en stillastående himmel med moln, aldrig
    // en tom yta, och aldrig mer än en bildrutas kostnad betald för att
    // ta reda på det.
    // Gäller en 16×16-provbildruta (se nödbromsens steg 2 nedan), inte en
    // fullstor — en riktig GPU ritar 16×16 pixlar på bråkdelar av en
    // millisekund, så redan 20 ms är en gott och väl tilltagen marginal
    // som ändå fångar en enhet som är genuint överbelastad.
    const MAX_ACCEPTABLE_FRAME_MS = 20;
    let benchmarked = false;
    let softwareRenderer = false;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      softwareRenderer = /swiftshader|llvmpipe|softpipe|software/i.test(renderer);
    } catch {
      // Extensionen kan vara blockerad (t.ex. Firefox' fingerprinting-skydd)
      // — behandla som okänt, inte som "säkert snabbt". Steg 2 mäter ändå.
    }
    // Egen klocka i stället för now - start: loopen pausas när hjälten
    // skrollats förbi eller fliken göms (se nedan), och en klocka som
    // fortsätter ticka under pausen hade fått molnen att hoppa flera
    // sekunder framåt i samma ögonblick man skrollar tillbaka.
    let elapsedMs = 0;
    let prevNow = 0;
    const drawFrame = () => {
      const p = paramsRef.current;
      const { cloud, skyTop, skyBottom } = resolveColors(p);
      gl.uniform1f(loc.time, reduceMotion ? 0 : (elapsedMs / 1000) * p.speed);
      gl.uniform1f(loc.count, Math.min(6, Math.max(1, p.count)));
      gl.uniform3f(loc.cloud, cloud[0], cloud[1], cloud[2]);
      gl.uniform3f(loc.skyTop, skyTop[0], skyTop[1], skyTop[2]);
      gl.uniform3f(loc.skyBottom, skyBottom[0], skyBottom[1], skyBottom[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const draw = (now) => {
      if (!running) return;
      if (prevNow && now - lastDraw < MIN_FRAME_MS) { frame = requestAnimationFrame(draw); return; }
      if (prevNow) elapsedMs += now - prevNow;
      prevNow = now;
      lastDraw = now;
      const p = paramsRef.current;
      const elapsed = reduceMotion ? 0 : (elapsedMs / 1000) * p.speed;
      const { cloud, skyTop, skyBottom } = resolveColors(p);

      gl.uniform1f(loc.time, elapsed);
      gl.uniform1f(loc.count, Math.min(6, Math.max(1, p.count)));
      gl.uniform3f(loc.cloud, cloud[0], cloud[1], cloud[2]);
      gl.uniform3f(loc.skyTop, skyTop[0], skyTop[1], skyTop[2]);
      gl.uniform3f(loc.skyBottom, skyBottom[0], skyBottom[1], skyBottom[2]);

      if (!benchmarked && !reduceMotion) {
        // Mät på en MIKROSKOPISK 16×16-yta i stället för hela canvasens
        // upplösning — kostnaden växer linjärt med antalet pixlar (se
        // resize()), så att mäta i full storlek kan i sig kosta sekunder
        // på en trög enhet, exakt det provet ska undvika att betala för.
        // gl.finish() tvingar GPU:n klar innan klockan stoppas (annars
        // mäter performance.now() bara hur snabbt JS kunde KÖA anropet).
        // 16×16 avslöjar ändå en katastrofalt seg enhet: är ens DET för
        // långsamt är full skärm garanterat värre.
        gl.viewport(0, 0, 16, 16);
        const t0 = performance.now();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
        const probeCost = performance.now() - t0;
        gl.viewport(0, 0, canvas.width, canvas.height); // tillbaka till riktig storlek
        benchmarked = true;
        if (probeCost > MAX_ACCEPTABLE_FRAME_MS) {
          running = false;
          gl.drawArrays(gl.TRIANGLES, 0, 3); // en sista bildruta i RIKTIG storlek (16×16-provet syntes aldrig)
          return;
        }
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      frame = requestAnimationFrame(draw);
    };

    if (softwareRenderer) {
      // Känd mjukvaru-rendering — rita en enda bildruta i låg komplexitet
      // och stanna direkt, starta aldrig loopen. Se nödbromsens
      // filkommentar ovan.
      const p = paramsRef.current;
      const { cloud, skyTop, skyBottom } = resolveColors(p);
      gl.uniform1f(loc.time, 0);
      gl.uniform1f(loc.count, 2);
      gl.uniform3f(loc.cloud, cloud[0], cloud[1], cloud[2]);
      gl.uniform3f(loc.skyTop, skyTop[0], skyTop[1], skyTop[2]);
      gl.uniform3f(loc.skyBottom, skyBottom[0], skyBottom[1], skyBottom[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      benchmarked = true;
      running = false;
    } else {
      frame = requestAnimationFrame(draw);
    }

    // Loopen ska inte kosta något när ingen tittar. Två skäl att pausa:
    // hjälten är utskrollad (besökaren läser prissektionen — molnen ritas
    // ändå, varje bildruta, hela sessionen) och fliken är dold. Båda var
    // ren ren förlust innan: en öppen flik i bakgrunden fortsatte bränna
    // GPU och batteri på en himmel ingen ser.
    const setRunning = (next) => {
      // Har nödbromsen slagit till startar loopen aldrig igen — den här
      // enheten klarar inte att animera shadern, och det ändras inte av
      // att man skrollar tillbaka.
      if (benchmarked && !running) return;
      if (next === running) return;
      running = next;
      if (next) {
        prevNow = 0; // nollställ deltat, annars räknas hela pausen som en bildruta
        frame = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(frame);
      }
    };
    let onScreen = true;
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      setRunning(onScreen && !document.hidden);
    }, { threshold: 0 });
    visibility.observe(canvas);
    const onVisibilityChange = () => setRunning(onScreen && !document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Byt om vid temaväxling när loopen INTE ritar av sig själv.
    //
    // Bugkritiskt (kundrapporterat: "hjälten är kvar i ljust läge när jag
    // slår om till mörkt"): villkoret var tidigare bara `reduceMotion`,
    // vilket stämde så länge loopen alltid rullade i övriga fall. Sedan
    // nödbromsen och pausen vid utskrollad hjälte tillkom finns det tre
    // lägen där ingen ny bildruta ritas — reducerad rörelse, pausad, och
    // permanent stoppad — och i alla tre satt den senast ritade himlen
    // kvar i FEL tema tills sidan laddades om. Rätt villkor är därför
    // "ritar loopen inte just nu?", inte "har användaren stängt av
    // animationer?".
    const themeObserver = new MutationObserver(() => {
      if (running) return; // loopen plockar upp färgerna själv nästa bildruta
      drawFrame();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsRef speglar props varje render (se ovan), effekten ska bara köra en gång per mount precis som i originalkomponenten.
  }, []);

  return (
    <div className={`bx-cloudsky${className ? ` ${className}` : ''}`} style={{ position: 'relative', height: '100%', minHeight: '320px', width: '100%', overflow: 'hidden', ...style }}>
      {/* Se kommentaren vid SKY_FALLBACK_CSS: gradienten under canvasen är
          samma himmel som shadern målar, så det inte finns någon skillnad
          att se mellan förrenderad HTML och första ritade bildrutan. */}
      <style>{SKY_FALLBACK_CSS}</style>
      <canvas ref={canvasRef} aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {children ? (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
