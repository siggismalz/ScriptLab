import {
  workflowBefehl,
  feldEinblenden,
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
} from './ansichten';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import type { Dokument } from '../../src/gemeinsam/bruecke';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';
import { testStandHash } from '../../src/windows/testlauf';

// Normale CI führt diese zusätzlichen Millionenlasten bewusst nicht aus.
test.skip(
  process.platform !== 'win32' || process.env.SCRIPTLAB_LAST_TESTS !== '1',
  'Benötigt Windows und die ausdrückliche Freigabe SCRIPTLAB_LAST_TESTS=1.',
);
test.describe.configure({ mode: 'serial', timeout: 90_000 });

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  basis: string;
  projektdatei: string;
  quellOriginal: string;
  quellhash: string;
}
const nachExport = 'MILLION_ERGEBNIS_BESTAETIGT';
const nachWarten = 'NACH_LANGEM_WARTEN_NICHT_ERREICHEN';

function businessBlock(
  typ: string,
  id: string,
  operation: string,
  konfiguration: Record<string, unknown>,
  tabelle?: string,
): EditorBlock {
  return {
    type: `sl_biz_${typ}`,
    id,
    data: JSON.stringify({
      konfiguration: { ...konfiguration, ...(operation === 'daten.importieren' ? { format: 'CSV' } : {}) },
      eingaben: tabelle ? { tabelle: { referenz: tabelle } } : {},
    }),
  };
}

function lastProjekt(langePause: boolean): Projekt {
  const p = neuesProjekt('python');
  p.name = langePause ? 'Millionenlast mit gezieltem Stopp' : 'Millionenlast mit Bedienung';
  const lesen = businessBlock('lesen_csv', 'last-lesen', 'daten.importieren', {
    pfad: 'noch-nicht-konfiguriert.csv',
    optionen: { trennzeichen: ';', kopfzeile: true, kodierung: 'UTF8', fehlzeilen: 'STOPP' },
  });
  const typ = businessBlock(
    'typ',
    'last-typ',
    'daten.spalten',
    {
      aktion: 'TYP',
      spalte: 'Betrag',
      typ: 'GANZZAHL',
    },
    lesen.id,
  );
  const filtern = businessBlock(
    'filtern',
    'last-filter',
    'daten.filtern',
    {
      bedingung: {
        art: 'vergleich',
        spalte: 'Region',
        operator: 'EQ',
        wert: { art: 'wert', typ: 'TEXT', wert: 'Nord' },
      },
    },
    typ.id,
  );
  const gruppieren = businessBlock(
    'gruppieren',
    'last-gruppen',
    'daten.gruppieren',
    {
      schluessel: ['Region'],
      aggregate: [
        { funktion: 'ANZAHL', name: 'Anzahl' },
        { funktion: 'SUMME', spalte: 'Betrag', name: 'Summe' },
      ],
    },
    filtern.id,
  );
  const schreiben = businessBlock(
    'schreiben_csv',
    'last-schreiben',
    'daten.exportieren',
    {
      format: 'CSV',
      pfad: 'ergebnis.csv',
      konflikt: 'FEHLER',
      optionen: { trennzeichen: ';', kodierung: 'UTF8_BOM' },
    },
    gruppieren.id,
  );
  const ausgeben = (id: string, text: string): EditorBlock => ({
    type: 'sl_output',
    id,
    inputs: { TEXT: { block: { type: 'sl_text', id: `${id}-text`, fields: { TEXT: text } } } },
  });
  const pause: EditorBlock = {
    type: 'sl_sleep',
    id: 'last-warten',
    inputs: {
      SEKUNDEN: {
        block: { type: 'sl_number', id: 'last-wartesekunden', fields: { ZAHL: langePause ? '30' : '2' } },
      },
    },
  };
  // Die kurze Beobachtungszeit hält den realen Lauf für UI-Aktionen erreichbar;
  // die JSON-Messung hält fest, welcher Business-Schritt dabei bereits erreicht war.
  const bloecke = [
    lesen,
    typ,
    filtern,
    gruppieren,
    schreiben,
    ausgeben('last-bestaetigung', nachExport),
    pause,
  ];
  if (langePause) bloecke.push(ausgeben('last-nach-warten', nachWarten));
  for (let i = 0; i < bloecke.length - 1; i++) bloecke[i].next = { block: bloecke[i + 1] };
  p.editor.blocks!.blocks[0].next = { block: bloecke[0] };
  return p;
}

