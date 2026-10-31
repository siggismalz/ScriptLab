import {
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type DragEvent,
  type ChangeEvent,
  type FocusEvent,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Blockly from 'blockly/core';
import { DateipfadFeld } from '../src/renderer/komponenten/DateipfadFeld';
import { Feld } from '../src/renderer/komponenten/Feld';
import { Knopf } from '../src/renderer/komponenten/Knopf';
import { ParameterWertEingabe } from '../src/renderer/ParameterDialog';
import { BusinessEigenschaften } from '../src/renderer/BusinessEigenschaften';
import { businessDefinitionen } from '../src/kern/business-katalog';
import type { JsonWert, WorkflowParameter } from '../src/kern/business-modell';

// Der bestehende Testweg hat keinen Browser-DOM. Der schmale Hookhalter führt
// echte Komponentenhandler mit kontrolliertem Zustand aus; SSR nutzt echte Hooks.
const hooks = vi.hoisted(() => ({ aktiv: false, index: 0, werte: [] as unknown[] }));
vi.mock('react', async (originalImport) => {
  const original = await originalImport<typeof import('react')>();
  return {
    ...original,
    useState: (initial: unknown) => {
      if (!hooks.aktiv) return original.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.werte)) hooks.werte[index] = typeof initial === 'function' ? initial() : initial;
      return [
        hooks.werte[index],
        (wert: unknown) => {
          hooks.werte[index] = typeof wert === 'function' ? wert(hooks.werte[index]) : wert;
        },
      ];
    },
    useRef: (initial: unknown) => {
      if (!hooks.aktiv) return original.useRef(initial);
      const index = hooks.index++;
      if (!(index in hooks.werte)) hooks.werte[index] = { current: initial };
      return hooks.werte[index];
    },
    useId: () => (hooks.aktiv ? `pfad-unit-${hooks.index++}` : original.useId()),
  };
});

const pfadLesen = vi.fn<(datei: File) => string>();
const hint = 'Datei hier ablegen oder Pfad eingeben';
const neuerPfad = 'C:\\Eigene Dateien\\Kunden ä \' " ;.csv';

beforeEach(() => {
  hooks.aktiv = false;
  hooks.index = 0;
  hooks.werte = [];
  pfadLesen.mockReset().mockReturnValue(neuerPfad);
  vi.stubGlobal('window', { scriptlab: { dateipfadAusDatei: pfadLesen } });
});
afterEach(() => {
  hooks.aktiv = false;
  vi.unstubAllGlobals();
});

function finden<P>(baum: ReactNode, typ: unknown): ReactElement<P> {
  const gefunden = suchen<P>(baum, typ);
  if (!gefunden) throw new Error('Das erwartete bestehende Eingabeelement fehlt.');
  return gefunden;
}
function suchen<P>(baum: ReactNode, typ: unknown): ReactElement<P> | undefined {
  if (Array.isArray(baum)) {
    for (const kind of baum) {
      const gefunden = suchen<P>(kind, typ);
      if (gefunden) return gefunden;
    }
  } else if (isValidElement<{ children?: ReactNode }>(baum)) {
    if (baum.type === typ) return baum as ReactElement<P>;
    return suchen<P>(baum.props.children, typ);
  }
}
function aufbauen(props: ComponentProps<typeof DateipfadFeld>) {
  hooks.aktiv = true;
  hooks.index = 0;
  return DateipfadFeld(props);
}
function eingabe(baum: ReactNode) {
  return finden<ComponentProps<typeof Feld>>(baum, Feld).props;
}
function ablage(dateien: File[] = [new File(['synthetisch'], 'Quelle.csv')]) {
  return {
    files: dateien,
    types: dateien.length ? ['Files'] : ['text/plain'],
    dropEffect: 'none',
  } as unknown as DataTransfer;
}
function ereignis(daten = ablage(), ziel = {}) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: daten,
    currentTarget: { disabled: false, readOnly: false, matches: () => false, ...ziel },
  } as unknown as DragEvent<HTMLInputElement>;
}

