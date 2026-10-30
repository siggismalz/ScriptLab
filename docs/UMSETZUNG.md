# Umsetzung und Entscheidungen

ScriptLab wird zuerst für Windows 11 x64 entwickelt. Die tatsächlichen stabilen Paketversionen wurden vor der Installation über die npm-Registry und die offiziellen Quellen geprüft; die Lockdatei hält sie fest.

Die Umsetzung folgt diesen überprüfbaren Schritten:

1. Eigenes lokales Git-Projekt und reproduzierbares Electron-/React-/Vite-Grundgerüst anlegen.
2. Blockly-Zustand, geprüftes Workflowmodell und reinen VBS-Generator trennen.
3. Start → Nachricht → Textvorschau → echter Dateiexport vollständig verbinden.
4. Projekte atomar speichern, öffnen und ungespeicherte Änderungen schützen.
5. Bausteingruppen zusammen mit Generator, deutschen Hilfen und Tests vervollständigen.
6. Den festen Windows-Signaturhelper und geschützte Anwendungsupdates ergänzen.
7. Beispiele, NSIS-Paket, bewusste Release-Pipeline und Abnahmedokumentation liefern.

Diese Schritte sind im Quellcode und in den zeitnah entstandenen deutschen Commits nachvollziehbar. Das vom Nutzer bestätigte öffentliche Repository ist `siggismalz/ScriptLab`.

Wichtige Entscheidungen:

- Der Hauptprozess übersetzt das geprüfte Projekt beim Export selbst. Der Renderer kann keinen beliebigen Quelltext oder Prozessbefehl übergeben.
- Der Editor verwendet ein eigenes lokales Protokoll mit CSP, Sandbox und geprüften IPC-Absendern. Bibliotheken werden mitgeliefert; ein Entwicklungsserver ist nicht erforderlich.
- Vor Schließen und Updateinstallation fordert der Hauptprozess den aktuellen Editorstand ausdrücklich an. Ein Timeout hält das Fenster offen.
- Die VBS-Datei wird in UTF-16LE mit BOM und CRLF geschrieben; der Windows-Parser hat dieses Format ohne Ausführung akzeptiert.
- Gewöhnliche Commits erzeugen Testartefakte. Ein produktives Release benötigt einen bewussten Versionstag und erfolgreiche Prüfungen einschließlich Signaturinfrastruktur und vollständiger Lizenzbeilagen.

Aktuelle Qualitätsarbeit und ihre Grenzen stehen in [qualitaet/ARBEITSPLAN.md](qualitaet/ARBEITSPLAN.md); frühere Abnahmen behalten ihren jeweils angegebenen Stand.

## Backlog: Mail-Workflows und eigener SMTP-Dienst

Nutzerwunsch vom 30. Oktober 2026: eine einfache Mail-Karte, bevorzugt mit einem von ScriptLab selbst angebotenen SMTP-Dienst. Zunächst zurückgestellt zugunsten der ausdrücklich beauftragten ML-Workflows. Kein funktionsloser Mail-Einstieg in der Oberfläche.

Ein eigener Dienst für zuverlässigen Internetversand benötigt neben SMTP insbesondere DNS-/Domainkonfiguration, Warteschlange, Zustellversuche, sichere Betriebsregeln und nachvollziehbare Annahme-/Fehlerzustände. Vor einer Umsetzung klären, ob ein vollständiger Versanddienst oder ein Versandbaustein für einen vorhandenen Mailserver gewünscht ist. Bei letzterem zusätzlich geschützte Zugangsdaten außerhalb von Projekten/Parametern, Anhänge, bewusst freigegebenen Versand und unklare beziehungsweise teilweise Annahme ohne automatische Doppelsendung spezifizieren. Dieser Eintrag beauftragt weder neue Cloudinfrastruktur noch einen SMTP-Listener im aktuellen ML-Durchgang.

## Anschlussaufgabe: besonders lange Editorfolgen

Lineare und verzweigte 2.000-Blockbestände blockierten in wiederholten Windows-Electron-Proben beim erneuten Laden den Renderer, einschließlich CDP-Profilabschluss; der Hauptprozess blieb ansprechbar. Die gespeicherte verzweigte Datei war unabhängig gültig. Die genaue native Ursache ist nicht belegt. Einzelne rekursive Blockly-Lade-/Renderpfade sind nachgewiesen, erklären den beobachteten vollständigen Stillstand aber nicht abschließend. Eine zusätzliche Pfadtiefengrenze reichte nicht. Der aktuelle Durchgang schützt deshalb einheitlich vor mehr als 1.000 Gesamtblöcken; die fachliche Verschachtelungsgrenze bleibt 150. Dies ist eine offengelegte technische Einschränkung gegenüber dem bisher theoretisch angebotenen 2.000er Maximum, keine erreichte 2.000-Block-Abnahme.

Nachtrag aus dem Vorlagen-/UI-Durchgang am 30. Oktober: Der vorherige CI-Stand `58dc3d1` und ein neuer lokaler Integrationslauf zeigen außerdem einen intermittierenden Stillstand beim **erneuten Laden einer linearen 1.000er-Kette**. Andere Läufe desselben Falls, 601 linear und 1.000 verzweigt bestanden; das ist keine verlässlich zugesicherte 1.000er-Unterstützung. Die Traceauswertung zeigt eine nicht zurückkehrende `laden()`-Auswertung während des Blockly-Lade-/Renderabschnitts, ohne belegte Rücksetzung der Main-Projektidentität. Ursache und Korrektur bleiben offen. Nächster Schritt: korrelierte Main-/Bridge-/Renderphasen erfassen und dieselben Speicher-/Wiederladefälle reproduzieren. Keine Fristanhebung, Testdeaktivierung oder weitere Grenzsenkung nur zur Grünfärbung. Neuere Einzel- oder Gesamtlauferfolge heben diesen Befund nicht auf.

Vor einem Anheben dieser technischen Grenze: nativen Trace beziehungsweise reproduzierbares reduziertes Blockly-Beispiel ermitteln, Layout-/Renderstrategie prüfen und vollständigen Öffnen–Ändern–Speichern–Neuladen–Ausführen-Weg nachweisen. Keine Bibliotheksinternas global überschreiben und kein neues Unterprozess- oder Cloudsystem als Umgehung bauen. Neue produktive Funktionen werden in diesem Durchgang nicht umgesetzt.
