# ScriptLab Designsystem

## Marke und Sprache

ScriptLab ist ein sachliches Arbeitswerkzeug für Menschen ohne Programmierkenntnisse. Die Oberfläche spricht Deutsch, verwendet „Workflow“, „Entwurf“, „Vorlage“, „Datenvorschau“, „Lauf“, „Ergebnisse“ und „Export“ mit ihren fachlichen Bedeutungen. Speichern sichert den bearbeitbaren Workflow intern; Export erstellt eine weiterzugebende Projektkopie, ein Script oder ein Paket. Der tägliche Einstieg beginnt mit vorhandener Arbeit. Eine zusätzliche Begrüßungsfläche ist nicht vorgesehen.

Signet und Wortmarken sind bearbeitbare SVGs unter `assets/`; Windows-Icon und Größenprüfung beschreibt [MARKE.md](MARKE.md). Die Anwendung rendert das Signet direkt aus derselben SVG-Quelle. „Leon Stolz“ steht in den Produktinformationen. Kundendokumente behalten ihre eigenen Vorlagen und ihre Gestaltung.

## Farbrollen

Verbindliche Quelle ist `src/gestaltung/tokens.ts`. Die Office-Farbwelt verbindet leicht blaue Neutralflächen mit einer blauen Markenaktion. `farbenNachThema` erzeugt über `cssVariablenFuer` die Rollen für HTML; `scriptlabThemaFuer` verwendet dieselben Grundlagen für Blockly. Komponenten erhalten keine eigene Akzentpalette.

| Rolle                              | Dunkel  | Hell    |
| ---------------------------------- | ------- | ------- |
| Fenster                            | #141B24 | #F5F6F8 |
| Navigation                         | #101720 | #EDF0F4 |
| Inhalt                             | #1C2633 | #FFFFFF |
| Erhöhte Fläche                     | #243244 | #F8FAFC |
| Arbeitsfläche                      | #151F2C | #F1F4F8 |
| Dezente Trennung                   | #3E4E63 | #D8DEE8 |
| Bedienelementkontur                | #8A9AB0 | #6B778C |
| Text                               | #F3F5F8 | #1F2937 |
| Sekundärtext                       | #B8C4D4 | #536176 |
| Primäraktion und aktive Navigation | #86B9EF | #0F6CBD |
| Text auf Primäraktion              | #12263E | #FFFFFF |
| Auswahlfläche                      | #243E5A | #E8F1FB |
| Erfolg                             | #92C7A1 | #2E6545 |
| Warnung                            | #E2BD79 | #805C14 |
| Fehler                             | #E9A5A3 | #A2403F |

Hell ist der Erststart. Eine bereits gespeicherte Wahl bleibt erhalten. Hell/Dunkel/System ist eine lokale Einstellung außerhalb der Workflowdatei. System folgt Änderungen der Farbschemameldung. Native Windows-Titelleiste und Fensterhintergrund folgen der Wahl ebenfalls. Die normale Windows-Fenstersteuerung bleibt erhalten.

Primäraktionen verwenden bei Hover `#A1CAF4`/`#0D5EA6`, beim Drücken `#70A6DF`/`#0A4E8A` (Dunkel/Hell). Text auf der Aktion bleibt an die jeweilige Rolle gebunden. Deaktivierte Elemente verwenden erhöhte Fläche, Sekundärtext und Bedienelementkontur ihres Themas; sie werden nicht durch globale Transparenz unlesbar. Tastaturfokus erhält eine blaue 2-px-Kontur mit Abstand. Eine ausgewählte Karte ergänzt die Auswahlfläche um Kontur beziehungsweise eine seitliche Markierung.

Farbe trennt vier Aufgaben: Grundflächen, Markenaktion/Navigation, tatsächlicher Status und fachliche Bausteinkategorie. Auswahl besitzt zusätzlich eine Kontur beziehungsweise eine textliche Auswahlkennung. Eine grüne Kategorie bestätigt keinen erfolgreichen Lauf.

### Blockly

Die Blockly-Struktur und Verbindungen bleiben erhalten. Fünf gedämpfte Fachfarben sind in beiden Themen gleich; Kategorienamen und Formen vermitteln die Bedeutung zusätzlich.

