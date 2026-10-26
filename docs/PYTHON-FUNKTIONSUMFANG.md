# Python-Funktionsumfang und Semantik

Inventar vom 26.10.2026. Der bestehende Katalog enthält 48 ScriptLab-Bausteintypen. Die gemeinsame Workflowprüfung bleibt maßgeblich: genau ein Start, Verbindung statt Rasterposition, verschachtelte Abläufe, Pflichtwerte und keine stillschweigend ausgelassenen aktiven Anweisungen. Der Python-Generator arbeitet direkt auf diesem geprüften Modell; er übersetzt keinen VBS-Quelltext.

## Ziel und Generatorbasis

Ziel sind stabile CPython-Versionen 3.12 bis 3.15 auf Windows x64. Die Syntax wird auf das gemeinsame Python-3.12-Niveau begrenzt. Der erzeugte Export ist eigenständig und verwendet nur die Python-Standardbibliothek sowie vorhandene Windows-Systembibliotheken. Dialogbausteine benötigen eine Python-Installation mit Tcl/Tk. Es werden weder Python noch Module oder Windows-Features automatisch installiert.

Blockly 13.4.0 liefert `PythonGenerator` aus `blockly/python`. ScriptLab verwendet dessen Python-Literalkodierung, Einrückung und Rangfolgen als tatsächliche Generatorbasis und ergänzt die eigenen Modellgeneratoren. Die Bedeutung kommt aus dem sprachneutral geprüften Workflowmodell. Es entsteht kein zweiter bearbeitbarer Blockly-Zustand und kein Zwischenschritt über VBS.

Python-Exporte verwenden UTF-8 ohne BOM und CRLF. Identischer Workflow und identische Exportoptionen müssen identischen Quelltext ergeben. Ein Testtoken und der Testbasisordner sind vom Export getrennt. Exportpfade beziehen sich auf den Speicherort der `.py`-Datei, Testpfade auf den ausdrücklich übergebenen Basisordner. Ausgabecodierung und vom Workflow bearbeitete Textdateien sind getrennte Entscheidungen.

## Vollständiges Inventar

Die folgende Tabelle erfasst zunächst das Soll anhand des tatsächlich vorhandenen VBS-Generators. Sie ist keine Behauptung bestandener Python-Laufzeittests. Abweichungen oder offene Äquivalenzfragen werden darunter ausdrücklich geführt.

