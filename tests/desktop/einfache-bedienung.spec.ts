import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { neuesProjekt } from '../../src/kern/projekt';
import { testAktiv } from '../../src/gemeinsam/testlauf';
import { arbeitsbereichWaehlen, workflowBefehl, einstellungenOeffnen } from './ansichten';

const ausfuehren = promisify(execFile);
const bilder = resolve('artifacts/einfache-bedienung');
test.setTimeout(90000);

async function starten(farbe: 'hell' | 'dunkel' = 'hell', skala = 1) {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Einfache-Bedienung-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  await mkdir(bilder, { recursive: true });
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      darstellung: farbe,
      textSkalierung: skala,
      automatischeUpdates: false,
      vorabversionen: false,
      letzteSkriptsprache: null,
      pythonInterpreter: null,
      palettenBreite: 272,
      paletteEingeklappt: false,
      eigenschaftenAngeheftet: false,
    }),
  );
  const app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  return { app, seite, ordner };
}

async function zustand(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand;
  });
}
async function projektLesen(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument.projekt;
  });
}
async function beenden(s: { app: ElectronApplication; ordner: string }) {
  await s.app.close();
  await rm(s.ordner, { recursive: true, force: true });
}

test('CSV wird ohne Ausgabeziel mit einem Klick zu XLSX; Löschen ist sichtbar und rückgängig; Export läuft eigenständig', async () => {
  const python =
    process.env.SCRIPTLAB_BUSINESS_PYTHON ??
    JSON.parse(await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8')).installation
      .pfad;
  await access(python);
  const s = await starten();
  let geschlossen = false;
  try {
    const quelle = join(s.ordner, 'Umsätze ä.csv');
    const inhalt = 'ID;Name;Umsatz\n001;Müller;12.50\n002;Bär;7.00\n';
    await writeFile(quelle, inhalt);
    const projekt = neuesProjekt('python');
    projekt.name = 'CSV in Excel umwandeln';
    projekt.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_biz_lesen_csv',
        id: 'quelle',
        data: JSON.stringify({
          konfiguration: { format: 'CSV', pfad: quelle, optionen: { trennzeichen: ';' } },
          eingaben: {},
        }),
        next: {
          block: {
            type: 'sl_biz_schreiben_xlsx',
            id: 'excel',
            data: JSON.stringify({
              konfiguration: {
                format: 'XLSX',
                pfad: '',
                konflikt: 'FEHLER',
                optionen: { blatt: 'Auswertung' },
              },
              eingaben: { tabelle: { referenz: 'quelle' } },
            }),
          },
        },
      },
    };
    const datei = join(s.ordner, 'Umwandeln.scriptlab');
    await writeFile(datei, JSON.stringify(projekt));
    await s.app.evaluate(({ dialog }, pfad) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    }, datei);
    await workflowBefehl(s.seite, 'oeffnen');
    await expect(s.seite.getByRole('heading', { name: projekt.name, exact: true })).toBeVisible();
    await expect(s.seite.getByTestId('editor-sprache')).toHaveCount(0);
    await expect(s.seite.getByTestId('code-panel')).toHaveCount(0);
    await s.seite.locator('g[data-id="excel"]').click({ position: { x: 65, y: 18 } });
    const loeschen = s.seite.getByRole('button', { name: 'Baustein löschen', exact: true });
    await expect(loeschen).toBeEnabled();
    await loeschen.click();
    await expect
      .poll(async () => (await projektLesen(s.seite)).editor.blocks!.blocks[0].next!.block.next)
      .toBeUndefined();
    await s.seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect
      .poll(async () => (await projektLesen(s.seite)).editor.blocks!.blocks[0].next!.block.next?.block.id)
      .toBe('excel');
    await s.seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
    await expect.poll(async () => (await zustand(s.seite)).laufId, { timeout: 15000 }).not.toBeNull();
    await expect.poll(async () => !testAktiv((await zustand(s.seite)).phase), { timeout: 30000 }).toBe(true);
    const lauf = await zustand(s.seite);
    expect(lauf.phase, lauf.meldung ?? '').toBe('beendet');
    expect(lauf.exitcode).toBe(0);
    const ziel = join(lauf.optionen.basisVerzeichnis!, 'Umsätze ä.xlsx');
    const lesen =
      'import sys,json; from openpyxl import load_workbook; w=load_workbook(sys.argv[1],read_only=True); print(json.dumps(list(w.active.values))); w.close()';
    const soll = [
      ['ID', 'Name', 'Umsatz'],
      ['001', 'Müller', '12.50'],
      ['002', 'Bär', '7.00'],
    ];
    expect(JSON.parse((await ausfuehren(python, ['-B', '-c', lesen, ziel])).stdout)).toEqual(soll);
    expect(await readFile(quelle, 'utf8')).toBe(inhalt);
    await arbeitsbereichWaehlen(s.seite, 'Läufe');
    await expect(s.seite.getByTestId('test-panel').getByRole('tablist')).toHaveCount(0);
    await expect(s.seite.getByRole('log', { name: 'Laufausgabe', exact: true })).toHaveCount(0);
    await expect(s.seite.getByRole('button', { name: 'Im Explorer anzeigen: Umsätze ä.xlsx' })).toBeVisible();
    await expect(s.seite.getByTestId('test-panel')).not.toContainText(lauf.standHash!);
    await s.seite.screenshot({ path: join(bilder, 'ergebnis-xlsx.png') });
    const zip = join(s.ordner, 'Export.zip');
    await s.app.evaluate(({ dialog }, ziel) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
    }, zip);
    await s.seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await s.seite
      .getByRole('dialog', { name: 'Exportieren', exact: true })
      .getByRole('button', { name: 'Ausgabeort auswählen' })
      .click();
    await expect
      .poll(async () =>
        access(zip).then(
          () => true,
          () => false,
        ),
      )
      .toBe(true);
    await s.app.close();
    geschlossen = true;
    const extern = join(s.ordner, 'Eigenständiges Paket');
    await ausfuehren(python, [
      '-B',
      '-c',
      'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
      zip,
      extern,
    ]);
    await ausfuehren(python, ['-B', join(extern, 'workflow.py')], {
      cwd: extern,
      env: { ...process.env, PYTHONPATH: '' },
      timeout: 30000,
    });
    expect(
      JSON.parse((await ausfuehren(python, ['-B', '-c', lesen, join(extern, 'Umsätze ä.xlsx')])).stdout),
    ).toEqual(soll);
    expect(await readFile(quelle, 'utf8')).toBe(inhalt);
  } finally {
    if (!geschlossen) await s.app.close();
    await rm(s.ordner, { recursive: true, force: true });
  }
});

for (const [farbe, skala] of [
  ['hell', 1],
  ['dunkel', 2],
] as const) {
  test(`Einstellungen und Hilfe sind verständlich und bedienbar (${farbe}, ${skala * 100} %)`, async () => {
    const s = await starten(farbe, skala);
    try {
      const dialog = await einstellungenOeffnen(s.seite);
      await expect(dialog.getByRole('tab', { name: 'Aussehen', exact: true })).toBeVisible();
      await s.seite.screenshot({ path: join(bilder, `einstellungen-${farbe}.png`) });
      await dialog.getByRole('tab', { name: 'Automatisierungen', exact: true }).click();
      await expect(dialog).not.toContainText('site-packages');
      await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await s.seite
        .getByRole('navigation', { name: 'Globale Navigation' })
        .getByRole('button', { name: 'Hilfe', exact: true })
        .click();
      await expect(s.seite.getByTestId('hilfe')).toBeVisible();
      await expect(s.seite.getByTestId('hilfe')).not.toContainText('SHA-256');
      await s.seite.screenshot({ path: join(bilder, `hilfe-${farbe}.png`) });
      const z = await zustand(s.seite);
      expect(z.laufId).toBeNull();
      expect(await s.seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await beenden(s);
    }
  });
}
