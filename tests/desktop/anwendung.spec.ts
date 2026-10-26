import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, readFile, writeFile, rm, mkdir, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import { bausteinDefinitionen } from '../../src/kern/katalog';

let app: ElectronApplication;
let seite: Page;
let ordner: string;
const projektDateiname = 'Mein Projekt.scriptlab';
const nachrichtName = bausteinDefinitionen.find((b) => b.typ === 'sl_message')!.name;
const kommentarName = bausteinDefinitionen.find((b) => b.typ === 'sl_comment')!.name;

// Die Tests bilden einen zusammenhängenden echten Bearbeitungsweg ab.
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'scriptlab-desktop-'));
  app = await electron.launch({
    args: ['.'],
    cwd: resolve('.'),
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'einstellungen') },
  });
  seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByTestId('statusleiste')).toBeVisible();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Neues Projekt');
});
test.afterAll(async () => {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (ordner) {
    const ziel = resolve(ordner);
    if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('scriptlab-desktop-'))
      throw new Error('Unsicherer temporärer Testpfad.');
    await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

async function projektLesen(): Promise<Projekt> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument.projekt;
  });
}
async function speicherziel(datei: string | null) {
  await app.evaluate(({ dialog }, ziel) => {
    dialog.showSaveDialog = async () => ({ canceled: ziel === null, filePath: ziel ?? '' });
  }, datei);
}
async function oeffnungsziel(datei: string | null) {
  await app.evaluate(({ dialog }, ziel) => {
    dialog.showOpenDialog = async () => ({ canceled: ziel === null, filePaths: ziel ? [ziel] : [] });
  }, datei);
}
async function verlustAntwort(response: number) {
  await app.evaluate(({ dialog }, wert) => {
    dialog.showMessageBox = async (...argumente: unknown[]) => {
      const optionen = argumente.at(-1) as { buttons?: string[] };
      (
        globalThis as typeof globalThis & { scriptlabTestDialogKnoepfe?: string[] }
      ).scriptlabTestDialogKnoepfe = optionen.buttons;
      return { response: wert, checkboxChecked: false };
    };
  }, response);
}
async function menueAktion(menue: 'Projektmenü' | 'Weitere Funktionen', eintrag: string) {
  await seite.getByRole('button', { name: menue, exact: true }).click();
  await seite.getByRole('menuitem', { name: eintrag, exact: true }).click();
}
async function projektangaben(name?: string, beschreibung?: string) {
  await menueAktion('Projektmenü', 'Projektangaben');
  const dialog = seite.getByRole('dialog', { name: 'Projektangaben', exact: true });
  await expect(dialog).toBeVisible();
  if (name !== undefined) await dialog.getByRole('textbox', { name: 'Projektname', exact: true }).fill(name);
  if (beschreibung !== undefined)
    await dialog.getByRole('textbox', { name: 'Projektbeschreibung', exact: true }).fill(beschreibung);
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function vorschauOeffnen() {
  if (!(await seite.getByTestId('code-panel').isVisible()))
    await seite.getByRole('button', { name: 'Codevorschau', exact: true }).click();
  await expect(seite.getByTestId('code-panel')).toBeVisible();
}
async function nachrichtBearbeiten(text: string) {
  const p = await projektLesen();
  const id = p.editor.blocks!.blocks[0].next!.block.id;
  await seite.locator(`g[data-id="${id}"]`).click({ position: { x: 60, y: 18 } });
  if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const feld = seite.getByTestId('eigenschaften-panel').getByRole('textbox', { name: 'Text', exact: true });
  await expect(feld).toBeVisible();
  expect(await feld.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  await feld.fill(text);
  return feld;
}

test('beginnt mit einem leeren Start und isoliert den Renderer', async () => {
  await expect(seite.getByTestId('code-panel')).toHaveCount(0);
  await expect(seite.getByTestId('eigenschaften-panel')).toHaveCount(0);
  const p = await projektLesen();
  expect(p.editor.blocks!.blocks).toHaveLength(1);
  expect(p.editor.blocks!.blocks[0].type).toBe('sl_start');
  expect(p.editor.blocks!.blocks[0].next).toBeUndefined();
  await expect(seite.getByText('Füge links einen Baustein hinzu.', { exact: true }).first()).toBeVisible();
  expect(
    await seite.evaluate(() => ({
      require: typeof (window as any).require,
      process: typeof (window as any).process,
      schnittstelle: Object.keys(window.scriptlab),
    })),
  ).toEqual({
    require: 'undefined',
    process: 'undefined',
    schnittstelle: [
      'laden',
      'aendern',
      'darstellungBereit',
      'beiStandAnfrage',
      'neu',
      'oeffnen',
      'beispielOeffnen',
      'speichern',
      'exportieren',
      'exportOrdnerAnzeigen',
      'zertifikate',
      'einstellungenSpeichern',
      'updateAktion',
    ],
  });
  expect(
    await app.evaluate(({ BrowserWindow }) => {
      const p = (
        BrowserWindow.getAllWindows()[0].webContents as Electron.WebContents & {
          getLastWebPreferences(): Electron.WebPreferences;
        }
      ).getLastWebPreferences();
      return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
    }),
  ).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
  await expect(
    seite
      .getByRole('navigation', { name: 'Projektaktionen' })
      .getByRole('button', { name: /Starten|Testlauf|Ausführen/ }),
  ).toHaveCount(0);
});

test('findet, fügt ein, konfiguriert und verbindet eine Nachricht ohne gehaltene Maustaste', async () => {
  const palette = seite.getByTestId('palette');
  await palette.getByRole('searchbox', { name: 'Bausteine suchen' }).fill('Nachricht');
  await palette.getByRole('button', { name: `Baustein einfügen: ${nachrichtName}`, exact: true }).click();
  await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
  await expect
    .poll(async () => (await projektLesen()).editor.blocks!.blocks[0].next?.block.type)
    .toBe('sl_message');
  await nachrichtBearbeiten('Hallo! Erstellt mit ScriptLab.');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await vorschauOeffnen();
  const code = seite.getByLabel('Schreibgeschützte VBS-Codevorschau', { exact: true });
  await expect(code).toContainText('Option Explicit');
  await expect(code).toContainText('Hallo! Erstellt mit ScriptLab.');
  expect(
    await code.evaluate((el) => ({ tag: el.tagName, editierbar: el.getAttribute('contenteditable') })),
  ).toEqual({ tag: 'PRE', editierbar: null });
  await palette.getByRole('button', { name: 'Suche leeren', exact: true }).first().click();
});

test('exportiert echte UTF16LE-BOM-Bytes mit CRLF, Umlauten und Dialogabbruch', async () => {
  await nachrichtBearbeiten('Grüße "Leon"\nC:\\Mein Ordner\\Datei.txt');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await speicherziel(null);
  await seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Als VBS exportieren', exact: true })).toBeEnabled();
  await expect(seite.getByRole('status', { name: 'Export abgeschlossen' })).toHaveCount(0);
  const ziel = join(ordner, 'Grüße mit Leerzeichen.vbs');
  await speicherziel(ziel);
  await seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
  const meldung = seite.getByRole('status', { name: 'Export abgeschlossen' });
  await expect(meldung).toContainText(
    'Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.',
  );
  await expect(meldung).toContainText('Nicht signiert');
  const bytes = await readFile(ziel);
  expect([...bytes.subarray(0, 2)]).toEqual([255, 254]);
  const code = bytes.subarray(2).toString('utf16le');
  expect(code).toContain('Option Explicit\r\n');
  expect(code).toContain('Grüße ""Leon""');
  expect(code).toContain('niemals ausgeführt.');
  expect(code).toContain('C:\\Mein Ordner\\Datei.txt');
  expect(code).not.toMatch(/(?<!\r)\n/);
  await seite.getByRole('button', { name: 'Exportmeldung schließen' }).click();
});

test('speichert den sofortigen Editorstand und erhält Namen, Verbindungen und Zoom beim Öffnen', async () => {
  const ziel = join(ordner, projektDateiname);
  await speicherziel(ziel);
  await projektangaben('Dateien und Grüße');
  await nachrichtBearbeiten('Letzter Text vor dem Speichern.');
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  const sofortGespeichert = JSON.parse(await readFile(ziel, 'utf8')) as Projekt;
  expect(
    sofortGespeichert.editor.blocks!.blocks[0].next!.block.inputs!.TEXT.block?.fields?.TEXT ??
      sofortGespeichert.editor.blocks!.blocks[0].next!.block.inputs!.TEXT.shadow?.fields?.TEXT,
  ).toBe('Letzter Text vor dem Speichern.');
  await seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await expect(seite.getByTestId('eigenschaften-panel')).toBeVisible();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  const gespeichert = JSON.parse(await readFile(ziel, 'utf8')) as Projekt;
  expect(gespeichert.name).toBe('Dateien und Grüße');
  expect(gespeichert.ansicht.zoom).toBeGreaterThan(1);
  expect(
    gespeichert.editor.blocks!.blocks[0].next!.block.inputs!.TEXT.block?.fields?.TEXT ??
      gespeichert.editor.blocks!.blocks[0].next!.block.inputs!.TEXT.shadow?.fields?.TEXT,
  ).toBe('Letzter Text vor dem Speichern.');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await seite.getByRole('button', { name: 'Neu', exact: true }).click();
  await expect.poll(async () => (await projektLesen()).name).toBe('Mein Workflow');
  await oeffnungsziel(ziel);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect.poll(async () => (await projektLesen()).name).toBe('Dateien und Grüße');
  expect((await projektLesen()).editor).toEqual(gespeichert.editor);
  expect((await projektLesen()).ansicht.zoom).toBe(gespeichert.ansicht.zoom);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
});

test('verhindert Projektverlust bei Abbruch und schützt unbekannte Formate', async () => {
  await projektangaben(undefined, 'Letzte Änderung bleibt erhalten.');
  await verlustAntwort(2);
  await seite.getByRole('button', { name: 'Neu', exact: true }).click();
  await expect.poll(async () => (await projektLesen()).beschreibung).toBe('Letzte Änderung bleibt erhalten.');
  expect(
    await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { scriptlabTestDialogKnoepfe?: string[] })
          .scriptlabTestDialogKnoepfe,
    ),
  ).toEqual(['Speichern', 'Nicht speichern', 'Abbrechen']);
  await speicherziel(null);
  await menueAktion('Projektmenü', 'Speichern unter');
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  const vorher = await projektLesen();
  const datei = join(ordner, 'zu-neu.scriptlab');
  await writeFile(datei, JSON.stringify({ ...neuesProjekt(), schemaVersion: 99 }));
  await oeffnungsziel(datei);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(seite.getByRole('alert')).toContainText('neueren Dateiformat');
  expect(await projektLesen()).toEqual(vorher);
  expect(JSON.parse(await readFile(datei, 'utf8')).schemaVersion).toBe(99);
  await seite.getByRole('button', { name: 'Fehlermeldung schließen' }).click();
  await oeffnungsziel(null);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  expect(await projektLesen()).toEqual(vorher);
});

