# Fachauftrag und Ergebnis: Generatoren, VBS und Ausführung

## Initialanweisung und Zuständigkeit

**Rolle und Nutzeraufgabe:** Fachagent Bausteine/Generatoren/Ausführung mit ausdrücklicher Verantwortung für VBS. Bestehende Grundblockverträge, Codevorschau, Test und eigenständigen Export sowie Start/Abbruch untersuchen. Konkrete Fehler oder messbare Engpässe reproduzieren, lokal korrigieren und Regressionen nachweisen. Keine neuen Blocktypen, freien Programmschnittstellen oder Produktfunktionen.

**Kontext:** Ausgangscommit `fa6b208`, Branch `main`; anfangs sauber. Windows 11 x64 Build 26200, Node.js 24.19.0, Electron 45, Blockly 13.4, TypeScript 7. Gebündeltes CPython 3.15.2 und vorhandenes Windows-`cscript.exe`. Gelesen: `docs/ARCHITEKTUR.md`, `docs/TESTLAUF.md`, `docs/PYTHON-FUNKTIONSUMFANG.md`, betroffene Generatoren/Helfer, `src/windows/testlauf.ts`, vorhandene Windows-Semantik-, Syntax- und Ausführungsgrenztests.

**Bekannte Befunde bei Start:** Keine vorab bestätigte Ursache. Zunächst falsche Ergebnisse, Literalkodierung, Fehlerzuordnung und Prozesslebenszyklus prüfen; keine große Änderung aufgrund einer Vermutung. Bestätigten Befund vor Änderung mit Kennung, Reproduktion, Soll/Ist, Priorität und Abnahme an den Hauptagenten senden.

**Schreibbereich:** Ausschließlich `src/kern/generator.ts`, `python-generator.ts`, `python-helfer.ts`, `skript.ts`, `src/windows/testlauf.ts`, neue `tests/qualitaet-ausfuehrung.test.ts` beziehungsweise zugehörige Windows-Tests und dieser Bericht. Tatsächlich geändert wurden nur `generator.ts`, `python-helfer.ts`, die neue Testdatei und dieser Bericht. Gemeinsame Typen, Projektformat, IPC, Hauptzustand, Navigation, Styles und Abhängigkeiten gehören dem Hauptagenten. Kein Zugriff auf Git-Index, keine eigenen Commits/Pushes.

**Geschützte Verträge:** Schema 3 und Migrationen, stabile Block-/Variablen-IDs, bestehende Sprachzuordnung, 1-basierte Listenindizes, unabhängige Listenwerte; derselbe Sprachgenerator für Vorschau/Test/Export. Öffnen, Bearbeiten, Navigation, Speichern und Export starten keine Workflowausführung. Main/Preload/Renderer und festes Jobobjekt bleiben getrennt. Ein angeforderter Stopp ist kein beendeter Prozess. Keine allgemeine Shellschnittstelle und keine neue Python/VBS-Business-Parität.

**Schritte und Abnahme:** Ursache reproduzieren, vergleichbare Vorhermessung, klein korrigieren, dieselben Fälle danach messen und fachliche Ergebnisse prüfen. Gezielte native Windows-Regressionen, vorhandene Generator-/Syntax-/Semantiktests und unabhängiger Review durch einen anderen Agenten. Meldung mit Dateien, Befehlen, tatsächlichen Ergebnissen, Grenzen und nächstem Integrationsschritt. Testdaten ausschließlich synthetisch in eigenen Tempverzeichnissen.

## RUN-01: Vollständige Listenkopie für einen einzelnen Zugriff

**Priorität P2; Auswirkung:** Umfangreiche Listen unnötig langsam lesen, zusätzlicher temporärer Speicherbedarf. Dateien: `python-helfer.ts/sl_eintrag` und `generator.ts/SL_Eintrag`. Keine Abhängigkeit zu Projektformat oder UI.

**Reproduktion:** Eine vorhandene Liste aus 100, 10.000 beziehungsweise 100.000 Skalaren anlegen und 250-mal ihren letzten Eintrag lesen; drei Wiederholungen je Größe. Python kopierte vor jedem Zugriff mit `sl_liste` rekursiv die gesamte Liste und anschließend nochmals das gewählte Ergebnis. VBS kopierte das gesamte Array zunächst über `SL_Liste`.

**Soll/Ist:** Erwartet wird eine Prüfung von Typ und Index, anschließend eine unabhängige Kopie des gewählten Ergebnisses. Tatsächlich wuchs der Aufwand mit sämtlichen unbenutzten Listeneinträgen. Abnahme: identisches Ergebnis einschließlich verschachtelter unabhängiger Werte; gleiche Ablehnung ungültiger Typen/Indizes; nachgewiesener Wegfall der vollständigen Kopie.

