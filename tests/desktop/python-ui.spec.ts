import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { sprachwahlBestaetigen } from './sprache';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
}
async function starten(): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Python-UI-'));
  const profil = join(ordner, 'Profil');
  if (process.env.SCRIPTLAB_TEST_PYTHON) {
    // Gewöhnliche lokale Einstellungen im isolierten Profil; kein Interpreter-Envzugriff im Produkt.
    await mkdir(profil);
    await writeFile(
      join(profil, 'einstellungen.json'),
      JSON.stringify({
        automatischeUpdates: false,
        vorabversionen: false,
        letzteSkriptsprache: null,
        pythonInterpreter: process.env.SCRIPTLAB_TEST_PYTHON,
      }),
    );
  }
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  return { app, seite, ordner };
}
async function beenden(s: Sitzung) {
  await s.seite
    .evaluate(async () => {
      const r = await window.scriptlab.testLesen();
      if (
        r.ok &&
        r.wert.zustand.laufId &&
        ['vorbereitung', 'laeuft', 'stoppt'].includes(r.wert.zustand.phase)
      )
        await window.scriptlab.testStoppen(r.wert.zustand.laufId);
    })
    .catch(() => {});
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  const ziel = resolve(s.ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Python-UI-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
async function dokument(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert;
  });
}
async function editorBereit(seite: Page) {
  await expect.poll(async () => !(await dokument(seite)).dokument.darstellungNoetig).toBe(true);
  await expect(seite.getByRole('button', { name: 'Neu', exact: true })).toBeEnabled();
}
async function einstellungen(seite: Page) {
  await seite.getByRole('button', { name: 'Weitere Funktionen', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  return seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
}

test('Python: ausdrückliche Sprachwahl, stabiler Projekt-Rundlauf, Export und tatsächlicher Laufzeitstatus', async () => {
  const s = await starten();
  try {
    const { seite } = s;
    const vorher = (await dokument(seite)).dokument;
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    const wahl = seite.getByRole('dialog', { name: 'Welche Sprache möchtest du verwenden?', exact: true });
    await expect(wahl.getByRole('radiogroup', { name: 'Skriptsprache', exact: true })).toBeVisible();
    await expect(wahl.getByRole('radio', { name: 'Python', exact: true })).not.toBeChecked();
    await expect(wahl.getByRole('radio', { name: 'VBScript (VBS)', exact: true })).not.toBeChecked();
    await expect(wahl.getByRole('button', { name: 'Workflow erstellen', exact: true })).toBeDisabled();
    await expect(wahl.getByText('Wähle zuerst Python oder VBScript (VBS).')).toBeVisible();
    await wahl.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    expect((await dokument(seite)).dokument).toEqual(vorher);
    expect((await dokument(seite)).einstellungen.letzteSkriptsprache).toBeNull();

    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(seite, 'python');
    await editorBereit(seite);
    await expect(seite.getByTestId('editor-sprache')).toHaveText('Python');
    await expect(seite.getByRole('button', { name: 'Python-Script exportieren', exact: true })).toBeVisible();
    expect((await dokument(seite)).dokument.projekt.skriptsprache).toBe('python');
    expect((await dokument(seite)).einstellungen.letzteSkriptsprache).toBe('python');

    await seite.getByRole('searchbox', { name: 'Bausteine suchen', exact: true }).fill('Text ausgeben');
    await seite.getByRole('button', { name: 'Baustein einfügen: Text ausgeben', exact: true }).click();
    await seite.getByRole('button', { name: /Nach.*Workflow starten/ }).click();
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    const eigenschaften = seite.getByTestId('eigenschaften-panel');
    await eigenschaften
      .getByRole('textbox', { name: 'Text', exact: true })
      .fill('Klare Python-Testausgabe ä');
    await eigenschaften.getByRole('textbox', { name: 'Text', exact: true }).press('Tab');
    await eigenschaften.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
    await seite.getByRole('button', { name: 'Codevorschau', exact: true }).click();
    await expect(seite.getByRole('heading', { name: 'Python-Code', exact: true })).toBeVisible();
    const vorschau = seite.getByLabel('Schreibgeschützter Python-Code', { exact: true });
    await expect(vorschau).toContainText('Klare Python-Testausgabe');

    const projektdatei = join(s.ordner, 'Python-Projekt.scriptlab');
    await s.app.evaluate(({ dialog }, datei) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: datei });
    }, projektdatei);
    await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
    const gespeichert = JSON.parse(await readFile(projektdatei, 'utf8'));
    expect(gespeichert).toMatchObject({ schemaVersion: 2, skriptsprache: 'python' });
    const exportdatei = join(s.ordner, 'Python-Export.py');
    await s.app.evaluate(({ dialog }, datei) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: datei });
    }, exportdatei);
    await seite.getByRole('button', { name: 'Python-Script exportieren', exact: true }).click();
    await expect(seite.getByRole('heading', { name: 'Script gespeichert', exact: true })).toBeVisible();
    expect(await readFile(exportdatei, 'utf8')).toBe(await vorschau.textContent());

    const pythonKonfiguration = await einstellungen(seite);
    await expect(
      pythonKonfiguration.getByRole('heading', { name: 'Signatur für dieses Projekt', exact: true }),
    ).toHaveCount(0);
    await expect(
      pythonKonfiguration.getByRole('button', { name: 'Interpreter auswählen', exact: true }),
    ).toBeVisible();
    await pythonKonfiguration.getByRole('button', { name: 'Erneut prüfen', exact: true }).click();
    await expect(pythonKonfiguration.locator('#einstellungen-vorgang')).toHaveCount(0, { timeout: 20_000 });
    await expect(
      pythonKonfiguration.getByRole('button', { name: 'Erneut prüfen', exact: true }),
    ).toBeEnabled();
    await expect
      .poll(async () => {
        const r = await seite.evaluate(() => window.scriptlab.pythonStatus());
        return r.ok ? r.wert.zustand : 'fehler';
      })
      .not.toBe('prueft');
    const runtimeAntwort = await seite.evaluate(() => window.scriptlab.pythonStatus());
    if (!runtimeAntwort.ok) throw new Error(runtimeAntwort.meldung);
    const runtime = runtimeAntwort.wert;
    if (process.env.SCRIPTLAB_TEST_PYTHON) {
      expect(runtime.zustand, runtime.meldung).toBe('bereit');
      expect(await realpath(runtime.installation!.pfad)).toBe(
        await realpath(process.env.SCRIPTLAB_TEST_PYTHON),
      );
      if (process.env.SCRIPTLAB_TEST_PYTHON_VERSION)
        expect(runtime.installation!.version).toBe(process.env.SCRIPTLAB_TEST_PYTHON_VERSION);
    }
    await expect(pythonKonfiguration.getByText(runtime.meldung, { exact: true })).toBeVisible();
    if (runtime.zustand === 'bereit') {
      expect(runtime.installation).not.toBeNull();
      await expect(
        pythonKonfiguration.getByText(`CPython ${runtime.installation!.version} · x64`, { exact: true }),
      ).toBeVisible();
    }
    await pythonKonfiguration.getByRole('button', { name: 'Dialog schließen', exact: true }).click();

    // Ein Neuversuch verändert die Sprache des bestehenden Projekts nicht beim bloßen Öffnen/Abbrechen.
    await seite.getByRole('button', { name: 'Neu', exact: true }).click();
    await expect(wahl.getByRole('radio', { name: 'Python', exact: true })).toBeChecked();
    await wahl.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    expect((await dokument(seite)).dokument.projekt.projektKennung).toBe(gespeichert.projektKennung);
    await expect(seite.getByTestId('editor-sprache')).toHaveText('Python');
    await seite.getByRole('button', { name: 'Neu', exact: true }).click();
    await sprachwahlBestaetigen(seite, 'vbs');
    await editorBereit(seite);
    await expect(seite.getByTestId('editor-sprache')).toHaveText('VBScript (VBS)');
    await expect(seite.getByRole('button', { name: 'VBS-Script exportieren', exact: true })).toBeVisible();
    const vbsKonfiguration = await einstellungen(seite);
    await expect(
      vbsKonfiguration.getByRole('heading', { name: 'Signatur für dieses Projekt', exact: true }),
    ).toBeVisible();
    await vbsKonfiguration.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
    // Gültige Python-Projekte dürfen gespeicherte, für sie nicht verwendete VBS-Optionen enthalten.
    gespeichert.exportOptionen.zeitstempelUrl = 'https://zeitstempel.example.test/';
    await writeFile(projektdatei, JSON.stringify(gespeichert), 'utf8');
    await s.app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    }, projektdatei);
    await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect.poll(async () => (await dokument(seite)).dokument.projekt.skriptsprache).toBe('python');
    await editorBereit(seite);
    expect((await dokument(seite)).dokument.projekt.skriptsprache).toBe('python');
    const ohneSignaturfelder = await einstellungen(seite);
    await expect(
      ohneSignaturfelder.getByRole('heading', { name: 'Signatur für dieses Projekt', exact: true }),
    ).toHaveCount(0);
    await ohneSignaturfelder.getByRole('button', { name: 'Fertig', exact: true }).click();
    await expect(ohneSignaturfelder).not.toBeVisible();
    expect((await dokument(seite)).dokument.projekt.exportOptionen.zeitstempelUrl).toBe(
      'https://zeitstempel.example.test/',
    );

    if (runtime.zustand === 'bereit') {
      const basis = join(s.ordner, 'Basis');
      await mkdir(basis);
      await seite.getByRole('button', { name: 'Testausgabe', exact: true }).click();
      const panel = seite.getByTestId('test-panel');
      await s.app.evaluate(({ dialog }, pfad) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
      }, basis);
      await panel.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
      await panel.getByRole('spinbutton', { name: 'Zeitlimit in Sekunden', exact: true }).fill('10');
      await panel.getByRole('spinbutton', { name: 'Zeitlimit in Sekunden', exact: true }).press('Tab');
      await seite.getByRole('button', { name: 'Testen', exact: true }).click();
      await expect
        .poll(
          async () => {
            const r = await seite.evaluate(() => window.scriptlab.testLesen());
            return r.ok ? r.wert.zustand.phase : 'fehler';
          },
          { timeout: 20_000 },
        )
        .toBe('beendet');
      await expect(panel.getByRole('log', { name: 'Testausgabe', exact: true })).toContainText(
        'Klare Python-Testausgabe ä',
      );
      const r = await seite.evaluate(() => window.scriptlab.testLesen());
      expect(r.ok && r.wert.zustand.skriptsprache).toBe('python');
      expect(r.ok && r.wert.zustand.pythonVersion).toBe(runtime.installation!.version);
    } else
      test.info().annotations.push({
        type: 'Python-Runtime nicht geprüft',
        description: `Bearbeiten/Export geprüft; tatsächlicher Status ${runtime.zustand}: ${runtime.meldung}`,
      });
    await mkdir('artifacts/python', { recursive: true });
    await seite.screenshot({ path: 'artifacts/python/python-editor-und-test.png' });
  } finally {
    await beenden(s);
  }
});

