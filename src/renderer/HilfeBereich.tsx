import { beispiele, hilfeArtikel, hilfeDurchsuchen, type BeispielKennung, type HilfeArtikel } from './hilfe';
import { sprachdaten } from '../kern/sprachen';
import { Karte } from './komponenten/Karte';
import { Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { Symbol, type SymbolName } from './komponenten/Icon';
import './hilfebereich.css';

const symbole: readonly SymbolName[] = ['bausteine', 'oeffnen', 'testen', 'eigenschaften'];
function markieren(text: string, suche: string) {
  const filter = suche.trim();
  const stelle = text.toLocaleLowerCase('de').indexOf(filter.toLocaleLowerCase('de'));
  if (!filter || stelle < 0) return text;
  return (
    <>
      {text.slice(0, stelle)}
      <mark>{text.slice(stelle, stelle + filter.length)}</mark>
      {text.slice(stelle + filter.length)}
    </>
  );
}

/** Aufgaben und Beispiele bleiben lokal; Lesen und Suchen starten keinen Workflow. */
export function HilfeBereich({
  artikel,
  suche,
  sucheAendern,
  artikelOeffnen,
  beispielOeffnen,
  ueberOeffnen,
  gesperrt,
}: {
  artikel?: HilfeArtikel;
  suche: string;
  sucheAendern: (text: string) => void;
  artikelOeffnen: (id: string, abschnitt?: string) => void;
  beispielOeffnen: (id: BeispielKennung) => void;
  ueberOeffnen: () => void;
  gesperrt: boolean;
}) {
  const treffer = hilfeDurchsuchen(suche);
  return (
    <section data-testid="hilfe" aria-label="Lokale Hilfe" className="hilfebereich">
      {!artikel ? (
        <>
          <div className="hilfe-suchzeile">
            <Feld
              beschriftung="Hilfe durchsuchen"
              type="search"
              value={suche}
              onChange={(event) => sucheAendern(event.target.value)}
              placeholder="Zum Beispiel CSV, Dateipfad oder Löschen"
            />
            {suche && (
              <Knopf variante="leise" onClick={() => sucheAendern('')}>
                Suche leeren
              </Knopf>
            )}
          </div>
          {suche.trim() ? (
            <>
              <p role="status" className="hilfe-hinweis">
                {treffer.length
                  ? `${treffer.length} ${treffer.length === 1 ? 'Artikelstelle gefunden' : 'Artikelstellen gefunden'}`
                  : 'Keine Hilfe gefunden. Versuche einen anderen Suchbegriff.'}
              </p>
              <div className="start-hilfe-treffer">
                {treffer.map((t) => (
                  <button
                    key={`${t.artikelId}/${t.abschnittId}`}
                    onClick={() => artikelOeffnen(t.artikelId, t.abschnittId)}
                  >
                    <span className="start-treffertitel">
                      {t.artikelTitel} · {t.abschnittTitel}
                    </span>
                    <span>{markieren(t.ausschnitt, suche)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>Was möchtest du tun?</h2>
              <div className="hilfe-aufgaben">
                {hilfeArtikel.map((thema, index) => (
                  <Karte as="div" className="hilfe-aufgabenkarte" key={thema.id}>
                    <button aria-label={thema.titel} onClick={() => artikelOeffnen(thema.id)}>
                      <Symbol name={symbole[index] ?? 'buch'} />
                      <span>
                        <strong>{thema.titel}</strong>
                        <span>{thema.beschreibung}</span>
                      </span>
                      <Symbol name="rechts" groesse={16} />
                    </button>
                  </Karte>
                ))}
              </div>
            </>
          )}
          <footer className="hilfe-fuss">
            <p>Alle Anleitungen sind lokal verfügbar. ScriptLab · entwickelt von Leon Stolz.</p>
            <Knopf variante="leise" onClick={ueberOeffnen}>
              Über ScriptLab und Lizenz
            </Knopf>
          </footer>
        </>
      ) : (
        <article className="hilfe-anleitung" aria-label={artikel.titel}>
          <p className="hilfe-einleitung">{artikel.beschreibung}</p>
          <nav className="hilfe-inhalt" aria-label="Abschnitte dieser Anleitung">
            {artikel.abschnitte.map((abschnitt) => (
              <button key={abschnitt.id} onClick={() => artikelOeffnen(artikel.id, abschnitt.id)}>
                {abschnitt.titel}
              </button>
            ))}
          </nav>
          {artikel.abschnitte.map((abschnitt) => (
            <section key={abschnitt.id} aria-labelledby={`hilfe-${abschnitt.id}`}>
              <h2 id={`hilfe-${abschnitt.id}`} tabIndex={-1}>
                {abschnitt.titel}
              </h2>
              {abschnitt.texte.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {abschnitt.schritte && (
                <ol>
                  {abschnitt.schritte.map((schritt) => (
                    <li key={schritt}>{schritt}</li>
                  ))}
                </ol>
              )}
              {beispiele
                .filter((b) => b.id === abschnitt.beispiel || b.id === `${abschnitt.beispiel}-python`)
                .map((beispiel) => (
                  <Knopf
                    key={beispiel.id}
                    symbol="neu"
                    disabled={gesperrt}
                    grundId="start-verarbeitung"
                    onClick={() => beispielOeffnen(beispiel.id)}
                  >
                    Beispiel als Vorlage öffnen: {beispiel.name} ·{' '}
                    {sprachdaten[beispiel.skriptsprache].kurzbezeichnung}
                  </Knopf>
                ))}
            </section>
          ))}
        </article>
      )}
    </section>
  );
}
