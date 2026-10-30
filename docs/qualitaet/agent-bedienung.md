# Fachauftrag: Bedienung und gemeinsame Komponenten

## Initialanweisung und Zuständigkeit

- **Rolle und Auftrag:** Produkt/UX und Frontend. Konkrete Bedienfehler in vorhandenen Dialogen, Aktionsmenüs, Parameter- und Spaltenformularen untersuchen; einen nachgewiesenen Fehler klein korrigieren.
- **Projektkontext:** Ausgangsstand `fa6b208` auf `main`; Windows, Electron 45, React 19.3.1 und Blockly 13.4.0. Bestehende gemeinsame Komponenten und Gestaltung verwenden. Keine neue Bibliothek oder Produktfunktion.
- **Bekannte Befunde bei Start:** Noch kein bestätigter Defekt im Teilbereich. Vermutungen müssen zuerst reproduziert werden. Architektur und aktuelle Bedienung aus `docs/ARCHITEKTUR.md`, `docs/NEUE-BEDIENUNG.md`, `docs/KOMPONENTEN.md` und `docs/gestaltung/DESIGNSYSTEM.md` lesen.
- **Arbeitsbereich:** `src/renderer/komponenten/{Dialog,Menue,Feld}.tsx`, `src/renderer/{ParameterDialog,ExportDialog,SpaltenAuswahl}.tsx`; neue gezielte Qualitätsprüfungen und dieser Bericht. Keine Änderungen an zentralem Zustand, Navigation, globalen Styles/Tokens, Abhängigkeiten oder Git-Index. Build und Git-Integration beim Hauptagenten.
- **Geschützte Verträge:** Projektformat Schema 3, IDs und Sprachzuordnungen erhalten; Ansichtswechsel/Speichern/Export lösen keine Ausführung aus. Vorhandene Funktionen und Einstellungen erhalten.
- **Arbeitsschritte:** Code/Dokumentation prüfen, konkrete Reproduktion mit Erwartung und tatsächlichem Verhalten melden, lokale Korrektur vornehmen, integrierten Electron-Build prüfen.
- **Abnahme:** Nachgewiesener Tastaturfehler behoben; reguläre Navigation, Fokus, Escape und unveränderter Laufzustand nachgewiesen.
- **Rückmeldung:** Dateien, Befehle, tatsächliche Ergebnisse, offene Prüfgrenzen und nächster Integrationsschritt dokumentieren. Keine Commits/Pushes durch den Fachagenten.

## UX-01: Rückwärts-Tab aus einem Aktionsmenü überspringt die festgelegte Tab-Reihenfolge

**Priorität:** P2, Tastaturbedienung und Orientierung. Keine Abhängigkeit von neuen Funktionen.

**Reproduktion am Ausgangsstand:** Neuen VBS-Workflow öffnen, Arbeitsbereich „Ablauf“ aktiv lassen. Den Auslöser „Workflow“ fokussieren. `Shift+Tab` bei geschlossenem Menü führt regulär zum aktiven Reiter „Ablauf“. Menü über `Pfeil ab` öffnen und aus einem Menüeintrag `Shift+Tab` drücken.

**Erwartet:** Menü schließt; die normale Rückwärts-Tab-Reihenfolge führt wieder zu „Ablauf“. Inaktive Reiter bleiben aus der Tab-Reihenfolge ausgeschlossen und werden über die vorhandenen Reitertasten erreicht.

**Tatsächlich:** Die manuell ermittelte Reihenfolge berücksichtigt auch Schaltflächen mit `tabIndex=-1`. Dadurch wird „Läufe“ fokussiert, obwohl weiterhin „Ablauf“ ausgewählt und sichtbar ist. Die beiden Regressionstests scheiterten vor der Korrektur an der erwarteten Fokussierung von „Ablauf“.

**Dateien/Ursache:** `src/renderer/komponenten/Menue.tsx` suchte alle sichtbaren Schaltflächen, unabhängig von ihrer tatsächlichen Tab-Erreichbarkeit. `src/renderer/komponenten/Arbeitsbereiche.tsx` legt dagegen die korrekte Reiterreihenfolge bereits mit `tabIndex=0/-1` fest und bleibt unverändert.

**Korrektur:** Die bestehende Zielliste schließt nun negative Tab-Indizes, deaktivierte Elemente und inerte Bereiche aus. Kein neuer Fokusmanager, keine zusätzliche Bibliothek, keine Änderung des Workflowzustands.

**Abnahme:** Geschlossenes und geöffnetes Menü führen rückwärts zum selben aktiven Reiter; vorwärts zu „Rückgängig“. Escape gibt Fokus an den Auslöser zurück. Der Lauf bleibt „bereit“. Prüfung im echten Electron bei 1280 × 720 logischen Pixeln mit 200 % UI-Text, jeweils Hell und Dunkel.

## Nachweise und Grenzen

Test: `npx playwright test tests/desktop/qualitaet-bedienung.spec.ts --reporter=list`. Ausgangsstand: 2 fehlgeschlagen an der Fokus-Erwartung. Nach zentralem Build: **2 bestanden**, 0 fehlgeschlagen (2,8 Sekunden Testlauf). Tatsächlich Windows x64, Electron 45.0.0, Node 24.19.0; Prozessskalierung 100 %, 1280 × 720 logische Pixel, UI-Text 200 %.

Aktuelle Screenshots unter `artifacts/qualitaet-ux/menue-hell-200.png` und `artifacts/qualitaet-ux/menue-dunkel-200.png` wurden visuell gelesen: Menü vollständig sichtbar, Fokus auf dem ersten Menüeintrag erkennbar, wichtige Workflowaktionen erreichbar. Der frühere Fokusfehler ist über die fehlgeschlagenen Vorabtests belegt; ein separates Vorherbild wurde nicht archiviert. Die Bildprüfung ersetzt weder den Tastaturtest noch einen Test mit echten Anwendern.

Geprüfter Codebereich umfasst die sieben oben genannten Komponenten. Dialog-, Export- und Formularverträge wurden gelesen; dies belegt keine vollständige Prüfung aller Kombinationen. Eine anfängliche Vermutung über nicht sichtbaren Fokus in scrollenden Menüs ließ sich mit den angebotenen Einträgen nicht bestätigen und wurde nicht als Fehler übernommen. Keine Leistungsverbesserung behauptet. Keine Screenreaderprüfung oder Betriebssystem-Kontrastprüfung in diesem Teilauftrag.

**Nächster Schritt:** Hauptagent prüft Diff und integrierten Gesamtstand, committet und pusht. Bei späteren Änderungen an Menüreihenfolge oder Reitersteuerung die beiden fokussierten Desktoptests erneut ausführen.
