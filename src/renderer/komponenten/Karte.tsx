import type { HTMLAttributes } from 'react';
import './karte.css';

interface KartenEigenschaften extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'section' | 'div';
  hervorgehoben?: boolean;
}

/** Eine Inhaltsfläche. Interaktionen bleiben bei ihren beschrifteten nativen Bedienelementen. */
export function Karte({
  as: Element = 'article',
  hervorgehoben = false,
  className = '',
  children,
  ...eigenschaften
}: KartenEigenschaften) {
  return (
    <Element
      {...eigenschaften}
      className={`sl-karte ${hervorgehoben ? 'sl-karte--hervorgehoben' : ''} ${className}`}
    >
      {children}
    </Element>
  );
}
