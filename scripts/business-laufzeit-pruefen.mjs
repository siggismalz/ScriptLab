import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Entwicklungs-/IT-Prüfung, kein Installer und kein allgemeiner Paketmanager.
const wurzel = fileURLToPath(new URL('..', import.meta.url));
const parameter = process.argv.slice(2);
if (
  parameter.some(
    (p) => !['--download', '--alle-profile'].includes(p) && !/^--profil=3\.(12|13|14|15)$/.test(p),
  )
)
  throw new Error('Erlaubt: --download, --alle-profile oder --profil=3.12 bis 3.15.');
const profile = parameter.includes('--alle-profile')
  ? ['cp312', 'cp313', 'cp314', 'cp315']
  : [`cp${(parameter.find((p) => p.startsWith('--profil='))?.slice(9) ?? '3.12').replace('.', '')}`];
const download = parameter.includes('--download');
const ausgabe = join(wurzel, 'artifacts', 'business-runtime'),
  wheelhouse = join(ausgabe, 'wheelhouse');
const bytes = await readFile(join(wurzel, 'laufzeit', 'requirements-business.lock'));
const pins = bytes
  .toString('utf8')
  .replace(/\\\r?\n/g, ' ')
  .split(/\r?\n/)
  .map((z) => z.trim())
  .filter((z) => z && !z.startsWith('#'))
  .map((z) => {
    const m = /^([a-z0-9-]+)==(\d+\.\d+(?:\.\d+)?)\s+((?:--hash=sha256:[a-f0-9]{64}\s*)+)$/.exec(z);
    if (!m) throw new Error('Ungültiger Eintrag in der festen Business-Lockdatei.');
    return {
      name: m[1],
      version: m[2],
      hashes: [...m[3].matchAll(/sha256:([a-f0-9]{64})/g)].map((t) => t[1]),
    };
  });
const erwartet = [
  'duckdb',
  'openpyxl',
  'python-docx',
  'reportlab',
  'pypdf',
  'et-xmlfile',
  'lxml',
  'typing-extensions',
  'pillow',
  'charset-normalizer',
  'defusedxml',
];
if (
  pins.length !== erwartet.length ||
  new Set(pins.map((p) => p.name)).size !== pins.length ||
  pins.some((p) => !erwartet.includes(p.name))
)
  throw new Error('Die Lockdatei entspricht nicht dem festen Paketsatz.');
function passt(name, pin, profil) {
  const anfang = `${pin.name.replaceAll('-', '_')}-${pin.version}-`;
  if (basename(name) !== name || !name.startsWith(anfang)) return false;
  const ende = name.slice(anfang.length),
    abi = /^(cp3\d+)-abi3-win_amd64\.whl$/.exec(ende);
  return (
    /^py(?:2\.py3|3)-none-any\.whl$/.test(ende) ||
    ende === `${profil}-${profil}-win_amd64.whl` ||
    (!!abi && Number(abi[1].slice(2)) <= Number(profil.slice(2)))
  );
}
const hash = (daten) => createHash('sha256').update(daten).digest('hex');
await mkdir(wheelhouse, { recursive: true });
const nachweise = [];
for (const pin of pins) {
  let dateien;
  if (download) {
    const r = await fetch(`https://pypi.org/pypi/${pin.name}/${pin.version}/json`, {
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
    if (!r.ok) throw new Error(`PyPI-Angaben für ${pin.name} fehlen.`);
    const j = await r.json();
    dateien = j.urls.filter((f) => !f.yanked && pin.hashes.includes(f.digests.sha256));
  } else dateien = (await readdir(wheelhouse)).map((filename) => ({ filename }));
  for (const profil of profile) {
    const datei = dateien
      .filter((f) => passt(f.filename, pin, profil))
      .sort(
        (a, b) =>
          Number(!a.filename.includes('none-any')) - Number(!b.filename.includes('none-any')) ||
          a.filename.localeCompare(b.filename),
      )[0];
    if (!datei) throw new Error(`${pin.name} ${pin.version}: kein freigegebenes Wheel für ${profil}.`);
    const ziel = join(wheelhouse, datei.filename);
    let inhalt = await readFile(ziel).catch(() => null);
    if (!inhalt && download) {
      const url = new URL(datei.url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'files.pythonhosted.org' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        datei.size > 100 * 1024 * 1024
      )
        throw new Error('Unzulässige Paketquelle.');
      const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Wheel für ${pin.name} nicht verfügbar.`);
      inhalt = Buffer.from(await r.arrayBuffer());
      if (
        inhalt.length !== datei.size ||
        inhalt.length > 100 * 1024 * 1024 ||
        !pin.hashes.includes(hash(inhalt))
      )
        throw new Error(`Falsche Prüfsumme für ${pin.name}.`);
      await writeFile(ziel, inhalt, { flag: 'wx' });
    }
    if (!inhalt || !pin.hashes.includes(hash(inhalt)))
      throw new Error(`Lokales Wheel für ${pin.name} hat eine falsche Prüfsumme.`);
    nachweise.push({
      paket: pin.name,
      version: pin.version,
      profil,
      datei: datei.filename,
      bytes: inhalt.length,
      sha256: hash(inhalt),
    });
  }
}
const bericht = {
  geprueftAm: new Date().toISOString(),
  lockSha256: hash(bytes),
  quelle: download
    ? 'Offizielle feste PyPI-Versionsmetadaten und Hashdownload'
    : 'Nur vorhandenes lokales Wheelhouse, kein Netzwerk',
  profile,
  pakete: pins.length,
  wheels: nachweise,
  grenzen: [
    'Diese Prüfung startet keinen Interpreter und installiert keine Pakete.',
    'Vorhandene Wheels belegen die Verfügbarkeit des Profils, keine praktische Laufzeitprüfung aller Python-Versionen.',
  ],
};
await writeFile(join(ausgabe, 'wheelhouse-pruefung.json'), JSON.stringify(bericht, null, 2));
console.log(
  `${pins.length} feste Pakete für ${profile.join(', ')} hashgeprüft; ${new Set(nachweise.map((n) => n.datei)).size} Wheeldateien. Keine Installation.`,
);
