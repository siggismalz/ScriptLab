# Unabhängige Prüfung: SCALE-01

## Auftrag und Schreibbereiche

Der Bedienungsagent prüft die Änderungen des Hauptagenten unabhängig: Projektprüfung, Projekt-/Entwurfsdateien, die feste Brücke und das Laden vorhandener Blockly-Workflows. Er darf ausschließlich `tests/desktop/qualitaet-projekt.spec.ts` und diesen Reviewbericht ändern. Kern, IPC, zentrale Zustände und Git-Integration bleiben beim Hauptagenten. Die frühere zusätzliche Kernprüfung mit 6 bestandenen Fällen gehört zum damaligen Teilstand; sie ersetzt die finale integrierte Abnahme nicht.

## Geprüfte Entscheidungen

- Fortsetzungen über `next.block` erhöhen die fachliche Verschachtelung nicht. `inputs.block` und `inputs.shadow` tun dies weiterhin; die Schranke für echte Verschachtelung bleibt 150. Unbekannte Typen, doppelte IDs und Zyklen bleiben Fehler.
- Kompaktes JSON verhindert quadratisch wachsende Einrückungen. Felder, Schema 3, Sprache und IDs bleiben erhalten. Das unveränderte UTF-8-Dateibudget gilt vor dem atomaren Schreiben.
- Große Objektbäume scheiterten tatsächlich an der contextBridge und anschließend am Main-/Preload-Klonen. Texttransport über dieselben festen Methoden und Kanäle erhält die fachliche Fassade. Absenderprüfung bleibt vor der Datenverarbeitung; Main begrenzt UTF-8-Bytes vor `JSON.parse`. Es entsteht keine freie IPC-/Shell-Schnittstelle. Optionale letzte `undefined`-Argumente werden ausgelassen statt zu `null` umgewandelt.
- Auch natives `JSON.stringify` erreichte im Electron-Prozess bei tiefen 2000er Daten seine Stackgrenze. Der iterative Helper wurde hinsichtlich Reihenfolge, primitiven Werten, undefinierten Objekt-/Arraywerten, geteilten Referenzen und Zyklusschutz gelesen. Sein Vertrag sind reine JSON-Daten, kein allgemeiner `Date`-/`toJSON`-Serializer.
- Das vorbereitende Trennen bestehender `nextConnection`-Ketten erfolgt nur vor vollständigem Laden/Verwerfen des Workspaces, unter balanciertem `Events.disable()`/`finally enable()`. Es ist kein Bearbeitungsschritt und erzeugt keine Rückgängig-Einträge. Eine vollständige Prüfung beliebiger Kombinationen ist damit nicht belegt.

## Nachgewiesene Grenze und endgültige Abgrenzung

**2000 Blöcke wurden nicht als vollständig bedienbar abgenommen.** Lineare und verzweigte 2000er Workflows ließen sich zunächst darstellen, ändern und speichern; erneutes Laden aus einem leeren Zwischenworkflow blockierte jedoch den Renderer. Die tatsächlich gespeicherte verzweigte Datei wurde unabhängig vom aktuellen Kernvalidator akzeptiert. Die Störung war daher keine nachgewiesene Dateiablehnung. Main blieb ansprechbar, Renderer-DOM-Abfragen nicht; Pageerror-/Consoleerror- und native Dialoglisten blieben leer. Ein gestarteter CDP-CPUprofiler reagierte beim Stoppen ebenfalls nicht: **kein CPUprofil/Hotstack vorhanden**.

Eine zwischenzeitlich untersuchte Grenze von 1000 Kanten je Darstellungspfad genügte für den verzweigten 2000er Fall nicht. Der Hauptagent entschied anschließend eine einheitliche technische Schutzgrenze von **1000 Gesamtblöcken**, zusätzlich zu den weiterhin 150 echten Verschachtelungsebenen und dem Dateibudget. 1001 lineare Blöcke bestanden an einem früheren Teilstand sogar den vollständigen Arbeitsweg; dies ist ein historischer Einzelfall und keine Freigabe oberhalb der endgültigen Grenze. Die runde 1000er Schranke bleibt konservativ und behauptet keine Fehlerfreiheit jeder erlaubten Kombination.

