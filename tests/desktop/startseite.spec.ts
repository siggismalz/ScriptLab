import { sprachwahlBestaetigen } from './sprache';
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, rm, readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Dokument, ProjektBibliothek } from '../../src/gemeinsam/bruecke';
import { neuesProjekt, projektPruefen, type Projekt } from '../../src/kern/projekt';
import { beispiele, hilfeArtikel } from '../../src/renderer/hilfe';

interface Sitzung {
  app: ElectronApplication;
  seite: Page;
  ordner: string;
  profil: string;
}
type DialogTestdaten = typeof globalThis & {
  startseiteSpeicherGefragt?: boolean;
  startseiteNachrichtGefragt?: boolean;
};

async function starten(ordner?: string, dpi?: number): Promise<Sitzung> {
  const basis = ordner ?? (await mkdtemp(join(tmpdir(), 'ScriptLab-Startseite-')));
  const profil = join(basis, 'Profil');
  const app = await electron.launch({
    args: [resolve('.'), ...(dpi === undefined ? [] : [`--force-device-scale-factor=${dpi}`])],
    cwd: basis,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  const seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
  return { app, seite, ordner: basis, profil };
}

async function beenden(s: Sitzung): Promise<void> {
  await s.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  const ziel = resolve(s.ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Startseite-'))
    throw new Error('Unsicherer temporärer Testpfad.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function dokumentLesen(s: Sitzung): Promise<Dokument> {
  return s.seite.evaluate(async () => {
    const ergebnis = await window.scriptlab.laden();
    if (!ergebnis.ok) throw new Error(ergebnis.meldung);
    return ergebnis.wert.dokument;
  });
}

async function bibliothekLesen(s: Sitzung): Promise<ProjektBibliothek> {
  return s.seite.evaluate(async () => {
    const ergebnis = await window.scriptlab.bibliothekLesen();
    if (!ergebnis.ok) throw new Error(ergebnis.meldung);
    return ergebnis.wert;
  });
}

async function zurStartseite(s: Sitzung): Promise<void> {
  if (await s.seite.getByTestId('palette').isVisible()) await editorBereit(s);
  await s.seite.getByRole('button', { name: 'Startseite', exact: true }).filter({ visible: true }).click();
  await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
}

async function neuerAblauf(s: Sitzung, name?: string): Promise<void> {
  await s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await sprachwahlBestaetigen(s.seite);
  await editorBereit(s);
  if (name) await projektBenennen(s, name);
}

async function projektBenennen(s: Sitzung, name: string): Promise<void> {
  await editorBereit(s);
  await s.seite.getByRole('button', { name: 'Projektmenü', exact: true }).click();
  await s.seite.getByRole('menuitem', { name: 'Projektangaben', exact: true }).click();
  const dialog = s.seite.getByRole('dialog', { name: 'Projektangaben', exact: true });
  await dialog.getByRole('textbox', { name: 'Projektname', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect.poll(async () => (await dokumentLesen(s)).projekt.name).toBe(name);
}

async function dialogAntwort(s: Sitzung, response: number): Promise<void> {
  await s.app.evaluate(({ dialog }, antwort) => {
    const daten = globalThis as DialogTestdaten;
    daten.startseiteNachrichtGefragt = false;
    dialog.showMessageBox = async () => {
      daten.startseiteNachrichtGefragt = true;
      return { response: antwort, checkboxChecked: false };
    };
  }, response);
}

async function speicherziel(s: Sitzung, pfad: string | null): Promise<void> {
  await s.app.evaluate(({ dialog }, ziel) => {
    const daten = globalThis as DialogTestdaten;
    daten.startseiteSpeicherGefragt = false;
    dialog.showSaveDialog = async () => {
      daten.startseiteSpeicherGefragt = true;
      return { canceled: ziel === null, filePath: ziel ?? '' };
    };
  }, pfad);
}
async function nativenDialogAbwarten(s: Sitzung, art: 'speichern' | 'nachricht'): Promise<void> {
  // Erst auf den wirklich angefragten Dialog warten. Sichtbare Zeilen/gleiche Projektnamen
  // sind während Flush und Dialogvorbereitung bereits vorhanden und kein Abschlussnachweis.
  await expect
    .poll(() =>
      s.app.evaluate((_electron, auswahl) => {
        const daten = globalThis as DialogTestdaten;
        return auswahl === 'speichern' ? daten.startseiteSpeicherGefragt : daten.startseiteNachrichtGefragt;
      }, art),
    )
    .toBe(true);
  await expect(s.seite.locator('#start-verarbeitung')).toHaveCount(0);
  await s.seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  await expect(s.seite.locator('#start-verarbeitung')).toHaveCount(0);
}

async function dateiOeffnen(s: Sitzung, pfad: string, editorErwartet = true): Promise<void> {
  await s.app.evaluate(({ dialog }, ziel) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ziel] });
  }, pfad);
  await s.seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  if (editorErwartet) await editorBereit(s);
}

async function editorBereit(s: Sitzung): Promise<void> {
  await expect(s.seite.getByTestId('palette')).toBeVisible();
  await expect(s.seite.getByRole('button', { name: 'Neu', exact: true })).toBeEnabled();
  await expect.poll(async () => (await dokumentLesen(s)).darstellungNoetig).toBe(false);
  await s.seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
}

async function projektSpeichern(s: Sitzung, pfad: string): Promise<Buffer> {
  await speicherziel(s, pfad);
  await s.seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(s.seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  await expect
    .poll(async () =>
      stat(pfad)
        .then(() => true)
        .catch(() => false),
    )
    .toBe(true);
  return readFile(pfad);
}

async function entwurfAbwarten(s: Sitzung): Promise<string> {
  await expect
    .poll(async () => (await dokumentLesen(s)).entwurfStatus.phase, { timeout: 8000 })
    .toBe('gesichert');
  const dokument = await dokumentLesen(s);
  const id = dokument.entwurfStatus.id;
  if (!id) throw new Error('Der gesicherte Entwurf hat keine Kennung.');
  await expect
    .poll(async () => (await bibliothekLesen(s)).entwuerfe.find((e) => e.id === id)?.projektKennung)
    .toBe(dokument.projektKennung);
  return id;
}

async function neustarten(s: Sitzung, absturz = false): Promise<void> {
  if (absturz) {
    const prozess = s.app.process();
    const beendet = once(prozess, 'exit');
    // Playwrights Windows-Launcher und der Electron-Hauptprozess können verschiedene PIDs haben.
    // Nur der bekannte Prozessbaum dieser isolierten Sitzung wird ohne Beenden-Handler abgebrochen.
    await new Promise<void>((fertig, ablehnen) => {
      execFile('taskkill.exe', ['/PID', String(prozess.pid), '/T', '/F'], { windowsHide: true }, (fehler) => {
        if (fehler) ablehnen(fehler);
        else fertig();
      });
    });
    await beendet;
  } else await s.app.evaluate(({ app }) => app.exit(0));
  const neu = await starten(s.ordner);
  Object.assign(s, neu);
}

async function bild(s: Sitzung, name: string): Promise<void> {
  await mkdir('artifacts/startseite', { recursive: true });
  await s.seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  await s.seite.screenshot({ path: `artifacts/startseite/${name}.png` });
}

async function eigeneProjekte(s: Sitzung) {
  await s.seite.getByRole('button', { name: 'Meine gespeicherten Workflows', exact: true }).click();
  return s.seite.getByTestId('bekannte-projekte');
}

test('Startseite: neuer Ablauf und Weiterbearbeiten erhalten Kennung, Auswahl und Ansicht', async () => {
  const s = await starten();
  try {
    await s.app.evaluate(({ dialog }) => {
      const testdaten = globalThis as typeof globalThis & { startseiteVerlustdialoge?: number };
      testdaten.startseiteVerlustdialoge = 0;
      dialog.showMessageBox = async () => {
        testdaten.startseiteVerlustdialoge!++;
        return { response: 3, checkboxChecked: false };
      };
    });
    await s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
    await sprachwahlBestaetigen(s.seite);
    await editorBereit(s);
    const startansicht = await s.seite.getByTestId('arbeitsbereich').evaluate((element) => {
      const block = element.querySelector('g[data-id="start"]');
      const b = block?.getBoundingClientRect(),
        c = element.getBoundingClientRect();
      return {
        canvas: { x: c.x, y: c.y, breite: c.width, hoehe: c.height },
        start: b ? { x: b.x, y: b.y, breite: b.width, hoehe: b.height } : null,
        blockTransform: block?.getAttribute('transform'),
        canvasTransform: element.querySelector('.blocklyBlockCanvas')?.getAttribute('transform'),
        raster: [...element.querySelectorAll('pattern')].map((raster) => ({
          x: raster.getAttribute('x'),
          y: raster.getAttribute('y'),
          breite: raster.getAttribute('width'),
          hoehe: raster.getAttribute('height'),
        })),
        renderer: { breite: innerWidth, hoehe: innerHeight, devicePixelRatio },
      };
    });
    await mkdir('artifacts/startseite', { recursive: true });
    const anfangsprojekt = (await dokumentLesen(s)).projekt;
    await writeFile(
      'artifacts/startseite/neuer-editor-geometrie.json',
      JSON.stringify({ ...startansicht, projekt: anfangsprojekt }, null, 2),
    );
    await bild(s, 'neuer-editor-stabil');
    expect(anfangsprojekt.ansicht).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(startansicht.start).not.toBeNull();
    expect(startansicht.start!.x - startansicht.canvas.x).toBeCloseTo(80, 0);
    expect(startansicht.start!.y - startansicht.canvas.y).toBeCloseTo(96, 0);
    const palette = s.seite.getByTestId('palette');
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('searchbox', { name: 'Bausteine suchen', exact: true })).toBeFocused();
    await palette.getByRole('searchbox', { name: 'Bausteine suchen', exact: true }).fill('Nachricht');
    await palette.getByRole('button', { name: 'Baustein einfügen: Nachricht anzeigen', exact: true }).click();
    await palette.getByRole('button', { name: 'Nach „Workflow starten“', exact: true }).click();
    await expect
      .poll(async () => (await dokumentLesen(s)).projekt.editor.blocks?.blocks[0].next?.block.type)
      .toBe('sl_message');
    const id = (await dokumentLesen(s)).projekt.editor.blocks!.blocks[0].next!.block.id;
    await s.seite.locator(`g[data-id="${id}"]`).click({ position: { x: 56, y: 18 } });
    await s.seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    await expect.poll(async () => (await dokumentLesen(s)).projekt.ansicht.zoom).toBeGreaterThan(1);
    const vorher = await dokumentLesen(s);
    await expect(s.seite.locator(`g[data-id="${id}"]`)).toHaveClass(/scriptlabAuswahl/);
    await s.seite.getByRole('button', { name: 'Startseite', exact: true }).click();
    await expect(s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true })).toBeVisible();
    await expect(palette).not.toBeVisible();
    await s.seite.getByRole('button', { name: /^Weiterbearbeiten/ }).click();
    await expect(palette).toBeVisible();
    const danach = await dokumentLesen(s);
    expect(typeof vorher.projekt.projektKennung).toBe('string');
    expect(danach.projekt.projektKennung).toBe(vorher.projekt.projektKennung);
    expect(danach.projekt.editor).toEqual(vorher.projekt.editor);
    expect(danach.projekt.ansicht).toEqual(vorher.projekt.ansicht);
    await expect(s.seite.locator(`g[data-id="${id}"]`)).toHaveClass(/scriptlabAuswahl/);
    expect(
      await s.app.evaluate(
        () =>
          (globalThis as typeof globalThis & { startseiteVerlustdialoge?: number }).startseiteVerlustdialoge,
      ),
    ).toBe(0);
  } finally {
    await beenden(s);
  }
});

