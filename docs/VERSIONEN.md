# Geprüfte Grundlage am 26.10.2026

Die npm-Registry wurde vor der Installation für `latest` und Engines abgefragt. Eingesetzt werden feste stabile Versionen; die Lockdatei hält den vollständigen Baum fest.

| Bibliothek | Version |
|---|---|
| Electron | 45.0.0 |
| React / React DOM | 19.3.1 |
| Vite / React-Plugin | 8.3.5 / 6.1.2 |
| TypeScript | 7.0.2 |
| Blockly | 13.4.0 |
| electron-builder | 26.18.0 |
| electron-updater | 6.8.11 |
| Vitest | 5.0.5 |

Entwicklungsumgebung: Windows 11 Pro x64, Build 26200; Node.js 24.19.0, npm 11.17.0, Git 2.46.1.windows.1. Die Engines der gewählten Werkzeuge passen zu Node.js 24.

Offizielle Grundlagen:

- [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security): Isolation, Sandbox, CSP und geprüfte IPC-Absender.
- [Blockly-Codegenerierung](https://docs.blockly.com/guides/create-custom-blocks/code-generation/overview/): eigener Generator für jedes angebotene Bausteinverhalten.
- [Vite 8](https://vite.dev/guide/), [React 19](https://react.dev/versions).
- [electron-builder v26](https://www.electron.build/v26/). Die Hauptseite zeigte bei der Prüfung die unveröffentlichte v27; diese Vorab-Dokumentation ist keine Implementierungsgrundlage.
- [VBScript-Abkündigung](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features): Die spätere Ausführung hängt von Windows-Komponente und Richtlinien ab. ScriptLab aktiviert keine Features und ändert keine Sicherheitsrichtlinien.

Der Produktionsbuild und die Prüfungen sind für die tatsächliche Kombination maßgeblich, nicht allein die Kompatibilitätsangaben der Pakete.
