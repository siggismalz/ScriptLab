import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import type { Projekt, EditorBlock } from '../kern/projekt';
import { businessDatenLesen } from '../kern/business-katalog';
import { istQuellenfeld } from '../kern/quellenfeld';
import { businessSchritte } from '../kern/business';
import { businessDefinitionen, businessNachTyp } from '../kern/business-katalog';
import { parameterStandardwertVerwenden, parameterWertLesen } from '../kern/business-modell';
import { workflowPruefen } from '../kern/modell';
import type { TestZustand } from '../gemeinsam/testlauf';
import { testAktiv } from '../gemeinsam/testlauf';
import { BusinessEigenschaften, type ParameterKontext, type QuelleWaehlen } from './BusinessEigenschaften';
import { datenvorschauHinweis } from '../kern/datenvorschau';
import { ParameterWertEingabe } from './ParameterDialog';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld } from './komponenten/Feld';
import { Symbol } from './komponenten/Icon';
import { Statusanzeige } from './komponenten/Statusanzeige';
import { fehlerFeldverweis, vorschauTyptext } from './daten-darstellung';
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
  vorschauen?: Record<string, { zustand: TestZustand; veraltet: boolean }>;
  spaltenNachQuelle?: Record<string, string[]>;
  parameterKontext?: ParameterKontext;
  quelleWaehlen?: QuelleWaehlen;
  parametersatzWaehlen?: (satz: 'test' | 'echt') => void;
  parameterZiel?: { name: string; anfrage: number } | null;
  feldZiel?: { blockId: string; pfad: string[]; anfrage: number } | null;
  vorschauZiel?: { blockId: string; anfrage: number } | null;
  vorschauBausteinAnzeigen?: (blockId: string) => void;
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
  const gespeicherteVorschau = auswahl ? props.vorschauen?.[auswahl] : null;
  const vorschauStand =
    gespeicherteVorschau?.zustand.projektKennung === projekt.projektKennung ? gespeicherteVorschau : null;
  const vorschauLauf = vorschauStand?.zustand;
  const vorschau = vorschauLauf?.business?.vorschau;
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
  const fehlerAnzahl = blockMeldungen.filter((m) => m.stufe === 'fehler').length;
  const meldungsverweise = blockMeldungen.map((meldung) => ({
    meldung,
    feld: definition && meldung.feldPfad ? fehlerFeldverweis(definition, meldung.feldPfad) : null,
  }));
  const feldverweise = [
    ...new Map(
      meldungsverweise.filter((m) => m.feld).map((m) => [JSON.stringify(m.meldung.feldPfad), m]),
    ).values(),
  ];
  const allgemeineMeldungen = meldungsverweise.filter((m) => !m.feld);
  const quellenParameter = useMemo(() => {
    const ergebnis: Record<string, { blockId: string; feldPfad: string[] }> = {};
    function blockLesen(b: EditorBlock) {
      if (businessNachTyp.has(b.type)) {
        try {
          const cfg = businessDatenLesen(b.type, b.data).konfiguration;
          function wertLesen(w: unknown, pfad: string[]) {
            if (!w || typeof w !== 'object') return;
            const objekt = w as Record<string, unknown>;
            if (
              Object.keys(w).length === 1 &&
              typeof objekt.parameter === 'string' &&
              istQuellenfeld(b.type, pfad, cfg)
            )
              ergebnis[objekt.parameter] ??= { blockId: b.id, feldPfad: pfad };
            else Object.entries(w).forEach(([k, v]) => wertLesen(v, [...pfad, k]));
          }
          Object.entries(cfg).forEach(([k, v]) => wertLesen(v, [k]));
        } catch {
          /* Beschädigte Bausteine werden über die vorhandene Prüfung gemeldet. */
        }
      }
      Object.values(b.inputs ?? {}).forEach((e) => {
        if (e.block) blockLesen(e.block);
        if (e.shadow) blockLesen(e.shadow);
      });
      if (b.next?.block) blockLesen(b.next.block);
    }
    projekt.editor.blocks?.blocks.forEach(blockLesen);
    return ergebnis;
  }, [projekt.editor]);
  function feldFokussieren(pfad: string[]) {
    const feld = Array.from(
      scrollbereich.current?.querySelectorAll<HTMLElement>('[data-konfig-pfad]') ?? [],
    ).find((e) => e.dataset.konfigPfad === JSON.stringify(pfad));
    if (!feld) return;
    for (let el: HTMLElement | null = feld; el; el = el.parentElement)
      if (el instanceof HTMLDetailsElement) el.open = true;
    feld.scrollIntoView({ block: 'nearest' });
    (feld.querySelector<HTMLElement>('input,select,textarea,button') ?? feld).focus();
  }
  const vorschauGrund = datenvorschauHinweis(projekt, auswahl);
  useEffect(() => {
    if (!props.vorschauZiel) return;
    setAuswahl(props.vorschauZiel.blockId);
    setDatenansicht('vorschau');
    requestAnimationFrame(() =>
      scrollbereich.current
        ?.querySelector<HTMLElement>('.daten-vorschauwahl select')
        ?.focus({ preventScroll: true }),
    );
  }, [props.vorschauZiel]);
  useEffect(() => {
    if (!props.feldZiel) return;
    setAuswahl(props.feldZiel.blockId);
    setDatenansicht('quellen');
    requestAnimationFrame(() => feldFokussieren(props.feldZiel!.pfad));
  }, [props.feldZiel]);
  useEffect(() => {
    if (!props.parameterZiel) return;
    setDatenansicht('parameter');
    if (props.parameterKontext) setParametersatz(props.parameterKontext.parametersatz);
    requestAnimationFrame(() => {
      const feld = Array.from(document.querySelectorAll<HTMLElement>('[data-parameter-name]'))
        .find((e) => e.dataset.parameterName === props.parameterZiel!.name)
        ?.querySelector<HTMLElement>('input,select,textarea');
      feld?.scrollIntoView({ block: 'nearest' });
      feld?.focus();
    });
  }, [props.parameterZiel]);
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
                          <span className="daten-schritttitel">
                            {s.bezeichnung ?? def?.name ?? 'Business-Baustein'}
                          </span>
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
              <p>Noch keine Datenbausteine. Füge sie unter „Ablauf“ hinzu.</p>
            )}
          </section>
          <section className="daten-eigenschaften" aria-label="Datenkonfiguration">
            <div className="daten-konfigurationskopf">
              <h2>{schritt?.bezeichnung ?? 'Konfiguration'}</h2>
              {block && workspace && (
                <Knopf
                  variante="leise"
                  symbol="bausteine"
                  onClick={() => (props.blockAnzeigen ?? props.auswaehlen)(block.id)}
                >
                  Baustein anzeigen
                </Knopf>
              )}
            </div>
            {definition && block && workspace ? (
              <>
                {blockMeldungen.length > 0 && (
                  <div className="daten-konfigurationsfehler">
                    <p className="daten-fehleranzahl">
                      {fehlerAnzahl
                        ? `${fehlerAnzahl} ${fehlerAnzahl === 1 ? 'Angabe prüfen' : 'Angaben prüfen'}`
                        : 'Hinweise'}
                    </p>
                    {feldverweise.length > 0 && (
                      <ul className="daten-feldverweise">
                        {feldverweise.map(({ meldung, feld }) => (
                          <li key={JSON.stringify(meldung.feldPfad)}>
                            <button
                              className="daten-fehlerlink"
                              title={feld!.titel}
                              aria-label={`Zum Feld ${feld!.titel}`}
                              onClick={() => feldFokussieren(meldung.feldPfad!)}
                            >
                              {feld!.kurz}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {allgemeineMeldungen.length > 0 && (
                      <ul className="daten-allgemeine-meldungen">
                        {allgemeineMeldungen.map(({ meldung }, i) => (
                          <li key={i}>{meldung.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <BusinessEigenschaften
                  key={block.id}
                  ws={workspace}
                  block={block}
                  parameter={projekt.business.parameter}
                  gesperrt={gesperrt}
                  spaltenNachQuelle={props.spaltenNachQuelle}
                  parameterKontext={props.parameterKontext}
                  quelleWaehlen={props.quelleWaehlen}
                  feldFehler={blockMeldungen.flatMap((m) =>
                    m.feldPfad ? [{ feldPfad: m.feldPfad, text: m.text }] : [],
                  )}
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
              <p>Wähle einen Schritt, um Quelle und Zuordnung zu bearbeiten.</p>
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
                const laufwert =
                  parametersatz === props.parameterKontext?.parametersatz &&
                  Object.hasOwn(props.parameterKontext.laufwerte ?? {}, p.name);
                const wert =
                  satzwerte === null
                    ? p.standard
                    : parameterWertLesen(p, laufwert ? props.parameterKontext!.werte : satzwerte);
                const wertquelle = eigenerWert
                  ? wert === null || wert === ''
                    ? 'Ohne Wert'
                    : 'Eigener Wert'
                  : 'Standardwert';
                return (
                  <div
                    className="daten-parameterfeld"
                    key={feldschluessel}
                    data-parameter-name={p.name}
                    onChangeCapture={() => parameterEingaben.current.add(feldschluessel)}
                  >
                    <ParameterWertEingabe
                      beiPfadUebernahme={() => parameterEingaben.current.add(feldschluessel)}
                      dateiWaehlen={
                        props.quelleWaehlen && quellenParameter[p.name]
                          ? async () => {
                              const quelle = quellenParameter[p.name];
                              const pfad = await props.quelleWaehlen!(quelle.blockId, quelle.feldPfad);
                              if (pfad !== null) parameterEingaben.current.add(feldschluessel);
                              return pfad;
                            }
                          : undefined
                      }
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
                    {laufwert && (
                      <p className="daten-hilfetext">
                        Für den nächsten Lauf angepasst. Eine Änderung hier wird im Parametersatz gespeichert.
                      </p>
                    )}
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
            <p>Noch keine Workflowparameter. Lege sie unter „Parameter verwalten“ an.</p>
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
          <h2 className="sl-nur-vorlesen">Datenvorschau</h2>
          {auswahl && props.vorschauBausteinAnzeigen && (
            <Knopf
              className="daten-vorschau-rueckweg"
              variante="leise"
              symbol="links"
              onClick={() => props.vorschauBausteinAnzeigen!(auswahl)}
            >
              Zum Baustein
            </Knopf>
          )}
          <div className="daten-vorschauwahl">
            <Auswahlfeld
              beschriftung="Ergebnis bis zu diesem Schritt"
              value={auswahl ?? ''}
              onChange={(e) => waehlen(e.target.value)}
              disabled={gesperrt}
            >
              <option value="">Tabellenschritt auswählen</option>
              {auswahl &&
                !schritte.some(
                  (s) =>
                    s.id === auswahl &&
                    businessDefinitionen.find((d) => d.operation === s.operation)?.ausgabe === 'Tabelle',
                ) && <option value={auswahl}>Dieser Schritt liefert keine Tabelle</option>}
              {schritte
                .filter(
                  (s) => businessDefinitionen.find((d) => d.operation === s.operation)?.ausgabe === 'Tabelle',
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.bezeichnung ?? businessDefinitionen.find((d) => d.operation === s.operation)?.name}
                  </option>
                ))}
            </Auswahlfeld>
            {props.parametersatzWaehlen && (
              <Auswahlfeld
                beschriftung="Verwendete Werte"
                value={props.parameterKontext?.parametersatz ?? 'test'}
                disabled={gesperrt}
                onChange={(e) => props.parametersatzWaehlen!(e.target.value as 'test' | 'echt')}
              >
                <option value="test">Testdaten</option>
                <option value="echt">Echte Daten</option>
              </Auswahlfeld>
            )}
            <Knopf
              variante="primaer"
              symbol="testen"
              onClick={() => props.vorschauLaden(auswahl ?? '')}
              disabled={gesperrt || Boolean(vorschauGrund)}
              grund={gesperrt ? 'Warte auf das Ende des laufenden Prozesses.' : (vorschauGrund ?? undefined)}
            >
              Datenvorschau laden
            </Knopf>
          </div>
          {gesperrt && lauf.optionen.business?.vorschauBlockId === auswahl && (
            <Statusanzeige art="verarbeitung">
              Die Datenvorschau wird geladen. Du kannst den Prozess oben stoppen.
            </Statusanzeige>
          )}
          {aktuellerLauf &&
            lauf.optionen.business?.vorschauBlockId === auswahl &&
            ['fehlgeschlagen', 'mit_fehlern'].includes(lauf.phase) && (
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
              {vorschauStand?.veraltet && (
                <Statusanzeige art="hinweis">
                  Der Workflow wurde seit dieser Vorschau geändert. Lade die Vorschau nach der Korrektur
                  erneut.
                </Statusanzeige>
              )}
              <div className="daten-vorschauwerkzeuge">
                <div>
                  <p className="daten-vorschauumfang">
                    {zeilen.length.toLocaleString('de-DE')} Vorschauzeilen geladen · Gesamtzahl der Quelldaten
                    unbekannt.
                  </p>
                  <details className="daten-herkunft">
                    <summary>Herkunft und Laufstand</summary>
                    <dl>
                      <div>
                        <dt>Workflow</dt>
                        <dd>{vorschauLauf?.projektName ?? projekt.name}</dd>
                      </div>
                      <div>
                        <dt>Umfang</dt>
                        <dd>
                          Ergebnis bis zum ausgewählten Schritt einschließlich seiner notwendigen Vorgänger.
                        </dd>
                      </div>
                      <div>
                        <dt>Begrenzung</dt>
                        <dd>
                          Höchstens 200 Zeilen und 256 KiB. Suche und Sortierung gelten nur für diesen
                          Ausschnitt.
                        </dd>
                      </div>
                      <div>
                        <dt>Arbeitsordner des Laufs</dt>
                        <dd>{vorschauLauf?.optionen.basisVerzeichnis ?? 'Nicht bekannt'}</dd>
                      </div>
                      <div>
                        <dt>Lauf-ID</dt>
                        <dd>
                          <code>{vorschauLauf?.laufId ?? 'Nicht bekannt'}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Vollständige Standkennung</dt>
                        <dd>
                          <code>{vorschauLauf?.standHash ?? 'Nicht bekannt'}</code>
                        </dd>
                      </div>
                    </dl>
                  </details>
                </div>
                <Feld
                  beschriftung="In geladenen Vorschauzeilen suchen"
                  type="search"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setZeilenseite(0);
                  }}
                />
              </div>
              {(vorschau.gekuerzt || vorschau.abgeschnitten || vorschau.zellen_gekuerzt) && (
                <Statusanzeige art="hinweis">
                  Der Ausschnitt wurde begrenzt. Weitere Zeilen oder lange Zelltexte werden nicht vollständig
                  angezeigt.
                </Statusanzeige>
              )}
              {(filter || geladeneZeilen.length > 50) && (
                <div className="daten-tabellensteuerung">
                  {filter && (
                    <p>
                      {geladeneZeilen.length} Treffer in {zeilen.length} geladenen Vorschauzeilen.
                    </p>
                  )}
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
              )}
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
                                <span className="daten-hilfetext" title={s.typ}>
                                  {vorschauTyptext(s.typ)}
                                </span>
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
                : 'Für diesen Schritt ist noch keine Datenvorschau geladen. Wähle einen Tabellenschritt und klicke auf „Datenvorschau laden“.'}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
