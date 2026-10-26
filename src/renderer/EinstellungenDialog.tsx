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
import { BusinessLaufzeit } from './BusinessLaufzeit';

export function EinstellungenDialog({
  businessGewechselt = () => {},
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
  const [breitenEntwurf, setBreitenEntwurf] = useState(String(einstellungen.palettenBreite));
  const [zeitstempelEntwurf, setZeitstempelEntwurf] = useState(projekt.exportOptionen.zeitstempelUrl);
  const [breitenFehler, setBreitenFehler] = useState('');
  const [zeitstempelFehler, setZeitstempelFehler] = useState('');
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
      <section className="einstellungs-abschnitt">
        <h3>Ansicht</h3>
        <Auswahlfeld
          beschriftung="UI-Textgröße"
          hilfe="Vergrößert die Bedientexte. Der Zoom des Arbeitsbereichs bleibt getrennt einstellbar."
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
          hilfe="240 bis 400 logische Pixel. Die Trennlinie lässt sich auch mit Pfeiltasten verschieben."
          type="number"
          min={240}
          max={400}
          value={breitenEntwurf}
          onChange={(e) => setBreitenEntwurf(e.target.value)}
          onBlur={breiteUebernehmen}
          fehler={breitenFehler}
        />
        <p>Ansichtseinstellungen werden beim Auswählen oder Verlassen eines Felds gespeichert.</p>
      </section>
      <BusinessLaufzeit gewechselt={businessGewechselt} />
      <section className="einstellungs-abschnitt" aria-labelledby="python-installation-titel">
        <h3 id="python-installation-titel">Python-Installation</h3>
        <p>
          Python wird zum Bearbeiten und Exportieren nicht benötigt. Für einen Python-Test muss eine passende
          Installation tatsächlich geprüft werden.
        </p>
        <div id="python-installation-status">
          <Statusanzeige
            art={
              pythonStatus?.zustand === 'bereit' && pythonStatus.installation
                ? 'erfolg'
                : pythonStatus?.zustand === 'prueft'
                  ? 'verarbeitung'
                  : pythonStatus?.zustand === 'fehler'
                    ? 'fehler'
                    : 'neutral'
            }
          >
            {pythonStatus?.meldung ?? 'Der Python-Status wurde noch nicht geladen.'}
          </Statusanzeige>
        </div>
        {pythonStatus?.installation && (
          <>
            <p>
              {pythonStatus.installation.implementierung} {pythonStatus.installation.version} ·{' '}
              {pythonStatus.installation.architektur}
            </p>
            <p>
              {pythonStatus.installation.tkinter === true
                ? 'Dialogfunktionen (tkinter) geprüft.'
                : pythonStatus.installation.tkinter === false
                  ? 'Dialogfunktionen (tkinter) sind nicht verfügbar.'
                  : 'Dialogfunktionen werden bei Bedarf gesondert geprüft.'}
            </p>
          </>
        )}
        {(pythonStatus?.installation?.pfad || pythonStatus?.auswahl) && (
          <Textfeld
            beschriftung="Python-Interpreter"
            readOnly
            rows={2}
            value={pythonStatus.installation?.pfad ?? pythonStatus.auswahl ?? ''}
          />
        )}
        <div className="knopfgruppe umbrechen">
          <Knopf
            onClick={() => pythonAktion('waehlen')}
            disabled={!!verarbeitung || pythonStatus?.zustand === 'prueft'}
            grundId={verarbeitung ? 'einstellungen-vorgang' : 'python-installation-status'}
          >
            Interpreter auswählen
          </Knopf>
          <Knopf
            onClick={() => pythonAktion('pruefen')}
            disabled={!!verarbeitung || pythonStatus?.zustand === 'prueft'}
            grundId={verarbeitung ? 'einstellungen-vorgang' : 'python-installation-status'}
          >
            Erneut prüfen
          </Knopf>
          <Knopf variante="leise" onClick={() => pythonAktion('hilfe')}>
            Offizielle Python-Hilfe
          </Knopf>
        </div>
        <p>
          Die Auswahl erfolgt über eine Programmdatei. ScriptLab installiert keine Python-Pakete automatisch
          und bietet hier keine freie Befehlszeile an.
        </p>
      </section>
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
                  exportOptionenSetzen({ ...projekt.exportOptionen, zertifikatFingerabdruck: e.target.value })
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
    </Dialog>
  );
}
