import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { testAktiv, type TestOptionen, type TestPhase, type TestZustand } from '../gemeinsam/testlauf';
import { Feld, Textfeld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { Statusanzeige, type StatusArt } from './komponenten/Statusanzeige';
import './testbereich.css';
import { sprachdaten, type Skriptsprache } from '../kern/sprachen';
import type { PythonStatus } from '../gemeinsam/python';
import type { ReactNode } from 'react';
import { BusinessErgebnis } from './BusinessErgebnis';
import { VorbereitungsPruefung } from './BusinessVorbereitung';

export interface TestbereichEigenschaften {
  workflowInfo?: { name: string; geaendert: boolean };
  businessVorbereitung?: ReactNode;
  sprache?: Skriptsprache;
  pythonStatus?: PythonStatus | null;
  pythonEinrichten?: () => void;
  zustand: TestZustand;
  optionen: TestOptionen;
  veraltet: boolean;
  gesperrt?: boolean;
  schliessen: () => void;
  starten: () => void;
  stoppen: () => void;
  ordnerWaehlen: () => void;
  optionenAendern: (optionen: TestOptionen) => void;
  kopieren: () => void;
  leeren: () => void;
  blockAnzeigen: (blockId: string) => void;
}

const phasen: Record<TestPhase, string> = {
  bereit: 'Bereit',
  vorbereitung: 'Lauf wird vorbereitet',
  laeuft: 'Lauf läuft',
  stoppt: 'Wird gestoppt',
  beendet: 'Lauf beendet',
  mit_fehlern: 'Mit Fehlern beendet',
  fehlgeschlagen: 'Fehlgeschlagen',
  abgebrochen: 'Abgebrochen',
  zeitlimit: 'Zeitlimit erreicht',
};

export function zeitlimitAusText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const wert = Number(text);
  return Number.isSafeInteger(wert) && wert >= 1 && wert <= 28800 ? wert : null;
}

export function ausgabeIstAmEnde(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
}

export function laufzeitAnzeigen(start: string | null, ende: string | null, jetzt: number): string {
  if (!start || !Number.isFinite(Date.parse(start))) return 'Noch nicht gestartet';
  const bis = ende ? Date.parse(ende) : jetzt;
  if (!Number.isFinite(bis)) return 'Nicht verfügbar';
  const sekunden = Math.max(0, Math.floor((bis - Date.parse(start)) / 1000));
  return sekunden < 60
    ? `${sekunden} s`
    : `${Math.floor(sekunden / 60)} min ${String(sekunden % 60).padStart(2, '0')} s`;
}

function zeitpunktAnzeigen(iso: string | null): string {
  if (!iso) return 'Noch nicht gestartet';
  const wert = new Date(iso);
  return Number.isNaN(wert.valueOf())
    ? 'Nicht verfügbar'
    : wert.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
}

function statusArt(zustand: TestZustand): StatusArt {
  if (zustand.phase === 'fehlgeschlagen') return 'fehler';
  if (zustand.phase === 'beendet' && zustand.exitcode === 0) return 'erfolg';
  if (['abgebrochen', 'zeitlimit', 'stoppt', 'mit_fehlern'].includes(zustand.phase)) return 'hinweis';
  return testAktiv(zustand.phase) ? 'verarbeitung' : 'neutral';
}

type Laufansicht = 'vorbereitung' | 'uebersicht' | 'ergebnisse' | 'protokoll';
const laufansichten: { id: Laufansicht; text: string }[] = [
  { id: 'vorbereitung', text: 'Vorbereitung' },
  { id: 'uebersicht', text: 'Übersicht' },
  { id: 'ergebnisse', text: 'Ergebnisse' },
  { id: 'protokoll', text: 'Protokoll' },
];

function modusName(optionen: TestOptionen): string {
  return optionen.business?.modus === 'vorschau'
    ? 'Datenvorschau'
    : optionen.business?.modus === 'prueflauf'
      ? 'Prüflauf ohne Zieländerungen'
      : 'Echte Ausführung';
}

function startName(optionen: TestOptionen): string {
  return optionen.business?.modus === 'vorschau'
    ? 'Datenvorschau laden'
    : optionen.business?.modus === 'prueflauf'
      ? 'Prüflauf starten'
      : 'Workflow ausführen';
}

