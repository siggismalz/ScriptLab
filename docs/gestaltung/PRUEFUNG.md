# Gestaltungsstand und nachvollziehbare Grenzen

Stand: 28. Oktober 2026.

UI-Quellstand: `9d3f986`. Der aktuelle entpackte Windows-Build liegt lokal unter `release/gestaltung-9d3f986/win-unpacked/ScriptLab.exe`. Der Ausgabeordner trägt den Quellstand, weil die zuvor verwendeten Buildordner beim Ersetzen der Archivdatei gesperrt waren. Das ist kein veröffentlichtes oder signiertes Produktrelease.

## Nachtrag vom 28. Oktober 2026

Nach dem unten dokumentierten UI-Stand wurden automatische Projektablage, feste Workflow-Arbeitsordner und eine dauerhafte lokale Laufhistorie mit Liste und Laufdetails umgesetzt. [WEITERENTWICKLUNG.md](../WEITERENTWICKLUNG.md) beschreibt die neuen Arbeitswege, Ablagegrenzen und den gezielten Windows-Funktionsnachweis. Dessen [Bericht](../weiterentwicklung/funktionsstand.json) dokumentiert unter anderem Speicherung ohne Zielauswahl, unveränderte externe Quelldatei, echte Business-Ausgaben, Läufe nach Neustart und Protokollexport. Die folgenden UI-Aussagen und Aufnahmen bleiben ihrem Quellstand `9d3f986` zugeordnet; der Nachtrag ist keine erneute vollständige Gestaltungsabnahme.

## Aktuelle UI-Arbeit

Die letzte Überarbeitung konzentriert sich auf die konkrete Oberfläche: Übersicht, ausgewählte Aufgabe und gezielt geöffnete Details. Maßgeblich sind [Informationsebenen](INFORMATIONSEBENEN.md), [Designsystem](DESIGNSYSTEM.md) und die [Ansichtengalerie](ANSICHTEN.html).

Die aktuellen Aufnahmen stammen aus der Windows-Electron-Anwendung. Sie zeigen vorhandene Arbeitsabläufe mit ausdrücklich benannten synthetischen Testdaten. Es werden keine erfundenen Laufresultate für die Gestaltung eingesetzt. `scripts/gestaltung-detailaufnahmen.mjs` erfasst die geschlossene und geöffnete Quelle, Importoptionen, Bausteindetails und Sprachwahl, ohne einen Workflow auszuführen. Der vollständige Ansichtenhelfer `tests/ui/gestaltung-ansichten.mjs` erzeugt zusätzlich echte Vorschau-, Prüf-, Ausführungs-, Abbruch- und Teilergebniszustände in isolierten temporären Ordnern.

Visuell bearbeitet wurden insbesondere:

- Start und Workflowliste: scanbare Zeilen; Pfade und seltene Aktionen dahinter.
- Palette: fachliche Einstiege; globale Suche bleibt unmittelbar nutzbar.
- Editor: kompakter Kopf, benannte Menüs, wenige Hauptaktionen.
- Eigenschaften: primärer Wert beziehungsweise gebundene Herkunft; Optionen und Bausteindetails geschlossen.
- Daten: getrennte Quellen-, Parameter- und Vorschauansichten; keine technischen Kennungen im primären Inhalt.
- Läufe: Werkzeugzeile statt mehrfacher Kopfbereiche; Ergebnisse vor technischen Metadaten.
- Ergebnisdateien: Name und bestätigter Status zuerst; vollständige Pfade und Laufbericht werden gezielt geöffnet. Nach Laufende ist die Vorbereitung eines weiteren Laufs eine ruhige Nebenaktion.
- Einstellungen und Export: relevante Auswahl zuerst; Voraussetzungen und Spezialoptionen gezielt erreichbar.
- Beide Themen, aufgeklappte Details und vollständige deutsche Beschriftungen.

Die abschließenden Ansichten enthalten auch den geöffneten Berichtbereich (`nachher/lauf-berichtdetails-dunkel-1280.png`). Datenfehler verwenden dieselben Feldbezeichnungen wie das Formular; die allgemeinen Einleitungssätze entfallen in der Datenansicht. Der finale Quellstand wurde erfolgreich mit TypeScript geprüft und gebaut. Die letzten Bildaufnahmen wurden danach erneut aus der Anwendung erzeugt.

