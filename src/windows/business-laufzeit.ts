import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat, rm, rename, realpath } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { basename, join, resolve, relative, isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { PythonInstallation } from '../gemeinsam/python';
import type { BusinessStatus, BusinessFortschritt } from '../gemeinsam/business-laufzeit';
import { pythonPruefen } from './python';

export interface BusinessOptionen {
  helper: string;
  technischeOrdner: string;
  /** Enthält requirements-business.lock und das feste Unterpackage scriptlab_business. */
  paketwurzel: string;
  signal?: AbortSignal;
}
export interface BusinessEinrichtungsOptionen extends BusinessOptionen {
  laufzeitenOrdner: string;
  quelle: 'pypi' | 'wheelhouse';
  wheelhouseOrdner?: string;
  fortschritt?: (stand: BusinessFortschritt) => void;
}
export interface BusinessPin {
  name: string;
  version: string;
  hashes: string[];
}
const moduleNachPaket: Record<string, string> = {
  duckdb: 'duckdb',
  openpyxl: 'openpyxl',
  'python-docx': 'docx',
  reportlab: 'reportlab',
  pypdf: 'pypdf',
  'et-xmlfile': 'et_xmlfile',
  lxml: 'lxml.etree',
  'typing-extensions': 'typing_extensions',
  pillow: 'PIL.Image',
  'charset-normalizer': 'charset_normalizer',
  defusedxml: 'defusedxml',
};
export const businessProfil = 'windows-cpython-312-315-x64-v1';
const maximaleWheelBytes = 100 * 1024 * 1024;

async function dateifrist<T>(arbeit: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const frist = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]);
  let abbrechen = () => {};
  try {
    abbruchPruefen(frist);
    return await Promise.race([
      arbeit(frist),
      new Promise<never>((_fertig, ablehnen) => {
        abbrechen = () =>
          ablehnen(
            new Error(
              signal?.aborted
                ? 'Die Business-Einrichtung wurde abgebrochen.'
                : 'Das Wheelhouse oder die Paketdatei ist nicht innerhalb von zehn Sekunden erreichbar.',
            ),
          );
        frist.addEventListener('abort', abbrechen, { once: true });
        if (frist.aborted) abbrechen();
      }),
    ]);
  } finally {
    frist.removeEventListener('abort', abbrechen);
  }
}

export function businessLockPruefen(text: string): BusinessPin[] {
  if (text.length > 65536) throw new Error('Die feste Business-Paketliste ist zu groß.');
  const zeilen = text
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('#'));
  const pins: BusinessPin[] = [];
  for (const zeile of zeilen) {
    const treffer = /^([a-z0-9-]+)==(\d+\.\d+(?:\.\d+)?)\s+((?:--hash=sha256:[a-f0-9]{64}\s*)+)$/.exec(zeile);
    if (!treffer || !Object.hasOwn(moduleNachPaket, treffer[1]) || pins.some((p) => p.name === treffer[1]))
      throw new Error('Die feste Business-Paketliste enthält nicht freigegebene Einträge.');
    pins.push({
      name: treffer[1],
      version: treffer[2],
      hashes: [...treffer[3].matchAll(/sha256:([a-f0-9]{64})/g)].map((t) => t[1]),
    });
  }
  if (pins.length !== Object.keys(moduleNachPaket).length)
    throw new Error('Die feste Business-Paketliste ist unvollständig.');
  return pins;
}
async function lockLesen(wurzel: string) {
  const bytes = await readFile(join(wurzel, 'requirements-business.lock'));
  return {
    pins: businessLockPruefen(bytes.toString('utf8')),
    bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
  };
}
function abbruchPruefen(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Die Business-Einrichtung oder Prüfung wurde abgebrochen.');
}
function profilPruefen(installation: PythonInstallation): string {
  if (
    process.platform !== 'win32' ||
    process.arch !== 'x64' ||
    installation.architektur !== 'x64' ||
    installation.implementierung !== 'CPython' ||
    !/^3\.(12|13|14|15)\.\d+$/.test(installation.version)
  )
    throw new Error(
      'Die Business-Laufzeit benötigt reguläres stabiles CPython 3.12 bis 3.15 für Windows x64.',
    );
  return `cp3${installation.version.split('.')[1]}`;
}

