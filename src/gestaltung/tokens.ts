/** Gemeinsame Farbrollen für HTML und Blockly; der Import benötigt keinen DOM-Zugriff. */
export type Darstellungswahl = 'dunkel' | 'hell' | 'system';
export type Farbschema = Exclude<Darstellungswahl, 'system'>;

const blockfarben = {
  blockText: '#EEF3F4',
  blockFeld: '#1A252B',
  blockKontur: '#B9C6CB',
  blockAuswahl: '#EEF3F4',
  blockFokus: '#EEF3F4',
  blockFehler: '#E9A5A3',
} as const;

export const farbenNachThema = {
  dunkel: {
    fenster: '#172126',
    navigation: '#131D22',
    grundflaeche: '#202D33',
    erhoeht: '#2A3942',
    arbeitsflaeche: '#1A252B',
    trennung: '#3C4D56',
    kontur: '#81939D',
    text: '#EEF3F4',
    textSekundaer: '#B9C6CB',
    akzent: '#8FC2BC',
    aufAkzent: '#102D2A',
    auswahlFlaeche: '#2E4648',
    erfolg: '#92C7A1',
    hinweis: '#E2BD79',
    fehler: '#E9A5A3',
    akzentHover: '#A6D3CD',
    akzentGedrueckt: '#7AB1AB',
    inaktivFlaeche: '#2A3942',
    inaktivText: '#B9C6CB',
    inaktivKontur: '#81939D',
    auswahl: '#8FC2BC',
    canvasFokus: '#EEF3F4',
    einfuegestelle: '#EEF3F4',
    dialogHintergrund: '#00000099',
    ...blockfarben,
  },
  hell: {
    fenster: '#F1F4F3',
    navigation: '#E7EDEA',
    grundflaeche: '#FFFFFF',
    erhoeht: '#F8FAF9',
    arbeitsflaeche: '#E9EFED',
    trennung: '#D4DEDA',
    kontur: '#6F827B',
    text: '#182C2C',
    textSekundaer: '#4B6260',
    akzent: '#24635D',
    aufAkzent: '#FFFFFF',
    auswahlFlaeche: '#DFECE8',
    erfolg: '#2E6545',
    hinweis: '#805C14',
    fehler: '#A2403F',
    akzentHover: '#1D554F',
    akzentGedrueckt: '#174841',
    inaktivFlaeche: '#F8FAF9',
    inaktivText: '#4B6260',
    inaktivKontur: '#6F827B',
    auswahl: '#24635D',
    canvasFokus: '#182C2C',
    einfuegestelle: '#182C2C',
    dialogHintergrund: '#102D2A66',
    ...blockfarben,
  },
} as const;

/** Kompatibler Standard: Neue Installationen starten dunkel. */
export const farben = farbenNachThema.dunkel;

/** Die gespeicherte Wahl bleibt unverändert, auch wenn das System umschaltet. */
export function farbschemaAufloesen(wahl: Darstellungswahl = 'dunkel', systemHell = false): Farbschema {
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

/** Fachliche Kategorien verwenden in beiden Themen dieselbe gedämpfte Palette und helle Blocktexte. */
export const kategoriefarben = {
  Ablauf: '#8A5818',
  Bedingungen: '#3B62A5',
  Schleifen: '#6C45A2',
  'Dateien und Ordner': '#286E6B',
  'Variablen und Listen': '#914D38',
  Texte: '#337145',
  Zahlen: '#35677F',
  'Ein- und Ausgaben': '#824A74',
  'Datum und Zeit': '#5A5F8C',
  'Erweitertes Löschen': '#9A3440',
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
      schema === 'hell' ? '0 8px 24px rgb(16 45 42 / 0.16)' : '0 8px 24px rgb(0 0 0 / 0.35)',
  };
}

export const cssVariablen = cssVariablenFuer('dunkel');

/** Ein Themenwechsel ändert ausschließlich die persönliche Darstellung, keine Workflowdaten. */
export function designTokensAnwenden(
  element?: Pick<HTMLElement, 'style'>,
  schema: Farbschema = 'dunkel',
): void {
  const ziel = element ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (!ziel) return;
  for (const [name, wert] of Object.entries(cssVariablenFuer(schema))) ziel.style.setProperty(name, wert);
}
