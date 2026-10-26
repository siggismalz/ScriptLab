# Bewusst gestartete Workflowtests

Der Erweiterungsauftrag vom 26.10.2026 ersetzt das frühere Ausführungsverbot. Ausschließlich „Testen“ startet den vollständigen aktuellen Editorstand. Öffnen, Wiederherstellen, Speichern, Vorschau und Export bleiben ohne Workflowausführung. Frühere Abnahmen dokumentieren ihren damaligen Umfang und werden als historisch gekennzeichnet.

Der bestehende Generator erhält einen Testkontext mit ausdrücklich gewähltem Basisordner und zufälligem Laufkennungstoken. Ein Export verwendet weiterhin seinen eigenen Scriptordner. Der getestete Quelltext und seine Zeilenkarte gehören zu einem unveränderlichen Stand. Ergebnis und Speicherstatus bleiben getrennt.

Ein fester Windows-Helper startet ausschließlich den Windows-Scripthost cscript mit getrennten Argumenten, Unicodeausgabe und normalen nativen Dialogen. Ein Windows-Jobobjekt und eine Kontrollpipe binden seinen Lebenszyklus an ScriptLab. Jeder erste echte Probelauf besitzt bereits ein Zeitlimit und Stoppen. Keine Rechteerhöhung, Richtlinienänderung oder allgemeine Prozessschnittstelle wird ergänzt.

Die Oberfläche erhält Testen, Stoppen und ein verstellbares Textpanel. Während eines Tests bleiben Auswahl und Ansicht nutzbar, inhaltliche Änderungen gesperrt. Projektwechsel, Startseite, Schließen und Updateinstallation warten nach Bestätigung auf den tatsächlichen Prozessabschluss und behandeln anschließend ungespeicherte Änderungen.

Prüfungen verwenden ausschließlich isolierte Testverzeichnisse. Native Dialoge, Prozessende, Unicode, große Ausgaben, Dateiergebnisse, Zeitlimit und unerwartetes Ende werden unabhängig nachgewiesen. Die tatsächlichen Ergebnisse und Grenzen stehen nach Abschluss in TESTLAUF.md.
