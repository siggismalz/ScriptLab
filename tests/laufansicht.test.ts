import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { testBereit, type TestOptionen, type TestZustand } from '../src/gemeinsam/testlauf';
import { Testbereich, type TestbereichEigenschaften } from '../src/renderer/Testbereich';

const nichts = () => {};
function optionen(modus: 'vorschau' | 'prueflauf' | 'ausfuehren'): TestOptionen {
  return {
    basisVerzeichnis: 'C:\\Synthetischer Lauf',
    zeitlimitSekunden: 47,
    business: { modus, parametersatz: 'test', parameter: {}, speicherMB: 512, tempGB: 4, fortsetzen: false },
  };
}
function anzeigen(zustand: TestZustand, extra: Partial<TestbereichEigenschaften> = {}) {
  return renderToStaticMarkup(
    createElement(Testbereich, {
      zustand,
      optionen: optionen('ausfuehren'),
      veraltet: false,
      schliessen: nichts,
      starten: nichts,
      stoppen: nichts,
      ordnerWaehlen: nichts,
      optionenAendern: nichts,
      kopieren: nichts,
      leeren: nichts,
      blockAnzeigen: nichts,
      ...extra,
    }),
  );
}
function lauf(modus: 'vorschau' | 'prueflauf' | 'ausfuehren', extra: Partial<TestZustand> = {}): TestZustand {
  return {
    ...testBereit(),
    laufId: 'synthetischer-lauf',
    phase: 'beendet',
    optionen: optionen(modus),
    meldung: 'Verarbeitung abgeschlossen.',
    ...extra,
  };
}
function uebersicht(html: string) {
  const panel = html.match(/<section\b[^>]*aria-label="Ergebnis dieses Laufs"[^>]*>[\s\S]*?<\/section>/)?.[0];
  if (!panel) throw new Error('Die Laufübersicht fehlt.');
  expect(panel.match(/^<section[^>]*>/)?.[0]).not.toContain('hidden=""');
  return panel;
}
function schaltflaeche(html: string, text: string) {
  const gefunden = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((b) => b.includes(`>${text}<`));
  if (!gefunden) throw new Error(`Die Schaltfläche „${text}“ fehlt.`);
  return gefunden;
}

describe('Verständlicher Kontext des tatsächlich angezeigten Laufs', () => {
  it('kennzeichnet eine beendete Vorschau trotz danach gewählter echter Ausführung als begrenzte Vorschau', () => {
    const html = anzeigen(lauf('vorschau'));
    const sichtbar = uebersicht(html);
    expect(sichtbar).toContain('Begrenzte Datenvorschau.');
    expect(sichtbar).toContain('Zieldateien werden dabei nicht verändert.');
    expect(sichtbar).not.toContain('Dieser Lauf führt den Workflow tatsächlich aus.');
    expect(html).toContain('<p class="testbereich-modus">Datenvorschau</p>');
  });

  it('unterscheidet ein Prüfergebnis von bereits veröffentlichten Dateiänderungen', () => {
    const sichtbar = uebersicht(anzeigen(lauf('prueflauf'), { optionen: optionen('vorschau') }));
    expect(sichtbar).toContain('Prüft unterstützte Schritte und plant Dateiaktionen');
    expect(sichtbar).toContain('ohne Zieldateien zu verändern.');
    expect(sichtbar).not.toContain('Dieser Lauf zeigt eine begrenzte Datenvorschau.');
    expect(sichtbar).not.toContain('Dieser Lauf führt den Workflow tatsächlich aus.');
  });

  it('zeigt einen angeforderten Stopp weiter als laufenden Prozess und erklärt erhaltene Dateieffekte', () => {
    const html = anzeigen(lauf('ausfuehren', { phase: 'stoppt', meldung: 'Der Prozess wird gestoppt.' }));
    const sichtbar = uebersicht(html);
    expect(sichtbar).toContain('Der Stopp ist angefordert. Der Prozess ist noch nicht beendet.');
    expect(sichtbar).toContain('Bereits erfolgte Dateiänderungen bleiben auch nach einem Stopp bestehen.');
    expect(schaltflaeche(html, 'Stoppen')).toContain('disabled=""');
    expect(html).not.toContain('>Neuen Lauf vorbereiten<');
    expect(sichtbar).not.toContain('Lauf beendet');
  });

  it('ordnet einen früheren Fehler dem gespeicherten Lauf zu und sperrt die unpassende Bausteinzuordnung', () => {
    const html = anzeigen(
      lauf('ausfuehren', {
        phase: 'fehlgeschlagen',
        meldung: 'Die synthetische Quelldatei fehlt.',
        fehlerBlockId: 'quelle-alt',
      }),
      { historisch: true, veraltet: true },
    );
    expect(html).toContain('Ausführung vom');
    const sichtbar = uebersicht(html);
    expect(sichtbar).toContain('Die synthetische Quelldatei fehlt.');
    expect(schaltflaeche(sichtbar, 'Baustein anzeigen')).toContain('disabled=""');
    expect(html).toContain('Die Ergebnisse gehören zu einem früheren Stand.');
    expect(html).not.toMatch(/role="tab"[^>]*>Vorbereitung<\/button>/);
  });
});
