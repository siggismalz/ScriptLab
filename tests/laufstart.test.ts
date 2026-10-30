import { describe, expect, it } from 'vitest';
import { neuesProjekt, type Projekt } from '../src/kern/projekt';
import type { TestOptionen } from '../src/gemeinsam/testlauf';
import type { WorkflowParameter } from '../src/kern/business-modell';
import {
  laufOptionenVorbereiten,
  laufParameterPruefen,
  LaufParameterFehler,
} from '../src/renderer/laufstart';

function businessProjekt(): Projekt {
  const p = neuesProjekt('python');
  p.editor.blocks!.blocks[0].next = {
    block: {
      id: 'quelle',
      type: 'sl_biz_lesen_csv',
      data: JSON.stringify({ konfiguration: { format: 'CSV', pfad: 'synthetisch.csv' }, eingaben: {} }),
    },
  };
  return p;
}
const grundoptionen = (): TestOptionen => ({ basisVerzeichnis: 'C:\\Synthetisch', zeitlimitSekunden: 120 });
function businessOptionen(): TestOptionen {
  return {
    ...grundoptionen(),
    zeitlimitSekunden: 60,
    business: {
      modus: 'prueflauf',
      parametersatz: 'echt',
      parameter: { Ordner: 'Laufwert' },
      speicherMB: 1024,
      tempGB: 12,
      fortsetzen: true,
      vorschauBlockId: 'quelle',
    },
  };
}
function parameter(
  name: string,
  typ: WorkflowParameter['typ'],
  standard: WorkflowParameter['standard'],
  erforderlich = true,
): WorkflowParameter {
  return { name, typ, standard, erforderlich, beschriftung: name, hilfe: '' };
}
function parameterProjekt(): Projekt {
  const p = businessProjekt();
  p.business.parameter = [
    parameter('Anzahl', 'Zahl', 5),
    parameter('Freigabe', 'Wahrheitswert', true),
    parameter('Ordner', 'Text', 'Standard'),
    parameter('Datum', 'Datum', '2026-10-31'),
    parameter('Betrag', 'Dezimalbetrag', '12.50'),
  ];
  p.business.parametersaetze = {
    test: { Anzahl: 0, Freigabe: false, Ordner: 'Testquelle' },
    echt: { Anzahl: 20, Ordner: 'Echte Quelle' },
  };
  return p;
}
function parameterFehler(projekt: Projekt, optionen: TestOptionen): LaufParameterFehler {
  try {
    laufParameterPruefen(projekt, optionen);
  } catch (fehler) {
    expect(fehler).toBeInstanceOf(LaufParameterFehler);
    return fehler as LaufParameterFehler;
  }
  throw Error('Die ungültige Parameterangabe wurde nicht abgewiesen.');
}

