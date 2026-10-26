# Optionale Signaturen fuer VBS-Exporte

ScriptLab exportiert auch ohne Zertifikat vollstaendig offline. Die Signatur ist eine getrennte, optionale Windows-Funktion. Eine Signatur hilft, Herausgeber und spaetere Aenderungen zu pruefen. Sie garantiert weder einen ungefaehrlichen Workflow noch eine Ausfuehrung ohne Windows-, SmartScreen- oder Unternehmenswarnungen.

## Voraussetzungen und Auswahl

- Windows 11 x64 mit Windows PowerShell 5.1, Authenticode/SIP-Unterstuetzung fuer `.vbs` und einer Richtlinie, die den fest installierten Signaturhelper zulaesst.
- Eigenes oder ausdruecklich bereitgestelltes Code-Signing-Zertifikat mit EKU `1.3.6.1.5.5.7.3.3`, gueltigem Zeitraum und verfuegbarem privaten Schluessel im persoenlichen Speicher `CurrentUser\My` oder `LocalMachine\My`.
- Zugriff auf den privaten Schluessel; ein Geraet oder Unternehmensanbieter kann eine weitere Freigabe verlangen. ScriptLab fragt keine PFX-Kennwoerter ab und importiert keine Schluessel.

Im Projekteinstellungsbereich „Exportierte Datei signieren“ waehlen und die Zertifikate laden. Die Zuordnung erfolgt ueber den vollstaendigen SHA-1-Fingerabdruck als Identifikator. Der Fingerabdruck legt **nicht** das Signaturverfahren fest: signiert wird ausdruecklich mit **SHA-256**. Die angezeigte Zertifikatsidentitaet stammt aus dem Zertifikat.

Der Hauptprozess schreibt den fertigen UTF-16LE-Export mit BOM und CRLF. Der unveraenderliche Helper wird mit `powershell.exe -NoProfile -NonInteractive -File` und festen Operationen aufgerufen. Er verwendet `Set-AuthenticodeSignature -LiteralPath ... -HashAlgorithm SHA256 -IncludeChain NotRoot` und prueft die fertige Datei anschliessend mit `Get-AuthenticodeSignature`. Inhalte werden dabei nicht ausgefuehrt. Der Renderer kann weder freie Befehle noch einen beliebigen Dateipfad an den Signaturdienst schicken. Der Hauptprozess verwendet seinen eigenen Exportpfad.

Nach dem Signieren darf die Datei weder neu kodiert noch anderweitig veraendert werden. Auch ein nachtraegliches Aendern eines Kommentars macht die Signatur ungueltig.

## Optionale Zeitstempel

Die Windows-API hinter `Set-AuthenticodeSignature` unterstuetzt fuer diesen Weg ausschliesslich klassische **HTTP-Authenticode-Zeitstempel**. HTTPS oder RFC-3161-only-Endpunkte sind fuer diesen Helper nicht geeignet. Microsoft beschreibt ausdruecklich, dass ein HTTPS-Versuch sogar eine Datei ohne den gewuenschten Zeitstempel hinterlassen kann. Deshalb lehnt ScriptLab HTTPS vorab ab und prueft nach dem Signieren, ob der gewuenschte Zeitstempel tatsaechlich vorhanden ist.

Nur eine vollstaendige `http://`-Adresse ohne Zugangsdaten, Queryparameter oder Fragment ist erlaubt. Einen zum Zertifikatsanbieter passenden Authenticode-Dienst bewusst auswaehlen; es ist keiner vorbelegt. Zeitstempel sind selbst kryptografisch signiert, der Transport dieses Windows-Verfahrens ist unverschluesselt. Ohne Zeitstempel findet kein Zeitstempel-Netzwerkzugriff statt. Windows kann bei der Vertrauenspruefung abhaengig von der Systemkonfiguration Zertifikats- oder Sperrinformationen abrufen.

Ein fehlender angeforderter Zeitstempel ist ein Fehler. Die Anwendung darf ihn nicht als vollstaendig erfolgreichen signierten Export anzeigen.

## Angezeigte Ergebnisse

