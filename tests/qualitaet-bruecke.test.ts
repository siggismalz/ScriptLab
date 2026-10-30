import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { z } from 'zod';
import { jsonSchreiben } from '../src/gemeinsam/json';
import type { ScriptLabTransport } from '../src/gemeinsam/bruecke';
import { brueckeVerbinden } from '../src/renderer/bruecke';
import { neuesProjekt, projektPruefen } from '../src/kern/projekt';

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: electron,
}));

function umfangreicherStand() {
  const projekt = neuesProjekt('python');
  projekt.name = 'Langer deutscher Workflow ä 😀';
  projekt.ansicht = { zoom: 0.75, x: -101, y: 987 };
  const folge = (anzahl: number, name: string) => {
    const start = {
      type: 'sl_comment',
      id: `${name}-0`,
      fields: { TEXT: 'Schritt 0 "Grüße"' },
    } as import('../src/kern/projekt').EditorBlock;
    let ende = start;
    for (let i = 1; i < anzahl; i++) {
      ende.next = {
        block: { type: 'sl_comment', id: `${name}-${i}`, fields: { TEXT: `Schritt ${i} "Grüße"` } },
      };
      ende = ende.next.block;
    }
    return start;
  };
  projekt.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_if',
      id: 'verzweigung',
      inputs: {
        BEDINGUNG: { block: { type: 'sl_bool', id: 'bedingung', fields: { WERT: 'WAHR' } } },
        DANN: { block: folge(498, 'dann') },
        SONST: { block: folge(499, 'sonst') },
      },
    },
  };
  return projekt;
}

