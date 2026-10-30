import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Echte Windows-App, eigener Nutzerkontext und ausschließlich synthetische Beispieldaten.
// Nur die native Dateiauswahl wird auf eine fest vorbereitete Beispielprojektdatei gelenkt.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Produkt-'));
const profil = join(ordner, 'Profil');
const bilder = resolve('docs/produkt');
const nachweise = resolve('docs/produkt/nachweise');
await mkdir(profil);
await mkdir(nachweise, { recursive: true });
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, darstellung: 'hell' }),
);
const p = JSON.parse(
  await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
);
p.projektKennung = randomUUID();
p.name = 'Monatsbericht · Beispieldaten';
p.beschreibung = 'Synthetische Umsätze nach Region auswerten und als Excel und PDF ausgeben.';
const schritte = new Map();
for (let b = p.editor.blocks.blocks[0]; b; b = b.next?.block) schritte.set(b.id, b);
const namen = {
  'a-import': 'Umsätze einlesen',
  'a-betrag': 'Beträge als Zahlen',
  'a-monat': 'Berichtsmonat auswählen',
  'a-regionen': 'Umsatz nach Region',
  'a-xlsx': 'Excel-Auswertung',
  'a-pdf': 'PDF-Bericht',
};
const ids = ['start', ...Object.keys(namen)];
for (let i = 0; i < ids.length; i++) {
  const b = schritte.get(ids[i]);
  delete b.next;
  if (namen[b.id]) b.fields.NAME = namen[b.id];
  if (i + 1 < ids.length) b.next = { block: schritte.get(ids[i + 1]) };
  if (b.data) {
    const d = JSON.parse(b.data);
    if (b.id === 'a-betrag') d.eingaben.tabelle.referenz = 'a-import';
    if (['a-xlsx', 'a-pdf'].includes(b.id)) d.eingaben.tabelle.referenz = 'a-regionen';
    if (b.id === 'a-pdf') {
      d.konfiguration.schrift = 'INTERN:VERA';
      d.konfiguration.titel = 'Monatsbericht · Beispieldaten';
    }
    b.data = JSON.stringify(d);
  }
}
p.editor.blocks.blocks = [schritte.get('start')];
p.editor.blocks.blocks[0].x = 24;
p.editor.blocks.blocks[0].y = 24;
p.ansicht = { zoom: 1, x: 0, y: 0 };
p.business.parameter = p.business.parameter.filter((d) => d.name !== 'Schriftdatei');
for (const d of p.business.parameter) d.hilfe = 'Synthetische Beispieldaten.';
p.business.parametersaetze = {
  test: {
    Quelldatei: 'eingaben/umsaetze.csv',
    Berichtsmonat: '2026-10',
    XLSX_Ziel: 'Monatsbericht.xlsx',
    PDF_Ziel: 'Monatsbericht.pdf',
  },
  echt: {},
};
const eingaben = join(profil, 'Arbeitsdateien', p.projektKennung, 'eingaben');
await mkdir(eingaben, { recursive: true });
await writeFile(
  join(eingaben, 'umsaetze.csv'),
  await readFile(resolve('beispiele/business/A-Monatsauswertung/eingaben/umsaetze.csv')),
);
const projektdatei = join(ordner, 'Monatsbericht.scriptlab');
await writeFile(projektdatei, JSON.stringify(p));
let app, seite;
const rendererfehler = [],
  pruefungen = [],
  ausgaben = [];
const bereich = async (name) =>
  seite
    .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
