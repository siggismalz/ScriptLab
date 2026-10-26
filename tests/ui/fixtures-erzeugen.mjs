import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nur Datenkonstruktion und JSON-Ausgabe, keine Interpretation oder Ausführung von VBS.
const ordner = dirname(fileURLToPath(import.meta.url));
const gebaut = await build({
  entryPoints: [join(ordner, 'fixtures.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const modul = await import(
  `data:text/javascript;base64,${Buffer.from(gebaut.outputFiles[0].contents).toString('base64')}`
);
const ziel = join(ordner, 'fixtures');
await mkdir(ziel, { recursive: true });
for (const [name, p] of Object.entries(modul.uiTestprojekte))
  await writeFile(join(ziel, name), `${JSON.stringify(p, null, 2)}\n`, 'utf8');
process.stdout.write(`${Object.keys(modul.uiTestprojekte).length} reine UI-Testprojekte geschrieben.\n`);
