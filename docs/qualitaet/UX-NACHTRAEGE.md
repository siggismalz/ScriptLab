# Befunde aus der vollständigen Desktopregression

## UX-02: Workflowliste erhält den Ausschnitt

Reproduktion: synthetische Bibliothek mit 80 Workflows, nach Namen sortieren, Seite 2 wählen, Eintrag 21 auswählen und öffnen, zurück zu Workflows. Vorher `scrollTop=987`, Zeile bei y=334; danach `scrollTop=950`, Zeile bei y=371. Die unveränderte strenge Prüfung verlangte weniger als 8 px Abweichung und schlug wiederholt fehl.

`Startbereich.tsx` stellte den Ausschnitt bereits während der Bibliotheksaktualisierung her. Der vorübergehende Ladehinweis änderte anschließend die Inhaltshöhe, und der daraus entstandene Scrollstand wurde als neuer Nutzerstand übernommen. Wiederherstellung wartet jetzt auf den geladenen Bestand; während des Ladens werden Scrollzwischenstände ignoriert. Eine reine Bestandsaktualisierung verändert keinen Eingabefokus. Es gibt keinen neuen Navigationszustand oder Workfloweffekt.

Windows-Electron-Nachtest: `npx playwright test tests/desktop/gestaltung-navigation.spec.ts --reporter=list --output=artifacts/qualitaet-desktop/navigation-final`, **3/3 bestanden**. Derselbe Ausschnitt blieb bei `987→987` und `y334→334`; die Toleranz wurde nicht vergrößert. Zusätzlich bestätigt der Test Auswahl, Suche und Listenseite. Themenwechsel, Tastatur und die anderen Navigationsfälle derselben Datei bestanden ebenfalls. Unabhängiger Review separat.

## UX-03 (Fachagent UI-04): lesbarer Vorschauknopf

Reproduktion: Python-Workflow, CSV-Baustein konfigurieren, UI-Textgröße 200%, Eigenschaften bei 1280×720 beziehungsweise 1600×1000 öffnen. Beide vorhandenen Layoutprüfungen schlugen zweimal reproduzierbar fehl: Vorschauknopf Höhe 36 px, clientHeight 34, scrollHeight 38 bei 28-px-Schrift und 42-px-Zeilenhöhe. Das Bild zeigte den gestauchten Knopf unmittelbar unter dem Panelkopf.

Die lokale Regel `.schritt-vorschau { flex-shrink: 0; }` erhält die natürliche Höhe der bestehenden gemeinsamen Knopfkomponente im scrollbaren Flexpanel. Keine neue Schriftgröße, keine feste zusätzliche Höhe und keine globale Designänderung. Ergebnis der erneuten vorhandenen Layout-/Sichtprüfung wird im Fachbericht und Abschlussstand festgehalten.

## Vorbestehender Testdrift

Der erste vollständige Desktopversuch scheiterte bereits im Setup am entfernten Knopf „Neu“; die restliche serielle Gruppe konnte dadurch nicht ausgeführt werden. Weitere alte Erwartungen betrafen Projektmenüs, externe Speicherdialoge und frei wählbare Laufbasen. Diese entsprechen nicht mehr dem vor diesem Durchgang vorhandenen Produktstand. Die Fachagenten migrieren die realen UI-Wege und erhalten Sollinhalte, IDs, Originale, fehlende unbeabsichtigte Ausführung und tatsächliches Prozessende. Abgebrochener Projektdateiexport und interne Speicherung werden getrennt geprüft. Der abgebrochene Gesamtversuch wird nicht als bestandene Abnahme gezählt.
