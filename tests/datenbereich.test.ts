import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Datenbereich } from '../src/renderer/Datenbereich';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import { businessTestProjekt } from './hilfen/business-projekt';
import type * as Blockly from 'blockly/core';
import { neuesProjekt } from '../src/kern/projekt';
import { businessDefinitionen, businessNachTyp } from '../src/kern/business-katalog';
import { workflowPruefen } from '../src/kern/modell';
import { fehlerFeldverweis } from '../src/renderer/daten-darstellung';

const nichts = () => {};
function darstellen(lauf: TestZustand, veraltet = false) {
  const projekt = businessTestProjekt();
  projekt.projektKennung = 'aktueller-workflow';
  return renderToStaticMarkup(
    createElement(Datenbereich, {
      projekt,
      workspace: null,
      blockId: 'lesen',
      auswaehlen: nichts,
      aendern: nichts,
      gesperrt: false,
      testZustand: lauf,
      veraltet,
      vorschauen: { lesen: { zustand: lauf, veraltet } },
      vorschauLaden: nichts,
      parameterOeffnen: nichts,
    }),
  );
}
function vorschau(kennung = 'aktueller-workflow'): TestZustand {
  return {
    ...testBereit(),
    projektKennung: kennung,
    projektName: 'Testdaten: Abrechnung',
    laufId: 'lauf-123',
    standHash: 'a'.repeat(64),
    phase: 'beendet',
    optionen: {
      basisVerzeichnis: 'C:\\Testdaten\\Eingang',
      zeitlimitSekunden: 15,
      business: {
        modus: 'vorschau',
        vorschauBlockId: 'lesen',
        parametersatz: 'test',
        parameter: {},
        speicherMB: 512,
        tempGB: 4,
        fortsetzen: false,
      },
    },
    business: {
      schritt: null,
      ereignisse: [],
      bericht: null,
      vorschau: { spalten: [{ name: 'Kundennummer', typ: 'VARCHAR' }], zeilen: [['001']], gekuerzt: false },
    },
  };
}

