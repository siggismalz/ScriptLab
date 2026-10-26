import { describe, it, expect } from 'vitest';
import {
  businessBlocklyDefinitionen,
  businessDefinitionen,
  standardKonfiguration,
  businessKonfigurationFuerLauf,
} from '../src/kern/business-katalog';
import { businessTestProjekt } from './hilfen/business-projekt';
import { skriptErzeugen } from '../src/kern/skript';
import { businessModusPruefen } from '../src/kern/business';
import { registriereBausteine } from '../src/editor/bausteine';
import * as Blockly from 'blockly/core';
describe('Gemeinsame Business-Codeerzeugung', () => {
  it('ordnet jedem angebotenen Baustein eine eindeutige Typkennung zu', () =>
    expect(new Set(businessDefinitionen.map((d) => d.typ)).size).toBe(businessDefinitionen.length));
  it('behandelt Formularwerte und Parameter als typisierte Daten', () => {
    expect(
      businessKonfigurationFuerLauf('daten.werte', {
        aktion: 'ERSETZEN',
        suchen: 'alt',
        ersatz: { parameter: 'NeuerText' },
      }),
    ).toMatchObject({
      suchen: { art: 'wert', typ: 'TEXT', wert: 'alt' },
      ersatz: { art: 'wert', typ: 'TEXT', wert: { parameter: 'NeuerText' } },
    });
    expect(
      businessKonfigurationFuerLauf('daten.pruefen', {
        regeln: [{ art: 'BEREICH', spalte: 'Zahl', minimum: { typ: 'GANZZAHL', wert: 0 } }],
      }),
    ).toMatchObject({ regeln: [{ minimum: { art: 'wert', typ: 'GANZZAHL', wert: 0 } }] });
  });
  it('erzeugt deterministische Pythonaufrufe mit Blockzuordnung und führt nichts aus', () => {
    const p = businessTestProjekt();
    const e = skriptErzeugen(p);
    expect(e.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(e.code).toContain('sl_business_schritt');
    expect(e.code).toContain('kontext_laden');
    expect(e.code).toBe(skriptErzeugen(p).code);
    expect(e.zeilenZuordnung.some((z) => z.blockId === 'schreiben')).toBe(true);
  });
  it('weist Business in VBS und Verweise auf spätere/wrongtyped Ergebnisse zurück', () => {
    const p = businessTestProjekt();
    p.skriptsprache = 'vbs';
    expect(skriptErzeugen(p).code).toBeNull();
    p.skriptsprache = 'python';
    p.editor.blocks!.blocks[0].next!.block.data = JSON.stringify({
      konfiguration: { format: 'CSV', pfad: 'q.csv', optionen: {} },
      eingaben: { unbekannt: { referenz: 'schreiben' } },
    });
    expect(skriptErzeugen(p).code).toBeNull();
  });
  it('führt gewöhnliche Anweisungen nie als Vorschau aus', () => {
    const p = businessTestProjekt();
    expect(() => businessModusPruefen(p, 'vorschau')).not.toThrow();
    p.editor.blocks!.blocks[0].next!.block.type = 'sl_mkdir';
    expect(() => businessModusPruefen(p, 'prueflauf')).toThrow(/ausschließlich Business/);
  });
  it('registriert jeden Businessblock über die echten Blockly-Schnittstellen', () => {
    registriereBausteine();
    const ws = new Blockly.Workspace();
    try {
      for (const def of businessBlocklyDefinitionen) {
        const b = ws.newBlock(def.typ);
        expect(b.type).toBe(def.typ);
        expect(b.getField('NAME')).toBeTruthy();
        const d = businessDefinitionen.find((d) => d.typ === def.typ)!;
        expect(Object.keys(standardKonfiguration(d))).toEqual(d.felder.map((f) => f.name));
      }
    } finally {
      ws.dispose();
    }
  });
});
