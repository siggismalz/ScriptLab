import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { datenvorschauProjekt } from '../src/kern/datenvorschau';
import { skriptErzeugen } from '../src/kern/skript';
import type { Projekt } from '../src/kern/projekt';

const beispiel = (): Projekt =>
  JSON.parse(readFileSync('beispiele/business/A-Monatsauswertung/workflow.scriptlab', 'utf8'));
describe('Ausdrückliche Datenvorschau bis zum gewählten Schritt', () => {
  it('benötigt weder unvollständige Nachfolger noch deren Pflichtparameter und erhält das Original', () => {
    const p = beispiel();
    p.business.parameter.find((v) => v.name === 'PDF_Ziel')!.standard = '';
    p.business.parametersaetze.test.PDF_Ziel = '';
    const vorher = JSON.stringify(p);
    const kurz = datenvorschauProjekt(p, 'a-regionen');
    expect(JSON.stringify(p)).toBe(vorher);
    expect(kurz.business.parameter.map((v) => v.name)).toEqual(['Quelldatei', 'Berichtsmonat']);
    expect(skriptErzeugen(kurz).code).toBeTruthy();
    let b = kurz.editor.blocks!.blocks[0];
    while (b.next) b = b.next.block;
    expect(b.id).toBe('a-regionen');
    expect(JSON.stringify(kurz.editor)).not.toContain('a-xlsx');
  });
  it('weist Dateiaktionen als Vorschauziel ab', () => {
    expect(() => datenvorschauProjekt(beispiel(), 'a-xlsx')).toThrow(/Tabellenschritte|Tabelle/);
  });
  it('führt vor dem Ziel keine Grundbausteine oder verschachtelte Abläufe heimlich aus', () => {
    const p = beispiel();
    const start = p.editor.blocks!.blocks[0];
    start.next = {
      block: {
        id: 'dialog',
        type: 'sl_message',
        inputs: { TEXT: { block: { id: 'text', type: 'sl_text', fields: { TEXT: 'Testdaten' } } } },
        next: start.next,
      },
    };
    expect(() => datenvorschauProjekt(p, 'a-import')).toThrow(/Hauptablauf/);
  });
  it('meldet nicht verbundene oder deaktivierte Ziele konkret', () => {
    expect(() => datenvorschauProjekt(beispiel(), 'unbekannt')).toThrow(/Tabellenschritt/);
    const p = beispiel();
    p.editor.blocks!.blocks[0].next!.block.enabled = false;
    expect(() => datenvorschauProjekt(p, 'a-import')).toThrow(/aktiven/);
  });
});
