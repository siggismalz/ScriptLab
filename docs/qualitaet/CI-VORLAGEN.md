# CI-Nachprüfung der bestehenden Startseitentests

Ausgang ist der GitHub-Lauf **41121036160** für **58dc3d1**, also vor den neuen Vorlagen-/Marken-/Lizenzänderungen. Lokaler Quellauszug: `artifacts/vorlagen-ui/ci-vorher-58dc3d1.log`. Dieser Bericht behandelt nur die darin fehlgeschlagenen Startseitenfälle. Die ebenfalls enthaltenen Business-Textgrößen- und 1000er-Bereitschaftsfehler haben andere Zuständigkeiten.

## Bestätigte Beobachtungen

Im Auszug scheitern vier Startseitenfälle mit `EBUSY … rmdir` im temporären Sitzungsordner: leeres Projekt, Bestellungen, Bestellvorschlag und Dokumenteingang. Zwei weitere Vorlagenfälle (Monatsauswertung, Dateistapel) erreichen die sichtbare Palette innerhalb der unveränderten 5-Sekunden-Erwartung nicht. Das Log meldet ausdrücklich `hidden`, nicht einen fehlenden Locator. Die eigentlichen CI-Traces und Fehlerkontexte liegen in diesem lokalen Auszug nicht vor.

## Ursache und begrenzte Schlussfolgerung

**CI-VOR-01 – Prozessende wird vor Löschen/Neustart nicht abgewartet.** `beenden()` wartet bisher auf das Ende eines DevTools-Aufrufs `evaluate(app.exit(0))` und löscht danach den Testordner. Ein Exitaufruf bestätigt den Prozesszustand nicht. Auch `neustarten()` wartet im normalen Pfad nicht auf das Ende des alten Prozesses, bevor dasselbe Profil neu geöffnet wird. Der installierte Playwright-Code bestätigt die getrennten Ereignisse: Unter Windows startet Electron über eine Shell, und das `ElectronApplication`-Ereignis `close` entsteht erst im `launchProcess.onExit`-Callback (`node_modules/playwright-core/lib/coreBundle.js`, Electron-Implementierung). Das fehlende Warten ist damit ein bestätigter Synchronisationsfehler im Testhelfer. Welcher konkrete Windows-Prozess beziehungsweise Handle den Ordner im CI sperrte, beweist der Auszug nicht; `EBUSY` darf nicht pauschal einer bestimmten Kindprozessart zugeschrieben werden.

**CI-VOR-02 – Palettensichtbarkeit allein belegt keinen abgeschlossenen Workflowwechsel.** Der Vorlagentest prüft bisher zuerst die Palette und liest erst danach die Kopie. Das Verhalten der aktuellen Anwendung widerspricht der Vermutung eines beabsichtigten Wechsels in die Datenansicht: `editorZeigen()` setzt ausdrücklich den Arbeitsbereich `ablauf`; `projektAktion()` verwendet es beim Öffnen erneut. Der lokale Auszug beweist daher weder eine Datenansicht noch die Ursache des verdeckten Editors. Ein tatsächlicher Wechsel in die falsche Ansicht darf nicht durch einen nachträglichen erzwungenen Tabwechsel verdeckt werden. Die angemessene Bereitschaft bleibt: erwartete neue Kopie aktiviert, `darstellungNoetig=false`, danach weiterhin Palette sichtbar und alle bisherigen fachlichen Aussagen.

## Änderung und Prüflage

Nach ausdrücklicher Dateifreigabe des Hauptagenten wartet ein gemeinsamer lokaler `prozessBeenden()`-Helfer auf das vor `app.exit(0)` registrierte Electron-`close`-Ereignis. `beenden()` und der normale Profilneustart verwenden ihn. Ein bereits beendeter Prozess wird nicht erneut beendet. Im Vorlagenfall wird zuerst die erwartete Kopie mit `darstellungNoetig=false` abgewartet, anschließend weiterhin `editorBereit()` einschließlich sichtbarer Palette und bedienbarem Speichern geprüft. Alle vorhandenen Kennungs-, Editor-, Kopier- und Originalschutzassertions bleiben bestehen; kein Tabwechsel erzwingt eine scheinbar richtige Ansicht. Vorhandene Test-/Assertionfristen und Löschwiederholungen wurden nicht geändert.

Es wurden für diese Nachprüfung **keine Tests, Builds oder Desktopprozesse gestartet**. Der Hauptagent führt die freigegebenen Änderungen nach seinem laufenden Gesamtdurchgang aus. Aus einem Quellreview folgt keine erfolgreiche Wiederholung des fehlgeschlagenen GitHub-Laufs. Keine Produktdatei wird aufgrund dieser Vermutungen geändert.
