import * as Blockly from 'blockly/core';
import { afterEach, describe, expect, it } from 'vitest';
import { registriereBausteine } from '../src/editor/bausteine';
import { businessPfadFeld, businessPfadFeldname, businessPfadSetzen } from '../src/editor/businessPfadFeld';
import { businessDatenLesen } from '../src/kern/business-katalog';
import { eigenschaftenLesen, eigenschaftSetzen } from '../src/editor/eigenschaften';
import { neuesProjekt, projektPruefen } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';

registriereBausteine();
const workspaces: Blockly.Workspace[] = [];
const tick = () => new Promise<void>((fertig) => setTimeout(fertig, 0));
function workspace() {
  const ws = new Blockly.Workspace();
  workspaces.push(ws);
  return ws;
}
function daten(block: Blockly.Block) {
  return businessDatenLesen(block.type, block.data ?? undefined);
}

afterEach(() => {
  for (const ws of workspaces.splice(0)) ws.dispose();
  Blockly.Events.setGroup(false);
});

describe('Echter Quellenpfad statt versehentlich bearbeiteter Bezeichnung', () => {
  it.each([
    'sl_biz_lesen_csv',
    'sl_biz_lesen_xlsx',
    'sl_biz_lesen_json',
    'sl_biz_lesen_parquet',
    'sl_biz_ml_load',
  ])('bietet %s genau eine echte Quelle und ein separates Pfadfeld an', (typ) => {
    const block = workspace().newBlock(typ);
    expect(businessPfadFeld(block)).toMatchObject({ name: 'pfad' });
    expect(block.getField(businessPfadFeldname)).not.toBeNull();
    expect(block.getField(businessPfadFeldname)!.isSerializable()).toBe(false);
    expect(block.getField('NAME')).toBeInstanceOf(Blockly.FieldLabelSerializable);
    expect(block.getField('NAME')!.isCurrentlyEditable()).toBe(false);
    expect(block.getField('NAME')!.isSerializable()).toBe(true);
  });

  it('deutet einen alten Pfad im Namen nicht um und erhält das Umbenennen über Eigenschaften', async () => {
    const ws = workspace();
    const block = ws.newBlock('sl_biz_lesen_csv');
    block.setFieldValue('C:\\Eigene Daten\\alter Name.csv', 'NAME');
    await tick();
    expect(daten(block).konfiguration.pfad).toBe('');
    expect(block.getFieldValue(businessPfadFeldname)).toBe('');
    expect(block.getField(businessPfadFeldname)!.getText()).toBe('Pfad eingeben');
    const name = eigenschaftenLesen(ws, block.id).find((f) => f.feldName === 'NAME');
    expect(name).toMatchObject({ beschriftung: 'Bausteinname', wert: 'C:\\Eigene Daten\\alter Name.csv' });
    eigenschaftSetzen(ws, block.id, 'NAME', 'Kundenstamm lesen');
    expect(block.getFieldValue('NAME')).toBe('Kundenstamm lesen');
    expect(daten(block).konfiguration.pfad).toBe('');
  });

  it('schreibt Inlineeingaben mit Sonderzeichen ausschließlich in die fachliche Quelle und erhält Undo/Redo', async () => {
    const ws = workspace();
    const block = ws.newBlock('sl_biz_lesen_csv');
    block.setFieldValue('Kundenstamm lesen', 'NAME');
    await tick();
    const vorher = block.data;
    ws.clearUndo();
    const pfad = "C:\\Meine Daten\\Grüße & Umsatz '24.csv";
    block.setFieldValue(pfad, businessPfadFeldname);
    await tick();
    expect(daten(block).konfiguration.pfad).toBe(pfad);
    expect(block.getFieldValue('NAME')).toBe('Kundenstamm lesen');
    expect(block.getFieldValue(businessPfadFeldname)).toBe(pfad);
    ws.undo(false);
    await tick();
    expect(block.data).toBe(vorher);
    expect(block.getFieldValue(businessPfadFeldname)).toBe('');
    expect(block.getFieldValue('NAME')).toBe('Kundenstamm lesen');
    ws.undo(true);
    await tick();
    expect(daten(block).konfiguration.pfad).toBe(pfad);
    expect(block.getFieldValue(businessPfadFeldname)).toBe(pfad);
  });

  it('ordnet reine Pfadänderungen derselben bereits geöffneten Gruppe zu und verwirft keine Optionen', async () => {
    const ws = workspace();
    const block = ws.newBlock('sl_biz_lesen_csv');
    block.data = JSON.stringify({
      konfiguration: { format: 'CSV', pfad: 'vorher.csv', optionen: { trennzeichen: '|', kopfzeile: false } },
      eingaben: {},
    });
    await tick();
    const vorher = block.data;
    ws.clearUndo();
    Blockly.Events.setGroup(true);
    const gruppe = Blockly.Events.getGroup();
    businessPfadSetzen(block, 'nachher.csv');
    block.setFieldValue('Neuer Name', 'NAME');
    expect(Blockly.Events.getGroup()).toBe(gruppe);
    Blockly.Events.setGroup(false);
    await tick();
    expect(daten(block).konfiguration.optionen).toEqual({ trennzeichen: '|', kopfzeile: false });
    ws.undo(false);
    await tick();
    expect(block.data).toBe(vorher);
    expect(block.getFieldValue('NAME')).toBe('CSV-Tabelle lesen');
    expect(block.getFieldValue(businessPfadFeldname)).toBe('vorher.csv');
    ws.undo(true);
    await tick();
    expect(daten(block).konfiguration.pfad).toBe('nachher.csv');
    expect(block.getFieldValue('NAME')).toBe('Neuer Name');
  });

  it.each(['parameter', 'variable'] as const)(
    'bewahrt eine %s-Bindung und lehnt auch Dateidrop-Ersatz ab',
    async (art) => {
      const block = workspace().newBlock('sl_biz_lesen_csv');
      block.data = JSON.stringify({ konfiguration: { pfad: { [art]: 'Eingang' } }, eingaben: {} });
      await tick();
      const vorher = block.data;
      expect(businessPfadFeld(block)).toMatchObject({ name: 'pfad' });
      expect(block.getField(businessPfadFeldname)!.isCurrentlyEditable()).toBe(false);
      expect(block.getFieldValue(businessPfadFeldname)).toContain(
        art === 'parameter' ? 'Parameter: Eingang' : 'Variable',
      );
      expect(() => businessPfadSetzen(block, 'nicht-ersetzen.csv')).toThrow('Daten und Parameter');
      expect(block.data).toBe(vorher);
      const gespeichert = Blockly.serialization.workspaces.save(block.workspace);
      const kopie = workspace();
      Blockly.serialization.workspaces.load(gespeichert, kopie);
      await tick();
      expect(daten(kopie.getBlockById(block.id)!).konfiguration.pfad).toEqual({ [art]: 'Eingang' });
    },
  );

  it('serialisiert keinen zweiten Pfad und erzeugt nach erneutem Laden dieselbe fachliche Quelle', async () => {
    const ws = workspace();
    const start = ws.newBlock('sl_start');
    const block = ws.newBlock('sl_biz_lesen_csv');
    start.nextConnection!.connect(block.previousConnection!);
    block.setFieldValue('Führende Nullen einlesen', 'NAME');
    businessPfadSetzen(block, 'Eingang ä\\Kunden 001.csv');
    await tick();
    const gespeichert = Blockly.serialization.workspaces.save(ws);
    const gespeichertBlock = gespeichert.blocks.blocks[0].next.block;
    expect(gespeichertBlock.fields).toEqual({ NAME: 'Führende Nullen einlesen' });
    const projekt = neuesProjekt('python');
    projekt.editor = gespeichert;
    const geprueft = projektPruefen(JSON.parse(JSON.stringify(projekt)));
    const code = skriptErzeugen(geprueft);
    expect(code.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(code.code).toContain('Kunden 001.csv');
    const kopie = workspace();
    Blockly.serialization.workspaces.load(geprueft.editor, kopie);
    await tick();
    const geladen = kopie.getBlockById(block.id)!;
    expect(geladen.getFieldValue('NAME')).toBe('Führende Nullen einlesen');
    expect(geladen.getFieldValue(businessPfadFeldname)).toBe('Eingang ä\\Kunden 001.csv');
    expect(daten(geladen)).toEqual(daten(block));
  });

  it('rät bei Ausgaben, Listen oder mehreren realen Dokumentquellen nicht', () => {
    for (const typ of ['sl_biz_schreiben_csv', 'sl_biz_ml_save', 'sl_biz_pdf_verbinden', 'sl_text']) {
      const block = workspace().newBlock(typ);
      expect(businessPfadFeld(block)).toBeNull();
      expect(block.getField(businessPfadFeldname)).toBeNull();
    }
    expect(
      businessPfadFeld({
        type: 'sl_biz_docx_erstellen',
        data: JSON.stringify({
          konfiguration: {
            ziel: 'a.docx',
            abschnitte: [
              { art: 'BILD', pfad: 'b.png' },
              { art: 'BILD', pfad: 'c.png' },
            ],
          },
          eingaben: {},
        }),
      }),
    ).toBeNull();
  });

  it('lässt beschädigte oder gesperrte Daten und ungültige Pfade unverändert', () => {
    const block = workspace().newBlock('sl_biz_lesen_csv');
    const vorher = block.data;
    expect(businessPfadSetzen(block, '')).toBe(false);
    for (const pfad of ['a\0b.csv', 'a\nb.csv', 'a'.repeat(32769)]) {
      expect(() => businessPfadSetzen(block, pfad)).toThrow('Quellenpfad');
      expect(block.data).toBe(vorher);
    }
    block.setEditable(false);
    expect(() => businessPfadSetzen(block, 'quelle.csv')).toThrow('nicht bearbeitbar');
    block.setEditable(true);
    block.data = '{beschädigt';
    expect(businessPfadFeld(block)).toBeNull();
    expect(() => businessPfadSetzen(block, 'quelle.csv')).toThrow('beschädigt');
    expect(block.data).toBe('{beschädigt');
  });

  it('erhält die vorhandenen VBS-/Grundbausteinfelder und ihre echte Pfadverbindung', () => {
    const ws = workspace();
    const kopieren = ws.newBlock('sl_copy');
    const pfad = ws.newBlock('sl_text');
    pfad.setFieldValue('C:\\Quelle.txt', 'TEXT');
    kopieren.getInput('QUELLE')!.connection!.connect(pfad.outputConnection!);
    expect(pfad.getField('TEXT')).toBeInstanceOf(Blockly.FieldTextInput);
    expect(pfad.getField('TEXT')!.isCurrentlyEditable()).toBe(true);
    expect(kopieren.getInputTargetBlock('QUELLE')!.getFieldValue('TEXT')).toBe('C:\\Quelle.txt');
    expect(businessPfadFeld(kopieren)).toBeNull();
  });
});