test('Startseite: Erststart zeigt vier Bereiche ohne erfundene eigene Projekte', async () => {
  const s = await starten();
  try {
    const karten = s.seite.getByTestId('start-karten');
    await expect(karten.getByRole('button')).toHaveCount(4);
    await expect(
      karten.getByRole('button', { name: 'Meine gespeicherten Workflows', exact: true }),
    ).toContainText('0 Projekte bekannt');
    await expect(karten.getByRole('button', { name: 'Entwürfe', exact: true })).toContainText(
      '0 Entwürfe gesichert',
    );
    await expect(s.seite.getByRole('button', { name: /^Weiterbearbeiten/ })).toHaveCount(0);
    expect((await bibliothekLesen(s)).projekte).toEqual([]);
    expect((await bibliothekLesen(s)).entwuerfe).toEqual([]);
    await expect(s.seite.getByTestId('palette')).not.toBeVisible();
    await bild(s, 'erststart');
    const liste = await eigeneProjekte(s);
    await expect(liste.getByRole('article')).toHaveCount(0);
    await expect(liste).toContainText('Noch keine Projektdateien bekannt');
  } finally {
    await beenden(s);
  }
});

test('Startseite: gespeicherter Index und echte zuletzt geöffnete Projekte bleiben nach Neustart erhalten', async () => {
  const s = await starten();
  try {
    const zulu = join(s.ordner, 'Zulu.scriptlab');
    await neuerAblauf(s, 'Zulu Testworkflow');
    await projektSpeichern(s, zulu);
    await zurStartseite(s);
    await dateiOeffnen(s, zulu);
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    await zurStartseite(s);
    await dateiOeffnen(s, zulu.toUpperCase());
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    expect((await bibliothekLesen(s)).projekte).toHaveLength(1);
    const alpha = { ...neuesProjekt(), name: 'Alpha Testworkflow' };
    const alphaDatei = join(s.ordner, 'Alpha.scriptlab');
    await writeFile(alphaDatei, JSON.stringify(alpha), 'utf8');
    await zurStartseite(s);
    await dateiOeffnen(s, alphaDatei);
    await expect.poll(async () => (await dokumentLesen(s)).projekt.name).toBe(alpha.name);
    await zurStartseite(s);
    await expect(s.seite.getByTestId('zuletzt-geoeffnet').getByRole('article')).toHaveCount(2);
    const liste = await eigeneProjekte(s);
    await expect(liste.getByRole('article')).toHaveCount(2);
    await liste.getByRole('combobox', { name: 'Projekte sortieren', exact: true }).selectOption('name');
    await expect(liste.getByRole('article').first().getByRole('heading', { level: 3 })).toHaveText(
      'Alpha Testworkflow',
    );
    const suche = liste.getByRole('searchbox', { name: 'Projekte suchen', exact: true });
    await suche.fill('Zulu');
    await expect(liste.getByRole('article')).toHaveCount(1);
    await suche.fill('Dieser Name existiert nicht');
    await expect(liste).toContainText(
      'Keine passenden Projekte gefunden. Ändere die Suche oder den Sprachfilter.',
    );
    await liste.getByRole('button', { name: 'Suche leeren', exact: true }).click();
    await expect(liste.getByRole('article')).toHaveCount(2);
    await neustarten(s);
    expect((await bibliothekLesen(s)).projekte).toHaveLength(2);
    await expect(s.seite.getByTestId('zuletzt-geoeffnet').getByRole('article')).toHaveCount(2);
    await bild(s, 'zuletzt-geoeffnet');
  } finally {
    await beenden(s);
  }
});

