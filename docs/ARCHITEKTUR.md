# Architektur von ScriptLab

ScriptLab ist ein Editor und Exportwerkzeug für Windows 11 x64. Python ist die Hauptsprache für Business-Abläufe, VBS bleibt für die gemeinsamen Grundbausteine erhalten. Vollständige Ausführung, begrenzte Business-Datenvorschau und Prüflauf sind ausdrücklich gestartete Betriebsmodi. Öffnen, Wiederherstellen, Bearbeiten, Codevorschau, Strukturprüfung, Speichern, Export und Signaturprüfung starten keine Verarbeitung. Es gibt keine automatische Workflowausführung oder Zeitplanung.

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

Der Qualitätsdurchgang trennt zwei Grenzen: 1.000 Blöcke insgesamt und 150 fachliche Verschachtelungsebenen. Die Gesamtgrenze schützt den aktuellen Blockly-/Chromium-Renderer vor reproduziertem Stillstand bei 2.000 linearen und verzweigten Blöcken. Zuvor scheiterten schon flache Folgen ab etwa 150 Schritten an der gemeinsamen Tiefenprüfung. Größere Projekte werden mit Erklärung abgewiesen und nicht verändert. Canvas und beide Einfügewege verwenden denselben zentralen Grenzwert. Details und offene Anschlussarbeit: [Qualitätsplan](qualitaet/ARBEITSPLAN.md).

Über contextBridge und Main-/Preload-IPC werden die weiterhin festen fachlichen Methoden als begrenzter JSON-Text transportiert. Die Renderer-Fassade behält die bestehenden typisierten Aufrufe; Main prüft Absender und Bytebudget vor dem Parsen. `src/gemeinsam/json.ts` schreibt reine Daten iterativ, bei gleicher Schlüsselreihenfolge und gleichen primitiven Bytes wie bisher; Inhaltshashes bleiben kompatibel. Projektdateien und Entwürfe nutzen kompaktes JSON, damit Einrückung langer Blockly-Folgen das 5-MiB-Dateibudget nicht quadratisch verbraucht. Das Schema bleibt 3.

Die `.scriptlab`-Datei verwendet Schema 3 und enthält `skriptsprache: 'python' | 'vbs'`, App-Version, Projektkennung, Namen und Beschreibung, den serialisierten Blockly-Zustand, Ansicht, nicht geheime Exportoptionen sowie `business` mit Parameterdefinitionen, Test-/Echt-Parametersätzen und Ressourcenreferenzen. Geschäftsdaten, Tabellenvorschauen und Laufberichte werden nicht eingebettet. Stabile Block-IDs und Verbindungen sind maßgeblich; Rasterpositionen bestimmen keine Reihenfolge. Schema-1-Projekte werden als VBS normalisiert; Schema 2 behält seine Sprache und erhält leere Business-Angaben. Das Laden allein schreibt keine Quelldatei um; unbekannte neuere Formate werden abgewiesen.

`src/kern/sprachen.ts` bündelt Sprachbezeichnungen, Dateiendungen und UI-Texte. `src/kern/skript.ts` wählt anhand der geprüften Projektsprache den Generator aus. Die Sprache wird vor einer leeren Neuanlage gewählt und bleibt anschließend fest. Die letzte erfolgreiche Wahl ist eine globale Einstellung; beim ersten Start ist sie `null`. Sie ersetzt keine Sprache in einem vorhandenen Projekt.

Beim Prüfen wird aus diesem Zustand die Bedeutung des Workflows abgeleitet. Nur ein validierter Hauptablauf darf exportiert werden. Das Zwischenmodell wird nicht als zweite, unabhängig änderbare Wahrheit gespeichert. Unvollständige Entwürfe können als Projekt erhalten bleiben. Ein Export meldet fehlende Werte, unbekannte Typen, mehrere Startblöcke und unverbundene aktive Blöcke.

Variablenfelder verweisen über stabile Blockly-Variablen-IDs auf `editor.variables`. Umbenennen ändert den Anzeigenamen und erhält alle Bezüge. Die Migration alter Namen führt deren frühere Zuordnung ohne Beachtung der Groß-/Kleinschreibung zusammen; ungültige leere Zuordnungen bleiben als zu behebender Fehler erkennbar. Die Generatoren ordnen IDs sichere technische Namen zu und trennen diese von internen Hilfsnamen. Ein Anzeigename ist kein Programmcode.

