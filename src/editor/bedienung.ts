import * as Blockly from 'blockly/core';
import { definitionNachTyp } from '../kern/katalog';
import { werkzeugkasten } from './bausteine';

export interface Einfuegestelle {
  id: string;
  art: 'nach' | 'eingang' | 'frei';
  blockId?: string;
  eingang?: string;
  text: string;
  hinweis?: string;
}

/** Blockly 13 legt Ereignisse erst nach einem Bildaufbau und Timer im Verlauf ab. */
export async function verlaufAendern(workspace: Blockly.Workspace, wiederholen = false): Promise<void> {
  await new Promise<void>((fertig) => {
    const nachEreignissen = () => setTimeout(fertig, 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(nachEreignissen);
    else nachEreignissen();
  });
  // Ein inzwischen geschlossenes Fenster hat seinen Arbeitsbereich bereits entfernt.
  if (Blockly.common.getWorkspaceById(workspace.id) === workspace) workspace.undo(wiederholen);
}

function blockName(block: Blockly.Block): string {
  const name = definitionNachTyp.get(block.type)?.name ?? 'Baustein';
  const inhalt =
    block.getFieldValue('VAR') ??
    block.getFieldValue('TEXT') ??
    block.getInputTargetBlock('TEXT')?.getFieldValue('TEXT') ??
    block.getInputTargetBlock('QUELLE')?.getFieldValue('TEXT');
  if (typeof inhalt !== 'string' || !inhalt.trim()) return name;
  const kurz = inhalt.replace(/\s+/g, ' ').trim();
  return `${name} – ${kurz.length > 32 ? `${kurz.slice(0, 31)}…` : kurz}`;
}

function verbindungLesen(workspace: Blockly.Workspace, ziel: Einfuegestelle): Blockly.Connection | null {
  if (ziel.art === 'frei') return null;
  const block = ziel.blockId && workspace.getBlockById(ziel.blockId);
  if (!block) throw new Error('Die gewählte Einfügestelle ist nicht mehr vorhanden. Wähle eine neue Stelle.');
  const anschluss =
    ziel.art === 'nach' ? block.nextConnection : block.getInput(ziel.eingang ?? '')?.connection;
  if (!anschluss) throw new Error('Dieser Baustein hat an der gewählten Stelle keinen passenden Anschluss.');
  return anschluss;
}

/** Ausschließlich den ausgewählten Block und seine verschachtelten Eingänge ausschließen. */
function enthalteneBloecke(block: Blockly.Block): Set<string> {
  const ergebnis = new Set([block.id]);
  for (const eingabe of block.inputList) {
    const kind = eingabe.connection?.targetBlock();
    if (kind) for (const enthalten of kind.getDescendants(false)) ergebnis.add(enthalten.id);
  }
  return ergebnis;
}

function passt(quelle: Blockly.Block, ziel: Blockly.Connection): boolean {
  const anschluss = quelle.outputConnection ?? quelle.previousConnection;
  if (!anschluss) return false;
  const richtigeRichtung =
    (anschluss.type === Blockly.ConnectionType.OUTPUT_VALUE &&
      ziel.type === Blockly.ConnectionType.INPUT_VALUE) ||
    (anschluss.type === Blockly.ConnectionType.PREVIOUS_STATEMENT &&
      ziel.type === Blockly.ConnectionType.NEXT_STATEMENT);
  if (!richtigeRichtung || ziel.getSourceBlock().isShadow()) return false;
  if (!ziel.getConnectionChecker().doTypeChecks(anschluss, ziel)) return false;
  // Ein Endbaustein kann keinen vorhandenen Ablauf hinter sich aufnehmen.
  if (
    anschluss.type === Blockly.ConnectionType.PREVIOUS_STATEMENT &&
    !quelle.nextConnection &&
    ziel.isConnected()
  )
    return false;
  return true;
}

export function einfuegestellenLesen(workspace: Blockly.Workspace, blockTypOderId: string): Einfuegestelle[] {
  const vorhanden = workspace.getBlockById(blockTypOderId);
  if (!vorhanden && !definitionNachTyp.has(blockTypOderId))
    throw new Error('Dieser Bausteintyp wird nicht unterstützt.');
  const probeWorkspace = vorhanden ? null : new Blockly.Workspace();
  const quelle = vorhanden ?? probeWorkspace!.newBlock(blockTypOderId);
  const ausgeschlossen = vorhanden ? enthalteneBloecke(vorhanden) : new Set<string>();
  const ergebnis: Einfuegestelle[] = [];
  const bloecke = workspace.getAllBlocks(false);
  const namen = new Map<string, string>();
  const doppelte = new Map<string, number>();
  for (const block of bloecke) {
    const name = blockName(block);
    doppelte.set(name, (doppelte.get(name) ?? 0) + 1);
  }
  const nummern = new Map<string, number>();
  for (const block of bloecke) {
    const name = blockName(block);
    const nummer = (nummern.get(name) ?? 0) + 1;
    nummern.set(name, nummer);
    namen.set(block.id, (doppelte.get(name) ?? 0) > 1 ? `${name} (${nummer})` : name);
  }
  try {
    if (!quelle.isShadow())
      for (const block of bloecke) {
        if (ausgeschlossen.has(block.id) || block.isShadow()) continue;
        if (block.nextConnection && passt(quelle, block.nextConnection))
          ergebnis.push({
            id: `nach:${block.id}`,
            art: 'nach',
            blockId: block.id,
            text: `Nach „${namen.get(block.id)}“`,
            ...(block.nextConnection.isConnected()
              ? { hinweis: 'Der vorhandene Ablauf folgt danach weiter.' }
              : {}),
          });
        for (const eingabe of block.inputList) {
          if (!eingabe.connection || !passt(quelle, eingabe.connection)) continue;
          const definition = definitionNachTyp.get(block.type)?.eingaben.find((e) => e.name === eingabe.name);
          const bezeichnung: Record<string, string> = {
            DANN: 'Dann-Ablauf',
            SONST: 'Sonst-Ablauf',
            ABLAUF: 'innerer Ablauf',
            TEXT: 'Text',
            PFAD: 'Pfad',
            QUELLE: 'Quelle',
            ZIEL: 'Ziel',
            ANZAHL: 'Anzahl',
            BEDINGUNG: 'Bedingung',
            WERT: 'Wert',
            LISTE: 'Liste',
            A: 'erster Wert',
            B: 'zweiter Wert',
            SUCHEN: 'gesuchter Text',
            ERSATZ: 'Ersatztext',
            NAME: 'neuer Dateiname',
            SEKUNDEN: 'Sekunden',
            MIN: 'kleinste Zahl',
            MAX: 'größte Zahl',
            INDEX: 'Eintragsnummer',
          };
          const name = bezeichnung[eingabe.name] ?? eingabe.name;
          const besetzt = eingabe.connection.targetBlock();
          ergebnis.push({
            id: `eingang:${block.id}:${eingabe.name}`,
            art: 'eingang',
            blockId: block.id,
            eingang: eingabe.name,
            text: `${definition?.typ === 'Statement' ? 'In' : 'Für'} „${namen.get(block.id)}“: ${name}`,
            ...(besetzt && !besetzt.isShadow()
              ? {
                  hinweis:
                    definition?.typ === 'Statement'
                      ? 'Der vorhandene innere Ablauf folgt danach weiter.'
                      : 'Der bisherige Wert bleibt erhalten und wird bei Bedarf als eigener Baustein gelöst.',
                }
              : {}),
          });
        }
      }
    ergebnis.push({
      id: 'frei',
      art: 'frei',
      text: 'Unverbunden auf der Arbeitsfläche ablegen',
      hinweis: 'Verbinde aktive Anweisungen vor dem Export mit dem Startablauf.',
    });
    return ergebnis;
  } finally {
    probeWorkspace?.dispose();
  }
}

export function bausteinVorlage(typ: string): Blockly.serialization.blocks.State {
  const definition = definitionNachTyp.get(typ);
  if (!definition) throw new Error('Dieser Bausteintyp wird nicht unterstützt.');
  const kategorien = werkzeugkasten.contents as Array<{ contents?: Blockly.utils.toolbox.BlockInfo[] }>;
  const eintrag = kategorien.flatMap((k) => k.contents ?? []).find((b) => b.type === typ);
  const { kind: _kind, ...vorlage } = eintrag ?? { kind: 'block', type: typ };
  return structuredClone(vorlage) as Blockly.serialization.blocks.State;
}

function vorlagenGroesse(vorlage: Blockly.serialization.blocks.State): number {
  return (
    1 +
    Object.values(vorlage.inputs ?? {}).reduce(
      (anzahl, anschluss) =>
        anzahl +
        (anschluss.block ? vorlagenGroesse(anschluss.block) : 0) +
        (anschluss.shadow ? vorlagenGroesse(anschluss.shadow) : 0),
      0,
    ) +
    (vorlage.next?.block ? vorlagenGroesse(vorlage.next.block) : 0)
  );
}

function gruppe<T>(aendern: () => T): T {
  const vorher = Blockly.Events.getGroup();
  if (!vorher) Blockly.Events.setGroup(true);
  try {
    return aendern();
  } finally {
    if (!vorher) Blockly.Events.setGroup(false);
  }
}

function freiePosition(workspace: Blockly.Workspace): Blockly.utils.Coordinate {
  if (workspace instanceof Blockly.WorkspaceSvg) {
    const sicht = workspace.getMetricsManager().getViewMetrics(true);
    return new Blockly.utils.Coordinate(sicht.left + 48, sicht.top + 48);
  }
  return new Blockly.utils.Coordinate(48, 48);
}

function verbinden(workspace: Blockly.Workspace, block: Blockly.Block, ziel: Einfuegestelle): void {
  if (ziel.art === 'frei') {
    const position = freiePosition(workspace);
    const vorher = block.getRelativeToSurfaceXY();
    block.moveBy(position.x - vorher.x, position.y - vorher.y);
    return;
  }
  const anschluss = verbindungLesen(workspace, ziel)!;
  const quelle = block.outputConnection ?? block.previousConnection;
  if (
    !quelle ||
    !passt(block, anschluss) ||
    !workspace.connectionChecker.canConnect(anschluss, quelle, false)
  )
    throw new Error('Dieser Baustein passt nicht an die gewählte Stelle.');
  if (!anschluss.connect(quelle))
    throw new Error('Die Bausteine konnten nicht verbunden werden. Wähle die Einfügestelle erneut.');
}

export function bausteinEinfuegen(
  workspace: Blockly.Workspace,
  typ: string,
  ziel: Einfuegestelle,
): Blockly.Block {
  const gueltigesZiel = einfuegestellenLesen(workspace, typ).find(
    (z) => z.id === ziel.id && z.art === ziel.art && z.blockId === ziel.blockId && z.eingang === ziel.eingang,
  );
  if (!gueltigesZiel) throw new Error('Dieser Baustein passt nicht an die gewählte Stelle.');
  const vorlage = bausteinVorlage(typ);
  if (workspace.getAllBlocks(false).length + vorlagenGroesse(vorlage) > 2000)
    throw new Error('Der Arbeitsbereich enthält bereits die maximale Zahl an Bausteinen.');
  return gruppe(() => {
    const block = Blockly.serialization.blocks.append(vorlage, workspace, { recordUndo: true });
    try {
      verbinden(workspace, block, gueltigesZiel);
      return block;
    } catch (fehler) {
      block.dispose(false);
      throw fehler;
    }
  });
}

export function bausteinVerschieben(
  workspace: Blockly.Workspace,
  id: string,
  ziel: Einfuegestelle,
): Blockly.Block {
  const block = workspace.getBlockById(id);
  if (!block || block.isShadow() || !block.isMovable())
    throw new Error('Dieser Baustein kann nicht verschoben werden.');
  const gueltigesZiel = einfuegestellenLesen(workspace, id).find(
    (z) => z.id === ziel.id && z.art === ziel.art && z.blockId === ziel.blockId && z.eingang === ziel.eingang,
  );
  if (!gueltigesZiel) throw new Error('Dieser Baustein passt nicht an die gewählte Stelle.');
  return gruppe(() => {
    if (block.outputConnection) block.unplug(false);
    else {
      const davor = block.previousConnection?.targetConnection;
      const danach = block.nextConnection?.targetConnection;
      if (danach) block.nextConnection!.disconnect();
      if (davor) block.previousConnection!.disconnect();
      if (davor && danach && workspace.connectionChecker.canConnect(davor, danach, false))
        davor.connect(danach);
    }
    verbinden(workspace, block, gueltigesZiel);
    return block;
  });
}

/** Pointer-Bewegungen verwenden weiterhin Blockly-Verbindungsprüfung und Einfügemarker. */
export function paletteZiehenStarten(
  workspace: Blockly.WorkspaceSvg,
  typ: string,
  start: PointerEvent,
  optionen: {
    ausgewaehlt?: (id: string) => void;
    abgeschlossen?: (abgebrochen: boolean) => void;
    meldung?: (text: string) => void;
  } = {},
): () => void {
  if (start.button !== 0) return () => {};
  start.preventDefault();
  let block: Blockly.BlockSvg | null = null;
  let zieher: Blockly.dragging.Dragger | null = null;
  let vorherigeGruppe = '';
  let gruppeBegonnen = false;
  let beendet = false;
  const sichtVorher = { x: workspace.scrollX, y: workspace.scrollY };
  const aufraeumen = () => {
    document.removeEventListener('pointermove', bewegen, true);
    document.removeEventListener('pointerup', loslassen, true);
    document.removeEventListener('pointercancel', abbrechen, true);
    document.removeEventListener('keydown', taste, true);
    window.removeEventListener('blur', fokusVerloren);
  };
  const ende = (abgebrochen: boolean, event?: PointerEvent | KeyboardEvent) => {
    if (beendet) return;
    beendet = true;
    aufraeumen();
    try {
      if (zieher && block) {
        if (abgebrochen) {
          zieher.onDragRevert(event);
          workspace.setResizesEnabled(true);
          if (!block.isDeadOrDying()) block.dispose(false);
          Blockly.getFocusManager().focusNode(workspace);
          workspace.scroll(sichtVorher.x, sichtVorher.y);
        } else {
          zieher.onDragEnd(event);
          optionen.ausgewaehlt?.(block.id);
        }
      }
    } finally {
      if (abgebrochen || !block) workspace.setResizesEnabled(true);
      if (gruppeBegonnen) Blockly.Events.setGroup(vorherigeGruppe);
      optionen.abgeschlossen?.(abgebrochen);
    }
  };
  const bewegen = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    const delta = new Blockly.utils.Coordinate(event.clientX - start.clientX, event.clientY - start.clientY);
    if (!block && Math.hypot(delta.x, delta.y) < 5) return;
    event.preventDefault();
    try {
      if (!block) {
        const vorlage = bausteinVorlage(typ);
        if (workspace.getAllBlocks(false).length + vorlagenGroesse(vorlage) > 2000)
          throw new Error('Der Arbeitsbereich enthält bereits die maximale Zahl an Bausteinen.');
        vorherigeGruppe = Blockly.Events.getGroup();
        gruppeBegonnen = true;
        if (!vorherigeGruppe) Blockly.Events.setGroup(true);
        const position = Blockly.utils.svgMath.screenToWsCoordinates(
          workspace,
          new Blockly.utils.Coordinate(start.clientX - 20, start.clientY - 16),
        );
        // Der Pointer startet links außerhalb des Canvas. Dieser vorübergehende
        // negative Blockort darf die Scrollgrenzen und damit den Ablauf nicht verschieben.
        workspace.setResizesEnabled(false);
        block = Blockly.serialization.blocks.append({ ...vorlage, x: position.x, y: position.y }, workspace, {
          recordUndo: true,
        }) as Blockly.BlockSvg;
        zieher = new Blockly.dragging.Dragger(block);
        zieher.onDragStart(start);
      }
      zieher!.onDrag(event, delta);
    } catch (fehler) {
      optionen.meldung?.(
        fehler instanceof Error ? fehler.message : 'Der Baustein konnte nicht gezogen werden.',
      );
      ende(true, event);
    }
  };
  const loslassen = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    const grenzen = workspace.getParentSvg().getBoundingClientRect();
    const innerhalb =
      event.clientX >= grenzen.left &&
      event.clientX <= grenzen.right &&
      event.clientY >= grenzen.top &&
      event.clientY <= grenzen.bottom;
    ende(!innerhalb, event);
  };
  const abbrechen = (event?: PointerEvent) => ende(true, event);
  const fokusVerloren = () => ende(true);
  const taste = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      ende(true, event);
    }
  };
  document.addEventListener('pointermove', bewegen, { capture: true, passive: false });
  document.addEventListener('pointerup', loslassen, true);
  document.addEventListener('pointercancel', abbrechen, true);
  document.addEventListener('keydown', taste, true);
  window.addEventListener('blur', fokusVerloren);
  return () => ende(true);
}

