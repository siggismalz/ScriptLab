import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { jsonSchreiben } from '../src/gemeinsam/json';
import { neuesProjekt, projektPruefen } from '../src/kern/projekt';
import { projektHash } from '../src/main/projektablage';
import { testStandHash } from '../src/windows/testlauf';

describe('Iteratives JSON für bestehende Daten- und Hashverträge', () => {
  it('entspricht nativem JSON bei primitiven Werten, Sonderzeichen und Schlüsselreihenfolge', () => {
    const werte = [
      null,
      true,
      false,
      0,
      -0,
      1.125,
      1e-25,
      Number.MAX_VALUE,
      NaN,
      Infinity,
      -Infinity,
      '',
      'Grüße ä 😀\r\n\t\u0000\ud800\u2028\\"',
      [],
      {},
      { ende: 1, text: 'Kein interner Auftrag', wert: 3 },
      { '10': 'zehn', '2': 'zwei', '-1': 'minus', '01': 'Text', z: 'letzter' },
      JSON.parse('{"__proto__":{"daten":true},"constructor":"Daten"}'),
    ];
    for (const wert of werte) expect(jsonSchreiben(wert)).toBe(JSON.stringify(wert));
  });

  it('erhält optionale Objektfelder sowie leere und undefinierte Arrayplätze wie bisher', () => {
    const liste = new Array(4);
    liste[1] = undefined;
    liste[2] = null;
    liste[3] = { vorhanden: 0, ausgelassen: undefined };
    const wert = { liste, optional: undefined, leer: null, falsch: false };
    expect(jsonSchreiben(wert)).toBe(JSON.stringify(wert));
    expect(jsonSchreiben(wert)).toBe('{"liste":[null,null,null,{"vorhanden":0}],"leer":null,"falsch":false}');
  });

  it('dupliziert geteilte Referenzen und verwechselt sie nicht mit einem Zyklus', () => {
    const teil = { werte: [1, { text: 'Original' }] };
    const wert = { a: teil, b: [teil, { c: teil }] };
    const text = jsonSchreiben(wert);
    expect(text).toBe(JSON.stringify(wert));
    const gelesen = JSON.parse(text);
    gelesen.a.werte[1].text = 'Geändert';
    expect(gelesen.b[0].werte[1].text).toBe('Original');
    expect(gelesen.b[1].c.werte[1].text).toBe('Original');
    expect(teil.werte[1]).toEqual({ text: 'Original' });
  });

  it('weist direkte, indirekte und Arrayzyklen ausdrücklich zurück', () => {
    const direkt: Record<string, unknown> = {};
    direkt.selbst = direkt;
    const indirekt: Record<string, unknown> = { innen: {} };
    (indirekt.innen as Record<string, unknown>).aussen = indirekt;
    const liste: unknown[] = [];
    liste.push(liste);
    for (const wert of [direkt, indirekt, liste]) expect(() => jsonSchreiben(wert)).toThrow(/Zyklische/);
  });

  it('lehnt nicht unterstützte Werte ab statt sie als erfolgreiche leere Daten zu speichern', () => {
    for (const wert of [
      undefined,
      () => 1,
      Symbol('Wert'),
      1n,
      new Date(),
      new Map(),
      new Set(),
      new String('Text'),
      /muster/,
    ])
      expect(() => jsonSchreiben(wert)).toThrow(TypeError);
    for (const wert of [{ feld: () => 1 }, [Symbol('Wert')], { zahl: 1n }])
      expect(() => jsonSchreiben(wert)).toThrow(TypeError);
    const toJSON = vi.fn(() => ({ andererInhalt: true }));
    expect(() => jsonSchreiben({ toJSON })).toThrow(TypeError);
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('erhält reine Objekte aus anderen Realms und Objekte ohne Prototyp', () => {
    const fremd = runInNewContext('({ name: "Grüße", werte: [1, null, true] })');
    const ohnePrototyp = Object.assign(Object.create(null), { name: 'Grüße', wert: 0 });
    expect(jsonSchreiben(fremd)).toBe(JSON.stringify(fremd));
    expect(jsonSchreiben(ohnePrototyp)).toBe(JSON.stringify(ohnePrototyp));
  });

  it('erhält JSON-Bytes und SHA-256 bei 300 deterministischen gemischten Datenbäumen', () => {
    let zustand = 26;
    const zufall = () => {
      zustand = (Math.imul(zustand, 1664525) + 1013904223) >>> 0;
      return zustand;
    };
    const erzeugen = (tiefe: number): unknown => {
      const auswahl = zufall() % (tiefe ? 7 : 5);
      if (auswahl === 0) return null;
      if (auswahl === 1) return zufall() % 2 === 0;
      if (auswahl === 2) return (zufall() - 0x80000000) / 100;
      if (auswahl === 3) return `Text ${zufall()} ä \ud800 😀`;
      if (auswahl === 4) return '';
      if (auswahl === 5) return Array.from({ length: zufall() % 5 }, () => erzeugen(tiefe - 1));
      return Object.fromEntries(
        Array.from({ length: zufall() % 5 }, (_, i) => [`Feld-${i}`, erzeugen(tiefe - 1)]),
      );
    };
    for (let i = 0; i < 300; i++) {
      const wert = erzeugen(5);
      const alt = JSON.stringify(wert);
      const neu = jsonSchreiben(wert);
      expect(neu).toBe(alt);
      expect(createHash('sha256').update(neu).digest('hex')).toBe(
        createHash('sha256').update(alt).digest('hex'),
      );
    }
  });

  it('erhält den bisherigen Projekthash und kopiert einen 1000-Blockstand ohne Verweis auf das Original', () => {
    const projekt = neuesProjekt('python');
    const folge = (anzahl: number, name: string) => {
      const start = {
        type: 'sl_comment',
        id: `${name}-0`,
        fields: { TEXT: 'Schritt 0' },
      } as import('../src/kern/projekt').EditorBlock;
      let ende = start;
      for (let i = 1; i < anzahl; i++) {
        ende.next = { block: { type: 'sl_comment', id: `${name}-${i}`, fields: { TEXT: `Schritt ${i}` } } };
        ende = ende.next.block;
      }
      return start;
    };
    projekt.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_if',
        id: 'verzweigung',
        inputs: {
          BEDINGUNG: { block: { type: 'sl_bool', id: 'bedingung', fields: { WERT: 'WAHR' } } },
          DANN: { block: folge(498, 'dann') },
          SONST: { block: folge(499, 'sonst') },
        },
      },
    };
    const text = jsonSchreiben(projekt);
    expect(text).toBe(JSON.stringify(projekt));
    const { ansicht: _ansicht, ...inhalt } = projekt;
    const bisherigerHash = createHash('sha256').update(JSON.stringify(inhalt)).digest('hex');
    expect(projektHash(projekt)).toBe(bisherigerHash);
    expect(testStandHash(projekt)).toBe(bisherigerHash);
    const kopie = projektPruefen(projekt);
    expect(jsonSchreiben(kopie)).toBe(text);
    kopie.editor.blocks!.blocks[0].next!.block.inputs!.DANN.block!.fields!.TEXT = 'Geändert';
    expect(projekt.editor.blocks!.blocks[0].next!.block.inputs!.DANN.block!.fields!.TEXT).toBe('Schritt 0');
  });

  it('schreibt eine 20000 Ebenen tiefe Datenkette ohne rekursiven Aufrufstack', () => {
    const wurzel: Record<string, unknown> = {};
    let ende = wurzel;
    for (let i = 0; i < 20000; i++) {
      ende.next = {};
      ende = ende.next as Record<string, unknown>;
    }
    ende.wert = 'Ende';
    const gelesen = JSON.parse(jsonSchreiben(wurzel));
    let aktuell = gelesen;
    for (let i = 0; i < 20000; i++) aktuell = aktuell.next;
    expect(aktuell).toEqual({ wert: 'Ende' });
  });
});
