import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { EditorBlock, Projekt } from '../../src/kern/projekt';
import { farben, masse } from '../../src/gestaltung/tokens';
import { uiTestprojekte, langerQuellpfad, langerZielpfad } from '../ui/fixtures';

type Sitzung = { app: ElectronApplication; seite: Page; ordner: string };

async function starten(faktor = 1, breite = 1280, hoehe = 720): Promise<Sitzung> {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-UX-'));
  const app = await electron.launch({
    args: ['.', `--force-device-scale-factor=${faktor}`],
    cwd: resolve('.'),
    env: { ...process.env, SCRIPTLAB_TESTDATEN: join(ordner, 'Profil') },
  });
  try {
    const seite = await app.firstWindow();
    await app.evaluate(
      ({ BrowserWindow }, masse) => {
        BrowserWindow.getAllWindows()[0].setContentSize(masse.breite, masse.hoehe);
      },
      { breite, hoehe },
    );
    await seite.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    // Windows rundet Rahmen und DIP bei gebrochenem DPI-Faktor. Ziel bleibt die gemessene CSS-Fläche.
    for (let versuch = 0; versuch < 4; versuch++) {
      const ist = await seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
      if (ist.breite === breite && ist.hoehe === hoehe) break;
      await app.evaluate(
        ({ BrowserWindow }, delta) => {
          const fenster = BrowserWindow.getAllWindows()[0];
          const [b, h] = fenster.getContentSize();
          fenster.setContentSize(b + delta.x, h + delta.y);
        },
        { x: breite - ist.breite, y: hoehe - ist.hoehe },
      );
      await seite.evaluate(
        () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
    }
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await expect(seite.getByTestId('statusleiste')).toBeVisible();
    await expect(seite.getByTestId('palette')).toBeVisible();
    const wirklich = await seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
    expect(Math.abs(wirklich.breite - breite)).toBeLessThanOrEqual(2);
    expect(Math.abs(wirklich.hoehe - hoehe)).toBeLessThanOrEqual(2);
    if (wirklich.breite !== breite || wirklich.hoehe !== hoehe)
      test.info().annotations.push({
        type: 'Native DIP-Rundung',
        description: `Angefordert ${breite}×${hoehe}, tatsächlich ${wirklich.breite}×${wirklich.hoehe} CSS-Pixel. Kein Browserzoom verwendet.`,
      });
    return { app, seite, ordner };
  } catch (fehler) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await testordnerEntfernen(ordner);
    throw fehler;
  }
}

async function beenden(s: Sitzung): Promise<void> {
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await testordnerEntfernen(s.ordner);
}

async function testordnerEntfernen(ordner: string): Promise<void> {
  const ziel = resolve(ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-UX-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function oeffnen(s: Sitzung, dateiname: keyof typeof uiTestprojekte): Promise<void> {
  const datei = join(s.ordner, dateiname);
  await writeFile(datei, JSON.stringify(uiTestprojekte[dateiname]), 'utf8');
  await s.app.evaluate(({ dialog }, ziel) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ziel] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, datei);
  await s.seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect.poll(async () => (await projektLesen(s.seite)).name).toBe(uiTestprojekte[dateiname].name);
  await expect
    .poll(() => s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()))
    .toContain(uiTestprojekte[dateiname].name);
  await expect
    .poll(() => s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()))
    .toContain('ScriptLab');
}

async function speicherziel(s: Sitzung, ziel: string | null): Promise<void> {
  await s.app.evaluate(({ dialog }, datei) => {
    dialog.showSaveDialog = async () => ({ canceled: datei === null, filePath: datei ?? '' });
  }, ziel);
}

async function projektLesen(seite: Page): Promise<Projekt> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument.projekt;
  });
}

function alleBausteine(p: Projekt): EditorBlock[] {
  const ausgabe: EditorBlock[] = [];
  const sammeln = (b: EditorBlock) => {
    ausgabe.push(b);
    for (const eingang of Object.values(b.inputs ?? {})) {
      if (eingang.block) sammeln(eingang.block);
      else if (eingang.shadow) sammeln(eingang.shadow);
    }
    if (b.next) sammeln(b.next.block);
  };
  p.editor.blocks?.blocks.forEach(sammeln);
  return ausgabe;
}

