'use strict';
/**
 * Writes printable PNG QR codes under assets/qr/.
 * Run: npm run generate:qr
 * For iOS, set EXPO_PUBLIC_IOS_APP_STORE_URL to your App Store product URL first.
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const WEBSITE = 'https://sheltonsprings.homes';
const ANDROID =
  'https://play.google.com/store/apps/details?id=com.rubenjim.sheltonsprings';
/** Apple ASC app id (matches eas.json submit.production.ios.ascAppId). */
const IOS_APP_STORE_URL_DEFAULT = 'https://apps.apple.com/app/id6755036217';
const OUT = path.join(__dirname, '../assets/qr');

async function writePng(filename, value) {
  const dest = path.join(OUT, filename);
  await QRCode.toFile(dest, value, { width: 512, margin: 2, color: { dark: '#111827', light: '#ffffff' } });
  console.log('Wrote', path.relative(process.cwd(), dest));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await writePng('website.png', WEBSITE);
  await writePng('android-google-play.png', ANDROID);
  const ios =
    process.env.EXPO_PUBLIC_IOS_APP_STORE_URL &&
    String(process.env.EXPO_PUBLIC_IOS_APP_STORE_URL).trim().startsWith('http')
      ? String(process.env.EXPO_PUBLIC_IOS_APP_STORE_URL).trim()
      : IOS_APP_STORE_URL_DEFAULT;
  await writePng('ios-app-store.png', ios);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
