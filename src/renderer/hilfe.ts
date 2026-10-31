/** Lokale Hilfetexte. Die Oberfläche rendert ausschließlich React-Text, kein HTML oder Markdown. */
import type { Skriptsprache } from '../kern/sprachen';
import type { BeispielKennung } from '../gemeinsam/bruecke';
import { businessBeispiele } from '../kern/business-beispiele';
export type { BeispielKennung } from '../gemeinsam/bruecke';

export interface BeispielInfo {
  id: BeispielKennung;
  skriptsprache: Skriptsprache;
  name: string;
  dateiname: string;
  beschreibung: string;
  lernziele: readonly string[];
  vorbereitung: string;
  aufgabe: 'Einstieg' | 'Dateien' | 'Daten' | 'Dokumente';
  ergebnis: string;
  dokumentvorlagen?: readonly string[];
}

/** Metadaten der drei VBS-Vorlagen; die Python-Fassungen verweisen unten auf eigene Projektdateien. */
const vbsBeispiele: readonly BeispielInfo[] = [
  {
    id: 'begruessung',
    skriptsprache: 'vbs',
    name: 'Eine Nachricht anzeigen',
    dateiname: '01-Begruessung.scriptlab',
    aufgabe: 'Einstieg',
    ergebnis: 'Ein ausdrücklich gestarteter Lauf zeigt eine Nachricht an. Es werden keine Dateien geändert.',
    beschreibung: 'Ein Startbaustein und eine Nachricht bilden einen ersten vollständigen Ablauf.',
    lernziele: ['Anweisungen verbinden', 'Nachrichtentext bearbeiten', 'Ausführung und Export verstehen'],
    vorbereitung: 'Für dieses Beispiel sind keine Testdateien nötig.',
  },
  {
    id: 'backup',
    skriptsprache: 'vbs',
    name: 'Eine Testdatei sichern',
    dateiname: '02-Datei-Backup.scriptlab',
    aufgabe: 'Dateien',
    ergebnis:
      'Eine unveränderte Quelldatei und eine inhaltsgleiche Sicherung; vorhandene Sicherungen werden erhalten.',
    beschreibung:
      'Prüft eine einzelne Testdatei, legt einen Sicherungsordner an und kopiert die Datei dorthin.',
    lernziele: ['Dateipfade festlegen', 'Eine Bedingung verwenden', 'Vorhandene Zieldateien beachten'],
    vorbereitung:
      'Beim Verwenden der Vorlage wird eine kleine synthetische Quelldatei in den eigenen Arbeitsordner kopiert. Erst der bewusste Lauf erzeugt ScriptLab-Testdaten\\Backup\\Sicherung\\beispiel.txt; vorhandene Sicherungen werden nicht überschrieben. Für einen eigenständigen Export den Ordner ScriptLab-Testdaten mit der Quelldatei neben die VBS-Datei kopieren. Den Arbeitsordner findest du unter „Läufe → Laufeinstellungen → Arbeitsordner“.',
  },
  {
    id: 'dateiliste',
    skriptsprache: 'vbs',
    name: 'Dateinamen als Textliste speichern',
    dateiname: '03-Dateinamenliste.scriptlab',
    aufgabe: 'Dateien',
    ergebnis: 'Drei mitgelieferte Dateinamen in einer UTF-8-Textdatei; Unterordner bleiben unberücksichtigt.',
    beschreibung:
      'Sammelt die Dateinamen eines Testordners und schreibt sie zeilenweise in eine UTF-8-Textdatei.',
    lernziele: [
      'Eine Dateiliste durchlaufen',
      'Dateinamen aus Pfaden lesen',
      'Text mit Zeilenumbrüchen schreiben',
    ],
    vorbereitung:
      'Beim Verwenden der Vorlage werden synthetische Eingangsdateien in den eigenen Arbeitsordner kopiert. Erst der bewusste Lauf erstellt oder ersetzt ScriptLab-Testdaten\\Dateiliste\\Dateinamen.txt. Unterordner werden nicht durchsucht. Für einen eigenständigen Export den Ordner ScriptLab-Testdaten mit den Eingangsdateien neben die VBS-Datei kopieren. Öffnen und Exportieren führen den Workflow nicht aus.',
  },
];
const pythonDateien: Record<string, string> = {
  begruessung: '04-Python-Begruessung.scriptlab',
  backup: '05-Python-Datei-Backup.scriptlab',
  dateiliste: '06-Python-Dateinamenliste.scriptlab',
};
export const beispiele: readonly BeispielInfo[] = [
  ...businessBeispiele.map((b) => ({
    id: b.id,
    skriptsprache: 'python' as const,
    name: b.name,
    dateiname: `business/${b.ordner}/workflow.scriptlab`,
    aufgabe: (
      [
        'business-monat',
        'business-bestellungen',
        'business-ml-klassifikation',
        'business-ml-regression',
      ] as readonly string[]
    ).includes(b.id)
      ? ('Daten' as const)
      : b.id === 'business-stapel'
        ? ('Dateien' as const)
        : ('Dokumente' as const),
    ergebnis: b.erwartung,
    ...(b.id === 'business-bestellvorschlag' ? { dokumentvorlagen: ['Bestellung.docx'] } : {}),
    beschreibung: b.beschreibung,
    lernziele: ['Parameter, Strukturprüfung, Vorschau und echte Ausführung unterscheiden'],
    vorbereitung: b.id.startsWith('business-ml-')
      ? 'Benötigt für die Ausführung zusätzliche Komponenten unter Einstellungen → Automatisierungen. Die Vorlage erstellt eine eigene ML-Workflowkopie mit synthetischen CSV-Daten. Nur echte Ausführung trainiert und speichert ein Modell; der Prüflauf plant diese Schritte. Für neue Läufe bestehende Ausgaben prüfen. Die 20 Vorhersagezeilen sind nicht die unabhängigen Testdaten der Qualitätsbewertung. Öffnen startet weder Training noch Einrichtung.'
      : 'Verwendet die mitgelieferten Business-Komponenten. Beim Verwenden der Vorlage werden synthetische Testdateien in den Arbeitsordner eines eigenen Workflows kopiert. Der Bezug bleibt beim Speichern und Wiederherstellen erhalten. Für eigene Geschäftsdaten die Quellen bewusst ändern und Ausgabeziele prüfen. PDF-Berichte können die mitgelieferte Vera-Schrift verwenden. Öffnen startet keine Verarbeitung.',
  })),
  ...vbsBeispiele,
  ...vbsBeispiele.map((beispiel): BeispielInfo => ({
    ...beispiel,
    id: `${beispiel.id}-python` as BeispielKennung,
    skriptsprache: 'python',
    dateiname: pythonDateien[beispiel.id],
    lernziele: beispiel.lernziele.map((ziel) => ziel.replaceAll('VBS', 'Python')),
    vorbereitung: beispiel.vorbereitung.replaceAll('VBS-Datei', 'Python-Datei'),
  })),
];

