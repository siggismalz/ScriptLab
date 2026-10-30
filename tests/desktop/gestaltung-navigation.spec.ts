import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { neuesProjekt, projektPruefen, type Projekt } from '../../src/kern/projekt';
import { Projektindex, Entwurfspeicher, dateistandLesen } from '../../src/main/projektablage';
import type { Dokument, Einstellungen } from '../../src/gemeinsam/bruecke';

const nachweise = resolve('artifacts/qualitaet-desktop/gestaltung-navigation');
const monatName = 'Testdaten · Monatsauswertung Vertrieb und Kundenservice Oktober 2026';
const vbsName = 'Testdaten · Eingangsbelege im Archiv ablegen (VBS)';
const entwurfName = 'Testdaten · Entwurf für Lieferantenabgleich mit fehlenden Zuordnungen';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
  projekte: Projekt[];
  entwurf: Projekt;
}

async function vorbereiten(anzahl = 2): Promise<Omit<Sitzung, 'app' | 'seite'>> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Gestaltung-Navigation-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  await writeFile(
    join(profil, 'einstellungen.json'),
    JSON.stringify({
      automatischeUpdates: false,
      vorabversionen: false,
      darstellung: 'dunkel',
    }),
  );
  const index = new Projektindex(join(profil, 'projektbibliothek.json'));
  await index.initialisieren();
  const projekte: Projekt[] = [];
  for (let n = 0; n < anzahl; n++) {
    const projekt =
      n === 0
        ? projektPruefen(
            JSON.parse(
              await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
            ),
          )
        : neuesProjekt(n % 2 === 0 ? 'python' : 'vbs');
    projekt.projektKennung = randomUUID();
    projekt.name =
      n === 0
        ? monatName
        : n === 1
          ? vbsName
          : `Testdaten · Workflow ${String(n + 1).padStart(3, '0')} für die monatliche Sachbearbeitung`;
    projekt.beschreibung = 'Synthetische Testdaten zur Prüfung der Oberfläche. Keine echten Kundendaten.';
    const datei = join(ordner, `Testworkflow-${String(n + 1).padStart(3, '0')}.scriptlab`);
    await writeFile(datei, JSON.stringify(projekt, null, 2));
    await index.merken(datei, await dateistandLesen(datei), true);
    projekte.push(projekt);
  }
  const entwurf = neuesProjekt('python');
  entwurf.name = entwurfName;
  entwurf.beschreibung = 'Synthetischer, lokal gesicherter Testentwurf. Noch keine Projektdatei.';
  const entwuerfe = new Entwurfspeicher(join(profil, 'entwuerfe'));
  entwuerfe.planen(entwurf, null, null);
  await entwuerfe.flush();
  return { ordner, profil, projekte, entwurf };
}

async function starten(daten: Omit<Sitzung, 'app' | 'seite'>): Promise<Sitzung> {
  const app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    cwd: daten.ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: daten.profil },
  });
  const seite = await app.firstWindow();
  const sitzung = { ...daten, app, seite };
  await fenster(sitzung, 1280, 720);
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  await expect(seite.getByTestId('entwuerfe-hinweis')).toBeVisible();
  return sitzung;
}

async function beenden(s: Sitzung) {
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  const ziel = resolve(s.ordner);
  if (
    !ziel.startsWith(resolve(tmpdir()) + sep) ||
    !basename(ziel).startsWith('ScriptLab-Gestaltung-Navigation-')
  )
    throw new Error('Der temporäre Testordner liegt nicht innerhalb des erlaubten Bereichs.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function fenster(s: Sitzung, breite: number, hoehe: number) {
  await s.app.evaluate(
    ({ BrowserWindow }, groesse) =>
      BrowserWindow.getAllWindows()[0].setContentSize(groesse.breite, groesse.hoehe),
    { breite, hoehe },
  );
  await expect.poll(() => s.seite.evaluate(() => [innerWidth, innerHeight])).toEqual([breite, hoehe]);
}

async function dokument(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument;
  });
}

