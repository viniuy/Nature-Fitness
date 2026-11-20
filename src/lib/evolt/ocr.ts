'use client';

import { createWorker, PSM, type Worker } from 'tesseract.js';
import { locateFields, type Box } from './layout';
import { isConsistent, parseDials, parseReading, parseScanDate, type EvoltValues } from './parse';

export interface ImportResult {
  values: EvoltValues;
  date: string | null;
  found: number;
  /** Row pattern of boxes found, for a helpful error when the layout differs. */
  rowSizes: number[];
}

const PASSES = [{ scale: 3 }, { scale: 3, smooth: true }, { scale: 4, smooth: true }, { scale: 2, smooth: true }];

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  // Everything is served from /ocr (copied there at build time and cached by
  // the service worker), so the import works with no connection.
  workerPromise ??= createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr',
    gzip: true,
    workerBlobURL: false,
  });
  return workerPromise;
}

/** Fetches the OCR files ahead of time so they are cached for offline use. */
export function warmOcr(): void {
  if (typeof window === 'undefined') return;
  const files = ['worker.min.js', 'eng.traineddata.gz', 'tesseract-core-simd-lstm.wasm.js'];
  files.forEach((f) => fetch(`/ocr/${f}`).catch(() => {}));
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through for formats like HEIC that Safari decodes only via <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cropCanvas(src: HTMLCanvasElement, b: Box, opts: { invert?: boolean; pad?: number; scale?: number; threshold?: number; smooth?: boolean } = {}) {
  const { invert = false, pad = 4, scale = 3, threshold = 0, smooth = false } = opts;
  const x0 = Math.max(0, b.x0 + pad), y0 = Math.max(0, b.y0 + pad);
  const w = Math.max(1, Math.min(src.width - 1, b.x1 - pad) - x0 + 1);
  const h = Math.max(1, Math.min(src.height - 1, b.y1 - pad) - y0 + 1);
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    let lum = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    if (invert) lum = 255 - lum;
    if (threshold) lum = lum > threshold ? 255 : 0;
    d[p] = d[p + 1] = d[p + 2] = lum;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function readEvoltScreenshot(file: Blob, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const bitmap = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const layout = locateFields(pixels);

  const values: EvoltValues = {};
  let date: string | null = null;
  const boxes = layout.boxes.filter((b) => b.field !== 'name' && b.field !== 'gender');
  const total = boxes.length + (layout.dials ? 1 : 0);
  if (boxes.length === 0) return { values, date, found: 0, rowSizes: layout.rowSizes };

  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  let done = 0;
  for (const b of boxes) {
    if (b.field === 'scanDate') {
      const { data } = await worker.recognize(cropCanvas(canvas, b));
      date = parseScanDate(data.text);
    } else {
      // Read again with other scaling when the result contradicts its own range.
      let best = null;
      for (const opts of PASSES) {
        const { data } = await worker.recognize(cropCanvas(canvas, b, opts));
        const r = parseReading(data.text, b.field);
        best ??= r;
        if (isConsistent(r)) { best = r; break; }
      }
      values[b.field] = best!;
    }
    onProgress?.(++done, total);
  }
  if (layout.dials) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(cropCanvas(canvas, layout.dials, { invert: true, pad: 0, scale: 2, threshold: 110 }));
    const dials = parseDials(data.text);
    if (dials.bioAge != null) values.bioAge = { value: dials.bioAge };
    if (dials.bwi != null) values.bwiScore = { value: dials.bwi };
    onProgress?.(++done, total);
  }
  const found = Object.values(values).filter((v) => v?.value != null).length;
  return { values, date, found, rowSizes: layout.rowSizes };
}
