# Geschäftsabläufe mit ScriptLab

ScriptLab unterstützt Windows 11 x64. Python ist die empfohlene Sprache für Tabellen, Dokumente und umfangreichere Dateiabläufe. Der aktuelle Katalog enthält 47 zusätzliche Python-Business-Bausteintypen. Die 48 gemeinsamen Grundbausteine bleiben in Python und VBS erhalten; ein bestehendes VBS-Projekt wird nicht automatisch umgestellt.

## Die Business-Laufzeit vorbereiten

Bearbeiten, Strukturprüfung, Codevorschau, Speichern und Export benötigen keine Python-Installation. Zum Verarbeiten von Daten wird eine tatsächlich geprüfte Laufzeit benötigt:

1. **Einstellungen → Python-Installation** öffnen und eine konkrete `python.exe` auswählen oder die gefundene Installation erneut prüfen. Unterstützt ist stabiles reguläres CPython 3.12 bis 3.15 für Windows x64. ScriptLab installiert keine Python-Grundinstallation und startet keinen Launcher oder Installationsmanager.
2. Unter **Business-Laufzeit** **Business-Komponenten prüfen** wählen. Eine bereits vorbereitete Umgebung kann über die Interpreterauswahl verwendet werden.
3. Fehlen die Komponenten, bewusst **Eigene Umgebung online einrichten** oder **Offline-Paketordner verwenden** wählen. Die Onlineversorgung lädt ausschließlich den festgelegten, hashgepinnten Satz. Für Offlinebetrieb stellt die IT die passenden Original-Wheels bereit. Fremde Dateien im Paketordner werden nicht mitinstalliert.
4. Auf den tatsächlichen Abschluss achten. Erst erfolgreich bestätigte Paketversionen und Imports ergeben den Zustand bereit. **Einrichtung abbrechen** beendet die Einrichtung; eine alte Umgebung bleibt erhalten.

Es entstehen eine neue eigene virtuelle Umgebung und lokale technische Dateien, keine globale Python-Installation. Der feste Satz umfasst DuckDB, openpyxl, python-docx, ReportLab, pypdf und deren festgelegte Abhängigkeiten, insgesamt elf Pakete. Öffnen, Datenvorschau, Prüflauf, Ausführung und exportierte Scripts installieren niemals Pakete. Einzelheiten, Offlineversorgung und Lizenzen stehen in [BUSINESS-LAUFZEIT.md](BUSINESS-LAUFZEIT.md).

## Mit einem Beispiel beginnen

Auf der Startseite **Beispielworkflows** öffnen und eine Python-Business-Vorlage mit **Als Vorlage verwenden** übernehmen. ScriptLab erzeugt eine neue Projektkennung und einen privaten Ordner mit ausschließlich den mitgelieferten synthetischen Beispieldaten. Die Pfadparameter dieser Kopie werden absolut an diesen Ordner gebunden. Der Bezug bleibt deshalb beim Speichern, erneuten Öffnen und Wiederherstellen eines Entwurfs erhalten. Das Öffnen startet keine Verarbeitung.

| Beispiel                                                                                 | Ablauf und erwartetes Ergebnis                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Monatliche Auswertung](../beispiele/business/A-Monatsauswertung/README.md)              | Oktober auswählen, nach Region zusammenfassen und XLSX/PDF schreiben: Nord 150, Süd 80, insgesamt 230.                                                           |
| [Bestellungen mit Stammdaten ergänzen](../beispiele/business/B-Bestellungen/README.md)   | Kundennummern zuordnen: drei gültige Zuordnungen, K9 als offener Fehler, zugeordnet insgesamt 85. Doppelte Stammschlüssel werden nicht zufällig aufgelöst.       |
| [Bestellvorschlag als Word-Dokument](../beispiele/business/C-Bestellvorschlag/README.md) | Unterbestände aus XLSX ermitteln, zwei Positionen für Lieferant S1 in eine Vorlage einsetzen: 15 und 12, insgesamt 27. Es wird keine echte Bestellung versendet. |
| [Dokumenteingang geordnet ablegen](../beispiele/business/D-Dokumenteingang/README.md)    | Zwei PDF-Textbelege als Kopien nach Monat ablegen; für den Raster-Scan einen Hinweis ausgeben. Alle Originale bleiben erhalten.                                  |
| [Dateistapel verarbeiten und fortsetzen](../beispiele/business/E-Dateistapel/README.md)  | Gültige CSVs vollständig ausgeben und erst nach bestätigtem Ergebnis archivieren. Die fehlerhafte Quelle bleibt erhalten.                                        |

