# Python und VBScript in ScriptLab

Stand: 26.10.2026. Entwickelt von Leon Stolz. Diese Notiz beschreibt die zweite vollwertige Ausgabesprache und trennt praktische Prüfungen von noch offenen Einrichtungsschritten. Die älteren VBS-, Startseiten- und UI-Nachweise bleiben in ihren bisherigen Berichten erhalten.

## Sprache wählen und Projekte erhalten

**Neuer Workflow**, **Neu** und Strg+N öffnen dieselbe Sprachauswahl. Beide Karten verwenden die vorhandenen Graphitflächen und dieselbe Informationsstruktur. Native Radiobuttons zeigen die Auswahl zusätzlich zur Kontur an; der Tastaturfokus bleibt davon unterscheidbar. Erst **Workflow erstellen** ersetzt nach dem üblichen Projekt-/Testschutz den aktiven Workflow. Beim ersten Aufruf ist keine Sprache gewählt. **Abbrechen** erzeugt weder Projekt noch Entwurf. Die letzte erfolgreich gewählte Sprache ist nur ein Vorschlag für die nächste Neuanlage.

Ein Projekt besitzt genau eine feste `skriptsprache`: `python` oder `vbs`. Vorhandene Projekte, Entwürfe, Beispiele und Wiederherstellungen verwenden ihre eigene Sprache und öffnen ohne Auswahlfrage. In Editor, Vorschau, Listen und Testausgabe ist sie als Text erkennbar. Für eine andere Sprache wird ein neuer Workflow erstellt; eine ungeprüfte Konvertierung ist nicht eingebaut.

Das Projektformat ist auf Schema **2** versioniert. Gültige alte Projekte mit Schema 1 ohne Sprachfeld werden im Arbeitsspeicher als VBS übernommen. Das bloße Öffnen schreibt die Quelldatei nicht um. Ein fehlendes Sprachfeld in Schema 2, eine unbekannte Sprache oder ein neueres unbekanntes Schema wird verständlich abgewiesen. Projektindex und lokale Entwürfe erhalten die Sprache ebenfalls. Die bisherige Ansicht, Blockkennungen, Verbindungen und Kommentare bleiben erhalten.

Variablen verwenden stabile Blockly-Kennungen. Namen sind Beschriftungen und keine ausführbaren Bezeichner. Alte Namensfelder werden deterministisch auf Kennungen abgebildet; Umbenennen erhält die Bezüge. Ein leerer Variablenverweis eines unvollständigen Entwurfs wird nicht stillschweigend durch eine neue Variable ersetzt. Beide Generatoren verwenden intern eigene kollisionsfreie Namen.

## Umfang und gemeinsame Bedeutung

Alle **48 vorhandenen Bausteintypen** sind in beiden Sprachen umgesetzt. Die vollständige Zuordnung von Bedeutung, Python-Umsetzung, Abhängigkeiten und Prüffall steht in [PYTHON-FUNKTIONSUMFANG.md](PYTHON-FUNKTIONSUMFANG.md). Es gibt im vorhandenen Katalog keine allgemeinen Shell-, Programmstart-, E-Mail-, Office- oder COM-Automationsblöcke. Solche Funktionen werden durch diese Erweiterung nicht eingeführt.

Der Editor und die fachliche Validierung sind gemeinsam. `skriptErzeugen` wählt anhand des geprüften Projekts den VBS- oder Python-Generator. Python entsteht direkt aus dem typisierten Workflowmodell; erzeugter VBS-Text wird nicht übersetzt oder heimlich gestartet. Die tatsächlich eingesetzte Blockly-Version 13.4.0 liefert `PythonGenerator`, Literalregeln, Einrückung und Operatorrangfolge; ScriptLab ergänzt die vollständige Bedeutung seiner eigenen Blöcke.

Python benötigt für Standardblöcke keine PyPI-Pakete. Windows-Wertumwandlungen und regionale Regeln werden über `ctypes` und ausdrücklich typisierte lokale Windows-APIs erhalten. Dabei werden weder die VBScript-Engine noch ein COM-Server aufgerufen. Insbesondere sind Listen einsbasiert, Wahrheitswerte bei numerischer Umwandlung `-1`/`0`, Zahlenrundung und Textlänge entsprechen der bisherigen Bedeutung, und beide Seiten von Und/Oder werden ausgewertet. Die genauen Grenzfälle sind im Inventar dokumentiert. Ein Pythonworkflow ist damit weiterhin ein für Windows entwickelter Ablauf.