| Fachaufgabe         | Farbe   | Zugeordnete Kategorien                                                   |
| ------------------- | ------- | ------------------------------------------------------------------------ |
| Ablauf steuern      | #365E8B | Ablauf, Bedingungen, Schleifen, Variablen und Listen, Geschäftsablauf    |
| Daten verarbeiten   | #4F6291 | Daten laden, aufbereiten, verbinden, zusammenfassen, prüfen und ausgeben |
| Dateien und Ordner  | #5F6651 | Dateien und Ordner, Geschäftsdateien, erweitertes Löschen                |
| Dokumente erstellen | #7D5369 | Word, Excel, PDF                                                         |
| Werte und Eingaben  | #4D6977 | Ein- und Ausgaben, Texte, Zahlen, Datum und Zeit                         |

Blockly-Blöcke besitzen in beiden Themen helle Beschriftungen (`#F3F5F8`) auf dunklen Kategorieflächen. Eingabefläche `#151F2C`, Feldkontur `#B8C4D4` und die zweifarbige Auswahlkontur mit heller innerer Markierung sind eigene `--farbe-block-*`-Rollen. Canvasfokus und HTML-Formularfokus folgen dagegen dem jeweiligen Thema. Fehlermarkierungen erhalten die Kategoriefläche und werden durch Meldung und Warnsymbol ergänzt. Die kurze Business-Zusammenfassung wird aus der vorhandenen Konfiguration abgeleitet; sie ändert keine gespeicherten Fachdaten.

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

Im Workflow ersetzt eine beschriftete Bereichsauswahl die breite Navigation. Die erste Kopfzeile zeigt Name, Sprache und Speicherzustand sowie Speichern, die konkrete Startaktion und Exportieren. Die zweite Zeile bündelt Ablauf/Daten und Parameter/Läufe mit den Bearbeitungswerkzeugen. Bei enger Fläche dürfen die Zeilen umbrechen. Export ist ein Dialog. Der bearbeitete Workflow und sein Blockly-Workspace bleiben bei allen Ansichtswechseln dieselben.

Die Palette benötigt standardmäßig 272 px, Eigenschaften 320 px. Bei 1280 × 720 werden Eigenschaften gezielt überlagert. Anheften erfordert mindestens 1440 px Fensterbreite und ein zusätzlich geprüftes Canvasbudget von 600 px, gewichtet mit der UI-Textskalierung. Code öffnet sich nur bewusst. Daten, Ergebnisse und umfangreiche Protokolle belegen eigene Hauptansichten. „Ansicht zurücksetzen“ setzt nur persönliche Paletten-/Panelpräferenzen zurück.

## Komponenten und Zustände

Die behutsame Straffung vom 28. Oktober 2026 erhält alle direkten Aktionen. Die Startseite führt den aktiven Workflow anhand seiner Kennung einmal in höchstens fünf letzten Zeilen. Einstiegskarten besitzen mindestens 56 px Höhe und wachsen für umbrechenden Text. In Datenlisten trägt die Auswahl Semibold, normale Schritte Regular. Feldfehler stehen einmal vollständig am Feld; die Abschnittszusammenfassung verwendet kurze Ansprunglinks. Historie und Lauftabs teilen sich eine Kopfleiste.

Der Projektkopf ist der dauerhafte Ort des Speicherzustands, auch bei 200 Prozent UI-Text. Entwurfssicherung und Projektdatei bleiben sprachlich unterschieden. Erfolgsbestätigungen bleiben vier Sekunden sichtbar und enden bei einem Kontextwechsel; handlungsbedürftige Fehler verschwinden nicht durch diesen Timer. Bilder und Prüfgrenzen dieser Straffung vom 28. Oktober 2026 stehen in [UEBERSICHTLICHKEIT.md](../UEBERSICHTLICHKEIT.md).

