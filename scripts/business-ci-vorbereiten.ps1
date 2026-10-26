$ErrorActionPreference = 'Stop'
if (-not $env:SCRIPTLAB_CI_PYTHON -or -not [IO.Path]::IsPathFullyQualified($env:SCRIPTLAB_CI_PYTHON)) { throw 'Der feste CI-Basisinterpreter fehlt.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$technik = [IO.Path]::GetFullPath((Join-Path $repo 'artifacts\business-runtime'))
$ziel = [IO.Path]::GetFullPath((Join-Path $technik 'ci-venv'))
if (-not $ziel.StartsWith($technik + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Der CI-Zielordner ist ungültig.' }
if (Test-Path -LiteralPath $ziel) { throw 'Die CI-Umgebung ist bereits vorhanden und wird nicht überschrieben.' }
[void][IO.Directory]::CreateDirectory($technik)
function FesterProzess([string]$Programm, [string[]]$Argumente, [int]$Frist) {
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $Programm
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  foreach ($argument in $Argumente) { $start.ArgumentList.Add($argument) }
  $prozess = [Diagnostics.Process]::Start($start)
  try {
    if (-not $prozess.WaitForExit($Frist)) {
      $prozess.Kill($true)
      if (-not $prozess.WaitForExit(5000)) { throw 'Das Ende der CI-Einrichtung wurde nicht bestätigt.' }
      throw 'Das feste Zeitlimit der CI-Einrichtung wurde erreicht.'
    }
    if ($prozess.ExitCode -ne 0) { throw 'Der feste CI-Auftrag ist fehlgeschlagen.' }
  } finally {
    if (-not $prozess.HasExited) { $prozess.Kill($true); [void]$prozess.WaitForExit(5000) }
    $prozess.Dispose()
  }
}
FesterProzess $env:SCRIPTLAB_CI_PYTHON @('-I','-m','venv',$ziel) 60000
$python = Join-Path $ziel 'Scripts\python.exe'
FesterProzess $python @('-I','-m','pip','--isolated','install','--require-hashes','--only-binary=:all:','--disable-pip-version-check','--no-cache-dir','--no-compile','-r',(Join-Path $repo 'laufzeit\requirements-business.lock')) 240000
$probe = Join-Path $technik 'ci-metadaten.py'
[IO.File]::WriteAllText($probe, @'
import json, sys
from pathlib import Path
ziel = Path(__file__).parent / 'installation.json'
ziel.write_text(json.dumps({'installation': {'pfad': sys.executable, 'version': '.'.join(map(str, sys.version_info[:3])), 'architektur': 'x64', 'implementierung': 'CPython', 'tkinter': None}}, indent=2), encoding='utf-8')
'@, [Text.UTF8Encoding]::new($false))
FesterProzess $python @('-I',$probe) 10000
$env:PYTHONPATH = Join-Path $repo 'laufzeit'
FesterProzess $python @('-m','unittest','discover','-s',(Join-Path $repo 'tests\business'),'-p','test_*.py','-q') 180000
if ($env:GITHUB_ENV) {
  [IO.File]::AppendAllText($env:GITHUB_ENV, "SCRIPTLAB_BUSINESS_PYTHON=$python`nSCRIPTLAB_BUSINESS_TESTS=1`n", [Text.UTF8Encoding]::new($false))
}
