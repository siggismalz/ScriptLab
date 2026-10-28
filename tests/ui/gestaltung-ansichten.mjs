import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

// Ausschließlich synthetische lokale Beispieldaten. Kein Netz, keine Nutzerdokumente.
const basis = await mkdtemp(join(tmpdir(), 'ScriptLab-Gestaltung-'));
const profil = join(basis, 'Profil');
await mkdir(profil);
const installation = JSON.parse(
  await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
).installation;
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({
    automatischeUpdates: false,
    vorabversionen: false,
    darstellung: 'dunkel',
    pythonInterpreter: installation.pfad,
  }),
);
await cp(resolve('beispiele/business/A-Monatsauswertung'), join(basis, 'Monatsauswertung'), {
  recursive: true,
});
const projektdatei = join(basis, 'Monatsauswertung/workflow.scriptlab');
const projekt = JSON.parse(await readFile(projektdatei, 'utf8'));
projekt.name = 'Testdaten · Monatsauswertung Oktober';
await writeFile(projektdatei, JSON.stringify(projekt));
const ziel = resolve('docs/gestaltung/nachher');
await mkdir(ziel, { recursive: true });
const app = await electron.launch({
  args: [resolve('.')],
  env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
});
const seite = await app.firstWindow();
const fehler = [];
seite.on('pageerror', (e) => fehler.push(e.message));
async function bild(name) {
  await seite.evaluate(() => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig))));
  await seite.waitForTimeout(150);
  await seite.screenshot({ path: join(ziel, name + '.png') });
}
async function bereich(name) {
  await seite.getByRole('tab', { name, exact: true }).click();
}
async function modus(wert) {
  await bereich('Vorbereitung');
  await seite.getByLabel('Modus', { exact: true }).selectOption(wert);
}
async function starten(name) {
  const vorher = await seite.evaluate(async () => (await window.scriptlab.testLesen()).wert.zustand.laufId);
  await seite.getByTestId('test-panel').getByRole('button', { name, exact: true }).click();
  let fertig;
  await expect
    .poll(
      async () => {
        fertig = await seite.evaluate(async () => (await window.scriptlab.testLesen()).wert.zustand);
        return Boolean(
          fertig.laufId &&
          fertig.laufId !== vorher &&
          !['vorbereitung', 'laeuft', 'stoppt'].includes(fertig.phase),
        );
      },
      { timeout: 45000 },
    )
    .toBe(true);
  return fertig;
}

