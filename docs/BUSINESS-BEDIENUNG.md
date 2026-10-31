# Geschäftsabläufe mit ScriptLab

Wähle **Neuer Workflow → Automatisierung** für Tabellen, Dokumente und Dateiabläufe. ScriptLab enthält die dafür benötigte Python-Umgebung und die festen Business-Komponenten. Vorhandene Windows-Automatisierungen verwenden weiterhin VBS; ihre Projektzuordnung wird nicht umgestellt. Entwickelt von Leon Stolz; maßgeblich ist [LICENSE.txt](../LICENSE.txt).

## Mit einem Beispiel beginnen

1. Öffne **Vorlagen** und wähle einen passenden Beispielworkflow.
2. Prüfe Aufgabe und enthaltene Beispieldateien. **Als Vorlage öffnen** erstellt eine eigene bearbeitbare Kopie; die Originalvorlage bleibt erhalten.
3. Bearbeite Bausteine und die Angaben unter **Daten und Parameter**. Die mitgelieferten synthetischen Daten liegen im eigenen Arbeitsordner.
4. **Speichern** behält den Workflow intern. **Workflow ausführen** startet den aktuellen Stand; **Ergebnis ansehen** öffnet das zugehörige Ergebnis.

Die vorhandenen [Monatsauswertung](../beispiele/business/A-Monatsauswertung/README.md), [Stammdatenzuordnung](../beispiele/business/B-Bestellungen/README.md), [Word-Bestellvorschlag](../beispiele/business/C-Bestellvorschlag/README.md), [Dokumentablage](../beispiele/business/D-Dokumenteingang/README.md) und [Dateistapelverarbeitung](../beispiele/business/E-Dateistapel/README.md) beschreiben ihre synthetischen Daten und Sollwerte. Ein Bestellvorschlag versendet keine Bestellung. Die zwei Modellvorlagen erläutert [ML.md](ML.md).

## Quellen, Parameter und Verbindungen

**Daten und Parameter → Quellen** bearbeitet dieselben Angaben wie die Eigenschaften des ausgewählten Bausteins. Tabellen werden als Ergebnis eines früheren passenden Bausteins zugeordnet. Eine bestehende Zuordnung bleibt beim Verschieben oder Wiederöffnen erhalten; eine ungültige Verbindung muss bewusst korrigiert werden.

Quellen lassen sich über eine Dateiauswahl oder ein unterstütztes Pfadfeld setzen. Das Ablegen einer lokalen Datei übernimmt nur den Pfad. Ein an einen Parameter oder eine Variable gebundenes Feld wird dadurch nicht ersetzt.

**Workflow → Workflowparameter** definiert Namen, Beschriftungen, Wertarten, Pflichtangaben, Standardwerte und Hilfen. **Parameter** zeigt die Werte der Sätze Testdaten und Echte Daten. Beide sind nur Wertauswahlen, keine Sicherheitsbereiche. Leere Pflichtangaben werden erklärt. Kennwörter und private Schlüssel gehören nicht in das Projekt.

Unter **Läufe → Laufeinstellungen** können Werte für den nächsten Lauf abweichen. Erst **Werte im Parametersatz merken** übernimmt sie in den Workflow; anschließend speichern, wenn sie erhalten bleiben sollen.

CSV-Werte werden zunächst als Text eingelesen, damit etwa `001` erhalten bleibt. Lege Datentypen für Berechnungen bewusst fest. Dezimalbeträge verwenden einen Punkt, beispielsweise `12.50`. Bei Verknüpfungen müssen Schlüssel und erwartete Zuordnung zu den Daten passen.

## Eine Tabelle vorab ansehen

Öffne **Daten und Parameter → Vorschau**, wähle **Ergebnis bis zu diesem Schritt** und **Verwendete Werte**. Erst **Datenvorschau laden** liest die erforderlichen unterstützten Vorgänger. Unfertige spätere Schritte werden für diese Einzelvorschau nicht benötigt und nicht verändert.

