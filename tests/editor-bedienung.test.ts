import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../src/editor/bausteine';
import {
  bausteinEinfuegen,
  bausteinVerschieben,
  einfuegestellenLesen,
  paletteZiehenStarten,
} from '../src/editor/bedienung';
import { businessQuelleVorbelegen } from '../src/editor/businessQuellen';
import { businessDatenLesen } from '../src/kern/business-katalog';
import { eigenschaftenLesen, eigenschaftSetzen } from '../src/editor/eigenschaften';
import { bausteinBeispiele } from '../src/editor/beispieleHilfe';
import { bausteinDefinitionen } from '../src/kern/katalog';

registriereBausteine();
const workspaces: Blockly.Workspace[] = [];
const arbeitsbereich = () => {
  const ws = new Blockly.Workspace();
  workspaces.push(ws);
  return ws;
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const stelle = (
  ws: Blockly.Workspace,
  quelle: string,
  blockId: string,
  art: 'nach' | 'eingang' = 'nach',
  eingang?: string,
) => {
  const ziel = einfuegestellenLesen(ws, quelle).find(
    (z) => z.blockId === blockId && z.art === art && z.eingang === eingang,
  );
  expect(ziel, 'Eine passende Einfügestelle muss angeboten werden').toBeDefined();
  return ziel!;
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const ws of workspaces.splice(0)) ws.dispose();
  Blockly.Events.setGroup(false);
});

