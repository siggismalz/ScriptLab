# ScriptLab bedienen

ScriptLab erstellt, prüft und speichert Windows-Workflows als Bausteine. Beim Export schreibt die Anwendung je nach festgelegter Sprache eine eigenständige Python- oder VBS-Datei; Business-Workflows erhalten ein ZIP mit den benötigten Komponenten. Nur ein bewusst gestarteter **Test** führt den vollständigen aktuellen Workflow in ScriptLab aus. Dabei werden Dateiaktionen tatsächlich vorgenommen. Bearbeiten, Codevorschau, Strukturprüfung, Öffnen von Projekten oder Beispielen, Wiederherstellen, Speichern, Export und Signieren lösen keine Workflowaktionen aus.

Entwickelt von Leon Stolz.

## Auf der Startseite beginnen

ScriptLab öffnet zuerst die Startseite. **Neuer Workflow** öffnet die Sprachauswahl; **Workflow öffnen** lädt eine selbst gewählte `.scriptlab`-Datei. Wenn bereits ein Workflow aktiv ist, führt **Weiterbearbeiten** zu demselben Stand zurück. Auch der Wechsel über **Bereiche → Start** im Editor erhält Bausteine, Auswahl und Ansicht.

Die vier Bereiche stehen in dieser Reihenfolge:

| Bereich                       | Inhalt                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Meine gespeicherten Workflows | Bekannte Projektdateien anhand von Name oder Pfad suchen und weiterbearbeiten.      |
| Entwürfe                      | Lokal gesicherte Zwischenstände bewusst fortsetzen oder als Projektdatei speichern. |
| Beispielworkflows             | Vorhandene Vorlagen als eigene bearbeitbare Kopien öffnen.                          |
| Dokumentation und Anleitungen | Lokale Hilfethemen durchsuchen; Treffer führen zur passenden Artikelstelle.         |

**Einstellungen**, **Hilfe** und **Über ScriptLab** sind in der festen Navigation erreichbar, im Editor unter **Bereiche**. Die Hilfe funktioniert offline; Beispielverweise darin öffnen ebenfalls eine Vorlage als Kopie.

## Eine Sprache wählen

Jede leere Neuanlage über **Neuer Workflow**, **Workflow → Neuer Workflow** oder Strg+N beginnt mit dem Dialog **Neuer Workflow**. Python und VBScript (VBS) werden angeboten. Bei der ersten Erstellung ist nichts vorausgewählt; **Workflow erstellen** wird erst nach einer Auswahl verfügbar. Später ist die zuletzt erfolgreich gewählte Sprache vorgeschlagen. **Abbrechen** lässt den bisherigen Workflow unverändert. Ein Namensdialog ist nicht erforderlich.

Beide Sprachen verwenden dieselben 48 Bausteintypen. Die Wahl bestimmt den erzeugten Scripttext und bleibt für das Projekt fest. Die Sprache steht im Editor, in Listen, Beispielen, Vorschau und Laufdetails. Ein anderes Ausgabeformat erfordert einen neuen Workflow; vorhandene Projekte werden nicht umgestellt. Nach der Wahl schützt ScriptLab einen gegebenenfalls ungespeicherten bisherigen Stand mit den üblichen Speicherentscheidungen.

## Eine erste Nachricht erstellen

1. Wähle auf der Startseite **Neuer Workflow**, entscheide dich für Python oder VBScript (VBS) und bestätige **Workflow erstellen**. Das neue Projekt enthält nur **Workflow starten** und den Hinweis „Füge links einen Baustein hinzu“.
2. Suche links nach **Nachricht**. Klicke beim Treffer **Nachricht anzeigen** auf Plus und wähle **Nach „Workflow starten“**. Damit ist die Nachricht bereits mit dem Ablauf verbunden.
3. Klicke auf das Textfeld am Nachrichtenbaustein und schreibe deine Nachricht. Alternativ wählst du den Baustein aus und öffnest **Eigenschaften** über die Werkzeugleiste oder F4. Dort stehen dieselben Werte in größeren Eingabefeldern.
4. Öffne **Workflow → Projektangaben**, wenn du Namen oder Beschreibung ändern möchtest. **Übernehmen** aktualisiert die Angaben; die Projektdatei wird erst mit **Speichern** geschrieben.
5. Sichere mit **Speichern** den Workflow. ScriptLab legt die `.scriptlab`-Datei automatisch im eigenen Nutzerverzeichnis ab, ohne nach einem Zielordner zu fragen. Die Datei erhält Bausteine, Verbindungen, Kommentare und Ansicht. **Ansicht → Codevorschau öffnen** zeigt den erzeugten Text schreibgeschützt und führt nichts aus.
6. Wähle **Exportieren**, unter **Inhalt** das Scriptformat deiner Sprache und anschließend **Ausgabeort auswählen** für die `.py`- beziehungsweise `.vbs`-Datei. Ein normaler Export benötigt kein Zertifikat.
7. Nach erfolgreichem Export erscheint: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ **Speicherordner anzeigen** öffnet den Ordner; ScriptLab startet die Datei dabei nicht.

