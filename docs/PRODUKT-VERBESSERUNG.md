# Einfacher vom Baustein zum Ergebnis

Stand: 30. Oktober 2026. ScriptLab bleibt eine lokale Windows-Anwendung. Der Ausbau verbindet vorhandene Funktionen zu einem verständlicheren Arbeitsweg.

## Was sich geändert hat

- **Mehr Arbeitsfläche:** zwei Kopfzeilen mit Workflowidentität und Hauptaktionen sowie Arbeitsbereichen und Bearbeitungswerkzeugen. Bei 1280 × 720 benötigen sie tatsächlich 105 logische Pixel statt zuvor ungefähr 140. Der Speicherstatus bleibt sichtbar.
- **Weniger Zuordnung:** beim neuen Einfügen übernimmt ein Business-Baustein mit einer Eingabe seinen passenden sicheren direkten Vorgänger oder die einzige verfügbare Quelle. Mehrdeutige Eingaben und zwei Quellenrollen bleiben eine bewusste Auswahl. Einfügen samt Vorbelegung lässt sich gemeinsam rückgängig machen. Verschieben, Duplizieren und Laden setzen bestehende Referenzen nicht neu.
- **Ruhigere Formulare:** feste gültige Auswahlwerte benötigen kein Auswahlfeld. Häufige Angaben bleiben sichtbar; zusätzliche Import- und Layoutoptionen stehen unter „Weitere Einstellungen“. Fehler öffnen den passenden Abschnitt. Die PDF-Schriftwahl verwendet verständliche Namen.
- **Zusammenhängende Bearbeitung:** die Eigenschaften nennen den ausgewählten Schritt. „Datenvorschau“ öffnet dessen vorhandene Vorschauansicht. Erst „Datenvorschau laden“ verarbeitet die erforderlichen Quelldaten. „Zum Baustein“ kehrt zur Bearbeitung zurück; beim direkten Rückweg bleiben Canvasposition und Zoom erhalten. Auch der Rücksprung zu einem anderen Schritt setzt einen sichtbaren Fokus.
- **README für Nutzer:** kurze Anwendungsfälle, zwei echte Produktbilder und eine GIF-Bildfolge. Buildbefehle und technische Ablage stehen in [ENTWICKLUNG.md](ENTWICKLUNG.md).

Das Projektformat bleibt Schema 3. Die Formulargliederung und Navigationsaufträge sind UI-Angaben. Export, automatische Appablage und die mitgelieferte Python-Laufzeit behalten ihre tatsächliche Bedeutung.

## Tatsächlich geprüft

Die [Ansichtengalerie](produkt/ANSICHTEN.html) und der [Einzelnachweis](produkt/nachweise/sichtstand.json) zeigen die reale Windows-Electron-Anwendung mit isolierten temporären Profilen und synthetischen Daten. Das Aufnahmeprogramm liegt unter `scripts/produkt-ansichten.mjs`.

- 1280 × 720 in beiden Themen, zusätzlich 960 × 680 und 200 Prozent UI-Text; lange Titel bleiben vollständig über ihren Tooltip zugänglich.
- Vorschau öffnen und zurück: Editorinhalt, Speicherzustand und Canvas bleiben erhalten; der Ansichtswechsel erzeugt keinen Lauf. Auch der Rückweg nach einer anderen Schrittauswahl erhält einen sichtbaren Tastaturfokus.
- Eine echte Schrittvorschau zeigt Nord/Süd mit 150,00 und 80,00 Umsatz. Ein echter Prüflauf und eine echte Ausführung endeten erfolgreich; XLSX und PDF liegen im isolierten ScriptLab-Arbeitsordner. Dateigrößen und Hashes stehen im Einzelnachweis. Keine Rendererfehler aufgezeichnet.
- TypeScript und Produktionsbuild erfolgreich. Gezielt betroffene Prüfungen bestanden: 28 Editor-/Ereignisfälle, 38 Formular-/Feldfehlerfälle, 74 Datenvorschau-/Gestaltungsfälle und 132 grundlegende Python-/VBS-Generatorfälle. Das sind getrennte Suiten, keine addierte Gesamtabnahme.
- Zwei tatsächliche Electron-Tastaturwege bestanden: Strg+Z/Strg+Y auf einem Toolbarbutton und unmittelbares Rückgängig nach dem Einfügen. Veraltete Selektoren im gemeinsamen Sprachwahlhelfer und Setup wurden dafür auf die vorhandene Oberfläche aktualisiert.
- Die neue Quellenwahl wurde zusätzlich mit echtem Ziehen samt nativer Einfügemarkierung und mit der Klickalternative geprüft. Einmal Rückgängig entfernt den neuen Schritt samt Referenz; Wiederholen stellt dieselbe Referenz wieder her. Dabei wurde kein Workflow gestartet. Der [getrennte Nachweis](produkt/nachweise/quellenwahl.json) benennt den tatsächlich geprüften Quellstand.

Das GIF besteht aus fünf echten Bedienzuständen mit jeweils zwei Sekunden Anzeigedauer: Vorlage, geöffnete Kopie, Bausteineinstellungen, angeforderte Vorschauansicht und geladene Daten. Es zeigt keine simulierten Ergebnisse. Die README verlinkt zusätzlich ein Standbild.

GIF und HTML-Galerien gehören jetzt ebenfalls zu den Windows-Dokumentationsbeilagen. Die Paketprüfung vergleicht auch diese Dateien vollständig und bytegenau mit dem Quellbestand.

Dies ist eine eigene Sicht- und Funktionsprüfung, kein Nutzertest. Eine vollständige neue Windows-DPI-Matrix, Monitorwechsel, sämtliche Automatisierungen und eine vollständige Barrierefreiheitsabnahme wurden nicht durchgeführt. Vorherige Berichte behalten ihren damaligen Stand.
