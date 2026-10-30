# Fachauftrag und Ergebnis: Geschäftsdaten und Dokumente

## Initialanweisung und Zuständigkeit

**Rolle:** Fachagent Geschäftsdaten/Leistung. Bestehende Tabellen-, Datei- und Dokumentfunktionen anhand synthetischer Daten auf falsche Ergebnisse und Datenverlust untersuchen; bestätigte Ursachen lokal korrigieren. Keine neuen Geschäftsfeatures, keine Business-Parität für VBS und keine eigenständige Cloudarchitektur.

**Projektkontext:** Ausgangscommit `fa6b208`, Windows x64, Node.js 24.19.0, gebündeltes CPython 3.15.2. Python-Business-Runner unter `laufzeit/scriptlab_business`, DuckDB 2.0.0, openpyxl 3.1.5, python-docx, ReportLab und pypdf. Vor der Umsetzung gelesen: `ARCHITEKTUR.md`, `BUSINESS-DATEN.md`, `BUSINESS-DOKUMENTE.md`, `BUSINESS-LEISTUNG-DATEN.md` sowie betroffene Implementierung und Fachtests. Der ausgeführte TypeScript-Katalog bestätigt 47 Python-Business-Blocktypen; diese verwenden teilweise dieselbe Laufzeitoperation.

**Bekannter Ausgangszustand:** Noch kein bestätigter Fehler bei Auftragsbeginn. Zuerst führende Nullen, NULL/Dezimalwerte, Joins/Summen, Vorlagen- und Originalerhalt, Konfliktregeln sowie Datenübergänge in Dokumentadapter prüfen. Keine große Änderung auf bloßer Vermutung. Vor Änderung konkrete Reproduktion, Soll/Ist, Priorität und Abnahme an den Hauptagenten melden.

**Schreibbereich:** Nur `daten.py`, `dateien.py`, `dokumente.py` in der Business-Laufzeit, `tests/business/test_qualitaet.py` und dieser Bericht. Tatsächlich geändert: nur `dokumente.py`, die neue Testdatei und dieser Bericht. Projektformat, Katalog/Validierung, gemeinsame Typen, IPC, Renderer und Abhängigkeiten gehören dem Hauptagenten; Ausführungsdienst/Generatoren und UI gehören anderen Agenten. Keine Arbeit am Git-Index, keine eigenen Commits/Pushes.

**Geschützte Verträge:** Schema 3, stabile Block-IDs und Sprachzuordnungen; Vorschau, Prüflauf und echte Ausführung bleiben getrennt. Kein Start durch Öffnen, Bearbeiten, Speichern oder Export. Feste Operationen, Benutzerwerte bleiben Daten. Eigenständige Exporte verwenden denselben Dokumentadapter. Quellen/Originale erhalten, fachliche Publikation nur über den bestehenden Dateidienst. Kein automatisches Rollback behaupten. Excel-Formeln schreiben ist keine Berechnung; PDF-Textauszug ist keine OCR.

**Arbeitsschritte und Abnahme:** Ursache reproduzieren, klein korrigieren, tatsächliche Ausgabedateien unabhängig erneut lesen. Fehlerfälle dürfen weder bestehende Ziele ersetzen noch neue Teilergebnisse als Erfolg publizieren. Gezielte Regressionen und danach die bestehende Python-Fachsuite ausführen. Leistungsversprechen erfordern vergleichbare Vorher-/Nachher-Messungen; in diesem Paket wird keines abgegeben. Rückmeldung: Befunde, Änderungen, Befehle, Ergebnisse, Grenzen und konkreter Integrationsschritt. Kritische fachliche Änderungen erhalten einen unabhängigen Review durch einen anderen Agenten und eine Wiederholungsprüfung am integrierten Stand.

## Bestätigte Befunde

