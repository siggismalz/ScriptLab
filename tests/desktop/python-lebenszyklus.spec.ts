import {
  workflowBefehl,
  feldEinblenden,
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
  startseiteWaehlen,
} from './ansichten';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { neuesProjekt, projektPruefen, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import type { Dokument } from '../../src/gemeinsam/bruecke';
import type { PythonInstallation } from '../../src/gemeinsam/python';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';
import { testStandHash } from '../../src/windows/testlauf';
import { sprachwahlBestaetigen } from './sprache';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
  basis: string;
}

const ordnerPraefix = 'ScriptLab-Python-Lebenszyklus-';
let nummer = 0;
function block(
  type: string,
  eingaben: Record<string, EditorBlock> = {},
  fields: EditorBlock['fields'] = {},
): EditorBlock {
  return {
    type,
    id: `python_lebenszyklus_${++nummer}`,
    fields,
    inputs: Object.fromEntries(Object.entries(eingaben).map(([name, block]) => [name, { block }])),
  };
}
const ausgabe = (TEXT: string) => block('sl_output', { TEXT: block('sl_text', {}, { TEXT }) });
function projektMit(...bloecke: EditorBlock[]): Projekt {
  const projekt = neuesProjekt('python');
  projekt.name = 'Isolierter Python-Lebenszyklustest';
  for (let i = 0; i < bloecke.length - 1; i++) bloecke[i].next = { block: bloecke[i + 1] };
  projekt.editor.blocks!.blocks[0].next = { block: bloecke[0] };
  return projekt;
}

