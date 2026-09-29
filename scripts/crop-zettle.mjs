import { chromium } from '@playwright/test';
import fs from 'node:fs';

async function crop() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = fs.readFileSync('public/zettle-official.png').toString('base64');
  await page.setContent(`
    <img id="img" src="data:image/png;base64,${b64}" />
    <canvas id="cv"></canvas>
  `);

  const result = await page.evaluate(() => {
    const img = document.getElementById('img');
    const cv = document.getElementById('cv');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
    const data = imgData.data;

    let minX = cv.width, minY = cv.height, maxX = 0, maxY = 0;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const idx = (y * cv.width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        // non-white and non-transparent
        if (a > 20 && !(r > 245 && g > 245 && b > 245)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Now create a cropped canvas
    const cropW = (maxX - minX + 1);
    const cropH = (maxY - minY + 1);

    const cropCv = document.createElement('canvas');
    cropCv.width = cropW;
    cropCv.height = cropH;
    const cropCtx = cropCv.getContext('2d');
    // make transparent: if original background was white, we can make white transparent or keep it transparent
    cropCtx.drawImage(cv, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    return {
      minX, minY, maxX, maxY, cropW, cropH,
      dataUrl: cropCv.toDataURL('image/png')
    };
  });

  console.log('Result:', { cropW: result.cropW, cropH: result.cropH, minX: result.minX, minY: result.minY });
  const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('public/zettle-official-cropped.png', Buffer.from(base64Data, 'base64'));
  console.log('Saved public/zettle-official-cropped.png');

  await browser.close();
}

crop().catch(console.error);
