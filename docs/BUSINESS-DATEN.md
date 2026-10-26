# Lokale Business-Datenengine

Die Datenengine verwendet DuckDB 2.0.0 und openpyxl 3.1.5. Tabellen bleiben interne, verzögerte SQL-Pläne. Der Renderer erhält ausschließlich opake Tabellenreferenzen, Schemaangaben und begrenzte Vorschauen. Benutzerwerte sind Parameter; Spaltennamen werden geprüft und als Bezeichner zitiert. Freie SQL- oder Python-Ausdrücke gehören nicht zum Vertrag.

## Vertrag mit Katalog und Runner

`HANDLER[operation](kontext, konfiguration, eingaben)` liefert JSON-fähige Metadaten. `kontext.dienste['daten']` hält eine `DatenEngine` für den gesamten Lauf. Eine Tabellenreferenz lautet `{tabelle: 'interne-id', spalten: [{name, typ}]}`. `eingaben` enthält `tabelle` oder bei zwei Tabellen `links` und `rechts`; die Werte sind die vollständigen Referenzobjekte vorangegangener Schritte. Der Runner löst Parameter- und Schrittverweise auf und ordnet Fehler der Block-ID zu.

| Operation | Konfiguration | Ergebnis |
| --- | --- | --- |
| `daten.importieren` | `format: CSV/XLSX/JSON/PARQUET`, `pfad`, `optionen` | Tabellenreferenz |
| `daten.exportieren` | `format`, `pfad`, `konflikt: FEHLER/ERSETZEN/UEBERSPRINGEN/NEUER_NAME`, `optionen` | Gemeinsamer Publikationsbericht |
| `daten.spalten` | `aktion: AUSWAEHLEN/UMBENENNEN/TYP/BERECHNEN`, `spalten`, `namen`, `spalte`, `typ`, `ausdruck` passend zur Aktion; TYP-Parseoptionen siehe unten | Tabellenreferenz |
| `daten.werte` | `aktion: ERSETZEN/BEREINIGEN/LEERWERTE`, `spalten`, `suchen`, `ersatz`, `modus: GANZER_WERT/TEXTTEIL`, `trim`, `grossklein: UNVERAENDERT/GROSS/KLEIN`, `leere: STOPP/AUSLASSEN/ERSETZEN` | Tabellenreferenz |
| `daten.filtern` | `bedingung` als unten beschriebener Baum | Tabellenreferenz |
| `daten.sortieren` | `schluessel: [{spalte,richtung: ASC/DESC,nullen: ERSTE/LETZTE}]` | Tabellenreferenz |
| `daten.dubletten` | `schluessel: [Spaltenname]`, `behalten: ERSTE/LETZTE/KEINE` | Tabellenreferenz |
| `daten.vereinigen` | `nach_name: true/false`, `dubletten: true/false` (true entfernt gleiche Ergebniszeilen) | Tabellenreferenz |
| `daten.verknuepfen` | `art: INNER/LEFT/FULL`, `schluessel: [{links,rechts}]`, `kardinalitaet: 1:1/1:n/n:1/n:m`, `fehlende_zuordnung: STOPP/BEHALTEN` | Tabellenreferenz |
| `daten.gruppieren` | `schluessel: [Name]`, `aggregate: [{funktion: ANZAHL/ANZAHL_WERTE/ANZAHL_VERSCHIEDEN/SUMME/MITTELWERT/MIN/MAX,spalte?,name}]` | Tabellenreferenz |
| `daten.pruefen` | `regeln: [{art: NICHT_LEER/EINDEUTIG/BEREICH/TYP/ERLAUBTE_WERTE/ZEILENZAHL,spalte?,spalten?,minimum?,maximum?,typ?,werte?}]`, `bei_fehler: BERICHT/STOPP` | Kleine Anzahlberichte, keine fehlerhaften Gesamttabellen |
| `daten.vorschau` | `limit: 1..200` (Vorgabe 200) | Zeilen, gekürzt auf ein festes Bytebudget; kein Export |

CSV-Optionen: `trennzeichen` (Vorgabe `;`), `kopfzeile` (true), `kodierung` (`UTF8`, `UTF8_BOM`, `UTF16`, `CP1252`), `nullwert` (Vorgabe leere Zeichenfolge), `fehlzeilen: STOPP/AUSLASSEN_MIT_BERICHT`, `spalten` als explizites Array von Namen. CSV wird zunächst ausschließlich als Text eingelesen, anschließend erfolgt eine ausdrückliche Typumwandlung. Führende Nullen bleiben erhalten. Ungültige Zeilen stoppen standardmäßig; die bewusste Alternative meldet die Zahl ausgelassener Zeilen.

