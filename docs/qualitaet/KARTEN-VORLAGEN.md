# Vorlagen als auswählbare Karten

## Auftrag und Umfang

Nutzerwunsch: Karten stärker in die bestehende Oberfläche integrieren. Ausgang `main` / `9d3ed29`, vorherige Navigation und echter Blockly-Canvas bleiben erhalten. Dieses Fachpaket betrifft ausschließlich vorhandene Vorlagen: `VorlagenBereich.tsx`, `vorlagen.css`, die beiden zugehörigen Testdateien und diesen Bericht. Die gemeinsame semantische `Karte` und Startseite besitzt der Hauptagent; keine eigenen globalen Tokens, Metadaten, Verarbeitung, Abhängigkeiten oder Gitaktionen durch den Fachagenten.

Die elf vorhandenen Vorlagen behalten IDs, Titel, Aufgaben, Sprachen, Ergebnis- und Vorbereitungstexte aus `hilfe.ts`. Suche und Filter bleiben kontrolliert im bestehenden `Startbereich`. Dokumentvorlagen bleiben daraus abgeleitete Workfloweinstiege. Kartenauswahl startet keinen Lauf und öffnet kein Projekt; nur der bekannte Öffnenknopf fordert die eigene bearbeitbare Kopie an.

## Gestaltung und Bedienung

Die gemeinsame `Karte` stellt den Artikelrahmen. Der vorhandene benannte Titelknopf übernimmt die Auswahl per Tastatur und Maus. Seine anklickbare Fläche umfasst Titel, Metadaten und Ergebnis, ohne die Detailbedienung zu überdecken. Aufgabe und Sprache stehen auf einer gemeinsamen Metadatenzeile, darunter Titel und erwartetes Ergebnis. Hover, sichtbarer Fokus und Auswahl unterscheiden sich über bestehende Farb-/Konturrollen.

Das Raster nutzt bei ausreichendem Platz drei, bei mittlerer Breite zwei und bei großem Text beziehungsweise wenig Platz eine Spalte. Die gewählte Karte spannt über die Rasterbreite und zeigt genau eine vollständige Vorbereitung mit Dateidetails und erreichbarer Öffnenaktion. So wird die vorhandene Vorbereitung nicht in eine schmale Spalte gepresst oder als zweite Datenkopie daneben gepflegt. Es gibt keine Karte pro Feld und keine Änderung an Workflow-/Export-/Laufverträgen.

## Prüfung und Übergabe

Windows x64, Node 24.19.0, Electron 45, React 19.3.1; integrierter Kartenbuild des Hauptagenten mit unverändertem Vorlagen-Produktstand. Vollständige gültige Einstellungen, isolierte temporäre Profile und mitgelieferte synthetische Beispiele. Der Hauptagent stellte einen exklusiven UI-Slot bereit; keine parallelen Desktop-/Buildprozesse durch diesen Agenten.

| Ausgeführt                                                                                                                    | Ergebnis                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                                                                                               | **Bestanden**, zuletzt nach den zusätzlichen Geometrie-/Fokusnachweisen.                                                                                                                   |
| `npx vitest run tests/vorlagen-bedienung.test.ts`                                                                             | **7 bestanden**: vorhandene Filter-/Sprach-/Dokumentverträge und genau eine Vorbereitung erhalten; zusätzlich lange deutsche Texte, Pfad und HTML-ähnlicher Inhalt als React-Text geprüft. |
| `npx playwright test tests/desktop/vorlagen-bedienung.spec.ts --reporter=list --output=artifacts/karten/vorlagen-tests-final` | **5 bestanden**, 0 fehlgeschlagen, 0 übersprungen. Vier Themen-/Textgrößenkombinationen und der vorhandene Dokumentvorlagenfall.                                                           |
| Prettier der fünf gelieferten Dateien                                                                                         | **Bestanden**.                                                                                                                                                                             |

Die Desktopfälle prüfen tatsächliche 14/28px und `light`/`dark` bei 1280 × 720. Die reale Geometrie zeigt bei 100 % drei Karten je Zeile (erste Breite 333,65625px, 16px Zwischenraum), bei 1100 Pixeln zwei (426,5px) und bei 200 % eine Karte (977px). Die volle Breite der ausgewählten Karte wird zusätzlich mit der Rasterbreite verglichen. Tastaturfokus am Titel erzeugt an der Karte `solid`, `2px`, `3px` Abstand. Der Ergebnisbereich der nächsten Karte wird mit einem echten Mausklick ausgewählt; die erste Karte klappt zu und genau eine Vorbereitung bleibt. Das aktive Projekt bleibt dabei gleich und es entsteht kein Lauf.

Die bisherigen Abnahmen für kombinierte Suche/Aufgabe/Sprache, internen Ansichtswechsel mit Filter-/Auswahlerhalt, leere Treffer, Reset, erreichbare Dateidetails und Öffnenaktion bleiben bestehen. Der bewusst betätigte Öffnenknopf erzeugt weiterhin die richtige eigene ungespeicherte Pythonkopie; Workflowquelle und Laufzustand bleiben unverändert. `Bestellung.docx` ist weiterhin dem bekannten Business-Workflow zugeordnet, mit eigener Kopie statt separatem Dokumentmodul. Der Cleanup wartet vor dem Temp-Löschen auf das tatsächlich ausgelöste Prozess-`close`.

Bilder und Rohwerte: `artifacts/karten-vorlagen/kartenraster-{hell,dunkel}-{100,200}.png`, `sicherung-*-vorbereitung.png`, `dokumentvorlage-dunkel-100.png`, `raster-*.json` und `fokus-*.json`. Tatsächlich angesehen wurden beide 100%-Raster, das helle 200%-Raster, die helle 100%- und dunkle 200%-Vorbereitung sowie der dunkle Dokumentfall. Die Karten sind vergleichbar angeordnet; die lange Vorbereitung wird nicht in schmale Spalten gepresst. Bei 200 % ist vertikales Scrollen notwendig, Texte bleiben unverkleinert und die Öffnenaktion erreichbar. Die Zahlen beschreiben Layoutgeometrie, keine Leistungsverbesserung.

Grenzen: keine neue vollständige VBS-/Python-Laufzeitabnahme durch diese Kartengestaltung, keine Anwenderstudie, keine zusätzliche Screenreader-/Windows-Kontrast-/DPI-Prüfung, kein Installer-/Release-/Remote-CI-Nachweis dieses Fachagenten. Übergreifende Home-, Komponenten-, Bestands- und Integrationstests sowie Git liegen beim Hauptagenten. Keine Produktdatei nach dem geprüften Build geändert.
