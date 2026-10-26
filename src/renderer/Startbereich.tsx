import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { EntwurfEintrag, ProjektBibliothek, ProjektEintrag, Verfuegbarkeit } from '../gemeinsam/bruecke';
import { beispiele, hilfeArtikel, hilfeDurchsuchen, type BeispielKennung } from './hilfe';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld, Textfeld } from './komponenten/Feld';
import { Symbol, type SymbolName } from './komponenten/Icon';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './startbereich.css';

type Seite = 'start' | 'projekte' | 'entwuerfe' | 'beispiele' | 'hilfe';
type Sortierung = 'zuletzt' | 'name';

export interface AktiverWorkflowInfo {
  name: string;
  dateiname: string | null;
  geaendert: boolean;
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
  ziel?: 'start' | 'hilfe';
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
    beschreibung: 'Gespeicherte Projekte ansehen und weiterbearbeiten.',
  },
  {
    seite: 'entwuerfe',
    symbol: 'entwurf',
    beschreibung: 'Noch nicht als Datei gespeicherte Abläufe und gesicherte Änderungen fortsetzen.',
  },
  {
    seite: 'beispiele',
    symbol: 'bausteine',
    beschreibung: 'An fertigen Beispielen lernen und eigene Abläufe daraus erstellen.',
  },
  {
    seite: 'hilfe',
    symbol: 'buch',
    beschreibung: 'Funktionen kennenlernen und Schritt für Schritt nachlesen.',
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
): ProjektEintrag[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  return projekte
    .filter((p) => `${p.name} ${p.pfad}`.toLocaleLowerCase('de').includes(filter))
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
): EntwurfEintrag[] {
  const filter = suche.trim().toLocaleLowerCase('de');
  return entwuerfe
    .filter((e) => `${e.name} ${e.ausgangspfad ?? ''}`.toLocaleLowerCase('de').includes(filter))
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
  const [projektSuche, setProjektSuche] = useState('');
  const [projektSortierung, setProjektSortierung] = useState<Sortierung>('zuletzt');
  const [entwurfSuche, setEntwurfSuche] = useState('');
  const [entwurfSortierung, setEntwurfSortierung] = useState<Sortierung>('zuletzt');
  const [hilfeSuche, setHilfeSuche] = useState('');
  const [artikelId, setArtikelId] = useState<string | null>(null);
  const [sprungziel, setSprungziel] = useState<string | null>(null);
  const inhalt = useRef<HTMLElement>(null);
  const seitentitelRef = useRef<HTMLHeadingElement>(null);
  const ansicht = artikelId && seite === 'hilfe' ? `hilfe/${artikelId}` : seite;
  const letzteAnsicht = useRef(ansicht);
  const positionen = useRef<Record<string, number>>({});
  const zielVorher = useRef(props.ziel);
  const zielAnfrageVorher = useRef(props.zielAnfrage);

  function seiteWechseln(neu: Seite, artikel: string | null = null, abschnitt: string | null = null) {
    positionen.current[ansicht] = inhalt.current?.scrollTop ?? 0;
    setSeite(neu);
    setArtikelId(artikel);
    setSprungziel(abschnitt);
  }

  // Root kann die lokale Hilfe aus dem Editor öffnen, ohne Such- und Sortierzustände zu löschen.
  useLayoutEffect(() => {
    if (props.ziel !== zielVorher.current || props.zielAnfrage !== zielAnfrageVorher.current) {
      zielVorher.current = props.ziel;
      zielAnfrageVorher.current = props.zielAnfrage;
      seiteWechseln(props.ziel ?? 'start');
    }
  }, [props.ziel, props.zielAnfrage]);

  useLayoutEffect(() => {
    const panel = inhalt.current;
    if (!panel) return;
    if (sprungziel) {
      const ziel = panel.querySelector<HTMLElement>(`#hilfe-${sprungziel}`);
      if (ziel) {
        ziel.scrollIntoView({ block: 'start' });
        ziel.focus({ preventScroll: true });
      }
    } else if (letzteAnsicht.current !== ansicht) {
      const vorherigePosition = positionen.current[ansicht] ?? 0;
      panel.scrollTop = vorherigePosition;
      // Bei wiederhergestelltem Ausschnitt bleibt der Fokus im sichtbaren Scrollbereich.
      if (vorherigePosition > 0) panel.focus({ preventScroll: true });
      else seitentitelRef.current?.focus({ preventScroll: true });
    }
    letzteAnsicht.current = ansicht;
  }, [ansicht, sprungziel]);

  const gesperrt = Boolean(props.verarbeitung);
  const artikel = hilfeArtikel.find((a) => a.id === artikelId);
  const treffer = hilfeDurchsuchen(hilfeSuche);
  const projekte = props.daten ? projekteFiltern(props.daten.projekte, projektSuche, projektSortierung) : [];
  const entwuerfe = props.daten
    ? entwuerfeFiltern(props.daten.entwuerfe, entwurfSuche, entwurfSortierung)
    : [];
  const letzteProjekte = props.daten ? zuletztGeoeffnete(props.daten.projekte) : [];

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
        className="start-listeneintrag"
        key={projekt.id}
        aria-label={`${projekt.name} – ${projekt.pfad}`}
        data-projekt-id={projekt.id}
      >
        <div className="start-eintrag-kopf">
          <h3>{projekt.name}</h3>
          <span
            className={`start-dateistatus ${fehlt ? 'start-dateistatus--fehler' : zustand === 'geaendert' ? 'start-dateistatus--hinweis' : ''}`}
          >
            <Symbol name={fehlt ? 'hinweis' : zustand === 'verfuegbar' ? 'erfolg' : 'info'} groesse={16} />
            {zustandsname}
          </span>
        </div>
        {projekt.beschreibung && !kompakt && <p>{projekt.beschreibung}</p>}
        <Textfeld
          beschriftung="Dateipfad"
          value={projekt.pfad}
          readOnly
          rows={2}
          spellCheck={false}
          className="start-pfad"
          aria-label={`Dateipfad: ${projekt.name}`}
        />
        <p className="start-metadaten">Zuletzt geöffnet: {zeitDarstellen(projekt.zuletztGeoeffnet)}</p>
        <p id={statusId} className={fehlt ? 'start-fehlertext' : 'start-hilfetext'}>
          {pruefung?.meldung || zustandsname}
        </p>
        <div className="start-eintrag-aktionen">
          <Knopf
            symbol="oeffnen"
            disabled={gesperrt || fehlt}
            grundId={gesperrt ? 'start-verarbeitung' : fehlt ? statusId : undefined}
            onClick={() => props.projektOeffnen(projekt.id)}
          >
            Öffnen
          </Knopf>
          {!kompakt && (
            <>
              <Knopf
                symbol="oeffnen"
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
      </article>
    );
  }

  return (
    <section className="startbereich" data-testid="startbereich" aria-label="ScriptLab-Startbereich">
      <header className="start-kopf">
        <button className="start-marke" onClick={() => seiteWechseln('start')} aria-label="Startseite">
          <Symbol name="bausteine" />
          <span>ScriptLab</span>
        </button>
        <nav aria-label="Anwendungsfunktionen">
          <Knopf variante="leise" symbol="einstellungen" onClick={props.einstellungenOeffnen}>
            Einstellungen
          </Knopf>
          <Knopf variante="leise" symbol="buch" onClick={() => seiteWechseln('hilfe')}>
            Hilfe
          </Knopf>
          <Knopf variante="leise" symbol="info" onClick={props.ueberOeffnen}>
            Über ScriptLab
          </Knopf>
        </nav>
      </header>
      <main
        ref={inhalt}
        className="start-scrollbereich"
        data-testid="start-inhalt"
        tabIndex={-1}
        aria-label={seitentitel[seite]}
        onScroll={(event) => {
          positionen.current[ansicht] = event.currentTarget.scrollTop;
        }}
      >
        <div className="start-inhalt">
          <div className="start-seitenkopf">
            {seite !== 'start' && (
              <Knopf
                variante="leise"
                symbol="links"
                onClick={() => seiteWechseln(artikel ? 'hilfe' : 'start')}
              >
                {artikel ? 'Zur Themenübersicht' : 'Zur Startseite'}
              </Knopf>
            )}
            <h1 ref={seitentitelRef} tabIndex={-1}>
              {artikel && seite === 'hilfe' ? artikel.titel : seitentitel[seite]}
            </h1>
            {seite === 'start' && (
              <p>Erstelle einen neuen Ablauf oder arbeite an einem vorhandenen weiter.</p>
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
                {props.aktiveInfo && (
                  <Knopf
                    symbol="rechts"
                    disabled={gesperrt}
                    grundId="start-verarbeitung"
                    onClick={props.weiterbearbeiten}
                  >
                    Weiterbearbeiten
                  </Knopf>
                )}
              </div>
              {props.aktiveInfo && (
                <p className="start-aktiver-workflow">
                  Aktueller Workflow: <strong>{props.aktiveInfo.name}</strong> ·{' '}
                  {props.aktiveInfo.geaendert
                    ? 'Ungespeicherte Änderungen'
                    : props.aktiveInfo.dateiname
                      ? 'Projekt gespeichert'
                      : 'Noch nicht als Projektdatei gespeichert'}
                </p>
              )}
              {Boolean(props.daten?.entwuerfe.length) && (
                <div className="start-rueckmeldung start-entwurfshinweis" data-testid="entwuerfe-hinweis">
                  <Statusanzeige art="hinweis">
                    Es sind lokal gesicherte Entwürfe vorhanden. Öffne Entwürfe, um sie bewusst fortzusetzen.
                  </Statusanzeige>
                  <Knopf onClick={() => seiteWechseln('entwuerfe')}>Entwürfe anzeigen</Knopf>
                </div>
              )}
              <div className="start-karten" data-testid="start-karten">
                {karten.map((karte) => (
                  <button
                    key={karte.seite}
                    className="start-karte"
                    aria-label={seitentitel[karte.seite]}
                    onClick={() => seiteWechseln(karte.seite)}
                  >
                    <Symbol name={karte.symbol} groesse={24} />
                    <span className="start-karte-inhalt">
                      <span className="start-karte-titel">{seitentitel[karte.seite]}</span>
                      <span className="start-karte-beschreibung">{karte.beschreibung}</span>
                      <span className="start-karte-metadaten">
                        {karte.seite === 'projekte'
                          ? props.daten?.hinweis
                            ? 'Bestand nicht vollständig geladen'
                            : props.daten
                              ? `${props.daten.projekte.length} ${props.daten.projekte.length === 1 ? 'Projekt' : 'Projekte'} bekannt`
                              : props.laden
                                ? 'Wird geladen …'
                                : 'Bibliothek nicht geladen'
                          : karte.seite === 'entwuerfe'
                            ? props.daten?.hinweis
                              ? 'Bestand nicht vollständig geladen'
                              : props.daten
                                ? `${props.daten.entwuerfe.length} ${props.daten.entwuerfe.length === 1 ? 'Entwurf' : 'Entwürfe'} gesichert`
                                : props.laden
                                  ? 'Wird geladen …'
                                  : 'Bibliothek nicht geladen'
                            : karte.seite === 'beispiele'
                              ? `${beispiele.length} lokale Beispiele`
                              : `${hilfeArtikel.length} lokale Anleitungen`}
                      </span>
                    </span>
                    <Symbol name="rechts" />
                  </button>
                ))}
              </div>
              <section
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
                {letzteProjekte.length ? (
                  <div className="start-liste">{letzteProjekte.map((p) => projektZeile(p, true))}</div>
                ) : (
                  datenStatus(
                    'Noch kein Projekt ausdrücklich geöffnet. Nutze „Workflow öffnen“ oder beginne einen neuen Workflow.',
                  )
                )}
              </section>
            </>
          )}

          {seite === 'projekte' && (
            <section data-testid="bekannte-projekte" aria-label="Bekannte Projektdateien">
              <p className="start-einleitung">
                Bekannte Speicherorte deiner Projektdateien. „Aus Liste entfernen“ löscht nur den Verweis,
                nicht die Datei.
              </p>
              <div className="start-listenfilter">
                <Feld
                  beschriftung="Projekte suchen"
                  type="search"
                  value={projektSuche}
                  onChange={(e) => setProjektSuche(e.target.value)}
                  placeholder="Name oder Dateipfad"
                />
                <Auswahlfeld
                  beschriftung="Projekte sortieren"
                  value={projektSortierung}
                  onChange={(e) => setProjektSortierung(e.target.value as Sortierung)}
                >
                  <option value="zuletzt">Zuletzt geöffnet</option>
                  <option value="name">Name A–Z</option>
                </Auswahlfeld>
                <Knopf
                  symbol="wiederholen"
                  onClick={props.aktualisieren}
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
                      ? `${projekte.length} ${projekte.length === 1 ? 'Projekt' : 'Projekte'}${projektSuche.trim() ? ' gefunden' : ''}`
                      : 'Bibliothek noch nicht geladen'}
              </p>
              {projekte.length ? (
                <div className="start-liste">{projekte.map((p) => projektZeile(p))}</div>
              ) : (
                <div className="start-leerzustand">
                  {datenStatus(
                    projektSuche.trim()
                      ? 'Keine Projekte gefunden. Ändere die Suche oder leere sie.'
                      : 'Noch keine Projektdateien bekannt. Öffne eine .scriptlab-Datei oder speichere einen eigenen Workflow.',
                  )}
                  {projektSuche && <Knopf onClick={() => setProjektSuche('')}>Suche leeren</Knopf>}
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
                  beschriftung="Entwürfe sortieren"
                  value={entwurfSortierung}
                  onChange={(e) => setEntwurfSortierung(e.target.value as Sortierung)}
                >
                  <option value="zuletzt">Zuletzt gesichert</option>
                  <option value="name">Name A–Z</option>
                </Auswahlfeld>
                <Knopf
                  symbol="wiederholen"
                  onClick={props.aktualisieren}
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
                      ? `${entwuerfe.length} ${entwuerfe.length === 1 ? 'Entwurf' : 'Entwürfe'}${entwurfSuche.trim() ? ' gefunden' : ''}`
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
                    entwurfSuche.trim()
                      ? 'Keine Entwürfe gefunden. Ändere die Suche oder leere sie.'
                      : 'Keine gesicherten Entwürfe vorhanden.',
                  )}
                  {entwurfSuche && <Knopf onClick={() => setEntwurfSuche('')}>Suche leeren</Knopf>}
                </div>
              )}
            </section>
          )}

          {seite === 'beispiele' && (
            <section data-testid="beispiele" aria-label="Lokale Beispielworkflows">
              <p className="start-einleitung">
                Öffne ein Beispiel als eigene bearbeitbare Kopie. Das Original bleibt erhalten. Öffnen und
                Exportieren lösen keine beschriebenen Dateiaktionen aus.
              </p>
              <div className="start-liste">
                {beispiele.map((beispiel) => (
                  <article
                    className="start-listeneintrag start-beispiel"
                    key={beispiel.id}
                    aria-label={beispiel.name}
                  >
                    <h2>{beispiel.name}</h2>
                    <p>{beispiel.beschreibung}</p>
                    <ul>
                      {beispiel.lernziele.map((ziel) => (
                        <li key={ziel}>{ziel}</li>
                      ))}
                    </ul>
                    <p className="start-hilfetext">{beispiel.vorbereitung}</p>
                    <p className="start-metadaten">Vorlage: {beispiel.dateiname}</p>
                    <div>
                      <Knopf
                        symbol="neu"
                        onClick={() => props.beispielOeffnen(beispiel.id)}
                        disabled={gesperrt}
                        grundId="start-verarbeitung"
                      >
                        Als Vorlage öffnen
                      </Knopf>
                    </div>
                  </article>
                ))}
              </div>
            </section>
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
                    const beispiel = beispiele.find((b) => b.id === abschnitt.beispiel);
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
                        {beispiel && (
                          <Knopf
                            symbol="neu"
                            onClick={() => props.beispielOeffnen(beispiel.id)}
                            disabled={gesperrt}
                            grundId="start-verarbeitung"
                          >
                            Beispiel als Vorlage öffnen: {beispiel.name}
                          </Knopf>
                        )}
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
