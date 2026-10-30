import {
  workflowBefehl,
  feldEinblenden,
  arbeitsbereichWaehlen,
  laufansichtWaehlen,
  laufStarten,
} from './ansichten';
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
    await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
    await app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    }, projektdatei);
    await workflowBefehl(seite, 'oeffnen');
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
    await expect(seite.getByRole('button', { name: 'Workflow ausführen', exact: true })).toBeEnabled();
    const r = await seite.evaluate(() => window.scriptlab.testLesen());
    if (!r.ok || !r.wert.optionen.basisVerzeichnis) throw Error('Der Workflow-Arbeitsordner fehlt.');
    expect(r.wert.optionen.basisVerzeichnis).toContain(join(ordner, 'Profil', 'Arbeitsdateien'));
    return { app, seite, ordner, basis: r.wert.optionen.basisVerzeichnis, projektdatei };
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
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await dialog
    .getByRole('combobox', { name: 'Textgröße der Oberfläche', exact: true })
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
  test(`Laufansicht: echter UI-Weg bei 1280 × 720 und ${textgroesse} Prozent UI-Text`, async () => {
    const s = await starten();
    try {
      const { seite } = s;
      await textgroesseSetzen(seite, textgroesse);
      await laufansichtWaehlen(seite, 'Vorbereitung');
      const panel = seite.getByTestId('test-panel');
      await expect(panel).toBeVisible();
      await expect(seite.getByTestId('palette')).not.toBeVisible();
      await expect(seite.getByTestId('arbeitsbereich')).not.toBeVisible();
      const panelhoehe = await panel.evaluate((element) => element.getBoundingClientRect().height);
      expect(panelhoehe).toBeGreaterThanOrEqual(200);

      await panel.getByText('ScriptLab-Arbeitsordner', { exact: true }).click();
      await expect(panel.locator('.lauf-ordnerpfad')).toHaveText(s.basis);
      const zeitlimit = panel.getByLabel('Zeitlimit in Sekunden', { exact: true });
      await feldEinblenden(zeitlimit);
      await zeitlimit.fill('10');
      await zeitlimit.press('Tab');
      await knopfImFenster(panel.getByRole('button', { name: 'Workflow ausführen', exact: true }));
      const vorher = await seite.evaluate(async () => {
        const r = await window.scriptlab.laden();
        if (!r.ok) throw Error(r.meldung);
        return r.wert.dokument.projekt.editor;
      });
      await laufStarten(seite);
      try {
        await expect
          .poll(
            async () => {
              const r = await seite.evaluate(() => window.scriptlab.testLesen());
              return r.ok ? r.wert.zustand.phase : r.meldung;
            },
            { timeout: 20000 },
          )
          .toBe('beendet');
      } catch (fehler) {
        await test.info().attach('tatsaechlicher-laufzustand', {
          body: JSON.stringify(await seite.evaluate(() => window.scriptlab.testLesen()), null, 2),
          contentType: 'application/json',
        });
        throw fehler;
      }
      await expect(panel.getByRole('tab', { name: 'Übersicht', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(panel.getByRole('tabpanel', { name: 'Übersicht', exact: true })).toContainText(
        'Standkennung',
      );

      // Tastatur ersetzt die alte geteilte Panelgeometrie: Haupt- und Detailansicht bleiben getrennt.
      const uebersicht = panel.getByRole('tab', { name: 'Übersicht', exact: true });
      await uebersicht.focus();
      await uebersicht.press('End');
      await expect(panel.getByRole('tab', { name: 'Protokoll', exact: true })).toBeFocused();
      await expect(panel.getByRole('tab', { name: 'Protokoll', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(panel.getByRole('tabpanel', { name: 'Vorbereitung', exact: true })).not.toBeVisible();
      const ausgabe = panel.getByRole('log', { name: 'Laufprotokoll', exact: true });
      await expect(ausgabe).toHaveText(`${testtext}\r\n`);
      await ausgabe.scrollIntoViewIfNeeded();
      const innen = panel.locator('.testbereich-inhalt');
      const scrollen = await innen.evaluate((element) => ({
        hoehe: element.clientHeight,
        inhaltshoehe: element.scrollHeight,
        overflow: getComputedStyle(element).overflowY,
      }));
      expect(scrollen.overflow).toMatch(/auto|scroll/);
      expect(scrollen.hoehe).toBeGreaterThan(64);
      const ausgabeSicht = await ausgabe.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const g = element.closest('.testbereich-inhalt')!.getBoundingClientRect();
        return {
          oben: r.top,
          unten: r.bottom,
          panelOben: g.top,
          panelUnten: g.bottom,
          sichtbareHoehe: Math.max(0, Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top)),
          text: element.textContent,
        };
      });
      expect(ausgabeSicht.sichtbareHoehe).toBeGreaterThanOrEqual(64);
      expect(ausgabeSicht.text).toContain(testtext);
      if (scrollen.inhaltshoehe > scrollen.hoehe + 1) {
        await innen.evaluate((element) => {
          element.scrollTop = 0;
        });
        await innen.hover({ position: { x: 8, y: 8 } });
        await seite.mouse.wheel(0, 600);
        await expect.poll(() => innen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      }
      const vorbereitenKnopf = await knopfImFenster(
        panel.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }),
      );
      const exportKnopf = await knopfImFenster(
        seite.getByRole('button', { name: 'Exportieren', exact: true }),
      );
      const geometrie = await seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        dpr: devicePixelRatio,
        dokumentBreite: document.documentElement.scrollWidth,
        dokumentHoehe: document.documentElement.scrollHeight,
        panelHoehe: document.querySelector('.testbereich')!.getBoundingClientRect().height,
        canvasSichtbar: (
          document.querySelector('[data-testid="arbeitsbereich"]') as HTMLElement
        ).checkVisibility(),
        uiTextskala: getComputedStyle(document.querySelector('.anwendung')!)
          .getPropertyValue('--text-skala')
          .trim(),
      }));
      expect(Math.abs(geometrie.breite - 1280)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometrie.hoehe - 720)).toBeLessThanOrEqual(2);
      expect(geometrie.canvasSichtbar).toBe(false);
      expect(geometrie.dokumentBreite).toBeLessThanOrEqual(geometrie.breite + 1);
      expect(geometrie.dokumentHoehe).toBeLessThanOrEqual(geometrie.hoehe + 1);
      expect(Number(geometrie.uiTextskala)).toBe(textgroesse / 100);
      const ergebnis = await seite.evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (!r.ok) throw Error(r.meldung);
        const { phase, exitcode, ausgabe, gestartetAm, beendetAm } = r.wert.zustand;
        return { phase, exitcode, ausgabe, gestartetAm, beendetAm };
      });
      expect(ergebnis.exitcode).toBe(0);
      expect(ergebnis.ausgabe).toBe(`${testtext}\r\n`);
      await arbeitsbereichWaehlen(seite, 'Ablauf');
      await expect(seite.getByTestId('palette')).toBeVisible();
      expect(
        await seite.evaluate(async () => {
          const r = await window.scriptlab.laden();
          if (!r.ok) throw Error(r.meldung);
          return r.wert.dokument.projekt.editor;
        }),
      ).toEqual(vorher);
      await laufansichtWaehlen(seite, 'Protokoll');
      await mkdir('artifacts/qualitaet-desktop/lauf/testlauf', { recursive: true });
      const name = `artifacts/qualitaet-desktop/lauf/testlauf/laufansicht-1280-text-${textgroesse}`;
      await zweiFrames(seite);
      await seite.screenshot({ path: `${name}.png` });
      await writeFile(
        `${name}.json`,
        JSON.stringify(
          {
            angefordert: { breite: 1280, hoehe: 720, uiTextProzent: textgroesse },
            geometrie,
            scrollen,
            ausgabeSicht,
            vorbereitenKnopf,
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
