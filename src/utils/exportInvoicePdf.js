import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renderar given DOM-nod (InvoiceDocument, i praktiken — exakt samma nod
 * användaren ser i den levande förhandsgranskningen) till ett jsPDF-objekt.
 * Delad av `exportInvoicePdf` (ladda ner) och `getInvoicePdfBase64` (bifoga
 * i mejl) så PDF:en aldrig kan avvika mellan de två — bara vad som görs med
 * resultatet skiljer.
 */
// Två tidigare försök (scale+JPEG-kvalitet neråt, neråt igen) löste bara
// storleken genom att offra skärpa på TEXTEN — fel avvägning för ett
// textdokument. Den faktiska boven för filstorleken var aldrig
// upplösningen i sig: `.a4-paper` har `min-height: 297mm` (en hel A4-sida)
// oavsett hur lite innehåll fakturan har — en kort 3-rads-faktura rastrerade
// alltså över 20cm ren vit yta i FULL upplösning i onödan. Nollställer
// min-height till fångst-nodens faktiska innehållshöjd innan skärmdumpen
// (återställs direkt efteråt, rör aldrig den synliga förhandsgranskningen).
//
// PNG provades härnäst (lossless, inga JPEG-kanter runt text) men gav en
// PDF på över 6MB trots att själva canvas-bilden bara var ~170KB — ett känt
// jsPDF-problem: html2canvas PNG:er har en alfakanal (även fullt ogenomskinliga),
// och jsPDF lägger då till en separat, dåligt komprimerad soft mask-bild för
// alfan ovanpå färgdatat, vilket kan mångdubbla filstorleken oavsett hur
// liten själva bilden är. JPEG saknar helt konceptet alfakanal och undviker
// hela problemet. Med utrymmet min-height-trimningen frigör räcker det gott
// med en hög JPEG-kvalitet (0.92, nästan omärkbar kompression) istället för
// den tidigare hårt nedskruvade 0.7:an.
// Sida A4-bredd (210mm) — behålls alltid, så PDF:en fortfarande fyller en
// vanlig skrivare/pappersbredd. Höjden däremot är INTE längre alltid det
// fasta 297mm-A4-måttet: en kort, enradig faktura skulle annars täcka
// bara toppen av arket och lämna en stor vit yta under (kundfeedback —
// "ser kompakt/tom ut jämfört med förhandsgranskningen", eftersom
// förhandsgranskningens skärmdump av naturliga skäl bara visar det
// synliga innehållet, inte en hel A4-sidas tomrum).
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
// Golv för en degenererad nästan-tom nod (aldrig ett realistiskt fall,
// men jsPDF godtar inte en absurt liten/nollstor sida).
const MIN_PAGE_HEIGHT_MM = 40;

// Exporterad (inte bara privat) så sidstorleks-/orienteringslogiken ovan
// går att testa direkt mot jsPDF:s riktiga pageSize (se exportInvoicePdf.test.js)
// utan en webbläsare — html2canvas är det enda som behöver en riktig DOM,
// och mockas bort i testet.
export async function renderInvoicePdf(node) {
  if (!node) throw new Error('Inget fakturaunderlag att exportera.');

  const originalMinHeight = node.style.minHeight;
  node.style.minHeight = 'auto';

  let canvas;
  try {
    canvas = await html2canvas(node, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
  } finally {
    node.style.minHeight = originalMinHeight;
  }
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgHeightMM = (canvas.height * A4_WIDTH_MM) / canvas.width;

  if (imgHeightMM <= A4_HEIGHT_MM) {
    // Vanliga fallet: innehållet ryms på en sida. Sidan görs lika hög som
    // innehållet istället för fast 297mm — ingen vit yta kvar under.
    //
    // Bugkritiskt: jsPDF SORTERAR om ett `format: [a, b]`-par efter
    // orientation — "portrait" tvingar alltid det STÖRRE talet till höjd,
    // oavsett vilken ordning de anges i. En kort faktura (t.ex. 120mm hög)
    // är smalare än den är bred (120 < 210), så utan att uttryckligen
    // begära "landscape" hade jsPDF tyst VÄXLAT bredd/höjd och gett en
    // 120mm bred × 210mm hög sida — fel håll, inte samma bugg som
    // ursprungsproblemet men lika fel resultat. Verifierat direkt mot
    // jsPDF (inte bara läst): new jsPDF({format:[210,123], orientation:
    // 'portrait'}) → pageSize 123×210 (växlat!); samma med 'landscape'
    // → korrekt 210×123.
    const pageHeightMM = Math.max(imgHeightMM, MIN_PAGE_HEIGHT_MM);
    const orientation = pageHeightMM >= A4_WIDTH_MM ? 'portrait' : 'landscape';
    const pdf = new jsPDF({ unit: 'mm', format: [A4_WIDTH_MM, pageHeightMM], orientation });
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, imgHeightMM);
    return pdf;
  }

  // Innehållet är längre än en A4-sida (många fakturarader) — då är fast
  // 297mm-paginering rätt istället för fel: en riktig flersidig faktura
  // ska fortfarande skrivas ut på vanliga hela A4-ark, inte ett enda
  // orimligt högt anpassat pappersformat.
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let heightLeft = imgHeightMM;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, A4_WIDTH_MM, imgHeightMM);
  heightLeft -= A4_HEIGHT_MM;

  while (heightLeft > 0) {
    position = heightLeft - imgHeightMM;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, A4_WIDTH_MM, imgHeightMM);
    heightLeft -= A4_HEIGHT_MM;
  }

  return pdf;
}

/** Renderar och laddar ner PDF:en direkt i webbläsaren — den ursprungliga,
 * oförändrade beteendet för "Ladda ner PDF"-knappen. */
export async function exportInvoicePdf(node, filename = 'faktura.pdf') {
  const pdf = await renderInvoicePdf(node);
  pdf.save(filename);
}

/** Samma rendering, men returnerar PDF:en som en ren base64-sträng (utan
 * "data:application/pdf;base64,"-prefixet) för att kunna skickas som
 * bilaga till backendens /api/email/send-invoice. */
export async function getInvoicePdfBase64(node) {
  const pdf = await renderInvoicePdf(node);
  const dataUri = pdf.output('datauristring');
  return dataUri.split(',')[1];
}
