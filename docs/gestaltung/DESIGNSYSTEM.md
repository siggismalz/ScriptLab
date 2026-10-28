# ScriptLab Designsystem

## Marke und Sprache

ScriptLab ist ein sachliches Arbeitswerkzeug für Menschen ohne Programmierkenntnisse. Die Oberfläche spricht Deutsch, verwendet „Workflow“, „Entwurf“, „Vorlage“, „Datenvorschau“, „Lauf“, „Ergebnisse“ und „Export“ mit ihren fachlichen Bedeutungen. Speichern erzeugt eine bearbeitbare Projektdatei; Export erstellt ein Script oder ein Paket. Der tägliche Einstieg beginnt mit vorhandener Arbeit. Eine zusätzliche Begrüßungsfläche ist nicht vorgesehen.

Signet und Wortmarken sind bearbeitbare SVGs unter `assets/`; Windows-Icon und Größenprüfung beschreibt [MARKE.md](MARKE.md). Die Anwendung rendert das Signet direkt aus derselben SVG-Quelle. „Leon Stolz“ steht in den Produktinformationen. Kundendokumente behalten ihre eigenen Vorlagen und ihre Gestaltung.

## Farbrollen

Verbindliche Quelle ist `src/gestaltung/tokens.ts`. `farbenNachThema` erzeugt über `cssVariablenFuer` die Rollen für HTML; `scriptlabThemaFuer` verwendet dieselben Grundlagen für Blockly. Komponenten erhalten keine eigene Akzentpalette.

| Rolle                              | Dunkel  | Hell    |
| ---------------------------------- | ------- | ------- |
| Fenster                            | #172126 | #F1F4F3 |
| Navigation                         | #131D22 | #E7EDEA |
| Inhalt                             | #202D33 | #FFFFFF |
| Erhöhte Fläche                     | #2A3942 | #F8FAF9 |
| Arbeitsfläche                      | #1A252B | #E9EFED |
| Dezente Trennung                   | #3C4D56 | #D4DEDA |
| Bedienelementkontur                | #81939D | #6F827B |
| Text                               | #EEF3F4 | #182C2C |
| Sekundärtext                       | #B9C6CB | #4B6260 |
| Primäraktion und aktive Navigation | #8FC2BC | #24635D |
| Text auf Primäraktion              | #102D2A | #FFFFFF |
| Auswahlfläche                      | #2E4648 | #DFECE8 |
| Erfolg                             | #92C7A1 | #2E6545 |
| Warnung                            | #E2BD79 | #805C14 |
| Fehler                             | #E9A5A3 | #A2403F |

Dunkel ist der Erststart. Dunkel/Hell/System ist eine lokale Einstellung außerhalb der Workflowdatei. System folgt Änderungen der Farbschemameldung. Native Windows-Titelleiste und Fensterhintergrund folgen der Wahl ebenfalls. Die normale Windows-Fenstersteuerung bleibt erhalten.

Farbe trennt vier Aufgaben: Grundflächen, Markenaktion/Navigation, tatsächlicher Status und fachliche Bausteinkategorie. Auswahl besitzt zusätzlich eine Kontur beziehungsweise eine textliche Auswahlkennung. Eine grüne Kategorie bestätigt keinen erfolgreichen Lauf.

### Blockly

Die vorhandene gedämpfte Kategorienpalette und die Blockly-Verbindungen bleiben erhalten. Blockly-Blöcke besitzen in beiden Themen helle Beschriftungen auf dunklen Kategorieflächen. Dunkle Eingabeflächen, helle Feldkonturen und eine zweifarbige Auswahlkontur mit heller innerer Markierung sind eigene `--farbe-block-*`-Rollen. Diese systematische Ergänzung verhindert im hellen Thema dunkle Beschriftungen auf dunklen Blöcken. Canvasfokus und HTML-Formularfokus folgen dagegen dem jeweiligen Thema. Fehlermarkierungen erhalten die Kategoriefläche und werden durch Meldung und Warnsymbol ergänzt.

## Schrift und Maße

Schriftfamilie: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. Es werden installierte Schriften verwendet. Technische Texte: `"Cascadia Code", Consolas, "Courier New", monospace`.

| Funktion                         | Größe / Zeilenhöhe | Gewicht |
| -------------------------------- | ------------------ | ------- |
| Seitentitel                      | 24 / 32 px         | 600     |
| Workflowname in der Kontextzeile | 16 / 24 px         | 600     |
| Dialogtitel                      | 20 / 28 px         | 600     |
| Abschnitt                        | 16 / 24 px         | 600     |
| Bedienung und Listen             | 14 / 21 px         | 400     |
| Metadaten                        | 12 / 18 px         | 400     |
| Code und Protokoll               | 13 / ca. 20 px     | 400     |

Die Bedientext-Zeilenhöhe von 21 statt 20 px übernimmt die vorhandene Faktor-1,5-Konvention und schafft Platz für deutsche Beschriftungen. UI-Textgröße skaliert Texte und lässt Formulare wachsen; Canvaszoom bleibt getrennt. Numerische Tabellen verwenden gleich breite Ziffern. Normale Texte sind linksbündig, numerische Datenspalten rechtsbündig.

Abstände: 4, 8, 12, 16, 24, 32 logische Pixel. Normale Felder/Buttons sind mindestens 36 px hoch; kompakte Zeilenaktionen und häufige Symbolziele mindestens 32 px. Icons 16/20 px; Eingaberadius 6 px, Overlayradius 8 px, kompakte Einstiegskarten 4 px. Eine gemeinsame SVG-Strichsymbolfamilie liegt in `komponenten/Icon.tsx`. Normale Tabellenzeilen ergeben aus Zeilenhöhe und Innenabstand mindestens etwa 36 px. Übergänge 150 ms; reduzierte Bewegung deaktiviert sie.

