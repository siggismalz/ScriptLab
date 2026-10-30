import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { beispiele, type BeispielInfo } from '../src/renderer/hilfe';
import { VorlagenBereich, vorlagenFiltern, type VorlagenFilter } from '../src/renderer/VorlagenBereich';

const ohneFilter: VorlagenFilter = { suche: '', sprache: 'alle', aufgabe: 'alle', bereich: 'beispiele' };

describe('Vorlagen anhand ihrer vorhandenen Inhalte finden', () => {
  it('verbindet Suchwörter mit Aufgabe und Sprache, ohne die Metadaten zu verändern', () => {
    const vorher = structuredClone(beispiele);
    expect(
      vorlagenFiltern(beispiele, {
        ...ohneFilter,
        suche: '  SICHERUNG   Quelldatei ',
        aufgabe: 'Dateien',
        sprache: 'python',
      }).map((vorlage) => vorlage.id),
    ).toEqual(['backup-python']);
    expect(beispiele).toEqual(vorher);
    expect(vorlagenFiltern(beispiele, ohneFilter).map((vorlage) => vorlage.id)).toEqual(
      beispiele.map((vorlage) => vorlage.id),
    );
  });

  it('findet Dokumentdateien aus derselben Metadatenliste und erklärt leere Schnittmengen', () => {
    expect(
      vorlagenFiltern(beispiele, { ...ohneFilter, suche: 'BESTELLUNG.docx', bereich: 'dokumente' }).map(
        (vorlage) => vorlage.id,
      ),
    ).toEqual(['business-bestellvorschlag']);
    expect(vorlagenFiltern(beispiele, { ...ohneFilter, bereich: 'dokumente', sprache: 'vbs' })).toEqual([]);
    expect(vorlagenFiltern(beispiele, { ...ohneFilter, suche: 'unbekannter Vorgang' })).toEqual([]);
  });

  it('behandelt kanonisch gleich geschriebene Umlaute und lange Pfade als Text', () => {
    const daten: BeispielInfo[] = [
      {
        ...beispiele[0],
        name: 'Prüfung für Außenstellen',
        vorbereitung: 'C:\\Synthetische Geschäftsdaten\\Außenstelle\\Eingang.csv',
      },
    ];
    expect(
      vorlagenFiltern(daten, { ...ohneFilter, suche: 'Pru\u0308fung Außenstelle\\Eingang.csv' }),
    ).toEqual(daten);
  });
});

describe('Vorlagenauswahl vor einer bewussten eigenen Kopie', () => {
  function ansicht(auswahl: BeispielInfo['id'] | null, filter = ohneFilter, gesperrt = false) {
    const aktion = vi.fn();
    const html = renderToStaticMarkup(
      createElement(VorlagenBereich, {
        vorlagen: beispiele,
        filter,
        aendern: aktion,
        auswahl,
        auswaehlen: aktion,
        gesperrt,
        oeffnen: aktion,
      }),
    );
    expect(aktion).not.toHaveBeenCalled();
    return html;
  }

  it('zeigt vergleichbare Ergebnisse und Sprachen vor Auswahl, aber öffnet keine Vorlage', () => {
    const html = ansicht(null);
    expect(html.match(/<article /g)).toHaveLength(beispiele.length);
    for (const vorlage of beispiele) expect(html).toContain(vorlage.ergebnis.replaceAll('&', '&amp;'));
    expect(html).toContain('Vorlagen suchen');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Als Vorlage öffnen');
    expect(html).not.toContain('Vor dem ersten Lauf');
  });

  it('zeigt Vorbereitung und Öffnen nur zur gewählten Vorlage; gefilterte Auswahl wird nicht ersetzt', () => {
    const html = ansicht('backup-python');
    expect(html.match(/Vor dem ersten Lauf/g)).toHaveLength(1);
    expect(html.match(/Als Vorlage öffnen/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html).toContain('vorhandene Sicherungen werden nicht überschrieben');
    expect(html).toContain('Du öffnest eine eigene bearbeitbare Kopie');
    expect(ansicht('backup-python', { ...ohneFilter, sprache: 'vbs' })).not.toContain('Als Vorlage öffnen');
    expect(ansicht('backup-python', ohneFilter, true)).toMatch(/disabled=""[^>]*>.*?Als Vorlage öffnen/s);
  });

  it('ordnet Dokumentvorlagen dem echten Workflow zu und bietet bei null Treffern einen Rückweg', () => {
    const html = ansicht('business-bestellvorschlag', { ...ohneFilter, bereich: 'dokumente' });
    expect(html.match(/<article /g)).toHaveLength(1);
    expect(html).toContain('Bestellung.docx');
    expect(html).toContain('Workflow: Bestellvorschlag als Word-Dokument');
    expect(html).toContain('Workflow mit Vorlage verwenden');
    const leer = ansicht(null, { ...ohneFilter, suche: 'Keine existierende Vorlage' });
    expect(leer).toContain('Keine passenden Vorlagen gefunden');
    expect(leer).toContain('Filter zurücksetzen');
    expect(leer).not.toContain('<article ');
  });
});
