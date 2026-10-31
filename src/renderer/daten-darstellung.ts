import { businessEingabeTitel, type BusinessDefinition, type KonfigFeld } from '../kern/business-katalog';
import type { BusinessSchritt } from '../kern/business-modell';

/** Nur ein Hinweis auf sichtbar mehrteilige CSV-Kopfzeilen, niemals eine automatische Umdeutung. */
export function csvTrennzeichenHinweis(
  schritt: Pick<BusinessSchritt, 'operation' | 'konfiguration'> | undefined,
  spalten: readonly { name: string }[],
): { eingestellt: string; auffaellig: string } | null {
  if (
    schritt?.operation !== 'daten.importieren' ||
    schritt.konfiguration.format !== 'CSV' ||
    spalten.length !== 1
  )
    return null;
  const optionen = schritt.konfiguration.optionen;
  if (!optionen || typeof optionen !== 'object' || Array.isArray(optionen) || optionen.kopfzeile === false)
    return null;
  const eingestellt = optionen.trennzeichen;
  if (typeof eingestellt !== 'string' || eingestellt.length !== 1) return null;
  const auffaellig = [';', ',', '\t', '|'].find((zeichen) => {
    if (zeichen === eingestellt) return false;
    const teile = spalten[0].name.split(zeichen);
    // Ein einzelnes Satzzeichen ist in einer normalen Spaltenbezeichnung nicht ungewöhnlich.
    return teile.length >= 3 && teile.every((teil) => teil.trim().length > 0);
  });
  return auffaellig ? { eingestellt, auffaellig } : null;
}

/** Lange Namen verbreitern eine Spalte maßvoll; bewusst eingestellte Breiten bleiben erhalten. */
export function vorschauSpaltenbreite(name: string, eingestellt?: number): number {
  return eingestellt === undefined || !Number.isFinite(eingestellt)
    ? Math.max(176, Math.min(320, 32 + name.length * 8))
    : Math.max(96, Math.min(640, eingestellt));
}

/** Kurze Verweise verwenden dieselben Feldnamen wie das Formular, keine Fehlermeldung als zweiten Fließtext. */
export function fehlerFeldverweis(
  definition: BusinessDefinition,
  pfad: readonly string[],
): { kurz: string; titel: string } | null {
  if (pfad[0] === 'eingaben' && pfad.length === 2 && definition.eingaben[pfad[1]]) {
    const titel = businessEingabeTitel(pfad[1], definition.eingaben[pfad[1]]);
    return { kurz: titel, titel };
  }
  if (pfad[0] !== 'konfiguration' || pfad.length < 2) return null;
  let felder = definition.felder;
  let feld: KonfigFeld | undefined;
  const kontext: string[] = [];
  const eintraege: number[] = [];
  for (const teil of pfad.slice(1)) {
    if (/^\d+$/.test(teil)) {
      if (feld?.art !== 'liste') return null;
      eintraege.push(Number(teil) + 1);
      kontext.push(`Eintrag ${Number(teil) + 1}`);
      continue;
    }
    feld = felder.find((f) => f.name === teil);
    if (!feld) return null;
    kontext.push(feld.titel);
    felder = feld.felder ?? [];
  }
  if (!feld) return null;
  const kurz = feld.name === 'konflikt' ? 'Vorhandenes Ziel' : feld.titel.replace(/\s*\([^)]*\)\s*$/, '');
  return { kurz: kurz + (eintraege.length ? ` · ${eintraege.join('.')}` : ''), titel: kontext.join(' · ') };
}

/** Originaltypen bleiben als Titel zugänglich; unbekannte oder zusammengesetzte Typen bleiben unverändert. */
export function vorschauTyptext(original: string): string {
  const typ = original.trim().toUpperCase();
  if (/^(VARCHAR|TEXT|STRING|CHAR(?:\(\d+\))?)$/.test(typ)) return 'Text';
  if (/^(?:U?(?:TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT)|INT)$/.test(typ)) return 'Ganze Zahl';
  if (/^(?:(?:DECIMAL|NUMERIC)(?:\(\s*\d+\s*,\s*\d+\s*\))?|DOUBLE|FLOAT|REAL)$/.test(typ))
    return 'Dezimalzahl';
  if (typ === 'DATE') return 'Datum';
  if (/^(?:TIMESTAMP(?:_S|_MS|_NS|TZ)?|TIMESTAMP WITH TIME ZONE|DATETIME)$/.test(typ))
    return 'Datum und Uhrzeit';
  if (/^(?:TIME|TIMETZ|TIME WITH TIME ZONE)$/.test(typ)) return 'Uhrzeit';
  if (typ === 'BOOLEAN' || typ === 'BOOL') return 'Ja/Nein';
  return original;
}
