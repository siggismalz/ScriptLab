# Windows-Builds, Releases und Updates

Entwickelt von Leon Stolz. Erstes Ziel ist Windows 11 x64. Andere Windows-Versionen oder Architekturen sind fuer diese Version nicht freigegeben.

## Lokaler Installer

Node.js 24, Git und Windows 11 x64 verwenden:

```powershell
npm ci
npm run check
npm test
npm run build
npm run test:e2e
npm run package
npm run verify:package
```

`electron-builder` 26.18.0 erzeugt einen NSIS-Installer in `release/`. Der Name lautet `ScriptLab-0.1.0-Setup-x64.exe` fuer die Paketversion 0.1.0. Das reproduzierbare Abhaengigkeitsverzeichnis stammt aus `package-lock.json`. `npm run package:dir` baut das entpackte Programmpaket zum Pruefen.

`verify:package` vergleicht die vollständige Installergröße und SHA-512 mit den Updatemetadaten des tatsächlichen Versionskanals und prüft die Blockmap-Struktur. Renderer, Hauptprozess, Preload, Beispiele und Beilagen müssen bytegleich zum vorhandenen Build beziehungsweise Quellstand sein. Windows-Dateimetadaten und Authenticode werden ausschließlich lesend abgefragt. Der Bericht in `release/pruefung.json` nennt Git-Stand, offene Prüfungen und Grenzen. Er entpackt den NSIS-Payload nicht und ersetzt keine praktische Installation oder produktive Updateprüfung.

Ein lokaler Build ohne eingerichtetes Entwicklerzertifikat ist **unsigniert**. Er ist ein Testartefakt und kann Windows-Warnungen ausloesen. Die Anwendung laesst fuer einen solchen Build keine Updates zu, wenn der verifizierbare Herausgeber in `resources/app-update.yml` fehlt. Eine fehlende Signaturpruefung wird niemals durch Abschalten einer Sicherheitsoption umgangen.

Der Installer arbeitet pro Nutzer, fordert keine Administratorrechte und loescht Einstellungen nicht bei der Deinstallation. Projektdateien liegen an den vom Nutzer gewaehlten Orten. Einstellungen liegen im Electron-Nutzerverzeichnis, getrennt vom Installationsverzeichnis. Ein Update installiert nur die Anwendung.

## GitHub und automatisierte Pruefungen

