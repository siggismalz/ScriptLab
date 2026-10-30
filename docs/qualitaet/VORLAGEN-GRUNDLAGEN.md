# Die sechs Grundvorlagen

## Auftrag und Schreibbereiche

Fachagent Ausführung/VBS, Ausgangspunkt `main/58dc3d1`, 30.10.2026. Die drei vorhandenen Aufgaben **Nachricht, Dateisicherung und Dateinamenliste** in ihren Python- und VBS-Fassungen verständlicher und direkt mit synthetischen Daten prüfbar machen. Keine zusätzlichen Bausteintypen, Geschäftsoperationen oder Migration vorhandener Nutzerprojekte. Erhalten bleiben Dateinamen, Schema 1 beziehungsweise 2, Sprachzuordnung, Projektkennungen und sämtliche ursprünglichen Block-IDs; pro Vorlage kommt ein bestehender Kommentarbaustein hinzu.

Schreibbesitz: `beispiele/01-Begruessung.scriptlab` bis `06-Python-Dateinamenliste.scriptlab`, `beispiele/grunddaten/`, `tests/vorlagen-grundlagen.test.ts` und dieses Dokument. Root verantwortet Vorlagenmetadaten, Auswahloberfläche, Main-Kopierdienst, Abhängigkeiten, Build und Git. Main, IPC und Generatoren wurden für dieses Paket vom Fachagenten nicht geändert.

Arbeitsfolge: vorhandene Projektdateien, Pfade und Generatorverhalten untersuchen; Kopiervertrag mit Root abstimmen; kleine Korrekturen an den bestehenden Abläufen; Struktur-/Blockly-Rundreise und tatsächliche Dateiergebnisse für beide Sprachen prüfen; Grenzen und Integrationsbedarf zurückmelden.

## Ausgangsbefunde und Abnahme

| Kennung / Priorität | Reproduktion und Istzustand                                                                                                                                                                                                                                                                                                                               | Erwartung und Abnahme                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRUND-01 / P1       | Frische Backupvorlage verwenden: Im privaten Arbeitsordner fehlt `ScriptLab-Testdaten/Backup/Quelle/beispiel.txt`. Der SONST-Zweig zeigt lediglich eine Nachricht und endet ohne Sicherung regulär. Das ist durch den bestehenden Ablauf und beide Generatorausgaben belegt; der ursprüngliche interaktive Dialog wurde in diesem Paket nicht ausgeführt. | Mitgelieferte synthetische Quelle bei ausdrücklich gewählter Vorlage bereitstellen. Fehlt sie später, muss der Lauf mit Fehler enden, ohne Sicherung oder Erfolgsmeldung. Native Nachweise für beide Sprachen bestanden.                     |
| GRUND-02 / P1       | Frische Dateilistenvorlage ausführen: `ScriptLab-Testdaten/Dateiliste/Eingang` fehlt, obwohl die Aufgabe als Einstieg angeboten wird. Eingänge mussten bisher manuell angelegt werden. Die Ressourcen fehlten im ursprünglichen Bestand.                                                                                                                  | Nur bei bewusster Vorlagenverwendung private synthetische Eingänge kopieren. Ergebnis enthält genau die drei unmittelbaren Dateinamen, keinen Unterordnerinhalt. Native Ergebnisnachweise bestanden; Root verantwortet die Main-Integration. |
| GRUND-03 / P2       | Backup/Dateiliste schließen mit einem blockierenden Nachrichtendialog. Die Beschreibungen nennen nur den externen Start; beide Python-Dateivorlagen sprechen sogar von einer VBS-Datei.                                                                                                                                                                   | Editorlauf und eigenständigen Export korrekt erklären. Dateiabläufe bestätigen ihr Ergebnis durch den bestehenden Textausgabebaustein. Die Begrüßung bleibt die ausdrückliche Nachrichtendemo.                                               |

Eine fehlende Quelle ist jetzt im bestehenden Wenn/Sonst-Ablauf erklärt. Der Kopierschritt folgt anschließend außerhalb der Verzweigung: Er prüft die Quelle mit der vorhandenen Generatorhilfe und beendet bei fehlender Quelle tatsächlich mit Fehler. Nur der erfolgreiche Kopierschritt erreicht die Erfolgsausgabe. Die vorhandene Konfliktregel `FEHLER` bleibt erhalten. Ein erneut ausgeführtes Backup überschreibt daher keine vorhandene Sicherung.

Die Dateinamenliste behält den vorhandenen Lehrablauf **Liste lesen → Überschrift schreiben → Namen in Schleife ergänzen**. Das vollständige Lesen des Eingangs vor dem Schreiben schützt die alte Ergebnisliste bei fehlendem Eingang. Der vorhandene ausdrücklich ersetzende Schreibschritt bleibt sichtbar und wird erklärt. Es wurde keine Leistungssteigerung behauptet oder gemessen.

