# Prüfstand der vereinfachten Bedienung

31. Oktober 2026, Branch `main`, Ausgang `ca845d9`. Fachaufträge, Befunde und Abnahmebedingungen: [Arbeitsplan](EINFACHE-BEDIENUNG.md). Der geprüfte Arbeitsstand umfasst die automatische Ausgabe aus `9876dfa` und die anschließende UI-Änderung. Paket- und Pushnachweise folgen als eigener abgeschlossener Schritt.

## Umgebung

Windows 11 Pro 25H2, Build 26200.9457; Node 24.19.0, Electron 45.0.0, React 19.3.1, Blockly 13.4.0, TypeScript 7.0.2, Vitest 5.0.5 und Playwright 1.64.1. App-Python 3.15.2; unabhängige Business-Dateiprüfung mit Python 3.12.6, DuckDB 2.0.0 und openpyxl 3.1.5. Isolierte Testprofile und synthetische Daten, keine Unternehmensdateien.

## Ausgeführte Prüfungen

| Prüfung                        | Status und Nachweis                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typprüfung, Format, Diff       | **Bestanden:** `npm run check`, Prettier für geänderte TS/TSX/CSS/MJS-Dateien und `git diff --check`. Kein eigenes Lint-Skript vorhanden.                                                                                                                                                                                                              |
| Build                          | **Bestanden:** `npm run build`; vorhandener Hinweis auf großes Renderer-Bündel bleibt. Keine gemessene Leistungsverbesserung behauptet.                                                                                                                                                                                                                |
| Vollständige Modulsuite        | **Fehlgeschlagen:** `npm test -- --reporter=json --outputFile=artifacts/einfach-module-abschluss.json`: 813 bestanden, ein VBS-Host-Zeitlimit, 84 bedingt übersprungen. Ein früherer Zwischenstand hatte 811/0/84.                                                                                                                                     |
| Gezielte Modulnachprüfung      | **Bestanden:** 28 Fälle in `qualitaet-ausgabeziele`, `ergebnisansicht`, `testbereich`; darunter derselbe unveränderte VBS-Kurznamenfall. `artifacts/einfach-module-nachpruefung.json`. Nach letzter Hilfekorrektur zusätzlich 13 gezielte Hilfetests bestanden. Überlappende Läufe nicht addieren.                                                     |
| Automatische Dateiziele        | **Bestanden:** neun echte Python-Dateifälle (`python -B -m unittest discover -s tests/business -p test_automatisches_ausgabeziel.py -v`, PYTHONPATH=`laufzeit`). Unabhängige XLSX-Rücklesung, führende Nullen, Umlaute, Originalschutz, Wiederholungen, mehrere Quellen, Arbeitsordner, explizite Ziele, ungültige Werte und leere Parameterbindungen. |
| Vollständiger Desktopdurchgang | **Fehlgeschlagen:** `npm run test:e2e`: 142 bestanden, 22 fehlgeschlagen, drei ausdrücklich übersprungen, zwei serielle Folgefälle nicht ausgeführt; 12,8 Minuten. `artifacts/einfach-desktop-gesamt.json`.                                                                                                                                            |
| Betroffene Desktopbereiche     | Nach Korrekturen 72 Fälle: 67 bestanden, fünf Testannahmen noch falsch. Danach **9/9 bestanden** einschließlich dieser fünf, Hilfe und des zuvor in CI fehlgeschlagenen Themenwechsels. Berichte `einfach-desktop-nachpruefung.json` und `einfach-desktop-abschluss.json`.                                                                             |
| Eindeutige Desktopfälle        | **166 bestanden, drei übersprungen**, jeweils letzter Nachweis pro Dateiname/Testaufgabe. `artifacts/einfach-desktop-abgleich.json`. Das ist ein Abgleich mehrerer Arbeitsstände, kein weiterer vollständiger grüner Gesamtlauf.                                                                                                                       |

Die gezielten Desktopdateien waren `anwendung`, `business-ui`, `business-zustaende`, `testlauf`, `ux`, `ziehen`, `einfache-bedienung`, `python-ui`, `laufdesign` und `testlauf-ui`; die letzte Auswahl ergänzte `gestaltung-navigation` und `startseite`. Ausführung jeweils `npx playwright test <Dateien>`, ein Worker. Keine Testfristen erhöht und keine fachlichen Sollwerte an fehlerhafte Ergebnisse angepasst.

## Nachgewiesenes Verhalten

