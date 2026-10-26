import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Der feste Laufzeit-Host wird ausschließlich für Windows x64 gebaut.');
const wurzel = fileURLToPath(new URL('..', import.meta.url));
async function bauen() {
  const ziel = join(wurzel, 'artifacts', 'native');
  const exe = join(ziel, 'ScriptLab.Testhost.exe');
  const cacheDatei = join(ziel, 'ScriptLab.Testhost.bau.json');
  const source = join(wurzel, 'scripts', 'laufzeit-host.cs');
  const paket = JSON.parse(await readFile(join(wurzel, 'package.json'), 'utf8'));
  const [cs, buildscript] = await Promise.all([readFile(source), readFile(fileURLToPath(import.meta.url))]);
  const quellhash = createHash('sha256')
    .update('laufzeit-host.cs\0')
    .update(cs)
    .update('\0laufzeit-host-bauen.mjs\0')
    .update(buildscript)
    .update('\0paketVersion\0')
    .update(paket.version)
    .digest('hex');
  try {
    const cache = JSON.parse(await readFile(cacheDatei, 'utf8'));
    if (
      cache.schemaVersion === 1 &&
      cache.quellhash === quellhash &&
      cache.paketVersion === paket.version &&
      /^[a-f0-9]{64}$/.test(cache.exeHash) &&
      createHash('sha256')
        .update(await readFile(exe))
        .digest('hex') === cache.exeHash
    ) {
      console.log('Fester Windows-Testhost unverändert und geprüft; Compilerlauf übersprungen.');
      return;
    }
  } catch {
    /* Fehlender oder unvollständiger Cache wird nie als gültiger Build behandelt. */
  }
  const windows = process.env.WINDIR ?? process.env.SystemRoot;
  if (!windows) throw new Error('Das Windows-Verzeichnis konnte nicht bestimmt werden.');
  let compiler;
  for (const ordner of ['Framework64', 'Framework']) {
    const kandidat = join(windows, 'Microsoft.NET', ordner, 'v4.0.30319', 'csc.exe');
    try {
      await access(kandidat);
      compiler = kandidat;
      break;
    } catch {
      /* Nur die festen Windows-Compilerpfade prüfen. */
    }
  }
  if (!compiler)
    throw new Error(
      'Der C#-Compiler des Windows-.NET-Frameworks fehlt. Es werden keine Komponenten automatisch installiert.',
    );
  await mkdir(ziel, { recursive: true });
  const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(paket.version);
  if (!version || version.slice(1).some((n) => Number(n) > 65534))
    throw new Error('Die Paketversion kann nicht als Windows-Dateiversion verwendet werden.');
  const metadaten = join(ziel, 'ScriptLab.Testhost.AssemblyInfo.cs');
  await writeFile(
    metadaten,
    `using System.Reflection;\n[assembly: AssemblyTitle("ScriptLab-Testhost")]\n[assembly: AssemblyCompany("Leon Stolz")]\n[assembly: AssemblyVersion("${version.slice(1).join('.')}.0")]\n[assembly: AssemblyFileVersion("${version.slice(1).join('.')}.0")]\n`,
    'utf8',
  );
  const ausgabe = await promisify(execFile)(
    compiler,
    [
      '/nologo',
      '/target:exe',
      '/platform:x64',
      '/optimize+',
      '/langversion:5',
      '/utf8output',
      `/out:${exe}`,
      source,
      metadaten,
    ],
    { cwd: wurzel, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
  );
  if (ausgabe.stdout.trim()) console.log(ausgabe.stdout.trim());
  await writeFile(
    cacheDatei,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        quellhash,
        paketVersion: paket.version,
        exeHash: createHash('sha256')
          .update(await readFile(exe))
          .digest('hex'),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log('Fester Windows-Testhost gebaut: artifacts/native/ScriptLab.Testhost.exe');
}
await bauen();
