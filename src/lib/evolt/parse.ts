import type { BoxField } from './layout';

/** One parsed reading, e.g. "56.2 / Optimal [49.4 - 60.4]". */
export interface Reading {
  value: number | null;
  status?: string;
  low?: number;
  high?: number;
  /** For ranges like the nutrition targets "213g - 220g (30%)". */
  max?: number;
  share?: number;
  text?: string;
}

export type EvoltValues = Partial<Record<BoxField | 'bioAge' | 'bwiScore', Reading>>;

const NUM = /-?\d+(?:[.,]\d+)?/g;

function toNum(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/** OCR often reads a decimal point as a comma, and brackets as parentheses. */
export function cleanOcr(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    // A digit 1 misread as a letter between digits: "1n.7" -> "11.7".
    .replace(/(\d)[lIin](?=[\d.])/g, '$11')
    .trim();
}

export function parseReading(raw: string, field?: BoxField): Reading {
  const text = cleanOcr(raw);
  const r: Reading = { value: null, text };

  if (field === 'scanDate' || field === 'name' || field === 'gender') {
    return r;
  }

  // Nutrition targets: "213g - 220g (30%)" or "2837 - 2937".
  if (field === 'calories' || field === 'proteinTarget' || field === 'carbTarget' || field === 'fatTarget') {
    const nums = text.match(NUM)?.map(toNum) ?? [];
    r.value = nums[0] ?? null;
    if (nums[1] != null) r.max = nums[1];
    const pct = text.match(/\(?\s*(\d+)\s*%/);
    if (pct) r.share = +pct[1];
    return r;
  }

  const firstNum = text.match(NUM);
  r.value = firstNum ? toNum(firstNum[0]) : null;

  // The status word ("56.2 / Optimal"); OCR sometimes reads the slash as |.
  const st = text.match(/\b(optimal|high|under|low|balanced|normal|over|healthy|excellent)\b/i);
  if (st) r.status = st[1][0].toUpperCase() + st[1].slice(1).toLowerCase();

  // Reference range in brackets: [49.4 - 60.4] (OCR may give ( or { and drop the dash).
  const range = text.match(/[[({]\s*(\d+(?:\.\d+)?)\s*[-–~]?\s*(\d+(?:\.\d+)?)\s*[\])}]?/);
  if (range && r.status) {
    r.low = toNum(range[1]);
    r.high = toNum(range[2]);
  }
  // A dropped decimal point in the range, e.g. [056 - 0.83].
  if (r.low != null && r.high != null && r.low > r.high) {
    for (const d of [10, 100]) {
      if (r.low / d <= r.high) { r.low = r.low / d; break; }
    }
  }
  // Share in brackets: [16.8%]
  const pct = text.match(/[[({]\s*(\d+(?:\.\d+)?)\s*%/);
  if (pct) r.share = toNum(pct[1]);

  // Fix a dropped decimal point when the range shows the expected scale,
  // e.g. "562 / Optimal [49.4 - 60.4]" should be 56.2.
  if (r.value != null && r.low != null && r.high != null) {
    const v = r.value;
    if (v > r.high * 5 && Number.isInteger(v)) {
      for (const d of [10, 100]) {
        const c = v / d;
        if (c >= r.low * 0.5 && c <= r.high * 1.5) { r.value = c; break; }
      }
    }
  }
  return r;
}

/** "23-10-2026 09:00" (day-month-year) to an ISO date, or null. */
export function parseScanDate(raw: string): string | null {
  const m = cleanOcr(raw).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Bio Age and BWI score from the dial region: "22" then "8.0 / 10". */
export function parseDials(raw: string): { bioAge?: number; bwi?: number } {
  // Drop the numbered labels ("16. BIO AGE", "17. BWI SCORE").
  const text = cleanOcr(raw).replace(/\b\d{1,2}\.\s*[A-Za-z][A-Za-z* ]*/g, ' ');
  const out: { bioAge?: number; bwi?: number } = {};
  const bwi = text.match(/(\d{1,2}[.]\d)\s*\/?\s*10/);
  if (bwi) out.bwi = toNum(bwi[1]);
  const ints = text.replace(bwi?.[0] ?? '', ' ').match(/\b(\d{2})\b/g);
  if (ints) {
    const age = ints.map(Number).find((n) => n >= 10 && n <= 99);
    if (age != null) out.bioAge = age;
  }
  return out;
}

/**
 * False when a reading contradicts itself: the sheet says "Optimal" but the
 * value is outside its own reference range. That nearly always means OCR
 * dropped or misread a digit, so the box is read again or flagged for review.
 */
export function isConsistent(r: Reading): boolean {
  if (r.value == null) return false;
  if (r.low == null || r.high == null || !r.status) return true;
  if (!/^(Optimal|Normal|Balanced|Healthy)$/.test(r.status)) return true;
  return r.value >= r.low * 0.98 && r.value <= r.high * 1.02;
}
