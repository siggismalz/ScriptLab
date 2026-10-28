# ScriptLab: Gestaltung und Arbeitswege

Stand: 28. Oktober 2026. Gestaltungsauftrag für die bestehende Windows-Anwendung.

## Verbindliche Richtung vor der Umstellung

ScriptLab vermittelt Klarheit und Verlässlichkeit durch ruhige Schieferflächen, Petrol für die zentrale Aktion, sichtbare Zustände und sachliche deutsche Texte. Die vorhandene Blockly-Geometrie, Fachmodelle, Dateiformate und Prozessgrenzen bleiben die Grundlage. Die Wortmarke lautet immer ScriptLab. Credits stehen in den Produktinformationen: Leon Stolz.

Grundlage sind die im Arbeitsauftrag angegebenen Rollenfarben. Die installierten Systemschriften werden mit `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif` verwendet. Es werden keine Windows-Schriftdateien mitgeliefert. Abstände: 4/8/12/16/24/32; Bedienelemente mindestens 36 px, häufige Symbolaktionen mindestens 32 px. Titel 24/32, Dialog 20/28, Abschnitt 16/24, Bedientext 14/20, Metadaten 12/18, technisches Protokoll 13/20. Regular und Semibold.

## Aufbau der vollständigen Ansichten

Die folgenden Entscheidungen gelten für beide eigenständig gestalteten Themen. Testinhalte tragen ausdrücklich „Testdaten“ im Namen. Angezeigte Resultate müssen aus einem echten Testlauf stammen; keine dekorativen Kennzahlen.

| Zustand | Konkrete Anordnung und Verhalten |
| --- | --- |
| Start mit Workflows und Entwurf | Schmale linke Navigation mit Signet und Wortmarke. Start/Workflows/Vorlagen oben, Hilfe/Einstellungen/Produktinformationen unten. Im Inhalt Titel, eine Hauptaktion „Neuer Workflow“, vier bestehende Einstiege in zwei Spalten, kompakte zuletzt geöffnete Liste. Entwurfhinweis führt zur tatsächlichen lokalen Ablage. Keine große Willkommensfläche. |
| Workflowübersicht mit Suche und Auswahl | Dauerhaft beschriftete Suche „Gespeicherte Workflows durchsuchen“, Sprachfilter und Sortierung über einer zeilenorientierten Liste. Name, Beschreibung, Sprache, tatsächlicher Speicherstatus und Zeit sind gemeinsam erfassbar. Pfad über Details vollständig erreichbar. Ausgewählte Zeile mit Kontur und Textzustand; Öffnen ist die zentrale Zeilenaktion. Suche, Filter und Scrollposition bleiben beim Rückweg erhalten. |
| Business-Workflow, Block ausgewählt | Kompakte Bereichsauswahl statt breiter globaler Navigation. Projektkopf mit Name, Speicherzustand und Sprache. Darunter „Ablauf“, „Daten und Parameter“, „Läufe“. In Ablauf: 272-px-Palette, Canvas, Eigenschaften bei 1280 als gezielt geöffnetes Overlay; bei ausreichendem tatsächlichem Restbudget anheftbar. Auswahl hat zusätzliche Kontur. Code wird gezielt eingeblendet. |
| Datenvorschau mit fehlender Zuordnung | Quellen und Verarbeitungsschritte links beziehungsweise bei wenig Platz oberhalb. Konfiguration des ausgewählten echten Bausteins und lesende Vorschau getrennt. Fehler erklärt die fehlende Angabe und führt zum Baustein. Vorschau zeigt Herkunft/Laufstand, angezeigte Zeilen, Begrenzung und Spaltentypen. Kein Laden allein durch Ansichtswechsel. |
| Laufvorbereitung und laufender Prozess | Hauptansicht „Läufe“ mit Vorbereitung sowie Übersicht/Ergebnisse/Protokoll für den aktuellen Lauf. Modus, Parametersatz, Basisordner, Workflowstand, Quellen, Ziele, Überschreibverhalten und Zeitlimit sind vor dem Start prüfbar. Genau eine dominante Startaktion. Beim Lauf sind Status, Modus und Stoppen sichtbar; Wechsel in Ablauf/Daten beendet den Prozess nicht. |
| Teilweise erfolgreicher Lauf | Übersicht beginnt mit fachlichen Zählern, erzeugten Dateien und verbleibenden Fehlern aus bestätigten Ereignissen. „Mit Fehlern beendet“ bleibt von „Fehlgeschlagen“, „Abgebrochen“, „Wird gestoppt“ und „Zeitlimit erreicht“ unterscheidbar. Ergebnisse gehören zur Lauf-ID und Standkennung. Technisches Protokoll ist eine gezielt gewählte Detailansicht. |
| Business-Paket exportieren | Dialog „Exportieren“ mit Projektdatei, Script und Business-Paket nur entsprechend tatsächlicher Unterstützung. Kurze Erklärung von Inhalt und Laufzeitvoraussetzungen. Die bestehende native Dateiauswahl bestimmt den Ausgabeort. VBS-Signatur wird nur für das unterstützte Scriptformat erklärt; keine vorgetäuschte Paketsignatur. |
| Darstellung und Laufzeit | Einstellungen mit Darstellung „Dunkel“, „Hell“, „System“, eigener Oberflächenskalierung und getrenntem Canvaszoom. Systemwahl folgt einer Änderung des Farbschemas. Gespeicherte Wahl bleibt erhalten. Laufzeitstatus und Pfad werden aus den bestehenden geprüften Schnittstellen übernommen. |

