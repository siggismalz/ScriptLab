# ScriptLab bedienen

ScriptLab baut lokale Abläufe aus Bausteinen. Entwickelt von Leon Stolz. Die Nutzung richtet sich nach [LICENSE.txt](../LICENSE.txt).

## Einen Workflow anfangen

1. Öffne **Neuer Workflow**.
2. Wähle **Automatisierung** für Dateien, Tabellen und Dokumente, **Windows-Automatisierung** für kleinere vorhandene Windows-Abläufe oder **Machine Learning** für Tabellenmodelle.
3. Bestätige **Workflow erstellen**. Abbrechen erhält den bisherigen Stand.
4. Suche links einen Baustein und füge ihn per Plus und Einfügestelle oder durch Ziehen hinzu.

Die Aufgabenwahl ändert keine bestehenden Projekte: Automatisierung und Machine Learning verwenden Python, Windows-Automatisierung verwendet VBS. Die benötigten Grundkomponenten sind mitgeliefert; VBS benötigt weiterhin die verfügbare Windows-Komponente. Das zusätzliche ML-Paket wird bei Bedarf unter **Einstellungen → Automatisierungen** ausdrücklich eingerichtet.

**Vorlagen** öffnen eine eigene bearbeitbare Kopie mit den vorhandenen Beispieldaten. Die Vorlage bleibt erhalten. **Weiterbearbeiten** kehrt zum bereits geöffneten Workflow zurück.

## Im Ablauf arbeiten

Die Verbindungen bestimmen die Reihenfolge. Ein nur daneben abgelegter Baustein ist noch nicht verbunden. Bearbeite häufige Angaben direkt am Baustein und längere Eingaben in **Eigenschaften**. Die Ablaufansicht konzentriert sich auf Bausteine und ihre Einstellungen.

Zum Umordnen kannst du einen Baustein ziehen oder in seinen Eigenschaften **Verschieben** und eine neue Einfügestelle wählen. **Escape** bricht eine Platzierung ab. Der sichtbare Löschknopf entfernt den ausgewählten Baustein; **Rückgängig** stellt ihn wieder her. Diese Bearbeitung löscht keine bereits erzeugten Dateien.

**Ablauf**, **Daten und Parameter** und **Läufe** wechseln den Arbeitskontext. Ungespeicherte Angaben und der vorhandene Arbeitsstand bleiben erhalten. Ein Ansichtswechsel startet oder stoppt keinen Lauf. Die globale Seitennavigation führt zu Start, Workflows, Vorlagen und Hilfe.

## Quellen und Tabellen prüfen

Unter **Daten und Parameter** stehen **Quellen**, **Parameter** und **Vorschau** bereit. Die Konfiguration gehört zum selben Workflow wie der Bausteineditor.

- Wähle Quellen über die Dateiauswahl, gib einen Pfad ein oder lege genau eine lokale Datei auf ein unterstütztes Quellenfeld ab. Das übernimmt nur den Pfad und führt nichts aus.
- Relative Pfade verwenden in ScriptLab den Arbeitsordner des Workflows. Unter **Läufe → Laufeinstellungen → Arbeitsordner** lässt er sich im Explorer anzeigen. Der Speicherort der Projektdatei ist keine Pfadbasis.
- Parameterbindungen bleiben erhalten. Ändere ihre Werte unter **Parameter** oder die Zuordnung bewusst am Feld. **Testdaten** und **Echte Daten** sind Parametersätze, keine Sicherheitsbereiche.
- Für eine Tabelle wähle in **Vorschau** den Ergebnisschritt und den Parametersatz. Erst **Datenvorschau laden** liest die erforderlichen unterstützten Vorgänger.

Die Vorschau zeigt höchstens 200 Zeilen und 256 KiB. Suche und Sortierung betreffen nur diesen Ausschnitt. Filter und Gruppierungen können trotzdem die gesamte Quelle lesen. Geladener Umfang und Begrenzungshinweise bleiben bei der Tabelle sichtbar. Eine veraltete Vorschau muss nach der Korrektur bewusst neu geladen werden.

