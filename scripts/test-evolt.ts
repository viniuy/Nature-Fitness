/**
 * Runs the Evolt import pipeline on a screenshot in Node, for checking the
 * layout finder and parser against real scans. The screenshot is personal
 * data, so keep it out of the repo and pass its path:
 *
 *   npx tsx scripts/test-evolt.ts ~/Downloads/evolt-scan.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { createWorker, PSM } from 'tesseract.js';
import { locateFields, type Box } from '../src/lib/evolt/layout';
import { parseReading, parseDials, parseScanDate } from '../src/lib/evolt/parse';

function crop(img: PNG, b: Box, invert = false, pad = 4, scale = 3, threshold = 0): Buffer {
  const x0 = Math.max(0, b.x0 + pad), y0 = Math.max(0, b.y0 + pad);
  const x1 = Math.min(img.width - 1, b.x1 - pad), y1 = Math.min(img.height - 1, b.y1 - pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new PNG({ width: w * scale, height: h * scale });
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const s = ((y0 + Math.floor(y / scale)) * img.width + x0 + Math.floor(x / scale)) * 4;
      const d = (y * w * scale + x) * 4;
      let lum = 0.299 * img.data[s] + 0.587 * img.data[s + 1] + 0.114 * img.data[s + 2];
      if (invert) lum = 255 - lum;
      if (threshold) lum = lum > threshold ? 255 : 0;
      out.data[d] = out.data[d + 1] = out.data[d + 2] = lum;
      out.data[d + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Pass the screenshot path');
  const img = PNG.sync.read(fs.readFileSync(file));
  const t0 = Date.now();
  const layout = locateFields({ width: img.width, height: img.height, data: img.data });
  console.log('rows:', layout.rowSizes.join(' '), 'boxes:', layout.boxes.length, `${Date.now() - t0}ms`);

  const langPath = path.resolve('node_modules/@tesseract.js-data/eng/4.0.0_best_int');
  const worker = await createWorker('eng', 1, { langPath, gzip: true, cachePath: '/tmp' });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  for (const b of layout.boxes) {
    if (b.field === 'name') continue;
    const { data } = await worker.recognize(crop(img, b));
    const text = data.text.trim();
    const parsed = b.field === 'scanDate' ? parseScanDate(text) : parseReading(text, b.field);
    console.log(b.field.padEnd(24), JSON.stringify(text).padEnd(40), JSON.stringify(parsed));
  }
  if (layout.dials) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(crop(img, layout.dials, true, 0, 2, 110));
    console.log('dials'.padEnd(24), JSON.stringify(data.text.trim()), JSON.stringify(parseDials(data.text)));
  }
  console.log(`total ${Date.now() - t0}ms`);
  await worker.terminate();
}

main();
