// Bundles src/ into two single-file pages:
//   index.html          — standalone, opens in any browser (also what GitHub Pages serves)
//   dist/artifact.html  — the same page without the document skeleton, for publishing as a Claude artifact
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const css = read('styles.css');
const body = read('body.html');
const js = ['engine.js', 'conditions.js', 'render.js', 'viz.js', 'app.js'].map(read).join('\n');

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Instrument+Sans:wght@400;500;600;700&family=Schibsted+Grotesk:wght@600;700;800&display=swap">';
const head = `<title>Cardinal Gaze</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}</style>`;
const script = `<script>\n${js}</script>`;

const fragment = `${head}\n${body}\n${script}\n`;
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Practise examining eye movement disorders on a simulated patient.">
<style>:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}img{max-width:100%}</style>
${head}
</head>
<body>
${body}
${script}
</body>
</html>
`;

fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/artifact.html', import.meta.url), fragment);
fs.writeFileSync(new URL('./index.html', import.meta.url), standalone);
console.log(`built index.html (${(standalone.length / 1024).toFixed(0)} kB) and dist/artifact.html`);
