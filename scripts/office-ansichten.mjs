import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Ausschließlich synthetische Beispieldaten und ein eigenes, vorübergehendes App-Profil.
// Native Dateidialoge wählen feste Testdateien; Verarbeitung und Ergebnisse bleiben echt.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Office-'));
const profil = join(ordner, 'Profil');
const ziel = resolve('docs/office');
await mkdir(profil);
await mkdir(ziel, { recursive: true });
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({
    automatischeUpdates: false,
    pythonInterpreter: 'C:\\NichtVorhanden\\python.exe',
  }),
);
const projekt = JSON.parse(
  await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
);
projekt.projektKennung = randomUUID();
projekt.name = 'Testdaten · Monatliche Auswertung';
projekt.business.parametersaetze.test.Quelldatei = resolve(
  'beispiele/business/A-Monatsauswertung/eingaben/umsaetze.csv',
);
projekt.business.parametersaetze.test.XLSX_Ziel = 'Monatsauswertung.xlsx';
projekt.business.parametersaetze.test.PDF_Ziel = null;
const quellprojekt = join(ordner, 'Testdaten.scriptlab');
await writeFile(quellprojekt, JSON.stringify(projekt));
let app, seite;
const rendererfehler = [],
  pruefungen = [],
  bilder = [];
async function bild(name) {
  await seite.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
  await seite.waitForTimeout(180);
  await seite.screenshot({ path: join(ziel, `${name}.png`) });
  bilder.push(name);
}
async function bereich(name) {
  await seite
    .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
}
async function daten(name) {
  await seite
    .getByRole('tablist', { name: 'Ansichten für Daten und Parameter', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
}
async function einstellungen(aktion) {
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  await aktion();
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
}
async function warten(vorher) {
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId)
    .not.toBe(vorher);
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.phase, {
      timeout: 45000,
    })
    .toMatch(/^(beendet|mit_fehlern|fehlgeschlagen|abgebrochen|zeitlimit)$/);
  return (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
}
async function vorschau(id) {
  await seite.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true }).selectOption(id);
  const vorher = (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId;
  await seite.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  const lauf = await warten(vorher);
  assert.equal(lauf.phase, 'beendet', JSON.stringify(lauf));
  assert.equal(lauf.optionen.business.vorschauBlockId, id);
  await expect(seite.getByRole('columnheader').first()).toBeVisible();
  return lauf;
}
try {
  console.log({ ordner, schritt: 'Start und Sprachwahl' });
  const umgebung = {
    ...process.env,
    SCRIPTLAB_TESTDATEN: profil,
    PATH: `${process.env.SystemRoot}\\System32`,
  };
  delete umgebung.PYTHONPATH;
  delete umgebung.PYTHONHOME;
  delete umgebung.TCL_LIBRARY;
  delete umgebung.TK_LIBRARY;
  app = await electron.launch({ args: [resolve('.')], env: umgebung });
  seite = await app.firstWindow();
  seite.on('pageerror', (e) => rendererfehler.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  const einstellung = (await seite.evaluate(() => window.scriptlab.laden())).wert.einstellungen;
  assert.equal(einstellung.darstellung, 'hell');
  await bild('start-leer-hell');
  await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await expect(seite.getByRole('radio', { name: /Python/ })).toBeVisible();
  await expect(seite.getByRole('radio', { name: /VBS/ })).toBeVisible();
  await bild('sprachwahl-hell');
  await seite.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, quellprojekt);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeVisible();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument.geaendert)
    .toBe(false);
  await seite
    .locator('.blocklyDraggable[data-id="a-import"] > .blocklyPath')
    .first()
    .click({ position: { x: 12, y: 24 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await bild('editor-hell');
  console.log('Quellen und Parameter');
  await bereich('Daten und Parameter');
  await daten('Quellen und Zuordnung');
  await bild('quelle-parameterbindung-hell');
  await seite.getByRole('button', { name: 'Wert bearbeiten', exact: true }).first().click();
  await expect(seite.getByRole('tab', { name: 'Parameterwerte', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const quellfeld = seite.locator('[data-parameter-name="Quelldatei"]');
  const vorherWert = await quellfeld.locator('input').inputValue();
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await quellfeld.getByRole('button', { name: /auswählen/i }).click();
  assert.equal(await quellfeld.locator('input').inputValue(), vorherWert);
  pruefungen.push('Abgebrochene Dateiauswahl erhält gebundenen Parameterwert');
  const eigeneQuelle = join(ordner, 'Testdaten-Umsaetze.csv');
  await copyFile(vorherWert, eigeneQuelle);
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, eigeneQuelle);
  await quellfeld.getByRole('button', { name: /auswählen/i }).click();
  await expect(quellfeld.locator('input')).toHaveValue(eigeneQuelle);
  pruefungen.push('Bestätigte Dateiauswahl ändert den Parameterwert und erhält die Bindung');
  await bild('parameterwerte-hell');
  await daten('Datenvorschau');
  console.log('Direkte Vorschau mit unvollständigem Folgeschritt');
  const importlauf = await vorschau('a-import');
  const importspalten = importlauf.business.vorschau.spalten.map((s) => s.name);
  assert.ok(importspalten.includes('Datum'));
  await daten('Quellen und Zuordnung');
  await seite.getByRole('button', { name: '2 Datentyp festlegen (2)', exact: true }).click();
  const spaltenfeld = seite
    .locator('.daten-eigenschaften [data-konfig-pfad=\'["konfiguration","spalte"]\'] input')
    .first();
  await spaltenfeld.fill('');
  await spaltenfeld.blur();
  await expect(seite.locator('.daten-konfigurationsfehler')).toBeVisible();
  await bild('daten-fehlende-spalte-hell');
  await seite.locator('.daten-konfigurationsfehler button').first().click();
  await expect(spaltenfeld).toBeFocused();
  await spaltenfeld.fill('Datum');
  await spaltenfeld.blur();
  pruefungen.push('Fehlende Spaltenangabe wird direkt am Feld erklärt; Fehlerlink fokussiert die Korrektur');
  await daten('Datenvorschau');
  const gruppenlauf = await vorschau('a-regionen');
  assert.deepEqual(
    gruppenlauf.business.vorschau.spalten.map((s) => s.name),
    ['Region', 'Datensätze', 'Betrag'],
  );
  assert.equal(gruppenlauf.business.vorschau.zeilen.length, 2);
  await bild('datenvorschau-gruppiert-hell');
  await seite.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true }).selectOption('a-import');
  await expect(seite.getByRole('columnheader', { name: /Datum/ })).toBeVisible();
  await bild('datenvorschau-quelle-hell');
  assert.deepEqual(
    (await readdir(join(profil, 'Arbeitsdateien', projekt.projektKennung))).filter((n) =>
      /\.(xlsx|pdf)$/i.test(n),
    ),
    [],
  );
  pruefungen.push(
    'Zwei echte, getrennte Schrittvorschauen; keine XLSX/PDF-Ausgaben; fehlendes späteres Pflichtziel blockiert nicht',
  );
  await daten('Parameterwerte');
  const pdffeld = seite.locator('[data-parameter-name="PDF_Ziel"]').locator('input');
  await pdffeld.fill('Monatsauswertung.pdf');
  await pdffeld.blur();
  await expect
    .poll(
      async () =>
        (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument.projekt.business.parametersaetze
          .test.PDF_Ziel,
    )
    .toBe('Monatsauswertung.pdf');
  await bereich('Läufe');
  await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  await expect(seite.getByLabel('Modus', { exact: true })).toHaveValue('prueflauf');
  await bild('laufvorbereitung-hell');
  let vorher = (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId;
  await seite.getByRole('button', { name: 'Prüflauf starten', exact: true }).click();
  const prueflauf = await warten(vorher);
  assert.equal(prueflauf.phase, 'beendet', JSON.stringify(prueflauf));
  await bild('prueflauf-ergebnis-hell');
  await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  await seite.getByLabel('Modus', { exact: true }).selectOption('ausfuehren');
  vorher = (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId;
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  const echt = await warten(vorher);
  assert.equal(echt.phase, 'beendet', JSON.stringify(echt));
  for (const ausgabe of echt.business.bericht.ausgaben.filter((a) => a.status === 'publiziert'))
    assert.ok((await readFile(ausgabe.pfad)).length > 0);
  pruefungen.push('Prüflauf und echte XLSX-/PDF-Erzeugung mit App-Python ohne PATH-Python');
  await seite.getByRole('tab', { name: 'Ergebnisse', exact: true }).click();
  await bild('ergebnisse-hell');
  await einstellungen(async () => {
    await bild('einstellungen-darstellung-hell');
    await seite.getByRole('tab', { name: 'Laufzeit', exact: true }).click();
    await expect(
      seite.getByText('Die mitgelieferten Komponenten für Python, Tabellen und Dokumente sind bereit.', {
        exact: true,
      }),
    ).toBeVisible();
    await bild('einstellungen-laufzeit-hell');
  });
  const python = (await seite.evaluate(() => window.scriptlab.pythonStatus())).wert;
  assert.equal(python.installation.version, '3.15.2');
  assert.equal(python.installation.tkinter, true);
  assert.ok(python.installation.pfad.includes('python-buendel'));
  const business = (await seite.evaluate(() => window.scriptlab.businessLesen())).wert.status;
  assert.equal(business.zustand, 'bereit');
  assert.equal(business.pakete.length, 11);
  await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await seite.getByLabel('Inhalt', { exact: true }).selectOption('paket');
  await bild('business-export-hell');
  const exportziel = join(ordner, 'Testdaten.zip');
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: pfad });
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  }, exportziel);
  await seite.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
  await expect
    .poll(async () => (await readFile(exportziel).catch(() => Buffer.alloc(0))).length)
    .toBeGreaterThan(0);
  pruefungen.push('Business-Paket tatsächlich an gewählten Exportort geschrieben');
  await einstellungen(async () => {
    await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
    await seite.getByLabel('Farbschema', { exact: true }).selectOption('dunkel');
  });
  await bild('ergebnisse-dunkel');
  await bereich('Daten und Parameter');
  await daten('Datenvorschau');
  await vorschau('a-import');
  await bild('datenvorschau-dunkel');
  await bereich('Ablauf');
  await bild('editor-dunkel');
  await einstellungen(async () => {
    await seite.getByRole('tab', { name: 'Laufzeit', exact: true }).click();
    await bild('einstellungen-laufzeit-dunkel');
  });
  const vorDarstellung = (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
  await einstellungen(async () => {
    await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
    await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('2');
    await bild('einstellungen-ui200-dunkel');
  });
  await bereich('Daten und Parameter');
  await daten('Parameterwerte');
  await bild('parameterwerte-ui200-dunkel');
  assert.ok(await seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await einstellungen(async () => {
    await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
    await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('1');
  });
  const nachDarstellung = (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
  assert.equal(nachDarstellung.geaendert, vorDarstellung.geaendert);
  assert.deepEqual(nachDarstellung.projekt.editor, vorDarstellung.projekt.editor);
  pruefungen.push('200 Prozent UI-Text; persönliche Darstellung ändert weder Bausteine noch Speicherzustand');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 680));
  await daten('Quellen und Zuordnung');
  await bild('daten-schmales-fenster-dunkel');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Start', exact: true }).click();
  await bild('start-mit-workflow-dunkel');
  await seite.getByRole('button', { name: 'Workflows', exact: true }).click();
  await bild('workflowliste-dunkel');
  assert.deepEqual(rendererfehler, []);
  await writeFile(
    join(ziel, 'funktionsstand.json'),
    JSON.stringify(
      {
        datum: new Date().toISOString(),
        profil,
        fenster: '1280 × 720 CSS-Pixel',
        python,
        business,
        pruefungen,
        laufIds: [importlauf.laufId, gruppenlauf.laufId, prueflauf.laufId, echt.laufId],
        ausgaben: echt.business.bericht.ausgaben,
        exportziel,
        bilder,
        rendererfehler,
      },
      null,
      2,
    ),
  );
  console.log({ fertig: true, pruefungen, bilder });
} catch (fehler) {
  await seite?.screenshot({ path: join(ziel, 'arbeitsweg-fehler.png') }).catch(() => {});
  console.log((await seite?.locator('body').innerText())?.slice(-6500));
  throw fehler;
} finally {
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
