import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, relative, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { z } from 'zod';
import { appLaufzeitPruefen } from './app-laufzeit';
import type { PythonInstallation } from '../gemeinsam/python';
import type { MLStatus, MLFortschritt } from '../gemeinsam/ml-laufzeit';
import { atomarSchreiben } from '../main/dateien';

export interface MLLaufzeitOptionen {
  basisWurzel: string;
  wurzel: string;
  helper: string;
  technischeOrdner: string;
  paketwurzel: string;
  signal?: AbortSignal;
  fortschritt?: (stand: MLFortschritt) => void;
}
const module: Record<string, string> = {
  torch: 'torch',
  numpy: 'numpy',
  scipy: 'scipy',
  'scikit-learn': 'sklearn',
  skops: 'skops.io',
  joblib: 'joblib',
  cloudpickle: 'cloudpickle',
  narwhals: 'narwhals',
  threadpoolctl: 'threadpoolctl',
  packaging: 'packaging',
  prettytable: 'prettytable',
  wcwidth: 'wcwidth',
  filelock: 'filelock',
  setuptools: 'setuptools',
  sympy: 'sympy',
  mpmath: 'mpmath',
  networkx: 'networkx',
  jinja2: 'jinja2',
  markupsafe: 'markupsafe',
  fsspec: 'fsspec',
  'typing-extensions': 'typing_extensions',
};
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const profilSchema = z
  .object({
    schemaVersion: z.literal(1),
    profil: z.literal('scriptlab-ml-cpu-cp315-x64-v1'),
    pythonVersion: z.literal('3.15.2'),
    lockSha256: hashSchema,
    pakete: z
      .array(
        z
          .object({
            name: z.string(),
            version: z.string(),
            modul: z.string(),
            wheel: z.string(),
            url: z.string(),
            sha256: hashSchema,
            bytes: z
              .number()
              .int()
              .positive()
              .max(512 * 1024 ** 2),
          })
          .strict(),
      )
      .length(21),
  })
  .strict();
type Profil = z.infer<typeof profilSchema>;
const dateiSchema = z
  .object({
    pfad: z
      .string()
      .min(1)
      .max(1024)
      .refine((p) => !/[\\:\0]/.test(p) && p.split('/').every((t) => t && t !== '.' && t !== '..')),
    bytes: z.number().int().nonnegative(),
    sha256: hashSchema,
  })
  .strict();
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    profilHash: hashSchema,
    basisHash: hashSchema,
    lockSha256: hashSchema,
    dateien: z.array(dateiSchema).min(100).max(100000),
  })
  .strict();
const aktiveSchema = z
  .object({
    schemaVersion: z.literal(1),
    ordner: z.string().regex(/^profil-[a-f0-9-]{36}$/),
    manifestHash: hashSchema,
  })
  .strict();

