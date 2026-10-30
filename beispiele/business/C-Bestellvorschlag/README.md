# Bestellvorschlag aus synthetischem Lagerbestand

Dieses Beispiel verwendet ausschließlich erfundene Testdaten. In `Lager.xlsx` liegt Artikel A fünf Stück unter seinem Mindestbestand; sein Zielbestand von 20 ergibt eine Bestellung über 15 Stück. Artikel C hat Bestand 0, Mindestbestand 5 und Zielbestand 12: weitere 12 Stück. Beide gehören zu Lieferant S1. Artikel B ist ausreichend bevorratet und wird nicht bestellt.

Der Ablauf prüft die Eingaben, filtert Unterbestände, berechnet Zielbestand minus Bestand und erzeugt aus der DOCX-Vorlage **ein Dokument je Lieferant**. Erwartet wird `ausgaben/Bestellung-S1.docx` mit zwei Positionen und insgesamt 27 Stück. Platzhalter dürfen im Ergebnis nicht übrig bleiben. Die Vorlage enthält keine Makros oder externen Vorlagenverknüpfungen.

`parameter.json` enthält die nicht geheimen, relativ zum Beispielordner aufgelösten Pfade und ein festes Testdatum. Öffnen und Vorschau erzeugen keine Bestellung. Ein ausdrücklich gestarteter echter Ablauf schreibt die DOCX-Datei. Ein vorhandenes Ziel wird mit der Regel `FEHLER` erhalten.

Die Vorlage ist als ruhiger A4-Bestellvorschlag gestaltet. Lieferant und Bestelldatum stehen vor den Positionen; alle Mengen sind Stückzahlen. Die Tabelle zeigt Artikel, aktuellen Bestand, Zielbestand und die daraus berechnete Bestellmenge. Die Gesamtmenge steht darunter. Absender, Anschrift und Kontaktdaten sind in diesen Testdaten nicht enthalten und werden nicht erfunden. Das Dokument bleibt ein Vorschlag zur fachlichen Prüfung.

Für eine eigene Vorlage kannst du Schrift, Abstände und statische Texte in einer Kopie ändern. Die erste Tabelle enthält in ihrer zweiten Zeile die Musterposition. Diese Zeile und die vorhandenen Platzhalter müssen erhalten bleiben:

- `{{Lieferant}}`, `{{Datum}}` und `{{Gesamtbestellmenge}}` für die allgemeinen Angaben.
- `{{Position.Artikel}}`, `{{Position.Bestand}}`, `{{Position.Zielbestand}}` und `{{Position.Bestellmenge}}` für jede Position.

Die Gestaltung der mitgelieferten Vorlage lässt sich aus dem Projektordner mit `python -B scripts/vorlage-bestellung-erstellen.py` erneut erzeugen. Dafür wird die bereits vorhandene Bibliothek `python-docx` benötigt. Auch der vorhandene Neuaufbau synthetischer Beispieldateien verwendet diesen Generator. Er gehört zur Entwicklung; das Ausführen des Workflows startet ihn nicht.
