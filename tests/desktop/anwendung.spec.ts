import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, readFile, writeFile, rm, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt } from '../../src/kern/projekt';

let app: ElectronApplication;
let seite: Page;
let ordner: string;

test.beforeAll(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'scriptlab-desktop-'));
  app = await electron.launch({
    args: ['.'],
    cwd: resolve('.'),
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'einstellungen') },
  });
  seite = await app.firstWindow();
  await expect(seite.locator('.speicherpunkt')).toHaveText('✓ Gespeichert');
});
test.afterAll(async () => {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (ordner) await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

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
    dialog.showMessageBox = async () => ({ response: wert, checkboxChecked: false });
  }, response);
}

test('zeigt den Nachrichtenweg und isoliert den Renderer', async () => {
  await expect(seite.locator('.code')).toContainText('Option Explicit');
  await expect(seite.locator('.code')).toContainText('Hallo! Erstellt mit ScriptLab.');
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
      'speichern',
      'exportieren',
      'exportOrdnerAnzeigen',
      'zertifikate',
      'einstellungenSpeichern',
      'updateAktion',
    ],
  });
  const sicherheit = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const p = (
      w.webContents as Electron.WebContents & { getLastWebPreferences(): Electron.WebPreferences }
    ).getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  expect(sicherheit).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
  await expect(seite.getByRole('button', { name: /Starten|Testlauf|Ausführen/ })).toHaveCount(0);
});

test('exportiert echte UTF16LE-BOM-Bytes mit CRLF und behandelt Abbruch', async () => {
  await speicherziel(null);
  await seite.getByRole('button', { name: 'Als VBS exportieren ↗' }).click();
  await expect(seite.locator('.meldungen')).not.toContainText('Das Script wurde gespeichert.');
  const ziel = join(ordner, 'Grüße mit Leerzeichen.vbs');
  await speicherziel(ziel);
  await seite.getByRole('button', { name: 'Als VBS exportieren ↗' }).click();
  await expect(seite.locator('.meldungen')).toContainText(
    'Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.',
  );
  await expect(seite.locator('.meldungen')).toContainText('Nicht signiert');
  const bytes = await readFile(ziel);
  expect([...bytes.subarray(0, 2)]).toEqual([255, 254]);
  const code = bytes.subarray(2).toString('utf16le');
  expect(code).toContain('MsgBox CStr(("Hallo! Erstellt mit ScriptLab."))');
  expect(code).not.toMatch(/(?<!\r)\n/);
});

test('speichert sofortigen Editorstand und erhält Zoom beim Öffnen', async () => {
  const ziel = join(ordner, 'Mein Projekt.scriptlab');
  await speicherziel(ziel);
  await seite.getByRole('textbox', { name: 'Projektname', exact: true }).fill('Dateien und Grüße');
  await seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.locator('.speicherpunkt')).toHaveText('✓ Gespeichert');
  const gespeichert = JSON.parse(await readFile(ziel, 'utf8'));
  expect(gespeichert.name).toBe('Dateien und Grüße');
  expect(gespeichert.ansicht.zoom).toBeGreaterThan(1);
  await seite.getByRole('button', { name: '＋ Neu', exact: true }).click();
  await expect(seite.getByRole('textbox', { name: 'Projektname', exact: true })).toHaveValue('Mein Workflow');
  await oeffnungsziel(ziel);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(seite.getByRole('textbox', { name: 'Projektname', exact: true })).toHaveValue(
    'Dateien und Grüße',
  );
  expect(await seite.locator('.zoom button').nth(1).innerText()).not.toBe('100 %');
  await expect(seite.locator('.speicherpunkt')).toHaveText('✓ Gespeichert');
});

test('verhindert Projektverlust bei Dialogabbruch und schützt unbekannte Formate', async () => {
  await seite.getByRole('textbox', { name: 'Projektbeschreibung' }).fill('Letzte Änderung bleibt erhalten.');
  await verlustAntwort(2);
  await seite.getByRole('button', { name: '＋ Neu', exact: true }).click();
  await expect(seite.getByRole('textbox', { name: 'Projektbeschreibung' })).toHaveValue(
    'Letzte Änderung bleibt erhalten.',
  );
  await verlustAntwort(0);
  await speicherziel(null);
  await seite.getByRole('button', { name: 'Speichern unter', exact: true }).click();
  await expect(seite.locator('.speicherpunkt')).toContainText('Ungespeichert');
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.locator('.speicherpunkt')).toHaveText('✓ Gespeichert');
  const datei = join(ordner, 'zu-neu.scriptlab');
  await writeFile(datei, JSON.stringify({ ...neuesProjekt(), schemaVersion: 99 }));
  await oeffnungsziel(datei);
  await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(seite.locator('.meldungen')).toContainText('neueren Dateiformat');
  await expect(seite.getByRole('textbox', { name: 'Projektname', exact: true })).toHaveValue(
    'Dateien und Grüße',
  );
  expect(JSON.parse(await readFile(datei, 'utf8')).schemaVersion).toBe(99);
});

