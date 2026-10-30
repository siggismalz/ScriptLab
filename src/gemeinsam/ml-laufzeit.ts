import type { PythonInstallation } from './python';

export interface MLPaketStatus {
  name: string;
  sollVersion: string;
  version: string | null;
  importierbar: boolean;
}
export interface MLFortschritt {
  phase: 'basis' | 'wheels' | 'bootstrap' | 'pakete' | 'pruefung' | 'abschluss';
  meldung: string;
  fertigePakete: number;
  gesamtPakete: number;
}
export interface MLStatus {
  zustand: 'fehlt' | 'prueft' | 'bereit' | 'fehler';
  meldung: string;
  installation: PythonInstallation | null;
  profilHash: string | null;
  pakete: MLPaketStatus[];
  fortschritt: MLFortschritt | null;
}
