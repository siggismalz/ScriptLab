import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import { bausteinDefinitionen, type BausteinDefinition } from '../src/kern/katalog';
import { neuesProjekt, projektPruefen, type EditorBlock, type Projekt } from '../src/kern/projekt';
import { vbsErzeugen, vbsText } from '../src/kern/generator';
import { registriereBausteine } from '../src/editor/bausteine';

let id = 0;
function block(
  type: string,
  fields?: EditorBlock['fields'],
  werte: Record<string, EditorBlock> = {},
): EditorBlock {
  return {
    type,
    id: `test_${++id}`,
    ...(fields ? { fields } : {}),
    ...(Object.keys(werte).length
      ? { inputs: Object.fromEntries(Object.entries(werte).map(([name, kind]) => [name, { block: kind }])) }
      : {}),
  };
}
const text = (TEXT = 'Grüße "Leon"\r\nC:\\Mein Ordner\\Datei.txt'): EditorBlock => block('sl_text', { TEXT });
const zahl = (ZAHL = '5'): EditorBlock => block('sl_number', { ZAHL });
const bedingung = (): EditorBlock => block('sl_bool', { WERT: 'WAHR' });
const nachricht = (wert = text()): EditorBlock => block('sl_message', {}, { TEXT: wert });
function projektMit(...anweisungen: EditorBlock[]): Projekt {
  const projekt = neuesProjekt();
  for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
  projekt.editor.blocks!.blocks[0].next = anweisungen.length ? { block: anweisungen[0] } : undefined;
  return projekt;
}
function vorlage(def: BausteinDefinition): EditorBlock {
  const felder = Object.fromEntries(def.felder.map((f) => [f.name, f.standard]));
  const werte: Record<string, EditorBlock> = {};
  for (const e of def.eingaben) {
    if (e.typ === 'Statement') werte[e.name] = nachricht(text('Verschachtelter Ablauf'));
    else if (e.typ === 'Number')
      werte[e.name] = zahl(e.name === 'MIN' ? '1' : e.name === 'MAX' ? '10' : e.name === 'INDEX' ? '1' : '5');
    else if (e.typ === 'Boolean') werte[e.name] = bedingung();
    else if (e.typ === 'Array') werte[e.name] = block('sl_list');
    else if (e.name === 'WERT' && def.typ === 'sl_date_format') werte[e.name] = block('sl_date');
    else
      werte[e.name] = text(
        ['PFAD', 'QUELLE', 'ZIEL'].includes(e.name)
          ? 'ScriptLab-Testdaten\\Beispiel.txt'
          : e.name === 'NAME'
            ? 'Neuer Name.txt'
            : 'Beispieltext',
      );
  }
  return block(def.typ, felder, werte);
}

