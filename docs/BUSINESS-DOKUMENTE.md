# Business-Dokumente und sichere Dateiausgaben

Die Python-Business-Laufzeit verarbeitet ausschließlich feste Operationen. Ein Plan hat die Form `{version:1,schritte:[{id,operation,konfiguration,eingaben}]}`. Schrittverweise `{referenz:'blockid'}` und Parameter `{parameter:'name'}` sind Daten, keine Python-Ausdrücke. `ausfuehren(plan,kontext)` und `schritt(kontext,id,operation,konfiguration,eingaben)` verwenden dieselben Handler.

## Fester Operationsvertrag

| Operation | Konfiguration | Eingaben / Ergebnis |
| --- | --- | --- |
| `dateien.stapel` | `ordner`, `muster` (ein Dateimuster, keine rekursive Suche) | Stabile, nach Name sortierte `dateien` mit stat/SHA-256; spätere Schritte prüfen diese erneut. |
| `dateien.archivieren` | `quelle`, `ziel`, `konflikt` | `ausgaben`: Liste wirklich publizierter/verifizierter Ergebnisse dieses Laufs. Quelle erst nach geprüfter Archivkopie entfernen. |
| `dokument.xlsx_vorlage` | `vorlage`, `ziel`, `blatt` optional, `zellen` als Adress-/Wertobjekt, `formeln` als ausdrücklich getrenntes Adress-/Formelobjekt, `konflikt` | Geprüfter XLSX-Ausgabebericht. Bestehende Formatierung/Formeln bleiben erhalten, keine Berechnung. |
| `dokument.docx_vorlage` | `vorlage`, `ziel`, `werte` als Platzhalterobjekt, `positionen` optional `{tabelle:0,zeile:1,praefix:'Position'}`, `konflikt` | Optional `tabelle` mit Positionsdaten; DOCX-Ausgabebericht. Tabellen-/Zeilenindizes beginnen hier bei 0. |
| `dokument.docx_serie` | `vorlage`, `zielordner`, `dateiname` z. B. `Brief-{nummer}.docx`, `werte` als gemeinsame Werte, `konflikt` | `tabelle`: ein Dokument je Zeile; `{dokumente:[Ausgabeberichte],anzahl}`. Spaltenplatzhalter im Dateinamen werden als sichere Dateinamensbestandteile behandelt. |
| `dokument.pdf_verbinden` | `quellen:[Pfad,...]` alternativ Eingang `dateien`, `ziel`, `konflikt` | Seiten in Quellenreihenfolge verbinden; PDF-Ausgabebericht. |
| `dokument.pdf_seiten` | `quelle`, `seiten` z. B. `1-3,5`, `ziel`, `konflikt` | Ausgewählte Seiten als eine PDF-Datei. Seitenzahlen beginnen bei 1. |
| `dokument.pdf_teilen` | `quelle`, `bereiche:['1-2','3']`, `zielordner`, `dateiname:'Teil-{nummer}.pdf'`, `konflikt` | Geprüfte Teil-PDFs als `dokumente`-Liste. |
| `dokument.pdf_text` | `quelle`, `seiten` optional | Begrenzte Seiten-/Textdaten mit `scan_verdacht`; keine OCR. Übergröße wird gemeldet, nie still abgeschnitten. |
| `dokument.pdf_bericht` | `ziel`, `titel`, `schrift` (lokale TTF-Datei), `spalten` optional, `konflikt` | `tabelle`: ReportLab-Tabelle mit wiederholtem Kopf und Seitenzahlen; PDF-Ausgabebericht. |

DOCX-Platzhalter lauten `{{Name}}`. Sie dürfen über mehrere Word-Runs verteilt sein; die Formatierung des ersten Platzhalterzeichens gilt für den Ersatz, umgebende Runs bleiben erhalten. Positionen verwenden `{{Position.Spaltenname}}` in einer als Muster gewählten Tabellenzeile. Fehlende und übrig gebliebene Platzhalter sind Fehler. Kopf-/Fußzeilen und verschachtelte Tabellen werden ebenfalls bearbeitet. Text in Formen, Textfeldern und eingebetteten Objekten gehört nicht zum unterstützten Vorlagenumfang.

## Modi und Dateisicherheit

