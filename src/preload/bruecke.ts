import { contextBridge, ipcRenderer } from 'electron';
import type { ScriptLabBruecke } from '../gemeinsam/bruecke';

// Die Sandbox erhält ausschließlich diese fachlichen Aufrufe, keine Electron-Objekte.
const bruecke: ScriptLabBruecke = {
  laden: () => ipcRenderer.invoke('scriptlab:laden'),
  aendern: (projekt) => ipcRenderer.invoke('scriptlab:aendern', projekt),
  darstellungBereit: (projekt) => ipcRenderer.invoke('scriptlab:darstellung-bereit', projekt),
  beiStandAnfrage: (lesen) => {
    const anfrage = (_event: unknown, kennung: unknown) => {
      if (typeof kennung !== 'string' || !/^[a-f0-9-]{36}$/.test(kennung)) return;
      try {
        ipcRenderer.send('scriptlab:stand-antwort', { kennung, projekt: lesen() });
      } catch {
        /* Der Hauptprozess bricht nach Zeitlimit sicher ab. */
      }
    };
    ipcRenderer.on('scriptlab:stand-anfordern', anfrage);
    return () => {
      ipcRenderer.removeListener('scriptlab:stand-anfordern', anfrage);
    };
  },
  neu: (projekt) => ipcRenderer.invoke('scriptlab:neu', projekt),
  oeffnen: (projekt) => ipcRenderer.invoke('scriptlab:oeffnen', projekt),
  beispielOeffnen: (projekt, beispiel) => ipcRenderer.invoke('scriptlab:beispiel', { projekt, beispiel }),
  speichern: (projekt, unter) => ipcRenderer.invoke('scriptlab:speichern', { projekt, unter }),
  exportieren: (projekt) => ipcRenderer.invoke('scriptlab:exportieren', projekt),
  exportOrdnerAnzeigen: () => ipcRenderer.invoke('scriptlab:exportordner'),
  zertifikate: () => ipcRenderer.invoke('scriptlab:zertifikate'),
  einstellungenSpeichern: (einstellungen) => ipcRenderer.invoke('scriptlab:einstellungen', einstellungen),
  updateAktion: (aktion) => ipcRenderer.invoke('scriptlab:update', aktion),
};
contextBridge.exposeInMainWorld('scriptlab', Object.freeze(bruecke));