async function screenshot(seite: Page, name: string): Promise<void> {
  await mkdir('artifacts/ui', { recursive: true });
  await seite.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await seite.screenshot({ path: `artifacts/ui/${name}.png` });
}

async function eigenschaftenOeffnen(seite: Page, blockId: string): Promise<void> {
  await seite.locator(`g[data-id="${blockId}"]`).click({ position: { x: 56, y: 22 } });
  if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
  await expect(seite.getByTestId('eigenschaften-panel')).toBeVisible();
}

async function eigenschaftMitWert(seite: Page, wert: string) {
  const felder = seite.getByTestId('eigenschaften-panel').locator('textarea, input:not([type=checkbox])');
  for (let i = 0; i < (await felder.count()); i++)
    if ((await felder.nth(i).inputValue()) === wert) return felder.nth(i);
  throw new Error('Die vollständige Eigenschaft ist in keinem normal großen Eingabefeld erreichbar.');
}

async function einstellungenOeffnen(seite: Page): Promise<void> {
  const direkt = seite.getByRole('button', { name: 'Einstellungen', exact: true });
  if (await direkt.isVisible()) await direkt.click();
  else {
    await seite.getByRole('button', { name: /^(Menü|Weitere Aktionen|Weitere Funktionen|Mehr)$/ }).click();
    await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  }
  await expect(seite.getByRole('dialog', { name: 'Einstellungen', exact: true })).toBeVisible();
}

