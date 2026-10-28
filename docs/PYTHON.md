# Python und VBScript in ScriptLab

Aktuelle Bedienung: 28.10.2026. Entwickelt von Leon Stolz. Python ist die Hauptsprache für Daten- und Dokumentabläufe; VBS bleibt für die 48 gemeinsamen Grundbausteine erhalten. Die Anwendung verwendet mitgeliefertes CPython 3.15.2 x64 einschließlich Tcl/Tk und Business-Paketen. Die unten erhaltenen historischen Python-0.1.0-Prüfstände beschreiben die frühere externe Einrichtung und gelten nicht als Abnahme dieser Umstellung.

## Sprache wählen und Projekte erhalten

**Neuer Workflow**, **Workflow → Neuer Workflow** und Strg+N öffnen dieselbe ausdrückliche Sprachauswahl mit zwei Karten. Python wird für Geschäftsprozesse empfohlen; VBS bleibt für kleine Windows-Automatisierungen wählbar. Beide Karten verwenden die Office-Farbrollen. Native Radiobuttons zeigen die Auswahl zusätzlich zur Kontur an; der Tastaturfokus bleibt davon unterscheidbar. Erst **Workflow erstellen** ersetzt nach dem üblichen Projekt-/Testschutz den aktiven Workflow. Beim ersten Aufruf ist keine Sprache gewählt. **Abbrechen** erzeugt weder Projekt noch Entwurf. Die letzte erfolgreich gewählte Sprache ist nur ein Vorschlag für die nächste Neuanlage.

Ein Projekt besitzt genau eine feste `skriptsprache`: `python` oder `vbs`. Vorhandene Projekte, Entwürfe, Beispiele und Wiederherstellungen verwenden ihre eigene Sprache und öffnen ohne Auswahlfrage. In Editor, Vorschau, Listen und Testausgabe ist sie als Text erkennbar. Für eine andere Sprache wird ein neuer Workflow erstellt; eine ungeprüfte Konvertierung ist nicht eingebaut.

Das Projektformat verwendet Schema **3**. Es ergänzt Parameterdefinitionen, nicht geheime Test-/Echt-Parametersätze und Ressourcenreferenzen. Gültige alte Projekte mit Schema 1 ohne Sprachfeld werden im Arbeitsspeicher als VBS übernommen; Schema 2 behält seine Sprache und erhält leere Business-Angaben. Das bloße Öffnen schreibt die Quelldatei nicht um. Ein fehlendes Sprachfeld ab Schema 2, eine unbekannte Sprache oder ein neueres unbekanntes Schema wird verständlich abgewiesen. Projektindex und lokale Entwürfe erhalten die Sprache ebenfalls. Ansicht, Blockkennungen, Verbindungen und Kommentare bleiben erhalten.

Variablen verwenden stabile Blockly-Kennungen. Namen sind Beschriftungen und keine ausführbaren Bezeichner. Alte Namensfelder werden deterministisch auf Kennungen abgebildet; Umbenennen erhält die Bezüge. Ein leerer Variablenverweis eines unvollständigen Entwurfs wird nicht stillschweigend durch eine neue Variable ersetzt. Beide Generatoren verwenden intern eigene kollisionsfreie Namen.

## Umfang und gemeinsame Bedeutung

Alle **48 gemeinsamen Grundbausteintypen** sind in beiden Sprachen umgesetzt. Die vollständige Zuordnung ihrer Bedeutung, Python-Umsetzung, Abhängigkeiten und Prüffälle steht in [PYTHON-FUNKTIONSUMFANG.md](PYTHON-FUNKTIONSUMFANG.md). Zusätzlich enthält der aktuelle Katalog **47 Python-Business-Bausteintypen** für Tabellen, Datenqualität, Geschäftsdateien, Excel, Word und PDF. Allgemeine Shell-, Programmstart-, E-Mail- und Office-COM-Automationsblöcke gibt es nicht. Die Dokumentadapter bearbeiten unterstützte Dateien über den festen Python-Paketsatz, ohne Office zu starten.

Der Editor und die fachliche Validierung sind gemeinsam. `skriptErzeugen` wählt anhand des geprüften Projekts den VBS- oder Python-Generator. Python entsteht direkt aus dem typisierten Workflowmodell; erzeugter VBS-Text wird nicht übersetzt oder heimlich gestartet. Die tatsächlich eingesetzte Blockly-Version 13.4.0 liefert `PythonGenerator`, Literalregeln, Einrückung und Operatorrangfolge; ScriptLab ergänzt die vollständige Bedeutung seiner eigenen Blöcke.

