# ScriptLab

Visueller Baukasten für Windows-Automatisierungen. **Entwickelt von Leon Stolz.**

ScriptLab erstellt, prüft und speichert Workflows für Windows. **Python ist die Hauptsprache für Geschäftsabläufe**; die 48 gemeinsamen Grundbausteine bleiben auch für VBScript verfügbar. Zusätzlich bietet Python 47 Business-Bausteintypen für Tabellen, Dateien, Excel, Word und PDF. Die Sprache wird beim Erstellen gewählt und bleibt für das Projekt fest.

Ein bewusst gestarteter Test kann den vollständigen aktuellen Workflow auf diesem Computer ausführen und echte Dateien verändern. Er ist keine Sandbox. Für Business-Abläufe gibt es zusätzlich eine begrenzte **Datenvorschau** und einen **Prüflauf ohne fachliche Zieländerungen**. Öffnen, Wiederherstellen, Bearbeiten, Codevorschau, Speichern, Export und Signaturprüfung starten keine Verarbeitung. Exportierte Scripts kannst du eigenständig außerhalb der Anwendung ausführen.

Zielsystem der ersten Version: Windows 11 x64. Weitere Windows-Versionen sind derzeit nicht freigegeben. Python 3.15.2 mit Dialogfunktionen und dem festen Business-Paketsatz gehört zur Anwendung. Für Python-Workflows innerhalb von ScriptLab ist keine externe Einrichtung erforderlich. VBS-Ausführung benötigt weiterhin die verfügbare Windows-VBScript-Komponente; Bearbeiten, Speichern und Exportieren funktionieren auch ohne diese Komponente.

## Installation

Der Windows-Build erzeugt `release/ScriptLab-<Paketversion>-Setup-x64.exe`; maßgeblich ist die Version in `package.json`. Der NSIS-Installer installiert für den aktuellen Nutzer; Node.js ist auf dem Zielrechner nicht erforderlich. Ein unsignierter Testinstaller ist kein produktives Release. Ein produktives GitHub Release wird erst mit eingerichteter Entwickler-Signatur veröffentlicht. Der aktuelle Business-Prüfstand steht in [docs/BUSINESS-ABNAHME.md](docs/BUSINESS-ABNAHME.md); [docs/ABNAHME.md](docs/ABNAHME.md) bewahrt die historischen 0.1.0-Nachweise.

## Ein erster Workflow

1. ScriptLab öffnen und auf der Startseite **Neuer Workflow** wählen. Im Dialog **Neuer Workflow** Python oder VBScript (VBS) auswählen und **Workflow erstellen** bestätigen. Der Editor öffnet sich mit genau dem Baustein **Workflow starten**.
2. Links nach **Nachricht** suchen und beim Treffer **Nachricht anzeigen** auf Plus klicken.
3. Als Einfügestelle **Nach „Workflow starten“** wählen. Alternativ lässt sich der Baustein aus der Palette an den Start ziehen.
4. Den Nachrichtentext direkt am Baustein bearbeiten oder den Baustein auswählen und **Eigenschaften** öffnen (F4). Namen und Beschreibung des Projekts änderst du im **Workflow → Projektangaben**.
5. Mit **Speichern** den Workflow im ScriptLab-Nutzerverzeichnis sichern. Dafür ist keine Zielauswahl nötig. **Ansicht → Codevorschau öffnen** öffnet bei Bedarf unten den schreibgeschützten Python- oder VBS-Code.
6. Mit **Exportieren** das Scriptformat wählen und den Ausgabeort festlegen.

Bei der ersten Erstellung ist keine Sprache vorausgewählt. Später schlägt ScriptLab die zuletzt erfolgreich gewählte Sprache vor. **Abbrechen** erhält den bisherigen Workflow. Bestehende Projekte werden nicht auf eine andere Sprache umgestellt.

Danach gilt: **„Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“** „Speicherordner anzeigen“ markiert die Datei im Explorer und startet sie nicht. Es gibt keine Zeitplanung oder automatische Workflowausführung.

