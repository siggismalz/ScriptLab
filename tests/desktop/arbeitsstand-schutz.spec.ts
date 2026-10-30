import {
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
  startseiteWaehlen,
  workflowBefehl,
  workflowMenueAktion,
} from './ansichten';
import { sprachwahlBestaetigen } from './sprache';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument, ProjektBibliothek } from '../../src/gemeinsam/bruecke';
import type { Projekt } from '../../src/kern/projekt';
import { bausteinDefinitionen } from '../../src/kern/katalog';

let app: ElectronApplication;
let seite: Page;
let ordner: string;

interface Schreibbremse {
  erreicht: boolean;
  umbenennungen: number;
  freigeben?: () => void;
  zuruecksetzen?: () => void;
}

test.beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Arbeitsstand-'));
  app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
});

test.afterEach(async () => {
  if (app) {
    await schreibbremseLoesen().catch(() => {});
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  if (ordner) {
    const ziel = resolve(ordner);
    if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Arbeitsstand-'))
      throw new Error('Unsicheres temporäres Testverzeichnis.');
    await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

async function dokumentLesen(): Promise<Dokument> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument;
  });
}
async function bibliothekLesen(): Promise<ProjektBibliothek> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.bibliothekLesen();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert;
  });
}
async function editorBereit(): Promise<void> {
  await expect(seite.getByTestId('palette')).toBeVisible();
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await expect.poll(async () => (await dokumentLesen()).darstellungNoetig).toBe(false);
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}
async function benennen(name: string): Promise<void> {
  await workflowMenueAktion(seite, 'Projektangaben');
  const dialog = seite.getByRole('dialog', { name: 'Projektangaben', exact: true });
  await dialog.getByRole('textbox', { name: 'Projektname', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect.poll(async () => (await dokumentLesen()).projekt.name).toBe(name);
}
async function guardAntwort(response: number): Promise<void> {
  await app.evaluate(({ dialog }, antwort) => {
    dialog.showMessageBox = async () => ({ response: antwort, checkboxChecked: false });
  }, response);
}
async function speichern(datei: string): Promise<Buffer> {
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Gespeichert');
  return readFile(datei);
}
async function entwurfAbwarten(): Promise<string> {
  await expect
    .poll(async () => (await dokumentLesen()).entwurfStatus.phase, { timeout: 8000 })
    .toBe('gesichert');
  const id = (await dokumentLesen()).entwurfStatus.id;
  if (!id) throw new Error('Der tatsächlich gesicherte Entwurf hat keine Kennung.');
  await expect.poll(async () => (await bibliothekLesen()).entwuerfe.some((e) => e.id === id)).toBe(true);
  return id;
}
async function nachrichtEinfuegen(): Promise<void> {
  await editorBereit();
  const name = bausteinDefinitionen.find((b) => b.typ === 'sl_message')!.name;
  const palette = seite.getByTestId('palette');
  await palette.getByRole('searchbox', { name: 'Bausteine suchen' }).fill(name);
  await palette.getByRole('button', { name: `Baustein einfügen: ${name}`, exact: true }).click();
  await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
  await expect
    .poll(async () => (await dokumentLesen()).projekt.editor.blocks!.blocks[0].next?.block.type)
    .toBe('sl_message');
}
async function nachrichtFeld() {
  const id = (await dokumentLesen()).projekt.editor.blocks!.blocks[0].next!.block.id;
  await seite.locator(`g[data-id="${id}"]`).click({ position: { x: 60, y: 18 } });
  if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const feld = seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true });
  const idFeld = await feld.getAttribute('id');
  if (!idFeld) throw new Error('Das beschriftete Textfeld hat keine Kennung.');
  // Ein echtes inert-Feld fehlt korrekt im Accessibility-Baum; seine DOM-Eigenschaften bleiben prüfbar.
  return seite.locator(`[id="${idFeld}"]`);
}

async function schreibbremseEinrichten(datei: string): Promise<void> {
  await app.evaluate((_electron, ziel) => {
    // Testinstrumentierung ausschließlich im Node-Hauptprozess und für genau diese isolierte Datei.
    // Die Preload-Schnittstelle wird weder erweitert noch ersetzt.
    const dateisystem = process.getBuiltinModule('node:fs/promises');
    if (!dateisystem) throw new Error('Das feste Node-Dateimodul ist im Testhauptprozess nicht verfügbar.');
    const original = dateisystem.rename;
    const zustand: Schreibbremse = { erreicht: false, umbenennungen: 0 };
    (globalThis as typeof globalThis & { scriptlabSchreibbremse?: Schreibbremse }).scriptlabSchreibbremse =
      zustand;
    dateisystem.rename = async (von, nach) => {
      if (String(nach).toLowerCase() === ziel.toLowerCase()) {
        zustand.umbenennungen++;
        zustand.erreicht = true;
        await new Promise<void>((fertig) => {
          const timer = setTimeout(fertig, 15000);
          zustand.freigeben = () => {
            clearTimeout(timer);
            fertig();
          };
        });
      }
      return original(von, nach);
    };
    zustand.zuruecksetzen = () => {
      zustand.freigeben?.();
      dateisystem.rename = original;
    };
  }, datei);
}
async function schreibbremseLoesen(): Promise<void> {
  await app.evaluate(() => {
    const global = globalThis as typeof globalThis & { scriptlabSchreibbremse?: Schreibbremse };
    global.scriptlabSchreibbremse?.zuruecksetzen?.();
    delete global.scriptlabSchreibbremse;
  });
}

