import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const basis = process.argv.includes('--basis');
const gebaut = await build({
  stdin: {
    contents:
      "export {neuesProjekt,projektPruefen} from './src/kern/projekt.ts'; export {skriptErzeugen} from './src/kern/skript.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
  plugins: basis
    ? [
        {
          name: 'ausgangsprojekt',
          setup(b) {
            b.onLoad({ filter: /[\\/]kern[\\/]projekt\.ts$/ }, () => ({
              contents: execFileSync('git', ['show', 'fa6b208:src/kern/projekt.ts'], { encoding: 'utf8' }),
              loader: 'ts',
            }));
          },
        },
      ]
    : [],
});
const { neuesProjekt, projektPruefen, skriptErzeugen } = await import(
  'data:text/javascript;base64,' + Buffer.from(gebaut.outputFiles[0].text).toString('base64')
);
const faelle = [];
for (const anzahl of [50, 150, 500, 1000, 2000]) {
  const p = neuesProjekt('python');
  let b = p.editor.blocks.blocks[0];
  for (let i = 1; i < anzahl; i++) {
    b.next = { block: { type: 'sl_comment', id: `schritt-${i}`, fields: { TEXT: `Schritt ${i}: Grüße` } } };
    b = b.next.block;
  }
  const fall = {
    anzahl,
    bytes_formatiert: Buffer.byteLength(JSON.stringify(p, null, 2)),
    bytes_kompakt: Buffer.byteLength(JSON.stringify(p)),
    pruefung_ms: [],
    status: 'bestanden',
  };
  try {
    for (let i = 0; i < 5; i++) {
      const beginn = performance.now();
      projektPruefen(p);
      fall.pruefung_ms.push(performance.now() - beginn);
    }
    for (const sprache of ['python', 'vbs']) {
      p.skriptsprache = sprache;
      const r = skriptErzeugen(p);
      if (!r.code) throw new Error(JSON.stringify(r.meldungen));
    }
  } catch (e) {
    fall.status = 'fehlgeschlagen';
    fall.fehler = e.message;
  }
  faelle.push(fall);
}
const bericht = {
  stand: basis
    ? 'fa6b208 (Projektprüfung)'
    : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() + ' + Arbeitsbaum',
  node: process.version,
  plattform: process.platform,
  faelle,
};
await writeFile(
  `artifacts/qualitaet-projektumfang-${basis ? 'vorher' : 'nachher'}.json`,
  JSON.stringify(bericht, null, 2),
);
console.log(JSON.stringify(bericht));
