import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { resolve, join } from 'node:path';

// Wartungswerkzeug: ausschließlich diese festen CPU-Pins, keine Argumente für Paketnamen oder URLs.
if (process.argv.slice(2).some((x) => x !== '--herunterladen')) throw Error('Unbekannte Option.');
const fest = [
  ['torch', '2.15.0+cpu', 'torch'],
  ['numpy', '2.5.4', 'numpy'],
  ['scipy', '1.18.1', 'scipy'],
  ['scikit-learn', '1.9.1', 'sklearn'],
  ['skops', '0.16.0', 'skops.io'],
  ['joblib', '1.6.0', 'joblib'],
  ['cloudpickle', '3.1.2', 'cloudpickle'],
  ['narwhals', '2.28.0', 'narwhals'],
  ['threadpoolctl', '3.7.0', 'threadpoolctl'],
  ['packaging', '26.3', 'packaging'],
  ['prettytable', '3.18.0', 'prettytable'],
  ['wcwidth', '0.9.4', 'wcwidth'],
  ['filelock', '4.2.5', 'filelock'],
  ['setuptools', '84.2.1', 'setuptools'],
  ['sympy', '1.14.0', 'sympy'],
  ['mpmath', '1.3.0', 'mpmath'],
  ['networkx', '3.7', 'networkx'],
  ['jinja2', '3.1.6', 'jinja2'],
  ['markupsafe', '3.0.4', 'markupsafe'],
  ['fsspec', '2026.9.0', 'fsspec'],
  ['typing-extensions', '4.16.0', 'typing_extensions'],
];
const pins = [];
for (const [name, version, modul] of fest) {
  let quelle;
  if (name === 'torch') {
    const index = await (await fetch('https://download.pytorch.org/whl/cpu/torch/')).text();
    const zeile = index.split('\n').find((x) => x.includes('torch-2.15.0%2Bcpu-cp315-cp315-win_amd64.whl'));
    if (!zeile) throw Error('Das feste CPU-Torch-Wheel fehlt.');
    const u = new URL(zeile.match(/href="([^"]+)"/)[1]);
    const sha256 = u.hash.slice('#sha256='.length);
    u.hash = '';
    const r = await fetch(u, { method: 'HEAD', redirect: 'error' });
    if (!r.ok || !/^[a-f0-9]{64}$/.test(sha256)) throw Error('Ungültige CPU-Wheelquelle.');
    quelle = {
      wheel: decodeURIComponent(u.pathname.split('/').at(-1)),
      url: u.href,
      sha256,
      bytes: Number(r.headers.get('content-length')),
    };
  } else {
    const r = await fetch(`https://pypi.org/pypi/${name}/${version}/json`, { redirect: 'error' });
    if (!r.ok) throw Error(`Der feste Pin fehlt: ${name} ${version}`);
    const p = await r.json();
    const f =
      p.urls.find((x) => !x.yanked && /-cp315-cp315-win_amd64\.whl$/.test(x.filename)) ??
      p.urls.find((x) => !x.yanked && /-cp3\d+-abi3-win_amd64\.whl$/.test(x.filename)) ??
      p.urls.find((x) => !x.yanked && /-py(?:2\.py3|3)-none-any\.whl$/.test(x.filename));
    if (!f) throw Error(`Kein festes Windows-x64-Wheel: ${name}`);
    quelle = { wheel: f.filename, url: f.url, sha256: f.digests.sha256, bytes: f.size };
  }
  if (!Number.isSafeInteger(quelle.bytes) || quelle.bytes <= 0) throw Error('Ungültige Wheelgröße.');
  pins.push({ name, version, modul, ...quelle });
}
const lock =
  '# Festes optionales CPU-ML-Profil, ausschließlich Windows x64 / CPython 3.15.\n' +
  pins.map((p) => `${p.name}==${p.version} --hash=sha256:${p.sha256}`).join('\n') +
  '\n';
const profil = {
  schemaVersion: 1,
  profil: 'scriptlab-ml-cpu-cp315-x64-v1',
  pythonVersion: '3.15.2',
  lockSha256: createHash('sha256').update(lock).digest('hex'),
  pakete: pins,
};
await writeFile(resolve('laufzeit/ml-profil.json'), JSON.stringify(profil, null, 2) + '\n');
await writeFile(resolve('laufzeit/requirements-ml.lock'), lock);
await writeFile(
  resolve('laufzeit/requirements-ml.in'),
  '# Alle transitiven CPU-Pins sind bewusst festgelegt. Kein CUDA, kein automatischer Resolver.\n' +
    pins.map((p) => `${p.name}==${p.version}`).join('\n') +
    '\n',
);
if (process.argv.includes('--herunterladen')) {
  const cache = resolve('artifacts/ml/wheels');
  await mkdir(cache, { recursive: true });
  for (const p of pins) {
    const ziel = join(cache, p.wheel);
    try {
      const b = await readFile(ziel);
      if (b.length === p.bytes && createHash('sha256').update(b).digest('hex') === p.sha256) continue;
      throw Error('Abweichender Cacheinhalt.');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const r = await fetch(p.url, { redirect: 'error', signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw Error(`Download fehlgeschlagen: ${p.name}`);
    let bytes = 0;
    const h = createHash('sha256');
    await pipeline(
      r.body,
      new Transform({
        transform(b, _e, fertig) {
          bytes += b.length;
          h.update(b);
          fertig(bytes > p.bytes ? Error('Wheel größer als festgelegt.') : null, b);
        },
      }),
      createWriteStream(ziel, { flags: 'wx' }),
    );
    if (bytes !== p.bytes || h.digest('hex') !== p.sha256) throw Error(`Falscher Wheelinhalt: ${p.name}`);
    console.log(`${p.name} ${p.version}: ${bytes} Bytes geprüft.`);
  }
}
console.log(`${pins.length} feste CPU-Pins, Lock ${profil.lockSha256}.`);
