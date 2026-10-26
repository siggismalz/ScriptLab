# ScriptLab bedienen

ScriptLab erstellt, prüft und speichert Windows-Workflows als Bausteine. Beim Export schreibt die Anwendung eine eigenständige VBS-Datei. **ScriptLab führt den Workflow niemals aus.** Auch eine Vorschau, eine Prüfung, das Öffnen eines Beispiels und das Signieren lösen keine Workflowaktionen aus.

Entwickelt von Leon Stolz.

## Auf der Startseite beginnen

ScriptLab öffnet zuerst die Startseite. **Neuer Workflow** führt ohne Namensdialog in den Editor mit einem Startbaustein; **Workflow öffnen** lädt eine selbst gewählte `.scriptlab`-Datei. Wenn bereits ein Workflow aktiv ist, führt **Weiterbearbeiten** zu demselben Stand zurück. Auch der Wechsel über **Startseite** im Editor erhält Bausteine, Auswahl und Ansicht.

Die vier Bereiche stehen in dieser Reihenfolge:

| Bereich                       | Inhalt                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Meine gespeicherten Workflows | Bekannte Projektdateien anhand von Name oder Pfad suchen und weiterbearbeiten.      |
| Entwürfe                      | Lokal gesicherte Zwischenstände bewusst fortsetzen oder als Projektdatei speichern. |
| Beispielworkflows             | Drei vorhandene Vorlagen als eigene bearbeitbare Kopien öffnen.                     |
| Dokumentation und Anleitungen | Sieben lokale Hilfethemen durchsuchen; Treffer führen zur passenden Artikelstelle.  |

**Einstellungen**, **Hilfe** und **Über ScriptLab** sind im Kopf der Startseite erreichbar. Die Hilfe funktioniert offline; Beispielverweise darin öffnen ebenfalls eine Vorlage als Kopie.

## Eine erste Nachricht erstellen

1. Wähle auf der Startseite **Neuer Workflow**. Das neue Projekt enthält nur **Workflow starten** und den Hinweis „Füge links einen Baustein hinzu“.
2. Suche links nach **Nachricht**. Klicke beim Treffer **Nachricht anzeigen** auf Plus und wähle **Nach „Workflow starten“**. Damit ist die Nachricht bereits mit dem Ablauf verbunden.
3. Klicke auf das Textfeld am Nachrichtenbaustein und schreibe deine Nachricht. Alternativ wählst du den Baustein aus und öffnest **Eigenschaften** über die Werkzeugleiste oder F4. Dort stehen dieselben Werte in größeren Eingabefeldern.
4. Öffne das **Projektmenü** neben **Speichern** und wähle **Projektangaben**, wenn du Namen oder Beschreibung ändern möchtest. **Übernehmen** aktualisiert die Angaben; die Projektdatei wird erst mit **Speichern** geschrieben.
5. Speichere über **Speichern** eine `.scriptlab`-Projektdatei. Diese Datei erhält die Bausteine, ihre Verbindungen, Kommentare und die Ansicht für die spätere Bearbeitung. Zum Prüfen des erzeugten Texts kannst du **Codevorschau** öffnen: Sie erscheint als schreibgeschützter Bereich unten und ist anfangs geschlossen.
6. Wähle **Als VBS exportieren** und einen Speicherort für die `.vbs`-Datei. Ein normaler Export benötigt kein Zertifikat.
7. Nach erfolgreichem Export erscheint: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ **Speicherordner anzeigen** öffnet den Ordner; ScriptLab startet die Datei dabei nicht.

Der selbstständige Start außerhalb von ScriptLab ist deine eigene Entscheidung. Dafür muss Windows die optionale VBScript-Komponente bereitstellen und deine Richtlinie die Ausführung erlauben. ScriptLab aktiviert keine Windows-Features und ändert keine Sicherheitsrichtlinien.

## Bausteine verbinden und bearbeiten

Wähle links eine beschriftete Kategorie. **Ein- und Ausgaben** ist anfangs geöffnet. Ziehe einen Baustein am Namen aus der aufgeklappten Liste in den Arbeitsbereich. Die Suchleiste durchsucht alle Kategorien anhand von Name, Kategorie und Hilfe. Treffer zeigen ihre Kategorie; bei „Keine Bausteine gefunden“ kannst du **Suche leeren** wählen. Danach erscheint wieder die zuvor geöffnete Kategorie.

