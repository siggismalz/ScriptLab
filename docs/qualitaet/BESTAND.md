# Bestandsaufnahme am 30. Oktober 2026

Ausgang: `main`, `fa6b208693df72de93467e6d6f169b3de24a46a6`, sauberer Arbeitsbaum. Remote: `https://github.com/siggismalz/ScriptLab.git`, gleicher Remote-Stand bestätigt. Keine AGENTS.md im Projekt oder direkt übergeordneten Nutzerordner gefunden. Bestehende Arbeit wird erhalten; nur der Hauptagent führt Git-Index, Commits und Pushes.

Windows x64, Node 24.19.0, npm 11.17.0. Paketdefinition und Lockfile stimmen bei den direkten Versionen überein: Electron 45.0.0, React 19.3.1, Blockly 13.4.0, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1. Die feste Python-Laufzeit 3.15.2 mit Tcl/Tk und elf Business-Paketen ist lokal vorhanden und beim Build manifestgeprüft.

## Verantwortlichkeiten im vorhandenen Code

| Bereich | Maßgebliche Dateien und Verbindungen |
|---|---|
| Einstieg / Navigation / Zustand | `src/main/hauptprozess.ts`, `src/preload/bruecke.ts`, `src/renderer/main.tsx`, `Anwendung.tsx`; React hält Navigation und den erhaltenen Blockly-Workspace, Main besitzt Dokument und Laufzustand |
| Bausteine / Palette / Eigenschaften | `src/kern/katalog.ts`, `business-katalog.ts`, `src/editor/bausteine.ts`, `bedienung.ts`, `src/renderer/Palette.tsx`, `Eigenschaften.tsx`, `BusinessEigenschaften.tsx` |
| Validierung / Modell | `src/kern/projekt.ts`, `modell.ts`, `business-modell.ts`, `business-validierung.ts`; Strukturprüfung vor Generierung, zusätzliche fachliche Laufzeitprüfung |
| Serialisierung / Migration / Ablage | `projekt.ts`: Schema 1 → VBS, Schema 2 → vorhandene Sprache, Schema 3 mit Business; `src/main/dateien.ts`, `projektablage.ts`: interne Workflows, Entwürfe, Hash-Konfliktschutz; unbekannte Inhalte werden abgewiesen |
| Generatoren | `src/kern/skript.ts` wählt `generator.ts` (VBS) oder `python-generator.ts` mit `python-helfer.ts`; gemeinsames geprüftes Modell, getrennte Export-/Testkontexte |
| Ausführung / Prozesse | `src/windows/testlauf.ts`, `scripts/laufzeit-host.cs`, `src/gemeinsam/testlauf.ts`; fester Host, Windows-Jobobjekt, Tokenereignisse, begrenzte Ausgabe; `laufablage.ts` speichert abgeschlossene Zustände |
| Geschäftsdaten / Dateien / Office / PDF | `laufzeit/scriptlab_business/{ausfuehrung,kontext,daten,dateien,dokumente,typen}.py`; DuckDB, openpyxl, python-docx, ReportLab, pypdf. Keine OCR und keine zugesicherte Excel-Formelberechnung |
| Vorschau / Parameter / Ergebnisse | `src/kern/datenvorschau.ts`, `src/renderer/Datenbereich.tsx`, `ParameterDialog.tsx`, `BusinessVorbereitung.tsx`, `BusinessErgebnis.tsx`, `Laufverwaltung.tsx`; bewusste Vorschau, Prüflauf und echte Ausführung getrennt |
| Export / Einstellungen / Laufzeit | `src/main/business-export.ts`, `dateien.ts`, `src/windows/{python,business-laufzeit,app-laufzeit,signatur,updates}.ts`, `ExportDialog.tsx`, `EinstellungenDialog.tsx`; eigenständige .py/.vbs/ZIP-Ausgaben |
| Gestaltung / Komponenten | `src/gestaltung/{tokens,blocklyThema,blockAuswahl}.ts`, `src/renderer/komponenten/`, bereichsbezogene CSS-Dateien; vorhandene Petrol-/Grün-/Grautokens und beide Themen weiterführen |
| Tests / Build / Installer / Update | `tests/**/*.test.ts`, `tests/business/*.py`, `tests/desktop/*.spec.ts`, `scripts/bauen.mjs`, `electron-builder.yml`, `.github/workflows/{windows-pruefung,release}.yml`; normale main-Pushes prüfen Windows, Releases nur per Tag/manuellem Releaseauftrag |

Die katalogbasierte Einzelauflistung steht in [BAUSTEINREGISTER.md](BAUSTEINREGISTER.md). Testreferenzen darin sind Suchhinweise, keine Behauptung einer vollständigen Prüfung sämtlicher Varianten.

## Beschreibungen und tatsächlicher Bestand

README, ENTWICKLUNG und WEITERENTWICKLUNG beschreiben die gebündelte Laufzeit und interne Ablage. Einzelne ältere Abschnitte von ARCHITEKTUR, VERSIONEN und KOMPONENTEN widersprechen dem neueren Code (externe Laufzeit, externe Pfadbasis, frühere Farben). Diese werden lokal berichtigt; ältere Abnahmeberichte bleiben historische Nachweise. Planung und Backlog in `docs/UMSETZUNG.md` und `docs/BUSINESS-PLAN.md` sind kein Implementierungsnachweis.

Vorhandene gemeinsame Komponenten reichen für die ermittelten lokalen Korrekturen. Es besteht kein belegter Anlass für einen Bibliothekswechsel; keine zusätzliche UI-Komplettbibliothek wird eingeführt. SaaS bleibt ein Anschlussziel, ohne Cloudneubau.

## Ausgangsprüfungen

- `npm run check`: **bestanden**.
- `npm test -- --reporter=json --outputFile=artifacts/qualitaet-basis-vitest.json`: **fehlgeschlagen**, 624 Fälle, 571 bestanden, 2 fehlgeschlagen, 51 übersprungen. Fehler: `sprachwahl.test.ts` erwartet alten Wortlaut; `business-ergebnis.test.ts` sucht ausgeblendete Ausgabeziele auch im ausdrücklich vollständigen technischen Bericht. Keine belegten Laufzeitfehler aus diesen beiden Erwartungen.
- `npm run build`: **bestanden**, Python-/Hostbestand geprüft; Vite meldet bestehendes großes JS-Bündel (ca. 1,5 MB unkomprimiert). Keine unbelegte Optimierungsbehauptung.
- Native optionale Tests, Python-Fachtests, Desktop, Last und Paketprüfung: zunächst **nicht ausgeführt**, folgen am integrierten Stand. Alte Nachweise zählen hierfür nicht.

Erfasst wurden wesentliche Bereiche und Übergänge. Keine Prüfung jeder Codezeile, jeder Bausteinkombination oder echte Anwenderstudie.