// Ausschließlich feste technische Operationen. Keine Nutzerdateien, Workflows oder Vorlagen.
const pruefcode = `import sys
sys.dont_write_bytecode = True
import json, sysconfig, importlib, importlib.metadata
from pathlib import Path
auftrag = json.loads((Path(sys.argv[sys.argv.index('--scriptlab-basis') + 1]) / 'auftrag.json').read_text(encoding='utf-8'))
pakete = []
for pin in ([] if sysconfig.get_config_var('Py_GIL_DISABLED') else auftrag['pakete']):
    try:
        version = importlib.metadata.version(pin['name'])
    except importlib.metadata.PackageNotFoundError:
        version = None
    importierbar = False
    if version == pin['version']:
        try:
            importlib.import_module(pin['modul'])
            importierbar = True
        except Exception:
            pass
    pakete.append({'name': pin['name'], 'sollVersion': pin['version'], 'version': version, 'importierbar': importierbar})
print('SLBUSINESS|' + auftrag['token'] + '|' + json.dumps({'pakete': pakete, 'freethreaded': bool(sysconfig.get_config_var('Py_GIL_DISABLED'))}, ensure_ascii=True), flush=True)
`;
const einrichtcode = `import json, sys, subprocess, venv
from pathlib import Path
auftrag = json.loads((Path(sys.argv[sys.argv.index('--scriptlab-basis') + 1]) / 'auftrag.json').read_text(encoding='utf-8'))
ziel = Path(auftrag['ziel'])
venv.EnvBuilder(with_pip=True, upgrade_deps=False).create(ziel)
interpreter = ziel / 'Scripts' / 'python.exe'
subprocess.run([str(interpreter), '-I', '-m', 'pip', '--isolated', 'install', '--no-index', '--require-hashes', '--only-binary=:all:', '--no-deps', '--no-cache-dir', '--no-compile', '--disable-pip-version-check', '--find-links', auftrag['wheels'], '--requirement', auftrag['lock']], stdin=subprocess.DEVNULL, check=True, timeout=120)
print('SLBUSINESS|' + auftrag['token'] + '|{}', flush=True)
`;