Ein Workflow besitzt genau einen aktiven Startbaustein. Anweisungen werden untereinander verbunden. Ihre Verbindungen legen die Reihenfolge fest; ihre Position auf dem Raster tut das nicht. Werte und Bedingungen passen in die dafür geformten Eingänge. „Wenn / sonst“ und Schleifen nehmen weitere Anweisungen in ihren inneren Abläufen auf.

Ziehe einen verbundenen Baustein heraus, um ihn zu lösen oder neu einzusetzen. Eine Einfügemarkierung zeigt passende Anschlüsse. **Escape** bricht das Ziehen ab und stellt den vorherigen Zustand wieder her. Das dezente Punktraster hilft beim Anordnen.

Das Mausrad, Ziehen am freien Arbeitsbereich, die Bildlaufleisten und die vier Ansichtspfeile verschieben den sichtbaren Ausschnitt. **Strg+Mausrad** zoomt nur über der Arbeitsfläche. In der Palette scrollt das Rad die Bausteinliste. Unten im Arbeitsbereich stehen **Verkleinern**, die aktuelle Prozentanzeige zum Zurücksetzen auf **100 %**, **Vergrößern** und **Alles anzeigen** bereit. Der Zoom reicht von 25 bis 200 Prozent; „Alles anzeigen“ passt den gesamten Workflow ein. Unter **Weitere Funktionen → Einstellungen → UI-Textgröße** lässt sich die Schrift der Bedienelemente getrennt davon vergrößern.

Die Werkzeugleiste enthält **Startseite**, **Neu**, **Öffnen**, **Speichern**, das **Projektmenü**, **Rückgängig**, **Wiederholen**, **Eigenschaften**, **Codevorschau** und **Als VBS exportieren**. **Speichern unter** und **Als Entwurf sichern** liegen im Projektmenü. **Weitere Funktionen** neben dem Export öffnet unter anderem **Einstellungen**, **Hilfe und Anleitungen**, **Über ScriptLab**, **Kopieren** und **Einfügen**. **Duplizieren**, **Kopieren**, **Verschieben** und **Baustein löschen** findest du auch in den Eigenschaften des ausgewählten Bausteins. Blockly bietet zusätzlich das Kontextmenü per rechter Maustaste. Gelöschte Bausteine lassen sich mit **Rückgängig** wiederherstellen.

## Ohne Ziehen einfügen und umordnen

Klicke in der Palette auf Plus neben dem gewünschten Baustein. Die Palette zeigt passende Einfügestellen, zum Beispiel **Nach „Workflow starten“** oder einen Eingang einer Schleife. Klicke die gewünschte Stelle an. Du kannst auch den Zielbaustein im Arbeitsbereich anklicken: Bei einem passenden Anschluss wird er verwendet; bei mehreren Anschlüssen wählst du anschließend links den gewünschten Eingang. **Abbrechen** oder **Escape** beendet die Zielauswahl.

Zum Umordnen wählst du einen vorhandenen Baustein aus, öffnest **Eigenschaften** und klickst **Verschieben**. Wähle danach die neue Einfügestelle. Verschachtelte innere Abläufe bleiben beim verschobenen Baustein; eine vorherige Anschlusskette wird wieder geschlossen. Die angebotenen Ziele berücksichtigen den Blocktyp und verhindern Verbindungen mit dem eigenen inneren Ablauf. Hinzufügen und Verschieben lassen sich mit **Rückgängig** zurücknehmen.

## Eigenschaften und Platz im Fenster

Die **Eigenschaften** sind unabhängig von der Codevorschau und anfangs geschlossen. Sie zeigen die Hilfe, ein konkretes Wirkungsbeispiel und die bearbeitbaren Werte des ausgewählten Bausteins. Lange Texte und vollständige Pfade lassen sich in den größeren Feldern auswählen, kopieren und ändern. Änderungen erscheinen zugleich am Baustein.