| Typ               | Baustein                     | Zu erhaltende Bedeutung                                                                                                           |
| ----------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `sl_start`        | Workflow starten             | Genau ein Einstieg und genau der verbundene Hauptablauf.                                                                          |
| `sl_comment`      | Kommentar hinzufügen         | Deutscher Kommentar; Zeilenumbrüche bleiben Kommentare, niemals Pythoncode.                                                       |
| `sl_end`          | Workflow beenden             | Erfolgreiches Ende mit Exitcode 0, auch innerhalb eines verschachtelten Ablaufs.                                                  |
| `sl_if`           | Wenn / sonst                 | Genau einen Zweig anhand der ausgewerteten Wahrheitsbedingung wählen.                                                             |
| `sl_compare`      | Werte vergleichen            | Gleich, ungleich, größer, kleiner; Variant-Typen einschließlich Empty und booleschem Wahr prüfen.                                 |
| `sl_logic`        | Und / oder                   | Beide Eingaben auswerten; keine Python-Kurzschlussauswertung. Dynamische numerische Werte haben bitweise VBS-Bedeutung.           |
| `sl_not`          | Bedingung umkehren           | Boolesches Nicht; für dynamische numerische Werte das VBS-Bitkomplement.                                                          |
| `sl_exists`       | Datei oder Ordner vorhanden  | Genau den gewählten Pfadtyp prüfen; kein automatisches Erstellen.                                                                 |
| `sl_repeat`       | Eine Anzahl wiederholen      | Einmal bestimmte ganze Anzahl von 0 bis 1.000.000 auswerten.                                                                      |
| `sl_while`        | Solange wiederholen          | Bedingung vor jedem Durchlauf erneut auswerten.                                                                                   |
| `sl_foreach`      | Für jeden Listeneintrag      | Momentaufnahme der Liste in ihrer Reihenfolge; Schleifenvariable enthält das aktuelle Element.                                    |
| `sl_foreach_file` | Für jede Datei im Ordner     | Momentaufnahme der Dateien ohne Unterordner, nach Windows-Textvergleich sortiert.                                                 |
| `sl_mkdir`        | Ordner anlegen               | Fehlende Eltern anlegen; bestehender Ordner bleibt; Datei am Pfad ist Fehler.                                                     |
| `sl_copy`         | Datei kopieren               | Vollständiger Zieldateiname; vorhandenes Ziel standardmäßig Fehler, nur bewusst ersetzen; fehlende Quelle oder Zielordner Fehler. |
| `sl_move`         | Datei verschieben            | Erst kopieren, Quelle erst danach löschen; bei Löschfehler können beide Dateien bleiben.                                          |
| `sl_rename`       | Datei umbenennen             | Neuer Blattname im selben Ordner, keine Pfad-/Windows-Sonderzeichen, kein Überschreiben.                                          |
| `sl_list_files`   | Dateien auflisten            | Vollständige Pfade nur direkter Dateien, keine Unterordner; leere Liste bei leerem Ordner.                                        |
| `sl_basename`     | Dateiname aus Pfad           | Letzter Name einschließlich Erweiterung; Datei muss nicht existieren.                                                             |
| `sl_read_text`    | Textdatei lesen              | Vorhandene Datei mit ausdrücklich gewählter UTF-8-/UTF-16LE-/Windows-ANSI-Kodierung lesen; Zeilenenden erhalten.                  |
| `sl_write_text`   | Textdatei schreiben          | Inhalt ersetzen oder Datei anlegen; Elternordner muss existieren.                                                                 |
| `sl_append_text`  | Textdatei ergänzen           | Bestehenden Text lesen und mit Ergänzung neu schreiben; kein automatischer Zeilenumbruch.                                         |
| `sl_delete`       | Datei löschen (erweitert)    | Genau eine vorhandene Datei; standardmäßig native Rückfrage mit vorausgewähltem Nein; keine Papierkorbsemantik.                   |
| `sl_set`          | Variable anlegen / setzen    | Stabile, exakt verglichene Blockly-Variablen-ID verwenden; Anzeigename ist keine Referenz. Listen wie VBS-Wertkopien behandeln.                                  |
| `sl_get`          | Variable verwenden           | Gesetzten Wert lesen; mögliche Verwendung vor Zuweisung bleibt Hinweis und ergibt den definierten Empty-Zustand.                  |
| `sl_text`         | Text                         | Ausschließlich Daten; Anführungszeichen, Umlaute, Steuerzeichen und Zeilenumbrüche sicher kodieren.                               |
| `sl_number`       | Zahl                         | Geprüftes Komma-/Punktformat als localeunabhängiges Pythonliteral; keine Tausendertrennzeichen.                                   |
| `sl_bool`         | Wahrheitswert                | Wahr/falsch; VBS-Zahlenwert von wahr ist −1, nicht Python-1.                                                                      |
| `sl_list`         | Liste erstellen              | Neue leere Liste ohne geteilten Zustand.                                                                                          |
| `sl_list_add`     | Eintrag zur Liste hinzufügen | Element am Ende hinzufügen; benötigte Listenvariable muss eine Liste sein.                                                        |
| `sl_list_get`     | Listeneintrag lesen          | Einsbasierter ganzzahliger Index; 0, negative oder fehlende Einträge sind Fehler.                                                 |
| `sl_join`         | Texte verbinden              | Beide Werte mit CStr-kompatibler Bedeutung in Text wandeln und verbinden.                                                         |
| `sl_newline`      | Zeilenumbruch                | CRLF als Daten.                                                                                                                   |
| `sl_replace`      | Text ersetzen                | Alle binär passenden Stellen, Groß-/Kleinschreibung beachten; leerer Suchtext ist Fehler.                                         |
| `sl_len`          | Textlänge                    | UTF-16-Codeeinheiten zählen; ein Emoji kann zwei Einheiten benötigen.                                                             |
| `sl_case`         | Groß- / Kleinschreibung      | Windows-Regionseinstellungen berücksichtigen; keine unbemerkte Unicode-Regeländerung.                                             |
| `sl_contains`     | Enthaltenen Text prüfen      | Binär vergleichen, Groß-/Kleinschreibung beachten; leerer Suchtext ist enthalten.                                                 |
| `sl_math`         | Grundrechenart               | Numerisch geprüfte Addition, Subtraktion, Multiplikation, Division; Division durch 0 ist Fehler.                                  |
| `sl_round`        | Zahl runden                  | 0 bis 12 Stellen; banker's rounding einschließlich Prüfung binärer Grenzwerte.                                                    |
| `sl_random`       | Zufallszahl erzeugen         | Beide ganzen Grenzen einschließen, −1.000.000.000 bis 1.000.000.000; kein kryptografischer Zufall.                                |
| `sl_output`       | Text ausgeben                | Text mit CRLF und unmittelbarem Flush in den tatsächlichen Ausgabekanal.                                                          |
| `sl_message`      | Nachricht anzeigen           | Ein echter Windows-/Tk-Dialog mit OK; nicht als reine Ausgabezeile ersetzen.                                                      |
| `sl_input`        | Texteingabe abfragen         | Dialog; Abbrechen und leerer Text ergeben beide leeren Text.                                                                      |
| `sl_question`     | Ja-/Nein-Frage               | Wahr bei Ja, falsch bei Nein; native Auswahl, standardmäßig Ja wie VBS.                                                           |
| `sl_log`          | Protokollzeile schreiben     | Lokale Zeit im Format Datum+Zeit, Leerzeichen, Text und CRLF an UTF-8-Datei anhängen.                                             |
| `sl_date`         | Aktuelles Datum              | Lokales Datum ohne Uhrzeit; DATE-Bedeutung bei weiteren Konvertierungen erhalten.                                                 |
| `sl_time`         | Aktuelle Uhrzeit             | Lokale Uhrzeit ohne aktuelles Tagesdatum; DATE-Basis beachten.                                                                    |
| `sl_date_format`  | Datum formatieren            | `JJJJ-MM-TT`, `HH:MM:SS` oder beide; ungültige Werte verständlich ablehnen.                                                       |
| `sl_sleep`        | Eine Zeit warten             | 0 bis 86.400 Sekunden; wie VBS auf ganze Millisekunden banker's-rounden.                                                          |

