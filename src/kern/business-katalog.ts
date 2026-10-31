import type { BausteinDefinition } from './katalog';
import { mlDefinitionen } from './ml-katalog';
import { kategoriefarben } from '../gestaltung/tokens';
import { jsonDatenPruefen, type BusinessSchritt, type FachlicherTyp, type JsonWert } from './business-modell';

export interface KonfigFeld {
  name: string;
  titel: string;
  art:
    | 'text'
    | 'zahl'
    | 'wahrheit'
    | 'auswahl'
    | 'liste'
    | 'objekt'
    | 'spalten'
    | 'zuordnung'
    | 'bedingung'
    | 'ausdruck'
    | 'typ';
  standard: JsonWert;
  optionen?: string[];
  felder?: KonfigFeld[];
  hilfe?: string;
  /** Gliederung des Formulars; gehört nicht zum gespeicherten Workflow. */
  darstellung?: 'weitere' | 'flach';
}
export interface BusinessDefinition {
  steuerung?: 'stapel' | 'fehler';
  typ: string;
  name: string;
  gruppe: string;
  operation: string;
  ausgabe: FachlicherTyp;
  eingaben: Record<string, FachlicherTyp>;
  felder: KonfigFeld[];
  hilfe: string;
  schreibt: boolean;
  komponenten: string[];
}

