# Fachaufträge und Dateibesitz

Alle drei Fachagenten wurden tatsächlich parallel gestartet, nach dem ersten Repository- und Dokumentationsdurchgang auf `main` / `fa6b208`. Vollständige fachliche Anweisung und Übergabestand stehen zusätzlich in ihren Einzelberichten.

## Gemeinsame Anweisung

ScriptLab bleibt Electron/React/Blockly; Python ist Hauptsprache, VBS für vorhandene Grundfunktionen erhalten. Keine neuen Bausteine, Cloud, Module oder Bibliotheksmigration. Schema 3, stabile IDs/Verbindungen, Altprojektsprachen, eigenständiger Export und bewusste Ausführungsgrenze schützen. Ursachen reproduzieren, Kennung mit Ist/Soll/Repro/Priorität/Abnahme vor Korrektur melden. Kleine lokale Korrektur und Ergebnisprüfung mit synthetischen Daten. Kein Commit/Push/Index durch Fachagenten. Tests, geänderte Pfade, Grenzen und nächsten Schritt dokumentieren. Gemeinsame Dateien nur beim Hauptagenten.

## Bedienung (Produkt / UX / Frontend)

Auftrag: konkrete Hürden in Dialog-/Menü-/Feldbedienung und vorhandenen Parameter-/Export-/Spaltenansichten untersuchen. Kontext: React 19.3.1, vorhandenes ScriptLab-Designsystem, keine neue Bibliothek. Erstbefund unbekannt, ausdrücklich zuerst reproduzieren. Schreibbesitz: `src/renderer/komponenten/{Dialog,Menue,Feld}.tsx`, `src/renderer/{ParameterDialog,ExportDialog,SpaltenAuswahl}.tsx`, `tests/desktop/qualitaet-bedienung.spec.ts`, `tests/qualitaet-bedienung.test.ts`, `docs/qualitaet/agent-bedienung.md`. Globalstyles, Tokens und Navigation ausgeschlossen. Abnahme: reale Windows-UI mit langen Texten, 1280×720, Themen, Fokus/Tastatur; dist-Build mit Hauptagent abstimmen. Ergebnis: UX-01 nur bei bestätigter Reproduktion korrigieren.

## Ausführung (Bausteine / Python / ausdrücklich VBS / Leistung)

Auftrag: Grundblockverträge und Generator-/Test-/Exportübergänge einschließlich Prozesszuständen prüfen; belegte falsche Ergebnisse oder vermeidbare Belastung lokal beheben. Kontext: Node 24.19, feste Windows-Hosts und Jobobjekt, gleiches geprüftes Zwischenmodell. Schreibbesitz: `src/kern/{generator,python-generator,python-helfer,skript}.ts`, `src/windows/testlauf.ts`, `tests/qualitaet-ausfuehrung.test.ts`, `tests/windows/qualitaet-ausfuehrung.test.ts`, `docs/qualitaet/agent-ausfuehrung.md`. Keine freien Shellschnittstellen, IPC-/Formatänderungen. Abnahme: tatsächliche Windows-Ergebnisse und Fehlerfälle beider Sprachen; Leistung nur mit identischen Vorher-/Nachherfällen; VBS nicht auslassen. Gefundener Schwerpunkt RUN-01, kein spekulativer Prozessumbau.

## Geschäftsdaten / Dokumente / Leistung

Auftrag: vorhandene Daten-, Datei- und Dokumentoperationen mit unabhängigen Sollwerten auf stille Fehler und Originalverlust prüfen. Kontext: DuckDB, openpyxl, python-docx, ReportLab, pypdf, gebündeltes Python 3.15.2. Schreibbesitz: `laufzeit/scriptlab_business/{daten,dateien,dokumente}.py`, `tests/business/test_qualitaet.py`, `docs/qualitaet/agent-businessdaten.md`. Andere Laufzeit-/TS-Verträge ausgeschlossen. Reproduktion vor Korrektur; führende Nullen/NULL/Dezimalwerte, Zielkonflikte und Teilergebnisse berücksichtigen. Keine OCR-/Formelberechnungsbehauptung. Abnahme: neue Dateien mit Bibliothek erneut lesen, bekannte Sollinhalte sowie unveränderte Originale prüfen; DATA-01/02 priorisiert.

## Unabhängige Qualitätssicherung

Nach Abschluss eines Fachpakets erhält ein anderer freier Fachagent einen ausschließlich lesenden Reviewauftrag für Annahmen, Diff und unabhängige Ergebnisnachweise. Der Hauptagent prüft und testet alle integrierten Pakete erneut. Ein Agentenbericht ersetzt weder Integration noch Testausführung.
