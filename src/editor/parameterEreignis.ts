import * as Blockly from 'blockly/core';
import { businessProjektPruefen, type BusinessProjekt } from '../kern/business-modell';

const ereignisTyp = 'scriptlab_parameter';
const blockdatenTyp = 'scriptlab_blockdaten';
const empfaenger = new Map<string, (business: BusinessProjekt) => void>();

/** Die Anwendung bindet ihre Projektaktualisierung an genau diesen Arbeitsbereich. */
export function parameterEreignisAnmelden(
  workspaceId: string,
  uebernehmen: (business: BusinessProjekt) => void,
): () => void {
  empfaenger.set(workspaceId, uebernehmen);
  return () => {
    if (empfaenger.get(workspaceId) === uebernehmen) empfaenger.delete(workspaceId);
  };
}

interface ParameterEreignisJson extends Blockly.Events.AbstractEventJson {
  vorher: BusinessProjekt;
  nachher: BusinessProjekt;
}

/** Definitionen und Satzwerte gehören in dieselbe Undo-Gruppe wie ihre Blockverweise. */
export class ParameterEreignis extends Blockly.Events.Abstract {
  type = ereignisTyp;
  isBlank = true;
  private vorher?: BusinessProjekt;
  private nachher?: BusinessProjekt;

  constructor(workspace?: Blockly.Workspace, vorher?: BusinessProjekt, nachher?: BusinessProjekt) {
    super();
    if (!workspace || !vorher || !nachher) return;
    this.workspaceId = workspace.id;
    this.vorher = businessProjektPruefen(vorher);
    this.nachher = businessProjektPruefen(nachher);
    this.isBlank = false;
  }

  toJson(): ParameterEreignisJson {
    if (!this.vorher || !this.nachher)
      throw new Error('Das Parameterereignis enthält noch keinen vollständigen Vorher- und Nachherstand.');
    return {
      ...super.toJson(),
      vorher: structuredClone(this.vorher),
      nachher: structuredClone(this.nachher),
    };
  }

  static fromJson(
    json: ParameterEreignisJson,
    workspace: Blockly.Workspace,
    ereignis = new ParameterEreignis(),
  ): ParameterEreignis {
    Blockly.Events.Abstract.fromJson(json, workspace, ereignis);
    ereignis.vorher = businessProjektPruefen(json.vorher);
    ereignis.nachher = businessProjektPruefen(json.nachher);
    return ereignis;
  }

  isNull(): boolean {
    return this.isBlank || JSON.stringify(this.vorher) === JSON.stringify(this.nachher);
  }

  run(vorwaerts: boolean): void {
    const workspace = this.getEventWorkspace_();
    const uebernehmen = empfaenger.get(workspace.id);
    const stand = vorwaerts ? this.nachher : this.vorher;
    if (!uebernehmen || !stand)
      throw new Error('Die Parameteränderung kann diesem Arbeitsbereich nicht mehr zugeordnet werden.');
    uebernehmen(structuredClone(stand));
  }
}

Blockly.registry.register(Blockly.registry.Type.EVENT, ereignisTyp, ParameterEreignis, true);

interface BlockDatenEreignisJson extends Blockly.Events.BlockBaseJson {
  vorher: string | null;
  nachher: string | null;
}

function blockdatenPruefen(wert: unknown): string | null {
  if (wert === null || (typeof wert === 'string' && wert.length <= 65536)) return wert;
  throw new Error('Das Blockdatenereignis enthält ungültige Einstellungen.');
}

/** Blockly 13 kennt keinen nativen BlockChange-Typ „data“; Daten brauchen ein eigenes Undo. */
export class BlockDatenEreignis extends Blockly.Events.BlockBase {
  type = blockdatenTyp;
  private vorher: string | null;
  private nachher: string | null;

  constructor(block?: Blockly.Block, vorher: string | null = null, nachher: string | null = null) {
    super(block);
    this.vorher = blockdatenPruefen(vorher);
    this.nachher = blockdatenPruefen(nachher);
  }

  toJson(): BlockDatenEreignisJson {
    return { ...super.toJson(), vorher: this.vorher, nachher: this.nachher };
  }

  static fromJson(
    json: BlockDatenEreignisJson,
    workspace: Blockly.Workspace,
    ereignis = new BlockDatenEreignis(),
  ): BlockDatenEreignis {
    Blockly.Events.BlockBase.fromJson(json, workspace, ereignis);
    ereignis.vorher = blockdatenPruefen(json.vorher);
    ereignis.nachher = blockdatenPruefen(json.nachher);
    return ereignis;
  }

  isNull(): boolean {
    return this.isBlank || this.vorher === this.nachher;
  }

  run(vorwaerts: boolean): void {
    const block = this.blockId && this.getEventWorkspace_().getBlockById(this.blockId);
    if (!block) throw new Error('Der Baustein dieser Einstellungsänderung ist nicht mehr vorhanden.');
    const vorher = block.data;
    block.data = vorwaerts ? this.nachher : this.vorher;
    // Undo/Redo deaktiviert recordUndo; das Folgeereignis aktualisiert weiterhin Projekt und Ansicht.
    Blockly.Events.fire(new BlockDatenEreignis(block, vorher, block.data));
  }
}

Blockly.registry.register(Blockly.registry.Type.EVENT, blockdatenTyp, BlockDatenEreignis, true);
