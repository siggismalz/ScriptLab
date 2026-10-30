# Aktuelle Bedienung für Business-Workflows

## Workflow erstellen und verstehen

**Neuer Workflow** behält die ausdrückliche Wahl zwischen Python und VBS. Python und die Komponenten für Tabellen und Dokumente gehören zur Anwendung; eine zusätzliche Python-Installation oder Paket-Einrichtung ist für die Arbeit in ScriptLab nicht vorgesehen. VBS verwendet weiterhin die verfügbare Windows-VBScript-Komponente. Die Sprache bleibt für den Workflow fest.

Die Palette bietet fachliche Einstiege und eine Suche über alle verfügbaren Bausteine. Plus und anschließender Klick auf eine Einfügestelle funktionieren ohne Ziehen. Die Business-Bausteine zeigen neben ihrem Namen eine kurze Zusammenfassung ihrer vorhandenen Konfiguration. Fünf Fachfarben ordnen die Aufgaben; Status und Auswahl besitzen eigene Kennzeichnungen.

Der Workflowkopf bündelt Name, Speicherzustand und Sprache mit **Speichern**, der konkreten Startaktion und **Exportieren**. Darunter wechseln **Ablauf**, **Daten und Parameter** und **Läufe** den Arbeitsbereich; daneben liegen die Bearbeitungswerkzeuge. So bleibt die gewählte Aufgabe erkennbar, während wichtige Aktionen erreichbar sind.

Fügst du einen neuen Business-Baustein ein, der genau ein vorheriges Ergebnis benötigt, übernimmt ScriptLab einen passenden direkt vorausgehenden Schritt oder die einzige eindeutige Quelle. Bei mehreren möglichen Quellen ohne passenden direkten Vorgänger und bei Bausteinen mit zwei Eingaben wählst du selbst. Verschieben, Kopieren und erneutes Öffnen ändern vorhandene Zuordnungen nicht. **Rückgängig** nimmt das Einfügen samt übernommener Quelle gemeinsam zurück; das gilt beim Einfügen per Klick und beim Ziehen aus der Palette.

## Quellen und Eingaben konfigurieren

Im ausgewählten Baustein zeigen **Eigenschaften** die häufigen Felder. Selten benötigte Optionen stehen unter **Weitere Einstellungen**; ein dort erkannter Feldfehler öffnet den Abschnitt. Quellen, Dokumentvorlagen und unterstützte Eingangsordner lassen sich über eine native Auswahl setzen. Ausgabeziele bleiben in der von ScriptLab verwalteten Ablage.

Ein Feld kann einen festen Wert, einen Workflowparameter oder eine Variable verwenden. Eine gewählte Bindung bleibt sichtbar; der Parameterkontext benennt den verwendeten Satz. Die Auswahl einer Eingabetabelle bietet passende vorherige Ergebnisse. Eine ungültig gewordene bestehende Zuordnung bleibt erkennbar, bis sie korrigiert wird.

**Daten und Parameter** bietet mehr Platz für dieselbe Konfiguration und für Parameterwerte. Diese Ansicht erzeugt keine getrennte Projektdatei. **Speichern** sichert intern ohne Zielauswahl; für eine weiterzugebende Projektkopie dient **Exportieren**.

Auf der Startseite steht der aktive Workflow einmal unter **Zuletzt geöffnet**. **Weiterbearbeiten** kehrt zu seinem vorhandenen Stand zurück. Feldfehler führen über kurze Verweise zur Eingabe; ihre vollständige Erklärung steht dort. **Alle Läufe** bleibt direkt im gemeinsamen Laufkopf erreichbar. Die [Straffung vom 28. Oktober 2026](UEBERSICHTLICHKEIT.md) dokumentiert diese Details mit Vorher-/Nachher-Ansichten.

## Filter, Berechnungen und Prüfregeln bearbeiten

Ein Filter beginnt mit **Spalte**, **Vergleich** und **Vergleichswert**. Unter **Bedingung erweitern** ergänzt du weitere Bedingungen oder eine Untergruppe. Eine Gruppe kann alle oder mindestens eine ihrer Bedingungen verlangen; beim Wechsel bleiben die Bedingungen erhalten. **Bedingung umkehren** beziehungsweise **Umkehrung aufheben** ändern die Verneinung. Eine Gruppe mit nur einer Bedingung lässt sich gesondert auflösen.

Berechnungen können die acht vorhandenen Funktionen verwenden: Jahr, Monat oder Tag aus einem Datum, Rand-Leerzeichen entfernen, Groß- oder Kleinbuchstaben, Textlänge und Text anhand eines Suchmusters auslesen. Suchmuster und Ergebnisgruppe erscheinen nur bei der Mustersuche und erhalten passende Hinweise. Für einfache Werte bleiben weitere Wertquellen und Datentypen eingeklappt.

Eine Qualitätsregel zeigt nur die Angaben, die ihre Prüfung braucht. Fertige Regeln lassen sich auf eine kurze Zusammenfassung einklappen. Fehlende Angaben und gemeldete Probleme öffnen die betroffene Regel, damit du sie direkt bearbeiten kannst.

## Spalten auswählen und Zuordnungen ändern

