import { describe, expect, it, vi } from 'vitest';
import { dateipfadAusAblage } from '../src/gemeinsam/dateiablage';
import { brueckeVerbinden } from '../src/renderer/bruecke';
import type { ScriptLabTransport } from '../src/gemeinsam/bruecke';

const datei = new File(['synthetisch'], 'Grüße.csv');
const daten = (dateien: File[]) => ({ files: dateien as unknown as FileList });

describe('Dateipfad aus einer bewussten Ablage', () => {
  it('übergibt genau die native Datei und erhält Sonderzeichen und Leerzeichen unverändert', () => {
    const pfad = 'C:\\Eigene Dateien\\Grüße & Umsatz (1).csv';
    const lesen = vi.fn(() => pfad);
    expect(dateipfadAusAblage(daten([datei]), lesen)).toBe(pfad);
    expect(lesen).toHaveBeenCalledExactlyOnceWith(datei);
  });
  it.each([{ dateien: [] }, { dateien: [datei, datei] }])(
    'lehnt fehlende und mehrere Dateien vor dem Pfadlesen ab',
    ({ dateien }) => {
      const lesen = vi.fn();
      expect(() => dateipfadAusAblage(daten(dateien), lesen)).toThrow('genau eine lokale Datei');
      expect(lesen).not.toHaveBeenCalled();
    },
  );
  it('erfindet aus dem Namen einer virtuellen Datei keinen Pfad', () => {
    expect(() => dateipfadAusAblage(daten([datei]), () => '')).toThrow('keinen lokalen Dateipfad');
  });
  it('erklärt eine fehlgeschlagene native Übergabe', () => {
    expect(() =>
      dateipfadAusAblage(daten([datei]), () => {
        throw Error('kein File');
      }),
    ).toThrow('Wähle die Datei aus');
  });
  it.each(['C:\\Quelle\n.csv', 'C:\\Quelle\0.csv', 'x'.repeat(32769)])(
    'lehnt unbrauchbare Pfade ab',
    (pfad) => {
      expect(() => dateipfadAusAblage(daten([datei]), () => pfad)).toThrow('unzulässige Zeichen');
    },
  );
  it('erhält das File-Objekt über die enge Brücke ohne JSON- oder IPC-Aufruf', () => {
    const lesen = vi.fn(() => 'C:\\Quelle.csv');
    const transport = { dateipfadAusDatei: lesen } as unknown as ScriptLabTransport;
    const bruecke = brueckeVerbinden(transport);
    expect(bruecke.dateipfadAusDatei(datei)).toBe('C:\\Quelle.csv');
    expect(lesen).toHaveBeenCalledExactlyOnceWith(datei);
    expect(Object.isFrozen(bruecke)).toBe(true);
  });
});
