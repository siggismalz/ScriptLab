import { sprachwahlBestaetigen } from './sprache';
import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type Projekt } from '../../src/kern/projekt';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  basis: string;
  projektdatei: string;
}

const testtext = 'Klare UI-Testausgabe ä';
function testprojekt(): Projekt {
  const projekt = neuesProjekt();
  projekt.name = 'Klarer Testausgabe-Prüfablauf';
  projekt.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_output',
      id: 'ui_testausgabe',
      inputs: { TEXT: { block: { type: 'sl_text', id: 'ui_testtext', fields: { TEXT: testtext } } } },
    },
  };
  return projekt;
}

async function zweiFrames(seite: Page): Promise<void> {
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}

async function starten(): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Testausgabe-UI-'));
  const basis = join(ordner, 'Basisordner');
  const projektdatei = join(ordner, 'Klare Testausgabe.scriptlab');
  await mkdir(basis);
  await writeFile(projektdatei, JSON.stringify(testprojekt()), 'utf8');
  const app = await electron.launch({
    args: [resolve('.')],
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  try {
    const seite = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
    await zweiFrames(seite);
    for (let versuch = 0; versuch < 4; versuch++) {
      const ist = await seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
      if (ist.breite === 1280 && ist.hoehe === 720) break;
      await app.evaluate(
        ({ BrowserWindow }, delta) => {
          const fenster = BrowserWindow.getAllWindows()[0];
          const [breite, hoehe] = fenster.getContentSize();
          fenster.setContentSize(breite + delta.breite, hoehe + delta.hoehe);
        },
        { breite: 1280 - ist.breite, hoehe: 720 - ist.hoehe },
      );
      await zweiFrames(seite);
    }
    await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(seite);
    await expect(seite.getByRole('button', { name: 'Neu', exact: true })).toBeEnabled();
    await app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    }, projektdatei);
    await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect
      .poll(() =>
        seite.evaluate(async () => {
          const antwort = await window.scriptlab.laden();
          return (
            antwort.ok &&
            !antwort.wert.dokument.darstellungNoetig &&
            antwort.wert.dokument.projekt.name === 'Klarer Testausgabe-Prüfablauf'
          );
        }),
      )
      .toBe(true);
    await expect(seite.locator('.blocklyBlockCanvas g[data-id="ui_testausgabe"]')).toBeVisible();
    await expect(seite.getByRole('button', { name: 'Testen', exact: true })).toBeEnabled();
    return { app, seite, ordner, basis, projektdatei };
  } catch (fehler) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await testordnerEntfernen(ordner);
    throw fehler;
  }
}

async function beenden(sitzung: Sitzung): Promise<void> {
  // Nur der eigene isolierte App-Prozess. Ein bereits beendeter Workflow wird nicht erneut gestartet.
  await sitzung.seite
    .evaluate(async () => {
      const antwort = await window.scriptlab.testLesen();
      if (
        antwort.ok &&
        antwort.wert.zustand.laufId &&
        ['vorbereitung', 'laeuft', 'stoppt'].includes(antwort.wert.zustand.phase)
      )
        await window.scriptlab.testStoppen(antwort.wert.zustand.laufId);
    })
    .catch(() => {});
  await sitzung.app
    .evaluate(async ({ app }) => {
      app.exit(0);
    })
    .catch(() => {});
  await testordnerEntfernen(sitzung.ordner);
}

