# ScriptLab

Visueller Baukasten für Windows-Automatisierungen. **Entwickelt von Leon Stolz.**

ScriptLab erstellt, prüft und speichert Workflows und exportiert VBScript-Dateien. Es führt keine Workflows aus. Die Codevorschau zeigt ausschließlich Text. Exportierte Dateien führt der Nutzer eigenständig außerhalb der Anwendung aus.

Zielsystem der ersten Version: Windows 11 x64. Weitere Windows-Versionen sind derzeit nicht freigegeben. Die Windows-VBScript-Komponente wird zum Bearbeiten und Exportieren nicht benötigt.

## Installation

Der Windows-Build erzeugt `release/ScriptLab-0.1.0-Setup-x64.exe`. Der NSIS-Installer installiert für den aktuellen Nutzer; Node.js ist auf dem Zielrechner nicht erforderlich. Die erste lokal gebaute Version ist ein unsignierter Testbuild. Ein produktives GitHub Release wird erst mit eingerichteter Entwickler-Signatur veröffentlicht. Der tatsächliche Prüfstand steht in [docs/ABNAHME.md](docs/ABNAHME.md).

## Ein erster Workflow

1. ScriptLab öffnen und auf der Startseite **Neuer Workflow** wählen. Der Editor öffnet sich mit genau dem Baustein **Workflow starten**.
2. Links nach **Nachricht** suchen und beim Treffer **Nachricht anzeigen** auf Plus klicken.
3. Als Einfügestelle **Nach „Workflow starten“** wählen. Alternativ lässt sich der Baustein aus der Palette an den Start ziehen.
4. Den Nachrichtentext direkt am Baustein bearbeiten oder den Baustein auswählen und **Eigenschaften** öffnen (F4). Namen und Beschreibung des Projekts änderst du im **Projektmenü → Projektangaben**.
5. Mit **Speichern** ein bearbeitbares `.scriptlab`-Projekt sichern. **Codevorschau** öffnet bei Bedarf unten die schreibgeschützte VBS-Vorschau.
6. Mit **Als VBS exportieren** eine `.vbs`-Datei speichern.

Danach gilt: **„Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“** ScriptLab besitzt keinen Startknopf, Testlauf oder Zeitplan für Workflows. „Speicherordner anzeigen“ markiert die Datei im Explorer und startet sie nicht.

47 Bausteintypen decken Ein-/Ausgabe, Bedingungen, Schleifen, Dateien, Variablen, Listen, Texte, Zahlen sowie Datum und Zeit ab. [Bedienung und Beispiele](docs/BEDIENUNG.md) und [Bausteinreferenz](docs/BAUSTEINE.md) erklären Bedeutung, Pflichtwerte und Dateioperationen. Die drei Beispiele sind auf der Startseite unter **Beispielworkflows** und im Projektmenü erreichbar. Sie öffnen sich als bearbeitbare Kopien mit dem Namenszusatz **(Kopie)**; die Vorlagen in [beispiele](beispiele) bleiben unverändert. Auch ihr Öffnen und Exportieren führt keine ihrer Aktionen aus.

Die linke Palette verbindet Suche und Kategorien in einem verstellbaren Bereich. Eigenschaften und Codevorschau sind anfangs geschlossen. Neben Drag-and-drop gibt es anklickbare Einfügestellen zum Hinzufügen, Verbinden und Verschieben. Das Mausrad verschiebt die Arbeitsfläche; Strg+Mausrad zoomt dort. Die [Designnotiz](docs/DESIGNNOTIZ.md) enthält die tatsächlichen UI-Prüfungen, Bildschirmaufnahmen und offenen Punkte.

Die Startseite bietet **Meine gespeicherten Workflows**, **Entwürfe**, **Beispielworkflows** und **Dokumentation und Anleitungen**. Die Projektliste führt nur bekannte, selbst geöffnete oder gespeicherte Dateien; ScriptLab durchsucht keine Laufwerke. **Startseite** im Editor und anschließend **Weiterbearbeiten** erhalten den laufenden Arbeitsstand. Die [Startseitendokumentation](docs/STARTSEITE.md) hält ihre eigenen Bediennachweise fest.

## Entwicklung

Node.js 24 LTS und npm installieren. Danach im Projektordner:

```powershell
npm ci
npm run check
npm test
npm run build
npm run test:e2e
npm run dev
```

`npm run dev` baut die Anwendung und öffnet das lokale Electron-Fenster; es startet keinen Webserver und lädt keine entfernten Bibliotheken. Nach Codeänderungen neu bauen und starten.

`npm run package` baut den Windows-Installer. `npm run package:dir` erzeugt ein entpacktes Programmpaket. Beide arbeiten mit `electron-builder` 26. Der [Releaseprozess](docs/RELEASES.md) beschreibt GitHub Actions, erforderliche Secrets und geprüfte Updateartefakte. Gewöhnliche Commits veröffentlichen kein Release.