for (const faktor of [1, 1.25, 1.5, 2]) {
  test(`UX: 1280 × 720 CSS-Pixel bei prozessweiser DPI-Darstellung ${faktor * 100} Prozent`, async () => {
    const s = await starten(faktor);
    try {
      const { seite } = s;
      await expect(seite.getByTestId('code-panel')).not.toBeVisible();
      await expect(seite.getByTestId('eigenschaften-panel')).not.toBeVisible();
      await expect(seite.getByRole('button', { name: 'Als VBS exportieren', exact: true })).toBeVisible();
      const p = await projektLesen(seite);
      expect(alleBausteine(p).map((b) => b.type)).toEqual(['sl_start']);
      const palette = (await seite.getByTestId('palette').boundingBox())!;
      expect(palette.width).toBeGreaterThanOrEqual(268);
      expect(palette.width).toBeLessThanOrEqual(280);
      expect(await seite.locator('.blocklyFlyout:visible').count()).toBe(0);
      expect(
        await seite.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      const umgebung = await s.app.evaluate(({ screen, BrowserWindow }) => ({
        displayScaleFactor: screen.getPrimaryDisplay().scaleFactor,
        inhalt: BrowserWindow.getAllWindows()[0].getContentBounds(),
      }));
      const renderer = await seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        devicePixelRatio,
      }));
      await mkdir('artifacts/ui', { recursive: true });
      await writeFile(
        `artifacts/ui/dpi-${faktor * 100}.json`,
        JSON.stringify(
          {
            typ: 'Prozess-DPI, keine Änderung der Windows-Anzeigeeinstellungen',
            angefordert: { faktor, breite: 1280, hoehe: 720 },
            ...umgebung,
            renderer,
          },
          null,
          2,
        ),
      );
      await test.info().attach('Tatsächliche DPI- und CSS-Maße', {
        body: JSON.stringify(
          {
            typ: 'prozessweise DPI-Darstellung, keine Änderung der Windows-Anzeigeeinstellung',
            angefordert: faktor,
            ...umgebung,
            renderer,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      await screenshot(seite, `standard-1280-dpi-${faktor * 100}`);
    } finally {
      await beenden(s);
    }
  });
}

test('UX: Suche hat Treffer, einen eigenen Leerzustand und stellt die Kategorie wieder her', async () => {
  const s = await starten();
  try {
    const suche = s.seite.getByRole('searchbox', { name: 'Bausteine suchen', exact: true });
    const palette = s.seite.getByTestId('palette');
    await suche.fill('Nachricht');
    await expect(palette.getByRole('button', { name: /^Baustein einfügen:.*Nachricht/i })).toBeVisible();
    await expect(palette).toContainText('Ein- und Ausgaben');
    await screenshot(s.seite, 'suche-treffer');
    await suche.fill('Dieser Begriff hat absichtlich keinerlei Treffer 981');
    await expect(palette).toContainText('Keine Bausteine gefunden');
    await palette.getByRole('button', { name: 'Suche leeren', exact: true }).first().click();
    await expect(suche).toHaveValue('');
    await expect(palette.getByRole('button', { name: /^Baustein einfügen:.*Nachricht/i })).toBeVisible();
    await suche.fill('Absichtlich kein Treffer 981');
    await screenshot(s.seite, 'suche-ohne-treffer');
  } finally {
    await beenden(s);
  }
});

test('UX: Eigenschaften überlagern kleine Fenster und bearbeiten lange Pfade vollständig im selben Block', async () => {
  const s = await starten();
  try {
    await oeffnen(s, '03-Lange-Texte-und-Pfade.scriptlab');
    const vorher = await s.seite.getByTestId('arbeitsbereich').boundingBox();
    await eigenschaftenOeffnen(s.seite, 'ui-lange-dateikopie');
    const panel = s.seite.getByTestId('eigenschaften-panel');
    expect((await s.seite.getByTestId('arbeitsbereich').boundingBox())!.width).toBeCloseTo(vorher!.width, 0);
    const quelle = await eigenschaftMitWert(s.seite, langerQuellpfad);
    await expect(quelle).toHaveValue(langerQuellpfad);
    const neu = `${langerQuellpfad.slice(0, -4)} - bewusst geändert.txt`;
    await quelle.fill(neu);
    await quelle.press('Tab');
    await expect
      .poll(
        async () =>
          alleBausteine(await projektLesen(s.seite)).find((b) => b.id === 'ui-lange-quelle')?.fields?.TEXT,
      )
      .toBe(neu);
    await expect(await eigenschaftMitWert(s.seite, langerZielpfad)).toHaveValue(langerZielpfad);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await screenshot(s.seite, 'eigenschaften-overlay-lange-pfade');
    await panel.getByRole('button', { name: /Eigenschaften schließen/ }).click();
    await expect(panel).not.toBeVisible();
    expect((await s.seite.getByTestId('arbeitsbereich').boundingBox())!.width).toBeCloseTo(vorher!.width, 0);
  } finally {
    await beenden(s);
  }
});

test('UX: großes Fenster behält die Breite angehefteter Eigenschaften beim Auswahlwechsel', async () => {
  const s = await starten(1, 1600, 1000);
  try {
    await oeffnen(s, '03-Lange-Texte-und-Pfade.scriptlab');
    await eigenschaftenOeffnen(s.seite, 'ui-lange-dateikopie');
    const panel = s.seite.getByTestId('eigenschaften-panel');
    const anheften = panel.getByRole('button', { name: /Eigenschaften anheften/ });
    if (await anheften.isVisible()) await anheften.click();
    const breite = (await panel.boundingBox())!.width;
    expect(breite).toBeGreaterThanOrEqual(300);
    expect(breite).toBeLessThanOrEqual(312);
    await s.seite.locator('g[data-id="ui-langer-kommentar"]').click({ position: { x: 56, y: 22 } });
    expect((await panel.boundingBox())!.width).toBeCloseTo(breite, 0);
    await screenshot(s.seite, 'eigenschaften-angeheftet-1600');
  } finally {
    await beenden(s);
  }
});

test('UX: ungültiger Entwurf bleibt speicherbar und Export führt zu konkreten Bausteinhinweisen', async () => {
  const s = await starten();
  try {
    await oeffnen(s, '04-Fehlende-Pflichtwerte.scriptlab');
    const datei = join(s.ordner, 'Unvollständig.scriptlab');
    await speicherziel(s, datei);
    await s.seite.getByRole('button', { name: 'Projektmenü', exact: true }).click();
    await s.seite.getByRole('menuitem', { name: 'Speichern unter', exact: true }).click();
    await expect
      .poll(async () =>
        stat(datei)
          .then(() => true)
          .catch(() => false),
      )
      .toBe(true);
    expect(JSON.parse(await readFile(datei, 'utf8')).name).toBe(
      uiTestprojekte['04-Fehlende-Pflichtwerte.scriptlab'].name,
    );
    const vbs = join(s.ordner, 'Darf nicht entstehen.vbs');
    await speicherziel(s, vbs);
    await s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
    await expect(s.seite.getByTestId('hinweise-panel')).toBeVisible();
    await expect(s.seite.getByTestId('hinweise-panel')).toContainText(/verbinde|Eingang|Ziel/i);
    await expect(stat(vbs)).rejects.toThrow();
    await screenshot(s.seite, 'fehler-am-baustein');
  } finally {
    await beenden(s);
  }
});

test('UX: normaler Radimpuls verschiebt den Canvas und Strg+Rad verändert nur seinen Zoom', async () => {
  const s = await starten();
  try {
    await oeffnen(s, '01-Alltagsworkflow.scriptlab');
    const vorher = (await projektLesen(s.seite)).ansicht;
    const canvas = (await s.seite.getByTestId('arbeitsbereich').boundingBox())!;
    await s.seite.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.7);
    await s.seite.mouse.wheel(0, 200);
    await expect.poll(async () => (await projektLesen(s.seite)).ansicht.y).not.toBe(vorher.y);
    expect((await projektLesen(s.seite)).ansicht.zoom).toBe(vorher.zoom);
    await s.seite.keyboard.down('Control');
    await s.seite.mouse.wheel(0, -120);
    await s.seite.keyboard.up('Control');
    await expect.poll(async () => (await projektLesen(s.seite)).ansicht.zoom).toBeGreaterThan(vorher.zoom);
    const zoom = (await projektLesen(s.seite)).ansicht.zoom;
    const palette = (await s.seite.getByTestId('palette').boundingBox())!;
    await s.seite.mouse.move(palette.x + 100, palette.y + palette.height * 0.8);
    await s.seite.mouse.wheel(0, 160);
    expect((await projektLesen(s.seite)).ansicht.zoom).toBe(zoom);
  } finally {
    await beenden(s);
  }
});

test('UX: UI-Textgröße ist vom Canvas-Zoom getrennt und behält Export und Panelinhalte erreichbar', async () => {
  const s = await starten();
  try {
    const zoom = (await projektLesen(s.seite)).ansicht.zoom;
    for (const groesse of ['100 %', '125 %', '150 %', '200 %']) {
      await einstellungenOeffnen(s.seite);
      await s.seite
        .getByRole('combobox', { name: 'UI-Textgröße', exact: true })
        .selectOption({ label: groesse });
      await s.seite.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
      await expect(s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true })).toBeVisible();
      const hauptaktion = await s.seite
        .getByRole('button', { name: 'Als VBS exportieren', exact: true })
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            links: rect.left,
            rechts: rect.right,
            oben: rect.top,
            unten: rect.bottom,
            breite: innerWidth,
            hoehe: innerHeight,
            inhalt: element.scrollWidth,
            platz: element.clientWidth,
          };
        });
      expect(hauptaktion.links).toBeGreaterThanOrEqual(0);
      expect(hauptaktion.rechts).toBeLessThanOrEqual(hauptaktion.breite);
      expect(hauptaktion.oben).toBeGreaterThanOrEqual(0);
      expect(hauptaktion.unten).toBeLessThanOrEqual(hauptaktion.hoehe);
      expect(hauptaktion.inhalt).toBeLessThanOrEqual(hauptaktion.platz);
      expect(
        await s.seite.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      expect((await projektLesen(s.seite)).ansicht.zoom).toBe(zoom);
      await screenshot(s.seite, `ui-text-${groesse.replace(' %', '')}`);
    }
  } finally {
    await beenden(s);
  }
});

