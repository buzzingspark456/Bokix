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
async function renderInvoicePdf(node) {
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

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
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
