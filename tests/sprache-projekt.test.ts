import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { neuesProjekt, projektPruefen, type Projekt } from '../src/kern/projekt';
import { workflowPruefen } from '../src/kern/modell';
import { vbsErzeugen } from '../src/kern/generator';
import { projektLesen, projektSchreiben, skriptKodieren } from '../src/main/dateien';
import { Projektindex, Entwurfspeicher, dateistandLesen } from '../src/main/projektablage';

function namensProjekt(sprache: 'vbs' | 'python' = 'vbs'): Projekt {
  const p = neuesProjekt(sprache);
  p.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_set',
      id: 'setzen',
      fields: { VAR: 'Name' },
      inputs: { WERT: { block: { type: 'sl_text', id: 'text', fields: { TEXT: 'Testdaten ä' } } } },
      next: {
        block: {
          type: 'sl_output',
          id: 'ausgabe',
          inputs: { TEXT: { block: { type: 'sl_get', id: 'lesen', fields: { VAR: 'NAME' } } } },
        },
      },
    },
  };
  p.ansicht = { zoom: 1.25, x: -30, y: 80 };
  return p;
}

describe('Versionierte Sprache und stabile Variablen', () => {
  it.each(['vbs', 'python'] as const)('erstellt und erhält %s samt vollständigem Zustand', (sprache) => {
    const p = projektPruefen(namensProjekt(sprache));
    expect(p.schemaVersion).toBe(2);
    expect(p.skriptsprache).toBe(sprache);
    expect(projektPruefen(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(p.ansicht).toEqual({ zoom: 1.25, x: -30, y: 80 });
    expect(p.editor.blocks!.blocks[0].next!.block.id).toBe('setzen');
  });
  it('migriert nur fehlende alte Sprachangaben als VBS und behält Namensaliase', () => {
    const roh = { ...namensProjekt(), schemaVersion: 1 } as Record<string, unknown>;
    delete roh.skriptsprache;
    const p = projektPruefen(roh);
    expect(p.skriptsprache).toBe('vbs');
    expect(p.editor.variables).toHaveLength(1);
    const setzen = p.editor.blocks!.blocks[0].next!.block;
    expect(setzen.fields!.VAR).toEqual(setzen.next!.block.inputs!.TEXT.block!.fields!.VAR);
    expect(p.editor.variables![0].name).toBe('Name');
    expect(projektPruefen(roh)).toEqual(p);
  });
  it.each([undefined, null, 'PYTHON', 'powershell', '', 42])(
    'weist die beschädigte neue Sprache %s zurück',
    (skriptsprache) => {
      expect(() => projektPruefen({ ...neuesProjekt(), skriptsprache })).toThrow(/Scriptsprache/);
    },
  );
  it('weist fehlende Sprache im neuen Format und unbekannte Schemata zurück', () => {
    const p = { ...neuesProjekt() } as Record<string, unknown>;
    delete p.skriptsprache;
    expect(() => projektPruefen(p)).toThrow(/Scriptsprache/);
    expect(() => projektPruefen({ ...neuesProjekt(), schemaVersion: 3 })).toThrow(/neueren/);
    expect(() => projektPruefen({ ...neuesProjekt('python'), schemaVersion: 1 })).toThrow(/Projektformat 2/);
  });
  it('ordnet Variablen nach Identität zu und erhält die Zuordnung beim Umbenennen', () => {
    const p = projektPruefen(namensProjekt());
    const vorher = vbsErzeugen(p).code;
    const variable = p.editor.variables![0];
    const id = variable.id;
    variable.name = 'Neuer Name mit Umlauten ä';
    expect(vbsErzeugen(p).code).toBe(vorher);
    expect(workflowPruefen(p).workflow!.variablen).toEqual([id]);
  });
  it('verwechselt ähnlich geschriebene IDs nicht und lehnt beschädigte Verweise ab', () => {
    const p = projektPruefen(namensProjekt());
    p.editor.variables!.push({ name: 'Andere Variable', id: p.editor.variables![0].id.toUpperCase() });
    expect(projektPruefen(p).editor.variables).toHaveLength(2);
    p.editor.blocks!.blocks[0].next!.block.fields!.VAR = { id: 'nicht-vorhanden' };
    expect(() => projektPruefen(p)).toThrow(/unbekannte Variable/);
    const doppelt = projektPruefen(namensProjekt());
    doppelt.editor.variables!.push({ ...doppelt.editor.variables![0] });
    expect(() => projektPruefen(doppelt)).toThrow(/doppelte Kennungen/);
  });
  it('erhält eine unvollständige leere Variablenauswahl als Entwurf', () => {
    const p = namensProjekt();
    p.editor.blocks!.blocks[0].next!.block.fields!.VAR = '';
    expect(projektPruefen(p).editor.blocks!.blocks[0].next!.block.fields!.VAR).toBe('');
    expect(vbsErzeugen(p).code).toBeNull();
  });
  it('weist beschädigte Unicodekennungen zurück und erhält freie Texte als Daten', () => {
    const p = namensProjekt();
    p.editor.blocks!.blocks[0].id = String.fromCharCode(0xd800);
    expect(() => projektPruefen(p)).toThrow(/Kennung/);
    const text = namensProjekt();
    text.editor.blocks!.blocks[0].next!.block.inputs!.WERT.block!.fields!.TEXT = String.fromCharCode(0xd800);
    expect(projektPruefen(text).editor.blocks!.blocks[0].next!.block.inputs!.WERT.block!.fields!.TEXT).toBe(
      String.fromCharCode(0xd800),
    );
  });
  it('schreibt Python als UTF-8 ohne BOM und VBS weiterhin als UTF-16LE mit BOM', () => {
    const code = 'Grüße 😀\nZweite Zeile';
    const py = skriptKodieren(code, 'python');
    expect(py.toString('utf8')).toBe('Grüße 😀\r\nZweite Zeile');
    expect(py.subarray(0, 3).equals(Buffer.from([239, 187, 191]))).toBe(false);
    const vbs = skriptKodieren(code, 'vbs');
    expect(vbs.subarray(0, 2)).toEqual(Buffer.from([255, 254]));
    expect(vbs.subarray(2).toString('utf16le')).toBe('Grüße 😀\r\nZweite Zeile');
    expect(vbsErzeugen(neuesProjekt('python')).code).toBeNull();
  });
});

describe('Sprache in echten Projektdateien und Entwürfen', () => {
  let ordner: string;
  beforeEach(async () => {
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Sprachdaten-'));
  });
  afterEach(async () => {
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-Sprachdaten-')
    )
      throw Error('Unsicherer Testordner.');
    await rm(ordner, { recursive: true, force: true });
  });
  it('öffnet ein altes Projekt ohne dessen Bytes zu überschreiben', async () => {
    const p = { ...namensProjekt(), schemaVersion: 1 } as Record<string, unknown>;
    delete p.skriptsprache;
    const original = JSON.stringify(p);
    const pfad = join(ordner, 'Alt.scriptlab');
    await writeFile(pfad, original, 'utf8');
    expect((await projektLesen(pfad)).skriptsprache).toBe('vbs');
    expect(await readFile(pfad, 'utf8')).toBe(original);
  });
  it('erhält Python in Datei, Projektindex und wiederhergestelltem Entwurf', async () => {
    const pfad = join(ordner, 'Python.scriptlab');
    const p = projektPruefen(namensProjekt('python'));
    await projektSchreiben(pfad, p);
    expect(await projektLesen(pfad)).toEqual(p);
    const index = new Projektindex(join(ordner, 'index.json'));
    await index.initialisieren();
    await index.merken(pfad, await dateistandLesen(pfad), true);
    expect(index.lesen()[0].skriptsprache).toBe('python');
    const entwuerfe = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    entwuerfe.planen(p, pfad, null);
    await entwuerfe.flush();
    const neu = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    const liste = await neu.liste();
    expect(liste[0].skriptsprache).toBe('python');
    expect((await neu.lesen(liste[0].id)).projekt).toEqual(p);
  });
});
