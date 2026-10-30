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
    <Karte as="section" className="ml-laufzeit" aria-label="Machine-Learning-Komponenten">
      <h3>Machine-Learning-Komponenten</h3>
      <p>
        Ein optionales CPU-Paket für Training und Vorhersagen. Die Online-Einrichtung lädt die festgelegten
        Komponenten erst nach deinem bewussten Auftrag. Alternativ kannst du einen vorbereiteten
        Offline-Paketordner wählen.
      </p>
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
          (aktiv ? laufend?.meldung : '') ||
          status?.meldung ||
          'Die ML-Komponenten wurden noch nicht geprüft.'}
      </Statusanzeige>
      {aktiv && hatFortschritt && (
        <div className="ml-fortschritt">
          <p>
            {laufend.fertigePakete} von {laufend.gesamtPakete} Paketen in der gemeldeten Phase.
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
          ML-Komponenten prüfen
        </Knopf>
        <Knopf disabled={aktiv} grund="Ein Vorgang läuft bereits." onClick={() => aktion('einrichten')}>
          CPU-Paket online einrichten
        </Knopf>
        <Knopf disabled={aktiv} grund="Ein Vorgang läuft bereits." onClick={() => aktion('offline')}>
          Offline-Paketordner verwenden
        </Knopf>
        {aktiv && (
          <Knopf variante="gefahr" onClick={() => aktion('abbrechen')}>
            Vorgang abbrechen
          </Knopf>
        )}
      </div>
      <p>
        Ohne ML-Paket bleiben Bearbeiten, Speichern und Exportieren möglich. Ein Workflowstart installiert
        keine Pakete.
      </p>
      {status && (
        <details>
          <summary>Geprüfte Komponenten und technische Angaben</summary>
          <ul>
            {status.pakete.map((paket) => (
              <li key={paket.name}>
                {paket.name}: {paket.version ?? 'fehlt'} · benötigt {paket.sollVersion}
                {paket.version && !paket.importierbar ? ' · nicht importierbar' : ''}
              </li>
            ))}
          </ul>
          {status.installation && (
            <dl className="ml-angaben">
              <div>
                <dt>Python-Version</dt>
                <dd>{status.installation.version}</dd>
              </div>
              <div>
                <dt>Programmdatei</dt>
                <dd>{status.installation.pfad}</dd>
              </div>
            </dl>
          )}
        </details>
      )}
    </Karte>
  );
}