Innerhalb von ScriptLab ist Python 3.15.2 einschließlich Tcl/Tk und Business-Paketen bereits mitgeliefert. Eine externe Einrichtung entfällt. VBS verwendet weiterhin die verfügbare Windows-VBScript-Komponente und Windows Script Host. Die geltenden Richtlinien müssen den Start erlauben; ScriptLab aktiviert keine Windows-Features und ändert keine Sicherheitsrichtlinien. Beim eigenständigen Start eines exportierten Python-Scripts benötigt der Zielcomputer dagegen eine passende eigene Python-Installation und gegebenenfalls die Business-Pakete.

## Den aktuellen Workflow bewusst testen

Öffne **Läufe → Vorbereitung**, ohne einen Workflow zu starten. Prüfe Modus, Parametersatz, Quellen und Ausgabeziele. ScriptLab verwendet automatisch den Arbeitsordner dieses Workflows. Unter **ScriptLab-Arbeitsordner** findest du dessen vollständigen Pfad und kannst ihn im Explorer öffnen. Bei Bedarf änderst du das **Zeitlimit**; der Standard ist 120 Sekunden, zulässig sind 1 bis 28800. **Workflow ausführen** startet immer den vollständigen aktuellen Ablauf, nicht nur den ausgewählten Baustein.

Wurde der Laufkontext für **Testen** noch nicht geprüft, führt der erste Startwunsch zunächst zur Vorbereitung und führt noch nichts aus. Nach dem Prüfen startest du mit einem weiteren bewussten Klick. Dafür muss der Workflow nicht zuvor gespeichert werden. Das Speichern desselben Workflows erhält den Kontext. Business-Workflows beginnen mit **Prüflauf ohne Zieländerungen**; **Datenvorschau** und **Ausführen · echte Dateiänderungen** bleiben unterschiedliche Modi. Die direkte Schrittvorschau in der Datenansicht benötigt diese Vorbereitung nicht.

**Eine echte Ausführung verändert Dateien auf diesem Computer.** Relative Pfade verwenden den ScriptLab-Arbeitsordner. Ausgaben innerhalb von ScriptLab müssen im ScriptLab-Nutzerverzeichnis liegen. Absolute Ausgabeziele außerhalb werden abgewiesen, nicht stillschweigend verschoben; externe Quellen können weiterhin gelesen werden. Verwende zuerst entbehrliche Testdaten. **Stoppen** beendet den Test und macht bereits erfolgte Änderungen nicht rückgängig. Die Pfadprüfung ist keine allgemeine Sandbox.

**Text ausgeben** schreibt ins **Protokoll** des Laufs. Nachrichten, Texteingaben, Ja-/Nein-Fragen und die Löschrückfrage öffnen Dialoge; bei Python ist das dafür verwendete Tcl/Tk enthalten. Beachte bei einem wartenden Test auch diese Dialoge. Ein Test ersetzt kein Speichern oder Exportieren.

## Frühere Läufe und Ergebnisse ansehen

Abgeschlossene Läufe bleiben lokal erhalten. **Alle Läufe** zeigt nur Läufe des geöffneten Workflows, neueste zuerst. Suche und Modusfilter grenzen diese Liste ein. Mit **Anzeigen** öffnest du einen Lauf; **Übersicht**, **Ergebnisse** und **Protokoll** gehören dann zu genau diesem Lauf und Workflowstand. Das Öffnen von Details führt keine Verarbeitung aus. Läuft der Workflow noch, bleiben **Aktuellen Lauf anzeigen** und **Stoppen** erreichbar.

