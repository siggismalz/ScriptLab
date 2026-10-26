import { mkdtemp, readFile, writeFile, rm, readdir, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { neuesProjekt, type EditorBlock } from '../../src/kern/projekt';
import { vbsErzeugen } from '../../src/kern/generator';
import { atomarSchreiben, projektLesen, projektSchreiben, vbsKodieren } from '../../src/main/dateien';

describe('Dateien erhalten und Workflows ausschliesslich als Daten verarbeiten', () => {
  it('veraendert beim Speichern, Laden und Exportieren keine beschriebenen Workflowdateien', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Ausfuehrungsgrenze-'));
    try {
      const quelle = join(ordner, 'Quelle ä.txt');
      const ziel = join(ordner, 'Ziel ö.txt');
      const protokoll = join(ordner, 'Protokoll.txt');
      const neuerOrdner = join(ordner, 'Vom Workflow geplanter Ordner');
      const vorher = new Map([
        [quelle, Buffer.from('Originalquelle\r\nNicht verschieben oder loeschen.', 'utf8')],
        [ziel, Buffer.from('Originalziel\r\nNicht ueberschreiben.', 'utf8')],
        [protokoll, Buffer.from('Originalprotokoll\r\nNicht ergaenzen.', 'utf8')],
      ]);
      for (const [pfad, inhalt] of vorher) await writeFile(pfad, inhalt);
      let zaehler = 0;
      const text = (inhalt: string): { block: EditorBlock } => ({
        block: { type: 'sl_text', id: `wert_${++zaehler}`, fields: { TEXT: inhalt } },
      });
      const folge: EditorBlock[] = [
        { type: 'sl_mkdir', id: 'ordner', inputs: { PFAD: text(neuerOrdner) } },
        {
          type: 'sl_copy',
          id: 'kopieren',
          fields: { ZIELREGEL: 'ERSETZEN' },
          inputs: { QUELLE: text(quelle), ZIEL: text(ziel) },
        },
        {
          type: 'sl_move',
          id: 'verschieben',
          fields: { ZIELREGEL: 'ERSETZEN' },
          inputs: { QUELLE: text(quelle), ZIEL: text(ziel) },
        },
        {
          type: 'sl_rename',
          id: 'umbenennen',
          inputs: { QUELLE: text(quelle), NAME: text('Umbenannt.txt') },
        },
        {
          type: 'sl_write_text',
          id: 'schreiben',
          fields: { KODIERUNG: 'UTF8' },
          inputs: { PFAD: text(ziel), TEXT: text('Darf beim Export nie geschrieben werden.') },
        },
        {
          type: 'sl_append_text',
          id: 'ergaenzen',
          fields: { KODIERUNG: 'UTF8' },
          inputs: { PFAD: text(protokoll), TEXT: text('Darf beim Export nie angehaengt werden.') },
        },
        { type: 'sl_delete', id: 'loeschen', fields: { RUECKFRAGE: 'JA' }, inputs: { PFAD: text(quelle) } },
      ];
      for (let i = 0; i < folge.length - 1; i++) folge[i].next = { block: folge[i + 1] };
      const projekt = neuesProjekt();
      projekt.name = 'Nur erstellen und exportieren';
      projekt.ansicht = { zoom: 1.25, x: -84, y: 128 };
      projekt.editor = {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'sl_start', id: 'start', x: 48, y: 72, next: { block: folge[0] } }],
        },
      };
      const projektdatei = join(ordner, 'Beispiel.scriptlab');
      await projektSchreiben(projektdatei, projekt);
      const geladen = await projektLesen(projektdatei);
      expect(geladen).toEqual(projekt);
      const erzeugt = vbsErzeugen(geladen);
      expect(erzeugt.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(erzeugt.code).not.toBeNull();
      const exportdatei = join(ordner, 'Beispiel.vbs');
      await atomarSchreiben(exportdatei, vbsKodieren(erzeugt.code!));
      const exportbytes = await readFile(exportdatei);
      expect(exportbytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]));
      expect(exportbytes.subarray(2).toString('utf16le')).toBe(erzeugt.code);
      for (const [pfad, inhalt] of vorher) expect(await readFile(pfad)).toEqual(inhalt);
      await expect(stat(neuerOrdner)).rejects.toMatchObject({ code: 'ENOENT' });
      expect((await readdir(ordner)).sort()).toEqual(
        ['Beispiel.scriptlab', 'Beispiel.vbs', 'Protokoll.txt', 'Quelle ä.txt', 'Ziel ö.txt'].sort(),
      );
    } finally {
      await rm(ordner, { recursive: true, force: true });
    }
  });

  it('erhaelt vorhandene Dateien bei Validierungs- und atomaren Schreibfehlern', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Speicherfehler-'));
    try {
      const datei = join(ordner, 'Erhalten.scriptlab');
      const original = Buffer.from('Vorhandene Datei bleibt unveraendert.', 'utf8');
      await writeFile(datei, original);
      const neueresProjekt = { ...neuesProjekt(), schemaVersion: 999 };
      await expect(projektSchreiben(datei, neueresProjekt as never)).rejects.toThrow(/neueren Dateiformat/);
      expect(await readFile(datei)).toEqual(original);
      const belegterPfad = join(ordner, 'Ist ein Ordner.scriptlab');
      await mkdir(belegterPfad);
      await expect(atomarSchreiben(belegterPfad, 'Kein gueltiges Ziel')).rejects.toBeDefined();
      expect((await stat(belegterPfad)).isDirectory()).toBe(true);
      expect((await readdir(ordner)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(ordner, { recursive: true, force: true });
    }
  });
});
