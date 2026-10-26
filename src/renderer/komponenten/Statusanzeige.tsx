import type { ReactNode } from 'react';
import { Symbol, type SymbolName } from './Icon';

export type StatusArt = 'neutral' | 'erfolg' | 'hinweis' | 'fehler' | 'verarbeitung';
const symbole: Record<StatusArt, SymbolName> = {
  neutral: 'info',
  erfolg: 'erfolg',
  hinweis: 'hinweis',
  fehler: 'fehler',
  verarbeitung: 'mehr',
};

export function Statusanzeige({ art = 'neutral', children }: { art?: StatusArt; children: ReactNode }) {
  return (
    <p
      className={`sl-status sl-status--${art}`}
      role={art === 'fehler' ? 'alert' : 'status'}
      aria-live={art === 'fehler' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Symbol name={symbole[art]} />
      <span>{children}</span>
    </p>
  );
}
