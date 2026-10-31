import { expect, test, type Locator } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { neuesProjekt, type Projekt } from '../../src/kern/projekt';
import { testAktiv, type TestZustand } from '../../src/gemeinsam/testlauf';
import type { Dokument, Einstellungen } from '../../src/gemeinsam/bruecke';
import { arbeitsbereichWaehlen, workflowBefehl } from './ansichten';

test.skip(
  process.platform !== 'win32',
  'Die Datenarbeitsansicht verwendet die echte Windows-Bündellaufzeit.',
);
test.setTimeout(90_000);

const quelleId = 'datenarbeitsansicht-quelle';
const kopfzeile = [
  'Kundennummer',
  'Ausführliche deutsche Kundenbezeichnung für die monatliche Abrechnung',
  'Umsatz',
];
const sollzeilen = Array.from({ length: 240 }, (_, n) => [
  String(n + 1).padStart(4, '0'),
  `Synthetischer Kunde ${n + 1} mit langer deutscher Bezeichnung und Rückfragen`,
  n === 0 ? '12.50' : `${n}.00`,
]);
const csv = [kopfzeile.join(','), ...sollzeilen.map((z) => z.join(','))].join('\r\n') + '\r\n';
const ausgabeName = 'Vorschau darf dieses Original nicht ersetzen.csv';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
}

function projektErstellen(quelle: string): Projekt {
  const p = neuesProjekt('python');
  p.name = 'Synthetische Datenansicht mit langem deutschen Tabellenkopf';
  p.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_biz_lesen_csv',
      id: quelleId,
      fields: { NAME: 'Eigene CSV-Eingangsdaten' },
      data: JSON.stringify({
        konfiguration: { format: 'CSV', pfad: quelle, optionen: { trennzeichen: ';' } },
        eingaben: {},
      }),
      next: {
        block: {
          type: 'sl_biz_schreiben_csv',
          id: 'datenarbeitsansicht-ausgabe',
          fields: { NAME: 'Unverändertes Ausgabeziel' },
          data: JSON.stringify({
            konfiguration: {
              format: 'CSV',
              pfad: ausgabeName,
              konflikt: 'FEHLER',
              optionen: { trennzeichen: ';' },
            },
            eingaben: { tabelle: { referenz: quelleId } },
          }),
        },
      },
    },
  };
  return p;
}

async function zustand(seite: Page): Promise<TestZustand> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand;
  });
}
async function dokument(seite: Page): Promise<Dokument> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
}
async function uiAbwarten(seite: Page) {
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}

async function laden(seite: Page, panel: Locator): Promise<TestZustand> {
  const vorher = await zustand(seite);
  await panel.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  await expect.poll(async () => (await zustand(seite)).laufId, { timeout: 20_000 }).not.toBe(vorher.laufId);
  await expect.poll(async () => !testAktiv((await zustand(seite)).phase), { timeout: 30_000 }).toBe(true);
  const ende = await zustand(seite);
  expect(ende.phase, JSON.stringify(ende)).toBe('beendet');
  expect(ende.exitcode).toBe(0);
  expect(ende.pythonVersion).toMatch(/^3\./);
  expect(ende.optionen.business).toMatchObject({ modus: 'vorschau', vorschauBlockId: quelleId });
  return ende;
}