test('UX: verschachtelter Ablauf zeigt 28-Block-Ansicht und optionale schreibgeschützte Codevorschau', async () => {
  const s = await starten(1, 1600, 1000);
  try {
    await oeffnen(s, '01-Alltagsworkflow.scriptlab');
    await s.seite.getByRole('button', { name: 'Alles anzeigen', exact: true }).click();
    expect(alleBausteine(await projektLesen(s.seite))).toHaveLength(28);
    await screenshot(s.seite, 'workflow-28-bausteine');
    await oeffnen(s, '02-Verschachtelte-Ablaeufe.scriptlab');
    await s.seite.getByRole('button', { name: 'Alles anzeigen', exact: true }).click();
    await s.seite.getByRole('button', { name: 'Codevorschau', exact: true }).click();
    const code = s.seite.getByTestId('code-panel');
    await expect(code).toBeVisible();
    expect(await code.locator('pre').getAttribute('contenteditable')).not.toBe('true');
    await expect(code).toContainText('If ');
    await expect(code).toContainText('For ');
    await screenshot(s.seite, 'verschachtelt-mit-code');
  } finally {
    await beenden(s);
  }
});

test('UX: vollständiger Aufgabenweg mit einzelnen Klicks, Umordnen, Rückgängig und echtem Dateiexport', async () => {
  const s = await starten();
  try {
    const suche = s.seite.getByRole('searchbox', { name: 'Bausteine suchen', exact: true });
    await suche.fill('Nachricht');
    await s.seite.getByRole('button', { name: /^Baustein einfügen:.*Nachricht/i }).click();
    await s.seite.getByRole('button', { name: /Nach.*Workflow starten/i }).click();
    await expect
      .poll(
        async () => alleBausteine(await projektLesen(s.seite)).filter((b) => b.type === 'sl_message').length,
      )
      .toBe(1);
    const nachricht = alleBausteine(await projektLesen(s.seite)).find((b) => b.type === 'sl_message')!;
    await eigenschaftenOeffnen(s.seite, nachricht.id);
    const textfeld = await eigenschaftMitWert(s.seite, 'Hallo');
    await textfeld.fill('Hallo aus der eigenen Klickprüfung.');
    await textfeld.press('Tab');
    await expect
      .poll(async () =>
        alleBausteine(await projektLesen(s.seite)).some(
          (b) => b.fields?.TEXT === 'Hallo aus der eigenen Klickprüfung.',
        ),
      )
      .toBe(true);
    await suche.fill('Kommentar');
    await s.seite.getByRole('button', { name: /^Baustein einfügen:.*Kommentar/i }).click();
    await s.seite.getByRole('button', { name: /Nach.*Nachricht/i }).click();
    await expect
      .poll(
        async () => alleBausteine(await projektLesen(s.seite)).filter((b) => b.type === 'sl_comment').length,
      )
      .toBe(1);
    const kommentar = alleBausteine(await projektLesen(s.seite)).find((b) => b.type === 'sl_comment')!;
    await eigenschaftenOeffnen(s.seite, kommentar.id);
    await s.seite.getByRole('button', { name: /^(Baustein )?Verschieben$/i }).click();
    await s.seite.getByRole('button', { name: /Nach.*Workflow starten/i }).click();
    await expect
      .poll(async () => {
        const p = await projektLesen(s.seite);
        const zuerst = p.editor.blocks!.blocks.find((b) => b.type === 'sl_start')!.next!.block;
        return [zuerst.id, zuerst.next?.block.id];
      })
      .toEqual([kommentar.id, nachricht.id]);
    await s.seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect
      .poll(async () => {
        const p = await projektLesen(s.seite);
        return p.editor.blocks!.blocks.find((b) => b.type === 'sl_start')!.next!.block.id;
      })
      .toBe(nachricht.id);
    await s.seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
    const projektdatei = join(s.ordner, 'Eigene Klickprüfung.scriptlab');
    await speicherziel(s, projektdatei);
    await s.seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect
      .poll(async () =>
        stat(projektdatei)
          .then(() => true)
          .catch(() => false),
      )
      .toBe(true);
    const gespeichert = JSON.parse(await readFile(projektdatei, 'utf8')) as Projekt;
    expect(gespeichert.editor.blocks!.blocks.find((b) => b.type === 'sl_start')!.next!.block.id).toBe(
      kommentar.id,
    );
    await s.app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    }, projektdatei);
    await s.seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await expect
      .poll(async () =>
        alleBausteine(await projektLesen(s.seite)).some(
          (b) => b.fields?.TEXT === 'Hallo aus der eigenen Klickprüfung.',
        ),
      )
      .toBe(true);
    const exportdatei = join(s.ordner, 'Eigene Klickprüfung.vbs');
    await speicherziel(s, exportdatei);
    await s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
    await expect(s.seite.getByTestId('statusleiste')).toContainText('Script');
    const bytes = await readFile(exportdatei);
    expect([...bytes.subarray(0, 2)]).toEqual([255, 254]);
    expect(bytes.subarray(2).toString('utf16le')).toContain('Hallo aus der eigenen Klickprüfung.');
    await screenshot(s.seite, 'klickweg-speichern-oeffnen-export');
  } finally {
    await beenden(s);
  }
});