Python benötigt für Standardblöcke keine PyPI-Pakete. Windows-Wertumwandlungen und regionale Regeln werden über `ctypes` und ausdrücklich typisierte lokale Windows-APIs erhalten. Dabei werden weder die VBScript-Engine noch ein COM-Server aufgerufen. Insbesondere sind Listen einsbasiert, Wahrheitswerte bei numerischer Umwandlung `-1`/`0`, Zahlenrundung und Textlänge entsprechen der bisherigen Bedeutung, und beide Seiten von Und/Oder werden ausgewertet. Die genauen Grenzfälle sind im Inventar dokumentiert. Ein Pythonworkflow ist damit weiterhin ein für Windows entwickelter Ablauf.

Ein Sprachvergleich deckte einen vorhandenen Datenverlustfall auf: Ungültige Bytes einer vorhandenen UTF-8-/UTF-16LE-Datei konnten beim Ergänzen ersetzt oder verworfen werden. Beide Generatoren prüfen jetzt vor dem Überschreiben die Kodierung. Ein fehlerhafter Altinhalt führt zum Abbruch und bleibt unverändert. Gültige Dateien behalten die bisherige BOM-, CRLF- und Überschreibregel. Diese Korrektur ist ausdrücklich auch auf VBS angewandt und mit echten Dateien beider Sprachen geprüft.

## Mitgelieferte Python- und Business-Komponenten

Python-Workflows in ScriptLab verwenden ausschließlich das mitgelieferte reguläre **CPython 3.15.2 für Windows x64**. Standardbibliothek, Tcl/Tk und die elf festgelegten Business-Pakete gehören zum Offline-Bündel. Eine zusätzliche Installation, Interpreterwahl, virtuelle Umgebung oder Online-/Offline-Paketeinrichtung ist für die normale App-Bedienung nicht erforderlich.

Unter **Einstellungen → Laufzeit** stehen der tatsächliche Komponentenstatus und **Erneut prüfen**. Versionen und Programmdatei sind lesend in technischen Angaben erreichbar. Die Anwendung verwendet weder einen allgemeinen `python`-Befehl noch Store-Aliase oder Installationsmanager als Ersatz. Eine fehlende oder beschädigte App-Komponente wird als Fehler gemeldet und nicht durch eine Bereitschaftsanzeige verdeckt. Ein Workflowstart lädt oder installiert keine Pakete.

Der Paketbestand ist in `laufzeit/requirements-business.lock` festgelegt. Herkunft, Originalquellen und Beilagen des Anwendungsbündels beschreibt [python-herkunft.md](../laufzeit/python-herkunft.md). Die frühere manuelle Laufzeiteinrichtung ist kein aktueller Bedienweg. Für exportierte Scripts und Business-Pakete benötigt der Empfänger dagegen eine eigene passende Python-Umgebung.

Die Business-Datenvorschau liest begrenzte Ergebnisse, der Prüflauf verändert keine fachlichen Ziele, und erst **Ausführen** startet echte Dateiaktionen. Normale Aktionsblöcke werden nicht heimlich im Vorschau-/Prüflaufmodus ausgeführt. Parameter und **Quellen und Ausgabeziele** vor einem vollständigen Lauf prüfen. Ein Parametersatz mit dem Namen Testdaten ist keine Sandbox. Die Bedienwege stehen in [BUSINESS-BEDIENUNG.md](BUSINESS-BEDIENUNG.md).

### Dialoge und Tcl/Tk

**Nachricht anzeigen**, **Texteingabe**, **Ja-/Nein-Frage** und die Löschrückfrage verwenden `tkinter` und Tcl/Tk aus dem vollständigen Anwendungsbündel. Dialogworkflows benötigen keine zusätzliche Tk-Einrichtung. Eine fehlerhafte App-Komponente wird vor dem betroffenen Workflowstart gemeldet.

Die Dialoge erscheinen als eigene echte Windows-/Tk-Fenster außerhalb der Laufansicht. Texteingabe besitzt **OK** und **Abbrechen**; leeres OK und Abbrechen ergeben entsprechend der bisherigen VBS-Eingabe einen leeren Text. Ja/Nein bleiben Wahrheitswerte. Vor Datei-Löschen ist Nein vorbelegt. Der Arbeitsordner des Workflows wird von ScriptLab festgelegt; eine Basisordner-Auswahl entfällt.

