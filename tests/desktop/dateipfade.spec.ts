import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import type { Dokument } from '../../src/gemeinsam/bruecke';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';
import { arbeitsbereichWaehlen, workflowBefehl } from './ansichten';

test.skip(process.platform !== 'win32', 'Dateipfade werden mit Electron unter Windows geprüft.');
test.setTimeout(75000);

const quelleId = 'datei-quelle';
const ausgabeId = 'datei-ausgabe';
const alterName = 'C:\\Nur ein alter Bezeichner\\umsatz.csv';
const csvInhalt = 'ID;Betrag;Hinweis\r\n0001;12,50;Grüße\r\n0002;0;Prüfung\r\n';
type Sitzung = {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
  quelle: string;
  andereQuelle: string;
};
let s: Sitzung | undefined;
let ordner: string;

function sitzung(): Sitzung {
  if (!s) throw Error('Die isolierte Dateipfadsitzung fehlt.');
  return s;
}
async function dokument(): Promise<Dokument> {
  return sitzung().seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
}
async function zustand(): Promise<TestZustand> {
  return sitzung().seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand;
  });
}
function finden(p: Projekt, id: string): EditorBlock {
  const offen = [...(p.editor.blocks?.blocks ?? [])];
  while (offen.length) {
    const b = offen.pop()!;
    if (b.id === id) return b;
    if (b.next) offen.push(b.next.block);
    for (const e of Object.values(b.inputs ?? {})) {
      if (e.block) offen.push(e.block);
      if (e.shadow) offen.push(e.shadow);
    }
  }
  throw Error(`Synthetischer Testbaustein fehlt: ${id}`);
}
async function quellpfad(): Promise<unknown> {
  return JSON.parse(finden((await dokument()).projekt, quelleId).data!).konfiguration.pfad;
}
function csvProjekt(pfad: unknown = ''): Projekt {
  const p = neuesProjekt('python');
  p.name = 'Dateipfade mit synthetischen CSV-Daten';
  const schreiben: EditorBlock = {
    type: 'sl_biz_schreiben_csv',
    id: ausgabeId,
    fields: { NAME: 'CSV-Ergebnis' },
    data: JSON.stringify({
      konfiguration: {
        format: 'CSV',
        pfad: 'Geprüftes Ergebnis.csv',
        konflikt: 'FEHLER',
        optionen: { trennzeichen: ';' },
      },
      eingaben: { tabelle: { referenz: quelleId } },
    }),
  };
  p.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_biz_lesen_csv',
      id: quelleId,
      fields: { NAME: alterName },
      data: JSON.stringify({
        konfiguration: { format: 'CSV', pfad, optionen: { trennzeichen: ';' } },
        eingaben: {},
      }),
      next: { block: schreiben },
    },
  };
  return p;
}
function parameterProjekt(): Projekt {
  const p = csvProjekt({ parameter: 'Quelldatei' });
  p.business.parameter = [
    {
      name: 'Quelldatei',
      beschriftung: 'Eigene CSV-Quelle',
      typ: 'Datei',
      erforderlich: true,
      standard: 'Nur der unveränderte Standard.csv',
      hilfe: '',
    },
  ];
  return p;
}
function quellblock(): Locator {
  return sitzung().seite.locator(`g[data-id="${quelleId}"]`).first();
}
async function auswahlkonturAktuell(): Promise<void> {
  await expect(quellblock().locator(':scope > .sl-blockauswahl--innen')).toHaveCount(1);
  await expect
    .poll(() =>
      quellblock().evaluate((block) => {
        const form = block
          .querySelector(':scope > .blocklyPath:not(.blocklyPathSelected)')
          ?.getAttribute('d');
        const auswahl = block.querySelector(':scope > .sl-blockauswahl--innen')?.getAttribute('d');
        return Boolean(form && auswahl && form === auswahl);
      }),
    )
    .toBe(true);
}
async function keinLauf(): Promise<void> {
  const z = await zustand();
  expect(z.laufId).toBeNull();
  expect(z.prozessId).toBeNull();
  expect(z.gestartetAm).toBeNull();
  expect(testAktiv(z.phase)).toBe(false);
}
async function oberflaecheAbwarten(): Promise<void> {
  await sitzung().seite.evaluate(
    () =>
      new Promise<void>((fertig) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fertig, 0))),
      ),
  );
}
async function oeffnen(p: Projekt): Promise<{ datei: string; original: Buffer; basis: string }> {
  const { app, seite, ordner } = sitzung();
  const datei = join(ordner, `${p.projektKennung}.scriptlab`);
  await writeFile(datei, JSON.stringify(p), 'utf8');
  const original = await readFile(datei);
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await workflowBefehl(seite, 'oeffnen');
  await expect
    .poll(async () => {
      const d = await dokument();
      return !d.darstellungNoetig && d.projektKennung === p.projektKennung;
    })
    .toBe(true);
  await expect(quellblock()).toBeVisible();
  const r = await seite.evaluate(() => window.scriptlab.testLesen());
  if (!r.ok || !r.wert.optionen.basisVerzeichnis) throw Error('Der verwaltete Arbeitsordner fehlt.');
  return { datei, original, basis: r.wert.optionen.basisVerzeichnis };
}