XLSX-Optionen: `blatt` (Name, standardmäßig erstes Blatt), `kopfzeile` (true), `formeln: STOPP/WERTE` (standardmäßig STOPP; WERTE verwendet nur vorhandene gespeicherte Ergebniswerte und berechnet keine Formel). Ein-/Ausgabe erfolgt mit openpyxl read-only/write-only und begrenzten Zeilenpaketen. Exporte schreiben Zeichenfolgen ausdrücklich als Textzellen, damit `=`, `+`, `-` oder `@` keine Formeln werden. Excel-Grenzen werden geprüft, Zeilen werden nicht still abgeschnitten.

JSON-Option `zeilenformat` (false bedeutet Array von Objekten, true bedeutet ein Objekt pro Zeile). Nur tabellarische skalare Spalten werden akzeptiert; verschachtelte Werte benötigen eine ausdrückliche vorgelagerte Aufbereitung. Parquet bewahrt die vom Plan erzeugten Datentypen.

TYP-Optionen stehen direkt in der Konfiguration: `dezimaltrennzeichen: '.'/','`, `tausendertrennzeichen: ''/'.'/','/' '`, `datumsformat: ISO/DMY/MDY` (auch `YYYY-MM-DD`, `DD.MM.YYYY`, `MM/DD/YYYY`). Fehlerhafte Tausendergruppierung wird abgewiesen. `fehlwerte: STOPP` ist die Vorgabe; bewusst gewählte Alternativen `NULL` und `AUSLASSEN_MIT_BERICHT` melden jeweils die Zahl ungültiger Werte. Dezimalcasts verwenden die ausdrücklich gewählte Skala; deren Verringerung kann Nachkommastellen runden. Literal-Dezimalwerte müssen bereits zur gewählten Präzision und Skala passen. `LEERWERTE` behandelt SQL-NULL; leere Textzeichenfolgen sind getrennt erkennbar und werden etwa durch Textbereinigung und Qualitätsregeln behandelt.

## Typisierte Werte und Ausdrücke

Typen: `TEXT`, `GANZZAHL`, `ZAHL`, `WAHRHEIT`, `DATUM`, `ZEITSTEMPEL` oder `{art:'DEZIMAL',praezision:18,skala:2}`. Dezimalzahlen werden als JSON-Zeichenfolge mit Punkt eingegeben, nicht als binäre Gleitkommazahl. Datumswerte sind ISO `JJJJ-MM-TT`, Zeitstempel ISO ohne Zeitzone. Leere Werte sind `null`; SQL-NULL wird nicht still mit 0 oder einer leeren Zeichenfolge gleichgesetzt.

Ausdrucksformen:

```json
{"art":"spalte","name":"Betrag"}
{"art":"wert","typ":{"art":"DEZIMAL","praezision":18,"skala":2},"wert":"19.95"}
{"art":"rechnen","operator":"SUB","links":{"art":"spalte","name":"Brutto"},"rechts":{"art":"spalte","name":"Rabatt"}}
{"art":"funktion","funktion":"JAHR","argument":{"art":"spalte","name":"Datum"}}
```

Rechenoperatoren: `ADD`, `SUB`, `MUL`, `DIV`. Funktionen: `JAHR`, `MONAT`, `TAG`, `TRIM`, `GROSS`, `KLEIN`, `LAENGE`, `REGEX`. REGEX benötigt zusätzlich `muster` und `gruppe` (0..99), nutzt DuckDB/RE2 und erhält keinen Python-Code. Division durch 0 führt zu einem Fehler statt unendlichen Werten.

Bedingungen: `{art:'vergleich',links:Ausdruck,operator:'EQ/NE/GT/GE/LT/LE/ENTHAELT/BEGINNT/ENDET/IN/IST_LEER/IST_NICHT_LEER',rechts:Ausdruck}`. Für einfache Felder ist alternativ `spalte` und `wert` (typisierter Literal-Ausdruck) zulässig. `IN` verwendet `werte:[typisierterLiteral,...]`. Verknüpfungen `{art:'UND'|'ODER',kinder:[Bedingung,...]}` und `{art:'NICHT',kind:Bedingung}`. Vergleiche mit `null` sind ausschließlich über `IST_LEER`/`IST_NICHT_LEER` zulässig. Alle Bäume haben eine feste Tiefen-/Größenbegrenzung.

## Dateisicherheit, Speicher und Grenzen

Importe lesen lokale Dateien über `Kontext.pfad`. DuckDB lädt und installiert keine Erweiterungen aus dem Netz. Quellfingerabdrücke (Stat und SHA-256) werden vor Auswertung erneut geprüft; eine geänderte Quelle führt zum Fehler. Exporte gehen durch die gemeinsame `dateien.publizieren`-Funktion mit atomarer Zieldateipublikation und Quellenkontrolle. Vorschau/Prüflauf werden dort als geplant behandelt und verändern keine fachlichen Ziele. Daten werden in DuckDB bzw. einer temporären Datenbank verarbeitet; die Engine holt nie die vollständige Tabelle mit `fetchall()` nach Python. Sortieren/Joins/Aggregationen können trotzdem erheblichen Arbeits- und Plattenspeicher benötigen.

