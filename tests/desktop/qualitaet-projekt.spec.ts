import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import type { Dokument } from '../../src/gemeinsam/bruecke';
import { arbeitsbereichWaehlen, workflowBefehl, laufStarten } from './ansichten';
import { sprachwahlBestaetigen } from './sprache';

let app: ElectronApplication | undefined;
let seite: Page;
let ordner: string;

function kette(ab: number, bis: number): EditorBlock {
  let kopf: EditorBlock | undefined, letzter: EditorBlock | undefined;
  for (let n = ab; n <= bis; n++) {
    const block: EditorBlock = {
      type: 'sl_comment',
      id: `qa-schritt-${n}`,
      fields: { TEXT: `Schritt ${n}: Überprüfung von Geschäftsabläufen ohne Dateiänderung` },
    };
    if (letzter) letzter.next = { block };
    else kopf = block;
    letzter = block;
  }
  return kopf!;
}
function umfangProjekt(anzahl: number, verzweigt = false): Projekt {
  const p = neuesProjekt('python');
  const links = Math.floor((anzahl - 3) / 2),
    letzteNummer = anzahl - 3;
  p.name = `Großer Prüfworkflow · ${anzahl} Blöcke mit langen deutschen Beschreibungen`;
  p.editor.blocks!.blocks[0].next = {
    block: verzweigt
      ? {
          type: 'sl_if',
          id: 'qa-verzweigung',
          inputs: {
            BEDINGUNG: { block: { type: 'sl_bool', id: 'qa-bedingung', fields: { WERT: 'WAHR' } } },
            DANN: { block: kette(1, links) },
            SONST: { block: kette(links + 1, letzteNummer) },
          },
        }
      : kette(1, anzahl - 1),
  };
  return p;
}
async function dokument(): Promise<Dokument> {
  // Gleiche fachliche Antwort als Text, ohne zusätzliche Playwright-Tiefengrenze.
  const antwort = JSON.parse(await seite.evaluate(() => window.scriptlabTransport.laden('[]')));
  if (!antwort.ok) throw new Error(antwort.meldung);
  return antwort.wert.dokument;
}
async function bereit() {
  await expect.poll(async () => (await dokument()).darstellungNoetig, { timeout: 30_000 }).toBe(false);
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}
async function oeffnen(datei: string) {
  await app!.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(seite, 'oeffnen');
}
async function appBeenden() {
  if (!app) return;
  const prozess = app.process();
  const ende = prozess.exitCode === null ? once(prozess, 'exit') : Promise.resolve();
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await ende;
  app = undefined;
}
function idsLesen(anfang: EditorBlock) {
  const ids: string[] = [],
    offen = [anfang];
  while (offen.length) {
    const block = offen.pop()!;
    ids.push(block.id);
    if (block.next) offen.push(block.next.block);
    for (const eingang of Object.values(block.inputs ?? {})) {
      if (eingang.block) offen.push(eingang.block);
      if (eingang.shadow) offen.push(eingang.shadow);
    }
  }
  return ids.sort();
}

