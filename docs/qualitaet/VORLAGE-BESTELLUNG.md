# Bestellvorlage C überarbeitet

## Initialauftrag und Zuständigkeit

Fachagent Geschäftsdaten überarbeitet ab `main/58dc3d1` ausschließlich die vorhandene DOCX-Vorlage des Beispiels C. Ziel sind verständliche Angaben, eine klare Hierarchie und besser lesbare Positionen. Keine neuen Geschäftsfeatures, Bausteine, Pflichtdaten oder erfundenen Firmenangaben. Alle sieben Platzhalter, die erste Tabelle mit Musterzeile 1, Spalten und bekannte Ausgabe `Bestellung-S1.docx` mit zwei Positionen und 27 Stück bleiben erhalten.

Zugewiesene Dateien: `beispiele/business/C-Bestellvorschlag/vorlagen/Bestellung.docx`, zugehörige `README.md`, der reproduzierbare Generator `scripts/vorlage-bestellung-erstellen.py`, `tests/business/test_vorlage_bestellung.py` und dieser Bericht. Renderbelege ausschließlich im ignorierten `artifacts/vorlagen`. Nach bestätigtem Integrationsbefund erweiterte der Hauptagent den Schreibbereich auf den alten DOCX-Erzeugungsabschnitt in `scripts/business-beispiele-pruefen.py` und seine unbenutzten lokalen DOCX-Imports. Kein Schreiben an Workflow, Plan, Parametern, Lager-XLSX, Laufzeit oder Renderer; kein Appstart, Build, Commit, Push oder Git-Indexzugriff durch diesen Agenten.

Arbeitsschritte: Vorlage und echten bestehenden C-Plan zunächst lesen und ausführen, Ausgangsvorlage und ausgefüllte Ausgabe rendern, konkrete Gestaltungsschwächen benennen, lokal überarbeiten, fachliche Inhalte erneut aus den Dateien lesen und jede finale Seite visuell prüfen. Eingesetzter Platzhaltertext muss wörtlich Daten bleiben. Rückmeldung mit Änderungen, Ergebnissen, Grenzen und Integrationsschritt.

## Tatsächliche Ausgangsbefunde

| Kennung | Reproduktion und Auswirkung | Abnahme |
| --- | --- | --- |
| VOR-01 / P2 | Vorlage mit Word rendern: Platzhalter für Zielbestand und Bestellmenge brechen mitten im Namen beziehungsweise vor den Schlussklammern um. Das erschwert das Erkennen und Bearbeiten der Musterzeile. | Alle sieben vorhandenen Platzhalter bleiben vollständig erhalten und sind im Render der Vorlage ohne solche Umbrüche lesbar. |
| VOR-02 / P2 | Echte synthetische Ausgabe öffnen: Lieferant und Datum haben dieselbe Gewichtung wie Fließtext; eine Positionsüberschrift und Mengen-Einheit fehlen. Die Summe steht direkt am Tabellenrand, Zahlen sind linksbündig. | Lieferant/Datum, Positionen und Gesamtmenge sind klar voneinander getrennt; Stück-Einheit und Zahlenausrichtung stimmen mit dem tatsächlichen Inhalt überein. |
| VOR-03 / P2 | Bestehenden Entwickler-Neuaufbau lesen: Die DOCX-Gestaltung war vollständig in `fixtures_erstellen` hartcodiert. Ein separater neuer Generator allein würde beim nächsten Fixture-Neuaufbau wieder überschrieben. | Gezielter Vorlagengenerator und vorhandener Fixture-Neuaufbau erzeugen dieselben logischen OOXML-Bestandteile wie die eingecheckte Vorlage. Andere Beispieldateien bleiben unangetastet. |

Ausgangsrender: `artifacts/vorlagen/vorher/Vorlage.png` und `Ausgabe.png`, jeweils eine US-Letter-Seite. Beide Bilder wurden tatsächlich geöffnet. Die ursprüngliche fachliche Ausgabe war bereits korrekt; geändert wurde deren Gestaltung und Erklärung, keine Mengenberechnung.

## Gestaltung und unveränderte Verträge

Die Vorlage verwendet A4 mit 20 mm Seitenrand, Segoe UI, einen schwarzen Word-`Title` ohne Unterstreichung oder Zierlinie sowie einen kurzen Prüfzweck. Lieferant und Bestelldatum haben fett gesetzte Feldbezeichnungen. Unter `Bestellpositionen` erläutert ein Satz die Stückzahlen und die bestehende Berechnung auf den Zielbestand.