export async function mlProfilLesen(paketwurzel: string): Promise<Profil> {
  const profil = profilSchema.parse(JSON.parse(await readFile(join(paketwurzel, 'ml-profil.json'), 'utf8')));
  const lock = await readFile(join(paketwurzel, 'requirements-ml.lock'));
  if (sha(lock) !== profil.lockSha256) throw Error('Die ML-Paketliste passt nicht zum festen Profil.');
  const lockZeilen = lock
    .toString('utf8')
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('#'));
  if (
    lockZeilen.length !== profil.pakete.length ||
    lockZeilen.some(
      (z) => !profil.pakete.some((p) => z === `${p.name}==${p.version} --hash=sha256:${p.sha256}`),
    )
  )
    throw Error('Die ML-Paketliste enthält nicht freigegebene Einträge.');
  const namen = new Set<string>();
  for (const p of profil.pakete) {
    const u = new URL(p.url);
    if (
      namen.has(p.name) ||
      module[p.name] !== p.modul ||
      basename(p.wheel) !== p.wheel ||
      !p.wheel.endsWith('.whl') ||
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !(p.name === 'torch'
        ? ['download.pytorch.org', 'download-r2.pytorch.org'].includes(u.hostname)
        : u.hostname === 'files.pythonhosted.org') ||
      decodeURIComponent(u.pathname.split('/').at(-1)!) !== p.wheel ||
      !lock.toString('utf8').split(/\r?\n/).includes(`${p.name}==${p.version} --hash=sha256:${p.sha256}`)
    )
      throw Error('Das ML-Profil enthält eine nicht freigegebene Paketquelle.');
    namen.add(p.name);
  }
  return profil;
}
function abbrechen(o: MLLaufzeitOptionen) {
  o.signal?.throwIfAborted();
}
function fortschritt(
  o: MLLaufzeitOptionen,
  phase: MLFortschritt['phase'],
  meldung: string,
  fertigePakete = 0,
  gesamtPakete = 21,
) {
  abbrechen(o);
  o.fortschritt?.({ phase, meldung, fertigePakete, gesamtPakete });
}
async function dateihash(pfad: string, signal?: AbortSignal) {
  const h = createHash('sha256');
  for await (const b of createReadStream(pfad, { signal })) h.update(b);
  return h.digest('hex');
}
async function festerOrdner(pfad: string): Promise<void> {
  let aktuell = resolve(pfad);
  while (true) {
    const info = await lstat(aktuell);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error('ML-Profilordner dürfen keine symbolischen Verweise oder Junctions enthalten.');
    const eltern = dirname(aktuell);
    if (eltern === aktuell) break;
    aktuell = eltern;
  }
  // realpath darf dabei legitime Windows-8.3-Namen erweitern; das ist keine Umleitung.
  await realpath(pfad);
}
async function inventar(ordner: string, signal?: AbortSignal): Promise<z.infer<typeof dateiSchema>[]> {
  const pfade: string[] = [];
  const sammeln = async (basis: string, praefix = ''): Promise<void> => {
    for (const e of (await readdir(basis, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      signal?.throwIfAborted();
      const relativ = praefix + e.name;
      if (relativ === 'scriptlab-ml.json') continue;
      if (e.isDirectory()) await sammeln(join(basis, e.name), relativ + '/');
      else if (e.isFile()) pfade.push(relativ);
      else throw Error('Das ML-Profil enthält einen unerwarteten Dateiverweis.');
    }
  };
  await sammeln(ordner);
  const ergebnis: z.infer<typeof dateiSchema>[] = [];
  for (let i = 0; i < pfade.length; i += 8) {
    signal?.throwIfAborted();
    ergebnis.push(
      ...(await Promise.all(
        pfade.slice(i, i + 8).map(async (relativ) => {
          const pfad = join(ordner, relativ),
            vorher = await lstat(pfad);
          if (!vorher.isFile()) throw Error('Eine ML-Profildatei wurde während der Prüfung ersetzt.');
          const hash = await dateihash(pfad, signal),
            nachher = await lstat(pfad);
          if (vorher.size !== nachher.size || vorher.mtimeMs !== nachher.mtimeMs)
            throw Error('Eine ML-Profildatei wurde während der Prüfung verändert.');
          return { pfad: relativ, bytes: vorher.size, sha256: hash };
        }),
      )),
    );
  }
  return ergebnis;
}

// Ein festes technisches Programm. Nutzerdaten und freie Python-/Pipargumente sind nicht Teil dieses Vertrages.
const jobCode = `import sys
sys.dont_write_bytecode = True
import json, subprocess, pathlib, importlib, importlib.metadata, sysconfig
auftrag=json.loads((pathlib.Path(sys.argv[sys.argv.index('--scriptlab-basis')+1])/'auftrag.json').read_text(encoding='utf-8'))
assert sys.argv[sys.argv.index('--scriptlab-token')+1] == auftrag['token']
assert sys.version_info[:3] == (3,15,2) and not sysconfig.get_config_var('Py_GIL_DISABLED')
assert pathlib.Path(sys.prefix).resolve() == pathlib.Path(sys.executable).resolve().parent
if auftrag['art']=='installieren':
    subprocess.run([sys.executable,'-I','-B','-m','ensurepip','--default-pip'],check=True,timeout=90)
    subprocess.run([sys.executable,'-I','-B','-m','pip','--isolated','install','--no-index','--require-hashes','--only-binary=:all:','--no-deps','--no-cache-dir','--no-compile','--disable-pip-version-check','--find-links',auftrag['wheels'],'-r',auftrag['lock']],check=True,timeout=180)
    subprocess.run([sys.executable,'-I','-B','-m','pip','--isolated','check'],check=True,timeout=30)
    ergebnis={}
elif auftrag['art']=='pruefen':
    pakete=[]
    for p in auftrag['pakete']:
        importlib.import_module(p['modul'])
        ist=importlib.metadata.version(p['name'])
        assert ist == p['version'], (p['name'],ist,p['version'])
        pakete.append({'name':p['name'],'sollVersion':p['version'],'version':ist,'importierbar':True})
    import numpy as np, torch, skops.io as sio
    from sklearn.ensemble import RandomForestClassifier
    torch.set_num_threads(1)
    assert torch.version.cuda is None
    if auftrag.get('trainingsprobe',False):
        x=np.array([[i,i%2] for i in range(40)],dtype=np.float32); y=np.array([int(i>=20) for i in range(40)])
        rf=RandomForestClassifier(n_estimators=8,max_depth=4,random_state=42,n_jobs=1).fit(x,y)
        assert np.array_equal(rf.predict(x),y)
        # Ausschließlich dieses unmittelbar selbst trainierte Modell; niemals eine fremde Datei.
        assert np.array_equal(sio.loads(sio.dumps(rf),trusted=['sklearn.tree._tree.Tree']).predict(x),y)
        torch.manual_seed(42); t=torch.tensor(x/40); z=torch.tensor(y,dtype=torch.float32).reshape(-1,1)
        modell=torch.nn.Sequential(torch.nn.Linear(2,4),torch.nn.ReLU(),torch.nn.Linear(4,1))
        optim=torch.optim.Adam(modell.parameters(),lr=0.05); kriterium=torch.nn.MSELoss()
        vorher=kriterium(modell(t),z).item()
        for _ in range(30):
            optim.zero_grad(); verlust=kriterium(modell(t),z); verlust.backward(); optim.step()
        assert kriterium(modell(t),z).item() < vorher
    ergebnis={'pakete':pakete,'python':sys.version.split()[0],'cpu':True,'trainingsprobe':auftrag.get('trainingsprobe',False)}
else: raise ValueError('Unbekannter fester ML-Auftrag.')
print('SLML|'+auftrag['token']+'|'+json.dumps(ergebnis),flush=True)
`;
async function job(o: MLLaufzeitOptionen, interpreter: string, daten: object, limit = 60000): Promise<any> {
  abbrechen(o);
  const ordner = join(o.technischeOrdner, `ml-job-${randomUUID()}`),
    token = randomBytes(24).toString('hex');
  await mkdir(ordner, { recursive: true });
  try {
    await writeFile(join(ordner, 'auftrag.json'), JSON.stringify({ ...daten, token }), { flag: 'wx' });
    await writeFile(join(ordner, 'ml-auftrag.py'), jobCode, { flag: 'wx' });
    const ergebnis = await new Promise<{ code: number | null; ausgabe: string; fehler: string }>(
      (fertig, ablehnen) => {
        const p = spawn(
          o.helper,
          [
            '--script',
            join(ordner, 'ml-auftrag.py'),
            '--basis',
            ordner,
            '--limit-ms',
            String(limit),
            '--token',
            token,
            '--sprache',
            'python',
            '--interpreter',
            interpreter,
          ],
          { windowsHide: true, shell: false, cwd: ordner, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        let ausgabe = '',
          fehler = '',
          startFehler: Error | null = null,
          notbremse: ReturnType<typeof setTimeout> | undefined;
        const stop = () => {
          p.stdin.end('STOP\n');
          notbremse ??= setTimeout(() => p.kill(), 2500);
        };
        const timer = setTimeout(stop, limit + 3000);
        o.signal?.addEventListener('abort', stop, { once: true });
        if (o.signal?.aborted) stop();
        p.stdin.on('error', () => {});
        p.stdout.on('data', (b) => {
          ausgabe = (ausgabe + b.toString('utf8')).slice(-262144);
        });
        p.stderr.on('data', (b) => {
          fehler = (fehler + b.toString('utf8')).slice(-32768);
        });
        p.once('error', (e) => {
          startFehler = e;
        });
        p.once('close', (code) => {
          clearTimeout(timer);
          clearTimeout(notbremse);
          o.signal?.removeEventListener('abort', stop);
          if (startFehler) ablehnen(startFehler);
          else fertig({ code, ausgabe, fehler });
        });
      },
    );
    abbrechen(o);
    if (ergebnis.code !== 0 || !/^SLHOST\|GESTARTET\|[^|\r\n]+\|\d+/.test(ergebnis.fehler))
      throw Error(
        `Die feste ML-Prüfung oder Einrichtung ist fehlgeschlagen. ${ergebnis.fehler.slice(-2000)}`,
      );
    const zeile = ergebnis.ausgabe.split(/\r?\n/).find((z) => z.startsWith(`SLML|${token}|`));
    if (!zeile) throw Error('Der ML-Auftrag lieferte kein bestätigtes Ergebnis.');
    return JSON.parse(zeile.slice(`SLML|${token}|`.length));
  } finally {
    if (dirname(resolve(ordner)) === resolve(o.technischeOrdner) && basename(ordner).startsWith('ml-job-'))
      await rm(ordner, { recursive: true, force: true }).catch(() => {});
  }
}

async function basisPruefen(o: MLLaufzeitOptionen) {
  return appLaufzeitPruefen({
    wurzel: o.basisWurzel,
    helper: o.helper,
    technischeOrdner: o.technischeOrdner,
    signal: o.signal,
  });
}
async function aktivesProfil(o: MLLaufzeitOptionen, profil: Profil): Promise<MLStatus> {
  const aktiv = aktiveSchema.parse(JSON.parse(await readFile(join(o.wurzel, 'aktiv.json'), 'utf8')));
  const ordner = join(o.wurzel, aktiv.ordner);
  await festerOrdner(ordner);
  const bytes = await readFile(join(ordner, 'scriptlab-ml.json'));
  if (bytes.length > 32 * 1024 ** 2 || sha(bytes) !== aktiv.manifestHash)
    throw Error('Das ML-Manifest wurde verändert.');
  const m = manifestSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (m.profilHash !== sha(JSON.stringify(profil)) || m.lockSha256 !== profil.lockSha256)
    throw Error('Das eingerichtete ML-Profil passt nicht zu dieser Appversion.');
  if (m.basisHash !== (await dateihash(join(o.basisWurzel, 'scriptlab-laufzeit.json'), o.signal)))
    throw Error('Das ML-Profil benötigt die erneute bewusste Einrichtung für die aktuelle Basis.');
  const ist = await inventar(ordner, o.signal);
  if (JSON.stringify(ist) !== JSON.stringify(m.dateien))
    throw Error('Das ML-Profil enthält fehlende, zusätzliche oder veränderte Dateien.');
  const ergebnis = await job(o, join(ordner, 'python.exe'), { art: 'pruefen', pakete: profil.pakete });
  return {
    zustand: 'bereit',
    meldung: 'Das optionale CPU-ML-Profil ist geprüft und bereit.',
    installation: {
      pfad: join(ordner, 'python.exe'),
      version: '3.15.2',
      architektur: 'x64',
      implementierung: 'CPython',
      tkinter: true,
    },
    profilHash: m.profilHash,
    pakete: ergebnis.pakete,
    fortschritt: null,
  };
}
export async function mlStatusPruefen(o: MLLaufzeitOptionen): Promise<MLStatus> {
  let profil: Profil | undefined;
  try {
    profil = await mlProfilLesen(o.paketwurzel);
    return await aktivesProfil(o, profil);
  } catch (e) {
    if (o.signal?.aborted) throw e;
    const fehlt =
      (e as NodeJS.ErrnoException).code === 'ENOENT' &&
      (e as NodeJS.ErrnoException).path === join(o.wurzel, 'aktiv.json');
    return {
      zustand: fehlt ? 'fehlt' : 'fehler',
      meldung: fehlt
        ? 'Das optionale ML-Zusatzpaket ist noch nicht eingerichtet.'
        : e instanceof Error
          ? e.message
          : 'Das ML-Profil konnte nicht geprüft werden.',
      installation: null,
      profilHash: profil ? sha(JSON.stringify(profil)) : null,
      pakete:
        profil?.pakete.map((p) => ({
          name: p.name,
          sollVersion: p.version,
          version: null,
          importierbar: false,
        })) ?? [],
      fortschritt: null,
    };
  }
}
export async function mlInstallationErmitteln(o: MLLaufzeitOptionen): Promise<PythonInstallation> {
  const status = await mlStatusPruefen(o);
  if (status.zustand !== 'bereit' || !status.installation) throw Error(status.meldung);
  return status.installation;
}
async function wheelPruefen(pfad: string, p: Profil['pakete'][number], signal?: AbortSignal) {
  const s = await lstat(pfad);
  if (!s.isFile() || s.size !== p.bytes || (await dateihash(pfad, signal)) !== p.sha256)
    throw Error(`Das feste ML-Wheel fehlt oder wurde verändert: ${p.wheel}`);
}
export async function mlEinrichten(o: MLLaufzeitOptionen, offlineOrdner?: string): Promise<MLStatus> {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw Error('Das ML-Profil benötigt Windows x64.');
  for (const p of [o.basisWurzel, o.wurzel, o.helper, o.technischeOrdner, o.paketwurzel])
    if (!isAbsolute(p)) throw Error('Die ML-Einrichtung benötigt feste vollständige Pfade.');
  const abstand = relative(resolve(o.basisWurzel), resolve(o.wurzel));
  if (!abstand || (!abstand.startsWith('..') && !isAbsolute(abstand)))
    throw Error('Das ML-Ziel darf nicht im Basis-Python liegen.');
  if (offlineOrdner !== undefined && !isAbsolute(offlineOrdner))
    throw Error('Wähle einen vollständigen Wheelhouse-Pfad.');
  const profil = await mlProfilLesen(o.paketwurzel);
  fortschritt(o, 'basis', 'Die unveränderte Basislaufzeit wird geprüft.');
  await basisPruefen(o);
  await mkdir(o.wurzel, { recursive: true });
  await festerOrdner(o.wurzel);
  const sperre = join(o.wurzel, 'einrichtung.lock');
  const { open } = await import('node:fs/promises');
  const lock = await open(sperre, 'wx');
  // Ein noch nicht referenzierter Ordner ist das Staging. Sein endgültiger Pfad
  // bleibt stabil, damit Pip-Konsolenstarter keinen später ungültigen Shebang erhalten.
  const ziel = join(o.wurzel, `profil-${randomUUID()}`),
    staging = ziel;
  let publiziert = false,
    erstellt = false;
  try {
    const cache = join(o.wurzel, 'wheels');
    await mkdir(cache, { recursive: true });
    await festerOrdner(cache);
    for (let i = 0; i < profil.pakete.length; i++) {
      const p = profil.pakete[i],
        datei = join(cache, p.wheel);
      fortschritt(o, 'wheels', `Festes CPU-Paket: ${p.name}`, i);
      if (offlineOrdner !== undefined) {
        const quelle = join(offlineOrdner, p.wheel);
        await wheelPruefen(quelle, p, o.signal);
        try {
          await wheelPruefen(datei, p, o.signal);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
          await cp(quelle, datei, { errorOnExist: true, force: false });
        }
      } else {
        try {
          await wheelPruefen(datei, p, o.signal);
          continue;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
        const temp = join(cache, `.download-${randomUUID()}`);
        try {
          const signal = AbortSignal.any([...(o.signal ? [o.signal] : []), AbortSignal.timeout(180000)]);
          const r = await fetch(p.url, { redirect: 'error', signal });
          if (!r.ok || !r.body) throw Error(`Die feste Paketquelle ist nicht erreichbar: ${p.name}`);
          let bytes = 0;
          const h = createHash('sha256');
          await pipeline(
            r.body,
            new Transform({
              transform(b, _e, f) {
                bytes += b.length;
                h.update(b);
                f(bytes > p.bytes ? Error('Das ML-Wheel überschreitet seine festgelegte Größe.') : null, b);
              },
            }),
            createWriteStream(temp, { flags: 'wx' }),
            { signal },
          );
          if (bytes !== p.bytes || h.digest('hex') !== p.sha256)
            throw Error(
              `Das heruntergeladene ML-Wheel stimmt nicht mit dem festen Profil überein: ${p.name}`,
            );
          await rename(temp, datei);
        } finally {
          await rm(temp, { force: true }).catch(() => {});
        }
      }
      await wheelPruefen(datei, p, o.signal);
    }
    fortschritt(o, 'basis', 'Eine private vollständige Kopie der geprüften Basis wird erstellt.', 21);
    await mkdir(staging); // Exklusiver Besitz vor jeder Kopie und späteren Bereinigung.
    erstellt = true;
    for (const name of await readdir(o.basisWurzel))
      await cp(join(o.basisWurzel, name), join(staging, name), {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: () => {
          abbrechen(o);
          return true;
        },
      });
    // Die Kopie wird vor dem Bootstrap nochmals gegen das Basismanifest geprüft.
    await appLaufzeitPruefen({
      wurzel: staging,
      helper: o.helper,
      technischeOrdner: o.technischeOrdner,
      signal: o.signal,
    });
    fortschritt(
      o,
      'bootstrap',
      'Pip wird ausschließlich in der privaten Profilkopie offline vorbereitet.',
      21,
    );
    await job(
      o,
      join(staging, 'python.exe'),
      { art: 'installieren', wheels: cache, lock: join(o.paketwurzel, 'requirements-ml.lock') },
      330000,
    );
    fortschritt(
      o,
      'pruefung',
      'CPU-Import, Random Forest, Torch-Training und sichere Modellrunde werden geprüft.',
      21,
    );
    const probe = await job(o, join(staging, 'python.exe'), {
      art: 'pruefen',
      pakete: profil.pakete,
      trainingsprobe: true,
    });
    // Pip und Bytecode sind Einrichtungswerkzeuge; jeder spätere Lauf startet ohne Cacheänderungen.
    const bereinigen = async (ordner: string): Promise<void> => {
      for (const e of await readdir(ordner, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const p = join(ordner, e.name);
        if (e.name === '__pycache__' || e.name === 'pip' || /^pip-[\d.]+\.dist-info$/.test(e.name))
          await rm(p, { recursive: true, force: true });
        else await bereinigen(p);
      }
    };
    await bereinigen(staging);
    for (const n of await readdir(join(staging, 'Scripts')))
      if (/^pip(?:3(?:\.15)?)?\.exe$/.test(n)) await rm(join(staging, 'Scripts', n));
    const manifest = {
      schemaVersion: 1,
      profilHash: sha(JSON.stringify(profil)),
      basisHash: await dateihash(join(o.basisWurzel, 'scriptlab-laufzeit.json'), o.signal),
      lockSha256: profil.lockSha256,
      dateien: await inventar(staging, o.signal),
    };
    const bytes = JSON.stringify(manifest);
    await writeFile(join(staging, 'scriptlab-ml.json'), bytes, { flag: 'wx' });
    abbrechen(o);
    await atomarSchreiben(
      join(o.wurzel, 'aktiv.json'),
      JSON.stringify({ schemaVersion: 1, ordner: basename(ziel), manifestHash: sha(bytes) }) + '\n',
    );
    publiziert = true;
    // Der atomare Zeigerwechsel ist der Abschluss. Danach keine abbrechbare Folgeprüfung,
    // die eine bereits erfolgreiche Aktivierung nachträglich als Fehler darstellen könnte.
    try {
      o.fortschritt?.({
        phase: 'abschluss',
        meldung: 'Das geprüfte CPU-ML-Profil wurde aktiviert.',
        fertigePakete: 21,
        gesamtPakete: 21,
      });
    } catch {
      /* Eine Anzeige darf den bestätigten Abschluss nicht zurücknehmen. */
    }
    return {
      zustand: 'bereit',
      meldung: 'Das optionale CPU-ML-Profil ist geprüft und bereit.',
      installation: {
        pfad: join(ziel, 'python.exe'),
        version: '3.15.2',
        architektur: 'x64',
        implementierung: 'CPython',
        tkinter: true,
      },
      profilHash: manifest.profilHash,
      pakete: probe.pakete,
      fortschritt: null,
    };
  } finally {
    if (
      !publiziert &&
      erstellt &&
      dirname(resolve(staging)) === resolve(o.wurzel) &&
      /^profil-[a-f0-9-]{36}$/.test(basename(staging))
    )
      await rm(staging, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
    await lock.close();
    await rm(sperre, { force: true }).catch(() => {});
  }
}
