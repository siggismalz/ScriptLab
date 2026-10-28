import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntwurfEintrag, ProjektEintrag } from '../src/gemeinsam/bruecke';
import {
  Startbereich,
  entwuerfeFiltern,
  projekteFiltern,
  zuletztGeoeffnete,
  letzteWorkflowZeilen,
  type AktiverWorkflowInfo,
  type StartbereichEigenschaften,
} from '../src/renderer/Startbereich';
import { beispiele, hilfeArtikel, hilfeDurchsuchen } from '../src/renderer/hilfe';
import { projektPruefen } from '../src/kern/projekt';

const projekt = (
  id: string,
  name: string,
  pfad: string,
  zuletztGeoeffnet: string | null,
): ProjektEintrag => ({
  id,
  name,
  pfad,
  zuletztGeoeffnet,
  projektKennung: `kennung-${id}`,
  beschreibung: '',
  geaendertAm: '2026-10-26T08:00:00.000Z',
  groesse: 1024,
  hash: 'a'.repeat(64),
  verfuegbarkeit: 'unbekannt',
  skriptsprache: 'vbs',
});
const entwurf = (
  id: string,
  name: string,
  gesichertAm: string,
  ausgangspfad: string | null,
): EntwurfEintrag => ({
  id,
  name,
  gesichertAm,
  ausgangspfad,
  projektKennung: `kennung-${id}`,
  beschreibung: '',
  baselineHash: null,
  skriptsprache: 'vbs',
});

describe('Bibliotheksansicht ohne zweite Datenwahrheit', () => {
  it('findet gleichnamige Dateien über ihren vollständigen Pfad und verändert die Bibliothek nicht', () => {
    const daten = [
      projekt('a', 'Sicherung', 'C:\\Privat\\Sicherung.scriptlab', null),
      projekt('b', 'Sicherung', 'D:\\Firma mit Leerzeichen\\Sicherung.scriptlab', '2026-10-26T12:00:00.000Z'),
    ];
    const vorher = structuredClone(daten);
    expect(projekteFiltern(daten, 'FIRMA MIT LEERZEICHEN', 'name').map((p) => p.id)).toEqual(['b']);
    expect(projekteFiltern(daten, 'sicherung', 'zuletzt').map((p) => p.id)).toEqual(['b', 'a']);
    expect(daten).toEqual(vorher);
  });

  it('zählt nur tatsächlich geöffnete Dateien zu den höchstens fünf letzten Projekten', () => {
    const daten = Array.from({ length: 7 }, (_, i) =>
      projekt(
        String(i),
        `Ablauf ${i}`,
        `C:\\${i}.scriptlab`,
        `2026-10-${String(20 + i).padStart(2, '0')}T08:00:00.000Z`,
      ),
    );
    daten.push(projekt('nie', 'Gerade gespeichert', 'C:\\neu.scriptlab', null));
    expect(zuletztGeoeffnete(daten).map((p) => p.id)).toEqual(['6', '5', '4', '3', '2']);
    expect(daten).toHaveLength(8);
  });

  it('ordnet aktive Arbeit nur über die Projektkennung zu und zählt sie in das Fünferlimit', () => {
    const daten = Array.from({ length: 7 }, (_, i) =>
      projekt(String(i), 'Gleicher Name', `C:\\${i}.scriptlab`, `2026-10-2${i}T08:00:00.000Z`),
    );
    const aktiv: AktiverWorkflowInfo = {
      projektKennung: daten[0].projektKennung,
      name: 'Aktueller umbenannter Stand',
      dateiname: daten[0].pfad,
      geaendert: true,
      skriptsprache: 'vbs',
    };
    const vorher = structuredClone({ daten, aktiv });
    const zeilen = letzteWorkflowZeilen(daten, aktiv);
    expect(zeilen).toHaveLength(5);
    expect(zeilen[0]).toEqual({ art: 'aktiv', workflow: aktiv, projekt: daten[0] });
    expect(zeilen.slice(1).map((z) => z.projekt?.id)).toEqual(['6', '5', '4', '3']);
    expect({ daten, aktiv }).toEqual(vorher);
  });

  it('erhält einen ungespeicherten aktiven Workflow ohne erfundenen Dateieintrag', () => {
    const aktiv: AktiverWorkflowInfo = {
      projektKennung: 'neue-kennung',
      name: 'Gleicher Name',
      dateiname: null,
      geaendert: true,
      skriptsprache: 'python',
    };
    const daten = [projekt('gespeichert', aktiv.name, 'C:\\Stand.scriptlab', '2026-10-26T08:00:00.000Z')];
    expect(letzteWorkflowZeilen(daten, aktiv)).toEqual([
      { art: 'aktiv', workflow: aktiv, projekt: null },
      { art: 'datei', projekt: daten[0] },
    ]);
    expect(letzteWorkflowZeilen([], aktiv)).toEqual([{ art: 'aktiv', workflow: aktiv, projekt: null }]);
  });

  it('sortiert Entwürfe nach Sicherungszeit und findet ihren Bezugspfad', () => {
    const daten = [
      entwurf('alt', 'Zweiter Ablauf', '2026-10-25T08:00:00.000Z', 'C:\\Alte Sicherung\\stand.scriptlab'),
      entwurf('neu', 'Erster Ablauf', '2026-10-26T08:00:00.000Z', null),
    ];
    expect(entwuerfeFiltern(daten, '', 'zuletzt').map((e) => e.id)).toEqual(['neu', 'alt']);
    expect(entwuerfeFiltern(daten, 'alte sicherung', 'name').map((e) => e.id)).toEqual(['alt']);
  });

  it('zeigt beim Laden keine erfundenen Nullzählungen und führt beim Rendern keine Operation aus', () => {
    const aktion = vi.fn();
    const props: StartbereichEigenschaften = {
      daten: null,
      laden: true,
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
    };
    const html = renderToStaticMarkup(createElement(Startbereich, props));
    expect(html).toContain('Wird geladen');
    expect(html).not.toContain('0 Workflows');
    expect(html).not.toContain('0 Entwürfe');
    expect(html).not.toContain('Weiterbearbeiten');
    expect(aktion).not.toHaveBeenCalled();
    const geladen = renderToStaticMarkup(
      createElement(Startbereich, {
        ...props,
        laden: false,
        daten: { projekte: [], entwuerfe: [], hinweis: null },
        aktiveInfo: {
          projektKennung: 'aktiver-entwurf',
          name: 'Testentwurf',
          dateiname: null,
          geaendert: true,
          skriptsprache: 'vbs',
        },
      }),
    );
    expect(geladen).toContain('0 Workflows');
    expect(geladen).toContain('Weiterbearbeiten');
    expect(geladen).toContain('data-aktiver-workflow="aktiver-entwurf"');
    expect(geladen).toContain('Ungespeicherte Änderungen');
    expect(geladen).not.toContain('start-weiterarbeiten');
    expect(geladen).not.toContain('Datei verfügbar');
    const gespeichert = projekt('aktiv', 'Testentwurf', 'C:\\Aktiv.scriptlab', '2026-10-26T08:00:00.000Z');
    const doppeltBekannt = renderToStaticMarkup(
      createElement(Startbereich, {
        ...props,
        laden: false,
        daten: {
          projekte: [gespeichert, { ...gespeichert, id: 'zweiter-verweis' }],
          entwuerfe: [],
          hinweis: null,
        },
        aktiveInfo: {
          projektKennung: gespeichert.projektKennung,
          name: 'Aktueller Stand',
          dateiname: gespeichert.pfad,
          geaendert: true,
          skriptsprache: 'vbs',
        },
      }),
    );
    expect(doppeltBekannt.match(/Weiterbearbeiten/g)).toHaveLength(1);
    expect(doppeltBekannt).not.toContain('data-projekt-id=');
    expect(doppeltBekannt).toContain('Aktueller Stand');
    expect(aktion).not.toHaveBeenCalled();
  });

  it('behauptet bei einem unlesbaren Index weder einen leeren Bestand noch falsche Nullzählungen', () => {
    const aktion = vi.fn();
    const props: StartbereichEigenschaften = {
      daten: { projekte: [], entwuerfe: [], hinweis: 'Der lokale Projektindex konnte nicht gelesen werden.' },
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
    };
    const html = renderToStaticMarkup(createElement(Startbereich, props));
    expect(html).toContain(props.daten!.hinweis);
    expect(html.match(/Bestand nicht vollständig geladen/g)).toHaveLength(2);
    expect(html).toContain('Ein leerer Bereich bedeutet hier nicht');
    expect(html).not.toMatch(/0 Workflows|0 Entwürfe|Noch kein Projekt ausdrücklich geöffnet/);
    expect(aktion).not.toHaveBeenCalled();
  });
});

