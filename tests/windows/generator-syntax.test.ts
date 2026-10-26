import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bausteinDefinitionen, type BausteinDefinition, type WertTyp } from '../../src/kern/katalog';
import { neuesProjekt, type EditorBlock } from '../../src/kern/projekt';
import { vbsErzeugen } from '../../src/kern/generator';

let naechsteId = 0;
const id = () => `syntax_${++naechsteId}`;
const text = (inhalt: string): EditorBlock => ({ type: 'sl_text', id: id(), fields: { TEXT: inhalt } });

function standardWert(typ: WertTyp, name: string): EditorBlock {
  if (typ === 'Boolean') return { type: 'sl_bool', id: id(), fields: { WERT: 'FALSCH' } };
  if (typ === 'Number') return { type: 'sl_number', id: id(), fields: { ZAHL: '1' } };
  if (typ === 'Array') return { type: 'sl_list', id: id() };
  return text(
    name === 'NAME'
      ? 'Neuer Name.txt'
      : name === 'PFAD' || name === 'QUELLE' || name === 'ZIEL'
        ? 'ScriptLab-Testdaten\\Datei mit Umlauten ä.txt'
        : 'Grüße "aus ScriptLab"\r\nNur Parserdaten.',
  );
}

function blockBauen(def: BausteinDefinition, abweichung: Record<string, string> = {}): EditorBlock {
  const block: EditorBlock = { type: def.typ, id: id(), fields: {}, inputs: {} };
  for (const feld of def.felder)
    block.fields![feld.name] =
      feld.name === 'VAR' ? 'Meine Variable' : (abweichung[feld.name] ?? feld.standard);
  for (const eingabe of def.eingaben) {
    block.inputs![eingabe.name] = {
      block:
        eingabe.typ === 'Statement'
          ? {
              type: 'sl_comment',
              id: id(),
              fields: { TEXT: 'Verschachtelter Ablauf. Keine Ausfuehrung im Test.' },
            }
          : standardWert(eingabe.typ, eingabe.name),
    };
  }
  return block;
}

describe.skipIf(process.platform !== 'win32')('Echter Windows-Parser fuer den Generator', () => {
  it('akzeptiert jeden Katalogblock und jede Auswahlvariante ohne Ausfuehrung', ({ skip }) => {
    naechsteId = 0;
    const projekt = neuesProjekt();
    const anweisungen: EditorBlock[] = [
      {
        type: 'sl_set',
        id: id(),
        fields: { VAR: 'Meine Variable' },
        inputs: { WERT: { block: { type: 'sl_list', id: id() } } },
      },
    ];
    const abgedeckt = new Set<string>();
    for (const def of bausteinDefinitionen) {
      abgedeckt.add(def.typ);
      if (def.form === 'start' || def.form === 'ende') continue;
      const varianten: Record<string, string>[] = [{}];
      for (const feld of def.felder)
        if (feld.art === 'auswahl') {
          for (const option of feld.optionen ?? [])
            if (option[1] !== feld.standard) varianten.push({ [feld.name]: option[1] });
        }
      for (const variante of varianten) {
        const block = blockBauen(def, variante);
        anweisungen.push(
          def.form === 'wert'
            ? {
                type: 'sl_set',
                id: id(),
                fields: { VAR: 'Parserwert' },
                inputs: { WERT: { block } },
              }
            : block,
        );
      }
    }
    anweisungen.push({ type: 'sl_end', id: id() });
    for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
    projekt.editor = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'sl_start', id: id(), next: { block: anweisungen[0] } }],
      },
    };
    const erzeugt = vbsErzeugen(projekt);
    expect(erzeugt.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(erzeugt.code).not.toBeNull();
    expect(abgedeckt.size).toBe(bausteinDefinitionen.length);
    const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Generator-Parser-'));
    try {
      const datei = join(ordner, 'Alle Bausteine.vbs');
      writeFileSync(datei, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(erzeugt.code!, 'utf16le')]));
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
          datei,
          '-AlsJson',
        ],
        {
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
        },
      );
      if (prozess.error) throw prozess.error;
      expect(prozess.stderr).toBe('');
      if (prozess.status === 2) skip('Die optionale Windows-VBScript-Komponente ist nicht verfuegbar.');
      const daten = JSON.parse(prozess.stdout.trim());
      expect(daten[0].ergebnis, prozess.stdout).toMatchObject({
        Status: 'gueltig',
        ZustandVorher: 5,
        ZustandNachher: 5,
        Ausfuehrungseintritte: 0,
      });
      expect(prozess.status).toBe(0);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 40_000);
});
