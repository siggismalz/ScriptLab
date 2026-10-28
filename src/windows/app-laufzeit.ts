import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { pythonPruefen } from './python';
import { businessStatusPruefen } from './business-laufzeit';
import type { PythonInstallation } from '../gemeinsam/python';
import type { BusinessStatus } from '../gemeinsam/business-laufzeit';

export interface AppLaufzeitOptionen {
  /** Fester, mit der Anwendung ausgelieferter Ordner mit python.exe und Manifest. */
  wurzel: string;
  helper: string;
  technischeOrdner: string;
  signal?: AbortSignal;
}
export interface AppLaufzeit {
  installation: PythonInstallation;
  business: BusinessStatus;
}
const dateipfad = z
  .string()
  .min(1)
  .max(1024)
  .refine((p) => !/[\\:\0]/.test(p) && p.split('/').every((teil) => !!teil && teil !== '.' && teil !== '..'));
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  bereit: z.literal(true),
  pythonVersion: z.literal('3.15.2'),
  architektur: z.literal('x64'),
  profil: z.literal('cpython-315-win_amd64'),
  businessLockSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pakete: z
    .array(
      z.object({
        name: z.string(),
        version: z.string(),
        wheel: z.string(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .length(11),
  dateien: z
    .array(
      z.object({
        pfad: dateipfad,
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(100)
    .max(30000),
});

/** Prüft nur die feste App-Runtime; keine Suche, Installation oder Änderung lokaler Python-Umgebungen. */
export async function appLaufzeitPruefen(optionen: AppLaufzeitOptionen): Promise<AppLaufzeit> {
  optionen.signal?.throwIfAborted();
  const wurzel = await realpath(optionen.wurzel);
  const manifestPfad = join(wurzel, 'scriptlab-laufzeit.json');
  const info = await lstat(manifestPfad);
  if (!info.isFile() || info.size > 10 * 1024 ** 2)
    throw new Error(
      'Die mitgelieferten ScriptLab-Komponenten sind unvollständig. Installiere ScriptLab erneut.',
    );
  const gelesen = manifestSchema.safeParse(JSON.parse(await readFile(manifestPfad, 'utf8')));
  if (!gelesen.success)
    throw new Error(
      'Die mitgelieferte Python-Laufzeit passt nicht zu dieser ScriptLab-Version. Installiere ScriptLab erneut.',
    );
  const manifest = gelesen.data;
  const namen = new Set(manifest.dateien.map((d) => d.pfad.toLowerCase()));
  if (namen.size !== manifest.dateien.length || !namen.has('python.exe') || !namen.has('dlls/_tkinter.pyd'))
    throw new Error('Die Dateiliste der mitgelieferten Python-Laufzeit ist unvollständig.');
  async function vorhandeneDateien(ordner: string, praefix = ''): Promise<string[]> {
    const ergebnis: string[] = [];
    for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
      const relativ = praefix + eintrag.name;
      if (eintrag.isDirectory())
        ergebnis.push(...(await vorhandeneDateien(join(ordner, eintrag.name), relativ + '/')));
      else if (eintrag.isFile()) {
        if (relativ !== 'scriptlab-laufzeit.json') ergebnis.push(relativ);
      } else throw new Error('Die mitgelieferte Python-Laufzeit enthält einen unerwarteten Dateiverweis.');
    }
    return ergebnis;
  }
  const vorhanden = await vorhandeneDateien(wurzel);
  if (vorhanden.length !== namen.size || vorhanden.some((p) => !namen.has(p.toLowerCase())))
    throw new Error(
      'Die mitgelieferte Python-Laufzeit enthält fehlende oder zusätzliche Dateien. Installiere ScriptLab erneut.',
    );
  for (let anfang = 0; anfang < manifest.dateien.length; anfang += 8) {
    optionen.signal?.throwIfAborted();
    await Promise.all(
      manifest.dateien.slice(anfang, anfang + 8).map(async (eintrag) => {
        const pfad = join(wurzel, eintrag.pfad),
          datei = await lstat(pfad);
        if (
          !datei.isFile() ||
          datei.size !== eintrag.bytes ||
          (await realpath(pfad)).toLowerCase() !== pfad.toLowerCase()
        )
          throw new Error(`Eine mitgelieferte Python-Datei fehlt oder wurde verändert: ${eintrag.pfad}`);
        const hash = createHash('sha256');
        for await (const bytes of createReadStream(pfad, { signal: optionen.signal })) hash.update(bytes);
        if (hash.digest('hex') !== eintrag.sha256)
          throw new Error(`Eine mitgelieferte Python-Datei wurde verändert: ${eintrag.pfad}`);
      }),
    );
  }
  const lock = await readFile(join(wurzel, 'requirements-business.lock'));
  if (createHash('sha256').update(lock).digest('hex') !== manifest.businessLockSha256)
    throw new Error('Die mitgelieferten Business-Komponenten passen nicht zur festen Paketliste.');
  const installation = await pythonPruefen(join(wurzel, 'python.exe'), {
    helper: optionen.helper,
    technischeOrdner: optionen.technischeOrdner,
    tkinter: true,
    signal: optionen.signal,
  });
  if (installation.version !== '3.15.2' || installation.tkinter !== true)
    throw new Error(
      'Die mitgelieferte Python-Laufzeit oder ihre Dialogfunktionen sind nicht vollständig verfügbar.',
    );
  const business = await businessStatusPruefen(installation, {
    helper: optionen.helper,
    technischeOrdner: optionen.technischeOrdner,
    paketwurzel: wurzel,
    signal: optionen.signal,
  });
  if (business.zustand !== 'bereit')
    throw new Error(
      'Die mitgelieferten Business-Komponenten konnten nicht bestätigt werden. Installiere ScriptLab erneut.',
    );
  return { installation, business };
}
