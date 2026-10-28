# Automatische Ablage und Laufhistorie

## Speichern, Kopieren und Exportieren

**Speichern** sichert den aktiven Workflow im ScriptLab-Nutzerverzeichnis, ohne nach einem Zielordner zu fragen. Extern geöffnete Projekte werden beim Speichern intern übernommen; die externe Quelldatei bleibt unverändert. **Workflow → Kopie anlegen** erzeugt eine unabhängige interne Kopie mit neuer Projektkennung. Entwürfe und die Speicherentscheidung vor einem Projektwechsel verwenden ebenfalls die interne Ablage. Bestehende Konfliktprüfungen verhindern ein stilles Überschreiben extern veränderter interner Projektdateien.

**Exportieren** fragt nach einem Ausgabeort. Eine exportierte `.scriptlab`-Datei ist eine bearbeitbare Kopie des aktuellen Stands; sie ändert weder die aktive Projektdatei noch deren Speicherzustand. Script und Business-Paket bleiben eigenständige Exportformate. Ihr Start beim Empfänger verwendet die ursprüngliche Pfadsemantik und benötigt die passende Laufzeit. Das Projektformat bleibt Schema 3.

## Ablageorte

Die Pfade liegen unter dem von Electron verwalteten Nutzerverzeichnis, gewöhnlich `%APPDATA%\ScriptLab`.

