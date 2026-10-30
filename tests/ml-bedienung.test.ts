import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SprachwahlDialog } from '../src/renderer/SprachwahlDialog';
import { Palette } from '../src/renderer/Palette';
import { MlLaufzeit } from '../src/renderer/MlLaufzeit';
import { MlErgebnis } from '../src/renderer/MlErgebnis';
import type { MLStatus } from '../src/gemeinsam/ml-laufzeit';
import type { TestZustand } from '../src/gemeinsam/testlauf';

const status: MLStatus = {
  zustand: 'fehlt',
  meldung: 'Das optionale CPU-Paket fehlt.',
  installation: null,
  profilHash: null,
  pakete: [{ name: 'scikit-learn', sollVersion: 'Testversion', version: null, importierbar: false }],
  fortschritt: null,
};
const training = {
  art: 'ml_training',
  aufgabe: 'KLASSIFIKATION',
  verfahren: 'RANDOM_FOREST',
  trainingszeilen: 80,
  testzeilen: 20,
  merkmale: ['Umsatz', 'Anzahl'],
  zielspalte: 'Kategorie',
  metriken: { accuracy: 0.75, f1_macro: 0.6 },
};
const business = (
  ereignisse: Record<string, unknown>[],
  bericht: Record<string, unknown> | null = null,
): NonNullable<TestZustand['business']> => ({ schritt: null, ereignisse, vorschau: null, bericht });

describe('ML-Bedienung ohne unbeabsichtigte Einrichtung', () => {
  it('bietet drei native Entscheidungen und legt ohne Bestätigung keinen Workflow an', () => {
    const aktion = vi.fn();
    const html = renderToStaticMarkup(
      createElement(SprachwahlDialog, {
        offen: true,
        vorauswahl: null,
        abbrechen: aktion,
        erstellen: aktion,
      }),
    );
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Python"');
    expect(html).toContain('aria-label="VBScript (VBS)"');
    expect(html).toContain('aria-label="Machine Learning"');
    expect(html).toContain('ohne eingerichtetes ML-Paket');
    expect(html).toContain('Wähle zuerst Python, VBScript (VBS) oder Machine Learning.');
    expect(html).not.toContain('checked=""');
    expect(aktion).not.toHaveBeenCalled();
  });

  it('ordnet nur den ML-Katalog fachlich ein und erhält die allgemeinen Einstiege', () => {
    const aktion = vi.fn();
    const basis = {
      ws: null,
      eingeklappt: false,
      umschalten: aktion,
      platzierung: null,
      ziele: [],
      einfuegen: aktion,
      zielWaehlen: aktion,
      abbrechen: aktion,
      blockAuswaehlen: aktion,
      meldung: aktion,
    };
    const ml = renderToStaticMarkup(
      createElement(Palette, { ...basis, sprache: 'python', workflowArt: 'ml' }),
    );
    expect(ml).toContain('Modelle und Vorhersagen');
    expect(ml).toContain('Tabellen vorbereiten');
    expect(ml).toContain('Ergebnisse speichern');
    expect(ml).not.toContain('Dokumente erstellen');
    for (const sprache of ['python', 'vbs'] as const) {
      const html = renderToStaticMarkup(createElement(Palette, { ...basis, sprache }));
      expect(html).toContain('Ablauf steuern');
      expect(html).not.toContain('Modelle und Vorhersagen');
    }
    expect(aktion).not.toHaveBeenCalled();
  });

  it('erklärt das fehlende optionale Paket mit ausdrücklichen Aktionen, ohne etwas anzustoßen', () => {
    const aktion = vi.fn();
    const html = renderToStaticMarkup(
      createElement(MlLaufzeit, { status, aktiv: false, fortschritt: null, aktion }),
    );
    expect(html).toContain('Das optionale CPU-Paket fehlt.');
    expect(html).toContain('CPU-Paket online einrichten');
    expect(html).toContain('Offline-Paketordner verwenden');
    expect(html).toContain('Bearbeiten, Speichern und Exportieren möglich');
    expect(html).not.toContain('Vorgang abbrechen');
    expect(aktion).not.toHaveBeenCalled();
  });

  it('unterscheidet laufende Einrichtung und tatsächliche Fehler ohne erfundene Ursache', () => {
    const aktion = vi.fn();
    const fortschritt = {
      phase: 'pakete' as const,
      meldung: 'Zwei Pakete wurden geprüft.',
      fertigePakete: 2,
      gesamtPakete: 4,
    };
    const aktiv = renderToStaticMarkup(
      createElement(MlLaufzeit, { status, aktiv: true, fortschritt, aktion }),
    );
    expect(aktiv).toContain('Zwei Pakete wurden geprüft.');
    expect(aktiv).toContain('Vorgang abbrechen');
    expect(aktiv).toMatch(/<progress[^>]*value="2"[^>]*max="4"/);
    expect(aktiv.match(/disabled=""/g)).toHaveLength(3);
    const fehler = renderToStaticMarkup(
      createElement(MlLaufzeit, {
        status: null,
        aktiv: false,
        fortschritt: null,
        fehler: 'Der Vorgang konnte nicht abgeschlossen werden.',
        aktion,
      }),
    );
    expect(fehler).toContain('role="alert"');
    expect(fehler).toContain('Der Vorgang konnte nicht abgeschlossen werden.');
    expect(fehler).not.toContain('Internetverbindung');
    expect(aktion).not.toHaveBeenCalled();
  });
});

