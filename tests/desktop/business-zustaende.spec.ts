import {
  arbeitsbereichWaehlen,
  startseiteWaehlen,
  workflowBefehl,
  workflowMenueAktion,
  einstellungenOeffnen,
  feldEinblenden,
} from './ansichten';
import { test, expect, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument, ProjektBibliothek } from '../../src/gemeinsam/bruecke';
import type { EditorBlock, Projekt } from '../../src/kern/projekt';
import { sprachwahlBestaetigen } from './sprache';

test.skip(process.platform !== 'win32', 'Diese Desktopprüfung benötigt Windows.');

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
  faktor: number;
}
type NativeTestdaten = typeof globalThis & {
  bizSpeicheranfragen?: number;
  bizOeffnenanfragen?: number;
  bizSchutzanfragen?: number;
};

async function frames(seite: Page): Promise<void> {
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}

async function groesse(s: Sitzung, breite: number, hoehe: number): Promise<void> {
  await s.app.evaluate(
    ({ BrowserWindow }, m) => BrowserWindow.getAllWindows()[0].setContentSize(m.breite, m.hoehe),
    { breite, hoehe },
  );
  await frames(s.seite);
  // Native Rahmenrundung bei gebrochenem Prozess-DPI, kein Browser-/Canvaszoom.
  for (let versuch = 0; versuch < 4; versuch++) {
    const ist = await s.seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
    if (ist.breite === breite && ist.hoehe === hoehe) break;
    await s.app.evaluate(
      ({ BrowserWindow }, delta) => {
        const fenster = BrowserWindow.getAllWindows()[0];
        const [b, h] = fenster.getContentSize();
        fenster.setContentSize(b + delta.breite, h + delta.hoehe);
      },
      { breite: breite - ist.breite, hoehe: hoehe - ist.hoehe },
    );
    await frames(s.seite);
  }
  const ist = await s.seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
  expect(Math.abs(ist.breite - breite)).toBeLessThanOrEqual(2);
  expect(Math.abs(ist.hoehe - hoehe)).toBeLessThanOrEqual(2);
}

async function starten(ordner?: string, faktor = 1): Promise<Sitzung> {
  const basis = ordner ?? (await mkdtemp(join(tmpdir(), 'ScriptLab-BizStates-')));
  const profil = join(basis, 'Profil');
  if (!ordner) {
    await mkdir(profil);
    await writeFile(
      join(profil, 'einstellungen.json'),
      JSON.stringify({
        automatischeUpdates: false,
        vorabversionen: false,
        letzteSkriptsprache: null,
        pythonInterpreter: null,
      }),
      'utf8',
    );
  }
  const app = await electron.launch({
    args: [resolve('.'), `--force-device-scale-factor=${faktor}`],
    cwd: basis,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  try {
    const seite = await app.firstWindow();
    const s = { app, seite, ordner: basis, profil, faktor };
    await groesse(s, 1280, 720);
    await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeEnabled();
    await app.evaluate(({ dialog }) => {
      const daten = globalThis as NativeTestdaten;
      daten.bizSchutzanfragen = 0;
      dialog.showMessageBox = async () => {
        daten.bizSchutzanfragen!++;
        return { response: 3, checkboxChecked: false };
      };
    });
    return s;
  } catch (fehler) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    throw fehler;
  }
}

async function ausschalten(s: Sitzung): Promise<void> {
  const prozess = s.app.process();
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
}

async function beenden(s: Sitzung): Promise<void> {
  await ausschalten(s);
  const ziel = resolve(s.ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-BizStates-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function dokument(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument;
  });
}

async function bibliothek(s: Sitzung): Promise<ProjektBibliothek> {
  return s.seite.evaluate(async () => {
    const r = await window.scriptlab.bibliothekLesen();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert;
  });
}

async function editorBereit(s: Sitzung): Promise<void> {
  await arbeitsbereichWaehlen(s.seite, 'Ablauf');
  await expect(s.seite.getByTestId('palette')).toBeVisible();
  await expect(s.seite.getByRole('button', { name: 'Workflow', exact: true })).toBeEnabled();
  await expect.poll(async () => (await dokument(s)).darstellungNoetig).toBe(false);
  await frames(s.seite);
}

function blockIds(projekt: Projekt): string[] {
  const ids: string[] = [];
  const lesen = (b?: EditorBlock) => {
    if (!b) return;
    ids.push(b.id);
    for (const e of Object.values(b.inputs ?? {})) lesen(e.block ?? e.shadow);
    lesen(b.next?.block);
  };
  for (const b of projekt.editor.blocks?.blocks ?? []) lesen(b);
  return ids.sort();
}

function pfadwerte(projekt: Projekt): Record<string, string> {
  return Object.fromEntries(
    ['Lagerdatei', 'Bestellvorlage', 'Ausgabeordner'].map((name) => {
      const p = projekt.business.parameter.find((p) => p.name === name);
      if (!p || typeof p.standard !== 'string') throw new Error(`Pfadparameter fehlt: ${name}`);
      expect(projekt.business.parametersaetze.test[name]).toBe(p.standard);
      return [name, p.standard];
    }),
  );
}

async function keinWorkflowstart(s: Sitzung): Promise<void> {
  const r = await s.seite.evaluate(() => window.scriptlab.testLesen());
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.meldung);
  expect(r.wert.zustand.phase).toBe('bereit');
  expect(r.wert.zustand.laufId).toBeNull();
  expect(r.wert.zustand.ausgabe).toBe('');
}