test('Startseite: fehlende Datei wird neu zugeordnet und ein kaputtes Projekt ersetzt keinen Arbeitsstand', async () => {
  const s = await starten();
  try {
    const alt = join(s.ordner, 'Original.scriptlab');
    const neu = join(s.ordner, 'Verschoben.scriptlab');
    await neuerAblauf(s, 'Zuordnungstest');
    await projektSpeichern(s, alt);
    const id = (await dokumentLesen(s)).projektKennung;
    await rename(alt, neu);
    await zurStartseite(s);
    const liste = await eigeneProjekte(s);
    const zeile = liste.getByRole('article', { name: /^Zuordnungstest/ });
    await expect(zeile).toContainText('Datei nicht gefunden');
    await expect(zeile.getByRole('button', { name: 'Öffnen', exact: true })).toBeDisabled();
    await s.app.evaluate(({ dialog }, pfad) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    }, neu);
    await zeile.getByRole('button', { name: 'Neu zuordnen', exact: true }).click();
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    expect((await dokumentLesen(s)).projektKennung).toBe(id);
    expect((await bibliothekLesen(s)).projekte.map((p) => p.pfad)).toEqual([neu]);
    const kaputt = join(s.ordner, 'Kaputt.scriptlab');
    await writeFile(kaputt, '{absichtlich unvollständig', 'utf8');
    const vorher = await dokumentLesen(s);
    await zurStartseite(s);
    await dateiOeffnen(s, kaputt, false);
    await expect(s.seite.getByRole('alert').filter({ visible: true })).toContainText(/Projekt|Datei/);
    expect((await dokumentLesen(s)).projekt).toEqual(vorher.projekt);
    expect(await readFile(kaputt, 'utf8')).toBe('{absichtlich unvollständig');
    await bild(s, 'fehlerhafte-projektdatei');
    await s.seite.getByRole('button', { name: 'Meldung schließen', exact: true }).click();
    await expect(s.seite.getByRole('alert').filter({ visible: true })).toHaveCount(0);
    expect((await dokumentLesen(s)).projekt).toEqual(vorher.projekt);
  } finally {
    await beenden(s);
  }
});

