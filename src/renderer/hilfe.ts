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
}

/** Metadaten der drei VBS-Vorlagen; die Python-Fassungen verweisen unten auf eigene Projektdateien. */
const vbsBeispiele: readonly BeispielInfo[] = [
  {
    id: 'begruessung',
    skriptsprache: 'vbs',
    name: 'Eine Nachricht anzeigen',
    dateiname: '01-Begruessung.scriptlab',
    beschreibung: 'Ein Startbaustein und eine Nachricht bilden einen ersten vollständigen Ablauf.',
    lernziele: ['Anweisungen verbinden', 'Nachrichtentext bearbeiten', 'VBS-Vorschau und Export verstehen'],
    vorbereitung: 'Für dieses Beispiel sind keine Testdateien nötig.',
  },
  {
    id: 'backup',
    skriptsprache: 'vbs',
    name: 'Dateien in einen Sicherungsordner kopieren',
    dateiname: '02-Datei-Backup.scriptlab',
    beschreibung:
      'Prüft eine einzelne Testdatei, legt einen Sicherungsordner an und kopiert die Datei dorthin.',
    lernziele: ['Dateipfade festlegen', 'Eine Bedingung verwenden', 'Vorhandene Zieldateien beachten'],
    vorbereitung:
      'Für einen bewusst gestarteten Test die Datei ScriptLab-Testdaten\\Backup\\Quelle\\beispiel.txt im gewählten Basisordner selbst anlegen; für einen eigenständigen Start neben der exportierten VBS-Datei. Die Sicherung entsteht unter ScriptLab-Testdaten\\Backup\\Sicherung\\beispiel.txt. Eine vorhandene Sicherung wird nicht überschrieben. Öffnen und Exportieren starten das Beispiel nicht.',
  },
  {
    id: 'dateiliste',
    skriptsprache: 'vbs',
    name: 'Dateinamen in eine Textdatei schreiben',
    dateiname: '03-Dateinamenliste.scriptlab',
    beschreibung:
      'Sammelt die Dateinamen eines Testordners und schreibt sie zeilenweise in eine UTF-8-Textdatei.',
    lernziele: [
      'Eine Dateiliste durchlaufen',
      'Dateinamen aus Pfaden lesen',
      'Text mit Zeilenumbrüchen schreiben',
    ],
    vorbereitung:
      'Für einen bewusst gestarteten Test den Ordner ScriptLab-Testdaten\\Dateiliste\\Eingang mit entbehrlichen Testdateien im gewählten Basisordner anlegen; für einen eigenständigen Start neben der exportierten VBS-Datei. ScriptLab-Testdaten\\Dateiliste\\Dateinamen.txt wird bei der Ausführung erstellt oder ersetzt. Unterordner werden nicht durchsucht. Öffnen und Exportieren starten das Beispiel nicht.',
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
    beschreibung: b.beschreibung,
    lernziele: [b.erwartung, 'Parameter, Strukturprüfung, Vorschau und echte Ausführung unterscheiden'],
    vorbereitung:
      'Benötigt die bewusst eingerichtete Business-Laufzeit. „Als Vorlage verwenden“ erzeugt eine private Kopie der synthetischen Testdateien und bindet die Pfadparameter absolut daran. Der Bezug bleibt beim Speichern und Wiederherstellen erhalten. Für eigene Geschäftsdaten Quellen und Ziele bewusst ändern. PDF-Berichte können die mitgelieferte Vera-Schrift verwenden. Öffnen startet keine Verarbeitung.',
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
    titel: 'Erste Schritte',
    beschreibung: 'Eine Sprache wählen, mit Bausteinen arbeiten und als Script exportieren.',
    abschnitte: [
      {
        id: 'erster-ablauf',
        titel: 'Deinen ersten Ablauf erstellen',
        texte: [
          'Mit „Neuer Workflow“ auf der Startseite, „Workflow → Neuer Workflow“ im Editor oder Strg+N wählst du zuerst Python oder VBScript (VBS). Beim ersten Mal ist keine Sprache vorausgewählt. Erst „Workflow erstellen“ öffnet den Editor mit einem Startbaustein. Abbrechen lässt den bisherigen Workflow unverändert. Die zuletzt erfolgreich gewählte Sprache wird bei der nächsten Erstellung vorgeschlagen.',
          'Die Sprache bleibt für dieses Projekt fest. Python wird für Geschäftsprozesse empfohlen. Die 48 Grundbausteintypen gibt es in beiden Sprachen; Python bietet zusätzlich 47 Business-Bausteintypen für Tabellen, Excel, Word, PDF und Geschäftsdateien. Für eine andere Sprache erstellst du einen neuen Workflow. Bestehende Projekte werden nicht umgestellt.',
        ],
        schritte: [
          'Suche links nach „Nachricht“.',
          'Klicke neben „Nachricht anzeigen“ auf Plus und wähle „Nach Workflow starten“.',
          'Ändere den Text direkt im Baustein oder öffne die Eigenschaften mit F4.',
          'Speichere mit „Speichern“ eine bearbeitbare .scriptlab-Datei.',
          'Öffne bei Bedarf „Ansicht → Codevorschau öffnen“. Unter „Exportieren“ wählst du bei „Inhalt“ das Scriptformat deiner Sprache und anschließend „Ausgabeort auswählen“.',
        ],
        beispiel: 'begruessung',
      },
      {
        id: 'bewusste-ausfuehrung',
        titel: 'Nur bewusst gestartete Tests führen den Workflow aus',
        texte: [
          'Bearbeiten, Öffnen, Wiederherstellen, Codevorschau, Strukturprüfung, Speichern, Signieren und Export starten keine Verarbeitung. Nur ein bewusst gestarteter echter Test führt den vollständigen Workflow aus. Business-Abläufe bieten zusätzlich eine Datenvorschau und einen Prüflauf ohne fachliche Zieländerungen. Es gibt keine automatische Ausführung oder Zeitplanung.',
          'Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen. Er ist keine Sandbox; Stoppen macht bereits vorgenommene Änderungen nicht rückgängig.',
          'Nach dem Export entscheidest du selbst, ob du das Script außerhalb von ScriptLab ausführst. Dafür müssen die passende Python- beziehungsweise VBS-Laufzeit vorhanden sein und die Richtlinien den Start erlauben. ScriptLab wird beim Empfänger nicht benötigt.',
        ],
      },
      {
        id: 'test-vorbereiten',
        titel: 'Einen Test vorbereiten und seine Ausgabe verstehen',
        texte: [
          'Öffne „Läufe → Vorbereitung“. Der Ansichtswechsel startet keinen Workflow. Wähle mit „Ordner auswählen“ einen Basisordner und klappe bei Bedarf „Zeitlimit“ auf: gewöhnlich 120 Sekunden, erlaubt 1 bis 28800. Business-Profile bieten eigene Vorgaben bis acht Stunden. Relative Pfade werden auf den sichtbaren Basisordner bezogen. Absolute Pfade können außerhalb wirken. Nutze zuerst entbehrliche Dateien.',
          '„Testen“ im Editor und „Workflow ausführen“ beziehen sich auf den vollständigen aktuellen Hauptablauf, nicht nur den ausgewählten Baustein. Ist der Laufkontext noch nicht geprüft, erscheint zuerst die Vorbereitung. Während eines Laufs sind inhaltliche Änderungen gesperrt. Ein Lauf speichert weder dein Projekt noch eine Exportdatei.',
          '„Text ausgeben“ schreibt unter „Läufe → Protokoll“. „Nachricht anzeigen“, Texteingaben, Ja-/Nein-Fragen und die Löschrückfrage öffnen Dialoge; bei Python ist dafür tkinter erforderlich. Stoppen und das Zeitlimit beenden den Lauf; bereits erfolgte Änderungen bleiben bestehen.',
          '„Übersicht“ zeigt den Laufstatus, „Ergebnisse“ die zugehörigen Ausgaben und Prüfhinweise. Unter „Laufstand und technische Angaben“ stehen Sprache, tatsächlich verwendete Python-Version, Lauf-ID, Standkennung, Startzeit, Laufzeit, Pfadbasis und Exitcode. Ein Ergebnis mit Exitcode 0 bestätigt ein Ende ohne gemeldeten Fehler, nicht die Ungefährlichkeit oder das gewünschte Dateiergebnis. Nach einer Workflowänderung erscheint ein Hinweis auf den früheren Stand.',
          'Unter „Protokoll“ betreffen „Ausgabe kopieren“ und „Ausgabe leeren“ nur den angezeigten Text, auch während eines Laufs. Beim Hochscrollen folgt die Anzeige neuen Zeilen nicht automatisch; „Zum Ausgabeende“ führt zurück. „Technische Details“ zeigt den schreibgeschützten Laufquelltext und vorhandene Fehlerzuordnungen. „Baustein anzeigen“ führt zum zugeordneten Baustein.',
        ],
      },
    ],
  },
  {
    id: 'bausteine',
    titel: 'Bausteine hinzufügen, verbinden und bearbeiten',
    beschreibung: 'Palette, Suche, Verbindungen und Eigenschaften nutzen.',
    abschnitte: [
      {
        id: 'hinzufuegen',
        titel: 'Mit Ziehen oder einzelnen Klicks hinzufügen',
        texte: [
          'Die Palette ordnet Bausteine nach Aufgaben: „Ablauf steuern“, „Daten verarbeiten“, „Dateien und Ordner“, „Dokumente erstellen“ sowie „Werte und Eingaben“. Es erscheinen nur Einstiege mit Bausteinen für die gewählte Sprache. Die Suche durchsucht direkt alle verfügbaren Kategorien; „Suche leeren“ führt zur vorherigen Palettenansicht zurück.',
          'Ziehe am Bausteinnamen auf die Arbeitsfläche. Eine Einfügemarkierung zeigt einen passenden Anschluss. Escape bricht das Ziehen ab und stellt den vorherigen Zustand wieder her.',
          'Ohne gehaltene Maustaste: Klicke auf Plus und danach auf eine angebotene Einfügestelle. Du kannst auch einen Zielbaustein auf der Arbeitsfläche anklicken. Hat er mehrere passende Anschlüsse, wählst du anschließend links den gewünschten aus.',
        ],
      },
      {
        id: 'bearbeiten',
        titel: 'Werte ändern und Bausteine umordnen',
        texte: [
          'Die Verbindungen bestimmen die Reihenfolge, nicht die Position auf dem Raster. Werte und Bedingungen passen in die entsprechend geformten Eingänge.',
          'Häufige Werte änderst du direkt im Baustein. „Eigenschaften“ oder F4 öffnet Hilfe, ein Wirkungsbeispiel und normal große Eingabefelder. Beide Ansichten bearbeiten denselben Wert; lange Texte und Pfade sind vollständig auswählbar.',
          'Variablen wählst du aus derselben Liste im Baustein oder in den Eigenschaften. „Neue Variable anlegen“ erstellt einen Eintrag. Das Blockly-Auswahlmenü bietet das Umbenennen. Die feste interne ID bleibt dabei erhalten; alle Bezüge derselben Variable verwenden den neuen Namen.',
          'Zum Umordnen: Baustein auswählen, in den Eigenschaften „Verschieben“ wählen und auf die neue Einfügestelle klicken. Innere Abläufe bleiben erhalten. Rückgängig und Wiederholen korrigieren Änderungen; gelöschte Bausteine lassen sich rückgängig wiederherstellen.',
        ],
      },
      {
        id: 'ansicht',
        titel: 'Arbeitsfläche und Schriftgröße einstellen',
        texte: [
          'Mausrad, Bildlaufleisten, Ziehen an einer freien Stelle und die Ansichtspfeile verschieben die Arbeitsfläche. Strg+Mausrad zoomt nur über der Arbeitsfläche. In der Palette scrollt das Rad deren Inhalt.',
          'Die Zoomknöpfe verkleinern, vergrößern, setzen auf 100 Prozent zurück oder zeigen mit „Alles anzeigen“ den gesamten Ablauf. „Bereiche → Einstellungen → Darstellung → Textgröße der Oberfläche“ verändert die Bedientexte unabhängig vom Canvas-Zoom.',
          'Eigenschaften und „Ansicht → Codevorschau öffnen“ sind optional. Bei schmalen Fenstern überlagern die Eigenschaften den rechten Rand; bei genügend Platz lassen sie sich anheften. Palette und Codevorschau sind an ihren Trennlinien verstellbar.',
        ],
      },
    ],
  },
  {
    id: 'bedingungen-schleifen',
    titel: 'Bedingungen und Schleifen',
    beschreibung: 'Entscheidungen treffen und Schritte wiederholen.',
    abschnitte: [
      {
        id: 'bedingungen',
        titel: 'Wenn und sonst',
        texte: [
          '„Wenn / sonst“ besitzt einen Bedingungseingang und zwei innere Abläufe. Beim späteren eigenen Start wird abhängig von der Bedingung genau der passende Zweig verwendet. Leere Zweige sind erlaubt.',
          'Vergleiche Werte mit gleich, ungleich, größer oder kleiner. „Und / oder“ verknüpft Bedingungen; „Bedingung umkehren“ vertauscht wahr und falsch. „Datei oder Ordner vorhanden“ prüft den angegebenen Pfad erst im später gestarteten Script.',
        ],
        beispiel: 'backup',
      },
      {
        id: 'schleifen',
        titel: 'Wiederholungen festlegen',
        texte: [
          '„Eine Anzahl wiederholen“ wiederholt den inneren Ablauf eine ganze Anzahl von Malen. „Solange wiederholen“ prüft die Bedingung vor jedem Durchlauf. Plane darin eine Änderung ein, durch die die Bedingung wieder falsch werden kann.',
          '„Für jeden Listeneintrag“ stellt jeden Wert einer Liste in einer benannten Variable bereit. „Für jede Datei im Ordner“ verwendet vollständige Dateipfade und durchsucht keine Unterordner; die Reihenfolge ist nach Dateiname sortiert.',
          'Schleifen und Bedingungen dürfen ineinander liegen. Verbinde Anweisungen innerhalb des gewünschten inneren Ablaufs; eine nur daneben abgelegte Anweisung gehört nicht automatisch dazu.',
        ],
        beispiel: 'dateiliste',
      },
    ],
  },
  {
    id: 'projekte-entwuerfe',
    titel: 'Projekte und Entwürfe',
    beschreibung: 'Projektdateien, bekannte Speicherorte und gesicherte Zwischenstände unterscheiden.',
    abschnitte: [
      {
        id: 'projektdateien',
        titel: 'Als Projektdatei speichern',
        texte: [
          'Eine .scriptlab-Datei enthält den bearbeitbaren Workflow mit fester Sprache, Verbindungen, Variablen-IDs, Werten, Kommentaren und Ansicht. Unvollständige Abläufe dürfen als Projekt gespeichert werden. .py und .vbs sind Exportdateien und lassen sich nicht als Bausteinprojekt zurückimportieren.',
          'Aktuelle Projekte verwenden Schema 3 mit Workflowparametern und nicht geheimen Test-/Echtwerten. Schema 1 wird als VBS übernommen, Schema 2 behält seine Sprache und erhält leere Business-Angaben. Öffnen verändert keine Quelldatei. Erst Speichern schreibt das aktuelle Format. Unbekannte neuere Formate werden abgewiesen.',
          '„Speichern“ sichert das aktuelle Projekt; „Workflow → Speichern unter“ wählt einen anderen Speicherort. Namen und Beschreibung änderst du unter „Workflow → Projektangaben“. Ein Script- oder Paketexport speichert die Projektdatei nicht automatisch.',
          'Bei ungespeicherten Änderungen fragt ScriptLab vor einem möglichen Verlust nach: „Speichern“, „Als Entwurf behalten“, „Änderungen verwerfen“ oder „Abbrechen“. „Als Entwurf behalten“ erlaubt den Wechsel erst nach erfolgreicher lokaler Sicherung; die Projektdatei bleibt unverändert. „Änderungen verwerfen“ verwirft den ungespeicherten Stand bewusst. „Abbrechen“ oder ein abgebrochener Speicherdialog verhindert den abhängigen Projektwechsel.',
        ],
      },
      {
        id: 'bekannte-projekte',
        titel: 'Bekannte Projekte wiederfinden',
        texte: [
          '„Meine gespeicherten Workflows“ zeigt bekannte Projektdateien mit ihrem tatsächlichen Pfad und ihrer Sprache. Suche nach Name oder Pfad, filtere nach Sprache und sortiere nach Name oder dem letzten Öffnen. Die Liste ist ein Verzeichnis bekannter Speicherorte, keine Suche auf deinen Laufwerken. Auch Beispiele und Entwürfe besitzen einen Sprachfilter.',
          'Fehlt eine Datei oder ist ein Laufwerk nicht erreichbar, erscheint der tatsächliche Prüfzustand. Öffne die Zeilendetails am Pfeil neben dem Namen. Mit „Neu zuordnen“ wählst du dort die verschobene Projektdatei aus. „Aus Liste entfernen“ entfernt nur den Verweis; die Projektdatei bleibt erhalten.',
          'Gleichnamige Projekte können unterschiedliche Dateien sein. Prüfe deshalb bei Bedarf den vollständigen Dateipfad; das Pfadfeld lässt sich auswählen und kopieren.',
        ],
      },
      {
        id: 'entwuerfe',
        titel: 'Gesicherte Entwürfe fortsetzen',
        texte: [
          'Die Entwurfsliste enthält lokal gesicherte Zwischenstände. Sie unterscheidet Abläufe ohne Projektdatei und gesicherte Änderungen mit Bezug auf eine vorhandene Datei. Der angezeigte Zeitpunkt gehört zur Entwurfssicherung, nicht zu einem behaupteten Speichern der Projektdatei.',
          'Inhaltliche Änderungen werden nach einer kurzen Eingabepause lokal im Nutzerverzeichnis gesichert. Ein neuer leerer Startablauf und reine Zoomänderungen erzeugen keinen neuen Entwurf. Beachte im Editor den tatsächlichen Sicherungsstatus; eine fehlgeschlagene Sicherung ist kein gesicherter Stand.',
          '„Fortsetzen“ öffnet den gesicherten Stand zum Bearbeiten. „Als Projekt speichern“ bietet einen Speicherort für eine .scriptlab-Datei an. Erst ein erfolgreicher Speichervorgang ist ein gespeichertes Projekt.',
          'Nach erfolgreichem Speichern wird nur der zugehörige Entwurf bereinigt. Bei Abbruch oder Schreibfehler bleibt er erhalten. Wurde die zugehörige Projektdatei außerhalb von ScriptLab verändert oder entfernt, muss der Entwurf als separate Kopie gespeichert werden; die Ausgangsdatei wird nicht automatisch überschrieben.',
          '„Entwurf löschen“ entfernt nach Bestätigung den gesicherten Zwischenstand, nicht eine zugehörige Projektdatei. Ein Entwurf ersetzt keine selbst gewählte Sicherung deiner wichtigen Projektdateien.',
        ],
      },
    ],
  },
  {
    id: 'vbs-export',
    titel: 'Python- und VBS-Export',
    beschreibung: 'Fehler beheben, Dateipfade verstehen und eigenständig exportieren.',
    abschnitte: [
      {
        id: 'pruefen-exportieren',
        titel: 'Prüfen und als Script speichern',
        texte: [
          'Unter „Exportieren“ wählst du das Script oder Business-Paket als Inhalt. Vor dem Schreiben werden die Bausteine geprüft. Fehlende Pflichtwerte, falsche Verbindungen und lose aktive Anweisungen verhindern den Export. Die Hinweisübersicht nennt den betroffenen Baustein; ein Klick führt dorthin.',
          'Gewöhnliche Python-Projekte erzeugen einzelne .py-Dateien, VBS-Projekte .vbs-Dateien. Python-Business-Projekte erzeugen ein ZIP mit Script, eigenen Modulen, Requirements, Anleitung und Parameterbeispiel. Alle Varianten funktionieren ohne ScriptLab oder Node.js. Die 48 Grundbausteintypen benötigen keine zusätzlichen Python-Pakete; Business-Bausteine den bewusst vorbereiteten festen Paketsatz. Dialoge benötigen tkinter.',
          'Die optionale Codevorschau zeigt ausschließlich Text. Sie führt den Ablauf nicht aus. Nach dem Export erscheint: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ „Speicherordner anzeigen“ öffnet nur den Ordner und startet die Datei nicht.',
          'Python-Exporte werden als UTF-8 ohne BOM, VBS-Exporte als UTF-16LE mit BOM geschrieben. Beide verwenden Windows-Zeilenenden (CRLF). Identische Workflows und Exportoptionen erzeugen denselben unsignierten Quelltext.',
        ],
      },
      {
        id: 'pfade-dateien',
        titel: 'Dateipfade und vorhandene Dateien',
        texte: [
          'Relative Dateipfade beziehen sich beim Export auf den Ordner der jeweiligen Scriptdatei und beim Test auf den sichtbaren Basisordner. Beide Orte können unterschiedlich sein. Absolute Windows- und UNC-Pfade bleiben absolut und können außerhalb wirken. Gewöhnliche Dateiaktionen erlauben keine Platzhalter; Business-Dateistapel besitzen ausdrücklich ein Feld für ein einfaches Dateimuster.',
          'Kopieren und Verschieben behandeln ein vorhandenes Ziel standardmäßig als Fehler; bewusst gewähltes Überschreiben ersetzt die Zieldatei. Textdatei schreiben ersetzt den Inhalt. Der erweiterte Löschbaustein erzeugt standardmäßig eine Rückfrage im später gestarteten Script.',
          'Die Kodierung der vom Workflow bearbeiteten Textdateien wird gesondert gewählt. UTF-8 und UTF-16LE schreiben eine BOM; Windows-ANSI verwendet die lokale Windows-Codepage. Beim Ergänzen muss eine vorhandene Datei zur ausgewählten Kodierung passen. Fehlerhaftes UTF-8 oder UTF-16LE wird vor dem Überschreiben zurückgewiesen.',
        ],
        beispiel: 'dateiliste',
      },
      {
        id: 'python-verfuegbarkeit',
        titel: 'Python-Installation prüfen',
        texte: [
          'Bearbeiten und Python-Export funktionieren auch ohne Python-Installation. Unterstützt wird stabiles CPython 3.12 bis 3.15 für Windows x64. „Bereiche → Einstellungen“ zeigt den tatsächlichen Prüfstatus, die Version und den geprüften Interpreterpfad. „Interpreter auswählen“ wählt eine konkrete Programmdatei; „Erneut prüfen“ prüft die Installation neu. Unter „Läufe → Vorbereitung → Laufzeitumgebung“ führt „Python einrichten“ zu diesen Einstellungen.',
          'Ein Python-Test verwendet den geprüften Interpreter. Dialogbausteine benötigen tkinter; die Prüfung erfolgt nur bei Bedarf. Abläufe ohne Dialoge benötigen es nicht. ScriptLab installiert keine Python-Grundinstallation und keine Pakete automatisch. Nur die ausdrückliche Business-Einrichtung installiert ihren festen Paketsatz. Eine freie Shell wird nicht angeboten. Der Interpreterpfad bleibt eine lokale Einstellung.',
          'Zum selbstständigen Start einer exportierten .py-Datei verwendest du in PowerShell den tatsächlichen vollständigen Interpreterpfad und den Scriptpfad, zum Beispiel: & "C:\\Python315\\python.exe" -I -u -X utf8 "C:\\Meine Workflows\\Mein Workflow.py". Ersetze beide Beispielpfade durch deine vorhandenen Pfade. Die Optionen isolieren die Modulsuche, entpuffern die Ausgabe und aktivieren UTF-8; sie bilden keine Sicherheits-Sandbox. Ein Doppelklick hängt von Windows-Dateizuordnungen ab und wird nicht vorausgesetzt.',
          '„Offizielle Python-Hilfe“ in den Einstellungen öffnet die fest hinterlegte offizielle Informationsseite. Die lokale Hilfe und die Bearbeitung benötigen keine Internetverbindung.',
        ],
      },
      {
        id: 'vbscript-windows',
        titel: 'VBScript-Verfügbarkeit unter Windows',
        texte: [
          'Microsoft hat VBScript abgekündigt. Die spätere Ausführung hängt von Windows-Version, verfügbarer VBScript-Komponente, Windows Script Host und den geltenden Richtlinien ab. Dateiaktionen verwenden die dokumentierten Windows-Komponenten Scripting.FileSystemObject und gegebenenfalls ADODB.Stream.',
          'ScriptLab kann auch ohne VBScript-Laufzeit bearbeiten, speichern und unsigniert exportieren. Bewusste Tests benötigen die verfügbare Laufzeit und einen von Windows erlaubten Scriptstart. Eine fehlende oder blockierte Laufzeit wird verständlich gemeldet. ScriptLab aktiviert keine Windows-Features und ändert keine Sicherheitsrichtlinien.',
        ],
      },
    ],
  },
  {
    id: 'signaturen',
    titel: 'Signaturen',
    beschreibung: 'Optional mit einem eigenen Zertifikat signieren und das Prüfergebnis verstehen.',
    abschnitte: [
      {
        id: 'einrichten',
        titel: 'Ein eigenes Zertifikat auswählen',
        texte: [
          'Diese optionale Exportfunktion gilt nur für VBS-Projekte. Bei Python-Projekten werden keine VBS-Signaturoptionen angeboten. Für .py ist kein Signaturverfahren implementiert und es wird kein Signaturprüfergebnis angezeigt. Die Signatur der ScriptLab-Anwendung bleibt davon getrennt.',
          'Unter Einstellungen kannst du „Exportierte Datei signieren“ aktivieren und die Zertifikate laden. Benötigt wird ein gültiges Code-Signing-Zertifikat mit verfügbarem privatem Schlüssel im Windows-Zertifikatspeicher. Die Auswahl wird eindeutig über den Fingerabdruck zugeordnet.',
          'ScriptLab schreibt zuerst die fertige VBS-Datei, signiert sie mit SHA-256 und prüft anschließend die Windows-Signatur. Ein optionaler geeigneter Zeitstempeldienst benötigt Netzwerkzugriff. Der Workflowinhalt wird dabei nicht ausgeführt.',
          'Ohne geeignetes Zertifikat kannst du die Option ausschalten und normal unsigniert exportieren. Private Schlüssel, Kennwörter und Entwicklertokens werden nicht mit Projekten oder Anwendung ausgeliefert.',
        ],
      },
      {
        id: 'pruefergebnisse',
        titel: 'Das tatsächliche Ergebnis beachten',
        texte: [
          'ScriptLab unterscheidet „Nicht signiert“, „Signatur gültig“, „Signatur ungültig“, „Zertifikatsvertrauen nicht bestätigt“ und „Prüfung nicht möglich“. Eine fehlgeschlagene gewünschte Signatur erscheint nicht als erfolgreich signierter Export.',
          'Eine Signatur hilft, Herausgeber und Veränderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch die Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen.',
          'Die Signatur der ScriptLab-Anwendung und die Signatur deiner VBS-Dateien sind getrennt. Für eigene Workflows verwendest du dein eigenes oder ausdrücklich bereitgestelltes Zertifikat.',
        ],
      },
    ],
  },
  {
    id: 'business-einrichten',
    titel: 'Business-Laufzeit, Parameter und Modi',
    beschreibung: 'Tabellen- und Dokumentabläufe bewusst vorbereiten und sicher unterscheiden.',
    abschnitte: [
      {
        id: 'business-laufzeit',
        titel: 'Den festen Paketsatz bewusst einrichten',
        texte: [
          'Die Python-Business-Bausteine benötigen den festgelegten Paketsatz für Daten, Excel, Word und PDF. Bearbeiten, Speichern und Export funktionieren auch ohne diese Laufzeit. Zuerst in den Einstellungen eine geeignete CPython-Installation prüfen.',
          'Unter „Business-Laufzeit“ prüft „Business-Komponenten prüfen“ die tatsächlichen Imports und Versionen. „Eigene Umgebung online einrichten“ erstellt bewusst eine neue private virtuelle Umgebung und lädt nur den festen, hashgeprüften Paketsatz. Eine globale Installation wird nicht überschrieben.',
          '„Offline-Paketordner verwenden“ wählt einen von der IT vorbereiteten Ordner mit passenden Original-Wheels. Es werden keine freien Paketnamen oder Befehle angeboten. „Einrichtung abbrechen“ beendet die Einrichtung. Ein Workflowstart installiert niemals Pakete; Python selbst wird nicht automatisch installiert.',
        ],
        schritte: [
          'Einstellungen öffnen und die Python-Installation prüfen.',
          'Business-Komponenten prüfen oder die gewünschte Online-/Offline-Einrichtung bewusst wählen.',
          'Den tatsächlichen Abschluss abwarten. Eine Fehlermeldung ist kein bereiter Laufzeitstand.',
        ],
      },
      {
        id: 'business-parameter',
        titel: 'Testdaten und echte Daten als Werte festlegen',
        texte: [
          '„Workflow → Workflowparameter“ definiert Name, Beschriftung, Wertart, Pflichtangabe und Standardwert. In den Bausteineigenschaften kann ein Feld einen solchen Parameter verwenden. Kennwörter, Tokens und private Schlüssel gehören nicht in diese Werte.',
          '„Läufe → Vorbereitung“ zeigt den gewählten Parametersatz. Unter „Parameterwerte anpassen“ gelten Änderungen zunächst für den nächsten Lauf. „Werte im Parametersatz merken“ übernimmt sie ins Projekt; erst Speichern sichert die Projektdatei.',
          'Die Namen „Testdaten“ und „Echte Daten“ bieten keine Abschirmung. Prüfe die tatsächlich angezeigten Quellen und Ziele. Bei Business-Beispielkopien zeigen die Pfadwerte auf private synthetische Testdaten. Für produktive Dateien musst du diese Werte bewusst ändern.',
        ],
      },
      {
        id: 'business-modi',
        titel: 'Datenvorschau, Prüflauf und Ausführen',
        texte: [
          '„Datenvorschau“ zeigt höchstens 200 Zeilen und 256 KiB. Filter, Sortierung und Gruppierung können dafür trotzdem die vollständige Quelle lesen. Dokumente und Dateiausgaben werden nur geplant. Die Codevorschau dagegen zeigt ausschließlich Text und liest keine Quellen.',
          '„Prüflauf ohne Zieländerungen“ prüft unterstützte Schritte und eigene technische Zwischenfassungen. Fachliche Eingaben und Ziele werden nicht verändert. Ein erfolgreicher Prüflauf ist keine Garantie für einen späteren echten Lauf.',
          'Erst „Ausführen · echte Dateiänderungen“ führt den vollständigen Workflow tatsächlich aus. Gewöhnliche Aktionsblöcke werden nicht heimlich im Business-Vorschau- oder Prüflaufmodus ausgeführt. Stoppen und Zeitlimit nehmen bereits erfolgte Änderungen nicht zurück.',
        ],
      },
      {
        id: 'business-umfang',
        titel: 'Quellen, Ziele und Zeitlimit vor dem Start prüfen',
        texte: [
          'Klappe unter „Läufe → Vorbereitung“ vor dem Start „Quellen und Ausgabeziele“ auf. Prüfe Quelle, Vorlage, Ziel, Archiv und die Regel für vorhandene Dateien. Dynamisch berechnete Dateinamen stehen erst im betreffenden Schritt vollständig fest. Absolute Pfade können außerhalb des Basisordners wirken.',
          'Unter „Weitere Einstellungen“ liegen Laufprofil sowie Speicher- und Tempbudgets. Laufprofile bieten 15 Sekunden für die Vorschau, eine Minute für den Prüflauf, zwei Minuten für die Kurzprüfung, zwei Stunden für Geschäftsabläufe und acht Stunden für große Stapel. Ein Profil ändert nicht den gewählten Modus. Die Budgets betreffen die Datenengine, nicht den gesamten Rechner. „Technische Schrittangaben“ zeigt bei Bedarf die vollständige Konfiguration.',
        ],
        beispiel: 'business-monat',
      },
    ],
  },
  {
    id: 'business-tabellen-dokumente',
    titel: 'Tabellen, Word und PDF mit Beispielen',
    beschreibung: 'Fünf vollständige Abläufe mit synthetischen Daten nachvollziehen.',
    abschnitte: [
      {
        id: 'business-monat',
        titel: 'Monatsdaten auswerten',
        texte: [
          '„Monatliche Auswertung“ liest CSV, wählt den Oktober und fasst Beträge nach Region zusammen. Erwartet werden Nord 150, Süd 80 und insgesamt 230 in XLSX und PDF. PDF-Berichte können die mitgelieferte Vera-Schrift verwenden; eigene Schriften werden nicht aus dem Internet geladen.',
          'Tabellen aus CSV, XLSX, JSON und Parquet werden über Ergebnisverweise weitergegeben. CSV beginnt als Text, damit führende Nullen erhalten bleiben. Lege Zahlen-, Datums- und Dezimaltypen ausdrücklich fest. Erst danach filtern, sortieren, berechnen oder zusammenfassen.',
        ],
        beispiel: 'business-monat',
      },
      {
        id: 'business-zuordnung',
        titel: 'Bestellungen mit Stammdaten verbinden',
        texte: [
          'Das Bestellbeispiel verbindet Kundennummern mit Stammdaten. Drei Bestellungen werden zugeordnet; K9 bleibt ein gemeldeter Fehler. Die zugeordneten Beträge ergeben Nord 45, Süd 40 und insgesamt 85.',
          'Wähle Verknüpfungsschlüssel und erwartete Zuordnung bewusst. Ein doppelter Stammschlüssel darf keine Bestellung unbemerkt vervielfachen. Datenqualitätsblöcke prüfen unter anderem Pflichtwerte, Eindeutigkeit, Typen und erlaubte Bereiche.',
        ],
        beispiel: 'business-bestellungen',
      },
      {
        id: 'business-word',
        titel: 'Einen Word-Bestellvorschlag erzeugen',
        texte: [
          'Das Lagerbeispiel liest XLSX, prüft Bestände und berechnet Zielbestand minus Bestand. Eine Word-Vorlage enthält zwei Positionen für Lieferant S1: 15 und 12, zusammen 27. Artikel mit ausreichendem Bestand werden ausgeschlossen. Es wird keine echte Bestellung versendet.',
          'Word-Bausteine ersetzen unterstützte benannte Platzhalter und wiederholen vorgesehene Tabellenzeilen. Eine Serie kann nach Lieferant gruppieren. Nicht alle Word-Funktionen werden nachgebildet. Vorlagen und fertige Dokumente fachlich und visuell prüfen.',
        ],
        beispiel: 'business-bestellvorschlag',
      },
      {
        id: 'business-pdf',
        titel: 'PDF-Belege als Kopien geordnet ablegen',
        texte: [
          'Das Dokumenteingangsbeispiel enthält zwei PDFs mit eindeutiger Belegnummer und Datum sowie einen Raster-Scan. Zwei Kopien entstehen im Monatsordner; der Scan liefert einen Hinweis. Alle Originale bleiben erhalten. Ein bestehendes Ziel wird mit der Regel Fehler geschützt.',
          'Die PDF-Bausteine lesen vorhandene Textschichten und können Seiten auswählen, teilen oder verbinden. Ein Scan ohne Textschicht wird nicht per OCR gelesen. ScriptLab konvertiert keine Office-Dateien über eine Office-Anwendung.',
        ],
        beispiel: 'business-belege',
      },
      {
        id: 'business-stapel',
        titel: 'Dateistapel prüfen und bestätigt archivieren',
        texte: [
          'Das CSV-Stapelbeispiel schreibt jede gültige CSV vollständig, prüft das Ergebnis und erstellt erst dann die Archivkopie. Erst nach deren Bestätigung wird die gültige Eingangsdatei entfernt. Die fehlerhafte Datei bleibt im Eingang, der Fehler im Bericht.',
          '„Für jede Datei im Stapel“ verwendet eine geprüfte Eingangsliste. „Fehler behandeln und fortfahren“ ist eine bewusste Regel für fachliche Fehler; Stoppen, Zeitlimit und unklare Publikationen dürfen dadurch nicht verschluckt werden. Ein teilweise erfolgreicher Lauf ist kein uneingeschränkter Erfolg.',
        ],
        beispiel: 'business-stapel',
      },
    ],
  },
  {
    id: 'business-export-fortsetzen',
    titel: 'Business-Paket, Laufbericht und Wiederaufnahme',
    beschreibung: 'Eigenständige Pakete exportieren und bestätigte Teilschritte nachvollziehen.',
    abschnitte: [
      {
        id: 'business-paket',
        titel: 'Ein eigenständiges ZIP bewusst zusammenstellen',
        texte: [
          'Wähle „Exportieren → Inhalt → Business-Paket (.zip)“ und „Ausgabeort auswählen“. Die Dateien werden vor dem Schreiben angezeigt. Das ZIP enthält workflow.py, eigene Business-Module, feste Requirements, Parameterbeispiel, Anleitung, Vera-Schrift und Lizenzhinweise. Es funktioniert ohne ScriptLab oder Node.js, benötigt aber eine vorbereitete Python-Umgebung.',
          '„Ressourcen auswählen“ fügt nur ausdrücklich gewählte DOCX-/XLSX-Vorlagen, PNG-/JPEG-Bilder oder TTF-Schriften bei. Geschäftsdaten, Eingangsordner, Berichte und Journale werden nicht automatisch kopiert. Rechte und vertrauliche Inhalte vor Weitergabe prüfen. Höchstens 16 MiB je Ressource und 64 MiB je Paket.',
          'Beim Empfänger das ganze Paket entpacken, die Parameterdatei prüfen und die Umgebung bewusst mit dem festen Paketsatz vorbereiten. Online- und Offlinewege stehen in der Anleitung. Der Scriptstart installiert nichts. Absolute Pfade bleiben absolut und müssen für eine Weitergabe bewusst angepasst werden.',
        ],
      },
      {
        id: 'business-berichte',
        titel: 'Bericht und Wiederaufnahme richtig verwenden',
        texte: [
          'Der Laufbericht hält Workflow, Quellenfingerabdrücke, Parameter, Ergebnisse, Summen, Fehler und Abschlussgrund fest. Berichte und Journale können geschäftlichen Kontext und Pfade enthalten. Sie bleiben lokal und werden nicht automatisch weitergegeben.',
          '„Passendes früheres Journal bewusst fortsetzen“ prüft Workflow, Parameter, Quellen, bestätigte Ausgaben und die verwendete Laufzeitfassung. Geänderte eigene Module, Python-/Paketversionen oder Vera-Schriftbytes können die Wiederaufnahme verhindern. Ein älteres Journal ohne Laufzeitidentität wird nicht automatisch übernommen.',
          'Unklare Schritte verlangen eine Prüfung der tatsächlichen Dateien. Das Journal ist keine allgemeine Genau-einmal-Garantie und kein Rollback. Bestätigte Teilergebnisse bleiben nach Abbruch erhalten. Ein Journal über 16 MiB kann nicht erneut eingelesen werden; es wird dafür nicht heimlich gekürzt oder gelöscht.',
        ],
      },
      {
        id: 'business-grenzen',
        titel: 'Verarbeitungsgrenzen beachten',
        texte: [
          'Dokumenttabellen haben ein Limit von 20000 Zellen, PDFs von 2000 Seiten, PDF-Textauszüge von 256 KiB. Große Tabellen werden nicht unbemerkt vollständig zu Word- oder PDF-Berichten gemacht. Excel-Formeln werden nicht berechnet; gespeicherte Formelwerte können veraltet sein.',
          'Das DuckDB-Speicherbudget ist kein Limit für den gesamten Python-Prozess. Große Sortierungen und Verknüpfungen können mehr Speicher benötigen. Das breite Millionen-CSV-Testprofil scheiterte mit 64 MB, ein ausdrücklich schmalerer Plan bestand. Ein begrenzter Vorschauausschnitt beweist keinen begrenzten gesamten Leseaufwand.',
          'Ein erfolgreicher Modul- oder Dateitest beweist keine vollständige UI-, Screenreader-, Installer- oder Updateabnahme. Beachte die getrennten tatsächlichen Prüfberichte. Es gibt keine OCR, Office-Konvertierung, Cloud-Synchronisation oder allgemeine Shell.',
        ],
      },
    ],
  },
  {
    id: 'probleme-tastatur',
    titel: 'Probleme und Tastenkombinationen',
    beschreibung: 'Häufige Meldungen einordnen und den Editor mit Tasten bedienen.',
    abschnitte: [
      {
        id: 'meldungen',
        titel: 'Fehler und Speicherzustände verstehen',
        texte: [
          '„Ungespeicherte Änderungen“ betrifft die Projektdatei. „Projekt gespeichert“ bestätigt deren erfolgreichen Schreibvorgang. „Script gespeichert“ betrifft den Python- oder VBS-Export; „Signatur gültig“ bestätigt erst das tatsächliche VBS-Signaturprüfergebnis.',
          '„Verbinde diesen Baustein mit deinem Ablauf“ bedeutet, dass eine aktive Anweisung lose ist. Ein dynamischer Dateipfad ist nicht allein deshalb falsch, weil er beim Entwerfen nicht aufgelöst werden kann. Die Strukturprüfung probiert keine Dateiaktionen aus. Eine bewusst gestartete Datenvorschau oder ein Prüflauf kann Quellen lesen; erst der echte Lauf verändert fachliche Ziele.',
          'Unbekannte neuere Projektformate werden nicht überschrieben. Ist eine gespeicherte Datei von außen verändert worden, beachte die konkrete Konfliktmeldung und speichere deinen Stand nötigenfalls unter einem neuen Namen.',
        ],
      },
      {
        id: 'tastenkombinationen',
        titel: 'Tastenkombinationen im Editor',
        texte: [
          'Strg+N: neuer Workflow. Strg+O: Projekt öffnen. Strg+S: speichern. Strg+Umschalt+S: speichern unter. Projektkürzel gelten auch während einer Texteingabe, solange kein Dialog geöffnet ist.',
          'Außerhalb von Texteingaben: Strg+Z macht rückgängig; Strg+Y oder Strg+Umschalt+Z wiederholt. F4 öffnet Eigenschaften. Entf löscht den ausgewählten Baustein. Escape bricht Ziehen oder die Auswahl einer Einfügestelle ab.',
          'Strg+Plus und Strg+Minus verändern den Canvas-Zoom; Strg+0 setzt ihn auf 100 Prozent zurück. Für Schaltflächen und Formulare stehen Tab, Umschalt+Tab, Eingabetaste und die üblichen Auswahlfeldtasten zur Verfügung.',
        ],
      },
      {
        id: 'updates',
        titel: 'Updates und Offlinebetrieb',
        texte: [
          'Bearbeiten, lokale Hilfe, Projektdateien und unsignierter Export funktionieren offline. Unter Einstellungen kannst du nach Updates suchen, automatische Prüfungen abschalten und Vorabversionen bewusst zulassen.',
          'Ein Update wird erst nach deiner Entscheidung heruntergeladen und installiert. Ein normales Beenden installiert nichts stillschweigend. Fehlende Release- oder Anwendungssignatureinrichtung wird als solche angezeigt; sie ist kein erfolgreich geprüftes Update.',
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
