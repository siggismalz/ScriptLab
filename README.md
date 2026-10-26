# ScriptLab

Visueller Baukasten für Windows-Automatisierungen. **Entwickelt von Leon Stolz.**

ScriptLab erstellt, prüft und speichert Workflows für Windows. **Python ist die Hauptsprache für Geschäftsabläufe**; die 48 gemeinsamen Grundbausteine bleiben auch für VBScript verfügbar. Zusätzlich bietet Python 47 Business-Bausteintypen für Tabellen, Dateien, Excel, Word und PDF. Die Sprache wird beim Erstellen gewählt und bleibt für das Projekt fest.

Ein bewusst gestarteter Test kann den vollständigen aktuellen Workflow auf diesem Computer ausführen und echte Dateien verändern. Er ist keine Sandbox. Für Business-Abläufe gibt es zusätzlich eine begrenzte **Datenvorschau** und einen **Prüflauf ohne fachliche Zieländerungen**. Öffnen, Wiederherstellen, Bearbeiten, Codevorschau, Speichern, Export und Signaturprüfung starten keine Verarbeitung. Exportierte Scripts kannst du eigenständig außerhalb der Anwendung ausführen.

Zielsystem der ersten Version: Windows 11 x64. Weitere Windows-Versionen sind derzeit nicht freigegeben. Bearbeiten, Speichern und Exportieren benötigen weder eine Python-Installation noch die Windows-VBScript-Komponente.

## Installation

Der Windows-Build erzeugt `release/ScriptLab-<Paketversion>-Setup-x64.exe`; maßgeblich ist die Version in `package.json`. Der NSIS-Installer installiert für den aktuellen Nutzer; Node.js ist auf dem Zielrechner nicht erforderlich. Ein unsignierter Testinstaller ist kein produktives Release. Ein produktives GitHub Release wird erst mit eingerichteter Entwickler-Signatur veröffentlicht. Der aktuelle Business-Prüfstand steht in [docs/BUSINESS-ABNAHME.md](docs/BUSINESS-ABNAHME.md); [docs/ABNAHME.md](docs/ABNAHME.md) bewahrt die historischen 0.1.0-Nachweise.

## Ein erster Workflow

1. ScriptLab öffnen und auf der Startseite **Neuer Workflow** wählen. Im Dialog **Welche Sprache möchtest du verwenden?** Python oder VBScript (VBS) auswählen und **Workflow erstellen** bestätigen. Der Editor öffnet sich mit genau dem Baustein **Workflow starten**.
2. Links nach **Nachricht** suchen und beim Treffer **Nachricht anzeigen** auf Plus klicken.
3. Als Einfügestelle **Nach „Workflow starten“** wählen. Alternativ lässt sich der Baustein aus der Palette an den Start ziehen.
4. Den Nachrichtentext direkt am Baustein bearbeiten oder den Baustein auswählen und **Eigenschaften** öffnen (F4). Namen und Beschreibung des Projekts änderst du im **Projektmenü → Projektangaben**.
5. Mit **Speichern** ein bearbeitbares `.scriptlab`-Projekt sichern. **Codevorschau** öffnet bei Bedarf unten den schreibgeschützten Python- oder VBS-Code.
6. Mit **Python-Script exportieren** eine `.py`-Datei oder mit **VBS-Script exportieren** eine `.vbs`-Datei speichern.

Bei der ersten Erstellung ist keine Sprache vorausgewählt. Später schlägt ScriptLab die zuletzt erfolgreich gewählte Sprache vor. **Abbrechen** erhält den bisherigen Workflow. Bestehende Projekte werden nicht auf eine andere Sprache umgestellt.

Danach gilt: **„Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“** „Speicherordner anzeigen“ markiert die Datei im Explorer und startet sie nicht. Es gibt keine Zeitplanung oder automatische Workflowausführung.

