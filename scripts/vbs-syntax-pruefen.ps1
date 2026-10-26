[CmdletBinding()]
param(
    [string[]]$Datei = @(),
    [switch]$Selbsttest,
    [switch]$AlsJson
)

$ErrorActionPreference = 'Stop'

# Nur Entwicklungswerkzeug. Die Anwendung liefert diesen Parser nicht aus.
# Microsoft dokumentiert: ParseScriptText im Zustand INITIALIZED wertet keinen
# Code aus. Der Helper setzt nie einen ausfuehrbaren Zustand und stellt keine
# Hostobjekte bereit. Quelle: docs/PRUEFPLAN.md.
if (-not ('ScriptLab.SyntaxNurLesen' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using EXCEPINFO = System.Runtime.InteropServices.ComTypes.EXCEPINFO;

namespace ScriptLab {
    [ComImport, Guid("BB1A2AE1-A4F9-11CF-8F20-00805F2CD064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IEngine {
        [PreserveSig] int SetScriptSite([MarshalAs(UnmanagedType.Interface)] ISite site);
        [PreserveSig] int GetScriptSite(ref Guid iid, out IntPtr site);
        // Reservierter Vtable-Platz. Dieser Helper ruft diese Methode niemals auf.
        [PreserveSig] int SetScriptState(uint state);
        [PreserveSig] int GetScriptState(out uint state);
        [PreserveSig] int Close();
    }

    [ComImport, Guid("C7EF7658-E1EE-480E-97EA-D52CB4D76D17"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IParser64 {
        [PreserveSig] int InitNew();
        [PreserveSig] int AddScriptlet([MarshalAs(UnmanagedType.LPWStr)] string defaultName,
            [MarshalAs(UnmanagedType.LPWStr)] string code, [MarshalAs(UnmanagedType.LPWStr)] string item,
            [MarshalAs(UnmanagedType.LPWStr)] string subItem, [MarshalAs(UnmanagedType.LPWStr)] string eventName,
            [MarshalAs(UnmanagedType.LPWStr)] string delimiter, ulong cookie, uint line, uint flags,
            [MarshalAs(UnmanagedType.BStr)] out string name, out EXCEPINFO error);
        [PreserveSig] int ParseScriptText([MarshalAs(UnmanagedType.LPWStr)] string code,
            [MarshalAs(UnmanagedType.LPWStr)] string item, IntPtr context,
            [MarshalAs(UnmanagedType.LPWStr)] string delimiter, ulong cookie, uint line,
            uint flags, IntPtr result, out EXCEPINFO error);
    }

    [ComImport, Guid("BB1A2AE2-A4F9-11CF-8F20-00805F2CD064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IParser32 {
        [PreserveSig] int InitNew();
        [PreserveSig] int AddScriptlet([MarshalAs(UnmanagedType.LPWStr)] string defaultName,
            [MarshalAs(UnmanagedType.LPWStr)] string code, [MarshalAs(UnmanagedType.LPWStr)] string item,
            [MarshalAs(UnmanagedType.LPWStr)] string subItem, [MarshalAs(UnmanagedType.LPWStr)] string eventName,
            [MarshalAs(UnmanagedType.LPWStr)] string delimiter, uint cookie, uint line, uint flags,
            [MarshalAs(UnmanagedType.BStr)] out string name, out EXCEPINFO error);
        [PreserveSig] int ParseScriptText([MarshalAs(UnmanagedType.LPWStr)] string code,
            [MarshalAs(UnmanagedType.LPWStr)] string item, IntPtr context,
            [MarshalAs(UnmanagedType.LPWStr)] string delimiter, uint cookie, uint line,
            uint flags, IntPtr result, out EXCEPINFO error);
    }

    [ComImport, Guid("EAE1BA61-A4ED-11CF-8F20-00805F2CD064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IScriptFehler {
        [PreserveSig] int GetExceptionInfo(out EXCEPINFO error);
        [PreserveSig] int GetSourcePosition(out uint context, out uint line, out int column);
        [PreserveSig] int GetSourceLineText([MarshalAs(UnmanagedType.BStr)] out string text);
    }

    [Guid("DB01A1E3-A42B-11CF-8F20-00805F2CD064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown), ComVisible(true)]
    public interface ISite {
        [PreserveSig] int GetLCID(out uint lcid);
        [PreserveSig] int GetItemInfo([MarshalAs(UnmanagedType.LPWStr)] string name, uint mask, out IntPtr unknown, out IntPtr typeInfo);
        [PreserveSig] int GetDocVersionString([MarshalAs(UnmanagedType.BStr)] out string version);
        [PreserveSig] int OnScriptTerminate(IntPtr result, ref EXCEPINFO error);
        [PreserveSig] int OnStateChange(uint state);
        [PreserveSig] int OnScriptError([MarshalAs(UnmanagedType.Interface)] IScriptFehler error);
        [PreserveSig] int OnEnterScript();
        [PreserveSig] int OnLeaveScript();
    }

    [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
    public sealed class LeereSite : ISite {
        public int Betreten;
        public string Fehler = "";
        public int Zeile;
        public int Spalte;
        public int GetLCID(out uint lcid) { lcid = 1031; return 0; }
        public int GetItemInfo(string name, uint mask, out IntPtr unknown, out IntPtr typeInfo) {
            unknown = IntPtr.Zero; typeInfo = IntPtr.Zero;
            return unchecked((int)0x8002802B); // Kein Hostobjekt vorhanden.
        }
        public int GetDocVersionString(out string version) { version = "ScriptLab-Syntax-1"; return 0; }
        public int OnScriptTerminate(IntPtr result, ref EXCEPINFO error) { return 0; }
        public int OnStateChange(uint state) {
            // Erlaubt sind nur uninitialisiert, initialisiert und geschlossen.
            return state == 0 || state == 5 || state == 4 ? 0 : unchecked((int)0x80070005);
        }
        public int OnScriptError(IScriptFehler error) {
            EXCEPINFO info; uint context; uint line; int column;
            error.GetExceptionInfo(out info);
            error.GetSourcePosition(out context, out line, out column);
            Fehler = info.bstrDescription ?? "Syntaxfehler"; Zeile = (int)line + 1; Spalte = column + 1;
            return 0;
        }
        public int OnEnterScript() { Betreten++; return unchecked((int)0x80070005); }
        public int OnLeaveScript() { return 0; }
    }

    public sealed class SyntaxErgebnis {
        public string Status { get; set; }
        public string Meldung { get; set; }
        public int Zeile { get; set; }
        public int Spalte { get; set; }
        public uint ZustandVorher { get; set; }
        public uint ZustandNachher { get; set; }
        public int Ausfuehrungseintritte { get; set; }
    }

    public static class SyntaxNurLesen {
        public static SyntaxErgebnis Pruefen(string code) {
            SyntaxErgebnis ergebnis = new SyntaxErgebnis();
            ergebnis.Status = "pruefung-unmoeglich"; ergebnis.Meldung = "";
            object com = null; IEngine engine = null; LeereSite site = new LeereSite();
            try {
                Type typ = Type.GetTypeFromCLSID(new Guid("B54F3741-5B07-11CF-A4B0-00AA004A55E8"), true);
                com = Activator.CreateInstance(typ); engine = (IEngine)com;
                Marshal.ThrowExceptionForHR(engine.SetScriptSite(site));
                EXCEPINFO error; int hr;
                if (IntPtr.Size == 8) {
                    IParser64 parser = (IParser64)com;
                    Marshal.ThrowExceptionForHR(parser.InitNew());
                    uint vorher; Marshal.ThrowExceptionForHR(engine.GetScriptState(out vorher));
                    ergebnis.ZustandVorher = vorher;
                    if (vorher != 5) throw new InvalidOperationException("Engine ist nicht im sicheren Parserzustand.");
                    // flags=0: ganze Anweisungen parsen, kein Ausdruck und kein Ergebnis.
                    hr = parser.ParseScriptText(code, null, IntPtr.Zero, null, 0, 0, 0, IntPtr.Zero, out error);
                } else {
                    IParser32 parser = (IParser32)com;
                    Marshal.ThrowExceptionForHR(parser.InitNew());
                    uint vorher; Marshal.ThrowExceptionForHR(engine.GetScriptState(out vorher));
                    ergebnis.ZustandVorher = vorher;
                    if (vorher != 5) throw new InvalidOperationException("Engine ist nicht im sicheren Parserzustand.");
                    hr = parser.ParseScriptText(code, null, IntPtr.Zero, null, 0, 0, 0, IntPtr.Zero, out error);
                }
                uint nachher; Marshal.ThrowExceptionForHR(engine.GetScriptState(out nachher));
                ergebnis.ZustandNachher = nachher; ergebnis.Ausfuehrungseintritte = site.Betreten;
                if (nachher != 5 || site.Betreten != 0) throw new InvalidOperationException("Parsergrenze wurde verletzt.");
                ergebnis.Status = hr >= 0 ? "gueltig" : "syntaxfehler";
                ergebnis.Meldung = hr >= 0 ? "Syntax gueltig; Inhalt nicht ausgefuehrt." :
                    (site.Fehler.Length > 0 ? site.Fehler : (error.bstrDescription ?? "VBScript-Syntaxfehler."));
                ergebnis.Zeile = site.Zeile; ergebnis.Spalte = site.Spalte;
            } catch (COMException fehler) {
                ergebnis.Meldung = "VBScript-Parser nicht verfuegbar (HRESULT 0x" + fehler.ErrorCode.ToString("X8") + ").";
            } catch (Exception fehler) {
                ergebnis.Meldung = "Syntaxpruefung nicht moeglich: " + fehler.Message;
            } finally {
                if (engine != null) { engine.Close(); }
                if (com != null && Marshal.IsComObject(com)) Marshal.FinalReleaseComObject(com);
                GC.KeepAlive(site);
            }
            return ergebnis;
        }
    }
}
'@
}

$ergebnisse = [System.Collections.Generic.List[object]]::new()
if ($Selbsttest) {
    $testOrdner = Join-Path ([System.IO.Path]::GetTempPath()) ('ScriptLab-Parser-' + [guid]::NewGuid().ToString('N'))
    [System.IO.Directory]::CreateDirectory($testOrdner) | Out-Null
    $markierung = Join-Path $testOrdner 'darf-nie-entstehen.txt'
    try {
        $sichererPfad = $markierung.Replace('"', '""')
        $quelltext = "Option Explicit`r`nDim f`r`nSet f = CreateObject(`"Scripting.FileSystemObject`")`r`nf.CreateTextFile `"$sichererPfad`", True`r`n"
        $richtig = [ScriptLab.SyntaxNurLesen]::Pruefen($quelltext)
        $falsch = [ScriptLab.SyntaxNurLesen]::Pruefen("Option Explicit`r`nIf True Then`r`n")
        $nichtAusgefuehrt = -not (Test-Path -LiteralPath $markierung)
        $ergebnisse.Add([pscustomobject]@{
            datei = '(Parser-Selbsttest)'
            status = if ($richtig.Status -eq 'pruefung-unmoeglich') { 'pruefung-unmoeglich' } elseif ($richtig.Status -eq 'gueltig' -and $falsch.Status -eq 'syntaxfehler' -and $nichtAusgefuehrt -and $richtig.Ausfuehrungseintritte -eq 0) { 'gueltig' } else { 'fehlgeschlagen' }
            gueltigerCode = $richtig
            syntaxfehler = $falsch
            markierungsdateiFehlt = $nichtAusgefuehrt
        })
    } finally {
        # Nur der zuvor erzeugte leere Testordner; kein rekursives Loeschen.
        if (-not (Test-Path -LiteralPath $markierung)) { [System.IO.Directory]::Delete($testOrdner, $false) }
    }
}

foreach ($pfad in $Datei) {
    $vollstaendig = [System.IO.Path]::GetFullPath($pfad)
    if ([System.IO.Path]::GetExtension($vollstaendig) -ine '.vbs') { throw 'Die Syntaxpruefung liest ausschliesslich .vbs-Dateien.' }
    $dateiInfo = Get-Item -LiteralPath $vollstaendig
    if ($dateiInfo.Length -gt 10MB) { throw 'Die Datei ist fuer die Syntaxpruefung zu gross.' }
    $quelle = [System.IO.File]::ReadAllText($vollstaendig)
    $ergebnisse.Add([pscustomobject]@{ datei = $vollstaendig; ergebnis = [ScriptLab.SyntaxNurLesen]::Pruefen($quelle) })
}

if (-not $Selbsttest -and $Datei.Count -eq 0) { throw 'Mindestens -Datei oder -Selbsttest angeben.' }
if ($AlsJson) { ConvertTo-Json -InputObject @($ergebnisse.ToArray()) -Depth 8 -Compress } else { $ergebnisse.ToArray() }

if (@($ergebnisse | Where-Object { $_.status -eq 'fehlgeschlagen' -or ($_.ergebnis -and $_.ergebnis.Status -eq 'syntaxfehler') }).Count -gt 0) { exit 1 }
if (@($ergebnisse | Where-Object { $_.status -eq 'pruefung-unmoeglich' -or ($_.ergebnis -and $_.ergebnis.Status -eq 'pruefung-unmoeglich') }).Count -gt 0) { exit 2 }
