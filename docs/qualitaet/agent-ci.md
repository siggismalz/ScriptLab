# Fachauftrag und Ergebnis: CI-01 Windows-Kurzpfade

## Initialanweisung

**Rolle und Auftrag:** Fachagent Geschäftsdaten übernimmt ein getrenntes Zuverlässigkeitspaket für einen tatsächlichen Windows-CI-Fehler. Remote-Ausgangsstand `ce30c02`, GitHub-Actions-Lauf `41110585891`, Job `124251653680`: Der bereits vorhandene Test `tests/ausgabeziele.test.ts:158` lehnt eine erlaubte VBS-Kopie in den eigenen Appdatenordner ab; dieselbe Python-Prüfung besteht. Ursache zuerst mit synthetischen Windows-Dateien reproduzieren, danach klein korrigieren. Keine Tests abschwächen.

**Projektkontext:** Electron/Node-Anwendung mit reinen Python-/VBS-Generatoren. Der feste Windows-Testhost `scripts/laufzeit-host.cs` verwendet .NET Framework und übergibt den ausdrücklich gewählten Basisordner an `cscript.exe`. Die VBS-Appausgabegrenze vergleicht Ziel und vom Hauptprozess vorgegebene `ausgabeWurzel`. Exporte enthalten diese interne Grenze nicht. Der vorangegangene Listenfix ist bereits getrennt als `f954cf5` integriert.

**Bekannter Befund:** Native CI-Fehlermeldung nennt einen langen Pfad unter `C:\Users\runneradmin\AppData\Local\Temp\ScriptLab-Ausgabeziele-…\Appdaten\Arbeitsdateien\Workflow\Kopie.txt` als außerhalb. CI-Checkout liegt auf D:, Temp auf C:. Laufwerkswechsel und unterschiedliche kurze/lange Namen zunächst nur als Hypothesen behandeln.

**Arbeitsbereich:** Nur `src/kern/generator.ts`, gezielte Ausgabezieltests und dieser Bericht. Tatsächlich geändert: Generator, neue `tests/qualitaet-ausgabeziele.test.ts` und Bericht. Gemeinsame Typen, IPC, Projektablage und Renderer gehören dem Hauptagenten; unabhängiger Review durch Fachagent `ausfuehrung`. Kein eigener Git-Index, Commit oder Push.

**Geschützte Verträge:** Projektformat/Block-IDs/Sprachen; Testtoken und feste Prozessschnittstelle; relative Basisordner und eigenständige Exporte; keine Shellöffnung; Appdaten-Pfadgrenze, Ablehnung externer Ziele und vollständige Prüfung vorhandener Vorfahren auf Reparsepunkte. Keine Umdeutung oder Umleitung des tatsächlichen Ausgabepfads.

**Arbeitsschritte und Abnahme:** Native Reproduktion erstellen und vor produktivem Fix an den Hauptagenten melden. Unterschiedliche Schreibweisen desselben Windows-Pfads vereinheitlichen. Erlaubte relative/absolute Ziele und rekursive Ordneranlage prüfen; externe Ziele, Traversal, ähnlich benannten Nachbarordner und Junction weiterhin abweisen. Bestandssuite beider Sprachen einschließlich eigenständiger Exporte wiederholen. Ergebnisse, Befehle, Grenzen und nächsten Integrationsschritt dokumentieren.

## CI-01 / P1: Erlaubte VBS-Ausgabe fälschlich abgewiesen

**Auswirkung:** Ein Workflow kann im erlaubten Arbeitsordner keine Datei kopieren und meldet einen fachlich falschen Pfadfehler. Betroffene Dateien: `src/kern/generator.ts`, Zusammenhang mit .NET-Testhost und `TestlaufDienst`.

**Belastbare Reproduktion vor dem Fix:** Eigenen temporären Appordner anlegen und dessen `Scripting.FileSystemObject.GetFolder(...).ShortPath` ermitteln. Genau diese kurze Wurzel und den daraus gebildeten kurzen Arbeitsordner an den echten `TestlaufDienst` samt mitgeliefertem Host übergeben. Ein bestehender `sl_copy`-Baustein soll eine eigene synthetische Quelle nach `Kopie.txt` kopieren. Der unveränderte Generator lehnt den erlaubten langen Zielpfad mit derselben Meldung wie die CI ab. Die neue Regression schlug vor der Produktivänderung mit `fehlgeschlagen` statt `beendet` fehl.

**Ursache:** Der feste .NET-Framework-Host erweitert den kurzen Basisnamen zum langen Namen. Die im Script eingebettete Ausgabegrenze behält den kurzen Namen. `FSO.GetAbsolutePathName` vereinheitlicht diese beiden Aliasdarstellungen nicht; der bisherige reine Textvergleich betrachtet denselben physischen Ordner als unterschiedlich. Die native Reproduktion belegt diesen Fehlermechanismus. Die konkrete kurze Ausgangszeichenfolge des entfernten CI-Laufs wurde nicht zusätzlich protokolliert. Eine separate Probe mit E:-Arbeitsverzeichnis und C:-Ziel reproduzierte den Fehler ohne Kurz-/Langnamendifferenz nicht.

