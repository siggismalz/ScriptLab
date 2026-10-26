# Geprüfte Grundlage am 26.10.2026

Die npm-Registry wurde vor der Installation für `latest` und Engines abgefragt. Eingesetzt werden feste stabile Versionen; die Lockdatei hält den vollständigen Baum fest.

| Bibliothek          | Version       |
| ------------------- | ------------- |
| Electron            | 45.0.0        |
| React / React DOM   | 19.3.1        |
| Vite / React-Plugin | 8.3.5 / 6.1.2 |
| TypeScript          | 7.0.2         |
| Blockly             | 13.4.0        |
| electron-builder    | 26.18.0       |
| electron-updater    | 6.8.11        |
| Vitest              | 5.0.5         |

Entwicklungsumgebung: Windows 11 Pro x64, Build 26200; Node.js 24.19.0, npm 11.17.0, Git 2.46.1.windows.1. Die Engines der gewählten Werkzeuge passen zu Node.js 24.

## Optionale Python-Laufzeit

Python wird nicht mit der Anwendung ausgeliefert. Unterstützt wird finales CPython 3.12 bis 3.15 für Windows x64. Praktisch wurden die vorhandene 3.12.6-Installation und eine separate offizielle portable 3.15.2-Laufzeit geprüft; die vollständigen Ergebnisse und Grenzen stehen in [PYTHON.md](PYTHON.md). Die am 26.10.2026 geprüfte [offizielle Windows-Downloadliste](https://www.python.org/downloads/windows/) führt 3.15.2 als stabile aktuelle Version. Die jeweiligen Minor-Dokumentationen werden ausdrücklich verwendet, insbesondere [3.12](https://docs.python.org/3.12/) und [3.15](https://docs.python.org/3.15/).

Die Windows-CI verwendet ausschließlich für Entwicklungstests CPython 3.15.2 x64 und [actions/setup-python v7.1.0](https://github.com/actions/setup-python/releases/tag/v7.1.0), fest auf Commit `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0` gepinnt. Eine isolierte CI-venv wird ohne pip, Aktivierung oder Paketdownload angelegt. Die Anwendungserkennung ruft weder den älteren Launcher noch den Install Manager über die Befehlsauflösung auf und installiert nichts automatisch.

Offizielle Grundlagen:

- [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security): Isolation, Sandbox, CSP und geprüfte IPC-Absender.
- [Blockly-Codegenerierung](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/): eigener Generator für jedes angebotene Bausteinverhalten.
- [Vite 8](https://vite.dev/guide/), [React 19](https://react.dev/versions).
- [electron-builder v26](https://www.electron.build/v26/). Die Hauptseite zeigte bei der Prüfung die unveröffentlichte v27; diese Vorab-Dokumentation ist keine Implementierungsgrundlage.
- [VBScript-Abkündigung](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features): Die spätere Ausführung hängt von Windows-Komponente und Richtlinien ab. ScriptLab aktiviert keine Features und ändert keine Sicherheitsrichtlinien.

Der Produktionsbuild und die Prüfungen sind für die tatsächliche Kombination maßgeblich, nicht allein die Kompatibilitätsangaben der Pakete.

Die GitHub-Actions wurden ebenfalls gegen die offiziellen Repositories geprüft und auf konkrete Commit-IDs festgelegt: checkout 7.0.1, setup-node 7.1.0 und upload-artifact 7.0.2. Der Windows-Runner verwendet Node.js 24.19.0. Ein Versionswechsel erfordert eine erneute Prüfung.
