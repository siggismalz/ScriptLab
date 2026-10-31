import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Startbereich, type StartbereichEigenschaften } from '../src/renderer/Startbereich';

function anzeigen(aenderungen: Partial<StartbereichEigenschaften> = {}) {
  const aktion = vi.fn();
  const props: StartbereichEigenschaften = {
    daten: { projekte: [], entwuerfe: [], hinweis: null },
    laden: false,
    fehler: null,
    verarbeitung: null,
    aktiveInfo: null,
    verfuegbarkeiten: {},
    neuerWorkflow: aktion,
    workflowOeffnen: aktion,
    weiterbearbeiten: aktion,
    einstellungenOeffnen: aktion,
    ueberOeffnen: aktion,
    aktualisieren: aktion,
    projektOeffnen: aktion,
    projektNeuZuordnen: aktion,
    projektEntfernen: aktion,
    projektOrdnerAnzeigen: aktion,
    entwurfFortsetzen: aktion,
    entwurfSpeichernUnter: aktion,
    entwurfLoeschen: aktion,
    beispielOeffnen: aktion,
    ...aenderungen,
  };
  const html = renderToStaticMarkup(createElement(Startbereich, props));
  expect(aktion).not.toHaveBeenCalled();
  return html;
}

describe('Zusammenhängende Start- und Bibliotheksstruktur', () => {
  it('zeigt dieselbe eindeutig aktive globale Navigation und vier echte Einstiege', () => {
    const html = anzeigen();
    expect(html.match(/aria-label="Globale Navigation"/g)).toHaveLength(1);
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Start"[^>]*aria-current="location"/);
    expect(html).not.toContain('Arbeitsnavigation');
    expect(html).not.toContain('Bereiche');
    expect(html).toContain('Schnellzugriff');
    expect(html.match(/class="start-karte /g)).toHaveLength(4);
    expect(html).toContain('Neuer Workflow');
    expect(html).toContain('Workflow öffnen');
    expect(html).not.toContain('Weiterbearbeiten');
  });

  it.each(['projekte', 'beispiele'] as const)(
    'hält in %s Neu, Öffnen und die Rückkehr zum ungespeicherten Stand erreichbar',
    (ziel) => {
      const html = anzeigen({
        ziel,
        aktiveInfo: {
          projektKennung: 'eigener-aktiver-stand',
          name: 'Ungespeicherte Arbeit mit langem deutschem Namen',
          dateiname: null,
          geaendert: true,
          skriptsprache: 'python',
        },
      });
      expect(html).toContain('Neuer Workflow');
      expect(html).toContain('Workflow öffnen');
      expect(html.match(/Weiterbearbeiten/g)).toHaveLength(1);
      expect(html).toContain('title="Ungespeicherte Arbeit mit langem deutschem Namen"');
      expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    },
  );

  it('erhält echte Dateiverfügbarkeit und den lesbaren vollständigen Namen in der Workflowzeile', () => {
    const name = 'Monatliche Auswertung sämtlicher synthetischer Außenstellendaten <Text>';
    const html = anzeigen({
      ziel: 'projekte',
      daten: {
        hinweis: null,
        entwuerfe: [],
        projekte: [
          {
            id: 'datei',
            projektKennung: 'kennung',
            name,
            beschreibung: 'Eigene Testbeschreibung',
            skriptsprache: 'python',
            pfad: 'C:\\Synthetische Daten\\Außenstelle\\Projekt.scriptlab',
            zuletztGeoeffnet: null,
            geaendertAm: '2026-10-31T00:00:00.000Z',
            groesse: 100,
            hash: 'hash',
            verfuegbarkeit: 'unbekannt',
          },
        ],
      },
      verfuegbarkeiten: { datei: { zustand: 'fehlt', meldung: 'Die Quelldatei ist nicht mehr erreichbar.' } },
    });
    expect(html).toContain('Außenstellendaten &lt;Text&gt;');
    expect(html).toContain('Datei nicht gefunden');
    expect(html).toContain('Die Quelldatei ist nicht mehr erreichbar.');
    expect(html).toContain('Neu zuordnen');
    expect(html).toContain('Aus Liste entfernen');
    expect(html).toMatch(/disabled=""[^>]*>[\s\S]*?<span>Öffnen<\/span>/);
  });

  it('hält den echten Entwurfsbestand über einen eigenen klar benannten Einstieg erreichbar', () => {
    const html = anzeigen({
      daten: {
        projekte: [],
        hinweis: null,
        entwuerfe: [
          {
            id: 'entwurf',
            projektKennung: 'kennung',
            name: 'Eigene vorbereitete Arbeit',
            beschreibung: 'Noch zu prüfende Geschäftsdaten',
            ausgangspfad: 'C:\\Synthetische Daten\\Vorlage.scriptlab',
            baselineHash: null,
            gesichertAm: '2026-10-31T00:00:00.000Z',
            skriptsprache: 'python',
          },
        ],
      },
    });
    expect(html).toMatch(/aria-label="Entwürfe"[^>]*data-testid="entwuerfe-hinweis"/);
    expect(html).toContain('Lokal gesicherte Arbeitsstände fortsetzen.');
    expect(html).toContain('1 Entwurf');
    expect(html).not.toContain('Eigene vorbereitete Arbeit');
  });
});
