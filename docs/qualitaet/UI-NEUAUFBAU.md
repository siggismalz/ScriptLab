# Aufbau und Gestaltung der Arbeitsoberfläche

## Ausgang und Ziel

31.10.2026, `main`, sauberer Ausgang `a5e64f9f73683f957cfabc829135118a6b8fd8ca`. Der Nutzerscreenshot der Datenvorschau zeigt mehrere horizontale Navigationsebenen, verstreute Bedienelemente, wiederholte Statushinweise und eine Tabelle, deren einzelne Kopfzelle viele Zeilen beansprucht. Der vorhandene CSV-Leseschritt kann eine andere Trennzeichenvorgabe als die Quelldatei haben; ein schöneres Tabellenlayout allein behebt das nicht.

Umfang dieses Pakets: bestehende Appstruktur, gemeinsame Gestaltung, Start/Workflows/Vorlagen, Daten und Laufdetails. Der echte Blockly-Editor, bestehende Funktionen, Projektformate, Generatoren, Main/Preload und die kontrollierte Ausführung bleiben erhalten. Keine neue Bibliothek, kein neues Geschäftsmodul oder Cloudaufbau.

## Befunde und überprüfbare Abnahme

| Kennung | Reproduktion und Auswirkung | Änderung / Abnahme |
|---|---|---|
| UI-01 | Im Editor stehen globale Navigation, Workflowkopf und zwei weitere Auswahlebenen übereinander. Gleiche Ziele finden sich erneut im Menü „Bereiche“. Die Arbeitsfläche verliert Höhe und Orientierung. | Eine gemeinsame globale Sidebar in Start und Editor. Workflowkopf mit Speicherstand und direkten Aktionen; darunter aktive Workflowbereiche. Ungespeicherte Daten, Auswahl und Canvasansicht bleiben bei Wechseln erhalten. |
| UI-02 | Datenvorschau bei 1280 × 720: große Steuerzeilen, Herkunft, Warnungen und Seitensteuerung verdrängen die Tabelle. Lange Kopfzellen umbrechen bis zur Unlesbarkeit. | Kompakte gemeinsame Vorschauwerkzeuge, Filter und Seitensteuerung am Ergebnis, ausreichend breite Spalten mit lesbaren Überschriften. Schon ohne Scrollen sind Tabellenzeilen sichtbar. Herkunft und Begrenzungen bleiben zugänglich. |
| UI-03 | CSV mit Komma wird mit einer anderen expliziten Trennzeichenvorgabe eingelesen: alle Überschriften erscheinen in einer Spalte. | Bei eindeutig passendem Befund Hinweis auf das Trennzeichen und direkter Weg zum vorhandenen Quellenfeld. Keine automatische Umdeutung oder erneute Ausführung. |
| UI-04 | Unterschiedliche Navigation/Flächen in Bibliothek, Editor und Laufdetails; wichtige Startaktion fehlt im Datenbereich. | Gemeinsame Tokens, Navigation und Komponenten. Ausführen als direkte Workflowaktion erreichbar, optionale Vorbereitung und technische Details klar untergeordnet. |

## Angewendete Skills und Entscheidungen

Die installierten Skills `ui-ux-pro-max`, `design-system` und `ui-styling` unter `C:/Users/leons/.agents/skills/` wurden gelesen und angewendet: Hierarchie, nachvollziehbare Navigation, Tabellenbreiten, semantische Farbrollen, Fokus und bedarfsgerechte Details. Die erste Design-System-Suche ergab teilweise ein unpassendes Marketinglayout; die engere Suche nach einer produktiven Datenarbeitsfläche ergab sachlichen Minimalismus und eine datenorientierte Hierarchie. Nur passende Empfehlungen wurden übernommen. Keine Marketingflächen, chinesische Schriftfamilie, fremde Farbwelt, Netzwerkfonts oder Animationsbibliothek aus generischen Suchresultaten eingebaut.

