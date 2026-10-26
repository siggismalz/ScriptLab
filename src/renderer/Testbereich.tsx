import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { testAktiv, type TestOptionen, type TestPhase, type TestZustand } from '../gemeinsam/testlauf';
import { Feld, Textfeld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { Symbol } from './komponenten/Icon';
import { Statusanzeige, type StatusArt } from './komponenten/Statusanzeige';
import './testbereich.css';
import { sprachdaten, type Skriptsprache } from '../kern/sprachen';
import type { PythonStatus } from '../gemeinsam/python';
import type { ReactNode } from 'react';

export interface TestbereichEigenschaften {
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
  vorbereitung: 'Test wird vorbereitet',
  laeuft: 'Test läuft',
  stoppt: 'Test wird gestoppt',
  beendet: 'Test beendet',
  mit_fehlern: 'Mit Fehlern beendet',
  fehlgeschlagen: 'Test fehlgeschlagen',
  abgebrochen: 'Test abgebrochen',
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

/** Ausschließlich Darstellung und Benutzerereignisse. Der Hauptprozess besitzt den Testlauf. */
export function Testbereich(props: TestbereichEigenschaften) {
  const { zustand, optionen, veraltet, gesperrt = false } = props;
  const aktiv = testAktiv(zustand.phase);
  const sprache = sprachdaten[zustand.skriptsprache ?? props.sprache ?? 'vbs'];
  const vorschau = zustand.business?.vorschau;
  const spalten = Array.isArray(vorschau?.spalten)
    ? (vorschau.spalten as { name: string; typ: string }[])
    : [];
  const zeilen = Array.isArray(vorschau?.zeilen) ? (vorschau.zeilen as unknown[][]) : [];
  const anzeigeOptionen = aktiv ? zustand.optionen : optionen;
  const [zeitlimitEntwurf, setZeitlimitEntwurf] = useState(String(anzeigeOptionen.zeitlimitSekunden));
  const [zeitlimitFehler, setZeitlimitFehler] = useState('');
  const zeitlimitInBearbeitung = useRef(false);
  const [jetzt, setJetzt] = useState(Date.now);
  const ausgabe = useRef<HTMLPreElement>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  const endeVerfolgen = useRef(true);
  const [amEnde, setAmEnde] = useState(true);
  const titelId = useId();
  const hinweisId = useId();
  const startGrundId = useId();
  const optionenGrundId = useId();
  const statusId = useId();
  const ausgabeId = useId();
  const [konfigurationOffen, setKonfigurationOffen] = useState(!zustand.laufId);

  useEffect(() => {
    if (aktiv) {
      setKonfigurationOffen(false);
      requestAnimationFrame(() => {
        if (inhalt.current) inhalt.current.scrollTop = 0;
      });
    }
  }, [aktiv]);

  useEffect(() => {
    if (aktiv || !zeitlimitInBearbeitung.current) {
      setZeitlimitEntwurf(String(anzeigeOptionen.zeitlimitSekunden));
      setZeitlimitFehler('');
    }
    if (aktiv) zeitlimitInBearbeitung.current = false;
  }, [anzeigeOptionen.zeitlimitSekunden, aktiv]);

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
  }, [zustand.ausgabe, zustand.laufId]);

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
    ? 'Es ist bereits ein Test aktiv. Stoppe ihn oder warte auf sein Ende.'
    : gesperrt
      ? 'Bitte schließe zuerst den aktuellen Vorgang ab.'
      : !optionen.basisVerzeichnis?.trim()
        ? 'Wähle vor dem Test einen Basisordner aus.'
        : zeitlimit === null
          ? 'Gib ein ganzzahliges Zeitlimit von 1 bis 28800 Sekunden ein.'
          : null;
  const hatKontext = Boolean(zustand.laufId || zustand.projektName || zustand.standHash);
  const hatDetails = Boolean(
    hatKontext || zustand.quelltext || zustand.technischeMeldung || zustand.zeilenZuordnung.length,
  );

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

  return (
    <section className="testbereich" data-testid="test-panel" aria-labelledby={titelId}>
      <header className="panel-kopf testbereich-kopf">
        <h2 id={titelId}>Testausgabe</h2>
        <span className="skriptsprache-kennzeichen" aria-label="Skriptsprache des Tests">
          {sprache.bezeichnung}
        </span>
        <div className="knopfgruppe testbereich-aktionen">
          <Knopf
            variante="standard"
            symbol="testen"
            onClick={props.starten}
            disabled={Boolean(startGrund)}
            grundId={aktiv ? statusId : startGrundId}
          >
            {optionen.business?.modus === 'vorschau'
              ? 'Datenvorschau laden'
              : optionen.business?.modus === 'prueflauf'
                ? 'Prüflauf starten'
                : 'Workflow testen'}
          </Knopf>
          <Knopf
            symbol="stoppen"
            variante="gefahr"
            onClick={props.stoppen}
            disabled={!aktiv || zustand.phase === 'stoppt'}
            grundId={statusId}
          >
            Stoppen
          </Knopf>
          <Knopf
            variante="leise"
            symbol="schliessen"
            aria-label="Testbereich schließen"
            title="Testbereich schließen"
            onClick={props.schliessen}
          />
        </div>
      </header>
      <div ref={inhalt} className="testbereich-inhalt">
        <p className="testbereich-wirkung" id={hinweisId}>
          <Symbol name="hinweis" />
          <span>
            {optionen.business?.modus === 'vorschau'
              ? 'Die Datenvorschau liest begrenzte Daten und führt keine Zieländerungen aus.'
              : optionen.business?.modus === 'prueflauf'
                ? 'Der Prüflauf plant Dateiaktionen und verändert keine fachlichen Ziele.'
                : 'Der Test führt deinen Workflow auf diesem Computer aus. Dateiänderungen werden tatsächlich vorgenommen.'}
          </span>
        </p>
        <p className="testbereich-kontextkurz">
          {aktiv ? 'Basis dieses Tests' : 'Nächster Test'}:{' '}
          {anzeigeOptionen.basisVerzeichnis
            ? anzeigeOptionen.basisVerzeichnis.length > 140
              ? `${anzeigeOptionen.basisVerzeichnis.slice(0, 60)} … ${anzeigeOptionen.basisVerzeichnis.slice(-70)}`
              : anzeigeOptionen.basisVerzeichnis
            : 'Noch keinen Basisordner gewählt'}{' '}
          · Zeitlimit {anzeigeOptionen.zeitlimitSekunden} s
        </p>
        <div className={`testbereich-arbeitsinhalt ${konfigurationOffen ? 'mit-konfiguration' : ''}`}>
          <div className="testbereich-ergebnis">
            {vorschau && (
              <div className="business-vorschau" tabIndex={0} aria-label="Begrenzte Datenvorschau">
                <h3>Datenvorschau · {zeilen.length} angezeigte Zeilen</h3>
                <p>
                  {vorschau.gekuerzt || vorschau.abgeschnitten || vorschau.zellen_gekuerzt
                    ? 'Begrenzter Ausschnitt: Weitere Zeilen oder lange Zelltexte wurden nicht angezeigt.'
                    : 'Begrenzte Abfrage; die Vorschau ist kein vollständiger fachlicher Nachweis.'}
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
            {zustand.business?.bericht && (
              <details>
                <summary>Laufbericht und erzeugte Ergebnisse</summary>
                <pre>{JSON.stringify(zustand.business.bericht, null, 2)}</pre>
              </details>
            )}
            <div className="testbereich-ausgabekopf">
              <div id={statusId} className="testbereich-status">
                <Statusanzeige art={statusArt(zustand)}>
                  <strong>{phasen[zustand.phase]}</strong>
                  {zustand.meldung ? ` · ${zustand.meldung}` : ''}
                </Statusanzeige>
              </div>
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
              aria-label="Testausgabe"
              aria-live="off"
              aria-describedby={hinweisId}
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
            {veraltet && (
              <Statusanzeige art="hinweis">
                Der Workflow wurde seit diesem Test geändert. Die Ausgabe gehört zum angezeigten früheren
                Stand.
              </Statusanzeige>
            )}
            {hatDetails && (
              <details className="testbereich-details">
                <summary>Laufdetails und Technik</summary>
                {hatKontext && (
                  <dl className="testbereich-metadaten">
                    <div>
                      <dt>Projekt des Tests</dt>
                      <dd>{zustand.projektName ?? 'Nicht verfügbar'}</dd>
                    </div>
                    <div>
                      <dt>Skriptsprache</dt>
                      <dd>{sprache.bezeichnung}</dd>
                    </div>
                    {zustand.pythonVersion && (
                      <div>
                        <dt>Python-Version dieses Tests</dt>
                        <dd>{zustand.pythonVersion}</dd>
                      </div>
                    )}
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
                      <dt>Basisordner dieses Tests</dt>
                      <dd>
                        {zustand.optionen.basisVerzeichnis ?? 'Nicht verfügbar'} · Zeitlimit{' '}
                        {zustand.optionen.zeitlimitSekunden} s
                      </dd>
                    </div>
                  </dl>
                )}
                {zustand.technischeMeldung && (
                  <>
                    <h3>Technische Meldungen</h3>
                    <pre tabIndex={0} aria-label="Technisches Testprotokoll">
                      {zustand.technischeMeldung}
                    </pre>
                  </>
                )}
                {zustand.quelltext && (
                  <>
                    <h3>Quelltext dieses Tests</h3>
                    <p>Schreibgeschützter Stand des angezeigten Tests.</p>
                    <pre tabIndex={0} aria-label="Quelltext des Tests">
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
          </div>
          <details
            className="testbereich-vorbereitung"
            open={konfigurationOffen}
            onToggle={(e) => setKonfigurationOffen(e.currentTarget.open)}
          >
            <summary>{aktiv ? 'Optionen dieses Tests' : 'Test vorbereiten'}</summary>
            <div className="testbereich-konfiguration" aria-label="Test vorbereiten">
              {props.businessVorbereitung}
              <Textfeld
                beschriftung={aktiv ? 'Basisordner des laufenden Tests' : 'Basisordner für den nächsten Test'}
                value={anzeigeOptionen.basisVerzeichnis ?? ''}
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
              {startGrund && !aktiv && (
                <p id={startGrundId} className="testbereich-startgrund">
                  {startGrund}
                </p>
              )}
              <p id={optionenGrundId} className="testbereich-hilfe">
                {aktiv
                  ? 'Basisordner und Zeitlimit bleiben während dieses Tests unverändert.'
                  : gesperrt
                    ? 'Bitte warte, bis der aktuelle Vorgang abgeschlossen ist.'
                    : 'Relative Pfade verwenden diesen Ordner. Zeitlimit: 1 bis 28800 s; das gewählte Laufprofil bleibt sichtbar.'}
              </p>
              {props.sprache === 'python' &&
                props.pythonStatus?.zustand !== 'bereit' &&
                props.pythonEinrichten && (
                  <>
                    <p className="testbereich-hilfe">
                      Für Python-Tests muss ein geeigneter Interpreter eingerichtet und geprüft sein.
                    </p>
                    <Knopf onClick={props.pythonEinrichten}>Python einrichten</Knopf>
                  </>
                )}
              <p className="testbereich-hilfe">
                Keine Sandbox. Stoppen macht Änderungen nicht rückgängig. Ein neuer Test verwendet den
                vollständigen aktuellen Workflow.
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