async function keineDocxAusgabe(ordner: string): Promise<void> {
  const dateien: string[] = [];
  const lesen = async (pfad: string) => {
    for (const e of await readdir(pfad, { withFileTypes: true })) {
      if (e.isDirectory()) await lesen(join(pfad, e.name));
      else dateien.push(e.name);
    }
  };
  await lesen(ordner);
  expect(dateien.filter((name) => /\.docx$/i.test(name))).toEqual([]);
}

async function speichernDialog(s: Sitzung, pfad: string | null): Promise<void> {
  await s.app.evaluate(({ dialog }, ziel) => {
    const daten = globalThis as NativeTestdaten;
    daten.bizSpeicheranfragen = 0;
    dialog.showSaveDialog = async () => {
      daten.bizSpeicheranfragen!++;
      return { canceled: ziel === null, filePath: ziel ?? '' };
    };
  }, pfad);
}

async function projektdateiExportieren(s: Sitzung): Promise<void> {
  await s.seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = s.seite.getByRole('dialog', { name: 'Exportieren', exact: true });
  await dialog.getByLabel('Inhalt', { exact: true }).selectOption('projekt');
  await dialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
}

async function dateivorgangFertig(s: Sitzung, art: 'speichern' | 'oeffnen'): Promise<void> {
  await expect
    .poll(() =>
      s.app.evaluate((_e, art) => {
        const daten = globalThis as NativeTestdaten;
        return art === 'speichern' ? daten.bizSpeicheranfragen : daten.bizOeffnenanfragen;
      }, art),
    )
    .toBe(1);
  await editorBereit(s);
  await expect(s.seite.locator('.verarbeitung-editor')).toHaveCount(0);
}

async function home(s: Sitzung): Promise<void> {
  await editorBereit(s);
  await startseiteWaehlen(s.seite);
  await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
}