test('Startseite: verzögerter Entwurf überlebt einen echten Prozessabbruch und schreibt nie die Ausgangsdatei', async () => {
  const s = await starten();
  try {
    const originalDatei = join(s.ordner, 'Ausgangsprojekt.scriptlab');
    await neuerAblauf(s, 'Gespeicherter Ausgangsstand');
    const original = await projektSpeichern(s, originalDatei);
    await projektBenennen(s, 'Nicht gespeicherte Wiederherstellung');
    const id = await entwurfAbwarten(s);
    const vorher = (await dokumentLesen(s)).projekt;
    expect(await readFile(originalDatei)).toEqual(original);
    await neustarten(s, true);
    await expect(s.seite.getByTestId('entwuerfe-hinweis')).toContainText('bewusst fortzusetzen');
    expect((await dokumentLesen(s)).projektKennung).not.toBe(vorher.projektKennung);
    await expect(s.seite.getByRole('button', { name: /^Weiterbearbeiten/ })).toHaveCount(0);
    await s.seite.getByRole('button', { name: 'Entwürfe anzeigen', exact: true }).click();
    const zeile = s.seite.getByTestId('entwuerfe').getByRole('article', { name: vorher.name, exact: true });
    await expect(zeile).toContainText('Gesicherte Änderungen zu einer Projektdatei');
    await zeile.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
    await editorBereit(s);
    const danach = await dokumentLesen(s);
    expect(danach.projektKennung).toBe(vorher.projektKennung);
    expect(danach.entwurfStatus.id).toBe(id);
    expect(danach.projekt).toEqual(vorher);
    expect(danach.geaendert).toBe(true);
    expect(await readFile(originalDatei)).toEqual(original);
    await bild(s, 'entwurf-bewusst-fortgesetzt');
  } finally {
    await beenden(s);
  }
});

