import { businessDatenLesen, businessNachTyp } from './business-katalog';
import type { Projekt, EditorBlock } from './projekt';
import { istQuellenfeld } from './quellenfeld';

/** Dateidialoge dienen ausschließlich Quellen; Ausgabeziele verbleiben in der verwalteten Ablage. */
export function quellenauswahlLesen(projekt: Projekt, blockId: string, feldPfad: string[]) {
  let gefunden: EditorBlock | undefined;
  function suchen(b: EditorBlock) {
    if (b.id === blockId) gefunden = b;
    Object.values(b.inputs ?? {}).forEach((e) => {
      if (e.block) suchen(e.block);
      if (e.shadow) suchen(e.shadow);
    });
    if (b.next?.block) suchen(b.next.block);
  }
  projekt.editor.blocks?.blocks.forEach(suchen);
  const def = gefunden && businessNachTyp.get(gefunden.type);
  if (!gefunden || !def) throw new Error('Wähle einen vorhandenen Business-Baustein aus.');
  const cfg = businessDatenLesen(gefunden.type, gefunden.data).konfiguration;
  const feld = feldPfad[0];
  const bild =
    feldPfad.length === 3 &&
    feld === 'abschnitte' &&
    /^\d{1,3}$/.test(feldPfad[1]) &&
    feldPfad[2] === 'pfad' &&
    Array.isArray(cfg.abschnitte) &&
    (cfg.abschnitte[Number(feldPfad[1])] as Record<string, unknown> | undefined)?.art === 'BILD';
  const erlaubt = istQuellenfeld(gefunden.type, feldPfad, cfg);
  if (!erlaubt)
    throw new Error(
      'Für dieses Feld ist keine Quelldateiauswahl vorgesehen. Ausgabeziele werden von ScriptLab verwaltet.',
    );
  const ordner = feld === 'ordner';
  let endungen = ['*'];
  if (bild) endungen = ['png', 'jpg', 'jpeg'];
  else if (def.operation === 'ml.laden') endungen = ['slmodell'];
  else if (feld === 'vorlage') endungen = [def.operation.includes('xlsx') ? 'xlsx' : 'docx'];
  else if (def.operation.includes('pdf') || def.operation === 'dateien.beleg_ablegen') endungen = ['pdf'];
  else if (def.operation === 'daten.importieren' && typeof cfg.format === 'string')
    endungen = [cfg.format.toLowerCase()];
  return {
    ordner,
    endungen,
    titel: ordner
      ? 'Eingangsordner auswählen'
      : bild
        ? 'Bilddatei auswählen'
        : feld === 'vorlage'
          ? 'Dokumentvorlage auswählen'
          : 'Quelldatei auswählen',
  };
}
