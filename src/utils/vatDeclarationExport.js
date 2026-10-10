import jsPDF from 'jspdf';

// ─────────────────────────────────────────────────────────────────────────
// XML-export (eSKD, "Deklarera via fil" på skatteverket.se) — tidigare
// medvetet inte byggd (se git-historik för den ursprungliga varningen);
// osäkerheten är nu upplöst, läs nedan innan du ändrar fälttaggarna.
//
// Osäkerheten gällde vad <MomsInkopUtgHog/Medel/Lag> representerar — ruta
// 20–24-relaterad utgående moms på omvänd skattskyldighet, eller
// försäljningsunderlag vid 12/6 %? Bekräftat mot TVÅ oberoende källor
// (2026-09): Skatteverkets egen sida "Lämna momsdeklaration via fil i
// e-tjänsten" (skatteverket.se, sidan för filuppladdning) och Microsoft
// Dynamics 365s officiella Sverige-lokalisering (learn.microsoft.com) —
// båda är överens: <MomsInkopUtgHog/Medel/Lag> = ruta 30/31/32, utgående
// moms på inköp i ruta 20–24 (omvänd skattskyldighet). Det har alltså
// ALDRIG haft med försäljningsunderlag att göra.
//
// Sedan 2026-09-27 skriver filen alla rutor Bokix räknar fram: omvänd
// skattskyldighet (20-24, 30-32), försäljning utan svensk moms (35-42) och
// import (50, 60-62). Taggarna och deras ordning är kontrollerade mot
// Skatteverkets sida "Lämna momsdeklaration via fil i e-tjänsten" samma dag
// (se ESKD_TAGS nedan). Grundfälten:
//   <OrgNr>            "xxxxxx-xxxx" (10 siffror, med bindestreck)
//   <Period>           ÅÅÅÅMM — sista månaden i kvartalet för kvartalsvis
//                       redovisning (t.ex. kvartal 3 2026 → "202609")
//   <ForsMomsEjAnnan>  ruta 05 — all momspliktig försäljning, alla satser
//                       summerade i EN box (se vatConfig.js VAT_RUTOR)
//   <MomsUtgHog/Medel/Lag>  ruta 10/11/12 — utgående moms per sats
//   <MomsIngAvdr>      ruta 48 — ingående moms att dra av
//   <MomsBetala>       ruta 49 — moms att betala (+) eller återfå (minus
//                       direkt före beloppet, inget mellanslag)
//
// Övriga bekräftade formatregler: ISO-8859-1, rotelement
// <eSKDUpload Version="6.0">, inget xmlns, inget DOCTYPE krävs, belopp som
// heltal utan tusentalsavgränsare eller decimaler.
// ─────────────────────────────────────────────────────────────────────────

// Taggarna i den ordning Skatteverket anger dem, med rutan de hör till.
// Ruta 49 (MomsBetala) skrivs sist, separat.
const ESKD_TAGS = [
  ['ForsMomsEjAnnan', '05'],
  ['MomsUtgHog', '10'], ['MomsUtgMedel', '11'], ['MomsUtgLag', '12'],
  ['InkopVaruAnnatEg', '20'], ['InkopTjanstAnnatEg', '21'], ['InkopTjanstUtomEg', '22'],
  ['InkopVaruSverige', '23'], ['InkopTjanstSverige', '24'],
  ['MomsInkopUtgHog', '30'], ['MomsInkopUtgMedel', '31'], ['MomsInkopUtgLag', '32'],
  ['ForsVaruAnnatEg', '35'], ['ForsVaruUtomEg', '36'],
  ['ForsTjSkskAnnatEg', '39'], ['ForsTjOvrUtomEg', '40'], ['ForsKopareSkskSverige', '41'], ['ForsOvrigt', '42'],
  ['MomsUlagImport', '50'],
  ['MomsImportUtgHog', '60'], ['MomsImportUtgMedel', '61'], ['MomsImportUtgLag', '62'],
  ['MomsIngAvdr', '48'],
];

// Värdet för en ruta ur det avrundade resultatet (roundedVatPeriod). Tål
// äldre objekt som bara har reversePurchaseEu/NonEu i stället för purchaseByRuta.
function eskdValue(ruta, r) {
  const rate = { 10: 25, 11: 12, 12: 6, 30: 25, 31: 12, 32: 6, 60: 25, 61: 12, 62: 6 }[ruta];
  switch (ruta) {
    case '05': return r.underlagByRate[25] + r.underlagByRate[12] + r.underlagByRate[6];
    case '10': case '11': case '12': return r.outputVatByRate[rate];
    case '30': case '31': case '32': return (r.reverseVatByRate || {})[rate] || 0;
    case '60': case '61': case '62': return (r.importVatByRate || {})[rate] || 0;
    case '21': return r.purchaseByRuta?.['21'] ?? r.reversePurchaseEu ?? 0;
    case '22': return r.purchaseByRuta?.['22'] ?? r.reversePurchaseNonEu ?? 0;
    case '48': return r.inputVat;
    default: return r.purchaseByRuta?.[ruta] ?? r.exemptSalesByRuta?.[ruta] ?? 0;
  }
}