Die lesende Tabelle zeigt höchstens 200 Zeilen und 256 KiB. Suche, Sortierung und Seitenwechsel betreffen nur diesen Ausschnitt. Filter und Gruppierungen können trotzdem die gesamte Quelle lesen. Die Vorschau unterstützt die vorhandenen lesenden Tabellenschritte im Hauptablauf; unpassende Vorläufe wie Dateiaktionen oder Verzweigungen erhalten einen Hinweis. Ein geänderter Vorlauf oder andere Parameter können die Anzeige veralten lassen.

Erscheinen CSV-Überschriften zusammen in einer Spalte, führt **Trennzeichen prüfen** zum bestehenden Importfeld. Prüfe dort das Zeichen und lade die Vorschau bewusst erneut. Es gibt keine automatische Umdeutung. Ergebnisschritt, geladener Umfang und Begrenzungshinweise bleiben bei der Tabelle sichtbar; geänderte Stände werden gekennzeichnet.

## Speicherort für Tabellenausgaben

Die vorhandenen CSV-, XLSX-, JSON- und Parquet-Schreibbausteine können ohne eigenen Zielpfad verwendet werden. Lass **Speicherort (optional)** dafür als festen Wert leer:

| Eingabe und Situation                                  | Automatisches Ziel                                             |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Eine eindeutige Dateiquelle `Umsatz.csv`, Ausgabe XLSX | `Umsatz.xlsx` im Workflow-Arbeitsordner                        |
| Mehrere oder keine eindeutig benannte Dateiquelle      | `Auswertung` mit der gewählten Endung im Arbeitsordner         |
| Das Ziel träfe den Originalpfad einer Quelle           | Basisname mit `-Ausgabe`, beispielsweise `Umsatz-Ausgabe.csv`  |
| Der Zielname ist bereits belegt                        | Ein freier nummerierter Name, beispielsweise `Umsatz (2).xlsx` |

Automatisches Speichern überschreibt keine vorhandene Datei, auch wenn am Baustein eine andere Konfliktregel gewählt ist. Das neue Ziel wird durch dieselbe Quellenprüfung und Publikation wie eine explizite Ausgabe geschützt. Der tatsächliche Dateiname steht anschließend im Ergebnis.

Ein **expliziter Speicherort** bleibt unverändert und verwendet weiterhin die eingestellte Konfliktregel: Fehler, Überspringen, neuer Name oder bewusstes Ersetzen. Eine **leere gebundene Variable oder ein leerer Parameter** ist ein Fehler; nur das leere feste Pfadfeld wählt das automatische Ziel.

In ScriptLab verwenden relative Pfade den Workflow-Arbeitsordner. Externe Quellen bleiben lesbar; Ausgaben müssen innerhalb des ScriptLab-Nutzerverzeichnisses liegen. Ziele außerhalb dieser Grenze werden nicht still umgeschrieben. Beim eigenständigen Export gelten weiterhin dessen eigene Pfade und Laufoptionen.

## Ausführen und den richtigen Lauf beurteilen

**Workflow ausführen** startet den vollständigen aktuellen Workflow einschließlich ungespeicherter Änderungen. **Ergebnis ansehen** führt zur gemeinsamen Ergebnisfläche unter **Läufe**. Status, Ausgabedateien, Hinweise, Bericht und Ausgabe gehören zu diesem Lauf. **Verlauf anzeigen** öffnet gespeicherte Läufe; deren Auswahl startet nichts. Die Historie enthält keine zusätzliche Kopie jeder erzeugten Datei.

**Laufeinstellungen** öffnet bei Bedarf Modus, Parametersatz, Quellen, Ziele und Grenzen für den nächsten Start. Prüfe vor echten Läufen die verwendeten Quellen und die Behandlung vorhandener Ziele.

| Modus                        | Wirkung                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Datenvorschau                | Bewusstes Lesen mit begrenztem Ergebnisausschnitt; keine fachliche Dokument- oder Exportpublikation. |
| Prüflauf ohne Zieländerungen | Unterstützte Schritte und geplante Ausgaben prüfen; technische Zwischenfassungen können entstehen.   |
| Echte Ausführung             | Dateiänderungen, Dialoge und gegebenenfalls Archivierung tatsächlich durchführen.                    |

