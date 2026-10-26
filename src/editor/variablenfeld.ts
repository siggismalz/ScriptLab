import * as Blockly from 'blockly/core';

/** Ein ungelöster alter Entwurf darf durch Blockly.initModel nicht stillschweigend gültig werden. */
export class Variablenfeld extends Blockly.FieldVariable {
  private auswahlFehlt = false;

  static override fromJson(optionen: Blockly.FieldVariableFromJsonConfig): Variablenfeld {
    return new Variablenfeld(
      optionen.variable ?? null,
      undefined,
      optionen.variableTypes,
      optionen.defaultType,
      optionen,
    );
  }
  override loadState(zustand: unknown): void {
    if (zustand === '') {
      this.auswahlFehlt = true;
      this.forceRerender();
      return;
    }
    this.auswahlFehlt = false;
    super.loadState(zustand);
  }
  override saveState(vollstaendig?: boolean): unknown {
    return this.auswahlFehlt ? '' : super.saveState(vollstaendig);
  }
  override initModel(): void {
    if (!this.auswahlFehlt) super.initModel();
  }
  override getValue(): string | null {
    return this.auswahlFehlt ? '' : super.getValue();
  }
  override getText(): string {
    return this.auswahlFehlt ? 'Variable auswählen' : super.getText();
  }
  override getVariable() {
    return this.auswahlFehlt ? null : super.getVariable();
  }
  override setValue(neuerWert: unknown, ereignis = true): void {
    const block = this.getSourceBlock();
    if (
      block &&
      (neuerWert === '' ||
        (this.auswahlFehlt &&
          typeof neuerWert === 'string' &&
          block.workspace.getVariableMap().getVariableById(neuerWert)))
    ) {
      const vorher = this.getValue();
      this.auswahlFehlt = neuerWert === '';
      if (!this.auswahlFehlt) super.doValueUpdate_(String(neuerWert));
      if (ereignis && vorher !== neuerWert && Blockly.Events.isEnabled())
        Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'field', this.name, vorher, neuerWert));
      this.forceRerender();
      return;
    }
    super.setValue(neuerWert, ereignis);
  }
  override getOptions(verwendeCache?: boolean): Blockly.MenuOption[] {
    if (!this.auswahlFehlt) return super.getOptions(verwendeCache);
    return [
      ['Variable auswählen', ''],
      ...(this.getSourceBlock()?.workspace.getVariableMap().getAllVariables() ?? []).map(
        (variable): [string, string] => [variable.getName(), variable.getId()],
      ),
    ];
  }
  protected override doValueUpdate_(neueId: string): void {
    this.auswahlFehlt = false;
    super.doValueUpdate_(neueId);
  }
}