/** CDP übergibt echte Betriebssystemdateien, keine nachgebildeten File.path-Eigenschaften. */
async function dateienAblegen(
  ziel: Locator,
  dateien: string[],
  textdaten?: { mimeType: string; data: string },
): Promise<void> {
  await ziel.scrollIntoViewIfNeeded();
  const rahmen = await ziel.boundingBox();
  if (!rahmen) throw Error('Das Dropziel ist nicht sichtbar.');
  const cdp = await sitzung().seite.context().newCDPSession(sitzung().seite);
  try {
    const daten = {
      x: rahmen.x + Math.min(45, rahmen.width / 2),
      y: rahmen.y + Math.min(20, rahmen.height / 2),
      data: { files: dateien, items: textdaten ? [textdaten] : [], dragOperationsMask: 1 },
    };
    await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...daten });
    await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...daten });
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...daten });
  } finally {
    await cdp.detach();
  }
  await oberflaecheAbwarten();
}
async function textOderVirtuellAblegen(ziel: Locator, art: 'html' | 'text' | 'virtuell'): Promise<void> {
  if (art !== 'virtuell') {
    await dateienAblegen(ziel, [], {
      mimeType: art === 'html' ? 'text/html' : 'text/plain',
      data:
        art === 'html'
          ? '<img src=x onerror="window.__dropAusgefuehrt=true">'
          : 'C:\\Kein echter Drop\\quelle.csv',
    });
    return;
  }
  await ziel.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['Kein Datenträgerpfad'], 'virtuell.csv', { type: 'text/csv' }));
    for (const typ of ['dragenter', 'dragover', 'drop'])
      element.dispatchEvent(new DragEvent(typ, { bubbles: true, cancelable: true, dataTransfer }));
  });
  await oberflaecheAbwarten();
}
async function eigenschaften(): Promise<Locator> {
  const seite = sitzung().seite;
  await quellblock().click({ position: { x: 20, y: 15 } });
  const panel = seite.getByTestId('eigenschaften-panel');
  if (!(await panel.isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await expect(panel).toBeVisible();
  return panel;
}

test.beforeEach(async ({}, info) => {
  s = undefined;
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Dateipfade-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  const quelle = join(ordner, 'Eigene Quelle mit Umlaut ä.csv');
  const andereQuelle = join(ordner, 'Weitere Quelle.csv');
  await writeFile(quelle, csvInhalt, 'utf8');
  await writeFile(andereQuelle, 'ID;Betrag;Hinweis\r\n0099;99;Zweite Quelle\r\n', 'utf8');
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      darstellung: info.title.startsWith('B:') ? 'dunkel' : 'hell',
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
    s = { app, seite, ordner, profil, quelle, andereQuelle };
    await app.evaluate(({ BrowserWindow, dialog }) => {
      BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
      dialog.showMessageBox = async (...argumente: unknown[]) => {
        const optionen = argumente.find((a): a is { buttons: string[] } =>
          Boolean(a && typeof a === 'object' && Array.isArray((a as { buttons?: unknown }).buttons)),
        );
        const response = optionen?.buttons.indexOf('Änderungen verwerfen') ?? -1;
        if (response < 0) throw Error('Unerwarteter nativer Dialog im Dateipfadtest.');
        return { response, checkboxChecked: false };
      };
    });
    await expect(seite).toHaveURL(/^scriptlab:\/\/app\//);
    await expect.poll(() => seite.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, 720]);
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
    await s.seite
      .evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (
          r.ok &&
          r.wert.zustand.laufId &&
          ['vorbereitung', 'laeuft', 'stoppt'].includes(r.wert.zustand.phase)
        )
          await window.scriptlab.testStoppen(r.wert.zustand.laufId);
      })
      .catch(() => {});
    const prozess = s.app.process();
    await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
  }
  const ziel = resolve(ordner);
  if (dirname(ziel) !== resolve(tmpdir()) || !basename(ziel).startsWith('ScriptLab-Dateipfade-'))
    throw Error('Unsicherer Dateipfad-Testordner.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('A: tatsächlichen CSV-Pfad inline eingeben und erst bewusst den vollständigen Workflow ausführen', async () => {
  const { seite, quelle } = sitzung();
  const geladen = await oeffnen(csvProjekt());
  expect(await quellpfad()).toBe('');
  expect(finden((await dokument()).projekt, quelleId).fields?.NAME).toBe(alterName);
  await keinLauf();
  await seite
    .getByRole('navigation', { name: 'Projektaktionen', exact: true })
    .getByRole('button', { name: 'Workflow ausführen', exact: true })
    .click();
  await expect(
    seite
      .getByTestId('statusleiste')
      .getByText('Vervollständige die markierten Bausteine vor der Ausführung.', { exact: true }),
  ).toBeVisible();
  await keinLauf();
  await expect(
    seite
      .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
      .getByRole('tab', { name: 'Daten und Parameter', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await quellblock().getByText('Pfad eingeben', { exact: true }).dblclick();
  const eingabe = seite.getByRole('textbox', { name: 'Dateipfad direkt am Baustein', exact: true });
  await eingabe.fill(quelle);
  await expect.poll(quellpfad).toBe(quelle);
  await expect(seite.getByTestId('statusleiste')).not.toContainText(
    'Vervollständige die markierten Bausteine vor der Ausführung.',
  );
  // Ein anderer offener Tippentwurf darf den echten Drop beim anschließenden Blur nicht zurücksetzen.
  await eingabe.fill('Offener Tippentwurf ohne passende Quelle.csv');
  await dateienAblegen(eingabe, [quelle]);
  await eingabe.press('Tab');
  await expect.poll(quellpfad).toBe(quelle);
  expect(finden((await dokument()).projekt, quelleId).fields?.NAME).toBe(alterName);
  await keinLauf();
  await mkdir('artifacts/qualitaet-dateipfade', { recursive: true });
  await seite.screenshot({ path: 'artifacts/qualitaet-dateipfade/inline-hell-1280.png' });
  await seite
    .getByRole('navigation', { name: 'Projektaktionen', exact: true })
    .getByRole('button', { name: 'Workflow ausführen', exact: true })
    .click();
  await expect.poll(async () => (await zustand()).laufId).not.toBeNull();
  await expect.poll(async () => !testAktiv((await zustand()).phase), { timeout: 30000 }).toBe(true);
  const z = await zustand();
  expect(z.phase, z.meldung).toBe('beendet');
  expect(z.optionen.business?.modus).toBe('ausfuehren');
  const ergebnis = (await readFile(join(geladen.basis, 'Geprüftes Ergebnis.csv'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  );
  expect(ergebnis.trim().split(/\r?\n/)).toEqual(['ID;Betrag;Hinweis', '0001;12,50;Grüße', '0002;0;Prüfung']);
  expect(await readFile(quelle, 'utf8')).toBe(csvInhalt);
  expect(await readFile(geladen.datei)).toEqual(geladen.original);
  expect((await dokument()).geaendert).toBe(true);
});

test('B: echte Datei auf Quelle ablegen, mit Undo/Redo und Speichern erneut laden', async () => {
  const { app, seite, profil, quelle } = sitzung();
  const geladen = await oeffnen(csvProjekt());
  await dateienAblegen(quellblock(), [quelle]);
  await expect.poll(quellpfad).toBe(quelle);
  await auswahlkonturAktuell();
  expect(finden((await dokument()).projekt, quelleId).fields?.NAME).toBe(alterName);
  await keinLauf();
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(quellpfad).toBe('');
  await auswahlkonturAktuell();
  await seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect.poll(quellpfad).toBe(quelle);
  await auswahlkonturAktuell();
  await mkdir('artifacts/qualitaet-dateipfade', { recursive: true });
  await seite.screenshot({ path: 'artifacts/qualitaet-dateipfade/drop-dunkel-1280.png' });
  await seite
    .getByRole('navigation', { name: 'Projektaktionen', exact: true })
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await expect.poll(async () => (await dokument()).geaendert).toBe(false);
  const gespeichert = await dokument();
  const intern = join(profil, 'Workflows', `${gespeichert.projektKennung}.scriptlab`);
  expect(finden(JSON.parse(await readFile(intern, 'utf8')), quelleId).id).toBe(quelleId);
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, intern);
  await workflowBefehl(seite, 'oeffnen');
  await expect.poll(async () => (await dokument()).darstellungNoetig).toBe(false);
  expect(await quellpfad()).toBe(quelle);
  expect(finden((await dokument()).projekt, quelleId).fields?.NAME).toBe(alterName);
  expect((await dokument()).projekt.skriptsprache).toBe('python');
  await keinLauf();
  expect(await readFile(geladen.datei)).toEqual(geladen.original);
});

test('C: Quelldatei in Eigenschaften und ausdrücklich gewählten Parameterwert per Drop übernehmen', async () => {
  const { seite, quelle, andereQuelle } = sitzung();
  await oeffnen(csvProjekt());
  const panel = await eigenschaften();
  const pfadfeld = panel.getByRole('textbox', { name: 'Dateipfad', exact: true });
  await pfadfeld.focus();
  await dateienAblegen(pfadfeld, [quelle]);
  await pfadfeld.press('Tab');
  await expect.poll(quellpfad).toBe(quelle);
  await keinLauf();
  await oeffnen(parameterProjekt());
  await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
  const daten = seite.getByTestId('datenbereich');
  await daten.getByRole('tab', { name: 'Parameterwerte', exact: true }).click();
  const parameterfeld = daten.getByRole('textbox', {
    name: 'Eigene CSV-Quelle (Pflichtangabe)',
    exact: true,
  });
  await parameterfeld.focus();
  await dateienAblegen(parameterfeld, [andereQuelle]);
  await parameterfeld.press('Tab');
  await expect
    .poll(async () => (await dokument()).projekt.business.parametersaetze.test.Quelldatei)
    .toBe(andereQuelle);
  expect((await dokument()).projekt.business.parameter[0].standard).toBe('Nur der unveränderte Standard.csv');
  expect((await dokument()).projekt.business.parametersaetze.echt).toEqual({});
  expect(await quellpfad()).toEqual({ parameter: 'Quelldatei' });
  await arbeitsbereichWaehlen(seite, 'Ablauf');
  await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
  await daten.getByRole('tab', { name: 'Parameterwerte', exact: true }).click();
  await expect(parameterfeld).toHaveValue(andereQuelle);
  await keinLauf();
});

test('D: mehrdeutige Ablagen, gebundene Quellen, Ausgabeziele und aktive Läufe bleiben geschützt', async () => {
  const { seite, quelle, andereQuelle } = sitzung();
  await oeffnen(csvProjekt());
  let vorher = (await dokument()).projekt.editor;
  await dateienAblegen(quellblock(), [quelle, andereQuelle]);
  expect((await dokument()).projekt.editor).toEqual(vorher);
  for (const art of ['html', 'text', 'virtuell'] as const) {
    await textOderVirtuellAblegen(quellblock(), art);
    expect((await dokument()).projekt.editor).toEqual(vorher);
  }
  expect(
    await seite.evaluate(() => (window as unknown as { __dropAusgefuehrt?: boolean }).__dropAusgefuehrt),
  ).toBeUndefined();
  await expect(seite).toHaveURL(/^scriptlab:\/\/app\//);
  await dateienAblegen(seite.locator(`g[data-id="${ausgabeId}"]`).first(), [quelle]);
  expect((await dokument()).projekt.editor).toEqual(vorher);
  await keinLauf();
  await oeffnen(parameterProjekt());
  const gebunden = (await dokument()).projekt;
  await dateienAblegen(quellblock(), [quelle]);
  expect((await dokument()).projekt.editor).toEqual(gebunden.editor);
  expect((await dokument()).projekt.business).toEqual(gebunden.business);
  await keinLauf();
  const lang = csvProjekt(quelle);
  const start = lang.editor.blocks!.blocks[0];
  start.next = {
    block: {
      type: 'sl_sleep',
      id: 'datei-pause',
      inputs: { SEKUNDEN: { block: { type: 'sl_number', id: 'datei-sekunden', fields: { ZAHL: 30 } } } },
      next: start.next,
    },
  };
  await oeffnen(lang);
  await seite
    .getByRole('navigation', { name: 'Projektaktionen', exact: true })
    .getByRole('button', { name: 'Workflow ausführen', exact: true })
    .click();
  await expect.poll(async () => (await zustand()).phase, { timeout: 20000 }).toBe('laeuft');
  vorher = (await dokument()).projekt.editor;
  const laufId = (await zustand()).laufId;
  await dateienAblegen(quellblock(), [andereQuelle]);
  expect((await dokument()).projekt.editor).toEqual(vorher);
  expect((await zustand()).laufId).toBe(laufId);
  await seite
    .getByRole('navigation', { name: 'Projektaktionen', exact: true })
    .getByRole('button', { name: 'Stoppen', exact: true })
    .click();
  await expect.poll(async () => (await zustand()).phase).toBe('abgebrochen');
  expect(await readFile(quelle, 'utf8')).toBe(csvInhalt);
});

test('E: VBS übernimmt einen Dateipfad nur als Textdaten am verbundenen Quellliteral', async () => {
  const { seite, quelle } = sitzung();
  const p = neuesProjekt('vbs');
  p.name = 'VBS-Dateipfad bleibt Text';
  p.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_output',
      id: 'vbs-ausgabe',
      inputs: {
        TEXT: {
          block: {
            type: 'sl_read_text',
            id: 'vbs-lesen',
            fields: { KODIERUNG: 'UTF8' },
            inputs: {
              PFAD: { block: { type: 'sl_text', id: quelleId, fields: { TEXT: 'Alter Textpfad.txt' } } },
            },
          },
        },
      },
    },
  };
  await oeffnen(p);
  await dateienAblegen(quellblock(), [quelle]);
  await expect.poll(async () => finden((await dokument()).projekt, quelleId).fields?.TEXT).toBe(quelle);
  const aktuell = (await dokument()).projekt;
  expect(aktuell.skriptsprache).toBe('vbs');
  expect(finden(aktuell, 'vbs-lesen').inputs?.PFAD.block?.id).toBe(quelleId);
  expect(finden(aktuell, 'vbs-lesen').fields?.KODIERUNG).toBe('UTF8');
  await keinLauf();
  expect(await readFile(quelle, 'utf8')).toBe(csvInhalt);
});
