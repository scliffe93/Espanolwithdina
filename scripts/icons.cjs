// Renders public/icon.svg to PNG app icons using Chromium + Playwright.
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const svg = readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, `../public/icon-${size}.png`), omitBackground: true });
  }
  await browser.close();
})();
