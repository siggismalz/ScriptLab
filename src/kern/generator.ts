import { projektPruefen, type Projekt } from './projekt';
import { workflowPruefen, variablenSchluessel, type Anweisung, type Ausdruck, type Meldung } from './modell';

/** VBScript-Textliteral. Zeilenumbrüche werden als Daten zusammengesetzt. */
export function vbsText(text: string): string {
  const teile = text.split(/(\r\n|[\u0000-\u001f\u007f\u2028\u2029])/);
  return teile.map(teil => teil === '\r\n' ? 'vbCrLf' : teil === '\r' ? 'vbCr' : teil === '\n' ? 'vbLf' : teil === '\t' ? 'vbTab' : /^[\u0000-\u001f\u007f\u2028\u2029]$/.test(teil) ? `ChrW(${teil.charCodeAt(0)})` : `"${teil.replaceAll('"', '""')}"`).filter(teil => teil !== '""').join(' & ') || '""';
}

export function vbsErzeugen(projekt: Projekt): { code: string | null; meldungen: Meldung[] } {
  let geprueft: Projekt;
  try { geprueft = projektPruefen(projekt); } catch (fehler) { return { code: null, meldungen: [{ text: fehler instanceof Error ? fehler.message : 'Das Projekt ist ungültig.', stufe: 'fehler' }] }; }
  const { workflow, meldungen } = workflowPruefen(geprueft);
  if (!workflow) return { code: null, meldungen };
  const variablen = new Map(workflow.variablen.map((name, i) => [name, `v_${i + 1}`]));
  const helfer = new Set<string>(); const interneVariablen: string[] = []; let zaehler = 0;
  const variable = (name: string): string => variablen.get(variablenSchluessel(name))!;
  const neu = (): string => { const name = `sl_intern_${++zaehler}`; interneVariablen.push(name); return name; };
  const hilfe = (name: string): string => { helfer.add(name); return name; };
  function wert(a: Ausdruck): string {
    const w = (name: string): string => wert(a.werte[name]);
    const op = (zeichen: string): string => `(${w('A')} ${zeichen} ${w('B')})`;
    switch (a.art) {
      case 'sl_text': return `(${vbsText(a.felder.TEXT)})`;
      case 'sl_number': return a.felder.ZAHL.startsWith('-') ? `(${a.felder.ZAHL})` : a.felder.ZAHL;
      case 'sl_bool': return a.felder.WERT === 'WAHR' ? 'True' : 'False';
      case 'sl_get': return variable(a.felder.VAR);
      case 'sl_list': return 'Array()';
      case 'sl_compare': return op(({ EQ: '=', NE: '<>', GT: '>', LT: '<' })[a.felder.OP]!);
      case 'sl_logic': return op(a.felder.OP === 'AND' ? 'And' : 'Or');
      case 'sl_not': return `(Not ${w('WERT')})`;
      case 'sl_exists': return `${hilfe('SL_Vorhanden')}(${w('PFAD')}, ${a.felder.ART === 'ORDNER' ? 'True' : 'False'})`;
      case 'sl_list_files': return `${hilfe('SL_Dateien')}(${w('PFAD')})`;
      case 'sl_read_text': return `${hilfe('SL_Lesen')}(${w('PFAD')}, ${vbsText(a.felder.KODIERUNG)})`;
      case 'sl_list_get': return `${hilfe('SL_Eintrag')}(${w('LISTE')}, ${w('INDEX')})`;
      case 'sl_join': return `(CStr(${w('A')}) & CStr(${w('B')}))`;
      case 'sl_newline': return 'vbCrLf';
      case 'sl_replace': return `${hilfe('SL_Ersetzen')}(${w('TEXT')}, ${w('SUCHEN')}, ${w('ERSATZ')})`;
      case 'sl_len': return `Len(CStr(${w('TEXT')}))`;
      case 'sl_case': return `${a.felder.ART === 'GROSS' ? 'UCase' : 'LCase'}(CStr(${w('TEXT')}))`;
      case 'sl_contains': return `(InStr(1, CStr(${w('TEXT')}), CStr(${w('SUCHEN')}), vbBinaryCompare) > 0)`;
      case 'sl_math': return a.felder.OP === 'DIV' ? `${hilfe('SL_Teilen')}(${w('A')}, ${w('B')})` : `(${hilfe('SL_Zahl')}(${w('A')}) ${({ ADD: '+', SUB: '-', MUL: '*' })[a.felder.OP]} ${hilfe('SL_Zahl')}(${w('B')}))`;
      case 'sl_round': return `Round(${hilfe('SL_Zahl')}(${w('WERT')}), ${a.felder.STELLEN})`;
      case 'sl_random': return `${hilfe('SL_Zufall')}(${w('MIN')}, ${w('MAX')})`;
      case 'sl_input': return `InputBox(CStr(${w('TEXT')}), "ScriptLab")`;
      case 'sl_question': return `(MsgBox(CStr(${w('TEXT')}), vbYesNo + vbQuestion, "ScriptLab") = vbYes)`;
      case 'sl_date': return 'Date()';
      case 'sl_time': return 'Time()';
      case 'sl_date_format': return `${hilfe('SL_Datum')}(${w('WERT')}, ${vbsText(a.felder.FORMAT)})`;
      default: throw new Error('Für einen Baustein fehlt der VBS-Generator.');
    }
  }
  const zeilen: string[] = [];
  function anweisungen(liste: Anweisung[], tiefe: number): void {
    const ausgeben = (zeile: string): void => { zeilen.push(`${'  '.repeat(tiefe)}${zeile}`); };
    for (const a of liste) {
      const w = (name: string): string => wert(a.werte[name]);
      ausgeben(`sl_block = ${vbsText(a.id)}`);
      switch (a.art) {
        case 'sl_comment': for (const zeile of a.felder.TEXT.split(/\r\n|\r|\n|\u2028|\u2029/)) ausgeben(`' ${zeile.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')}`); break;
        case 'sl_end': ausgeben('WScript.Quit 0'); break;
        case 'sl_message': ausgeben(`MsgBox CStr(${w('TEXT')}), vbInformation, "ScriptLab"`); break;
        case 'sl_set': ausgeben(`${variable(a.felder.VAR)} = ${w('WERT')}`); break;
        case 'sl_if': ausgeben(`If ${w('BEDINGUNG')} Then`); anweisungen(a.zweige.DANN, tiefe + 1); ausgeben('Else'); anweisungen(a.zweige.SONST, tiefe + 1); ausgeben('End If'); break;
        case 'sl_repeat': {
          const index = neu(); const anzahl = neu(); ausgeben(`${anzahl} = ${hilfe('SL_Anzahl')}(${w('ANZAHL')})`); ausgeben(`For ${index} = 1 To ${anzahl}`); anweisungen(a.zweige.ABLAUF, tiefe + 1); ausgeben('Next'); break;
        }
        case 'sl_while': ausgeben('Do'); zeilen.push(`${'  '.repeat(tiefe + 1)}sl_block = ${vbsText(a.id)}`); zeilen.push(`${'  '.repeat(tiefe + 1)}If Not (${w('BEDINGUNG')}) Then Exit Do`); anweisungen(a.zweige.ABLAUF, tiefe + 1); ausgeben('Loop'); break;
        case 'sl_foreach': case 'sl_foreach_file': {
          const liste = neu(); const index = neu(); const inhalt = a.art === 'sl_foreach' ? w('LISTE') : `${hilfe('SL_Dateien')}(${w('PFAD')})`;
          ausgeben(`${liste} = ${hilfe('SL_Liste')}(${inhalt})`); ausgeben(`For ${index} = 0 To UBound(${liste})`); zeilen.push(`${'  '.repeat(tiefe + 1)}${variable(a.felder.VAR)} = ${liste}(${index})`); anweisungen(a.zweige.ABLAUF, tiefe + 1); ausgeben('Next'); break;
        }
        case 'sl_mkdir': ausgeben(`${hilfe('SL_Ordner')} ${w('PFAD')}`); break;
        case 'sl_copy': case 'sl_move': ausgeben(`${hilfe('SL_Kopieren')} ${w('QUELLE')}, ${w('ZIEL')}, ${a.felder.ZIELREGEL === 'ERSETZEN' ? 'True' : 'False'}, ${a.art === 'sl_move' ? 'True' : 'False'}`); break;
        case 'sl_rename': ausgeben(`${hilfe('SL_Umbenennen')} ${w('QUELLE')}, ${w('NAME')}`); break;
        case 'sl_write_text': case 'sl_append_text': ausgeben(`${hilfe('SL_Schreiben')} ${w('PFAD')}, ${w('TEXT')}, ${vbsText(a.felder.KODIERUNG)}, ${a.art === 'sl_append_text' ? 'True' : 'False'}`); break;
        case 'sl_delete': ausgeben(`${hilfe('SL_Loeschen')} ${w('PFAD')}, ${a.felder.RUECKFRAGE === 'JA' ? 'True' : 'False'}`); break;
        case 'sl_list_add': ausgeben(`${variable(a.felder.VAR)} = ${hilfe('SL_Anhaengen')}(${variable(a.felder.VAR)}, ${w('WERT')})`); break;
        case 'sl_log': ausgeben(`${hilfe('SL_Schreiben')} ${w('PFAD')}, ${hilfe('SL_Datum')}(Now(), "BEIDES") & " " & CStr(${w('TEXT')}) & vbCrLf, "UTF8", True`); break;
        case 'sl_sleep': ausgeben(`${hilfe('SL_Warten')} ${w('SEKUNDEN')}`); break;
        default: throw new Error('Für einen Baustein fehlt der VBS-Generator.');
      }
    }
  }
  try { anweisungen(workflow.anweisungen, 1); } catch { return { code: null, meldungen: [...meldungen, { text: 'Der Workflow konnte nicht vollständig in VBS übersetzt werden.', stufe: 'fehler' }] }; }
  // Abhängigkeiten werden geschlossen, bevor die Helfer in fester Reihenfolge ausgegeben werden.
  if (helfer.has('SL_Schreiben')) helfer.add('SL_Lesen');
  if (helfer.has('SL_Umbenennen')) helfer.add('SL_Kopieren');
  if (helfer.has('SL_Eintrag') || helfer.has('SL_Anhaengen')) helfer.add('SL_Liste');
  const benutztDateien = [...helfer].some(name => ['SL_Vorhanden', 'SL_Dateien', 'SL_Lesen', 'SL_Schreiben', 'SL_Ordner', 'SL_Kopieren', 'SL_Umbenennen', 'SL_Loeschen'].includes(name));
  const deklarationen = ['sl_block', ...variablen.values(), ...interneVariablen];
  const code = [
    "' Erstellt mit ScriptLab. Entwickelt von Leon Stolz.",
    "' Dieses Script wurde von ScriptLab nur erzeugt, niemals ausgeführt.",
    "' Relative Pfade beziehen sich auf den Speicherort dieser VBS-Datei.",
    'Option Explicit', '',
    ...deklarationen.map(name => `Dim ${name}`),
    ...(benutztDateien ? ['Dim sl_fso', 'Set sl_fso = CreateObject("Scripting.FileSystemObject")'] : []),
    ...(helfer.has('SL_Zufall') ? ['Randomize'] : []),
    'sl_block = "Start"', 'SL_Geschuetzt', 'WScript.Quit 0', '',
    'Sub SL_Haupt()', ...zeilen, 'End Sub', '',
    grundHelfer,
    ...(benutztDateien ? [pfadHelfer] : []),
    ...Object.entries(helferTexte).filter(([name]) => helfer.has(name)).map(([, text]) => text),
    '',
  ].join('\n').replace(/\r?\n/g, '\r\n');
  return { code, meldungen };
}

