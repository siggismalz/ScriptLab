import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument } from '../../src/gemeinsam/bruecke';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
}

async function starten(ordner?: string): Promise<Sitzung> {
  const basis = ordner ?? (await mkdtemp(join(tmpdir(), 'ScriptLab-Startseite-')));
  const profil = join(basis, 'Profil');
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: basis,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  return { app, seite, ordner: basis, profil };
}

async function beenden(s: Sitzung): Promise<void> {
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  const ziel = resolve(s.ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Startseite-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function dokumentLesen(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const ergebnis = await window.scriptlab.laden();
    if (!ergebnis.ok) throw new Error(ergebnis.meldung);
    return ergebnis.wert.dokument;
  });
}

test('Startseite: neuer Ablauf und Weiterbearbeiten erhalten Kennung, Auswahl und Ansicht', async () => {
  const s = await starten();
  try {
    await s.app.evaluate(({ dialog }) => {
      const testdaten = globalThis as typeof globalThis & { startseiteVerlustdialoge?: number };
      testdaten.startseiteVerlustdialoge = 0;
      dialog.showMessageBox = async () => {
        testdaten.startseiteVerlustdialoge!++;
        return { response: 3, checkboxChecked: false };
      };
    });
    await s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    const palette = s.seite.getByTestId('palette');
    await expect(palette).toBeVisible();
    await palette.getByRole('searchbox', { name: 'Bausteine suchen', exact: true }).fill('Nachricht');
    await palette.getByRole('button', { name: 'Baustein einfügen: Nachricht anzeigen', exact: true }).click();
    await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
    await expect
      .poll(async () => (await dokumentLesen(s)).projekt.editor.blocks?.blocks[0].next?.block.type)
      .toBe('sl_message');
    const id = (await dokumentLesen(s)).projekt.editor.blocks!.blocks[0].next!.block.id;
    await s.seite.locator(`g[data-id="${id}"]`).click({ position: { x: 56, y: 18 } });
    await s.seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    await expect.poll(async () => (await dokumentLesen(s)).projekt.ansicht.zoom).toBeGreaterThan(1);
    const vorher = await dokumentLesen(s);
    await expect(s.seite.locator(`g[data-id="${id}"]`)).toHaveClass(/scriptlabAuswahl/);
    await s.seite.getByRole('button', { name: 'Startseite', exact: true }).click();
    await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
    await expect(palette).not.toBeVisible();
    await s.seite.getByRole('button', { name: /^Weiterbearbeiten/ }).click();
    await expect(palette).toBeVisible();
    const danach = await dokumentLesen(s);
    expect(typeof vorher.projekt.projektKennung).toBe('string');
    expect(danach.projekt.projektKennung).toBe(vorher.projekt.projektKennung);
    expect(danach.projekt.editor).toEqual(vorher.projekt.editor);
    expect(danach.projekt.ansicht).toEqual(vorher.projekt.ansicht);
    await expect(s.seite.locator(`g[data-id="${id}"]`)).toHaveClass(/scriptlabAuswahl/);
    expect(
      await s.app.evaluate(
        () =>
          (globalThis as typeof globalThis & { startseiteVerlustdialoge?: number }).startseiteVerlustdialoge,
      ),
    ).toBe(0);
  } finally {
    await beenden(s);
  }
});
