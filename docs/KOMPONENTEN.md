# Gemeinsame Oberflächenbausteine

Die Designquelle ist `src/gestaltung/tokens.ts`. `designTokensAnwenden()` setzt daraus CSS-Variablen am Wurzelelement; der Import selbst greift nicht auf den DOM zu. `blocklyThema.ts` verwendet dieselben Farben, Schriftwerte und Kategorien. Die Hauptoberfläche lädt zusätzlich `src/renderer/komponenten/komponenten.css`.

## Tokens und Zweck

- Arbeitsfläche `#14171B`, Seiten-/Werkzeugflächen `#1B1F24`, Überlagerungen `#242A31`: Der Ablauf bleibt die größte zusammenhängende Fläche.
- Text `#F1F3F5`, Hilfen `#B4BDC8`: Hilfen bleiben auch in normaler Schrift kontrastreich.
- Akzent `#88B4FF` und dunkler Text `#121820`: Eine gefüllte Hauptaktion und HTML-Fokusrahmen; keine dekorativen Akzentflächen.
- Kontur `#697687`: Wesentliche Feldgrenzen erreichen auf den drei UI-Flächen mindestens 3:1. `#343C46` trennt nur dekorativ.
- Erfolg `#8CC8A2`, Hinweis `#EBC17A`, Fehler `#F19A9A`: Immer mit tatsächlicher Meldung und unterscheidbarem SVG-Symbol verwenden.
- Abstände 4/8/12/16/24/32 CSS-Pixel; Felder/Schaltflächen mindestens 36, Iconziele mindestens 32 CSS-Pixel. Diese Maße sind logische Größen.
- Schrift: Segoe UI Variable, Segoe UI, system-ui, sans-serif; normale Inhalte 14, Metadaten 12, Dialogtitel 20 CSS-Pixel. Das gemeinsame `--text-skala` vergrößert Texte; Mindesthöhen dürfen dabei wachsen.

Die vorhandenen dunklen Kategorien werden zentral weitergeführt. Die tatsächlichen Paare aus Haupttext und Kategorie erreichen mindestens 4,5:1. Schattenwerte erhalten ausdrücklich die dunkle Feldfarbe; sie werden nicht von Zelos heller abgeleitet. Auswahlkonturen verwenden helles Grau, der Blockly-Tastaturcursor und die Einfügemarkierung Weiß. Die Akzentfarbe hätte unmittelbar auf mehreren Kategorien weniger als 3:1 und wird deshalb dort nicht als alleiniger Marker verwendet.

## Zustandsübersicht

| Komponente | Normal | Hover / gedrückt | Fokus / Auswahl | Gesperrt / Verarbeitung | Fehler |
|---|---|---|---|---|---|
| Standardknopf | Grundfläche, Text, erkennbare Kontur | Erhöhte / Arbeitsfläche; gleiche Maße | 2-Pixel-Außenkontur mit Abstand; aktivierter Knopf zusätzlich als `aria-pressed` oder `aria-expanded` | Lesbare eigene Zustandsfarben und sichtbarer Grund, keine pauschale Deckkraft | Gefahrvariante mit Fehlerfarbe und verständlichem Text |
| Primärknopf | Akzent mit dunklem Text | Geprüfte hellere / dunklere Akzentfarben | Außenkontur bleibt durch ihren Abstand vom gefüllten Knopf unterscheidbar | Wird zur neutralen gesperrten Variante; tatsächliche Verarbeitung über `aria-busy` | Fehler gehört in die Meldung zum Vorgang |
| Eingabe / Auswahl / Textfeld | Dauerhaftes Label, Kontur, dunkle Eingabe | Helle Kontur, keine Größenänderung | Akzentkontur außerhalb; vollständiger Inhalt bleibt bearbeitbar | Lesbare Zustandsfarben | `aria-invalid`, Fehlerkontur und verknüpfter konkreter Text |
| Dialog | Native modale Ebene, 20-Pixel-Titel, eigener Inhaltscroll | Keine dekorative Bewegung | Anfangsfokus auf Titel oder ausdrücklich übergebenes Feld; native Tab-Begrenzung | Nur tatsächliche Vorgänge sperren Aktionen | Inhaltliche Fehlermeldung im Dialog |
| Aktionsmenü | Benannter Auslöser | Gleiche Knopfzustände | Pfeile, Home/End; Escape schließt mit Fokusrückgabe | Grund bleibt sichtbar | Kein erfundener Erfolg |
| Status | Text mit SVG-Symbol | Kein Hover nötig | Gewöhnliche Meldung `status`, Fehler `alert` | Kein erfundener Prozentwert | Fehler bleibt als Text sichtbar |

