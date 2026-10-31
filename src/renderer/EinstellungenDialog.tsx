import { useEffect, useState } from 'react';
import type { Einstellungen } from '../gemeinsam/bruecke';
import type { Projekt } from '../kern/projekt';
import type { Zertifikat } from '../windows/signatur';
import type { UpdateZustand } from '../windows/updates';
import { Dialog } from './komponenten/Dialog';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld } from './komponenten/Feld';
import { Karte } from './komponenten/Karte';
import { Statusanzeige } from './komponenten/Statusanzeige';
import type { PythonStatus } from '../gemeinsam/python';
import type { BusinessStatus } from '../gemeinsam/business-laufzeit';
import type { MLStatus, MLFortschritt } from '../gemeinsam/ml-laufzeit';
import { MlLaufzeit } from './MlLaufzeit';
import './einstellungen-laufzeit.css';

export function EinstellungenDialog({
  projektOptionenAnzeigen = true,
  offen,
  schliessen,
  einstellungen,
  setzen,
  projekt,
  exportOptionenSetzen,
  zertifikate,
  zertifikateLaden,
  zertifikatMeldung,
  update,
  updateAktion,
  verarbeitung,
  fehlerMeldung,
  pythonStatus,
  pythonAktion,
}: {
  businessGewechselt?: () => void;
  projektOptionenAnzeigen?: boolean;
  offen: boolean;
  schliessen: () => void;
  einstellungen: Einstellungen;
  setzen: (neu: Einstellungen) => void;
  projekt: Projekt;
  exportOptionenSetzen: (neu: Projekt['exportOptionen']) => void;
  version: string;
  zertifikate: Zertifikat[];
  zertifikateLaden: () => void;
  zertifikatMeldung: string;
  update: UpdateZustand | null;
  updateAktion: (art: 'pruefen' | 'laden' | 'installieren') => void;
  verarbeitung: string | null;
  fehlerMeldung: string | null;
  pythonStatus: PythonStatus | null;
  pythonAktion: (aktion: 'pruefen' | 'waehlen' | 'hilfe') => void;
}) {
  const [bereich, setBereich] = useState('darstellung');
  const bereiche = [
    { id: 'darstellung', text: 'Aussehen' },
    { id: 'laufzeit', text: 'Automatisierungen' },
    { id: 'updates', text: 'Updates' },
  ];
  const [zeitstempelEntwurf, setZeitstempelEntwurf] = useState(projekt.exportOptionen.zeitstempelUrl);
  const [zeitstempelFehler, setZeitstempelFehler] = useState('');
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus | null>(null);
  const [komponentenFehler, setKomponentenFehler] = useState('');
  const [komponentenLaden, setKomponentenLaden] = useState(false);
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlAktiv, setMlAktiv] = useState(false);
  const [mlFortschritt, setMlFortschritt] = useState<MLFortschritt | null>(null);
  const [mlFehler, setMlFehler] = useState('');
  useEffect(() => {
    if (!offen || bereich !== 'laufzeit') return;
    let aktuell = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function lesen() {
      try {
        const r = await window.scriptlab.mlLesen();
        if (!aktuell) return;
        if (!r.ok) {
          setMlFehler(r.meldung);
          return;
        }
        setMlStatus(r.wert.status);
        setMlAktiv(r.wert.aktiv);
        setMlFortschritt(r.wert.fortschritt);
        if (r.wert.aktiv) timer = setTimeout(() => void lesen(), 500);
      } catch {
        if (aktuell)
          setMlFehler('Der ML-Komponentenstatus konnte nicht geladen werden. Erneut prüfen ist möglich.');
      }
    }
    void lesen();
    return () => {
      aktuell = false;
      clearTimeout(timer);
    };
  }, [offen, bereich, mlAktiv]);
  async function mlAktion(art: 'pruefen' | 'einrichten' | 'offline' | 'abbrechen') {
    setMlFehler('');
    if (art !== 'abbrechen') setMlAktiv(true);
    try {
      const r = await window.scriptlab.mlAktion(art);
      if (r.ok) setMlStatus(r.wert);
      else setMlFehler(r.meldung);
    } catch {
      setMlFehler('Die ML-Aktion konnte nicht abgeschlossen werden. Prüfe den Komponentenstatus.');
    } finally {
      try {
        const r = await window.scriptlab.mlLesen();
        if (r.ok) {
          setMlStatus(r.wert.status);
          setMlAktiv(r.wert.aktiv);
          setMlFortschritt(r.wert.fortschritt);
        }
      } catch {
        setMlAktiv(false);
      }
    }
  }
  useEffect(() => {
    if (!offen || bereich !== 'laufzeit') return;
    let aktuell = true;
    setKomponentenLaden(true);
    setKomponentenFehler('');
    void window.scriptlab.businessLesen().then(
      (r) => {
        if (!aktuell) return;
        if (r.ok) setBusinessStatus(r.wert.status);
        else setKomponentenFehler(r.meldung);
        setKomponentenLaden(false);
      },
      () => {
        if (!aktuell) return;
        setKomponentenFehler('Der Komponentenstatus konnte nicht geladen werden.');
        setKomponentenLaden(false);
      },
    );
    return () => {
      aktuell = false;
    };
  }, [offen, bereich, pythonStatus]);
  useEffect(() => {
    setZeitstempelEntwurf(projekt.exportOptionen.zeitstempelUrl);
    setZeitstempelFehler('');
  }, [projekt.exportOptionen.zeitstempelUrl, offen]);
  function zeitstempelUebernehmen(): boolean {
    if (!projektOptionenAnzeigen || projekt.skriptsprache !== 'vbs' || !projekt.exportOptionen.signieren)
      return true;
    if (zeitstempelEntwurf) {
      try {
        const url = new URL(zeitstempelEntwurf);
        if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash)
          throw new Error();
      } catch {
        setZeitstempelFehler('Gib eine vollständige HTTP-Adresse ohne Zugangsdaten oder URL-Parameter ein.');
        return false;
      }
    }
    setZeitstempelFehler('');
    if (zeitstempelEntwurf !== projekt.exportOptionen.zeitstempelUrl)
      exportOptionenSetzen({ ...projekt.exportOptionen, zeitstempelUrl: zeitstempelEntwurf });
    return true;
  }
  return (
    <Dialog
      offen={offen}
      titel="Einstellungen"
      className="einstellungen-dialog"
      onSchliessen={schliessen}
      fuss={
        <Knopf
          variante="primaer"
          onClick={() => {
            if (zeitstempelUebernehmen()) schliessen();
            else setBereich('laufzeit');
          }}
        >
          Fertig
        </Knopf>
      }
    >
      {verarbeitung && (
        <p id="einstellungen-vorgang" role="status">
          {verarbeitung}
        </p>
      )}
      {fehlerMeldung && <Statusanzeige art="fehler">{fehlerMeldung}</Statusanzeige>}
      <nav className="einstellungen-auswahl" role="tablist" aria-label="Einstellungsbereiche">
        {bereiche.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`einstellung-${tab.id}`}
            aria-controls={`einstellung-panel-${tab.id}`}
            aria-selected={bereich === tab.id}
            tabIndex={bereich === tab.id ? 0 : -1}
            onClick={() => setBereich(tab.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const ziel =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? bereiche.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + bereiche.length) % bereiche.length;
              setBereich(bereiche[ziel].id);
              document.getElementById(`einstellung-${bereiche[ziel].id}`)?.focus();
            }}
          >
            {tab.text}
          </button>
        ))}
      </nav>
      <div
        className="einstellungen-inhalt"
        role="tabpanel"
        id="einstellung-panel-darstellung"
        aria-labelledby="einstellung-darstellung"
        hidden={bereich !== 'darstellung'}
      >
        <Karte as="section" className="einstellungen-karte" aria-labelledby="einstellungen-aussehen">
          <div className="einstellungen-kartenkopf">
            <h3 id="einstellungen-aussehen">Farben und Lesbarkeit</h3>
            <p>Passe ScriptLab an deine Anzeige an.</p>
          </div>
          <div className="einstellungen-felder">
            <Auswahlfeld
              beschriftung="Farbschema"
              value={einstellungen.darstellung ?? 'hell'}
              onChange={(e) =>
                setzen({ ...einstellungen, darstellung: e.target.value as 'dunkel' | 'hell' | 'system' })
              }
            >
              <option value="hell">Hell</option>
              <option value="dunkel">Dunkel</option>
              <option value="system">Wie Windows</option>
            </Auswahlfeld>
            <Auswahlfeld
              beschriftung="Textgröße der Oberfläche"
              value={einstellungen.textSkalierung}
              onChange={(e) => setzen({ ...einstellungen, textSkalierung: Number(e.target.value) })}
            >
              {[1, 1.25, 1.5, 2].map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)} %
                </option>
              ))}
            </Auswahlfeld>
          </div>
        </Karte>
        <Karte as="section" className="einstellungen-karte" aria-labelledby="einstellungen-palette">
          <div className="einstellungen-kartenkopf">
            <h3 id="einstellungen-palette">Bausteinpalette</h3>
            <p>Mehr Platz für Bausteinnamen oder für deinen Ablauf.</p>
          </div>
          <Auswahlfeld
            beschriftung="Platz für Bausteine"
            value={einstellungen.palettenBreite}
            onChange={(e) => setzen({ ...einstellungen, palettenBreite: Number(e.target.value) })}
          >
            {![240, 272, 336, 400].includes(einstellungen.palettenBreite) && (
              <option value={einstellungen.palettenBreite}>Eigene Einstellung</option>
            )}
            <option value={240}>Kompakt</option>
            <option value={272}>Standard</option>
            <option value={336}>Geräumig</option>
            <option value={400}>Breit</option>
          </Auswahlfeld>
        </Karte>
      </div>
      <div
        className="einstellungen-inhalt"
        role="tabpanel"
        id="einstellung-panel-laufzeit"
        aria-labelledby="einstellung-laufzeit"
        hidden={bereich !== 'laufzeit'}
      >
        <Karte as="section" className="einstellungen-karte" aria-labelledby="einstellungen-automatisierungen">
          <div className="einstellungen-kartenkopf">
            <h3 id="einstellungen-automatisierungen">Workflows und Dokumente</h3>
            <p>Alles Nötige wird mit ScriptLab geliefert.</p>
          </div>
          <div className="einstellungen-verfuegbarkeit" aria-busy={komponentenLaden}>
            <div>
              <h4>Allgemeine Automatisierungen</h4>
              <Statusanzeige
                art={
                  pythonStatus?.zustand === 'bereit' && pythonStatus.installation
                    ? 'erfolg'
                    : pythonStatus?.zustand === 'prueft'
                      ? 'verarbeitung'
                      : pythonStatus?.zustand === 'fehler' || pythonStatus?.zustand === 'fehlt'
                        ? 'fehler'
                        : 'neutral'
                }
              >
                {pythonStatus?.zustand === 'bereit' && pythonStatus.installation
                  ? 'Bereit zum Ausführen.'
                  : pythonStatus?.zustand === 'prueft'
                    ? 'Verfügbarkeit wird geprüft …'
                    : pythonStatus?.zustand === 'fehler' || pythonStatus?.zustand === 'fehlt'
                      ? 'Zurzeit nicht verfügbar. Prüfe die Verfügbarkeit erneut.'
                      : 'Noch nicht geprüft.'}
              </Statusanzeige>
            </div>
            <div>
              <h4>Tabellen und Dokumente</h4>
              <Statusanzeige
                art={
                  komponentenFehler
                    ? 'fehler'
                    : komponentenLaden
                      ? 'verarbeitung'
                      : businessStatus?.zustand === 'bereit'
                        ? 'erfolg'
                        : businessStatus
                          ? 'fehler'
                          : 'neutral'
                }
              >
                {komponentenLaden
                  ? 'Verfügbarkeit wird geprüft …'
                  : businessStatus?.zustand === 'bereit'
                    ? 'Bereit zum Verarbeiten.'
                    : komponentenFehler || businessStatus
                      ? 'Zurzeit nicht verfügbar. Prüfe die Verfügbarkeit erneut.'
                      : 'Noch nicht geprüft.'}
              </Statusanzeige>
            </div>
          </div>
          <Knopf
            onClick={() => pythonAktion('pruefen')}
            disabled={!!verarbeitung || pythonStatus?.zustand === 'prueft' || komponentenLaden}
            grund={verarbeitung || 'Die Verfügbarkeit wird gerade geprüft.'}
          >
            Verfügbarkeit prüfen
          </Knopf>
          {(komponentenFehler ||
            (pythonStatus && ['fehler', 'fehlt'].includes(pythonStatus.zustand)) ||
            (businessStatus && businessStatus.zustand !== 'bereit')) && (
            <details className="einstellungen-fehlerdetails">
              <summary>Fehlermeldung anzeigen</summary>
              {pythonStatus && ['fehler', 'fehlt'].includes(pythonStatus.zustand) && (
                <p>{pythonStatus.meldung}</p>
              )}
              {(komponentenFehler || (businessStatus && businessStatus.zustand !== 'bereit')) && (
                <p>{komponentenFehler || businessStatus?.meldung}</p>
              )}
            </details>
          )}
        </Karte>
        <MlLaufzeit
          status={mlStatus}
          aktiv={mlAktiv}
          fortschritt={mlFortschritt}
          fehler={mlFehler}
          aktion={(art) => void mlAktion(art)}
        />
        {projektOptionenAnzeigen && projekt.skriptsprache === 'vbs' && (
          <Karte as="section" className="einstellungen-karte" aria-labelledby="einstellungen-signatur">
            <div className="einstellungen-kartenkopf">
              <h3 id="einstellungen-signatur">Signatur für dieses Projekt</h3>
              <p>Unterschreibe exportierte VBS-Dateien mit deinem Zertifikat.</p>
            </div>
            <label className="schalter">
              <input
                type="checkbox"
                checked={projekt.exportOptionen.signieren}
                onChange={(e) =>
                  exportOptionenSetzen({ ...projekt.exportOptionen, signieren: e.target.checked })
                }
              />
              <span>Exportierte Datei signieren</span>
            </label>
            {projekt.exportOptionen.signieren && (
              <>
                <p>
                  Du benötigst ein gültiges Signaturzertifikat mit privatem Schlüssel im
                  Windows-Zertifikatspeicher.
                </p>
                <Knopf
                  onClick={zertifikateLaden}
                  disabled={Boolean(verarbeitung)}
                  verarbeitung={verarbeitung?.startsWith('Zertifikate') ?? false}
                  grundId="einstellungen-vorgang"
                >
                  Zertifikate laden
                </Knopf>
                {zertifikatMeldung && (
                  <Statusanzeige art={zertifikate.length ? 'neutral' : 'hinweis'}>
                    {zertifikatMeldung}
                  </Statusanzeige>
                )}
                <Auswahlfeld
                  beschriftung="Zertifikat"
                  value={projekt.exportOptionen.zertifikatFingerabdruck}
                  onChange={(e) =>
                    exportOptionenSetzen({
                      ...projekt.exportOptionen,
                      zertifikatFingerabdruck: e.target.value,
                    })
                  }
                >
                  <option value="">Bitte auswählen</option>
                  {projekt.exportOptionen.zertifikatFingerabdruck &&
                    !zertifikate.some(
                      (z) => z.fingerabdruck === projekt.exportOptionen.zertifikatFingerabdruck,
                    ) && (
                      <option value={projekt.exportOptionen.zertifikatFingerabdruck}>
                        Gespeicherte Auswahl
                      </option>
                    )}
                  {zertifikate.map((z) => (
                    <option key={z.fingerabdruck} value={z.fingerabdruck}>
                      {z.betreff}
                      {zertifikate.filter((anderes) => anderes.betreff === z.betreff).length > 1 &&
                        ` · ${z.fingerabdruck}`}
                    </option>
                  ))}
                </Auswahlfeld>
                <details
                  className="einstellungen-fehlerdetails"
                  open={Boolean(zeitstempelFehler) || undefined}
                >
                  <summary>Zeitstempel einrichten</summary>
                  <Feld
                    beschriftung="Zeitstempeldienst (optional)"
                    placeholder="http://…"
                    value={zeitstempelEntwurf}
                    onChange={(e) => setZeitstempelEntwurf(e.target.value)}
                    onBlur={zeitstempelUebernehmen}
                    fehler={zeitstempelFehler}
                    hilfe="Dieser Signaturweg unterstützt nur HTTP."
                  />
                </details>
                <p>Eine Signatur bestätigt den Herausgeber. Sie garantiert keine Ungefährlichkeit.</p>
              </>
            )}
          </Karte>
        )}
      </div>
      <div
        className="einstellungen-inhalt"
        role="tabpanel"
        id="einstellung-panel-updates"
        aria-labelledby="einstellung-updates"
        hidden={bereich !== 'updates'}
      >
        <Karte as="section" className="einstellungen-karte" aria-labelledby="einstellungen-updates">
          <div className="einstellungen-kartenkopf">
            <h3 id="einstellungen-updates">ScriptLab aktuell halten</h3>
            <p>Suche nach Verbesserungen und installiere Updates bewusst.</p>
          </div>
          <label className="schalter">
            <input
              type="checkbox"
              checked={einstellungen.automatischeUpdates}
              onChange={(e) => setzen({ ...einstellungen, automatischeUpdates: e.target.checked })}
            />
            <span>Automatisch nach Updates suchen</span>
          </label>
          {update && (
            <Statusanzeige
              art={
                update.phase === 'fehler'
                  ? 'fehler'
                  : update.phase === 'prueft' || update.phase === 'laedt'
                    ? 'verarbeitung'
                    : 'neutral'
              }
            >
              {update.meldung}
            </Statusanzeige>
          )}
          {update?.phase === 'laedt' && (
            <div className="einstellungen-download">
              <progress value={update.fortschritt} max={100} aria-label="Update-Download" />
              <p>{Math.round(update.fortschritt)} % heruntergeladen</p>
            </div>
          )}
          <div className="einstellungen-aktionen">
            <Knopf
              verarbeitung={update?.phase === 'prueft'}
              disabled={Boolean(verarbeitung)}
              grundId="einstellungen-vorgang"
              onClick={() => updateAktion('pruefen')}
            >
              Nach Updates suchen
            </Knopf>
            {update?.phase === 'verfuegbar' && (
              <Knopf onClick={() => updateAktion('laden')}>Update herunterladen</Knopf>
            )}
            {update?.phase === 'bereit-zur-installation' && (
              <Knopf variante="primaer" onClick={() => updateAktion('installieren')}>
                Installieren und neu starten
              </Knopf>
            )}
          </div>
          {update?.aenderungen && (
            <details className="einstellungen-fehlerdetails">
              <summary>Was ist neu?</summary>
              <pre className="aenderungen">{update.aenderungen}</pre>
            </details>
          )}
          <details className="einstellungen-fehlerdetails">
            <summary>Vorabversionen</summary>
            <label className="schalter">
              <input
                type="checkbox"
                checked={einstellungen.vorabversionen}
                onChange={(e) => setzen({ ...einstellungen, vorabversionen: e.target.checked })}
              />
              <span>Vorabversionen anbieten (können noch Fehler enthalten)</span>
            </label>
          </details>
        </Karte>
      </div>
    </Dialog>
  );
}
