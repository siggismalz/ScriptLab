# Architektur von ScriptLab

ScriptLab ist ein Editor und Exportwerkzeug für Windows 11 x64 mit ausdrücklich gestarteten Workflowtests. Nur **Testen** darf den vollständigen aktuellen Workflow ausführen. Öffnen, Wiederherstellen, Bearbeiten, Vorschau, Strukturprüfung, Speichern, Export und Signaturprüfung starten keinen Workflow. Es gibt keine Hintergrundausführung oder Zeitplanung.

## Aufteilung

| Bereich         | Aufgabe                                                                            | Erlaubte Nebenwirkungen                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hauptprozess    | Fenster, native Dialoge, Projekte, Index, Entwürfe, Einstellungen, Export          | Gewählte Projektdateien lesen/schreiben; Exportdatei schreiben; lokale Sicherungen, Dateiverweise und Einstellungen im Benutzerprofil verwalten      |
| Preload         | Kleine, fest benannte Brücke zwischen Oberfläche und Hauptprozess                  | Nur ausdrücklich angebotene IPC-Methoden aufrufen                                                                                                    |
| Renderer        | Deutsche React-Oberfläche, Blockly, reine Codevorschau                             | Editorzustand und Darstellung ändern                                                                                                                 |
| Workflowkern    | Projektformat prüfen, Bedeutung aus Verbindungen ableiten, Fehler Blöcken zuordnen | Keine Datei-, Netzwerk- oder Prozesszugriffe                                                                                                         |
| Generatoren     | Validiertes Zwischenmodell deterministisch nach Python oder VBScript übersetzen    | Nur Text erzeugen                                                                                                                                    |
| Windows-Dienste | Feste Werkzeuge für Signatur und bewusste Tests; kontrollierter Anwendungsupdater  | Zertifikate abfragen, Exportdatei signieren/prüfen; geprüften Workflow ausdrücklich ausführen und stoppen; bestätigtes Anwendungsupdate installieren |

Die genaue Dateiaufteilung ist im Quellverzeichnis `src` nachvollziehbar. Bibliotheken und Blockly-Medien werden lokal ausgeliefert. Bearbeiten, Speichern, Öffnen und unsignierter Export benötigen keine Netzwerkverbindung.

## Eine Quelle für den Workflow

Die `.scriptlab`-Datei verwendet Schema 2 und enthält `skriptsprache: 'python' | 'vbs'`, App-Version, Projektkennung, Namen und Beschreibung, den serialisierten Blockly-Zustand, Ansicht und nicht geheime Exportoptionen. Stabile Block-IDs und Verbindungen sind maßgeblich; Rasterpositionen bestimmen keine Reihenfolge. Schema-1-Projekte werden beim Lesen als VBS-Projekte normalisiert. Das Laden allein schreibt keine Quelldatei um; unbekannte neuere Formate werden abgewiesen.

`src/kern/sprachen.ts` bündelt Sprachbezeichnungen, Dateiendungen und UI-Texte. `src/kern/skript.ts` wählt anhand der geprüften Projektsprache den Generator aus. Die Sprache wird vor einer leeren Neuanlage gewählt und bleibt anschließend fest. Die letzte erfolgreiche Wahl ist eine globale Einstellung; beim ersten Start ist sie `null`. Sie ersetzt keine Sprache in einem vorhandenen Projekt.

Beim Prüfen wird aus diesem Zustand die Bedeutung des Workflows abgeleitet. Nur ein validierter Hauptablauf darf exportiert werden. Das Zwischenmodell wird nicht als zweite, unabhängig änderbare Wahrheit gespeichert. Unvollständige Entwürfe können als Projekt erhalten bleiben. Ein Export meldet fehlende Werte, unbekannte Typen, mehrere Startblöcke und unverbundene aktive Blöcke.

Variablenfelder verweisen über stabile Blockly-Variablen-IDs auf `editor.variables`. Umbenennen ändert den Anzeigenamen und erhält alle Bezüge. Die Migration alter Namen führt deren frühere Zuordnung ohne Beachtung der Groß-/Kleinschreibung zusammen; ungültige leere Zuordnungen bleiben als zu behebender Fehler erkennbar. Die Generatoren ordnen IDs sichere technische Namen zu und trennen diese von internen Hilfsnamen. Ein Anzeigename ist kein Programmcode.