**Korrektur:** Der nur bei interner `ausgabeWurzel` erzeugte Helfer `SL_Vergleichspfad` verwendet für den Grenzvergleich auf beiden Seiten `ShortPath` des nächsten vorhandenen Datei-/Ordnervorfahren und hängt fehlende Pfadbestandteile unverändert an. Der tatsächliche Zielpfad bleibt der ursprüngliche absolute Pfad. Die nachfolgende Reparseprüfung aller vorhandenen Vorfahren bleibt erhalten. Der Grenzvergleich berücksichtigt weiter die abschließende Ordnertrennung und kann einen ähnlich benannten Nachbarordner nicht als Kind akzeptieren. Das Script führt keine zusätzlichen Prozesse aus und installiert nichts.

## Prüfnachweise

Umgebung: Windows x64, Node.js 24.19.0, Vitest 5.0.5, tatsächliches `System32/cscript.exe`, fester `artifacts/native/ScriptLab.Testhost.exe`. Quellen und Ziele liegen ausschließlich in eigenen `TemporaryDirectory`-/`mkdtemp`-Ordnern. Native cscript-Proben verwenden Dateihandles für stdout/stderr; Node-Windows-Pipes werden nicht als Ersatz für diese Hosts vorausgesetzt.

- Vor Fix: neue Kurzpfad-Reproduktion **fehlgeschlagen** mit der identischen Appdaten-Grenzmeldung wie CI.
- Nach Fix, erste gezielte Fassung: `npx vitest run tests/qualitaet-ausgabeziele.test.ts tests/ausgabeziele.test.ts --reporter=verbose`: **3/3 bestanden**, einschließlich beider Sprachen und selbständiger Exporte im Bestandstest.
- `npm run check`: **bestanden** nach Produktivänderung und Erweiterung der Regression.
- Erweiterte neue Matrix: erlaubte relative/absolute Kopie, zwei fehlende Ordner, verweigerte externe Kopie/Traversal/Nachbar/Junction, unveränderte Quellbytes. Isoliert **1/1 bestanden**, 9,303 s gesamt, unveränderte 10-s-Laufgrenze je Workflow.
- Ein vorheriger kombinierter Lauf mit Generator-Modustests hatte **8 bestanden / 1 fehlgeschlagen**: Das rekursive mkdir erreichte einmal die 10-s-Testfrist. Die direkte instrumentierte Gegenprobe erzeugte beide Ordner korrekt; eine Endlosschleife ließ sich nicht reproduzieren. Die konkrete Ursache dieses einzelnen Zeitlimits ist nicht belegt. Weitere Ergebnisse werden vor Integration ergänzt; ein erfolgreicher späterer Lauf hebt diesen fehlgeschlagenen Versuch nicht auf.
- Abschließende Wiederholung `npx vitest run tests/qualitaet-ausgabeziele.test.ts tests/ausgabeziele.test.ts tests/generator-testmodus.test.ts --reporter=verbose`: **9/9 bestanden**, 50,32 s gesamt, kein Skip. Neue native Matrix 20,826 s über sieben einzelne Dienststarts; jeder Workflow behielt seine 10-s-Laufgrenze. Der bestehende Python-Test prüft unabhängig erzeugte Ausgaben und beide vorhandenen Exportwege; der Generator-Modustest prüft weiterhin den getrennten Export-/Testvertrag. `git diff --check` für Generator und neue Testdatei: **bestanden**.
- Unabhängiger Fachagent `ausfuehrung`: **5/5 direkte native Gegenproben bestanden**, zwei/drei fehlende interne Ordnerebenen erzeugt, externe fehlende Ziele/Nachbarordner/Junction abgewiesen, tatsächlich abweichende 8.3-Wurzel. Rohbeleg `artifacts/qualitaet-ci01-direkt-review.json`, Review separat unter `review-ci.md`. Eine erste direkte Gegenprobe mit 7-s-Beobachtungsfrist erreichte ebenfalls ein Zeitlimit; die Diagnose mit 15-s-Beobachtungsfrist bestand ohne Produktivänderung. Das erklärt die Ursache der Verzögerung nicht und wird nicht als garantierte Laufzeit dargestellt.

## Grenzen und Übergabe

Keine Performanceverbesserung behauptet. Netzwerkfreigaben/UNC, deaktivierte 8.3-Namenerzeugung, geänderte Freigaben oder parallele Manipulationen des Dateisystems sind keine durch diesen Fall belegten Konfigurationen. Die Ausgabegrenze ist weiterhin keine allgemeine Prozess-Sandbox. Der entfernte CI-Lauf muss am integrierten Fix erneut erfolgreich werden; lokale Tests sind kein behaupteter CI-Erfolg.

Nächster Schritt: unabhängigen Review der Pfadgleichheit und Reparsegrenze abschließen, abschließende gezielte Prüfungen am integrierten Stand wiederholen, dann deutscher Commit/Push und neue Windows-CI durch den Hauptagenten.
