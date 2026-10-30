import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument, Einstellungen } from '../../src/gemeinsam/bruecke';
import { projektPruefen } from '../../src/kern/projekt';
import { beispiele } from '../../src/renderer/hilfe';

const bilder = resolve('artifacts/karten-vorlagen');
interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
}

async function starten(darstellung: 'hell' | 'dunkel', textSkalierung: 1 | 2): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Vorlagen-Bedienung-'));
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
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  await expect(seite.locator('.anwendung')).toHaveCSS('font-size', `${14 * textSkalierung}px`);
  await expect
    .poll(() => seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe(darstellung === 'hell' ? 'light' : 'dark');
  expect(await seite.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, 720]);
  return { app, seite, ordner };
}

async function beenden(s: Sitzung) {
  if (s.app.process().exitCode === null && s.app.process().signalCode === null) {
    const geschlossen = s.app.waitForEvent('close');
    await Promise.all([geschlossen, s.app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
  }
  const ziel = resolve(s.ordner);
  if (
    !ziel.startsWith(resolve(tmpdir()) + sep) ||
    !basename(ziel).startsWith('ScriptLab-Vorlagen-Bedienung-')
  )
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function dokument(seite: Page): Promise<Dokument> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.dokument;
  });
}

async function keinLauf(seite: Page) {
  const r = await seite.evaluate(() => window.scriptlab.testLesen());
  expect(r.ok && r.wert.zustand.phase).toBe('bereit');
  expect(r.ok && r.wert.zustand.laufId).toBeNull();
}

async function bild(seite: Page, name: string) {
  await mkdir(bilder, { recursive: true });
  await seite.screenshot({ path: join(bilder, `${name}.png`) });
}

