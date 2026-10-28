import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import {
  BlockDatenEreignis,
  ParameterEreignis,
  parameterEreignisAnmelden,
} from '../src/editor/parameterEreignis';
import { registriereBausteine } from '../src/editor/bausteine';
import { leeresBusinessProjekt, type BusinessProjekt } from '../src/kern/business-modell';

registriereBausteine();
const tick = () => new Promise<void>((fertig) => setTimeout(fertig, 0));

function business(name: string, wert: number | boolean | null): BusinessProjekt {
  return {
    ...leeresBusinessProjekt(),
    parameter: [{ name, beschriftung: name, typ: 'Text', standard: null, erforderlich: false, hilfe: '' }],
    parametersaetze: { test: { [name]: wert }, echt: { [name]: null } },
  };
}

describe('Gemeinsames Rückgängig für Parameter und Blockverweise', () => {
  it('stellt Definitionen, Test-/Echtwerte und Blockdaten in einer Blockly-Gruppe wieder her', async () => {
    const ws = new Blockly.Workspace();
    const vorher = business('Alt', false);
    const nachher = business('Neu', false);
    let stand = structuredClone(nachher);
    const abmelden = parameterEreignisAnmelden(ws.id, (wert) => {
      stand = wert;
    });
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      block.setFieldValue('Vorher', 'NAME');
      const daten = (name: string) =>
        JSON.stringify({ konfiguration: { pfad: { parameter: name } }, eingaben: {} });
      block.data = daten('Alt');
      await tick();
      ws.clearUndo();
      Blockly.Events.setGroup(true);
      try {
        const vorherigeDaten = block.data;
        block.data = daten('Neu');
        Blockly.Events.fire(new BlockDatenEreignis(block, vorherigeDaten, block.data));
        block.setFieldValue('Nachher', 'NAME');
        Blockly.Events.fire(new ParameterEreignis(ws, vorher, nachher));
      } finally {
        Blockly.Events.setGroup(false);
      }
      await tick();
      ws.undo(false);
      await tick();
      expect(stand).toEqual(vorher);
      expect(block.data).toBe(daten('Alt'));
      expect(block.getFieldValue('NAME')).toBe('Vorher');
      ws.undo(true);
      await tick();
      expect(stand).toEqual(nachher);
      expect(block.data).toBe(daten('Neu'));
      expect(block.getFieldValue('NAME')).toBe('Nachher');
      ws.undo(false);
      await tick();
      expect(stand).toEqual(vorher);
      expect(block.data).toBe(daten('Alt'));
    } finally {
      abmelden();
      ws.dispose();
    }
  });

  it('serialisiert geprüfte Snapshots und ordnet sie ausschließlich dem Zielarbeitsbereich zu', () => {
    const quelle = new Blockly.Workspace();
    const ziel = new Blockly.Workspace();
    let quellAufrufe = 0;
    const empfangen: BusinessProjekt[] = [];
    const abmeldenQuelle = parameterEreignisAnmelden(quelle.id, () => {
      quellAufrufe++;
    });
    const abmeldenZiel = parameterEreignisAnmelden(ziel.id, (wert) => {
      empfangen.push(wert);
    });
    try {
      const vorher = business('Alt', 0);
      const nachher = business('Neu', 0);
      const ereignis = new ParameterEreignis(quelle, vorher, nachher);
      vorher.parametersaetze.test.Alt = 99;
      const json = ereignis.toJson();
      const wiederhergestellt = Blockly.Events.fromJson(json, ziel);
      expect(wiederhergestellt).toBeInstanceOf(ParameterEreignis);
      json.vorher.parametersaetze.test.Alt = 77;
      wiederhergestellt.run(false);
      expect(empfangen[0].parametersaetze.test.Alt).toBe(0);
      empfangen[0].parametersaetze.test.Alt = 66;
      wiederhergestellt.run(false);
      expect(empfangen[1].parametersaetze.test.Alt).toBe(0);
      wiederhergestellt.run(true);
      expect(empfangen[2]).toEqual(nachher);
      expect(quellAufrufe).toBe(0);
      abmeldenZiel();
      expect(() => wiederhergestellt.run(false)).toThrow('nicht mehr zugeordnet');
    } finally {
      abmeldenQuelle();
      abmeldenZiel();
      quelle.dispose();
      ziel.dispose();
    }
  });

  it('erkennt unveränderte Metadaten und lässt alte Cleanup-Aufrufe neue Empfänger nicht entfernen', () => {
    const ws = new Blockly.Workspace();
    const altAbmelden = parameterEreignisAnmelden(ws.id, () => {});
    let stand: BusinessProjekt | undefined;
    const neuAbmelden = parameterEreignisAnmelden(ws.id, (wert) => {
      stand = wert;
    });
    try {
      altAbmelden();
      const vorher = business('Alt', null);
      const nachher = business('Neu', null);
      expect(new ParameterEreignis(ws, vorher, structuredClone(vorher)).isNull()).toBe(true);
      new ParameterEreignis(ws, vorher, nachher).run(true);
      expect(stand).toEqual(nachher);
      expect(new ParameterEreignis().isNull()).toBe(true);
      expect(() => new ParameterEreignis().toJson()).toThrow('vollständigen');
    } finally {
      neuAbmelden();
      ws.dispose();
    }
  });

  it('stellt Blockdatenereignisse aus JSON wieder her und erhält einen leeren Ausgangswert', () => {
    const ws = new Blockly.Workspace();
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      const wert = JSON.stringify({ konfiguration: { pfad: { parameter: 'Neu' } }, eingaben: {} });
      const ereignis = new BlockDatenEreignis(block, null, wert);
      const wiederhergestellt = Blockly.Events.fromJson(ereignis.toJson(), ws);
      expect(wiederhergestellt).toBeInstanceOf(BlockDatenEreignis);
      wiederhergestellt.run(true);
      expect(block.data).toBe(wert);
      wiederhergestellt.run(false);
      expect(block.data).toBeNull();
      expect(new BlockDatenEreignis(block, null, null).isNull()).toBe(true);
    } finally {
      ws.dispose();
    }
  });
});
