import * as Blockly from 'blockly/core';
import { farbenNachThema, kategoriefarben, schrift, type Farbschema } from './tokens';

export const blockStilNachKategorie = {
  Ablauf: 'ablauf',
  Bedingungen: 'bedingungen',
  Schleifen: 'schleifen',
  'Dateien und Ordner': 'dateien',
  'Variablen und Listen': 'variablen',
  Geschäftsablauf: 'geschaeftsablauf',
  'Daten laden': 'daten_laden',
  'Daten aufbereiten': 'daten_aufbereiten',
  'Daten verbinden': 'daten_verbinden',
  'Daten zusammenfassen': 'daten_zusammenfassen',
  Datenqualität: 'datenqualitaet',
  'Daten ausgeben': 'daten_ausgeben',
  Geschäftsdateien: 'geschaeftsdateien',
  Word: 'word',
  Excel: 'excel',
  PDF: 'pdf',
  Texte: 'texte',
  Zahlen: 'zahlen',
  'Ein- und Ausgaben': 'eingaben_ausgaben',
  'Datum und Zeit': 'datum_zeit',
  'Erweitertes Löschen': 'datei_loeschen',
} as const;

function themaErstellen(schema: Farbschema): Blockly.Theme {
  const farben = farbenNachThema[schema];
  const blockStile = Object.fromEntries(
    Object.entries(kategoriefarben).map(([kategorie, farbe]) => [
      blockStilNachKategorie[kategorie as keyof typeof kategoriefarben],
      {
        colourPrimary: farbe,
        // Schattenwerte werden ausdrücklich dunkel gehalten. Zelos darf sie nicht selbst aufhellen.
        colourSecondary: farben.blockFeld,
        colourTertiary: farben.blockKontur,
      },
    ]),
  );

  /** Offizielle Theme-Schnittstellen; Auswahlrahmen und Tastaturfokus erhalten eigene Konturen. */
  return Blockly.Theme.defineTheme(`scriptlab-${schema}`, {
    name: `scriptlab-${schema}`,
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
      selectedGlowColour: farben.blockAuswahl,
      selectedGlowOpacity: 0,
    },
    // Blockly 13 misst Theme-Schriftgrößen in pt. Die Tokens bleiben in logischen CSS-Pixeln.
    fontStyle: {
      family: schrift.familie,
      weight: String(schrift.normalGewicht),
      size: (schrift.normal * 72) / 96,
    },
  });
}

const themen = { dunkel: themaErstellen('dunkel'), hell: themaErstellen('hell') };

export function scriptlabThemaFuer(schema: Farbschema): Blockly.Theme {
  return themen[schema];
}

/** Heller Erstkontakt, bis die gespeicherte Wahl auf den Workspace angewendet wird. */
export const scriptlabThema = themen.hell;
