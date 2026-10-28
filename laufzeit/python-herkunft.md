# Mitgelieferte Python-Laufzeit

ScriptLab enthält reguläres CPython 3.15.2 für Windows x64 einschließlich Standardbibliothek, Tcl/Tk und aller elf Pakete aus `requirements-business.lock`. Die Anwendung sucht keine Benutzerinstallation und installiert beim Workflowstart keine Pakete. Exportierte Scripts verwenden eine eigenständige, am Ziel vorbereitete Laufzeit.

## Originalquellen

Der Build verwendet den [offiziellen Python-3.15.2-Installer](https://www.python.org/ftp/python/3.15.2/python-3.15.2-amd64.exe) und seine regulären, von der Python Software Foundation signierten MSI-Dateipayloads aus dem [offiziellen amd64-Verzeichnis](https://www.python.org/ftp/python/3.15.2/amd64/). Die [Release-Seite](https://www.python.org/downloads/release/python-3152/) nennt den SHA-256-Wert des Installers. Es wird weder eine vorhandene virtuelle Umgebung noch eine Embedded-Distribution übernommen.

| Quelldatei | SHA-256 |
| --- | --- |
| python-3.15.2-amd64.exe | 06e225a228191b0f4d1dcf6905fbb21bf9f6970d13a2ec63137ab9bee76f15aa |
| core.msi | 1ab04330cedbf1e12e9a11a3afb21679e808d02bffe49dff5483dfaa7641b1ef |
| exe.msi | 3d8b229039e276aadc880e52c4aea3ab3b9af4934e34d6be08c9cf78919c9e55 |
| lib.msi | cf9dd1af2ad9d3f8c9f0ce76c56c6def378f6ab1b79f964dd54e0ea958403c08 |
| tcltk.msi | a398763af9d67cb6b0bef4326c5538de4363b8560413d0cc5604344d487bcc62 |
| ucrt.msi | 7abe902a0458d01b8fbcfb10ebb634398a85e3acb0ad6ec5ed6db6785af76e12 |

Am 28. Oktober 2026 wurden diese unveränderten Dateien unter Windows mit gültiger Authenticode-Signatur der Python Software Foundation bestätigt. Der Build verlangt sowohl die festgehaltene SHA-256-Prüfsumme als auch eine gültige PSF-Signatur; eine abweichende Datei wird nicht ausgeführt oder entpackt.

## Vorbereitung und Paketierung

`node scripts/python-buendel.mjs --vorbereiten` liest die MSI-Datenbanken ausschließlich im Nur-Lesen-Modus und entpackt ihre eingebetteten Cabinets mit dem Windows-Werkzeug `expand.exe` in einen privaten Buildordner. Keine MSI-Installationssequenz oder Registrierung einer Python-Installation wird ausgeführt. Anschließend werden die festen Wheels mit ihren Lock-Prüfsummen vorbereitet und ohne Netzwerkzugriff in diesen Laufzeitbaum installiert. Netzwerkzugriff betrifft ausschließlich die Vorbereitung fehlender Originalquellen auf dem Buildrechner.

Das fertige, verschiebbare Bündel liegt unter `artifacts/python-buendel/python` und im Anwendungspaket unter `resources/python`, außerhalb von `app.asar`. `scriptlab-laufzeit.json` dokumentiert Quellen, Herstellersignaturen, Wheel- und Lock-Prüfsummen, die tatsächliche Tk-Probe sowie die vollständige Dateiliste mit Einzelprüfsummen. `--pruefen` vergleicht ausschließlich den vorhandenen lokalen Stand. Der normale Build verwendet dieselbe Vorbereitung und prüft einen unveränderten vorhandenen Stand erneut.

## Originale Lizenzbeilagen

Die Originaldateien der Distribution und der installierten Wheels bleiben Bestandteil des Bündels: insbesondere die Python-Lizenz, Tcl/Tk-Lizenzdateien sowie die `LICENSE`-/`COPYING`-/`NOTICE`-Beilagen der Paketverzeichnisse und ihrer `.dist-info`-Ordner. `LIZENZEN-BUSINESS.md` enthält zusätzlich die im Repository gepflegten vollständigen Business-Lizenztexte. Die mit Python gelieferten nativen Bibliotheken und ihre Originalbeilagen werden unverändert weitergegeben. Diese Dokumentation ersetzt keine Originaltexte und erklärt keine bisher offenen Lizenznachweise anderer Projektbestandteile für erledigt.
