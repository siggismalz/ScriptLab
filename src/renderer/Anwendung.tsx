import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as Blockly from 'blockly/core';
import { registriereBausteine } from '../editor/bausteine';
import { bausteinDefinitionen } from '../kern/katalog';
import { neuesProjekt, type Projekt } from '../kern/projekt';
import { vbsErzeugen } from '../kern/generator';
import { scriptlabThema } from '../gestaltung/blocklyThema';
import { farben, masse } from '../gestaltung/tokens';
import {
  bausteinEinfuegen,
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
import { Menue } from './komponenten/Menue';
import { Startbereich } from './Startbereich';
import { Testbereich } from './Testbereich';
import { testAktiv, testBereit, type TestZustand, type TestOptionen } from '../gemeinsam/testlauf';

registriereBausteine();
const vorgaben: Einstellungen = {
  automatischeUpdates: false,
  vorabversionen: false,
  palettenBreite: 272,
  paletteEingeklappt: false,
  eigenschaftenAngeheftet: false,
  textSkalierung: 1,
};
function antwort<T>(r: Antwort<T>): T {
  if (!r.ok) throw new Error(r.meldung);
  return r.wert;
}

export function Anwendung() {
  const [test, setTest] = useState<TestZustand>(testBereit);
  const [testOptionen, setTestOptionen] = useState<TestOptionen>({
    basisVerzeichnis: null,
    zeitlimitSekunden: 120,
  });
  const [testOffen, setTestOffen] = useState(false);
  const [testHoehe, setTestHoehe] = useState(280);
  const testSperre = useRef(false);
  const testAnfrage = useRef(false);
  const testInhalt = useRef<string | null>(null);
  const testKontextGesehen = useRef<string | null>(null);
  const [ansicht, setAnsicht] = useState<'start' | 'editor'>('start');
  const [editorBegonnen, setEditorBegonnen] = useState(false);
  const [startZiel, setStartZiel] = useState<'start' | 'hilfe'>('start');
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
  const gespeichertRef = useRef(JSON.stringify(projektRef.current));
  const laedt = useRef(false),
    busy = useRef(false);
  const auswahlRef = useRef<string | null>(null),
    rueckfokus = useRef<HTMLElement | null>(null);
  const platzierungRef = useRef<PlatzierungsAuftrag | null>(null);
  const [projekt, setProjekt] = useState(projektRef.current);
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
  const [dauerfehler, setDauerfehler] = useState<string | null>(null);
  const [verarbeitung, setVerarbeitung] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'einstellungen' | 'ueber' | 'projekt' | null>(null);
  const [version, setVersion] = useState('0.1.0');
  const [zertifikate, setZertifikate] = useState<Zertifikat[]>([]);
  const [zertifikatMeldung, setZertifikatMeldung] = useState('');
  const [update, setUpdate] = useState<UpdateZustand | null>(null);
  const [exportiert, setExportiert] = useState<ExportErgebnis | null>(null);
  const ergebnis = useMemo(() => vbsErzeugen(projekt), [projekt.editor, projekt.exportOptionen]);
  const sichtbareHinweise = ergebnis.meldungen.filter(
    (m) => pruefungAngefordert || (m.blockId && beruehrt.has(m.blockId)),
  );
  const kannAnheften = breite >= 1440;
  const angeheftet = eigenschaftenOffen && kannAnheften && einstellungen.eigenschaftenAngeheftet;
  const nurStart = projekt.editor.blocks?.blocks.length === 1 && !projekt.editor.blocks.blocks[0].next;

  function editorZeigen() {
    setEditorBegonnen(true);
    setAnsicht('editor');
  }
  async function startseiteZeigen(ziel: 'start' | 'hilfe' = 'start') {
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
    if (!aktuell.geaendert) gespeichertRef.current = JSON.stringify(aktuell.projekt);
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
          melden(art === 'entwurf-speichern' ? 'Projekt gespeichert.' : 'Workflow zum Bearbeiten geöffnet.');
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
        'hinweis',
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
    setStatus(text);
    setStatusArt(art);
    if (art === 'fehler') setDauerfehler(text);
  }
  async function aktion(name: string, funktion: () => Promise<void>) {
    if (busy.current) return;
    aktionsFokus.current = document.activeElement;
    busy.current = true;
    setVerarbeitung(name);
    setDauerfehler(null);
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
    const json = JSON.stringify(neu);
    if (json === JSON.stringify(projektRef.current)) return;
    projektRef.current = neu;
    setProjekt(neu);
    setRevision((n) => n + 1);
    setGeaendert(json !== gespeichertRef.current);
    setExportiert(null);
    void window.scriptlab.aendern(neu).then((r) => {
      if (!r.ok) melden(r.meldung, 'fehler');
    });
  }
  function auswaehlen(id: string | null) {
    auswahlRef.current = id;
    setAuswahl(id);
    for (const b of wsRef.current?.getAllBlocks(false) ?? [])
      b.getSvgRoot()?.classList.toggle('scriptlabAuswahl', b.id === id);
  }
  function eigenschaftenOeffnen() {
    rueckfokus.current = document.activeElement as HTMLElement;
    setEigenschaftenOffen(true);
  }
  function eigenschaftenSchliessen() {
    setEigenschaftenOffen(false);
    rueckfokus.current?.focus?.({ preventScroll: true });
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
        gespeichertRef.current = JSON.stringify(neu.projekt);
        setProjekt(neu.projekt);
        setDatei(neu.dateiname);
        setGeaendert(neu.geaendert);
        dokumentStatusUebernehmen(neu);
        return;
      }
      editorZeigen();
      await new Promise<void>((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig())));
      Blockly.svgResize(ws);
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
      gespeichertRef.current = neu.geaendert ? '' : JSON.stringify(stand);
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
    art: 'neu' | 'oeffnen' | 'speichern' | 'unter' | 'begruessung' | 'backup' | 'dateiliste',
  ) {
    await aktion(
      art === 'speichern' || art === 'unter' ? 'Projekt wird gespeichert …' : 'Projekt wird geöffnet …',
      async () => {
        const stand = standLesen();
        const r =
          art === 'neu'
            ? await window.scriptlab.neu(stand)
            : art === 'oeffnen'
              ? await window.scriptlab.oeffnen(stand)
              : ['begruessung', 'backup', 'dateiliste'].includes(art)
                ? await window.scriptlab.beispielOeffnen(
                    stand,
                    art as 'begruessung' | 'backup' | 'dateiliste',
                  )
                : await window.scriptlab.speichern(stand, art === 'unter');
        const neu = antwort(r);
        if (neu) {
          if (art === 'speichern' || art === 'unter') {
            const kennung = neu.projekt.projektKennung;
            const gespeichertStand = { ...stand, projektKennung: kennung };
            projektRef.current = { ...projektRef.current, projektKennung: kennung };
            setProjekt(projektRef.current);
            gespeichertRef.current = JSON.stringify(gespeichertStand);
            setDatei(neu.dateiname);
            setGeaendert(JSON.stringify(projektRef.current) !== gespeichertRef.current);
            dokumentStatusUebernehmen(neu);
            const kontext = antwort(await window.scriptlab.testLesen());
            setTestOptionen((alt) => ({ ...alt, basisVerzeichnis: kontext.optionen.basisVerzeichnis }));
            melden('Projekt gespeichert.', 'erfolg');
          } else {
            await dokumentLaden(neu);
            editorZeigen();
            melden(art === 'neu' ? 'Füge links einen Baustein hinzu.' : 'Projekt geöffnet.');
          }
        } else {
          await abgebrocheneAktionAbgleichen();
        }
        await bibliothekAktualisieren();
      },
    );
  }
  function blockAnzeigen(id?: string) {
    const ws = wsRef.current;
    if (!ws || !id) return;
    const b = ws.getBlockById(id);
    if (b) {
      auswaehlen(id);
      b.select();
      ws.centerOnBlock(id);
    }
  }
  async function exportieren() {
    setExportiert(null);
    setDauerfehler(null);
    const p = vbsErzeugen(standLesen());
    if (!p.code || p.meldungen.some((m) => m.stufe === 'fehler')) {
      setPruefungAngefordert(true);
      setHinweiseOffen(true);
      melden('Bitte vervollständige die markierten Bausteine vor dem Export.', 'hinweis');
      blockAnzeigen(p.meldungen.find((m) => m.stufe === 'fehler')?.blockId);
      return;
    }
    await aktion('VBS-Datei wird gespeichert …', async () => {
      const neu = antwort(await window.scriptlab.exportieren(standLesen()));
      if (neu) {
        setExportiert(neu);
        melden('Script gespeichert.', neu.signatur.status === 'vertrauen-offen' ? 'hinweis' : 'erfolg');
      }
    });
  }
  function testInhaltsText(p: Projekt): string {
    const { ansicht: _ansicht, ...inhalt } = p;
    return JSON.stringify(inhalt);
  }
  function testKontextKennung(optionen = testOptionen): string {
    return `${projektRef.current.projektKennung}:${optionen.basisVerzeichnis}:${optionen.zeitlimitSekunden}`;
  }
  function testUebernehmen(neu: TestZustand) {
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
  async function testStarten() {
    if (testAnfrage.current || testSperre.current || busy.current) return;
    setTestOffen(true);
    setVorschauOffen(false);
    setExportiert(null);
    setDauerfehler(null);
    const stand = structuredClone(standLesen());
    const pruefung = vbsErzeugen(stand);
    if (!pruefung.code) {
      setPruefungAngefordert(true);
      setHinweiseOffen(true);
      melden('Vervollständige die markierten Bausteine vor dem Test.', 'hinweis');
      blockAnzeigen(pruefung.meldungen.find((m) => m.stufe === 'fehler')?.blockId);
      return;
    }
    if (!testOptionen.basisVerzeichnis) {
      melden(
        'Wähle im Testbereich zuerst einen Basisordner. Relative Dateipfade beziehen sich auf diesen Ordner.',
        'fehler',
      );
      return;
    }
    if (testKontextGesehen.current !== testKontextKennung()) {
      testKontextGesehen.current = testKontextKennung();
      melden(
        'Prüfe im Testbereich Basisordner und Zeitlimit. Mit „Workflow testen“ startest du danach bewusst.',
        'hinweis',
      );
      return;
    }
    testAnfrage.current = true;
    testInhalt.current = testInhaltsText(stand);
    testUebernehmen({
      ...testBereit(),
      phase: 'vorbereitung',
      projektName: stand.name,
      projektKennung: stand.projektKennung ?? null,
      optionen: testOptionen,
      meldung: 'Der aktuelle Editorstand wird geprüft.',
    });
    setPlatzierung(null);
    platzierungRef.current = null;
    try {
      testUebernehmen(antwort(await window.scriptlab.testStarten(stand, testOptionen)));
    } catch (e) {
      testUebernehmen({
        ...testBereit(),
        phase: 'fehlgeschlagen',
        meldung: e instanceof Error ? e.message : 'Der Test konnte nicht gestartet werden.',
      });
    } finally {
      testAnfrage.current = false;
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
      const pfad = antwort(await window.scriptlab.testOrdnerWaehlen());
      if (pfad)
        setTestOptionen((alt) => {
          const neu = { ...alt, basisVerzeichnis: pfad };
          testKontextGesehen.current = testKontextKennung(neu);
          return neu;
        });
    } catch (e) {
      melden(e instanceof Error ? e.message : 'Der Ordner konnte nicht gewählt werden.', 'fehler');
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
      aendern(standLesen());
      melden(auftrag.art === 'einfuegen' ? 'Baustein eingefügt.' : 'Baustein verschoben.');
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
      melden('Baustein gelöscht. Rückgängig stellt ihn wieder her.');
      return;
    }
    const daten = Blockly.clipboard.copy(b);
    if (art === 'duplizieren' && daten) Blockly.clipboard.paste(daten, ws);
    melden(
      art === 'kopieren' ? 'Baustein kopiert.' : 'Baustein dupliziert. Verbinde die Kopie mit dem Ablauf.',
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
      maxBlocks: 2000,
      plugins: { blockDragger: ScriptLabBlockDragger },
    });
    wsRef.current = ws;
    setWorkspace(ws);
    const aenderung = (event: Blockly.Events.Abstract) => {
      if (laedt.current || !arbeitsbereichGeladen.current) return;
      if (event.type === Blockly.Events.SELECTED) {
        const id = (event as Blockly.Events.Selected).newElementId;
        if (id && ws.getBlockById(id)) auswaehlen(id);
        return;
      }
      if (event.isUiEvent && event.type !== Blockly.Events.VIEWPORT_CHANGE) return;
      if (event.type === Blockly.Events.VIEWPORT_CHANGE)
        aendern({ ...projektRef.current, ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY } });
      else {
        aendern(standLesen());
        if (auswahlRef.current && !ws.getBlockById(auswahlRef.current)) auswaehlen(null);
      }
    };
    ws.addChangeListener(aenderung);
    const groesse = new ResizeObserver(() => {
      if (!editorSichtbar.current) return;
      const x = ws.scrollX,
        y = ws.scrollY;
      Blockly.svgResize(ws);
      ws.scroll(x, y);
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
      navigation();
      groesse.disconnect();
      ws.dispose();
    };
  }, []);
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
      b.getSvgRoot()?.classList.toggle('scriptlabAuswahl', b.id === auswahlRef.current);
    }
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
      if (dialog) return;
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
      if (!editorSichtbar.current || ziel.matches?.('input,textarea,select') || ziel.isContentEditable)
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
    <div className="anwendung" style={style}>
      <div className="start-ansicht" hidden={ansicht !== 'start'}>
        <Startbereich
          daten={bibliothek}
          laden={bibliothekLaedt}
          fehler={bibliothekFehler ?? dauerfehler}
          fehlerErneutLaden={bibliothekFehler ? () => void bibliothekAktualisieren() : undefined}
          fehlerSchliessen={
            !bibliothekFehler && dauerfehler
              ? () => {
                  setDauerfehler(null);
                  setStatus('');
                  setStatusArt('neutral');
                }
              : undefined
          }
          verarbeitung={verarbeitung}
          meldung={statusArt === 'erfolg' || statusArt === 'hinweis' ? status : null}
          aktiveInfo={editorBegonnen ? { name: projekt.name, dateiname: datei, geaendert } : null}
          verfuegbarkeiten={verfuegbarkeiten}
          ziel={startZiel}
          zielAnfrage={startAnfrage}
          neuerWorkflow={() => void projektAktion('neu')}
          workflowOeffnen={() => void projektAktion('oeffnen')}
          weiterbearbeiten={editorZeigen}
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
        <nav className="werkzeugleiste" aria-label="Projektaktionen">
          <Knopf variante="leise" onClick={() => startseiteZeigen()}>
            Startseite
          </Knopf>
          <div className="knopfgruppe">
            <Knopf
              symbol="neu"
              variante="leise"
              disabled={!!verarbeitung}
              grundId="status-aktion"
              onClick={() => void projektAktion('neu')}
            >
              Neu
            </Knopf>
            <Knopf
              symbol="oeffnen"
              variante="leise"
              disabled={!!verarbeitung}
              grundId="status-aktion"
              onClick={() => void projektAktion('oeffnen')}
            >
              Öffnen
            </Knopf>
            <Knopf
              symbol="speichern"
              disabled={!!verarbeitung || testAktiv(test.phase)}
              grundId={testAktiv(test.phase) ? 'test-sperrhinweis' : 'status-aktion'}
              onClick={() => void projektAktion('speichern')}
            >
              Speichern
            </Knopf>
            <Menue
              beschriftung="Projektmenü"
              nurSymbol
              symbol="unten"
              eintraege={[
                {
                  text: 'Speichern unter',
                  symbol: 'speichern',
                  gesperrt: testAktiv(test.phase),
                  grund: 'Stoppe den Test vor dem Speichern.',
                  aktion: () => void projektAktion('unter'),
                },
                {
                  text: 'Als Entwurf sichern',
                  symbol: 'speichern',
                  aktion: () => void entwurfJetztSichern(),
                },
                {
                  text: 'Projektangaben',
                  symbol: 'info',
                  gesperrt: testAktiv(test.phase),
                  grund: 'Stoppe den Test vor Änderungen.',
                  aktion: () => setDialog('projekt'),
                },
                { text: 'Beispiel: Begrüßung', aktion: () => void projektAktion('begruessung') },
                { text: 'Beispiel: Datei-Backup', aktion: () => void projektAktion('backup') },
                { text: 'Beispiel: Dateinamenliste', aktion: () => void projektAktion('dateiliste') },
              ]}
            />
          </div>
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
              onClick={() => (eigenschaftenOffen ? eigenschaftenSchliessen() : eigenschaftenOeffnen())}
            >
              Eigenschaften
            </Knopf>
            <Knopf
              variante="leise"
              symbol="code"
              aria-label="Codevorschau"
              aria-pressed={vorschauOffen}
              onClick={() => {
                setVorschauOffen(!vorschauOffen);
                if (!vorschauOffen) setTestOffen(false);
              }}
            >
              Codevorschau
            </Knopf>
          </div>
          <div className="hauptaktion">
            <Knopf
              variante="primaer"
              symbol="testen"
              disabled={testAktiv(test.phase) || !!verarbeitung}
              grundId={testAktiv(test.phase) ? 'test-sperrhinweis' : 'status-aktion'}
              onClick={() => void testStarten()}
            >
              Testen
            </Knopf>
            {testAktiv(test.phase) && (
              <>
                <span id="test-sperrhinweis" className="test-kurzstatus" role="status">
                  {test.phase === 'vorbereitung'
                    ? 'Wird vorbereitet'
                    : test.phase === 'stoppt'
                      ? 'Wird gestoppt'
                      : 'Test läuft'}
                  <span className="sl-nur-vorlesen">
                    . Änderungen und ein weiterer Start sind bis zum Testende gesperrt.
                  </span>
                </span>
                <Knopf
                  variante="gefahr"
                  symbol="stoppen"
                  disabled={test.phase === 'stoppt'}
                  grundId="test-sperrhinweis"
                  onClick={() => void testStoppen()}
                >
                  Stoppen
                </Knopf>
              </>
            )}
            <Knopf
              variante="leise"
              aria-pressed={testOffen}
              onClick={() => {
                setTestOffen(!testOffen);
                if (!testOffen) {
                  setVorschauOffen(false);
                  testKontextGesehen.current = testKontextKennung();
                }
              }}
            >
              Testausgabe
            </Knopf>
            <Knopf
              variante="standard"
              symbol="exportieren"
              verarbeitung={verarbeitung === 'VBS-Datei wird gespeichert …'}
              disabled={!!verarbeitung || testAktiv(test.phase)}
              grundId={testAktiv(test.phase) ? 'test-sperrhinweis' : 'status-aktion'}
              onClick={() => void exportieren()}
            >
              Als VBS exportieren
            </Knopf>
            <Menue
              beschriftung="Weitere Funktionen"
              nurSymbol
              symbol="mehr"
              eintraege={[
                { text: 'Einstellungen', symbol: 'einstellungen', aktion: () => setDialog('einstellungen') },
                { text: 'Hilfe und Anleitungen', symbol: 'info', aktion: () => startseiteZeigen('hilfe') },
                { text: 'Über ScriptLab', symbol: 'info', aktion: () => setDialog('ueber') },
                { text: 'Kopieren', symbol: 'kopieren', aktion: () => blockAktion('kopieren') },
                { text: 'Einfügen', symbol: 'einfuegen', aktion: () => blockAktion('einfuegen') },
              ]}
            />
          </div>
        </nav>
        <main className={`arbeitszeile ${angeheftet ? 'mit-eigenschaften' : ''}`}>
          <div className="test-palette" inert={testAktiv(test.phase)}>
            <Palette
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
            <div className="canvas-bereich">
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
              <div className="ansichtsteuerung" aria-label="Arbeitsbereich verschieben">
                {(['links', 'rechts', 'oben', 'unten'] as const).map((name, i) => (
                  <Knopf
                    key={name}
                    variante="leise"
                    symbol={name}
                    aria-label={`Ansicht nach ${name}`}
                    title={`Ansicht nach ${name}`}
                    onClick={() =>
                      verschieben(i === 0 ? 100 : i === 1 ? -100 : 0, i === 2 ? 100 : i === 3 ? -100 : 0)
                    }
                  />
                ))}
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
                <Knopf variante="leise" symbol="einpassen" onClick={() => wsRef.current?.zoomToFit()}>
                  Alles anzeigen
                </Knopf>
              </div>
              {exportiert && (
                <section className="export-rueckmeldung" role="status" aria-label="Export abgeschlossen">
                  <div>
                    <h3>Script gespeichert</h3>
                    <p>
                      Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.
                    </p>
                    <p
                      className={
                        exportiert.signatur.status === 'vertrauen-offen' ? 'text-hinweis' : 'text-sekundaer'
                      }
                    >
                      {exportiert.signatur.meldung}
                    </p>
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
            {testOffen && (
              <section
                className="test-panel-rahmen"
                style={{ height: Math.min(testHoehe, window.innerHeight * 0.5) }}
              >
                <div
                  className="code-trenner"
                  role="separator"
                  tabIndex={0}
                  aria-label="Höhe der Testausgabe"
                  aria-orientation="horizontal"
                  aria-valuemin={200}
                  aria-valuemax={Math.floor(window.innerHeight * 0.5)}
                  aria-valuenow={testHoehe}
                  onKeyDown={(e) => {
                    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault();
                      setTestHoehe((h) =>
                        Math.max(
                          200,
                          Math.min(window.innerHeight * 0.5, h + (e.key === 'ArrowUp' ? 24 : -24)),
                        ),
                      );
                    }
                  }}
                  onPointerDown={(e) => {
                    const start = e.clientY,
                      hoehe = testHoehe;
                    const bewegen = (p: PointerEvent) =>
                      setTestHoehe(
                        Math.max(200, Math.min(window.innerHeight * 0.5, hoehe + start - p.clientY)),
                      );
                    const ende = () => {
                      window.removeEventListener('pointermove', bewegen);
                      window.removeEventListener('pointerup', ende);
                    };
                    window.addEventListener('pointermove', bewegen);
                    window.addEventListener('pointerup', ende, { once: true });
                  }}
                />
                <Testbereich
                  zustand={test}
                  optionen={testOptionen}
                  veraltet={!!test.standHash && testInhalt.current !== testInhaltsText(projekt)}
                  gesperrt={!!verarbeitung}
                  schliessen={() => setTestOffen(false)}
                  starten={() => void testStarten()}
                  stoppen={() => void testStoppen()}
                  ordnerWaehlen={() => void testOrdnerWaehlen()}
                  optionenAendern={(neu) => {
                    setTestOptionen(neu);
                    testKontextGesehen.current = testKontextKennung(neu);
                  }}
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
                  blockAnzeigen={() => {
                    if (!testAktiv(test.phase) && testInhalt.current !== testInhaltsText(projekt))
                      melden(
                        'Dieser Fehler gehört zu einem älteren Teststand. Die Blockzuordnung wird nicht auf einen anderen Workflow übertragen.',
                        'hinweis',
                      );
                    else blockAnzeigen(test.fehlerBlockId ?? undefined);
                  }}
                />
              </section>
            )}
            {vorschauOffen && (
              <section
                className="code-panel"
                data-testid="code-panel"
                aria-label="VBS-Codevorschau"
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
                  <h2>VBS-Codevorschau</h2>
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
                  aria-label="Schreibgeschützte VBS-Codevorschau"
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
                        onClick={() => blockAnzeigen(m.blockId)}
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
        {dauerfehler && (
          <section className="aufgabenfehler" role="alert">
            <Symbol name="fehler" />
            <p>{dauerfehler}</p>
            <Knopf
              variante="leise"
              symbol="schliessen"
              aria-label="Fehlermeldung schließen"
              onClick={() => setDauerfehler(null)}
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
          <span className="projektstatus" aria-label="Projektstatus">
            {geaendert ? 'Ungespeicherte Änderungen' : datei ? 'Projekt gespeichert' : 'Neues Projekt'}
          </span>
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
            {verarbeitung ?? status}
          </span>
          <Knopf
            variante="leise"
            symbol={sichtbareHinweise.some((m) => m.stufe === 'fehler') ? 'hinweis' : 'info'}
            onClick={() => {
              setPruefungAngefordert(true);
              setHinweiseOffen(!hinweiseOffen);
            }}
          >
            Hinweise{sichtbareHinweise.length ? ` (${sichtbareHinweise.length})` : ''}
          </Knopf>
        </footer>
      </div>
      <ProjektDialog
        offen={dialog === 'projekt'}
        name={projekt.name}
        beschreibung={projekt.beschreibung}
        schliessen={() => setDialog(null)}
        speichern={(name, beschreibung) => aendern({ ...projektRef.current, name, beschreibung })}
      />
      <EinstellungenDialog
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
      </Dialog>
    </div>
  );
}
