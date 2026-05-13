/**
 * Demo branch guardrails (run in CI or locally on demo).
 *
 * - When app.json has expo.extra.demoMode === true, convexUrl must be set.
 * - If env DEMO_INVARIANT_BLOCK_CONVEX_URL is set to your production deployment URL,
 *   the script fails when app.json's convexUrl matches it (demo must never ship prod).
 *
 * Usage: node scripts/check-demo-invariants.cjs
 */

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
const extra = app.expo?.extra;

if (!extra?.demoMode) {
  console.log('check-demo-invariants: demoMode is false or missing — nothing to enforce.');
  process.exit(0);
}

if (!extra.convexUrl || typeof extra.convexUrl !== 'string') {
  console.error('check-demo-invariants: demoMode requires a string expo.extra.convexUrl for ConvexReactClient.');
  process.exit(1);
}

const block = process.env.DEMO_INVARIANT_BLOCK_CONVEX_URL;
if (block && extra.convexUrl.trim() === block.trim()) {
  console.error(
    'check-demo-invariants: demo convexUrl must not equal production (DEMO_INVARIANT_BLOCK_CONVEX_URL).'
  );
  process.exit(1);
}

console.log('check-demo-invariants: OK (demoMode + convexUrl present, prod URL not blocked match).');
