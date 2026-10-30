# Fachauftrag QA-03: bestehende Desktoptests für Python, VBS und Läufe

## Initialanweisung und Zuständigkeit

**Rolle und Auftrag:** Fachagent Generatoren/Ausführung übernimmt die Migration bestehender Desktopregressionen auf die tatsächlich vorhandene ScriptLab-Oberfläche und interne Ablage. Veraltete Selektoren und Dialogannahmen durch echte aktuelle Bedienwege ersetzen; fachliche Erwartungen, Ausführungsgrenzen, Originalschutz, Sprachzuordnung und tatsächliches Prozessende erhalten. Produktfehler melden, Tests nicht darauf zurechtbiegen.

**Projektkontext:** Ausgangscommit `3bf7da6e899398f501a6f85f1c57a1e506148859`, Windows 11 x64, Node.js 24.19.0, Electron 45.0.0, Playwright 1.64.1, gebündeltes CPython 3.15.2. Aktueller Produktbuild vom Hauptagenten bereitgestellt. Andere Agenten migrieren disjunkte Desktopdateien mit eigenen temporären Profilen; aus diesen parallel betriebenen Proben werden keine Leistungsbehauptungen abgeleitet.

**Exklusiver Schreibbereich:** `tests/desktop/python-ui.spec.ts`, `python-lebenszyklus.spec.ts`, `testlauf.spec.ts`, `testlauf-ui.spec.ts` und dieser Bericht. Gemeinsame Helfer `ansichten.ts` und `sprache.ts`, Produktcode, Build und Git gehören dem Hauptagenten. Kein eigener Build, Commit, Push oder Indexzugriff.

**Geschützte Verträge:** Echte UI-Navigation über vorhandene Arbeits-/Laufbereiche; bewusst bestätigte Sprachwahl und Laufstarts; keine Ausführung durch Öffnen, Wiederherstellen, Speichern oder Export. Python und VBS teilen weiterhin Startsperre und Prozesslebenszyklus. Eigene synthetische Daten, unveränderte Quelldateien und bestätigte Lauf-PIDs. Keine schwächeren Zeitlimit-/Abbruchprüfungen und keine pauschal erhöhten Schwellen.

**Konkrete Schritte und Abnahme:** Betroffene Dateien und aktuelle Produktansichten lesen; Drift mit Pfad und Soll/Ist dokumentieren; lokal passende Testmigration; alle vier Dateien tatsächlich gemeinsam ausführen und Typprüfung abschließen. Nachweise, Dateien, tatsächliche Fallzahlen und Grenzen zurückmelden. Neue Bilder und Fehlerbelege ausschließlich unter `artifacts/qualitaet-desktop/`, historische Galerien erhalten.

## Bestätigter Befund QA-03 / P2: Prüfungen treffen frühere Bedienung

Der vollständige Desktoplauf scheiterte bereits in Einrichtungs-/Navigationshilfen. Reproduktion: die vier zugewiesenen Dateien gegen den aktuellen Build starten. `python-ui.editorBereit` wartete auf den entfernten Editorbutton „Neu“; weitere Wege verwendeten einen früheren Dialogtitel, alte Direktbuttons/Menüs, manuelle Basisordnerwahl oder „Speichern unter“. Der Produktcode bietet inzwischen „Workflow“- und „Bereiche“-Menüs, automatische Arbeitsordner sowie interne Speicherung und ausdrücklichen Dateiexport. Soll: dieselben fachlichen Aufgaben über aktuelle sichtbare Bedienelemente prüfen. Ist: Abbruch vor dem fachlichen Nachweis. Abnahme: alle 21 vorhandenen Fälle wieder bis zu ihren tatsächlichen Ergebnissen ausgeführt.

Weitere konkret belegte Testannahmen:

- Eigenschaften werden beim Einfügen bereits geöffnet. Ein bedingungsloser erneuter Klick schloss das Panel. Die Hilfen öffnen es jetzt nur bei Bedarf; Textbearbeitung und Ergebnisassertionen bleiben bestehen.
- „Gespeichert“ kann beim Import schon vor einem neuen internen Speichervorgang stehen. Die interne Übernahme wird deshalb anhand der tatsächlich neuen UUID-Datei aus dem Hauptprozess abgewartet, nicht bloß anhand eines schon sichtbaren Labels.
- Beim erneuten Öffnen wird die tatsächlich gespeicherte interne Workflowdatei verwendet. Ein weiterer Import einer externen identischen Kennung kann aus dem vorhandenen Kollisionsschutz eine eigenständige Identität erhalten; er ist kein verlässlicher Test für dieselbe interne Arbeitsordnerbindung.
- Der Hinweis auf einen älteren Laufstand gehört zur Laufübersicht. Der Test öffnet diese Ansicht, bevor er denselben vollständigen Hinweis erwartet.
- Python-Desktoptests verglichen den App-Interpreter bisher mit dem externen CI-Testinterpreter. Die App verwendet jetzt ihr festes Bündel. Geprüft werden dessen tatsächlicher Pfad und Status; eine fehlende gebündelte Laufzeit ist ein Fehler und wird nicht mehr als optionaler Testskip behandelt.

## Umgesetzte Testmigration

Aktuelle gemeinsame Navigations-/Sprachhilfen werden verwendet; „Speichern“ wird als interne Dateioperation geprüft. Der bisherige externe Kopierfall verwendet ausdrücklich **Exportieren → Projektdatei** und kontrolliert anschließend Exportinhalt, Originalbytes, internen Dateipfad und unveränderte Lauf-ID. Die sichtbare automatische Pfadbasis wird in der Vorbereitung gelesen, mit dem isolierten Profil verknüpft und dem tatsächlichen Lauf zugeordnet.