Beide reinen Generatoren übersetzen dieselben 48 Grundbausteintypen aus dem gemeinsamen Zwischenmodell. Dazu kommen aktuell 47 Python-Business-Bausteintypen. Die Generatoren behandeln Nutzertexte als Daten und geben notwendige Hilfsfunktionen nur einmal aus. Gleicher Workflow und gleiche Exportoptionen ergeben denselben unsignierten Exportquelltext. Die zusätzliche Testfassung enthält einen getrennten Laufkontext und ist kein Exportartefakt. Die Python-Grundbausteine benutzen ausschließlich Standardbibliothek und lokale `OleAut32`-/NLS-Funktionen über `ctypes`, keine VBScript-Engine oder COM-Server. Zusätzliche Business-Operationen rufen den festen eigenen Python-Opcode-Runner auf.

## Tabellen, Dokumente und Betriebsmodi

`src/kern/business-modell.ts`, `business-katalog.ts` und `business-validierung.ts` beschreiben fachliche Typen, Eingabefelder, Parameter und zulässige Referenzen. Die Oberfläche bietet beschriftete Felder, strukturierte Ausdrücke und frühere passende Ergebnisse an. Sie übergibt weder freies SQL noch Python- oder Shelltext. Business-Konfiguration und Ergebnisverweise liegen im vorhandenen Blockzustand; es gibt keinen unabhängig editierbaren zweiten Ablaufplan. Der Python-Generator verwendet denselben Laufzeitvertrag im Editor und Export.

`laufzeit/scriptlab_business` enthält `ausfuehrung.py`, `kontext.py`, `daten.py`, `dokumente.py`, `dateien.py` und die gemeinsamen Typen. DuckDB hält Tabellen als geprüfte Verarbeitungsketten außerhalb des Renderers. Die Laufzeit gibt Tabellenreferenzen und begrenzte Ausschnitte zurück; große Daten werden nicht als Rendererzustand übertragen. Die Dokumentadapter verwenden openpyxl, python-docx, ReportLab und pypdf. Freie Erweiterungsinstallation, OCR und Office-Konvertierung sind nicht enthalten.

- **Datenvorschau** führt reine unterstützte Datenschritte aus und plant Dokument-/Dateiausgaben. Sie überträgt höchstens 200 Zeilen und 256 KiB; die zugrunde liegende Operation kann trotzdem die vollständige Quelle lesen.
- **Prüflauf** erzeugt und prüft erforderliche eigene technische Zwischenfassungen, ohne fachliche Quellen oder Ziele zu ändern.
- **Ausführen** führt den vollständigen Workflow einschließlich seiner echten Dateiaktionen aus.

`businessModusPruefen` lässt normale Aktionsblöcke nicht versehentlich in die beiden nicht schreibenden Business-Modi gelangen. Codevorschau und reine Strukturprüfung starten auch keine Datenvorschau.

Ein Lauf übernimmt einen unveränderlichen Projekt- und Optionsstand. Standardwerte, gewählter Parametersatz und ausdrückliche Laufwerte werden zusammengeführt und nach ihren Definitionen geprüft. Der feste Testhost erhält einen technischen Kontext in einem eigenen Laufordner. Die eigentliche Pfadbasis ist davon getrennt. `SLBUS`-Ereignisse sind tokengebundene JSON-Textzeilen; Ereignisverlauf, Text und Vorschau erhalten Größenbudgets. Abschlussgrund und Berichtspfad bleiben auch bei großen Ergebnislisten verfügbar. Technische Bereinigung darf keine verspäteten Änderungen am globalen Folgelaufzustand vornehmen.

Dateiausgaben verwenden eigene Zwischenfassungen im Zielordner, Quellenfingerabdrücke, Inhaltsprüfung und ausdrückliche Konfliktregeln. Ein privates Journal protokolliert vorbereitete und bestätigte Vorgänge unter exklusiver Sperre. Wiederaufnahme bindet Workflow, Parameter und `runtime_hash`: eigene Python-Bytes, Python-Build, tatsächlich installierte Paketversionen und Vera-Schriftbytes, unabhängig vom Installationsort. Unklare Vorgänge und geänderte Laufzeit werden nicht automatisch wiederholt. Ein Journal über 16 MiB wird beim Einlesen zurückgewiesen. Dies ist keine verteilte Transaktion, Genau-einmal-Garantie oder Rollbackfunktion.

