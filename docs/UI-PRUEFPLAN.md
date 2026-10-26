# UI-Prüfplan

Stand: 26.10.2026. Dieser Plan beschreibt die zusätzliche UI-/UX-Abnahme. Tatsächlich bestandene Prüfungen werden getrennt in [DESIGNNOTIZ.md](DESIGNNOTIZ.md) dokumentiert. Geplante Prüfungen sind keine Ergebnisse.

## Grundlage und strengere Produktentscheidungen

| Grundlage                                                                                                                                                                                                     | Prüfbare Anforderung                                                             | ScriptLab-Entscheidung                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)                                                                                                                               | Ausreichender Textkontrast gegen den tatsächlichen Hintergrund                   | Mindestens 4,5:1 auch für kleine Hilfen und Metadaten; Zustände getrennt prüfen                                                                                                         |
| [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)                                                                                                                             | Wesentliche grafische Hinweise und Bedienelementgrenzen sind erkennbar           | Mindestens 3:1 für erforderliche Konturen, Fokus, Auswahl und Einfügemarker; Raster und dekorative Trennlinien davon unterscheiden                                                      |
| [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)                                                                                                                             | Ziehfunktion besitzt eine Alternative mit einzelnen Zeigeraktionen               | Hinzufügen, Umordnen und Verbinden müssen über anklickbare Bedienelemente ohne gehaltene Maustaste möglich sein. Tastatur allein ersetzt diesen Nachweis nicht                          |
| [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)                                                                                                                            | Mindestzielgröße oder eine der dort beschriebenen Ausnahmen                      | Häufige ScriptLab-Ziele mindestens 32 × 32 CSS-Pixel; gewöhnliche Felder und Knöpfe ungefähr 36 Pixel hoch. Kleine Blockly-Felder benötigen eine gleichwertige normal große Bearbeitung |
| [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)                                                                                                                    | Fokusziel wird nicht vollständig durch eigene Inhalte verdeckt                   | ScriptLab strebt vollständig sichtbare Fokusfläche an. Fokus und ausgewählter Baustein bleiben unterscheidbar                                                                           |
| [Windows-Abstände](https://learn.microsoft.com/en-us/windows/apps/design/basics/content-basics), [Windows-Typografie](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography) | Gemeinsame Kanten, nachvollziehbare Gruppen und linksbündige lesbare Texte       | Lokale Segoe-Schrift, 14-Pixel-Bedientext und die vereinbarte Abstandsskala                                                                                                             |
| [Blockly-Themes](https://docs.blockly.com/guides/configure/appearance/themes/), [Blockly-Tastatur](https://docs.blockly.com/guides/configure/keyboard-nav/)                                                   | Version 13.4 über öffentliche Anpassungs- und Navigationsschnittstellen bedienen | Kein Bibliotheksfork; Verlauf und Blockverbindungen bleiben erhalten                                                                                                                    |

Die Understanding-Dokumente erläutern die Kriterien. Eine Palette oder ein automatischer Scan alleine beweist keine vollständige WCAG-Konformität.

## Testdaten und Sicherheitsgrenze

Alle Projekte in `tests/ui/fixtures` sind ausschließlich Testdaten. `node tests/ui/fixtures-erzeugen.mjs` erstellt sie reproduzierbar aus `fixtures.ts`. Die Fixtures werden nur geprüft, in Blockly geladen und als Text exportiert. Keines ihrer VBS-Scripts wird gestartet.

| Projekt                                 | Zweck                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `01-Alltagsworkflow.scriptlab`          | 28 Bausteine: Eingabe, Variable, Ordner, Bedingung, Schleife, Dateiprotokoll und Nachricht                          |
| `02-Verschachtelte-Ablaeufe.scriptlab`  | Schleife mit Bedingung und zusätzlicher innerer Schleife                                                            |
| `03-Lange-Texte-und-Pfade.scriptlab`    | Lange deutsche Erläuterungen, lange Windows-Pfade, vollständige Bearbeitung im Eigenschaftenbereich                 |
| `04-Fehlende-Pflichtwerte.scriptlab`    | Fehlende Werte und absichtlich lose aktive Anweisung; Speichern bleibt erlaubt, Export muss konkrete Hinweise geben |
| `05-Signatur-ohne-Zertifikat.scriptlab` | Tatsächlich gewünschte Signatur bei fehlender Zertifikatsauswahl; keine erfundene Erfolgsmeldung                    |

Dateivorgänge der Anwendung verwenden isolierte temporäre Ordner. Signatur- und Updatezustände werden für reine Darstellungsprüfungen ausdrücklich als gesteuerte Testantworten gekennzeichnet. Sie sind kein neuer Nachweis produktiver Signatur- oder Updatefunktion.

## Größen und Skalierungen

1. Nutzbaren Rendererinhalt auf 1280 × 720 CSS-Pixel einstellen und `window.innerWidth/innerHeight` protokollieren. Normale Windows-Titelleiste gehört nicht zu diesen Inhaltsmaßen.
2. Zusätzlich 1600 × 1000 CSS-Pixel prüfen. Bei kleinerer verfügbarer Fläche tatsächliche Werte melden, keine gewünschte Größe als erreicht eintragen.
3. Pro Prozess `--force-device-scale-factor=1`, `1.25`, `1.5`, `2` verwenden und tatsächliche CSS-Fläche, `devicePixelRatio` sowie Electron-Displaymaßstab protokollieren. Das sind prozessweise DPI-Darstellungsprüfungen; sie ersetzen keine verifizierten Änderungen der Windows-Anzeigeeinstellungen.
4. UI-Textgröße getrennt vom Canvas-Zoom auf 100, 125, 150 und 200 Prozent prüfen. Canvas-Zoom darf sich dadurch nicht als Ausgleich verkleinern.
5. Keine unbeabsichtigte horizontale Seitenscrollleiste; Panelinhalte scrollen innerhalb ihres Bereichs. Toolbar, Status und Export bleiben erreichbar. Den sichtbaren Zustand bei jedem Maßstab zusätzlich als Screenshot prüfen.

Windows-Systemskalierungen oder Kontrastmodus werden nicht heimlich umgestellt. Falls diese echten Systemzustände in der Sitzung nicht praktisch geprüft werden können, bleiben sie ausdrücklich offen.

### Helper für die native System-DPI-Prüfung

`tests/ui/system-dpi-pruefen.mjs` beobachtet einen ausdrücklich manuell vorgenommenen Windows-Skalierungswechsel. Der Helper selbst ändert keine Windows-Einstellung. Er öffnet ein isoliertes ScriptLab-Testprofil ohne erzwungene Prozess-DPI auf der am weitesten rechts angeordneten Anzeige und erfasst das Anfangslayout. Vorher den ursprünglichen Windows-Anzeigemaßstab notieren; bei mehreren Anzeigen die tatsächlich geprüfte Anzeige eindeutig festhalten.

Nach `npm run build` im Repository-Verzeichnis zunächst die Signaldatei leeren und den Helper starten:

```powershell
New-Item -ItemType Directory -Path artifacts/system-dpi -Force | Out-Null
Set-Content -LiteralPath artifacts/system-dpi/befehl.txt -Value '' -Encoding ascii
node tests/ui/system-dpi-pruefen.mjs
```

In den Windows-Anzeigeeinstellungen die gewünschte Skalierung bewusst auswählen. Danach in einem zweiten Terminal die passende Zahl `100`, `125`, `150` oder `200` in die Signaldatei schreiben, zum Beispiel:

```powershell
Set-Content -LiteralPath artifacts/system-dpi/befehl.txt -Value 100 -Encoding ascii
```

Der Helper wartet auf den dazu passenden tatsächlichen `devicePixelRatio`, kontrolliert den Electron-Displaymaßstab und schreibt JSON/PNG nach `artifacts/system-dpi/windows-100.*` beziehungsweise zur jeweiligen Stufe. Auch wenn ein Zielinhalt von 1280 × 720 angefordert wird, ausschließlich die tatsächlich gemessenen CSS-Maße berichten. Der vollständige Aufgabenweg ist eine getrennte Interaktionsprüfung.

Am Ende den ursprünglichen Windows-Maßstab wiederherstellen, im dokumentierten Durchlauf 175 Prozent, und mit dem Signal `175` auch die Wiederherstellung erfassen. Danach `ende` in die Signaldatei schreiben. Das beendet den Helper und entfernt nur sein geprüftes temporäres Testprofil. Die Anwendung bleibt ohne Workflowausführung. Nur Rendereraufnahmen archivieren; Windows-Einstellungsansichten gehören nicht zu den App-Nachweisen. Der abgeschlossene native Durchlauf und seine Grenzen stehen in der [Designnotiz](DESIGNNOTIZ.md).

## Interaktionsfälle

| Nr. | Durchführung                                                               | Erwartetes Verhalten                                                                                                                                                             |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Neues Projekt öffnen                                                       | Genau ein Startbaustein, kurzer Handlungshinweis, Palette mit geöffneter sinnvoller Kategorie; Code und Eigenschaften geschlossen                                                |
| 2   | 28-Block-Projekt öffnen und bewusst „Alles anzeigen“ nutzen                | Verbundener Hauptablauf mit verständlichen Beschriftungen; keine automatische Zentrierung nach jeder Bearbeitung                                                                 |
| 3   | Verschachtelte Schleifen/Bedingung öffnen                                  | Konturen, Eingänge, Reihenfolge und Verschachtelung eindeutig; gespeicherte Verbindungen unverändert                                                                             |
| 4   | Baustein auswählen und danach ein Feld fokussieren                         | Auswahl bleibt erkennbar, eigener Tastaturfokus unterscheidbar und sichtbar                                                                                                      |
| 5   | Block ziehen, passende und unpassende Verbindung ansteuern, Escape         | Eindeutige Einfügemarkierung; unzulässige Verbindung wird nicht hergestellt; Escape stellt vorherigen Zustand wieder her                                                         |
| 6   | Unvollständigen Entwurf öffnen und Export versuchen                        | Kein sofort aggressiver Erstfokusfehler; beim Export konkrete Übersicht und Fokus/Ansicht am ersten betroffenen Baustein; keine VBS-Datei erzeugt                                |
| 7   | Suche mit Treffer, ohne Treffer und Leeren                                 | Alle Kategorien durchsucht; Treffer haben Kategorie und Namen; eigener Leerzustand mit „Suche leeren“; vorheriger Kategoriezustand bleibt möglichst erhalten                     |
| 8   | Lange Pfade auswählen und Eigenschaften öffnen                             | Vollständiger Wert auswählbar, kopierbar und bearbeitbar; Änderung erscheint im selben Blockly-Feld und bleibt nach Wiederöffnen erhalten                                        |
| 9   | Eigenschaften bei 1280 und 1600 öffnen/schließen                           | Unter 1440 bewusstes Overlay, Arbeitsfläche bleibt gleich groß; großes Fenster kann anheften; Auswahlwechsel ändert keine Panelbreite                                            |
| 10  | Codepanel öffnen, Höhe ändern, schließen                                   | Anfangs geschlossen, schreibgeschützter Text, eigene Größe; vorheriger Arbeitskontext bleibt bestehen                                                                            |
| 11  | Mausrad, Strg+Mausrad, Palette scrollen                                    | Gewöhnliches Rad verschiebt Canvas oder Palette; Strg+Rad zoomt nur auf Canvas; Mittelpunkt/Zeigerbezug bleibt nachvollziehbar                                                   |
| 12  | Vollständiger Klickweg ohne Ziehen                                         | Baustein finden → Einfügen → Ziel wählen → Eigenschaften ändern → weiteren Block verbinden → Block umordnen → Speichern → Öffnen → Export. VBS wird nie ausgeführt               |
| 13  | Speicher-/Exportdialog abbrechen; Dateiziel absichtlich als Ordner belegen | Abbruch bleibt Abbruch; vorhandene Daten bleiben erhalten; Fehler wird verständlich und dauerhaft angezeigt                                                                      |
| 14  | „Nicht speichern“/„Speichern“/„Abbrechen“ beim Projektwechsel              | Beschriftungen eindeutig; Abbruch erhält den aktuellen Stand; erfolgreiches Speichern erlaubt Wechsel                                                                            |
| 15  | Gesteuerte Signaturzustände und Updatezustände anzeigen                    | „Gültig“, „fehlgeschlagen“, „nicht eingerichtet“, Fortschritt und Fehler beruhen auf der jeweils kontrollierten Antwort; Testdarstellung nicht als reale Produktprüfung ausgeben |
| 16  | Tastatur zwischen Bereichen, Feldern und Dialogen bedienen                 | Neu/Öffnen/Speichern/Speichern unter, Rückgängig/Wiederholen funktionieren. Entf löscht keinen Text als Block. Dialoge schließen mit sinnvoller Fokusrückgabe                    |
| 17  | Windows-Screenreader und Kontrastmodus                                     | Zugängliche Namen, Rollen, Statusmeldungen und Fokusbewegung praktisch beobachten. Fehlende praktische Prüfung konkret dokumentieren                                             |

## Nachweise und Abnahmegrenzen

`tests/desktop/ux.spec.ts` prüft die echte Electron-Oberfläche. Native Dateiantworten dürfen reproduzierbar gesteuert werden; tatsächliche Projekt- und Exportdateien werden trotzdem geschrieben und gelesen. Screenshots ergänzen die Assertions und werden visuell geprüft. Eine eigenständig durchgeführte Aufgabe wird als eigene Prüfung gekennzeichnet; es wird keine externe Testperson erfunden.

Der Ergebnisbericht soll je Fall Fensterinhalt, DPI-/Textmaßstab, Bedienweg, Dateivorgang, Testdaten und gegebenenfalls verbleibende Einschränkungen nennen. Screenshots gehören nur zu Zuständen, die tatsächlich geöffnet und geprüft wurden.
