import type { JsonWert } from '../kern/business-modell';

/** Objektzuordnungen behalten alle Werte, bis ein neuer Name vollständig geprüft ist. */
export function zuordnungUmbenennen(
  wert: Record<string, JsonWert>,
  bisher: string,
  neu: string,
): Record<string, JsonWert> {
  if (!Object.hasOwn(wert, bisher))
    throw new Error('Diese Zuordnung ist nicht mehr vorhanden. Öffne sie erneut.');
  if (!neu.trim()) throw new Error('Gib einen Namen ein.');
  if (neu.includes('\0') || neu.length > 32768)
    throw new Error('Der Name ist zu lang oder enthält ein unzulässiges Zeichen.');
  if (['__proto__', 'prototype', 'constructor'].includes(neu))
    throw new Error('Dieser Name kann in einer Zuordnung nicht verwendet werden. Wähle einen anderen Namen.');
  if (neu !== bisher && Object.hasOwn(wert, neu))
    throw new Error(`Der Name „${neu}“ ist bereits vorhanden. Wähle einen anderen Namen.`);
  // Führende und folgende Leerzeichen können zu einem echten Spaltennamen gehören.
  return Object.fromEntries(
    Object.entries(wert).map(([name, inhalt]) => [name === bisher ? neu : name, inhalt]),
  );
}

export function freierZuordnungsname(wert: Record<string, JsonWert>): string {
  let nummer = 1;
  while (Object.hasOwn(wert, `Feld${nummer}`)) nummer++;
  return `Feld${nummer}`;
}

/** Eine Vorschauauswahl ändert nur den gewählten Namen, niemals gespeicherte Wertbindungen. */
export function spaltenwahlAendern(werte: JsonWert[], name: string, ausgewaehlt: boolean): JsonWert[] {
  if (!ausgewaehlt) return werte.filter((wert) => wert !== name);
  return werte.includes(name) ? [...werte] : [...werte, name];
}

export function spalteVerschieben(werte: JsonWert[], index: number, richtung: -1 | 1): JsonWert[] {
  const ziel = index + richtung;
  if (!Number.isInteger(index) || index < 0 || index >= werte.length || ziel < 0 || ziel >= werte.length)
    return [...werte];
  const neu = [...werte];
  [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
  return neu;
}

export function spaltenvorschlaegeFiltern(vorschlaege: string[], suche: string): string[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  return [...new Set(vorschlaege)].filter((name) => name.toLocaleLowerCase('de').includes(filter));
}
