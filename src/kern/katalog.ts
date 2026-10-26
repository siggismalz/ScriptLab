import { kategoriefarben } from '../gestaltung/tokens';
import { businessBlocklyDefinitionen } from './business-katalog';

export type WertTyp = 'String' | 'Number' | 'Boolean' | 'Array' | 'Any';
export interface Eingabe {
  name: string;
  typ: WertTyp | 'Statement';
  optional?: boolean;
}
export interface Feld {
  name: string;
  art: 'text' | 'zahl' | 'auswahl';
  standard: string | number;
  optionen?: [string, string][];
  min?: number;
  max?: number;
}
export interface BausteinDefinition {
  typ: string;
  name: string;
  kategorie: string;
  farbe: string;
  hilfe: string;
  form: 'start' | 'anweisung' | 'wert' | 'ende';
  ausgabe?: WertTyp;
  nachricht: string;
  eingaben: Eingabe[];
  felder: Feld[];
}
const textfeld = (name: string, standard = ''): Feld => ({ name, art: 'text', standard });
const zahlenfeld = (name: string, standard: number, min?: number, max?: number): Feld => ({
  name,
  art: 'zahl',
  standard,
  min,
  max,
});
const auswahlfeld = (name: string, optionen: [string, string][]): Feld => ({
  name,
  art: 'auswahl',
  standard: optionen[0][1],
  optionen,
});
const eingabe = (name: string, typ: Eingabe['typ'], optional = false): Eingabe => ({ name, typ, optional });
const katalog: BausteinDefinition[] = [];
function bausteinHinzufuegen(
  typ: string,
  name: string,
  kategorie: string,
  farbe: string,
  form: BausteinDefinition['form'],
  nachricht: string,
  eingaben: Eingabe[],
  felder: Feld[],
  hilfe: string,
  ausgabe?: WertTyp,
): void {
  katalog.push({
    typ: `sl_${typ}`,
    name,
    kategorie,
    farbe,
    form,
    nachricht,
    eingaben,
    felder,
    hilfe,
    ausgabe,
  });
}
// Weiße Bausteinbeschriftungen behalten auf allen Kategorien mindestens 4,5:1 Kontrast.
const farbeAblauf = kategoriefarben.Ablauf,
  farbeBedingungen = kategoriefarben.Bedingungen,
  farbeSchleifen = kategoriefarben.Schleifen,
  farbeDateien = kategoriefarben['Dateien und Ordner'],
  farbeVariablen = kategoriefarben['Variablen und Listen'],
  farbeTexte = kategoriefarben.Texte,
  farbeZahlen = kategoriefarben.Zahlen,
  farbeEingabenAusgaben = kategoriefarben['Ein- und Ausgaben'],
  farbeDatumZeit = kategoriefarben['Datum und Zeit'];