async function starten(ordner?: string): Promise<Sitzung> {
  const basisordner = ordner ?? (await mkdtemp(join(tmpdir(), ordnerPraefix)));
  const profil = join(basisordner, 'Profil');
  const basis = join(basisordner, 'Nur eigene Testdaten ä');
  await mkdir(basis, { recursive: true });
  // Ausschließlich das Testharness übernimmt die CI-Vorgabe in normale lokale Einstellungen.
  // Ein Neustart erhält dieselben Einstellungen; die Anwendung liest keine Python-Test-ENV.
  const interpreter = process.env.SCRIPTLAB_TEST_PYTHON;
  if (!ordner && interpreter) {
    if (!isAbsolute(interpreter)) throw new Error('Der Testinterpreter muss ein absoluter Dateipfad sein.');
    await mkdir(profil, { recursive: true });
    await writeFile(
      join(profil, 'einstellungen.json'),
      JSON.stringify({
        automatischeUpdates: false,
        vorabversionen: false,
        letzteSkriptsprache: null,
        pythonInterpreter: interpreter,
      }),
      'utf8',
    );
  }
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: basisordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  return { app, seite, ordner: basisordner, profil, basis };
}
async function beenden(s: Sitzung): Promise<void> {
  await s.seite
    .evaluate(async () => {
      const antwort = await window.scriptlab.testLesen();
      if (
        antwort.ok &&
        antwort.wert.zustand.laufId &&
        ['vorbereitung', 'laeuft', 'stoppt'].includes(antwort.wert.zustand.phase)
      )
        await window.scriptlab.testStoppen(antwort.wert.zustand.laufId);
    })
    .catch(() => {});
  await appBeenden(s.app);
  const ziel = resolve(s.ordner);
  if (dirname(ziel) !== resolve(tmpdir()) || !basename(ziel).startsWith(ordnerPraefix))
    throw new Error('Unsicherer temporärer Testordner.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
async function appBeenden(app: ElectronApplication): Promise<void> {
  const prozess = app.process();
  const beendet = prozess.exitCode === null && prozess.signalCode === null ? once(prozess, 'exit') : null;
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await beendet;
}
async function dokument(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const antwort = await window.scriptlab.laden();
    if (!antwort.ok) throw new Error(antwort.meldung);
    return antwort.wert.dokument;
  });
}
async function zustand(s: Sitzung): Promise<TestZustand> {
  return s.seite.evaluate(async () => {
    const antwort = await window.scriptlab.testLesen();
    if (!antwort.ok) throw new Error(antwort.meldung);
    return antwort.wert.zustand;
  });
}
async function editorBereit(s: Sitzung): Promise<void> {
  await arbeitsbereichWaehlen(s.seite, 'Ablauf');
  await expect(s.seite.getByTestId('palette')).toBeVisible();
  await expect.poll(async () => (await dokument(s)).darstellungNoetig).toBe(false);
  await expect(s.seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await s.seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}
async function oeffnen(s: Sitzung, projekt: Projekt): Promise<string> {
  const datei = join(s.ordner, 'Nur eigener Python-Test.scriptlab');
  await writeFile(datei, JSON.stringify(projekt), 'utf8');
  await s.app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(s.seite, 'oeffnen');
  await editorBereit(s);
  const r = await s.seite.evaluate(() => window.scriptlab.testLesen());
  if (!r.ok || !r.wert.optionen.basisVerzeichnis) throw Error('Der Workflow-Arbeitsordner fehlt.');
  s.basis = r.wert.optionen.basisVerzeichnis;
  expect(s.basis).toContain(join(s.profil, 'Arbeitsdateien'));
  return datei;
}
async function textBearbeiten(s: Sitzung, id: string, text: string): Promise<void> {
  await arbeitsbereichWaehlen(s.seite, 'Ablauf');
  await s.seite.locator(`g[data-id="${id}"]`).click({ position: { x: 60, y: 18 } });
  if (!(await s.seite.getByTestId('eigenschaften-panel').isVisible()))
    await s.seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const eigenschaften = s.seite.getByTestId('eigenschaften-panel');
  const feld = eigenschaften.getByRole('textbox', { name: 'Text', exact: true });
  await expect(feld).toBeVisible();
  await feld.fill(text);
  await feld.press('Tab');
  await eigenschaften.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await expect(s.seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
}
async function runtimePruefen(s: Sitzung): Promise<PythonInstallation> {
  const antwort = await s.seite.evaluate(() => window.scriptlab.pythonPruefen());
  if (!antwort.ok) throw new Error(antwort.meldung);
  const status = antwort.wert;
  if (status.zustand !== 'bereit' || !status.installation) {
    throw new Error(`Die mitgelieferte App-Laufzeit ist nicht bereit: ${status.meldung}`);
  }
  expect(await realpath(status.installation.pfad)).toBe(
    await realpath(resolve('artifacts/python-buendel/python/python.exe')),
  );
  if (process.env.SCRIPTLAB_TEST_PYTHON_VERSION)
    expect(status.installation.version).toBe(process.env.SCRIPTLAB_TEST_PYTHON_VERSION);
  return status.installation;
}
async function testVorbereiten(s: Sitzung, sekunden = 10): Promise<void> {
  await laufansichtWaehlen(s.seite, 'Vorbereitung');
  const panel = s.seite.getByTestId('test-panel');
  await panel.getByText('ScriptLab-Arbeitsordner', { exact: true }).click();
  await expect(panel.locator('.lauf-ordnerpfad')).toHaveText(s.basis);
  await zeitlimitSetzen(s, sekunden);
}
async function zeitlimitSetzen(s: Sitzung, sekunden: number): Promise<void> {
  const panel = s.seite.getByTestId('test-panel');
  const feld = panel.getByLabel('Zeitlimit in Sekunden', { exact: true });
  await laufansichtWaehlen(s.seite, 'Vorbereitung');
  await feldEinblenden(feld);
  await expect(feld).toBeVisible();
  await feld.fill(String(sekunden));
  await feld.press('Tab');
}
async function fertig(s: Sitzung): Promise<TestZustand> {
  await expect.poll(async () => !testAktiv((await zustand(s)).phase), { timeout: 15_000 }).toBe(true);
  return zustand(s);
}
async function testStarten(s: Sitzung): Promise<void> {
  const vorher = (await zustand(s)).laufId;
  await laufStarten(s.seite);
  // Ein voriger Endzustand darf nicht schon als Ergebnis des neuen Klicks gelten.
  await expect.poll(async () => (await zustand(s)).laufId).not.toBe(vorher);
}
async function laeuftMitAusgabe(s: Sitzung, text: string): Promise<TestZustand> {
  await expect.poll(async () => (await zustand(s)).ausgabe, { timeout: 15_000 }).toContain(text);
  const lauf = await zustand(s);
  expect(lauf.phase, JSON.stringify(lauf)).toBe('laeuft');
  expect(lauf.prozessId).not.toBeNull();
  return lauf;
}
async function prozessBeendet(pid: number | null): Promise<void> {
  expect(pid).not.toBeNull();
  await expect
    .poll(
      () => {
        try {
          process.kill(pid!, 0); // Nur Existenzprüfung der bestätigten eigenen Lauf-PID.
          return false;
        } catch (fehler) {
          return (fehler as NodeJS.ErrnoException).code === 'ESRCH';
        }
      },
      { timeout: 5000 },
    )
    .toBe(true);
}

test('Python-Entwurf überlebt den Appneustart und wird nur bewusst ohne automatischen Lauf fortgesetzt', async () => {
  const s = await starten();
  try {
    await s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(s.seite, 'python');
    await editorBereit(s);
    await s.seite.getByRole('searchbox', { name: 'Bausteine suchen', exact: true }).fill('Text ausgeben');
    await s.seite.getByRole('button', { name: 'Baustein einfügen: Text ausgeben', exact: true }).click();
    await s.seite.getByRole('button', { name: /Nach.*Workflow starten/ }).click();
    await expect
      .poll(async () => (await dokument(s)).projekt.editor.blocks!.blocks[0].next?.block.type)
      .toBe('sl_output');
    const ausgabeId = (await dokument(s)).projekt.editor.blocks!.blocks[0].next!.block.id;
    await textBearbeiten(s, ausgabeId, 'ENTWURF OHNE AUTOMATISCHEN PYTHON-START ä');
    await expect
      .poll(async () => (await dokument(s)).entwurfStatus.phase, { timeout: 8000 })
      .toBe('gesichert');
    const vorher = await dokument(s);
    expect(vorher.dateiname).toBeNull();
    expect(vorher.entwurfStatus.id).not.toBeNull();
    expect((await zustand(s)).laufId).toBeNull();

    // Nur das eigene isolierte Electron beenden. Die bereits bestätigte Sicherung bleibt erhalten.
    await appBeenden(s.app);
    Object.assign(s, await starten(s.ordner));
    await expect(s.seite.getByTestId('entwuerfe-hinweis')).toContainText('1 Entwurf');
    await expect(s.seite.getByRole('button', { name: /^Weiterbearbeiten/ })).toHaveCount(0);
    expect((await zustand(s)).laufId).toBeNull();
    await s.seite.getByTestId('entwuerfe-hinweis').click();
    const liste = s.seite.getByTestId('entwuerfe');
    await liste
      .getByRole('combobox', { name: 'Entwürfe nach Sprache filtern', exact: true })
      .selectOption('vbs');
    await expect(liste.getByRole('article')).toHaveCount(0);
    await liste
      .getByRole('combobox', { name: 'Entwürfe nach Sprache filtern', exact: true })
      .selectOption('python');
    await liste
      .locator(`[data-entwurf-id="${vorher.entwurfStatus.id}"]`)
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await editorBereit(s);
    const danach = await dokument(s);
    expect(danach.projektKennung).toBe(vorher.projektKennung);
    expect(danach.projekt.skriptsprache).toBe('python');
    expect(danach.projekt.editor).toEqual(vorher.projekt.editor);
    expect(danach.projekt.ansicht.zoom).toBe(vorher.projekt.ansicht.zoom);
    expect(danach.projekt.ansicht.x).toBeCloseTo(vorher.projekt.ansicht.x, 6);
    expect(danach.projekt.ansicht.y).toBeCloseTo(vorher.projekt.ansicht.y, 6);
    expect(danach.entwurfStatus.id).toBe(vorher.entwurfStatus.id);
    expect(danach.geaendert).toBe(true);
    expect(await zustand(s)).toMatchObject({ phase: 'bereit', laufId: null, ausgabe: '' });
    await expect(s.seite.getByTestId('editor-sprache')).toHaveText('Python');
  } finally {
    await beenden(s);
  }
});

test('Python-Sprachfilter öffnet eine echte Vorlage als unabhängige Projektkopie', async () => {
  const s = await starten();
  try {
    const quelle = resolve('beispiele/06-Python-Dateinamenliste.scriptlab');
    const original = await readFile(quelle);
    const vorlage = projektPruefen(JSON.parse(original.toString('utf8')));
    await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
    const liste = s.seite.getByTestId('beispiele');
    await expect(liste.getByRole('article')).toHaveCount(11);
    await liste
      .getByRole('combobox', { name: 'Beispiele nach Sprache filtern', exact: true })
      .selectOption('python');
    await expect(liste.getByRole('article')).toHaveCount(8);
    await expect(liste.getByRole('article', { name: /VBScript/ })).toHaveCount(0);
    const karte = liste.getByRole('article', {
      name: 'Dateinamen in eine Textdatei schreiben – Python',
      exact: true,
    });
    await expect(karte).toContainText('06-Python-Dateinamenliste.scriptlab');
    await karte.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
    await editorBereit(s);
    const kopie = await dokument(s);
    expect(kopie.projekt.skriptsprache).toBe('python');
    expect(kopie.projektKennung).toMatch(/^[a-f0-9-]{36}$/i);
    expect(kopie.projektKennung).not.toBe(vorlage.projektKennung);
    expect(kopie.projekt.name).toBe(`${vorlage.name} (Kopie)`);
    expect(kopie.projekt.editor).toEqual(vorlage.editor);
    expect(kopie.dateiname).toBeNull();
    expect(kopie.geaendert).toBe(true);
    expect((await zustand(s)).laufId).toBeNull();
    expect(await readFile(quelle)).toEqual(original);
    await expect(s.seite.getByRole('button', { name: 'Exportieren', exact: true })).toBeVisible();
  } finally {
    await beenden(s);
  }
});

test('Python testet den aktuellen ungespeicherten Editorstand und erhält die gespeicherten Projektbytes', async () => {
  test.setTimeout(45_000);
  const s = await starten();
  try {
    const ausgabeblock = ausgabe('ALTER GESPEICHERTER PYTHON-TEXT');
    const datei = await oeffnen(s, projektMit(ausgabeblock));
    const original = await readFile(datei);
    const installation = await runtimePruefen(s);
    await textBearbeiten(s, ausgabeblock.id, 'AKTUELLER UNGESPEICHERTER PYTHON-TEXT ä 😀');
    await testVorbereiten(s);
    const vorTest = await dokument(s);
    await testStarten(s);
    const ende = await fertig(s);
    expect(ende.phase, JSON.stringify(ende)).toBe('beendet');
    expect(ende.exitcode).toBe(0);
    expect(ende.skriptsprache).toBe('python');
    expect(ende.pythonVersion).toBe(installation.version);
    expect(ende.projektKennung).toBe(vorTest.projektKennung);
    expect(ende.standHash).toBe(testStandHash(vorTest.projekt));
    expect(ende.ausgabe).toContain('AKTUELLER UNGESPEICHERTER PYTHON-TEXT ä 😀');
    expect(ende.ausgabe).not.toContain('ALTER GESPEICHERTER PYTHON-TEXT');
    expect(ende.optionen.basisVerzeichnis).toBe(s.basis);
    expect(await readFile(datei)).toEqual(original);
    expect((await dokument(s)).geaendert).toBe(true);
    await laufansichtWaehlen(s.seite, 'Protokoll');
    await expect(
      s.seite.getByTestId('test-panel').getByRole('log', { name: 'Laufprotokoll', exact: true }),
    ).toContainText('AKTUELLER UNGESPEICHERTER PYTHON-TEXT ä 😀');
    await expect(s.seite.getByLabel('Projektstatus', { exact: true })).toHaveText(
      'Ungespeicherte Änderungen',
    );
  } finally {
    await beenden(s);
  }
});

test('Langer Python-Test teilt die Startsperre mit VBS und endet bei Navigation, Zeitlimit und Schließversuch', async () => {
  test.setTimeout(60_000);
  const s = await starten();
  try {
    const anfang = ausgabe('PYTHON VOR PAUSE');
    // Die Pause ist länger als das feste 10-s-Limit; kein Fehlerfall wartet die ganze Pause ab.
    const pause = block('sl_sleep', { SEKUNDEN: block('sl_number', {}, { ZAHL: '30' }) });
    await oeffnen(s, projektMit(anfang, pause, ausgabe('PYTHON NACH PAUSE DARF NICHT ERSCHEINEN')));
    await runtimePruefen(s);
    await testVorbereiten(s);
    await testStarten(s);
    const erster = await laeuftMitAusgabe(s, 'PYTHON VOR PAUSE');
    await expect(s.seite.getByRole('button', { name: 'Workflow ausführen', exact: true })).toHaveCount(0);
    const vbs = neuesProjekt('vbs');
    vbs.editor.blocks!.blocks[0].next = { block: ausgabe('VBS DARF NICHT PARALLEL STARTEN') };
    const parallel = await s.seite.evaluate(async (projekt) => {
      const antwort = await window.scriptlab.testLesen();
      if (!antwort.ok) throw new Error(antwort.meldung);
      return window.scriptlab.testStarten(projekt, antwort.wert.optionen);
    }, vbs);
    expect(parallel).toMatchObject({ ok: false, meldung: 'Es läuft bereits ein Test.' });
    expect((await zustand(s)).laufId).toBe(erster.laufId);
    expect((await dokument(s)).projekt.skriptsprache).toBe('python');

    await s.seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
    expect((await fertig(s)).phase).toBe('abgebrochen');
    expect((await zustand(s)).ausgabe).not.toContain('PYTHON NACH PAUSE');
    await prozessBeendet(erster.prozessId);

    await testStarten(s);
    const navigation = await laeuftMitAusgabe(s, 'PYTHON VOR PAUSE');

    await s.app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await startseiteWaehlen(s.seite);
    await expect(s.seite.getByTestId('test-panel')).toBeVisible();
    expect((await zustand(s)).phase).toBe('laeuft');
    await s.app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    });
    await startseiteWaehlen(s.seite);
    await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
    expect((await fertig(s)).phase).toBe('abgebrochen');
    expect((await zustand(s)).ausgabe).not.toContain('PYTHON NACH PAUSE');
    await prozessBeendet(navigation.prozessId);

    await s.seite.getByRole('button', { name: /^Weiterbearbeiten/ }).click();
    await editorBereit(s);
    await zeitlimitSetzen(s, 1);
    await testStarten(s);
    const zeitlimit = await fertig(s);
    expect(zeitlimit.phase, JSON.stringify(zeitlimit)).toBe('zeitlimit');
    expect(zeitlimit.ausgabe).toContain('PYTHON VOR PAUSE');
    expect(zeitlimit.ausgabe).not.toContain('PYTHON NACH PAUSE');
    await prozessBeendet(zeitlimit.prozessId);

    await zeitlimitSetzen(s, 10);
    await textBearbeiten(s, anfang.id, 'PYTHON VOR SCHLIESSVERSUCH');
    await testStarten(s);
    const schliessen = await laeuftMitAusgabe(s, 'PYTHON VOR SCHLIESSVERSUCH');
    await s.app.evaluate(({ dialog }) => {
      const daten = globalThis as typeof globalThis & { pythonLebenszyklusDialoge: string[][] };
      daten.pythonLebenszyklusDialoge = [];
      dialog.showMessageBox = async (...argumente: unknown[]) => {
        const optionen = argumente.at(-1) as { buttons: string[] };
        daten.pythonLebenszyklusDialoge.push([...optionen.buttons]);
        return {
          response: optionen.buttons.includes('Test stoppen und fortfahren') ? 0 : 3,
          checkboxChecked: false,
        };
      };
    });
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    expect((await fertig(s)).phase).toBe('abgebrochen');
    await prozessBeendet(schliessen.prozessId);
    await expect
      .poll(() =>
        s.app.evaluate(() => {
          const daten = globalThis as typeof globalThis & { pythonLebenszyklusDialoge: string[][] };
          return daten.pythonLebenszyklusDialoge;
        }),
      )
      .toEqual([
        ['Test stoppen und fortfahren', 'Im Editor bleiben'],
        ['Speichern', 'Als Entwurf behalten', 'Änderungen verwerfen', 'Abbrechen'],
      ]);
    expect(s.app.windows()).toHaveLength(1);
    expect((await dokument(s)).geaendert).toBe(true);
    expect((await zustand(s)).ausgabe).not.toContain('PYTHON NACH PAUSE');
    await expect(s.seite.getByLabel('Projektstatus', { exact: true })).toHaveText(
      'Ungespeicherte Änderungen',
    );
  } finally {
    await beenden(s);
  }
});
