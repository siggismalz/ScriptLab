import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import type { Projekt } from '../kern/projekt';
import { businessSchritte } from '../kern/business';
import { businessDefinitionen, businessNachTyp } from '../kern/business-katalog';
import { parameterStandardwertVerwenden, parameterWertLesen } from '../kern/business-modell';
import { workflowPruefen } from '../kern/modell';
import type { TestZustand } from '../gemeinsam/testlauf';
import { testAktiv } from '../gemeinsam/testlauf';
import { BusinessEigenschaften } from './BusinessEigenschaften';
import { ParameterWertEingabe } from './ParameterDialog';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld } from './komponenten/Feld';
import { Symbol } from './komponenten/Icon';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './datenbereich.css';

export interface DatenbereichEigenschaften {
  projekt: Projekt;
  workspace: Blockly.WorkspaceSvg | null;
  blockId?: string | null;
  auswaehlen: (blockId: string) => void;
  blockAnzeigen?: (blockId: string) => void;
  aendern: (projekt: Projekt) => void;
  gesperrt: boolean;
  testZustand: TestZustand;
  veraltet?: boolean;
  vorschauLaden: (blockId: string) => void;
  parameterOeffnen: () => void;
}

type Spalte = { name: string; typ: string };
const zellentext = (wert: unknown): string =>
  wert === null || wert === undefined
    ? '(leer)'
    : typeof wert === 'object'
      ? JSON.stringify(wert)
      : String(wert);
const numerisch = (typ: string) => /INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL/i.test(typ);
/** Formatvorgaben bleiben am Feld; zusätzliche Beschreibungen sind gezielt aufklappbar. */
const enthaeltFormatvorgabe = (hilfe: string) =>
  /\bFormat\b|\bBeispiel\b|zum Beispiel|z\.\s?B\.|JJJJ|\.csv\b|\.xlsx\b|\bmuss\b|\berforderlich\b|\bPflicht\b/i.test(
    hilfe,
  );
const datenansichten = [
  { id: 'quellen', text: 'Quellen und Zuordnung' },
  { id: 'parameter', text: 'Parameterwerte' },
  { id: 'vorschau', text: 'Datenvorschau' },
] as const;
type Datenansicht = (typeof datenansichten)[number]['id'];

