import type { Projekt } from '../kern/projekt';
import type { SignaturErgebnis, Zertifikat } from '../windows/signatur';
import type { TestOptionen, TestZustand, LaufListe } from './testlauf';
import type { Skriptsprache } from '../kern/sprachen';
import type { PythonStatus } from './python';
import type { BusinessStatus, BusinessFortschritt } from './business-laufzeit';

export type BeispielKennung =
  | 'business-monat'
  | 'business-bestellungen'
  | 'business-bestellvorschlag'
  | 'business-belege'
  | 'business-stapel'
  | 'begruessung'
  | 'backup'
  | 'dateiliste'
  | 'begruessung-python'
  | 'backup-python'
  | 'dateiliste-python';

export interface Einstellungen {
  /** Fehlende Werte älterer lokaler Einstellungen werden im Hauptprozess als dunkel ergänzt. */
  darstellung?: 'dunkel' | 'hell' | 'system';
  letzteSkriptsprache: Skriptsprache | null;
  pythonInterpreter: string | null;
  automatischeUpdates: boolean;
  vorabversionen: boolean;
  palettenBreite: number;
  paletteEingeklappt: boolean;
  eigenschaftenAngeheftet: boolean;
  textSkalierung: number;
}
export interface Dokument {
  projekt: Projekt;
  dateiname: string | null;
  geaendert: boolean;
  projektKennung: string;
  entwurfStatus: EntwurfStatus;
  konflikt: boolean;
  darstellungNoetig: boolean;
}
export type VerfuegbarkeitsZustand =
  'unbekannt' | 'prueft' | 'verfuegbar' | 'geaendert' | 'fehlt' | 'nicht-erreichbar' | 'ungueltig';
export interface Verfuegbarkeit {
  zustand: VerfuegbarkeitsZustand;
  meldung: string;
}
export interface ProjektEintrag {
  skriptsprache: Skriptsprache;
  id: string;
  projektKennung: string;
  name: string;
  beschreibung: string;
  pfad: string;
  zuletztGeoeffnet: string | null;
  geaendertAm: string;
  groesse: number;
  hash: string;
  verfuegbarkeit: VerfuegbarkeitsZustand;
}
export interface EntwurfEintrag {
  skriptsprache: Skriptsprache;
  id: string;
  projektKennung: string;
  name: string;
  beschreibung: string;
  gesichertAm: string;
  ausgangspfad: string | null;
  baselineHash: string | null;
}
export interface EntwurfStatus {
  id: string | null;
  phase: 'kein' | 'ausstehend' | 'gesichert' | 'fehler';
  gesichertAm: string | null;
  meldung: string | null;
}
export interface ProjektBibliothek {
  projekte: ProjektEintrag[];
  entwuerfe: EntwurfEintrag[];
  hinweis: string | null;
}
export type Antwort<T> = { ok: true; wert: T } | { ok: false; meldung: string };
export interface ExportErgebnis {
  dateiname: string;
  skriptsprache: Skriptsprache;
  signatur: SignaturErgebnis | null;
}
export interface ScriptLabBruecke {
  businessLesen(): Promise<
    Antwort<{ status: BusinessStatus | null; fortschritt: BusinessFortschritt | null; aktiv: boolean }>
  >;
  businessAktion(
    art: 'pruefen' | 'einrichten' | 'offline' | 'abbrechen',
  ): Promise<Antwort<BusinessStatus | null>>;
  laden(): Promise<Antwort<{ dokument: Dokument; einstellungen: Einstellungen; version: string }>>;
  aendern(projekt: Projekt): Promise<Antwort<void>>;
  darstellungBereit(projekt: Projekt): Promise<Antwort<Dokument>>;
  beiStandAnfrage(lesen: () => Projekt): () => void;
  neu(projekt: Projekt, sprache: Skriptsprache): Promise<Antwort<Dokument | null>>;
  oeffnen(projekt: Projekt): Promise<Antwort<Dokument | null>>;
  beispielOeffnen(projekt: Projekt, beispiel: BeispielKennung): Promise<Antwort<Dokument | null>>;
  speichern(projekt: Projekt, unter: boolean): Promise<Antwort<Dokument | null>>;
  exportieren(projekt: Projekt): Promise<Antwort<ExportErgebnis | null>>;
  projektExportieren(projekt: Projekt): Promise<Antwort<ExportErgebnis | null>>;
  arbeitsordnerAnzeigen(): Promise<Antwort<void>>;
  exportOrdnerAnzeigen(): Promise<Antwort<void>>;
  zertifikate(): Promise<Antwort<Zertifikat[]>>;
  einstellungenSpeichern(einstellungen: Einstellungen): Promise<Antwort<Einstellungen>>;
  updateAktion(aktion: 'status' | 'pruefen' | 'laden' | 'installieren'): Promise<Antwort<unknown>>;
  bibliothekLesen(): Promise<Antwort<ProjektBibliothek>>;
  projektVerfuegbarkeit(id: string): Promise<Antwort<Verfuegbarkeit>>;
  bekanntesOeffnen(projekt: Projekt, id: string): Promise<Antwort<Dokument | null>>;
  bekanntesNeuZuordnen(projekt: Projekt, id: string): Promise<Antwort<Dokument | null>>;
  projektVerweisEntfernen(id: string): Promise<Antwort<boolean>>;
  projektOrdnerAnzeigen(id: string): Promise<Antwort<void>>;
  entwurfOeffnen(projekt: Projekt, id: string): Promise<Antwort<Dokument | null>>;
  entwurfSpeichernAls(projekt: Projekt, id: string): Promise<Antwort<Dokument | null>>;
  entwurfLoeschen(id: string): Promise<Antwort<boolean>>;
  entwurfSichern(projekt: Projekt): Promise<Antwort<Dokument>>;
  testLesen(): Promise<Antwort<{ zustand: TestZustand; optionen: TestOptionen }>>;
  laufListe(): Promise<Antwort<LaufListe>>;
  laufLesen(laufId: string): Promise<Antwort<{ zustand: TestZustand; standAktuell: boolean }>>;
  laufDateiAnzeigen(laufId: string, art: 'ausgabe' | 'bericht', index?: number): Promise<Antwort<void>>;
  laufProtokollKopieren(laufId: string): Promise<Antwort<void>>;
  laufProtokollSpeichern(laufId: string): Promise<Antwort<boolean>>;
  testStarten(projekt: Projekt, optionen: TestOptionen): Promise<Antwort<TestZustand>>;
  testStoppen(laufId: string): Promise<Antwort<TestZustand>>;
  testAusgabeLeeren(): Promise<Antwort<TestZustand>>;
  testAusgabeKopieren(): Promise<Antwort<void>>;
  testOrdnerWaehlen(): Promise<Antwort<string | null>>;
  testVerlassen(): Promise<Antwort<boolean>>;
  pythonStatus(): Promise<Antwort<PythonStatus>>;
  pythonPruefen(): Promise<Antwort<PythonStatus>>;
  pythonWaehlen(): Promise<Antwort<PythonStatus | null>>;
  pythonHilfeOeffnen(): Promise<Antwort<void>>;
}

declare global {
  interface Window {
    scriptlab: ScriptLabBruecke;
  }
}