## Kritische Kompatibilitätsregeln

Die neuen Projekte referenzieren Variablen über case-sensitive IDs. Eine Umbenennung verändert die Bedeutung nicht; zwei IDs dürfen nicht durch Groß-/Kleinschreibungsnormalisierung verschmelzen. Nur bei der Migration alter Projekte werden bisherige Namensreferenzen auf IDs abgebildet.

Pythonstandardwerte dürfen die bisherigen Variant-Regeln nicht stillschweigend ersetzen: Empty ist kontextabhängig 0 oder leerer Text; wahr entspricht numerisch −1. Listen werden nicht als Python-Objektidentität geteilt. Die Logik wertet beide Eingaben aus. Textlänge und binäre Textvergleiche richten sich nach UTF-16-Codeeinheiten. Dynamische Zahlen-/Datumsumwandlung und Textdarstellung hängen unter VBS von Windows-Locale und Variant-Typ ab.

Geplant sind kleine, fest implementierte Kompatibilitätshelfer auf Basis von `ctypes` und den vorhandenen Windows-Automation-Routinen. Diese verwenden keine VBScript-Engine, keinen COM-Automationserver und keine frei auswählbaren DLLs/Funktionsnamen. Die native Struktur, Speicherfreigabe und Konvertierung müssen mit begrenzten Windows-Tests nachgewiesen werden; bis dahin ist dies ein Implementierungsentwurf.

UTF-8 und UTF-16LE-Ausgaben erhalten wie bisher eine BOM; der Python-Quelltext selbst dagegen nicht. ANSI verwendet die aktive Windows-ANSI-Codepage. Beim Anhängen muss vorhandener Text zur Auswahl passen. Relative Pfade sind script-/testbasisbezogen, laufwerksrelative Formen wie `C:Datei.txt` und wurzelrelative Formen wie `\Datei.txt` werden abgewiesen. Absolute Pfade können außerhalb des Basisordners wirken; er ist keine Sandbox.

## Prüfplan und Grenzen

Die erste Phase ist die reine Generatorprüfung: alle 48 Typen und Auswahlvarianten, verschachtelte Abläufe, Literale, reservierte Namen, deterministische Ausgabe, keine unnötigen Imports, Fehlermeldungen am Block und vollständige Zeilenkarte. Sie führt keinen Workflow aus.

Echte Syntax- und Semantikprozesse werden erst abgestimmt, auf isolierte temporäre Ordner begrenzt und mit festem Interpreterpfad, kurzer Frist und begrenzter Ausgabe ausgeführt. Vergleichsproben benötigen zusätzlich den festen Windows-Scripthost, aber keine Dateiaktionen oder Dialoge. Ein bestandener Lauf auf einer Pythonversion ist kein praktischer Nachweis für alle unterstützten Versionen. Nicht vorhandene Versionen, Tcl/Tk und native Dialogabnahmen bleiben ausdrücklich offen.

## Offizielle Grundlagen

- [Blockly: Codegeneration und eigene Blockgeneratoren](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/); die konkrete Klassen-API wurde zusätzlich im lokal installierten Paket Blockly 13.4.0 geprüft.
- [Python 3.12: eingebaute Funktionen](https://docs.python.org/3.12/library/functions.html), insbesondere Konvertierungen und Runden.
- [Python 3.12: ctypes und explizite C-Signaturen](https://docs.python.org/3.12/library/ctypes.html).
- [Python 3.12: Tkinter](https://docs.python.org/3.12/library/tkinter.html).
- [Python 3.15: Windows-Verwendung](https://docs.python.org/3.15/using/windows.html).
- [Windows: Variant-Vergleich VarCmp](https://learn.microsoft.com/en-us/windows/win32/api/oleauto/nf-oleauto-varcmp).
- [Microsoft: Variant-Vergleichsregeln](https://learn.microsoft.com/en-us/office/vba/language/reference/user-interface-help/comparison-operators); die VBA-Referenz ist ergänzend, die konkrete VBScript-Äquivalenz wird gesondert geprüft.
