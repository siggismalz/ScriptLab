import { _electron as electron } from 'playwright';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, basename, sep } from 'node:path';

const basis = resolve('artifacts/system-dpi');
await mkdir(basis, { recursive: true });
// Keine Anweisung aus einem frueheren manuellen Prueflauf uebernehmen.
await writeFile(join(basis, 'befehl.txt'), '', 'utf8');
const profil = await mkdtemp(join(tmpdir(), 'ScriptLab-SystemDPI-'));
const app = await electron.launch({
  args: [resolve('.')],
  env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
});
const seite = await app.firstWindow();
await seite.getByTestId('statusleiste').waitFor();
await app.evaluate(({ BrowserWindow, screen }) => {
  const anzeige = screen.getAllDisplays().sort((a, b) => b.bounds.x - a.bounds.x)[0];
  const fenster = BrowserWindow.getAllWindows()[0];
  fenster.setPosition(anzeige.workArea.x + 40, anzeige.workArea.y + 40);
  fenster.setContentSize(1280, 720);
});
process.stdout.write('Bereit: App auf rechtem Monitor; keine erzwungene Prozess-DPI.\n');
let zuletzt = '';
try {
  while (true) {
    let befehl = '';
    try {
      befehl = (await readFile(join(basis, 'befehl.txt'), 'utf8')).trim();
    } catch {}
    if (befehl === 'ende') break;
    if (befehl && befehl !== zuletzt && ['100', '125', '150', '175', '200'].includes(befehl)) {
      const faktor = Number(befehl) / 100;
      await seite.waitForFunction((n) => Math.abs(devicePixelRatio - n) < 0.01, faktor, { timeout: 15_000 });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
      // Windows aktualisiert beim echten DPI-Wechsel auch die nativen Fensterrahmen.
      // Ziel- und Istinhalt werden deshalb nach dem Wechsel anhand realer Werte abgeglichen.
      for (let i = 0; i < 5; i++) {
        await seite.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const ist = await seite.evaluate(() => ({ b: innerWidth, h: innerHeight }));
        if (Math.abs(1280 - ist.b) <= 1 && Math.abs(720 - ist.h) <= 1) break;
        await app.evaluate(
          ({ BrowserWindow }, d) => {
            const f = BrowserWindow.getAllWindows()[0];
            const [b, h] = f.getContentSize();
            f.setContentSize(b + d.b, h + d.h);
          },
          { b: 1280 - ist.b, h: 720 - ist.h },
        );
      }
      const fenster = await app.evaluate(({ BrowserWindow, screen }) => {
        const f = BrowserWindow.getAllWindows()[0];
        const a = screen.getDisplayMatching(f.getBounds());
        return {
          scaleFactor: a.scaleFactor,
          displayBounds: a.bounds,
          workArea: a.workArea,
          contentSize: f.getContentSize(),
          bounds: f.getBounds(),
          displays: screen
            .getAllDisplays()
            .map((d) => ({ bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor })),
        };
      });
      if (fenster.scaleFactor !== faktor)
        throw new Error('Windows-Displaymaßstab passt nicht zur Beobachtung.');
      const renderer = await seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        devicePixelRatio,
        dokumentBreite: document.documentElement.scrollWidth,
        dokumentHoehe: document.documentElement.scrollHeight,
        zoom: document.querySelector('.zoom')?.textContent,
      }));
      const ergebnis = {
        windowsSkalierung: Number(befehl),
        erzwungenerProzessMassstab: false,
        fenster,
        renderer,
      };
      await seite.screenshot({ path: join(basis, `windows-${befehl}.png`) });
      await writeFile(join(basis, `windows-${befehl}.json`), JSON.stringify(ergebnis, null, 2));
      process.stdout.write(JSON.stringify(ergebnis) + '\n');
      zuletzt = befehl;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (
    resolve(profil).startsWith(resolve(tmpdir()) + sep) &&
    basename(profil).startsWith('ScriptLab-SystemDPI-')
  )
    await rm(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