/** Reguläres Blockly-Plugin: Escape stellt auch eine Mausbewegung wieder her. */
export class ScriptLabBlockDragger extends Blockly.dragging.Dragger {
  private abgebrochen = false;
  private vorherigeGruppe = '';
  private sichtVorher = { x: 0, y: 0 };
  private readonly taste = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.abgebrochen = true;
    this.onDragRevert(event);
    this.draggable.workspace.cancelCurrentGesture();
  };
  override onDragStart(event?: PointerEvent | KeyboardEvent): Blockly.IDraggable {
    this.abgebrochen = false;
    this.vorherigeGruppe = Blockly.Events.getGroup();
    this.sichtVorher = { x: this.draggable.workspace.scrollX, y: this.draggable.workspace.scrollY };
    const ziel = super.onDragStart(event);
    if (!(event instanceof KeyboardEvent)) document.addEventListener('keydown', this.taste, true);
    return ziel;
  }
  override onDragEnd(event?: PointerEvent | KeyboardEvent): void {
    document.removeEventListener('keydown', this.taste, true);
    if (!this.abgebrochen) super.onDragEnd(event);
  }
  override onDragRevert(event?: PointerEvent | KeyboardEvent): void {
    document.removeEventListener('keydown', this.taste, true);
    super.onDragRevert(event);
    // endDrag würde auch bei REVERT erneut am Raster einrasten. Beim Abbrechen
    // bleiben dagegen die ursprünglichen Koordinaten und Verbindungen exakt erhalten.
    this.draggable.workspace.setResizesEnabled(true);
    if (this.draggable instanceof Blockly.BlockSvg) {
      this.draggable.setDeleteStyle(false);
      Blockly.Events.fire(
        new Blockly.Events.BlockDrag(this.draggable, false, this.draggable.getDescendants(false)),
      );
    }
    this.draggable.workspace.scroll(this.sichtVorher.x, this.sichtVorher.y);
    Blockly.Events.setGroup(this.vorherigeGruppe);
  }
}

