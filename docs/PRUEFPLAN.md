# Prüfplan für Windows

Dieser Plan trennt die nicht ausführenden Editor-, Export-, Syntax- und Signaturprüfungen von ausdrücklich gestarteten Laufzeitprüfungen. Die bisherigen Schritte unten starten keinen Workflow. Das neue, gesonderte Laufzeitpaket ist in [TESTLAUF.md](TESTLAUF.md) beschrieben; nur dort werden isolierte Testworkflows bewusst ausgeführt. Tatsächliche Abnahmeergebnisse stehen separat in [ABNAHME.md](ABNAHME.md).

## Automatische Prüfungen

Typprüfung, Unit-Tests und Produktionsbuild werden vor einem Release auf Windows ausgeführt. Dateitests verwenden neu angelegte temporäre Ordner. Vorhandene Nutzerprojekte und Workflow-Zieldateien sind keine Testdaten.

| Gegenstand         | Erforderliche Fälle                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projektformat      | Gültiges JSON; falsche Typen; unbekannte neuere Version; doppelte IDs; Tiefen-/Größenlimits; ungültige Verbindungen                                                                                                                     |
| Generator          | Jeder angebotene Block; verschachtelte Bedingungen/Schleifen; Operatorrangfolge; Hilfsfunktionen nur einmal; deterministischer Quelltext                                                                                                |
| Daten              | Umlaute, `"`, CR/LF, Windows-Pfade mit Leerzeichen, reservierte Variablennamen, nur in Großschreibung abweichende Namen, Komma/Punkt bei Zahlen                                                                                         |
| Ablauf             | Genau ein Start; kein Start; mehrere Starts; unverbundene aktive Blöcke; fehlende Pflichtwerte; fehlerhafte Blockformen                                                                                                                 |
| Dateien            | Atomisches Speichern; Abbruch; Schreibfehler; UTF-16LE-BOM und CRLF beim Export; keine Änderung von Workflow-Zieldateien                                                                                                                |
| Signatur           | Nicht signiert; Prüfung nicht möglich; kein Zertifikat; ungültige Auswahl; bei bereitgestelltem Zertifikat echte Signatur, Vertrauensprüfung und nachträgliche Änderung                                                                 |
| Updates            | Nicht eingerichtet; Netzwerkfehler; Downloadfehler; keine stille Installation; keine Installation ohne Bestätigung; Schutz ungespeicherter Änderungen                                                                                   |
| Sicherheitsgrenze  | IPC-Absender und Daten werden geprüft; keine allgemeine Shell/Datei-/Prozess-API; kein automatischer Teststart bei Öffnen, Wiederherstellen, Vorschau, Speichern, Export oder Signatur; keine VBS-Ausführung über Dateizuordnungen      |
| Bewusste Testläufe | Nur der vollständige aktuelle validierte Workflow; fester Host; sichtbare Pfadbasis und Zeitlimit; keine Doppelstarts; echte Ausgabe-/Dateiergebnisse; Stoppen und Zeitlimit beenden den Prozess; getrennte Projekt- und Testergebnisse |

## Reine Windows-Syntaxprüfung

Microsoft dokumentiert für [`IActiveScriptParse::ParseScriptText`](https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/windows-scripting/reference/iactivescriptparse-parsescripttext), dass im initialisierten Zustand kein Code ausgewertet wird. Der Code bleibt vorgemerkt, bis der Host die Engine in einen ausführbaren Zustand versetzt. Der Entwicklungshelper `scripts/vbs-syntax-pruefen.ps1` unterlässt genau diesen Übergang.

Der Helper erstellt eine leere Site ohne Hostobjekte, ruft `InitNew` auf und verlangt vor und nach `ParseScriptText` den Zustand 5 (`SCRIPTSTATE_INITIALIZED`). Die Parserflags sind 0; es wird kein Ausdruck ausgewertet und kein Rückgabewert abgefragt. Es gibt keinen Aufruf von `SetScriptState`, `GetScriptDispatch`, `wscript.exe` oder `cscript.exe`. `OnEnterScript` zählt unerwartete Ausführungseintritte und verweigert sie zusätzlich. Anschließend wird die Engine geschlossen und freigegeben. Der Helper gehört nur zur Entwicklung und wird nicht als App-Funktion angeboten.

```powershell
powershell.exe -NoProfile -NonInteractive -File scripts/vbs-syntax-pruefen.ps1 -Selbsttest -AlsJson
powershell.exe -NoProfile -NonInteractive -File scripts/vbs-syntax-pruefen.ps1 -Datei "C:\Test\Export.vbs" -AlsJson
```

Exitcode 0 bedeutet erfolgreiche Syntaxprüfung, 1 einen Syntaxfehler beziehungsweise fehlgeschlagenen Selbsttest und 2 eine nicht verfügbare Prüfung. Fehlt die optionale VBScript-Komponente, wird nichts installiert oder aktiviert. Die zugehörigen Windows-Tests dürfen diesen optionalen Schritt dann mit begründetem Hinweis überspringen.

