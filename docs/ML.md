# Machine Learning mit ScriptLab

ScriptLab kann aus Tabellendaten ein Modell für **Klassifikation** oder **Regression** trainieren und damit neue Zeilen vorhersagen. Klassifikation sagt eine Kategorie voraus, Regression einen Zahlenwert. Zur Wahl stehen **Random Forest** und ein festes neuronales Netz mit **PyTorch**, jeweils auf der CPU. GPU, AutoML, Bild-/Sprachmodelle und frei eingefügter Pythoncode sind nicht Teil dieses Bereichs.

## Einen ML-Workflow öffnen

Unter **Neuer Workflow** stehen Python, VBS und **Machine Learning** zur Auswahl. Machine Learning verwendet ebenfalls Python; es ist keine dritte Scriptsprache. Seine Palette enthält Start/Kommentar, ausgewählte vorhandene CSV-/XLSX- und Tabellenaktionen sowie die vier Modellaktionen. Allgemeine Python- und VBS-Workflows behalten ihren bisherigen Katalog. Sprache und Art eines bestehenden Workflows bleiben festgelegt.

Für den Einstieg gibt es unter den insgesamt **13 Vorlagen** zwei ML-Beispiele:

- [Machine Learning: Kategorien erkennen](../beispiele/business/F-ML-Klassifikation/README.md).
- [Machine Learning: Zahlenwerte vorhersagen](../beispiele/business/G-ML-Regression/README.md).

Wähle die Karte, lies Vorbereitung und Ergebnis und betätige **Als Vorlage öffnen**. Es entsteht eine eigene bearbeitbare Kopie mit synthetischen CSV-Daten. Die Vorlage bleibt erhalten. Öffnen und Auswählen starten weder Training noch Paketeinrichtung.

Beide Beispiele verwenden 200 Zeilen für Training und unabhängige Testbewertung. Mit den Vorgaben sind das 160 Trainings- und 40 Testzeilen. Weitere 20 Zeilen erhalten Vorhersagen; diese 20 Zeilen sind nicht die unabhängigen Testdaten der Qualitätsbewertung. Bei echter Ausführung entstehen `modell.slmodell` und `vorhersagen.csv`. Bestehende Ziele führen in den Vorlagen bewusst zum Fehler, statt unbemerkt überschrieben zu werden.

## Das optionale CPU-Paket einrichten

Die normale Python-/Business-Grundausstattung wird mit ScriptLab geliefert. Die zusätzlichen ML-Komponenten sind ein optionales eigenes Profil. Ohne dieses Paket kannst du ML-Workflows bearbeiten, speichern und exportieren; die Ausführung mit dem ML-Profil benötigt seine erfolgreiche Einrichtung.

1. **Einstellungen → Laufzeit** öffnen und **Machine-Learning-Komponenten** suchen.
2. **CPU-Paket online einrichten** wählen oder mit **Offline-Paketordner verwenden** den vollständigen vorbereiteten Wheelsatz auswählen.
3. Die gemeldeten Phasen und das tatsächliche Ende abwarten. **Vorgang abbrechen** fordert den Abbruch an; die Bereinigung und das Prozessende können noch folgen.
4. Mit **ML-Komponenten prüfen** kannst du die vorhandene Installation erneut prüfen. Paketversionen und technische Angaben sind aufklappbar.

