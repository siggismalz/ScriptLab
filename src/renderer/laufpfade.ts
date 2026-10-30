import type { BusinessDefinition } from '../kern/business-katalog';
import type { JsonWert } from '../kern/business-modell';
import { istQuellenfeld } from '../kern/quellenfeld';

type Pfadwert =
  | { art: 'bekannt'; text: string; pfad: string }
  | { art: 'fehlend' | 'parameter-fehlt' | 'berechnet' | 'ungueltig'; text: string };

export interface LaufPfadangabe {
  feldPfad: string[];
  titel: string;
  rolle: 'quelle' | 'ziel' | 'unbekannt';
  wert: Pfadwert;
}

/** Die Übersicht löst nur vorhandene Parameter auf, ohne Dateien zu prüfen oder Pfade zu berechnen. */
export function laufPfadwert(
  wert: JsonWert | undefined,
  parameter: Readonly<Record<string, JsonWert | undefined>>,
): Pfadwert {
  if (wert === undefined || wert === null || wert === '')
    return { art: 'fehlend', text: 'Noch nicht angegeben' };
  if (typeof wert === 'string') return { art: 'bekannt', text: wert, pfad: wert };
  if (typeof wert === 'object') {
    if (!Array.isArray(wert) && Object.keys(wert).length === 1 && typeof wert.parameter === 'string') {
      const vorhanden = parameter[wert.parameter];
      if (vorhanden === undefined || vorhanden === null || vorhanden === '')
        return { art: 'parameter-fehlt', text: `Parameter ${wert.parameter} ist nicht gesetzt` };
      return typeof vorhanden === 'string'
        ? { art: 'bekannt', text: vorhanden, pfad: vorhanden }
        : { art: 'ungueltig', text: `Parameter ${wert.parameter} enthält keinen Dateipfad` };
    }
    return { art: 'berechnet', text: 'Wird im betreffenden Schritt berechnet' };
  }
  return { art: 'ungueltig', text: 'Kein gültiger Dateipfad angegeben' };
}

export function laufPfadangaben(
  definition: BusinessDefinition,
  konfiguration: Record<string, JsonWert>,
  parameter: Readonly<Record<string, JsonWert | undefined>>,
): LaufPfadangabe[] {
  const rolle = (pfad: string[]): LaufPfadangabe['rolle'] =>
    istQuellenfeld(definition.typ, pfad, konfiguration)
      ? 'quelle'
      : definition.schreibt && pfad.length === 1 && /^(pfad|ziel|zielordner|archivordner)$/.test(pfad[0])
        ? 'ziel'
        : 'unbekannt';
  const angaben: LaufPfadangabe[] = definition.felder
    .filter((feld) => /pfad|quelle|ziel|vorlage|ordner/i.test(feld.name))
    .map((feld) => ({
      feldPfad: [feld.name],
      titel: feld.titel,
      rolle: rolle([feld.name]),
      wert: laufPfadwert(konfiguration[feld.name] ?? feld.standard, parameter),
    }));
  if (Array.isArray(konfiguration.abschnitte)) {
    konfiguration.abschnitte.forEach((abschnitt, index) => {
      const pfad = ['abschnitte', String(index), 'pfad'];
      if (
        abschnitt &&
        typeof abschnitt === 'object' &&
        !Array.isArray(abschnitt) &&
        istQuellenfeld(definition.typ, pfad, konfiguration)
      )
        angaben.push({
          feldPfad: pfad,
          titel: `Bild in Abschnitt ${index + 1}`,
          rolle: 'quelle',
          wert: laufPfadwert(abschnitt.pfad, parameter),
        });
    });
  }
  return angaben;
}

export function laufPfadZusammenfassung(angaben: LaufPfadangabe[]): { text: string; titel: string } {
  function gruppe(rolle: 'quelle' | 'ziel'): string | null {
    const alle = angaben.filter((angabe) => angabe.rolle === rolle);
    // Dieselbe bekannte Quelle kann in mehreren Schritten vorkommen.
    const gesehen = new Set<string>();
    const eindeutig = alle.filter(({ wert }) => {
      if (wert.art !== 'bekannt') return true;
      if (gesehen.has(wert.pfad)) return false;
      gesehen.add(wert.pfad);
      return true;
    });
    if (!eindeutig.length) return null;
    const erste = eindeutig.find((angabe) => angabe.wert.art === 'bekannt') ?? eindeutig[0];
    const kurz =
      erste.wert.art === 'bekannt'
        ? (erste.wert.pfad.split(/[\\/]/).filter(Boolean).at(-1) ?? erste.wert.pfad)
        : `${rolle === 'quelle' ? 'Quelle' : 'Ausgabeziel'} ${erste.wert.art === 'berechnet' ? 'wird berechnet' : 'noch offen'}`;
    const weitere = eindeutig.length - 1;
    return weitere
      ? `${kurz} + ${weitere} ${rolle === 'quelle' ? (weitere === 1 ? 'weitere Quelle' : 'weitere Quellen') : weitere === 1 ? 'weiteres Ziel' : 'weitere Ziele'}`
      : kurz;
  }
  return {
    text: [gruppe('quelle'), gruppe('ziel')].filter(Boolean).join(' → '),
    titel: angaben
      .map(
        ({ titel, wert, rolle }) =>
          `${rolle === 'quelle' ? 'Quelle' : rolle === 'ziel' ? 'Ausgabeziel' : 'Pfadangabe'} · ${titel}: ${wert.text}`,
      )
      .join('\n'),
  };
}
