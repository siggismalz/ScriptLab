import type { ReactNode, SVGProps } from 'react';

const formen = {
  neu: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 15h8M12 11v8" />
    </>
  ),
  oeffnen: (
    <>
      <path d="M3 8V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2" />
      <path d="M3 8h16a2 2 0 0 1 2 2l-2 9a2 2 0 0 1-2 1H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  speichern: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" />
      <path d="M7 3v6h10V3M7 21v-8h10v8" />
    </>
  ),
  exportieren: (
    <>
      <path d="M14 3h7v7M21 3l-11 11" />
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  rueckgaengig: (
    <>
      <path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" />
    </>
  ),
  wiederholen: (
    <>
      <path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14" />
    </>
  ),
  menue: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  suchen: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  schliessen: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  links: <path d="m15 5-7 7 7 7" />,
  rechts: <path d="m9 5 7 7-7 7" />,
  unten: <path d="m5 9 7 7 7-7" />,
  oben: <path d="m5 15 7-7 7 7" />,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  einpassen: (
    <>
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
  eigenschaften: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </>
  ),
  code: (
    <>
      <path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 4l-4 16" />
    </>
  ),
  hinweis: (
    <>
      <path d="M10.3 3.9 2 18.2A1.8 1.8 0 0 0 3.6 21h16.8a1.8 1.8 0 0 0 1.6-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v5m0 3v.1" />
    </>
  ),
  fehler: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  erfolg: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  kopieren: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  einfuegen: (
    <>
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 12h8M8 16h5" />
    </>
  ),
  duplizieren: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3M11 14h7m-3.5-3.5v7" />
    </>
  ),
  loeschen: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </>
  ),
  verschieben: (
    <>
      <path d="M12 2v20M2 12h20m-7-7-3-3-3 3m6 14-3 3-3-3M5 9l-3 3 3 3m14-6 3 3-3 3" />
    </>
  ),
  anheften: (
    <>
      <path d="m16 3 5 5-4 1-4 4 1 4-3 3-3-5-5-3 3-3 4 1 4-4Z" />
      <path d="m8 16-5 5" />
    </>
  ),
  loesen: (
    <>
      <path d="m3 3 18 18M10 5l3-2 8 8-2 3M7 9l-4 3 5 3 3 5 3-3M8 16l-5 5" />
    </>
  ),
  einstellungen: (
    <>
      <path d="m9 3-1 3-3 1v4l-2 1 2 1v4l3 1 1 3h6l1-3 3-1v-4l2-1-2-1V7l-3-1-1-3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  mehr: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type SymbolName = keyof typeof formen;
export const symbolNamen = Object.keys(formen) as SymbolName[];

interface SymbolEigenschaften extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: SymbolName;
  groesse?: number;
  titel?: string;
}

/** Ein durchgängiges lokales Linieniconset; Beschriftungen übernimmt normalerweise das Bedienelement. */
export function Symbol({ name, groesse = 20, titel, className = '', ...eigenschaften }: SymbolEigenschaften) {
  return (
    <svg
      {...eigenschaften}
      className={`sl-symbol ${className}`}
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titel ? undefined : true}
      aria-label={titel}
      role={titel ? 'img' : undefined}
      focusable="false"
    >
      {titel && <title>{titel}</title>}
      {formen[name]}
    </svg>
  );
}