Unverbundene Werte gehören nicht zum ausgeführten Hauptablauf. Die Komponentenprüfung folgt den Verbindungen ab dem Startbaustein. **Historischer Tk-Bedarfsnachweis vom 27.10.2026:** Ein Regressionstest scheiterte vor der damaligen Korrektur und bestand danach; die vollständige Laufzeitdatei bestand mit einer externen Tk-losen CPython-3.15.2-Distribution mit **11/11 Fällen**, einschließlich echter Ausgabe trotz losem Dialogwert. [Der bereinigte Nachweis](../tests/ui/nachweise/python-laufzeit-ohne-tk-abschluss.json) zählt diesen eigenen Lauf getrennt. Er prüft nicht das neue vollständige Offline-Bündel.

## Ein Tabellenergebnis direkt prüfen

Unter **Daten und Parameter → Datenvorschau** wählst du **Ergebnis bis zu diesem Schritt** sowie die verwendeten Werte und startest **Datenvorschau laden**. Die Vorschau beginnt direkt dort; ein Wechsel zur Laufvorbereitung und eine weitere Startbestätigung sind nicht erforderlich. Sie endet am ausgewählten Tabellenschritt und lässt unfertige Nachfolger aus dem Vorschauplan heraus. Der bearbeitete Workflow wird dadurch nicht verändert.

Unterstützt werden verbundene lesende Business-Tabellenschritte im Hauptablauf. Schleifen, Verzweigungen und aktive Grundbausteine oder Dateiaktionen im benötigten Vorlauf können nicht als diese reine Schrittvorschau geladen werden; der deaktivierte Start erklärt die Grenze. Die Anzeige ist auf 200 Zeilen und 256 KiB begrenzt. Filter, Sortierungen und Gruppierungen können dennoch die gesamte Quelle lesen. Spaltenvorschläge werden der gewählten Eingabetabelle und dem passenden Vorschaukontext zugeordnet.

## Testen, Ausgabe und Stoppen

**Testen** bereitet den vollständigen aktuellen Editorstand einschließlich ungespeicherter Änderungen vor. Die ausdrücklich gewählte Schrittvorschau ist davon getrennt und endet am ausgewählten Tabellenschritt. Validierung, Generator, Standkennung, Quelltext und Zeilen-/Blockzuordnung gehören zum jeweiligen Lauf. Ein später geänderter Workflow macht die alte Ausgabe erkennbar veraltet. Ein Lauf speichert weder die Projektdatei noch eine vorhandene Exportdatei.

Python und VBS teilen dieselben Zustände und denselben einzelnen Laufplatz. Vorbereitung, laufender Test und Stoppen sperren einen zweiten Start sowie inhaltliche Editoränderungen. Auswahl, Lesen, Zoom und Ansicht bleiben möglich. Die Laufdetails zeigen Sprache, tatsächlich verwendete Python-Version, Laufzeit, Arbeitsordner, Zeitlimit, echte Ausgabe und Abschlussstatus. Ein regulärer Exitcode 0 bedeutet **Ohne gemeldeten Fehler beendet**, keine automatisch bewiesene fachliche Richtigkeit. Abgeschlossene Läufe stehen unter **Alle Läufe** zur Auswahl; das Öffnen alter Details startet keinen Prozess.

Der Hinweis gilt unverändert: **Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen.** Ein eigener Prozess, eine virtuelle Umgebung und das Jobobjekt sind keine Dateisystem-Sandbox. Stoppen und Zeitlimit nehmen frühere Dateiänderungen nicht zurück.

Der feste Windows-Testhost startet den geprüften absoluten Interpreter mit `-I -u -X utf8` und getrennten Argumenten. Node verwendet asynchronen Prozessstart und `shell: false`. `-I` ignoriert Python-Umgebungsvariablen; deshalb wird UTF-8 ausdrücklich über `-X` und die generierten Streams festgelegt. Beide Ausgabeströme werden fortlaufend und inkrementell als UTF-8 verarbeitet, als Text dargestellt und im Speicher begrenzt. Die VBS-Ausgabe bleibt getrennt UTF-16LE. Eine volle sichtbare Ausgabe hält das Lesen der Pipes nicht an.

Beide Laufarten werden vor dem Fortsetzen an dasselbe Windows-Jobobjekt gebunden. **Stoppen**, native Frist und das Schließen des letzten Jobhandles beenden ausschließlich den zugehörigen Prozessbaum. Ein Abschluss wird erst nach echtem Prozess- und Streamende gemeldet. Navigation, Schließen und Updateinstallation behandeln zuerst diesen Abschluss und anschließend gesondert ungespeicherte Arbeit. Nach einem Neustart wird kein Test automatisch erneut gestartet.