describe('Passende Quellen beim neuen Einfügen', () => {
  const verbunden = (ws: Blockly.Workspace, vorher: Blockly.Block, typ: string) =>
    bausteinEinfuegen(ws, typ, stelle(ws, typ, vorher.id));
  const eingaben = (block: Blockly.Block) => businessDatenLesen(block.type, block.data ?? undefined).eingaben;

  it('verwendet das unmittelbar vorherige Tabellenergebnis und erhält Einfügen samt Zuordnung beim Rückgängig', async () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const quelle = verbunden(ws, start, 'sl_biz_lesen_csv');
    const filtern = verbunden(ws, quelle, 'sl_biz_filtern');
    expect(eingaben(filtern)).toEqual({ tabelle: { referenz: quelle.id } });
    await tick();
    ws.clearUndo();
    const gruppieren = verbunden(ws, filtern, 'sl_biz_gruppieren');
    const id = gruppieren.id;
    expect(eingaben(gruppieren)).toEqual({ tabelle: { referenz: filtern.id } });
    await tick();
    ws.undo(false);
    await tick();
    expect(ws.getBlockById(id)).toBeNull();
    expect(filtern.getNextBlock()).toBeNull();
    ws.undo(true);
    await tick();
    expect(filtern.getNextBlock()?.id).toBe(id);
    expect(eingaben(ws.getBlockById(id)!)).toEqual({ tabelle: { referenz: filtern.id } });
  });

  it('verwendet hinter einem anderen Baustein nur eine eindeutige sichere Quelle', () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const quelle = verbunden(ws, start, 'sl_biz_lesen_csv');
    const kommentar = verbunden(ws, quelle, 'sl_comment');
    const filtern = verbunden(ws, kommentar, 'sl_biz_filtern');
    expect(eingaben(filtern)).toEqual({ tabelle: { referenz: quelle.id } });
    const zweite = verbunden(ws, filtern, 'sl_biz_lesen_csv');
    const weitererKommentar = verbunden(ws, zweite, 'sl_comment');
    const mehrdeutig = verbunden(ws, weitererKommentar, 'sl_biz_gruppieren');
    expect(eingaben(mehrdeutig)).toEqual({});
  });

  it('ordnet Quellen innerhalb eines Zweigs zu und übernimmt sie nicht hinter dem Zweig', () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const wenn = verbunden(ws, start, 'sl_if');
    const quelle = bausteinEinfuegen(
      ws,
      'sl_biz_lesen_csv',
      stelle(ws, 'sl_biz_lesen_csv', wenn.id, 'eingang', 'DANN'),
    );
    const innen = verbunden(ws, quelle, 'sl_biz_filtern');
    const danach = verbunden(ws, wenn, 'sl_biz_gruppieren');
    expect(eingaben(innen)).toEqual({ tabelle: { referenz: quelle.id } });
    expect(eingaben(danach)).toEqual({});
  });

  it('trifft keine Wahl für zwei Eingabetabellen oder unverbundene neue Bausteine', () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const quelle = verbunden(ws, start, 'sl_biz_lesen_csv');
    const join = verbunden(ws, quelle, 'sl_biz_verknuepfen');
    const frei = bausteinEinfuegen(ws, 'sl_biz_filtern', { id: 'frei', art: 'frei', text: '' });
    expect(eingaben(join)).toEqual({});
    expect(eingaben(frei)).toEqual({});
  });

  it('lässt bestehende Zuordnungen, Laden und Verschieben unverändert', () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const quelle = verbunden(ws, start, 'sl_biz_lesen_csv');
    const leer = bausteinEinfuegen(ws, 'sl_biz_filtern', { id: 'frei', art: 'frei', text: '' });
    bausteinVerschieben(ws, leer.id, stelle(ws, leer.id, quelle.id));
    expect(eingaben(leer)).toEqual({});
    const kopie = arbeitsbereich();
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws), kopie);
    expect(eingaben(kopie.getBlockById(leer.id)!)).toEqual({});
    leer.data = JSON.stringify({
      konfiguration: {},
      eingaben: { tabelle: { referenz: 'bewusst-gewaehlt' } },
    });
    const vorher = leer.data;
    businessQuelleVorbelegen(leer);
    expect(leer.data).toBe(vorher);
  });

  it('hält die Quellenwahl beim neuen Ziehen in derselben Gruppe, auch wenn Blockly sie beim Loslassen beendet', async () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const quelle = verbunden(ws, start, 'sl_biz_lesen_csv');
    const dokument = new EventTarget();
    vi.stubGlobal('document', dokument);
    vi.stubGlobal('window', new EventTarget());
    class Zeiger extends Event {
      button = 0;
      pointerId = 1;
      constructor(
        typ: string,
        readonly clientX: number,
        readonly clientY: number,
      ) {
        super(typ, { cancelable: true });
      }
    }
    vi.stubGlobal('PointerEvent', Zeiger);
    const svgWorkspace = Object.assign(ws, {
      scrollX: 0,
      scrollY: 0,
      setResizesEnabled: vi.fn(),
      getParentSvg: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 500, bottom: 500 }) }),
    }) as unknown as Blockly.WorkspaceSvg;
    vi.spyOn(Blockly.utils.svgMath, 'screenToWsCoordinates').mockReturnValue(
      new Blockly.utils.Coordinate(0, 0),
    );
    vi.spyOn(Blockly.dragging.Dragger.prototype, 'onDragStart').mockImplementation(function (
      this: Blockly.dragging.Dragger,
    ) {
      return this['draggable'];
    });
    vi.spyOn(Blockly.dragging.Dragger.prototype, 'onDrag').mockImplementation(() => {});
    let eingefuegt: Blockly.Block | undefined;
    vi.spyOn(Blockly.dragging.Dragger.prototype, 'onDragEnd').mockImplementation(function (
      this: Blockly.dragging.Dragger,
    ) {
        eingefuegt = this['draggable'] as unknown as Blockly.Block;
      quelle.nextConnection!.connect(eingefuegt.previousConnection!);
      Blockly.Events.setGroup(false);
    });
    await tick();
    ws.clearUndo();
    paletteZiehenStarten(
      svgWorkspace,
      'sl_biz_gruppieren',
      new Zeiger('pointerdown', 10, 10) as PointerEvent,
    );
    dokument.dispatchEvent(new Zeiger('pointermove', 30, 30));
    dokument.dispatchEvent(new Zeiger('pointerup', 30, 30));
    expect(eingaben(eingefuegt!)).toEqual({ tabelle: { referenz: quelle.id } });
    expect(Blockly.Events.getGroup()).toBe('');
    const id = eingefuegt!.id;
    await tick();
    ws.undo(false);
    await tick();
    expect(ws.getBlockById(id)).toBeNull();
    ws.undo(true);
    await tick();
    expect(eingaben(ws.getBlockById(id)!)).toEqual({ tabelle: { referenz: quelle.id } });
  });
});

