# Verfügbare Bausteine

Alle 48 hier aufgeführten Bausteintypen besitzen eine deutsche Hilfe und Codegenerierung für Python und VBS. Die Sprache wird beim Erstellen des Projekts festgelegt; Form und Bedeutung der Bausteine bleiben gleich. Bearbeiten, Strukturprüfung, Vorschau und Export führen die beschriebenen Aktionen nicht aus. Sie wirken erst bei einem bewusst gestarteten Test in ScriptLab oder beim eigenständigen Start der exportierten `.py`- beziehungsweise `.vbs`-Datei. Ein Test hat echte Auswirkungen und ist keine Sandbox; siehe [Testläufe](TESTLAUF.md) und [Python](PYTHON.md).

Die folgenden Regeln gelten für beide Sprachen. Damit etwa Wertumwandlungen, Vergleiche, Rundung und regionale Groß-/Kleinschreibung dieselbe Blockbedeutung behalten, verwendet der Python-Export feste Windows-Hilfen aus der Standardbibliothek (`ctypes` mit lokalen OleAut32-/NLS-APIs). Er benötigt dafür weder VBScript noch einen COM-Server oder zusätzliche Python-Pakete. Es handelt sich nicht um eine freie Python-Codeeingabe.

## Ablauf

| Baustein             | Bedeutung                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Workflow starten     | Genau ein aktiver Start steht am Anfang des Hauptablaufs.                                         |
| Kommentar hinzufügen | Fügt dem erzeugten Script einen lesbaren Kommentar hinzu.                                         |
| Workflow beenden     | Beendet das gestartete Script mit Erfolg. Danach kann kein weiterer Schritt angeschlossen werden. |

## Bedingungen

| Baustein                    | Bedeutung                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wenn / sonst                | Führt abhängig von einer Wahrheitsbedingung einen der beiden inneren Abläufe aus. Leere Zweige sind erlaubt.                                      |
| Werte vergleichen           | Gleich, ungleich, größer oder kleiner. Die gemeinsamen Windows-Wertregeln bestimmen den Vergleich; Textvergleiche beachten Groß-/Kleinschreibung. |
| Und / oder                  | Verknüpft zwei Wahrheitsbedingungen. Beide Seiten werden ausgewertet.                                                                             |
| Bedingung umkehren          | Kehrt wahr und falsch um.                                                                                                                         |
| Datei oder Ordner vorhanden | Prüft genau einen Pfad auf eine Datei oder einen Ordner.                                                                                          |

## Schleifen

| Baustein                 | Bedeutung                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Eine Anzahl wiederholen  | Wiederholt einen Ablauf 0 bis 1.000.000-mal. Die ganze Anzahl wird einmal am Schleifenanfang ausgewertet.                         |
| Solange wiederholen      | Prüft die Bedingung vor jedem Durchlauf. Der eigene Ablauf muss ein Ende ermöglichen, wenn keine Endlosschleife beabsichtigt ist. |
| Für jeden Listeneintrag  | Durchläuft eine Liste in ihrer Reihenfolge. Eine benannte Variable enthält den aktuellen Eintrag.                                 |
| Für jede Datei im Ordner | Durchläuft Dateien ohne Unterordner, nach Dateiname sortiert. Die benannte Variable enthält jeweils den vollständigen Dateipfad.  |

## Dateien und Ordner

Relative Pfade beziehen sich beim Export auf den Ordner der jeweiligen Scriptdatei und beim Test auf den ausgewählten Basisordner. Absolute Pfade können auch außerhalb dieses Basisordners wirken. Platzhalter werden abgewiesen. Fehler beenden das gestartete Script mit einer Meldung und der Kennung des betroffenen Bausteins. Es gibt keine automatische Wiederholung fehlgeschlagener Dateioperationen.

