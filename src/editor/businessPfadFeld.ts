import * as Blockly from 'blockly/core';
import { businessDatenLesen, businessNachTyp } from '../kern/business-katalog';
import type { JsonWert } from '../kern/business-modell';
import { istQuellenfeld } from '../kern/quellenfeld';
import { BlockDatenEreignis } from './parameterEreignis';
import { dateipfadAusAblage } from '../gemeinsam/dateiablage';

export const businessPfadFeldname = 'SL_QUELLPFAD';
interface Quellenblock {
  type: string;
  data?: string | null;
}

/** Nur eine eindeutig benannte einzelne Quelle; niemals ein Ausgabeziel oder eine Quellenliste. */
export function businessPfadFeld(block: Quellenblock): { name: string; titel: string } | null {
  const def = businessNachTyp.get(block.type);
  if (!def) return null;
  try {
    const k = businessDatenLesen(block.type, block.data ?? undefined).konfiguration;
    const felder = def.felder.filter((f) => f.art === 'text' && istQuellenfeld(block.type, [f.name], k));
    if (felder.length !== 1) return null;
    // Zum Beispiel können DOCX-Abschnitte zusätzliche Bildquellen besitzen.
    const weitereQuelle = (wert: JsonWert, pfad: string[]): boolean =>
      (pfad.length > 1 && istQuellenfeld(block.type, pfad, k)) ||
      (wert !== null &&
        typeof wert === 'object' &&
        Object.entries(wert).some(([name, kind]) => weitereQuelle(kind, [...pfad, name])));
    if (Object.entries(k).some(([name, wert]) => weitereQuelle(wert, [name]))) return null;
    return { name: felder[0].name, titel: felder[0].titel };
  } catch {
    return null;
  }
}

/** Bewusste Pfadänderung in den kanonischen Daten, auch für den Canvas-Dateidrop. */
export function businessPfadSetzen(block: Blockly.Block, pfad: string): boolean {
  if (block.disposed || block.isInFlyout || !block.isEditable())
    throw new Error('Der Baustein ist zurzeit nicht bearbeitbar. Beende einen laufenden Workflow zuerst.');
  if (typeof pfad !== 'string' || pfad.length > 32768 || /[\u0000\r\n]/.test(pfad))
    throw new Error('Der Quellenpfad ist zu lang oder enthält unzulässige Zeichen.');
  const daten = businessDatenLesen(block.type, block.data ?? undefined);
  const feld = businessPfadFeld(block);
  if (!feld)
    throw new Error('Dieser Baustein hat keine einzelne eindeutige Quelle. Verwende Daten und Parameter.');
  const bisher = daten.konfiguration[feld.name];
  if (bisher !== null && typeof bisher !== 'string')
    throw new Error(
      'Der Quellenpfad ist gebunden. Ändere die Parameter- oder Variablenzuordnung bewusst unter Daten und Parameter.',
    );
  if (bisher === pfad) return false;
  const vorher = block.data ?? null;
  const nachher = JSON.stringify({ ...daten, konfiguration: { ...daten.konfiguration, [feld.name]: pfad } });
  // Erst prüfen, dann Daten ändern: Auch ein zu großer Gesamtzustand bleibt unberührt.
  const ereignis = new BlockDatenEreignis(block, vorher, nachher);
  const gruppe = Blockly.Events.getGroup();
  if (!gruppe) Blockly.Events.setGroup(true);
  try {
    // Das Ereignis muss die Gruppe der tatsächlichen Änderung erhalten.
    ereignis.group = Blockly.Events.getGroup();
    block.data = nachher;
    Blockly.Events.fire(ereignis);
  } finally {
    Blockly.Events.setGroup(gruppe || false);
  }
  return true;
}

/** Anzeigeadapter: Der Pfad wird ausschließlich in block.data gespeichert. */
export class BusinessPfadFeld extends Blockly.FieldTextInput {
  private wirdSynchronisiert = false;
  private synchronisierteDaten: string | null | undefined;
  private wurdeSynchronisiert = false;
  private eingabeElement: HTMLInputElement | HTMLTextAreaElement | null = null;

  constructor(private readonly titel: string) {
    super('');
    this.maxDisplayLength = 40;
    this.setSpellcheck(false);
    this.setAriaTypeName(titel);
    this.setValidator((wert) => {
      if (this.wirdSynchronisiert) return wert;
      const block = this.getSourceBlock();
      if (!block) return wert;
      try {
        businessPfadSetzen(block, wert);
        return wert;
      } catch (fehler) {
        this.eingabeElement?.setCustomValidity(
          fehler instanceof Error ? fehler.message : 'Der Quellenpfad ist ungültig.',
        );
        this.eingabeElement?.reportValidity();
        return null;
      }
    });
  }

