import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join, resolve, basename, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { einstellungenOeffnen, laufansichtWaehlen, laufStarten } from './ansichten';

test('ML: Offlinepaket bewusst einrichten, konkurrierende Starts binden und echte Ergebnisse beurteilen', async () => {
  test.skip(
    process.env.SCRIPTLAB_ML_TESTS !== '1',
    'Benötigt den ausdrücklich vorbereiteten vollständigen CPU-Wheelsatz.',
  );
  test.setTimeout(600000);
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-ML-Integration-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      darstellung: 'hell',
      textSkalierung: 1,
      automatischeUpdates: false,
      vorabversionen: false,
      letzteSkriptsprache: null,
      pythonInterpreter: null,
      palettenBreite: 272,
      paletteEingeklappt: false,
      eigenschaftenAngeheftet: false,
    }),
  );
  const app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  const zustand = () =>
    seite.evaluate(async () => {
      const r = await window.scriptlab.testLesen();
      if (!r.ok) throw Error(r.meldung);
      return r.wert.zustand;
    });
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
    const dialog = await einstellungenOeffnen(seite);
    await dialog.getByRole('tab', { name: 'Automatisierungen', exact: true }).click();
    const ml = dialog.getByRole('region', { name: 'Machine Learning', exact: true });
    await expect(ml).toContainText(
      'Bearbeiten, Speichern und Exportieren sind auch ohne Einrichtung möglich',
    );
    expect((await zustand()).laufId).toBeNull();
    await app.evaluate(({ dialog }, pfad) => {
      dialog.showOpenDialog = async () => {
        const kontrolliert = globalThis as unknown as { mlTestDialogFreigeben?: () => void };
        await new Promise<void>((fertig) => {
          kontrolliert.mlTestDialogFreigeben = fertig;
        });
        delete kontrolliert.mlTestDialogFreigeben;
        return { canceled: false, filePaths: [pfad] };
      };
    }, resolve('artifacts/ml/wheels'));
    await ml.getByRole('button', { name: 'Aus Ordner einrichten', exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(() =>
          Boolean((globalThis as unknown as { mlTestDialogFreigeben?: () => void }).mlTestDialogFreigeben),
        ),
      )
      .toBe(true);
    const waehrendDialog = await seite.evaluate(() => window.scriptlab.mlAktion('pruefen'));
    expect(waehrendDialog.ok).toBe(false);
    if (!waehrendDialog.ok) expect(waehrendDialog.meldung).toContain('Dialog');
    await app.evaluate(() => {
      (globalThis as unknown as { mlTestDialogFreigeben?: () => void }).mlTestDialogFreigeben?.();
    });
    await expect
      .poll(
        async () => {
          const r = await seite.evaluate(() => window.scriptlab.mlLesen());
          return r.ok && r.wert.aktiv;
        },
        { timeout: 15000 },
      )
      .toBe(true);
    const update = await seite.evaluate(() => window.scriptlab.updateAktion('installieren'));
    expect(update.ok).toBe(false);
    if (!update.ok) expect(update.meldung).toContain('Laufzeiteinrichtung');
    await expect
      .poll(
        async () => {
          const r = await seite.evaluate(() => window.scriptlab.mlLesen());
          if (!r.ok) throw Error(r.meldung);
          return r.wert.aktiv ? 'aktiv' : r.wert.status?.zustand;
        },
        { timeout: 420000, intervals: [1000] },
      )
      .toBe('bereit');
    expect((await zustand()).laufId).toBeNull();
    await expect(ml).toContainText('bereit');
    await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
    await seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
    const karte = seite.getByRole('article', {
      name: 'Machine Learning: Kategorien erkennen – Python',
      exact: true,
    });
    await karte.getByRole('button', { name: 'Machine Learning: Kategorien erkennen', exact: true }).click();
    await karte.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
    await expect(seite.getByTestId('palette')).toBeVisible();
    const dokument = await seite.evaluate(async () => {
      const r = await window.scriptlab.laden();
      if (!r.ok) throw Error(r.meldung);
      return r.wert.dokument;
    });
    expect(dokument.projekt.workflowArt).toBe('ml');
    const kontext = await seite.evaluate(async (projekt) => {
      const r = await window.scriptlab.testLesen();
      if (!r.ok) throw Error(r.meldung);
      const optionen = {
        ...r.wert.optionen,
        business: {
          modus: 'prueflauf' as const,
          parametersatz: 'test' as const,
          parameter: {},
          speicherMB: 512,
          tempGB: 4,
          fortsetzen: false,
        },
      };
      return Promise.all(
        [61, 62].map((zeitlimitSekunden) =>
          window.scriptlab.testStarten(projekt, { ...optionen, zeitlimitSekunden }),
        ),
      );
    }, dokument.projekt);
    expect(kontext.filter((r) => r.ok)).toHaveLength(1);
    for (let i = 0; i < kontext.length; i++) {
      const r = kontext[i];
      if (r.ok) expect(r.wert.optionen.zeitlimitSekunden).toBe(61 + i);
    }
    await expect.poll(async () => (await zustand()).phase, { timeout: 120000 }).toBe('beendet');
    const basis = (await zustand()).optionen.basisVerzeichnis!;
    const original = await readFile(join(basis, 'training.csv'));
    await expect(readFile(join(basis, 'modell.slmodell'))).rejects.toThrow();
    await expect(readFile(join(basis, 'vorhersagen.csv'))).rejects.toThrow();
    await laufansichtWaehlen(seite, 'Vorbereitung');
    await seite.getByTestId('test-panel').getByLabel('Modus', { exact: true }).selectOption('ausfuehren');
    await laufStarten(seite);
    await expect.poll(async () => (await zustand()).phase, { timeout: 120000 }).toBe('beendet');
    const lauf = await zustand();
    expect(lauf.workflowArt).toBe('ml');
    expect(lauf.laufzeitProfil).toBe('ml-cpu');
    const metriken = lauf.business!.ereignisse.find((e) => e.art === 'ml_training');
    expect(metriken).toMatchObject({ trainingszeilen: 160, testzeilen: 40, verfahren: 'RANDOM_FOREST' });
    expect((metriken!.metriken as { accuracy: number }).accuracy).toBeGreaterThanOrEqual(0.9);
    const csv = (await readFile(join(basis, 'vorhersagen.csv'), 'utf8'))
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/);
    expect(csv).toHaveLength(21);
    expect(csv[1]).toMatch(/^N001;/);
    expect(csv[20]).toMatch(/^N020;/);
    expect(await readFile(join(basis, 'training.csv'))).toEqual(original);
    await laufansichtWaehlen(seite, 'Ergebnisse');
    await expect(seite.getByRole('region', { name: 'ML-Ergebnisse', exact: true })).toContainText('160');
    await mkdir('artifacts/ml', { recursive: true });
    await seite.screenshot({ path: resolve('artifacts/ml/app-ergebnisse.png') });
    await expect
      .poll(async () => (await readdir(join(profil, 'testlaeufe'))).length, { timeout: 10000 })
      .toBe(0);
    await writeFile(
      resolve('artifacts/ml/app-integration.json'),
      JSON.stringify(
        {
          bestanden: true,
          laufId: lauf.laufId,
          workflowArt: lauf.workflowArt,
          profil: lauf.laufzeitProfil,
          metriken,
          ausgabezeilen: 20,
          quellbytesErhalten: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await seite
      .evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (r.ok && r.wert.zustand.laufId) await window.scriptlab.testStoppen(r.wert.zustand.laufId);
        await window.scriptlab.mlAktion('abbrechen');
      })
      .catch(() => {});
    if (app.process().exitCode === null && app.process().signalCode === null) {
      const ende = app.waitForEvent('close');
      await Promise.all([ende, app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    }
    if (
      !resolve(ordner).startsWith(resolve(tmpdir()) + sep) ||
      !basename(ordner).startsWith('ScriptLab-ML-Integration-')
    )
      throw Error('Unsicherer Testpfad.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
