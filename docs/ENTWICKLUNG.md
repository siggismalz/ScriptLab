# ScriptLab entwickeln

Diese Seite beschreibt Build, technische Ablage und Prüfungen. Die [README](../README.md) stellt ScriptLab aus Nutzersicht vor; die [aktuelle Bedienung](NEUE-BEDIENUNG.md) erklärt den Arbeitsweg in der Anwendung.

## Lokal starten

Voraussetzungen sind Windows 11 x64, Node.js 24 LTS und npm. Der Windows-Build verwendet außerdem den vorhandenen C#-Compiler des Windows-.NET-Frameworks 4. `scripts/laufzeit-host-bauen.mjs` nutzt dafür feste Windows-Pfade und installiert keine Komponenten. Der fertige Installer enthält den kompilierten Testhost; Endnutzer benötigen weder Node.js noch einen Compiler.

Im Projektordner:

```powershell
npm ci
npm run check
npm test
npm run build
npm run test:e2e
npm run dev
```

`npm run dev` baut die Anwendung und öffnet das lokale Electron-Fenster. Dabei wird kein Webserver gestartet. Nach Codeänderungen erneut bauen und starten.

Die Anwendung besteht aus Electron, React und Blockly. Hauptprozess und isolierter Renderer kommunizieren über geprüfte IPC-Schnittstellen. Die [Architektur](ARCHITEKTUR.md) erläutert Aufbau, Datenmodell und Generatoren; [Versionen und Quellen](VERSIONEN.md) dokumentiert die Abhängigkeiten. Anwendungscode, Kommentare und Hilfen sind deutsch.

## Mitgeliefertes Python

Der Build bereitet ein festes Windows-x64-Python-Bündel vor: CPython 3.15.2 einschließlich Tcl/Tk und elf festgelegter Business-Pakete. Bei der ersten Vorbereitung werden die Originalquellen und hashgepinnten Wheels benötigt. Ein unverändertes vorhandenes Bündel wird anhand seines Manifests lokal geprüft und wiederverwendet.

```powershell
node scripts/python-buendel.mjs --vorbereiten
node scripts/python-buendel.mjs --pruefen
```

Das Build-Bündel liegt unter `artifacts/python-buendel/python`, in der Anwendung unter `resources/python`. Herkunft, Prüfsummen und Beilagen dokumentiert [Python-Herkunft](../laufzeit/python-herkunft.md). Endnutzer wählen keinen Interpreter und installieren keine Pakete. Ein Workflowstart lädt nichts nach. **Einstellungen → Laufzeit** zeigt den tatsächlichen Komponentenstatus und eine erneute Bestandsprüfung.

VBS verwendet die verfügbare Windows-VBScript-Komponente. ScriptLab aktiviert keine Windows-Features und ändert keine Unternehmensrichtlinien. Bearbeiten, Speichern und Exportieren bleiben auch ohne VBS-Laufzeit möglich.

## Bauen und paketieren

`npm run package` baut einen NSIS-Installer für den aktuellen Nutzer. `npm run package:dir` erstellt ein entpacktes Programmpaket. Beide verwenden electron-builder 26 und veröffentlichen nichts. Der Installer heißt `ScriptLab-<Paketversion>-Setup-x64.exe`; maßgeblich ist `package.json`.

```powershell
npm run package
npm run verify:package
```

Die Paketprüfung vergleicht Installergröße, SHA-512, Blockmap sowie das entpackte Paket mit `dist`, Beispielen und Beilagen. Das vollständige Offline-Python-Bündel wird über Bestand, Größen, Prüfsummen, Business-Lockdatei und Bytevergleich geprüft. Sie startet keinen Interpreter und ersetzt keine Installation oder produktive Updateprüfung. Der konkrete Bericht steht unter `release/pruefung.json`.

Falls ein älteres Build-Verzeichnis gesperrt ist, einen eigenen Ausgabeordner verwenden und denselben Ordner an die Prüfung übergeben:

```powershell
npm run build
npx electron-builder --win nsis --x64 --publish never --config.directories.output=artifacts/mein-build
npm run verify:package -- artifacts/mein-build
```

Ein unsignierter Testinstaller ist kein produktives Release. Gewöhnliche Commits veröffentlichen kein Release. [Releases und Updates](RELEASES.md) beschreibt Signaturinfrastruktur, GitHub Actions und die noch praktisch nachzuweisende Updatekette. Automatische Updateprüfung ist standardmäßig aus; Download und Installation benötigen eine ausdrückliche Nutzeraktion. Ohne verifizierbaren Herausgeber bleibt der Updater gesperrt.

