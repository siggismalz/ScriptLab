# ScriptLab

Visueller Baukasten für Windows-Automatisierungen. **Entwickelt von Leon Stolz.**

ScriptLab erstellt, prüft und speichert Workflows und exportiert VBScript-Dateien. Es führt keine Workflows aus. Die Codevorschau zeigt ausschließlich Text. Exportierte Dateien führt der Nutzer eigenständig außerhalb der Anwendung aus.

Zielsystem der ersten Version: Windows 11 x64. Weitere Windows-Versionen sind derzeit nicht freigegeben. Die Windows-VBScript-Komponente wird zum Bearbeiten und Exportieren nicht benötigt.

## Entwicklung

Node.js 24 LTS und npm installieren. Danach im Projektordner:

```powershell
npm ci
npm run check
npm test
npm run dev
```

`npm run dev` baut die Anwendung und öffnet das lokale Electron-Fenster; es startet keinen Webserver und lädt keine entfernten Bibliotheken. Nach Codeänderungen neu bauen und starten.

## Projekt und Export

`.scriptlab` enthält den bearbeitbaren JSON-Projektzustand. `.vbs` enthält erzeugten Quelltext und ist kein rückimportierbares Projektformat. Unvollständige Entwürfe dürfen gespeichert werden; Fehler verhindern den Export.

Der Projektlizenz hat Leon Stolz noch nicht festgelegt. `UNLICENSED` kennzeichnet diese ausstehende Freigabe und erteilt keine Nutzungslizenz. Fremdbibliotheken behalten ihre jeweiligen Lizenzen.

Die Entwicklung und Prüfungen werden schrittweise dokumentiert. Signierte Produktionsreleases benötigen eine gesondert eingerichtete Entwickler-Signatur; Nutzerscripts verwenden ausschließlich das vom Nutzer ausgewählte Zertifikat.