Pythonfehler behalten ihren Originaltraceback. Ein tokengebundener Fehlerkanal und die tatsächlichen Quelltextzeilen ordnen verlässlich erkannte Stellen einem Block zu. Der Editor bietet nur bei bekannter Zuordnung **Baustein anzeigen** an. Technische Fehlermeldungen bleiben zugänglich; pauschales Verschlucken fachlicher Ausnahmen ist nicht eingebaut.

## Export und eigenständige Ausführung

Pythonprojekte ohne Business-Bausteine besitzen **Python-Script exportieren** mit `.py`-Filter und UTF-8 ohne BOM, CRLF. Business-Projekte besitzen **Business-Paket exportieren** und erzeugen ein eigenständiges ZIP. VBS-Projekte besitzen **VBS-Script exportieren** mit `.vbs`-Filter und weiterhin UTF-16LE mit BOM, CRLF. Codevorschau, Export und Test verwenden denselben Generator pro Sprache; der ausdrücklich angegebene Laufkontext bestimmt die technische Testfassung.

Ein gewöhnlicher Python-Export enthält seine benötigten Hilfsfunktionen und erwartet weder ScriptLab noch Node.js, lokale Anwendungsdateien oder den Interpreterpfad des Entwicklungsrechners. Zum späteren Start wird die passende eigene CPython-Installation verwendet. Beispiel für PowerShell, mit selbst anzupassenden vorhandenen Pfaden:

```powershell
& "C:\Python315\python.exe" -I -u -X utf8 "C:\Meine Workflows\Begruessung.py"
```

Ein Doppelklick ist von der vorhandenen Windows-Dateizuordnung abhängig und wird nicht garantiert. Dialogworkflows benötigen auch außerhalb von ScriptLab Tcl/Tk. Die Kodierung vom Workflow gelesener/geschriebener Textdateien wird gesondert am Dateiblock festgelegt und folgt nicht der Quelltext- oder Streamkodierung.

Ein Business-ZIP ergänzt eigene Python-Module, Requirements mit festen Hashes, Parameterbeispiel, Anleitung und die unveränderte Vera-Schrift samt Original-Lizenz und Business-Lizenzhinweisen. Eigene Vorlagen, Bilder und TTF-Schriften werden nur ausdrücklich ausgewählt; Geschäftsdaten, Journale und Laufberichte werden nicht automatisch beigelegt. Der Empfänger bereitet bewusst eine passende Umgebung vor. Das Script selbst lädt oder installiert nichts. Mitgelieferte Module ersetzen die ScriptLab-Installation; die Anwendung muss nicht vorhanden sein. Die Konfiguration und sämtliche Pfadwerte vor einer Weitergabe prüfen.

Wiederaufnahme prüft neben Workflow, Parametern, Quellen und bestätigten Ausgaben eine Laufzeitidentität aus eigenen Modulbytes, Python-Build, Paketversionen und Vera-Schrift. Sie ist keine allgemeine Genau-einmal-Garantie. Journale über 16 MiB werden beim Einlesen abgewiesen; Dokumenttabellen sind auf 20.000 Zellen begrenzt. Formeln werden nicht berechnet, PDF-Scans nicht per OCR gelesen und Office-Dateien nicht konvertiert. DuckDBs Speicherbudget ist kein Prozess-RAM-Limit; das dokumentierte breite Millionen-CSV-Profil scheiterte unter 64 MB, der schmalere Plan bestand. Die konkreten Grenzen stehen in den [Datenlastnachweisen](BUSINESS-LEISTUNG-DATEN.md) und der [Dokumentdokumentation](BUSINESS-DOKUMENTE.md).

Relative Pfade beziehen sich beim eigenständigen Export auf den Ordner der Scriptdatei. Innerhalb von ScriptLab verwenden sie den automatisch verwalteten Arbeitsordner des Workflows. Technischer Scriptordner und fachliche Arbeitsdateien bleiben getrennt. Externe absolute Quellen bleiben lesbar; Schreibziele in ScriptLab müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen. Unzulässige Ziele werden abgewiesen und nicht umgeschrieben. Ein eigenständig ausgeführter Export behält dagegen seine ursprünglichen Pfadwerte.

Authenticode bleibt eine optionale Funktion ausschließlich für VBS. Für `.py` ist kein Signaturverfahren implementiert. Python zeigt weder VBS-Zertifikatsfelder noch ein erfundenes Signatur-/Vertrauensergebnis. Anwendungssignatur und Nutzerworkflow-Signatur bleiben getrennt.

