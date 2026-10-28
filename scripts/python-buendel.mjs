import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  lstat,
  writeFile,
  cp,
  rename,
  rm,
  copyFile,
  unlink,
  rmdir,
  realpath,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ausfuehren = promisify(execFile);
const repo = fileURLToPath(new URL('..', import.meta.url));
const basis = join(repo, 'artifacts', 'python-buendel');
export const pythonBuendelPfad = join(basis, 'python');
const version = '3.15.2';
// Originalhash des EXE von der Python-Release-Seite; MSI-Hashes nach gültiger PSF-Authenticodeprüfung.
const quellen = [
  [
    'python-3.15.2-amd64.exe',
    `https://www.python.org/ftp/python/${version}/python-${version}-amd64.exe`,
    '06e225a228191b0f4d1dcf6905fbb21bf9f6970d13a2ec63137ab9bee76f15aa',
  ],
  [
    'core.msi',
    `https://www.python.org/ftp/python/${version}/amd64/core.msi`,
    '1ab04330cedbf1e12e9a11a3afb21679e808d02bffe49dff5483dfaa7641b1ef',
  ],
  [
    'exe.msi',
    `https://www.python.org/ftp/python/${version}/amd64/exe.msi`,
    '3d8b229039e276aadc880e52c4aea3ab3b9af4934e34d6be08c9cf78919c9e55',
  ],
  [
    'lib.msi',
    `https://www.python.org/ftp/python/${version}/amd64/lib.msi`,
    'cf9dd1af2ad9d3f8c9f0ce76c56c6def378f6ab1b79f964dd54e0ea958403c08',
  ],
  [
    'tcltk.msi',
    `https://www.python.org/ftp/python/${version}/amd64/tcltk.msi`,
    'a398763af9d67cb6b0bef4326c5538de4363b8560413d0cc5604344d487bcc62',
  ],
  [
    'ucrt.msi',
    `https://www.python.org/ftp/python/${version}/amd64/ucrt.msi`,
    '7abe902a0458d01b8fbcfb10ebb634398a85e3acb0ad6ec5ed6db6785af76e12',
  ],
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function bauHash() {
  return hash(
    Buffer.concat([
      await readFile(fileURLToPath(import.meta.url)),
      await readFile(join(repo, 'scripts', 'msi-dateien-entpacken.ps1')),
      await readFile(join(repo, 'laufzeit', 'business-notices.md')),
    ]),
  );
}
async function dateihash(pfad) {
  const h = createHash('sha256');
  for await (const block of createReadStream(pfad)) h.update(block);
  return h.digest('hex');
}
async function dateien(ordner, praefix = '') {
  const liste = [];
  for (const eintrag of await readdir(join(ordner, praefix), { withFileTypes: true })) {
    const pfad = join(praefix, eintrag.name);
    if (eintrag.isDirectory()) liste.push(...(await dateien(ordner, pfad)));
    else if (eintrag.isFile()) liste.push(pfad.replaceAll('\\', '/'));
    else throw new Error('Das Python-Bündel enthält einen unzulässigen Dateiverweis.');
  }
  return liste.sort();
}
async function lockLesen() {
  const bytes = await readFile(join(repo, 'laufzeit', 'requirements-business.lock'));
  const pins = bytes
    .toString('utf8')
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('#'))
    .map((zeile) => {
      const m = /^([a-z0-9-]+)==(\d+\.\d+(?:\.\d+)?)\s+((?:--hash=sha256:[a-f0-9]{64}\s*)+)$/.exec(zeile);
      if (!m) throw new Error('Die feste Business-Lockdatei ist ungültig.');
      return {
        name: m[1],
        version: m[2],
        hashes: [...m[3].matchAll(/sha256:([a-f0-9]{64})/g)].map((m) => m[1]),
      };
    });
  if (pins.length !== 11 || new Set(pins.map((p) => p.name)).size !== 11)
    throw new Error('Genau elf feste Business-Pakete werden benötigt.');
  return { bytes, hash: hash(bytes), pins };
}
function wheelPasst(name, pin) {
  const anfang = pin.name.replaceAll('-', '_') + '-' + pin.version + '-';
  if (basename(name) !== name || !name.startsWith(anfang)) return false;
  const ende = name.slice(anfang.length),
    abi = /^(cp3\d+)-abi3-win_amd64\.whl$/.exec(ende);
  return (
    /^py(?:2\.py3|3)-none-any\.whl$/.test(ende) ||
    ende === 'cp315-cp315-win_amd64.whl' ||
    (!!abi && Number(abi[1].slice(2)) <= 315)
  );
}
async function herunterladen(url, pfad, erwartet) {
  try {
    if ((await dateihash(pfad)) === erwartet) return;
    throw new Error('Eine zwischengespeicherte Quelldatei hat eine abweichende Prüfsumme.');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const antwort = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!antwort.ok) throw new Error(`Die feste Buildquelle konnte nicht geladen werden: ${url}`);
  const bytes = Buffer.from(await antwort.arrayBuffer());
  if (bytes.length > 100 * 1024 ** 2 || hash(bytes) !== erwartet)
    throw new Error('Die Buildquelle stimmt nicht mit der festen SHA-256-Prüfsumme überein.');
  await writeFile(pfad, bytes, { flag: 'wx' });
}
const powershell = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
const buildUmgebung = { ...process.env, PSModulePath: join(dirname(powershell), 'Modules') };
async function signaturPruefen(pfad) {
  const ergebnis = await ausfuehren(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$s=Get-AuthenticodeSignature -LiteralPath $env:SCRIPTLAB_BUILDQUELLE; if($s.Status -ne "Valid" -or $s.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne "Python Software Foundation") { throw "Die Originalquelle besitzt keine gueltige PSF-Signatur." }; @{herausgeber=$s.SignerCertificate.Subject;fingerabdruck=$s.SignerCertificate.Thumbprint;status="Valid"}|ConvertTo-Json -Compress',
    ],
    { windowsHide: true, timeout: 30000, env: { ...buildUmgebung, SCRIPTLAB_BUILDQUELLE: pfad } },
  );
  return JSON.parse(ergebnis.stdout.trim());
}
export async function pythonBuendelPruefen() {
  const manifest = JSON.parse(await readFile(join(pythonBuendelPfad, 'scriptlab-laufzeit.json'), 'utf8'));
  const lock = await lockLesen();
  if (
    manifest.schemaVersion !== 1 ||
    manifest.pythonVersion !== version ||
    manifest.architektur !== 'x64' ||
    manifest.bereit !== true ||
    manifest.businessLockSha256 !== lock.hash ||
    manifest.bauSha256 !== (await bauHash())
  )
    throw Object.assign(new Error('Das Python-Bündel passt nicht zum aktuellen Quellstand.'), {
      code: 'BUNDLE_STAND_ABWEICHEND',
    });
  const vorhanden = (await dateien(pythonBuendelPfad)).filter((p) => p !== 'scriptlab-laufzeit.json');
  if (JSON.stringify(vorhanden) !== JSON.stringify(manifest.dateien.map((d) => d.pfad)))
    throw new Error('Das Python-Bündel enthält fehlende oder zusätzliche Dateien.');
  for (const eintrag of manifest.dateien) {
    const pfad = join(pythonBuendelPfad, eintrag.pfad),
      info = await lstat(pfad);
    if (!info.isFile() || info.size !== eintrag.bytes || (await dateihash(pfad)) !== eintrag.sha256)
      throw new Error(`Die mitgelieferte Python-Datei wurde verändert: ${eintrag.pfad}`);
  }
  return manifest;
}
export async function pythonBuendelVorbereiten() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Das Python-Bündel wird auf Windows x64 vorbereitet.');
  try {
    const m = await pythonBuendelPruefen();
    console.log(`Python ${version}, Tcl/Tk und elf Business-Pakete unverändert geprüft.`);
    return m;
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'BUNDLE_STAND_ABWEICHEND') throw e;
  }
  await mkdir(join(basis, 'quellen'), { recursive: true });
  const herkunft = [];
  for (const [name, url, sha256] of quellen) {
    const pfad = join(basis, 'quellen', name);
    await herunterladen(url, pfad, sha256);
    herkunft.push({ name, url, sha256, signatur: await signaturPruefen(pfad) });
  }
  const stufe = join(basis, 'stufen', randomUUID()),
    ziel = join(stufe, 'python');
  await mkdir(ziel, { recursive: true });
  for (const [name] of quellen.filter((q) => q[0].endsWith('.msi'))) {
    const auspacken = join(stufe, name.slice(0, -4));
    await ausfuehren(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        join(repo, 'scripts', 'msi-dateien-entpacken.ps1'),
        '-Quelle',
        join(basis, 'quellen', name),
        '-Ziel',
        auspacken,
      ],
      { windowsHide: true, timeout: 60000, maxBuffer: 1024 ** 2, env: buildUmgebung },
    );
    for (const pfad of await dateien(auspacken)) {
      if (pfad.startsWith('_cabinet/') || /^quelle-\d+\.cab$/.test(pfad)) continue;
      const von = join(auspacken, pfad),
        nach = join(ziel, pfad);
      await mkdir(dirname(nach), { recursive: true });
      try {
        await cp(von, nach, { errorOnExist: true, force: false });
      } catch (e) {
        if (e.code !== 'ERR_FS_CP_EEXIST' || (await dateihash(von)) !== (await dateihash(nach))) throw e;
      }
    }
  }
  const interpreter = join(ziel, 'python.exe');
  await ausfuehren(interpreter, ['-I', '-B', '-X', 'utf8', '-m', 'ensurepip', '--default-pip'], {
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 1024 ** 2,
  });
  const lock = await lockLesen(),
    wheels = join(basis, 'wheels');
  await mkdir(wheels, { recursive: true });
  const pakete = [];
  for (const pin of lock.pins) {
    const lokal = join(repo, 'artifacts', 'business-runtime', 'wheelhouse');
    let name = (await readdir(lokal).catch(() => [])).filter((n) => wheelPasst(n, pin)).sort()[0];
    if (name) {
      const bytes = await readFile(join(lokal, name));
      if (!pin.hashes.includes(hash(bytes)))
        throw new Error('Ein lokales Wheel stimmt nicht mit der festen Paketliste überein.');
      try {
        await writeFile(join(wheels, name), bytes, { flag: 'wx' });
      } catch (e) {
        if (e.code !== 'EEXIST' || (await dateihash(join(wheels, name))) !== hash(bytes)) throw e;
      }
    } else {
      const r = await fetch(`https://pypi.org/pypi/${pin.name}/${pin.version}/json`, {
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error(`Feste Paketquelle nicht erreichbar: ${pin.name}`);
      const meta = await r.json(),
        file = meta.urls
          .filter((f) => !f.yanked && wheelPasst(f.filename, pin) && pin.hashes.includes(f.digests.sha256))
          .sort((a, b) => a.filename.localeCompare(b.filename))[0];
      if (!file) throw new Error(`Ein freigegebenes CPython-3.15-Wheel fehlt: ${pin.name}`);
      const url = new URL(file.url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'files.pythonhosted.org' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Die Wheelquelle ist nicht zulässig.');
      name = file.filename;
      await herunterladen(url.href, join(wheels, name), file.digests.sha256);
    }
    pakete.push({
      name: pin.name,
      version: pin.version,
      wheel: name,
      sha256: await dateihash(join(wheels, name)),
    });
  }
  await writeFile(join(ziel, 'requirements-business.lock'), lock.bytes);
  await cp(join(repo, 'laufzeit', 'business-notices.md'), join(ziel, 'LIZENZEN-BUSINESS.md'));
  await ausfuehren(
    interpreter,
    [
      '-I',
      '-B',
      '-X',
      'utf8',
      '-m',
      'pip',
      '--isolated',
      'install',
      '--no-index',
      '--require-hashes',
      '--only-binary=:all:',
      '--no-deps',
      '--no-cache-dir',
      '--no-compile',
      '--disable-pip-version-check',
      '--find-links',
      wheels,
      '-r',
      join(ziel, 'requirements-business.lock'),
    ],
    { windowsHide: true, timeout: 180000, maxBuffer: 1024 ** 2 },
  );
  const probe = await ausfuehren(
    interpreter,
    [
      '-I',
      '-B',
      '-X',
      'utf8',
      '-c',
      `import sys,sysconfig,struct,json,os,tkinter,importlib,importlib.metadata
assert sys.version_info[:3] == (3,15,2) and struct.calcsize('P') == 8 and not sysconfig.get_config_var('Py_GIL_DISABLED')
assert os.path.normcase(sys.base_prefix) == os.path.normcase(os.path.dirname(sys.executable)) == os.path.normcase(sys.prefix)
t=tkinter.Tk(); t.withdraw(); t.update_idletasks(); tk=t.tk.call('package','provide','Tk'); t.destroy()
for n in ('duckdb','openpyxl','docx','reportlab','pypdf','et_xmlfile','lxml.etree','typing_extensions','PIL.Image','charset_normalizer','defusedxml'): importlib.import_module(n)
print(json.dumps({'python':sys.version.split()[0],'tk':tk,'isoliert':sys.flags.isolated==1,'utf8':sys.flags.utf8_mode==1}))`,
    ],
    { windowsHide: true, timeout: 30000, maxBuffer: 1024 ** 2 },
  );
  const nachweis = JSON.parse(probe.stdout.trim());
  // pip dient ausschließlich der isolierten Buildvorbereitung, nicht der installierten App.
  const sitePakete = join(ziel, 'Lib', 'site-packages');
  for (const name of await readdir(sitePakete)) {
    if (name !== 'pip' && !/^pip-[0-9.]+\.dist-info$/.test(name)) continue;
    const pfad = resolve(sitePakete, name);
    if (!pfad.startsWith(resolve(ziel) + sep)) throw new Error('Ungültiger Buildwerkzeugpfad.');
    await rm(pfad, { recursive: true, force: true });
  }
  for (const name of await readdir(join(ziel, 'Scripts')).catch(() => [])) {
    if (/^pip(?:3(?:\.15)?)?\.exe$/.test(name)) await rm(join(ziel, 'Scripts', name));
  }
  async function bytecodeEntfernen(ordner) {
    for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
      if (!eintrag.isDirectory()) continue;
      const pfad = resolve(ordner, eintrag.name);
      if (eintrag.name === '__pycache__') {
        if (!pfad.startsWith(resolve(ziel) + sep)) throw new Error('Ungültiger Build-Cachepfad.');
        await rm(pfad, { recursive: true, force: true });
      } else await bytecodeEntfernen(pfad);
    }
  }
  await bytecodeEntfernen(ziel);
  const dateiliste = [];
  for (const pfad of await dateien(ziel)) {
    const info = await stat(join(ziel, pfad));
    dateiliste.push({ pfad, bytes: info.size, sha256: await dateihash(join(ziel, pfad)) });
  }
  const manifest = {
    schemaVersion: 1,
    bereit: true,
    pythonVersion: version,
    architektur: 'x64',
    profil: 'cpython-315-win_amd64',
    erstelltAm: new Date().toISOString(),
    businessLockSha256: lock.hash,
    bauSha256: await bauHash(),
    quellen: herkunft,
    pakete,
    nachweis,
    dateien: dateiliste,
  };
  await writeFile(join(ziel, 'scriptlab-laufzeit.json'), JSON.stringify(manifest, null, 2) + '\n');
  const vorhanden = await stat(pythonBuendelPfad).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return null;
  });
  if (!vorhanden) await rename(ziel, pythonBuendelPfad);
  else {
    const zielWurzel = await realpath(pythonBuendelPfad);
    if (zielWurzel.toLowerCase() !== resolve(repo, 'artifacts', 'python-buendel', 'python').toLowerCase())
      throw new Error('Das feste Buildziel wurde umgeleitet.');
    const manifestPfad = join(zielWurzel, 'scriptlab-laufzeit.json');
    const alt = JSON.parse(await readFile(manifestPfad, 'utf8'));
    // Während des Abgleichs gilt das generierte Bündel ausdrücklich als unvollständig.
    await writeFile(manifestPfad, JSON.stringify({ ...alt, bereit: false }));
    const neuePfade = new Set(dateiliste.map((d) => d.pfad));
    const leereOrdner = new Set();
    for (const eintrag of alt.dateien) {
      if (neuePfade.has(eintrag.pfad)) continue;
      if (
        typeof eintrag.pfad !== 'string' ||
        /[\\:\0]/.test(eintrag.pfad) ||
        eintrag.pfad.split('/').some((t) => !t || t === '.' || t === '..')
      )
        throw new Error('Ungültiger alter Buildpfad.');
      const pfad = resolve(zielWurzel, eintrag.pfad);
      if (!pfad.startsWith(zielWurzel + sep))
        throw new Error('Ein alter Buildpfad verlässt das feste Workspaceziel.');
      const info = await lstat(pfad).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
        return null;
      });
      if (info) {
        if (!info.isFile() || (await realpath(pfad)).toLowerCase() !== pfad.toLowerCase())
          throw new Error('Ein alter Buildpfad ist kein direkter regulärer Dateipfad.');
        await unlink(pfad);
      }
      for (
        let ordner = dirname(pfad);
        ordner !== zielWurzel && ordner.startsWith(zielWurzel + sep);
        ordner = dirname(ordner)
      )
        leereOrdner.add(ordner);
    }
    for (const ordner of [...leereOrdner].sort((a, b) => b.length - a.length)) {
      await rmdir(ordner).catch((e) => {
        if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(e.code)) throw e;
      });
    }
    for (const eintrag of dateiliste) {
      const nach = join(zielWurzel, eintrag.pfad);
      await mkdir(dirname(nach), { recursive: true });
      if (
        !(await realpath(dirname(nach))).toLowerCase().startsWith(zielWurzel.toLowerCase() + sep) &&
        dirname(nach).toLowerCase() !== zielWurzel.toLowerCase()
      )
        throw new Error('Ein Build-Unterordner wurde umgeleitet.');
      const bestehend = await lstat(nach).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
        return null;
      });
      if (bestehend && (!bestehend.isFile() || (await realpath(nach)).toLowerCase() !== nach.toLowerCase()))
        throw new Error('Ein Build-Ziel ist kein direkter regulärer Dateipfad.');
      await copyFile(join(ziel, eintrag.pfad), nach);
    }
    // Erst der vollständige Dateiabgleich veröffentlicht das neue Manifest.
    await writeFile(manifestPfad, JSON.stringify(manifest, null, 2) + '\n');
  }
  await pythonBuendelPruefen();
  console.log(
    `Offline-Bündel fertig: Python ${version}, Tk ${nachweis.tk}, ${pakete.length} Business-Pakete, ${dateiliste.length} Dateien.`,
  );
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumente = process.argv.slice(2);
  if (argumente.length > 1 || argumente.some((a) => !['--vorbereiten', '--pruefen'].includes(a)))
    throw new Error('Erlaubt: --vorbereiten oder --pruefen.');
  if (argumente[0] === '--vorbereiten') await pythonBuendelVorbereiten();
  else {
    const m = await pythonBuendelPruefen();
    console.log(`Offline-Bündel geprüft: CPython ${m.pythonVersion}, ${m.pakete.length} Business-Pakete.`);
  }
}
