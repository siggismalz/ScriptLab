import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

// Eigene synthetische Daten; echte lokale Läufe. Keine Nutzerdokumente oder vorhandenen Profile.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Weiterentwicklung-'));
const profil = join(ordner, 'Profil');
const ziel = resolve('docs/weiterentwicklung');
await mkdir(profil);
await mkdir(ziel, { recursive: true });
const installation = JSON.parse(
  await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
).installation;
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, vorabversionen: false, pythonInterpreter: installation.pfad }),
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
projekt.business.parametersaetze.test.PDF_Ziel = 'Monatsauswertung.pdf';
const quelle = join(ordner, 'Import.scriptlab');
await writeFile(quelle, JSON.stringify(projekt));
const quellinhalt = await readFile(quelle, 'utf8');
let app, seite;
const rendererfehler = [];
async function starten() {
  app = await electron.launch({ args: [resolve('.')], env: { ...process.env, SCRIPTLAB_TESTDATEN: profil } });
  seite = await app.firstWindow();
  seite.on('pageerror', (e) => rendererfehler.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  await app.evaluate(({ dialog, shell }) => {
    globalThis.speicherdialoge = 0;
    globalThis.explorerpfade = [];
    dialog.showSaveDialog = async () => {
      globalThis.speicherdialoge++;
      throw Error('Unerwarteter Speicherortdialog');
    };
    shell.showItemInFolder = (pfad) => globalThis.explorerpfade.push(pfad);
  });
}
async function bild(name) {
  await seite.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
  await seite.waitForTimeout(150);
  await seite.screenshot({ path: join(ziel, `${name}.png`) });
}
async function bereich(name) {
  await seite
    .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
}
async function lauf(modus, knopf) {
  await seite.getByLabel('Modus', { exact: true }).selectOption(modus);
  const vorher = (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId;
  await seite.getByRole('button', { name: knopf, exact: true }).click();
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand.laufId)
    .not.toBe(vorher);
  await expect
    .poll(
      async () => {
        const r = await seite.evaluate(() => window.scriptlab.testLesen());
        return r.ok ? r.wert.zustand.phase : 'fehler';
      },
      { timeout: 30000 },
    )
    .toMatch(/^(beendet|mit_fehlern|fehlgeschlagen|abgebrochen|zeitlimit)$/);
  return (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
}
try {
  await starten();
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, quelle);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect
    .poll(async () => (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument.geaendert)
    .toBe(false);
  const gespeichert = (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
  assert.equal(await app.evaluate(() => globalThis.speicherdialoge), 0);
  assert.equal(await readFile(quelle, 'utf8'), quellinhalt);
  assert.ok(await readFile(join(profil, 'Workflows', `${gespeichert.projektKennung}.scriptlab`), 'utf8'));
  await bild('workflow-intern-gespeichert');
  await bereich('Läufe');
  await expect(seite.getByRole('button', { name: 'Ordner auswählen', exact: true })).toHaveCount(0);
  await bild('laufvorbereitung-automatischer-ordner');
  const pruefung = await lauf('prueflauf', 'Prüflauf starten');
  assert.equal(pruefung.phase, 'beendet');
  await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  const ausfuehrung = await lauf('ausfuehren', 'Workflow ausführen');
  assert.equal(ausfuehrung.phase, 'beendet');
  const liste = await seite.evaluate(() => window.scriptlab.laufListe());
  assert.equal(liste.wert.eintraege.length, 2);
  assert.equal(
    ausfuehrung.optionen.basisVerzeichnis,
    join(profil, 'Arbeitsdateien', gespeichert.projektKennung),
  );
  const dateien = ausfuehrung.business.bericht.ausgaben;
  for (const datei of dateien.filter((d) => d.status === 'publiziert'))
    assert.ok(datei.pfad.startsWith(profil));
  await app.evaluate(({ app }) => app.exit(0));
  await starten();
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).first().click();
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeVisible();
  await bereich('Läufe');
  await expect(seite.locator('.laufverwaltung-tabelle tbody tr')).toHaveCount(2);
  await bild('laufhistorie-nach-neustart-dunkel');
  await seite.locator('.laufverwaltung-tabelle tbody tr').first().getByRole('button').click();
  await seite.getByRole('tab', { name: 'Ergebnisse', exact: true }).click();
  await bild('gespeicherte-ergebnisse-dunkel');
  await seite
    .getByRole('button', { name: /^Im Explorer anzeigen:/ })
    .first()
    .click();
  await expect.poll(() => app.evaluate(() => globalThis.explorerpfade.length)).toBe(1);
  await seite.getByRole('tab', { name: 'Protokoll', exact: true }).click();
  const exportziel = join(ordner, 'Protokoll.txt');
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showSaveDialog = async () => {
      globalThis.speicherdialoge++;
      return { canceled: false, filePath: pfad };
    };
  }, exportziel);
  await seite.getByRole('button', { name: 'Protokoll exportieren', exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return (await readFile(exportziel, 'utf8')).length;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(0);
  await seite
    .getByRole('navigation', { name: 'Globale Navigation', exact: true })
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .click();
  await seite.getByLabel('Farbschema', { exact: true }).selectOption('hell');
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
  await seite.getByRole('button', { name: /^Alle Läufe/ }).click();
  await bild('laufhistorie-nach-neustart-hell');
  await seite.locator('.laufverwaltung-tabelle tbody tr').first().getByRole('button').click();
  await seite.getByRole('tab', { name: 'Ergebnisse', exact: true }).click();
  await bild('gespeicherte-ergebnisse-hell');
  await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await seite.getByLabel('Inhalt', { exact: true }).selectOption('projekt');
  await bild('projektdatei-exportieren');
  const exportprojekt = join(ordner, 'Export.scriptlab');
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showSaveDialog = async () => {
      globalThis.speicherdialoge++;
      return { canceled: false, filePath: pfad };
    };
  }, exportprojekt);
  await seite.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await readFile(exportprojekt, 'utf8')).projektKennung;
      } catch {
        return '';
      }
    })
    .toBe(gespeichert.projektKennung);
  assert.equal((await seite.evaluate(() => window.scriptlab.laden())).wert.dokument.geaendert, false);
  await bereich('Ablauf');
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Workflowparameter', exact: true }).click();
  await seite
    .getByLabel('Interner Name (Buchstaben, Zahlen, Unterstrich)', { exact: true })
    .first()
    .fill('QuelleNeu');
  await seite.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(seite.getByRole('dialog', { name: 'Workflowparameter', exact: true })).not.toBeVisible();
  async function parameterstand() {
    const p = (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument.projekt;
    return {
      name: p.business.parameter[0].name,
      verweis: JSON.parse(p.editor.blocks.blocks[0].next.block.data).konfiguration.pfad.parameter,
      wert: p.business.parametersaetze.test[p.business.parameter[0].name],
    };
  }
  await expect.poll(parameterstand).toEqual({
    name: 'QuelleNeu',
    verweis: 'QuelleNeu',
    wert: projekt.business.parametersaetze.test.Quelldatei,
  });
  // Der Parameterbefehl öffnet die Datenansicht; die Workflow-Werkzeuge liegen unter Ablauf.
  await bereich('Ablauf');
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(parameterstand).toEqual({
    name: 'Quelldatei',
    verweis: 'Quelldatei',
    wert: projekt.business.parametersaetze.test.Quelldatei,
  });
  await seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect.poll(parameterstand).toEqual({
    name: 'QuelleNeu',
    verweis: 'QuelleNeu',
    wert: projekt.business.parametersaetze.test.Quelldatei,
  });
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(parameterstand).toEqual({
    name: 'Quelldatei',
    verweis: 'Quelldatei',
    wert: projekt.business.parametersaetze.test.Quelldatei,
  });
  assert.equal(rendererfehler.length, 0);
  await writeFile(
    join(ziel, 'funktionsstand.json'),
    JSON.stringify(
      {
        datum: new Date().toISOString(),
        profil,
        workflow: gespeichert.projektKennung,
        projektspeicherungOhneDialog: true,
        externesOriginalUnveraendert: true,
        prueflauf: pruefung.phase,
        ausfuehrung: ausfuehrung.phase,
        laufIds: liste.wert.eintraege.map((e) => e.laufId),
        historieNachNeustart: 2,
        ausgabeordner: ausfuehrung.optionen.basisVerzeichnis,
        ausgaben: dateien,
        explorerpfade: await app.evaluate(() => globalThis.explorerpfade),
        protokollExportiert: true,
        projektExportiert: true,
        parameterUmbenanntUndRueckgaengig: true,
        rendererfehler,
      },
      null,
      2,
    ),
  );
  console.log(`Aktuelle Funktionsansichten gespeichert: ${ziel}`);
} catch (error) {
  await seite?.screenshot({ path: join(ziel, 'arbeitsweg-fehler.png') }).catch(() => {});
  console.log((await seite?.locator('body').innerText())?.slice(-5000));
  throw error;
} finally {
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