**Korrektur:** Beide Helfer prüfen die ursprüngliche Liste direkt und greifen auf den gewählten Eintrag zu. Python kopiert weiterhin das Ergebnis rekursiv; VBS erhält seine Array-Wertzuweisung. Keine Änderung an Reihenfolge, Indexkonvertierung, Fehlermeldungen, Generatoroptionen oder Exportverträgen. Der Prozessdienst wurde gelesen, aber mangels eines belastbar reproduzierten Fehlers nicht geändert.

## Messungen vor und nach der Änderung

Windows 11 x64 Build 26200, CPython 3.15.2 x64; dieselben lokalen Interpreter und Datensätze, keine App-Daten. Gemessen wurden die tatsächlichen Produktionshelfer ohne UI/Prozessstartzeit. Zahlen sind Median aus drei Messungen mit je 250 Zugriffen. Python: `time.perf_counter`, zusätzlicher `tracemalloc`-Peak für genau einen Zugriff. VBS: `Timer`, beobachtete Auflösung 7,8125 ms; keine genaue Beschleunigungszahl unterhalb dieser Auflösung.

| Listeneinträge | Python vorher / nachher ms | Python zusätzlicher Peak vorher / nachher Bytes | VBS vorher / nachher ms |
| --- | --- | --- | --- |
| 100 | 1,341 / 0,515 | 1.600 / 736 | 0 / 0 |
| 10.000 | 68,528 / 0,491 | 85.856 / 736 | 15,625 / 0 |
| 100.000 | 823,202 / 0,491 | 801.664 / 736 | 234,375 / unter Timer-Auflösung |

Prüfsummen blieben exakt `24750`, `2499750` und `24999750`. Die Messung gilt für wiederholten Skalarzugriff, nicht für allgemeine Workflowlaufzeiten oder beliebig große verschachtelte Ergebniskopien. Kein Versprechen unbegrenzter Belastbarkeit.

Lokale Rohdaten: `artifacts/qualitaet-run01-python-vorher.json`, `...-python-nachher.json`, `...-vbs-vorher.json`, `...-vbs-nachher.json`. Die neue Testdatei reproduziert die aktuelle Messung und schreibt `...-python-messung.json` sowie `...-vbs-messung.json`; Zeiten sind keine schwankungsanfälligen CI-Grenzen. Die Rohwerte oben wurden tatsächlich vor und nach Änderung erfasst und nicht aus späteren Testergebnissen geschätzt.

## Ausgeführte Prüfungen

```powershell
$env:SCRIPTLAB_RUNTIME_TESTS='1'
$env:SCRIPTLAB_TEST_PYTHON=(Resolve-Path artifacts/python-buendel/python/python.exe).Path
$env:SCRIPTLAB_TEST_PYTHON_VERSION='3.15.2'
npx vitest run tests/qualitaet-ausfuehrung.test.ts --reporter=json --outputFile=artifacts/qualitaet-run01-regression.json
```

**Bestanden: 7/7**, kein Skip/Fehler. Echte Python- und VBS-Prozesse: erste/letzte Position, unabhängiges verschachteltes Ergebnis durch tatsächliche Änderung der zurückgegebenen Liste und Readback des Originals; leere Liste, Index 0, fehlender/gebrochener Index und falscher Listentyp. Aktuelle Lastmessung mit unabhängigen Prüfsummen in beiden Sprachen. Python-Aufrufe verwenden `-I -B -u -X utf8`, damit das gebündelte Laufzeitmanifest nicht durch Test-Bytecode verändert wird.

```powershell
npx vitest run tests/python-generator.test.ts tests/kern.test.ts tests/generator-testmodus.test.ts tests/windows/generator-syntax.test.ts tests/windows/python-semantik.test.ts tests/windows/ausfuehrungsgrenze.test.ts --reporter=json --outputFile=artifacts/qualitaet-run01-bestand.json
```

**Bestanden: 160/160**, kein Skip/Fehler. Davon 62 Python-Generator-, 70 Kern-, 6 Testmodus-, 1 VBS-Gesamtparser-, 17 Python/VBS-Semantik- und 4 native Ausführungsgrenzfälle. Diese Zahl ist ein einzelner Lauf und wird nicht mit früheren historischen Nachweisen addiert. Die 17 Semantikfälle enthalten einen Python-Gesamtparserfall und 16 gezielte tatsächliche Laufzeitfälle. Das ist keine fachliche End-to-End-Prüfung jeder denkbaren Blockkombination.