describe('Dateiablage ausschließlich im konkreten Pfadfeld', () => {
  it('behält Label, Pfad und Hilfe ohne eine Übernahme beim Rendern', () => {
    const uebernehmen = vi.fn();
    const html = renderToStaticMarkup(
      createElement(DateipfadFeld, {
        beschriftung: 'CSV-Quelle',
        value: 'C:\\Alter Pfad.csv',
        hilfe: 'Vorhandene Quelldatei',
        pfadAendern: uebernehmen,
      }),
    );
    expect(html).toContain('CSV-Quelle');
    expect(html).toContain('value="C:\\Alter Pfad.csv"');
    expect(html).toContain('Vorhandene Quelldatei');
    expect(html).toContain(hint);
    expect(html).toContain('aria-describedby=');
    expect(uebernehmen).not.toHaveBeenCalled();
    expect(pfadLesen).not.toHaveBeenCalled();
  });

  it('übernimmt nur den echten aufgelösten Pfad, fängt die Ablage ab und ruft keine weiteren Aktionen auf', () => {
    const uebernehmen = vi.fn();
    const props = { beschriftung: 'Datei', value: 'Alt.csv', pfadAendern: uebernehmen };
    const e = ereignis();
    eingabe(aufbauen(props)).onDrop!(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(e.stopPropagation).toHaveBeenCalledOnce();
    expect(pfadLesen).toHaveBeenCalledExactlyOnceWith(e.dataTransfer.files[0]);
    expect(uebernehmen).toHaveBeenCalledExactlyOnceWith(neuerPfad);
  });

  it('löst bei Drag-over keine Pfadauflösung aus und erlaubt weiterhin normales Tippen', () => {
    const tippen = vi.fn();
    const feld = eingabe(
      aufbauen({ beschriftung: 'Datei', value: '', onChange: tippen, pfadAendern: vi.fn() }),
    );
    const drag = ereignis();
    feld.onDragOver!(drag);
    expect(drag.dataTransfer.dropEffect).toBe('copy');
    expect(pfadLesen).not.toHaveBeenCalled();
    const aenderung = { target: { value: 'D:\\Manueller Pfad.csv' } } as ChangeEvent<HTMLInputElement>;
    feld.onChange!(aenderung);
    expect(tippen).toHaveBeenCalledExactlyOnceWith(aenderung);
  });

  it.each(['disabled', 'readOnly', 'fieldset'] as const)(
    'ändert %s-Felder auch mit einem älteren Handler nicht',
    (sperre) => {
      const uebernehmen = vi.fn();
      const props = { beschriftung: 'Datei', value: 'Original.csv', pfadAendern: uebernehmen };
      const alt = eingabe(aufbauen(props)).onDrop!;
      aufbauen({ ...props, ...(sperre === 'fieldset' ? {} : { [sperre]: true }) });
      const e = ereignis(ablage(), sperre === 'fieldset' ? { matches: () => true } : {});
      alt(e);
      expect(e.preventDefault).toHaveBeenCalledOnce();
      expect(e.stopPropagation).toHaveBeenCalledOnce();
      expect(uebernehmen).not.toHaveBeenCalled();
      expect(pfadLesen).not.toHaveBeenCalled();
    },
  );

  it.each(['mehrfach', 'text', 'virtuell'] as const)('erklärt %s-Ablage ohne Wertänderung', (art) => {
    const uebernehmen = vi.fn();
    const props = { beschriftung: 'Datei', value: 'Original.csv', pfadAendern: uebernehmen };
    if (art === 'virtuell') pfadLesen.mockReturnValue('');
    const daten =
      art === 'text'
        ? ablage([])
        : art === 'mehrfach'
          ? ablage([new File([], 'A.csv'), new File([], 'B.csv')])
          : ablage();
    eingabe(aufbauen(props)).onDrop!(ereignis(daten));
    const baum = aufbauen(props);
    const meldung = finden<{ role: string; children: string; id: string }>(baum, 'p').props;
    expect(meldung.role).toBe('alert');
    expect(meldung.children).toMatch(/(genau eine|keinen lokalen Dateipfad)/);
    expect(eingabe(baum)['aria-describedby']).toContain(meldung.id);
    expect(eingabe(baum)['aria-invalid']).toBe(true);
    expect(eingabe(baum).value).toBe('Original.csv');
    expect(uebernehmen).not.toHaveBeenCalled();
  });

  it('markiert eine Parameterablage vor Änderung und verliert sie nicht durch nachfolgenden Blur', () => {
    const aufrufe: string[] = [];
    hooks.aktiv = true;
    const baum = ParameterWertEingabe({
      typ: 'Datei',
      beschriftung: 'Quelle',
      wert: 'Alt.csv',
      beiPfadUebernahme: () => aufrufe.push('bewusste Eingabe'),
      aendern: (wert) => aufrufe.push(`Wert:${wert}`),
    });
    const feld = finden<ComponentProps<typeof DateipfadFeld>>(baum, DateipfadFeld).props;
    feld.onFocus!({ target: { value: 'Alt.csv' } } as FocusEvent<HTMLInputElement>);
    feld.onChange!({ target: { value: 'Tippentwurf.csv' } } as ChangeEvent<HTMLInputElement>);
    aufrufe.length = 0;
    feld.pfadAendern(neuerPfad);
    feld.onBlur!({ target: { value: 'Tippentwurf.csv' } } as FocusEvent<HTMLInputElement>);
    expect(aufrufe).toEqual(['bewusste Eingabe', `Wert:${neuerPfad}`]);
  });

  it('übernimmt eine verspätete Dateiauswahl nicht nach nachträglicher Laufsperre', async () => {
    let freigeben!: (pfad: string) => void;
    const warten = new Promise<string>((fertig) => {
      freigeben = fertig;
    });
    const aendern = vi.fn();
    const markieren = vi.fn();
    const props = {
      typ: 'Datei' as const,
      beschriftung: 'Quelle',
      wert: 'Original.csv',
      aendern,
      dateiWaehlen: () => warten,
      beiPfadUebernahme: markieren,
    };
    hooks.aktiv = true;
    const baum = ParameterWertEingabe(props);
    const auswahl = finden<ComponentProps<typeof Knopf>>(baum, Knopf).props.onClick!({} as never);
    hooks.index = 0;
    ParameterWertEingabe({ ...props, gesperrt: true });
    freigeben(neuerPfad);
    await auswahl;
    expect(aendern).not.toHaveBeenCalled();
    expect(markieren).not.toHaveBeenCalled();
  });

  it.each(['Datei', 'Dokument', 'Dokumentvorlage'] as const)(
    'bietet %s-Parameter mit bestehender Dateiauswahl an',
    (typ) => {
      const auswahl = vi.fn(async () => null);
      const html = renderToStaticMarkup(
        createElement(ParameterWertEingabe, {
          typ,
          wert: '',
          beschriftung: 'Quelle',
          aendern: vi.fn(),
          dateiWaehlen: auswahl,
        }),
      );
      expect(html).toContain(hint);
      expect(html).toContain('Datei auswählen');
      expect(auswahl).not.toHaveBeenCalled();
    },
  );

  it('lässt generische Texte und Zahlen ohne Dateiablage', () => {
    for (const typ of ['Text', 'Zahl'] as const) {
      const html = renderToStaticMarkup(
        createElement(ParameterWertEingabe, { typ, wert: 'abc', beschriftung: 'Textfeld', aendern: vi.fn() }),
      );
      expect(html).not.toContain(hint);
    }
  });
});

function formular(typ: string, konfiguration: Record<string, JsonWert>, parameter: WorkflowParameter[] = []) {
  const definition = businessDefinitionen.find((d) => d.typ === typ)!;
  const block = {
    id: 'pfad',
    type: typ,
    data: JSON.stringify({ konfiguration, eingaben: {} }),
    getFieldValue: () => definition.name,
  } as unknown as Blockly.Block;
  const ws = {
    getAllBlocks: () => [block],
    getVariableMap: () => ({ getAllVariables: () => [] }),
  } as unknown as Blockly.WorkspaceSvg;
  return renderToStaticMarkup(
    createElement(BusinessEigenschaften, { ws, block, parameter, gesperrt: false, geaendert: vi.fn() }),
  );
}

describe('Pfadfelder bleiben auf vorhandene Quellen begrenzt', () => {
  it('bietet die konkrete CSV-Quelle an und rahmt Ausgabeziele nicht als Ablageziel ein', () => {
    expect(formular('sl_biz_lesen_csv', { pfad: 'Quelle.csv' })).toContain(hint);
    expect(formular('sl_biz_schreiben_csv', { pfad: 'Ergebnis.csv' })).not.toContain(hint);
  });
  it('erhält eine vorhandene Parameterbindung ohne verstecktes Pfadfeld oder Literalwechsel', () => {
    const html = formular('sl_biz_lesen_csv', { pfad: { parameter: 'Quelle' } }, [
      {
        name: 'Quelle',
        beschriftung: 'Eingangsdatei',
        typ: 'Datei',
        erforderlich: true,
        standard: 'Original.csv',
        hilfe: '',
      },
    ]);
    expect(html).toContain('Workflowparameter · Eingangsdatei');
    expect(html).not.toContain(hint);
    expect(pfadLesen).not.toHaveBeenCalled();
  });
  it('ergänzt die eigene TTF-Quelle, lässt die mitgelieferte Schrift unverändert', () => {
    expect(formular('sl_biz_pdf_bericht', { schrift: 'C:\\Schriften\\Eigene.ttf' })).toContain(hint);
    expect(formular('sl_biz_pdf_bericht', { schrift: 'INTERN:VERA' })).not.toContain(hint);
  });
});