Stehen mehrere CSV-Überschriften in einer Spalte, führt der angebotene Knopf **Trennzeichen prüfen** zum vorhandenen Importfeld. Alternativ öffnest du **Quelle konfigurieren**. Prüfe Komma, Semikolon oder Tabulator und lade die Vorschau erneut; es gibt keine automatische Umdeutung.

## Eine Tabelle speichern

Bei **Tabelle als CSV/XLSX/JSON/Parquet speichern** kannst du **Speicherort (optional)** als festen Wert leer lassen. Dann entsteht die Datei im Workflow-Arbeitsordner:

- Eine eindeutige Dateiquelle liefert den Basisnamen, beispielsweise `Umsatz.csv` → `Umsatz.xlsx`.
- Mehrere oder nicht eindeutig benannte Quellen erhalten den Namen `Auswertung` mit der gewählten Endung.
- Würde die Ausgabe auf den Originalpfad einer Quelle treffen, erhält sie den Zusatz `-Ausgabe`.
- Ein bereits belegter Name wird nummeriert, zum Beispiel `Umsatz (2).xlsx`. Automatische Ziele überschreiben keine vorhandenen Dateien.

Einen eigenen Speicherort kannst du weiterhin angeben. Für diesen expliziten Pfad gilt die eingestellte Konfliktregel. Eine leere gebundene Variable oder ein leerer Parameter ist ein Fehler und ersetzt keinen fehlenden Wert durch ein automatisches Ziel. Ausgabegrenzen und Quellenprüfung gelten auch für automatisch benannte Dateien.

## Bewusst ausführen und Ergebnisse ansehen

**Workflow ausführen** im Kopf startet den vollständigen aktuellen Ablauf mit den vorhandenen Werten, einschließlich ungespeicherter Änderungen. Vorheriges Speichern oder Öffnen der Laufeinstellungen ist dafür nicht nötig. Dateiaktionen und Dialoge sind echt.

**Ergebnis ansehen** öffnet den zugehörigen Lauf im Bereich **Läufe**. Dort bilden Status, vorhandene Dateiausgaben, Hinweise und Ausgabe eine zusammenhängende Ergebnisfläche. **Laufeinstellungen** zeigt bei Bedarf Parameter, Arbeitsordner, Modus und Zeitlimit für den nächsten Lauf. **Verlauf anzeigen** öffnet frühere Läufe; deren Auswahl startet nichts.

Unterstützte Datenabläufe bieten in den Laufeinstellungen zusätzlich **Prüflauf ohne Zieländerungen** und eine begrenzte Datenvorschau. Der Prüflauf kann technische Zwischenfassungen erzeugen, veröffentlicht aber keine fachlichen Zieländerungen. Der Hauptknopf **Workflow ausführen** bleibt echte Ausführung. Grundbausteine und VBS erhalten keinen vorgetäuschten Prüflauf.

Während eines Laufs sind inhaltliche Änderungen gesperrt. **Stoppen** fordert dessen Ende an; warte auf die bestätigte Beendigung. Bereits ausgeführte Dateiänderungen bleiben bestehen. Prüfe erzeugte Dateien fachlich, etwa Zeilenzahl, Summen und Dokumenttexte. Ein beendeter Prozess allein bestätigt nicht das gewünschte Geschäftsergebnis.

## Arbeit erhalten und aufräumen

**Speichern** sichert den Workflow intern im ScriptLab-Nutzerverzeichnis, gewöhnlich `%APPDATA%\ScriptLab`. Eine extern geöffnete Projektdatei bleibt beim internen Speichern erhalten. Der Speicherstatus am Workflownamen unterscheidet den gespeicherten und den ungespeicherten Stand. Eine Ausführung speichert den Workflow nicht automatisch.

