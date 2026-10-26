import type { Projekt } from '../kern/projekt';
import type { SignaturErgebnis, Zertifikat } from '../windows/signatur';

export interface Einstellungen {
  automatischeUpdates: boolean;
  vorabversionen: boolean;
}
export interface Dokument {
  projekt: Projekt;
  dateiname: string | null;
  geaendert: boolean;
}
export type Antwort<T> = { ok: true; wert: T } | { ok: false; meldung: string };
export interface ExportErgebnis {
  dateiname: string;
  signatur: SignaturErgebnis;
}
export interface ScriptLabBruecke {
  laden(): Promise<Antwort<{ dokument: Dokument; einstellungen: Einstellungen; version: string }>>;
  aendern(projekt: Projekt): Promise<Antwort<void>>;
  darstellungBereit(projekt: Projekt): Promise<Antwort<Dokument>>;
  beiStandAnfrage(lesen: () => Projekt): () => void;
  neu(projekt: Projekt): Promise<Antwort<Dokument | null>>;
  oeffnen(projekt: Projekt): Promise<Antwort<Dokument | null>>;
  speichern(projekt: Projekt, unter: boolean): Promise<Antwort<Dokument | null>>;
  exportieren(projekt: Projekt): Promise<Antwort<ExportErgebnis | null>>;
  exportOrdnerAnzeigen(): Promise<Antwort<void>>;
  zertifikate(): Promise<Antwort<Zertifikat[]>>;
  einstellungenSpeichern(einstellungen: Einstellungen): Promise<Antwort<Einstellungen>>;
  updateAktion(aktion: 'status' | 'pruefen' | 'laden' | 'installieren'): Promise<Antwort<unknown>>;
}

declare global {
  interface Window {
    scriptlab: ScriptLabBruecke;
  }
}
