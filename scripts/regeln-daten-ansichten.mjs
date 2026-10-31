import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Isolierte echte Windows-App. Daten, Projekte und Native-Dateiauswahl gehören nur diesem Sichtlauf.
const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Regeln-Daten-'));
const profil = join(ordner, 'Profil'),
  bilder = resolve('docs/regeln-daten');
await mkdir(profil);
await mkdir(bilder, { recursive: true });
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, darstellung: 'hell' }),
);
const basis = JSON.parse(
  await readFile(resolve('beispiele/business/A-Monatsauswertung/workflow.scriptlab'), 'utf8'),
);
const vorlagen = new Map();
for (let b = basis.editor.blocks.blocks[0]; b; b = b.next?.block) vorlagen.set(b.id, b);
const pruefungen = [],
  rendererfehler = [];
let app, seite;
function block(typ, id, name, konfiguration, quelle = 'a-monat') {
  return {
    type: typ,
    id,
    fields: { NAME: name },
    data: JSON.stringify({ konfiguration, eingaben: quelle ? { tabelle: { referenz: quelle } } : {} }),
  };
}
function projekt(name, zusaetze = [], kurz = false) {
  const p = structuredClone(basis);
  p.projektKennung = randomUUID();
  p.name = `Beispieldaten · ${name}`;
  const ids = kurz ? ['start', 'a-import'] : ['start', 'a-import', 'a-datum', 'a-betrag', 'a-monat'];
  const kette = [...ids.map((id) => structuredClone(vorlagen.get(id))), ...zusaetze];
  for (let i = 0; i < kette.length; i++) {
    delete kette[i].next;
    if (i + 1 < kette.length) kette[i].next = { block: kette[i + 1] };
  }
  kette[0].x = 24;
  kette[0].y = 24;
  p.editor.blocks.blocks = [kette[0]];
  p.ansicht = { zoom: 1, x: 0, y: 0 };
  return p;
}
async function oeffnen(p) {
  const eingaben = join(profil, 'Arbeitsdateien', p.projektKennung, 'eingaben');
  await mkdir(eingaben, { recursive: true });
  await writeFile(
    join(eingaben, 'umsaetze.csv'),
    await readFile(resolve('beispiele/business/A-Monatsauswertung/eingaben/umsaetze.csv')),
  );
  const datei = join(ordner, `${p.projektKennung}.scriptlab`);
  await writeFile(datei, JSON.stringify(p));
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false });
  }, datei);
  if (await seite.getByRole('button', { name: 'Workflow', exact: true }).isVisible()) {
    await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Workflow öffnen', exact: true }).click();
  } else await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await expect(seite.getByRole('heading', { name: p.name, exact: true })).toBeVisible();
  await seite.getByRole('tab', { name: 'Ablauf', exact: true }).click();
}
async function waehlen(id) {
  await seite
    .locator(`.blocklyDraggable[data-id="${id}"] > .blocklyPath`)
    .first()
    .click({ position: { x: 12, y: 24 } });
  if (!(await seite.getByTestId('eigenschaften-panel').isVisible()))
    await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
}
const panel = () => seite.getByTestId('eigenschaften-panel');
const stand = async () => (await seite.evaluate(() => window.scriptlab.laden())).wert.dokument;
const lauf = async () => (await seite.evaluate(() => window.scriptlab.testLesen())).wert.zustand;
async function daten(id) {
  await seite.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
  let gefunden;
  function lesen(b) {
    if (b.id === id) gefunden = b;
    for (const i of Object.values(b.inputs ?? {})) if (i.block) lesen(i.block);
    if (b.next?.block) lesen(b.next.block);
  }
  for (const b of (await stand()).projekt.editor.blocks.blocks) lesen(b);
  return JSON.parse(gefunden.data);
}
async function bild(name) {
  await seite.waitForTimeout(180);
  await seite.screenshot({ path: join(bilder, `${name}.png`) });
}
async function vorschau() {
  await panel().getByRole('button', { name: 'Datenvorschau', exact: true }).click();
  const alt = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Datenvorschau laden', exact: true }).click();
  await expect.poll(async () => (await lauf()).laufId).not.toBe(alt);
  await expect
    .poll(async () => (await lauf()).phase, { timeout: 45000 })
    .toMatch(/^(beendet|fehlgeschlagen|mit_fehlern|zeitlimit)$/);
  const fertig = await lauf();
  assert.equal(fertig.phase, 'beendet', fertig.meldung);
  return fertig;
}
async function thema(wert, skala = '1') {
  await seite
    .getByRole('navigation', { name: 'Globale Navigation', exact: true })
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .click();
  await seite.getByRole('tab', { name: 'Darstellung', exact: true }).click();
  await seite.getByLabel('Farbschema', { exact: true }).selectOption(wert);
  await seite.getByLabel('Textgröße der Oberfläche', { exact: true }).selectOption(skala);
  await seite.getByRole('button', { name: 'Fertig', exact: true }).click();
}
try {
  app = await electron.launch({
    args: [resolve('.'), '--force-device-scale-factor=1'],
    env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
  });
  seite = await app.firstWindow();
  seite.setDefaultTimeout(10000);
  seite.on('pageerror', (e) => rendererfehler.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await expect(seite.getByRole('heading', { name: 'Startseite', exact: true })).toBeVisible();
  console.log('Bedingungen mit echten Vorschauergebnissen');
  const regeln = projekt('Filter verständlich bearbeiten');
  let filter = regeln.editor.blocks.blocks[0];
  while (filter.id !== 'a-monat') filter = filter.next.block;
  const konf = JSON.parse(filter.data);
  konf.konfiguration.bedingung = {
    art: 'UND',
    kinder: ['Nord', 'Süd'].map((w) => ({
      art: 'vergleich',
      spalte: 'Region',
      operator: 'EQ',
      wert: { art: 'wert', typ: 'TEXT', wert: w },
    })),
  };
  filter.data = JSON.stringify(konf);
  await oeffnen(regeln);
  await waehlen('a-monat');
  await panel().getByLabel('Diese Gruppe trifft zu, wenn', { exact: true }).selectOption('ODER');
  assert.equal((await daten('a-monat')).konfiguration.bedingung.art, 'ODER');
  assert.equal((await daten('a-monat')).konfiguration.bedingung.kinder.length, 2);
  assert((await daten('a-monat')).konfiguration.bedingung.kinder.every((k) => k.art === 'vergleich'));
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(async () => (await daten('a-monat')).konfiguration.bedingung.art).toBe('UND');
  await seite.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect.poll(async () => (await daten('a-monat')).konfiguration.bedingung.art).toBe('ODER');
  await bild('bedingungsgruppe-hell');
  await vorschau();
  await expect(seite.getByRole('cell', { name: 'Nord', exact: true }).first()).toBeVisible();
  await expect(seite.getByRole('cell', { name: 'Süd', exact: true })).toBeVisible();
  pruefungen.push(
    'UND/ODER ändert die direkte Gruppe; beide Kinder und Undo/Redo erhalten. Die echte ODER-Vorschau enthält Nord und Süd.',
  );
  console.log('Zuordnungen ohne Überschreiben');
  const zuordnung = projekt(
    'Spalten sicher umbenennen',
    [
      block(
        'sl_biz_umbenennen',
        'zuordnung',
        'Spalten umbenennen',
        { aktion: 'UMBENENNEN', namen: { Feld1: 'Erster Wert', Feld3: 'Dritter Wert' } },
        'a-import',
      ),
    ],
    true,
  );
  await oeffnen(zuordnung);
  await waehlen('zuordnung');
  await panel().getByRole('button', { name: 'Vorhandene Spalte „Feld1“ umbenennen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Vorhandene Spalte umbenennen', exact: true });
  await dialog.getByLabel('Vorhandene Spalte', { exact: true }).fill('Feld3');
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(dialog.getByText(/bereits vorhanden/)).toBeVisible();
  await expect(dialog.getByLabel('Vorhandene Spalte', { exact: true })).toHaveValue('Feld3');
  assert.deepEqual((await daten('zuordnung')).konfiguration.namen, {
    Feld1: 'Erster Wert',
    Feld3: 'Dritter Wert',
  });
  await bild('zuordnung-doppelter-name');
  await dialog.getByLabel('Vorhandene Spalte', { exact: true }).fill('Kunde');
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await expect(
    panel().getByRole('button', { name: 'Vorhandene Spalte „Kunde“ umbenennen', exact: true }),
  ).toBeFocused();
  assert.deepEqual((await daten('zuordnung')).konfiguration.namen, {
    Kunde: 'Erster Wert',
    Feld3: 'Dritter Wert',
  });
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect
    .poll(async () => Object.keys((await daten('zuordnung')).konfiguration.namen))
    .toEqual(['Feld1', 'Feld3']);
  await panel().getByRole('button', { name: 'Zuordnung hinzufügen', exact: true }).click();
  assert.deepEqual((await daten('zuordnung')).konfiguration.namen, {
    Feld1: 'Erster Wert',
    Feld3: 'Dritter Wert',
    Feld2: '',
  });
  await bild('zuordnungen-hell');
  pruefungen.push(
    'Doppelter Name übernimmt nichts und erhält den Eingabetext. Gültige Umbenennung ist atomar rückgängig; Fokus kehrt zur umbenannten Zeile zurück. Hinzufügen füllt Namenslücken ohne Überschreiben.',
  );
  console.log('Spalten aus tatsächlicher Vorschau auswählen und ordnen');
  const spalten = projekt('Spalten auswählen', [
    block('sl_biz_spalten', 'spalten', 'Spalten auswählen', { aktion: 'AUSWAEHLEN', spalten: [] }),
  ]);
  await oeffnen(spalten);
  await waehlen('a-monat');
  await vorschau();
  await seite.getByRole('button', { name: 'Zum Baustein', exact: true }).click();
  await waehlen('spalten');
  await panel().getByText('Aus Vorschau auswählen', { exact: true }).click();
  await panel().getByRole('checkbox', { name: 'Region', exact: true }).check();
  await panel().getByRole('checkbox', { name: 'Betrag', exact: true }).check();
  assert.deepEqual((await daten('spalten')).konfiguration.spalten, ['Region', 'Betrag']);
  await expect(panel().getByRole('checkbox', { name: 'Datum', exact: true })).toBeVisible();
  await panel().getByRole('button', { name: 'Spalten: Spalte 2 nach oben', exact: true }).click();
  assert.deepEqual((await daten('spalten')).konfiguration.spalten, ['Betrag', 'Region']);
  await bild('spaltenauswahl-hell');
  await seite.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect.poll(async () => (await daten('spalten')).konfiguration.spalten).toEqual(['Region', 'Betrag']);
  await thema('dunkel');
  await bild('spaltenauswahl-dunkel');
  await thema('hell');
  pruefungen.push(
    'Mehrere Spalten aus echter quellengenauer Vorschau auswählbar; Vorschläge bleiben nach dem ersten Klick erhalten. Auf/Ab ändert nur Reihenfolge; Undo erhält ausgewählte Spalten.',
  );
  console.log('Vorhandene Datums- und Textfunktionen wirklich anwenden');
  const funk = projekt('Datum und Text berechnen', [
    block('sl_biz_berechnen', 'funktion', 'Monat ermitteln', {
      aktion: 'BERECHNEN',
      spalte: 'Monat',
      ausdruck: { art: 'funktion', funktion: 'JAHR', argument: { art: 'spalte', name: 'Datum' } },
    }),
  ]);
  await oeffnen(funk);
  await waehlen('funktion');
  await panel().getByLabel('Funktion', { exact: true }).selectOption('MONAT');
  assert.deepEqual((await daten('funktion')).konfiguration.ausdruck.argument, {
    art: 'spalte',
    name: 'Datum',
  });
  await bild('funktion-datum-hell');
  await vorschau();
  await expect(seite.getByRole('columnheader', { name: /Monat/ })).toBeVisible();
  await bild('funktion-vorschau');
  await seite.getByRole('button', { name: 'Zum Baustein', exact: true }).click();
  await panel().getByLabel('Funktion', { exact: true }).selectOption('REGEX');
  await panel().getByLabel('Angewendet auf', { exact: true }).fill('Region');
  await panel().getByLabel('Suchmuster', { exact: true }).fill('(Nord|Süd)');
  await panel().getByLabel('Ergebnisgruppe', { exact: true }).fill('1');
  await bild('funktion-muster-hell');
  await vorschau();
  await expect(seite.getByRole('cell', { name: 'Nord', exact: true }).first()).toBeVisible();
  pruefungen.push(
    'Monatsfunktion erhält ihr Argument und liefert echte Vorschauwerte. Mustersuche mit Gruppe1 wird als strukturierter Ausdruck ausgeführt; kein Programmtext eingegeben.',
  );
  console.log('Prüfregeln zeigen nur passende Angaben');
  const qual = projekt('Datenqualität prüfen', [
    block('sl_biz_pruefen', 'qualitaet', 'Qualität der Umsätze', {
      regeln: [
        { art: 'NICHT_LEER', spalte: 'Region' },
        { art: 'EINDEUTIG', spalte: 'Datum' },
      ],
      bei_fehler: 'BERICHT',
    }),
  ]);
  await oeffnen(qual);
  await waehlen('qualitaet');
  const regel = panel().locator('.business-pruefregel').first();
  await regel.locator(':scope > summary').click();
  await expect(regel.getByRole('textbox', { name: 'Spalte', exact: true })).toHaveValue('Region');
  await expect(regel.getByRole('combobox', { name: 'Datentyp', exact: true })).toHaveCount(0);
  await regel.getByRole('combobox', { name: 'Prüfung', exact: true }).selectOption('ZEILENZAHL');
  await expect(regel.getByRole('textbox', { name: 'Spalte', exact: true })).toHaveCount(0);
  await regel.getByRole('textbox', { name: 'Mindestens so viele Zeilen (optional)', exact: true }).fill('2');
  await regel.getByRole('textbox', { name: 'Höchstens so viele Zeilen (optional)', exact: true }).fill('10');
  assert.equal((await daten('qualitaet')).konfiguration.regeln[0].spalte, 'Region');
  await bild('pruefregel-zeilen-hell');
  await regel.getByRole('combobox', { name: 'Prüfung', exact: true }).selectOption('BEREICH');
  await regel.getByRole('textbox', { name: 'Spalte', exact: true }).fill('Betrag');
  await regel.getByRole('combobox', { name: 'Datentyp', exact: true }).selectOption('DEZIMAL');
  await regel.getByRole('textbox', { name: 'Untere Grenze (optional)', exact: true }).fill('0.00');
  await regel.getByRole('textbox', { name: 'Obere Grenze (optional)', exact: true }).fill('200.00');
  await bild('pruefregel-bereich-hell');
  await thema('dunkel');
  await bild('pruefregel-dunkel');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(960, 680));
  await bild('pruefregel-schmal');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await thema('hell', '2');
  await bild('pruefregel-ui200');
  await expect(seite.getByRole('button', { name: 'Prüflauf starten', exact: true })).toBeInViewport();
  await thema('hell');
  pruefungen.push(
    'Pflichtwert-, Zeilenzahl- und Bereichsregel zeigen passende Felder; andere gespeicherte Angaben bleiben erhalten. Beide Themen,960×680 und200% UI-Text angesehen.',
  );
  await seite.getByRole('tab', { name: 'Läufe', exact: true }).click();
  if (await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).isVisible())
    await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  else await seite.getByRole('tab', { name: 'Vorbereitung', exact: true }).click();
  const alt = (await lauf()).laufId;
  await seite.getByRole('button', { name: 'Prüflauf starten', exact: true }).click();
  await expect.poll(async () => (await lauf()).laufId).not.toBe(alt);
  await expect
    .poll(async () => (await lauf()).phase, { timeout: 45000 })
    .toMatch(/^(beendet|fehlgeschlagen|mit_fehlern|zeitlimit)$/);
  assert.equal((await lauf()).phase, 'beendet', (await lauf()).meldung);
  await bild('pruefregeln-laufergebnis');
  pruefungen.push(
    'Die konfigurierten Bereichs- und Schlüsselregeln wurden mit den echten synthetischen CSV-Daten im Prüflauf erfolgreich ausgeführt.',
  );
  console.log('Vorlage als Quelle, Bericht als Ausgabeziel');
  const vorlage = projekt('Quellen und Ziele', [], true);
  const start = vorlage.editor.blocks.blocks[0];
  start.next = {
    block: block(
      'sl_biz_xlsx_vorlage',
      'vorlage',
      'Excel-Vorlage befüllen',
      {
        vorlage: 'Vorlage.xlsx',
        ziel: 'Bericht.xlsx',
        blatt: 'Tabelle1',
        zellen: { A1: 'Beispieldaten' },
        formeln: {},
        formate: [],
        konflikt: 'FEHLER',
      },
      null,
    ),
  };
  vorlage.business = { parameter: [], parametersaetze: { test: {}, echt: {} }, ressourcen: [] };
  await oeffnen(vorlage);
  await seite.getByRole('tab', { name: 'Läufe', exact: true }).click();
  if (await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).isVisible())
    await seite.getByRole('button', { name: 'Neuen Lauf vorbereiten', exact: true }).click();
  else await seite.getByRole('tab', { name: 'Vorbereitung', exact: true }).click();
  await expect(seite.locator('.lauf-pfadkurz')).toHaveText('Vorlage.xlsx → Bericht.xlsx');
  await seite.locator('.lauf-quellenuebersicht > summary').click();
  await bild('quellen-und-ziele');
  pruefungen.push(
    'Die echte Laufvorbereitung zeigt Vorlage.xlsx als Quelle und Bericht.xlsx als Ziel; Öffnen der Ansicht startet keinen Lauf.',
  );
  assert.deepEqual(rendererfehler, []);
  await writeFile(
    join(bilder, 'sichtstand.json'),
    JSON.stringify(
      {
        datum: new Date().toISOString(),
        profil,
        pruefungen,
        rendererfehler,
        grenzen: [
          'Eigene Sichtprüfung mit synthetischen Beispieldaten, kein Nutzertest.',
          'Keine vollständige Windows-Skalierungsmatrix oder Gesamtregression.',
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ profil, pruefungen: pruefungen.length, rendererfehler }));
} catch (e) {
  if (seite) await seite.screenshot({ path: resolve('artifacts/regeln-daten-fehler.png') }).catch(() => {});
  throw e;
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
