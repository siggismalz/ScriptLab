# Optionales CPU-ML-Profil

Stand: 30.10.2026, Ausgang `main/8496feb`; gemeinsam bearbeiteter Integrationsstand, noch kein eigener Commit dieses Fachagenten.

## Auftrag und Schreibgrenze

Ein vollständiges privates CPython-3.15.2-Profil für die vorhandene Windows-x64-Anwendung ergänzen. Online-/Offline-Einrichtung nur nach bewusster Aktion, feste CPU-Wheels, vollständiger Hash-Lock, Drittanbieterbeilagen, begrenzter Jobhost, Import-/Trainingsprüfung vor atomarer Aktivierung. Basis und vorheriges Profil bei Fehler/Abbruch erhalten. Keine globale Installation, freien Paketnamen/URLs, allgemeine Shell, Downloads beim Workflowstart oder Änderung des Basisbündels.

Verantwortlich: Fachagent Ausführung. Eigene Dateien: `src/{windows,gemeinsam}/ml-laufzeit.ts`, `scripts/ml-{lock,lizenzen,vorbereiten}.mjs`, `laufzeit/requirements-ml.{in,lock}`, `laufzeit/ml-profil.json`, `laufzeit/ml-notices.md`, `tests/ml-laufzeit.test.ts` und dieser Bericht. Root integriert IPC, Einstellungen, Export und Paketressourcen; Bedienungsagent prüft den Laufzeitschnitt unabhängig lesend; Businessagent verantwortet die vier ML-Operationen. Kein Git-Index, Commit, Push, Gesamtbuild oder Electronstart durch diesen Fachagenten.

## Vertrag und Aktivierung

- `mlStatusPruefen(optionen)` prüft ein vorhandenes Profil; richtet nichts ein. `mlInstallationErmitteln(optionen)` liefert ausschließlich eine bestätigte vorhandene Installation oder einen Fehler. Beide prüfen vollständige Dateihashes, Basis-/Profil-/Lockbindung, feste Paketversionen, Imports und CPU. Sie trainieren nicht.
- `mlEinrichten(optionen, offlineOrdner?)`: Ohne Offlineordner nur die fest hinterlegten HTTPS-Wheelquellen; mit Offlineordner ausschließlich die vollständige lokale Wheelmenge. Optionen: `basisWurzel`, `wurzel`, `helper`, `technischeOrdner`, `paketwurzel`; optional `signal` und `fortschritt`.
- Gemeinsame Typen: `MLStatus` mit `fehlt | prueft | bereit | fehler`, nullable Installation/Profilhash, Paketstatus und Fortschritt; `MLFortschritt` mit `basis | wheels | bootstrap | pakete | pruefung | abschluss`. Keine Renderer-URLs oder Paketmanagerargumente.
- Basis vor Kopie und Kopie vor Bootstrap mit vorhandenem Basismanifest prüfen. Eigener exklusiv erzeugter `profil-UUID`-Ordner bleibt von Beginn an am endgültigen Pfad: Pip-Konsolenstarter dürfen keinen später entfernten Stagingpfad enthalten.
- Nur dort `ensurepip` aus der vollständigen Basiskopie ausführen; danach offline `pip install --no-index --require-hashes --only-binary=:all: --no-deps --no-cache-dir --no-compile` und `pip check`. Pip/Bytecode vor Manifestbildung entfernen.
- Vor Aktivierung ausschließlich synthetische CPU-Probe: 40 Datenzeilen, RF mit festem Seed und erwarteten Klassen, skops-Rundreise des unmittelbar selbst erzeugten RF (nur notwendiger Tree-Typ zusätzlich freigegeben), kleines Torch-Netz mit sinkendem Verlust. Statusprüfungen führen diese Trainingsprobe nicht erneut aus.
- Vollständiges Dateimanifest enthält Basismanifest-Hash, Profil-/Lockhash und alle Dateigrößen/-hashes. `aktiv.json` wird erst danach atomar ersetzt. Abbruch/Fehler vor Zeigerwechsel entfernt ausschließlich den eigenen neuen Ordner; vorheriger Zeiger/Profil bleiben erhalten. Nach bestätigtem Zeigerwechsel kein nachträglich abbrechbarer Folgejob.
- Der vorhandene native Jobhost startet nur das feste technische Pythonprogramm. Abbruch sendet `STOP`, wartet auf tatsächliches Prozessende und besitzt eine begrenzte Notbremse für den eigenen Host. Kein offener Shellaufruf.