**Übersicht → Laufstand und technische Angaben** zeigt den verwendeten Stand. Nach inhaltlichen Änderungen wird ein älterer Stand gekennzeichnet. Eine Fehlerzuordnung führt nur dann zum Baustein, wenn der gespeicherte Lauf zum aktuellen Workflowstand passt. Bestätigte Business-Ausgaben und Berichte kannst du im Explorer anzeigen; eine gelöschte oder nicht mehr erreichbare Datei wird als Fehler gemeldet. Die Historie sichert Laufdaten und Protokolle, keine zusätzliche Kopie jeder erzeugten Datei.

Unter **Protokoll** kopiert **Protokoll kopieren** das Protokoll des gewählten Laufs. **Protokoll exportieren** fragt nach einer `.txt`-Zieldatei. **Ausgabe leeren** betrifft beim aktuellen Lauf die Liveanzeige; ein bereits gespeicherter Lauf wird dadurch nicht nachträglich geändert. Unter **Technische Details** bleiben Quelltext und vorhandene Fehlerzuordnungen zugänglich.

Die Historie ist insgesamt auf höchstens 200 abgeschlossene Läufe und 64 MiB Detaildaten begrenzt; ältere Einträge werden bei Bedarf entfernt. Ein Hinweis meldet nicht speicherbare Laufdaten, ohne den echten Ausführungsstatus umzudeuten. Laufhistorie und Business-Journal sind verschiedene Dinge: Das Öffnen eines früheren Laufs setzt keinen Prozess fort. Der [Testlaufleitfaden](TESTLAUF.md) bewahrt die historischen Nachweise; [WEITERENTWICKLUNG.md](WEITERENTWICKLUNG.md) beschreibt die aktuelle Ablage und ihre Grenzen.

## Daten bis zu einem Schritt prüfen

Öffne **Daten und Parameter → Datenvorschau**. Unter **Ergebnis bis zu diesem Schritt** wählst du einen Tabellenschritt und unter **Verwendete Werte** den Parametersatz. **Datenvorschau laden** beginnt direkt in dieser Ansicht, ohne vorherige Laufvorbereitung. Sie liest den unterstützten Vorlauf bis einschließlich des gewählten Schritts. Unfertige Nachfolger werden dafür nicht ausgeführt; der bearbeitete Workflow bleibt unverändert.

Die Schrittvorschau unterstützt verbundene lesende Business-Tabellenschritte im Hauptablauf. Schleifen, Verzweigungen, aktive Grundbausteine und Dateiaktionen im benötigten Vorlauf können hier nicht als reine Datenvorschau geladen werden. Ein Hinweis am deaktivierten Start erklärt die fehlende Voraussetzung. Das gilt für den benötigten Vorlauf, nicht für beliebige noch unfertige Schritte danach.

Die Tabelle zeigt höchstens 200 geladene Zeilen und 256 KiB; ihre Such- und Sortierfunktionen gelten für diesen Ausschnitt. Filter und Gruppierungen können trotzdem die gesamte Quelle lesen. Spaltenvorschläge beziehen sich auf die gewählte Eingabetabelle und den passenden Vorschaukontext. Während des Ladens bleibt **Stoppen** erreichbar; ein Wechsel der Ansicht startet keine weitere Vorschau.

## App-Komponenten und eigenständigen Export prüfen

Unter **Einstellungen → Laufzeit** stehen der tatsächliche Status des mitgelieferten Python 3.15.2 und der Komponenten für Tabellen und Dokumente. **Erneut prüfen** prüft diesen Bestand. Versionen, Dialogfunktionen und Programmdatei sind lesend in technischen Angaben erreichbar. Eine Interpreterauswahl und Online-/Offline-Paketinstallation werden in der normalen Oberfläche nicht mehr angeboten.

Ein Workflowstart lädt und installiert keine Pakete. Ein Fehler in der mitgelieferten Laufzeit wird als Fehler gemeldet und nicht als Aufforderung zur Auswahl einer externen Installation behandelt. Die beiden Sprachkarten bleiben erhalten; nur VBS ist weiterhin von der Windows-Komponente abhängig.