## Beispiele und Offlinehilfe

Die drei Aufgaben **Eine Nachricht anzeigen**, **Dateien in einen Sicherungsordner kopieren** und **Dateinamen in eine Textdatei schreiben** liegen für jede Sprache als echte Projektdateien vor, insgesamt sechs Vorlagen. Der Sprachfilter in der Beispielübersicht wählt ihre sichtbaren Varianten. **Als Vorlage verwenden** erstellt eine neue Projektkennung; die Vorlage bleibt unverändert. Bei Backup und Dateiliste müssen die ausdrücklich als Testpfade angegebenen Quell-/Zielordner bewusst angepasst werden.

Dazu kommen die fünf Python-Business-Beispiele Monatsauswertung, Stammdatenzuordnung, Word-Bestellvorschlag, PDF-Dokumenteingang und CSV-Dateistapel. Deren synthetische Dateien werden in eine neue private Beispielkopie übernommen und ihre Pfadparameter absolut daran gebunden. Das erhält die Testdatenbezüge beim späteren Öffnen oder Wiederherstellen. Für produktive Quellen und Ziele sind die Werte bewusst zu ändern. Keine Vorlage läuft automatisch beim Öffnen. Erwartete Ergebnisse und getrennte Fach-/Bildnachweise stehen in [BUSINESS-BEDIENUNG.md](BUSINESS-BEDIENUNG.md).

Die lokale Hilfesuche erklärt Sprachwahl, Komponentenstatus, Schrittvorschau, Laufkontext und Exportformate. Anleitungen werden als React-Text dargestellt und führen keinen beliebigen Hilfecode aus. Auch ein Beispielverweis schützt vorher die aktive Arbeit.

## Historischer Prüfstand des gemeinsamen Python-Grundumfangs

Historischer Stand vom 27.10.2026 und den jeweils genannten Quellständen: Die folgenden Lauf-, CI- und Installerzahlen gehören zur Python-Erweiterung vor dem Business-Ausbau und vor dem mitgelieferten Offline-Bündel. Sie werden nicht mit neuen Modulprüfungen zu einer angeblichen vollständigen Business-UI-Abnahme addiert. Die aktuelle Bedienung steht in [NEUE-BEDIENUNG.md](NEUE-BEDIENUNG.md). [BUSINESS-ABNAHME.md](BUSINESS-ABNAHME.md) und [ABNAHME.md](ABNAHME.md) bewahren die zugeordneten älteren Nachweise.

Der vollständige lokale Lauf bestand mit **334/334 Unit-, Generator-, Datei-, Windows-Prozess- und Komponententests in 85,69 Sekunden**. Anschließend bestand der separat ergänzte echte Dateiguard für fehlende/ungeeignete Pythondateien gemeinsam mit seinen 21 bisherigen Auswahlfällen (22/22, keine Prozessausführung). Diese getrennten Läufe werden nicht als gemeinsamer lokaler 335er-Lauf ausgegeben. Der vollständige Electron-Durchlauf nach der Speicherstatuskorrektur bestand mit **96/96 Desktopfällen in 254,86 Sekunden**, ohne übersprungene, instabile oder unerwartet fehlgeschlagene Fälle. Er umfasst die feste DPR-1-Regression, die sechs neuen Pythonfälle sowie sämtliche bisherigen VBS-, Speicher-, Schutz-, Fokus-, Zoom- und Ziehprüfungen. Der spätere Tk-Bedarfsfall wurde zusätzlich mit 11/11 echten Laufzeitfällen geprüft.

Die [Unit-Zusammenfassung](../tests/ui/nachweise/python-unit-zusammenfassung.json) und [Desktop-Zusammenfassung](../tests/ui/nachweise/python-desktop-zusammenfassung.json) enthalten Zeitpunkte, Zählwerte und SHA-256 der unveränderten Rohberichte. Der [vorherige Unitlauf](../tests/ui/nachweise/python-unit-vorheriger-lauf.json) hält 333 bestandene Fälle und einen VBS-Zeitlimitfall fest. Die ursprüngliche Ursache der sporadischen VBS-Verzögerungen ist nicht abschließend geklärt; die Fristen wurden für den grünen Nachlauf nicht abgeschwächt. Der [erste Desktoplauf](../tests/ui/nachweise/python-desktop-vorheriger-lauf.json) dokumentiert veraltete Erwartungen und fehlende Bereitschaftsnachweise des Testharness. Ein zweiter Lauf mit 95/96 scheiterte allein an einer weiteren alten Promptvorgabe-Erwartung; der konkrete Rename-/ID-/Undo-/Fokusfall und danach der vollständige Lauf bestanden mit der tatsächlichen Blockly-Dialogbedienung. Auch dieser zweite Rohbericht bleibt lokal unter `artifacts/python/desktop-ergebnis-zweiter-lauf.json` erhalten.