Die Namen **Testdaten** und **Echte Daten** bezeichnen Parametersätze, keine Sicherheitsbereiche. Für produktive Dateien müssen die tatsächlich verwendeten Pfade und Konfliktregeln bewusst geändert werden. Ein absoluter Pfad bleibt auch nach einem Projektwechsel oder Export absolut. Die Anwendung schützt keine außerhalb der Testkopie gewählten Dateien vor den ausdrücklich gestarteten Workflowaktionen.

## Parameter und Bausteine bearbeiten

**Projektmenü → Workflowparameter** definiert interne Namen, verständliche Beschriftungen, Wertarten, Pflichtangaben, Standardwerte und kurze Hilfen. Dort keine Kennwörter, Tokens oder privaten Schlüssel speichern. Die Definitionen und bewusst gemerkten Parametersätze gehören zur `.scriptlab`-Datei in Schema 3.

In den Eigenschaften eines Business-Bausteins lässt sich ein Feld mit einem Workflowparameter verbinden. Tabellen und Dokumente werden als **Ergebnis eines früheren Bausteins** ausgewählt. So verwendet beispielsweise **Tabelle als XLSX speichern** genau die vorher gefilterte Tabelle. Ein Verweis auf einen späteren oder unpassenden Baustein ist ein Strukturfehler. Freies SQL, Python und Shellbefehle sind keine Eingabeformate.

CSV-Werte werden zunächst als Text eingelesen; führende Nullen bleiben erhalten. Zahlen, Datum und Geldbeträge benötigen eine ausdrückliche Typfestlegung. Ein exakter Dezimalbetrag wird als Text mit Dezimalpunkt angegeben, etwa `12.50`; ein Datum als `2026-10-27`. Bei Tabellenverknüpfungen Schlüssel und erwartete Zuordnung festlegen. Fehlende oder doppelte Stammschlüssel dürfen nicht unbemerkt Daten vervielfachen.

Unter **Testausgabe → Business-Lauf vorbereiten** wird zunächst der gewählte Parametersatz geladen. Änderungen im Formular gelten für den nächsten Lauf. Erst **Werte im Parametersatz merken** übernimmt sie in das Projekt; anschließend das Projekt speichern, wenn diese Werte erhalten bleiben sollen.

## Drei Modi unterscheiden

| Modus                                         | Wirkung                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Datenvorschau · nur begrenzte Daten lesen** | Liefert höchstens 200 Zeilen und 256 KiB an die Oberfläche. Filter, Sortierung oder Gruppierung können trotzdem die gesamte Quelle lesen. Dokument- und Dateiausgaben werden nur geplant.                      |
| **Prüflauf ohne Zieländerungen**              | Prüft unterstützte Schritte, erzeugt erforderliche technische Zwischenfassungen und prüft geplante Ausgaben. Fachliche Eingaben und Ziele werden nicht verändert. Er ersetzt keinen erfolgreichen echten Lauf. |
| **Ausführen · echte Dateiänderungen**         | Führt den vollständigen aktuellen Ablauf mit den angezeigten Parametern tatsächlich aus. Dateiänderungen, Archivierung und Dialoge sind echt.                                                                  |

