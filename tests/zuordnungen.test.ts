import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { JsonWert } from '../src/kern/business-modell';
import { SpaltenAuswahl } from '../src/renderer/SpaltenAuswahl';
import { ZuordnungsFeld } from '../src/renderer/ZuordnungsFeld';
import {
  freierZuordnungsname,
  spaltenvorschlaegeFiltern,
  spaltenwahlAendern,
  spalteVerschieben,
  zuordnungUmbenennen,
} from '../src/renderer/zuordnungen';

describe('Verlustfreie Objektzuordnungen', () => {
  it('erhält alle Zuordnungen und den Originalzustand bei leerem oder doppeltem Namen', () => {
    const wert = { Name: 'Kunde', Betrag: { parameter: 'Gesamtbetrag' }, Freigabe: false, Leer: null };
    const vorher = structuredClone(wert);
    expect(() => zuordnungUmbenennen(wert, 'Name', '')).toThrow('Gib einen Namen ein');
    expect(() => zuordnungUmbenennen(wert, 'Name', '   ')).toThrow('Gib einen Namen ein');
    expect(() => zuordnungUmbenennen(wert, 'Name', 'Betrag')).toThrow('bereits vorhanden');
    expect(wert).toEqual(vorher);
  });

  it('ersetzt nur den Namen am bestehenden Platz und bewahrt führende Leerzeichen', () => {
    const betrag = { parameter: 'Gesamtbetrag' };
    const wert = { Name: 'Kunde', Betrag: betrag, Freigabe: false, Leer: null };
    const neu = zuordnungUmbenennen(wert, 'Betrag', ' Betrag ');
    expect(Object.keys(neu)).toEqual(['Name', ' Betrag ', 'Freigabe', 'Leer']);
    expect(neu[' Betrag ']).toBe(betrag);
    expect(wert.Betrag).toBe(betrag);
    expect(zuordnungUmbenennen(wert, 'Name', 'Name')).toEqual(wert);
    expect(zuordnungUmbenennen(wert, 'Name', 'name').name).toBe('Kunde');
  });

  it('findet tatsächlich freie Feldnamen bei Lücken und zählt nicht nur die Einträge', () => {
    const wert = { Feld1: 'Erster Wert', Feld3: 'Dritter Wert' };
    const frei = freierZuordnungsname(wert);
    expect(frei).toBe('Feld2');
    const neu = Object.fromEntries([...Object.entries(wert), [frei, '']]);
    expect(neu).toEqual({ Feld1: 'Erster Wert', Feld3: 'Dritter Wert', Feld2: '' });
    expect(freierZuordnungsname(neu)).toBe('Feld4');
    expect(freierZuordnungsname({})).toBe('Feld1');
  });

  it('weist vom Dateiformat verbotene Objektschlüssel und veraltete Umbenennungen zurück', () => {
    for (const name of ['__proto__', 'constructor', 'prototype']) {
      expect(() => zuordnungUmbenennen({ Feld1: 'Erhalten' }, 'Feld1', name)).toThrow('nicht verwendet');
    }
    expect(() => zuordnungUmbenennen({ Feld1: 0 }, 'NichtMehrVorhanden', 'Neu')).toThrow(
      'nicht mehr vorhanden',
    );
    const neu = zuordnungUmbenennen({ Feld1: 0 }, 'Feld1', 'toString');
    expect(Object.hasOwn(neu, 'toString')).toBe(true);
    expect(neu.toString).toBe(0);
  });
});