Die Onlineeinrichtung lädt ausschließlich die festgelegten Komponenten aus den hinterlegten Quellen. Die Offlineeinrichtung benötigt alle 21 ML-Wheels mit passenden Namen, Größen und Hashes aus dem festen Profil. Ein unvollständiger Ordner oder eine abweichende Datei wird abgewiesen. Für diese App-Einrichtung sind die Business-Wheels bereits in der mitgelieferten Basis enthalten. Die Vorbereitung eines Offlineordners aus dem Repository steht in der [Entwicklungsanleitung](ENTWICKLUNG.md#optionales-cpu-ml-profil).

Die Einrichtung verwendet eine private Kopie der mitgelieferten Python-Basis; sie verändert keine globale Pythoninstallation. Das neue Profil wird erst nach Prüfung aktiviert. Ein vorhandenes Profil und die Basis bleiben bei einem fehlgeschlagenen oder abgebrochenen neuen Auftrag erhalten. Alte Profile werden nicht automatisch gelöscht. Das Öffnen einer Ansicht, das Speichern und der Workflowstart installieren keine Pakete.

## Die vier Modellaktionen

| Baustein                 | Benötigt                                                         | Ergebnis und Wirkung                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Modell trainieren**    | Tabelle, Aufgabe, Modellverfahren, Zielspalte und Eingabespalten | Lernt bei echter Ausführung ein lauflokales Modell und meldet die Bewertung an getrennten Testdaten. Speichert noch keine Modelldatei. |
| **Modell speichern**     | Modell und Zielpfad mit `.slmodell`                              | Veröffentlicht bei echter Ausführung die geprüfte Modelldatei nach der gewählten Konfliktregel.                                        |
| **Modell laden**         | Vorhandene unterstützte `.slmodell`-Datei                        | Prüft und lädt dieses Modell im bewusst gestarteten Lauf.                                                                              |
| **Vorhersagen erzeugen** | Modell und Tabelle mit passenden Merkmalsnamen/-typen            | Ergänzt eine neue Vorhersagespalte. Reihenfolge und Originalspalten bleiben erhalten; die Spalte darf noch nicht vorhanden sein.       |

Verbinde Ergebnisse über die vorhandenen Bausteineigenschaften. Eine Modellreferenz gilt nur im laufenden Prozess. Für einen späteren Lauf speicherst du das Modell und verwendest dort **Modell laden**. Die Vorhersagetabelle lässt sich mit den vorhandenen CSV-/XLSX-Ausgaben speichern.

## Daten und Training vorbereiten

CSV beginnt in ScriptLab als Text, damit zum Beispiel führende Nullen erhalten bleiben. Lege Zahlen- und andere benötigte Datentypen deshalb vor dem Training ausdrücklich mit den Tabellenbausteinen fest. Numerische Merkmale sowie Text-/Wahrheitskategorien werden unterstützt. Datums- oder andere unpassende Typen müssen vorher bewusst umgewandelt werden.

Wähle im Trainingsbaustein die **Vorherzusagende Spalte** und unterschiedliche **Eingabespalten**. Die Zielspalte darf kein Eingabemerkmal sein. Fehlende Zielwerte, vollständig leere Merkmale im Trainingsanteil und ungeeignete Zahlen werden erklärt abgewiesen. Klassifikationsziele müssen einheitlich Text, Wahrheitswerte oder endliche Zahlen enthalten.

Weitere Trainingsvorgaben liegen unter den aufklappbaren Einstellungen:

| Einstellung             | Vorgabe        | Einstellbarer Bereich                       |
| ----------------------- | -------------- | ------------------------------------------- |
| Unabhängiger Testanteil | 0,2, also 20 % | 0,05–0,5; mindestens zwei Testzeilen        |
| Zufallsseed             | 42             | Ganze Zahl 0–2.147.483.647                  |
| Random-Forest-Bäume     | 100            | 1–1.000, zusätzlich Strukturgrenze beachten |
| Maximale Baumtiefe      | 12             | 1–32                                        |
| PyTorch-Epochen         | 50             | 1–1.000                                     |

Die Aufteilung erfolgt vor dem Lernen der Datenvorbereitung. Bei Klassifikation wird die Klassenverteilung dabei berücksichtigt. Numerische Mittelwerte, Skalierung und Kategorien werden nur aus Trainingszeilen gelernt und unverändert auf Test- und Vorhersagedaten angewendet. Fehlende numerische Merkmale werden durch den Trainingsmittelwert ersetzt; fehlende Kategorien besitzen eine eigene Kodierung. Bisher unbekannte Kategorien erhalten eine Nullkodierung. Die Vorhersagedaten müssen dieselben Merkmalsnamen und Datentypen wie das gespeicherte Schema besitzen.

Random Forest verwendet einen CPU-Thread. PyTorch verwendet eine feste Architektur mit zwei verborgenen Schichten von 64 und 32 Einheiten, ReLU, Adam und Paketen von 256 Trainingszeilen. Es gibt keine frei konfigurierbare Netzarchitektur. Das bewertete Modell wird nach der Testbewertung nicht erneut auf allen Daten trainiert: Gespeichert wird genau das bewertete Modell.

## Prüfen, ausführen und Ergebnisse verstehen

**Workflow ausführen** startet den gebauten ML-Ablauf mit den vorhandenen Parameterwerten direkt im Editor. Die ML-Komponenten müssen zuvor eingerichtet sein. Status und Ausgabe erscheinen über dem Ablauf; **Laufdetails** öffnet die ausführlichen Ergebnisse. Der direkte Start verwendet die echte Ausführung, auch wenn vorher eine Vorschau oder ein Prüflauf gewählt war.

**Codevorschau / Strukturprüfung** erzeugt beziehungsweise prüft Quelltext ohne Verarbeitung. Optional kontrollierst du unter **Läufe → Vorbereitung** Modus, Parameter, Arbeitsordner, Quellen und Ziele. Ein Moduswechsel startet noch nichts.

- **Prüflauf ohne Zieländerungen** und Vorschau planen Training und Modellspeicherung. Sie trainieren und veröffentlichen weder Modelldatei noch CSV-Ausgabe. Nachfolger eines nur geplanten Trainings bleiben ebenfalls geplant; es werden keine Vorhersagen erfunden.
- Ein bereits vorhandenes unterstütztes Modell darf in einem bewusst gestarteten prüfenden Lauf lesend geladen und für Vorhersagen verwendet werden. Das benötigt die passende ML-Laufzeit. Fachliche Zieldateien werden dabei nicht veröffentlicht.
- **Workflow ausführen** im Editor trainiert beziehungsweise schreibt die tatsächlichen Ergebnisse. In der optionalen Vorbereitung wählst du dafür **Ausführen · echte Dateiänderungen**. Vorhandene Ziele und ihre Konfliktregeln gelten weiterhin.

Unter **Läufe** zeigt **ML-Ergebnisse** bestätigte Trainings-/Testzeilen, Verfahren, Merkmale, Zielspalte und die vom Backend gemeldeten Testmetriken. Ein allgemeiner Prozessabschluss allein bestätigt keine Modellqualität.

| Aufgabe        | Gemeldete Metriken                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Klassifikation | Genauigkeit (Accuracy) und F1-Maß über die Klassen (Makro).                                                                                                  |
| Regression     | Mittlerer absoluter Fehler (MAE), Wurzel des mittleren quadratischen Fehlers (RMSE) und Bestimmtheitsmaß R². Bei konstantem Testziel ist R² nicht definiert. |

Diese Werte beschreiben die zurückgehaltenen Testdaten, keine garantierte Qualität für andere oder spätere Daten. Die beiden Beispielvorlagen liefern bewusst einfache synthetische Daten. **Stoppen** und das Zeitlimit beenden den zugehörigen Lauf; bereits veröffentlichte Dateien werden nicht automatisch zurückgenommen. Modell- und Quelldateiänderungen sowie abweichende Laufzeiten können eine Wiederaufnahme abweisen, statt alte Ergebnisse unpassend wiederzuverwenden.

## Modelldateien und technische Grenzen

`.slmodell` ist ein eigenes versioniertes Containerformat mit Metadaten und genau einer Modellnutzlast. Random Forest verwendet begrenzte, geprüfte Skops-Typen; PyTorch lädt ausschließlich Gewichte der festen CPU-Architektur mit `weights_only=True`. Beliebige Pickle-/Joblib-Dateien, fremde Architekturen und unbekannte Archivbestandteile werden nicht übernommen. Das ist keine allgemeine Sandbox für beliebige fremde Binärdateien. Prüfsummen prüfen Konsistenz, sind aber keine Signatur oder Herkunftsbestätigung.

Spaltenschema, gelernte Transformation, Testmetriken und die vollständige Laufzeitidentität werden mitgespeichert. Abweichende Paketversionen, Lockdateien oder eigene Laufzeitmodule können das Laden verweigern. Verwende die ursprüngliche passende Laufzeit oder trainiere bewusst neu; die kanonische `requirements-ml.lock` bleibt unverändert neben den Modulen.

| Bereich                     | Aktuelle Grenze                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trainingsumfang             | 10–100.000 Zeilen; zusätzlich höchstens `64 × 1024²` aufsummierte Textzeichen der Merkmals- und Zielwerte. Diese Zählung ist keine Messung des Speicherbedarfs. |
| Eingabespalten              | 1–128 unterschiedliche Merkmale ohne Zielspalte.                                                                                                                |
| Klassifikation              | 2–256 Klassen, mindestens zwei Zeilen je Klasse; der gewählte Testanteil muss eine getrennte Aufteilung erlauben.                                               |
| Kategorien                  | Höchstens 256 gelernte Kategorien je kategorischem Merkmal.                                                                                                     |
| Kodierte Merkmale           | Höchstens 4.096 Dimensionen einschließlich der Kategorie-/Leerwertkodierung.                                                                                    |
| Trainings-/Testmatrix       | Höchstens 128 MiB für die dichte Float32-Matrix beider Anteile zusammen.                                                                                        |
| Random Forest               | Zusätzlich konservative Strukturabschätzung von höchstens 128 MiB; Baumzahl, Tiefe und Klassen wirken zusammen.                                                 |
| Modelldatei                 | Höchstens 256 MiB entpackter Archivinhalt und 2 MiB Modellmetadaten; unbekannte/doppelte Einträge und unzulässige Kompression werden abgewiesen.                |
| Beigefügte Exportressourcen | Höchstens 16 MiB je Ressource und 64 MiB für das Exportpaket. Größere Modelle separat bereitstellen und Pfade anpassen.                                         |

Vorhersagen werden intern in Paketen von 512 Zeilen verarbeitet. Die übrigen [Datei-/Datenlimits](BUSINESS-DATEN.md), Laufzeit- und Tempbudgets sowie die Editorgrenze von 1.000 Bausteinen gelten zusätzlich. Die genannten Schutzgrenzen begrenzen nicht den gesamten Prozessspeicher und versprechen keine bestimmte Laufzeit.

## Eigenständig ohne ScriptLab ausführen

Exportiere den fertigen Workflow als **Business-Paket**. Ein ML-Paket enthält Script, Business-/ML-Module, beide Requirements-Lockdateien, Parametervorlage, Anleitung und Lizenzbeilagen, aber keinen Interpreter und keine automatisch übernommenen Trainingsdaten oder Journale. Vorhandene kleine `.slmodell`-Ressourcen können ausdrücklich ausgewählt werden. Für größere Modelle kopierst du die Datei gesondert und passt den Parameter an.

Der Empfänger benötigt Windows x64, die passende **CPython-3.15.2**-Umgebung und die festen CPU-Pakete. Nach dem Entpacken im Paketordner ausdrücklich eine eigene Umgebung einrichten; den Pythonpfad an die tatsächliche Installation anpassen:

```powershell
& "C:\Python315\python.exe" -m venv .venv
$mlPython = Join-Path (Get-Location) '.venv\Scripts\python.exe'
& $mlPython -m pip install --require-hashes --only-binary=:all: -r requirements-business.lock
& $mlPython -m pip install --require-hashes --only-binary=:all: --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-ml.lock
& $mlPython -m pip check
```

Offline muss der Paketordner **beide vollständigen Wheelsätze**, also Business und ML, enthalten. Statt der beiden Onlineinstallationen:

```powershell
& $mlPython -m pip install --no-index --find-links "C:\ScriptLab-Pakete" --require-hashes --only-binary=:all: -r requirements-business.lock
& $mlPython -m pip install --no-index --find-links "C:\ScriptLab-Pakete" --require-hashes --only-binary=:all: -r requirements-ml.lock
& $mlPython -m pip check
```

Behalte beide kanonischen Lockdateien unverändert bei; ersetze sie nicht durch frei aufgelöste Requirements. Bereite eigene Quelldateien und Werte in `parameter-beispiel.json` vor. Relative Pfade beziehen sich standardmäßig auf den Scriptordner; mit `--basis` kannst du bewusst einen anderen Basisordner angeben. Anschließend zuerst prüfen und danach ausdrücklich ausführen:

```powershell
& $mlPython -I -B -X utf8 .\workflow.py --modus prueflauf --parameter-datei .\parameter-beispiel.json
& $mlPython -I -B -X utf8 .\workflow.py --modus ausfuehren --parameter-datei .\parameter-beispiel.json
```

Der Scriptstart installiert nichts und benötigt keine geöffnete ScriptLab-Anwendung. Ein Exportpaket oder eine `.slmodell`-Datei ersetzt keine bearbeitbare `.scriptlab`-Projektdatei.

## Nachweise und offene Grenzen

Der [Integrationsabschluss](qualitaet/ML-ABSCHLUSS.md) bündelt die tatsächlichen Modul-, Desktop-, Export- und Paketnachweise mit den offenen Befunden. Einzelne erfolgreiche Nachtests ersetzen keinen grünen Gesamtlauf oder eine produktive Updateabnahme.

Für diesen Implementierungsstand wurden vier eigenständige Exporte geprüft: Random Forest und PyTorch jeweils für Klassifikation und Regression. Zusätzlich wurden die ausdrückliche Offlineeinrichtung in Electron mit RF-Training auf 160/40 Zeilen und 20 Vorhersagen sowie zwei native Torchfälle für Stoppen und ein Ein-Sekunden-Zeitlimit nachgewiesen. Die [Bedienung](qualitaet/ML-BEDIENUNG.md), [Laufzeit](qualitaet/ML-LAUFZEIT.md), [Verarbeitung](qualitaet/ML-VERARBEITUNG.md) und der [Integrationsreview](qualitaet/ML-REVIEW-INTEGRATION.md) trennen die jeweiligen Prüfbereiche. Das ist keine Gesamtfreigabe der laufenden Testsuite, des Installers oder der Updatekette und kein Nachweis allgemeiner Modellqualität.

Ein harter OS-Abbruch während der Einrichtung kann eine Sperrdatei hinterlassen; eine automatische Wiederherstellung verwaister Einrichtungszustände ist noch nicht umgesetzt. Ein vollständiger Online-Einrichtungsnachweis im Endnutzer-UI ist von den geprüften Downloads und der Offlineeinrichtung zu unterscheiden. Es gibt keine GPU-, Cloud- oder verteilte Ausführung und keine unbegrenzte Skalierbarkeit.

Die [ScriptLab-Lizenz](../LICENSE.txt) bleibt maßgeblich: private, nichtkommerzielle Nutzung kostenlos, kommerzielle Nutzung nur mit zuvor separat erworbener kostenpflichtiger Lizenz von Leon Stolz. Rechtmäßig erzeugte Exporte bleiben nach diesen Bedingungen unabhängig nutzbar und weitergebbar. Die [ML-Drittanbieterhinweise](../laufzeit/ml-notices.md) und übrigen beigefügten Lizenztexte bleiben erhalten.