/** ÅÅÅÅMM — sista månaden i kvartalet, det format Skatteverkets eSKD-fil
 * kräver för kvartalsvis momsredovisning. */
function eskdPeriod(year, quarter) {
  const lastMonth = quarter * 3;
  return `${year}${String(lastMonth).padStart(2, '0')}`;
}

/** "xxxxxx-xxxx" oavsett hur orgNr råkar vara lagrat (med/utan bindestreck,
 * mellanslag) — eSKD-filen kräver bindestrecket på plats. */
function formatOrgNrForEskd(orgNr) {
  const digits = (orgNr || '').replace(/\D/g, '');
  if (digits.length !== 10) return null;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** Genererar eSKD-XML-innehållet (som sträng) för momsdeklarationen — se
 * kommentaren ovan för vilka fält som är bekräftade och varför bara de
 * tas med. Kastar om org.numret saknas/är ogiltigt — filen kan inte
 * skickas till Skatteverket utan ett giltigt org.nummer. */
export function generateVatDeclarationXml({ company, year, quarter, rounded, eskdPeriod: periodOverride = null }) {
  const orgNr = formatOrgNrForEskd(company?.orgNr);
  if (!orgNr) {
    throw new Error('Företaget saknar ett giltigt organisationsnummer (10 siffror) — lägg till det i Inställningar innan XML-filen kan skapas.');
  }

  const lines = [
    '<?xml version="1.0" encoding="ISO-8859-1"?>',
    '<eSKDUpload Version="6.0">',
    `<OrgNr>${orgNr}</OrgNr>`,
    '<Moms>',
    `<Period>${periodOverride || eskdPeriod(year, quarter)}</Period>`,
  ];
  // Rutor med värdet 0 utelämnas; ruta 49 skrivs alltid.
  for (const [tag, ruta] of ESKD_TAGS) {
    const value = eskdValue(ruta, rounded);
    if (value) lines.push(`<${tag}>${value}</${tag}>`);
  }
  lines.push(`<MomsBetala>${rounded.netToPay}</MomsBetala>`);
  lines.push('</Moms>', '</eSKDUpload>');

  return lines.join('\r\n') + '\r\n';
}

// Samma anledning som encodeWindows1252 i sruExport.js: Blob kodar alltid
// JS-strängar som UTF-8 oavsett deklarerad charset. ISO-8859-1 (Latin-1)
// delar kodpunkter rakt av med JS charCodeAt för 0x00–0xFF, så samma
// per-tecken-avkortning fungerar här. Företagsnamn ingår inte i denna fil
// (bara siffror och versaler i taggarna), men principen upprätthålls ändå
// för att inte tyst producera en fil med fel deklarerad encoding.
function encodeIso88591(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code <= 0xFF ? code : 0x3F;
  }
  return bytes;
}

export function downloadVatDeclarationXml({ company, year, quarter, rounded, eskdPeriod = null }, filename) {
  const xml = generateVatDeclarationXml({ company, year, quarter, rounded, eskdPeriod });
  const blob = new Blob([encodeIso88591(xml)], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genererar en enkel, tydlig sammanställnings-PDF med Skatteverkets rutnummer
 * och avrundade belopp — inte Skatteverkets egen officiella blankett (det är
 * inte en offentlig mall vi kan återge exakt), utan ett Bokix-dokument
 * användaren kan skriva av beloppen från rakt in i Skatteverkets e-tjänst.
 */
export function generateVatDeclarationPdf({ company, periodLabel, rounded, rutor }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Momsdeklaration — sammanställning', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(company?.name || 'Företag', marginX, y);
  y += 16;
  if (company?.orgNr) { doc.text(`Org.nr: ${company.orgNr}`, marginX, y); y += 16; }
  doc.text(`Period: ${periodLabel}`, marginX, y);
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Ruta', marginX, y);
  doc.text('Belopp (kr, avrundat)', marginX + 340, y);
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  rutor.forEach(r => {
    if (r.value === null || r.value === undefined) return;
    doc.text(`${r.ruta}  ${r.label}`, marginX, y);
    const amountText = `${r.value.toLocaleString('sv-SE')} kr`;
    doc.text(amountText, 548, y, { align: 'right' });
    y += 20;
  });

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const isRefund = rounded.netToPay < 0;
  const netLabel = isRefund ? 'Ruta 49 — Moms att återfå' : 'Ruta 49 — Moms att betala';
  doc.text(netLabel, marginX, y);
  doc.text(`${Math.abs(rounded.netToPay).toLocaleString('sv-SE')} kr`, 548, y, { align: 'right' });

  y += 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Beloppen är avrundade till hela kronor enligt Skatteverkets krav på deklarationsformuläret.', marginX, y);
  y += 14;
  doc.text('Detta är en sammanställning från Bokix, inte Skatteverkets officiella blankett.', marginX, y);

  return doc;
}

export function downloadVatDeclarationPdf(args, filename) {
  const doc = generateVatDeclarationPdf(args);
  doc.save(filename);
}