Die 48 gemeinsamen Bausteintypen decken Ein-/Ausgabe, Bedingungen, Schleifen, Dateien, Variablen, Listen, Texte, Zahlen sowie Datum und Zeit ab. [Bedienung und Beispiele](docs/BEDIENUNG.md) und [Bausteinreferenz](docs/BAUSTEINE.md) erklären Bedeutung, Pflichtwerte und Dateioperationen. Die sechs Grundbeispiele – drei je Sprache – und fünf zusätzliche Python-Business-Beispiele sind unter **Vorlagen → Beispielworkflows** erreichbar. Sie öffnen sich als bearbeitbare Kopien mit neuer Kennung und **(Kopie)** im Namen. Die Vorlagen in [beispiele](beispiele) bleiben unverändert.

## Ein erster Geschäftsablauf

1. Das Beispiel **Monatliche Auswertung** als Vorlage verwenden. ScriptLab legt einen unabhängigen Workflow an und kopiert seine synthetischen Testdateien in dessen ScriptLab-Arbeitsordner. Speichern, erneutes Öffnen und Entwurfwiederherstellung erhalten diesen Bezug. Für produktive Daten musst du die Quellen bewusst ändern.
2. Baustein auswählen und Quelle oder Einstellungen unter **Eigenschaften** prüfen. Die kurzen Zusammenfassungen im Ablauf zeigen wesentliche Angaben. Unter **Daten und Parameter → Datenvorschau** lässt sich das Ergebnis bis zu einem unterstützten Tabellenschritt bewusst laden; unfertige Nachfolger werden dafür nicht benötigt.
3. **Läufe → Vorbereitung** öffnen und Parametersatz sowie **Quellen und Ausgabeziele** prüfen. Business-Workflows beginnen mit **Prüflauf ohne Zieländerungen**. Erst **Ausführen · echte Dateiänderungen** verarbeitet die gewählten Daten und schreibt die fachlichen Ergebnisse.
4. Den bearbeitbaren Workflow speichern. **Exportieren → Business-Paket** erzeugt ein eigenständiges ZIP mit Python-Script, Business-Modulen, fester Lockdatei, Parametervorlage, Anleitung und Vera-Schrift samt Lizenz. Eigene Vorlagen, Bilder oder Schriften werden nur nach ausdrücklicher Auswahl beigefügt; Geschäftsdaten und Laufprotokolle werden nicht automatisch kopiert. Der Python-Interpreter der Anwendung gehört nicht zum Export.

Die fünf Beispiele behandeln **Monatsauswertung**, **Bestellungen mit Stammdaten**, **Word-Bestellvorschlag**, **PDF-Dokumenteingang** und **CSV-Dateistapel mit Wiederaufnahme**. [Neue Bedienung](docs/NEUE-BEDIENUNG.md) beschreibt den aktuellen Arbeitsweg mit mitgelieferter Laufzeit; ältere Einrichtungsnachweise bleiben ihrem damaligen Stand zugeordnet. [Tabellenverarbeitung](docs/BUSINESS-DATEN.md) sowie [Dokumente und Dateisicherheit](docs/BUSINESS-DOKUMENTE.md) beschreiben Fachfunktionen und Grenzen.

Die linke Palette verbindet Suche und Kategorien in einem verstellbaren Bereich. Eigenschaften und Codevorschau sind anfangs geschlossen. Neben Drag-and-drop gibt es anklickbare Einfügestellen zum Hinzufügen, Verbinden und Verschieben. Das Mausrad verschiebt die Arbeitsfläche; Strg+Mausrad zoomt dort. Die [Designnotiz](docs/DESIGNNOTIZ.md) enthält die tatsächlichen UI-Prüfungen, Bildschirmaufnahmen und offenen Punkte.

