import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { Einstellungen } from '../../src/gemeinsam/bruecke';

for (const darstellung of ['hell', 'dunkel'] as const) {
  for (const textSkalierung of [1, 2] as const) {
    test(`Startkarten bleiben lesbar und führen nur zur gewählten Ansicht (${darstellung}, ${textSkalierung * 100}%)`, async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Karten-Start-'));
      const profil = join(ordner, 'Profil');
      await mkdir(profil);
      const einstellungen: Einstellungen = {
        darstellung,
        textSkalierung,
        automatischeUpdates: false,
        vorabversionen: false,
        letzteSkriptsprache: null,
        pythonInterpreter: null,
        palettenBreite: 272,
        paletteEingeklappt: false,
        eigenschaftenAngeheftet: false,
      };
      await writeFile(join(profil, 'einstellungen.json'), JSON.stringify(einstellungen));
      const app = await electron.launch({
        args: [resolve('.'), '--force-device-scale-factor=1'],
        cwd: ordner,
        env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
      });
      try {
        const seite = await app.firstWindow();
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
        await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
        await expect(seite.locator('.anwendung')).toHaveCSS('font-size', `${14 * textSkalierung}px`);
        await expect(seite.locator('html')).toHaveCSS(
          'color-scheme',
          darstellung === 'hell' ? 'light' : 'dark',
        );
        const vorher = await seite.evaluate(async () => {
          const r = await window.scriptlab.laden();
          if (!r.ok) throw Error(r.meldung);
          return r.wert.dokument;
        });
        const karten = seite.getByTestId('start-karten');
        const knoepfe = karten.getByRole('button');
        await expect(knoepfe).toHaveCount(4);
        for (let n = 0; n < 4; n++) {
          const knopf = knoepfe.nth(n);
          if (n === 0) await knopf.focus();
          else await seite.keyboard.press('Tab');
          await expect(knopf).toBeFocused();
          await knopf.scrollIntoViewIfNeeded();
          const rahmen = await knopf.boundingBox();
          expect(rahmen!.x).toBeGreaterThanOrEqual(0);
          expect(rahmen!.x + rahmen!.width).toBeLessThanOrEqual(1281);
          expect(rahmen!.height).toBeGreaterThanOrEqual(56);
          const lesbar = await knopf.evaluate((e) => ({
            breite: e.clientWidth,
            inhalt: e.scrollWidth,
            fokus: getComputedStyle(e).outlineStyle,
          }));
          expect(lesbar.inhalt).toBeLessThanOrEqual(lesbar.breite + 1);
          expect(lesbar.fokus).not.toBe('none');
          await expect(knopf.locator('.start-karte-beschreibung')).not.toBeEmpty();
        }
        await knoepfe.first().scrollIntoViewIfNeeded();
        await mkdir('artifacts/karten', { recursive: true });
        await seite.screenshot({ path: `artifacts/karten/start-${darstellung}-${textSkalierung * 100}.png` });
        const vorlagen = karten.getByRole('button', { name: 'Beispielworkflows', exact: true });
        await vorlagen.focus();
        await vorlagen.press('Enter');
        await expect(seite.getByRole('heading', { name: 'Vorlagen', exact: true })).toBeVisible();
        const nachher = await seite.evaluate(async () => {
          const r = await window.scriptlab.laden();
          const lauf = await window.scriptlab.testLesen();
          if (!r.ok || !lauf.ok) throw Error('Der unveränderte Stand konnte nicht gelesen werden.');
          return { dokument: r.wert.dokument, lauf: lauf.wert.zustand.laufId };
        });
        expect(nachher.dokument).toEqual(vorher);
        expect(nachher.lauf).toBeNull();
      } finally {
        if (app.process().exitCode === null && app.process().signalCode === null) {
          const ende = app.waitForEvent('close');
          await Promise.all([ende, app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
        }
        await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    });
  }
}