test('UX: fehlende gewünschte Signaturkonfiguration verhindert eine falsche Erfolgsanzeige', async () => {
  const s = await starten();
  try {
    await oeffnen(s, '05-Signatur-ohne-Zertifikat.scriptlab');
    const exportdatei = join(s.ordner, 'Nicht signiert freigegeben.vbs');
    await speicherziel(s, exportdatei);
    await s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
    await expect(s.seite.getByTestId('statusleiste')).toContainText(/Zertifikat|Signatur/);
    await expect(s.seite.getByTestId('statusleiste')).not.toContainText('Signatur gültig');
    await expect(stat(exportdatei)).rejects.toThrow();
    await screenshot(s.seite, 'signatur-nicht-eingerichtet');
  } finally {
    await beenden(s);
  }
});

test('UX: Signatur-Erfolgsdarstellung aus ausdrücklich gesteuerter Testantwort', async () => {
  const s = await starten();
  try {
    await oeffnen(s, '01-Alltagsworkflow.scriptlab');
    await s.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('scriptlab:exportieren');
      ipcMain.handle('scriptlab:exportieren', () => ({
        ok: true,
        wert: {
          dateiname: 'Gesteuerte Testantwort.vbs',
          signatur: { status: 'gueltig', meldung: 'Signatur gültig', zeitstempel: true },
        },
      }));
    });
    await s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).click();
    await expect(s.seite.getByRole('status', { name: 'Export abgeschlossen', exact: true })).toContainText(
      'Signatur gültig',
    );
    await expect(
      s.seite.getByRole('status', { name: 'Export abgeschlossen', exact: true }),
    ).not.toContainText('Sicher');
    await screenshot(s.seite, 'testantwort-signatur-gueltig');
    test.info().annotations.push({
      type: 'Testgrenze',
      description:
        'Nur UI-Darstellung einer gesteuerten IPC-Testantwort, keine echte Signatur oder Exportdatei dieses Tests.',
    });
  } finally {
    await beenden(s);
  }
});

