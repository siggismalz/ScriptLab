import { useEffect, useId, useState } from 'react';
import type { Skriptsprache } from '../kern/sprachen';
import type { WorkflowArt } from '../kern/workflowarten';
import { Dialog } from './komponenten/Dialog';
import { Knopf } from './komponenten/Knopf';
import './sprachwahl.css';

interface SprachwahlEigenschaften {
  offen: boolean;
  vorauswahl: Skriptsprache | null;
  abbrechen: () => void;
  erstellen: (sprache: Skriptsprache, workflowArt?: WorkflowArt) => void;
}

const sprachen: readonly {
  id: Skriptsprache | 'ml';
  name: string;
  beschreibung: string;
  vorteil: string;
  hinweis: string;
}[] = [
  {
    id: 'python',
    name: 'Automatisierung',
    beschreibung: 'Dateien verarbeiten, Tabellen bearbeiten und Dokumente erstellen.',
    vorteil: 'Gemeinsame Grundbausteine und zusätzliche Daten- und Dokumentbausteine.',
    hinweis: 'Für die meisten Aufgaben. Direkt startklar.',
  },
  {
    id: 'vbs',
    name: 'Windows-Automatisierung',
    beschreibung: 'Kleine Windows-Aufgaben und vorhandene ältere Workflows.',
    vorteil: 'Nutzt den Windows Script Host und vorhandene Windows-Schnittstellen.',
    hinweis: 'Für vorhandene Windows-Abläufe. Benötigt die entsprechende Windows-Komponente.',
  },
  {
    id: 'ml',
    name: 'Machine Learning',
    beschreibung: 'Modelle mit Tabellendaten trainieren und für Vorhersagen verwenden.',
    vorteil: 'Ein begrenzter Python-Bausteinkatalog für Tabellenaufbereitung, Modelle und Vorhersagen.',
    hinweis: 'Zusätzliche Komponenten lassen sich bei Bedarf in den Einstellungen einrichten.',
  },
];

/** Erst eine ausdrückliche Bestätigung darf den neuen Workflow im Hauptprozess anlegen. */
export function SprachwahlDialog({ offen, vorauswahl, abbrechen, erstellen }: SprachwahlEigenschaften) {
  const [wahl, setWahl] = useState<Skriptsprache | 'ml' | null>(null);
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
      beschreibung="Was möchtest du automatisieren?"
      fuss={
        <>
          <Knopf onClick={abbrechen}>Abbrechen</Knopf>
          <Knopf
            variante="primaer"
            disabled={wahl === null}
            grundId={`${id}-startgrund`}
            onClick={() => {
              if (wahl === 'ml') erstellen('python', 'ml');
              else if (wahl) erstellen(wahl);
            }}
          >
            Workflow erstellen
          </Knopf>
        </>
      }
    >
      <fieldset className="sprachwahl-karten" role="radiogroup" aria-label="Art der Automatisierung">
        <legend className="sl-nur-vorlesen">Art der Automatisierung wählen</legend>
        {sprachen.map((sprache) => (
          <label key={sprache.id} className={`sprachwahl-karte ${wahl === sprache.id ? 'ist-gewaehlt' : ''}`}>
            <span className="sprachwahl-kopf">
              <input
                type="radio"
                name={`${id}-sprache`}
                value={sprache.id}
                checked={wahl === sprache.id}
                onChange={() => setWahl(sprache.id)}
                aria-label={sprache.name}
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
      {wahl === null && (
        <p id={`${id}-startgrund`} className="sprachwahl-startgrund">
          Wähle eine der drei Aufgabenarten.
        </p>
      )}
    </Dialog>
  );
}