| Kennung / Priorität | Reproduktion und Ausgangsverhalten | Erwartung / Abnahme |
| --- | --- | --- |
| DATA-01 / P1 | `dokument.xlsx_vorlage`: `zellen.A1` mit 32.768 Zeichen in eigene XLSX-Vorlage schreiben. Meldung `publiziert`, Readback nur 32.767 Zeichen. openpyxl kürzt bei Zuweisung still; der separate Tabellenexport hatte bereits eine Längenprüfung. Nutzeraufgabe: lange Geschäftstexte vollständig in eine Vorlage übernehmen. Datei: `dokumente.py`, `xlsx_vorlage`. | Verständlicher Fehler mit Zelladresse und Grenze vor Publikation; bei `ERSETZEN` bleibt das vorhandene Ziel bytegleich. 32.767 Zeichen bleiben vollständig erhalten und führendes `=` bleibt Text. |
| DATA-02 / P1 | `dokument.docx_vorlage` mit Positionstabelle, Positionswert `{{Kunde}}`, gemeinsamem Wert `Kunde=ERSETZT`. Readback enthält `ERSETZT`. `_positionen` ersetzt zuerst, `_word_ersetzen` interpretiert dieselbe Ausgabe erneut. Unbekannte oder unvollständige Klammertexte brechen den Lauf ab. Verbundene Positionszellen sowie zwischen Abschnitten geteilte Kopf-/Fußzeilen verursachen ebenfalls Mehrfachauswertung. Nutzeraufgabe: fremde Bezeichnungen oder technische Texte unverändert in Geschäftsbriefe einsetzen. | Jeden tatsächlichen Vorlagenabsatz genau einmal ersetzen. Eingesetzte Daten bleiben wörtlich, einschließlich `{{Unbekannt}}`, `{{Kunde}}` und unvollständiger Klammertexte. Formatierte Positionszeilen, Vorlagenquelle und gemeinsame Werte bleiben korrekt. |
| DATA-03 / P1 | Unabhängiger Review durch Agent `ausfuehrung`: Eine explizit zugewiesene lange Excel-Formel wird ebenfalls von openpyxl auf 32.767 Zeichen gekürzt und als Erfolg publiziert. Die erste Korrektur von DATA-01 schützte nur normale Zellwerte. | Gemeinsame Längenprüfung vor beiden Zuweisungswegen; eine zu lange Formel verhindert die Publikation und erhält bestehendes Ziel/Original. Das Schreiben einer Formel bleibt ausdrücklich ohne Berechnung. |

Die ersten beiden direkten Ausgangsreproduktionen liefen vor der Änderung mit eigenen temporären Dateien auf Windows/CPython 3.15.2. Der Hauptagent hat beide Korrekturen anschließend ausdrücklich in das Paket aufgenommen. DATA-03 wurde nach dem unabhängigen Review vor dem Paketabschluss ergänzt.

## Umsetzung

XLSX-Zelltexte und explizite Formeltexte über 32.767 Zeichen werden vor der openpyxl-Zuweisung mit einem `BusinessFehler` abgelehnt. Der bestehende Publikationsdienst entfernt die unpublizierte Zwischenfassung; eine bestehende Zieldatei wird dadurch nicht ersetzt. Dies ist der Schutz gegen stilles Abschneiden, keine Formelvalidierung oder Berechnung.

DOCX hält je Ausgabedokument eine Menge tatsächlich bearbeiteter XML-Absätze. Positionserzeugung und anschließende allgemeine Platzhalterersetzung verwenden diese gemeinsame Menge. Das verhindert sowohl die zweite Verarbeitung eingesetzter Positionsdaten als auch Mehrfachzugriffe durch verbundene Zellen oder verknüpfte Kopf-/Fußzeilen. Keine Änderung am gespeicherten Workflow oder an öffentlichen Operationssignaturen.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Windows x64, `artifacts/python-buendel/python/python.exe`, CPython 3.15.2, openpyxl 3.1.5, DuckDB 2.0.0. Testdaten ausschließlich synthetisch in `TemporaryDirectory`; keine Nutzer- oder Unternehmensdateien.

```powershell
& artifacts/python-buendel/python/python.exe -B -m unittest discover -s tests/business -p test_qualitaet.py -v
```

**Bestanden: 6/6**, 0,554 s, kein Skip, einschließlich DATA-03. Echte XLSX-/DOCX-Dateien erneut geöffnet: Zellgrenze und wörtliches `=`, Fehler vor neuem/ersetztem Ziel bei Text und Formel, Vorlagenbytes, Stagingbereinigung, Positionsdaten, formatierter Text, verbundene Zellen und verknüpfte Kopf-/Fußzeilen. Die Datei wird vom bestehenden CI-Aufruf `unittest discover ... -p test_*.py` automatisch aufgenommen. Der Grenztext ist deterministisch gemischt, damit die unveränderte ZIP-Kompressionsschutzgrenze den Testfall nicht überlagert.

```powershell
& artifacts/python-buendel/python/python.exe -B -c "import sys,unittest; from pathlib import Path; sys.path.insert(0,str(Path('laufzeit').resolve())); suite=unittest.defaultTestLoader.discover('tests/business'); result=unittest.TextTestRunner(verbosity=1).run(suite); sys.exit(not result.wasSuccessful())"
```

**Bestanden: 143/143**, 8,786 s, kein Skip. Das ist ein einzelner vollständiger Lauf der Python-Fachsuite einschließlich der sechs neuen Fälle; nicht mit anderen Testzahlen addieren. Der vorherige 142er-Lauf enthielt die spätere Formelregression noch nicht. `git diff --check`: bestanden. Python-Proben werden jetzt mit `-B` gestartet, damit keine Bytecode-Caches das manifestgeprüfte Bündel verändern.

## Vorhandene Operationsprüfungen und Grenzen