## Feste Pakete und Beilagen

21 tatsächlich heruntergeladene und gegen deklarierte Größe/SHA-256 geprüfte Wheels, insgesamt 199267144 Bytes. Torch stammt aus dem offiziellen CPU-Wheelindex, übrige Wheels aus PyPI-Dateiquellen. Das cp315-Windows-x64-Wheel ist tatsächlich vorhanden und wurde nativ importiert; es wird keine Kompatibilität allein aus einer Versionsnummer abgeleitet.

| Paket | Fester Pin |
| --- | --- |
| torch | 2.15.0+cpu |
| numpy | 2.5.4 |
| scipy | 1.18.1 |
| scikit-learn | 1.9.1 |
| skops | 0.16.0 |
| joblib / cloudpickle | 1.6.0 / 3.1.2 |
| narwhals / threadpoolctl | 2.28.0 / 3.7.0 |
| packaging / prettytable / wcwidth | 26.3 / 3.18.0 / 0.9.4 |
| filelock / setuptools | 4.2.5 / 84.2.1 |
| sympy / mpmath | 1.14.0 / 1.3.0 |
| networkx / jinja2 / markupsafe | 3.7 / 3.1.6 / 3.0.4 |
| fsspec / typing-extensions | 2026.9.0 / 4.16.0 |

`pip check` bestätigt die tatsächlich installierte transitive Menge. Insbesondere benötigt joblib 1.6.0 hier cloudpickle; mpmath 1.4.1 passt nicht zur festen Sympy-Abhängigkeit `<1.4`, deshalb 1.3.0. Die ursprünglichen elf Businesspakete bleiben Bestandteil der vollständigen Basiskopie; typing-extensions besitzt denselben Pin.

`ml-notices.md`: 21 Pakete, 135 aus den hashgeprüften Wheels übernommene Lizenz-/Notice-Dateien, 699123 Bytes. Das ist ein technischer Beilagennachweis, keine juristische Gesamtfreigabe. Root nimmt Profilmetadaten/Lock/Beilagen in die vorhandene Paketstruktur auf.

Lock-SHA-256: `4917e61c99fd248f93fc6a6e573ab7df3577ec46397f3b0469f78bf43c64c4cc`.

Profilhash: `375a785196802a633a975d23d8454439fabf75b9aca05d3d988a8f64b5b6d773`.

## Tatsächliche Prüfungen

Umgebung: Windows x64, Node 24.19, CPython 3.15.2 aus dem manifestgeprüften Basisbündel; direkte Pythonstarts mit `-I -B`. Synthetische Daten/UUID-Tempordner; keine Unternehmensdateien.

| Prüfung/Befehl | Ergebnis |
| --- | --- |
| `node scripts/ml-lock.mjs --herunterladen` | Bestanden: 21 feste Wheels, deklarierte Größen/Hashes geprüft; keine globale Installation |
| `node scripts/ml-lizenzen.mjs` | Bestanden: 135 Originaldateien aus 21 Wheels in der Beilage |
| `node scripts/ml-vorbereiten.mjs` | Bestanden: tatsächliche vollständige Offlineeinrichtung, `pip check`, RF-/skops-/Torch-CPU-Probe, atomare Aktivierung |
| `npx tsc --noEmit --pretty false` | Bestanden am finalen Laufzeit-/Teststand |
| `$env:SCRIPTLAB_ML_TESTS='1'; npx vitest run tests/ml-laufzeit.test.ts` | Bestanden: 14/14, 33,64 s, keine Skips |

