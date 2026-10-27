# Business-Prüfstand für ScriptLab 0.2.0

Stand: 27. Oktober 2026. Geprüfter Funktionscommit: `2f10accef0bb06516387d4485bd19e9b38ff29b3`. Danach wurden ausschließlich Abnahmenachweise ergänzt. Der [bereinigte Abschlussnachweis](nachweise/business-abschluss.json) enthält Berichtsprüfsummen, Installeridentität und getrennte lokale beziehungsweise CI-Ergebnisse. Das ist keine produktive Releasefreigabe.

## Umgesetzter Umfang

Python bietet 47 Business-Bausteintypen zusätzlich zu den 48 gemeinsamen Python-/VBS-Grundbausteinen: CSV, XLSX, JSON und Parquet; typisierte Transformationen, Filter, Verknüpfungen, Gruppierung und Qualitätsregeln; Dateiablage und ZIP; XLSX-Vorlagen, DOCX und PDF. Parameter, Testdaten-/Echtdaten-Sätze, Projektformat 3, lokale Entwürfe, Quellenidentitäten, Laufberichte, Journal und bewusstes Fortsetzen sind angebunden. Ein fester Paketsatz versorgt Editorläufe und eigenständige Business-Exportpakete.

Strukturprüfung, Datenvorschau, Prüflauf und echte Ausführung haben getrennte Zusagen. Öffnen, Wiederherstellen, Bearbeiten, Codevorschau, Speichern und Export starten keine Verarbeitung. Die Bedienung erklärt [BUSINESS-BEDIENUNG.md](BUSINESS-BEDIENUNG.md).

## Tatsächliche Abschlussprüfungen

Lokale Umgebung: Windows 11 Pro x64, Build 26200, Intel Core i7-13700 mit 24 logischen Prozessoren, 68.333.776.896 Byte RAM, CPython 3.12.6. Paketversionen stehen in der [Laufzeitdokumentation](BUSINESS-LAUFZEIT.md).

| Prüfung                                                                      | Tatsächlicher Abschluss                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Typprüfung und Produktionsbuild                                              | Erfolgreich                                                                                             |
| Python-Fachtests                                                             | **131/131**, 0 ausgelassen, 7,842 s; `artifacts/business-python-geprueft.log`                           |
| Vitest mit allen lokalen Windows-/Setup-Freigaben                            | **496/496**, 0 ausgelassen; `artifacts/business-windows-finaler-stand.json`                             |
| Vollständiger Electron-Desktoplauf einschließlich freigeschalteter Lastfälle | **116/116**, 0 ausgelassen, 0 instabil, 258,037 s; `artifacts/business-desktop-finaler-stand.json`      |
| Eigenständige Business-Pakete                                                | Alle fünf generierten Beispielpakete außerhalb von Electron ausgeführt; 17/17 Paketfälle im Vitest-Lauf |
| Installer und Updatemetadaten                                                | **12/12** Paketprüfungen, 0 offen; `artifacts/business-build-020/pruefung.json`                         |