Der vollständige Weg **Sprachwahl → Baustein einfügen und konfigurieren → Projekt speichern → öffnen → Vorschau → Export → bewusster Test** wurde in Electron ausgeführt. Weitere echte Pythonfälle prüfen Neustart eines Entwurfs ohne automatischen Lauf, unabhängige Vorlagenkopien und Sprachfilter, den genau aktuellen ungespeicherten Teststand, gemeinsame Startsperre mit VBS, Stoppen, Zeitlimit, Navigation und Schließen. Tests verwenden ausschließlich eigene temporäre Dateien. Zusätzliche Teilprüfungen sind im [Funktionsinventar](PYTHON-FUNKTIONSUMFANG.md) und im [Laufzeitbericht zu CPython 3.15.2](../tests/ui/nachweise/python-runtime-315-zusammenfassung.json) getrennt dokumentiert.

Die Python-Sprachauswahl wurde bisher bei tatsächlichen 1282 × 721 und 851 × 721 CSS-Pixeln, DPR 1,75 sowie 200 Prozent UI-Textgröße mit echten Tastatureingaben geprüft. Die beiden Karten wechseln von zwei auf eine Spalte; es entstand keine äußere horizontale Überbreite. Dies ist keine neue native Windows-Skalierungsprüfung aller Stufen 100/125/150/200 Prozent. Die älteren allgemeinen Skalierungsnachweise bleiben in [DESIGNNOTIZ.md](DESIGNNOTIZ.md); eine vollständige Screenreaderabnahme wird daraus nicht abgeleitet.

Geprüfte Aufnahmen: [zweispaltige Auswahl mit 200 Prozent UI-Text](../tests/ui/screenshots/python-sprachwahl-1280-text-200.png) und [einspaltige Auswahl mit 200 Prozent UI-Text](../tests/ui/screenshots/python-sprachwahl-850-text-200.png). Die zugehörigen [breiten](../tests/ui/nachweise/python-sprachwahl-1280-text-200.json) und [schmalen](../tests/ui/nachweise/python-sprachwahl-850-text-200.json) Messdaten belegen die logische Fläche und fehlende äußere Überbreite. Die gesamte Auswahl bleibt scrollbar; Kopf und Dialogaktionen sind erreichbar.

Die Entwicklungsumgebung ist Windows 11 Pro x64, Build 26200. Praktisch vorhanden und geprüft sind CPython 3.12.6 mit Tk und eine ausschließlich für Entwicklung geladene portable CPython-3.15.2-Distribution ohne Tk. Andere freigegebene Minorversionen sind durch die Versionsgrenzen zugelassen, aber damit noch nicht praktisch geprüft. Die portable Laufzeit wird nicht mit ScriptLab ausgeliefert, nicht registriert und nicht in den PATH eingetragen.

Zwei bereits vorhandene virtuelle Umgebungen mit CPython 3.12.6 wurden tatsächlich geprüft und für denselben eigenständigen Export verwendet. Ein erster Versuch deckte den normalen Windows-venv-Redirector mit der Originalressource `py.exe` auf. Die Erkennung akzeptiert ihn jetzt ausschließlich im bestätigten eigenen `Scripts\\python.exe` mit passender `pyvenv.cfg`, geprüftem Basisinterpreter und Laufzeit-DLL; allgemeine Launcher bleiben gesperrt. Der [Exportnachweis](../tests/ui/nachweise/python-export-zusammenfassung.json) trennt den gemeinsamen 2/2-Lauf vom zusätzlich gezielten zweiten venv-Lauf. Der eigentliche Exportprozess erhielt nur `[python.exe, Export.py]`, keine Editorflags und keinen Testtoken. Die App war nachweislich geschlossen, das Arbeitsverzeichnis ein anderer eigener Ordner; Ausgabe und Ergebnisdatei mit Unicode, BOM und CRLF wurden wirklich gelesen.

Ein Windows-Kurzpfadfall reproduzierte die fehlende Fehlerzeile auf dem GitHub-Runner: CPython nennt im Traceback den langen Pfad, während die Anwendung noch den 8.3-Alias verglich. Der Testhost erhält jetzt den nach dem Schreiben aufgelösten tatsächlichen Dateipfad. Die genaue Blockzuordnung bleibt erhalten. Kurzpfad und normaler Dateifehler bestanden danach gemeinsam mit CPython 3.15.2, 2/2 gezielt geprüfte Fälle; die acht anderen Fälle dieser gezielten Auswahl wurden nicht als bestanden gezählt.

