import { describe, expect, it } from 'vitest';
import { bausteinDefinitionen, type BausteinDefinition } from '../src/kern/katalog';
import { neuesProjekt, type EditorBlock, type Projekt } from '../src/kern/projekt';
import { pythonErzeugen, pythonText, pythonUnterstuetzteTypen } from '../src/kern/python-generator';

let nummer = 0;
const variableId = 'Variable-mit-stabiler-ID';
function block(
  typ: string,
  felder: EditorBlock['fields'] = {},
  werte: Record<string, EditorBlock> = {},
): EditorBlock {
  return {
    type: typ,
    id: `python_${++nummer}`,
    fields: felder,
    inputs: Object.fromEntries(Object.entries(werte).map(([name, kind]) => [name, { block: kind }])),
  };
}
const text = (TEXT = 'Grüße "Leon"\r\nC:\\Mein Ordner\\Datei.txt 😀') => block('sl_text', { TEXT });
const zahl = (ZAHL = '5') => block('sl_number', { ZAHL });
const wahr = () => block('sl_bool', { WERT: 'WAHR' });
const ausgabe = (wert = text()) =>
  block('sl_output', {}, { TEXT: block('sl_join', {}, { A: text(''), B: wert }) });
function projektMit(...anweisungen: EditorBlock[]): Projekt {
  const projekt = neuesProjekt('python');
  projekt.skriptsprache = 'python';
  projekt.editor.variables = [{ id: variableId, name: 'class' }];
  for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
  if (anweisungen.length) projekt.editor.blocks!.blocks[0].next = { block: anweisungen[0] };
  return projekt;
}
function vorlage(def: BausteinDefinition): EditorBlock {
  const felder: EditorBlock['fields'] = Object.fromEntries(
    def.felder.map((f) => [f.name, f.name === 'VAR' ? { id: variableId } : f.standard]),
  );
  const werte: Record<string, EditorBlock> = {};
  for (const eingang of def.eingaben) {
    if (eingang.typ === 'Statement') werte[eingang.name] = ausgabe(text('Verschachtelter Ablauf'));
    else if (eingang.typ === 'Number')
      werte[eingang.name] = zahl(eingang.name === 'MIN' || eingang.name === 'INDEX' ? '1' : '5');
    else if (eingang.typ === 'Boolean') werte[eingang.name] = wahr();
    else if (eingang.typ === 'Array') werte[eingang.name] = block('sl_list');
    else if (def.typ === 'sl_date_format' && eingang.name === 'WERT') werte[eingang.name] = block('sl_date');
    else
      werte[eingang.name] = text(
        ['PFAD', 'QUELLE', 'ZIEL'].includes(eingang.name)
          ? 'ScriptLab-Testdaten\\Datei.txt'
          : eingang.name === 'NAME'
            ? 'Neuer Name.txt'
            : 'Beispieltext',
      );
  }
  return block(def.typ, felder, werte);
}
function katalogprojekt(def: BausteinDefinition, variante?: { feld: string; wert: string }): Projekt {
  const baustein = vorlage(def);
  if (variante) baustein.fields![variante.feld] = variante.wert;
  const anlegen = block('sl_set', { VAR: { id: variableId } }, { WERT: block('sl_list') });
  return def.form === 'start'
    ? projektMit(ausgabe())
    : projektMit(anlegen, def.form === 'wert' ? ausgabe(baustein) : baustein);
}

