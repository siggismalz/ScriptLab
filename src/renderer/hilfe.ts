/** Lokale Hilfetexte. Die Oberfläche rendert ausschließlich React-Text, kein HTML oder Markdown. */
import type { Skriptsprache } from '../kern/sprachen';
import type { BeispielKennung } from '../gemeinsam/bruecke';
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
          'Mit „Neuer Workflow“, „Neu“ oder Strg+N wählst du zuerst Python oder VBScript (VBS). Beim ersten Mal ist keine Sprache vorausgewählt. Erst „Workflow erstellen“ öffnet den Editor mit einem Startbaustein. Abbrechen lässt den bisherigen Workflow unverändert. Die zuletzt erfolgreich gewählte Sprache wird bei der nächsten Erstellung vorgeschlagen.',
          'Die Sprache bleibt für dieses Projekt fest. Beide Sprachen verwenden dieselben Bausteine. Um einen Ablauf in einer anderen Sprache zu erstellen, lege einen neuen Workflow an; vorhandene Projekte werden nicht heimlich umgestellt.',
        ],
        schritte: [
          'Suche links nach „Nachricht“.',
          'Klicke neben „Nachricht anzeigen“ auf Plus und wähle „Nach Workflow starten“.',
          'Ändere den Text direkt im Baustein oder öffne die Eigenschaften mit F4.',
          'Speichere mit „Speichern“ eine bearbeitbare .scriptlab-Datei.',
          'Öffne bei Bedarf die Codevorschau und wähle „Python-Script exportieren“ oder „VBS-Script exportieren“ entsprechend der festgelegten Sprache.',
        ],
        beispiel: 'begruessung',
      },
      {
        id: 'bewusste-ausfuehrung',
        titel: 'Nur bewusst gestartete Tests führen den Workflow aus',
        texte: [
          'Bearbeiten, Öffnen, Wiederherstellen, Vorschau, Strukturprüfung, Speichern, Signieren und Export führen keine Workflowaktionen aus. Nur „Testen“ startet den vollständigen aktuellen Workflow. Es gibt keine automatische Ausführung oder Zeitplanung.',
          'Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen. Er ist keine Sandbox; Stoppen macht bereits vorgenommene Änderungen nicht rückgängig.',
          'Nach dem Export entscheidest du selbst, ob du das Script außerhalb von ScriptLab ausführst. Dafür müssen die passende Python- beziehungsweise VBS-Laufzeit vorhanden sein und die Richtlinien den Start erlauben. ScriptLab wird beim Empfänger nicht benötigt.',
        ],
      },
      {
        id: 'test-vorbereiten',
        titel: 'Einen Test vorbereiten und seine Ausgabe verstehen',
        texte: [
          '„Testausgabe“ öffnet das Panel, ohne einen Workflow zu starten. Wähle mit „Ordner auswählen“ einen Basisordner und prüfe das Zeitlimit: Standard 120 Sekunden, erlaubt 1 bis 3600. Relative Pfade werden beim Test auf diesen Ordner bezogen. Absolute Pfade können außerhalb des Basisordners wirken. Nutze zuerst entbehrliche Dateien in einem eigenen Testordner.',
          '„Testen“ und „Workflow testen“ starten den vollständigen aktuellen Hauptablauf, nicht nur den ausgewählten Baustein. Während eines Tests sind inhaltliche Änderungen gesperrt. Testen speichert weder dein Projekt noch eine Exportdatei.',
          '„Text ausgeben“ schreibt in die Testausgabe. „Nachricht anzeigen“, Texteingaben, Ja-/Nein-Fragen und die Löschrückfrage öffnen Dialoge; bei Python ist dafür tkinter erforderlich. Stoppen und das Zeitlimit beenden den Test; bereits erfolgte Änderungen bleiben bestehen.',
          'Sprache, tatsächlich verwendete Python-Version, Lauf-ID, Standkennung, Startzeit, Laufzeit, Pfadbasis und Exitcode gehören zum angezeigten Lauf. Ein Ergebnis mit Exitcode 0 bestätigt ein Ende ohne gemeldeten Fehler, nicht die Ungefährlichkeit oder das gewünschte Dateiergebnis. Nach einer Workflowänderung weist das Panel auf den früheren Stand hin.',
          '„Ausgabe kopieren“ und „Ausgabe leeren“ betreffen nur den angezeigten Text, auch während eines Tests. Beim Hochscrollen folgt die Anzeige neuen Zeilen nicht automatisch; „Zum Ausgabeende“ führt zurück. „Laufdetails und Technik“ zeigt den schreibgeschützten Testquelltext und vorhandene Fehlerzuordnungen. „Baustein anzeigen“ führt zum zugeordneten Baustein.',
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
          'Links teilen sich Kategorien und Suchergebnisse dieselbe Palette. Die Suche findet Bausteine in allen Kategorien; „Suche leeren“ führt zur zuvor geöffneten Kategorie zurück.',
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
          'Die Zoomknöpfe verkleinern, vergrößern, setzen auf 100 Prozent zurück oder zeigen mit „Alles anzeigen“ den gesamten Ablauf. Die UI-Textgröße in den Einstellungen verändert die Bedientexte unabhängig vom Canvas-Zoom.',
          'Eigenschaften und Codevorschau sind optional. Bei schmalen Fenstern überlagern die Eigenschaften den rechten Rand; bei großen Fenstern lassen sie sich anheften. Palette und Codevorschau sind an ihren Trennlinien verstellbar.',
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
          'Aktuelle Projekte verwenden Schema 2. Alte Schema-1-Projekte werden beim Öffnen als VBS übernommen, ohne die Quelldatei zu überschreiben. Erst ausdrückliches Speichern schreibt das aktuelle Format. Unbekannte neuere Formate werden abgewiesen.',
          '„Speichern“ sichert das aktuelle Projekt; „Speichern unter“ im Projektmenü wählt einen anderen Speicherort. Namen und Beschreibung änderst du unter „Projektangaben“. Ein Export speichert die Projektdatei nicht automatisch.',
          'Bei ungespeicherten Änderungen fragt ScriptLab vor einem möglichen Verlust nach: „Speichern“, „Als Entwurf behalten“, „Änderungen verwerfen“ oder „Abbrechen“. „Als Entwurf behalten“ erlaubt den Wechsel erst nach erfolgreicher lokaler Sicherung; die Projektdatei bleibt unverändert. „Änderungen verwerfen“ verwirft den ungespeicherten Stand bewusst. „Abbrechen“ oder ein abgebrochener Speicherdialog verhindert den abhängigen Projektwechsel.',
        ],
      },
      {
        id: 'bekannte-projekte',
        titel: 'Bekannte Projekte wiederfinden',
        texte: [
          '„Meine gespeicherten Workflows“ zeigt bekannte Projektdateien mit ihrem tatsächlichen Pfad und ihrer Sprache. Suche nach Name oder Pfad, filtere nach Sprache und sortiere nach Name oder dem letzten Öffnen. Die Liste ist ein Verzeichnis bekannter Speicherorte, keine Suche auf deinen Laufwerken. Auch Beispiele und Entwürfe besitzen einen Sprachfilter.',
          'Fehlt eine Datei oder ist ein Laufwerk nicht erreichbar, erscheint der tatsächliche Prüfzustand. Mit „Neu zuordnen“ wählst du die verschobene Projektdatei aus. „Aus Liste entfernen“ entfernt nur den Verweis; die Projektdatei bleibt erhalten.',
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
          '„Python-Script exportieren“ oder „VBS-Script exportieren“ prüft zuerst die Bausteine. Fehlende Pflichtwerte, falsche Verbindungen und lose aktive Anweisungen verhindern den Export. Die Hinweisübersicht nennt den betroffenen Baustein; ein Klick führt dorthin.',
          'Python-Projekte erzeugen .py-Dateien, VBS-Projekte .vbs-Dateien. Beide Exporte sind eigenständig und benötigen bei der späteren Ausführung weder ScriptLab noch Node.js. Für Python muss eine passende Python-Installation vorhanden sein. Die angebotenen 48 Bausteintypen benötigen keine zusätzlichen Python-Pakete; Dialoge benötigen die optionale Standardkomponente tkinter.',
          'Die optionale Codevorschau zeigt ausschließlich Text. Sie führt den Ablauf nicht aus. Nach dem Export erscheint: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ „Speicherordner anzeigen“ öffnet nur den Ordner und startet die Datei nicht.',
          'Python-Exporte werden als UTF-8 ohne BOM, VBS-Exporte als UTF-16LE mit BOM geschrieben. Beide verwenden Windows-Zeilenenden (CRLF). Identische Workflows und Exportoptionen erzeugen denselben unsignierten Quelltext.',
        ],
      },
      {
        id: 'pfade-dateien',
        titel: 'Dateipfade und vorhandene Dateien',
        texte: [
          'Relative Dateipfade beziehen sich beim Export auf den Ordner der jeweiligen Scriptdatei und beim Test auf den sichtbaren Basisordner. Der Projektordner ist keine automatische Pfadbasis. Absolute Windows- und UNC-Pfade sind ebenfalls möglich und können beim Test außerhalb des Basisordners wirken. Platzhalter wie * und ? sind bei Dateioperationen nicht erlaubt.',
          'Kopieren und Verschieben behandeln ein vorhandenes Ziel standardmäßig als Fehler; bewusst gewähltes Überschreiben ersetzt die Zieldatei. Textdatei schreiben ersetzt den Inhalt. Der erweiterte Löschbaustein erzeugt standardmäßig eine Rückfrage im später gestarteten Script.',
          'Die Kodierung der vom Workflow bearbeiteten Textdateien wird gesondert gewählt. UTF-8 und UTF-16LE schreiben eine BOM; Windows-ANSI verwendet die lokale Windows-Codepage. Beim Ergänzen muss eine vorhandene Datei zur ausgewählten Kodierung passen. Fehlerhaftes UTF-8 oder UTF-16LE wird vor dem Überschreiben zurückgewiesen.',
        ],
        beispiel: 'dateiliste',
      },
      {
        id: 'python-verfuegbarkeit',
        titel: 'Python-Installation prüfen',
        texte: [
          'Bearbeiten und Python-Export funktionieren auch ohne Python-Installation. Unterstützt wird stabiles CPython 3.12 bis 3.15 für Windows x64. In den Einstellungen zeigt ScriptLab den tatsächlichen Prüfstatus, die Version und den geprüften Interpreterpfad. „Interpreter auswählen“ wählt eine konkrete Programmdatei; „Erneut prüfen“ prüft die Installation neu. „Python einrichten“ im Testbereich führt zu diesen Einstellungen.',
          'Ein Python-Test verwendet den geprüften Interpreter. Dialogbausteine benötigen zusätzlich tkinter; dessen Verfügbarkeit wird bei Bedarf geprüft. Abläufe ohne Dialoge benötigen kein tkinter. Ein ungeprüfter oder fehlender Interpreter wird nicht als bereit angezeigt. ScriptLab lädt oder installiert weder Python noch Pakete und stellt keine freie Shell bereit. Der Interpreterpfad bleibt eine lokale Einstellung und wird nicht im Projekt gespeichert.',
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
    id: 'probleme-tastatur',
    titel: 'Probleme und Tastenkombinationen',
    beschreibung: 'Häufige Meldungen einordnen und den Editor mit Tasten bedienen.',
    abschnitte: [
      {
        id: 'meldungen',
        titel: 'Fehler und Speicherzustände verstehen',
        texte: [
          '„Ungespeicherte Änderungen“ betrifft die Projektdatei. „Projekt gespeichert“ bestätigt deren erfolgreichen Schreibvorgang. „Script gespeichert“ betrifft den Python- oder VBS-Export; „Signatur gültig“ bestätigt erst das tatsächliche VBS-Signaturprüfergebnis.',
          '„Verbinde diesen Baustein mit deinem Ablauf“ bedeutet, dass eine aktive Anweisung lose ist. Ein dynamischer Dateipfad ist dagegen nicht allein deshalb falsch, weil er beim Entwerfen nicht aufgelöst werden kann. Die Strukturprüfung probiert keine Dateiaktionen aus. Quellen und Dateirechte werden erst bei einer ausdrücklich gestarteten Ausführung relevant; ein Test hat dabei echte Auswirkungen.',
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
