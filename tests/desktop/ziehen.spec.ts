import { sprachwahlBestaetigen } from './sprache';
import { workflowBefehl } from './ansichten';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import { bausteinDefinitionen } from '../../src/kern/katalog';

type Sitzung = { app: ElectronApplication; seite: Page; ordner: string };
type Punkt = { x: number; y: number };
async function starten(): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Ziehen-'));
  const app = await electron.launch({
    args: ['.', '--force-device-scale-factor=1'],
    cwd: resolve('.'),
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await sprachwahlBestaetigen(seite);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText(
    'Noch nicht als Datei gespeichert',
  );
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  return { app, seite, ordner };
}
async function beenden(s: Sitzung): Promise<void> {
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  const pfad = resolve(s.ordner);
  if (!pfad.startsWith(resolve(tmpdir()) + sep) || !basename(pfad).startsWith('ScriptLab-Ziehen-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(pfad, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
async function stand(seite: Page) {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return {
      editor: r.wert.dokument.projekt.editor,
      ansicht: r.wert.dokument.projekt.ansicht,
      geaendert: r.wert.dokument.geaendert,
    };
  });
}
async function rahmen(seite: Page, id: string) {
  const element = seite.locator(`g[data-id="${id}"] > path.blocklyPath`).first();
  await expect(element).toBeVisible();
  return (await element.boundingBox())!;
}
async function ausPalette(seite: Page, typ: string, ziel: Punkt) {
  const name = bausteinDefinitionen.find((b) => b.typ === typ)!.name;
  await seite.getByRole('searchbox', { name: 'Bausteine suchen' }).fill(name);
  const knopf = seite.getByRole('button', { name: `Baustein ziehen: ${name}`, exact: true });
  await knopf.scrollIntoViewIfNeeded();
  const box = (await knopf.boundingBox())!;
  await seite.mouse.move(box.x + 24, box.y + 18);
  await seite.mouse.down();
  await seite.mouse.move(ziel.x, ziel.y, { steps: 24 });
}
async function bild(seite: Page, name: string) {
  await mkdir('artifacts/ui', { recursive: true });
  await seite.screenshot({ path: `artifacts/ui/${name}.png` });
}
const marker = (seite: Page) =>
  seite.locator('.blocklyInsertionMarker:visible, .blocklyHighlightedConnectionPathVisible:visible');
async function laden(s: Sitzung, projekt: Projekt) {
  const pfad = join(s.ordner, 'Ziehbeispiel.scriptlab');
  await writeFile(pfad, JSON.stringify(projekt), 'utf8');
  await s.app.evaluate(({ dialog }, datei) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false });
  }, pfad);
  await workflowBefehl(s.seite, 'oeffnen');
  await expect(s.seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Gespeichert');
}
function testBlock(
  type: string,
  id: string,
  fields: EditorBlock['fields'] = {},
  kinder: Record<string, EditorBlock> = {},
): EditorBlock {
  return {
    type,
    id,
    fields,
    inputs: Object.fromEntries(Object.entries(kinder).map(([name, block]) => [name, { block }])),
  };
}

test('Ziehen: Palette verbindet am Start mit sichtbarer nativer Einfügemarkierung', async () => {
  const s = await starten();
  try {
    const start = await rahmen(s.seite, 'start');
    const vorher = await stand(s.seite);
    await bild(s.seite, 'ziehen-vorher');
    await ausPalette(s.seite, 'sl_message', { x: start.x + 20, y: start.y + start.height + 8 });
    await expect(marker(s.seite)).not.toHaveCount(0);
    expect((await stand(s.seite)).ansicht).toEqual(vorher.ansicht);
    const danach = await rahmen(s.seite, 'start');
    expect(danach.x).toBeCloseTo(start.x, 1);
    expect(danach.y).toBeCloseTo(start.y, 1);
    await bild(s.seite, 'ziehen-am-start-mit-marker');
    await s.seite.mouse.up();
    await expect
      .poll(async () => (await stand(s.seite)).editor.blocks?.blocks[0].next?.block.type)
      .toBe('sl_message');
    expect((await stand(s.seite)).ansicht).toEqual(vorher.ansicht);
    await s.seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect.poll(async () => (await stand(s.seite)).editor.blocks?.blocks[0].next).toBeUndefined();
    await s.seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
    await expect
      .poll(async () => (await stand(s.seite)).editor.blocks?.blocks[0].next?.block.type)
      .toBe('sl_message');
  } finally {
    await beenden(s);
  }
});

