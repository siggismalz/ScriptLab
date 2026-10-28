import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
  unlinkSync,
  rmSync,
  openSync,
  closeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import { skriptErzeugen, type GeneratorOptionen } from '../src/kern/skript';
import { TestlaufDienst } from '../src/windows/testlauf';
import type { PythonInstallation } from '../src/gemeinsam/python';

const token = 'Ausgabepruefung_'.repeat(4);
const python = existsSync(resolve('artifacts/business-runtime/installation.json'))
  ? (JSON.parse(readFileSync(resolve('artifacts/business-runtime/installation.json'), 'utf8')).installation
      .pfad as string)
  : undefined;
const installation: PythonInstallation | undefined = python
  ? JSON.parse(readFileSync(resolve('artifacts/business-runtime/installation.json'), 'utf8')).installation
  : undefined;
let nummer = 0;
function text(inhalt: string): EditorBlock {
  return { id: `text-${++nummer}`, type: 'sl_text', fields: { TEXT: inhalt } };
}
function projekt(
  sprache: 'python' | 'vbs',
  typ: string,
  werte: Record<string, string>,
  felder: EditorBlock['fields'] = {},
) {
  const p = neuesProjekt(sprache);
  p.editor.blocks!.blocks[0].next = {
    block: {
      id: 'schreibender-baustein',
      type: typ,
      fields: felder,
      inputs: Object.fromEntries(Object.entries(werte).map(([name, wert]) => [name, { block: text(wert) }])),
    },
  };
  return p;
}

