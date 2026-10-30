# Qualitätsdurchgang ScriptLab, 30. Oktober 2026

Dieser Durchgang verbessert das vorhandene Windows-Produkt. Keine neuen Bausteine, Geschäftsmodule, Cloudinfrastruktur oder UI-Komplettbibliothek. Marke ScriptLab, Entwickler Leon Stolz, Python als Hauptsprache und bestehendes VBS bleiben erhalten. Erfasst wurden alle wesentlichen Bereiche und ihre Übergänge, nicht jede Codezeile oder Kombination.

Ausgangspunkt: `main`, sauberer Arbeitsbaum bei `fa6b208693df72de93467e6d6f169b3de24a46a6`, Remote `https://github.com/siggismalz/ScriptLab.git`. Änderungen entstanden im gemeinsamen Arbeitsbaum mit getrenntem Dateibesitz; ausschließlich der Hauptagent führt Integration, Commits und Push aus. Keine fremde uncommittete Arbeit war vorhanden.

## Ergebnis und behobene Probleme

| Befund | Vorher und Auswirkung | Umgesetztes Verhalten und Nachweis |
| --- | --- | --- |
| DATA-01/03 | XLSX-Zellwerte und explizite Formeln über 32767 Zeichen wurden still gekürzt und erfolgreich veröffentlicht | Früher verständlicher Fehler vor Veröffentlichung; Originalvorlage und vorhandenes Ziel bleiben unverändert. Grenzwerte mit echtem XLSX-Readback geprüft. Keine Behauptung einer Formelberechnung. |
| DATA-02 | Eingesetzte Word-Positionswerte wie `{{Kunde}}` wurden erneut als Vorlage ausgewertet | Ersetzung einmal pro wirklichem XML-Absatz, auch bei verbundenen Zellen und geteilten Kopf-/Fußzeilen. Eingesetzte Werte bleiben Daten; tatsächliche DOCX-Inhalte erneut gelesen. |
| SCALE-01 | Flache Folgen über ungefähr 150 Schritte trafen die Verschachtelungsgrenze; lange Ketten scheiterten zusätzlich an Kopier-/Transporttiefe oder eingerückter Dateigröße | Iterative Strukturprüfung und JSON-Ausgabe, kompakte Projekt-/Entwurfsdateien, feste IPC-Methoden transportieren JSON-Text. Reale lineare und verzweigte 1000-Block-Workflows bearbeitet, gespeichert, erneut geladen, exportiert und ausgeführt. Grenze und verbleibender Fehler unten. |
| RUN-01 | Jeder Listenindexzugriff kopierte zuvor die ganze Liste | Python und VBS lesen direkt und erhalten die Kopiersemantik des gewählten Eintrags. Native Ergebnis-/Fehlerproben und vergleichbare Vorher-/Nachhermessung. |
| CI-01 | Erlaubte VBS-Ausgabepfade mit Windows-8.3-Basisnamen wurden als extern abgewiesen | Vergleich vorhandener Vorfahren über dieselbe kurze Pfadidentität; tatsächlicher Zielpfad unverändert. Erlaubte Ziele funktionieren; externe Ziele, Nachbarpräfixe und Junctions bleiben abgewiesen. |
| UX-01 | Shift+Tab aus dem Workflowmenü landete auf einem inaktiven Reiter | Menüausstieg berücksichtigt negative Tabindizes, deaktivierte und inerte Elemente. Echter Tastaturtest in beiden Themen bei 200% Text. |
| UX-02 | Nach Workflowwechsel sprang die Liste um 37 px; manuelles Aktualisieren verlor den Tastaturfokus | Scrollstand erst nach Ladeende wiederherstellen, Ladezwischenstände ignorieren. Nur der ausdrücklich verwendete Aktualisierungsknopf erhält bei sonst leerem Fokus seinen Fokus zurück. Strenger Test ohne erhöhte Toleranz: 987→987 px. |
| UX-03 | Datenvorschauknopf wurde bei 200% Text auf 36 px gestaucht | Lokale Flexregel erhält die natürliche gemeinsame Knopfhöhe: 52 px, Text vollständig sichtbar. Beide vorhandenen Fenstergrößentests bestanden. |
| QA-01–04 | Vorbestehende Tests erwarteten alte Titel, Menüs, externe Speicher-/Laufordner oder untersuchten den falschen Ergebnisbereich | Tatsächliche heutige Bedienwege und interne Speicherung prüfen; Projektdateiexport bleibt separat abbrechbar. Fachliche Sollwerte, Originalschutz, Fristen und Geometrietoleranzen erhalten. |

