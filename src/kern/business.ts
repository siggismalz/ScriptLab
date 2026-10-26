import type { Projekt, EditorBlock } from './projekt';
import { businessNachTyp, businessDatenLesen } from './business-katalog';
import type { BusinessSchritt, Betriebsmodus } from './business-modell';
export function businessSchritte(projekt: Projekt): BusinessSchritt[] {
  const schritte: BusinessSchritt[] = [];
  const lesen = (b?: EditorBlock) => {
    if (!b) return;
    if (b.enabled !== false && !b.disabledReasons?.length) {
      const def = businessNachTyp.get(b.type);
      if (def) {
        try {
          schritte.push({ id: b.id, operation: def.operation, ...businessDatenLesen(b.type, b.data) });
        } catch {
          schritte.push({ id: b.id, operation: def.operation, konfiguration: {}, eingaben: {} });
        }
      }
      for (const e of Object.values(b.inputs ?? {})) lesen(e.block ?? e.shadow);
    }
    lesen(b.next?.block);
  };
  projekt.editor.blocks?.blocks.filter((b) => b.type === 'sl_start').forEach(lesen);
  return schritte;
}
export function businessModusPruefen(projekt: Projekt, modus: Betriebsmodus) {
  if (modus === 'ausfuehren') return;
  const lesen = (b?: EditorBlock) => {
    if (!b) return;
    if (b.enabled !== false && !b.disabledReasons?.length) {
      if (!['sl_start', 'sl_comment'].includes(b.type) && !businessNachTyp.has(b.type))
        throw new Error(
          'Vorschau und Prüflauf unterstützen hier ausschließlich Business-Schritte und Kommentare. Ein normaler Ablauf wird dabei niemals heimlich ausgeführt.',
        );
      for (const e of Object.values(b.inputs ?? {})) lesen(e.block ?? e.shadow);
    }
    lesen(b.next?.block);
  };
  projekt.editor.blocks?.blocks.filter((b) => b.type === 'sl_start').forEach(lesen);
}