Die 14 Fälle umfassen zehn reine Metadaten-/Vertragstests und vier echte Windowsfälle: aktives Profil inklusive sämtlicher Versionen/Imports und tatsächlich gültigem Torch-Konsolenstarterpfad; falsches Offlinewheel/früher Abbruch ohne Basis-/Zeigerverlust; Abbruch nach vollständiger Basiskopie mit Entfernung nur des neuen Profilordners; echter Windows-8.3-Pfad bis zur Wheelprüfung sowie Junction-Ablehnung. Die Kurzpfadprobe wurde tatsächlich ausgeführt, nicht übersprungen. Zusätzliche Lockeinträge werden auch bei nachgeführtem Lockhash zurückgewiesen. Fehlende ausgelieferte Metadaten gelten als Fehler und nicht als bloß fehlende Einrichtung.

Tatsächlich aktiviertes Profil: `artifacts/ml/laufzeit/profil-38b3d5a5-56db-4ce1-9285-0f56cd42c6b6/python.exe`. Vollmanifest: 21246 Dateien, 840056941 Bytes; Basismanifest-Hash `a3aa8af3128d25a2cffa62a0ec89893295607d5874345b4d2ebb2e8ac53aa6a6`. Alle 21 Soll-/Istversionen stimmen überein. Das vorherige Profil wurde erhalten. Diese Dateimengen sind Bestandswerte, keine Leistungsbehauptung.

Während der Einrichtung aufgedeckt und behoben: fehlende notwendige Tree-Freigabe ausschließlich für die selbst erzeugte skops-Probe; Node-24-`cp` mit exklusiv vorhandenem Zielordner; veraltete Stagingpfade in Konsolenstartern; verwaister neuer Profilordner bei fehlgeschlagenem Zeigerwechsel; falsche Behandlung legitimer 8.3-Namen als Umleitung. Frühere gescheiterte Versuche wurden nicht als Aktivierung ausgegeben. Der finale Statuscheck wurde anschließend von der Trainingsprobe getrennt; die 14 Tests prüfen den finalen Quellstand, der vollständige Einrichtungsdurchlauf weist dieselbe Trainingsprobe vor dieser reinen Statusabgrenzung nach.

## Grenzen und Übergabe

- Kein vollständiger Online-Einrichtungsdurchlauf im Endnutzer-UI: offizieller Download/Hashprüfung und tatsächlicher Offlinebootstrap sind getrennt nachgewiesen. Offlineauswahl, Main-IPC, eigenständiger ML-Export, Installer und UI-Abbruch werden durch Root/andere Agenten integriert und separat geprüft.
- Kein injizierter Dateisystemfehler genau beim Zeigerschreiben und kein harter OS-/Stromausfalltest. Die Transaktion ist lesend geprüft; der späte kooperative Abbruch ist nativ geprüft. Nach hartem Prozessabbruch kann eine `einrichtung.lock` zurückbleiben; eine automatische Wiederherstellung verwaister Einrichtungszustände ist noch nicht implementiert. Alte aktive Profile werden nicht automatisch gelöscht.
- Exakte Größen pro Wheel (größtes Torch-Wheel 128632218 Bytes), höchstens 512 MiB je deklarierter Datei; bestehende allgemeine 100-MiB-Grenzen wurden nicht verändert. Onlineabruf besitzt feste Zeit-/Bytegrenzen, Profilhashing acht begrenzte parallele Leser. Keine gemessene allgemeine Leistungsverbesserung behauptet.
- Nur die oben geprüfte Kombination Windows x64 / nicht freithreaded CPython 3.15.2 / feste CPU-Pins ist freigegeben. Keine CUDA-/GPU-/anderen Pythonversionen oder freie Paketinstallation.

Der unabhängige Backendreview ist ein eigenes Paket: Gegenprobe `artifacts/ml/review-backend.py` zeigte ML-REV-01 (geänderte RF-Gewichte, Vorhersage +100, trotzdem alte CSV als wiederverwendet; geänderte Originalmodelldatei nach Laden vor Ausgabe nicht erkannt). Businessagent korrigiert Herkunft und Modellquellen; diese offenen Backendbefunde werden nicht durch die Laufzeitprüfungen als erledigt bezeichnet.
