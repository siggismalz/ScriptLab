import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as Blockly from 'blockly/core';
import {
  ParameterDialog,
  ParameterWertEingabe,
  parameterDialogPruefen,
  parameterTypWechseln,
  parameterWertAusText,
} from '../src/renderer/ParameterDialog';
import { BusinessVorbereitung, businessVorgaben, laufprofilWert } from '../src/renderer/BusinessVorbereitung';
import {
  BusinessEigenschaften,
  KonfigEingabe,
  businessAuswahlText,
  vergleichFuerFormular,
  regelTypAendern,
} from '../src/renderer/BusinessEigenschaften';
import { businessDefinitionen, type KonfigFeld } from '../src/kern/business-katalog';
import { leeresBusinessProjekt, type JsonWert, type WorkflowParameter } from '../src/kern/business-modell';
import { neuesProjekt } from '../src/kern/projekt';
import {
  ausdruckArtSetzen,
  bedingungsGruppeSetzen,
  bedingungAufloesen,
  literalTypSetzen,
  pruefregelArtSetzen,
  pruefregelSpaltenSetzen,
} from '../src/renderer/business-regeln';

const nichts = () => {};
const parameter = (
  typ: WorkflowParameter['typ'] = 'Text',
  standard: WorkflowParameter['standard'] = '',
): WorkflowParameter => ({
  name: 'Wert',
  beschriftung: 'Ein Testwert',
  typ,
  standard,
  erforderlich: true,
  hilfe: 'Nur synthetische Angaben.',
});
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

function formular(
  typ: string,
  konfiguration: Record<string, JsonWert>,
  spalten: string[] = [],
  parameter: WorkflowParameter[] = [],
  variablen: { id: string; name: string }[] = [],
) {
  const def = businessDefinitionen.find((d) => d.typ === typ)!;
  const block = {
    id: 'auswahl',
    type: typ,
    data: JSON.stringify({ konfiguration, eingaben: {} }),
    getFieldValue: () => def.name,
  } as unknown as Blockly.Block;
  const ws = {
    getAllBlocks: () => [block],
    getVariableMap: () => ({
      getAllVariables: () => variablen.map((v) => ({ getId: () => v.id, getName: () => v.name })),
    }),
  } as unknown as Blockly.WorkspaceSvg;
  return render(
    createElement(BusinessEigenschaften, {
      ws,
      block,
      parameter,
      spalten,
      gesperrt: false,
      geaendert: nichts,
    }),
  );
}