Die Startseite bietet **Meine gespeicherten Workflows**, **Entwürfe**, **Beispielworkflows** und **Dokumentation und Anleitungen**. Die Projektliste führt nur bekannte, selbst geöffnete oder gespeicherte Dateien; ScriptLab durchsucht keine Laufwerke. **Bereiche → Start** im Editor und anschließend **Weiterbearbeiten** erhalten den laufenden Arbeitsstand. Die [Startseitendokumentation](docs/STARTSEITE.md) hält ihre eigenen Bediennachweise fest.

## Oberfläche

Die Oberfläche gliedert Übersicht, Bearbeitung und Details. Die Office-Farbwelt beginnt bei einer neuen Installation hell; gespeicherte Darstellungswahlen bleiben erhalten. [Neue Bedienung](docs/NEUE-BEDIENUNG.md), [Designsystem](docs/gestaltung/DESIGNSYSTEM.md) und [aktuelle Windows-Ansichten](docs/office/ANSICHTEN.html) beschreiben den jetzigen Stand. [Umsetzung und Prüfgrenzen](docs/OFFICE-UMSETZUNG.md) trennen die aktuelle Sichtprüfung von älteren Entwicklungsnachweisen.

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

Der Build bereitet außerdem das feste Windows-x64-Python-Bündel vor. Beim ersten Vorbereiten werden die festgelegten Originalquellen und hashgepinnten Wheels benötigt. Ein unverändert vorhandenes Bündel wird anhand seines Manifests lokal geprüft und wiederverwendet; Endnutzer führen diese Entwicklungsschritte nicht aus. Gezielt lässt es sich mit `node scripts/python-buendel.mjs --vorbereiten` erzeugen und mit `--pruefen` ausschließlich lokal prüfen. Das fertige Bündel liegt unter `artifacts/python-buendel/python`; die Herkunft und Beilagen dokumentiert [laufzeit/python-herkunft.md](laufzeit/python-herkunft.md).

`npm run package` baut den Windows-Installer. `npm run package:dir` erzeugt ein entpacktes Programmpaket. Beide arbeiten mit `electron-builder` 26. Der [Releaseprozess](docs/RELEASES.md) beschreibt GitHub Actions, erforderliche Secrets und geprüfte Updateartefakte. Gewöhnliche Commits veröffentlichen kein Release.

Nach `npm run package` prüft `npm run verify:package` Installergröße, Update-Prüfsummen, Blockmap und die Übereinstimmung des entpackten Pakets mit `dist`, Beispielen und Beilagen. Hinzu kommt das vollständige Offline-Python-Bündel unter `resources/python`: Dateibestand, Manifest, Größen, Prüfsummen, Business-Lockdatei und Bytevergleich mit dem Build-Bündel. Es wird kein Interpreter gestartet. Der tatsächliche Bericht liegt unter `release/pruefung.json`. Diese lesende Prüfung ersetzt weder eine Installation noch den Vergleich zweier installierter Updateversionen; ein älterer Paketbericht belegt die neue Bündelprüfung nicht.

Falls ältere Builddateien gesperrt sind, kann ein eigener Ausgabeordner verwendet werden. Die Prüfung akzeptiert denselben Ordner als Argument und schreibt ihren Bericht dort; ihre Prüfungen bleiben gleich:

```powershell
npm run build
npx electron-builder --win nsis --x64 --publish never --config.directories.output=artifacts/startseiten-build-final
npm run verify:package -- artifacts/startseiten-build-final
```

## Einen Workflow testen

Öffne **Läufe → Vorbereitung** und prüfe Modus, Parameter, Quellen und Ausgabeziele. ScriptLab verwendet automatisch den Arbeitsordner dieses Workflows; der vollständige Pfad und die Exploreraktion stehen unter **ScriptLab-Arbeitsordner**. Bei Bedarf lässt sich das **Zeitlimit** ändern (Standard: 120 Sekunden). **Workflow ausführen** startet den vollständigen aktuellen Workflow, einschließlich Dateiaktionen und Dialogen. **Text ausgeben** schreibt unter **Protokoll**; **Nachricht anzeigen** öffnet einen Dialog.