Bei Spaltenlisten kannst du unter **Aus Vorschau auswählen** nach den Spalten der zugeordneten Eingabetabelle suchen und mehrere auswählen. Bereits gewählte Spalten behalten ihre Reihenfolge; weitere kommen ans Ende. Mit den Pfeilen nach oben und unten änderst du die Reihenfolge ohne Ziehen. Eigene Namen und vorhandene Wertbindungen bleiben erhalten. Ein Name wird nicht allein deshalb als falsch markiert, weil er noch nicht in einer Vorschau vorkommt.

Eine Zuordnung erhält einen eigenen Namen und Wert. **Umbenennen** öffnet einen Dialog; erst **Übernehmen** ändert den Namen. Leere oder bereits verwendete Namen werden erklärt, ohne eine andere Zuordnung zu überschreiben. **Abbrechen** erhält den bisherigen Stand. **Zuordnung hinzufügen** verwendet einen freien Namen.

## Ein Tabellenergebnis prüfen

Bei unterstützten Tabellenschritten führt **Datenvorschau** in den Eigenschaften direkt zur passenden Vorschauansicht. Dieser Wechsel liest noch keine Daten. **Zum Baustein** führt zur Bearbeitung zurück; beim direkten Rückweg bleiben Canvasposition und Zoom erhalten. Keiner dieser Ansichtswechsel startet einen Lauf.

Unter **Datenvorschau** wählst du **Ergebnis bis zu diesem Schritt** und startest bewusst **Datenvorschau laden**. Die Vorschau verarbeitet die notwendigen unterstützten Vorgänger bis einschließlich des gewählten Tabellenschritts. Unfertige Nachfolger werden dafür nicht benötigt; sie werden im bearbeiteten Workflow nicht gelöscht oder geändert.

Die Einzelvorschau unterstützt verbundene lesende Tabellenschritte im Hauptablauf. Schleifen, Verzweigungen und Dateiaktionen im benötigten Vorlauf erhalten einen konkreten Hinweis. Die Anzeige ist auf höchstens 200 Zeilen und 256 KiB begrenzt; Filter oder Gruppierungen können trotzdem die gesamte Quelle lesen. Spaltenvorschläge gehören zur ausgewählten Eingabetabelle. Bearbeitest du spätere Schritte, bleiben sie verwendbar. Änderungen am benötigten Vorlauf oder den Parameterwerten können die Vorschau veralten lassen; du lädst sie dann bewusst erneut.

## Prüflauf, Ausführung und frühere Läufe

Ein Business-Workflow beginnt in der Vorbereitung mit **Prüflauf ohne Zieländerungen**. Modus, Parametersatz, Quellen und Ausgabeziele bleiben vor dem Start prüfbar. Dokumentvorlagen zählen zu den Quellen, neu erstellte Dokumente zu den Ausgabezielen. Erst **Ausführen · echte Dateiänderungen** verändert fachliche Ziele. Grundbausteine und VBS erhalten keinen vorgetäuschten Prüflauf. **Stoppen** macht bereits vorgenommene Änderungen nicht rückgängig.

Relative Pfade verwenden automatisch den Arbeitsordner des Workflows. Externe Quellen bleiben lesbar; Ausgaben in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen. Die vollständigen Ablagepfade und Aufbewahrungsgrenzen beschreibt [WEITERENTWICKLUNG.md](WEITERENTWICKLUNG.md).

**Alle Läufe** zeigt gespeicherte Läufe dieses Workflows. **Anzeigen** öffnet Übersicht, Ergebnisse und Protokoll eines konkreten Laufs. Ein früherer Workflowstand wird kenntlich gemacht. **Protokoll kopieren** und **Protokoll exportieren** beziehen sich auf die Auswahl. Ansichtswechsel und das Öffnen alter Ergebnisse starten keine Verarbeitung.

## Einstellungen und Export

Die neue Office-Farbwelt beginnt bei einer neuen Installation mit **Hell**. Gespeicherte Entscheidungen bleiben erhalten; **Dunkel** und **System** stehen gleichwertig unter **Darstellung** bereit. UI-Textgröße und Canvaszoom sind getrennt.

Unter **Laufzeit** stehen der tatsächliche Status der mitgelieferten Python- und Business-Komponenten sowie **Erneut prüfen**. Versionen und Programmdatei sind lesend unter technischen Angaben erreichbar. Die Anwendung bietet dort keine Interpreterauswahl oder Online-/Offline-Paketinstallation mehr an.

Beim **Exportieren** werden Projektdatei, Script und Business-Paket unterschieden. Ein exportiertes Python-Script benötigt auf dem Zielcomputer Python; ein Business-Paket zusätzlich die in seiner Anleitung genannten Pakete. Das ZIP enthält Business-Module, aber keinen Python-Interpreter. Ein Export richtet auf dem Zielcomputer keine Umgebung ein und startet keinen Workflow.

## Nachweisgrenze dieses Stands

Die tatsächlichen Arbeitswege und verbleibenden Grenzen dokumentiert [REGELN-UND-DATEN.md](REGELN-UND-DATEN.md); die [Ansichtengalerie](regeln-daten/ANSICHTEN.html) zeigt den aktuellen Stand. Frühere Ansichten, Laufberichte oder Installerprüfungen bleiben ihrem damaligen Stand zugeordnet.