| Baustein                  | Vorhandene Ziele, fehlende Quellen und weitere Regeln                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordner anlegen            | Legt fehlende Elternordner mit an. Ein vorhandener Ordner bleibt erhalten. Eine Datei an derselben Stelle ist ein Fehler.                                                                                                                                            |
| Datei kopieren            | Kopiert genau eine vorhandene Datei auf einen vollständigen Zieldateipfad. Der Zielordner muss existieren. Standardmäßig wird ein vorhandenes Ziel als Fehler gemeldet; „Überschreiben“ ersetzt eine vorhandene Zieldatei. Quelle und Ziel dürfen nicht gleich sein. |
| Datei verschieben         | Verwendet dieselben Zielregeln. Kopiert zuerst die Datei und löscht die Quelle erst nach erfolgreichem Kopieren. Wenn das anschließende Löschen scheitert, meldet das Script den Fehler; beide Dateien können dann vorhanden sein.                                   |
| Datei umbenennen          | Benennt eine vorhandene Datei im gleichen Ordner um. Der neue Name darf keinen Pfad enthalten. Bereits belegte Ziele sind Fehler; es wird nicht überschrieben.                                                                                                       |
| Dateien auflisten         | Liefert eine Liste vollständiger Dateipfade, nach Dateiname sortiert, ohne Unterordner. Fehlender Ordner: Fehler. Leerer Ordner: leere Liste.                                                                                                                        |
| Dateiname aus Pfad        | Liefert den letzten Dateinamen einschließlich Endung, beispielsweise `bericht.txt`. Dafür muss die Datei nicht existieren.                                                                                                                                           |
| Textdatei lesen           | Liest eine vorhandene Datei mit der ausdrücklich gewählten Kodierung UTF-8, UTF-16LE oder Windows-ANSI. Fehlende Datei: Fehler.                                                                                                                                      |
| Textdatei schreiben       | Ersetzt den gesamten Inhalt oder legt eine fehlende Datei an. Der Elternordner muss bereits existieren.                                                                                                                                                              |
| Textdatei ergänzen        | Hängt Text an oder legt eine fehlende Datei an. Ein Zeilenumbruch wird nicht automatisch ergänzt. Bestehender Inhalt muss zur gewählten Kodierung passen.                                                                                                            |
| Datei löschen (erweitert) | Löscht genau eine vorhandene Datei. Eine fehlende Datei ist ein Fehler. Standardmäßig fragt das gestartete Script vorher mit vorausgewähltem „Nein“ nach. Die Rückfrage lässt sich im Block bewusst abschalten.                                                      |

Die von Dateiaktionen geschriebenen UTF-8- und UTF-16LE-Textdateien besitzen eine BOM. Das ist unabhängig vom Exportformat: Python-Quelltext erhält keine BOM. Windows-ANSI verwendet die lokale Windows-Codepage und kann nicht jedes Unicode-Zeichen darstellen. Textdateiergänzungen lesen den vorhandenen Inhalt in der ausgewählten Kodierung und schreiben die zusammengefügte Datei neu; sie sind für überschaubare lokale Textdateien gedacht. Eine fremde BOM, fehlerhaftes UTF-8 oder nicht wohlgeformtes UTF-16LE führt vor dem Überschreiben zum Fehler. Gültige Dateien behalten die gewählte Kodierung; Zeilenumbrüche werden nur durch den vorgegebenen Text ergänzt.

## Variablen und Listen

| Baustein                     | Bedeutung                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable anlegen / setzen    | Speichert einen Wert in der ausgewählten Variable. Die Auswahl verweist auf eine stabile ID; technische Namen für beide Scriptsprachen werden intern sicher erzeugt. |
| Variable verwenden           | Liest eine im verbundenen Ablauf angelegte Variable. Setze sie vor dem ersten Lesen. Bei einer möglicherweise zu frühen Verwendung erscheint ein Hinweis.            |
| Text                         | Ein Textwert. Anführungszeichen, Umlaute und Steuerzeichen werden ausschließlich als Daten behandelt.                                                                |
| Zahl                         | Akzeptiert beispielsweise `5`, `2,5` oder `2.5`, ohne Tausendertrennzeichen. Erlaubter Betrag bis 10¹⁵.                                                              |
| Wahrheitswert                | Wahr oder falsch.                                                                                                                                                    |
| Liste erstellen              | Erstellt eine leere Liste. Speichere sie in einer Variable, bevor du Einträge hinzufügst.                                                                            |
| Eintrag zur Liste hinzufügen | Hängt einen Wert an eine bereits angelegte Listenvariable.                                                                                                           |
| Listeneintrag lesen          | Liest einen Eintrag. Die Nummerierung beginnt bei 1. Fehlende Einträge führen zu einem Fehler.                                                                       |

Variablen werden über ihre Auswahl im Block oder in den Eigenschaften zugeordnet. **Neue Variable anlegen** erstellt einen Eintrag; das Blockly-Auswahlmenü bietet das Umbenennen. Eine Umbenennung erhält die ID und aktualisiert alle Bezüge derselben Variable. Alte Schema-1-Namen werden beim Laden unter Beibehaltung ihrer früheren Zuordnung ohne Beachtung der Groß-/Kleinschreibung migriert. Leere ungültige Zuordnungen müssen vor dem Export korrigiert werden.

Anzeigenamen sind keine Programmteile. Auch Variablennamen wie `Dim`, `If` oder `class` sind möglich, weil die Generatoren unabhängige sichere technische Namen benutzen. Ein Anzeigename wird nicht als Zertifikatsidentität verwendet.

## Texte