async function quellDateiSchreiben(datei: string): Promise<string> {
  const f = await open(datei, 'wx');
  const hash = createHash('sha256');
  const schreiben = async (text: string) => {
    hash.update(text, 'utf8');
    await f.writeFile(text, 'utf8');
  };
  try {
    await schreiben('Nummer;Region;Betrag\r\n');
    for (let start = 0; start < 1_000_000; start += 10_000) {
      const zeilen: string[] = [];
      for (let nr = start; nr < start + 10_000; nr++)
        zeilen.push(`${String(nr).padStart(7, '0')};${nr % 2 ? 'Sued' : 'Nord'};2\r\n`);
      await schreiben(zeilen.join(''));
    }
    await f.sync();
  } finally {
    await f.close();
  }
  return hash.digest('hex');
}

async function dateiHash(pfad: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const teil of createReadStream(pfad)) hash.update(teil);
  return hash.digest('hex');
}

async function dokument(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument;
  });
}
async function stand(s: Sitzung): Promise<TestZustand> {
  return s.seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.zustand;
  });
}
async function frames(seite: Page): Promise<void> {
  await seite.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

async function vorbereiten(langePause: boolean): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-BusinessLast-'));
  const basis = join(ordner, 'Eigene Testdaten');
  const profil = join(ordner, 'Profil');
  let app: ElectronApplication | undefined;
  try {
    await mkdir(basis);
    await mkdir(profil);
    const installation = JSON.parse(
      await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
    ).installation;
    await writeFile(
      join(profil, 'einstellungen.json'),
      JSON.stringify({
        automatischeUpdates: false,
        vorabversionen: false,
        letzteSkriptsprache: null,
        pythonInterpreter: installation.pfad,
      }),
    );
    const quellhash = await quellDateiSchreiben(join(basis, 'million.csv'));
    const projektdatei = join(basis, 'Million.scriptlab');
    await writeFile(projektdatei, JSON.stringify(lastProjekt(langePause)));
    app = await electron.launch({
      args: [resolve('.'), '--force-device-scale-factor=1'],
      cwd: ordner,
      env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
    });
    const seite = await app.firstWindow();
    const s = {
      app,
      seite,
      ordner,
      basis,
      projektdatei,
      quellhash,
      quellOriginal: join(basis, 'million.csv'),
    };
    await app.evaluate(({ BrowserWindow, dialog }, pfad) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    }, projektdatei);
    await workflowBefehl(seite, 'oeffnen');
    await expect(seite.getByTestId('palette')).toBeVisible();
    await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
    await expect.poll(async () => (await dokument(s)).darstellungNoetig).toBe(false);
    const kontext = await seite.evaluate(() => window.scriptlab.testLesen());
    if (!kontext.ok || !kontext.wert.optionen.basisVerzeichnis)
      throw new Error('Der verwaltete Workflow-Arbeitsordner fehlt.');
    s.basis = kontext.wert.optionen.basisVerzeichnis;
    await mkdir(s.basis, { recursive: true });
    await copyFile(s.quellOriginal, join(s.basis, 'million.csv'));
    await frames(seite);
    // Ein echter ungespeicherter Editorwert ist erforderlich: die gespeicherte
    // Fixture verweist absichtlich auf eine nicht vorhandene andere Quelle.
    await seite.locator('g[data-id="last-lesen"]').click({ position: { x: 60, y: 18 } });
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    await seite
      .getByTestId('eigenschaften-panel')
      .getByRole('textbox', { name: 'Dateipfad', exact: true })
      .fill('million.csv');
    await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
    await expect
      .poll(
        async () =>
          JSON.parse((await dokument(s)).projekt.editor.blocks!.blocks[0].next!.block.data!).konfiguration
            .pfad,
      )
      .toBe('million.csv');
    await laufansichtWaehlen(seite, 'Vorbereitung');
    const panel = seite.getByTestId('test-panel');
    await expect(panel).toBeVisible();
    await panel.getByLabel('Modus', { exact: true }).selectOption('ausfuehren');
    const laufprofil = panel.getByLabel('Laufprofil', { exact: true });
    await feldEinblenden(laufprofil);
    await laufprofil.selectOption('kurz');
    const arbeitsordner = panel.locator('.lauf-ordnerpfad');
    await feldEinblenden(arbeitsordner);
    await expect(arbeitsordner).toHaveText(s.basis);
    await expect(panel.getByLabel('Laufprofil', { exact: true })).toHaveValue('kurz');
    return s;
  } catch (fehler) {
    if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await tempEntfernen(ordner);
    throw fehler;
  }
}