async function bild(s: Sitzung, name: string) {
  await mkdir(nachweise, { recursive: true });
  await s.seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  await s.seite.screenshot({ path: join(nachweise, `${name}.png`) });
}

async function bereich(s: Sitzung, name: 'Start' | 'Workflows' | 'Vorlagen' | 'Hilfe' | 'Einstellungen') {
  if (await s.seite.getByRole('button', { name: 'Bereiche', exact: true }).isVisible()) {
    await s.seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
    await s.seite.getByRole('menuitem', { name, exact: true }).click();
  } else {
    await s.seite.getByTestId('startbereich').getByRole('button', { name, exact: true }).click();
  }
}

async function thema(s: Sitzung, wert: 'dunkel' | 'hell' | 'system', schliessen = true) {
  await bereich(s, 'Einstellungen');
  const dialog = s.seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await dialog.getByLabel('Farbschema', { exact: true }).selectOption(wert);
  await expect
    .poll(async () => JSON.parse(await readFile(join(s.profil, 'einstellungen.json'), 'utf8')).darstellung)
    .toBe(wert);
  if (wert !== 'system')
    await expect
      .poll(() => s.seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe(wert === 'hell' ? 'light' : 'dark');
  if (schliessen) await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
}

async function editorBereit(s: Sitzung) {
  await expect(s.seite.getByRole('tab', { name: 'Ablauf', exact: true })).toBeVisible();
  await expect.poll(async () => (await dokument(s)).darstellungNoetig).toBe(false);
}

test('Gestaltung: gespeicherte Workflows, Entwurf und Vorlagenkopie behalten ihren wirklichen Arbeitsstand', async () => {
  test.setTimeout(90_000);
  const s = await starten(await vorbereiten());
  try {
    const ersteDatei = join(s.ordner, 'Testworkflow-001.scriptlab');
    const original = await readFile(ersteDatei);
    for (const farbe of ['dunkel', 'hell'] as const) {
      await thema(s, farbe);
      await bereich(s, 'Start');
      await expect(s.seite.getByTestId('zuletzt-geoeffnet').getByRole('article')).toHaveCount(2);
      await bild(s, `start-mit-workflows-entwurf-${farbe}-1280`);
      await s.seite.getByTestId('zuletzt-geoeffnet').scrollIntoViewIfNeeded();
      await bild(s, `start-zuletzt-geoeffnet-${farbe}-1280`);
      await bereich(s, 'Workflows');
      const liste = s.seite.getByTestId('bekannte-projekte');
      await liste.getByLabel('Gespeicherte Workflows durchsuchen', { exact: true }).fill('Monatsauswertung');
      await liste.getByLabel('Workflows nach Sprache filtern', { exact: true }).selectOption('python');
      await liste.getByLabel('Workflows sortieren', { exact: true }).selectOption('name');
      await expect(liste.locator('[data-projekt-id]')).toHaveCount(1);
      const zeile = liste.locator('[data-projekt-id]').first();
      await zeile.click();
      await expect(zeile).toHaveClass(/ist-ausgewaehlt/);
      await bild(s, `workflowliste-suche-auswahl-${farbe}-1280`);
      await zeile.getByRole('button', { name: 'Öffnen', exact: true }).click();
      await editorBereit(s);
      const vorher = await dokument(s);
      expect(vorher.projekt.projektKennung).toBe(s.projekte[0].projektKennung);
      await s.seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
      await expect.poll(async () => (await dokument(s)).projekt.ansicht.zoom).toBeGreaterThan(1);
      const ansicht = (await dokument(s)).projekt.ansicht;
      const canvas = s.seite.getByTestId('arbeitsbereich');
      const anzahlBlocks = await canvas.locator('.blocklyBlockCanvas > g[data-id]').count();
      await s.seite.getByRole('tab', { name: 'Daten und Parameter', exact: true }).click();
      await expect(s.seite.getByTestId('datenbereich')).toBeVisible();
      const datenansichten = s.seite.getByRole('tablist', {
        name: 'Ansichten für Daten und Parameter',
        exact: true,
      });
      const datenScroll = s.seite.locator('.daten-ansichten');
      await datenScroll.evaluate((e) => {
        e.scrollTop = 120;
      });
      const datenPosition = await datenScroll.evaluate((e) => e.scrollTop);
      await datenansichten.getByRole('tab', { name: 'Parameterwerte', exact: true }).click();
      await s.seite.getByLabel('Angezeigte Parameterwerte', { exact: true }).selectOption('echt');
      await datenansichten.getByRole('tab', { name: 'Datenvorschau', exact: true }).click();
      await expect(s.seite.getByRole('tabpanel', { name: 'Datenvorschau', exact: true })).toContainText(
        'Für diesen Schritt ist noch keine Datenvorschau geladen.',
      );
      await datenansichten.getByRole('tab', { name: 'Parameterwerte', exact: true }).click();
      await expect(s.seite.getByLabel('Angezeigte Parameterwerte', { exact: true })).toHaveValue('echt');
      await datenansichten.getByRole('tab', { name: 'Quellen und Zuordnung', exact: true }).click();
      await expect.poll(() => datenScroll.evaluate((e) => e.scrollTop)).toBe(datenPosition);
      await s.seite.getByRole('tab', { name: 'Läufe', exact: true }).click();
      await expect(s.seite.getByTestId('test-panel')).toBeVisible();
      await s.seite.getByRole('tab', { name: 'Ablauf', exact: true }).click();
      await expect(canvas).toBeVisible();
      expect(await canvas.locator('.blocklyBlockCanvas > g[data-id]').count()).toBe(anzahlBlocks);
      const nachher = await dokument(s);
      expect(nachher.projekt.editor).toEqual(vorher.projekt.editor);
      expect(nachher.projekt.ansicht).toEqual(ansicht);
      expect(nachher.geaendert).toBe(vorher.geaendert);
      await bereich(s, 'Workflows');
      await expect(liste.getByLabel('Gespeicherte Workflows durchsuchen', { exact: true })).toHaveValue(
        'Monatsauswertung',
      );
      await expect(liste.getByLabel('Workflows nach Sprache filtern', { exact: true })).toHaveValue('python');
      await expect(liste.getByLabel('Workflows sortieren', { exact: true })).toHaveValue('name');
      await expect(liste.locator('[data-projekt-id]').first()).toHaveClass(/ist-ausgewaehlt/);
      await s.seite.getByRole('button', { name: 'Entwürfe', exact: true }).click();
      const entwurf = s.seite
        .getByTestId('entwuerfe')
        .getByRole('article', { name: entwurfName, exact: true });
      await expect(entwurf).toContainText('Noch nicht als Projektdatei gespeichert');
      await bild(s, `entwuerfe-${farbe}-1280`);
      await bereich(s, 'Vorlagen');
      await bild(s, `vorlagen-${farbe}-1280`);
      await s.seite.getByRole('button', { name: 'Dokumentvorlagen', exact: true }).click();
      await expect(s.seite.getByRole('heading', { name: 'Bestellung.docx', exact: true })).toBeVisible();
      await bild(s, `dokumentvorlagen-${farbe}-1280`);
      await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
    }
    await bereich(s, 'Workflows');
    await s.seite.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    await s.seite
      .getByTestId('entwuerfe')
      .getByRole('article', { name: entwurfName, exact: true })
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await editorBereit(s);
    const fortgesetzt = await dokument(s);
    expect(fortgesetzt.projekt.projektKennung).toBe(s.entwurf.projektKennung);
    expect(fortgesetzt.projekt.name).toBe(entwurfName);
    expect(fortgesetzt.geaendert).toBe(true);
    // Vorlagenwechsel erhält den offenen Entwurf bewusst, ohne eine Speicherentscheidung zu überspringen.
    await s.app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await bereich(s, 'Vorlagen');
    const vorlagendatei = resolve('beispiele/01-Begruessung.scriptlab');
    const vorlagenoriginal = await readFile(vorlagendatei);
    const vorlagenprojekt = projektPruefen(JSON.parse(vorlagenoriginal.toString('utf8')));
    const vorlage = s.seite
      .getByTestId('beispiele')
      .getByRole('article', { name: 'Eine Nachricht anzeigen – VBScript (VBS)', exact: true });
    await vorlage.getByRole('button', { name: 'Eine Nachricht anzeigen', exact: true }).click();
    await vorlage.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
    await editorBereit(s);
    const kopie = await dokument(s);
    expect(kopie.projekt.projektKennung).not.toBe(vorlagenprojekt.projektKennung);
    expect(kopie.projekt.name).toContain('(Kopie)');
    expect(kopie.dateiname).toBeNull();
    expect(await readFile(vorlagendatei)).toEqual(vorlagenoriginal);
    expect(await readFile(ersteDatei)).toEqual(original);
    const lauf = await s.seite.evaluate(async () => {
      const r = await window.scriptlab.testLesen();
      if (!r.ok) throw new Error(r.meldung);
      return r.wert.zustand;
    });
    expect(lauf.laufId).toBeNull();
  } finally {
    await beenden(s);
  }
});

test('Gestaltung: Thema, Systemwechsel, UI-Vergrößerung und Tastatur bleiben unabhängig vom Canvas', async () => {
  test.setTimeout(90_000);
  let s = await starten(await vorbereiten());
  try {
    await thema(s, 'hell');
    await s.app.evaluate(({ app }) => app.exit(0));
    s = await starten(s);
    await expect
      .poll(() => s.seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('light');
    await thema(s, 'system');
    await s.seite.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(() => s.seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('dark');
    await s.seite.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() => s.seite.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('light');
    await bereich(s, 'Einstellungen');
    const dialog = s.seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
    await bild(s, 'einstellungen-hell-1280');
    await dialog.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('2');
    await expect(s.seite.locator('.anwendung')).toHaveCSS('font-size', '28px');
    await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
    await bild(s, 'start-hell-1280-ui200');
    expect(await s.seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const einstellungen = s.seite
      .getByTestId('startbereich')
      .getByRole('button', { name: 'Einstellungen', exact: true });
    await einstellungen.focus();
    await einstellungen.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Einstellungen', exact: true })).toBeFocused();
    await s.seite.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Dialog schließen', exact: true })).toBeFocused();
    await s.seite.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(einstellungen).toBeFocused();
    await fenster(s, 850, 600);
    await bild(s, 'start-hell-850-ui200');
    expect(await s.seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await bereich(s, 'Workflows');
    const liste = s.seite.getByTestId('bekannte-projekte');
    await liste.getByLabel('Gespeicherte Workflows durchsuchen', { exact: true }).fill('Monatsauswertung');
    await liste.locator('[data-projekt-id]').getByRole('button', { name: 'Öffnen', exact: true }).click();
    await editorBereit(s);
    const vorher = await dokument(s);
    const tabs = s.seite.getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true });
    await tabs.getByRole('tab', { name: 'Ablauf', exact: true }).focus();
    await s.seite.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Daten und Parameter', exact: true })).toBeFocused();
    await expect(tabs.getByRole('tab', { name: 'Daten und Parameter', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(s.seite.getByTestId('datenbereich')).toBeVisible();
    const fokussiert = await s.seite.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      const r = e.getBoundingClientRect();
      const c = getComputedStyle(e);
      return {
        sichtbar: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        kontur: c.outlineStyle,
        breite: c.outlineWidth,
      };
    });
    expect(fokussiert.sichtbar).toBe(true);
    expect(fokussiert.kontur).not.toBe('none');
    expect(parseFloat(fokussiert.breite)).toBeGreaterThanOrEqual(2);
    const datenansichten = s.seite.getByRole('tablist', {
      name: 'Ansichten für Daten und Parameter',
      exact: true,
    });
    await datenansichten.getByRole('tab', { name: 'Quellen und Zuordnung', exact: true }).focus();
    await s.seite.keyboard.press('End');
    await expect(datenansichten.getByRole('tab', { name: 'Datenvorschau', exact: true })).toBeFocused();
    await expect(datenansichten.getByRole('tab', { name: 'Datenvorschau', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await bild(s, 'daten-hell-850-ui200-tastatur');
    await fenster(s, 1280, 720);
    await bild(s, 'daten-hell-1280-ui200');
    expect((await dokument(s)).projekt.ansicht.zoom).toBe(vorher.projekt.ansicht.zoom);
    expect((await dokument(s)).geaendert).toBe(vorher.geaendert);
    await thema(s, 'dunkel', false);
    await bild(s, 'einstellungen-dunkel-1280-ui200');
    await dialog.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption('1');
    await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
    await thema(s, 'dunkel', false);
    await bild(s, 'einstellungen-dunkel-1280');
    await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
    const werte = JSON.parse(await readFile(join(s.profil, 'einstellungen.json'), 'utf8')) as Einstellungen;
    expect(werte.darstellung).toBe('dunkel');
    expect(werte.textSkalierung).toBe(1);
    expect((await dokument(s)).projekt.editor).toEqual(vorher.projekt.editor);
  } finally {
    await beenden(s);
  }
});

test('Gestaltung: größere lokale Workflowliste erhält Suche, Auswahl und Scrollposition', async () => {
  test.setTimeout(90_000);
  const s = await starten(await vorbereiten(80));
  try {
    await bereich(s, 'Workflows');
    const liste = s.seite.getByTestId('bekannte-projekte');
    await expect(liste.locator('[data-projekt-id]')).toHaveCount(50);
    await liste.getByLabel('Workflows sortieren', { exact: true }).selectOption('name');
    const seiten = liste.getByRole('navigation', { name: 'Seiten der Workflowliste', exact: true });
    await expect(seiten).toContainText('Seite 1 von 2');
    await seiten.getByRole('button', { name: 'Nächste Seite', exact: true }).click();
    await expect(liste.locator('[data-projekt-id]')).toHaveCount(30);
    await expect(seiten).toContainText('Seite 2 von 2');
    const zeile = liste.locator('[data-projekt-id]').nth(20);
    await zeile.getByRole('button', { name: 'Öffnen', exact: true }).scrollIntoViewIfNeeded();
    await zeile.click();
    // Nach dem Einblenden des textlichen Auswahlzustands den endgültigen Auslöser sichtbar halten.
    // Playwrights eigener Klick darf die Ausgangsposition nicht erst nach dem Messpunkt verschieben.
    await zeile.getByRole('button', { name: 'Öffnen', exact: true }).scrollIntoViewIfNeeded();
    await s.seite.evaluate(
      () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
    );
    const ausgewaehlt = await zeile.getAttribute('data-projekt-id');
    const scrollVorher = await s.seite.getByTestId('start-inhalt').evaluate((e) => e.scrollTop);
    const zeileVorher = await zeile.boundingBox();
    expect(scrollVorher).toBeGreaterThan(200);
    await zeile.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await editorBereit(s);
    await bereich(s, 'Workflows');
    await expect(liste.locator('[data-projekt-id]')).toHaveCount(30);
    await expect(seiten).toContainText('Seite 2 von 2');
    await expect(liste.locator(`[data-projekt-id="${ausgewaehlt}"]`)).toHaveClass(/ist-ausgewaehlt/);
    await expect
      .poll(async () =>
        Math.abs((await s.seite.getByTestId('start-inhalt').evaluate((e) => e.scrollTop)) - scrollVorher),
      )
      .toBeLessThan(8);
    const zeileDanach = await liste.locator(`[data-projekt-id="${ausgewaehlt}"]`).boundingBox();
    expect(Math.abs(zeileDanach!.y - zeileVorher!.y)).toBeLessThan(8);
    await liste.getByLabel('Gespeicherte Workflows durchsuchen', { exact: true }).fill('Workflow 078');
    await expect(liste.locator('[data-projekt-id]')).toHaveCount(1);
    const r = await s.seite.evaluate(async () => {
      const r = await window.scriptlab.bibliothekLesen();
      if (!r.ok) throw new Error(r.meldung);
      return r.wert;
    });
    expect(r.projekte).toHaveLength(80);
    expect(r.entwuerfe).toHaveLength(1);
  } finally {
    await beenden(s);
  }
});
