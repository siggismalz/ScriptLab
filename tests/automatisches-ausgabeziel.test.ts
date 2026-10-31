import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';

function beispiel(quelle: string, gebunden: boolean) {
  const p = neuesProjekt('python');
  const lesen: EditorBlock = {
    id: 'quelle',
    type: 'sl_biz_lesen_csv',
    data: JSON.stringify({
      konfiguration: { format: 'CSV', pfad: quelle, optionen: { trennzeichen: ';' } },
      eingaben: {},
    }),
    next: {
      block: {
        id: 'speichern',
        type: 'sl_biz_schreiben_xlsx',
        data: JSON.stringify({
          konfiguration: { format: 'XLSX', pfad: gebunden ? { variable: 'zielvariable' } : '' },
          eingaben: { tabelle: { referenz: 'quelle' } },
        }),
      },
    },
  };
  if (gebunden) {
    p.editor.variables = [{ id: 'zielvariable', name: 'Mein Speicherort' }];
    p.editor.blocks!.blocks[0].next = {
      block: {
        id: 'setzen',
        type: 'sl_set',
        fields: { VAR: { id: 'zielvariable' } },
        inputs: { WERT: { block: { id: 'leererwert', type: 'sl_text', fields: { TEXT: '' } } } },
        next: { block: lesen },
      },
    };
  } else p.editor.blocks!.blocks[0].next = { block: lesen };
  return p;
}

describe('Automatische Ausgabe im vollständigen Workflow', () => {
  it('akzeptiert nur den Ausgabepfad als optional und erhält die Zuordnung im gespeicherten Modell', () => {
    const p = beispiel('Meine Daten.csv', false);
    const wieder = JSON.parse(JSON.stringify(p));
    const r = skriptErzeugen(wieder);
    expect(r.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(r.code).toBeTruthy();
    expect(wieder.editor.blocks.blocks[0].next.block.next.block.id).toBe('speichern');
    expect(
      JSON.parse(wieder.editor.blocks.blocks[0].next.block.next.block.data).eingaben.tabelle.referenz,
    ).toBe('quelle');
    expect(skriptErzeugen(beispiel('', false)).meldungen.some((m) => m.stufe === 'fehler')).toBe(true);
  });

  it.runIf(existsSync(resolve('artifacts/business-runtime/installation.json')))(
    'weist eine leere gebundene Variable auch im eigenständigen Export ab',
    async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Ausgabevariable-'));
      try {
        const quelle = join(ordner, 'Quelle.csv');
        await writeFile(quelle, 'ID;Name\n001;Müller\n');
        const r = skriptErzeugen(beispiel(quelle, true));
        expect(r.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
        expect(r.code).toBeTruthy();
        const script = join(ordner, 'workflow.py');
        await writeFile(script, r.code!);
        const installation = JSON.parse(
          await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
        );
        const ergebnis = await promisify(execFile)(
          installation.installation.pfad,
          [
            '-B',
            '-c',
            "import ctypes,runpy,sys; ctypes.windll.user32.MessageBoxW=lambda *a: 0; sys.argv=[sys.argv[1]]; runpy.run_path(sys.argv[0],run_name='__main__')",
            script,
          ],
          {
            cwd: ordner,
            env: { ...process.env, PYTHONPATH: resolve('laufzeit') },
            timeout: 15000,
          },
        ).then(
          () => ({ code: 0, meldung: '' }),
          (e: { code: number; stderr: string; stdout: string }) => ({
            code: e.code,
            meldung: e.stderr + e.stdout,
          }),
        );
        expect(ergebnis.code).not.toBe(0);
        expect(ergebnis.meldung).toContain('Variable für den Speicherort ist leer');
        expect((await readdir(ordner)).filter((n) => n.endsWith('.xlsx'))).toEqual([]);
        expect(await readFile(quelle, 'utf8')).toBe('ID;Name\n001;Müller\n');
      } finally {
        await rm(ordner, { recursive: true, force: true });
      }
    },
  );
});