Native Eingabefenster wurden mit Unicode `Grüße aus Python 😀`, leerem OK und **Abbrechen** bedient. Die tatsächliche Ausgabe enthielt den Unicode-Text und zwei leere Rückgabewerte. Ein anschließender Stopp über die Editorwerkzeugleiste beendete die offene Python-Ja-/Nein-Rückfrage mit Zustand `abgebrochen`, Exitcode 3221225786 und ohne Erreichen späterer Blöcke. Eine eigene Nachrichtenbox wurde mit dem festen Zeitlimit von einer Sekunde beendet; tatsächlicher Zustand `zeitlimit`, gleicher Abbruch-Exitcode, kein nachfolgender Ausgabetext. Die beiden Ja-/Nein-Antworten, Nachrichtenbox-OK und die abgelehnte Löschrückfrage sind in der neuen Python-UI noch nicht vollständig interaktiv abgenommen: Der Windows-UI-Helper erkannte diese Tk-eigenen nativen Unterfenster nicht zuverlässig als auswählbares Ziel. Die Anwendung wurde dafür nicht um eine andere Dialogsemantik erweitert. Es wird kein erfolgreicher vollständiger Dialogdurchlauf behauptet. Der vorhandene VBS-Dialognachweis bleibt gesondert gültig.

Die GitHub-Windows-Prüfung stellt für ihre ausdrücklich gestarteten Tests CPython 3.15.2 x64 bereit. Der absolute Testinterpreter wird ausschließlich im Testharness übergeben und über die normale produktive Prüfung bestätigt. Die Anwendung selbst liest keinen allgemeinen Interpreter-Umgebungspfad. Ein lokaler grüner Lauf ersetzt keinen bestätigten GitHub-Lauf.

