import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const SVG = join(__dirname, 'icon-source.svg');

const svgBuffer = await readFile(SVG);

const targets = [
  { name: 'favicon-16.png',        size: 16,  fit: 'cover' },
  { name: 'favicon-32.png',        size: 32,  fit: 'cover' },
  { name: 'favicon-48.png',        size: 48,  fit: 'cover' },
  { name: 'apple-touch-icon.png',  size: 180, fit: 'cover' },
  { name: 'icon-192.png',          size: 192, fit: 'cover' },
  { name: 'icon-512.png',          size: 512, fit: 'cover' },
  { name: 'icon-maskable-512.png', size: 512, fit: 'cover' },
];

await mkdir(PUBLIC, { recursive: true });

const pngBuffers = {};
for (const t of targets) {
  const out = join(PUBLIC, t.name);
  const buf = await sharp(svgBuffer, { density: 384 })
    .resize(t.size, t.size, { fit: t.fit })
    .png({ compressionLevel: 9, palette: t.size <= 32 })
    .toBuffer();
  await writeFile(out, buf);
  pngBuffers[t.name] = buf;
  console.log(`✓ ${t.name.padEnd(24)} ${t.size}x${t.size} (${buf.length} bytes)`);
}

// Flatten PNGs against white before ICO conversion — `to-ico` quantizes
// to 8bpp internally and produces wrong colors when source PNGs contain
// semi-transparent pixels (renders lemon-yellow instead of red).
const icoInputs = await Promise.all(
  ['favicon-16.png', 'favicon-32.png', 'favicon-48.png'].map(async (name) => {
    return sharp(pngBuffers[name])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  })
);
const icoBuffer = await toIco(icoInputs);
await writeFile(join(PUBLIC, 'favicon.ico'), icoBuffer);
console.log(`✓ favicon.ico               multi-size 16+32+48 (${icoBuffer.length} bytes)`);

console.log('\nDone.');
