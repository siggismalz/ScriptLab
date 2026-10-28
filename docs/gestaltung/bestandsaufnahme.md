# ScriptLab: Bestandsaufnahme und Arbeitswege

Stand: 28. Oktober 2026. Ausgangspunkt der Quelltextprüfung: Commit `bcf6980`.
Diese Bestandsaufnahme beschreibt die vorhandene Implementierung. Sie ist noch
kein Nachweis einer visuellen oder praktischen Abnahme der neuen Gestaltung.

## Technische Grundlage

- Windows-Anwendung mit Electron 45, React 19, TypeScript und Blockly 13.4.0.
- `src/renderer/Anwendung.tsx` besitzt den aktiven Workflow, den Blockly-Workspace,
  die Auswahl, den Speicherzustand und den aktuellen Laufzustand.
- `src/main/hauptprozess.ts` besitzt Dateioperationen, lokale Einstellungen,
  Projektwechsel, Laufstart und Exporte. Die Renderer-Brücke bleibt die Grenze
  für diese Operationen.
- `src/kern/projekt.ts` und `src/kern/business-modell.ts` bilden die bestehenden
  Projekt- und Parameterformate. Eine neue Ansicht braucht kein neues Dateiformat.
- `src/gestaltung/tokens.ts` und `src/gestaltung/blocklyThema.ts` liefern bereits
  gemeinsame Gestaltungswerte. Der Ausgangsstand hat nur ein dunkles Thema mit
  blauem Akzent. Abstände, Schriften und gemeinsame SVG-Symbole sind vorhanden.
- Im Repository wurde keine zusätzliche `AGENTS.md` gefunden.

## Vorhandene Arbeitswege und erhaltenswerte Lösungen

| Weg | Vorhandene Umsetzung | Konsequenz für die Gestaltung |
| --- | --- | --- |
| Gespeicherten Workflow öffnen | Lokaler Index, separate Verfügbarkeitsprüfung, Datei öffnen oder neu zuordnen | Keine fremden Dateien als globale Suchtreffer darstellen |
| Entwurf fortsetzen | Entwurf und Ausgangsdatei werden unterschieden; Speicherentscheidung liegt im Hauptprozess | Entwurfzustand sichtbar halten, Wiederherstellen nicht als Speichern bezeichnen |
| Beispiel verwenden | Beispiele werden über die bestehende `beispielOeffnen`-Operation geöffnet | Bestehende unabhängige Kopie verwenden |
| Baustein einfügen | Suchbare Palette, Blockly-Flyout, Liste von Einfügestellen und eigener Dragger | Die vorhandene Zeigeralternative ohne Ziehen erhalten |
| Konfiguration ändern | Blockly-Felder und `Eigenschaften`/`BusinessEigenschaften` | Längere Eingaben im Eigenschaftenbereich halten |
| Parameter bearbeiten | Definitionen, Standardwerte sowie Test-/Echtdatensätze | Definition und Werte müssen erkennbar verschieden bleiben |
| Vorschau/Prüflauf/Ausführung | Getrennte Business-Modi in `TestOptionen`; tatsächliche Ausführung im Hauptprozess | Modus vor und während des Starts durchgängig benennen |
| Ergebnis prüfen | `BusinessErgebnis` zeigt ausschließlich bestätigte Meldungen, Zähler und Ausgabeziele | Keine geschätzten Erfolgszahlen ergänzen |
| Fehler nachvollziehen | Lauf-ID, Workflowkennung, Standhash und Fehlerbaustein sind vorhanden | Veraltete Ergebnisse und Blockzuordnungen weiter absichern |
| Export | Scriptdatei oder Business-ZIP mit nativen Optionen und expliziten Ressourcen | Dateiformate und Auswahlregeln erhalten |

`Startbereich.tsx` hält Suche, Sprachfilter, Sortierung und Scrollpositionen lokal.
Der gesamte Startbereich bleibt beim Öffnen des Editors eingebunden und wird
verborgen. Diese Lösung unterstützt den Rückweg ohne Verlust des Listenstands.
Auch der Blockly-Workspace bleibt beim Wechsel zur Startansicht eingebunden.

## Probleme im Ausgangsstand

1. Die Editorleiste enthält gleichzeitig Dateibefehle, Rückgängig, Eigenschaften,
   Codevorschau, Start, Testausgabe, Export und weitere Funktionen. Der Name und
   Speicherzustand sind vor allem am unteren Rand zu finden.