Der unabhängige [Windows-CI-Abschluss 40397781464](https://github.com/siggismalz/ScriptLab/actions/runs/40397781464) ist für den Quellstand `1a0ed2e5fd41ef38729e3acd1033f5f78eec7b38` vollständig erfolgreich: **336/336 Tests in 38,81 Sekunden, 96/96 Desktopfälle und 11/11 Paketprüfungen**, ohne Testskips. Damit sind auch die vollständigen Python-Syntax-/Semantikfälle, reale Laufzeit, eigenständiger Export, CI-venv, Kurzpfade, Speicherstatus und der letzte Tk-Bedarfsfall mit CPython 3.15.2 bestätigt. Der [bereinigte CI-Bericht](../tests/ui/nachweise/python-ci-abschluss.json) trennt diese Umgebung von den lokalen Windows-11-/CPython-3.12.6-Läufen. Der unsignierte [CI-Testinstaller mit Metadaten und Prüfbericht](https://github.com/siggismalz/ScriptLab/actions/runs/40397781464/artifacts/12687507175) ist als Actions-Artefakt bis zum 09.11.2026 vorgesehen; er ist kein dauerhaftes Release.

## Erster Windows-Testinstaller vor der Speicherstatuskorrektur

Aus dem sauberen Quellstand `b6d442c04038ae45138b55780b91f276953726c4` wurden Typprüfung, Produktionsbuild und NSIS-Bau mit `--publish never` ausgeführt. Der neue lokale Installer liegt unter `artifacts/python-build-final/ScriptLab-0.1.0-Setup-x64.exe`, **125.340.232 Bytes**, SHA-256 `d4df02c88b7ef1f707b9dd68b33bcca602b66814f26254d43e4cd60f1310a9d7`. Blockmap und `latest.yml` liegen im selben Ordner. Dies ist der neue Testbuild mit Python und VBS; die ältere Datei unter `artifacts/testlauf-build-final` enthält diese Erweiterung nicht.

Die [Paketprüfung](../tests/ui/nachweise/python-paketpruefung.json) bestand mit **11/11 Prüfungen**: Metadaten und SHA-512 des Installers, Blockmap-Struktur, bytegleicher Renderer/Hauptprozess/Preload, sechs Beispiele, fester Testhelper, Beilagen und tatsächliche Windows-Produktangaben. Installer, Anwendung und Helper sind `NotSigned`. Eine Installation/Deinstallation und der im NSIS eingebettete Payload wurden damit nicht unabhängig praktisch geprüft. Der normale Updater bleibt ohne verifizierbaren Herausgeber gesperrt. Die anschließende Renderer-Speicherstatuskorrektur ist in diesem ersten Paket noch nicht enthalten. Dieser spätere Dokumentationsnachtrag verändert das gebaute Paket nicht und ist kein veröffentlichtes Release.

### Speicherstatus bei schnellen Änderungen

Die unabhängige Windows-CI bestand mit CPython 3.15.2 bereits **335/335 Kern-/Windowsfällen in 39,48 Sekunden**, meldete jedoch zwei Desktopfehler. Der UX-Dateiexporttest wartete nur auf einen allgemeinen bereits vorhandenen Statustext; er wartet jetzt auf die tatsächliche Erfolgsmeldung vor dem Lesen der Datei. Der zweite Befund war ein echter Rendererfehler: Bei exakt 1280 × 720 CSS-Pixeln und erzwungenem Electron-DPR 1 wurde eine korrekt geschriebene Datei als ungespeichert angezeigt. Datei und Hauptprozess waren unverändert identisch und der Hauptprozess meldete `geaendert=false`.

Nach erfolgreichem Speichern liest die Oberfläche jetzt den aktuellen Blockly-Workspace und verwendet das vom Hauptprozess bestätigte Projekt als gespeicherten Bezug. Dadurch bleibt ein verzögertes Blockly-Ereignis kein falscher Ungespeichert-Vergleich. Die gezielte Gegenprüfung reproduzierte den Fehler vor der Änderung **3/3** und bestand danach **3/3**; der UX-Exportweg bestand zusätzlich **3/3**, gemeinsam 6/6 nach dem Fix. Die feste DPR-1-Bedingung bleibt im Python-Rundlauftest. Das ist eine Prozess-DPR-Prüfung und keine Änderung der Windows-Systemskalierung. Die Radiokartenaufnahmen bleiben ihrem tatsächlichen DPR 1,75 zugeordnet.

## Historischer Windows-Abschlussbuild 0.1.0

Der damalige lokale Testinstaller mit beiden Korrekturen liegt unter **`artifacts/python-build-fertig/ScriptLab-0.1.0-Setup-x64.exe`**. Er wurde aus dem sauberen Quellstand `1a0ed2e5fd41ef38729e3acd1033f5f78eec7b38` mit erneut erfolgreicher Typprüfung und Produktionsbuild erzeugt. Größe: **125.342.651 Bytes**. SHA-256: `d4c2a5485c6b87f2386420633005e8b307f9e8eb0c192e8a3d9a5cb4ba1125eb`. Blockmap und `latest.yml` liegen daneben. Dieser Nachweis belegt keinen späteren Business-Installer; dessen tatsächlicher Stand wird gesondert dokumentiert.

Die [abschließende Paketprüfung](../tests/ui/nachweise/python-paketpruefung-abschluss.json) bestand mit **11/11 Prüfungen**, einschließlich des bytegleichen neuen Hauptprozesses/Renderers, aller sechs Beispiele, des festen Helpers und der Beilagen. Der Wiederbau im vorigen Ausgabeordner war wegen einer gesperrten `app.asar` mit `EBUSY` abgebrochen; für den erfolgreichen Build wurde ein neues Verzeichnis verwendet. Es wurden weder fremde Prozesse beendet noch Prüfungen abgeschaltet. Die Zwischenstände in `python-build-final` und `python-build-abschluss` sind keine aktuellen Auslieferungen.

Der Abschlussbuild ist tatsächlich **unsigniert** und wurde mit `--publish never` erstellt. Er ist kein GitHub Release und kein Nachweis einer installierten produktiven Updatekette. Die praktische Installation/Deinstallation ist weiterhin offen. Der spätere Dokumentationscommit mit Prüfsummen und Berichten verändert den gebauten Quellstand nicht.

## Noch einzurichten oder gesondert zu prüfen

- Die vollständige praktische Versionsmatrix einschließlich CPython 3.13/3.14 und weitere Windows-Regionseinstellungen.
- Die oben konkret offenen nativen Python-Dialogentscheidungen mit Ja/Nein, Nachrichtenbox-OK und abgelehnter Löschrückfrage in einer interaktiven Windows-Sitzung.
- Eine vollständige Abnahme mit Windows-Screenreader und erneute native Skalierungsdurchläufe aller verlangten Stufen für die neue Auswahlansicht.
- Eine echte Nutzerstudie mit Personen ohne Programmierkenntnisse.
- Eine praktische Installation/Deinstallation des neuen Testinstallers in einer vorgesehenen Windows-Testumgebung.
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
