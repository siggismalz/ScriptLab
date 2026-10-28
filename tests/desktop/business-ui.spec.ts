import {
  workflowBefehl,
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
  startseiteWaehlen,
} from './ansichten';
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { sprachwahlBestaetigen } from './sprache';
test('Business: CSV über Palette konfigurieren, speichern, Vorschau und echten Lauf verwenden', async () => {
  test.setTimeout(90000);
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Business-UI-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  const installation = JSON.parse(
    await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
  ).installation;
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      automatischeUpdates: false,
      vorabversionen: false,
      letzteSkriptsprache: null,
      pythonInterpreter: installation.pfad,
    }),
  );
  await writeFile(
    join(ordner, 'quelle.csv'),
    'Nummer;Region;Betrag\r\n001;Nord;100\r\n002;Süd;80\r\n',
    'utf8',
  );
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(seite, 'python');
    await expect(seite.getByTestId('editor-sprache')).toHaveText('Python');
    await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
    const palette = seite.getByTestId('palette');
    await palette.getByLabel('Bausteine suchen').fill('CSV-Tabelle lesen');
    await palette.getByRole('button', { name: 'Baustein einfügen: CSV-Tabelle lesen', exact: true }).click();
    await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    const eig = seite.getByTestId('eigenschaften-panel');
    await eig.getByLabel('Dateipfad', { exact: true }).fill('quelle.csv');
    await eig.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
    await palette.getByLabel('Bausteine suchen').fill('Tabelle als CSV');
    await palette
      .getByRole('button', { name: 'Baustein einfügen: Tabelle als CSV speichern', exact: true })
      .click();
    await palette.getByRole('button', { name: 'Nach „CSV-Tabelle lesen“', exact: true }).click();
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    await eig.getByLabel('Dateipfad', { exact: true }).fill('ausgabe.csv');
    const tabellenwahl = eig.getByLabel('tabelle: Ergebnis vom Typ Tabelle');
    await tabellenwahl.selectOption(
      (await tabellenwahl.locator('option').filter({ hasText: 'CSV-Tabelle lesen' }).getAttribute('value'))!,
    );
    await eig.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
    const projektdatei = join(ordner, 'CSV.scriptlab');
    await app.evaluate(({ dialog }, datei) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: datei });
    }, projektdatei);
    await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect
      .poll(async () =>
        readFile(projektdatei, 'utf8').then(
          (t) => JSON.parse(t).schemaVersion,
          () => null,
        ),
      )
      .toBe(3);
    await laufansichtWaehlen(seite, 'Vorbereitung');
    const panel = seite.getByTestId('test-panel');
    await app.evaluate(({ dialog }, ordner) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ordner] });
    }, ordner);
    await panel.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
    await panel.getByLabel('Modus', { exact: true }).selectOption('vorschau');
    await expect(panel.locator('.lauf-zeitlimit > summary')).toContainText('15 s');
    await laufStarten(seite);
    await expect
      .poll(
        async () => {
          const r = await seite.evaluate(() => window.scriptlab.testLesen());
          return r.ok ? r.wert.zustand.phase : null;
        },
        { timeout: 20000 },
      )
      .toBe('beendet');
    await laufansichtWaehlen(seite, 'Ergebnisse');
    await expect(panel.getByRole('table').first()).toBeVisible({ timeout: 20000 });
    await expect(panel.getByRole('cell', { name: '001', exact: true })).toBeVisible();
    await expect(readFile(join(ordner, 'ausgabe.csv'))).rejects.toThrow();
    await expect(panel.getByText('Lauf beendet', { exact: true })).toBeVisible();
    await panel.locator('.testbereich-inhalt').evaluate((e) => (e.scrollTop = 0));
    await seite.screenshot({ path: resolve('artifacts/business-ui-1280.png') });
    await laufansichtWaehlen(seite, 'Vorbereitung');
    await panel.getByLabel('Modus', { exact: true }).selectOption('prueflauf');
    await expect(panel.locator('.lauf-zeitlimit > summary')).toContainText('60 s');
    await laufStarten(seite);
    await expect
      .poll(
        async () => {
          const r = await seite.evaluate(() => window.scriptlab.testLesen());
          return r.ok ? r.wert.zustand.phase : null;
        },
        { timeout: 20000 },
      )
      .toBe('beendet');
    const prueflauf = await seite.evaluate(() => window.scriptlab.testLesen());
    expect(prueflauf.ok && prueflauf.wert.zustand.optionen).toMatchObject({
      zeitlimitSekunden: 60,
      business: { modus: 'prueflauf' },
    });
    await expect(readFile(join(ordner, 'ausgabe.csv'))).rejects.toThrow();
    await laufansichtWaehlen(seite, 'Vorbereitung');
    await panel.getByLabel('Modus', { exact: true }).selectOption('ausfuehren');
    await expect(panel.locator('.lauf-zeitlimit > summary')).toContainText('7200 s');
    await laufStarten(seite);
    await expect
      .poll(async () => await readFile(join(ordner, 'ausgabe.csv'), 'utf8').catch(() => ''), {
        timeout: 20000,
      })
      .toContain('001');
    await expect
      .poll(
        async () => {
          const r = await seite.evaluate(() => window.scriptlab.testLesen());
          return r.ok ? r.wert.zustand.phase : null;
        },
        { timeout: 20000 },
      )
      .toBe('beendet');
    const paket = join(ordner, 'CSV-Testdaten-Business.zip');
    await app.evaluate(({ dialog }, ziel) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
    }, paket);
    await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
    const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
    await expect(exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true })).toHaveValue('paket');
    await expect(exportdialog).toContainText('Business-Laufzeit');
    await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
    await expect
      .poll(async () => (await readFile(paket).catch(() => Buffer.alloc(0))).subarray(0, 4).toString('hex'), {
        timeout: 10000,
      })
      .toBe('504b0304');
  } finally {
    await seite
      .evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (r.ok && r.wert.zustand.laufId) await window.scriptlab.testStoppen(r.wert.zustand.laufId);
      })
      .catch(() => {});
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
