# Karten in ScriptLab

30. Oktober 2026, Ausgang `main/9d3ed29`, sauberer Arbeitsbaum. Nutzerwunsch: Karten stärker in die vorhandene Oberfläche integrieren. Die zuvor gewünschte Trennung von globaler Navigation, Workflow und Details bleibt bestehen.

## Sichtbares Ergebnis

- **Start:** „Zuletzt geöffnet“ und vier Einstiege als zusammengehörige Flächen. Die Beschreibungen sind direkt sichtbar; Titel, tatsächliche Bestandszahlen und Navigationsaktionen bleiben erhalten.
- **Vorlagen:** auswählbares Raster mit Aufgabe, Sprache, Titel und erwartetem Ergebnis. Drei Spalten bei 1280 Pixeln, zwei bei 1100 Pixeln, eine bei 200 % Text. Die ausgewählte Karte zeigt genau eine Vorbereitung über die Rasterbreite. Erst die gesonderte Öffnenaktion erzeugt eine bearbeitbare Kopie.
- **Läufe:** Modus und Parametersatz bilden eine Karte. Bestätigte Laufzusammenfassung und vorhandene Ausgabedateien erhalten eigene Gruppen. Einzelne Einträge bleiben Listenzeilen, der vollständige Bericht bleibt erreichbar.

Gemeinsame Grundlage ist `src/renderer/komponenten/Karte.tsx` mit bestehenden Farb-, Abstands- und Radiustokens. Die Hülle erzeugt keine Klickaktion und keinen zusätzlichen Tabstopp. Beide Themen und sichtbarer Tastaturfokus bleiben erhalten. Eine zusätzliche UI-Bibliothek ist dafür nicht erforderlich. Projektformate, Blockly, Generatoren, IPC und Laufsteuerung werden in diesem Paket nicht geändert.

![Startseite mit Einstiegskarten](karten-ansichten/start-hell.png)
![Vorlagen als Raster](karten-ansichten/vorlagen-hell.png)
![Bestätigte Ergebnisse und Ausgabedateien](karten-ansichten/lauf-hell.png)

Die [dunkle Ergebnisansicht bei 200 % Text](karten-ansichten/lauf-dunkel-200.png) benötigt normalen vertikalen Bildlauf. Die Textgröße bleibt erhalten; Dateiaktion und Bericht sind erreichbar.

## Aufträge und Integration

Drei echte Fachagenten arbeiteten in getrennten Schreibbereichen. Die ausgefüllten Fachaufträge samt Grenzen, geschützten Verträgen, Abnahme und Übergabe stehen in ihren Berichten:

| Perspektive                       | Schreibbereich und Ergebnis                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Produkt/Frontend                  | `VorlagenBereich.tsx`, `vorlagen.css` und zugehörige Tests; [Vorlagenbericht](KARTEN-VORLAGEN.md).                                                                                         |
| Businessdaten/Ergebnisdarstellung | `BusinessVorbereitung.tsx`, `BusinessErgebnis.tsx`, abgegrenzte Regeln in `business.css` und zugehörige Units; [Laufbericht](KARTEN-LAEUFE.md).                                            |
| Unabhängige QA                    | Nur [Reviewbericht](KARTEN-REVIEW.md), Produktcode lesend. KAR-01: alte Home-Regeln hätten doppelte Rahmen und abweichende Maße erzeugt; Root korrigierte sie, der Reviewer prüfte erneut. |
| Root                              | Gemeinsame Karte, Home, Gestaltungssystem, integrierte Desktopprüfung einschließlich realem CSV-Lauf, Sichtkontrolle, Windows-Paket und ausschließlich Git/Push.                           |

## Tatsächlich ausgeführte Prüfungen

Windows 11 x64 Build 26200, Node.js 24.19.0, Electron 45.0.0, React 19.3.1, Vitest 5.0.5, Playwright 1.64.1. Isolierte temporäre Profile und synthetische Daten. Keine echten Unternehmensdateien. Produktstand entspricht den drei unten genannten UI-Commits; Dokumentation folgt separat.

