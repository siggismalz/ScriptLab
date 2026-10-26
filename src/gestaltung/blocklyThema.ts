import * as Blockly from 'blockly/core';
import { farben, kategoriefarben, schrift } from './tokens';

export const blockStilNachKategorie = {
  Ablauf: 'ablauf',
  Bedingungen: 'bedingungen',
  Schleifen: 'schleifen',
  'Dateien und Ordner': 'dateien',
  'Variablen und Listen': 'variablen',
  Texte: 'texte',
  Zahlen: 'zahlen',
  'Ein- und Ausgaben': 'eingaben_ausgaben',
  'Datum und Zeit': 'datum_zeit',
  'Erweitertes Löschen': 'datei_loeschen',
} as const;

const blockStile = Object.fromEntries(
  Object.entries(kategoriefarben).map(([kategorie, farbe]) => [
    blockStilNachKategorie[kategorie as keyof typeof kategoriefarben],
    {
      colourPrimary: farbe,
      // Schattenwerte werden ausdrücklich dunkel gehalten. Zelos darf sie nicht selbst aufhellen.
      colourSecondary: farben.arbeitsflaeche,
      colourTertiary: farben.textSekundaer,
    },
  ]),
);

/** Offizielle Theme-Schnittstellen; Auswahlrahmen und Tastaturfokus erhalten eigene Konturen. */
export const scriptlabThema = Blockly.Theme.defineTheme('scriptlab', {
  name: 'scriptlab',
  base: Blockly.Themes.Classic,
  blockStyles: blockStile,
  categoryStyles: Object.fromEntries(
    Object.entries(kategoriefarben).map(([kategorie, colour]) => [
      blockStilNachKategorie[kategorie as keyof typeof kategoriefarben],
      { colour },
    ]),
  ),
  componentStyles: {
    workspaceBackgroundColour: farben.arbeitsflaeche,
    toolboxBackgroundColour: farben.grundflaeche,
    toolboxForegroundColour: farben.text,
    flyoutBackgroundColour: farben.grundflaeche,
    flyoutForegroundColour: farben.text,
    flyoutOpacity: 1,
    scrollbarColour: farben.kontur,
    scrollbarOpacity: 1,
    insertionMarkerColour: farben.einfuegestelle,
    insertionMarkerOpacity: 1,
    markerColour: farben.canvasFokus,
    cursorColour: farben.canvasFokus,
    selectedGlowColour: farben.auswahl,
    selectedGlowOpacity: 0,
  },
  // Blockly 13 misst Theme-Schriftgrößen in pt. Die Tokens bleiben in logischen CSS-Pixeln.
  fontStyle: {
    family: schrift.familie,
    weight: String(schrift.normalGewicht),
    size: (schrift.normal * 72) / 96,
  },
});
