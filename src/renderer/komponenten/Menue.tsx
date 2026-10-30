import { useEffect, useId, useRef, useState } from 'react';
import { Knopf } from './Knopf';
import { Symbol, type SymbolName } from './Icon';

export interface MenueEintrag {
  id?: string;
  text: string;
  symbol?: SymbolName;
  aktion: () => void;
  gesperrt?: boolean;
  grund?: string;
}

/** Ein benanntes Aktionsmenü für seltene Befehle, erreichbar mit Maus und Tastatur. */
export function Menue({
  beschriftung,
  eintraege,
  symbol = 'mehr',
  nurSymbol = false,
}: {
  beschriftung: string;
  eintraege: MenueEintrag[];
  symbol?: SymbolName;
  nurSymbol?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const ausloeser = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const id = useId();

  function schliessen(fokusZurueck = false) {
    setOffen(false);
    if (fokusZurueck) ausloeser.current?.querySelector('button')?.focus({ preventScroll: true });
  }
  function eintragFokussieren(index: number) {
    const knoepfe = Array.from(
      liste.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    );
    if (knoepfe.length) knoepfe[(index + knoepfe.length) % knoepfe.length].focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!offen) return;
    const draussen = (event: PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) schliessen();
    };
    document.addEventListener('pointerdown', draussen);
    return () => document.removeEventListener('pointerdown', draussen);
  }, [offen]);

  return (
    <div
      className="sl-menue"
      ref={element}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && offen) {
          event.preventDefault();
          schliessen(true);
        }
        if (event.key === 'Tab' && offen) {
          event.preventDefault();
          const knopf = ausloeser.current?.querySelector('button');
          const erreichbare = Array.from(
            document.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
            ),
          ).filter(
            (kandidat) =>
              !liste.current?.contains(kandidat) &&
              kandidat.tabIndex >= 0 &&
              !kandidat.matches(':disabled') &&
              !kandidat.closest('[inert]') &&
              kandidat.getClientRects().length > 0,
          );
          const index = knopf ? erreichbare.indexOf(knopf) : -1;
          schliessen();
          (erreichbare[index + (event.shiftKey ? -1 : 1)] ?? knopf)?.focus({ preventScroll: true });
        }
        if (!offen) return;
        const knoepfe = Array.from(
          liste.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
        );
        const aktuell = knoepfe.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          eintragFokussieren(aktuell + (event.key === 'ArrowDown' ? 1 : -1));
        }
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          eintragFokussieren(event.key === 'Home' ? 0 : knoepfe.length - 1);
        }
      }}
    >
      <div ref={ausloeser}>
        <Knopf
          variante="leise"
          symbol={nurSymbol ? symbol : undefined}
          aria-label={beschriftung}
          title={beschriftung}
          aria-haspopup="menu"
          aria-expanded={offen}
          aria-controls={offen ? id : undefined}
          onClick={() => {
            setOffen(!offen);
            if (!offen) requestAnimationFrame(() => eintragFokussieren(0));
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOffen(true);
              requestAnimationFrame(() => eintragFokussieren(event.key === 'ArrowDown' ? 0 : -1));
            }
          }}
        >
          {nurSymbol ? undefined : (
            <span className="sl-menue-beschriftung">
              {beschriftung}
              <Symbol name={symbol} groesse={16} />
            </span>
          )}
        </Knopf>
      </div>
      {offen && (
        <ul id={id} ref={liste} className="sl-menue-liste" role="menu" aria-label={beschriftung}>
          {eintraege.map((eintrag) => (
            <li key={eintrag.id ?? eintrag.text} role="none">
              <Knopf
                role="menuitem"
                variante="leise"
                symbol={eintrag.symbol}
                disabled={eintrag.gesperrt}
                grund={eintrag.grund}
                onClick={() => {
                  schliessen(true);
                  eintrag.aktion();
                }}
              >
                {eintrag.text}
              </Knopf>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