Nach `npm run package` prüft `npm run verify:package` Installergröße, Update-Prüfsummen, Blockmap und die Übereinstimmung des entpackten Pakets mit `dist`, Beispielen und Beilagen. Der tatsächliche Bericht liegt unter `release/pruefung.json`. Diese lesende Prüfung ersetzt weder eine Installation noch den Vergleich zweier installierter Updateversionen.

## Projekt und Export

`.scriptlab` enthält den bearbeitbaren JSON-Projektzustand. `.vbs` enthält erzeugten Quelltext und ist kein rückimportierbares Projektformat. Unvollständige Entwürfe dürfen gespeichert werden; Fehler verhindern den Export.

Inhaltliche Änderungen werden nach kurzer Eingabepause zusätzlich als lokale Entwürfe gesichert. **Projektmenü → Als Entwurf sichern** stößt dies ausdrücklich an. Eine Entwurfssicherung lässt die Projektdatei unverändert: **Entwurf lokal gesichert** und **Ungespeicherte Änderungen** können gleichzeitig gelten. Vor einem möglichen Verlust stehen **Speichern**, **Als Entwurf behalten**, **Änderungen verwerfen** und **Abbrechen** zur Wahl. Wurde die Ausgangsdatei von außen verändert oder ist sie nicht erreichbar, muss der Arbeitsstand als separate Projektkopie gespeichert werden.

VBS-Quelltext verwendet UTF-16LE mit BOM und CRLF; dies wurde vom Windows-VBScript-Parser ohne Ausführung bestätigt. Relative Dateipfade beziehen sich auf den Speicherort der exportierten VBS-Datei. Textdateien eines Workflows haben eine gesondert ausgewählte Kodierung. Dateiaktionen prüfen Quellen und vorhandene Ziele beim späteren eigenen Start; ihre Regeln stehen in der Bausteinhilfe.

Die spätere eigenständige Ausführung benötigt die Windows-VBScript-Komponente, Windows Script Host und die jeweils zugelassenen Windows-Komponenten (`Scripting.FileSystemObject`, für Textkodierungen `ADODB.Stream`). Windows- und Unternehmensrichtlinien können die Ausführung verhindern. VBScript ist von Microsoft abgekündigt. ScriptLab aktiviert keine Features und ändert keine Richtlinien.

## Signaturen und Updates

[Optionale VBS-Signaturen](docs/SIGNATUR.md) verwenden das vom Nutzer gewählte gültige Code-Signing-Zertifikat mit privatem Schlüssel im Windows-Zertifikatspeicher, eindeutig zugeordnet über seinen Fingerabdruck. Signiert wird mit SHA-256; anschließend prüft Windows die fertige Datei, ohne sie auszuführen. Ohne Zertifikat bleibt der normale unsignierte Export möglich.

Eine Signatur hilft, Herausgeber und Veränderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch eine Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen. Zertifikate und private Schlüssel der App und der Nutzerworkflows sind getrennt. ScriptLab liefert keinen privaten Entwicklerschlüssel aus.

Automatische Updateprüfung ist standardmäßig aus. Download und Installation erfolgen nach Nutzerentscheidung, ein normales Beenden installiert nichts. Ein Build ohne verifizierbaren Zertifikatsherausgeber sperrt den Updater. Die echte Updatekette über zwei signierte Versionen ist noch einzurichten und praktisch zu prüfen.

## Aufbau und Prüfungen

- [Architektur](docs/ARCHITEKTUR.md): geprüfte IPC-Schnittstellen, isolierter Renderer, Datenmodell und Generator.
- [Versionen und offizielle Quellen](docs/VERSIONEN.md).
- [Prüfplan](docs/PRUEFPLAN.md) und [tatsächlicher Abnahmestand](docs/ABNAHME.md).

Anwendungscode und Hilfen sind deutsch. Einstellungen, der bekannte Dateiverweise enthaltende Index `projektbibliothek.json` und lokale Sicherungen unter `entwuerfe\<UUID>.json` liegen außerhalb des Installationsordners im Electron-Nutzerverzeichnis (`%APPDATA%\ScriptLab`). Projektdateien werden an selbst gewählten Orten gespeichert. Die Bibliotheken und Anleitungen werden lokal ausgeliefert. Bearbeiten, Projektspeicherung, Hilfe und unsignierter Export benötigen kein Netzwerk.

## Rechte und Drittanbieter

Die Projektlizenz hat Leon Stolz noch nicht festgelegt. `UNLICENSED` kennzeichnet diese ausstehende Freigabe und erteilt keine Nutzungslizenz. Fremdbibliotheken behalten ihre jeweiligen Lizenzen. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) inventarisiert die ausgelieferten Produktionsabhängigkeiten und enthält die vorhandenen Originalhinweise; der fehlende vollständige Originaltext des Pakets `lazy-val@1.0.5` ist ausdrücklich vermerkt. Die Originaldateien `LICENSE.electron.txt` und `LICENSES.chromium.html` liegen der Windows-Distribution bei.

Die Lizenzhinweise werden offline mit `node scripts/lizenzhinweise.mjs` erzeugt und mit `node scripts/lizenzhinweise.mjs --check` auf Aktualität geprüft. Die öffentliche Quellcodeablage ist keine zusätzliche Lizenzfreigabe.
