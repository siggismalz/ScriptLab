import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt } from '../../src/kern/projekt';
import type { Dokument, Einstellungen } from '../../src/gemeinsam/bruecke';
import { arbeitsbereichWaehlen, workflowBefehl } from './ansichten';

const nachweise = resolve('artifacts/editorstruktur');
const projektname =
  'Monatliche Prüfung der synthetischen Geschäftsdaten für sämtliche Außenstellen – ungespeicherter Arbeitsstand';
const kommentar = 'Dieser synthetische Ablauf wartet nur. Er verändert keine Geschäftsdateien.';

async function dokument(seite: Page): Promise<Dokument> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
}

async function zustand(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand;
  });
}

async function imFenster(element: Locator) {
  await expect(element).toBeVisible();
  const b = await element.boundingBox();
  expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(1281);
  expect(b!.y + b!.height).toBeLessThanOrEqual(721);
  expect(await element.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
}

for (const farbe of ['hell', 'dunkel'] as const) {
  for (const skala of [1, 2] as const) {
    test(`Editorstruktur erhält Arbeitskontext und erreichbares Stoppen (${farbe}, ${100 * skala} % Text)`, async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Editorstruktur-'));
      let app: ElectronApplication | undefined;
      let seite: Page | undefined;
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
        const projekt = neuesProjekt('python');
        projekt.name = projektname;
        projekt.editor.blocks!.blocks[0].next = {
          block: {
            type: 'sl_comment',
            id: 'struktur-kommentar',
            fields: { TEXT: kommentar },
            next: {
              block: {
                type: 'sl_sleep',
                id: 'struktur-warten',
                inputs: {
                  SEKUNDEN: { block: { type: 'sl_number', id: 'struktur-sekunden', fields: { ZAHL: '20' } } },
                },
              },
            },
          },
        };
        const quelle = join(ordner, 'Synthetischer Ablauf.scriptlab');
        const original = JSON.stringify(projekt);
        await writeFile(quelle, original);
        app = await electron.launch({
          args: [resolve('.'), '--force-device-scale-factor=1'],
          cwd: ordner,
          env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
        });
        seite = await app.firstWindow();
        const page = seite;
        await app.evaluate(({ BrowserWindow, dialog }, ziel) => {
          BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ziel] });
        }, quelle);
        await expect(page.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
        await workflowBefehl(page, 'oeffnen');
        await expect.poll(async () => (await dokument(page)).darstellungNoetig).toBe(false);
        await expect(page.getByTestId('palette')).toBeVisible();
        await expect(page.locator('.anwendung')).toHaveCSS('font-size', `${14 * skala}px`);
        await expect
          .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
          .toBe(farbe === 'hell' ? 'light' : 'dark');
        const global = page.getByRole('navigation', { name: 'Globale Navigation', exact: true });
        for (const ziel of ['Start', 'Workflows', 'Vorlagen'])
          await imFenster(global.getByRole('button', { name: ziel, exact: true }));
        await expect(global.getByRole('button', { name: 'Workflows', exact: true })).toHaveAttribute(
          'aria-current',
          'location',
        );
        for (const ziel of ['Hilfe', 'Einstellungen'])
          await imFenster(global.getByRole('button', { name: ziel, exact: true }));
        await expect(page.getByRole('heading', { name: projektname, exact: true })).toHaveAttribute(
          'title',
          projektname,
        );
        for (const aktion of ['Speichern', 'Workflow ausführen', 'Exportieren'])
          await imFenster(page.getByRole('button', { name: aktion, exact: true }));

        const block = page.locator('g[data-id="struktur-kommentar"]');
        await block.click({ position: { x: 60, y: 18 } });
        await page.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
        const text = page
          .getByTestId('eigenschaften-panel')
          .getByRole('textbox', { name: 'Text', exact: true });
        await text.fill('Ungespeichert: Auswahl, Grüße und Arbeitsfläche bleiben erhalten.');
        await text.press('Tab');
        await expect
          .poll(async () => (await dokument(page)).projekt.editor.blocks!.blocks[0].next!.block.fields!.TEXT)
          .toBe('Ungespeichert: Auswahl, Grüße und Arbeitsfläche bleiben erhalten.');
        await page.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
        await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
        await expect.poll(async () => (await dokument(page)).projekt.ansicht.zoom).toBeGreaterThan(1);
        const vorher = await dokument(page);
        expect(vorher.geaendert).toBe(true);
        const canvas = page.getByTestId('arbeitsbereich');
        const budget = await canvas.boundingBox();
        expect(budget!.width).toBeGreaterThanOrEqual(600);
        expect(budget!.height).toBeGreaterThanOrEqual(skala === 1 ? 400 : 250);
        await mkdir(nachweise, { recursive: true });
        await writeFile(
          join(nachweise, `flaeche-${farbe}-${100 * skala}.json`),
          JSON.stringify(budget, null, 2),
        );
        await page.screenshot({ path: join(nachweise, `editor-${farbe}-${100 * skala}.png`) });

        const start = global.getByRole('button', { name: 'Start', exact: true });
        await start.focus();
        await start.press('Tab');
        await expect(global.getByRole('button', { name: 'Workflows', exact: true })).toBeFocused();
        for (const ziel of ['Workflows', 'Vorlagen', 'Hilfe']) {
          await global.getByRole('button', { name: ziel, exact: true }).click();
          await expect(
            page.getByTestId('startbereich').getByRole('heading', {
              name: ziel === 'Hilfe' ? 'Dokumentation und Anleitungen' : ziel,
              exact: true,
              level: 1,
            }),
          ).toBeVisible();
          await page.getByTestId('startbereich').getByRole('button', { name: 'Start', exact: true }).click();
          await page.getByRole('button', { name: 'Weiterbearbeiten', exact: true }).click();
          const nachher = await dokument(page);
          expect(nachher.projektKennung).toBe(vorher.projektKennung);
          expect(nachher.projekt.editor).toEqual(vorher.projekt.editor);
          expect(nachher.projekt.ansicht).toEqual(vorher.projekt.ansicht);
          expect(nachher.geaendert).toBe(true);
          await expect(block).toHaveClass(/scriptlabAuswahl/);
          expect((await zustand(page)).laufId).toBeNull();
        }
        await global.getByRole('button', { name: 'Einstellungen', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'Einstellungen', exact: true })
          .getByRole('button', { name: 'Fertig', exact: true })
          .click();
        await arbeitsbereichWaehlen(page, 'Daten und Parameter');
        // Canvasaktionen dürfen den unsichtbaren Ablauf nicht ändern.
        const datenTab = page.getByRole('tab', { name: 'Daten und Parameter', exact: true });
        await datenTab.focus();
        await datenTab.press('Delete');
        await datenTab.press('Control++');
        await datenTab.press('F4');
        expect((await dokument(page)).projekt.editor).toEqual(vorher.projekt.editor);
        expect((await dokument(page)).projekt.ansicht).toEqual(vorher.projekt.ansicht);
        await arbeitsbereichWaehlen(page, 'Läufe');
        await arbeitsbereichWaehlen(page, 'Ablauf');
        expect((await zustand(page)).laufId).toBeNull();
        expect((await dokument(page)).projekt.editor).toEqual(vorher.projekt.editor);

        const ausfuehren = page.getByRole('button', { name: 'Workflow ausführen', exact: true });
        await imFenster(ausfuehren);
        await ausfuehren.focus();
        await ausfuehren.press('Enter');
        await expect.poll(async () => (await zustand(page)).phase).toBe('laeuft');
        await expect(page.getByRole('button', { name: 'Stoppen', exact: true })).toBeFocused();
        await expect(page.getByRole('tab', { name: 'Ablauf', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await imFenster(page.getByRole('button', { name: 'Laufdetails', exact: true }));
        const laufCanvas = await canvas.boundingBox();
        expect(laufCanvas!.height).toBeGreaterThanOrEqual(120);
        const laufId = (await zustand(page)).laufId;
        await arbeitsbereichWaehlen(page, 'Daten und Parameter');
        expect((await zustand(page)).laufId).toBe(laufId);
        await arbeitsbereichWaehlen(page, 'Ablauf');
        const stoppen = page.getByRole('button', { name: 'Stoppen', exact: true });
        await imFenster(stoppen);
        await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
        await page.screenshot({ path: join(nachweise, `lauf-${farbe}-${100 * skala}.png`) });
        await stoppen.click();
        await expect.poll(async () => (await zustand(page)).phase).toBe('abgebrochen');
        expect((await zustand(page)).laufId).toBe(laufId);
        expect(await readFile(quelle, 'utf8')).toBe(original);
      } finally {
        if (app) {
          if (seite)
            await seite
              .evaluate(async () => {
                const r = await window.scriptlab.testLesen();
                if (
                  r.ok &&
                  ['vorbereitung', 'laeuft', 'stoppt'].includes(r.wert.zustand.phase) &&
                  r.wert.zustand.laufId
                )
                  await window.scriptlab.testStoppen(r.wert.zustand.laufId);
              })
              .catch(() => {});
          if (app.process().exitCode === null && app.process().signalCode === null) {
            const geschlossen = app.waitForEvent('close');
            await Promise.all([geschlossen, app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
          }
        }
        const ziel = resolve(ordner);
        if (
          !ziel.startsWith(resolve(tmpdir()) + sep) ||
          !basename(ziel).startsWith('ScriptLab-Editorstruktur-')
        )
          throw Error('Unsicherer Testordner.');
        await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    });
  }
}
