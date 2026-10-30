import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';
import type { Dokument } from '../../src/gemeinsam/bruecke';
import { workflowBefehl } from './ansichten';

test.skip(process.platform !== 'win32', 'Der Direktstart verwendet den festen Windows-Testhost.');
test.setTimeout(60000);

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
}

let s: Sitzung | undefined;
let ordner: string;
let nummer = 0;

function sitzung(): Sitzung {
  if (!s) throw new Error('Die isolierte Electron-Sitzung fehlt.');
  return s;
}

function block(
  type: string,
  inputs: Record<string, EditorBlock> = {},
  fields: EditorBlock['fields'] = {},
): EditorBlock {
  return {
    type,
    id: `direktstart_${++nummer}`,
    fields,
    inputs: Object.fromEntries(Object.entries(inputs).map(([name, b]) => [name, { block: b }])),
  };
}
const text = (TEXT: string) => block('sl_text', {}, { TEXT });
const ausgabe = (inhalt: string) => block('sl_output', { TEXT: text(inhalt) });
const pause = (sekunden: number) =>
  block('sl_sleep', { SEKUNDEN: block('sl_number', {}, { ZAHL: String(sekunden) }) });

function projektMit(sprache: 'vbs' | 'python', ...bloecke: EditorBlock[]): Projekt {
  const projekt = neuesProjekt(sprache);
  projekt.name = 'Isolierter Direktstart';
  for (let i = 0; i < bloecke.length - 1; i++) bloecke[i].next = { block: bloecke[i + 1] };
  projekt.editor.blocks!.blocks[0].next = { block: bloecke[0] };
  return projekt;
}

function businessBlock(type: string, konfiguration: Record<string, unknown>, eingaben = {}): EditorBlock {
  return { ...block(type), data: JSON.stringify({ konfiguration, eingaben }) };
}

function csvProjekt(quelle: string): Projekt {
  const lesen = businessBlock('sl_biz_lesen_csv', {
    format: 'CSV',
    pfad: { parameter: 'Quelle' },
    optionen: { trennzeichen: ';' },
  });
  const schreiben = businessBlock(
    'sl_biz_schreiben_csv',
    {
      format: 'CSV',
      pfad: { parameter: 'Ausgabe' },
      konflikt: 'FEHLER',
      optionen: { trennzeichen: ';' },
    },
    { tabelle: { referenz: lesen.id } },
  );
  const projekt = projektMit('python', lesen, schreiben);
  projekt.name = 'CSV mit vorhandenen Standardparametern';
  projekt.business.parameter = [
    {
      name: 'Quelle',
      beschriftung: 'Eigene CSV-Quelle',
      typ: 'Datei',
      erforderlich: true,
      standard: quelle,
      hilfe: '',
    },
    {
      name: 'Ausgabe',
      beschriftung: 'CSV-Ergebnis',
      typ: 'Datei',
      erforderlich: true,
      standard: 'Direktstart-Ergebnis.csv',
      hilfe: '',
    },
  ];
  return projekt;
}

async function zustand(): Promise<TestZustand> {
  return sitzung().seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.zustand;
  });
}

async function dokument(): Promise<Dokument> {
  return sitzung().seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument;
  });
}

function kopf(): Locator {
  return sitzung().seite.getByRole('navigation', { name: 'Projektaktionen', exact: true });
}

function kurzansicht(): Locator {
  return sitzung().seite.getByRole('region', { name: 'Aktueller Lauf', exact: true });
}