describe.skipIf(process.platform !== 'win32')('Gespeicherte Ausgaben mit echten Windows-Dateien', () => {
  for (const sprache of ['vbs', 'python'] as const) {
    it(`begrenzt ${sprache}-Appausgaben und erhält Quellen sowie Exporte`, async ({ skip }) => {
      if (sprache === 'python' && !python) skip('Keine vorhandene Python-Prüflaufzeit eingerichtet.');
      const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Ausgabeziele-'));
      const app = join(ordner, 'Appdaten'),
        fremd = join(ordner, 'Fremde Quellen');
      const basis = join(app, 'Arbeitsdateien', 'Workflow');
      const verweis = join(app, 'Verknuepfung');
      mkdirSync(basis, { recursive: true });
      mkdirSync(fremd);
      mkdirSync(join(ordner, 'Appdaten-Nachbar'));
      const quelle = join(fremd, 'Quelle.txt');
      writeFileSync(quelle, 'Originale Quelldaten', 'utf8');
      let laufnummer = 0;
      const starten = async (
        typ: string,
        werte: Record<string, string>,
        felder: EditorBlock['fields'] = {},
        modus: 'intern' | 'ohneRoot' | 'export' = 'intern',
      ) => {
        const optionen: GeneratorOptionen =
          modus === 'export'
            ? { modus: 'export' }
            : {
                modus: 'test',
                token,
                ...(modus === 'intern' ? { ausgabeWurzel: app } : {}),
              };
        const stand = projekt(sprache, typ, werte, felder);
        if (modus !== 'export') {
          const dienst = new TestlaufDienst(
            resolve('artifacts/native/ScriptLab.Testhost.exe'),
            join(ordner, `Technik-${++laufnummer}`),
            async () => installation!,
            undefined,
            undefined,
            modus === 'intern' ? app : undefined,
          );
          dienst.starten(stand, { basisVerzeichnis: basis, zeitlimitSekunden: 15 });
          const frist = Date.now() + 25000;
          while (dienst.aktiv() && Date.now() < frist) await new Promise((r) => setTimeout(r, 20));
          if (dienst.aktiv()) await dienst.stoppen();
          const zustand = dienst.lesen();
          expect(
            zustand.phase,
            `${typ}: ${zustand.meldung}; Quelle vorhanden: ${existsSync(quelle)}`,
          ).not.toBe('zeitlimit');
          return {
            status: zustand.phase === 'beendet' ? 0 : 1,
            stdout: zustand.ausgabe,
            stderr: [zustand.meldung, zustand.technischeMeldung].filter(Boolean).join('\n'),
          };
        }
        const erzeugt = skriptErzeugen(stand, optionen);
        expect(erzeugt.code, JSON.stringify(erzeugt.meldungen)).not.toBeNull();
        const datei = join(ordner, `Pruefung-${++laufnummer}.${sprache === 'python' ? 'py' : 'vbs'}`);
        writeFileSync(
          datei,
          sprache === 'python'
            ? erzeugt.code!
            : Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(erzeugt.code!, 'utf16le')]),
        );
        const args =
          modus === 'export'
            ? []
            : sprache === 'python'
              ? ['--scriptlab-basis', basis, '--scriptlab-token', token]
              : [`/ScriptLabBasis:${basis}`, `/ScriptLabTestToken:${token}`];
        const stdoutDatei = `${datei}.stdout`,
          stderrDatei = `${datei}.stderr`;
        const stdout = openSync(stdoutDatei, 'w'),
          stderr = openSync(stderrDatei, 'w');
        let prozess: ReturnType<typeof spawnSync>;
        try {
          // cscript benötigt synchrone native Handles; Node-Windows-Pipes können blockieren.
          prozess = spawnSync(
            sprache === 'python'
              ? python!
              : join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cscript.exe'),
            [...(sprache === 'python' ? ['-I', '-B'] : ['//nologo']), datei, ...args],
            { timeout: 8000, windowsHide: true, cwd: basis, stdio: ['ignore', stdout, stderr] },
          );
        } finally {
          closeSync(stdout);
          closeSync(stderr);
        }
        if (prozess.error) throw new Error(`${typ} ${JSON.stringify(werte)}: ${prozess.error.message}`);
        return {
          ...prozess,
          stdout: readFileSync(stdoutDatei, 'utf8'),
          stderr: readFileSync(stderrDatei, 'utf8'),
        };
      };
      const schreiben = (pfad: string, modus: 'intern' | 'ohneRoot' | 'export' = 'intern') =>
        starten('sl_write_text', { PFAD: pfad, TEXT: 'Neue Ausgabe' }, { KODIERUNG: 'UTF8' }, modus);
      const abgelehnt = (prozess: Awaited<ReturnType<typeof starten>>) => {
        expect(prozess.status, prozess.stderr + prozess.stdout).not.toBe(0);
        expect(prozess.stderr).toMatch(/Appdatenordner|Windows-Verkn|Appdatenordner.*gespeichert/);
      };
      try {
        const kopiert = await starten(
          'sl_copy',
          { QUELLE: quelle, ZIEL: 'Kopie.txt' },
          { ZIELREGEL: 'FEHLER' },
        );
        expect(kopiert.status, kopiert.stderr).toBe(0);
        expect(readFileSync(join(basis, 'Kopie.txt'), 'utf8')).toBe('Originale Quelldaten');
        expect(readFileSync(quelle, 'utf8')).toBe('Originale Quelldaten');

        const ausserhalb = join(fremd, 'Verboten.txt');
        abgelehnt(await schreiben(ausserhalb));
        abgelehnt(await schreiben('..\\..\\..\\Fremde Quellen\\Traverse.txt'));
        abgelehnt(await schreiben(join(ordner, 'Appdaten-Nachbar', 'Praefix.txt')));
        abgelehnt(await starten('sl_mkdir', { PFAD: join(fremd, 'Neuer Ordner') }));
        expect(existsSync(ausserhalb)).toBe(false);
        expect(existsSync(join(fremd, 'Traverse.txt'))).toBe(false);
        expect(existsSync(join(fremd, 'Neuer Ordner'))).toBe(false);

        symlinkSync(fremd, verweis, 'junction');
        abgelehnt(await schreiben(join(verweis, 'Junction.txt')));
        expect(existsSync(join(fremd, 'Junction.txt'))).toBe(false);

        abgelehnt(await starten('sl_rename', { QUELLE: quelle, NAME: 'Umbenannt.txt' }));
        expect(existsSync(quelle)).toBe(true);
        const verschoben = await starten(
          'sl_move',
          { QUELLE: quelle, ZIEL: 'Verschoben.txt' },
          { ZIELREGEL: 'FEHLER' },
        );
        expect(verschoben.status, verschoben.stderr).toBe(0);
        expect(existsSync(quelle)).toBe(false);
        expect(readFileSync(join(basis, 'Verschoben.txt'), 'utf8')).toBe('Originale Quelldaten');

        expect((await schreiben(ausserhalb, 'ohneRoot')).status).toBe(0);
        expect((await schreiben(ausserhalb, 'export')).status).toBe(0);
        expect(readFileSync(ausserhalb, 'utf8')).toContain('Neue Ausgabe');
      } finally {
        if (existsSync(verweis)) unlinkSync(verweis);
        // Ausschließlich der von diesem Test angelegte, absolute Tempordner.
        if (dirname(ordner) !== resolve(tmpdir()) || !basename(ordner).startsWith('ScriptLab-Ausgabeziele-'))
          throw new Error('Der Testordner liegt außerhalb der erwarteten Tempwurzel.');
        rmSync(ordner, { recursive: true, force: true });
      }
    }, 60000);
  }
});