Beide reinen Generatoren übersetzen dieselben 48 Bausteintypen aus dem gemeinsamen Zwischenmodell. Sie behandeln Nutzertexte als Daten und geben notwendige Hilfsfunktionen nur einmal aus. Gleicher Workflow und gleiche Exportoptionen ergeben denselben unsignierten Exportquelltext. Die zusätzliche Testfassung enthält einen getrennten Laufkontext und ist kein Exportartefakt. Die Python-Fassung benutzt die Standardbibliothek; für Windows-Wertumwandlungen, Vergleiche und regionale Textregeln bindet sie lokale `OleAut32`-/NLS-Funktionen über `ctypes` ein. Sie startet weder eine VBScript-Engine noch einen COM-Server und benötigt keine zusätzlichen Pakete.

## Bewusst gestarteter Testlauf

`src/windows/testlauf.ts` besitzt den Laufzustand im Hauptprozess. Es übernimmt ausschließlich ein vollständig geprüftes Projekt und begrenzte Testoptionen. Der Renderer übergibt weder beliebigen Quelltext noch einen ausführbaren Programmpfad oder freie Prozessargumente. Das Preload bietet nur `testLesen`, `testStarten`, `testStoppen`, `testAusgabeLeeren`, `testAusgabeKopieren`, `testOrdnerWaehlen` und `testVerlassen`; die allgemeinen IPC-Absender- und Datenprüfungen gelten weiterhin.

Vor dem Start wird der Editorstand kopiert und aus diesem unveränderlichen Stand über denselben Generator eine sprachabhängige Testfassung mit Zeilen-/Blockzuordnung erzeugt. Projektkennung, Sprache, SHA-256-Standkennung, zufällige Lauf-ID, Start-/Endzeit und tatsächlich verwendete Optionen gehören zum Ergebnis; bei Python zusätzlich die tatsächlich verwendete Version. Ansichtsänderungen sind keine neue Workflowbedeutung. Die Testfassung erhält einen zufälligen Kontexttoken und einen ausdrücklich übergebenen absoluten Basisordner. Der normale Export verwendet weiterhin den Speicherordner seiner eigenen Scriptdatei. Die Generatoren führen in beiden Modi nichts aus.

Der fest mitgelieferte Windows-Helper `scripts/laufzeit-host.cs` startet für VBS ausschließlich den festgelegten Windows-Host `cscript.exe`, für Python ausschließlich den vorab geprüften und für diesen Lauf eingefrorenen absoluten CPython-Pfad. Argumente bleiben getrennte Daten. Der Python-Aufruf verwendet `-I -u -X utf8`; VBS liefert UTF-16LE-, Python UTF-8-Ausgabe. Der Helper verwendet keine Shell und ändert keine Dateizuordnung oder Sicherheitsrichtlinie. Windows-Jobobjekt, Kontrollpipe und der tatsächliche Hostabschluss binden beide Laufarten an denselben Lebenszyklus. Stoppen, Pipe-Ende (EOF) und Zeitlimit beenden die gebundenen Prozesse. Das Jobobjekt und Pythons isolierter Modus sind keine Sicherheits-Sandbox. Ein Test läuft mit den Rechten der Anwendung und kann über absolute oder UNC-Pfade außerhalb seines Basisordners wirken.

`src/windows/python.ts` sucht konkrete Interpreterdateien und prüft stabiles CPython 3.12 bis 3.15 für Windows x64. Launcher, freie Befehle und ungeprüfte Pfade werden nicht als Interpreter verwendet. Die Prüfungen sind feste technische Proben; sie übernehmen keinen Workflowtext. Der Interpreterpfad liegt nur in den lokalen Einstellungen. Für Dialogbausteine wird `tkinter` bedarfsabhängig geprüft; andere Workflows benötigen diese Komponente nicht. Die Anwendung lädt oder installiert weder Python noch Pakete.

