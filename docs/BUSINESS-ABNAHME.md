# Vorläufige Business-Abnahme für ScriptLab 0.2.0

Stand: 27. Oktober 2026. Diese Notiz fasst vorhandene Nachweise zusammen. **Der abschließende Gesamtprüfstand ist noch offen.** Grüne Teilprüfungen werden weder zu einem erfundenen Gesamtlauf addiert noch als Freigabe des Installers oder einer produktiven Updatekette ausgegeben. README und [Business-Bedienung](BUSINESS-BEDIENUNG.md) beschreiben den implementierten Umfang; sie ersetzen keine Abnahme.

## Belegte Teilprüfungen

| Bereich                           | Tatsächlich vorhandener Nachweis                                                                                                                                                           | Abgrenzung                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gesamt-Unit-/Windows-Zwischenlauf | `artifacts/business-windows-geprueft.json`: 488/488 bestanden, 0 fehlgeschlagen, 0 ausgelassen                                                                                | Grüner vollständiger Lauf am Quellstand `455aaf81d1dec8c2c2fcaa40d8aa39489b0e4188`, vor dem nachfolgenden Daten-Glob-Fix; keine vorweggenommene Prüfung späterer Änderungen.                                                                                                               |
| Business-Exportpakete             | Im Gesamtbericht `tests/business-paket.test.ts`: 17/17 bestanden, 0 ausgelassen                                                                                                            | Eigenständiger Teilumfang; kein Beleg einer installierten App oder eines Releases.                                                                                                    |
| Business-Datenweg im Editor       | Historischer CSV-Editorlauf: 1/1 erwarteter Fall, 0 unerwartete, instabile oder ausgelassene Fälle (Berichtsidentität unten)                                                                                   | CSV über Palette konfigurieren, speichern, Datenvorschau und bewusste echte Ausgabe.                                                                                                  |
| Business-UI-Zustände              | `artifacts/BizStates/ergebnis-zustaende.json`: 12/12 bestanden, 0 fehlgeschlagen, 30,1 s                                                                                                   | Separater Zustandslauf mit 22 PNGs und 22 zugehörigen Messdateien. Zusammen mit dem vorherigen CSV-Fall sind 13 Business-Desktopfälle belegt, kein behaupteter gemeinsamer 13er-Lauf. |
| Beispielkopien                    | Derselbe Zustandsbericht: neue Kennung, private absolute Datenpfade, Speicherabbruch, Speichern in anderem Ordner, Wiederöffnen, Startseite/Weiterbearbeiten und Entwurf nach Neustart     | Originale bytegleich, keine DOCX-Ausgabe und kein Workflowstart durch diese Navigationsfälle.                                                                                         |
| Fachliche C/D/E-Beispiele         | [Beispielbericht](BUSINESS-BEISPIELE-PRUEFUNG.md), Rohberichte unter `artifacts/business-beispiele`: 9/9 Fachtests und ein gesonderter Reproduktionstest nach der Titelkorrektur bestanden | Eigene synthetische Kopien. Konflikt, fehlerhafte Quelle, Abbruch/Wiederaufnahme und unklarer Rename-/Journalzustand geprüft.                                                         |

Der vollständige 488er-Lauf bestand nach einer bewussten Anpassung der nominellen VBS-Integrationsfrist von zehn auf 30 Sekunden. Die ausdrücklich einsekündigen Zeitlimittests blieben unverändert. Frühere Zwischenläufe mit 486/488 beziehungsweise 487/488 und der gezielte VBS-Gegenlauf mit 7/7 bleiben eigenständige historische Berichte; ihre fehlgeschlagenen Fälle werden nicht nachträglich umgedeutet. Der grüne Quellstand liegt vor dem anschließenden Daten-Glob-Fix und ersetzt daher keine abschließende Prüfung späterer Änderungen.

Berichtsidentitäten: grünes Gesamt-JSON SHA-256 `b33eb324be1bf9c8777e382a4c9b944b6719470478e85e23f94011a79bf94be8`; vorheriger 487/488-Bericht `57a9c81f15d32983bf65c003fb3122fcd82dd4ba9eaef79359baec12337b1ad6`; VBS-Gegenlauf `8661494b882afea70835be32ca032aeb20c74c69f350d101c859b154e20a73e9`; historischer CSV-Desktop-Bericht `37395c7fa2b2b3c5d652b17aecb120e0f1e95eec8ac947a0691b0732a28b299f`. Der allgemeine Desktop-Berichtspfad wird bei weiteren Läufen wiederverwendet. Die Rohberichte unter `artifacts` sind lokale, ignorierte Arbeitsnachweise.

## Python-Fachlauf

