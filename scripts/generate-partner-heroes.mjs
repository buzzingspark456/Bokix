import { chromium } from '@playwright/test';
import fs from 'node:fs';

const PATH_D = "M8.39 37L2.92 37L2.92 35.25Q3.79 34.75 4.78 34.38Q5.77 34.01 6.69 33.92L6.69 7.88Q5.77 7.70 4.76 7.35Q3.75 7.01 2.92 6.55L2.92 4.80L10.33 4.80Q12.07 4.80 13.64 4.66Q15.20 4.52 17.23 4.52Q19.43 4.52 21.50 4.85Q23.57 5.17 25.18 6Q26.79 6.82 27.76 8.32Q28.73 9.81 28.73 12.16Q28.73 13.63 28.20 14.90Q27.67 16.16 26.72 17.13Q25.78 18.09 24.52 18.74Q23.25 19.38 21.78 19.66L21.78 19.84Q23.25 20.03 24.75 20.53Q26.24 21.04 27.44 22Q28.63 22.97 29.39 24.42Q30.15 25.87 30.15 27.85Q30.15 30.33 29.05 32.12Q27.94 33.92 26.08 35.07Q24.22 36.22 21.83 36.75Q19.43 37.28 16.86 37.28Q15.89 37.28 14.74 37.23Q13.59 37.18 12.44 37.14Q11.29 37.09 10.21 37.05Q9.13 37 8.39 37M16.81 34.29Q19.71 34.29 21.37 32.56Q23.02 30.84 23.02 27.98Q23.02 26.24 22.47 25.11Q21.92 23.98 20.95 23.31Q19.99 22.65 18.65 22.39Q17.32 22.14 15.75 22.14L13.32 22.14L13.32 33.96Q13.96 34.10 14.67 34.19Q15.39 34.29 16.81 34.29M13.32 19.15L14.79 19.15Q15.57 19.15 16.35 19.08Q17.13 19.01 17.82 18.92Q19.62 18.19 20.72 16.64Q21.83 15.10 21.83 13.13Q21.83 10.23 20.31 8.87Q18.79 7.51 16.40 7.51Q15.39 7.51 14.65 7.56Q13.91 7.61 13.32 7.70L13.32 19.15M32.08 25.50Q32.08 22.69 32.93 20.46Q33.78 18.23 35.37 16.67Q36.96 15.10 39.21 14.28Q41.46 13.45 44.32 13.45Q47.54 13.45 49.86 14.34Q52.18 15.24 53.68 16.83Q55.17 18.42 55.86 20.65Q56.55 22.88 56.55 25.50Q56.55 28.31 55.72 30.54Q54.90 32.77 53.31 34.33Q51.72 35.90 49.45 36.72Q47.17 37.55 44.32 37.55Q41.19 37.55 38.89 36.66Q36.59 35.76 35.07 34.17Q33.55 32.58 32.82 30.35Q32.08 28.12 32.08 25.50M39.21 25.50Q39.21 27.57 39.46 29.30Q39.72 31.02 40.36 32.22Q41 33.41 42.11 34.08Q43.21 34.75 44.96 34.75Q45.97 34.75 46.80 34.26Q47.63 33.78 48.23 32.70Q48.82 31.62 49.12 29.85Q49.42 28.08 49.42 25.50Q49.42 23.38 49.17 21.68Q48.92 19.98 48.30 18.78Q47.67 17.59 46.62 16.92Q45.56 16.25 43.95 16.25Q42.75 16.25 41.88 16.74Q41 17.22 40.41 18.30Q39.81 19.38 39.51 21.15Q39.21 22.92 39.21 25.50M71.59 15.79L71.59 14L82.35 14L82.35 15.79Q81.48 16.16 80.72 16.44Q79.96 16.71 79.04 16.90Q78.35 17.82 77.55 18.71Q76.74 19.61 75.94 20.44Q75.13 21.27 74.40 22.03Q73.66 22.79 73.06 23.38Q73.75 24.30 74.67 25.59Q75.59 26.88 76.65 28.33Q77.71 29.78 78.88 31.27Q80.05 32.77 81.25 34.10L83.60 35.21L83.60 37L75.82 37L74.58 35.90Q73.52 34.47 72.72 33.23Q71.91 31.99 71.27 30.84Q70.62 29.69 70.03 28.61Q69.43 27.52 68.83 26.47L67.31 26.01L67.31 34.10Q68.09 34.24 68.74 34.52Q69.38 34.79 70.12 35.21L70.12 37L57.65 37L57.65 35.21Q59.17 34.47 60.69 34.10L60.69 6.23L57.19 5.86L57.19 4.06Q57.84 3.79 58.94 3.51Q60.04 3.24 61.29 3.03Q62.53 2.82 63.72 2.66Q64.92 2.50 65.75 2.41L67.31 2.41L67.31 23.98L68.51 23.98Q70.03 22.37 71.34 20.44Q72.65 18.51 73.66 16.90Q73.06 16.71 72.58 16.44Q72.10 16.16 71.59 15.79M96.52 35.21L96.52 37L83.82 37L83.82 35.21Q84.51 34.84 85.25 34.59Q85.98 34.33 86.86 34.10L86.86 17.27L83.82 16.90L83.82 15.10Q84.51 14.83 85.55 14.55Q86.58 14.28 87.73 14.07Q88.88 13.86 89.99 13.70Q91.09 13.54 91.92 13.45L93.48 13.45L93.48 34.10Q94.40 34.33 95.14 34.59Q95.87 34.84 96.52 35.21M86.08 6.46Q86.08 4.85 87.18 3.93Q88.28 3.01 90.03 3.01Q91.78 3.01 92.88 3.93Q93.99 4.85 93.99 6.46Q93.99 8.02 92.88 8.94Q91.78 9.86 90.03 9.86Q88.28 9.86 87.18 8.94Q86.08 8.02 86.08 6.46M118.55 16.90L112.25 24.67L119.51 34.10Q120.71 34.47 121.77 35.21L121.77 37L110.04 37L110.04 35.25Q110.54 34.88 111.07 34.59Q111.60 34.29 112.15 34.10L107.78 27.85L103.55 34.10Q104.20 34.33 104.68 34.61Q105.16 34.88 105.62 35.21L105.62 37L96.93 37L96.93 35.21Q97.57 34.84 98.10 34.56Q98.63 34.29 99.32 34.10L106.13 25.64L99.27 16.90Q98.63 16.67 98.12 16.41Q97.62 16.16 97.20 15.79L97.20 14L108.75 14L108.75 15.75Q108.20 16.12 107.76 16.41Q107.32 16.71 106.68 16.90L110.68 22.60L114.50 16.90Q113.72 16.67 113.26 16.39Q112.80 16.12 112.43 15.79L112.43 14L120.94 14L120.94 15.79Q120.48 16.12 119.93 16.39Q119.38 16.67 118.55 16.90";