describe('Weltgrenze mit festen fachlichen Brückenmethoden', () => {
  let transport: ScriptLabTransport;
  beforeAll(async () => {
    await import('../src/preload/bruecke');
    expect(electron.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(electron.exposeInMainWorld.mock.calls[0][0]).toBe('scriptlabTransport');
    transport = electron.exposeInMainWorld.mock.calls[0][1];
  });
  beforeEach(() => {
    electron.invoke.mockReset().mockResolvedValue(JSON.stringify({ ok: true, wert: undefined }));
    electron.send.mockClear();
    electron.on.mockClear();
    electron.removeListener.mockClear();
  });

  it('bewahrt ein geprüftes 1000-Blockprojekt in beiden Transportrichtungen vollständig', async () => {
    const projekt = umfangreicherStand();
    const text = JSON.stringify(projekt);
    electron.invoke.mockImplementation(async (kanal, transportdaten) => {
      expect(kanal).toBe('scriptlab:speichern');
      expect(typeof transportdaten).toBe('string');
      const daten = JSON.parse(transportdaten);
      expect(daten.unter).toBe(false);
      expect(JSON.stringify(projektPruefen(daten.projekt))).toBe(text);
      return JSON.stringify({
        ok: true,
        wert: { projekt: daten.projekt, dateiname: null, geaendert: false },
      });
    });
    const antwort = await brueckeVerbinden(transport).speichern(projekt, false);
    expect(antwort.ok).toBe(true);
    if (!antwort.ok || !antwort.wert) throw new Error('Die Rundreise lieferte keinen Projektstand.');
    expect(JSON.stringify(antwort.wert.projekt)).toBe(text);
    expect(electron.invoke).toHaveBeenCalledTimes(1);
  });

  it('erhält die optional fehlende Berichtposition des vorhandenen UI-Aufrufs', async () => {
    await brueckeVerbinden(transport).laufDateiAnzeigen('lauf-id', 'bericht', undefined);
    const [kanal, transportdaten] = electron.invoke.mock.calls[0];
    const daten = JSON.parse(transportdaten);
    expect(kanal).toBe('scriptlab:lauf-datei');
    expect(daten).toEqual({ laufId: 'lauf-id', art: 'bericht', index: undefined });
  });

  it('überträgt Ausgabeindex 0, Abbruch null und boolean false unverändert', async () => {
    const bruecke = brueckeVerbinden(transport);
    await bruecke.laufDateiAnzeigen('lauf-id', 'ausgabe', 0);
    expect(electron.invoke).toHaveBeenLastCalledWith(
      'scriptlab:lauf-datei',
      JSON.stringify({ laufId: 'lauf-id', art: 'ausgabe', index: 0 }),
    );
    electron.invoke.mockResolvedValueOnce(JSON.stringify({ ok: true, wert: null }));
    expect(await bruecke.oeffnen(neuesProjekt('vbs'))).toEqual({ ok: true, wert: null });
    electron.invoke.mockResolvedValueOnce(JSON.stringify({ ok: true, wert: false }));
    expect(await bruecke.testVerlassen()).toEqual({ ok: true, wert: false });
  });

  it('erhält fachliche Fehlermeldungen und Promise-Ablehnungen', async () => {
    const bruecke = brueckeVerbinden(transport);
    electron.invoke.mockResolvedValueOnce(
      JSON.stringify({ ok: false, meldung: 'Datei "Grüße ä" ist gesperrt.' }),
    );
    expect(await bruecke.arbeitsordnerAnzeigen()).toEqual({
      ok: false,
      meldung: 'Datei "Grüße ä" ist gesperrt.',
    });
    electron.invoke.mockRejectedValueOnce(new Error('Verbindung unterbrochen'));
    await expect(bruecke.testStoppen('lauf-id')).rejects.toThrow('Verbindung unterbrochen');
  });

  it('liefert bei Antwort<void> weiterhin ok und einen undefinierten Ergebniswert', async () => {
    const antwort = await brueckeVerbinden(transport).arbeitsordnerAnzeigen();
    expect(antwort.ok).toBe(true);
    if (antwort.ok) expect(antwort.wert).toBeUndefined();
  });

  it('meldet fehlende oder beschädigte Protokollantworten als Fehler statt als Erfolg', async () => {
    const bruecke = brueckeVerbinden(transport);
    for (const antwort of [undefined, 'kein JSON']) {
      electron.invoke.mockResolvedValueOnce(antwort);
      await expect(bruecke.testLesen()).rejects.toThrow();
    }
  });

  it('erhält alle 46 festen Kanalzuordnungen ohne allgemeinen Aufrufkanal', async () => {
    const kanaele: Record<string, string> = {
      mlLesen: 'ml-lesen',
      mlAktion: 'ml-aktion',
      businessLesen: 'business-lesen',
      businessAktion: 'business-aktion',
      laden: 'laden',
      aendern: 'aendern',
      darstellungBereit: 'darstellung-bereit',
      neu: 'neu',
      oeffnen: 'oeffnen',
      beispielOeffnen: 'beispiel',
      speichern: 'speichern',
      exportieren: 'exportieren',
      projektExportieren: 'projekt-exportieren',
      arbeitsordnerAnzeigen: 'arbeitsordner-anzeigen',
      exportOrdnerAnzeigen: 'exportordner',
      zertifikate: 'zertifikate',
      einstellungenSpeichern: 'einstellungen',
      updateAktion: 'update',
      bibliothekLesen: 'bibliothek',
      projektVerfuegbarkeit: 'projekt-verfuegbarkeit',
      bekanntesOeffnen: 'bekanntes-oeffnen',
      bekanntesNeuZuordnen: 'bekanntes-neu-zuordnen',
      projektVerweisEntfernen: 'projekt-verweis-entfernen',
      projektOrdnerAnzeigen: 'projekt-ordner',
      entwurfOeffnen: 'entwurf-oeffnen',
      entwurfSpeichernAls: 'entwurf-speichern-als',
      entwurfLoeschen: 'entwurf-loeschen',
      entwurfSichern: 'entwurf-sichern',
      testLesen: 'test-lesen',
      laufListe: 'lauf-liste',
      laufLesen: 'lauf-lesen',
      laufDateiAnzeigen: 'lauf-datei',
      laufProtokollKopieren: 'lauf-protokoll-kopieren',
      laufProtokollSpeichern: 'lauf-protokoll-speichern',
      testStarten: 'test-starten',
      datenvorschauStarten: 'datenvorschau-starten',
      quelleWaehlen: 'quelle-waehlen',
      testStoppen: 'test-stoppen',
      testAusgabeLeeren: 'test-leeren',
      testAusgabeKopieren: 'test-kopieren',
      testOrdnerWaehlen: 'test-ordner',
      testVerlassen: 'test-verlassen',
      pythonStatus: 'python-status',
      pythonPruefen: 'python-pruefen',
      pythonWaehlen: 'python-waehlen',
      pythonHilfeOeffnen: 'python-hilfe',
    };
    const bruecke = brueckeVerbinden(transport) as unknown as Record<
      string,
      (...daten: unknown[]) => Promise<unknown>
    >;
    expect(Object.keys(kanaele)).toHaveLength(46);
    for (const [methode, kanal] of Object.entries(kanaele)) {
      await bruecke[methode]('eins', 'zwei', 'drei');
      expect(electron.invoke.mock.lastCall?.[0], methode).toBe(`scriptlab:${kanal}`);
    }
    expect(electron.invoke).toHaveBeenCalledTimes(46);
  });

  it('transportiert Standanfrage und Abmeldung als feste Funktionen ohne verlorene Projektwerte', () => {
    const projekt = umfangreicherStand();
    const lesen = vi.fn(() => projekt);
    const abmelden = brueckeVerbinden(transport).beiStandAnfrage(lesen);
    const [kanal, anfrage] = electron.on.mock.calls[0];
    expect(kanal).toBe('scriptlab:stand-anfordern');
    const kennung = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    anfrage({}, kennung);
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(electron.send.mock.calls[0][0]).toBe('scriptlab:stand-antwort');
    expect(typeof electron.send.mock.calls[0][1]).toBe('string');
    const antwort = JSON.parse(electron.send.mock.calls[0][1]);
    expect(antwort.kennung).toBe(kennung);
    expect(JSON.stringify(antwort.projekt)).toBe(JSON.stringify(projekt));
    abmelden();
    expect(electron.removeListener).toHaveBeenCalledWith('scriptlab:stand-anfordern', anfrage);
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it('ignoriert ungültige Standkennungen und beantwortet fehlerhafte Lesefunktionen nicht', () => {
    const lesen = vi.fn(() => {
      throw new Error('Stand nicht verfügbar');
    });
    brueckeVerbinden(transport).beiStandAnfrage(lesen);
    const anfrage = electron.on.mock.calls[0][1];
    expect(() => anfrage({}, 'keine-kennung')).not.toThrow();
    expect(lesen).not.toHaveBeenCalled();
    expect(() => anfrage({}, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).not.toThrow();
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(electron.send).not.toHaveBeenCalled();
  });

  it('weist ungültige oder zu große Transportargumente vor einem IPC-Aufruf zurück', async () => {
    for (const daten of ['kein JSON', '{}', 'x'.repeat(5 * 1024 * 1024 + 1), null]) {
      await expect(transport.laden(daten as string)).rejects.toThrow();
    }
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it('exportiert ausschließlich feste fachliche Aktionen und keine freien Kanäle oder Electronobjekte', () => {
    const erwartet = [
      'mlLesen',
      'mlAktion',
      'businessLesen',
      'businessAktion',
      'laden',
      'aendern',
      'darstellungBereit',
      'beiStandAnfrage',
      'neu',
      'oeffnen',
      'beispielOeffnen',
      'speichern',
      'exportieren',
      'projektExportieren',
      'arbeitsordnerAnzeigen',
      'exportOrdnerAnzeigen',
      'zertifikate',
      'einstellungenSpeichern',
      'updateAktion',
      'bibliothekLesen',
      'projektVerfuegbarkeit',
      'bekanntesOeffnen',
      'bekanntesNeuZuordnen',
      'projektVerweisEntfernen',
      'projektOrdnerAnzeigen',
      'entwurfOeffnen',
      'entwurfSpeichernAls',
      'entwurfLoeschen',
      'entwurfSichern',
      'testLesen',
      'laufListe',
      'laufLesen',
      'laufDateiAnzeigen',
      'laufProtokollKopieren',
      'laufProtokollSpeichern',
      'testStarten',
      'datenvorschauStarten',
      'quelleWaehlen',
      'testStoppen',
      'testAusgabeLeeren',
      'testAusgabeKopieren',
      'testOrdnerWaehlen',
      'testVerlassen',
      'pythonStatus',
      'pythonPruefen',
      'pythonWaehlen',
      'pythonHilfeOeffnen',
    ].sort();
    expect(Object.keys(transport).sort()).toEqual(erwartet);
    const bruecke = brueckeVerbinden(transport);
    expect(Object.keys(bruecke).sort()).toEqual(erwartet);
    expect(Object.isFrozen(transport)).toBe(true);
    expect(Object.isFrozen(bruecke)).toBe(true);
    for (const name of ['invoke', 'send', 'ipcRenderer', 'require', 'shell', 'execute', '__proto__']) {
      expect(Object.hasOwn(transport, name)).toBe(false);
      expect(Object.hasOwn(bruecke, name)).toBe(false);
    }
  });
});

/** Echte Registrierungsfunktion isoliert, ohne Electron-Appstart oder produktive Dateidienste. */
function mainTransport(dienst = vi.fn((daten: unknown) => daten)) {
  const quelle = readFileSync(new URL('../src/main/hauptprozess.ts', import.meta.url), 'utf8');
  const anfang = quelle.indexOf('function registrieren(');
  const ende = quelle.indexOf('\nfunction arbeitsordnerFuer(', anfang);
  if (anfang < 0 || ende < anfang) throw new Error('Die Main-Registrierung konnte nicht isoliert werden.');
  const code = transformSync(quelle.slice(anfang, ende), { loader: 'ts' }).code;
  let aufrufen!: (event: unknown, daten: unknown) => Promise<string>;
  const absenderPruefen = vi.fn();
  runInNewContext(code + '\nregistrieren("pruefung", dienst);', {
    ipcMain: {
      handle: (kanal: string, funktion: typeof aufrufen) => {
        expect(kanal).toBe('scriptlab:pruefung');
        aufrufen = funktion;
      },
    },
    absenderPruefen,
    dienst,
    Buffer,
    jsonSchreiben,
    z,
    dateiFehler: () => 'Die Anfrage ist ungültig.',
  });
  return { aufrufen, dienst, absenderPruefen };
}

describe('Main-Transportgrenze vor den fachlichen Diensten', () => {
  it('erhält große gültige Projekte und den undefinierten Aufruf ohne Daten', async () => {
    const main = mainTransport();
    const stand = umfangreicherStand();
    const antwort = await main.aufrufen({}, JSON.stringify(stand));
    expect(JSON.stringify(JSON.parse(antwort).wert)).toBe(JSON.stringify(stand));
    expect(main.absenderPruefen).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await main.aufrufen({}, undefined))).toEqual({ ok: true });
    expect(main.dienst).toHaveBeenLastCalledWith(undefined);
  });

  it('begrenzt Bytes statt Zeichen und verweigert fremde Typen und beschädigtes JSON', async () => {
    const main = mainTransport();
    for (const daten of [
      { projekt: 'fremdes Objekt' },
      'kein JSON',
      JSON.stringify('€'.repeat(2 * 1024 * 1024)),
    ]) {
      expect(JSON.parse(await main.aufrufen({}, daten)).ok).toBe(false);
    }
    expect(main.absenderPruefen).toHaveBeenCalledTimes(3);
    expect(main.dienst).not.toHaveBeenCalled();
  });

  it('prüft den Absender vor dem Transport und startet bei Ablehnung keinen Dienst', async () => {
    const main = mainTransport();
    main.absenderPruefen.mockImplementation(() => {
      throw new Error('Fremder Absender');
    });
    expect(JSON.parse(await main.aufrufen({}, JSON.stringify({ name: 'gültiger Text' }))).ok).toBe(false);
    expect(main.dienst).not.toHaveBeenCalled();
  });
});