Nach den PDF- und Dateifehlerergänzungen bestand ein vollständiger Python-Fachlauf mit **117/117 Tests in 7,132 Sekunden**, ohne ausgelassene Fälle. Quelle: `artifacts/business-python-dateifehler.log`, Abschluss `Ran 117 tests in 7.132s` und `OK`, SHA-256 `a3c385877d02386b8641ce56b9e3baf97e7c1d7339a92d9d2124613301fce2d4`. Auch dieser Lauf liegt vor dem nachfolgenden Daten-Glob-Fix. Der frühere vollständige PDF-Fachlauf mit 112/112 in 7,491 s bleibt im eigenen Bericht `artifacts/business-python-final.log` erhalten. Diese Fachprüfungen ersetzen keinen Electron-Gesamt- oder Installertest.

## Umgebung, Gestaltung und Bedienung

Die praktischen Business-Nachweise stammen aus Windows 11 Pro x64, Build 26200, mit CPython 3.12.6. Der feste Paketsatz und seine tatsächlichen Versionen stehen in [nachweise/business-daten.json](nachweise/business-daten.json) beziehungsweise [nachweise/business-stapel.json](nachweise/business-stapel.json). Eine vollständige Business-Versionsmatrix für CPython 3.12 bis 3.15 ist damit nicht belegt.

Der UI-Zustandslauf verwendete pro Electron-Prozess `--force-device-scale-factor` mit 100, 125, 150 und 200 Prozent. Web-Zoom und Canvas-Zoom blieben 1. Bei 100/125/200 Prozent wurden 1280 × 720 und 1600 × 1000 CSS-Pixel gemessen; bei 150 Prozent tatsächlich 1280 × 721 und 1600 × 1001. UI-Text mit Faktor 2 wurde zusätzlich bei den beiden Fenstergrößen geprüft. Der Bericht nennt keine abgeschnittenen Labels und keine äußere Überbreite; eine dokumentierte Auswahl der Screenshots wurde visuell angesehen.

**Die Windows-Systemskalierung wurde dabei nicht umgestellt.** Dies ist keine globale OS-Skalierungsabnahme. Ein vollständiger Narrator-/Screenreader-Durchlauf und eine Prüfung mit einer Testperson ohne Programmierkenntnisse sind offen. DOM-Messungen, Kontrastwerte und visuelle Stichproben belegen keine vollständige Barrierefreiheit.

Die Monatsbericht-PDF-Seite und der Word-Bestellvorschlag wurden gesondert gerendert und als Bilder geprüft. Der Bestellvorschlag ist eine Seite mit schwarzem Titel ohne Linie, lesbarer Tabelle sowie Positionen 15 und 12 und Summe 27. Die beiden Textbelege und der echte Raster-Scan aus D wurden ebenfalls gerendert und angesehen. Die Nachweise stehen in [BUSINESS-LEISTUNG-DATEN.md](BUSINESS-LEISTUNG-DATEN.md) und [BUSINESS-BEISPIELE-PRUEFUNG.md](BUSINESS-BEISPIELE-PRUEFUNG.md). Das Word-Rendering ist eine QA-Hilfe, kein Produktadapter für Office-Konvertierung.

Zusätzlich wurde die neue **fünfseitige PDF-Probe** mit 101 Datenzeilen, CRLF-/CR-/LF-Umbrüchen und einer 90-zeiligen Tabellenzelle fachlich geprüft. Alle fünf Seiten wurden bei 90 dpi mit Poppler gerendert und tatsächlich angesehen: Die lange Zelle läuft auf Seite 2 und 3 weiter; Tabellenköpfe und Seitennummern bleiben sichtbar, keine abgeschnittenen Zeilen oder Überdeckungen wurden erkannt. HTML-artiger Benutzertext bleibt Text. Der sanitisierte [PDF-Sichtnachweis](nachweise/business-pdf.json) enthält PDF-SHA-256 `643184ae0d8e844cf29a5a2e72a842cab0023ab445dc1bb9ecf09428ef2091f0`, Laufzeitidentität und Belegbilder. Das ist die Sichtprüfung dieser synthetischen Fixture, kein Nachweis für beliebige fremde PDFs oder vollständige PDF-Barrierefreiheit.

## Lasten mit genauen Quellen

Alle Lasten verwenden eigene synthetische Daten. CPU: Intel Core i7-13700, 24 logische Prozessoren; Windows meldete 68.333.776.896 Byte physischen RAM. Die Messungen gelten für ihren jeweils gespeicherten Quellstand und werden späteren Runtimeänderungen nicht nachträglich zugerechnet.