for (const farbe of ['hell', 'dunkel'] as const) {
  for (const skala of [1, 2] as const) {
    test(`Vorlagen: Suche, Tastatur und eigener Arbeitsstand (${farbe}, ${100 * skala} % Text)`, async () => {
      const s = await starten(farbe, skala);
      try {
        const vorher = await dokument(s.seite);
        const quelle = resolve('beispiele/05-Python-Datei-Backup.scriptlab');
        const original = await readFile(quelle);
        const vorlage = projektPruefen(JSON.parse(original.toString('utf8')));
        await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
        const bereich = s.seite.getByTestId('beispiele');
        await expect(bereich.getByRole('article')).toHaveCount(beispiele.length);
        await expect(bereich.getByRole('button', { name: 'Als Vorlage öffnen', exact: true })).toHaveCount(0);
        const karten = bereich.getByRole('article');
        async function raster(spalten: 1 | 2 | 3) {
          const boxen = await karten.evaluateAll((elemente) =>
            elemente.slice(0, 4).map((e) => {
              const b = e.getBoundingClientRect();
              return { x: b.x, y: b.y, rechts: b.right, unten: b.bottom };
            }),
          );
          for (let n = 1; n < spalten; n++) {
            expect(Math.abs(boxen[n].y - boxen[0].y)).toBeLessThan(1);
            expect(boxen[n].x).toBeGreaterThan(boxen[n - 1].rechts);
          }
          expect(Math.abs(boxen[spalten].x - boxen[0].x)).toBeLessThan(1);
          expect(boxen[spalten].y).toBeGreaterThan(boxen[0].unten);
          await mkdir(bilder, { recursive: true });
          const breite = await s.seite.evaluate(() => innerWidth);
          await writeFile(
            join(bilder, `raster-${farbe}-${100 * skala}-${breite}.json`),
            JSON.stringify({ spalten, boxen }, null, 2),
          );
        }
        await raster(skala === 1 ? 3 : 1);
        await bild(s.seite, `kartenraster-${farbe}-${100 * skala}`);
        if (skala === 1) {
          await s.app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].setContentSize(1100, 720),
          );
          await expect.poll(() => s.seite.evaluate(() => innerWidth)).toBe(1100);
          await raster(2);
          await s.app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].setContentSize(1280, 720),
          );
          await expect.poll(() => s.seite.evaluate(() => innerWidth)).toBe(1280);
          await raster(3);
        }
        const ersteAuswahl = karten.nth(0).getByRole('button', { name: beispiele[0].name, exact: true });
        await bereich.getByRole('combobox', { name: 'Beispiele nach Sprache filtern', exact: true }).focus();
        await s.seite.keyboard.press('Tab');
        await expect(ersteAuswahl).toBeFocused();
        const fokus = await karten.nth(0).evaluate((e) => {
          const style = getComputedStyle(e);
          return { stil: style.outlineStyle, breite: style.outlineWidth, abstand: style.outlineOffset };
        });
        expect(fokus.stil).not.toBe('none');
        await writeFile(join(bilder, `fokus-${farbe}-${100 * skala}.json`), JSON.stringify(fokus, null, 2));
        await ersteAuswahl.press('Enter');
        await expect(bereich.getByRole('heading', { name: 'Vor dem ersten Lauf', exact: true })).toHaveCount(
          1,
        );
        await expect(ersteAuswahl).toHaveAttribute('aria-expanded', 'true');
        const ausgewaehlt = await karten.nth(0).boundingBox();
        const rasterbreite = await bereich.locator('.vorlagen-liste').evaluate((e) => e.clientWidth);
        expect(ausgewaehlt!.width).toBeCloseTo(rasterbreite, 0);
        // Auch der Ergebnisbereich gehört zur auswählbaren Kartenfläche; nur der Öffnenknopf öffnet.
        const ergebnisFlaeche = karten.nth(1).getByText(beispiele[1].ergebnis, { exact: true });
        await ergebnisFlaeche.scrollIntoViewIfNeeded();
        const ergebnisBox = await ergebnisFlaeche.boundingBox();
        expect(ergebnisBox).not.toBeNull();
        await s.seite.mouse.click(
          ergebnisBox!.x + ergebnisBox!.width / 2,
          ergebnisBox!.y + ergebnisBox!.height / 2,
        );
        await expect(ersteAuswahl).toHaveAttribute('aria-expanded', 'false');
        await expect(
          karten.nth(1).getByRole('button', { name: beispiele[1].name, exact: true }),
        ).toHaveAttribute('aria-expanded', 'true');
        await expect(bereich.getByRole('heading', { name: 'Vor dem ersten Lauf', exact: true })).toHaveCount(
          1,
        );
        expect((await dokument(s.seite)).projekt).toEqual(vorher.projekt);
        await keinLauf(s.seite);
        const suche = bereich.getByRole('searchbox', { name: 'Vorlagen suchen', exact: true });
        const aufgabe = bereich.getByRole('combobox', { name: 'Aufgabe', exact: true });
        const sprache = bereich.getByRole('combobox', {
          name: 'Beispiele nach Sprache filtern',
          exact: true,
        });
        await suche.fill('Sicherung');
        await suche.press('Tab');
        await expect(aufgabe).toBeFocused();
        await aufgabe.selectOption('Dateien');
        await aufgabe.press('Tab');
        await expect(sprache).toBeFocused();
        await sprache.selectOption('python');
        await expect(bereich.getByRole('article')).toHaveCount(1);
        const zeile = bereich.getByRole('article', {
          name: 'Eine Testdatei sichern – Python',
          exact: true,
        });
        const auswahl = zeile.getByRole('button', {
          name: 'Eine Testdatei sichern',
          exact: true,
        });
        await auswahl.focus();
        await auswahl.press('Enter');
        await expect(auswahl).toHaveAttribute('aria-expanded', 'true');
        await expect(zeile.getByRole('heading', { name: 'Vor dem ersten Lauf', exact: true })).toBeVisible();
        await expect(zeile).toContainText('vorhandene Sicherungen werden nicht überschrieben');
        await auswahl.press('Tab');
        await expect(zeile.locator('summary')).toBeFocused();
        await zeile.locator('summary').press('Enter');
        await expect(zeile).toContainText('05-Python-Datei-Backup.scriptlab');
        await zeile.locator('summary').press('Tab');
        const verwenden = zeile.getByRole('button', { name: 'Als Vorlage öffnen', exact: true });
        await expect(verwenden).toBeFocused();
        expect(await verwenden.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
        await bild(s.seite, `sicherung-${farbe}-${100 * skala}-vorbereitung`);
        expect(await bereich.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        expect(await s.seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await s.seite.getByTestId('startbereich').getByRole('button', { name: 'Hilfe', exact: true }).click();
        await s.seite
          .getByTestId('startbereich')
          .getByRole('button', { name: 'Vorlagen', exact: true })
          .click();
        await expect(suche).toHaveValue('Sicherung');
        await expect(aufgabe).toHaveValue('Dateien');
        await expect(sprache).toHaveValue('python');
        await expect(auswahl).toHaveAttribute('aria-expanded', 'true');
        expect((await dokument(s.seite)).projekt).toEqual(vorher.projekt);
        await keinLauf(s.seite);

        await suche.fill('Kein vorhandener Geschäftsprozess');
        await expect(bereich).toContainText('Keine passenden Vorlagen gefunden');
        await expect(bereich.getByRole('article')).toHaveCount(0);
        await bereich.getByRole('button', { name: 'Filter zurücksetzen', exact: true }).click();
        await expect(bereich.getByRole('article')).toHaveCount(beispiele.length);
        await expect(auswahl).toHaveAttribute('aria-expanded', 'true');
        // Erst dieser bewusste Knopfdruck ändert den aktiven Workflow.
        await verwenden.click();
        await expect(s.seite.getByTestId('palette')).toBeVisible();
        await expect.poll(async () => (await dokument(s.seite)).darstellungNoetig).toBe(false);
        const kopie = await dokument(s.seite);
        expect(kopie.projekt.name).toBe(`${vorlage.name} (Kopie)`);
        expect(kopie.projektKennung).not.toBe(vorlage.projektKennung);
        expect(kopie.projekt.skriptsprache).toBe('python');
        expect(kopie.projekt.editor).toEqual(vorlage.editor);
        expect(kopie.dateiname).toBeNull();
        expect(kopie.geaendert).toBe(true);
        expect(await readFile(quelle)).toEqual(original);
        await keinLauf(s.seite);
      } finally {
        await beenden(s);
      }
    });
  }
}

