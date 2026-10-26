import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../../src/editor/bausteine';
import { projektPruefen } from '../../src/kern/projekt';
import { vbsErzeugen } from '../../src/kern/generator';
import { uiTestprojekte, bausteineZaehlen, langerQuellpfad, langerZielpfad } from './fixtures';

describe('Reine Testdaten für die UI-Abnahme', () => {
  it('enthält einen realistischen Hauptablauf mit 28 Bausteinen und allen verlangten Funktionsgruppen', () => {
    const p = uiTestprojekte['01-Alltagsworkflow.scriptlab'];
    expect(bausteineZaehlen(p)).toBe(28);
    const code = vbsErzeugen(p);
    expect(code.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    for (const merkmal of ['InputBox', 'If ', 'For ', 'SL_Schreiben']) expect(code.code).toContain(merkmal);
  });
  it('bewahrt alle Testprojekte mit stabilen Kennungen im JSON-Rundlauf und in Blockly', () => {
    registriereBausteine();
    for (const p of Object.values(uiTestprojekte)) {
      const gelesen = projektPruefen(JSON.parse(JSON.stringify(p)));
      expect(gelesen).toEqual(p);
      const ws = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(gelesen.editor, ws);
        expect(ws.getAllBlocks(false)).toHaveLength(bausteineZaehlen(p));
      } finally {
        ws.dispose();
      }
    }
  });
  it('liefert für gültige Testzustände deterministischen VBS-Text und konkrete Fehler für den Entwurf', () => {
    for (const [name, p] of Object.entries(uiTestprojekte)) {
      const ergebnis = vbsErzeugen(p);
      if (name.startsWith('04-')) {
        expect(ergebnis.code).toBeNull();
        expect(ergebnis.meldungen.map((m) => m.blockId)).toEqual(
          expect.arrayContaining(['ui-fehlendes-ziel', 'ui-fehlender-text', 'ui-loser-kommentar']),
        );
      } else {
        expect(ergebnis.code).not.toBeNull();
        expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
        expect(vbsErzeugen(p).code).toBe(ergebnis.code);
      }
    }
  });
  it('verwendet erkennbare Testpfade und enthält lange vollständig erhaltene Werte', () => {
    const p = uiTestprojekte['03-Lange-Texte-und-Pfade.scriptlab'];
    expect(langerQuellpfad.length).toBeGreaterThan(180);
    expect(langerZielpfad.length).toBeGreaterThan(150);
    const json = JSON.stringify(p);
    expect(json).toContain(JSON.stringify(langerQuellpfad).slice(1, -1));
    expect(json).toContain(JSON.stringify(langerZielpfad).slice(1, -1));
    expect(p.exportOptionen.signieren).toBe(false);
    const signatur = uiTestprojekte['05-Signatur-ohne-Zertifikat.scriptlab'];
    expect(signatur.exportOptionen).toEqual({
      signieren: true,
      zertifikatFingerabdruck: '',
      zeitstempelUrl: '',
    });
  });
});
