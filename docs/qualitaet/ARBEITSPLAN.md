# Begrenzter Qualitätsdurchgang

Priorität: stille Ergebnisveränderungen zuerst, danach blockierte umfangreiche Workflows, vermeidbarer Listenaufwand und ein belegter Tastaturfehler. Kein neues Geschäftsfeature. Neue Produktideen gehören in den vorhandenen Backlog `docs/UMSETZUNG.md`.

| Kennung / Priorität | Ausgang / Reproduktion / Ist | Erwartung und Abnahme | Zuständigkeit / Dateien |
|---|---|---|---|
| DATA-01 / P1 | XLSX-Vorlage erhält 32768 Zeichen; openpyxl kürzt still auf 32767 und der Lauf meldet veröffentlicht | Fehler vor Veröffentlichung, Ziel und Vorlage erhalten; unabhängiges Readback und Grenzwerttest | Businessdaten; `dokumente.py`, `tests/business/test_qualitaet.py` |
| DATA-02 / P1 | Positionswert `{{Kunde}}` in Word wird durch die folgende allgemeine Ersetzung nochmals ausgewertet | Eingesetzte Werte bleiben Daten; Einmalersetzung auch bei verbundenen Zellen/geteilten Kopfzeilen prüfen | Businessdaten; dieselben Dateien |
| SCALE-01 / P2 | Flache Kette mit 151+ Schritten trifft auf Tiefengrenze, obwohl der Editor bis 2000 Blöcke anbietet; Pretty-JSON kann bei langen Ketten zusätzlich das 5-MiB-Budget verbrauchen | Echte Verschachtelung und Blockzahl begrenzt lassen; flache zulässige Ketten speichern/laden/generieren; Größen vor/nach messen und echte Editorwege prüfen | Hauptagent; `projekt.ts`, `dateien.ts`, ggf. Ablage, gezielte neue Projekt-/Desktoptests |
| RUN-01 / P2 | Jeder Listenindexzugriff kopiert in Python/VBS zuerst die gesamte Liste | Gleiche Ergebnisse, Fehler und Kopiersemantik mit Kopie nur des gewählten Eintrags; identische Windows-Messfälle vor/nach | Ausführung; `python-helfer.ts`, `generator.ts`, neue Regressionen |
| UX-01 / P2 | Arbeitshypothese: Tastaturfokus in scrollbarem Menü bleibt bei großem Text außerhalb des sichtbaren Bereichs | Erst echte Reproduktion, dann lokales Nachscrollen; Tastatur, Fokus, Themen und kleines Fenster prüfen | Bedienung; `komponenten/Menue.tsx`, gezielter Desktoptest |
| QA-01 / P2 | Zwei vorbestehende Fehltests durch alten Titel / zu breit untersuchten vollständigen Bericht | Sprachwahlvertrag und sichtbare Ergebnisbegrenzung weiterhin streng prüfen, vollständigen Bericht ausdrücklich berücksichtigen | Hauptagent; die zwei bestehenden Testdateien |

## Integration und Abhängigkeiten

Gemeinsamer Arbeitsbaum mit strikt getrennten Schreibbereichen. Nur Hauptagent: Projektformat/-prüfung, zentrale Typen, IPC, `Anwendung.tsx`, Navigation, globale CSS/Tokens, Abhängigkeiten, allgemeine Dokumentation und Git. Fachagenten ändern ausschließlich ihre in [AGENTEN.md](AGENTEN.md) bezeichneten Bereiche; keine parallelen Indexänderungen. Kritische fachliche Änderungen erhalten einen zusätzlichen unabhängigen Review. Build und Desktoptests werden abgestimmt; am integrierten Stand erneut prüfen.

Pakete: (1) Bestand und Plan, (2) Dokumentwerte, (3) Projektumfang, (4) Listenverarbeitung, (5) Menütastatur und Abschlussnachweise. Tatsächliche Reihenfolge richtet sich nach abgeschlossener Prüfung. Jeder abgeschlossene Schritt erhält deutschen Commit und Push auf `origin/main`; zugehörige CI bleibt sichtbar. Keine Tags, Releases oder SaaS-Bereitstellung.
