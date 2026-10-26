# Prüfung der Beispiele C, D und E

Die Beispiele unter `beispiele/business` enthalten ausschließlich synthetische Daten. Eingaben, DOCX-Vorlage und PDF-Dateien werden von `scripts/business-beispiele-pruefen.py --fixtures` erzeugt. Der Generator setzt feste Office-Metadaten und ZIP-Zeitstempel; PDF-Dateien verwenden den deterministischen ReportLab-Modus. Es werden keine fremden Vorlagen, Kundendaten, Makros, Nachrichten oder Cloud-Dienste verwendet.

## Vollständige Abläufe

| Beispiel             | Eingabe und Verarbeitung                                                                                                                                               | Verbindliches Ergebnis                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| C – Bestellvorschlag | XLSX mit drei Artikeln; Zahlen typisieren, Pflichtwerte und nichtnegative Bestände prüfen, Unterbestände filtern, Bestellmenge berechnen und nach Lieferant gruppieren | Ein DOCX für S1 mit Artikel A: 15 und Artikel C: 12; insgesamt 27 Stück. Artikel B wird ausgeschlossen. Keine unerledigten Platzhalter.          |
| D – Dokumenteingang  | Zwei PDFs mit eindeutiger Belegnummer und Datum, ein ausschließlich gerastertes PDF ohne Textschicht                                                                   | Zwei bytegleiche Kopien unter `2026-10/SYN-1001.pdf` und `2026-10/SYN-1002.pdf`; ein Scan-/OCR-Hinweis. Alle drei Originale bleiben unverändert. |
| E – Dateistapel      | Zwei vollständige und eine fehlerhafte CSV; Ausgabe prüfen, Archivkopie bestätigen und erst danach gültige Eingangsdatei entfernen                                     | Zwei CSV-Ausgaben und zwei Archivdateien; die fehlerhafte Quelle bleibt erhalten. Der Fehler bleibt im Bericht sichtbar.                         |

Die Pläne verwenden denselben festen Opcode-Runner und dieselben Handler wie die Anwendung. `parameter.json` enthält ausschließlich nicht geheime relative Testpfade. Für eigene Versuche den ganzen Beispielordner kopieren, damit Vorlage, Parameter und Eingaben zusammenbleiben. Vorhandene Ziele werden mit der Regel `FEHLER` geschützt.

## Reproduzieren

Voraussetzung ist die ausdrücklich eingerichtete und geprüfte Business-Laufzeit aus [BUSINESS-LAUFZEIT.md](BUSINESS-LAUFZEIT.md) sowie der gebaute feste Windows-Jobhost. Keiner dieser Befehle installiert Pakete.

```powershell
$businessPython = '<geprüfte Business-venv>\Scripts\python.exe'
& $businessPython -I scripts/business-beispiele-pruefen.py
& $businessPython -I scripts/business-beispiele-pruefen.py --benchmark-dateien 1000
& $businessPython -I scripts/business-beispiele-pruefen.py --benchmark-dateien 1000 --nur-benchmark
& $businessPython -I scripts/business-beispiele-pruefen.py --tests
```

Der erste Befehl erzeugt neue Prüfkopien unter `artifacts/business-beispiele/<neue Kennung>`. Der äußere Prüfer startet ausschließlich seinen eigenen festen Prüfaufruf im vorhandenen Jobhost mit einer harten Frist von 45 Sekunden. Der optionale 1000-Dateien-Lauf erhält 170 Sekunden; sein Kontext begrenzt den Dateistapel auf 120 Sekunden. Bei Zeitüberschreitung fordert der Controller zuerst STOP an und beendet nötigenfalls nur den eigenen Jobhost. Kein Beispiel läuft automatisch beim Öffnen.

`--nur-benchmark` misst ausschließlich den festen Dateistapel in einem frischen Prozess ohne vorherige C/D/E-Läufe. Der Controller setzt `TEMP`, `TMP` und `TMPDIR` bereits vor dem Prozessstart auf einen neuen privaten Artifactordner. Der Sampler liest ausschließlich den eigenen Win32-Prozess und diesen privaten Tempordner sowie `.scriptlab-*`-Stagingdateien im eigenen Stapelordner. Er sammelt keine Dateien aus fremden Tempordnern und sucht keine fremden Prozesse. Der angestrebte Abstand ist 25 ms; die tatsächliche größte Abtastlücke wird mitgeschrieben. Kurzlebige Spitzen können zwischen den Stichproben liegen.

