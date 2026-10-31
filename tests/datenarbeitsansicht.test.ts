import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Datenbereich } from '../src/renderer/Datenbereich';
import { csvTrennzeichenHinweis, vorschauSpaltenbreite } from '../src/renderer/daten-darstellung';
import type { BusinessSchritt } from '../src/kern/business-modell';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import { businessTestProjekt } from './hilfen/business-projekt';

function csv(optionen: BusinessSchritt['konfiguration']['optionen'] = { trennzeichen: ';' }) {
  return { operation: 'daten.importieren', konfiguration: { format: 'CSV', optionen } };
}
const einzeln = (name: string) => [{ name }];

describe('CSV-Hinweis ohne Änderung des Importvertrags', () => {
  it.each([',', '\t', '|'])(
    'erkennt eine mehrteilige einzelne Kopfzeile mit %j als prüfenswert',
    (zeichen) => {
      expect(
        csvTrennzeichenHinweis(csv(), einzeln(['Kundennummer', 'Name', 'Umsatz'].join(zeichen))),
      ).toEqual({ eingestellt: ';', auffaellig: zeichen });
    },
  );
  it('meldet nur die tatsächliche literale CSV-Konfiguration, keine Vermutung bei Bindungen', () => {
    const name = einzeln('Nummer;Name;Umsatz');
    expect(csvTrennzeichenHinweis(csv({ trennzeichen: ',' }), name)).toEqual({
      eingestellt: ',',
      auffaellig: ';',
    });
    expect(csvTrennzeichenHinweis(csv({ trennzeichen: { parameter: 'Trenner' } }), name)).toBeNull();
    expect(csvTrennzeichenHinweis(csv({ trennzeichen: ',', kopfzeile: false }), name)).toBeNull();
    expect(csvTrennzeichenHinweis(csv(null), name)).toBeNull();
  });
  it('deutet normale Namen, mehrere Spalten, andere Formate und Folgeschritte nicht als CSV-Fehler', () => {
    expect(csvTrennzeichenHinweis(csv(), einzeln('Name, Vorname'))).toBeNull();
    expect(csvTrennzeichenHinweis(csv(), einzeln('Name,,Betrag'))).toBeNull();
    expect(csvTrennzeichenHinweis(csv(), einzeln('Name;Vorname;Betrag'))).toBeNull();
    expect(csvTrennzeichenHinweis(csv(), [{ name: 'Name,Vorname,Betrag' }, { name: 'Weitere' }])).toBeNull();
    expect(
      csvTrennzeichenHinweis({ operation: 'daten.sortieren', konfiguration: {} }, einzeln('A,B,C')),
    ).toBeNull();
    expect(
      csvTrennzeichenHinweis(
        { operation: 'daten.importieren', konfiguration: { format: 'XLSX' } },
        einzeln('A,B,C'),
      ),
    ).toBeNull();
    expect(csvTrennzeichenHinweis(undefined, einzeln('A,B,C'))).toBeNull();
  });
});

describe('Spalten als lesbare Arbeitsfläche', () => {
  it('gibt langen Namen maßvoll Platz und erhält ausdrücklich gesetzte Breiten', () => {
    expect(vorschauSpaltenbreite('ID')).toBe(176);
    expect(vorschauSpaltenbreite('Deutsche Bezeichnung mit sehr langer Kopfzeile')).toBe(320);
    expect(vorschauSpaltenbreite('ID', 480)).toBe(480);
    expect(vorschauSpaltenbreite('ID', 12)).toBe(96);
    expect(vorschauSpaltenbreite('ID', 800)).toBe(640);
    expect(vorschauSpaltenbreite('constructor', Number.NaN)).toBe(176);
  });
});

