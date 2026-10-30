import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { projektPruefen, type EditorBlock } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';
import { businessPaketDateien } from '../src/main/business-export';

const ausfuehren = promisify(execFile);
const vorlagen = ['F-ML-Klassifikation', 'G-ML-Regression'];
const native =
  process.platform === 'win32' &&
  process.env.SCRIPTLAB_ML_TESTS === '1' &&
  existsSync('artifacts/ml/laufzeit/aktiv.json');

async function vorlage(name: string, verfahren = 'RANDOM_FOREST') {
  const p = projektPruefen(
    JSON.parse(await readFile(`beispiele/business/${name}/workflow.scriptlab`, 'utf8')),
  );
  let b: EditorBlock | undefined = p.editor.blocks!.blocks[0];
  while (b) {
    if (b.type === 'sl_biz_ml_train') {
      const d = JSON.parse(b.data!);
      d.konfiguration.verfahren = verfahren;
      b.data = JSON.stringify(d);
    }
    b = b.next?.block;
  }
  return p;
}

describe('ML-Vorlagen und unabhängiger Export', () => {
  it.each(vorlagen)(
    'erzeugt aus %s ein vollständiges Paket ohne Interpreter oder Trainingsdaten',
    async (name) => {
      const p = await vorlage(name);
      const ergebnis = skriptErzeugen(p);
      expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(ergebnis.code).toContain('workflow_art');
      const dateien = await businessPaketDateien(p, ergebnis.code!, resolve('laufzeit'), []);
      expect(dateien.map((d) => d.name)).toEqual(
        expect.arrayContaining([
          'workflow.py',
          'scriptlab_ml/__init__.py',
          'scriptlab_ml/format.py',
          'requirements-ml.lock',
          'ml-notices.md',
          'LICENSE.txt',
        ]),
      );
      expect(dateien.some((d) => /python\.exe|training\.csv|neue-daten\.csv$/.test(d.name))).toBe(false);
      expect(dateien.find((d) => d.name === 'ANLEITUNG.txt')!.inhalt.toString()).toContain(
        'requirements-ml.lock',
      );
    },
  );

  for (const name of vorlagen)
    for (const verfahren of ['RANDOM_FOREST', 'PYTORCH']) {
      it.skipIf(!native)(
        `führt ${name} mit ${verfahren} außerhalb von ScriptLab aus`,
        async () => {
          const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-ML-Export-'));
          try {
            const p = await vorlage(name, verfahren);
            const code = skriptErzeugen(p).code;
            expect(code).not.toBeNull();
            const dateien = await businessPaketDateien(p, code!, resolve('laufzeit'), []);
            for (const d of dateien) {
              const pfad = join(ordner, d.name);
              await mkdir(dirname(pfad), { recursive: true });
              await writeFile(pfad, d.inhalt);
            }
            for (const datei of ['training.csv', 'neue-daten.csv'])
              await cp(`beispiele/business/${name}/${datei}`, join(ordner, datei));
            const quelle = await readFile(join(ordner, 'training.csv'));
            const zeiger = JSON.parse(await readFile('artifacts/ml/laufzeit/aktiv.json', 'utf8'));
            const python = resolve('artifacts/ml/laufzeit', zeiger.ordner, 'python.exe');
            const start = async (modus: string) =>
              ausfuehren(
                python,
                [
                  '-I',
                  '-B',
                  '-X',
                  'utf8',
                  join(ordner, 'workflow.py'),
                  '--modus',
                  modus,
                  '--parameter-datei',
                  join(ordner, 'parameter-beispiel.json'),
                ],
                {
                  cwd: ordner,
                  windowsHide: true,
                  timeout: 120000,
                  maxBuffer: 1024 * 1024,
                },
              );
            await start('prueflauf');
            expect(existsSync(join(ordner, 'modell.slmodell'))).toBe(false);
            expect(existsSync(join(ordner, 'vorhersagen.csv'))).toBe(false);
            await start('ausfuehren');
            const csv = (await readFile(join(ordner, 'vorhersagen.csv'), 'utf8'))
              .replace(/^\uFEFF/, '')
              .trim()
              .split(/\r?\n/);
            expect(csv).toHaveLength(21);
            expect(csv[0]).toBe('ID;Wert;Gruppe;Vorhersage');
            expect(csv[1]).toMatch(/^N001;/);
            expect(csv[20]).toMatch(/^N020;/);
            expect((await readFile(join(ordner, 'modell.slmodell'))).length).toBeGreaterThan(100);
            expect(await readFile(join(ordner, 'training.csv'))).toEqual(quelle);
          } finally {
            await rm(ordner, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
          }
        },
        180000,
      );
    }
});
