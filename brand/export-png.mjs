import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function exportPng(svgName, pngName, width = 2400) {
  const svgPath = join(__dirname, svgName);
  const outPath = join(__dirname, pngName);
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  });
  const pngBuffer = resvg.render().asPng();
  writeFileSync(outPath, pngBuffer);
  console.log('Wrote', pngName, '(' + pngBuffer.length + ' bytes)');
}

exportPng('smolgame-wordmark-transparent.svg', 'smolgame-wordmark.png', 2400);
/* Тот же макет что на splash: тёмная подложка — для печати/баннеров */
exportPng('smolgame-wordmark.svg', 'smolgame-wordmark-dark.png', 2400);
