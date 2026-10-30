import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Einstellungen } from '../src/gemeinsam/bruecke';
import { neuesProjekt } from '../src/kern/projekt';

function kontrolliert<T>() {
  let freigeben!: (wert: T) => void;
  let ablehnen!: (fehler: Error) => void;
  const ergebnis = new Promise<T>((ja, nein) => {
    freigeben = ja;
    ablehnen = nein;
  });
  return { ergebnis, freigeben, ablehnen };
}

/** Echte Main-Funktion und echte Settings-/Neu-Handler, ohne Electron oder Dateizugriff. */
function mainEinstellungen() {
  const quelle = readFileSync(new URL('../src/main/hauptprozess.ts', import.meta.url), 'utf8');
  const teil = (anfang: string, ende: string) => {
    const a = quelle.indexOf(anfang),
      b = quelle.indexOf(ende, a);
    if (a < 0 || b < a) throw new Error(`Der tatsächliche Main-Abschnitt fehlt: ${anfang}`);
    return quelle.slice(a, b);
  };
  const code = transformSync(
    [
      teil('const einstellungenSchema =', '\nlet businessStatus'),
      teil('let einstellungsSchreibfolge:', '\nfunction darstellungUebernehmen('),
      teil("  registrieren('neu',", "  registrieren('oeffnen',"),
      teil("  registrieren('einstellungen',", "  registrieren('python-status',"),
      'globalThis.pruefung = { lesen: () => einstellungen };',
    ].join('\n'),
    { loader: 'ts' },
  ).code;

  const anfragen = Array.from({ length: 3 }, () => ({
    begonnen: kontrolliert<void>(),
    fertig: kontrolliert<void>(),
  }));
  const projektschutz = { begonnen: kontrolliert<void>(), fertig: kontrolliert<boolean>() };
  const handler = new Map<string, (daten: unknown) => Promise<unknown>>();
  let geschrieben: Einstellungen;
  let aktiveSchreibvorgaenge = 0,
    maximaleParallelitaet = 0;
  const atomarSchreiben = vi.fn(async (_pfad: string, inhalt: string) => {
    const probe = anfragen[atomarSchreiben.mock.calls.length - 1];
    if (!probe) throw new Error('Unerwarteter zusätzlicher Schreibvorgang.');
    aktiveSchreibvorgaenge++;
    maximaleParallelitaet = Math.max(maximaleParallelitaet, aktiveSchreibvorgaenge);
    probe.begonnen.freigeben();
    try {
      await probe.fertig.ergebnis;
      geschrieben = JSON.parse(inhalt) as Einstellungen;
    } finally {
      aktiveSchreibvorgaenge--;
    }
  });
  const darstellungUebernehmen = vi.fn();
  const kontext = {
    z,
    atomarSchreiben,
    einstellungsPfad: () => 'isolierte-einstellungen.json',
    darstellungUebernehmen,
    aktualisierungen: { vorabversionenSetzen: vi.fn() },
    registrieren: (kanal: string, funktion: (daten: unknown) => Promise<unknown>) =>
      handler.set(kanal, funktion),
    mitDialog: (funktion: () => Promise<unknown>) => funktion(),
    uebernehmen: vi.fn(),
    aenderungenSichern: () => {
      projektschutz.begonnen.freigeben();
      return projektschutz.fertig.ergebnis;
    },
    verworfenenEntwurfBereinigen: async () => {},
    projektAktivieren: vi.fn(),
    neuesProjekt,
    dokument: () => ({}),
    pruefung: undefined as unknown as { lesen: () => Einstellungen },
  };
  runInNewContext(code, kontext);
  const lesen = () => JSON.parse(JSON.stringify(kontext.pruefung.lesen())) as Einstellungen;
  geschrieben = lesen();
  return {
    lesen,
    gespeichert: () => geschrieben,
    speichern: (daten: Einstellungen) => handler.get('einstellungen')!(daten),
    neu: () => handler.get('neu')!({ projekt: neuesProjekt('vbs'), sprache: 'python' }),
    anfragen,
    projektschutz,
    atomarSchreiben,
    darstellungUebernehmen,
    parallelitaet: () => maximaleParallelitaet,
  };
}

