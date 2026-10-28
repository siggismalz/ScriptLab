import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve, basename, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Laufablage, laufDateipfad } from '../src/main/laufablage';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import { TestlaufDienst } from '../src/windows/testlauf';
import { neuesProjekt } from '../src/kern/projekt';

const temporaer: string[] = [];
async function ordner() {
  const pfad = await mkdtemp(join(tmpdir(), 'ScriptLab-Laufablage-'));
  temporaer.push(pfad);
  return pfad;
}
afterEach(async () => {
  for (const pfad of temporaer.splice(0)) {
    if (
      !resolve(pfad).startsWith(resolve(tmpdir()) + sep) ||
      !basename(pfad).startsWith('ScriptLab-Laufablage-')
    )
      throw new Error('Unsicherer Testpfad.');
    await rm(pfad, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
function lauf(projektKennung = randomUUID(), sekunde = 1): TestZustand {
  return {
    ...testBereit(),
    laufId: randomUUID(),
    projektKennung,
    projektName: 'Testdaten – Monatslauf',
    skriptsprache: 'python',
    standHash: 'a'.repeat(64),
    phase: 'beendet',
    vorbereitetAm: '2026-10-28T10:00:00.000Z',
    gestartetAm: null,
    beendetAm: `2026-10-28T10:00:${String(sekunde).padStart(2, '0')}.000Z`,
    ausgabe: 'Ein tatsächlich gespeichertes Protokoll.',
    exitcode: 0,
  };
}
describe('Dauerhafte Laufablage', () => {
  it('wartet die Sicherungsqueue ab und bindet Details dauerhaft an den richtigen Workflow', async () => {
    const pfad = await ordner(),
      ablage = new Laufablage(pfad),
      zustand = lauf();
    const sicherung = ablage.sichern(zustand);
    const liste = await ablage.liste(zustand.projektKennung!);
    await sicherung;
    expect(liste.eintraege.map((e) => e.laufId)).toEqual([zustand.laufId]);
    expect(liste.eintraege[0]).not.toHaveProperty('ausgabe');
    const erneut = new Laufablage(pfad);
    expect((await erneut.lesen(zustand.projektKennung!, zustand.laufId!))?.ausgabe).toBe(zustand.ausgabe);
    expect(await erneut.lesen(randomUUID(), zustand.laufId!)).toBeNull();
  });
  it('liest zum Auflisten keine Detailprotokolle und meldet eine beschädigte Auswahl ehrlich', async () => {
    const pfad = await ordner(),
      ablage = new Laufablage(pfad),
      zustand = lauf();
    await ablage.sichern(zustand);
    await writeFile(join(pfad, 'details', `${zustand.laufId}.json`), '{kaputte Testdaten');
    const erneut = new Laufablage(pfad);
    expect((await erneut.liste(zustand.projektKennung!)).eintraege).toHaveLength(1);
    await expect(erneut.lesen(zustand.projektKennung!, zustand.laufId!)).rejects.toThrow('beschädigt');
    expect((await erneut.liste(zustand.projektKennung!)).hinweis).toContain('nicht gelesen');
  });
  it('begrenzt die Aufbewahrung und entfernt nur die eigenen ältesten Detaildateien', async () => {
    const pfad = await ordner(),
      ablage = new Laufablage(pfad, { anzahl: 2 }),
      id = randomUUID();
    const laeufe = [lauf(id, 1), lauf(id, 2), lauf(id, 3)];
    for (const zustand of laeufe) await ablage.sichern(zustand);
    expect((await ablage.liste(id)).eintraege.map((e) => e.laufId)).toEqual([
      laeufe[2].laufId,
      laeufe[1].laufId,
    ]);
    await expect(readFile(join(pfad, 'details', `${laeufe[0].laufId}.json`))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('überschreibt unbekannte Indexversionen nicht und verändert bei Schreibfehlern keinen Laufstatus', async () => {
    const pfad = await ordner(),
      index = join(pfad, 'index.json'),
      unbekannt = '{"schemaVersion":99,"eintraege":[]}';
    await writeFile(index, unbekannt);
    const gesperrt = new Laufablage(pfad),
      zustand = lauf();
    await gesperrt.sichern(zustand);
    expect(await readFile(index, 'utf8')).toBe(unbekannt);
    expect((await gesperrt.liste(zustand.projektKennung!)).hinweis).toContain('nicht vollständig gelesen');
    const defekt = await ordner(),
      ablage = new Laufablage(defekt);
    await ablage.laden();
    await mkdir(join(defekt, 'index.json'));
    await ablage.sichern(zustand);
    expect(zustand.phase).toBe('beendet');
    expect((await ablage.liste(zustand.projektKennung!)).hinweis).toContain('nicht dauerhaft gesichert');
  });
  it('erlaubt Dateiaktionen ausschließlich für bestätigte Ausgaben am Originalindex', async () => {
    const basis = await ordner(),
      zustand = lauf();
    zustand.optionen.basisVerzeichnis = basis;
    zustand.business = {
      schritt: null,
      ereignisse: [],
      vorschau: null,
      bericht: {
        bericht_pfad: 'Bericht.json',
        ausgaben: [
          { pfad: 'Nur-Geplant.csv', status: 'geplant' },
          { pfad: 'Ergebnis.csv', status: 'publiziert' },
        ],
      },
    };
    expect(() => laufDateipfad(zustand, 'ausgabe', 0)).toThrow('nicht als vorhandene Datei');
    expect(laufDateipfad(zustand, 'ausgabe', 1)).toBe(join(basis, 'Ergebnis.csv'));
    expect(laufDateipfad(zustand, 'bericht')).toBe(join(basis, 'Bericht.json'));
    expect(() => laufDateipfad(zustand, 'ausgabe', 2)).toThrow();
  });
  it('sichert auch einen echten Vorbereitungsfehler über den Abschlusscallback genau einmal', async () => {
    const pfad = await ordner(),
      ablage = new Laufablage(join(pfad, 'Historie'));
    let aufrufe = 0;
    const dienst = new TestlaufDienst(
      join(pfad, 'Fehlender-Testhost.exe'),
      join(pfad, 'Technik'),
      undefined,
      undefined,
      async (zustand) => {
        aufrufe++;
        await ablage.sichern(zustand);
      },
    );
    const projekt = neuesProjekt('python');
    projekt.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_output',
        id: 'nur-vorbereitung',
        inputs: {
          TEXT: {
            block: {
              type: 'sl_text',
              id: 'testtext',
              fields: { TEXT: 'Dieser Inhalt wird nicht ausgeführt.' },
            },
          },
        },
      },
    };
    dienst.starten(projekt, { basisVerzeichnis: pfad, zeitlimitSekunden: 10 });
    await expect.poll(() => dienst.aktiv()).toBe(false);
    expect((await ablage.liste(projekt.projektKennung!)).eintraege[0].phase).toBe('fehlgeschlagen');
    expect(aufrufe).toBe(1);
    expect(dienst.lesen().gestartetAm).toBeNull();
  });
});
