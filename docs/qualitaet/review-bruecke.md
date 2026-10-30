# Unabhängiger Review: Projekttransport und umfangreiche Workflows

## Finaler Stand und Prüfumfang

Reviewer: Fachagent Generatoren/VBS. Produktive Änderungen durch den Hauptagenten; der Reviewer änderte ausschließlich die zugewiesenen Regressionstests und diese Notiz.

Gelesen wurden Main-/Preload-/Renderer-Brücke, gemeinsamer JSON-Serializer, Projektvalidierung und Hashpfade sowie technische Blockly-Vortrennung. Zusätzlich wurde die installierte Blockly-13.4-Quelle über `node_modules/blockly/blockly_compressed.js.map` untersucht. Abnahme: feste Methoden und Datenverträge erhalten; keine allgemeine Kanal-/Shellschnittstelle; Fehler, Abbruchwerte, Callback/Abmeldung und Schutzprüfungen wirksam; zulässige Projekte unabhängig kopieren, speichern und generieren.

**Finale technische Schutzgrenze: höchstens 1.000 Gesamtblöcke pro Workflow, unabhängig von der Form.** Die vorhandene Grenze von 150 fachlichen Verschachtelungsebenen bleibt erhalten. Die zusätzliche Darstellungstiefenregel und der versuchsweise ConnectionChecker wurden verworfen und gehören nicht zum Endstand. Deren fünf neu erstellte Tests wurden mit dem verworfenen Ansatz entfernt, nicht als erfolgreiche Endabnahme gezählt.

**Urteil:** Die unten genannten 34 Core-/Brücken-/headless-Regressionen und die Typprüfung bestanden. Native Electron-/Canvasprüfungen durch den Bedienagenten bleiben ein gesonderter Nachweis.

## Tatsächlicher Rendererbefund und bewusste Abgrenzung

Die echten Electron-Proben konnten eine lineare 2.000-Blockkette zunächst öffnen, ändern und speichern; beim vollständigen Ersetzen und erneuten Öffnen blockierte der Renderer. Auch ein anschließend getesteter verzweigter 2.000-Blockworkflow innerhalb der versuchsweisen Darstellungstiefe blockierte beim Neuladen. Page-/Console-Fehlerlisten blieben leer; Renderer-DOM-/CDP-Aufrufe und ein angeforderter Profilerstopp reagierten nicht mehr. **Es liegt kein nachgewiesener JavaScript-Stackfehler und keine abschließend belegte Ursache dieser Blockade vor.**

Frühere erfolgreiche 2.000-Block-Nachweise waren Core-/Serializer-/headless-Nachweise und belegen ausdrücklich keinen funktionierenden gerenderten vollständigen Workflowwechsel. Die vorübergehend versuchte Grenze von 1.000 Darstellungskanten genügte nach dem verzweigten Gegenbeispiel nicht. Der Hauptagent entschied deshalb gegen Eingriffe in Bibliotheksinternas und für die einheitliche Gesamtgrenze von 1.000 Blöcken.

Überlange Projekte werden mit konkreter Grenze, nächstem Bearbeitungsschritt und Hinweis auf die unveränderte Projektdatei abgewiesen. Es wird nichts gekürzt. Die unveränderte gespeicherte Quelle bleibt erhalten; auch ein fehlgeschlagener Schreibversuch ersetzt keine bestehende zulässige Datei. Für zuvor unter einer höheren Gesamtgrenze akzeptierte umfangreiche Formen ist dies eine ausdrücklich dokumentierte Einschränkung zum Schutz vor dem beobachteten Freeze. Die bisherige falsche Zählung von Folgeblöcken als Verschachtelung begrenzte lineare Bestandsabläufe bereits nach etwa 150 Strukturebenen; diese Kopplung wird weiterhin korrigiert.

