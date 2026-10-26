# Architektur von ScriptLab

ScriptLab ist ein Editor und Exportwerkzeug für Windows 11 x64. Die Anwendung führt keine Nutzerworkflows aus. Diese Grenze gilt ebenso für Vorschau, Validierung, Beispiele und Signaturprüfung.

## Aufteilung

| Bereich         | Aufgabe                                                                            | Erlaubte Nebenwirkungen                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Hauptprozess    | Fenster, native Dialoge, Projekte, Index, Entwürfe, Einstellungen, Export          | Gewählte Projektdateien lesen/schreiben; Exportdatei schreiben; lokale Sicherungen, Dateiverweise und Einstellungen im Benutzerprofil verwalten |
| Preload         | Kleine, fest benannte Brücke zwischen Oberfläche und Hauptprozess                  | Nur ausdrücklich angebotene IPC-Methoden aufrufen                                                                                               |
| Renderer        | Deutsche React-Oberfläche, Blockly, reine Codevorschau                             | Editorzustand und Darstellung ändern                                                                                                            |
| Workflowkern    | Projektformat prüfen, Bedeutung aus Verbindungen ableiten, Fehler Blöcken zuordnen | Keine Datei-, Netzwerk- oder Prozesszugriffe                                                                                                    |
| Generator       | Validiertes Zwischenmodell deterministisch nach VBScript übersetzen                | Nur Text erzeugen                                                                                                                               |
| Windows-Dienste | Festes Signaturwerkzeug und kontrollierter Anwendungsupdater                       | Zertifikate abfragen, Exportdatei signieren/prüfen; ausdrücklich bestätigtes Anwendungsupdate installieren                                      |

Die genaue Dateiaufteilung ist im Quellverzeichnis `src` nachvollziehbar. Bibliotheken und Blockly-Medien werden lokal ausgeliefert. Bearbeiten, Speichern, Öffnen und unsignierter Export benötigen keine Netzwerkverbindung.

## Eine Quelle für den Workflow

Die `.scriptlab`-Datei enthält die Schemaversion, App-Version, den Namen und die Beschreibung, den serialisierten Blockly-Zustand, Ansicht und nicht geheime Exportoptionen. Stabile Block-IDs und Verbindungen sind maßgeblich; Rasterpositionen bestimmen keine Reihenfolge.

Beim Prüfen wird aus diesem Zustand die Bedeutung des Workflows abgeleitet. Nur ein validierter Hauptablauf darf exportiert werden. Das Zwischenmodell wird nicht als zweite, unabhängig änderbare Wahrheit gespeichert. Unvollständige Entwürfe können als Projekt erhalten bleiben. Ein Export meldet fehlende Werte, unbekannte Typen, mehrere Startblöcke und unverbundene aktive Blöcke.

Der reine Generator behandelt alle Nutzertexte als Daten. Er bildet Variablennamen auf sichere technische Namen ab, verhindert Kollisionen ohne Beachtung der Groß-/Kleinschreibung und trennt diese von internen Hilfsnamen. Hilfsfunktionen werden nur einmal ausgegeben. Gleicher Workflow und gleiche Optionen ergeben denselben unsignierten Quelltext.

## Startseite und lokale Arbeitsstände

`src/renderer/Startbereich.tsx` hält ausschließlich Navigation, Suche, Sortierung und Listenposition. Der gemountete Blockly-Editor bleibt beim Wechsel verborgen erhalten. Die Bibliothek wird aus dem Hauptprozess geladen; sie ist kein zweiter Editorzustand. Lokale Hilfe wird aus `hilfe.ts` als React-Text dargestellt. Die drei Beispielmetadaten verweisen auf die vorhandenen Projektdateien; beim Übernehmen entsteht eine neue Projektkopie.

`src/main/projektablage.ts` verwaltet unter dem Electron-Nutzerverzeichnis den Index `projektbibliothek.json` und `entwuerfe/<UUID>.json`. Beide haben ein geprüftes Schema der Version 1. Der Index erfasst nur ausdrücklich geöffnete oder gespeicherte Dateien. Windows-Pfade werden normalisiert und ohne Unterscheidung der Großschreibung zugeordnet. Langsame Dateiprüfungen erhalten ein Zeitlimit; höchstens drei tatsächliche Projektdateizugriffe laufen zugleich. Neuere oder beschädigte Indexformate bleiben unverändert und werden als Hinweis angezeigt.

Die optionale UUID `projektKennung` ergänzt das bestehende Projektschema 1 abwärtskompatibel. Alte Projektdateien bleiben lesbar und erhalten beim Laden eine Kennung. Eine Entwurfskennung ist davon getrennt, damit eine neue Bearbeitung keine noch nicht gewählte Wiederherstellung überschreibt. Ein Entwurf enthält den vollständigen geprüften Projektstand, die letzte erfolgreiche Sicherungszeit sowie gegebenenfalls Ausgangspfad und SHA-256 des zugrunde liegenden Dateistands. Die verzögerte Sicherung schreibt ausschließlich in den Nutzerbereich; sie ändert weder Originaldatei noch deren Ungespeichert-Status.

