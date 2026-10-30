import { useId, useRef, useState, type ReactNode } from 'react';
import type { JsonWert } from '../kern/business-modell';
import { Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { spaltenvorschlaegeFiltern, spaltenwahlAendern, spalteVerschieben } from './zuordnungen';

export interface SpaltenAuswahlEigenschaften {
  titel: string;
  werte: JsonWert[];
  vorschlaege: string[];
  aendern: (werte: JsonWert[]) => void;
  gesperrt: boolean;
  renderGebunden?: (wert: JsonWert, index: number, aendern: (wert: JsonWert) => void) => ReactNode;
}

export function SpaltenAuswahl({
  titel,
  werte,
  vorschlaege,
  aendern,
  gesperrt,
  renderGebunden,
}: SpaltenAuswahlEigenschaften) {
  const id = useId();
  const [suche, setSuche] = useState('');
  const liste = useRef<HTMLDivElement>(null);
  const hinzufuegen = useRef<HTMLDivElement>(null);
  const treffer = spaltenvorschlaegeFiltern(vorschlaege, suche);
  const fokusAufZeile = (index: number) =>
    requestAnimationFrame(() => {
      const zeile = liste.current?.querySelector<HTMLElement>(`[data-spalten-index="${index}"]`);
      if (zeile) (zeile.querySelector<HTMLElement>('input,select,textarea') ?? zeile).focus();
      else hinzufuegen.current?.querySelector('button')?.focus();
    });
  const verschieben = (index: number, richtung: -1 | 1) => {
    aendern(spalteVerschieben(werte, index, richtung));
    fokusAufZeile(index + richtung);
  };
  return (
    <fieldset className="spaltenauswahl">
      <legend>{titel}</legend>
      <span id={`${id}-gesperrt`} className="sl-nur-vorlesen">
        Stoppe den Lauf vor Änderungen.
      </span>
      <span id={`${id}-erste`} className="sl-nur-vorlesen">
        Diese Spalte steht bereits an erster Stelle.
      </span>
      <span id={`${id}-letzte`} className="sl-nur-vorlesen">
        Diese Spalte steht bereits an letzter Stelle.
      </span>
      {vorschlaege.length > 0 && (
        <details className="spaltenauswahl-vorschlaege">
          <summary>Aus Vorschau auswählen</summary>
          <Feld
            beschriftung="Spalten suchen"
            aria-label={`Spalten suchen: ${titel}`}
            type="search"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
          />
          <div className="spaltenauswahl-treffer" role="group" aria-label={`Spaltenvorschläge: ${titel}`}>
            {treffer.slice(0, 100).map((name) => (
              <label className="spaltenauswahl-vorschlag" key={name}>
                <input
                  type="checkbox"
                  checked={werte.includes(name)}
                  disabled={gesperrt || (!werte.includes(name) && werte.length >= 500)}
                  onChange={(event) => aendern(spaltenwahlAendern(werte, name, event.target.checked))}
                />
                <span title={name}>{name}</span>
              </label>
            ))}
          </div>
          {!treffer.length && <p className="spaltenauswahl-hinweis">Keine passenden Spaltenvorschläge.</p>}
          {treffer.length > 100 && (
            <p className="spaltenauswahl-hinweis">
              100 von {treffer.length} Vorschlägen angezeigt. Grenze die Suche ein.
            </p>
          )}
        </details>
      )}
      <div ref={liste} className="spaltenauswahl-liste">
        {werte.map((wert, index) => (
          <div className="spaltenauswahl-zeile" key={index} data-spalten-index={index} tabIndex={-1}>
            <div className="spaltenauswahl-wert">
              {typeof wert === 'string' ? (
                <Feld
                  beschriftung={`Spalte ${index + 1}`}
                  aria-label={`${titel}: Spalte ${index + 1}`}
                  value={wert}
                  disabled={gesperrt}
                  onChange={(event) => aendern(werte.map((v, i) => (i === index ? event.target.value : v)))}
                />
              ) : renderGebunden ? (
                renderGebunden(wert, index, (neu) => aendern(werte.map((v, i) => (i === index ? neu : v))))
              ) : (
                <p title={JSON.stringify(wert)}>
                  {wert !== null && typeof wert === 'object'
                    ? 'Gespeicherter Wert'
                    : String(wert ?? 'Ohne Wert')}
                </p>
              )}
            </div>
            <div className="spaltenauswahl-aktionen">
              <Knopf
                variante="leise"
                symbol="oben"
                disabled={gesperrt || index === 0}
                grundId={gesperrt ? `${id}-gesperrt` : `${id}-erste`}
                aria-label={`${titel}: Spalte ${index + 1} nach oben`}
                title={index === 0 ? 'Bereits an erster Stelle' : 'Nach oben'}
                onClick={() => verschieben(index, -1)}
              />
              <Knopf
                variante="leise"
                symbol="unten"
                disabled={gesperrt || index === werte.length - 1}
                grundId={gesperrt ? `${id}-gesperrt` : `${id}-letzte`}
                aria-label={`${titel}: Spalte ${index + 1} nach unten`}
                title={index === werte.length - 1 ? 'Bereits an letzter Stelle' : 'Nach unten'}
                onClick={() => verschieben(index, 1)}
              />
              <Knopf
                variante="leise"
                symbol="loeschen"
                disabled={gesperrt}
                grundId={`${id}-gesperrt`}
                aria-label={`${titel}: Spalte ${index + 1} entfernen`}
                title="Spalte entfernen"
                onClick={() => {
                  aendern(werte.filter((_, i) => i !== index));
                  fokusAufZeile(Math.min(index, werte.length - 2));
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div ref={hinzufuegen} className="spaltenauswahl-hinzufuegen">
        <Knopf
          variante="leise"
          symbol="plus"
          disabled={gesperrt || werte.length >= 500}
          grund={gesperrt ? 'Stoppe den Lauf vor Änderungen.' : 'Diese Liste enthält bereits 500 Einträge.'}
          onClick={() => {
            aendern([...werte, '']);
            fokusAufZeile(werte.length);
          }}
        >
          Spalte hinzufügen
        </Knopf>
      </div>
    </fieldset>
  );
}