- `Knopf`: Standard, leise, Primäraktion, Gefahr; Hover, gedrückt, sichtbar fokussiert, deaktiviert und beschäftigt. Wichtige Aktionen besitzen Text. Deaktivierungsgründe bleiben zugänglich.
- `Feld`, `Textfeld`, `Auswahlfeld`: dauerhafte Beschriftung, eigener Hilfetext, Fehler unmittelbar am Feld, Eingaben bleiben nach Fehlern erhalten.
- `Dialog`: nativer HTML-Dialog, sichtbarer Titel, Escape/Abbruch und Fokuswiederherstellung; keine Routineparameter in verschachtelten Dialogen.
- `Menue`: Pfeil-/Home-/End-/Escape-Bedienung und Rückkehr zum Auslöser. Bereichsmenüs liegen oberhalb der Befehlsleiste.
- `Arbeitsbereiche` und Lauftabs: ARIA-Tablist, ausgewählter Tab mit Textgewicht und Unterstreichung; Pfeiltasten, Home und End.
- Workflowliste: Suche und Sprachfilter beziehen sich auf bekannte ScriptLab-Projektdateien. Zeilenhöhe etwa 52 px; bis zu 50 Zeilen pro Seite; Filter durchsuchen vorher den gesamten Bestand. Speicherort und Dateistatus stehen in aufklappbaren Details. Auswahl, Suche, Sortierung, Seite und Scrollposition bleiben beim Rückweg erhalten.
- Datenvorschau: ausdrücklich geladenes, ausschließlich lesendes Ergebnis bis zum gewählten unterstützten Tabellenschritt. Höchstens 200 geladene Zeilen/256 KiB gemäß Laufzeitlimit, je 50 sichtbare Zeilen und 20 Spalten. Spaltenbreiten, Ausschnittsuche und Ausschnittsortierung ändern keine Daten. Quelle, Laufkennung, Standkennung und Grenzen bleiben nachvollziehbar. Nicht unterstützte Schleifen oder Verzweigungen werden erklärt, nicht als verfügbare Einzelvorschau dargestellt.
- Läufe: Liste des geöffneten Workflows, danach Übersicht, Ergebnisse und Protokoll des ausgewählten Laufs. Vorbereitung bleibt eine eigene bewusste Aktion. Modus und Status bleiben sichtbar. Fertige Läufe zeigen ihre damaligen Optionen; die nächste Vorbereitung überschreibt diese Angaben nicht. Stoppen ist während des Laufs unabhängig vom Arbeitsbereich erreichbar.
- Laufzeit: nur Status der mitgelieferten App-Komponenten und erneute Prüfung. Technische Versionen stehen in Details. Interpreterwahl und Paketinstallation gehören nicht in den normalen Arbeitsweg; externe Voraussetzungen werden beim Export erklärt.
- Leere Inhalte erklären den nächsten Schritt. Ladefehler sind eigene Zustände. Handlungsbedürftige Fehler bleiben sichtbar; technische Meldungen stehen zusätzlich im Protokoll.

Die Palette ordnet vorhandene Kategorien in fünf fachliche Einstiege (Python) beziehungsweise drei verfügbare Einstiege (VBS). Suche bleibt über alle verfügbaren Bausteine möglich.

Die vorhandene Einfügestellenliste bietet eine Zeigeralternative ohne Ziehen und bleibt neben Drag-and-drop und Blockly-Tastaturbedienung erhalten.

### Weniger Einrichtung beim Bearbeiten

Neue Business-Bausteine mit genau einer Ergebniseingabe erhalten den passenden direkten Vorgänger oder die einzige eindeutige Quelle. Mehrdeutige Quellen und zwei Eingaberollen bleiben eine ausdrückliche Auswahl. Vorhandene Bindungen werden beim Verschieben, Kopieren oder Laden nicht neu gesetzt. Einfügen und Quellenübernahme bilden einen gemeinsamen Rückgängig-Schritt, unabhängig von Klick oder Ziehen.

Häufige Felder bleiben unmittelbar sichtbar; seltene Optionen stehen unter „Weitere Einstellungen“. Feldfehler öffnen den betroffenen Abschnitt. Die Eigenschaften unterstützen „Datenvorschau“ als kontextbezogenen Ansichtswechsel. Erst „Datenvorschau laden“ liest Daten. „Zum Baustein“ kehrt zur Bearbeitung zurück und erhält beim direkten Rückweg Canvasposition und Zoom. Diese Navigation erzeugt weder eine fachliche Änderung noch einen Lauf.

### Regeln und Daten schrittweise bearbeiten

Filter beginnen mit Spalte, Vergleich und Vergleichswert. Weitere Bedingungen, Untergruppen und Umkehrung sind gezielte Erweiterungen. Der Wechsel zwischen UND und ODER erhält die Kinder einer Gruppe. Umkehrung aufheben und eine Gruppe mit genau einer Bedingung auflösen sind getrennte Aktionen; keine davon verwirft weitere Bedingungen.

