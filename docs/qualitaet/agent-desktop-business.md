# QA-04: Business-Desktopprüfungen an den vorhandenen Produktstand anpassen

## Initialauftrag und Arbeitsgrenzen

**Rolle:** Fachagent Geschäftsdaten/Qualitätssicherung. Die bestehenden Desktopprüfungen für Businessabläufe, Projektzustände und optionale Millionenlasten an tatsächlich vorhandene Navigation und Ablage anpassen. Keine Produktänderung vornehmen und keine fachlichen Erwartungen abschwächen. Produktbasis bei Auftrag: `3bf7da6`, vorhandener Build mit geprüfter großer Workflowübertragung; neue SCALE-/UX-Prüfungen und Python-/Modulprüfungen waren vom Hauptagenten separat ausgeführt.

**Bekannte Befunde:** Der angefangene vollständige Desktoplauf des Hauptagenten fand überholte Erwartungen an direkte `Neu`-/`Öffnen`-/`Projektmenü`-Schaltflächen und native Speicherdialoge. Der aktuelle Editor verwendet das Menü `Workflow`, interne Speicherung unter `Workflows/<UUID>.scriptlab` und einen vom Main verwalteten Arbeitsordner. Ein externer Ausgabeort wird beim Export gewählt. Nach Einfügen eines Blocks öffnen dessen Eigenschaften bereits automatisch.

**Schreibbereich:** Ausschließlich `tests/desktop/business-ui.spec.ts`, `business-zustaende.spec.ts`, `business-last.spec.ts` und dieser Bericht. Gemeinsame Navigationshelfer `ansichten.ts`/`sprache.ts` gehören dem Hauptagenten; notwendige Ergänzungen wurden angefordert, nicht parallel dort geschrieben. Kein Build, keine Produktcodeänderung, keine Git-Indexoperation, kein Commit/Push durch diesen Fachagenten. Andere Agenten prüfen disjunkte Desktopdateien mit eigenen Profilen.

**Geschützte Verträge:** Fachliche Sollwerte und unveränderte Originale; keine Zieländerungen in Vorschau/Prüflauf; bewusster Start; Abbruch/Fortsetzen und tatsächlich ausgeführter ungespeicherter Stand. Keine Tests auf falsche Ergebnisse umstellen. Eine erkannte Produktabweichung zuerst melden. Optionale Millionenlasten behalten `SCRIPTLAB_LAST_TESTS=1` als ausdrückliche Ausführungsvoraussetzung; keine parallele Lastmessung. Neue Bilder ausschließlich unter `artifacts/qualitaet-desktop`, historische Galerien unverändert lassen.

**Arbeitsschritte/Abnahme:** Aktuelle Bedienung und Bindungen aus Renderer/Main lesen. Überholte Selektoren durch genaue Rollen und vorhandene Navigationshelfer ersetzen. Synthetische Daten im tatsächlich verwalteten Workflowordner ablegen; externe Originale daneben erhalten. Normale Businessdateien mit isolierten Profilen ausführen, optionale Lastdatei statisch prüfen. Produktfehler unverändert sichtbar halten. Bericht mit tatsächlichen Befehlen, Ergebnissen, offenen Grenzen und nächstem Integrationsschritt zurückliefern.

## QA-04 / P2: Tests prüfen veraltete Bedien- und Ablageverträge

**Reproduktion und Ist:** Alte Tests suchen unter anderem `Projektmenü`, direkte Editoraktionen `Neu`/`Öffnen`, den früheren Sprachauswahltitel und frei wählbare Laufbasisordner. Sie warten beim normalen Speichern auf einen nativen Dateidialog und lesen Ausgaben neben der externen Projektdatei. Nach dem Einfügen schließen zusätzliche Klicks auf `Eigenschaften` den bereits geöffneten Bereich. `getByLabel('Dateipfad')` trifft sowohl die beschriftete Fehlergruppe als auch deren Eingabefeld und ist deshalb mehrdeutig.

**Erwartung:** Tests bedienen den vorhandenen Editor wie Nutzer und prüfen dessen gegenwärtige, dokumentierte Verträge. Die fachlichen Ergebnisse bleiben identisch. Betroffene Nutzeraufgaben: Quelle konfigurieren, speichern/exportieren, Vorschau und Prüflauf gegenüber echter Ausführung unterscheiden, Vorlagenkopie wieder öffnen, Entwurf fortsetzen und bei Skalierung alle wichtigen Aktionen erreichen.