- `vorschau` führt nur Quellenlesen und deklarierte reine Tabellenoperationen aus. Dokumentausgaben werden geplant, nicht erzeugt. Die letzte Tabellenvorschau bleibt auf 200 Zeilen/256 KiB begrenzt.
- `prueflauf` darf technische Tempdateien erzeugen und prüfen. Er schreibt, ersetzt, verschiebt und löscht keine fachlichen Ziele oder Quellen.
- `ausfuehren` darf die ausdrücklich beschriebenen Effekte durchführen. Relative Pfade beziehen sich auf die sichtbare Basis. Absolute Pfade sind keine Sandboxgrenze.

Alle Publikationen schreiben zunächst eine eigene Tempdatei im Zielordner, prüfen deren Format und die unveränderten Quellidentitäten und publizieren erst anschließend atomar. Regeln: `FEHLER`, `UEBERSPRINGEN`, `NEUER_NAME` oder bewusstes `ERSETZEN`. Übersprungene Dateien gelten nicht als bestätigte Ergebnisse und erlauben keine Archivierung. Ein vorhandener Zielordner wird verlangt; Verzeichnisse werden nicht beiläufig angelegt. Quellen und Ausgaben dürfen nicht identisch sein. `ERSETZEN` erlaubt das Ersetzen der dann vorhandenen Zieldatei; es ist keine verteilte Transaktion mit fremden Schreibern.

Quellen erhalten stat-Identität und SHA-256 vor/nach dem Lesen. Bibliotheken lesen technische Quellkopien. Office-ZIPs werden auf Traversal, absolute/mehrdeutige Namen, symbolische Links, Verschlüsselung, Größen, Kompressionsverhältnisse und gefährliches XML geprüft. Die Standardgrenzen stehen in `Grenzen` und gehören zum Laufkontext. Ein Zeitlimit wird kooperativ zwischen Verarbeitungsschritten geprüft; die äußere Prozessbindung muss auch blockierende Bibliotheksaufrufe begrenzen.

## Journal und Wiederaufnahme

Das JSONL-Journal verwendet eine Betriebssystem-Dateisperre und bestätigt jeden Datensatz mit `fsync`. Es enthält Kennungen, Zeitpunkte, Prüfsummen, Pfade und Zustände; keine Datenzeilen oder Parameterwerte. Ein neuer Lauf bekommt eine eigene Kennung. Bewusstes Fortsetzen verlangt denselben Workflow-/Parameterhash und unveränderte bestätigte Ausgaben/Quellen. Eine nicht abgeschlossene vorbereitete Publikation, ein beschädigter letzter Datensatz oder ein unbekanntes Format führt zu `unklar`; die Anwendung wiederholt den Effekt dann nicht automatisch. Nutzer müssen den tatsächlichen Dateistand klären. Das Journal ist kein Rollback: Bereits bestätigte Dateien bleiben bei einem späteren Fehler bestehen.

## Laufzeit und Grenzen

Abgestimmte Pakete: openpyxl 3.1.5, python-docx 1.2.0, pypdf 6.21.2, ReportLab 5.1.0 und defusedxml 0.7.1. Die Business-Runtime wird separat eingerichtet; die Anwendung installiert diese Pakete nicht ungefragt global. Excel oder Word werden nicht gestartet. Formeln werden gespeichert und erhalten, nicht berechnet. pypdf liest vorhandene Textschichten und bietet keine OCR. Ein Scanverdacht ist ein Hinweis, kein Beweis für die Vollständigkeit einer Texterkennung. ReportLab verwendet einen lokal gewählten TTF-Font; Schriftdateien werden nicht aus dem Netz geladen oder ungefragt weiterverteilt.

Der tatsächliche Teststand wird nach den isolierten Fixturetests ergänzt. Diese Vertragsbeschreibung behauptet noch keine abgeschlossene Abnahme.

## Offizielle Grundlagen

- [openpyxl 3.1: Vorhandene Arbeitsmappen und XML-Schutz](https://openpyxl.readthedocs.io/en/3.1/)
- [python-docx 1.2: Dokumente und Runs](https://python-docx.readthedocs.io/en/latest/)
- [pypdf: Textauszug und Seitenoperationen](https://pypdf.readthedocs.io/en/stable/)
- [ReportLab-Dokumentation](https://docs.reportlab.com/)