2. Umfangreiche Laufvorbereitung, Parameter, begrenzte Datenvorschau, Ergebnisse
   und technisches Protokoll teilen sich den unteren Testbereich. Bei 1280 × 720
   konkurrieren sie unmittelbar mit der Arbeitsfläche.
3. Workflows und Entwürfe erscheinen als hohe Einträge mit dauerhaft sichtbarem
   Pfadfeld und mehreren Aktionen. Große Bestände benötigen eine dichtere Liste
   mit gezielt geöffneten Details.
4. Die globale Struktur ist auf Startkarten und Rücksprünge verteilt. Eindeutige
   Bereiche für Workflows und Vorlagen fehlen als dauerhafte Orientierung.
5. Es gibt keine eigenständige helle Gestaltung und keine gespeicherte Auswahl
   Dunkel/Hell/System.
6. Das vorhandene Icon ist ein violettes Quadrat mit einem S. Das UI verwendet
   daneben ein allgemeines Bausteinsymbol. Ein gemeinsames Signet fehlt.
7. „Test“ bezeichnet in der Oberfläche auch einen Lauf, der echte Dateien ändert.
   Die bestehende Wirkungserklärung ist korrekt, die kurze Beschriftung jedoch
   präzisierungsbedürftig.
8. Quellen und Ziele erscheinen in der Business-Vorbereitung vorwiegend als
   technische Konfiguration unter Details. Eine fachlich benannte Übersicht
   erleichtert die Startentscheidung.

## Verbindliche Navigationsentscheidung

Die globale Ebene erhält Start, Workflows, Vorlagen, Hilfe und Einstellungen.
Entwürfe gehören zur Workflowverwaltung, Beispielworkflows zu Vorlagen.
Dokumentvorlagen sind ein klar benannter Unterbereich derselben Vorlagenansicht.
Hilfe und Einstellungen stehen an einer ruhigen festen Position.

Im geöffneten Workflow wird dieselbe globale Ebene kompakt auswählbar. Darunter
stehen Projektname, Sprache und tatsächlicher Speicherzustand. Die drei
Arbeitsbereiche lauten:

- **Ablauf:** Palette, Blockly-Arbeitsfläche und bei Bedarf Eigenschaften.
  Codevorschau ist eine gezielt geöffnete Zusatzansicht. Der schnelle Test bleibt
  erreichbar.
- **Daten und Parameter:** bestehende Quellen-/Zielkonfiguration,
  Parameterdefinitionen beziehungsweise -werte und bewusst geladene
  Datenvorschau. Bloßes Öffnen lädt oder verarbeitet keine Quelldatei.
- **Läufe:** Vorbereitung, aktueller beziehungsweise letzter verfügbarer Lauf,
  Ergebnisübersicht, Ausgaben und technisches Protokoll. Ein Lauf behält seine
  ID, seinen Modus, seinen Workflowstand und seine Startoptionen.

Ein Arbeitsbereichswechsel verändert ausschließlich den lokalen Ansichtsstate.
Er ruft weder `neu`, `oeffnen`, `testStarten` noch `testVerlassen` auf. Der
Blockly-Workspace bleibt erhalten. Nach dem Wiedereinblenden wird seine
Geometrie aktualisiert; Auswahl, Canvasposition und Zoom bleiben erhalten.
Die vorhandenen Regeln für globale Projektwechsel und aktive Prozesse bleiben
im Hauptprozess wirksam.

## Konkrete Ansichten vor der breiten Umsetzung

Diese Vorgaben bilden die Arbeitsgrundlage für tatsächliche Ansichten mit
kenntlich gemachten synthetischen Testdaten in beiden Themen:

| Zustand | Inhalt und Priorität | Echte Datenbasis |
| --- | --- | --- |
| Start mit vorhandener Arbeit | Neuer Workflow, Weiterbearbeiten, vier Einstiege, bis zu fünf zuletzt geöffnete Workflows; ein sichtbarer Entwurfzugang | `ProjektBibliothek`, `EntwurfStatus`, aktiver Workflow |
| Workflowübersicht | Suche ausdrücklich nur in gespeicherten Workflows; Sprachfilter, Sortierung, Name, Beschreibung, Zeitpunkt und Dateizustand; gewählte Zeile zeigt vollständigen Pfad und Aktionen | `ProjektEintrag`, `Verfuegbarkeit` |
| Business-Editor | Monatsauswertung mit Import, Verarbeitung und Ausgabe; ausgewählter Block plus Eigenschaften; klare Auswahlkontur; keine dauerhafte große Ergebnismenge | Mitgeliefertes Business-Beispiel und Blockly-Auswahl |
| Datenvorschau mit Zuordnungsfehler | Quelle und Konfiguration getrennt; Pflichtfehler am betroffenen Feld; Baustein anzeigen; Vorschauumfang und Begrenzung sichtbar | Strukturvalidierung und ausdrücklich geladene `business.vorschau` |
| Vorbereitung und laufender Prozess | Modus, Workflowstand, Parametersatz, Basisordner, relevante Quellen/Ziele, Überschreibregel und Zeitlimit; während des Laufs Status plus Stoppen dauerhaft erreichbar | `TestOptionen`, `TestZustand`, Business-Schritte |
| Lauf mit Teilergebnis | Verarbeitete Daten, tatsächlich gemeldete Ausgabedateien und verbleibende Hinweise/Fehler; Details für technisches Protokoll | Bestätigter Business-Bericht und Ereignisse |
| Business-Paketexport | Klare Unterscheidung Projektdatei/Script/Business-Paket, Inhalt und benötigte Umgebung; Ausgabeort über Windows-Dateiauswahl | Vorhandene Exportoperation, Ressourcenliste und Paketdateien |
| Einstellungen | Darstellung Dunkel/Hell/System, UI-Vergrößerung getrennt vom Canvaszoom; Python-/Business-Laufzeit mit tatsächlichem Status | Lokale Einstellungen und Laufzeit-Brücke |

## Fachliche Abhängigkeiten und Grenzen

- Die Brücke besitzt `testLesen` für den aktuellen beziehungsweise letzten Lauf,
  jedoch keine durchsuchbare persistente Laufhistorie. Vorhandene lokale Berichte
  sind nicht automatisch eine angebundene Laufbibliothek. Die UI darf daher keine
  erfundene historische Liste oder dauerhaft gespeicherte Mehrfachhistorie zeigen.
- Dokumentvorlagen existieren als Projektressourcen und mitgelieferte Beispiele;
  es gibt keine eigenständige Vorlagenbibliothek mit Import-/Verwaltungsdienst.
  Ein ehrlicher Einstieg kann vorhandene Beispiele und Ressourcennutzung erklären.
- Ergebnisse können nur die vom Lauf bestätigten Angaben anzeigen. Ein geplanter
  Pfad ist keine erzeugte Datei. Das Stoppen setzt bereits erfolgte Änderungen
  nicht zurück.
- Der Export entscheidet derzeit anhand der Business-Schritte zwischen Script
  und ZIP. Die neue UI muss die tatsächliche Unterstützung benennen. VBS kann
  entsprechend den bestehenden Optionen signiert werden; Python und Business-ZIP
  besitzen diese Signaturfunktion nicht.
- Projektressourcen und Kundendokumente behalten ihre eigene Gestaltung.

## Prüfschwerpunkte der Umstellung

Die vorhandenen Desktoptests sind für die native Electron-Anwendung eingerichtet.
Viele enthalten genaue Bezeichnungen wie „Testausgabe“, „Workflow testen“ und
„Projektmenü“. Eine bewusste Navigation oder Textkorrektur erfordert entsprechend
angepasste Erwartungen; diese Tests dürfen nicht nur entfernt werden.

Sinnvolle Regressionen sind Bearbeiten/Speichern/Öffnen, Entwurf fortsetzen,
unabhängige Beispielkopie, Bausteine per Einfügestellenliste verbinden, Fehler am
Baustein anzeigen, Modusunterscheidung, laufenden Prozess beim Ansichtswechsel
erhalten, Stoppen und Export. Getrennt zu prüfen sind 1280 × 720, größere und enge
Fenster, beide Themen, lange Texte, 200 Prozent UI-Vergrößerung, Prozess-DPI,
echte Windows-Skalierung und Monitorwechsel. Prozess-DPI ist kein Nachweis einer
tatsächlich umgestellten globalen Windows-Skalierung.

Die bisherige Abnahme dokumentiert ausdrücklich keine Narrator-Prüfung und
keinen Nutzertest mit einer Person ohne Programmierkenntnisse. Ein neuer
Kontrast- oder DOM-Test schließt diese Grenzen nicht automatisch.
