import { readFileSync } from 'node:fs';

const BUNDLE = 'dist/ui.js';
const MAX_BYTES = 40960;
// Syntax esbuild downlevels is fine; these library APIs are not polyfilled, so they must not appear.
const FORBIDDEN = [
  'fromEntries',
  '.flatMap(',
  '.flat(',
  'trimStart',
  'trimEnd',
  'matchAll',
  'replaceAll',
  '.at(',
  'structuredClone',
  'Promise.allSettled',
  'Promise.any',
];

const bundle = readFileSync(BUNDLE, 'utf8');
const bytes = Buffer.byteLength(bundle, 'utf8');
const problems = FORBIDDEN.filter(token => bundle.includes(token)).map(
  token => `contains ${token}`,
);

if (bytes > MAX_BYTES) {
  problems.push(`${bytes} bytes exceeds ${MAX_BYTES}`);
}

process.stdout.write(`${BUNDLE}: ${bytes} bytes\n`);

if (problems.length > 0) {
  process.stderr.write(`Bundle check failed: ${problems.join('; ')}\n`);
  process.exit(1);
}
