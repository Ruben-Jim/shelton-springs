const fs = require('fs');
const path = require('path');
const glob = require('glob');

const distDir = path.join(__dirname, '../dist');
const targetFontDir = path.join(
  distDir,
  'assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts'
);

const findIoniconFont = () => {
  const matches = glob.sync(path.join(distDir, '**/Ionicons*.ttf'));
  return matches.length > 0 ? matches[0] : null;
};

const ensureDir = dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const sourceFont = findIoniconFont();

if (!sourceFont) {
  console.log('❌ Ionicons font not found in dist folder – skipping font fix.');
  process.exit(0);
}

const hashedFontName = path.basename(sourceFont);

// Copy to expected Expo web path
ensureDir(targetFontDir);
const distTargetFontPath = path.join(targetFontDir, hashedFontName);
fs.copyFileSync(sourceFont, distTargetFontPath);
console.log(`✅ Ionicons font copied to ${distTargetFontPath.replace(distDir, '')}`);

// Also copy to root for custom preload fallback
const rootFontPath = path.join(distDir, 'Ionicons.ttf');
fs.copyFileSync(sourceFont, rootFontPath);
console.log('✅ Ionicons font copied to root for HTML preload');

// Inject font-face + preload into HTML
const htmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  if (!html.includes('Ionicons.ttf')) {
    const fontCSS = `
      /* Ionicons font face declaration */
      @font-face {
        font-family: 'Ionicons';
        src: url('./Ionicons.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    </style>
    <!-- Preload Ionicons font for better performance -->
    <link rel="preload" href="./Ionicons.ttf" as="font" type="font/ttf" crossorigin="anonymous">`;

    html = html.replace('</style>', fontCSS);
    fs.writeFileSync(htmlPath, html);
    console.log('✅ HTML updated with Ionicons preload');
  } else {
    console.log('ℹ️ HTML already contains Ionicons preload – skipping injection');
  }
} else {
  console.log('❌ dist/index.html not found');
}

// Copy privacy-policy.html to dist folder
const privacyPolicyPath = path.join(__dirname, '../privacy-policy.html');
const distPrivacyPolicyPath = path.join(distDir, 'privacy-policy.html');

if (fs.existsSync(privacyPolicyPath)) {
  fs.copyFileSync(privacyPolicyPath, distPrivacyPolicyPath);
  console.log('✅ Privacy policy copied to dist folder');
} else {
  console.log('⚠️ privacy-policy.html not found in project root');
}
<<<<<<< HEAD
=======

// Copy terms-of-service.html to dist folder
const termsOfServicePath = path.join(__dirname, '../terms-of-service.html');
const distTermsOfServicePath = path.join(distDir, 'terms-of-service.html');

if (fs.existsSync(termsOfServicePath)) {
  fs.copyFileSync(termsOfServicePath, distTermsOfServicePath);
  console.log('✅ Terms of Service copied to dist folder');
} else {
  console.log('⚠️ terms-of-service.html not found in project root');
}

// Copy contact.html to dist folder
const contactPath = path.join(__dirname, '../contact.html');
const distContactPath = path.join(distDir, 'contact.html');

if (fs.existsSync(contactPath)) {
  fs.copyFileSync(contactPath, distContactPath);
  console.log('✅ Contact page copied to dist folder');
} else {
  console.log('⚠️ contact.html not found in project root');
}
>>>>>>> 7cb713f (adding contact, privacy-policy, and terms of service)