## Projektformat und lokale Ablage

`.scriptlab` enthält den bearbeitbaren JSON-Projektzustand in Schema 3: Sprache, stabile Variablen-IDs, Ansicht, Parameterdefinitionen und nicht geheime Parametersätze. Schema 1 wird als VBS übernommen; Schema 2 behält seine Sprache und erhält leere Business-Angaben. Ein Projekt wechselt seine Sprache nicht nachträglich. `.py`, `.vbs` und Business-ZIPs sind keine rückimportierbaren Projektformate.

Einstellungen, `projektbibliothek.json`, Entwürfe, Workflows, Arbeitsdateien und Laufhistorie liegen außerhalb der Installation im Electron-Nutzerverzeichnis, gewöhnlich `%APPDATA%\ScriptLab`:

| Ablage                       | Inhalt                                                |
| ---------------------------- | ----------------------------------------------------- |
| `Workflows\<UUID>.scriptlab` | Gespeicherter Workflow                                |
| `Arbeitsdateien\<UUID>\`     | Relative Quellen, Ausgaben und kopierte Beispieldaten |
| `entwuerfe\`                 | Gesonderte lokale Zwischenstände                      |
| `laufhistorie\`              | Abgeschlossene Läufe und ihre Details                 |

**Speichern** sichert intern ohne Zielauswahl; externe Projektdateien werden dabei nicht überschrieben. **Kopie anlegen** erzeugt eine unabhängige interne Kennung. **Exportieren** wählt ein externes Ziel und verändert den Speicherzustand nicht. Unvollständige Entwürfe dürfen gespeichert und als Projektdatei exportiert werden; Validierungsfehler verhindern Script- und Paketexporte.

Eine automatische Entwurfssicherung ersetzt das Speichern der Projektdatei nicht. Vor einem möglichen Verlust bleiben Speichern, Entwurf behalten, Verwerfen und Abbrechen getrennte Entscheidungen. Der Konfliktschutz für von außen veränderte Dateien bleibt erhalten.

Relative Pfade verwenden innerhalb von ScriptLab den Workflow-Arbeitsordner, beim eigenständigen Script den Speicherort des Scripts. Externe Quellen bleiben lesbar. Schreibziele innerhalb der App müssen im ScriptLab-Nutzerverzeichnis liegen; unzulässige bestehende Ziele werden abgewiesen und nicht umgeschrieben. Das ist keine allgemeine Prozess-Sandbox.

Die Historie bewahrt höchstens 200 abgeschlossene Läufe und insgesamt 64 MiB Detaildaten auf. Sie startet keine Prozesse neu und sichert keine zusätzliche Kopie jeder Ergebnisdatei. [Automatische Ablage und Laufhistorie](WEITERENTWICKLUNG.md) enthält die genauen Regeln.

## Ausführen und exportieren

Öffnen, Wiederherstellen, Bearbeiten, Codevorschau, Speichern, Export und Signaturprüfung starten keine Verarbeitung. Die begrenzte Datenvorschau, der Business-Prüflauf ohne fachliche Zieländerungen und die echte Ausführung bleiben unterschiedliche, bewusst gestartete Modi. Der normale Grundbaustein-Test führt den vollständigen aktuellen Ablauf aus und kann echte Dateiänderungen oder Dialoge auslösen. Er ist keine Sandbox. **Stoppen** macht bereits erfolgte Änderungen nicht rückgängig.

Die Schrittvorschau unterstützt verbundene lesende Business-Tabellenschritte im Hauptablauf und zeigt höchstens 200 Zeilen beziehungsweise 256 KiB. Filter und Gruppierungen können trotzdem die gesamte Quelle lesen. [Business-Bedienung](BUSINESS-BEDIENUNG.md), [Tabellenverarbeitung](BUSINESS-DATEN.md) und [Dokumente und Dateisicherheit](BUSINESS-DOKUMENTE.md) erläutern Operationen und konkrete Grenzen. Es gibt keine Zeitplanung oder automatische Workflowausführung.

Python-Quelltext verwendet UTF-8 ohne BOM und CRLF, VBS UTF-16LE mit BOM und CRLF. Textdateien des Workflows haben ihre eigene gewählte Kodierung. Exportierte gewöhnliche Python-Scripts benötigen eine externe passende Python-Umgebung; Dialogbausteine benötigen dort zusätzlich Tcl/Tk. Beispiel mit eigenen tatsächlichen Pfaden:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Begruessung.py"
```

