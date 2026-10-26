import { contextBridge, ipcRenderer } from 'electron';
import type { ScriptLabBruecke } from '../gemeinsam/bruecke';

// Die Sandbox erhält ausschließlich diese fachlichen Aufrufe, keine Electron-Objekte.
const bruecke: ScriptLabBruecke = {
  businessLesen: () => ipcRenderer.invoke('scriptlab:business-lesen'),
  businessAktion: (art) => ipcRenderer.invoke('scriptlab:business-aktion', art),
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
  neu: (projekt, sprache) => ipcRenderer.invoke('scriptlab:neu', { projekt, sprache }),
  oeffnen: (projekt) => ipcRenderer.invoke('scriptlab:oeffnen', projekt),
  beispielOeffnen: (projekt, beispiel) => ipcRenderer.invoke('scriptlab:beispiel', { projekt, beispiel }),
  speichern: (projekt, unter) => ipcRenderer.invoke('scriptlab:speichern', { projekt, unter }),
  exportieren: (projekt) => ipcRenderer.invoke('scriptlab:exportieren', projekt),
  exportOrdnerAnzeigen: () => ipcRenderer.invoke('scriptlab:exportordner'),
  zertifikate: () => ipcRenderer.invoke('scriptlab:zertifikate'),
  einstellungenSpeichern: (einstellungen) => ipcRenderer.invoke('scriptlab:einstellungen', einstellungen),
  updateAktion: (aktion) => ipcRenderer.invoke('scriptlab:update', aktion),
  bibliothekLesen: () => ipcRenderer.invoke('scriptlab:bibliothek'),
  projektVerfuegbarkeit: (id) => ipcRenderer.invoke('scriptlab:projekt-verfuegbarkeit', id),
  bekanntesOeffnen: (projekt, id) => ipcRenderer.invoke('scriptlab:bekanntes-oeffnen', { projekt, id }),
  bekanntesNeuZuordnen: (projekt, id) =>
    ipcRenderer.invoke('scriptlab:bekanntes-neu-zuordnen', { projekt, id }),
  projektVerweisEntfernen: (id) => ipcRenderer.invoke('scriptlab:projekt-verweis-entfernen', id),
  projektOrdnerAnzeigen: (id) => ipcRenderer.invoke('scriptlab:projekt-ordner', id),
  entwurfOeffnen: (projekt, id) => ipcRenderer.invoke('scriptlab:entwurf-oeffnen', { projekt, id }),
  entwurfSpeichernAls: (projekt, id) =>
    ipcRenderer.invoke('scriptlab:entwurf-speichern-als', { projekt, id }),
  entwurfLoeschen: (id) => ipcRenderer.invoke('scriptlab:entwurf-loeschen', id),
  entwurfSichern: (projekt) => ipcRenderer.invoke('scriptlab:entwurf-sichern', projekt),
  testLesen: () => ipcRenderer.invoke('scriptlab:test-lesen'),
  testStarten: (projekt, optionen) => ipcRenderer.invoke('scriptlab:test-starten', { projekt, optionen }),
  testStoppen: (laufId) => ipcRenderer.invoke('scriptlab:test-stoppen', laufId),
  testAusgabeLeeren: () => ipcRenderer.invoke('scriptlab:test-leeren'),
  testAusgabeKopieren: () => ipcRenderer.invoke('scriptlab:test-kopieren'),
  testOrdnerWaehlen: () => ipcRenderer.invoke('scriptlab:test-ordner'),
  testVerlassen: () => ipcRenderer.invoke('scriptlab:test-verlassen'),
  pythonStatus: () => ipcRenderer.invoke('scriptlab:python-status'),
  pythonPruefen: () => ipcRenderer.invoke('scriptlab:python-pruefen'),
  pythonWaehlen: () => ipcRenderer.invoke('scriptlab:python-waehlen'),
  pythonHilfeOeffnen: () => ipcRenderer.invoke('scriptlab:python-hilfe'),
};
contextBridge.exposeInMainWorld('scriptlab', Object.freeze(bruecke));
