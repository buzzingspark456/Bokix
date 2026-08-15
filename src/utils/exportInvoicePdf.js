import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renderar given DOM-nod (InvoiceDocument, i praktiken — exakt samma nod
 * användaren ser i den levande förhandsgranskningen) till ett jsPDF-objekt.
 * Delad av `exportInvoicePdf` (ladda ner) och `getInvoicePdfBase64` (bifoga
 * i mejl) så PDF:en aldrig kan avvika mellan de två — bara vad som görs med
 * resultatet skiljer.
 */
// scale:1 + JPEG @ 0.7 — sänkt igen efter att fångst-noden fixades till en
// GARANTERAT korrekt 794px-bredd (se captureRef i Invoices.jsx/Quotes.jsx):
// den fixen gjorde själva källbilden mycket större än tidigare (den fångade
// innan av misstag en hopskalad/smalare nod i vissa lägen), så samma
// scale:1.5 som förut gav nu en betydligt större fil än väntat — 413:an
// kom tillbaka. 794px bredd är redan ~96dpi vid en riktig 210mm-sida, så
// scale:1 behöver ingen extra uppskalning för att vara skarp/läsbar. JPEG
// @ 0.7 är fortfarande gott och väl läsbart för text/linjer (ingen bild-
// tung faktura), med bred marginal ner mot Vercels HÅRDA 4.5MB-gräns per
// request-kropp — den går inte att höja med kod, måste undvikas genom att
// filen faktiskt blir mindre.
async function renderInvoicePdf(node) {
  if (!node) throw new Error('Inget fakturaunderlag att exportera.');

  const canvas = await html2canvas(node, { scale: 1, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/jpeg', 0.7);

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