describe('Einstellungen beim unmittelbar folgenden Workflowwechsel erhalten', () => {
  it('behält Textgröße 2 und anschließende Sprachwahl ohne parallele Schreibvorgänge', async () => {
    const main = mainEinstellungen();
    const ausgang = main.lesen();
    expect(ausgang.textSkalierung).toBe(1);
    const einstellung = main.speichern({ ...ausgang, textSkalierung: 2 });
    await main.anfragen[0].begonnen.ergebnis;
    const workflow = main.neu();
    await main.projektschutz.begonnen.ergebnis;
    main.projektschutz.fertig.freigeben(true);
    // Der echte Neu-Handler darf jetzt seinen Speicherauftrag einreihen, während
    // die erste atomare Speicherung gezielt noch offen bleibt.
    await Promise.resolve();
    expect(main.atomarSchreiben).toHaveBeenCalledTimes(1);
    expect(main.lesen()).toEqual(ausgang);

    main.anfragen[0].fertig.freigeben();
    await einstellung;
    await main.anfragen[1].begonnen.ergebnis;
    const sprachstand = JSON.parse(main.atomarSchreiben.mock.calls[1][1]) as Einstellungen;
    expect(sprachstand).toEqual({ ...ausgang, textSkalierung: 2, letzteSkriptsprache: 'python' });
    expect(main.lesen()).toEqual({ ...ausgang, textSkalierung: 2 });
    main.anfragen[1].fertig.freigeben();
    await workflow;
    expect(main.lesen()).toEqual(sprachstand);
    expect(main.gespeichert()).toEqual(sprachstand);
    expect(main.parallelitaet()).toBe(1);
    expect(main.darstellungUebernehmen).toHaveBeenCalledTimes(2);
  });

  it('erhält bei Schreibfehler den alten Stand und verarbeitet wartende sowie spätere Änderungen', async () => {
    const main = mainEinstellungen();
    const ausgang = main.lesen();
    const fehler = new Error('Gezielt simulierter Schreibfehler.');
    const einstellung = main.speichern({ ...ausgang, textSkalierung: 2 });
    const abgelehnt = expect(einstellung).rejects.toBe(fehler);
    await main.anfragen[0].begonnen.ergebnis;
    const workflow = main.neu();
    await main.projektschutz.begonnen.ergebnis;
    main.projektschutz.fertig.freigeben(true);
    await Promise.resolve();
    expect(main.atomarSchreiben).toHaveBeenCalledTimes(1);
    main.anfragen[0].fertig.ablehnen(fehler);
    await abgelehnt;
    await main.anfragen[1].begonnen.ergebnis;
    expect(main.lesen()).toEqual(ausgang);
    expect(main.gespeichert()).toEqual(ausgang);
    expect(main.darstellungUebernehmen).not.toHaveBeenCalled();

    main.anfragen[1].fertig.freigeben();
    await workflow;
    expect(main.lesen()).toEqual({ ...ausgang, letzteSkriptsprache: 'python' });
    const spaeter = main.speichern({ ...main.lesen(), textSkalierung: 1.5 });
    await main.anfragen[2].begonnen.ergebnis;
    main.anfragen[2].fertig.freigeben();
    await spaeter;
    expect(main.gespeichert()).toEqual({ ...ausgang, letzteSkriptsprache: 'python', textSkalierung: 1.5 });
    expect(main.lesen()).toEqual(main.gespeichert());
    expect(main.parallelitaet()).toBe(1);
    expect(main.darstellungUebernehmen).toHaveBeenCalledTimes(2);
  });
});