describe('Projektdateien', () => {
  it('beginnt als speicherbarer Entwurf mit genau einem Start und ohne Aktionen', () => {
    const p = neuesProjekt();
    const bausteine = p.editor.blocks!.blocks;
    expect(bausteine).toHaveLength(1);
    expect(bausteine[0].type).toBe('sl_start');
    expect(bausteine[0].next).toBeUndefined();
    expect(bausteine[0].inputs).toBeUndefined();
    expect(projektPruefen(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const entwurf = vbsErzeugen(p);
    expect(entwurf.code).toBeNull();
    expect(entwurf.meldungen).toContainEqual({
      blockId: bausteine[0].id,
      stufe: 'fehler',
      text: expect.stringMatching(/Verbinde mindestens eine Anweisung/),
    });
    bausteine[0].next = { block: nachricht(text('Meine erste Anweisung')) };
    expect(vbsErzeugen(p).code).toContain('MsgBox');
  });
  it('prüft einen verlustfreien JSON-Rundlauf einschließlich Ansicht und IDs', () => {
    const p = neuesProjekt();
    p.ansicht = { zoom: 1.3, x: -234.5, y: 888 };
    p.beschreibung = 'Änderung';
    expect(projektPruefen(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('weist neue Schemata, doppelte IDs und ungültige Strukturen zurück', () => {
    expect(() => projektPruefen({ ...neuesProjekt(), schemaVersion: 3 })).toThrow(/neueren/);
    const p = neuesProjekt();
    p.editor.blocks!.blocks.push(structuredClone(p.editor.blocks!.blocks[0]));
    expect(() => projektPruefen(p)).toThrow(/doppelte/);
    expect(() => projektPruefen({ ...neuesProjekt(), ansicht: { zoom: NaN, x: 0, y: 0 } })).toThrow(
      /ansicht/i,
    );
    expect(() =>
      projektPruefen({ ...neuesProjekt(), editor: { fremderSerializer: { code: 'alert(1)' } } }),
    ).toThrow(/Editorzustand/);
    const unbekannt = neuesProjekt();
    unbekannt.editor.blocks!.blocks[0].type = 'sl_unbekannt';
    expect(() => projektPruefen(unbekannt)).toThrow(/nicht unterstützten Bausteintyp/);
  });
  it('weist übergroße und zyklische Baumstrukturen begrenzt zurück', () => {
    const p = neuesProjekt();
    const b = p.editor.blocks!.blocks[0];
    b.next = { block: b };
    expect(() => projektPruefen(p)).toThrow(/doppelte|verschachtelte/);
    p.editor.blocks!.blocks = [{ ...text(), fields: { TEXT: 'x'.repeat(40000) } }];
    expect(() => projektPruefen(p)).toThrow(/Bausteinfeld/);
  });
  it('erlaubt unvollständige Entwürfe beim Speichern', () => {
    const p = projektMit(block('sl_message'));
    expect(projektPruefen(p)).toEqual(p);
    expect(vbsErzeugen(p).code).toBeNull();
  });
  it('weist geheime oder aktive Zusatzdaten und fremde URLs zurück', () => {
    const p = neuesProjekt();
    p.editor.blocks!.blocks[0] = { ...p.editor.blocks!.blocks[0], extraState: { code: 'x' } } as EditorBlock;
    expect(() => projektPruefen(p)).toThrow(/Zusatzdaten/);
    const q = neuesProjekt();
    q.exportOptionen.zeitstempelUrl = 'file:///C:/privat';
    expect(() => projektPruefen(q)).toThrow(/Zeitstempel/);
  });
});

describe('VBS-Erzeugung ohne Ausführung', () => {
  it('erzeugt die erste vollständige Nachricht mit stabilen CRLF-Zeilen', () => {
    const p = projektMit(nachricht(text('Hallo! Erstellt mit ScriptLab.')));
    const ergebnis = vbsErzeugen(p);
    expect(ergebnis.meldungen).toEqual([]);
    expect(ergebnis.code).toContain('Option Explicit\r\n');
    expect(ergebnis.code).toContain('MsgBox CStr(("Hallo! Erstellt mit ScriptLab."))');
    expect(ergebnis.code).not.toMatch(/(?<!\r)\n/);
    expect(vbsErzeugen(p).code).toEqual(ergebnis.code);
  });
  it('behandelt Umlaute, Anführungszeichen und Zeilenumbrüche ausschließlich als Daten', () => {
    expect(vbsText('Grüße "Leon"\r\nEnde')).toEqual('"Grüße ""Leon""" & vbCrLf & "Ende"');
    const einschleusung = '"\r\nWScript.Quit 9\r\n\'';
    const code = vbsErzeugen(projektMit(nachricht(text(einschleusung)))).code!;
    expect(code).toContain('"""" & vbCrLf & "WScript.Quit 9" & vbCrLf & "\'"');
    expect(code.split('\r\n')).not.toContain('WScript.Quit 9');
    expect(vbsText('A\u2028B\u0001')).toEqual('"A" & ChrW(8232) & "B" & ChrW(1)');
  });
  it('bildet deutsche Dezimalzahlen unabhängig von der Eingabe ab', () => {
    expect(vbsErzeugen(projektMit(nachricht(zahl('2,75')))).code).toContain('CStr(2.75)');
    expect(vbsErzeugen(projektMit(nachricht(zahl('1.234,56')))).code).toBeNull();
  });
  it('erzeugt sichere Variablen auch bei reservierten Namen und Groß-/Kleinschreibung', () => {
    const p = projektMit(
      block('sl_set', { VAR: 'Dim' }, { WERT: text('A') }),
      block('sl_set', { VAR: 'dIM' }, { WERT: text('B') }),
      nachricht(block('sl_get', { VAR: 'DIM' })),
    );
    const code = vbsErzeugen(p).code!;
    expect(code).toContain('Dim v_1');
    expect(code).not.toContain('Dim v_2');
    expect(code).toContain('MsgBox CStr(v_1)');
  });
  it('erhält Operatorrangfolge und verschachtelte Abläufe', () => {
    const rechnung = block(
      'sl_math',
      { OP: 'MUL' },
      { A: block('sl_math', { OP: 'ADD' }, { A: zahl('2'), B: zahl('3') }), B: zahl('4') },
    );
    const schleife = block(
      'sl_repeat',
      {},
      {
        ANZAHL: zahl('2'),
        ABLAUF: block(
          'sl_if',
          {},
          { BEDINGUNG: bedingung(), DANN: nachricht(rechnung), SONST: nachricht(text('Sonst')) },
        ),
      },
    );
    const code = vbsErzeugen(projektMit(schleife)).code!;
    expect(code).toContain('(SL_Zahl((SL_Zahl(2) + SL_Zahl(3))) * SL_Zahl(4))');
    expect(code).toContain('    If True Then\r\n');
    expect(code).toContain('      MsgBox');
    expect(code).toContain('    End If\r\n  Next');
  });
  it('ordnet fehlende Eingaben und lose aktive Anweisungen einem Baustein zu', () => {
    const unvollstaendig = block('sl_message');
    const p = projektMit(unvollstaendig);
    const lose = nachricht();
    p.editor.blocks!.blocks.push(lose);
    const ergebnis = vbsErzeugen(p);
    expect(ergebnis.code).toBeNull();
    expect(ergebnis.meldungen.find((m) => m.blockId === unvollstaendig.id)?.text).toMatch(/Eingang/);
    expect(ergebnis.meldungen.find((m) => m.blockId === lose.id)?.text).toMatch(/Startablauf/);
  });
  it('akzeptiert genau einen Start und passende Verbindungstypen', () => {
    const p = neuesProjekt();
    p.editor.blocks!.blocks.push(block('sl_start'));
    expect(vbsErzeugen(p).code).toBeNull();
    expect(
      vbsErzeugen(projektMit(block('sl_repeat', {}, { ANZAHL: text(), ABLAUF: nachricht() }))).code,
    ).toBeNull();
    expect(vbsErzeugen(projektMit(nachricht(block('sl_start')))).code).toBeNull();
  });
  it('meldet auch aktive lose Folger eines deaktivierten Wurzelbausteins', () => {
    const p = neuesProjekt();
    const loserAnfang = block('sl_comment', { TEXT: 'Deaktiviert' });
    const aktiveNachricht = nachricht();
    loserAnfang.enabled = false;
    loserAnfang.next = { block: aktiveNachricht };
    p.editor.blocks!.blocks.push(loserAnfang);
    const ergebnis = vbsErzeugen(p);
    expect(ergebnis.code).toBeNull();
    expect(ergebnis.meldungen).toContainEqual({
      blockId: aktiveNachricht.id,
      text: expect.stringMatching(/Startablauf/),
      stufe: 'fehler',
    });
  });
  it('warnt nachvollziehbar vor einer Verwendung vor erster Zuweisung', () => {
    const lesen = block('sl_get', { VAR: 'Später' });
    const p = projektMit(nachricht(lesen), block('sl_set', { VAR: 'Später' }, { WERT: text('Wert') }));
    const ergebnis = vbsErzeugen(p);
    expect(ergebnis.code).not.toBeNull();
    expect(ergebnis.meldungen).toContainEqual({
      blockId: lesen.id,
      text: expect.stringMatching(/ersten Zuweisung/),
      stufe: 'hinweis',
    });
  });
  it('weist fehlende Variablen, Platzhalterpfade und unzulässige Wiederholungen zurück', () => {
    expect(vbsErzeugen(projektMit(nachricht(block('sl_get', { VAR: 'Fehlt' })))).code).toBeNull();
    expect(
      vbsErzeugen(projektMit(block('sl_delete', { RUECKFRAGE: 'JA' }, { PFAD: text('C:\\*') }))).code,
    ).toBeNull();
    expect(
      vbsErzeugen(projektMit(block('sl_repeat', {}, { ANZAHL: zahl('1,5'), ABLAUF: nachricht() }))).code,
    ).toBeNull();
  });
  it('erzeugt relative Pfade, definierte Zielregeln und eine sichere Löschrückfrage', () => {
    const p = projektMit(
      block(
        'sl_copy',
        { ZIELREGEL: 'FEHLER' },
        { QUELLE: text('Testdaten\\Quelle.txt'), ZIEL: text('Testdaten\\Backup.txt') },
      ),
      block('sl_delete', { RUECKFRAGE: 'JA' }, { PFAD: text('Testdaten\\Backup.txt') }),
    );
    const code = vbsErzeugen(p).code!;
    expect(code).toContain('WScript.ScriptFullName');
    expect(code).toContain('vbDefaultButton2');
    expect(code).toContain('vorhanden');
    expect(code.match(/Sub SL_Kopieren\(/g)).toHaveLength(1);
  });
  it('initialisiert die Windows-Dateikomponente innerhalb des geschützten Hauptablaufs', () => {
    const code = vbsErzeugen(
      projektMit(block('sl_mkdir', {}, { PFAD: text('ScriptLab-Testdaten\\Neuer Ordner') })),
    ).code!;
    const beginnHauptablauf = code.indexOf('Sub SL_Haupt()');
    expect(code.slice(0, beginnHauptablauf)).toContain('Dim sl_fso');
    expect(code.slice(0, beginnHauptablauf)).not.toContain('CreateObject');
    expect(code).toContain('Sub SL_Haupt()\r\n  Set sl_fso = CreateObject("Scripting.FileSystemObject")');
    expect(code).toContain('On Error Resume Next\r\n  SL_Haupt\r\n  nummer = Err.Number');
  });
  for (const def of bausteinDefinitionen)
    it(`bietet gültige Definition und Generator für ${def.typ}`, () => {
      const ziel = vorlage(def);
      const vorbereiten = [
        block('sl_set', { VAR: 'Mein Wert' }, { WERT: text('Wert') }),
        block('sl_set', { VAR: 'Meine Liste' }, { WERT: block('sl_list') }),
      ];
      const p =
        def.form === 'start'
          ? projektMit(nachricht(text('Hallo! Erstellt mit ScriptLab.')))
          : projektMit(...vorbereiten, def.form === 'wert' ? nachricht(ziel) : ziel);
      const ergebnis = vbsErzeugen(p);
      expect(ergebnis.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
      expect(ergebnis.code).not.toBeNull();
      const code = ergebnis.code!;
      const definitionen = [...code.matchAll(/^(?:Function|Sub) (SL_\w+)/gm)].map((t) => t[1].toLowerCase());
      const aufrufe = new Set(
        [...code.matchAll(/\b(SL_[A-Za-z]+)\b/g)]
          .map((t) => t[1].toLowerCase())
          .filter((t) => t !== 'sl_block'),
      );
      for (const aufruf of aufrufe) expect(definitionen, `fehlender Helfer ${aufruf}`).toContain(aufruf);
    });
});

describe('Blockly-Definitionen und gespeicherte Verbindungen', () => {
  registriereBausteine();
  it('erreicht für jede Blockfarbe mit weißer Schrift mindestens 4,5:1 WCAG-Kontrast', () => {
    // Unabhängige sRGB-Linearisierung gemäß WCAG; kein aus der Palette abgeleiteter Sollwert.
    function luminanz(hex: string): number {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
      const kanal = (start: number): number => {
        const srgb = parseInt(hex.slice(start, start + 2), 16) / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
    }
    for (const farbe of new Set(bausteinDefinitionen.map((def) => def.farbe))) {
      const kontrast = (1 + 0.05) / (luminanz(farbe) + 0.05);
      expect(kontrast, `Weiße Schrift auf ${farbe}: ${kontrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('kann jeden angebotenen Baustein in einem echten Blockly-Workspace anlegen', () => {
    const workspace = new Blockly.Workspace();
    try {
      for (const def of bausteinDefinitionen) {
        const b = workspace.newBlock(def.typ);
        expect(b.type).toBe(def.typ);
        for (const e of def.eingaben) expect(b.getInput(e.name)).toBeTruthy();
        for (const f of def.felder) expect(b.getField(f.name)).toBeTruthy();
      }
    } finally {
      workspace.dispose();
    }
  });
  it('erhält beim Speichern und Laden echte Blockly-IDs, Felder und Verbindungen', () => {
    const workspace = new Blockly.Workspace();
    const zweiter = new Blockly.Workspace();
    try {
      const nachrichtenProjekt = projektMit(nachricht(text('Hallo! Erstellt mit ScriptLab.')));
      Blockly.serialization.workspaces.load(nachrichtenProjekt.editor, workspace);
      const daten = Blockly.serialization.workspaces.save(workspace);
      const p = neuesProjekt();
      p.editor = daten as Projekt['editor'];
      const geprueft = projektPruefen(p);
      Blockly.serialization.workspaces.load(geprueft.editor, zweiter);
      expect(Blockly.serialization.workspaces.save(zweiter)).toEqual(daten);
      expect(vbsErzeugen(geprueft).code).toContain('MsgBox');
    } finally {
      workspace.dispose();
      zweiter.dispose();
    }
  });
  it('erhält Flyout-Schatten, ersetzte Schattenwerte und Arbeitsbereichskommentare', () => {
    const workspace = new Blockly.Workspace();
    const zweiter = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(neuesProjekt().editor, workspace);
      const ausFlyout = Blockly.serialization.blocks.append(
        {
          type: 'sl_message',
          inputs: { TEXT: { shadow: { type: 'sl_text', fields: { TEXT: 'Schattenwert' } } } },
        },
        workspace,
      );
      const ersetzt = workspace.newBlock('sl_text');
      ersetzt.setFieldValue('Echter Wert', 'TEXT');
      ausFlyout.getInput('TEXT')!.connection!.connect(ersetzt.outputConnection!);
      Blockly.serialization.workspaceComments.append(
        { id: 'notiz', text: 'Hinweis an mich', x: 123, y: 456, width: 180, height: 90 },
        workspace,
      );
      const daten = Blockly.serialization.workspaces.save(workspace);
      const p = neuesProjekt();
      p.editor = daten as Projekt['editor'];
      const geprueft = projektPruefen(p);
      Blockly.serialization.workspaces.load(geprueft.editor, zweiter);
      expect(Blockly.serialization.workspaces.save(zweiter)).toEqual(daten);
      expect(geprueft.editor.workspaceComments![0].text).toEqual('Hinweis an mich');
    } finally {
      workspace.dispose();
      zweiter.dispose();
    }
  });
});