for (const zustand of ['ausstehend', 'gesichert'] as const) {
  test(`Startseite: Änderungen verwerfen bereinigt einen ${zustand}en Entwurf auch nach Timer und Neustart`, async () => {
    const s = await starten();
    try {
      await neuerAblauf(s, 'Ausdrücklich verworfener Teststand');
      const alteId = (await dokumentLesen(s)).projektKennung;
      if (zustand === 'gesichert') await entwurfAbwarten(s);
      else await expect.poll(async () => (await dokumentLesen(s)).entwurfStatus.phase).toBe('ausstehend');
      await dialogAntwort(s, 2);
      await s.seite.getByRole('button', { name: 'Neu', exact: true }).click();
      await sprachwahlBestaetigen(s.seite);
      await expect.poll(async () => (await dokumentLesen(s)).projektKennung).not.toBe(alteId);
      // Negativer Timer-Nachweis: bewusst länger als die 1200-ms-Entwurfssicherung warten.
      await s.seite.waitForTimeout(1600);
      expect((await bibliothekLesen(s)).entwuerfe).toEqual([]);
      await neustarten(s, true);
      expect((await bibliothekLesen(s)).entwuerfe).toEqual([]);
      await expect(s.seite.getByTestId('entwuerfe-hinweis')).toHaveCount(0);
    } finally {
      await beenden(s);
    }
  });
}

test('Startseite: Speichern-Abbruch und echter Schreibfehler erhalten Arbeitsstand und Entwurf', async () => {
  const s = await starten();
  try {
    await neuerAblauf(s, 'Unverlorener Arbeitsstand');
    const id = await entwurfAbwarten(s);
    const vorher = (await dokumentLesen(s)).projekt;
    await dialogAntwort(s, 0);
    await speicherziel(s, null);
    await s.seite.getByRole('button', { name: 'Neu', exact: true }).click();
    await sprachwahlBestaetigen(s.seite);
    await nativenDialogAbwarten(s, 'speichern');
    await editorBereit(s);
    expect((await dokumentLesen(s)).projekt).toEqual(vorher);
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    expect((await bibliothekLesen(s)).entwuerfe.map((e) => e.id)).toContain(id);
    const zielOrdner = join(s.ordner, 'KeineDatei.scriptlab');
    await mkdir(zielOrdner);
    await speicherziel(s, zielOrdner);
    await s.seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(s.seite.getByRole('alert').filter({ visible: true })).toContainText(/Zugriff|Dateivorgang/);
    expect((await stat(zielOrdner)).isDirectory()).toBe(true);
    expect((await dokumentLesen(s)).projekt).toEqual(vorher);
    expect((await bibliothekLesen(s)).entwuerfe.map((e) => e.id)).toContain(id);
    await neustarten(s, true);
    expect((await bibliothekLesen(s)).entwuerfe.map((e) => e.id)).toContain(id);
    await bild(s, 'entwurf-nach-schreibfehler-erhalten');
  } finally {
    await beenden(s);
  }
});

test('Startseite: Entwurf als neue Projektkopie speichern und lokalen Entwurf bewusst löschen', async () => {
  const s = await starten();
  try {
    await neuerAblauf(s, 'Entwurf als Projektkopie');
    await entwurfAbwarten(s);
    const projektKennung = (await dokumentLesen(s)).projektKennung;
    await zurStartseite(s);
    await s.seite.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    const zeile = s.seite
      .getByTestId('entwuerfe')
      .getByRole('article', { name: 'Entwurf als Projektkopie', exact: true });
    await dialogAntwort(s, 1);
    await speicherziel(s, null);
    await zeile.getByRole('button', { name: 'Als Projekt speichern', exact: true }).click();
    await nativenDialogAbwarten(s, 'speichern');
    await expect(zeile.getByRole('button', { name: 'Als Projekt speichern', exact: true })).toBeEnabled();
    await expect(zeile).toBeVisible();
    expect((await bibliothekLesen(s)).projekte).toHaveLength(0);
    const pfad = join(s.ordner, 'Entwurfskopie.scriptlab');
    await speicherziel(s, pfad);
    await zeile.getByRole('button', { name: 'Als Projekt speichern', exact: true }).click();
    await nativenDialogAbwarten(s, 'speichern');
    await editorBereit(s);
    const kopie = JSON.parse(await readFile(pfad, 'utf8')) as Projekt;
    expect(kopie.projektKennung).not.toBe(projektKennung);
    expect(kopie.projektKennung).toBe((await dokumentLesen(s)).projektKennung);
    expect((await bibliothekLesen(s)).entwuerfe).toEqual([]);
    await projektBenennen(s, 'Nur die lokale Sicherung löschen');
    await entwurfAbwarten(s);
    const original = await readFile(pfad);
    await zurStartseite(s);
    await s.seite.getByRole('button', { name: 'Entwürfe', exact: true }).click();
    const loeschzeile = s.seite
      .getByTestId('entwuerfe')
      .getByRole('article', { name: 'Nur die lokale Sicherung löschen', exact: true });
    await dialogAntwort(s, 1);
    await loeschzeile.getByRole('button', { name: 'Entwurf löschen', exact: true }).click();
    await nativenDialogAbwarten(s, 'nachricht');
    await expect(loeschzeile.getByRole('button', { name: 'Entwurf löschen', exact: true })).toBeEnabled();
    await expect(loeschzeile).toBeVisible();
    await dialogAntwort(s, 0);
    await loeschzeile.getByRole('button', { name: 'Entwurf löschen', exact: true }).click();
    await nativenDialogAbwarten(s, 'nachricht');
    await expect(loeschzeile).toHaveCount(0);
    expect(await readFile(pfad)).toEqual(original);
  } finally {
    await beenden(s);
  }
});

