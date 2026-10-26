export interface PythonInstallation {
  pfad: string;
  version: string;
  architektur: 'x64';
  implementierung: 'CPython';
  tkinter: boolean | null;
}

export interface PythonStatus {
  zustand: 'ungeprueft' | 'prueft' | 'bereit' | 'fehlt' | 'fehler';
  auswahl: string | null;
  installation: PythonInstallation | null;
  meldung: string;
}
