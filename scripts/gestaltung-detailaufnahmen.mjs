import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Visuelle Arbeitsansichten. Es werden keine Workflows gestartet und keine Quelldaten verändert.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-UI-Details-'));
const profil = join(ordner, 'Profil');
await mkdir(profil);
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, vorabversionen: false }),
);
const projekt = JSON.parse(
  await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
);
projekt.name = 'Testdaten · Monatsauswertung Oktober';
const datei = join(ordner, 'Monatsauswertung.scriptlab');
await writeFile(datei, JSON.stringify(projekt));
const ziel = resolve('docs/gestaltung/nachher');
await mkdir(ziel, { recursive: true });
const app = await electron.launch({
  args: [resolve('.')],
  env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
});
const seite = await app.firstWindow();
async function bild(name) {
  await seite.evaluate(
    () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig))),
  );
  await seite.waitForTimeout(150);
  await seite.screenshot({ path: join(ziel, name + '.png') });
}
async function thema(wert) {
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  await seite.getByLabel('Farbschema', { exact: true }).selectOption(wert);
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
}
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
  }, datei);
  await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  const palette = seite.getByTestId('palette');
  await palette.getByRole('button', { name: 'Daten verarbeiten', exact: true }).click();
  await bild('editor-palette-daten-dunkel-1280');
  await palette.getByRole('button', { name: 'Daten laden', exact: true }).click();
  await bild('editor-palette-quellen-dunkel-1280');
  await seite
    .locator('g[data-id="a-import"]')
    .first()
    .click({ position: { x: 30, y: 20 } });
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  const eigenschaften = seite.getByTestId('eigenschaften-panel');
  await bild('editor-quelle-einfach-dunkel-1280');
  await eigenschaften.locator('summary').filter({ hasText: 'Importeinstellungen' }).click();
  await bild('editor-importoptionen-dunkel-1280');
  await eigenschaften.locator('summary').filter({ hasText: 'Importeinstellungen' }).click();
  await eigenschaften.locator('summary').filter({ hasText: 'Bausteindetails' }).click();
  await bild('editor-bausteindetails-dunkel-1280');
  await eigenschaften.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  await thema('hell');
  await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await bild('editor-quelle-einfach-hell-1280');
  await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
  for (const schema of ['hell', 'dunkel']) {
    if (schema === 'dunkel') await thema('dunkel');
    await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Neuer Workflow', exact: true }).click();
    await bild(`sprachwahl-${schema}-1280`);
    await seite.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  }
  console.log('Visuelle Detailaufnahmen gespeichert.');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