| Last                                          | Verifiziertes Ergebnis                                                                                                                     | Enginezeit | Prozess-Peak-Working-Set |                     Beobachtetes temporäres Maximum |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------: | -----------------------: | --------------------------------------------------: |
| 1.000.000 CSV-Zeilen, schmales 64-MB-Profil   | 216.000.044 Eingabebytes; 500.000 ausgewählte Datensätze, vier Gruppen, Gesamtbetrag 625.000,00; Parquet-Zeilenfolge und Quellhash geprüft |    4,788 s |         127.074.304 Byte | 72.888.320 Byte, davon 72.876.032 Byte DuckDB-Spill |
| XLSX mit 50.000 Datenzeilen und sechs Spalten | 50.000 Zeilen erneut gelesen, Gesamtsumme 62.500,00, führende Nullen/Text und unveränderte Quelle geprüft                                  |   19,402 s |          80.809.984 Byte |              22.508.359 Byte; kein Spill beobachtet |
| 1.000 kleine CSV-Dateien                      | 53.000 Eingabebytes; 2.000 Ausgabe-/Archivdateien vollständig per SHA-256 geprüft                                                          |   15,488 s |          44.675.072 Byte |           53 Byte beobachtetes Temp-/Stagingmaximum |

Die ersten beiden Messungen stammen aus [nachweise/business-daten.json](nachweise/business-daten.json): Laufkennungen `daten-ee1577e360814b1f82281477499266a0` und `daten-f585512c11854eb5bdcce551f780cff1`. Die Stapelmessung stammt aus [nachweise/business-stapel.json](nachweise/business-stapel.json), Originalbericht `artifacts/business-beispiele/20261026-234840-ace9035a/pruefung.json`. Beide Nachweisdateien enthalten Quellen-/Berichtshashes und Messgrenzen.

Working Set betrifft nur den eigenen Python-Prüfprozess einschließlich seiner Grundlast, nicht Electron oder den gesamten Rechner. Temp und private Bytes wurden mit Stichproben erfasst und sind keine garantierten absoluten Peaks. Beim 1.000-Dateien-Lauf gab es 443 Stichproben mit 25 ms Sollabstand und 46,531 ms größter beobachteter Lücke. TEMP/TMP/TMPDIR waren auf einen privaten Artifactordner umgeleitet; nur dieser und das eigene Zielstaging wurden gezählt. Systemdateicaches wurden nicht geleert.

Das **breite** Millionen-CSV-Profil scheiterte unter 64 MB DuckDB-Budget auch nach den dokumentierten Pufferkorrekturen. Der erfolgreiche schmale Plan verwendet ein anderes, ausdrücklich beschriebenes Ergebnisschema. Es wird weder beliebige Millionenverarbeitung noch ein allgemeiner Geschwindigkeitsfaktor zugesagt. DuckDBs Budget ist kein hartes RAM-Limit für den gesamten Python-Prozess; das Tempbudget ist kein Betriebssystemkontingent für sämtliche Bibliotheks- und Zieltempdateien.

## Bedienung während einer Millionenlast

Zwei bewusst freigeschaltete Desktop-Lastfälle bestanden mit **2/2 in insgesamt 12,482303 Sekunden**. Der sanitisierte [Last-UI-Nachweis](nachweise/business-ui-last.json) enthält unveränderte Messwerte und SHA-256 der Rohberichte. Eigene synthetische CSV-Daten mit einer Million Zeilen und drei Spalten wurden im aktuellen, noch nicht gespeicherten Editorstand gelesen, typisiert, auf Nord gefiltert, gruppiert und exportiert: 500.000 ausgewählte Zeilen und Summe 1.000.000 wurden in der Ergebnisdatei geprüft. Die gespeicherte Projektfixture blieb unverändert.

Während der tatsächlichen Phase `laeuft` und des Schritts `last-lesen` antwortete Canvas-Zoom nach **88,341 ms**, Verschieben nach **105,5934 ms**. Der erste Ablauf endete mit Exitcode 0 nach 5.121,1899 ms; darin liegt eine bewusste Beobachtungswartezeit von zwei Sekunden, deshalb ist dies keine reine Enginezeit. Im zweiten Ablauf wurde nach bestätigtem Export während eines begrenzten Warteblocks gestoppt: **1.162,402 ms** bis zum bestätigten Abbruch. Die bereits erzeugte Ausgabe blieb mit identischem Hash erhalten und der Editor war wieder bearbeitbar. Beide Screenshots wurden angesehen; sie bleiben wegen sichtbarer temporärer Pfade unter `artifacts/business-last`.

Dies belegt diese beiden begrenzten Abläufe und ihre beobachtete Bedienantwort. Es wurden dabei weder Prozess-RAM gemessen noch ein hartes RAM-Limit oder beliebige Millionenworkflows nachgewiesen. Die Messung wird nicht mit einer gesonderten Mindestprüfung freien Datenträgerplatzes vermischt.

## Verbleibende Grenzen

### Noch nicht praktisch abgenommene Fehlerumgebungen