const grundHelfer = `' Die Fehlerunterdrückung ist auf diesen einen Prozeduraufruf begrenzt.
' Ein unerwarteter Fehler verlässt SL_Haupt und beendet das Script sofort.
Sub SL_Geschuetzt()
  Dim nummer, beschreibung
  On Error Resume Next
  SL_Haupt
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Aktion ausführen"
End Sub

Sub SL_Fehler(meldung)
  MsgBox "Der Workflow wurde beendet." & vbCrLf & CStr(meldung) & vbCrLf & "Baustein: " & sl_block, vbCritical, "ScriptLab"
  WScript.Quit 1
End Sub

Sub SL_Systemfehler(nummer, beschreibung, aktion)
  If nummer <> 0 Then SL_Fehler aktion & ": " & beschreibung
End Sub`;

const pfadHelfer = `Function SL_Pfad(wert)
  Dim pfad, nummer, beschreibung
  pfad = CStr(wert)
  If Len(Trim(pfad)) = 0 Or InStr(pfad, "*") > 0 Or InStr(pfad, "?") > 0 Or InStr(pfad, vbCr) > 0 Or InStr(pfad, vbLf) > 0 Then SL_Fehler "Der Dateipfad ist leer oder enthält unzulässige Platzhalter."
  If Left(pfad, 2) = "\\\\" Or (Len(pfad) >= 3 And Mid(pfad, 2, 2) = ":\\") Then
    ' Vollständiger Laufwerks- oder UNC-Pfad.
  Else
    If InStr(pfad, ":") > 0 Or Left(pfad, 1) = "\\" Or Left(pfad, 1) = "/" Then SL_Fehler "Bitte einen vollständigen oder zum Script relativen Pfad verwenden."
    pfad = sl_fso.BuildPath(sl_fso.GetParentFolderName(WScript.ScriptFullName), pfad)
  End If
  On Error Resume Next
  SL_Pfad = sl_fso.GetAbsolutePathName(pfad)
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Pfad prüfen"
End Function`;

