import { useId, useRef, useState, type ReactNode } from 'react';
import type { JsonWert } from '../kern/business-modell';
import { Dialog } from './komponenten/Dialog';
import { Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { freierZuordnungsname, zuordnungUmbenennen } from './zuordnungen';

export interface ZuordnungsFeldEigenschaften {
  titel: string;
  wert: Record<string, JsonWert>;
  aendern: (wert: Record<string, JsonWert>) => void;
  gesperrt: boolean;
  schluesselTitel: string;
  wertTitel?: string;
  vorschlaege: string[];
  renderWert: (schluessel: string, wert: JsonWert, aendern: (wert: JsonWert) => void) => ReactNode;
}

export function ZuordnungsFeld({
  titel,
  wert,
  aendern,
  gesperrt,
  schluesselTitel,
  wertTitel = 'Zugeordneter Wert',
  vorschlaege,
  renderWert,
}: ZuordnungsFeldEigenschaften) {
  const id = useId();
  const bereich = useRef<HTMLFieldSetElement>(null);
  const [umbenennung, setUmbenennung] = useState<{ bisher: string; entwurf: string } | null>(null);
  const [fehler, setFehler] = useState('');
  const schliessen = () => {
    setUmbenennung(null);
    setFehler('');
  };
  const uebernehmen = () => {
    if (!umbenennung || gesperrt) return;
    try {
      const neu = zuordnungUmbenennen(wert, umbenennung.bisher, umbenennung.entwurf);
      const name = umbenennung.entwurf;
      if (umbenennung.bisher !== umbenennung.entwurf) aendern(neu);
      schliessen();
      requestAnimationFrame(() => {
        const zeile = Array.from(
          bereich.current?.querySelectorAll<HTMLElement>('[data-zuordnung-name]') ?? [],
        ).find((element) => element.dataset.zuordnungName === name);
        zeile?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      });
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : 'Prüfe den Namen.');
      document.getElementById(`${id}-name`)?.focus();
    }
  };
  return (
    <fieldset className="zuordnungsfeld" ref={bereich}>
      <legend>{titel}</legend>
      <div className="zuordnung-liste">
        {Object.entries(wert).map(([name, inhalt], index) => (
          <div
            className="zuordnung-zeile"
            key={name}
            data-zuordnung-name={name}
            role="group"
            aria-label={`${titel}: ${name}`}
          >
            <div className="zuordnung-kopf">
              <span className="zuordnung-schluessel" title={name}>
                {name || `Zuordnung ${index + 1}`}
              </span>
              <div className="zuordnung-aktionen">
                <Knopf
                  variante="leise"
                  disabled={gesperrt}
                  grund="Stoppe den Lauf vor Änderungen."
                  aria-label={`${schluesselTitel} „${name}“ umbenennen`}
                  onClick={() => {
                    setFehler('');
                    setUmbenennung({ bisher: name, entwurf: name });
                  }}
                >
                  Umbenennen
                </Knopf>
                <Knopf
                  variante="leise"
                  symbol="loeschen"
                  disabled={gesperrt}
                  grund="Stoppe den Lauf vor Änderungen."
                  aria-label={`Zuordnung „${name}“ entfernen`}
                  title="Zuordnung entfernen"
                  onClick={() =>
                    aendern(Object.fromEntries(Object.entries(wert).filter(([key]) => key !== name)))
                  }
                />
              </div>
            </div>
            <div className="zuordnung-wert" role="group" aria-label={`${wertTitel} für ${name}`}>
              {renderWert(name, inhalt, (neu) =>
                aendern(
                  Object.fromEntries(Object.entries(wert).map(([key, v]) => [key, key === name ? neu : v])),
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <Knopf
        variante="leise"
        symbol="plus"
        disabled={gesperrt || Object.keys(wert).length >= 100}
        grund={gesperrt ? 'Stoppe den Lauf vor Änderungen.' : 'Diese Zuordnung enthält bereits 100 Einträge.'}
        onClick={() =>
          aendern(Object.fromEntries([...Object.entries(wert), [freierZuordnungsname(wert), '']]))
        }
      >
        Zuordnung hinzufügen
      </Knopf>
      <Dialog
        offen={umbenennung !== null}
        titel={`${schluesselTitel} umbenennen`}
        onSchliessen={schliessen}
        className="zuordnung-umbenennen"
        fuss={
          <>
            <Knopf onClick={schliessen}>Abbrechen</Knopf>
            <Knopf
              variante="primaer"
              disabled={gesperrt}
              grund="Stoppe den Lauf vor Änderungen."
              onClick={uebernehmen}
            >
              Übernehmen
            </Knopf>
          </>
        }
      >
        <Feld
          id={`${id}-name`}
          beschriftung={schluesselTitel}
          value={umbenennung?.entwurf ?? ''}
          disabled={gesperrt}
          list={vorschlaege.length ? `${id}-vorschlaege` : undefined}
          fehler={fehler}
          maxLength={32768}
          onChange={(event) => {
            setUmbenennung((alt) => alt && { ...alt, entwurf: event.target.value });
            setFehler('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              uebernehmen();
            }
          }}
        />
        {vorschlaege.length > 0 && (
          <datalist id={`${id}-vorschlaege`}>
            {[...new Set(vorschlaege)].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}
      </Dialog>
    </fieldset>
  );
}
