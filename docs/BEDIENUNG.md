# ScriptLab bedienen

ScriptLab erstellt, prüft und speichert Windows-Workflows als Bausteine. Beim Export schreibt die Anwendung eine eigenständige VBS-Datei. **ScriptLab führt den Workflow niemals aus.** Auch eine Vorschau, eine Prüfung, das Öffnen eines Beispiels und das Signieren lösen keine Workflowaktionen aus.

Entwickelt von Leon Stolz.

## Eine erste Nachricht erstellen

1. Öffne ScriptLab. Das neue Projekt enthält bereits „Workflow starten“, „Zeige eine Nachricht“ und einen Textwert.
2. Ändere oben den Projektnamen. Klicke auf das Textfeld im Textbaustein und schreibe deine Nachricht.
3. Die schreibgeschützte **Codevorschau** rechts zeigt den erzeugten VBS-Text. Du kannst sie mit „Codevorschau“ ein- oder ausblenden.
4. Speichere über **Speichern** eine `.scriptlab`-Projektdatei. Diese Datei erhält die Bausteine, ihre Verbindungen, Kommentare und die Ansicht für die spätere Bearbeitung.
5. Wähle **Als VBS exportieren** und einen Speicherort für die `.vbs`-Datei. Ein normaler Export benötigt kein Zertifikat.
6. Nach erfolgreichem Export erscheint: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ **Speicherordner anzeigen** öffnet den Ordner; ScriptLab startet die Datei dabei nicht.

Der selbstständige Start außerhalb von ScriptLab ist deine eigene Entscheidung. Dafür muss Windows die optionale VBScript-Komponente bereitstellen und deine Richtlinie die Ausführung erlauben. ScriptLab aktiviert keine Windows-Features und ändert keine Sicherheitsrichtlinien.

## Bausteine verbinden und bearbeiten

Wähle links eine beschriftete Kategorie. Ziehe einen Baustein aus der aufgeklappten Liste in den Arbeitsbereich. Die Suchleiste filtert die verfügbaren Bausteine anhand von Name, Kategorie und Hilfe.

Ein Workflow besitzt genau einen aktiven Startbaustein. Anweisungen werden untereinander verbunden. Ihre Verbindungen legen die Reihenfolge fest; ihre Position auf dem Raster tut das nicht. Werte und Bedingungen passen in die dafür geformten Eingänge. „Wenn / sonst“ und Schleifen nehmen weitere Anweisungen in ihren inneren Abläufen auf.

Ziehe einen verbundenen Baustein heraus, um ihn zu lösen oder neu einzusetzen. Das dezente Raster hilft beim Anordnen. Ziehen am freien Arbeitsbereich und die Bildlaufleisten verschieben den sichtbaren Ausschnitt. Unten stehen **Verkleinern**, **Vergrößern**, **100 %** und **Einpassen** bereit; „Einpassen“ zeigt den gesamten Workflow. Das Mausrad unterstützt die Blockly-Zoomfunktion.

Die Werkzeugleiste enthält **Rückgängig** und **Wiederholen**. Unten findest du **Kopieren**, **Einfügen**, **Duplizieren** und **Löschen** für ausgewählte Bausteine. Blockly bietet außerdem das Kontextmenü per rechter Maustaste. Beim Auswählen eines Bausteins zeigt der rechte Bereich seine kurze Hilfe an, solange die Codevorschau eingeblendet ist.

Die von der Oberfläche unterstützten Projekt- und Zoomkürzel gelten außerhalb aktiver Texteingaben:

| Tastenkombination | Aktion |
| --- | --- |
| Strg+N | Neues Projekt |
| Strg+O | Projekt öffnen |
| Strg+S | Projekt speichern |
| Strg+Umschalt+S | Speichern unter |
| Strg+Plus / Strg+Minus | Vergrößern / verkleinern |
| Strg+0 | Zoom auf 100 Prozent |
| Strg+Z / Strg+Y | Blockly rückgängig / wiederholen |

Für mehrzeiligen Text kannst du „Texte verbinden“ mit dem Wert „Zeilenumbruch“ verwenden. Ein Zeilenumbruch entspricht dem Windows-Format CRLF.

## Hinweise verstehen

Unvollständige Entwürfe dürfen gespeichert werden. Beim Export müssen Pflichtwerte und Verbindungen gültig sein. Lose aktive Anweisungen werden als Fehler gemeldet, damit kein Arbeitsschritt stillschweigend verloren geht. Unverbundene Werte erzeugen einen Hinweis und werden nicht ausgegeben.

Fehler erscheinen unten als verständliche Meldungen sowie direkt am zugehörigen Baustein. Ein Klick auf eine Meldung wählt den betroffenen Baustein aus und bringt ihn in den sichtbaren Bereich. Ein Hinweis auf eine möglicherweise noch nicht gesetzte Variable sollte vor dem späteren Start geprüft werden.

Die angezeigten Prüfungen kontrollieren die Struktur und die Übersetzbarkeit. Sie prüfen nicht durch Ausprobieren, ob eine Quelldatei auf deinem Computer vorhanden ist. Dateioperationen werden erst beim eigenen Start der exportierten VBS-Datei ausgeführt.