Die schreibgeschützte **Codevorschau** ist davon getrennt: Sie zeigt ausschließlich erzeugten Quelltext und liest keine Quelldateien. Die Strukturprüfung prüft Verbindungen, Angaben und unterstützte Operationen. Normale Grundbausteine mit Aktionen werden nicht heimlich als Business-Vorschau ausgeführt; ein solcher gemischter Ablauf benötigt einen bewussten echten Test.

Vor jedem Lauf **Quellen, Ziele und Umfang** aufklappen und kontrollieren:

1. Stimmt der Parametersatz, und sind alle Pflichtfelder ausgefüllt?
2. Zeigen Quelle, Vorlage, Ausgabe und Archiv auf die gewünschten eigenen Ordner?
3. Was geschieht bei vorhandenen Zielen: Fehler, Überspringen, neuer Name oder ausdrücklich gewähltes Ersetzen?
4. Passen Zeitlimit, Datenumfang und freier Platz? Dynamisch ermittelte Dateinamen werden erst im betreffenden Schritt vollständig bekannt.

Die Profile bieten 15 Sekunden für eine Vorschau, eine Minute für den Prüflauf, zwei Minuten für eine Kurzprüfung, zwei Stunden für einen Geschäftsablauf und acht Stunden für einen großen Stapel. Ein eigenes Zeitlimit ist von 1 bis 28.800 Sekunden möglich. Profilnamen ändern nicht den Modus: Das Profil **Geschäftsablauf** macht aus einer Datenvorschau keine echte Ausführung.

Während eines Laufs sind inhaltliche Änderungen gesperrt. Der Lauf hält den Projektstand, Parameter, Basisordner und verwendeten Interpreter fest. **Stoppen** wartet auf das Ende des zugehörigen Prozesses. Bereits bestätigte Dateiänderungen werden nicht rückgängig gemacht. Ein Test, eine virtuelle Umgebung und der Windows-Job sind keine Dateisystem-Sandbox.

## Ergebnisse, Berichte und Wiederaufnahme

Die Ausgabe zeigt den aktuellen Schritt und begrenzte Vorschauwerte. Ein Abschluss mit Teilfehlern ist kein uneingeschränkter Erfolg. Der Laufbericht enthält unter anderem Workflowidentität, verwendete Parameter, Quellenfingerabdrücke, Ergebnisse, Fehler, Summen und den tatsächlichen Abschlussgrund. Berichte und Journale können Dateipfade und geschäftlichen Kontext enthalten; sie bleiben lokale Dateien und werden nicht automatisch mit einem Projekt oder Business-Paket weitergegeben.

Eine Ausgabe wird zunächst in einer eigenen Zwischenfassung geschrieben und geprüft. Erst dann wird sie entsprechend der Konfliktregel veröffentlicht. Das Journal bestätigt einzelne Vorgänge. Bei **Passendes früheres Journal bewusst fortsetzen** werden Workflow, Parameter, Quellen, bestätigte Ergebnisse und Laufzeitidentität erneut geprüft. Dazu gehören eigene Python-Module, Python-/Paketversionen und Vera-Schriftbytes; eine geänderte Laufzeit oder ein älteres Journal ohne diese Identität wird nicht automatisch fortgesetzt.

Ein unvollständiger oder unklarer Publikationsstand verlangt eine bewusste Prüfung der tatsächlichen Dateien. Das Journal bietet weder eine allgemeine Genau-einmal-Garantie noch eine gemeinsame Transaktion über alle Dateien oder einen Rollback. Bestätigte Teilergebnisse bleiben nach Abbruch erhalten. Journale über 16 MiB werden beim erneuten Einlesen abgewiesen; die Anwendung verkleinert oder löscht sie nicht heimlich, um einen Wiederanlauf zu erzwingen.

## Eigenständig als Business-Paket exportieren

**Business-Paket exportieren** prüft denselben Workflow erneut und zeigt die geplanten Paketdateien. Das ZIP enthält `workflow.py`, `scriptlab_business`, die festen Requirements, `parameter-beispiel.json`, eine Anleitung sowie die unveränderte Vera-Schrift und Lizenzhinweise. Es enthält keine Python-Grundinstallation und keine bereits installierte virtuelle Umgebung.