async function testordnerEntfernen(ordner: string): Promise<void> {
  const ziel = resolve(ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Testausgabe-UI-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function textgroesseSetzen(seite: Page, prozent: 100 | 200): Promise<void> {
  await seite.getByRole('button', { name: 'Weitere Funktionen', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await dialog
    .getByRole('combobox', { name: 'UI-Textgröße', exact: true })
    .selectOption({ label: `${prozent} %` });
  await dialog.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
  await zweiFrames(seite);
}

async function knopfImFenster(knopf: Locator) {
  await expect(knopf).toBeVisible();
  const masse = await knopf.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.querySelector('span');
    return {
      links: rect.left,
      rechts: rect.right,
      oben: rect.top,
      unten: rect.bottom,
      fensterbreite: innerWidth,
      fensterhoehe: innerHeight,
      textSichtbar: Boolean(
        text && getComputedStyle(text).display !== 'none' && text.getBoundingClientRect().width > 0,
      ),
      scrollBreite: element.scrollWidth,
      clientBreite: element.clientWidth,
    };
  });
  expect(masse.links).toBeGreaterThanOrEqual(0);
  expect(masse.oben).toBeGreaterThanOrEqual(0);
  expect(masse.rechts).toBeLessThanOrEqual(masse.fensterbreite + 1);
  expect(masse.unten).toBeLessThanOrEqual(masse.fensterhoehe + 1);
  expect(masse.textSichtbar).toBe(true);
  expect(masse.scrollBreite).toBeLessThanOrEqual(masse.clientBreite + 1);
  return masse;
}

for (const textgroesse of [100, 200] as const) {
  test(`Testausgabe: echter UI-Weg bei 1280 × 720 und ${textgroesse} Prozent UI-Text`, async () => {
    const s = await starten();
    try {
      const { seite } = s;
      await textgroesseSetzen(seite, textgroesse);
      await seite.getByRole('button', { name: 'Testausgabe', exact: true }).click();
      const panel = seite.getByTestId('test-panel');
      await expect(panel).toBeVisible();
      const rahmen = seite.locator('.test-panel-rahmen');
      const anfangshoehe = await rahmen.evaluate((element) => element.getBoundingClientRect().height);
      expect(Math.abs(anfangshoehe - 280)).toBeLessThanOrEqual(1);

      // Nur diese beiden Dateiauswahlen sind gesteuerte Dialogantworten. Die Testausführung bleibt echt.
      await s.app.evaluate(({ dialog }, basis) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [basis] });
      }, s.basis);
      await panel.getByRole('button', { name: 'Ordner auswählen', exact: true }).click();
      await expect(
        panel.getByRole('textbox', { name: 'Basisordner für den nächsten Test', exact: true }),
      ).toHaveValue(s.basis);
      const zeitlimit = panel.getByRole('spinbutton', { name: 'Zeitlimit in Sekunden', exact: true });
      await zeitlimit.fill('10');
      await zeitlimit.press('Tab');
      await knopfImFenster(seite.getByRole('button', { name: 'Testen', exact: true }));
      await seite.getByRole('button', { name: 'Testen', exact: true }).click();
      await expect
        .poll(
          () =>
            seite.evaluate(async () => {
              const antwort = await window.scriptlab.testLesen();
              return antwort.ok ? antwort.wert.zustand.phase : antwort.meldung;
            }),
          { timeout: 20_000 },
        )
        .toBe('beendet');
      await expect(panel.getByRole('log', { name: 'Testausgabe', exact: true })).toHaveText(
        `${testtext}\r\n`,
      );

      const innen = panel.locator('.testbereich-inhalt');
      const scrollenVorher = await innen.evaluate((element) => {
        element.scrollTop = 0;
        return {
          hoehe: element.clientHeight,
          inhaltshoehe: element.scrollHeight,
          overflow: getComputedStyle(element).overflowY,
        };
      });
      expect(scrollenVorher.overflow).toMatch(/auto|scroll/);
      expect(scrollenVorher.inhaltshoehe).toBeGreaterThan(scrollenVorher.hoehe);
      await innen.hover({ position: { x: 8, y: 8 } });
      await seite.mouse.wheel(0, 600);
      await expect.poll(() => innen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      const ausgabe = panel.getByRole('log', { name: 'Testausgabe', exact: true });
      await ausgabe.scrollIntoViewIfNeeded();
      const ausgabeSicht = await ausgabe.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const grenzen = element.closest('.testbereich-inhalt')!.getBoundingClientRect();
        return {
          oben: rect.top,
          unten: rect.bottom,
          panelOben: grenzen.top,
          panelUnten: grenzen.bottom,
          text: element.textContent,
        };
      });
      expect(ausgabeSicht.oben).toBeGreaterThanOrEqual(ausgabeSicht.panelOben - 1);
      expect(ausgabeSicht.unten).toBeLessThanOrEqual(ausgabeSicht.panelUnten + 1);
      expect(ausgabeSicht.text).toContain(testtext);

      const trenner = seite.getByRole('separator', { name: 'Höhe der Testausgabe', exact: true });
      await trenner.focus();
      await trenner.press('ArrowUp');
      await expect
        .poll(() => rahmen.evaluate((element) => element.getBoundingClientRect().height))
        .toBe(anfangshoehe + 24);
      await trenner.press('ArrowDown');
      await expect
        .poll(() => rahmen.evaluate((element) => element.getBoundingClientRect().height))
        .toBe(anfangshoehe);
      await ausgabe.scrollIntoViewIfNeeded();
      const testenKnopf = await knopfImFenster(seite.getByRole('button', { name: 'Testen', exact: true }));
      const exportKnopf = await knopfImFenster(
        seite.getByRole('button', { name: 'VBS-Script exportieren', exact: true }),
      );
      const geometrie = await seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        dpr: devicePixelRatio,
        dokumentBreite: document.documentElement.scrollWidth,
        dokumentHoehe: document.documentElement.scrollHeight,
        canvasHoehe: document.querySelector('.canvas-bereich')!.getBoundingClientRect().height,
        panelHoehe: document.querySelector('.test-panel-rahmen')!.getBoundingClientRect().height,
        panelScrollTop: document.querySelector('.testbereich-inhalt')!.scrollTop,
        uiTextskala: getComputedStyle(document.querySelector('.anwendung')!)
          .getPropertyValue('--text-skala')
          .trim(),
      }));
      expect(Math.abs(geometrie.breite - 1280)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometrie.hoehe - 720)).toBeLessThanOrEqual(2);
      expect(geometrie.canvasHoehe).toBeGreaterThanOrEqual(120);
      expect(geometrie.dokumentBreite).toBeLessThanOrEqual(geometrie.breite + 1);
      expect(geometrie.dokumentHoehe).toBeLessThanOrEqual(geometrie.hoehe + 1);
      expect(Number(geometrie.uiTextskala)).toBe(textgroesse / 100);
      const ergebnis = await seite.evaluate(async () => {
        const antwort = await window.scriptlab.testLesen();
        if (!antwort.ok) throw new Error(antwort.meldung);
        const { phase, exitcode, ausgabe, gestartetAm, beendetAm } = antwort.wert.zustand;
        return { phase, exitcode, ausgabe, gestartetAm, beendetAm };
      });
      expect(ergebnis.exitcode).toBe(0);
      expect(ergebnis.ausgabe).toBe(`${testtext}\r\n`);
      await mkdir('artifacts/testlauf', { recursive: true });
      const name = `artifacts/testlauf/testausgabe-1280-text-${textgroesse}`;
      await zweiFrames(seite);
      await seite.screenshot({ path: `${name}.png` });
      await writeFile(
        `${name}.json`,
        JSON.stringify(
          {
            angefordert: { breite: 1280, hoehe: 720, uiTextProzent: textgroesse },
            geometrie,
            scrollenVorher,
            ausgabeSicht,
            testenKnopf,
            exportKnopf,
            ergebnis,
          },
          null,
          2,
        ),
        'utf8',
      );
      test.info().annotations.push({
        type: 'Gemessene logische Fläche',
        description: `${geometrie.breite} × ${geometrie.hoehe} CSS-Pixel, DPR ${geometrie.dpr}, UI-Text ${textgroesse} Prozent.`,
      });
    } finally {
      await beenden(s);
    }
  });
}
