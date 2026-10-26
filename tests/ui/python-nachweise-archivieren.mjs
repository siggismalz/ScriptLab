import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nur fertige, tatsächlich ausgeführte Prüfberichte und zuvor gesichtete Aufnahmen archivieren.
// Dieses Werkzeug startet weder die Anwendung noch einen Workflow.
const ziel = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(ziel, '../..');
const quelle = join(wurzel, 'artifacts/python');
const vorbereitet = [];
const verlangen = (bedingung, meldung) => {
  if (!bedingung) throw new Error(meldung);
};
const hash = (daten) => createHash('sha256').update(daten).digest('hex');
async function bericht(name) {
  const roh = await readFile(join(quelle, name));
  return { daten: JSON.parse(roh.toString('utf8')), hash: hash(roh) };
}
function json(name, daten) {
  const inhalt = JSON.stringify(daten, null, 2) + '\n';
  verlangen(!/[a-z]:\\|\\\\[^\\\s]+\\/i.test(inhalt), 'Ein Nachweis enthält einen lokalen absoluten Pfad.');
  vorbereitet.push({ datei: join(ziel, 'nachweise', `python-${name}.json`), inhalt });
}
const unit = await bericht('unit-ergebnis.json');
const u = unit.daten;
verlangen(
  u.success &&
    u.numTotalTests > 0 &&
    u.numTotalTests === u.numPassedTests &&
    u.numFailedTests === 0 &&
    u.numPendingTests === 0,
  'Kein vollständig grüner Unitlauf.',
);
verlangen(
  u.testResults.flatMap((r) => r.assertionResults).every((t) => t.status === 'passed'),
  'Ein Unitfall ist nicht bestanden.',
);
json('unit-zusammenfassung', {
  schemaVersion: 1,
  quelle: 'artifacts/python/unit-ergebnis.json',
  quellHash: unit.hash,
  werkzeug: 'Vitest',
  status: 'bestanden',
  gestartetAm: new Date(u.startTime).toISOString(),
  dauerMillisekunden: Math.round(Math.max(...u.testResults.map((r) => r.endTime)) - u.startTime),
  anzahl: u.numTotalTests,
  bestanden: u.numPassedTests,
  fehlgeschlagen: u.numFailedTests,
  uebersprungen: u.numPendingTests,
});
const vorher = await bericht('unit-ergebnis-erster-lauf.json');
json('unit-vorheriger-lauf', {
  schemaVersion: 1,
  quelle: 'artifacts/python/unit-ergebnis-erster-lauf.json',
  quellHash: vorher.hash,
  status: vorher.daten.success ? 'bestanden' : 'fehlgeschlagen',
  anzahl: vorher.daten.numTotalTests,
  bestanden: vorher.daten.numPassedTests,
  fehlgeschlagen: vorher.daten.numFailedTests,
  uebersprungen: vorher.daten.numPendingTests,
  beobachtung:
    'Ein VBS-Vergleichsprozess erreichte seine unveränderte Zehn-Sekunden-Frist. Zwei gezielte Gegenläufe und der anschließende vollständige Lauf bestanden. Die sporadische Ursache ist nicht abschließend geklärt.',
});
const desktopRoh = await readFile(join(wurzel, 'artifacts/desktop-ergebnis.json'));
const desktop = JSON.parse(desktopRoh.toString('utf8'));
const d = desktop.stats;
verlangen(
  d.expected > 0 && d.unexpected === 0 && d.flaky === 0 && d.skipped === 0 && desktop.errors.length === 0,
  'Kein vollständig grüner Desktoplauf.',
);
json('desktop-zusammenfassung', {
  schemaVersion: 1,
  quelle: 'artifacts/desktop-ergebnis.json',
  quellHash: hash(desktopRoh),
  werkzeug: 'Playwright/Electron',
  status: 'bestanden',
  gestartetAm: d.startTime,
  dauerMillisekunden: d.duration,
  anzahl: d.expected,
  bestanden: d.expected,
  fehlgeschlagen: d.unexpected,
  instabil: d.flaky,
  uebersprungen: d.skipped,
});
const desktopVorher = await bericht('desktop-ergebnis-erster-lauf.json');
const dv = desktopVorher.daten.stats;
json('desktop-vorheriger-lauf', {
  schemaVersion: 1,
  quelle: 'artifacts/python/desktop-ergebnis-erster-lauf.json',
  quellHash: desktopVorher.hash,
  status: 'fehlgeschlagen',
  anzahl: dv.expected + dv.unexpected + dv.skipped,
  bestanden: dv.expected,
  fehlgeschlagen: dv.unexpected,
  uebersprungen: dv.skipped,
  beobachtung:
    'Veraltete exakte Schnittstellen-, Einstellungs-, Projekt-, Variablen- und Leertext-Erwartungen wurden an den geprüften neuen Vertrag angepasst. Die tatsächliche Bereitschaft des Basisfelds und das bewusste Öffnen vorhandener Testoptionen werden vor weiteren Aktionen geprüft. Ein zuerst im Zustand bereit verbliebener Python-UI-Fall bestand gezielt ohne Ablaufänderung; seine ursprüngliche Ursache ist nicht abschließend belegt.',
});
for (const name of ['sprachwahl-1280-text-200', 'sprachwahl-850-text-200']) {
  const messung = await bericht(`${name}.json`);
  json(name, messung.daten);
  const png = await readFile(join(quelle, `${name}.png`));
  verlangen(
    png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && png.length > 100,
    'Kein vollständiges PNG.',
  );
  vorbereitet.push({ datei: join(ziel, 'screenshots', `python-${name}.png`), inhalt: png });
}
const eingabe = await bericht('native-dialoge-normal.json');
const zeitlimit = await bericht('native-dialoge-zeitlimit.json');
verlangen(
  eingabe.daten.phase === 'abgebrochen' &&
    eingabe.daten.exitcode === 3221225786 &&
    eingabe.daten.ausgabe.includes('EINGABE=Grüße aus Python 😀\r\nEINGABE=\r\nEINGABE=\r\n'),
  'Die Eingabe-/Stoppprüfung ist unvollständig.',
);
verlangen(
  zeitlimit.daten.phase === 'zeitlimit' &&
    zeitlimit.daten.exitcode === 3221225786 &&
    !zeitlimit.daten.ausgabe.includes('NICHT ERREICHBAR'),
  'Kein bestätigtes Dialogzeitlimit.',
);
json('native-dialoge', {
  schemaVersion: 1,
  pythonVersion: eingabe.daten.pythonVersion,
  eingabenUndStopp: { ...eingabe.daten, quellHash: eingabe.hash },
  zeitlimit: { ...zeitlimit.daten, quellHash: zeitlimit.hash, zeitlimitSekunden: 1 },
  geprueft: [
    'Unicodeeingabe',
    'Leeres OK ergibt leeren Text',
    'Abbrechen ergibt leeren Text',
    'Werkzeugleisten-Stopp bei offener Ja-/Nein-Rückfrage',
    'Zeitlimit bei offener Nachrichtenbox',
  ],
  offen: ['Ja-/Nein-Antworten', 'Nachrichtenbox-OK', 'Löschrückfrage mit Nein'],
  grenze:
    'Der Windows-UI-Helper erkannte die betreffenden nativen Tk-Unterfenster nicht zuverlässig als auswählbares Ziel. Die offenen Antworten gelten nicht als interaktiv geprüft. Der Dateierhalt hier bestätigt nur, dass der spätere Löschblock nicht erreicht wurde.',
});
for (const datei of vorbereitet) {
  await mkdir(dirname(datei.datei), { recursive: true });
  await writeFile(datei.datei, datei.inhalt);
}
process.stdout.write(`${vorbereitet.length} bereinigte Python-Nachweise archiviert.\n`);