Die Oberfläche zeigt Status und Textausgabe an und sperrt inhaltliche Änderungen während Vorbereitung, Lauf und Stoppen. Eine Wechselentscheidung bei aktivem Test behandelt erst dessen Ende und anschließend den getrennten Projekt-/Entwurfsschutz. Ein normaler Teststart speichert weder das Projekt noch eine Exportdatei. Nur feste technische Dateien des Laufs werden bereinigt; Workflowergebnisse und der gewählte Basisordner gehören nicht zur Bereinigung. Die Bedienung und der gesonderte Prüfstand stehen in [TESTLAUF.md](TESTLAUF.md).

## Startseite und lokale Arbeitsstände

`src/renderer/Startbereich.tsx` hält ausschließlich Navigation, Suche, Sprachfilter, Sortierung und Listenposition. Der gemountete Blockly-Editor bleibt beim Wechsel verborgen erhalten. Die Bibliothek wird aus dem Hauptprozess geladen; sie ist kein zweiter Editorzustand. Lokale Hilfe wird aus `hilfe.ts` als React-Text dargestellt. Die sechs Beispielmetadaten verweisen auf vorhandene Projektdateien, drei je Sprache; beim Übernehmen entsteht eine neue Projektkopie mit dem Zusatz `(Kopie)`.

`src/main/projektablage.ts` verwaltet unter dem Electron-Nutzerverzeichnis den Index `projektbibliothek.json` in Schema 2 und `entwuerfe/<UUID>.json` mit einem Sicherungsumschlag in Schema 1 und normalisiertem Projektinhalt in Schema 2. Alte Indexeinträge der Version 1 erhalten die VBS-Zuordnung. Der Index erfasst nur ausdrücklich geöffnete oder gespeicherte Dateien. Windows-Pfade werden normalisiert und ohne Unterscheidung der Großschreibung zugeordnet. Langsame Dateiprüfungen erhalten ein Zeitlimit; höchstens drei tatsächliche Projektdateizugriffe laufen zugleich. Neuere oder beschädigte Indexformate bleiben unverändert und werden als Hinweis angezeigt.

Alte Projektdateien bleiben lesbar und erhalten beim Laden eine Projektkennung. Eine Entwurfskennung ist davon getrennt, damit eine neue Bearbeitung keine noch nicht gewählte Wiederherstellung überschreibt. Ein Entwurf enthält den vollständigen geprüften Projektstand samt Sprache, die letzte erfolgreiche Sicherungszeit sowie gegebenenfalls Ausgangspfad und SHA-256 des zugrunde liegenden Dateistands. Die verzögerte Sicherung schreibt ausschließlich in den Nutzerbereich; sie ändert weder Originaldatei noch deren Ungespeichert-Status.

Vor Ersetzen, Schließen und Update-Neustart greifen gemeinsame Speicherentscheidungen. Ein Wechsel mit „Als Entwurf behalten“ wartet auf erfolgreiches atomisches Schreiben. Verwerfen entfernt auch vorgemerkte Sicherungen. Speichern prüft eine vorhandene Ausgangsdatei gegen den bekannten Hash und verlangt bei Konflikten eine separate Kopie. Nach einer Speicherentscheidung wird eine zu öffnende Datei erneut gelesen, damit ein gerade gespeicherter Stand nicht durch einen älteren Lesestand ersetzt wird. Testprofile sind über eine ausschließlich im Entwicklungsbetrieb erlaubte Konfiguration isoliert.

## Sicherheitsgrenze zwischen Oberfläche und Windows

Das Electron-Fenster verwendet `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true`. Ein restriktiver CSP erlaubt keine fremden Scripts. Navigationen, neue Fenster, nicht benötigte Berechtigungen und fremde Inhalte werden gesperrt.

Der Hauptprozess prüft für jede IPC-Anfrage den Absender einschließlich des erlaubten Hauptframes sowie Typen, Längen und Struktur der Nutzdaten. Der Renderer erhält keine allgemeine Datei-, Shell-, Prozess-, URL- oder Electron-Schnittstelle. Die Python-Schnittstelle bietet nur Status, feste Prüfung, native Interpreterauswahl und das Öffnen einer fest hinterlegten offiziellen Hilfeseite. Ein Dateipfad aus einer Projektdatei kann keine Windows-Operation beim Bearbeiten oder Exportieren auslösen.