Eine native Fensterbetrachtung bestätigte auch die tatsächlich exponierten deutschen Namen von Menüs, Tabs, Feldern und Bausteinen. Dabei wurde die verdeckte Zoomsteuerung als Layoutproblem erkannt und korrigiert: Sie bleibt innerhalb der vom Eigenschaftenbereich unverdeckten Fläche. Bei engem Fenster ersetzt der Eigenschaftenbereich vorübergehend die Palette.

## Vorhandene technische Nachweise

Im Verlauf wurden TypeScript-/Buildprüfungen sowie gezielte Unit-, Windows-Desktop- und echte Laufzeitprüfungen durchgeführt. Die letzte Schwerpunktänderung verlangte ausdrücklich UI-Detailarbeit statt weiterer Testkampagnen. Frühere Ergebnisse werden deshalb nicht als vollständige Abnahme sämtlicher zuletzt geänderter Ansichten ausgegeben.

Die früheren Desktopprüfungen deckten unter anderem echte CSV-Ausgabe, Vorschau ohne Zieländerungen, Prüflauf, Stoppen, VBS-/Python-Ausführung, ZIP-Export, Entwürfe und unabhängige Vorlagenkopien ab. Die Lastansichten wurden mit tatsächlich verarbeiteten Millionenzeilenbeständen betrachtet. Die vollständigen Ausgaben dieser Läufe stehen lokal unter `artifacts/gestaltung-*`; sie sind zeitlich einzuordnende Entwicklungsnachweise.

Der punktuelle Komponenten-Kontrastbericht `nachher/komponenten-kontrast.json` entstand vor der abschließenden Vertiefung der Ansichten. Er dokumentiert tatsächlich berechnete HTML-/SVG-Farben einschließlich Transparenzen und Vorfahrenflächen. Er ist weder eine vollständige Barrierefreiheitsprüfung noch ein aktueller Gesamtnachweis aller inzwischen geänderten Komponenten.

Die Icons wurden unabhängig in 16, 24, 32, 48 und 256 Pixeln geprüft; siehe [Marke](MARKE.md) und die Prüftafeln unter `assets/`.

## Skalierung und Fenster

Prozessweise Skalierungsprüfungen mit 100, 125, 150 und 200 Prozent sowie UI-Textvergrößerung bis 200 Prozent wurden durchgeführt. Sie ersetzen nicht die tatsächliche Umstellung der Windows-Systemskalierung. Eine native Betrachtung fand bei tatsächlich gemeldeten 175 Prozent statt. Der Wechsel zwischen den beiden vorhandenen Monitoren, Maximieren und Wiederherstellen wurden ausgeführt und unter `nachher/fenster-pruefung.json` festgehalten; beide Monitore meldeten denselben Maßstab.

Die Anzeigeseite von Windows wurde zur Vorbereitung geöffnet. Die Systemskalierung wurde in diesem Arbeitsstand nicht umgestellt. Die letzte UI-Schwerpunktsetzung wurde danach befolgt. Es wird kein Vierfachnachweis echter Windows-Systemumstellungen behauptet.

## Offene Grenzen

- Es fand kein Nutzertest mit externen Fachanwendern statt. Die gestalterische Beurteilung ist eine eigene Sicht- und Bedienprüfung.
- Eine vollständige Barrierefreiheitsabnahme einschließlich Screenreader, echter Windows-Kontrastdarstellungen und aller Monitor-/DPI-Wechsel steht aus.
- Zum UI-Stand `9d3f986` fehlte eine dauerhafte Laufhistorie. Diese Grenze wurde mit der im Nachtrag dokumentierten Umsetzung aufgehoben; ihre Aufbewahrungs- und Prüfgrenzen stehen dort.
- Einige ältere Desktoptests beschreiben noch frühere Menü- oder Disclosure-Wege. Ihre vollständige Angleichung gehört zur abschließenden funktionalen Regression, nicht zur hier behaupteten visuellen Ausarbeitung.
- Ein entpackter lokaler Windows-Build ist kein veröffentlichtes oder signiertes Produktrelease. Es wurde nichts veröffentlicht.

## Umsetzungsschritte im Repository

- `7ea4589` – Bestand und Gestaltungsrichtung für ScriptLab dokumentiert.
- `c7fabd0` – ScriptLab-Marke und gemeinsame Gestaltungstokens vereinheitlicht.
- `7d3ea5c` – Oberfläche in Übersicht, Bearbeitung und Details gegliedert.
- `a75d8c8` – Bedienprüfungen für die neuen Arbeitsbereiche ergänzt; Standgrenzen sind oben beschrieben.
- `9d3f986` – Datenfehler und Laufergebnisse auf das Wesentliche konzentriert.