/** Gleiche fachliche Bezeichnungen in Formularen und zugehörigen Meldungen. */
export function businessEingabeTitel(name: string, typ: FachlicherTyp): string {
  const titel: Record<string, string> = {
    modell: 'Modell',
    links: 'Erste Tabelle',
    rechts: 'Zweite Tabelle',
    dateien: 'Dateien',
    ausgaben: 'Ausgaben',
  };
  return titel[name] ?? (typ === 'Dateiliste' ? 'Dateien' : typ);
}
const text = (name: string, titel: string, standard = ''): KonfigFeld => ({
  name,
  titel,
  art: 'text',
  standard,
});
const wahl = (name: string, titel: string, optionen: string[]): KonfigFeld => ({
  name,
  titel,
  art: 'auswahl',
  optionen,
  standard: optionen[0],
});
const bool = (name: string, titel: string, standard = false): KonfigFeld => ({
  name,
  titel,
  art: 'wahrheit',
  standard,
});
const weitere = (feld: KonfigFeld): KonfigFeld => ({ ...feld, darstellung: 'weitere' });
const obj = (name: string, titel: string, felder: KonfigFeld[]): KonfigFeld => ({
  name,
  titel,
  art: 'objekt',
  felder,
  standard: Object.fromEntries(felder.map((f) => [f.name, f.standard])),
});
const liste = (name: string, titel: string, felder: KonfigFeld[]): KonfigFeld => ({
  name,
  titel,
  art: 'liste',
  felder,
  standard: [],
});
const spalten = (name = 'spalten', titel = 'Spalten'): KonfigFeld => ({
  name,
  titel,
  art: 'spalten',
  standard: [],
});
const typ: KonfigFeld = { name: 'typ', titel: 'Datentyp', art: 'typ', standard: 'TEXT' };
const konflikt = wahl('konflikt', 'Wenn das Ziel bereits vorhanden ist', [
  'FEHLER',
  'UEBERSPRINGEN',
  'NEUER_NAME',
  'ERSETZEN',
]);
const pfad = text('pfad', 'Dateipfad');
const bedingung: KonfigFeld = {
  name: 'bedingung',
  titel: 'Bedingung',
  art: 'bedingung',
  standard: {
    art: 'vergleich',
    links: { art: 'spalte', name: '' },
    operator: 'EQ',
    rechts: { art: 'wert', typ: 'TEXT', wert: '' },
  },
};
const ausdruck: KonfigFeld = {
  name: 'ausdruck',
  titel: 'Berechnung',
  art: 'ausdruck',
  standard: {
    art: 'rechnen',
    operator: 'SUB',
    links: { art: 'spalte', name: '' },
    rechts: { art: 'spalte', name: '' },
  },
};
const alle: BusinessDefinition[] = [];
function block(
  typ: string,
  name: string,
  gruppe: string,
  operation: string,
  ausgabe: FachlicherTyp,
  eingaben: Record<string, FachlicherTyp>,
  felder: KonfigFeld[],
  hilfe: string,
  schreibt = false,
  komponenten = ['duckdb'],
) {
  alle.push({
    typ: `sl_biz_${typ}`,
    name,
    gruppe,
    operation,
    ausgabe,
    eingaben,
    felder,
    hilfe,
    schreibt,
    komponenten,
  });
}
const tabelle = { tabelle: 'Tabelle' } as const;
for (const format of ['CSV', 'XLSX', 'JSON', 'PARQUET']) {
  const optionen =
    format === 'CSV'
      ? [
          text('trennzeichen', 'Trennzeichen', ';'),
          weitere(wahl('kodierung', 'Zeichenkodierung', ['UTF8', 'UTF8_BOM', 'UTF16', 'CP1252'])),
          weitere(bool('kopfzeile', 'Erste Zeile enthält Spaltennamen', true)),
          weitere(text('nullwert', 'Kennzeichen für leere Werte')),
          weitere(wahl('fehlzeilen', 'Fehlerhafte Zeilen', ['STOPP', 'AUSLASSEN_MIT_BERICHT'])),
        ]
      : format === 'XLSX'
        ? [
            text('blatt', 'Arbeitsblatt (leer: erstes Blatt)'),
            text('bereich', 'Zellbereich (leer: gesamtes Blatt)'),
            weitere(bool('kopfzeile', 'Erste Zeile enthält Spaltennamen', true)),
            weitere(wahl('formeln', 'Vorhandene Formeln', ['STOPP', 'WERTE'])),
          ]
        : format === 'JSON'
          ? [weitere(bool('zeilenformat', 'Ein JSON-Datensatz pro Zeile'))]
          : [];
  block(
    `lesen_${format.toLowerCase()}`,
    `${format}-Tabelle lesen`,
    'Daten laden',
    'daten.importieren',
    'Tabelle',
    {},
    [
      wahl('format', 'Dateiformat', [format]),
      pfad,
      { ...obj('optionen', 'Importeinstellungen', optionen), darstellung: 'flach' },
    ],
    'Liest eine ausdrücklich gewählte Quelle. CSV bleibt zunächst Text; Datentypen werden anschließend bewusst festgelegt. Quellenänderungen werden geprüft.',
    false,
    format === 'XLSX' ? ['duckdb', 'openpyxl'] : ['duckdb'],
  );
  block(
    `schreiben_${format.toLowerCase()}`,
    `Tabelle als ${format} speichern`,
    'Daten ausgeben',
    'daten.exportieren',
    'Ergebnis',
    tabelle,
    [
      wahl('format', 'Dateiformat', [format]),
      {
        ...pfad,
        titel: 'Speicherort (optional)',
        hilfe:
          'Leer lassen: ScriptLab übernimmt den Namen der Quelldatei und speichert im Arbeitsordner. Bei mehreren Quellen heißt die Datei Auswertung. Vorhandene Dateien erhalten einen neuen Namen.',
      },
      weitere(konflikt),
      {
        ...obj(
          'optionen',
          'Ausgabeeinstellungen',
          format === 'CSV'
            ? [text('trennzeichen', 'Trennzeichen', ';')]
            : format === 'XLSX'
              ? [text('blatt', 'Arbeitsblatt', 'Auswertung')]
              : [],
        ),
        darstellung: 'flach',
      },
    ],
    'Schreibt eine vollständige Tabelle über eine eigene Zwischendatei. Bestehende Ziele werden standardmäßig nicht überschrieben. XLSX berechnet keine Formeln.',
    true,
    format === 'XLSX' ? ['duckdb', 'openpyxl'] : ['duckdb'],
  );
}
block(
  'spalten',
  'Spalten auswählen',
  'Daten aufbereiten',
  'daten.spalten',
  'Tabelle',
  tabelle,
  [wahl('aktion', 'Aktion', ['AUSWAEHLEN']), spalten()],
  'Wählt Spalten frühzeitig aus; unbekannte Spalten führen zum Fehler.',
);
block(
  'umbenennen',
  'Spalten umbenennen',
  'Daten aufbereiten',
  'daten.spalten',
  'Tabelle',
  tabelle,
  [
    wahl('aktion', 'Aktion', ['UMBENENNEN']),
    { name: 'namen', titel: 'Alte und neue Spaltennamen', art: 'zuordnung', standard: {} },
  ],
  'Ordnet vorhandenen Spalten eindeutige neue Namen zu.',
);
block(
  'typ',
  'Datentyp festlegen',
  'Daten aufbereiten',
  'daten.spalten',
  'Tabelle',
  tabelle,
  [
    wahl('aktion', 'Aktion', ['TYP']),
    text('spalte', 'Spalte'),
    typ,
    wahl('datumsformat', 'Datumsformat', ['ISO', 'DMY', 'MDY']),
    weitere(wahl('dezimaltrennzeichen', 'Dezimaltrennzeichen', ['.', ','])),
    weitere(wahl('tausendertrennzeichen', 'Tausendertrennzeichen', ['', '.', ',', ' '])),
    wahl('fehlwerte', 'Ungültige Werte', ['STOPP', 'AUSLASSEN_MIT_BERICHT']),
  ],
  'Wandelt ausdrücklich um. Dezimalbeträge erhalten eine feste Genauigkeit und Skala. Fehlende Werte werden nicht zu null Euro.',
);
block(
  'berechnen',
  'Spalte berechnen',
  'Daten aufbereiten',
  'daten.spalten',
  'Tabelle',
  tabelle,
  [wahl('aktion', 'Aktion', ['BERECHNEN']), text('spalte', 'Neue Spalte'), ausdruck],
  'Berechnet Spalten aus ausgewählten Werten und Rechenarten. Es wird kein Python- oder SQL-Ausdruck eingegeben.',
);
block(
  'ersetzen',
  'Werte ersetzen',
  'Daten aufbereiten',
  'daten.werte',
  'Tabelle',
  tabelle,
  [
    wahl('aktion', 'Aktion', ['ERSETZEN']),
    spalten(),
    text('suchen', 'Gesuchter Wert'),
    text('ersatz', 'Ersatzwert'),
  ],
  'Ersetzt Datenwerte in ausdrücklich ausgewählten Spalten.',
);
block(
  'bereinigen',
  'Texte bereinigen',
  'Daten aufbereiten',
  'daten.werte',
  'Tabelle',
  tabelle,
  [
    wahl('aktion', 'Aktion', ['BEREINIGEN']),
    spalten(),
    bool('trim', 'Rand-Leerzeichen entfernen', true),
    wahl('grossklein', 'Schreibweise', ['UNVERAENDERT', 'GROSS', 'KLEIN']),
  ],
  'Bereinigt Textspalten, ohne Kennnummern automatisch in Zahlen umzuwandeln.',
);
block(
  'leerwerte',
  'Leere Werte behandeln',
  'Daten aufbereiten',
  'daten.werte',
  'Tabelle',
  tabelle,
  [
    wahl('aktion', 'Aktion', ['LEERWERTE']),
    spalten(),
    wahl('leere', 'Bei Leerwerten', ['STOPP', 'AUSLASSEN', 'ERSETZEN']),
    text('ersatz', 'Bewusster Ersatzwert'),
  ],
  'Hält an, lässt betroffene Zeilen aus oder ersetzt Leerwerte entsprechend der gewählten Regel.',
);
block(
  'dubletten',
  'Doppelte Datensätze behandeln',
  'Daten aufbereiten',
  'daten.dubletten',
  'Tabelle',
  tabelle,
  [
    spalten('schluessel', 'Verglichene Spalten'),
    wahl('behalten', 'Welchen Datensatz behalten', ['ERSTE', 'LETZTE', 'KEINE']),
  ],
  'Vergleicht die gewählten Spalten. Für erste/letzte Zeilen die gewünschte Reihenfolge vorher ausdrücklich sortieren.',
);
block(
  'filtern',
  'Zeilen filtern',
  'Daten verbinden',
  'daten.filtern',
  'Tabelle',
  tabelle,
  [bedingung],
  'Filtert mit Spalten, Vergleichsoperatoren und typisierten Werten. UND, ODER und Datumsgrenzen sind möglich.',
);
block(
  'sortieren',
  'Zeilen sortieren',
  'Daten verbinden',
  'daten.sortieren',
  'Tabelle',
  tabelle,
  [
    liste('schluessel', 'Sortierspalten', [
      text('spalte', 'Spalte'),
      wahl('richtung', 'Richtung', ['ASC', 'DESC']),
      wahl('nullen', 'Leerwerte', ['LETZTE', 'ERSTE']),
    ]),
  ],
  'Sortiert die ganze Quelle; auch eine kleine Vorschau kann dafür alle Quelldaten lesen.',
);
block(
  'vereinigen',
  'Tabellen untereinander zusammenführen',
  'Daten verbinden',
  'daten.vereinigen',
  'Tabelle',
  { links: 'Tabelle', rechts: 'Tabelle' },
  [
    bool('nach_name', 'Spalten nach Namen zuordnen', true),
    bool('dubletten', 'Gleiche Ergebniszeilen entfernen'),
  ],
  'Führt kompatible Tabellen zusammen und prüft Spalten und Datentypen.',
);
block(
  'verknuepfen',
  'Kundendaten ergänzen',
  'Daten verbinden',
  'daten.verknuepfen',
  'Tabelle',
  { links: 'Tabelle', rechts: 'Tabelle' },
  [
    wahl('art', 'Verknüpfungsart', ['LEFT', 'INNER', 'FULL']),
    liste('schluessel', 'Gemeinsame Schlüssel', [
      text('links', 'Spalte der ersten Tabelle'),
      text('rechts', 'Spalte der zweiten Tabelle'),
    ]),
    wahl('kardinalitaet', 'Erwartete Zuordnung', ['n:1', '1:1', '1:n', 'n:m']),
    wahl('fehlende_zuordnung', 'Fehlende Zuordnungen', ['STOPP', 'BEHALTEN']),
  ],
  'Ergänzt zum Beispiel Bestellungen anhand der Kundennummer. Doppelte Schlüssel und unerwartete Zeilenvervielfachung werden geprüft.',
);
block(
  'gruppieren',
  'Daten zusammenfassen',
  'Daten zusammenfassen',
  'daten.gruppieren',
  'Tabelle',
  tabelle,
  [
    spalten('schluessel', 'Gruppieren nach'),
    liste('aggregate', 'Berechnungen', [
      wahl('funktion', 'Berechnung', [
        'SUMME',
        'ANZAHL',
        'ANZAHL_WERTE',
        'ANZAHL_VERSCHIEDEN',
        'MIN',
        'MAX',
        'MITTELWERT',
      ]),
      text('spalte', 'Wertspalte (bei Anzahl optional)'),
      text('name', 'Name der Ergebnisspalte'),
    ]),
  ],
  'Bildet Anzahl, Summe, Minimum, Maximum und Durchschnitt je Gruppe.',
);
block(
  'pruefen',
  'Datenqualität prüfen',
  'Datenqualität',
  'daten.pruefen',
  'Ergebnis',
  tabelle,
  [
    liste('regeln', 'Prüfregeln', [
      wahl('art', 'Prüfung', ['NICHT_LEER', 'EINDEUTIG', 'BEREICH', 'TYP', 'ERLAUBTE_WERTE', 'ZEILENZAHL']),
      text('spalte', 'Spalte'),
      spalten(),
      text('minimum', 'Minimum (optional)'),
      text('maximum', 'Maximum (optional)'),
      typ,
      spalten('werte', 'Erlaubte Werte'),
    ]),
    wahl('bei_fehler', 'Bei Fehlern', ['STOPP', 'BERICHT']),
  ],
  'Prüft Pflichtfelder, Schlüssel, Wertebereiche und erlaubte Werte. Berichte enthalten begrenzte Fehlerbeispiele.',
);
const zahl = (name: string, titel: string, standard: number): KonfigFeld => ({
  name,
  titel,
  art: 'zahl',
  standard,
});
const zuordnung = (name: string, titel: string): KonfigFeld => ({
  name,
  titel,
  art: 'zuordnung',
  standard: {},
});
block(
  'dateistapel',
  'Dateien auflisten und filtern',
  'Geschäftsdateien',
  'dateien.stapel',
  'Dateiliste',
  {},
  [text('ordner', 'Eingangsordner'), text('muster', 'Dateimuster', '*.csv')],
  'Erfasst einen stabilen Dateistapel mit Quellidentitäten. Verknüpfungen werden nicht rekursiv verfolgt.',
  false,
  [],
);
for (const [aktion, name] of [
  ['ORDNER', 'Ordner erstellen'],
  ['KOPIEREN', 'Datei kontrolliert kopieren'],
  ['VERSCHIEBEN', 'Datei kontrolliert verschieben'],
  ['UMBENENNEN', 'Datei kontrolliert umbenennen'],
  ['ZIP_ERSTELLEN', 'ZIP-Archiv erstellen'],
  ['ZIP_ENTPACKEN', 'ZIP-Archiv entpacken'],
])
  block(
    aktion === 'UMBENENNEN' ? 'datei_umbenennen' : aktion.toLowerCase(),
    name,
    'Geschäftsdateien',
    'dateien.aktion',
    'Ergebnis',
    {},
    [
      wahl('aktion', 'Aktion', [aktion]),
      ...(aktion === 'ORDNER' ? [] : [text('quelle', 'Quelle')]),
      text('ziel', 'Ziel'),
      konflikt,
    ],
    'Prüft Quelle und Ziel. Verschieben kopiert und verifiziert vor dem Entfernen. ZIP-Entpacken prüft Pfade und Größenlimits. Bestehende Ziele werden nicht still überschrieben.',
    true,
    [],
  );
