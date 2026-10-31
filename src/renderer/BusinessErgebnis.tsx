import { useId, useRef, useState } from 'react';
import type { TestOptionen, TestZustand } from '../gemeinsam/testlauf';
import { businessDefinitionen } from '../kern/business-katalog';
import { Knopf } from './komponenten/Knopf';
import { Karte } from './komponenten/Karte';
import './business.css';

export interface BusinessErgebnisEigenschaften {
  business: NonNullable<TestZustand['business']>;
  optionen: TestOptionen;
  aktiv: boolean;
  kontextZeigen?: boolean;
  dateiAnzeigen?: (art: 'ausgabe' | 'bericht', index?: number) => Promise<void>;
  blockAnzeigen?: (id: string) => void;
  blockZuordnungMoeglich?: boolean;
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
  dateiAnzeigen,
  blockAnzeigen,
  blockZuordnungMoeglich = true,
}: BusinessErgebnisEigenschaften) {
  const titelId = useId();
  const [dateiseite, setDateiseite] = useState(0);
  const blockGrundId = useId();
  const dateiStatusId = useId();
  const dateiAuftrag = useRef(false);
  const [dateiAktion, setDateiAktion] = useState<string | null>(null);
  const [dateiFehler, setDateiFehler] = useState<{ name: string; meldung: string } | null>(null);
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
  const meldungen: { art: 'Hinweis' | 'Fehler'; text: string; blockId: string | null }[] = [];
  function meldungAnfuegen(art: 'Hinweis' | 'Fehler', wert: unknown) {
    const inhalt = text(wert) ?? text(objekt(wert)?.meldung);
    const blockId = text(objekt(wert)?.block_id);
    if (inhalt && !meldungen.some((m) => m.art === art && m.text === inhalt && m.blockId === blockId))
      meldungen.push({ art, text: inhalt, blockId });
  }
  for (const e of business.ereignisse) {
    if (e.art === 'hinweis' || e.art === 'fehler')
      meldungAnfuegen(e.art === 'fehler' ? 'Fehler' : 'Hinweis', e);
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
    ? bericht.ausgaben
        .map((wert, index) => ({ daten: objekt(wert), index }))
        .filter((a): a is { daten: Daten; index: number } => Boolean(a.daten && text(a.daten.pfad)))
    : [];
  const aktiveDateiseite = Math.min(dateiseite, Math.max(0, Math.ceil(ausgaben.length / 20) - 1));
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
  const hatBlockaktionen = Boolean(
    blockAnzeigen && letzteMeldungen.some((m) => m.art === 'Fehler' && m.blockId),
  );
  const hatZusammenfassung =
    kontextZeigen ||
    Boolean(fortschritt) ||
    dateizaehler.length > 0 ||
    (anzahl(summen?.fehlerhaft) && summen.fehlerhaft > 0);

  async function dateiImExplorerAnzeigen(art: 'ausgabe' | 'bericht', name: string, index?: number) {
    if (!dateiAnzeigen || dateiAuftrag.current) return;
    dateiAuftrag.current = true;
    setDateiAktion(art === 'bericht' ? 'bericht' : `ausgabe-${index}`);
    setDateiFehler(null);
    try {
      await dateiAnzeigen(art, index);
    } catch (fehler) {
      setDateiFehler({
        name,
        meldung:
          fehler instanceof Error && fehler.message.trim()
            ? fehler.message
            : 'Die Datei konnte nicht im Explorer angezeigt werden.',
      });
    } finally {
      dateiAuftrag.current = false;
      setDateiAktion(null);
    }
  }

  return (
    <section className="business-ergebnis" aria-labelledby={titelId}>
      {!kontextZeigen && (
        <h3 id={titelId} className="sl-nur-vorlesen">
          Laufergebnisse
        </h3>
      )}
      {hatZusammenfassung && (
        <Karte
          as="section"
          className="business-ergebnis-zusammenfassung"
          aria-label="Zusammenfassung des Laufs"
        >
          {kontextZeigen && (
            <div>
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
            </div>
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
              {anzahl(summen?.fehlerhaft) && summen.fehlerhaft > 0 && (
                <p>Fehlermeldungen: {summen.fehlerhaft}</p>
              )}
            </div>
          )}
        </Karte>
      )}
      {letzteMeldungen.length > 0 && (
        <div>
          <h4>Letzte Hinweise und Fehler</h4>
          {meldungen.length > 5 && <p>Die letzten fünf Meldungen werden angezeigt.</p>}
          <ul className="business-ergebnis-meldungen">
            {letzteMeldungen.map((m, i) => (
              <li key={i}>
                <p>
                  <strong>{m.art}:</strong> {m.text}
                </p>
                {m.art === 'Fehler' && m.blockId && blockAnzeigen && (
                  <Knopf
                    variante="leise"
                    symbol="bausteine"
                    disabled={!blockZuordnungMoeglich}
                    grundId={blockGrundId}
                    onClick={() => blockAnzeigen(m.blockId!)}
                  >
                    Baustein anzeigen
                  </Knopf>
                )}
              </li>
            ))}
          </ul>
          {hatBlockaktionen && !blockZuordnungMoeglich && (
            <p id={blockGrundId} className="business-ergebnis-aktionshinweis">
              Die Meldungen gehören zu einem anderen Workflowstand. Die Bausteinzuordnung ist für den
              aktuellen Stand nicht verfügbar.
            </p>
          )}
        </div>
      )}
      {ausgaben.length > 0 && (
        <Karte as="section" className="business-ergebnis-dateikarte" aria-label="Dateien und Ausgabeziele">
          <h4>Dateien und Ausgabeziele</h4>
          <ul className="business-ergebnis-ausgaben">
            {ausgaben.slice(aktiveDateiseite * 20, (aktiveDateiseite + 1) * 20).map(({ daten: a, index }) => {
              const pfad = a.pfad as string;
              const name = pfad.split(/[\\/]/).filter(Boolean).at(-1) ?? pfad;
              return (
                <li key={index} className="business-ergebnis-dateizeile">
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
                  {dateiAnzeigen && ['publiziert', 'wiederverwendet'].includes(String(a.status)) && (
                    <Knopf
                      variante="leise"
                      symbol="oeffnen"
                      aria-label={`Im Explorer anzeigen: ${name}`}
                      disabled={Boolean(dateiAktion)}
                      verarbeitung={dateiAktion === `ausgabe-${index}`}
                      grundId={dateiStatusId}
                      onClick={() => void dateiImExplorerAnzeigen('ausgabe', name, index)}
                    >
                      Im Explorer anzeigen
                    </Knopf>
                  )}
                </li>
              );
            })}
          </ul>
          {ausgaben.length > 20 && (
            <div className="knopfgruppe" aria-label="Ausgabedateien durchblättern">
              <Knopf
                disabled={aktiveDateiseite === 0}
                onClick={() => setDateiseite(Math.max(0, aktiveDateiseite - 1))}
              >
                Vorherige Dateien
              </Knopf>
              <span>
                Seite {aktiveDateiseite + 1} von {Math.ceil(ausgaben.length / 20)}
              </span>
              <Knopf
                disabled={(aktiveDateiseite + 1) * 20 >= ausgaben.length}
                onClick={() => setDateiseite(aktiveDateiseite + 1)}
              >
                Weitere Dateien
              </Knopf>
            </div>
          )}
        </Karte>
      )}
      <p id={dateiStatusId} className="business-ergebnis-aktionshinweis" role="status" hidden={!dateiAktion}>
        Datei wird im Explorer angezeigt.
      </p>
      {dateiFehler && (
        <p className="business-ergebnis-aktionsfehler" role="alert">
          <strong>{dateiFehler.name}:</strong> {dateiFehler.meldung}
        </p>
      )}
    </section>
  );
}
