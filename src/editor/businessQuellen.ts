import * as Blockly from 'blockly/core';
import { businessDatenLesen, businessNachTyp } from '../kern/business-katalog';
import { definitionNachTyp } from '../kern/katalog';
import type { FachlicherTyp } from '../kern/business-modell';
import { BlockDatenEreignis } from './parameterEreignis';

/** Nur Ergebnisse, die an dieser Stelle unabhängig vom gewählten Zweig sicher vorliegen. */
export function businessQuellenVorBlock(
  ws: Blockly.Workspace,
  zielId: string,
  typ: FachlicherTyp,
): Blockly.Block[] {
  if (typeof ws.getTopBlocks !== 'function') return [];
  const starts = ws.getTopBlocks(false).filter((b) => b.type === 'sl_start' && b.isEnabled());
  if (starts.length !== 1) return [];
  let amZiel: Set<string> | null = null;
  const besucht = new Set<string>();
  const ablauf = (anfang: Blockly.Block | null, vorher: Set<string>): Set<string> => {
    let sicher = new Set(vorher);
    let block = anfang;
    while (block && !besucht.has(block.id)) {
      besucht.add(block.id);
      if (block.isEnabled()) {
        if (block.id === zielId) amZiel = new Set(sicher);
        if (businessNachTyp.has(block.type)) sicher.add(block.id);
        if (block.type === 'sl_if') {
          const dann = ablauf(block.getInputTargetBlock('DANN'), sicher);
          const sonst = ablauf(block.getInputTargetBlock('SONST'), sicher);
          sicher = new Set([...dann].filter((id) => sonst.has(id)));
        } else {
          for (const eingang of block.inputList)
            if (eingang.connection?.type === Blockly.ConnectionType.NEXT_STATEMENT)
              ablauf(eingang.connection.targetBlock(), sicher);
        }
        if (definitionNachTyp.get(block.type)?.form === 'ende') break;
      }
      block = block.getNextBlock();
    }
    return sicher;
  };
  ablauf(starts[0].getNextBlock(), new Set());
  return [...(amZiel ?? new Set<string>())]
    .map((id) => ws.getBlockById(id))
    .filter((block): block is Blockly.Block => {
      const definition = block && businessNachTyp.get(block.type);
      return Boolean(block && definition?.ausgabe === typ && !definition.steuerung);
    });
}

/** Nur beim neuen Einfügen aufrufen: vorhandene Zuordnungen bleiben eine bewusste Nutzerwahl. */
export function businessQuelleVorbelegen(block: Blockly.Block): void {
  const definition = businessNachTyp.get(block.type);
  if (!definition || !block.isEnabled()) return;
  const eingaben = Object.entries(definition.eingaben);
  // Bei zwei Tabellen ist die Rolle der Quellen fachlich zu entscheiden.
  if (eingaben.length !== 1) return;
  const [name, typ] = eingaben[0];
  const daten = businessDatenLesen(block.type, block.data ?? undefined);
  const eingabe = daten.eingaben[name];
  if (
    eingabe !== undefined &&
    eingabe !== null &&
    !(
      typeof eingabe === 'object' &&
      !Array.isArray(eingabe) &&
      Object.keys(eingabe).length === 1 &&
      eingabe.referenz === ''
    )
  )
    return;
  const quellen = businessQuellenVorBlock(block.workspace, block.id, typ);
  const vorgaenger = block.getPreviousBlock();
  const quelle = quellen.find((q) => q.id === vorgaenger?.id) ?? (quellen.length === 1 ? quellen[0] : null);
  if (!quelle) return;
  const vorher = block.data ?? null;
  block.data = JSON.stringify({
    ...daten,
    eingaben: { ...daten.eingaben, [name]: { referenz: quelle.id } },
  });
  Blockly.Events.fire(new BlockDatenEreignis(block, vorher, block.data));
}
