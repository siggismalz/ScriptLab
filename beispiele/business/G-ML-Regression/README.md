# Machine Learning: Zahlenwerte vorhersagen

200 synthetische Zeilen werden mit Seed 42 in 80 % Trainings- und 20 % Testdaten aufgeteilt. Nur Training lernt Vorverarbeitung und Modell. Die Qualitätsbewertung gilt für die getrennten Testdaten. 20 weitere synthetische Zeilen erhalten Vorhersagen in unveränderter Reihenfolge.

`training.csv` enthält die Textkennung `ID`, den Zahlenwert `Wert`, die Kategorie `Gruppe` und das numerische `Ziel`. Nur `Wert` und `Gruppe` sind Merkmale. Die Vorlage wandelt `Wert` und `Ziel` ausdrücklich in Zahlen um; die ID bleibt Text. Die separate Datei `neue-daten.csv` besitzt keine Zielspalte; ihre 20 Zeilen sind nicht die 40 Testzeilen der Qualitätsbewertung.

1. Unter Einstellungen → Laufzeit das optionale CPU-Paket bewusst einrichten.
2. Diese Vorlage als eigene Kopie öffnen. Unter Daten und Parameter die Quellen `Training`/`NeueDaten` und Ziele `Modell`/`Ausgabe` prüfen.
3. Unter Läufe zuerst den Prüflauf starten. Training und Zieldateien bleiben dabei nur geplant.
4. Bewusst auf echte Ausführung wechseln und starten. Unter Ergebnisse die 160 Trainings-/40 Testzeilen, MAE/RMSE/R² sowie die bestätigten Ausgabedateien prüfen. MAE und RMSE haben die Einheit der Zielwerte.

Die echte Ausführung erzeugt `modell.slmodell` und `vorhersagen.csv`; bestehende Ziele führen bewusst zum Fehler. Die Quellen bleiben erhalten. Vor einer Wiederholung andere Zielnamen wählen oder die vorhandenen eigenen Ergebnisse bewusst entfernen. Das Verfahren lässt sich im Trainingsbaustein zwischen Random Forest und PyTorch wechseln. Ein zuvor gespeichertes Modell kann mit „Modell laden“ statt erneutem Training verwendet werden. Die einfachen synthetischen Daten belegen keine Qualität für eigene Geschäftsdaten.

[ML-Anleitung und eigenständiger Export](../../../docs/ML.md)