describe('Klickalternative zum Ziehen', () => {
  it('unterscheidet gleichartige Ziele durch lesbare Werte und eindeutige Nummern', () => {
    const ws = arbeitsbereich();
    const eins = bausteinEinfuegen(ws, 'sl_message', { id: 'frei', art: 'frei', text: '' });
    const zwei = bausteinEinfuegen(ws, 'sl_message', { id: 'frei', art: 'frei', text: '' });
    const namen = einfuegestellenLesen(ws, 'sl_comment')
      .filter((z) => [eins.id, zwei.id].includes(z.blockId ?? ''))
      .map((z) => z.text);
    expect(new Set(namen).size).toBe(2);
    expect(namen.every((n) => n.includes('Hallo') && !n.includes(eins.id) && !n.includes(zwei.id))).toBe(
      true,
    );
  });
  it('bietet passende Anschlüsse ohne Veränderung des Arbeitsbereichs an', async () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const bedingung = ws.newBlock('sl_if');
    start.nextConnection!.connect(bedingung.previousConnection!);
    const vorher = Blockly.serialization.workspaces.save(ws);
    const nachrichtenZiele = einfuegestellenLesen(ws, 'sl_message');
    expect(nachrichtenZiele).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blockId: start.id, text: 'Nach „Workflow starten“' }),
        expect.objectContaining({ blockId: bedingung.id, art: 'eingang', eingang: 'DANN' }),
      ]),
    );
    const wertZiele = einfuegestellenLesen(ws, 'sl_bool');
    expect(wertZiele.some((z) => z.blockId === bedingung.id && z.eingang === 'BEDINGUNG')).toBe(true);
    expect(wertZiele.some((z) => z.art === 'nach')).toBe(false);
    expect(Blockly.serialization.workspaces.save(ws)).toEqual(vorher);
    await tick();
  });

  it('fügt eine Anweisung zwischen zwei verbundene Blöcke ein und macht dies vollständig rückgängig', async () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const vorherigeNachricht = ws.newBlock('sl_message');
    start.nextConnection!.connect(vorherigeNachricht.previousConnection!);
    await tick();
    ws.clearUndo();
    const neu = bausteinEinfuegen(ws, 'sl_message', stelle(ws, 'sl_message', start.id));
    expect(start.getNextBlock()).toBe(neu);
    expect(neu.getNextBlock()).toBe(vorherigeNachricht);
    expect(neu.getInputTargetBlock('TEXT')?.type).toBe('sl_text');
    await tick();
    ws.undo(false);
    await tick();
    expect(start.getNextBlock()).toBe(vorherigeNachricht);
    expect(ws.getBlockById(neu.id)).toBeNull();
    ws.undo(true);
    await tick();
    expect(start.getNextBlock()?.id).toBe(neu.id);
    expect(start.getNextBlock()?.getNextBlock()?.id).toBe(vorherigeNachricht.id);
  });

  it('erhält beim Umordnen Vorgänger, Nachfolger und verschachtelte Abläufe', async () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const schleife = ws.newBlock('sl_repeat');
    const innen = ws.newBlock('sl_comment');
    const zweite = ws.newBlock('sl_message');
    const dritte = ws.newBlock('sl_comment');
    start.nextConnection!.connect(schleife.previousConnection!);
    schleife.nextConnection!.connect(zweite.previousConnection!);
    zweite.nextConnection!.connect(dritte.previousConnection!);
    schleife.getInput('ABLAUF')!.connection!.connect(innen.previousConnection!);
    await tick();
    ws.clearUndo();
    const ziele = einfuegestellenLesen(ws, schleife.id);
    expect(ziele.some((z) => z.blockId === innen.id)).toBe(false);
    expect(ziele.some((z) => z.blockId === schleife.id)).toBe(false);
    bausteinVerschieben(ws, schleife.id, stelle(ws, schleife.id, zweite.id));
    expect(start.getNextBlock()).toBe(zweite);
    expect(zweite.getNextBlock()).toBe(schleife);
    expect(schleife.getNextBlock()).toBe(dritte);
    expect(schleife.getInputTargetBlock('ABLAUF')).toBe(innen);
    await tick();
    ws.undo(false);
    await tick();
    expect(start.getNextBlock()).toBe(schleife);
    expect(schleife.getNextBlock()).toBe(zweite);
    expect(zweite.getNextBlock()).toBe(dritte);
    expect(schleife.getInputTargetBlock('ABLAUF')).toBe(innen);
  });

  it('fügt in einen vorhandenen verschachtelten Ablauf ein und erhält dessen Reihenfolge', () => {
    const ws = arbeitsbereich();
    const schleife = ws.newBlock('sl_repeat');
    const innen = ws.newBlock('sl_message');
    schleife.getInput('ABLAUF')!.connection!.connect(innen.previousConnection!);
    const neu = bausteinEinfuegen(
      ws,
      'sl_comment',
      stelle(ws, 'sl_comment', schleife.id, 'eingang', 'ABLAUF'),
    );
    expect(schleife.getInputTargetBlock('ABLAUF')).toBe(neu);
    expect(neu.getNextBlock()).toBe(innen);
  });

  it('blockiert Kreise, falsche Werttypen und Endblöcke vor einem vorhandenen Nachfolger ohne Zustandsverlust', () => {
    const ws = arbeitsbereich();
    const start = ws.newBlock('sl_start');
    const schleife = ws.newBlock('sl_repeat');
    const innen = ws.newBlock('sl_message');
    start.nextConnection!.connect(schleife.previousConnection!);
    schleife.getInput('ABLAUF')!.connection!.connect(innen.previousConnection!);
    expect(einfuegestellenLesen(ws, 'sl_end').some((z) => z.blockId === start.id)).toBe(false);
    expect(
      einfuegestellenLesen(ws, 'sl_bool').some((z) => z.blockId === schleife.id && z.eingang === 'ANZAHL'),
    ).toBe(false);
    const vorher = Blockly.serialization.workspaces.save(ws);
    expect(() =>
      bausteinVerschieben(ws, schleife.id, {
        id: `nach:${innen.id}`,
        art: 'nach',
        blockId: innen.id,
        text: 'Ungültiger Kreis',
      }),
    ).toThrow(/passt nicht/);
    expect(Blockly.serialization.workspaces.save(ws)).toEqual(vorher);
  });
});

