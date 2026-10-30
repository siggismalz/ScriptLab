import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('Vorlagenkopien erhalten eigene UUIDs und Arbeitsdaten ohne impliziten Lauf', async () => {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Vorlagen-Main-'));
  const profil = join(ordner, 'Profil');
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  try {
    const seite = await app.firstWindow();
    await seite.waitForFunction(() => Boolean(window.scriptlab));
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false });
    });
    const ids = new Set<string>();
    for (const vorlage of ['backup', 'backup-python', 'dateiliste', 'dateiliste-python'] as const) {
      const original = await readFile(
        `beispiele/${vorlage === 'backup' ? '02-Datei-Backup' : vorlage === 'backup-python' ? '05-Python-Datei-Backup' : vorlage === 'dateiliste' ? '03-Dateinamenliste' : '06-Python-Dateinamenliste'}.scriptlab`,
      );
      const antwort = await seite.evaluate(async (id) => {
        const r = await window.scriptlab.laden();
        if (!r.ok) throw Error(r.meldung);
        return window.scriptlab.beispielOeffnen(r.wert.dokument.projekt, id);
      }, vorlage);
      if (!antwort.ok || !antwort.wert) throw Error('Vorlagenkopie konnte nicht erstellt werden.');
      const projekt = antwort.wert.projekt;
      expect(ids.has(projekt.projektKennung!)).toBe(false);
      ids.add(projekt.projektKennung!);
      expect(projekt.skriptsprache).toBe(vorlage.endsWith('-python') ? 'python' : 'vbs');
      const lauf = await seite.evaluate(() => window.scriptlab.testLesen());
      if (!lauf.ok) throw Error(lauf.meldung);
      expect(lauf.wert.zustand.laufId).toBeNull();
      const basis = join(profil, 'Arbeitsdateien', projekt.projektKennung!);
      expect(lauf.wert.optionen.basisVerzeichnis).toBe(basis);
      const typ = vorlage.startsWith('backup') ? 'Backup' : 'Dateiliste';
      const pfad = vorlage.startsWith('backup') ? 'Quelle/beispiel.txt' : 'Eingang/03-Werte.csv';
      expect(await readFile(join(basis, 'ScriptLab-Testdaten', typ, pfad))).toEqual(
        await readFile(join('beispiele/grunddaten', typ, pfad)),
      );
      await expect(
        stat(
          join(
            basis,
            'ScriptLab-Testdaten',
            typ,
            vorlage.startsWith('backup') ? 'Sicherung/beispiel.txt' : 'Dateinamen.txt',
          ),
        ),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      expect(JSON.parse(original.toString('utf8')).projektKennung).not.toBe(projekt.projektKennung);
    }
    expect(ids.size).toBe(4);
  } finally {
    const prozess = app.process();
    const ende =
      prozess.exitCode === null && prozess.signalCode === null ? once(prozess, 'exit') : Promise.resolve();
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await ende;
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