async function bleibtImAblauf(): Promise<void> {
  const seite = sitzung().seite;
  const tabs = seite.getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true });
  await expect(tabs.getByRole('tab', { name: 'Ablauf', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(tabs.getByRole('tab', { name: 'Läufe', exact: true })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await expect(seite.getByTestId('test-panel')).not.toBeVisible();
}

async function oeffnen(projekt: Projekt): Promise<{ datei: string; original: Buffer; basis: string }> {
  const { app, seite, ordner, profil } = sitzung();
  const datei = join(ordner, 'Eigene Direktstartvorlage.scriptlab');
  await writeFile(datei, JSON.stringify(projekt), 'utf8');
  const original = await readFile(datei);
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(seite, 'oeffnen');
  await expect(kopf().getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await expect.poll(async () => (await dokument()).darstellungNoetig).toBe(false);
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  await bleibtImAblauf();
  const r = await seite.evaluate(() => window.scriptlab.testLesen());
  if (!r.ok || !r.wert.optionen.basisVerzeichnis) throw new Error('Der verwaltete Arbeitsordner fehlt.');
  const basis = r.wert.optionen.basisVerzeichnis;
  expect(basis.startsWith(join(profil, 'Arbeitsdateien') + sep)).toBe(true);
  await mkdir(basis, { recursive: true });
  return { datei, original, basis };
}

async function einmalImKopfStarten(): Promise<void> {
  const vorher = await zustand();
  expect(vorher.laufId).toBeNull();
  await bleibtImAblauf();
  // Dieser einzige Klick ist die geprüfte Aktion. Weder Vorbereitung öffnen
  // noch laufStarten oder testStarten aus dem Test aufrufen.
  await kopf().getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  await expect.poll(async () => (await zustand()).laufId, { timeout: 15000 }).not.toBeNull();
  await bleibtImAblauf();
}

async function fertig(): Promise<TestZustand> {
  await expect.poll(async () => !testAktiv((await zustand()).phase), { timeout: 25000 }).toBe(true);
  return zustand();
}

async function keinProzessGestartet(): Promise<void> {
  const z = await zustand();
  expect(z.laufId).toBeNull();
  expect(z.prozessId).toBeNull();
  expect(z.gestartetAm).toBeNull();
  expect(z.ausgabe).toBe('');
  expect(testAktiv(z.phase)).toBe(false);
}

test.beforeEach(async () => {
  s = undefined;
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Direktstart-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      darstellung: 'hell',
      textSkalierung: 1,
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
  try {
    const seite = await app.firstWindow();
    s = { app, seite, ordner, profil };
    await app.evaluate(({ BrowserWindow, dialog }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
      dialog.showMessageBox = async () => ({ response: 3, checkboxChecked: false });
    });
    await expect(seite).toHaveURL(/^scriptlab:\/\/app\//);
    await expect(seite.getByRole('button', { name: 'Workflow öffnen', exact: true })).toBeVisible();
  } catch (fehler) {
    const prozess = app.process();
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
    throw fehler;
  }
});

test.afterEach(async () => {
  if (s) {
    const { app, seite } = s;
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
    const prozess = app.process();
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
  }
  const ziel = resolve(ordner);
  if (dirname(ziel) !== resolve(tmpdir()) || !basename(ziel).startsWith('ScriptLab-Direktstart-'))
    throw new Error('Unsicherer temporärer Direktstart-Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('ein Headerklick führt den ungespeicherten VBS-Stand aus und zeigt das Ergebnis im Ablauf', async () => {
  const alt = ausgabe('GESPEICHERTER ALTER TEXT');
  const schreiben = block(
    'sl_write_text',
    { PFAD: text('Direktstart.txt'), TEXT: text('Nur synthetische Direktstartdaten ä.') },
    { KODIERUNG: 'UTF8' },
  );
  const vorlage = await oeffnen(projektMit('vbs', alt, schreiben, pause(3), ausgabe('DIREKTSTART FERTIG')));
  const { seite } = sitzung();
  await seite.locator(`g[data-id="${alt.id}"]`).click({ position: { x: 60, y: 18 } });
  if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await seite
    .getByTestId('eigenschaften-panel')
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('NEUER UNGESPEICHERTER TEXT ä');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  await expect(readFile(join(vorlage.basis, 'Direktstart.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
  await einmalImKopfStarten();
  await expect(kopf().getByRole('button', { name: 'Stoppen', exact: true })).toBeVisible();
  await expect(kopf().getByRole('button', { name: 'Stoppen', exact: true })).toBeEnabled();
  await expect(kurzansicht().getByRole('log', { name: 'Laufausgabe', exact: true })).toContainText(
    'NEUER UNGESPEICHERTER TEXT ä',
  );
  const ende = await fertig();
  expect(ende.phase, JSON.stringify(ende)).toBe('beendet');
  expect(ende.exitcode).toBe(0);
  expect(ende.ausgabe).toContain('NEUER UNGESPEICHERTER TEXT ä');
  expect(ende.ausgabe).not.toContain('GESPEICHERTER ALTER TEXT');
  expect(ende.optionen.basisVerzeichnis).toBe(vorlage.basis);
  await bleibtImAblauf();
  await expect(kurzansicht()).toContainText('Workflow beendet');
  await expect(kurzansicht().getByRole('log', { name: 'Laufausgabe', exact: true })).toContainText(
    'DIREKTSTART FERTIG',
  );
  expect((await readFile(join(vorlage.basis, 'Direktstart.txt'), 'utf8')).replace(/^\uFEFF/, '')).toBe(
    'Nur synthetische Direktstartdaten ä.',
  );
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  await mkdir('artifacts/direktstart', { recursive: true });
  await seite.screenshot({ path: 'artifacts/direktstart/abgeschlossener-vbs-lauf-1280x720.png' });
});

test('Stoppen im Header beendet den direkt gestarteten Lauf ohne Wechsel in die Laufverwaltung', async () => {
  const vorlage = await oeffnen(
    projektMit('vbs', ausgabe('VOR DEM HEADERSTOPP'), pause(8), ausgabe('DARF NICHT ERSCHEINEN')),
  );
  await einmalImKopfStarten();
  await expect(kurzansicht().getByRole('log', { name: 'Laufausgabe', exact: true })).toContainText(
    'VOR DEM HEADERSTOPP',
  );
  const vorher = await zustand();
  expect(vorher.phase).toBe('laeuft');
  expect(vorher.prozessId).not.toBeNull();
  await kopf().getByRole('button', { name: 'Stoppen', exact: true }).click();
  const ende = await fertig();
  expect(ende.phase, JSON.stringify(ende)).toBe('abgebrochen');
  expect(ende.laufId).toBe(vorher.laufId);
  expect(ende.ausgabe).not.toContain('DARF NICHT ERSCHEINEN');
  await bleibtImAblauf();
  await expect(kurzansicht()).toContainText('Workflow abgebrochen');
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
});

test('ein Headerklick verarbeitet CSV mit vorhandenen Standardparametern als echte Ausführung', async () => {
  const { ordner } = sitzung();
  const eigeneDateien = join(ordner, 'Eigene Dateien ä');
  await mkdir(eigeneDateien);
  const quelle = join(eigeneDateien, 'Quelle.csv');
  const inhalt = 'Nummer;Region;Betrag\r\n001;Nord;100\r\n002;Süd;80\r\n';
  await writeFile(quelle, inhalt, 'utf8');
  const originalQuelle = await readFile(quelle);
  const vorlage = await oeffnen(csvProjekt(quelle));
  await expect(readFile(join(vorlage.basis, 'Direktstart-Ergebnis.csv'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  await einmalImKopfStarten();
  const ende = await fertig();
  expect(ende.phase, JSON.stringify(ende)).toBe('beendet');
  expect(ende.exitcode).toBe(0);
  expect(ende.optionen.business).toMatchObject({ modus: 'ausfuehren', parametersatz: 'test' });
  expect(ende.optionen.basisVerzeichnis).toBe(vorlage.basis);
  expect(
    (await readFile(join(vorlage.basis, 'Direktstart-Ergebnis.csv'), 'utf8'))
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/),
  ).toEqual(['Nummer;Region;Betrag', '001;Nord;100', '002;Süd;80']);
  expect(await readFile(quelle)).toEqual(originalQuelle);
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
  await bleibtImAblauf();
  await expect(kurzansicht()).toContainText('Workflow beendet');
});

test('Strukturfehler zeigt den bestehenden Hinweis und startet keinen Prozess', async () => {
  const vorlage = await oeffnen(projektMit('vbs', block('sl_write_text')));
  await kopf().getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  const hinweise = sitzung().seite.getByTestId('hinweise-panel');
  await expect(hinweise).toBeVisible();
  await expect(hinweise).toContainText('Bitte den Eingang');
  await keinProzessGestartet();
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
});

test('ein Direktstart ohne ML-Komponenten erklärt den fehlgeschlagenen Lauf im Editor', async () => {
  const projekt = csvProjekt('Synthetische-Quelle.csv');
  projekt.workflowArt = 'ml';
  const vorlage = await oeffnen(projekt);
  await einmalImKopfStarten();
  const ende = await fertig();
  expect(ende.phase).toBe('fehlgeschlagen');
  expect(ende.prozessId).toBeNull();
  expect(ende.workflowArt).toBe('ml');
  await bleibtImAblauf();
  await expect(kurzansicht()).toContainText('Das optionale ML-Zusatzpaket ist noch nicht eingerichtet.');
  const ml = await sitzung().seite.evaluate(() => window.scriptlab.mlLesen());
  expect(ml.ok && ml.wert.aktiv).toBe(false);
  await expect(readFile(join(vorlage.basis, 'Direktstart-Ergebnis.csv'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
});

test('fehlender Pflichtparameter öffnet Daten und Parameter ohne einen Prozess zu starten', async () => {
  const vorlage = await oeffnen(csvProjekt(''));
  const { seite } = sitzung();
  await kopf().getByRole('button', { name: 'Workflow ausführen', exact: true }).click();
  const fehler = seite.getByRole('alert').filter({ hasText: 'Fülle den Workflowparameter' });
  await expect(fehler).toBeVisible();
  await expect(fehler).toContainText('Fülle den Workflowparameter „Eigene CSV-Quelle“ aus.');
  await expect(
    seite
      .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
      .getByRole('tab', { name: 'Daten und Parameter', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await keinProzessGestartet();
  await expect(readFile(join(vorlage.basis, 'Direktstart-Ergebnis.csv'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(await readFile(vorlage.datei)).toEqual(vorlage.original);
});
