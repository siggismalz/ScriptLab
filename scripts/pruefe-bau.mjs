import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { load } from 'js-yaml';
import { parse, prerelease } from 'semver';
import asar from '@electron/asar';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
// Ein eigener Ausgabeordner erlaubt die Prüfung auch bei gesperrten älteren Builddateien.
if (process.argv.length > 3) throw new Error('Bitte höchstens einen Ausgabeordner angeben.');
const release = resolve(wurzel, process.argv[2] ?? 'release');
const ressourcen = join(release, 'win-unpacked', 'resources');
const archiv = join(ressourcen, 'app.asar');
const paket = JSON.parse(await readFile(join(wurzel, 'package.json'), 'utf8'));
const paketVersion = parse(paket.version);
if (!paketVersion) throw new Error('Die Paketversion ist keine gueltige semantische Version.');
const windowsVersion = `${paketVersion.major}.${paketVersion.minor}.${paketVersion.patch}`;
const metadatenName = `${prerelease(paket.version)?.[0] ?? 'latest'}.yml`;
const fehler = [];
const bericht = {
  schemaVersion: 1,
  erstelltAm: new Date().toISOString(),
  version: paket.version,
  ausgabeordner: relative(wurzel, release).replaceAll('\\', '/'),
  quellstand: null,
  pruefungen: [],
  dateien: [],
  bytevergleiche: [],
  windowsMetadaten: [],
  pruefgrenzen: [
    'Keine Installation, kein Anwendungsstart und keine Ausführung von Nutzerworkflows.',
    'Verglichen wird das vorhandene dist mit win-unpacked. Ein frischer Build aus dem genannten Git-Stand wird dadurch nicht belegt.',
    'Der im NSIS-Installer eingebettete Anwendungspayload wird nicht entpackt. Seine Identität mit win-unpacked wird hier nicht unabhängig nachgewiesen.',
    `Blockmap-Struktur und Größenabdeckung werden geprüft; die einzelnen Blockmap-Chunk-Prüfsummen werden nicht unabhängig nachgerechnet. Der vollständige Installer wird gegen SHA-512 aus ${metadatenName} geprüft.`,
    'Es werden weder Desktoptestergebnisse noch eine produktive Updatekette aus anderen Berichten übernommen.',
  ],
};

function verlangen(bedingung, meldung) {
  if (!bedingung) throw new Error(meldung);
}

async function pruefen(name, aufgabe) {
  try {
    const details = await aufgabe();
    bericht.pruefungen.push({
      name,
      bestanden: details?.offen ? null : true,
      ...(details ? { details } : {}),
    });
  } catch (e) {
    const meldung = e instanceof Error ? e.message : String(e);
    fehler.push({ name, meldung });
    bericht.pruefungen.push({ name, bestanden: false, meldung });
  }
}

function relativ(pfad) {
  return relative(wurzel, pfad).replaceAll('\\', '/');
}

function windowsVersionPasst(wert) {
  // Windows-Ressourcen koennen vier numerische Teile statt der Semver-Schreibweise enthalten.
  return /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(wert) && wert.split('.').slice(0, 3).join('.') === windowsVersion;
}

async function dateiMessen(pfad) {
  const sha256 = createHash('sha256');
  const sha512 = createHash('sha512');
  let bytes = 0;
  for await (const teil of createReadStream(pfad)) {
    bytes += teil.length;
    sha256.update(teil);
    sha512.update(teil);
  }
  verlangen(bytes > 0, `${relativ(pfad)} ist leer.`);
  const ergebnis = {
    pfad: relativ(pfad),
    bytes,
    sha256: sha256.digest('hex'),
    sha512: sha512.digest('base64'),
  };
  bericht.dateien.push(ergebnis);
  return ergebnis;
}

async function dateienSammeln(ordner, praefix = '') {
  const dateien = [];
  for (const eintrag of await readdir(join(ordner, praefix), { withFileTypes: true })) {
    const pfad = join(praefix, eintrag.name);
    if (eintrag.isDirectory()) dateien.push(...(await dateienSammeln(ordner, pfad)));
    else {
      verlangen(eintrag.isFile(), `Nicht unterstützter Dateieintrag: ${relativ(join(ordner, pfad))}`);
      dateien.push(pfad.replaceAll('\\', '/'));
    }
  }
  return dateien.sort();
}

async function byteVergleichen(quelle, ziel, gepackt = false) {
  const original = await readFile(quelle);
  const enthalten = gepackt ? asar.extractFile(archiv, ziel.replaceAll('/', sep)) : await readFile(ziel);
  const gleich = original.equals(enthalten);
  bericht.bytevergleiche.push({
    quelle: relativ(quelle),
    ziel: gepackt ? `${relativ(archiv)}!/${ziel}` : relativ(ziel),
    bytes: enthalten.length,
    sha256Quelle: createHash('sha256').update(original).digest('hex'),
    sha256Paket: createHash('sha256').update(enthalten).digest('hex'),
    identisch: gleich,
  });
  verlangen(gleich, `${relativ(quelle)} stimmt nicht mit dem Paketinhalt überein.`);
}

