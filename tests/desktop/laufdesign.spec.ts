import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type Projekt } from '../../src/kern/projekt';
import { testAktiv } from '../../src/gemeinsam/testlauf';
import { arbeitsbereichWaehlen, einstellungenOeffnen, workflowBefehl } from './ansichten';

test.skip(process.platform !== 'win32', 'Die Laufabnahme benötigt den echten Windows-Prozesshost.');
test.setTimeout(60000);

const neuerText = 'UNGESPEICHERTER Laufstand ä – nur synthetische Testdaten';
const nachweise = resolve('artifacts/qualitaet-desktop/laufdesign');
function vorlage(sprache: 'vbs' | 'python'): Projekt {
  const p = neuesProjekt(sprache);
  p.name = 'Testdaten · nachvollziehbarer Lauf mit langer deutscher Bezeichnung';
  p.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_output',
      id: 'laufdesign_ausgabe',
      inputs: {
        TEXT: {
          block: { type: 'sl_text', id: 'laufdesign_text', fields: { TEXT: 'GESPEICHERTER ALTER TEXT' } },
        },
      },
      next: {
        block: {
          type: 'sl_sleep',
          id: 'laufdesign_warten',
          inputs: {
            SEKUNDEN: { block: { type: 'sl_number', id: 'laufdesign_dauer', fields: { ZAHL: '120' } } },
          },
        },
      },
    },
  };
  return p;
}
async function lauf(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.zustand;
  });
}
async function imFenster(steuerung: Locator) {
  await expect(steuerung).toBeVisible();
  const box = await steuerung.boundingBox();
  expect(box).not.toBeNull();
  const fenster = await steuerung.page().evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(fenster.breite + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(fenster.hoehe + 1);
}
async function textgroesse(seite: Page, wert: 1 | 2) {
  const dialog = await einstellungenOeffnen(seite);
  await dialog.getByRole('tab', { name: 'Darstellung', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Textgröße der Oberfläche', exact: true })
    .selectOption(String(wert));
  await dialog.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
}
async function aufraeumen(app: ElectronApplication | undefined, seite: Page | undefined, ordner: string) {
  if (app) {
    if (seite && !seite.isClosed()) {
      const z = await lauf(seite).catch(() => null);
      if (z?.laufId && testAktiv(z.phase)) {
        await seite.evaluate((id) => window.scriptlab.testStoppen(id), z.laufId).catch(() => {});
        await expect.poll(async () => !testAktiv((await lauf(seite)).phase), { timeout: 15000 }).toBe(true);
      }
    }
    const prozess = app.process();
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
  }
  const ziel = resolve(ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Laufdesign-'))
    throw new Error('Der isolierte Testordner liegt nicht im erwarteten temporären Bereich.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

for (const [thema, sprache] of [
  ['hell', 'vbs'],
  ['dunkel', 'python'],
] as const) {
  test(`Laufdesign ${thema}/${sprache}: Direktstart, Kontext, Tastatur, Stopp und Export bei 100/200 Prozent`, async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Laufdesign-'));
    let app: ElectronApplication | undefined;
    let seite: Page | undefined;
    try {
      const profil = join(ordner, 'Profil');
      await mkdir(profil);
      await writeFile(
        join(profil, 'einstellungen.json'),
        JSON.stringify({
          darstellung: thema,
          textSkalierung: 1,
          automatischeUpdates: false,
          vorabversionen: false,
        }),
      );
      const projekt = vorlage(sprache);
      const datei = join(ordner, `${projekt.projektKennung}.scriptlab`);
      await writeFile(datei, JSON.stringify(projekt));
      const original = await readFile(datei);
      app = await electron.launch({
        args: [resolve('.'), '--force-device-scale-factor=1'],
        cwd: ordner,
        env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
      });
      seite = await app.firstWindow();
      await app.evaluate(({ BrowserWindow, dialog }, pfad) => {
        BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
      }, datei);
      await expect.poll(() => seite!.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, 720]);
      await expect(seite.getByRole('button', { name: 'Workflow öffnen', exact: true })).toBeVisible();
      await workflowBefehl(seite, 'oeffnen');
      await expect
        .poll(() =>
          seite!.evaluate(async () => {
            const r = await window.scriptlab.laden();
            return r.ok && !r.wert.dokument.darstellungNoetig;
          }),
        )
        .toBe(true);
      await seite.locator('g[data-id="laufdesign_text"]').click({ position: { x: 40, y: 16 } });
      if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
        await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
      await seite
        .getByTestId('eigenschaften-panel')
        .getByRole('textbox', { name: 'Text', exact: true })
        .fill(neuerText);
      await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
      await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText(
        'Ungespeicherte Änderungen',
      );
      await arbeitsbereichWaehlen(seite, 'Läufe');
      expect((await lauf(seite)).laufId).toBeNull();
      const kopf = seite.getByRole('navigation', { name: 'Projektaktionen', exact: true });
      await imFenster(kopf.getByRole('button', { name: 'Workflow ausführen', exact: true }));
      // Genau dieser Headerklick startet den aktuellen ungespeicherten Workflow.
      await kopf.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
      await expect.poll(async () => (await lauf(seite!)).ausgabe, { timeout: 15000 }).toContain(neuerText);
      const gestartet = await lauf(seite);
      expect(gestartet.phase).toBe('laeuft');
      expect(gestartet.prozessId).not.toBeNull();
      const panel = seite.getByTestId('test-panel');
      for (const skala of [1, 2] as const) {
        await textgroesse(seite, skala);
        await expect(panel.getByRole('heading', { name: 'Läufe', exact: true })).toBeVisible();
        await expect(panel.getByText('Aktueller Lauf', { exact: true }).first()).toBeVisible();
        await imFenster(panel.getByRole('button', { name: 'Stoppen', exact: true }));
        const ansicht = panel.getByRole('tab', { name: 'Übersicht', exact: true });
        await ansicht.focus();
        await ansicht.press('End');
        await expect(panel.getByRole('tab', { name: 'Protokoll', exact: true })).toBeFocused();
        await expect(panel.getByRole('log', { name: 'Laufprotokoll', exact: true })).toContainText(neuerText);
        await panel.getByRole('tab', { name: 'Übersicht', exact: true }).click();
        await expect(
          panel.getByText(/Bereits erfolgte Dateiänderungen bleiben auch nach einem Stopp bestehen/),
        ).toBeVisible();
        expect((await lauf(seite)).laufId).toBe(gestartet.laufId);
        await mkdir(nachweise, { recursive: true });
        await seite.screenshot({ path: join(nachweise, `${thema}-${skala * 100}-laufend-1280x720.png`) });
      }
      await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
      expect((await lauf(seite)).laufId).toBe(gestartet.laufId);
      expect((await lauf(seite)).phase).toBe('laeuft');
      await arbeitsbereichWaehlen(seite, 'Läufe');
      await panel.getByRole('button', { name: 'Stoppen', exact: true }).click();
      await expect.poll(async () => testAktiv((await lauf(seite!)).phase), { timeout: 15000 }).toBe(false);
      const ende = await lauf(seite);
      expect(ende.phase, JSON.stringify(ende)).toBe('abgebrochen');
      expect(ende.laufId).toBe(gestartet.laufId);
      expect(ende.ausgabe).toContain(neuerText);
      await panel.getByRole('button', { name: /^Alle Läufe/ }).click();
      const historie = seite.getByRole('region', { name: 'Läufe dieses Workflows', exact: true });
      await expect(historie.getByRole('heading', { name: 'Gespeicherte Läufe', exact: true })).toBeVisible();
      await historie.getByRole('button', { name: /^Lauf vom .* anzeigen$/ }).click();
      await expect(panel.getByText('Gespeicherter Lauf', { exact: true })).toBeVisible();
      await expect(panel.getByText('Abgebrochen', { exact: true })).toBeVisible();
      expect((await lauf(seite)).laufId).toBe(gestartet.laufId);
      await panel.getByRole('button', { name: /^Alle Läufe/ }).click();
      await historie.getByRole('button', { name: 'Aktuellen Lauf anzeigen', exact: true }).click();
      await expect(panel.getByText('Aktueller Lauf', { exact: true }).first()).toBeVisible();
      await expect(panel.getByText('Gespeicherter Lauf', { exact: true })).not.toBeVisible();
      expect((await lauf(seite)).laufId).toBe(gestartet.laufId);
      await imFenster(kopf.getByRole('button', { name: 'Exportieren', exact: true }));
      const ziel = join(ordner, sprache === 'vbs' ? 'Ausgabe.vbs' : 'Ausgabe.py');
      await app.evaluate(({ dialog }, pfad) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: pfad });
      }, ziel);
      await kopf.getByRole('button', { name: 'Exportieren', exact: true }).click();
      const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
      await exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true }).selectOption('script');
      await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
      await expect
        .poll(async () => {
          try {
            return (await readFile(ziel)).includes(
              Buffer.from(neuerText, sprache === 'vbs' ? 'utf16le' : 'utf8'),
            );
          } catch (fehler) {
            // Der Klick stößt die asynchrone Main-Aktion an; noch fehlend heißt nicht fertig.
            if ((fehler as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw fehler;
          }
        })
        .toBe(true);
      expect(await readFile(datei)).toEqual(original);
      await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText(
        'Ungespeicherte Änderungen',
      );
    } finally {
      await aufraeumen(app, seite, ordner);
    }
  });
}