| Ergebnis | Bedeutung |
| --- | --- |
| Nicht signiert | Windows hat keine digitale Signatur gefunden. |
| Signatur gueltig | Windows bestaetigt die Signatur und die gepruefte Zertifikatskette. |
| Signatur ungueltig | Beispielsweise stimmt der signierte Dateihash nach einer Aenderung nicht mehr. |
| Zertifikatsvertrauen nicht bestaetigt | Eine Signatur ist vorhanden; die Vertrauenspruefung der Kette war nicht erfolgreich oder nicht vollstaendig moeglich. Dies ist keine gueltige Signaturbestaetigung. |
| Pruefung nicht moeglich | Beispielsweise fehlen Windows-Werkzeuge, die VBS-SIP-Unterstuetzung oder eine Richtlinie blockiert den Helper. |

Wenn kein geeignetes Zertifikat vorhanden ist, die Signaturoption ausschalten und normal exportieren. ScriptLab installiert keine selbstsignierten Stammzertifikate, aktiviert keine Windows-Features und aendert keine Ausfuehrungsrichtlinien.

## Praktischer Pruefstand

Am 26.10.2026 auf Windows 11 Pro x64, Build 26200, Windows PowerShell 5.1.26100.9444 geprueft:

- Die Windows-SIP-Zuordnung wurde fuer eine isolierte `.vbs`-Datei direkt ueber `CryptSIPRetrieveSubjectGuid` erkannt: `1629f04e-2799-4db5-8fe5-ace10f17ebab`, Rueckgabewert erfolgreich, Win32-Fehler 0. Damit wurde die VBS-Unterstuetzung am tatsaechlichen Dateityp untersucht.
- Der Helper pruefte eine isolierte UTF-16LE-BOM-VBS-Datei als „Nicht signiert“. Der SHA-256-Dateihash vor und nach der Pruefung war gleich. Der Inhalt wurde nicht gestartet.
- Zertifikatsauflistung, ungueltiger Fingerabdruck und fehlendes geeignetes Zertifikat wurden geprueft, ohne vorhandene Schluessel zu benutzen.
- Die automatisierten Tests pruefen auch falsche Dateitypen, relative Helperpfade und unzulaessige Zeitstempeladressen.

Ein geeignetes, gueltiges Nutzerzertifikat wurde nicht bereitgestellt. Deshalb stehen eine tatsaechliche SHA-256-VBS-Signatur, ein passender Zeitstempel und der Manipulationstest einer zuvor erfolgreich signierten VBS-Datei praktisch noch aus. Die erkannte SIP-Zuordnung ersetzt diesen Ende-zu-Ende-Nachweis nicht.

Mit einem bereitgestellten Testzertifikat sind diese Schritte ohne Scriptstart nachzuholen: Export signieren, Windows-Ergebnis und Fingerabdruck vergleichen, unveraenderte Datei erneut pruefen, ausschliesslich eine Kopie gezielt veraendern und deren „Signatur ungueltig“ pruefen. Anschliessend Zeitstempel mit geeignetem Dienst, absichtlich unerreichbarem Dienst und fehlender Vertrauenskette vergleichen. Keine Zertifikate automatisch als vertrauenswuerdig installieren.

## Anwendungssignatur und Geheimnisse

Die Signatur des ScriptLab-Installers gehoert zur Entwickler-Releaseinfrastruktur. Sie ist von der Signatur eines Nutzerworkflows getrennt. Ein privater Entwicklerschluessel wird niemals mit der Anwendung ausgeliefert. Private Schluessel, Kennwoerter und Tokens gehoeren nicht in `.scriptlab`-Dateien, Git oder Logs.

## Offizielle Quellen

- [Set-AuthenticodeSignature, Windows PowerShell 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-authenticodesignature?view=powershell-5.1)
- [Set-AuthenticodeSignature: bekannte HTTPS-Grenze der Windows-API](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-authenticodesignature?view=powershell-7.5#-timestampserver)
- [Get-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature?view=powershell-5.1)
- [CryptSIPRetrieveSubjectGuid](https://learn.microsoft.com/en-us/windows/win32/api/mssip/nf-mssip-cryptsipretrievesubjectguid)
- [SmartScreen und Grenzen einer Signatur](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