describe('Datenansicht mit echten Laufgrenzen', () => {
  it('überträgt Vorschauwerte eines anderen Workflows nicht in den aktuellen Arbeitskontext', () => {
    const lauf = vorschau('anderer-workflow');
    lauf.business!.vorschau!.zeilen = [['FREMDER-DATENBESTAND']];
    const html = darstellen(lauf);
    expect(html).not.toContain('FREMDER-DATENBESTAND');
    expect(html).toContain('Für diesen Schritt ist noch keine Datenvorschau geladen');
  });
  it('ordnet die lesende Vorschau dem tatsächlichen Lauf und Basisordner zu', () => {
    const html = darstellen(vorschau());
    expect(html).toContain('lauf-123');
    expect(html).toContain('C:\\Testdaten\\Eingang');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('Gesamtzahl der Quelldaten');
    expect(html).toContain('Schreibgeschützte Daten');
    expect(html).not.toContain('contenteditable');
  });
  it('unterscheidet einen fehlgeschlagenen Abruf ohne Blockzuordnung vom leeren Ergebnis', () => {
    const html = darstellen({
      ...testBereit(),
      projektKennung: 'aktueller-workflow',
      phase: 'fehlgeschlagen',
      optionen: vorschau().optionen,
      meldung: 'Die Testdatei wird von einem anderen Programm verwendet.',
    });
    expect(html).toContain('Die Testdatei wird von einem anderen Programm verwendet.');
    expect(html).toContain('sl-status--fehler');
    expect(html).not.toContain('Die geladene Vorschau enthält keine Zeilen.');
  });
  it('kennzeichnet einen überholten Datenstand und begrenzt die gerenderte Tabelle', () => {
    const lauf = vorschau();
    lauf.business!.vorschau!.zeilen = Array.from({ length: 200 }, (_, i) => [`Zeile ${i + 1}`]);
    const html = darstellen(lauf, true);
    expect(html).toContain('Workflow oder verwendete Parameter wurden seit dieser Vorschau geändert');
    expect(html).toContain('200 Vorschauzeilen geladen');
    expect(html).toContain('Zeile 50');
    expect(html).not.toContain('Zeile 51');
    expect(html).toContain('Seite 1 von 4');
  });
  it('zeigt verständliche Datentypen und lässt die tatsächlichen und unbekannten Typen zugänglich', () => {
    const lauf = vorschau();
    lauf.business!.vorschau!.spalten = [
      { name: 'Name', typ: 'VARCHAR' },
      { name: 'Anzahl', typ: 'BIGINT' },
      { name: 'Betrag', typ: 'DECIMAL(18,2)' },
      { name: 'Datum', typ: 'DATE' },
      { name: 'Sonderwert', typ: 'STRUCT(x INTEGER)' },
    ];
    lauf.business!.vorschau!.zeilen = [['Testdaten', 3, '12.50', '2026-10-28', 'Testwert']];
    const html = darstellen(lauf);
    expect(html).toContain('title="VARCHAR">Text</span>');
    expect(html).toContain('title="BIGINT">Ganze Zahl</span>');
    expect(html).toContain('title="DECIMAL(18,2)">Dezimalzahl</span>');
    expect(html).toContain('title="DATE">Datum</span>');
    expect(html).toContain('title="STRUCT(x INTEGER)">STRUCT(x INTEGER)</span>');
  });
  it('verweist kurz auf ein konkretes Listenfeld und bewahrt den Eintragskontext', () => {
    const def = businessNachTyp.get('sl_biz_sortieren')!;
    expect(fehlerFeldverweis(def, ['konfiguration', 'schluessel', '1', 'spalte'])).toEqual({
      kurz: 'Spalte · 2',
      titel: 'Sortierspalten · Eintrag 2 · Spalte',
    });
    expect(fehlerFeldverweis(def, ['eingaben', 'tabelle'])).toEqual({ kurz: 'Tabelle', titel: 'Tabelle' });
    expect(fehlerFeldverweis(def, ['konfiguration', 'unbekannt'])).toBeNull();
  });
  it('zeigt vollständige Feldfehler einmal am Feld und feldübergreifende Fehler weiter oben', () => {
    const projekt = neuesProjekt('python');
    const def = businessDefinitionen.find(
      (d) =>
        d.operation === 'dateien.aktion' &&
        d.felder.find((f) => f.name === 'aktion')?.standard === 'KOPIEREN',
    )!;
    const daten = JSON.stringify({
      konfiguration: {
        aktion: 'KOPIEREN',
        quelle: 'Testdaten.txt',
        ziel: 'Testdaten.txt',
        konflikt: 'UNGUELTIG',
      },
      eingaben: {},
    });
    projekt.editor.blocks!.blocks[0].next = { block: { type: def.typ, id: 'kopie', data: daten } };
    const block = {
      id: 'kopie',
      type: def.typ,
      data: daten,
      getFieldValue: () => def.name,
    } as unknown as Blockly.Block;
    const workspace = {
      getBlockById: () => block,
      getAllBlocks: () => [block],
      getVariableMap: () => ({ getAllVariables: () => [] }),
    } as unknown as Blockly.WorkspaceSvg;
    const meldungen = workflowPruefen(projekt).meldungen.filter((m) => m.blockId === 'kopie');
    const feldfehler = meldungen.find((m) => m.feldPfad?.join('.') === 'konfiguration.konflikt')!;
    const zusammenhang = meldungen.find((m) => !m.feldPfad)!;
    const html = renderToStaticMarkup(
      createElement(Datenbereich, {
        projekt,
        workspace,
        blockId: 'kopie',
        auswaehlen: nichts,
        aendern: nichts,
        gesperrt: false,
        testZustand: testBereit(),
        vorschauLaden: nichts,
        parameterOeffnen: nichts,
      }),
    );
    expect(html.split(feldfehler.text).length - 1).toBe(1);
    const zusammenfassung = html.match(/<div class="daten-konfigurationsfehler">([\s\S]*?)<\/div>/)![1];
    expect(zusammenfassung).toContain('2 Angaben prüfen');
    expect(zusammenfassung).toContain('Vorhandenes Ziel</button>');
    expect(zusammenfassung).not.toContain(feldfehler.text);
    expect(zusammenfassung).toContain(zusammenhang.text);
    const kopf = html.match(/<div class="daten-konfigurationskopf">([\s\S]*?)<\/div>/)![1];
    expect(kopf).toContain('Baustein anzeigen');
    expect(zusammenfassung).not.toContain('Baustein anzeigen');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('class="daten-schritttitel"');
  });
});