const stripeBase64 = fs.readFileSync('public/stripe-wordmark.png').toString('base64');
const zettleBase64 = fs.readFileSync('public/zettle-official-cropped.png').toString('base64');

function makeHtml(partnerType) {
  const isStripe = partnerType === 'stripe';

  const bgColor = '#0d2d2a'; // same solid teal for both
  const accentColor = isStripe ? '#635bff' : '#0070E0';

  const tagline = isStripe
    ? 'Kortbetalningar direkt på fakturan'
    : 'Automatisk butiksbokföring';

  // ── Partner logo markup (identical structure and card for both) ──
  const partnerLogoHtml = isStripe
    ? `<div class="partner-card">
        <img class="partner-logo stripe-logo" src="data:image/png;base64,${stripeBase64}" alt="Stripe" />
      </div>`
    : `<div class="partner-card">
        <img class="partner-logo zettle-logo" src="data:image/png;base64,${zettleBase64}" alt="Zettle by PayPal" />
      </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 1200px;
      height: 630px;
      background: ${bgColor};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* ── Logos row ── */
    .logos {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 64px;
    }

    /* Bokix SVG — sized to match partner cards visually */
    .bokix-logo {
      height: 148px;
      width: auto;
      display: block;
    }

    /* × separator */
    .cross {
      font-size: 62px;
      font-weight: 200;
      color: rgba(255,255,255,0.38);
      line-height: 1;
      user-select: none;
      flex-shrink: 0;
    }

    /* ── Partner card (identical for Stripe & Zettle) ── */
    .partner-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 30px 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    }

    /* ── Partner logos ── */
    .partner-logo {
      height: 115px;
      width: auto;
      object-fit: contain;
      display: block;
    }

    /* ── Tagline (same font & text style across both) ── */
    .tagline {
      margin-top: 44px;
      font-size: 38px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.025em;
      position: relative;
      z-index: 1;
      text-shadow: 0 2px 20px rgba(0,0,0,0.35);
    }

    /* ── Accent bar ── */
    .accent-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16, ${accentColor});
    }
  </style>
</head>
<body>
  <div class="logos">
    <svg class="bokix-logo" viewBox="0 0 125 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bokixGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0ea5e9" />
          <stop offset="50%" stop-color="#14b8a6" />
          <stop offset="100%" stop-color="#84cc16" />
        </linearGradient>
      </defs>
      <path d="${PATH_D}" fill="url(#bokixGrad)" />
    </svg>

    <span class="cross">&times;</span>

    ${partnerLogoHtml}
  </div>

  <p class="tagline">${tagline}</p>
  <div class="accent-bar"></div>
</body>
</html>`;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

  await page.setContent(makeHtml('stripe'), { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'public/blog/nyhet-stripe.jpg', type: 'jpeg', quality: 96 });
  console.log('✓ nyhet-stripe.jpg');

  await page.setContent(makeHtml('zettle'), { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'public/blog/nyhet-zettle.jpg', type: 'jpeg', quality: 96 });
  console.log('✓ nyhet-zettle.jpg');

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
