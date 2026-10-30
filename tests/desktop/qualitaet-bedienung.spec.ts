import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { sprachwahlBestaetigen } from './sprache';

for (const darstellung of ['hell', 'dunkel'] as const) {
  test(`Aktionsmenü erhält die Tab-Reihenfolge bei 200 % Text (${darstellung})`, async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Qualitaet-Bedienung-'));
    let app: ElectronApplication | undefined;
    try {
      const profil = join(ordner, 'Profil');
      await mkdir(profil);
      await writeFile(
        join(profil, 'einstellungen.json'),
        JSON.stringify({ darstellung, textSkalierung: 2, automatischeUpdates: false, vorabversionen: false }),
      );
      app = await electron.launch({
        args: [resolve('.'), '--force-device-scale-factor=1'],
        cwd: ordner,
        env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
      });
      const seite = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
      await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
      await sprachwahlBestaetigen(seite);
      await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
      await seite.evaluate(
        () =>
          new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
      );
      const ausloeser = seite.getByRole('button', { name: 'Workflow', exact: true });
      await ausloeser.focus();
      await ausloeser.press('Shift+Tab');
      const ablauf = seite.getByRole('tab', { name: 'Ablauf', exact: true });
      await expect(ablauf).toBeFocused();
      await ausloeser.focus();
      await ausloeser.press('ArrowDown');
      const menue = seite.getByRole('menu', { name: 'Workflow', exact: true });
      await expect(menue).toBeVisible();
      const erster = menue.getByRole('menuitem', { name: 'Neuer Workflow', exact: true });
      await expect(erster).toBeFocused();
      await expect(seite.locator('.anwendung')).toHaveCSS('font-size', '28px');
      await erster.press('Shift+Tab');
      await expect(menue).not.toBeVisible();
      await expect(ablauf).toBeFocused();
      await expect(ablauf).toHaveAttribute('aria-selected', 'true');
      await ausloeser.press('ArrowDown');
      await expect(erster).toBeFocused();
      await erster.press('Tab');
      await expect(menue).not.toBeVisible();
      await expect(seite.getByRole('button', { name: 'Rückgängig', exact: true })).toBeFocused();
      await ausloeser.press('ArrowDown');
      await expect(erster).toBeFocused();
      await mkdir(resolve('artifacts/qualitaet-ux'), { recursive: true });
      await seite.screenshot({ path: resolve(`artifacts/qualitaet-ux/menue-${darstellung}-200.png`) });
      await erster.press('Escape');
      await expect(ausloeser).toBeFocused();
      const lauf = await seite.evaluate(() => window.scriptlab.testLesen());
      expect(lauf.ok && lauf.wert.zustand.phase).toBe('bereit');
    } finally {
      await app?.evaluate(({ app }) => app.exit(0)).catch(() => {});
      const ziel = resolve(ordner);
      if (
        !ziel.startsWith(resolve(tmpdir()) + sep) ||
        !basename(ziel).startsWith('ScriptLab-Qualitaet-Bedienung-')
      )
        throw new Error('Unsicherer temporärer Testpfad.');
      await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
}
