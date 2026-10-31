# Automatisierungen bauen und ausführen

Ausgangsstand: `ca845d91bbfce8a2e8ba9ca3bf8a9dfe3e3047bd`, Branch `main`, sauberer Arbeitsbaum. Windows, React 19, Blockly 13, Electron 45. Anschluss an [UI-Neuaufbau](UI-NEUAUFBAU.md). Nutzerwunsch: technische Oberfläche reduzieren, Löschen auffindbar machen, Einstellungen und Hilfe verbessern.

## Befunde und Abnahme

| ID | Ausgangszustand / Reproduktion | Auswirkung und Abnahme |
| --- | --- | --- |
| E-01 | Workflow öffnen → Ansicht → Codevorschau; Sprachbadge und Quelltext stehen gleichberechtigt neben der eigentlichen Automatisierung. | P2: unnötige Fachbegriffe. Der normale Editor zeigt Bausteine, Eingaben und direkte Ausführung; Codeerzeugung und eigenständiger Export bleiben intern erhalten. |
| E-02 | Läufe öffnen: Vorbereitung, Übersicht, Ergebnisse, Protokoll sowie Lauf-ID, Standkennung, Quelltext, Exitcode. | P2: Ergebnisse müssen gesucht werden. Ein verständliches Ergebnis bündelt Status, Ausgaben und Fehler; Einstellungen nur bei Bedarf, Verlauf bleibt getrennt. |
| E-03 | Datenvorschau laden → Herkunft / Spaltenbreiten: Hash, Lauf-ID, Bytebudget und Pixelwerte. | P2: technische Nebenaufgaben verdrängen Daten. Daten, Suche, Umfang und tatsächliche Veraltung bleiben sichtbar; interne Kennungen entfallen. |
| E-04 | Baustein auswählen: Löschen hauptsächlich über Tastatur bzw. Eigenschaften. | P1: Bearbeitung schwer auffindbar. Sichtbares Löschen, Undo und Schutz während laufender Prozesse; keine versteckte Canvas-Löschung in anderen Arbeitsbereichen. Entwürfe eindeutig löschbar, Entfernen aus Bibliothek ausdrücklich von Dateilöschung unterscheiden. |
| E-05 | Einstellungen öffnen: Komponenten-/Paketdetails und technische Laufzeitbegriffe. | P2: verständliche Gruppen Aussehen, Automatisierungen, Updates mit klaren Aktionen und echtem Status; kein automatischer Download. |
| E-06 | Hilfe öffnen: generische Referenz statt konkreter Aufgaben. | P2: aufgabenbezogene Einstiegskarten, kurze Schritte und Fehlerhilfe zum vorhandenen Produkt; Tastatur, große Schrift und Themen geprüft. |

## Fachaufträge und Schreibbereiche

Gemeinsamer Arbeitsbaum, ausschließlich Hauptagent führt Git, Builds und GUI-Prüfungen aus. Keine parallelen Änderungen zentraler Dateien. Projektformate, Block-IDs, Python/VBS-Generatoren und Ausführungsschnittstellen bleiben erhalten. Keine neue UI-Bibliothek; vorhandene Komponenten und Petrol-Tokens, Skill UI/UX Pro Max. Kein verstecktes Ausführen beim Navigieren.

- **ausfuehrung:** `Testbereich`, `Laufverwaltung`, `LaufKurzansicht` mit ihren CSS und eigenen Tests. E-02 anhand der tatsächlichen Zustandsmaschine umsetzen. Ausgabe/Fehler/Dateiergebnisse zusammenführen; technische Details entfernen. VBS ausdrücklich mitprüfen. Stop-Anforderung bleibt vom tatsächlichen Ende getrennt. Fehlende Löschschnittstelle im Laufarchiv melden, keine Scheinaktion bauen. Dateien, Modultests und nötige GUI-Anpassungen zurückmelden.
- **bedienung:** `EinstellungenDialog`, `einstellungen-laufzeit.css`, gegebenenfalls `MlLaufzeit`, eigene Tests. E-05: notwendige Einstellungen funktional gruppieren, Paket-/Pfaddiagnostik aus dem normalen Weg nehmen. Installation bleibt bewusst gestartet/abbrechbar, Status wahrheitsgemäß. 1280 × 720, 200 % Schrift, beide Themen. Anschließend unabhängiger Review der Laufansicht.
- **businessdaten:** `Startbereich`, zugehörige Styles, `hilfe.ts`, neue Hilfe-Komponente und eigene Tests. E-06: konkrete Schritte zum Bauen, Dateien verwenden, Ausführen, Ergebnisse verstehen und Fehler beheben. E-04 in Bibliothek/Entwürfen prüfen; vorhandene Schnittstellen nutzen, keine heimliche Dateilöschung. Technische Metadaten reduzieren, Öffnen/Weiterbearbeiten erhalten.
- **Hauptagent:** `Anwendung`, Datenvorschau, zentrale Navigation, Exporttexte, Dokumentation, Integration. E-01/E-03 sowie sichtbares Bausteinlöschen. Fremde Änderungen erhalten, passende Modul-/Desktopprüfungen, unabhängigen Review einarbeiten, kleine deutsche Commits und Pushes. Paketprüfung bei fertigem Stand.

## Prüfprotokoll

Die letzte dokumentierte Abnahme gehört zum Ausgangsstand; sie ist kein Nachweis für diesen Durchgang. Neue Ergebnisse werden hier ergänzt. Keine Leistungsverbesserung behauptet. Synthetische Workflows und isolierte Testprofile; keine Unternehmensdateien.