test('zeigt Exportfehler verständlich und erhält vorhandene Ziele', async () => {
  const ziel = join(ordner, 'Ordner.vbs');
  await mkdir(ziel);
  await speicherziel(ziel);
  await seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
  await expect(seite.getByRole('alert')).toContainText(/Zugriff|Dateivorgang/);
  expect((await stat(ziel)).isDirectory()).toBe(true);
  await expect(seite.getByRole('status', { name: 'Export abgeschlossen' })).toHaveCount(0);
  await seite.getByRole('button', { name: 'Fehlermeldung schließen' }).click();
});

test('sucht mit und ohne Treffer und öffnet das lokale Beispiel über das Projektmenü', async () => {
  const palette = seite.getByTestId('palette');
  const suche = palette.getByRole('searchbox', { name: 'Bausteine suchen' });
  await suche.fill('Nachricht');
  await expect(
    palette.getByRole('button', { name: `Baustein einfügen: ${nachrichtName}`, exact: true }),
  ).toBeVisible();
  await expect(palette.getByText('Ein- und Ausgaben · Anweisung', { exact: true })).toBeVisible();
  await suche.fill('kein-baustein-mit-diesem-namen');
  await expect(palette.getByRole('status')).toHaveText('Keine Bausteine gefunden');
  await palette.getByRole('button', { name: 'Suche leeren', exact: true }).first().click();
  await expect(palette.getByRole('button', { name: 'Ein- und Ausgaben', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await menueAktion('Projektmenü', 'Beispiel: Begrüßung');
  const beispiel = JSON.parse(
    await readFile(resolve('beispiele/01-Begruessung.scriptlab'), 'utf8'),
  ) as Projekt;
  await expect.poll(async () => (await projektLesen()).name).toBe(beispiel.name);
  expect((await projektLesen()).editor.blocks!.blocks[0].next!.block.type).toBe('sl_message');
});

test('prüft Credits, Zertifikatsauflistung und die gesperrten Entwicklerupdates', async () => {
  await menueAktion('Weitere Funktionen', 'Über ScriptLab');
  await expect(seite.getByRole('dialog', { name: 'Über ScriptLab', exact: true })).toContainText(
    'Entwickelt von Leon Stolz',
  );
  await seite.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
  await menueAktion('Weitere Funktionen', 'Einstellungen');
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await expect(dialog.getByRole('checkbox', { name: 'Automatisch nach Updates suchen' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Nach Updates suchen', exact: true }).click();
  await expect(dialog).toContainText('Entwicklungsmodus');
  await expect(dialog.getByRole('button', { name: 'Update herunterladen', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('progressbar')).toHaveCount(0);
  const update = await seite.evaluate(() => window.scriptlab.updateAktion('laden'));
  expect(update.ok && (update.wert as { phase: string }).phase).toBe('nicht-eingerichtet');
  await dialog.getByRole('checkbox', { name: 'Exportierte Datei signieren' }).check();
  await dialog.getByRole('button', { name: 'Zertifikate laden', exact: true }).click();
  await expect(dialog).toContainText(/Kein geeignetes Zertifikat|geeignete Zertifikate gefunden/);
  await dialog.getByRole('checkbox', { name: 'Exportierte Datei signieren' }).uncheck();
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
});

test('Schließen liest den letzten Stand und bricht bei ungespeicherten Änderungen ab', async () => {
  await verlustAntwort(2);
  await projektangaben('Noch nicht gespeichert');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(async () => (await projektLesen()).name).toBe('Noch nicht gespeichert');
  await expect.poll(async () => app.windows().length).toBe(1);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Ungespeicherte Änderungen');
  await seite.screenshot({ path: 'artifacts/editor-windows.png' });
});

test('fügt per Klick ein, meldet lose Anweisungen und erhält Kopieren sowie Rückgängig', async () => {
  await verlustAntwort(1);
  await seite.getByRole('button', { name: 'Neu', exact: true }).click();
  const palette = seite.getByTestId('palette');
  await palette.getByRole('searchbox', { name: 'Bausteine suchen' }).fill('Kommentar');
  await palette.getByRole('button', { name: `Baustein einfügen: ${kommentarName}`, exact: true }).click();
  await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
  await vorschauOeffnen();
  await expect(seite.locator('.code')).toContainText("' Mein Hinweis");
  await menueAktion('Weitere Funktionen', 'Kopieren');
  await menueAktion('Weitere Funktionen', 'Einfügen');
  await seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
  await expect(seite.getByTestId('hinweise-panel')).toContainText('nicht mit dem Startablauf verbunden');
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(seite.getByTestId('hinweise-panel')).toContainText('keine erkannten Strukturfehler');
  await seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect(seite.getByTestId('hinweise-panel')).toContainText('nicht mit dem Startablauf verbunden');
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await seite.getByRole('button', { name: 'Hinweise schließen', exact: true }).click();
});

test('hält den Fokus im Dialog und kehrt zum Auslöser zurück', async () => {
  await expect
    .poll(() => seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await menueAktion('Weitere Funktionen', 'Einstellungen');
  await seite.getByRole('button', { name: 'Dialog schließen', exact: true }).focus();
  await seite.keyboard.press('Shift+Tab');
  expect(
    await seite
      .getByRole('dialog', { name: 'Einstellungen', exact: true })
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await seite.keyboard.press('Escape');
  await expect(seite.getByRole('dialog', { name: 'Einstellungen', exact: true })).not.toBeVisible();
  await expect(seite.getByRole('button', { name: 'Weitere Funktionen', exact: true })).toBeFocused();
});

test('exportiert einen kombinierten Ablauf ohne dessen Dateiaktionen auszuführen', async () => {
  const zielDatei = join(ordner, 'Dieser Workflow darf nichts schreiben.txt');
  const p = neuesProjekt();
  const b = (
    type: string,
    id: string,
    fields: EditorBlock['fields'] = {},
    inputs: Record<string, EditorBlock> = {},
  ): EditorBlock => ({
    type,
    id,
    fields,
    inputs: Object.fromEntries(Object.entries(inputs).map(([name, block]) => [name, { block }])),
  });
  const text = (id: string, TEXT: string) => b('sl_text', id, { TEXT });
  const frage = b(
    'sl_set',
    'name-setzen',
    { VAR: 'Name' },
    { WERT: b('sl_input', 'namen-abfragen', {}, { TEXT: text('frage', 'Wie heißt du?') }) },
  );
  const schleife = b(
    'sl_repeat',
    'wiederholen',
    {},
    {
      ANZAHL: b('sl_number', 'anzahl', { ZAHL: '2' }),
      ABLAUF: b(
        'sl_log',
        'protokoll',
        {},
        { PFAD: text('ziel', zielDatei), TEXT: b('sl_get', 'name-lesen', { VAR: 'Name' }) },
      ),
    },
  );
  frage.next = {
    block: b(
      'sl_if',
      'bedingung',
      {},
      {
        BEDINGUNG: b(
          'sl_compare',
          'vergleich',
          { OP: 'NE' },
          { A: b('sl_get', 'name-pruefen', { VAR: 'Name' }), B: text('leer', '') },
        ),
        DANN: schleife,
        SONST: b(
          'sl_message',
          'keine-eingabe',
          {},
          { TEXT: text('abbruch', 'Es wurde kein Name eingegeben.') },
        ),
      },
    ),
  };
  p.name = 'Begrüßung mit Protokoll';
  p.editor.blocks!.blocks[0].next = { block: frage };
  const projektdatei = join(ordner, 'Kombiniert.scriptlab');
  await writeFile(projektdatei, JSON.stringify(p));
  await verlustAntwort(1);
  await oeffnungsziel(projektdatei);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect.poll(async () => (await projektLesen()).name).toBe(p.name);
  await vorschauOeffnen();
  await expect(seite.locator('.code')).toContainText('InputBox');
  await expect(seite.locator('.code')).toContainText('For sl_intern_');
  await expect(seite.locator('.code')).toContainText('If (v_1 <>');
  await speicherziel(join(ordner, 'Kombiniert.vbs'));
  await seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
  await expect(seite.getByRole('status', { name: 'Export abgeschlossen' })).toContainText(
    'Das Script wurde gespeichert.',
  );
  await expect(stat(zielDatei)).rejects.toMatchObject({ code: 'ENOENT' });
  await seite.screenshot({ path: 'artifacts/editor-kombiniert.png' });
});
