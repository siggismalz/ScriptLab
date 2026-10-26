import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { projektPruefen, type Projekt } from '../src/kern/projekt';
import { vbsErzeugen } from '../src/kern/generator';
import { skriptErzeugen } from '../src/kern/skript';
import { registriereBausteine } from '../src/editor/bausteine';

const beispiele = readdirSync(resolve('beispiele'))
  .filter((name) => name.endsWith('.scriptlab'))
  .sort();
const testdatenVorherVorhanden = existsSync(resolve('ScriptLab-Testdaten'));
registriereBausteine();
describe('Sechs sichere Beispielprojekte', () => {
  it('liefert die drei Aufgaben in beiden Sprachen ausschließlich als Projektdateien', () => {
    expect(beispiele).toEqual([
      '01-Begruessung.scriptlab',
      '02-Datei-Backup.scriptlab',
      '03-Dateinamenliste.scriptlab',
      '04-Python-Begruessung.scriptlab',
      '05-Python-Datei-Backup.scriptlab',
      '06-Python-Dateinamenliste.scriptlab',
    ]);
    expect(readdirSync(resolve('beispiele')).some((name) => /\.(?:vbs|py)$/.test(name))).toBe(false);
  });
  for (const datei of beispiele)
    it(`${datei} lässt sich prüfen, laden und ausschließlich als Text erzeugen`, () => {
      const p = projektPruefen(JSON.parse(readFileSync(resolve('beispiele', datei), 'utf8')));
      const workspace = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(p.editor, workspace);
        const geladen = { ...p, editor: Blockly.serialization.workspaces.save(workspace) } as Projekt;
        const ergebnis = skriptErzeugen(geladen);
        expect(ergebnis.meldungen).toEqual([]);
        expect(ergebnis.code).not.toBeNull();
        expect(ergebnis.code).toContain(p.skriptsprache === 'vbs' ? 'Option Explicit' : 'def sl_haupt():');
        expect(skriptErzeugen(geladen).code).toBe(ergebnis.code);
        expect(skriptErzeugen(p).code).toBe(ergebnis.code);
        expect(p.exportOptionen.signieren).toBe(false);
      } finally {
        workspace.dispose();
      }
    });
  it('verwendet für Backup und Dateiliste ausschließlich eindeutige relative Testpfade', () => {
    for (const datei of beispiele.filter((datei) => !datei.includes('Begruessung'))) {
      const quelle = readFileSync(resolve('beispiele', datei), 'utf8');
      expect(quelle).toContain('ScriptLab-Testdaten');
      expect(quelle).not.toMatch(/[A-Z]:\\\\/);
      expect(quelle).not.toContain('%USERPROFILE%');
    }
    const backup = projektPruefen(JSON.parse(readFileSync(resolve('beispiele', beispiele[1]), 'utf8')));
    expect(vbsErzeugen(backup).code).toContain(', False, False');
    const liste = projektPruefen(JSON.parse(readFileSync(resolve('beispiele', beispiele[2]), 'utf8')));
    expect(vbsErzeugen(liste).code).toContain('SL_Dateiname(v_');
    expect(existsSync(resolve('ScriptLab-Testdaten'))).toBe(testdatenVorherVorhanden);
  });
});

describe.skipIf(process.platform !== 'win32')(
  'Windows-Parseprüfung der Beispielausgaben ohne Ausführung',
  () => {
    it('akzeptiert alle drei VBS-Ausgaben und bleibt im nicht ausführenden Parserzustand', ({ skip }) => {
      const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Beispiele-NurParser-'));
      try {
        for (const datei of beispiele) {
          const p = projektPruefen(JSON.parse(readFileSync(resolve('beispiele', datei), 'utf8')));
          if (p.skriptsprache !== 'vbs') continue;
          const erzeugt = vbsErzeugen(p);
          expect(erzeugt.code).not.toBeNull();
          const ausgabe = join(ordner, datei.replace('.scriptlab', '.vbs'));
          writeFileSync(
            ausgabe,
            Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(erzeugt.code!, 'utf16le')]),
          );
          const powershell = join(
            process.env.SystemRoot ?? 'C:\\Windows',
            'System32',
            'WindowsPowerShell',
            'v1.0',
            'powershell.exe',
          );
          const prozess = spawnSync(
            powershell,
            [
              '-NoProfile',
              '-NonInteractive',
              '-File',
              resolve('scripts/vbs-syntax-pruefen.ps1'),
              '-Datei',
              ausgabe,
              '-AlsJson',
            ],
            { encoding: 'utf8', timeout: 30_000, windowsHide: true },
          );
          if (prozess.error) throw prozess.error;
          if (prozess.status === 2) skip('Die optionale Windows-VBScript-Komponente ist nicht verfügbar.');
          expect(prozess.status, prozess.stderr + prozess.stdout).toBe(0);
          expect(JSON.parse(prozess.stdout.trim())[0].ergebnis).toMatchObject({
            Status: 'gueltig',
            ZustandVorher: 5,
            ZustandNachher: 5,
            Ausfuehrungseintritte: 0,
          });
        }
      } finally {
        rmSync(ordner, { recursive: true, force: true });
      }
    }, 100_000);
  },
);
