import { businessNachTyp } from './business-katalog';
import type { JsonWert } from './business-modell';

/** Dateiauswahl dient nur vorhandenen Quellen und Vorlagen, niemals einem Ausgabeziel. */
export function istQuellenfeld(
  typ: string,
  pfad: readonly string[],
  konfiguration: Record<string, JsonWert>,
): boolean {
  const def = businessNachTyp.get(typ);
  if (!def) return false;
  if (pfad.length === 1) {
    const name = pfad[0];
    if (!def.felder.some((f) => f.name === name)) return false;
    return (
      name === 'vorlage' ||
      name === 'quelle' ||
      name === 'ordner' ||
      (name === 'pfad' && def.operation === 'daten.importieren')
    );
  }
  if (
    def.operation === 'dokument.docx_erstellen' &&
    pfad.length === 3 &&
    pfad[0] === 'abschnitte' &&
    /^\d+$/.test(pfad[1]) &&
    pfad[2] === 'pfad'
  ) {
    const abschnitt = Array.isArray(konfiguration.abschnitte)
      ? konfiguration.abschnitte[Number(pfad[1])]
      : null;
    return Boolean(
      abschnitt && typeof abschnitt === 'object' && !Array.isArray(abschnitt) && abschnitt.art === 'BILD',
    );
  }
  return false;
}