Python behält explizite Sprachwahl/Abbruch, Projekt-Rundlauf, bytegleichen Script-/Vorschauvergleich, Laufzeitstatus, VBS-Signaturabgrenzung, Entwurfsneustart und Originalschutz. VBS behält echte Datei-/Fehlerläufe, parallele Startabwehr, Ausgabeleeren/-kopieren/-scrollen, Zeitlimit, Wechsel-/Schließschutz und bestätigten Prozessabbruch. Die UI-Proben behalten 1280 × 720, 100/200 Prozent UI-Text und Tastaturwege. Kein Produktcode geändert.

## Tatsächlich ausgeführte Prüfungen und offene Grenze

Die Migration wurde schrittweise anhand tatsächlicher Fehlerberichte korrigiert. Ein Zwischenlauf aller vier Dateien erreichte zunächst 18 bestandene und drei fehlgeschlagene Fälle; die verbleibenden Fehler waren vorzeitiges Lesen des Speichervorgangs, falsche Wiederöffnungsannahme und der in der Vorbereitung nicht angezeigte Altlaufhinweis. Alle drei gezielten Nachprüfungen bestanden nach der oben beschriebenen Migration. Diese Zwischenzahlen werden nicht zu einer erfundenen Gesamtzahl addiert.

Finaler gemeinsamer Aufruf, ohne Anhebung der vorhandenen Fristen oder zusätzliche Retry-Regel:

```powershell
npm run check
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='artifacts/qualitaet-desktop/lauf-gesamt-final.json'
npx playwright test tests/desktop/python-ui.spec.ts tests/desktop/python-lebenszyklus.spec.ts tests/desktop/testlauf.spec.ts tests/desktop/testlauf-ui.spec.ts --reporter=line,json --output=artifacts/qualitaet-desktop/lauf-gesamt-final
```

| Tatsächlicher Lauf | Ergebnis | Einordnung |
| --- | --- | --- |
| Vier Dateien gemeinsam, `lauf-gesamt-final.json` | **20 bestanden, 1 fehlgeschlagen, 0 übersprungen**, 132,949 s | UI-Probe mit 100 Prozent Text: einfacher VBS-Ausgabelauf erreichte das unveränderte echte 10-s-Zeitlimit; erwartet war normales Ende. |
| Beide UI-Textvarianten isoliert, `lauf-ui-isoliert.json` | **2/2 bestanden**, 7,735 s | Derselbe unveränderte 100-/200-Prozent-Weg, keine erhöhte Frist. |
| Bereits gestartete gemeinsame Wiederholung, `lauf-gesamt-abschluss.json` | **20 bestanden, 1 fehlgeschlagen, 0 übersprungen** | Diesmal UI200-Prozent-Probe mit demselben 10-s-VBS-Zeitlimit; UI100-Prozent bestand. Auf Anweisung des Hauptagenten danach keine weiteren UI-Läufe gestartet. |
| `npm run check` | **Bestanden** | Nach den Teständerungen einschließlich des zusätzlichen Diagnoseanhangs. |
| `git diff --check` für die fünf zugewiesenen Dateien | **Bestanden** | Keine Produkt-/Build-/Git-Änderungen durch diesen Agenten. |

Die übrigen 19 unterschiedlichen Fälle bestanden in beiden abschließenden gemeinsamen Läufen; beide UI-Varianten bestanden im gesonderten isolierten Lauf. **Es wird kein gemeinsamer erfolgreicher 21/21-Lauf behauptet.** Die beiden beobachteten Timeoutfehler bleiben als offene native Laufzeitbeobachtung erhalten. Parallel betriebene Windows-Hosts können kurze Testfristen beeinflussen; eine konkrete Ursache wurde hier nicht nachgewiesen. Weder ein Lastproblem noch ein Produktdefekt wird ohne weitere Evidenz als bewiesen ausgegeben. Der Hauptagent plant die abschließende Gesamtregression erst nach allen Agentensitzungen mit einem Worker.

Die Assertions für normales Ende, Exitcode, Ausgabe und Geometrie bleiben unverändert streng. Für einen weiteren tatsächlichen Runtimefehler wurde zuletzt ein reiner JSON-Diagnoseanhang des gelesenen `TestZustand` ergänzt; diese Diagnostikerweiterung verändert keine Erwartung, Schwelle oder Ausführung. Sie ist für die noch ausstehende integrierte Gesamtregression vorgesehen.

Rohbelege und Screenshots liegen unter `artifacts/qualitaet-desktop/lauf-*`. Die Bezeichnungen „final“ beziehungsweise „abschluss“ im Dateinamen benennen den jeweiligen Teststand, keinen erfolgreichen Abnahmestatus. Historische Nachweisgalerien wurden nicht überschrieben.

## Übergabe

Alle vier zugewiesenen Dateien tatsächlich vollständig ausgeführt; Tests und Bericht integriert im gemeinsamen Arbeitsbaum, keine eigenen Commits/Pushes. Die eigenen isolierten Testsitzungen wurden beendet; UI für die zentrale Regression freigegeben. Keine neuen Produktfunktionen, keine Produktdateien und keine Abhängigkeiten verändert. Nächster Schritt: Hauptagent prüft den Diff, führt den gemeinsamen Desktoplauf ohne parallele Agentensitzungen aus und bewertet insbesondere die offen dokumentierte VBS-Timeoutbeobachtung, bevor er den Gesamtstand veröffentlicht.