## Ressourcen- und Pfadvertrag

Mit Root vor dem Anlegen abgestimmt:

| Vorlage                | Ausschließlich zu kopierende Quelle | Ziel im neu angelegten privaten Arbeitsordner |
| ---------------------- | ----------------------------------- | --------------------------------------------- |
| Backup, Python/VBS     | `beispiele/grunddaten/Backup`       | `ScriptLab-Testdaten/Backup`                  |
| Dateiliste, Python/VBS | `beispiele/grunddaten/Dateiliste`   | `ScriptLab-Testdaten/Dateiliste`              |
| Nachricht, Python/VBS  | keine                               | keine                                         |

Die Ressourcen enthalten nur eine synthetische Backupquelle, drei synthetische unmittelbare Listendateien und eine ausdrücklich ausgeschlossene Datei in einem Unterordner. Es werden weder Sicherung noch Ergebnisliste ausgeliefert. Kopieren ausschließlich nach bewusster Vorlagenwahl, in einen neuen UUID-Arbeitsordner, ohne Überschreiben. Das bloße Anzeigen einer Vorlage oder Öffnen eines eigenen vorhandenen Projekts kopiert oder verarbeitet keine Daten. Diesen Main-Vertrag prüft Root gesondert.

Die relativen Workflowpfade ändern sich nicht. Im Editor gilt der zugeordnete Arbeitsordner, im eigenständigen Skript der Skriptordner. Beim eigenständigen Export muss der Anwender den beschriebenen `ScriptLab-Testdaten`-Ordner neben das exportierte Skript kopieren. Die Grundvorlagen benötigen keine zusätzlichen Python-Pakete.

Erwartete Ergebnisliste, unabhängig von Implementierungshelfern als Sollwert geprüft:

```text
Dateinamen im Testordner:
01-Bericht.txt
02-Notizen Größe.txt
03-Werte.csv
```

Zeilenenden CRLF, UTF-8; ein vorhandener UTF-8-BOM wird beim inhaltlichen Vergleich zugelassen. Der Inhalt der Dateien wird für diese Namensliste nicht ausgewertet. Die Eingänge bleiben bytegleich. Bei leerem Eingang bleibt nur die Überschrift.

## Tatsächliche Prüfungen

Umgebung: Windows 11 Build 26200, x64, Node **24.19.0**, gebündeltes CPython **3.15.2**, Blockly **13.4.0**. Geprüfter Stand: Ausgangscommit plus dieses Paket im Arbeitsbaum; parallele fremde Änderungen wurden nicht übernommen oder verändert.

| Status    | Befehl / Nachweis                                                                                                                                   | Ergebnis                                                                                                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bestanden | `SCRIPTLAB_RUNTIME_TESTS=1 npx vitest run tests/vorlagen-grundlagen.test.ts tests/beispiele.test.ts` (PowerShell: Umgebungsvariable vorher gesetzt) | **33/33**, 4,60 s Gesamtlauf. 24 neue Fälle und 9 bestehende Beispielfälle.                                                                                                                                                                                                                                                                           |
| bestanden | 8 neue Struktur-/Rundreisefälle                                                                                                                     | Alle sechs Projekte geprüft, in Blockly geladen/gespeichert, alle ursprünglichen IDs und Sprachen erhalten, Vorschau und Export identisch, Testfassung ohne Generatorfehler. Reine Vorbereitung verändert keine ausgelieferte Quelldatei. Beide Sprachen enthalten dieselben fachlichen Abläufe.                                                      |
| bestanden | 16 neue native Ergebnisfälle                                                                                                                        | Je Sprache: Backup und Dateiliste sowohl als Testfassung mit ausdrücklicher Basis als auch als eigenständiger Export bei fremdem Prozessarbeitsordner; außerdem vorhandenes Backupziel, fehlende Backupquelle, leerer und fehlender Listeneingang. Bytevergleiche von Quellen und Zielen, feste Sollnamen, Originalschutz und tatsächliche Exitcodes. |
| bestanden | Bestehende Windows-Parseprüfung                                                                                                                     | Alle drei VBS-Exporte syntaktisch geprüft, ohne Eintritt in die Ausführung. Bestandteil der genannten 9 bestehenden Fälle.                                                                                                                                                                                                                            |
| bestanden | `npm run check`                                                                                                                                     | TypeScript ohne Fehler.                                                                                                                                                                                                                                                                                                                               |
| bestanden | `git diff --check --` mit den sechs Vorlagen und der neuen Testdatei                                                                                | Keine Leerraumfehler.                                                                                                                                                                                                                                                                                                                                 |