Zum selbstständigen Start eines exportierten Scripts öffnest du PowerShell und verwendest den vollständigen Pfad deines Interpreters sowie die normale `.py`-Datei. Ersetze die Beispielpfade durch die tatsächlich vorhandenen Pfade:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Mein Workflow.py"
```

`-I` isoliert die Modulsuche und ignoriert Python-Umgebungsvariablen; `-u` entpuffert die Ausgabe; `-X utf8` aktiviert UTF-8. Sie bilden keine Sicherheits-Sandbox. Ein Doppelklick auf `.py` ist wegen unterschiedlicher Dateizuordnungen nicht garantiert. Für die eigenständige Ausführung wird ScriptLab nicht benötigt. Ein Business-Paket benötigt beim Empfänger zusätzlich die in seiner Anleitung genannten Pakete. Das ZIP enthält keinen Python-Interpreter. Einzelheiten stehen in [PYTHON.md](PYTHON.md) und der [offiziellen CPython-Dokumentation](https://docs.python.org/3.15/using/cmdline.html).

## Bausteine verbinden und bearbeiten

Die Palette bietet die fachlichen Einstiege **Ablauf steuern**, **Daten verarbeiten**, **Dateien und Ordner**, **Dokumente erstellen** und **Werte und Eingaben**, soweit die gewählte Sprache passende Bausteine enthält. Darunter wählst du eine Kategorie. Die Suche durchsucht alle verfügbaren Bausteine direkt; **Suche leeren** führt zur vorherigen Palettenansicht zurück. Ziehe einen Baustein am Namen aus der Liste in den Arbeitsbereich.

Ein Workflow besitzt genau einen aktiven Startbaustein. Anweisungen werden untereinander verbunden. Ihre Verbindungen legen die Reihenfolge fest; ihre Position auf dem Raster tut das nicht. Werte und Bedingungen passen in die dafür geformten Eingänge. „Wenn / sonst“ und Schleifen nehmen weitere Anweisungen in ihren inneren Abläufen auf.

Ziehe einen verbundenen Baustein heraus, um ihn zu lösen oder neu einzusetzen. Eine Einfügemarkierung zeigt passende Anschlüsse. **Escape** bricht das Ziehen ab und stellt den vorherigen Zustand wieder her. Das dezente Punktraster hilft beim Anordnen.

Das Mausrad, Ziehen am freien Arbeitsbereich, die Bildlaufleisten und die vier Ansichtspfeile verschieben den sichtbaren Ausschnitt. **Strg+Mausrad** zoomt nur über der Arbeitsfläche. In der Palette scrollt das Rad die Bausteinliste. Unten im Arbeitsbereich stehen **Verkleinern**, die aktuelle Prozentanzeige zum Zurücksetzen auf **100 %**, **Vergrößern** und **Alles anzeigen** bereit. Der Zoom reicht von 25 bis 200 Prozent; „Alles anzeigen“ passt den gesamten Workflow ein. Unter **Bereiche → Einstellungen → Darstellung → Textgröße der Oberfläche** lässt sich die Schrift der Bedienelemente getrennt davon vergrößern.

Die Werkzeugleiste hält **Speichern**, **Workflow**, **Rückgängig**, **Wiederholen**, **Eigenschaften**, **Testen**, **Exportieren** und **Ansicht** bereit. **Workflow** enthält unter anderem Öffnen, Neuanlage, **Kopie anlegen** und **Als Entwurf sichern**. **Ansicht** öffnet die Codevorschau oder setzt die Flächenaufteilung zurück. **Bereiche** führt zu Start, Workflows, Vorlagen, Hilfe und Einstellungen. Während eines Laufs bleibt **Stoppen** erreichbar. **Duplizieren**, **Kopieren**, **Verschieben** und **Baustein löschen** findest du in den Eigenschaften des ausgewählten Bausteins. Blockly bietet zusätzlich das Kontextmenü per rechter Maustaste. Gelöschte Bausteine lassen sich mit **Rückgängig** wiederherstellen; bereits ausgeführte Dateiaktionen eines Laufs nicht.

Variablen wählst du in den Bausteinen oder Eigenschaften aus derselben Liste. **Neue Variable anlegen** erstellt eine Variable; das Blockly-Auswahlmenü bietet das Umbenennen. Intern bleiben feste Variablen-IDs erhalten: Eine Umbenennung aktualisiert alle Bezüge derselben Variable. Ein angezeigter Name wird niemals als ungeprüfter Programmcode eingesetzt.

## Ohne Ziehen einfügen und umordnen

Klicke in der Palette auf Plus neben dem gewünschten Baustein. Die Palette zeigt passende Einfügestellen, zum Beispiel **Nach „Workflow starten“** oder einen Eingang einer Schleife. Klicke die gewünschte Stelle an. Du kannst auch den Zielbaustein im Arbeitsbereich anklicken: Bei einem passenden Anschluss wird er verwendet; bei mehreren Anschlüssen wählst du anschließend links den gewünschten Eingang. **Abbrechen** oder **Escape** beendet die Zielauswahl.

Zum Umordnen wählst du einen vorhandenen Baustein aus, öffnest **Eigenschaften** und klickst **Verschieben**. Wähle danach die neue Einfügestelle. Verschachtelte innere Abläufe bleiben beim verschobenen Baustein; eine vorherige Anschlusskette wird wieder geschlossen. Die angebotenen Ziele berücksichtigen den Blocktyp und verhindern Verbindungen mit dem eigenen inneren Ablauf. Hinzufügen und Verschieben lassen sich mit **Rückgängig** zurücknehmen.

## Eigenschaften und Platz im Fenster

Die **Eigenschaften** sind unabhängig von der Codevorschau und anfangs geschlossen. Sie zeigen die primären Werte des ausgewählten Bausteins. Weitere Optionen sowie Name, Hilfe und Wirkungsbeispiel liegen in aufklappbaren Bereichen wie **Importeinstellungen** und **Bausteindetails**. Lange Texte und vollständige Pfade lassen sich in den größeren Feldern auswählen, kopieren und ändern. Änderungen erscheinen zugleich am Baustein.

Bei schmaleren Fenstern liegt der Eigenschaftenbereich über dem rechten Rand der Arbeitsfläche. Bei enger Fläche ersetzt er vorübergehend die Palette; nach dem Schließen erscheint diese wieder. Anheften ist ab 1440 CSS-Pixeln und mit ausreichend verbleibender Arbeitsfläche möglich. **Eigenschaften schließen** gibt den Arbeitsbereich wieder frei. Die linke Palette kannst du über ihren Kopf einklappen und an der Trennlinie verbreitern. Auch **Einstellungen → Darstellung → Breite der Bausteinpalette** bietet dafür ein Feld. Die Höhe der Codevorschau lässt sich an ihrer oberen Trennlinie oder mit ihren Größenknöpfen verändern.

## Tastenkombinationen

Die Projektkürzel funktionieren auch während einer Texteingabe. Die übrigen genannten Editoraktionen gelten außerhalb aktiver Texteingaben und bei geschlossenem Dialog:

| Tastenkombination      | Aktion                                                |
| ---------------------- | ----------------------------------------------------- |
| Strg+N                 | Sprachauswahl für einen neuen Workflow                |
| Strg+O                 | Projekt öffnen                                        |
| Strg+S                 | Projekt speichern                                     |
| Strg+Umschalt+S        | Unabhängige interne Kopie anlegen                     |
| Strg+Plus / Strg+Minus | Vergrößern / verkleinern                              |
| Strg+0                 | Zoom auf 100 Prozent                                  |
| Strg+Z / Strg+Y        | Blockly rückgängig / wiederholen                      |
| Strg+Umschalt+Z        | Wiederholen                                           |
| F4                     | Eigenschaften öffnen                                  |
| Entf                   | Ausgewählten Baustein löschen                         |
| Escape                 | Ziehen oder die Auswahl einer Einfügestelle abbrechen |

Für mehrzeiligen Text kannst du „Texte verbinden“ mit dem Wert „Zeilenumbruch“ verwenden. Ein Zeilenumbruch entspricht dem Windows-Format CRLF.

## Hinweise verstehen

Unvollständige Entwürfe dürfen gespeichert und als Projektdatei exportiert werden. Beim Script- oder Paketexport müssen Pflichtwerte und Verbindungen gültig sein. Lose aktive Anweisungen werden als Fehler gemeldet, damit kein Arbeitsschritt stillschweigend verloren geht. Unverbundene Werte erzeugen einen Hinweis und werden nicht ausgegeben.

**Hinweise** in der Statusleiste öffnet die Übersicht. Nach der Prüfung erscheinen verständliche Meldungen sowie Markierungen direkt am zugehörigen Baustein. Ein Klick auf eine Meldung wählt den betroffenen Baustein aus und bringt ihn in den sichtbaren Bereich. Ein Exportversuch mit Fehlern öffnet die Übersicht und führt zum ersten betroffenen Baustein. Ein Hinweis auf eine möglicherweise noch nicht gesetzte Variable sollte vor dem späteren Start geprüft werden.

Die angezeigten Strukturprüfungen kontrollieren Verbindungen und Übersetzbarkeit. Sie probieren keine Dateiaktionen aus. Ob Quellen, Ziele oder Rechte passen, zeigt sich erst bei einer ausdrücklich gestarteten Ausführung: im Test oder außerhalb von ScriptLab. Ein Test mit Dateiaktionen verändert dabei echte Dateien.

## Projekte und Änderungen erhalten

**Öffnen** lädt `.scriptlab`-Dateien. **Speichern** sichert den Workflow automatisch im ScriptLab-Nutzerverzeichnis. Eine extern geöffnete Datei wird beim Speichern dorthin übernommen; ihre Quelldatei bleibt unverändert. **Workflow → Kopie anlegen** speichert einen unabhängigen Workflow mit neuer Kennung. Die Statusleiste unterscheidet **Neues Projekt**, **Ungespeicherte Änderungen** und **Projekt gespeichert**. Unter **Exportieren** kannst du eine Projektdatei, ein Script oder ein Business-Paket an einen selbst gewählten Ort schreiben. Ein Export verändert den Speicherzustand des aktiven Workflows nicht.

Inhaltliche Änderungen werden nach einer kurzen Eingabepause automatisch als lokaler Entwurf gesichert. **Workflow → Als Entwurf sichern** sichert den Zwischenstand ausdrücklich. Ein neuer leerer Startablauf und reine Ansichtsänderungen erzeugen keinen zusätzlichen Entwurf. Die Anzeige **Entwurf lokal gesichert** bestätigt die lokale Sicherung; **Ungespeicherte Änderungen** bleibt bestehen, solange die Projektdatei noch nicht den aktuellen Stand enthält. Eine ausstehende oder fehlgeschlagene Sicherung wird gesondert angezeigt.

Bei einem Projektwechsel, beim Schließen oder vor einem Update-Neustart fragt die Anwendung nach, wenn Änderungen verloren gingen:

| Auswahl              | Wirkung                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Speichern            | Den Stand intern als `.scriptlab`-Datei sichern. Ein Schreibfehler verhindert den davon abhängigen Wechsel.                                    |
| Als Entwurf behalten | Den aktuellen Stand lokal sichern und den Wechsel erlauben; die Projektdatei bleibt unverändert.                                               |
| Änderungen verwerfen | Den aktuellen ungespeicherten Stand und seine zugehörige Entwurfssicherung bewusst verwerfen. Eine vorhandene Projektdatei bleibt unverändert. |
| Abbrechen            | Im aktuellen Workflow bleiben.                                                                                                                 |

Unter **Entwürfe** auf der Startseite stehen Sicherungszeit und gegebenenfalls die zugehörige Projektdatei. **Fortsetzen** übernimmt einen ausgewählten Zwischenstand wieder zum Bearbeiten; es gibt keine automatische Wiederherstellung. **Als Projekt speichern** legt eine eigenständige Projektdatei an. Nach erfolgreichem Speichern wird nur der zugehörige Entwurf bereinigt; Abbruch oder Schreibfehler erhalten ihn. **Entwurf löschen** verlangt eine Bestätigung und löscht keine zugehörige Projektdatei.

Vor dem Überschreiben einer intern gespeicherten Datei prüft ScriptLab, ob sie außerhalb der Anwendung verändert wurde oder nicht mehr erreichbar ist. Im Konfliktfall kannst du mit **Kopie speichern** eine unabhängige interne Projektkopie anlegen. Die betroffene Datei wird dabei nicht ersetzt.

**Meine gespeicherten Workflows** führt nur bekannte, von dir geöffnete oder gespeicherte Dateien. Es gibt keinen Laufwerkscan. Suche nach Name oder vollständigem Pfad, filtere nach Sprache und sortiere nach Name oder letztem Öffnen. **Zuletzt geöffnet** enthält höchstens fünf tatsächlich geöffnete Projekte; bloßes Auflisten verändert den Zeitpunkt nicht. Bei verschobenen oder fehlenden Dateien bietet **Neu zuordnen** die Auswahl des neuen Speicherorts. **Aus Liste entfernen** entfernt nur den Verweis. Die vollständigen Pfade bleiben im Textfeld lesbar und kopierbar. Ein nicht vollständig lesbarer Index erscheint als Hinweis und wird nicht als sicher leerer Bestand dargestellt.

Einstellungen und Bibliotheksdaten liegen außerhalb der Installation im Electron-Nutzerverzeichnis, gewöhnlich `%APPDATA%\ScriptLab`: `projektbibliothek.json` enthält bekannte Dateiverweise, `entwuerfe\<UUID>.json` lokale Zwischenstände. **Speichern** schreibt `Workflows\<UUID>.scriptlab`; relative Laufpfade verwenden `Arbeitsdateien\<UUID>`. Unter `laufhistorie` liegen Laufindex und Details. Ein Entwurf kann mit **Als Projekt speichern** ohne Zielauswahl als eigener Workflow gesichert werden. Für eine zusätzliche Sicherung außerhalb dieses Verzeichnisses exportierst du eine Projektdatei.

Projektdateien sind JSON-Daten. Das aktuelle Schema 3 enthält die feste `skriptsprache`, stabile Variablen-IDs und die Business-Parameter. Alte Schema-1-Projekte werden beim Öffnen zu VBS-Projekten migriert; Schema 2 behält seine Sprache und erhält leere Business-Angaben. Die externe Originaldatei bleibt unverändert. Ein ausdrückliches Speichern sichert das aktuelle Format intern. Die Anwendung prüft Struktur und Schemaversion. Neuere unbekannte Formate und unbekannte Bausteintypen werden abgewiesen. Ein Rückimport beliebiger `.py`- oder `.vbs`-Dateien als Bausteine ist nicht vorgesehen.

Ein Projekt darf höchstens 5 MiB als UTF-8-JSON-Datei enthalten. Die Anwendung prüft diese Größe vor dem Ersetzen einer vorhandenen Datei. Außerdem gelten Grenzen von 2.000 Bausteinen und 150 Ebenen im gespeicherten Verbindungsbaum; aufeinanderfolgende Verbindungen zählen dabei ebenfalls als Ebenen.

Eine `.scriptlab`-Datei bleibt bearbeitbar; `.py` beziehungsweise `.vbs` ist das daraus erzeugte Script für Windows. Änderungen am Projekt verändern bereits exportierte Dateien nicht. Exportiere erneut, wenn du eine neue Fassung brauchst.

## Grundbeispiele und Business-Vorlagen

Auf der Startseite bietet **Beispielworkflows** die Grundvorlagen **Eine Nachricht anzeigen**, **Dateien in einen Sicherungsordner kopieren** und **Dateinamen in eine Textdatei schreiben**, jeweils für Python und VBS. Dazu kommen die Python-Business-Beispiele für Monatsauswertung, Stammdatenzuordnung, Word-Bestellvorschlag, Dokumenteingang und Dateistapel. Der Sprachfilter grenzt die Auswahl ein. **Als Vorlage öffnen** erstellt eine eigene bearbeitbare Kopie mit neuer Projektkennung und dem Namenszusatz **(Kopie)**. Die Originalvorlage bleibt unverändert. Die Vorlagen sind auch über **Bereiche → Vorlagen** und **Beispiel öffnen** im neuen Editor erreichbar. Die Dateien liegen zusätzlich im Ordner `beispiele` des Quellprojekts. Das Öffnen oder Exportieren verändert keine der beschriebenen Testdateien.

| Projekt                               | Inhalt und spätere Wirkung                                                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-Begruessung.scriptlab`            | Start → Nachricht. Zeigt beim eigenen Start eine Begrüßung.                                                                                                                                                       |
| `02-Datei-Backup.scriptlab`           | Prüft eine Testquelle, legt einen Sicherungsordner an und kopiert eine einzelne Datei. Eine vorhandene Sicherungsdatei führt ausdrücklich zu einem Fehler.                                                        |
| `03-Dateinamenliste.scriptlab`        | Liest die Dateiliste eines Testordners und schreibt die Blattnamen einschließlich Endung zeilenweise in eine UTF-8-Textdatei. Unterordner werden nicht durchsucht. Eine vorhandene Ausgabetextdatei wird ersetzt. |
| `04-Python-Begruessung.scriptlab`     | Python-Fassung der Begrüßung mit derselben Blockbedeutung; der Nachrichtendialog benötigt `tkinter`.                                                                                                              |
| `05-Python-Datei-Backup.scriptlab`    | Python-Fassung des Datei-Backups mit denselben Testpfaden und Überschreibregeln.                                                                                                                                  |
| `06-Python-Dateinamenliste.scriptlab` | Python-Fassung der Dateinamenliste mit derselben UTF-8-Ausgabedatei.                                                                                                                                              |

