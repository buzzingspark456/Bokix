import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renderar given DOM-nod (InvoiceDocument, i praktiken — exakt samma nod
 * användaren ser i den levande förhandsgranskningen) till ett jsPDF-objekt.
 * Delad av `exportInvoicePdf` (ladda ner) och `getInvoicePdfBase64` (bifoga
 * i mejl) så PDF:en aldrig kan avvika mellan de två — bara vad som görs med
 * resultatet skiljer.
 */
// Två tidigare försök (scale+JPEG-kvalitet neråt) löste storleken genom att
// offra skärpa på TEXTEN, fel avvägning för ett textdokument.
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
// Arket är alltid ett helt A4 (.a4-paper), en längre faktura delas på flera ark.
//
// Texten är en bild i PDF:en, så upplösningen avgör skärpan på skärm och papper.
// 2480 px över arkets bredd är 300 dpi på A4.
const PRINT_WIDTH_PX = 2480;
// Telefoner ritar inte större bilder än så. En mycket lång faktura får hellre
// lägre upplösning än en tom sida.
const MAX_CANVAS_PIXELS = 16000000;
const MAX_CANVAS_SIDE = 16000;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
// Golv för en degenererad nästan-tom nod (aldrig ett realistiskt fall,
// men jsPDF godtar inte en absurt liten/nollstor sida).
const MIN_PAGE_HEIGHT_MM = 40;

// Räknas på nodens uppmätta storlek: appens zoom (--app-zoom) krymper den, och
// en fast skala gav därför bara 1072 px bred bild på en vanlig datorskärm.
export function captureScale(width, height) {
  if (!width || !height) return 2;
  return Math.min(PRINT_WIDTH_PX / width, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)), MAX_CANVAS_SIDE / height);
}

// Exporterad (inte bara privat) så sidstorleks-/orienteringslogiken ovan
// går att testa direkt mot jsPDF:s riktiga pageSize (se exportInvoicePdf.test.js)
// utan en webbläsare — html2canvas är det enda som behöver en riktig DOM,
// och mockas bort i testet.
export async function renderInvoicePdf(node) {
  if (!node) throw new Error('Inget fakturaunderlag att exportera.');

  // Skuggan hör till förhandsvisningen. html2canvas ritar den över hela arket,
  // så PDF:en blev grå i stället för vit.
  const originalShadow = node.style.boxShadow;
  node.style.boxShadow = 'none';

  const rect = node.getBoundingClientRect?.();
  let canvas;
  try {
    canvas = await html2canvas(node, { scale: captureScale(rect?.width, rect?.height), useCORS: true, backgroundColor: '#ffffff' });
  } finally {
    node.style.boxShadow = originalShadow;
  }
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const rawHeightMM = (canvas.height * A4_WIDTH_MM) / canvas.width;
  // Avrundning av pixlar får inte ge ett andra ark med en tom rand.
  const imgHeightMM = rawHeightMM > A4_HEIGHT_MM && rawHeightMM <= A4_HEIGHT_MM + 1 ? A4_HEIGHT_MM : rawHeightMM;

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
  if (await sharePdf(pdf, filename)) return;
  pdf.save(filename);
}

// Telefon: telefonens egen delningsmeny (Mail, Meddelanden, WhatsApp, Spara
// i Filer …) i stället för en nedladdning som hamnar i en mapp man aldrig
// hittar. Webbläsaren kan neka om renderingen tog för lång tid efter
// trycket (NotAllowedError); då laddas filen ner som förut. Avbryter man
// själv delningen (AbortError) händer ingenting.
export async function sharePdf(pdf, filename) {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
  const file = new File([pdf.output('blob')], filename, { type: 'application/pdf' });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, '') });
    return true;
  } catch (err) {
    return err?.name === 'AbortError';
  }
}

/** Skriver ut samma PDF som laddas ner, så att pappret ser ut som det kunden
 * får. Skrivarrutan öppnas från en dold ram som tas bort efter en stund. */
export async function printInvoicePdf(node) {
  const pdf = await renderInvoicePdf(node);
  const url = URL.createObjectURL(pdf.output('blob'));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      // Vissa webbläsare släpper inte in utskrift av PDF i en ram: visa den i en
      // egen flik där skrivarknappen finns.
      window.open(url, '_blank');
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  };
  document.body.appendChild(frame);
}

/** Samma rendering, men returnerar PDF:en som en ren base64-sträng (utan
 * "data:application/pdf;base64,"-prefixet) för att kunna skickas som
 * bilaga till backendens /api/email/send-invoice. */
export async function getInvoicePdfBase64(node) {
  const pdf = await renderInvoicePdf(node);
  const dataUri = pdf.output('datauristring');
  return dataUri.split(',')[1];
}
