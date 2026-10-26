import { afterEach, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../src/editor/bausteine';
import { bausteinEinfuegen, bausteinVerschieben, einfuegestellenLesen } from '../src/editor/bedienung';
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
  for (const ws of workspaces.splice(0)) ws.dispose();
  Blockly.Events.setGroup(false);
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