test('Sprachwahl: gleichgewichtige Radiokarten, Tastatur und große UI-Schrift ohne äußere Überbreite', async () => {
  const s = await starten();
  try {
    const { seite } = s;
    await seite.getByRole('button', { name: 'Einstellungen', exact: true }).click();
    const einstellungen = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
    await einstellungen
      .getByRole('combobox', { name: 'UI-Textgröße', exact: true })
      .selectOption({ label: '200 %' });
    await einstellungen.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
    for (const breite of [1280, 850]) {
      await s.app.evaluate(
        ({ BrowserWindow }, wert) => BrowserWindow.getAllWindows()[0].setContentSize(wert, 720),
        breite,
      );
      await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
      const wahl = seite.getByRole('dialog', { name: 'Welche Sprache möchtest du verwenden?', exact: true });
      const python = wahl.getByRole('radio', { name: 'Python', exact: true });
      const vbs = wahl.getByRole('radio', { name: 'VBScript (VBS)', exact: true });
      await expect(python).not.toBeChecked();
      await expect(vbs).not.toBeChecked();
      await python.focus();
      await python.press('Space');
      await expect(python).toBeChecked();
      await python.press('ArrowDown');
      await expect(vbs).toBeChecked();
      await expect(python).not.toBeChecked();
      await expect(wahl.getByRole('button', { name: 'Workflow erstellen', exact: true })).toBeEnabled();
      const rahmen = await wahl.locator('.sprachwahl-karte').evaluateAll((karten) =>
        karten.map((karte) => ({
          breite: karte.getBoundingClientRect().width,
          oben: karte.getBoundingClientRect().top,
          text: karte.textContent,
        })),
      );
      expect(Math.abs(rahmen[0].breite - rahmen[1].breite)).toBeLessThanOrEqual(1);
      if (breite < 900) expect(rahmen[1].oben).toBeGreaterThan(rahmen[0].oben);
      else expect(Math.abs(rahmen[0].oben - rahmen[1].oben)).toBeLessThanOrEqual(1);
      const geometrie = await seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        dpr: devicePixelRatio,
        scrollBreite: document.documentElement.scrollWidth,
        dialogScroll: document.querySelector('dialog[open] .sl-dialog-inhalt')!.scrollHeight,
      }));
      expect(geometrie.scrollBreite).toBeLessThanOrEqual(geometrie.breite + 1);
      await mkdir('artifacts/python', { recursive: true });
      await seite.screenshot({
        path: `artifacts/python/sprachwahl-${breite}-text-200.png`,
        animations: 'disabled',
      });
      await writeFile(
        `artifacts/python/sprachwahl-${breite}-text-200.json`,
        JSON.stringify({ geometrie, rahmen }, null, 2),
        'utf8',
      );
      await wahl.getByRole('button', { name: 'Abbrechen', exact: true }).click();
      await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeFocused();
      expect((await dokument(seite)).einstellungen.letzteSkriptsprache).toBeNull();
    }
  } finally {
    await beenden(s);
  }
});