Die folgenden Zuordnungen stammen aus dem tatsächlichen Testcode; der vollständige Lauf oben hat die Dateien ausgeführt. Eine bestandene Operationsprüfung belegt keine vollständige UI-/Generator-/Exportprüfung jedes zugehörigen Blocktyps oder jeder Konfiguration.

| Laufzeitoperationen | Konkrete vorhandene Nachweise |
| --- | --- |
| `daten.importieren`, `daten.exportieren` | `test_daten.py`: CSV/JSON/XLSX/Parquet-Roundtrips, führende Nullen, Unicode/Zitate, NULL, exakte Ganzzahlen/Dezimalwerte, Bereichsgrenzen, Formelzeichen als Text, Quelländerung, atomare Fehler, Konflikte, 20.001 Zeilen. |
| `daten.spalten`, `daten.werte` | `test_daten.py`: auswählen/umbenennen/Kollisionen, Zahlen-/Datumsformate, Fehlwertregeln, Dezimalarithmetik, alle Rechen-/Text-/Datumfunktionen, freie Formeln abgewiesen, Textteil-/Ganzwertersetzung. |
| `daten.filtern`, `daten.sortieren`, `daten.dubletten`, `daten.vereinigen` | `test_daten.py`: verschachtelte Bedingungen, Vergleiche/IN/NULL, Ausdrucksgrenzen, Sortierung/NULL, erste/letzte/keine Dubletten, Vereinigung nach Position/Name. |
| `daten.verknuepfen`, `daten.gruppieren`, `daten.pruefen`, `daten.vorschau` | `test_daten.py`: Kardinalität/fehlende Zuordnung/Kollisionen, Aggregationen/Qualitätsregeln, Vorschauzeilen-/Bytegrenze, Query-Unterbrechung. `test_beispiele_daten.py`: A mit Summe 230, B mit drei Zuordnungen/Summe 85 und Doppel-K1 als Fehler. |
| `dateien.stapel`, `dateien.archivieren`, `dateien.aktion` | `test_dokumente.py`: stabile Reihenfolge/Hashes, Archivierung erst nach überprüftem Output, Kopieren/Verschieben/Umbenennen/Ordner und ZIP-Roundtrip. `test_dateifehler.py`: tatsächliche Windows-Exklusivsperre und gezielte IO-/Abbruchfehler. `test_ausgabeziele.py`: erlaubte/abgewiesene Pfade. |
| `dateien.beleg_ablegen`, `dateien.csv_stapel` | `test_dokumente.py`, `test_beispiele_dokumente.py`: Text-PDF versus Scan, Monatsablage, CSV-Fehlerquelle erhalten, Prüflaufziele unverändert, Abbruch/Wiederaufnahme/unklare Publikation; kein OCR-Nachweis. |
| `dokument.xlsx_vorlage` | `test_dokumente.py`: Formate/Formeln/Textdaten/Originalerhalt. Neue `test_qualitaet.py`: Textgrenze, kein stilles Kürzen, Erhalt vorhandener Ziele. Keine Formelberechnung. |
| `dokument.docx_vorlage`, `dokument.docx_serie`, `dokument.docx_erstellen` | `test_dokumente.py`: verteilte Runs, Kopfzeilen/Tabellen, formatierte Positionen, fehlender Wert, sichere Seriennamen, Gruppenserie mit Summe 27, neues Dokument/Bilder. Neue `test_qualitaet.py`: einmalige Ersetzung von Vorlagentokens. |
| `dokument.pdf_verbinden`, `dokument.pdf_seiten`, `dokument.pdf_teilen`, `dokument.pdf_text`, `dokument.pdf_bericht` | `test_dokumente.py`: Seitenfolge/Grenzen/Duplikate, Text versus Scan, Umlaute/Schrift, lange Texte/Zellen, Layoutfehler mit Zielerhalt, wieder gelesener PDF-Text. |

**Nicht separat durch diesen Agenten geprüft:** Editorinteraktion jedes der 47 Blocktypen; die Steuerblöcke `sl_biz_stapel_schleife` und `sl_biz_fehlerbehandlung` vom Canvas bis zum Prozess; eigenständiger Paketstart, Installer und produktive Updatekette; UNC-Freigaben oder Unternehmensdateien. Die zwei fachlichen Korrekturen gelten für den gemeinsamen Adapter in internem Lauf und Export, ersetzen jedoch keinen gesonderten Export-/Pakettest des integrierten Stands.

Keine neue Lastoptimierung und keine Vorher-/Nachher-Leistungsbehauptung. Die alten Millionen-CSV-/50.000-XLSX-Messwerte wurden als vorhandene Dokumentation gelesen, nicht in diesem Paket erneut gemessen.

## Übergabe

Nächster Schritt: unabhängiger Review der XML-Absatzidentitäten und der Fehler-/Zielerhalt-Regressionen; dann Wiederholung am integrierten Stand durch den Hauptagenten, Build/Paketprüfung sowie deutscher Commit und Push. Kein eigener Commit oder Push durch diesen Agenten.
