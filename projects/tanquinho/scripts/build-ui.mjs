import { build, context } from 'esbuild';

const options = {
  bundle: true,
  charset: 'utf8',
  entryPoints: ['src/main.ts'],
  format: 'iife',
  legalComments: 'none',
  logLevel: 'info',
  minify: true,
  outfile: 'dist/ui.js',
  target: 'es2017',
};

if (process.argv.includes('--watch')) {
  const buildContext = await context(options);

  await buildContext.watch();
} else {
  await build(options);
}
