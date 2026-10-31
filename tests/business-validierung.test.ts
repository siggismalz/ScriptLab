import { describe, expect, it } from 'vitest';
import { businessKonfigurationPruefen } from '../src/kern/business-validierung';
import {
  businessDefinitionen,
  businessKonfigurationFuerLauf,
  standardKonfiguration,
  type BusinessDefinition,
} from '../src/kern/business-katalog';
import type { JsonWert, WorkflowParameter } from '../src/kern/business-modell';

const definition = (typ: string) => {
  const def = businessDefinitionen.find((d) => d.typ === `sl_biz_${typ}`);
  if (!def) throw new Error(`Testdefinition fehlt: ${typ}`);
  return def;
};
const textwert = (wert: string): JsonWert => ({ art: 'wert', typ: 'TEXT', wert });
const pruefen = (typ: string, k: Record<string, JsonWert>, parameter: WorkflowParameter[] = []) => {
  const def = definition(typ);
  return businessKonfigurationPruefen(
    def,
    businessKonfigurationFuerLauf(def.operation, { ...standardKonfiguration(def), ...k }),
    parameter,
  );
};
const param = (name: string): WorkflowParameter => ({
  name,
  beschriftung: name,
  typ: 'Datei',
  erforderlich: true,
  standard: null,
  hilfe: '',
});

function gueltigeKonfiguration(def: BusinessDefinition): Record<string, JsonWert> {
  const k = standardKonfiguration(def);
  for (const name of ['pfad', 'quelle', 'vorlage', 'ziel', 'ordner', 'zielordner', 'archivordner']) {
    if (Object.hasOwn(k, name)) k[name] = `${name}.dat`;
  }
  switch (def.operation) {
    case 'ml.trainieren':
      Object.assign(k, { zielspalte: 'Ziel', merkmale: ['Eingang'] });
      break;
    case 'ml.speichern':
    case 'ml.laden':
      k.pfad = 'Modell.slmodell';
      break;
    case 'daten.spalten':
      Object.assign(k, {
        spalten: ['ID'],
        namen: { Alt: 'Neu' },
        spalte: 'Wert',
        ausdruck: { art: 'spalte', name: 'Bestand' },
      });
      break;
    case 'daten.werte':
      k.spalten = ['Name'];
      break;
    case 'daten.dubletten':
      k.schluessel = ['ID'];
      break;
    case 'daten.filtern':
      k.bedingung = { art: 'vergleich', spalte: 'ID', operator: 'IST_NICHT_LEER' };
      break;
    case 'daten.sortieren':
      k.schluessel = [{ spalte: 'ID', richtung: 'ASC', nullen: 'LETZTE' }];
      break;
    case 'daten.verknuepfen':
      k.schluessel = [{ links: 'Kunde', rechts: 'ID' }];
      break;
    case 'daten.gruppieren':
      k.aggregate = [{ funktion: 'ANZAHL', name: 'Anzahl' }];
      break;
    case 'daten.pruefen':
      k.regeln = [{ art: 'ZEILENZAHL', minimum: 0, maximum: 100 }];
      break;
    case 'dateien.aktion':
      if (k.aktion === 'ZIP_ERSTELLEN') k.ziel = 'Ausgabe.zip';
      break;
  }
  if (def.operation.startsWith('dokument.')) {
    const ext = def.operation.includes('xlsx') ? '.xlsx' : def.operation.includes('docx') ? '.docx' : '.pdf';
    if (Object.hasOwn(k, 'vorlage')) k.vorlage = `Vorlage${ext}`;
    if (Object.hasOwn(k, 'ziel')) k.ziel = `Ergebnis${ext}`;
    if (Object.hasOwn(k, 'schrift')) k.schrift = 'INTERN:VERA';
    if (Object.hasOwn(k, 'bereiche')) k.bereiche = ['1-2'];
    if (Object.hasOwn(k, 'abschnitte')) k.abschnitte = [{ art: 'ABSATZ', text: 'Hallo', stil: '' }];
  }
  return businessKonfigurationFuerLauf(def.operation, k);
}