Für einen späteren eigenständigen Start des Backupbeispiels legst du neben der exportierten Scriptdatei selbst `ScriptLab-Testdaten\Backup\Quelle\beispiel.txt` mit beliebigem Testinhalt an. In ScriptLab legst du denselben relativen Pfad im Arbeitsordner des Workflows an; die Exploreraktion steht unter **Läufe → Vorbereitung → ScriptLab-Arbeitsordner**. Die Sicherung wird nach `ScriptLab-Testdaten\Backup\Sicherung\beispiel.txt` geschrieben. Wiederholtes Starten überschreibt diese Sicherung nicht.

Für das Listenbeispiel legst du neben der exportierten Scriptdatei selbst den Ordner `ScriptLab-Testdaten\Dateiliste\Eingang` mit einigen Testdateien an. In ScriptLab verwendest du dafür den Arbeitsordner des Workflows. Das Ergebnis wird in `ScriptLab-Testdaten\Dateiliste\Dateinamen.txt` geschrieben. Die Namen werden nach Dateiname sortiert. Ein leerer Eingangsordner ergibt nur die Überschrift.

## Dateipfade und Textkodierung

Relative Pfade beziehen sich beim Export auf den **Speicherort der exportierten Scriptdatei** und innerhalb von ScriptLab auf den **ScriptLab-Arbeitsordner** dieses Workflows. Der Speicherort der `.scriptlab`-Datei ist keine Pfadbasis. Externe absolute Quellen bleiben lesbar. Schreibziele der Ausführung in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen; absolute Ziele außerhalb oder relative Pfade, die dorthin führen, werden abgewiesen. Bestehende Pfadwerte werden nicht umgeschrieben. Eigenständig exportierte Scripts behalten ihre ursprüngliche Pfadauflösung. Platzhalter wie `*` und `?` sind bei gewöhnlichen Dateioperationen nicht erlaubt.

