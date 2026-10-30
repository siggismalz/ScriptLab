import { describe, it, expect } from 'vitest';
import { neuesProjekt, projektPruefen } from '../src/kern/projekt';
import { parameterWertePruefen } from '../src/kern/business-modell';
describe('Business-Projektformat', () => {
  it('ersetzt bewusst geleerte Parameter nie durch einen älteren Standardwert', () => {
    const p = {
      name: 'Anzahl',
      beschriftung: 'Anzahl',
      typ: 'Zahl' as const,
      erforderlich: true,
      standard: 5,
      hilfe: '',
    };
    expect(() => parameterWertePruefen([p], { Anzahl: null })).toThrow(/Fülle/);
    expect(parameterWertePruefen([{ ...p, erforderlich: false }], { Anzahl: null })).toEqual({
      Anzahl: null,
    });
    expect(() => parameterWertePruefen([p], { Anzahl: '5' })).toThrow(/gültige Zahl/);
    expect(parameterWertePruefen([p], { Anzahl: 6 })).toEqual({ Anzahl: 6 });
  });
  it('migriert alte Projekte ohne Veränderung der Verbindungen und Ansicht', () => {
    const p = neuesProjekt('python');
    const { business: _, workflowArt: _art, ...alt } = p;
    const neu = projektPruefen({ ...alt, schemaVersion: 2 });
    expect(neu.schemaVersion).toBe(4);
    expect(neu.skriptsprache).toBe('python');
    expect(neu.editor).toEqual(p.editor);
    expect(neu.ansicht).toEqual(p.ansicht);
    expect(neu.business.parameter).toEqual([]);
  });
  it('erhält Parameter und trennt Test- und Echtwerte', () => {
    const p = neuesProjekt('python');
    p.business.parameter.push({
      name: 'Eingang',
      beschriftung: 'Eingangsordner',
      typ: 'Datei',
      erforderlich: true,
      standard: null,
      hilfe: 'Nur lokale Daten.',
    });
    p.business.parametersaetze = { test: { Eingang: 'Testdaten' }, echt: { Eingang: 'Monatsdaten' } };
    expect(projektPruefen(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('weist unbekannte Daten und doppelte Parameter zurück', () => {
    const p = neuesProjekt('python');
    expect(() => projektPruefen({ ...p, business: { ...p.business, daten: [1, 2] } })).toThrow(/Parameter/);
    const v = {
      name: 'Pfad',
      beschriftung: 'Pfad',
      typ: 'Text',
      erforderlich: false,
      standard: '',
      hilfe: '',
    };
    expect(() =>
      projektPruefen({ ...p, business: { ...p.business, parameter: [v, { ...v, name: 'pfad' }] } }),
    ).toThrow(/Parameter/);
  });
});
