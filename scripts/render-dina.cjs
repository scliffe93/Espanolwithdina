// Renders a Dina component file to PNG sheets for visual review.
// Usage: node scripts/render-dina.cjs <componentFile.tsx> <outDir>
// Outputs: sheet.png (all states, large), sizes.png (real app sizes), card.png (peeking behind the logo card).
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const comp = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3] || 'dina-render');
fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(outDir, '.render-bundle.cjs');

esbuild.buildSync({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import * as M from ${JSON.stringify(comp)};
      export function render(size) {
        const v = [['smile', { expression: 'smile' }], ['beam', { expression: 'beam' }], ['speaking', { expression: 'smile', speaking: true }], ['waving', { expression: 'beam', waving: true }]];
        return {
          variants: v.map(([n, p]) => [n, renderToStaticMarkup(React.createElement(M.DinaArt, { ...p, animate: false, size }))]),
          small: [200, 100, 48].map((s) => [s, renderToStaticMarkup(React.createElement(M.DinaArt, { expression: 'smile', animate: false, size: s }))]),
          cardLine: typeof M.DINA_CARD_LINE === 'number' ? M.DINA_CARD_LINE : 0.77,
          aspect: M.DINA_VIEWBOX ? M.DINA_VIEWBOX.h / M.DINA_VIEWBOX.w : 170 / 160,
        };
      }`,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  outfile: tmp,
  logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"production"' },
});
delete require.cache[tmp];
const { render } = require(tmp);
const big = render(340);
const mid = render(150);

const page = (body, bg = '#FBF6EE') => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:${bg};font-family:system-ui,sans-serif;color:#1E1B18}
  .row{display:flex;gap:24px;align-items:flex-end;padding:20px;flex-wrap:wrap}
  figure{margin:0;text-align:center} figcaption{font-size:13px;color:#71675E;margin-top:6px}
  .card{position:relative;width:240px;padding-top:var(--top)} .card .art{position:absolute;top:0;right:8px}
  .card .box{position:relative;z-index:1;background:#FBF6EE;border-radius:24px;padding:16px;box-shadow:0 10px 24px -14px #963F2666;border:1px solid #C9A24B55;height:96px}
  .card .box b{font:600 34px Georgia,serif;color:#C2593A} .card .box i{display:block;color:#5E7149;font-size:14px}
</style></head><body>${body}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1600, height: 700 }, deviceScaleFactor: 1 });
  // 1. All states, large
  await p.setContent(page(`<div class="row">${big.variants.map(([n, svg]) => `<figure>${svg}<figcaption>${n}</figcaption></figure>`).join('')}</div>`));
  await p.screenshot({ path: path.join(outDir, 'sheet.png'), fullPage: true });
  // 2. Real sizes on light and dark backgrounds
  const sizes = big.small.map(([s, svg]) => `<figure>${svg}<figcaption>${s}px</figcaption></figure>`).join('');
  await p.setViewportSize({ width: 900, height: 420 });
  await p.setContent(page(`<div class="row">${sizes}</div><div class="row" style="background:#1F3A5F">${sizes}</div>`));
  await p.screenshot({ path: path.join(outDir, 'sizes.png'), fullPage: true });
  // 3. Peeking behind the logo card, as in the app sidebar (size 100) and mobile header (size 48)
  const art100 = render(100).small[1][1];
  const cardTop = Math.round(100 * big.aspect * big.cardLine);
  await p.setContent(page(`<div class="row" style="gap:48px">
    <div class="card" style="--top:${cardTop}px"><div class="art">${art100}</div><div class="box"><i>Learning with</i><b>Dina.</b></div></div>
    <div style="display:flex;align-items:flex-end;gap:4px;background:#FFF;padding:8px 12px;border-radius:12px"><span style="font:600 24px Georgia;color:#C2593A">Dina.</span><span style="display:block;height:52px;overflow:hidden">${big.small[2][1]}</span></div>
  </div>`));
  await p.screenshot({ path: path.join(outDir, 'card.png'), fullPage: true });
  await browser.close();
  fs.rmSync(tmp, { force: true });
  console.log(JSON.stringify({ outDir, files: ['sheet.png', 'sizes.png', 'card.png'], cardLine: big.cardLine, aspect: big.aspect }));
})().catch((e) => { console.error(e); process.exit(1); });
