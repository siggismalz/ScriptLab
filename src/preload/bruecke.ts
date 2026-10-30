import { jsonSchreiben } from '../gemeinsam/json';
import { contextBridge, ipcRenderer } from 'electron';
import type { ScriptLabBruecke, ScriptLabTransport } from '../gemeinsam/bruecke';

async function aufrufen(kanal: string, daten?: unknown) {
  return JSON.parse(await ipcRenderer.invoke(kanal, daten === undefined ? undefined : jsonSchreiben(daten)));
}

// Die Sandbox erhält ausschließlich diese fachlichen Aufrufe, keine Electron-Objekte.
const bruecke: ScriptLabBruecke = {
  mlLesen: () => aufrufen('scriptlab:ml-lesen'),
  mlAktion: (art) => aufrufen('scriptlab:ml-aktion', art),
  businessLesen: () => aufrufen('scriptlab:business-lesen'),
  businessAktion: (art) => aufrufen('scriptlab:business-aktion', art),
  laden: () => aufrufen('scriptlab:laden'),
  aendern: (projekt) => aufrufen('scriptlab:aendern', projekt),
  darstellungBereit: (projekt) => aufrufen('scriptlab:darstellung-bereit', projekt),
  beiStandAnfrage: (lesen) => {
    const anfrage = (_event: unknown, kennung: unknown) => {
      if (typeof kennung !== 'string' || !/^[a-f0-9-]{36}$/.test(kennung)) return;
      try {
        ipcRenderer.send('scriptlab:stand-antwort', jsonSchreiben({ kennung, projekt: lesen() }));
      } catch {
        /* Der Hauptprozess bricht nach Zeitlimit sicher ab. */
      }
    };
    ipcRenderer.on('scriptlab:stand-anfordern', anfrage);
    return () => {
      ipcRenderer.removeListener('scriptlab:stand-anfordern', anfrage);
    };
  },
  neu: (projekt, sprache, workflowArt = 'allgemein') =>
    aufrufen('scriptlab:neu', { projekt, sprache, workflowArt }),
  oeffnen: (projekt) => aufrufen('scriptlab:oeffnen', projekt),
  beispielOeffnen: (projekt, beispiel) => aufrufen('scriptlab:beispiel', { projekt, beispiel }),
  speichern: (projekt, unter) => aufrufen('scriptlab:speichern', { projekt, unter }),
  exportieren: (projekt) => aufrufen('scriptlab:exportieren', projekt),
  projektExportieren: (projekt) => aufrufen('scriptlab:projekt-exportieren', projekt),
  arbeitsordnerAnzeigen: () => aufrufen('scriptlab:arbeitsordner-anzeigen'),
  exportOrdnerAnzeigen: () => aufrufen('scriptlab:exportordner'),
  zertifikate: () => aufrufen('scriptlab:zertifikate'),
  einstellungenSpeichern: (einstellungen) => aufrufen('scriptlab:einstellungen', einstellungen),
  updateAktion: (aktion) => aufrufen('scriptlab:update', aktion),
  bibliothekLesen: () => aufrufen('scriptlab:bibliothek'),
  projektVerfuegbarkeit: (id) => aufrufen('scriptlab:projekt-verfuegbarkeit', id),
  bekanntesOeffnen: (projekt, id) => aufrufen('scriptlab:bekanntes-oeffnen', { projekt, id }),
  bekanntesNeuZuordnen: (projekt, id) => aufrufen('scriptlab:bekanntes-neu-zuordnen', { projekt, id }),
  projektVerweisEntfernen: (id) => aufrufen('scriptlab:projekt-verweis-entfernen', id),
  projektOrdnerAnzeigen: (id) => aufrufen('scriptlab:projekt-ordner', id),
  entwurfOeffnen: (projekt, id) => aufrufen('scriptlab:entwurf-oeffnen', { projekt, id }),
  entwurfSpeichernAls: (projekt, id) => aufrufen('scriptlab:entwurf-speichern-als', { projekt, id }),
  entwurfLoeschen: (id) => aufrufen('scriptlab:entwurf-loeschen', id),
  entwurfSichern: (projekt) => aufrufen('scriptlab:entwurf-sichern', projekt),
  testLesen: () => aufrufen('scriptlab:test-lesen'),
  laufListe: () => aufrufen('scriptlab:lauf-liste'),
  laufLesen: (laufId) => aufrufen('scriptlab:lauf-lesen', laufId),
  laufDateiAnzeigen: (laufId, art, index) => aufrufen('scriptlab:lauf-datei', { laufId, art, index }),
  laufProtokollKopieren: (laufId) => aufrufen('scriptlab:lauf-protokoll-kopieren', laufId),
  laufProtokollSpeichern: (laufId) => aufrufen('scriptlab:lauf-protokoll-speichern', laufId),
  testStarten: (projekt, optionen) => aufrufen('scriptlab:test-starten', { projekt, optionen }),
  datenvorschauStarten: (projekt, blockId, optionen) =>
    aufrufen('scriptlab:datenvorschau-starten', { projekt, blockId, optionen }),
  quelleWaehlen: (blockId, feldPfad) => aufrufen('scriptlab:quelle-waehlen', { blockId, feldPfad }),
  testStoppen: (laufId) => aufrufen('scriptlab:test-stoppen', laufId),
  testAusgabeLeeren: () => aufrufen('scriptlab:test-leeren'),
  testAusgabeKopieren: () => aufrufen('scriptlab:test-kopieren'),
  testOrdnerWaehlen: () => aufrufen('scriptlab:test-ordner'),
  testVerlassen: () => aufrufen('scriptlab:test-verlassen'),
  pythonStatus: () => aufrufen('scriptlab:python-status'),
  pythonPruefen: () => aufrufen('scriptlab:python-pruefen'),
  pythonWaehlen: () => aufrufen('scriptlab:python-waehlen'),
  pythonHilfeOeffnen: () => aufrufen('scriptlab:python-hilfe'),
};
// contextBridge begrenzt verschachtelte Objekte auf 1000 Ebenen. Blockly-Folgen
// liegen als next.block-Baum vor. Nur die Weltgrenze verwendet deshalb Text;
// die festen IPC-Kanäle und ihre vollständige Main-Validierung bleiben erhalten.
const transport = Object.fromEntries(
  Object.entries(bruecke)
    .filter(([name]) => name !== 'beiStandAnfrage')
    .map(([name, funktion]) => [
      name,
      async (argumente: string) => {
        if (typeof argumente !== 'string' || argumente.length > 5 * 1024 * 1024)
          throw new Error('Die Anfrage ist zu groß oder ungültig.');
        const werte: unknown = JSON.parse(argumente);
        if (!Array.isArray(werte)) throw new Error('Die Anfrage enthält keine gültigen Argumente.');
        return jsonSchreiben(await (funktion as (...args: unknown[]) => unknown)(...werte));
      },
    ]),
) as unknown as ScriptLabTransport;
transport.beiStandAnfrage = (lesen) => bruecke.beiStandAnfrage(() => JSON.parse(lesen()));
contextBridge.exposeInMainWorld('scriptlabTransport', Object.freeze(transport));
