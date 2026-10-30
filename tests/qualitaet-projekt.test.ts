import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, projektPruefen, type EditorBlock } from '../src/kern/projekt';
import { projektLesen, projektSchreiben, MAX_PROJEKT_BYTES } from '../src/main/dateien';
import { Entwurfspeicher } from '../src/main/projektablage';
import { skriptErzeugen } from '../src/kern/skript';
import { registriereBausteine } from '../src/editor/bausteine';
import { ablaufverbindungenVorLadenTrennen } from '../src/editor/bedienung';

function kette(anzahl: number) {
  const p = neuesProjekt('python');
  let aktuell = p.editor.blocks!.blocks[0];
  for (let i = 1; i < anzahl; i++) {
    aktuell.next = {
      block: { type: 'sl_comment', id: `schritt-${i}`, fields: { TEXT: `Schritt ${i}: Grüße` } },
    };
    aktuell = aktuell.next.block;
  }
  return p;
}

function verzweigterStand() {
  const projekt = neuesProjekt('python');
  const folge = (anzahl: number, zweig: string) => {
    const erster: EditorBlock = {
      type: 'sl_comment',
      id: `${zweig}-0`,
      fields: { TEXT: `${zweig} Schritt 0` },
    };
    let ende = erster;
    for (let i = 1; i < anzahl; i++) {
      ende.next = {
        block: { type: 'sl_comment', id: `${zweig}-${i}`, fields: { TEXT: `${zweig} Schritt ${i}` } },
      };
      ende = ende.next.block;
    }
    return erster;
  };
  projekt.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_if',
      id: 'verzweigung',
      inputs: {
        BEDINGUNG: { block: { type: 'sl_bool', id: 'bedingung', fields: { WERT: 'WAHR' } } },
        DANN: { block: folge(498, 'dann') },
        SONST: { block: folge(499, 'sonst') },
      },
    },
  };
  return projekt;
}

describe('Umfangreiche vorhandene Workflows', () => {
  it.each([50, 500, 1000])('erhält eine flache Kette mit %i Blöcken einschließlich Sprache und IDs', (n) => {
    const p = kette(n);
    const gelesen = projektPruefen(JSON.parse(JSON.stringify(p)));
    expect(JSON.stringify(gelesen)).toBe(JSON.stringify(p));
    for (const sprache of ['python', 'vbs'] as const) {
      gelesen.skriptsprache = sprache;
      const ergebnis = skriptErzeugen(gelesen);
      expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(ergebnis.code).toContain(`Schritt ${n - 1}: Grüße`);
    }
  });
  it.each([1001, 2000])(
    'weist %i Blöcke zum Schutz des Renderers verständlich und ohne Datenänderung ab',
    (anzahl) => {
      const projekt = kette(anzahl);
      const vorher = JSON.stringify(projekt);
      expect(() => projektPruefen(projekt)).toThrow(/höchstens 1000 Bausteine/);
      expect(() => projektPruefen(projekt)).toThrow(/Projektdatei bleibt unverändert/);
      expect(JSON.stringify(projekt)).toBe(vorher);
    },
  );

  it('erhält 1000 verzweigte Blöcke und beide Generatorergebnisse innerhalb der Gesamtgrenze', () => {
    const projekt = verzweigterStand();
    const gelesen = projektPruefen(JSON.parse(JSON.stringify(projekt)));
    expect(JSON.stringify(gelesen)).toBe(JSON.stringify(projekt));
    for (const sprache of ['python', 'vbs'] as const) {
      gelesen.skriptsprache = sprache;
      const ergebnis = skriptErzeugen(gelesen);
      expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(ergebnis.code).toContain('dann Schritt 497');
      expect(ergebnis.code).toContain('sonst Schritt 498');
    }
  });
  it('erhält Blockzahl-, Verschachtelungs- und Zyklusschutz', () => {
    const zuViele = verzweigterStand();
    zuViele.editor.blocks!.blocks.push({ type: 'sl_comment', id: 'zusaetzlich' });
    expect(() => projektPruefen(zuViele)).toThrow(/höchstens 1000 Bausteine/);
    const p = neuesProjekt();
    let aktuell = p.editor.blocks!.blocks[0];
    for (let i = 0; i < 152; i++) {
      const kind: EditorBlock = { type: 'sl_if', id: `innen-${i}` };
      aktuell.inputs = { DANN: { block: kind } };
      aktuell = kind;
    }
    expect(() => projektPruefen(p)).toThrow(/150 Ebenen/);
    const zyklus = kette(10);
    zyklus.editor.blocks!.blocks[0].next!.block.next = { block: zyklus.editor.blocks!.blocks[0] };
    expect(() => projektPruefen(zyklus)).toThrow(/doppelte/);
  });
  it('speichert und lädt 1000 Blöcke sowie deren Entwurf und erhält zu große Originaldateien', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Projektumfang-'));
    try {
      const p = verzweigterStand();
      p.ansicht = { zoom: 0.8, x: -50, y: 321 };
      const pfad = join(ordner, 'Workflow.scriptlab');
      await projektSchreiben(pfad, p);
      expect((await readFile(pfad)).byteLength).toBeLessThan(MAX_PROJEKT_BYTES);
      expect(JSON.stringify(await projektLesen(pfad))).toBe(JSON.stringify(p));
      const speicher = new Entwurfspeicher(join(ordner, 'entwuerfe'), 0);
      speicher.planen(p, null, null);
      const status = (await speicher.flush())!;
      expect(status.phase).toBe('gesichert');
      const entwurf = await speicher.lesen(status.id!);
      expect(JSON.stringify(entwurf.projekt)).toBe(JSON.stringify(p));
      const gespeichert = await readFile(pfad, 'utf8');
      for (const anzahl of [1001, 2000]) {
        const unzulaessig = join(ordner, `Zu-lang-${anzahl}.scriptlab`);
        const original = JSON.stringify(kette(anzahl));
        await writeFile(unzulaessig, original, 'utf8');
        await expect(projektLesen(unzulaessig)).rejects.toThrow(/höchstens 1000 Bausteine/);
        expect(await readFile(unzulaessig, 'utf8')).toBe(original);
        await expect(projektSchreiben(pfad, kette(anzahl))).rejects.toThrow(/höchstens 1000 Bausteine/);
        expect(await readFile(pfad, 'utf8')).toBe(gespeichert);
      }
    } finally {
      await rm(ordner, { recursive: true, force: true });
    }
  });
});

