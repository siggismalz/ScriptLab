# Verfügbare Bausteine

Alle hier aufgeführten Bausteine besitzen einen eigenen VBS-Generator und eine deutsche Hilfe. Die Anwendung erzeugt ausschließlich Text. Die unten beschriebenen Wirkungen treten erst beim eigenständigen Start der exportierten VBS-Datei außerhalb von ScriptLab ein.

## Ablauf

| Baustein | Bedeutung |
| --- | --- |
| Workflow starten | Genau ein aktiver Start steht am Anfang des Hauptablaufs. |
| Kommentar hinzufügen | Fügt dem erzeugten Script einen lesbaren Kommentar hinzu. |
| Workflow beenden | Beendet das gestartete Script mit Erfolg. Danach kann kein weiterer Schritt angeschlossen werden. |

## Bedingungen

| Baustein | Bedeutung |
| --- | --- |
| Wenn / sonst | Führt abhängig von einer Wahrheitsbedingung einen der beiden inneren Abläufe aus. Leere Zweige sind erlaubt. |
| Werte vergleichen | Gleich, ungleich, größer oder kleiner. Die VBScript-Werttypen bestimmen den Vergleich; Textvergleiche beachten Groß-/Kleinschreibung. |
| Und / oder | Verknüpft zwei Wahrheitsbedingungen. VBScript wertet dabei beide Seiten aus. |
| Bedingung umkehren | Kehrt wahr und falsch um. |
| Datei oder Ordner vorhanden | Prüft genau einen Pfad auf eine Datei oder einen Ordner. |

## Schleifen

| Baustein | Bedeutung |
| --- | --- |
| Eine Anzahl wiederholen | Wiederholt einen Ablauf 0 bis 1.000.000-mal. Die ganze Anzahl wird einmal am Schleifenanfang ausgewertet. |
| Solange wiederholen | Prüft die Bedingung vor jedem Durchlauf. Der eigene Ablauf muss ein Ende ermöglichen, wenn keine Endlosschleife beabsichtigt ist. |
| Für jeden Listeneintrag | Durchläuft eine Liste in ihrer Reihenfolge. Eine benannte Variable enthält den aktuellen Eintrag. |
| Für jede Datei im Ordner | Durchläuft Dateien ohne Unterordner, nach Dateiname sortiert. Die benannte Variable enthält jeweils den vollständigen Dateipfad. |

## Dateien und Ordner

Alle relativen Pfade beziehen sich auf den Ordner der exportierten VBS-Datei. Platzhalter werden abgewiesen. Fehler beenden das gestartete Script mit einer Meldung und der Kennung des betroffenen Bausteins. Es gibt keine automatische Wiederholung fehlgeschlagener Dateioperationen.

| Baustein | Vorhandene Ziele, fehlende Quellen und weitere Regeln |
| --- | --- |
| Ordner anlegen | Legt fehlende Elternordner mit an. Ein vorhandener Ordner bleibt erhalten. Eine Datei an derselben Stelle ist ein Fehler. |
| Datei kopieren | Kopiert genau eine vorhandene Datei auf einen vollständigen Zieldateipfad. Der Zielordner muss existieren. Standardmäßig wird ein vorhandenes Ziel als Fehler gemeldet; „Überschreiben“ ersetzt eine vorhandene Zieldatei. Quelle und Ziel dürfen nicht gleich sein. |
| Datei verschieben | Verwendet dieselben Zielregeln. Kopiert zuerst die Datei und löscht die Quelle erst nach erfolgreichem Kopieren. Wenn das anschließende Löschen scheitert, meldet das Script den Fehler; beide Dateien können dann vorhanden sein. |
| Datei umbenennen | Benennt eine vorhandene Datei im gleichen Ordner um. Der neue Name darf keinen Pfad enthalten. Bereits belegte Ziele sind Fehler; es wird nicht überschrieben. |
| Dateien auflisten | Liefert eine Liste vollständiger Dateipfade, nach Dateiname sortiert, ohne Unterordner. Fehlender Ordner: Fehler. Leerer Ordner: leere Liste. |
| Dateiname aus Pfad | Liefert den letzten Dateinamen einschließlich Endung, beispielsweise `bericht.txt`. Dafür muss die Datei nicht existieren. |
| Textdatei lesen | Liest eine vorhandene Datei mit der ausdrücklich gewählten Kodierung UTF-8, UTF-16LE oder Windows-ANSI. Fehlende Datei: Fehler. |
| Textdatei schreiben | Ersetzt den gesamten Inhalt oder legt eine fehlende Datei an. Der Elternordner muss bereits existieren. |
| Textdatei ergänzen | Hängt Text an oder legt eine fehlende Datei an. Ein Zeilenumbruch wird nicht automatisch ergänzt. Bestehender Inhalt muss zur gewählten Kodierung passen. |
| Datei löschen (erweitert) | Löscht genau eine vorhandene Datei. Eine fehlende Datei ist ein Fehler. Standardmäßig fragt das gestartete Script vorher mit vorausgewähltem „Nein“ nach. Die Rückfrage lässt sich im Block bewusst abschalten. |

UTF-8- und UTF-16LE-Ausgaben besitzen eine BOM. Windows-ANSI verwendet die lokale Windows-Codepage und kann nicht jedes Unicode-Zeichen darstellen. Textdateiergänzungen lesen den vorhandenen Inhalt in der ausgewählten Kodierung und schreiben die zusammengefügte Datei neu; sie sind für überschaubare lokale Textdateien gedacht.

