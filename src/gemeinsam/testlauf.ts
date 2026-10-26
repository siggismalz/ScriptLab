export type TestPhase =
  | 'bereit'
  | 'vorbereitung'
  | 'laeuft'
  | 'stoppt'
  | 'beendet'
  | 'fehlgeschlagen'
  | 'abgebrochen'
  | 'zeitlimit';

export interface TestOptionen {
  basisVerzeichnis: string | null;
  zeitlimitSekunden: number;
}
export interface ZeilenZuordnung {
  von: number;
  bis: number;
  blockId: string;
}
export interface TestZustand {
  phase: TestPhase;
  laufId: string | null;
  projektKennung: string | null;
  projektName: string | null;
  standHash: string | null;
  vorbereitetAm: string | null;
  gestartetAm: string | null;
  beendetAm: string | null;
  optionen: TestOptionen;
  ausgabe: string;
  abgeschnitteneZeichen: number;
  exitcode: number | null;
  meldung: string;
  quelltext: string | null;
  zeilenZuordnung: ZeilenZuordnung[];
  fehlerBlockId: string | null;
  fehlerZeile: number | null;
  technischeMeldung: string | null;
}
export function testAktiv(phase: TestPhase): boolean {
  return ['vorbereitung', 'laeuft', 'stoppt'].includes(phase);
}
export function testBereit(): TestZustand {
  return {
    phase: 'bereit',
    laufId: null,
    projektKennung: null,
    projektName: null,
    standHash: null,
    vorbereitetAm: null,
    gestartetAm: null,
    beendetAm: null,
    optionen: { basisVerzeichnis: null, zeitlimitSekunden: 120 },
    ausgabe: '',
    abgeschnitteneZeichen: 0,
    exitcode: null,
    meldung: 'Bereit für einen bewusst gestarteten Test.',
    quelltext: null,
    zeilenZuordnung: [],
    fehlerBlockId: null,
    fehlerZeile: null,
    technischeMeldung: null,
  };
}