Abgeschlossene Läufe werden lokal mit Modus, Status und verwendetem Workflowstand aufbewahrt. **Alle Läufe** öffnet die Liste dieses Workflows. **Anzeigen** lädt die Details des gewählten Laufs mit **Übersicht**, **Ergebnisse** und **Protokoll**. Das Protokoll lässt sich kopieren oder als Textdatei exportieren. Ein Ansichtswechsel oder das Öffnen eines alten Laufs startet keine Verarbeitung. Der [Testlaufleitfaden](docs/TESTLAUF.md) trennt diese aktuelle Bedienung vom historischen VBS-Prüfstand.

**Stoppen** beendet den Test, macht bereits erfolgte Änderungen aber nicht rückgängig. Relative Pfade verwenden den ScriptLab-Arbeitsordner. Ausgaben der Ausführung in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen; bestehende absolute Ziele außerhalb werden abgewiesen und nicht umgeschrieben. Externe Quellen bleiben lesbar. Das ist keine allgemeine Sandbox. Ein Test speichert weder das Projekt noch eine Exportdatei. Python-Läufe verwenden die mitgelieferte Laufzeit; VBS-Läufe die verfügbare Windows-VBScript-Laufzeit.

## Mitgelieferte Komponenten und eigenständige Exporte

Unter **Einstellungen → Laufzeit** zeigt ScriptLab den Status der mitgelieferten Python- und Business-Komponenten. **Erneut prüfen** überprüft diesen Bestand. Versionen und Programmdatei stehen unter technischen Angaben; eine Interpreterwahl und Online-/Offline-Paketinstallation gehören nicht mehr zur normalen Bedienung. Ein Workflowstart lädt oder installiert keine Pakete.

