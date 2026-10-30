import type { JsonWert } from '../kern/business-modell';

const objekt = (wert: JsonWert): Record<string, JsonWert> =>
  wert && typeof wert === 'object' && !Array.isArray(wert) ? wert : {};

/** UND und ODER ändern die bestehende Gruppe, statt sie wirkungslos zu umschließen. */
export function bedingungsGruppeSetzen(wert: JsonWert, art: 'UND' | 'ODER'): JsonWert {
  const gruppe = objekt(wert);
  return gruppe.art === 'UND' || gruppe.art === 'ODER' ? { ...gruppe, art } : { art, kinder: [wert] };
}
