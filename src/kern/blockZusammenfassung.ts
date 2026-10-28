import { businessDatenLesen, businessNachTyp } from './business-katalog';
import type { JsonWert } from './business-modell';

const objekt = (wert: JsonWert | undefined): Record<string, JsonWert> =>
  wert && typeof wert === 'object' && !Array.isArray(wert) ? wert : {};

function kurz(text: string): string {
  const zeichen = Array.from(text.replace(/\s+/g, ' ').trim());
  return zeichen.length > 56 ? `${zeichen.slice(0, 55).join('')}…` : zeichen.join('');
}

function wertText(wert: JsonWert | undefined, dateiname = false): string {
  if (typeof wert === 'string') return dateiname ? (wert.split(/[\\/]/).filter(Boolean).at(-1) ?? '') : wert;
  const verweis = objekt(wert);
  if (Object.keys(verweis).length === 1 && typeof verweis.parameter === 'string')
    return `Parameter: ${verweis.parameter}`;
  if (Object.keys(verweis).length === 1 && typeof verweis.variable === 'string') return 'Variable';
  return '';
}

/** Abgeleitete Anzeige; wird weder als Feldwert noch in den Projektdateien gespeichert. */
export function blockZusammenfassung(
  typ: string,
  data?: string | null,
  quellname: (id: string) => string | undefined = () => undefined,
): string {
  const def = businessNachTyp.get(typ);
  if (!def) return '';
  try {
    const { konfiguration: k, eingaben } = businessDatenLesen(typ, data ?? undefined);
    const quellen = Object.values(eingaben)
      .map((wert) => objekt(wert).referenz)
      .filter((id): id is string => typeof id === 'string' && Boolean(id))
      .map((id) => quellname(id) || 'Gewählte Tabelle');
    if (def.operation === 'daten.importieren') {
      const pfad = wertText(k.pfad, true);
      const blatt = wertText(objekt(k.optionen).blatt);
      return kurz(pfad ? `${pfad}${blatt ? ` · ${blatt}` : ''}` : 'Quelldatei auswählen');
    }
    if (def.operation === 'daten.exportieren')
      return kurz(`→ ${wertText(k.pfad, true) || 'Ausgabedatei festlegen'}`);
    if (k.vorlage !== undefined)
      return kurz(wertText(k.vorlage, true) ? `Vorlage: ${wertText(k.vorlage, true)}` : 'Vorlage auswählen');
    if (k.quelle !== undefined)
      return kurz(
        `${wertText(k.quelle, true) || 'Quelle auswählen'}${k.ziel ? ` → ${wertText(k.ziel, true)}` : ''}`,
      );
    if (quellen.length > 1) {
      const schluessel = Array.isArray(k.schluessel)
        ? k.schluessel.map((s) => wertText(objekt(s).links)).filter(Boolean)
        : [];
      return kurz(`${quellen.join(' ↔ ')}${schluessel.length ? ` · ${schluessel.join(', ')}` : ''}`);
    }
    if (Array.isArray(k.spalten) && k.spalten.length)
      return kurz(
        k.spalten
          .map((s) => wertText(s))
          .filter(Boolean)
          .join(', ') || `${k.spalten.length} Spalten`,
      );
    for (const feld of ['ordner', 'titel', 'spalte', 'dateiname', 'muster']) {
      const text = wertText(k[feld], feld === 'ordner');
      if (text) return kurz(text);
    }
    return kurz(quellen.length ? `Aus: ${quellen[0]}` : 'Einstellungen ergänzen');
  } catch {
    return 'Einstellungen prüfen';
  }
}
