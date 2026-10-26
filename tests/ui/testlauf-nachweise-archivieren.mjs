import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nur nach abgeschlossenem Prüflauf und Sichtprüfung verwenden. Keine Tests oder Workflows starten.
// Optional: node tests/ui/testlauf-nachweise-archivieren.mjs --mit-berichten
const zielbasis = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(zielbasis, '../..');
const quelle = join(wurzel, 'artifacts/testlauf');
const argumente = process.argv.slice(2);
if (argumente.some((arg) => arg !== '--mit-berichten')) throw new Error('Unbekannte Archivoption.');
const mitBerichten = argumente.includes('--mit-berichten');
const vorbereitet = [];
const nativeNamen = [
  'native-dialoge',
  'native-dialoge-stopp',
  'native-dialoge-abbrechen',
  'native-dialoge-leer',
  'native-dialoge-ja',
  'native-dialoge-loeschen-nein',
];
const uiNamen = ['testausgabe-1280-text-100', 'testausgabe-1280-text-200'];

function verlangen(bedingung, meldung) {
  if (!bedingung) throw new Error(meldung);
}
async function lesen(pfad) {
  const info = await stat(pfad);
  verlangen(info.isFile() && info.size > 0, `Kein vollständiger Nachweis: ${pfad}`);
  return readFile(pfad);
}
function zahlenPruefen(daten, namen) {
  for (const name of namen)
    verlangen(Number.isFinite(daten[name]) && daten[name] >= 0, `Ungültige Messzahl: ${name}`);
}
function ergebnisPruefen(daten, stopp = false) {
  verlangen(
    daten.phase === (stopp ? 'abgebrochen' : 'beendet') &&
      daten.exitcode === (stopp ? 3221225786 : 0) &&
      typeof daten.ausgabe === 'string',
    'Unerwartetes natives Testergebnis.',
  );
  verlangen(
    Number.isFinite(Date.parse(daten.gestartetAm)) &&
      Date.parse(daten.beendetAm) >= Date.parse(daten.gestartetAm),
    'Ungültige Laufzeitpunkte.',
  );
}
function pfadeErsetzen(wert) {
  if (typeof wert === 'string')
    return wert.replace(
      /[a-z]:\\(?:[^\\\r\n"'<>|]+\\)*?ScriptLab-Testausgabe-UI-[^\\\r\n"'<>|]+/gi,
      '%TEMP%\\ScriptLab-Testausgabe-UI-<Testkennung>',
    );
  if (Array.isArray(wert)) return wert.map(pfadeErsetzen);
  if (wert && typeof wert === 'object')
    return Object.fromEntries(Object.entries(wert).map(([name, inhalt]) => [name, pfadeErsetzen(inhalt)]));
  return wert;
}
function jsonVorbereiten(name, daten) {
  function absolutePfadeEnthalten(wert) {
    if (typeof wert === 'string') return /[a-z]:\\|\\\\[^\\\s]+\\/i.test(wert);
    if (Array.isArray(wert)) return wert.some(absolutePfadeEnthalten);
    if (wert && typeof wert === 'object') return Object.values(wert).some(absolutePfadeEnthalten);
    return false;
  }
  const text = JSON.stringify(daten, null, 2) + '\n';
  // Nicht erkannte absolute Pfade vor dem ersten Schreiben ablehnen statt private Pfade zu archivieren.
  verlangen(!absolutePfadeEnthalten(daten), `Absoluter Pfad im Nachweis: ${name}`);
  vorbereitet.push({ ordner: 'nachweise', name: `testlauf-${name}.json`, inhalt: text });
}

for (const name of nativeNamen) {
  const daten = JSON.parse(await lesen(join(quelle, `${name}.json`)));
  ergebnisPruefen(daten, name === 'native-dialoge-stopp');
  if (name === 'native-dialoge-loeschen-nein')
    verlangen(daten.dateiErhalten === true, 'Die abgelehnte Löschung bestätigt keinen Dateierhalt.');
  jsonVorbereiten(name, daten);
}
for (const name of uiNamen) {
  const daten = JSON.parse(await lesen(join(quelle, `${name}.json`)));
  ergebnisPruefen(daten.ergebnis);
  zahlenPruefen(daten.geometrie, ['breite', 'hoehe', 'dpr', 'canvasHoehe', 'panelHoehe']);
  verlangen(
    daten.geometrie.canvasHoehe >= 120 && daten.geometrie.panelHoehe === 280,
    'Unvollständiger Panel-/Canvasnachweis.',
  );
  verlangen(daten.angefordert.uiTextProzent === (name.endsWith('100') ? 100 : 200), 'Falsche UI-Textstufe.');
  jsonVorbereiten(name, pfadeErsetzen(daten));
}
for (const name of uiNamen) {
  const inhalt = await lesen(join(quelle, `${name}.png`));
  verlangen(
    inhalt.length > 32 &&
      inhalt.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      inhalt.subarray(12, 16).toString('ascii') === 'IHDR' &&
      inhalt.readUInt32BE(16) >= 256 &&
      inhalt.readUInt32BE(20) >= 200,
    `Keine vollständige PNG-Aufnahme: ${name}`,
  );
  vorbereitet.push({ ordner: 'screenshots', name: `testlauf-${name}.png`, inhalt });
}

if (mitBerichten) {
  const roh = await lesen(join(quelle, 'unit-ergebnis.json'));
  const daten = JSON.parse(roh);
  const faelle = daten.testResults.flatMap((paket) => paket.assertionResults);
  zahlenPruefen(daten, [
    'numTotalTests',
    'numPassedTests',
    'numFailedTests',
    'numPendingTests',
    'numTodoTests',
    'startTime',
  ]);
  verlangen(
    daten.success === true &&
      daten.numTotalTests > 0 &&
      daten.numTotalTests === daten.numPassedTests &&
      faelle.length === daten.numTotalTests &&
      faelle.every((fall) => fall.status === 'passed') &&
      daten.numFailedTests + daten.numPendingTests + daten.numTodoTests === 0,
    'Der Unitbericht bestätigt keinen vollständig bestandenen Lauf.',
  );
  const ende = Math.max(...daten.testResults.map((paket) => paket.endTime));
  verlangen(Number.isFinite(ende) && ende >= daten.startTime, 'Unvollständige Unitlaufzeit.');
  jsonVorbereiten('unit-zusammenfassung', {
    schemaVersion: 1,
    quelle: 'artifacts/testlauf/unit-ergebnis.json',
    quellHash: createHash('sha256').update(roh).digest('hex'),
    werkzeug: 'Vitest',
    status: 'bestanden',
    gestartetAm: new Date(daten.startTime).toISOString(),
    dauerMillisekunden: Math.round(ende - daten.startTime),
    anzahl: daten.numTotalTests,
    bestanden: daten.numPassedTests,
    fehlgeschlagen: 0,
    uebersprungen: 0,
  });
  const desktopRoh = await lesen(join(wurzel, 'artifacts/desktop-ergebnis.json'));
  const desktop = JSON.parse(desktopRoh);
  const datenDesktop = desktop.stats;
  zahlenPruefen(datenDesktop, ['expected', 'unexpected', 'skipped', 'flaky', 'duration']);
  verlangen(
    datenDesktop.expected > 0 &&
      datenDesktop.unexpected + datenDesktop.skipped + datenDesktop.flaky === 0 &&
      Array.isArray(desktop.errors) &&
      desktop.errors.length === 0 &&
      Number.isFinite(Date.parse(datenDesktop.startTime)),
    'Der Desktopbericht bestätigt keinen vollständig bestandenen Lauf.',
  );
  jsonVorbereiten('desktop-zusammenfassung', {
    schemaVersion: 1,
    quelle: 'artifacts/desktop-ergebnis.json',
    quellHash: createHash('sha256').update(desktopRoh).digest('hex'),
    werkzeug: 'Playwright',
    status: 'bestanden',
    gestartetAm: datenDesktop.startTime,
    dauerMillisekunden: Math.round(datenDesktop.duration),
    anzahl: datenDesktop.expected,
    bestanden: datenDesktop.expected,
    fehlgeschlagen: 0,
    uebersprungen: 0,
    instabil: 0,
  });
}

// Erst jetzt sind ALLE Quellen geprüft und als unveränderliche Kopie im Speicher vorbereitet.
for (const ordner of ['screenshots', 'nachweise']) await mkdir(join(zielbasis, ordner), { recursive: true });
for (const datei of vorbereitet) await writeFile(join(zielbasis, datei.ordner, datei.name), datei.inhalt);
process.stdout.write(
  `${vorbereitet.filter((datei) => datei.ordner === 'screenshots').length} PNGs und ` +
    `${vorbereitet.filter((datei) => datei.ordner === 'nachweise').length} JSON-Nachweise archiviert.\n`,
);
