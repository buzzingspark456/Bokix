import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt.js';

describe('parseReceiptText', () => {
  it('extraherar digital faktura från Supabase korrekt', () => {
    const text = `
      INVOICE
      Supabase Inc.
      Invoice Number: INV-2024-001
      Date: 2024-05-12
      Bill To: Mitt Bolag AB
      Description: Supabase Pro Plan
      Subtotal: $25.00
      Total: 193,75 SEK
      VAT: 0%
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-12');
    expect(result.amount).toBe(193.75);
    expect(result.vatRate).toBe(0);
    expect(result.supplier).toBe('Supabase');
    expect(result.accountCode).toBe('6540');
  });

  it('extraherar kvitto från ICA med 12% moms och konto 6071', () => {
    const text = `
      ICA Supermarket
      Org.nr: 556000-1234
      Datum: 2024-03-15
      Mjölk 18,50
      Bröd 32,90
      Kaffe 54,00
      Totalt SEK 105,40
      Varav moms 12%: 11,29
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-03-15');
    expect(result.amount).toBe(105.4);
    expect(result.vatRate).toBe(12);
    expect(result.supplier).toBe('ICA');
    expect(result.accountCode).toBe('6071');
  });

  it('extraherar bensin kvitto från Circle K med 25% moms och konto 5611', () => {
    const text = `
      CIRCLE K SVERIGE AB
      Station: Nacka
      2024-01-20 14:22
      Miles 95 Bensin
      Liter: 42,50  Pris/l: 21,19
      ATT BETALA SEK 900,58
      Moms 25%: 180,12
      KORT VISA **** 1234
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-01-20');
    expect(result.amount).toBe(900.58);
    expect(result.vatRate).toBe(25);
    expect(result.supplier).toBe('Circle K');
    expect(result.accountCode).toBe('5611');
  });

  it('extraherar SL-biljett med 6% moms och konto 5810', () => {
    const text = `
      SL Enkelbiljett
      Datum: 12/04/2024
      Pris: 42,00 kr
      Moms 6%: 2,38
      Totalt 42,00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-04-12');
    expect(result.amount).toBe(42);
    expect(result.vatRate).toBe(6);
    expect(result.supplier).toBe('SL');
    expect(result.accountCode).toBe('5810');
  });

  it('hanterar tom eller ogiltig text utan att krascha', () => {
    const res1 = parseReceiptText('');
    expect(res1.date).toBeNull();
    expect(res1.amount).toBeNull();

    const res2 = parseReceiptText(null);
    expect(res2.date).toBeNull();
    expect(res2.amount).toBeNull();
  });

  // ── Engelskspråkiga kvitton ─────────────────────────────────────────────
  // Utländska leverantörer och kvitton på engelska ska tolkas lika bra som
  // svenska — Tesseract-workern läser båda språken i samma pass (se
  // createWorker(['swe', 'eng'], ...) i ocrFile), och den här funktionen
  // måste kunna hitta fälten oavsett vilket språk siffrorna omgärdas av.
  it('extraherar ett helt engelskspråkigt kvitto (textdatum, engelska nyckelord)', () => {
    const text = `
      GITHUB, INC.
      Receipt
      Date: May 12, 2024
      Description: GitHub Team plan
      Subtotal: 799.00
      Total Amount: 799.00 SEK
      VAT: 0%
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-12');
    expect(result.amount).toBe(799);
    expect(result.vatRate).toBe(0);
    expect(result.supplier).toBe('GitHub');
    expect(result.accountCode).toBe('6540');
  });

  it('extraherar ett engelskt kvitto med DD/MM/YYYY-datum och "Amount Due"', () => {
    const text = `
      DHL Express
      Invoice Date: 03/11/2024
      Shipment from Stockholm to Malmö
      Amount Due: 245.00
      Tax 25%: 49.00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-11-03');
    expect(result.amount).toBe(245);
    expect(result.vatRate).toBe(25);
    expect(result.supplier).toBe('DHL');
    expect(result.accountCode).toBe('6230');
  });

  it('känner fortfarande igen operatören "3" som fristående ord (men inte som en del av ett annat tal)', () => {
    const text = `
      3 Sverige AB
      Mobilabonnemang
      2024-02-10
      Totalt 399,00
    `;
    const result = parseReceiptText(text);
    expect(result.accountCode).toBe('6212');
  });

  // ── Valuta ──────────────────────────────────────────────────────────────
  // Bokix bokför bara i SEK — ett belopp i en annan valuta får aldrig
  // tolkas som kronor. Se kommentaren vid "## Valuta" i ocrReceipt.js.
  it('flaggar ett kvitto i dollar istället för att gissa att beloppet är kronor', () => {
    const text = `
      Some US Shop
      Date: 2024-06-01
      Total: $45.00
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(45);
    expect(result.currency).toBe('USD');
  });

  it('flaggar pund och euro likadant', () => {
    const gbp = parseReceiptText('Amount Due: £120.00\n2024-06-02');
    expect(gbp.currency).toBe('GBP');

    const eur = parseReceiptText('Total: €89.90\n2024-06-03');
    expect(eur.currency).toBe('EUR');
  });

  it('flaggar INTE när totalraden uttryckligen säger SEK, även om en dollarsumma nämns tidigare på kvittot', () => {
    // Vanligt mönster på utländska SaaS-fakturor (Vercel, GitHub …): en
    // delsumma i originalvalutan ovanför en redan SEK-omräknad total.
    const text = `
      Vercel Inc.
      Subtotal: $20.00
      Total: 215,60 SEK
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(215.6);
    expect(result.currency).toBeNull();
  });

  // ── Amerikanska datum (MM/DD) vs svenska (DD/MM) ───────────────────────────
  // Bugkritiskt: fel dag/månad-ordning ger fel datum, som ger fel valutakurs
  // (convertToSek slår upp kursen för DEN dagen) — helt utan att synas som
  // ett fel, eftersom det fortfarande blir ett giltigt datum. Se
  // resolveDayMonth i ocrReceipt.js.
  it('tolkar ett omöjligt DD/MM-datum ("15:e i månad 02") som amerikanskt MM/DD istället för att ge ett ogiltigt datum', () => {
    // 02/15/2022 kan bara vara den amerikanska konventionen (15 februari)
    // — ingen månad heter 15. Innan fixen blev det här "2022-15-02".
    const text = `
      Some US Shop Inc.
      Invoice Date: 02/15/2022
      Total: $48.99
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2022-02-15');
    expect(result.currency).toBe('USD');
  });

  it('tolkar ett äkta tvetydigt datum (båda talen ≤ 12) som MM/DD när kvittot är i dollar', () => {
    // 03/05/2022 är tvetydigt i sig — men dollartecknet avslöjar att det
    // är amerikanskt (5 mars), inte svenskt (3 maj).
    const text = `
      US Shop
      Date: 03/05/2022
      Total: $20.00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2022-03-05');
  });

  it('behåller svensk DD/MM-tolkning för ett tvetydigt datum utan dollartecken', () => {
    const text = `
      Svenska Butiken AB
      Datum: 03/05/2024
      Totalt: 200,00 kr
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-03');
  });

  // ── Fler valutor (USD, GBP, NOK, DKK, EUR, JPY, CNY — de vanligaste) ────────
  it('läser av ett japanskt kvitto — yen skrivs praktiskt taget aldrig med decimaler', () => {
    // "¥5,000" är femtusen yen, INTE 5,00 — kommatecknet är en
    // tusentalsgruppering, inte ett decimaltecken. Se parseMoneyToken.
    const text = `
      Tokyo Camera Store
      Date: 2024-03-10
      Total: ¥5,000
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('JPY');
  });

  it('läser av ett japanskt kvitto utan tusentalsgruppering också ("¥3500")', () => {
    const result = parseReceiptText('Sony Store Tokyo\nTotal ¥3500\n2024-03-11');
    expect(result.amount).toBe(3500);
    expect(result.currency).toBe('JPY');
  });

  it('läser av ett kinesiskt kvitto (CNY/RMB och tecknet 元)', () => {
    const byCode = parseReceiptText('Shanghai Trading Co\nTotal: CNY 580.00\n2024-03-12');
    expect(byCode.amount).toBe(580);
    expect(byCode.currency).toBe('CNY');

    const byYuanSign = parseReceiptText('Total 元1200\n2024-03-13');
    expect(byYuanSign.currency).toBe('CNY');
  });

  it('läser av norska och danska kronor via valutakoden (skiljer dem från svenska kr)', () => {
    const nok = parseReceiptText('Oslo Sport AS\nTotal: NOK 450,00\n2024-03-14');
    expect(nok.amount).toBe(450);
    expect(nok.currency).toBe('NOK');

    const dkk = parseReceiptText('København Butik\nTotal: DKK 320,00\n2024-03-15');
    expect(dkk.amount).toBe(320);
    expect(dkk.currency).toBe('DKK');
  });

  it('förväxlar inte ett kvittonummer med ett heltalsbelopp utan decimaler (yen-liknande)', () => {
    // Samma bugg som "Ref 88213" tidigare, fast med ett belopp UTAN
    // decimaler också inblandat — kvittonumret (större tal) ska inte
    // vinna över det faktiska totalbeloppet.
    const text = `
      Osaka Diner
      Kvitto nr 900123
      2024-03-16
      Total ¥1500
    `;
    const result = parseReceiptText(text);
    expect(result.amount).toBe(1500);
  });

  it('kraschar inte och ger ändå ett belopp för en okänd, blandad kvittotext', () => {
    const text = `
      Some Random Shop AB
      Ref 88213
      2024-07-01
      Item A          49,00
      Item B          120,00
      Card payment approved
      169,00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-07-01');
    expect(result.amount).toBe(169);
    // Ingen känd leverantör eller kontoregel matchar — ska ge null,
    // aldrig ett hittepåkonto som ser ut som ett facit.
    expect(result.accountCode).toBeNull();
  });
});
