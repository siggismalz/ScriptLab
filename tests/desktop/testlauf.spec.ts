import {
  workflowBefehl,
  feldEinblenden,
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
  startseiteWaehlen,
} from './ansichten';
import { sprachwahlBestaetigen } from './sprache';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';

let app: ElectronApplication, seite: Page, ordner: string, basis: string;
let n = 0;
const block = (
  type: string,
  inputs: Record<string, EditorBlock> = {},
  fields: EditorBlock['fields'] = {},
): EditorBlock => ({
  type,
  id: `testlauf_${++n}`,
  fields,
  inputs: Object.fromEntries(Object.entries(inputs).map(([name, b]) => [name, { block: b }])),
});
const text = (TEXT: string) => block('sl_text', {}, { TEXT });
const ausgabe = (inhalt: string) => block('sl_output', { TEXT: text(inhalt) });
const warten = () => block('sl_sleep', { SEKUNDEN: block('sl_number', {}, { ZAHL: '8' }) });
function projektMit(...bloecke: EditorBlock[]): Projekt {
  const p = neuesProjekt();
  p.name = 'Ausdrücklicher Desktoptest';
  for (let i = 0; i < bloecke.length - 1; i++) bloecke[i].next = { block: bloecke[i + 1] };
  p.editor.blocks!.blocks[0].next = { block: bloecke[0] };
  return p;
}
async function zustand(): Promise<TestZustand> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand;
  });
}
async function bereit() {
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      seite.evaluate(async () => {
        const r = await window.scriptlab.laden();
        return r.ok && !r.wert.dokument.darstellungNoetig;
      }),
    )
    .toBe(true);
  await seite.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}
