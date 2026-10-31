import { useId } from 'react';
import type { BeispielInfo, BeispielKennung } from './hilfe';
import type { Skriptsprache } from '../kern/sprachen';
import { sprachdaten } from '../kern/sprachen';
import { Feld, Auswahlfeld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { Karte } from './komponenten/Karte';
import './vorlagen.css';

export interface VorlagenFilter {
  suche: string;
  sprache: 'alle' | Skriptsprache;
  aufgabe: 'alle' | BeispielInfo['aufgabe'];
  bereich: 'beispiele' | 'dokumente';
}

/** Die Suche liest nur vorhandene Metadaten; sie öffnet oder verarbeitet keine Datei. */
export function vorlagenFiltern(vorlagen: readonly BeispielInfo[], filter: VorlagenFilter): BeispielInfo[] {
  const worte = filter.suche.trim().normalize('NFC').toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
  return vorlagen.filter((vorlage) => {
    if (filter.bereich === 'dokumente' && !vorlage.dokumentvorlagen?.length) return false;
    if (filter.sprache !== 'alle' && vorlage.skriptsprache !== filter.sprache) return false;
    if (filter.aufgabe !== 'alle' && vorlage.aufgabe !== filter.aufgabe) return false;
    const text = [
      vorlage.name,
      vorlage.beschreibung,
      vorlage.aufgabe,
      vorlage.ergebnis,
      vorlage.vorbereitung,
      vorlage.dateiname,
      ...vorlage.lernziele,
      ...(vorlage.dokumentvorlagen ?? []),
    ]
      .join(' ')
      .normalize('NFC')
      .toLocaleLowerCase('de');
    return worte.every((wort) => text.includes(wort));
  });
}

export function VorlagenBereich({
  vorlagen,
  filter,
  aendern,
  auswahl,
  auswaehlen,
  gesperrt,
  oeffnen,
}: {
  vorlagen: readonly BeispielInfo[];
  filter: VorlagenFilter;
  aendern: (filter: VorlagenFilter) => void;
  auswahl: BeispielKennung | null;
  auswaehlen: (id: BeispielKennung | null) => void;
  gesperrt: boolean;
  oeffnen: (id: BeispielKennung) => void;
}) {
  const id = useId();
  const treffer = vorlagenFiltern(vorlagen, filter);
  const hatFilter = !!filter.suche.trim() || filter.sprache !== 'alle' || filter.aufgabe !== 'alle';
  return (
    <section data-testid="beispiele" aria-label="Lokale Beispielworkflows" className="vorlagenbereich">
      <nav className="start-unterbereiche" aria-label="Vorlagenbereiche">
        <button
          type="button"
          aria-current={filter.bereich === 'beispiele' ? 'page' : undefined}
          onClick={() => aendern({ ...filter, bereich: 'beispiele' })}
        >
          Beispielworkflows
        </button>
        <button
          type="button"
          aria-current={filter.bereich === 'dokumente' ? 'page' : undefined}
          onClick={() => aendern({ ...filter, bereich: 'dokumente' })}
        >
          Dokumentvorlagen
        </button>
      </nav>
      <div className="vorlagen-filter">
        <Feld
          beschriftung="Vorlagen suchen"
          type="search"
          value={filter.suche}
          placeholder="Zum Beispiel Sicherung, CSV oder Bestellung.docx"
          onChange={(event) => aendern({ ...filter, suche: event.target.value })}
        />
        <Auswahlfeld
          beschriftung="Aufgabe"
          value={filter.aufgabe}
          onChange={(event) =>
            aendern({ ...filter, aufgabe: event.target.value as VorlagenFilter['aufgabe'] })
          }
        >
          <option value="alle">Alle Aufgaben</option>
          {(['Einstieg', 'Dateien', 'Daten', 'Dokumente'] as const).map((aufgabe) => (
            <option key={aufgabe}>{aufgabe}</option>
          ))}
        </Auswahlfeld>
        <Auswahlfeld
          beschriftung="Sprache"
          aria-label="Beispiele nach Sprache filtern"
          value={filter.sprache}
          onChange={(event) =>
            aendern({ ...filter, sprache: event.target.value as VorlagenFilter['sprache'] })
          }
        >
          <option value="alle">Alle Sprachen</option>
          <option value="python">Python</option>
          <option value="vbs">VBScript (VBS)</option>
        </Auswahlfeld>
      </div>
      <div className="vorlagen-ergebniszeile">
        <p role="status">{treffer.length === 1 ? '1 Vorlage' : `${treffer.length} Vorlagen`}</p>
        <p className="vorlagen-auswahlhilfe">Auswählen zeigt Vorbereitung und enthaltene Dateien.</p>
        {hatFilter && (
          <Knopf
            variante="leise"
            onClick={() => aendern({ ...filter, suche: '', sprache: 'alle', aufgabe: 'alle' })}
          >
            Filter zurücksetzen
          </Knopf>
        )}
      </div>
      {filter.bereich === 'dokumente' && (
        <p className="vorlagen-hinweis">
          Dokumentvorlagen gehören zu einem Workflow. Beim Verwenden öffnest du dessen eigene Kopie mit den
          enthaltenen Vorlagen.
        </p>
      )}
      {!treffer.length ? (
        <div className="vorlagen-leer">
          <p>Keine passenden Vorlagen gefunden. Ändere die Suche oder setze die Filter zurück.</p>
        </div>
      ) : (
        <div className="vorlagen-liste">
          {treffer.map((vorlage) => {
            const offen = auswahl === vorlage.id;
            const titel =
              filter.bereich === 'dokumente' ? vorlage.dokumentvorlagen!.join(', ') : vorlage.name;
            const detailId = `${id}-${vorlage.id}`;
            return (
              <Karte
                key={vorlage.id}
                className={`vorlagen-eintrag ${offen ? 'ist-ausgewaehlt' : ''}`}
                aria-label={`${vorlage.name} – ${sprachdaten[vorlage.skriptsprache].bezeichnung}`}
                hervorgehoben={offen}
              >
                <div className="vorlagen-kartenkopf">
                  <div className="vorlagen-metadaten">
                    <span>{vorlage.aufgabe}</span>
                    <span className="vorlagen-sprache">{sprachdaten[vorlage.skriptsprache].bezeichnung}</span>
                  </div>
                  <h2>
                    <Knopf
                      variante="leise"
                      className="vorlagen-auswahl"
                      symbol={offen ? 'unten' : 'rechts'}
                      aria-expanded={offen}
                      aria-controls={offen ? detailId : undefined}
                      onClick={() => auswaehlen(offen ? null : vorlage.id)}
                    >
                      {titel}
                    </Knopf>
                  </h2>
                  {filter.bereich === 'dokumente' && (
                    <p className="vorlagen-zuordnung">Workflow: {vorlage.name}</p>
                  )}
                  <p className="vorlagen-ergebnis">
                    <span className="vorlagen-ergebnis-label">Erwartetes Ergebnis</span>
                    <span>{vorlage.ergebnis}</span>
                  </p>
                  <span className="vorlagen-auswahlhinweis" aria-hidden="true">
                    {offen ? 'Vorbereitung geöffnet' : 'Vorbereitung ansehen'}
                  </span>
                </div>
                {offen && (
                  <div className="vorlagen-details" id={detailId}>
                    <div className="vorlagen-detailspalten">
                      <section aria-label="Vorbereitung">
                        <h3>Vor dem ersten Lauf</h3>
                        <p>{vorlage.vorbereitung}</p>
                      </section>
                      <section aria-label="Ablauf und Lernziele">
                        <h3>Was du im Ablauf findest</h3>
                        <p>{vorlage.beschreibung}</p>
                        <ul>
                          {vorlage.lernziele.map((ziel) => (
                            <li key={ziel}>{ziel}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                    <details className="vorlagen-dateien">
                      <summary>Enthaltene Dateien und Sprache</summary>
                      <dl>
                        <dt>Projektdatei</dt>
                        <dd>{vorlage.dateiname}</dd>
                        <dt>Sprache</dt>
                        <dd>{sprachdaten[vorlage.skriptsprache].bezeichnung}</dd>
                        {!!vorlage.dokumentvorlagen?.length && (
                          <>
                            <dt>Dokumentvorlagen</dt>
                            <dd>{vorlage.dokumentvorlagen.join(', ')}</dd>
                          </>
                        )}
                      </dl>
                    </details>
                    <div className="vorlagen-aktion">
                      <p>
                        Du öffnest eine eigene bearbeitbare Kopie. Ein Lauf startet erst nach einem
                        ausdrücklichen Start.
                      </p>
                      <Knopf
                        variante="primaer"
                        symbol="neu"
                        onClick={() => oeffnen(vorlage.id)}
                        disabled={gesperrt}
                        grundId="start-verarbeitung"
                      >
                        {filter.bereich === 'dokumente'
                          ? 'Workflow mit Vorlage verwenden'
                          : 'Als Vorlage öffnen'}
                      </Knopf>
                    </div>
                  </div>
                )}
              </Karte>
            );
          })}
        </div>
      )}
    </section>
  );
}