test('Dokumentvorlage: Datei, Workflow und eigene Kopie gehören zum selben Eintrag', async () => {
  const s = await starten('dunkel', 1);
  try {
    const info = beispiele.find((vorlage) => vorlage.id === 'business-bestellvorschlag')!;
    const quelle = resolve('beispiele', info.dateiname);
    const original = await readFile(quelle);
    const vorlage = projektPruefen(JSON.parse(original.toString('utf8')));
    await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
    const bereich = s.seite.getByTestId('beispiele');
    await bereich.getByRole('button', { name: 'Dokumentvorlagen', exact: true }).click();
    await bereich.getByRole('searchbox', { name: 'Vorlagen suchen', exact: true }).fill('Bestellung.docx');
    await expect(bereich.getByRole('article')).toHaveCount(1);
    await bereich.getByRole('button', { name: 'Bestellung.docx', exact: true }).click();
    await expect(bereich).toContainText(`Workflow: ${info.name}`);
    await expect(bereich).toContainText(info.ergebnis);
    await s.seite.getByTestId('startbereich').getByRole('button', { name: 'Hilfe', exact: true }).click();
    await s.seite.getByTestId('startbereich').getByRole('button', { name: 'Vorlagen', exact: true }).click();
    await expect(bereich.getByRole('button', { name: 'Dokumentvorlagen', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(bereich.getByRole('button', { name: 'Bestellung.docx', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await keinLauf(s.seite);
    await bild(s.seite, 'dokumentvorlage-dunkel-100');
    await bereich.getByRole('button', { name: 'Workflow mit Vorlage verwenden', exact: true }).click();
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    const kopie = await dokument(s.seite);
    expect(kopie.projekt.name).toBe(`${vorlage.name} (Kopie)`);
    expect(kopie.projektKennung).not.toBe(vorlage.projektKennung);
    expect(kopie.projekt.skriptsprache).toBe('python');
    expect(kopie.dateiname).toBeNull();
    expect(await readFile(quelle)).toEqual(original);
    await keinLauf(s.seite);
  } finally {
    await beenden(s);
  }
});
