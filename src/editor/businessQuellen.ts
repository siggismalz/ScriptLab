import * as Blockly from 'blockly/core';
import { businessNachTyp } from '../kern/business-katalog';
import { definitionNachTyp } from '../kern/katalog';
import type { FachlicherTyp } from '../kern/business-modell';

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
