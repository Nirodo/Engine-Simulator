// Baut die Anwendung aus src/ zu einer einzigen, offline lauffähigen HTML-Datei:
//   dist/web/Engine-Simulator.html  (zum Öffnen im Browser)
//   desktop/app/index.html          (wird von der Desktop-App geladen)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(root, p), 'utf8');
const pkg = JSON.parse(rd('package.json'));

// 1) Skripte zusammensetzen
let app = rd('src/app.js');
const head = '(() => {\nconst S = SIM;';
if (!app.startsWith(head)) throw new Error('src/app.js: unerwarteter Anfang');
const audio = rd('src/engine_audio.js').replace("if (typeof module !== 'undefined') module.exports = { makeEngineSynth };", '');
app = head + '\n' + audio + app.slice(head.length);
const cut = app.lastIndexOf('})();');
app = app.slice(0, cut) + '\n' + rd('src/engine3d.js') + '\ne3Bind();\n})();\n';
let html = rd('src/ui.html')
  .replace('/*SIM*/', () => rd('src/sim.js').replace("if (typeof module !== 'undefined') module.exports = SIM;", ''))
  .replace('/*CORE*/', () => rd('src/core.js'))
  .replace('/*APP*/', () => app);

// 2) three.js einbetten statt CDN
const three = rd('vendor/three.min.js');
html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^"]+"[^>]*><\/script>/, () => `<script>/* three.js r149, MIT-Lizenz (vendor/three.LICENSE) */\n${three}</script>`);

// 3) Schriften einbetten statt Google Fonts (offline)
const fonts = [
  ['barlow-condensed', 'Barlow Condensed', [400, 500, 600, 700]],
  ['ibm-plex-sans', 'IBM Plex Sans', [400, 500, 600]],
  ['ibm-plex-mono', 'IBM Plex Mono', [400, 500]],
];
let css = '';
for (const [pkgName, family, weights] of fonts) for (const w of weights) {
  const f = join(root, 'node_modules', '@fontsource', pkgName, 'files', `${pkgName}-latin-${w}-normal.woff2`);
  if (!existsSync(f)) { console.warn(`Schrift fehlt (npm install ausführen): ${f}`); continue; }
  css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(f).toString('base64')}) format("woff2")}\n`;
}
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n?/, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, () => css ? `<style>${css}</style>\n` : '');

// 4) Vollständiges Dokument
const doc = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="${pkg.description}">
<meta name="generator" content="Engine-Simulator ${pkg.version}">
<style>[hidden]{display:none!important}body{margin:0}</style>
</head>
<body>
${html}
</body>
</html>
`;
for (const out of ['dist/web/Engine-Simulator.html', 'desktop/app/index.html']) {
  mkdirSync(join(root, dirname(out)), { recursive: true });
  writeFileSync(join(root, out), doc);
}
console.log(`Engine-Simulator ${pkg.version}: ${(doc.length / 1024).toFixed(0)} KB · ${css ? 'Schriften eingebettet' : 'ohne eingebettete Schriften'}`);
