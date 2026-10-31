import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { testBereit, type TestOptionen, type TestZustand } from '../src/gemeinsam/testlauf';
import { Testbereich, type TestbereichEigenschaften } from '../src/renderer/Testbereich';
import { LaufKurzansicht } from '../src/renderer/LaufKurzansicht';
import { Laufverwaltung } from '../src/renderer/Laufverwaltung';

const business = (modus: 'vorschau' | 'prueflauf' | 'ausfuehren'): TestOptionen => ({
  basisVerzeichnis: 'C:\\Synthetische Daten\\Arbeitsordner',
  zeitlimitSekunden: 83,
  business: { modus, parametersatz: 'test', parameter: {}, speicherMB: 512, tempGB: 4, fortsetzen: false },
});
function eigenschaften(
  zustand = testBereit(),
  extra: Partial<TestbereichEigenschaften> = {},
): TestbereichEigenschaften {
  return {
    zustand,
    optionen: business('ausfuehren'),
    veraltet: false,
    schliessen: vi.fn(),
    starten: vi.fn(),
    stoppen: vi.fn(),
    ordnerWaehlen: vi.fn(),
    optionenAendern: vi.fn(),
    kopieren: vi.fn(),
    leeren: vi.fn(),
    blockAnzeigen: vi.fn(),
    ...extra,
  };
}
function anzeigen(zustand = testBereit(), extra: Partial<TestbereichEigenschaften> = {}) {
  const props = eigenschaften(zustand, extra);
  const html = renderToStaticMarkup(createElement(Testbereich, props));
  expect(props.starten).not.toHaveBeenCalled();
  expect(props.stoppen).not.toHaveBeenCalled();
  expect(props.optionenAendern).not.toHaveBeenCalled();
  return html;
}
function schaltflaeche(html: string, text: string) {
  const knopf = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((b) => b.includes(`>${text}<`));
  if (!knopf) throw new Error(`Die Schaltfläche „${text}“ fehlt.`);
  return knopf;
}
function lauf(extra: Partial<TestZustand> = {}): TestZustand {
  return {
    ...testBereit(),
    laufId: 'NUR-INTERNER-LAUF',
    standHash: 'NUR-INTERNER-HASH',
    phase: 'beendet',
    optionen: business('ausfuehren'),
    ausgabe: 'Synthetische Ausgabe ä',
    quelltext: 'NUR-INTERNER-QUELLTEXT',
    technischeMeldung: 'NUR-INTERNE-TECHNIK',
    pythonVersion: 'NUR-INTERNE-VERSION',
    exitcode: 0,
    zeilenZuordnung: [{ von: 7, bis: 12, blockId: 'NUR-INTERNE-ZUORDNUNG' }],
    ...extra,
  };
}

