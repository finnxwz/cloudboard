import esbuild from 'esbuild';

const production = process.argv.includes('production');
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2018',
  sourcemap: production ? false : 'inline',
  minify: production,
  outfile: 'main.js',
  logLevel: 'info',
});
if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