## Variablen und Listen

| Baustein | Bedeutung |
| --- | --- |
| Variable anlegen / setzen | Speichert einen Wert unter einem Namen. Namen werden ohne Unterschied nach Groß-/Kleinschreibung zugeordnet. Technische VBS-Namen werden intern sicher erzeugt. |
| Variable verwenden | Liest eine im verbundenen Ablauf angelegte Variable. Setze sie vor dem ersten Lesen. Bei einer möglicherweise zu frühen Verwendung erscheint ein Hinweis. |
| Text | Ein Textwert. Anführungszeichen, Umlaute und Steuerzeichen werden ausschließlich als Daten behandelt. |
| Zahl | Akzeptiert beispielsweise `5`, `2,5` oder `2.5`, ohne Tausendertrennzeichen. Erlaubter Betrag bis 10¹⁵. |
| Wahrheitswert | Wahr oder falsch. |
| Liste erstellen | Erstellt eine leere Liste. Speichere sie in einer Variable, bevor du Einträge hinzufügst. |
| Eintrag zur Liste hinzufügen | Hängt einen Wert an eine bereits angelegte Listenvariable. |
| Listeneintrag lesen | Liest einen Eintrag. Die Nummerierung beginnt bei 1. Fehlende Einträge führen zu einem Fehler. |

Textnamen sind keine Programmteile. Auch Variablennamen wie `Dim` oder `If` können eingegeben werden, weil der Generator unabhängige sichere technische Namen benutzt. Ein unterschiedlicher Anzeigename wird nicht als Zertifikatsidentität verwendet.

## Texte

| Baustein | Bedeutung |
| --- | --- |
| Texte verbinden | Verbindet zwei Werte als Text. |
| Zeilenumbruch | Ein Windows-Zeilenumbruch, also CRLF. |
| Text ersetzen | Ersetzt alle passenden Stellen unter Beachtung der Groß-/Kleinschreibung. Ein leerer Suchtext ist ein Fehler. |
| Textlänge | Zählt UTF-16-Codeeinheiten gemäß VBScript; manche Zeichen wie Emoji benötigen zwei Einheiten. |
| Groß- / Kleinschreibung | Ändert die Schreibweise gemäß den regionalen Windows-Einstellungen. |
| Enthaltenen Text prüfen | Liefert wahr, wenn der Suchtext enthalten ist. Groß-/Kleinschreibung werden beachtet. Ein leerer Suchtext gilt als enthalten. |

## Zahlen

| Baustein | Bedeutung |
| --- | --- |
| Grundrechenart | Addiert, subtrahiert, multipliziert oder dividiert zwei Zahlen. Auch dynamische Variablen werden numerisch geprüft. Division durch null ist ein Fehler. |
| Zahl runden | Rundet auf 0 bis 12 Nachkommastellen. Bei genau halben Werten verwendet VBScript die Rundung zur geraden Zahl. |
| Zufallszahl erzeugen | Ganze Zufallszahl einschließlich beider Grenzen. Ganze Grenzen von −1.000.000.000 bis 1.000.000.000; Minimum ≤ Maximum. Für Sicherheitszwecke ist diese Zufallszahl ungeeignet. |

## Ein- und Ausgaben

| Baustein | Bedeutung |
| --- | --- |
| Nachricht anzeigen | Zeigt einen Text mit einem OK-Knopf. |
| Texteingabe abfragen | Fragt nach Text. Abbrechen und leere Eingabe ergeben beide leeren Text. |
| Ja-/Nein-Frage | Liefert wahr bei Ja und falsch bei Nein. |
| Protokollzeile schreiben | Hängt lokale Datums-/Zeitangabe, Text und CRLF an eine UTF-8-Datei an. Ein vorhandener Inhalt muss UTF-8 sein. Der Elternordner muss existieren. |

## Datum und Zeit

| Baustein | Bedeutung |
| --- | --- |
| Aktuelles Datum | Aktuelles lokales Datum als Datumswert. |
| Aktuelle Uhrzeit | Aktuelle lokale Uhrzeit als Datumswert. |
| Datum formatieren | Formatiert einen Datumswert als `JJJJ-MM-TT`, `HH:MM:SS` oder beide zusammen. Ungültige Datumswerte sind Fehler. |
| Eine Zeit warten | Wartet im gestarteten Script 0 bis 86.400 Sekunden. Bruchteile sind erlaubt und werden auf ganze Millisekunden gerundet. ScriptLab selbst wartet beim Bearbeiten oder Exportieren nicht. |

## Bewusste Grenzen

Freier Programmcode, allgemeine Shellbefehle, Office-Automation und E-Mail-Versand gehören nicht zum Bausteinumfang. Es gibt keinen Startknopf und keinen Testlauf für Workflows in ScriptLab. Die Codevorschau ist schreibgeschützter Text.

Die spätere Ausführung benötigt Windows Script Host, die verfügbare VBScript-Komponente und – bei Dateiaktionen – die standardmäßigen Windows-Komponenten `Scripting.FileSystemObject` und für UTF-8/UTF-16LE `ADODB.Stream`. Unternehmensrichtlinien können diese Komponenten oder das Script sperren. Die Bearbeitung, das Speichern und der unsignierte Export in ScriptLab funktionieren unabhängig davon offline.