function ansicht({
  veraltet = false,
  fehler = false,
  gekuerzt = false,
  phase,
  fremderLauf = false,
  gesperrt = false,
  zeilenanzahl = 1,
}: {
  veraltet?: boolean;
  fehler?: boolean;
  gekuerzt?: boolean;
  phase?: TestZustand['phase'];
  fremderLauf?: boolean;
  gesperrt?: boolean;
  zeilenanzahl?: number;
} = {}) {
  const projekt = businessTestProjekt();
  const vorher = structuredClone(projekt);
  let aenderungen = 0;
  let laeufe = 0;
  const lauf: TestZustand = {
    ...testBereit(),
    projektKennung: fremderLauf ? 'anderer-workflow' : (projekt.projektKennung ?? null),
    projektName: projekt.name,
    laufId: 'lauf-datenansicht',
    standHash: '1'.repeat(64),
    phase: phase ?? (fehler ? 'fehlgeschlagen' : 'beendet'),
    meldung: fehler ? 'Die Quelle konnte nicht gelesen werden. Prüfe den Dateipfad.' : '',
    optionen: {
      basisVerzeichnis: 'C:\\Synthetische Daten\\Langer Arbeitsordner',
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
      vorschau: {
        spalten: [{ name: 'Kundennummer,Deutsche Kundenbezeichnung,Umsatz', typ: 'VARCHAR' }],
        zeilen: Array.from({ length: zeilenanzahl }, () => ['001,Beispiel,12.50']),
        gekuerzt,
      },
    },
  };
  const html = renderToStaticMarkup(
    createElement(Datenbereich, {
      projekt,
      workspace: null,
      blockId: 'lesen',
      auswaehlen: () => {},
      aendern: () => {
        aenderungen++;
      },
      gesperrt,
      testZustand: lauf,
      vorschauLaden: () => {
        laeufe++;
      },
      parameterOeffnen: () => {},
      vorschauen: { lesen: { zustand: lauf, veraltet } },
      parametersatzWaehlen: () => {},
    }),
  );
  return { html, projekt, vorher, aenderungen, laeufe };
}

describe('Datenansicht mit bestehender Ausführungsgrenze', () => {
  it('ordnet die bewusste Vorschauaktion zusammen und hält bestehende Tabnamen erreichbar', () => {
    const { html, projekt, vorher, aenderungen, laeufe } = ansicht();
    expect(html).toContain('<h2>Daten und Parameter</h2>');
    expect(html).toContain('aria-label="Quellen und Zuordnung"');
    expect(html).toContain('aria-label="Parameterwerte"');
    expect(html).toContain('aria-label="Datenvorschau"');
    const toolbar = html.match(
      /<div class="daten-vorschauwahl"[^>]*>([\s\S]*?)<\/div><div class="daten-vorschauhinweise">/,
    )?.[1];
    expect(toolbar).toContain('Ergebnis bis zu diesem Schritt');
    expect(toolbar).toContain('Verwendete Werte');
    expect(toolbar).toContain('Datenvorschau laden');
    expect(html).toContain('Trennzeichen prüfen');
    expect(html).toContain('Quelle konfigurieren');
    expect(html).toContain('001,Beispiel,12.50');
    expect(html).toContain('title="Kundennummer,Deutsche Kundenbezeichnung,Umsatz"');
    expect(projekt).toEqual(vorher);
    expect(aenderungen).toBe(0);
    expect(laeufe).toBe(0);
  });
  it('behält Fehler und Begrenzung ohne technische Kennungen und behauptet bei veraltetem Ergebnis keinen CSV-Befund', () => {
    const { html } = ansicht({ veraltet: true, fehler: true, gekuerzt: true });
    expect(html).toContain('Workflow oder verwendete Parameter wurden seit dieser Vorschau geändert');
    expect(html).toContain('Die Quelle konnte nicht gelesen werden. Prüfe den Dateipfad.');
    expect(html).toContain('Der Ausschnitt wurde begrenzt');
    expect(html).not.toContain('256 KiB');
    expect(html).not.toContain('lauf-datenansicht');
    expect(html).not.toContain('C:\\Synthetische Daten\\Langer Arbeitsordner');
    expect(html).not.toContain('Trennzeichen prüfen');
  });
  it('ordnet Seitenwechsel nach den Daten ein und beschreibt deaktivierte Knöpfe ohne Zusatzabsatz', () => {
    const { html } = ansicht({ zeilenanzahl: 60 });
    expect(html.indexOf('Vorherige Zeilen')).toBeGreaterThan(html.indexOf('</table>'));
    expect(html).toContain('Seite 1 von 2');
    expect(html).toContain('title="Die erste Seite ist bereits sichtbar."');
    expect(html).not.toContain('>Die erste Seite ist bereits sichtbar.</span>');
  });
  it('unterscheidet Laden und tatsächliches Stoppen und verwechselt andere Sperren nicht mit einem Abruf', () => {
    expect(ansicht({ phase: 'laeuft' }).html).toContain('Die Datenvorschau wird geladen.');
    const stoppt = ansicht({ phase: 'stoppt' }).html;
    expect(stoppt).toContain(
      'Die Datenvorschau wird gestoppt. Das tatsächliche Prozessende wird abgewartet.',
    );
    expect(stoppt).not.toContain('Die Datenvorschau wird geladen.');
    expect(ansicht({ gesperrt: true }).html).not.toContain('Die Datenvorschau wird geladen.');
    expect(ansicht({ phase: 'laeuft', fremderLauf: true }).html).not.toContain(
      'Die Datenvorschau wird geladen.',
    );
  });
});
