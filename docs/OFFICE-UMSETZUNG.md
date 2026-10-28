# Office-Gestaltung und einfachere Business-Bedienung

Stand: 28. Oktober 2026. Diese Erweiterung setzt auf den bereits vorhandenen Workflow-, Entwurfs- und Laufmodellen auf.

## Tatsächlich umgesetzt

- Office-Farbwelt mit blauen Aktionen und neutralen Flächen, gleichwertig hell und dunkel. Ohne gespeicherte Auswahl beginnt ScriptLab hell; vorhandene Themen bleiben erhalten. Marke und Windows-Icon verwenden dieselbe neue Farbe. Bearbeitbare SVGs liegen unter `assets/`.
- Python und VBS bleiben ausdrücklich wählbar. Python 3.15.2 x64, Tcl/Tk und die elf festgelegten Business-Pakete gehören vollständig zur Windows-Anwendung. Es gibt keine Interpreterauswahl, Paketinstallation oder Abhängigkeit von einer vorhandenen Python-Installation im normalen App-Ablauf.
- Native Auswahl für tatsächliche Quellen, Vorlagen und unterstützte Eingangsordner. Ein gebundener Quellenparameter führt mit **Wert bearbeiten** zum Wert und bietet dort dieselbe Dateiauswahl. Abbrechen erhält den bisherigen Wert.
- Geeignete vorherige Tabellenergebnisse als Eingabeauswahl. Kurztexte am Block zeigen etwa den Filterwert oder **Nach Region**. Diese Anzeigen werden nicht im Workflow gespeichert und erzeugen keine fachliche Änderung.
- Datenvorschau direkt bis zum ausgewählten Tabellenschritt. Dafür ist keine Laufvorbereitung nötig. Unvollständige spätere Schritte blockieren die Vorschau nicht. Ausschnitte werden getrennt nach Schritt und Workflowstand gehalten; geänderte Werte machen sie als veraltet erkennbar.
- Ruhigere Vorschau: Schritt, Parametersatz und Aktion in einer Reihe; Herkunft und technische Begrenzungen unter Details. Die Tabelle erhält mehr sichtbare Höhe. Keine direkte Bearbeitung der Quelldaten.
- Eindeutige Feldfehler führen zur betroffenen Eingabe; verschachtelte Listen behalten ihren tatsächlichen Index. Kreuzfeldfehler erhalten keinen erfundenen Einzelbezug. Test-/Echtwerte und nur für den nächsten Lauf angepasste Werte bleiben unterscheidbar.
- Business-Vorbereitung beginnt mit **Prüflauf ohne Zieländerungen**. Alte Ergebnisse warnen in ihrer eigenen Ansicht, nicht in der Vorbereitung eines neuen Laufs. Stoppen bleibt während einer Ausführung erreichbar.
- Speichern und interne Laufausgaben verwenden weiterhin die App-Ablage. Nur Exporte benötigen einen Ausgabeort. Exportierte Python-Scripts beziehungsweise Business-Pakete benötigen auf dem Zielcomputer eine eigene passende Python-Umgebung; das ZIP enthält keinen Interpreter.

Die verbindlichen Rollen, Maße und Navigationsentscheidungen stehen im [Designsystem](gestaltung/DESIGNSYSTEM.md). Die [Bediennotiz](NEUE-BEDIENUNG.md) beschreibt die Wege. Originalquellen, Prüfsummen und Lizenzbeilagen der Laufzeit sind in [python-herkunft.md](../laufzeit/python-herkunft.md) dokumentiert.

## Tatsächliche Sicht- und Funktionsprüfung

[Ansichtengalerie](office/ANSICHTEN.html) und [Einzelnachweis](office/funktionsstand.json) stammen aus der realen Windows-Electron-Anwendung, mit einem eigenen temporären Profil und eindeutig synthetischen Daten. Dateidialoge wurden für reproduzierbare Auswahl und Abbruch auf Testpfade gelenkt; Verarbeitung und erzeugte Dateien sind echt.

Der abgeschlossene Weg umfasst Sprachwahl, automatisches Speichern, Quellenparameter auswählen/abbrechen, fehlende Spalte korrigieren, zwei unterschiedliche Schrittvorschauen trotz fehlendem späterem PDF-Ziel, Prüflauf, echte XLSX-/PDF-Ausgabe, Paketexport sowie Themenwechsel. Python im Suchpfad wurde für diesen App-Lauf ausgeschlossen und eine alte ungültige Interpretereinstellung bewusst beibehalten. Die App verwendete ihre mitgelieferte Laufzeit. Keine Renderer-Ausnahme wurde erfasst.

Zusätzlich wurde die tatsächlich paketierte App unter einem vorher bestätigten eigenen Temp-Profil gestartet: ohne Python im Suchpfad und mit absichtlich ungültigen Tcl/Tk-Umgebungsvariablen. Die App verwendete `resources/python`, bestätigte Tk sowie alle elf Pakete und erzeugte mit einem Python-Grundworkflow eine echte Datei. Der [gesonderte Nachweis](office/paket-laufzeit.json) nennt den getesteten Paketpfad und seine Grenzen; diese Runtimeprobe ist kein zweiter vollständiger UI-Arbeitsweg.

Die Ansichten wurden bei 1280 × 720 logischen Pixeln, zusätzlich bei 960 × 680 und mit 200 Prozent UI-Text aufgenommen und visuell angesehen. Persönliche Darstellungsänderungen verändern dabei weder Bausteine noch Speicherzustand. Dies ist eine eigene Sichtprüfung, kein durchgeführter Nutzertest.

Gezielte vorhandene Prüfungen decken Farbrollen/Kontraste, Formulare, Feldbezüge, Blockkurztexte, Vorschaukontext und das Abschneiden vor nicht benötigten Nachfolgern ab. TypeScript und Produktionsbuild sind geprüft. Frühere Gesamtregressionen, Lastprüfungen oder CI-Ergebnisse werden nicht als neue Abnahme ausgegeben.

## Verbleibende Grenzen

- Die direkte Schrittvorschau unterstützt lesende Tabellenschritte im verbundenen Hauptablauf. Schleifen, Verzweigungen und vorangehende Dateiaktionen benötigen weiterhin den vollständigen Ausführungskontext. Die Oberfläche erklärt diese Grenze.
- Höchstens 200 Vorschauzeilen und 256 KiB werden angezeigt. Eine Transformation kann dennoch die gesamte Quelle lesen. Die Gesamtzahl der Quelldaten wird nicht erfunden.
- Der installierbare lokale Build ist unsigniert. Eine Installation auf einer frischen Windows-VM, alle Kombinationen aus 100/125/150/200 Prozent Windows-DPI, Monitorwechsel, Kontrastdarstellungen und assistiven Technologien wurden in dieser Erweiterung nicht vollständig geprüft. 200 Prozent UI-Text sind keine Windows-DPI-Prüfung.
- VBS hängt weiterhin von der verfügbaren Windows-VBScript-Komponente ab. Eine vollständige erneute VBS-/Python-Regression und eine vollständige Barrierefreiheitsabnahme werden hier nicht behauptet.