describe('Verständliche, typisierte Business-Formulare', () => {
  it('wechselt UND und ODER direkt und erhält Kinder sowie bestehende Angaben unverändert', () => {
    const kinder = [
      {
        art: 'vergleich',
        spalte: 'Region',
        operator: 'EQ',
        wert: { art: 'wert', typ: 'TEXT', wert: 'Nord' },
      },
      { art: 'vergleich', spalte: 'Betrag', operator: 'GT', wert: { art: 'wert', typ: 'ZAHL', wert: 100 } },
    ];
    const vorher = { art: 'UND', kinder };
    const oder = bedingungsGruppeSetzen(vorher, 'ODER');
    expect(oder).toEqual({ art: 'ODER', kinder });
    expect(bedingungsGruppeSetzen(oder, 'UND')).toEqual(vorher);
    expect(vorher).toEqual({ art: 'UND', kinder });
    expect(bedingungsGruppeSetzen(kinder[0], 'UND')).toEqual({ art: 'UND', kinder: [kinder[0]] });
  });
  it('wandelt Zahleneingaben erst passend um und macht aus leeren oder ungültigen Angaben keine 0', () => {
    expect(parameterWertAusText('Zahl', '12,5')).toBe(12.5);
    expect(parameterWertAusText('Zahl', '-1.25')).toBe(-1.25);
    expect(parameterWertAusText('Zahl', '')).toBeNull();
    expect(parameterWertAusText('Zahl', '-')).toBe('-');
    expect(parameterWertAusText('Zahl', '1e999')).toBe('1e999');
    expect(parameterWertAusText('Text', '001')).toBe('001');
    expect(parameterWertAusText('Dezimalbetrag', '123456789012345.67')).toBe('123456789012345.67');
  });
  it('konvertiert einen Standardwert beim bewussten Typwechsel oder lässt ihn leer', () => {
    expect(parameterTypWechseln(parameter('Text', '12,5'), 'Zahl').standard).toBe(12.5);
    expect(parameterTypWechseln(parameter('Text', 'Ja'), 'Wahrheitswert').standard).toBe(true);
    expect(parameterTypWechseln(parameter('Text', 'Nein'), 'Wahrheitswert').standard).toBe(false);
    expect(parameterTypWechseln(parameter('Text', 'Dateiname'), 'Zahl').standard).toBeNull();
    expect(parameterTypWechseln(parameter('Text', 'Dateiname'), 'Wahrheitswert').standard).toBeNull();
    expect(parameterTypWechseln(parameter('Zahl', 25), 'Text').standard).toBe('25');
  });
  it('prüft Standards typisiert, erlaubt erst beim Lauf ausgefüllte Pflichtangaben und entfernt alte Parametersatzkeys', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [
      parameter('Zahl', '12,5'),
      { ...parameter('Wahrheitswert', true), name: 'Freigabe' },
      { ...parameter('Text', null), name: 'ErstBeimLauf' },
    ];
    business.parametersaetze = { test: { Wert: 2, Alt: 99 }, echt: { Freigabe: false, Umbenannt: 'alt' } };
    const vorher = structuredClone(business);
    const geprueft = parameterDialogPruefen(business);
    expect(geprueft.parameter.map((p) => p.standard)).toEqual([12.5, true, null]);
    expect(geprueft.parametersaetze).toEqual({ test: { Wert: 2 }, echt: { Freigabe: false } });
    expect(business).toEqual(vorher);
    expect(() =>
      parameterDialogPruefen({ ...business, parameter: [parameter('Zahl', 'keine Zahl')] }),
    ).toThrow('gültige Zahl');
  });
  it('zeigt einen Ja/Nein-Standard als echte Auswahl und lässt false unterscheidbar von leer', () => {
    const html = render(
      createElement(ParameterWertEingabe, {
        typ: 'Wahrheitswert',
        wert: false,
        aendern: nichts,
        beschriftung: 'Freigabe',
      }),
    );
    expect(html).toContain('<option value="nein" selected="">Nein</option>');
    expect(html).toContain('<option value="ja">Ja</option>');
    expect(html).not.toContain('<input');
    const leer = render(
      createElement(ParameterWertEingabe, {
        typ: 'Wahrheitswert',
        wert: null,
        aendern: nichts,
        beschriftung: 'Freigabe',
      }),
    );
    expect(leer).toContain('<option value="" selected="">Bitte auswählen</option>');
  });
  it('stellt den Parameterdialog mit passendem Standardfeld dar', () => {
    const business = leeresBusinessProjekt();
    business.parameter = [parameter('Wahrheitswert', true)];
    const html = render(
      createElement(ParameterDialog, { offen: true, business, speichern: nichts, schliessen: nichts }),
    );
    expect(html).toContain('<option value="ja" selected="">Ja</option>');
    expect(html).toContain('Standardwert');
  });
  it('bietet Parameter-Dateiauswahl nur mit Callback an und startet sie nicht durch die Anzeige', () => {
    let auswahlAufrufe = 0;
    const eingabe = {
      typ: 'Datei' as const,
      wert: 'testdaten/quelle.csv',
      beschriftung: 'Quelldatei',
      aendern: nichts,
    };
    const ohneAuswahl = render(createElement(ParameterWertEingabe, eingabe));
    expect(ohneAuswahl).not.toContain('Datei auswählen');
    const mitAuswahl = render(
      createElement(ParameterWertEingabe, {
        ...eingabe,
        dateiWaehlen: async () => {
          auswahlAufrufe++;
          return null;
        },
      }),
    );
    expect(mitAuswahl).toContain('Datei auswählen');
    expect(mitAuswahl).toContain('value="testdaten/quelle.csv"');
    expect(auswahlAufrufe).toBe(0);
    const gesperrt = render(
      createElement(ParameterWertEingabe, {
        ...eingabe,
        gesperrt: true,
        dateiWaehlen: async () => null,
      }),
    );
    expect(gesperrt).toMatch(/<button[^>]*disabled/);
  });
  it('zeigt die tatsächlich gesetzten 15/60/eigenen Sekunden ohne falsches Zweistundenprofil', () => {
    const projekt = neuesProjekt('python');
    projekt.business.parameter = [
      parameter('Wahrheitswert', false),
      { ...parameter('Zahl', 12.5), name: 'Anzahl' },
    ];
    for (const [sekunden, profil] of [
      [15, 'vorschau'],
      [60, 'prueflauf'],
      [47, 'eigenes'],
      [7200, 'business'],
    ] as const) {
      expect(laufprofilWert(sekunden)).toBe(profil);
      const html = render(
        createElement(BusinessVorbereitung, {
          projekt,
          optionen: {
            basisVerzeichnis: 'C:\\Synthetisch',
            zeitlimitSekunden: sekunden,
            business: structuredClone(businessVorgaben),
          },
          aendern: nichts,
          gesperrt: false,
          merken: nichts,
        }),
      );
      expect(html).toContain(`<option value="${profil}" selected="">`);
      expect(html).toContain('Speicherlimit für Datenverarbeitung in MB');
      expect(html).not.toContain('Speicherlimit für Datenverarbeitung in MiB');
      expect(html).toContain('<option value="nein" selected="">Nein</option>');
      expect(html).toContain('Zahl mit Komma oder Punkt');
      expect(html).toContain('value="12.5"');
    }
  });
  it('beschriftet technische Optionen verständlich, ohne ihre Konfigurationswerte zu ändern', () => {
    const feld: KonfigFeld = {
      name: 'art',
      titel: 'Verknüpfungsart',
      art: 'auswahl',
      standard: 'LEFT',
      optionen: ['LEFT', 'INNER', 'FULL'],
    };
    const html = render(createElement(KonfigEingabe, { feld, wert: 'LEFT', aendern: nichts }));
    expect(html).toContain('<option value="LEFT" selected="">Alle Zeilen der ersten Tabelle</option>');
    expect(html).toContain('Nur passende Zeilen beider Tabellen');
    expect(businessAuswahlText('n:1')).toBe('Viele zu einem (n:1)');
    expect(businessAuswahlText('ERSETZEN', 'konflikt')).toContain('Datei');
    expect(businessAuswahlText('ERSETZEN', 'leere')).toBe('Ersatzwert verwenden');
  });
  it('lässt feste gültige Auswahlen weg und hält unbekannte gespeicherte Werte korrigierbar', () => {
    const feld: KonfigFeld = {
      name: 'aktion',
      titel: 'Aktion',
      art: 'auswahl',
      standard: 'AUSWAEHLEN',
      optionen: ['AUSWAEHLEN'],
    };
    let aenderungen = 0;
    const aendern = () => {
      aenderungen++;
    };
    expect(render(createElement(KonfigEingabe, { feld, wert: 'AUSWAEHLEN', aendern }))).toBe('');
    const html = render(createElement(KonfigEingabe, { feld, wert: 'ALTE_AKTION', aendern }));
    expect(html).toContain('<option value="ALTE_AKTION" selected="">ALTE_AKTION · nicht verfügbar</option>');
    expect(html).toContain('<option value="AUSWAEHLEN">Spalten auswählen</option>');
    expect(aenderungen).toBe(0);
  });
  it('zeigt häufige Importangaben direkt und seltene Optionen in weiteren Einstellungen', () => {
    const csv = formular('sl_biz_lesen_csv', { pfad: 'testdaten/umsatz.csv' });
    const csvDirekt = csv.slice(0, csv.indexOf('<details class="business-weitere"'));
    expect(csvDirekt).toContain('Dateipfad');
    expect(csvDirekt).toContain('Trennzeichen');
    expect(csvDirekt).not.toContain('Dateiformat');
    expect(csvDirekt).not.toContain('Zeichenkodierung');
    expect(csv).toContain('<summary>Weitere Einstellungen</summary>');
    expect(csv).toContain('Zeichenkodierung');
    const xlsx = formular('sl_biz_lesen_xlsx', { pfad: 'testdaten/umsatz.xlsx' });
    const xlsxDirekt = xlsx.slice(0, xlsx.indexOf('<details class="business-weitere"'));
    expect(xlsxDirekt).toContain('Arbeitsblatt');
    expect(xlsxDirekt).toContain('Zellbereich');
    expect(xlsxDirekt).not.toContain('Vorhandene Formeln');
    const parquet = formular('sl_biz_lesen_parquet', { pfad: 'testdaten/umsatz.parquet' });
    expect(parquet).not.toContain('Importeinstellungen');
    expect(parquet).not.toContain('Weitere Einstellungen');
  });
  it('erklärt bei fehlenden Quellen den nächsten Schritt statt eines allein leeren Auswahlfelds', () => {
    const html = formular('sl_biz_spalten', { spalten: ['Kundennummer'] });
    expect(html).toContain('Füge vorher eine Datenquelle hinzu und verbinde sie mit dem Ablauf.');
    expect(html).toMatch(/<select[^>]+aria-describedby="[^"]+-hilfe"/);
    expect(html).not.toContain('>Aktion</label>');
  });
  it('zeigt die Standardschrift verständlich und erhält eigene TTF-Pfade als Eingabe', () => {
    const standard = formular('sl_biz_pdf_bericht', { schrift: 'INTERN:VERA' });
    expect(standard).toContain('<option value="mitgeliefert" selected="">Mitgelieferte Schrift</option>');
    expect(standard).not.toContain('INTERN:VERA');
    expect(standard).not.toContain('Pfad zur Schriftdatei');
    const eigene = formular('sl_biz_pdf_bericht', { schrift: 'testdaten/Firmenschrift.ttf' });
    expect(eigene).toContain('<option value="eigene" selected="">Eigene Schriftdatei</option>');
    expect(eigene).toContain('Pfad zur Schriftdatei (TTF)');
    expect(eigene).toContain('value="testdaten/Firmenschrift.ttf"');
  });
  it('zeigt gespeicherte Kurzformbedingungen und ihre Parameter mit denselben tatsächlichen Werten', () => {
    const bedingung = {
      art: 'vergleich',
      spalte: 'Datum',
      operator: 'BEGINNT',
      wert: { art: 'wert', typ: 'TEXT', wert: { parameter: 'Monat' } },
    };
    const vorher = structuredClone(bedingung);
    const html = formular(
      'sl_biz_filtern',
      { bedingung },
      ['Datum', 'Region'],
      [{ ...parameter('Text', '2026-10'), name: 'Monat', beschriftung: 'Berichtsmonat' }],
    );
    expect(html).toContain('value="Datum"');
    expect(html).toContain(
      '<option value="parameter:Monat" selected="">Workflowparameter · Berichtsmonat</option>',
    );
    expect(html).not.toContain('[object Object]');
    expect(vergleichFuerFormular(bedingung)).toEqual({
      art: 'vergleich',
      operator: 'BEGINNT',
      links: { art: 'spalte', name: 'Datum' },
      rechts: bedingung.wert,
    });
    expect(bedingung).toEqual(vorher);
  });
  it('bearbeitet gespeicherte Datumsfunktionen und erhält Argumente sowie Suchmuster unverändert', () => {
    const ausdruck = { art: 'funktion', funktion: 'JAHR', argument: { art: 'spalte', name: 'Datum' } };
    const vorher = structuredClone(ausdruck);
    const html = formular('sl_biz_berechnen', { aktion: 'BERECHNEN', spalte: 'Jahr', ausdruck });
    expect(html).toContain('<option value="JAHR" selected="">Jahreszahl aus einem Datum</option>');
    expect(html).toContain('value="Datum"');
    expect(html).not.toContain('kann hier noch nicht bearbeitet werden');
    expect(html).not.toContain('textarea');
    expect(ausdruck).toEqual(vorher);
    const regex = formular('sl_biz_berechnen', {
      ausdruck: { ...ausdruck, funktion: 'REGEX', muster: '(RE-[0-9]+)', gruppe: 1 },
    });
    expect(regex).toContain('value="(RE-[0-9]+)"');
    expect(regex).toContain('Ergebnisgruppe');
    expect(regex).toContain('value="1"');
  });
  it('zeigt einen einfachen Filter direkt als Spalte, Vergleich und Wert ohne vorgeschaltete Gruppenauswahl', () => {
    const html = formular(
      'sl_biz_filtern',
      {
        bedingung: {
          art: 'vergleich',
          spalte: 'Region',
          operator: 'EQ',
          wert: { art: 'wert', typ: 'TEXT', wert: 'Nord' },
        },
      },
      ['Region'],
    );
    expect(html).toContain('value="Region"');
    expect(html).toContain('value="Nord"');
    expect(html).toContain('<summary>Bedingung erweitern</summary>');
    expect(html).not.toContain('Bedingungen verbinden');
    expect(html).not.toContain('Ein Vergleich');
  });
  it('löst nur verlustfrei auf und ergänzt Berechnungen um vorhandene Ausdrücke', () => {
    const wert = { art: 'spalte', name: 'Datum' };
    expect(ausdruckArtSetzen(wert, 'funktion')).toEqual({
      art: 'funktion',
      funktion: 'JAHR',
      argument: wert,
    });
    expect(ausdruckArtSetzen({ art: 'funktion', funktion: 'JAHR', argument: wert }, 'spalte')).toEqual(wert);
    const gruppe = { art: 'UND', kinder: [{ art: 'vergleich', spalte: 'Region', operator: 'IST_LEER' }] };
    expect(bedingungAufloesen(gruppe)).toEqual(gruppe.kinder[0]);
    const mehrere = { art: 'UND', kinder: [...gruppe.kinder, ...gruppe.kinder] };
    expect(bedingungAufloesen(mehrere)).toEqual(mehrere);
    expect(bedingungAufloesen({ art: 'NICHT', kind: gruppe })).toEqual(gruppe);
  });
  it('erhält feste Werte und Bindungen beim Datentypwechsel statt sie auf 0 oder leer zurückzusetzen', () => {
    expect(literalTypSetzen({ art: 'wert', typ: 'TEXT', wert: '12,5' }, 'ZAHL')).toEqual({
      art: 'wert',
      typ: 'ZAHL',
      wert: 12.5,
    });
    expect(literalTypSetzen({ art: 'wert', typ: 'TEXT', wert: 'keine Zahl' }, 'ZAHL')).toEqual({
      art: 'wert',
      typ: 'ZAHL',
      wert: 'keine Zahl',
    });
    expect(literalTypSetzen({ art: 'wert', typ: 'TEXT', wert: { parameter: 'Monat' } }, 'DATUM')).toEqual({
      art: 'wert',
      typ: 'DATUM',
      wert: { parameter: 'Monat' },
    });
  });
  it('zeigt Literalobjekte aus Qualitätsregeln als Werte statt als objectObject oder leeres Feld', () => {
    const feld: KonfigFeld = { name: 'minimum', titel: 'Minimum', art: 'text', standard: '' };
    const html = render(
      createElement(KonfigEingabe, {
        feld,
        wert: { art: 'wert', typ: 'DEZIMAL', wert: '10.25' },
        aendern: nichts,
      }),
    );
    expect(html).toContain('value="10.25"');
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('Exakter Betrag mit Punkt');
  });
  it('bietet bounded Spaltenvorschläge auch bei Join- und Gruppierfeldern an', () => {
    const html = formular(
      'sl_biz_gruppieren',
      { schluessel: ['Region'], aggregate: [{ funktion: 'SUMME', spalte: 'Betrag', name: 'Summe' }] },
      ['Region', 'Betrag', 'Region', ...Array.from({ length: 250 }, (_, i) => `Feld${i}`)],
    );
    const datalist = html.match(/<datalist id="business-spalten-[^"]+">([\s\S]*?)<\/datalist>/)![1];
    expect(datalist.match(/<option/g)).toHaveLength(200);
    expect(datalist).toContain('value="Region"');
    expect(datalist).toContain('value="Betrag"');
    expect(html.match(/list="business-spalten-[^"]+"/g)?.length).toBeGreaterThanOrEqual(2);
    const join = formular('sl_biz_verknuepfen', { schluessel: [{ links: 'ID', rechts: 'Kunde' }] }, [
      'ID',
      'Kunde',
    ]);
    expect(join.match(/list="business-spalten-[^"]+"/g)).toHaveLength(2);
  });
  it('zeigt Variablen mit stabiler ID als Datenquelle und bewahrt den Parameterweg', () => {
    const html = formular(
      'sl_biz_lesen_csv',
      { pfad: { variable: 'var-datei' } },
      [],
      [parameter()],
      [{ id: 'var-datei', name: 'Aktuelle Datei' }],
    );
    expect(html).toContain(
      '<option value="variable:var-datei" selected="">Variable · Aktuelle Datei</option>',
    );
    expect(html).toContain('<optgroup label="Workflowparameter">');
    expect(html).toContain('<option value="parameter:Wert">Workflowparameter · Ein Testwert</option>');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('[object Object]');
  });
  it('zeigt eine gewählte Bindung ohne Spiegeltextbox und öffnet Alternativen bei festen Werten erst bei Bedarf', () => {
    const feld: KonfigFeld = { name: 'pfad', titel: 'Dateipfad', art: 'text', standard: '' };
    const gebunden = { parameter: 'Wert' };
    const vorher = structuredClone(gebunden);
    const html = render(
      createElement(KonfigEingabe, { feld, wert: gebunden, aendern: nichts, parameter: [parameter()] }),
    );
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toContain(
      '<option value="parameter:Wert" selected="">Workflowparameter · Ein Testwert</option>',
    );
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<details');
    expect(gebunden).toEqual(vorher);
    const fest = render(
      createElement(KonfigEingabe, { feld, wert: 'quelle.csv', aendern: nichts, parameter: [parameter()] }),
    );
    expect(fest).toContain('value="quelle.csv"');
    expect(fest).toContain('<details><summary>Wertquelle ändern</summary>');
    expect(fest).not.toContain('<details open');
  });
  it('erhält eine nicht mehr definierte Parameterbindung sichtbar, ohne sie beim Rendern zu ersetzen', () => {
    const feld: KonfigFeld = { name: 'pfad', titel: 'Dateipfad', art: 'text', standard: '' };
    const wert = { parameter: 'FruehererPfad' };
    let geaendert = false;
    const html = render(
      createElement(KonfigEingabe, {
        feld,
        wert,
        aendern: () => {
          geaendert = true;
        },
        parameter: [],
      }),
    );
    expect(html).toContain(
      '<option value="parameter:FruehererPfad" selected="">Workflowparameter · FruehererPfad (nicht definiert)</option>',
    );
    expect(geaendert).toBe(false);
    expect(wert).toEqual({ parameter: 'FruehererPfad' });
  });
  it('bietet Steuerungsblöcke nicht als vermeintliche Ergebnisquelle an', () => {
    const quelle = (typ: string, id: string) =>
      ({
        id,
        type: typ,
        getFieldValue: () => businessDefinitionen.find((d) => d.typ === typ)!.name,
      }) as unknown as Blockly.Block;
    const block = {
      ...quelle('sl_biz_archivieren', 'ziel'),
      data: JSON.stringify({ konfiguration: {}, eingaben: { ausgaben: { referenz: 'quelle-valid' } } }),
    } as unknown as Blockly.Block;
    const quellen = [
      block,
      quelle('sl_biz_stapel_schleife', 'quelle-stapel'),
      quelle('sl_biz_fehlerbehandlung', 'quelle-fehler'),
      quelle('sl_biz_schreiben_csv', 'quelle-valid'),
    ];
    const ws = {
      getAllBlocks: () => quellen,
      getVariableMap: () => ({ getAllVariables: () => [] }),
    } as unknown as Blockly.WorkspaceSvg;
    const html = render(
      createElement(BusinessEigenschaften, { ws, block, parameter: [], gesperrt: false, geaendert: nichts }),
    );
    expect(html).toContain('<option value="quelle-valid" selected="">');
    expect(html).not.toContain('value="quelle-stapel"');
    expect(html).not.toContain('value="quelle-fehler"');
  });
  it('zeigt kanonische Regeltypen und erlaubte Literalwerte an und ändert deren Typen gemeinsam', () => {
    const regel = {
      art: 'BEREICH',
      spalte: 'Betrag',
      minimum: { art: 'wert', typ: 'GANZZAHL', wert: 10 },
      maximum: { art: 'wert', typ: 'GANZZAHL', wert: 20 },
    };
    const html = formular('sl_biz_pruefen', {
      regeln: [
        regel,
        { art: 'ERLAUBTE_WERTE', spalte: 'Name', werte: [{ art: 'wert', typ: 'TEXT', wert: 'Nord' }] },
      ],
    });
    expect(html).toContain('value="10"');
    expect(html).toContain('<option value="GANZZAHL" selected="">Ganze Zahl</option>');
    expect(html).toContain('value="Nord"');
    expect(html).not.toContain('[object Object]');
    const neu = regelTypAendern(regel, 'TEXT');
    expect(neu.minimum).toEqual({ art: 'wert', typ: 'TEXT', wert: '10' });
    expect(neu.maximum).toEqual({ art: 'wert', typ: 'TEXT', wert: '20' });
    expect(regel.minimum.typ).toBe('GANZZAHL');
  });
  it('zeigt bei Qualitätsregeln ausschließlich die zur Prüfungsart passenden Felder', () => {
    const pflicht = formular('sl_biz_pruefen', {
      regeln: [{ art: 'NICHT_LEER', spalte: 'Kundennummer', minimum: 10, typ: 'GANZZAHL', werte: ['alt'] }],
    });
    expect(pflicht).toContain('value="Kundennummer"');
    expect(pflicht).not.toContain('>Datentyp</label>');
    expect(pflicht).not.toContain('Grenze (optional)');
    expect(pflicht).not.toContain('>Erlaubte Werte</legend>');
    const zeilen = formular('sl_biz_pruefen', {
      regeln: [{ art: 'ZEILENZAHL', minimum: 3, maximum: 5, spalte: 'Alt' }],
    });
    expect(zeilen).toContain('Mindestens so viele Zeilen (optional)');
    expect(zeilen).toContain('value="3"');
    expect(zeilen).not.toContain('>Spalte</label>');
    expect(zeilen).not.toContain('value="Alt"');
    const erlaubt = formular('sl_biz_pruefen', {
      regeln: [
        {
          art: 'ERLAUBTE_WERTE',
          spalte: 'Freigabe',
          typ: 'WAHRHEIT',
          werte: [{ art: 'wert', typ: 'WAHRHEIT', wert: false }],
        },
      ],
    });
    expect(erlaubt).toContain('>Datentyp</label>');
    expect(erlaubt).toContain('<option value="nein" selected="">Nein</option>');
    expect(erlaubt).not.toContain('Grenze (optional)');
  });
  it('erhält eine alte Einzelspalte bei eindeutigen Schlüsseln und alle Eingaben beim Regelwechsel', () => {
    const regel = {
      art: 'EINDEUTIG',
      spalte: 'Kundennummer',
      minimum: { art: 'wert', typ: 'GANZZAHL', wert: 2 },
    };
    const vorher = structuredClone(regel);
    const html = formular('sl_biz_pruefen', { regeln: [regel] });
    expect(html).toContain('value="Kundennummer"');
    expect(regel).toEqual(vorher);
    expect(pruefregelArtSetzen(regel, 'BEREICH')).toEqual({ ...regel, art: 'BEREICH' });
    expect(pruefregelSpaltenSetzen(regel, [])).toEqual({
      art: 'EINDEUTIG',
      spalten: [],
      minimum: regel.minimum,
    });
  });
});
