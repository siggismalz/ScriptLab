# Workflows bewusst testen

Stand: 26.10.2026. Der Erweiterungsauftrag erlaubt ausdrücklich gestartete Testläufe des vollständigen aktuellen Workflows. Das ersetzt die frühere globale Vorgabe gegen jede Ausführung innerhalb von ScriptLab. Bearbeiten, Öffnen, Wiederherstellen, Strukturprüfung, Vorschau, Speichern, Export und Signaturprüfung starten weiterhin keinen Workflow. Es gibt keine automatische Ausführung, Zeitplanung oder Autostartfunktion.

Die lokalen praktischen Prüfungen fanden unter Windows 11 Pro x64, Build 26200, mit Node.js 24.19.0 und Electron 45.0.0 statt.

**Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen.** Er läuft mit den Rechten der Anwendung, ohne Sandbox. **Stoppen macht bereits vorgenommene Änderungen nicht rückgängig.** Der gewählte Basisordner ist keine Grenze für Dateizugriffe: Absolute Laufwerks- und UNC-Pfade können außerhalb dieses Ordners wirken.

## Vorbereitung und Start

1. Erstelle oder öffne einen Workflow. Zum ersten Kennenlernen eignet sich **Text ausgeben** mit einem kurzen Text. Ein Beispiel wird beim Öffnen als Kopie angelegt und startet dabei nicht.
2. Öffne **Testausgabe**. Das öffnet nur das Panel. Prüfe dort den Hinweis auf die tatsächliche Ausführung.
3. Wähle mit **Ordner auswählen** einen vorhandenen Basisordner über den Windows-Dialog. Relative Dateipfade des Tests werden auf diesen Ordner bezogen. Der vollständige Pfad bleibt im Panel sichtbar und kopierbar. Für erste Dateiaktionen eignen sich ausschließlich eigene entbehrliche Testdateien.
4. Prüfe **Zeitlimit in Sekunden**. Der Standard beträgt 120 Sekunden; erlaubt sind ganze Zahlen von 1 bis 3600. Während eines Tests bleiben seine Pfadbasis und sein Zeitlimit unverändert.
5. Wähle bewusst **Testen** oder **Workflow testen**. ScriptLab prüft zuerst Struktur und Pflichtwerte. Fehler führen zum betroffenen Baustein und verhindern den Start. Ein gültiger Test verwendet immer den vollständigen aktuellen Hauptablauf, nicht nur die Auswahl.

Sind Basisordner und Zeitlimit für den aktuellen Kontext noch nicht angezeigt worden, öffnet der erste Startwunsch zunächst das Panel und führt noch nichts aus. Prüfe die Angaben und starte danach mit einem weiteren bewussten Klick. Das bewusste Öffnen von **Testausgabe**, die Ordnerwahl oder das Ändern der Testoptionen zeigen den Kontext bereits an; anschließend startet **Testen** direkt. Ein fehlender Basisordner muss zuerst gewählt werden. Das Speichern desselben Workflows erhält den Kontext. Es gibt keinen zusätzlichen Bestätigungsdialog vor jedem Lauf.

Es läuft höchstens ein Test gleichzeitig. Während Vorbereitung, Ausführung und Stoppen sind inhaltliche Workflowänderungen gesperrt. Auswahl und Ansicht bleiben getrennt vom ausgeführten Stand. Testen speichert weder die `.scriptlab`-Projektdatei noch eine exportierte `.vbs`-Datei. Speicherstatus und Testergebnis sind unabhängig.

## Ausgabe und Windows-Dialoge

| Baustein                  | Verhalten während eines Tests                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Text ausgeben             | Text und Zeilenende erscheinen im Ausgabebereich.                                                                  |
| Nachricht anzeigen        | Ein nativer Windows-Dialog mit OK erscheint. Er ist keine Zeile im Ausgabebereich.                                 |
| Texteingabe abfragen      | Ein nativer Eingabedialog wartet auf deine Antwort. Abbrechen und leerer Text liefern beide leeren Text.           |
| Ja-/Nein-Frage            | Ein nativer Dialog liefert die getroffene Auswahl.                                                                 |
| Datei löschen (erweitert) | Mit der Standardeinstellung erscheint vor dem tatsächlichen Löschen die native Rückfrage mit vorausgewähltem Nein. |

