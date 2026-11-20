// Renders assets/logo.svg to the PNG app icons in public/icons. Run after editing the logo.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const out = path.join(__dirname, '..', 'public', 'icons');
  const shots = [
    ['icon-512.png', 512, 1], ['icon-192.png', 192, 1], ['apple-touch-icon.png', 180, 1], ['favicon-32.png', 32, 1],
    ['maskable-512.png', 512, 0.78],
  ];
  for (const [name, size, scale] of shots) {
    await page.setViewportSize({ width: size, height: size });
    const inner = svg.replace('<g id="mark"', `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)"><g id="mark"`).replace('</svg>', scale !== 1 ? '</g></svg>' : '</svg>');
    const fixed = scale !== 1 ? inner : svg;
    await page.setContent(`<html><body style="margin:0">${fixed.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('icons written');
})();