Die lokale Entwurfssicherung ist ein Zwischenstand. **Fortsetzen** übernimmt ihn bewusst; **Als Projekt speichern** legt einen eigenen Workflow an. Bei Projektwechsel oder Schließen schützen die bestehenden Speicherentscheidungen ungespeicherte Arbeit. Eine nicht erreichbare oder außerhalb veränderte Datei wird nicht still ersetzt.

| Aktion                  | Was wird entfernt?                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Löschknopf im Ablauf    | Der ausgewählte Baustein. **Rückgängig** kann ihn wiederherstellen.                         |
| **Entwurf löschen**     | Nach Rückfrage nur die lokale Sicherung. Eine zugehörige Projektdatei bleibt erhalten.      |
| **Aus Liste entfernen** | Nur der Eintrag unter Workflows. Die Datei bleibt erhalten und kann erneut geöffnet werden. |

Dateipfade bleiben über die Eintragsdetails lesbar. **Ordner anzeigen** öffnet den Speicherort, **Neu zuordnen** hilft bei verschobenen Dateien.

## Einstellungen, Hilfe und Tastatur

**Einstellungen** gliedert sich in **Aussehen**, **Automatisierungen** und **Updates**. Unter Aussehen stehen Hell, Dunkel, System und die Textgröße; diese bleibt vom Canvaszoom getrennt. Automatisierungen zeigt die vorhandenen Ausführungskomponenten und die ausdrückliche ML-Einrichtung. Updates werden nicht still beim Beenden installiert.

Die lokale Hilfe führt durch **Workflow bauen**, **Dateien verwenden**, **Ausführen und Ergebnisse prüfen** sowie **Fehler beheben und aufräumen**. Die Suche öffnet konkrete Anleitungsschritte. **Über ScriptLab und Lizenz** nennt Entwickler und Nutzungsbedingungen.

Strg+N öffnet die Aufgabenwahl, Strg+O öffnet einen Workflow, Strg+S speichert. Im sichtbaren Ablauf gelten außerhalb von Texteingaben Strg+Z/Strg+Y für Rückgängig/Wiederholen, F4 für Eigenschaften und Entfernen zum Löschen des ausgewählten Bausteins. Tab und Umschalt+Tab bedienen die Oberfläche ohne Ziehen.

## Export und Grenzen

**Exportieren** unterscheidet eine bearbeitbare `.scriptlab`-Projektdatei, ein eigenständiges Script und bei Datenabläufen ein Business-Paket. Es startet keine Verarbeitung. Python-/VBS-Zuordnungen, Block-IDs und unterstützte Projektformate werden durch die vereinfachte Bedienung nicht geändert.

Außerhalb von ScriptLab benötigt ein Python-Script eine passende eigene Python-Umgebung; ein Business-Paket zusätzlich seine angegebenen Pakete. Das Paket enthält keinen Interpreter und installiert beim Start nichts. Relative Pfade beziehen sich dort standardmäßig auf den Scriptordner. Die App-interne Ausgabebegrenzung wird dem eigenständigen Export nicht als zusätzliche allgemeine Sandbox aufgeprägt. Explizite Pfade und Konfliktregeln bleiben fachlich erhalten.

Projektdateien sind auf 5 MiB, der aktuelle Editor auf 1.000 Bausteine und 150 Verschachtelungsebenen begrenzt. Unbekannte Projektformate oder Bausteine werden abgewiesen. Einzelheiten: [Geschäftsabläufe](BUSINESS-BEDIENUNG.md), [ML](ML.md), [Entwicklung](ENTWICKLUNG.md) und [Signaturen](SIGNATUR.md).

Die [früheren Oberflächenprüfungen](qualitaet/UI-NEUAUFBAU.md) und die [Startseitendokumentation](STARTSEITE.md) bleiben historische Nachweise für ihren jeweiligen Stand. Diese Anleitung beschreibt die Bedienung und ist keine neue vollständige Test- oder Installerabnahme.