test('Startseite: leeres Projekt und reine Ansichtsänderung erzeugen keinen Entwurf', async () => {
  const s = await starten();
  try {
    await neuerAblauf(s);
    await s.seite.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    await zurStartseite(s);
    // Auch der zeitversetzte Sicherungspfad darf daraus keinen Inhalt machen.
    await s.seite.waitForTimeout(1600);
    expect((await bibliothekLesen(s)).entwuerfe).toEqual([]);
  } finally {
    await beenden(s);
  }
});

for (const beispiel of beispiele) {
  test(`Startseite: Vorlage „${beispiel.name}“ (${beispiel.skriptsprache}) wird eine eigene bearbeitbare Kopie`, async () => {
    const s = await starten();
    try {
      const quelle = resolve('beispiele', beispiel.dateiname);
      const original = await readFile(quelle);
      const vorlage = projektPruefen(JSON.parse(original.toString('utf8')));
      await s.seite.getByRole('button', { name: 'Beispielworkflows', exact: true }).click();
      await s.seite
        .getByRole('combobox', { name: 'Beispiele nach Sprache filtern', exact: true })
        .selectOption(beispiel.skriptsprache);
      const karte = s.seite
        .getByTestId('beispiele')
        .getByRole('article')
        .filter({
          has: s.seite.getByRole('heading', { name: beispiel.name, exact: true }),
        });
      await karte.getByRole('button', { name: 'Als Vorlage öffnen', exact: true }).click();
      await expect(s.seite.getByTestId('palette')).toBeVisible();
      const kopie = await dokumentLesen(s);
      expect(kopie.projekt.name).toBe(`${vorlage.name} (Kopie)`);
      expect(kopie.projektKennung).toMatch(/^[a-f0-9-]{36}$/i);
      expect(kopie.projektKennung).not.toBe(vorlage.projektKennung);
      expect(kopie.dateiname).toBeNull();
      expect(kopie.geaendert).toBe(true);
      expect(kopie.projekt.editor).toEqual(vorlage.editor);
      await projektBenennen(s, 'Meine unabhängige Vorlagenkopie');
      await entwurfAbwarten(s);
      expect((await bibliothekLesen(s)).projekte).toEqual([]);
      expect(await readFile(quelle)).toEqual(original);
    } finally {
      await beenden(s);
    }
  });
}

test('Startseite: sieben lokale Hilfethemen, Suche und Vorlagenlink funktionieren ohne Netzwerk', async () => {
  const s = await starten();
  try {
    const netzanfragen: string[] = [];
    s.seite.on('request', (anfrage) => {
      if (/^https?:/i.test(anfrage.url())) netzanfragen.push(anfrage.url());
    });
    await s.seite.context().setOffline(true);
    await s.seite.getByRole('button', { name: 'Dokumentation und Anleitungen', exact: true }).click();
    const hilfe = s.seite.getByTestId('hilfe');
    expect(hilfeArtikel).toHaveLength(7);
    for (const thema of hilfeArtikel) {
      await hilfe.getByRole('button', { name: thema.titel, exact: true }).click();
      await expect(s.seite.getByRole('heading', { name: thema.titel, level: 1, exact: true })).toBeVisible();
      await expect(hilfe.getByRole('article')).toContainText(thema.abschnitte[0].titel);
      await s.seite.getByRole('button', { name: 'Zur Themenübersicht', exact: true }).click();
    }
    const suche = hilfe.getByRole('searchbox', { name: 'Hilfe durchsuchen', exact: true });
    await suche.fill('NichtvorhandenesHilfewort981');
    await expect(hilfe).toContainText('Keine Hilfe gefunden');
    await suche.fill('Zertifikat');
    await expect(hilfe.locator('.start-hilfe-treffer').getByRole('button')).not.toHaveCount(0);
    await hilfe.getByRole('button', { name: 'Suche leeren', exact: true }).click();
    await hilfe.getByRole('button', { name: 'Erste Schritte', exact: true }).click();
    await bild(s, 'offline-hilfe');
    await hilfe
      .getByRole('button', {
        name: 'Beispiel als Vorlage öffnen: Eine Nachricht anzeigen · VBS',
        exact: true,
      })
      .click();
    await expect(s.seite.getByTestId('palette')).toBeVisible();
    expect((await dokumentLesen(s)).projekt.editor.blocks!.blocks[0].next!.block.type).toBe('sl_message');
    expect(netzanfragen).toEqual([]);
  } finally {
    await beenden(s);
  }
});