Ein Sprachvergleich deckte einen vorhandenen Datenverlustfall auf: Ungültige Bytes einer vorhandenen UTF-8-/UTF-16LE-Datei konnten beim Ergänzen ersetzt oder verworfen werden. Beide Generatoren prüfen jetzt vor dem Überschreiben die Kodierung. Ein fehlerhafter Altinhalt führt zum Abbruch und bleibt unverändert. Gültige Dateien behalten die bisherige BOM-, CRLF- und Überschreibregel. Diese Korrektur ist ausdrücklich auch auf VBS angewandt und mit echten Dateien beider Sprachen geprüft.

## Python zum Testen einrichten

Unter **Einstellungen → Python-Installation** gibt es den tatsächlichen Status, Version, vollständigen Interpreterpfad, **Interpreter auswählen** und **Erneut prüfen**. Unterstützt wird finales **CPython 3.12 bis 3.15 für Windows x64**. Vorschauversionen, andere Implementierungen, 32-Bit-Interpreter, Store-Aliase und Manager-/Launcherprogramme werden nicht als verwendbare Laufzeit angenommen.

ScriptLab liest geeignete lokale Installationsinformationen und prüft danach eine konkrete absolute `python.exe`: PE-Architektur, Python-Produktmetadaten, vorhandene Laufzeit-DLL und eine feste strukturierte Funktionsprobe mit kurzem Zeitlimit. Bei vorhandenen virtuellen Umgebungen kann deren `Scripts\python.exe` gewählt werden. Ein Aktivierungsscript ist nicht erforderlich. Der gewählte Pfad bleibt eine lokale Anwendungseinstellung und wird weder im Projekt noch im Export gespeichert.

