import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Eigener Arbeitskontext mit synthetischen Daten; weder Nutzerprofile noch Nutzerdokumente.
// Die Dialogauswahl wird auf Testdateien gelenkt. Vorschau, Prüflauf und Stoppen sind echt.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Uebersicht-'));
const profil = join(ordner, 'Profil');
const ziel = resolve('docs/uebersicht');
await mkdir(profil);
await mkdir(ziel, { recursive: true });
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, darstellung: 'hell' }),
);
const projekt = JSON.parse(
  await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
);
projekt.projektKennung = randomUUID();
projekt.name = 'Testdaten · Monatliche Umsatzübersicht für den Vertrieb';
projekt.business.parametersaetze.test.Quelldatei = resolve(
  'beispiele/business/A-Monatsauswertung/eingaben/umsaetze.csv',
);
projekt.business.parametersaetze.test.XLSX_Ziel = 'Monatsauswertung.xlsx';
projekt.business.parametersaetze.test.PDF_Ziel = 'Monatsauswertung.pdf';
const importPfad = join(ordner, 'Monatsauswertung.scriptlab');
await writeFile(importPfad, JSON.stringify(projekt));
let app, seite;
const rendererfehler = [],
  bilder = [],
  pruefungen = [];
async function bild(name) {
  await seite.evaluate(
    () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig))),
  );
  await seite.waitForTimeout(160);
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
async function stand() {
  return (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
}
async function lauf() {
  return (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
}
async function fertig(vorher) {
  await expect.poll(async () => (await lauf()).laufId).not.toBe(vorher);
  await expect
    .poll(async () => (await lauf()).phase, { timeout: 30000 })
    .toMatch(/^(beendet|abgebrochen|fehlgeschlagen|mit_fehlern|zeitlimit)$/);
  return lauf();
}
async function einstellungen(aktion) {
  await seite
    .getByRole('navigation', { name: 'Globale Navigation', exact: true })
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .click();
  await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
  await aktion();
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
}
try {
  console.log({ ordner, schritt: 'Startseite und Speichern' });
  app = await electron.launch({ args: [resolve('.')], env: { ...process.env, SCRIPTLAB_TESTDATEN: profil } });
  seite = await app.firstWindow();
  seite.on('pageerror', (fehler) => rendererfehler.push(fehler.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  await bild('start-leer-hell');
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, importPfad);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect.poll(async () => (await stand()).geaendert).toBe(false);
  await expect(seite.locator('#status-aktion')).toHaveText('', { timeout: 6000 });
  await seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  const vorher = await stand();
  await seite
    .getByRole('navigation', { name: 'Globale Navigation', exact: true })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await expect(seite.getByRole('button', { name: 'Weiterbearbeiten', exact: true })).toHaveCount(1);
  await expect(seite.getByRole('heading', { name: projekt.name, exact: true })).toHaveCount(1);
  await expect(seite.getByTestId('start-karten').getByRole('button')).toHaveCount(4);
  await expect(
    seite.locator('.start-inhalt > .sl-status').filter({ hasText: 'Projekt gespeichert.' }),
  ).toHaveCount(0);
  await bild('start-aktiver-workflow-hell');
  await seite.getByRole('button', { name: 'Weiterbearbeiten', exact: true }).click();
  const nachher = await stand();
  assert.equal(nachher.projektKennung, vorher.projektKennung);
  assert.deepEqual(nachher.projekt.editor, vorher.projekt.editor);
  assert.equal(nachher.projekt.ansicht.zoom, vorher.projekt.ansicht.zoom);
  assert.equal(nachher.geaendert, vorher.geaendert);
  assert.equal((await lauf()).laufId, null);
  pruefungen.push(
    'Aktiver Workflow einmal; Fortsetzen erhält Kennung, Bausteine, Zoom und Speicherzustand ohne Laufstart',
  );
  await seite
    .locator('.blocklyDraggable[data-id="a-datum"] > .blocklyPath')
    .first()
    .click({ position: { x: 12, y: 24 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await bild('editor-hell');
  console.log('Feldfehler und lesende Schrittvorschau');
  await bereich('Daten und Parameter');
  await daten('Quellen und Zuordnung');
  const spalte = seite
    .locator('.daten-eigenschaften [data-konfig-pfad=\'["konfiguration","spalte"]\'] input')
    .first();
  await spalte.fill('');
  await spalte.blur();
  await expect(seite.locator('.daten-fehlerlink').first()).toBeVisible();
  await seite.locator('.daten-fehlerlink').first().click();
  await expect(spalte).toBeFocused();
  const feldMeldung = 'Gib für „Spaltenname“ einen nicht leeren Text ein.';
  await expect(seite.locator('.daten-eigenschaften').getByText(feldMeldung, { exact: true })).toHaveCount(1);
  await bild('feldfehler-hell');
  await spalte.fill('Datum');
  await spalte.blur();
  await daten('Datenvorschau');
  await seite.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true }).selectOption('a-regionen');
  const alteVorschau = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  const vorschau = await fertig(alteVorschau);
  assert.equal(vorschau.phase, 'beendet');
  await expect(seite.getByRole('columnheader', { name: /Region/ })).toBeVisible();
  await bild('datenvorschau-hell');
  pruefungen.push(
    'Kurzer Fehlerlink fokussiert die Eingabe; vollständige Meldung einmal; echte Vorschau mit verständlichen Datentypen',
  );
  console.log('Gemeinsamer Laufkopf und Historie');
  await bereich('Läufe');
  await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  await bild('laufvorbereitung-hell');
  const altePruefung = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Prüflauf starten', exact: true }).click();
  const prueflauf = await fertig(altePruefung);
  assert.equal(prueflauf.phase, 'beendet');
  await seite.getByRole('button', { name: /^Alle Läufe/ }).click();
  await expect(seite.locator('.laufverwaltung-tabelle tbody tr')).toHaveCount(2);
  await seite.locator('.laufverwaltung-tabelle tbody tr').first().getByRole('button').click();
  await bild('gespeicherter-lauf-hell');
  await seite.getByRole('tab', { name: 'Ergebnisse', exact: true }).click();
  await bild('laufergebnisse-hell');
  const vorThema = await stand();
  await einstellungen(async () => {
    await seite.getByLabel('Farbschema', { exact: true }).selectOption('dunkel');
  });
  await bild('laufergebnisse-dunkel');
  await bereich('Daten und Parameter');
  await daten('Datenvorschau');
  await bild('datenvorschau-dunkel');
  await einstellungen(async () => {
    await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('2');
  });
  await daten('Parameterwerte');
  await expect(seite.getByRole('status', { name: 'Projektstatus', exact: true })).toBeVisible();
  await bild('formular-ui200-dunkel');
  await einstellungen(async () => {
    await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('1');
  });
  const nachThema = await stand();
  assert.deepEqual(nachThema.projekt.editor, vorThema.projekt.editor);
  assert.equal(nachThema.geaendert, vorThema.geaendert);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 680));
  await daten('Quellen und Zuordnung');
  await bild('formular-schmales-fenster-dunkel');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  pruefungen.push(
    'Historischer Lauf eindeutig; Themenwechsel und 200 Prozent UI-Text ohne fachliche Änderung',
  );
  const stoppProjekt = structuredClone(projekt);
  stoppProjekt.projektKennung = randomUUID();
  stoppProjekt.name = 'Testdaten · Wartender Workflow';
  stoppProjekt.business = { parameter: [], parametersaetze: { test: {}, echt: {} }, ressourcen: [] };
  stoppProjekt.editor.blocks.blocks = [
    {
      type: 'sl_start',
      id: 'start',
      x: 80,
      y: 96,
      next: {
        block: {
          type: 'sl_sleep',
          id: 'warten',
          inputs: { SEKUNDEN: { block: { type: 'sl_number', id: 'dauer', fields: { ZAHL: '20' } } } },
          next: {
            block: {
              type: 'sl_output',
              id: 'ende',
              inputs: { TEXT: { block: { type: 'sl_text', id: 'text', fields: { TEXT: 'Testende' } } } },
            },
          },
        },
      },
    },
  ];
  const stoppPfad = join(ordner, 'Warten.scriptlab');
  await writeFile(stoppPfad, JSON.stringify(stoppProjekt));
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, stoppPfad);
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Workflow öffnen', exact: true }).click();
  await bereich('Läufe');
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  await expect.poll(async () => (await lauf()).phase).toBe('laeuft');
  await bereich('Ablauf');
  await expect(seite.getByRole('button', { name: 'Stoppen', exact: true })).toBeVisible();
  await bild('lauf-stoppen-dunkel');
  const stoppId = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
  await expect.poll(async () => (await lauf()).phase, { timeout: 10000 }).toBe('abgebrochen');
  assert.equal((await lauf()).laufId, stoppId);
  assert.ok(!(await lauf()).ausgabe.includes('Testende'));
  pruefungen.push(
    'Echter Pythonprozess bleibt bei Ansichtswechsel bestehen; Stoppen weiterhin direkt erreichbar',
  );
  await app.evaluate(
    ({ dialog }, pfad) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    },
    join(ordner, 'Nicht vorhanden.scriptlab'),
  );
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Workflow öffnen', exact: true }).click();
  await expect(seite.locator('.aufgabenfehler')).toBeVisible();
  await seite.waitForTimeout(4200);
  await expect(seite.locator('.aufgabenfehler')).toBeVisible();
  await expect(seite.locator('#status-aktion')).toHaveText('');
  await bild('dauerhafter-fehler-dunkel');
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Workflow öffnen', exact: true }).click();
  await expect(seite.locator('.aufgabenfehler')).toHaveCount(0);
  await expect(seite.locator('#status-aktion')).toHaveText('');
  assert.equal((await lauf()).laufId, stoppId);
  pruefungen.push(
    'Erfolgsmeldung verschwindet; Fehler bleibt einmal erreichbar und kehrt nach einem abgebrochenen Folgeversuch nicht zurück',
  );
  assert.deepEqual(rendererfehler, []);
  await writeFile(
    join(ziel, 'sichtstand.json'),
    JSON.stringify(
      {
        datum: new Date().toISOString(),
        profil,
        fenster: ['1280 × 720', '960 × 680'],
        uiText: ['100 %', '200 %'],
        pruefungen,
        laufIds: [vorschau.laufId, prueflauf.laufId, stoppId],
        bilder,
        rendererfehler,
        grenzen: [
          'Eigene Sichtprüfung, kein Nutzertest.',
          'Keine neue vollständige Regression oder Windows-DPI-Matrix.',
        ],
      },
      null,
      2,
    ),
  );
  console.log({ fertig: true, pruefungen, bilder });
} catch (fehler) {
  await seite?.screenshot({ path: join(ziel, 'arbeitsweg-fehler.png') }).catch(() => {});
  console.log((await seite?.locator('body').innerText())?.slice(-5000));
  throw fehler;
} finally {
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