bausteinHinzufuegen(
  'start',
  'Workflow starten',
  'Ablauf',
  farbeAblauf,
  'start',
  'Workflow starten',
  [],
  [],
  'Genau ein Startbaustein bildet den Anfang des Hauptablaufs. Die Verbindungen bestimmen die Reihenfolge.',
);
bausteinHinzufuegen(
  'comment',
  'Kommentar hinzufügen',
  'Ablauf',
  farbeAblauf,
  'anweisung',
  'Kommentar %1',
  [],
  [textfeld('TEXT', 'Mein Hinweis')],
  'Ein lesbarer Hinweis im exportierten Script. Kommentare lösen keine Aktion aus.',
);
bausteinHinzufuegen(
  'end',
  'Workflow beenden',
  'Ablauf',
  farbeAblauf,
  'ende',
  'Workflow beenden',
  [],
  [],
  'Beendet das ausgeführte Script mit Erfolg.',
);
bausteinHinzufuegen(
  'if',
  'Wenn / sonst',
  'Bedingungen',
  farbeBedingungen,
  'anweisung',
  'Wenn %1 dann %2 sonst %3',
  [eingabe('BEDINGUNG', 'Boolean'), eingabe('DANN', 'Statement', true), eingabe('SONST', 'Statement', true)],
  [],
  'Führt abhängig von einer Wahrheitsbedingung einen der beiden Abläufe aus.',
);
bausteinHinzufuegen(
  'compare',
  'Werte vergleichen',
  'Bedingungen',
  farbeBedingungen,
  'wert',
  '%1 %2 %3',
  [eingabe('A', 'Any'), eingabe('B', 'Any')],
  [
    auswahlfeld('OP', [
      ['gleich', 'EQ'],
      ['ungleich', 'NE'],
      ['größer', 'GT'],
      ['kleiner', 'LT'],
    ]),
  ],
  'Vergleicht zwei Werte. Texte werden unter Beachtung der Groß- und Kleinschreibung verglichen.',
  'Boolean',
);
bausteinHinzufuegen(
  'logic',
  'Und / oder',
  'Bedingungen',
  farbeBedingungen,
  'wert',
  '%1 %2 %3',
  [eingabe('A', 'Boolean'), eingabe('B', 'Boolean')],
  [
    auswahlfeld('OP', [
      ['und', 'AND'],
      ['oder', 'OR'],
    ]),
  ],
  'Verknüpft zwei Bedingungen. VBScript wertet beide Bedingungen aus.',
  'Boolean',
);
bausteinHinzufuegen(
  'not',
  'Bedingung umkehren',
  'Bedingungen',
  farbeBedingungen,
  'wert',
  'Nicht %1',
  [eingabe('WERT', 'Boolean')],
  [],
  'Kehrt wahr und falsch um.',
  'Boolean',
);
bausteinHinzufuegen(
  'exists',
  'Datei oder Ordner vorhanden',
  'Bedingungen',
  farbeBedingungen,
  'wert',
  '%1 vorhanden: %2',
  [eingabe('PFAD', 'String')],
  [
    auswahlfeld('ART', [
      ['Datei', 'DATEI'],
      ['Ordner', 'ORDNER'],
    ]),
  ],
  'Prüft beim Scriptstart einen Pfad. Relative Pfade beziehen sich im Export auf den Speicherort der VBS-Datei und im ausdrücklich gestarteten Test auf den gewählten Basisordner.',
  'Boolean',
);
bausteinHinzufuegen(
  'repeat',
  'Eine Anzahl wiederholen',
  'Schleifen',
  farbeSchleifen,
  'anweisung',
  'Wiederhole %1-mal %2',
  [eingabe('ANZAHL', 'Number'), eingabe('ABLAUF', 'Statement', true)],
  [],
  'Wiederholt den Ablauf mit einer ganzen Anzahl zwischen 0 und 1.000.000. Die Anzahl wird einmal am Anfang ausgewertet.',
);
bausteinHinzufuegen(
  'while',
  'Solange wiederholen',
  'Schleifen',
  farbeSchleifen,
  'anweisung',
  'Solange %1 %2',
  [eingabe('BEDINGUNG', 'Boolean'), eingabe('ABLAUF', 'Statement', true)],
  [],
  'Wiederholt den Ablauf, solange die Bedingung wahr ist. Achte darauf, dass der Ablauf die Bedingung beenden kann.',
);
bausteinHinzufuegen(
  'foreach',
  'Für jeden Listeneintrag',
  'Schleifen',
  farbeSchleifen,
  'anweisung',
  'Für jeden Eintrag %1 in %2 %3',
  [eingabe('LISTE', 'Array'), eingabe('ABLAUF', 'Statement', true)],
  [textfeld('VAR', 'Eintrag')],
  'Durchläuft eine Liste. Die benannte Variable enthält jeweils den aktuellen Eintrag.',
);
bausteinHinzufuegen(
  'foreach_file',
  'Für jede Datei im Ordner',
  'Schleifen',
  farbeSchleifen,
  'anweisung',
  'Für jede Datei %1 im Ordner %2 %3',
  [eingabe('PFAD', 'String'), eingabe('ABLAUF', 'Statement', true)],
  [textfeld('VAR', 'Dateipfad')],
  'Durchläuft die Dateien eines vorhandenen Ordners ohne Unterordner. Die Variable enthält den vollständigen Dateipfad. Reihenfolge nach Dateiname.',
);
bausteinHinzufuegen(
  'mkdir',
  'Ordner anlegen',
  'Dateien und Ordner',
  farbeDateien,
  'anweisung',
  'Ordner anlegen %1',
  [eingabe('PFAD', 'String')],
  [],
  'Legt fehlende Ordner einschließlich Elternordnern an. Ein vorhandener Ordner bleibt erhalten; eine gleichnamige Datei ist ein Fehler.',
);
for (const [art, name] of [
  ['copy', 'Datei kopieren'],
  ['move', 'Datei verschieben'],
] as const)
  bausteinHinzufuegen(
    art,
    name,
    'Dateien und Ordner',
    farbeDateien,
    'anweisung',
    `${name} von %1 nach %2 Ziel vorhanden: %3`,
    [eingabe('QUELLE', 'String'), eingabe('ZIEL', 'String')],
    [
      auswahlfeld('ZIELREGEL', [
        ['Fehler melden', 'FEHLER'],
        ['Überschreiben', 'ERSETZEN'],
      ]),
    ],
    'Bearbeitet genau eine Datei ohne Platzhalter. Fehlende Quellen und gleiche Pfade sind Fehler. Bei „Überschreiben“ wird eine vorhandene Zieldatei ersetzt; der Zielordner muss existieren.',
  );
