import type { TestZustand } from '../gemeinsam/testlauf';
import { Karte } from './komponenten/Karte';
import { Statusanzeige } from './komponenten/Statusanzeige';
import './ml.css';

type Daten = Record<string, unknown>;
const objekt = (wert: unknown): Daten | null =>
  wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Daten) : null;
const zaehler = (wert: unknown): wert is number =>
  typeof wert === 'number' && Number.isSafeInteger(wert) && wert >= 0;
const zahl = (wert: unknown): wert is number => typeof wert === 'number' && Number.isFinite(wert);
const zahlenformat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 6 });
const anzahlformat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

interface Training {
  aufgabe: 'KLASSIFIKATION' | 'REGRESSION';
  verfahren: 'RANDOM_FOREST' | 'PYTORCH';
  trainingszeilen: number;
  testzeilen: number;
  merkmale: string[];
  zielspalte: string;
  metriken: Daten;
}

function trainingLesen(wert: unknown): Training | null {
  const d = objekt(wert);
  if (
    !d ||
    d.art !== 'ml_training' ||
    !['KLASSIFIKATION', 'REGRESSION'].includes(String(d.aufgabe)) ||
    !['RANDOM_FOREST', 'PYTORCH'].includes(String(d.verfahren)) ||
    !zaehler(d.trainingszeilen) ||
    d.trainingszeilen === 0 ||
    !zaehler(d.testzeilen) ||
    d.testzeilen === 0 ||
    !Array.isArray(d.merkmale) ||
    !d.merkmale.length ||
    !d.merkmale.every((m) => typeof m === 'string' && m.trim()) ||
    typeof d.zielspalte !== 'string' ||
    !d.zielspalte.trim() ||
    !objekt(d.metriken)
  )
    return null;
  return d as unknown as Training;
}

/** Fachliche Kennzahlen stammen ausschließlich aus bestätigten ML-Trainingsereignissen. */
export function MlErgebnis({
  business,
  aktiv,
}: {
  business: NonNullable<TestZustand['business']>;
  aktiv: boolean;
}) {
  const ausBericht = business.bericht?.ml_training;
  const gemeldet = Array.isArray(ausBericht)
    ? ausBericht
    : business.ereignisse.filter((e) => e.art === 'ml_training');
  const ergebnisse = gemeldet.map(trainingLesen).filter((t): t is Training => t !== null);
  const fortschritt = [...business.ereignisse]
    .reverse()
    .find(
      (e) =>
        e.art === 'ml_fortschritt' &&
        zaehler(e.epoche) &&
        zaehler(e.epochen) &&
        e.epochen > 0 &&
        e.epoche <= e.epochen,
    );
  return (
    <section className="ml-ergebnis" aria-label="ML-Ergebnisse">
      <h3>ML-Ergebnisse</h3>
      {aktiv && fortschritt && (
        <Statusanzeige art="verarbeitung">
          Gemeldeter Trainingsfortschritt: Epoche {String(fortschritt.epoche)} von{' '}
          {String(fortschritt.epochen)}.
        </Statusanzeige>
      )}
      {!ergebnisse.length && (
        <Statusanzeige>Es wurden noch keine bestätigten Trainingsmetriken gemeldet.</Statusanzeige>
      )}
      {ergebnisse.length !== gemeldet.length && (
        <Statusanzeige art="hinweis">
          Ein gemeldetes ML-Ergebnis ist unvollständig. Prüfe den Laufbericht und das Protokoll.
        </Statusanzeige>
      )}
      {ergebnisse.map((t, index) => {
        const metriken =
          t.aufgabe === 'KLASSIFIKATION'
            ? [
                ['accuracy', 'Genauigkeit (Accuracy)'],
                ['f1_macro', 'F1-Maß (Makro)'],
              ]
            : [
                ['mae', 'Mittlerer absoluter Fehler (MAE)'],
                ['rmse', 'Wurzel des mittleren quadratischen Fehlers (RMSE)'],
                ['r2', 'Bestimmtheitsmaß (R²)'],
              ];
        return (
          <Karte key={index} as="section" aria-label={`Bestätigtes Training ${index + 1}`}>
            <h4>
              Training {index + 1} · {t.verfahren === 'PYTORCH' ? 'PyTorch' : 'Random Forest'}
            </h4>
            <dl className="ml-angaben">
              <div>
                <dt>Aufgabe</dt>
                <dd>{t.aufgabe === 'KLASSIFIKATION' ? 'Klassifikation' : 'Regression'}</dd>
              </div>
              <div>
                <dt>Trainingszeilen</dt>
                <dd>{anzahlformat.format(t.trainingszeilen)}</dd>
              </div>
              <div>
                <dt>Testzeilen</dt>
                <dd>{anzahlformat.format(t.testzeilen)}</dd>
              </div>
              <div>
                <dt>Zielspalte</dt>
                <dd>{t.zielspalte}</dd>
              </div>
              <div>
                <dt>Merkmale</dt>
                <dd>{t.merkmale.join(', ')}</dd>
              </div>
            </dl>
            <dl className="ml-angaben ml-metriken">
              {metriken.map(([name, beschriftung]) => (
                <div key={name}>
                  <dt>{beschriftung}</dt>
                  <dd>
                    {zahl(t.metriken[name])
                      ? zahlenformat.format(t.metriken[name] as number)
                      : t.metriken[name] === null
                        ? 'Nicht definiert'
                        : 'Nicht gemeldet'}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Diese gemeldeten Werte beschreiben die verwendeten Testdaten. Sie garantieren keine Qualität für
              andere Daten.
            </p>
          </Karte>
        );
      })}
    </section>
  );
}