async function oeffnen(p: Projekt, panel = true) {
  const datei = join(ordner, 'Desktoptest.scriptlab');
  await writeFile(datei, JSON.stringify(p));
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(seite, 'oeffnen');
  await bereit();
  if (panel) {
    await laufansichtWaehlen(seite, 'Vorbereitung');
    await expect(seite.getByTestId('test-panel')).toBeVisible();
  }
  return datei;
}
async function fertig() {
  await expect.poll(async () => !testAktiv((await zustand()).phase), { timeout: 15000 }).toBe(true);
  return zustand();
}
async function ausgabeErwarten(text: string) {
  await expect
    .poll(
      async () => {
        const z = await zustand();
        if (z.phase === 'fehlgeschlagen') throw Error(`${z.meldung}\n${z.technischeMeldung ?? ''}`);
        return z.ausgabe;
      },
      { timeout: 15000 },
    )
    .toContain(text);
}
test.beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Testeditor-'));
  basis = join(ordner, 'Basis ä');
  await mkdir(basis);
  app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow, dialog }) => {
    BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
    dialog.showMessageBox = async () => ({ response: 3, checkboxChecked: false });
  });
  await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await sprachwahlBestaetigen(seite);
  await bereit();
});
test.afterEach(async () => {
  if (app) {
    await seite
      .evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (r.ok && r.wert.zustand.laufId) await window.scriptlab.testStoppen(r.wert.zustand.laufId);
      })
      .catch(() => {});
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  if (dirname(resolve(ordner)) !== resolve(tmpdir()) || !basename(ordner).startsWith('ScriptLab-Testeditor-'))
    throw Error('Unsicherer Testordner.');
  await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('führt den ungespeicherten Editorstand aus und schreibt relative Dateien ausschließlich in die sichtbare Testbasis', async () => {
  const a = ausgabe('ALTER GESPEICHERTER TEXT');
  const schreiben = block(
    'sl_write_text',
    { PFAD: text('Echtes Testergebnis.txt'), TEXT: text('Nur isolierte Testdaten ä') },
    { KODIERUNG: 'UTF8' },
  );
  const datei = await oeffnen(projektMit(a, schreiben));
  const original = await readFile(datei);
  expect((await zustand()).laufId).toBeNull();
  await expect(stat(join(basis, 'Echtes Testergebnis.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
  // Explizite Wahl über denselben fachlichen Ordnerdialog wie ein Nutzer, kein allgemeiner Dateizugriff im Renderer.
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, basis);
  await seite.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
  await expect(
    seite.getByRole('textbox', { name: 'Basisordner für den nächsten Lauf', exact: true }),
  ).toHaveValue(basis);
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await seite.locator(`g[data-id="${a.id}"]`).click({ position: { x: 60, y: 18 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const feld = seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true });
  await feld.fill('NEUER UNGESPEICHERTER TEXT ä 😀');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await laufStarten(seite);
  const ende = await fertig();
  expect(ende.phase, JSON.stringify(ende)).toBe('beendet');
  expect(ende.exitcode).toBe(0);
  expect(ende.ausgabe).toContain('NEUER UNGESPEICHERTER TEXT ä 😀');
  expect(ende.ausgabe).not.toContain('ALTER GESPEICHERTER TEXT');
  expect(ende.optionen.basisVerzeichnis).toBe(basis);
  expect((await readFile(join(basis, 'Echtes Testergebnis.txt'), 'utf8')).replace(/^\uFEFF/, '')).toBe(
    'Nur isolierte Testdaten ä',
  );
  expect(await readFile(datei)).toEqual(original);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  await expect(seite.getByTestId('test-panel')).toContainText('Lauf beendet');
  await laufansichtWaehlen(seite, 'Protokoll');
  await seite.getByRole('button', { name: 'Ausgabe kopieren', exact: true }).click();
  // Fremde vorhandene Zwischenablageinhalte werden weder ausgegeben noch als Testanhang gespeichert.
  await expect
    .poll(() =>
      app.evaluate(async ({ clipboard }) =>
        (await clipboard.readText()).includes('NEUER UNGESPEICHERTER TEXT ä 😀'),
      ),
    )
    .toBe(true);
  await mkdir('artifacts/testlauf', { recursive: true });
  await seite.screenshot({ path: 'artifacts/testlauf/editor-ausgabe.png' });
});

test('zeigt einen neuen Testkontext vor dem tatsächlichen Start sichtbar an', async () => {
  await oeffnen(projektMit(ausgabe('KONTEXT BEWUSST GEPRÜFT')), false);
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  await expect(seite.getByTestId('test-panel')).toBeVisible();
  await expect(seite.getByTestId('test-panel')).toContainText(ordner);
  expect((await zustand()).laufId).toBeNull();
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  expect((await fertig()).phase).toBe('beendet');
  expect((await zustand()).ausgabe).toContain('KONTEXT BEWUSST GEPRÜFT');
});

test('erhält die gewählte Testbasis beim Speichern unter und schlägt beim erneuten Öffnen den Projektordner vor', async () => {
  const datei = await oeffnen(projektMit(ausgabe('NUR BEWUSST TESTEN')));
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, basis);
  await seite.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
  const ziel = join(ordner, 'Eigene Projektkopie.scriptlab');
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: pfad });
  }, ziel);
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Speichern unter', exact: true }).click();
  await expect.poll(async () => (await stat(ziel).catch(() => null))?.isFile()).toBe(true);
  const feld = seite.getByRole('textbox', { name: 'Basisordner für den nächsten Lauf', exact: true });
  await expect(feld).toHaveValue(basis);
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(seite, 'oeffnen');
  await bereit();
  await laufansichtWaehlen(seite, 'Vorbereitung');
  await expect(feld).toHaveValue(ordner);
  expect((await zustand()).laufId).toBeNull();
});

test('sperrt Bearbeitung, erhält Auswahl und Zoom und stoppt auch mit zugeklapptem Testpanel', async () => {
  const a = ausgabe('VOR-STOPP');
  await oeffnen(projektMit(a, warten(), ausgabe('DARF NICHT ERSCHEINEN')));
  await laufStarten(seite);
  await ausgabeErwarten('VOR-STOPP');
  await expect(seite.getByRole('button', { name: 'Workflow ausführen', exact: true })).toHaveCount(0);
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await seite.locator(`g[data-id="${a.id}"]`).click({ position: { x: 60, y: 18 } });
  await expect(seite.locator(`g[data-id="${a.id}"]`)).toHaveClass(/scriptlabAuswahl/);
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await expect(
    seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true }),
  ).toBeDisabled();
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
  expect((await fertig()).phase).toBe('abgebrochen');
  expect((await zustand()).ausgabe).not.toContain('DARF NICHT ERSCHEINEN');
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const feld = seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true });
  await expect(feld).toBeEnabled();
  await feld.fill('Nach Test geändert');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await laufansichtWaehlen(seite, 'Vorbereitung');
  await expect(seite.getByTestId('test-panel')).toContainText('seit diesem Lauf geändert');
});

test('meldet ein echtes Zeitlimit und führt nachfolgende Anweisungen nicht mehr aus', async () => {
  await oeffnen(projektMit(ausgabe('VOR-ZEITLIMIT'), warten(), ausgabe('NACH-ZEITLIMIT')));
  const zeitlimit = seite.getByLabel('Zeitlimit in Sekunden', { exact: true });
  await feldEinblenden(zeitlimit);
  await zeitlimit.fill('1');
  await laufStarten(seite);
  expect((await fertig()).phase).toBe('zeitlimit');
  expect((await zustand()).ausgabe).not.toContain('NACH-ZEITLIMIT');
  await expect(seite.getByTestId('test-panel')).toContainText('Zeitlimit erreicht');
});