Vor Ersetzen, Schließen und Update-Neustart greifen gemeinsame Speicherentscheidungen. Ein Wechsel mit „Als Entwurf behalten“ wartet auf erfolgreiches atomisches Schreiben. Verwerfen entfernt auch vorgemerkte Sicherungen. Speichern prüft eine vorhandene Ausgangsdatei gegen den bekannten Hash und verlangt bei Konflikten eine separate Kopie. Nach einer Speicherentscheidung wird eine zu öffnende Datei erneut gelesen, damit ein gerade gespeicherter Stand nicht durch einen älteren Lesestand ersetzt wird. Testprofile sind über eine ausschließlich im Entwicklungsbetrieb erlaubte Konfiguration isoliert.

## Sicherheitsgrenze zwischen Oberfläche und Windows

Das Electron-Fenster verwendet `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true`. Ein restriktiver CSP erlaubt keine fremden Scripts. Navigationen, neue Fenster, nicht benötigte Berechtigungen und fremde Inhalte werden gesperrt.

Der Hauptprozess prüft für jede IPC-Anfrage den Absender einschließlich des erlaubten Hauptframes sowie Typen, Längen und Struktur der Nutzdaten. Der Renderer erhält keine allgemeine Datei-, Shell-, Prozess-, URL- oder Electron-Schnittstelle. Ein Dateipfad aus einer Projektdatei kann deshalb keine Windows-Operation beim Bearbeiten oder Exportieren auslösen.

Der Exportpfad stammt aus einem nativen Speicherdialog. Der Hauptprozess erzeugt den VBS-Quelltext erneut aus dem geprüften Projekt; er übernimmt keinen frei eingegebenen Quelltext vom Renderer. Nach dem Export ist nur das Anzeigen des Speicherorts zulässig. Die Exportdatei wird nicht geöffnet.

Das Signaturwerkzeug hat fest vorgegebene Operationen und Argumente. Es ist kein allgemeiner PowerShell-Aufruf. Der Updater installiert ausschließlich ScriptLab-Updates. Nutzerzertifikate und die Signatur der ScriptLab-Anwendung bleiben getrennt.

## Dateien und Kodierung

Projektdateien sind lesbares JSON in UTF-8. Ein Speichervorgang schreibt zuerst eine temporäre Datei im selben Ordner und ersetzt die Zieldatei erst nach erfolgreichem Schreiben. Abgebrochene Dialoge sind normale Abbrüche. Neuere unbekannte Schemaversionen werden nicht überschrieben.

VBS-Exporte verwenden UTF-16LE mit BOM und CRLF. Die Kodierung von Textdateien, die ein später gestarteter Workflow liest oder schreibt, wird davon getrennt behandelt. Relative Workflowpfade beziehen sich auf den Ordner der exportierten VBS-Datei.

## Entwicklung und Prüfung

Ein ausschließlich für die Entwicklung vorgesehenes Werkzeug kann den Windows-VBScript-Parser im nicht ausführbaren Zustand `SCRIPTSTATE_INITIALIZED` verwenden. Es wird nicht mit der Anwendung ausgeliefert. Es stellt keine Hostobjekte bereit, schaltet nie in einen ausführbaren Zustand und prüft auch nach dem Parsen den Zustand sowie null Ausführungseintritte. Die praktische Prüfung und ihre Grenzen stehen in [PRUEFPLAN.md](PRUEFPLAN.md).

Der Einsatz der optionalen Windows-VBScript-Komponente ist keine Voraussetzung für ScriptLab. Die Anwendung aktiviert weder Windows-Features noch Sicherheitsrichtlinien. Microsoft hat VBScript abgekündigt; die spätere eigenständige Ausführung hängt von Windows, der verfügbaren Komponente und den Richtlinien ab.

## Offizielle Grundlagen

- [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron 45 und Änderungen am Sandbox-Preload](https://www.electronjs.org/blog/electron-45-0)
- [Blockly-Codegenerierung](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/)
- [Stabile electron-builder-v26-Dokumentation](https://www.electron.build/v26/)
- [Microsoft: abgekündigte Windows-Funktionen](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features)

Am 26.10.2026 zeigt die Startseite von electron-builder ausdrücklich die noch nicht veröffentlichte v27-Dokumentation. Für die eingesetzte stabile v26 ist deshalb die versionierte Dokumentation maßgeblich. Die tatsächlich installierten Paketversionen und Integritätswerte stehen in `package-lock.json`.
