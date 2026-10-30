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
    name: 'Python',
    beschreibung: 'Für Geschäftsprozesse mit Daten, Excel und Dokumenten.',
    vorteil: 'Gemeinsame Grundbausteine und zusätzliche Daten- und Dokumentbausteine.',
    hinweis: 'In ScriptLab mitgeliefert und direkt nutzbar.',
  },
  {
    id: 'vbs',
    name: 'VBS',
    beschreibung: 'Für kleine Windows-Aufgaben und bestehende VBScript-Abläufe.',
    vorteil: 'Nutzt den Windows Script Host und vorhandene Windows-Schnittstellen.',
    hinweis: 'Benötigt die Windows-VBScript-Komponente. Microsoft lässt die Unterstützung auslaufen.',
  },
  {
    id: 'ml',
    name: 'Machine Learning',
    beschreibung: 'Modelle mit Tabellendaten trainieren und für Vorhersagen verwenden.',
    vorteil: 'Ein begrenzter Python-Bausteinkatalog für Tabellenaufbereitung, Modelle und Vorhersagen.',
    hinweis:
      'Verwendet Python. Das optionale CPU-Paket wird erst nach deiner ausdrücklichen Auswahl eingerichtet.',
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
      beschreibung="Wähle eine Sprache. Du arbeitest anschließend mit Bausteinen."
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
      <fieldset className="sprachwahl-karten" role="radiogroup" aria-label="Workflowart und Skriptsprache">
        <legend className="sl-nur-vorlesen">Workflowart und Skriptsprache wählen</legend>
        {sprachen.map((sprache) => (
          <label key={sprache.id} className={`sprachwahl-karte ${wahl === sprache.id ? 'ist-gewaehlt' : ''}`}>
            <span className="sprachwahl-kopf">
              <input
                type="radio"
                name={`${id}-sprache`}
                value={sprache.id}
                checked={wahl === sprache.id}
                onChange={() => setWahl(sprache.id)}
                aria-label={
                  sprache.id === 'python'
                    ? 'Python'
                    : sprache.id === 'ml'
                      ? 'Machine Learning'
                      : 'VBScript (VBS)'
                }
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
      <p className="sprachwahl-ml-hinweis">
        Auch ohne eingerichtetes ML-Paket kannst du einen Machine-Learning-Workflow bearbeiten, speichern und
        exportieren. Das Auswählen oder Öffnen eines Workflows startet keine Einrichtung.
      </p>
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
          Wähle zuerst Python, VBScript (VBS) oder Machine Learning.
        </p>
      )}
    </Dialog>
  );
}
