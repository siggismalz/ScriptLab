import type { TestPhase, TestZustand } from '../gemeinsam/testlauf';
import { Knopf } from './komponenten/Knopf';
import { Statusanzeige, type StatusArt } from './komponenten/Statusanzeige';
import './lauf-kurzansicht.css';

export interface LaufKurzansichtEigenschaften {
  zustand: TestZustand;
  veraltet?: boolean;
  details: () => void;
  blockAnzeigen: (id: string) => void;
}

const phasen: Record<Exclude<TestPhase, 'bereit'>, { titel: string; art: StatusArt }> = {
  vorbereitung: { titel: 'Workflow wird vorbereitet', art: 'verarbeitung' },
  laeuft: { titel: 'Workflow läuft', art: 'verarbeitung' },
  stoppt: { titel: 'Workflow wird gestoppt', art: 'verarbeitung' },
  beendet: { titel: 'Workflow beendet', art: 'neutral' },
  mit_fehlern: { titel: 'Workflow mit Fehlern beendet', art: 'hinweis' },
  fehlgeschlagen: { titel: 'Workflow fehlgeschlagen', art: 'fehler' },
  abgebrochen: { titel: 'Workflow abgebrochen', art: 'hinweis' },
  zeitlimit: { titel: 'Zeitlimit erreicht', art: 'hinweis' },
};

const zahlenformat = new Intl.NumberFormat('de-DE');
const maximaleAusgabezeichen = 12000;

/** Reine Laufanzeige: keine Prozessaktion, keine Kopie von Ereignissen oder Tabellendaten. */
export function LaufKurzansicht({
  zustand,
  veraltet = false,
  details,
  blockAnzeigen,
}: LaufKurzansichtEigenschaften) {
  if (zustand.phase === 'bereit') return null;
  const phase = phasen[zustand.phase];
  const modus = zustand.optionen.business?.modus;
  const laufname = modus === 'prueflauf' ? 'Prüflauf' : modus === 'vorschau' ? 'Datenvorschau' : 'Workflow';
  const titel = phase.titel.includes('Workflow')
    ? phase.titel.replace('Workflow', laufname)
    : `${laufname}: ${phase.titel}`;
  const meldung = zustand.meldung.trim();
  let ausgabebeginn = Math.max(0, zustand.ausgabe.length - maximaleAusgabezeichen);
  // Ein abgeschnittenes UTF-16-Paar darf kein beschädigtes Zeichen am Anfang erzeugen.
  if (ausgabebeginn > 0 && /[\uDC00-\uDFFF]/.test(zustand.ausgabe[ausgabebeginn])) ausgabebeginn++;
  const ausgabe = zustand.ausgabe.slice(ausgabebeginn);
  const gekuerzt = ausgabebeginn > 0 || zustand.abgeschnitteneZeichen > 0;
  const summen = zustand.business?.bericht?.summen;
  const ausgaben =
    summen && typeof summen === 'object' && !Array.isArray(summen)
      ? (
          [
            ['verarbeitet', 'fertig'],
            ['uebersprungen', 'übersprungen'],
            ['geplant', 'geplant'],
          ] as const
        ).flatMap(([feld, titel]) => {
          const wert = (summen as Record<string, unknown>)[feld];
          return typeof wert === 'number' && Number.isSafeInteger(wert) && wert > 0
            ? [`${zahlenformat.format(wert)} ${titel}`]
            : [];
        })
      : [];

  return (
    <section className="lauf-kurzansicht" aria-label="Aktueller Lauf" data-testid="lauf-kurzansicht">
      <div className="lauf-kurzansicht-kopf">
        <div className="lauf-kurzansicht-status">
          <Statusanzeige art={phase.art}>
            <strong>{titel}</strong>
            {meldung && meldung !== titel && <span className="lauf-kurzansicht-meldung">{meldung}</span>}
          </Statusanzeige>
          {veraltet && (
            <p className="lauf-kurzansicht-hinweis">Dieser Lauf gehört zu einem früheren Workflowstand.</p>
          )}
          {ausgaben.length > 0 && (
            <p className="lauf-kurzansicht-summen">Ausgabedateien: {ausgaben.join(' · ')}</p>
          )}
        </div>
        <div className="lauf-kurzansicht-aktionen">
          {zustand.fehlerBlockId && (
            <Knopf
              disabled={veraltet}
              grund="Die Bausteinzuordnung ist für den früheren Stand nicht verfügbar."
              onClick={() => blockAnzeigen(zustand.fehlerBlockId!)}
            >
              Baustein prüfen
            </Knopf>
          )}
          <Knopf variante="leise" onClick={details}>
            Laufdetails
          </Knopf>
        </div>
      </div>
      {ausgabe && (
        <pre
          className="lauf-kurzansicht-ausgabe"
          role="log"
          aria-label="Laufausgabe"
          aria-live="off"
          tabIndex={0}
        >
          {ausgabe}
        </pre>
      )}
      {gekuerzt && (
        <p className="lauf-kurzansicht-hinweis">
          Die Ausgabe wurde begrenzt. In den Laufdetails steht der verfügbare Verlauf.
        </p>
      )}
    </section>
  );
}
