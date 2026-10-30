# Erreichbare globale Navigation und klarer Workflowkontext

## Auftrag und Befund

Der Nutzer wünscht ausdrücklich eine strukturelle Orientierung an Power Automate und n8n. Der Auftrag betrifft vorhandene Navigation und Arbeitsbereiche. ScriptLab bleibt der echte Blockly-Editor; keine neue Ausführungsart, Module, Cloud, Bibliothek oder Übernahme fremder Markenoberflächen.

**UX-STR-01 (P2):** Im bisherigen Editor sind Start, Workflows, Vorlagen, Hilfe und Einstellungen ausschließlich hinter „Bereiche“ erreichbar. Der globale Kontext konkurriert dadurch im selben Workflowkopf mit Name und Projektaktionen; die an der Startseite sichtbare Navigation verschwindet. Reproduktion am vorhandenen JSX: Workflow öffnen und ohne Kenntnis des Bereichemenüs zur Bibliothek oder Hilfe wechseln. Erwartet sind erkennbare globale Ziele, darunter der aktuelle Workflow und seine vorhandenen Arbeitsbereiche. Abnahme: häufige Ziele sind bei 1280 × 720 direkt beschriftet erreichbar; große Schrift nutzt bei Platzmangel den weiterhin sichtbaren Menüweg. Navigation erhält Workflowidentität, ungespeicherten Inhalt, Auswahl und Zoom; Start/Stop-Verträge bleiben erhalten.

## Quellen und konkrete Ableitung

Am 30.10.2026 wurden ausschließlich offizielle Inhalte gelesen:

