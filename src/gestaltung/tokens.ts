/** Gemeinsame Farbrollen für HTML und Blockly; der Import benötigt keinen DOM-Zugriff. */
export type Darstellungswahl = 'dunkel' | 'hell' | 'system';
export type Farbschema = Exclude<Darstellungswahl, 'system'>;

const blockfarben = {
  blockText: '#F3F5F8',
  blockFeld: '#151F2C',
  blockKontur: '#B8C4D4',
  blockAuswahl: '#F3F5F8',
  blockFokus: '#F3F5F8',
  blockFehler: '#E9A5A3',
} as const;

export const farbenNachThema = {
  dunkel: {
    fenster: '#17231F',
    navigation: '#121D19',
    grundflaeche: '#1D2B25',
    erhoeht: '#27382F',
    arbeitsflaeche: '#17231F',
    trennung: '#40574A',
    kontur: '#91A79B',
    text: '#F3F5F8',
    textSekundaer: '#BCCDC4',
    akzent: '#9DCBC0',
    aufAkzent: '#14241F',
    auswahlFlaeche: '#294A40',
    erfolg: '#92C7A1',
    hinweis: '#E2BD79',
    fehler: '#E9A5A3',
    akzentHover: '#B0D8CF',
    akzentGedrueckt: '#8AB8AE',
    inaktivFlaeche: '#27382F',
    inaktivText: '#BCCDC4',
    inaktivKontur: '#91A79B',
    auswahl: '#9DCBC0',
    canvasFokus: '#F3F5F8',
    einfuegestelle: '#F3F5F8',
    dialogHintergrund: '#00000099',
    ...blockfarben,
  },
  hell: {
    fenster: '#F3F6F4',
    navigation: '#EAF0EC',
    grundflaeche: '#FFFFFF',
    erhoeht: '#F7FAF8',
    arbeitsflaeche: '#EEF3F0',
    trennung: '#D3DFD8',
    kontur: '#667A70',
    text: '#24332C',
    textSekundaer: '#52675D',
    akzent: '#286C63',
    aufAkzent: '#FFFFFF',
    auswahlFlaeche: '#E1EEE8',
    erfolg: '#2E6545',
    hinweis: '#805C14',
    fehler: '#A2403F',
    akzentHover: '#235D56',
    akzentGedrueckt: '#1C4F49',
    inaktivFlaeche: '#F7FAF8',
    inaktivText: '#52675D',
    inaktivKontur: '#667A70',
    auswahl: '#286C63',
    canvasFokus: '#24332C',
    einfuegestelle: '#1F2937',
    dialogHintergrund: '#12263E66',
    ...blockfarben,
  },
} as const;

/** Heller Erstkontakt; eine gespeicherte Darstellungswahl wird ausdrücklich aufgelöst. */
export const farben = farbenNachThema.hell;

/** Die gespeicherte Wahl bleibt unverändert, auch wenn das System umschaltet. */
export function farbschemaAufloesen(wahl: Darstellungswahl = 'hell', systemHell = false): Farbschema {
  return wahl === 'system' ? (systemHell ? 'hell' : 'dunkel') : wahl;
}

export const abstaende = { eng: 4, zusammen: 8, gruppe: 12, panel: 16, abschnitt: 24, gross: 32 } as const;

export const masse = {
  werkzeugleiste: 52,
  statusleiste: 28,
  palette: 272,
  paletteMinimum: 240,
  paletteMaximum: 400,
  eigenschaften: 320,
  bedienfeld: 36,
  iconZiel: 32,
  icon: 20,
  iconKlein: 16,
  raster: 24,
  radius: 6,
  radiusDialog: 8,
  fokusKontur: 2,
  fokusAbstand: 3,
  uebergang: 150,
} as const;

export const schrift = {
  familie: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  codeFamilie: '"Cascadia Code", Consolas, "Courier New", monospace',
  seite: 24,
  normal: 14,
  metadaten: 12,
  abschnitt: 16,
  dialog: 20,
  code: 13,
  zeilenhoehe: 1.5,
  normalGewicht: 400,
  semiboldGewicht: 600,
} as const;

/** Fünf Fachfarben ordnen Aufgaben; Kategorienamen und Formen tragen die Bedeutung mit. */
export const fachfarben = {
  ablauf: '#365E8B',
  daten: '#4F6291',
  dateien: '#5F6651',
  dokumente: '#7D5369',
  werte: '#4D6977',
} as const;

