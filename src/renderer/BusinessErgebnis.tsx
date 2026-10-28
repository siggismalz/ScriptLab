import { useId } from 'react';
import type { TestOptionen, TestZustand } from '../gemeinsam/testlauf';
import { businessDefinitionen } from '../kern/business-katalog';
import './business.css';

export interface BusinessErgebnisEigenschaften {
  business: NonNullable<TestZustand['business']>;
  optionen: TestOptionen;
  aktiv: boolean;
  kontextZeigen?: boolean;
}

type Daten = Record<string, unknown>;

function objekt(wert: unknown): Daten | null {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Daten) : null;
}

function anzahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isSafeInteger(wert) && wert >= 0;
}

function text(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() ? wert : null;
}

/** Nur bestätigte Ereignisse darstellen; der Renderer leitet keine Dateizähler ab. */
export function BusinessErgebnis({
  business,
  optionen,
  aktiv,
  kontextZeigen = true,
}: BusinessErgebnisEigenschaften) {
  const titelId = useId();
  const schritt = [...business.ereignisse]
    .reverse()
    .find((e) => text(e.operation) && (!business.schritt || e.block_id === business.schritt));
  const definitionen = businessDefinitionen.filter((d) => d.operation === schritt?.operation);
  const schrittname =
    business.schrittnamen?.[business.schritt ?? ''] ??
    (definitionen.length === 1 ? definitionen[0].name : undefined);
  const fortschritt = [...business.ereignisse]
    .reverse()
    .find((e) => e.art === 'fortschritt' && e.einheit === 'Dateien' && anzahl(e.erledigt));
  const bericht = business.bericht;
  const summen = objekt(bericht?.summen);
  const dateizaehler = [
    ['verarbeitet', 'Fertig'],
    ['uebersprungen', 'Übersprungen'],
    ['geplant', 'Geplant'],
  ].filter(([feld]) => anzahl(summen?.[feld]));
  const meldungen: { art: 'Hinweis' | 'Fehler'; text: string }[] = [];
  function meldungAnfuegen(art: 'Hinweis' | 'Fehler', wert: unknown) {
    const inhalt = text(wert) ?? text(objekt(wert)?.meldung);
    if (inhalt && !meldungen.some((m) => m.art === art && m.text === inhalt))
      meldungen.push({ art, text: inhalt });
  }
  for (const e of business.ereignisse) {
    if (e.art === 'hinweis' || e.art === 'fehler')
      meldungAnfuegen(e.art === 'fehler' ? 'Fehler' : 'Hinweis', e.meldung);
  }
  for (const [feld, art] of [
    ['hinweise', 'Hinweis'],
    ['fehler', 'Fehler'],
  ] as const)
    if (Array.isArray(bericht?.[feld])) for (const eintrag of bericht[feld]) meldungAnfuegen(art, eintrag);
  if (text(bericht?.meldung))
    meldungAnfuegen(bericht?.status === 'erfolgreich' ? 'Hinweis' : 'Fehler', bericht?.meldung);
  const letzteMeldungen = meldungen.slice(-5);
  const ausgaben = Array.isArray(bericht?.ausgaben)
    ? bericht.ausgaben.map(objekt).filter((a): a is Daten => Boolean(a && text(a.pfad)))
    : [];
  const ausgabestatus: Record<string, string> = {
    publiziert: 'Gespeichert',
    wiederverwendet: 'Wiederverwendet',
    uebersprungen: 'Übersprungen',
    geplant: 'Geplant',
  };
  const modi: Record<string, string> = {
    vorschau: 'Datenvorschau',
    prueflauf: 'Prüflauf',
    ausfuehren: 'Echte Ausführung',
  };
  const modus = text(bericht?.modus) ?? optionen.business?.modus;
  const berichtPfad = text(bericht?.bericht_pfad);

  return (
    <section className="business-ergebnis" aria-labelledby={titelId}>
      {!kontextZeigen && (
        <h3 id={titelId} className="sl-nur-vorlesen">
          Laufergebnisse
        </h3>
      )}
      {kontextZeigen && (
        <>
          <h3 id={titelId}>Business-Ablauf</h3>
          <dl className="business-ergebnis-angaben">
            <div>
              <dt>Modus</dt>
              <dd>{modus ? (modi[modus] ?? 'Nicht bekannt') : 'Noch nicht gemeldet'}</dd>
            </div>
            <div>
              <dt>Parametersatz</dt>
              <dd>
                {optionen.business?.parametersatz === 'test'
                  ? 'Testdaten'
                  : optionen.business?.parametersatz === 'echt'
                    ? 'Echte Daten'
                    : 'Nicht bekannt'}
              </dd>
            </div>
            <div>
              <dt>{aktiv ? 'Aktueller Schritt' : 'Letzter Schritt'}</dt>
              <dd>
                {schrittname ?? (business.schritt ? 'Business-Baustein' : 'Noch kein Schritt gemeldet')}
              </dd>
            </div>
          </dl>
        </>
      )}
      {fortschritt && (
        <div className="business-ergebnis-fortschritt">
          <p>
            Zuletzt gemeldeter Dateifortschritt: {fortschritt.erledigt as number}
            {anzahl(fortschritt.gesamt) ? ` von ${fortschritt.gesamt}` : ''} Dateien
          </p>
          {anzahl(fortschritt.gesamt) &&
            fortschritt.gesamt > 0 &&
            (fortschritt.erledigt as number) <= fortschritt.gesamt && (
              <progress
                aria-label="Gemeldeter Dateifortschritt"
                value={fortschritt.erledigt as number}
                max={fortschritt.gesamt}
              />
            )}
        </div>
      )}
      {(dateizaehler.length > 0 || anzahl(summen?.fehlerhaft)) && (
        <div>
          {dateizaehler.length > 0 && (
            <>
              <h4>Ausgabedateien</h4>
              <dl className="business-ergebnis-angaben">
                {dateizaehler.map(([feld, titel]) => (
                  <div key={feld}>
                    <dt>{titel}</dt>
                    <dd>{summen![feld] as number}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {anzahl(summen?.fehlerhaft) && <p>Fehlermeldungen: {summen.fehlerhaft}</p>}
        </div>
      )}
      {letzteMeldungen.length > 0 && (
        <div>
          <h4>Letzte Hinweise und Fehler</h4>
          {meldungen.length > 5 && <p>Die letzten fünf Meldungen werden angezeigt.</p>}
          <ul>
            {letzteMeldungen.map((m, i) => (
              <li key={i}>
                <strong>{m.art}:</strong> {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ausgaben.length > 0 && (
        <div>
          <h4>Dateien und Ausgabeziele</h4>
          <ul className="business-ergebnis-ausgaben">
            {ausgaben.slice(0, 5).map((a, i) => {
              const pfad = a.pfad as string;
              const name = pfad.split(/[\\/]/).filter(Boolean).at(-1) ?? pfad;
              return (
                <li key={i}>
                  <details className="business-ergebnis-datei">
                    <summary title={pfad}>
                      <span className="business-ergebnis-dateiname">{name}</span>
                      {typeof a.status === 'string' && ausgabestatus[a.status] && (
                        <span className="business-ergebnis-dateistatus"> · {ausgabestatus[a.status]}</span>
                      )}
                    </summary>
                    <label>
                      Vollständiger Pfad
                      <textarea readOnly rows={2} value={pfad} aria-label={`Vollständiger Pfad: ${name}`} />
                    </label>
                  </details>
                </li>
              );
            })}
          </ul>
          {ausgaben.length > 5 && <p>Weitere Ausgabeziele stehen im vollständigen Laufbericht.</p>}
        </div>
      )}
      {(berichtPfad || bericht) && (
        <details className="business-ergebnis-bericht">
          <summary>Vollständiger Laufbericht</summary>
          {berichtPfad && (
            <label>
              Speicherort
              <textarea
                readOnly
                rows={2}
                value={berichtPfad}
                aria-label="Pfad des vollständigen Laufberichts"
              />
            </label>
          )}
          {bericht && (
            <pre tabIndex={0} aria-label="Inhalt des vollständigen Laufberichts">
              {JSON.stringify(bericht, null, 2)}
            </pre>
          )}
        </details>
      )}
    </section>
  );
}
