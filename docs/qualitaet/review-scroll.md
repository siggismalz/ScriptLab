# Unabhängige Prüfung UX-02: Listenposition und Fokus

**Auftrag:** Die Korrektur des Hauptagenten in `src/renderer/Startbereich.tsx` lesend prüfen und einen bestehenden strengen Scrolltest sowie einen gezielten Fokusfall im echten Electron ausführen. Keine Produktdateien durch den Reviewer ändern.

**Befund des Hauptagenten:** Bei 80 Workflows, zweiter Listenseite und Rückkehr aus einem geöffneten Workflow verschob sich der Ausschnitt. Der zeitweilige Ladehinweis veränderte die Inhaltshöhe; ein dadurch ausgelöstes Scrollereignis überschrieb die gespeicherte Benutzerposition.

**Review:** Der Layout-Effekt merkt eine ausstehende Wiederherstellung während `props.laden` vor und führt sie erst mit dem fertigen Bestand aus. Der Scrollhandler speichert während Laden/Verarbeitung und in verborgenem Inhalt keine Zwischenposition. Der Fokus wird nur bei tatsächlich geänderter Ansicht beziehungsweise neuer Navigationsanforderung gesetzt. Eine reine Bestandsaktualisierung erhält so den bestehenden Arbeitskontext. Hilfesprünge bleiben im eigenen Zweig. Schema, Filter, gespeicherte Workflows und Ausführung werden nicht verändert. Im gelesenen Diff wurde kein widersprechender Vertrag gefunden.

**Unabhängiger Nachtest:**

`npx playwright test tests/desktop/gestaltung-navigation.spec.ts --grep 'größere lokale Workflowliste' --reporter=list --output=artifacts/qualitaet-desktop/agent-ux-scroll`

Ergebnis: **1 bestanden** (2,4 s Testdauer). Der unveränderte Test prüft 50 Zeilen auf Seite 1, 30 auf Seite 2, Auswahl und Rückkehr zum gespeicherten Ausschnitt. Die Abweichung von Scrollposition und Zeilen-Y muss weiterhin jeweils unter 8 logischen Pixeln liegen. Danach werden Suche und der vollständige Bestand von 80 Projekten plus einem Entwurf geprüft. Es wurde keine größere Toleranz verwendet; aus diesem Nachtest werden keine genaueren Einzelmesswerte erfunden.

**Zusätzlicher Fokusbefund und Korrektur:** Im bestehenden Startseiten-Indexfall wurde ergänzt: mit aktivem Suchfilter „Zulu“ den Bestand bewusst aktualisieren, Ende der Aktualisierung abwarten und Fokus am Auslöser sowie Filter und Ergebniszeile erhalten. Erst ohne ausdrückliches Endeabwarten war der Nachlauf grün. Die gehärtete Fassung wartet auf den wieder aktivierten Knopf und scheiterte anschließend zweimal an der Fokuserwartung. Direkte Diagnose: `document.activeElement` ist `BODY`. Der nativ deaktivierte Aktualisieren-Knopf verlor den Fokus während des Ladens und erhielt ihn nach Abschluss nicht zurück.

Der Hauptagent merkt nun ausschließlich den ausdrücklich betätigten Aktualisieren-Auslöser. Nach Ende des Ladens wird dieser nur fokussiert, wenn er noch sichtbar und verbunden ist und der aktuelle Fokus weiterhin auf `BODY` liegt. Der gelesene Diff überschreibt damit keinen bewussten Wechsel zu einem anderen Feld; automatische Aktualisierungen bekommen keine pauschale Fokusrückgabe. Diese Entscheidung ist lokal und verändert keine Geschäftsverarbeitung.

**Finale Nachprüfung:** `npx playwright test tests/desktop/startseite.spec.ts --grep 'gespeicherter Index' --reporter=list --output=artifacts/qualitaet-desktop/agent-ux-fokus-final` — **1 bestanden**, 0 fehlgeschlagen (4,1 s Testdauer). Nach diesem Fokusfix wurde auch der oben genannte strenge Scrolltest erneut ausgeführt, Ausgabe unter `agent-ux-scroll-final`: **1 bestanden**, 0 fehlgeschlagen (2,1 s), weiterhin unveränderte 8-Pixel-Schranke. Die beiden getrennten Nachprüfungen sind keine neue Gesamtsuite. Der Reviewer hat keine Produktdatei geändert.

Windows x64, Electron 45, isolierte synthetische Testprofile. Das sind technische Regressionstests, keine Aussage über sämtliche Listen-/Hilfekombinationen oder einen Anwenderstudiennachweis.
