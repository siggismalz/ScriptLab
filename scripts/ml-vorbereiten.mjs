import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (process.argv.slice(2).some((a) => !['--pruefen', '--online'].includes(a)))
  throw Error('Erlaubt: --pruefen oder --online; sonst lokale verifizierte Wheels.');
await mkdir(resolve('artifacts/ml'), { recursive: true });
const ziel = resolve('artifacts/ml/ml-dienst.mjs');
await build({
  entryPoints: ['src/windows/ml-laufzeit.ts'],
  outfile: ziel,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const m = await import(pathToFileURL(ziel).href + '?' + Date.now());
const o = {
  basisWurzel: resolve('artifacts/python-buendel/python'),
  wurzel: resolve('artifacts/ml/laufzeit'),
  helper: resolve('artifacts/native/ScriptLab.Testhost.exe'),
  technischeOrdner: resolve('artifacts/ml/technik'),
  paketwurzel: resolve('laufzeit'),
  fortschritt: (s) => console.log(s.phase + ': ' + s.meldung),
};
const status = process.argv.includes('--pruefen')
  ? await m.mlStatusPruefen(o)
  : await m.mlEinrichten(o, process.argv.includes('--online') ? undefined : resolve('artifacts/ml/wheels'));
console.log(JSON.stringify(status, null, 2));
if (status.zustand !== 'bereit') process.exitCode = 1;