Zu große Projekte werden früh mit Erklärung abgewiesen. Aktiver Workflow und externe Originaldatei müssen erhalten bleiben. Dies ist ein Schutz vor dem beobachteten Rendererblocker; es macht die nicht erfüllte 2000er Verarbeitung nicht erfolgreich. Die ursprüngliche 2000er Einzelkette wurde nicht stillschweigend aus dem Nachweis entfernt: beide 2000er Formen erhalten ausdrückliche negative Regressionstests. Eine später belastbare größere Blockly-Darstellung bleibt begründete Anschlussarbeit.

## Finale Desktopabnahme

Windows x64, Electron 45.0.0, Node 24.19.0, 1280 × 720 logische Pixel, Prozessskalierung 100 %. Eigene temporäre Profile und synthetische Kommentarworkflows; keine Unternehmensdateien. Befehl:

`npx playwright test tests/desktop/qualitaet-projekt.spec.ts --reporter=list`

Der finale Lauf am zentral gebauten Stand mit 1000er Gesamtgrenze: **5 bestanden**, 0 fehlgeschlagen, 0 übersprungen. Der 1000er verzweigte Workflow besteht aus Start, Wenn/sonst, Wahrheitswert sowie 498/499 Kommentaren.

| Fall | Ergebnis | Gesamte Testdauer | Einzelne Ladebeobachtung |
|---|---|---:|---:|
| 601 linear | Vollständiger positiver Arbeitsweg bestanden | 13,4 s | 1047 ms |
| 1000 linear | Vollständiger positiver Arbeitsweg bestanden | 32,9 s | 1720 ms |
| 1000 verzweigt | Vollständiger positiver Arbeitsweg bestanden | 21,8 s | 1282 ms |
| 2000 linear | Frühe Abweisung mit Aktivstand-/Originalerhalt bestanden | 1,0 s | Nicht geladen |
| 2000 verzweigt | Frühe Abweisung mit Aktivstand-/Originalerhalt bestanden | 1,0 s | Nicht geladen |

Die fünf Gesamttestdauern stammen aus einem Lauf (Playwright-Ausgabe insgesamt ca. 1,2 Minuten). Einzelne frühere Diagnoseversuche wurden nicht als zusätzliche bestandene Tests addiert. Der Screenshot `artifacts/qualitaet-ux/projekt-1000-verzweigt.png` wurde visuell gelesen: echter Blockly-Ablauf mit Verzweigung, geänderter Kommentar, gespeicherter Stand und 87-%-Zoom; wichtige Workflowaktionen bleiben erreichbar. Formatprüfung und `git diff --check` der gelieferten Dateien bestanden ebenfalls.

Die positiven Fälle prüfen tatsächlich dargestellte Blockzahl, Textänderung mit Umlauten/Anführungszeichen, Rückgängig/Wiederholen, Zoom und Bereichswechsel, internes Speichern, echten leeren Zwischenworkflow, erneutes Laden, vollständige IDs einschließlich Verzweigungen und Sprache sowie Originalerhalt. Navigation und Export starten keine Verarbeitung. Codevorschau und Export werden verglichen; danach folgen bewusst gestarteter Editorlauf bis „beendet“/Exitcode 0 und eigenständiger Exportstart nach bestätigtem Ende des App-Prozesses. Letzterer verwendet die vorhandene Python-Programmdatei mit `-I -B -u -X utf8`; der Export benötigt dabei keine geöffnete App und kein Node.js.

Die negativen Fälle prüfen Erklärung, unveränderten aktiven Workflow, ungekürzte Originalbytes, erhaltenen Canvas und fehlende Ausführung. Screenshots und einzelne Ladebeobachtungen liegen unter `artifacts/qualitaet-ux/`. Diese Ladezeiten sind keine Vorher-/Nachher-Leistungsmessung. Die früheren fehlgeschlagenen Trace-Dateien und die synthetische gespeicherte 2000er Datei dort bleiben Diagnoseartefakte; sie sind keine erfolgreichen Abnahmen.

Keine Aussage über vollständige Barrierefreiheit, Screenreader, sämtliche Blockkombinationen, unbegrenzte Größe oder Unternehmensreife. Diese gezielte Abnahme ergänzt die integrierten Bestandsprüfungen des Hauptagenten.