Der direkte Hauptknopf ist echte Ausführung, auch wenn zuvor eine Vorschau oder ein Prüflauf verwendet wurde. Grundbausteine und VBS werden nicht als sicherer Prüflauf ausgegeben. **Stoppen** fordert das tatsächliche Prozessende an; bereits bestätigte Änderungen bleiben bestehen. Prüfe Dateien und fachliche Inhalte, bevor du einen Geschäftsprozess als vollständig erledigt ansiehst.

Die vorhandene bewusste Fortsetzung prüft passende Journale, Workflow, Parameter, Quellen, bestätigte Ausgaben und Laufzeitidentität. Unklare Zustände verlangen eine Prüfung der tatsächlichen Dateien. Es gibt keine allgemeine automatische Rückabwicklung oder Garantie einer genau einmal erfolgten Verarbeitung.

## Einstellungen, Aufräumen und eigenständiger Export

Unter **Einstellungen → Automatisierungen** stehen die vorhandenen Komponenten und die ausdrückliche Einrichtung des zusätzlichen ML-Pakets. Öffnen und Starten eines Workflows installiert nichts. Farbschema und Textgröße stehen unter **Aussehen**, Aktualisierungen unter **Updates**.

Der Löschknopf im Ablauf entfernt einen Baustein und lässt sich rückgängig machen. **Entwurf löschen** entfernt nach Bestätigung nur die lokale Sicherung; **Aus Liste entfernen** erhält die gespeicherte Projektdatei. Die [lokale Hilfe](BEDIENUNG.md#einstellungen-hilfe-und-tastatur) beschreibt die Aufgaben ohne technische Einrichtungstexte.

**Exportieren** bietet eine Projektdatei, ein Script oder das Business-Paket mit eigenen Modulen, festen Paketangaben, Parametervorlage und Anleitung. Ein Business-Paket enthält keinen Interpreter; der Empfänger richtet eine passende eigene Umgebung ausdrücklich ein. Ressourcen werden nur nach Auswahl beigefügt; Geschäftsdaten, Berichte und Journale werden nicht automatisch mitgegeben. Die Grenzen bleiben 16 MiB je Ressource und 64 MiB für das Paket. Große Modelle müssen gegebenenfalls getrennt übertragen werden.

Relative Pfade beziehen sich beim eigenständigen Start standardmäßig auf den Scriptordner; die beigefügte Anleitung erklärt die ausdrückliche Basiswahl. Automatische Tabellennamen werden in dieser Basis erzeugt. Explizite Ziele behalten ihre Bedeutung; die App-interne Ausgabewurzel wird dem eigenständigen Export nicht als zusätzliche allgemeine Sandbox aufgeprägt. Der Scriptstart installiert nichts. Projektformate und bestehende Python-/VBS-Zuordnungen ändern sich durch diese Bedienungsüberarbeitung nicht.

## Grenzen und frühere Nachweise

Excel-Formeln werden nicht berechnet. PDF-Textextraktion enthält keine OCR für Scans. Dokumenttabellen sind auf 20.000 Zellen, PDF-Dateien auf 2.000 Seiten und PDF-Textauszüge auf 256 KiB begrenzt. Das DuckDB-Speicherbudget begrenzt nicht den gesamten Python-Prozess.

[Tabellendaten](BUSINESS-DATEN.md), [Dateien und Dokumente](BUSINESS-DOKUMENTE.md) sowie [Export und Modelle](ML.md) erläutern die jeweiligen Verträge. [BUSINESS-ABNAHME.md](BUSINESS-ABNAHME.md), [BUSINESS-BEISPIELE-PRUEFUNG.md](BUSINESS-BEISPIELE-PRUEFUNG.md), [UI-NEUAUFBAU.md](qualitaet/UI-NEUAUFBAU.md) und die alten Einrichtungshinweise in [BUSINESS-LAUFZEIT.md](BUSINESS-LAUFZEIT.md) bleiben Nachweise ihres damaligen Stands. Diese aktualisierte Anleitung behauptet keine neue vollständige Test-, Installer- oder Unternehmensabnahme.
