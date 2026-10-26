# A: Monatsauswertung mit synthetischen Umsätzen

Die vier CSV-Zeilen sind erfundene Testdaten. Der Parameter `Berichtsmonat` wählt einen ISO-Monat (`2026-10`). Drei Oktoberzeilen ergeben Nord **150,00**, Süd **80,00** und insgesamt **230,00**. Die Septemberzeile mit 70,00 gehört nicht zum Bericht.

Der Plan liest CSV als Text, wandelt Datum und Geldbetrag ausdrücklich um, filtert den Monat und gruppiert die Beträge. Er ergänzt eine Gesamtzeile und schreibt dieselbe Ergebnistabelle als XLSX und PDF. Beide Berichte enthalten Region, Datensätze und Betrag. Die Dezimalbeträge bleiben im XLSX als Text genau erhalten.

Vor einem echten Lauf `Schriftdatei` auf eine selbst verfügbare `.ttf`-Schrift setzen, die deutsche Zeichen enthält. Die Schrift wird nicht mit diesem Beispiel verteilt. Unter Windows kann eine berechtigt vorhandene Systemschrift gewählt werden. Für den PDF-Bericht muss sie lesbar sein.

Basisordner ist dieser Beispielordner beziehungsweise eine eigene Kopie davon. Alle Eingabe-/Ausgabepfade sind dazu relativ. `parameter.json` zeigt die zu belegenden Parameter. `plan.json` ist der feste Zwischenplan für Runner und automatisierte Fachprüfung; die zugehörige `.scriptlab`-Projektdatei wird durch den Projektgenerator erstellt.

Öffnen und Vorschau erstellen keine Berichte. Prüflauf plant die Ausgaben. Erst ausdrücklich gewähltes Ausführen schreibt die beiden Dateien. Vorhandene Ziele stoppen den Lauf; es wird nichts ungefragt ersetzt. Den Beispielordner für jede unabhängige Probe kopieren oder eigene Zielnamen wählen.

Automatisierte Sollprüfung: drei gefilterte Datensätze; Nord=150, Süd=80, Gesamt=230 und Anzahl=3 in XLSX sowie extrahierbarem PDF-Text. Die Eingabe muss bytegleich bleiben. Keine echten Kunden- oder Geschäftsdaten.