**Umgesetzt:**

- Vorhandene Helfer für Workflowmenü, Arbeitsbereiche, Laufeinstellung, bewussten Start, Einstellungen und Sprachwahl verwendet. Verdeckte erweiterte Felder werden über ihre tatsächlichen `details` geöffnet. Rollen unterscheiden Textfeld/Auswahl von der zugehörigen Fehlergruppe; keine beliebigen `.first()`-Auswahlen.
- Der CSV-Fall speichert intern, liest Schema 3 tatsächlich wieder ein und verwendet die vom Hauptprozess gemeldete Laufbasis. Vorschau und Prüflauf dürfen weiterhin keine Ausgabedatei erzeugen. Die echte Ausgabe wird vollständig auf beide Zeilen `001/Nord/100` und `002/Süd/80` gelesen; die Quellbytes bleiben erhalten. Der Business-Paketexport muss weiterhin eine tatsächliche ZIP-Datei schreiben.
- Die Vorlagenprüfung trennt abgebrochenen Projektdateiexport, interne Speicherung ohne Dateidialog und externe Exportkopie. Anschließend wird das intern gespeicherte Original wieder geöffnet, damit die Workflowidentität erhalten bleibt. Ein Reimport einer separaten Exportdatei mit bereits registrierter Kennung ist laut vorhandenem Index eine eigene Identität und daher kein geeigneter Ersatz für diesen Wiederöffnungstest. Pfade, Block-IDs, DOCX-/XLSX-Vorlagenbytes, externe Exportdatei und interne Quelldatei werden weiterhin geprüft.
- Größenprüfungen erreichen Neu/Öffnen über das sichtbare Workflowmenü und prüfen weiterhin die Mindestzielgröße und Fenstergrenzen. Sprachtastatur und Abbrechen bleiben echte UI-Interaktionen. Prozess-DPI bleibt ausdrücklich von Windows-Systemskalierung und UI-Textgröße getrennt.
- Die optionale Millionenlast verwendet künftig ebenfalls den vom Main gemeldeten Arbeitsordner und eine eigene Kopie der synthetischen Quelle. Sowohl verwaltete Quelle als auch externes Original müssen denselben Hash behalten. Fachliche Sollausgabe `Nord / 500000 / 1000000`, Editorstandhash, Stopp/Exitcode, erhaltene Ergebnisse, unabhängige gespeicherte Fixture sowie bestehende Zeit-/Bedienbudgets bleiben erhalten. Canvasverschiebung folgt dem vorhandenen Menü statt einer entfernten direkten Schaltfläche.

## Weitergeleiteter Produktbefund UI-04 / P2

Die unveränderte Höhenprüfung meldete nach erfolgreicher Testmigration bei 200 % UI-Textgröße in **beiden** Fenstergrößen `Datenvorschau (Höhe)`. Eine gezielte Wiederholung bestätigte **2/2 fehlgeschlagene Fälle**. Das ist ein zusätzlich aufgedeckter Produktbefund und wurde nicht durch Änderung der Testerwartung verborgen.

Die Datenvorschau-Schaltfläche ist ein direktes Kind der Flexspalte `.panel-inhalt`. Bei 28 px Schrift und 42 px Zeilenhöhe stauchte `flex-shrink: 1` die natürliche Schaltflächenhöhe auf 36 px. Messung: 34 px Clienthöhe, 38 px Scrollhöhe. Dies lässt der skalierten Textzeile nicht ihren vorgesehenen Raum. Die tatsächlichen Bilder und gemessenen Werte stehen unter `artifacts/qualitaet-desktop/BizStates/layoutbefund-1280x720.{png,json}` und `layoutbefund-1600x1000.{png,json}`.