async function tempEntfernen(ordner: string): Promise<void> {
  const ziel = resolve(ordner);
  if (dirname(ziel) !== resolve(tmpdir()) || !basename(ziel).startsWith('ScriptLab-BusinessLast-'))
    throw new Error('Unsicherer eigener Lasttestordner.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
async function aufraeumen(s: Sitzung): Promise<void> {
  const prozess = s.app.process();
  let stoppFrist: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      s.seite
        .evaluate(async () => {
          const r = await window.scriptlab.testLesen();
          if (r.ok && r.wert.zustand.laufId) await window.scriptlab.testStoppen(r.wert.zustand.laufId);
        })
        .catch(() => {}),
      new Promise<void>((r) => {
        stoppFrist = setTimeout(r, 5000);
      }),
    ]);
  } finally {
    clearTimeout(stoppFrist);
  }
  // Nur der selbst gestartete Electron-Prozess als letzte Testbereinigung.
  // Sein Pipe-Ende schließt den bestehenden Kill-on-close-Job.
  const notbremse = setTimeout(() => {
    if (prozess.exitCode === null) prozess.kill();
  }, 5000);
  try {
    await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  } finally {
    clearTimeout(notbremse);
  }
  await expect
    .poll(() => prozess.exitCode !== null || prozess.signalCode !== null, { timeout: 5000 })
    .toBe(true);
  await tempEntfernen(s.ordner);
}

async function starten(s: Sitzung): Promise<{ zeit: number; waechter: ReturnType<typeof setTimeout> }> {
  const zeit = performance.now();
  const waechter = setTimeout(() => {
    // Feste zusätzliche Testfrist; ausschließlich der aktuelle verwaltete Job.
    void s.seite
      .evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (r.ok && r.wert.zustand.laufId) await window.scriptlab.testStoppen(r.wert.zustand.laufId);
      })
      .catch(() => {});
  }, 55_000);
  try {
    await laufStarten(s.seite);
    await expect
      .poll(
        async () => {
          const z = await stand(s);
          if (['fehlgeschlagen', 'zeitlimit'].includes(z.phase))
            throw new Error(`${z.meldung}\n${z.technischeMeldung ?? ''}`);
          return z.phase;
        },
        { timeout: 15_000, intervals: [20] },
      )
      .toBe('laeuft');
    const gestartet = await stand(s);
    expect(gestartet.gestartetAm).not.toBeNull();
    expect(gestartet.prozessId).toBeGreaterThan(0);
    expect(gestartet.optionen.zeitlimitSekunden).toBe(120);
    expect(gestartet.standHash).toBe(testStandHash((await dokument(s)).projekt));
    return { zeit, waechter };
  } catch (fehler) {
    clearTimeout(waechter);
    throw fehler;
  }
}

async function ergebnisPruefen(s: Sitzung): Promise<string> {
  const text = (await readFile(join(s.basis, 'ergebnis.csv'), 'utf8')).replace(/^\uFEFF/, '').trim();
  expect(text.split(/\r?\n/).map((z) => z.split(';'))).toEqual([
    ['Region', 'Anzahl', 'Summe'],
    ['Nord', '500000', '1000000'],
  ]);
  expect(await dateiHash(join(s.basis, 'million.csv'))).toBe(s.quellhash);
  expect(await dateiHash(s.quellOriginal)).toBe(s.quellhash);
  const gespeichert = JSON.parse(await readFile(s.projektdatei, 'utf8')) as Projekt;
  expect(JSON.parse(gespeichert.editor.blocks!.blocks[0].next!.block.data!).konfiguration.pfad).toBe(
    'noch-nicht-konfiguriert.csv',
  );
  return dateiHash(join(s.basis, 'ergebnis.csv'));
}

async function nachweis(s: Sitzung, name: string, daten: Record<string, unknown>): Promise<void> {
  await mkdir(resolve('artifacts/qualitaet-desktop/business-last'), { recursive: true });
  await s.seite.screenshot({ path: resolve(`artifacts/qualitaet-desktop/business-last/${name}.png`) });
  await writeFile(
    resolve(`artifacts/qualitaet-desktop/business-last/${name}.json`),
    JSON.stringify(
      {
        version: 1,
        synthetischeDaten: true,
        zeilen: 1_000_000,
        ...daten,
      },
      null,
      2,
    ) + '\n',
  );
}

