import jsPDF from 'jspdf';

// ─────────────────────────────────────────────────────────────────────────
// XML-export (eSKD, "Deklarera via fil" på skatteverket.se) — MEDVETET INTE
// BYGGD ÄNNU. Läs varför innan du lägger till den.
//
// Vi researchade Skatteverkets sida "Lämna momsdeklaration via fil i
// e-tjänsten" och kunde bekräfta grundstrukturen (rotelement
// <eSKDUpload Version="6.0">, ISO-8859-1, <OrgNr>, <Moms>, <Period>) samt ett
// par fälttaggar med rimlig säkerhet: <ForsMomsEjAnnan> (ruta 05, 25 %-
// underlag), <MomsUtgHog/Medel/Lag> (ruta 10/11/12, utgående moms),
// <MomsIngAvdr> (ruta 48), <MomsBetala> (ruta 49).
//
// Däremot gick två oberoende hämtningar av samma källa isär om vad taggarna
// <MomsInkopUtgHog/Medel/Lag> faktiskt representerar — den ena beskrev dem
// som "inköp med omvänd skattskyldighet" (ruta 20–24), den andra som samma
// taggar i ett exempel som antydde försäljningsunderlag vid 12/6 %. Det är
// exakt den typen av osäkerhet som inte får gissas bort i en fil som
// Skatteverket ska validera — en felaktig tagg kan få hela filen refuserad,
// eller ännu värre, bokföras fel hos Skatteverket utan att uppladdningen
// felar. Vi har inte haft tillgång till Skatteverkets testmiljö för att
// verifiera skillnaden.
//
// Fram tills detta är bekräftat (t.ex. genom Skatteverkets tekniska
// beskrivning för momsdeklarations-API:et, eller en verifierad testfil):
// bygg INTE XML-nedladdningen som en riktig funktion. PDF-exporten nedan
// täcker samma behov — användaren skriver av beloppen för hand — och är
// den lösning som är säker att lansera med.
// ─────────────────────────────────────────────────────────────────────────

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
