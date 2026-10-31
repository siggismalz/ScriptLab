import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HilfeBereich } from '../src/renderer/HilfeBereich';
import { hilfeArtikel, hilfeDurchsuchen, beispiele } from '../src/renderer/hilfe';
import { Startbereich, type StartbereichEigenschaften } from '../src/renderer/Startbereich';

describe('Lokale Hilfe für tatsächliche Benutzeraufgaben', () => {
  it('bietet vier klare Einstiege und führt durch konkrete bestehende Aktionen', () => {
    expect(hilfeArtikel.map((a) => a.titel)).toEqual([
      'Workflow bauen',
      'Dateien verwenden',
      'Ausführen und Ergebnisse prüfen',
      'Fehler beheben und aufräumen',
    ]);
    for (const artikel of hilfeArtikel) {
      expect(artikel.abschnitte.some((a) => (a.schritte?.length ?? 0) >= 3)).toBe(true);
      expect(new Set(artikel.abschnitte.map((a) => a.id)).size).toBe(artikel.abschnitte.length);
      for (const abschnitt of artikel.abschnitte)
        if (abschnitt.beispiel) expect(beispiele.some((b) => b.id === abschnitt.beispiel)).toBe(true);
    }
    expect(JSON.stringify(hilfeArtikel)).toContain('Trennzeichen prüfen');
    expect(JSON.stringify(hilfeArtikel)).toContain('Datenvorschau laden');
    expect(JSON.stringify(hilfeArtikel)).toContain('nicht automatisch rückgängig');
  });
  it.each(['SHA-256', 'IPC', 'pip install', 'Exitcode', 'Tensor', 'Syntax'])(
    'liefert keine technischen Referenztexte für %s im Benutzerhilfefluss',
    (suche) => {
      expect(hilfeDurchsuchen(suche)).toEqual([]);
    },
  );
  it('liefert bei Dateipfad und Löschen konkrete lesbare Artikelstellen', () => {
    for (const begriff of ['Dateipfad', 'Trennzeichen', 'Entwurf löschen', 'Aus Liste entfernen']) {
      const treffer = hilfeDurchsuchen(begriff);
      expect(treffer.length).toBeGreaterThan(0);
      for (const t of treffer) {
        const artikel = hilfeArtikel.find((a) => a.id === t.artikelId)!;
        expect(artikel.abschnitte.some((a) => a.id === t.abschnittId)).toBe(true);
        expect(t.ausschnitt.toLocaleLowerCase('de')).toContain(begriff.toLocaleLowerCase('de'));
      }
    }
  });
  it('verwendet aktuelle Bedienwege in Hilfe und Vorlagenvorbereitung', () => {
    const texte = JSON.stringify({ hilfeArtikel, beispiele });
    for (const alt of [
      'Läufe → Vorbereitung',
      'Laufdetails',
      'Alle Läufe',
      'Einstellungen → Darstellung',
      'VBS-Vorschau',
    ])
      expect(texte).not.toContain(alt);
    for (const aktuell of [
      'Ergebnis ansehen',
      'Verlauf anzeigen',
      'Läufe → Laufeinstellungen',
      'Einstellungen → Aussehen',
    ])
      expect(texte).toContain(aktuell);
  });
  it('erklärt optionale Tabellenziele ohne Überschreiben oder automatische Auflösung leerer Bindungen', () => {
    const dateien = hilfeArtikel.find((a) => a.id === 'dateien-verwenden')!;
    const abschnitt = dateien.abschnitte.find((a) => a.id === 'datei-parameter')!;
    const text = abschnitt.texte.join(' ');
    expect(text).toContain('Speicherort (optional)');
    expect(text).toContain('Namen der eindeutigen Quelldatei');
    expect(text).toContain('im Arbeitsordner');
    expect(text).toContain('Belegte Namen werden nummeriert');
    expect(text).toContain('niemals ersetzt');
    expect(text).toContain('Ein leerer Parameter oder eine leere gebundene Variable ist ein Fehler');
  });
  it('rendert Karten, lesbare Schritte und Lizenzverweis ohne irgendeine Aktion auszulösen', () => {
    const aktion = vi.fn();
    const props = {
      suche: '',
      sucheAendern: aktion,
      artikelOeffnen: aktion,
      beispielOeffnen: aktion,
      ueberOeffnen: aktion,
      gesperrt: false,
    };
    const uebersicht = renderToStaticMarkup(createElement(HilfeBereich, props));
    expect(uebersicht).toContain('Was möchtest du tun?');
    for (const artikel of hilfeArtikel) expect(uebersicht).toContain(`aria-label="${artikel.titel}"`);
    expect(uebersicht).toContain('Leon Stolz');
    expect(uebersicht).toContain('Über ScriptLab und Lizenz');
    expect(uebersicht).not.toContain('technische Details');
    const artikel = renderToStaticMarkup(createElement(HilfeBereich, { ...props, artikel: hilfeArtikel[0] }));
    expect(artikel).toContain('aria-label="Abschnitte dieser Anleitung"');
    expect(artikel).toContain('<ol>');
    expect(artikel).toContain('id="hilfe-erster-ablauf"');
    expect(artikel).toContain('Beispiel als Vorlage öffnen');
    expect(aktion).not.toHaveBeenCalled();
  });
});

