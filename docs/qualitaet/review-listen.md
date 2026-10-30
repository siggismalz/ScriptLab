# Unabhängiger Review: RUN-01 Listen lesen

Reviewer: Fachagent Geschäftsdaten, ohne Änderungen an Generator oder Tests des Fachagenten Ausführung. Ausgangsbasis `fa6b208`; geprüft ist der integrierbare Diff in `src/kern/generator.ts`, `src/kern/python-helfer.ts` und die neue Datei `tests/qualitaet-ausfuehrung.test.ts`.

**Ergebnis: keine fachliche Regression im geprüften Umfang gefunden.** Der VBS-Helfer benötigt für den reinen Elementzugriff keine zusätzliche Kopie des ganzen Arrays. Er prüft weiterhin Arraytyp und denselben 1-basierten gültigen Ganzzahlbereich. Python prüft weiterhin den Listentyp und den Index; `sl_kopie` wird auf das ausgewählte Ergebnis angewendet. Eine zurückgegebene verschachtelte Liste bleibt daher unabhängig. Die tatsächliche Laufzeit hängt bei solchen Ergebnissen weiterhin von der Größe des ausgewählten Teilbaums ab.

## Eigene Gegenprobe

Windows x64, Node.js 24.19.0, gebündeltes CPython 3.15.2 und Windows `System32/cscript.exe`. Ausgeführt über `node --input-type=module -` mit einem eigenen Prüfprogramm auf stdin; es bündelt die tatsächlichen Exporte `neuesProjekt` und `skriptErzeugen` mit dem vorhandenen esbuild. Alle Dateien entstehen in einem eigenen `ScriptLab-Listen-Review-*`-Tempordner, der nach Prüfung seiner Lage entfernt wird.

Die Gegenprobe hat für **beide Sprachen vollständige Schema-3-Projekte und eigenständige Scripts** erzeugt, statt ausschließlich den geänderten Helfer direkt aufzurufen:

1. Leere Liste `a` anlegen und `Original ä` anhängen.
2. Leere Liste `b` anlegen und die Liste `a` als verschachtelten Eintrag anhängen.
3. Erstes Element von `b` nach `m` lesen und `Neu` an `m` anhängen.
4. Verschachtelten Ursprung `b`, Einträge von `m` und den nachträglich an `a` angehängten Wert `Ende` ausgeben.
5. `b` erneut lesen; Änderungen an `a` und `m` dürfen den gespeicherten ursprünglichen Unterbaum nicht verändern.

Native Aufrufe: Python `-I -B -u -X utf8 <review.py>`, VBS `//nologo //U <review.vbs>`. Keine ScriptLab-App, keine realen Geschäftsdaten, kein Netzwerk oder Shellzugriff im generierten Workflow.

**Bestanden: 2/2 vollständige Exportgegenproben.** Beide Prozesse endeten mit Exitcode 0, leerem stderr und exakt diesen fünf Zeilen:

```text
Original ä
Original ä
Neu
Ende
Original ä
```

Damit sind Erzeugung, Sprachwahl, Variablenzuordnung, Listeneinfügung, verschachteltes Lesen, Wertunabhängigkeit, Umlaute und eigenständige native Ausführung in diesem konkreten Ablauf geprüft. Die Regressionen des Ausführungsagenten prüfen zusätzlich leere Listen, ungültige Positionen und falsche Typen; sie ersetzen keine Prüfung sämtlicher Generatoroperationen.

## Anmerkung und Grenze

An den Autor gemeldet: Python-Proben im neuen Test bitte mit `-B` starten. `-I` ignoriert `PYTHONDONTWRITEBYTECODE`; ohne `-B` können Standardbibliotheksimporte zusätzliche Cachedateien im manifestgeprüften Testbündel anlegen. Das ist eine Testumgebungsfrage, keine nötige Änderung am Workflowgenerator.

Die Vorher-/Nachher-Leistungsmessung gehört zum Bericht des Ausführungsagenten. In diesem Review wurde keine neue Beschleunigungszahl erhoben. Keine Aussage zur unbegrenzten Listengröße, zu allen Verschachtelungen oder zu VBS-Umgebungen ohne Windows-VBScript-Komponente.
