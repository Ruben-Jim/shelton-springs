'use strict';
/**
 * Renders assets/guides/enable-notifications-guide.html to a PNG.
 * Run: npm run generate:notification-guide
 */
const path = require('path');

const HTML = path.join(__dirname, '../assets/guides/enable-notifications-guide.html');
const OUT = path.join(__dirname, '../assets/enable-notifications-guide.png');

async function main() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 980 } });
  await page.goto(`file://${HTML}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log('Wrote', path.relative(process.cwd(), OUT));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
