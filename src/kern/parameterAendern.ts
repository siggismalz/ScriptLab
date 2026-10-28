import { businessNachTyp, businessDatenLesen } from './business-katalog';
import {
  businessProjektPruefen,
  type BusinessProjekt,
  type JsonWert,
  type WorkflowParameter,
} from './business-modell';
import type { EditorBlock, Projekt } from './projekt';

export interface ParameterBearbeitung {
  /** Neue Zeilen haben keinen Ursprungsnamen; dieser folgt niemals der Listenposition. */
  ursprungsname: string | null;
  parameter: WorkflowParameter;
}

export type ParameterUmbenennungen = Record<string, string>;

function namePruefen(name: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name))
    throw new Error(
      'Ein Parametername muss mit einem Buchstaben beginnen und darf bis zu 64 Buchstaben, Zahlen oder Unterstriche enthalten.',
    );
}

function umbenennungenPruefen(umbenennungen: ParameterUmbenennungen): Map<string, string> {
  const ziele = new Set<string>();
  const ergebnis = new Map<string, string>();
  for (const [vorher, nachher] of Object.entries(umbenennungen)) {
    namePruefen(vorher);
    namePruefen(nachher);
    if (ziele.has(nachher.toLowerCase()))
      throw new Error(`Mehrere Parameter können nicht gleichzeitig „${nachher}“ heißen.`);
    ziele.add(nachher.toLowerCase());
    if (vorher !== nachher) ergebnis.set(vorher, nachher);
  }
  return ergebnis;
}

/** Werte werden aus dem unveränderten Ausgangssatz gelesen; A↔B überschreibt keinen Wert. */
function satzUmbenennen(
  werte: BusinessProjekt['parametersaetze']['test'],
  umbenennungen: Map<string, string>,
): BusinessProjekt['parametersaetze']['test'] {
  if (!umbenennungen.size) return werte;
  const namen = new Set<string>();
  const eintraege = Object.entries(werte).map(([name, wert]) => {
    const ziel = umbenennungen.get(name) ?? name;
    if (namen.has(ziel.toLowerCase()))
      throw new Error(
        `Im Parametersatz würden mehrere Werte für „${ziel}“ zusammenfallen. Die Werte wurden nicht geändert.`,
      );
    namen.add(ziel.toLowerCase());
    return [ziel, wert] as const;
  });
  return Object.fromEntries(eintraege);
}

/** Bereitet Definitionen und gespeicherte Werte gemeinsam vor; Verweise folgen separat im Projekt. */
export function parameterAenderungenVorbereiten(
  business: BusinessProjekt,
  zeilen: readonly ParameterBearbeitung[],
): { business: BusinessProjekt; umbenennungen: ParameterUmbenennungen } {
  const namen = new Set<string>();
  const urspruenge = new Set<string>();
  const umbenennungen: ParameterUmbenennungen = {};
  for (const zeile of zeilen) {
    const name = zeile.parameter.name;
    namePruefen(name);
    if (namen.has(name.toLowerCase()))
      throw new Error(`Der Parametername „${name}“ wird mehrfach verwendet. Wähle eindeutige Namen.`);
    namen.add(name.toLowerCase());
    if (zeile.ursprungsname !== null) {
      if (
        urspruenge.has(zeile.ursprungsname) ||
        !business.parameter.some((p) => p.name === zeile.ursprungsname)
      )
        throw new Error(
          'Die ursprüngliche Parameterzuordnung ist nicht eindeutig. Öffne den Parameterdialog erneut.',
        );
      urspruenge.add(zeile.ursprungsname);
      if (zeile.ursprungsname !== name) umbenennungen[zeile.ursprungsname] = name;
    }
  }
  const zuordnung = umbenennungenPruefen(umbenennungen);
  const entfernt = new Set(business.parameter.filter((p) => !urspruenge.has(p.name)).map((p) => p.name));
  const satzVorbereiten = (werte: BusinessProjekt['parametersaetze']['test']) =>
    satzUmbenennen(
      Object.fromEntries(Object.entries(werte).filter(([name]) => !entfernt.has(name))),
      zuordnung,
    );
  return {
    business: businessProjektPruefen({
      ...business,
      parameter: zeilen.map((zeile) => zeile.parameter),
      parametersaetze: {
        test: satzVorbereiten(business.parametersaetze.test),
        echt: satzVorbereiten(business.parametersaetze.echt),
      },
    }),
    umbenennungen,
  };
}

/** Nur exakte Verweisobjekte ändern; freie Texte, Dateipfade und normale Blockdaten bleiben erhalten. */
export function parameterVerweiseUmbenennen(
  projekt: Projekt,
  umbenennungen: ParameterUmbenennungen,
): Projekt {
  const zuordnung = umbenennungenPruefen(umbenennungen);
  if (!zuordnung.size) return projekt;
  const neu = structuredClone(projekt);
  let projektGeaendert = false;
  const lesen = (block: EditorBlock): void => {
    if (businessNachTyp.has(block.type) && block.data) {
      // Bei beschädigten Daten abbrechen, statt möglicherweise ungebundene Verweise zu speichern.
      businessDatenLesen(block.type, block.data);
      const daten = JSON.parse(block.data) as { konfiguration: JsonWert; eingaben: JsonWert };
      let blockGeaendert = false;
      const ersetzen = (wert: JsonWert): JsonWert => {
        if (Array.isArray(wert)) return wert.map(ersetzen);
        if (wert !== null && typeof wert === 'object') {
          if (Object.keys(wert).length === 1 && typeof wert.parameter === 'string') {
            const name = zuordnung.get(wert.parameter);
            if (name !== undefined) {
              blockGeaendert = true;
              return { parameter: name };
            }
          }
          return Object.fromEntries(Object.entries(wert).map(([name, inhalt]) => [name, ersetzen(inhalt)]));
        }
        return wert;
      };
      const geaendert = {
        ...daten,
        konfiguration: ersetzen(daten.konfiguration),
        eingaben: ersetzen(daten.eingaben),
      };
      if (blockGeaendert) {
        block.data = JSON.stringify(geaendert);
        projektGeaendert = true;
      }
    }
    for (const eingang of Object.values(block.inputs ?? {})) {
      if (eingang.block) lesen(eingang.block);
      if (eingang.shadow) lesen(eingang.shadow);
    }
    if (block.next?.block) lesen(block.next.block);
  };
  neu.editor.blocks?.blocks.forEach(lesen);
  return projektGeaendert ? neu : projekt;
}