  override setValue(wert: unknown, _ereignis = true): void {
    // Die Änderung gehört ins BlockDatenEreignis, nicht als zweiter Feldwert ins Undo.
    super.setValue(wert, false);
  }

  override isSerializable(): boolean {
    return false;
  }

  override initModel(): void {
    super.initModel();
    this.aktualisieren();
  }

  aktualisieren(): void {
    const block = this.getSourceBlock();
    if (!block || (this.wurdeSynchronisiert && this.synchronisierteDaten === block.data)) return;
    this.synchronisierteDaten = block.data;
    this.wurdeSynchronisiert = true;
    let anzeige = 'Quelle in Daten und Parameter festlegen';
    let bearbeitbar = false;
    let hilfe = 'Öffne Daten und Parameter, um diese Quelle eindeutig zu konfigurieren.';
    const feld = businessPfadFeld(block);
    if (feld) {
      const wert = businessDatenLesen(block.type, block.data ?? undefined).konfiguration[feld.name];
      bearbeitbar = wert === null || typeof wert === 'string';
      if (bearbeitbar) {
        anzeige = typeof wert === 'string' ? wert : '';
        hilfe =
          'Gib den echten Quellenpfad ein. Relative Pfade verwenden den Workflow-Arbeitsordner. Den Bausteinnamen änderst du in den Eigenschaften.';
      } else if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
        anzeige =
          typeof wert.parameter === 'string'
            ? `Parameter: ${wert.parameter}`
            : typeof wert.variable === 'string'
              ? 'Variable aus dem Workflow'
              : anzeige;
        hilfe = 'Der Quellenpfad ist gebunden. Ändere die Zuordnung unter Daten und Parameter.';
      }
    }
    this.setEnabled(bearbeitbar);
    this.setTooltip(hilfe);
    if (!bearbeitbar) Blockly.WidgetDiv.hideIfOwner(this);
    this.wirdSynchronisiert = true;
    try {
      if (this.isBeingEdited_) this.setEditorValue_(anzeige, false);
      else this.setValue(anzeige, false);
    } finally {
      this.wirdSynchronisiert = false;
    }
  }

  protected override getText_(): string | null {
    return this.getValue() === '' ? 'Pfad eingeben' : super.getText_();
  }

  protected override widgetCreate_(): HTMLInputElement | HTMLTextAreaElement {
    const eingabe = super.widgetCreate_();
    this.eingabeElement = eingabe;
    eingabe.setAttribute('aria-label', `${this.titel} direkt am Baustein`);
    eingabe.setAttribute('placeholder', 'Pfad eingeben');
    // Vor dem nativen Blockly-Inputhandler alte Ablagefehler zurücknehmen.
    eingabe.addEventListener('input', () => eingabe.setCustomValidity(''), { capture: true });
    eingabe.addEventListener('dragover', (event) => {
      if (!(event instanceof DragEvent)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = this.isCurrentlyEditable() ? 'copy' : 'none';
    });
    eingabe.addEventListener('drop', (event) => {
      if (!(event instanceof DragEvent)) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const block = this.getSourceBlock();
        if (!block || !this.isCurrentlyEditable())
          throw new Error(
            'Der Quellenpfad ist gesperrt. Prüfe den Lauf und die Zuordnung unter Daten und Parameter.',
          );
        if (!event.dataTransfer) throw new Error('Lege genau eine lokale Datei auf das Quellenfeld.');
        const pfad = dateipfadAusAblage(event.dataTransfer);
        businessPfadSetzen(block, pfad);
        eingabe.setCustomValidity('');
        eingabe.value = pfad;
        // Derselbe native Eingabeweg hält Tipppuffer, Feldanzeige und Daten konsistent.
        eingabe.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (fehler) {
        eingabe.setCustomValidity(
          fehler instanceof Error ? fehler.message : 'Der Quellenpfad konnte nicht übernommen werden.',
        );
        eingabe.reportValidity();
      }
    });
    return eingabe;
  }

  protected override widgetDispose_(): void {
    // FieldInput meldet beim Schließen sonst zusätzlich einen nativen Feldwertwechsel.
    // Die kanonischen Änderungen liegen bereits gruppiert als BlockDatenEreignis vor.
    Blockly.Events.disable();
    try {
      super.widgetDispose_();
    } finally {
      Blockly.Events.enable();
      this.eingabeElement = null;
    }
  }
}