test('zeigt Exportfehler verständlich und erhält vorhandene Ziele', async () => {
  const ziel = join(ordner, 'Ordner.vbs');
  await mkdir(ziel);
  await speicherziel(ziel);
  await seite.getByRole('button', { name: 'Als VBS exportieren ↗' }).click();
  await expect(seite.locator('.meldungen')).toContainText(/Zugriff|Dateivorgang/);
  expect((await stat(ziel)).isDirectory()).toBe(true);
});

test('sucht Bausteine und prüft Credits, Zertifikate und Updategrenze', async () => {
  await seite.getByRole('textbox', { name: 'Bausteine suchen' }).fill('Nachricht');
  await expect(seite.getByRole('treeitem', { name: 'Ein- und Ausgaben', exact: true })).toBeVisible();
  await expect(seite.getByRole('treeitem', { name: 'Schleifen', exact: true })).toHaveCount(0);
  await seite.getByRole('textbox', { name: 'Bausteine suchen' }).fill('');
  await seite.getByRole('button', { name: 'Über ScriptLab', exact: true }).click();
  await expect(seite.getByRole('dialog')).toContainText('Entwickelt von Leon Stolz');
  await seite.getByRole('button', { name: 'Dialog schließen' }).click();
  await seite.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await seite.getByRole('button', { name: 'Nach Updates suchen' }).click();
  await expect(seite.getByRole('dialog')).toContainText('Entwicklungsmodus');
  await expect(seite.getByRole('checkbox', { name: 'Automatisch nach Updates suchen' })).not.toBeChecked();
  await seite.getByRole('button', { name: 'Zertifikate laden' }).click();
  await expect(seite.locator('.meldungen')).toContainText(/Zertifikat|Zertifikate/);
  await seite.getByRole('button', { name: 'Dialog schließen' }).click();
});

test('Schließen liest den letzten Stand und bricht bei ungespeicherten Änderungen ab', async () => {
  await verlustAntwort(2);
  await seite.getByRole('textbox', { name: 'Projektname', exact: true }).fill('Noch nicht gespeichert');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect(seite.getByRole('textbox', { name: 'Projektname', exact: true })).toHaveValue(
    'Noch nicht gespeichert',
  );
  await expect.poll(async () => app.windows().length).toBe(1);
  await expect(seite.locator('.speicherpunkt')).toContainText('Ungespeichert');
  await seite.screenshot({ path: 'artifacts/editor-windows.png' });
});

test('zieht Bausteine aus der Palette, markiert lose Anweisungen und macht Änderungen rückgängig', async () => {
  await verlustAntwort(1);
  await seite.getByRole('button', { name: '＋ Neu', exact: true }).click();
  await seite.getByRole('treeitem', { name: 'Ablauf', exact: true }).click();
  const kommentar = seite.locator('.blocklyFlyout .blocklyDraggable').filter({ hasText: 'Kommentar' }).first();
  await expect(kommentar).toBeVisible();
  const von = (await kommentar.boundingBox())!;
  const arbeitsbereich = (await seite.getByTestId('arbeitsbereich').boundingBox())!;
  await seite.mouse.move(von.x + 35, von.y + 18);
  await seite.mouse.down();
  await seite.mouse.move(arbeitsbereich.x + arbeitsbereich.width * 0.7, arbeitsbereich.y + 300, { steps: 24 });
  await seite.mouse.up();
  await expect(seite.getByRole('region', { name: 'Validierungshinweise' })).toHaveCount(0);
  await expect(seite.locator('.validierung')).toContainText('nicht mit dem Startablauf verbunden');
  await seite.getByRole('button', { name: '↶ Rückgängig' }).click();
  await expect(seite.locator('.validierung')).toHaveCount(0);
  await seite.getByRole('button', { name: '↷ Wiederholen' }).click();
  await expect(seite.locator('.validierung')).toContainText('nicht mit dem Startablauf verbunden');
  await seite.screenshot({ path: 'artifacts/editor-drag-and-drop.png' });
});
