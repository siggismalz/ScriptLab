import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { businessNachTyp } from '../src/kern/business-katalog';
import { neuesProjekt } from '../src/kern/projekt';
import { BusinessVorbereitung, businessVorgaben } from '../src/renderer/BusinessVorbereitung';
import { laufPfadangaben, laufPfadwert, laufPfadZusammenfassung } from '../src/renderer/laufpfade';

describe('Quellen und Ziele vor einem Lauf', () => {
  it('ordnet die Excel-Vorlage als Quelle und die neue Datei als Ziel ein', () => {
    const angaben = laufPfadangaben(
      businessNachTyp.get('sl_biz_xlsx_vorlage')!,
      { vorlage: 'vorlagen/Monatsbericht.xlsx', ziel: 'ausgaben/Bericht.xlsx' },
      {},
    );
    expect(angaben.map(({ rolle, wert }) => [rolle, wert.text])).toEqual([
      ['quelle', 'vorlagen/Monatsbericht.xlsx'],
      ['ziel', 'ausgaben/Bericht.xlsx'],
    ]);
    expect(laufPfadZusammenfassung(angaben).text).toBe('Monatsbericht.xlsx → Bericht.xlsx');
  });

  it('kündigt zusätzliche Quellen und Ziele an und zählt gleiche bekannte Quellen nur einmal', () => {
    const quelle = (pfad: string) => laufPfadangaben(businessNachTyp.get('sl_biz_lesen_csv')!, { pfad }, {});
    const ziel = (pfad: string) =>
      laufPfadangaben(businessNachTyp.get('sl_biz_schreiben_xlsx')!, { pfad }, {});
    const zusammenfassung = laufPfadZusammenfassung([
      ...quelle('eingang/Umsaetze.csv'),
      ...quelle('eingang/Umsaetze.csv'),
      ...quelle('eingang/Kunden.csv'),
      ...ziel('ausgaben/Bericht.xlsx'),
      ...ziel('ausgaben/Pruefhinweise.xlsx'),
    ]);
    expect(zusammenfassung.text).toBe('Umsaetze.csv + 1 weitere Quelle → Bericht.xlsx + 1 weiteres Ziel');
    expect(zusammenfassung.titel).toContain('eingang/Kunden.csv');
    expect(zusammenfassung.titel).toContain('ausgaben/Pruefhinweise.xlsx');
  });

  it('unterscheidet bekannte, fehlende und berechnete Pfade ohne einen Pfad zu erfinden', () => {
    expect(laufPfadwert({ parameter: 'Quelldatei' }, { Quelldatei: 'eingang/Quelle.csv' })).toEqual({
      art: 'bekannt',
      text: 'eingang/Quelle.csv',
      pfad: 'eingang/Quelle.csv',
    });
    expect(laufPfadwert({ parameter: 'Quelldatei' }, { Quelldatei: '' })).toEqual({
      art: 'parameter-fehlt',
      text: 'Parameter Quelldatei ist nicht gesetzt',
    });
    expect(laufPfadwert({ parameter: 'Quelldatei' }, {})).not.toHaveProperty('pfad');
    expect(laufPfadwert({ parameter: 'Quelldatei' }, { Quelldatei: 42 })).not.toHaveProperty('pfad');
    expect(laufPfadwert({ variable: 'Dateiname' }, {})).toEqual({
      art: 'berechnet',
      text: 'Wird im betreffenden Schritt berechnet',
    });
    const angaben = laufPfadangaben(
      businessNachTyp.get('sl_biz_xlsx_vorlage')!,
      {
        vorlage: { parameter: 'Vorlage' },
        ziel: { variable: 'Dateiname' },
      },
      {},
    );
    expect(laufPfadZusammenfassung(angaben).text).toBe('Quelle noch offen → Ausgabeziel wird berechnet');
    // Ein wirklicher Dateiname darf nicht anhand eines Meldungstextes verschwinden.
    expect(laufPfadwert('Parameter Monatsbericht.xlsx', {}).art).toBe('bekannt');
  });

  it('führt ausschließlich echte Word-Bildabschnitte als zusätzliche Quellen auf', () => {
    const angaben = laufPfadangaben(
      businessNachTyp.get('sl_biz_docx_erstellen')!,
      {
        ziel: 'ausgaben/Brief.docx',
        abschnitte: [
          { art: 'ABSATZ', text: 'Synthetischer Testtext', pfad: 'kein-bild.png' },
          { art: 'BILD', pfad: { parameter: 'Logo' } },
        ],
      },
      { Logo: 'vorlagen/Logo.png' },
    );
    expect(angaben.map(({ feldPfad, rolle, wert }) => [feldPfad, rolle, wert.text])).toEqual([
      [['ziel'], 'ziel', 'ausgaben/Brief.docx'],
      [['abschnitte', '1', 'pfad'], 'quelle', 'vorlagen/Logo.png'],
    ]);
  });

  it('zeigt die korrigierte Kurzfassung und vollständige Angaben in der vorhandenen Vorbereitung', () => {
    const projekt = neuesProjekt('python');
    projekt.editor.blocks = {
      languageVersion: 0,
      blocks: [
        {
          type: 'sl_start',
          id: 'start',
          next: {
            block: {
              type: 'sl_biz_xlsx_vorlage',
              id: 'bericht',
              data: JSON.stringify({
                konfiguration: {
                  vorlage: 'vorlagen/Monatsbericht.xlsx',
                  ziel: 'ausgaben/Bericht.xlsx',
                },
                eingaben: {},
              }),
            },
          },
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(BusinessVorbereitung, {
        projekt,
        optionen: { basisVerzeichnis: null, zeitlimitSekunden: 60, business: businessVorgaben },
        gesperrt: false,
        aendern: () => {},
        merken: () => {},
      }),
    );
    expect(html).toContain('Monatsbericht.xlsx → Bericht.xlsx');
    expect(html).toContain('<dd>vorlagen/Monatsbericht.xlsx</dd>');
    expect(html).toContain('<dd>ausgaben/Bericht.xlsx</dd>');
    expect(html).toContain('Nicht überschreiben; mit Fehler abbrechen');
  });
});
