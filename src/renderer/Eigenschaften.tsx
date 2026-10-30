import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import { bausteinDefinitionen } from '../kern/katalog';
import { eigenschaftenLesen, eigenschaftSetzen, neueVariableAnlegen } from '../editor/eigenschaften';
import { bausteinBeispiele } from '../editor/beispieleHilfe';
import { Knopf } from './komponenten/Knopf';
import { Menue } from './komponenten/Menue';
import { Auswahlfeld, Feld, Textfeld } from './komponenten/Feld';
import {
  BusinessEigenschaften,
  type ParameterKontext,
  type QuelleWaehlen,
  type KonfigFeldFehler,
} from './BusinessEigenschaften';
import { businessNachTyp } from '../kern/business-katalog';
import type { WorkflowParameter } from '../kern/business-modell';

export function Eigenschaften({
  parameter = [],
  spalten = [],
  spaltenNachQuelle,
  parameterKontext,
  quelleWaehlen,
  feldFehler,
  vorschauOeffnen,
  vorschauHinweis,
  ws,
  blockId,
  angeheftet,
  kannAnheften,
  anheften,
  schliessen,
  verschieben,
  blockAktion,
  beruehrt,
  schreibgeschuetzt = false,
}: {
  parameter?: WorkflowParameter[];
  spalten?: string[];
  spaltenNachQuelle?: Record<string, string[]>;
  parameterKontext?: ParameterKontext;
  quelleWaehlen?: QuelleWaehlen;
  feldFehler?: KonfigFeldFehler[];
  vorschauOeffnen?: (blockId: string) => void;
  vorschauHinweis?: string | null;
  ws: Blockly.WorkspaceSvg | null;
  blockId: string | null;
  angeheftet: boolean;
  kannAnheften: boolean;
  anheften: () => void;
  schliessen: () => void;
  verschieben: () => void;
  blockAktion: (art: 'kopieren' | 'duplizieren' | 'loeschen') => void;
  beruehrt: (id: string) => void;
  schreibgeschuetzt?: boolean;
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
    if (schreibgeschuetzt) return;
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
        <h2>{block?.getField('NAME')?.getText().trim() || definition?.name || 'Eigenschaften'}</h2>
        <div className="knopfgruppe">
          {block && (
            <Menue
              beschriftung="Bausteinaktionen"
              nurSymbol
              symbol="mehr"
              eintraege={[
                {
                  text: 'Verschieben',
                  symbol: 'verschieben',
                  gesperrt: schreibgeschuetzt,
                  grund: 'Stoppe den Lauf vor Änderungen.',
                  aktion: verschieben,
                },
                { text: 'Kopieren', symbol: 'kopieren', aktion: () => blockAktion('kopieren') },
                {
                  text: 'Duplizieren',
                  symbol: 'duplizieren',
                  gesperrt: schreibgeschuetzt,
                  grund: 'Stoppe den Lauf vor Änderungen.',
                  aktion: () => blockAktion('duplizieren'),
                },
                {
                  text: 'Baustein löschen',
                  symbol: 'loeschen',
                  gesperrt: schreibgeschuetzt,
                  grund: 'Stoppe den Lauf vor Änderungen.',
                  aktion: () => blockAktion('loeschen'),
                },
              ]}
            />
          )}

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
        {schreibgeschuetzt && (
          <p>Während des Tests sind Änderungen gesperrt. Auswahl und Ansicht bleiben nutzbar.</p>
        )}
        {definition && block ? (
          <>
            {businessNachTyp.get(block.type)?.ausgabe === 'Tabelle' && vorschauOeffnen && (
              <Knopf
                className="schritt-vorschau"
                symbol="tabelle"
                disabled={Boolean(vorschauHinweis)}
                grund={vorschauHinweis ?? undefined}
                onClick={() => vorschauOeffnen(block.id)}
              >
                Datenvorschau
              </Knopf>
            )}
            {businessNachTyp.has(block.type) && ws && (
              <BusinessEigenschaften
                ws={ws}
                block={block}
                parameter={parameter}
                spalten={spalten}
                spaltenNachQuelle={spaltenNachQuelle}
                parameterKontext={parameterKontext}
                quelleWaehlen={quelleWaehlen}
                feldFehler={feldFehler}
                gesperrt={schreibgeschuetzt}
                geaendert={() => beruehrt(block.id)}
              />
            )}
            {felder.map((f) => {
              const gemeinsam = {
                disabled: schreibgeschuetzt,
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
              const eingabe =
                f.art === 'variable' ? (
                  <div key={f.id} className="variablen-eigenschaft">
                    <Auswahlfeld {...gemeinsam}>
                      {!f.wert && (
                        <option value="" disabled>
                          Variable auswählen
                        </option>
                      )}
                      {f.optionen?.map((o) => (
                        <option key={o.wert} value={o.wert}>
                          {o.text}
                        </option>
                      ))}
                    </Auswahlfeld>
                    <Knopf
                      disabled={schreibgeschuetzt}
                      grund="Stoppe den Test vor Änderungen."
                      onClick={() => {
                        if (!ws) return;
                        neueVariableAnlegen(ws, f.quellBlockId, f.feldName, () => beruehrt(f.quellBlockId));
                      }}
                    >
                      Neue Variable anlegen
                    </Knopf>
                  </div>
                ) : f.art === 'auswahl' ? (
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
              return block.type.startsWith('sl_biz_') && f.feldName === 'NAME' ? (
                <details key={f.id} className="baustein-benennung block-hilfe">
                  <summary>Bausteindetails</summary>
                  {eingabe}
                  <p>{definition.hilfe}</p>
                  {bausteinBeispiele[block.type] && <p>{bausteinBeispiele[block.type]}</p>}
                </details>
              ) : (
                eingabe
              );
            })}
            {!businessNachTyp.has(block.type) && (
              <details className="block-hilfe">
                <summary>Hinweise und Beispiel</summary>
                <p>{definition.hilfe}</p>
                {bausteinBeispiele[block.type] && <p>{bausteinBeispiele[block.type]}</p>}
              </details>
            )}
          </>
        ) : (
          <p>Wähle einen Baustein im Arbeitsbereich. Seine Eingaben und Hilfen erscheinen hier.</p>
        )}
      </div>
    </aside>
  );
}