Details zu Reproduktion, Priorität, Dateien und Abnahme stehen in [ARBEITSPLAN.md](ARBEITSPLAN.md). Die Systemübersicht steht in [BESTAND.md](BESTAND.md). [BAUSTEINREGISTER.md](BAUSTEINREGISTER.md) erfasst alle 95 registrierten Typen: 48 gemeinsame Python-/VBS-Typen und 47 Python-Businesstypen, jeweils mit Eingaben, Ausgaben, Seiteneffekten und Testreferenzen. Das Register kennzeichnet ausdrücklich, dass Textreferenzen keine einzeln durchgeführten Laufzeitprüfungen jeder Variante belegen. Dialogtypen erhielten keine neue vollständige native Dialogabnahme.

## Architektur und Bedienung

Schema 3, Block-IDs, Sprachmigrationen und Generatorbedeutung bleiben erhalten. Vorschau, Speichern, Ansichtswechsel und Export starten keinen Workflow. Große positive Desktopfälle vergleichen Vorschau und Export und führen das exportierte Python-Skript nach dem Ende der Anwendung eigenständig aus.

Main, Preload und Renderer bleiben getrennt. Die bestehende feste Oberfläche umfasst 44 IPC-Kanäle; es gibt keinen allgemeinen Renderer-Shellzugriff. Transporttext umgeht nachgewiesene Tiefengrenzen der nativen Objektkopien. Main prüft Absender und das unveränderte 5-MiB-UTF-8-Budget vor dem Parsing; anschließend gelten dieselben fachlichen Validatoren. Die Renderer-Fassade ist typisiert und eingefroren. Der iterative Serializer akzeptiert ausschließlich reine JSON-Daten; gemeinsame Referenzen bleiben wertgleich, Zyklen und fremde Objekttypen werden abgewiesen. Neue Methoden, ein Formatwechsel oder eine allgemeine Prozess-Sandbox werden dadurch nicht eingeführt.

Vor vollständigem Blockly-Laden/Entsorgen werden lange Folgeverbindungen bei deaktivierten Ereignissen von unten getrennt; bestehende Undo-/Redo-Wege bleiben geprüft. Die vorhandene Navigation mit erhaltenem Workspace, Palette, Eigenschaften, Daten und Läufen bleibt bestehen. Die UX-Korrekturen sind lokale Verhaltens- und Layoutverbesserungen. Gemeinsame Komponenten und Petrol-/Grün-/Grautokens reichen dafür aus; ein Bibliothekswechsel hätte keinen belegten Nutzen. Keine neue Bibliothek oder Abhängigkeit wurde eingeführt. Historische Architektur-/Versions-/Farbtexte sind als veraltet gekennzeichnet oder an den tatsächlichen Bestand angepasst.

## Umfangsgrenze und offene Fehler

**Maximal 1000 Bausteine insgesamt und 150 echte Verschachtelungsebenen.** Folgen über `next` erhöhen nicht mehr fälschlich die Verschachtelung. Einfügen und Laden verwenden dieselbe zentrale Gesamtgrenze. Größere Projektdateien werden verständlich abgewiesen; Originaldatei und aktueller Workflow bleiben erhalten.

Lineare **und verzweigte 2000-Block-Workflows blockierten den Renderer beim erneuten Laden** auch nach Transportkorrekturen. Main blieb dabei ansprechbar; die genaue native Ursache ist nicht abschließend geklärt. Ein zusätzlicher Pfadtiefencheck oder ConnectionChecker löste das Problem nicht und wird nicht ausgeliefert. Die Gesamtgrenze ist gegenüber dem zuvor nur theoretisch angebotenen 2000er-Maximum ausdrücklich niedriger. Die positive End-to-End-Abnahme gilt für 1000, die beiden 2000er Regressionen prüfen ausschließlich sichere frühe Ablehnung. Weitere Skalierung steht mit Begründung im vorhandenen [Backlog](../UMSETZUNG.md).

Weitere Grenzen:

