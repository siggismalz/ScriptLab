import type * as Blockly from 'blockly/core';
import { useRef, useState } from 'react';
import { bausteinDefinitionen } from '../kern/katalog';
import { paletteZiehenStarten, type Einfuegestelle } from '../editor/bedienung';
import { Knopf } from './komponenten/Knopf';
import { Feld } from './komponenten/Feld';
import { Symbol, type SymbolName } from './komponenten/Icon';
import type { Skriptsprache } from '../kern/sprachen';
import { bausteinVerfuegbar, type WorkflowArt } from '../kern/workflowarten';

export interface PlatzierungsAuftrag {
  art: 'einfuegen' | 'verschieben';
  typOderId: string;
  name: string;
}

/** Fachliche Einstiege ordnen nur die vorhandenen Kategorien, keine neuen Bausteine. */
const palettengruppen: { id: string; titel: string; symbol: SymbolName; kategorien: string[] }[] = [
  {
    id: 'ablauf',
    titel: 'Ablauf steuern',
    symbol: 'bausteine',
    kategorien: ['Ablauf', 'Bedingungen', 'Schleifen', 'Variablen und Listen', 'Geschäftsablauf'],
  },
  {
    id: 'daten',
    titel: 'Daten verarbeiten',
    symbol: 'eigenschaften',
    kategorien: [
      'Daten laden',
      'Daten aufbereiten',
      'Daten verbinden',
      'Daten zusammenfassen',
      'Datenqualität',
      'Daten ausgeben',
    ],
  },
  {
    id: 'dateien',
    titel: 'Dateien und Ordner',
    symbol: 'oeffnen',
    kategorien: ['Dateien und Ordner', 'Geschäftsdateien'],
  },
  { id: 'dokumente', titel: 'Dokumente erstellen', symbol: 'neu', kategorien: ['Word', 'Excel', 'PDF'] },
  {
    id: 'werte',
    titel: 'Werte und Eingaben',
    symbol: 'einfuegen',
    kategorien: ['Ein- und Ausgaben', 'Texte', 'Zahlen', 'Datum und Zeit'],
  },
];

/** Verfügbarkeit bleibt zentral; diese Gruppen ordnen nur den begrenzten ML-Katalog. */
const mlPalettengruppen: typeof palettengruppen = [
  { id: 'ml-daten', titel: 'Daten laden', symbol: 'oeffnen', kategorien: ['Daten laden'] },
  {
    id: 'ml-aufbereitung',
    titel: 'Tabellen vorbereiten',
    symbol: 'eigenschaften',
    kategorien: ['Daten aufbereiten', 'Daten verbinden', 'Daten zusammenfassen', 'Datenqualität'],
  },
  {
    id: 'ml-modelle',
    titel: 'Modelle und Vorhersagen',
    symbol: 'bausteine',
    kategorien: ['Machine Learning'],
  },
  { id: 'ml-ausgabe', titel: 'Ergebnisse speichern', symbol: 'speichern', kategorien: ['Daten ausgeben'] },
  { id: 'ml-ablauf', titel: 'Ablauf erläutern', symbol: 'info', kategorien: ['Ablauf'] },
];