describe('Ein Ergebnis statt technischer Laufansichten', () => {
  it('zeigt den direkten Einstieg und hält Vorbereitung ohne Tabs zunächst geschlossen', () => {
    const html = anzeigen(testBereit(), {
      businessVorbereitung: createElement('div', {}, 'Vorhandene Parameterwerte'),
    });
    expect(html).toContain('>Ergebnis</h2>');
    expect(html).toContain('Noch kein Ergebnis');
    expect(html).toContain('Vorhandene Parameterwerte');
    expect(html).toMatch(/<section[^>]*aria-label="Laufeinstellungen"[^>]*hidden=""/);
    expect(schaltflaeche(html, 'Laufeinstellungen')).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('role="tablist"');
  });

  it('zeigt Ausgaben und bewahrt technische Identität ausschließlich im Laufmodell', () => {
    const zustand = lauf();
    const vorher = structuredClone(zustand);
    const html = anzeigen(zustand);
    expect(html).toContain('Lauf beendet');
    expect(html).toContain('aria-label="Laufausgabe"');
    expect(html).toContain('Synthetische Ausgabe ä');
    for (const technik of [
      'NUR-INTERNER',
      'NUR-INTERNE',
      'Lauf-ID',
      'Standkennung',
      'Exitcode',
      'Quelltext',
      'Technische Details',
    ])
      expect(html).not.toContain(technik);
    expect(zustand).toEqual(vorher);
  });

  it.each([
    ['vorschau', 'Datenvorschau', 'Begrenzte Datenvorschau. Zieldateien werden dabei nicht verändert.'],
    [
      'prueflauf',
      'Prüflauf ohne Zieländerungen',
      'Prüft unterstützte Schritte und plant Dateiaktionen, ohne Zieldateien zu verändern.',
    ],
    [
      'ausfuehren',
      'Echte Ausführung',
      'Bereits erfolgte Dateiänderungen bleiben auch nach einem Stopp bestehen.',
    ],
  ] as const)(
    'bewahrt die tatsächliche Bedeutung von %s trotz anders gewählter nächster Optionen',
    (modus, titel, erklaerung) => {
      const html = anzeigen(lauf({ optionen: business(modus) }), {
        optionen: business(modus === 'ausfuehren' ? 'vorschau' : 'ausfuehren'),
      });
      expect(html).toContain(`<p class="testbereich-modus">${titel}</p>`);
      if (modus === 'ausfuehren') expect(html).not.toContain(erklaerung);
      else expect(html).toContain(erklaerung);
    },
  );

  it('stellt bei fertigen Dateien das Ergebnis ohne leeren Textausgabebereich dar', () => {
    const html = anzeigen(
      lauf({
        ausgabe: '',
        business: {
          schritt: null,
          ereignisse: [],
          vorschau: null,
          bericht: { ausgaben: [{ pfad: 'Auswertung.xlsx', status: 'publiziert' }] },
        },
      }),
    );
    expect(html).toContain('Auswertung.xlsx');
    expect(html).toContain('Gespeichert');
    expect(html).not.toContain('aria-label="Laufausgabe"');
    expect(html).not.toContain('Dieser Lauf hat keine Textausgabe');
  });

  it('erklärt einen angeforderten Stopp und bietet vor dem Prozessende keinen neuen Start an', () => {
    const html = anzeigen(lauf({ phase: 'stoppt', exitcode: null }));
    expect(html).toContain('Der Stopp ist angefordert. Der Prozess ist noch nicht beendet.');
    expect(schaltflaeche(html, 'Stoppen')).toContain('disabled=""');
    expect(html).not.toContain('>Laufeinstellungen<');
    // Ein Start steht nur im geschlossenen und während des Laufs deaktivierten Formular.
    expect(schaltflaeche(html, 'Workflow ausführen')).toContain('disabled=""');
    expect(html).not.toContain('Lauf beendet');
  });

  it('bewahrt verständlichen Fehler und Bausteinzuordnung ohne Quelltext- oder Zeilendetails', () => {
    const html = anzeigen(
      lauf({
        phase: 'fehlgeschlagen',
        fehlerBlockId: 'quelle',
        fehlerZeile: 17,
        meldung: 'Die Quelldatei fehlt. Wähle eine vorhandene Datei.',
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Die Quelldatei fehlt. Wähle eine vorhandene Datei.');
    expect(schaltflaeche(html, 'Baustein anzeigen')).not.toContain('disabled=""');
    expect(html).not.toContain('Zeile 17');
    const alterStand = anzeigen(lauf({ phase: 'fehlgeschlagen', fehlerBlockId: 'quelle' }), {
      veraltet: true,
      historisch: true,
    });
    expect(schaltflaeche(alterStand, 'Baustein anzeigen')).toContain('disabled=""');
    expect(alterStand).toContain('Die Ergebnisse gehören zu einem früheren Stand.');
    expect(alterStand).not.toContain('>Ausgabe leeren<');
  });

  it('hält Pflichtparameter, Arbeitsordner und Zeitlimit bei ausdrücklich angeforderter Vorbereitung erreichbar', () => {
    const html = anzeigen(testBereit(), {
      vorbereitungAnfordern: 1,
      businessVorbereitung: createElement(
        'label',
        {},
        'Pflichtquelle',
        createElement('input', { value: 'C:\\Synthetisch\\Quelle.csv', readOnly: true }),
      ),
      workflowInfo: { name: 'Meine Automatisierung', geaendert: true },
    });
    expect(schaltflaeche(html, 'Laufeinstellungen')).toContain('aria-expanded="true"');
    expect(html).not.toMatch(/<section[^>]*aria-label="Laufeinstellungen"[^>]*hidden=""/);
    expect(html).toContain('Pflichtquelle');
    expect(html).toContain('Arbeitsordner');
    expect(html).toContain('Zeitlimit in Sekunden');
    expect(html).toContain('ungespeicherten Änderungen');
  });

  it('stellt benutzereigene Ausgabe als Text dar und erhält die ehrliche Begrenzungsmeldung', () => {
    const html = anzeigen(lauf({ ausgabe: '<script>nur Daten</script> ä', abgeschnitteneZeichen: 1200 }));
    expect(html).toContain('&lt;script&gt;nur Daten&lt;/script&gt; ä');
    expect(html).not.toContain('<script>');
    expect(html).toContain('1.200 Zeichen werden nicht angezeigt.');
    expect(html).toContain('aria-live="off"');
  });

  it('bietet die bewusste Weitergabe unter ihrem tatsächlichen Berichtsnamen ohne Rohdaten im Bildschirm', () => {
    const html = anzeigen(lauf(), { protokollSpeichern: vi.fn() });
    expect(html).toContain('<summary>Ergebnis weitergeben</summary>');
    expect(schaltflaeche(html, 'Laufbericht speichern')).not.toContain('disabled=""');
    expect(schaltflaeche(html, 'Laufbericht kopieren')).not.toContain('disabled=""');
    expect(html).not.toContain('NUR-INTERNER-HASH');
    expect(html).not.toContain('NUR-INTERNE-TECHNIK');
  });

  it('hält den Verlauf auf Nachfrage und bietet ohne Schnittstelle keinen falschen Löschknopf', () => {
    const html = renderToStaticMarkup(
      createElement(Laufverwaltung, {
        ...eigenschaften(lauf()),
        projektKennung: 'projekt',
        workflowStand: 'intern',
        sichtbar: true,
        vorbereitungAnfrage: 0,
      }),
    );
    expect(html).toContain('Verlauf anzeigen');
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*class="laufverwaltung-liste"/);
    expect(html).not.toContain('Lauf löschen');
    expect(html).not.toContain('Stand NUR-');
  });

  it('benennt den Ergebniszugang am Editor ohne technische Details und erhält den tatsächlichen Modus', () => {
    const html = renderToStaticMarkup(
      createElement(LaufKurzansicht, {
        zustand: lauf({ phase: 'stoppt', optionen: business('prueflauf') }),
        details: vi.fn(),
        blockAnzeigen: vi.fn(),
      }),
    );
    expect(html).toContain('Prüflauf wird gestoppt');
    expect(html).toContain('Ergebnis ansehen');
    expect(html).not.toContain('Laufdetails');
    expect(html).not.toContain('NUR-INTERNER-HASH');
  });
});
