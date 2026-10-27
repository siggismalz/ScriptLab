import { useEffect } from 'react';
import type { Projekt } from '../kern/projekt';
import type { TestOptionen } from '../gemeinsam/testlauf';
import { businessSchritte } from '../kern/business';
import { Auswahlfeld, Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { ParameterWertEingabe } from './ParameterDialog';

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
  modus: 'ausfuehren',
  parametersatz: 'test',
  parameter: {},
  speicherMB: 512,
  tempGB: 4,
  fortsetzen: false,
};
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
  return (
    <section className="business-parameter">
      <h3>Business-Lauf vorbereiten</h3>
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
        <option value="vorschau">Datenvorschau · nur begrenzte Daten lesen</option>
        <option value="prueflauf">Prüflauf ohne Zieländerungen</option>
        <option value="ausfuehren">Ausführen · echte Dateiänderungen</option>
      </Auswahlfeld>
      <p>
        {b.modus === 'vorschau'
          ? 'Zeigt höchstens 200 Zeilen und 256 KiB. Filter, Sortieren und Gruppieren können die gesamte Quelle lesen. Dokumentausgaben werden nur geplant.'
          : b.modus === 'prueflauf'
            ? 'Prüft unterstützte Schritte und plant Dateiaktionen. Fachliche Ziele werden nicht verändert.'
            : 'Dateiänderungen werden tatsächlich vorgenommen. Der Parametersatz ist keine Sandbox. Stoppen nimmt bereits ausgeführte Änderungen nicht zurück.'}
      </p>
      <Auswahlfeld
        beschriftung="Parametersatz"
        value={b.parametersatz}
        disabled={gesperrt}
        onChange={(e) => setzen({ parametersatz: e.target.value as 'test' | 'echt', parameter: {} })}
      >
        <option value="test">Testdaten</option>
        <option value="echt">Echte Daten</option>
      </Auswahlfeld>
      {projekt.business.parameter.map((p) => (
        <ParameterWertEingabe
          key={p.name}
          beschriftung={p.beschriftung + (p.erforderlich ? ' (Pflichtangabe)' : '')}
          typ={p.typ}
          wert={parameter[p.name] ?? null}
          hilfe={p.hilfe}
          gesperrt={gesperrt}
          aendern={(wert) =>
            setzen({
              parameter: {
                ...b.parameter,
                [p.name]: wert,
              },
            })
          }
        />
      ))}
      {projekt.business.parameter.length > 0 && (
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
      )}
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
      <details>
        <summary>Ressourcen und Wiederanlauf</summary>
        <Feld
          beschriftung="DuckDB-Speicherlimit in MB"
          type="number"
          min={64}
          max={8192}
          value={b.speicherMB}
          disabled={gesperrt}
          onChange={(e) => setzen({ speicherMB: Number(e.target.value) })}
        />
        <Feld
          beschriftung="DuckDB-Zwischendaten maximal in GiB"
          type="number"
          min={1}
          max={100}
          value={b.tempGB}
          disabled={gesperrt}
          onChange={(e) => setzen({ tempGB: Number(e.target.value) })}
        />
        <p>
          Das Engine-Limit begrenzt nicht den gesamten Prozessspeicher. Auf dem temporären Datenträger muss
          ausreichend Platz frei sein.
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
        <p>
          Fortsetzen prüft Workflow, Parameter, Quellen und Ergebnisse. Unklare Publikationen werden nicht
          automatisch wiederholt.
        </p>
      </details>
      <details>
        <summary>Quellen, Ziele und Umfang · {schritte.length} Business-Schritte</summary>
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
        <p>
          Berechnete Ziele werden erst im betreffenden Schritt vollständig bekannt. Absolute Pfade bleiben
          unverändert.
        </p>
      </details>
    </section>
  );
}