test('Business-Last: Millionenzeilenlauf verwendet den aktuellen Editorstand und bleibt bedienbar', async () => {
  const s = await vorbereiten(false);
  let lauf: Awaited<ReturnType<typeof starten>> | undefined;
  try {
    lauf = await starten(s);
    await expect
      .poll(
        async () =>
          (await stand(s)).business?.ereignisse.some(
            (e) => e.art === 'schritt' && e.block_id === 'last-lesen' && e.status === 'begonnen',
          ),
        { timeout: 15_000, intervals: [20] },
      )
      .toBe(true);
    const vorher = await stand(s);
    expect(vorher.phase).toBe('laeuft');
    await arbeitsbereichWaehlen(s.seite, 'Ablauf');
    const zoomVorher = (await dokument(s)).projekt.ansicht.zoom;
    const antwortStart = performance.now();
    await s.seite.getByRole('button', { name: 'Vergrößern', exact: true }).click({ timeout: 2000 });
    await expect
      .poll(async () => (await dokument(s)).projekt.ansicht.zoom, { timeout: 2000, intervals: [20] })
      .toBeGreaterThan(zoomVorher);
    const zoomAntwortMs = performance.now() - antwortStart;
    expect(zoomAntwortMs).toBeLessThan(2000);
    const verschiebenStart = performance.now();
    const vorAnsicht = (await dokument(s)).projekt.ansicht;
    await s.seite
      .getByRole('button', { name: 'Arbeitsbereich verschieben', exact: true })
      .click({ timeout: 2000 });
    await s.seite.getByRole('menuitem', { name: 'Nach rechts', exact: true }).click({ timeout: 2000 });
    await expect
      .poll(async () => (await dokument(s)).projekt.ansicht.x, { timeout: 2000, intervals: [20] })
      .not.toBe(vorAnsicht.x);
    const verschiebenAntwortMs = performance.now() - verschiebenStart;
    expect(verschiebenAntwortMs).toBeLessThan(2000);
    await expect.poll(async () => testAktiv((await stand(s)).phase), { timeout: 40_000 }).toBe(false);
    const ende = await stand(s);
    expect(
      ende.phase,
      JSON.stringify({ phase: ende.phase, meldung: ende.meldung, technik: ende.technischeMeldung }),
    ).toBe('beendet');
    expect(ende.exitcode).toBe(0);
    const ausgabeSha256 = await ergebnisPruefen(s);
    expect(performance.now() - lauf.zeit).toBeLessThan(60_000);
    await nachweis(s, 'million-bedienung', {
      phaseVorBedienung: vorher.phase,
      businessSchrittVorBedienung: vorher.business?.schritt ?? null,
      zoomAntwortMs,
      verschiebenAntwortMs,
      dauerMs: performance.now() - lauf.zeit,
      phase: ende.phase,
      exitcode: ende.exitcode,
      ausgabeSha256,
      ungespeicherteQuelleVerwendet: true,
    });
  } finally {
    if (lauf) clearTimeout(lauf.waechter);
    await aufraeumen(s);
  }
});

test('Business-Last: stoppt nach Millionenverarbeitung den Warteblock und erhält bestätigte Ergebnisse', async () => {
  const s = await vorbereiten(true);
  let lauf: Awaited<ReturnType<typeof starten>> | undefined;
  try {
    lauf = await starten(s);
    await expect
      .poll(
        async () => {
          const z = await stand(s);
          if (!testAktiv(z.phase))
            throw new Error(`Der Lauf endete vor dem gezielten Stopp: ${z.phase} ${z.meldung}`);
          return z.ausgabe;
        },
        { timeout: 30_000, intervals: [25] },
      )
      .toContain(nachExport);
    const ausgabeSha256 = await ergebnisPruefen(s);
    const vorher = await stand(s);
    expect(vorher.phase).toBe('laeuft');
    const stopStart = performance.now();
    await s.seite.getByTestId('test-panel').getByRole('button', { name: 'Stoppen', exact: true }).click();
    await expect
      .poll(async () => testAktiv((await stand(s)).phase), { timeout: 8000, intervals: [50] })
      .toBe(false);
    const ende = await stand(s);
    const stoppenMs = performance.now() - stopStart;
    expect(ende.phase).toBe('abgebrochen');
    expect(ende.exitcode).not.toBeNull();
    expect(ende.ausgabe).not.toContain(nachWarten);
    expect(await dateiHash(join(s.basis, 'ergebnis.csv'))).toBe(ausgabeSha256);
    expect(s.app.process().exitCode).toBeNull();
    await expect(s.seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
    await arbeitsbereichWaehlen(s.seite, 'Ablauf');
    await s.seite.locator('g[data-id="last-lesen"]').click({ position: { x: 60, y: 18 } });
    await s.seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
    const feld = s.seite
      .getByTestId('eigenschaften-panel')
      .getByRole('textbox', { name: 'Dateipfad', exact: true });
    await expect(feld).toBeEditable();
    await feld.fill('nach-stopp-nur-bearbeitet.csv');
    await feld.blur();
    await expect
      .poll(
        async () =>
          JSON.parse((await dokument(s)).projekt.editor.blocks!.blocks[0].next!.block.data!).konfiguration
            .pfad,
      )
      .toBe('nach-stopp-nur-bearbeitet.csv');
    expect(performance.now() - lauf.zeit).toBeLessThan(60_000);
    await nachweis(s, 'million-stoppen', {
      phaseVorStopp: vorher.phase,
      phase: ende.phase,
      exitcode: ende.exitcode,
      stoppenMs,
      dauerMs: performance.now() - lauf.zeit,
      ausgabeSha256,
      ausgabeNachStoppErhalten: true,
      editorWiederBearbeitbar: true,
    });
  } finally {
    if (lauf) clearTimeout(lauf.waechter);
    await aufraeumen(s);
  }
});