`duckdb_speicher` begrenzt den DuckDB-Puffer, nicht den gesamten Python-Prozess. `max_temp_bytes` setzt DuckDBs `max_temp_directory_size` für ausgelagerte Abfragedaten. Technische Datenbank-, Transkodierungs- und Bibliotheksdateien sind davon getrennt; das ist kein Betriebssystem-Datenträgerkontingent. Kontextgrenzen gelten zusätzlich für Dateigröße, XLSX-Importzeilen und Exportzeilen. Die Vorschau holt jeweils nur eine Zeile, kürzt lange Textzellen bereits in der SQL-Projektion und meldet `gekuerzt` sowie `zellen_gekuerzt`. Zeilen sind auf 200, ausgegebene Zellwerte auf 256 KiB begrenzt. Eine laufende Vorschau-Abfrage wird nach höchstens fünf Sekunden über DuckDBs `interrupt()` abgebrochen; Dateifingerabdruck und Schemaprüfung liegen außerhalb dieser Abfragefrist und unter dem übergeordneten Kontextzeitlimit.

`DatenEngine.zeilen(tabelle, paket=1000)` liefert einzelne Tupel in Schemareihenfolge und verwendet intern `fetchmany`. `quellpfade(tabelle)` liefert nach erneuter Quellenprüfung die ursprünglichen Dateien für Dokumentpublikationen. Die Engine wird durch `Kontext.schliessen()` geschlossen, bevor dessen technischer Arbeitsordner entfernt wird.

CSV ist ein Textaustauschformat. Ein CSV-Export bewahrt Textwerte unverändert, einschließlich führender Formelzeichen; ein fremdes Tabellenprogramm kann solche Werte beim Öffnen als Formeln interpretieren. Für unvertrauenswürdige Werte, die in Excel geöffnet werden sollen, schreibt der XLSX-Export ausdrücklich Textzellen. XLSX kann nur begrenzt genaue Zahlen speichern; Dezimalwerte werden im XLSX-Export als Text erhalten. Es werden keine Formeln berechnet oder Office-Prozesse gestartet.

## Tatsächlich geprüfter Stand

`tests/business/test_daten.py`: **47/47 bestanden** unter Windows x64, CPython 3.12.6, DuckDB 2.0.0 und openpyxl 3.1.5 (vollständiger letzter Lauf 2,12 s, einschließlich Vorschau-Zellkürzung). Alle Dateien entstanden in isolierten temporären Verzeichnissen.

Geprüft: alle zwölf festen Operationen; verschachtelte Filter und sämtliche Vergleichs-/Rechen-/Text-/Datumfunktionen; SQL-Injektionszeichen als Daten; AST-Grenzen; führende Nullen/Unicode/Zitate/NULL; deutsche Zahlen- und Datumsformate; ungültige Typwerte mit Stoppen/NULL/Auslassen; Dezimalarithmetik und Parquet-Typroundtrip; Kardinalität, fehlende Zuordnung und Namenskollisionen; alle Aggregationen/Qualitätsregeln; 20.001 Zeilen über mehrere Pakete; echte Query-Unterbrechung mit danach weiter nutzbarer Verbindung; Offline-/Tempeinstellungen; Vorschaugrenzen; Quelländerungen; atomare Exportfehler; Konfliktregeln und unveränderte Prüflaufziele; XLSX-Formelzeichen als Text und Excel-Grenzen.

Dabei wurden zwei echte Fehler im zentralen Dateidienst korrigiert: Windows-Statwerte verschiedener APIs dürfen nicht fälschlich gleichgesetzt werden; der Windows-Flush der Staging-Datei benötigt einen Schreibhandle. Diese Tests belegen die Datenengine mit synthetischen Dateien. App-UI, Installer, produktive Datenbestände und millionenzeilige Lasten sind davon getrennte Prüfungen.

## Offizielle Grundlagen

- [DuckDB 2.0: verzögerte Relations-API](https://duckdb.org/docs/2.0/clients/python/relational_api)
- [DuckDB 2.0: CSV-Import](https://duckdb.org/docs/2.0/data/csv/overview)
- [DuckDB 2.0: JSON](https://duckdb.org/docs/2.0/data/json/overview)
- [DuckDB 2.0: Parameterbindung und Python-Cursor](https://duckdb.org/docs/2.0/clients/python/dbapi)
- [DuckDB 2.0: Speicher- und Erweiterungseinstellungen](https://duckdb.org/docs/2.0/configuration/overview)
- [DuckDB 2.0: COPY und Parquet](https://duckdb.org/docs/2.0/sql/statements/copy)
- [DuckDB 2.0: reguläre Ausdrücke mit RE2](https://duckdb.org/docs/2.0/sql/functions/regular_expressions)
- [openpyxl 3.1: Read-only/Write-only-Modi](https://openpyxl.readthedocs.io/en/3.1/optimized.html)
