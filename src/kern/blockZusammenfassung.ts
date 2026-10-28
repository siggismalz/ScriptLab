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

function vergleichswert(wert: JsonWert | undefined): string {
  if (wert === null) return 'leer';
  if (typeof wert === 'string') return `„${wert}“`;
  if (typeof wert === 'number') return String(wert);
  if (typeof wert === 'boolean') return wert ? 'Ja' : 'Nein';
  const ausdruck = objekt(wert);
  if (ausdruck.art === 'wert' || (Object.hasOwn(ausdruck, 'typ') && Object.hasOwn(ausdruck, 'wert')))
    return vergleichswert(ausdruck.wert);
  return wertText(wert);
}

function filterText(wert: JsonWert | undefined): string {
  const bedingung = objekt(wert);
  if (bedingung.art !== 'vergleich') return '';
  const links = objekt(bedingung.links);
  const spalte = links.art === 'spalte' ? wertText(links.name) : wertText(bedingung.spalte);
  if (!spalte) return '';
  if (bedingung.operator === 'IST_LEER') return `${spalte} ist leer`;
  if (bedingung.operator === 'IST_NICHT_LEER') return `${spalte} ist nicht leer`;
  const operator = {
    EQ: '=',
    NE: '≠',
    GT: '>',
    GE: '≥',
    LT: '<',
    LE: '≤',
    ENTHAELT: 'enthält',
    BEGINNT: 'beginnt mit',
    ENDET: 'endet mit',
  }[String(bedingung.operator)];
  const rechts = vergleichswert(Object.hasOwn(bedingung, 'rechts') ? bedingung.rechts : bedingung.wert);
  return operator && rechts ? `${spalte} ${operator} ${rechts}` : '';
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
    if (def.operation === 'daten.filtern') {
      const vergleich = filterText(k.bedingung);
      if (vergleich) return kurz(vergleich);
    }
    if (def.operation === 'daten.gruppieren') {
      if (Array.isArray(k.schluessel)) {
        const spalten = k.schluessel.map((spalte) => wertText(spalte)).filter(Boolean);
        if (spalten.length) return kurz(`Nach ${spalten.join(', ')}`);
        if (k.schluessel.length === 0) return 'Gesamte Tabelle';
      }
    }
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