block(
  'archivieren',
  'Datei nach erfolgreicher Verarbeitung verschieben',
  'Geschäftsdateien',
  'dateien.archivieren',
  'Ergebnis',
  { ausgaben: 'Ergebnis' },
  [text('quelle', 'Erfolgreich verarbeitete Quelle'), text('ziel', 'Archivziel'), konflikt],
  'Archiviert erst nach verifizierten Ausgaben dieses Laufs. Bei Fehlern bleibt die Quelle erhalten.',
  true,
  [],
);
block(
  'csv_stapel',
  'CSV-Dateistapel prüfen und archivieren',
  'Geschäftsablauf',
  'dateien.csv_stapel',
  'Ergebnis',
  {},
  [
    text('ordner', 'Eingangsordner'),
    text('zielordner', 'Ausgabeordner'),
    text('archivordner', 'Archivordner'),
    text('muster', 'Dateimuster', '*.csv'),
    weitere(text('trennzeichen', 'Trennzeichen', ';')),
    konflikt,
    wahl('bei_fehler', 'Bei einer fehlerhaften Datei', ['STOPP', 'BERICHT']),
  ],
  'Verarbeitet einen festen CSV-Stapel, prüft Spaltenzahlen und archiviert nur nach bestätigter Ausgabe. Das Journal ermöglicht kontrolliertes Fortsetzen.',
  true,
  [],
);
block(
  'beleg_ablegen',
  'PDF-Beleg prüfen und geordnet ablegen',
  'PDF',
  'dateien.beleg_ablegen',
  'Ergebnis',
  {},
  [
    text('quelle', 'PDF-Beleg'),
    text('zielordner', 'Ablageordner'),
    wahl('bei_scan', 'Wenn keine verlässliche Textebene vorhanden ist', ['STOPP', 'BERICHT']),
    konflikt,
  ],
  'Liest Belegnummer und Datum aus einer vorhandenen Textebene. Scanverdacht führt zu einem Hinweis. Originale bleiben erhalten.',
  true,
  ['duckdb', 'pypdf'],
);
block(
  'vorschau',
  'Tabelle begrenzt anzeigen',
  'Datenqualität',
  'daten.vorschau',
  'Ergebnis',
  tabelle,
  [zahl('limit', 'Angezeigte Zeilen (1–200)', 200)],
  'Zeigt einen auf Zeilen und Bytes begrenzten Ausschnitt; die Auswertung kann trotzdem die gesamte Quelle lesen.',
);
block(
  'xlsx_vorlage',
  'Excel-Vorlage befüllen',
  'Excel',
  'dokument.xlsx_vorlage',
  'Ergebnis',
  {},
  [
    text('vorlage', 'XLSX-Vorlage'),
    text('ziel', 'Neue XLSX-Datei'),
    text('blatt', 'Arbeitsblatt'),
    zuordnung('zellen', 'Zelladressen und Werte'),
    weitere(zuordnung('formeln', 'Bewusst geschriebene Excel-Formeln')),
    weitere(
      liste('formate', 'Zellen formatieren', [
        text('adresse', 'Zelladresse'),
        text('zahlformat', 'Zahlenformat', '0.00'),
        bool('fett', 'Fettschrift'),
        text('fuellung', 'Füllfarbe (sechs Hexzeichen)', 'E8EBEF'),
        wahl('ausrichtung', 'Ausrichtung', ['links', 'mitte', 'rechts']),
      ]),
    ),
    konflikt,
  ],
  'Füllt definierte Zellen und schreibt bewusst gewählte Formeln. Formeln werden nicht berechnet; bestehende Vorlagen werden als neue Datei gespeichert.',
  true,
  ['openpyxl'],
);
const wordFelder = [
  text('vorlage', 'DOCX-Vorlage'),
  text('ziel', 'Neue DOCX-Datei'),
  zuordnung('werte', 'Platzhalter und Werte'),
  konflikt,
];
block(
  'docx_vorlage',
  'Word-Vorlage ausfüllen',
  'Word',
  'dokument.docx_vorlage',
  'Ergebnis',
  {},
  wordFelder,
  'Füllt {{Name}}-Platzhalter über Word-Textabschnitte hinweg. Fehlende Pflichtwerte oder offene Platzhalter stoppen die Ausgabe.',
  true,
  ['python-docx'],
);
block(
  'docx_positionen',
  'Word-Vorlage mit Positionen ausfüllen',
  'Word',
  'dokument.docx_vorlage',
  'Ergebnis',
  tabelle,
  [
    ...wordFelder,
    obj('positionen', 'Wiederholte Tabellenzeile', [
      zahl('tabelle', 'Tabellennummer ab 0', 0),
      zahl('zeile', 'Musterzeile ab 0', 1),
      text('praefix', 'Platzhalter-Präfix', 'Position'),
    ]),
  ],
  'Füllt die Vorlage und wiederholt eine ausdrücklich gewählte Tabellenzeile für die verbundenen Positionen.',
  true,
  ['python-docx'],
);
block(
  'docx_serie',
  'Word-Dokumentserie erzeugen',
  'Word',
  'dokument.docx_serie',
  'Ergebnis',
  tabelle,
  [
    text('vorlage', 'DOCX-Vorlage'),
    text('zielordner', 'Ausgabeordner'),
    text('dateiname', 'Dateinamensmuster', 'Brief-{nummer}.docx'),
    zuordnung('werte', 'Gemeinsame Platzhalterwerte'),
    konflikt,
  ],
  'Erzeugt je Datensatz ein Dokument. Dateinamensbestandteile werden geprüft und bleiben im gewählten Zielordner.',
  true,
  ['python-docx'],
);
block(
  'docx_gruppenserie',
  'Word-Bestellungen je Lieferant erstellen',
  'Word',
  'dokument.docx_serie',
  'Ergebnis',
  tabelle,
  [
    text('vorlage', 'DOCX-Vorlage'),
    text('zielordner', 'Ausgabeordner'),
    text('dateiname', 'Dateinamensmuster', 'Bestellung-{Lieferant}.docx'),
    text('gruppe_nach', 'Gruppenspalte', 'Lieferant'),
    obj('positionen', 'Wiederholte Tabellenzeile', [
      zahl('tabelle', 'Tabellennummer ab 0', 0),
      zahl('zeile', 'Musterzeile ab 0', 1),
      text('praefix', 'Platzhalter-Präfix', 'Position'),
    ]),
    zuordnung('summen', 'Summenplatzhalter und Wertspalten'),
    zuordnung('werte', 'Gemeinsame Platzhalterwerte'),
    konflikt,
  ],
  'Erstellt ein Dokument je Lieferant mit Positionstabelle und exakten Gruppensummen.',
  true,
  ['python-docx'],
);
const abschnitte = liste('abschnitte', 'Dokumentinhalt', [
  wahl('art', 'Abschnittsart', ['ABSATZ', 'UEBERSCHRIFT', 'BILD']),
  text('text', 'Text'),
  text('stil', 'Word-Formatvorlage (optional)'),
  text('pfad', 'Bilddatei (bei Bild)'),
  zahl('stufe', 'Überschriftenebene', 1),
  zahl('breite_cm', 'Bildbreite in cm', 12),
]);
block(
  'docx_erstellen',
  'Word-Dokument erstellen',
  'Word',
  'dokument.docx_erstellen',
  'Ergebnis',
  {},
  [text('ziel', 'Neue DOCX-Datei'), text('titel', 'Dokumenttitel'), abschnitte, konflikt],
  'Erstellt Überschriften, Absätze und Bilder mit vorhandenen Word-Formatvorlagen.',
  true,
  ['python-docx'],
);
block(
  'docx_tabelle',
  'Word-Dokument mit Tabelle erstellen',
  'Word',
  'dokument.docx_erstellen',
  'Ergebnis',
  tabelle,
  [text('ziel', 'Neue DOCX-Datei'), text('titel', 'Dokumenttitel'), abschnitte, konflikt],
  'Erstellt ein Word-Dokument mit begrenzter Geschäftstabelle und überprüfbarem Inhalt.',
  true,
  ['python-docx'],
);
block(
  'pdf_bericht',
  'PDF-Bericht erzeugen',
  'PDF',
  'dokument.pdf_bericht',
  'Ergebnis',
  tabelle,
  [
    text('ziel', 'Neue PDF-Datei'),
    text('titel', 'Berichtstitel'),
    weitere(text('schrift', 'Schrift', 'INTERN:VERA')),
    spalten('spalten', 'Angezeigte Spalten'),
    weitere(wahl('seitenformat', 'Seitenformat', ['A4', 'A3', 'LETTER'])),
    weitere(bool('querformat', 'Querformat')),
    weitere(zahl('rand_mm', 'Seitenrand in mm', 12.7)),
    konflikt,
  ],
  'Erstellt einen mehrseitigen Bericht mit wiederholtem Tabellenkopf und Seitenzahlen. Die mitgelieferte Schrift unterstützt deutsche Texte. Fehlende Zeichen werden vor der Ausgabe gemeldet; eine andere lokale TTF-Schrift kann gewählt werden.',
  true,
  ['reportlab'],
);
block(
  'pdf_verbinden',
  'PDF-Dateien zusammenführen',
  'PDF',
  'dokument.pdf_verbinden',
  'Ergebnis',
  { dateien: 'Dateiliste' },
  [text('ziel', 'Neue PDF-Datei'), konflikt],
  'Fügt bestehende PDF-Seiten in der Reihenfolge des geprüften Dateistapels zusammen.',
  true,
  ['pypdf'],
);
block(
  'pdf_seiten',
  'PDF-Seiten auswählen',
  'PDF',
  'dokument.pdf_seiten',
  'Ergebnis',
  {},
  [
    text('quelle', 'PDF-Quelldatei'),
    text('seiten', 'Seiten ab 1 (zum Beispiel 1-3,5)', '1'),
    text('ziel', 'Neue PDF-Datei'),
    konflikt,
  ],
  'Schreibt ausgewählte Seiten in eine neue PDF-Datei. Die Quelle bleibt unverändert.',
  true,
  ['pypdf'],
);
block(
  'pdf_teilen',
  'PDF in mehrere Dateien aufteilen',
  'PDF',
  'dokument.pdf_teilen',
  'Ergebnis',
  {},
  [
    text('quelle', 'PDF-Quelldatei'),
    spalten('bereiche', 'Seitenbereiche (zum Beispiel 1-2)'),
    text('zielordner', 'Ausgabeordner'),
    text('dateiname', 'Dateinamensmuster', 'Teil-{nummer}.pdf'),
    konflikt,
  ],
  'Schreibt ausdrücklich gewählte Seitenbereiche in separate Dateien mit kontrollierten Namen.',
  true,
  ['pypdf'],
);
block(
  'pdf_text',
  'PDF-Textebene auslesen',
  'PDF',
  'dokument.pdf_text',
  'Ergebnis',
  {},
  [
    text('quelle', 'PDF-Quelldatei'),
    text('seiten', 'Seiten (leer: alle)'),
    wahl('bei_scan', 'Seite ohne Textebene', ['STOPP', 'BERICHT']),
  ],
  'Liest die vorhandene Textebene mit Größenlimits. Seiten ohne Text halten den Ablauf an oder werden ausdrücklich als unvollständig berichtet. Keine OCR.',
  false,
  ['pypdf'],
);
block(
  'stapel_schleife',
  'Für jede Datei im Stapel',
  'Geschäftsablauf',
  'ablauf.stapel',
  'Ergebnis',
  { dateien: 'Dateiliste' },
  [],
  'Durchläuft den zuvor erfassten stabilen Dateistapel. Die gewählte Variable enthält je Schritt den geprüften Dateipfad. Veränderungen der Quellen werden gemeldet.',
  false,
  [],
);
alle.at(-1)!.steuerung = 'stapel';
block(
  'fehlerbehandlung',
  'Fehler behandeln und fortfahren',
  'Geschäftsablauf',
  'ablauf.fehler',
  'Ergebnis',
  {},
  [],
  'Versucht den inneren Ablauf und führt bei einem gewöhnlichen Fehler den Fehlerzweig aus. Der Lauf endet mit Fehlern. Abbruch und unklare Dateizustände werden weitergereicht.',
  false,
  [],
);
alle.at(-1)!.steuerung = 'fehler';
alle.push(...mlDefinitionen);
export const businessDefinitionen = alle;
export const businessNachTyp = new Map(alle.map((d) => [d.typ, d]));
export const businessBlocklyDefinitionen: BausteinDefinition[] = alle.map((d) => ({
  typ: d.typ,
  name: d.name,
  kategorie: d.gruppe,
  farbe: kategoriefarben[d.gruppe as keyof typeof kategoriefarben] ?? kategoriefarben['Daten aufbereiten'],
  form: 'anweisung',
  nachricht:
    d.steuerung === 'stapel'
      ? 'Für jede Datei aus %1 als %2 %3'
      : d.steuerung === 'fehler'
        ? '%1 %2 bei Fehler %3'
        : '%1',
  eingaben:
    d.steuerung === 'stapel'
      ? [{ name: 'ABLAUF', typ: 'Statement' }]
      : d.steuerung === 'fehler'
        ? [
            { name: 'ABLAUF', typ: 'Statement' },
            { name: 'FEHLER', typ: 'Statement' },
          ]
        : [],
  felder: [
    {
      name: 'NAME',
      art: 'text',
      standard:
        d.steuerung === 'stapel'
          ? 'Dateistapel'
          : d.steuerung === 'fehler'
            ? 'Versuche diese Schritte'
            : d.name,
    },
    ...(d.steuerung === 'stapel' ? [{ name: 'VAR', art: 'text' as const, standard: 'Aktuelle Datei' }] : []),
  ],
  hilfe: d.hilfe + ' Nur Python. Einstellungen und Tabellenzuordnung über Eigenschaften.',
}));
export function standardKonfiguration(def: BusinessDefinition): Record<string, JsonWert> {
  return structuredClone(Object.fromEntries(def.felder.map((f) => [f.name, f.standard])));
}
/** Formulare und mitgelieferte Pläne werden vor Vorschau, Test und Export identisch normalisiert. */
export function businessKonfigurationFuerLauf(
  operation: string,
  k: Record<string, JsonWert>,
): Record<string, JsonWert> {
  if (operation === 'daten.werte' && ['ERSETZEN', 'LEERWERTE'].includes(String(k.aktion))) {
    const literal = (v: JsonWert): JsonWert =>
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      (v.art === 'wert' || (Object.hasOwn(v, 'typ') && Object.hasOwn(v, 'wert')))
        ? { art: 'wert', ...v }
        : { art: 'wert', typ: 'TEXT', wert: v };
    return {
      ...k,
      ...(k.aktion === 'ERSETZEN' ? { suchen: literal(k.suchen) } : {}),
      ...(k.aktion === 'ERSETZEN' || k.leere === 'ERSETZEN' ? { ersatz: literal(k.ersatz) } : {}),
    };
  }
  if (operation !== 'daten.pruefen' || !Array.isArray(k.regeln)) return k;
  const fest = (wert: JsonWert, typ: JsonWert): JsonWert => {
    if (
      wert &&
      typeof wert === 'object' &&
      !Array.isArray(wert) &&
      (wert.art === 'wert' || (Object.hasOwn(wert, 'typ') && Object.hasOwn(wert, 'wert')))
    )
      return { art: 'wert', ...wert };
    if (wert && typeof wert === 'object' && !Array.isArray(wert))
      return { art: 'wert', typ: typ ?? 'TEXT', wert };
    let roh = wert;
    if (typ === 'GANZZAHL' || typ === 'ZAHL') {
      const z = Number(String(wert).replace(',', '.'));
      if (!String(wert).trim() || !Number.isFinite(z) || (typ === 'GANZZAHL' && !Number.isInteger(z)))
        throw new Error('Gib für die Prüfgrenze eine gültige Zahl ein.');
      roh = z;
    } else if (typ === 'WAHRHEIT') {
      if (!['true', 'false', 'wahr', 'falsch'].includes(String(wert).toLowerCase()))
        throw new Error('Ein Wahrheitswert muss wahr oder falsch lauten.');
      roh = ['true', 'wahr'].includes(String(wert).toLowerCase());
    }
    return { art: 'wert', typ: typ ?? (typeof wert === 'number' ? 'ZAHL' : 'TEXT'), wert: roh };
  };
  return {
    ...k,
    regeln: k.regeln.map((regel) => {
      if (!regel || typeof regel !== 'object' || Array.isArray(regel))
        throw new Error('Eine Prüfregel ist ungültig.');
      const r = regel,
        art = r.art;
      if (art === 'NICHT_LEER') return { art, spalte: r.spalte };
      if (art === 'EINDEUTIG')
        return { art, spalten: Array.isArray(r.spalten) && r.spalten.length ? r.spalten : [r.spalte] };
      if (art === 'TYP') return { art, spalte: r.spalte, typ: r.typ };
      if (art === 'ERLAUBTE_WERTE')
        return {
          art,
          spalte: r.spalte,
          werte: Array.isArray(r.werte) ? r.werte.map((w) => fest(w, r.typ)) : [],
        };
      if (art === 'BEREICH' || art === 'ZEILENZAHL') {
        const grenzen: Record<string, JsonWert> = { art, ...(art === 'BEREICH' ? { spalte: r.spalte } : {}) };
        for (const name of ['minimum', 'maximum'])
          if (r[name] !== undefined && r[name] !== '' && r[name] !== null) {
            if (art === 'BEREICH') grenzen[name] = fest(r[name], r.typ);
            else {
              const roh = r[name];
              const n = Number(roh && typeof roh === 'object' && !Array.isArray(roh) ? roh.wert : roh);
              if (!Number.isSafeInteger(n) || n < 0)
                throw new Error('Eine erwartete Zeilenzahl muss eine ganze Zahl ab 0 sein.');
              grenzen[name] = n;
            }
          }
        if (!Object.hasOwn(grenzen, 'minimum') && !Object.hasOwn(grenzen, 'maximum'))
          throw new Error('Gib mindestens eine Prüfgrenze an.');
        return grenzen;
      }
      throw new Error('Wähle eine unterstützte Prüfregel aus.');
    }),
  };
}
export function businessDatenLesen(typ: string, data?: string): Omit<BusinessSchritt, 'id' | 'operation'> {
  const def = businessNachTyp.get(typ);
  if (!def) throw new Error('Dieser Business-Baustein ist unbekannt.');
  if (!data) return { konfiguration: standardKonfiguration(def), eingaben: {} };
  let roh: unknown;
  try {
    roh = JSON.parse(data);
  } catch {
    throw new Error('Die Einstellungen dieses Business-Bausteins sind beschädigt.');
  }
  jsonDatenPruefen(roh);
  if (
    !roh ||
    Array.isArray(roh) ||
    typeof roh !== 'object' ||
    Object.keys(roh).some((k) => !['konfiguration', 'eingaben'].includes(k))
  )
    throw new Error('Die Business-Einstellungen sind ungültig.');
  const r = roh as Record<string, JsonWert>;
  if (
    !r.konfiguration ||
    Array.isArray(r.konfiguration) ||
    typeof r.konfiguration !== 'object' ||
    !r.eingaben ||
    Array.isArray(r.eingaben) ||
    typeof r.eingaben !== 'object'
  )
    throw new Error('Die Business-Einstellungen sind unvollständig.');
  if (
    Object.keys(r.konfiguration).some((k) => !def.felder.some((f) => f.name === k)) ||
    Object.keys(r.eingaben).some((k) => !Object.hasOwn(def.eingaben, k))
  )
    throw new Error('Der Baustein enthält unbekannte Einstellungen oder Tabellenanschlüsse.');
  return { konfiguration: { ...standardKonfiguration(def), ...r.konfiguration }, eingaben: r.eingaben };
}