| Befehl / Nachweis                                                                                                                                                                                                                                                                  | Ergebnis                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                                                                                                                                                                                                                                                    | **Bestanden**, auch nach Erweiterung der Business-Desktopfälle.                                                                                              |
| `npx vitest run tests/startbereich.test.ts tests/gestaltung.test.ts tests/vorlagen-bedienung.test.ts tests/business-ergebnis.test.ts tests/business-formular.test.ts tests/laufpfade.test.ts --reporter=json --outputFile=artifacts/karten-module-integriert.json`                 | **123 bestanden**, keine Fehler oder Skips.                                                                                                                  |
| `npx playwright test tests/desktop/karten-start.spec.ts tests/desktop/startseite.spec.ts tests/desktop/gestaltung-navigation.spec.ts tests/desktop/business-ui.spec.ts tests/desktop/business-zustaende.spec.ts --reporter=list,json --output=artifacts/karten/desktop-integriert` | **49 bestanden**, keine Fehler oder Skips; 138,65 s. Enthält den ursprünglichen einzelnen CSV-Desktopfall.                                                   |
| `npx playwright test tests/desktop/vorlagen-bedienung.spec.ts --reporter=list --output=artifacts/karten/vorlagen-tests-final`                                                                                                                                                      | **5 bestanden**, keine Fehler oder Skips; separat vom Fachagenten ausgeführt.                                                                                |
| `npx playwright test tests/desktop/business-ui.spec.ts --reporter=list,json --output=artifacts/karten/desktop-business-karten`                                                                                                                                                     | **2 bestanden**, keine Fehler oder Skips; 18,93 s. Nach Erweiterung des CSV-Falls für Hell/100 % und Dunkel/200 %, mit benannten Karten und Ergebnisbildern. |
| Prettier aller geänderten TS-/CSS-Dateien, `git diff --check`                                                                                                                                                                                                                      | **Bestanden**. Kein gesondertes Lintskript vorhanden.                                                                                                        |
| `npm run build`                                                                                                                                                                                                                                                                    | **Bestanden**; bekannte große JavaScript-Datei von rund 1,512 MB bleibt als Buildwarnung sichtbar.                                                           |
| `npx electron-builder --win nsis --x64 --publish never --config.directories.output=release/karten-0d660d7`                                                                                                                                                                         | **Bestanden**, lokaler unsignierter Testinstaller.                                                                                                           |
| `npm run verify:package -- release/karten-0d660d7`                                                                                                                                                                                                                                 | **13 bestanden**, keine offenen oder fehlgeschlagenen Paketprüfungen am damaligen Dokumentationsstand.                                                       |
| `node scripts/qualitaet-paket-pruefen.mjs release/karten-0d660d7/win-unpacked/ScriptLab.exe artifacts/karten/paket-smoke.json`                                                                                                                                                     | **Bestanden**, entpackte paketierte Anwendung, isoliertes Profil, gebündelte Python-/Business-Laufzeit und tatsächlicher synthetischer Workflow.             |

Der CSV-Nachweis erhält führende Nullen und beide Sollzeilen (`001;Nord;100`, `002;Süd;80`). Vorschau und Prüflauf erzeugen keine Zieldatei; erst die echte Ausführung schreibt sie. Quelle bleibt bytegleich. Der bestehende ZIP-Export funktioniert weiterhin. Start-/Vorlagenwechsel lassen Projektinhalt und Lauf-ID unverändert. Tatsächlich betrachtet wurden normale helle Ansichten sowie dunkle Karten bei 200 % Text; die ergänzenden Themen-/Größen- und Prozess-DPI-Prüfungen liefen automatisiert. Dies ersetzt keine Anwenderstudie oder vollständige Barrierefreiheitsprüfung.

Die Zahlen sind getrennte Prüfungen mit teilweise überlappenden Fällen, keine neue Gesamtabnahme. Eine Leistungsverbesserung wird nicht behauptet. Die vollständige Python-/VBS-Fachabnahme wurde für diese reine Darstellung nicht erneut ausgeführt.

## Git und verbleibende Grenzen

Alle drei fachlichen Schritte wurden auf `origin/main` erfolgreich gepusht:

- `8ea4276` – Startseite mit gemeinsamen Karten übersichtlicher gestaltet.
- `6f010b6` – Vorlagen als auswählbare Karten angeordnet.
- `0d660d7` – Laufvorbereitung und Ergebnisse mit Karten gegliedert.

Die neuen Windows-CI-Läufe sind bei dieser Dokumentation noch **ausstehend**. Der [Ausgangslauf für 9d3ed29](https://github.com/siggismalz/ScriptLab/actions/runs/41127968411) war bereits fehlgeschlagen: sporadisch gespeicherter Farbwert `hell` statt gewähltem `system` und die bekannte Bereitschaftsüberschreitung beim erneuten Laden einer linearen 1000er-Blockkette. Der entsprechende Navigationstest besteht lokal im 49er-Durchgang; damit ist die frühere CI-Abweichung noch nicht ursächlich behoben. Keine Grenze oder Assertion wurde zur Grünfärbung entfernt. Der [unabhängige Review](KARTEN-REVIEW.md) hält die Nachprüfung getrennt fest.

Der Installer wurde nicht installiert, veröffentlicht oder als Update ausgeliefert. Paket-Smoke und Inhaltsprüfung belegen keine vollständige Installer-/Updateabnahme. Die nachfolgenden Berichtsbilder und Abschlussdokumente sind nicht Bestandteil dieses bereits geprüften Testpakets; sein Produktcode ist der vollständig integrierte Kartenstand `0d660d7`.
