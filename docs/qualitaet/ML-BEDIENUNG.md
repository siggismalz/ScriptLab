# Bedienung spezialisierter Machine-Learning-Workflows

## Fachauftrag und Zuständigkeiten

Ausgang `main` / `8496feb`, sauberes Repository laut Hauptagent. Nutzerauftrag: vorhandene Workflowerstellung um einen ausdrücklich wählbaren ML-Arbeitskontext ergänzen. Python/VBS und die vorhandene globale Navigation, der echte Blockly-Editor, Speichern und eigenständiger Export bleiben erhalten. Keine Mail-Platzhalter oder versteckte Einrichtung.

Produkt-/Frontendagent besitzt nur Sprachwahldialog/CSS, Palette, neue `MlLaufzeit`/`MlErgebnis` und lokales CSS, gezielte Unit-/Desktoptests sowie diesen Bericht. Ein ausdrücklicher Folgeauftrag ergänzt die reine Beschreibungstabelle `src/editor/beispieleHilfe.ts` und die Migration von `tests/sprachwahl.test.ts` auf drei Angebote. Hauptagent besitzt Projektart, gemeinsame Verfügbarkeitsprüfung, Katalog, Formulare, Main/IPC/Preload und Integration in `Anwendung`. Laufzeitagent besitzt `MLStatus`/`MLFortschritt`; Businessagent definiert bestätigte Qualitätsereignisse. Keine eigenen Git-/Buildaktionen.

## Geschützte Verträge und Schnittstellen

- Sprachwahl behält die benannten nativen Python-/VBS-Radios und Abbruch/Vorauswahl. „Machine Learning“ ist die dritte Auswahl und ruft ausschließlich `erstellen('python', 'ml')` auf. Python/VBS verwenden weiterhin den bisherigen Sprachaufruf. Auswählen allein legt nichts an und richtet nichts ein.
- `Palette` erhält `workflowArt?: WorkflowArt`, Standard `allgemein`, und verwendet ausschließlich `bausteinVerfuegbar(typ, sprache, art)` des Hauptagenten. Fachgruppen ordnen vorhandene Kategorien; es gibt keine zweite Liste erlaubter Block-IDs. Allgemeines Python/VBS erhält keine neuen ML-Bausteine.
- `MlLaufzeit({status: MLStatus|null, aktiv, fortschritt: MLFortschritt|null, fehler?, aktion})` ist vollständig kontrolliert. Kein Effekt, Polling, Dateizugriff oder eigener IPC-Aufruf. `aktion` meldet nur einen ausdrücklich betätigten Auftrag `pruefen|einrichten|offline|abbrechen` an den Hauptagenten. Paketstatus und technische Angaben bleiben lesbar. Bearbeiten/Speichern/Exportieren werden nicht gesperrt.
- `MlErgebnis({business, aktiv})` übernimmt den vorhandenen Business-Laufkontext. Bestätigtes Backendereignis `art='ml_training'`: Aufgabe, Verfahren, Trainings-/Testzeilen, Merkmale, Zielspalte und gemeldete Metriken. `bericht.ml_training` ist maßgeblich, ansonsten die entsprechenden Ereignisse. Keine Ableitung aus Exitcode oder allgemeinem Abschluss, keine erfundenen Scores. PyTorch-Fortschritt stammt aus `ml_fortschritt` mit Epoche/Epochen. Es werden keine Rohdaten oder Tensoren verlangt.

## Umsetzung und Prüfstand

Die ML-Erstellung benennt den internen Pythonbezug und das optionale CPU-Paket. Die reduzierte Palette trennt Daten laden, Tabellen vorbereiten, Modelle/Vorhersagen, Ergebnisse speichern und Ablauferläuterung. Laufzeitanzeige verwendet gemeinsame Karte/Knopf/Status und erlaubt Einrichtung nur per eigenständiger Aktion. Ergebnisanzeige zeigt bestätigte Aufgabe/Verfahren, Datenaufteilung und Metriken; fehlende und nicht definierte Werte werden nicht zu Null oder einem Erfolgswert umgedeutet.

`npm run check` **bestanden**. `npx vitest run tests/ml-bedienung.test.ts tests/sprachwahl.test.ts tests/editor-bedienung.test.ts` **26 bestanden**, 0 fehlgeschlagen/übersprungen (9 neue ML-Fälle, Sprachwahl und vorhandene Editorbedienung). Erhalten bleiben die ausdrückliche Entscheidung vor dem Anlegen, VBS/Python-Angebote und keine Rendercallbacks. Neue Modelltypen besitzen konkrete deutsche Wirkungsbeispiele mit synthetischen Namen statt einer fehlenden Hilfe. Die Ergebnisfälle prüfen bekannte Klassifikations-/Regressionswerte, negatives und null-R², große ungerundete Zeilenzahlen, Berichtvorrang ohne Duplikate und fehlende/ungültige Werte ohne erfundene Scores.

