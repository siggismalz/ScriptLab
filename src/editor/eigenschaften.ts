import * as Blockly from 'blockly/core';
import { definitionNachTyp, type Feld } from '../kern/katalog';

export interface Eigenschaft {
  id: string;
  quellBlockId: string;
  feldName: string;
  beschriftung: string;
  art: 'text' | 'zahl' | 'auswahl' | 'variable';
  wert: string;
  optionen?: Array<{ text: string; wert: string }>;
  min?: number;
  max?: number;
  mehrzeilig: boolean;
  hilfe: string;
}

const beschriftungen: Record<string, string> = {
  VAR: 'Variable',
  TEXT: 'Text',
  ZAHL: 'Zahl',
  WERT: 'Wert',
  OP: 'Vergleich oder Rechenart',
  ART: 'Art',
  KODIERUNG: 'Textkodierung',
  ZIELREGEL: 'Wenn die Zieldatei bereits vorhanden ist',
  RUECKFRAGE: 'Rückfrage vor dem Löschen',
  STELLEN: 'Nachkommastellen',
  FORMAT: 'Datumsformat',
  PFAD: 'Datei- oder Ordnerpfad',
  QUELLE: 'Quelldatei',
  ZIEL: 'Zieldatei',
  NAME: 'Neuer Dateiname',
  ANZAHL: 'Wiederholungen',
  SEKUNDEN: 'Wartezeit in Sekunden',
  MIN: 'Kleinste Zahl',
  MAX: 'Größte Zahl',
  A: 'Erster Wert',
  B: 'Zweiter Wert',
  SUCHEN: 'Gesuchter Text',
  ERSATZ: 'Ersatztext',
  INDEX: 'Nummer des Listeneintrags',
  LISTE: 'Liste',
  BEDINGUNG: 'Bedingung',
};

function feldHilfe(feld: Feld, pfad: string[]): string {
  if (pfad.some((teil) => /pfad|datei/i.test(teil)))
    return 'Vollständiger Wert. Beispiel: ScriptLab-Testdaten\\Datei.txt. Relative Pfade beziehen sich beim Export auf den Scriptordner und beim Test auf den gewählten Basisordner.';
  if (feld.name === 'VAR')
    return 'Wähle dieselbe Variable beim Setzen und Lesen. Der Name kann geändert werden; die Verbindung bleibt über ihre Kennung erhalten.';
  if (feld.art === 'zahl') return 'Gib eine ganze Zahl im angegebenen Bereich ein.';
  if (feld.name === 'TEXT')
    return 'Der Text bleibt unverändert als Daten erhalten. Anführungszeichen und Zeilenumbrüche sind möglich.';
  return 'Diese Einstellung verändert denselben Baustein, den du auf der Arbeitsfläche siehst.';
}

/** Liest immer den tatsächlichen Blockly-Zustand, auch bei angeschlossenen Literalwerten. */
export function eigenschaftenLesen(workspace: Blockly.Workspace, blockId: string): Eigenschaft[] {
  const anfang = workspace.getBlockById(blockId);
  if (!anfang) return [];
  const ergebnis: Eigenschaft[] = [];
  const besucht = new Set<string>();
  function lesen(block: Blockly.Block, pfad: string[], tiefe: number): void {
    if (besucht.has(block.id) || tiefe > 12) return;
    besucht.add(block.id);
    const definition = definitionNachTyp.get(block.type);
    if (!definition) return;
    for (const feld of definition.felder) {
      if (!block.getField(feld.name)) continue;
      const einfach = block.type === 'sl_text' || block.type === 'sl_number' || block.type === 'sl_bool';
      const beschriftung =
        einfach && pfad.length
          ? pfad.join(' / ')
          : [...pfad, beschriftungen[feld.name] ?? feld.name].join(' / ');
      ergebnis.push({
        id: `${block.id}:${feld.name}`,
        quellBlockId: block.id,
        feldName: feld.name,
        beschriftung,
        art: feld.name === 'VAR' ? 'variable' : block.type === 'sl_number' ? 'zahl' : feld.art,
        wert: String(block.getFieldValue(feld.name) ?? ''),
        ...(feld.name === 'VAR'
          ? {
              optionen: workspace
                .getVariableMap()
                .getAllVariables()
                .map((variable) => ({ text: variable.getName(), wert: variable.getId() })),
            }
          : feld.optionen
            ? { optionen: feld.optionen.map(([text, wert]) => ({ text, wert })) }
            : {}),
        ...(feld.min !== undefined ? { min: feld.min } : {}),
        ...(feld.max !== undefined ? { max: feld.max } : {}),
        mehrzeilig: feld.art === 'text' && feld.name === 'TEXT',
        hilfe: feldHilfe(feld, pfad),
      });
    }
    for (const eingabe of definition.eingaben) {
      if (eingabe.typ === 'Statement') continue;
      const kind = block.getInputTargetBlock(eingabe.name);
      if (kind) lesen(kind, [...pfad, beschriftungen[eingabe.name] ?? eingabe.name], tiefe + 1);
    }
  }
  lesen(anfang, [], 0);
  return ergebnis;
}