Die [Windows-CI für denselben Funktionscommit](https://github.com/siggismalz/ScriptLab/actions/runs/40495080476) ist ebenfalls grün. Mit CPython 3.15.2 bestanden dort 131 Python-Fachtests, 492 Vitest-Fälle und 114 Desktopfälle sowie Build, NSIS-Bau und zwölf Paketprüfungen. Vier ausdrücklich freizugebende Setup-/Wheelhouse-Fälle und zwei zusätzliche Millionenlastfälle wurden in CI ausgelassen; diese Fälle liefen lokal mit Freigabe. Eine vollständige praktische Versionsmatrix für Python 3.13 und 3.14 wird dadurch nicht behauptet.

Die nominelle VBS-Frist normaler Integrationsproben wurde nach beobachteten Verzögerungen vor dem ersten festen Scriptmarker von zehn auf 30 Sekunden angehoben. Gezielte Ein-Sekunden-Zeitlimittests und Produktionsprofile blieben unverändert. Frühere fehlgeschlagene Zwischenberichte bleiben eigenständige Arbeitsnachweise.

## Fünf Geschäftsbeispiele

| Beispiel                    | Praktisch geprüfte Erwartungen                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monatliche Auswertung       | Drei Oktoberzeilen; Nord 150, Süd 80, Gesamt 230 in XLSX und PDF                                                                                   |
| Bestellungen mit Stammdaten | Drei Zuordnungen, K9 als Fehler; Nord 45, Süd 40, Gesamt 85; doppelter K1 verhindert Vervielfachung                                                |
| Word-Bestellvorschlag       | Ein S1-Dokument, Positionen 15 und 12, Summe 27, keine offenen Platzhalter                                                                         |
| Dokumenteingang             | Zwei korrekt benannte, bytegleiche PDF-Kopien; ein Scan-Hinweis; Originale unverändert                                                             |
| Dateistapel                 | Gültige Ausgaben und Archive; fehlerhafte Quelle bleibt; Abbruch/Fortsetzen ohne doppelte bestätigte Ergebnisse; unklarer Journalzustand blockiert |

Alle Eingaben sind mitgelieferte synthetische Dateien. Die Beispiele wurden auch als erzeugte `.scriptlab`-Workflows und als eigenständige Exportpakete geprüft. [Datenbeispiele und Lasten](BUSINESS-LEISTUNG-DATEN.md) sowie [C/D/E-Prüfungen](BUSINESS-BEISPIELE-PRUEFUNG.md) beschreiben Details und Reproduktion.

## Lasten und Reaktionsverhalten

| Last                                                  | Verifiziertes Ergebnis                                                                                | Enginezeit | Prozess-Peak-Working-Set |                        Beobachteter temporärer Höchststand |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------: | -----------------------: | ---------------------------------------------------------: |
| Eine Million CSV-Zeilen, schmales 64-MB-DuckDB-Profil | 500.000 ausgewählt, kontrollierter Join, Sortierung, vier Gruppen, Gesamt 625.000,00, Parquet geprüft |    4,788 s |         127.074.304 Byte | 72.888.320 Byte, davon 72.876.032 Byte tatsächlicher Spill |
| XLSX, 50.000 Datenzeilen und sechs Spalten            | Rundlauf, Gesamtsumme 62.500,00, Kennungen und Texte erhalten                                         |   19,402 s |          80.809.984 Byte |                                            22.508.359 Byte |
| 1.000 kleine CSV-Dateien                              | 2.000 Ausgabe-/Archivdateien vollständig per SHA-256 geprüft                                          |   15,488 s |          44.675.072 Byte |                               53 Byte im Stichprobenumfang |

Der [Datenmessnachweis](nachweise/business-daten.json) und [Stapelmessnachweis](nachweise/business-stapel.json) enthalten Datenmengen, Versionen, Berichtshashes und Messgrenzen. Private Bytes und temporäre Dateien wurden stichprobenartig erfasst; kurzlebige Spitzen können fehlen. Das breite Millionenprofil scheiterte unter 64 MB weiterhin. Der erfolgreiche schmale Plan besitzt ein anderes, ausdrücklich dokumentiertes Ergebnisschema. Das Enginebudget ist keine harte RAM-Grenze des Python-Prozesses.

Zwei zusätzliche Millionenzeilenläufe im Editor prüften echte Verarbeitung und Bedienung: ungespeicherte Quelle, 500.000 Nord-Zeilen und Summe 1.000.000. Zoom und Verschieben reagierten während eines bestätigten laufenden Imports. Stoppen nach bestätigter Ausgabe erhielt die Datei und gab den Editor wieder frei. Der [erste getrennte Last-UI-Nachweis](nachweise/business-ui-last.json) hält seine eigenen Messwerte fest; der Abschlussnachweis enthält den anschließend erneut bestandenen vollständigen Desktoplauf. Das sind keine allgemeinen Latenz- oder Speichergarantien.

## Dateien, Dokumentansicht und Gestaltung

Geprüft sind unter anderem veränderte Quellen, Zielkonflikte, echte Windows-Exklusivsperre, Abbruch, Zeitlimit, Teilerfolg, ungeklärte Publikation und Wiederaufnahme. ENOSPC, verweigerte Speicherinformationen und unterbrochene Quellzugriffe wurden gezielt injiziert. Ein tatsächlich voller Datenträger, ein erschöpftes Dateisystemkontingent und eine reale SMB-Unterbrechung wurden nicht herbeigeführt. Technische Originalfehler bleiben im Bericht zugänglich.

Die Monats-PDF, alle drei Eingangs-PDFs und der Word-Bestellvorschlag wurden gerendert und angesehen. Die Word-Ansicht enthält die Positionen 15 und 12, Summe 27 und einen schwarzen Titel ohne Linie. Alle fünf Seiten eines zusätzlichen PDF-Berichts mit 101 Zeilen und einer 90-zeiligen Zelle wurden mit Poppler gerendert und angesehen: Umbrüche, wiederholte Köpfe, Seitenzahlen und als Daten behandelter HTML-artiger Text. [Sichtnachweis](nachweise/business-pdf.json), [Seite 2](bilder/business-pdf-seite-2.png), [Seite 3](bilder/business-pdf-seite-3.png) und [Word-Ansicht](bilder/business-bestellvorschlag.png). Word wurde ausschließlich als QA-Renderer verwendet.

Die UI-Prüfungen verwenden 1280 × 720 und 1600 × 1000 logische Pixel sowie prozessweise DPI-Faktoren 100/125/150/200 Prozent. Bei 150 Prozent wurden tatsächlich 1280 × 721 beziehungsweise 1600 × 1001 gemessen. Vergrößerter UI-Text wurde getrennt vom Canvas-Zoom geprüft. **Die globale Windows-Skalierung wurde nicht umgestellt.** Narrator und eine Testperson ohne Programmierkenntnisse bleiben offen. DOM- und Bildprüfungen belegen keine vollständige Barrierefreiheit.

## Installer, Release und verbleibende Grenzen

Der lokale NSIS-Testinstaller heißt `artifacts/business-build-020/ScriptLab-0.2.0-Setup-x64.exe`. Er wurde aus dem sauberen Funktionscommit gebaut; der Abschlussnachweis nennt Größe und SHA-256. Installer, Anwendung und Testhost haben tatsächlich den Authenticode-Zustand **NotSigned**. Installer/Blockmap/`latest.yml`, gepackter Code, elf Beispiele samt Eingaben, Runtime, Vera-Schrift, Lizenzen und Dokumentbeilagen wurden geprüft. Der Paketcheck ersetzt keine praktische Installation/Deinstallation und entpackt den NSIS-Payload nicht unabhängig.

Es wurde kein produktives Release veröffentlicht. Dafür fehlen weiterhin Entwickler-Signaturinfrastruktur und die praktische Updateprüfung mit zwei installierten signierten Versionen. GitHub stellt den geprüften CI-Testbuild zeitlich begrenzt als Actions-Artefakt bereit. Der spätere Dokumentationscommit verändert weder den gebauten Installer noch den geprüften Anwendungscode.

Weitere feste Grenzen: Vorschau 200 Zeilen/256 KiB; Dokumenttabellen 20.000 Zellen; PDF-Textauszug 256 KiB; PDFs 2.000 Seiten; Journal-Einlesen 16 MiB. Journale und Laufberichte bleiben lokal zur bewussten Prüfung erhalten. Excel-Formeln werden nicht berechnet; OCR, Office-Konvertierung und Cloud-Anbindungen sind nicht enthalten. Quellen-/Ergebnis-/Runtimeidentitäten sind keine allgemeine Genau-einmal-Garantie und kein Rollback. Ein Testdatensatz und der Windows-Job sind keine Dateisystem-Sandbox.

Projektlizenz unverändert `UNLICENSED`. Entwickelt von Leon Stolz. Abhängigkeiten und Vera behalten ihre Original-Lizenzhinweise.