export interface HilfeAbschnitt {
  id: string;
  titel: string;
  texte: readonly string[];
  schritte?: readonly string[];
  beispiel?: BeispielKennung;
}

export interface HilfeArtikel {
  id: string;
  titel: string;
  beschreibung: string;
  abschnitte: readonly HilfeAbschnitt[];
}

export const hilfeArtikel: readonly HilfeArtikel[] = [
  {
    id: 'erste-schritte',
    titel: 'Workflow bauen',
    beschreibung: 'Einen Ablauf aus Bausteinen zusammensetzen, ändern und speichern.',
    abschnitte: [
      {
        id: 'erster-ablauf',
        titel: 'Eine erste Nachricht anzeigen',
        texte: [
          'Beginne mit einem kleinen Ablauf. Das Hinzufügen und Bearbeiten von Bausteinen führt noch nichts aus.',
        ],
        schritte: [
          'Klicke auf „Neuer Workflow“, wähle „Automatisierung“ und bestätige „Workflow erstellen“. Alles für diesen Einstieg ist bereits enthalten.',
          'Suche links nach „Nachricht“. Klicke bei „Nachricht anzeigen“ auf Plus und wähle die Einfügestelle nach „Workflow starten“. Alternativ ziehst du den Baustein an den Anschluss.',
          'Ändere den Nachrichtentext im Baustein. Für längere Eingaben öffnest du „Eigenschaften“.',
          'Klicke auf „Workflow ausführen“. Erst jetzt wird die Nachricht angezeigt.',
          'Klicke auf „Speichern“, um den Ablauf für später zu behalten.',
        ],
        beispiel: 'begruessung',
      },
      {
        id: 'bearbeiten',
        titel: 'Bausteine verbinden, ändern und löschen',
        texte: [
          'Die Verbindungen bestimmen die Reihenfolge. Ein Baustein, der nur daneben liegt, gehört noch nicht zum Ablauf. Werte passen in die entsprechend geformten Eingänge.',
          'Wähle einen Baustein aus und öffne „Eigenschaften“, um seine Angaben zu bearbeiten. Beim Wechsel zwischen „Ablauf“, „Daten und Parameter“ und „Läufe“ bleibt deine Arbeit erhalten.',
          'Zum Löschen wählst du den Baustein im Ablauf aus und nutzt den Löschknopf oder drückst Entfernen. „Rückgängig“ stellt eine versehentliche Änderung wieder her. Während eines Laufs sind Änderungen gesperrt.',
        ],
      },
      {
        id: 'workflow-speichern',
        titel: 'Arbeit behalten oder eine Vorlage ausprobieren',
        texte: [
          '„Speichern“ behält den Workflow. „Ungespeicherte Änderungen“ am Namen bedeutet, dass dein aktueller Stand noch nicht gespeichert ist. Ein erfolgreicher Lauf speichert den Workflow nicht automatisch.',
          'Unter „Vorlagen“ wählst du einen Beispielworkflow und öffnest eine eigene bearbeitbare Kopie. Die mitgelieferte Vorlage bleibt erhalten. „Weiterbearbeiten“ bringt dich zu deinem bereits geöffneten Workflow zurück.',
          '„Exportieren“ erstellt auf Wunsch eine Projektdatei zum Weiterbearbeiten oder eine ausführbare Fassung zum Weitergeben. Der Export führt den Ablauf nicht aus.',
        ],
      },
    ],
  },
  {
    id: 'dateien-verwenden',
    titel: 'Dateien verwenden',
    beschreibung: 'Die richtige Quelle auswählen, CSV-Spalten prüfen und Ausgabeziele bewusst festlegen.',
    abschnitte: [
      {
        id: 'dateipfad',
        titel: 'Eine eigene Quelldatei auswählen',
        texte: [
          'Der Dateipfad einer Quelle benennt die Eingabe; ein Ausgabeziel bestimmt, wo ein echter Lauf neue Ergebnisse ablegt. Verwende zum Ausprobieren eine Kopie oder die mitgelieferten Beispieldaten.',
        ],
        schritte: [
          'Wähle den lesenden Baustein aus und öffne „Eigenschaften“ oder „Daten und Parameter → Quellen“.',
          'Wähle die Quelldatei über die vorhandene Dateiauswahl. Du kannst auch genau eine lokale Datei auf ihr Pfadfeld oder auf den passenden Quellbaustein ziehen.',
          'Prüfe den vollständigen Pfad. Relative Pfade beziehen sich auf den Arbeitsordner dieses Workflows; du findest ihn unter „Läufe → Laufeinstellungen → Arbeitsordner“.',
          'Das Auswählen oder Ablegen übernimmt nur den Pfad. Lade die Vorschau oder starte den Workflow anschließend bewusst.',
        ],
        beispiel: 'backup',
      },
      {
        id: 'csv-spalten',
        titel: 'CSV-Datei erscheint als eine einzige Spalte',
        texte: [
          'CSV-Dateien können ihre Werte mit Komma, Semikolon oder Tabulator trennen. Die Einstellung muss zur Datei passen. ScriptLab ändert sie nicht automatisch.',
        ],
        schritte: [
          'Wenn in der Datenvorschau mehrere Spaltennamen in einer Kopfzelle stehen, klicke auf „Trennzeichen prüfen“, sofern der Hinweis angeboten wird.',
          'Alternativ öffnest du „Quelle konfigurieren“. Prüfe im lesenden CSV-Baustein das Feld „Trennzeichen“: zum Beispiel ; oder ,.',
          'Kehre zur Vorschau zurück und klicke erneut auf „Datenvorschau laden“. Vergleiche Spaltennamen und einige bekannte Werte mit deiner Datei.',
        ],
      },
      {
        id: 'datei-parameter',
        titel: 'Testdaten, echte Daten und vorhandene Ziele',
        texte: [
          'Unter „Daten und Parameter → Parameter“ bearbeitest du vorhandene Workflowparameter. „Testdaten“ und „Echte Daten“ sind zwei Sätze von Werten; ihr Wechsel allein führt nichts aus.',
          'Ein gebundener Quellenpfad verwendet einen Parameter oder eine Variable. Ändere dessen Zuordnung bewusst in „Daten und Parameter“, statt sie durch einen Dateidrop zu ersetzen.',
          'Bei „Tabelle als CSV/XLSX/JSON/Parquet speichern“ kannst du „Speicherort (optional)“ als festen Wert leer lassen. ScriptLab übernimmt dann den Namen der eindeutigen Quelldatei mit der gewählten Endung und speichert im Arbeitsordner. Bei mehreren Quellen heißt die Ausgabe Auswertung. Belegte Namen werden nummeriert; vorhandene Dateien werden beim automatischen Speichern niemals ersetzt.',
          'Einen eigenen Speicherort kannst du weiterhin angeben; dann gilt die gewählte Einstellung für vorhandene Ziele. Ein leerer Parameter oder eine leere gebundene Variable ist ein Fehler und wählt keinen automatischen Speicherort. Die Datenvorschau erzeugt keine fachlichen Ausgabedateien.',
        ],
      },
    ],
  },
  {
    id: 'ausfuehren-ergebnisse',
    titel: 'Ausführen und Ergebnisse prüfen',
    beschreibung: 'Bewusst starten, eine Tabelle vorab ansehen und Ergebnisse dem richtigen Lauf zuordnen.',
    abschnitte: [
      {
        id: 'workflow-starten',
        titel: 'Den aktuellen Workflow ausführen',
        texte: [
          '„Workflow ausführen“ im Kopf startet den vollständigen aktuellen Ablauf mit den vorhandenen Werten. Auch ungespeicherte Änderungen werden verwendet. Wähle für den ersten Versuch entbehrliche Dateien.',
        ],
        schritte: [
          'Prüfe Quellen, Parameter und Ausgabeziele.',
          'Klicke einmal auf „Workflow ausführen“. Du kannst dabei im Ablauf oder in der Datenansicht bleiben.',
          'Beobachte Status und Ausgabe. „Stoppen“ fordert den Abbruch an; warte auf das gemeldete Prozessende.',
        ],
      },
      {
        id: 'daten-vorab',
        titel: 'Tabellendaten vorab ansehen',
        texte: [
          'Die Datenvorschau liest die für den gewählten Schritt nötigen Quellen und zeigt einen begrenzten Ausschnitt. Sie ersetzt keine Prüfung der vollständigen Ergebnisdatei.',
        ],
        schritte: [
          'Öffne „Daten und Parameter → Vorschau“.',
          'Wähle unter „Ergebnis bis zu diesem Schritt“ den Tabellenschritt und unter „Verwendete Werte“ den passenden Parametersatz.',
          'Klicke auf „Datenvorschau laden“. Suche, Sortierung und Seitenwechsel beziehen sich nur auf die geladenen Vorschauzeilen.',
          'Wenn der Stand als geändert markiert ist, lade die Vorschau nach deinen Korrekturen erneut.',
        ],
      },
      {
        id: 'ergebnis-beurteilen',
        titel: 'Was wurde tatsächlich erledigt?',
        texte: [
          '„Ergebnis ansehen“ öffnet das zugehörige Ergebnis unter „Läufe“. Status, vorhandene Dateiausgaben, Hinweise und Ausgabe stehen dort zusammen. „Verlauf anzeigen“ öffnet frühere Läufe; ihre Auswahl startet nichts.',
          'Prüfe erzeugte Dateien auch inhaltlich: stimmen zum Beispiel Zeilenanzahl, Summen, Dateinamen und Dokumenttexte? Ein beendet gemeldeter Lauf allein bestätigt nicht das fachlich gewünschte Ergebnis.',
          'Für Datenabläufe kannst du unter „Läufe → Laufeinstellungen“ einen Prüflauf wählen. Er prüft und plant, ohne fachliche Ausgabeziele zu verändern. Der normale Hauptknopf „Workflow ausführen“ bleibt echte Ausführung.',
          'Nach Stoppen, Zeitlimit oder einem Fehler können bereits erzeugte Dateien bestehen bleiben. ScriptLab macht erfolgte Dateiänderungen nicht automatisch rückgängig.',
        ],
      },
    ],
  },
  {
    id: 'probleme-tastatur',
    titel: 'Fehler beheben und aufräumen',
    beschreibung: 'Eine Meldung gezielt korrigieren, Entwürfe löschen und die Workflowliste ordnen.',
    abschnitte: [
      {
        id: 'fehler-beheben',
        titel: 'Eine fehlende oder falsche Angabe korrigieren',
        texte: [
          'Fehlermeldungen bleiben sichtbar, bis du sie schließt oder das Problem bearbeitest. Lies zuerst den genannten Baustein und das betroffene Feld.',
        ],
        schritte: [
          'Nutze den angebotenen Verweis auf den Baustein oder das Feld. Fehlende Pflichtparameter führen zu „Daten und Parameter“.',
          'Prüfe bei Dateifehlern den vollständigen Pfad, die Erreichbarkeit des Ordners und ob die Datei in einem anderen Programm geöffnet ist.',
          'Prüfe bei CSV-Daten das Trennzeichen, wenn alle Werte in einer Spalte erscheinen.',
          'Korrigiere die Angabe und starte die Vorschau oder den Lauf erneut. Allein die Korrektur startet keine Verarbeitung.',
        ],
      },
      {
        id: 'entwurf-aufraeumen',
        titel: 'Einen Entwurf löschen',
        texte: [
          'Ein Entwurf ist ein lokal gesicherter Zwischenstand. Er ist von einer gespeicherten Projektdatei zu unterscheiden.',
        ],
        schritte: [
          'Öffne „Workflows“ und wähle „Entwürfe“.',
          'Prüfe den Namen des Entwurfs. Nutze bei Bedarf zuerst „Fortsetzen“ oder „Als Projekt speichern“.',
          'Klicke auf „Entwurf löschen“ und bestätige die Rückfrage. Nur die lokale Entwurfssicherung wird gelöscht; eine zugehörige Projektdatei bleibt erhalten.',
        ],
      },
      {
        id: 'workflowliste-aufraeumen',
        titel: 'Einen gespeicherten Workflow aus der Liste entfernen',
        texte: [
          '„Aus Liste entfernen“ entfernt nur den Eintrag aus ScriptLab. Die gespeicherte Datei bleibt erhalten und kann über „Workflow öffnen“ wieder ausgewählt werden.',
        ],
        schritte: [
          'Öffne „Workflows“ und suche den gewünschten Eintrag.',
          'Klicke bei diesem Eintrag auf „Aus Liste entfernen“. Verwechsle dies nicht mit dem Löschen eines Entwurfs.',
          'Wenn du die Datei selbst verwalten möchtest, öffne über ihre Details „Ordner anzeigen“. Prüfe im Explorer den Speicherort und die Datei, bevor du sie dort entfernst.',
        ],
      },
      {
        id: 'bedienung-erleichtern',
        titel: 'Ansicht und Tastatur nutzen',
        texte: [
          'Unter „Einstellungen → Aussehen“ wählst du das Farbschema und die Textgröße. Die Zoomknöpfe im Ablauf ändern nur die Ansicht der Bausteine.',
          'Tab und Umschalt+Tab wechseln zwischen Bedienelementen. Im Ablauf macht Strg+Z die letzte Änderung rückgängig; Entfernen löscht den ausgewählten Baustein. Strg+S speichert den Workflow.',
        ],
      },
    ],
  },
];

