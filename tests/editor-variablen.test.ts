import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../src/editor/bausteine';
import {
  eigenschaftenLesen,
  eigenschaftSetzen,
  neueVariableAnlegen,
  variablenAntwortAusfuehren,
} from '../src/editor/eigenschaften';

registriereBausteine();
const workspaces: Blockly.Workspace[] = [];
function laden(varWert: string | { id: string }) {
  const ws = new Blockly.Workspace();
  workspaces.push(ws);
  Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load(
      {
        variables: [{ id: 'variable-id', name: 'Gemeinsamer Wert', type: '' }],
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'sl_set',
              id: 'zuweisung',
              fields: { VAR: varWert },
              inputs: { WERT: { block: { type: 'sl_text', id: 'wert', fields: { TEXT: 'Hallo' } } } },
            },
          ],
        },
      },
      ws,
    );
  } finally {
    Blockly.Events.enable();
  }
  ws.clearUndo();
  return ws;
}
afterEach(() => {
  for (const ws of workspaces.splice(0)) ws.dispose();
  Blockly.Events.setGroup(false);
  Blockly.dialog.setPrompt();
});

describe('Stabile Variablenfelder ohne zweite Namenswahrheit', () => {
  for (const vorher of ['', 'vorhandene-gruppe']) {
    it(`hält während der Namensabfrage keine neue Gruppe offen und erhält Cancel bei Vorgruppe '${vorher}'`, () => {
      const ws = laden({ id: 'variable-id' });
      let antwort: ((wert: string | null) => void) | null = null;
      Blockly.dialog.setPrompt((_text, _vorgabe, callback) => {
        antwort = callback;
      });
      Blockly.Events.setGroup(vorher || false);
      const zugeordnet = vi.fn();
      neueVariableAnlegen(ws as Blockly.WorkspaceSvg, 'zuweisung', 'VAR', zugeordnet);
      expect(antwort).toBeTypeOf('function');
      expect(Blockly.Events.getGroup()).toBe(vorher);
      variablenAntwortAusfuehren(() => antwort!(null));
      expect(Blockly.Events.getGroup()).toBe(vorher);
      expect(zugeordnet).not.toHaveBeenCalled();
      expect(ws.getVariableMap().getAllVariables()).toHaveLength(1);
      expect(ws.getBlockById('zuweisung')!.getFieldValue('VAR')).toBe('variable-id');
    });
  }
  it('stellt den Vorgruppenstatus auch nach einer fehlgeschlagenen Antwortverarbeitung wieder her', () => {
    Blockly.Events.setGroup('vorherige-gruppe');
    expect(() =>
      variablenAntwortAusfuehren(() => {
        throw new Error('Arbeitsbereich nicht mehr vorhanden');
      }),
    ).toThrow('Arbeitsbereich');
    expect(Blockly.Events.getGroup()).toBe('vorherige-gruppe');
  });
  it('wählt die Kennung und zeigt denselben Variablennamen in Block und Eigenschaften', () => {
    const ws = laden({ id: 'variable-id' });
    const block = ws.getBlockById('zuweisung')!;
    expect(block.getField('VAR')).toBeInstanceOf(Blockly.FieldVariable);
    expect(block.getFieldValue('VAR')).toBe('variable-id');
    expect(block.getField('VAR')!.getText()).toBe('Gemeinsamer Wert');
    const feld = eigenschaftenLesen(ws, 'zuweisung').find((f) => f.feldName === 'VAR')!;
    expect(feld).toMatchObject({
      art: 'variable',
      wert: 'variable-id',
      optionen: [{ text: 'Gemeinsamer Wert', wert: 'variable-id' }],
    });
    const variable = ws.getVariableMap().getVariableById('variable-id')!;
    ws.getVariableMap().renameVariable(variable, 'Neuer sichtbarer Name');
    expect(block.getFieldValue('VAR')).toBe('variable-id');
    expect(block.getField('VAR')!.getText()).toBe('Neuer sichtbarer Name');
    expect(() => eigenschaftSetzen(ws, 'zuweisung', 'VAR', 'Ein freier Name')).toThrow(/vorhandene Variable/);
  });
  it('erhält ein leeres altes Feld beim Laden und Speichern als ausdrücklich ungelösten Entwurf', () => {
    const ws = laden('');
    const block = ws.getBlockById('zuweisung')!;
    block.getField('VAR')!.initModel();
    expect(block.getFieldValue('VAR')).toBe('');
    expect(block.getField('VAR')!.getText()).toBe('Variable auswählen');
    expect(Blockly.serialization.blocks.save(block)!.fields!.VAR).toBe('');
    expect(eigenschaftenLesen(ws, block.id).find((f) => f.feldName === 'VAR')!.wert).toBe('');
  });
  it('löst ein leeres Feld nur durch eine tatsächliche ID-Wahl und erhält Rückgängig/Wiederholen', async () => {
    const ws = laden('');
    const block = ws.getBlockById('zuweisung')!;
    eigenschaftSetzen(ws, block.id, 'VAR', 'variable-id');
    await new Promise((fertig) => setTimeout(fertig, 0));
    expect(block.getFieldValue('VAR')).toBe('variable-id');
    expect(Blockly.serialization.workspaces.save(ws).blocks.blocks[0].fields.VAR).toEqual({
      id: 'variable-id',
    });
    ws.undo(false);
    expect(block.getFieldValue('VAR')).toBe('');
    expect(Blockly.serialization.blocks.save(block)!.fields!.VAR).toBe('');
    ws.undo(true);
    expect(block.getFieldValue('VAR')).toBe('variable-id');
  });
});