Dokumenttabellen sind auf 20.000 Zellen, PDFs auf 2.000 Seiten und PDF-Textauszüge auf 256 KiB begrenzt. DuckDBs Speicher- und Spillbudgets begrenzen nicht den gesamten Prozess oder sämtliche Bibliotheks-/Zieltempdateien. Das breite Millionen-CSV-Profil scheiterte unter 64 MB DuckDB-Budget; ein ausdrücklich schmalerer Plan bestand. Tatsächliche Messverfahren und Grenzen stehen in [BUSINESS-LEISTUNG-DATEN.md](BUSINESS-LEISTUNG-DATEN.md) und [BUSINESS-BEISPIELE-PRUEFUNG.md](BUSINESS-BEISPIELE-PRUEFUNG.md).

## Mitgelieferte Laufzeit und Exportpaket

Aktueller Appweg: `src/windows/app-laufzeit.ts` prüft das beim Build vorbereitete CPython-3.15.2-Bündel einschließlich Tcl/Tk und elf Business-Paketen. Es liegt in der Installation unter `resources/python`; Einstellungen zeigen den Komponentenbestand. Ein Appstart oder Workflowstart lädt und installiert nichts. Die folgenden Einrichtungsdienste bleiben als vorhandene technische und getestete Kompatibilitätsschicht erhalten; sie beschreiben nicht den aktuellen normalen Einstiegsweg. Maßgeblich für die Bedienung ist [ENTWICKLUNG.md](ENTWICKLUNG.md).

`src/windows/business-laufzeit.ts` prüft ein festes CPython-/Windows-x64-Profil und die Versionen aller elf benötigten Pakete. Nur die ausdrückliche Einrichtung erzeugt unter dem Benutzerverzeichnis eine neue eigene virtuelle Umgebung. Onlineversorgung akzeptiert ausschließlich den festgelegten PyPI-Wheelsatz; Offlineversorgung kopiert nur passende hashbestätigte Wheels aus dem bewusst ausgewählten IT-Ordner. Die Installation verwendet den privaten Wheelordner, `--no-index`, `--require-hashes`, `--only-binary`, `--no-deps` und eine feste Lockdatei. Sie ist kein allgemeiner Paketmanager. Die Prüfung oder ein Workflowstart installiert nichts.

Einrichtungsauftrag und Testlauf können nicht gleichzeitig denselben Laufzeitplatz verwenden. Abbruch und Schließen behandeln den gebundenen Einrichtungsvorgang; eine Updateinstallation wird währenddessen gesperrt. Alte Umgebungen und globale Python-Installationen werden nicht überschrieben. Der Renderer erhält nur Status und feste Aktionen für Prüfen, Online-/Offline-Einrichtung und Abbruch, keine freien Paketnamen oder Prozessargumente.

`src/main/business-export.ts` erzeugt das Business-ZIP ohne externes Packprogramm. Es enthält Script, eigene Module, Requirements, Parameterbeispiel, Anleitung, Vera-Schrift und deren Original-Lizenz sowie Business-Lizenzhinweise. ZIP-Namen verwenden UTF-8 und werden gegen ungültige oder doppelte Ziele geprüft. Eigene DOCX-/XLSX-Vorlagen, Bilder und TTF-Dateien werden ausschließlich nach nativer Auswahl übernommen und passende Parameterverweise relativiert. Geschäftsdaten, Journale und Berichte werden nicht automatisch beigefügt. Für ausdrücklich gewählte Ressourcen gelten 16 MiB je Datei und 64 MiB Gesamtpaket.

Gewöhnliche Python-Workflows bleiben einzelne `.py`-Dateien. Ein Business-ZIP benötigt beim Empfänger eine bewusst vorbereitete Umgebung; sein Start lädt oder installiert nichts. Alle Varianten funktionieren ohne ScriptLab oder Node.js. Die optionale Authenticode-Signatur bleibt ausschließlich VBS vorbehalten.

## Bewusst gestarteter Testlauf

`src/windows/testlauf.ts` besitzt den Laufzustand im Hauptprozess. Es übernimmt ausschließlich ein vollständig geprüftes Projekt und begrenzte Testoptionen. Der Renderer übergibt weder beliebigen Quelltext noch einen ausführbaren Programmpfad oder freie Prozessargumente. Das Preload bietet nur `testLesen`, `testStarten`, `testStoppen`, `testAusgabeLeeren`, `testAusgabeKopieren`, `testOrdnerWaehlen` und `testVerlassen`; die allgemeinen IPC-Absender- und Datenprüfungen gelten weiterhin.

