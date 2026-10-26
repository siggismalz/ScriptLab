# Isolierter Entwicklertest: kein Zertifikatsimport, kein Schluesselspeicher,
# kein Vertrauenseintrag, kein VBS-Start. Nicht Teil der ausgelieferten App.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if ($env:OS -ne 'Windows_NT') { throw 'Dieser Test benoetigt Windows.' }

function Speicherstand-Lesen {
    $stand = @()
    foreach ($speicher in @('Cert:\CurrentUser\My', 'Cert:\LocalMachine\My', 'Cert:\CurrentUser\Root', 'Cert:\LocalMachine\Root')) {
        $stand += @(Get-ChildItem -Path $speicher | ForEach-Object { "$speicher|$($_.Thumbprint)" })
    }
    return @($stand | Sort-Object)
}

$speicherVorher = @(Speicherstand-Lesen)
$ordner = Join-Path ([IO.Path]::GetTempPath()) ('scriptlab-ephemere-signatur-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($ordner) | Out-Null
$rsa = $null
$zertifikat = $null
$privaterSchluessel = $null
try {
    # RSACng erzeugt hier einen unbenannten, ausschliesslich im Speicher lebenden CNG-Schluessel.
    $rsa = [System.Security.Cryptography.RSACng]::new(2048)
    if (-not $rsa.Key.IsEphemeral -or $null -ne $rsa.Key.KeyName) { throw 'Der Testschluessel ist nicht vollstaendig ephemer. Abbruch ohne Signatur.' }
    $anfrage = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=ScriptLab Ephemerer Entwicklertest Keine Vertrauensstellung',
        $rsa,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $zwecke = [System.Security.Cryptography.OidCollection]::new()
    [void]$zwecke.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3', 'Code Signing'))
    $anfrage.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($zwecke, $false))
    $anfrage.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature, $true))
    $anfrage.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
    $zertifikat = $anfrage.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1), [DateTimeOffset]::UtcNow.AddMinutes(30))
    $privaterSchluessel = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($zertifikat)
    if (-not ($privaterSchluessel -is [System.Security.Cryptography.RSACng]) -or -not $privaterSchluessel.Key.IsEphemeral -or $null -ne $privaterSchluessel.Key.KeyName) {
        throw 'Das Testzertifikat verweist nicht auf einen ephemeren Schluessel. Abbruch ohne Signatur.'
    }

    $datei = Join-Path $ordner 'Nur Signaturdaten mit Umlauten.vbs'
    [IO.File]::WriteAllText($datei, "Option Explicit`r`n' Ephemerer Test: ae oe ue.`r`nScriptLab_vbs_darf_nie_gestartet_werden`r`n", [Text.Encoding]::Unicode)
    $vorher = Get-AuthenticodeSignature -LiteralPath $datei
    $gesetzt = Set-AuthenticodeSignature -LiteralPath $datei -Certificate $zertifikat -HashAlgorithm SHA256 -IncludeChain Signer
    $signatur = Get-AuthenticodeSignature -LiteralPath $datei
    # Den eingebetteten PKCS#7-Signaturwert getrennt von der fehlenden
    # Zertifikatsvertrauenskette pruefen. Das fuehrt den VBS-Text nicht aus.
    Add-Type -AssemblyName System.Security
    $signierterText = [IO.File]::ReadAllText($datei, [Text.Encoding]::Unicode)
    $signaturZeilen = @($signierterText -split "`r?`n" | ForEach-Object { if ($_ -match "^'' SIG '' ([A-Za-z0-9+/=]+)$") { $Matches[1] } })
    if ($signaturZeilen.Count -eq 0) { throw 'Die VBS-Datei enthaelt keinen lesbaren Authenticode-Signaturblock.' }
    $signaturBytes = [Convert]::FromBase64String(($signaturZeilen -join ''))
    $cms = [System.Security.Cryptography.Pkcs.SignedCms]::new()
    $cms.Decode($signaturBytes)
    $cms.CheckSignature($true)
    $kopie = Join-Path $ordner 'Absichtlich veraenderte Kopie.vbs'
    [IO.File]::Copy($datei, $kopie)
    # Die erste Codeeinheit aendern, die Signatur selbst dabei vollstaendig erhalten.
    $bytes = [IO.File]::ReadAllBytes($kopie)
    $bytes[2] = [byte][char]'X'
    [IO.File]::WriteAllBytes($kopie, $bytes)
    $manipuliert = Get-AuthenticodeSignature -LiteralPath $kopie
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $helper = Join-Path $PSScriptRoot 'signatur-helper.ps1'
    $helperOriginal = (& $powershell -NoLogo -NoProfile -NonInteractive -File $helper -Operation Pruefen -Datei $datei | ConvertFrom-Json)
    $helperManipuliert = (& $powershell -NoLogo -NoProfile -NonInteractive -File $helper -Operation Pruefen -Datei $kopie | ConvertFrom-Json)
    $speicherNachher = @(Speicherstand-Lesen)
    $speicherUnveraendert = (($speicherVorher -join "`n") -ceq ($speicherNachher -join "`n"))
    $fingerabdruckPasst = $null -ne $signatur.SignerCertificate -and $signatur.SignerCertificate.Thumbprint -ceq $zertifikat.Thumbprint
    $ergebnis = [ordered]@{
        Windows = [Environment]::OSVersion.VersionString
        PowerShell = $PSVersionTable.PSVersion.ToString()
        SchluesselEphemer = $privaterSchluessel.Key.IsEphemeral
        Schluesselname = $privaterSchluessel.Key.KeyName
        SpeicherUnveraendert = $speicherUnveraendert
        Vorher = $vorher.Status.ToString()
        Signieren = $gesetzt.Status.ToString()
        Signatur = $signatur.Status.ToString()
        WindowsMeldung = $signatur.StatusMessage
        FingerabdruckPasst = $fingerabdruckPasst
        KryptografischeSignaturGeprueft = $true
        ManipulierteKopie = $manipuliert.Status.ToString()
        HelperOriginal = $helperOriginal.daten.status
        HelperManipuliert = $helperManipuliert.daten.status
        HashAlgorithmus = 'SHA256'
        ZeitstempelAngefordert = $false
        WorkflowAusgefuehrt = $false
    }
    $ergebnis | ConvertTo-Json -Compress
    if (-not $speicherUnveraendert) { throw 'Der Zertifikatsspeicher hat sich waehrend des Tests geaendert. Der Test hat keine Import- oder Vertrauensoperation aufgerufen.' }
    if (-not $fingerabdruckPasst -or $manipuliert.Status.ToString() -ne 'HashMismatch') {
        throw 'Dieser Windows-Signaturweg hat das vollstaendig ephemere Zertifikat nicht erfolgreich verwendet. Es wird kein persistenter Schluessel als Ausweg angelegt.'
    }
    if (-not $helperOriginal.ok -or -not $helperManipuliert.ok -or $helperManipuliert.daten.status -ne 'ungueltig') {
        throw 'Der produktive Pruefhelper hat die veraenderte VBS-Kopie nicht als ungueltig erkannt.'
    }
} finally {
    if ($null -ne $privaterSchluessel) { $privaterSchluessel.Dispose() }
    if ($null -ne $zertifikat) { $zertifikat.Dispose() }
    if ($null -ne $rsa) { $rsa.Dispose() }
    $absolut = [IO.Path]::GetFullPath($ordner)
    $tempBasis = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($absolut.StartsWith($tempBasis, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($absolut).StartsWith('scriptlab-ephemere-signatur-')) {
        Remove-Item -LiteralPath $absolut -Recurse -Force
    }
}
