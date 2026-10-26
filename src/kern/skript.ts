import { vbsErzeugen, type GeneratorErgebnis, type GeneratorOptionen } from './generator';
import { pythonErzeugen } from './python-generator';
import { projektPruefen, type Projekt } from './projekt';

export type { GeneratorErgebnis, GeneratorOptionen } from './generator';

/** Vorschau, Export und Tests verwenden pro Sprache denselben Generator. */
export function skriptErzeugen(projekt: Projekt, optionen?: GeneratorOptionen): GeneratorErgebnis {
  try {
    const stand = projektPruefen(projekt);
    return stand.skriptsprache === 'python' ? pythonErzeugen(stand, optionen) : vbsErzeugen(stand, optionen);
  } catch (fehler) {
    return {
      code: null,
      zeilenZuordnung: [],
      meldungen: [
        { stufe: 'fehler', text: fehler instanceof Error ? fehler.message : 'Das Projekt ist ungültig.' },
      ],
    };
  }
}