let navigationRegistriert = false;
export function editorNavigationEinrichten(
  workspace: Blockly.WorkspaceSvg,
  optionen: { paletteFokussieren?: () => void } = {},
): () => void {
  if (!navigationRegistriert) {
    Blockly.ShortcutItems.registerNavigationShortcuts();
    navigationRegistriert = true;
  }
  const element = workspace.getParentSvg();
  const mausrad = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const grenzen = element.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? grenzen.height : 1);
    workspace.zoom(
      event.clientX - grenzen.left,
      event.clientY - grenzen.top,
      Math.max(-1, Math.min(1, -delta / 100)),
    );
  };
  const browserZoomVerhindern = (event: WheelEvent) => {
    // Canvas-Zoom ist auf die Arbeitsfläche begrenzt. Ein Ctrl-Mausrad außerhalb
    // verändert weder die gesamte Oberfläche noch die normale Textskalierung.
    if (event.ctrlKey && (!(event.target instanceof Node) || !element.contains(event.target)))
      event.preventDefault();
  };
  const taste = (event: KeyboardEvent) => {
    const ziel = event.target;
    if (ziel instanceof Element && ziel.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (
      event.key.toLowerCase() === 't' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      optionen.paletteFokussieren
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      optionen.paletteFokussieren();
    }
  };
  element.addEventListener('wheel', mausrad, { capture: true, passive: false });
  window.addEventListener('wheel', browserZoomVerhindern, { capture: true, passive: false });
  element.addEventListener('keydown', taste, true);
  return () => {
    element.removeEventListener('wheel', mausrad, true);
    window.removeEventListener('wheel', browserZoomVerhindern, true);
    element.removeEventListener('keydown', taste, true);
  };
}