test('ordnet einen echten Dateifehler dem Testbaustein zu und zeigt seine Quelltextstelle', async () => {
  const a = block(
    'sl_copy',
    { QUELLE: text('Nicht vorhanden.txt'), ZIEL: text('Ziel.txt') },
    { ZIELREGEL: 'FEHLER' },
  );
  await oeffnen(projektMit(a));
  await laufStarten(seite);
  const ende = await fertig();
  expect(ende.phase).toBe('fehlgeschlagen');
  expect(ende.fehlerBlockId).toBe(a.id);
  expect(ende.meldung).toContain('Quelldatei fehlt');
  await seite
    .getByTestId('test-panel')
    .getByRole('button', { name: 'Baustein anzeigen', exact: true })
    .click();
  await expect(seite.locator(`g[data-id="${a.id}"]`)).toHaveClass(/scriptlabAuswahl/);
  await expect(stat(join(ordner, 'Ziel.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('lässt höchstens einen Start zu und leert während eines Laufs nur die Ausgabe', async () => {
  await oeffnen(projektMit(ausgabe('EIN LAUF'), warten()));
  const versuche = await seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    const k = await window.scriptlab.testLesen();
    if (!r.ok || !k.ok) throw Error('Testdaten fehlen.');
    return Promise.all([
      window.scriptlab.testStarten(r.wert.dokument.projekt, k.wert.optionen),
      window.scriptlab.testStarten(r.wert.dokument.projekt, k.wert.optionen),
    ]);
  });
  expect(versuche.filter((r) => r.ok)).toHaveLength(1);
  await ausgabeErwarten('EIN LAUF');
  await laufansichtWaehlen(seite, 'Protokoll');
  await seite.getByRole('button', { name: 'Ausgabe leeren', exact: true }).click();
  await expect.poll(async () => (await zustand()).ausgabe).toBe('');
  expect(testAktiv((await zustand()).phase)).toBe(true);
  await seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
  expect((await fertig()).phase).toBe('abgebrochen');
});

test('lässt alte Ausgabe beim Lesen stehen und kopiert sie auch während eines echten Laufs', async () => {
  const zeilen = Array.from({ length: 50 }, (_, i) => `Lesbare Testzeile ${i + 1} ä`).join('\r\n');
  const pause = block('sl_sleep', { SEKUNDEN: block('sl_number', {}, { ZAHL: '4' }) });
  await oeffnen(
    projektMit(ausgabe(zeilen), pause, ausgabe('SPÄTERE AUSGABE'), warten(), ausgabe('NICHT ERREICHBAR')),
  );
  await laufStarten(seite);
  await ausgabeErwarten('Lesbare Testzeile 50 ä');
  await laufansichtWaehlen(seite, 'Protokoll');
  const log = seite.getByRole('log', { name: 'Laufprotokoll', exact: true });
  await log.scrollIntoViewIfNeeded();
  await log.hover();
  await seite.mouse.wheel(0, -10000);
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
  await seite.getByRole('button', { name: 'Ausgabe kopieren', exact: true }).click();
  expect(testAktiv((await zustand()).phase)).toBe(true);
  await expect
    .poll(() =>
      app.evaluate(async ({ clipboard }) => (await clipboard.readText()).includes('Lesbare Testzeile 1 ä')),
    )
    .toBe(true);
  await ausgabeErwarten('SPÄTERE AUSGABE');
  await expect(log).toContainText('SPÄTERE AUSGABE');
  expect(await log.evaluate((el) => el.scrollTop)).toBe(0);
  await seite.getByRole('button', { name: 'Zum Ausgabeende', exact: true }).click();
  await expect
    .poll(() => log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
    .toBeLessThanOrEqual(2);
  await seite.getByRole('button', { name: 'Stoppen', exact: true }).click();
  expect((await fertig()).phase).toBe('abgebrochen');
  expect((await zustand()).ausgabe).not.toContain('NICHT ERREICHBAR');
});

test('ein ungültiger Workflow und fremde Testoptionen starten keinen Prozess', async () => {
  const ungueltig = block('sl_write_text');
  await oeffnen(projektMit(ungueltig));
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await seite.getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  await expect(seite.getByTestId('hinweise-panel')).toBeVisible();
  expect((await zustand()).laufId).toBeNull();
  const r = await seite.evaluate(async () => {
    const p = await window.scriptlab.laden();
    if (!p.ok) throw Error(p.meldung);
    return window.scriptlab.testStarten(p.wert.dokument.projekt, {
      basisVerzeichnis: 'C:\\',
      zeitlimitSekunden: 1,
      interpreter: 'cmd.exe',
    } as never);
  });
  expect(r.ok).toBe(false);
  expect((await zustand()).laufId).toBeNull();
});

test('Startseite fragt nach Testende und ersetzt keinen weiterlaufenden Workflow', async () => {
  await oeffnen(projektMit(ausgabe('VOR-WECHSEL'), warten()));
  await laufStarten(seite);
  await ausgabeErwarten('VOR-WECHSEL');
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  await startseiteWaehlen(seite);
  await expect(seite.getByTestId('test-panel')).toBeVisible();
  expect(testAktiv((await zustand()).phase)).toBe(true);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  });
  await startseiteWaehlen(seite);
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  expect((await zustand()).phase).toBe('abgebrochen');
  await seite.getByRole('button', { name: /^Weiterbearbeiten/ }).click();
  await bereit();
});