describe('ML-Ergebnisse aus bestätigten fachlichen Meldungen', () => {
  it('zeigt keine erfundenen Scores aus einem allgemeinen Abschlussereignis', () => {
    const html = renderToStaticMarkup(
      createElement(MlErgebnis, {
        business: business([{ art: 'abschluss', status: 'erfolgreich', exitcode: 0 }]),
        aktiv: false,
      }),
    );
    expect(html).toContain('noch keine bestätigten Trainingsmetriken');
    expect(html).not.toContain('Genauigkeit');
    expect(html).not.toContain('Bestätigtes Training');
  });

  it('zeigt unabhängige Sollwerte und verwendet den Bericht ohne doppelte Ereigniskopie', () => {
    const html = renderToStaticMarkup(
      createElement(MlErgebnis, {
        business: business([training], { ml_training: [training] }),
        aktiv: false,
      }),
    );
    expect(html.match(/aria-label="Bestätigtes Training/g)).toHaveLength(1);
    expect(html).toContain('Random Forest');
    expect(html).toContain('Klassifikation');
    expect(html).toContain('<dd>80</dd>');
    expect(html).toContain('<dd>20</dd>');
    expect(html).toContain('<dd>0,75</dd>');
    expect(html).toContain('<dd>0,6</dd>');
    expect(html).toContain('Umsatz, Anzahl');
    expect(html).toContain('Kategorie');
  });

  it('zeigt Regression, negative R²-Werte und nicht definiertes R² ohne Erfolgsversprechen', () => {
    const regression = {
      ...training,
      aufgabe: 'REGRESSION',
      verfahren: 'PYTORCH',
      metriken: { mae: 12.5, rmse: 15, r2: -0.25 },
    };
    const html = renderToStaticMarkup(
      createElement(MlErgebnis, { business: business([regression]), aktiv: false }),
    );
    expect(html).toContain('PyTorch');
    expect(html).toContain('<dd>12,5</dd>');
    expect(html).toContain('<dd>-0,25</dd>');
    const undefiniert = renderToStaticMarkup(
      createElement(MlErgebnis, {
        business: business([{ ...regression, metriken: { mae: 0, rmse: 0, r2: null } }]),
        aktiv: false,
      }),
    );
    expect(undefiniert).toContain('Nicht definiert');
    expect(undefiniert).not.toContain('<dd>1</dd>');
  });

  it('rundet große gemeldete Zeilenzahlen nicht zu anderen Datenmengen', () => {
    const html = renderToStaticMarkup(
      createElement(MlErgebnis, {
        business: business([{ ...training, trainingszeilen: 1234567, testzeilen: 234567 }]),
        aktiv: false,
      }),
    );
    expect(html).toContain('<dd>1.234.567</dd>');
    expect(html).toContain('<dd>234.567</dd>');
  });

  it('benennt unvollständige Meldungen und übernimmt keine unendlichen Zahlen', () => {
    const html = renderToStaticMarkup(
      createElement(MlErgebnis, {
        business: business([
          { ...training, trainingszeilen: -1 },
          { ...training, metriken: { accuracy: Infinity, f1_macro: NaN } },
        ]),
        aktiv: false,
      }),
    );
    expect(html).toContain('Ein gemeldetes ML-Ergebnis ist unvollständig.');
    expect(html).toContain('Nicht gemeldet');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('NaN');
  });
});