## Projekte und Änderungen erhalten

**Öffnen** lädt `.scriptlab`-Dateien. **Speichern unter** legt das aktuelle Projekt an einem anderen Ort ab. Die Anzeige „Ungespeichert“ weist auf Änderungen hin. Bei einem Projektwechsel, beim Schließen oder vor einem Update-Neustart fragt die Anwendung nach, wenn Änderungen verloren gingen. Ein abgebrochener Speicherdialog bricht auch den davon abhängigen Vorgang ab.

Projektdateien sind JSON-Daten. Die Anwendung prüft ihre Struktur und Schemaversion. Neuere unbekannte Formate und unbekannte Bausteintypen werden abgewiesen. Ein Rückimport beliebiger `.vbs`-Dateien als Bausteine ist nicht vorgesehen.

Eine `.scriptlab`-Datei bleibt bearbeitbar; eine `.vbs`-Datei ist das daraus erzeugte Script für Windows. Änderungen am Projekt verändern bereits exportierte Dateien nicht. Exportiere erneut, wenn du eine neue Fassung brauchst.

## Die drei Beispiele

Die Beispiele liegen im Ordner `beispiele` des Quellprojekts. Öffne sie über **Öffnen**. Das Öffnen oder Exportieren verändert keine der beschriebenen Testdateien.

| Projekt | Inhalt und spätere Wirkung |
| --- | --- |
| `01-Begruessung.scriptlab` | Start → Nachricht. Zeigt beim eigenen Start eine Begrüßung. |
| `02-Datei-Backup.scriptlab` | Prüft eine Testquelle, legt einen Sicherungsordner an und kopiert eine einzelne Datei. Eine vorhandene Sicherungsdatei führt ausdrücklich zu einem Fehler. |
| `03-Dateinamenliste.scriptlab` | Liest die Dateiliste eines Testordners und schreibt die Blattnamen einschließlich Endung zeilenweise in eine UTF-8-Textdatei. Unterordner werden nicht durchsucht. Eine vorhandene Ausgabetextdatei wird ersetzt. |

Für einen späteren eigenständigen Start des Backupbeispiels legst du neben der exportierten VBS-Datei selbst `ScriptLab-Testdaten\Backup\Quelle\beispiel.txt` mit beliebigem Testinhalt an. Die Sicherung wird nach `ScriptLab-Testdaten\Backup\Sicherung\beispiel.txt` geschrieben. Wiederholtes Starten überschreibt diese Sicherung nicht.

Für das Listenbeispiel legst du neben der exportierten VBS-Datei selbst den Ordner `ScriptLab-Testdaten\Dateiliste\Eingang` mit einigen Testdateien an. Das Ergebnis wird in `ScriptLab-Testdaten\Dateiliste\Dateinamen.txt` geschrieben. Die Namen werden nach Dateiname sortiert. Ein leerer Eingangsordner ergibt nur die Überschrift.

## Dateipfade und Textkodierung

Relative Pfade beziehen sich auf den **Speicherort der exportierten VBS-Datei**, nicht auf den Projektordner und nicht auf ein zufälliges Arbeitsverzeichnis. Absolute Laufwerks- und UNC-Pfade sind ebenfalls möglich. Platzhalter wie `*` und `?` sind bei Dateioperationen nicht erlaubt.

Der VBS-Quelltext wird als UTF-16LE mit BOM und CRLF gespeichert. Das ist unabhängig von der Kodierung der Textdateien, mit denen dein Workflow später arbeitet. Die Blöcke zum Lesen, Schreiben und Ergänzen bieten UTF-8, UTF-16LE und Windows-ANSI. Beim Ergänzen muss eine bestehende Datei bereits dieselbe Kodierung haben. UTF-8 und UTF-16LE werden mit BOM geschrieben; Windows-ANSI verwendet die lokale Windows-Codepage.

Der Baustein „Datei löschen (erweitert)“ ist besonders gekennzeichnet. Standardmäßig fragt **das später gestartete Script** vor dem Löschen nach; „Nein“ ist in dieser Rückfrage vorausgewählt. Diese Rückfrage ist kein Testlauf in ScriptLab.

## Optionale Signatur und Updates

Unter **Einstellungen** kannst du „Exportierte Datei signieren“ aktivieren und nach dem Laden der Zertifikate dein eigenes Code-Signing-Zertifikat auswählen. Die Auswahl wird über seinen Fingerabdruck gespeichert. Private Schlüssel und Kennwörter werden nicht im Projekt gespeichert. Ohne geeignetes Zertifikat bleibt der unsignierte Export verfügbar. Weitere Einrichtungsschritte stehen in der Signaturdokumentation.

Eine Signatur hilft, Herausgeber und Änderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch die Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen.

Ebenfalls unter **Einstellungen** stehen „Nach Updates suchen“, die abschaltbare automatische Prüfung und die bewusste Auswahl von Vorabversionen. Ein gefundenes Update muss erst heruntergeladen und anschließend von dir zur Installation bestätigt werden. Die Anwendung installiert es nicht stillschweigend beim Beenden. Produktive Updates benötigen die eingerichtete Release- und Anwendungssignaturinfrastruktur.
