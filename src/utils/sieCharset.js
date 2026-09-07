// ── CP437/PC8-kodning för SIE4-filer ─────────────────────────────────────
// SIE4 (både export och, nu, import) deklarerar `#FORMAT PC8` — den
// klassiska DOS-kodsidan CP437, INTE UTF-8 och INTE windows-1252.
//
// Samma grundproblem som sruExport.js:s encodeWindows1252 löser (en
// `new Blob([sträng], {type:'...charset=X'})` kodar ALLTID JS-strängen
// som UTF-8, oavsett vad `type` säger) — men windows-1252 kunde lösas med
// en enkel per-tecken-avkortning (`code <= 0xFF ? code : '?'`) eftersom
// windows-1252 delar Latin-1:s kodpunkter för 0x00–0xFF. CP437 delar INTE
// den egenskapen: dess övre halva (0x80–0xFF) är en helt egen, oordnad
// DOS-layout (å=0x86, ä=0x84, ö=0x94, Å=0x8F, Ä=0x8E, Ö=0x99, plus
// ramritnings-/symboltecken som aldrig förekommer i en bokföringsfil men
// ändå måste kunna avkodas utan att krascha). En riktig 256-post
// uppslagstabell krävs i båda riktningarna — inte en kopia av
// windows-1252-varianten. Det här är den enskilt viktigaste
// korrekthetsdetaljen i hela SIE-import/export-arbetet: fel tabell
// korrumperar tyst varje å/ä/ö i varje importerat/exporterat namn.
const CP437_TABLE = [
  // 0x00–0x1F: styrtecken — identitetsmappade, förekommer aldrig i
  // faktisk SIE-text (bara i radbrytningar/strukturtecken som redan
  // hanteras som \r\n innan den här tabellen någonsin används).
  0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
  0x0008, 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x000E, 0x000F,
  0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017,
  0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D, 0x001E, 0x001F,
  // 0x20–0x7F: vanlig ASCII, identitetsmappad.
  0x0020, 0x0021, 0x0022, 0x0023, 0x0024, 0x0025, 0x0026, 0x0027,
  0x0028, 0x0029, 0x002A, 0x002B, 0x002C, 0x002D, 0x002E, 0x002F,
  0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036, 0x0037,
  0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x003D, 0x003E, 0x003F,
  0x0040, 0x0041, 0x0042, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047,
  0x0048, 0x0049, 0x004A, 0x004B, 0x004C, 0x004D, 0x004E, 0x004F,
  0x0050, 0x0051, 0x0052, 0x0053, 0x0054, 0x0055, 0x0056, 0x0057,
  0x0058, 0x0059, 0x005A, 0x005B, 0x005C, 0x005D, 0x005E, 0x005F,
  0x0060, 0x0061, 0x0062, 0x0063, 0x0064, 0x0065, 0x0066, 0x0067,
  0x0068, 0x0069, 0x006A, 0x006B, 0x006C, 0x006D, 0x006E, 0x006F,
  0x0070, 0x0071, 0x0072, 0x0073, 0x0074, 0x0075, 0x0076, 0x0077,
  0x0078, 0x0079, 0x007A, 0x007B, 0x007C, 0x007D, 0x007E, 0x007F,
  // 0x80–0xFF: CP437:s egen övre halva — de svenska bokstäverna som
  // faktiskt förekommer i bolagsnamn/kontonamn sitter här, utspridda.
  0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7,
  0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
  0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9,
  0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192,
  0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA,
  0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
  0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
  0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
  0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
  0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
  0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4,
  0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229,
  0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248,
  0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x00A0,
];

// Omvänd tabell (Unicode-kodpunkt → byte) för kodning, byggd en gång vid
// modulladdning istället för vid varje anrop.
const REVERSE_CP437 = new Map();
CP437_TABLE.forEach((codePoint, byte) => {
  if (!REVERSE_CP437.has(codePoint)) REVERSE_CP437.set(codePoint, byte);
});

/** JS-sträng → CP437-bytes. Tecken som saknas i CP437 (i praktiken bara
 * möjligt om någon klistrat in emoji/CJK i ett bolagsnamn) blir "?"
 * (0x3F) hellre än att tyst korrumpera resten av filen — samma princip
 * som encodeWindows1252 i sruExport.js. */
export function encodeCp437(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.charCodeAt(i);
    bytes[i] = codePoint < 0x80 ? codePoint : (REVERSE_CP437.get(codePoint) ?? 0x3F);
  }
  return bytes;
}

/** CP437-bytes (från en uppladdad fil, t.ex. via File.arrayBuffer()) →
 * JS-sträng. Tar emot ArrayBuffer eller Uint8Array. */
export function decodeCp437(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += String.fromCodePoint(CP437_TABLE[arr[i]]);
  }
  return out;
}

/** Avgör bäst-möjliga textkodning för en uppladdad SIE-fil UTAN att lita
 * blint på filens egen `#FORMAT`-deklaration — verkliga exportfiler visar
 * sig ibland vara UTF-8 trots att de säger PC8/CP437 (samma lärdom som
 * bankImport.js:s decodeBankCsvText redan bakade in för CSV-filer).
 *
 * Bugkritiskt (hittat under testskrivning, inte bara i teorin): den
 * första versionen av den här funktionen provade CP437 FÖRST och letade
 * efter "trasiga"/ersättningstecken för att avgöra om den skulle falla
 * tillbaka till UTF-8 — men CP437 har en giltig glyf för VARJE byte
 * 0x00–0xFF, så en felaktigt CP437-avkodad UTF-8-fil ger aldrig ett
 * ersättningstecken att upptäcka, bara tyst fel text (mojibake). CP437
 * kan alltså aldrig signalera sin egen felaktighet den vägen.
 *
 * Rätt ordning är den OMVÄNDA: prova STRIKT UTF-8-avkodning först (med
 * `fatal:true`) — riktig UTF-8 har strikta regler för flerbytesekvenser,
 * så en fil som råkar vara giltig UTF-8 (och innehåller faktiska å/ä/ö)
 * är det i praktiken alltid VERKLIGEN, inte av en slump. Misslyckas den
 * strikta UTF-8-avkodningen (kastar), är bytesen med mycket stor
 * säkerhet enkel-byte-data — då litar vi på filens egen PC8-deklaration
 * och CP437-avkodar. */
export function decodeSieBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeCp437(bytes);
  }
}
