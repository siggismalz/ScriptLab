import { afterEach, describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../src/editor/bausteine';
import { dateipfadAufBlock } from '../src/editor/dateipfadAblage';

registriereBausteine();
const arbeitsbereiche: Blockly.Workspace[] = [];
afterEach(() => {
  for (const ws of arbeitsbereiche.splice(0)) ws.dispose();
});
function quelle(typ = 'sl_read_text') {
  const ws = new Blockly.Workspace();
  arbeitsbereiche.push(ws);
  const block = ws.newBlock(typ),
    text = ws.newBlock('sl_text');
  text.setFieldValue('Unveränderter Originalpfad.txt', 'TEXT');
  block.getInput('PFAD')!.connection!.connect(text.outputConnection!);
  return { block, text };
}
describe('Klassische Quellpfade beim Ablegen', () => {
  it('erhält die bestehende Verbindung und setzt ausschließlich das Textliteral', () => {
    const { block, text } = quelle();
    dateipfadAufBlock(text, 'C:\\Eigene Dateien\\Grüße.csv');
    expect(text.getFieldValue('TEXT')).toBe('C:\\Eigene Dateien\\Grüße.csv');
    expect(block.getInputTargetBlock('PFAD')).toBe(text);
  });
  it.each(['quelle', 'literal'] as const)('erhält ein ausdrücklich gesperrtes %s-Feld', (gesperrt) => {
    const { block, text } = quelle();
    (gesperrt === 'quelle' ? block : text).setEditable(false);
    expect(() => dateipfadAufBlock(text, 'C:\\Andere Datei.txt')).toThrow('nicht bearbeitbar');
    expect(text.getFieldValue('TEXT')).toBe('Unveränderter Originalpfad.txt');
  });
  it('verwendet einen Dateischreibpfad nicht als Quellziel', () => {
    const { block, text } = quelle('sl_write_text');
    expect(() => dateipfadAufBlock(block, 'C:\\Andere Datei.txt')).toThrow('Ausgabeziele');
    expect(text.getFieldValue('TEXT')).toBe('Unveränderter Originalpfad.txt');
  });
});