describe('Laufoptionen unabhängig von der geöffneten Vorbereitung', () => {
  it('bereitet den ersten Businesslauf ohne Formular mit vollständigen Vorgaben vor', () => {
    const p = businessProjekt(),
      o = grundoptionen();
    const vorher = JSON.stringify([p, o]);
    const vorbereitet = laufOptionenVorbereiten(p, o, false);
    expect(vorbereitet).toEqual({
      basisVerzeichnis: o.basisVerzeichnis,
      zeitlimitSekunden: 7200,
      business: {
        modus: 'prueflauf',
        parametersatz: 'test',
        parameter: {},
        speicherMB: 512,
        tempGB: 4,
        fortsetzen: false,
      },
    });
    expect(JSON.stringify([p, o])).toBe(vorher);
    vorbereitet.business!.parameter.EigenerWert = 1;
    expect(laufOptionenVorbereiten(p, o, true).business?.parameter).toEqual({});
  });

  it('startet direkt tatsächlich den ganzen Workflow und erhält die bewussten Laufwerte', () => {
    const p = businessProjekt(),
      o = businessOptionen(),
      vorher = structuredClone(o);
    const direkt = laufOptionenVorbereiten(p, o, true);
    expect(direkt.business).toEqual({
      modus: 'ausfuehren',
      parametersatz: 'echt',
      parameter: { Ordner: 'Laufwert' },
      speicherMB: 1024,
      tempGB: 12,
      fortsetzen: true,
    });
    expect(direkt.zeitlimitSekunden).toBe(7200);
    expect(direkt.business).not.toHaveProperty('vorschauBlockId');
    expect(o).toEqual(vorher);
    expect(laufOptionenVorbereiten(p, o, false)).toEqual(vorher);
  });

  it.each(['vorschau', 'prueflauf'] as const)(
    'ersetzt beim Direktstart nur typische Kurzbudgets aus %s',
    (modus) => {
      for (const zeitlimitSekunden of [15, 30, 60]) {
        const o = businessOptionen();
        o.business!.modus = modus;
        o.zeitlimitSekunden = zeitlimitSekunden;
        expect(laufOptionenVorbereiten(businessProjekt(), o, true).zeitlimitSekunden).toBe(7200);
        expect(laufOptionenVorbereiten(businessProjekt(), o, false).zeitlimitSekunden).toBe(
          zeitlimitSekunden,
        );
      }
    },
  );

  it('erhält absichtlich kurze echte Läufe und eigene beziehungsweise große Budgets', () => {
    const p = businessProjekt();
    for (const zeitlimitSekunden of [15, 30, 60, 47, 120, 28800]) {
      const o = businessOptionen();
      o.zeitlimitSekunden = zeitlimitSekunden;
      o.business!.modus = 'ausfuehren';
      expect(laufOptionenVorbereiten(p, o, true).zeitlimitSekunden).toBe(zeitlimitSekunden);
    }
    const eigenes = businessOptionen();
    eigenes.zeitlimitSekunden = 47;
    expect(laufOptionenVorbereiten(p, eigenes, true).zeitlimitSekunden).toBe(47);
  });

  it.each(['python', 'vbs'] as const)(
    'entfernt alte Businessoptionen aus einem normalen %s-Ablauf',
    (sprache) => {
      const p = neuesProjekt(sprache),
        o = businessOptionen(),
        vorher = structuredClone(o);
      expect(laufOptionenVorbereiten(p, o, true)).toEqual({
        basisVerzeichnis: o.basisVerzeichnis,
        zeitlimitSekunden: o.zeitlimitSekunden,
      });
      expect(laufOptionenVorbereiten(p, o, false)).not.toHaveProperty('business');
      expect(o).toEqual(vorher);
    },
  );

  it('verwendet deaktivierte oder unverbundene Businessblöcke nicht als Laufkontext', () => {
    const p = businessProjekt();
    p.editor.blocks!.blocks[0].next!.block.enabled = false;
    p.editor.blocks!.blocks.push({ type: 'sl_biz_lesen_csv', id: 'lose' });
    expect(laufOptionenVorbereiten(p, businessOptionen(), true)).not.toHaveProperty('business');
  });
});

