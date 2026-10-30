# Karten in Laufvorbereitung und Business-Ergebnissen

## Initialauftrag und Grenzen

Fachperspektive: bestehende Laufvorbereitung und fachliche Ergebnisdarstellung. Ausgangspunkt laut Hauptagent: sauberer Stand `main/9d3ed29`. Sinnvolle vorhandene Inhalte sollen die gemeinsame Kartenkomponente erhalten; einzelne Parameter, Tabellenzeilen und Protokolle bleiben Arbeitsflächen.

Schreibbereich: `src/renderer/BusinessVorbereitung.tsx`, `BusinessErgebnis.tsx`, die vorhandenen gezielten Formular-/Ergebnis-Units und dieser Bericht. Der Hauptagent hat zusätzlich ausschließlich neue, auf die Karten begrenzte Regeln in der gemeinsamen `business.css` freigegeben. `testbereich.css`, `produkt.css`, gemeinsame Karte/Tokens, Laufzustände, IPC, Generatoren, Projektformate und Abhängigkeiten gehören nicht zu diesem Fachauftrag. Kein UI-, Native-, Build- oder Git-Aufruf durch den Fachagenten. Die tatsächliche UI-Nachprüfung koordiniert der Hauptagent.

Geschützte Verträge: vorhandene Überschriften und IDs, bewusste Moduswahl, Parametersätze, Feldsperren, angezeigte echte Laufdaten, maximal fünf sichtbare Meldungen und Ausgabeziele, vollständiger technischer Bericht und vorhandene Datei-/Bausteinaktionen. Keine neuen Kennzahlen, erfundenen Ergebnisse oder Geschäftsfeatures.

## Quellbefund KARTEN-LAUF-01

**Ausgangszustand:** `BusinessVorbereitung.tsx` stellte Modus und Parametersatz im neutralen `.lauf-kernauswahl`-Grid dar; Parameter, Quellen und Ressourcen waren bereits sinnvoll eingeklappt. `BusinessErgebnis.tsx` enthielt Kontext, Fortschritt, bestätigte Summen, Meldungen und Dateiliste in Fragmenten beziehungsweise neutralen `div`-Gruppen. Zugehörige Rhythmusregeln liegen in `business.css` und `testbereich.css`.

**Nutzeraufgabe:** Einen Lauf bewusst konfigurieren und danach bestätigte Ergebnisse samt Dateien überblicken. **Erwartung:** zusammengehörige Entscheidungen und Ergebnisgruppen sind als ruhige Flächen erkennbar, ausführliche Arbeitsinhalte behalten ihre vorhandene Bedienung. **Einordnung:** gezielter Gestaltungswunsch mittlerer Priorität; kein neu behaupteter fachlicher Fehler. Quellen-/Ressourcendetails benötigen für diese Änderung keine zusätzliche Einrahmung.

**Abnahme:** Benannte Abschnitte gruppieren Modus/Parametersatz, vorhandene Laufzusammenfassung und vorhandene Dateiergebnisse. Es entstehen keine leeren Dateikarten oder Karten pro Zeile. Fachliche Texte, Werte, Grenzen, Sperren und Aktionen bleiben erhalten.

## Abgestimmte Umsetzung

- `BusinessVorbereitung.tsx`: Das bestehende Grid verwendet `Karte as="section"` mit dem zugänglichen Namen „Modus und Parametersatz“. Feldwerte, Handler, Sperren und bisherige responsive Gridregeln bleiben erhalten.
- `BusinessErgebnis.tsx`: „Zusammenfassung des Laufs“ fasst den vorhandenen Kontext, gemeldeten Fortschritt und bestätigte Summen zusammen. Die Karte wird nur bei vorhandenem Inhalt angezeigt. Bei `kontextZeigen={false}` und fehlenden Fortschritts-/Summenangaben entsteht keine leere Zusammenfassung, auch nicht allein wegen null Fehlermeldungen.
- „Dateien und Ausgabeziele“ erhält eine eigene benannte Abschnittskarte, ausschließlich wenn bereits auswertbare Dateiergebnisse vorliegen. Die einzelnen Einträge bleiben Listenzeilen mit ihren bisherigen Details und Aktionen.
- `business.css`: Drei neue, auf die Ergebniszusammenfassung begrenzte Regeln legen Abstände innerhalb dieser Gruppe fest. Flächen, Kontur, Radius und Innenabstand kommen aus der gemeinsamen Karte des Hauptagenten. Meldungen, vollständiger Bericht und Vorschautabelle bleiben außerhalb der Karten. Die bestehenden Überschriften und ihre IDs bleiben erhalten.

Es gibt keine neue Klickaktion, keinen zusätzlichen Tabstopp und keine neue Zustandsverwaltung an den Karten.

## Tatsächlich ausgeführte Prüfung

Windows, Node.js 24.19.0, Vitest 5.0.5; lokaler integrierter Arbeitsbaum nach Anlage der gemeinsamen Karte. Die isolierte reine Unitprüfung lief am 30.10.2026 um 22:15:21:

```text
npx vitest run tests/business-ergebnis.test.ts tests/business-formular.test.ts tests/laufpfade.test.ts --reporter=verbose

business-formular.test.ts: 29 bestanden
business-ergebnis.test.ts: 10 bestanden
laufpfade.test.ts:          5 bestanden
Gesamt: 3 Dateien, 44 bestanden, 0 fehlgeschlagen, 0 übersprungen; 1,33 s.
```

Drei neue semantische Fälle prüfen die benannten Gruppen und erhaltene Feldsperre, gewählte Prüflauf-/Testdatenwerte, tatsächliche Fortschritte/Summen, zwei unveränderte Dateilistenzeilen ohne Unterkarten sowie fehlende leere Ergebnisgruppen. Die vorhandenen Fälle prüfen weiterhin unter anderem gültige/ungültige Zähler, Textmaskierung, Parameterwerte und Quellen-/Zielzuordnung. Der bestehende Acht-Ziele-Fall zeigt weiterhin fünf sichtbare Ausgabeeinträge; alle acht bleiben im vollständigen Bericht enthalten.

## Grenzen und Übergabe

Die Units prüfen gerendertes HTML und fachliche Darstellungswerte, keine tatsächliche Browsergeometrie oder Benutzerinteraktion. Sichtbare Kartenhierarchie, lange deutsche Texte/Pfade, Themen, 1280 × 720, Textskalierung 200 %, Tastatur und Dateiaktionen werden zentral durch den Hauptagenten geprüft. Typprüfung, Build, Desktopprüfung, vollständiger Diff, Commit und Push verbleiben ebenfalls bei der Integration. Aus dieser Änderung wird keine Leistungsverbesserung abgeleitet.
