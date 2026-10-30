import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TestlaufDienst } from '../src/windows/testlauf';
import { projektPruefen, type EditorBlock } from '../src/kern/projekt';

const frei =
  process.platform === 'win32' &&
  process.env.SCRIPTLAB_ML_TESTS === '1' &&
  existsSync('artifacts/ml/laufzeit/aktiv.json');
describe.skipIf(!frei)('Echte ML-Prozesse abbrechen und zeitlich begrenzen', () => {
  for (const art of ['abbruch', 'zeitlimit'] as const)
    it(
      art,
      async () => {
        const basis = await mkdtemp(join(tmpdir(), 'ScriptLab-ML-Prozess-'));
        let dienst: TestlaufDienst | undefined;
        try {
          const zeiger = JSON.parse(await readFile('artifacts/ml/laufzeit/aktiv.json', 'utf8'));
          const python = resolve('artifacts/ml/laufzeit', zeiger.ordner, 'python.exe');
          const p = projektPruefen(
            JSON.parse(await readFile('beispiele/business/F-ML-Klassifikation/workflow.scriptlab', 'utf8')),
          );
          p.business.parameter = p.business.parameter.map((d) => ({
            ...d,
            standard: join(basis, String(d.standard)),
          }));
          await writeFile(
            join(basis, 'training.csv'),
            'ID;Wert;Gruppe;Ziel\r\n' +
              Array.from(
                { length: 20000 },
                (_, n) => `${n};${n % 100};Gruppe;${n % 100 < 50 ? 'A' : 'B'}`,
              ).join('\r\n') +
              '\r\n',
          );
          await writeFile(join(basis, 'neue-daten.csv'), 'ID;Wert;Gruppe\r\nN001;20;Gruppe\r\n');
          const original = await readFile(join(basis, 'training.csv'));
          let b: EditorBlock | undefined = p.editor.blocks!.blocks[0];
          while (b) {
            if (b.type === 'sl_biz_ml_train') {
              const d = JSON.parse(b.data!);
              Object.assign(d.konfiguration, { verfahren: 'PYTORCH', epochen: 1000 });
              b.data = JSON.stringify(d);
            }
            b = b.next?.block;
          }
          const technik = join(basis, 'technik');
          await mkdir(technik);
          dienst = new TestlaufDienst(
            resolve('artifacts/native/ScriptLab.Testhost.exe'),
            technik,
            async () => ({
              pfad: python,
              version: '3.15.2',
              architektur: 'x64',
              implementierung: 'CPython',
              tkinter: true,
            }),
            {
              paketwurzel: resolve('laufzeit'),
              journaleOrdner: join(basis, 'journale'),
              pruefen: async () => {},
            },
            undefined,
            basis,
          );
          dienst.starten(p, {
            basisVerzeichnis: basis,
            zeitlimitSekunden: art === 'zeitlimit' ? 1 : 60,
            business: {
              modus: 'ausfuehren',
              parametersatz: 'test',
              parameter: {},
              speicherMB: 512,
              tempGB: 4,
              fortsetzen: false,
            },
          });
          if (art === 'abbruch') {
            await expect
              .poll(() => dienst!.lesen().business?.ereignisse.some((e) => e.art === 'ml_fortschritt'), {
                timeout: 30000,
              })
              .toBe(true);
            const pid = dienst.lesen().prozessId;
            expect(pid).toBeTruthy();
            const ende = await dienst.stoppen();
            expect(ende.phase).toBe('abgebrochen');
            let lebt = false;
            try {
              process.kill(pid!, 0);
              lebt = true;
            } catch {}
            expect(lebt).toBe(false);
          } else await expect.poll(() => dienst!.lesen().phase, { timeout: 30000 }).toBe('zeitlimit');
          expect(existsSync(join(basis, 'modell.slmodell'))).toBe(false);
          expect(existsSync(join(basis, 'vorhersagen.csv'))).toBe(false);
          expect(await readFile(join(basis, 'training.csv'))).toEqual(original);
          await expect.poll(async () => (await readdir(technik)).length, { timeout: 10000 }).toBe(0);
        } finally {
          await dienst?.stoppen();
          await rm(basis, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        }
      },
      60000,
    );
});