for (const zustand of ['verfuegbar', 'laedt', 'fehler'] as const) {
  test(`UX: Updatezustand ${zustand} aus ausdrücklich gesteuerter Testantwort`, async () => {
    const s = await starten();
    try {
      await s.app.evaluate(({ ipcMain }, phase) => {
        ipcMain.removeHandler('scriptlab:update');
        ipcMain.handle('scriptlab:update', () => ({
          ok: true,
          wert: {
            phase,
            installierteVersion: '0.1.0',
            verfuegbareVersion: '0.2.0',
            fortschritt: phase === 'laedt' ? 43 : 0,
            aenderungen: 'Ausdrücklich gesteuerte UI-Testdaten: verständliche Änderungsübersicht.',
            meldung:
              phase === 'verfuegbar'
                ? 'Version 0.2.0 ist verfügbar.'
                : phase === 'laedt'
                  ? 'Das Update wird heruntergeladen und geprüft.'
                  : 'Der Test-Download konnte nicht abgeschlossen werden.',
          },
        }));
      }, zustand);
      await einstellungenOeffnen(s.seite);
      const dialog = s.seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
      await expect(dialog).toContainText(
        zustand === 'verfuegbar'
          ? 'verfügbar'
          : zustand === 'laedt'
            ? 'heruntergeladen'
            : 'nicht abgeschlossen',
      );
      if (zustand === 'laedt') await expect(dialog.getByRole('progressbar')).toHaveAttribute('value', '43');
      await dialog
        .locator('.einstellungs-abschnitt')
        .filter({ has: s.seite.getByRole('heading', { name: 'Anwendungsupdates', exact: true }) })
        .scrollIntoViewIfNeeded();
      await screenshot(s.seite, `testantwort-update-${zustand}`);
      test.info().annotations.push({
        type: 'Testgrenze',
        description:
          'Nur UI-Darstellung einer gesteuerten IPC-Testantwort. Kein Update heruntergeladen oder installiert, Prozentwert ist Testdatum.',
      });
    } finally {
      await beenden(s);
    }
  });
}

