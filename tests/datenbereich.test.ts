import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Datenbereich } from '../src/renderer/Datenbereich';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import { businessTestProjekt } from './hilfen/business-projekt';

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
    expect(html).toContain('Der Workflow wurde seit dieser Vorschau geändert');
    expect(html).toContain('200 Vorschauzeilen geladen');
    expect(html).toContain('Zeile 50');
    expect(html).not.toContain('Zeile 51');
    expect(html).toContain('Seite 1 von 4');
  });
});