| Baustein                | Bedeutung                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Texte verbinden         | Verbindet zwei Werte als Text.                                                                                                |
| Zeilenumbruch           | Ein Windows-Zeilenumbruch, also CRLF.                                                                                         |
| Text ersetzen           | Ersetzt alle passenden Stellen unter Beachtung der Groß-/Kleinschreibung. Ein leerer Suchtext ist ein Fehler.                 |
| Textlänge               | Zählt in beiden Sprachen UTF-16-Codeeinheiten; manche Zeichen wie Emoji benötigen zwei Einheiten.                             |
| Groß- / Kleinschreibung | Ändert die Schreibweise gemäß den regionalen Windows-Einstellungen.                                                           |
| Enthaltenen Text prüfen | Liefert wahr, wenn der Suchtext enthalten ist. Groß-/Kleinschreibung werden beachtet. Ein leerer Suchtext gilt als enthalten. |

## Zahlen

| Baustein             | Bedeutung                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grundrechenart       | Addiert, subtrahiert, multipliziert oder dividiert zwei Zahlen. Auch dynamische Variablen werden numerisch geprüft. Division durch null ist ein Fehler.                         |
| Zahl runden          | Rundet auf 0 bis 12 Nachkommastellen nach denselben Windows-Regeln in beiden Sprachen. Bei genau halben Werten wird zur geraden Zahl gerundet.                                  |
| Zufallszahl erzeugen | Ganze Zufallszahl einschließlich beider Grenzen. Ganze Grenzen von −1.000.000.000 bis 1.000.000.000; Minimum ≤ Maximum. Für Sicherheitszwecke ist diese Zufallszahl ungeeignet. |

## Ein- und Ausgaben

| Baustein                 | Bedeutung                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text ausgeben            | Schreibt Text und ein Zeilenende in die Testausgabe. Ein Python-Export schreibt in die Standardausgabe. VBS zeigt unter `cscript.exe` Konsolenausgabe, unter `wscript.exe` eine Windows-Nachricht. |
| Nachricht anzeigen       | Zeigt einen Text mit einem OK-Knopf.                                                                                                                                                               |
| Texteingabe abfragen     | Fragt nach Text. Abbrechen und leere Eingabe ergeben beide leeren Text.                                                                                                                            |
| Ja-/Nein-Frage           | Liefert wahr bei Ja und falsch bei Nein.                                                                                                                                                           |
| Protokollzeile schreiben | Hängt lokale Datums-/Zeitangabe, Text und CRLF an eine UTF-8-Datei an. Ein vorhandener Inhalt muss UTF-8 sein. Der Elternordner muss existieren.                                                   |

Python verwendet für Nachricht, Texteingabe, Ja-/Nein-Frage und aktivierte Löschrückfrage `tkinter`. ScriptLab prüft dessen Verfügbarkeit vor einem solchen Test. Ohne diese Dialogbausteine ist kein `tkinter` erforderlich. VBS verwendet die Dialoge des Windows Script Host. Eine abgebrochene Texteingabe liefert in beiden Sprachen leeren Text.

## Datum und Zeit

| Baustein          | Bedeutung                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktuelles Datum   | Aktuelles lokales Datum als Datumswert.                                                                                                                                                  |
| Aktuelle Uhrzeit  | Aktuelle lokale Uhrzeit als Datumswert.                                                                                                                                                  |
| Datum formatieren | Formatiert einen Datumswert als `JJJJ-MM-TT`, `HH:MM:SS` oder beide zusammen. Ungültige Datumswerte sind Fehler.                                                                         |
| Eine Zeit warten  | Wartet im gestarteten Script 0 bis 86.400 Sekunden. Bruchteile sind erlaubt und werden auf ganze Millisekunden gerundet. ScriptLab selbst wartet beim Bearbeiten oder Exportieren nicht. |

## Bewusste Grenzen

Freier Programmcode, allgemeine Shellbefehle, Office-Automation und E-Mail-Versand gehören nicht zum Bausteinumfang. **Testen** führt ausschließlich den vollständigen aktuellen, geprüften Workflow aus. Es gibt keine automatische Ausführung oder Zeitplanung. Die Codevorschau ist schreibgeschützter Text.

Die spätere Ausführung benötigt bei Python stabiles CPython 3.12 bis 3.15 für Windows x64 und bei Dialogen `tkinter`. VBS benötigt Windows Script Host, die verfügbare VBScript-Komponente und – bei Dateiaktionen – die standardmäßigen Windows-Komponenten `Scripting.FileSystemObject` und für UTF-8/UTF-16LE `ADODB.Stream`. Unternehmensrichtlinien können Komponenten oder Scripts sperren. Bearbeiten, Speichern und unsignierter Export in ScriptLab funktionieren unabhängig von beiden Laufzeiten offline. Ein exportiertes Script benötigt beim Empfänger keine ScriptLab- oder Node.js-Installation.