## Flächenbudget und Zustände

Bei 1280 × 720 ist jeweils eine Hauptaufgabe sichtbar. Palette 272 px, Eigenschaften 320 px, normaler Kopf und Arbeitsbereichsauswahl. Vollständige Daten, Ergebnisse und Protokolle konkurrieren nicht mit dem Canvas. Anheften ist erst mit mindestens 600 px verbleibendem Canvas vorgesehen; UI-Vergrößerung kann das Anheften verhindern. „Ansicht zurücksetzen“ setzt nur persönliche Ansichtspräferenzen zurück.

Normal, Hover, Fokus, Auswahl, deaktiviert, lädt, leer, Erfolg, Warnung und Fehler werden über zentrale Komponenten und Rollenfarben dargestellt. Fokus besitzt eine sichtbare Kontur; Auswahl zusätzlich Form beziehungsweise Beschriftung. Kategorien sind fachliche Orientierung und keine Statusfarbe. Große Listen und Vorschauen bleiben begrenzt; vorhandene Ausgabelimits bleiben wirksam.

## Fachliche Grenzen

Das aktuelle Prozessmodell liefert genau einen aktuellen Lauf. Es gibt keine Schnittstelle für eine dauerhafte Laufhistorie. Die Oberfläche bezeichnet diese Grenze offen und erfindet keine historischen Einträge. Vorlagen werden als unabhängige Workflowkopien über bestehende Aktionen geöffnet. Dokumentvorlagen sind Dateien im jeweiligen Business-Workflow; ScriptLab verändert deren eigene Marke und Absender nicht.

## Prüfgrundlagen

Offizielle Quellen: [Windows-Typografie](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography), [Schriftrechte](https://learn.microsoft.com/en-us/typography/fonts/font-faq), [Befehlsleisten](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/command-bar), [Dialoge](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/dialogs), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Alternative zu Ziehbewegungen](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [Electron screen](https://www.electronjs.org/docs/latest/api/screen).

Automatisierte Desktoptests, Kontrastberechnung und eigene Sichtprüfung werden getrennt von echten Nutzertests dokumentiert. Prozess-DPI-Simulation ersetzt keine Änderung der tatsächlichen Windows-Anzeigeskalierung und keinen Monitorwechsel.
