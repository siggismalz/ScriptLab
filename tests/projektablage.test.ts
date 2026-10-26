import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { neuesProjekt, projektPruefen, type Projekt } from '../src/kern/projekt';
import { projektSchreiben } from '../src/main/dateien';
import {
  Projektindex,
  Entwurfspeicher,
  dateistandLesen,
  mitZeitlimit,
  projektHash,
  leererEntwurf,
  windowsPfadSchluessel,
} from '../src/main/projektablage';

let ordner: string;
beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Ablage-'));
});
afterEach(async () => {
  vi.useRealTimers();
  const ziel = resolve(ordner);
  if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Ablage-'))
    throw new Error('Unsicheres Testverzeichnis.');
  await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
function bearbeitet(): Projekt {
  const projekt = neuesProjekt();
  projekt.name = 'Ein echter unvollständiger Entwurf';
  projekt.editor.blocks!.blocks[0].next = {
    block: { id: 'kommentar', type: 'sl_comment', fields: { TEXT: 'Umlaute ä und ein "Zitat"' } },
  };
  return projekt;
}

describe('Lokale Projektbibliothek', () => {
  test('merkt Speichern ohne vorgetäuschtes Öffnungsdatum und lädt den Index erneut', async () => {
    const datei = join(ordner, 'Projekt.scriptlab');
    await projektSchreiben(datei, bearbeitet());
    const index = new Projektindex(join(ordner, 'bibliothek.json'));
    await index.initialisieren();
    const stand = await dateistandLesen(datei);
    const eintrag = await index.merken(datei, stand, false);
    expect(eintrag.zuletztGeoeffnet).toBeNull();
    expect(eintrag.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(eintrag.groesse).toBe((await stat(datei)).size);
    const neu = new Projektindex(join(ordner, 'bibliothek.json'));
    await neu.initialisieren();
    expect(neu.lesen()).toEqual([eintrag]);
    const geoeffnet = await neu.merken(datei, stand, true);
    expect(geoeffnet.id).toBe(eintrag.id);
    expect(geoeffnet.zuletztGeoeffnet).not.toBeNull();
    await neu.verfuegbarkeit(eintrag.id);
    expect(neu.lesen()[0].zuletztGeoeffnet).toBe(geoeffnet.zuletztGeoeffnet);
  });
  test('führt denselben Windows-Pfad trotz Großschreibung nicht doppelt', async () => {
    const datei = join(ordner, 'Projekt.scriptlab');
    await projektSchreiben(datei, bearbeitet());
    const index = new Projektindex(join(ordner, 'bibliothek.json'));
    const stand = await dateistandLesen(datei);
    const eins = await index.merken(datei, stand, false);
    const zwei = await index.merken(datei.toUpperCase(), stand, false);
    expect(zwei.id).toBe(eins.id);
    expect(index.lesen()).toHaveLength(1);
    expect(windowsPfadSchluessel('C:\\Test\\A\\..\\Datei.scriptlab')).toBe(
      windowsPfadSchluessel('c:/test/DATEI.scriptlab'),
    );
  });
  test('meldet geänderte und fehlende Dateien, ohne Verweis oder lastOpened zu löschen', async () => {
    const datei = join(ordner, 'Projekt.scriptlab');
    const projekt = bearbeitet();
    await projektSchreiben(datei, projekt);
    const index = new Projektindex(join(ordner, 'bibliothek.json'));
    const eintrag = await index.merken(datei, await dateistandLesen(datei), true);
    expect((await index.verfuegbarkeit(eintrag.id)).zustand).toBe('verfuegbar');
    await projektSchreiben(datei, { ...projekt, name: 'Extern geändert' });
    expect((await index.verfuegbarkeit(eintrag.id)).zustand).toBe('geaendert');
    await rename(datei, join(ordner, 'Verschoben.scriptlab'));
    expect((await index.verfuegbarkeit(eintrag.id)).zustand).toBe('fehlt');
    expect(index.lesen()).toEqual([eintrag]);
    await index.entfernen(eintrag.id);
    expect(index.lesen()).toEqual([]);
    expect((await stat(join(ordner, 'Verschoben.scriptlab'))).isFile()).toBe(true);
  });
  test('erhält eine unbekannte neuere Indexversion bytegenau', async () => {
    const datei = join(ordner, 'bibliothek.json');
    const original = '{"schemaVersion":99,"projekte":[]}';
    await writeFile(datei, original);
    const index = new Projektindex(datei);
    await index.initialisieren();
    expect(index.hinweis).toContain('unverändert');
    const projektdatei = join(ordner, 'Projekt.scriptlab');
    await projektSchreiben(projektdatei, bearbeitet());
    await expect(index.merken(projektdatei, await dateistandLesen(projektdatei), true)).rejects.toThrow();
    expect(await readFile(datei, 'utf8')).toBe(original);
  });
  test('begrenzt eine nicht antwortende Metadatenabfrage', async () => {
    vi.useFakeTimers();
    const pruefung = expect(mitZeitlimit(new Promise(() => {}), 2500)).rejects.toThrow('nicht erreichbar');
    await vi.advanceTimersByTimeAsync(2500);
    await pruefung;
  });
  test('trennt manuell kopierte Projektdateien mit gleicher Datei-UUID und erhält beide Entwürfe', async () => {
    const originalDatei = join(ordner, 'Original.scriptlab');
    const kopieDatei = join(ordner, 'Manuelle-Kopie.scriptlab');
    const projekt = bearbeitet();
    await projektSchreiben(originalDatei, projekt);
    const dateibytes = await readFile(originalDatei);
    await writeFile(kopieDatei, dateibytes);
    const index = new Projektindex(join(ordner, 'bibliothek.json'));
    const a = await index.merken(originalDatei, await dateistandLesen(originalDatei), true);
    const b = await index.merken(kopieDatei, await dateistandLesen(kopieDatei), true);
    expect(a.projektKennung).toBe(projekt.projektKennung);
    expect(b.projektKennung).not.toBe(a.projektKennung);
    const nochmals = await index.merken(kopieDatei, await dateistandLesen(kopieDatei), true);
    expect(nochmals.projektKennung).toBe(b.projektKennung);
    const speicher = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    speicher.planen({ ...projekt, name: 'Ungespeicherter Stand A' }, originalDatei, a.hash);
    await speicher.flush();
    const aId = speicher.status(a.projektKennung).id!;
    const aBytes = await readFile(join(ordner, 'entwuerfe', `${aId}.json`));
    speicher.planen(
      { ...projekt, projektKennung: b.projektKennung, name: 'Ungespeicherter Stand B' },
      kopieDatei,
      b.hash,
    );
    await speicher.flush();
    expect(await speicher.liste()).toHaveLength(2);
    expect((await speicher.lesen(aId)).projekt.name).toBe('Ungespeicherter Stand A');
    expect(await readFile(join(ordner, 'entwuerfe', `${aId}.json`))).toEqual(aBytes);
    expect(await readFile(originalDatei)).toEqual(dateibytes);
    expect(await readFile(kopieDatei)).toEqual(dateibytes);
  });
});

describe('Lokale Entwürfe', () => {
  test('trennt leeres Projekt und reine Ansicht von relevanten Inhalten', () => {
    const leer = neuesProjekt();
    expect(leererEntwurf(leer)).toBe(true);
    const gezoomt = { ...leer, ansicht: { zoom: 1.5, x: 42, y: 24 } };
    expect(projektHash(gezoomt)).toBe(projektHash(leer));
    expect(leererEntwurf(gezoomt)).toBe(true);
    expect(leererEntwurf(bearbeitet())).toBe(false);
  });
  test('sichert echte vollständige Projektdaten erst nach 1,2 Sekunden mit stabiler Kennung', async () => {
    vi.useFakeTimers();
    const speicher = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    const projekt = bearbeitet();
    speicher.planen(projekt, null, null);
    const entwurfId = speicher.status(projekt.projektKennung!).id!;
    expect(speicher.status(projekt.projektKennung!).phase).toBe('ausstehend');
    await vi.advanceTimersByTimeAsync(1199);
    await expect(stat(join(ordner, 'entwuerfe'))).rejects.toMatchObject({ code: 'ENOENT' });
    const ansicht = { ...projekt, ansicht: { zoom: 1.5, x: -123, y: 456 } };
    speicher.ansichtAktualisieren(ansicht);
    await vi.advanceTimersByTimeAsync(1);
    await speicher.flush();
    const neu = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    const gelesen = await neu.lesen(entwurfId);
    expect(gelesen.projekt).toEqual(ansicht);
    expect(gelesen.id).toBe(entwurfId);
    expect(gelesen.id).not.toBe(projekt.projektKennung);
    expect(speicher.status(projekt.projektKennung!).phase).toBe('gesichert');
    expect((await neu.liste())[0].gesichertAm).toBe(gelesen.gesichertAm);
  });
  test('erhält Dateibezug und Baseline, ohne die Ausgangsdatei zu schreiben', async () => {
    const datei = join(ordner, 'Original.scriptlab');
    const projekt = bearbeitet();
    await projektSchreiben(datei, projekt);
    const original = await readFile(datei);
    const baseline = (await dateistandLesen(datei)).hash;
    const speicher = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    speicher.planen({ ...projekt, name: 'Gesicherte Änderungen' }, datei, baseline);
    const entwurfId = speicher.status(projekt.projektKennung!).id!;
    await speicher.flush();
    const gelesen = await speicher.lesen(entwurfId);
    expect(gelesen.ausgangspfad).toBe(datei);
    expect(gelesen.baselineHash).toBe(baseline);
    expect(gelesen.projekt.name).toBe('Gesicherte Änderungen');
    expect(await readFile(datei)).toEqual(original);
  });
  test('serialisiert parallele Sicherungen und lässt nach Verwerfen keinen Timerentwurf zurück', async () => {
    vi.useFakeTimers();
    const speicher = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    const projekt = bearbeitet();
    speicher.planen(projekt, null, null);
    const entwurfId = speicher.status(projekt.projektKennung!).id!;
    const erstes = speicher.flush();
    speicher.planen({ ...projekt, name: 'Neuester Stand' }, null, null);
    const zweites = speicher.flush();
    await Promise.all([erstes, zweites]);
    expect((await speicher.lesen(entwurfId)).projekt.name).toBe('Neuester Stand');
    speicher.planen({ ...projekt, name: 'Darf nicht wieder erscheinen' }, null, null);
    const schreiben = speicher.flush();
    const entfernen = speicher.entfernen(entwurfId);
    await Promise.all([schreiben, entfernen]);
    await vi.advanceTimersByTimeAsync(2400);
    await speicher.flush();
    expect(await speicher.liste()).toEqual([]);
  });
  test('überschreibt keine neuere Entwurfversion und meldet einen wiederholbaren Sicherungsfehler', async () => {
    const entwurfordner = join(ordner, 'entwuerfe');
    await mkdir(entwurfordner);
    const projekt = bearbeitet();
    const speicher = new Entwurfspeicher(entwurfordner);
    speicher.planen(projekt, null, null);
    const entwurfId = speicher.status(projekt.projektKennung!).id!;
    const datei = join(entwurfordner, `${entwurfId}.json`);
    const original = JSON.stringify({ schemaVersion: 99, projekt });
    await writeFile(datei, original);
    await expect(speicher.flush()).rejects.toThrow('nicht überschrieben');
    expect(speicher.status(projekt.projektKennung!).phase).toBe('fehler');
    expect(await readFile(datei, 'utf8')).toBe(original);
    expect(await speicher.liste()).toEqual([]);
    expect(speicher.hinweis).toContain('unverändert');
    await expect(speicher.entfernen(entwurfId)).rejects.toThrow();
    expect(await readFile(datei, 'utf8')).toBe(original);
  });
  test('prüft eine neue Projektkennung und erhält alte Projekte ohne Kennung lesbar', () => {
    const neu = neuesProjekt();
    expect(neu.projektKennung).toMatch(/^[a-f0-9-]{36}$/);
    expect(neuesProjekt().projektKennung).not.toBe(neu.projektKennung);
    const { projektKennung: _kennung, ...alt } = neu;
    expect(projektPruefen(alt).projektKennung).toBeUndefined();
    expect(() => projektPruefen({ ...neu, projektKennung: '../fremd' })).toThrow('Projektkennung');
  });
  test('erhält einen nicht ausgewählten Wiederherstellungsstand beim Öffnen der ursprünglichen Projektdatei', async () => {
    const projekt = bearbeitet();
    const datei = join(ordner, 'Original.scriptlab');
    await projektSchreiben(datei, projekt);
    const baseline = (await dateistandLesen(datei)).hash;
    const erster = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    erster.planen({ ...projekt, name: 'Vor einem Absturz' }, datei, baseline);
    await erster.flush();
    const alterId = erster.status(projekt.projektKennung!).id!;
    const alterStand = await erster.lesen(alterId);
    const zweiter = new Entwurfspeicher(join(ordner, 'entwuerfe'));
    zweiter.planen({ ...projekt, name: 'Original bewusst neu bearbeitet' }, datei, baseline);
    await zweiter.flush();
    const neuerId = zweiter.status(projekt.projektKennung!).id!;
    expect(neuerId).not.toBe(alterId);
    expect(await zweiter.lesen(alterId)).toEqual(alterStand);
    expect(await zweiter.liste()).toHaveLength(2);
    zweiter.wiederaufnahme(alterStand);
    zweiter.planen({ ...alterStand.projekt, name: 'Bewusst fortgesetzt' }, datei, baseline);
    await zweiter.flush();
    expect(zweiter.status(projekt.projektKennung!).id).toBe(alterId);
    expect((await zweiter.lesen(neuerId)).projekt.name).toBe('Original bewusst neu bearbeitet');
  });
});