describe('Vollständiger Python-Generator ohne Ausführung', () => {
  it('deckt genau die tatsächlichen 48 angebotenen Katalogtypen ab', () => {
    expect(bausteinDefinitionen).toHaveLength(48);
    expect([...pythonUnterstuetzteTypen].sort()).toEqual(bausteinDefinitionen.map((def) => def.typ).sort());
  });
  for (const def of bausteinDefinitionen)
    it(`erzeugt ${def.typ} mit gültiger Blockzuordnung`, () => {
      const projekt = katalogprojekt(def);
      const ergebnis = pythonErzeugen(projekt);
      expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(ergebnis.code).not.toBeNull();
      expect(ergebnis.code).toContain("if __name__ == '__main__':");
      const anzahl = ergebnis.code!.split('\r\n').length;
      for (const eintrag of ergebnis.zeilenZuordnung) {
        expect(eintrag.von).toBeGreaterThan(0);
        expect(eintrag.bis).toBeGreaterThanOrEqual(eintrag.von);
        expect(eintrag.bis).toBeLessThan(anzahl);
      }
    });
  it('übersetzt sämtliche Dropdownvarianten ohne fehlende Helfer oder Generatoren', () => {
    for (const def of bausteinDefinitionen)
      for (const feld of def.felder)
        for (const [, wert] of feld.optionen ?? []) {
          const ergebnis = pythonErzeugen(katalogprojekt(def, { feld: feld.name, wert }));
          expect(ergebnis.code, `${def.typ} ${feld.name}=${wert}`).not.toBeNull();
          expect(ergebnis.meldungen.some((m) => m.stufe === 'fehler')).toBe(false);
        }
  });
  it('erzeugt deterministischen Quelltext mit CRLF und ohne BOM', () => {
    const projekt = projektMit(ausgabe());
    const code = pythonErzeugen(projekt).code!;
    expect(code.startsWith('# Erstellt mit ScriptLab.')).toBe(true);
    expect(code.charCodeAt(0)).not.toBe(0xfeff);
    expect(code).not.toMatch(/(?<!\r)\n/);
    expect(pythonErzeugen(structuredClone(projekt)).code).toBe(code);
    expect(pythonErzeugen(projekt, { modus: 'export' }).code).toBe(code);
  });
  it('behandelt Steuerzeichen, Anführungszeichen und einschleusbaren Text nur als Daten', () => {
    const literal = pythonText('ä " \' \\ \0\r\n\t\u2028\ud800 😀');
    expect(literal).not.toMatch(/[\0\r\n\t\u2028\ud800]/u);
    expect(literal).toContain('\\u0000');
    expect(literal).toContain('\\ud800');
    expect(literal).toContain('😀');
    const code = pythonErzeugen(projektMit(ausgabe(text("'\r\nraise SystemExit(9)\r\n#")))).code!;
    expect(code).not.toMatch(/^raise SystemExit\(9\)/m);
  });
  it('erhält Verschachtelung, leere Zweige und nicht kurzschließende Logik', () => {
    const bedingung = block(
      'sl_logic',
      { OP: 'AND' },
      { A: wahr(), B: block('sl_not', {}, { WERT: wahr() }) },
    );
    const wenn = block('sl_if', {}, { BEDINGUNG: bedingung });
    const schleife = block('sl_repeat', {}, { ANZAHL: zahl('2'), ABLAUF: wenn });
    const code = pythonErzeugen(projektMit(schleife)).code!;
    expect(code).toMatch(/    for sl_intern_1 in range\(/);
    expect(code).toContain('        if sl_wahr(');
    expect(code).toContain('            pass\r\n');
    expect(code).toContain('sl_logik(');
    expect(code).not.toContain('lambda: True and');
  });
  it('ordnet auch Fehler in verschachtelten Werten dem konkreten Wertbaustein zu', () => {
    const division = block('sl_math', { OP: 'DIV' }, { A: zahl('1'), B: zahl('0') });
    const ergebnis = pythonErzeugen(projektMit(ausgabe(division)));
    expect(ergebnis.code).toContain(`sl_wert(${pythonText(division.id)}, lambda:`);
    expect(ergebnis.zeilenZuordnung.some((z) => z.blockId === division.id)).toBe(true);
  });
  it('setzt den Schleifenmarker vor jeder erneuten Wahrheitsumwandlung', () => {
    const schleife = block(
      'sl_while',
      {},
      {
        BEDINGUNG: block('sl_get', { VAR: { id: variableId } }),
        ABLAUF: block('sl_set', { VAR: { id: variableId } }, { WERT: text('kein Wahrheitswert') }),
      },
    );
    const code = pythonErzeugen(
      projektMit(block('sl_set', { VAR: { id: variableId } }, { WERT: wahr() }), schleife),
    ).code!;
    expect(code).toContain(
      `while True:\r\n        sl_block = ${pythonText(schleife.id)}\r\n        if not sl_wahr(`,
    );
  });
  it('verwendet Variablen-IDs statt Anzeigenamen und verhindert Python-Namenskollisionen', () => {
    const idB = variableId.toUpperCase();
    const anlegenA = block('sl_set', { VAR: { id: variableId } }, { WERT: zahl('1') });
    const anlegenB = block('sl_set', { VAR: { id: idB } }, { WERT: zahl('2') });
    const projekt = projektMit(
      anlegenA,
      anlegenB,
      ausgabe(block('sl_get', { VAR: { id: variableId } })),
      ausgabe(block('sl_get', { VAR: { id: idB } })),
    );
    projekt.editor.variables!.push({ id: idB, name: 'class' });
    const code = pythonErzeugen(projekt).code!;
    expect(code).toContain('    v_1 = sl_leer');
    expect(code).toContain('    v_2 = sl_leer');
    expect(code).not.toMatch(/\bclass\s*=/);
    const umbenannt = structuredClone(projekt);
    umbenannt.editor.variables![0].name = 'str';
    expect(pythonErzeugen(umbenannt).code).toBe(code);
  });
  it('erhält den starken VBS-Literalkontext getrennt von dynamischen Varianten', () => {
    const werte = [
      block('sl_compare', { OP: 'EQ' }, { A: zahl('1'), B: text('1') }),
      block('sl_compare', { OP: 'EQ' }, { A: block('sl_get', { VAR: { id: variableId } }), B: text('1') }),
      block(
        'sl_compare',
        { OP: 'EQ' },
        { A: block('sl_get', { VAR: { id: variableId } }), B: block('sl_get', { VAR: { id: variableId } }) },
      ),
    ];
    const projekt = projektMit(
      block('sl_set', { VAR: { id: variableId } }, { WERT: zahl('1') }),
      ...werte.map(ausgabe),
    );
    const code = pythonErzeugen(projekt).code!;
    for (const modus of ['zahl', 'text', 'variant']) expect(code).toContain(`'EQ', '${modus}')`);
  });
  it('verwechselt ein VBS-Projekt nicht mit einem Python-Export', () => {
    const projekt = projektMit(ausgabe());
    projekt.skriptsprache = 'vbs';
    expect(pythonErzeugen(projekt).code).toBeNull();
  });
  it('erzeugt einen deutschen Eingabedialog über die öffentliche Tk-Dialogschnittstelle', () => {
    const code = pythonErzeugen(
      projektMit(ausgabe(block('sl_input', {}, { TEXT: text('Dein Text') }))),
    ).code!;
    expect(code).toContain('class SL_Texteingabe(simpledialog.Dialog):');
    expect(code).toContain('ttk.Entry');
    expect(code).toContain('text="Abbrechen"');
    expect(code).toContain('self.bind("<Return>", self.ok)');
    expect(code).toContain('self.bind("<Escape>", self.cancel)');
    expect(code).toContain('self.protocol("WM_DELETE_WINDOW", self.cancel)');
    expect(code).not.toContain('_QueryString');
    expect(code).not.toContain('simpledialog.askstring');
  });
  it('weist unvollständige und unverbundene aktive Blöcke mit unveränderter Validierung ab', () => {
    const leer = pythonErzeugen(projektMit(block('sl_output')));
    expect(leer.code).toBeNull();
    expect(leer.meldungen.some((m) => m.blockId && m.stufe === 'fehler')).toBe(true);
    const projekt = projektMit(ausgabe());
    projekt.editor.blocks!.blocks.push(ausgabe());
    expect(pythonErzeugen(projekt).code).toBeNull();
  });
  it('trennt Export- und Testbasis sowie Protokoll und prüft unvertrauenswürdige Optionen', () => {
    const projekt = projektMit(
      block('sl_write_text', { KODIERUNG: 'UTF8' }, { PFAD: text('Relativ\\Datei.txt'), TEXT: text() }),
    );
    const exportiert = pythonErzeugen(projekt).code!;
    const getestet = pythonErzeugen(projekt, { modus: 'test', token: 'a'.repeat(48) }).code!;
    expect(exportiert).toContain('sl_basis = os.path.dirname(os.path.abspath(__file__))');
    expect(exportiert).not.toContain('SLFEHLER|');
    expect(getestet).toContain("'--scriptlab-basis'");
    expect(getestet).toContain("'--scriptlab-token'");
    expect(getestet).toContain('SLFEHLER|' + 'a'.repeat(48) + '|');
    expect(getestet).toContain('traceback.print_exc');
    expect(getestet).not.toContain('os.path.dirname(os.path.abspath(__file__))');
    for (const optionen of [
      { modus: 'test', token: 'bad' },
      { modus: 'export', quelle: 'print(1)' },
      { modus: 'frei' },
    ])
      expect(pythonErzeugen(projekt, optionen as never).code).toBeNull();
  });
  it('lädt nur benötigte Standardbibliotheken und gibt Helfer einmal aus', () => {
    const klein = pythonErzeugen(projektMit(block('sl_end'))).code!;
    expect(klein).not.toMatch(/^import (tkinter|ctypes|os|shutil|random|datetime|math)/m);
    const ausgaben = pythonErzeugen(projektMit(ausgabe(), ausgabe())).code!;
    expect(ausgaben).not.toMatch(/^import (math|os|shutil|random|datetime)/m);
    expect(ausgaben.match(/^def sl_text\(/gm)).toHaveLength(1);
    expect(ausgaben).not.toContain('import tkinter');
    const loeschenOhne = pythonErzeugen(
      projektMit(block('sl_delete', { RUECKFRAGE: 'NEIN' }, { PFAD: text('Datei.txt') })),
    ).code!;
    expect(loeschenOhne).not.toContain('import tkinter');
    const loeschenMit = pythonErzeugen(
      projektMit(block('sl_delete', { RUECKFRAGE: 'JA' }, { PFAD: text('Datei.txt') })),
    ).code!;
    expect(loeschenMit).toContain('import tkinter');
  });
});