Die Programme `py` und `python` werden nicht auf Verdacht aus der Befehlsauflösung gestartet. Der ältere Launcher und der neue Python Install Manager können unterschiedlich reagieren; insbesondere können Manageraufrufe eine automatische Einrichtung auslösen. ScriptLab öffnet keinen Store und lädt weder Python noch Pakete automatisch. Die Hilfe führt sichtbar zur [offiziellen Windows-Anleitung](https://docs.python.org/3.15/using/windows.html).

Eine fehlende oder ungeeignete Installation verhindert ausschließlich den betroffenen Test. Editor, lokale Hilfe, Projekte, Entwürfe, Vorschau und Export bleiben nutzbar. Vor jedem Python-Test wird die konkret verwendete Installation erneut geprüft und für diesen Lauf festgehalten. Eine danach entfernte oder geänderte Installation ergibt beim nächsten Test einen echten Fehler statt einer erfundenen Bereitschaftsanzeige.

### Dialoge und Tcl/Tk

**Nachricht anzeigen**, **Texteingabe**, **Ja-/Nein-Frage** und die Löschrückfrage benötigen `tkinter` mit funktionsfähigem Tcl/Tk. Die Prüfung fordert diese Komponente nur für tatsächlich verwendete aktive Dialogblöcke an. Ein Ablauf ohne Dialoge darf beispielsweise mit der offiziellen embeddable Distribution ohne Tk funktionieren. Fehlendes Tk stoppt einen betroffenen Test vor dem Start des Nutzerworkflows.

Die Dialoge erscheinen als eigene echte Windows-/Tk-Fenster außerhalb des Testpanels. Texteingabe besitzt **OK** und **Abbrechen**; leeres OK und Abbrechen ergeben entsprechend der bisherigen VBS-Eingabe einen leeren Text. Ja/Nein bleiben Wahrheitswerte. Vor Datei-Löschen ist Nein vorbelegt. Eine Ordnerauswahl der Anwendung bestimmt nur den Testkontext und führt keine Workflowaktion aus.

## Testen, Ausgabe und Stoppen

**Testen** erfasst den vollständigen aktuellen Editorstand einschließlich ungespeicherter Änderungen. Validierung, Generator, Teststandkennung, Quelltext und Zeilen-/Blockzuordnung gehören genau zu diesem Stand. Ein später geänderter Workflow macht die alte Ausgabe erkennbar veraltet. Ein Test speichert weder die Projektdatei noch eine vorhandene Exportdatei.

Python und VBS teilen dieselben Zustände und denselben einzelnen Laufplatz. Vorbereitung, laufender Test und Stoppen sperren einen zweiten Start sowie inhaltliche Editoränderungen. Auswahl, Lesen, Zoom und Ansicht bleiben möglich. Das Panel zeigt Sprache, tatsächlich verwendete Python-Version, Laufzeit, Basisordner, Zeitlimit, echte Ausgabe und Abschlussstatus. Ein regulärer Exitcode 0 bedeutet **Ohne gemeldeten Fehler beendet**, keine automatisch bewiesene fachliche Richtigkeit.

Der Hinweis gilt unverändert: **Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen.** Ein eigener Prozess, eine virtuelle Umgebung und das Jobobjekt sind keine Dateisystem-Sandbox. Stoppen und Zeitlimit nehmen frühere Dateiänderungen nicht zurück.

Der feste Windows-Testhost startet den geprüften absoluten Interpreter mit `-I -u -X utf8` und getrennten Argumenten. Node verwendet asynchronen Prozessstart und `shell: false`. `-I` ignoriert Python-Umgebungsvariablen; deshalb wird UTF-8 ausdrücklich über `-X` und die generierten Streams festgelegt. Beide Ausgabeströme werden fortlaufend und inkrementell als UTF-8 verarbeitet, als Text dargestellt und im Speicher begrenzt. Die VBS-Ausgabe bleibt getrennt UTF-16LE. Eine volle sichtbare Ausgabe hält das Lesen der Pipes nicht an.

Beide Laufarten werden vor dem Fortsetzen an dasselbe Windows-Jobobjekt gebunden. **Stoppen**, native Frist und das Schließen des letzten Jobhandles beenden ausschließlich den zugehörigen Prozessbaum. Ein Abschluss wird erst nach echtem Prozess- und Streamende gemeldet. Navigation, Schließen und Updateinstallation behandeln zuerst diesen Abschluss und anschließend gesondert ungespeicherte Arbeit. Nach einem Neustart wird kein Test automatisch erneut gestartet.

Pythonfehler behalten ihren Originaltraceback. Ein tokengebundener Fehlerkanal und die tatsächlichen Quelltextzeilen ordnen verlässlich erkannte Stellen einem Block zu. Der Editor bietet nur bei bekannter Zuordnung **Baustein anzeigen** an. Technische Fehlermeldungen bleiben zugänglich; pauschales Verschlucken fachlicher Ausnahmen ist nicht eingebaut.

## Export und eigenständige Ausführung

Pythonprojekte besitzen **Python-Script exportieren** mit `.py`-Filter und UTF-8 ohne BOM, CRLF. VBS-Projekte besitzen **VBS-Script exportieren** mit `.vbs`-Filter und weiterhin UTF-16LE mit BOM, CRLF. Vorschau, Export und Test verwenden denselben Generator pro Sprache; nur der ausdrücklich angegebene Testkontext unterscheidet sich.

Ein Python-Export enthält seine benötigten Hilfsfunktionen und erwartet weder ScriptLab noch Node.js, lokale Anwendungsdateien oder den Interpreterpfad des Entwicklungsrechners. Zum späteren Start wird die passende eigene CPython-Installation verwendet. Beispiel für PowerShell, mit selbst anzupassenden vorhandenen Pfaden:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Begruessung.py"
```

Ein Doppelklick ist von der vorhandenen Windows-Dateizuordnung abhängig und wird nicht garantiert. Dialogworkflows benötigen auch außerhalb von ScriptLab Tcl/Tk. Die Kodierung vom Workflow gelesener/geschriebener Textdateien wird gesondert am Dateiblock festgelegt und folgt nicht der Quelltext- oder Streamkodierung.

Relative Pfade beziehen sich beim eigenständigen Export auf den Ordner der Scriptdatei. Beim Test wird dagegen ausdrücklich der sichtbare fachliche Basisordner übergeben. Technischer Scriptordner, Prozess-Arbeitsverzeichnis und Basisordner sind getrennt. Absolute Pfade bleiben unverändert; ein später an anderem Ort ausgeführter Export kann deshalb andere relative Dateien verwenden als der Test.

Authenticode bleibt eine optionale Funktion ausschließlich für VBS. Für `.py` ist kein Signaturverfahren implementiert. Python zeigt weder VBS-Zertifikatsfelder noch ein erfundenes Signatur-/Vertrauensergebnis. Anwendungssignatur und Nutzerworkflow-Signatur bleiben getrennt.

## Beispiele und Offlinehilfe

Die vorhandenen Aufgaben **Eine Nachricht anzeigen**, **Dateien in einen Sicherungsordner kopieren** und **Dateinamen in eine Textdatei schreiben** liegen als jeweils drei echte Projektdateien pro Sprache vor. Der Sprachfilter in der Beispielübersicht wählt ihre sichtbaren Varianten. **Als Vorlage verwenden** erstellt eine neue Projektkennung; die Vorlage bleibt unverändert. Bei Backup und Dateiliste müssen die ausdrücklich als Testpfade angegebenen Quell-/Zielordner bewusst angepasst werden.

Die vorhandene lokale Hilfesuche erklärt Sprachwahl, Einrichtung, Laufzeit-/Tk-Probleme, Testkontext und beide Exportformate. Anleitungen werden als React-Text dargestellt und führen keinen beliebigen Hilfecode aus. Auch ein Beispielverweis schützt vorher die aktive Arbeit.

## Tatsächlich geprüfter Stand

Die zusammengefassten Abschlussberichte werden nach den laufenden Windows-Prüfungen hier ergänzt. Bereits ausgeführte Teilprüfungen sind getrennt im [Funktionsinventar](PYTHON-FUNKTIONSUMFANG.md) und im [Laufzeitbericht zu CPython 3.15.2](../tests/ui/nachweise/python-runtime-315-zusammenfassung.json) dokumentiert. Ein Teilbericht ist kein vollständiger Abschlussnachweis.

Die Python-Sprachauswahl wurde bisher bei tatsächlichen 1282 × 721 und 851 × 721 CSS-Pixeln, DPR 1,75 sowie 200 Prozent UI-Textgröße mit echten Tastatureingaben geprüft. Die beiden Karten wechseln von zwei auf eine Spalte; es entstand keine äußere horizontale Überbreite. Dies ist keine neue native Windows-Skalierungsprüfung aller Stufen 100/125/150/200 Prozent. Die älteren allgemeinen Skalierungsnachweise bleiben in [DESIGNNOTIZ.md](DESIGNNOTIZ.md); eine vollständige Screenreaderabnahme wird daraus nicht abgeleitet.

Die Entwicklungsumgebung ist Windows 11 Pro x64, Build 26200. Praktisch vorhanden und geprüft sind CPython 3.12.6 mit Tk und eine ausschließlich für Entwicklung geladene portable CPython-3.15.2-Distribution ohne Tk. Andere freigegebene Minorversionen sind durch die Versionsgrenzen zugelassen, aber damit noch nicht praktisch geprüft. Die portable Laufzeit wird nicht mit ScriptLab ausgeliefert, nicht registriert und nicht in den PATH eingetragen.

Zwei bereits vorhandene virtuelle Umgebungen mit CPython 3.12.6 wurden tatsächlich geprüft und für denselben eigenständigen Export verwendet. Ein erster Versuch deckte den normalen Windows-venv-Redirector mit der Originalressource `py.exe` auf. Die Erkennung akzeptiert ihn jetzt ausschließlich im bestätigten eigenen `Scripts\\python.exe` mit passender `pyvenv.cfg`, geprüftem Basisinterpreter und Laufzeit-DLL; allgemeine Launcher bleiben gesperrt. Der [Exportnachweis](../tests/ui/nachweise/python-export-zusammenfassung.json) trennt den gemeinsamen 2/2-Lauf vom zusätzlich gezielten zweiten venv-Lauf. Der eigentliche Exportprozess erhielt nur `[python.exe, Export.py]`, keine Editorflags und keinen Testtoken. Die App war nachweislich geschlossen, das Arbeitsverzeichnis ein anderer eigener Ordner; Ausgabe und Ergebnisdatei mit Unicode, BOM und CRLF wurden wirklich gelesen.

Ein Windows-Kurzpfadfall reproduzierte die fehlende Fehlerzeile auf dem GitHub-Runner: CPython nennt im Traceback den langen Pfad, während die Anwendung noch den 8.3-Alias verglich. Der Testhost erhält jetzt den nach dem Schreiben aufgelösten tatsächlichen Dateipfad. Die genaue Blockzuordnung bleibt erhalten. Kurzpfad und normaler Dateifehler bestanden danach gemeinsam mit CPython 3.15.2, 2/2 gezielt geprüfte Fälle; die acht anderen Fälle dieser gezielten Auswahl wurden nicht als bestanden gezählt.

Native Eingabefenster wurden mit Unicode `Grüße aus Python 😀`, leerem OK und **Abbrechen** bedient. Die tatsächliche Ausgabe enthielt den Unicode-Text und zwei leere Rückgabewerte. Ein anschließender Stopp über die Editorwerkzeugleiste beendete die offene Python-Ja-/Nein-Rückfrage mit Zustand `abgebrochen`, Exitcode 3221225786 und ohne Erreichen späterer Blöcke. Eine eigene Nachrichtenbox wurde mit dem festen Zeitlimit von einer Sekunde beendet; tatsächlicher Zustand `zeitlimit`, gleicher Abbruch-Exitcode, kein nachfolgender Ausgabetext. Die beiden Ja-/Nein-Antworten, Nachrichtenbox-OK und die abgelehnte Löschrückfrage sind in der neuen Python-UI noch nicht vollständig interaktiv abgenommen: Der Windows-UI-Helper erkannte diese Tk-eigenen nativen Unterfenster nicht zuverlässig als auswählbares Ziel. Die Anwendung wurde dafür nicht um eine andere Dialogsemantik erweitert. Es wird kein erfolgreicher vollständiger Dialogdurchlauf behauptet. Der vorhandene VBS-Dialognachweis bleibt gesondert gültig.

Die GitHub-Windows-Prüfung stellt für ihre ausdrücklich gestarteten Tests CPython 3.15.2 x64 bereit. Der absolute Testinterpreter wird ausschließlich im Testharness übergeben und über die normale produktive Prüfung bestätigt. Die Anwendung selbst liest keinen allgemeinen Interpreter-Umgebungspfad. Ein lokaler grüner Lauf ersetzt keinen bestätigten GitHub-Lauf.

## Noch einzurichten oder gesondert zu prüfen

- Die vollständige praktische Versionsmatrix einschließlich CPython 3.13/3.14 und weitere Windows-Regionseinstellungen.
- Die oben konkret offenen nativen Python-Dialogentscheidungen mit Ja/Nein, Nachrichtenbox-OK und abgelehnter Löschrückfrage in einer interaktiven Windows-Sitzung.
- Eine vollständige Abnahme mit Windows-Screenreader und erneute native Skalierungsdurchläufe aller verlangten Stufen für die neue Auswahlansicht.
- Eine echte Nutzerstudie mit Personen ohne Programmierkenntnisse.
- Produktive Entwicklersignatur, Releaseveröffentlichung und die Updatekette mit zwei tatsächlich installierten signierten Versionen. Diese Infrastruktur wird durch die Python-Erweiterung nicht vorgetäuscht.
- Die Projektlizenz bleibt Leon Stolz vorbehalten; der öffentliche Quellcode ist keine erfundene Lizenzfreigabe.

## Offizielle technische Quellen

- [CPython 3.15 unter Windows und Python Install Manager](https://docs.python.org/3.15/using/windows.html).
- [CPython 3.15: Aufrufoptionen, UTF-8 und isolierter Modus](https://docs.python.org/3.15/using/cmdline.html).
- [CPython 3.12: virtuelle Umgebungen](https://docs.python.org/3.12/library/venv.html), [Tkinter](https://docs.python.org/3.12/library/tkinter.html) und [öffentliche Dialogschnittstellen](https://docs.python.org/3.12/library/dialog.html).
- [Blockly-Codegenerierung](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/); konkrete API mit dem lokal eingesetzten Paket 13.4.0 abgeglichen.
- [Node.js 24: asynchrone Childprozesse](https://nodejs.org/docs/latest-v24.x/api/child_process.html).
- [Microsoft: Windows-Jobobjekte](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
- [Electron-Sicherheitsregeln](https://www.electronjs.org/docs/latest/tutorial/security).