/** Die Palette bleibt themenübergreifend gleich; helle Blocktexte sind eine eigene Farbrolle. */
export const kategoriefarben = {
  Ablauf: fachfarben.ablauf,
  Bedingungen: fachfarben.ablauf,
  Schleifen: fachfarben.ablauf,
  'Variablen und Listen': fachfarben.ablauf,
  Geschäftsablauf: fachfarben.ablauf,
  'Daten laden': fachfarben.daten,
  'Daten aufbereiten': fachfarben.daten,
  'Daten verbinden': fachfarben.daten,
  'Daten zusammenfassen': fachfarben.daten,
  Datenqualität: fachfarben.daten,
  'Daten ausgeben': fachfarben.daten,
  'Dateien und Ordner': fachfarben.dateien,
  Geschäftsdateien: fachfarben.dateien,
  'Erweitertes Löschen': fachfarben.dateien,
  Word: fachfarben.dokumente,
  Excel: fachfarben.dokumente,
  PDF: fachfarben.dokumente,
  Texte: fachfarben.werte,
  Zahlen: fachfarben.werte,
  'Ein- und Ausgaben': fachfarben.werte,
  'Datum und Zeit': fachfarben.werte,
} as const;

const farbrollen: Readonly<Record<keyof typeof farben, string>> = {
  fenster: '--farbe-fenster',
  navigation: '--farbe-navigation',
  arbeitsflaeche: '--farbe-arbeitsflaeche',
  grundflaeche: '--farbe-grundflaeche',
  erhoeht: '--farbe-erhoeht',
  trennung: '--farbe-trennung',
  kontur: '--farbe-kontur',
  text: '--farbe-text',
  textSekundaer: '--farbe-text-sekundaer',
  akzent: '--farbe-akzent',
  aufAkzent: '--farbe-auf-akzent',
  erfolg: '--farbe-erfolg',
  hinweis: '--farbe-hinweis',
  fehler: '--farbe-fehler',
  akzentHover: '--farbe-akzent-hover',
  akzentGedrueckt: '--farbe-akzent-gedrueckt',
  inaktivFlaeche: '--farbe-inaktiv-flaeche',
  inaktivText: '--farbe-inaktiv-text',
  inaktivKontur: '--farbe-inaktiv-kontur',
  auswahl: '--farbe-auswahl',
  auswahlFlaeche: '--farbe-auswahl-flaeche',
  canvasFokus: '--farbe-canvas-fokus',
  einfuegestelle: '--farbe-einfuegestelle',
  dialogHintergrund: '--dialog-hintergrund',
  blockText: '--farbe-block-text',
  blockFeld: '--farbe-block-feld',
  blockKontur: '--farbe-block-kontur',
  blockAuswahl: '--farbe-block-auswahl',
  blockFokus: '--farbe-block-fokus',
  blockFehler: '--farbe-block-fehler',
};

export function cssVariablenFuer(schema: Farbschema): Readonly<Record<string, string>> {
  const thema = farbenNachThema[schema];
  return {
    ...Object.fromEntries(
      Object.entries(farbrollen).map(([rolle, name]) => [name, thema[rolle as keyof typeof thema]]),
    ),
    'color-scheme': schema === 'hell' ? 'light' : 'dark',
    ...Object.fromEntries(Object.values(abstaende).map((wert) => [`--abstand-${wert}`, `${wert}px`])),
    '--schrift-familie': schrift.familie,
    '--schrift-code-familie': schrift.codeFamilie,
    '--schrift-seite': `${schrift.seite}px`,
    '--schrift-normal': `${schrift.normal}px`,
    '--schrift-meta': `${schrift.metadaten}px`,
    '--schrift-abschnitt': `${schrift.abschnitt}px`,
    '--schrift-dialog': `${schrift.dialog}px`,
    '--schrift-code': `${schrift.code}px`,
    '--zeilenhoehe': String(schrift.zeilenhoehe),
    '--gewicht-normal': String(schrift.normalGewicht),
    '--gewicht-semibold': String(schrift.semiboldGewicht),
    '--radius-normal': `${masse.radius}px`,
    '--radius-dialog': `${masse.radiusDialog}px`,
    '--hoehe-bedienfeld': `${masse.bedienfeld}px`,
    '--ziel-icon': `${masse.iconZiel}px`,
    '--groesse-icon': `${masse.icon}px`,
    '--fokus-kontur': `${masse.fokusKontur}px`,
    '--fokus-abstand': `${masse.fokusAbstand}px`,
    '--dauer-uebergang': `${masse.uebergang}ms`,
    '--hoehe-werkzeugleiste': `${masse.werkzeugleiste}px`,
    '--hoehe-statusleiste': `${masse.statusleiste}px`,
    '--breite-palette': `${masse.palette}px`,
    '--breite-eigenschaften': `${masse.eigenschaften}px`,
    '--schatten-overlay':
      schema === 'hell' ? '0 8px 24px rgb(18 38 62 / 0.16)' : '0 8px 24px rgb(0 0 0 / 0.35)',
  };
}

export const cssVariablen = cssVariablenFuer('hell');

/** Ein Themenwechsel ändert ausschließlich die persönliche Darstellung, keine Workflowdaten. */
export function designTokensAnwenden(
  element?: Pick<HTMLElement, 'style'>,
  schema: Farbschema = 'hell',
): void {
  const ziel = element ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (!ziel) return;
  for (const [name, wert] of Object.entries(cssVariablenFuer(schema))) ziel.style.setProperty(name, wert);
}