Windows-Dialoge gehören zum gestarteten Script und erscheinen außerhalb des React-Panels. Ein wartender Dialog ist kein fehlender Ausgabefortschritt. **Stoppen** und das Zeitlimit müssen den Test auch während eines solchen Dialogs beenden. Die Hostkonfiguration lässt Dialoge ausdrücklich zu; sie verwendet keinen stillen Batchmodus.

Der Ausgabebereich stellt Text dar, kein HTML oder ausführbare Links. Er folgt neuen Zeilen nur, solange du am unteren Ende bist. Nach manuellem Hochscrollen führt **Zum Ausgabeende** zurück. **Ausgabe kopieren** kopiert den sichtbaren Ausgabetext. **Ausgabe leeren** entfernt auch während eines laufenden Tests ausschließlich die bisher erfasste Ausgabe; neue Ausgaben können anschließend wieder erscheinen. Der Knopf stoppt keinen Prozess, startet keinen weiteren Test und löscht keine Workflowdateien. Ist die Ausgabe begrenzt worden, wird die Zahl nicht mehr angezeigter Zeichen genannt. Eine gekürzte Anzeige ist kein vollständiges Protokoll.

## Ergebnis, Stand und Fehler

Das Panel unterscheidet **Bereit**, **Test wird vorbereitet**, **Test läuft**, **Test wird gestoppt**, **Test beendet**, **Test fehlgeschlagen**, **Test abgebrochen** und **Zeitlimit erreicht**. Es zeigt den tatsächlichen Projektkontext des Laufs, Lauf-ID, SHA-256-Standkennung, Startzeit, Laufzeit, verwendeten Basisordner, Zeitlimit und vorhandenen Exitcode. Vorhandene Zeiten und Ergebnisse werden nicht durch erfundene Fortschrittswerte ersetzt.

**Test beendet** mit Exitcode 0 bedeutet, dass der Prozess ohne gemeldeten Fehler beendet wurde. Prüfe die gewünschten Datei- oder anderen Ergebnisse trotzdem selbst. Es bedeutet weder „ungefährlich“ noch „Projekt gespeichert“. Nach einer späteren Workflowänderung gehört das alte Ergebnis weiterhin zu seinem früheren Stand; ein Hinweis kennzeichnet dies. Ein neuer Test erzeugt eine neue Lauf-ID und übernimmt wieder den vollständigen aktuellen Workflow.

Bei einem zugeordneten Fehler führt **Baustein anzeigen** zum Baustein. Unter **Laufdetails und Technik** stehen Projektkontext, Zeiten, Lauf- und Standkennung sowie vorhandene technische Meldungen, der schreibgeschützte Quelltext genau dieses Tests und seine Zeilen-/Blockzuordnung. Fehlt eine sichere Zuordnung, wird keine Blockkennung erfunden. Die Details dienen der Fehlersuche und sind keine frei bearbeitbare Ausführungsschnittstelle.

Das Panel heißt **Testausgabe**. Status und Ausgabe stehen vor den eingeklappten Laufdetails. **Test vorbereiten** enthält die Optionen und ist vor dem ersten Lauf geöffnet; während eines Laufs sind die verwendeten Optionen dort unter **Optionen dieses Tests** abrufbar. Das Ein- oder Ausklappen dieser Bereiche startet und stoppt keinen Test.

## Stoppen, Wechseln und Beenden

**Stoppen** fordert das Beenden an. Während **Test wird gestoppt** bleibt ein weiterer Start gesperrt. Erst der bestätigte Prozessabschluss gibt den nächsten Test frei. Bereits geschriebene, verschobene oder gelöschte Dateien bleiben verändert; Rückgängig im Editor kann sie nicht wiederherstellen.