## Verwendung

`Knopf` nimmt `variante`, optional `symbol`, `verarbeitung` und `grund` sowie normale Button-Attribute an. Reine Iconknöpfe benötigen `aria-label` und einen passenden Tooltip. Für gesperrte Aktionen soll der Aufrufer einen konkreten `grund` angeben. Die Komponente rendert diesen zusätzlich sichtbar und verknüpft ihn mit `aria-describedby`. In der kompakten Werkzeugleiste kann `grundId` stattdessen auf einen bereits sichtbaren gemeinsamen Vorgangstext verweisen. Dann entsteht kein zusätzlicher Wrapper oder doppelter Grundtext.

`Feld`, `Textfeld` und `Auswahlfeld` erhalten `beschriftung`, optional `hilfe` und `fehler` sowie normale Eingabeeigenschaften. Sie prüfen keine Workflowwirkung und erzeugen keine automatischen anfänglichen Fehler; das entscheidet die tatsächliche Bearbeitungs-/Exportlogik. Ein langer Pfad wird im normalen Textfeld vollständig auswählbar gehalten.

`Dialog` erhält `offen`, `titel`, `onSchliessen`, Inhalt und optional `fuss`, `beschreibung` oder `anfangsfokusRef`. Der native `showModal()`-Dialog macht den Hintergrund inert, behandelt Escape und stellt den vorherigen Fokus ohne Scrollsprung wieder her. Ein umfangreicher Dialog sollte keine lange Gesamtbeschreibung über `beschreibung` erhalten; seine strukturierten Inhalte werden einzeln gelesen.

`Menue` erhält `beschriftung`, `symbol` und `eintraege` aus ID, Text, optionalem Symbol, Aktion und gegebenenfalls Sperrgrund. Nach einer Menüaktion erhält zunächst der Auslöser den Fokus; ein anschließend geöffnetes Dialogfenster übernimmt ihn von dort.

## Prüfung und verbleibende Grenzen

`tests/gestaltung.test.ts` berechnet WCAG-Relativluminanzen ohne Aufrunden für Text, Hilfen, Zustände, notwendige Konturen und alle Kategorie-/Markerpaare. Markupprüfungen kontrollieren sichtbare Sperrgründe, verknüpfte Labels/Hilfen/Fehler, Statusrollen und das lokale SVG-System. Diese Tests sind kein Beleg einer vollständig barrierefreien Anwendung.

Die tatsächlichen Breiten, Klickziele, Fokusrückgabe, Dialognavigation, Windows-Screenreader und Windows-Kontrastmodi müssen zusätzlich am integrierten Fenster geprüft werden. `forced-colors` verwendet Systemfarben; reduzierte Bewegung entfernt die kurzen Knopfübergänge. Ein Token- oder Markup-Test ersetzt keine praktische Prüfung dieser Betriebssystemfunktionen.

## Originalquellen

- [WCAG 2.2 Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normales Textziel 4,5:1, tatsächliche Hintergrundpaare prüfen.
- [WCAG 2.2 nichttextueller Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): notwendige Konturen und Zustandsmarker 3:1 zu angrenzenden Farben.
- [WCAG 2.2 Zielgröße](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): die 32-/36-Pixel-Entscheidung von ScriptLab liegt über dem allgemeinen 24-Pixel-Ausgangspunkt; kleine Canvas-Kontrollen benötigen eine gleichwertige normale Bedienung.
- [WAI-ARIA Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): modaler Hintergrund, Anfangsfokus, Escape, Tab-Grenze und Fokusrückgabe.
- [Blockly Themes](https://docs.blockly.com/guides/configure/appearance/themes/): offizielle Block-, Kategorie-, Komponenten- und Schriftstile.