bausteinHinzufuegen(
  'rename',
  'Datei umbenennen',
  'Dateien und Ordner',
  farbeDateien,
  'anweisung',
  'Datei umbenennen %1 neuer Name %2',
  [eingabe('QUELLE', 'String'), eingabe('NAME', 'String')],
  [],
  'Benennt eine vorhandene Datei im gleichen Ordner um. Der neue Name darf keinen Pfad enthalten. Vorhandene Ziele führen zu einem Fehler.',
);
bausteinHinzufuegen(
  'list_files',
  'Dateien auflisten',
  'Dateien und Ordner',
  farbeDateien,
  'wert',
  'Dateien im Ordner %1',
  [eingabe('PFAD', 'String')],
  [],
  'Liefert eine Liste vollständiger Dateipfade, sortiert nach Dateiname. Unterordner werden nicht durchsucht. Ein fehlender Ordner ist ein Fehler.',
  'Array',
);
bausteinHinzufuegen(
  'basename',
  'Dateiname aus Pfad',
  'Dateien und Ordner',
  farbeDateien,
  'wert',
  'Dateiname aus Pfad %1',
  [eingabe('PFAD', 'String')],
  [],
  'Liefert den letzten Namen eines Dateipfads einschließlich Dateiendung, beispielsweise bericht.txt. Die Datei muss dafür nicht existieren.',
  'String',
);
bausteinHinzufuegen(
  'read_text',
  'Textdatei lesen',
  'Dateien und Ordner',
  farbeDateien,
  'wert',
  'Textdatei lesen %1 Kodierung %2',
  [eingabe('PFAD', 'String')],
  [
    auswahlfeld('KODIERUNG', [
      ['UTF-8', 'UTF8'],
      ['UTF-16LE', 'UTF16'],
      ['Windows-ANSI', 'ANSI'],
    ]),
  ],
  'Liest eine vorhandene Textdatei. Die Kodierung muss zur Datei passen. Windows-ANSI verwendet die lokale Windows-Codepage.',
  'String',
);
for (const [art, name] of [
  ['write_text', 'Textdatei schreiben'],
  ['append_text', 'Textdatei ergänzen'],
] as const)
  bausteinHinzufuegen(
    art,
    name,
    'Dateien und Ordner',
    farbeDateien,
    'anweisung',
    `${name} %1 Text %2 Kodierung %3`,
    [eingabe('PFAD', 'String'), eingabe('TEXT', 'String')],
    [
      auswahlfeld('KODIERUNG', [
        ['UTF-8', 'UTF8'],
        ['UTF-16LE', 'UTF16'],
        ['Windows-ANSI', 'ANSI'],
      ]),
    ],
    art === 'write_text'
      ? 'Schreibt die gesamte Datei und ersetzt vorhandenen Inhalt. Der Elternordner muss existieren. UTF-8 und UTF-16LE werden mit BOM geschrieben.'
      : 'Hängt Text ohne zusätzlichen Zeilenumbruch an. Eine fehlende Datei wird angelegt. Eine vorhandene Datei muss bereits dieselbe Kodierung haben; nutze „Zeilenumbruch“ für eine neue Zeile.',
  );