- CSV → XLSX ohne Ausgabepfad startet durch einen Headerklick. openpyxl liest unabhängig exakt die erwarteten drei Zeilen einschließlich `001`, `Müller` und `12.50`. Die Quellbytes bleiben gleich. Nach Schließen von Electron erzeugt der über die UI exportierte ZIP-Workflow dieselben Werte eigenständig.
- Sichtbares Bausteinlöschen und Rückgängig erhalten IDs und Tabellenzuordnung. Entfernen aus der Workflowliste erhält die Projektdatei. Entwürfe sind löschbar; für archivierte Läufe gibt es keine Löschschnittstelle.
- Direktstart verwendet den ungespeicherten Editorstand. Stoppen, Zeitlimit, tatsächliches Ende, Fehlerzuordnung, Startschutz, erhaltene Ausgaben und Prozessende beim Schließen wurden mit Python/VBS geprüft. Kopieren während eines echten Laufs erhält eine bewusst gewählte Leseposition; das Protokoll muss dabei tatsächlich scrollbar sein.
- Exportprüfungen lesen echte Dateien und deren Kodierung. Das Entfernen der Codevorschau ersetzt diese Nachweise nicht durch reine CSS- oder Aufrufprüfungen.
- 1280 × 720 und 1600 × 1000, Prozess-DPI 100/125/150/200 Prozent, UI-Schrift 100/200 Prozent, hell/dunkel/System, Tastatur und sichtbarer Fokus wurden in den jeweiligen Fällen geprüft. Die Screenshots für Hilfe, Einstellungen und XLSX-Ergebnis wurden visuell kontrolliert und in README eingebunden.
- Alle fünf Dragfälle bestanden nach E-08: feste Canvasposition, native Einfügemarker, Verbindungen, Escape und Rückgängig/Wiederholen. Lokale 601er- und 1.000er-Workflowfälle bestanden im breiten Lauf; die unten genannte CI-Grenze bleibt bestehen.

## Gefundene und korrigierte Integrationsfehler

Die Eigenschaften überdeckten den Schließenknopf der Exportmeldung; deren Breite berücksichtigt nun die Seitenfläche. Der neue Löschknopf veränderte beim Aktivieren die Toolbarhöhe. Zusammen mit einer Größenanpassung während des Palettendrags verschob dies die Arbeitsfläche (36 Pixel vertikal, 212 horizontal). Stabile Knopfgeometrie und verzögerter Größenabgleich beheben den reproduzierten Fall.

Weitere Fehlschläge betrafen alte UI-Namen, nicht sichtbare Knöpfe in geschlossenen Details und veraltete Laufansichtstexte. Die Tests öffnen jetzt die echte Ergebnisweitergabe. Die Scrollmessung wartet auf die tatsächlich dargestellte Ausgabe statt nur auf Main-Daten. Der Exportvergleich wartet auf den gespeicherten Canvaszoom; ausschließlich der Abgleich mit der SVG-Float32-Matrix toleriert deren Rundung, der anschließende Projektvergleich bleibt exakt. Stopphinweise werden nach bestätigtem Abbruch geprüft. Der Python-UI-Test wartet vor Profilbereinigung auf das Ende seines Electron-Prozesses.

Unabhängige Quellreviews durch die Fachagenten betrafen Ergebnis-/Stopzustände, Originalindizes beim Dateipaging, Autoziele und Resize-Verhalten. Dabei wurden zusätzlich leere Variablenbindungen abgesichert, der Observer bei später erscheinender Ausgabe angebunden und vorhandene Blockly-Ereignisgruppen beim Löschen erhalten. Reviews ersetzen keine Laufnachweise.

## Offene Grenzen

- Die drei übersprungenen Desktopfälle sind zwei Millionenzeilenlastfälle und die echte optionale ML-Offlineinstallation. Kein neuer vollständiger ML-Trainingsnachweis in diesem UI-Durchgang.
- Der VBS-Kurznamenfall erreichte im Gesamtlauf sein unverändertes Zehn-Sekunden-Zeitlimit und bestand im Nachlauf. Ursache offen; vorhandene [VBS-Anschlussaufgabe](../UMSETZUNG.md) bleibt gültig.
- CI von `9876dfa`, [Lauf 41153578393](https://github.com/siggismalz/ScriptLab/actions/runs/41153578393): Typprüfung, native Businessfälle, Module und Build bestanden; Desktop 160 bestanden, zwei fehlgeschlagen, drei übersprungen. Fehler: Persistenz des Systemthemas und bekannter intermittierender Reload einer linearen 1.000er-Kette. Der lokale Themenfall bestand erneut; eine Ursachenbehebung ist nicht belegt. Kein verlässlich unbegrenzter Editor und keine Leistungssteigerung zugesichert.
- Keine Anwenderstudie oder Screenreaderabnahme. Installation, Deinstallation, Signatur und reale Updatekette müssen getrennt nachgewiesen werden. Keine neue Releaseveröffentlichung.