Die 48 gemeinsamen Bausteintypen decken Ein-/Ausgabe, Bedingungen, Schleifen, Dateien, Variablen, Listen, Texte, Zahlen sowie Datum und Zeit ab. [Bedienung und Beispiele](docs/BEDIENUNG.md) und [Bausteinreferenz](docs/BAUSTEINE.md) erklären Bedeutung, Pflichtwerte und Dateioperationen. Die sechs Grundbeispiele – drei je Sprache – und fünf zusätzliche Python-Business-Beispiele sind auf der Startseite unter **Beispielworkflows** und im Projektmenü erreichbar. Sie öffnen sich als bearbeitbare Kopien mit neuer Kennung und **(Kopie)** im Namen. Die Vorlagen in [beispiele](beispiele) bleiben unverändert.

## Ein erster Geschäftsablauf

1. Unter **Einstellungen → Python-Installation** einen geeigneten CPython-Interpreter prüfen. Die Grundinstallation wird nicht automatisch installiert.
2. Unter **Business-Laufzeit** entweder eine vorbereitete Umgebung prüfen, **Eigene Umgebung online einrichten** oder **Offline-Paketordner verwenden** wählen. Nur diese bewusste Einrichtung installiert den festen, hashgepinnten Paketsatz in eine neue eigene virtuelle Umgebung. Ein Workflowstart installiert niemals Pakete.
3. Das Beispiel **Monatliche Auswertung** als Vorlage verwenden. ScriptLab kopiert ausschließlich seine synthetischen Testdateien in einen privaten Beispielordner und bindet die Pfadparameter absolut daran. Speichern, erneutes Öffnen und Entwurfwiederherstellung verlieren diesen Bezug nicht. Für produktive Daten musst du Quellen und Ziele bewusst ändern.
4. **Testausgabe** öffnen, Parameter und **Quellen, Ziele und Umfang** prüfen. Zunächst **Datenvorschau**, danach **Prüflauf ohne Zieländerungen** wählen. Erst **Ausführen · echte Dateiänderungen** verarbeitet die gewählten Daten und schreibt die fachlichen Ergebnisse.
5. Das bearbeitbare Projekt speichern. **Business-Paket exportieren** erzeugt ein eigenständiges ZIP mit Python-Script, Business-Modulen, fester Lockdatei, Parametervorlage, Anleitung und Vera-Schrift samt Lizenz. Eigene Vorlagen, Bilder oder Schriften werden nur nach ausdrücklicher Auswahl beigefügt; Geschäftsdaten und Laufprotokolle werden nicht automatisch kopiert.

Die fünf Beispiele behandeln **Monatsauswertung**, **Bestellungen mit Stammdaten**, **Word-Bestellvorschlag**, **PDF-Dokumenteingang** und **CSV-Dateistapel mit Wiederaufnahme**. Die [Business-Bedienung](docs/BUSINESS-BEDIENUNG.md) führt durch Einrichtung, Modi und Parameter. [Tabellenverarbeitung](docs/BUSINESS-DATEN.md), [Dokumente und Dateisicherheit](docs/BUSINESS-DOKUMENTE.md) und [Business-Laufzeit](docs/BUSINESS-LAUFZEIT.md) beschreiben den tatsächlichen Umfang und seine Grenzen.

Die linke Palette verbindet Suche und Kategorien in einem verstellbaren Bereich. Eigenschaften und Codevorschau sind anfangs geschlossen. Neben Drag-and-drop gibt es anklickbare Einfügestellen zum Hinzufügen, Verbinden und Verschieben. Das Mausrad verschiebt die Arbeitsfläche; Strg+Mausrad zoomt dort. Die [Designnotiz](docs/DESIGNNOTIZ.md) enthält die tatsächlichen UI-Prüfungen, Bildschirmaufnahmen und offenen Punkte.

