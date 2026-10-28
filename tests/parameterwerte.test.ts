import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  parameterStandardwertVerwenden,
  parameterWertLesen,
  parameterWertePruefen,
  type WorkflowParameter,
} from '../src/kern/business-modell';
import { neuesProjekt } from '../src/kern/projekt';
import { testBereit } from '../src/gemeinsam/testlauf';
import { Datenbereich } from '../src/renderer/Datenbereich';

const anzahl: WorkflowParameter = {
  name: 'Anzahl',
  beschriftung: 'Anzahl',
  typ: 'Zahl',
  erforderlich: false,
  standard: 100,
  hilfe: '',
};

describe('Parameterwerte im Datenbereich', () => {
  it('unterscheidet geerbte Werte von ausdrücklich leer, Nein und Null', () => {
    expect(parameterWertLesen(anzahl, {})).toBe(100);
    expect(parameterWertLesen(anzahl, { Anzahl: null })).toBeNull();
    expect(parameterWertLesen(anzahl, { Anzahl: 0 })).toBe(0);
    expect(parameterWertLesen({ name: 'Freigabe', standard: true }, { Freigabe: false })).toBe(false);
    expect(parameterWertLesen({ name: 'Text', standard: 'Vorgabe' }, { Text: '' })).toBe('');
  });

  it('entfernt beim Zurücksetzen nur den eigenen Eintrag und erbt spätere Standardänderungen', () => {
    const werte = { Anzahl: null, AndereAngabe: 'bleibt' };
    const zurueckgesetzt = parameterStandardwertVerwenden(werte, 'Anzahl');
    expect(werte).toEqual({ Anzahl: null, AndereAngabe: 'bleibt' });
    expect(zurueckgesetzt).toEqual({ AndereAngabe: 'bleibt' });
    expect(Object.hasOwn(zurueckgesetzt, 'Anzahl')).toBe(false);
    expect(parameterWertLesen(anzahl, zurueckgesetzt)).toBe(100);
    expect(parameterWertLesen({ ...anzahl, standard: 200 }, zurueckgesetzt)).toBe(200);
    expect(parameterStandardwertVerwenden(zurueckgesetzt, 'Anzahl')).toBe(zurueckgesetzt);
    expect(parameterWertePruefen([anzahl], { Anzahl: null })).toEqual({ Anzahl: null });
    expect(parameterWertePruefen([anzahl], {})).toEqual({ Anzahl: 100 });
  });

  it('zeigt leere Zahl- und Ja/Nein-Überschreibungen tatsächlich leer und bietet den gezielten Reset', () => {
    const projekt = neuesProjekt('python');
    projekt.business.parameter = [
      anzahl,
      { ...anzahl, name: 'Freigabe', beschriftung: 'Freigabe', typ: 'Wahrheitswert', standard: true },
    ];
    projekt.business.parametersaetze.test = { Anzahl: null, Freigabe: null };
    const vorher = structuredClone(projekt);
    const nichts = () => {};
    const html = renderToStaticMarkup(
      createElement(Datenbereich, {
        projekt,
        workspace: null,
        auswaehlen: nichts,
        aendern: nichts,
        gesperrt: false,
        testZustand: testBereit(),
        vorschauLaden: nichts,
        parameterOeffnen: nichts,
      }),
    );
    expect(html).toMatch(/<input[^>]*value=""/);
    expect(html).not.toMatch(/<input[^>]*value="100"/);
    expect(html).toContain('<option value="" selected="">Bitte auswählen</option>');
    expect(html).not.toContain('<option value="ja" selected="">');
    expect(html).toContain('Wertoptionen für Anzahl: Ohne Wert');
    expect(html).toContain('Standardwert verwenden');
    expect(projekt).toEqual(vorher);
  });
});