## Navigation und Flächenbudget

Die Übersichten verwenden eine 184-px-Navigation: Start, Workflows und Vorlagen; Hilfe, Einstellungen und Produktinformationen am unteren Rand. Bei enger Fläche wird die Navigation umgeordnet. Start behält die vier fachlichen Einstiege und zeigt zuletzt geöffnete echte Workflows.

Die konkrete Offenlegung weiterer Informationen beschreibt [INFORMATIONSEBENEN.md](INFORMATIONSEBENEN.md).

Im Workflow ersetzt eine beschriftete Bereichsauswahl die breite Navigation. Der Projektkopf zeigt Name, Sprache und Speicherzustand; darunter liegen Dateibefehle sowie die Arbeitsbereiche Ablauf/Daten und Parameter/Läufe. Export ist ein Dialog. Der bearbeitete Workflow und sein Blockly-Workspace bleiben bei allen Ansichtswechseln dieselben.

Die Palette benötigt standardmäßig 272 px, Eigenschaften 320 px. Bei 1280 × 720 werden Eigenschaften gezielt überlagert. Anheften erfordert mindestens 1440 px Fensterbreite und ein zusätzlich geprüftes Canvasbudget von 600 px, gewichtet mit der UI-Textskalierung. Code öffnet sich nur bewusst. Daten, Ergebnisse und umfangreiche Protokolle belegen eigene Hauptansichten. „Ansicht zurücksetzen“ setzt nur persönliche Paletten-/Panelpräferenzen zurück.

## Komponenten und Zustände

- `Knopf`: Standard, leise, Primäraktion, Gefahr; Hover, gedrückt, sichtbar fokussiert, deaktiviert und beschäftigt. Wichtige Aktionen besitzen Text. Deaktivierungsgründe bleiben zugänglich.
- `Feld`, `Textfeld`, `Auswahlfeld`: dauerhafte Beschriftung, eigener Hilfetext, Fehler unmittelbar am Feld, Eingaben bleiben nach Fehlern erhalten.
- `Dialog`: nativer HTML-Dialog, sichtbarer Titel, Escape/Abbruch und Fokuswiederherstellung; keine Routineparameter in verschachtelten Dialogen.
- `Menue`: Pfeil-/Home-/End-/Escape-Bedienung und Rückkehr zum Auslöser. Bereichsmenüs liegen oberhalb der Befehlsleiste.
- `Arbeitsbereiche` und Lauftabs: ARIA-Tablist, ausgewählter Tab mit Textgewicht und Unterstreichung; Pfeiltasten, Home und End.
- Workflowliste: Suche und Sprachfilter beziehen sich auf bekannte ScriptLab-Projektdateien. Zeilenhöhe etwa 52 px; bis zu 50 Zeilen pro Seite; Filter durchsuchen vorher den gesamten Bestand. Speicherort und Dateistatus stehen in aufklappbaren Details. Auswahl, Suche, Sortierung, Seite und Scrollposition bleiben beim Rückweg erhalten.
- Datenvorschau: ausschließlich lesend; höchstens 200 geladene Zeilen/256 KiB gemäß Laufzeitlimit, je 50 sichtbare Zeilen und 20 Spalten. Spaltenbreiten, Ausschnittsuche und Ausschnittsortierung ändern keine Daten. Quelle, Lauf-ID, Standkennung und Grenzen bleiben nachvollziehbar.
- Läufe: Vorbereitung, Übersicht, Ergebnisse, Protokoll. Modus und Status bleiben sichtbar. Fertige Läufe zeigen ihre damaligen Optionen; die nächste Vorbereitung überschreibt diese Angaben nicht. Stoppen ist während des Laufs unabhängig vom Arbeitsbereich erreichbar.
- Leere Inhalte erklären den nächsten Schritt. Ladefehler sind eigene Zustände. Handlungsbedürftige Fehler bleiben sichtbar; technische Meldungen stehen zusätzlich im Protokoll.

Die Palette ordnet vorhandene Kategorien in fünf fachliche Einstiege (Python) beziehungsweise drei verfügbare Einstiege (VBS). Suche bleibt über alle verfügbaren Bausteine möglich.

Die vorhandene Einfügestellenliste bietet eine Zeigeralternative ohne Ziehen und bleibt neben Drag-and-drop und Blockly-Tastaturbedienung erhalten.

## Bewusste Grenzen

Der Hauptprozess liefert den aktuellen beziehungsweise zuletzt gestarteten Lauf. Es wurde keine historische Datenhaltung erfunden. Ein fremder Workflow erhält keine Ergebnisse des zuvor geöffneten Workflows als eigene Läufe. Exportformate und Signaturunterstützung bleiben wie implementiert: VBS-Script optional signierbar, Business-Paket ohne vorgetäuschte ZIP-Signatur. Dokumentvorlagen werden über die vorhandene unabhängige Beispielkopie einschließlich Ressourcen verwendet.

Die vollständige Abnahme und ihre Grenzen stehen in [PRUEFUNG.md](PRUEFUNG.md). Kontrastprüfungen und eigene Sichtprüfung sind keine vollständige Barrierefreiheitszertifizierung oder Nutzertests.

## Offizielle Grundlagen

[Windows-Typografie](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography), [Windows-Schriftrechte](https://learn.microsoft.com/en-us/typography/fonts/font-faq), [Befehlsleisten](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/command-bar), [Dialoge](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/dialogs), [WCAG-Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [nichttextueller Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Ziehen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [Umbruch](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Electron-Bildschirme](https://www.electronjs.org/docs/latest/api/screen).