Python-Quelltext wird als UTF-8 ohne BOM mit CRLF gespeichert; VBS-Quelltext als UTF-16LE mit BOM und CRLF. Das ist unabhängig von der Kodierung der Textdateien, mit denen dein Workflow später arbeitet. Die Blöcke zum Lesen, Schreiben und Ergänzen bieten UTF-8, UTF-16LE und Windows-ANSI. Beim Ergänzen muss eine bestehende Datei bereits dieselbe Kodierung haben. Fehlerhafte UTF-8- oder UTF-16LE-Daten werden vor dem Überschreiben zurückgewiesen. UTF-8- und UTF-16LE-Textdateien werden mit BOM geschrieben; Windows-ANSI verwendet die lokale Windows-Codepage.

Der Baustein „Datei löschen (erweitert)“ ist besonders gekennzeichnet. Standardmäßig fragt **das gestartete Script** vor dem Löschen nach; „Nein“ ist in dieser Rückfrage vorausgewählt. Die Rückfrage erscheint sowohl bei einem bewussten Test als auch beim eigenständigen Start der exportierten Datei. Beim Bearbeiten oder Exportieren wird nichts gelöscht.

## Optionale Signatur und Updates

Bei einem VBS-Projekt kannst du unter **Bereiche → Einstellungen** „Exportierte Datei signieren“ aktivieren und nach dem Laden der Zertifikate dein eigenes Code-Signing-Zertifikat auswählen. Die Auswahl wird über seinen Fingerabdruck gespeichert. Private Schlüssel und Kennwörter werden nicht im Projekt gespeichert. Ohne geeignetes Zertifikat bleibt der unsignierte Export verfügbar. Bei Python-Projekten sind diese Optionen ausgeblendet: Für `.py` ist kein Signaturverfahren implementiert und es wird kein Signaturprüfergebnis behauptet. Weitere Einrichtungsschritte stehen in der [Signaturdokumentation](SIGNATUR.md).

Eine Signatur hilft, Herausgeber und Änderungen zu prüfen. Sie garantiert weder einen ungefährlichen Workflow noch die Ausführung ohne Windows-, SmartScreen- oder Unternehmenswarnungen.

Ebenfalls unter **Einstellungen** stehen „Nach Updates suchen“, die abschaltbare automatische Prüfung und die bewusste Auswahl von Vorabversionen. Ein gefundenes Update muss erst heruntergeladen und anschließend von dir zur Installation bestätigt werden. Die Anwendung installiert es nicht stillschweigend beim Beenden. Produktive Updates benötigen die eingerichtete Release- und Anwendungssignaturinfrastruktur.

Die [Designnotiz](DESIGNNOTIZ.md) hält die Editorprüfungen fest; die [Startseitendokumentation](STARTSEITE.md) ergänzt die später eingeführte Bibliothek, Entwürfe und lokale Hilfe samt eigenem Prüfstand und Grenzen.