Die vier Spalten heißen weiterhin `Artikel`, `Bestand`, `Zielbestand` und `Bestellmenge`. Zell- und Rasterbreiten sind nun beide ausdrücklich gesetzt: 39/38/45/48 mm bei 170 mm Gesamtbreite. Die vorhandenen langen Platzhalter passen bei 11 pt vollständig in ihre Zellen. Mengen sind rechtsbündig; Zellen erhalten Innenabstände und sichtbare hellgraue Ränder. Ein heller Tabellenkopf mit schwarzem Text, frei wachsende Zeilen und eine mit Abstand folgende fett gesetzte Gesamtmenge ersetzen die gedrängte Ausgangsdarstellung. Der Kopf ist als Wiederholungszeile markiert; ein Mehrseitenfall wurde nicht als visuell geprüft ausgegeben.

Die Datenverträge bleiben:

- `{{Lieferant}}`, `{{Datum}}`, `{{Gesamtbestellmenge}}`.
- `{{Position.Artikel}}`, `{{Position.Bestand}}`, `{{Position.Zielbestand}}`, `{{Position.Bestellmenge}}`.
- Erste Tabelle, zweite Zeile als Positionsmuster; keine zusätzliche Layouttabelle davor.
- Bestehende Quellen, Parameter und Gruppe nach Lieferant; keine neue Absender-, Adress- oder Kontaktdatenanforderung.

Absender und Anschriften fehlen in den Quelldaten. Deshalb enthält das Dokument keine erfundene Identität oder einen leeren Pflichtblock. Der vorhandene Lieferant dient als erkennbare Zuordnung. Die README erklärt diese Grenze und die Anpassung einer eigenen Vorlagenkopie. Ein knapper Hinweis bezeichnet die Daten weiter als synthetisches Beispiel und den Ablauf als Bestellvorschlag zur fachlichen Prüfung. Eine tatsächliche Bestellung oder ein Versand werden nicht behauptet. Appmarke und Entwickler werden nicht in das Kundendokument eingefügt.

Der neue Generator setzt feste Metadaten und ZIP-Zeitpunkte. Tests vergleichen die logischen ZIP-/OOXML-Bestandteile, nicht versionsabhängige Kompressionsbytes. Der alte Fixture-Erzeuger ruft nun denselben fest benannten Generator auf; sein übriger XLSX-/PDF-/Bildcode bleibt unverändert.

## Werkzeuge und Renderabweichung

Der Fachagent las `documents/SKILL.md`, die Anleitung für Erstellen/Bearbeiten und Renderprüfung sowie die Schreibhinweise. Der vorgeschriebene Operationsmarker lief einmal erfolgreich mit `--operation-kind edit --expected-output-count 1 --output-format docx`.

Der verpackte `render_docx.py` wurde tatsächlich aufgerufen und scheiterte mit `FileNotFoundError: LibreOffice soffice.exe was not found on PATH`. Ein verwalteter Dependencyloader war in dieser Windows-Sitzung nicht verfügbar. Der Hauptagent bestätigte daraufhin ausdrücklich den vorhandenen lokalen Windows-Weg ohne Installation:

- Authoring: vorhandenes CPython 3.12.6 mit `python-docx`, stets `-B`.
- Fachliche Ausführung: gebündeltes CPython 3.15.2 mit den tatsächlichen Business-Komponenten, stets `-B`.
- Rendern: vorhandenes `scripts/business-docx-rendern.ps1` über Microsoft Word 2021, danach Poppler 25.07.0. Der Helper lehnt vorhandene Word-Sitzungen ab und bearbeitet ausschließlich eigene Artefaktkopien. Keine fremde Word-Sitzung wurde übernommen oder beendet.

Ein direkt aufeinander folgender Konvertierungsversuch traf kurzzeitig auf den noch endenden eigenen Word-Prozess und wurde vom Helper abgewiesen. Der nächste Aufruf nach dessen tatsächlichem Ende gelang. Die Alternative wurde nicht als erfolgreicher LibreOffice-Render ausgegeben.

## Fachliche und visuelle Prüfungen

```powershell
python -B -X utf8 scripts/vorlage-bestellung-erstellen.py
& artifacts/python-buendel/python/python.exe -B -X utf8 -m unittest discover -s tests/business -p test_vorlage_bestellung.py -v
```

**4/4 bestanden**, 1,412 s, kein Skip:

1. Generator erhält Platzhalter, Tabellenvertrag und eingecheckte logische OOXML-Bestandteile; keine exakt fixierte Höhe für Inhaltszeilen.
2. Vollständiger unveränderter C-Plan erzeugt genau `Bestellung-S1.docx`, Artikel A mit 15 und Artikel C mit 12 Stück, Gesamt 27; vorhandenes Ziel und DOCX-/XLSX-Originale bleiben erhalten.
3. Vorhandener Entwickler-Neuaufbau setzt die neue Gestaltung nicht zurück; vollständiger Vergleich der DOCX-Paketbestandteile.
4. Eingesetzte Zeichenfolgen wie `S1 {{Datum}}` und `Artikel {{Lieferant}} … < & >` bleiben in der fertigen DOCX wortgetreu erhalten; Vorlage bleibt bytegleich.

Anschließend gesamte Python-Fachsuite am integrierten Vorlagen-/Fixture-Stand: **147/147 bestanden**, 10,523 s, kein Skip. Aufruf: `python.exe -B -X utf8` aus dem Bündel mit eingefügtem lokalen `laufzeit`-Pfad und `unittest.defaultTestLoader.discover('tests/business')`. Dies ist ein einzelner vollständiger Lauf einschließlich der vier neuen Fälle; kein Zusammenzählen mit älteren Läufen. AST-Syntaxprüfung aller drei betroffenen Python-Dateien und `git diff --check` bestanden.

Der echte C-Plan wurde zusätzlich in einer eigenen Artefaktkopie ausgeführt. `artifacts/vorlagen/endstand/fachpruefung.json` protokolliert eine Ausgabe, Lieferant S1, Positionen 15/12, Gesamtmenge 27 sowie Quellen-/Zielschutz. DOCX-Readback und PDF-Textextraktion stimmen überein; keine unbekannten Platzhalter bleiben in der Standardausgabe.

Renderaufrufe, jeweils getrennt nach dem Ende der eigenen Word-Instanz:

```powershell
& scripts/business-docx-rendern.ps1 -Quelle artifacts/vorlagen/endstand/Vorlage.docx -Ziel artifacts/vorlagen/endstand/Vorlage.pdf
pdftoppm -r 150 -png -singlefile artifacts/vorlagen/endstand/Vorlage.pdf artifacts/vorlagen/endstand/Vorlage
& scripts/business-docx-rendern.ps1 -Quelle artifacts/vorlagen/endstand/C-Bestellvorschlag/ausgaben/Bestellung-S1.docx -Ziel artifacts/vorlagen/endstand/Ausgabe.pdf
pdftoppm -r 150 -png -singlefile artifacts/vorlagen/endstand/Ausgabe.pdf artifacts/vorlagen/endstand/Ausgabe
```

**Visuell bestanden:** Vorlage und tatsächlich ausgefüllte Standardausgabe haben jeweils genau eine A4-Seite. Jede Seite wurde als PNG geöffnet: keine abgeschnittenen Zeichen, keine kollidierenden Texte, vollständige Platzhalter in der Vorlage, klare Tabellenzeilen, rechtsbündige Mengen, ausreichender Abstand vor der Summe und lesbare Umlaute. PDF-Textreadback bestätigt alle sieben ungeteilten Vorlagentokens sowie `Lieferant: S1`, Datum und `Gesamtbestellmenge: 27 Stück` in der Standardausgabe.

Zusätzlicher kontrollierter Langtextfall: `Lange-Werte.docx/.pdf/.png` im selben Ordner. Eine längere Artikelbezeichnung wächst auf mehrere Zeilen; die Mengen bleiben lesbar mittig in der Zeilenhöhe. Wörtliche `{{Lieferant}}`, `S1 {{Datum}}` und `< & >` bleiben sichtbar. Diese eine A4-Seite wurde ebenfalls tatsächlich betrachtet und ihr Text zurückgelesen. Das ist keine Behauptung beliebiger Text-/Seitengrößen.

## Übergabe und Grenzen

Finales Produktartefakt ist ausschließlich die vorhandene `Bestellung.docx`; PNGs/PDFs und die gefüllten Dokumente sind ignorierte interne QA-Belege. Keine neue Abhängigkeit oder Laufzeitinstallation, keine geänderte Planlogik, keine neue Versandschnittstelle. Word für Windows ist der tatsächlich geprüfte Renderer; andere Officeprogramme, fehlende Segoe-UI-Schrift, Druckertreiber, Mehrseitenbestellungen und echte Unternehmensdaten wurden nicht praktisch geprüft.

Nächster Schritt: Root prüft Diff/Artefakt unabhängig, integriert die Vorlage mit dem gemeinsamen Fixture-Aufruf und führt erforderliche übergreifende Prüfungen aus. Commit, Push und gegebenenfalls neue Paketprüfung liegen ausschließlich beim Hauptagenten.
