# ScriptLab-Nutzungslizenz

Auftrag vom 30. Oktober 2026: kostenpflichtige kommerzielle Nutzung hinterlegen. Der Nutzer hat ausdrücklich gewählt: **private, nichtkommerzielle Nutzung kostenlos; kommerzielle Nutzung kostenpflichtig**. Ausgangspunkt `main` / `58dc3d1`, sauberer Arbeitsbaum.

Die maßgebliche Datei ist [LICENSE.txt](../../LICENSE.txt), Rechteinhaber Leon Stolz. Preis, Nutzerzahl und Laufzeit werden separat in Textform vereinbart; es wurden keine Kontaktdaten, Preise, Kaufbestätigung, Zahlungsabwicklung oder Aktivierung erfunden. Die Lizenz gilt für eigene ScriptLab-Bestandteile. Drittanbieterrechte, eigene Nutzerdaten und fachliche Ergebnisse bleiben getrennt. Rechtmäßig erzeugte Exporte dürfen einschließlich der benötigten ScriptLab-Helfer unabhängig laufen und weitergegeben werden, ohne zusätzliche Empfängerlizenz.

## Technische Einbindung

- `package.json` und Lockdatei verwenden `SEE LICENSE IN LICENSE.txt`, keine Änderung an Abhängigkeiten oder Produktversion.
- README und Entwicklungsdokumentation erklären die beiden Nutzungsarten. Der bestehende Generator der Drittanbieterhinweise verweist auf dieselbe Lizenz und aktualisiert Version sowie Lockdateihash; fremde Lizenztexte bleiben erhalten.
- „Über ScriptLab“ zeigt kostenlos/kostenpflichtig und den vollständigen eingebetteten Originaltext. Er stammt direkt aus `LICENSE.txt`, nicht aus einer zweiten abgeschriebenen Fassung.
- NSIS verwendet den Lizenztext als Lizenzseite; das Ressourcenpaket enthält dieselbe Datei. Der bestehende Paketprüfer vergleicht ihre tatsächlichen Bytes.
- Eigenständige Business-ZIPs enthalten `LICENSE.txt` und einen kurzen Hinweis in der Anleitung. Keine Online- oder Schlüsselprüfung im Generator oder Laufzeitcode.

## Nachweise

- `npm run check` und frischer `npm run build`: bestanden.
- Design-, Business-Paket- und Startbereichmodule zusammen: **84 bestanden, 5 optionale native Exporte übersprungen**. Die fünf angebotenen Business-Pakete werden auf bytegleiche Lizenz und passenden Anleitungshinweis geprüft.
- `node scripts/lizenzhinweise.mjs --check`: bestanden. Der bereits dokumentierte fehlende vollständige Originaltext für `lazy-val@1.0.5` bleibt offen; die neue Eigenlizenz löst das nicht.
- Neue reale Lizenz-Desktopfälle nach Aufteilung in `tests/desktop/lizenz.spec.ts`: **2/2 bestanden**, 1280×720, tatsächlich aktivierte Themen hell/dunkel und ausdrücklich geprüfte 28-px-Bedientexte bei 200%. Volltext, Zeilenumbruch, Tastatur, Schließen und kein Lauf geprüft; beide Bilder vom Hauptagenten gesehen.
- Ein erster Testaufbau hatte eine unvollständige Einstellungsdatei verwendet und prüfte deshalb nur den Standardzustand. Er wurde vor Veröffentlichung durch echtes Speichern der Einstellungen, Reload sowie konkrete Schrift-/Themenassertions ersetzt. Seine Themenbezeichnungen zählen nicht als Nachweis.
- Unabhängiger technischer Read-only-Review durch den Python-/VBS-Agenten: keine technischen Blocker. Das ist keine juristische Freigabe und kein Beleg eines abgeschlossenen Kaufvertrags.

Installer-/Paketprüfung des zusammengeführten Endstands und abschließende Regression sind eigene Nachweise im Abschlussbericht dieses Vorlagen-/UI-Durchgangs. Es wird kein Release automatisch veröffentlicht.

## Geprüfte Grundlagen

Die eigene textliche Lizenz ist bewusst keine als Open Source bezeichnete Freigabe. npm erlaubt für eigene Lizenztexte den Verweis [SEE LICENSE IN](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license). Die vorbehaltene kommerzielle Erlaubnis orientiert sich an den zustimmungsbedürftigen Handlungen in [§ 69c UrhG](https://www.gesetze-im-internet.de/urhg/__69c.html); zwingende Befugnisse nach [§ 69d](https://www.gesetze-im-internet.de/urhg/__69d.html) und [§ 69e](https://www.gesetze-im-internet.de/urhg/__69e.html) bleiben ausdrücklich unberührt. Keine Aussage, dass ein technischer Test die rechtliche Wirksamkeit aller Bedingungen bestätigt.
