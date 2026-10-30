import type { JsonWert } from '../kern/business-modell';

const objekt = (wert: JsonWert): Record<string, JsonWert> =>
  wert && typeof wert === 'object' && !Array.isArray(wert) ? wert : {};

/** UND und ODER ändern die bestehende Gruppe, statt sie wirkungslos zu umschließen. */
export function bedingungsGruppeSetzen(wert: JsonWert, art: 'UND' | 'ODER'): JsonWert {
  const gruppe = objekt(wert);
  return gruppe.art === 'UND' || gruppe.art === 'ODER' ? { ...gruppe, art } : { art, kinder: [wert] };
}

export function neuerVergleich(): JsonWert {
  return {
    art: 'vergleich',
    links: { art: 'spalte', name: '' },
    operator: 'EQ',
    rechts: { art: 'wert', typ: 'TEXT', wert: '' },
  };
}

/** Eine Gruppe mit mehreren Kindern lässt sich nicht verlustfrei auf einen Vergleich reduzieren. */
export function bedingungAufloesen(wert: JsonWert): JsonWert {
  const w = objekt(wert);
  if (w.art === 'NICHT' && w.kind !== undefined) return w.kind;
  if ((w.art === 'UND' || w.art === 'ODER') && Array.isArray(w.kinder) && w.kinder.length === 1)
    return w.kinder[0];
  return wert;
}

export function ausdruckArtSetzen(wert: JsonWert, art: string): JsonWert {
  const w = objekt(wert);
  if (w.art === art) return wert;
  if (art === 'funktion') return { art, funktion: 'JAHR', argument: wert };
  if (art === 'rechnen')
    return { art, operator: 'ADD', links: wert, rechts: { art: 'wert', typ: 'ZAHL', wert: 0 } };
  // Eine zuvor angewendete Funktion lässt sich zum unveränderten Argument zurückführen.
  if (w.art === 'funktion' && objekt(w.argument).art === art) return w.argument;
  if (art === 'spalte') return { art, name: '' };
  return { art: 'wert', typ: 'TEXT', wert: '' };
}

/** Nur passende feste Werte umwandeln; Bindungen und ungültige Tippwerte bleiben korrigierbar. */
export function literalTypSetzen(wert: JsonWert, typ: string): JsonWert {
  const w = objekt(wert);
  let inhalt = w.wert ?? null;
  if (inhalt !== null && typeof inhalt !== 'object') {
    if (typ === 'GANZZAHL' || typ === 'ZAHL') {
      const zahl = typeof inhalt === 'boolean' ? NaN : Number(String(inhalt).replace(',', '.'));
      if (String(inhalt).trim() && Number.isFinite(zahl) && (typ !== 'GANZZAHL' || Number.isInteger(zahl)))
        inhalt = zahl;
    } else if (typ === 'WAHRHEIT') {
      if (['true', 'wahr', 'ja'].includes(String(inhalt).toLowerCase())) inhalt = true;
      else if (['false', 'falsch', 'nein'].includes(String(inhalt).toLowerCase())) inhalt = false;
    } else inhalt = String(inhalt);
  }
  return { ...w, typ: typ === 'DEZIMAL' && objekt(w.typ).art === 'DEZIMAL' ? w.typ : typ, wert: inhalt };
}

/** Der Wechsel ändert die gewählte Prüfung, nicht ihre bisherigen Eingaben. */
export function pruefregelArtSetzen(wert: JsonWert, art: string): Record<string, JsonWert> {
  return { ...objekt(wert), art };
}

export function pruefregelZusammenfassung(wert: JsonWert): string {
  const w = objekt(wert);
  const namen: Record<string, string> = {
    NICHT_LEER: 'Pflichtwerte vorhanden',
    EINDEUTIG: 'Eindeutige Schlüssel',
    BEREICH: 'Wertebereich',
    TYP: 'Datentyp',
    ERLAUBTE_WERTE: 'Erlaubte Werte',
    ZEILENZAHL: 'Zeilenanzahl',
  };
  const spalten =
    w.art === 'EINDEUTIG' && Array.isArray(w.spalten) && w.spalten.length
      ? w.spalten
      : w.spalte
        ? [w.spalte]
        : [];
  return [
    namen[String(w.art)] ?? 'Gespeicherte Prüfregel',
    spalten.filter((s) => typeof s === 'string' && s.trim()).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}
