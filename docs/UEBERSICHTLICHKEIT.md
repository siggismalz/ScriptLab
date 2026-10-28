# Behutsam gestraffte Oberfläche

Stand: 28. Oktober 2026. Navigation, Farben und direkt erreichbare Aktionen bleiben erhalten. Die Änderung konzentriert sich auf Wiederholungen, Gewichtung und die Höhe der Arbeitsansichten.

## Sichtbare Änderungen

- **Start:** Der aktive Workflow steht einmal unter „Zuletzt geöffnet“, mit „Weiterbearbeiten“. Die Zuordnung verwendet die Workflowkennung; gleiche Namen werden nicht verwechselt. Insgesamt erscheinen höchstens fünf Zeilen. Auch ein noch ungespeicherter Workflow kann direkt fortgesetzt werden. Die vier Einstiegskarten sind kompakter.
- **Rückmeldungen:** Der Projektkopf zeigt den Speicherzustand auch bei vergrößerter Schrift. Die Statusleiste wiederholt ihn nicht. Erfolgsbestätigungen verschwinden nach vier Sekunden beziehungsweise beim Verlassen ihres Kontexts. Fehler bleiben einmal vollständig und schließbar sichtbar. Ein abgebrochener Folgeversuch bringt keine alte Fehlermeldung zurück.
- **Daten:** Normale Schritte sind weniger stark hervorgehoben als die Auswahl. Oben stehen Fehleranzahl und kurze Feldverweise; die vollständige Erklärung steht einmal am Feld. Übergreifende Meldungen bleiben ausgeschrieben. „Baustein anzeigen“ sitzt im Abschnittskopf. Vorschautypen heißen beispielsweise „Text“ oder „Ganze Zahl“; der Originaltyp bleibt zusätzlich zugänglich.
- **Läufe:** „Alle Läufe“ und die Ansichten verwenden eine gemeinsame Kopfleiste. Die zusätzliche Arbeitsstandleiste entfällt. Historische Läufe nennen weiterhin Datum, tatsächlichen Modus und Standkennung. Start und Stoppen bleiben direkt erreichbar.

Projektformat, Ausführungslogik und gespeicherte Inhalte wurden nicht geändert. Die technischen UI-Ergänzungen sind die aktive Workflowkennung und ein optionaler Navigationsplatz im Laufkopf.

## Tatsächlicher Sichtstand

Die [Galerie](uebersicht/ANSICHTEN.html) zeigt vorherige und aktuelle Windows-Ansichten mit synthetischen Testdaten. Der [Einzelnachweis](uebersicht/sichtstand.json) nennt den isolierten Profilordner und die tatsächlich durchlaufenen Wege. Dateidialoge wählten dafür feste Testpfade; Vorschau, Prüflauf und der gestoppte Pythonprozess sind echt.

Geprüft wurden Fortsetzen ohne erneutes Laden oder Laufstart, erhaltene Bausteine/Zoom/Speicherzustand, Feldkorrektur, Schrittvorschau, Laufhistorie, Start/Stop nach einem Ansichtswechsel sowie vorübergehende Bestätigungen und dauerhafte Fehler. Die Ansichten wurden in beiden Themen bei 1280 × 720 logischen Pixeln angesehen; hinzu kommen ein schmales Fenster und 200 Prozent UI-Text. TypeScript, Produktionsbuild und die gezielt betroffenen vorhandenen Komponentenprüfungen wurden geprüft.

Dies ist eine eigene Sichtprüfung, kein Nutzertest. Eine neue vollständige VBS-/Python-Regression, sämtliche Windows-DPI-Stufen, Monitorwechsel und eine vollständige Barrierefreiheitsabnahme wurden nicht durchgeführt. Der lokale Installer bleibt unsigniert. Die bisherigen Nachweise der [Office-Umstellung](OFFICE-UMSETZUNG.md) bleiben separat erhalten.