**Ressourcen auswählen** fügt ausdrücklich gewählte DOCX-/XLSX-Vorlagen, PNG-/JPEG-Bilder oder TTF-Schriften hinzu. Die passenden Parameterverweise werden auf die Paketkopien bezogen. Geschäftsdaten, Eingangsordner, Arbeitsberichte und Journale werden nicht automatisch mitgenommen. Rechte und vertrauliche Inhalte jeder gewählten Ressource vor Weitergabe prüfen. Eine Ressource darf höchstens 16 MiB, das Paket höchstens 64 MiB groß sein.

Beim Empfänger das ganze Paket entpacken, eine geeignete eigene Python-Umgebung bewusst mit dem festen Paketsatz vorbereiten und `parameter-beispiel.json` prüfen. Die beigefügte Anleitung enthält Online- und IT-Offlinebefehle sowie Prüflauf und Ausführung. Der Scriptstart installiert nichts. Relative Pfade beziehen sich standardmäßig auf den Scriptordner; `--basis` setzt einen ausdrücklichen Bezug. Unveränderte absolute Pfade bleiben auf ihren bisherigen Ort gerichtet und müssen für eine Weitergabe bewusst angepasst werden.

Ein gewöhnlicher Python-Workflow ohne Business-Bausteine bleibt eine einzelne `.py`-Datei. VBS bleibt `.vbs`; die optionale Authenticode-Signatur gilt ausschließlich für VBS. Ein Business-ZIP oder eine `.py`-Datei erhält kein erfundenes Signaturergebnis.

## Grenzen und praktische Nachweise

- Dokumenttabellen umfassen höchstens 20.000 Zellen. PDF-Textauszüge sind auf 256 KiB, PDFs auf 2.000 Seiten begrenzt. Große Tabellen werden nicht still vollständig in eine Word- oder PDF-Tabelle geladen.
- Die Oberfläche empfängt nur begrenzte Ausschnitte. DuckDBs Speicherbudget ist kein hartes RAM-Limit für den gesamten Python-Prozess. Das Tempbudget begrenzt DuckDB-Zwischendaten, nicht sämtliche Bibliotheks- und Zieltempdateien.
- Das dokumentierte breite Millionen-CSV-Profil scheiterte mit 64 MB DuckDB-Budget. Ein ausdrücklich schmaleres Ergebnisschema bestand. Daraus folgt keine allgemeine Zusage für beliebige Millionen-Workflows.
- openpyxl berechnet keine Excel-Formeln. Ein vorhandener Formelwert kann veraltet sein; die gewählte Formelbehandlung beachten. CSV bleibt Textaustausch: Ein fremdes Tabellenprogramm kann führende Formelzeichen als Formeln auslegen.
- DOCX arbeitet mit den unterstützten Text-/Tabellenplatzhaltern; beliebige Word-Funktionen werden nicht nachgebildet. PDF-Scans werden nicht per OCR gelesen. Office-Konvertierung, Office-COM, Cloud- und E-Mail-Anbindungen sind nicht enthalten.

[Tabellenumfang und Lastmessungen](BUSINESS-LEISTUNG-DATEN.md), [Dokument-/Dateioperationen](BUSINESS-DOKUMENTE.md) und [C/D/E-Beispielprüfung](BUSINESS-BEISPIELE-PRUEFUNG.md) enthalten getrennte tatsächliche Nachweise. Modul-, Generator- und Dateitests ersetzen keinen UI-, Screenreader-, Installer- oder produktiven Updatetest. Der aktuelle Business-Gesamtstand und noch offene Abnahmen stehen in [BUSINESS-ABNAHME.md](BUSINESS-ABNAHME.md); [ABNAHME.md](ABNAHME.md) erhält die historischen 0.1.0-Ergebnisse.