Die Startseite bietet **Meine gespeicherten Workflows**, **Entwürfe**, **Beispielworkflows** und **Dokumentation und Anleitungen**. Die Projektliste führt nur bekannte, selbst geöffnete oder gespeicherte Dateien; ScriptLab durchsucht keine Laufwerke. **Startseite** im Editor und anschließend **Weiterbearbeiten** erhalten den laufenden Arbeitsstand. Die [Startseitendokumentation](docs/STARTSEITE.md) hält ihre eigenen Bediennachweise fest.

## Entwicklung

Node.js 24 LTS und npm installieren. Der Windows-Build benötigt außerdem den C#-Compiler des vorhandenen Windows-.NET-Frameworks 4; `scripts/laufzeit-host-bauen.mjs` verwendet ausschließlich dessen feste Windows-Pfade und installiert keine Komponenten. Der fertige Installer liefert den kompilierten Testhelper mit aus; Endnutzer benötigen keinen Compiler. Danach im Projektordner:

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

Falls ältere Builddateien gesperrt sind, kann ein eigener Ausgabeordner verwendet werden. Die Prüfung akzeptiert denselben Ordner als Argument und schreibt ihren Bericht dort; ihre Prüfungen bleiben gleich:

```powershell
npm run build
npx electron-builder --win nsis --x64 --publish never --config.directories.output=artifacts/startseiten-build-final
npm run verify:package -- artifacts/startseiten-build-final
```

## Einen Workflow testen

Öffne **Testausgabe**, wähle über **Ordner auswählen** einen Basisordner und prüfe das Zeitlimit (Standard: 120 Sekunden). **Testen** startet den vollständigen aktuellen Workflow, einschließlich Dateiaktionen und Dialogen. **Text ausgeben** schreibt in die Testausgabe; **Nachricht anzeigen** öffnet einen Dialog. Der [Testlaufleitfaden](docs/TESTLAUF.md) dokumentiert den bisherigen VBS-Prüfstand; die [Python-Dokumentation](docs/PYTHON.md) ergänzt Einrichtung und neue Laufzeitprüfungen.

**Stoppen** beendet den Test, macht bereits erfolgte Änderungen aber nicht rückgängig. Relative Pfade beziehen sich beim Test auf den sichtbaren Basisordner. Absolute Pfade können auch außerhalb dieses Ordners wirken. Ein Test speichert weder das Projekt noch eine Exportdatei. Python-Tests benötigen eine geeignete lokale CPython-Installation, VBS-Tests die verfügbare Windows-VBScript-Laufzeit.

## Python einrichten und selbst ausführen

Unter **Einstellungen → Python-Installation** lässt sich ein konkreter Interpreter auswählen und erneut prüfen. Unterstützt wird stabiles CPython 3.12 bis 3.15 für Windows x64. ScriptLab zeigt den tatsächlichen Status, die Version und den Interpreterpfad; es installiert keine Python-Grundinstallation und keine Pakete automatisch. Die 48 gemeinsamen Grundbausteintypen benötigen keine zusätzlichen Python-Pakete. Die zusätzlichen Business-Bausteine verwenden den ausdrücklich eingerichteten festen Paketsatz. Dialogbausteine benötigen `tkinter`, dessen Verfügbarkeit erst bei Bedarf geprüft wird. Abläufe ohne Dialoge setzen `tkinter` nicht voraus.

