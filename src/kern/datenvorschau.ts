import { businessDatenLesen, businessNachTyp } from './business-katalog';
import { projektPruefen, type Projekt, type EditorBlock } from './projekt';

const lesendeTabellenschritte = new Set([
  'daten.importieren',
  'daten.spalten',
  'daten.werte',
  'daten.filtern',
  'daten.sortieren',
  'daten.dubletten',
  'daten.vereinigen',
  'daten.verknuepfen',
  'daten.gruppieren',
  'daten.pruefen',
  'daten.vorschau',
]);

/** Eine ausdrücklich angeforderte Vorschau endet am gewählten Schritt, unabhängig von unfertigen Nachfolgern. */
export function datenvorschauProjekt(daten: Projekt, blockId: string): Projekt {
  const projekt = projektPruefen(structuredClone(daten));
  if (projekt.skriptsprache !== 'python')
    throw new Error('Die schrittweise Datenvorschau ist für Python-Tabellenschritte verfügbar.');
  const starts = projekt.editor.blocks?.blocks.filter((b) => b.type === 'sl_start') ?? [];
  if (starts.length !== 1)
    throw new Error('Die Datenvorschau benötigt genau einen verbundenen Workflowstart.');
  const start = starts[0];
  let block: EditorBlock | undefined = start.next?.block;
  const parameter = new Set<string>();
  function verweise(wert: unknown): void {
    if (!wert || typeof wert !== 'object') return;
    if (
      !Array.isArray(wert) &&
      Object.keys(wert).length === 1 &&
      typeof (wert as Record<string, unknown>).parameter === 'string'
    )
      parameter.add((wert as { parameter: string }).parameter);
    else Object.values(wert).forEach(verweise);
  }
  while (block) {
    const aktiv = block.enabled !== false && !block.disabledReasons?.length;
    const definition = businessNachTyp.get(block.type);
    if (aktiv && block.type !== 'sl_comment') {
      if (!definition || definition.steuerung || !lesendeTabellenschritte.has(definition.operation))
        throw new Error(
          'Die Vorschau unterstützt verbundene Tabellenschritte im Hauptablauf. Schleifen, Verzweigungen und Dateiaktionen davor lassen sich hier nicht als reine Datenvorschau prüfen.',
        );
      verweise(businessDatenLesen(block.type, block.data));
    }
    if (block.id === blockId) {
      if (!aktiv || definition?.ausgabe !== 'Tabelle')
        throw new Error('Wähle einen aktiven Baustein, der eine Tabelle bereitstellt.');
      delete block.next;
      projekt.editor.blocks!.blocks = [start];
      projekt.business.parameter = projekt.business.parameter.filter((p) => parameter.has(p.name));
      for (const satz of ['test', 'echt'] as const)
        projekt.business.parametersaetze[satz] = Object.fromEntries(
          Object.entries(projekt.business.parametersaetze[satz]).filter(([name]) => parameter.has(name)),
        );
      return projekt;
    }
    block = block.next?.block;
  }
  throw new Error(
    'Wähle einen verbundenen Tabellenschritt im Hauptablauf. Einzelschritte innerhalb von Schleifen und Verzweigungen benötigen ihren vollständigen Ausführungskontext.',
  );
}

export function datenvorschauHinweis(projekt: Projekt, blockId: string | null): string | null {
  if (!blockId) return 'Wähle den Tabellenschritt aus, dessen Ergebnis du prüfen möchtest.';
  try {
    datenvorschauProjekt(projekt, blockId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Dieser Schritt kann nicht einzeln geprüft werden.';
  }
}
