import { useEffect, useState } from 'react';
import type { Einstellungen } from '../gemeinsam/bruecke';
import type { Projekt } from '../kern/projekt';
import type { Zertifikat } from '../windows/signatur';
import type { UpdateZustand } from '../windows/updates';
import { Dialog } from './komponenten/Dialog';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld, Textfeld } from './komponenten/Feld';
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
  version,
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
    { id: 'darstellung', text: 'Darstellung' },
    { id: 'laufzeit', text: 'Laufzeit' },
    { id: 'updates', text: 'Updates' },
    ...(projektOptionenAnzeigen && projekt.skriptsprache === 'vbs'
      ? [{ id: 'signatur', text: 'VBS-Signatur' }]
      : []),
  ];
  const [breitenEntwurf, setBreitenEntwurf] = useState(String(einstellungen.palettenBreite));
  const [zeitstempelEntwurf, setZeitstempelEntwurf] = useState(projekt.exportOptionen.zeitstempelUrl);
  const [breitenFehler, setBreitenFehler] = useState('');
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
    if (bereich === 'signatur' && (!projektOptionenAnzeigen || projekt.skriptsprache !== 'vbs'))
      setBereich('darstellung');
  }, [bereich, projektOptionenAnzeigen, projekt.skriptsprache]);
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
    setBreitenEntwurf(String(einstellungen.palettenBreite));
    setBreitenFehler('');
  }, [einstellungen.palettenBreite, offen]);
  useEffect(() => {
    setZeitstempelEntwurf(projekt.exportOptionen.zeitstempelUrl);
    setZeitstempelFehler('');
  }, [projekt.exportOptionen.zeitstempelUrl, offen]);
  function breiteUebernehmen(): boolean {
    const n = Number(breitenEntwurf);
    if (!Number.isInteger(n) || n < 240 || n > 400) {
      setBreitenFehler('Gib eine ganze Zahl zwischen 240 und 400 ein.');
      return false;
    }
    setBreitenFehler('');
    if (n !== einstellungen.palettenBreite) setzen({ ...einstellungen, palettenBreite: n });
    return true;
  }
  function zeitstempelUebernehmen(): boolean {
    if (projekt.skriptsprache !== 'vbs') return true;
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
      onSchliessen={schliessen}
      fuss={
        <Knopf
          variante="primaer"
          onClick={() => {
            const b = breiteUebernehmen(),
              z = zeitstempelUebernehmen();
            if (b && z) schliessen();
            else setBereich(!b ? 'darstellung' : 'signatur');
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
      <nav className="einstellungen-bereiche" role="tablist" aria-label="Einstellungsbereiche">
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
        role="tabpanel"
        id="einstellung-panel-darstellung"
        aria-labelledby="einstellung-darstellung"
        hidden={bereich !== 'darstellung'}
      >
        <section className="einstellungs-abschnitt">
          <h3>Darstellung</h3>
          <Auswahlfeld
            beschriftung="Farbschema"
            hilfe="„System“ folgt der Windows-Darstellung."
            value={einstellungen.darstellung ?? 'hell'}
            onChange={(e) =>
              setzen({ ...einstellungen, darstellung: e.target.value as 'dunkel' | 'hell' | 'system' })
            }
          >
            <option value="hell">Hell</option>
            <option value="dunkel">Dunkel</option>
            <option value="system">System</option>
          </Auswahlfeld>
          <Auswahlfeld
            beschriftung="Textgröße der Oberfläche"
            hilfe="Unabhängig von Windows-Skalierung und Canvas-Zoom."
            value={einstellungen.textSkalierung}
            onChange={(e) => setzen({ ...einstellungen, textSkalierung: Number(e.target.value) })}
          >
            {[1, 1.25, 1.5, 2].map((v) => (
              <option key={v} value={v}>
                {Math.round(v * 100)} %
              </option>
            ))}
          </Auswahlfeld>
          <Feld
            beschriftung="Breite der Bausteinpalette"
            hilfe="240–400 logische Pixel."
            type="number"
            min={240}
            max={400}
            value={breitenEntwurf}
            onChange={(e) => setBreitenEntwurf(e.target.value)}
            onBlur={breiteUebernehmen}
            fehler={breitenFehler}
          />
        </section>
      </div>
      <div
        role="tabpanel"
        id="einstellung-panel-laufzeit"
        aria-labelledby="einstellung-laufzeit"
        hidden={bereich !== 'laufzeit'}
      >
        <section
          className="einstellungs-abschnitt komponenten-uebersicht"
          aria-labelledby="komponenten-titel"
        >
          <h3 id="komponenten-titel">Mitgelieferte Komponenten</h3>
          <p>Python sowie die Komponenten für Tabellen und Dokumente gehören zu ScriptLab.</p>
          <div id="komponenten-status" className="komponenten-status" aria-busy={komponentenLaden}>
            <section>
              <h4>Python</h4>
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
                {pythonStatus?.meldung ?? 'Noch nicht geprüft.'}
              </Statusanzeige>
            </section>
            <section>
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
                {komponentenFehler ||
                  (komponentenLaden ? 'Status wird geladen …' : businessStatus?.meldung) ||
                  'Noch nicht geprüft.'}
              </Statusanzeige>
            </section>
          </div>
          <div className="knopfgruppe">
            <Knopf
              onClick={() => pythonAktion('pruefen')}
              disabled={!!verarbeitung || pythonStatus?.zustand === 'prueft' || komponentenLaden}
              grund={verarbeitung || 'Die Komponenten werden gerade geprüft.'}
            >
              Erneut prüfen
            </Knopf>
          </div>
          <details className="komponenten-details">
            <summary>Versionen und technische Angaben</summary>
            {pythonStatus?.installation && (
              <dl>
                <div>
                  <dt>Python</dt>
                  <dd>
                    {pythonStatus.installation.implementierung} {pythonStatus.installation.version} ·{' '}
                    {pythonStatus.installation.architektur}
                  </dd>
                </div>
                <div>
                  <dt>Dialogfunktionen</dt>
                  <dd>
                    {pythonStatus.installation.tkinter === true
                      ? 'Verfügbar'
                      : pythonStatus.installation.tkinter === false
                        ? 'Nicht verfügbar'
                        : 'Noch nicht geprüft'}
                  </dd>
                </div>
              </dl>
            )}
            {pythonStatus?.installation?.pfad && (
              <Textfeld
                beschriftung="Mitgelieferte Programmdatei"
                readOnly
                rows={2}
                value={pythonStatus.installation.pfad}
              />
            )}
            {businessStatus && (
              <dl>
                {businessStatus.pakete.map((paket) => (
                  <div key={paket.name}>
                    <dt>{paket.name}</dt>
                    <dd>
                      {paket.version ?? 'Nicht vorhanden'}
                      {!paket.importierbar && ' · Nicht verwendbar'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        </section>
        <MlLaufzeit
          status={mlStatus}
          aktiv={mlAktiv}
          fortschritt={mlFortschritt}
          fehler={mlFehler}
          aktion={(art) => void mlAktion(art)}
        />
      </div>
      <div
        role="tabpanel"
        id="einstellung-panel-updates"
        aria-labelledby="einstellung-updates"
        hidden={bereich !== 'updates'}
      >
        <section className="einstellungs-abschnitt">
          <h3>Anwendungsupdates</h3>
          <p>
            Installierte Version: {version}
            {update?.verfuegbareVersion ? ` · Verfügbar: ${update.verfuegbareVersion}` : ''}
          </p>
          {(['automatischeUpdates', 'vorabversionen'] as const).map((key) => (
            <label key={key} className="schalter">
              <input
                type="checkbox"
                checked={einstellungen[key]}
                onChange={(e) => setzen({ ...einstellungen, [key]: e.target.checked })}
              />
              <span>
                {key === 'automatischeUpdates'
                  ? 'Automatisch nach Updates suchen'
                  : 'Vorabversionen bewusst zulassen'}
              </span>
            </label>
          ))}
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
            <>
              <progress value={update.fortschritt} max={100} aria-label="Update-Download" />
              <p>{Math.round(update.fortschritt)} % heruntergeladen</p>
            </>
          )}
          <div className="knopfgruppe umbrechen">
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
              <Knopf onClick={() => updateAktion('installieren')}>Installieren und neu starten</Knopf>
            )}
          </div>
          {update?.aenderungen && (
            <section>
              <h4>Änderungen</h4>
              <pre className="aenderungen">{update.aenderungen}</pre>
            </section>
          )}
        </section>
      </div>
      <div
        role="tabpanel"
        id="einstellung-panel-signatur"
        aria-labelledby="einstellung-signatur"
        hidden={bereich !== 'signatur'}
      >
        {projektOptionenAnzeigen && projekt.skriptsprache === 'vbs' && (
          <section className="einstellungs-abschnitt">
            <h3>Signatur für dieses Projekt</h3>
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
            <p>Der normale Export funktioniert ohne Zertifikat.</p>
            {projekt.exportOptionen.signieren && (
              <>
                <p>
                  Für die optionale Signatur benötigst du ein gültiges Code-Signing-Zertifikat mit privatem
                  Schlüssel im Windows-Zertifikatspeicher.
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
                        Gespeicherte Auswahl: {projekt.exportOptionen.zertifikatFingerabdruck}
                      </option>
                    )}
                  {zertifikate.map((z) => (
                    <option key={z.fingerabdruck} value={z.fingerabdruck}>
                      {z.betreff} · {z.fingerabdruck}
                    </option>
                  ))}
                </Auswahlfeld>
                <details>
                  <summary>Zeitstempel einrichten</summary>
                  <Feld
                    beschriftung="Zeitstempeldienst (optional)"
                    placeholder="http://…"
                    value={zeitstempelEntwurf}
                    onChange={(e) => setZeitstempelEntwurf(e.target.value)}
                    onBlur={zeitstempelUebernehmen}
                    fehler={zeitstempelFehler}
                    hilfe="Dieser Windows-Signaturweg unterstützt für Authenticode-Zeitstempel nur HTTP."
                  />
                </details>
                <p>
                  Eine Signatur hilft, Herausgeber und Änderungen zu prüfen. Sie garantiert keine
                  Ungefährlichkeit und verhindert keine Windows-Warnungen.
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}
