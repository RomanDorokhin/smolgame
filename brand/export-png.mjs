import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'smolgame-wordmark-transparent.svg');
const outPath = join(__dirname, 'smolgame-wordmark.png');

const svg = readFileSync(svgPath, 'utf8');
/* Ширина 2400px — запас для обложек и печати */
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 2400 },
  background: 'transparent',
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
writeFileSync(outPath, pngBuffer);
console.log('Wrote', outPath, '(' + pngBuffer.length + ' bytes)');
