import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { EntwurfEintrag, ProjektBibliothek, ProjektEintrag, Verfuegbarkeit } from '../gemeinsam/bruecke';
import { beispiele, hilfeArtikel, hilfeDurchsuchen, type BeispielKennung } from './hilfe';
import { Knopf } from './komponenten/Knopf';
import { Karte } from './komponenten/Karte';
import { Auswahlfeld, Feld, Textfeld } from './komponenten/Feld';
import { Symbol, type SymbolName } from './komponenten/Icon';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './startbereich.css';
import { sprachdaten, type Skriptsprache } from '../kern/sprachen';
import { Marke } from './komponenten/Marke';
import { VorlagenBereich, type VorlagenFilter } from './VorlagenBereich';

type Seite = 'start' | 'projekte' | 'entwuerfe' | 'beispiele' | 'hilfe';
type Sortierung = 'zuletzt' | 'name';
type Sprachfilter = 'alle' | Skriptsprache;

export interface AktiverWorkflowInfo {
  workflowArt?: 'allgemein' | 'ml';
  projektKennung: string;
  name: string;
  dateiname: string | null;
  geaendert: boolean;
  skriptsprache: Skriptsprache;
}

export interface StartbereichEigenschaften {
  daten: ProjektBibliothek | null;
  laden: boolean;
  fehler: string | null;
  fehlerErneutLaden?: () => void;
  fehlerSchliessen?: () => void;
  verarbeitung: string | null;
  meldung?: string | null;
  aktiveInfo: AktiverWorkflowInfo | null;
  verfuegbarkeiten: Readonly<Record<string, Verfuegbarkeit | undefined>>;
  ziel?: 'start' | 'hilfe' | 'projekte' | 'beispiele';
  zielAnfrage?: number;
  neuerWorkflow: () => void;
  workflowOeffnen: () => void;
  weiterbearbeiten: () => void;
  einstellungenOeffnen: () => void;
  ueberOeffnen: () => void;
  aktualisieren: () => void;
  projektOeffnen: (id: string) => void;
  projektNeuZuordnen: (id: string) => void;
  projektEntfernen: (id: string) => void;
  projektOrdnerAnzeigen: (id: string) => void;
  entwurfFortsetzen: (id: string) => void;
  entwurfSpeichernUnter: (id: string) => void;
  entwurfLoeschen: (id: string) => void;
  beispielOeffnen: (id: BeispielKennung) => void;
}

const seitentitel: Record<Seite, string> = {
  start: 'Startseite',
  projekte: 'Meine gespeicherten Workflows',
  entwuerfe: 'Entwürfe',
  beispiele: 'Beispielworkflows',
  hilfe: 'Dokumentation und Anleitungen',
};

const karten: readonly { seite: Exclude<Seite, 'start'>; symbol: SymbolName; beschreibung: string }[] = [
  {
    seite: 'projekte',
    symbol: 'oeffnen',
    beschreibung: 'Projektdateien finden und öffnen.',
  },
  {
    seite: 'entwuerfe',
    symbol: 'entwurf',
    beschreibung: 'Lokal gesicherte Arbeitsstände fortsetzen.',
  },
  {
    seite: 'beispiele',
    symbol: 'bausteine',
    beschreibung: 'Einen fertigen Ablauf als eigene Kopie verwenden.',
  },
  {
    seite: 'hilfe',
    symbol: 'buch',
    beschreibung: 'Bedienung und Funktionen nachschlagen.',
  },
];

function zeitwert(iso: string | null): number {
  return iso ? Date.parse(iso) || 0 : 0;
}
function nameVergleichen(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return (
    a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id)
  );
}

export function projekteFiltern(
  projekte: readonly ProjektEintrag[],
  suche: string,
  sortierung: Sortierung,
  sprachfilter: Sprachfilter = 'alle',
): ProjektEintrag[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  return projekte
    .filter(
      (p) =>
        `${p.name} ${p.pfad}`.toLocaleLowerCase('de').includes(filter) &&
        (sprachfilter === 'alle' || p.skriptsprache === sprachfilter),
    )
    .sort((a, b) =>
      sortierung === 'name'
        ? nameVergleichen(a, b)
        : zeitwert(b.zuletztGeoeffnet) - zeitwert(a.zuletztGeoeffnet) || nameVergleichen(a, b),
    );
}

export function entwuerfeFiltern(
  entwuerfe: readonly EntwurfEintrag[],
  suche: string,
  sortierung: Sortierung,
  sprachfilter: Sprachfilter = 'alle',
): EntwurfEintrag[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  return entwuerfe
    .filter(
      (e) =>
        `${e.name} ${e.ausgangspfad ?? ''}`.toLocaleLowerCase('de').includes(filter) &&
        (sprachfilter === 'alle' || e.skriptsprache === sprachfilter),
    )
    .sort((a, b) =>
      sortierung === 'name'
        ? nameVergleichen(a, b)
        : zeitwert(b.gesichertAm) - zeitwert(a.gesichertAm) || nameVergleichen(a, b),
    );
}

export function zuletztGeoeffnete(projekte: readonly ProjektEintrag[]): ProjektEintrag[] {
  return projekteFiltern(
    projekte.filter((p) => Boolean(p.zuletztGeoeffnet)),
    '',
    'zuletzt',
  ).slice(0, 5);
}