Ein exportiertes Python-Script kann in PowerShell mit dem vollständigen Pfad des eigenen Interpreters gestartet werden. Die folgenden Beispielpfade müssen durch die tatsächlich vorhandenen Pfade ersetzt werden:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Begruessung.py"
```

`-I` isoliert die Python-Modulsuche und ignoriert Python-Umgebungsvariablen, `-u` liefert ungepufferte Ausgabe und `-X utf8` aktiviert den UTF-8-Modus. Das ist keine Sicherheits-Sandbox. Ein Doppelklick auf `.py` ist von Windows-Dateizuordnungen abhängig und wird nicht vorausgesetzt. Der Interpreterpfad ist eine lokale Einstellung und gehört nicht in Projekt- oder Exportdateien. Weitere Hinweise stehen in [docs/PYTHON.md](docs/PYTHON.md) und der [offiziellen CPython-Dokumentation](https://docs.python.org/3.15/using/cmdline.html).

## Projekt und Export

`.scriptlab` enthält den bearbeitbaren JSON-Projektzustand in Schema 3 einschließlich `skriptsprache`, stabiler Variablen-IDs, Ansicht, Parameterdefinitionen und nicht geheimer Test-/Echt-Parametersätze. Alte Projekte in Schema 1 werden als VBS übernommen; Schema 2 behält seine Sprache und erhält die leeren Business-Angaben. Das Laden überschreibt keine Quelldatei. `.py`, `.vbs` und Business-ZIPs sind keine rückimportierbaren Projektformate. Unvollständige Entwürfe dürfen gespeichert werden; Fehler verhindern den Export.

Inhaltliche Änderungen werden nach kurzer Eingabepause zusätzlich als lokale Entwürfe gesichert. **Projektmenü → Als Entwurf sichern** stößt dies ausdrücklich an. Eine Entwurfssicherung lässt die Projektdatei unverändert: **Entwurf lokal gesichert** und **Ungespeicherte Änderungen** können gleichzeitig gelten. Vor einem möglichen Verlust stehen **Speichern**, **Als Entwurf behalten**, **Änderungen verwerfen** und **Abbrechen** zur Wahl. Wurde die Ausgangsdatei von außen verändert oder ist sie nicht erreichbar, muss der Arbeitsstand als separate Projektkopie gespeichert werden.

Python-Quelltext verwendet UTF-8 ohne BOM und CRLF. VBS-Quelltext verwendet UTF-16LE mit BOM und CRLF; die bisherige VBS-Kodierung wurde vom Windows-VBScript-Parser ohne Ausführung bestätigt. Relative Dateipfade beziehen sich beim Export auf den Speicherort der jeweiligen Scriptdatei und beim Test auf den gewählten Basisordner. Textdateien eines Workflows haben eine gesondert ausgewählte Kodierung. Dateiaktionen prüfen Quellen und vorhandene Ziele erst während einer ausdrücklich gestarteten Ausführung; ihre Regeln stehen in der Bausteinhilfe.

Alle Exportvarianten funktionieren ohne ScriptLab oder Node.js beim Empfänger. Gewöhnliche Python-Workflows bleiben einzelne `.py`-Dateien mit Standardbibliothek und lokalen Windows-APIs. Ein Business-Workflow benötigt zusätzlich die Module aus seinem ZIP und eine vorbereitete Umgebung mit den festgelegten Paketen; sein Start installiert nichts. VBS benötigt die Windows-VBScript-Komponente, Windows Script Host und die jeweils zugelassenen Windows-Komponenten (`Scripting.FileSystemObject`, für Textkodierungen `ADODB.Stream`). Windows- und Unternehmensrichtlinien können die Ausführung verhindern. VBScript ist von Microsoft abgekündigt. ScriptLab aktiviert keine Features und ändert keine Richtlinien.

Business-Ausgaben werden über eigene Zwischenfassungen und ausdrückliche Konfliktregeln veröffentlicht. Ein Journal hilft beim bewussten Fortsetzen, garantiert aber keine allgemeine Genau-einmal-Verarbeitung und keinen Rollback. Dokumenttabellen sind auf 20.000 Zellen begrenzt; Journale über 16 MiB werden beim erneuten Einlesen abgewiesen. DuckDBs Speicherbudget begrenzt nicht den gesamten Python-Prozess. Ein breites Millionen-CSV-Profil scheiterte im dokumentierten 64-MB-Profil; das schmalere Profil bestand. Excel-Formeln werden nicht berechnet, PDF-Scans nicht per OCR gelesen und Office-Dokumente nicht über Office konvertiert. Die [Lastnachweise](docs/BUSINESS-LEISTUNG-DATEN.md) und [Dokumentbeispiele](docs/BUSINESS-BEISPIELE-PRUEFUNG.md) trennen diese Prüfungen von UI- und Installerabnahme.

## Signaturen und Updates

[Optionale VBS-Signaturen](docs/SIGNATUR.md) verwenden das vom Nutzer gewählte gültige Code-Signing-Zertifikat mit privatem Schlüssel im Windows-Zertifikatspeicher, eindeutig zugeordnet über seinen Fingerabdruck. Signiert wird mit SHA-256; anschließend prüft Windows die fertige Datei, ohne sie auszuführen. Ohne Zertifikat bleibt der normale unsignierte Export möglich.

Für Python-Exporte ist kein Signaturverfahren implementiert. VBS-Signaturoptionen werden bei Python-Projekten nicht angeboten; ein Python-Export erhält kein erfundenes Signaturprüfergebnis.

Eine Signatur hilft, Herausgeber und Veränderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch eine Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen. Zertifikate und private Schlüssel der App und der Nutzerworkflows sind getrennt. ScriptLab liefert keinen privaten Entwicklerschlüssel aus.

Automatische Updateprüfung ist standardmäßig aus. Download und Installation erfolgen nach Nutzerentscheidung, ein normales Beenden installiert nichts. Ein Build ohne verifizierbaren Zertifikatsherausgeber sperrt den Updater. Die echte Updatekette über zwei signierte Versionen ist noch einzurichten und praktisch zu prüfen.

## Aufbau und Prüfungen

- [Architektur](docs/ARCHITEKTUR.md): geprüfte IPC-Schnittstellen, isolierter Renderer, Datenmodell und Generator.
- [Versionen und offizielle Quellen](docs/VERSIONEN.md).
- [Prüfplan](docs/PRUEFPLAN.md), [Business-Abnahmestand](docs/BUSINESS-ABNAHME.md) und [historische Abnahme](docs/ABNAHME.md).

Anwendungscode und Hilfen sind deutsch. Einstellungen, der bekannte Dateiverweise enthaltende Index `projektbibliothek.json` und lokale Sicherungen unter `entwuerfe\<UUID>.json` liegen außerhalb des Installationsordners im Electron-Nutzerverzeichnis (`%APPDATA%\ScriptLab`). Dort liegen auch private Business-Beispielkopien, eigene Laufzeiten und lokale Business-Journale. Projektdateien werden an selbst gewählten Orten gespeichert. Die Bibliotheken und zehn lokalen Hilfethemen werden mitgeliefert. Bearbeiten, Projektspeicherung, Hilfe und unsignierter Export benötigen kein Netzwerk.

## Rechte und Drittanbieter

Die Projektlizenz hat Leon Stolz noch nicht festgelegt. `UNLICENSED` kennzeichnet diese ausstehende Freigabe und erteilt keine Nutzungslizenz. Fremdbibliotheken behalten ihre jeweiligen Lizenzen. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) inventarisiert die ausgelieferten Produktionsabhängigkeiten und enthält die vorhandenen Originalhinweise; der fehlende vollständige Originaltext des Pakets `lazy-val@1.0.5` ist ausdrücklich vermerkt. Die Originaldateien `LICENSE.electron.txt` und `LICENSES.chromium.html` liegen der Windows-Distribution bei.

Der feste optionale Python-Paketsatz besitzt eigene [Business-Lizenzhinweise](laufzeit/business-notices.md). Die unverändert mitgelieferte Vera-Schrift liegt zusammen mit ihrer Original-Lizenz im Business-Paket; Windows-Schriften werden nicht weiterverteilt.

Die Lizenzhinweise werden offline mit `node scripts/lizenzhinweise.mjs` erzeugt und mit `node scripts/lizenzhinweise.mjs --check` auf Aktualität geprüft. Die öffentliche Quellcodeablage ist keine zusätzliche Lizenzfreigabe.