test('erhält Konfliktoriginal, fremden Entwurf und Kopiekennung bei abgebrochenem Projektdateiexport', async () => {
  await workflowBefehl(seite, 'neu');
  await sprachwahlBestaetigen(seite);
  await benennen('Entwurf B zur späteren Auswahl');
  const entwurfB = await entwurfAbwarten();
  await guardAntwort(1);
  await workflowBefehl(seite, 'neu');
  await sprachwahlBestaetigen(seite);
  await benennen('Gespeicherter Arbeitsstand A');
  const kennungA = (await dokumentLesen()).projektKennung;
  const dateiA = join(ordner, 'Profil', 'Workflows', `${kennungA}.scriptlab`);
  const originalA = await speichern(dateiA);
  await benennen('Eigene ungespeicherte Änderungen aus A');
  const externeBytes = Buffer.from(
    JSON.stringify({ ...JSON.parse(originalA.toString('utf8')), name: 'A wurde außerhalb geändert' }),
  );
  await writeFile(dateiA, externeBytes);
  const bPfad = join(ordner, 'Profil', 'entwuerfe', `${entwurfB}.json`);
  const bVorher = await readFile(bPfad);
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByRole('alert')).toContainText('außerhalb von ScriptLab geändert');
  expect((await dokumentLesen()).projektKennung).toBe(kennungA);
  expect(await readFile(dateiA)).toEqual(externeBytes);
  await workflowMenueAktion(seite, 'Kopie anlegen');
  await editorBereit();
  const kopie = await dokumentLesen();
  expect(kopie.projektKennung).not.toBe(kennungA);
  const dateiC = join(ordner, 'Profil', 'Workflows', `${kopie.projektKennung}.scriptlab`);
  const gespeichertC = await readFile(dateiC);
  const standC = JSON.parse(gespeichertC.toString('utf8')) as Projekt;
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' });
  });
  await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
  await exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true }).selectOption('projekt');
  await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
  await expect(exportdialog).not.toBeVisible();
  expect((await dokumentLesen()).projektKennung).toBe(standC.projektKennung);
  expect(await readFile(dateiC)).toEqual(gespeichertC);
  await benennen('C nach dem Abbruch weiter bearbeitet');
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  const neuerEntwurf = await entwurfAbwarten();
  const sicherung = JSON.parse(
    await readFile(join(ordner, 'Profil', 'entwuerfe', `${neuerEntwurf}.json`), 'utf8'),
  );
  expect(sicherung.projekt.projektKennung).toBe(standC.projektKennung);
  expect(sicherung.projekt.name).toBe('C nach dem Abbruch weiter bearbeitet');
  expect(sicherung.ausgangspfad).toBe(dateiC);
  expect(sicherung.baselineHash).toBe(createHash('sha256').update(gespeichertC).digest('hex'));
  expect(await readFile(dateiC)).toEqual(gespeichertC);
  expect(await readFile(dateiA)).toEqual(externeBytes);
  expect(await readFile(bPfad)).toEqual(bVorher);
  await speichern(dateiC);
  const fertigC = JSON.parse(await readFile(dateiC, 'utf8')) as Projekt;
  expect(fertigC.projektKennung).toBe(standC.projektKennung);
  expect(fertigC.name).toBe('C nach dem Abbruch weiter bearbeitet');
  expect(await readFile(dateiA)).toEqual(externeBytes);
  expect((await bibliothekLesen()).entwuerfe.some((e) => e.id === entwurfB)).toBe(true);
});
test('sperrt Eigenschaften, Blockly und Tastenkürzel während echter ausstehender Schreib-I/O', async () => {
  await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await sprachwahlBestaetigen(seite);
  await nachrichtEinfuegen();
  await benennen('Test mit gezielt langsamer Dateispeicherung');
  const feld = await nachrichtFeld();
  await feld.fill('Vorher gespeicherte Nachricht');
  const datei = join(ordner, 'Profil', 'Workflows', `${(await dokumentLesen()).projektKennung}.scriptlab`);
  const original = await speichern(datei);
  await feld.fill('Diese Nachricht soll jetzt gespeichert werden');
  await expect
    .poll(async () => {
      const eingabe = (await dokumentLesen()).projekt.editor.blocks!.blocks[0].next!.block.inputs!.TEXT;
      return (eingabe.block ?? eingabe.shadow)?.fields?.TEXT;
    })
    .toBe('Diese Nachricht soll jetzt gespeichert werden');
  const gewuenscht = (await dokumentLesen()).projekt;
  await schreibbremseEinrichten(datei);
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect
    .poll(() =>
      app.evaluate(
        () =>
          (globalThis as typeof globalThis & { scriptlabSchreibbremse?: Schreibbremse })
            .scriptlabSchreibbremse?.erreicht,
      ),
    )
    .toBe(true);
  expect(await readFile(datei)).toEqual(original);
  expect(await feld.evaluate((el) => Boolean(el.closest('[inert]')))).toBe(true);
  expect(
    await seite
      .locator('.blocklySvg')
      .first()
      .evaluate((el) => Boolean(el.closest('[inert]'))),
  ).toBe(true);
  expect(await seite.getByTestId('palette').evaluate((el) => Boolean(el.closest('[inert]')))).toBe(true);
  await feld.focus();
  await expect(feld).not.toBeFocused();
  const feldrechteck = (await feld.boundingBox())!;
  await seite.mouse.click(feldrechteck.x + 12, feldrechteck.y + 12);
  await seite.keyboard.type('DARF NICHT EINGEFUEGT WERDEN');
  const start = seite.locator(`g[data-id="${gewuenscht.editor.blocks!.blocks[0].id}"]`);
  const startrechteck = (await start.boundingBox())!;
  await seite.mouse.click(startrechteck.x + 45, startrechteck.y + 18);
  for (const taste of ['Control+z', 'Delete', 'Control+y', 'Control+n', 'Control+s'])
    await seite.keyboard.press(taste);
  await expect(feld).toHaveValue('Diese Nachricht soll jetzt gespeichert werden');
  const waehrend = await dokumentLesen();
  expect(waehrend.projektKennung).toBe(gewuenscht.projektKennung);
  expect(waehrend.projekt.editor).toEqual(gewuenscht.editor);
  expect(
    await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { scriptlabSchreibbremse?: Schreibbremse }).scriptlabSchreibbremse
          ?.umbenennungen,
    ),
  ).toBe(1);
  await schreibbremseLoesen();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Gespeichert');
  const fertig = JSON.parse(await readFile(datei, 'utf8')) as Projekt;
  expect(fertig.projektKennung).toBe(gewuenscht.projektKennung);
  expect(fertig.editor).toEqual(gewuenscht.editor);
  expect((await dokumentLesen()).geaendert).toBe(false);
  await expect(seite.getByRole('alert').filter({ visible: true })).toHaveCount(0);
});