async function festerJob(
  installation: PythonInstallation,
  optionen: BusinessOptionen,
  operation: 'pruefen' | 'einrichten',
  daten: object,
): Promise<unknown> {
  abbruchPruefen(optionen.signal);
  const ordner = join(optionen.technischeOrdner, `business-job-${randomUUID()}`),
    token = randomBytes(24).toString('hex');
  await mkdir(ordner, { recursive: true });
  try {
    await writeFile(join(ordner, 'auftrag.json'), JSON.stringify({ ...daten, token }), {
      flag: 'wx',
      signal: optionen.signal,
    });
    const script = join(ordner, 'fester-auftrag.py');
    await writeFile(script, operation === 'pruefen' ? pruefcode : einrichtcode, {
      flag: 'wx',
      signal: optionen.signal,
    });
    const limit = operation === 'pruefen' ? 10000 : 150000;
    const ergebnis = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (fertig, ablehnen) => {
        const prozess = spawn(
          optionen.helper,
          [
            '--script',
            script,
            '--basis',
            ordner,
            '--limit-ms',
            String(limit),
            '--token',
            token,
            '--sprache',
            'python',
            '--interpreter',
            installation.pfad,
          ],
          { shell: false, windowsHide: true, cwd: ordner, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        const dekoder = [new StringDecoder('utf8'), new StringDecoder('utf8')];
        let stdout = '',
          stderr = '',
          fehler: Error | null = null;
        let notbremse: ReturnType<typeof setTimeout> | undefined;
        const stoppen = () => {
          prozess.stdin.end('STOP\n');
          notbremse ??= setTimeout(() => prozess.kill(), 2500);
        };
        const frist = setTimeout(stoppen, limit + 3000);
        optionen.signal?.addEventListener('abort', stoppen, { once: true });
        if (optionen.signal?.aborted) stoppen();
        prozess.stdin.on('error', () => {});
        prozess.stdout.on('data', (d: Buffer) => {
          stdout = (stdout + dekoder[0].write(d)).slice(-131072);
        });
        prozess.stderr.on('data', (d: Buffer) => {
          stderr = (stderr + dekoder[1].write(d)).slice(-32768);
        });
        prozess.once('error', (e) => {
          fehler = e;
        });
        prozess.once('close', (code) => {
          clearTimeout(frist);
          clearTimeout(notbremse);
          optionen.signal?.removeEventListener('abort', stoppen);
          stdout += dekoder[0].end();
          stderr += dekoder[1].end();
          if (optionen.signal?.aborted)
            ablehnen(new Error('Die Business-Einrichtung oder Prüfung wurde abgebrochen.'));
          else if (fehler)
            ablehnen(new Error('Das feste Business-Prüfwerkzeug konnte nicht gestartet werden.'));
          else fertig({ code, stdout, stderr });
        });
      },
    );
    if (ergebnis.stderr.includes('SLHOST|ZEITLIMIT'))
      throw new Error(
        'Die feste Zeitgrenze der Business-Prüfung oder Einrichtung wurde erreicht. Alle gebundenen Prozesse wurden beendet.',
      );
    if (ergebnis.code !== 0 || !/^SLHOST\|GESTARTET\|[^|\r\n]+\|\d+\r?\n/.test(ergebnis.stderr))
      throw new Error(
        operation === 'einrichten'
          ? 'Die eigene Business-Umgebung konnte nicht vollständig eingerichtet werden. Benötigt wird eine normale Python-Installation mit venv und ensurepip; prüfe auch freien Speicher und Schreibrechte.'
          : 'Die Business-Pakete konnten nicht rechtzeitig geprüft werden. Die Umgebung bleibt unverändert.',
      );
    const prefix = `SLBUSINESS|${token}|`;
    const zeile = ergebnis.stdout.split(/\r?\n/).find((z) => z.startsWith(prefix));
    if (!zeile) throw new Error('Die feste Business-Prüfung hat kein bestätigtes Ergebnis geliefert.');
    return JSON.parse(zeile.slice(prefix.length));
  } finally {
    // Nur der selbst erzeugte technische Auftragsordner. Job/Streams sind vorher bestätigt beendet.
    const abstand = relative(resolve(optionen.technischeOrdner), resolve(ordner));
    if (abstand && !abstand.startsWith('..') && !isAbsolute(abstand))
      await rm(ordner, { recursive: true, force: true }).catch(() => {});
  }
}

export async function businessStatusPruefen(
  installation: PythonInstallation,
  optionen: BusinessOptionen,
): Promise<BusinessStatus> {
  const lock = await lockLesen(optionen.paketwurzel);
  const grund = {
    installation,
    profil: businessProfil,
    lockSha256: lock.hash,
    pakete: lock.pins.map((p) => ({
      name: p.name,
      sollVersion: p.version,
      version: null,
      importierbar: false,
    })),
  };
  try {
    profilPruefen(installation);
    const aktuell = await pythonPruefen(installation.pfad, {
      helper: optionen.helper,
      technischeOrdner: optionen.technischeOrdner,
      signal: optionen.signal,
    });
    const antwort = (await festerJob(aktuell, optionen, 'pruefen', {
      pakete: lock.pins.map((p) => ({ ...p, modul: moduleNachPaket[p.name] })),
    })) as { pakete: BusinessStatus['pakete']; freethreaded: boolean };
    if (antwort.freethreaded)
      return {
        ...grund,
        zustand: 'ungeeignet',
        meldung:
          'Free-Threaded-Python gehört nicht zum festen Business-Wheelprofil. Wähle reguläres CPython x64.',
      };
    if (
      !Array.isArray(antwort.pakete) ||
      antwort.pakete.length !== lock.pins.length ||
      antwort.pakete.some(
        (p, i) =>
          p.name !== lock.pins[i].name ||
          p.sollVersion !== lock.pins[i].version ||
          (p.version !== null && typeof p.version !== 'string') ||
          typeof p.importierbar !== 'boolean',
      )
    )
      throw new Error('Die Business-Prüfung lieferte keine passenden Paketangaben.');
    const pakete = antwort.pakete,
      fehlen = pakete.some((p) => p.version === null),
      passend = pakete.every((p) => p.version === p.sollVersion && p.importierbar);
    return {
      ...grund,
      installation: aktuell,
      pakete,
      zustand: passend ? 'bereit' : fehlen ? 'fehlt' : 'abweichend',
      meldung: passend
        ? 'Die feste Business-Laufzeit ist vollständig geprüft.'
        : fehlen
          ? 'Die Business-Pakete fehlen. Richte bei Bedarf ausdrücklich eine eigene Business-Umgebung ein.'
          : 'Die Business-Paketversionen oder Importe passen nicht zum freigegebenen Satz.',
    };
  } catch (e) {
    if (optionen.signal?.aborted) throw e;
    return {
      ...grund,
      zustand: 'fehler',
      meldung:
        e instanceof Error && !('code' in e)
          ? e.message
          : 'Die Business-Laufzeit konnte nicht gelesen werden.',
    };
  }
}

export function businessWheelPasst(dateiname: string, pin: BusinessPin, tag: string): boolean {
  const start = `${pin.name.replaceAll('-', '_')}-${pin.version}-`.toLowerCase();
  if (basename(dateiname) !== dateiname || !dateiname.toLowerCase().startsWith(start)) return false;
  const ende = dateiname.slice(start.length);
  if (/^py(?:2\.py3|3)-none-any\.whl$/.test(ende)) return true;
  if (ende === `${tag}-${tag}-win_amd64.whl`) return true;
  const abi = /^(cp3\d+)-abi3-win_amd64\.whl$/.exec(ende);
  return !!abi && Number(abi[1].slice(2)) <= Number(tag.slice(2));
}
async function dateiHash(pfad: string, signal?: AbortSignal): Promise<string> {
  const info = await dateifrist(() => stat(pfad), signal);
  if (!info.isFile() || info.size > maximaleWheelBytes)
    throw new Error('Die Wheeldatei ist keine reguläre Datei oder überschreitet 100 MiB.');
  return dateifrist(async (signal) => {
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const teil of createReadStream(pfad, { signal })) {
      bytes += teil.length;
      if (bytes > maximaleWheelBytes) throw new Error('Die Wheeldatei überschreitet 100 MiB.');
      hash.update(teil);
    }
    return hash.digest('hex');
  }, signal);
}
async function wheelsVorbereiten(
  pins: BusinessPin[],
  tag: string,
  ziel: string,
  optionen: BusinessEinrichtungsOptionen,
): Promise<void> {
  await mkdir(ziel);
  for (let i = 0; i < pins.length; i++) {
    abbruchPruefen(optionen.signal);
    const pin = pins[i];
    let name: string, quelle: string;
    if (optionen.quelle === 'wheelhouse') {
      if (!optionen.wheelhouseOrdner || !isAbsolute(optionen.wheelhouseOrdner))
        throw new Error('Wähle einen vollständigen lokalen Wheelhouse-Ordner aus.');
      const namen = (await dateifrist(() => readdir(optionen.wheelhouseOrdner!), optionen.signal))
        .filter((n) => businessWheelPasst(n, pin, tag))
        .sort(
          (a, b) => Number(!a.includes('none-any')) - Number(!b.includes('none-any')) || a.localeCompare(b),
        );
      name = namen[0];
      if (!name) throw new Error(`Im Wheelhouse fehlt ${pin.name} ${pin.version} für dieses Pythonprofil.`);
      quelle = join(optionen.wheelhouseOrdner, name);
      if (!pin.hashes.includes(await dateiHash(quelle, optionen.signal)))
        throw new Error(`Die Prüfsumme von ${pin.name} stimmt nicht mit der festen Paketliste überein.`);
      await dateifrist(async (signal) => {
        let bytes = 0;
        const grenze = new Transform({
          transform(teil, _kodierung, fertig) {
            bytes += teil.length;
            fertig(
              bytes > maximaleWheelBytes ? new Error('Die Wheeldatei überschreitet 100 MiB.') : null,
              teil,
            );
          },
        });
        await pipeline(
          createReadStream(quelle, { signal }),
          grenze,
          createWriteStream(join(ziel, name), { flags: 'wx', signal }),
          { signal },
        );
      }, optionen.signal);
    } else {
      const response = await fetch(`https://pypi.org/pypi/${pin.name}/${pin.version}/json`, {
        signal: AbortSignal.any([optionen.signal!, AbortSignal.timeout(30000)].filter(Boolean)),
        redirect: 'error',
      });
      if (!response.ok)
        throw new Error(`Die festgelegten Paketinformationen für ${pin.name} konnten nicht geladen werden.`);
      const meta = (await response.json()) as {
        urls: { filename: string; url: string; size: number; digests: { sha256: string }; yanked: boolean }[];
      };
      const file = meta.urls
        ?.filter(
          (f) =>
            !f.yanked && businessWheelPasst(f.filename, pin, tag) && pin.hashes.includes(f.digests?.sha256),
        )
        .sort(
          (a, b) =>
            Number(!a.filename.includes('none-any')) - Number(!b.filename.includes('none-any')) ||
            a.filename.localeCompare(b.filename),
        )[0];
      if (!file)
        throw new Error(`Für ${pin.name} fehlt ein freigegebenes Windows-Wheel dieses Pythonprofils.`);
      const url = new URL(file.url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'files.pythonhosted.org' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        file.size > 100 * 1024 * 1024
      )
        throw new Error('Die feste Paketquelle ist nicht zulässig.');
      const download = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.any([optionen.signal!, AbortSignal.timeout(30000)].filter(Boolean)),
      });
      if (!download.ok)
        throw new Error(`Das freigegebene Wheel für ${pin.name} konnte nicht geladen werden.`);
      const teile: Uint8Array[] = [];
      let bytes = 0;
      for await (const teil of download.body!) {
        bytes += teil.length;
        if (bytes > 100 * 1024 * 1024) throw new Error('Das Wheel überschreitet die feste Downloadgrenze.');
        teile.push(teil);
      }
      const daten = Buffer.concat(teile);
      name = file.filename;
      if (bytes !== file.size || !pin.hashes.includes(createHash('sha256').update(daten).digest('hex')))
        throw new Error(`Die Prüfsumme von ${pin.name} stimmt nicht.`);
      await writeFile(join(ziel, name), daten, { flag: 'wx', signal: optionen.signal });
    }
    if (!pin.hashes.includes(await dateiHash(join(ziel, name), optionen.signal)))
      throw new Error(`Das kopierte Wheel ${pin.name} stimmt nicht mit der festen Prüfsumme überein.`);
    optionen.fortschritt?.({
      phase: 'pakete',
      meldung: `Paket ${pin.name} geprüft.`,
      fertigePakete: i + 1,
      gesamtPakete: pins.length,
    });
  }
}

