import { useEffect, useState } from 'react';
import { Dialog } from './komponenten/Dialog';
import { Feld, Textfeld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';

export function ProjektDialog({
  offen,
  name,
  beschreibung,
  schliessen,
  speichern,
}: {
  offen: boolean;
  name: string;
  beschreibung: string;
  schliessen: () => void;
  speichern: (name: string, beschreibung: string) => void;
}) {
  const [entwurf, setEntwurf] = useState({ name, beschreibung });
  const [fehler, setFehler] = useState('');
  useEffect(() => {
    if (offen) {
      setEntwurf({ name, beschreibung });
      setFehler('');
    }
  }, [offen]);
  return (
    <Dialog
      offen={offen}
      titel="Projektangaben"
      onSchliessen={schliessen}
      fuss={
        <>
          <Knopf onClick={schliessen}>Abbrechen</Knopf>
          <Knopf
            variante="primaer"
            onClick={() => {
              if (!entwurf.name.trim()) {
                setFehler('Gib einen Projektnamen ein.');
                return;
              }
              speichern(entwurf.name.trim(), entwurf.beschreibung);
              schliessen();
            }}
          >
            Übernehmen
          </Knopf>
        </>
      }
    >
      <Feld
        beschriftung="Projektname"
        value={entwurf.name}
        maxLength={160}
        fehler={fehler}
        onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
      />
      <Textfeld
        beschriftung="Projektbeschreibung"
        value={entwurf.beschreibung}
        maxLength={10000}
        rows={4}
        onChange={(e) => setEntwurf({ ...entwurf, beschreibung: e.target.value })}
      />
    </Dialog>
  );
}
