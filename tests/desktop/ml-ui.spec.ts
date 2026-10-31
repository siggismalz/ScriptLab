import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument, Einstellungen } from '../../src/gemeinsam/bruecke';
import { workflowBefehl, einstellungenOeffnen, feldEinblenden } from './ansichten';

const bilder = resolve('artifacts/ml-bedienung');

async function dokument(seite: Page): Promise<Dokument> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
}

async function keinLauf(seite: Page) {
  const r = await seite.evaluate(() => window.scriptlab.testLesen());
  expect(r.ok && r.wert.zustand.laufId).toBeNull();
}

for (const farbe of ['hell', 'dunkel'] as const) {
  for (const skala of [1, 2] as const) {
    test(`ML bewusst anlegen, konfigurieren und ohne CPU-Paket speichern (${farbe}, ${100 * skala} % Text)`, async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-ML-Bedienung-'));
      let app: ElectronApplication | undefined;
      try {
        const profil = join(ordner, 'Profil');
        await mkdir(profil);
        const einstellungen: Einstellungen = {
          darstellung: farbe,
          textSkalierung: skala,
          automatischeUpdates: false,
          vorabversionen: false,
          letzteSkriptsprache: null,
          pythonInterpreter: null,
          palettenBreite: 272,
          paletteEingeklappt: false,
          eigenschaftenAngeheftet: false,
        };
        await writeFile(join(profil, 'einstellungen.json'), JSON.stringify(einstellungen));
        app = await electron.launch({
          args: [resolve('.'), '--force-device-scale-factor=1'],
          cwd: ordner,
          env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
        });
        const seite = await app.firstWindow();
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
        await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
        await expect(seite.locator('.anwendung')).toHaveCSS('font-size', `${14 * skala}px`);
        await expect
          .poll(() => seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
          .toBe(farbe === 'hell' ? 'light' : 'dark');
        expect(await seite.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, 720]);
        const vorher = await dokument(seite);
        await workflowBefehl(seite, 'neu');
        const dialog = seite.getByRole('dialog', { name: 'Neuer Workflow', exact: true });
        await expect(dialog.getByRole('radio')).toHaveCount(3);
        const ml = dialog.getByRole('radio', { name: 'Machine Learning', exact: true });
        await dialog.getByRole('radio', { name: 'Automatisierung', exact: true }).focus();
        await seite.keyboard.press('ArrowRight');
        await expect(
          dialog.getByRole('radio', { name: 'Windows-Automatisierung', exact: true }),
        ).toBeChecked();
        await seite.keyboard.press('ArrowRight');
        await expect(ml).toBeFocused();
        await expect(ml).toBeChecked();
        expect((await dokument(seite)).projektKennung).toBe(vorher.projektKennung);
        await keinLauf(seite);
        await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect((await dokument(seite)).projekt).toEqual(vorher.projekt);
        await workflowBefehl(seite, 'neu');
        await expect(ml).not.toBeChecked();
        await ml.check();
        await mkdir(bilder, { recursive: true });
        await seite.screenshot({ path: join(bilder, `workflowwahl-${farbe}-${100 * skala}.png`) });
        await dialog.getByRole('button', { name: 'Workflow erstellen', exact: true }).click();
        await expect.poll(async () => (await dokument(seite)).projekt.workflowArt).toBe('ml');
        await expect.poll(async () => (await dokument(seite)).darstellungNoetig).toBe(false);
        expect((await dokument(seite)).projekt.skriptsprache).toBe('python');
        const palette = seite.getByTestId('palette');
        await palette.getByRole('button', { name: 'Modelle und Vorhersagen', exact: true }).click();
        for (const name of ['Modell trainieren', 'Modell speichern', 'Modell laden', 'Vorhersagen erzeugen'])
          await expect(
            palette.getByRole('button', { name: `Baustein einfügen: ${name}`, exact: true }),
          ).toBeVisible();
        await expect(palette.getByRole('button', { name: /^Baustein einfügen:/ })).toHaveCount(4);
        await palette
          .getByRole('button', { name: 'Baustein einfügen: Modell trainieren', exact: true })
          .click();
        await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
        await expect
          .poll(async () => (await dokument(seite)).projekt.editor.blocks!.blocks[0].next?.block.type)
          .toBe('sl_biz_ml_train');
        const blockId = (await dokument(seite)).projekt.editor.blocks!.blocks[0].next!.block.id;
        await seite.locator(`g[data-id="${blockId}"]`).click({ position: { x: 60, y: 18 } });
        if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
          await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
        const eigenschaften = seite.getByTestId('eigenschaften-panel');
        await expect(eigenschaften.getByRole('combobox', { name: 'Aufgabe', exact: true })).toHaveValue(
          'KLASSIFIKATION',
        );
        await eigenschaften
          .getByRole('combobox', { name: 'Modellverfahren', exact: true })
          .selectOption('PYTORCH');
        await eigenschaften
          .getByRole('combobox', { name: 'Aufgabe', exact: true })
          .selectOption('REGRESSION');
        await eigenschaften
          .getByRole('textbox', { name: 'Vorherzusagende Spalte', exact: true })
          .fill('Zielwert für die monatliche Außenstellenprognose');
        const epochen = eigenschaften.getByRole('spinbutton', {
          name: 'Trainingsepochen des neuronalen Netzes',
          exact: true,
          includeHidden: true,
        });
        await expect(epochen).not.toBeVisible();
        await feldEinblenden(epochen);
        await expect(epochen).toBeVisible();
        await expect(epochen).toHaveValue('50');
        await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
        const mlStand = await dokument(seite);
        await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
        await expect.poll(async () => (await dokument(seite)).geaendert).toBe(false);
        const exportpfad = join(ordner, 'Mein ML-Workflow.scriptlab');
        await app.evaluate(({ dialog }, pfad) => {
          dialog.showSaveDialog = async () => ({ canceled: false, filePath: pfad });
        }, exportpfad);
        await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
        const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
        await exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true }).selectOption('projekt');
        await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
        await expect
          .poll(() =>
            stat(exportpfad)
              .then(() => true)
              .catch(() => false),
          )
          .toBe(true);
        const exportiert = JSON.parse(await readFile(exportpfad, 'utf8'));
        expect(exportiert.workflowArt).toBe('ml');
        expect(exportiert.skriptsprache).toBe('python');
        expect(exportiert.editor).toEqual(mlStand.projekt.editor);
        await keinLauf(seite);

        const einstellungsdialog = await einstellungenOeffnen(seite);
        await einstellungsdialog.getByRole('tab', { name: 'Automatisierungen', exact: true }).click();
        const laufzeit = einstellungsdialog.getByRole('region', {
          name: 'Machine Learning',
          exact: true,
        });
        await expect(laufzeit).toContainText(
          'Bearbeiten, Speichern und Exportieren sind auch ohne Einrichtung möglich',
        );
        const cpu = laufzeit.getByRole('button', { name: 'Online einrichten', exact: true });
        await expect(cpu).toBeEnabled();
        await laufzeit.getByRole('button', { name: 'Verfügbarkeit prüfen', exact: true }).focus();
        await seite.keyboard.press('Tab');
        await expect(cpu).toBeFocused();
        const paketstand = await seite.evaluate(() => window.scriptlab.mlLesen());
        expect(paketstand.ok && paketstand.wert.aktiv).toBe(false);
        expect(paketstand.ok && paketstand.wert.status?.installation).toBeFalsy();
        await seite.screenshot({ path: join(bilder, `laufzeit-${farbe}-${100 * skala}.png`) });
        expect(await einstellungsdialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        await einstellungsdialog.getByRole('button', { name: 'Fertig', exact: true }).click();
        expect((await dokument(seite)).projekt.editor).toEqual(mlStand.projekt.editor);
        await keinLauf(seite);

        for (const sprache of ['python', 'vbs'] as const) {
          const alteKennung = (await dokument(seite)).projektKennung;
          await workflowBefehl(seite, 'neu');
          await dialog
            .getByRole('radio', {
              name: sprache === 'python' ? 'Automatisierung' : 'Windows-Automatisierung',
              exact: true,
            })
            .check();
          await dialog.getByRole('button', { name: 'Workflow erstellen', exact: true }).click();
          await expect
            .poll(async () => {
              const d = await dokument(seite);
              return {
                sprache: d.projekt.skriptsprache,
                art: d.projekt.workflowArt,
                neu: d.projektKennung !== alteKennung,
                bereit: !d.darstellungNoetig,
              };
            })
            .toEqual({ sprache, art: 'allgemein', neu: true, bereit: true });
          expect((await dokument(seite)).projekt.workflowArt).toBe('allgemein');
          await palette
            .getByRole('searchbox', { name: 'Bausteine suchen', exact: true })
            .fill('Modell trainieren');
          await expect(palette.getByRole('status')).toHaveText('Keine Bausteine gefunden');
          await expect(
            palette.getByRole('button', { name: 'Baustein einfügen: Modell trainieren', exact: true }),
          ).toHaveCount(0);
          await palette.getByRole('button', { name: 'Suche leeren', exact: true }).click();
          await expect(palette.getByRole('button', { name: 'Ablauf steuern', exact: true })).toBeVisible();
          await keinLauf(seite);
        }
      } finally {
        if (app && app.process().exitCode === null && app.process().signalCode === null) {
          const geschlossen = app.waitForEvent('close');
          await Promise.all([geschlossen, app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
        }
        const ziel = resolve(ordner);
        if (
          !ziel.startsWith(resolve(tmpdir()) + sep) ||
          !basename(ziel).startsWith('ScriptLab-ML-Bedienung-')
        )
          throw Error('Unsicherer Testordner.');
        await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    });
  }
}
