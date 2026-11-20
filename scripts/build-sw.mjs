// Writes out/sw.js after `next build`: a service worker that precaches every
// page and asset of the static export, so the app opens with no connection.
// OCR files are large and only needed for scan imports, so they are cached
// the first time they are used instead.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out = path.resolve(import.meta.dirname, '..', 'out');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(out);

const hash = crypto.createHash('sha256');
const precache = [];
for (const f of files.sort()) {
  const rel = '/' + path.relative(out, f).split(path.sep).join('/');
  if (rel.startsWith('/ocr/') || rel === '/sw.js' || rel.endsWith('.map')) continue;
  hash.update(rel).update(fs.readFileSync(f));
  // Pages are served at their folder URL (trailingSlash), e.g. /history/.
  precache.push(rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel);
}
const version = hash.digest('hex').slice(0, 12);
const template = fs.readFileSync(path.resolve(import.meta.dirname, 'sw-template.js'), 'utf8');
const sw = template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache));
fs.writeFileSync(path.join(out, 'sw.js'), sw);
console.log(`sw.js: ${precache.length} files precached, version ${version}`);
