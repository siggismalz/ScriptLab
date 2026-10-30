# Befunde aus der vollständigen Desktopregression

## UX-02: Workflowliste erhält den Ausschnitt

Reproduktion: synthetische Bibliothek mit 80 Workflows, nach Namen sortieren, Seite 2 wählen, Eintrag 21 auswählen und öffnen, zurück zu Workflows. Vorher `scrollTop=987`, Zeile bei y=334; danach `scrollTop=950`, Zeile bei y=371. Die unveränderte strenge Prüfung verlangte weniger als 8 px Abweichung und schlug wiederholt fehl.

`Startbereich.tsx` stellte den Ausschnitt bereits während der Bibliotheksaktualisierung her. Der vorübergehende Ladehinweis änderte anschließend die Inhaltshöhe, und der daraus entstandene Scrollstand wurde als neuer Nutzerstand übernommen. Wiederherstellung wartet jetzt auf den geladenen Bestand; während des Ladens werden Scrollzwischenstände ignoriert. Eine reine Bestandsaktualisierung verändert keinen Eingabefokus. Es gibt keinen neuen Navigationszustand oder Workfloweffekt.

Windows-Electron-Nachtest: `npx playwright test tests/desktop/gestaltung-navigation.spec.ts --reporter=list --output=artifacts/qualitaet-desktop/navigation-final`, **3/3 bestanden**. Derselbe Ausschnitt blieb bei `987→987` und `y334→334`; die Toleranz wurde nicht vergrößert. Zusätzlich bestätigt der Test Auswahl, Suche und Listenseite. Themenwechsel, Tastatur und die anderen Navigationsfälle derselben Datei bestanden ebenfalls. Unabhängiger Review separat.

Der zusätzliche Fokusnachtest fand außerdem `BODY` als aktives Element nach abgeschlossener manueller Aktualisierung: Der nativ deaktivierte Auslöser hatte den Fokus verloren. Jetzt wird nur der ausdrücklich betätigte, weiterhin sichtbare Auslöser nach Ladeende wieder fokussiert, sofern der Nutzer nicht bereits ein anderes Feld fokussiert hat. Unabhängig: **1/1 Fokusnachtest und 1/1 strenger Scrollnachtest bestanden**, dokumentiert in [review-scroll.md](review-scroll.md).

## UX-03 (Fachagent UI-04): lesbarer Vorschauknopf

Reproduktion: Python-Workflow, CSV-Baustein konfigurieren, UI-Textgröße 200%, Eigenschaften bei 1280×720 beziehungsweise 1600×1000 öffnen. Beide vorhandenen Layoutprüfungen schlugen zweimal reproduzierbar fehl: Vorschauknopf Höhe 36 px, clientHeight 34, scrollHeight 38 bei 28-px-Schrift und 42-px-Zeilenhöhe. Das Bild zeigte den gestauchten Knopf unmittelbar unter dem Panelkopf.

Die lokale Regel `.schritt-vorschau { flex-shrink: 0; }` erhält die natürliche Höhe der bestehenden gemeinsamen Knopfkomponente im scrollbaren Flexpanel. Keine neue Schriftgröße, keine feste zusätzliche Höhe und keine globale Designänderung. Ergebnis der erneuten vorhandenen Layout-/Sichtprüfung wird im Fachbericht und Abschlussstand festgehalten.

Unveränderte Nachprüfungen: **2/2 bestanden**; in beiden Fenstergrößen jetzt Höhe 52 px, clientHeight 50, scrollHeight 50 und `flex-shrink: 0`. Der gemeinsame normale Business-Desktoplauf bestand anschließend mit **13 Fällen**, zwei optionale Lastfälle waren darin übersprungen. Die spätere zentrale Gesamtregression bestand mit **124 Desktopfällen und zwei übersprungenen Lastfällen**. Die beiden optionalen Millionenlasten wurden vom Hauptagenten danach getrennt **2/2 erfolgreich ausgeführt**; das ist ein zusätzlicher Lauf, keine umetikettierte Gesamtsuite.

## Vorbestehender Testdrift

Der erste vollständige Desktopversuch scheiterte bereits im Setup am entfernten Knopf „Neu“; die restliche serielle Gruppe konnte dadurch nicht ausgeführt werden. Weitere alte Erwartungen betrafen Projektmenüs, externe Speicherdialoge und frei wählbare Laufbasen. Diese entsprechen nicht mehr dem vor diesem Durchgang vorhandenen Produktstand. Die Fachagenten migrieren die realen UI-Wege und erhalten Sollinhalte, IDs, Originale, fehlende unbeabsichtigte Ausführung und tatsächliches Prozessende. Abgebrochener Projektdateiexport und interne Speicherung werden getrennt geprüft. Der abgebrochene Gesamtversuch wird nicht als bestandene Abnahme gezählt.