function bibliothek(zustand: 'verfuegbar' | 'fehlt' = 'verfuegbar') {
  const aktion = vi.fn();
  const props: StartbereichEigenschaften = {
    ziel: 'projekte',
    daten: {
      projekte: [
        {
          id: 'workflow-1',
          projektKennung: 'eigene-kennung',
          name: 'Synthetischer Workflow',
          pfad: 'C:\\Eigene Testdaten\\Workflow.scriptlab',
          beschreibung: '',
          groesse: 1200,
          hash: 'a'.repeat(64),
          geaendertAm: '2026-10-31T08:00:00.000Z',
          zuletztGeoeffnet: null,
          verfuegbarkeit: 'unbekannt',
          skriptsprache: 'python',
        },
      ],
      entwuerfe: [],
      hinweis: null,
    },
    laden: false,
    fehler: null,
    verarbeitung: null,
    aktiveInfo: null,
    verfuegbarkeiten: {
      'workflow-1': { zustand, meldung: zustand === 'fehlt' ? 'Datei nicht gefunden' : 'Datei verfügbar' },
    },
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
  };
  const html = renderToStaticMarkup(createElement(Startbereich, props));
  const zeile = html.split('data-projekt-id="workflow-1"')[1].split('</article>')[0];
  return { html, zeile, aktion };
}

describe('Bibliothek mit klaren direkten Aktionen', () => {
  it('zeigt Entfernen außerhalb der Details und erklärt den Erhalt der Datei', () => {
    const { html, zeile, aktion } = bibliothek();
    expect(zeile.indexOf('Aus Liste entfernen')).toBeLessThan(zeile.indexOf('<details'));
    expect(zeile.slice(0, zeile.indexOf('<details'))).toContain('Öffnen');
    expect(html).toContain('Die gespeicherte Datei bleibt erhalten');
    expect(zeile.slice(0, zeile.indexOf('<details'))).not.toContain('Datei verfügbar');
    expect(zeile.slice(0, zeile.indexOf('<details'))).not.toContain('Python');
    expect(zeile.slice(zeile.indexOf('<details'))).toContain('Python');
    expect(aktion).not.toHaveBeenCalled();
  });
  it('lässt ein tatsächlich fehlendes Projekt sichtbar und bietet die passende Korrektur weiter an', () => {
    const { zeile } = bibliothek('fehlt');
    expect(zeile.slice(0, zeile.indexOf('<details'))).toContain('Datei nicht gefunden');
    expect(zeile).toContain('Neu zuordnen');
    expect(zeile).toContain('Aus Liste entfernen');
  });
});
