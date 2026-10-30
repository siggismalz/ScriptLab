/** Kompaktes JSON für reine Daten, ohne rekursive Aufrufe für Blockly-Ketten.
 * Schlüsselreihenfolge und primitive Werte entsprechen JSON.stringify.
 */
export function jsonSchreiben(wert: unknown): string {
  type Auftrag = { wert: unknown } | { text: string } | { ende: object };
  const auftraege: Auftrag[] = [{ wert }];
  const teile: string[] = [];
  const vorfahren = new Set<object>();
  while (auftraege.length) {
    const auftrag = auftraege.pop()!;
    if ('text' in auftrag) {
      teile.push(auftrag.text);
      continue;
    }
    if ('ende' in auftrag) {
      vorfahren.delete(auftrag.ende);
      continue;
    }
    const daten = auftrag.wert;
    if (daten === null || typeof daten !== 'object') {
      const text = JSON.stringify(daten);
      if (text === undefined) throw new TypeError('Es werden ausschließlich JSON-Daten unterstützt.');
      teile.push(text);
      continue;
    }
    if (vorfahren.has(daten)) throw new TypeError('Zyklische Daten können nicht gespeichert werden.');
    vorfahren.add(daten);
    const liste = Array.isArray(daten);
    if (!liste && Object.prototype.toString.call(daten) !== '[object Object]')
      throw new TypeError('Es werden ausschließlich JSON-Objekte und Listen unterstützt.');
    const eintraege: [string, unknown][] = liste
      ? Array.from(daten, (w, i) => [String(i), w ?? null])
      : Object.entries(daten).filter(([, w]) => w !== undefined);
    teile.push(liste ? '[' : '{');
    auftraege.push({ ende: daten }, { text: liste ? ']' : '}' });
    for (let i = eintraege.length - 1; i >= 0; i--) {
      const [name, inhalt] = eintraege[i];
      auftraege.push({ wert: inhalt });
      if (!liste) auftraege.push({ text: JSON.stringify(name) + ':' });
      if (i > 0) auftraege.push({ text: ',' });
    }
  }
  return teile.join('');
}