export function Palette({
  sprache = 'vbs',
  workflowArt = 'allgemein',
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
  sprache?: Skriptsprache;
  workflowArt?: WorkflowArt;
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
  const [gruppenId, setGruppenId] = useState<string | null>(null);
  const [kategorie, setKategorie] = useState('');
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  const gruppentitel = useRef<HTMLHeadingElement>(null);
  const gruppenknoepfe = useRef(new Map<string, HTMLButtonElement>());
  const verfuegbar = bausteinDefinitionen.filter((b) => bausteinVerfuegbar(b.typ, sprache, workflowArt));
  const kategorien = [...new Set(verfuegbar.map((b) => b.kategorie))];
  const gruppen = (workflowArt === 'ml' ? mlPalettengruppen : palettengruppen)
    .map((g) => ({ ...g, kategorien: g.kategorien.filter((k) => kategorien.includes(k)) }))
    .filter((g) => g.kategorien.length > 0);
  const gruppe = gruppen.find((g) => g.id === gruppenId) ?? null;
  const filter = suche.trim().toLocaleLowerCase('de');
  const treffer = verfuegbar.filter((b) =>
    `${b.name} ${b.kategorie} ${b.hilfe}`.toLocaleLowerCase('de').includes(filter),
  );
  function gruppeOeffnen(id: string) {
    const ziel = gruppen.find((g) => g.id === id);
    if (!ziel) return;
    setGruppenId(id);
    setKategorie(ziel.kategorien.length === 1 ? ziel.kategorien[0] : '');
    if (inhalt.current) inhalt.current.scrollTop = 0;
    requestAnimationFrame(() => gruppentitel.current?.focus({ preventScroll: true }));
  }
  function alleBausteine() {
    const vorher = gruppenId;
    setGruppenId(null);
    setKategorie('');
    if (inhalt.current) inhalt.current.scrollTop = 0;
    requestAnimationFrame(() => vorher && gruppenknoepfe.current.get(vorher)?.focus({ preventScroll: true }));
  }
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
      className={`palette palette-werkbank ${eingeklappt ? 'palette--zu' : ''}`}
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
              placeholder="Alle Bausteine durchsuchen"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            {!suche && (
              <details className="palette-hilfe">
                <summary>Hilfe zum Einfügen</summary>
                <p>
                  Wähle eine Aufgabe oder suche direkt. Mit Plus wählst du die Einfügestelle. Du kannst
                  Bausteine auch ziehen.
                </p>
              </details>
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
            <div ref={inhalt} className="palette-inhalt" data-testid="palette-bausteine">
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
                  {sprache === 'vbs' &&
                    bausteinDefinitionen.some(
                      (b) =>
                        b.typ.startsWith('sl_biz_') &&
                        bausteinVerfuegbar(b.typ, 'python', 'allgemein') &&
                        `${b.name} ${b.kategorie} ${b.hilfe}`.toLocaleLowerCase('de').includes(filter),
                    ) && (
                      <details className="palette-pythonhinweis">
                        <summary>Weitere Bausteine in Python</summary>
                        <p>
                          Für Daten und Dokumente kannst du unter „Workflow → Neuer Workflow“ einen
                          Python-Workflow erstellen.
                        </p>
                      </details>
                    )}
                </>
              ) : !gruppe ? (
                <nav className="paletten-aufgaben" aria-label="Bausteine nach Aufgabe">
                  {gruppen.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="paletten-aufgabe"
                      ref={(knopf) => {
                        if (knopf) gruppenknoepfe.current.set(g.id, knopf);
                        else gruppenknoepfe.current.delete(g.id);
                      }}
                      onClick={() => gruppeOeffnen(g.id)}
                    >
                      <Symbol name={g.symbol} groesse={20} />
                      <span>{g.titel}</span>
                      <Symbol name="rechts" groesse={16} />
                    </button>
                  ))}
                </nav>
              ) : (
                <>
                  <div className="paletten-pfad">
                    <Knopf variante="leise" symbol="links" onClick={alleBausteine}>
                      Alle Bausteine
                    </Knopf>
                    <h3 ref={gruppentitel} tabIndex={-1}>
                      {gruppe.titel}
                    </h3>
                  </div>
                  {gruppe.kategorien.length === 1 ? (
                    <div className="paletten-direktliste">
                      {verfuegbar
                        .filter((b) => b.kategorie === gruppe.kategorien[0])
                        .map((b) => darstellung(b.typ))}
                    </div>
                  ) : (
                    gruppe.kategorien.map((g) => (
                      <section className="kategorie" key={g}>
                        <button
                          type="button"
                          className="kategorie-kopf"
                          aria-expanded={kategorie === g}
                          onClick={() => setKategorie(kategorie === g ? '' : g)}
                        >
                          <Symbol name={kategorie === g ? 'unten' : 'rechts'} />
                          <span>{g}</span>
                        </button>
                        {kategorie === g && (
                          <div>
                            {verfuegbar.filter((b) => b.kategorie === g).map((b) => darstellung(b.typ))}
                          </div>
                        )}
                      </section>
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
