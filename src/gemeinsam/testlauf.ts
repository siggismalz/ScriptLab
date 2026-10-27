export type TestPhase =
  | 'bereit'
  | 'vorbereitung'
  | 'laeuft'
  | 'stoppt'
  | 'beendet'
  | 'mit_fehlern'
  | 'fehlgeschlagen'
  | 'abgebrochen'
  | 'zeitlimit';

export interface TestOptionen {
  business?: {
    modus: 'vorschau' | 'prueflauf' | 'ausfuehren';
    parametersatz: 'test' | 'echt';
    parameter: Record<string, string | number | boolean | null>;
    speicherMB: number;
    tempGB: number;
    fortsetzen: boolean;
  };
  basisVerzeichnis: string | null;
  zeitlimitSekunden: number;
}
export interface ZeilenZuordnung {
  von: number;
  bis: number;
  blockId: string;
}
export interface TestZustand {
  business?: {
    schritt: string | null;
    schrittnamen?: Record<string, string>;
    ereignisse: Record<string, unknown>[];
    vorschau: Record<string, unknown> | null;
    bericht: Record<string, unknown> | null;
  };
  skriptsprache: Skriptsprache | null;
  pythonVersion: string | null;
  phase: TestPhase;
  laufId: string | null;
  projektKennung: string | null;
  projektName: string | null;
  standHash: string | null;
  vorbereitetAm: string | null;
  gestartetAm: string | null;
  prozessId: number | null;
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
    skriptsprache: null,
    pythonVersion: null,
    phase: 'bereit',
    laufId: null,
    projektKennung: null,
    projektName: null,
    standHash: null,
    vorbereitetAm: null,
    gestartetAm: null,
    prozessId: null,
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
import type { Skriptsprache } from '../kern/sprachen';