bausteinHinzufuegen(
  'delete',
  'Datei löschen (erweitert)',
  'Dateien und Ordner',
  kategoriefarben['Erweitertes Löschen'],
  'anweisung',
  '⚠ Datei löschen %1 Rückfrage %2',
  [eingabe('PFAD', 'String')],
  [
    auswahlfeld('RUECKFRAGE', [
      ['Ja, vor Löschen fragen', 'JA'],
      ['Nein, ohne Rückfrage', 'NEIN'],
    ]),
  ],
  'Erweiterter Block: löscht genau eine vorhandene Datei ohne Platzhalter. Standardmäßig fragt das vom Nutzer gestartete Script vor dem Löschen. Fehlende Dateien sind Fehler.',
);
bausteinHinzufuegen(
  'set',
  'Variable anlegen / setzen',
  'Variablen und Listen',
  farbeVariablen,
  'anweisung',
  'Setze Variable %1 auf %2',
  [eingabe('WERT', 'Any')],
  [textfeld('VAR', 'Mein Wert')],
  'Legt einen Wert unter einem verständlichen Namen ab. Namen unterscheiden sich nicht nach Groß- und Kleinschreibung.',
);
bausteinHinzufuegen(
  'get',
  'Variable verwenden',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  'Variable %1',
  [],
  [textfeld('VAR', 'Mein Wert')],
  'Liest eine zuvor benannte Variable. Sie sollte vor dem ersten Lesen im Ablauf gesetzt werden.',
  'Any',
);
bausteinHinzufuegen(
  'text',
  'Text',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  'Text %1',
  [],
  [textfeld('TEXT', 'Hallo')],
  'Ein Textwert. Anführungszeichen und Sonderzeichen bleiben reine Daten.',
  'String',
);
bausteinHinzufuegen(
  'number',
  'Zahl',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  'Zahl %1',
  [],
  [textfeld('ZAHL', '5')],
  'Eine Zahl, beispielsweise 5 oder 2,5. Punkt und Komma werden als Dezimaltrennzeichen akzeptiert, Tausendertrennzeichen nicht.',
  'Number',
);
bausteinHinzufuegen(
  'bool',
  'Wahrheitswert',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  '%1',
  [],
  [
    auswahlfeld('WERT', [
      ['wahr', 'WAHR'],
      ['falsch', 'FALSCH'],
    ]),
  ],
  'Ein Wahrheitswert für Bedingungen.',
  'Boolean',
);
bausteinHinzufuegen(
  'list',
  'Liste erstellen',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  'Leere Liste erstellen',
  [],
  [],
  'Erstellt eine leere Liste. Speichere sie in einer Variable und füge anschließend Einträge hinzu.',
  'Array',
);
bausteinHinzufuegen(
  'list_add',
  'Eintrag zur Liste hinzufügen',
  'Variablen und Listen',
  farbeVariablen,
  'anweisung',
  'Füge %1 zur Liste %2 hinzu',
  [eingabe('WERT', 'Any')],
  [textfeld('VAR', 'Meine Liste')],
  'Hängt einen Eintrag an eine Listenvariable an. Die Variable muss zuvor mit „Liste erstellen“ gesetzt werden.',
);
bausteinHinzufuegen(
  'list_get',
  'Listeneintrag lesen',
  'Variablen und Listen',
  farbeVariablen,
  'wert',
  'Eintrag %1 aus Liste %2',
  [eingabe('INDEX', 'Number'), eingabe('LISTE', 'Array')],
  [],
  'Liest einen Listeneintrag. Die Nummerierung beginnt bei 1; ein fehlender Eintrag ist ein Fehler.',
  'Any',
);
bausteinHinzufuegen(
  'join',
  'Texte verbinden',
  'Texte',
  farbeTexte,
  'wert',
  'Verbinde %1 mit %2',
  [eingabe('A', 'Any'), eingabe('B', 'Any')],
  [],
  'Verbindet zwei Werte zu Text.',
  'String',
);
bausteinHinzufuegen(
  'newline',
  'Zeilenumbruch',
  'Texte',
  farbeTexte,
  'wert',
  'Zeilenumbruch',
  [],
  [],
  'Ein Windows-Zeilenumbruch (CRLF), beispielsweise zum Ergänzen einer Protokolldatei.',
  'String',
);
bausteinHinzufuegen(
  'replace',
  'Text ersetzen',
  'Texte',
  farbeTexte,
  'wert',
  'In %1 ersetze %2 durch %3',
  [eingabe('TEXT', 'String'), eingabe('SUCHEN', 'String'), eingabe('ERSATZ', 'String')],
  [],
  'Ersetzt alle passenden Textstellen. Groß- und Kleinschreibung werden beachtet.',
  'String',
);
bausteinHinzufuegen(
  'len',
  'Textlänge',
  'Texte',
  farbeTexte,
  'wert',
  'Länge von %1',
  [eingabe('TEXT', 'String')],
  [],
  'Ermittelt die Textlänge in UTF-16-Codeeinheiten, wie in VBScript üblich.',
  'Number',
);
bausteinHinzufuegen(
  'case',
  'Groß- / Kleinschreibung',
  'Texte',
  farbeTexte,
  'wert',
  '%1 von %2',
  [eingabe('TEXT', 'String')],
  [
    auswahlfeld('ART', [
      ['Großschreibung', 'GROSS'],
      ['Kleinschreibung', 'KLEIN'],
    ]),
  ],
  'Ändert die Schreibweise entsprechend den regionalen Windows-Einstellungen.',
  'String',
);
bausteinHinzufuegen(
  'contains',
  'Enthaltenen Text prüfen',
  'Texte',
  farbeTexte,
  'wert',
  '%1 enthält %2',
  [eingabe('TEXT', 'String'), eingabe('SUCHEN', 'String')],
  [],
  'Prüft, ob Text enthalten ist. Groß- und Kleinschreibung werden beachtet.',
  'Boolean',
);
bausteinHinzufuegen(
  'math',
  'Grundrechenart',
  'Zahlen',
  farbeZahlen,
  'wert',
  '%1 %2 %3',
  [eingabe('A', 'Number'), eingabe('B', 'Number')],
  [
    auswahlfeld('OP', [
      ['+', 'ADD'],
      ['−', 'SUB'],
      ['×', 'MUL'],
      ['÷', 'DIV'],
    ]),
  ],
  'Rechnet mit zwei Zahlen. Division durch null beendet das Script mit einer verständlichen Fehlermeldung.',
  'Number',
);
bausteinHinzufuegen(
  'round',
  'Zahl runden',
  'Zahlen',
  farbeZahlen,
  'wert',
  'Runde %1 auf %2 Nachkommastellen',
  [eingabe('WERT', 'Number')],
  [zahlenfeld('STELLEN', 0, 0, 12)],
  'Rundet auf 0 bis 12 Nachkommastellen. VBScript verwendet bei genau halben Werten die Rundung zur geraden Zahl.',
  'Number',
);
bausteinHinzufuegen(
  'random',
  'Zufallszahl erzeugen',
  'Zahlen',
  farbeZahlen,
  'wert',
  'Zufällige ganze Zahl von %1 bis %2',
  [eingabe('MIN', 'Number'), eingabe('MAX', 'Number')],
  [],
  'Erzeugt eine nicht kryptografische ganze Zufallszahl einschließlich beider Grenzen.',
  'Number',
);
bausteinHinzufuegen(
  'output',
  'Text ausgeben',
  'Ein- und Ausgaben',
  farbeEingabenAusgaben,
  'anweisung',
  'Gib Text aus %1',
  [eingabe('TEXT', 'String')],
  [],
  'Gibt Text mit einem Zeilenende aus: unter cscript.exe in der Textausgabe, unter wscript.exe als Windows-Nachricht. Der Script-Host wird vor dem Zugriff auf den Ausgabestream geprüft. Die Vorschau zeigt nur Code.',
);
bausteinHinzufuegen(
  'message',
  'Nachricht anzeigen',
  'Ein- und Ausgaben',
  farbeEingabenAusgaben,
  'anweisung',
  'Zeige eine Nachricht %1',
  [eingabe('TEXT', 'Any')],
  [],
  'Zeigt beim Ausführen des Scripts eine Windows-Nachricht. Auch unter cscript.exe öffnet dieser Baustein einen Dialog; für reine Textausgabe eignet sich „Text ausgeben“.',
);
bausteinHinzufuegen(
  'input',
  'Texteingabe abfragen',
  'Ein- und Ausgaben',
  farbeEingabenAusgaben,
  'wert',
  'Frage nach Text %1',
  [eingabe('TEXT', 'String')],
  [],
  'Zeigt beim späteren Scriptstart eine Texteingabe. Abbrechen und eine leere Eingabe liefern jeweils leeren Text.',
  'String',
);
bausteinHinzufuegen(
  'question',
  'Ja-/Nein-Frage',
  'Ein- und Ausgaben',
  farbeEingabenAusgaben,
  'wert',
  'Frage mit Ja oder Nein %1',
  [eingabe('TEXT', 'String')],
  [],
  'Liefert wahr bei Ja und falsch bei Nein.',
  'Boolean',
);
bausteinHinzufuegen(
  'log',
  'Protokollzeile schreiben',
  'Ein- und Ausgaben',
  farbeEingabenAusgaben,
  'anweisung',
  'Protokollzeile %1 in Datei %2',
  [eingabe('TEXT', 'String'), eingabe('PFAD', 'String')],
  [],
  'Hängt Datum, Uhrzeit, Text und CRLF an eine UTF-8-Datei an. Eine vorhandene Datei muss UTF-8 sein. Der Elternordner muss existieren.',
);
bausteinHinzufuegen(
  'date',
  'Aktuelles Datum',
  'Datum und Zeit',
  farbeDatumZeit,
  'wert',
  'Aktuelles Datum',
  [],
  [],
  'Liefert das aktuelle lokale Datum als Datumswert.',
  'Any',
);
bausteinHinzufuegen(
  'time',
  'Aktuelle Uhrzeit',
  'Datum und Zeit',
  farbeDatumZeit,
  'wert',
  'Aktuelle Uhrzeit',
  [],
  [],
  'Liefert die aktuelle lokale Uhrzeit als Datumswert.',
  'Any',
);
bausteinHinzufuegen(
  'date_format',
  'Datum formatieren',
  'Datum und Zeit',
  farbeDatumZeit,
  'wert',
  'Formatiere %1 als %2',
  [eingabe('WERT', 'Any')],
  [
    auswahlfeld('FORMAT', [
      ['JJJJ-MM-TT', 'DATUM'],
      ['HH:MM:SS', 'ZEIT'],
      ['JJJJ-MM-TT HH:MM:SS', 'BEIDES'],
    ]),
  ],
  'Formatiert einen Datumswert mit festen, sprachunabhängigen Ziffern. Ungültige Datumswerte sind Fehler.',
  'String',
);
bausteinHinzufuegen(
  'sleep',
  'Eine Zeit warten',
  'Datum und Zeit',
  farbeDatumZeit,
  'anweisung',
  'Warte %1 Sekunden',
  [eingabe('SEKUNDEN', 'Number')],
  [],
  'Wartet im später gestarteten Script 0 bis 86.400 Sekunden. ScriptLab selbst wartet beim Export nicht.',
);
export const grundBausteine = katalog;
export const bausteinDefinitionen = [...katalog, ...businessBlocklyDefinitionen];
export const definitionNachTyp = new Map(bausteinDefinitionen.map((d) => [d.typ, d]));