test.beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Qualitaet-Projekt-'));
  app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
});
test.afterEach(async () => {
  await appBeenden();
  const ziel = resolve(ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Qualitaet-Projekt-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

for (const { anzahl, verzweigt } of [
  { anzahl: 601, verzweigt: false },
  { anzahl: 1000, verzweigt: false },
  { anzahl: 1000, verzweigt: true },
]) {
  test(`${anzahl} Blöcke ${verzweigt ? 'mit Verzweigung' : 'in einer Kette'} öffnen, bearbeiten, laden und ausführen`, async () => {
    test.setTimeout(180_000);
    const projekt = umfangProjekt(anzahl, verzweigt);
    const original = JSON.stringify(projekt),
      quelle = join(ordner, 'Original.scriptlab');
    await writeFile(quelle, original);
    const fehler: string[] = [];
    seite.on('pageerror', (e) => fehler.push(e.stack ?? e.message));
    const start = performance.now();
    await oeffnen(quelle);
    await expect.poll(async () => (await dokument()).projekt.name, { timeout: 30_000 }).toBe(projekt.name);
    await bereit();
    await expect(seite.locator('.blocklyBlockCanvas g[data-id]')).toHaveCount(anzahl);
    const ladezeitMs = performance.now() - start;
    await seite.locator('g[data-id="qa-schritt-1"]').click({ position: { x: 60, y: 18 } });
    if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
      await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    const text = seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true });
    const ersterKommentar = (p: Projekt) =>
      verzweigt
        ? p.editor.blocks!.blocks[0].next!.block.inputs!.DANN.block!
        : p.editor.blocks!.blocks[0].next!.block;
    const ersterText = async () => ersterKommentar((await dokument()).projekt).fields!.TEXT;
    const geaendert = 'Geändert: Grüße aus der Prüfung „äöü“; Werte bleiben Daten.';
    await text.fill(geaendert);
    await text.press('Tab');
    await expect.poll(ersterText).toBe(geaendert);
    await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect.poll(ersterText).toBe('Schritt 1: Überprüfung von Geschäftsabläufen ohne Dateiänderung');
    await seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
    await expect.poll(ersterText).toBe(geaendert);
    await seite.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await expect.poll(async () => (await dokument()).projekt.ansicht.zoom).toBeLessThan(1);
    const ansicht = (await dokument()).projekt.ansicht;
    await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
    await arbeitsbereichWaehlen(seite, 'Läufe');
    await arbeitsbereichWaehlen(seite, 'Ablauf');
    expect((await dokument()).projekt.ansicht).toEqual(ansicht);
    await expect(text).toHaveValue(geaendert);
    await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect.poll(async () => (await dokument()).geaendert).toBe(false);
    const gespeichert = await dokument();
    expect(gespeichert.dateiname).not.toBeNull();
    const speicherpfad = join(ordner, 'Profil', 'Workflows', gespeichert.dateiname!);
    const datei: Projekt = JSON.parse(await readFile(speicherpfad, 'utf8'));
    expect(datei.skriptsprache).toBe('python');
    expect(idsLesen(datei.editor.blocks!.blocks[0])).toEqual(idsLesen(projekt.editor.blocks!.blocks[0]));
    expect(ersterKommentar(datei).fields!.TEXT).toBe(geaendert);
    expect(await readFile(quelle, 'utf8')).toBe(original);
    await workflowBefehl(seite, 'neu');
    await sprachwahlBestaetigen(seite, 'python');
    await expect.poll(async () => (await dokument()).projekt.name).toBe('Mein Workflow');
    await bereit();
    await expect(seite.locator('.blocklyBlockCanvas g[data-id]')).toHaveCount(1);
    await oeffnen(speicherpfad);
    try {
      await expect.poll(async () => (await dokument()).projekt.name, { timeout: 30_000 }).toBe(projekt.name);
    } catch (prueffehler) {
      console.log('Reloadfehler:', fehler);
      console.log(
        'Renderertext:',
        await Promise.race([
          seite.evaluate(() => document.body.innerText.slice(-4000)),
          new Promise<string>((fertig) =>
            setTimeout(() => fertig('Renderer antwortet nicht binnen 2 Sekunden'), 2000),
          ),
        ]),
      );
      throw prueffehler;
    }
    await bereit();
    await expect(seite.locator('.blocklyBlockCanvas g[data-id]')).toHaveCount(anzahl);
    await expect.poll(ersterText).toBe(geaendert);
    const vorher = await seite.evaluate(() => window.scriptlab.testLesen());
    expect(vorher.ok && vorher.wert.zustand.phase).toBe('bereit');
    const scriptpfad = join(ordner, 'Export.py');
    await app!.evaluate(({ dialog }, pfad) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: pfad });
    }, scriptpfad);
    await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
    const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
    await exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true }).selectOption('script');
    await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
    await expect
      .poll(async () => readFile(scriptpfad, 'utf8').catch(() => ''), { timeout: 15_000 })
      .not.toBe('');
    const exportcode = await readFile(scriptpfad, 'utf8');
    const kommentarzahl = verzweigt ? anzahl - 3 : anzahl - 1;
    const erwarteteKommentare = Array.from({ length: kommentarzahl }, (_, index) =>
      index === 0 ? geaendert : `Schritt ${index + 1}: Überprüfung von Geschäftsabläufen ohne Dateiänderung`,
    );
    const exportKommentare = exportcode
      .split(/\r?\n/)
      .map((zeile) => zeile.trim())
      .filter((zeile) => /^# (?:Schritt \d+:|Geändert:)/.test(zeile))
      .map((zeile) => zeile.slice(2));
    expect(exportKommentare).toEqual(erwarteteKommentare);
    const nachExport = await seite.evaluate(() => window.scriptlab.testLesen());
    expect(nachExport.ok && nachExport.wert.zustand.phase).toBe('bereit');
    expect(nachExport.ok && nachExport.wert.zustand.laufId).toBeNull();
    expect(exportcode).toContain(`Schritt ${verzweigt ? anzahl - 3 : anzahl - 1}: Überprüfung`);
    await laufStarten(seite);
    await expect
      .poll(
        async () => {
          const antwort = await seite.evaluate(() => window.scriptlab.testLesen());
          return antwort.ok ? antwort.wert.zustand.phase : antwort.meldung;
        },
        { timeout: 30_000 },
      )
      .toBe('beendet');
    const beendet = await seite.evaluate(() => window.scriptlab.testLesen());
    expect(beendet.ok && beendet.wert.zustand.exitcode).toBe(0);
    await arbeitsbereichWaehlen(seite, 'Ablauf');
    expect(fehler).toEqual([]);
    await mkdir(resolve('artifacts/qualitaet-ux'), { recursive: true });
    const dateiname = `projekt-${anzahl}-${verzweigt ? 'verzweigt' : 'linear'}`;
    await seite.screenshot({ path: resolve(`artifacts/qualitaet-ux/${dateiname}.png`) });
    await writeFile(
      resolve(`artifacts/qualitaet-ux/${dateiname}.json`),
      JSON.stringify(
        {
          bloecke: anzahl,
          verzweigt,
          ladezeitMs,
          ansicht,
          rendererFehler: fehler,
          laufphase: beendet.ok ? beendet.wert.zustand.phase : null,
        },
        null,
        2,
      ),
    );
    await appBeenden();
    const eigenstaendig = spawnSync(
      resolve('artifacts/python-buendel/python/python.exe'),
      ['-I', '-B', '-u', '-X', 'utf8', scriptpfad],
      {
        cwd: ordner,
        windowsHide: true,
        timeout: 15_000,
        encoding: 'utf8',
        maxBuffer: 65536,
      },
    );
    if (eigenstaendig.error) throw eigenstaendig.error;
    expect(eigenstaendig.status, eigenstaendig.stderr).toBe(0);
  });
}

for (const verzweigt of [false, true]) {
  test(`2000 ${verzweigt ? 'verzweigte' : 'lineare'} Blöcke werden vor dem Workflowwechsel abgewiesen und das Original bleibt erhalten`, async () => {
    const projekt = umfangProjekt(2000, verzweigt),
      original = JSON.stringify(projekt);
    const quelle = join(ordner, 'Zu-tief.scriptlab');
    await writeFile(quelle, original);
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(seite, 'python');
    await bereit();
    const vorher = await dokument();
    await oeffnen(quelle);
    await expect(seite.getByRole('alert').filter({ hasText: '1000' })).toBeVisible();
    expect((await dokument()).projekt).toEqual(vorher.projekt);
    await expect(seite.locator('.blocklyBlockCanvas g[data-id]')).toHaveCount(1);
    expect(await readFile(quelle, 'utf8')).toBe(original);
    const lauf = await seite.evaluate(() => window.scriptlab.testLesen());
    expect(lauf.ok && lauf.wert.zustand.phase).toBe('bereit');
  });
}