const stand = async () => (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
const lauf = async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
async function bild(name, produkt = false) {
  await seite.waitForTimeout(180);
  await seite.screenshot({ path: join(produkt ? bilder : nachweise, `${name}.png`) });
}
async function fertig(vorher) {
  await expect.poll(async () => (await lauf()).laufId).not.toBe(vorher);
  await expect
    .poll(async () => (await lauf()).phase, { timeout: 45000 })
    .toMatch(/^(beendet|fehlgeschlagen|mit_fehlern|abgebrochen|zeitlimit)$/);
  const z = await lauf();
  assert.equal(z.phase, 'beendet', z.meldung);
  return z;
}
async function darstellung(thema, skala = '1') {
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
  await seite.getByLabel('Farbschema', { exact: true }).selectOption(thema);
  await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption(skala);
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
}
try {
  console.log('Produktaufnahmen: Editor und Datenvorschau');
  app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  seite = await app.firstWindow();
  seite.setDefaultTimeout(10000);
  seite.on('pageerror', (e) => rendererfehler.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false });
  }, projektdatei);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await seite
    .locator('.blocklyDraggable[data-id="a-monat"] > .blocklyPath')
    .first()
    .click({ position: { x: 12, y: 24 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await expect(seite.locator('#status-aktion')).toHaveText('', { timeout: 6500 });
  await bild('editor', true);
  const vorher = await stand(),
    laufVorher = await lauf();
  const geometrie = {
    kopf: await seite.locator('.workflow-kopf').boundingBox(),
    navigation: await seite.locator('.workflow-navigation').boundingBox(),
    arbeitsflaeche: await seite.locator('.arbeitszeile').boundingBox(),
  };
  await seite.getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  await expect(seite.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true })).toHaveValue('a-monat');
  assert.equal((await lauf()).laufId, laufVorher.laufId);
  await seite.getByRole('button', { name: 'Zum Baustein', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Datenvorschau', exact: true })).toBeFocused();
  const nachher = await stand();
  assert.deepEqual(nachher.projekt.editor, vorher.projekt.editor);
  assert.deepEqual(nachher.projekt.ansicht, vorher.projekt.ansicht);
  assert.equal(nachher.geaendert, vorher.geaendert);
  await seite.getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  await seite.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true }).selectOption('a-regionen');
  await seite.getByRole('button', { name: 'Zum Baustein', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Eigenschaften', exact: true })).toBeFocused();
  await seite.getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  const alteVorschau = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  await fertig(alteVorschau);
  await expect(seite.getByRole('columnheader', { name: /Region/ })).toBeVisible();
  await bild('daten', true);
  pruefungen.push(
    'Direkte Schrittvorschau und Rückweg erhalten Inhalt, Canvas und Speicherstatus; Ansicht startet keinen Lauf; Fokus auch beim Rückweg zu anderem Schritt sichtbar.',
  );
  await seite.getByRole('button', { name: 'Zum Baustein', exact: true }).click();
  await darstellung('dunkel');
  await bild('editor-dunkel');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 680));
  await bild('editor-schmal');
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeInViewport();
  await expect(seite.getByRole('button', { name: 'Prüflauf starten', exact: true })).toBeInViewport();
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await expect(seite.getByTestId('palette')).toBeVisible();
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await darstellung('hell', '2');
  await bild('editor-ui200');
  await expect(seite.getByRole('status', { name: 'Projektstatus', exact: true })).toBeInViewport();
  await expect(seite.getByRole('button', { name: 'Prüflauf starten', exact: true })).toBeInViewport();
  await seite.getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  await bild('daten-ui200');
  await darstellung('hell');
  pruefungen.push(
    '1280×720 hell/dunkel, 960×680 und 200 Prozent UI-Text mit sichtbarem Speicherstatus und Hauptaktionen; Palette nach Eigenschaften wieder erreichbar.',
  );
  console.log('Produktaufnahmen: echter Prüflauf und echte Excel-/PDF-Ausgabe');
  await bereich('Läufe');
  await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  await bild('laufvorbereitung');
  const alt = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Prüflauf starten', exact: true }).click();
  await fertig(alt);
  await seite.getByRole('tab', { name: 'Vorbereitung', exact: true }).click();
  await seite.getByLabel('Modus', { exact: true }).selectOption('ausfuehren');
  const prueflauf = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  const ende = await fertig(prueflauf);
  await seite.getByRole('tab', { name: 'Ergebnisse', exact: true }).click();
  await bild('ergebnisse', true);
  for (const name of ['Monatsbericht.xlsx', 'Monatsbericht.pdf']) {
    const datei = join(profil, 'Arbeitsdateien', p.projektKennung, name);
    const inhalt = await readFile(datei);
    ausgaben.push({ name, bytes: inhalt.length, sha256: createHash('sha256').update(inhalt).digest('hex') });
  }
  await darstellung('dunkel');
  await bild('ergebnisse-dunkel');
  pruefungen.push(
    'Tatsächlicher Prüflauf und echte Ausführung beendet; XLSX und PDF in der Appablage vorhanden, keine Ausgabeziele außerhalb gewählt.',
  );
  await writeFile(
    join(nachweise, 'sichtstand.json'),
    JSON.stringify(
      {
        datum: new Date().toISOString(),
        profil,
        geometrie,
        pruefungen,
        rendererfehler,
        ausgaben,
        laufId: ende.laufId,
        grenzen: [
          'Eigene Windows-Sichtprüfung mit synthetischen Daten, kein Nutzertest.',
          'Keine vollständige neue Windows-DPI-Matrix oder gesamte Python-/VBS-Regression.',
        ],
      },
      null,
      2,
    ),
  );
  assert.deepEqual(rendererfehler, []);
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}

// Bildfolge echter Bedienzustände des mitgelieferten Beispiels als eigene Kopie.
const gifProfil = join(ordner, 'GIF-Profil');
await mkdir(gifProfil);
await writeFile(
  join(gifProfil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, darstellung: 'hell' }),
);
const frames = [];
async function frame() {
  const datei = join(ordner, `bild-${frames.length}.png`);
  await seite.waitForTimeout(180);
  await seite.screenshot({ path: datei });
  frames.push(datei);
}
try {
  console.log('Produktaufnahme: Beispiel übernehmen und Vorschau öffnen');
  app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    env: { ...process.env, SCRIPTLAB_TESTDATEN: gifProfil },
  });
  seite = await app.firstWindow();
  seite.setDefaultTimeout(10000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  await seite.getByRole('button', { name: /^Beispielworkflows/ }).click();
  const artikel = seite.getByRole('article', { name: 'Monatliche Auswertung – Python', exact: true });
  await artikel.scrollIntoViewIfNeeded();
  await frame();
  await artikel.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
  await frame();
  await seite
    .locator('.blocklyDraggable[data-id="a-regionen"] > .blocklyPath')
    .first()
    .click({ position: { x: 12, y: 24 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await frame();
  await seite.getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  await frame();
  const alte = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  await fertig(alte);
  await frame();
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
if (frames.length) {
  execFileSync(
    process.env.SCRIPTLAB_IMAGEMAGICK ?? 'magick.exe',
    [
      '-delay',
      '200',
      ...frames,
      '-resize',
      '960x540',
      '-layers',
      'Optimize',
      '-loop',
      '0',
      join(bilder, 'einstieg.gif'),
    ],
    { stdio: 'inherit' },
  );
  console.log(
    JSON.stringify({
      gifBytes: (await stat(join(bilder, 'einstieg.gif'))).size,
      bilder: frames.length,
      ordner,
    }),
  );
}