Die Projekt-/Hash-/Brückenfixtures wurden **bewusst aufgrund der echten UI-Gegenbeispiele** auf den final zulässigen Umfang umgestellt. Positive lineare Fälle haben 50, 500 und 1.000 Blöcke. Der verzweigte 1.000-Blockfall enthält exakt Start + Wenn + Wahrheitswert + 498 DANN-Kommentare + 499 SONST-Kommentare. 1.001 und 2.000 Blöcke sind negative Schutzfälle. Der rohe iterative Serializer-Stresstest mit 20.000 Ebenen bleibt unverändert und erweitert keine Projektfreigabe. Keine positive native 2.000-Blockabnahme wird behauptet.

## Brücken- und Serializerreview

- Main prüft unverändert zuerst tatsächlichen Absender, Hauptframe und feste `scriptlab://app/index.html`-URL. Transporttyp und höchstens 5 MiB UTF-8-Bytes werden vor dem Parsen geprüft; danach folgen die bisherigen fachlichen Validatoren. Eine unabhängige Mehrbyte-Gegenprobe prüft tatsächlich Bytes statt Zeichen.
- Preload besitzt die statisch typisierte Methodentabelle mit 44 festen Aufrufen und `beiStandAnfrage`. Die interne Kanalhilfsfunktion wird nicht exportiert. Keine freie `invoke`-/`send`-/Electron-/Shellschnittstelle. Der doppelte Typecast bei `Object.fromEntries` beweist allein keine Vollständigkeit; die Tests prüfen alle 44 Kanalzuordnungen, genau 45 Exportnamen und gefrorene Fassaden.
- Ein Reviewbefund wurde vor Integration korrigiert: JSON-Argumentarrays machten explizites optionales `undefined` zu `null`. Der reale Berichtaufruf aus `Laufverwaltung.tsx` wäre dadurch abgewiesen worden. Abschließende undefinierte Argumente werden nun ausgelassen. Index `0`, `null`-Abbruch, `false`, Fehlerumschläge und abgelehnte Promises bleiben erhalten. Bei `Antwort<void>` bleibt `antwort.wert` undefiniert. Fehlende/beschädigte Protokollantworten gelten nicht als Erfolg. Künftige optionale Mittelargumente benötigen einen bewusst erweiterten Vertrag.
- Standantworten bleiben an gültigen Absender, UUID und offene Anfrage gebunden. Fehlerhafte Callback-Antworten erfüllen keine Speicheranfrage; Abmeldung entfernt denselben Listener. Die Renderer-Fassade entsteht vor React-Rendering. Es wurde kein vorzeitiger Aufruf auf Modulebene gefunden.
- Der iterative `jsonSchreiben`-Helper ersetzt rekursives Schreiben an den betroffenen Projekt-/Transport-/Hashpfaden. Reine Daten bleiben gegenüber nativem kompaktem `JSON.stringify` bytegleich; Schlüsselreihenfolge, Unicode/Surrogate, optionale Felder und sparse Arrayplätze bleiben erhalten. Geteilte Referenzen werden vollständig dupliziert, echte Zyklen abgewiesen.
- Der Erstreview fand stille Behandlung etwa von `Date` als leerem Objekt. Der Hauptagent ergänzte eine Typprüfung; Date, Map, Set, Boxed-Primitiven und RegExp werden nun abgewiesen. Funktions-/Symbol-/BigInt-Werte werden nicht gespeichert; ein eigener `toJSON`-Callback wird nicht ausgeführt. Der Helper ist auf bestehende reine Daten begrenzt, kein allgemeiner Ersatz für alle JavaScript-Klassen-/Replacer-Konventionen.
- 300 deterministische Datenbäume und die finale verzweigte 1.000-Blockfixture liefern identische JSON-Bytes und bisherige SHA-256-Projekt-/Laufhashes. Die validierte Projektkopie ist tatsächlich unabhängig. Der reine 20.000-Ebenen-Serializerfall wird korrekt geschrieben und zurückgelesen.

## Blockly-Quellbefund und technische Vortrennung

Die installierte Quelle belegt rekursive Pfade: `serialization/workspaces.ts` ruft Serializer zum Leeren auf; `serialization/blocks.ts:826` entsorgt Topblöcke mit `dispose(false)`; `block.ts:353` entsorgt über `disposeInternal` die Kindblöcke rekursiv. Folgeblöcke gehören zum Kindbaum. `Workspace.getAllBlocks(false)` ist dagegen iterativ und liefert Eltern vor Kindern.