**Root-Korrektur und unabhängiger Review:** Der Hauptagent ergänzte ausschließlich `flex-shrink: 0` für `.schritt-vorschau` in `src/renderer/produkt.css` und baute neu. Die gemeinsame Buttontypografie, natürliche Höhe und bestehende Scrollfläche bleiben dadurch maßgeblich; keine festen Sondermaße oder neue Komponente. Der Diff und die Ursache wurden vom Fachagenten unabhängig gelesen. Die Änderung betrifft weder Workflowdaten noch Lauf-/Exportverträge. Die bestehenden beiden Prüfungen bestanden danach unverändert; zusätzlich protokollierte Maße: **52 px Gesamthöhe, 50 px Client-/Scrollhöhe, 42 px Zeilenhöhe, flex-shrink 0**, in beiden Fenstern. Es wird keine Leistungsverbesserung behauptet.

Bilder/Maße nach der Korrektur: `artifacts/qualitaet-desktop/BizStates/ui-text-200-1280x720.{png,json}` und `ui-text-200-1600x1000.{png,json}`. Die abschließende Aufnahme setzt lediglich die Eigenschaftenscrollfläche nach oben, damit die Aktion vollständig sichtbar beurteilt werden kann; Eingaben, Zoom und Prüfbedingungen bleiben unverändert. Der normal skalierte 1280×720-Screenshot und die große Textdarstellung wurden visuell betrachtet.

## Tatsächliche Prüfungen und Grenzen

Umgebung: Windows x64, Node.js 24.19.0, Playwright 1.64.1, Electron 45.0.0, vorhandener Produktbuild. Jeder normale Fall startet ein separates temporäres Profil, automatische Updates sind aus. Nur synthetische Daten und mitgelieferte kopierte Beispiele. Mehrere Fachagenten arbeiteten an anderen UI-Prüfungen; deshalb keine vergleichbare Leistungsmessung und keine entsprechenden Zahlenbehauptungen.

```powershell
npm run check
npx playwright test tests/desktop/business-last.spec.ts --list
git diff --check -- tests/desktop/business-ui.spec.ts tests/desktop/business-zustaende.spec.ts tests/desktop/business-last.spec.ts
```

**Bestanden:** Typprüfung, statische Erfassung der beiden optionalen Lastfälle und Diffprüfung. Die Millionenlasten wurden **nicht ausgeführt**. Es werden daher keine neuen Laufzeit-, Speicher- oder Lastresultate beansprucht.

Vor Root-Korrektur: Vollständiger normaler Businesslauf **11 bestanden / 2 fehlgeschlagen / 2 optionale Lastfälle übersprungen**, 36,1 s; beide Fehler UI-04. Gezielte Bestätigung UI-04 **2/2 fehlgeschlagen**. Nach Root-Korrektur bestanden die unveränderten UI-04-Tests **2/2**; separate Maßaufnahme ebenfalls **2/2 bestanden**, 4,7 s. Diese Läufe werden nicht zu einer Gesamttestzahl addiert. Frühere unterbrochene Migrationsläufe mit überholten Selektoren sind keine bestandene Gesamtsuite.

Abschließender gemeinsamer Endlauf der drei zugewiesenen Dateien am korrigierten Build: **13 bestanden / 2 optionale Lastfälle übersprungen / 0 fehlgeschlagen**, 35,1 s. Damit sind alle normalen Fälle dieser Dateien bestanden: ein CSV-Geschäftsablauf, Vorlagen-/Entwurfszustände, Sprachtastatur, acht Prozess-DPI-/Fensterfälle und zwei UI-Textgrößenfälle. Aufruf:

```powershell
npx playwright test tests/desktop/business-ui.spec.ts tests/desktop/business-zustaende.spec.ts tests/desktop/business-last.spec.ts --workers=1 --output=artifacts/qualitaet-desktop/business-endstand --reporter=line
```

Nicht durch diese Änderung belegt: echte Anwenderstudie, produktive Unternehmensdaten, UNC-Freigaben, optionale Millionenlasten, System-DPI-Änderung in Windows, gesamte dunkle/systemabhängige Gestaltung oder eigenständige Ausführung des ZIP-Pakets. Der Paket-Desktopfall prüft dessen reale Erzeugung/ZIP-Kennung; die fachliche Paketabnahme ist ein anderer Nachweis.

Nächster Schritt: Endlaufresultat übernehmen und die Testmigration samt separat geprüftem UI-04-Fix durch den Hauptagenten integrieren, passend committen/pushen und Windows-CI prüfen. Keine eigenen Commits oder Pushes.