Die vorhandenen React-Komponenten für Knöpfe, Felder, Dialoge, Menüs, Karten und zugängliche Tabs decken den Bedarf. Ein Wechsel zu Tailwind/shadcn oder einer zweiten Komplettbibliothek hätte die tatsächlichen Strukturprobleme nicht gelöst. Die bestehenden deutschen Tokens werden um gemeinsame Sidebarrollen ergänzt; Segoe UI, gedämpftes Petrol/Grün, helle und dunkle Darstellung bleiben erhalten. Alte globale Bereichsüberschreibungen werden konsolidiert, damit zuständige Komponenten ihre Darstellung kontrollieren.

Als struktureller Vergleich dient der [offizielle Power-Automate-Designer](https://learn.microsoft.com/en-us/power-automate/flows-designer): Workflowkontext und direkte Befehle, Canvas als Arbeitsfläche, Konfiguration des gewählten Schritts. Das ist eine Orientierung, keine Kopie und keine Übernahme des dortigen mehrstufigen Teststarts.

## Fachaufträge und Schreibbereiche

- **Root – Architektur, gemeinsame Gestaltung und Integration:** `Anwendung.tsx`, `EditorNavigation`, `Arbeitsbereiche`, gemeinsame CSS/Tokens, Testhelfer und Dokumentation. Globale Ziele als wiederverwendbare Sidebar; Workflowzustand und explizite Aktionen erhalten. Keine Projekt-/IPC-Migration. Verantwortlich für vollständigen Diff, Build, echte UI-/Paketprüfung, deutsche Commits und Push.
- **Businessdaten – Datenarbeitsfläche:** `Datenbereich.tsx`, `datenbereich.css`, `daten-darstellung.ts`, eigene Unitdatei und genau eine bestehende Textassertion. Bestehende Quellen/Parameter/Vorschau zu einer lesbaren Arbeitsfläche ordnen, Tabellenkopf und Scrollbereiche verbessern, falsches CSV-Trennzeichen ohne Datenmutation erklären. Filter, Sortierung, Spaltenbreiten, Bindungen, Laufstand und Grenzen erhalten. Übergabe mit tatsächlichen Unitprüfungen und ungeprüften GUI-Punkten.
- **Bedienung – Start, Bibliothek und Vorlagen:** `Startbereich`, `startbereich.css`, `start-werkbank.css`, `VorlagenBereich`, `vorlagen.css`. Gemeinsame `EditorNavigation` verwenden; kompakte direkte Aktionen, Karten für Einstieg und Vorlagen, übersichtliche Workflowzeilen. Navigation nur über bestehende Zustandsfunktionen; Wiederaufnahme, Entwürfe, Suche, Filter und Scrollpositionen erhalten. Keine zentralen Dateien ändern.
- **Ausführung – Laufansichten und unabhängige QA:** `Laufverwaltung`, `Testbereich` und zugehörige CSS; eigene gezielte Tests. Status und Ergebnisse zum wirklichen Lauf deutlich zeigen, optionale Vorbereitung und Herkunft/Protokoll einordnen. Laufstart, Stoppen, Fehler, Lauf-IDs, Historie und festgelegte Grenzen nicht verändern. Echte GUI erst nach gemeinsamer Buildfreigabe; kein paralleler Testdesktop.

Alle drei Fachagenten sind tatsächlich gestartet und arbeiten in disjunkten Bereichen desselben Arbeitsbaums. Ausschließlich Root bedient Git. Kritische Laufannahmen werden zusätzlich unabhängig gelesen; die integrierte App wird anschließend geprüft.

## Nachweise

- **Ausgang bestanden:** unveränderter Build des Ausgangsstands, `npx playwright test tests/desktop/business-ui.spec.ts tests/desktop/editorstruktur.spec.ts --reporter=list`: 6/6 in 41,8 Sekunden. Enthält echte Business-/Editorwege, hell/dunkel und 100/200 % Text.
- **Noch ausstehend:** integrierte Typprüfung, Module, Desktopabläufe, visuelle Abnahme und Windows-Paket. Die neue Gestaltung ist durch einen Skillaufruf allein nicht abgenommen.

Bekannte Ausgangsgrenzen: CI-Wiederladen einer 1000-Block-Kette und ein zuvor sporadisch beobachteter VBS-Ausgabeverzug; siehe [Dateipfadprüfung](DATEIPFADE.md). Kein vollständiger Anwender-, Screenreader-, Installer- oder Updateabnahmetest behauptet.
