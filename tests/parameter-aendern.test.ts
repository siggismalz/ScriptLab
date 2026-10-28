import { describe, expect, it } from 'vitest';
import {
  parameterAenderungenVorbereiten,
  parameterVerweiseUmbenennen,
  type ParameterBearbeitung,
} from '../src/kern/parameterAendern';
import { leeresBusinessProjekt, type WorkflowParameter } from '../src/kern/business-modell';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import { parameterDialogPruefen } from '../src/renderer/ParameterDialog';

function parameter(name: string, standard: WorkflowParameter['standard'] = null): WorkflowParameter {
  return { name, beschriftung: name, typ: 'Text', erforderlich: false, standard, hilfe: '' };
}

function bearbeitung(ursprungsname: string | null, name: string): ParameterBearbeitung {
  return { ursprungsname, parameter: parameter(name) };
}

function businessBlock(id: string, optionen: unknown): EditorBlock {
  return {
    id,
    type: 'sl_biz_lesen_csv',
    fields: { NAME: 'Alt bleibt als Beschriftung erhalten' },
    data: JSON.stringify({ konfiguration: { pfad: 'Alt', optionen }, eingaben: {} }),
  };
}

describe('Sichere Parameterumbenennung', () => {
  it('verschiebt Test- und Echtwerte vor der Dialogprüfung und erhält 0, false und null', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('Anzahl'), parameter('Freigabe'), parameter('Leer')];
    business.parametersaetze = {
      test: { Anzahl: 0, Freigabe: false, Leer: null },
      echt: { Anzahl: 5, Freigabe: true, Leer: 'Wert' },
    };
    const vorher = structuredClone(business);
    const uebernahme = parameterAenderungenVorbereiten(business, [
      bearbeitung('Anzahl', 'Menge'),
      bearbeitung('Freigabe', 'Bestaetigung'),
      bearbeitung('Leer', 'Optional'),
    ]);
    expect(parameterDialogPruefen(uebernahme.business).parametersaetze).toEqual({
      test: { Menge: 0, Bestaetigung: false, Optional: null },
      echt: { Menge: 5, Bestaetigung: true, Optional: 'Wert' },
    });
    expect(uebernahme.umbenennungen).toEqual({ Anzahl: 'Menge', Freigabe: 'Bestaetigung', Leer: 'Optional' });
    expect(business).toEqual(vorher);
  });

  it('tauscht Namen simultan und verkettet die Wertverschiebung nicht', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A'), parameter('B'), parameter('C')];
    business.parametersaetze = { test: { A: 0, B: false, C: null }, echt: { A: 'a', B: 'b', C: 'c' } };
    const uebernahme = parameterAenderungenVorbereiten(business, [
      bearbeitung('A', 'B'),
      bearbeitung('B', 'C'),
      bearbeitung('C', 'A'),
    ]);
    expect(uebernahme.business.parametersaetze).toEqual({
      test: { B: 0, C: false, A: null },
      echt: { B: 'a', C: 'b', A: 'c' },
    });
    const tausch = parameterAenderungenVorbereiten(business, [
      bearbeitung('A', 'B'),
      bearbeitung('B', 'A'),
      bearbeitung('C', 'C'),
    ]);
    expect(tausch.business.parametersaetze.test).toEqual({ B: 0, A: false, C: null });
  });

  it('ordnet nach Löschen, Umordnen und Hinzufügen anhand des Ursprungsnamens zu', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('Entfernt'), parameter('Behalten'), parameter('Weiter')];
    business.parametersaetze = {
      test: { Entfernt: 'verwerfen', Behalten: false, Weiter: 0 },
      echt: { Entfernt: 'verwerfen', Behalten: null },
    };
    const uebernahme = parameterAenderungenVorbereiten(business, [
      bearbeitung('Weiter', 'Neu'),
      bearbeitung(null, 'Entfernt'),
      bearbeitung('Behalten', 'Behalten'),
    ]);
    expect(uebernahme.umbenennungen).toEqual({ Weiter: 'Neu' });
    expect(uebernahme.business.parametersaetze).toEqual({
      test: { Behalten: false, Neu: 0 },
      echt: { Behalten: null },
    });
    expect(Object.hasOwn(uebernahme.business.parametersaetze.test, 'Entfernt')).toBe(false);
  });

  it('erlaubt den bewusst freigegebenen Namen einer entfernten Zeile ohne deren alte Werte', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A'), parameter('B')];
    business.parametersaetze = { test: { A: false, B: 'gelöscht' }, echt: { A: null, B: 'gelöscht' } };
    const uebernahme = parameterAenderungenVorbereiten(business, [bearbeitung('A', 'B')]);
    expect(uebernahme.business.parametersaetze).toEqual({ test: { B: false }, echt: { B: null } });
  });

  it('weist doppelte endgültige Namen unabhängig von Großschreibung zurück', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A'), parameter('B')];
    expect(() =>
      parameterAenderungenVorbereiten(business, [bearbeitung('A', 'Neu'), bearbeitung('B', 'neu')]),
    ).toThrow('mehrfach verwendet');
    expect(() => parameterAenderungenVorbereiten(business, [bearbeitung('A', '1Neu')])).toThrow('Buchstaben');
  });

  it('verhindert doppelte oder unbekannte Ursprungszuordnungen', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A')];
    expect(() =>
      parameterAenderungenVorbereiten(business, [bearbeitung('A', 'B'), bearbeitung('A', 'C')]),
    ).toThrow('ursprüngliche Parameterzuordnung');
    expect(() => parameterAenderungenVorbereiten(business, [bearbeitung('Fehlt', 'B')])).toThrow(
      'ursprüngliche Parameterzuordnung',
    );
  });

  it('überschreibt auch unbekannte gespeicherte Zielwerte nicht still', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A')];
    business.parametersaetze = { test: { A: 0, B: 5 }, echt: {} };
    const vorher = structuredClone(business);
    expect(() => parameterAenderungenVorbereiten(business, [bearbeitung('A', 'B')])).toThrow('mehrere Werte');
    expect(business).toEqual(vorher);
  });

  it('behält ohne Umbenennung die bisherige Bereinigung unbekannter Satzwerte bei', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('A')];
    business.parametersaetze = { test: { A: false, a: 'alter unbekannter Wert' }, echt: { A: null } };
    const uebernahme = parameterAenderungenVorbereiten(business, [bearbeitung('A', 'A')]);
    expect(uebernahme.umbenennungen).toEqual({});
    expect(parameterDialogPruefen(uebernahme.business).parametersaetze).toEqual({
      test: { A: false },
      echt: { A: null },
    });
  });

  it('ändert nur exakte Verweisobjekte rekursiv, einschließlich deaktivierter und verschachtelter Blöcke', () => {
    const projekt = neuesProjekt('python');
    const block = businessBlock('verschachtelt', {
      direkt: { parameter: 'Alt' },
      liste: [{ inhalt: { parameter: 'Alt' } }],
      freierText: 'Alt',
      jsonText: '{"parameter":"Alt"}',
      zusatzdaten: { parameter: 'Alt', andererWert: true },
      andereSchreibweise: { parameter: 'alt' },
    });
    block.enabled = false;
    const schatten = businessBlock('schatten', { parameter: 'Alt' });
    const folge = businessBlock('folge', { parameter: 'Alt' });
    const normal: EditorBlock = { type: 'sl_print', id: 'normal', data: '{"parameter":"Alt"}' };
    projekt.editor.blocks!.blocks = [
      { ...normal, inputs: { ABLAUF: { block, shadow: schatten } }, next: { block: folge } },
      businessBlock('frei', { parameter: 'Alt' }),
    ];
    const vorher = structuredClone(projekt);
    const neu = parameterVerweiseUmbenennen(projekt, { Alt: 'Neu' });
    const erster = neu.editor.blocks!.blocks[0];
    const daten = JSON.parse(erster.inputs!.ABLAUF.block!.data!);
    expect(daten.konfiguration.optionen).toEqual({
      direkt: { parameter: 'Neu' },
      liste: [{ inhalt: { parameter: 'Neu' } }],
      freierText: 'Alt',
      jsonText: '{"parameter":"Alt"}',
      zusatzdaten: { parameter: 'Alt', andererWert: true },
      andereSchreibweise: { parameter: 'alt' },
    });
    expect(erster.data).toBe(normal.data);
    expect(erster.inputs!.ABLAUF.block!.fields).toEqual(block.fields);
    for (const b of [erster.inputs!.ABLAUF.shadow!, erster.next!.block, neu.editor.blocks!.blocks[1]])
      expect(JSON.parse(b.data!).konfiguration.optionen).toEqual({ parameter: 'Neu' });
    expect(neu.business).toEqual(projekt.business);
    expect(projekt).toEqual(vorher);
  });

  it('tauscht auch Projektverweise gleichzeitig statt sie erneut umzubenennen', () => {
    const projekt = neuesProjekt('python');
    projekt.editor.blocks!.blocks = [businessBlock('tausch', [{ parameter: 'A' }, { parameter: 'B' }])];
    const neu = parameterVerweiseUmbenennen(projekt, { A: 'B', B: 'A' });
    expect(JSON.parse(neu.editor.blocks!.blocks[0].data!).konfiguration.optionen).toEqual([
      { parameter: 'B' },
      { parameter: 'A' },
    ]);
  });

  it('lässt alte Projekte und Blockserialisierung ohne tatsächlichen Rename unverändert', () => {
    const projekt = neuesProjekt('vbs');
    projekt.editor.blocks!.blocks[0].data = 'alte Daten';
    expect(parameterVerweiseUmbenennen(projekt, {})).toBe(projekt);
    expect(parameterVerweiseUmbenennen(projekt, { Alt: 'Alt' })).toBe(projekt);
    expect(parameterVerweiseUmbenennen(projekt, { Alt: 'Neu' })).toBe(projekt);
    const business = businessBlock('unveraendert', { parameter: 'AndererName' });
    business.data = JSON.stringify(JSON.parse(business.data!), null, 2);
    projekt.editor.blocks!.blocks.push(business);
    expect(parameterVerweiseUmbenennen(projekt, { Alt: 'Neu' })).toBe(projekt);
    expect(projekt.editor.blocks!.blocks[1].data).toBe(business.data);
  });

  it('bricht bei beschädigten Businessdaten oder widersprüchlicher Zuordnung ohne Mutation ab', () => {
    const projekt = neuesProjekt('python');
    projekt.editor.blocks!.blocks = [
      businessBlock('gueltig', { parameter: 'Alt' }),
      businessBlock('kaputt', {}),
    ];
    projekt.editor.blocks!.blocks[1].data = '{kaputt';
    const vorher = structuredClone(projekt);
    expect(() => parameterVerweiseUmbenennen(projekt, { Alt: 'Neu' })).toThrow('beschädigt');
    expect(projekt).toEqual(vorher);
    expect(() => parameterVerweiseUmbenennen(projekt, { A: 'Neu', B: 'neu' })).toThrow('Mehrere Parameter');
  });
});
