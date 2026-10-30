import type { BusinessDefinition, KonfigFeld } from './business-katalog';

const text = (name: string, titel: string, standard = ''): KonfigFeld => ({
  name,
  titel,
  art: 'text',
  standard,
});
const zahl = (name: string, titel: string, standard: number): KonfigFeld => ({
  name,
  titel,
  art: 'zahl',
  standard,
  darstellung: 'weitere',
});
const wahl = (name: string, titel: string, optionen: string[]): KonfigFeld => ({
  name,
  titel,
  art: 'auswahl',
  optionen,
  standard: optionen[0],
});
const definition = (
  typ: string,
  name: string,
  operation: string,
  ausgabe: BusinessDefinition['ausgabe'],
  eingaben: BusinessDefinition['eingaben'],
  felder: KonfigFeld[],
  hilfe: string,
  schreibt = false,
): BusinessDefinition => ({
  typ: `sl_biz_ml_${typ}`,
  name,
  operation: `ml.${operation}`,
  gruppe: 'Machine Learning',
  ausgabe,
  eingaben,
  felder,
  hilfe,
  schreibt,
  komponenten: ['ml-cpu'],
});

export const mlDefinitionen: BusinessDefinition[] = [
  definition(
    'train',
    'Modell trainieren',
    'trainieren',
    'MLModell',
    { tabelle: 'Tabelle' },
    [
      wahl('aufgabe', 'Aufgabe', ['KLASSIFIKATION', 'REGRESSION']),
      wahl('verfahren', 'Modellverfahren', ['RANDOM_FOREST', 'PYTORCH']),
      text('zielspalte', 'Vorherzusagende Spalte'),
      {
        name: 'merkmale',
        titel: 'Eingabespalten',
        art: 'spalten',
        standard: [],
        hilfe:
          'Die Zielspalte darf nicht zu den Eingabespalten gehören. Zahlen und Kategorien werden anhand der Trainingsdaten vorbereitet.',
      },
      zahl('testanteil', 'Anteil unabhängiger Testdaten (0,05–0,5)', 0.2),
      zahl('zufallsseed', 'Zufallsseed für reproduzierbare Aufteilung', 42),
      zahl('baeume', 'Bäume im Random Forest', 100),
      zahl('max_tiefe', 'Maximale Baumtiefe', 12),
      zahl('epochen', 'Trainingsepochen des neuronalen Netzes', 50),
    ],
    'Trainiert nur bei echter Ausführung ein CPU-Modell. Vorbereitung und Skalierung lernen ausschließlich aus den Trainingsdaten. Die getrennten Testdaten bewerten dasselbe Modell, das gespeichert werden kann.',
  ),
  definition(
    'save',
    'Modell speichern',
    'speichern',
    'Datei',
    { modell: 'MLModell' },
    [
      text('pfad', 'Modelldatei', 'modell.slmodell'),
      wahl('konflikt', 'Bei vorhandener Modelldatei', ['FEHLER', 'UEBERSPRINGEN', 'NEUER_NAME', 'ERSETZEN']),
    ],
    'Speichert Modell, Spaltenschema und bestätigte Qualitätswerte in einer .slmodell-Datei. Im Prüflauf wird nur das Ziel geplant.',
    true,
  ),
  definition(
    'load',
    'Modell laden',
    'laden',
    'MLModell',
    {},
    [text('pfad', 'Modelldatei', 'modell.slmodell')],
    'Lädt beim bewusst gestarteten Lauf ein unterstütztes ScriptLab-Modell. Python-Pickle und beliebige Fremdmodelle werden nicht geladen.',
  ),
  definition(
    'predict',
    'Vorhersagen erzeugen',
    'vorhersagen',
    'Tabelle',
    { modell: 'MLModell', tabelle: 'Tabelle' },
    [text('ausgabespalte', 'Neue Vorhersagespalte', 'Vorhersage')],
    'Wendet das gespeicherte Modell samt derselben Vorverarbeitung auf neue Daten an. Reihenfolge und Originalspalten bleiben erhalten. Eine vorhandene Spalte wird nicht überschrieben.',
  ),
];
