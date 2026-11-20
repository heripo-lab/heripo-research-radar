import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  tsconfig: './tsconfig.build.json',
  format: 'esm',
  outDir: 'dist',
  // Keep the published filenames as dist/index.js and dist/index.d.ts;
  // tsdown would otherwise emit .mjs / .d.mts.
  fixedExtension: false,
  dts: true,
  sourcemap: true,
});
