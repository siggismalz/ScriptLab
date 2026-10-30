import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

for (const thema of ['hell', 'dunkel'] as const) {
  test(`Lizenz bleibt bei 200 Prozent Text vollständig lesbar (${thema})`, async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Lizenz-UI-'));
    const profil = join(ordner, 'Profil');
    await mkdir(profil);
    const app = await electron.launch({
      args: [resolve('.')],
      cwd: ordner,
      env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
    });
    try {
      const seite = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
      await seite.waitForFunction(() => Boolean(window.scriptlab));
      await seite.evaluate(async (darstellung) => {
        const r = await window.scriptlab.laden();
        if (!r.ok) throw Error(r.meldung);
        const gespeichert = await window.scriptlab.einstellungenSpeichern({
          ...r.wert.einstellungen,
          darstellung,
          textSkalierung: 2,
        });
        if (!gespeichert.ok) throw Error(gespeichert.meldung);
      }, thema);
      await seite.reload();
      await expect(seite.locator('.anwendung')).toHaveCSS('font-size', '28px');
      await expect(seite.locator('html')).toHaveCSS('color-scheme', thema === 'hell' ? 'light' : 'dark');
      await seite.getByRole('button', { name: 'Über ScriptLab', exact: true }).click();
      const dialog = seite.getByRole('dialog', { name: 'Über ScriptLab', exact: true });
      const lizenz = dialog.getByRole('region', { name: 'Nutzung und Lizenz', exact: true });
      await expect(lizenz).toContainText('Kostenlos');
      await expect(lizenz).toContainText('Kostenpflichtige Lizenz erforderlich');
      const details = lizenz.locator('summary');
      await details.focus();
      await details.press('Enter');
      const text = lizenz.locator('pre');
      await expect(text).toBeVisible();
      expect(await text.textContent()).toBe(await readFile('LICENSE.txt', 'utf8'));
      const geometrie = await text.evaluate((e) => ({ breite: e.clientWidth, inhalt: e.scrollWidth }));
      expect(geometrie.inhalt).toBeLessThanOrEqual(geometrie.breite + 1);
      await text.scrollIntoViewIfNeeded();
      await mkdir('artifacts/vorlagen-ui', { recursive: true });
      await seite.screenshot({ path: `artifacts/vorlagen-ui/lizenz-${thema}-200.png` });
      await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
      const lauf = await seite.evaluate(() => window.scriptlab.testLesen());
      expect(lauf.ok && lauf.wert.zustand.laufId).toBeNull();
    } finally {
      const prozess = app.process();
      const ende =
        prozess.exitCode === null && prozess.signalCode === null ? once(prozess, 'exit') : Promise.resolve();
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
      await ende;
      await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
}
