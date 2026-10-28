import { useEffect, useId, useState } from 'react';
import type { Skriptsprache } from '../kern/sprachen';
import { Dialog } from './komponenten/Dialog';
import { Knopf } from './komponenten/Knopf';
import './sprachwahl.css';

interface SprachwahlEigenschaften {
  offen: boolean;
  vorauswahl: Skriptsprache | null;
  abbrechen: () => void;
  erstellen: (sprache: Skriptsprache) => void;
}

const sprachen: readonly {
  id: Skriptsprache;
  name: string;
  beschreibung: string;
  vorteil: string;
  hinweis: string;
}[] = [
  {
    id: 'python',
    name: 'Python',
    beschreibung: 'Für Geschäftsprozesse mit Daten, Excel und Dokumenten.',
    vorteil: 'Gemeinsame Grundbausteine und zusätzliche Daten- und Dokumentbausteine.',
    hinweis: 'Zum Ausführen werden Python und je nach Workflow weitere Komponenten benötigt.',
  },
  {
    id: 'vbs',
    name: 'VBS',
    beschreibung: 'Für kleine Windows-Aufgaben und bestehende VBScript-Abläufe.',
    vorteil: 'Nutzt den Windows Script Host und vorhandene Windows-Schnittstellen.',
    hinweis: 'VBScript muss auf dem Rechner verfügbar sein. Microsoft lässt die Unterstützung auslaufen.',
  },
];

/** Erst eine ausdrückliche Bestätigung darf den neuen Workflow im Hauptprozess anlegen. */
export function SprachwahlDialog({ offen, vorauswahl, abbrechen, erstellen }: SprachwahlEigenschaften) {
  const [wahl, setWahl] = useState<Skriptsprache | null>(null);
  const id = useId();
  useEffect(() => {
    if (offen) setWahl(vorauswahl);
  }, [offen, vorauswahl]);
  return (
    <Dialog
      offen={offen}
      titel="Neuer Workflow"
      onSchliessen={abbrechen}
      className="sprachwahl-dialog"
      beschreibung="Wähle eine Sprache. Du arbeitest anschließend mit Bausteinen."
      fuss={
        <>
          <Knopf onClick={abbrechen}>Abbrechen</Knopf>
          <Knopf
            variante="primaer"
            disabled={wahl === null}
            grundId={`${id}-startgrund`}
            onClick={() => {
              if (wahl) erstellen(wahl);
            }}
          >
            Workflow erstellen
          </Knopf>
        </>
      }
    >
      <fieldset className="sprachwahl-karten" role="radiogroup" aria-label="Skriptsprache">
        <legend className="sl-nur-vorlesen">Skriptsprache wählen</legend>
        {sprachen.map((sprache) => (
          <label key={sprache.id} className={`sprachwahl-karte ${wahl === sprache.id ? 'ist-gewaehlt' : ''}`}>
            <span className="sprachwahl-kopf">
              <input
                type="radio"
                name={`${id}-sprache`}
                value={sprache.id}
                checked={wahl === sprache.id}
                onChange={() => setWahl(sprache.id)}
                aria-label={sprache.id === 'python' ? 'Python' : 'VBScript (VBS)'}
                aria-describedby={`${id}-${sprache.id}-beschreibung ${id}-${sprache.id}-hinweis`}
              />
              <span className="sprachwahl-name">{sprache.name}</span>
            </span>
            <span id={`${id}-${sprache.id}-beschreibung`}>{sprache.beschreibung}</span>
            <span id={`${id}-${sprache.id}-hinweis`} className="sprachwahl-hinweis">
              {sprache.hinweis}
            </span>
          </label>
        ))}
      </fieldset>
      <details className="sprachwahl-details">
        <summary>Sprachen und Voraussetzungen im Detail</summary>
        {sprachen.map((sprache) => (
          <section key={sprache.id}>
            <h3>{sprache.name}</h3>
            <p>{sprache.vorteil}</p>
          </section>
        ))}
      </details>
      {wahl === null && (
        <p id={`${id}-startgrund`} className="sprachwahl-startgrund">
          Wähle zuerst Python oder VBScript (VBS).
        </p>
      )}
    </Dialog>
  );
}
