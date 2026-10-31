# Vereinfachte Bedienung von ScriptLab

Stand: 31. Oktober 2026. Die Änderungen ordnen vorhandene Fähigkeiten neu; Workflowformate, bestehende Sprachzuordnungen und eigenständig nutzbare Exporte bleiben erhalten.

## Eine Aufgabe statt einer Sprache wählen

**Neuer Workflow** bietet **Automatisierung**, **Windows-Automatisierung** und **Machine Learning**. Automatisierung ist der Einstieg für Dateien, Tabellen und Dokumente und verwendet die mitgelieferte Python-Umgebung. Windows-Automatisierung erhält die vorhandenen VBS-Abläufe. Machine Learning besitzt seinen bestehenden Tabellen-/Modellkatalog und benötigt das zusätzliche Paket unter **Einstellungen → Automatisierungen**.

Im **Ablauf** stehen Bausteine und Eigenschaften im Mittelpunkt. Der sichtbare Löschknopf entfernt den ausgewählten Baustein, **Rückgängig** stellt ihn wieder her. Öffnen, Bearbeiten und Ansichtswechsel lösen keine Verarbeitung aus.

## Direkt starten, ein Ergebnis beurteilen

**Workflow ausführen** verwendet den aktuellen, gegebenenfalls ungespeicherten Stand. **Ergebnis ansehen** führt zur gemeinsamen Ergebnisfläche unter **Läufe**: Status, vorhandene Dateien, Hinweise und Ausgabe gehören zum gewählten Lauf. **Laufeinstellungen** passt den nächsten Start an, **Verlauf anzeigen** öffnet gespeicherte Läufe. Die früheren getrennten Unteransichten sind kein nötiger Bedienweg mehr.

Ein Prüflauf oder eine Datenvorschau wird weiterhin ausdrücklich gewählt. Der Hauptknopf führt wirklich aus. **Stoppen** wartet auf das tatsächliche Prozessende und macht bereits erfolgte Dateiänderungen nicht rückgängig.

## Tabellen einfacher speichern

Bei den bestehenden CSV-, XLSX-, JSON- und Parquet-Schreibbausteinen darf der feste **Speicherort (optional)** leer bleiben. Dann nimmt ScriptLab den Basisnamen der eindeutigen Quelldatei und speichert im Arbeitsordner. Ohne eindeutige einzelne Dateiquelle heißt die Ausgabe `Auswertung` mit passender Endung. Ein Treffer auf den Originalpfad erhält `-Ausgabe`; belegte Namen erhalten eine Nummer. Automatisches Speichern ersetzt keine vorhandene Datei.

Explizite Ziele behalten ihre Konfliktregel. Leere Parameter oder gebundene Variablen sind kein Auftrag zur automatischen Zielwahl. Quellenprüfung, Publikation und bestehende Ausgabebegrenzungen bleiben wirksam. [Details und Beispiele](BUSINESS-BEDIENUNG.md#speicherort-für-tabellenausgaben).

## Finden, ändern und aufräumen

- **Daten und Parameter** bündelt Quellen, Parameter und die ausdrücklich geladene Vorschau. CSV-Trennzeichen werden bewusst korrigiert. Suche und Sortierung betreffen nur den begrenzten Vorschauausschnitt.
- **Aus Liste entfernen** ist direkt am gespeicherten Workflow erreichbar und erhält die Datei. **Entwurf löschen** entfernt nach Bestätigung nur die lokale Sicherung.
- **Einstellungen** verwendet **Aussehen**, **Automatisierungen** und **Updates**. Technische Einrichtungsschritte stehen nicht im normalen Hilfefluss.
- **Hilfe** bietet vier konkrete Anleitungen: Workflow bauen, Dateien verwenden, Ausführen und Ergebnisse prüfen sowie Fehler beheben und aufräumen. Sie und ihre Suche funktionieren lokal. Leon Stolz und die Lizenzinformationen bleiben genannt.

Die vollständigen Arbeitswege stehen in [BEDIENUNG.md](BEDIENUNG.md), die Datenfunktionen in [BUSINESS-BEDIENUNG.md](BUSINESS-BEDIENUNG.md). Entwickleranleitungen bleiben in [ENTWICKLUNG.md](ENTWICKLUNG.md).

## Historische Nachweise

[REGELN-UND-DATEN.md](REGELN-UND-DATEN.md), die zugehörige [Galerie](regeln-daten/ANSICHTEN.html), [UEBERSICHTLICHKEIT.md](UEBERSICHTLICHKEIT.md) und [UI-NEUAUFBAU.md](qualitaet/UI-NEUAUFBAU.md) dokumentieren frühere Fassungen. Ihre Bilder, Befunde und Testzahlen bleiben dem jeweiligen Stand zugeordnet. Aus diesem Bedienungstext folgt keine pauschale Aussage, dass sämtliche Prüfungen für den neuen Stand bestanden sind.
