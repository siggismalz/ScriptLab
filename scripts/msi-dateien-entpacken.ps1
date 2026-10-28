param([Parameter(Mandatory=$true)][string]$Quelle, [Parameter(Mandatory=$true)][string]$Ziel)
$ErrorActionPreference = 'Stop'
# Ausschließlich lesender MSI-Zugriff: keine Installationssequenz, Produktregistrierung oder Custom Action.
$stageWurzel = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts\python-buendel'))
$zielVoll = [IO.Path]::GetFullPath($Ziel)
if (-not $zielVoll.StartsWith($stageWurzel + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Das Extraktionsziel liegt außerhalb des privaten Buildordners.' }
if (Test-Path -LiteralPath $zielVoll) { throw 'Das neue MSI-Extraktionsziel ist bereits vorhanden.' }
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public sealed class ScriptLabMsiLeser : IDisposable {
  [DllImport("msi.dll", CharSet=CharSet.Unicode)] static extern uint MsiOpenDatabase(string pfad, IntPtr modus, out uint db);
  [DllImport("msi.dll", CharSet=CharSet.Unicode)] static extern uint MsiDatabaseOpenView(uint db, string sql, out uint view);
  [DllImport("msi.dll")] static extern uint MsiViewExecute(uint view, uint record);
  [DllImport("msi.dll")] static extern uint MsiViewFetch(uint view, out uint record);
  [DllImport("msi.dll", CharSet=CharSet.Unicode)] static extern uint MsiRecordGetString(uint record, uint feld, StringBuilder text, ref uint anzahl);
  [DllImport("msi.dll")] static extern uint MsiRecordReadStream(uint record, uint feld, byte[] bytes, ref uint anzahl);
  [DllImport("msi.dll")] static extern uint MsiCloseHandle(uint handle);
  uint db;
  static void Pruefen(uint code) { if (code != 0) throw new InvalidOperationException("Lesender MSI-Zugriff: " + code); }
  public ScriptLabMsiLeser(string pfad) { Pruefen(MsiOpenDatabase(pfad, IntPtr.Zero, out db)); }
  static string Text(uint record, uint feld) {
    uint n=0; MsiRecordGetString(record, feld, null, ref n);
    var text = new StringBuilder((int)n + 1); n++;
    Pruefen(MsiRecordGetString(record, feld, text, ref n)); return text.ToString();
  }
  public string[][] Lesen(string sql, int spalten) {
    uint view; Pruefen(MsiDatabaseOpenView(db, sql, out view));
    try {
      Pruefen(MsiViewExecute(view, 0)); var zeilen = new List<string[]>(); uint record;
      uint code; while ((code=MsiViewFetch(view, out record)) == 0) {
        try { var zeile = new string[spalten]; for(int i=0;i<spalten;i++) zeile[i]=Text(record,(uint)i+1); zeilen.Add(zeile); }
        finally { MsiCloseHandle(record); }
      }
      if (code != 259) Pruefen(code); return zeilen.ToArray();
    } finally { MsiCloseHandle(view); }
  }
  public void Cabinet(string name, string ziel) {
    if (name.IndexOf('\'') >= 0) throw new InvalidOperationException("Ungültiger Cabinetname.");
    uint view; Pruefen(MsiDatabaseOpenView(db, "SELECT `Data` FROM `_Streams` WHERE `Name`='"+name+"'", out view));
    try {
      Pruefen(MsiViewExecute(view,0)); uint record; Pruefen(MsiViewFetch(view,out record));
      try { using(var datei = new FileStream(ziel,FileMode.CreateNew,FileAccess.Write)) {
        byte[] bytes = new byte[65536]; uint n;
        do { n=(uint)bytes.Length; Pruefen(MsiRecordReadStream(record,1,bytes,ref n)); datei.Write(bytes,0,(int)n); } while(n>0);
      }} finally { MsiCloseHandle(record); }
    } finally { MsiCloseHandle(view); }
  }
  public void Dispose() { if(db!=0) { MsiCloseHandle(db); db=0; } }
}
'@
$leser = [ScriptLabMsiLeser]::new([IO.Path]::GetFullPath($Quelle))
try {
  $verzeichnisse = @{}
  foreach ($zeile in $leser.Lesen('SELECT `Directory`,`Directory_Parent`,`DefaultDir` FROM `Directory`', 3)) { $verzeichnisse[$zeile[0]] = @($zeile[1],$zeile[2]) }
  $komponenten = @{}
  foreach ($zeile in $leser.Lesen('SELECT `Component`,`Directory_` FROM `Component`', 2)) { $komponenten[$zeile[0]] = $zeile[1] }
  function Verzeichnis([string]$Kennung, [int]$Tiefe=0) {
    if ($Tiefe -gt 40 -or -not $verzeichnisse.ContainsKey($Kennung)) { throw 'Ungültiger MSI-Verzeichnisbaum.' }
    $eintrag=$verzeichnisse[$Kennung]
    if (-not $eintrag[0]) { return '' }
    $name=($eintrag[1] -split ':')[0]
    $name=($name -split '\|')[-1]
    $eltern=Verzeichnis $eintrag[0] ($Tiefe+1)
    if ($name -eq '.') { return $eltern }
    if (-not $eltern) { return $name }
    return Join-Path $eltern $name
  }
  [void][IO.Directory]::CreateDirectory($zielVoll)
  $roh=Join-Path $zielVoll '_cabinet'
  [void][IO.Directory]::CreateDirectory($roh)
  $nummer=0
  foreach ($zeile in $leser.Lesen('SELECT `Cabinet` FROM `Media`', 1)) {
    if (-not $zeile[0].StartsWith('#')) { throw 'Nur eingebettete, signierte MSI-Cabinets sind zulässig.' }
    $cab=Join-Path $zielVoll ('quelle-'+($nummer++)+'.cab')
    $leser.Cabinet($zeile[0].Substring(1),$cab)
    & (Join-Path $env:SystemRoot 'System32\expand.exe') '-F:*' $cab $roh | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Das originale MSI-Cabinet konnte nicht entpackt werden.' }
  }
  foreach ($zeile in $leser.Lesen('SELECT `File`,`Component_`,`FileName` FROM `File`', 3)) {
    $dateiname=($zeile[2] -split '\|')[-1]
    $verzeichnis=Verzeichnis $komponenten[$zeile[1]]
    $relativ=if ($verzeichnis) { Join-Path $verzeichnis $dateiname } else { $dateiname }
    $zielDatei=[IO.Path]::GetFullPath((Join-Path $zielVoll $relativ))
    if (-not $zielDatei.StartsWith($zielVoll + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Eine MSI-Datei verlässt den Buildordner.' }
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($zielDatei))
    [IO.File]::Copy((Join-Path $roh $zeile[0]),$zielDatei,$false)
  }
} finally { $leser.Dispose() }