/** Keine zweite Formularwahrheit: Änderungen gehen ausschließlich an Blockly-Felder. */
export function eigenschaftSetzen(
  workspace: Blockly.Workspace,
  blockId: string,
  feldName: string,
  wert: string,
): void {
  const block = workspace.getBlockById(blockId);
  const feld = block && definitionNachTyp.get(block.type)?.felder.find((f) => f.name === feldName);
  if (!block || !feld || !block.getField(feldName))
    throw new Error('Dieses Eingabefeld ist nicht mehr vorhanden. Wähle den Baustein erneut aus.');
  if (
    typeof wert !== 'string' ||
    wert.includes('\u0000') ||
    wert.length > (feld.name === 'VAR' ? 160 : 32768)
  )
    throw new Error('Der eingegebene Wert ist zu lang oder enthält ein unzulässiges Zeichen.');
  let neuerWert: string | number = wert;
  if (feld.name === 'VAR' && !workspace.getVariableMap().getVariableById(wert))
    throw new Error('Wähle eine vorhandene Variable oder lege eine neue Variable an.');
  if (feld.art === 'auswahl' && !feld.optionen?.some(([, v]) => v === wert))
    throw new Error('Wähle eine der angebotenen Einstellungen aus.');
  if (feld.art === 'zahl') {
    const zahl = Number(wert.trim().replace(',', '.'));
    if (
      !wert.trim() ||
      !Number.isFinite(zahl) ||
      !Number.isInteger(zahl) ||
      zahl < (feld.min ?? -Infinity) ||
      zahl > (feld.max ?? Infinity)
    )
      throw new Error('Gib eine ganze Zahl im erlaubten Bereich ein.');
    neuerWert = zahl;
  }
  const vorhandeneGruppe = Blockly.Events.getGroup();
  if (!vorhandeneGruppe) Blockly.Events.setGroup(true);
  try {
    block.setFieldValue(neuerWert, feldName);
  } finally {
    if (!vorhandeneGruppe) Blockly.Events.setGroup(false);
  }
}

/** Die Namensabfrage selbst hält keine globale Gruppe offen; erst ihre synchrone Antwort ändert Blockly. */
export function variablenAntwortAusfuehren(antwort: () => void): void {
  const vorher = Blockly.Events.getGroup();
  if (!vorher) Blockly.Events.setGroup(true);
  try {
    antwort();
  } finally {
    Blockly.Events.setGroup(vorher || false);
  }
}

export function neueVariableAnlegen(
  workspace: Blockly.WorkspaceSvg,
  blockId: string,
  feldName: string,
  ausgewaehlt: () => void,
): void {
  Blockly.Variables.createVariableButtonHandler(workspace, (name) => {
    if (!name) return;
    const variable = Blockly.Variables.nameUsedWithAnyType(name, workspace);
    if (!variable) return;
    eigenschaftSetzen(workspace, blockId, feldName, variable.getId());
    ausgewaehlt();
  });
}