Bei schmaleren Fenstern liegt der Eigenschaftenbereich über dem rechten Rand der Arbeitsfläche; er verkleinert diese nicht. Bei mindestens 1440 CSS-Pixeln Fensterbreite lässt er sich anheften. **Eigenschaften schließen** gibt den Arbeitsbereich wieder frei. Die linke Palette kannst du über ihren Kopf einklappen und an der Trennlinie verbreitern. Auch **Einstellungen → Breite der Bausteinpalette** bietet dafür ein Feld. Die Höhe der Codevorschau lässt sich an ihrer oberen Trennlinie oder mit ihren Größenknöpfen verändern.

## Tastenkombinationen

Die Projektkürzel funktionieren auch während einer Texteingabe. Die übrigen genannten Editoraktionen gelten außerhalb aktiver Texteingaben und bei geschlossenem Dialog:

| Tastenkombination      | Aktion                                                |
| ---------------------- | ----------------------------------------------------- |
| Strg+N                 | Neues Projekt                                         |
| Strg+O                 | Projekt öffnen                                        |
| Strg+S                 | Projekt speichern                                     |
| Strg+Umschalt+S        | Speichern unter                                       |
| Strg+Plus / Strg+Minus | Vergrößern / verkleinern                              |
| Strg+0                 | Zoom auf 100 Prozent                                  |
| Strg+Z / Strg+Y        | Blockly rückgängig / wiederholen                      |
| Strg+Umschalt+Z        | Wiederholen                                           |
| F4                     | Eigenschaften öffnen                                  |
| Entf                   | Ausgewählten Baustein löschen                         |
| Escape                 | Ziehen oder die Auswahl einer Einfügestelle abbrechen |

Für mehrzeiligen Text kannst du „Texte verbinden“ mit dem Wert „Zeilenumbruch“ verwenden. Ein Zeilenumbruch entspricht dem Windows-Format CRLF.

## Hinweise verstehen

Unvollständige Entwürfe dürfen gespeichert werden. Beim Export müssen Pflichtwerte und Verbindungen gültig sein. Lose aktive Anweisungen werden als Fehler gemeldet, damit kein Arbeitsschritt stillschweigend verloren geht. Unverbundene Werte erzeugen einen Hinweis und werden nicht ausgegeben.

**Hinweise** in der Statusleiste öffnet die Übersicht. Nach der Prüfung erscheinen verständliche Meldungen sowie Markierungen direkt am zugehörigen Baustein. Ein Klick auf eine Meldung wählt den betroffenen Baustein aus und bringt ihn in den sichtbaren Bereich. Ein Exportversuch mit Fehlern öffnet die Übersicht und führt zum ersten betroffenen Baustein. Ein Hinweis auf eine möglicherweise noch nicht gesetzte Variable sollte vor dem späteren Start geprüft werden.

Die angezeigten Prüfungen kontrollieren die Struktur und die Übersetzbarkeit. Sie prüfen nicht durch Ausprobieren, ob eine Quelldatei auf deinem Computer vorhanden ist. Dateioperationen werden erst beim eigenen Start der exportierten VBS-Datei ausgeführt.

## Projekte und Änderungen erhalten

**Öffnen** lädt `.scriptlab`-Dateien. **Projektmenü → Speichern unter** legt das aktuelle Projekt an einem anderen Ort ab. Die Statusleiste unterscheidet **Neues Projekt**, **Ungespeicherte Änderungen** und **Projekt gespeichert**. Ein erfolgreicher VBS-Export speichert die Projektdatei nicht mit.

Inhaltliche Änderungen werden nach einer kurzen Eingabepause automatisch als lokaler Entwurf gesichert. **Projektmenü → Als Entwurf sichern** sichert den Zwischenstand ausdrücklich. Ein neuer leerer Startablauf und reine Ansichtsänderungen erzeugen keinen zusätzlichen Entwurf. Die Anzeige **Entwurf lokal gesichert** bestätigt die lokale Sicherung; **Ungespeicherte Änderungen** bleibt bestehen, solange die Projektdatei noch nicht den aktuellen Stand enthält. Eine ausstehende oder fehlgeschlagene Sicherung wird gesondert angezeigt.

Bei einem Projektwechsel, beim Schließen oder vor einem Update-Neustart fragt die Anwendung nach, wenn Änderungen verloren gingen:

