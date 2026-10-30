# Regeln und Daten einfacher bearbeiten

Stand: 30. Oktober 2026. Der Ausbau verwendet die vorhandenen Business-Bausteine und Ausführungsmodelle. Es entstehen keine zusätzlichen Hauptbereiche und kein neues Projektformat.

## Bedienung

- **Filter:** Spalte, Vergleich und Vergleichswert stehen direkt zusammen. Weitere Wertquellen und Datentypen lassen sich gezielt öffnen. Gruppen verlangen alle oder mindestens eine Bedingung; Umkehren, Gruppieren und Auflösen sind getrennte Aktionen. Ein Wechsel von UND zu ODER erhält die direkten Kinder, statt eine unveränderte UND-Gruppe nur zu umschließen.
- **Zuordnungen:** Ein Name wird erst nach „Übernehmen“ im Umbenennungsdialog geändert. Leere oder doppelte Namen lassen alle Zuordnungen und den eingegebenen Text erhalten. Neue Einträge erhalten einen tatsächlich freien Namen. Die geprüfte Änderung ist atomar rückgängig; der Fokus kehrt zur umbenannten Zeile zurück.
- **Spalten:** Eine vorhandene quellengenaue Vorschau liefert eine suchbare Mehrfachauswahl. Die bestehende Reihenfolge bleibt erhalten; Auf/Ab ordnet die Auswahl ohne Ziehen. Manuelle Namen und gespeicherte Bindungen bleiben zugänglich. Erlaubte Prüfwerte und PDF-Seitenbereiche werden nicht irrtümlich als Tabellenspalten dargestellt.
- **Aktuelle Vorschläge:** Änderungen an späteren Schritten entwerten die unveränderte Quellenvorschau nicht mehr. Der Vergleich verwendet den tatsächlich benötigten Vorlauf und den Parameterkontext. Ein ungültig gewordener Vorlauf liefert keine als aktuell geltenden Vorschläge. Das Öffnen des Formulars liest weiterhin keine Quelldateien.
- **Datenfunktionen:** Die bereits vorhandenen Funktionen für Jahr, Monat, Tag, Rand-Leerzeichen, Groß-/Kleinschreibung, Textlänge und Mustersuche sind im Formular editierbar. Funktionswechsel erhalten das Argument. Eine umschlossene Berechnung lässt sich wiederherstellen, ohne die Funktion unbemerkt beizubehalten.
- **Qualitätsregeln:** Pflichtwerte, Schlüssel, Wertebereiche, Datentypen, erlaubte Werte und Zeilenzahlen zeigen jeweils passende Angaben. Fertige Regeln lassen sich einklappen; erkannte Probleme öffnen die passende Regel. Vorhandene Einzelspalten-Schlüssel und andere alte Angaben werden beim Anzeigen nicht umgeschrieben. Bei Dezimalbeträgen bleiben Nachkommastellen direkt erreichbar; die Gesamtzahl der Ziffern steht unter „Genauigkeit anpassen“.
- **Laufvorbereitung:** Vorlagen und Eingangsdateien zählen als Quellen, neue Dokumente als Ziele. Weitere Quellen und Ziele werden angekündigt. Nach einem Workflowwechsel stimmen Vorgaben, Startbeschriftung und Wirkungshinweis überein. Bereits gewählte Modi bleiben erhalten. Der Ausführungsdienst hat fehlenden Business-Kontext bereits zuvor abgewiesen; ein solcher Zustand führte nicht zu einer echten Ausführung.

Die [Bedienhilfe](NEUE-BEDIENUNG.md) erklärt den Arbeitsweg, das [Designsystem](gestaltung/DESIGNSYSTEM.md) die gemeinsamen Darstellungsregeln. Die Nutzer-README bleibt kurz; ihre Produktbilder und das GIF wurden mit der aktuellen App neu aufgenommen.

## Tatsächliche Sicht- und Funktionsprüfung

Die [Galerie](regeln-daten/ANSICHTEN.html) zeigt die Windows-Anwendung bei 1280 × 720 logischen Pixeln. Hinzu kommen beide Themen, 960 × 680 und 200 Prozent UI-Text. Die [Einzelergebnisse](regeln-daten/sichtstand.json) stammen aus `scripts/regeln-daten-ansichten.mjs` mit isoliertem temporärem Nutzerprofil und synthetischen Daten. Die native Dateiauswahl wurde auf vorbereitete Beispielprojekte gelenkt; die Datenverarbeitung war echt.

Tatsächlich durchlaufen wurden:

1. UND/ODER wechseln, rückgängig machen und wiederholen; die echte ODER-Vorschau enthält beide Regionen.
2. Doppelten Zuordnungsnamen zurückweisen, gültig umbenennen, den Fokus erhalten und die Änderung rückgängig machen. Ein neuer Eintrag überschreibt trotz Namenslücken keinen vorhandenen Wert.
3. Mehrere Spalten aus einer echten Quellenvorschau wählen, umordnen und die Reihenfolge rückgängig machen. Die Vorschläge bleiben nach der ersten Auswahl sichtbar.
4. Monatsfunktion und Mustersuche konfigurieren und ihre tatsächlichen Vorschauergebnisse laden.
5. Pflichtwert-, Zeilenzahl- und Bereichsregeln bearbeiten. Andere vorhandene Angaben bleiben erhalten. Ein echter Prüflauf mit Bereichs- und Schlüsselprüfung endet erfolgreich.
6. Eine Vorlagendatei in der Vorbereitung als Quelle und den Bericht als Ziel darstellen. Dieser Fall prüft die Darstellung; es wurde keine Vorlagendatei verarbeitet.

Es wurden keine Rendererfehler aufgezeichnet. TypeScript und Produktionsbuild bestehen. Sechs gezielt betroffene Testsuiten mit insgesamt 72 Fällen bestanden; diese Zahl ist ein einzelner aktueller Lauf, keine Addition früherer Zwischenläufe.

`scripts/produkt-ansichten.mjs` hat zusätzlich die Nutzerbilder und die fünf tatsächlichen GIF-Bedienzustände aktualisiert. Der [zugehörige Bericht](produkt/nachweise/sichtstand.json) enthält den echten Prüflauf sowie XLSX-/PDF-Ausgaben mit Größen und Hashes.

Dies ist eine eigene Sicht- und Funktionsprüfung, kein Nutzertest. Eine vollständige Windows-DPI-Matrix, Monitorwechsel, sämtliche VBS-/Python-Automatisierungen und eine vollständige Barrierefreiheitsabnahme wurden nicht erneut geprüft. Ältere Berichte behalten ihren damaligen Stand.
