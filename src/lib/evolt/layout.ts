/**
 * Finds the white value boxes on an Evolt 360 "Result Sheet" screenshot and
 * works out which field each box holds from its place in the layout.
 *
 * The sheet is a fixed grid of white boxes on a dark background, so locating
 * boxes geometrically is far more reliable than OCR on the small coloured
 * labels. Each box is then OCR'd on its own (see ocr.ts) and parsed.
 */

export interface Rgba {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type BoxField =
  | 'scanDate' | 'name' | 'height' | 'weight' | 'age' | 'gender'
  | 'leanBodyMass' | 'skeletalMuscleMass' | 'protein' | 'mineral' | 'totalBodyWater'
  | 'bodyFatMass' | 'subcutaneousFatMass' | 'visceralFatMass' | 'visceralFatArea' | 'bodyFatPercent'
  | 'visceralFatLevel' | 'icf' | 'ecf' | 'bmr' | 'tee'
  | 'leftArmLean' | 'leftArmFat' | 'rightArmLean' | 'rightArmFat'
  | 'torsoLean' | 'torsoFat' | 'abdominalCircumference' | 'waistToHip'
  | 'leftLegLean' | 'leftLegFat' | 'rightLegLean' | 'rightLegFat'
  | 'calories' | 'proteinTarget' | 'carbTarget' | 'fatTarget';

export interface LocatedBox extends Box {
  field: BoxField;
}

export interface Layout {
  boxes: LocatedBox[];
  /** Region holding the Bio Age and BWI dials, right of the composition grid. */
  dials: Box | null;
  /** Rows of boxes found, for debugging when the layout does not match. */
  rowSizes: number[];
}

const BODY_COMP: BoxField[][] = [
  ['leanBodyMass', 'bodyFatMass', 'visceralFatLevel'],
  ['skeletalMuscleMass', 'subcutaneousFatMass', 'icf'],
  ['protein', 'visceralFatMass', 'ecf'],
  ['mineral', 'visceralFatArea', 'bmr'],
  ['totalBodyWater', 'bodyFatPercent', 'tee'],
];
const SEGMENTAL: BoxField[][] = [
  ['leftArmLean', 'leftArmFat', 'rightArmLean', 'rightArmFat'],
  ['torsoLean', 'torsoFat', 'abdominalCircumference', 'waistToHip'],
  ['leftLegLean', 'leftLegFat', 'rightLegLean', 'rightLegFat'],
];
const NUTRITION: BoxField[] = ['calories', 'proteinTarget', 'carbTarget', 'fatTarget'];

/** Connected regions of near-white pixels that look like filled rectangles. */
export function findWhiteBoxes(img: Rgba): Box[] {
  const { width: W, height: H, data } = img;
  const white = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (r > 215 && g > 215 && b > 215) white[i] = 1;
  }
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const boxes: Box[] = [];
  const minW = W * 0.08, minH = W * 0.025, maxH = W * 0.12;
  for (let start = 0; start < W * H; start++) {
    if (!white[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, count = 0;
    while (sp) {
      const i = stack[--sp];
      const x = i % W, y = (i - x) / W;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && white[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < W - 1 && white[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && white[i - W] && !seen[i - W]) { seen[i - W] = 1; stack[sp++] = i - W; }
      if (y < H - 1 && white[i + W] && !seen[i + W]) { seen[i + W] = 1; stack[sp++] = i + W; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw < minW || bh < minH || bh > maxH) continue;
    if (count / (bw * bh) < 0.6) continue;
    boxes.push({ x0, y0, x1, y1 });
  }
  return boxes;
}

/** Groups boxes into rows that share a vertical centre, top to bottom. */
export function groupRows(boxes: Box[]): Box[][] {
  const sorted = [...boxes].sort((a, b) => a.y0 - b.y0);
  const rows: Box[][] = [];
  for (const b of sorted) {
    const cy = (b.y0 + b.y1) / 2;
    const row = rows.find((r) => {
      const ref = r[0];
      return Math.abs((ref.y0 + ref.y1) / 2 - cy) < (ref.y1 - ref.y0) / 2;
    });
    if (row) row.push(b);
    else rows.push([b]);
  }
  rows.forEach((r) => r.sort((a, b) => a.x0 - b.x0));
  return rows;
}

export function locateFields(img: Rgba): Layout {
  const rows = groupRows(findWhiteBoxes(img));
  const rowSizes = rows.map((r) => r.length);
  const out: LocatedBox[] = [];
  let dials: Box | null = null;

  // Header: a row of 2 (date, name) followed by a row of 4 (height, weight, age, gender).
  let i = rows.findIndex((r, k) => r.length === 2 && rows[k + 1]?.length === 4);
  if (i >= 0) {
    out.push({ ...rows[i][0], field: 'scanDate' }, { ...rows[i][1], field: 'name' });
    const hdr: BoxField[] = ['height', 'weight', 'age', 'gender'];
    rows[i + 1].forEach((b, k) => out.push({ ...b, field: hdr[k] }));
    i += 2;
  } else {
    i = 0;
  }

  // Body composition: the next five rows of three.
  const comp = rows.slice(i).findIndex((r) => r.length === 3);
  if (comp >= 0) {
    const start = i + comp;
    const grid = rows.slice(start, start + 5);
    if (grid.length === 5 && grid.every((r) => r.length === 3)) {
      grid.forEach((r, ri) => r.forEach((b, ci) => out.push({ ...b, field: BODY_COMP[ri][ci] })));
      const right = Math.max(...grid.map((r) => r[2].x1));
      dials = { x0: right + 4, y0: grid[0][0].y0 - 60, x1: img.width - 1, y1: grid[4][0].y1 };
      i = start + 5;
    }
  }

  // Segmental (three rows of four), then nutrition (one row of four).
  const fours = rows.slice(i).filter((r) => r.length === 4);
  fours.slice(0, 3).forEach((r, ri) => r.forEach((b, ci) => out.push({ ...b, field: SEGMENTAL[ri][ci] })));
  if (fours[3]) fours[3].forEach((b, ci) => out.push({ ...b, field: NUTRITION[ci] }));

  return { boxes: out, dials, rowSizes };
}