`--fixtures` erneuert ausdrücklich die bezeichneten synthetischen Quelldateien im Beispielbaum. Das ist für die Entwicklung bestimmt. Normale Prüfungen arbeiten in neuen Kopien und vergleichen anschließend sämtliche Dateien des Original-Beispielbaums per SHA-256.

## Geprüfte Schutzfälle

- Vorschau und Prüflauf aller drei Pläne verändern keine Eingabe und erzeugen keine fachlichen Zieldateien.
- C und D erhalten ein bereits vorhandenes Ergebnis unverändert und melden einen Konflikt.
- E prüft vollständige CSV-Inhalte, Ausgabe- und Archivhashes. Rohzeilen aus der absichtlich fehlerhaften Datei gelangen nicht ins Journal.
- Ein gezielter Abbruch nach bestätigter Archivierung lässt genau einen abgeschlossenen Teilschritt zurück. Die Wiederaufnahme desselben Journals prüft diesen und verarbeitet die restlichen Dateien; die erste Ausgabe wird nicht erneut geschrieben.
- Eine künstlich unterbrochene Journalbestätigung **nach** atomarem Rename erzeugt einen echten unklaren Zustand. Eine Wiederaufnahme wird abgelehnt, Quelle und bereits vorhandenes Ziel bleiben erhalten. Das Journal ist kein Rollback.
- Die Binärfixture-Prüfung erzeugt XLSX, DOCX und PDF zweimal in einem isolierten Tempordner und verlangt identische Bytes.

Die Ergebnisdatei `pruefung.json` enthält die tatsächlich erfüllten Inhaltsprüfungen und beim optionalen Benchmark die gemessene Dauer. Sie behauptet keine Bildprüfung. Inhaltsprüfung und gesonderte visuelle Prüfung werden getrennt erfasst.

## Tatsächlicher Prüfstand

Am 26. Oktober 2026 wurden folgende Prüfungen unter Windows x64 mit CPython 3.12.6 und dem festen Business-Paketprofil praktisch durchgeführt:

| Prüfung                                                       | Tatsächliches Ergebnis                                                                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vollständige C/D/E-Pläne einschließlich Vorschau und Prüflauf | Alle Inhalts-, Originalerhaltungs- und Konfliktprüfungen erfolgreich                                                                                                              |
| Eigenständige Fachtestsuite                                   | 9/9 bestanden, 0 ausgelassen; letzter Gegenlauf 1,799 Sekunden Testdauer                                                                                                          |
| Gezielter Abbruch und Wiederaufnahme von E                    | Genau ein bestätigter Teilschritt wiederverwendet; erste Ausgabe einschließlich Änderungszeit unverändert; keine doppelten Dateien                                                |
| Unklare Journalbestätigung nach atomarem Rename               | Wiederaufnahme abgelehnt; Original und bereits publiziertes Ziel unverändert erhalten                                                                                             |
| 1000 kleine CSV-Dateien                                       | 53.000 Eingabebytes; 2.000 bestätigte Ausgabe- und Archivdateien; alle SHA-256-Vergleiche korrekt; 17,265 Sekunden Enginezeit                                                     |
| Wiederholte Fixture-Erzeugung                                 | XLSX, DOCX, Text-PDFs, Raster-PDF und CSVs bytegleich                                                                                                                             |
| Titelgestaltung nach dem Word-Bildbefund                      | Blaue Titelränder aus Vorlage und Basistilen entfernt; schwarz, ohne Unterstreichung. Neuer vollständiger CDE-Lauf erfolgreich, gezielter Reproduktionstest 1/1 in 0,506 Sekunden |
| PDF-Bildprüfung D                                             | Beide Ablage-PDFs und der Raster-Scan bei 110 dpi mit Poppler gerendert und alle drei PNGs angesehen; Beschriftungen vollständig und ohne Überlagerung                            |

Die Laufnachweise liegen im ignorierten Artefaktverzeichnis:

- `artifacts/business-beispiele/20261026-233645-19afd26b/pruefung.json`, SHA-256 `3d1355dcb94662708cac14c0e931bf3f5ef0ae5efe0d931a9caae80e923727f9`.
- `artifacts/business-beispiele/20261026-234045-c05fb699/fachtests.json`, SHA-256 `75bcb852bafb8d801b509a8554ede098972e5fc3294d3fad4ca4f152717eec04`; der gleichnamige `-stderr.txt`-Begleitbericht enthält alle neun Testnamen und die echte Testdauer.
- `artifacts/business-beispiele/20261026-234233-fe7eb4ad/pruefung.json`, SHA-256 `4ca2ed1f1c0f2006ca4ceac68cfcccaae0f5f954a07215052fd7c14d2d0ac696`; erneuter vollständiger CDE-Lauf nach bereinigter DOCX-Titelvorlage, ohne Wiederholung des unveränderten Benchmarks.

