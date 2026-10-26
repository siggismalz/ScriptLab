# Startseite und lokale Arbeitsstaende

Die Startseite ersetzt den direkten Editorstart. Der bestehende Blockly-Arbeitsbereich bleibt beim Wechsel zur Startseite geladen. Auswahl, Verlauf und Ansicht werden dadurch nicht neu aufgebaut. Es bleibt bei einem aktiven Editorprojekt.

Die vier Einstiege teilen sich die vorhandenen Tokens und Komponenten. Bekannte Dateien, Entwuerfe und lokale Hilfe erhalten eigene Inhaltsansichten. Ein Projektindex erfasst nur bewusst geoeffnete oder gespeicherte Dateien; er durchsucht keine Laufwerke. Verfuegbarkeitspruefungen erfolgen getrennt von der schnellen Indexanzeige und haben ein Zeitlimit.

Entwuerfe sind gepruefte, atomar geschriebene lokale Projektstaende im Anwendungsdatenordner. Eine Kennung bleibt beim Sichern erhalten. Neue Entwuerfe entstehen durch inhaltliche Bearbeitung, nicht durch reinen Canvas-Zoom. Gesicherte Aenderungen behalten Ausgangspfad und Dateifingerabdruck. Automatische Sicherung ersetzt niemals die bewusst gespeicherte Projektdatei und hebt ihren Aenderungsstatus nicht auf.

Vor dem Ersetzen eines Arbeitsstands stehen Speichern, als Entwurf behalten, Aenderungen verwerfen und Abbrechen zur Verfuegung. Der Hauptprozess entscheidet erst nach erfolgreicher Sicherung beziehungsweise ausdruecklichem Verwerfen ueber den Wechsel. Eine extern geaenderte Ausgangsdatei verlangt eine separate Kopie. Die vorhandenen Sicherheitsgrenzen und der reine VBS-Export gelten unveraendert.

Die Umsetzung wird in Navigation, lokale Ablage, Inhaltsansichten und gepruefte Integration aufgeteilt. Tests verwenden isolierte Profile und Testdateien. Wiederherstellung, Abbrueche, Schreibfehler, fehlende Dateien, Beispiele als Kopien und der Rueckweg zum unveraenderten Editor werden gesondert geprueft. Der tatsaechliche Abschluss wird in STARTSEITE.md festgehalten.
