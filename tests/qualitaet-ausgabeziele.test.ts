import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import { TestlaufDienst } from '../src/windows/testlauf';

describe.skipIf(process.platform !== 'win32')('CI-01: kurze Windows-Appdatenpfade', () => {
  it('kopiert mit identischer kurzer Wurzel und Basis trotz Langnamennormalisierung des Hosts', async () => {
    const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-CI01-Kurznamen-'));
    const verweis = join(ordner, 'Appdaten', 'Verknuepfung');
    try {
      const app = join(ordner, 'Appdaten');
      const basis = join(app, 'Arbeitsdateien', 'Workflow');
      mkdirSync(basis, { recursive: true });
      const quelle = join(ordner, 'Quelle.txt');
      writeFileSync(quelle, 'Eindeutige Quelldaten', 'utf8');
      const probe = join(ordner, 'kurzpfad.vbs');
      writeFileSync(
        probe,
        Buffer.concat([
          Buffer.from([255, 254]),
          Buffer.from(
            `Set f = CreateObject("Scripting.FileSystemObject")\r\nWScript.Echo f.GetFolder("${app.replaceAll('"', '""')}").ShortPath\r\n`,
            'utf16le',
          ),
        ]),
      );
      const ausgabe = join(ordner, 'kurzpfad.txt'),
        fehler = join(ordner, 'kurzpfad-fehler.txt');
      const stdout = openSync(ausgabe, 'w'),
        stderr = openSync(fehler, 'w');
      let ergebnis: ReturnType<typeof spawnSync>;
      try {
        ergebnis = spawnSync(
          join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cscript.exe'),
          ['//nologo', '//U', probe],
          { windowsHide: true, timeout: 5000, stdio: ['ignore', stdout, stderr] },
        );
      } finally {
        closeSync(stdout);
        closeSync(stderr);
      }
      if (ergebnis.error) throw ergebnis.error;
      expect(ergebnis.status, readFileSync(fehler, 'utf16le')).toBe(0);
      const kurzeWurzel = readFileSync(ausgabe, 'utf16le').trim();
      expect(kurzeWurzel).not.toBe('');
      let laufnummer = 0;
      const starten = async (
        typ: string,
        werte: Record<string, string>,
        felder: EditorBlock['fields'] = {},
      ) => {
        const projekt = neuesProjekt('vbs');
        projekt.editor.blocks!.blocks[0].next = {
          block: {
            id: 'aktion',
            type: typ,
            fields: felder,
            inputs: Object.fromEntries(
              Object.entries(werte).map(([name, TEXT]) => [
                name,
                { block: { id: name, type: 'sl_text', fields: { TEXT } } },
              ]),
            ),
          },
        };
        const dienst = new TestlaufDienst(
          resolve('artifacts/native/ScriptLab.Testhost.exe'),
          join(ordner, `Technik-${++laufnummer}`),
          undefined,
          undefined,
          undefined,
          kurzeWurzel,
        );
        dienst.starten(projekt, {
          basisVerzeichnis: join(kurzeWurzel, 'Arbeitsdateien', 'Workflow'),
          zeitlimitSekunden: 10,
        });
        const frist = Date.now() + 15000;
        while (dienst.aktiv() && Date.now() < frist) await new Promise((r) => setTimeout(r, 20));
        if (dienst.aktiv()) await dienst.stoppen();
        return dienst.lesen();
      };
      const kopieren = (ZIEL: string) =>
        starten('sl_copy', { QUELLE: quelle, ZIEL }, { ZIELREGEL: 'FEHLER' });
      const stand = await kopieren('Kopie.txt');
      expect(stand.phase, `${stand.meldung}\n${stand.technischeMeldung}`).toBe('beendet');
      expect(readFileSync(join(basis, 'Kopie.txt'), 'utf8')).toBe('Eindeutige Quelldaten');
      expect(readFileSync(quelle, 'utf8')).toBe('Eindeutige Quelldaten');
      const absolut = await kopieren(join(basis, 'Absolute Kopie.txt'));
      expect(absolut.phase, absolut.meldung).toBe('beendet');
      expect(readFileSync(join(basis, 'Absolute Kopie.txt'), 'utf8')).toBe('Eindeutige Quelldaten');
      const neuerOrdner = join(basis, 'Neue Struktur', 'Unterordner');
      const angelegt = await starten('sl_mkdir', { PFAD: neuerOrdner });
      expect(angelegt.phase, angelegt.meldung).toBe('beendet');
      expect(existsSync(neuerOrdner)).toBe(true);

      const fremd = join(ordner, 'Fremde Dateien'),
        nachbar = join(ordner, 'Appdaten-Nachbar');
      mkdirSync(fremd);
      mkdirSync(nachbar);
      symlinkSync(fremd, verweis, 'junction');
      for (const ziel of [
        join(fremd, 'Verboten.txt'),
        '..\\..\\..\\Traverse.txt',
        join(nachbar, 'Praefix.txt'),
        join(verweis, 'Junction.txt'),
      ]) {
        const abgelehnt = await kopieren(ziel);
        expect(abgelehnt.phase, abgelehnt.meldung).toBe('fehlgeschlagen');
        expect(abgelehnt.meldung).toMatch(/Appdatenordner|Windows-Verkn/);
      }
      expect(existsSync(join(fremd, 'Verboten.txt'))).toBe(false);
      expect(existsSync(join(ordner, 'Traverse.txt'))).toBe(false);
      expect(existsSync(join(nachbar, 'Praefix.txt'))).toBe(false);
      expect(existsSync(join(fremd, 'Junction.txt'))).toBe(false);
      expect(readFileSync(quelle, 'utf8')).toBe('Eindeutige Quelldaten');
    } finally {
      if (existsSync(verweis)) unlinkSync(verweis);
      if (dirname(ordner) !== resolve(tmpdir()) || !basename(ordner).startsWith('ScriptLab-CI01-Kurznamen-'))
        throw new Error('Unsicherer CI-01-Testordner.');
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 60000);
});
