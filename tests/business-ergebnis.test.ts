import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BusinessErgebnis } from '../src/renderer/BusinessErgebnis';
import type { TestZustand, TestOptionen } from '../src/gemeinsam/testlauf';

type Business = NonNullable<TestZustand['business']>;
const optionen: TestOptionen = {
  basisVerzeichnis: 'C:\\Eigene Testdaten',
  zeitlimitSekunden: 120,
  business: {
    modus: 'ausfuehren',
    parametersatz: 'test',
    parameter: {},
    speicherMB: 512,
    tempGB: 4,
    fortsetzen: false,
  },
};
function zeigen(werte: Partial<Business> = {}, aktiv = false, kontextZeigen = true) {
  return renderToStaticMarkup(
    createElement(BusinessErgebnis, {
      business: { schritt: null, ereignisse: [], vorschau: null, bericht: null, ...werte },
      optionen,
      aktiv,
      kontextZeigen,
    }),
  );
}

describe('Verständliche Business-Ergebnisse aus tatsächlichen Laufdaten', () => {
  it('gruppiert die Laufzusammenfassung und vorhandene Dateiergebnisse als benannte Abschnitte', () => {
    const html = zeigen({
      ereignisse: [
        { art: 'fortschritt', einheit: 'Dateien', erledigt: 2, gesamt: 3 },
        { art: 'hinweis', meldung: 'Ein Ziel wurde übersprungen.' },
      ],
      bericht: {
        summen: { verarbeitet: 2, uebersprungen: 1 },
        ausgaben: [
          { pfad: 'C:\\Synthetisch\\Bericht.csv', status: 'publiziert' },
          { pfad: 'C:\\Synthetisch\\Original.csv', status: 'uebersprungen' },
        ],
      },
    });
    const zusammenfassung = html.match(
      /<section\b[^>]*aria-label="Zusammenfassung des Laufs"[^>]*>([\s\S]*?)<\/section>/,
    )?.[1];
    expect(zusammenfassung).toBeDefined();
    expect(zusammenfassung).toContain('Echte Ausführung');
    expect(zusammenfassung).toContain('2 von 3 Dateien');
    expect(zusammenfassung).toContain('<dt>Fertig</dt><dd>2</dd>');
    expect(zusammenfassung).not.toContain('Ein Ziel wurde übersprungen.');
    const dateien = html.match(
      /<section\b[^>]*aria-label="Dateien und Ausgabeziele"[^>]*>([\s\S]*?)<\/section>/,
    )?.[1];
    expect(dateien).toBeDefined();
    expect(dateien).toContain('Bericht.csv');
    expect(dateien).toContain('Gespeichert');
    expect(dateien).toContain('Original.csv');
    expect(dateien).toContain('Übersprungen');
    expect(dateien!.match(/<li\b/g)).toHaveLength(2);
    expect(dateien).not.toMatch(/<(article|section)\b/);
    expect(html).toContain('Ein Ziel wurde übersprungen.');
    expect(html).toContain('Vollständiger Laufbericht');
  });
  it('erzeugt ohne vorhandenen Kontext oder Dateiergebnisse keine leeren Ergebnisgruppen', () => {
    const html = zeigen({ bericht: { summen: { fehlerhaft: 0 }, ausgaben: [] } }, false, false);
    expect(html).toContain('Laufergebnisse');
    expect(html).not.toContain('aria-label="Zusammenfassung des Laufs"');
    expect(html).not.toContain('aria-label="Dateien und Ausgabeziele"');
    expect(html).not.toContain('Ausgabedateien');
    expect(html).toContain('Vollständiger Laufbericht');
  });
  it('zeigt Modus und Parametersatz ohne erfundene Dateizähler', () => {
    const html = zeigen();
    expect(html).toContain('Echte Ausführung');
    expect(html).toContain('Testdaten');
    expect(html).toContain('Noch kein Schritt gemeldet');
    expect(html).not.toContain('<progress');
    expect(html).not.toContain('Ausgabedateien');
  });
  it('ordnet eindeutige Operationen einem verständlichen Schrittnamen zu', () => {
    expect(
      zeigen(
        {
          schritt: 'filter',
          ereignisse: [{ art: 'schritt', block_id: 'filter', operation: 'daten.filtern' }],
        },
        true,
      ),
    ).toContain('Zeilen filtern');
  });
  it('erhält den Namen des getesteten XLSX-Blocks statt die CSV-Variante zu erfinden', () => {
    const daten = {
      schritt: 'bericht',
      ereignisse: [{ block_id: 'bericht', operation: 'daten.exportieren' }],
    };
    expect(zeigen({ ...daten, schrittnamen: { bericht: 'Geprüften Excel-Bericht schreiben' } })).toContain(
      'Geprüften Excel-Bericht schreiben',
    );
    expect(zeigen(daten)).not.toContain('Tabelle als CSV');
  });
  it('zeigt nur belastbare Dateifortschritte und bekannte Gesamtmengen', () => {
    const html = zeigen(
      { ereignisse: [{ art: 'fortschritt', einheit: 'Dateien', erledigt: 25, gesamt: 52 }] },
      true,
    );
    expect(html).toContain('25 von 52 Dateien');
    expect(html).toContain('value="25" max="52"');
    const unbekannt = zeigen({ ereignisse: [{ art: 'fortschritt', einheit: 'Dateien', erledigt: 25 }] });
    expect(unbekannt).toContain('25 Dateien');
    expect(unbekannt).not.toContain('<progress');
  });
  it('stellt ungültige Zähler nicht als bestätigte Erfolge dar', () => {
    const html = zeigen({
      ereignisse: [{ art: 'fortschritt', einheit: 'Dateien', erledigt: -1, gesamt: 0 }],
      bericht: { summen: { verarbeitet: null, geplant: 1.5, fehlerhaft: '0' } },
    });
    expect(html).not.toContain('<progress');
    expect(html).not.toContain('Ausgabedateien');
    expect(html).not.toContain('Fehlermeldungen:');
  });
  it('trennt bestätigte Ausgabedateien von Fehlermeldungen auch im gekürzten Abschluss', () => {
    const html = zeigen({
      bericht: {
        details_ausgelassen: true,
        summen: { verarbeitet: 2000, uebersprungen: 0, geplant: 0, fehlerhaft: 1 },
        bericht_pfad: 'C:\\Laufberichte\\vollstaendig.json',
      },
    });
    expect(html).toContain('Ausgabedateien');
    expect(html).toContain('2000');
    expect(html).toContain('Fehlermeldungen: 1');
    expect(html).toContain('vollstaendig.json');
  });
  it('zeigt Ausgaben und Fehler ausschließlich als Text', () => {
    const html = zeigen({
      ereignisse: [{ art: 'fehler', meldung: '<script>alert(1)</script>' }],
      bericht: { ausgaben: [{ pfad: '<img src=x onerror=alert(1)>', status: 'publiziert' }] },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });
  it('begrenzt sichtbare Meldungen und Ausgabeziele und hält den Bericht zugänglich', () => {
    const html = zeigen({
      ereignisse: Array.from({ length: 8 }, (_, i) => ({ art: 'hinweis', meldung: `Hinweis-${i}` })),
      bericht: {
        ausgaben: Array.from({ length: 8 }, (_, i) => ({ pfad: `Ausgabe-${i}.csv`, status: 'publiziert' })),
        bericht_pfad: 'C:\\Berichte\\bericht.json',
      },
    });
    expect(html).not.toContain('Hinweis-0');
    expect(html).toContain('Hinweis-7');
    const ausgabeliste = html.match(/<ul class="business-ergebnis-ausgaben">([\s\S]*?)<\/ul>/)?.[1];
    expect(ausgabeliste).toBeDefined();
    expect(ausgabeliste!.match(/<li\b/g)).toHaveLength(5);
    expect(ausgabeliste).toContain('Ausgabe-4.csv');
    expect(ausgabeliste).not.toContain('Ausgabe-5.csv');
    // Die vollständigen technischen Details behalten auch die übrigen Ziele.
    expect(html).toContain('Ausgabe-7.csv');
    expect(html).toMatch(/readonly=/i);
    expect(html).toContain('Weitere Ausgabeziele');
  });
});