test('aktiver Entwurf kann den Test-Stopp-Schutz auch über seine enge IPC nicht umgehen', async () => {
  await oeffnen(projektMit(ausgabe('ENTWURFSCHUTZ'), warten()));
  await seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    const p = { ...r.wert.dokument.projekt, name: 'Geänderter Testentwurf' };
    const a = await window.scriptlab.aendern(p);
    if (!a.ok) throw Error(a.meldung);
    const e = await window.scriptlab.entwurfSichern(p);
    if (!e.ok) throw Error(e.meldung);
  });
  // Die enge IPC wird mit dem tatsächlich gesicherten Main-Entwurf geprüft.
  const dat = await seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
  await seite.evaluate(async (d) => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    const s = await window.scriptlab.testStarten(d.projekt, r.wert.optionen);
    if (!s.ok) throw Error(s.meldung);
  }, dat);
  await ausgabeErwarten('ENTWURFSCHUTZ');
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    dialog.showSaveDialog = async () => {
      throw Error('Ein abgelehnter Testwechsel darf keinen Speicherdialog öffnen.');
    };
  });
  const r = await seite.evaluate(
    async (d) => window.scriptlab.entwurfSpeichernAls(d.projekt, d.entwurfStatus.id!),
    dat,
  );
  expect(r).toEqual({ ok: true, wert: null });
  expect(testAktiv((await zustand()).phase)).toBe(true);
});

test('Schließen stoppt zuerst den Test und verwirft ungespeicherte Änderungen nicht automatisch', async () => {
  const a = ausgabe('SCHLIESSEN');
  await oeffnen(projektMit(a, warten()));
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await seite.locator(`g[data-id="${a.id}"]`).click({ position: { x: 60, y: 18 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await seite
    .getByTestId('eigenschaften-panel')
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('SCHLIESSEN UNGESPEICHERT');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await laufStarten(seite);
  await ausgabeErwarten('SCHLIESSEN UNGESPEICHERT');
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (...args: unknown[]) => {
      const o = args.at(-1) as { buttons: string[] };
      return { response: o.buttons.includes('Test stoppen und fortfahren') ? 0 : 3, checkboxChecked: false };
    };
  });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(async () => (await zustand()).phase).toBe('abgebrochen');
  expect(app.windows()).toHaveLength(1);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
});

test('ein unerwartetes Ende des eigenen Electron-Hauptprozesses lässt keinen Testprozess zurück', async () => {
  await oeffnen(projektMit(ausgabe('VOR ECHTEM MAIN-ABBRUCH'), warten(), ausgabe('NICHT ERREICHBAR')));
  await laufStarten(seite);
  await ausgabeErwarten('VOR ECHTEM MAIN-ABBRUCH');
  await expect.poll(async () => (await zustand()).prozessId).not.toBeNull();
  const pid = (await zustand()).prozessId;
  expect(pid).not.toBeNull();
  const eigenerMain = await app.evaluate(() => process.pid);
  // Nur der bestätigte eigene Mainprozess: kein /T-Prozessbaumabbruch, der den Jobnachweis verdecken könnte.
  process.kill(eigenerMain);
  await expect
    .poll(
      () => {
        try {
          process.kill(pid!, 0);
          return true;
        } catch (e) {
          return (e as NodeJS.ErrnoException).code !== 'ESRCH';
        }
      },
      { timeout: 5000 },
    )
    .toBe(false);
});
