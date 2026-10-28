import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registriereBausteine } from '../src/editor/bausteine';
import { BlockDatenEreignis } from '../src/editor/parameterEreignis';
import { businessQuellenVorBlock } from '../src/editor/businessQuellen';
import { istQuellenfeld } from '../src/kern/quellenfeld';
import { blockZusammenfassung } from '../src/kern/blockZusammenfassung';
import { BusinessEigenschaften } from '../src/renderer/BusinessEigenschaften';
import type { WorkflowParameter } from '../src/kern/business-modell';

registriereBausteine();
const tick = () => new Promise<void>((fertig) => setTimeout(fertig, 0));
const nichts = () => {};
const quelleWaehlen = async () => null;
const daten = (konfiguration: object, eingaben = {}) => JSON.stringify({ konfiguration, eingaben });
const verbinden = (vorher: Blockly.Block, nachher: Blockly.Block) =>
  vorher.nextConnection!.connect(nachher.previousConnection!);

describe('Quellen und verständliche Blockeingaben', () => {
  it('zeigt am Filter Spalte und tatsächlichen Vergleich statt nur den Vorgänger', () => {
    const konfiguration = {
      bedingung: {
        art: 'vergleich',
        links: { art: 'spalte', name: 'Betrag' },
        operator: 'GT',
        rechts: { art: 'wert', typ: 'ZAHL', wert: 0 },
      },
    };
    expect(blockZusammenfassung('sl_biz_filtern', daten(konfiguration))).toBe('Betrag > 0');
    expect(
      blockZusammenfassung(
        'sl_biz_filtern',
        daten({
          bedingung: {
            art: 'vergleich',
            links: { art: 'spalte', name: 'Monat' },
            operator: 'EQ',
            rechts: { art: 'wert', typ: 'TEXT', wert: { parameter: 'Berichtsmonat' } },
          },
        }),
      ),
    ).toBe('Monat = Parameter: Berichtsmonat');
    expect(
      blockZusammenfassung(
        'sl_biz_filtern',
        daten({
          bedingung: {
            art: 'vergleich',
            spalte: 'Freigabe',
            operator: 'EQ',
            wert: { art: 'wert', typ: 'WAHRHEIT', wert: false },
          },
        }),
      ),
    ).toBe('Freigabe = Nein');
    expect(
      blockZusammenfassung(
        'sl_biz_filtern',
        daten({
          bedingung: {
            art: 'vergleich',
            spalte: 'Kundennummer',
            operator: 'IST_LEER',
          },
        }),
      ),
    ).toBe('Kundennummer ist leer');
  });

  it('zeigt tatsächliche Gruppierspalten knapp und lässt unbekannte Filter als Fallback stehen', () => {
    const konfiguration = {
      schluessel: ['Region', 'Monat'],
      aggregate: [{ funktion: 'SUMME', spalte: 'Betrag', name: 'Summe' }],
    };
    const serialisiert = daten(konfiguration, { tabelle: { referenz: 'quelle' } });
    expect(blockZusammenfassung('sl_biz_gruppieren', serialisiert, () => 'Zeilen filtern')).toBe(
      'Nach Region, Monat',
    );
    expect(
      blockZusammenfassung(
        'sl_biz_filtern',
        daten({ bedingung: { art: 'und', kinder: [] } }, { tabelle: { referenz: 'quelle' } }),
        () => 'Gewählte Quelle',
      ),
    ).toBe('Aus: Gewählte Quelle');
    const lang = blockZusammenfassung(
      'sl_biz_gruppieren',
      daten({
        schluessel: [
          'Eine sehr lange Gruppierspalte mit einem deutschen Namen und weiterer Beschreibung',
          'Monat',
        ],
        aggregate: [],
      }),
    );
    expect(Array.from(lang).length).toBeLessThanOrEqual(56);
    expect(lang).not.toContain('\n');
  });

  it('erlaubt native Auswahl nur bei lesenden Quellen, Vorlagen und tatsächlichen Bildabschnitten', () => {
    expect(istQuellenfeld('sl_biz_lesen_csv', ['pfad'], {})).toBe(true);
    expect(istQuellenfeld('sl_biz_schreiben_csv', ['pfad'], {})).toBe(false);
    expect(istQuellenfeld('sl_biz_docx_vorlage', ['vorlage'], {})).toBe(true);
    expect(istQuellenfeld('sl_biz_docx_vorlage', ['ziel'], {})).toBe(false);
    expect(istQuellenfeld('sl_biz_pdf_text', ['quelle'], {})).toBe(true);
    expect(
      istQuellenfeld('sl_biz_docx_erstellen', ['abschnitte', '0', 'pfad'], { abschnitte: [{ art: 'BILD' }] }),
    ).toBe(true);
    expect(
      istQuellenfeld('sl_biz_docx_erstellen', ['abschnitte', '0', 'pfad'], {
        abschnitte: [{ art: 'ABSATZ' }],
      }),
    ).toBe(false);
  });

  it('bietet nur passende vorherige Quellen im erreichbaren Ablauf an', () => {
    const ws = new Blockly.Workspace();
    try {
      const start = ws.newBlock('sl_start');
      const vorher = ws.newBlock('sl_biz_lesen_csv');
      const deaktiviert = ws.newBlock('sl_biz_lesen_csv');
      deaktiviert.setDisabledReason(true, 'TEST');
      const ziel = ws.newBlock('sl_biz_schreiben_csv');
      const nachher = ws.newBlock('sl_biz_lesen_csv');
      ws.newBlock('sl_biz_lesen_csv');
      verbinden(start, vorher);
      verbinden(vorher, deaktiviert);
      verbinden(deaktiviert, ziel);
      verbinden(ziel, nachher);
      expect(businessQuellenVorBlock(ws, ziel.id, 'Tabelle').map((b) => b.id)).toEqual([vorher.id]);
      expect(businessQuellenVorBlock(ws, vorher.id, 'Tabelle')).toEqual([]);
      expect(businessQuellenVorBlock(ws, ziel.id, 'Dateiliste')).toEqual([]);
    } finally {
      ws.dispose();
    }
  });

  it('lässt Zweigquellen nicht auslaufen, erhält aber sichere Vorgänger innerhalb des Zweigs', () => {
    const ws = new Blockly.Workspace();
    try {
      const start = ws.newBlock('sl_start');
      const vorher = ws.newBlock('sl_biz_lesen_csv');
      const wenn = ws.newBlock('sl_if');
      const imZweig = ws.newBlock('sl_biz_lesen_csv');
      const zweigZiel = ws.newBlock('sl_biz_schreiben_csv');
      const danach = ws.newBlock('sl_biz_schreiben_csv');
      verbinden(start, vorher);
      verbinden(vorher, wenn);
      verbinden(wenn, danach);
      wenn.getInput('DANN')!.connection!.connect(imZweig.previousConnection!);
      verbinden(imZweig, zweigZiel);
      expect(businessQuellenVorBlock(ws, zweigZiel.id, 'Tabelle').map((b) => b.id)).toEqual([
        vorher.id,
        imZweig.id,
      ]);
      expect(businessQuellenVorBlock(ws, danach.id, 'Tabelle').map((b) => b.id)).toEqual([vorher.id]);
    } finally {
      ws.dispose();
    }
  });

  it('zeigt echte gebundene Werte samt Satz und lässt null, false und 0 unterscheidbar', () => {
    const ws = new Blockly.Workspace();
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      block.data = daten({ pfad: { parameter: 'Quelle' } });
      const p: WorkflowParameter = {
        name: 'Quelle',
        beschriftung: 'Quelldatei',
        typ: 'Datei',
        standard: 'standard.csv',
        erforderlich: false,
        hilfe: '',
      };
      for (const [wert, sichtbar] of [
        [0, '0'],
        [false, 'Nein'],
        [null, 'Ohne Wert'],
      ] as const) {
        const html = renderToStaticMarkup(
          createElement(BusinessEigenschaften, {
            ws: ws as Blockly.WorkspaceSvg,
            block,
            parameter: [p],
            gesperrt: false,
            geaendert: nichts,
            quelleWaehlen,
            parameterKontext: { parametersatz: 'echt', werte: { Quelle: wert }, werteOeffnen: nichts },
          }),
        );
        expect(html).toContain('Echte Daten');
        expect(html).toContain(sichtbar);
        expect(html).toContain('Wert bearbeiten');
        expect(html).not.toContain('standard.csv');
        expect(html).not.toContain('Datei auswählen');
      }
    } finally {
      ws.dispose();
    }
  });

  it('hält alte Referenzen sichtbar und verwendet nur Spalten der sicher gewählten Eingabetabellen', () => {
    const ws = new Blockly.Workspace();
    try {
      const start = ws.newBlock('sl_start');
      const links = ws.newBlock('sl_biz_lesen_csv');
      const rechts = ws.newBlock('sl_biz_lesen_csv');
      const join = ws.newBlock('sl_biz_verknuepfen');
      verbinden(start, links);
      verbinden(links, rechts);
      verbinden(rechts, join);
      join.data = daten(
        { schluessel: [{ links: 'Kundennummer', rechts: 'Kunde' }] },
        { links: { referenz: links.id }, rechts: { referenz: rechts.id } },
      );
      const html = renderToStaticMarkup(
        createElement(BusinessEigenschaften, {
          ws: ws as Blockly.WorkspaceSvg,
          block: join,
          parameter: [],
          gesperrt: false,
          geaendert: nichts,
          spalten: ['FremdeTabelle'],
          spaltenNachQuelle: {
            [links.id]: ['Kundennummer'],
            [rechts.id]: ['Kunde'],
            fremd: ['FremdeTabelle'],
          },
        }),
      );
      expect(html).not.toContain('FremdeTabelle');
      expect(html).toMatch(/<datalist id="[^"]+-links"><option value="Kundennummer"/);
      expect(html).toMatch(/<datalist id="[^"]+-rechts"><option value="Kunde"/);
      links.unplug();
      const invalid = renderToStaticMarkup(
        createElement(BusinessEigenschaften, {
          ws: ws as Blockly.WorkspaceSvg,
          block: join,
          parameter: [],
          gesperrt: false,
          geaendert: nichts,
          spaltenNachQuelle: { [links.id]: ['Kundennummer'], [rechts.id]: ['Kunde'] },
        }),
      );
      expect(invalid).toContain('hier nicht verfügbar');
      expect(invalid).toContain('passenden vorherigen Schritt');
      expect(invalid).toContain(`value="${links.id}" selected`);
    } finally {
      ws.dispose();
    }
  });

  it('leitet eine kurze Anzeige ab und speichert weder Label noch Anzeigeereignisse im Workflow', async () => {
    const ws = new Blockly.Workspace();
    try {
      const block = ws.newBlock('sl_biz_lesen_csv');
      await tick();
      const ereignisse: Blockly.Events.Abstract[] = [];
      ws.addChangeListener((event) => ereignisse.push(event));
      const vorher = block.data;
      block.data = daten({ pfad: 'C:\\Testdaten\\Monatsumsatz.csv' });
      Blockly.Events.fire(new BlockDatenEreignis(block, vorher, block.data));
      await tick();
      const label = block.getInput('SL_KURZTEXT')!.fieldRow[0];
      expect(label.getValue()).toBe('Monatsumsatz.csv');
      expect(label.isSerializable()).toBe(false);
      expect(ereignisse).toHaveLength(1);
      const gespeichert = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      expect(gespeichert).not.toContain('SL_KURZTEXT');
      expect(gespeichert).not.toContain('sl-blockzusammenfassung');
      expect(blockZusammenfassung(block.type, block.data)).toBe('Monatsumsatz.csv');
      expect(blockZusammenfassung(block.type, daten({ pfad: '' }))).toBe('Quelldatei auswählen');
    } finally {
      ws.dispose();
    }
  });
});