const helferTexte: Record<string, string> = {
  SL_Vorhanden: `Function SL_Vorhanden(wert, ordner)
  Dim pfad, ergebnis, nummer, beschreibung
  pfad = SL_Pfad(wert)
  On Error Resume Next
  If ordner Then
    ergebnis = sl_fso.FolderExists(pfad)
  Else
    ergebnis = sl_fso.FileExists(pfad)
  End If
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Pfad prüfen"
  SL_Vorhanden = ergebnis
End Function`,
  SL_Ordner: `Sub SL_Ordner(wert)
  Dim pfad, eltern, nummer, beschreibung
  pfad = SL_Pfad(wert)
  If sl_fso.FileExists(pfad) Then SL_Fehler "Am Ordnerpfad ist bereits eine Datei vorhanden: " & pfad
  If sl_fso.FolderExists(pfad) Then Exit Sub
  eltern = sl_fso.GetParentFolderName(pfad)
  If Len(eltern) = 0 Or StrComp(eltern, pfad, vbTextCompare) = 0 Then SL_Fehler "Der übergeordnete Ordner ist nicht verfügbar: " & pfad
  If Not sl_fso.FolderExists(eltern) Then SL_Ordner eltern
  On Error Resume Next
  sl_fso.CreateFolder pfad
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Ordner anlegen"
End Sub`,
  SL_Kopieren: `Sub SL_Kopieren(von, nach, ersetzen, verschieben)
  Dim quelle, ziel, eltern, nummer, beschreibung
  quelle = SL_Pfad(von) : ziel = SL_Pfad(nach)
  If StrComp(quelle, ziel, vbTextCompare) = 0 Then SL_Fehler "Quelle und Ziel dürfen nicht dieselbe Datei sein."
  If Not sl_fso.FileExists(quelle) Then SL_Fehler "Die Quelldatei fehlt: " & quelle
  If sl_fso.FolderExists(ziel) Then SL_Fehler "Bitte einen vollständigen Zieldateinamen angeben: " & ziel
  eltern = sl_fso.GetParentFolderName(ziel)
  If Not sl_fso.FolderExists(eltern) Then SL_Fehler "Der Zielordner fehlt: " & eltern
  If sl_fso.FileExists(ziel) And Not ersetzen Then SL_Fehler "Die Zieldatei ist bereits vorhanden: " & ziel
  On Error Resume Next
  If verschieben Then
    ' Erst kopieren. Die Quelle bleibt erhalten, falls das Kopieren scheitert.
    sl_fso.CopyFile quelle, ziel, ersetzen
    If Err.Number = 0 Then sl_fso.DeleteFile quelle, False
  Else
    sl_fso.CopyFile quelle, ziel, ersetzen
  End If
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Datei kopieren oder verschieben"
End Sub`,
  SL_Umbenennen: `Sub SL_Umbenennen(von, neuerName)
  Dim quelle, name, ziel, nummer, beschreibung, zeichen
  quelle = SL_Pfad(von) : name = CStr(neuerName)
  If Len(Trim(name)) = 0 Or name = "." Or name = ".." Then SL_Fehler "Der neue Dateiname ist leer oder ungültig."
  For Each zeichen In Array("\\", "/", ":", "*", "?", Chr(34), "<", ">", "|", vbCr, vbLf)
    If InStr(name, zeichen) > 0 Then SL_Fehler "Der neue Dateiname darf keinen Pfad oder ungültige Zeichen enthalten."
  Next
  ziel = sl_fso.BuildPath(sl_fso.GetParentFolderName(quelle), name)
  If StrComp(quelle, ziel, vbTextCompare) = 0 Then SL_Fehler "Quelle und neuer Name sind gleich."
  If Not sl_fso.FileExists(quelle) Then SL_Fehler "Die Quelldatei fehlt: " & quelle
  If sl_fso.FileExists(ziel) Or sl_fso.FolderExists(ziel) Then SL_Fehler "Der neue Dateiname ist bereits belegt: " & ziel
  On Error Resume Next
  sl_fso.MoveFile quelle, ziel
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Datei umbenennen"
End Sub`,
  SL_Dateien: `Function SL_Dateien(wert)
  Dim pfad, ordner, datei, liste(), anzahl, i, j, tausch, nummer, beschreibung
  pfad = SL_Pfad(wert)
  If Not sl_fso.FolderExists(pfad) Then SL_Fehler "Der Ordner fehlt: " & pfad
  anzahl = 0
  On Error Resume Next
  Set ordner = sl_fso.GetFolder(pfad)
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Dateien auflisten"
  On Error Resume Next
  For Each datei In ordner.Files
    ReDim Preserve liste(anzahl)
    liste(anzahl) = datei.Path
    anzahl = anzahl + 1
    If Err.Number <> 0 Then Exit For
  Next
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Dateien auflisten"
  If anzahl = 0 Then
    SL_Dateien = Array()
    Exit Function
  End If
  For i = 1 To anzahl - 1
    tausch = liste(i) : j = i - 1
    Do While j >= 0
      If StrComp(liste(j), tausch, vbTextCompare) <= 0 Then Exit Do
      liste(j + 1) = liste(j) : j = j - 1
    Loop
    liste(j + 1) = tausch
  Next
  SL_Dateien = liste
End Function`,
  SL_Lesen: `Function SL_Lesen(wert, kodierung)
  Dim pfad, strom, text, nummer, beschreibung, zeichensatz
  pfad = SL_Pfad(wert)
  If Not sl_fso.FileExists(pfad) Then SL_Fehler "Die Textdatei fehlt: " & pfad
  If kodierung = "ANSI" Then
    On Error Resume Next
    Set strom = sl_fso.OpenTextFile(pfad, 1, False, 0)
    If Err.Number = 0 Then text = strom.ReadAll
    nummer = Err.Number : beschreibung = Err.Description
    If IsObject(strom) Then strom.Close
    On Error GoTo 0
  Else
    If kodierung = "UTF8" Then
      zeichensatz = "utf-8"
    ElseIf kodierung = "UTF16" Then
      zeichensatz = "unicode"
    Else
      SL_Fehler "Die Textkodierung wird nicht unterstützt."
    End If
    On Error Resume Next
    Set strom = CreateObject("ADODB.Stream")
    If Err.Number = 0 Then strom.Type = 2
    If Err.Number = 0 Then strom.Charset = zeichensatz
    If Err.Number = 0 Then strom.Open
    If Err.Number = 0 Then strom.LoadFromFile pfad
    If Err.Number = 0 Then text = strom.ReadText
    nummer = Err.Number : beschreibung = Err.Description
    If IsObject(strom) Then strom.Close
    On Error GoTo 0
  End If
  SL_Systemfehler nummer, beschreibung, "Textdatei lesen"
  SL_Lesen = text
End Function`,
  SL_Schreiben: `Sub SL_Schreiben(wert, inhalt, kodierung, anhaengen)
  Dim pfad, eltern, strom, text, nummer, beschreibung, zeichensatz
  pfad = SL_Pfad(wert) : text = CStr(inhalt)
  If sl_fso.FolderExists(pfad) Then SL_Fehler "Der Textdateipfad bezeichnet einen Ordner: " & pfad
  eltern = sl_fso.GetParentFolderName(pfad)
  If Not sl_fso.FolderExists(eltern) Then SL_Fehler "Der Zielordner fehlt: " & eltern
  If anhaengen And sl_fso.FileExists(pfad) Then text = SL_Lesen(pfad, kodierung) & text
  If kodierung = "ANSI" Then
    On Error Resume Next
    Set strom = sl_fso.OpenTextFile(pfad, 2, True, 0)
    If Err.Number = 0 Then strom.Write text
    nummer = Err.Number : beschreibung = Err.Description
    If IsObject(strom) Then strom.Close
    On Error GoTo 0
  Else
    If kodierung = "UTF8" Then
      zeichensatz = "utf-8"
    ElseIf kodierung = "UTF16" Then
      zeichensatz = "unicode"
    Else
      SL_Fehler "Die Textkodierung wird nicht unterstützt."
    End If
    On Error Resume Next
    Set strom = CreateObject("ADODB.Stream")
    If Err.Number = 0 Then strom.Type = 2
    If Err.Number = 0 Then strom.Charset = zeichensatz
    If Err.Number = 0 Then strom.Open
    If Err.Number = 0 Then strom.WriteText text
    If Err.Number = 0 Then strom.SaveToFile pfad, 2
    nummer = Err.Number : beschreibung = Err.Description
    If IsObject(strom) Then strom.Close
    On Error GoTo 0
  End If
  SL_Systemfehler nummer, beschreibung, "Textdatei schreiben"
End Sub`,
  SL_Loeschen: `Sub SL_Loeschen(wert, rueckfrage)
  Dim pfad, nummer, beschreibung
  pfad = SL_Pfad(wert)
  If Not sl_fso.FileExists(pfad) Then SL_Fehler "Die zu löschende Datei fehlt: " & pfad
  If rueckfrage Then
    If MsgBox("Diese Datei wirklich löschen?" & vbCrLf & pfad, vbYesNo + vbExclamation + vbDefaultButton2, "ScriptLab") <> vbYes Then Exit Sub
  End If
  On Error Resume Next
  sl_fso.DeleteFile pfad, False
  nummer = Err.Number : beschreibung = Err.Description
  On Error GoTo 0
  SL_Systemfehler nummer, beschreibung, "Datei löschen"
End Sub`,
  SL_Liste: `Function SL_Liste(wert)
  If Not IsArray(wert) Then SL_Fehler "Hier wird eine Liste benötigt. Lege die Variable zuerst mit einer Liste an."
  SL_Liste = wert
End Function`,
  SL_Anhaengen: `Function SL_Anhaengen(wert, eintrag)
  Dim liste, laenge
  liste = SL_Liste(wert) : laenge = UBound(liste) + 1
  ReDim Preserve liste(laenge)
  liste(laenge) = eintrag
  SL_Anhaengen = liste
End Function`,
  SL_Eintrag: `Function SL_Eintrag(wert, index)
  Dim liste, nummer
  liste = SL_Liste(wert)
  If Not IsNumeric(index) Then SL_Fehler "Die Nummer eines Listeneintrags muss eine ganze Zahl sein."
  nummer = CDbl(index)
  If nummer <> Fix(nummer) Or nummer < 1 Or nummer > UBound(liste) + 1 Then SL_Fehler "Der angeforderte Listeneintrag ist nicht vorhanden. Die Nummerierung beginnt bei 1."
  SL_Eintrag = liste(CLng(nummer) - 1)
End Function`,
  SL_Anzahl: `Function SL_Anzahl(wert)
  Dim anzahl
  If Not IsNumeric(wert) Then SL_Fehler "Die Wiederholungsanzahl muss eine Zahl sein."
  anzahl = CDbl(wert)
  If anzahl <> Fix(anzahl) Or anzahl < 0 Or anzahl > 1000000 Then SL_Fehler "Die Wiederholungsanzahl muss eine ganze Zahl zwischen 0 und 1.000.000 sein."
  SL_Anzahl = CLng(anzahl)
End Function`,
  SL_Teilen: `Function SL_Teilen(a, b)
  If Not IsNumeric(a) Or Not IsNumeric(b) Then SL_Fehler "Zum Dividieren werden zwei Zahlen benötigt."
  If CDbl(b) = 0 Then SL_Fehler "Eine Division durch null ist nicht möglich."
  SL_Teilen = CDbl(a) / CDbl(b)
End Function`,
  SL_Zahl: `Function SL_Zahl(wert)
  If Not IsNumeric(wert) Then SL_Fehler "Hier wird eine Zahl benötigt."
  SL_Zahl = CDbl(wert)
End Function`,
  SL_Zufall: `Function SL_Zufall(von, bis)
  Dim minimum, maximum
  If Not IsNumeric(von) Or Not IsNumeric(bis) Then SL_Fehler "Die Grenzen der Zufallszahl müssen Zahlen sein."
  minimum = CDbl(von) : maximum = CDbl(bis)
  If minimum <> Fix(minimum) Or maximum <> Fix(maximum) Or minimum > maximum Or Abs(minimum) > 1000000000 Or Abs(maximum) > 1000000000 Then SL_Fehler "Zufallsgrenzen müssen ganze Zahlen zwischen −1.000.000.000 und 1.000.000.000 sein; das Minimum darf nicht größer sein als das Maximum."
  SL_Zufall = Int((maximum - minimum + 1) * Rnd) + minimum
End Function`,
  SL_Ersetzen: `Function SL_Ersetzen(text, suchen, ersatz)
  If Len(CStr(suchen)) = 0 Then SL_Fehler "Der zu ersetzende Suchtext darf nicht leer sein."
  SL_Ersetzen = Replace(CStr(text), CStr(suchen), CStr(ersatz), 1, -1, vbBinaryCompare)
End Function`,
  SL_Datum: `Function SL_Datum(wert, format)
  Dim datum, tag, zeit
  If Not IsDate(wert) Then SL_Fehler "Der Datumswert kann nicht formatiert werden."
  datum = CDate(wert)
  tag = Right("0000" & Year(datum), 4) & "-" & Right("0" & Month(datum), 2) & "-" & Right("0" & Day(datum), 2)
  zeit = Right("0" & Hour(datum), 2) & ":" & Right("0" & Minute(datum), 2) & ":" & Right("0" & Second(datum), 2)
  If format = "DATUM" Then
    SL_Datum = tag
  ElseIf format = "ZEIT" Then
    SL_Datum = zeit
  Else
    SL_Datum = tag & " " & zeit
  End If
End Function`,
  SL_Warten: `Sub SL_Warten(wert)
  Dim sekunden
  If Not IsNumeric(wert) Then SL_Fehler "Die Wartezeit muss eine Zahl sein."
  sekunden = CDbl(wert)
  If sekunden < 0 Or sekunden > 86400 Then SL_Fehler "Die Wartezeit muss zwischen 0 und 86.400 Sekunden liegen."
  WScript.Sleep CLng(sekunden * 1000)
End Sub`,
};