Ein Business-ZIP enthält Script, Business-Module, feste Lockdatei, Parametervorlage, Anleitung und Vera-Schrift mit Lizenz, aber keinen Interpreter. Eigene Vorlagen, Bilder und Schriften werden nur nach ausdrücklicher Auswahl beigefügt. Geschäftsdaten, Journale und Protokolle werden nicht automatisch übernommen. Die Umgebung beim Empfänger muss zum dokumentierten Paketsatz passen; der Scriptstart installiert nichts.

VBS-Exporte benötigen die Windows-VBScript-Komponente, Windows Script Host und gegebenenfalls zugelassene Windows-Komponenten. VBScript ist abgekündigt. [Optionale VBS-Signaturen](SIGNATUR.md) verwenden ein ausgewähltes gültiges Zertifikat aus dem Windows-Zertifikatspeicher; Python-Exporte haben kein implementiertes Signaturverfahren. Anwendungs- und Nutzerzertifikate sind getrennt. Eine Signatur garantiert weder einen ungefährlichen Ablauf noch die Ausführung ohne Windows- oder Unternehmenswarnungen.

## Prüfungen und Gestaltungsnachweise

`node scripts/produkt-ansichten.mjs` nimmt den aktuellen Arbeitsweg in einem eigenen temporären Profil auf und schreibt Bilder sowie den tatsächlichen Funktionsnachweis nach `docs/produkt`. Das GIF benötigt zusätzlich ImageMagick; bei Bedarf dessen Programmdatei über `SCRIPTLAB_IMAGEMAGICK` angeben. Diese Werkzeuge gehören ausschließlich zur Aufnahme, nicht zur ausgelieferten App.

Prüfberichte gelten für ihren tatsächlich genannten Quell- und Paketstand. Modulprüfungen, echte Laufzeitprüfungen, UI-Aufnahmen, Installerprüfung und produktive Updatekette sind getrennte Nachweise.

- [Prüfplan](PRUEFPLAN.md), [Business-Abnahmestand](BUSINESS-ABNAHME.md) und [historische Abnahme](ABNAHME.md).
- [Designsystem](gestaltung/DESIGNSYSTEM.md), [aktuelle Regeln- und Datenbedienung](REGELN-UND-DATEN.md) und [zugehörige Windows-Ansichten](regeln-daten/ANSICHTEN.html). Die [vorherige Produktverbesserung](PRODUKT-VERBESSERUNG.md) und [UI-Straffung](UEBERSICHTLICHKEIT.md) bewahren ihre früheren Nachweise.
- [Datenumfang und Lastmessungen](BUSINESS-LEISTUNG-DATEN.md), [Dokumentbeispiele](BUSINESS-BEISPIELE-PRUEFUNG.md) und [Testlaufleitfaden](TESTLAUF.md).

## Nutzung und Lizenzen

Die [ScriptLab-Nutzungslizenz](../LICENSE.txt) erlaubt private, nichtkommerzielle Nutzung kostenlos. Kommerzieller Einsatz erfordert eine separat erworbene kostenpflichtige Lizenz von Leon Stolz; Preis, Umfang und Laufzeit werden gesondert vereinbart. Das Paket verweist mit `SEE LICENSE IN LICENSE.txt` auf diesen eigenen Lizenztext. Eine öffentliche Quellcodeablage ersetzt keine kommerzielle Vereinbarung. Rechtmäßig erzeugte Exporte bleiben nach den dortigen Bedingungen unabhängig ausführbar und weitergebbar; eigene Daten und fachliche Ergebnisse bleiben eigene Inhalte.

Fremdbibliotheken behalten ihre jeweiligen Lizenzen. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) inventarisiert Produktionsabhängigkeiten und Originalhinweise; der fehlende vollständige Originaltext von `lazy-val@1.0.5` ist ausdrücklich vermerkt. `LICENSE.electron.txt` und `LICENSES.chromium.html` liegen der Windows-Distribution bei.

Der Python-Paketsatz hat eigene [Business-Lizenzhinweise](../laufzeit/business-notices.md). Die mitgelieferte Vera-Schrift wird mit Original-Lizenz ausgeliefert; Windows-Schriften werden nicht weiterverteilt.

Lizenzhinweise offline erzeugen beziehungsweise auf Aktualität prüfen:

```powershell
node scripts/lizenzhinweise.mjs
node scripts/lizenzhinweise.mjs --check
```