Vor einem Wechsel zur Startseite, einem anderen Projekt, dem Schließen oder einem Update-Neustart wird bei aktivem Test gefragt, ob er gestoppt werden soll. **Im Editor bleiben** bricht den Wechsel ab. **Test stoppen und fortfahren** wartet auf das Ende. Danach gelten zusätzlich die üblichen Entscheidungen für ungespeicherte Projektänderungen und lokale Entwürfe. Das Schließen des Testpanels allein ist kein Stoppen.

## Windows und technische Trennung

Testdateien werden in dieser Version nicht signiert. Wenn eine Unternehmensrichtlinie ausschließlich passend signierte Scripts zulässt, ist die Testfunktion dort nicht verfügbar. Die bestehende Signaturfunktion für eigene Exporte bleibt nutzbar; ScriptLab umgeht keine Richtlinie und verwendet keinen mitgelieferten privaten Entwicklerschlüssel.

Ziel ist Windows 11 x64. Für Tests werden der mitgelieferte feste Laufzeithelper, Windows Script Host und die verfügbare VBScript-Komponente benötigt. Windows- oder Unternehmensrichtlinien können die Ausführung verhindern. ScriptLab prüft die Laufzeit beim ersten Test mit einer festen technischen Probe, aktiviert aber keine Features und ändert keine Richtlinien. Ohne Laufzeit bleiben Bearbeiten, Speichern und unsignierter Export möglich. Microsoft hat [VBScript abgekündigt](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features).

Der Hauptprozess erzeugt aus einem geprüften Projektsnapshot eine technische VBS-Testfassung. Sie verwendet UTF-16LE mit BOM und CRLF, einen getrennten Testkontext und eine Zeilenkarte. Relative Pfade verwenden den ausdrücklich übergebenen Basisordner. Der normale Export bleibt davon getrennt: Dort beziehen sich relative Pfade auf den Speicherort der exportierten VBS-Datei; gleicher Workflow und gleiche Exportoptionen liefern weiterhin denselben unsignierten Exportquelltext.

Der feste Helper startet ausschließlich den festgelegten Windows-Host mit getrennten Argumenten und umgeleiteter Unicodeausgabe. Seine Startbestätigung wird vollständig geschrieben, bevor die Ausgabepumpen beginnen. Der Laufzeit-Watchdog startet erst ab dieser Bestätigung; die davor liegende Windows-/CLR-Vorbereitung zählt nicht als Workflowlaufzeit. Ein Zeitlimit wird erst nach bestätigtem Job- und Pipe-Ende als beendet gemeldet. Die Oberfläche erhält keine freie Shell-, Programm-, Argument- oder Quelltextschnittstelle. [Microsoft dokumentiert `cscript`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cscript) einschließlich interaktiver Dialoge und Unicodeausgabe. Ein [Windows-Jobobjekt](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) und eine Kontrollpipe begrenzen die Prozesslebensdauer; sie machen Dateiaktionen nicht rückgängig und ersetzen keine Sandbox.

Der Windows-Build kompiliert `scripts/laufzeit-host.cs` mit dem C#-Compiler des vorhandenen Windows-.NET-Frameworks 4. Das Buildskript verwendet ausschließlich feste Windows-Compilerpfade. Der fertige Installer enthält `ScriptLab.Testhost.exe` als feste Ressource; beim Endnutzer wird nichts kompiliert. Der Helper benötigt seine Windows-.NET-Framework-Laufzeit. Fehlen Buildvoraussetzungen, werden keine Komponenten automatisch installiert.

Technische Dateien liegen getrennt unter `%APPDATA%\ScriptLab\testlaeufe\<Lauf-ID>`. Nach Prozessende werden ausschließlich die fest benannten eigenen Dateien und anschließend der leere Laufordner asynchron bereinigt. Bei einem Absturz können technische Reste zurückbleiben. Diese Bereinigung löscht weder den Basisordner noch Ergebnisse oder andere Nutzerdaten; sie ist kein Rollback.

