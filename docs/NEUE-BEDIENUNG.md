# Aktuelle Bedienung für Business-Workflows

## Workflow erstellen und verstehen

**Neuer Workflow** behält die ausdrückliche Wahl zwischen Python und VBS. Python und die Komponenten für Tabellen und Dokumente gehören zur Anwendung; eine zusätzliche Python-Installation oder Paket-Einrichtung ist für die Arbeit in ScriptLab nicht vorgesehen. VBS verwendet weiterhin die verfügbare Windows-VBScript-Komponente. Die Sprache bleibt für den Workflow fest.

Die Palette bietet fachliche Einstiege und eine Suche über alle verfügbaren Bausteine. Plus und anschließender Klick auf eine Einfügestelle funktionieren ohne Ziehen. Die Business-Bausteine zeigen neben ihrem Namen eine kurze Zusammenfassung ihrer vorhandenen Konfiguration. Fünf Fachfarben ordnen die Aufgaben; Status und Auswahl besitzen eigene Kennzeichnungen.

## Quellen und Eingaben konfigurieren

Im ausgewählten Baustein zeigen **Eigenschaften** die häufigen Felder. Importoptionen und technische Angaben bleiben gezielt aufklappbar. Quellen, Dokumentvorlagen und unterstützte Eingangsordner lassen sich über eine native Auswahl setzen. Ausgabeziele bleiben in der von ScriptLab verwalteten Ablage.

Ein Feld kann einen festen Wert, einen Workflowparameter oder eine Variable verwenden. Eine gewählte Bindung bleibt sichtbar; der Parameterkontext benennt den verwendeten Satz. Die Auswahl einer Eingabetabelle bietet passende vorherige Ergebnisse. Eine ungültig gewordene bestehende Zuordnung bleibt erkennbar, bis sie korrigiert wird.

**Daten und Parameter** bietet mehr Platz für dieselbe Konfiguration und für Parameterwerte. Diese Ansicht erzeugt keine getrennte Projektdatei. **Speichern** sichert intern ohne Zielauswahl; für eine weiterzugebende Projektkopie dient **Exportieren**.

## Ein Tabellenergebnis prüfen

Unter **Datenvorschau** wählst du **Ergebnis bis zu diesem Schritt** und startest bewusst **Datenvorschau laden**. Die Vorschau verarbeitet die notwendigen unterstützten Vorgänger bis einschließlich des gewählten Tabellenschritts. Unfertige Nachfolger werden dafür nicht benötigt; sie werden im bearbeiteten Workflow nicht gelöscht oder geändert.

Die Einzelvorschau unterstützt verbundene lesende Tabellenschritte im Hauptablauf. Schleifen, Verzweigungen und Dateiaktionen im benötigten Vorlauf erhalten einen konkreten Hinweis. Die Anzeige ist auf höchstens 200 Zeilen und 256 KiB begrenzt; Filter oder Gruppierungen können trotzdem die gesamte Quelle lesen. Spaltenvorschläge beziehen sich auf die ausgewählte Eingabetabelle und ihren Vorschaukontext.

## Prüflauf, Ausführung und frühere Läufe

Ein Business-Workflow beginnt in der Vorbereitung mit **Prüflauf ohne Zieländerungen**. Modus, Parametersatz, Quellen und Ausgabeziele bleiben vor dem Start prüfbar. Erst **Ausführen · echte Dateiänderungen** verändert fachliche Ziele. Grundbausteine und VBS erhalten keinen vorgetäuschten Prüflauf. **Stoppen** macht bereits vorgenommene Änderungen nicht rückgängig.

Relative Pfade verwenden automatisch den Arbeitsordner des Workflows. Externe Quellen bleiben lesbar; Ausgaben in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen. Die vollständigen Ablagepfade und Aufbewahrungsgrenzen beschreibt [WEITERENTWICKLUNG.md](WEITERENTWICKLUNG.md).

**Alle Läufe** zeigt gespeicherte Läufe dieses Workflows. **Anzeigen** öffnet Übersicht, Ergebnisse und Protokoll eines konkreten Laufs. Ein früherer Workflowstand wird kenntlich gemacht. **Protokoll kopieren** und **Protokoll exportieren** beziehen sich auf die Auswahl. Ansichtswechsel und das Öffnen alter Ergebnisse starten keine Verarbeitung.

## Einstellungen und Export

Die neue Office-Farbwelt beginnt bei einer neuen Installation mit **Hell**. Gespeicherte Entscheidungen bleiben erhalten; **Dunkel** und **System** stehen gleichwertig unter **Darstellung** bereit. UI-Textgröße und Canvaszoom sind getrennt.

Unter **Laufzeit** stehen der tatsächliche Status der mitgelieferten Python- und Business-Komponenten sowie **Erneut prüfen**. Versionen und Programmdatei sind lesend unter technischen Angaben erreichbar. Die Anwendung bietet dort keine Interpreterauswahl oder Online-/Offline-Paketinstallation mehr an.

Beim **Exportieren** werden Projektdatei, Script und Business-Paket unterschieden. Ein exportiertes Python-Script benötigt auf dem Zielcomputer Python; ein Business-Paket zusätzlich die in seiner Anleitung genannten Pakete. Das ZIP enthält Business-Module, aber keinen Python-Interpreter. Ein Export richtet auf dem Zielcomputer keine Umgebung ein und startet keinen Workflow.

## Nachweisgrenze dieses Stands

Die tatsächlichen Arbeitswege, aktuellen Windows-Ansichten und verbleibenden Grenzen dokumentiert [OFFICE-UMSETZUNG.md](OFFICE-UMSETZUNG.md). Frühere Ansichten, Laufberichte oder Installerprüfungen bleiben ihrem damaligen Stand zugeordnet.