- Einzelne kurze VBS-Testläufe erreichten während der parallelen Fachsitzungen 7-/10-s-Fristen. Isolierte Proben und die spätere zentrale Suite mit einem Worker bestanden ohne Fristanhebung. Ursache offen; keine nachgewiesene Behebung sämtlicher Timingprobleme.
- Fünf optionale Legacy-Business-Installationsfälle sind in der Modulsuite übersprungen: Prüfung der vorhandenen externen Business-Laufzeit, falscher Wheelhash, zu großes Wheel, Offline-Wheelhouse und Abbruch der venv-Einrichtung. Der eigenständige venv-Exportnachweis wurde ausgeführt.
- Keine UNC-/Netzlaufwerks- oder Unternehmensrichtlinienprüfung, keine echte Anwenderstudie. Native Tests verwenden kontrollierte synthetische Daten.
- Kein Installations-/Deinstallations- oder produktiver Updatevorgang; kein Release veröffentlicht. Ein entpackter Paketstart ist davon getrennt. Vorhandene Signatur-/Release-/Updateverträge bleiben erhalten.
- Kein OCR-Nachweis, keine Excel-Formelberechnung, keine automatische Rückabwicklung bereits veröffentlichter Dateieffekte. Kein unbegrenztes Skalierungs- oder SaaS-Reifeversprechen.
- Vite meldet weiterhin das bestehende große Rendererbündel von rund 1,5 MB unkomprimiert. Keine behauptete Bündeloptimierung.

## Team und unabhängige Kontrolle

Drei echte Fachagenten arbeiteten parallel und anschließend in getrennten QA-Runden:

- **Bedienung:** Produkt/UX/Frontend, Menüfokus, reale Windowsbedienung; anschließend Desktopnavigation, Clipboard und Listen-/Fokusreview.
- **Ausführung:** Grundblockverträge, ausdrücklich Python **und VBS**, Generatoren/Listenleistung; anschließend unabhängige Dokument-, Projekt-/IPC-Reviews und Laufzyklus-Desktoptests.
- **Businessdaten:** bestehende Datei-/Tabellen-/Office-/PDF-Operationen, Dokumentfehler; anschließend Windows-Pfadkorrektur und Business-Desktoptests einschließlich unabhängiger Layoutkontrolle.
- **Hauptagent:** Architektur, gemeinsame Typen/IPC/Projektprüfung/Styles/Navigation, Priorisierung, Integration, eigene Nachprüfungen, Lasttests, Paket und sämtliche Git-Aktionen.

Ausgefüllte Aufträge, Dateibesitz und Fortsetzungspunkte stehen in [AGENTEN.md](AGENTEN.md), Ergebnisberichte in `agent-*.md`, unabhängige Kontrollen in `review-*.md`. Fachliche Dokumentänderungen, Listensemantik, Pfadgrenzen, Projektformat-/Transportannahmen und die späteren UI-Fixes wurden zusätzlich durch andere Agenten gelesen beziehungsweise unabhängig nachgeprüft. Ein Agentenbericht ersetzt keine zentral ausgeführte Integration.

## Tatsächliche Prüfungen

Umgebung: Windows 11 Pro x64, Build 26200, Node 24.19.0, npm 11.17.0; Electron 45.0.0, React 19.3.1, Blockly 13.4.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1. App-Bündel CPython 3.15.2 samt Tcl/Tk und elf festgelegten Business-Paketen. Die umfangreiche optionale native Modulsuite und der Dateistapelbenchmark verwendeten den vorhandenen getrennten Business-venv mit CPython 3.12.6. Kein externes Python ersetzt die App-Laufzeit.

Geprüfter integrierter Produktstand bis `a640b81`, Desktopmigration in `34dd386` und die dokumentierten Testpräzisierungen. Typprüfung und Build wurden nach Integration erneut erfolgreich ausgeführt. Rohberichte bleiben lokal unter `artifacts/qualitaet-*` beziehungsweise `artifacts/desktop-ergebnis.json`; dauerhafte Messwerte stehen in [MESSWERTE.json](MESSWERTE.json).

