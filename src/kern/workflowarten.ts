import type { Projekt } from './projekt';
import type { Skriptsprache } from './sprachen';

export type WorkflowArt = 'allgemein' | 'ml';

export function workflowArtPruefen(wert: unknown): WorkflowArt {
  if (wert !== 'allgemein' && wert !== 'ml')
    throw new Error(
      'Diese Workflowart wird von ScriptLab nicht unterstützt. Die Projektdatei bleibt unverändert.',
    );
  return wert;
}

const mlDatenbausteine = new Set([
  'sl_start',
  'sl_comment',
  'sl_biz_lesen_csv',
  'sl_biz_lesen_xlsx',
  'sl_biz_schreiben_csv',
  'sl_biz_schreiben_xlsx',
  'sl_biz_spalten',
  'sl_biz_umbenennen',
  'sl_biz_typ',
  'sl_biz_berechnen',
  'sl_biz_ersetzen',
  'sl_biz_bereinigen',
  'sl_biz_leerwerte',
  'sl_biz_dubletten',
  'sl_biz_filtern',
  'sl_biz_sortieren',
  'sl_biz_vorschau',
  'sl_biz_ml_train',
  'sl_biz_ml_save',
  'sl_biz_ml_load',
  'sl_biz_ml_predict',
]);

/** Ein Vertrag für Palette, Suche, Einfügen und fachliche Prüfung. */
export function bausteinVerfuegbar(
  typ: string,
  sprache: Skriptsprache,
  art: WorkflowArt = 'allgemein',
): boolean {
  if (art === 'ml') return sprache === 'python' && mlDatenbausteine.has(typ);
  return !typ.startsWith('sl_biz_ml_') && (sprache === 'python' || !typ.startsWith('sl_biz_'));
}

/** Schema/Standardart allein ändern keine fachliche Identität bestehender Läufe. */
export function projektStandDaten(projekt: Projekt): Record<string, unknown> {
  const { ansicht: _ansicht, workflowArt, ...inhalt } = projekt;
  return workflowArt === 'allgemein' ? { ...inhalt, schemaVersion: 3 } : { ...inhalt, workflowArt };
}
