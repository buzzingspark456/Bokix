import jsPDF from 'jspdf';

// Årsredovisningen som PDF, att skriva ut, skriva under och skicka till
// Bolagsverket tillsammans med fastställelseintyget (sista sidan). Siffrorna
// kommer ur computeAnnualReport (annualReport.js), samma som visas i appen.

const MARGIN_X = 56;
const PAGE_BOTTOM = 790;
const COL_NOTE = 360;
const COL_CUR = 470;
const COL_PREV = 540;

// Hela kronor med mellanslag som tusentalsavgränsare och vanligt minustecken
// (PDF-typsnittet saknar U+2212, som sv-SE annars använder).
export function formatKr(v) {
  const n = Math.round(Number(v) || 0);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return n < 0 ? `-${s}` : s;
}

const fmtDate = (isoDate) => isoDate || '';

export function generateAnnualReportPdf({ company, report, details = {} }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { fy, prevFy, hasPrevious } = report;
  let y = 0;
  let noteNo = 0;
  const pageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(`${company?.name || ''}${company?.orgNr ? `  ${company.orgNr}` : ''}`, MARGIN_X, 36);
    doc.setTextColor(0);
    y = 70;
  };
  const newPage = () => { doc.addPage(); pageHeader(); };
  const ensure = (h) => { if (y + h > PAGE_BOTTOM) newPage(); };
  const h1 = (t) => { ensure(40); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(t, MARGIN_X, y); y += 26; };
  const h2 = (t) => { ensure(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(t, MARGIN_X, y); y += 17; };
  const para = (t, size = 10) => {
    if (!t) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(String(t), 480)) { ensure(14); doc.text(line, MARGIN_X, y); y += 13.5; }
    y += 6;
  };
  const amountHeader = (noteCol = true) => {
    ensure(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (noteCol) doc.text('Not', COL_NOTE, y);
    doc.text(fy.label, COL_CUR, y, { align: 'right' });
    if (hasPrevious) doc.text(prevFy.label, COL_PREV, y, { align: 'right' });
    y += 14;
  };
  const amountRow = (label, cur, prev, { bold = false, note = null, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(label, COL_NOTE - MARGIN_X - 12 - indent);
    ensure(lines.length * 12 + 2);
    lines.forEach((l, i) => doc.text(l, MARGIN_X + indent, y + i * 12));
    const last = y + (lines.length - 1) * 12;
    if (note) doc.text(String(note), COL_NOTE, last);
    if (cur !== null && cur !== undefined) doc.text(formatKr(cur), COL_CUR, last, { align: 'right' });
    if (hasPrevious && prev !== null && prev !== undefined) doc.text(formatKr(prev), COL_PREV, last, { align: 'right' });
    y = last + (bold ? 16 : 13.5);
  };
  const rule = () => { doc.setDrawColor(200); doc.line(MARGIN_X, y - 9, COL_PREV, y - 9); };

  // ── Försättsblad ──
  y = 250;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Årsredovisning för', 297.5, y, { align: 'center' });
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(company?.name || 'Företaget', 297.5, y, { align: 'center' });
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  if (company?.orgNr) { doc.text(`Org.nr ${company.orgNr}`, 297.5, y, { align: 'center' }); y += 20; }
  doc.text(`Räkenskapsåret ${fmtDate(fy.start)} – ${fmtDate(fy.end)}`, 297.5, y, { align: 'center' });
  y += 60;
  doc.setFontSize(10.5);
  const contents = ['Förvaltningsberättelse', 'Resultaträkning', 'Balansräkning', 'Noter', 'Underskrifter'];
  doc.text('Årsredovisningen omfattar', 297.5, y, { align: 'center' });
  y += 18;
  contents.forEach(c => { doc.text(c, 297.5, y, { align: 'center' }); y += 15; });
  y += 20;
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text('Samtliga belopp redovisas i hela kronor om inget annat anges.', 297.5, y, { align: 'center' });
  doc.setTextColor(0);

  // ── Förvaltningsberättelse ──
  newPage();
  h1('Förvaltningsberättelse');
  para(`Styrelsen för ${company?.name || 'bolaget'} avger härmed årsredovisning för räkenskapsåret ${fy.start} – ${fy.end}.`);
  h2('Verksamheten');
  para(details.business || 'Beskriv bolagets verksamhet här.');
  if (details.seat) para(`Bolaget har sitt säte i ${details.seat}.`);
  if (details.events) { h2('Väsentliga händelser under räkenskapsåret'); para(details.events); }

  h2('Flerårsöversikt');
  const ov = report.overview;
  const ovCols = ov.map((_, i) => COL_PREV - (ov.length - 1 - i) * 75);
  ensure(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  ov.forEach((o, i) => doc.text(o.label, ovCols[i], y, { align: 'right' }));
  y += 14;
  const ovRow = (label, pick) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    ensure(14);
    doc.text(label, MARGIN_X, y);
    ov.forEach((o, i) => doc.text(pick(o), ovCols[i], y, { align: 'right' }));
    y += 13.5;
  };
  ovRow('Nettoomsättning', o => formatKr(o.netSales));
  ovRow('Resultat efter finansiella poster', o => formatKr(o.resultAfterFinancial));
  ovRow('Soliditet (%)', o => (o.solidity === null ? '-' : String(Math.round(o.solidity))));
  y += 4;
  para('Soliditet: justerat eget kapital (eget kapital och obeskattade reserver med avdrag för uppskjuten skatt) i procent av balansomslutningen.', 8.5);

  h2('Förändringar i eget kapital');
  const eqCols = report.balance.equity.columns;
  const eqX = eqCols.map((_, i) => COL_PREV - (eqCols.length - 1 - i) * 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  ensure(26);
  eqCols.forEach((c, i) => {
    const parts = doc.splitTextToSize(c.label, 76);
    parts.forEach((p, j) => doc.text(p, eqX[i], y + j * 10, { align: 'right' }));
  });
  y += 24;
  const eqRow = (label, pick, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    ensure(14);
    doc.text(label, MARGIN_X, y);
    eqCols.forEach((c, i) => doc.text(formatKr(pick(c)), eqX[i], y, { align: 'right' }));
    y += 13.5;
  };
  eqRow('Belopp vid årets ingång', c => c.open);
  if (eqCols.some(c => Math.abs(c.other) >= 0.5)) eqRow('Disposition enligt årsstämma och utdelning', c => c.other);
  eqRow('Årets resultat', c => c.yearResult);
  eqRow('Belopp vid årets utgång', c => c.close, true);
  y += 8;

  h2('Resultatdisposition');
  const d = report.disposition;
  para('Styrelsen föreslår att till förfogande stående vinstmedel:');
  const dispRow = (label, v, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9.5); ensure(14); doc.text(label, MARGIN_X + 12, y); doc.text(formatKr(v), COL_CUR, y, { align: 'right' }); y += 13.5; };
  dispRow('Balanserat resultat', d.retained);
  dispRow('Årets resultat', d.yearResult);
  dispRow('Summa', d.available, true);
  y += 6;
  para('disponeras enligt följande:');
  if (d.dividend > 0) dispRow('Utdelas till aktieägarna', d.dividend);
  dispRow('Balanseras i ny räkning', d.carriedForward);
  dispRow('Summa', d.available, true);
  y += 6;
  if (d.dividend > 0) para('Styrelsen anser att den föreslagna utdelningen är försvarlig med hänsyn till de krav som verksamhetens art, omfattning och risker ställer på storleken av det egna kapitalet, bolagets konsolideringsbehov, likviditet och ställning i övrigt.', 9);
  para('Bolagets resultat och ställning i övrigt framgår av efterföljande resultat- och balansräkning med noter.');

  // ── Resultaträkning ──
  newPage();
  h1('Resultaträkning');
  amountHeader();
  const employeeNote = ++noteNo + 1; // Not 1 är redovisningsprinciperna.
  noteNo = employeeNote;
  for (const l of report.income.lines) {
    if (l.kind === 'heading') { y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); ensure(16); doc.text(l.label, MARGIN_X, y); y += 14; continue; }
    if (l.kind === 'row') amountRow(l.label, l.current, l.previous, { indent: 8, note: l.row === '3.8' ? employeeNote : null });
    else { rule(); amountRow(l.label, l.current, l.previous, { bold: true }); }
  }

  // ── Balansräkning ──
  newPage();
  h1('Balansräkning');
  amountHeader();
  const b = report.balance;
  const assetNoteNo = new Map();
  for (const n of report.notes) assetNoteNo.set(n.title, ++noteNo);
  const noteFor = (label) => {
    if (/Maskiner och inventarier/.test(label)) return assetNoteNo.get('Maskiner och inventarier') || null;
    if (/Byggnader och mark/.test(label)) return assetNoteNo.get('Byggnader och mark') || null;
    return null;
  };
  const sectionRows = (sections) => {
    for (const sec of sections) {
      y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ensure(16); doc.text(sec.title, MARGIN_X, y); y += 14;
      for (const g of sec.groups) {
        if (g.title) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); ensure(14); doc.text(g.title, MARGIN_X + 8, y); y += 13; }
        for (const l of g.lines) amountRow(l.label, l.current, l.previous, { indent: 16, note: noteFor(l.label) });
        if (g.title && g.lines.length > 1) { rule(); amountRow(`Summa ${g.title.toLowerCase()}`, g.current, g.previous, { bold: true, indent: 8 }); }
      }
      rule();
      amountRow(`Summa ${sec.title.toLowerCase()}`, sec.current, sec.previous, { bold: true });
    }
  };
  h2('Tillgångar');
  sectionRows(b.assets);
  rule();
  amountRow('Summa tillgångar', b.totalAssets, b.totalAssetsPrev, { bold: true });

  y += 10;
  h2('Eget kapital och skulder');
  const eq = b.equity;
  const peq = b.prevEquity;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ensure(16); doc.text('Eget kapital', MARGIN_X, y); y += 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text('Bundet eget kapital', MARGIN_X + 8, y); y += 13;
  const cap = eq.columns.find(c => c.key === 'shareCapital');
  const pcap = peq?.columns.find(c => c.key === 'shareCapital');
  amountRow('Aktiekapital', cap.close, pcap?.close ?? 0, { indent: 16 });
  const restr = eq.columns.find(c => c.key === 'restricted');
  if (restr) amountRow('Övrigt bundet eget kapital', restr.close, peq?.columns.find(c => c.key === 'restricted')?.close ?? 0, { indent: 16 });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); ensure(14); doc.text('Fritt eget kapital', MARGIN_X + 8, y); y += 13;
  amountRow('Balanserat resultat', eq.retained, peq?.retained ?? 0, { indent: 16 });
  amountRow('Årets resultat', eq.yearResult, peq?.yearResult ?? 0, { indent: 16 });
  rule();
  amountRow('Summa eget kapital', eq.total, peq?.total ?? 0, { bold: true });
  sectionRows(b.liabilities);
  rule();
  amountRow('Summa eget kapital och skulder', b.totalEqLiab, b.totalEqLiabPrev, { bold: true });

  // ── Noter ──
  newPage();
  h1('Noter');
  h2('Not 1  Redovisningsprinciper');
  para('Årsredovisningen har upprättats i enlighet med årsredovisningslagen och Bokföringsnämndens allmänna råd BFNAR 2016:10 Årsredovisning i mindre företag (K2).');
  if (report.notes.length > 0) para('Materiella anläggningstillgångar redovisas till anskaffningsvärde minskat med ackumulerade avskrivningar. Avskrivning sker linjärt över den bedömda nyttjandeperioden.');
  para('Fordringar har tagits upp till de belopp varmed de beräknas inflyta. Övriga tillgångar och skulder har värderats till anskaffningsvärde om inget annat anges.');
  h2(`Not ${employeeNote}  Medelantalet anställda`);
  amountHeader(false);
  amountRow('Medelantalet anställda', report.employeesAverage, details.employeesAveragePrevious ?? null, {});
  for (const n of report.notes) {
    y += 6;
    h2(`Not ${assetNoteNo.get(n.title)}  ${n.title}`);
    amountHeader(false);
    amountRow('Ingående anskaffningsvärden', n.costOpen, null);
    amountRow('Inköp', n.costIn, null);
    if (Math.abs(n.costOut) >= 0.5) amountRow('Försäljningar och utrangeringar', n.costOut, null);
    amountRow('Utgående ackumulerade anskaffningsvärden', n.costClose, null, { bold: true });
    amountRow('Ingående avskrivningar', n.depOpen, null);
    amountRow('Årets avskrivningar', n.depYear, null);
    if (Math.abs(n.depOut) >= 0.5) amountRow('Återförda avskrivningar på sålda och utrangerade tillgångar', n.depOut, null);
    amountRow('Utgående ackumulerade avskrivningar', n.depClose, null, { bold: true });
    rule();
    amountRow('Redovisat värde', n.bookValue, null, { bold: true });
  }

  // ── Underskrifter ──
  y += 16;
  h2('Underskrifter');
  para(`${details.signPlace || '______________________'}, den ______________________`);
  y += 24;
  const members = String(details.boardMembers || '').split('\n').map(s => s.trim()).filter(Boolean);
  (members.length ? members : ['', '']).forEach(name => {
    ensure(48);
    doc.setDrawColor(0);
    doc.line(MARGIN_X, y, MARGIN_X + 220, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(name || 'Namnförtydligande', MARGIN_X, y + 13);
    y += 44;
  });

  // ── Fastställelseintyg ──
  newPage();
  h1('Fastställelseintyg');
  para(`Undertecknad styrelseledamot i ${company?.name || 'bolaget'}${company?.orgNr ? `, org.nr ${company.orgNr},` : ''} intygar att resultaträkningen och balansräkningen har fastställts på årsstämma den ${details.agmDate || '______________'}. Årsstämman beslutade att godkänna styrelsens förslag till disposition av bolagets resultat.`);
  para('Jag intygar att innehållet i dessa kopior av årsredovisningen överensstämmer med originalen.');
  y += 30;
  doc.line(MARGIN_X, y, MARGIN_X + 220, y);
  doc.setFontSize(9.5);
  doc.text(members[0] || 'Namnförtydligande', MARGIN_X, y + 13);
  doc.text('Ort och datum: ______________________', MARGIN_X, y + 40);

  // Sidnummer
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(`${i} (${pages})`, 539, 36, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc;
}

export function downloadAnnualReportPdf(args, filename) {
  generateAnnualReportPdf(args).save(filename);
}
