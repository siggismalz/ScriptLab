param([Parameter(Mandatory)][string]$Quelle,[Parameter(Mandatory)][string]$Ziel)
$ErrorActionPreference='Stop'
$artefakte=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts'))+[IO.Path]::DirectorySeparatorChar
$quelleVoll=[IO.Path]::GetFullPath($Quelle)
$zielVoll=[IO.Path]::GetFullPath($Ziel)
if (-not $quelleVoll.StartsWith($artefakte,[StringComparison]::OrdinalIgnoreCase) -or -not $zielVoll.StartsWith($artefakte,[StringComparison]::OrdinalIgnoreCase)) {throw 'Die QA-Darstellung ist auf eigene Artefakte begrenzt.'}
if ([IO.Path]::GetExtension($quelleVoll) -ine '.docx' -or [IO.Path]::GetExtension($zielVoll) -ine '.pdf') {throw 'Erwartet werden DOCX-Quelle und PDF-Prüfausgabe.'}
if (Get-Process WINWORD -ErrorAction SilentlyContinue) {throw 'Eine vorhandene Word-Sitzung bleibt unberührt. Die QA-Konvertierung wurde nicht gestartet.'}
$word=$null;$dokument=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false
  $word.DisplayAlerts=0
  $word.AutomationSecurity=3
  $dokument=$word.Documents.Open($quelleVoll,$false,$true,$false)
  $dokument.ExportAsFixedFormat($zielVoll,17)
  Get-Item -LiteralPath $zielVoll | Select-Object Name,Length
} finally {
  if ($dokument) {$dokument.Close(0);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($dokument)}
  if ($word) {$word.Quit(0);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)}
}
