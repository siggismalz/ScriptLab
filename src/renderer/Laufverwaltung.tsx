import { useEffect, useMemo, useRef, useState } from 'react';
import { testAktiv, type LaufEintrag, type TestZustand } from '../gemeinsam/testlauf';
import { Testbereich, laufzeitAnzeigen, type TestbereichEigenschaften } from './Testbereich';
import { Knopf } from './komponenten/Knopf';
import { Feld, Auswahlfeld } from './komponenten/Feld';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './laufverwaltung.css';

interface LaufverwaltungEigenschaften extends TestbereichEigenschaften {
  projektKennung: string;
  workflowStand: string;
  sichtbar: boolean;
  vorbereitungAnfrage: number;
}

const phasen: Record<string, string> = {
  beendet: 'Beendet',
  mit_fehlern: 'Mit Fehlern beendet',
  fehlgeschlagen: 'Fehlgeschlagen',
  abgebrochen: 'Abgebrochen',
  zeitlimit: 'Zeitlimit erreicht',
};
function zeit(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : 'Nicht gestartet';
}
function modus(art: string | undefined) {
  return art === 'vorschau' ? 'Datenvorschau' : art === 'prueflauf' ? 'Prüflauf' : 'Ausführung';
}

/** Die Auswahl öffnet gespeicherte Ergebnisse; ausschließlich „Starten“ erzeugt einen neuen Lauf. */
export function Laufverwaltung(props: LaufverwaltungEigenschaften) {
  const { zustand: aktuell } = props;
  const aktiv = testAktiv(aktuell.phase);
  const laufStatus =
    aktuell.phase === 'vorbereitung'
      ? 'Lauf wird vorbereitet.'
      : aktuell.phase === 'stoppt'
        ? 'Wird gestoppt.'
        : 'Ein Workflow läuft weiter.';
  const [eintraege, setEintraege] = useState<LaufEintrag[]>([]);
  const [listeOffen, setListeOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<{
    zustand: TestZustand;
    standAktuell: boolean;
    workflowStand: string;
  } | null>(null);
  const [filter, setFilter] = useState('');
  const [modusFilter, setModusFilter] = useState('alle');
  const [seite, setSeite] = useState(0);
  const [vorbereitung, setVorbereitung] = useState(0);
  const [detailLaedt, setDetailLaedt] = useState<string | null>(null);
  const ersteListe = useRef(true);
  const absicht = useRef(false);
  const anfrage = useRef(0);
  const anforderung = useRef(props.vorbereitungAnfrage);
  const uebersichtAnfrage = useRef(props.uebersichtAnfordern);
  const listeRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  async function listeLaden() {
    setLaedt(true);
    try {
      const r = await window.scriptlab.laufListe();
      if (!r.ok) throw new Error(r.meldung);
      setEintraege(r.wert.eintraege);
      setHinweis(r.wert.hinweis);
      setFehler('');
      if (ersteListe.current && !aktuell.laufId && !absicht.current && r.wert.eintraege.length)
        setListeOffen(true);
      ersteListe.current = false;
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Läufe konnten nicht geladen werden.');
    } finally {
      setLaedt(false);
    }
  }
  useEffect(() => {
    if (props.sichtbar) void listeLaden();
  }, [props.sichtbar, aktuell.laufId, aktuell.phase]);
  useEffect(
    () => () => {
      anfrage.current++;
    },
    [],
  );
  useEffect(() => {
    if (!aktiv) return;
    anfrage.current++;
    setAuswahl(null);
    setListeOffen(false);
    setDetailLaedt(null);
  }, [aktuell.laufId, aktiv]);
  useEffect(() => {
    if (anforderung.current === props.vorbereitungAnfrage) return;
    anforderung.current = props.vorbereitungAnfrage;
    vorbereiten();
  }, [props.vorbereitungAnfrage]);
  useEffect(() => {
    if (uebersichtAnfrage.current === props.uebersichtAnfordern) return;
    uebersichtAnfrage.current = props.uebersichtAnfordern;
    absicht.current = true;
    anfrage.current++;
    setAuswahl(null);
    setListeOffen(false);
    setDetailLaedt(null);
    requestAnimationFrame(() => detailRef.current?.focus());
  }, [props.uebersichtAnfordern]);

  function vorbereiten() {
    absicht.current = true;
    anfrage.current++;
    setAuswahl(null);
    setListeOffen(false);
    setDetailLaedt(null);
    setVorbereitung((n) => n + 1);
  }
  async function waehlen(eintrag: LaufEintrag) {
    const nummer = ++anfrage.current;
    setDetailLaedt(eintrag.laufId);
    setFehler('');
    try {
      const r = await window.scriptlab.laufLesen(eintrag.laufId);
      if (nummer !== anfrage.current) return;
      if (!r.ok) throw new Error(r.meldung);
      setAuswahl({ ...r.wert, workflowStand: props.workflowStand });
      setListeOffen(false);
      requestAnimationFrame(() => detailRef.current?.focus());
    } catch (e) {
      if (nummer === anfrage.current)
        setFehler(e instanceof Error ? e.message : 'Der Lauf konnte nicht geöffnet werden.');
    } finally {
      if (nummer === anfrage.current) setDetailLaedt(null);
    }
  }
  const gefiltert = useMemo(() => {
    const suche = filter.trim().toLocaleLowerCase('de');
    return eintraege.filter(
      (e) =>
        (modusFilter === 'alle' || e.modus === modusFilter) &&
        (!suche ||
          `${zeit(e.gestartetAm ?? e.vorbereitetAm)} ${modus(e.modus)} ${phasen[e.phase]} ${e.sprache} ${e.standHash}`
            .toLocaleLowerCase('de')
            .includes(suche)),
    );
  }, [eintraege, filter, modusFilter]);
  const letzteSeite = Math.max(0, Math.ceil(gefiltert.length / 20) - 1);
  const aktuelleSeite = Math.min(seite, letzteSeite);
  const zustand = auswahl?.zustand ?? aktuell;
  const historisch = Boolean(auswahl);
  const veraltet = auswahl
    ? !auswahl.standAktuell || auswahl.workflowStand !== props.workflowStand
    : props.veraltet;
  const kopieren = async () => {
    if (!zustand.laufId) return;
    const r = await window.scriptlab.laufProtokollKopieren(zustand.laufId);
    if (!r.ok) setFehler(r.meldung);
  };

  return (
    <section className="laufverwaltung" aria-label="Läufe dieses Workflows">
      {listeOffen && (
        <header className="laufverwaltung-kontext">
          <div>
            <h2>Gespeicherte Läufe</h2>
            {aktiv && <span role="status">{laufStatus}</span>}
          </div>
          <div className="knopfgruppe">
            <Knopf
              variante={aktiv ? 'leise' : 'primaer'}
              onClick={() => {
                if (aktiv) {
                  setAuswahl(null);
                  setListeOffen(false);
                } else vorbereiten();
              }}
            >
              {aktiv ? 'Aktuellen Lauf anzeigen' : 'Neuen Lauf vorbereiten'}
            </Knopf>
            {aktiv && (
              <Knopf
                variante="gefahr"
                symbol="stoppen"
                onClick={props.stoppen}
                disabled={aktuell.phase === 'stoppt'}
                grund="Der Prozess wird bereits gestoppt."
              >
                Stoppen
              </Knopf>
            )}
          </div>
        </header>
      )}
      {aktiv && historisch && !listeOffen && (
        <div className="laufverwaltung-aktiv" role="status">
          <span>{laufStatus}</span>
          <div className="knopfgruppe">
            <Knopf
              variante="leise"
              onClick={() => {
                setAuswahl(null);
                setListeOffen(false);
              }}
            >
              Aktuellen Lauf anzeigen
            </Knopf>
            <Knopf
              variante="gefahr"
              symbol="stoppen"
              onClick={props.stoppen}
              disabled={aktuell.phase === 'stoppt'}
              grund="Der Prozess wird bereits gestoppt."
            >
              Stoppen
            </Knopf>
          </div>
        </div>
      )}
      {hinweis && <Statusanzeige art="hinweis">{hinweis}</Statusanzeige>}
      {fehler && (
        <Statusanzeige art="fehler">
          <span>{fehler}</span>
          <Knopf variante="leise" onClick={() => void listeLaden()}>
            Erneut laden
          </Knopf>
        </Statusanzeige>
      )}
      <div ref={listeRef} tabIndex={-1} hidden={!listeOffen} className="laufverwaltung-liste">
        <div className="laufverwaltung-filter">
          <Feld
            beschriftung="In Läufen dieses Workflows suchen"
            value={filter}
            type="search"
            onChange={(e) => {
              setFilter(e.target.value);
              setSeite(0);
            }}
          />
          <Auswahlfeld
            beschriftung="Läufe nach Modus filtern"
            value={modusFilter}
            onChange={(e) => {
              setModusFilter(e.target.value);
              setSeite(0);
            }}
          >
            <option value="alle">Alle Modi</option>
            <option value="vorschau">Datenvorschau</option>
            <option value="prueflauf">Prüflauf</option>
            <option value="ausfuehren">Ausführung</option>
          </Auswahlfeld>
          <Knopf variante="leise" onClick={() => void listeLaden()} verarbeitung={laedt}>
            Aktualisieren
          </Knopf>
        </div>
        {!gefiltert.length ? (
          <p>
            {laedt
              ? 'Läufe werden geladen …'
              : eintraege.length
                ? 'Keine Läufe passen zur Suche.'
                : 'Für diesen Workflow sind noch keine Läufe gespeichert.'}
          </p>
        ) : (
          <>
            <p className="laufverwaltung-umfang">
              {gefiltert.length} {gefiltert.length === 1 ? 'Lauf' : 'Läufe'}
              {filter || modusFilter !== 'alle' ? ` von ${eintraege.length}` : ''} · Neueste zuerst
            </p>
            <div className="laufverwaltung-tabelle">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Zeitpunkt</th>
                    <th scope="col">Modus</th>
                    <th scope="col">Status</th>
                    <th scope="col">Dauer</th>
                    <th scope="col">
                      <span className="sl-nur-vorlesen">Aktion</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gefiltert.slice(aktuelleSeite * 20, aktuelleSeite * 20 + 20).map((e) => (
                    <tr key={e.laufId} aria-selected={e.laufId === zustand.laufId}>
                      <td>
                        <time dateTime={e.gestartetAm ?? e.vorbereitetAm ?? undefined}>
                          {zeit(e.gestartetAm ?? e.vorbereitetAm)}
                        </time>
                        <span className="laufverwaltung-stand" title={e.standHash}>
                          Stand {e.standHash.slice(0, 8)}
                        </span>
                      </td>
                      <td>{modus(e.modus)}</td>
                      <td>
                        <span className={`laufverwaltung-status ist-${e.phase}`}>{phasen[e.phase]}</span>
                      </td>
                      <td className="laufverwaltung-dauer">
                        {laufzeitAnzeigen(e.gestartetAm, e.beendetAm, Date.now())}
                      </td>
                      <td>
                        <Knopf
                          onClick={() => void waehlen(e)}
                          verarbeitung={detailLaedt === e.laufId}
                          aria-label={`Lauf vom ${zeit(e.gestartetAm ?? e.vorbereitetAm)} anzeigen`}
                        >
                          Anzeigen
                        </Knopf>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {letzteSeite > 0 && (
              <div className="laufverwaltung-seiten">
                <Knopf
                  disabled={aktuelleSeite === 0}
                  grund="Du bist auf der ersten Seite."
                  onClick={() => setSeite((n) => n - 1)}
                >
                  Zurück
                </Knopf>
                <span>
                  Seite {aktuelleSeite + 1} von {letzteSeite + 1}
                </span>
                <Knopf
                  disabled={aktuelleSeite === letzteSeite}
                  grund="Du bist auf der letzten Seite."
                  onClick={() => setSeite((n) => n + 1)}
                >
                  Weiter
                </Knopf>
              </div>
            )}
          </>
        )}
      </div>
      <div ref={detailRef} tabIndex={-1} hidden={listeOffen} className="laufverwaltung-details">
        <Testbereich
          {...props}
          key={zustand.laufId ?? 'vorbereitung'}
          zustand={zustand}
          veraltet={veraltet}
          historisch={historisch}
          vorbereitungAnfordern={vorbereitung}
          neuenLaufVorbereiten={vorbereiten}
          kopfNavigation={
            <Knopf
              variante="leise"
              onClick={() => {
                setListeOffen(true);
                requestAnimationFrame(() => listeRef.current?.focus());
              }}
            >
              Alle Läufe{eintraege.length > 0 ? ` (${eintraege.length})` : ''}
            </Knopf>
          }
          gesperrt={props.gesperrt || (historisch && aktiv)}
          kopieren={() => void kopieren()}
          protokollSpeichern={() => {
            if (zustand.laufId)
              void window.scriptlab.laufProtokollSpeichern(zustand.laufId).then((r) => {
                if (!r.ok) setFehler(r.meldung);
              });
          }}
          dateiAnzeigen={async (art, index) => {
            if (!zustand.laufId) return;
            const r = await window.scriptlab.laufDateiAnzeigen(zustand.laufId, art, index);
            if (!r.ok) throw new Error(r.meldung);
          }}
          blockAnzeigen={(id) => {
            if (!veraltet) props.blockAnzeigen(id);
          }}
        />
      </div>
    </section>
  );
}
