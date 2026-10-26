# Bestellvorschlag aus synthetischem Lagerbestand

Dieses Beispiel verwendet ausschließlich erfundene Testdaten. In `Lager.xlsx` liegt Artikel A fünf Stück unter seinem Mindestbestand; sein Zielbestand von 20 ergibt eine Bestellung über 15 Stück. Artikel C hat Bestand 0, Mindestbestand 5 und Zielbestand 12: weitere 12 Stück. Beide gehören zu Lieferant S1. Artikel B ist ausreichend bevorratet und wird nicht bestellt.

Der Ablauf prüft die Eingaben, filtert Unterbestände, berechnet Zielbestand minus Bestand und erzeugt aus der DOCX-Vorlage **ein Dokument je Lieferant**. Erwartet wird `ausgaben/Bestellung-S1.docx` mit zwei Positionen und insgesamt 27 Stück. Platzhalter dürfen im Ergebnis nicht übrig bleiben. Die Vorlage enthält keine Makros oder externen Vorlagenverknüpfungen.

`parameter.json` enthält die nicht geheimen, relativ zum Beispielordner aufgelösten Pfade und ein festes Testdatum. Öffnen und Vorschau erzeugen keine Bestellung. Ein ausdrücklich gestarteter echter Ablauf schreibt die DOCX-Datei. Ein vorhandenes Ziel wird mit der Regel `FEHLER` erhalten.
