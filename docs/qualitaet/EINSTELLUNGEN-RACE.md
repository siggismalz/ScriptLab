# Einstellungen beim unmittelbar folgenden Workflowwechsel

## Auftrag und Zuständigkeit

Der Fachagent Geschäftsdaten/Qualität ergänzt einen gezielten Regressionstest für den bestätigten Verlust gespeicherter Einstellungen. Schreibbereich sind ausschließlich `tests/einstellungen-speicher.test.ts` und dieser Bericht. Der Hauptagent besitzt und korrigiert `src/main/hauptprozess.ts`; keine Änderung an Renderer, IPC-Verträgen, Lizenz, Preisen oder Desktoptests durch diesen Fachauftrag. Kein UI-, Native-, Build- oder Git-Aufruf.

Der Test muss die tatsächliche Main-Speicherfunktion und die tatsächlichen Handler für Einstellungen und einen neuen Workflow ausführen. Die atomare Dateischreibung wird kontrolliert verzögert oder abgelehnt. Abnahme: Textskalierung 2 bleibt zusammen mit der folgenden Sprachwahl erhalten, Dateischreibvorgänge überlappen sich nicht, ein fehlgeschlagener Schreibvorgang erhält den vorherigen Stand und seinen Aufruferfehler, weitere Speicherungen bleiben möglich.

## Befund EINST-01

- **Ursprünglicher Nachweis:** GitHub-Lauf `41121036160` am früheren Stand `58dc3d1`, vor der aktuellen Vorlagenüberarbeitung. Der lokale Logauszug `artifacts/vorlagen-ui/ci-vorher-58dc3d1.log` zeigt in beiden 200%-Fällen von `business-zustaende.spec.ts` (1280 × 720 und 1600 × 1000) nach dem Workflowwechsel eine geladene `textSkalierung` von 1 statt 2. Die genaue zeitliche Folge der IPC-Aufrufe dieses CI-Laufs wurde nicht aufgezeichnet.
- **Am Quelltext belegte Ursache:** Die Oberfläche übernahm die neue Textgröße sofort, während der Main-Prozess seine globale Einstellung erst nach dem asynchronen Dateischreiben aktualisierte. Ein unmittelbar folgender Neu-Aufruf konnte noch den alten Gesamtstand übernehmen, nur dessen Sprachwahl ergänzen und damit die neue Textgröße wieder überschreiben. Die unabhängigen Handler wurden nicht gemeinsam serialisiert.
- **Kontrollierte Reproduktion:** Die tatsächliche Einstellungsbehandlung erhält Textskalierung 2; deren erster Schreibvorgang bleibt offen. Noch währenddessen startet der tatsächliche Neu-Handler und passiert den Projektschutz. Erst anschließend wird die erste Speicherung freigegeben. Die zweite Speicherung muss aus dem dann aktuellen Stand Textskalierung 2 und Sprache `python` kombinieren.
- **Auswirkung/Priorität:** Verlust einer bewusst gewählten, bereits sichtbar angewandten Einstellung; reproduzierbarer zeitlicher Konflikt, Priorität hoch. Betroffene Nutzeraufgabe: Schriftgröße einstellen und unmittelbar einen Workflow anlegen.
- **Erwartung:** Beide Änderungen bleiben in Main-Zustand und gespeicherten Daten erhalten. Ein zusätzliches Warten nur im Desktoptest würde diesen Nutzerkonflikt verdecken; die 200%-Sollwerte bleiben unverändert.

## Korrektur und Regression

Die Korrektur des Hauptagenten reiht Schreibvorgänge in `lokaleEinstellungenSpeichern` ein. Die Sprachänderung des Neu-Handlers ist ein funktionaler Updater, der erst innerhalb dieser Folge vom aktuellen Stand abgeleitet wird. Der globale Zustand und das Erscheinungsbild werden nach erfolgreichem Schreiben übernommen. Der einzelne Aufrufer erhält Schreibfehler weiterhin; eine intern behandelte Ablehnung hält die Folge für nachfolgende Aufträge offen.

`tests/einstellungen-speicher.test.ts` liest Schema, Initialzustand, Speicherfunktion und beide Handler unmittelbar aus dem aktuellen Main-Quelltext, übersetzt diese Abschnitte mit esbuild und führt sie in einer VM aus. Dies folgt dem vorhandenen Isolationsmuster von `qualitaet-bruecke.test.ts`. Die Testdatei enthält keinen zweiten Speicherfolgen-Algorithmus. Lediglich Datei-I/O, Projektschutz und unbeteiligte Electron-/Projektumgebung werden ersetzt.

1. **Textgröße und Sprache:** Eine gezielt verzögerte Textgrößenspeicherung und der unmittelbar folgende Neu-Aufruf ergeben exakt den Ausgangsstand mit `textSkalierung: 2` und `letzteSkriptsprache: 'python'`. Während der ersten offenen Speicherung beginnt keine zweite; maximale gemessene Parallelität ist 1. Persistierter und globaler Stand stimmen nach Abschluss überein.
2. **Fehler und Fortsetzung:** Die erste Speicherung wird mit einem bekannten Fehler abgelehnt. Derselbe Fehler erreicht den Aufrufer, globaler und persistierter Stand bleiben unverändert und die Darstellung wird nicht übernommen. Der bereits wartende Sprachauftrag arbeitet mit diesem erhaltenen Stand weiter. Eine anschließend gestartete Textgrößenänderung auf 1,5 wird ebenfalls erfolgreich gespeichert; maximale Parallelität bleibt 1.

## Tatsächliche Prüfung

Stand: lokaler Arbeitsbaum nach der Main-Korrektur des Hauptagenten, 30.10.2026. Windows, Node.js 24.19.0, Vitest 5.0.5; reine VM-Prüfung ohne Dateischreibung, Electron-Prozess oder Benutzerprofil.

```text
npx vitest run tests/einstellungen-speicher.test.ts --reporter=verbose
1 Datei bestanden; 2 Tests bestanden; 0 fehlgeschlagen; 0 übersprungen.
Laufbeginn 21:44:27; Gesamtdauer 231 ms.
```

Die neue Testdatei wurde mit dem vorhandenen Prettier formatiert. Typprüfung und Gesamtsuite liegen bei der Integration des Hauptagenten.

## Grenzen und Übergabe

Die Regression belegt den zeitlichen Konflikt an tatsächlichem Main-Code unter kontrollierten Schreibverzögerungen und Schreibfehlern. Sie beweist nicht, dass genau diese Ereignisfolge im ursprünglichen CI-Lauf eintrat. Echte Dateisystemfehler, der gesamte Electron-/IPC-Weg und die visuelle 200%-Darstellung werden durch diese isolierte Prüfung nicht ausgeführt. Die bestehenden Desktop-Erwartungen werden nicht abgeschwächt; ihre Gesamtwiederholung koordiniert der Hauptagent.