test('UX: tatsächliche SVG-Textflächen, Auswahl und eigener Eingabefokus bleiben unterscheidbar', async () => {
  const s = await starten(1, 1600, 1000);
  try {
    await oeffnen(s, '01-Alltagsworkflow.scriptlab');
    const proben = await s.seite.locator('.blocklyBlockCanvas .blocklyText').evaluateAll((texte) =>
      texte
        .map((element) => {
          const block = element.closest('g[data-id]');
          const grund = block?.querySelector(':scope > .blocklyPath:not(.blocklyPathSelected)');
          const feld = element.closest('.blocklyEditableText');
          const feldflaeche = feld?.querySelector('.blocklyFieldRect, rect');
          if (!grund || !(element.textContent ?? '').trim()) return null;
          const textstil = getComputedStyle(element);
          const hintergrund = getComputedStyle(feldflaeche ?? grund);
          return {
            text: element.textContent!.slice(0, 70),
            vordergrund: textstil.fill,
            hintergrund: hintergrund.fill,
            grund: getComputedStyle(grund).fill,
            deckkraft: Number(hintergrund.fillOpacity),
            schrift: Number.parseFloat(textstil.fontSize),
            textDeckkraft: Number(textstil.fillOpacity),
          };
        })
        .filter((p) => p !== null),
    );
    const rgb = (farbe: string) => {
      const werte = farbe.match(/[\d.]+/g)?.map(Number);
      if (!werte || werte.length < 3)
        throw new Error(`Die tatsächliche SVG-Farbe ist nicht auswertbar: ${farbe}`);
      return werte.slice(0, 3);
    };
    const luminanz = (farbe: number[]) =>
      farbe
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((summe, v, i) => summe + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ausgewertet = proben.map((p) => {
      const grund = rgb(p.grund);
      const bg = rgb(p.hintergrund).map((v, i) => v * p.deckkraft + grund[i] * (1 - p.deckkraft));
      const fg = rgb(p.vordergrund);
      const a = luminanz(fg),
        b = luminanz(bg);
      return { ...p, kontrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
    expect(ausgewertet.length).toBeGreaterThan(20);
    for (const p of ausgewertet) {
      expect(p.kontrast, p.text).toBeGreaterThanOrEqual(4.5);
      expect(p.schrift, p.text).toBeGreaterThanOrEqual(13.5);
      expect(p.textDeckkraft, p.text).toBe(1);
    }
    await writeFile('artifacts/ui/svg-kontraste.json', JSON.stringify(ausgewertet, null, 2));
    await s.seite.bringToFront();
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await s.seite.locator('g[data-id="ui-name-setzen"]').click({ position: { x: 56, y: 22 } });
    // W fokussiert den Arbeitsbereich; Pfeil runter betritt seine erste Bausteinfolge.
    // Die tatsächliche Blockly-Kontur wird geprüft, nicht nur der Theme-Konfigurationswert.
    await s.seite.keyboard.press('w');
    await s.seite.keyboard.press('ArrowDown');
    const navigationsfokus = s.seite.locator(
      '.blockly-editor .blocklyPath.blocklyActiveFocus:not(.blocklyPathSelected)',
    );
    await expect(navigationsfokus).toHaveCount(1);
    await expect(navigationsfokus).toBeVisible();
    const navigationsstil = await navigationsfokus.evaluate((element) => {
      const stil = getComputedStyle(element);
      return {
        aktiveTastatur: Boolean(element.closest('.blocklyKeyboardNavigation')),
        knotenfarbe: stil.getPropertyValue('--blockly-active-node-color').trim(),
        baumfarbe: stil.getPropertyValue('--blockly-active-tree-color').trim(),
        konturbreite: stil.getPropertyValue('--blockly-selection-width').trim(),
        kontur: stil.stroke,
        tatsaechlicheBreite: stil.strokeWidth,
      };
    });
    const fokusRgb = `rgb(${[1, 3, 5].map((i) => Number.parseInt(farben.canvasFokus.slice(i, i + 2), 16)).join(', ')})`;
    expect(navigationsstil.aktiveTastatur).toBe(true);
    expect(navigationsstil.knotenfarbe.toUpperCase()).toBe(farben.canvasFokus);
    expect(navigationsstil.baumfarbe.toUpperCase()).toBe(farben.akzent);
    expect(navigationsstil.konturbreite).toBe(`${masse.fokusKontur}px`);
    expect(navigationsstil.kontur).toBe(fokusRgb);
    expect(navigationsstil.tatsaechlicheBreite).toBe(`${masse.fokusKontur}px`);
    await s.seite.locator('g[data-id="ui-name-setzen"]').click({ position: { x: 56, y: 22 } });
    await s.seite.keyboard.press('ArrowRight');
    const feldfokus = s.seite.locator('.blockly-editor .blocklyField.blocklyActiveFocus');
    await expect(feldfokus).toHaveCount(1);
    await expect(feldfokus).toBeFocused();
    const feldstil = await feldfokus.locator('.blocklyFieldRect').evaluate((element) => ({
      kontur: getComputedStyle(element).stroke,
      breite: getComputedStyle(element).strokeWidth,
    }));
    await s.seite.keyboard.press('Enter');
    const blockEingabe = s.seite.locator('.blocklyHtmlInput');
    await expect(blockEingabe).toBeVisible();
    await expect(blockEingabe).toHaveValue('Name');
    await blockEingabe.fill('Name per Tastatur');
    await blockEingabe.press('Enter');
    await expect
      .poll(
        async () =>
          alleBausteine(await projektLesen(s.seite)).find((b) => b.id === 'ui-name-setzen')?.fields?.VAR,
      )
      .toBe('Name per Tastatur');
    await s.seite.keyboard.press('Control+z');
    await expect
      .poll(
        async () =>
          alleBausteine(await projektLesen(s.seite)).find((b) => b.id === 'ui-name-setzen')?.fields?.VAR,
      )
      .toBe('Name');
    await writeFile(
      'artifacts/ui/navigationsfokus.json',
      JSON.stringify({ block: navigationsstil, feld: feldstil }, null, 2),
    );
    expect(feldstil.kontur).toBe(fokusRgb);
    expect(feldstil.breite).toBe(`${masse.fokusKontur}px`);
    await eigenschaftenOeffnen(s.seite, 'ui-name-setzen');
    const feld = await eigenschaftMitWert(s.seite, 'Name');
    await s.seite.bringToFront();
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await expect.poll(() => s.seite.evaluate(() => document.hasFocus())).toBe(true);
    await feld.focus();
    await expect(s.seite.locator('g[data-id="ui-name-setzen"]')).toHaveClass(/scriptlabAuswahl/);
    await expect(feld).toBeFocused();
    expect(await feld.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await screenshot(s.seite, 'auswahl-und-feldfokus');
  } finally {
    await beenden(s);
  }
});

test('UX: prozessweise simulierte Kontrastfarben und reduzierte Bewegung behalten die Bedienung', async () => {
  const s = await starten();
  try {
    await s.seite.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    expect(await s.seite.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    expect(await s.seite.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await s.seite.getByRole('button', { name: 'Als VBS exportieren', exact: true }).focus();
    const stil = await s.seite
      .getByRole('button', { name: 'Als VBS exportieren', exact: true })
      .evaluate((el) => ({
        transition: getComputedStyle(el).transitionDuration,
        outline: getComputedStyle(el).outlineStyle,
        hintergrund: getComputedStyle(el).backgroundColor,
        text: getComputedStyle(el).color,
        kindText: getComputedStyle(el.querySelector('span')!).color,
        kindHintergrund: getComputedStyle(el.querySelector('span')!).backgroundColor,
        kindAnpassung: getComputedStyle(el.querySelector('span')!).forcedColorAdjust,
      }));
    expect(stil.transition.split(',').every((wert) => Number.parseFloat(wert) === 0)).toBe(true);
    expect(stil.outline).not.toBe('none');
    expect(stil.hintergrund).not.toBe(stil.text);
    expect(stil.kindText).toBe(stil.text);
    expect(stil.kindHintergrund).toBe('rgba(0, 0, 0, 0)');
    expect(stil.kindAnpassung).toBe('none');
    await screenshot(s.seite, 'simulierte-kontrastfarben-reduzierte-bewegung');
    test.info().annotations.push({
      type: 'Testgrenze',
      description:
        'Chromium-Medienzustände pro Prozess emuliert. Kein echter Windows-Kontrastmodus oder systemweiter Reduced-Motion-Schalter umgestellt.',
    });
  } finally {
    await beenden(s);
  }
});