export interface HilfeTreffer {
  artikelId: string;
  artikelTitel: string;
  abschnittId: string;
  abschnittTitel: string;
  ausschnitt: string;
}

/** Jeder Treffer trägt eine konkrete Artikelstelle; kein externes Laden und kein HTML-Parsing. */
export function hilfeDurchsuchen(suche: string): HilfeTreffer[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  if (!filter) return [];
  return hilfeArtikel.flatMap((artikel) => {
    const abschnitte = artikel.abschnitte.filter((abschnitt) =>
      [abschnitt.titel, ...abschnitt.texte, ...(abschnitt.schritte ?? [])].some((text) =>
        text.toLocaleLowerCase('de').includes(filter),
      ),
    );
    if (
      !abschnitte.length &&
      `${artikel.titel} ${artikel.beschreibung}`.toLocaleLowerCase('de').includes(filter)
    )
      abschnitte.push(artikel.abschnitte[0]!);
    return abschnitte.map((abschnitt) => {
      const text =
        [...abschnitt.texte, ...(abschnitt.schritte ?? [])].find((text) =>
          text.toLocaleLowerCase('de').includes(filter),
        ) ??
        abschnitt.texte[0] ??
        '';
      const position = text.toLocaleLowerCase('de').indexOf(filter);
      const anfang = Math.max(0, position - 64);
      const ende = Math.min(text.length, Math.max(anfang + 180, position + filter.length + 48));
      return {
        artikelId: artikel.id,
        artikelTitel: artikel.titel,
        abschnittId: abschnitt.id,
        abschnittTitel: abschnitt.titel,
        ausschnitt: `${anfang ? '…' : ''}${text.slice(anfang, ende)}${ende < text.length ? '…' : ''}`,
      };
    });
  });
}