`npm run check` beim Agentenabschluss: **fehlgeschlagen** an einer gleichzeitig in Arbeit befindlichen Root-Testdatei `tests/qualitaet-projekt.test.ts:56` (`Entwurfspeicher.sichern` existiert nicht); Hauptagent informiert. Keine Diagnose in meinen Dateien. Der integrierte Stand benötigt die erneute zentrale Typprüfung.

## Grundblockinventar und tatsächliche Abdeckung

48 registrierte gemeinsame Grundtypen aus `grundBausteine` in `src/kern/katalog.ts`; alle werden für Python und VBS angeboten. Der Katalog enthält genaue Namen, Kategorien, Felder/Standards, Eingaben/Typen, Ausgangstyp und Hilfetexte. Die zentrale Bestandsaufnahme führt das vollständige Typinventar; hier ist die dazugehörige Nachweisgrenze festgehalten.

- **Generator/Parser aller 48 Typen und Dropdownvarianten:** `tests/python-generator.test.ts`, `tests/windows/generator-syntax.test.ts`, `tests/windows/python-semantik.test.ts` prüfen tatsächlich die vollständige Katalogmenge. Diese Schleifen sind keine 48 fachlichen Ausführungstests.
- **Ablauf und Bedingungen:** `sl_start`, `sl_comment`, `sl_end`, `sl_if`, `sl_compare`, `sl_logic`, `sl_not`, `sl_exists`. Gezielte Semantikfälle für Abschluss, verschachtelte Bedingungen, eager Und/Oder, Vergleichs-/Konvertierungsregeln, Fehlerzuordnung sowie Datei-/Ordnerexistenz. Nicht jede mögliche Wertkombination geprüft.
- **Schleifen:** `sl_repeat`, `sl_while`, `sl_foreach`, `sl_foreach_file`. Tatsächliche endliche Verschachtelungen und Dateilisten; spätere ungültige Schleifenbedingung. Unbegrenzte Läufe bleiben durch vorhandene native Ausführungsgrenztests abgedeckt, nicht durch eine neue Prozesssteuerung.
- **Dateien:** `sl_mkdir`, `sl_copy`, `sl_move`, `sl_rename`, `sl_list_files`, `sl_basename`, `sl_read_text`, `sl_write_text`, `sl_append_text`, `sl_delete`. Synthetische echte Dateien; Kopieren/Verschieben/Umbenennen/Löschen, bewusstes Ersetzen, fehlende/ungültige Kodierung, UTF-8-/UTF-16LE-BOM und CRLF. Löschen hier ohne Rückfragedialog. Keine UNC-/Unternehmensfreigabeprüfung.
- **Variablen/Listen:** `sl_set`, `sl_get`, `sl_text`, `sl_number`, `sl_bool`, `sl_list`, `sl_list_add`, `sl_list_get`. Native Konvertierungs-, Listenkopie- und neue gezielte Lese-/Grenz-/Lastfälle. Leere, verschachtelte und unabhängige Werte geprüft.
- **Texte/Zahlen:** `sl_join`, `sl_newline`, `sl_replace`, `sl_len`, `sl_case`, `sl_contains`, `sl_math`, `sl_round`, `sl_random`. Native Unicode-Codeeinheiten, Textregeln, Rundungs-/Rechenregeln und feste Zufallsgrenze. Keine statistische Zufallsqualitätsprüfung.
- **Ein-/Ausgaben:** `sl_output`, `sl_message`, `sl_input`, `sl_question`, `sl_log`. Text-/Logausgabe tatsächlich ausgeführt. **Dialogtypen `sl_message`, `sl_input`, `sl_question` in diesem Paket nur Generator-/Parserprüfung, keine neue interaktive native Dialogbedienung.** Vorhandene historische Dialognachweise werden nicht als erneut ausgeführt ausgegeben.
- **Datum/Zeit:** `sl_date`, `sl_time`, `sl_date_format`, `sl_sleep`. Tatsächliche lokale Datumskonvertierung, Formatierung und kurze Wartezeit. Kein Zeitzonen-/Sommerzeitvolltest.

Business-Typen bleiben ausdrücklich Python-exklusiv und gehören dem Agenten Geschäftsdaten. Alle Felder/Seiteneffekte des Grundkatalogs sind durch die zentrale Bestandsaufnahme zu inventarisieren; diese Tabelle behauptet keine zusätzliche individuelle Editorprüfung jedes Typs.

## Übergabe

Nächster Schritt: unabhängiger Review der Listen-Wertsemantik und Messharness durch einen anderen Fachagenten; zentrale Wiederholung am integrierten Stand, Build/Paketprüfung und deutscher Commit/Push durch den Hauptagenten. Keine eigenen Commits oder Pushes. Produktformat, Abhängigkeiten, IPC und Prozesssteuerung unverändert.
