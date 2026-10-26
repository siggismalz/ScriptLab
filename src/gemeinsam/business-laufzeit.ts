import type { PythonInstallation } from './python';

export interface BusinessPaketstand {
  name: string;
  sollVersion: string;
  version: string | null;
  importierbar: boolean;
}

export interface BusinessStatus {
  zustand: 'bereit' | 'fehlt' | 'abweichend' | 'ungeeignet' | 'fehler';
  installation: PythonInstallation;
  profil: string;
  lockSha256: string;
  pakete: BusinessPaketstand[];
  meldung: string;
}

export interface BusinessFortschritt {
  phase: 'pruefen' | 'pakete' | 'venv' | 'installieren' | 'abschluss';
  meldung: string;
  fertigePakete: number;
  gesamtPakete: number;
}
