import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Projekt } from '../kern/projekt';
import type { TestOptionen } from '../gemeinsam/testlauf';
import { businessSchritte } from '../kern/business';
import { businessDefinitionen } from '../kern/business-katalog';
import { parameterWertePruefen } from '../kern/business-modell';
import { Auswahlfeld, Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { ParameterWertEingabe } from './ParameterDialog';
import { laufPfadangaben, laufPfadZusammenfassung } from './laufpfade';

export function laufprofilWert(sekunden: number): string {
  return (
    (
      { 15: 'vorschau', 60: 'prueflauf', 120: 'kurz', 7200: 'business', 28800: 'stapel' } as Record<
        number,
        string
      >
    )[sekunden] ?? 'eigenes'
  );
}
export const businessVorgaben: NonNullable<TestOptionen['business']> = {
  modus: 'prueflauf',
  parametersatz: 'test',
  parameter: {},
  speicherMB: 512,
  tempGB: 4,
  fortsetzen: false,
};
/** Ein Startversuch blendet echte Parameterfehler in der bestehenden Vorbereitung ein. */
export const VorbereitungsPruefung = createContext(0);

export function BusinessVorbereitung({
  projekt,
  optionen,
  aendern,
  gesperrt,
  merken,
}: {
  projekt: Projekt;
  optionen: TestOptionen;
  aendern: (o: TestOptionen) => void;
  gesperrt: boolean;
  merken: (p: Projekt) => void;
}) {
  const b = optionen.business ?? businessVorgaben;
  const setzen = (neu: Partial<typeof b>) => aendern({ ...optionen, business: { ...b, ...neu } });
  useEffect(() => {
    if (!optionen.business)
      aendern({ ...optionen, business: structuredClone(businessVorgaben), zeitlimitSekunden: 7200 });
  }, []);
  const parameter = {
    ...Object.fromEntries(projekt.business.parameter.map((p) => [p.name, p.standard])),
    ...projekt.business.parametersaetze[b.parametersatz],
    ...b.parameter,
  };
  const schritte = businessSchritte(projekt);
  const pruefanfrage = useContext(VorbereitungsPruefung);
  const erstePruefanfrage = useRef(pruefanfrage);
  const [parameterOffen, setParameterOffen] = useState(false);
  const parameterFehler = Object.fromEntries(
    projekt.business.parameter.flatMap((p) => {
      try {
        parameterWertePruefen([p], { [p.name]: parameter[p.name] ?? null });
        return [];
      } catch (fehler) {
        return [[p.name, fehler instanceof Error ? fehler.message : 'Prüfe diesen Parameterwert.']];
      }
    }),
  );
  const pruefungAngefordert = pruefanfrage > erstePruefanfrage.current;
  const fehlerAnzahl = Object.keys(parameterFehler).length;
  useEffect(() => {
    if (pruefungAngefordert && fehlerAnzahl) setParameterOffen(true);
  }, [pruefanfrage, fehlerAnzahl, pruefungAngefordert]);
  const konflikttexte: Record<string, string> = {
    FEHLER: 'Nicht überschreiben; mit Fehler abbrechen',
    UEBERSPRINGEN: 'Vorhandene Datei überspringen',
    NEUER_NAME: 'Unter neuem Namen speichern',
    ERSETZEN: 'Vorhandene Datei ersetzen',
  };
  const pfadschritte = schritte
    .map((schritt) => {
      const definition = businessDefinitionen.find((d) => d.operation === schritt.operation);
      return {
        schritt,
        definition,
        angaben: definition ? laufPfadangaben(definition, schritt.konfiguration, parameter) : [],
      };
    })
    .filter(
      ({ definition, angaben }) =>
        angaben.length || definition?.felder.some((feld) => feld.name === 'konflikt'),
    );
  const konfliktregeln = [
    ...new Set(
      pfadschritte.flatMap(({ schritt, definition }) => {
        const standard = definition?.felder.find((f) => f.name === 'konflikt')?.standard;
        const regel = schritt.konfiguration.konflikt ?? standard;
        return typeof regel === 'string' && konflikttexte[regel] ? [konflikttexte[regel]] : [];
      }),
    ),
  ];
  const pfadZusammenfassung = laufPfadZusammenfassung(pfadschritte.flatMap((s) => s.angaben));
  return (
    <section className="business-parameter">
      <div className="lauf-kernauswahl">
        <Auswahlfeld
          beschriftung="Modus"
          value={b.modus}
          disabled={gesperrt}
          onChange={(e) => {
            const modus = e.target.value as typeof b.modus;
            aendern({
              ...optionen,
              zeitlimitSekunden: modus === 'vorschau' ? 15 : modus === 'prueflauf' ? 60 : 7200,
              business: { ...b, modus },
            });
          }}
        >
          <option value="vorschau">Datenvorschau</option>
          <option value="prueflauf">Prüflauf ohne Zieländerungen</option>
          <option value="ausfuehren">Ausführen · echte Dateiänderungen</option>
        </Auswahlfeld>
        <Auswahlfeld
          beschriftung="Parametersatz"
          value={b.parametersatz}
          disabled={gesperrt}
          onChange={(e) => setzen({ parametersatz: e.target.value as 'test' | 'echt', parameter: {} })}
        >
          <option value="test">Testdaten</option>
          <option value="echt">Echte Daten</option>
        </Auswahlfeld>
      </div>
      {projekt.business.parameter.length > 0 && (
        <details
          className="lauf-parameterwerte"
          open={parameterOffen}
          onToggle={(e) => setParameterOffen(e.currentTarget.open)}
        >
          <summary>
            Parameterwerte anpassen ·{' '}
            {pruefungAngefordert && fehlerAnzahl
              ? `${fehlerAnzahl} Angaben prüfen`
              : `${projekt.business.parameter.length} Werte`}
          </summary>
          <div className="lauf-parameterfelder">
            {projekt.business.parameter.map((p) => (
              <div key={p.name} className="lauf-parameterwert">
                <ParameterWertEingabe
                  beschriftung={p.beschriftung + (p.erforderlich ? ' (Pflichtangabe)' : '')}
                  typ={p.typ}
                  wert={parameter[p.name] ?? null}
                  hilfe={p.hilfe}
                  gesperrt={gesperrt}
                  aendern={(wert) => setzen({ parameter: { ...b.parameter, [p.name]: wert } })}
                />
                {pruefungAngefordert && parameterFehler[p.name] && (
                  <p className="testbereich-fehler" role="alert">
                    {parameterFehler[p.name]}
                  </p>
                )}
              </div>
            ))}
            <Knopf
              disabled={gesperrt}
              grund="Stoppe den Lauf vor Änderungen."
              onClick={() =>
                merken({
                  ...projekt,
                  business: {
                    ...projekt.business,
                    parametersaetze: { ...projekt.business.parametersaetze, [b.parametersatz]: parameter },
                  },
                })
              }
            >
              Werte im Parametersatz merken
            </Knopf>
          </div>
        </details>
      )}
      <details className="lauf-quellenuebersicht">
        <summary>
          Quellen und Ausgabeziele
          {pfadZusammenfassung.text && (
            <span className="lauf-pfadkurz" title={pfadZusammenfassung.titel}>
              {pfadZusammenfassung.text}
            </span>
          )}
        </summary>
        {konfliktregeln.length > 0 && (
          <p>
            <strong>Vorhandene Dateien:</strong> {konfliktregeln.join(' · ')}.
          </p>
        )}
        <ul>
          {pfadschritte.map(({ schritt, definition, angaben }) => {
            const konfliktFeld = definition?.felder.find((feld) => feld.name === 'konflikt');
            const konflikt = schritt.konfiguration.konflikt ?? konfliktFeld?.standard;
            return (
              <li key={schritt.id}>
                <strong>{schritt.bezeichnung ?? definition?.name ?? 'Verarbeitungsschritt'}</strong>
                <dl>
                  {angaben.map((angabe) => (
                    <div key={JSON.stringify(angabe.feldPfad)}>
                      <dt>{angabe.titel}</dt>
                      <dd>{angabe.wert.text}</dd>
                    </div>
                  ))}
                  {konfliktFeld && (
                    <div>
                      <dt>{konfliktFeld.titel}</dt>
                      <dd>{konflikttexte[String(konflikt)] ?? 'Nicht bekannt'}</dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
        {!pfadschritte.length && <p>Keine fest konfigurierten Dateiquellen oder Ausgabeziele.</p>}
        <p className="testbereich-hilfe">
          Relative Pfade verwenden den ScriptLab-Arbeitsordner. Berechnete Pfade stehen erst im jeweiligen
          Schritt fest.
        </p>
      </details>
      <details className="lauf-erweiterte-optionen">
        <summary>Weitere Einstellungen</summary>
        <div className="lauf-erweiterte-felder">
          <Auswahlfeld
            beschriftung="Laufprofil"
            value={laufprofilWert(optionen.zeitlimitSekunden)}
            disabled={gesperrt}
            onChange={(e) =>
              aendern({
                ...optionen,
                zeitlimitSekunden:
                  (
                    { vorschau: 15, prueflauf: 60, kurz: 120, business: 7200, stapel: 28800 } as Record<
                      string,
                      number
                    >
                  )[e.target.value] ?? optionen.zeitlimitSekunden,
              })
            }
          >
            <option value="vorschau">Datenvorschau · 15 Sekunden</option>
            <option value="prueflauf">Prüflauf · 1 Minute</option>
            <option value="kurz">Kurzprüfung · 2 Minuten</option>
            <option value="business">Geschäftsablauf · 2 Stunden</option>
            <option value="stapel">Großer Stapel · 8 Stunden</option>
            {laufprofilWert(optionen.zeitlimitSekunden) === 'eigenes' && (
              <option value="eigenes">Eigenes Zeitlimit · {optionen.zeitlimitSekunden} Sekunden</option>
            )}
          </Auswahlfeld>
          <Feld
            beschriftung="Speicherlimit für Datenverarbeitung in MB"
            type="number"
            min={64}
            max={8192}
            value={b.speicherMB}
            disabled={gesperrt}
            onChange={(e) => setzen({ speicherMB: Number(e.target.value) })}
          />
          <Feld
            beschriftung="Zwischendaten maximal in GiB"
            type="number"
            min={1}
            max={100}
            value={b.tempGB}
            disabled={gesperrt}
            onChange={(e) => setzen({ tempGB: Number(e.target.value) })}
          />
          <p className="testbereich-hilfe">
            Das Speicherlimit betrifft die Datenverarbeitung, nicht den gesamten Prozess. Zwischendaten
            benötigen freien Speicherplatz.
          </p>
          <label className="business-checkbox">
            <input
              type="checkbox"
              checked={b.fortsetzen}
              disabled={gesperrt}
              onChange={(e) => setzen({ fortsetzen: e.target.checked })}
            />
            Passendes früheres Journal bewusst fortsetzen
          </label>
          <p className="testbereich-hilfe">
            Fortsetzen prüft Workflow, Parameter, Quellen und Ergebnisse. Unklare Publikationen werden nicht
            automatisch wiederholt.
          </p>
          <details>
            <summary>Wirkung und Grenzen</summary>
            <p>
              {b.modus === 'vorschau'
                ? 'Die Vorschau zeigt höchstens 200 Zeilen und 256 KiB. Filter, Sortieren und Gruppieren können die gesamte Quelle lesen. Dokumentausgaben werden nur geplant.'
                : b.modus === 'prueflauf'
                  ? 'Der Prüflauf prüft unterstützte Schritte und plant Dateiaktionen. Fachliche Ziele werden nicht verändert.'
                  : 'Dateiänderungen werden tatsächlich vorgenommen. Der Parametersatz ist keine Sandbox. Stoppen nimmt bereits ausgeführte Änderungen nicht zurück.'}
            </p>
          </details>
          <details>
            <summary>Technische Schrittangaben · {schritte.length} Business-Schritte</summary>
            <ul>
              {schritte.map((s) => (
                <li key={s.id}>
                  <strong>{s.bezeichnung ?? s.operation}</strong>
                  <pre>
                    {JSON.stringify(
                      s.konfiguration,
                      (_, v) =>
                        v && typeof v === 'object' && 'parameter' in v
                          ? (parameter[v.parameter] ?? `Parameter ${v.parameter} fehlt`)
                          : v,
                      2,
                    )}
                  </pre>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </details>
    </section>
  );
}
