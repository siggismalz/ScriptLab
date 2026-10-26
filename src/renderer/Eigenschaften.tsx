import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import { bausteinDefinitionen } from '../kern/katalog';
import { eigenschaftenLesen, eigenschaftSetzen } from '../editor/eigenschaften';
import { bausteinBeispiele } from '../editor/beispieleHilfe';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld, Feld, Textfeld } from './komponenten/Feld';

export function Eigenschaften({
  ws,
  blockId,
  angeheftet,
  kannAnheften,
  anheften,
  schliessen,
  verschieben,
  blockAktion,
  beruehrt,
}: {
  ws: Blockly.WorkspaceSvg | null;
  blockId: string | null;
  angeheftet: boolean;
  kannAnheften: boolean;
  anheften: () => void;
  schliessen: () => void;
  verschieben: () => void;
  blockAktion: (art: 'kopieren' | 'duplizieren' | 'loeschen') => void;
  beruehrt: (id: string) => void;
}) {
  const [feldfehler, setFeldfehler] = useState<Record<string, string>>({});
  const block = blockId ? ws?.getBlockById(blockId) : null;
  const definition = bausteinDefinitionen.find((b) => b.typ === block?.type);
  const felder = ws && blockId ? eigenschaftenLesen(ws, blockId) : [];
  const inhalt = useRef<HTMLDivElement>(null);
  // Vor der ersten Anzeige fokussieren, damit ein späterer Frame keine Eingabe überholt.
  useLayoutEffect(() => {
    const erstesFeld = inhalt.current?.querySelector<HTMLElement>(
      '.panel-inhalt input, .panel-inhalt textarea, .panel-inhalt select',
    );
    const ersatz = inhalt.current?.querySelector<HTMLElement>('.panel-kopf button');
    (erstesFeld ?? ersatz)?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    setFeldfehler({});
  }, [blockId]);
  const setzen = (quellId: string, feld: string, id: string, wert: string) => {
    try {
      eigenschaftSetzen(ws!, quellId, feld, wert);
      setFeldfehler((alt) => ({ ...alt, [id]: '' }));
    } catch (problem) {
      const text = problem instanceof Error ? problem.message : 'Bitte prüfe diesen Wert.';
      setFeldfehler((alt) => ({ ...alt, [id]: text }));
    }
  };
  return (
    <aside
      ref={inhalt}
      className={`eigenschaften-panel ${angeheftet && kannAnheften ? 'ist-angeheftet' : 'ist-ueberlagert'}`}
      data-testid="eigenschaften-panel"
      aria-label="Bausteineigenschaften"
    >
      <header className="panel-kopf">
        <h2>Eigenschaften</h2>
        <div className="knopfgruppe">
          {kannAnheften && (
            <Knopf
              variante="leise"
              symbol={angeheftet ? 'loesen' : 'anheften'}
              aria-label={angeheftet ? 'Eigenschaften lösen' : 'Eigenschaften anheften'}
              title={angeheftet ? 'Eigenschaften lösen' : 'Eigenschaften anheften'}
              aria-pressed={angeheftet}
              onClick={anheften}
            />
          )}
          <Knopf
            variante="leise"
            symbol="schliessen"
            aria-label="Eigenschaften schließen"
            title="Eigenschaften schließen"
            onClick={schliessen}
          />
        </div>
      </header>
      <div className="panel-inhalt">
        {definition && block ? (
          <>
            <h3>{definition.name}</h3>
            <p>{definition.hilfe}</p>
            <section className="blockbeispiel">
              <h3>Beispiel</h3>
              <p>{bausteinBeispiele[block.type]}</p>
            </section>
            {felder.map((f) => {
              const gemeinsam = {
                beschriftung: f.beschriftung,
                value: f.wert,
                hilfe: f.hilfe,
                fehler: feldfehler[f.id],
                onFocus: () => Blockly.Events.setGroup(true),
                onBlur: () => {
                  Blockly.Events.setGroup(false);
                  beruehrt(block.id);
                  beruehrt(f.quellBlockId);
                },
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
                ) => setzen(f.quellBlockId, f.feldName, f.id, e.target.value),
              };
              return f.art === 'auswahl' ? (
                <Auswahlfeld key={f.id} {...gemeinsam}>
                  {f.optionen?.map((o) => (
                    <option key={o.wert} value={o.wert}>
                      {o.text}
                    </option>
                  ))}
                </Auswahlfeld>
              ) : f.mehrzeilig ? (
                <Textfeld key={f.id} {...gemeinsam} rows={3} spellCheck={false} />
              ) : (
                <Feld
                  key={f.id}
                  {...gemeinsam}
                  type="text"
                  inputMode={f.art === 'zahl' ? 'decimal' : 'text'}
                  min={f.min}
                  max={f.max}
                  spellCheck={false}
                />
              );
            })}
            <section className="eigenschaften-aktionen">
              <h3>Baustein bearbeiten</h3>
              <Knopf symbol="verschieben" onClick={verschieben}>
                Verschieben
              </Knopf>
              <Knopf symbol="kopieren" onClick={() => blockAktion('kopieren')}>
                Kopieren
              </Knopf>
              <Knopf symbol="duplizieren" onClick={() => blockAktion('duplizieren')}>
                Duplizieren
              </Knopf>
              <Knopf variante="gefahr" symbol="loeschen" onClick={() => blockAktion('loeschen')}>
                Baustein löschen
              </Knopf>
            </section>
          </>
        ) : (
          <p>Wähle einen Baustein im Arbeitsbereich. Seine Eingaben und Hilfen erscheinen hier.</p>
        )}
      </div>
    </aside>
  );
}
