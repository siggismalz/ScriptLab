import { jsonSchreiben } from '../gemeinsam/json';
import type { ScriptLabBruecke, ScriptLabTransport } from '../gemeinsam/bruecke';

/** Daten vor der Weltgrenze serialisieren, dahinter wieder fachlich verwenden. */
export function brueckeVerbinden(transport: ScriptLabTransport): ScriptLabBruecke {
  const bruecke = Object.fromEntries(
    Object.entries(transport)
      .filter(([name]) => !['beiStandAnfrage', 'dateipfadAusDatei'].includes(name))
      .map(([name, aufrufen]) => [
        name,
        async (...argumente: unknown[]) => {
          // Optionale letzte Argumente bleiben ausgelassen statt zu JSON-null zu
          // werden (z. B. der Ausgabeindex beim Öffnen eines Laufberichts).
          while (argumente.length && argumente.at(-1) === undefined) argumente.pop();
          return JSON.parse(await (aufrufen as (text: string) => Promise<string>)(jsonSchreiben(argumente)));
        },
      ]),
  ) as unknown as ScriptLabBruecke;
  bruecke.beiStandAnfrage = (lesen) => transport.beiStandAnfrage(() => jsonSchreiben(lesen()));
  bruecke.dateipfadAusDatei = (datei) => transport.dateipfadAusDatei(datei);
  return Object.freeze(bruecke);
}