try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).waitFor();
  await bild('start-leer-dunkel-1280');
  await app.evaluate(({ dialog }, datei) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
  }, projektdatei);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await seite.getByTestId('editor-sprache').waitFor();
  await seite
    .locator('g[data-id="a-import"]')
    .first()
    .click({ position: { x: 30, y: 20 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await bild('editor-auswahl-dunkel-1280');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await bereich('Daten und Parameter');
  await bild('daten-konfiguration-dunkel-1280');
  await bereich('Läufe');
  await app.evaluate(
    ({ dialog }, ordner) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ordner] });
    },
    join(basis, 'Monatsauswertung'),
  );
  await seite.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
  await modus('prueflauf');
  await bild('lauf-vorbereitung-dunkel-1280');
  const pruefung = await starten('Prüflauf starten');
  assert.equal(pruefung.optionen.business.modus, 'prueflauf');
  assert.equal(pruefung.phase, 'beendet');
  await bereich('Ergebnisse');
  await bild('lauf-ergebnisse-dunkel-1280');
  await modus('vorschau');
  const vorschau = await starten('Datenvorschau laden');
  assert.equal(vorschau.optionen.business.modus, 'vorschau');
  assert.ok(vorschau.business?.vorschau);
  await bereich('Daten und Parameter');
  await seite.getByRole('tab', { name: 'Datenvorschau', exact: true }).click();
  await bild('datenvorschau-dunkel-1280');
  await bereich('Ablauf');
  await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await bild('export-business-dunkel-1280');
  await seite.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  await bild('einstellungen-dunkel-1280');
  await seite.getByLabel('Farbschema', { exact: true }).selectOption('hell');
  await bild('einstellungen-hell-1280');
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
  await bild('editor-hell-1280');
  await bereich('Daten und Parameter');
  await bild('daten-konfiguration-hell-1280');
  await bereich('Läufe');
  await bereich('Übersicht');
  await bild('lauf-uebersicht-hell-1280');
  await bereich('Ablauf');
  await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await bild('export-business-hell-1280');
  await seite.getByRole('button', { name: 'Abbrechen', exact: true }).click();

  async function thema(wert) {
    await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
    await seite.getByLabel('Farbschema', { exact: true }).selectOption(wert);
    await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
  }
  const biz = (type, id, name, konfiguration, eingaben = {}) => ({
    type,
    id,
    fields: { NAME: name },
    data: JSON.stringify({ konfiguration, eingaben }),
  });
  function pruefprojekt(name, mitPause = false) {
    const p = structuredClone(projekt);
    p.projektKennung = randomUUID();
    p.name = name;
    p.beschreibung = 'Synthetische lokale Testdaten für die Gestaltungsprüfung.';
    p.business = { parameter: [], parametersaetze: { test: {}, echt: {} }, ressourcen: [] };
    const lesen = biz('sl_biz_lesen_csv', 'qa-lesen', 'Testdaten lesen', {
      format: 'CSV',
      pfad: join(basis, 'Monatsauswertung/eingaben/umsaetze.csv'),
      optionen: { trennzeichen: ';' },
    });
    const speichern = biz(
      'sl_biz_schreiben_csv',
      'qa-speichern',
      'Testdaten als CSV speichern',
      { format: 'CSV', pfad: join(basis, 'Testdaten-Ergebnis.csv'), konflikt: 'ERSETZEN', optionen: {} },
      { tabelle: { referenz: 'qa-lesen' } },
    );
    const versuch = biz('sl_biz_fehlerbehandlung', 'qa-versuch', 'Fehlende Testdatei behandeln', {});
    versuch.inputs = {
      ABLAUF: {
        block: biz('sl_biz_lesen_csv', 'qa-fehlt', 'Fehlende Testdatei lesen', {
          format: 'CSV',
          pfad: join(basis, 'absichtlich-fehlt.csv'),
          optionen: {},
        }),
      },
      FEHLER: {
        block: {
          type: 'sl_output',
          id: 'qa-hinweis',
          inputs: {
            TEXT: {
              block: {
                type: 'sl_text',
                id: 'qa-text',
                fields: { TEXT: 'Die Testdatei fehlt. Die bereits erstellte Ausgabe bleibt verfügbar.' },
              },
            },
          },
        },
      },
    };
    lesen.next = { block: speichern };
    speichern.next = { block: versuch };
    if (mitPause)
      lesen.next = {
        block: {
          type: 'sl_sleep',
          id: 'qa-pause',
          inputs: { SEKUNDEN: { block: { type: 'sl_number', id: 'qa-sekunden', fields: { ZAHL: '30' } } } },
          next: { block: speichern },
        },
      };
    p.editor.blocks.blocks = [{ type: 'sl_start', id: 'qa-start', x: 80, y: 96, next: { block: lesen } }];
    return p;
  }
  async function oeffnen(p, dateiname) {
    const pfad = join(basis, dateiname + '.scriptlab');
    await writeFile(pfad, JSON.stringify(p));
    await app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    }, pfad);
    await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Workflow öffnen', exact: true }).click();
    await expect(seite.locator('.workflow-identitaet h1')).toHaveText(p.name);
    await expect
      .poll(async () => {
        const r = await seite.evaluate(() => window.scriptlab.laden());
        return r.ok && !r.wert.dokument.darstellungNoetig;
      })
      .toBe(true);
  }
  await oeffnen(pruefprojekt('Testdaten · Lauf starten und stoppen', true), 'Lauf-Stopp');
  await bereich('Läufe');
  await modus('ausfuehren');
  await seite
    .getByTestId('test-panel')
    .getByRole('button', { name: 'Workflow ausführen', exact: true })
    .click();
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.phase)
    .toBe('laeuft');
  const laufend = (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
  await bild('lauf-aktiv-hell-1280');
  await thema('dunkel');
  await bild('lauf-aktiv-dunkel-1280');
  await bereich('Ablauf');
  assert.equal(
    (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId,
    laufend.laufId,
  );
  await bild('editor-lauf-aktiv-dunkel-1280');
  await seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.phase)
    .toBe('abgebrochen');
  await bereich('Läufe');
  await bild('lauf-abgebrochen-dunkel-1280');
  await oeffnen(pruefprojekt('Testdaten · Ausgabedatei und behandelter Fehler'), 'Teilergebnis');
  await bereich('Läufe');
  await modus('ausfuehren');
  const teil = await starten('Workflow ausführen');
  assert.equal(teil.phase, 'mit_fehlern');
  assert.ok((await readFile(join(basis, 'Testdaten-Ergebnis.csv'), 'utf8')).includes('Nord'));
  await bereich('Ergebnisse');
  await bild('lauf-teilergebnis-dunkel-1280');
  await thema('hell');
  await bild('lauf-teilergebnis-hell-1280');
  await bereich('Protokoll');
  await bild('lauf-protokoll-hell-1280');
  const unvollstaendig = pruefprojekt('Testdaten · Fehlende Tabellenzuordnung');
  const ausgabe = unvollstaendig.editor.blocks.blocks[0].next.block.next.block;
  const konfiguration = JSON.parse(ausgabe.data);
  konfiguration.eingaben = {};
  ausgabe.data = JSON.stringify(konfiguration);
  await oeffnen(unvollstaendig, 'Fehlende-Zuordnung');
  await bereich('Daten und Parameter');
  await seite.getByRole('tab', { name: 'Quellen und Zuordnung', exact: true }).click();
  await seite.getByRole('button', { name: /Testdaten als CSV speichern/ }).click();
  await bild('daten-fehlende-zuordnung-hell-1280');
  await thema('dunkel');
  await bild('daten-fehlende-zuordnung-dunkel-1280');
  await seite.getByLabel('Tabelle', { exact: true }).selectOption('qa-lesen');
  await expect(seite.locator('.daten-konfigurationsfehler')).toHaveCount(0);
  const korrigiert = await seite.evaluate(async () => (await window.scriptlab.laden()).wert.dokument.projekt);
  const cfg = JSON.parse(korrigiert.editor.blocks.blocks[0].next.block.next.block.data);
  assert.equal(cfg.eingaben.tabelle.referenz, 'qa-lesen');
  await bild('daten-zuordnung-korrigiert-dunkel-1280');
  await writeFile(
    join(ziel, 'laufzustaende-pruefung.json'),
    JSON.stringify(
      {
        laufend: { laufId: laufend.laufId, modus: laufend.optionen.business.modus },
        abbruch: 'abgebrochen',
        teil: { laufId: teil.laufId, phase: teil.phase, bericht: teil.business.bericht },
        zuordnungKorrigiert: cfg.eingaben.tabelle.referenz,
        umgebung: await app.evaluate(({ screen, BrowserWindow }) => ({
          displays: screen
            .getAllDisplays()
            .map((d) => ({ id: d.id, scaleFactor: d.scaleFactor, bounds: d.bounds })),
          fenster: BrowserWindow.getAllWindows()[0].getContentSize(),
        })),
      },
      null,
      2,
    ),
  );
  const monitorwechsel = await app.evaluate(({ screen, BrowserWindow }) => {
    const fenster = BrowserWindow.getAllWindows()[0];
    const vorher = screen.getDisplayMatching(fenster.getBounds());
    const zweiter = screen.getAllDisplays().find((d) => d.id !== vorher.id);
    if (!zweiter) return { durchgefuehrt: false, grund: 'Nur ein Monitor verfügbar' };
    fenster.setPosition(zweiter.workArea.x + 40, zweiter.workArea.y + 40);
    return {
      durchgefuehrt: true,
      von: vorher.id,
      nach: zweiter.id,
      skalierungVorher: vorher.scaleFactor,
      skalierungNachher: zweiter.scaleFactor,
    };
  });
  if (monitorwechsel.durchgefuehrt)
    await expect
      .poll(() =>
        app.evaluate(
          ({ screen, BrowserWindow }) =>
            screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).id,
        ),
      )
      .toBe(monitorwechsel.nach);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()))
    .toBe(true);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()))
    .toBe(false);
  await writeFile(
    join(ziel, 'fenster-pruefung.json'),
    JSON.stringify({ monitorwechsel, maximieren: true, wiederherstellen: true }, null, 2),
  );
  assert.deepEqual(fehler, []);
  await writeFile(
    join(ziel, 'business-pruefung.json'),
    JSON.stringify(
      {
        basis,
        profil,
        pruefung: { phase: pruefung.phase, laufId: pruefung.laufId, modus: pruefung.optionen.business.modus },
        vorschau: {
          phase: vorschau.phase,
          laufId: vorschau.laufId,
          zeilen: vorschau.business.vorschau.zeilen.length,
        },
        rendererfehler: fehler,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ basis, profil, ziel }));
} finally {
  if (!process.argv.includes('--offen')) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
if (process.argv.includes('--offen')) await new Promise(() => {});