async function beenden(s: Sitzung) {
  try {
    const z = await zustand(s.seite);
    if (testAktiv(z.phase) && z.laufId) {
      await s.seite.evaluate(async (id) => {
        const r = await window.scriptlab.testStoppen(id);
        if (!r.ok) throw Error(r.meldung);
      }, z.laufId);
      await expect
        .poll(async () => !testAktiv((await zustand(s.seite)).phase), { timeout: 20_000 })
        .toBe(true);
    }
  } finally {
    const prozess = s.app.process();
    await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await expect.poll(() => prozess.exitCode !== null || prozess.signalCode !== null).toBe(true);
    const ziel = resolve(s.ordner);
    if (dirname(ziel) !== resolve(tmpdir()) || !basename(ziel).startsWith('ScriptLab-Datenarbeitsansicht-'))
      throw Error('Der eigene temporäre Datenansicht-Testordner ist nicht sicher abgegrenzt.');
    await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

for (const [darstellung, textSkalierung] of [
  ['hell', 1],
  ['dunkel', 2],
] as const) {
  test(`Datenarbeitsansicht: echte CSV-Vorschau, bewusste Korrektur und Orientierung (${darstellung}, ${textSkalierung * 100}%)`, async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Datenarbeitsansicht-'));
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
    const quelle = join(ordner, 'Eigene synthetische Kundenliste.csv');
    await writeFile(quelle, csv, 'utf8');
    const originalquelle = await readFile(quelle);
    const projekt = projektErstellen(quelle);
    const datei = join(ordner, 'Eigener Testworkflow.scriptlab');
    await writeFile(datei, JSON.stringify(projekt), 'utf8');
    const originalprojekt = await readFile(datei);
    const app = await electron.launch({
      args: [resolve('.'), '--force-device-scale-factor=1'],
      cwd: ordner,
      env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
    });
    const seite = await app.firstWindow();
    const s: Sitzung = { app, seite, ordner, profil };
    try {
      await app.evaluate(({ BrowserWindow, dialog }, pfad) => {
        BrowserWindow.getAllWindows()[0].setContentSize(1280, 720);
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
      }, datei);
      await expect(seite).toHaveURL(/^scriptlab:\/\/app\//);
      await expect(seite.locator('.anwendung')).toHaveCSS('font-size', `${14 * textSkalierung}px`);
      await expect(seite.locator('html')).toHaveCSS(
        'color-scheme',
        darstellung === 'hell' ? 'light' : 'dark',
      );
      await expect.poll(() => seite.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, 720]);
      await workflowBefehl(seite, 'oeffnen');
      await expect
        .poll(async () => {
          const d = await dokument(seite);
          return !d.darstellungNoetig && d.projektKennung === projekt.projektKennung;
        })
        .toBe(true);
      const basis = await seite.evaluate(async () => {
        const r = await window.scriptlab.testLesen();
        if (!r.ok || !r.wert.optionen.basisVerzeichnis)
          throw Error('Der eigene Workflow-Arbeitsordner fehlt.');
        return r.wert.optionen.basisVerzeichnis;
      });
      expect(basis.startsWith(join(profil, 'Arbeitsdateien') + sep)).toBe(true);
      await mkdir(basis, { recursive: true });
      const ausgabe = join(basis, ausgabeName);
      const originalausgabe = Buffer.from('UNVERÄNDERTES SYNTHETISCHES AUSGABEORIGINAL\r\n', 'utf8');
      await writeFile(ausgabe, originalausgabe);
      await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
      const daten = seite.getByTestId('datenbereich');
      const tabs = daten.getByRole('tablist', { name: 'Ansichten für Daten und Parameter', exact: true });
      await tabs.getByRole('tab', { name: 'Datenvorschau', exact: true }).click();
      const panel = daten.getByRole('tabpanel', { name: 'Datenvorschau', exact: true });
      await panel.getByLabel('Ergebnis bis zu diesem Schritt', { exact: true }).selectOption(quelleId);
      const kopfstart = seite
        .getByRole('navigation', { name: 'Projektaktionen', exact: true })
        .getByRole('button', { name: 'Workflow ausführen', exact: true });
      await expect(kopfstart).toBeVisible();
      await expect(kopfstart).toBeInViewport();
      await expect(seite.getByTestId('test-panel')).not.toBeVisible();
      expect((await zustand(seite)).laufId).toBeNull();

      const falsch = await laden(seite, panel);
      expect(falsch.business?.vorschau?.spalten).toEqual([{ name: kopfzeile.join(','), typ: 'VARCHAR' }]);
      expect((falsch.business?.vorschau?.zeilen as unknown[][])[0]).toEqual([sollzeilen[0].join(',')]);
      await expect(panel.getByText('Nur eine Spalte erkannt.', { exact: false })).toBeVisible();
      const korrektur = panel.getByRole('button', { name: 'Trennzeichen prüfen', exact: true });
      await korrektur.click();
      await expect(tabs.getByRole('tab', { name: 'Quellen und Zuordnung', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const trenner = daten.getByRole('textbox', { name: 'Trennzeichen', exact: true });
      await expect(trenner).toBeVisible();
      await expect(trenner).toBeFocused();
      await expect(trenner).toHaveValue(';');
      expect((await zustand(seite)).laufId).toBe(falsch.laufId);
      await trenner.fill(',');
      await trenner.press('Tab');
      expect((await zustand(seite)).laufId).toBe(falsch.laufId);
      await tabs.getByRole('tab', { name: 'Datenvorschau', exact: true }).click();
      await expect(panel).toContainText(
        'Workflow oder verwendete Parameter wurden seit dieser Vorschau geändert',
      );

      const richtig = await laden(seite, panel);
      expect(richtig.laufId).not.toBe(falsch.laufId);
      expect(richtig.business?.vorschau?.spalten).toEqual(
        kopfzeile.map((name) => ({ name, typ: 'VARCHAR' })),
      );
      expect(richtig.business?.vorschau?.zeilen).toEqual(sollzeilen.slice(0, 200));
      await expect(panel.getByRole('button', { name: 'Trennzeichen prüfen', exact: true })).toHaveCount(0);
      await expect(panel).toContainText('200 Vorschauzeilen geladen');
      await expect(panel).toContainText('Der Ausschnitt wurde begrenzt');
      const tabelle = panel.getByRole('region', {
        name: 'Schreibgeschützte Vorschautabelle, horizontal und vertikal scrollbar',
        exact: true,
      });
      await expect(tabelle.getByRole('row')).toHaveCount(51);
      await expect(tabelle.getByRole('cell', { name: '0001', exact: true })).toBeVisible();
      await expect(tabelle.getByRole('cell', { name: sollzeilen[0][1], exact: true })).toBeVisible();
      await expect(tabelle.getByRole('cell', { name: '12.50', exact: true })).toBeVisible();
      await expect(tabelle.getByRole('button', { name: new RegExp(kopfzeile[1]) })).toHaveAttribute(
        'title',
        kopfzeile[1],
      );
      if (textSkalierung === 2) await tabelle.scrollIntoViewIfNeeded();
      await uiAbwarten(seite);
      const masse = await tabelle.evaluate((e) => {
        const r = e.getBoundingClientRect();
        const zeile = e.querySelector('tbody tr')!.getBoundingClientRect();
        const vierteZeile = e.querySelectorAll('tbody tr')[3].getBoundingClientRect();
        const kopf = e.querySelector('thead')!.getBoundingClientRect();
        const schrift = parseFloat(getComputedStyle(e).fontSize);
        return {
          oben: r.top,
          unten: Math.min(r.bottom, innerHeight),
          ersteZeileOben: zeile.top,
          ersteZeileUnten: zeile.bottom,
          vierteZeileUnten: vierteZeile.bottom,
          kopfHoehe: kopf.height,
          schrift,
          dokumentUeberbreite: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(masse.kopfHoehe).toBeLessThanOrEqual(masse.schrift * 4 + 16);
      expect(masse.dokumentUeberbreite).toBeLessThanOrEqual(2);
      if (textSkalierung === 1) {
        // Ohne Scrollen/scrollIntoView: echte erste Datenzeile unmittelbar im Fenster.
        expect(masse.ersteZeileOben).toBeGreaterThanOrEqual(masse.oben);
        expect(masse.ersteZeileUnten).toBeLessThanOrEqual(masse.unten);
        expect(masse.vierteZeileUnten).toBeLessThanOrEqual(masse.unten);
      }
      await mkdir(resolve('artifacts/qualitaet-ui-neu'), { recursive: true });
      await seite.screenshot({
        path: resolve(`artifacts/qualitaet-ui-neu/daten-${darstellung}-${textSkalierung * 100}.png`),
      });

      const suche = panel.getByRole('searchbox', { name: 'In geladenen Vorschauzeilen suchen', exact: true });
      await suche.fill('0001');
      await expect(tabelle.getByRole('row')).toHaveCount(2);
      const vorNavigation = await zustand(seite);
      await arbeitsbereichWaehlen(seite, 'Ablauf');
      await arbeitsbereichWaehlen(seite, 'Daten und Parameter');
      await expect(tabs.getByRole('tab', { name: 'Datenvorschau', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(suche).toHaveValue('0001');
      await expect(tabelle.getByRole('cell', { name: '0001', exact: true })).toBeVisible();
      const nachNavigation = await zustand(seite);
      expect({
        id: nachNavigation.laufId,
        phase: nachNavigation.phase,
        gestartet: nachNavigation.gestartetAm,
        ende: nachNavigation.beendetAm,
        prozess: nachNavigation.prozessId,
      }).toEqual({
        id: vorNavigation.laufId,
        phase: vorNavigation.phase,
        gestartet: vorNavigation.gestartetAm,
        ende: vorNavigation.beendetAm,
        prozess: vorNavigation.prozessId,
      });
      await suche.fill('');
      await expect(panel.getByText('Herkunft und Laufstand', { exact: true })).toHaveCount(0);
      await expect(panel).not.toContainText(richtig.laufId!);
      await expect(panel).not.toContainText(richtig.standHash!);
      await expect(panel).toContainText('Vorschauzeilen geladen');
      expect(richtig.standHash).toBeTruthy();
      expect(await readFile(quelle)).toEqual(originalquelle);
      expect(await readFile(ausgabe)).toEqual(originalausgabe);
      expect(await readFile(datei)).toEqual(originalprojekt);
    } finally {
      await beenden(s);
    }
  });
}