for (const weg of ['Dateidialog', 'Projektbibliothek'] as const) {
  test(`lädt beim erneuten Öffnen über ${weg} den im Schutzdialog gespeicherten aktuellen Stand`, async () => {
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(seite);
    await nachrichtEinfuegen();
    await benennen('Workflow A – Version 1');
    const feld = await nachrichtFeld();
    await feld.fill('Nachricht aus Version 1');
    const datei = join(ordner, 'Profil', 'Workflows', `${(await dokumentLesen()).projektKennung}.scriptlab`);
    const version1 = await speichern(datei);
    await feld.fill('Nachricht aus Version 2, vor dem Öffnen noch nicht gespeichert');
    await benennen('Workflow A – Version 2');
    const version2 = (await dokumentLesen()).projekt;
    expect(await readFile(datei)).toEqual(version1);
    await guardAntwort(0);
    if (weg === 'Dateidialog') {
      await app.evaluate(({ dialog }, ziel) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ziel] });
      }, datei);
      await workflowBefehl(seite, 'oeffnen');
    } else {
      await startseiteWaehlen(seite);
      await seite.getByRole('button', { name: 'Meine gespeicherten Workflows', exact: true }).click();
      const zeile = seite
        .getByTestId('bekannte-projekte')
        .getByRole('article', { name: `Workflow A – Version 1 – ${datei}`, exact: true });
      await zeile.getByRole('button', { name: 'Öffnen', exact: true }).click();
    }
    await editorBereit();
    await expect.poll(async () => (await dokumentLesen()).projekt.name).toBe(version2.name);
    const geoeffnet = await dokumentLesen();
    expect(geoeffnet.projektKennung).toBe(version2.projektKennung);
    expect(geoeffnet.projekt.editor).toEqual(version2.editor);
    expect(geoeffnet.geaendert).toBe(false);
    const rendererFeld = await nachrichtFeld();
    await expect(rendererFeld).toHaveValue('Nachricht aus Version 2, vor dem Öffnen noch nicht gespeichert');
    await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Gespeichert');
    const dateistand = JSON.parse(await readFile(datei, 'utf8')) as Projekt;
    expect(dateistand.name).toBe(version2.name);
    expect(dateistand.projektKennung).toBe(version2.projektKennung);
    expect(dateistand.editor).toEqual(version2.editor);
    expect((await bibliothekLesen()).projekte.find((p) => p.pfad === datei)?.name).toBe(version2.name);
  });
}
