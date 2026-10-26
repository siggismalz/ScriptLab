# Abnahmestand

Stand: 26.10.2026, ScriptLab 0.1.0. Dieser Nachweis trennt tatsächlich ausgeführte Prüfungen von noch offenen Einrichtungsschritten. Ein vorhandener Prüfplan, ein erfolgreicher Build oder ein simulierter Updater ersetzt keine vollständig geprüfte produktive Installation und Updatekette.

## Verifizierte Umgebung

Geprüft wurde auf Windows 11 Pro x64, Build 26200, mit Node.js 24.19.0, npm 11.17.0 und Git 2.46.1.windows.1. Die App verwendet Electron 45.0.0. Windows 11 x64 ist das erste unterstützte Produktziel; andere Windows-Versionen sind nicht freigegeben.

## Automatische und praktische Prüfungen

| Prüfung | Ergebnis | Nachweis und Grenze |
| --- | --- | --- |
| TypeScript und Produktionsbuild | Bestanden | `npm run check` und `npm run build` erfolgreich |
| Unit-, Datei-, Generator- und Windows-Tests | 88/88 bestanden | `npm test`; einschließlich Projektprüfung, Verschachtelung, Variablen, Zahleneingaben, Sonderzeichen, Beispielen, Windows-Parser, Signatur- und Updatezuständen |
| Electron-Desktopintegration | 10/10 bestanden | `npm run test:e2e` startet die echte Electron-Anwendung auf Windows. Dialogantworten werden für reproduzierbare Randfälle gesteuert; Projekt- und Exportdateien werden tatsächlich geschrieben und gelesen. Quelle: `tests/desktop/anwendung.spec.ts` |
| Renderer-Isolation | Praktisch bestätigt | In der Electron-Anwendung: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; kein `window.require` oder `window.process`; nur die freigegebene fachliche Preload-Schnittstelle |
| Export und Abbruch | Bestanden | Echter VBS-Export mit UTF-16LE-BOM, CRLF und Pfaden mit Umlauten/Leerzeichen; Abbruch erzeugt keine Erfolgsmeldung. Ein fehlgeschlagener Export erhält das bereits vorhandene Ziel |
| Speichern, Öffnen und Projektverlustschutz | Bestanden in den geprüften Fällen | Sofortiger Edit-/Zoom-/Speichervorgang und anschließendes Öffnen erhalten Namen und Zoom. Speichern unter mit Abbruch, ungespeicherter Projektwechsel und Schließen mit letzter Standabfrage/Abbrechen geprüft. Schemaversion 99 wird abgewiesen und nicht verändert |
| Blockly-Bedienung | Praktisch geprüft | Baustein aus der Palette ziehen, als lose Anweisung markieren, an die Nachricht anschließen, Kopieren/Einfügen sowie Rückgängig/Wiederholen erfolgreich. Rastereinrasten und Panning sowie Strg+Plus und Strg+0 sind ebenfalls geprüft |
| Kleine Fenster und Fokus | Praktisch geprüft | 1100 × 740 Pixel ohne horizontale Seitenüberbreite; Tastaturfokus bleibt im Einstellungsdialog, Escape schließt ihn. Dies ersetzt keine vollständige Prüfung aller Windows-Skalierungsstufen oder Screenreader |
| Native Sichtprüfung und echter Speicherdialog | Durchgeführt | Dunkler Editor, Bausteinfeldlesbarkeit und reine Textvorschau visuell geprüft; Feldlesbarkeit korrigiert. Über den nativen Exportdialog wurde `Mein Workflow.vbs` auf dem Desktop mit 2186 Bytes gespeichert. Die Datei wurde nicht gestartet |
| Sicherer Windows-VBScript-Parser | Bestanden | `scripts/vbs-syntax-pruefen.ps1 -Selbsttest -AlsJson`: gültiger Code akzeptiert, unvollständiges If erkannt, Zustand vor/nachher 5 (`INITIALIZED`), null Ausführungseintritte und keine Sentineldatei |
| Syntax aller angebotenen Bausteine | Bestanden | `tests/windows/generator-syntax.test.ts` prüft alle 46 Katalogtypen und jede Dropdownvariante mit dem echten Windows-VBScript-Parser. UTF-16LE-BOM, CRLF, Umlaute und Anführungszeichen sind zusätzlich geprüft. Es wird kein VBS-Inhalt ausgeführt |
| Datei-/Exportgrenze | Bestanden | `tests/windows/ausfuehrungsgrenze.test.ts`: Projekt mit Kopieren, Verschieben, Umbenennen, Schreiben, Ergänzen, Löschen und Ordneranlage speichern/laden/exportieren. Reale Sentineldateien bleiben bytegenau erhalten; der geplante Ordner entsteht nicht. Fehlerhafte Schreibvorgänge erhalten vorhandene Daten und hinterlassen keine Temporärdatei |
| Drei Beispielprojekte | Bestanden | Begrüßung, Datei-Backup und Dateinamenliste lassen sich als Projekte prüfen, in Blockly laden und deterministisch exportieren. Alle drei VBS-Ausgaben bestehen die nicht ausführende Windows-Syntaxprüfung; Testpfade sind eindeutig relativ |
| VBS-Signatur ohne vorhandenen Nutzerschlüssel | Praktisch geprüft | VBS-SIP-Unterstützung direkt am Dateityp nachgewiesen; unsignierte VBS-Datei geprüft, Hash unverändert; Zertifikate auflisten, ungeeignete Auswahl, fehlendes Zertifikat und ungültige Zeitstempeladressen geprüft |
| Echte Signatur und absichtliche Veränderung | Kryptografischer Nachweis bestanden | Ein ausdrücklich autorisierter Entwicklertest verwendet nur einen ephemeren RSA-CNG-Schlüssel und ein kurzlebiges Zertifikat im Arbeitsspeicher. Echte VBS-SHA-256-Signatur, erwartetes Zertifikat und `SignedCms.CheckSignature(true)` bestätigt. Eine veränderte Kopie liefert echtes Windows-`HashMismatch`, vom produktiven Helper als ungültig eingeordnet. Windows PowerShell 5.1 und PowerShell 7.6.8 geprüft; Details in [SIGNATUR.md](SIGNATUR.md) |
| Schutz der Zertifikatsbestände | Praktisch bestätigt | `My` und `Root` in `CurrentUser` und `LocalMachine` sind vor/nach dem ephemeren Test identisch. Kein Zertifikatsimport, Vertrauenseintrag oder Schlüsseldateiexport; kein privater Testschlüssel wurde persistiert |
| Updatezustände und Sicherheitsvorgaben | Automatisiert und teilweise in der App geprüft | Fehlende Einrichtung und Entwicklerbetrieb verständlich angezeigt; Zertifikatsauflistung und Updateoberfläche bedienbar. Unit-Tests prüfen Fehler, Integritäts-/Signaturhinweise und getrennten Installationsaufruf. `autoDownload` und `autoInstallOnAppQuit` sind ausgeschaltet; eine echte produktive Updateinstallation wurde nicht durchgeführt |
| NSIS-Installer | Erster echter Windows-Build erfolgreich | `release/ScriptLab-0.1.0-Setup-x64.exe` mit 125007409 Bytes sowie Blockmap und `latest.yml` wurden erzeugt. Der abschließende Neubau mit sämtlichen letzten Änderungen steht noch aus. Dieser lokale Installer ist kein signiertes veröffentlichtes Release |
| Lizenzinventar | Reproduzierbar erstellt und abgeglichen | 60 Produktionspakete in 62 installierten Instanzen; vollständiger Abgleich mit `npm ls --omit=dev --all`. Alle vorhandenen Lizenztexte aufgenommen, saxes-Text aus dem offiziellen Versionscommit ergänzt. Electron-/Chromium-Lizenzdateien im gebauten Windows-Paket sind byteidentisch zum Original. Volltextlücke bei `lazy-val` bleibt ausdrücklich offen |
| GitHub und Entwicklungsschritte | Vorhanden | Öffentliches Repository [siggismalz/ScriptLab](https://github.com/siggismalz/ScriptLab); fachliche Schritte mit deutschen Commits angelegt und gepusht. Es gibt bislang keinen Versionstag und kein veröffentlichtes Release |

Die Syntaxprüfung bestätigt gültige VBS-Syntax und die Grenze zum Nichtausführen. Sie beweist keine ausgeführte Laufzeitwirkung der Dateiaktionen. Auch Signaturprüfung und kryptografischer Manipulationstest starteten den signierten Inhalt nicht. Die Anwendung bietet keinen Workflow-Start, Testlauf oder allgemeinen Prozessaufruf an.

## Produktabnahme

| Nr. | Anforderung | Tatsächlicher Stand |
| --- | --- | --- |
| 1 | Workflow mit Ein-/Ausgabe, Bedingung, Schleife und Dateizugriff erstellen | Kombinierten Ablauf mit Texteingabe, Vergleich, Bedingung, Schleife und Dateiprotokoll in der echten App geladen und exportiert; geplante Zieldatei bleibt aus. Bausteine lassen sich separat per Drag-and-drop erstellen und verbinden. Ein unabhängiger Usabilitytest mit der Zielgruppe bleibt offen |
| 2 | Drag-and-drop, Verbindungen, Raster, Verschieben, Zoom und Rückgängig | Drag-and-drop, Verbinden, Rastereinrasten, Panning, Zoom, Strg+Plus/0, Kopieren/Einfügen und Rückgängig/Wiederholen in der echten App geprüft. Eine vollständige manuelle Tastatur- und Skalierungsmatrix bleibt offen |
| 3 | Vollständiger Projekt-Roundtrip einschließlich Ansicht | Datei-/Modell-Roundtrip und Desktop-Speichern/Öffnen einschließlich Zoom bestanden; der sofortige letzte Editorstand und Abbruchfälle sind geprüft |
| 4 | Bedeutung aller angebotenen Blöcke im VBS-Export | Generatorfälle und Verschachtelung automatisiert geprüft; alle 46 Typen und Auswahlvarianten durch den echten Windows-Parser akzeptiert. Keine Ausführung der erzeugten Workflows behauptet |
| 5 | Vorschau und Export ohne Workflowausführung | Kern-/Datei-Sentineltests, Quellcodeprüfung, Desktopintegration und native Sichtprüfung durchgeführt. Vorschau zeigt Text; Export schreibt nur die Exportdatei |
| 6 | Verständliche Meldungen am konkreten Block | Lose aktive Anweisung in der echten Oberfläche markiert; zugeordnete Validierungsfälle und Fehlermeldungen automatisiert geprüft |
| 7 | Unsignierter Export ohne Zertifikat | In der echten Anwendung und über den nativen Speicherdialog erfolgreich geprüft |
| 8 | Echtes Signaturprüfergebnis bei konfiguriertem Zertifikat | Echte VBS-Signatur und Manipulationserkennung mit ephemerem Testschlüssel nachgewiesen. Vollständiger App-Export mit bereitgestelltem vertrauenswürdigem Nutzerzertifikat, gültiger Windows-Vertrauenskette und echtem Zeitstempel bleibt offen |
| 9 | Windows-Installer bauen | Erster NSIS-Build erfolgreich; abschließender Neubau steht noch aus. Installation und Deinstallation sind nicht praktisch geprüft |
| 10 | Releaseartefakte und vollständiger produktiver Updatefluss | Pipeline, Updatelogik und Oberfläche implementiert; lokale Installer-/Updaterartefakte erzeugt. Entwicklersignatur, Veröffentlichung und echte Updateprüfung zwischen zwei installierbaren Versionen bleiben offen |
| 11 | Entwicklercredits und deutsche Dokumentation | Credits in Oberfläche, Über-Dialog, Paketmetadaten und README vorhanden; deutsche Bedienungs-, Entwicklungs-, Signatur-, Release- und Prüfdokumentation erstellt |
| 12 | Nachvollziehbare deutsche Entwicklungsschritte in Git | Mehrere geprüfte fachliche Schritte mit deutschen Committexten vorhanden und zum richtigen öffentlichen Repository gepusht |

## Konkret offene Schritte

1. Abschließenden Installer nach allen letzten Änderungen neu bauen und dessen Artefakte erneut prüfen. Installation und Deinstallation in einem geeigneten Windows-Testkontext durchführen; Erhalt von Projekten und Einstellungen nachweisen.
2. Ein ausdrücklich bereitgestelltes, geeignetes und vertrauenswürdiges Nutzerzertifikat im App-Export wählen. Privatschlüsselzugriff, tatsächlichen Fingerabdruck, Windows-Ergebnis „Signatur gültig“ und einen passenden echten Authenticode-Zeitstempel prüfen. Das ephemere Testzertifikat wurde absichtlich nicht als vertrauenswürdig installiert; sein Windows-Ergebnis `UnknownError` wird korrekt als „Prüfung nicht möglich“ behandelt.
3. Entwickler-Signaturinfrastruktur und erforderliche CI-Secrets sowie `WINDOWS_PUBLISHER_NAME` einrichten. Erst anschließend bewusst einen passenden Versionstag setzen und ein geprüftes signiertes Release veröffentlichen. Eine vollständige Updatekette mit zwei installierbaren Versionen einschließlich Neustartbestätigung und Erhalt von Projekten/Einstellungen nachweisen.
4. Den fehlenden vollständigen upstream Lizenztext von `lazy-val@1.0.5` klären und die Projektlizenz durch den Nutzer festlegen. Die Metadatenangabe `UNLICENSED` ist keine erfundene Open-Source-Lizenz. Details stehen in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
5. Die verbliebenen manuellen Bedienfälle aus [PRUEFPLAN.md](PRUEFPLAN.md) nachholen: unabhängiger Usabilitytest eines Alltagsworkflows, vollständige Tastaturbedienung und die noch nicht geprüfte Matrix der Windows-Anzeigeskalierung.

Es wurden keine Nutzerworkflows ausgeführt, Windows-Features aktiviert oder Sicherheitsrichtlinien geändert. Die beschriebenen lokalen Builds und Prüfungen sind keine Veröffentlichung und belegen keine vollständig geprüfte produktive Updatekette.