**Text ausgeben** verwendet eine Generatorhilfe: Unter `cscript.exe` schreibt sie über `WScript.StdOut.WriteLine`; nur unter dem Fensterhost verwendet sie `WScript.Echo`. So erscheint beim eigenständigen Export Konsolentext unter `cscript.exe` und eine Windows-Nachricht unter `wscript.exe`. **Nachricht anzeigen** bleibt in beiden Fällen ein Dialog. Tests und VBS-Export teilen denselben Generator; der Testkontext ändert nicht stillschweigend die Blockbedeutung.

## Prüfstand und noch offene Nachweise

Die früheren 72 Desktopfälle, 159 Kern-/Komponententests, Bildschirmaufnahmen und Paketberichte in [ABNAHME.md](ABNAHME.md) und [STARTSEITE.md](STARTSEITE.md) gehören zum Stand vor Einführung der Testfunktion. Sie werden nicht als Nachweis eines erfolgreichen Testlaufs umgedeutet.

Der gemeinsame lokale Windows-Lauf bestand mit **191/191 Unit-, Kern-, Datei-, Generator-, Dienst-, nativen Prozess- und Paneltests**. Die tatsächlichen Laufzeitprüfungen waren dabei mit `SCRIPTLAB_RUNTIME_TESTS=1` aktiviert; der Lauf verwendete einen Worker und dauerte 25,94 Sekunden. Der [archivierte Kurzbericht](../tests/ui/nachweise/testlauf-unit-zusammenfassung.json) enthält Zählwerte, Laufzeit und SHA-256 des tatsächlichen Rohberichts. Die zehn nativen Prozessbindungstests und sieben Testdienstfälle sind in den 191 bereits enthalten und werden nicht zusätzlich gezählt. Auch frühere gezielte 43er- beziehungsweise 50er-Komponentenläufe sind keine zusätzlichen unterschiedlichen Fälle. Die acht Paneltests prüfen unter anderem Textdarstellung, sichtbare Zustände, Zeitlimitgrenzen, Laufzeitformatierung und die Entscheidung zum automatischen Ausgabescrollen; allein beweisen sie keine Dateiwirkung oder native Dialogbedienung.

Der vollständige lokale Electron-Lauf bestand separat mit **86/86 Desktopfällen in 170,46 Sekunden**, ohne übersprungene, instabile oder unerwartet fehlgeschlagene Fälle. Der [Desktop-Kurzbericht](../tests/ui/nachweise/testlauf-desktop-zusammenfassung.json) ist aus dem echten Playwright-Bericht abgeleitet. Danach bestand ein neu ergänzter Ausgabescroll-/Kopierfall einzeln mit **1/1 in 7,3 Sekunden**. Damit liegen 87 unterschiedliche Desktopfälle vor, aber kein behaupteter gemeinsamer lokaler 87er-Lauf.

Der zusätzliche Fall erzeugte 50 Ausgabezeilen, scrollte mit dem Mausrad nach oben und kopierte während des aktiven Tests über die echte Hauptprozess-Zwischenablage. Eine spätere Ausgabe nach vier Sekunden änderte die Scrollposition 0 nicht. **Zum Ausgabeende** führte nach unten; anschließend stoppte der Test, ohne die danach geplante Ausgabe auszuführen. Die zusätzlichen Einzelfallzahlen werden nicht zum bereits abgeschlossenen 86er-Gesamtbericht umgeschrieben.