- [Microsoft: Power Automate desktop flow designer](https://learn.microsoft.com/en-us/power-automate/desktop-flows/flow-designer) trennt Aktionsbereich, Variablenbereich und Arbeitsfläche und ordnet Werkzeuge dem bearbeiteten Ablauf zu. Ableitung für ScriptLab: Canvas bleibt Hauptfläche; Palette und kontextbezogene Eigenschaften bleiben vorhandene Arbeitsmittel, keine zusätzliche große linke Navigationsspalte.
- Der vorgegebene [n8n-Kurseinstieg](https://docs.n8n.io/courses/level-one/chapter-1/) leitet aktuell zur offiziellen Academy weiter. Ergänzend gelesen: [Workflow components](https://docs.n8n.io/build/understand-workflows/workflow-components.md) beschreibt verbundene Komponenten auf dem Canvas; [View executions for a single workflow](https://docs.n8n.io/build/understand-workflows/understand-executions/view-executions-for-a-single-workflow.md) ordnet Ausführungen dem geöffneten Workflow in einem eigenen oberen Tab zu. Ableitung: „Ablauf“, „Daten und Parameter“ und „Läufe“ bleiben vorhandene Workflowebene unter der Projektidentität. Keine neuen n8n-Funktionen oder Begriffe werden übernommen.

## Umsetzung und Besitz

Eine kompakte globale Kopfleiste zeigt ScriptLab sowie Start, Workflows, Vorlagen, Hilfe und Einstellungen. „Workflows“ kennzeichnet den aktuellen Produktbereich. Das bestehende „Bereiche“-Menü bleibt als Sekundärweg einschließlich „Über ScriptLab“ erhalten. Bei großer Schrift beziehungsweise engem Fenster liegen Hilfe/Einstellungen im weiterhin erreichbaren Menü; die häufigen Einstiege bleiben direkt beschriftet. Darunter steht der Workflowkopf mit Name, persistentem Speicherstatus, Sprache und bestehenden Hauptaktionen. Die vorhandenen Arbeitsbereiche und ihre Werkzeuge bilden die nächste Ebene. Keine neue linke Leiste verengt Palette und Canvas.

Schreibbereich des Produkt-/Frontendagenten: neue `EditorNavigation.tsx`/`editor-navigation.css`, ausschließlich Editor-Kopf-JSX und Import in `Anwendung.tsx`, eine benötigte Kopfflächenregel in `produkt.css`, eigener gezielter Desktoptest und dieser Bericht. Zustände, IPC, Lauf-/Ladefunktionen und zentrale Tokens liegen beim Hauptagenten. Dieselben bestehenden Callbackfunktionen behandeln globale Wechsel; hier entsteht keine zusätzliche Lauf- oder Speicherlogik.

## Prüfstand

Der Hauptagent stellte den integrierten strukturellen Build nach bestandener Typprüfung bereit. Ein unabhängiger Fachagent las den isolierten JSX-/CSS-/Testschnitt: kein konkreter Vertragsbruch gefunden, globale Ziele behalten die vorhandenen Guards und Workflowaktionen. Dieser Review hat selbst keine UI und keine Tests gestartet.

Eigenständig ausgeführt, Windows x64 mit Node 24.19.0, Electron 45 und isolierten vollständigen Einstellungsprofilen:

`npx playwright test tests/desktop/editorstruktur.spec.ts --reporter=list --output=artifacts/editorstruktur/tests-final`

**4 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Vier Kombinationen aus hell/dunkel und 100/200 % Text bei 1280 × 720 logischen Pixeln. Der Test prüft die tatsächlichen 14/28px und `light`/`dark`, damit falsche oder verworfene Einstellungen nicht als Themeprüfung gelten. Die erste Ausführung hatte 2 bestandene und 2 fehlgeschlagene Fälle: Der neue Test nahm für den Hilfe-H1 fälschlich den Knopfnamen „Hilfe“ an. Fehlerkontext und Quelle zeigten den bestehenden Titel „Dokumentation und Anleitungen“. Nur diese präzise Erwartung wurde korrigiert; kein Produktverhalten, keine Assertion oder Frist wurde dafür entfernt.

Die finale Abnahme prüft direkte globale Ziele, den vorhandenen sekundären Menüweg bei 200 %, Tastaturreihenfolge, Workflowkopf und sichtbare Hauptaktionen, einen langen deutschen Projektnamen mit vollständigem `title`, aktuelle Sprache und Speicherstatus. Ungespeicherter Kommentarinhalt, Workflowkennung, Bausteinauswahl und Canvasansicht bleiben über Bibliothek/Vorlagen/Hilfe und „Weiterbearbeiten“ erhalten. Einstellungen und die drei Arbeitsbereiche lösen keinen Lauf aus. Jeder Fall startet anschließend ausdrücklich einen synthetischen Python-Warteablauf; ein interner Ansichtswechsel behält die Laufkennung, „Stoppen“ ist im Fenster erreichbar, Speichern gesperrt und der reale Endzustand wird als `abgebrochen` bestätigt. Die externe Workflowquelle bleibt bytegleich.

Der tatsächlich gemessene Canvasbereich beträgt in beiden Themen **1004 × 490** bei 100 % und **1004 × 401** bei 200 %. Die Messdaten liegen unter `artifacts/editorstruktur/flaeche-*.json`. Das ist ein Nachweis der verbleibenden Fläche dieses Layouts, kein Vorher-/Nachher- oder Leistungsnachweis. Die vier `editor-*.png` sowie beide `lauf-*-200.png` wurden tatsächlich angesehen: globale Ebene, Workflowkopf und Arbeitsbereiche sind getrennt, Hauptaktionen/Stoppen sind lesbar, keine zusätzliche linke Leiste verengt den Canvas. Andere Fenster- und Skalierungsgrößen, Screenreader und Windows-Kontrastmodus wurden in diesem gezielten Paket nicht neu praktisch geprüft.

Prettier der gelieferten Produkt-, Test- und Berichtdateien **bestanden**. Die vorbestehenden CI-Probleme der Startseitentests sind getrennt in `CI-VORLAGEN.md` dokumentiert; die intermittierende 1000er-Ladegrenze bleibt beim Hauptagenten und wird durch vier kleine Strukturtests nicht als gelöst ausgegeben. Vollständige Integration, Gesamtregression, CI und Veröffentlichung bleiben beim Hauptagenten. Keine eigenen Git-/Buildaktionen und keine Anwenderstudie.