Die nativen Proben verwenden eigene temporäre Ordner mit Leerzeichen und Umlaut, feste `cscript.exe`- beziehungsweise Python-Aufrufe und begrenzte 30-Sekunden-Hoststarts entsprechend der vorhandenen Semantiksuite. Python wird direkt mit **`-I -B -u -X utf8`** gestartet, damit im geprüften Bündel keine Bytecode-Caches entstehen. VBS wird unter `cscript.exe` mit Unicodeausgabe ausgeführt; stdout/stderr werden in eigene Dateien aufgenommen. Nach Ende aller Prozesse werden ausschließlich die geprüften eigenen Tempordner entfernt. Es wurden keine Unternehmensdateien benutzt.

Ein erster Gesamtlauf hatte **32 bestanden / 1 fehlgeschlagen**: Die neue Erwartung für den Python-Fehlerort nahm irrtümlich die VBS-Zuweisungs-ID `beispiel_7` an. Python markiert den konkret fehlgeschlagenen Wertbaustein `beispiel_6`. Die Regression erwartet nun jeweils die tatsächlich zuständige unveränderte Sprachzuordnung. Dafür wurde kein Produktcode geändert. Anschließend bestand der oben genannte gemeinsame 33er-Lauf.

Danach wurde nur der Erklärsatz „Im Editor erscheint das Ergebnis im Laufprotokoll“ präzisiert und die bestehende Rundreiseprüfung um erhaltene IDs und Kommentartexte ergänzt. Die reine Nachprüfung mit `SCRIPTLAB_RUNTIME_TESTS=0 npx vitest run tests/vorlagen-grundlagen.test.ts` bestand mit **8 bestanden / 16 ausdrücklich übersprungen** in 0,832 s. Die 16 nativen Proben wurden für diesen reinen Nachtest bewusst nicht gestartet; am fachlichen Ablauf änderte sich nach ihrem erfolgreichen Lauf nichts. Alle eigenen nativen Prozesse waren vor Beginn der separaten Desktopabnahme beendet.

## Unabhängiger technischer Review der Root-Integration

Lesend geprüft wurden `LICENSE.txt`, Paket-/Lockmetadaten, `electron-builder.yml`, `scripts/lizenzhinweise.mjs`, `src/main/business-export.ts`, `src/main/grundvorlagen.ts` und ihre Main-Aufrufe. Kein technischer Blocker im geprüften Diff gefunden: Lizenztext und sichtbare Kurzfassung unterscheiden private kostenlose und separat vereinbarte kommerzielle Nutzung; Exporterlaubnis und Drittanbieterrechte bleiben ausdrücklich erhalten. Es gibt keine hinzugefügte Zahlungs-, Aktivierungs- oder DRM-Logik. Die Exportbeilage wird in Entwicklung aus der Projektwurzel und im Paket aus der Ressourcenwurzel gelesen; der Laufzeitcode bleibt unverändert. Dies ist keine juristische Prüfung oder Freigabe.

Die Grunddatenkopie hängt ausschließlich am ausdrücklich gewählten Beispielaufruf mit festem ID-Katalog. Main erzeugt eine neue UUID; `arbeitsordnerFuer` validiert sie. Der Kopierdienst legt den Zielordner exklusiv an und verwendet `errorOnExist: true, force: false`. Er kann deshalb keinen belegten Workflow-Arbeitsordner vermischen oder überschreiben. Normales Projektöffnen ruft diesen Dienst nicht auf. Bei einem Kopierfehler kann ein neuer unbenutzter UUID-Ordner zurückbleiben; die Aktivierung erfolgt erst nach erfolgreicher Kopie. Der Review startete keine zusätzliche UI-, Native-, Build- oder Installerprüfung und änderte keine Rootdatei.

## Grenzen und nächste Integration

- Die Begrüßung wurde bewusst nicht interaktiv ausgeführt. Ihr bestehender Nachrichtentyp sowie beide Generator-/Blockly-Wege und der nicht ausführende VBS-Parser wurden geprüft. Dialogbedienung gehört zu den getrennten UI-Nachweisen.
- Die neuen Dateiläufe wurden tatsächlich außerhalb der geöffneten ScriptLab-Anwendung ausgeführt. Die Integration von Vorlagenwahl, Main-Kopie und Editorprotokoll sowie die sichtbare Anordnung übernimmt Root mit dem UI-Agenten; dieser Fachtest allein ist kein abgeschlossener Desktop-/Installer-Nachweis.
- `sl_output` erzeugt im Editor und unter `cscript.exe` Protokoll-/Konsolentext. Der Windows-Fensterhost `wscript.exe` zeigt weiterhin Textausgaben als Nachricht an. Die bestehende Generatorbedeutung wurde nicht geändert.
- Es gibt keine automatische Rückabwicklung von Dateieffekten, keine Leistungszusage für große Dateilisten und keine neuen Geschäftsbausteine. Build, Paketprüfung, Commit und Push bleiben Root vorbehalten.
