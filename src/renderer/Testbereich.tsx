import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { testAktiv, type TestOptionen, type TestPhase, type TestZustand } from '../gemeinsam/testlauf';
import { Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { Statusanzeige, type StatusArt } from './komponenten/Statusanzeige';
import './testbereich.css';
import type { Skriptsprache } from '../kern/sprachen';
import type { PythonStatus } from '../gemeinsam/python';
import type { ReactNode } from 'react';
import { BusinessErgebnis } from './BusinessErgebnis';
import { MlErgebnis } from './MlErgebnis';
import { businessOptionenVorbereiten, VorbereitungsPruefung } from './BusinessVorbereitung';

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
  historisch?: boolean;
  vorbereitungAnfordern?: number;
  uebersichtAnfordern?: number;
  neuenLaufVorbereiten?: () => void;
  protokollSpeichern?: () => void;
  dateiAnzeigen?: (art: 'ausgabe' | 'bericht', index?: number) => Promise<void>;
  kopfNavigation?: ReactNode;
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

/** Der Hauptprozess besitzt den Lauf; das Öffnen von Ergebnis oder Einstellungen führt nichts aus. */
export function Testbereich(props: TestbereichEigenschaften) {
  const { zustand, veraltet, gesperrt = false } = props;
  const optionen = props.businessVorbereitung ? businessOptionenVorbereiten(props.optionen) : props.optionen;
  const aktiv = testAktiv(zustand.phase);
  const hatLauf = Boolean(zustand.laufId || zustand.phase !== 'bereit');
  const zeigtAusgabe = Boolean(!zustand.business || zustand.ausgabe || zustand.abgeschnitteneZeichen > 0);
  const laufOptionen = hatLauf ? zustand.optionen : optionen;
  const [vorbereitung, setVorbereitung] = useState(
    Boolean(props.vorbereitungAnfordern) && !aktiv && !props.historisch,
  );
  const [zeitlimitEntwurf, setZeitlimitEntwurf] = useState(
    String(aktiv ? zustand.optionen.zeitlimitSekunden : optionen.zeitlimitSekunden),
  );
  const [zeitlimitFehler, setZeitlimitFehler] = useState('');
  const zeitlimitInBearbeitung = useRef(false);
  const [jetzt, setJetzt] = useState(Date.now);
  const ausgabe = useRef<HTMLPreElement>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  const einstellungen = useRef<HTMLElement>(null);
  const endeVerfolgen = useRef(true);
  const [amEnde, setAmEnde] = useState(true);
  const [pruefanfrage, setPruefanfrage] = useState(0);
  const uebersichtAnfrage = useRef(props.uebersichtAnfordern);
  const titelId = useId(),
    einstellungenId = useId(),
    statusId = useId(),
    startGrundId = useId();
  const ausgabeId = useId();

  useEffect(() => {
    if (!props.vorbereitungAnfordern || aktiv || props.historisch) return;
    setVorbereitung(true);
    requestAnimationFrame(() => einstellungen.current?.focus());
  }, [props.vorbereitungAnfordern]);
  useEffect(() => {
    if (aktiv || props.historisch) setVorbereitung(false);
  }, [aktiv, props.historisch]);
  useEffect(() => {
    if (uebersichtAnfrage.current === props.uebersichtAnfordern) return;
    uebersichtAnfrage.current = props.uebersichtAnfordern;
    setVorbereitung(false);
  }, [props.uebersichtAnfordern]);
  useEffect(() => {
    if (aktiv || !zeitlimitInBearbeitung.current) {
      setZeitlimitEntwurf(String(aktiv ? zustand.optionen.zeitlimitSekunden : optionen.zeitlimitSekunden));
      setZeitlimitFehler('');
    }
  }, [optionen.zeitlimitSekunden, zustand.optionen.zeitlimitSekunden, aktiv]);
  useEffect(() => {
    if (!aktiv || !zustand.gestartetAm) return;
    const timer = setInterval(() => setJetzt(Date.now()), 500);
    return () => clearInterval(timer);
  }, [aktiv, zustand.gestartetAm]);
  useLayoutEffect(() => {
    if (!zustand.ausgabe) {
      endeVerfolgen.current = true;
      setAmEnde(true);
    }
    if (ausgabe.current && endeVerfolgen.current) ausgabe.current.scrollTop = ausgabe.current.scrollHeight;
  }, [zustand.ausgabe, zustand.laufId]);
  useEffect(() => {
    const element = ausgabe.current;
    if (!element) return;
    const beobachter = new ResizeObserver(() => {
      if (endeVerfolgen.current) element.scrollTop = element.scrollHeight;
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, [hatLauf, zeigtAusgabe]);

  const zeitlimit = zeitlimitAusText(zeitlimitEntwurf);
  const startGrund = aktiv
    ? 'Es ist bereits ein Lauf aktiv. Stoppe ihn oder warte auf sein Ende.'
    : gesperrt
      ? 'Bitte schließe zuerst den aktuellen Vorgang ab.'
      : zeitlimit === null
        ? 'Gib ein ganzzahliges Zeitlimit von 1 bis 28800 Sekunden ein.'
        : null;
  const vorschau = zustand.business?.vorschau;
  const spalten = Array.isArray(vorschau?.spalten)
    ? (vorschau.spalten as { name: string; typ: string }[])
    : [];
  const zeilen = Array.isArray(vorschau?.zeilen) ? (vorschau.zeilen as unknown[][]).slice(0, 200) : [];
  const aktuellerSchritt = zustand.business?.schrittnamen?.[zustand.business?.schritt ?? ''];
  const vorschauZiel = laufOptionen.business?.vorschauBlockId;
  const vorschauSchritt = vorschauZiel ? (zustand.business?.schrittnamen?.[vorschauZiel] ?? null) : null;

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
  function vorbereitungOeffnen() {
    if (props.historisch && props.neuenLaufVorbereiten) props.neuenLaufVorbereiten();
    else {
      setVorbereitung(!vorbereitung);
      if (!vorbereitung)
        requestAnimationFrame(() => {
          if (inhalt.current) inhalt.current.scrollTop = 0;
          einstellungen.current?.focus({ preventScroll: true });
        });
    }
  }

  return (
    <section className="testbereich" data-testid="test-panel" aria-labelledby={titelId}>
      <header className="testbereich-kopf">
        <div className="testbereich-laufkontext">
          <h2 id={titelId}>Ergebnis</h2>
          <p className="testbereich-modus">
            {hatLauf ? modusName(laufOptionen) : 'Starte die Automatisierung, um ihr Ergebnis zu sehen.'}
            {vorschauSchritt && <> bis „{vorschauSchritt}“</>}
            {props.historisch && (
              <> · Ausführung vom {zeitpunktAnzeigen(zustand.gestartetAm ?? zustand.vorbereitetAm)}</>
            )}
          </p>
        </div>
        <div className="knopfgruppe testbereich-aktionen">
          {props.kopfNavigation}
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
              variante="leise"
              symbol="einstellungen"
              onClick={vorbereitungOeffnen}
              disabled={gesperrt}
              aria-expanded={vorbereitung}
              aria-controls={einstellungenId}
            >
              {props.historisch ? 'Neuen Lauf vorbereiten' : 'Laufeinstellungen'}
            </Knopf>
          )}
        </div>
      </header>
      <div ref={inhalt} className="testbereich-inhalt">
        <section
          ref={einstellungen}
          id={einstellungenId}
          className="testbereich-vorbereitung"
          aria-label="Laufeinstellungen"
          hidden={!vorbereitung}
          tabIndex={-1}
        >
          <h3>Einstellungen für den nächsten Lauf</h3>
          <p className="testbereich-hilfe">
            Du kannst direkt ausführen oder hier vorher Parameter, Modus und Grenzen anpassen.
          </p>
          {props.workflowInfo && (
            <p className="lauf-standkurz">
              {props.workflowInfo.geaendert
                ? 'Verwendet den aktuellen Editorstand mit ungespeicherten Änderungen.'
                : 'Verwendet den aktuellen gespeicherten Stand.'}
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
              <details className="lauf-arbeitsordner">
                <summary>Arbeitsordner</summary>
                <p className="testbereich-hilfe">
                  Relative Dateipfade verwenden diesen Ordner der Automatisierung.
                </p>
                <p className="lauf-ordnerpfad">
                  {(aktiv ? laufOptionen : optionen).basisVerzeichnis ?? 'Wird von ScriptLab festgelegt.'}
                </p>
                <Knopf symbol="oeffnen" variante="leise" onClick={props.ordnerWaehlen}>
                  Im Explorer anzeigen
                </Knopf>
              </details>
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
              {props.sprache === 'python' &&
                props.pythonStatus?.zustand !== 'bereit' &&
                props.pythonEinrichten && (
                  <div className="lauf-laufzeit">
                    <p>Die benötigte Ausführungsumgebung ist noch nicht bereit.</p>
                    <Knopf onClick={props.pythonEinrichten}>Ausführung einrichten</Knopf>
                  </div>
                )}
            </div>
          </fieldset>
          <p id={startGrundId} className="testbereich-startgrund" hidden={!startGrund}>
            {startGrund}
          </p>
          <Knopf
            variante="primaer"
            symbol="testen"
            disabled={Boolean(startGrund)}
            grundId={startGrundId}
            onClick={() => {
              setPruefanfrage((wert) => wert + 1);
              props.starten();
            }}
          >
            {startName(optionen)}
          </Knopf>
        </section>

        {!hatLauf ? (
          <div className="lauf-leerzustand">
            <h3>Noch kein Ergebnis</h3>
            <p>
              Mit „Workflow ausführen“ startest du die Automatisierung direkt. Änderungen im Editor werden
              dabei berücksichtigt.
            </p>
          </div>
        ) : (
          <>
            <section className="lauf-ergebnisfokus" aria-label="Ergebnis dieses Laufs">
              <div id={statusId} className="testbereich-status">
                <Statusanzeige art={statusArt(zustand)}>
                  <strong>{phasen[zustand.phase]}</strong>
                  {zustand.meldung && zustand.meldung !== phasen[zustand.phase] && (
                    <span>{zustand.meldung}</span>
                  )}
                </Statusanzeige>
              </div>
              {veraltet && (
                <Statusanzeige art="hinweis">
                  Die Ergebnisse gehören zu einem früheren Stand. Änderungen danach sind hier noch nicht
                  enthalten.
                </Statusanzeige>
              )}
              {zustand.phase === 'stoppt' && (
                <p className="lauf-stopp-hinweis">
                  Der Stopp ist angefordert. Der Prozess ist noch nicht beendet.
                </p>
              )}
              {(laufOptionen.business?.modus === 'vorschau' ||
                laufOptionen.business?.modus === 'prueflauf' ||
                ['stoppt', 'abgebrochen', 'fehlgeschlagen', 'mit_fehlern', 'zeitlimit'].includes(
                  zustand.phase,
                )) && (
                <p className="lauf-moduserklaerung">
                  {laufOptionen.business?.modus === 'vorschau'
                    ? 'Begrenzte Datenvorschau. Zieldateien werden dabei nicht verändert.'
                    : laufOptionen.business?.modus === 'prueflauf'
                      ? 'Prüft unterstützte Schritte und plant Dateiaktionen, ohne Zieldateien zu verändern.'
                      : 'Bereits erfolgte Dateiänderungen bleiben auch nach einem Stopp bestehen.'}
                </p>
              )}
              {aktiv && aktuellerSchritt && (
                <p>
                  Aktueller Schritt: <strong>{aktuellerSchritt}</strong>
                </p>
              )}
              {zustand.gestartetAm && (
                <p className="testbereich-hilfe">
                  Dauer: {laufzeitAnzeigen(zustand.gestartetAm, zustand.beendetAm, jetzt)}
                </p>
              )}
              {zustand.fehlerBlockId && (
                <Knopf
                  symbol="bausteine"
                  onClick={() => props.blockAnzeigen(zustand.fehlerBlockId!)}
                  disabled={veraltet}
                  grund="Die Bausteinzuordnung ist für den früheren Stand nicht verfügbar."
                >
                  Baustein anzeigen
                </Knopf>
              )}
            </section>

            {zustand.business && (
              <section className="lauf-ergebnisdateien" aria-label="Dateien und Ergebnisse">
                {(zustand.workflowArt === 'ml' ||
                  zustand.business.ereignisse.some((e) => e.art === 'ml_training') ||
                  Array.isArray(zustand.business.bericht?.ml_training)) && (
                  <MlErgebnis business={zustand.business} aktiv={aktiv} />
                )}
                <BusinessErgebnis
                  key={zustand.laufId}
                  business={zustand.business}
                  optionen={laufOptionen}
                  aktiv={aktiv}
                  kontextZeigen={false}
                  dateiAnzeigen={props.dateiAnzeigen}
                  blockAnzeigen={props.blockAnzeigen}
                  blockZuordnungMoeglich={!veraltet}
                />
                {vorschau && (
                  <div className="business-vorschau" tabIndex={0} aria-label="Begrenzte Datenvorschau">
                    <h3>Datenvorschau · {zeilen.length} angezeigte Zeilen</h3>
                    <p>
                      Ein Ausschnitt mit höchstens 200 Zeilen. Die Gesamtzahl der Quelldaten ist hier nicht
                      bekannt.
                    </p>
                    {Boolean(vorschau.gekuerzt || vorschau.abgeschnitten || vorschau.zellen_gekuerzt) && (
                      <p>Weitere Zeilen oder lange Zelltexte wurden nicht angezeigt.</p>
                    )}
                    <table>
                      <thead>
                        <tr>
                          {spalten.map((s, i) => (
                            <th key={`${s.name}-${i}`} scope="col">
                              {s.name}
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
              </section>
            )}

            <section className="lauf-ausgabe" aria-label="Ausgaben dieses Laufs">
              {zeigtAusgabe && (
                <>
                  <div className="testbereich-ausgabekopf">
                    <h3>Ausgaben</h3>
                    {!props.historisch && (
                      <Knopf
                        variante="leise"
                        symbol="loeschen"
                        onClick={props.leeren}
                        disabled={!zustand.ausgabe}
                        grund="Es gibt noch keine Textausgabe."
                      >
                        Ausgabe leeren
                      </Knopf>
                    )}
                  </div>
                  <pre
                    ref={ausgabe}
                    id={ausgabeId}
                    className="testbereich-ausgabe"
                    role="log"
                    aria-label="Laufausgabe"
                    aria-live="off"
                    tabIndex={0}
                    onScroll={() => {
                      if (ausgabe.current) {
                        endeVerfolgen.current = ausgabeIstAmEnde(ausgabe.current);
                        setAmEnde(endeVerfolgen.current);
                      }
                    }}
                  >
                    {zustand.ausgabe ||
                      (aktiv
                        ? 'Sobald die Automatisierung etwas ausgibt, erscheint es hier.'
                        : 'Dieser Lauf hat keine Textausgabe gemeldet.')}
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
                      Die Ausgabe wurde begrenzt. {zustand.abgeschnitteneZeichen.toLocaleString('de-DE')}{' '}
                      Zeichen werden nicht angezeigt.
                    </p>
                  )}
                </>
              )}
              <details className="lauf-weitergeben">
                <summary>Ergebnis weitergeben</summary>
                <div className="knopfgruppe umbrechen">
                  <Knopf
                    variante="leise"
                    symbol="kopieren"
                    onClick={props.kopieren}
                    disabled={props.protokollSpeichern ? !zustand.laufId : !zustand.ausgabe}
                    grund="Für diesen Lauf liegt noch keine Ausgabe vor."
                  >
                    {props.protokollSpeichern ? 'Laufbericht kopieren' : 'Ausgabe kopieren'}
                  </Knopf>
                  {props.protokollSpeichern && (
                    <Knopf
                      variante="leise"
                      symbol="speichern"
                      onClick={props.protokollSpeichern}
                      disabled={!zustand.laufId}
                      grund="Für diesen Lauf liegt noch kein Bericht vor."
                    >
                      Laufbericht speichern
                    </Knopf>
                  )}
                </div>
              </details>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