describe('Vollständiger Blockly-Projektwechsel bei langen Ketten', () => {
  it('trennt Folgen von unten nach oben und stellt die vorherige Ereignissperre wieder her', () => {
    const reihenfolge: number[] = [];
    const workspace = {
      getAllBlocks: () =>
        [1, 2, 3].map((nummer) => ({
          nextConnection: {
            isConnected: () => true,
            disconnect: () => {
              expect(Blockly.Events.isEnabled()).toBe(false);
              reihenfolge.push(nummer);
            },
          },
        })),
    } as unknown as Blockly.Workspace;
    ablaufverbindungenVorLadenTrennen(workspace);
    expect(reihenfolge).toEqual([3, 2, 1]);
    expect(Blockly.Events.isEnabled()).toBe(true);
    Blockly.Events.disable();
    try {
      ablaufverbindungenVorLadenTrennen(workspace);
      expect(Blockly.Events.isEnabled()).toBe(false);
    } finally {
      Blockly.Events.enable();
    }
    expect(Blockly.Events.isEnabled()).toBe(true);
  });

  it('stellt den Ereigniszustand auch bei fehlgeschlagener technischer Vortrennung wieder her', () => {
    const workspace = {
      getAllBlocks: () => {
        throw new Error('Technischer Lesefehler');
      },
    } as unknown as Blockly.Workspace;
    expect(() => ablaufverbindungenVorLadenTrennen(workspace)).toThrow('Technischer Lesefehler');
    expect(Blockly.Events.isEnabled()).toBe(true);
  });

  it('erhält eine echte 1000-Blockkette beim Neuladen und hinterlässt keine Trennereignisse im Undo', async () => {
    registriereBausteine();
    const workspace = new Blockly.Workspace();
    try {
      Blockly.Events.disable();
      try {
        const start = workspace.newBlock('sl_start', 'start');
        let ende = start;
        for (let i = 1; i < 1000; i++) {
          const block = workspace.newBlock('sl_comment', `wechsel-${i}`);
          block.setFieldValue(`Schritt ${i}: Grüße`, 'TEXT');
          ende.nextConnection!.connect(block.previousConnection!);
          ende = block;
        }
      } finally {
        Blockly.Events.enable();
      }
      const stand = Blockly.serialization.workspaces.save(workspace);
      const ids = workspace.getAllBlocks(false).map((b) => b.id);
      expect(ids).toHaveLength(1000);
      workspace.clearUndo();
      const ereignisse: Blockly.Events.Abstract[] = [];
      const merken = (ereignis: Blockly.Events.Abstract) => ereignisse.push(ereignis);
      workspace.addChangeListener(merken);
      ablaufverbindungenVorLadenTrennen(workspace);
      await new Promise((fertig) => setTimeout(fertig, 0));
      expect(ereignisse).toEqual([]);
      expect(workspace.getUndoStack()).toEqual([]);
      expect(workspace.getAllBlocks(false)).toHaveLength(1000);
      expect(workspace.getAllBlocks(false).every((b) => !b.getNextBlock())).toBe(true);
      workspace.removeChangeListener(merken);

      Blockly.serialization.workspaces.load(stand, workspace);
      expect(workspace.getAllBlocks(false).map((b) => b.id)).toEqual(ids);
      let block = workspace.getBlockById('start');
      for (let i = 1; i < 1000; i++) {
        block = block!.getNextBlock();
        expect(block?.id).toBe(`wechsel-${i}`);
        expect(block?.getFieldValue('TEXT')).toBe(`Schritt ${i}: Grüße`);
      }
      expect(block!.getNextBlock()).toBeNull();
      ablaufverbindungenVorLadenTrennen(workspace);
      workspace.clear();
      expect(workspace.getAllBlocks(false)).toEqual([]);
      Blockly.serialization.workspaces.load(stand, workspace);
      expect(workspace.getAllBlocks(false)).toHaveLength(1000);
    } finally {
      ablaufverbindungenVorLadenTrennen(workspace);
      workspace.dispose();
    }
    expect(workspace.getAllBlocks(false)).toEqual([]);
  }, 20000);
});
