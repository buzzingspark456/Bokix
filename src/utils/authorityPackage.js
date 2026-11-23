// Paket till Skatteverket eller revisor (2026-11-23). En zip för ett
// räkenskapsår med allt som brukar efterfrågas vid en revision eller
// granskning: bokföringen som SIE4, verifikationslistan med summering per
// konto i Excel, alla underlag döpta efter verifikationen och en läs mig-fil
// som förklarar innehållet. Revisionen görs hos den bokföringsskyldige
// (skatteförfarandelagen 41 kap. 3 §), så det är kunden som tar fram och
// lämnar paketet. Bokix skickar inget själv.
import { generateSIE4 } from './sieExport';
import { encodeCp437 } from './sieCharset';
import { buildVerificationSheet, buildAccountSummarySheet, buildWorkbook, verificationsInRange } from './excelExport';
import { buildUnderlagZip } from './underlagExport';
import { getSignedStorageUrl } from './signedUrls';

const isBooked = (v) => (v?.status || 'booked') !== 'draft';
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim();

/** Läs mig-filen (text). */
export function readmeText({ company, range, label, verificationCount, fileCount, missing, failed, createdAt = new Date() }) {
  const created = createdAt.toISOString().slice(0, 10);
  const lines = [
    `Bokföring för ${company?.name || 'företaget'}${company?.orgNr ? ` (${company.orgNr})` : ''}`,
    range ? `Räkenskapsår: ${range.from} till ${range.to}` : 'Hela bokföringen',
    `Skapad ${created} i Bokix (www.bokix.se)`,
    '',
    'Innehåll',
    '',
    `Bokforing_${label}.se`,
    '  Bokföringen i SIE4-format, med ingående och utgående balanser och alla',
    '  verifikationer. Kan läsas in i de flesta bokförings- och revisionsprogram.',
    '',
    `Verifikationslista_${label}.xlsx`,
    '  Alla verifikationer rad för rad, och en summering per konto.',
    '',
    'Underlag/',
    '  Kvitton, fakturor och andra underlag, döpta efter verifikationen',
    '  (A12.pdf hör till verifikation A12). Forteckning.xlsx visar vilket',
    '  underlag som hör till vilken verifikation och om något saknas.',
    '  Underlag som inte kopplats till en verifikation ligger i Okopplade.',
    '',
    `Verifikationer: ${verificationCount}`,
    `Underlag i paketet: ${fileCount}`,
    `Verifikationer utan underlag: ${missing}`,
  ];
  if (failed) lines.push(`Underlag som inte gick att hämta: ${failed} (står i Forteckning.xlsx)`);
  return lines.join('\r\n') + '\r\n';
}

const utf8Bom = (text) => {
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(body.length + 3);
  out.set([0xEF, 0xBB, 0xBF]); out.set(body, 3);
  return out;
};

/**
 * Bygger paketet. range = { from, to } eller null för allt.
 * Returnerar { zip, fileName, verificationCount, fileCount, missing, failed }.
 */
export async function buildAuthorityPackage({ company, accounts = [], verifications = [], documents = [], lookups = {}, range = null, label, XLSX, fetchFile, onProgress, createdAt }) {
  const tag = safe(label || (range ? range.from.slice(0, 4) : 'alla'));
  const inRange = verificationsInRange(verifications, range).filter(isBooked);
  const sie = generateSIE4(company, accounts, verifications, range ? { from: range.from, to: range.to } : {});
  const sheet = buildVerificationSheet(inRange, { accounts, ...lookups });
  const wb = buildWorkbook(XLSX, [sheet, buildAccountSummarySheet(sheet)]);
  const extraFiles = [
    { name: `Bokforing_${tag}.se`, data: encodeCp437(sie) },
    { name: `Verifikationslista_${tag}.xlsx`, data: new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })) },
  ];
  // Läs mig behöver siffrorna från underlagen, så zip:en byggs i två varv.
  // Filerna hämtas bara en gång (cachen); andra varvet går direkt.
  const cache = new Map();
  const once = async (url) => { if (!cache.has(url)) cache.set(url, await fetchFile(url)); return cache.get(url); };
  const result = await buildUnderlagZip(verifications, range, { XLSX, fetchFile: once, onProgress, documents, folder: 'Underlag/', extraFiles: [] });
  const readme = readmeText({ company, range, label: tag, verificationCount: inRange.length, fileCount: result.fileCount, missing: result.missing, failed: result.failed, createdAt });
  const { zip } = await buildUnderlagZip(verifications, range, {
    XLSX, fetchFile: once, documents, folder: 'Underlag/',
    extraFiles: [{ name: 'Las_mig.txt', data: utf8Bom(readme) }, ...extraFiles],
  });
  return { zip, fileName: `${safe(company?.name) || 'bokforing'}_${tag}.zip`, verificationCount: inRange.length, fileCount: result.fileCount, missing: result.missing, failed: result.failed };
}


/** Webbläsarversionen: hämtar underlagen via signerade länkar och laddar ner. */
export async function downloadAuthorityPackage(args) {
  const XLSX = await import('xlsx');
  const fetchFile = async (url) => {
    const signed = await getSignedStorageUrl(url);
    const res = await fetch(signed);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  const result = await buildAuthorityPackage({ ...args, XLSX, fetchFile });
  const blob = new Blob([result.zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = result.fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return result;
}
