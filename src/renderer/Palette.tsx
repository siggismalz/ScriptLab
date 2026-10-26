import type * as Blockly from 'blockly/core';
import { useState } from 'react';
import { bausteinDefinitionen } from '../kern/katalog';
import { paletteZiehenStarten, type Einfuegestelle } from '../editor/bedienung';
import { Knopf } from './komponenten/Knopf';
import { Feld } from './komponenten/Feld';
import { Symbol } from './komponenten/Icon';

export interface PlatzierungsAuftrag {
  art: 'einfuegen' | 'verschieben';
  typOderId: string;
  name: string;
}

export function Palette({
  ws,
  eingeklappt,
  umschalten,
  platzierung,
  ziele,
  einfuegen,
  zielWaehlen,
  abbrechen,
  blockAuswaehlen,
  meldung,
}: {
  ws: Blockly.WorkspaceSvg | null;
  eingeklappt: boolean;
  umschalten: () => void;
  platzierung: PlatzierungsAuftrag | null;
  ziele: Einfuegestelle[];
  einfuegen: (typ: string) => void;
  zielWaehlen: (ziel: Einfuegestelle) => void;
  abbrechen: () => void;
  blockAuswaehlen: (id: string) => void;
  meldung: (text: string) => void;
}) {
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('Ein- und Ausgaben');
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const gruppen = [...new Set(bausteinDefinitionen.map((b) => b.kategorie))];
  const reihenfolge = ['Ein- und Ausgaben', ...gruppen.filter((g) => g !== 'Ein- und Ausgaben')];
  const filter = suche.trim().toLocaleLowerCase('de');
  const treffer = bausteinDefinitionen.filter((b) =>
    `${b.name} ${b.kategorie} ${b.hilfe}`.toLocaleLowerCase('de').includes(filter),
  );
  const darstellung = (typ: string) => {
    const b = bausteinDefinitionen.find((b) => b.typ === typ)!;
    const form =
      b.ausgabe === 'Boolean'
        ? 'Bedingung'
        : b.form === 'wert'
          ? 'Wert'
          : b.form === 'start'
            ? 'Start'
            : 'Anweisung';
    return (
      <div className={`paletten-eintrag ${ausgewaehlt === typ ? 'ist-ausgewaehlt' : ''}`} key={typ}>
        <button
          className="paletten-block"
          aria-label={`Baustein ziehen: ${b.name}`}
          onPointerDown={(event) => {
            if (!ws || event.button !== 0) return;
            paletteZiehenStarten(ws, typ, event.nativeEvent, {
              ausgewaehlt: (id) => blockAuswaehlen(id),
              abgeschlossen: () => {},
              meldung,
            });
          }}
          onClick={() => setAusgewaehlt(typ)}
          style={{ '--blockfarbe': b.farbe } as React.CSSProperties}
        >
          <svg
            className={`block-form block-form--${b.form}`}
            viewBox="0 0 28 28"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <path
              d={
                b.ausgabe === 'Boolean'
                  ? 'M7 4h14l7 10-7 10H7L0 14Z'
                  : b.form === 'wert'
                    ? 'M8 4h12a10 10 0 0 1 0 20H8A10 10 0 0 1 8 4Z'
                    : b.form === 'start'
                      ? 'M2 10Q14-2 26 10V24H18l-3 3h-4l-3-3H2Z'
                      : 'M2 3h6l3 3h4l3-3h8v21h-8l-3 3h-4l-3-3H2Z'
              }
            />
          </svg>
          <span>
            <strong>{b.name}</strong>
            <span className="metadaten">
              {filter ? `${b.kategorie} · ` : ''}
              {form}
            </span>
          </span>
        </button>
        <Knopf
          variante="leise"
          symbol="plus"
          aria-label={`Baustein einfügen: ${b.name}`}
          title="Einfügestelle mit einem Klick wählen"
          onClick={() => einfuegen(typ)}
        />
        {ausgewaehlt === typ && <p className="paletten-hilfe">{b.hilfe}</p>}
      </div>
    );
  };
  return (
    <aside
      className={`palette ${eingeklappt ? 'palette--zu' : ''}`}
      data-testid="palette"
      aria-label="Bausteinpalette"
    >
      <header className="panel-kopf">
        <h2>{!eingeklappt && 'Bausteine'}</h2>
        <Knopf
          variante="leise"
          symbol={eingeklappt ? 'rechts' : 'links'}
          aria-label={eingeklappt ? 'Bausteinpalette öffnen' : 'Bausteinpalette einklappen'}
          title={eingeklappt ? 'Bausteinpalette öffnen' : 'Bausteinpalette einklappen'}
          onClick={umschalten}
        />
      </header>
      {!eingeklappt && (
        <>
          <div className="palette-suche">
            <Feld
              beschriftung="Bausteine suchen"
              type="search"
              placeholder="Zum Beispiel Nachricht"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            {!suche && (
              <p className="palette-bedienhinweis">Mit Plus einfügen oder am Bausteinnamen ziehen.</p>
            )}
            {suche && (
              <Knopf variante="leise" onClick={() => setSuche('')}>
                Suche leeren
              </Knopf>
            )}
          </div>
          {platzierung ? (
            <section className="zielwahl" aria-label="Einfügestelle wählen">
              <h3>{platzierung.art === 'verschieben' ? 'Baustein verschieben' : 'Baustein einfügen'}</h3>
              <p>
                {platzierung.name}: Wähle die gewünschte Stelle im Ablauf. Du kannst auch einen Baustein im
                Arbeitsbereich anklicken.
              </p>
              <div className="zielwahl-liste">
                {ziele.map((z) => (
                  <Knopf key={z.id} onClick={() => zielWaehlen(z)}>
                    {z.text}
                  </Knopf>
                ))}
              </div>
              <Knopf onClick={abbrechen}>Abbrechen</Knopf>
            </section>
          ) : (
            <div className="palette-inhalt" data-testid="palette-bausteine">
              {filter ? (
                <>
                  <p className="suchergebnis" role="status">
                    {treffer.length === 1
                      ? '1 Baustein gefunden'
                      : treffer.length
                        ? `${treffer.length} Bausteine gefunden`
                        : 'Keine Bausteine gefunden'}
                  </p>
                  {treffer.map((b) => darstellung(b.typ))}
                </>
              ) : (
                reihenfolge.map((g) => (
                  <section className="kategorie" key={g}>
                    <button
                      className="kategorie-kopf"
                      aria-expanded={kategorie === g}
                      onClick={() => setKategorie(kategorie === g ? '' : g)}
                    >
                      <Symbol name={kategorie === g ? 'unten' : 'rechts'} />
                      <span>{g}</span>
                    </button>
                    {kategorie === g && (
                      <div>
                        {bausteinDefinitionen.filter((b) => b.kategorie === g).map((b) => darstellung(b.typ))}
                      </div>
                    )}
                  </section>
                ))
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
