import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Erst nach bestandenem Desktoplauf und visueller Kontrolle verwenden.
// Das Kopieren erzeugt weder neue Tests noch eine Ausführung von Workflowaktionen.
const zielbasis = dirname(fileURLToPath(import.meta.url));
const quelle = resolve(zielbasis, '../../artifacts/ui');
const bilder = [
  'standard-1280-dpi-100',
  'workflow-28-bausteine',
  'verschachtelt-mit-code',
  'eigenschaften-overlay-lange-pfade',
  'eigenschaften-angeheftet-1600',
  'auswahl-und-feldfokus',
  'fehler-am-baustein',
  'suche-treffer',
  'suche-ohne-treffer',
  'klickweg-speichern-oeffnen-export',
  'signatur-nicht-eingerichtet',
  'testantwort-signatur-gueltig',
  'testantwort-update-verfuegbar',
  'testantwort-update-laedt',
  'testantwort-update-fehler',
  'ui-text-200',
  'simulierte-kontrastfarben-reduzierte-bewegung',
  'ziehen-am-start-mit-marker',
  'ziehen-verschachtelt-mit-marker',
];
const messdaten = ['dpi-100', 'dpi-125', 'dpi-150', 'dpi-200', 'svg-kontraste', 'navigationsfokus'];
const dateien = [
  ...bilder.map((name) => ({ name: `${name}.png`, ordner: 'screenshots' })),
  ...messdaten.map((name) => ({ name: `${name}.json`, ordner: 'nachweise' })),
];

// Fehlende Quelldateien vor dem ersten Überschreiben melden.
for (const datei of dateien) {
  const info = await stat(join(quelle, datei.name));
  if (!info.isFile() || !info.size) throw new Error(`Kein vollständiger Nachweis: ${datei.name}`);
}
for (const ordner of ['screenshots', 'nachweise']) await mkdir(join(zielbasis, ordner), { recursive: true });
for (const datei of dateien)
  await copyFile(join(quelle, datei.name), join(zielbasis, datei.ordner, datei.name));
process.stdout.write(
  `${bilder.length} Bildschirmaufnahmen und ${messdaten.length} Messdateien archiviert.\n`,
);