Auch Renderpfade sind rekursiv: `queueBlock` geht zu Eltern, `renderBlock` und `dequeueBlock` zu Kindern. Der RAF-Callback ruft `doRenders()` vor dem Promise-Resolver ohne `finally` auf. Ein Fehler dort könnte ein offenes `finishQueuedRenders` erklären. **Ob und welcher dieser Pfade zur tatsächlich beobachteten Rendererblockade beiträgt, ist eine Hypothese und wurde nicht bewiesen.**

Der Hauptagent ergänzte ausschließlich beim vollständigen Ersatz/Entsorgen die öffentliche Vortrennung `ablaufverbindungenVorLadenTrennen`: iterativ gesammelte Blöcke umkehren, verbundene Folgeanschlüsse von unten nach oben lösen, Events verschachtelbar deaktivieren und im `finally` wieder freigeben. Bottom-up verhindert die erneute Kindkettenrekursion von `updateDisabled`; Rendering wird durch Eventsperre allein jedoch nicht ausgeschaltet. Die Vortrennung allein ist **kein behaupteter vollständiger Fix des 2.000-Blockproblems**. Es gibt keinen Paket-/Prototypenpatch an Blockly.

Der finale direkte headless-Test mit 1.000 Blöcken bestätigt technische Vortrennung, ausbleibende Listener-/Undo-Trennereignisse, identische IDs/Texte/Anschlüsse nach Neuladen, Leeren und endgültiges Dispose. Separate Tests bestätigen Bottom-up-Reihenfolge, Erhalt einer bereits aktiven Ereignissperre und Wiederherstellung des Eventzustands bei technischem Fehler. Keine Vortrennung bei bloßem Ansichtswechsel.

## Final ausgeführte Prüfungen

Windows x64, Node.js 24.19.0. Synthetische Daten und eigene temporäre Verzeichnisse. Keine Unternehmensdateien.

```powershell
npx vitest run tests/qualitaet-projekt.test.ts tests/qualitaet-json.test.ts tests/qualitaet-bruecke.test.ts --reporter=json --outputFile=artifacts/qualitaet-grenzen-final-review.json
npm run check
```

**34/34 bestanden, kein Skip/Fehler; Typprüfung bestanden.** Enthalten sind elf Projekt-/Lebenszyklus-, neun JSON- und 14 Brückenfälle. Lineare 50/500/1.000 sowie verzweigte 1.000 durch Kopie, beide Generatoren, Datei und Entwurf erhalten; 1.001/2.000 Gesamtblöcke, zu tiefe fachliche Verschachtelung und Zyklen verweigert. Vorhandene überlange Testdateien bleiben nach fehlgeschlagenem Lesen bytegleich; fehlgeschlagene Schreibversuche mit beiden Übergrößen lassen die bisherige zulässige Zieldatei unverändert.

Die Brückentests laden das echte Preloadmodul mit isoliertem Electron-Mock. Drei Fälle isolieren zusätzlich die tatsächliche Main-Registrierungsfunktion samt `jsonSchreiben` aus dem Quelltext; fachliche Dienste und Absenderbeleg sind kontrollierte Testdoubles. Das ist kein nativer Electron-Sicherheitstest.

`git diff --check` für die zugewiesenen Test-/Reviewdateien: bestanden. Frühere Rohberichte einschließlich `qualitaet-verbindungen-review.json` dokumentieren verworfene Zwischenstände und werden weder zur finalen Fallzahl addiert noch als Produktfreigabe ausgegeben.

## Offene Grenzen und Übergabe

Die technische Ursache des gerenderten sehr großen Workflowwechsels bleibt offen. Die einheitliche Schutzgrenze muss in der tatsächlichen UI erklärt und geprüft werden. Native zulässige Editorwechsel, Installer und CI bleiben separate zentrale Nachweise. Der Hauptagent integriert Tests und Produktänderungen, prüft den Gesamtdiff und koordiniert Commit/Push. Keine produktive Datei oder Git-Integration durch den Reviewer geändert.
