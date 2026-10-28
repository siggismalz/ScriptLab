import * as Blockly from 'blockly/core';
import * as deutscheTexte from 'blockly/msg/de';
import { bausteinDefinitionen } from '../kern/katalog';
import { deutscheErgaenzungen } from './deutsch';
import { blockStilNachKategorie } from '../gestaltung/blocklyThema';
import { Variablenfeld } from './variablenfeld';
import { blockZusammenfassung } from '../kern/blockZusammenfassung';

export const bausteinKatalog = bausteinDefinitionen.map(({ typ, name, kategorie, hilfe }) => ({
  typ,
  name,
  kategorie,
  hilfe,
}));

const reihenfolge: Record<string, string[]> = {
  sl_biz_stapel_schleife: ['NAME', 'VAR', 'ABLAUF'],
  sl_biz_fehlerbehandlung: ['NAME', 'ABLAUF', 'FEHLER'],
  sl_compare: ['A', 'OP', 'B'],
  sl_logic: ['A', 'OP', 'B'],
  sl_exists: ['ART', 'PFAD'],
  sl_foreach: ['VAR', 'LISTE', 'ABLAUF'],
  sl_foreach_file: ['VAR', 'PFAD', 'ABLAUF'],
  sl_set: ['VAR', 'WERT'],
  sl_list_add: ['WERT', 'VAR'],
  sl_case: ['ART', 'TEXT'],
  sl_math: ['A', 'OP', 'B'],
};
let registriert = false;
export function registriereBausteine(): void {
  if (registriert) return;
  // Das Paket typisiert einen Default-Export, liefert zur Laufzeit aber benannte Texte.
  Blockly.setLocale(
    Object.fromEntries(
      Object.entries(deutscheTexte).filter(([, wert]) => typeof wert === 'string'),
    ) as Record<string, string>,
  );
  Blockly.setLocale(deutscheErgaenzungen);
  Blockly.Extensions.register('scriptlab_business_kurztext', function () {
    const block = this;
    if (block.isInFlyout) return;
    const label = new Blockly.FieldLabel('', 'sl-blockzusammenfassung');
    block.appendDummyInput('SL_KURZTEXT').appendField(label);
    const aktualisieren = () => {
      const text = blockZusammenfassung(block.type, block.data, (id) => {
        const quelle = block.workspace.getBlockById(id);
        return quelle ? String(quelle.getFieldValue('NAME') ?? '') : undefined;
      });
      if (label.getValue() === text) return;
      Blockly.Events.disable();
      try {
        label.setValue(text);
      } finally {
        Blockly.Events.enable();
      }
    };
    block.setOnChange((ereignis) => {
      if (!ereignis.isUiEvent) aktualisieren();
    });
    aktualisieren();
  });
  Blockly.defineBlocksWithJsonArray(
    bausteinDefinitionen.map((def) => {
      const namen = reihenfolge[def.typ] ?? [
        ...def.eingaben.map((e) => e.name),
        ...def.felder.map((f) => f.name),
      ];
      const args = namen.map((name) => {
        const eingabe = def.eingaben.find((e) => e.name === name);
        if (eingabe)
          return {
            type: eingabe.typ === 'Statement' ? 'input_statement' : 'input_value',
            name,
            ...(eingabe.typ !== 'Any' && eingabe.typ !== 'Statement' ? { check: eingabe.typ } : {}),
          };
        const feld = def.felder.find((f) => f.name === name)!;
        if (feld.name === 'VAR')
          return { type: 'sl_variablenfeld', name, variable: String(feld.standard || 'Meine Variable') };
        if (feld.art === 'auswahl') return { type: 'field_dropdown', name, options: feld.optionen };
        if (feld.art === 'zahl')
          return {
            type: 'field_number',
            name,
            value: feld.standard,
            min: feld.min,
            max: feld.max,
            precision: 1,
          };
        return {
          type: 'field_input',
          name,
          text: String(feld.standard),
          spellcheck: def.typ === 'sl_text' || def.typ === 'sl_comment',
        };
      });
      return {
        type: def.typ,
        message0: def.nachricht,
        args0: args,
        style:
          def.typ === 'sl_delete'
            ? 'datei_loeschen'
            : blockStilNachKategorie[def.kategorie as keyof typeof blockStilNachKategorie],
        ...(def.typ.startsWith('sl_biz_') ? { extensions: ['scriptlab_business_kurztext'] } : {}),
        tooltip: def.hilfe,
        helpUrl: '',
        inputsInline: !def.eingaben.some((e) => e.typ === 'Statement'),
        ...(def.form === 'wert'
          ? { output: def.ausgabe === 'Any' ? null : def.ausgabe }
          : {
              ...(def.form !== 'start' ? { previousStatement: null } : {}),
              ...(def.form !== 'ende' ? { nextStatement: null } : {}),
            }),
      };
    }),
  );
  registriert = true;
  Blockly.fieldRegistry.register('sl_variablenfeld', Variablenfeld);
}

function schatten(typ: string): Record<string, unknown> {
  if (typ === 'Boolean') return { type: 'sl_bool', fields: { WERT: 'WAHR' } };
  if (typ === 'Number') return { type: 'sl_number', fields: { ZAHL: '5' } };
  if (typ === 'Array') return { type: 'sl_list' };
  return { type: 'sl_text', fields: { TEXT: 'Hallo' } };
}

export const werkzeugkasten: Blockly.utils.toolbox.ToolboxInfo = {
  kind: 'categoryToolbox',
  contents: [...new Set(bausteinDefinitionen.map((d) => d.kategorie))].map((kategorie) => ({
    kind: 'category',
    name: kategorie,
    colour: bausteinDefinitionen.find((d) => d.kategorie === kategorie)!.farbe,
    contents: bausteinDefinitionen
      .filter((d) => d.kategorie === kategorie)
      .map((def) => ({
        kind: 'block',
        type: def.typ,
        ...(def.eingaben.some((e) => e.typ !== 'Statement')
          ? {
              inputs: Object.fromEntries(
                def.eingaben
                  .filter((e) => e.typ !== 'Statement')
                  .map((e) => [e.name, { shadow: schatten(e.typ) }]),
              ),
            }
          : {}),
      })),
  })),
};
