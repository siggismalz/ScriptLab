param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Auflisten', 'Pruefen', 'Signieren')]
    [string] $Operation,
    [string] $Datei = '',
    [string] $Fingerabdruck = '',
    [string] $ZeitstempelUrl = ''
)

# Dieser fest implementierte Helper liest oder signiert Dateien. Er fuehrt sie nie aus.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Ergebnis-Ausgeben($Daten) {
    [Console]::WriteLine((@{ ok = $true; daten = $Daten } | ConvertTo-Json -Depth 6 -Compress))
}

function Vorgang-Abbrechen([string] $Meldung) {
    $ausnahme = New-Object System.InvalidOperationException($Meldung)
    $ausnahme.Data['ScriptLabMeldung'] = $true
    throw $ausnahme
}

function Zertifikate-Lesen {
    $jetzt = Get-Date
    $gefunden = @()
    foreach ($speicher in @('Cert:\CurrentUser\My', 'Cert:\LocalMachine\My')) {
        foreach ($zertifikat in @(Get-ChildItem -Path $speicher -CodeSigningCert)) {
            $codeSigning = @($zertifikat.EnhancedKeyUsageList | Where-Object { $_.ObjectId.ToString() -eq '1.3.6.1.5.5.7.3.3' }).Count -gt 0
            if ($codeSigning -and $zertifikat.HasPrivateKey -and $zertifikat.NotBefore -le $jetzt -and $zertifikat.NotAfter -gt $jetzt) {
                $gefunden += @{ zertifikat = $zertifikat; speicher = $speicher }
            }
        }
    }
    return $gefunden
}

function Datei-Pruefen {
    if ([string]::IsNullOrWhiteSpace($Datei) -or -not [IO.Path]::IsPathRooted($Datei) -or $Datei.IndexOfAny([char[]]"`r`n`0") -ge 0) {
        Vorgang-Abbrechen 'Der Exportpfad ist ungueltig.'
    }
    $vollerPfad = [IO.Path]::GetFullPath($Datei)
    if ([IO.Path]::GetExtension($vollerPfad) -ine '.vbs') { Vorgang-Abbrechen 'Nur exportierte VBS-Dateien koennen geprueft oder signiert werden.' }
    if (-not [IO.File]::Exists($vollerPfad)) { Vorgang-Abbrechen 'Die exportierte VBS-Datei wurde nicht gefunden.' }
    if ((Get-Item -LiteralPath $vollerPfad).Length -gt 10485760) { Vorgang-Abbrechen 'Die Exportdatei ist zu gross fuer die Signaturpruefung.' }
    return $vollerPfad
}

function Signatur-Lesen([string] $Pfad) {
    $signatur = Get-AuthenticodeSignature -LiteralPath $Pfad
    $status = 'pruefung-unmoeglich'
    $meldung = 'Windows konnte die Signatur nicht pruefen.'
    switch ($signatur.Status.ToString()) {
        'Valid' { $status = 'gueltig'; $meldung = 'Signatur gueltig.' }
        'NotSigned' { $status = 'nicht-signiert'; $meldung = 'Nicht signiert.' }
        'HashMismatch' { $status = 'ungueltig'; $meldung = 'Signatur ungueltig: Die Datei wurde nach dem Signieren veraendert.' }
        'NotTrusted' { $status = 'vertrauen-offen'; $meldung = 'Zertifikatsvertrauen nicht bestaetigt. Windows vertraut der Zertifikatskette nicht.' }
        'NotSupportedFileFormat' { $meldung = 'Pruefung nicht moeglich: Windows unterstuetzt die VBS-Signatur auf diesem System nicht.' }
        'Incompatible' { $status = 'ungueltig'; $meldung = 'Signatur ungueltig: Signatur und Datei sind nicht kompatibel.' }
        default { $meldung = 'Pruefung nicht moeglich: Windows hat kein eindeutiges Pruefergebnis geliefert.' }
    }
    $daten = @{ status = $status; meldung = $meldung; zeitstempel = ($null -ne $signatur.TimeStamperCertificate) }
    if ($null -ne $signatur.SignerCertificate) {
        $daten.fingerabdruck = $signatur.SignerCertificate.Thumbprint
        $daten.herausgeber = $signatur.SignerCertificate.Subject
    }
    return $daten
}

