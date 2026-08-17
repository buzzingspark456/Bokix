import { describe, it, expect, vi } from 'vitest';
import { renderInvoicePdf } from './exportInvoicePdf.js';

// html2canvas needs a real DOM/canvas — mocked here so the actual
// page-size/orientation decision in renderInvoicePdf runs against a real
// jsPDF instance without a browser. jsPDF itself is pure JS and works fine
// in Node, so this exercises the real bug surface (see the "Bugkritiskt"
// comment in exportInvoicePdf.js): jsPDF silently swaps a [width, height]
// format array's values under 'portrait' orientation whenever height < width.
vi.mock('html2canvas', () => ({
  default: vi.fn(async (node) => ({
    width: node.__mockWidth,
    height: node.__mockHeight,
    toDataURL: () => 'data:image/jpeg;base64,AA==',
  })),
}));

function fakeNode(mockWidth, mockHeight) {
  return { style: {}, __mockWidth: mockWidth, __mockHeight: mockHeight };
}

describe('renderInvoicePdf — sidstorlek/orientering', () => {
  it('kort faktura (innehåll smalare än det är brett i mm) får en anpassad liggande sida, inte växlad bredd/höjd', async () => {
    // 1200x700px vid A4-bredd 210mm => imgHeightMM = 700*210/1200 = 122.5mm,
    // dvs kortare än 210mm bred — precis fallet som tidigare gav en tyst
    // växlad 122.5×210-sida istället för korrekt 210×122.5.
    const pdf = await renderInvoicePdf(fakeNode(1200, 700));
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(122.5, 1);
    expect(pdf.internal.getNumberOfPages()).toBe(1);
  });

  it('medellång faktura (höjd mellan bredd och 297mm) får en anpassad stående sida', async () => {
    // 1200x1400px => imgHeightMM = 1400*210/1200 = 245mm — mellan 210 och 297.
    const pdf = await renderInvoicePdf(fakeNode(1200, 1400));
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(245, 1);
    expect(pdf.internal.getNumberOfPages()).toBe(1);
  });

  it('faktura som exakt fyller en A4-sida får full 297mm höjd, inte klippt', async () => {
    // 1200x1697.14...px => imgHeightMM exakt 297mm.
    const pdf = await renderInvoicePdf(fakeNode(1200, 1200 * 297 / 210));
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    expect(pdf.internal.getNumberOfPages()).toBe(1);
  });

  it('lång faktura (fler rader än en sida rymmer) pagineras över flera fulla A4-sidor, inte en absurt hög anpassad sida', async () => {
    // 1200x3000px => imgHeightMM = 3000*210/1200 = 525mm — mer än en A4-sida (297mm).
    const pdf = await renderInvoicePdf(fakeNode(1200, 3000));
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    expect(pdf.internal.getNumberOfPages()).toBe(2);
  });

  it('mycket kort/nästan tom faktura får ett rimligt golv istället för en nästan nollhög sida', async () => {
    // 1200x50px => imgHeightMM ≈ 8.75mm, under MIN_PAGE_HEIGHT_MM (40mm).
    const pdf = await renderInvoicePdf(fakeNode(1200, 50));
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(40, 1);
  });
});