export async function businessEinrichten(
  basis: PythonInstallation,
  optionen: BusinessEinrichtungsOptionen,
): Promise<BusinessStatus> {
  const signal = AbortSignal.any([optionen.signal!, AbortSignal.timeout(300000)].filter(Boolean));
  const kontext = { ...optionen, signal };
  abbruchPruefen(signal);
  profilPruefen(basis);
  const lock = await lockLesen(optionen.paketwurzel);
  if (optionen.quelle !== 'pypi' && optionen.quelle !== 'wheelhouse')
    throw new Error('Wähle die feste Paketquelle oder einen IT-Wheelhouse-Ordner.');
  const aktuell = await pythonPruefen(basis.pfad, {
    helper: optionen.helper,
    technischeOrdner: optionen.technischeOrdner,
    signal,
  });
  const tag = profilPruefen(aktuell);
  const konfiguration = (await festerJob(aktuell, kontext, 'pruefen', { pakete: [] })) as {
    freethreaded: boolean;
  };
  if (konfiguration.freethreaded)
    throw new Error(
      'Die Business-Einrichtung benötigt reguläres CPython; Free-Threaded-Python wird nicht unterstützt.',
    );
  await mkdir(optionen.laufzeitenOrdner, { recursive: true });
  const ziel = join(optionen.laufzeitenOrdner, `business-${randomUUID()}`),
    technik = join(optionen.technischeOrdner, `business-pakete-${randomUUID()}`);
  let fertig = false,
    zielErstellt = false,
    technikErstellt = false;
  try {
    await mkdir(ziel);
    zielErstellt = true;
    await mkdir(technik, { recursive: true });
    technikErstellt = true;
    await writeFile(
      join(ziel, 'scriptlab-business.json'),
      JSON.stringify({ schemaVersion: 1, status: 'unvollstaendig', lockSha256: lock.hash }),
    );
    optionen.fortschritt?.({
      phase: 'pakete',
      meldung: 'Die festen Pakete werden geprüft.',
      fertigePakete: 0,
      gesamtPakete: lock.pins.length,
    });
    const wheels = join(technik, 'wheels');
    await wheelsVorbereiten(lock.pins, tag, wheels, kontext);
    const lockPfad = join(technik, 'requirements-business.lock');
    await writeFile(lockPfad, lock.bytes, { flag: 'wx', signal });
    optionen.fortschritt?.({
      phase: 'venv',
      meldung: 'Eine neue eigene Business-Umgebung wird eingerichtet.',
      fertigePakete: lock.pins.length,
      gesamtPakete: lock.pins.length,
    });
    await festerJob(aktuell, kontext, 'einrichten', {
      ziel: await realpath(ziel),
      wheels: await realpath(wheels),
      lock: await realpath(lockPfad),
    });
    abbruchPruefen(signal);
    const installation = await pythonPruefen(join(ziel, 'Scripts', 'python.exe'), {
      helper: optionen.helper,
      technischeOrdner: optionen.technischeOrdner,
      signal,
    });
    optionen.fortschritt?.({
      phase: 'abschluss',
      meldung: 'Versionen und alle Business-Module werden bestätigt.',
      fertigePakete: lock.pins.length,
      gesamtPakete: lock.pins.length,
    });
    const status = await businessStatusPruefen(installation, kontext);
    if (status.zustand !== 'bereit') throw new Error(status.meldung);
    const temp = join(ziel, 'scriptlab-business.json.neu');
    await writeFile(
      temp,
      JSON.stringify({
        schemaVersion: 1,
        status: 'bereit',
        lockSha256: lock.hash,
        gesichertAm: new Date().toISOString(),
      }),
      { flag: 'wx', signal },
    );
    await rename(temp, join(ziel, 'scriptlab-business.json'));
    fertig = true;
    return status;
  } catch (e) {
    if (signal.aborted)
      throw new Error(
        optionen.signal?.aborted
          ? 'Die Business-Einrichtung wurde abgebrochen.'
          : 'Die Business-Einrichtung hat die Gesamtfrist von fünf Minuten erreicht.',
      );
    if (e instanceof Error && 'code' in e)
      throw new Error(
        'Die Business-Umgebung oder das Wheelhouse konnte nicht gelesen oder gespeichert werden. Prüfe Zugriffsrechte und Speicherplatz.',
      );
    throw e;
  } finally {
    const innerhalb = (basis: string, pfad: string) => {
      const r = relative(resolve(basis), resolve(pfad));
      return !!r && !r.startsWith('..') && !isAbsolute(r);
    };
    if (technikErstellt && innerhalb(optionen.technischeOrdner, technik))
      await rm(technik, { recursive: true, force: true }).catch(() => {});
    if (!fertig && zielErstellt && innerhalb(optionen.laufzeitenOrdner, ziel))
      await rm(ziel, { recursive: true, force: true }).catch(() => {});
  }
}
