// Bundles the guide (the drawings, the rig and the choreography) into one script to inject into the page.
const path = require('path'); const esbuild = require('esbuild');
module.exports = function buildGuide() {
  const r = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'guide.ts')], bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', minify: true, write: false, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  return r.outputFiles[0].text;
};
if (require.main === module) console.log('guide bundle', (module.exports().length / 1024).toFixed(0), 'kB');
