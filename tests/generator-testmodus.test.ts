import { describe, expect, it } from 'vitest';
import { vbsErzeugen, type GeneratorOptionen, type GeneratorErgebnis } from '../src/kern/generator';
import { neuesProjekt, type EditorBlock, type Projekt } from '../src/kern/projekt';
import { definitionNachTyp } from '../src/kern/katalog';

const token = '1234567890abcdef'.repeat(3);
let nummer = 0;
function block(
  typ: string,
  werte: Record<string, EditorBlock> = {},
  fields: EditorBlock['fields'] = {},
): EditorBlock {
  return {
    type: typ,
    id: `zuordnung_${++nummer}`,
    fields,
    inputs: Object.fromEntries(Object.entries(werte).map(([name, wert]) => [name, { block: wert }])),
  };
}
const text = (inhalt: string) => block('sl_text', {}, { TEXT: inhalt });
const zahl = (inhalt: string) => block('sl_number', {}, { ZAHL: inhalt });
function projektMit(...anweisungen: EditorBlock[]): Projekt {
  const projekt = neuesProjekt();
  for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
  projekt.editor.blocks!.blocks[0].next = { block: anweisungen[0] };
  return projekt;
}
function zuordnungFuer(ergebnis: GeneratorErgebnis, quelle: string) {
  const zeile = ergebnis.code!.split('\r\n').indexOf(quelle) + 1;
  expect(zeile, `Die tatsächliche Quelltextzeile fehlt: ${quelle}`).toBeGreaterThan(0);
  return ergebnis.zeilenZuordnung.filter((bereich) => bereich.von <= zeile && bereich.bis >= zeile);
}

describe('Ein gemeinsamer VBS-Generator mit ausdrücklich gewähltem Testmodus', () => {
  it('bietet Textausgabe als Anweisung mit Pflichttexteingang und beiden Hosthilfen an', () => {
    const definition = definitionNachTyp.get('sl_output')!;
    expect(definition).toMatchObject({
      name: 'Text ausgeben',
      form: 'anweisung',
      eingaben: [{ name: 'TEXT', typ: 'String', optional: false }],
    });
    expect(definition.hilfe).toMatch(/cscript\.exe.*wscript\.exe/);
    const ausgabe = block('sl_output', { TEXT: text('Grüße "Leon"\r\nC:\\Ordner mit Leerzeichen') });
    const ergebnis = vbsErzeugen(projektMit(ausgabe));
    expect(ergebnis.meldungen).toEqual([]);
    expect(ergebnis.code).toContain(
      'Call SL_Ausgabe(("Grüße ""Leon""" & vbCrLf & "C:\\Ordner mit Leerzeichen"))',
    );
    expect(ergebnis.code).toContain(
      'If LCase(Right(WScript.FullName, 11)) = "cscript.exe" Then\r\n    WScript.StdOut.WriteLine CStr(text)\r\n  Else\r\n    WScript.Echo CStr(text)',
    );
    expect(ergebnis.code!.match(/Sub SL_Ausgabe\(text\)/g)).toHaveLength(1);
    expect(vbsErzeugen(projektMit(block('sl_output'))).code).toBeNull();
    expect(vbsErzeugen(projektMit(block('sl_output', { TEXT: zahl('3') }))).code).toBeNull();
  });

  it('behält den Export als Default und nimmt nur im Testmodus tokengebundene Named-Argumente an', () => {
    const ordner = block('sl_mkdir', { PFAD: text('ScriptLab-Testdaten\\Sicherung') });
    const projekt = projektMit(ordner);
    const exportiert = vbsErzeugen(projekt);
    expect(vbsErzeugen(projekt, { modus: 'export' })).toEqual(exportiert);
    expect(exportiert.code).toContain(
      'sl_fso.BuildPath(sl_fso.GetParentFolderName(WScript.ScriptFullName), pfad)',
    );
    expect(exportiert.code).not.toMatch(/WScript\.Arguments|WScript\.StdErr|SLFEHLER|sl_basis/);
    const test = vbsErzeugen(projekt, { modus: 'test', token });
    expect(test.code).toContain(
      `StrComp(WScript.Arguments.Named("ScriptLabTestToken"), "${token}", vbBinaryCompare)`,
    );
    expect(test.code).toContain('sl_basis = CStr(WScript.Arguments.Named("ScriptLabBasis"))');
    expect(test.code).toContain('sl_fso.BuildPath(sl_basis, pfad)');
    expect(test.code).toContain('Der Test benötigt einen vollständigen Basisordnerpfad.');
    expect(test.code!.indexOf('Named("ScriptLabTestToken")')).toBeLessThan(
      test.code!.indexOf('sl_basis = CStr'),
    );
    expect(vbsErzeugen(projekt, { modus: 'test', token })).toEqual(test);
  });

  it('weist unzulässige Modi, fehlende Tokens, geerbte Optionen und zusätzliche Codeoptionen ab', () => {
    const projekt = projektMit(block('sl_output', { TEXT: text('Nur Daten') }));
    for (const optionen of [
      {},
      null,
      [],
      { modus: 'frei' },
      { modus: 'test' },
      { modus: 'test', token: 'zu-kurz' },
      { modus: 'test', token: `${token}\r\nWScript.Quit 9` },
      { modus: 'test', token, basis: 'C:\\Test' },
      { modus: 'export', token },
      Object.create({ modus: 'test', token }),
    ]) {
      const ergebnis = vbsErzeugen(projekt, optionen as GeneratorOptionen);
      expect(ergebnis.code).toBeNull();
      expect(ergebnis.zeilenZuordnung).toEqual([]);
      expect(ergebnis.meldungen).toContainEqual({
        stufe: 'fehler',
        text: expect.stringMatching(/Generator|Testtoken/),
      });
    }
  });

  it('trennt den strukturierten Fehlerkanal von normalen Textausgaben und vermeidet Fehlerdialoge im Test', () => {
    const ausgabe = block('sl_output', {
      TEXT: text('SLFEHLER|Eine normale Nutzerausgabe\r\n| bleibt Text'),
    });
    const projekt = projektMit(ausgabe);
    const test = vbsErzeugen(projekt, { modus: 'test', token });
    expect(test.code).toContain(
      `WScript.StdErr.WriteLine "SLFEHLER|${token}|" & SL_TestFeld(sl_block) & "|" & SL_TestFeld(meldung)`,
    );
    expect(test.code).toContain('Call SL_Ausgabe(("SLFEHLER|Eine normale Nutzerausgabe"');
    expect(test.code).toContain('text = Replace(CStr(wert), "%", "%25")');
    expect(test.code).toContain('text = Replace(text, "|", "%7C")');
    expect(test.code).toContain('text = Replace(text, vbCr, "%0D")');
    expect(test.code).toContain('text = Replace(text, vbLf, "%0A")');
    expect(test.code).not.toContain('MsgBox');
    expect(vbsErzeugen(projekt).code).toContain('MsgBox "Der Workflow wurde beendet."');
  });
});