Der Selbsttest gibt dem Parser gültigen Code, der bei tatsächlicher Ausführung eine eindeutig benannte Markierungsdatei erzeugen würde, sowie ein unvollständiges `If`. Er verlangt: gültiger Code akzeptiert, Syntaxfehler erkannt, vor/nach dem Parsen Zustand 5, keine Ausführungseintritte und keine Markierungsdatei. Dieser Test prüft die Parsergrenze. Er beweist keine Laufzeitsemantik der Dateioperationen und ersetzt keine Inhaltsprüfung des Generators.

## Manueller Durchlauf der Anwendung

Für jeden Durchlauf Datum, Windows-Version, App-Version, Commit und Ergebnis protokollieren. Nicht durchgeführte Schritte bleiben offen.

1. App starten, sichtbare deutsche Oberfläche, Entwicklercredit und Versionsanzeige prüfen. Bei Windows-Skalierung 100 %, 125 % und 150 % auf abgeschnittene Texte, Fokus und Kontrast achten.
2. Neues Projekt erstellen. Start und Nachricht verbinden, Nachricht ändern, Block verschieben, lösen und erneut verbinden. Prüfen, dass die Vorschau ausschließlich Text zeigt und keine Nachricht des Workflows erscheint.
3. Baustein aus jeder Kategorie ziehen. Suche, Kategoriebezeichnungen, Hilfe, Auswahl und Fehlerdarstellung prüfen. Mindestens einen Ablauf mit Eingabe, Bedingung, Schleife und Dateizugriff erstellen.
4. Rastereinrasten, Arbeitsbereich verschieben, Zoomtasten, Mausrad/Tastenkombinationen, 100 %, Einpassen sowie Rückgängig/Wiederholen prüfen. Duplizieren, Kopieren, Einfügen und Löschen kontrollieren.
5. Projekt unter einem Pfad mit Leerzeichen/Umlauten speichern. Verbindungen, Variablen, Kommentare, Blockpositionen, Zoom und Ausschnitt notieren. Schließen/Öffnen muss denselben Stand ergeben.
6. Ungespeicherte Änderung vornehmen. Bei Neu, Öffnen, Schließen und Update-Neustart nacheinander Abbrechen, Verwerfen und Speichern prüfen. Ein abgebrochener Speicherdialog muss den Wechsel abbrechen.
7. Fehlerhafte Projektdatei und unbekannte neuere Schemaversion öffnen. Verständliche Ablehnung prüfen; vorhandenes Projekt erhalten. Das Öffnen darf keinen Test starten oder Inhalt einer Projektdatei als Anwendungscode ausführen.
8. VBS-Speicherdialog abbrechen, anschließend regulär exportieren. Ergebnistext muss lauten: „Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.“ Exportdatei nur mit einem Text-/Hex-Leser kontrollieren; nicht öffnen/starten. BOM, CRLF, Umlaute und generierte Blockbedeutung prüfen.
9. In einem isolierten Ordner Sentineldateien für ein Backup-/Löschbeispiel anlegen. Beispiel öffnen, bearbeiten, speichern, Vorschau und Export verwenden. Alle Sentineldateien und ihre Hashes müssen unverändert bleiben.
10. Ohne Zertifikat normal exportieren. Gewünschte Signatur ohne geeignetes Zertifikat muss konkret scheitern. Nur bei ausdrücklich bereitgestelltem Testzertifikat signieren, Windows-Prüfergebnis und absichtlich nachträglich veränderte Kopie prüfen. Inhalt nie ausführen.
11. Updatebereich mit fehlender Konfiguration und ohne Netz prüfen. Automatische Prüfung abschalten und Neustart kontrollieren. Mit eingerichteter produktiver Quelle zwei installierbare signierte Versionen verwenden; Version, Release Notes, Fortschritt, Abbruch/Fehler, Installationsbestätigung und Erhalt von Projekten/Einstellungen dokumentieren.
12. NSIS-Installer im vorgesehenen Benutzerkontext installieren, App starten, Projekt speichern, App aktualisieren/deinstallieren und Erhalt der Nutzerdaten prüfen. Dies erst nach ausdrücklicher Durchführung als getestet markieren.

## Gesonderte Laufzeitprüfung

Die Erweiterung um **Testen** erhält ein eigenes Prüfprotokoll in [TESTLAUF.md](TESTLAUF.md). Sie verwendet ausschließlich eigens angelegte temporäre Testordner und bekannte Testworkflows. Native Dialoge, Textausgabe, Dateiaktionen, Fehlerzuordnung, große Unicodeausgaben, Stoppen, Zeitlimit sowie Prozessende beim Schließen oder unerwarteten Ende müssen tatsächlich nachgewiesen werden. Ein erfolgreicher Komponenten- oder Parsertest ersetzt diesen Nachweis nicht. Die unveränderten Sentineltests sichern weiterhin, dass Vorschau, Laden, Wiederherstellen, Speichern und Export ohne ausdrücklich gestarteten Test keine Workflowaktionen auslösen.

## Grenzen

Eine gültige VBS-Syntax beweist weder die Verfügbarkeit aller Laufzeitkomponenten noch die Wirkung einer späteren Ausführung. Authenticode-Prüfung startet den signierten Inhalt nicht. Ein Zertifikat belegt keinen ungefährlichen Workflow und umgeht keine Windows-, SmartScreen- oder Unternehmensrichtlinien. Die vollständige produktive Updatekette erfordert eine echte Releasequelle, Entwicklersignatur und zwei installierbare Versionen.