| Auswahl              | Wirkung                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Speichern            | Den Stand als `.scriptlab`-Projektdatei speichern; ein abgebrochener Speicherdialog bricht auch den davon abhängigen Vorgang ab.               |
| Als Entwurf behalten | Den aktuellen Stand lokal sichern und den Wechsel erlauben; die Projektdatei bleibt unverändert.                                               |
| Änderungen verwerfen | Den aktuellen ungespeicherten Stand und seine zugehörige Entwurfssicherung bewusst verwerfen. Eine vorhandene Projektdatei bleibt unverändert. |
| Abbrechen            | Im aktuellen Workflow bleiben.                                                                                                                 |

Unter **Entwürfe** auf der Startseite stehen Sicherungszeit und gegebenenfalls die zugehörige Projektdatei. **Fortsetzen** übernimmt einen ausgewählten Zwischenstand wieder zum Bearbeiten; es gibt keine automatische Wiederherstellung. **Als Projekt speichern** legt eine eigenständige Projektdatei an. Nach erfolgreichem Speichern wird nur der zugehörige Entwurf bereinigt; Abbruch oder Schreibfehler erhalten ihn. **Entwurf löschen** verlangt eine Bestätigung und löscht keine zugehörige Projektdatei.

Vor dem Überschreiben prüft ScriptLab, ob die Ausgangsdatei außerhalb der Anwendung verändert wurde oder nicht mehr erreichbar ist. Im Konfliktfall wird eine **separate Projektkopie** verlangt. Wähle einen anderen Dateinamen; die betroffene Ausgangsdatei darf dabei nicht ersetzt werden.

**Meine gespeicherten Workflows** führt nur bekannte, von dir geöffnete oder gespeicherte Dateien. Es gibt keinen Laufwerkscan. Suche nach Name oder vollständigem Pfad und sortiere nach Name oder letztem Öffnen. **Zuletzt geöffnet** enthält höchstens fünf tatsächlich geöffnete Projekte; bloßes Auflisten verändert den Zeitpunkt nicht. Bei verschobenen oder fehlenden Dateien bietet **Neu zuordnen** die Auswahl des neuen Speicherorts. **Aus Liste entfernen** entfernt nur den Verweis. Die vollständigen Pfade bleiben im Textfeld lesbar und kopierbar. Ein nicht vollständig lesbarer Index erscheint als Hinweis und wird nicht als sicher leerer Bestand dargestellt.

Einstellungen und Bibliotheksdaten liegen im Nutzerverzeichnis `%APPDATA%\ScriptLab`, außerhalb der Installation: `projektbibliothek.json` enthält bekannte Dateiverweise, `entwuerfe\<UUID>.json` enthält lokale Sicherungen. Deine eigentlichen Projektdateien bleiben an den selbst gewählten Speicherorten. Sichere wichtige Projekte zusätzlich selbst.

Projektdateien sind JSON-Daten. Die Anwendung prüft ihre Struktur und Schemaversion. Neuere unbekannte Formate und unbekannte Bausteintypen werden abgewiesen. Ein Rückimport beliebiger `.vbs`-Dateien als Bausteine ist nicht vorgesehen.

Ein Projekt darf höchstens 5 MiB als UTF-8-JSON-Datei enthalten. Die Anwendung prüft diese Größe vor dem Ersetzen einer vorhandenen Datei. Außerdem gelten Grenzen von 2.000 Bausteinen und 150 Ebenen im gespeicherten Verbindungsbaum; aufeinanderfolgende Verbindungen zählen dabei ebenfalls als Ebenen.

Eine `.scriptlab`-Datei bleibt bearbeitbar; eine `.vbs`-Datei ist das daraus erzeugte Script für Windows. Änderungen am Projekt verändern bereits exportierte Dateien nicht. Exportiere erneut, wenn du eine neue Fassung brauchst.

## Die drei Beispiele

Auf der Startseite bietet **Beispielworkflows** die Vorlagen **Eine Nachricht anzeigen**, **Dateien in einen Sicherungsordner kopieren** und **Dateinamen in eine Textdatei schreiben**. **Als Vorlage öffnen** erstellt eine eigene bearbeitbare Kopie mit neuer Projektkennung und dem Namenszusatz **(Kopie)**. Die Originalvorlage bleibt unverändert. Die bisherigen Einträge im **Projektmenü** und **Beispiel öffnen** im neuen Editor bleiben erreichbar. Die Dateien liegen zusätzlich im Ordner `beispiele` des Quellprojekts. Das Öffnen oder Exportieren verändert keine der beschriebenen Testdateien.