describe('Spaltenwahl mit erhaltenen Wertbindungen', () => {
  const parameter = { parameter: 'Gruppenspalte' };
  const literal = { art: 'wert', typ: 'TEXT', wert: { parameter: 'WeitereSpalte' } };

  it('hängt neue ausgewählte Namen an und erhält unbekannte Namen sowie gebundene Werte', () => {
    const werte: JsonWert[] = ['Manuell eingegeben', parameter, literal, 'Region'];
    const neu = spaltenwahlAendern(werte, 'Monat', true);
    expect(neu).toEqual([...werte, 'Monat']);
    expect(neu[1]).toBe(parameter);
    expect(neu[2]).toBe(literal);
    expect(werte).toHaveLength(4);
    expect(spaltenwahlAendern(werte, 'Region', true)).toEqual(werte);
  });

  it('entfernt nur den exakt gewählten Namen und verändert keine Literal- oder Parameterobjekte', () => {
    const werte: JsonWert[] = ['Region', ' Region ', parameter, literal];
    expect(spaltenwahlAendern(werte, 'Region', false)).toEqual([' Region ', parameter, literal]);
    expect(spaltenwahlAendern(werte, 'Nicht in der Vorschau', false)).toEqual(werte);
    expect(spaltenwahlAendern([], '__proto__', true)).toEqual(['__proto__']);
  });

  it('ordnet vollständige gespeicherte Werte um, ohne die Eingabe zu verändern', () => {
    const werte: JsonWert[] = ['Region', parameter, literal];
    expect(spalteVerschieben(werte, 2, -1)).toEqual(['Region', literal, parameter]);
    expect(spalteVerschieben(werte, 1, 1)[2]).toBe(parameter);
    expect(werte).toEqual(['Region', parameter, literal]);
    expect(spalteVerschieben(werte, 0, -1)).toEqual(werte);
    expect(spalteVerschieben(werte, 2, 1)).toEqual(werte);
    expect(spalteVerschieben(werte, -1, 1)).toEqual(werte);
  });

  it('filtert bekannte Spalten ohne deren Namen zu trimmen oder umzuschreiben', () => {
    const vorschlaege = [' Betrag ', 'Region', 'Betrag', 'Region', '__proto__'];
    expect(spaltenvorschlaegeFiltern(vorschlaege, ' BETRAG ')).toEqual([' Betrag ', 'Betrag']);
    expect(spaltenvorschlaegeFiltern(vorschlaege, '')).toEqual([' Betrag ', 'Region', 'Betrag', '__proto__']);
    expect(spaltenvorschlaegeFiltern(vorschlaege, 'fehlend')).toEqual([]);
  });

  it('zeigt freie Namen und gibt gebundene Werte unverändert an den bestehenden Renderer weiter', () => {
    const weitergegeben: JsonWert[] = [];
    let aenderungen = 0;
    const html = renderToStaticMarkup(
      createElement(SpaltenAuswahl, {
        titel: 'Gruppieren nach',
        werte: ['Noch nicht in der Vorschau', parameter, literal],
        vorschlaege: ['Region'],
        gesperrt: false,
        aendern: () => {
          aenderungen++;
        },
        renderGebunden: (wert) => {
          weitergegeben.push(wert);
          return createElement('span', null, 'Gebundener Wert bleibt erhalten');
        },
      }),
    );
    expect(weitergegeben).toEqual([parameter, literal]);
    expect(weitergegeben[0]).toBe(parameter);
    expect(html).toContain('Noch nicht in der Vorschau');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('aria-invalid="true"');
    expect(aenderungen).toBe(0);
  });

  it('übergibt alle Zuordnungswerte ohne Änderungen und benennt Umbenennen ausdrücklich', () => {
    const weitergegeben: [string, JsonWert][] = [];
    let aenderungen = 0;
    const html = renderToStaticMarkup(
      createElement(ZuordnungsFeld, {
        titel: 'Spalten umbenennen',
        wert: { Region: parameter, Betrag: literal },
        schluesselTitel: 'Bisheriger Spaltenname',
        wertTitel: 'Neuer Spaltenname',
        vorschlaege: ['Region', 'Betrag'],
        gesperrt: false,
        aendern: () => {
          aenderungen++;
        },
        renderWert: (name, wert) => {
          weitergegeben.push([name, wert]);
          return createElement('span', null, 'Vorhandener Wert');
        },
      }),
    );
    expect(weitergegeben).toEqual([
      ['Region', parameter],
      ['Betrag', literal],
    ]);
    expect(html).toContain('Bisheriger Spaltenname „Region“ umbenennen');
    expect(html).toContain('Neuer Spaltenname für Betrag');
    expect(aenderungen).toBe(0);
  });
});