Das genehmigte oeffentliche Repository und die feste Releasequelle sind [siggismalz/ScriptLab](https://github.com/siggismalz/ScriptLab).

`windows-pruefung.yml` laeuft bei Push auf `main` und bei Pull Requests auf einem Windows-Runner. Sie installiert mit `npm ci`, prueft TypeScript, Tests, Produktionsbuild und Electron-Oberflaechentests und erstellt einen nicht veroeffentlichten Testinstaller. Anschließend prüft `verify:package` dessen Metadaten und Paketinhalt. Installer, Updatemetadaten und Prüfbericht werden als Actions-Artefakt bereitgestellt. Gewoehnliche Commits erzeugen kein Release.

`release.yml` wird bewusst durch einen Tag wie `v0.1.0` oder manuell fuer einen bereits vorhandenen Versionstag gestartet. Paketversion und Tag muessen uebereinstimmen. Eine manuelle Ausloesung baut ebenfalls den angegebenen Tag und kein beliebiges aktuelles `main`.

## Erforderliche Entwickler-Signaturinfrastruktur

In den GitHub-Einstellungen muessen vor dem ersten produktiven Release eingerichtet werden:

| Name                       | Ort              | Inhalt                                                                                                                                                                                  |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WINDOWS_CSC_LINK`         | Actions Secret   | Fuer den Runner zugaengliches Code-Signing-Zertifikat, beispielsweise als von electron-builder unterstuetzter Base64-PFX-Inhalt. Kein Repositorypfad zu einem eingecheckten Schluessel. |
| `WINDOWS_CSC_KEY_PASSWORD` | Actions Secret   | Kennwort des Zertifikats.                                                                                                                                                               |
| `WINDOWS_PUBLISHER_NAME`   | Actions Variable | Exakter Common Name des tatsaechlich verwendeten Zertifikats. Keinen frei gewaehlten Herausgeber vortaeuschen.                                                                          |

`GITHUB_TOKEN` wird ausschliesslich im Releasejob mit `contents: write` verwendet. Der Token wird weder in das Anwendungspaket noch in Projektdateien geschrieben. Fuer hardwaregebundene EV-Schluessel oder Azure Artifact/Trusted Signing muss der Signierjob passend zur realen Infrastruktur konfiguriert werden; es ist hierfuer kein funktionsloser Ersatz eingebaut.

Ohne diese Angaben bricht der Releasejob **vor** der Veroeffentlichung ab. Produktive Builds verwenden `forceCodeSigning=true` und SHA-256. Anschliessend prueft der Job die Windows-Installersignatur, die tatsaechliche Zertifikatsidentitaet, Blockmap, Kanalmetadaten und den hinterlegten Updater-Herausgeber. Erst danach werden deutsche Release Notes aus den deutschen Commits und das GitHub Release erzeugt.

Zusaetzlich verlangt der produktive Job `node scripts/lizenzhinweise.mjs --check --strict`. Der fehlende vollstaendige Originaltext von `lazy-val@1.0.5` ist aktuell eine offene Freigabegrenze. Es wird kein Lizenztext oder Rechteinhaber erfunden, um diese Pruefung zu bestehen. Lokale Testinstaller bleiben baubar.

Releaseartefakte fuer stabile Releases:

- NSIS-Installer `ScriptLab-<Version>-Setup-x64.exe`
- Zugehoerige `.exe.blockmap` fuer differenzielle Downloads
- `latest.yml` mit Version, Dateigroesse und SHA-512-Integritaetswert

Bei bewusst bezeichneten Vorabversionen entstehen die entsprechenden Kanalmetadaten wie `beta.yml`; das Release wird als Vorabversion gekennzeichnet. Version, Tag und Release bleiben konsistent. Installer werden nicht als normale Quellcodedateien committed.

## Updateverhalten in der Anwendung

- „Nach Updates suchen“ prueft die feste oeffentliche GitHub-Quelle. Automatische Pruefung ist abschaltbar.
- Installierte und verfuegbare Version, Aenderungsuebersicht, Fortschritt und Fehler werden angezeigt. Release Notes werden als Text dargestellt.
- `autoDownload=false` und `autoInstallOnAppQuit=false` werden ausdruecklich gesetzt. In electron-updater 6.8.11 waeren beide standardmaessig `true`.
- Ein Download beginnt erst nach Nutzerentscheidung. SHA-512-Integritaetspruefung und Windows-Authenticode-Herausgeberpruefung bleiben aktiv. Webinstaller sind deaktiviert.
- Vor Netzwerkzugriffen muss die installierte `app-update.yml` die feste Quelle `siggismalz/ScriptLab`, einen nichtleeren `publisherName` und keine private Quelle oder eingebetteten Token enthalten. Ohne diese Angaben gibt es den Zustand „Updates nicht eingerichtet“.
- Installation und Neustart beginnen ausschliesslich nach Bestaetigung. Der Hauptprozess schuetzt vorher ungespeicherte Projektveraenderungen. Ein normales Beenden installiert kein Update.
- Stabile Releases sind der Standard. Vorabversionen werden nur nach bewusster Auswahl beruecksichtigt; automatische Downgrades bleiben gesperrt.

Es ist kein Entwicklertoken fuer private Releasequellen eingebaut. Eine spaetere Umstellung auf ein privates Quellrepository und ein getrenntes oeffentliches Release-Repository waere eine eigene, vorher abzustimmende Entscheidung.

## Noch praktisch nachzuweisen

Die lokal getestete Logik deckt sichere Defaults, fehlende/falsche Konfiguration, Updatefehler, Fortschritt und den ausdruecklichen Installationsaufruf mit einem gemockten Updater ab. Das ist kein Nachweis einer produktiven Updatekette.

Der produktive Buildschutz wurde zusaetzlich am echten Windows-Builder in einem getrennten Ausgabeordner geprueft: `forceCodeSigning=true` und absichtlich deaktivierte Zertifikatssuche fuehrten ohne Zertifikat zum erwarteten Abbruch mit Exitcode 1. Der unsignierte Testinstaller wurde dadurch nicht ueberschrieben; ein produktives Release wurde nicht erzeugt.

Vor Freigabe sind mit der realen Signaturinfrastruktur zwei installierbare Versionen zu veroeffentlichen und auf einem Test-Windows zu pruefen: Version A installieren, ein Projekt und Einstellungen speichern, ungespeicherte Aenderungen anlegen, Update B finden und herunterladen, Neustart erst bestaetigen, Abbruch beim Speicherdialog pruefen, danach B installieren. Projektdateien und Einstellungen muessen erhalten bleiben. Ein veraendertes oder mit fremdem Zertifikat signiertes Update muss abgewiesen werden. Netzfehler, fehlende Metadaten und Vorabversionsauswahl ebenfalls pruefen. Keine Pruefung durch Abschalten der Signaturvalidierung erleichtern.

## Passende offizielle Dokumentation

Die Standardseite von electron-builder zeigt derzeit die **unveroeffentlichte v27-Dokumentation**. Fuer die eingesetzte stabile v26 gelten:

- [electron-builder v26](https://www.electron.build/v26/)
- [Updates mit electron-updater und erforderliche Artefakte](https://www.electron.build/v26/docs/features/auto-update/)
- [Code-Signing](https://www.electron.build/v26/docs/features/code-signing/)
- [Konfiguration](https://www.electron.build/v26/docs/configuration/)

Zusatzpruefung anhand des installierten Quellcodes: `electron-updater/out/AppUpdater.d.ts` dokumentiert die beiden automatischen Defaults; `electron-updater/out/NsisUpdater.js` zeigt, dass ohne `publisherName` die Windows-Signaturpruefung uebersprungen wuerde. Genau deshalb sperrt ScriptLab solche Builds vorab.
