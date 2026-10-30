# Machine Learning: Umsetzung und Zuständigkeiten

Ausgang: sauberer Arbeitsbaum `main/8496feb`, Windows 11 x64, Node 24.19.0, Electron 45, React 19, Blockly 13, CPython 3.15.2. Nutzer bestätigt spezialisierten Bausteinbereich, Tabellen trainieren/vorhersagen, CPU und optionales Zusatzpaket. Keine GPU-, Bild-, Text-, AutoML- oder Cloud-Erweiterung.

## Geschützte Verträge

Python/VBS bleiben Ausführungssprachen. Schema 4 ergänzt `workflowArt: allgemein|ml`, ML verlangt Python. Formate 1–3 werden ohne Schreiben der Quelle übernommen; IDs, Sprache, Konfiguration, Parameter und Canvas bleiben erhalten. Hashes allgemeiner Workflows verwenden weiterhin die fachliche Schema-3-Darstellung ohne Ansicht, damit Migration keine Änderung vortäuscht. Journalidentität und Laufzeitfingerabdruck werden deshalb nicht gelockert.

Eine Registry steuert Palette, Suche und fachliche Prüfung. Die normale Palette bleibt im bisherigen Umfang. ML kombiniert Start/Kommentar, vorhandene CSV-/XLSX-Tabellenschritte und vier neue Typen `sl_biz_ml_train/save/load/predict`; Operationen heißen `ml.trainieren/speichern/laden/vorhersagen`. Kein freier Python-, Shell- oder Pakettext.

Train: Eingabe `tabelle`, Ausgabe `MLModell`, Konfiguration `aufgabe` (KLASSIFIKATION/REGRESSION), `verfahren` (RANDOM_FOREST/PYTORCH), `zielspalte`, `merkmale`, `testanteil=0.2`, `zufallsseed=42`, `baeume=100`, `max_tiefe=12`, `epochen=50`. Save: `modell` → Datei, `pfad=modell.slmodell`, `konflikt=FEHLER`. Load: `pfad` → MLModell. Predict: `modell,tabelle` → Tabelle, `ausgabespalte=Vorhersage`.

Vorverarbeitung lernt nur aus Trainingsdaten; Klassifikation verwendet geschichtete Testaufteilung. Fehlende Ziele und unbrauchbare Spalten werden abgewiesen. Kein Refit auf 100 %. Modelle enthalten festes Format/Version/Spaltenschema; Sklearn nur feste skops-Typen, Torch nur Gewichte bekannter Architektur. Keine beliebigen Pickleimporte. Training und Speicherung nur in echter Ausführung, geplante Ergebnisse dürfen keine vorgetäuschten Vorhersagen erzeugen. Bereits gespeicherte Modelle sind ausdrücklich lesend verwendbar.

## Agentenaufträge und Schreibbesitz

Alle Agenten wurden mit vollständigen konkreten Aufträgen erneut tatsächlich gestartet. Gemeinsamer Arbeitsbaum, ausschließlich Root verwendet Git/Index/Push und baut die gesamte App. Keine parallelen Electron-Prüfungen; UI-Slot wird ausdrücklich vergeben.

- **Businessdaten / ML-Verarbeitung:** ausschließlich neues `laufzeit/scriptlab_ml`, kleine Python-Integration in Business-Ausführung/Typen/Kontext, `tests/business/test_ml.py` und `ML-VERARBEITUNG.md`. CPU-RF/MLP, Datenaufteilung, Modellformat, Ereignisse und synthetische echte Dateitests. Keine eigene Paketinstallation. Interpreter mit Runtimeagent abstimmen. Eingabe-/Ausgabeverträge vor Umsetzung bestätigen, Fehler/Tests/Grenzen zurückmelden.
- **Ausführung / ML-Laufzeit:** ausschließlich neue ML-Runtime-/Statusmodule, ML-Skripte, gepinnte Requirements/Profilmanifest/Lizenzbeilagen, eigene Runtime-Tests und `ML-LAUFZEIT.md`. Private vollständige Kopie der Basis, ensurepip nur im Ziel, feste Offlineinstallation hashbestätigter Wheels, eigener Integritätsvertrag und atomare Profilaktivierung. Online-/Offlineversorgung und Abbruch tatsächlich prüfen; Interpreter an Backendagent melden. Keine globale Installation, keine Basisänderung oder frei gewählten Pakete.
- **Bedienung / Frontend:** ausschließlich Sprachwahl/CSS, Palette, neue MlLaufzeit-/MlErgebnis-Komponenten, eigene Unit-/Desktopfälle und `ML-BEDIENUNG.md`. Dritte Karte, fachlich reduzierte Palette, kontrollierte Komponenten ohne eigene Installationseffekte, bestätigte Metriken, native Tastatur-/Fokusbedienung in beiden Themen und bei großer Schrift. Desktop erst nach Root-Build; keine neuen gemeinsamen Verträge erfinden.
- **Root:** Projektformat/Registry/Katalog/Validierung, Main/Preload/IPC, zentrale Anwendung, Einstellungen-/Testintegration, Export, Beispiele, Dokumentation, unabhängiger Review und Gesamtprüfung. Fachagenten prüfen nach Abschluss zusätzlich gegenseitig riskante Änderungen lesend.

## Abnahme und Integration

Pakete: (1) kompatible Workflowbasis, (2) isolierte optionale Laufzeit, (3) ML-Verarbeitung und sichtbare Bedienung, (4) unabhängiger Export, Vorlagen und paketierte Windows-Abnahme. Jeder fachlich fertige Schritt erhält passende Prüfung, vollständigen Diffreview und deutschen Commit/Push. Keine Tags oder Releases.

Nachweise müssen den tatsächlich geprüften Stand nennen: alte Formate und Hashes, Bearbeiten ohne ML-Paket, sichere fehlgeschlagene Einrichtung, beide Backends/Aufgaben, getrennte Testdaten, Persistenzgleichheit, falsche Spalten/Modelle, geplanter Lauf ohne Training, tatsächlicher Abbruch, eigenständiger Export bei geschlossener App, UI-Themen/Textgröße und paketierter Betrieb. Kleine und größere synthetische Tabellen getrennt messen; keine unbelegte Leistungszusage. Vorbestehende 1000er-Lade-/Farbschema-CI-Befunde bleiben getrennt offen.
