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

Der aktuelle praktische Stand und offene externe Einrichtungsschritte stehen ausschließlich in [ABNAHME.md](ABNAHME.md).
