import { build } from 'esbuild';
import { build as viteBauen } from 'vite';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/main', { recursive: true });
await build({
  entryPoints: ['src/main/hauptprozess.ts'],
  outfile: 'dist/main/hauptprozess.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron', 'electron-updater'],
});
await build({
  entryPoints: ['src/preload/bruecke.ts'],
  outfile: 'dist/main/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
});
await viteBauen();
await cp('node_modules/blockly/media', 'dist/renderer/media', { recursive: true });