| Befehl / Umfang | Tatsächliches Ergebnis |
| --- | --- |
| Ausgang `npm run check` | Bestanden |
| Ausgang `npm test` | 571 bestanden, 2 fehlgeschlagen, 51 übersprungen; getrennt in BESTAND dokumentiert |
| Abschluss `npm run check` | Bestanden |
| `SCRIPTLAB_RUNTIME_TESTS=1`, `SCRIPTLAB_BUSINESS_TESTS=1`, Interpreter auf bestehenden Business-venv, `npm test -- --reporter=json --outputFile=artifacts/qualitaet-abschluss-vitest-sauber.json` | **661 bestanden, 0 fehlgeschlagen, 5 übersprungen**, 666 Fälle; native Python/VBS-/Exportnachweise eingeschlossen |
| Gebündeltes Python `-B -m unittest discover -s tests/business -p 'test_*.py' -q` | **143/143 bestanden**, 8,436 s; tatsächliche Office-/PDF-/Daten-/Dateiprüfungen einschließlich sechs neuer Dokumentregressionen |
| UI-nahe Module Startbereich, Gestaltung, Datenbereich und Businessbedienung nach letzten Produktfixes | **87/87 bestanden** |
| `npm run test:e2e`, ein Worker, alle Fachsitzungen beendet | **124 bestanden, 0 fehlgeschlagen, 0 flaky, 2 optionale Lastfälle übersprungen**, 370,059 s |
| Arbeitsstand-Schutzdatei nach ergänztem unabhängigen Bytevergleich erneut vollständig ausgeführt | **4/4 bestanden**, 13,5 s |
| `SCRIPTLAB_LAST_TESTS=1`, `npx playwright test tests/desktop/business-last.spec.ts --workers=1` | **2/2 bestanden**, 14,1 s; bewusst gesonderter Millionentestlauf |
| `python -I -B scripts/business-beispiele-pruefen.py --nur-benchmark --benchmark-dateien 1000` im bestehenden Business-venv | Bestanden: 1000 Eingaben, 2000 veröffentlichte/archivierte Dateien, alle Hashes korrekt, mitgelieferte Beispielquellen unverändert |
| Prettier für geänderte Code-/Testdateien, `git diff --check`, Syntaxprüfung neuer JS-Prüfhelfer | Bestanden; kein eigenständiges Lintskript vorhanden |
| `npm run build` | Bestanden; Host-/Pythonmanifest geprüft, bestehende Bündelgrößenwarnung |
| Entpackter Paketstart mit `scripts/qualitaet-paket-pruefen.mjs` | Bestanden: echtes isoliertes Profil und Paketidentität, kein externes Python im PATH, Python/Tk bereit, elf passende Pakete, Schreibworkflow Exit 0 und unabhängiges UTF-8-Readback |
| NSIS x64 ohne Veröffentlichung, `npm run verify:package -- release/qualitaet-vorab-34dd386`, anschließender entpackter Paketstart | **13 Paketprüfungen bestanden, 0 offen, 0 fehlgeschlagen**; Installer-/Metadaten-/Ressourcen-/Updateprüfsummen geprüft, danach Paketworkflow erneut bestanden und eigenes Prozessende bestätigt |

Der vollständige Desktoplauf beinhaltet Öffnen/Ändern/Speichern/Wiederladen, Schema-/Spracherhalt, Originalschutz und Konfliktkopien, bewusste Ausführung des ungespeicherten Stands, Start-/Stop-/Timeout-/Fehlerfälle, Navigation ohne Laufstart, echte Daten-Sollwerte sowie 1000-Block-Rundläufe und sichere Ablehnung zu großer Projekte. Geprüft sind 1280×720 und größere Fenster, lange Texte/Pfade, beide Themen, 100/200% Text, Tastatur und vorhandene Maus-Ziehalternativen. Prozessweise simulierte DPI 100/125/150/200% ist von einer echten Änderung der Windows-Anzeigeeinstellungen getrennt. Technische UI-Tests sind keine Anwenderstudie.

Abgebrochene und fehlgeschlagene Zwischenläufe bleiben in Fachberichten erhalten. Testproduzierte Python-Caches wurden aus dem manifestgeprüften lokalen Bündel reversibel in einen ignorierten Quarantäneordner verschoben; anschließende saubere Manifest-/Modulprüfungen bestanden. Keine Tests abgeschwächt, um Zwischenfehler zu verdecken.

Die Installerprüfung ist von der Paketstartprobe getrennt. Sie entpackt den NSIS-Payload nicht unabhängig und installiert die Anwendung nicht. App und Installer dieses lokalen Testbuilds sind mangels konfiguriertem Zertifikat **nicht signiert**; die Originalsignaturen der gebündelten Pythondateien bleiben erhalten. Der fertige Abschlussbuild wird nach den Nachweisedits erneut in einen eigenen `release/qualitaet-abschluss-*`-Ordner gebaut, verglichen und mit demselben Prüfhelfer gestartet. Dadurch bleibt der mitgelieferte Dokumentationsbestand dem jeweiligen Paket zugeordnet; Paketberichte mit Hashes liegen beim jeweiligen lokalen Build, nicht selbstbezüglich in dessen eingebetteter Dokumentation.