test('Ziehen: Escape aus der Palette erhält Editor, Ansicht und Speicherstatus', async () => {
  const s = await starten();
  try {
    const vorher = await stand(s.seite);
    const arbeitsflaeche = (await s.seite.getByTestId('arbeitsbereich').boundingBox())!;
    await ausPalette(s.seite, 'sl_message', {
      x: arbeitsflaeche.x + arbeitsflaeche.width * 0.75,
      y: arbeitsflaeche.y + arbeitsflaeche.height * 0.6,
    });
    await expect(s.seite.locator('.blocklyDragging:visible')).not.toHaveCount(0);
    await s.seite.keyboard.press('Escape');
    await s.seite.mouse.up();
    await expect.poll(() => stand(s.seite)).toEqual(vorher);
    await expect(s.seite.getByTestId('statusleiste')).not.toContainText('Ungespeicherte Änderungen');
    await expect(s.seite.locator('.blocklyDragging:visible')).toHaveCount(0);
    await expect(marker(s.seite)).toHaveCount(0);
  } finally {
    await beenden(s);
  }
});

test('Ziehen: Escape eines verbundenen Blocks stellt ursprüngliche Verbindungen exakt wieder her', async () => {
  const s = await starten();
  try {
    const p = neuesProjekt();
    const kommentar = testBlock('sl_comment', 'kommentar', { TEXT: 'Bleibt nach Escape verbunden.' });
    kommentar.next = {
      block: testBlock(
        'sl_message',
        'nachricht',
        {},
        { TEXT: testBlock('sl_text', 'text', { TEXT: 'Nur Testdaten' }) },
      ),
    };
    p.editor.blocks!.blocks[0].x = 71;
    p.editor.blocks!.blocks[0].y = 53;
    p.editor.blocks!.blocks[0].next = { block: kommentar };
    await laden(s, p);
    const vorher = await stand(s.seite);
    const box = await rahmen(s.seite, 'kommentar');
    const arbeitsflaeche = (await s.seite.getByTestId('arbeitsbereich').boundingBox())!;
    await s.seite.mouse.move(box.x + 48, box.y + 18);
    await s.seite.mouse.down();
    await s.seite.mouse.move(
      arbeitsflaeche.x + arbeitsflaeche.width * 0.7,
      arbeitsflaeche.y + arbeitsflaeche.height * 0.7,
      { steps: 24 },
    );
    await expect(s.seite.locator('.blocklyDragging:visible')).not.toHaveCount(0);
    await s.seite.keyboard.press('Escape');
    await s.seite.mouse.up();
    await expect.poll(() => stand(s.seite)).toEqual(vorher);
    await expect(s.seite.locator('.blocklyDragging:visible')).toHaveCount(0);
    await s.seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect.poll(() => stand(s.seite)).toEqual(vorher);
  } finally {
    await beenden(s);
  }
});

test('Ziehen: fügt in eine Bedingung innerhalb einer Schleife ein und erhält vorhandene Schritte', async () => {
  const s = await starten();
  try {
    const p = neuesProjekt();
    p.editor.blocks!.blocks[0].next = {
      block: testBlock(
        'sl_repeat',
        'schleife',
        {},
        {
          ANZAHL: testBlock('sl_number', 'anzahl', { ZAHL: '3' }),
          ABLAUF: testBlock(
            'sl_if',
            'bedingung',
            {},
            {
              BEDINGUNG: testBlock('sl_bool', 'wahr', { WERT: 'WAHR' }),
              DANN: testBlock('sl_comment', 'innen', { TEXT: 'Bleibt als nächster Schritt erhalten.' }),
            },
          ),
        },
      ),
    };
    await laden(s, p);
    const innen = await rahmen(s.seite, 'innen');
    await ausPalette(s.seite, 'sl_message', { x: innen.x + 20, y: innen.y + 16 });
    await expect(marker(s.seite)).not.toHaveCount(0);
    await bild(s.seite, 'ziehen-verschachtelt-mit-marker');
    await s.seite.mouse.up();
    const dann = () =>
      stand(s.seite).then(
        (z) => z.editor.blocks?.blocks[0].next?.block.inputs?.ABLAUF.block?.inputs?.DANN.block,
      );
    await expect.poll(async () => (await dann())?.type).toBe('sl_message');
    expect((await dann())?.next?.block.id).toBe('innen');
  } finally {
    await beenden(s);
  }
});

test('Ziehen: ein Wahrheitswert verbindet sich nicht mit einem Anweisungsanschluss', async () => {
  const s = await starten();
  try {
    const start = await rahmen(s.seite, 'start');
    await ausPalette(s.seite, 'sl_bool', { x: start.x + 20, y: start.y + start.height + 8 });
    await expect(s.seite.locator('.blocklyDragging:visible')).not.toHaveCount(0);
    await expect(marker(s.seite)).toHaveCount(0);
    await s.seite.mouse.up();
    await expect.poll(async () => (await stand(s.seite)).editor.blocks?.blocks.length).toBe(2);
    expect((await stand(s.seite)).editor.blocks?.blocks.find((b) => b.id === 'start')?.next).toBeUndefined();
    expect((await stand(s.seite)).editor.blocks?.blocks.some((b) => b.type === 'sl_bool')).toBe(true);
  } finally {
    await beenden(s);
  }
});
