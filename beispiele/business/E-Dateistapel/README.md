# CSV-Dateistapel mit geprüfter Archivierung

Die Eingangsdateien sind vollständig synthetisch. Zwei CSV-Dateien sind gültig; die dritte besitzt eine Datenzeile mit zu wenigen Spalten. Der bewusst gestartete Ablauf schreibt jede gültige CSV vollständig in den Ausgabeordner, prüft das Ergebnis und erstellt erst anschließend die bestätigte Archivkopie. Erst danach wird die jeweilige gültige Eingangsdatei entfernt. Die fehlerhafte Datei bleibt mit unverändertem Inhalt im Eingang, und der Lauf enthält einen offenen Fehlerbericht.

Vorschau und Prüflauf ändern weder Eingang noch Ausgabe oder Archiv. Vorhandene Ziele werden mit `FEHLER` erhalten. Für eine bewusste Wiederaufnahme wird dasselbe Laufjournal mit unveränderten Parametern und bestätigten Ergebnissen benötigt. Bereits bestätigte Ausgaben werden geprüft und nicht doppelt angelegt. Ein abgebrochener oder unklarer Publikationsstand ist kein automatischer Freibrief zum Wiederholen; ein solcher Zustand muss anhand der echten Dateien geklärt werden.

`parameter.json` verwendet nur relative Testpfade. Das Journal enthält Kennungen, Zustände und Fingerabdrücke statt vollständiger CSV-Zeilen. Es ersetzt keinen Rollback bereits abgeschlossener Dateiaktionen.