try {
    if ($Operation -eq 'Auflisten') {
        $liste = @()
        $bekannt = @{}
        foreach ($eintrag in @(Zertifikate-Lesen)) {
            $zertifikat = $eintrag.zertifikat
            if (-not $bekannt.ContainsKey($zertifikat.Thumbprint)) {
                $bekannt[$zertifikat.Thumbprint] = $true
                $liste += @{
                    fingerabdruck = $zertifikat.Thumbprint
                    betreff = $zertifikat.Subject
                    aussteller = $zertifikat.Issuer
                    gueltigVon = $zertifikat.NotBefore.ToUniversalTime().ToString('o')
                    gueltigBis = $zertifikat.NotAfter.ToUniversalTime().ToString('o')
                    speicher = $eintrag.speicher
                }
            }
        }
        Ergebnis-Ausgeben @($liste | Sort-Object { $_.fingerabdruck })
        exit 0
    }

    $pfad = Datei-Pruefen
    if ($Operation -eq 'Pruefen') {
        Ergebnis-Ausgeben (Signatur-Lesen $pfad)
        exit 0
    }

    if ($Fingerabdruck -cnotmatch '^[A-Fa-f0-9]{40}$') { Vorgang-Abbrechen 'Der Zertifikat-Fingerabdruck ist ungueltig.' }
    $passende = @(Zertifikate-Lesen | Where-Object { $_.zertifikat.Thumbprint -ieq $Fingerabdruck })
    if ($passende.Count -eq 0) { Vorgang-Abbrechen 'Das gewaehlte Zertifikat ist nicht verfuegbar, abgelaufen oder besitzt keinen privaten Code-Signing-Schluessel.' }

    $parameter = @{
        LiteralPath = $pfad
        Certificate = $passende[0].zertifikat
        HashAlgorithm = 'SHA256'
        IncludeChain = 'NotRoot'
        ErrorAction = 'Stop'
    }
    if (-not [string]::IsNullOrWhiteSpace($ZeitstempelUrl)) {
        $uri = $null
        if (-not [Uri]::TryCreate($ZeitstempelUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'http' -or -not [string]::IsNullOrEmpty($uri.UserInfo) -or -not [string]::IsNullOrEmpty($uri.Query) -or -not [string]::IsNullOrEmpty($uri.Fragment)) {
            Vorgang-Abbrechen 'Dieser Windows-Signaturweg benoetigt eine HTTP-Zeitstempeladresse ohne Zugangsdaten oder URL-Parameter. HTTPS wird von der Windows-API nicht unterstuetzt.'
        }
        $parameter.TimestampServer = $uri.AbsoluteUri
    }

    $gesetzteSignatur = Set-AuthenticodeSignature @parameter
    $ergebnis = Signatur-Lesen $pfad
    if (-not [string]::IsNullOrWhiteSpace($ZeitstempelUrl) -and -not $ergebnis.zeitstempel) {
        Vorgang-Abbrechen 'Der gewuenschte Zeitstempel fehlt. Die Datei darf nicht als vollstaendig signierter Export bestaetigt werden.'
    }
    if (-not $ergebnis.ContainsKey('fingerabdruck') -or $ergebnis.fingerabdruck -ine $Fingerabdruck) {
        Vorgang-Abbrechen 'Die fertige Datei enthaelt nicht die erwartete Signatur.'
    }
    Ergebnis-Ausgeben $ergebnis
    exit 0
} catch {
    # Keine Schluessel, Kennwoerter, kompletten Befehle oder ungefilterten Toolausgaben protokollieren.
    $meldung = 'Die Windows-Signaturpruefung konnte nicht abgeschlossen werden. Bitte pruefe die Windows-Werkzeuge und Richtlinien.'
    if ($Operation -eq 'Auflisten') { $meldung = 'Der Windows-Zertifikatspeicher konnte nicht gelesen werden. Bitte pruefe die Zugriffsrechte und Windows-Richtlinien.' }
    if ($Operation -eq 'Signieren') { $meldung = 'Windows konnte die Datei nicht signieren. Bitte pruefe das Zertifikat und den Zugriff auf dessen privaten Schluessel.' }
    if ($Operation -eq 'Signieren' -and -not [string]::IsNullOrWhiteSpace($ZeitstempelUrl)) { $meldung = 'Die Signatur mit dem gewuenschten Zeitstempel ist fehlgeschlagen. Bitte pruefe Zertifikat, Schluesselzugriff und Zeitstempeldienst.' }
    if ($_.Exception.Data.Contains('ScriptLabMeldung')) { $meldung = $_.Exception.Message }
    [Console]::WriteLine((@{ ok = $false; fehler = $meldung } | ConvertTo-Json -Compress))
    exit 1
}
