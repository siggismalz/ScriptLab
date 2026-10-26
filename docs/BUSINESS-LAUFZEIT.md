# Optionale Business-Laufzeit unter Windows

Die Business-Funktionen verwenden einen festen Python-Paketsatz in einer eigenen virtuellen Umgebung. Bearbeiten, Öffnen, Validieren und gewöhnliche Workflowtests installieren niemals Pakete. Eine Einrichtung beginnt ausschließlich nach bewusster Auswahl in ScriptLab. Vorhandene Python-Installationen, andere virtuelle Umgebungen und Windows-Einstellungen bleiben erhalten.

## Voraussetzungen und fester Paketsatz

Unterstützt wird reguläres stabiles CPython 3.12 bis 3.15 für Windows x64. Free-Threaded-, ARM64-, 32-Bit-, PyPy- und Vorabversionen gehören nicht zu diesem Wheelprofil. Der geprüfte Basisinterpreter muss die Standardmodule `venv` und `ensurepip` besitzen. Die portable Python-Embeddable-Distribution allein genügt dafür nicht. ScriptLab installiert keine Python-Grundinstallation und startet keinen Python-Launcher oder Installationsmanager.

Prüfstand der offiziellen PyPI-Versionsmetadaten: 26. Oktober 2026. `requirements-business.in` benennt die fachliche Auswahl; `requirements-business.lock` legt **alle elf** Paketversionen und freigegebenen SHA-256-Wheelhashes fest.

