import { z } from 'zod';

export const fachlicheTypen = ['Datei', 'Dateiliste', 'Tabelle', 'Datensatz', 'Text', 'Zahl', 'Dezimalbetrag', 'Datum', 'Wahrheitswert', 'Dokument', 'Dokumentvorlage', 'Ergebnis'] as const;
export type FachlicherTyp = typeof fachlicheTypen[number];
export type Betriebsmodus = 'vorschau' | 'prueflauf' | 'ausfuehren';
export type JsonWert = null | boolean | number | string | JsonWert[] | { [name: string]: JsonWert };
export interface BusinessSchritt { id: string; operation: string; konfiguration: Record<string, JsonWert>; eingaben: Record<string, JsonWert> }

const parameterSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
  beschriftung: z.string().min(1).max(160),
  typ: z.enum(fachlicheTypen).exclude(['Tabelle', 'Datensatz', 'Ergebnis', 'Dateiliste']),
  erforderlich: z.boolean(),
  standard: z.union([z.string().max(32768), z.number().finite(), z.boolean(), z.null()]),
  hilfe: z.string().max(2000),
}).strict();
export type WorkflowParameter = z.infer<typeof parameterSchema>;
const parameterWerte = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), z.union([z.string().max(32768),z.number().finite(),z.boolean(),z.null()]));
export const businessProjektSchema = z.object({
  parameter: z.array(parameterSchema).max(100).refine((a) => new Set(a.map(p=>p.name.toLowerCase())).size === a.length, 'Parameternamen müssen eindeutig sein.'),
  parametersaetze: z.object({test: parameterWerte, echt: parameterWerte}).strict(),
  ressourcen: z.array(z.object({name:z.string().min(1).max(160),pfad:z.string().min(1).max(32768),art:z.enum(['Vorlage','Schrift','Bild'])}).strict()).max(100),
}).strict();
export type BusinessProjekt = z.infer<typeof businessProjektSchema>;
export function leeresBusinessProjekt(): BusinessProjekt { return {parameter:[],parametersaetze:{test:{},echt:{}},ressourcen:[]}; }
export function businessProjektPruefen(wert: unknown): BusinessProjekt {
  const p=businessProjektSchema.safeParse(wert);
  if(!p.success) throw new Error('Die Workflowparameter oder Ressourcen sind ungültig. Prüfe Namen, Datentypen und Parametersätze.');
  return p.data;
}
export function jsonDatenPruefen(wert:unknown,tiefe=0): asserts wert is JsonWert {
  if(tiefe>20) throw new Error('Die Bausteineinstellungen sind zu tief verschachtelt.');
  if(wert===null || typeof wert==='boolean' || (typeof wert==='number' && Number.isFinite(wert))) return;
  if(typeof wert==='string' && wert.length<=32768 && !wert.includes('\0')) return;
  if(Array.isArray(wert) && wert.length<=500) {wert.forEach(w=>jsonDatenPruefen(w,tiefe+1));return;}
  if(wert && typeof wert==='object' && Object.keys(wert).length<=100 && Object.entries(wert).every(([k])=>!['__proto__','prototype','constructor'].includes(k))) {Object.values(wert).forEach(w=>jsonDatenPruefen(w,tiefe+1));return;}
  throw new Error('Die Bausteineinstellungen enthalten ungültige oder zu umfangreiche Daten.');
}
