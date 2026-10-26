/** Reine Byteprüfung. Sie schreibt keine Datei und ruft keine Workflowaktion auf. */
export const vbsKodierungsHelfer = `Function SL_Kodierungsfehler(daten, laenge, kodierung)
  Dim roh, i, j, erstes, zweites, folge, minimum, maximum, wort, danach
  SL_Kodierungsfehler = ""
  If laenge = 0 Then Exit Function
  If VarType(daten) = 8209 Then
    If UBound(daten) - LBound(daten) + 1 <> laenge Then
      SL_Kodierungsfehler = "Die vorhandene Textdatei konnte nicht vollständig geprüft werden."
      Exit Function
    End If
    ' ADO liefert Byte(), dessen Indexzugriff in VBScript einen Typenkonflikt auslöst.
    ' CStr kopiert die Binärdaten einmal unverändert; MidB/AscB lesen danach einzelne Bytes.
    roh = CStr(daten)
  ElseIf VarType(daten) = 8 Then
    roh = daten
  Else
    SL_Kodierungsfehler = "Die vorhandene Textdatei konnte nicht als Binärdaten geprüft werden."
    Exit Function
  End If
  If LenB(roh) <> laenge Then
    SL_Kodierungsfehler = "Die vorhandene Textdatei konnte nicht vollständig geprüft werden."
    Exit Function
  End If
  If kodierung = "UTF8" Then
    i = 0
    Do While i < laenge
      erstes = AscB(MidB(roh, (i) + 1, 1))
      folge = 0 : minimum = 128 : maximum = 191
      If erstes <= 127 Then
        folge = 0
      ElseIf erstes >= 194 And erstes <= 223 Then
        folge = 1
      ElseIf erstes = 224 Then
        folge = 2 : minimum = 160
      ElseIf (erstes >= 225 And erstes <= 236) Or (erstes >= 238 And erstes <= 239) Then
        folge = 2
      ElseIf erstes = 237 Then
        folge = 2 : maximum = 159
      ElseIf erstes = 240 Then
        folge = 3 : minimum = 144
      ElseIf erstes >= 241 And erstes <= 243 Then
        folge = 3
      ElseIf erstes = 244 Then
        folge = 3 : maximum = 143
      Else
        SL_Kodierungsfehler = "Die vorhandene Datei passt nicht zur gewählten UTF-8-Kodierung. Die Datei wurde nicht verändert."
        Exit Function
      End If
      If i + folge >= laenge Then
        SL_Kodierungsfehler = "Die vorhandene UTF-8-Datei endet mit einem unvollständigen Zeichen. Die Datei wurde nicht verändert."
        Exit Function
      End If
      If folge > 0 Then
        zweites = AscB(MidB(roh, (i + 1) + 1, 1))
        If zweites < minimum Or zweites > maximum Then
          SL_Kodierungsfehler = "Die vorhandene Datei enthält ungültiges UTF-8. Die Datei wurde nicht verändert."
          Exit Function
        End If
        For j = 2 To folge
          zweites = AscB(MidB(roh, (i + j) + 1, 1))
          If zweites < 128 Or zweites > 191 Then
            SL_Kodierungsfehler = "Die vorhandene Datei enthält ungültiges UTF-8. Die Datei wurde nicht verändert."
            Exit Function
          End If
        Next
      End If
      i = i + folge + 1
    Loop
  ElseIf kodierung = "UTF16" Then
    If (laenge Mod 2) <> 0 Then
      SL_Kodierungsfehler = "Die vorhandene UTF-16LE-Datei enthält ein unvollständiges Zeichen. Die Datei wurde nicht verändert."
      Exit Function
    End If
    If laenge >= 2 Then
      If AscB(MidB(roh, 1, 1)) = 254 And AscB(MidB(roh, (1) + 1, 1)) = 255 Then
        SL_Kodierungsfehler = "Die vorhandene Datei ist UTF-16BE, gewählt ist UTF-16LE. Die Datei wurde nicht verändert."
        Exit Function
      End If
    End If
    If laenge >= 3 Then
      If AscB(MidB(roh, 1, 1)) = 239 And AscB(MidB(roh, (1) + 1, 1)) = 187 And AscB(MidB(roh, (2) + 1, 1)) = 191 Then
        SL_Kodierungsfehler = "Die vorhandene Datei ist UTF-8, gewählt ist UTF-16LE. Die Datei wurde nicht verändert."
        Exit Function
      End If
    End If
    i = 0
    Do While i < laenge
      wort = AscB(MidB(roh, (i) + 1, 1)) + 256 * AscB(MidB(roh, (i + 1) + 1, 1))
      If wort >= 55296 And wort <= 56319 Then
        If i + 3 >= laenge Then
          SL_Kodierungsfehler = "Die vorhandene UTF-16LE-Datei endet mit einem unvollständigen Zeichenpaar. Die Datei wurde nicht verändert."
          Exit Function
        End If
        danach = AscB(MidB(roh, (i + 2) + 1, 1)) + 256 * AscB(MidB(roh, (i + 3) + 1, 1))
        If danach < 56320 Or danach > 57343 Then
          SL_Kodierungsfehler = "Die vorhandene Datei enthält ein ungültiges UTF-16LE-Zeichenpaar. Die Datei wurde nicht verändert."
          Exit Function
        End If
        i = i + 4
      ElseIf wort >= 56320 And wort <= 57343 Then
        SL_Kodierungsfehler = "Die vorhandene Datei enthält ein ungültiges einzelnes UTF-16LE-Folgezeichen. Die Datei wurde nicht verändert."
        Exit Function
      Else
        i = i + 2
      End If
    Loop
  Else
    SL_Kodierungsfehler = "Die Textkodierung wird nicht unterstützt."
  End If
End Function`;