| Paket              | Version | Aufgabe / Herkunft                                                                     |
| ------------------ | ------- | -------------------------------------------------------------------------------------- |
| DuckDB             | 2.0.0   | [Lokale Datentabellen](https://duckdb.org/docs/stable/clients/python/overview)         |
| openpyxl           | 3.1.5   | [XLSX lesen und schreiben](https://openpyxl.readthedocs.io/en/stable/)                 |
| python-docx        | 1.2.0   | [DOCX erzeugen und bearbeiten](https://python-docx.readthedocs.io/en/latest/)          |
| ReportLab          | 5.1.0   | [PDF-Berichte](https://www.reportlab.com/)                                             |
| pypdf              | 6.21.2  | [PDF lesen und bearbeiten](https://pypdf.readthedocs.io/en/latest/)                    |
| et-xmlfile         | 2.0.0   | [Abhängigkeit von openpyxl](https://pypi.org/project/et-xmlfile/2.0.0/)                |
| lxml               | 6.1.3   | [Abhängigkeit von python-docx](https://pypi.org/project/lxml/6.1.3/)                   |
| typing-extensions  | 4.16.0  | [Abhängigkeit von python-docx](https://pypi.org/project/typing-extensions/4.16.0/)     |
| Pillow             | 13.0.0  | [Abhängigkeit von ReportLab](https://pypi.org/project/pillow/13.0.0/)                  |
| charset-normalizer | 3.5.2   | [Abhängigkeit von ReportLab](https://pypi.org/project/charset-normalizer/3.5.2/)       |
| defusedxml         | 0.7.1   | [Von openpyxl empfohlener zusätzlicher XML-Schutz](https://pypi.org/project/openpyxl/) |

DuckDB liefert ein `cp312-abi3-win_amd64`-Wheel. Für lxml und Pillow liegen eigene reguläre `cp312`, `cp313`, `cp314` und `cp315`-Windows-x64-Wheels vor; die übrigen Pakete besitzen passende universelle Wheels. Alle vier Profile wurden anhand der tatsächlichen PyPI-Dateien und heruntergeladenen Wheelhashes geprüft. Das belegt deren Verfügbarkeit, keine praktische Importprüfung jeder Python-Version.

Es werden keine optionalen Extras installiert: insbesondere keine DuckDB-Erweiterungen, Pandas/Arrow, PDF-Kryptografie-, OCR-, RTL-/Shaping- oder Office-Pakete. Ein solcher Funktionsumfang wird durch diesen Paketsatz nicht zugesagt. Schriften werden weder aus dem Internet geladen noch als Windows-Komponente installiert. Eigene Daten, Vorlagen, Zugangsdaten und Geheimnisse gehören nicht zum Laufzeitpaket.

Die vollständige Beilage [business-notices.md](../laufzeit/business-notices.md) enthält die Paketlizenzen und die originalen Rechtehinweise der tatsächlich geprüften Wheels einschließlich ihrer eingebetteten Bibliotheken. Sie legt keine Projektlizenz für ScriptLab fest.

## Prüfen und bewusst einrichten

`businessStatusPruefen` liest die feste Lockdatei, bestätigt den konkreten absoluten Interpreter und startet einen festen Import-/Versionstest. Dieser prüft alle benötigten Module und Paketversionen. Dabei werden keine Nutzeraktionen ausgeführt und keine Pakete installiert. Zusätzliche Python-Bytecodedateien werden in dieser Importprobe unterdrückt. Eine Versionsanzeige ersetzt keinen Sicherheitsnachweis beliebiger vorhandener Dateien oder Python-Installationen.

`businessEinrichten` prüft den Basisinterpreter erneut und erstellt ausschließlich einen neuen Unterordner `business-<UUID>` unter dem vom Hauptprozess festgelegten Laufzeitverzeichnis. Ein bisher gewählter Interpreter oder eine vorhandene Umgebung wird nicht überschrieben. Die Anwendung erhält die neue Interpreterauswahl erst nach erfolgreicher Einrichtung, bestätigten Imports und atomar geschriebener Abschlussmarkierung. Ein Fehler oder Abbruch liefert keinen erfolgreichen neuen Laufzeitstand.

Für die Versorgung gibt es genau zwei Wege:

- **Feste Paketquelle:** ScriptLab liest ausschließlich die genauen gepinnten PyPI-Versionen und lädt nur freigegebene Wheels von `files.pythonhosted.org`. Dateiname, Pythonprofil, Dateigröße und SHA-256 werden geprüft. Es gibt keine freie Paketsuche oder Eingabe von Paketbefehlen.
- **IT-Wheelhouse:** Der Nutzer wählt einen bereits versorgten lokalen Ordner oder eine ausdrücklich gewählte Freigabe. Nur passende, hashbestätigte Wheels werden in einen privaten technischen Ordner kopiert. Fremde oder zusätzliche Wheelhouse-Inhalte werden nicht an pip weitergereicht.

Die tatsächliche Installation verwendet in beiden Fällen ausschließlich den privaten Wheelordner:

```text
python.exe -I -m pip --isolated install --no-index --require-hashes --only-binary=:all: --no-deps --no-cache-dir --no-compile --disable-pip-version-check --find-links <privates-Wheelhouse> --requirement <feste-Lockdatei>
```

Dieser Befehl ist fest im Programm implementiert. Er wird nicht aus einem Workflow, einem Projektfeld oder freien Nutzereingaben zusammengesetzt. Die vollständigen transitiven Abhängigkeiten sind bereits gepinnt; Sourcebuilds, Extras und weitere Paketauflösungen sind gesperrt. Die virtuelle Umgebung erhält pip ausschließlich aus dem `ensurepip` der geprüften Python-Grundinstallation.

## Abbruch, Fristen und Offlinebetrieb

Die feste Importprobe hat zehn Sekunden, der gebundene Einrichtungsvorgang 150 Sekunden und der darin aufgerufene pip-Prozess 120 Sekunden Zeit. Für die gesamte Einrichtung einschließlich Downloads gilt eine zusätzliche Frist von fünf Minuten. Der bestehende Windows-Jobhelper bindet sämtliche erzeugten Prozesse. Stopp, EOF oder ein unerwartetes Ende der Anwendung beenden den Job; Erfolg wird erst nach bestätigtem Prozess- und Streamende gemeldet.

Wheelhouse-Verzeichnisabfragen, Dateimetadaten, Hashlesen und Kopien haben jeweils eine eigene Zehn-Sekunden-Frist und berücksichtigen das Abbruchsignal. Eine Wheeldatei darf höchstens 100 MiB groß sein; die Größe wird vor dem Hashlesen und während des Streamens begrenzt. Unter Windows kann eine bereits im Betriebssystem blockierte Netzlaufwerks-I/O erst später physisch zurückkehren. Die öffentliche Operation wartet darauf nicht unbegrenzt, führt danach keine Installation aus und verwendet nur den eigenen privaten Kopierordner. Ein Wheelhouse auf einer Freigabe benötigt weiterhin diese Freigabe; „offline“ bedeutet hier ohne PyPI oder Internetversorgung.

Fehlgeschlagene oder abgebrochene neue Umgebungen und technische Kopien werden nach dem Jobende innerhalb der geprüften eigenen Verzeichnisse bereinigt. Misslingt eine Bereinigung wegen eines gesperrten Datenträgers, bleibt die Umgebung unvollständig und wird nicht als bereit ausgewählt. Alte Umgebungen und Nutzerdateien werden nicht gelöscht.

## Entwicklungs- und IT-Versorgung

Der folgende explizite Entwicklungsaufruf lädt ausschließlich den festen Satz in den ignorierten Bereich `artifacts/business-runtime/wheelhouse`. Er installiert nichts und startet keinen Interpreter:

```powershell
node scripts/business-laufzeit-pruefen.mjs --download --alle-profile
node scripts/business-laufzeit-pruefen.mjs --alle-profile
```

Ohne `--download` findet keine Netzabfrage statt. Ein einzelnes Profil kann mit `--profil=3.12`, `3.13`, `3.14` oder `3.15` gewählt werden. Der Prüfbericht nennt die konkreten Dateinamen, Größen, SHA-256 und Profilabdeckung. Das Wheelhouse lässt sich anschließend durch die IT bereitstellen; die Lockdatei muss zur Anwendungsversion passen.

Normale Tests bleiben ohne Einrichtung. Die gesondert freigegebene Integrationsprüfung verwendet nur eigene temporäre Verzeichnisse:

```powershell
$env:SCRIPTLAB_RUNTIME_TESTS='1'
$env:SCRIPTLAB_BUSINESS_PYTHON='<vorhandener geprüfter Business-Interpreter>'
$env:SCRIPTLAB_BUSINESS_SETUP_TESTS='1'
$env:SCRIPTLAB_BUSINESS_WHEELHOUSE='<vorbereitetes festes Wheelhouse>'
npx vitest run tests/business-laufzeit.test.ts --maxWorkers=1
```

Diese Werte sind reine Testharness-Konfiguration. Sie erweitern weder die Produktions-Interpretererkennung noch die freigegebene Renderer-Schnittstelle. Die echten Einrichtungstests laufen nur mit dem separaten Einrichtungs-Opt-in; ein ausgelassener Test gilt nicht als bestandene Einrichtung.

Praktisch bestätigt wurden eine eigene CPython-3.12.6-Umgebung mit allen elf Imports, feste Onlineversorgung, erneute Offline-Einrichtung, Ablehnung falscher Wheelhashes vor Installation, Erhaltung bestehender Daten und Abbruch nach tatsächlich begonnener venv-Erzeugung. Die übrigen CPython-Profile sind hier durch Wheels/Hashes abgedeckt und noch nicht als vollständige Business-Installation praktisch bestätigt.
