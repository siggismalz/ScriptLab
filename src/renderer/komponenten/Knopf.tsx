import { useId, type ButtonHTMLAttributes } from 'react';
import { Symbol, type SymbolName } from './Icon';

interface KnopfEigenschaften extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaer' | 'standard' | 'leise' | 'gefahr';
  symbol?: SymbolName;
  verarbeitung?: boolean;
  grund?: string;
  grundId?: string;
}

export function Knopf({
  variante = 'standard',
  symbol,
  verarbeitung = false,
  grund,
  grundId,
  disabled,
  children,
  className = '',
  type = 'button',
  ...eigenschaften
}: KnopfEigenschaften) {
  const id = useId();
  const gesperrt = Boolean(disabled || verarbeitung);
  const erklaerung =
    gesperrt && !grundId
      ? grund ||
        (verarbeitung
          ? 'Der Vorgang wird gerade verarbeitet.'
          : 'Diese Aktion steht hier noch nicht zur Verfügung.')
      : undefined;
  const knopf = (
    <button
      {...eigenschaften}
      type={type}
      disabled={gesperrt}
      aria-busy={verarbeitung || undefined}
      aria-describedby={
        [eigenschaften['aria-describedby'], gesperrt ? grundId : undefined, erklaerung ? id : undefined]
          .filter(Boolean)
          .join(' ') || undefined
      }
      className={`sl-knopf sl-knopf--${variante} ${!children ? 'sl-knopf--symbol' : ''} ${className}`}
    >
      {symbol && <Symbol name={symbol} />}
      {children && <span>{children}</span>}
      {verarbeitung && <span className="sl-nur-vorlesen">Wird verarbeitet.</span>}
    </button>
  );
  if (!erklaerung) return knopf;
  return (
    <span className="sl-knopf-mit-grund">
      {knopf}
      <span id={id} className="sl-knopf-grund">
        {erklaerung}
      </span>
    </span>
  );
}