## Messungen und ihre Bedeutung

Identische synthetische Listenhelferfälle, je 250 skalare Zugriffe und drei Wiederholungen auf CPython 3.15.2: Median bei 100 Einträgen **1,341→0,515 ms**, 10000 **68,528→0,491 ms**, 100000 **823,202→0,491 ms**. `tracemalloc`-Spitze eines Einzelzugriffs auf 100000 Einträge **801664→736 Bytes**. Ergebnisprüfsummen identisch. Dies misst den Helfer, nicht den gesamten Workflow. VBS bei 100000 Einträgen: Median **234,375 ms→unter Timerauflösung**; Nachwerte 7,8125/0/0 ms, deshalb kein genauer Beschleunigungsfaktor.

1000-Block-Projekt: eingerückte JSON-Darstellung **18176283 Bytes**, kompakte Darstellung desselben Inhalts **99150 Bytes**. Das reduziert das durch Einrückung verursachte Wachstum; die reine Projektprüfung ist nicht als beschleunigt belegt. Kleine, mittlere und große Fälle sowie Rohwiederholungen stehen im Messwertbericht. Editorbedienbarkeit wird zusätzlich durch die realen Desktopfälle belegt.

Millionendatentest, ein gemessener Durchlauf: Nord **500000 Zeilen**, Summe **1000000** unabhängig geprüft, Originalquellen unverändert; UI-gemessene Gesamtdauer einschließlich Vorbereitung und Ergebnisprüfung **6031,627 ms**, Zoomreaktion **96,352 ms**, Verschieben **185,046 ms**. Separater Stoppfall: bestätigtes Ende nach **1091,966 ms**, Zustand abgebrochen, bereits veröffentlichtes Ergebnis hashgleich erhalten, Editor wieder bearbeitbar. Keine Rückabwicklung behauptet.

1000-Datei-Benchmark: **10,478 s** für 53000 Eingabebytes und 2000 Ausgaben/Archive, OS-Working-Set-Peak des eigenen Prüfprozesses **44720128 Bytes**; maximal beobachtete Private Bytes **33878016**, Staging **53 Bytes**, 312 Stichproben bei 25-ms-Sollabstand (maximal beobachtet 47,013 ms). Die mitgelieferten Beispielquellen bleiben unverändert; die 1000 synthetischen Eingangsdateien werden entsprechend dem angebotenen Archivierungsablauf erst nach bestätigtem Archiv entfernt. Stichproben können kurzlebige Spitzen übersehen. Diese Lastwerte sind Beobachtungen am jetzigen Stand, ohne Vorhervergleich und ohne behauptete Beschleunigung.

## Git und Auslieferungsstatus

Alle abgeschlossenen Pakete wurden mit kurzen deutschen Nachrichten auf `main` committet und nach `origin/main` gepusht:

| Commit | Paket |
| --- | --- |
| `034d76e` | Projektbestand und priorisierte Qualitätsaufträge dokumentiert |
| `ce30c02` | Prüfungen an aktuelle Sprachwahl und Laufberichte angepasst |
| `6d75048` | Stille Kürzung und Mehrfachersetzung in Dokumenten verhindert |
| `f954cf5` | Listeneinträge in Python und VBS ohne Gesamtkopie gelesen |
| `f91bec5` | Tastaturfokus beim Verlassen von Menüs berichtigt |
| `88dee7d` | Kurze Windows-Pfade bei erlaubten VBS-Ausgaben berücksichtigt |
| `3bf7da6` | Große Workflows sicher laden und übertragen |
| `d14cd26` | Listenposition nach dem Workflowwechsel erhalten |
| `eab81c9` | Fokus nach dem Aktualisieren der Workflowliste erhalten |
| `a640b81` | Datenvorschau bei großer Schrift lesbar gehalten |
| `34dd386` | Desktopprüfungen an aktuelle Bedienabläufe angepasst |

Weitere abschließende Test-/Nachweiscommits stehen in der Git-Historie. Kein Force-Push, kein Versionssprung, kein Tag und kein Release. Remoteprüfungen vor der Desktopmigration scheiterten an den dokumentierten alten UI-Erwartungen; die native Modulsuite und der Build waren dort bereits erfolgreich. Neuere Windows-CI läuft je Push erneut. Ein lokal bestandener Test ist kein Beleg für eine bereits grüne Remote-CI; der aktuelle Abschlussstatus wird ausdrücklich separat gemeldet.
