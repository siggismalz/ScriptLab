# B: Bestellungen mit bewusst fehlerhaften Zuordnungen

Alle Daten sind erfunden. B1/K1/30,00, B2/K2/40,00 und B3/K1/15,00 werden den eindeutigen Kunden K1/Nord und K2/Süd zugeordnet. B4/K9/5,00 hat keinen Kundenstamm. Die Vorschau der fehlenden Zuordnungen zeigt ausdrücklich **B4 / K9**; eine Qualitätsregel meldet genau einen Fehler. Dieser Datensatz wird aus der nachfolgenden Auswertung ausgeschlossen.

Sollwerte der XLSX-Auswertung: Nord **45,00**, Süd **40,00**, Gesamt **85,00** aus genau drei zugeordneten Bestellungen. Der Lauf endet mit einem fachlichen Fehlerhinweis, obwohl die ausdrücklich gefilterte Auswertung geschrieben werden darf; es wird kein uneingeschränkter Erfolg behauptet.

Für den zweiten Fehlerfall `Kundendatei` auf `eingaben/kunden-doppelt.csv` setzen. Der zweite K1 muss den `n:1`-Join stoppen. Dieser Lauf darf keine Auswertung erzeugen. Die Engine wählt keine zufällige Kundenzeile und vervielfacht keine Bestellungen.

Basisordner ist dieser Beispielordner oder eine eigene Kopie. `parameter.json` und `plan.json` enthalten den festen Vertrag für Runner und Projektgenerator. Öffnen/Vorschau ändern keine fachlichen Dateien; Prüflauf plant nur. Erst bewusst gewähltes Ausführen schreibt die Auswertung. Vorhandene Ziele stoppen den Lauf. Keine echten Geschäftsdaten.
