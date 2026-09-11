import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';

// Singleton worker för Tesseract OCR (svenska + engelska för internationella kvitton som Supabase)
let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const w = await createWorker(['swe', 'eng']);
        return w;
      } catch (err) {
        workerPromise = null;
        throw err;
      }
    })();
  }
  return workerPromise;
}

/**
 * Extraherar text ur en PDF med pdfjs-dist.
 */
async function extractPdfText(buffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      standardFontDataFactory: null,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText.trim();
  } catch (err) {
    console.warn('[OCR] PDF text extraction failed or empty:', err.message);
    return '';
  }
}

/**
 * POST /api/ocr
 * Body: { url: string }  — HTTPS-URL eller data-URL till bild/PDF
 * Returnerar: { text: string } eller { error: string }
 */
export default async function ocrHandler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await parseJsonBody(req);
  const { url } = body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });

  try {
    let buf;
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      buf = Buffer.from(base64Data, 'base64');
    } else {
      const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!resp.ok) throw new Error(`Hämtning misslyckades: HTTP ${resp.status}`);
      buf = Buffer.from(await resp.arrayBuffer());
    }

    // Kolla om filen är en PDF (antingen URL, MIME eller magic bytes %PDF)
    const isPdf = url.toLowerCase().includes('.pdf') ||
                  url.startsWith('data:application/pdf') ||
                  (buf.length > 4 && buf.subarray(0, 4).toString() === '%PDF');

    let text = '';
    if (isPdf) {
      // 1. Försök med direkt text-extrahering ur PDF (blixtsnabbt för digitala fakturor som Supabase)
      text = await extractPdfText(buf);
    }

    // 2. Om ingen text hittades eller det är en bild, kör Tesseract OCR på bildbuffern
    if (!text || text.length < 10) {
      if (!isPdf) {
        const worker = await getWorker();
        const { data } = await worker.recognize(buf);
        text = data.text || '';
      }
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error('[OCR] error:', err);
    res.status(500).json({ error: err.message || 'OCR misslyckades' });
  }
}
