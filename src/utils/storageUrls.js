// ─────────────────────────────────────────────────────────────────────────
// Vilka filer i Supabase Storage som en datamängd faktiskt refererar till.
//
// Bakgrunden är en dataminimeringsgenomgång: appens hela tillstånd ligger
// som EN JSON-post per användare (user_data.state), så när något tas bort i
// gränssnittet krymper posten vid nästa sparning och är därmed borta ur
// databasen. Uppladdade FILER fungerar inte så — de ligger i Storage och
// lever vidare tills någon uttryckligen raderar dem. Ett borttaget företag
// lämnade alltså kvar varenda kvittobild för alltid.
//
// Att räkna upp fälten (receiptUrl, attachmentUrl, logoUrl …) vore fel
// angreppssätt: nästa fält någon lägger till skulle tyst missas, och felet
// skulle synas först på nästa faktura från Supabase. I stället letas alla
// strängar som ÄR en Storage-URL, oavsett var i strukturen de ligger. Ett
// nytt fält kräver då ingen ändring här.
// ─────────────────────────────────────────────────────────────────────────

/** Supabase Storage publika URL:er: .../storage/v1/object/public/<bucket>/<path>
 * Cachebustern (?v=…) som Settings.jsx lägger på ingår inte i sökvägen. */
export const STORAGE_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/?"'\s]+)\/([^?"'\s]+)/;

/** Delar upp en publik URL i bucket + sökväg. `null` om det inte är en
 * Storage-URL alls (t.ex. en extern bildlänk någon klistrat in). */
export function parseStorageUrl(url) {
  if (typeof url !== 'string') return null;
  const m = STORAGE_URL_PATTERN.exec(url);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Alla Storage-URL:er som förekommer någonstans i ett värde — objekt,
 * arrayer och strängar, hur djupt som helst.
 *
 * `seen` skyddar mot cirkulära referenser: appens tillstånd är ren JSON i
 * dag, men funktionen anropas också på godtyckliga delträd och ska inte
 * kunna hänga sig på en struktur som råkar peka tillbaka på sig själv.
 */
export function collectStorageUrls(value, seen = new WeakSet()) {
  const found = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') {
      if (parseStorageUrl(v)) found.add(v);
      return;
    }
    if (typeof v !== 'object') return;
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach(walk); return; }
    Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

/** Samma sak, men som en mängd av "bucket/sökväg" — formen en städrutin
 * behöver när den jämför mot vad som faktiskt ligger i bucketen. */
export function collectStoragePaths(value) {
  const paths = new Set();
  for (const url of collectStorageUrls(value)) {
    const parsed = parseStorageUrl(url);
    if (parsed) paths.add(`${parsed.bucket}/${parsed.path}`);
  }
  return paths;
}
