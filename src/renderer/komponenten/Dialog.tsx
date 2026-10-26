import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Knopf } from './Knopf';

interface DialogEigenschaften {
  offen: boolean;
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
  fuss?: ReactNode;
  beschreibung?: string;
  anfangsfokusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/** Der native modale Dialog macht den Hintergrund inert und begrenzt die Tab-Reihenfolge. */
export function Dialog({
  offen,
  titel,
  onSchliessen,
  children,
  fuss,
  beschreibung,
  anfangsfokusRef,
  className = '',
}: DialogEigenschaften) {
  const element = useRef<HTMLDialogElement>(null);
  const ueberschrift = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const dialog = element.current;
    if (!offen || !dialog) return;
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const fokus = anfangsfokusRef?.current ?? ueberschrift.current;
    fokus?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (vorher?.isConnected) vorher.focus({ preventScroll: true });
    };
  }, [offen, anfangsfokusRef]);

  return (
    <dialog
      ref={element}
      className={`sl-dialog ${className}`}
      aria-labelledby={`${id}-titel`}
      aria-describedby={beschreibung ? `${id}-beschreibung` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onSchliessen();
      }}
    >
      <header className="sl-dialog-kopf">
        <h2 ref={ueberschrift} id={`${id}-titel`} tabIndex={-1}>
          {titel}
        </h2>
        <Knopf
          variante="leise"
          symbol="schliessen"
          aria-label="Dialog schließen"
          title="Dialog schließen"
          onClick={onSchliessen}
        />
      </header>
      <div className="sl-dialog-inhalt">
        {beschreibung && <p id={`${id}-beschreibung`}>{beschreibung}</p>}
        {children}
      </div>
      {fuss && <footer className="sl-dialog-fuss">{fuss}</footer>}
    </dialog>
  );
}