for (const breite of [1280, 850]) {
  test(`Startseite: ${breite} CSS-Pixel, große Schrift und Tastatur halten die Karten erreichbar`, async () => {
    const s = await starten();
    try {
      await s.app.evaluate(
        ({ BrowserWindow }, b) => BrowserWindow.getAllWindows()[0].setContentSize(b, 720),
        breite,
      );
      await expect
        .poll(async () => Math.abs((await s.seite.evaluate(() => innerWidth)) - breite))
        .toBeLessThanOrEqual(2);
      const masse = await s.seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        devicePixelRatio,
      }));
      await mkdir('artifacts/startseite', { recursive: true });
      await writeFile(
        `artifacts/startseite/fenster-${breite}.json`,
        JSON.stringify({ angefordert: { breite, hoehe: 720 }, tatsaechlich: masse }, null, 2),
      );
      test.info().annotations.push({
        type: 'Native Fenstermaße',
        description: `Angefordert ${breite}×720, tatsächlich ${masse.breite}×${masse.hoehe} CSS-Pixel bei devicePixelRatio ${masse.devicePixelRatio}.`,
      });
      const karten = s.seite.getByTestId('start-karten');
      const eigene = karten.getByRole('button', { name: 'Meine gespeicherten Workflows', exact: true });
      const entwuerfeKarte = karten.getByRole('button', { name: 'Entwürfe', exact: true });
      const a = (await eigene.boundingBox())!,
        b = (await entwuerfeKarte.boundingBox())!;
      if (breite < 900) {
        expect(a.x).toBeCloseTo(b.x, 0);
        expect(b.y).toBeGreaterThan(a.y + a.height);
      } else {
        expect(a.y).toBeCloseTo(b.y, 0);
        expect(b.x).toBeGreaterThan(a.x + a.width);
      }
      const startbereich = s.seite.getByTestId('startbereich');
      const einstellungen = startbereich.getByRole('button', { name: 'Einstellungen', exact: true });
      await einstellungen.click();
      await s.seite.getByRole('combobox', { name: 'UI-Textgröße', exact: true }).selectOption('2');
      await s.seite.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
      await expect(einstellungen).toBeFocused();
      await eigene.focus();
      await s.seite.keyboard.press('Tab');
      await expect(entwuerfeKarte).toBeFocused();
      expect(await entwuerfeKarte.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      const ziel = (await entwuerfeKarte.boundingBox())!;
      expect(ziel.y).toBeGreaterThanOrEqual(0);
      expect(ziel.y + ziel.height).toBeLessThanOrEqual(await s.seite.evaluate(() => innerHeight));
      expect(await s.seite.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await bild(s, `karten-${breite}-text-200`);
      await s.seite.keyboard.press('Enter');
      await expect(s.seite.getByRole('heading', { name: 'Entwürfe', exact: true, level: 1 })).toBeFocused();
    } finally {
      await beenden(s);
    }
  });
}

