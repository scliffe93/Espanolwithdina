// Bundles the guide (React, the app's DinaArt and the drawings in guide.tsx) into one script to inject into the page.
const path = require('path'); const esbuild = require('esbuild');
module.exports = function buildGuide() {
  const r = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'guide.tsx')], bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', minify: true, write: false, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  return r.outputFiles[0].text;
};
if (require.main === module) console.log('guide bundle', (module.exports().length / 1024).toFixed(0), 'kB');