type LetzteWorkflowZeile =
  | { art: 'aktiv'; workflow: AktiverWorkflowInfo; projekt: ProjektEintrag | null }
  | { art: 'datei'; projekt: ProjektEintrag };

/** Aktive Arbeit erscheint genau einmal; Namen und Dateipfade sind keine Projektidentität. */
export function letzteWorkflowZeilen(
  projekte: readonly ProjektEintrag[],
  aktiv: AktiverWorkflowInfo | null,
): LetzteWorkflowZeile[] {
  if (!aktiv) return zuletztGeoeffnete(projekte).map((projekt) => ({ art: 'datei', projekt }));
  const andere = zuletztGeoeffnete(projekte.filter((p) => p.projektKennung !== aktiv.projektKennung));
  return [
    {
      art: 'aktiv',
      workflow: aktiv,
      projekt: projekte.find((p) => p.projektKennung === aktiv.projektKennung) ?? null,
    },
    ...andere.slice(0, 4).map((projekt): LetzteWorkflowZeile => ({ art: 'datei', projekt })),
  ];
}

function zeitDarstellen(iso: string | null): string {
  if (!iso) return 'Noch nicht geöffnet';
  const datum = new Date(iso);
  return Number.isNaN(datum.valueOf())
    ? 'Zeitpunkt unbekannt'
    : datum.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function markieren(text: string, suche: string): ReactNode {
  const filter = suche.trim();
  if (!filter) return text;
  const position = text.toLocaleLowerCase('de').indexOf(filter.toLocaleLowerCase('de'));
  if (position < 0) return text;
  return (
    <>
      {text.slice(0, position)}
      <mark>{text.slice(position, position + filter.length)}</mark>
      {text.slice(position + filter.length)}
    </>
  );
}

/** Die Bibliothek bleibt Eigentum des Hauptprozesses. Diese Komponente hält nur Ansicht und Suche. */
export function Startbereich(props: StartbereichEigenschaften) {
  const [seite, setSeite] = useState<Seite>(props.ziel ?? 'start');
  const [ausgewaehltesProjekt, setAusgewaehltesProjekt] = useState<string | null>(null);
  const [listenseite, setListenseite] = useState(0);
  const [projektSuche, setProjektSuche] = useState('');
  const [projektSortierung, setProjektSortierung] = useState<Sortierung>('zuletzt');
  const [projektSprache, setProjektSprache] = useState<Sprachfilter>('alle');
  const [entwurfSuche, setEntwurfSuche] = useState('');
  const [entwurfSortierung, setEntwurfSortierung] = useState<Sortierung>('zuletzt');
  const [entwurfSprache, setEntwurfSprache] = useState<Sprachfilter>('alle');
  const [vorlagenFilter, setVorlagenFilter] = useState<VorlagenFilter>({
    suche: '',
    sprache: 'alle',
    aufgabe: 'alle',
    bereich: 'beispiele',
  });
  const [vorlagenAuswahl, setVorlagenAuswahl] = useState<BeispielKennung | null>(null);
  const [hilfeSuche, setHilfeSuche] = useState('');
  const [artikelId, setArtikelId] = useState<string | null>(null);
  const [sprungziel, setSprungziel] = useState<string | null>(null);
  const inhalt = useRef<HTMLElement>(null);
  const seitentitelRef = useRef<HTMLHeadingElement>(null);
  const ansicht = artikelId && seite === 'hilfe' ? `hilfe/${artikelId}` : seite;
  const letzteAnsicht = useRef(ansicht);
  const letzteScrollAnfrage = useRef<number | undefined>(undefined);
  const positionWiederherstellen = useRef(false);
  const aktualisierungsFokus = useRef<HTMLButtonElement | null>(null);
  const positionen = useRef<Record<string, number>>({});
  const zielVorher = useRef(props.ziel);
  const zielAnfrageVorher = useRef(props.zielAnfrage);

  function seiteWechseln(neu: Seite, artikel: string | null = null, abschnitt: string | null = null) {
    if (inhalt.current && inhalt.current.clientHeight > 0)
      positionen.current[ansicht] = inhalt.current.scrollTop;
    setSeite(neu);
    setArtikelId(artikel);
    setSprungziel(abschnitt);
  }

  // Root kann die lokale Hilfe aus dem Editor öffnen, ohne Such- und Sortierzustände zu löschen.
  useLayoutEffect(() => {
    if (props.ziel !== zielVorher.current || props.zielAnfrage !== zielAnfrageVorher.current) {
      zielVorher.current = props.ziel;
      zielAnfrageVorher.current = props.zielAnfrage;
      // Ein externer Rückweg darf den gespeicherten Ausschnitt nicht mit hidden-scrollTop=0 ersetzen.
      setSeite(props.ziel ?? 'start');
      setArtikelId(null);
      setSprungziel(null);
    }
  }, [props.ziel, props.zielAnfrage]);

  useLayoutEffect(() => {
    const panel = inhalt.current;
    if (!panel) return;
    if (!props.laden && aktualisierungsFokus.current) {
      const knopf = aktualisierungsFokus.current;
      aktualisierungsFokus.current = null;
      // Natives Deaktivieren verliert den Fokus. Nur den ausdrücklich betätigten
      // Auslöser wiederherstellen, solange der Nutzer nicht woanders weiterarbeitet.
      if (knopf.isConnected && knopf.getClientRects().length && document.activeElement === document.body)
        knopf.focus({ preventScroll: true });
    }
    if (sprungziel) {
      const ziel = panel.querySelector<HTMLElement>(`#hilfe-${sprungziel}`);
      if (ziel) {
        ziel.scrollIntoView({ block: 'start' });
        ziel.focus({ preventScroll: true });
      }
    } else {
      const wechselt = letzteAnsicht.current !== ansicht || letzteScrollAnfrage.current !== props.zielAnfrage;
      // Der Ladehinweis verändert vorübergehend die Höhe des Listeninhalts.
      // Erst danach wiederherstellen; Zwischenpositionen sind kein Nutzerscroll.
      if (props.laden) {
        positionWiederherstellen.current = true;
        return;
      }
      if (!wechselt && !positionWiederherstellen.current) return;
      const vorherigePosition = positionen.current[ansicht] ?? 0;
      panel.scrollTop = vorherigePosition;
      positionWiederherstellen.current = false;
      if (wechselt) {
        // Eine reine Bestandsaktualisierung darf keinen Eingabefokus verschieben.
        if (vorherigePosition > 0) panel.focus({ preventScroll: true });
        else seitentitelRef.current?.focus({ preventScroll: true });
      }
    }
    letzteAnsicht.current = ansicht;
    letzteScrollAnfrage.current = props.zielAnfrage;
  }, [ansicht, sprungziel, props.zielAnfrage, props.laden]);

  const gesperrt = Boolean(props.verarbeitung);
  const artikel = hilfeArtikel.find((a) => a.id === artikelId);
  const treffer = hilfeDurchsuchen(hilfeSuche);
  const projekte = props.daten
    ? projekteFiltern(props.daten.projekte, projektSuche, projektSortierung, projektSprache)
    : [];
  const entwuerfe = props.daten
    ? entwuerfeFiltern(props.daten.entwuerfe, entwurfSuche, entwurfSortierung, entwurfSprache)
    : [];
  const letzteZeilen = letzteWorkflowZeilen(props.daten?.projekte ?? [], props.aktiveInfo);
  useEffect(() => setListenseite(0), [projektSuche, projektSortierung, projektSprache]);
  const maximaleListenseite = Math.max(0, Math.ceil(projekte.length / 50) - 1);
  const aktuelleListenseite = Math.min(listenseite, maximaleListenseite);

  function datenStatus(leerText: string): ReactNode {
    if (props.laden) return <p role="status">Bibliothek wird geladen …</p>;
    if (props.daten?.hinweis)
      return (
        <p>
          Die Bibliothek konnte nicht vollständig gelesen werden. Beachte den Hinweis oben. Ein leerer Bereich
          bedeutet hier nicht, dass keine Projekte oder Entwürfe vorhanden sind.
        </p>
      );
    if (!props.daten)
      return (
        <p>
          Die Bibliothek ist noch nicht verfügbar. Du kannst weiterhin einen neuen Workflow erstellen oder
          eine Projektdatei öffnen.
        </p>
      );
    return <p>{leerText}</p>;
  }

  function projektZeile(projekt: ProjektEintrag, kompakt = false) {
    const pruefung = props.verfuegbarkeiten[projekt.id];
    const zustand = pruefung?.zustand ?? 'unbekannt';
    const fehlt = ['fehlt', 'nicht-erreichbar', 'ungueltig'].includes(zustand);
    const zustandsname = {
      unbekannt: 'Noch nicht geprüft',
      prueft: 'Verfügbarkeit wird geprüft …',
      verfuegbar: 'Datei verfügbar',
      geaendert: 'Datei außerhalb von ScriptLab geändert',
      fehlt: 'Datei nicht gefunden',
      'nicht-erreichbar': 'Speicherort nicht erreichbar',
      ungueltig: 'Projektdatei kann nicht geöffnet werden',
    }[zustand];
    const statusId = `projekt-zustand-${projekt.id}`;
    return (
      <article
        className={`start-listeneintrag start-workflowzeile ${kompakt ? 'start-workflowzeile--kompakt' : ''} ${ausgewaehltesProjekt === projekt.id ? 'ist-ausgewaehlt' : ''}`}
        onFocus={() => setAusgewaehltesProjekt(projekt.id)}
        onClick={() => setAusgewaehltesProjekt(projekt.id)}
        key={projekt.id}
        aria-label={`${projekt.name} – ${projekt.pfad}`}
        data-projekt-id={projekt.id}
      >
        <div className="start-workflowname">
          <h3 title={projekt.name}>{projekt.name}</h3>
          {ausgewaehltesProjekt === projekt.id && <span className="sl-nur-vorlesen">Ausgewählt</span>}
        </div>
        <span
          className="start-workflowsprache"
          aria-label={`Sprache: ${sprachdaten[projekt.skriptsprache].bezeichnung}`}
        >
          {projekt.workflowArt === 'ml'
            ? 'Machine Learning · Python'
            : sprachdaten[projekt.skriptsprache].kurzbezeichnung}
        </span>
        <span
          className={`start-dateistatus ${fehlt ? 'start-dateistatus--fehler' : zustand === 'geaendert' ? 'start-dateistatus--hinweis' : ''}`}
        >
          <Symbol name={fehlt ? 'hinweis' : zustand === 'verfuegbar' ? 'erfolg' : 'info'} groesse={16} />
          {zustandsname}
        </span>
        <span
          className="start-workflowdatum"
          aria-label={`Zuletzt geöffnet: ${zeitDarstellen(projekt.zuletztGeoeffnet)}`}
        >
          {zeitDarstellen(projekt.zuletztGeoeffnet)}
        </span>
        <div className="start-zeilen-hauptaktion">
          <Knopf
            symbol="oeffnen"
            disabled={gesperrt || fehlt}
            grundId={gesperrt ? 'start-verarbeitung' : fehlt ? statusId : undefined}
            onClick={() => props.projektOeffnen(projekt.id)}
          >
            Öffnen
          </Knopf>
        </div>
        <details className="start-dateidetails">
          <summary title={`Details zu ${projekt.name}`}>
            <Symbol name="rechts" groesse={16} />
            <span className="sl-nur-vorlesen">Speicherort und Dateistatus</span>
          </summary>
          <div className="start-dateidetails-inhalt">
            {projekt.beschreibung && <p>{projekt.beschreibung}</p>}
            <Textfeld
              beschriftung="Dateipfad"
              value={projekt.pfad}
              readOnly
              rows={2}
              spellCheck={false}
              className="start-pfad"
              aria-label={`Dateipfad: ${projekt.name}`}
            />
            <p className="start-metadaten">Geändert: {zeitDarstellen(projekt.geaendertAm)}</p>
            <p id={statusId} className={fehlt ? 'start-fehlertext' : 'start-hilfetext'}>
              {pruefung?.meldung || zustandsname}
            </p>
            <div className="start-eintrag-aktionen start-zeilen-nebenaktionen">
              {!kompakt && (
                <>
                  <Knopf
                    variante="leise"
                    disabled={gesperrt || fehlt}
                    grundId={gesperrt ? 'start-verarbeitung' : fehlt ? statusId : undefined}
                    onClick={() => props.projektOrdnerAnzeigen(projekt.id)}
                  >
                    Ordner anzeigen
                  </Knopf>
                  <Knopf
                    variante="leise"
                    disabled={gesperrt}
                    grundId="start-verarbeitung"
                    onClick={() => props.projektNeuZuordnen(projekt.id)}
                  >
                    Neu zuordnen
                  </Knopf>
                  <Knopf
                    variante="leise"
                    disabled={gesperrt}
                    grundId="start-verarbeitung"
                    onClick={() => props.projektEntfernen(projekt.id)}
                  >
                    Aus Liste entfernen
                  </Knopf>
                </>
              )}
              {kompakt && fehlt && (
                <Knopf
                  disabled={gesperrt}
                  grundId="start-verarbeitung"
                  onClick={() => props.projektNeuZuordnen(projekt.id)}
                >
                  Neu zuordnen
                </Knopf>
              )}
            </div>
            {!kompakt && (
              <p className="start-hilfetext">
                „Aus Liste entfernen“ löscht nur den Verweis, nicht die Datei.
              </p>
            )}
          </div>
        </details>
      </article>
    );
  }

  function aktiveZeile(workflow: AktiverWorkflowInfo, projekt: ProjektEintrag | null) {
    const status = workflow.geaendert
      ? 'Ungespeicherte Änderungen'
      : workflow.dateiname
        ? 'Projekt gespeichert'
        : 'Noch nicht gespeichert';
    return (
      <article
        className="start-listeneintrag start-workflowzeile start-workflowzeile--kompakt start-workflowzeile--aktiv"
        key={`aktiv-${workflow.projektKennung}`}
        aria-label={`${workflow.name} – aktiver Workflow`}
        data-aktiver-workflow={workflow.projektKennung}
      >
        <div className="start-workflowname">
          <h3 title={workflow.name}>{workflow.name}</h3>
        </div>
        <span
          className="start-workflowsprache"
          aria-label={`Sprache: ${sprachdaten[workflow.skriptsprache].bezeichnung}`}
        >
          {workflow.workflowArt === 'ml'
            ? 'Machine Learning · Python'
            : sprachdaten[workflow.skriptsprache].kurzbezeichnung}
        </span>
        <span className="start-dateistatus">
          <Symbol name={workflow.geaendert ? 'entwurf' : 'info'} groesse={16} />
          {status}
        </span>
        <span className="start-workflowdatum">
          {projekt?.zuletztGeoeffnet ? zeitDarstellen(projekt.zuletztGeoeffnet) : 'Aktuell geöffnet'}
        </span>
        <div className="start-zeilen-hauptaktion">
          <Knopf
            symbol="rechts"
            disabled={gesperrt}
            grundId="start-verarbeitung"
            onClick={props.weiterbearbeiten}
          >
            Weiterbearbeiten
          </Knopf>
        </div>
        {workflow.dateiname && (
          <details className="start-dateidetails">
            <summary title={`Details zu ${workflow.name}`}>
              <Symbol name="rechts" groesse={16} />
              <span className="sl-nur-vorlesen">Speicherort und Dateistatus</span>
            </summary>
            <div className="start-dateidetails-inhalt">
              <Textfeld
                beschriftung="Dateipfad"
                value={workflow.dateiname}
                readOnly
                rows={2}
                spellCheck={false}
                className="start-pfad"
                aria-label={`Dateipfad: ${workflow.name}`}
              />
              {projekt && props.verfuegbarkeiten[projekt.id] && (
                <p>{props.verfuegbarkeiten[projekt.id]!.meldung}</p>
              )}
            </div>
          </details>
        )}
      </article>
    );
  }

  function workflowSpaltenkopf() {
    return (
      <div className="start-listenkopf" aria-hidden="true">
        <span>Workflow</span>
        <span>Sprache</span>
        <span>Speicherstatus</span>
        <span>Zuletzt geöffnet</span>
        <span />
      </div>
    );
  }

  return (
    <section className="startbereich" data-testid="startbereich" aria-label="ScriptLab-Startbereich">
      <aside className="start-navigation" aria-label="Globale Navigation">
        <button className="start-marke" onClick={() => seiteWechseln('start')} aria-label="Startseite">
          <Marke />
        </button>
        <nav aria-label="Arbeitsnavigation">
          {(
            [
              { id: 'start', text: 'Start', symbol: 'bausteine' },
              { id: 'projekte', text: 'Workflows', symbol: 'oeffnen' },
              { id: 'beispiele', text: 'Vorlagen', symbol: 'buch' },
            ] as const
          ).map((eintrag) => (
            <button
              type="button"
              key={eintrag.id}
              className="start-navlink"
              aria-current={
                seite === eintrag.id || (eintrag.id === 'projekte' && seite === 'entwuerfe')
                  ? 'page'
                  : undefined
              }
              onClick={() => seiteWechseln(eintrag.id)}
            >
              <Symbol name={eintrag.symbol} />
              <span>{eintrag.text}</span>
            </button>
          ))}
        </nav>
        <nav className="start-navigation-unten" aria-label="Unterstützung">
          <button
            type="button"
            className="start-navlink"
            aria-current={seite === 'hilfe' ? 'page' : undefined}
            onClick={() => seiteWechseln('hilfe')}
          >
            <Symbol name="buch" />
            <span>Hilfe</span>
          </button>
          <button type="button" className="start-navlink" onClick={props.einstellungenOeffnen}>
            <Symbol name="einstellungen" />
            <span>Einstellungen</span>
          </button>
          <button type="button" className="start-navlink" onClick={props.ueberOeffnen}>
            <Symbol name="info" />
            <span>Über ScriptLab</span>
          </button>
        </nav>
      </aside>
      <main
        ref={inhalt}
        className="start-scrollbereich"
        data-testid="start-inhalt"
        tabIndex={-1}
        aria-label={seitentitel[seite]}
        onScroll={(event) => {
          if (
            !props.verarbeitung &&
            !props.laden &&
            event.currentTarget.clientHeight > 0 &&
            !event.currentTarget.closest('[hidden]')
          )
            positionen.current[ansicht] = event.currentTarget.scrollTop;
        }}
      >
        <div className="start-inhalt">
          <div className="start-seitenkopf">
            <div className="start-titelfeld">
              {artikel && seite === 'hilfe' && (
                <Knopf variante="leise" symbol="links" onClick={() => seiteWechseln('hilfe')}>
                  Zur Themenübersicht
                </Knopf>
              )}
              <h1 ref={seitentitelRef} tabIndex={-1}>
                {artikel && seite === 'hilfe'
                  ? artikel.titel
                  : seite === 'beispiele'
                    ? 'Vorlagen'
                    : seite === 'projekte'
                      ? 'Workflows'
                      : seitentitel[seite]}
              </h1>
            </div>
            {seite === 'start' && (
              <div className="start-hauptaktionen">
                <Knopf
                  variante="primaer"
                  symbol="neu"
                  disabled={gesperrt}
                  grundId="start-verarbeitung"
                  onClick={props.neuerWorkflow}
                >
                  Neuer Workflow
                </Knopf>
                <Knopf
                  symbol="oeffnen"
                  disabled={gesperrt}
                  grundId="start-verarbeitung"
                  onClick={props.workflowOeffnen}
                >
                  Workflow öffnen
                </Knopf>
              </div>
            )}
          </div>
          {props.verarbeitung && (
            <p id="start-verarbeitung" role="status" className="start-verarbeitung">
              {props.verarbeitung}
            </p>
          )}
          {props.fehler && (
            <div className="start-rueckmeldung">
              <Statusanzeige art="fehler">{props.fehler}</Statusanzeige>
              {props.fehlerErneutLaden && (
                <Knopf onClick={props.fehlerErneutLaden} disabled={gesperrt} grundId="start-verarbeitung">
                  Erneut laden
                </Knopf>
              )}
              {props.fehlerSchliessen && (
                <Knopf onClick={props.fehlerSchliessen} disabled={gesperrt} grundId="start-verarbeitung">
                  Meldung schließen
                </Knopf>
              )}
            </div>
          )}
          {props.meldung && <Statusanzeige>{props.meldung}</Statusanzeige>}
          {props.daten?.hinweis && <Statusanzeige art="hinweis">{props.daten.hinweis}</Statusanzeige>}

          {seite === 'start' && (
            <>
              <Karte
                as="section"
                className="start-zuletzt"
                data-testid="zuletzt-geoeffnet"
                aria-labelledby="start-zuletzt-titel"
              >
                <div className="start-abschnitt-kopf">
                  <h2 id="start-zuletzt-titel">Zuletzt geöffnet</h2>
                  <Knopf variante="leise" onClick={() => seiteWechseln('projekte')}>
                    Alle gespeicherten Workflows
                  </Knopf>
                </div>
                {letzteZeilen.length ? (
                  <>
                    {workflowSpaltenkopf()}
                    <div className="start-liste">
                      {letzteZeilen.map((zeile) =>
                        zeile.art === 'aktiv'
                          ? aktiveZeile(zeile.workflow, zeile.projekt)
                          : projektZeile(zeile.projekt, true),
                      )}
                    </div>
                  </>
                ) : (
                  datenStatus('Noch keine Workflows geöffnet.')
                )}
              </Karte>
              <section className="start-einstiege" aria-label="Weitere Einstiege">
                <div className="start-karten" data-testid="start-karten">
                  {karten.map((karte) => (
                    <Karte as="div" key={karte.seite} className="start-einstiegskarte">
                      <button
                        type="button"
                        className={`start-karte ${karte.seite === 'beispiele' || karte.seite === 'hilfe' ? 'start-karte--nachschlagen' : ''}`}
                        aria-label={seitentitel[karte.seite]}
                        title={karte.beschreibung}
                        data-testid={
                          karte.seite === 'entwuerfe' && Boolean(props.daten?.entwuerfe.length)
                            ? 'entwuerfe-hinweis'
                            : undefined
                        }
                        onClick={() => seiteWechseln(karte.seite)}
                      >
                        <Symbol name={karte.symbol} groesse={20} />
                        <span className="start-karte-inhalt">
                          <span className="start-karte-titel">{seitentitel[karte.seite]}</span>
                          <span className="start-karte-beschreibung">{karte.beschreibung}</span>
                          <span className="start-karte-metadaten">
                            {karte.seite === 'projekte'
                              ? props.daten?.hinweis
                                ? 'Bestand nicht vollständig geladen'
                                : props.daten
                                  ? `${props.daten.projekte.length} ${props.daten.projekte.length === 1 ? 'Workflow' : 'Workflows'}`
                                  : props.laden
                                    ? 'Wird geladen …'
                                    : 'Bibliothek nicht geladen'
                              : karte.seite === 'entwuerfe'
                                ? props.daten?.hinweis
                                  ? 'Bestand nicht vollständig geladen'
                                  : props.daten
                                    ? `${props.daten.entwuerfe.length} ${props.daten.entwuerfe.length === 1 ? 'Entwurf' : 'Entwürfe'}`
                                    : props.laden
                                      ? 'Wird geladen …'
                                      : 'Bibliothek nicht geladen'
                                : karte.seite === 'beispiele'
                                  ? `${beispiele.length} Beispiele`
                                  : `${hilfeArtikel.length} Anleitungen`}
                          </span>
                        </span>
                        <Symbol name="rechts" />
                      </button>
                    </Karte>
                  ))}
                </div>
              </section>
            </>
          )}

          {(seite === 'projekte' || seite === 'entwuerfe') && (
            <nav className="start-unterbereiche" aria-label="Workflowbestände">
              <button
                type="button"
                aria-current={seite === 'projekte' ? 'page' : undefined}
                onClick={() => seiteWechseln('projekte')}
              >
                Gespeicherte Workflows
              </button>
              <button
                type="button"
                aria-current={seite === 'entwuerfe' ? 'page' : undefined}
                onClick={() => seiteWechseln('entwuerfe')}
              >
                Entwürfe
              </button>
            </nav>
          )}
          {seite === 'projekte' && (
            <section data-testid="bekannte-projekte" aria-label="Bekannte Projektdateien">
              <div className="start-listenfilter">
                <Feld
                  beschriftung="Gespeicherte Workflows durchsuchen"
                  type="search"
                  value={projektSuche}
                  onChange={(e) => setProjektSuche(e.target.value)}
                  placeholder="Name oder Dateipfad"
                />
                <Auswahlfeld
                  beschriftung="Workflows nach Sprache filtern"
                  value={projektSprache}
                  onChange={(e) => setProjektSprache(e.target.value as Sprachfilter)}
                >
                  <option value="alle">Alle Sprachen</option>
                  <option value="python">Python</option>
                  <option value="vbs">VBScript (VBS)</option>
                </Auswahlfeld>
                <Auswahlfeld
                  beschriftung="Workflows sortieren"
                  value={projektSortierung}
                  onChange={(e) => setProjektSortierung(e.target.value as Sortierung)}
                >
                  <option value="zuletzt">Zuletzt geöffnet</option>
                  <option value="name">Name A–Z</option>
                </Auswahlfeld>
                <Knopf
                  symbol="wiederholen"
                  onClick={(event) => {
                    aktualisierungsFokus.current = event.currentTarget;
                    props.aktualisieren();
                  }}
                  disabled={gesperrt || props.laden}
                  grundId={gesperrt ? 'start-verarbeitung' : 'start-bibliothek-status'}
                >
                  Aktualisieren
                </Knopf>
              </div>
              <p id="start-bibliothek-status" role="status" className="start-ergebniszahl">
                {props.laden
                  ? 'Bibliothek wird geladen …'
                  : props.daten?.hinweis
                    ? 'Anzeige möglicherweise unvollständig'
                    : props.daten
                      ? `${projekte.length} ${projekte.length === 1 ? 'Workflow' : 'Workflows'}${projektSuche.trim() || projektSprache !== 'alle' ? ' gefunden' : ''}`
                      : 'Bibliothek noch nicht geladen'}
              </p>
              {projekte.length ? (
                <>
                  {workflowSpaltenkopf()}
                  <div className="start-liste">
                    {projekte
                      .slice(aktuelleListenseite * 50, aktuelleListenseite * 50 + 50)
                      .map((p) => projektZeile(p))}
                  </div>
                  {projekte.length > 50 && (
                    <nav className="knopfgruppe umbrechen" aria-label="Seiten der Workflowliste">
                      <Knopf
                        disabled={aktuelleListenseite === 0}
                        grund="Du bist auf der ersten Seite."
                        onClick={() => {
                          setListenseite((s) => s - 1);
                          inhalt.current?.scrollTo({ top: 0 });
                        }}
                      >
                        Vorherige Seite
                      </Knopf>
                      <p role="status">
                        Seite {aktuelleListenseite + 1} von {maximaleListenseite + 1} · bis zu 50 Workflows
                        pro Seite
                      </p>
                      <Knopf
                        disabled={aktuelleListenseite === maximaleListenseite}
                        grund="Du bist auf der letzten Seite."
                        onClick={() => {
                          setListenseite((s) => s + 1);
                          inhalt.current?.scrollTo({ top: 0 });
                        }}
                      >
                        Nächste Seite
                      </Knopf>
                    </nav>
                  )}
                </>
              ) : (
                <div className="start-leerzustand">
                  {datenStatus(
                    projektSuche.trim() || projektSprache !== 'alle'
                      ? 'Keine passenden Workflows gefunden. Ändere die Suche oder den Sprachfilter.'
                      : 'Noch keine Projektdateien bekannt. Öffne eine .scriptlab-Datei oder speichere einen eigenen Workflow.',
                  )}
                  {projektSuche && <Knopf onClick={() => setProjektSuche('')}>Suche leeren</Knopf>}
                  {projektSprache !== 'alle' && (
                    <Knopf onClick={() => setProjektSprache('alle')}>Sprachfilter zurücksetzen</Knopf>
                  )}
                  <Knopf
                    symbol="oeffnen"
                    disabled={gesperrt}
                    grundId="start-verarbeitung"
                    onClick={props.workflowOeffnen}
                  >
                    Workflow öffnen
                  </Knopf>
                </div>
              )}
            </section>
          )}

          {seite === 'entwuerfe' && (
            <section data-testid="entwuerfe" aria-label="Gesicherte Entwürfe">
              <p className="start-einleitung">
                Lokal gesicherte Zwischenstände. „Gesichert“ bezieht sich auf den Entwurf und bestätigt kein
                Speichern der Projektdatei.
              </p>
              <div className="start-listenfilter">
                <Feld
                  beschriftung="Entwürfe suchen"
                  type="search"
                  value={entwurfSuche}
                  onChange={(e) => setEntwurfSuche(e.target.value)}
                  placeholder="Name oder zugehöriger Dateipfad"
                />
                <Auswahlfeld
                  beschriftung="Entwürfe nach Sprache filtern"
                  value={entwurfSprache}
                  onChange={(e) => setEntwurfSprache(e.target.value as Sprachfilter)}
                >
                  <option value="alle">Alle Sprachen</option>
                  <option value="python">Python</option>
                  <option value="vbs">VBScript (VBS)</option>
                </Auswahlfeld>
                <Auswahlfeld
                  beschriftung="Entwürfe sortieren"
                  value={entwurfSortierung}
                  onChange={(e) => setEntwurfSortierung(e.target.value as Sortierung)}
                >
                  <option value="zuletzt">Zuletzt gesichert</option>
                  <option value="name">Name A–Z</option>
                </Auswahlfeld>
                <Knopf
                  symbol="wiederholen"
                  onClick={(event) => {
                    aktualisierungsFokus.current = event.currentTarget;
                    props.aktualisieren();
                  }}
                  disabled={gesperrt || props.laden}
                  grundId={gesperrt ? 'start-verarbeitung' : 'start-bibliothek-status'}
                >
                  Aktualisieren
                </Knopf>
              </div>
              <p id="start-bibliothek-status" role="status" className="start-ergebniszahl">
                {props.laden
                  ? 'Bibliothek wird geladen …'
                  : props.daten?.hinweis
                    ? 'Anzeige möglicherweise unvollständig'
                    : props.daten
                      ? `${entwuerfe.length} ${entwuerfe.length === 1 ? 'Entwurf' : 'Entwürfe'}${entwurfSuche.trim() || entwurfSprache !== 'alle' ? ' gefunden' : ''}`
                      : 'Bibliothek noch nicht geladen'}
              </p>
              {entwuerfe.length ? (
                <div className="start-liste">
                  {entwuerfe.map((entwurf) => (
                    <article
                      className="start-listeneintrag"
                      key={entwurf.id}
                      aria-label={entwurf.name}
                      data-entwurf-id={entwurf.id}
                    >
                      <h3>{entwurf.name}</h3>
                      <span className="skriptsprache-kennzeichen">
                        {sprachdaten[entwurf.skriptsprache].bezeichnung}
                      </span>
                      <p>
                        {entwurf.ausgangspfad
                          ? 'Gesicherte Änderungen zu einer Projektdatei'
                          : 'Noch nicht als Projektdatei gespeichert'}
                      </p>
                      <p className="start-metadaten">
                        Entwurf gesichert am {zeitDarstellen(entwurf.gesichertAm)}
                      </p>
                      {entwurf.beschreibung && <p>{entwurf.beschreibung}</p>}
                      {entwurf.ausgangspfad && (
                        <Textfeld
                          beschriftung="Zugehörige Projektdatei"
                          value={entwurf.ausgangspfad}
                          readOnly
                          rows={2}
                          spellCheck={false}
                          className="start-pfad"
                        />
                      )}
                      <div className="start-eintrag-aktionen">
                        <Knopf
                          symbol="rechts"
                          onClick={() => props.entwurfFortsetzen(entwurf.id)}
                          disabled={gesperrt}
                          grundId="start-verarbeitung"
                        >
                          Fortsetzen
                        </Knopf>
                        <Knopf
                          symbol="speichern"
                          onClick={() => props.entwurfSpeichernUnter(entwurf.id)}
                          disabled={gesperrt}
                          grundId="start-verarbeitung"
                        >
                          Als Projekt speichern
                        </Knopf>
                        <Knopf
                          variante="gefahr"
                          symbol="loeschen"
                          onClick={() => props.entwurfLoeschen(entwurf.id)}
                          disabled={gesperrt}
                          grundId="start-verarbeitung"
                        >
                          Entwurf löschen
                        </Knopf>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="start-leerzustand">
                  {datenStatus(
                    entwurfSuche.trim() || entwurfSprache !== 'alle'
                      ? 'Keine passenden Entwürfe gefunden. Ändere die Suche oder den Sprachfilter.'
                      : 'Keine gesicherten Entwürfe vorhanden.',
                  )}
                  {entwurfSuche && <Knopf onClick={() => setEntwurfSuche('')}>Suche leeren</Knopf>}
                  {entwurfSprache !== 'alle' && (
                    <Knopf onClick={() => setEntwurfSprache('alle')}>Sprachfilter zurücksetzen</Knopf>
                  )}
                </div>
              )}
            </section>
          )}

          {seite === 'beispiele' && (
            <VorlagenBereich
              vorlagen={beispiele}
              filter={vorlagenFilter}
              aendern={setVorlagenFilter}
              auswahl={vorlagenAuswahl}
              auswaehlen={setVorlagenAuswahl}
              gesperrt={gesperrt}
              oeffnen={props.beispielOeffnen}
            />
          )}

          {seite === 'hilfe' && (
            <section data-testid="hilfe" aria-label="Lokale Hilfe">
              {!artikel && (
                <>
                  <p className="start-einleitung">
                    Diese Hilfe ist vollständig lokal verfügbar und benötigt keine Internetverbindung.
                  </p>
                  <div className="start-hilfesuche">
                    <Feld
                      beschriftung="Hilfe durchsuchen"
                      type="search"
                      value={hilfeSuche}
                      onChange={(e) => setHilfeSuche(e.target.value)}
                      placeholder="Zum Beispiel Dateipfad oder Speichern"
                    />
                    {hilfeSuche && <Knopf onClick={() => setHilfeSuche('')}>Suche leeren</Knopf>}
                  </div>
                  {hilfeSuche.trim() ? (
                    <>
                      <p role="status" className="start-ergebniszahl">
                        {treffer.length
                          ? `${treffer.length} ${treffer.length === 1 ? 'Artikelstelle gefunden' : 'Artikelstellen gefunden'}`
                          : 'Keine Hilfe gefunden. Versuche einen anderen Suchbegriff.'}
                      </p>
                      <div className="start-hilfe-treffer">
                        {treffer.map((t) => (
                          <button
                            key={`${t.artikelId}/${t.abschnittId}`}
                            onClick={() => seiteWechseln('hilfe', t.artikelId, t.abschnittId)}
                          >
                            <span className="start-treffertitel">
                              {t.artikelTitel} · {t.abschnittTitel}
                            </span>
                            <span>{markieren(t.ausschnitt, hilfeSuche)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="start-themen">
                      {hilfeArtikel.map((thema) => (
                        <button
                          key={thema.id}
                          aria-label={thema.titel}
                          onClick={() => seiteWechseln('hilfe', thema.id)}
                        >
                          <span>
                            <strong>{thema.titel}</strong>
                            <span>{thema.beschreibung}</span>
                          </span>
                          <Symbol name="rechts" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {artikel && (
                <article className="start-hilfeartikel">
                  <p className="start-einleitung">{artikel.beschreibung}</p>
                  {artikel.abschnitte.map((abschnitt) => {
                    const verknuepfteBeispiele = beispiele.filter(
                      (b) => b.id === abschnitt.beispiel || b.id === `${abschnitt.beispiel}-python`,
                    );
                    return (
                      <section key={abschnitt.id} aria-labelledby={`hilfe-${abschnitt.id}`}>
                        <h2 id={`hilfe-${abschnitt.id}`} tabIndex={-1}>
                          {abschnitt.titel}
                        </h2>
                        {abschnitt.texte.map((text) => (
                          <p key={text}>{text}</p>
                        ))}
                        {abschnitt.schritte && (
                          <ol>
                            {abschnitt.schritte.map((schritt) => (
                              <li key={schritt}>{schritt}</li>
                            ))}
                          </ol>
                        )}
                        {verknuepfteBeispiele.map((beispiel) => (
                          <Knopf
                            key={beispiel.id}
                            symbol="neu"
                            onClick={() => props.beispielOeffnen(beispiel.id)}
                            disabled={gesperrt}
                            grundId="start-verarbeitung"
                          >
                            Beispiel als Vorlage öffnen: {beispiel.name} ·{' '}
                            {sprachdaten[beispiel.skriptsprache].kurzbezeichnung}
                          </Knopf>
                        ))}
                      </section>
                    );
                  })}
                </article>
              )}
            </section>
          )}
        </div>
      </main>
    </section>
  );
}