for (const faktor of [1, 1.25, 1.5, 2]) {
  test(`Startseite: Prozess-DPI ${faktor * 100} Prozent erhält lesbare Karten und Hauptaktionen`, async () => {
    const s = await starten(undefined, faktor);
    try {
      for (let versuch = 0; versuch < 4; versuch++) {
        await s.seite.evaluate(
          () =>
            new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
        );
        const ist = await s.seite.evaluate(() => ({ breite: innerWidth, hoehe: innerHeight }));
        if (Math.abs(1280 - ist.breite) <= 2 && Math.abs(720 - ist.hoehe) <= 2) break;
        await s.app.evaluate(
          ({ BrowserWindow }, delta) => {
            const fenster = BrowserWindow.getAllWindows()[0];
            const [breite, hoehe] = fenster.getContentSize();
            fenster.setContentSize(breite + delta.x, hoehe + delta.y);
          },
          { x: 1280 - ist.breite, y: 720 - ist.hoehe },
        );
      }
      const renderer = await s.seite.evaluate(() => ({
        breite: innerWidth,
        hoehe: innerHeight,
        devicePixelRatio,
        dokumentBreite: document.documentElement.scrollWidth,
        dokumentHoehe: document.documentElement.scrollHeight,
      }));
      expect(Math.abs(renderer.breite - 1280)).toBeLessThanOrEqual(2);
      expect(Math.abs(renderer.hoehe - 720)).toBeLessThanOrEqual(2);
      expect(renderer.devicePixelRatio).toBe(faktor);
      expect(renderer.dokumentBreite).toBeLessThanOrEqual(renderer.breite);
      const namen = [
        'Meine gespeicherten Workflows',
        'Entwürfe',
        'Beispielworkflows',
        'Dokumentation und Anleitungen',
      ];
      for (const name of namen) {
        const karte = s.seite.getByTestId('start-karten').getByRole('button', { name, exact: true });
        await expect(karte).toBeVisible();
        const text = karte.locator('.start-karte-titel');
        await expect(text).toHaveText(name);
        expect(await text.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(
          14,
        );
        const rahmen = (await karte.boundingBox())!;
        expect(rahmen.y).toBeGreaterThanOrEqual(0);
        expect(rahmen.y + rahmen.height).toBeLessThanOrEqual(renderer.hoehe);
      }
      const hauptaktion = s.seite.getByRole('button', { name: 'Neuer Workflow', exact: true });
      await expect(hauptaktion).toBeEnabled();
      const ziel = (await hauptaktion.boundingBox())!;
      expect(ziel.width).toBeGreaterThanOrEqual(32);
      expect(ziel.height).toBeGreaterThanOrEqual(32);
      const fenster = await s.app.evaluate(({ BrowserWindow, screen }) => {
        const fenster = BrowserWindow.getAllWindows()[0];
        return {
          displayScaleFactor: screen.getDisplayMatching(fenster.getBounds()).scaleFactor,
          inhalt: fenster.getContentBounds(),
        };
      });
      expect(fenster.displayScaleFactor).toBe(faktor);
      await mkdir('artifacts/startseite', { recursive: true });
      await writeFile(
        `artifacts/startseite/prozess-dpi-${faktor * 100}.json`,
        JSON.stringify(
          {
            typ: 'Prozessweise DPI-Darstellung; keine Änderung der Windows-Anzeigeeinstellungen',
            angefordert: { faktor, breite: 1280, hoehe: 720 },
            renderer,
            fenster,
          },
          null,
          2,
        ),
      );
      await bild(s, `prozess-dpi-${faktor * 100}`);
      test.info().annotations.push({
        type: 'DPI-Testgrenze',
        description: `Prozessfaktor ${faktor}; tatsächlich ${renderer.breite}×${renderer.hoehe} CSS-Pixel. Keine echte Windows-Systemskalierung verändert.`,
      });
    } finally {
      await beenden(s);
    }
  });
}

test('Startseite: neueres Indexschema bleibt unverändert und blockiert das Öffnen einer Projektdatei nicht', async () => {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Startseite-'));
  const profil = join(ordner, 'Profil');
  await mkdir(profil);
  const indexdatei = join(profil, 'projektbibliothek.json');
  const original = Buffer.from(
    '{"schemaVersion":2,"projekte":[{"name":"Unbekannter zukünftiger Bestand"}]}\n',
    'utf8',
  );
  await writeFile(indexdatei, original);
  const projekt = { ...neuesProjekt(), name: 'Trotz gesperrtem Index lesbar' };
  const projektdatei = join(ordner, 'Weiterhin-lesbar.scriptlab');
  await writeFile(projektdatei, JSON.stringify(projekt), 'utf8');
  const s = await starten(ordner);
  try {
    const startbereich = s.seite.getByTestId('startbereich');
    await expect(
      startbereich.getByRole('status').filter({ hasText: /Projektliste konnte nicht gelesen/ }),
    ).toBeVisible();
    await expect(
      s.seite
        .getByTestId('start-karten')
        .getByRole('button', { name: 'Meine gespeicherten Workflows', exact: true }),
    ).not.toContainText('0 Projekte bekannt');
    expect(await readFile(indexdatei)).toEqual(original);
    await bild(s, 'indexschema-unbekannt');
    await dateiOeffnen(s, projektdatei);
    expect((await dokumentLesen(s)).projekt.name).toBe(projekt.name);
    expect((await dokumentLesen(s)).projektKennung).toBe(projekt.projektKennung);
    expect(await readFile(indexdatei)).toEqual(original);
    expect(JSON.parse(await readFile(projektdatei, 'utf8'))).toEqual(projekt);
  } finally {
    await beenden(s);
  }
});