Nach integriertem Root-Build (206 Renderer-Module) tatsächlich ausgeführt, Windows x64, Node 24.19.0, Electron 45 und isolierte vollständige Testprofile:

`npx playwright test tests/desktop/ml-ui.spec.ts --reporter=list --output=artifacts/ml-bedienung/tests-final`

**4 bestanden, 0 fehlgeschlagen, 0 übersprungen** (14,5 s). Hell/dunkel und 100/200 % Text bei 1280 × 720 logischen Pixeln; tatsächliches `light`/`dark` und 14/28px geprüft. Die Auswahl erfolgt mit nativen Pfeiltasten und Erstellungsbestätigung. Auswählen/Abbrechen erhält den alten Workflow; erneutes Öffnen übernimmt keine abgebrochene ML-Auswahl. Erst Bestätigung erstellt `workflowArt=ml` mit Python. Vier Modellaktionen und reduzierte Fachgruppen erscheinen, während neue allgemeine Python-/VBS-Workflows keine ML-Bausteine anbieten.

Die echte Konfiguration prüft Aufgabe und Verfahren, einen langen deutschen Zielspaltennamen sowie verborgene Vorgaben. Erst das bewusste Aufklappen zeigt die 50 Trainingsepochen. Ohne eingerichtetes CPU-Profil funktionieren internes Speichern und **Projektdateiexport** einschließlich Sprache, Workflowart und unverändertem Editorzustand. Die Laufzeitansicht zeigt fehlendes Paket, getrennte Online-/Offlineaktionen und erreichbaren Tastaturfokus; der Status bleibt ohne aktive Einrichtung/Installation. Es wurde kein Trainingslauf gestartet und kein Paket installiert. Script-/Businesspaketexport und reale Modellmetriken sind damit nicht als Desktopnachweis abgedeckt; sie gehören zum Backend-/Integrationspaket des Hauptagenten.

Vorläufe scheiterten ausschließlich an präzisierten neuen Testannahmen: `getByLabel` traf Feldgruppe und Eingabe; der gezielte native `spinbutton` muss für den Einblendhelfer auch im eingeklappten Zustand auffindbar sein. Beim Wechsel ML→allgemeines Python war Sprache=Python allein keine Bereitschaftsbedingung, weil der alte Workflow sie bereits hatte. Die finale Prüfung wartet auf neue Kennung, passende Workflowart/Sprache und abgeschlossene Darstellung gemeinsam. Keine Frist verlängert und keine Fachassertion entfernt; kein Produktcode für diese Testkorrekturen geändert.

Tatsächlich angesehen: `artifacts/ml-bedienung/workflowwahl-hell-100.png`, `workflowwahl-dunkel-200.png`, `laufzeit-hell-100.png` und `laufzeit-dunkel-200.png`. Auswahlkarten und Status sind lesbar; bei 200 % wird innerhalb des Dialogs normal vertikal gescrollt, die Footeraktionen bleiben erreichbar. Keine horizontale Überbreite des Einstellungsdialogs. Prettier und TypeScript nach dem finalen Teststand **bestanden**.

Keine vollständige Gesamt-, Installer-, Screenreader-, DPI- oder reale Trainingsabnahme aus diesen vier UI-Fällen abgeleitet. Keine Leistungsbehauptung oder Modellqualitätszusage.

## Unabhängiger Laufzeitreview

Zusätzlich auf ausdrücklichen Auftrag ausschließlich lesend geprüft: Laufzeitdienst, ML-Profil-/Lockdateien, Wartungsskripte und zugehörige Tests. Der zuerst gemeldete Aktivierungsbefund wurde beim Laufzeitagenten korrigiert: ein exklusiv selbst erzeugter, pfadstabiler Profilordner bleibt bis zum atomaren Aktivzeigerwechsel unveröffentlicht; Fehler/Abbruch davor bereinigt ausschließlich diesen eigenen Ordner. Die alte `.staging-`-Testannahme wurde auf tatsächliche `profil-`-Ordner umgestellt, eine Bootstrap-Unterbrechung nach Basiskopie ergänzt. Der Kurzpfad-Prüfpunkt führte zu einer lstat-Elternkettenprüfung statt unzulässiger Gleichsetzung von `realpath`- und Aliastext. Die aktuellen Testquellen prüfen echte Windows-Kurzpfade und Junction-Abweisung.

Begrenzte Lesefreigabe nach Korrektur. Die **14/14** vom Laufzeitagenten gemeldeten Prüfungen wurden vom Reviewer nicht erneut ausgeführt und sind dessen Nachweis. Zeigerschreibfehler-Injektion, harte OS-Unterbrechung mit verwaister Sperrdatei sowie separate Offline-UI-/Paketabnahme bleiben ausdrücklich offene Grenzen dieses Reviews. Der Reviewer änderte keine Laufzeitdatei und startete keine Runtime-/Installationsprozesse.