Berechnungen bieten die acht vorhandenen Funktionen über verständliche Namen an: Jahr, Monat und Tag, Rand-Leerzeichen entfernen, Groß- und Kleinbuchstaben, Textlänge sowie Text anhand eines Suchmusters auslesen. Erweiterte Musterangaben mit Ergebnisgruppe und kurzen Hinweisen erscheinen nur dort, wo sie benötigt werden. Einfache Operanden zeigen ihren Wert zuerst; Wertquelle und Datentyp stehen bei Bedarf in Details. Bestehende Ausdrücke und Bindungen werden nicht durch bloßes Anzeigen ersetzt.

Qualitätsregeln zeigen nur die für ihre Prüfart nötigen Felder. Ihre Zusammenfassung bleibt beim Einklappen sichtbar. Unvollständige Regeln und betroffene Regeln mit Feldfehlern öffnen sich zur Korrektur. Ein Wechsel der Prüfart erhält bisherige Eingaben, statt sie vorsorglich zu löschen.

`SpaltenAuswahl` ergänzt fachliche Spaltenlisten um eine suchbare Mehrfachauswahl aus der Vorschau der zugeordneten Quelle. Neue Namen werden angehängt; die Auswahlreihenfolge bleibt erhalten und lässt sich mit Auf-/Ab-Aktionen ändern. Manuelle Namen und gespeicherte Wertbindungen bleiben verwendbar. Fehlende Vorschlagsdaten sind kein Nachweis für einen falschen Namen. Die Vorschlagsliste lädt keine Daten. Ihre Aktualität richtet sich nach dem benötigten Vorlauf der jeweiligen Vorschau und den Parameterwerten; spätere Bearbeitungsschritte machen sie nicht allein ungültig.

`ZuordnungsFeld` trennt den gespeicherten Namen von dessen Umbenennung. Der Dialog übernimmt einen gültigen Namen atomar oder erhält bei Abbruch den bisherigen Stand. Leere, doppelte und vom Dateiformat nicht unterstützte Namen werden am Entwurf erklärt; vorhandene Zuordnungen und Werte bleiben erhalten. Neue Einträge erhalten einen freien Namen. Nach erfolgreicher Umbenennung kehrt der Fokus zur entsprechenden Zeile zurück.

Quellen und Ausgabeziele folgen der tatsächlichen Aufgabe eines Felds. Eine gelesene Dokumentvorlage ist eine Quelle; das daraus erzeugte Dokument ist ein Ausgabeziel. Anzeigen und Aufklappen dieser Angaben starten keine Verarbeitung.

## Bewusste Grenzen

Der Hauptprozess ordnet aktuelle und lokal gespeicherte Läufe dem geöffneten Workflow zu. Die dauerhafte Historie ist mengen- und größenbegrenzt; Details stehen in [WEITERENTWICKLUNG.md](../WEITERENTWICKLUNG.md). Sie ist keine automatische Wiederaufnahme laufender Prozesse. Exportformate und Signaturunterstützung bleiben wie implementiert: VBS-Script optional signierbar, Business-Paket ohne vorgetäuschte ZIP-Signatur. Exportierte Scripts benötigen ihre externe Laufzeit; der mitgelieferte Interpreter gehört zur Anwendung. Dokumentvorlagen werden über die vorhandene unabhängige Beispielkopie einschließlich Ressourcen verwendet.

Die aktuellen Ansichten und tatsächlich geprüften Arbeitswege stehen in [REGELN-UND-DATEN.md](../REGELN-UND-DATEN.md) und der [Ansichtengalerie](../regeln-daten/ANSICHTEN.html). Die frühere Gestaltungsabnahme in [PRUEFUNG.md](PRUEFUNG.md) bleibt ihrem damaligen Stand zugeordnet. Kontrastprüfungen und eigene Sichtprüfung sind keine vollständige Barrierefreiheitszertifizierung oder Nutzertests.

## Offizielle Grundlagen

[Windows-Typografie](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography), [Windows-Schriftrechte](https://learn.microsoft.com/en-us/typography/fonts/font-faq), [Befehlsleisten](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/command-bar), [Dialoge](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/dialogs), [WCAG-Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [nichttextueller Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Ziehen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [Umbruch](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Electron-Bildschirme](https://www.electronjs.org/docs/latest/api/screen).