Ein exportiertes Python-Script kann in PowerShell mit dem vollständigen Pfad des eigenen Interpreters gestartet werden. Die folgenden Beispielpfade müssen durch die tatsächlich vorhandenen Pfade ersetzt werden:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Begruessung.py"
```

`-I` isoliert die Python-Modulsuche und ignoriert Python-Umgebungsvariablen, `-u` liefert ungepufferte Ausgabe und `-X utf8` aktiviert den UTF-8-Modus. Das ist keine Sicherheits-Sandbox. Ein Doppelklick auf `.py` ist von Windows-Dateizuordnungen abhängig und wird nicht vorausgesetzt. Der mitgelieferte Interpreter ist Teil der Anwendung, nicht Bestandteil der exportierten Datei. Weitere Hinweise stehen in der [offiziellen CPython-Dokumentation](https://docs.python.org/3.15/using/cmdline.html).

## Projekt und Export

**Speichern** legt den bearbeitbaren Workflow automatisch unter `Workflows\<Projektkennung>.scriptlab` im ScriptLab-Nutzerverzeichnis ab. Bei einer extern geöffneten Projektdatei wird der Stand dorthin übernommen; die externe Quelldatei bleibt unverändert. **Workflow → Kopie anlegen** sichert eine unabhängige interne Kopie mit neuer Kennung. Nur beim **Exportieren** wählst du einen Ausgabeort: für eine `.scriptlab`-Projektkopie, ein Script oder ein Business-Paket. Der Export verändert den Speicherzustand des aktiven Workflows nicht.

`.scriptlab` enthält den bearbeitbaren JSON-Projektzustand in Schema 3 einschließlich `skriptsprache`, stabiler Variablen-IDs, Ansicht, Parameterdefinitionen und nicht geheimer Test-/Echt-Parametersätze. Alte Projekte in Schema 1 werden als VBS übernommen; Schema 2 behält seine Sprache und erhält die leeren Business-Angaben. `.py`, `.vbs` und Business-ZIPs sind keine rückimportierbaren Projektformate. Unvollständige Entwürfe dürfen gespeichert und als Projektdatei exportiert werden; Fehler verhindern den Script- oder Paketexport.

Inhaltliche Änderungen werden nach kurzer Eingabepause zusätzlich als lokale Entwürfe gesichert. **Workflow → Als Entwurf sichern** stößt dies ausdrücklich an. Eine Entwurfssicherung lässt die Projektdatei unverändert: **Entwurf lokal gesichert** und **Ungespeicherte Änderungen** können gleichzeitig gelten. Vor einem möglichen Verlust stehen **Speichern**, **Als Entwurf behalten**, **Änderungen verwerfen** und **Abbrechen** zur Wahl. Wurde eine intern gespeicherte Datei von außen verändert oder ist sie nicht erreichbar, bleibt der Konfliktschutz bestehen; der Arbeitsstand kann als unabhängige interne Kopie gesichert werden.

Python-Quelltext verwendet UTF-8 ohne BOM und CRLF. VBS-Quelltext verwendet UTF-16LE mit BOM und CRLF; die bisherige VBS-Kodierung wurde vom Windows-VBScript-Parser ohne Ausführung bestätigt. Relative Dateipfade beziehen sich beim Export auf den Speicherort der jeweiligen Scriptdatei und in ScriptLab auf den Arbeitsordner des Workflows. Exportierte Scripts behalten ihre eigenständige Pfadsemantik. Textdateien eines Workflows haben eine gesondert ausgewählte Kodierung. Dateiaktionen prüfen Quellen und vorhandene Ziele erst während einer ausdrücklich gestarteten Ausführung; ihre Regeln stehen in der Bausteinhilfe.

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

Anwendungscode und Hilfen sind deutsch. Einstellungen, `projektbibliothek.json`, Entwürfe, gespeicherte Workflows unter `Workflows\<UUID>.scriptlab`, Arbeitsdateien unter `Arbeitsdateien\<UUID>` und die `laufhistorie` liegen außerhalb der Installation im Electron-Nutzerverzeichnis (gewöhnlich `%APPDATA%\ScriptLab`). Dort liegen auch lokale Business-Journale. Die Python-Laufzeit liegt dagegen bei den Programmressourcen. Die Laufhistorie ist auf höchstens 200 abgeschlossene Läufe und 64 MiB Detaildaten insgesamt begrenzt; sie nimmt keine Prozesse automatisch wieder auf. Die [Weiterentwicklung](docs/WEITERENTWICKLUNG.md) beschreibt Ablage und Grenzen. Die Bibliotheken und zehn lokalen Hilfethemen werden mitgeliefert. Bearbeiten, Projektspeicherung, Hilfe und unsignierter Export benötigen kein Netzwerk.

## Rechte und Drittanbieter

Die Projektlizenz hat Leon Stolz noch nicht festgelegt. `UNLICENSED` kennzeichnet diese ausstehende Freigabe und erteilt keine Nutzungslizenz. Fremdbibliotheken behalten ihre jeweiligen Lizenzen. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) inventarisiert die ausgelieferten Produktionsabhängigkeiten und enthält die vorhandenen Originalhinweise; der fehlende vollständige Originaltext des Pakets `lazy-val@1.0.5` ist ausdrücklich vermerkt. Die Originaldateien `LICENSE.electron.txt` und `LICENSES.chromium.html` liegen der Windows-Distribution bei.

Der feste mitgelieferte Python-Paketsatz besitzt eigene [Business-Lizenzhinweise](laufzeit/business-notices.md); [Python-Herkunft](laufzeit/python-herkunft.md) beschreibt das Anwendungsbündel. Die unverändert mitgelieferte Vera-Schrift liegt zusammen mit ihrer Original-Lizenz im Business-Paket; Windows-Schriften werden nicht weiterverteilt.

Die Lizenzhinweise werden offline mit `node scripts/lizenzhinweise.mjs` erzeugt und mit `node scripts/lizenzhinweise.mjs --check` auf Aktualität geprüft. Die öffentliche Quellcodeablage ist keine zusätzliche Lizenzfreigabe.