describe('Parameterprüfung vor jedem tatsächlichen Businessstart', () => {
  it('verwendet Standards, gewählten Parametersatz und Overrides in dieser Reihenfolge', () => {
    const p = parameterProjekt(),
      o = businessOptionen();
    p.business.parametersaetze.test.Anzahl = 'ungueltig';
    p.business.parametersaetze.echt.Anzahl = 'ebenfalls ungueltig';
    o.business!.parameter.Anzahl = 0;
    o.business!.parameter.Freigabe = false;
    const vorher = JSON.stringify([p, o]);
    expect(() => laufParameterPruefen(p, o)).not.toThrow();
    expect(JSON.stringify([p, o])).toBe(vorher);
    delete o.business!.parameter.Anzahl;
    expect(parameterFehler(p, o).parameterName).toBe('Anzahl');
  });

  it('akzeptiert gültige fehlende Overrides mit Standardwert sowie 0 und false im Testsatz', () => {
    const p = parameterProjekt();
    expect(() => laufParameterPruefen(p, grundoptionen())).not.toThrow();
    const o = businessOptionen();
    o.business!.parametersatz = 'test';
    o.business!.parameter = {};
    expect(() => laufParameterPruefen(p, o)).not.toThrow();
    p.business.parametersaetze.echt.Freigabe = null;
    o.business!.parametersatz = 'echt';
    expect(parameterFehler(p, o).parameterName).toBe('Freigabe');
  });

  it.each([null, ''])(
    'ersetzt die ausdrücklich geleerte Pflichtangabe %s nicht durch den Standard',
    (wert) => {
      const p = parameterProjekt(),
        o = businessOptionen();
      o.business!.parameter.Ordner = wert;
      const fehler = parameterFehler(p, o);
      expect(fehler.parameterName).toBe('Ordner');
      expect(fehler.message).toBe('Fülle den Workflowparameter „Ordner“ aus.');
    },
  );

  it.each([
    ['Anzahl', '12', 'gültige Zahl'],
    ['Freigabe', 'nein', 'Ja oder Nein'],
    ['Datum', '2026-02-30', 'gültiges Datum'],
    ['Betrag', '12,50', 'Dezimalbetrag'],
  ])('ordnet die ungültige Angabe %s ihrem Feld zu', (name, wert, meldung) => {
    const o = businessOptionen();
    o.business!.parameter[name] = wert;
    const fehler = parameterFehler(parameterProjekt(), o);
    expect(fehler.parameterName).toBe(name);
    expect(fehler.message).toContain(meldung);
  });

  it.each(['parametersatz', 'laufwerte'])(
    'weist unbekannte Namen aus %s ohne erfundenes Zielfeld ab',
    (quelle) => {
      const p = parameterProjekt(),
        o = businessOptionen();
      if (quelle === 'parametersatz') p.business.parametersaetze.echt.AlterName = 'Alt';
      else o.business!.parameter.AlterName = 'Alt';
      const fehler = parameterFehler(p, o);
      expect(fehler.parameterName).toBeNull();
      expect(fehler.message).toContain('unbekannte Parameternamen');
    },
  );

  it('identifiziert das erste tatsächlich ungültige Feld ohne Auswertung eines Meldungstextes', () => {
    const p = parameterProjekt(),
      o = businessOptionen();
    o.business!.parameter = { AlterName: 'Alt', Ordner: '', Anzahl: 'keine Zahl' };
    const fehler = parameterFehler(p, o);
    expect(fehler.parameterName).toBe('Anzahl');
    expect(fehler.message).toBe('Der Parameter „Anzahl“ benötigt eine gültige Zahl.');
    o.business!.parameter.Anzahl = 0;
    expect(parameterFehler(p, o).parameterName).toBe('Ordner');
    o.business!.parameter.Ordner = 'Gültig';
    expect(parameterFehler(p, o).parameterName).toBeNull();
  });

  it('fixiert weder geerbte Standards noch optionale Leerwerte in den Laufoptionen', () => {
    const p = parameterProjekt(),
      o = businessOptionen();
    p.business.parameter.push(parameter('Hinweis', 'Text', 'Standardhinweis', false));
    o.business!.parameter.Hinweis = '';
    expect(laufParameterPruefen(p, o)).toBeUndefined();
    expect(o.business!.parameter).toEqual({ Ordner: 'Laufwert', Hinweis: '' });
  });

  it('blockiert Grundworkflows nicht wegen ungenutzter Parameterreste', () => {
    const p = parameterProjekt();
    delete p.editor.blocks!.blocks[0].next;
    p.business.parametersaetze.test.Anzahl = 'Altwert';
    expect(() => laufParameterPruefen(p, businessOptionen())).not.toThrow();
  });
});