describe('Echte vollständige Quelltextzeilen statt geschätzter Blockpositionen', () => {
  it('ordnet verschachtelte Anweisungen einschließlich Strukturzeilen genau einmal zu', () => {
    const dann = block('sl_output', { TEXT: text('Dann') });
    const sonst = block('sl_comment', {}, { TEXT: 'Zwei Zeilen\r\nmit Kommentar' });
    const wenn = block('sl_if', {
      BEDINGUNG: block('sl_bool', {}, { WERT: 'WAHR' }),
      DANN: dann,
      SONST: sonst,
    });
    const schleife = block('sl_repeat', { ANZAHL: zahl('2'), ABLAUF: wenn });
    const projekt = projektMit(schleife);
    const ergebnis = vbsErzeugen(projekt);
    expect(zuordnungFuer(ergebnis, '      Call SL_Ausgabe(("Dann"))')).toEqual([
      { von: expect.any(Number), bis: expect.any(Number), blockId: dann.id },
    ]);
    expect(zuordnungFuer(ergebnis, '    Else')[0]?.blockId).toBe(wenn.id);
    expect(zuordnungFuer(ergebnis, '    End If')[0]?.blockId).toBe(wenn.id);
    expect(zuordnungFuer(ergebnis, '  Next')[0]?.blockId).toBe(schleife.id);
    expect(zuordnungFuer(ergebnis, "      ' mit Kommentar")[0]?.blockId).toBe(sonst.id);
    expect(zuordnungFuer(ergebnis, 'sl_block = "start"')[0]?.blockId).toBe('start');
    expect(zuordnungFuer(ergebnis, 'Sub SL_Geschuetzt()')).toEqual([]);
    const belegteZeilen = new Set<number>();
    for (const bereich of ergebnis.zeilenZuordnung) {
      expect(bereich.von).toBeGreaterThan(0);
      expect(bereich.bis).toBeGreaterThanOrEqual(bereich.von);
      expect(bereich.bis).toBeLessThanOrEqual(ergebnis.code!.split('\r\n').length);
      for (let zeile = bereich.von; zeile <= bereich.bis; zeile++) {
        expect(belegteZeilen.has(zeile), `Zeile ${zeile} besitzt mehrdeutige IDs.`).toBe(false);
        belegteZeilen.add(zeile);
      }
    }
  });

  it('berücksichtigt Präambel, Variablendeklarationen und Testinitialisierung im tatsächlichen Zeilenoffset', () => {
    const wert = block('sl_basename', { PFAD: text('ScriptLab-Testdaten\\Datei.txt') });
    const ausgabe = block('sl_output', { TEXT: wert });
    const projekt = projektMit(block('sl_set', { WERT: zahl('1') }, { VAR: 'Zähler' }), ausgabe);
    const exportiert = vbsErzeugen(projekt);
    const test = vbsErzeugen(projekt, { modus: 'test', token });
    const quellzeile = '  Call SL_Ausgabe(SL_Dateiname(("ScriptLab-Testdaten\\Datei.txt")))';
    for (const ergebnis of [exportiert, test]) {
      expect(zuordnungFuer(ergebnis, quellzeile)[0]?.blockId).toBe(ausgabe.id);
      expect(zuordnungFuer(ergebnis, 'Function SL_Pfad(wert)')).toEqual([]);
      expect(ergebnis.zeilenZuordnung.some((bereich) => bereich.blockId === wert.id)).toBe(false);
      expect(ergebnis.code).not.toMatch(/(?<!\r)\n/);
    }
    expect(test.code!.split('\r\n').indexOf(quellzeile)).toBeGreaterThan(
      exportiert.code!.split('\r\n').indexOf(quellzeile),
    );
    const ungueltig = vbsErzeugen(neuesProjekt());
    expect(ungueltig).toMatchObject({ code: null, zeilenZuordnung: [] });
  });
});
