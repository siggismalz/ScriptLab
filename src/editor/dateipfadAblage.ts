import type * as Blockly from 'blockly/core';
import { businessPfadSetzen } from './businessPfadFeld';

const quelleneingaenge: Record<string, string> = {
  sl_read_text: 'PFAD',
  sl_exists: 'PFAD',
  sl_list_files: 'PFAD',
  sl_foreach_file: 'PFAD',
  sl_basename: 'PFAD',
  sl_copy: 'QUELLE',
  sl_move: 'QUELLE',
  sl_rename: 'QUELLE',
};

/** Ein Drop verändert nur den ausdrücklich getroffenen Quellpfad, niemals eine Verbindung. */
export function dateipfadAufBlock(block: Blockly.Block, pfad: string): void {
  if (block.workspace.isReadOnly()) throw new Error('Stoppe den Lauf vor Änderungen am Dateipfad.');
  if (block.type.startsWith('sl_biz_')) {
    businessPfadSetzen(block, pfad);
    return;
  }
  const quelle = block.type === 'sl_text' ? block.getParent() : block;
  const eingang = quelle && quelleneingaenge[quelle.type];
  const literal = eingang ? quelle!.getInputTargetBlock(eingang) : null;
  if (!literal || literal.type !== 'sl_text' || (block.type === 'sl_text' && literal !== block))
    throw new Error(
      'Lege die Datei auf einen Quellbaustein oder dessen einfaches Pfad-Textfeld. Ausdrücke und Ausgabeziele bleiben unverändert.',
    );
  if (block.isInFlyout || !block.isEditable() || !quelle!.isEditable() || !literal.isEditable())
    throw new Error('Dieser Quellbaustein oder sein Pfadfeld ist nicht bearbeitbar.');
  literal.setFieldValue(pfad, 'TEXT');
}
