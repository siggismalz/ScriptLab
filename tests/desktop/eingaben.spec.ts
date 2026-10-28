import { sprachwahlBestaetigen } from './sprache';
import { test as basisTest, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { projektPruefen, type EditorBlock, type Projekt } from '../../src/kern/projekt';
import type { Einstellungen } from '../../src/gemeinsam/bruecke';
import { bausteinDefinitionen } from '../../src/kern/katalog';
import { vbsErzeugen } from '../../src/kern/generator';

const test = basisTest.extend<{ profilEinstellungen: Record<string, unknown> | null }>({
  profilEinstellungen: [null, { option: true }],
});

let app: ElectronApplication;
let seite: Page;
let ordner: string;

test.beforeEach(async ({ profilEinstellungen }) => {
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Eingaben-'));
  const profil = join(ordner, 'Profil');
  if (profilEinstellungen) {
    await mkdir(profil, { recursive: true });
    await writeFile(join(profil, 'einstellungen.json'), JSON.stringify(profilEinstellungen), 'utf8');
  }
  app = await electron.launch({
    args: [resolve('.')],
    // Auch versehentlich relativ aufgelöste Ziele lägen ausschließlich im Testverzeichnis.
    cwd: ordner,
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  seite = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).click();
  await sprachwahlBestaetigen(seite);
  await expect(seite.getByRole('button', { name: 'Neu', exact: true })).toBeEnabled();
  await seite.evaluate(
    () => new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig()))),
  );
  await expect(seite.getByTestId('statusleiste')).toBeVisible();
});
test.afterEach(async () => {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (ordner) {
    const ziel = resolve(ordner);
    if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Eingaben-'))
      throw new Error('Unsicherer temporärer Testpfad.');
    await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

async function projektLesen(): Promise<Projekt> {
  return seite.evaluate(async () => {
    const r = await window.scriptlab.laden();
    if (!r.ok) throw new Error(r.meldung);
    return r.wert.dokument.projekt;
  });
}
async function einstellungenOeffnen() {
  await seite.getByRole('button', { name: 'Weitere Funktionen', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function zeitstempelOeffnen() {
  const dialog = await einstellungenOeffnen();
  await dialog.getByRole('checkbox', { name: 'Exportierte Datei signieren' }).check();
  await dialog.getByText('Zeitstempel einrichten', { exact: true }).click();
  const feld = dialog.getByRole('textbox', { name: 'Zeitstempeldienst (optional)', exact: true });
  await expect(feld).toBeVisible();
  return { dialog, feld };
}
async function palettenblockEinfuegen(typ: string, ziel: string | RegExp) {
  const name = bausteinDefinitionen.find((b) => b.typ === typ)!.name;
  const palette = seite.getByTestId('palette');
  await palette.getByRole('searchbox', { name: 'Bausteine suchen' }).fill(name);
  await palette.getByRole('button', { name: `Baustein einfügen: ${name}`, exact: true }).click();
  await palette.getByRole('button', { name: ziel, exact: typeof ziel === 'string' }).click();
}

interface UndoEreignis {
  type: string;
  group: string;
  blockId?: string;
  ids?: string[];
  recordUndo: boolean;
}
interface UndoStand {
  zeit: number;
  undo: UndoEreignis[];
  redo: UndoEreignis[];
}
declare global {
  interface Window {
    scriptlabUndoDiagnose?: {
      eintraege: ({ phase: string; ereignis?: UndoEreignis; wiederholen?: boolean } & UndoStand)[];
      standLesen: () => UndoStand;
    };
  }
}

async function undoDiagnoseEinrichten() {
  await seite.getByRole('button', { name: 'Speichern', exact: true }).evaluate((element) => {
    interface WorkspaceDiagnose {
      getUndoStack(): UndoEreignis[];
      getRedoStack(): UndoEreignis[];
      undo(wiederholen?: boolean): void;
      fireChangeListener(ereignis: UndoEreignis): void;
    }
    interface Hook {
      memoizedState?: unknown;
      next?: Hook;
    }
    interface Fiber {
      return?: Fiber;
      memoizedState?: Hook;
    }
    const daten = element as unknown as Record<string, unknown>;
    const schluessel = Object.keys(daten).find((name) => name.startsWith('__reactFiber$'));
    let workspace: WorkspaceDiagnose | undefined;
    // Nur Testdiagnostik: bestehende React-Refs lesen, keine zusätzliche Produktschnittstelle.
    for (let f = daten[schluessel ?? ''] as Fiber | undefined; f && !workspace; f = f.return) {
      for (let h = f.memoizedState; h; h = h.next) {
        for (const wert of [h.memoizedState, (h.memoizedState as { current?: unknown } | null)?.current]) {
          if (wert && typeof (wert as WorkspaceDiagnose).getUndoStack === 'function') {
            workspace = wert as WorkspaceDiagnose;
            break;
          }
        }
        if (workspace) break;
      }
    }
    if (!workspace) throw new Error('Der bestehende Blockly-Arbeitsbereich wurde nicht gefunden.');
    const ws = workspace;
    const beschreiben = (e: UndoEreignis): UndoEreignis => ({
      type: e.type,
      group: e.group,
      recordUndo: e.recordUndo,
      ...(e.blockId ? { blockId: e.blockId } : {}),
      ...(e.ids ? { ids: [...e.ids] } : {}),
    });
    const standLesen = (): UndoStand => ({
      zeit: performance.now(),
      undo: ws.getUndoStack().map(beschreiben),
      redo: ws.getRedoStack().map(beschreiben),
    });
    const diagnose = {
      eintraege: [] as NonNullable<Window['scriptlabUndoDiagnose']>['eintraege'],
      standLesen,
    };
    window.scriptlabUndoDiagnose = diagnose;
    const originalUndo = ws.undo;
    ws.undo = function (wiederholen) {
      diagnose.eintraege.push({ phase: 'vor Undo', wiederholen, ...standLesen() });
      originalUndo.call(this, wiederholen);
      diagnose.eintraege.push({ phase: 'nach Undo', wiederholen, ...standLesen() });
    };
    const originalEreignis = ws.fireChangeListener;
    ws.fireChangeListener = function (ereignis) {
      diagnose.eintraege.push({
        phase: 'Ereignis vor Zustellung',
        ereignis: beschreiben(ereignis),
        ...standLesen(),
      });
      originalEreignis.call(this, ereignis);
    };
  });
}

test('übernimmt nacheinander getippte Palettebreite 300 erst nach fertiger Eingabe', async () => {
  const dialog = await einstellungenOeffnen();
  const feld = dialog.getByRole('spinbutton', { name: 'Breite der Bausteinpalette', exact: true });
  await feld.fill('');
  await feld.pressSequentially('3');
  await expect(feld).toHaveValue('3');
  await expect(feld).not.toHaveAttribute('aria-invalid', 'true');
  await feld.pressSequentially('0');
  await expect(feld).toHaveValue('30');
  await feld.pressSequentially('0');
  await expect(feld).toHaveValue('300');
  await expect(feld).not.toHaveAttribute('aria-invalid', 'true');
  await feld.press('Tab');
  await expect
    .poll(() =>
      seite.evaluate(async () => {
        const r = await window.scriptlab.laden();
        return r.ok ? r.wert.einstellungen.palettenBreite : null;
      }),
    )
    .toBe(300);
  const gespeichert = JSON.parse(await readFile(join(ordner, 'Profil', 'einstellungen.json'), 'utf8'));
  expect(gespeichert.palettenBreite).toBe(300);
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await seite.getByTestId('palette').boundingBox())!.width).toBeCloseTo(300, 0);
});

test('behandelt eine schrittweise getippte Zeitstempeladresse als ruhigen Entwurf', async () => {
  const { dialog, feld } = await zeitstempelOeffnen();
  const vorher = (await projektLesen()).exportOptionen.zeitstempelUrl;
  let entwurf = '';
  for (const teil of ['h', 'ttp', ':', '//', 'timestamp.example', '.invalid', '/zeit']) {
    await feld.pressSequentially(teil);
    entwurf += teil;
    await expect(feld).toHaveValue(entwurf);
    await expect(feld).not.toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(seite.locator('.aufgabenfehler')).toHaveCount(0);
    expect((await projektLesen()).exportOptionen.zeitstempelUrl).toBe(vorher);
  }
  await feld.press('Tab');
  await expect.poll(async () => (await projektLesen()).exportOptionen.zeitstempelUrl).toBe(entwurf);
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('hält fehlerhafte Entwürfe aus dem Projekt heraus und erhält die Datei bei Speichern-Abbruch', async () => {
  const datei = join(ordner, 'Unveraendert.scriptlab');
  await app.evaluate(({ dialog }, ziel) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
  }, datei);
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  const original = await readFile(datei);
  const { dialog, feld } = await zeitstempelOeffnen();
  await feld.pressSequentially('h');
  await expect(feld).toHaveValue('h');
  await expect(feld).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(feld).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByText('Gib eine vollständige HTTP-Adresse ohne Zugangsdaten oder URL-Parameter ein.', {
      exact: true,
    }),
  ).toBeVisible();
  expect((await projektLesen()).exportOptionen.zeitstempelUrl).toBe('');
  await seite.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' });
  });
  await seite.getByRole('button', { name: 'Projektmenü', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Speichern unter', exact: true }).click();
  await expect(seite.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
  expect(await readFile(datei)).toEqual(original);
  expect((await projektLesen()).exportOptionen.zeitstempelUrl).toBe('');
  await einstellungenOeffnen();
  if (!(await feld.isVisible())) await dialog.getByText('Zeitstempel einrichten', { exact: true }).click();
  await expect(feld).toHaveValue('');
});

test('führt Strg-Z und Strg-Y auf einem Toolbarbutton jeweils genau einmal aus', async () => {
  const nachrichtenName = bausteinDefinitionen.find((b) => b.typ === 'sl_message')!.name;
  await palettenblockEinfuegen('sl_message', 'Nach „Workflow starten“');
  await expect
    .poll(async () => (await projektLesen()).editor.blocks!.blocks[0].next?.block.type)
    .toBe('sl_message');
  const nachrichtId = (await projektLesen()).editor.blocks!.blocks[0].next!.block.id;
  await palettenblockEinfuegen('sl_comment', new RegExp(`^Nach „${nachrichtenName}`));
  await expect
    .poll(async () => (await projektLesen()).editor.blocks!.blocks[0].next?.block.next?.block.type)
    .toBe('sl_comment');
  const kommentarId = (await projektLesen()).editor.blocks!.blocks[0].next!.block.next!.block.id;
  const toolbar = seite.getByRole('button', { name: 'Speichern', exact: true });
  await toolbar.focus();
  await expect(toolbar).toBeFocused();
  await seite.keyboard.press('Control+z');
  await expect
    .poll(async () => {
      const nachricht = (await projektLesen()).editor.blocks!.blocks[0].next?.block;
      return { nachricht: nachricht?.id ?? null, kommentar: nachricht?.next?.block.id ?? null };
    })
    .toEqual({ nachricht: nachrichtId, kommentar: null });
  await toolbar.focus();
  await seite.keyboard.press('Control+y');
  await expect
    .poll(async () => (await projektLesen()).editor.blocks!.blocks[0].next?.block.next?.block.id)
    .toBe(kommentarId);
  expect((await projektLesen()).editor.blocks!.blocks[0].next!.block.id).toBe(nachrichtId);
});

test('begrenzt Undo im selben JS-Turn nach einem Einfügeklick auf den neuen Baustein', async ({}, pruefung) => {
  await undoDiagnoseEinrichten();
  try {
    const nachrichtenName = bausteinDefinitionen.find((b) => b.typ === 'sl_message')!.name;
    const kommentarName = bausteinDefinitionen.find((b) => b.typ === 'sl_comment')!.name;
    await palettenblockEinfuegen('sl_message', 'Nach „Workflow starten“');
    await expect
      .poll(async () => (await projektLesen()).editor.blocks!.blocks[0].next?.block.type)
      .toBe('sl_message');
    const nachrichtId = (await projektLesen()).editor.blocks!.blocks[0].next!.block.id;
    // Vorbedingung: die ältere Aktion liegt bereits im Undo-Stack.
    await expect
      .poll(() =>
        seite.evaluate(
          (id) =>
            window
              .scriptlabUndoDiagnose!.standLesen()
              .undo.some((e) => e.type === 'create' && e.ids?.includes(id)),
          nachrichtId,
        ),
      )
      .toBe(true);
    const palette = seite.getByTestId('palette');
    await palette.getByRole('searchbox', { name: 'Bausteine suchen' }).fill(kommentarName);
    await palette.getByRole('button', { name: `Baustein einfügen: ${kommentarName}`, exact: true }).click();
    const ziel = palette.getByRole('button', { name: new RegExp(`^Nach „${nachrichtenName}`) });
    await expect(ziel).toBeVisible();
    // Absichtlich kein Warten zwischen Einfügen und Undo: Blockly stellt die Ereignisse erst später zu.
    await ziel.evaluate((element) => {
      (element as HTMLButtonElement).click();
      const speichern = [
        ...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Projektaktionen"] button'),
      ].find((knopf) => knopf.textContent?.trim() === 'Speichern');
      if (!speichern) throw new Error('Die Speichern-Schaltfläche fehlt.');
      speichern.focus();
      speichern.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          code: 'KeyZ',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect
      .poll(async () => {
        const nachricht = (await projektLesen()).editor.blocks!.blocks[0].next?.block;
        return { nachricht: nachricht?.id ?? null, danach: nachricht?.next?.block.type ?? null };
      })
      .toEqual({ nachricht: nachrichtId, danach: null });
    const diagnose = await seite.evaluate(() => window.scriptlabUndoDiagnose!.eintraege);
    expect(diagnose.filter((e) => e.phase === 'vor Undo')).toHaveLength(1);
  } finally {
    await pruefung.attach('undo-ereignisse-und-gruppen', {
      body: JSON.stringify(await seite.evaluate(() => window.scriptlabUndoDiagnose!.eintraege), null, 2),
      contentType: 'application/json',
    });
  }
});

test.describe('vorhandenes Profil aus der bisherigen Anwendung', () => {
  test.use({ profilEinstellungen: { automatischeUpdates: false, vorabversionen: true } });

  test('ergänzt fehlende Darstellungseinstellungen und erhält vorhandene Updatevorgaben', async () => {
    const gelesen = await seite.evaluate(() => window.scriptlab.laden());
    expect(gelesen.ok).toBe(true);
    if (!gelesen.ok) throw new Error(gelesen.meldung);
    expect(gelesen.wert.einstellungen).toEqual({
      automatischeUpdates: false,
      vorabversionen: true,
      darstellung: 'dunkel',
      palettenBreite: 272,
      paletteEingeklappt: false,
      eigenschaftenAngeheftet: false,
      textSkalierung: 1,
      letzteSkriptsprache: 'vbs',
      pythonInterpreter: null,
    });
    expect((await seite.getByTestId('palette').boundingBox())!.width).toBeCloseTo(272, 0);
    const dialog = await einstellungenOeffnen();
    await expect(dialog.getByRole('checkbox', { name: 'Automatisch nach Updates suchen' })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Vorabversionen bewusst zulassen' })).toBeChecked();
    await expect(dialog.getByRole('combobox', { name: 'Textgröße der Oberfläche', exact: true })).toHaveValue(
      '1',
    );
    await expect(
      dialog.getByRole('spinbutton', { name: 'Breite der Bausteinpalette', exact: true }),
    ).toHaveValue('272');
  });
});

test('weist ungültige UI-Einstellungen über IPC ab und erhält den gespeicherten Stand', async () => {
  const bestaetigt: Einstellungen = {
    darstellung: 'dunkel',
    letzteSkriptsprache: 'vbs',
    pythonInterpreter: null,
    automatischeUpdates: false,
    vorabversionen: false,
    palettenBreite: 300,
    paletteEingeklappt: false,
    eigenschaftenAngeheftet: true,
    textSkalierung: 1.25,
  };
  const gespeichert = await seite.evaluate(
    (werte) => window.scriptlab.einstellungenSpeichern(werte),
    bestaetigt,
  );
  expect(gespeichert).toEqual({ ok: true, wert: bestaetigt });
  const datei = join(ordner, 'Profil', 'einstellungen.json');
  const original = await readFile(datei);
  const ungueltigeWerte = [
    { palettenBreite: 239 },
    { palettenBreite: 401 },
    { palettenBreite: 300.5 },
    { palettenBreite: '300' },
    { textSkalierung: 0 },
    { textSkalierung: 1.1 },
    { textSkalierung: 3 },
    { textSkalierung: '1.25' },
  ];
  for (const abweichung of ungueltigeWerte) {
    const ergebnis = await seite.evaluate(
      (werte) => window.scriptlab.einstellungenSpeichern(werte as unknown as Einstellungen),
      { ...bestaetigt, ...abweichung },
    );
    expect(ergebnis.ok, JSON.stringify(abweichung)).toBe(false);
    if (ergebnis.ok) throw new Error('Ungültige Einstellungen wurden angenommen.');
    expect(ergebnis.meldung).toEqual(expect.any(String));
    expect(ergebnis.meldung.length).toBeGreaterThan(0);
    const geladen = await seite.evaluate(() => window.scriptlab.laden());
    expect(geladen.ok && geladen.wert.einstellungen).toEqual(bestaetigt);
    expect(await readFile(datei)).toEqual(original);
  }
});

const beispiele = [
  {
    datei: '01-Begruessung.scriptlab',
    name: 'Eine Begrüßung',
    blockanzahl: 3,
  },
  {
    datei: '02-Datei-Backup.scriptlab',
    name: 'Testdatei sichern',
    blockanzahl: 13,
  },
  {
    datei: '03-Dateinamenliste.scriptlab',
    name: 'Dateinamen in eine Textdatei schreiben',
    blockanzahl: 17,
  },
];

function bausteineSammeln(projekt: Projekt): EditorBlock[] {
  const alle: EditorBlock[] = [];
  function sammeln(block: EditorBlock) {
    alle.push(block);
    for (const eingang of Object.values(block.inputs ?? {})) {
      if (eingang.block) sammeln(eingang.block);
      if (eingang.shadow) sammeln(eingang.shadow);
    }
    if (block.next) sammeln(block.next.block);
  }
  projekt.editor.blocks?.blocks.forEach(sammeln);
  return alle;
}

for (const beispiel of beispiele) {
  test(`öffnet und exportiert das feste Beispiel „${beispiel.name}“ ohne dessen Dateiaktionen`, async () => {
    const quellbytes = await readFile(resolve('beispiele', beispiel.datei));
    const vorlage = projektPruefen(JSON.parse(quellbytes.toString('utf8')));
    expect(vorlage.name).toBe(beispiel.name);
    // Vorhandene Testquellen verhindern, dass ein verbotener Testlauf nur an fehlenden Quellen scheitern könnte.
    const testdaten = join(ordner, 'ScriptLab-Testdaten');
    const quelle = join(testdaten, 'Backup', 'Quelle', 'beispiel.txt');
    const eingang = join(testdaten, 'Dateiliste', 'Eingang', 'Testdatei mit Umlaut ä.txt');
    await mkdir(join(testdaten, 'Backup', 'Quelle'), { recursive: true });
    await mkdir(join(testdaten, 'Dateiliste', 'Eingang'), { recursive: true });
    await writeFile(quelle, 'Unveränderte Sicherungsquelle.', 'utf8');
    await writeFile(eingang, 'Unveränderter Eingang.', 'utf8');
    async function zieleUnveraendert() {
      await expect(stat(join(testdaten, 'Backup', 'Sicherung'))).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(stat(join(testdaten, 'Dateiliste', 'Dateinamen.txt'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(await readFile(quelle, 'utf8')).toBe('Unveränderte Sicherungsquelle.');
      expect(await readFile(eingang, 'utf8')).toBe('Unveränderter Eingang.');
    }
    await zieleUnveraendert();
    await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Vorlagen', exact: true }).click();
    await seite
      .getByTestId('beispiele')
      .getByRole('article')
      .filter({ hasText: beispiel.datei })
      .getByRole('button', { name: 'Als Vorlage öffnen', exact: true })
      .click();
    await expect.poll(async () => (await projektLesen()).name).toBe(`${beispiel.name} (Kopie)`);
    const geladen = await projektLesen();
    expect(geladen.projektKennung).toMatch(/^[a-f0-9-]{36}$/i);
    expect(geladen.projektKennung).not.toBe(vorlage.projektKennung);
    expect(geladen.beschreibung).toBe(vorlage.beschreibung);
    expect(geladen.editor.blocks!.blocks).toMatchObject(vorlage.editor.blocks!.blocks);
    const bloecke = bausteineSammeln(geladen);
    expect(bloecke).toHaveLength(beispiel.blockanzahl);
    expect(bloecke.filter((b) => b.type === 'sl_start')).toHaveLength(1);
    for (const block of bloecke) await expect(seite.locator(`g[data-id="${block.id}"]`)).toHaveCount(1);
    const generiert = vbsErzeugen(geladen);
    expect(generiert.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(generiert.code).toBeTruthy();
    await zieleUnveraendert();

    const exportDatei = join(ordner, `${beispiel.datei.slice(0, -10)}.vbs`);
    await app.evaluate(({ dialog }, ziel) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
    }, exportDatei);
    await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
    const exportdialog = seite.getByRole('dialog', { name: 'Exportieren', exact: true });
    await exportdialog.getByRole('combobox', { name: 'Inhalt', exact: true }).selectOption('script');
    await exportdialog.getByRole('button', { name: 'Ausgabeort auswählen', exact: true }).click();
    await expect(seite.getByRole('status', { name: 'Export abgeschlossen', exact: true })).toBeVisible();
    const bytes = await readFile(exportDatei);
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(bytes.subarray(2).toString('utf16le')).toBe(generiert.code);
    await zieleUnveraendert();
    expect(await readFile(resolve('beispiele', beispiel.datei))).toEqual(quellbytes);
  });
}

test('weist eine fremde Beispiel-ID ab und erhält das aktuelle gespeicherte Projekt', async () => {
  const datei = join(ordner, 'Aktuelles-Projekt.scriptlab');
  await app.evaluate(({ dialog }, ziel) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
  }, datei);
  await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
  const vorher = await seite.evaluate(() => window.scriptlab.laden());
  expect(vorher.ok).toBe(true);
  if (!vorher.ok) throw new Error(vorher.meldung);
  const original = await readFile(datei);
  const eingeschleustesProjekt = structuredClone(vorher.wert.dokument.projekt);
  eingeschleustesProjekt.name = 'Dieser Inhalt darf nicht übernommen werden';
  const ergebnis = await seite.evaluate(
    (projekt) =>
      window.scriptlab.beispielOeffnen(
        projekt,
        '../../02-Datei-Backup.scriptlab' as Parameters<typeof window.scriptlab.beispielOeffnen>[1],
      ),
    eingeschleustesProjekt,
  );
  expect(ergebnis.ok).toBe(false);
  if (ergebnis.ok) throw new Error('Die fremde Beispiel-ID wurde angenommen.');
  expect(ergebnis.meldung).toEqual(expect.any(String));
  expect(ergebnis.meldung.length).toBeGreaterThan(0);
  const danach = await seite.evaluate(() => window.scriptlab.laden());
  expect(danach.ok && danach.wert.dokument).toEqual(vorher.wert.dokument);
  expect(await readFile(datei)).toEqual(original);
  await expect(seite.getByLabel('Projektstatus', { exact: true })).toHaveText('Projekt gespeichert');
});
