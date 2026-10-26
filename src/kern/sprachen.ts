export type Skriptsprache = 'python' | 'vbs';

/** Anzeige und Dateiformat bleiben an einer Stelle zusammen. */
export const sprachdaten = {
  python: {
    bezeichnung: 'Python',
    kurzbezeichnung: 'Python',
    dateiendung: 'py',
    exportAktion: 'Python-Script exportieren',
    vorschauTitel: 'Python-Code',
  },
  vbs: {
    bezeichnung: 'VBScript (VBS)',
    kurzbezeichnung: 'VBS',
    dateiendung: 'vbs',
    exportAktion: 'VBS-Script exportieren',
    vorschauTitel: 'VBS-Code',
  },
} as const;

export function sprachePruefen(wert: unknown): Skriptsprache {
  if (wert !== 'python' && wert !== 'vbs')
    throw new Error('Die gespeicherte Scriptsprache ist ungültig oder wird nicht unterstützt.');
  return wert;
}