Nach dem ersten Lauf wurde genau ein neuer isolierter Ressourcenlauf ohne C/D/E-Vorläufe durchgeführt. Er verarbeitete dieselben 1.000 synthetischen CSV-Dateien mit 53.000 Eingabebytes in **15,488 Sekunden** einschließlich Kontext- und Samplerabschluss. Alle 2.000 Ausgabe- und Archivdateien wurden vollständig per SHA-256 gegen die Quellen geprüft. Der neue Lastnachweis liegt sanitisiert und ohne Benutzer-/Interpreterpfade unter [nachweise/business-stapel.json](nachweise/business-stapel.json). Er enthält die tatsächlichen Quellenhashes, elf Paketversionen und folgenden Messumfang:

| Messwert                           | Tatsächlich erfasst                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| CPU                                | 13th Gen Intel Core i7-13700, 24 logische Prozessoren                          |
| Physischer RAM laut Windows        | 68.333.776.896 Bytes, rund 63,641 GiB                                          |
| Zielumgebung                       | Windows-Build `10.0.26200`, x64, CPython 3.12.6                                |
| Eigener OS-Working-Set-Peak        | 44.675.072 Bytes, rund 42,605 MiB; seit Beginn dieses isolierten Prüfprozesses |
| Beobachtetes Private-Bytes-Maximum | 33.910.784 Bytes, rund 32,340 MiB                                              |
| Beobachtetes Temp-/Staging-Maximum | 53 Bytes; Kontexttemp 0 Bytes, Zielstaging 53 Bytes                            |
| Stichproben                        | 443; 25 ms Sollabstand, größte tatsächlich beobachtete Lücke 46,531 ms         |
| Feste Grenzen                      | 120 s Kontextfrist, 4 GiB Kontexttemp, 3.000 Ausgaben; 170 s äußerer Job       |

Diese Messung betrifft kleine synthetische Dateien auf dem Entwicklungsrechner. Sie ist keine allgemeine Geschwindigkeits- oder Speicherzusage. Der OS-Working-Set-Peak betrifft den eigenen Python-Prüfprozess einschließlich seiner Initialisierung, nicht den gesamten Rechner oder andere Anwendungen. Temp und Private Bytes sind beobachtete Maxima aus Stichproben, keine garantierten absoluten Peaks. Windows-Dateicaches wurden nicht geleert und Systemeinstellungen nicht verändert. Der neue Lastjob prüft keine Dokumentansicht; die Dokument- und Bildprüfungen sind separat erfasst.

Die PDF-Seiten aus D wurden auch visuell geprüft. Bei Poppler gemeldete fehlende Displayfonts `Symbol` und `ArialUnicode` betreffen die verwendeten Helvetica-/Rasterinhalte nicht; die tatsächlichen PNGs wurden kontrolliert. Das bereinigte C-Ergebnis wurde gesondert in einer eigenen unsichtbaren Word-Instanz als PDF gerendert, bei 110 dpi in PNG umgewandelt und vollständig angesehen: eine Seite, schwarzer Titel ohne Linie, keine abgeschnittenen Spalten oder Texte, zwei Positionen mit 15 und 12 und Gesamtsumme 27. Ein Screenshot liegt unter [bilder/business-bestellvorschlag.png](bilder/business-bestellvorschlag.png). Der eigene QA-Renderaufruf liegt in `scripts/business-docx-rendern.ps1`; er ist kein Produktadapter.

## Grenzen

Das Beispiel C löst keine tatsächliche Bestellung aus. Ein Bestellvorschlag ersetzt keine fachliche Freigabe. Der Scan in D belegt nur die Erkennung einer fehlenden Textschicht; OCR ist nicht implementiert. Der CSV-Dateistapel behandelt einzelne Dateien vollständig, verspricht aber keine gemeinsame Transaktion über alle Dateien. Bereits bestätigte Ausgaben bleiben bei einem späteren Fehler oder Abbruch bestehen. Bei unklarem Journalzustand ist eine bewusste Prüfung der tatsächlichen Dateien erforderlich.

Die dokumentierte Bildprüfung verwendete eine eigene, unsichtbare Word-Instanz ausschließlich mit generierten Prüfdateien und Poppler für PNG-Seiten. Das ist eine QA-Hilfe und kein Office-Produktadapter. Inhaltsassertions, ZIP-/XML-Prüfungen und extrahierter PDF-Text allein belegen keinen fehlerfreien Seitenumbruch.
