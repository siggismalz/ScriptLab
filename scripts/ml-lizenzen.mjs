import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (process.argv.length > 2) throw Error('Dieses feste Wartungswerkzeug akzeptiert keine Argumente.');
const profil = JSON.parse(await readFile('laufzeit/ml-profil.json', 'utf8'));
const code = String.raw`import sys,json,zipfile,hashlib,pathlib
profil=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
ausgabe=[]
for p in profil['pakete']:
    pfad=pathlib.Path(sys.argv[2])/p['wheel']
    assert pfad.stat().st_size==p['bytes'] and hashlib.sha256(pfad.read_bytes()).hexdigest()==p['sha256']
    lizenzen=[]
    with zipfile.ZipFile(pfad) as z:
        for i in z.infolist():
            name=pathlib.PurePosixPath(i.filename).name.lower()
            if i.is_dir() or not (name.startswith(('license','licence','copying','copyright','notice')) or '/licenses/' in i.filename.lower()): continue
            assert i.file_size<4*1024*1024
            b=z.read(i); text=b.decode('utf-8-sig')
            lizenzen.append({'datei':i.filename,'sha256':hashlib.sha256(b).hexdigest(),'text':text})
    assert lizenzen, p['name']
    ausgabe.append({'name':p['name'],'version':p['version'],'quelle':p['url'],'wheelhash':p['sha256'],'lizenzen':lizenzen})
print(json.dumps(ausgabe,ensure_ascii=True))`;
const r = spawnSync(
  resolve('artifacts/python-buendel/python/python.exe'),
  ['-I', '-B', '-X', 'utf8', '-c', code, resolve('laufzeit/ml-profil.json'), resolve('artifacts/ml/wheels')],
  { windowsHide: true, shell: false, encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 ** 2 },
);
if (r.error) throw r.error;
if (r.status !== 0) throw Error(r.stderr);
const daten = JSON.parse(r.stdout);
let text =
  '# Lizenzbeilagen des optionalen CPU-ML-Profils\n\nScriptLab · Entwickelt von Leon Stolz. Eigener Code: LICENSE.txt; die folgenden Originaltexte gehören den genannten Drittanbietern. Vollständig aus den fest hashgeprüften Wheels übernommen, einschließlich eingebundener Bibliotheken. Keine Laufzeitinstallation durch dieses Dokument.\n\nErzeugung: `node scripts/ml-lizenzen.mjs`, aus `ml-profil.json` und dem festen Wheelcache.\n';
for (const p of daten) {
  text += `\n## ${p.name} ${p.version}\n\nQuelle: ${p.quelle}\n\nWheel-SHA-256: ${p.wheelhash}\n`;
  for (const l of p.lizenzen) {
    const zaun = '`'.repeat(Math.max(3, ...(l.text.match(/`+/g) ?? []).map((x) => x.length + 1)));
    text += `\n### ${l.datei}\n\nSHA-256: ${l.sha256}\n\n${zaun}text\n${l.text.trimEnd()}\n${zaun}\n`;
  }
}
await writeFile('laufzeit/ml-notices.md', text, 'utf8');
console.log(
  `${daten.length} Pakete, ${daten.reduce((s, p) => s + p.lizenzen.length, 0)} vollständige Lizenzdateien, ${Buffer.byteLength(text)} Bytes.`,
);
