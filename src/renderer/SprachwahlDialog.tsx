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
    beschreibung: 'Für vielseitige Automatisierungen mit Dateien, Texten und Daten.',
    vorteil: 'Bietet viele Möglichkeiten und lässt sich durch zusätzliche Funktionen erweitern.',
    hinweis:
      'Zum Ausführen wird eine passende Python-Installation benötigt. Je nach Workflow können weitere Pakete erforderlich sein.',
  },
  {
    id: 'vbs',
    name: 'VBScript (VBS)',
    beschreibung: 'Für klassische Windows-Abläufe und vorhandene VBScript-Umgebungen.',
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
      titel="Welche Sprache möchtest du verwenden?"
      onSchliessen={abbrechen}
      className="sprachwahl-dialog"
      beschreibung="Du baust deinen Workflow in beiden Fällen mit Bausteinen. Die Sprache bestimmt, welches Script ScriptLab erzeugt."
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
                aria-label={sprache.name}
                aria-describedby={`${id}-${sprache.id}-beschreibung ${id}-${sprache.id}-vorteil ${id}-${sprache.id}-hinweis`}
              />
              <span className="sprachwahl-name">{sprache.name}</span>
            </span>
            <span id={`${id}-${sprache.id}-beschreibung`}>{sprache.beschreibung}</span>
            <span id={`${id}-${sprache.id}-vorteil`} className="sprachwahl-vorteil">
              {sprache.vorteil}
            </span>
            <span id={`${id}-${sprache.id}-hinweis`} className="sprachwahl-hinweis">
              {sprache.hinweis}
            </span>
          </label>
        ))}
      </fieldset>
      {wahl === null && (
        <p id={`${id}-startgrund`} className="sprachwahl-startgrund">
          Wähle zuerst Python oder VBScript (VBS).
        </p>
      )}
    </Dialog>
  );
}
