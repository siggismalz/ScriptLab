import type { MLStatus, MLFortschritt } from '../gemeinsam/ml-laufzeit';
import { Karte } from './komponenten/Karte';
import { Knopf } from './komponenten/Knopf';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './ml.css';

export interface MlLaufzeitEigenschaften {
  status: MLStatus | null;
  aktiv: boolean;
  fortschritt: MLFortschritt | null;
  fehler?: string;
  aktion: (art: 'pruefen' | 'einrichten' | 'offline' | 'abbrechen') => void;
}

/** Rein kontrollierte Ansicht: Rendering und Ansichtswechsel richten keine Umgebung ein. */
export function MlLaufzeit({ status, aktiv, fortschritt, fehler, aktion }: MlLaufzeitEigenschaften) {
  const laufend = fortschritt ?? status?.fortschritt;
  const hatFortschritt =
    laufend &&
    Number.isSafeInteger(laufend.gesamtPakete) &&
    laufend.gesamtPakete > 0 &&
    Number.isSafeInteger(laufend.fertigePakete) &&
    laufend.fertigePakete >= 0 &&
    laufend.fertigePakete <= laufend.gesamtPakete;
  return (
    <Karte as="section" className="ml-laufzeit einstellungen-karte" aria-label="Machine Learning">
      <div className="einstellungen-kartenkopf">
        <h3>Machine Learning</h3>
        <p>Modelle mit Tabellendaten trainieren und Vorhersagen erstellen. Einmalige Einrichtung nötig.</p>
      </div>
      <Statusanzeige
        art={
          fehler || status?.zustand === 'fehler'
            ? 'fehler'
            : aktiv
              ? 'verarbeitung'
              : status?.zustand === 'bereit'
                ? 'erfolg'
                : 'neutral'
        }
      >
        {fehler ||
          (aktiv ? laufend?.meldung || status?.meldung || 'Einrichtung wird vorbereitet …' : '') ||
          (status?.zustand === 'bereit'
            ? 'Bereit für Training und Vorhersagen.'
            : status?.zustand === 'fehlt'
              ? 'Noch nicht eingerichtet.'
              : status?.zustand === 'prueft'
                ? 'Verfügbarkeit wird geprüft …'
                : status?.zustand === 'fehler'
                  ? status.meldung
                  : 'Noch nicht geprüft.')}
      </Statusanzeige>
      {aktiv && hatFortschritt && (
        <div className="ml-fortschritt">
          <p>
            In diesem Abschnitt: {laufend.fertigePakete} von {laufend.gesamtPakete} Bestandteilen.
          </p>
          <progress
            aria-label="Fortschritt der ML-Einrichtung"
            value={laufend.fertigePakete}
            max={laufend.gesamtPakete}
          />
        </div>
      )}
      <div className="ml-aktionen">
        <Knopf
          disabled={aktiv}
          grund="Warte auf das Ende des laufenden Vorgangs oder brich ihn ab."
          onClick={() => aktion('pruefen')}
        >
          Verfügbarkeit prüfen
        </Knopf>
        <Knopf disabled={aktiv} grund="Ein Vorgang läuft bereits." onClick={() => aktion('einrichten')}>
          Online einrichten
        </Knopf>
        <Knopf disabled={aktiv} grund="Ein Vorgang läuft bereits." onClick={() => aktion('offline')}>
          Aus Ordner einrichten
        </Knopf>
        {aktiv && (
          <Knopf variante="gefahr" onClick={() => aktion('abbrechen')}>
            Vorgang abbrechen
          </Knopf>
        )}
      </div>
      {status?.zustand !== 'bereit' && !aktiv && (
        <p className="einstellungen-hinweis">
          Bearbeiten, Speichern und Exportieren sind auch ohne Einrichtung möglich. Ein Download beginnt erst
          mit „Online einrichten“; „Aus Ordner einrichten“ nutzt vorbereitete Installationsdateien.
        </p>
      )}
    </Karte>
  );
}