Der Exportpfad stammt aus einem nativen Speicherdialog. Der Hauptprozess erzeugt den sprachabhängigen Quelltext erneut aus dem geprüften Projekt; er übernimmt keinen frei eingegebenen Quelltext vom Renderer. Nach dem Export ist nur das Anzeigen des Speicherorts zulässig. Die Exportdatei wird nicht geöffnet. Authenticode-Signaturen werden ausschließlich für VBS angeboten; bei Python ist das Signaturergebnis `null` und wird nicht als Prüfung dargestellt.

Das Signaturwerkzeug hat fest vorgegebene Operationen und Argumente. Es ist kein allgemeiner PowerShell-Aufruf. Der Updater installiert ausschließlich ScriptLab-Updates. Nutzerzertifikate und die Signatur der ScriptLab-Anwendung bleiben getrennt.

## Dateien und Kodierung

Projektdateien sind lesbares JSON in UTF-8. Ein Speichervorgang schreibt zuerst eine temporäre Datei im selben Ordner und ersetzt die Zieldatei erst nach erfolgreichem Schreiben. Abgebrochene Dialoge sind normale Abbrüche. Neuere unbekannte Schemaversionen werden nicht überschrieben.

VBS-Exporte verwenden UTF-16LE mit BOM und CRLF, Python-Exporte UTF-8 ohne BOM und CRLF. Die Kodierung von Textdateien, die ein gestarteter Workflow liest oder schreibt, wird davon getrennt behandelt. Vorhandene UTF-8-/UTF-16LE-Dateien werden vor einer Ergänzung auf passende, wohlgeformte Kodierung geprüft; ein Fehler bricht vor dem Überschreiben ab. Relative Workflowpfade beziehen sich beim Export auf den Ordner der jeweiligen Scriptdatei und beim Test auf den sichtbaren Basisordner.

## Entwicklung und Prüfung

Ein ausschließlich für die Entwicklung vorgesehenes Werkzeug kann den Windows-VBScript-Parser im nicht ausführbaren Zustand `SCRIPTSTATE_INITIALIZED` verwenden. Es wird nicht mit der Anwendung ausgeliefert. Es stellt keine Hostobjekte bereit, schaltet nie in einen ausführbaren Zustand und prüft auch nach dem Parsen den Zustand sowie null Ausführungseintritte. Die praktische Prüfung und ihre Grenzen stehen in [PRUEFPLAN.md](PRUEFPLAN.md).

Die optionale Windows-VBScript-Komponente wird nur für tatsächliche Ausführung und Windows-Parserprüfungen benötigt, nicht für Bearbeiten, Speichern oder Export. Vor dem ersten Test prüft der Laufdienst die Laufzeit mit einer festen technischen Probe. Fehlt sie oder wird sie blockiert, erscheint eine verständliche Fehlermeldung; es werden weder Features aktiviert noch Sicherheitsrichtlinien geändert. Microsoft hat VBScript abgekündigt; Test und eigenständiger Start hängen von Windows, der verfügbaren Komponente und den Richtlinien ab.

Ebenso ist CPython keine Voraussetzung für Editor, Projektdateien oder Python-Export. Die genauen Python-Prüfungen und der tatsächlich geprüfte Windows-Stand stehen in [PYTHON.md](PYTHON.md). Reine Generator-/Syntaxprüfungen und bewusst gestartete Laufzeittests werden im [Prüfplan](PRUEFPLAN.md) getrennt geführt.

## Offizielle Grundlagen

- [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron 45 und Änderungen am Sandbox-Preload](https://www.electronjs.org/blog/electron-45-0)
- [Blockly-Codegenerierung](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/)
- [Stabile electron-builder-v26-Dokumentation](https://www.electron.build/v26/)
- [Microsoft: abgekündigte Windows-Funktionen](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features)
- [CPython 3.15: Aufrufoptionen und isolierter Modus](https://docs.python.org/3.15/using/cmdline.html)

Am 26.10.2026 zeigt die Startseite von electron-builder ausdrücklich die noch nicht veröffentlichte v27-Dokumentation. Für die eingesetzte stabile v26 ist deshalb die versionierte Dokumentation maßgeblich. Die tatsächlich installierten Paketversionen und Integritätswerte stehen in `package-lock.json`.