async function screenshot(s: Sitzung, name: string, daten: Record<string, unknown> = {}): Promise<void> {
  await mkdir(resolve('artifacts/qualitaet-desktop/BizStates'), { recursive: true });
  await frames(s.seite);
  await s.seite.screenshot({ path: resolve(`artifacts/qualitaet-desktop/BizStates/${name}.png`) });
  const renderer = await s.seite.evaluate(() => {
    const knopf = document.querySelector<HTMLElement>(
      '[data-testid="eigenschaften-panel"] .schritt-vorschau',
    );
    return {
      breite: innerWidth,
      hoehe: innerHeight,
      dpr: devicePixelRatio,
      bodyScrollBreite: document.body.scrollWidth,
      dokumentScrollBreite: document.documentElement.scrollWidth,
      vorschauKnopf: knopf
        ? {
            hoehe: knopf.getBoundingClientRect().height,
            clientHoehe: knopf.clientHeight,
            scrollHoehe: knopf.scrollHeight,
            lineHeight: getComputedStyle(knopf).lineHeight,
            flexShrink: getComputedStyle(knopf).flexShrink,
          }
        : null,
    };
  });
  const fenster = await s.app.evaluate(({ BrowserWindow, screen }) => {
    const fenster = BrowserWindow.getAllWindows()[0];
    return {
      inhalt: fenster.getContentSize(),
      zoomFaktor: fenster.webContents.getZoomFactor(),
      displayScale: screen.getDisplayMatching(fenster.getBounds()).scaleFactor,
    };
  });
  await writeFile(
    resolve(`artifacts/qualitaet-desktop/BizStates/${name}.json`),
    JSON.stringify(
      {
        prozessFaktor: s.faktor,
        skalierungsart:
          'Prozessweise --force-device-scale-factor; keine Änderung der Windows-Systemskalierung',
        renderer,
        fenster,
        ...daten,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}

test('Businesszustände: C-Vorlagenkopie behält absolute Klonpfade bei Exportabbruch, internem Speichern, Wiederöffnen, Home und Entwurfswiederaufnahme', async () => {
  test.setTimeout(75000);
  const s = await starten();
  const quelle = resolve('beispiele/business/C-Bestellvorschlag');
  const original = await readFile(join(quelle, 'workflow.scriptlab'));
  const originalProjekt = JSON.parse(original.toString('utf8')) as Projekt;
  const originalLager = await readFile(join(quelle, 'eingaben/Lager.xlsx'));
  const originalVorlage = await readFile(join(quelle, 'vorlagen/Bestellung.docx'));
  try {
    await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
    const beispiel = s.seite
      .getByTestId('beispiele')
      .getByRole('article')
      .filter({
        has: s.seite.getByRole('heading', { name: 'Bestellvorschlag als Word-Dokument', exact: true }),
      });
    await beispiel.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
    await editorBereit(s);
    const kopie = await dokument(s);
    const pfade = pfadwerte(kopie.projekt);
    const klon = dirname(dirname(pfade.Lagerdatei));
    expect(dirname(klon)).toBe(join(s.profil, 'Arbeitsdateien'));
    expect(basename(klon)).toMatch(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
    expect(pfade).toEqual({
      Lagerdatei: join(klon, 'eingaben/Lager.xlsx'),
      Bestellvorlage: join(klon, 'vorlagen/Bestellung.docx'),
      Ausgabeordner: join(klon, 'ausgaben'),
    });
    for (const pfad of Object.values(pfade)) expect(isAbsolute(pfad)).toBe(true);
    expect(await readFile(pfade.Lagerdatei)).toEqual(originalLager);
    expect(await readFile(pfade.Bestellvorlage)).toEqual(originalVorlage);
    expect(kopie.projektKennung).not.toBe(originalProjekt.projektKennung);
    expect(blockIds(kopie.projekt)).toEqual(blockIds(originalProjekt));
    expect(kopie.geaendert).toBe(true);

    await speichernDialog(s, null);
    await projektdateiExportieren(s);
    await dateivorgangFertig(s, 'speichern');
    const nachAbbruch = await dokument(s);
    expect(nachAbbruch.dateiname).toBeNull();
    expect(nachAbbruch.geaendert).toBe(true);
    expect(nachAbbruch.projektKennung).toBe(kopie.projektKennung);
    expect(pfadwerte(nachAbbruch.projekt)).toEqual(pfade);
    expect(blockIds(nachAbbruch.projekt)).toEqual(blockIds(kopie.projekt));

    const andererOrdner = join(s.ordner, 'Anderer Projektordner');
    await mkdir(andererOrdner);
    const projektdatei = join(andererOrdner, 'Bestellvorschlag.scriptlab');
    const intern = join(s.profil, 'Workflows', `${kopie.projektKennung}.scriptlab`);
    await speichernDialog(s, null);
    await s.seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect.poll(async () => (await dokument(s)).geaendert).toBe(false);
    await expect.poll(async () => (await dokument(s)).dateiname).toBe(basename(intern));
    expect(await s.app.evaluate(() => (globalThis as NativeTestdaten).bizSpeicheranfragen)).toBe(0);
    await expect
      .poll(
        async () =>
          (await bibliothek(s)).projekte.find((p) => p.projektKennung === kopie.projektKennung)?.pfad,
      )
      .toBe(intern);
    const interneDatei = await readFile(intern);
    await speichernDialog(s, projektdatei);
    await projektdateiExportieren(s);
    await dateivorgangFertig(s, 'speichern');
    expect((await dokument(s)).dateiname).toBe(basename(intern));
    expect((await dokument(s)).geaendert).toBe(false);
    const datei = await readFile(projektdatei);
    const gespeichert = JSON.parse(datei.toString('utf8')) as Projekt;
    expect(gespeichert.projektKennung).toBe(kopie.projektKennung);
    expect(pfadwerte(gespeichert)).toEqual(pfade);

    await s.app.evaluate(({ dialog }, ziel) => {
      const daten = globalThis as NativeTestdaten;
      daten.bizOeffnenanfragen = 0;
      dialog.showOpenDialog = async () => {
        daten.bizOeffnenanfragen!++;
        return { canceled: false, filePaths: [ziel] };
      };
    }, intern);
    await workflowBefehl(s.seite, 'oeffnen');
    await dateivorgangFertig(s, 'oeffnen');
    expect(pfadwerte((await dokument(s)).projekt)).toEqual(pfade);
    expect(blockIds((await dokument(s)).projekt)).toEqual(blockIds(gespeichert));

    await home(s);
    await s.seite.getByRole('button', { name: /^Weiterbearbeiten/ }).click();
    await editorBereit(s);
    expect((await dokument(s)).projektKennung).toBe(kopie.projektKennung);
    expect(pfadwerte((await dokument(s)).projekt)).toEqual(pfade);

    await workflowMenueAktion(s.seite, 'Projektangaben');
    const angaben = s.seite.getByRole('dialog', { name: 'Projektangaben', exact: true });
    await angaben
      .getByLabel('Projektbeschreibung', { exact: true })
      .fill('Synthetischer Entwurf: portable Pfade unverändert.');
    await angaben.getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await expect
      .poll(async () => (await dokument(s)).entwurfStatus.phase, { timeout: 8000 })
      .toBe('gesichert');
    const entwurf = (await dokument(s)).entwurfStatus.id;
    expect(entwurf).not.toBeNull();
    await expect.poll(async () => (await bibliothek(s)).entwuerfe.some((e) => e.id === entwurf)).toBe(true);
    await screenshot(s, 'c-vorlage-gespeichert', {
      projektKennung: kopie.projektKennung,
      pfade: Object.fromEntries(
        Object.entries(pfade).map(([n, p]) => [
          n,
          `%TESTPROFIL%/${relative(s.profil, p).replaceAll('\\', '/')}`,
        ]),
      ),
    });
    await keinWorkflowstart(s);
    await keineDocxAusgabe(pfade.Ausgabeordner);
    expect(await s.app.evaluate(() => (globalThis as NativeTestdaten).bizSchutzanfragen)).toBe(0);
    await ausschalten(s);
    Object.assign(s, await starten(s.ordner));
    await expect(s.seite.getByTestId('entwuerfe-hinweis')).toBeVisible();
    await s.seite.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    await s.seite
      .getByTestId('entwuerfe')
      .locator(`[data-entwurf-id="${entwurf}"]`)
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await editorBereit(s);
    const wiederhergestellt = await dokument(s);
    expect(wiederhergestellt.projektKennung).toBe(kopie.projektKennung);
    expect(wiederhergestellt.projekt.beschreibung).toBe('Synthetischer Entwurf: portable Pfade unverändert.');
    expect(pfadwerte(wiederhergestellt.projekt)).toEqual(pfade);
    expect(blockIds(wiederhergestellt.projekt)).toEqual(blockIds(gespeichert));
    expect(await readFile(projektdatei)).toEqual(datei);
    expect(await readFile(intern)).toEqual(interneDatei);
    expect(await readFile(join(quelle, 'workflow.scriptlab'))).toEqual(original);
    expect(await readFile(join(quelle, 'eingaben/Lager.xlsx'))).toEqual(originalLager);
    expect(await readFile(join(quelle, 'vorlagen/Bestellung.docx'))).toEqual(originalVorlage);
    await keineDocxAusgabe(pfade.Ausgabeordner);
    await keinWorkflowstart(s);
    expect(await s.app.evaluate(() => (globalThis as NativeTestdaten).bizSchutzanfragen)).toBe(0);
  } finally {
    await beenden(s);
  }
});

async function sprachwahl(s: Sitzung): Promise<Locator> {
  await workflowBefehl(s.seite, 'neu');
  const dialog = s.seite.getByRole('dialog', { name: 'Neuer Workflow', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Für Geschäftsprozesse mit Daten, Excel und Dokumenten.');
  await expect(dialog).toContainText('Für kleine Windows-Aufgaben und bestehende VBScript-Abläufe.');
  return dialog;
}

test('Businesszustände: Sprachwahl per Tastatur und Abbrechen behalten den bisherigen Stand', async () => {
  const s = await starten();
  try {
    const vorher = await dokument(s);
    const dialog = await sprachwahl(s);
    await expect(dialog.getByRole('button', { name: 'Workflow erstellen', exact: true })).toBeDisabled();
    await s.seite.keyboard.press('Tab');
    await s.seite.keyboard.press('Tab');
    const python = dialog.getByRole('radio', { name: 'Python', exact: true });
    const vbs = dialog.getByRole('radio', { name: 'VBScript (VBS)', exact: true });
    await expect(python).toBeFocused();
    await python.press('Space');
    await expect(python).toBeChecked();
    await python.press('ArrowDown');
    await expect(vbs).toBeChecked();
    await dialog.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect((await dokument(s)).projekt).toEqual(vorher.projekt);
    await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeFocused();
    await sprachwahl(s);
    await expect(python).not.toBeChecked();
    await expect(vbs).not.toBeChecked();
    await python.focus();
    await python.press('ArrowDown');
    await expect(vbs).toBeChecked();
    await dialog.getByRole('button', { name: 'Workflow erstellen', exact: true }).press('Enter');
    await editorBereit(s);
    await expect(s.seite.getByTestId('editor-sprache')).toHaveText('VBScript (VBS)');
    await keinWorkflowstart(s);
    await screenshot(s, 'sprachwahl-tastatur-vbs');
  } finally {
    await beenden(s);
  }
});

async function darstellungPruefen(s: Sitzung): Promise<Record<string, unknown>> {
  const messung = await s.seite.evaluate(() => {
    const probleme: string[] = [];
    const details: Record<string, unknown>[] = [];
    const elemente = document.querySelectorAll<HTMLElement>(
      'button, .sl-feld > label, .sprachwahl-name, .panel-kopf h2',
    );
    for (const element of elemente) {
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || element.closest('[hidden]'))
        continue;
      if (element.scrollWidth > element.clientWidth + 2)
        probleme.push((element.getAttribute('aria-label') || element.textContent || '').trim());
      if (element.scrollHeight > element.clientHeight + 2)
        probleme.push((element.getAttribute('aria-label') || element.textContent || '').trim() + ' (Höhe)');
      if (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)
        details.push({
          text: element.textContent?.trim(),
          klasse: element.className,
          hoehe: r.height,
          clientHoehe: element.clientHeight,
          scrollHoehe: element.scrollHeight,
          breite: r.width,
          clientBreite: element.clientWidth,
          scrollBreite: element.scrollWidth,
          css: {
            overflow: getComputedStyle(element).overflow,
            fontSize: getComputedStyle(element).fontSize,
            lineHeight: getComputedStyle(element).lineHeight,
            flexShrink: getComputedStyle(element).flexShrink,
          },
        });
    }
    return {
      breite: innerWidth,
      hoehe: innerHeight,
      dpr: devicePixelRatio,
      bodyUeberbreite: document.body.scrollWidth - innerWidth,
      dokumentUeberbreite: document.documentElement.scrollWidth - innerWidth,
      abgeschnitteneLabels: probleme,
      layoutdetails: details,
    };
  });
  if (messung.abgeschnitteneLabels.length)
    await screenshot(s, `layoutbefund-${messung.breite}x${messung.hoehe}`, { pruefung: messung });
  expect(messung.bodyUeberbreite).toBeLessThanOrEqual(2);
  expect(messung.dokumentUeberbreite).toBeLessThanOrEqual(2);
  expect(messung.abgeschnitteneLabels).toEqual([]);
  return messung;
}

async function wichtigeAktionen(s: Sitzung): Promise<void> {
  const pruefen = async (knopf: Locator) => {
    await expect(knopf).toBeVisible();
    const r = await knopf.boundingBox();
    const fenster = await s.seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
    expect(r).not.toBeNull();
    expect(r!.width).toBeGreaterThanOrEqual(32);
    expect(r!.height).toBeGreaterThanOrEqual(32);
    expect(r!.x).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(fenster.breite + 1);
    expect(r!.y + r!.height).toBeLessThanOrEqual(fenster.hoehe);
  };
  for (const name of ['Workflow', 'Speichern', 'Exportieren'])
    await pruefen(s.seite.getByRole('button', { name, exact: true }));
  await s.seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  for (const name of ['Neuer Workflow', 'Workflow öffnen'])
    await pruefen(s.seite.getByRole('menuitem', { name, exact: true }));
  await s.seite.keyboard.press('Escape');
}

async function datenblockEinrichten(s: Sitzung): Promise<void> {
  await workflowBefehl(s.seite, 'neu');
  await sprachwahlBestaetigen(s.seite, 'python');
  await editorBereit(s);
  const palette = s.seite.getByTestId('palette');
  await palette.getByLabel('Bausteine suchen').fill('CSV-Tabelle lesen');
  await palette.getByRole('button', { name: 'Baustein einfügen: CSV-Tabelle lesen', exact: true }).click();
  await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
  const eig = s.seite.getByTestId('eigenschaften-panel');
  await eig
    .getByRole('textbox', { name: 'Dateipfad', exact: true })
    .fill('C:\\ScriptLab-Testdaten\\Monatsabrechnung und Rückfragen\\Oktober 2026\\Ausgangsdaten.csv');
  const fehlzeilen = eig.getByRole('combobox', {
    name: 'Fehlerhafte Zeilen',
    exact: true,
    includeHidden: true,
  });
  await feldEinblenden(fehlzeilen);
  await fehlzeilen.selectOption('AUSLASSEN_MIT_BERICHT');
  await s.seite.getByRole('button', { name: 'Zoom auf 100 Prozent zurücksetzen', exact: true }).click();
  expect((await dokument(s)).projekt.ansicht.zoom).toBe(1);
  await wichtigeAktionen(s);
  const canvas = await s.seite.getByTestId('arbeitsbereich').boundingBox();
  expect(canvas!.height).toBeGreaterThanOrEqual(120);
  await keinWorkflowstart(s);
}

for (const faktor of [1, 1.25, 1.5, 2]) {
  for (const [breite, hoehe] of [
    [1280, 720],
    [1600, 1000],
  ]) {
    test(`Businesszustände: Prozess-DPI ${faktor * 100}% bei ${breite}×${hoehe} CSS-Pixeln`, async () => {
      test.setTimeout(45000);
      const s = await starten(undefined, faktor);
      const name = `dpi-${faktor * 100}-${breite}x${hoehe}`;
      try {
        await groesse(s, breite, hoehe);
        const dialog = await sprachwahl(s);
        await darstellungPruefen(s);
        await screenshot(s, `${name}-sprachwahl`);
        await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
        await datenblockEinrichten(s);
        const eig = s.seite.getByTestId('eigenschaften-panel');
        await expect(eig).toHaveClass(breite < 1440 ? /ist-ueberlagert/ : /ist-ueberlagert|ist-angeheftet/);
        const messung = await darstellungPruefen(s);
        expect(Math.abs(Number(messung.dpr) - faktor)).toBeLessThan(0.02);
        await screenshot(s, name, {
          pruefung: messung,
          canvasZoom: (await dokument(s)).projekt.ansicht.zoom,
        });
      } finally {
        await beenden(s);
      }
    });
  }
}

for (const [breite, hoehe] of [
  [1280, 720],
  [1600, 1000],
]) {
  test(`Businesszustände: echte UI-Textgröße 200% bleibt bei ${breite}×${hoehe} vom Canvaszoom getrennt`, async () => {
    test.setTimeout(45000);
    const s = await starten();
    try {
      await groesse(s, breite, hoehe);
      const einstellungen = await einstellungenOeffnen(s.seite);
      await einstellungen.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('2');
      await einstellungen.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
      const wahl = await sprachwahl(s);
      await darstellungPruefen(s);
      await screenshot(s, `ui-text-200-${breite}x${hoehe}-sprachwahl`);
      await wahl.getByRole('button', { name: 'Abbrechen', exact: true }).click();
      await datenblockEinrichten(s);
      const geladen = await s.seite.evaluate(() => window.scriptlab.laden());
      expect(geladen.ok && geladen.wert.einstellungen.textSkalierung).toBe(2);
      expect((await dokument(s)).projekt.ansicht.zoom).toBe(1);
      await s.seite
        .getByTestId('eigenschaften-panel')
        .locator('.panel-inhalt')
        .evaluate((e) => (e.scrollTop = 0));
      const messung = await darstellungPruefen(s);
      await screenshot(s, `ui-text-200-${breite}x${hoehe}`, {
        pruefung: messung,
        uiTextFaktor: 2,
        canvasZoom: 1,
      });
    } finally {
      await beenden(s);
    }
  });
}