| Paket                                 | Tatsächlicher Nachweis                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/prozessbindung.test.ts`, 10/10 | Reale Unicode-Pipes und Argumente, normales Ende, gültiger Exitcode 259, vollständige Startbestätigung vor einer langen sofortigen Fehlerausgabe, Stoppen, geschlossene Lebensleitung, Zeitlimit, gezieltes Helperende und Ablehnung einer ungültigen Kennung.                                                                                                                                                                                                         |
| `tests/testlauf-dienst.test.ts`, 7/7  | Reales Schreiben/Lesen im gewählten isolierten Basisordner mit technischer Bereinigung, Unicode einschließlich U+FEFF und Markertext als Daten, große begrenzte Ausgabe, zugeordneter Fehler, Abbruch während der Vorbereitung, laufender Stopp mit folgendem Lauf und Zeitlimit.                                                                                                                                                                                      |
| Native interaktive Windows-Prüfung    | Die Texteingabe übernahm `Prüftext ä 😀`; **Nein** lieferte die Ausgabe `ANTWORT NEIN`; eine echte Nachrichtenbox wurde mit **OK** geschlossen. Danach folgten `NATIV ENDE` und der tatsächliche Exitcode 0. Das lokale Ergebnisprotokoll liegt unter `artifacts/testlauf/native-dialoge.json`.                                                                                                                                                                        |
| Native Ja-Auswahl                     | **Ja** lieferte `ANTWORT JA`, anschließend `NATIV ENDE` und Exitcode 0 (`native-dialoge-ja.json`).                                                                                                                                                                                                                                                                                                                                                                     |
| Native Texteingabe abbrechen/leer     | **Abbrechen** und die Bestätigung einer leeren Eingabe lieferten jeweils `EINGABE=` und `NATIV ENDE`, Exitcode 0 (`native-dialoge-abbrechen.json`, `native-dialoge-leer.json`).                                                                                                                                                                                                                                                                                        |
| Native Löschrückfrage                 | **Nein** beendete den Ablauf mit Exitcode 0 und ließ die Testdatei tatsächlich erhalten (`dateiErhalten=true` in `native-dialoge-loeschen-nein.json`).                                                                                                                                                                                                                                                                                                                 |
| Native Stoppbedienung                 | Während einer echten Nachrichtenbox wurde **Stoppen** in der ScriptLab-Werkzeugleiste betätigt. Der Lauf endete als `abgebrochen`, die Ausgabe blieb bei `VOR DIALOGSTOPP`, der tatsächliche Exitcode war 3221225786 und der Dialog verschwand ([Nachweis](../tests/ui/nachweise/testlauf-native-dialoge-stopp.json)). Der Stopp wurde nach der abschließenden Hosthärtung mit dem neuen Helper erneut nativ bestätigt; danach blieb kein eigenes Scriptfenster offen. |
| Gezielte Desktop-Schutzfälle          | Startseiten-, Entwurfs- und Schließentscheidungen warteten auf den tatsächlichen Stopp. Das gezielte harte Beenden ausschließlich des eigenen Electron-Hauptprozesses ließ auch den zuvor erfassten eigenen `cscript`-Prozess nicht zurück. Dialogantworten waren für die automatisierten Wechselentscheidungen vorgegeben; Prozessende und Arbeitsstand wurden tatsächlich geprüft.                                                                                   |

Die sechs nativen Einzelbelege sind unter `tests/ui/nachweise/testlauf-native-dialoge*.json` archiviert; die Rohdateien liegen lokal unter `artifacts/testlauf/`. Zwei erste Automationsversuche an nativen Popups endeten zunächst im Timeout. Die betreffenden Bedienfolgen wurden anschließend einzeln erfolgreich wiederholt. Diese Wiederholungen bestätigen die beschriebenen konkreten Ergebnisse, keine durchgehend fehlerfreie erste Automationsserie. Eine vollständige Sprachausgabeprüfung ist damit nicht nachgewiesen.

## Darstellung und Bedienung des Testpanels

Zwei gezielte Darstellungsfälle mit echter Testausgabe bestanden bei angeforderten **1280 × 720 CSS-Pixeln**, UI-Textgröße **100 und 200 Prozent** und jeweils **280 CSS-Pixeln Panelhöhe**. Beide tatsächlich gemessenen Renderer waren **1282 × 721 CSS-Pixel** groß und hatten `devicePixelRatio` **1,75**. Die Abweichung durch die native Fensterberechnung wird nicht auf die angeforderten Maße gerundet. Die vorhandene Windows-Skalierung wurde für diese Fälle nicht geändert; UI-Textgröße und Canvas-Zoom sind getrennt.

| UI-Textgröße | Tatsächliche Canvas-Höhe | Panelhöhe     | Archivierter Nachweis                                                                                                                        |
| ------------ | ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 Prozent  | 356,00 CSS-Pixel         | 280 CSS-Pixel | [JSON](../tests/ui/nachweise/testlauf-testausgabe-1280-text-100.json), [PNG](../tests/ui/screenshots/testlauf-testausgabe-1280-text-100.png) |
| 200 Prozent  | 258,57 CSS-Pixel         | 280 CSS-Pixel | [JSON](../tests/ui/nachweise/testlauf-testausgabe-1280-text-200.json), [PNG](../tests/ui/screenshots/testlauf-testausgabe-1280-text-200.png) |

Beide Canvas-Höhen lagen über der geforderten Grenze von 120 CSS-Pixeln. Die Hauptaktionen **Testen** und **Als VBS exportieren** blieben im Fenster lesbar und erreichbar; das Dokument hatte keine äußere Überbreite. Die Panelhöhe ließ sich über den fokussierten Trenner mit den Pfeiltasten um 24 Pixel ändern und zurücksetzen. Der interne Panelbildlauf und das Sichtbarmachen der vollständigen Ausgabe wurden praktisch geprüft. Die archivierten Ansichten zeigen den Zustand nach internem Scrollen: `scrollTop` betrug 86,86 beziehungsweise 352,57 CSS-Pixel. Sie belegen die erreichbare Ausgabe, nicht einen unverändert sichtbaren Warnhinweis oder eine vollständig sichtbare Ausgabe bei Scrollposition 0. Die Warnung und der echte Status bleiben im oberen Teil desselben scrollbaren Panels erreichbar.

Die Bildschirmaufnahmen wurden ergänzend visuell geprüft: Ausgabetext, Panelüberschrift, Laufdetails und die Hauptaktionen sind in den jeweiligen dargestellten Zuständen lesbar. Daraus folgt keine vollständige Prüfung aller Windows-DPI-Stufen, Kontrastmodi oder Screenreader.

## Verbleibende Grenzen und Beobachtungen

Die automatisierten Editorfälle bestätigen den aktuellen ungespeicherten Stand, sichtbare Testbasis und davon getrennten Export, echte Dateiergebnisse, Fehlernavigation, Schutz vor Doppelstarts, Zeitlimit und Stoppen, Leeren während des Laufs sowie den Schutz bei Startseite, Entwurf, Schließen und unerwartetem Hauptprozessende. Die bestehenden Fälle gegen automatische Ausführung beim Öffnen, Wiederherstellen, Vorschauen und Exportieren bleiben Bestandteil des vollständigen Desktoplaufs.

Eine tatsächlich deinstallierte VBScript-Komponente oder eine blockierende Unternehmensrichtlinie wurde auf diesem Rechner nicht nachgestellt. Es wurden dafür keine Windows-Komponenten oder Richtlinien verändert. Die Meldung für eine gescheiterte feste Laufzeitprobe ist implementiert; ein eigener Zielrechner mit dieser Voraussetzung bleibt für deren praktische Abnahme erforderlich.

Ein neuer NSIS-Installer wurde anschließend aus dem sauberen Stand `681d48a08f1d0328c9cfd8f4fdfe406580c4c450` gebaut. `artifacts/testlauf-build-final/ScriptLab-0.1.0-Setup-x64.exe` hat 125.108.090 Bytes; Blockmap und `latest.yml` liegen daneben. Die lesende Paketprüfung bestand mit **11/11 Prüfungen**. Sie bestätigt unter anderem den bytegleichen festen Testhost und seine Windows-Produktmetadaten. Der [Paketbericht](../tests/ui/nachweise/testlauf-paketpruefung.json) dokumentiert Quellstand, Hashes und praktische Grenzen; dieser spätere Dokumentationsnachtrag ist nicht Bestandteil jenes Pakets.

Die tatsächliche Installation und Deinstallation sowie eine produktive signierte Updatekette bleiben offen. Installer, Anwendung und Testhost sind in diesem lokalen Build unsigniert. Die vollständige Sprachausgabeprüfung, zusätzliche native DPI-Stufen für das Testpanel und ein unabhängiger Verständlichkeitstest sind durch die beschriebenen Fälle nicht abgedeckt.

Bei parallel laufenden lokalen Proben wurde sporadisch eine verzögerte UTF-8-Dateischreibung beobachtet. Die Ursache ist nicht geklärt; es wird keine Erklärung aus Vermutungen abgeleitet. Die strenge Prüffrist von zehn Sekunden bleibt unverändert. Ein überschrittenes Zeitlimit ist ein fehlgeschlagener Prüfversuch und wird nicht als Erfolg gewertet. Die Beobachtung bleibt bis zur reproduzierbaren Klärung offen.

Für Laufzeitprüfungen gelten ausschließlich neu angelegte temporäre Testverzeichnisse mit entbehrlichen Dateien. Ergebnisdateien, tatsächliche Zustände und Prozessabschluss müssen unabhängig geprüft werden. Gesteuerte UI-Zustände oder ein erfolgreicher Parserlauf zählen nicht als Laufzeitnachweis.

Die Diensttests sind zusätzlich über `SCRIPTLAB_RUNTIME_TESTS=1` freizugeben; sie führen echte Testworkflows in ihren eigenen temporären Verzeichnissen aus. Die nativen Prozessbindungstests benötigen dieses Flag nicht und laufen unter Windows x64 mit. Zum gezielten Windows-Lauf wird zuerst der feste Helper gebaut:

```powershell
node scripts/laufzeit-host-bauen.mjs
$env:SCRIPTLAB_RUNTIME_TESTS = '1'
npx vitest run tests/prozessbindung.test.ts tests/testlauf-dienst.test.ts --maxWorkers=1
```

Die normale Vitest-Konfiguration verwendet ebenfalls einen Worker. Das Prozessflag ist eine Entwicklungs-/CI-Option, keine Anwendereinstellung oder Startbedingung der normalen Testfunktion. Nach der gezielten Prüfung die vorherige Umgebungsvariable wiederherstellen beziehungsweise eine zuvor nicht gesetzte Variable aus der Testshell entfernen. Ein übersprungener Diensttest ist kein erfolgreicher Laufzeitnachweis.

## Nachweise erneut archivieren

Nach bestandenem Prüflauf und Sichtprüfung übernimmt der feste Archivierer sechs native JSON-Protokolle, zwei UI-Messdateien und zwei ausgewählte PNG-Aufnahmen. Mit `--mit-berichten` erstellt er zusätzlich die kompakten Zusammenfassungen aus den tatsächlich vorhandenen Vitest-/Playwright-Rohberichten. Er validiert alle Quellen vor dem ersten Zielschreiben, ersetzt in UI-Messdateien passende temporäre Benutzerpfade durch `%TEMP%\ScriptLab-Testausgabe-UI-<Testkennung>` und verweigert nicht erkannte absolute Pfade in JSON. Ganze Stacklogs oder Projektinhalte werden nicht in die Kurzberichte übernommen. Die PNGs bleiben visuell geprüfte Originalaufnahmen, keine automatisch geschwärzten Bilder.

```powershell
node tests/ui/testlauf-nachweise-archivieren.mjs --mit-berichten
```

Der dokumentierte Archivlauf erzeugte **zwei PNGs und zehn JSON-Nachweise**. Das Kopieren und Zusammenfassen startet keine Tests oder Workflows. Die Rohberichte bleiben lokal; ihre Hashes im Kurzbericht erlauben die Zuordnung zum tatsächlichen Lauf.