function windowsMetadatenLesen(pfad) {
  if (process.platform !== 'win32')
    return { pfad: relativ(pfad), geprueft: false, grund: 'Windows ist nicht verfügbar.' };
  try {
    const systemOrdner = process.env.SystemRoot ?? 'C:\\Windows';
    const powershell = join(systemOrdner, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    // Ein Start aus PowerShell 7 darf keine inkompatiblen Module an Windows PowerShell vererben.
    const umgebung = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath'),
    );
    umgebung.PSModulePath = join(systemOrdner, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
    // Fester lesender Windows-Aufruf; der Dateipfad ist ein Umgebungswert, kein PowerShell-Code.
    const ausgabe = execFileSync(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$datei = Get-Item -LiteralPath $env:SCRIPTLAB_PRUEF_DATEI
$signatur = Get-AuthenticodeSignature -LiteralPath $datei.FullName
$zertifikat = $signatur.SignerCertificate
[ordered]@{
  produkt = $datei.VersionInfo.ProductName
  produktVersion = $datei.VersionInfo.ProductVersion
  dateiVersion = $datei.VersionInfo.FileVersion
  firma = $datei.VersionInfo.CompanyName
  signaturStatus = [string]$signatur.Status
  zertifikat = if ($zertifikat) { [ordered]@{
    fingerabdruck = $zertifikat.Thumbprint
    gueltigAb = $zertifikat.NotBefore.ToUniversalTime().ToString('o')
    gueltigBis = $zertifikat.NotAfter.ToUniversalTime().ToString('o')
  } } else { $null }
} | ConvertTo-Json -Depth 4 -Compress`,
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
        env: { ...umgebung, SCRIPTLAB_PRUEF_DATEI: pfad },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return { pfad: relativ(pfad), geprueft: true, ...JSON.parse(ausgabe.replace(/^\uFEFF/, '')) };
  } catch {
    return {
      pfad: relativ(pfad),
      geprueft: false,
      grund: 'Windows-Dateimetadaten oder Authenticode konnten nicht lesend abgefragt werden.',
    };
  }
}

await pruefen('Git-Stand', () => {
  const git = (...argumente) =>
    execFileSync('git', ['-C', wurzel, ...argumente], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  bericht.quellstand = {
    head: git('rev-parse', 'HEAD'),
    unveroeffentlichteAenderungen: Boolean(status),
    status: status ? status.split(/\r?\n/) : [],
    einordnung: status ? 'Arbeitsstand mit nicht eingecheckten Änderungen.' : 'Sauberer Git-Arbeitsstand.',
  };
});

let installer;
await pruefen('NSIS-Installer und Update-Metadaten', async () => {
  const installerName = `ScriptLab-${paket.version}-Setup-x64.exe`;
  const namen = (await readdir(release)).filter((name) => name.toLowerCase().endsWith('.exe')).sort();
  for (const name of namen) {
    const gemessen = await dateiMessen(join(release, name));
    if (name === installerName) installer = gemessen;
  }
  verlangen(
    namen.length === 1 && namen[0] === installerName,
    'release muss genau den Installer der aktuellen Paketversion enthalten.',
  );
  const metadaten = load(await readFile(join(release, metadatenName), 'utf8'));
  await dateiMessen(join(release, metadatenName));
  verlangen(
    metadaten?.version === paket.version,
    `Die Version in ${metadatenName} passt nicht zur Paketversion.`,
  );
  verlangen(metadaten.path === installerName, `Der Installerpfad in ${metadatenName} stimmt nicht.`);
  verlangen(
    metadaten.sha512 === installer.sha512,
    `SHA-512 in ${metadatenName} stimmt nicht mit dem Installer überein.`,
  );
  verlangen(
    Array.isArray(metadaten.files) && metadaten.files.length === 1,
    `${metadatenName} muss genau einen Windows-x64-Installer beschreiben.`,
  );
  const eintrag = metadaten.files[0];
  verlangen(
    eintrag.url === installerName && basename(eintrag.url) === eintrag.url,
    `Der Downloadname in ${metadatenName} stimmt nicht.`,
  );
  verlangen(eintrag.size === installer.bytes, `Die Installergröße in ${metadatenName} stimmt nicht.`);
  verlangen(eintrag.sha512 === installer.sha512, `Die Download-Prüfsumme in ${metadatenName} stimmt nicht.`);
  return {
    metadatenDatei: metadatenName,
    version: metadaten.version,
    bytes: installer.bytes,
    sha512Passt: true,
  };
});

await pruefen('Blockmap', async () => {
  verlangen(installer, 'Der aktuelle Installer fehlt.');
  const pfad = join(wurzel, `${installer.pfad}.blockmap`);
  await dateiMessen(pfad);
  const blockmap = JSON.parse(
    gunzipSync(await readFile(pfad), { maxOutputLength: 16 * 1024 * 1024 }).toString('utf8'),
  );
  verlangen(
    blockmap.version === '2' && Array.isArray(blockmap.files) && blockmap.files.length === 1,
    'Die NSIS-Blockmap hat kein unterstütztes Format.',
  );
  const datei = blockmap.files[0];
  verlangen(
    datei.name === 'file' && datei.offset === 0,
    'Die Blockmap beschreibt nicht den vollständigen Installer ab Byte 0.',
  );
  verlangen(
    Array.isArray(datei.sizes) &&
      Array.isArray(datei.checksums) &&
      datei.sizes.length > 0 &&
      datei.sizes.length === datei.checksums.length,
    'Die Blockmap enthält unvollständige Chunks.',
  );
  verlangen(
    datei.sizes.every((n) => Number.isSafeInteger(n) && n > 0),
    'Eine Chunkgröße in der Blockmap ist ungültig.',
  );
  verlangen(
    datei.checksums.every((s) => typeof s === 'string' && /^[A-Za-z0-9+/]{24}$/.test(s)),
    'Eine Chunk-Prüfsumme in der Blockmap hat ein ungültiges Format.',
  );
  const bytes = datei.sizes.reduce((summe, n) => summe + n, 0);
  verlangen(bytes === installer.bytes, 'Die Blockmap deckt nicht genau die Installergröße ab.');
  return { version: blockmap.version, chunks: datei.sizes.length, abgedeckteBytes: bytes };
});

await pruefen('Gepackter Renderer, Hauptprozess und Preload', async () => {
  await dateiMessen(archiv);
  const gebaut = (await dateienSammeln(join(wurzel, 'dist'))).map((pfad) => `dist/${pfad}`);
  for (const pfad of ['dist/renderer/index.html', 'dist/main/hauptprozess.cjs', 'dist/main/preload.cjs'])
    verlangen(gebaut.includes(pfad), `Erforderliche Builddatei fehlt: ${pfad}`);
  const gepackt = asar
    .listPackage(archiv)
    .map((pfad) => pfad.replaceAll('\\', '/').replace(/^\/+/, ''))
    .filter(
      (pfad) =>
        pfad.startsWith('dist/') && typeof asar.statFile(archiv, pfad.replaceAll('/', sep)).size === 'number',
    )
    .sort();
  verlangen(
    JSON.stringify(gebaut) === JSON.stringify(gepackt),
    'Die Dateiliste von dist und app.asar unterscheidet sich.',
  );
  for (const pfad of gebaut) await byteVergleichen(join(wurzel, pfad), pfad, true);
  return { dateien: gebaut.length, alleBytegleich: true };
});

await pruefen('Paketversion und Entwicklerangabe', () => {
  const enthalten = JSON.parse(asar.extractFile(archiv, 'package.json').toString('utf8'));
  for (const feld of ['name', 'productName', 'version', 'author', 'main', 'description'])
    verlangen(
      enthalten[feld] === paket[feld],
      `Paketangabe „${feld}“ stimmt nicht mit package.json überein.`,
    );
  verlangen(enthalten.author === 'Leon Stolz', 'Die Entwicklerangabe fehlt im gepackten Paket.');
  return { version: enthalten.version, autor: enthalten.author, einstieg: enthalten.main };
});

await pruefen('Beispiele und Windows-Helfer', async () => {
  const dateien = await dateienSammeln(join(wurzel, 'beispiele'));
  verlangen(
    JSON.stringify(dateien) ===
      JSON.stringify([
        '01-Begruessung.scriptlab',
        '02-Datei-Backup.scriptlab',
        '03-Dateinamenliste.scriptlab',
      ]),
    'Die drei festen Beispielprojekte fehlen oder es liegen zusätzliche Beispiele vor.',
  );
  verlangen(
    JSON.stringify(dateien) === JSON.stringify(await dateienSammeln(join(ressourcen, 'beispiele'))),
    'Die Liste der gepackten Beispiele stimmt nicht.',
  );
  for (const pfad of dateien)
    await byteVergleichen(join(wurzel, 'beispiele', pfad), join(ressourcen, 'beispiele', pfad));
  await byteVergleichen(
    join(wurzel, 'scripts', 'signatur-helper.ps1'),
    join(ressourcen, 'signatur-helper.ps1'),
  );
  await byteVergleichen(
    join(wurzel, 'artifacts/native/ScriptLab.Testhost.exe'),
    join(ressourcen, 'ScriptLab.Testhost.exe'),
  );
});

await pruefen('Dokumentation und Lizenzhinweise', async () => {
  for (const name of ['README.md', 'THIRD_PARTY_NOTICES.md'])
    await byteVergleichen(join(wurzel, name), join(ressourcen, name));
  // electron-builder schliesst extraResources beim Packen aus app.asar aus.
  // Die Lizenzbeilage wird deshalb am tatsaechlich ausgelieferten Ressourcenort verglichen.
  const dokumente = (await readdir(join(wurzel, 'docs'))).filter((name) => name.endsWith('.md')).sort();
  verlangen(
    JSON.stringify(dokumente) === JSON.stringify((await dateienSammeln(join(ressourcen, 'docs'))).sort()),
    'Die Dokumentationsbeilagen sind nicht vollständig oder veraltet.',
  );
  for (const name of dokumente)
    await byteVergleichen(join(wurzel, 'docs', name), join(ressourcen, 'docs', name));
});

await pruefen('Updatequelle', async () => {
  const konfiguration = load(await readFile(join(ressourcen, 'app-update.yml'), 'utf8'));
  const bau = load(await readFile(join(wurzel, 'electron-builder.yml'), 'utf8'));
  for (const feld of ['provider', 'owner', 'repo', 'private'])
    verlangen(
      konfiguration?.[feld] === bau.publish?.[feld],
      `Die Updateangabe „${feld}“ stimmt nicht mit electron-builder.yml überein.`,
    );
  verlangen(!('token' in konfiguration), 'Ein Token darf nicht in app-update.yml ausgeliefert werden.');
  bericht.updatequelle = Object.fromEntries(
    ['provider', 'owner', 'repo', 'private', 'publisherName', 'updaterCacheDirName']
      .filter((feld) => konfiguration[feld] !== undefined)
      .map((feld) => [feld, konfiguration[feld]]),
  );
  if (!konfiguration.publisherName)
    bericht.pruefgrenzen.push(
      'Im Paket fehlt publisherName. Eine für produktive Updates geeignete Herausgeber-Signaturkonfiguration ist damit nicht belegt.',
    );
});

for (const pfad of [
  join(release, `ScriptLab-${paket.version}-Setup-x64.exe`),
  join(release, 'win-unpacked', 'ScriptLab.exe'),
  join(ressourcen, 'ScriptLab.Testhost.exe'),
]) {
  await pruefen(`Windows-Metadaten: ${basename(pfad)}`, async () => {
    verlangen((await stat(pfad)).isFile(), 'Die Windows-Anwendungsdatei fehlt.');
    const metadaten = windowsMetadatenLesen(pfad);
    bericht.windowsMetadaten.push(metadaten);
    if (!metadaten.geprueft) {
      bericht.pruefgrenzen.push(`${relativ(pfad)}: ${metadaten.grund}`);
      return { offen: true, windowsPruefung: 'nicht möglich' };
    }
    verlangen(
      metadaten.produkt === paket.productName && metadaten.firma === paket.author,
      'Windows-Produktname oder Entwicklerangabe stimmt nicht.',
    );
    verlangen(
      (metadaten.produktVersion === paket.version || windowsVersionPasst(metadaten.produktVersion)) &&
        windowsVersionPasst(metadaten.dateiVersion),
      'Die Windows-Dateiversion stimmt nicht mit der Paketversion überein.',
    );
    verlangen(
      metadaten.signaturStatus !== 'HashMismatch',
      'Windows meldet eine nachträglich veränderte signierte Datei.',
    );
    if (metadaten.signaturStatus !== 'Valid')
      bericht.pruefgrenzen.push(
        `${relativ(pfad)}: Authenticode-Status ${metadaten.signaturStatus}; kein Nachweis einer gültigen vertrauenswürdigen Anwendungssignatur.`,
      );
    return { signaturStatus: metadaten.signaturStatus, produktVersion: metadaten.produktVersion };
  });
}

bericht.bestanden = fehler.length === 0;
bericht.offenePruefungen = bericht.pruefungen.filter((p) => p.bestanden === null).length;
bericht.fehler = fehler;
await mkdir(release, { recursive: true });
await writeFile(join(release, 'pruefung.json'), `${JSON.stringify(bericht, null, 2)}\n`, 'utf8');
console.log(
  `${bericht.pruefungen.filter((p) => p.bestanden).length} Paketprüfungen bestanden, ${bericht.offenePruefungen} offen, ${fehler.length} fehlgeschlagen. Bericht: ${relativ(join(release, 'pruefung.json'))}`,
);
for (const eintrag of fehler) console.error(`${eintrag.name}: ${eintrag.meldung}`);
process.exitCode = bericht.bestanden ? 0 : 1;