| Projekt                        | Inhalt und spätere Wirkung                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-Begruessung.scriptlab`     | Start → Nachricht. Zeigt beim eigenen Start eine Begrüßung.                                                                                                                                                       |
| `02-Datei-Backup.scriptlab`    | Prüft eine Testquelle, legt einen Sicherungsordner an und kopiert eine einzelne Datei. Eine vorhandene Sicherungsdatei führt ausdrücklich zu einem Fehler.                                                        |
| `03-Dateinamenliste.scriptlab` | Liest die Dateiliste eines Testordners und schreibt die Blattnamen einschließlich Endung zeilenweise in eine UTF-8-Textdatei. Unterordner werden nicht durchsucht. Eine vorhandene Ausgabetextdatei wird ersetzt. |

Für einen späteren eigenständigen Start des Backupbeispiels legst du neben der exportierten VBS-Datei selbst `ScriptLab-Testdaten\Backup\Quelle\beispiel.txt` mit beliebigem Testinhalt an. Die Sicherung wird nach `ScriptLab-Testdaten\Backup\Sicherung\beispiel.txt` geschrieben. Wiederholtes Starten überschreibt diese Sicherung nicht.

Für das Listenbeispiel legst du neben der exportierten VBS-Datei selbst den Ordner `ScriptLab-Testdaten\Dateiliste\Eingang` mit einigen Testdateien an. Das Ergebnis wird in `ScriptLab-Testdaten\Dateiliste\Dateinamen.txt` geschrieben. Die Namen werden nach Dateiname sortiert. Ein leerer Eingangsordner ergibt nur die Überschrift.

## Dateipfade und Textkodierung

Relative Pfade beziehen sich auf den **Speicherort der exportierten VBS-Datei**, nicht auf den Projektordner und nicht auf ein zufälliges Arbeitsverzeichnis. Absolute Laufwerks- und UNC-Pfade sind ebenfalls möglich. Platzhalter wie `*` und `?` sind bei Dateioperationen nicht erlaubt.

Der VBS-Quelltext wird als UTF-16LE mit BOM und CRLF gespeichert. Das ist unabhängig von der Kodierung der Textdateien, mit denen dein Workflow später arbeitet. Die Blöcke zum Lesen, Schreiben und Ergänzen bieten UTF-8, UTF-16LE und Windows-ANSI. Beim Ergänzen muss eine bestehende Datei bereits dieselbe Kodierung haben. UTF-8 und UTF-16LE werden mit BOM geschrieben; Windows-ANSI verwendet die lokale Windows-Codepage.

Der Baustein „Datei löschen (erweitert)“ ist besonders gekennzeichnet. Standardmäßig fragt **das später gestartete Script** vor dem Löschen nach; „Nein“ ist in dieser Rückfrage vorausgewählt. Diese Rückfrage ist kein Testlauf in ScriptLab.

## Optionale Signatur und Updates

Unter **Weitere Funktionen → Einstellungen** kannst du „Exportierte Datei signieren“ aktivieren und nach dem Laden der Zertifikate dein eigenes Code-Signing-Zertifikat auswählen. Die Auswahl wird über seinen Fingerabdruck gespeichert. Private Schlüssel und Kennwörter werden nicht im Projekt gespeichert. Ohne geeignetes Zertifikat bleibt der unsignierte Export verfügbar. Weitere Einrichtungsschritte stehen in der [Signaturdokumentation](SIGNATUR.md).

Eine Signatur hilft, Herausgeber und Änderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch die Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen.

Ebenfalls unter **Einstellungen** stehen „Nach Updates suchen“, die abschaltbare automatische Prüfung und die bewusste Auswahl von Vorabversionen. Ein gefundenes Update muss erst heruntergeladen und anschließend von dir zur Installation bestätigt werden. Die Anwendung installiert es nicht stillschweigend beim Beenden. Produktive Updates benötigen die eingerichtete Release- und Anwendungssignaturinfrastruktur.

Die [Designnotiz](DESIGNNOTIZ.md) hält die Editorprüfungen fest; die [Startseitendokumentation](STARTSEITE.md) ergänzt die später eingeführte Bibliothek, Entwürfe und lokale Hilfe samt eigenem Prüfstand und Grenzen.
