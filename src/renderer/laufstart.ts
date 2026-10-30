import type { Projekt } from '../kern/projekt';
import type { TestOptionen } from '../gemeinsam/testlauf';
import { businessSchritte } from '../kern/business';
import { parameterWertePruefen } from '../kern/business-modell';

export const businessVorgaben: NonNullable<TestOptionen['business']> = {
  modus: 'prueflauf',
  parametersatz: 'test',
  parameter: {},
  speicherMB: 512,
  tempGB: 4,
  fortsetzen: false,
};

/** Die optionale Vorbereitung beginnt mit einem Prüflauf; bewusste Einstellungen bleiben erhalten. */
export function businessOptionenVorbereiten(optionen: TestOptionen): TestOptionen {
  return optionen.business
    ? optionen
    : { ...optionen, business: structuredClone(businessVorgaben), zeitlimitSekunden: 7200 };
}

/** Bereitet nur den gewählten Start vor; verändert weder Projekt noch gespeicherte Laufoptionen. */
export function laufOptionenVorbereiten(
  projekt: Projekt,
  optionen: TestOptionen,
  direkt: boolean,
): TestOptionen {
  if (!businessSchritte(projekt).length) {
    const { business: _business, ...grundoptionen } = optionen;
    return grundoptionen;
  }
  const vorbereitet = businessOptionenVorbereiten(optionen);
  if (!direkt) return vorbereitet;
  const { vorschauBlockId: _ziel, ...business } = vorbereitet.business!;
  return {
    ...vorbereitet,
    zeitlimitSekunden:
      business.modus !== 'ausfuehren' && [15, 30, 60].includes(vorbereitet.zeitlimitSekunden)
        ? 7200
        : vorbereitet.zeitlimitSekunden,
    business: { ...business, modus: 'ausfuehren' },
  };
}

export class LaufParameterFehler extends Error {
  constructor(
    meldung: string,
    public readonly parameterName: string | null,
  ) {
    super(meldung);
    this.name = 'LaufParameterFehler';
  }
}

/** Dieselbe Wertreihenfolge wie im Main; eine leere Überschreibung bleibt ausdrücklich leer. */
export function laufParameterPruefen(projekt: Projekt, optionen: TestOptionen): void {
  if (!businessSchritte(projekt).length) return;
  const definitionen = projekt.business.parameter;
  const werte = {
    ...Object.fromEntries(definitionen.map((p) => [p.name, p.standard])),
    ...projekt.business.parametersaetze[optionen.business?.parametersatz ?? 'test'],
    ...optionen.business?.parameter,
  };
  try {
    // Der Vollsatz muss auch unbekannte Angaben enthalten: niemals still herausfiltern.
    parameterWertePruefen(definitionen, werte);
  } catch (fehler) {
    for (const definition of definitionen) {
      try {
        parameterWertePruefen([definition], { [definition.name]: werte[definition.name] });
      } catch (feldfehler) {
        throw new LaufParameterFehler(
          feldfehler instanceof Error ? feldfehler.message : 'Prüfe diesen Workflowparameter.',
          definition.name,
        );
      }
    }
    throw new LaufParameterFehler(
      fehler instanceof Error ? fehler.message : 'Prüfe die Workflowparameter.',
      null,
    );
  }
}