| Fall | Vorhandener Nachweis | Konkret offen |
| --- | --- | --- |
| Vom Betriebssystem gesperrtes Ziel | `tests/business/test_dateifehler.py`: echter exklusiver Windows-Handle auf ein eigenes temporäres Ziel. Ersetzen scheitert; Originale bleiben bytegleich, keine Publikation, unbestätigtes Staging bleibt zur Klärung erhalten und Wiederaufnahme wird blockiert. | Keine umfassende Matrix fremder Anwendungen, Virenschutz- oder Netzfreigabesperren. |
| Fehlender Speicherplatz | Kontrollierte `ENOSPC`-Fehlerinjektion während Stagingschreiben: kein Rename, bisheriges Ziel erhalten, technische Zwischenfassung bereinigt. | Kein tatsächlich voller Datenträger oder erschöpftes Dateisystemkontingent; keine reale Platzerschöpfung während Journalbestätigung oder Rename. |
| Berechtigung, Lesefehler und Abbruch | Drei weitere kontrollierte Fälle: `EACCES` vor Staging, `EIO` beim zweiten Lesen und kooperativer Abbruch. Alle bewahren die Quellen und bisherigen Ziele. Zusammen mit Sperr- und ENOSPC-Fall **5/5** im vollständigen 117er-Fachlauf. | Fehler werden gezielt injiziert; dies belegt weder tatsächlichen Medienausfall noch jede Windows-Berechtigungskonfiguration. |
| Unterbrochener Netzzugriff | Begrenzte Fetch-/Dateioperationen sowie lokale Offline-/Hash-/Abbruchprüfungen sind vorhanden. | Kein echter unterbrochener Download oder UNC-/SMB-Lese-/Schreibvorgang. Fault-Injection und AbortSignal werden nicht als realer Netzausfall ausgegeben. |

Diese Lückenliste unterscheidet **eine echte Windows-Dateisperre** und **vier kontrollierte Fehler-/Abbruchfälle**. Es wurden ausschließlich eigene isolierte Testdateien verwendet. Reale Datenträgerfüllung und Netzwerkunterbrechung bleiben ausstehend.

- Vorschau und Prüflauf verändern keine fachlichen Ziele, können aber vollständige Quellen lesen und eigene technische Zwischenfassungen erzeugen. Der sichtbare Ausschnitt bleibt auf 200 Zeilen und 256 KiB begrenzt. Ein Parametersatz Testdaten ist keine Sandbox.
- Journale über 16 MiB werden beim Einlesen abgewiesen. Dokumenttabellen sind auf 20.000 Zellen begrenzt. Wiederaufnahme verlangt passende Workflow-, Parameter-, Quellen-, Ergebnis- und Runtimeidentität; sie ist keine allgemeine Genau-einmal-Garantie und kein Rollback.
- Excel-Formeln werden nicht berechnet. PDF-Textschichtprüfung ist keine OCR; ein Scanverdacht beweist keine vollständige Texterkennung. Office-Konvertierung und Office-COM sind nicht enthalten.
- Die PDF-Scanpolicy wurde im Python-Fachumfang geprüft. Daraus wird kein zusätzlicher 14. Business-UI-Fall erfunden; der Zustandslauf bleibt bei 12 realen UI-Fällen. Der noch laufende vollständige Desktopdurchlauf wird erst nach seinem tatsächlichen Abschluss eingetragen.
- Der Installer für 0.2.0, praktische Installation/Deinstallation, veröffentlichte Releaseartefakte und eine produktive Updatekette mit zwei installierten signierten Versionen sind hier noch nicht bestätigt. Fehlende Entwicklerzertifikate oder Veröffentlichungsrechte werden nicht durch einen Testbuild ersetzt.
- Projektlizenz weiterhin `UNLICENSED`; Entwickler Leon Stolz. Fremdbibliotheken und Vera behalten ihre jeweiligen Lizenzhinweise.

## Noch durch den Maintainer zu finalisieren

1. Endgültiger Gesamt-Unit-/Windows-Lauf nach den letzten Datenkorrekturen mit eindeutigem Quellstand und Berichtsidentität.
2. Vollständiger aktueller Desktoplauf mit tatsächlichen Gesamt-/Skip-/Fehlerzahlen; er läuft derzeit noch.
3. Quellstand und Berichtsidentitäten der endgültigen Laufkombination sichern; Teilnachweise nicht zu einer fiktiven Gesamtzahl addieren.
4. Tatsächlicher Installerpfad, Größe, SHA-256, Signaturzustand und Paketbericht `artifacts/business-build-020/pruefung.json`.

Bis diese Punkte mit echten Ergebnissen ergänzt sind, bleibt diese Notiz ein belegter Zwischenstand und keine abschließende Gesamtfreigabe.
