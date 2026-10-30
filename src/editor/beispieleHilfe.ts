/** Reine Erläuterungen mit klaren Testdaten. Diese Beispiele führen keine Aktionen aus. */
import { businessDefinitionen } from '../kern/business-katalog';
function businessBeispiel(def: (typeof businessDefinitionen)[number]): string {
  const format = String(def.felder.find((f) => f.name === 'format')?.standard ?? 'CSV');
  if (def.operation === 'daten.importieren')
    return `Lies „eingaben/Kunden.${format.toLowerCase()}“. Die Kundennummer „001“ bleibt beim Textimport unverändert. Verbinde das Ergebnis anschließend über die Eigenschaften mit „Zeilen filtern“.`;
  if (def.operation === 'daten.exportieren')
    return `Speichere die verbundene Tabelle unter „ausgaben/Auswertung.${format.toLowerCase()}“. Mit der Vorgabe „Mit Fehler anhalten“ bleibt eine vorhandene Datei erhalten.`;
  const beispiele: Record<string, string> = {
    'daten.spalten':
      'Wähle zum Beispiel „Region“ und „Betrag“, benenne eine Spalte um oder berechne „Bestellmenge“ als Zielbestand minus Bestand. Die Aktion ist durch den gewählten Baustein festgelegt.',
    'daten.werte':
      'Bereinige Leerzeichen in „Kundenname“ oder ersetze den Wert „unbekannt“ bewusst durch „offen“. Wähle die betroffenen Spalten und die gewünschte Behandlung leerer Werte.',
    'daten.dubletten':
      'Vergleiche doppelte Kundennummern. Sortiere vorher nach dem Änderungsdatum und wähle bewusst, ob der erste, letzte oder kein doppelter Datensatz erhalten bleiben soll.',
    'daten.filtern':
      'Zeige nur Zeilen mit Betrag größer als 50. Ergänze mit UND einen Datumsbereich, um beispielsweise ausschließlich die Bestellungen des Berichtsmonats zu berücksichtigen.',
    'daten.sortieren':
      'Sortiere die Tabelle zuerst nach Region aufsteigend und danach nach Betrag absteigend. Leere Werte kannst du bewusst an den Anfang oder ans Ende setzen.',
    'daten.vereinigen':
      'Führe die Tabellen „Oktober“ und „November“ untereinander zusammen. Die Spalten werden nach ihren Namen zugeordnet; gleiche Ergebniszeilen bleiben ohne ausdrückliche Auswahl erhalten.',
    'daten.verknuepfen':
      'Ergänze Bestellungen um die Region aus der Kundentabelle anhand der Kundennummer. „Viele zu einem“ verhindert, dass ein doppelter Kundenschlüssel Umsätze unbemerkt vervielfacht.',
    'daten.gruppieren':
      'Gruppiere nach Region und summiere die Spalte Betrag. Aus Nord 100, Süd 80 und Nord 50 entstehen Nord 150 und Süd 80. Eine zusätzliche Anzahl nennt die berücksichtigten Zeilen.',
    'daten.pruefen':
      'Prüfe, ob jede Kundennummer gefüllt und eindeutig ist. Mit „Ablauf anhalten“ werden nachfolgende Ausgaben bei einem Prüffehler verhindert; Berichten erlaubt bewusstes Fortfahren.',
    'daten.vorschau':
      'Zeige höchstens 200 Zeilen der verbundenen Tabelle. Lange Zellen und große Ausschnitte werden für die Anzeige begrenzt; die Quelldatei und der Tabellenplan bleiben unverändert.',
    'dateien.stapel':
      'Erfasse aus „eingaben“ alle Dateien mit dem Muster „*.csv“. Später erzeugte Ausgaben kommen nicht nachträglich in diesen bereits erfassten Stapel.',
    'dateien.aktion':
      'Kopiere eine ausdrücklich gewählte Testdatei in einen anderen Ordner oder erstelle ein ZIP-Archiv. Prüfe Quelle, Ziel und die gewählte Konfliktregel vor der echten Ausführung.',
    'dateien.archivieren':
      'Wähle die zuvor erfolgreich geschriebene Auswertung als bestätigtes Ergebnis. Erst dann darf die verarbeitete Quelle nach „archiv“ verschoben werden.',
    'dateien.csv_stapel':
      'Verarbeite die synthetischen CSVs aus dem Stapelbeispiel. Vollständige Dateien erhalten geprüfte Ausgaben und Archivkopien; die absichtlich fehlerhafte Quelle bleibt im Eingang.',
    'dateien.beleg_ablegen':
      'Lies einen synthetischen PDF-Beleg mit Nummer und Datum. Die Kopie landet im Monatsordner. Ein reiner Bildscan erhält einen Hinweis; sein Original bleibt unverändert.',
    'dokument.xlsx_vorlage':
      'Fülle A1 mit einem Titel und B2 mit einem geprüften Wert. Schreibe eine gewünschte Excel-Formel ausdrücklich in der Formelzuordnung. ScriptLab berechnet diese Formel nicht.',
    'dokument.docx_vorlage':
      'Ordne dem Platzhalter {{Name}} einen Text zu. Bei einer Positionsvorlage wird die gewählte Musterzeile für jede Tabellenposition wiederholt, ohne die ursprüngliche Vorlage zu überschreiben.',
    'dokument.docx_serie':
      'Erzeuge für jeden Lieferanten eine Bestellung mit eigener Positionstabelle. Im Beispiel enthält S1 zwei Positionen mit den Mengen 15 und 12 und insgesamt 27 Einheiten.',
    'dokument.docx_erstellen':
      'Erstelle ein neues Dokument mit Titel, Absatz und einer optional verbundenen Tabelle. Ein Bild wird nur aus der ausdrücklich gewählten lokalen Datei übernommen.',
    'dokument.pdf_bericht':
      'Erzeuge eine Monatsübersicht mit Region und Betrag. Die mitgelieferte Vera-Schrift stellt deutsche Texte dar; Tabellenköpfe werden auf weiteren Seiten wiederholt.',
    'dokument.pdf_verbinden':
      'Verbinde die ausdrücklich gewählten PDF-Dateien in der Reihenfolge des Dateistapels zu einem neuen Dokument. Die Quelldateien bleiben erhalten.',
    'dokument.pdf_seiten':
      'Übernimm mit „1-3,5“ die ersten drei und die fünfte Seite in eine neue PDF-Datei. Eine nicht vorhandene Seitennummer führt zu einer verständlichen Fehlermeldung.',
    'dokument.pdf_teilen':
      'Teile eine PDF beispielsweise in die Bereiche „1-2“ und „3-4“. Die Teile erhalten sichere Namen wie „Teil-1.pdf“ im gewählten Ausgabeordner.',
    'dokument.pdf_text':
      'Lies die vorhandene Textebene eines PDF-Belegs. Bei einem reinen Scan fehlen auslesbare Zeichen; der Baustein führt keine OCR oder Office-Konvertierung durch.',
    'ablauf.stapel':
      'Durchlaufe den zuvor erfassten Dateistapel. Die Variable „Aktuelle Datei“ kann in den Eigenschaften einer Kopier-, Tabellen- oder Dokumentaktion als Quelle gewählt werden.',
    'ablauf.fehler':
      'Versuche das Lesen einer Datei und gib im Fehlerzweig einen Hinweis aus. Der Bericht bewahrt den Fehler. Stoppen, Zeitlimit und unklare Dateizustände werden nicht verschluckt.',
    'ml.trainieren':
      'Für eine Klassifikation synthetischer Messdaten wählst du „Messwert“ als Eingabe und „Kategorie“ als Ziel. Erst die echte Ausführung trainiert das gewählte CPU-Verfahren und meldet die Bewertung am getrennten Testanteil.',
    'ml.speichern':
      'Speichere das verbundene Modell als „Messwerte.slmodell“. Mit der Vorgabe „Fehler“ bleibt eine vorhandene Modelldatei erhalten. Im Prüflauf wird nur das Ziel geplant, kein Modell trainiert oder gespeichert.',
    'ml.laden':
      'Lade das zuvor gespeicherte „Messwerte.slmodell“ beim bewussten Lauf und verbinde es mit „Vorhersagen erzeugen“. Unterstützte ScriptLab-Modelle werden geprüft; beliebige Python-Pickle-Dateien werden nicht geladen.',
    'ml.vorhersagen':
      'Verbinde ein trainiertes oder geladenes Modell und eine neue Tabelle mit passenden Eingabespalten. Das Ergebnis ergänzt „Vorhersage“; vorhandene Spalten und die Zeilenreihenfolge bleiben erhalten.',
  };
  return beispiele[def.operation];
}
export const bausteinBeispiele: Readonly<Record<string, string>> = {
  ...Object.fromEntries(businessDefinitionen.map((d) => [d.typ, businessBeispiel(d)])),
  sl_start:
    'Verbinde darunter „Nachricht anzeigen“. Beim eigenen Start der exportierten Datei beginnt der Ablauf mit dieser Nachricht.',
  sl_comment:
    'Der Kommentar „Zuerst die Testdateien sichern“ erscheint als lesbarer Hinweis im VBS-Quelltext und löst keine Aktion aus.',
  sl_end:
    'Nach einer abschließenden Nachricht beendet dieser Baustein das außerhalb von ScriptLab gestartete Script.',
  sl_if:
    'Wenn die Datei „ScriptLab-Testdaten\\Quelle.txt“ vorhanden ist, kopiert der Dann-Ablauf sie. Im Sonst-Ablauf kannst du stattdessen eine Nachricht vorsehen.',
  sl_compare:
    '„Anzahl“ größer als 5 ergibt wahr, wenn die Variable beispielsweise den Wert 8 enthält. Verwende das Ergebnis in einer Wenn-Bedingung.',
  sl_logic:
    '„Datei vorhanden“ und „Zielordner vorhanden“ ist nur wahr, wenn beide Bedingungen erfüllt sind. Bei „oder“ reicht eine der beiden.',
  sl_not:
    'Nicht „Datei vorhanden“ ergibt wahr, wenn die angegebene Testdatei beim späteren eigenen Start fehlt.',
  sl_exists:
    'Prüfe „ScriptLab-Testdaten\\Quelle.txt“. Das Ergebnis kann entscheiden, ob der spätere Ablauf die Datei kopiert oder eine Nachricht anzeigt.',
  sl_repeat: 'Mit der Anzahl 5 wird der innere Ablauf beim späteren eigenen Start genau fünfmal durchlaufen.',
  sl_while:
    'Solange die Variable „Zähler“ kleiner als 3 ist, wird der innere Ablauf wiederholt. Erhöhe „Zähler“ darin, damit die Wiederholung endet.',
  sl_foreach:
    'Bei der Liste „Brief“, „Foto“, „Notiz“ enthält die Eintragsvariable nacheinander diese drei Texte. Zeige sie beispielsweise im inneren Ablauf an.',
  sl_foreach_file:
    'Im Testordner „ScriptLab-Testdaten\\Eingang“ enthält die Dateivariable nacheinander den vollständigen Pfad jeder Datei. Unterordner bleiben außen vor.',
  sl_mkdir:
    'Lege beim späteren eigenen Start „ScriptLab-Testdaten\\Sicherung“ an. Fehlt auch der Testdatenordner, wird er ebenfalls angelegt.',
  sl_copy:
    'Kopiere „ScriptLab-Testdaten\\Quelle.txt“ nach „ScriptLab-Testdaten\\Sicherung\\Quelle.txt“. Die Quelldatei bleibt dabei erhalten.',
  sl_move:
    'Verschiebe „ScriptLab-Testdaten\\Entwurf.txt“ nach „ScriptLab-Testdaten\\Archiv\\Entwurf.txt“. Nach erfolgreichem Verschieben liegt die Datei nur noch am Ziel.',
  sl_rename:
    'Benenne „ScriptLab-Testdaten\\Entwurf.txt“ in „Fertiger Text.txt“ um. Der neue Name enthält keinen Ordnerpfad.',
  sl_list_files:
    'Aus dem Testordner „ScriptLab-Testdaten\\Eingang“ entsteht eine Liste vollständiger Dateipfade, die du mit „Für jeden Listeneintrag“ bearbeiten kannst.',
  sl_basename:
    'Aus „ScriptLab-Testdaten\\Eingang\\Brief.txt“ wird „Brief.txt“. Der Baustein liefert nur den letzten Namen des Pfads.',
  sl_read_text:
    'Lies den Inhalt von „ScriptLab-Testdaten\\Notiz.txt“ als UTF-8 und lege ihn beispielsweise in der Variable „Gelesener Text“ ab.',
  sl_write_text:
    'Schreibe „Hallo Leon“ in „ScriptLab-Testdaten\\Ergebnis.txt“. Ein vorhandener Dateiinhalt wird beim späteren eigenen Start ersetzt.',
  sl_append_text:
    'Ergänze „ScriptLab-Testdaten\\Notiz.txt“ um „Weitere Notiz“ und einen Zeilenumbruch. Der bisherige Text bleibt davor erhalten.',
  sl_delete:
    'Frage beim späteren eigenen Start nach, bevor „ScriptLab-Testdaten\\Alt.txt“ gelöscht wird. Die Rückfrage ist standardmäßig eingeschaltet.',
  sl_set:
    'Setze die Variable „Name“ auf den Text „Leon“. Weitere Bausteine können diesen Wert mit „Variable verwenden“ lesen.',
  sl_get:
    'Wenn „Name“ zuvor auf „Leon“ gesetzt wurde, liefert dieser Wertbaustein den Text „Leon“, etwa für eine Nachricht.',
  sl_text:
    '„Hallo Leon“ ist ein Textwert. Du kannst ihn in einer Nachricht verwenden oder mit einem weiteren Text verbinden.',
  sl_number:
    'Die Eingabe „2,75“ ist die Zahl zwei Komma fünfundsiebzig. Verwende sie beispielsweise in einer Rechnung.',
  sl_bool:
    '„Wahr“ lässt den Dann-Ablauf einer Wenn-Bedingung auswählen. „Falsch“ lässt stattdessen den Sonst-Ablauf auswählen.',
  sl_list:
    'Lege eine leere Liste in der Variable „Dateinamen“ ab. Mit „Eintrag zur Liste hinzufügen“ kannst du anschließend Namen sammeln.',
  sl_list_add:
    'Füge der zuvor angelegten Liste „Dateinamen“ den Text „Brief.txt“ hinzu. Bereits vorhandene Einträge behalten ihre Reihenfolge.',
  sl_list_get:
    'In der Liste „Brief“, „Foto“, „Notiz“ liefert die Eintragsnummer 1 den Text „Brief“. Die Nummerierung beginnt bei 1.',
  sl_join:
    'Verbinde „Hallo “ mit der Variable „Name“. Enthält sie „Leon“, entsteht der Text „Hallo Leon“. Das Leerzeichen gehört zum ersten Text.',
  sl_newline:
    'Verbinde „Erste Zeile“, diesen Zeilenumbruch und „Zweite Zeile“. In einer geschriebenen Textdatei stehen die Texte auf zwei Zeilen.',
  sl_replace: 'Ersetze in „Hallo Welt“ den Suchtext „Welt“ durch „Leon“. Das Ergebnis lautet „Hallo Leon“.',
  sl_len: 'Der Text „Hallo“ hat die Länge 5. Auch Leerzeichen zählen als Zeichen.',
  sl_case:
    'Mit Großschreibung wird aus „Hallo Leon“ der Text „HALLO LEON“. Mit Kleinschreibung entsteht „hallo leon“.',
  sl_contains:
    'Der Text „Brief.txt“ enthält „.txt“. Das Ergebnis wahr kann einen Dann-Ablauf für Textdateien auswählen.',
  sl_math:
    'Addiere 3 und 4. Das Ergebnis 7 kann in einer Variable gespeichert oder in weiteren Rechnungen verwendet werden.',
  sl_round: 'Runde die Zahl „12,341“ auf zwei Nachkommastellen. Das Ergebnis ist die Zahl „12,34“.',
  sl_random:
    'Mit den Grenzen 1 und 6 erhältst du beim späteren eigenen Start eine ganze Zahl von 1 bis einschließlich 6, etwa für einen Würfel.',
  sl_message:
    'Mit dem Text „Hallo Leon“ zeigt das eigenständig gestartete VBS-Script eine Nachricht mit genau diesem Inhalt an.',
  sl_output:
    '„Hallo Leon“ erscheint beim bewusst gestarteten Test in der Testausgabe. Beim externen Start mit wscript.exe erscheint stattdessen ein Meldungsfenster; cscript.exe schreibt den Text in seine Ausgabe.',
  sl_input:
    'Frage „Wie heißt du?“ und speichere das Ergebnis in „Name“. Ein bewusst gestarteter Test oder ein extern gestartetes Script öffnet den echten Windows-Eingabedialog.',
  sl_question:
    'Frage „Mit der Sicherung fortfahren?“. Ja liefert wahr, Nein liefert falsch; eine Wenn-Bedingung kann den weiteren Ablauf auswählen.',
  sl_log:
    'Schreibe „Sicherung abgeschlossen“ als neue Zeile mit Datum und Uhrzeit nach „ScriptLab-Testdaten\\Protokoll.txt“. Vorhandene Zeilen bleiben erhalten.',
  sl_date:
    'Der Baustein liefert das lokale Datum des späteren eigenen Scriptstarts. Mit „Datum formatieren“ kannst du es als Text verwenden.',
  sl_time:
    'Der Baustein liefert die lokale Uhrzeit des späteren eigenen Scriptstarts, beispielsweise für eine Zeitangabe im Protokoll.',
  sl_date_format:
    'Formatiere einen Datumswert für den 15. März 2026 als JJJJ-MM-TT. Das Ergebnis lautet „2026-03-15“.',
  sl_sleep:
    'Mit dem Wert 2 wartet das außerhalb von ScriptLab gestartete Script zwei Sekunden, bevor der nächste Baustein folgt.',
};
