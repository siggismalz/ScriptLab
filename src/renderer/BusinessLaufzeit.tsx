import { useEffect, useState } from 'react';
import type { BusinessStatus, BusinessFortschritt } from '../gemeinsam/business-laufzeit';
import { Knopf } from './komponenten/Knopf';
import { Statusanzeige } from './komponenten/Statusanzeige';
export function BusinessLaufzeit({ gewechselt }: { gewechselt: () => void }) {
  const [status, setStatus] = useState<BusinessStatus | null>(null),
    [fortschritt, setFortschritt] = useState<BusinessFortschritt | null>(null),
    [aktiv, setAktiv] = useState(false),
    [fehler, setFehler] = useState('');
  useEffect(() => {
    let lebt = true;
    const laden = () =>
      window.scriptlab.businessLesen().then((r) => {
        if (lebt && r.ok) {
          setStatus(r.wert.status);
          setFortschritt(r.wert.fortschritt);
          setAktiv(r.wert.aktiv);
        }
      });
    void laden();
    const timer = setInterval(laden, 1000);
    return () => {
      lebt = false;
      clearInterval(timer);
    };
  }, []);
  const aktion = async (art: 'pruefen' | 'einrichten' | 'offline' | 'abbrechen') => {
    setFehler('');
    if (art !== 'abbrechen') setAktiv(true);
    try {
      const r = await window.scriptlab.businessAktion(art);
      if (!r.ok) throw new Error(r.meldung);
      setStatus(r.wert);
      if (r.wert?.zustand === 'bereit') gewechselt();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Einrichtung ist fehlgeschlagen.');
    } finally {
      setAktiv(false);
    }
  };
  return (
    <section className="einstellungs-abschnitt">
      <h3>Business-Laufzeit</h3>
      <p>
        Ein fester Paketsatz für Tabellen, Excel, Word und PDF. „Einrichten“ erstellt bewusst eine eigene
        Python-Umgebung. Eine globale Installation wird nicht verändert. Die Online-Einrichtung lädt
        ausschließlich die festgelegten Pakete; Unternehmens-IT kann einen Offline-Paketordner vorbereiten.
      </p>
      <Statusanzeige
        art={fehler ? 'fehler' : aktiv ? 'verarbeitung' : status?.zustand === 'bereit' ? 'erfolg' : 'neutral'}
      >
        {fehler ||
          (aktiv ? fortschritt?.meldung : '') ||
          status?.meldung ||
          'Business-Komponenten wurden noch nicht geprüft.'}
      </Statusanzeige>
      {status && (
        <details>
          <summary>Geprüfte Komponenten und Versionen</summary>
          <ul>
            {status.pakete.map((p) => (
              <li key={p.name}>
                {p.name}: {p.version ?? 'fehlt'} · benötigt {p.sollVersion}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="knopfgruppe umbrechen">
        <Knopf disabled={aktiv} grund="Die Einrichtung läuft bereits." onClick={() => void aktion('pruefen')}>
          Business-Komponenten prüfen
        </Knopf>
        <Knopf
          disabled={aktiv}
          grund="Die Einrichtung läuft bereits."
          onClick={() => void aktion('einrichten')}
        >
          Eigene Umgebung online einrichten
        </Knopf>
        <Knopf disabled={aktiv} grund="Die Einrichtung läuft bereits." onClick={() => void aktion('offline')}>
          Offline-Paketordner verwenden
        </Knopf>
        {aktiv && (
          <Knopf variante="gefahr" onClick={() => void aktion('abbrechen')}>
            Einrichtung abbrechen
          </Knopf>
        )}
      </div>
      <p>
        Ein Workflowstart installiert niemals Pakete. Bereits vorbereitete Umgebungen können über „Interpreter
        auswählen“ gewählt werden.
      </p>
    </section>
  );
}