describe('Statische Business-Prüfung ohne Dateizugriffe', () => {
  it.each(businessDefinitionen.map((def) => [def.name, def] as const))(
    'akzeptiert die gültige angebotene Variante %s',
    (_name, def) => {
      expect(businessKonfigurationPruefen(def, gueltigeKonfiguration(def), [])).toEqual([]);
    },
  );
  it.each([
    'lesen_csv',
    'ordner',
    'kopieren',
    'archivieren',
    'csv_stapel',
    'beleg_ablegen',
    'xlsx_vorlage',
    'docx_vorlage',
    'docx_serie',
    'docx_erstellen',
    'pdf_bericht',
    'pdf_verbinden',
    'pdf_seiten',
    'pdf_teilen',
    'pdf_text',
  ])('meldet leere Pflichtwerte bei %s', (typ) => {
    expect(pruefen(typ, {})).not.toEqual([]);
  });
  it.each(['csv', 'xlsx', 'json', 'parquet'])(
    'erlaubt automatische %s-Ausgabeziele und prüft ungültige explizite Ziele',
    (format) => {
      expect(pruefen(`schreiben_${format}`, { pfad: '' })).toEqual([]);
      expect(pruefen(`schreiben_${format}`, { pfad: '   ' })).not.toEqual([]);
      expect(pruefen(`schreiben_${format}`, { pfad: { parameter: 'Fehlt' } })).not.toEqual([]);
      expect(pruefen(`schreiben_${format}`, { pfad: 'Ausgabe.' + format })).toEqual([]);
    },
  );
  it('prüft keine Dateiexistenz und lässt dynamische Pfade unverändert', () => {
    expect(
      pruefen('docx_vorlage', { vorlage: { parameter: 'Vorlage' }, ziel: { variable: 'stabile-id' } }, [
        param('Vorlage'),
      ]),
    ).toEqual([]);
    expect(pruefen('lesen_csv', { pfad: 'Z:\Nicht vorhandener Ordner\Datei.csv' })).toEqual([]);
    expect(pruefen('lesen_csv', { pfad: { parameter: 'Fehlt' } })).toContain(
      'Wähle für „Dateipfad“ einen definierten Workflowparameter aus.',
    );
    expect(pruefen('lesen_csv', { pfad: { variable: '' } }).some((f) => f.includes('Variable'))).toBe(true);
  });
  it('prüft allgemeine Auswahl-, Zahlen- und Wahrheitsfelder aus Metadaten', () => {
    expect(
      pruefen('lesen_csv', {
        pfad: 'Datei.csv',
        optionen: { trennzeichen: ';;', kodierung: 'ERFUNDEN', kopfzeile: 'ja' },
      }),
    ).toHaveLength(3);
    expect(pruefen('vorschau', { limit: 0 }).some((f) => f.includes('200'))).toBe(true);
    expect(pruefen('vorschau', { limit: 200 })).toEqual([]);
    expect(pruefen('vorschau', { limit: 201 })).not.toEqual([]);
  });
  it('akzeptiert optionale Blatt-/Bereichsfelder und prüft Excel-Bereiche rein syntaktisch', () => {
    expect(
      pruefen('lesen_xlsx', { pfad: 'Daten.xlsx', optionen: { blatt: '', bereich: '$B$2:$D$100' } }),
    ).toEqual([]);
    for (const bereich of ['A:A', '1:2', 'D5:B2', 'A1:XFE2', 'A1:B1048577'])
      expect(pruefen('lesen_xlsx', { pfad: 'Daten.xlsx', optionen: { bereich } })).not.toEqual([]);
  });
  it('prüft vollständige Spalten-, Sortier- und Verknüpfungsangaben', () => {
    expect(pruefen('spalten', { spalten: ['ID', 'ID'] })).not.toEqual([]);
    expect(
      pruefen('sortieren', { schluessel: [{ spalte: '', richtung: 'ASC', nullen: 'ERSTE' }] }),
    ).not.toEqual([]);
    expect(pruefen('verknuepfen', { schluessel: [{ links: 'Kunde', rechts: '' }] })).not.toEqual([]);
    expect(
      pruefen('typ', { spalte: 'Betrag', dezimaltrennzeichen: ',', tausendertrennzeichen: ',' }),
    ).not.toEqual([]);
  });
  it('erlaubt eine reine Anzahl ohne Wertspalte und ohne Gruppierung', () => {
    expect(
      pruefen('gruppieren', { schluessel: [], aggregate: [{ funktion: 'ANZAHL', name: 'Anzahl' }] }),
    ).toEqual([]);
    expect(pruefen('gruppieren', { aggregate: [{ funktion: 'SUMME', name: 'Summe' }] })).not.toEqual([]);
    expect(
      pruefen('gruppieren', { schluessel: ['Region'], aggregate: [{ funktion: 'ANZAHL', name: 'region' }] }),
    ).not.toEqual([]);
  });
  it('prüft verschachtelte Bedingungen, Kurzformen und NULL-Regeln', () => {
    const b: JsonWert = {
      art: 'UND',
      kinder: [
        { art: 'vergleich', spalte: 'ID', operator: 'IST_NICHT_LEER' },
        {
          art: 'NICHT',
          kind: { art: 'vergleich', spalte: 'Name', operator: 'IN', werte: [textwert('Test')] },
        },
      ],
    };
    expect(pruefen('filtern', { bedingung: b })).toEqual([]);
    expect(
      pruefen('filtern', {
        bedingung: { art: 'vergleich', spalte: '', operator: 'EQ', wert: textwert('x') },
      }),
    ).not.toEqual([]);
    expect(
      pruefen('filtern', {
        bedingung: {
          art: 'vergleich',
          spalte: 'Name',
          operator: 'EQ',
          wert: { art: 'wert', typ: 'TEXT', wert: null },
        },
      }),
    ).not.toEqual([]);
    expect(pruefen('filtern', { bedingung: { art: 'UND', kinder: [] } })).not.toEqual([]);
  });
  it('akzeptiert Datenengine-Funktionen und meldet unvollständige Ausdrücke', () => {
    expect(
      pruefen('berechnen', {
        spalte: 'Nummer',
        ausdruck: {
          art: 'funktion',
          funktion: 'REGEX',
          argument: { art: 'spalte', name: 'Text' },
          muster: '(\\d+)',
          gruppe: 1,
        },
      }),
    ).toEqual([]);
    expect(
      pruefen('berechnen', {
        spalte: 'Wert',
        ausdruck: {
          art: 'rechnen',
          operator: 'DIV',
          links: { art: 'spalte', name: 'Umsatz' },
          rechts: { art: 'wert', typ: 'GANZZAHL', wert: 0 },
        },
      }),
    ).not.toEqual([]);
  });
  it.each([
    ['GANZZAHL', true],
    ['ZAHL', '2.5'],
    ['WAHRHEIT', 'false'],
    ['DATUM', '2025-02-29'],
    ['DEZIMAL', '1,20'],
    ['DEZIMAL', '1e3'],
    ['ZEITSTEMPEL', '2026-10-01T25:00:00'],
  ] as const)('meldet unpassende Literalwerte für %s', (typ, wert) => {
    expect(pruefen('berechnen', { spalte: 'Neu', ausdruck: { art: 'wert', typ, wert } })).not.toEqual([]);
  });
  it('lässt gültige Literale und parametrisierte Literalwerte bestehen', () => {
    expect(
      pruefen('berechnen', { spalte: 'Neu', ausdruck: { art: 'wert', typ: 'DATUM', wert: '2024-02-29' } }),
    ).toEqual([]);
    expect(
      pruefen(
        'berechnen',
        {
          spalte: 'Neu',
          ausdruck: {
            art: 'wert',
            typ: { art: 'DEZIMAL', praezision: 18, skala: 2 },
            wert: { parameter: 'Betrag' },
          },
        },
        [param('Betrag')],
      ),
    ).toEqual([]);
    expect(
      pruefen('berechnen', {
        spalte: 'Neu',
        ausdruck: { art: 'wert', typ: { art: 'DEZIMAL', praezision: 3, skala: 4 }, wert: '1.00' },
      }),
    ).not.toEqual([]);
  });
  it('prüft kanonische Qualitätsregeln ohne ihre Formularreste vorauszusetzen', () => {
    expect(
      pruefen('pruefen', {
        regeln: [
          { art: 'ZEILENZAHL', minimum: 0 },
          { art: 'BEREICH', spalte: 'Betrag', minimum: { art: 'wert', typ: 'ZAHL', wert: 1 } },
          { art: 'EINDEUTIG', spalten: ['ID'] },
          { art: 'ERLAUBTE_WERTE', spalte: 'Name', werte: [textwert('Anna')] },
        ],
      }),
    ).toEqual([]);
    expect(
      pruefen('pruefen', {
        regeln: [
          {
            art: 'BEREICH',
            spalte: 'Betrag',
            minimum: { art: 'wert', typ: 'ZAHL', wert: 10 },
            maximum: { art: 'wert', typ: 'ZAHL', wert: 2 },
          },
        ],
      }),
    ).not.toEqual([]);
    const def = definition('pruefen');
    expect(
      businessKonfigurationPruefen(
        def,
        { ...standardKonfiguration(def), regeln: [{ art: 'ZEILENZAHL', minimum: -1 }] },
        [],
      ),
    ).not.toEqual([]);
  });
  it('prüft PDF-Seiten und Fontangaben ohne PDFs oder Schriften einzulesen', () => {
    expect(pruefen('pdf_text', { quelle: 'Scan.pdf', seiten: '' })).toEqual([]);
    expect(pruefen('pdf_bericht', { ziel: 'Bericht.pdf', schrift: 'INTERN:VERA', spalten: [] })).toEqual([]);
    for (const seiten of ['0', '3-1', '1,1', '1-2001', 'einfach alles'])
      expect(pruefen('pdf_seiten', { quelle: 'Quelle.pdf', ziel: 'Ziel.pdf', seiten })).not.toEqual([]);
    expect(pruefen('pdf_bericht', { ziel: 'Bericht.pdf', schrift: 'Schrift.woff' })).not.toEqual([]);
  });
  it('prüft Word-Abschnitte nur anhand der gewählten Abschnittsart', () => {
    expect(
      pruefen(
        'docx_erstellen',
        {
          ziel: 'Bericht.docx',
          abschnitte: [
            { art: 'ABSATZ', text: 'Hallo', stil: '', pfad: '', breite_cm: 0, stufe: -1 },
            { art: 'BILD', pfad: { parameter: 'Bild' }, breite_cm: 2, text: '' },
          ],
        },
        [param('Bild')],
      ),
    ).toEqual([]);
    expect(
      pruefen('docx_erstellen', {
        ziel: 'Bericht.docx',
        abschnitte: [{ art: 'BILD', pfad: '', breite_cm: 0 }],
      }),
    ).not.toEqual([]);
    expect(
      pruefen('docx_gruppenserie', {
        vorlage: 'Vorlage.docx',
        zielordner: '.',
        positionen: { tabelle: -1, zeile: 1 },
      }),
    ).not.toEqual([]);
  });
  it('prüft Zelladressen, Formeln und enge Formatangaben', () => {
    expect(
      pruefen('xlsx_vorlage', {
        vorlage: 'V.xlsx',
        ziel: 'Z.xlsx',
        zellen: { A1: '=Daten bleiben Text' },
        formeln: { B2: '=SUM(A1:A2)' },
        formate: [{ adresse: 'A1', fett: true, fuellung: 'A1b2C3' }],
      }),
    ).toEqual([]);
    expect(
      pruefen('xlsx_vorlage', { vorlage: 'V.xlsx', ziel: 'Z.xlsx', formeln: { A1: 'SUM(A1:A2)' } }),
    ).not.toEqual([]);
    expect(
      pruefen('xlsx_vorlage', {
        vorlage: 'V.xlsx',
        ziel: 'Z.xlsx',
        formate: [{ adresse: 'XFE1', fuellung: '#A1B2C3' }],
      }),
    ).not.toEqual([]);
  });
  it('prüft endliche numerische Grenzen und bewusste Zieltrennung', () => {
    expect(
      pruefen('csv_stapel', { ordner: 'Daten', zielordner: 'Daten', archivordner: 'Archiv' }),
    ).not.toEqual([]);
    expect(pruefen('kopieren', { quelle: 'gleich.txt', ziel: 'gleich.txt' })).not.toEqual([]);
    expect(pruefen('pdf_bericht', { ziel: 'B.pdf', schrift: 'INTERN:VERA', rand_mm: Infinity })).not.toEqual(
      [],
    );
  });
  it('lässt fest definierte Generator-Steuerblöcke mit leerer Konfiguration zu', () => {
    const def: BusinessDefinition = {
      ...definition('dateistapel'),
      operation: 'ablauf.stapel',
      steuerung: 'stapel',
      felder: [],
    };
    expect(businessKonfigurationPruefen(def, {}, [])).toEqual([]);
  });
});