describe('Eigenschaften aus dem echten Blockly-Zustand', () => {
  it('hat für jeden tatsächlich angebotenen Baustein ein konkretes deutsches Wirkungsbeispiel', () => {
    expect(Object.keys(bausteinBeispiele).sort()).toEqual(bausteinDefinitionen.map((b) => b.typ).sort());
    expect(Object.values(bausteinBeispiele).every((text) => text.length >= 45 && text.length < 320)).toBe(
      true,
    );
  });
  it('zeigt vollständige lange Pfade und verändert denselben Literalwert in beide Richtungen', () => {
    const ws = arbeitsbereich();
    const kopieren = bausteinEinfuegen(ws, 'sl_copy', { id: 'frei', art: 'frei', text: '' });
    const quelle = eigenschaftenLesen(ws, kopieren.id).find((e) => e.beschriftung === 'Quelldatei')!;
    expect(quelle.quellBlockId).toBe(kopieren.getInputTargetBlock('QUELLE')?.id);
    const pfad = 'C:\\Sehr langer deutscher Ordnername\\'.repeat(10) + 'Grüße "Leon".txt';
    eigenschaftSetzen(ws, quelle.quellBlockId, quelle.feldName, pfad);
    expect(kopieren.getInputTargetBlock('QUELLE')?.getFieldValue('TEXT')).toBe(pfad);
    expect(eigenschaftenLesen(ws, kopieren.id).find((e) => e.id === quelle.id)?.wert).toBe(pfad);
    kopieren.getInputTargetBlock('QUELLE')!.setFieldValue('Anderer Pfad', 'TEXT');
    expect(eigenschaftenLesen(ws, kopieren.id).find((e) => e.id === quelle.id)?.wert).toBe('Anderer Pfad');
  });

  it('respektiert eine vorhandene Eingabegruppe und bietet gültige Auswahlwerte', async () => {
    const ws = arbeitsbereich();
    const block = ws.newBlock('sl_delete');
    const auswahl = eigenschaftenLesen(ws, block.id).find((e) => e.feldName === 'RUECKFRAGE')!;
    expect(auswahl.optionen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ wert: 'JA' }),
        expect.objectContaining({ wert: 'NEIN' }),
      ]),
    );
    await tick();
    ws.clearUndo();
    Blockly.Events.setGroup('formular-eingabe');
    eigenschaftSetzen(ws, block.id, 'RUECKFRAGE', 'NEIN');
    expect(Blockly.Events.getGroup()).toBe('formular-eingabe');
    expect(() => eigenschaftSetzen(ws, block.id, 'RUECKFRAGE', 'Befehl ausführen')).toThrow(/angebotenen/);
    expect(block.getFieldValue('RUECKFRAGE')).toBe('NEIN');
    Blockly.Events.setGroup(false);
    await tick();
    ws.undo(false);
    await tick();
    expect(block.getFieldValue('RUECKFRAGE')).toBe('JA');
  });

  it('prüft Zahlenfelder ohne heimliches Clamping und erhält mehrzeiligen Benutzertext', () => {
    const ws = arbeitsbereich();
    const runden = ws.newBlock('sl_round');
    const text = ws.newBlock('sl_text');
    const vorher = runden.getFieldValue('STELLEN');
    expect(() => eigenschaftSetzen(ws, runden.id, 'STELLEN', '999')).toThrow(/ganze Zahl/);
    expect(runden.getFieldValue('STELLEN')).toBe(vorher);
    eigenschaftSetzen(ws, text.id, 'TEXT', 'Erste Zeile\r\nZweite Zeile');
    expect(eigenschaftenLesen(ws, text.id)[0].wert).toBe('Erste Zeile\r\nZweite Zeile');
  });
});