describe('Lokale Hilfe und vorhandene Vorlagen', () => {
  it('liefert gezielte Fundstellen in existierenden Artikeln und Abschnitten', () => {
    expect(hilfeArtikel).toHaveLength(10);
    expect(new Set(hilfeArtikel.map((a) => a.id)).size).toBe(10);
    const treffer = hilfeDurchsuchen('SHA-256');
    expect(treffer.length).toBeGreaterThan(0);
    for (const t of treffer) {
      const artikel = hilfeArtikel.find((a) => a.id === t.artikelId)!;
      expect(artikel.abschnitte.some((a) => a.id === t.abschnittId)).toBe(true);
      expect(t.ausschnitt).toContain('SHA-256');
    }
    expect(hilfeDurchsuchen('')).toEqual([]);
    expect(hilfeDurchsuchen('<script>keinehilfe</script>')).toEqual([]);
  });

  it('verweist auf die elf echten Beispielprojekte und gültige Vorlagenlinks', async () => {
    expect(beispiele.map((b) => b.id)).toEqual([
      'business-monat',
      'business-bestellungen',
      'business-bestellvorschlag',
      'business-belege',
      'business-stapel',
      'begruessung',
      'backup',
      'dateiliste',
      'begruessung-python',
      'backup-python',
      'dateiliste-python',
    ]);
    for (const beispiel of beispiele) {
      const text = await readFile(new URL(`../beispiele/${beispiel.dateiname}`, import.meta.url), 'utf8');
      expect(projektPruefen(JSON.parse(text)).name).toBeTruthy();
    }
    for (const artikel of hilfeArtikel)
      for (const abschnitt of artikel.abschnitte)
        if (abschnitt.beispiel) expect(beispiele.some((b) => b.id === abschnitt.beispiel)).toBe(true);
  });
});
