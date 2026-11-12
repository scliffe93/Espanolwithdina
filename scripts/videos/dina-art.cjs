// Renders the app's own Dina and Toby artwork to static SVG strings for the video guide overlay.
const path = require('path'); const fs = require('fs'); const esbuild = require('esbuild');
const tmp = path.join(__dirname, 'raw', '.dina-bundle.cjs'); fs.mkdirSync(path.dirname(tmp), { recursive: true });
esbuild.buildSync({
  stdin: { contents: `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { DinaArt } from ${JSON.stringify(path.resolve(__dirname, '../../src/components/Dina.tsx'))};
    const mk = (p) => renderToStaticMarkup(React.createElement(DinaArt, { animate: false, size: 200, ...p }));
    export const art = { smile: mk({ expression: 'smile' }), talk: mk({ expression: 'smile', speaking: true }), wave: mk({ expression: 'beam', waving: true }), beam: mk({ expression: 'beam' }) };`, resolveDir: path.resolve(__dirname, '../..'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', outfile: tmp, jsx: 'automatic', logLevel: 'error',
});
module.exports = require(tmp).art;
if (require.main === module) for (const [k, v] of Object.entries(module.exports)) console.log(k, v.length, (v.match(/id="/g) || []).length, 'ids', v.slice(0, 120));
