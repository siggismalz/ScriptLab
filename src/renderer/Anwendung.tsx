import { jsonSchreiben } from '../gemeinsam/json';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../editor/bausteine';
import { dateipfadAufBlock } from '../editor/dateipfadAblage';
import { dateipfadAusAblage } from '../gemeinsam/dateiablage';
import './dateiablage.css';
import { bausteinDefinitionen } from '../kern/katalog';
import { maximaleBausteinzahl, neuesProjekt, projektPruefen, type Projekt } from '../kern/projekt';
import { skriptErzeugen } from '../kern/skript';
import { sprachdaten, type Skriptsprache } from '../kern/sprachen';
import type { WorkflowArt } from '../kern/workflowarten';
import { scriptlabThema, scriptlabThemaFuer } from '../gestaltung/blocklyThema';
import { blockAuswahlKennzeichnen } from '../gestaltung/blockAuswahl';
import { farben, masse, designTokensAnwenden, farbschemaAufloesen } from '../gestaltung/tokens';
import {
  bausteinEinfuegen,
  ablaufverbindungenVorLadenTrennen,
  bausteinVerschieben,
  einfuegestellenLesen,
  editorNavigationEinrichten,
  verlaufAendern,
  ScriptLabBlockDragger,
  type Einfuegestelle,
} from '../editor/bedienung';
import type {
  Antwort,
  Dokument,
  Einstellungen,
  ExportErgebnis,
  ProjektBibliothek,
  Verfuegbarkeit,
  EntwurfStatus,
} from '../gemeinsam/bruecke';
import type { Zertifikat } from '../windows/signatur';
import type { UpdateZustand } from '../windows/updates';
import { Knopf } from './komponenten/Knopf';
import { Symbol } from './komponenten/Icon';
import { Dialog } from './komponenten/Dialog';
import { Palette, type PlatzierungsAuftrag } from './Palette';
import { Eigenschaften } from './Eigenschaften';
import { EinstellungenDialog } from './EinstellungenDialog';
import { ProjektDialog } from './ProjektDialog';
import { ParameterDialog } from './ParameterDialog';
import { SprachwahlDialog } from './SprachwahlDialog';
import { Variablendialoge } from './Variablendialoge';
import { beispiele, type BeispielKennung } from './hilfe';
import { Menue } from './komponenten/Menue';
import { Startbereich } from './Startbereich';
import { EditorNavigation } from './EditorNavigation';
import { Laufverwaltung } from './Laufverwaltung';
import { LaufKurzansicht } from './LaufKurzansicht';
import { laufOptionenVorbereiten, laufParameterPruefen, LaufParameterFehler } from './laufstart';
import { Datenbereich } from './Datenbereich';
import { ExportDialog } from './ExportDialog';
import { Arbeitsbereiche, type Arbeitsbereich } from './komponenten/Arbeitsbereiche';
import { Marke } from './komponenten/Marke';
import { Lizenzhinweis } from './Lizenzhinweis';
import { BusinessVorbereitung } from './BusinessVorbereitung';
import { businessSchritte } from '../kern/business';
import { datenvorschauHinweis, datenvorschauKontext } from '../kern/datenvorschau';
import { parameterVerweiseUmbenennen } from '../kern/parameterAendern';
import {
  BlockDatenEreignis,
  ParameterEreignis,
  parameterEreignisAnmelden,
} from '../editor/parameterEreignis';
import { testAktiv, testBereit, type TestZustand, type TestOptionen } from '../gemeinsam/testlauf';
import type { PythonStatus } from '../gemeinsam/python';
import paket from '../../package.json' with { type: 'json' };

registriereBausteine();
const bausteinPflichthinweis = 'Vervollständige die markierten Bausteine vor der Ausführung.';
const vorgaben: Einstellungen = {
  automatischeUpdates: false,
  vorabversionen: false,
  palettenBreite: 272,
  paletteEingeklappt: false,
  eigenschaftenAngeheftet: false,
  textSkalierung: 1,
  letzteSkriptsprache: null,
  pythonInterpreter: null,
};
function antwort<T>(r: Antwort<T>): T {
  if (!r.ok) throw new Error(r.meldung);
  return r.wert;
}

