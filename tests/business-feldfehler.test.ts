import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Blockly from 'blockly/core';
import { businessNachTyp, standardKonfiguration } from '../src/kern/business-katalog';
import {
  businessKonfigurationFeldfehler,
  businessKonfigurationPruefen,
} from '../src/kern/business-validierung';
import { workflowPruefen } from '../src/kern/modell';
import { businessTestProjekt } from './hilfen/business-projekt';
import { BusinessEigenschaften } from '../src/renderer/BusinessEigenschaften';
import { registriereBausteine } from '../src/editor/bausteine';

registriereBausteine();

describe('Belegte Feldbezüge für Quelle und Zuordnung', () => {
  it('ordnet die erforderliche Spalte der Datentypumwandlung dem tatsächlichen Spaltenfeld zu', () => {
    const definition = businessNachTyp.get('sl_biz_typ')!;
    const konfiguration = { ...standardKonfiguration(definition), spalte: '' };
    const fehler = businessKonfigurationFeldfehler(definition, konfiguration, []);
    expect(fehler.find((m) => m.text.includes('Spaltenname'))?.feldPfad).toEqual(['spalte']);
  });

  it('erhält bei Aggregatfehlern den ursprünglichen Zeilenindex und lässt Namenskonflikte ohne Einzelpfad', () => {
    const definition = businessNachTyp.get('sl_biz_gruppieren')!;
    const konfiguration = {
      ...standardKonfiguration(definition),
      schluessel: ['Region'],
      aggregate: [null, { funktion: 'SUMME', spalte: '', name: 'Region' }],
    };
    const fehler = businessKonfigurationFeldfehler(definition, konfiguration, []);
    expect(fehler.find((m) => m.text.includes('Wertspalte'))?.feldPfad).toEqual(['aggregate', '1', 'spalte']);
    const konflikt = fehler.find((m) => m.text.includes('eindeutige Namen'));
    expect(konflikt).toBeDefined();
    expect(konflikt?.feldPfad).toBeUndefined();
  });

  it('ordnet Prüfregelspalten zu und belässt den Vergleich zweier Grenzen beim Baustein', () => {
    const definition = businessNachTyp.get('sl_biz_pruefen')!;
    const fehler = businessKonfigurationFeldfehler(
      definition,
      {
        ...standardKonfiguration(definition),
        regeln: [
          {
            art: 'BEREICH',
            spalte: '',
            minimum: { art: 'wert', typ: 'ZAHL', wert: 5 },
            maximum: { art: 'wert', typ: 'ZAHL', wert: 3 },
          },
        ],
      },
      [],
    );
    expect(fehler.find((m) => m.text.includes('Geprüfte Spalte'))?.feldPfad).toEqual([
      'regeln',
      '0',
      'spalte',
    ]);
    const konflikt = fehler.find((m) => m.text.includes('Minimum einer Prüfregel'));
    expect(konflikt).toBeDefined();
    expect(konflikt?.feldPfad).toBeUndefined();
  });

  it('liefert erforderliche Pfadfelder strukturiert und erhält die bisherigen Prüfmeldungen', () => {
    const definition = businessNachTyp.get('sl_biz_lesen_csv')!;
    const konfiguration = { ...standardKonfiguration(definition), pfad: '' };
    const fehler = businessKonfigurationFeldfehler(definition, konfiguration, []);
    expect(fehler.some((m) => m.feldPfad?.join('.') === 'pfad')).toBe(true);
    expect(fehler.map((m) => m.text)).toEqual(businessKonfigurationPruefen(definition, konfiguration, []));
    const verweis = businessKonfigurationFeldfehler(
      definition,
      { ...konfiguration, pfad: { parameter: 'NichtDefiniert' } },
      [],
    );
    expect(verweis.find((m) => m.text.includes('definierten Workflowparameter'))?.feldPfad).toEqual(['pfad']);
  });

  it('erhält präzise Unterfeldpfade aus der Feldprüfung ohne Fehlermeldungen zu zerlegen', () => {
    const definition = businessNachTyp.get('sl_biz_lesen_csv')!;
    const fehler = businessKonfigurationFeldfehler(
      definition,
      {
        ...standardKonfiguration(definition),
        pfad: 'test.csv',
        optionen: { trennzeichen: ';', kopfzeile: 'ungültig' },
      },
      [],
    );
    expect(fehler.find((m) => m.text.includes('Ja oder Nein'))?.feldPfad).toEqual(['optionen', 'kopfzeile']);
  });

  it('lässt feldübergreifende Konflikte ohne erfundenen Einzelbezug', () => {
    const definition = businessNachTyp.get('sl_biz_kopieren')!;
    const fehler = businessKonfigurationFeldfehler(
      definition,
      {
        ...standardKonfiguration(definition),
        quelle: 'test.csv',
        ziel: 'test.csv',
      },
      [],
    );
    const konflikt = fehler.find((m) => m.text.includes('verschiedene Pfade'));
    expect(konflikt).toBeDefined();
    expect(konflikt?.feldPfad).toBeUndefined();
  });

  it('ordnet Modellfehler ausdrücklich Konfiguration oder Eingabereferenz zu', () => {
    const projekt = businessTestProjekt();
    const lesen = projekt.editor.blocks!.blocks[0].next!.block;
    const schreiben = lesen.next!.block;
    const daten = JSON.parse(lesen.data!);
    daten.konfiguration.pfad = '';
    lesen.data = JSON.stringify(daten);
    const ausgabe = JSON.parse(schreiben.data!);
    ausgabe.eingaben.tabelle.referenz = 'NichtVorhanden';
    schreiben.data = JSON.stringify(ausgabe);
    const meldungen = workflowPruefen(projekt).meldungen;
    expect(
      meldungen.some((m) => m.blockId === lesen.id && m.feldPfad?.join('.') === 'konfiguration.pfad'),
    ).toBe(true);
    expect(
      meldungen.some((m) => m.blockId === schreiben.id && m.feldPfad?.join('.') === 'eingaben.tabelle'),
    ).toBe(true);
  });

  it('stellt Zielcontainer und zugängliche Feldfehler am tatsächlichen Eingabefeld bereit', () => {
    const ws = new Blockly.Workspace();
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      const text = 'Wähle eine Quelldatei.';
      const html = renderToStaticMarkup(
        createElement(BusinessEigenschaften, {
          ws: ws as Blockly.WorkspaceSvg,
          block,
          parameter: [],
          gesperrt: false,
          geaendert: () => {},
          feldFehler: [{ feldPfad: ['konfiguration', 'pfad'], text }],
        }),
      );
      expect(html).toContain('data-konfig-pfad="[&quot;konfiguration&quot;,&quot;pfad&quot;]"');
      expect(html).toMatch(/<input[^>]+aria-invalid="true"[^>]+aria-describedby=/);
      expect(html).toContain(text);
    } finally {
      ws.dispose();
    }
  });

  it('öffnet weitere Einstellungen für einen präzisen Importfehler und erhält dessen Feldpfad', () => {
    const ws = new Blockly.Workspace();
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      const vorher = block.data;
      const text = 'Wähle für die Kopfzeile Ja oder Nein.';
      const html = renderToStaticMarkup(
        createElement(BusinessEigenschaften, {
          ws: ws as Blockly.WorkspaceSvg,
          block,
          parameter: [],
          gesperrt: false,
          geaendert: () => {},
          feldFehler: [{ feldPfad: ['konfiguration', 'optionen', 'kopfzeile'], text }],
        }),
      );
      expect(html).toContain('<details class="business-weitere" open="">');
      expect(html).toContain(
        'data-konfig-pfad="[&quot;konfiguration&quot;,&quot;optionen&quot;,&quot;kopfzeile&quot;]"',
      );
      expect(html).toMatch(/<input[^>]+type="checkbox"[^>]+aria-invalid="true"/);
      expect(html.split(text)).toHaveLength(2);
      expect(block.data).toBe(vorher);
    } finally {
      ws.dispose();
    }
  });
});
