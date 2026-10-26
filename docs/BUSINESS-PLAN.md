# Ausbau für Geschäftsabläufe

## Geprüfter Ausgangspunkt

Ausgangscommit: `5a23df46acf6a31e96aa681c453b75c1eb8990b2`.
Windows 11 x64, Electron 45.0.0, Blockly 13.4.0, TypeScript 7.0.2,
React 19.3.1. Die eingecheckte npm-Lockdatei bleibt verbindlich.

Vorhanden sind 48 gemeinsame Bausteine, getrennte VBS-/Python-Generatoren,
Projektformat 2 (Format 1 wird als VBS migriert), Startseite, lokale Entwürfe,
eigenständiger Export, optionale VBS-Signatur und ein gemeinsamer Testdienst.
Der feste Windows-Testhost bindet den Prozess vor dem Start an ein Jobobjekt.
Öffnen, Wiederherstellen, Speichern, Vorschau und Export starten keinen Ablauf.

Die Grundbausteine bleiben in beiden Sprachen erhalten. Neue Tabellen- und
Dokumentbausteine unterstützen Python; ein VBS-Projekt wird niemals automatisch
umgestellt. Es gibt bisher keine Datenbank-, Cloud- oder Office-COM-Anbindung.

## Entscheidungen

- Ein gemeinsames Python-Paket enthält die fachliche Verarbeitung für Editor und
  Business-Export. Die Oberfläche übergibt geprüfte Daten und keine SQL- oder
  Python-Ausdrücke. DuckDB hält Tabellen als Verarbeitungsketten außerhalb des
  Renderers. Vorschauen übertragen nur begrenzte Ausschnitte.
- Projektformat 3 ergänzt Parameterdefinitionen und nicht geheime Parametersätze.
  Quellen bleiben Referenzen. Geschäftsdaten, Vorschauen und Laufberichte werden
  nicht automatisch in Projekte eingebettet. Ältere Formate bleiben lesbar.
- Dateiausgaben erhalten ausdrückliche Konfliktregeln und werden zunächst in einer
  eigenen Datei im Zielordner geschrieben. Journale und Quellenidentitäten helfen
  beim Wiederanlauf; eine allgemeine Genau-einmal-Garantie besteht nicht.
- Strukturprüfung, begrenzte Datenvorschau, Prüflauf ohne fachliche Zieländerungen
  und echte Ausführung bleiben getrennt. Ein Prüflauf ersetzt keine Ausführung.
- Das feste Business-Laufzeitprofil wird nur bewusst in einer eigenen Umgebung
  eingerichtet. Prüfung, Öffnen, Teststart und exportierte Scripts installieren
  keine Pakete. Eine vorbereitete Offline-Umgebung bleibt möglich.

## Reihenfolge und Nachweise

1. Bestand und Sprachpriorität festhalten.
2. Typen, Parameter, Blockmetadaten und kompatibles Projektformat ergänzen.
3. CSV → prüfen → filtern → gruppieren → sichere Ausgabe vollständig anbinden.
4. Verknüpfungen, Ressourcenlimits und begrenzte Vorschau ergänzen.
5. XLSX, DOCX, PDF, sichere Dateiablage und Archive anbinden.
6. Berichte, Journal, Wiederanlauf und eigenständiges Business-Paket ergänzen.
7. Fünf synthetische Geschäftsbeispiele fachlich und visuell prüfen.
8. Windows-Prozesse, Fehlerfälle, Million-Zeilen-Fall, XLSX und 1.000 Dateien
   mit tatsächlichen Messwerten dokumentieren.

Diese Datei beschreibt die Umsetzung. Durchgeführte Prüfungen und offene Grenzen
werden gesondert dokumentiert; ein geplanter Nachweis ist kein Testergebnis.