export function Anwendung() {
  const [test, setTest] = useState<TestZustand>(testBereit);
  const [vorschauen, setVorschauen] = useState<
    Record<string, { zustand: TestZustand; inhalt: string | null; parameter: string }>
  >({});
  const vorschauAnfrage = useRef<{ inhalt: string | null; parameter: string } | null>(null);
  const vorschauGemerkt = useRef<string | null>(null);
  const [parameterZiel, setParameterZiel] = useState<{ name: string; anfrage: number } | null>(null);
  const [feldZiel, setFeldZiel] = useState<{ blockId: string; pfad: string[]; anfrage: number } | null>(null);
  const [vorschauZiel, setVorschauZiel] = useState<{ blockId: string; anfrage: number } | null>(null);
  const vorschauAusloeser = useRef<HTMLElement | null>(null);
  const [testOptionen, setTestOptionen] = useState<TestOptionen>({
    basisVerzeichnis: null,
    zeitlimitSekunden: 120,
  });
  const [arbeitsbereich, setArbeitsbereich] = useState<Arbeitsbereich>('ablauf');
  const [laufVorbereitungAnfrage, setLaufVorbereitungAnfrage] = useState(0);
  const [laufDetailsAnfrage, setLaufDetailsAnfrage] = useState(0);
  const arbeitsbereichRef = useRef<Arbeitsbereich>('ablauf');
  arbeitsbereichRef.current = arbeitsbereich;
  const testSperre = useRef(false);
  const testAnfrage = useRef(false);
  const laufAktionen = useRef<HTMLElement>(null);
  const laufAktionsFokus = useRef<HTMLElement | null>(null);
  const testInhalt = useRef<string | null>(null);
  const [ansicht, setAnsicht] = useState<'start' | 'editor'>('start');
  const [editorBegonnen, setEditorBegonnen] = useState(false);
  const [startZiel, setStartZiel] = useState<'start' | 'hilfe' | 'projekte' | 'beispiele'>('start');
  const [startAnfrage, setStartAnfrage] = useState(0);
  const [bibliothek, setBibliothek] = useState<ProjektBibliothek | null>(null);
  const [bibliothekLaedt, setBibliothekLaedt] = useState(false);
  const [bibliothekFehler, setBibliothekFehler] = useState<string | null>(null);
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState<Record<string, Verfuegbarkeit>>({});
  const [entwurfStatus, setEntwurfStatus] = useState<EntwurfStatus | null>(null);
  const [dateikonflikt, setDateikonflikt] = useState(false);
  const bibliotheksAnfrage = useRef(0);
  const metadatenCache = useRef(new Map<string, string>());
  const editorSichtbar = useRef(false);
  const editorFokus = useRef<Element | null>(null);
  const aktionsFokus = useRef<Element | null>(null);
  editorSichtbar.current = ansicht === 'editor';
  const element = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const arbeitsbereichGeladen = useRef(false);
  const [workspace, setWorkspace] = useState<Blockly.WorkspaceSvg | null>(null);
  const projektRef = useRef(neuesProjekt());
  const gespeichertRef = useRef(jsonSchreiben(projektRef.current));
  const laedt = useRef(false),
    busy = useRef(false);
  const auswahlRef = useRef<string | null>(null),
    rueckfokus = useRef<HTMLElement | null>(null);
  const platzierungRef = useRef<PlatzierungsAuftrag | null>(null);
  const [projekt, setProjekt] = useState(projektRef.current);
  useEffect(() => {
    setTestOptionen((alt) => ({ basisVerzeichnis: alt.basisVerzeichnis, zeitlimitSekunden: 120 }));
  }, [projekt.projektKennung]);
  const [datei, setDatei] = useState<string | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [einstellungen, setEinstellungen] = useState(vorgaben);
  const einstellungenRef = useRef(vorgaben);
  const [eigenschaftenOffen, setEigenschaftenOffen] = useState(false);
  const [vorschauOffen, setVorschauOffen] = useState(false);
  const [hinweiseOffen, setHinweiseOffen] = useState(false);
  const [pruefungAngefordert, setPruefungAngefordert] = useState(false);
  const [beruehrt, setBeruehrt] = useState<Set<string>>(new Set());
  const [platzierung, setPlatzierung] = useState<PlatzierungsAuftrag | null>(null);
  const [ziele, setZiele] = useState<Einfuegestelle[]>([]);
  const [breite, setBreite] = useState(window.innerWidth);
  const [codeHoehe, setCodeHoehe] = useState(240);
  const [codeUmbruch, setCodeUmbruch] = useState(false);
  const [status, setStatus] = useState('Füge links einen Baustein hinzu.');
  const [statusArt, setStatusArt] = useState<'neutral' | 'erfolg' | 'hinweis' | 'fehler'>('neutral');
  const [meldungsNummer, setMeldungsNummer] = useState(0);
  const [dauerfehler, setDauerfehler] = useState<string | null>(null);
  const [verarbeitung, setVerarbeitung] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    'einstellungen' | 'ueber' | 'projekt' | 'sprache' | 'parameter' | 'export' | null
  >(null);
  const [version, setVersion] = useState(paket.version);
  const [zertifikate, setZertifikate] = useState<Zertifikat[]>([]);
  const [zertifikatMeldung, setZertifikatMeldung] = useState('');
  const [update, setUpdate] = useState<UpdateZustand | null>(null);
  const [exportiert, setExportiert] = useState<ExportErgebnis | null>(null);
  const [pythonStatus, setPythonStatus] = useState<PythonStatus | null>(null);
  const meldungsKontext = `${ansicht}:${arbeitsbereich}:${projekt.projektKennung}`;
  const letzteMeldungsansicht = useRef({ kontext: meldungsKontext, nummer: meldungsNummer });
  useEffect(() => {
    if (statusArt !== 'erfolg') return;
    const timer = setTimeout(() => {
      setStatus('');
      setStatusArt('neutral');
    }, 4000);
    return () => clearTimeout(timer);
  }, [meldungsNummer, statusArt]);
  useEffect(() => {
    const vorher = letzteMeldungsansicht.current;
    letzteMeldungsansicht.current = { kontext: meldungsKontext, nummer: meldungsNummer };
    // Eine neue Bestätigung desselben Ansichtswechsels bleibt kurz sichtbar.
    if (vorher.kontext !== meldungsKontext && vorher.nummer === meldungsNummer && statusArt === 'erfolg') {
      setStatus('');
      setStatusArt('neutral');
    }
  }, [meldungsKontext, meldungsNummer, statusArt]);
  const ergebnis = useMemo(
    () => skriptErzeugen(projekt),
    [projekt.editor, projekt.exportOptionen, projekt.skriptsprache, projekt.business],
  );
  useEffect(() => {
    if (
      statusArt === 'hinweis' &&
      status === bausteinPflichthinweis &&
      !ergebnis.meldungen.some((m) => m.stufe === 'fehler')
    ) {
      setStatus('Die markierten Angaben sind korrigiert. Du kannst den Workflow erneut starten.');
      setStatusArt('erfolg');
      setMeldungsNummer((n) => n + 1);
    }
  }, [ergebnis, status, statusArt]);
  const sprache = sprachdaten[projekt.skriptsprache];
  const sichtbareHinweise = ergebnis.meldungen.filter(
    (m) => pruefungAngefordert || (m.blockId && beruehrt.has(m.blockId)),
  );
  const kannAnheften =
    breite >= 1440 &&
    breite - einstellungen.palettenBreite - masse.eigenschaften >= 600 * einstellungen.textSkalierung;
  const angeheftet = eigenschaftenOffen && kannAnheften && einstellungen.eigenschaftenAngeheftet;
  const nurStart = projekt.editor.blocks?.blocks.length === 1 && !projekt.editor.blocks.blocks[0].next;

  function editorZeigen() {
    setArbeitsbereich('ablauf');
    setEditorBegonnen(true);
    setAnsicht('editor');
  }
  async function startseiteZeigen(ziel: 'start' | 'hilfe' | 'projekte' | 'beispiele' = 'start') {
    try {
      if (!antwort(await window.scriptlab.testVerlassen())) return;
      testUebernehmen(antwort(await window.scriptlab.testLesen()).zustand);
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der laufende Test konnte nicht beendet werden.', 'fehler');
      return;
    }
    editorFokus.current = document.activeElement;
    aendern(standLesen());
    setAnsicht('start');
    setStartZiel(ziel);
    setStartAnfrage((n) => n + 1);
    metadatenCache.current.clear();
  }

  async function bibliothekAktualisieren() {
    const anfrage = ++bibliotheksAnfrage.current;
    setBibliothekLaedt(true);
    setBibliothekFehler(null);
    try {
      const daten = antwort(await window.scriptlab.bibliothekLesen());
      if (anfrage !== bibliotheksAnfrage.current) return;
      setBibliothek(daten);
      // Der Index erscheint sofort. Langsame Speicherorte werden davon getrennt geprueft.
      const offen = daten.projekte.filter((p) => {
        const signatur = `${p.pfad}:${p.hash}`;
        return metadatenCache.current.get(p.id) !== signatur;
      });
      void Promise.all(
        Array.from({ length: Math.min(3, offen.length) }, async () => {
          while (offen.length && anfrage === bibliotheksAnfrage.current) {
            const eintrag = offen.shift()!;
            setVerfuegbarkeiten((alt) => ({
              ...alt,
              [eintrag.id]: { zustand: 'prueft', meldung: 'Verfügbarkeit wird geprüft …' },
            }));
            const r = await window.scriptlab.projektVerfuegbarkeit(eintrag.id);
            if (anfrage === bibliotheksAnfrage.current) {
              // Erst ein wirklich abgeschlossenes Ergebnis darf weitere Abfragen ersetzen.
              metadatenCache.current.set(eintrag.id, `${eintrag.pfad}:${eintrag.hash}`);
              setVerfuegbarkeiten((alt) => ({
                ...alt,
                [eintrag.id]: r.ok ? r.wert : { zustand: 'nicht-erreichbar', meldung: r.meldung },
              }));
            }
          }
        }),
      );
    } catch (e) {
      if (anfrage === bibliotheksAnfrage.current)
        setBibliothekFehler(
          e instanceof Error ? e.message : 'Die lokalen Arbeitsstände konnten nicht geladen werden.',
        );
    } finally {
      if (anfrage === bibliotheksAnfrage.current) setBibliothekLaedt(false);
    }
  }

  function dokumentStatusUebernehmen(daten: Dokument) {
    setEntwurfStatus(daten.entwurfStatus);
    setDateikonflikt(daten.konflikt);
  }

  async function abgebrocheneAktionAbgleichen() {
    const aktuell = antwort(await window.scriptlab.laden()).dokument;
    // Auch eine vorgelagerte Speicherentscheidung kann bereits eine neue Kopie angelegt haben.
    projektRef.current = { ...projektRef.current, projektKennung: aktuell.projekt.projektKennung };
    setProjekt(projektRef.current);
    setDatei(aktuell.dateiname);
    setGeaendert(aktuell.geaendert);
    dokumentStatusUebernehmen(aktuell);
    const kontext = antwort(await window.scriptlab.testLesen());
    setTestOptionen((alt) => ({ ...alt, basisVerzeichnis: kontext.optionen.basisVerzeichnis }));
    if (!aktuell.geaendert) gespeichertRef.current = jsonSchreiben(aktuell.projekt);
  }

  async function bibliotheksProjektOeffnen(
    art: 'projekt' | 'zuordnen' | 'entwurf' | 'entwurf-speichern',
    id: string,
  ) {
    await aktion(
      art === 'entwurf-speichern' ? 'Entwurf wird als Workflow gespeichert …' : 'Workflow wird geöffnet …',
      async () => {
        const aufrufe = {
          projekt: window.scriptlab.bekanntesOeffnen,
          zuordnen: window.scriptlab.bekanntesNeuZuordnen,
          entwurf: window.scriptlab.entwurfOeffnen,
          'entwurf-speichern': window.scriptlab.entwurfSpeichernAls,
        };
        const neu = antwort(await aufrufe[art](standLesen(), id));
        if (neu) {
          if (neu.darstellungNoetig) await dokumentLaden(neu);
          else {
            dokumentStatusUebernehmen(neu);
            setGeaendert(neu.geaendert);
          }
          editorZeigen();
          melden(art === 'entwurf-speichern' ? 'Projekt gespeichert.' : 'Workflow geöffnet.', 'erfolg');
        } else await abgebrocheneAktionAbgleichen();
        await bibliothekAktualisieren();
      },
    );
  }

  async function eintragAktion(art: 'entfernen' | 'loeschen' | 'ordner', id: string) {
    await aktion(
      art === 'ordner' ? 'Speicherordner wird angezeigt …' : 'Lokale Übersicht wird aktualisiert …',
      async () => {
        if (art === 'ordner') antwort(await window.scriptlab.projektOrdnerAnzeigen(id));
        else {
          const erledigt = antwort(
            await (art === 'entfernen'
              ? window.scriptlab.projektVerweisEntfernen(id)
              : window.scriptlab.entwurfLoeschen(id)),
          );
          if (erledigt)
            melden(
              art === 'entfernen'
                ? 'Der Verweis wurde aus der Liste entfernt. Die Projektdatei bleibt erhalten.'
                : 'Der lokale Entwurf wurde gelöscht.',
              'erfolg',
            );
          await bibliothekAktualisieren();
        }
      },
    );
  }

  async function entwurfJetztSichern() {
    await aktion('Entwurf wird lokal gesichert …', async () => {
      const neu = antwort(await window.scriptlab.entwurfSichern(standLesen()));
      dokumentStatusUebernehmen(neu);
      melden(
        neu.entwurfStatus.phase === 'gesichert'
          ? 'Entwurf lokal gesichert. Die Projektdatei bleibt unverändert.'
          : 'Ein unveränderter leerer Workflow benötigt keinen Entwurf.',
        neu.entwurfStatus.phase === 'gesichert' ? 'erfolg' : 'hinweis',
      );
      await bibliothekAktualisieren();
    });
  }

  useEffect(() => {
    if (ansicht === 'start') void bibliothekAktualisieren();
  }, [ansicht]);
  useEffect(() => {
    if (!editorBegonnen) return;
    let aktiv = true;
    let letzterStand = '';
    const lesen = async () => {
      const r = await window.scriptlab.laden();
      if (!aktiv || !r.ok) return;
      const neu = r.wert.dokument;
      dokumentStatusUebernehmen(neu);
      const statuskennung = `${neu.entwurfStatus.phase}:${neu.entwurfStatus.gesichertAm}`;
      if (letzterStand && letzterStand !== statuskennung && !editorSichtbar.current)
        void bibliothekAktualisieren();
      letzterStand = statuskennung;
    };
    const timer = setInterval(() => void lesen(), 900);
    return () => {
      aktiv = false;
      clearInterval(timer);
    };
  }, [editorBegonnen]);
  useEffect(() => {
    if (ansicht !== 'editor') return;
    const frame = requestAnimationFrame(() => {
      const ws = wsRef.current;
      if (!ws) return;
      const { x, y } = projektRef.current.ansicht;
      Blockly.svgResize(ws);
      ws.scroll(x, y);
      if (editorFokus.current?.isConnected && 'focus' in editorFokus.current)
        (editorFokus.current as HTMLElement).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ansicht]);

  function melden(text: string, art: 'neutral' | 'erfolg' | 'hinweis' | 'fehler' = 'neutral') {
    setMeldungsNummer((nummer) => nummer + 1);
    setStatus(text);
    setStatusArt(art);
    if (art === 'fehler') setDauerfehler(text);
  }
  function fehlerSchliessen() {
    if (statusArt === 'fehler' && status === dauerfehler) {
      setStatus('');
      setStatusArt('neutral');
    }
    setDauerfehler(null);
  }
  async function aktion(name: string, funktion: () => Promise<void>) {
    if (busy.current) return;
    aktionsFokus.current = document.activeElement;
    busy.current = true;
    setVerarbeitung(name);
    fehlerSchliessen();
    try {
      await funktion();
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der Vorgang konnte nicht abgeschlossen werden.', 'fehler');
    } finally {
      busy.current = false;
      setVerarbeitung(null);
    }
  }
  useLayoutEffect(() => {
    if (verarbeitung) return;
    const fokus = aktionsFokus.current;
    aktionsFokus.current = null;
    if (document.activeElement !== document.body) return;
    if (fokus?.isConnected && fokus.getClientRects().length && 'focus' in fokus)
      (fokus as HTMLElement).focus({ preventScroll: true });
    else if (ansicht === 'editor')
      document.querySelector<HTMLInputElement>('.palette-suche input')?.focus({ preventScroll: true });
  }, [verarbeitung]);
  function standLesen(): Projekt {
    const ws = wsRef.current;
    return ws && arbeitsbereichGeladen.current
      ? ({
          ...projektRef.current,
          editor: Blockly.serialization.workspaces.save(ws),
          ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY },
        } as Projekt)
      : projektRef.current;
  }
  function aendern(neu: Projekt) {
    if (testSperre.current && testInhaltsText(neu) !== testInhaltsText(projektRef.current)) {
      melden('Stoppe den Test vor Änderungen am Workflow.', 'hinweis');
      return;
    }
    const json = jsonSchreiben(neu);
    if (json === jsonSchreiben(projektRef.current)) return;
    projektRef.current = neu;
    setProjekt(neu);
    setRevision((n) => n + 1);
    const gespeichert = gespeichertRef.current ? (JSON.parse(gespeichertRef.current) as Projekt) : null;
    setGeaendert(!gespeichert || testInhaltsText(neu) !== testInhaltsText(gespeichert));
    setExportiert(null);
    void window.scriptlab.aendern(neu).then((r) => {
      if (!r.ok) melden(r.meldung, 'fehler');
    });
  }
  function auswaehlen(id: string | null) {
    auswahlRef.current = id;
    setAuswahl(id);
    for (const b of wsRef.current?.getAllBlocks(false) ?? []) blockAuswahlKennzeichnen(b, b.id === id);
  }
  function eigenschaftenOeffnen() {
    rueckfokus.current = document.activeElement as HTMLElement;
    setEigenschaftenOffen(true);
  }
  function eigenschaftenSchliessen() {
    setEigenschaftenOffen(false);
    const vorher = rueckfokus.current;
    const ziel =
      vorher?.isConnected && vorher.getClientRects().length
        ? vorher
        : document.querySelector<HTMLElement>('.ansichtknopfgruppe button');
    ziel?.focus({ preventScroll: true });
  }
  async function dokumentLaden(neu: Dokument, nurDaten = false) {
    laedt.current = true;
    try {
      const ws = wsRef.current!;
      const kontext = antwort(await window.scriptlab.testLesen());
      setTestOptionen((alt) => ({ ...alt, basisVerzeichnis: kontext.optionen.basisVerzeichnis }));
      if (nurDaten) {
        // Auf der Startseite existiert noch kein sichtbarer Canvas. Erst im Editor rendern,
        // damit Blockly die gespeicherte Ansicht nicht gegen einen Null-Pixel-Bereich klemmt.
        projektRef.current = neu.projekt;
        gespeichertRef.current = jsonSchreiben(neu.projekt);
        setProjekt(neu.projekt);
        setDatei(neu.dateiname);
        setGeaendert(neu.geaendert);
        dokumentStatusUebernehmen(neu);
        return;
      }
      editorZeigen();
      await new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig())));
      Blockly.svgResize(ws);
      ablaufverbindungenVorLadenTrennen(ws);
      Blockly.serialization.workspaces.load(neu.projekt.editor, ws);
      await Blockly.renderManagement.finishQueuedRenders();
      Blockly.svgResize(ws);
      ws.setScale(Math.max(0.25, Math.min(2, neu.projekt.ansicht.zoom)));
      ws.scroll(neu.projekt.ansicht.x, neu.projekt.ansicht.y);
      ws.clearUndo();
      arbeitsbereichGeladen.current = true;
      const stand = {
        ...neu.projekt,
        editor: Blockly.serialization.workspaces.save(ws),
        ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY },
      } as Projekt;
      projektRef.current = stand;
      gespeichertRef.current = neu.geaendert ? '' : jsonSchreiben(stand);
      setProjekt(stand);
      setDatei(neu.dateiname);
      setGeaendert(neu.geaendert);
      dokumentStatusUebernehmen(neu);
      auswaehlen(null);
      setBeruehrt(new Set());
      setPruefungAngefordert(false);
      setHinweiseOffen(false);
      setExportiert(null);
      setRevision((n) => n + 1);
      setPlatzierung(null);
      platzierungRef.current = null;
      dokumentStatusUebernehmen(antwort(await window.scriptlab.darstellungBereit(stand)));
    } finally {
      laedt.current = false;
    }
  }
  async function projektAktion(
    art: 'neu' | 'oeffnen' | 'speichern' | 'unter' | BeispielKennung,
    neueSprache?: Skriptsprache,
    neueWorkflowArt: WorkflowArt = 'allgemein',
  ) {
    if (art === 'neu' && !neueSprache) {
      setDialog('sprache');
      return;
    }
    await aktion(
      art === 'speichern' || art === 'unter' ? 'Projekt wird gespeichert …' : 'Projekt wird geöffnet …',
      async () => {
        const stand = standLesen();
        const r =
          art === 'neu'
            ? await window.scriptlab.neu(stand, neueSprache!, neueWorkflowArt)
            : art === 'oeffnen'
              ? await window.scriptlab.oeffnen(stand)
              : beispiele.some((b) => b.id === art)
                ? await window.scriptlab.beispielOeffnen(stand, art as BeispielKennung)
                : await window.scriptlab.speichern(stand, art === 'unter');
        const neu = antwort(r);
        if (neu) {
          if (art === 'speichern' || art === 'unter') {
            const kennung = neu.projekt.projektKennung;
            // Blockly kann seine Änderungsereignisse erst nach der schnellen Dateiantwort liefern.
            // Der aktuelle Workspace und der bestätigte Dateistand bestimmen den Speicherstatus.
            const gespeichertStand = neu.projekt;
            projektRef.current = {
              ...standLesen(),
              ...(art === 'unter' ? { name: neu.projekt.name } : {}),
              projektKennung: kennung,
            };
            setProjekt(projektRef.current);
            gespeichertRef.current = jsonSchreiben(gespeichertStand);
            setDatei(neu.dateiname);
            setGeaendert(testInhaltsText(projektRef.current) !== testInhaltsText(gespeichertStand));
            dokumentStatusUebernehmen(neu);
            const kontext = antwort(await window.scriptlab.testLesen());
            setTestOptionen((alt) => ({ ...alt, basisVerzeichnis: kontext.optionen.basisVerzeichnis }));
            melden('Projekt gespeichert.', 'erfolg');
          } else {
            await dokumentLaden(neu);
            editorZeigen();
            if (art === 'neu') {
              const aktuell = antwort(await window.scriptlab.laden()).einstellungen;
              einstellungenRef.current = aktuell;
              setEinstellungen(aktuell);
            }
            melden(
              art === 'neu' ? 'Füge links einen Baustein hinzu.' : 'Workflow geöffnet.',
              art === 'neu' ? 'neutral' : 'erfolg',
            );
          }
        } else {
          await abgebrocheneAktionAbgleichen();
        }
        await bibliothekAktualisieren();
      },
    );
  }
  function blockAnzeigen(id?: string, feldPfad?: string[]) {
    if (id && feldPfad) {
      auswaehlen(id);
      setArbeitsbereich('daten');
      setFeldZiel({ blockId: id, pfad: feldPfad, anfrage: Date.now() });
      return;
    }
    setArbeitsbereich('ablauf');
    const ws = wsRef.current;
    if (!ws || !id) return;
    const b = ws.getBlockById(id);
    if (b) {
      auswaehlen(id);
      b.select();
      requestAnimationFrame(() => ws.centerOnBlock(id));
    }
  }
  async function exportieren() {
    setExportiert(null);
    fehlerSchliessen();
    const p = skriptErzeugen(standLesen());
    if (!p.code || p.meldungen.some((m) => m.stufe === 'fehler')) {
      setPruefungAngefordert(true);
      setHinweiseOffen(true);
      melden('Bitte vervollständige die markierten Bausteine vor dem Export.', 'hinweis');
      blockAnzeigen(p.meldungen.find((m) => m.stufe === 'fehler')?.blockId);
      return;
    }
    await aktion(`${sprache.kurzbezeichnung}-Script wird gespeichert …`, async () => {
      const neu = antwort(await window.scriptlab.exportieren(standLesen()));
      if (neu) {
        setExportiert(neu);
        melden(
          neu.dateiname.endsWith('.zip') ? 'Business-Paket gespeichert.' : 'Script gespeichert.',
          neu.signatur?.status === 'vertrauen-offen' ? 'hinweis' : 'erfolg',
        );
      }
    });
  }
  async function projektExportieren() {
    await aktion('Projektdatei wird exportiert …', async () => {
      const neu = antwort(await window.scriptlab.projektExportieren(standLesen()));
      if (neu) {
        setExportiert(neu);
        melden('Projektdatei exportiert.', 'erfolg');
      }
    });
  }
  function testInhaltsText(p: Projekt): string {
    const { ansicht: _ansicht, ...inhalt } = p;
    return jsonSchreiben(inhalt);
  }
  function vorschauParameterKennung() {
    return jsonSchreiben({
      satz: testOptionen.business?.parametersatz ?? 'test',
      werte: testOptionen.business?.parameter ?? {},
    });
  }
  async function datenvorschauLaden(blockId: string) {
    if (testAnfrage.current || testSperre.current || busy.current) return;
    const stand = projektPruefen(standLesen());
    testAnfrage.current = true;
    testInhalt.current = testInhaltsText(stand);
    vorschauAnfrage.current = {
      inhalt: datenvorschauKontext(stand, blockId),
      parameter: vorschauParameterKennung(),
    };
    fehlerSchliessen();
    try {
      testUebernehmen({
        ...testBereit(),
        phase: 'vorbereitung',
        projektKennung: stand.projektKennung ?? null,
        projektName: stand.name,
        meldung: 'Die Datenvorschau des ausgewählten Schritts wird geladen.',
      });
      testUebernehmen(antwort(await window.scriptlab.datenvorschauStarten(stand, blockId, testOptionen)));
    } catch (e) {
      testUebernehmen({
        ...testBereit(),
        phase: 'fehlgeschlagen',
        projektKennung: stand.projektKennung ?? null,
        meldung: e instanceof Error ? e.message : 'Die Datenvorschau konnte nicht geladen werden.',
      });
      melden(e instanceof Error ? e.message : 'Die Datenvorschau konnte nicht geladen werden.', 'fehler');
    } finally {
      testAnfrage.current = false;
    }
  }
  function parameterWertOeffnen(name: string) {
    setArbeitsbereich('daten');
    setParameterZiel({ name, anfrage: Date.now() });
  }
  function schrittVorschauOeffnen(blockId: string) {
    vorschauAusloeser.current = document.activeElement as HTMLElement;
    auswaehlen(blockId);
    setVorschauZiel((alt) => ({ blockId, anfrage: (alt?.anfrage ?? 0) + 1 }));
    setArbeitsbereich('daten');
  }
  function dateiAufCanvasAblegen(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dateiablage-aktiv');
    if (testAnfrage.current || testSperre.current || busy.current) {
      melden('Beende den laufenden Vorgang vor Änderungen am Dateipfad.', 'hinweis');
      return;
    }
    try {
      const pfad = dateipfadAusAblage(e.dataTransfer);
      const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
      const block = id ? wsRef.current?.getBlockById(id) : null;
      if (!block) throw new Error('Lege die Datei direkt auf einen Quellbaustein oder ein Dateipfadfeld.');
      dateipfadAufBlock(block, pfad);
      auswaehlen(block.id);
      fehlerSchliessen();
      melden('Dateipfad übernommen. Der Workflow wurde nicht gestartet.', 'erfolg');
    } catch (fehler) {
      melden(
        fehler instanceof Error ? fehler.message : 'Der Dateipfad konnte nicht übernommen werden.',
        'fehler',
      );
    }
  }
  function vorschauBausteinAnzeigen(blockId: string) {
    const ursprung = blockId === vorschauZiel?.blockId;
    if (!ursprung) {
      blockAnzeigen(blockId);
    } else {
      // Zurück zur Bearbeitung, ohne den bisherigen Canvas auf den Block zu zentrieren.
      auswaehlen(blockId);
      setArbeitsbereich('ablauf');
    }
    requestAnimationFrame(() => {
      const ausloeser = ursprung ? vorschauAusloeser.current : null;
      const ziel =
        ausloeser?.isConnected && ausloeser.getClientRects().length
          ? ausloeser
          : document.querySelector<HTMLElement>('.ansichtknopfgruppe button');
      ziel?.focus({ preventScroll: true });
    });
  }
  async function quelleWaehlen(blockId: string, feldPfad: string[]) {
    return antwort(await window.scriptlab.quelleWaehlen(blockId, feldPfad));
  }
  function testUebernehmen(neu: TestZustand) {
    const fokussiert = document.activeElement;
    laufAktionsFokus.current =
      fokussiert instanceof HTMLElement && laufAktionen.current?.contains(fokussiert) ? fokussiert : null;
    const sperren = testAktiv(neu.phase);
    testSperre.current = sperren;
    const ws = wsRef.current;
    if (ws && ws.isReadOnly() !== sperren) {
      ws.setIsReadOnly(sperren);
      for (const b of ws.getAllBlocks(false))
        for (const eingang of b.inputList) for (const feld of eingang.fieldRow) feld.updateEditable();
    }
    setTest(neu);
  }
  useLayoutEffect(() => {
    const vorher = laufAktionsFokus.current;
    laufAktionsFokus.current = null;
    if (!vorher || (vorher.isConnected && !vorher.matches(':disabled'))) return;
    // Der Startknopf wird beim Start durch den tatsächlichen Laufstatus ersetzt.
    const ziel = laufAktionen.current?.querySelector<HTMLElement>('[data-laufaktion]:not(:disabled)');
    (ziel ?? laufAktionen.current)?.focus({ preventScroll: true });
  }, [test.phase]);
  async function testStarten(direkt = false) {
    if (testAnfrage.current || testSperre.current || busy.current) return;
    setVorschauOffen(false);
    setExportiert(null);
    fehlerSchliessen();
    let stand: Projekt;
    let optionen: TestOptionen;
    try {
      stand = projektPruefen(standLesen());
      const pruefung = skriptErzeugen(stand);
      if (!pruefung.code) {
        setPruefungAngefordert(true);
        setHinweiseOffen(true);
        melden(bausteinPflichthinweis, 'hinweis');
        const erstesProblem = pruefung.meldungen.find((m) => m.stufe === 'fehler');
        blockAnzeigen(erstesProblem?.blockId, erstesProblem?.feldPfad);
        return;
      }
      optionen = laufOptionenVorbereiten(stand, testOptionen, direkt);
      laufParameterPruefen(stand, optionen);
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der Workflow konnte nicht geprüft werden.', 'fehler');
      if (e instanceof LaufParameterFehler) {
        setArbeitsbereich('daten');
        setParameterZiel((alt) => ({ name: e.parameterName ?? '', anfrage: (alt?.anfrage ?? 0) + 1 }));
      }
      return;
    }
    if (!direkt) setLaufVorbereitungAnfrage((n) => n + 1);
    testAnfrage.current = true;
    const vorherigerInhalt = testInhalt.current;
    testInhalt.current = testInhaltsText(stand);
    testUebernehmen({
      ...testBereit(),
      phase: 'vorbereitung',
      projektName: stand.name,
      skriptsprache: stand.skriptsprache,
      projektKennung: stand.projektKennung ?? null,
      optionen,
      meldung: 'Der aktuelle Editorstand wird geprüft.',
    });
    setPlatzierung(null);
    platzierungRef.current = null;
    try {
      testUebernehmen(antwort(await window.scriptlab.testStarten(stand, optionen)));
    } catch (e) {
      testInhalt.current = vorherigerInhalt;
      const meldung = e instanceof Error ? e.message : 'Der Workflow konnte nicht gestartet werden.';
      melden(meldung, 'fehler');
      testUebernehmen({
        ...testBereit(),
        phase: 'fehlgeschlagen',
        projektName: stand.name,
        projektKennung: stand.projektKennung ?? null,
        skriptsprache: stand.skriptsprache,
        optionen,
        meldung,
      });
    } finally {
      testAnfrage.current = false;
      if (stand.skriptsprache === 'python') {
        void window.scriptlab.pythonStatus().then((r) => {
          if (r.ok) setPythonStatus(r.wert);
        });
      }
    }
  }
  async function testStoppen() {
    if (!test.laufId) return;
    testUebernehmen({ ...test, phase: 'stoppt', meldung: 'Das Ende des Testprozesses wird abgewartet.' });
    try {
      testUebernehmen(antwort(await window.scriptlab.testStoppen(test.laufId)));
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der Test konnte nicht gestoppt werden.', 'fehler');
    }
  }
  async function testOrdnerWaehlen() {
    try {
      antwort(await window.scriptlab.arbeitsordnerAnzeigen());
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der Arbeitsordner konnte nicht angezeigt werden.', 'fehler');
    }
  }
  useEffect(() => {
    if (!editorBegonnen) return;
    let aktiv = true;
    const lesen = async () => {
      const r = await window.scriptlab.testLesen();
      if (aktiv && r.ok && !testAnfrage.current) testUebernehmen(r.wert.zustand);
    };
    void lesen();
    const timer = setInterval(() => void lesen(), 250);
    return () => {
      aktiv = false;
      clearInterval(timer);
    };
  }, [editorBegonnen]);
  useEffect(() => {
    setVorschauen({});
    setVorschauZiel(null);
    vorschauAusloeser.current = null;
    vorschauAnfrage.current = null;
    vorschauGemerkt.current = null;
  }, [projekt.projektKennung]);
  useEffect(() => {
    const id = test.optionen.business?.vorschauBlockId;
    if (
      !id ||
      !test.business?.vorschau ||
      testAktiv(test.phase) ||
      test.projektKennung !== projekt.projektKennung ||
      !test.laufId ||
      vorschauGemerkt.current === test.laufId ||
      !vorschauAnfrage.current
    )
      return;
    vorschauGemerkt.current = test.laufId;
    const kontext = vorschauAnfrage.current;
    setVorschauen((alt) =>
      Object.fromEntries(
        [...Object.entries(alt).filter(([k]) => k !== id), [id, { zustand: test, ...kontext }]].slice(-12),
      ),
    );
  }, [test, projekt.projektKennung]);
  const vorschauParameter = vorschauParameterKennung();
  const aktuelleVorschauen = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(vorschauen)
          .filter(([, v]) => v.zustand.projektKennung === projekt.projektKennung)
          .map(([id, v]) => [
            id,
            {
              zustand: v.zustand,
              veraltet:
                v.inhalt === null ||
                v.inhalt !== datenvorschauKontext(projekt, id) ||
                v.parameter !== vorschauParameter,
            },
          ]),
      ),
    [vorschauen, projekt, vorschauParameter],
  );
  const spaltenNachQuelle = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(aktuelleVorschauen)
          .filter(([, v]) => !v.veraltet)
          .map(([id, v]) => [
            id,
            Array.isArray(v.zustand.business?.vorschau?.spalten)
              ? (v.zustand.business!.vorschau!.spalten as { name: string }[]).map((s) => s.name)
              : [],
          ]),
      ),
    [aktuelleVorschauen],
  );
  const parameterKontext = {
    parametersatz: testOptionen.business?.parametersatz ?? ('test' as const),
    laufwerte: testOptionen.business?.parameter ?? {},
    werte: {
      ...projekt.business.parametersaetze[testOptionen.business?.parametersatz ?? 'test'],
      ...testOptionen.business?.parameter,
    },
    werteOeffnen: parameterWertOeffnen,
  };
  async function einstellungenSetzen(neu: Einstellungen) {
    einstellungenRef.current = neu;
    setEinstellungen(neu);
    try {
      const r = antwort(await window.scriptlab.einstellungenSpeichern(neu));
      if (einstellungenRef.current === neu) {
        setEinstellungen(r);
        einstellungenRef.current = r;
      }
    } catch (e) {
      melden(
        e instanceof Error ? e.message : 'Die Einstellungen konnten nicht gespeichert werden.',
        'fehler',
      );
    }
  }
  async function pythonAktion(art: 'pruefen' | 'waehlen' | 'hilfe') {
    await aktion(
      art === 'hilfe' ? 'Python-Hilfe wird geöffnet …' : 'Python-Installation wird geprüft …',
      async () => {
        if (art === 'hilfe') {
          antwort(await window.scriptlab.pythonHilfeOeffnen());
          return;
        }
        const status = antwort(
          await (art === 'waehlen' ? window.scriptlab.pythonWaehlen() : window.scriptlab.pythonPruefen()),
        );
        if (status) setPythonStatus(status);
        const aktuell = antwort(await window.scriptlab.laden()).einstellungen;
        einstellungenRef.current = aktuell;
        setEinstellungen(aktuell);
      },
    );
  }
  useEffect(() => {
    if (dialog !== 'einstellungen') return;
    let aktiv = true;
    void window.scriptlab.pythonStatus().then((r) => {
      if (aktiv && r.ok) setPythonStatus(r.wert);
    });
    return () => {
      aktiv = false;
    };
  }, [dialog]);
  function platzierungStarten(art: 'einfuegen' | 'verschieben', typOderId: string) {
    if (testSperre.current) return;
    const ws = wsRef.current;
    if (!ws) return;
    const typ = art === 'verschieben' ? ws.getBlockById(typOderId)?.type : typOderId;
    const neu: PlatzierungsAuftrag = {
      art,
      typOderId,
      name: bausteinDefinitionen.find((b) => b.typ === typ)?.name ?? 'Baustein',
    };
    platzierungRef.current = neu;
    setPlatzierung(neu);
    setZiele(einfuegestellenLesen(ws, typOderId));
    if (einstellungenRef.current.paletteEingeklappt)
      void einstellungenSetzen({ ...einstellungenRef.current, paletteEingeklappt: false });
    melden('Wähle eine Einfügestelle. Escape bricht die Auswahl ab.');
  }
  function zielWaehlen(ziel: Einfuegestelle) {
    if (testSperre.current) return;
    const ws = wsRef.current,
      auftrag = platzierungRef.current;
    if (!ws || !auftrag) return;
    try {
      const b =
        auftrag.art === 'einfuegen'
          ? bausteinEinfuegen(ws, auftrag.typOderId, ziel)
          : bausteinVerschieben(ws, auftrag.typOderId, ziel);
      platzierungRef.current = null;
      setPlatzierung(null);
      setZiele([]);
      auswaehlen(b.id);
      if (auftrag.art === 'einfuegen') setEigenschaftenOffen(true);
      aendern(standLesen());
      melden(auftrag.art === 'einfuegen' ? 'Baustein eingefügt.' : 'Baustein verschoben.', 'erfolg');
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Diese Verbindung ist nicht möglich.', 'fehler');
    }
  }
  function blockAktion(art: 'kopieren' | 'einfuegen' | 'duplizieren' | 'loeschen') {
    if (testSperre.current && art !== 'kopieren') return;
    const ws = wsRef.current;
    if (!ws) return;
    const b = auswahlRef.current ? ws.getBlockById(auswahlRef.current) : null;
    if (art === 'einfuegen') {
      const daten = Blockly.clipboard.getLastCopiedData();
      if (daten) Blockly.clipboard.paste(daten, ws);
      else melden('Kopiere zuerst einen Baustein.');
      return;
    }
    if (!b) {
      melden('Wähle zuerst einen Baustein im Arbeitsbereich.');
      return;
    }
    if (art === 'loeschen') {
      b.dispose(true);
      auswaehlen(null);
      melden('Baustein gelöscht. Rückgängig stellt ihn wieder her.', 'erfolg');
      return;
    }
    const daten = Blockly.clipboard.copy(b);
    if (art === 'duplizieren' && daten) Blockly.clipboard.paste(daten, ws);
    melden(
      art === 'kopieren' ? 'Baustein kopiert.' : 'Baustein dupliziert. Verbinde die Kopie mit dem Ablauf.',
      art === 'kopieren' ? 'erfolg' : 'neutral',
    );
  }
  async function updateAktion(art: 'status' | 'pruefen' | 'laden' | 'installieren') {
    await aktion(art === 'laden' ? 'Update wird geladen …' : 'Update wird geprüft …', async () => {
      setUpdate(antwort(await window.scriptlab.updateAktion(art)) as UpdateZustand);
    });
  }

  useEffect(() => {
    const ws = Blockly.inject(element.current!, {
      theme: scriptlabThema,
      renderer: 'zelos',
      media: 'scriptlab://app/media/',
      grid: { spacing: masse.raster, length: 1, colour: farben.trennung, snap: true },
      zoom: { controls: false, wheel: false, startScale: 1, minScale: 0.25, maxScale: 2, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: false,
      sounds: false,
      maxBlocks: maximaleBausteinzahl,
      plugins: { blockDragger: ScriptLabBlockDragger },
    });
    wsRef.current = ws;
    setWorkspace(ws);
    const parameterAbmelden = parameterEreignisAnmelden(ws.id, (business) =>
      aendern({ ...standLesen(), business }),
    );
    const aenderung = (event: Blockly.Events.Abstract) => {
      if (laedt.current || !arbeitsbereichGeladen.current) return;
      if (event.type === Blockly.Events.SELECTED) {
        const id = (event as Blockly.Events.Selected).newElementId;
        if (id && ws.getBlockById(id)) auswaehlen(id);
        return;
      }
      if (event.isUiEvent && event.type !== Blockly.Events.VIEWPORT_CHANGE) return;
      if (event.type === Blockly.Events.VIEWPORT_CHANGE && arbeitsbereichRef.current !== 'ablauf') return;
      if (event.type === Blockly.Events.VIEWPORT_CHANGE)
        aendern({ ...projektRef.current, ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY } });
      else {
        aendern(standLesen());
        if (auswahlRef.current && !ws.getBlockById(auswahlRef.current)) auswaehlen(null);
      }
    };
    ws.addChangeListener(aenderung);
    const groesse = new ResizeObserver(() => {
      if (!editorSichtbar.current || arbeitsbereichRef.current !== 'ablauf') return;
      const x = ws.scrollX,
        y = ws.scrollY;
      Blockly.svgResize(ws);
      // Ein Layoutabgleich ist keine Navigation und darf ein offenes Eingabefeld nicht schließen.
      ws.scroll(x, y, false);
    });
    groesse.observe(element.current!);
    const navigation = editorNavigationEinrichten(ws, {
      paletteFokussieren: () => document.querySelector<HTMLElement>('[data-testid="palette"] input')?.focus(),
    });
    const abmelden = window.scriptlab.beiStandAnfrage(standLesen);
    void aktion('Projekt wird geladen …', async () => {
      const start = antwort(await window.scriptlab.laden());
      setEinstellungen(start.einstellungen);
      einstellungenRef.current = start.einstellungen;
      setVersion(start.version);
      await dokumentLaden(start.dokument, true);
    });
    return () => {
      abmelden();
      parameterAbmelden();
      navigation();
      groesse.disconnect();
      ablaufverbindungenVorLadenTrennen(ws);
      ws.dispose();
    };
  }, []);
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: light)');
    const anwenden = () => {
      const schema = farbschemaAufloesen(einstellungen.darstellung, system.matches);
      designTokensAnwenden(undefined, schema);
      wsRef.current?.setTheme(scriptlabThemaFuer(schema));
    };
    anwenden();
    system.addEventListener('change', anwenden);
    return () => system.removeEventListener('change', anwenden);
  }, [einstellungen.darstellung, workspace]);
  useLayoutEffect(() => {
    if (ansicht !== 'editor' || arbeitsbereich !== 'ablauf') return;
    const frame = requestAnimationFrame(() => {
      const ws = wsRef.current;
      if (!ws) return;
      const { x, y } = projektRef.current.ansicht;
      Blockly.svgResize(ws);
      ws.scroll(x, y);
    });
    return () => cancelAnimationFrame(frame);
  }, [arbeitsbereich, ansicht]);

  useEffect(() => {
    for (const b of wsRef.current?.getAllBlocks(false) ?? []) {
      const texte = sichtbareHinweise
        .filter((m) => m.blockId === b.id && m.stufe === 'fehler')
        .map((m) => m.text);
      if (
        test.phase === 'fehlgeschlagen' &&
        test.fehlerBlockId === b.id &&
        testInhalt.current === testInhaltsText(projektRef.current)
      )
        texte.push(test.meldung);
      b.setWarningText(texte.length ? texte.join('\n') : null, 'validierung');
      b.getSvgRoot()?.classList.toggle('scriptlabFehler', texte.length > 0);
      blockAuswahlKennzeichnen(b, b.id === auswahlRef.current);
    }
    // Ein Pfadfeld kann die Blockbreite ändern; die eigene Auswahlkontur braucht die fertige Geometrie.
    let aktuell = true;
    void Blockly.renderManagement.finishQueuedRenders().then(() => {
      if (!aktuell || !auswahlRef.current) return;
      const block = wsRef.current?.getBlockById(auswahlRef.current);
      if (block && !block.disposed) blockAuswahlKennzeichnen(block, true);
    });
    return () => {
      aktuell = false;
    };
  }, [ergebnis, pruefungAngefordert, beruehrt, revision, test.phase, test.fehlerBlockId, test.meldung]);
  useEffect(() => {
    const resize = () => setBreite(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (dialog !== 'einstellungen') return;
    const lesen = () =>
      void window.scriptlab.updateAktion('status').then((r) => {
        if (r.ok) setUpdate(r.wert as UpdateZustand);
      });
    lesen();
    const timer = setInterval(lesen, 1000);
    return () => clearInterval(timer);
  }, [dialog]);
  useEffect(() => {
    // Dateien und Links außerhalb eines bewusst getroffenen Pfadfelds dürfen die App nicht ersetzen.
    const extern = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).some((typ) =>
        ['Files', 'text/uri-list', 'text/html'].includes(typ),
      );
    const darueber = (e: DragEvent) => {
      if (extern(e)) e.preventDefault();
    };
    const ablegen = (e: DragEvent) => {
      if (e.defaultPrevented || !extern(e)) return;
      e.preventDefault();
      melden('Lege die Datei auf einen Quellbaustein oder ein Dateipfadfeld.', 'hinweis');
    };
    window.addEventListener('dragover', darueber);
    window.addEventListener('drop', ablegen);
    return () => {
      window.removeEventListener('dragover', darueber);
      window.removeEventListener('drop', ablegen);
    };
  }, []);
  useEffect(() => {
    const tasten = (event: KeyboardEvent) => {
      if (busy.current) {
        if (
          (event.ctrlKey &&
            ['n', 'o', 's', 'z', 'y', '+', '=', '-', '0'].includes(event.key.toLowerCase())) ||
          ['Delete', 'F4'].includes(event.key)
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (dialog || (event.target instanceof Element && event.target.closest('dialog[open]'))) return;
      if (
        testSperre.current &&
        ((event.ctrlKey && ['z', 'y', 's', 'v', 'x'].includes(event.key.toLowerCase())) ||
          event.key === 'Delete')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const ziel = event.target as HTMLElement;
      if (event.ctrlKey && ['n', 'o', 's'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        void projektAktion(
          event.key.toLowerCase() === 'n'
            ? 'neu'
            : event.key.toLowerCase() === 'o'
              ? 'oeffnen'
              : event.shiftKey
                ? 'unter'
                : 'speichern',
        );
        return;
      }
      if (
        !editorSichtbar.current ||
        arbeitsbereichRef.current !== 'ablauf' ||
        ziel.matches?.('input,textarea,select') ||
        ziel.isContentEditable
      )
        return;
      if (event.ctrlKey && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (wsRef.current)
          void verlaufAendern(wsRef.current, event.key.toLowerCase() === 'y' || event.shiftKey);
        return;
      }
      if (event.key === 'Escape' && platzierungRef.current) {
        event.preventDefault();
        setPlatzierung(null);
        platzierungRef.current = null;
        melden('Einfügen abgebrochen.');
        return;
      }
      if (event.key === 'F4') {
        event.preventDefault();
        eigenschaftenOeffnen();
      }
      if (event.key === 'Delete' && auswahlRef.current) {
        event.preventDefault();
        event.stopPropagation();
        blockAktion('loeschen');
      }
      if (event.ctrlKey && ['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0') wsRef.current?.setScale(1);
        else wsRef.current?.zoomCenter(event.key === '-' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', tasten, true);
    return () => window.removeEventListener('keydown', tasten, true);
  }, [dialog]);

  function paletteGroesseStarten(event: React.PointerEvent) {
    const start = event.clientX,
      anfang = einstellungenRef.current.palettenBreite;
    const bewegen = (e: PointerEvent) =>
      setEinstellungen({
        ...einstellungenRef.current,
        palettenBreite: Math.max(240, Math.min(400, Math.round(anfang + e.clientX - start))),
      });
    const ende = (e: PointerEvent) => {
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', ende);
      void einstellungenSetzen({
        ...einstellungenRef.current,
        palettenBreite: Math.max(240, Math.min(400, Math.round(anfang + e.clientX - start))),
      });
    };
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', ende, { once: true });
  }
  function codeGroesseStarten(event: React.PointerEvent) {
    const start = event.clientY,
      anfang = codeHoehe;
    const bewegen = (e: PointerEvent) =>
      setCodeHoehe(Math.max(140, Math.min(window.innerHeight * 0.65, anfang + start - e.clientY)));
    const ende = () => {
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', ende);
    };
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', ende, { once: true });
  }
  const verschieben = (dx: number, dy: number) => {
    const ws = wsRef.current;
    if (ws) ws.scroll(ws.scrollX + dx, ws.scrollY + dy);
  };
  const style = {
    '--text-skala': einstellungen.textSkalierung,
    '--breite-palette': einstellungen.paletteEingeklappt ? '48px' : `${einstellungen.palettenBreite}px`,
  } as CSSProperties;
  return (
    <div className="anwendung" style={style} data-grosser-text={einstellungen.textSkalierung >= 1.5}>
      <div className="start-ansicht" hidden={ansicht !== 'start'}>
        <Startbereich
          daten={bibliothek}
          laden={bibliothekLaedt}
          fehler={bibliothekFehler ?? dauerfehler}
          fehlerErneutLaden={bibliothekFehler ? () => void bibliothekAktualisieren() : undefined}
          fehlerSchliessen={!bibliothekFehler && dauerfehler ? fehlerSchliessen : undefined}
          verarbeitung={verarbeitung}
          meldung={statusArt === 'erfolg' || statusArt === 'hinweis' ? status : null}
          aktiveInfo={
            editorBegonnen
              ? {
                  projektKennung: projekt.projektKennung!,
                  name: projekt.name,
                  dateiname: datei,
                  geaendert,
                  skriptsprache: projekt.skriptsprache,
                  workflowArt: projekt.workflowArt,
                }
              : null
          }
          verfuegbarkeiten={verfuegbarkeiten}
          ziel={startZiel}
          zielAnfrage={startAnfrage}
          neuerWorkflow={() => void projektAktion('neu')}
          workflowOeffnen={() => void projektAktion('oeffnen')}
          weiterbearbeiten={() => {
            setEditorBegonnen(true);
            setAnsicht('editor');
          }}
          einstellungenOeffnen={() => setDialog('einstellungen')}
          ueberOeffnen={() => setDialog('ueber')}
          aktualisieren={() => {
            metadatenCache.current.clear();
            void bibliothekAktualisieren();
          }}
          projektOeffnen={(id) => void bibliotheksProjektOeffnen('projekt', id)}
          projektNeuZuordnen={(id) => void bibliotheksProjektOeffnen('zuordnen', id)}
          projektEntfernen={(id) => void eintragAktion('entfernen', id)}
          projektOrdnerAnzeigen={(id) => void eintragAktion('ordner', id)}
          entwurfFortsetzen={(id) => void bibliotheksProjektOeffnen('entwurf', id)}
          entwurfSpeichernUnter={(id) => void bibliotheksProjektOeffnen('entwurf-speichern', id)}
          entwurfLoeschen={(id) => void eintragAktion('loeschen', id)}
          beispielOeffnen={(id) => void projektAktion(id)}
        />
      </div>
      {ansicht === 'editor' && verarbeitung && (
        <p className="verarbeitung-editor" role="status">
          {verarbeitung}
        </p>
      )}
      <div className="editor-ansicht" hidden={ansicht !== 'editor'} inert={!!verarbeitung}>
        <EditorNavigation
          navigieren={(ziel) => void startseiteZeigen(ziel)}
          einstellungen={() => setDialog('einstellungen')}
          ueber={() => setDialog('ueber')}
        />
        <div className="workflow-arbeitsplatz">
          <header className="workflow-kopf">
            <div className="workflow-identitaet">
              <h1 title={projekt.name}>{projekt.name}</h1>
              <p aria-label="Projektstatus" role="status">
                {geaendert
                  ? 'Ungespeicherte Änderungen'
                  : datei
                    ? 'Gespeichert'
                    : 'Noch nicht als Datei gespeichert'}
              </p>
            </div>
            <span
              className="skriptsprache-kennzeichen"
              data-testid="editor-sprache"
              aria-label="Skriptsprache des Workflows"
            >
              {sprache.bezeichnung}
            </span>
            <nav ref={laufAktionen} tabIndex={-1} className="workflow-aktionen" aria-label="Projektaktionen">
              <Knopf
                symbol="speichern"
                aria-label="Speichern"
                title="Speichern (Strg+S)"
                variante="leise"
                disabled={!!verarbeitung || testAktiv(test.phase)}
                grundId={testAktiv(test.phase) ? 'test-sperrhinweis' : 'status-aktion'}
                onClick={() => void projektAktion('speichern')}
              >
                Speichern
              </Knopf>
              {!testAktiv(test.phase) && (
                <Knopf
                  variante="primaer"
                  symbol="testen"
                  data-laufaktion
                  disabled={!!verarbeitung}
                  grundId="status-aktion"
                  onClick={() => void testStarten(true)}
                >
                  Workflow ausführen
                </Knopf>
              )}
              {testAktiv(test.phase) && (
                <>
                  <span id="test-sperrhinweis" className="test-kurzstatus" role="status">
                    {test.phase === 'vorbereitung'
                      ? 'Wird vorbereitet'
                      : test.phase === 'stoppt'
                        ? 'Wird gestoppt'
                        : 'Lauf läuft'}
                    <span className="sl-nur-vorlesen">
                      . Änderungen und ein weiterer Start sind bis zum Laufende gesperrt.
                    </span>
                  </span>
                  {arbeitsbereich !== 'laeufe' && (
                    <Knopf
                      variante="gefahr"
                      symbol="stoppen"
                      data-laufaktion
                      disabled={test.phase === 'stoppt'}
                      grundId="test-sperrhinweis"
                      onClick={() => void testStoppen()}
                    >
                      Stoppen
                    </Knopf>
                  )}
                </>
              )}
              <Knopf
                symbol="exportieren"
                aria-label="Exportieren"
                title="Exportieren"
                variante="leise"
                disabled={!!verarbeitung || testAktiv(test.phase)}
                grundId={testAktiv(test.phase) ? 'test-sperrhinweis' : 'status-aktion'}
                onClick={() => setDialog('export')}
              >
                Exportieren
              </Knopf>
            </nav>
          </header>
          <div className="workflow-navigation">
            <Arbeitsbereiche wert={arbeitsbereich} setzen={setArbeitsbereich} />
            <nav className="werkzeugleiste" aria-label="Bearbeitungswerkzeuge">
              <div className="knopfgruppe">
                <Menue
                  beschriftung="Workflow"
                  symbol="unten"
                  eintraege={[
                    {
                      text: 'Neuer Workflow',
                      symbol: 'neu',
                      aktion: () => void projektAktion('neu'),
                    },
                    {
                      text: 'Workflow öffnen',
                      symbol: 'oeffnen',
                      aktion: () => void projektAktion('oeffnen'),
                    },
                    {
                      text: 'Kopie anlegen',
                      symbol: 'speichern',
                      gesperrt: testAktiv(test.phase),
                      grund: 'Stoppe den Lauf vor dem Speichern.',
                      aktion: () => void projektAktion('unter'),
                    },
                    {
                      text: 'Als Entwurf sichern',
                      symbol: 'entwurf',
                      aktion: () => void entwurfJetztSichern(),
                    },
                    {
                      text: 'Projektangaben',
                      symbol: 'info',
                      gesperrt: testAktiv(test.phase),
                      grund: 'Stoppe den Lauf vor Änderungen.',
                      aktion: () => setDialog('projekt'),
                    },
                    {
                      text: 'Workflowparameter',
                      gesperrt: testAktiv(test.phase),
                      grund: 'Stoppe den Lauf vor Änderungen.',
                      aktion: () => {
                        setArbeitsbereich('daten');
                        setDialog('parameter');
                      },
                    },
                  ]}
                />
              </div>
              {arbeitsbereich === 'ablauf' && (
                <>
                  <span className="werkzeug-trenner" />
                  <div className="knopfgruppe">
                    <Knopf
                      variante="leise"
                      symbol="rueckgaengig"
                      aria-label="Rückgängig"
                      disabled={testAktiv(test.phase)}
                      grundId="test-sperrhinweis"
                      title="Rückgängig (Strg+Z)"
                      onClick={() => wsRef.current && void verlaufAendern(wsRef.current)}
                    />
                    <Knopf
                      variante="leise"
                      symbol="wiederholen"
                      aria-label="Wiederholen"
                      disabled={testAktiv(test.phase)}
                      grundId="test-sperrhinweis"
                      title="Wiederholen (Strg+Y)"
                      onClick={() => wsRef.current && void verlaufAendern(wsRef.current, true)}
                    />
                  </div>
                  <div className="knopfgruppe ansichtknopfgruppe">
                    <Knopf
                      variante="leise"
                      symbol="eigenschaften"
                      aria-label="Eigenschaften"
                      aria-pressed={eigenschaftenOffen}
                      onClick={() =>
                        eigenschaftenOffen ? eigenschaftenSchliessen() : eigenschaftenOeffnen()
                      }
                    >
                      Eigenschaften
                    </Knopf>
                  </div>
                </>
              )}
              <Menue
                beschriftung="Ansicht"
                symbol="unten"
                eintraege={[
                  {
                    text: vorschauOffen ? 'Codevorschau schließen' : 'Codevorschau öffnen',
                    symbol: 'code',
                    aktion: () => {
                      setArbeitsbereich('ablauf');
                      setVorschauOffen(!vorschauOffen);
                    },
                  },

                  {
                    text: 'Ansicht zurücksetzen',
                    aktion: () => {
                      setEigenschaftenOffen(false);
                      setVorschauOffen(false);
                      setHinweiseOffen(false);
                      void einstellungenSetzen({
                        ...einstellungenRef.current,
                        palettenBreite: 272,
                        paletteEingeklappt: false,
                        eigenschaftenAngeheftet: false,
                      });
                    },
                  },
                ]}
              />
            </nav>
          </div>
          <div
            className="workflow-panel workflow-panel--ablauf"
            id="workflow-ablauf"
            role="tabpanel"
            aria-labelledby="bereich-ablauf"
            hidden={arbeitsbereich !== 'ablauf'}
          >
            <LaufKurzansicht
              zustand={
                test.projektKennung && test.projektKennung !== projekt.projektKennung ? testBereit() : test
              }
              veraltet={!!test.standHash && testInhalt.current !== testInhaltsText(projekt)}
              details={() => {
                setLaufDetailsAnfrage((n) => n + 1);
                setArbeitsbereich('laeufe');
              }}
              blockAnzeigen={(id) => blockAnzeigen(id)}
            />
            <main className={`arbeitszeile ${angeheftet ? 'mit-eigenschaften' : ''}`}>
              <div className="test-palette" inert={testAktiv(test.phase)}>
                <Palette
                  sprache={projekt.skriptsprache}
                  workflowArt={projekt.workflowArt}
                  ws={workspace}
                  eingeklappt={einstellungen.paletteEingeklappt}
                  umschalten={() =>
                    void einstellungenSetzen({
                      ...einstellungenRef.current,
                      paletteEingeklappt: !einstellungenRef.current.paletteEingeklappt,
                    })
                  }
                  platzierung={platzierung}
                  ziele={ziele}
                  einfuegen={(typ) => platzierungStarten('einfuegen', typ)}
                  zielWaehlen={zielWaehlen}
                  abbrechen={() => {
                    setPlatzierung(null);
                    platzierungRef.current = null;
                    melden('Einfügen abgebrochen.');
                  }}
                  blockAuswaehlen={auswaehlen}
                  meldung={melden}
                />
              </div>
              <div
                className="paletten-trenner"
                role="separator"
                tabIndex={0}
                aria-label="Breite der Bausteinpalette"
                aria-orientation="vertical"
                aria-valuemin={240}
                aria-valuemax={400}
                aria-valuenow={einstellungen.palettenBreite}
                onPointerDown={paletteGroesseStarten}
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) {
                    e.preventDefault();
                    void einstellungenSetzen({
                      ...einstellungenRef.current,
                      palettenBreite:
                        e.key === 'Home'
                          ? 272
                          : Math.max(
                              240,
                              Math.min(
                                400,
                                einstellungenRef.current.palettenBreite + (e.key === 'ArrowRight' ? 16 : -16),
                              ),
                            ),
                    });
                  }
                }}
              />
              <section className="editor-mitte" aria-label="Workflow bearbeiten">
                <div
                  className="canvas-bereich"
                  onDragOver={(e) => {
                    e.preventDefault();
                    const datei = Array.from(e.dataTransfer.types).includes('Files');
                    const erlaubt = datei && !testSperre.current && !testAnfrage.current && !busy.current;
                    e.dataTransfer.dropEffect = erlaubt ? 'copy' : 'none';
                    e.currentTarget.classList.toggle('dateiablage-aktiv', erlaubt);
                  }}
                  onDragLeave={(e) => {
                    if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget))
                      e.currentTarget.classList.remove('dateiablage-aktiv');
                  }}
                  onDrop={dateiAufCanvasAblegen}
                >
                  <div
                    ref={element}
                    data-testid="arbeitsbereich"
                    className={`blockly-editor ${platzierung ? 'wartet-auf-ziel' : ''}`}
                    tabIndex={-1}
                    aria-label="Arbeitsbereich"
                    onPointerUp={(e) => {
                      if (testSperre.current) {
                        const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
                        if (id) {
                          auswaehlen(id);
                          wsRef.current?.getBlockById(id)?.select();
                        }
                        return;
                      }
                      if (!platzierungRef.current) return;
                      const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
                      if (id) {
                        const passend = einfuegestellenLesen(
                          wsRef.current!,
                          platzierungRef.current.typOderId,
                        ).filter((z) => z.blockId === id);
                        if (passend.length === 1) zielWaehlen(passend[0]);
                        else if (passend.length) {
                          setZiele(passend);
                          melden('Wähle links den gewünschten Anschluss dieses Bausteins.');
                        }
                      }
                    }}
                  />
                  {nurStart && !platzierung && (
                    <div className="naechster-schritt">
                      <p>Füge links einen Baustein hinzu.</p>
                      <Knopf variante="leise" onClick={() => void projektAktion('begruessung')}>
                        Beispiel öffnen
                      </Knopf>
                    </div>
                  )}
                  <div className="canvas-werkzeuge">
                    <div className="ansichtsteuerung">
                      <Menue
                        beschriftung="Arbeitsbereich verschieben"
                        nurSymbol
                        symbol="verschieben"
                        eintraege={(['links', 'rechts', 'oben', 'unten'] as const).map((name, index) => ({
                          text: `Nach ${name}`,
                          symbol: name,
                          aktion: () =>
                            verschieben(
                              index === 0 ? 100 : index === 1 ? -100 : 0,
                              index === 2 ? 100 : index === 3 ? -100 : 0,
                            ),
                        }))}
                      />
                    </div>
                    <div className="zoom" aria-label="Zoom im Arbeitsbereich">
                      <Knopf
                        variante="leise"
                        symbol="minus"
                        aria-label="Verkleinern"
                        title="Verkleinern"
                        onClick={() => wsRef.current?.zoomCenter(-1)}
                      />
                      <Knopf
                        variante="leise"
                        aria-label="Zoom auf 100 Prozent zurücksetzen"
                        onClick={() => wsRef.current?.setScale(1)}
                      >
                        {Math.round(projekt.ansicht.zoom * 100)} %
                      </Knopf>
                      <Knopf
                        variante="leise"
                        symbol="plus"
                        aria-label="Vergrößern"
                        title="Vergrößern"
                        onClick={() => wsRef.current?.zoomCenter(1)}
                      />
                      <Knopf
                        variante="leise"
                        symbol="einpassen"
                        aria-label="Alles anzeigen"
                        title="Alles anzeigen"
                        onClick={() => wsRef.current?.zoomToFit()}
                      >
                        Alles anzeigen
                      </Knopf>
                    </div>
                  </div>
                  {exportiert && (
                    <section className="export-rueckmeldung" role="status" aria-label="Export abgeschlossen">
                      <div>
                        <h3>Export erstellt</h3>
                        <p>
                          {exportiert.dateiname.endsWith('.scriptlab')
                            ? 'Die Projektkopie lässt sich in ScriptLab öffnen und weiterbearbeiten.'
                            : exportiert.dateiname.endsWith('.zip')
                              ? 'Das Business-Paket enthält den Workflow und die benötigten Begleitdateien.'
                              : 'Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.'}
                        </p>
                        {projekt.skriptsprache === 'vbs' && exportiert.signatur && (
                          <p
                            className={
                              exportiert.signatur.status === 'vertrauen-offen'
                                ? 'text-hinweis'
                                : 'text-sekundaer'
                            }
                          >
                            {exportiert.signatur.meldung}
                          </p>
                        )}
                        <Knopf
                          onClick={() =>
                            void aktion('Speicherordner wird angezeigt …', async () => {
                              antwort(await window.scriptlab.exportOrdnerAnzeigen());
                            })
                          }
                        >
                          Speicherordner anzeigen
                        </Knopf>
                      </div>
                      <Knopf
                        variante="leise"
                        symbol="schliessen"
                        aria-label="Exportmeldung schließen"
                        onClick={() => setExportiert(null)}
                      />
                    </section>
                  )}
                </div>
                {vorschauOffen && (
                  <section
                    className="code-panel"
                    data-testid="code-panel"
                    aria-label={sprache.vorschauTitel}
                    style={{ height: codeHoehe }}
                  >
                    <div
                      role="separator"
                      className="code-trenner"
                      tabIndex={0}
                      aria-label="Höhe der Codevorschau"
                      aria-orientation="horizontal"
                      aria-valuemin={140}
                      aria-valuemax={Math.floor(window.innerHeight * 0.65)}
                      aria-valuenow={Math.round(codeHoehe)}
                      onPointerDown={codeGroesseStarten}
                      onKeyDown={(e) => {
                        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault();
                          setCodeHoehe((h) =>
                            Math.max(
                              140,
                              Math.min(window.innerHeight * 0.65, h + (e.key === 'ArrowUp' ? 24 : -24)),
                            ),
                          );
                        }
                      }}
                    />
                    <header className="panel-kopf">
                      <h2>{sprache.vorschauTitel}</h2>
                      <div className="knopfgruppe">
                        <Knopf
                          variante="leise"
                          symbol="oben"
                          aria-label="Codevorschau vergrößern"
                          onClick={() => setCodeHoehe((h) => Math.min(window.innerHeight * 0.65, h + 48))}
                        />
                        <Knopf
                          variante="leise"
                          symbol="unten"
                          aria-label="Codevorschau verkleinern"
                          onClick={() => setCodeHoehe((h) => Math.max(140, h - 48))}
                        />
                        <Knopf
                          variante="leise"
                          aria-pressed={codeUmbruch}
                          onClick={() => setCodeUmbruch(!codeUmbruch)}
                        >
                          Zeilen umbrechen
                        </Knopf>
                        <Knopf
                          variante="leise"
                          symbol="schliessen"
                          aria-label="Codevorschau schließen"
                          onClick={() => setVorschauOffen(false)}
                        />
                      </div>
                    </header>
                    <p className="code-hinweis">Schreibgeschützt. Diese Vorschau führt keine Aktionen aus.</p>
                    <pre
                      tabIndex={0}
                      className={`code ${codeUmbruch ? 'mit-umbruch' : ''}`}
                      aria-label={`Schreibgeschützter ${sprache.vorschauTitel}`}
                    >
                      {ergebnis.code ??
                        "' Vervollständige den Entwurf. Die Hinweise erklären fehlende Verbindungen."}
                    </pre>
                  </section>
                )}
                {hinweiseOffen && (
                  <section
                    className="hinweise-panel"
                    data-testid="hinweise-panel"
                    aria-label="Hinweise zum Workflow"
                  >
                    <header className="panel-kopf">
                      <h2>Hinweise zum Workflow</h2>
                      <Knopf
                        variante="leise"
                        symbol="schliessen"
                        aria-label="Hinweise schließen"
                        onClick={() => setHinweiseOffen(false)}
                      />
                    </header>
                    <div className="hinweise-liste">
                      {ergebnis.meldungen.length ? (
                        ergebnis.meldungen.map((m, i) => (
                          <Knopf
                            key={i}
                            variante="leise"
                            symbol={m.stufe === 'fehler' ? 'fehler' : 'hinweis'}
                            onClick={() => blockAnzeigen(m.blockId, m.feldPfad)}
                          >
                            {m.text}
                          </Knopf>
                        ))
                      ) : (
                        <p>Der Workflow enthält keine erkannten Strukturfehler.</p>
                      )}
                    </div>
                  </section>
                )}
              </section>
              {eigenschaftenOffen && (
                <Eigenschaften
                  vorschauOeffnen={schrittVorschauOeffnen}
                  vorschauHinweis={datenvorschauHinweis(projekt, auswahl)}
                  spaltenNachQuelle={spaltenNachQuelle}
                  parameterKontext={parameterKontext}
                  quelleWaehlen={quelleWaehlen}
                  feldFehler={ergebnis.meldungen.flatMap((m) =>
                    m.blockId === auswahl && m.feldPfad ? [{ feldPfad: m.feldPfad, text: m.text }] : [],
                  )}
                  parameter={projekt.business.parameter}
                  ws={workspace}
                  blockId={auswahl}
                  angeheftet={einstellungen.eigenschaftenAngeheftet}
                  kannAnheften={kannAnheften}
                  anheften={() =>
                    void einstellungenSetzen({
                      ...einstellungenRef.current,
                      eigenschaftenAngeheftet: !einstellungenRef.current.eigenschaftenAngeheftet,
                    })
                  }
                  schliessen={eigenschaftenSchliessen}
                  verschieben={() => {
                    if (auswahlRef.current) platzierungStarten('verschieben', auswahlRef.current);
                    else melden('Wähle zuerst einen Baustein.');
                  }}
                  blockAktion={blockAktion}
                  schreibgeschuetzt={testAktiv(test.phase)}
                  beruehrt={(id) => setBeruehrt((alt) => new Set([...alt, id]))}
                />
              )}
            </main>
          </div>
          <div
            className="workflow-panel"
            id="workflow-daten"
            role="tabpanel"
            aria-labelledby="bereich-daten"
            hidden={arbeitsbereich !== 'daten'}
          >
            <Datenbereich
              projekt={projekt}
              workspace={workspace}
              blockId={auswahl}
              auswaehlen={auswaehlen}
              aendern={(neu) => {
                const satz = testOptionen.business?.parametersatz ?? 'test';
                const vorher = projekt.business.parametersaetze[satz];
                const nachher = neu.business.parametersaetze[satz];
                const ersetzt = Object.keys(testOptionen.business?.parameter ?? {}).filter(
                  (name) =>
                    Object.hasOwn(vorher, name) !== Object.hasOwn(nachher, name) ||
                    vorher[name] !== nachher[name],
                );
                if (ersetzt.length)
                  setTestOptionen((alt) =>
                    alt.business
                      ? {
                          ...alt,
                          business: {
                            ...alt.business,
                            parameter: Object.fromEntries(
                              Object.entries(alt.business.parameter).filter(
                                ([name]) => !ersetzt.includes(name),
                              ),
                            ),
                          },
                        }
                      : alt,
                  );
                aendern(neu);
              }}
              gesperrt={testAktiv(test.phase)}
              testZustand={test}
              blockAnzeigen={blockAnzeigen}
              veraltet={!!test.standHash && testInhalt.current !== testInhaltsText(projekt)}
              parameterOeffnen={() => setDialog('parameter')}
              vorschauLaden={(id) => void datenvorschauLaden(id)}
              vorschauen={aktuelleVorschauen}
              spaltenNachQuelle={spaltenNachQuelle}
              parameterKontext={parameterKontext}
              quelleWaehlen={quelleWaehlen}
              parameterZiel={parameterZiel}
              feldZiel={feldZiel}
              vorschauZiel={vorschauZiel}
              vorschauBausteinAnzeigen={vorschauBausteinAnzeigen}
              parametersatzWaehlen={(satz) =>
                setTestOptionen((alt) => ({
                  ...alt,
                  business: {
                    modus: 'prueflauf',
                    speicherMB: 512,
                    tempGB: 4,
                    fortsetzen: false,
                    ...alt.business,
                    parametersatz: satz,
                    parameter: {},
                  },
                }))
              }
            />
          </div>
          <div
            className="workflow-panel workflow-panel--laeufe"
            id="workflow-laeufe"
            role="tabpanel"
            aria-labelledby="bereich-laeufe"
            hidden={arbeitsbereich !== 'laeufe'}
          >
            <Laufverwaltung
              key={projekt.projektKennung}
              projektKennung={projekt.projektKennung!}
              workflowStand={testInhaltsText(projekt)}
              sichtbar={ansicht === 'editor' && arbeitsbereich === 'laeufe'}
              vorbereitungAnfrage={laufVorbereitungAnfrage}
              uebersichtAnfordern={laufDetailsAnfrage}
              workflowInfo={{ name: projekt.name, geaendert }}
              businessVorbereitung={
                businessSchritte(projekt).length > 0 ? (
                  <BusinessVorbereitung
                    key={projekt.projektKennung}
                    projekt={projekt}
                    optionen={testOptionen}
                    aendern={setTestOptionen}
                    gesperrt={testAktiv(test.phase)}
                    merken={aendern}
                  />
                ) : undefined
              }
              sprache={projekt.skriptsprache}
              pythonStatus={pythonStatus}
              pythonEinrichten={() => setDialog('einstellungen')}
              zustand={
                test.projektKennung && test.projektKennung !== projekt.projektKennung ? testBereit() : test
              }
              optionen={testOptionen}
              veraltet={!!test.standHash && testInhalt.current !== testInhaltsText(projekt)}
              gesperrt={!!verarbeitung}
              schliessen={() => setArbeitsbereich('ablauf')}
              starten={() => void testStarten()}
              stoppen={() => void testStoppen()}
              ordnerWaehlen={() => void testOrdnerWaehlen()}
              optionenAendern={setTestOptionen}
              kopieren={() =>
                void window.scriptlab.testAusgabeKopieren().then((r) => {
                  if (!r.ok) melden(r.meldung, 'fehler');
                })
              }
              leeren={() =>
                void window.scriptlab.testAusgabeLeeren().then((r) => {
                  if (r.ok) testUebernehmen(r.wert);
                })
              }
              blockAnzeigen={(id) => blockAnzeigen(id)}
            />
          </div>
          {dauerfehler && (
            <section className="aufgabenfehler" role="alert">
              <Symbol name="fehler" />
              <p>{dauerfehler}</p>
              <Knopf
                variante="leise"
                symbol="schliessen"
                aria-label="Fehlermeldung schließen"
                onClick={fehlerSchliessen}
              />
            </section>
          )}
          {entwurfStatus?.phase === 'fehler' && (
            <section className="aufgabenfehler" role="alert">
              <p>
                {entwurfStatus.meldung ??
                  'Der Entwurf konnte nicht lokal gesichert werden. Dein Arbeitsstand bleibt im Editor.'}
              </p>
              <Knopf onClick={() => void entwurfJetztSichern()}>Erneut sichern</Knopf>
            </section>
          )}
          {dateikonflikt && (
            <section className="aufgabenfehler" role="alert">
              <p>
                Die Ausgangsdatei wurde außerhalb von ScriptLab geändert. Speichere deinen Arbeitsstand als
                separate Kopie.
              </p>
              <Knopf onClick={() => void projektAktion('unter')}>Kopie speichern</Knopf>
            </section>
          )}
          <footer className="statusleiste" data-testid="statusleiste">
            {entwurfStatus?.phase === 'gesichert' && (
              <span
                className="entwurf-status"
                aria-label="Entwurfstatus"
                role="status"
                title={`Lokal als Entwurf gesichert: ${entwurfStatus.gesichertAm ? new Date(entwurfStatus.gesichertAm).toLocaleString('de-DE') : ''}`}
              >
                Entwurf lokal gesichert
              </span>
            )}
            {entwurfStatus?.phase === 'ausstehend' && (
              <span className="entwurf-status" role="status">
                Entwurfssicherung ausstehend
              </span>
            )}
            <span id="status-aktion" role="status" className={`status-aktion status-aktion--${statusArt}`}>
              {verarbeitung ?? (statusArt === 'fehler' && dauerfehler === status ? '' : status)}
            </span>
            <Knopf
              variante="leise"
              symbol={sichtbareHinweise.some((m) => m.stufe === 'fehler') ? 'hinweis' : 'info'}
              onClick={() => {
                setPruefungAngefordert(true);
                setArbeitsbereich('ablauf');
                setHinweiseOffen(!hinweiseOffen);
              }}
            >
              Hinweise{sichtbareHinweise.length ? ` (${sichtbareHinweise.length})` : ''}
            </Knopf>
          </footer>
        </div>
      </div>
      <Variablendialoge />
      <ExportDialog
        offen={dialog === 'export'}
        projekt={projekt}
        schliessen={() => setDialog(null)}
        projektSpeichern={() => void projektExportieren()}
        exportieren={() => void exportieren()}
      />
      <SprachwahlDialog
        offen={dialog === 'sprache'}
        vorauswahl={einstellungen.letzteSkriptsprache}
        abbrechen={() => setDialog(null)}
        erstellen={(wahl, art) => {
          setDialog(null);
          void projektAktion('neu', wahl, art);
        }}
      />
      <ProjektDialog
        offen={dialog === 'projekt'}
        name={projekt.name}
        beschreibung={projekt.beschreibung}
        schliessen={() => setDialog(null)}
        speichern={(name, beschreibung) => aendern({ ...projektRef.current, name, beschreibung })}
      />
      <ParameterDialog
        offen={dialog === 'parameter'}
        business={projekt.business}
        schliessen={() => setDialog(null)}
        speichern={(business, umbenennungen = {}) => {
          const vorherigerStand = standLesen();
          const neu = parameterVerweiseUmbenennen({ ...vorherigerStand, business }, umbenennungen);
          const ws = wsRef.current;
          if (ws) {
            const daten = new Map<string, string | undefined>();
            const lesen = (block: import('../kern/projekt').EditorBlock) => {
              daten.set(block.id!, block.data);
              for (const eingang of Object.values(block.inputs ?? {})) {
                if (eingang.block) lesen(eingang.block);
                if (eingang.shadow) lesen(eingang.shadow);
              }
              if (block.next?.block) lesen(block.next.block);
            };
            neu.editor.blocks?.blocks.forEach(lesen);
            Blockly.Events.setGroup(true);
            try {
              for (const block of ws.getAllBlocks(false)) {
                const wert = daten.get(block.id);
                if (wert !== undefined && wert !== block.data) {
                  const vorher = block.data;
                  block.data = wert;
                  Blockly.Events.fire(new BlockDatenEreignis(block, vorher, wert));
                }
              }
              Blockly.Events.fire(new ParameterEreignis(ws, vorherigerStand.business, business));
            } finally {
              Blockly.Events.setGroup(false);
            }
          }
          aendern(neu);
        }}
      />
      <EinstellungenDialog
        businessGewechselt={() => {
          void window.scriptlab.laden().then((r) => {
            if (r.ok) {
              setEinstellungen(r.wert.einstellungen);
              einstellungenRef.current = r.wert.einstellungen;
            }
          });
          void window.scriptlab.pythonStatus().then((r) => {
            if (r.ok) setPythonStatus(r.wert);
          });
        }}
        pythonStatus={pythonStatus}
        pythonAktion={(art) => void pythonAktion(art)}
        projektOptionenAnzeigen={editorBegonnen}
        offen={dialog === 'einstellungen'}
        schliessen={() => setDialog(null)}
        einstellungen={einstellungen}
        setzen={(neu) => void einstellungenSetzen(neu)}
        projekt={projekt}
        exportOptionenSetzen={(neu) => aendern({ ...projektRef.current, exportOptionen: neu })}
        version={version}
        zertifikate={zertifikate}
        zertifikatMeldung={zertifikatMeldung}
        zertifikateLaden={() =>
          void aktion('Zertifikate werden gelesen …', async () => {
            const liste = antwort(await window.scriptlab.zertifikate());
            setZertifikate(liste);
            setZertifikatMeldung(
              liste.length
                ? `${liste.length} geeignete Zertifikate gefunden.`
                : 'Kein geeignetes Zertifikat gefunden. Ein unsignierter Export ist weiterhin möglich.',
            );
          })
        }
        update={update}
        updateAktion={(art) => void updateAktion(art)}
        verarbeitung={verarbeitung}
        fehlerMeldung={dauerfehler}
      />
      <Dialog
        offen={dialog === 'ueber'}
        titel="Über ScriptLab"
        onSchliessen={() => setDialog(null)}
        fuss={
          <Knopf variante="primaer" onClick={() => setDialog(null)}>
            Schließen
          </Knopf>
        }
      >
        <Marke />
        <p>ScriptLab {version} · Windows 11 x64</p>
        <p>Entwickelt von Leon Stolz</p>
        <p>
          ScriptLab erstellt, prüft und exportiert Workflows. Mit „Testen“ führst du den aktuellen Ablauf
          bewusst auf diesem Computer aus. Dateiänderungen sind echt. Exportierte Scripts kannst du auch
          eigenständig außerhalb dieser Anwendung ausführen.
        </p>
        <p>
          VBScript ist von Microsoft abgekündigt. Die spätere Ausführung hängt von der Windows-Komponente und
          deinen Richtlinien ab.
        </p>
        <p>Mit Electron, React, Vite und Blockly. Die Lizenzhinweise liegen der Installation bei.</p>
        <Lizenzhinweis />
      </Dialog>
    </div>
  );
}