/** Der Hauptprozess besitzt den Lauf; ein Ansichtswechsel ändert ausschließlich die Darstellung. */
export function Testbereich(props: TestbereichEigenschaften) {
  const { zustand, optionen, veraltet, gesperrt = false } = props;
  const aktiv = testAktiv(zustand.phase);
  const hatLauf = Boolean(zustand.laufId || zustand.phase !== 'bereit');
  const sprache = sprachdaten[zustand.skriptsprache ?? props.sprache ?? 'vbs'];
  const laufOptionen = hatLauf ? zustand.optionen : optionen;
  const [ansicht, setAnsicht] = useState<Laufansicht>(hatLauf ? 'uebersicht' : 'vorbereitung');
  const vorbereitung = ansicht === 'vorbereitung';
  const fokussierteVorbereitung = vorbereitung && !aktiv && Boolean(props.businessVorbereitung);
  const anzeigeOptionen = vorbereitung && !aktiv ? optionen : laufOptionen;
  const [zeitlimitEntwurf, setZeitlimitEntwurf] = useState(
    String(aktiv ? zustand.optionen.zeitlimitSekunden : optionen.zeitlimitSekunden),
  );
  const [zeitlimitFehler, setZeitlimitFehler] = useState('');
  const zeitlimitInBearbeitung = useRef(false);
  const [jetzt, setJetzt] = useState(Date.now);
  const ausgabe = useRef<HTMLPreElement>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  const endeVerfolgen = useRef(true);
  const [amEnde, setAmEnde] = useState(true);
  const [pruefanfrage, setPruefanfrage] = useState(0);
  const titelId = useId(),
    hinweisId = useId(),
    startGrundId = useId();
  const optionenGrundId = useId(),
    statusId = useId(),
    ausgabeId = useId();
  const tabsId = useId();

  useEffect(() => {
    if (aktiv) {
      setAnsicht('uebersicht');
      requestAnimationFrame(() => {
        if (inhalt.current) inhalt.current.scrollTop = 0;
      });
    }
  }, [aktiv]);

  useEffect(() => {
    if (aktiv || !zeitlimitInBearbeitung.current) {
      setZeitlimitEntwurf(String(aktiv ? zustand.optionen.zeitlimitSekunden : optionen.zeitlimitSekunden));
      setZeitlimitFehler('');
    }
  }, [optionen.zeitlimitSekunden, zustand.optionen.zeitlimitSekunden, aktiv]);

  useEffect(() => {
    if (!aktiv || !zustand.gestartetAm) return;
    setJetzt(Date.now());
    const timer = setInterval(() => setJetzt(Date.now()), 500);
    return () => clearInterval(timer);
  }, [aktiv, zustand.gestartetAm]);

  useLayoutEffect(() => {
    if (!zustand.ausgabe) {
      endeVerfolgen.current = true;
      setAmEnde(true);
    }
    if (ausgabe.current && endeVerfolgen.current) ausgabe.current.scrollTop = ausgabe.current.scrollHeight;
  }, [zustand.ausgabe, zustand.laufId, ansicht]);

  useEffect(() => {
    const element = ausgabe.current;
    if (!element) return;
    const beobachter = new ResizeObserver(() => {
      if (endeVerfolgen.current) element.scrollTop = element.scrollHeight;
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);

  const zeitlimit = zeitlimitAusText(zeitlimitEntwurf);
  const startGrund = aktiv
    ? 'Es ist bereits ein Lauf aktiv. Stoppe ihn oder warte auf sein Ende.'
    : gesperrt
      ? 'Bitte schließe zuerst den aktuellen Vorgang ab.'
      : !optionen.basisVerzeichnis?.trim()
        ? 'Wähle vor dem Start einen Basisordner aus.'
        : zeitlimit === null
          ? 'Gib ein ganzzahliges Zeitlimit von 1 bis 28800 Sekunden ein.'
          : null;
  const vorschau = zustand.business?.vorschau;
  const spalten = Array.isArray(vorschau?.spalten)
    ? (vorschau.spalten as { name: string; typ: string }[])
    : [];
  const zeilen = Array.isArray(vorschau?.zeilen) ? (vorschau.zeilen as unknown[][]).slice(0, 200) : [];
  const aktuellerSchritt = zustand.business?.schrittnamen?.[zustand.business?.schritt ?? ''];
  const fortschritt = [...(zustand.business?.ereignisse ?? [])]
    .reverse()
    .find(
      (e) =>
        e.art === 'fortschritt' &&
        e.einheit === 'Dateien' &&
        typeof e.erledigt === 'number' &&
        Number.isSafeInteger(e.erledigt) &&
        e.erledigt >= 0,
    );
  const hatTechnik = Boolean(
    zustand.quelltext || zustand.technischeMeldung || zustand.zeilenZuordnung.length,
  );
  const summen = zustand.business?.bericht?.summen as Record<string, unknown> | undefined;
  const zaehler = (
    [
      ['verarbeitet', 'Dateien fertig'],
      ['uebersprungen', 'Übersprungen'],
      ['geplant', 'Geplant'],
      ['fehlerhaft', 'Fehlermeldungen'],
    ] as const
  ).filter(
    ([id]) =>
      typeof summen?.[id] === 'number' && Number.isSafeInteger(summen[id]) && (summen[id] as number) >= 0,
  );

  function ansichtWechseln(neu: Laufansicht) {
    setAnsicht(neu);
    if (inhalt.current) inhalt.current.scrollTop = 0;
  }
  function zeitlimitAendern(text: string) {
    setZeitlimitEntwurf(text);
    setZeitlimitFehler('');
    const wert = zeitlimitAusText(text);
    if (wert !== null && wert !== optionen.zeitlimitSekunden)
      props.optionenAendern({ ...optionen, zeitlimitSekunden: wert });
  }
  function zeitlimitAbschliessen() {
    zeitlimitInBearbeitung.current = false;
    const wert = zeitlimitAusText(zeitlimitEntwurf);
    setZeitlimitFehler(wert === null ? 'Gib eine ganze Zahl zwischen 1 und 28800 ein.' : '');
    if (wert !== null) setZeitlimitEntwurf(String(wert));
  }
  function ausgabeScrollen() {
    if (!ausgabe.current) return;
    const unten = ausgabeIstAmEnde(ausgabe.current);
    endeVerfolgen.current = unten;
    setAmEnde(unten);
  }
  const fehler = (
    <>
      {zustand.fehlerZeile !== null && (
        <p className="testbereich-fehler">
          Fehler in {sprache.kurzbezeichnung}-Zeile {zustand.fehlerZeile}.
        </p>
      )}
      {zustand.fehlerBlockId && (
        <Knopf symbol="bausteine" onClick={() => props.blockAnzeigen(zustand.fehlerBlockId!)}>
          Baustein anzeigen
        </Knopf>
      )}
    </>
  );

  return (
    <section className="testbereich" data-testid="test-panel" aria-labelledby={titelId}>
      <div className="lauf-kopfleiste">
        <div className="lauf-tabs" role="tablist" aria-label="Ansichten des Laufs">
          {laufansichten.map((tab, index) => (
            <button
              type="button"
              key={tab.id}
              id={`${tabsId}-${tab.id}`}
              role="tab"
              aria-selected={ansicht === tab.id}
              aria-controls={`${tabsId}-panel-${tab.id}`}
              tabIndex={ansicht === tab.id ? 0 : -1}
              onClick={() => ansichtWechseln(tab.id)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const ziel =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? laufansichten.length - 1
                      : (index + (event.key === 'ArrowRight' ? 1 : -1) + laufansichten.length) %
                        laufansichten.length;
                ansichtWechseln(laufansichten[ziel].id);
                document.getElementById(`${tabsId}-${laufansichten[ziel].id}`)?.focus();
              }}
            >
              {tab.text}
            </button>
          ))}
        </div>
        <header className={`testbereich-kopf ${fokussierteVorbereitung ? 'ist-vorbereitung' : ''}`}>
          <h2 id={titelId} className="sl-nur-vorlesen">
            Läufe
          </h2>
          <div id={statusId} className="testbereich-status" hidden={fokussierteVorbereitung}>
            <Statusanzeige art={statusArt(zustand)}>
              <strong>{hatLauf ? phasen[zustand.phase] : 'Noch kein Lauf'}</strong>
            </Statusanzeige>
          </div>
          <p className="testbereich-modus" hidden={fokussierteVorbereitung}>
            <strong>{vorbereitung && !aktiv ? 'Nächster Lauf' : 'Modus dieses Laufs'}:</strong>{' '}
            {modusName(anzeigeOptionen)}
          </p>
          <div className="knopfgruppe testbereich-aktionen">
            {aktiv ? (
              <Knopf
                symbol="stoppen"
                variante="gefahr"
                onClick={props.stoppen}
                disabled={zustand.phase === 'stoppt'}
                grundId={statusId}
              >
                Stoppen
              </Knopf>
            ) : (
              <Knopf
                variante="primaer"
                symbol={vorbereitung ? 'testen' : 'neu'}
                onClick={() => {
                  if (vorbereitung) {
                    setPruefanfrage((wert) => wert + 1);
                    props.starten();
                  } else ansichtWechseln('vorbereitung');
                }}
                disabled={vorbereitung ? Boolean(startGrund) : gesperrt}
                grundId={vorbereitung ? startGrundId : optionenGrundId}
              >
                {vorbereitung
                  ? startName(optionen)
                  : zustand.phase === 'fehlgeschlagen'
                    ? 'Vorbereitung prüfen'
                    : 'Neuen Lauf vorbereiten'}
              </Knopf>
            )}
          </div>
        </header>
      </div>
      <div ref={inhalt} className="testbereich-inhalt">
        {veraltet && hatLauf && (
          <Statusanzeige art="hinweis">
            Der Workflow wurde seit diesem Lauf geändert. Die Ergebnisse gehören zum angezeigten früheren
            Stand.
          </Statusanzeige>
        )}
        <section
          role="tabpanel"
          id={`${tabsId}-panel-vorbereitung`}
          aria-labelledby={`${tabsId}-vorbereitung`}
          hidden={!vorbereitung}
          className="lauf-panel testbereich-vorbereitung"
          tabIndex={0}
        >
          <h3 className="sl-nur-vorlesen">{aktiv ? 'Ein Lauf ist aktiv' : 'Nächsten Lauf vorbereiten'}</h3>
          {props.workflowInfo && (
            <p className="lauf-standkurz" title={props.workflowInfo.name}>
              <strong>Workflowstand:</strong>{' '}
              {props.workflowInfo.geaendert
                ? 'Aktueller Editorstand · ungespeicherte Änderungen'
                : 'Aktueller gespeicherter Stand'}
            </p>
          )}
          <p
            className="testbereich-wirkung"
            id={hinweisId}
            data-modus={anzeigeOptionen.business?.modus ?? 'ausfuehren'}
            hidden={Boolean(props.businessVorbereitung) && anzeigeOptionen.business?.modus === 'prueflauf'}
          >
            {anzeigeOptionen.business?.modus === 'vorschau'
              ? 'Höchstens 200 Zeilen und 256 KiB, ohne Zieländerungen.'
              : anzeigeOptionen.business?.modus === 'prueflauf'
                ? 'Prüft unterstützte Schritte und plant Dateiaktionen.'
                : 'Dateiänderungen werden tatsächlich vorgenommen. Stoppen macht sie nicht rückgängig.'}
          </p>
          {aktiv && (
            <p>
              Die Vorbereitung eines weiteren Laufs ist bis zum Laufende gesperrt. Die Übersicht zeigt den
              verwendeten Stand und seine Optionen.
            </p>
          )}
          <fieldset className="testbereich-konfiguration" disabled={aktiv || gesperrt}>
            <legend className="sl-nur-vorlesen">Einstellungen für den nächsten Lauf</legend>
            <div className="lauf-vorbereitung-business">
              <VorbereitungsPruefung.Provider
                value={pruefanfrage + (zustand.phase === 'fehlgeschlagen' ? 1 : 0)}
              >
                {props.businessVorbereitung}
              </VorbereitungsPruefung.Provider>
            </div>
            <div className="lauf-vorbereitung-ordner">
              <Textfeld
                beschriftung={aktiv ? 'Basisordner dieses Laufs' : 'Basisordner für den nächsten Lauf'}
                value={(aktiv ? laufOptionen : optionen).basisVerzeichnis ?? ''}
                placeholder="Wähle einen Basisordner aus."
                readOnly
                rows={2}
                spellCheck={false}
              />
              <Knopf
                symbol="oeffnen"
                onClick={props.ordnerWaehlen}
                disabled={aktiv || gesperrt}
                grundId={optionenGrundId}
              >
                Ordner auswählen
              </Knopf>
              <details className="lauf-zeitlimit">
                <summary>Zeitlimit: {zeitlimit === null ? 'Angabe prüfen' : `${zeitlimit} s`}</summary>
                <Feld
                  beschriftung="Zeitlimit in Sekunden"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={28800}
                  step={1}
                  value={zeitlimitEntwurf}
                  disabled={aktiv || gesperrt}
                  onFocus={() => {
                    zeitlimitInBearbeitung.current = true;
                  }}
                  onChange={(e) => zeitlimitAendern(e.target.value)}
                  onBlur={zeitlimitAbschliessen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  fehler={zeitlimitFehler}
                />
                <p className="testbereich-hilfe">
                  1 bis 28800 Sekunden. Nach Ablauf wird der Prozess beendet.
                </p>
              </details>
              <p id={startGrundId} className="testbereich-startgrund" hidden={!startGrund}>
                {startGrund}
              </p>
              <p id={optionenGrundId} className="testbereich-hilfe">
                {aktiv
                  ? 'Basisordner und Zeitlimit bleiben während dieses Laufs unverändert.'
                  : gesperrt
                    ? 'Bitte warte, bis der aktuelle Vorgang abgeschlossen ist.'
                    : 'Relative Dateipfade verwenden diesen Ordner.'}
              </p>
              {props.sprache === 'python' &&
                props.pythonStatus?.zustand !== 'bereit' &&
                props.pythonEinrichten && (
                  <details
                    className="lauf-laufzeit"
                    open={
                      props.pythonStatus?.zustand === 'fehlt' || props.pythonStatus?.zustand === 'fehler'
                        ? true
                        : undefined
                    }
                  >
                    <summary>Laufzeitumgebung</summary>
                    <p className="testbereich-hilfe">
                      {props.pythonStatus?.meldung ?? 'Die Python-Laufzeit wird vor dem Start geprüft.'}
                    </p>
                    <Knopf onClick={props.pythonEinrichten}>Python einrichten</Knopf>
                  </details>
                )}
              {!props.businessVorbereitung && (
                <details className="lauf-sicherheit">
                  <summary>Wirkung der Ausführung</summary>
                  <p className="testbereich-hilfe">
                    Keine Sandbox. Stoppen macht Änderungen nicht rückgängig. Ein neuer Lauf verwendet den
                    vollständigen aktuellen Workflow.
                  </p>
                </details>
              )}
            </div>
          </fieldset>
        </section>
        <section
          role="tabpanel"
          id={`${tabsId}-panel-uebersicht`}
          aria-labelledby={`${tabsId}-uebersicht`}
          hidden={ansicht !== 'uebersicht'}
          className="lauf-panel"
          tabIndex={0}
        >
          {!hatLauf ? (
            <div className="lauf-leerzustand">
              <h3>Für diesen Workflow gibt es noch keine Läufe.</h3>
              <p>Prüfe Modus, Basisordner und Zeitlimit unter „Vorbereitung“ und starte den Lauf bewusst.</p>
              <Knopf onClick={() => ansichtWechseln('vorbereitung')}>Lauf vorbereiten</Knopf>
            </div>
          ) : (
            <>
              <h3>{aktiv ? (aktuellerSchritt ?? 'Aktueller Lauf') : 'Ergebnis des letzten Laufs'}</h3>
              <p>{zustand.meldung || phasen[zustand.phase]}</p>
              {aktiv && fortschritt && (
                <p className="lauf-fortschritt">
                  {fortschritt.erledigt as number}
                  {typeof fortschritt.gesamt === 'number' &&
                  Number.isSafeInteger(fortschritt.gesamt) &&
                  fortschritt.gesamt >= (fortschritt.erledigt as number)
                    ? ` von ${fortschritt.gesamt}`
                    : ''}{' '}
                  Dateien verarbeitet
                </p>
              )}
              {zaehler.length > 0 && (
                <dl className="lauf-zaehler">
                  {zaehler.map(([id, text]) => (
                    <div key={id}>
                      <dt>{text}</dt>
                      <dd>{(summen![id] as number).toLocaleString('de-DE')}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {fehler}
              <div className="knopfgruppe umbrechen">
                <Knopf onClick={() => ansichtWechseln('ergebnisse')}>Ergebnisse prüfen</Knopf>
                <Knopf variante="leise" onClick={() => ansichtWechseln('protokoll')}>
                  Protokoll öffnen
                </Knopf>
              </div>
              <details className="testbereich-laufdetails">
                <summary>Laufstand und technische Angaben</summary>
                <dl className="testbereich-metadaten">
                  <div>
                    <dt>Workflow dieses Laufs</dt>
                    <dd>{zustand.projektName ?? 'Nicht verfügbar'}</dd>
                  </div>
                  <div>
                    <dt>Skriptsprache</dt>
                    <dd>{sprache.bezeichnung}</dd>
                  </div>
                  <div>
                    <dt>Modus</dt>
                    <dd>{modusName(laufOptionen)}</dd>
                  </div>
                  <div>
                    <dt>Parametersatz</dt>
                    <dd>
                      {laufOptionen.business?.parametersatz === 'test'
                        ? 'Testdaten'
                        : laufOptionen.business?.parametersatz === 'echt'
                          ? 'Echte Daten'
                          : 'Kein Business-Parametersatz'}
                    </dd>
                  </div>
                  <div>
                    <dt>Gestartet</dt>
                    <dd>{zeitpunktAnzeigen(zustand.gestartetAm)}</dd>
                  </div>
                  <div>
                    <dt>Laufzeit</dt>
                    <dd>{laufzeitAnzeigen(zustand.gestartetAm, zustand.beendetAm, jetzt)}</dd>
                  </div>
                  <div>
                    <dt>Exitcode</dt>
                    <dd>
                      {zustand.exitcode === null
                        ? aktiv
                          ? 'Noch nicht vorhanden'
                          : 'Nicht vorhanden'
                        : zustand.exitcode}
                    </dd>
                  </div>
                  {zustand.pythonVersion && (
                    <div>
                      <dt>Python-Version dieses Laufs</dt>
                      <dd>{zustand.pythonVersion}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Lauf-ID</dt>
                    <dd>
                      <code>{zustand.laufId ?? 'Noch nicht vorhanden'}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Standkennung</dt>
                    <dd>
                      <code>{zustand.standHash ?? 'Nicht verfügbar'}</code>
                    </dd>
                  </div>
                  <div className="testbereich-dateikontext">
                    <dt>Basisordner dieses Laufs</dt>
                    <dd>
                      {laufOptionen.basisVerzeichnis ?? 'Nicht verfügbar'} · Zeitlimit{' '}
                      {laufOptionen.zeitlimitSekunden} s
                    </dd>
                  </div>
                </dl>
                <p className="testbereich-hilfe">Frühere Läufe werden hier nicht dauerhaft gespeichert.</p>
              </details>
            </>
          )}
        </section>
        <section
          role="tabpanel"
          id={`${tabsId}-panel-ergebnisse`}
          aria-labelledby={`${tabsId}-ergebnisse`}
          hidden={ansicht !== 'ergebnisse'}
          className="lauf-panel"
          tabIndex={0}
        >
          <h3>Ergebnisse dieses Laufs</h3>
          {!hatLauf ? (
            <p>Für diesen Workflow gibt es noch keine Läufe. Bereite zuerst einen Lauf vor.</p>
          ) : !zustand.business ? (
            <>
              <p>
                Dieser Lauf liefert Textausgaben. Im Protokoll kannst du die gemeldeten Ergebnisse und
                mögliche Fehler lesen.
              </p>
              <Knopf onClick={() => ansichtWechseln('protokoll')}>Protokoll öffnen</Knopf>
            </>
          ) : (
            <>
              <BusinessErgebnis
                business={zustand.business}
                optionen={laufOptionen}
                aktiv={aktiv}
                kontextZeigen={false}
              />
              {vorschau && (
                <div className="business-vorschau" tabIndex={0} aria-label="Begrenzte Datenvorschau">
                  <h3>Datenvorschau · {zeilen.length} angezeigte Zeilen</h3>
                  <p>
                    {vorschau.gekuerzt || vorschau.abgeschnitten || vorschau.zellen_gekuerzt
                      ? 'Begrenzter Ausschnitt: Weitere Zeilen oder lange Zelltexte wurden nicht angezeigt.'
                      : 'Begrenzte Abfrage; die Vorschau ist kein vollständiger fachlicher Nachweis.'}
                  </p>
                  <p>
                    Die Vorschau zeigt höchstens 200 Zeilen. Die Gesamtzahl der Quelldaten ist hier nicht
                    bekannt.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        {spalten.map((s) => (
                          <th key={s.name} scope="col">
                            {s.name}
                            <br />
                            <span className="metadaten">{s.typ}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {zeilen.map((z, i) => (
                        <tr key={i}>
                          {z.map((w, n) => (
                            <td key={n}>{w === null ? '(leer)' : String(w)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {zustand.business.bericht && (
                <details className="testbereich-details">
                  <summary>Vollständiger Laufbericht</summary>
                  <pre tabIndex={0}>{JSON.stringify(zustand.business.bericht, null, 2)}</pre>
                </details>
              )}
            </>
          )}
        </section>
        <section
          role="tabpanel"
          id={`${tabsId}-panel-protokoll`}
          aria-labelledby={`${tabsId}-protokoll`}
          hidden={ansicht !== 'protokoll'}
          className="lauf-panel lauf-protokoll"
          tabIndex={0}
        >
          <div className="testbereich-ausgabekopf">
            <h3>Protokoll dieses Laufs</h3>
            <div className="knopfgruppe">
              <Knopf
                variante="leise"
                symbol="kopieren"
                onClick={props.kopieren}
                disabled={!zustand.ausgabe}
                grundId={ausgabeId}
              >
                Ausgabe kopieren
              </Knopf>
              <Knopf
                variante="leise"
                symbol="loeschen"
                onClick={props.leeren}
                disabled={!zustand.ausgabe}
                grundId={ausgabeId}
              >
                Ausgabe leeren
              </Knopf>
            </div>
          </div>
          <pre
            ref={ausgabe}
            id={ausgabeId}
            className="testbereich-ausgabe"
            role="log"
            aria-label="Laufprotokoll"
            aria-live="off"
            tabIndex={0}
            onScroll={ausgabeScrollen}
          >
            {zustand.ausgabe || 'Noch keine Ausgabe.'}
          </pre>
          {!amEnde && (
            <Knopf
              variante="leise"
              onClick={() => {
                if (ausgabe.current) ausgabe.current.scrollTop = ausgabe.current.scrollHeight;
                endeVerfolgen.current = true;
                setAmEnde(true);
              }}
            >
              Zum Ausgabeende
            </Knopf>
          )}
          {zustand.abgeschnitteneZeichen > 0 && (
            <p className="testbereich-hilfe">
              Die Ausgabe wurde begrenzt. {zustand.abgeschnitteneZeichen.toLocaleString('de-DE')} Zeichen
              werden nicht angezeigt.
            </p>
          )}
          {hatTechnik && (
            <details className="testbereich-details">
              <summary>Technische Details</summary>
              {zustand.technischeMeldung && (
                <>
                  <h3>Technische Meldungen</h3>
                  <pre tabIndex={0} aria-label="Technisches Laufprotokoll">
                    {zustand.technischeMeldung}
                  </pre>
                </>
              )}
              {zustand.quelltext && (
                <>
                  <h3>Quelltext dieses Laufs</h3>
                  <p>Schreibgeschützter Stand des angezeigten Laufs.</p>
                  <pre tabIndex={0} aria-label="Quelltext des Laufs">
                    {zustand.quelltext}
                  </pre>
                </>
              )}
              {zustand.zeilenZuordnung.length > 0 && (
                <>
                  <h3>Zuordnung zu Bausteinen</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>{sprache.kurzbezeichnung}-Zeilen</th>
                        <th>Baustein-ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zustand.zeilenZuordnung.map((eintrag, index) => (
                        <tr key={`${eintrag.von}-${eintrag.bis}-${eintrag.blockId}-${index}`}>
                          <td>
                            {eintrag.von === eintrag.bis ? eintrag.von : `${eintrag.von}–${eintrag.bis}`}
                          </td>
                          <td>
                            <code>{eintrag.blockId}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </details>
          )}
        </section>
      </div>
    </section>
  );
}