| Pfad                                      | Inhalt                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `Workflows\<Projektkennung>.scriptlab`    | Gespeicherter bearbeitbarer Workflow                                                   |
| `Arbeitsdateien\<Projektkennung>\`        | Pfadbasis für relative Quellen und Ziele dieses Workflows; kopierte Business-Testdaten |
| `entwuerfe\<Projektkennung>.json`         | Gesonderter lokaler Zwischenstand                                                      |
| `laufhistorie\index.json`                 | Kompakte Metadaten der abgeschlossenen Läufe                                           |
| `laufhistorie\details\<Laufkennung>.json` | Laufzustand, Protokoll und Ergebnisangaben eines gespeicherten Laufs                   |

Der Arbeitsordner wird beim Speichern, Starten oder ausdrücklichen Öffnen im Explorer angelegt. Das Lesen des Laufkontexts erzeugt keine Verzeichnisse. Vor einem Start ersetzt der Hauptprozess einen vom Renderer gelieferten Basisordner durch den festen Arbeitsordner. Auch ein neuer, noch nicht gespeicherter Workflow kann ausgeführt werden.

Externe Quellen bleiben lesbar. Schreibziele der Ausführung in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen. Bestehende absolute Ausgabeziele außerhalb und relative Pfade, die dorthin führen, werden abgewiesen, nicht automatisch umgeschrieben. Die Grenze gilt für die Ausführung innerhalb der Anwendung; exportierte Scripts bleiben eigenständig. Sie ist keine allgemeine Prozess-Sandbox und ersetzt keinen Schutz vor gleichzeitigen Dateisystemänderungen durch andere Prozesse.

## Liste und Laufdetails

**Alle Läufe** listet abgeschlossene Läufe des geöffneten Workflows mit Zeitpunkt, Modus, Status, Dauer und Standkennung. Suche und Modusfilter gelten nur für diese Liste. **Anzeigen** lädt die zugehörigen Details; **Übersicht**, **Ergebnisse** und **Protokoll** beziehen sich auf denselben Lauf. Ältere Workflowstände sind gekennzeichnet. Eine Fehlerzuordnung führt nur bei passendem Stand zum aktuellen Baustein.

Der Hauptprozess ordnet jeden Lauf anhand der Projektkennung zu und prüft den Workflowstand. Die Liste liest nur den Index; vollständige Protokolle werden erst bei Auswahl geladen. Das Listenladen wartet ausstehende Speicherarbeit ab, damit ein gerade abgeschlossener Lauf nicht durch einen Schreibwettlauf fehlt. Die Oberfläche fragt die Ablage beim Öffnen oder nach einem Abschluss ab, nicht fortlaufend im kurzen Statusintervall.

**Protokoll kopieren** und **Protokoll exportieren** verwenden den ausgewählten Lauf. Der Textdateiexport enthält dessen Identität, Modus, Status, Zeiten, Ausgabe und vorhandene technische Meldungen. Er fragt nach einem `.txt`-Ziel und verändert den Workflow nicht. Die Exploreraktion nimmt keine Rendererpfade entgegen: Sie ermittelt bestätigte veröffentlichte oder wiederverwendete Business-Ausgaben beziehungsweise den Bericht aus dem gespeicherten Zustand und prüft, ob die Datei noch erreichbar ist.

## Parameter und Rückgängig

Ein Standardwert, eine eigene Überschreibung und ein ausdrücklich leerer Wert werden getrennt behandelt. „Standardwert verwenden“ entfernt nur die Überschreibung des ausgewählten Parametersatzes. Bloßes Fokussieren oder Verlassen eines Feldes schreibt keinen Standardwert in den Satz.

Beim Umbenennen bleiben Test-/Echtwerte und gebundene Bausteine zusammen erhalten. Das gilt auch für den Tausch zweier Namen. Rückgängig und Wiederholen im Bereich „Ablauf“ behandeln Definitionen, Satzwerte und Bausteinverweise als eine Änderung. Auch umfangreiche Business-Bausteine verwenden jetzt ein eigenes Blockly-Datenereignis, damit ihre Einstellungen tatsächlich rückgängig werden.

## Aufbewahrung und Grenzen

- Höchstens **200 abgeschlossene Läufe und 64 MiB Detaildaten insgesamt**, nicht pro Workflow. Bei Bedarf entfallen ältere Einträge. Eine einzelne Detaildatei ist auf 8 MiB begrenzt; der Index auf 1 MiB.
- Details und Index werden dateiweise atomar geschrieben. Ein nicht gespeicherter Lauf verändert den echten Ausführungsstatus nicht; die Liste zeigt einen Ablagehinweis. Unbekannte oder beschädigte Ablageformate werden nicht als sicher leere Historie behandelt.
- Die Historie sichert Laufdaten und Protokolle. Sie hält keine zusätzliche Kopie jeder Ergebnisdatei vor. Später gelöschte, veränderte oder verschobene Ausgaben können deshalb nicht aus der Historie wiederhergestellt werden.
- Ein Öffnen oder Auswählen startet und wiederholt keine Verarbeitung. Laufende Prozesse werden nach einem Anwendungsneustart nicht automatisch wiederaufgenommen. Die ausdrückliche Business-Journalfunktion bleibt davon getrennt.
- Eine unabhängige Workflowkopie übernimmt keine früheren Läufe. Ihr Arbeitsordner wird nicht pauschal aus dem bisherigen Ordner dupliziert; konfigurierte absolute Pfadwerte bleiben erhalten. Mitgelieferte Business-Beispiele erhalten dagegen ausdrücklich eigene Testdateikopien.
- Die lokale Historie ist keine vollständige Sicherung und keine manipulationsgeschützte revisionssichere Ablage.

## Prüfstand

Gezielte Speichertests prüfen die Warteschlange, Lesen nach Neustart, Zuordnung zum Workflow, begrenzte Aufbewahrung, beschädigte Details sowie das Erhalten unbekannter Indexdaten. Weitere Fälle prüfen die Auswahl bestätigter Ausgaben und das Sichern eines tatsächlich angelegten, schon bei der Vorbereitung gescheiterten Laufs. Diese Prüfungen sind kein Nachweis für sämtliche Windows-Arbeitswege oder eine vollständige Oberflächenabnahme.

Am **28. Oktober 2026** wurde ein vollständiger Arbeitsweg in der Windows-Electron-Anwendung mit isoliertem temporärem Nutzerprofil und synthetischen Business-Daten ausgeführt. Der [Bericht](weiterentwicklung/funktionsstand.json) und `scripts/funktionsansichten.mjs` halten folgende Beobachtungen fest:

- Ein extern geladenes Projekt wurde ohne Speicherdialog intern gesichert. Die externe Quelldatei blieb bytegleich.
- Ein Prüflauf und eine echte Ausführung endeten jeweils mit „Beendet“. Die Ausführung veröffentlichte eine XLSX- und eine PDF-Datei im Workflow-Arbeitsordner; Dateigrößen und Hashes stehen im Bericht.
- Nach einem Anwendungsneustart waren beide Läufe dem Workflow zugeordnet wieder verfügbar. Laufdetails und Ergebnisse wurden in beiden Themen geöffnet.
- Die Exploreraktion löste einen bestätigten Ausgabepfad im Hauptprozess auf und prüfte die Datei. Der Aufruf zum Öffnen war instrumentiert; es wurde kein echtes Explorerfenster geprüft.
- Protokoll und bearbeitbare Projektkopie wurden exportiert. Der aktive Speicherzustand blieb beim Projektdateiexport erhalten. Es wurden keine Rendererfehler aufgezeichnet.
- Ein gebundener Parameter wurde umbenannt; Name, Satzwert und Bausteinverweis wechselten zusammen. Rückgängig, Wiederholen und erneutes Rückgängig wurden im tatsächlichen Editor ausgeführt.

Die [aktuellen Ansichten](weiterentwicklung/ANSICHTEN.html) zeigen Speicherung, Laufvorbereitung, Historie nach Neustart, Ergebnisse und Projektdateiexport. Das ist ein gezielter Funktionsnachweis, keine vollständige Abnahme aller Dateioperationen, Fehlerfälle, Windows-Versionen oder Bedienwege. Historische Prüfzahlen in [TESTLAUF.md](TESTLAUF.md) und [STARTSEITE.md](STARTSEITE.md) bleiben ihrem damaligen Stand zugeordnet.