Vor dem Start wird der Editorstand kopiert und aus diesem unveränderlichen Stand über denselben Generator eine sprachabhängige Testfassung mit Zeilen-/Blockzuordnung erzeugt. Projektkennung, Sprache, SHA-256-Standkennung, zufällige Lauf-ID, Start-/Endzeit und tatsächlich verwendete Optionen gehören zum Ergebnis; bei Python zusätzlich die tatsächlich verwendete Version. Ansichtsänderungen sind keine neue Workflowbedeutung. Die Testfassung erhält einen zufälligen Kontexttoken und einen ausdrücklich übergebenen absoluten Basisordner. Der normale Export verwendet weiterhin den Speicherordner seiner eigenen Scriptdatei. Die Generatoren führen in beiden Modi nichts aus.

Der fest mitgelieferte Windows-Helper `scripts/laufzeit-host.cs` startet für VBS ausschließlich den festgelegten Windows-Host `cscript.exe`, für Python ausschließlich den vorab geprüften und für diesen Lauf eingefrorenen absoluten CPython-Pfad. Argumente bleiben getrennte Daten. Der Python-Aufruf verwendet `-I -u -X utf8`; VBS liefert UTF-16LE-, Python UTF-8-Ausgabe. Der Helper verwendet keine Shell und ändert keine Dateizuordnung oder Sicherheitsrichtlinie. Windows-Jobobjekt, Kontrollpipe und der tatsächliche Hostabschluss binden beide Laufarten an denselben Lebenszyklus. Stoppen, Pipe-Ende (EOF) und Zeitlimit beenden die gebundenen Prozesse. Das Jobobjekt und Pythons isolierter Modus sind keine Sicherheits-Sandbox. Ein Test läuft mit den Rechten der Anwendung und kann über absolute oder UNC-Pfade außerhalb seines Basisordners wirken.

`src/windows/python.ts` prüft konkrete Interpreterdateien und stabiles CPython 3.12 bis 3.15 für Windows x64. Der aktuelle Appweg verwendet die mitgelieferte, manifestgeprüfte Laufzeit. Launcher, freie Befehle und ungeprüfte Pfade werden nicht als Interpreter verwendet. Die festen technischen Proben übernehmen keinen Workflowtext. Die externe Interpretererkennung und gesonderte Einrichtung bleiben technische Kompatibilitätsdienste; exportierte Scripts benötigen beim Empfänger eine passende eigene Laufzeit.

Die Oberfläche zeigt Status und Textausgabe an und sperrt inhaltliche Änderungen während Vorbereitung, Lauf und Stoppen. Eine Wechselentscheidung bei aktivem Test behandelt erst dessen Ende und anschließend den getrennten Projekt-/Entwurfsschutz. Ein normaler Teststart speichert weder das Projekt noch eine Exportdatei. Nur feste technische Dateien des Laufs werden bereinigt; Workflowergebnisse und der gewählte Basisordner gehören nicht zur Bereinigung. Die Bedienung und der gesonderte Prüfstand stehen in [TESTLAUF.md](TESTLAUF.md).

## Startseite und lokale Arbeitsstände

`src/renderer/Startbereich.tsx` hält ausschließlich Navigation, Suche, Sprachfilter, Sortierung und Listenposition. Der gemountete Blockly-Editor bleibt beim Wechsel verborgen erhalten. Die Bibliothek wird aus dem Hauptprozess geladen; sie ist kein zweiter Editorzustand. Lokale Hilfe wird aus `hilfe.ts` als React-Text dargestellt, ohne HTML-Interpretation. Sechs Grundbeispiele und fünf Python-Business-Beispiele verweisen auf vorhandene Projektdateien. Beim Übernehmen entstehen neue Projektkennungen und `(Kopie)`-Namen. Business-Beispieldaten werden in einen neuen privaten Ordner kopiert; ihre Pfadparameter werden absolut daran gebunden und bleiben dadurch auch nach Speichern oder Wiederherstellen gültig. Produktive Pfade erfordern eine bewusste Änderung.

`src/main/projektablage.ts` verwaltet unter dem Electron-Nutzerverzeichnis den Index `projektbibliothek.json` in Schema 2 und `entwuerfe/<UUID>.json` mit einem Sicherungsumschlag in Schema 1 und normalisiertem Projektinhalt in Schema 3. Alte Indexeinträge der Version 1 erhalten die VBS-Zuordnung. Der Index erfasst nur ausdrücklich geöffnete oder gespeicherte Dateien. Windows-Pfade werden normalisiert und ohne Unterscheidung der Großschreibung zugeordnet. Langsame Dateiprüfungen erhalten ein Zeitlimit; höchstens drei tatsächliche Projektdateizugriffe laufen zugleich. Neuere oder beschädigte Indexformate bleiben unverändert und werden als Hinweis angezeigt.

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
