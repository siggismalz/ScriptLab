$ErrorActionPreference = 'Stop'
if (-not $env:SCRIPTLAB_CI_PYTHON -or -not [IO.Path]::IsPathFullyQualified($env:SCRIPTLAB_CI_PYTHON)) { throw 'Der feste CI-Basisinterpreter fehlt.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$technik = [IO.Path]::GetFullPath((Join-Path $repo 'artifacts\business-runtime'))
$ziel = [IO.Path]::GetFullPath((Join-Path $technik 'ci-venv'))
if (-not $ziel.StartsWith($technik + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Der CI-Zielordner ist ungültig.' }
if (Test-Path -LiteralPath $ziel) { throw 'Die CI-Umgebung ist bereits vorhanden und wird nicht überschrieben.' }
[void][IO.Directory]::CreateDirectory($technik)
function ProzessAusgabe([string]$Phase, [string]$Kanal, [string]$Text) {
  # Vier feste Phasen mit je zwei Kanälen: höchstens 96 KiB Nutztext insgesamt.
  $grenze = 12 * 1024
  $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
  if ($bytes.Length -gt $grenze) {
    $anfang = $bytes.Length - $grenze
    while ($anfang -lt $bytes.Length -and ($bytes[$anfang] -band 0xC0) -eq 0x80) { $anfang++ }
    $Text = [Text.Encoding]::UTF8.GetString($bytes, $anfang, $bytes.Length - $anfang)
    Write-Host "[$Phase / $Kanal] Ausgabe gekürzt; die letzten höchstens 12 KiB folgen."
  } else {
    Write-Host "[$Phase / $Kanal]"
  }
  if ($Text.Length -gt 0) { Write-Host $Text }
}
function FesterProzess([string]$Phase, [string]$Programm, [string[]]$Argumente, [int]$Frist) {
  Write-Host "CI-Phase: $Phase"
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $Programm
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
  $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
  # -I ignoriert Python-Umgebungsvariablen; die feste Startoption gilt auch dort.
  $start.ArgumentList.Add('-X')
  $start.ArgumentList.Add('utf8')
  foreach ($argument in $Argumente) { $start.ArgumentList.Add($argument) }
  $prozess = [Diagnostics.Process]::Start($start)
  try {
    # Beide Pipes sofort parallel leeren, bevor auf den Prozess gewartet wird.
    $ausgabe = $prozess.StandardOutput.ReadToEndAsync()
    $fehlerausgabe = $prozess.StandardError.ReadToEndAsync()
    $zeitlimit = -not $prozess.WaitForExit($Frist)
    if ($zeitlimit) {
      $prozess.Kill($true)
      if (-not $prozess.WaitForExit(5000)) { throw "CI-Phase '$Phase': Das Prozessende wurde nicht bestätigt." }
    }
    $exitcode = $prozess.ExitCode
    Write-Host "CI-Phase '$Phase': Exitcode $exitcode"
    $kanaele = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($ausgabe, $fehlerausgabe))
    $pipesFertig = $kanaele.Wait(5000)
    if ($ausgabe.IsCompletedSuccessfully) { ProzessAusgabe $Phase 'stdout' ($ausgabe.GetAwaiter().GetResult()) }
    if ($fehlerausgabe.IsCompletedSuccessfully) { ProzessAusgabe $Phase 'stderr' ($fehlerausgabe.GetAwaiter().GetResult()) }
    if (-not $pipesFertig) { throw "CI-Phase '$Phase': Die Ausgabekanäle wurden nach Prozessende nicht innerhalb von 5 Sekunden geschlossen." }
    if ($zeitlimit) { throw "CI-Phase '$Phase': Das feste Zeitlimit der CI-Einrichtung wurde erreicht (Exitcode $exitcode)." }
    if ($exitcode -ne 0) { throw "CI-Phase '$Phase' ist fehlgeschlagen (Exitcode $exitcode)." }
  } finally {
    if (-not $prozess.HasExited) { $prozess.Kill($true); [void]$prozess.WaitForExit(5000) }
    $prozess.Dispose()
  }
}
FesterProzess 'Business-venv anlegen' $env:SCRIPTLAB_CI_PYTHON @('-I','-m','venv',$ziel) 60000
$python = Join-Path $ziel 'Scripts\python.exe'
FesterProzess 'Gepinnte Business-Pakete installieren' $python @('-I','-m','pip','--isolated','install','--require-hashes','--only-binary=:all:','--disable-pip-version-check','--no-cache-dir','--no-compile','-r',(Join-Path $repo 'laufzeit\requirements-business.lock')) 240000
$probe = Join-Path $technik 'ci-metadaten.py'
[IO.File]::WriteAllText($probe, @'
import json, sys
from pathlib import Path
ziel = Path(__file__).parent / 'installation.json'
ziel.write_text(json.dumps({'installation': {'pfad': sys.executable, 'version': '.'.join(map(str, sys.version_info[:3])), 'architektur': 'x64', 'implementierung': 'CPython', 'tkinter': None}}, indent=2), encoding='utf-8')
'@, [Text.UTF8Encoding]::new($false))
FesterProzess 'Interpreter-Metadaten lesen' $python @('-I',$probe) 10000
$env:PYTHONPATH = Join-Path $repo 'laufzeit'
FesterProzess 'Business-Dateitests ausführen' $python @('-m','unittest','discover','-s',(Join-Path $repo 'tests\business'),'-p','test_*.py','-q') 180000
if ($env:GITHUB_ENV) {
  [IO.File]::AppendAllText($env:GITHUB_ENV, "SCRIPTLAB_BUSINESS_PYTHON=$python`nSCRIPTLAB_BUSINESS_TESTS=1`n", [Text.UTF8Encoding]::new($false))
}
