# Marke und bearbeitbare Assets

Farbstand: 30. Oktober 2026. Historische Einzelprüfungen sind unten datiert.

## Richtung

Die Schreibweise lautet **ScriptLab**. Die bestehende Idee eines S-Signets wurde als verbundene Folge aus drei Bausteinen weiterentwickelt. Die einfache Geometrie verbindet den visuellen Baukasten mit einem nachvollziehbaren Ablauf. Sie funktioniert ohne Farbe, Verläufe, Schatten oder Glanz. Gedämpfte Petrolakzente und neutrale Grün-/Grauflächen prägen den aktuellen Stand; Form und Systemtypografie bleiben erhalten. Kundenunterlagen behalten ihre eigenen Vorlagen und Absenderangaben.

Die Wortmarke verwendet Semibold und bleibt in den SVG-Dateien als echter, bearbeitbarer Text erhalten. Der Schriftstapel lautet `Segoe UI Variable, Segoe UI, system-ui, sans-serif`. Es werden keine Windows-Schriftdateien eingebettet, kopiert oder im Anwendungspaket ergänzt. Auf Systemen mit anderen Schriften kann die Laufweite abweichen. Die Anwendung soll die Wortmarke deshalb als Text und das Signet als Vektor darstellen. Die Entwicklercredits **Leon Stolz** stehen in den Produktinformationen.

## Dateien

| Datei | Verwendung |
| --- | --- |
| [scriptlab.svg](../../assets/scriptlab.svg) | Bearbeitbare Vektorquelle für das Windows-Anwendungsicon; helles Petrol auf abgerundeter dunkler Neutralfläche. |
| [scriptlab-signet.svg](../../assets/scriptlab-signet.svg) | Einfarbiges Signet mit `currentColor`, transparentem Hintergrund und identischer Geometrie. |
| [scriptlab-wortmarke.svg](../../assets/scriptlab-wortmarke.svg) | Wortmarke mit Signet für helle Flächen. |
| [scriptlab-wortmarke-dunkel.svg](../../assets/scriptlab-wortmarke-dunkel.svg) | Wortmarke mit Signet für dunkle Flächen. |
| [scriptlab.ico](../../assets/scriptlab.ico) | Windows-Icon mit fünf eingebetteten 32-Bit-PNG-Ressourcen: 16, 24, 32, 48 und 256 Pixel. |
| [scriptlab.png](../../assets/scriptlab.png) | Rastervariante mit 256 × 256 Pixeln. |
| `assets/icons/scriptlab-{16,24,32,48,256}.png` | Einzelgrößen für Prüfung und Weiterverwendung. |
| [Icon-Prüftafel](../../assets/scriptlab-icon-pruefung.png) | Originalgrößen und dreifache Pixelansicht auf dunklem und hellem Hintergrund. |
| [Wortmarken-Prüftafel](../../assets/scriptlab-marke-pruefung.png) | Beide Wortmarken sowie einfarbiges Signet, im installierten Chrome gerendert. |
| [Technischer Prüfdatensatz](../../assets/scriptlab-icon-pruefung.json) | Tatsächlich gelesene ICO-Einträge und Prüfungen. |

Das einfarbige Signet benötigt eine explizite Vordergrundfarbe. Ein externes SVG in einem HTML-`img` erbt `currentColor` nicht aus dem umgebenden Dokument. Für die Oberfläche daher ein Inline-SVG oder eine CSS-Maske mit der jeweiligen Akzentrolle verwenden. Auf dunklen Flächen ist `#9DCBC0`, auf hellen Flächen `#286C63` vorgesehen. Das Windows-Icon verwendet `#9DCBC0` auf `#121D19` und bleibt unabhängig vom Anwendungsthema gleich. Die verlinkten Prüftafeln dokumentieren den historischen blauen Stand vom 28. Oktober und sind kein aktueller Farbnachweis.

## Reproduzierbare Erzeugung

Im Repository unter Windows ausführen:

```powershell
powershell -NoProfile -File scripts\icon-erzeugen.ps1
```

Der Generator liest die Rechtecke und Verbindung aus der SVG-Quelle, rendert jede Größe mit achtfacher Zwischenauflösung und erzeugt die separaten PNGs sowie die ICO-Ressourcen. Er benötigt nur die bereits vorhandene Windows/.NET-Zeichenbibliothek. Es werden keine Schriftdateien, Downloads oder externen Grafikprogramme benötigt. Unbekannte SVG-Elemente, Transformationen und Effekte führen zu einem Fehler, damit Raster und Vektor nicht still auseinanderlaufen.

## Tatsächlich durchgeführte Prüfung

Der Generator wurde am 28. Oktober 2026 nach der Umstellung auf Office-Blau erneut erfolgreich ausgeführt. Ein unabhängiger Node-Lesevorgang hat anschließend geprüft:

- ICO-Typ 1, genau fünf Einträge und jeweils 32 Bit Farbtiefe.
- Tatsächliche PNG-Abmessungen 16, 24, 32, 48 und 256 Pixel.
- Alle ICO-Bildressourcen sind bytegleich zu den separaten PNGs.
- `scriptlab.png` ist identisch zur 256-Pixel-Ressource.
- Die bestehende Vektorgeometrie wurde beibehalten; der Generator leitet die Rasterdateien weiter aus derselben Quelle ab.

Die neue Icon-Prüftafel wurde visuell bei 16, 24, 32, 48 und 256 Pixeln auf beiden Hintergrundfarben betrachtet; kleine Größen zusätzlich bei dreifacher Pixelvergrößerung. Drei Bausteine und Verbindung bleiben erkennbar. Bei 16 Pixeln sind die Konturen erwartungsgemäß weicher. Die blauen Wortmarken und das einfarbige Signet wurden mit den installierten Systemschriften im vorhandenen Chrome gerendert und visuell geprüft. Der Text wird nicht abgeschnitten.

Diese Asset-Prüfung bestätigt die Dateien und ihre Darstellung. Sie ersetzt keine Kontrolle der Windows-Taskleiste, des Installers oder aller Fensterzustände der fertig gebauten Anwendung; die Produktprüfung wird separat dokumentiert.