/** Konfiguration und Vorschau teilen den vorhandenen Workflow, keine eigenen Projektkopien. */
export function Datenbereich(props: DatenbereichEigenschaften) {
  const { projekt, workspace, testZustand: lauf } = props;
  const schritte = useMemo(() => businessSchritte(projekt), [projekt]);
  const meldungen = useMemo(() => workflowPruefen(projekt).meldungen, [projekt]);
  const [auswahl, setAuswahl] = useState<string | null>(props.blockId ?? null);
  const [parametersatz, setParametersatz] = useState<'standard' | 'test' | 'echt'>('test');
  const [filter, setFilter] = useState('');
  const [sortierung, setSortierung] = useState<{ spalte: number; absteigend: boolean } | null>(null);
  const [zeilenseite, setZeilenseite] = useState(0);
  const [spaltenseite, setSpaltenseite] = useState(0);
  const [spaltenbreiten, setSpaltenbreiten] = useState<Record<string, number>>({});
  const [auswahlzeile, setAuswahlzeile] = useState<number | null>(null);
  const [datenansicht, setDatenansicht] = useState<Datenansicht>('quellen');
  const ansichtenId = useId();
  const scrollbereich = useRef<HTMLDivElement>(null);
  const scrollpositionen = useRef<Partial<Record<Datenansicht, number>>>({});
  const parameterEingaben = useRef(new Set<string>());
  const laufAktiv = testAktiv(lauf.phase);
  const gesperrt = props.gesperrt || laufAktiv;
  const aktuellerLauf = lauf.projektKennung === projekt.projektKennung;
  const vorschau = aktuellerLauf ? lauf.business?.vorschau : null;
  const spalten = useMemo(
    () =>
      Array.isArray(vorschau?.spalten)
        ? vorschau.spalten.filter((s): s is Spalte =>
            Boolean(s && typeof s === 'object' && typeof s.name === 'string' && typeof s.typ === 'string'),
          )
        : [],
    [vorschau],
  );
  const zeilen = useMemo(
    () => (Array.isArray(vorschau?.zeilen) ? vorschau.zeilen.filter(Array.isArray).slice(0, 200) : []),
    [vorschau],
  );

  useEffect(() => {
    if (props.blockId && schritte.some((s) => s.id === props.blockId)) setAuswahl(props.blockId);
  }, [props.blockId, schritte]);
  useEffect(() => {
    if (!schritte.some((s) => s.id === auswahl)) setAuswahl(schritte[0]?.id ?? null);
  }, [schritte, auswahl]);
  useEffect(() => {
    setZeilenseite(0);
    setSpaltenseite(0);
    setAuswahlzeile(null);
    setSortierung(null);
  }, [vorschau]);
  useEffect(() => {
    // Persönliche Vorschaufilter gehören nicht in einen anderen Workflow.
    setFilter('');
    setParametersatz('test');
    setSpaltenbreiten({});
    setDatenansicht('quellen');
    scrollpositionen.current = {};
    setAuswahl(schritte.find((s) => s.id === props.blockId)?.id ?? schritte[0]?.id ?? null);
  }, [projekt.projektKennung]);
  useLayoutEffect(() => {
    if (scrollbereich.current) scrollbereich.current.scrollTop = scrollpositionen.current[datenansicht] ?? 0;
  }, [datenansicht]);

  const schritt = schritte.find((s) => s.id === auswahl);
  const block = auswahl ? workspace?.getBlockById(auswahl) : null;
  const definition = block
    ? businessNachTyp.get(block.type)
    : businessDefinitionen.find((d) => d.operation === schritt?.operation);
  const blockMeldungen = meldungen.filter((m) => m.blockId === auswahl);
  const geladeneZeilen = useMemo(() => {
    const suche = filter.trim().toLocaleLowerCase('de');
    const gefiltert = zeilen
      .map((werte, index) => ({ werte, index }))
      .filter((z) => !suche || z.werte.some((w) => zellentext(w).toLocaleLowerCase('de').includes(suche)));
    if (sortierung)
      gefiltert.sort((a, b) => {
        const links = a.werte[sortierung.spalte];
        const rechts = b.werte[sortierung.spalte];
        const verglichen =
          typeof links === 'number' && typeof rechts === 'number'
            ? links - rechts
            : zellentext(links).localeCompare(zellentext(rechts), 'de', { numeric: true });
        return (sortierung.absteigend ? -1 : 1) * verglichen || a.index - b.index;
      });
    return gefiltert;
  }, [zeilen, filter, sortierung]);
  const maxZeilenseite = Math.max(0, Math.ceil(geladeneZeilen.length / 50) - 1);
  const aktiveZeilenseite = Math.min(zeilenseite, maxZeilenseite);
  const maxSpaltenseite = Math.max(0, Math.ceil(spalten.length / 20) - 1);
  const aktiveSpaltenseite = Math.min(spaltenseite, maxSpaltenseite);
  const sichtbareSpalten = spalten.slice(aktiveSpaltenseite * 20, aktiveSpaltenseite * 20 + 20);

  function waehlen(id: string) {
    setAuswahl(id);
    props.auswaehlen(id);
  }
  function datenansichtWechseln(neu: Datenansicht) {
    if (scrollbereich.current) scrollpositionen.current[datenansicht] = scrollbereich.current.scrollTop;
    setDatenansicht(neu);
  }

  return (
    <section className="datenbereich" data-testid="datenbereich" aria-label="Daten und Parameter">
      <header className="daten-seitenkopf">
        <h1>Daten und Parameter</h1>
      </header>
      {gesperrt && (
        <Statusanzeige art="hinweis">
          {laufAktiv
            ? 'Während des Laufs sind Änderungen gesperrt. Die vorhandenen Daten bleiben lesbar.'
            : 'Schließe den aktuellen Vorgang ab, bevor du Daten oder Parameter änderst.'}
        </Statusanzeige>
      )}
      <nav className="daten-ansichtauswahl" role="tablist" aria-label="Ansichten für Daten und Parameter">
        {datenansichten.map((ansicht, index) => (
          <button
            key={ansicht.id}
            type="button"
            role="tab"
            id={`${ansichtenId}-${ansicht.id}`}
            aria-controls={`${ansichtenId}-panel-${ansicht.id}`}
            aria-selected={datenansicht === ansicht.id}
            tabIndex={datenansicht === ansicht.id ? 0 : -1}
            onClick={() => datenansichtWechseln(ansicht.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const ziel =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? datenansichten.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + datenansichten.length) %
                      datenansichten.length;
              datenansichtWechseln(datenansichten[ziel].id);
              document.getElementById(`${ansichtenId}-${datenansichten[ziel].id}`)?.focus();
            }}
          >
            {ansicht.text}
          </button>
        ))}
      </nav>
      <div
        ref={scrollbereich}
        className="daten-ansichten"
        onScroll={(event) => {
          if (event.currentTarget.clientHeight > 0 && !event.currentTarget.closest('[hidden]'))
            scrollpositionen.current[datenansicht] = event.currentTarget.scrollTop;
        }}
      >
        <section
          className="daten-konfiguration"
          role="tabpanel"
          id={`${ansichtenId}-panel-quellen`}
          aria-labelledby={`${ansichtenId}-quellen`}
          hidden={datenansicht !== 'quellen'}
        >
          <section className="daten-schritte" aria-label="Quellen und Verarbeitungsschritte">
            <h2>Quellen und Verarbeitung</h2>
            {schritte.length ? (
              <ul className="daten-schrittliste">
                {schritte.map((s, index) => {
                  const def = businessDefinitionen.find((d) => d.operation === s.operation);
                  const fehler = meldungen.filter((m) => m.blockId === s.id && m.stufe === 'fehler');
                  return (
                    <li key={s.id}>
                      <button
                        className="daten-schritt"
                        aria-pressed={s.id === auswahl}
                        onClick={() => waehlen(s.id)}
                      >
                        <span className="daten-schrittnummer">{index + 1}</span>
                        <span>
                          <strong>{s.bezeichnung ?? def?.name ?? 'Business-Baustein'}</strong>
                          {fehler.length > 0 && (
                            <span className="daten-schrittfehler">
                              <Symbol name="fehler" groesse={16} />
                              {fehler.length} {fehler.length === 1 ? 'Angabe prüfen' : 'Angaben prüfen'}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>Noch keine Datenquelle. Füge im Bereich „Ablauf“ einen Business-Baustein hinzu.</p>
            )}
          </section>
          <section className="daten-eigenschaften" aria-label="Datenkonfiguration">
            <h2>{schritt?.bezeichnung ?? 'Konfiguration'}</h2>
            {definition && block && workspace ? (
              <>
                {blockMeldungen.length > 0 && (
                  <div className="daten-konfigurationsfehler">
                    <h3>Angaben prüfen</h3>
                    <ul>
                      {blockMeldungen.map((m, i) => (
                        <li key={i}>{m.text}</li>
                      ))}
                    </ul>
                    <Knopf
                      variante="leise"
                      symbol="bausteine"
                      onClick={() => (props.blockAnzeigen ?? props.auswaehlen)(block.id)}
                    >
                      Baustein anzeigen
                    </Knopf>
                  </div>
                )}
                <BusinessEigenschaften
                  key={block.id}
                  ws={workspace}
                  block={block}
                  parameter={projekt.business.parameter}
                  gesperrt={gesperrt}
                  spalten={spalten.map((s) => s.name)}
                  geaendert={() =>
                    props.aendern({ ...projekt, editor: Blockly.serialization.workspaces.save(workspace) })
                  }
                />
                <details className="daten-blockhilfe">
                  <summary>Hilfe und Bausteindetails</summary>
                  <p>{definition.hilfe}</p>
                  <dl>
                    <div>
                      <dt>Aufgabe</dt>
                      <dd>{definition.gruppe}</dd>
                    </div>
                    <div>
                      <dt>Ergebnis</dt>
                      <dd>{definition.ausgabe}</dd>
                    </div>
                  </dl>
                </details>
              </>
            ) : (
              <p>
                Wähle einen Verarbeitungsschritt, um seine Quelle, Eingaben und Zuordnungen zu bearbeiten.
              </p>
            )}
          </section>
        </section>
        <section
          className="daten-parameter"
          aria-label="Workflowparameter"
          role="tabpanel"
          id={`${ansichtenId}-panel-parameter`}
          aria-labelledby={`${ansichtenId}-parameter`}
          hidden={datenansicht !== 'parameter'}
        >
          <div className="daten-abschnittskopf">
            <div>
              <h2>Workflowparameter</h2>
              <p className="daten-hilfetext">Den Parametersatz für einen Lauf wählst du unter „Läufe“.</p>
            </div>
            <Auswahlfeld
              beschriftung="Angezeigte Parameterwerte"
              value={parametersatz}
              onChange={(e) => setParametersatz(e.target.value as typeof parametersatz)}
            >
              <option value="test">Testdaten</option>
              <option value="echt">Echte Daten</option>
              <option value="standard">Standardwerte</option>
            </Auswahlfeld>
            <Knopf
              symbol="eigenschaften"
              onClick={props.parameterOeffnen}
              disabled={gesperrt}
              grund="Stoppe den Lauf vor Änderungen an Workflowparametern."
            >
              Parameter verwalten
            </Knopf>
          </div>
          {projekt.business.parameter.length ? (
            <div className="daten-parameterfelder">
              {projekt.business.parameter.map((p) => {
                const feldschluessel = `${parametersatz}-${p.name}`;
                const satzwerte =
                  parametersatz === 'standard' ? null : projekt.business.parametersaetze[parametersatz];
                const eigenerWert = satzwerte !== null && Object.hasOwn(satzwerte, p.name);
                const wert = satzwerte === null ? p.standard : parameterWertLesen(p, satzwerte);
                const wertquelle = eigenerWert
                  ? wert === null || wert === ''
                    ? 'Ohne Wert'
                    : 'Eigener Wert'
                  : 'Standardwert';
                return (
                  <div
                    className="daten-parameterfeld"
                    key={feldschluessel}
                    onChangeCapture={() => parameterEingaben.current.add(feldschluessel)}
                  >
                    <ParameterWertEingabe
                      typ={p.typ}
                      beschriftung={p.beschriftung + (p.erforderlich ? ' (Pflichtangabe)' : '')}
                      hilfe={p.hilfe && enthaeltFormatvorgabe(p.hilfe) ? p.hilfe : undefined}
                      gesperrt={gesperrt}
                      wert={wert}
                      aendern={(neu) => {
                        // Das gemeinsame Eingabefeld meldet auch Blur. Nur eine bewusste Eingabe
                        // darf den geerbten Standard als eigenen Wert im Parametersatz speichern.
                        if (!parameterEingaben.current.delete(feldschluessel) || neu === wert) return;
                        props.aendern({
                          ...projekt,
                          business:
                            parametersatz === 'standard'
                              ? {
                                  ...projekt.business,
                                  parameter: projekt.business.parameter.map((eintrag) =>
                                    eintrag.name === p.name ? { ...eintrag, standard: neu } : eintrag,
                                  ),
                                }
                              : {
                                  ...projekt.business,
                                  parametersaetze: {
                                    ...projekt.business.parametersaetze,
                                    [parametersatz]: {
                                      ...projekt.business.parametersaetze[parametersatz],
                                      [p.name]: neu,
                                    },
                                  },
                                },
                        });
                      }}
                    />
                    {satzwerte !== null && parametersatz !== 'standard' && (
                      <details className="daten-wertoptionen">
                        <summary aria-label={`Wertoptionen für ${p.beschriftung}: ${wertquelle}`}>
                          {wertquelle}
                        </summary>
                        <p>
                          Standardwert:{' '}
                          <span>
                            {p.standard === null || p.standard === ''
                              ? 'Ohne Wert'
                              : p.standard === true
                                ? 'Ja'
                                : p.standard === false
                                  ? 'Nein'
                                  : String(p.standard)}
                          </span>
                        </p>
                        {eigenerWert && (
                          <Knopf
                            variante="leise"
                            disabled={gesperrt}
                            grund="Stoppe den Lauf vor Änderungen an Parameterwerten."
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.querySelector('summary')?.focus();
                              props.aendern({
                                ...projekt,
                                business: {
                                  ...projekt.business,
                                  parametersaetze: {
                                    ...projekt.business.parametersaetze,
                                    [parametersatz]: parameterStandardwertVerwenden(satzwerte, p.name),
                                  },
                                },
                              });
                            }}
                          >
                            Standardwert verwenden
                          </Knopf>
                        )}
                      </details>
                    )}
                    {p.hilfe && !enthaeltFormatvorgabe(p.hilfe) && (
                      <details className="daten-feldhilfe">
                        <summary aria-label={`Hinweis zu ${p.beschriftung}`}>Hinweis</summary>
                        <p>{p.hilfe}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p>
              Es sind keine Workflowparameter definiert. Unter „Parameter verwalten“ kannst du
              wiederverwendbare Eingabewerte anlegen.
            </p>
          )}
        </section>
        <section
          className="daten-vorschau"
          aria-label="Datenvorschau"
          role="tabpanel"
          id={`${ansichtenId}-panel-vorschau`}
          aria-labelledby={`${ansichtenId}-vorschau`}
          hidden={datenansicht !== 'vorschau'}
        >
          <div className="daten-abschnittskopf">
            <div>
              <h2>Datenvorschau</h2>
            </div>
            <Knopf
              symbol="testen"
              onClick={() => props.vorschauLaden(auswahl ?? '')}
              disabled={gesperrt || !schritte.length}
              grund={
                gesperrt
                  ? 'Warte auf das Ende des laufenden Prozesses.'
                  : 'Füge zuerst eine Business-Datenquelle im Ablauf hinzu.'
              }
            >
              Datenvorschau vorbereiten
            </Knopf>
          </div>
          {aktuellerLauf && ['fehlgeschlagen', 'mit_fehlern'].includes(lauf.phase) && (
            <div className="daten-vorschaufehler">
              <Statusanzeige art="fehler">
                {lauf.meldung ||
                  'Die Daten konnten nicht vollständig verarbeitet werden. Prüfe den zugeordneten Baustein.'}
              </Statusanzeige>
              {lauf.fehlerBlockId && (
                <Knopf
                  symbol="bausteine"
                  onClick={() => {
                    waehlen(lauf.fehlerBlockId!);
                    datenansichtWechseln('quellen');
                  }}
                >
                  Betroffenen Baustein auswählen
                </Knopf>
              )}
            </div>
          )}
          {vorschau ? (
            <>
              {props.veraltet && (
                <Statusanzeige art="hinweis">
                  Der Workflow wurde seit dieser Vorschau geändert. Lade nach der Korrektur eine neue
                  Vorschau, um die geänderten Zuordnungen zu prüfen.
                </Statusanzeige>
              )}
              <p>
                {zeilen.length.toLocaleString('de-DE')} geladene Vorschauzeilen · höchstens 200 Zeilen und 256
                KiB. Die Gesamtzahl der Quelldaten ist hier nicht bekannt.
              </p>
              <details className="daten-herkunft">
                <summary>Herkunft und Laufstand</summary>
                <dl>
                  <div>
                    <dt>Workflow</dt>
                    <dd>{lauf.projektName ?? projekt.name}</dd>
                  </div>
                  <div>
                    <dt>Umfang</dt>
                    <dd>
                      Letzte verfügbare Tabelle des Workflow-Datenplans. Die Auswahl oben lädt keine einzelne
                      Quelle nach.
                    </dd>
                  </div>
                  <div>
                    <dt>Arbeitsordner des Laufs</dt>
                    <dd>{lauf.optionen.basisVerzeichnis ?? 'Nicht bekannt'}</dd>
                  </div>
                  <div>
                    <dt>Lauf-ID</dt>
                    <dd>
                      <code>{lauf.laufId ?? 'Nicht bekannt'}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Vollständige Standkennung</dt>
                    <dd>
                      <code>{lauf.standHash ?? 'Nicht bekannt'}</code>
                    </dd>
                  </div>
                </dl>
              </details>
              {(vorschau.gekuerzt || vorschau.abgeschnitten || vorschau.zellen_gekuerzt) && (
                <Statusanzeige art="hinweis">
                  Der Ausschnitt wurde begrenzt. Weitere Zeilen oder lange Zelltexte werden nicht vollständig
                  angezeigt.
                </Statusanzeige>
              )}
              <Feld
                beschriftung="In geladenen Vorschauzeilen suchen"
                type="search"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setZeilenseite(0);
                }}
              />
              <div className="daten-tabellensteuerung">
                <p>
                  {geladeneZeilen.length} Treffer in {zeilen.length} geladenen Zeilen · Sortierung gilt nur
                  für diesen Ausschnitt.
                </p>
                {geladeneZeilen.length > 50 && (
                  <div className="knopfgruppe">
                    <Knopf
                      variante="leise"
                      onClick={() => setZeilenseite(Math.max(0, aktiveZeilenseite - 1))}
                      disabled={aktiveZeilenseite === 0}
                      grund="Die erste Seite ist bereits sichtbar."
                    >
                      Vorherige Zeilen
                    </Knopf>
                    <span>
                      Seite {aktiveZeilenseite + 1} von {maxZeilenseite + 1}
                    </span>
                    <Knopf
                      variante="leise"
                      onClick={() => setZeilenseite(aktiveZeilenseite + 1)}
                      disabled={aktiveZeilenseite === maxZeilenseite}
                      grund="Die letzte Seite ist bereits sichtbar."
                    >
                      Weitere Zeilen
                    </Knopf>
                  </div>
                )}
              </div>
              {spalten.length > 20 && (
                <div className="daten-tabellensteuerung">
                  <p>
                    Spalten {aktiveSpaltenseite * 20 + 1}–
                    {Math.min(spalten.length, aktiveSpaltenseite * 20 + 20)} von {spalten.length}
                  </p>
                  <div className="knopfgruppe">
                    <Knopf
                      onClick={() => setSpaltenseite(Math.max(0, aktiveSpaltenseite - 1))}
                      disabled={aktiveSpaltenseite === 0}
                      grund="Die ersten Spalten sind bereits sichtbar."
                    >
                      Vorherige Spalten
                    </Knopf>
                    <Knopf
                      onClick={() => setSpaltenseite(aktiveSpaltenseite + 1)}
                      disabled={aktiveSpaltenseite === maxSpaltenseite}
                      grund="Die letzten Spalten sind bereits sichtbar."
                    >
                      Weitere Spalten
                    </Knopf>
                  </div>
                </div>
              )}
              {geladeneZeilen.length ? (
                <div
                  className="daten-tabellenausschnitt"
                  tabIndex={0}
                  role="region"
                  aria-label="Schreibgeschützte Vorschautabelle, horizontal und vertikal scrollbar"
                >
                  <table
                    style={{
                      width:
                        48 +
                        sichtbareSpalten.reduce((summe, s) => summe + (spaltenbreiten[s.name] ?? 176), 0),
                    }}
                  >
                    <caption>
                      Schreibgeschützte Daten · Zeilen {aktiveZeilenseite * 50 + 1}–
                      {Math.min(geladeneZeilen.length, aktiveZeilenseite * 50 + 50)} von{' '}
                      {geladeneZeilen.length} gefilterten Vorschauzeilen
                    </caption>
                    <colgroup>
                      <col style={{ width: 48 }} />
                      {sichtbareSpalten.map((s, i) => (
                        <col key={`${s.name}-${i}`} style={{ width: spaltenbreiten[s.name] ?? 176 }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sl-nur-vorlesen">Auswahl</span>
                        </th>
                        {sichtbareSpalten.map((s, i) => {
                          const index = aktiveSpaltenseite * 20 + i;
                          return (
                            <th
                              scope="col"
                              key={`${s.name}-${i}`}
                              aria-sort={
                                sortierung?.spalte === index
                                  ? sortierung.absteigend
                                    ? 'descending'
                                    : 'ascending'
                                  : 'none'
                              }
                            >
                              <button
                                onClick={() =>
                                  setSortierung({
                                    spalte: index,
                                    absteigend: sortierung?.spalte === index ? !sortierung.absteigend : false,
                                  })
                                }
                              >
                                <span>
                                  {s.name}
                                  {sortierung?.spalte === index ? (sortierung.absteigend ? ' ↓' : ' ↑') : ''}
                                </span>
                                <span className="daten-hilfetext">{s.typ}</span>
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {geladeneZeilen.slice(aktiveZeilenseite * 50, aktiveZeilenseite * 50 + 50).map((z) => (
                        <tr
                          key={z.index}
                          className={auswahlzeile === z.index ? 'ist-ausgewaehlt' : undefined}
                        >
                          <td>
                            <input
                              type="radio"
                              name="daten-vorschauzeile"
                              aria-label={`Vorschauzeile ${z.index + 1} auswählen`}
                              checked={auswahlzeile === z.index}
                              onChange={() => setAuswahlzeile(z.index)}
                            />
                          </td>
                          {sichtbareSpalten.map((s, i) => {
                            const wert = z.werte[aktiveSpaltenseite * 20 + i];
                            return (
                              <td
                                key={`${s.name}-${i}`}
                                className={numerisch(s.typ) ? 'ist-zahl' : undefined}
                                title={zellentext(wert)}
                              >
                                {zellentext(wert)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>
                  {filter
                    ? 'Keine Treffer in den geladenen Vorschauzeilen. Ändere den Suchbegriff.'
                    : 'Die geladene Vorschau enthält keine Zeilen.'}
                </p>
              )}
              {sichtbareSpalten.length > 0 && (
                <details className="daten-spaltenbreiten">
                  <summary>Spaltenbreiten einstellen</summary>
                  <div>
                    {sichtbareSpalten.map((s, i) => (
                      <Feld
                        key={`${s.name}-${i}`}
                        beschriftung={`${s.name} · Breite in Pixeln`}
                        type="number"
                        min={96}
                        max={640}
                        step={16}
                        value={spaltenbreiten[s.name] ?? 176}
                        onChange={(e) => {
                          const wert = Number(e.target.value);
                          if (Number.isFinite(wert))
                            setSpaltenbreiten((alt) => ({
                              ...alt,
                              [s.name]: Math.max(96, Math.min(640, wert)),
                            }));
                        }}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <p>
              {testAktiv(lauf.phase) && aktuellerLauf
                ? 'Der Lauf ist aktiv. Sobald eine begrenzte Datenvorschau vorliegt, wird sie hier angezeigt.'
                : 'Noch keine Datenvorschau für diesen Workflow. Prüfe Quellen und Zuordnungen und bereite anschließend eine Vorschau vor.'}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
