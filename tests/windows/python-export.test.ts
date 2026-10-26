import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { dirname, basename, join, resolve, win32 } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { neuesProjekt, type EditorBlock } from '../../src/kern/projekt';
import { pythonErzeugen } from '../../src/kern/python-generator';
import { pythonKandidatenSuchen, pythonPruefen } from '../../src/windows/python';
import type { PythonInstallation } from '../../src/gemeinsam/python';

const freigegeben =
  process.platform === 'win32' && process.arch === 'x64' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');
const inhalt = 'Export unabhängig ä 😀\r\nZweite Zeile';
const ausgabetext = 'Eigenständig ä 😀';
let nummer = 0;
function text(TEXT: string): EditorBlock {
  return { type: 'sl_text', id: `export_text_${++nummer}`, fields: { TEXT } };
}
function exportErzeugen(): string {
  const projekt = neuesProjekt('python');
  projekt.editor.blocks!.blocks[0].next = {
    block: {
      type: 'sl_write_text',
      id: 'schreiben',
      fields: { KODIERUNG: 'UTF8' },
      inputs: { PFAD: { block: text('Ergebnis ä.txt') }, TEXT: { block: text(inhalt) } },
      next: { block: { type: 'sl_output', id: 'ausgabe', inputs: { TEXT: { block: text(ausgabetext) } } } },
    },
  };
  const ergebnis = pythonErzeugen(projekt, { modus: 'export' });
  expect(ergebnis.code, JSON.stringify(ergebnis.meldungen)).not.toBeNull();
  expect(ergebnis.code).not.toContain('--scriptlab-');
  expect(ergebnis.code).not.toContain('SLFEHLER|');
  return ergebnis.code!;
}

// Der äußere feste Job ist nur das begrenzte QA-Gerüst. Sein echtes Exportkind erhält KEINE Editorflags.
const exportHarness = `import json, os, pathlib, subprocess, sys
basis = pathlib.Path(sys.argv[sys.argv.index('--scriptlab-basis') + 1])
auftrag = json.loads((basis / 'Fester Auftrag.json').read_text(encoding='utf-8'))
export = basis / 'Scriptordner ä' / 'Eigenständiger Export.py'
anderer_ordner = basis / 'Anderes Arbeitsverzeichnis'
befehl = [auftrag['interpreter'], str(export)]
umgebung = {name: wert for name, wert in os.environ.items() if not name.upper().startswith('PYTHON')}
try:
    ergebnis = subprocess.run(befehl, cwd=anderer_ordner, env=umgebung, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3, check=False)
except subprocess.TimeoutExpired:
    raise RuntimeError('Das eigenständige Exportkind hat seine feste Prüffrist überschritten.')
print(json.dumps({'code': ergebnis.returncode, 'stdout': ergebnis.stdout.decode('utf-8'),
    'stderr': ergebnis.stderr.decode('utf-8'), 'befehl': befehl, 'cwd': str(anderer_ordner),
    'interpreter': sys.executable, 'version': sys.version.split()[0],
    'venv': sys.prefix != sys.base_prefix}, ensure_ascii=False), flush=True)
`;
interface Ergebnis {
  code: number;
  stdout: string;
  stderr: string;
  befehl: string[];
  cwd: string;
  interpreter: string;
  version: string;
  venv: boolean;
}

describe.skipIf(!freigegeben)('Eigenständiger Python-Export und vorhandener venv unter Windows', () => {
  let ordner: string, basis: string, technisch: string, installation: PythonInstallation;
  let aktiv: { prozess: ChildProcessWithoutNullStreams; geschlossen: Promise<void> } | null = null;
  async function appGeschlossenPruefen(): Promise<void> {
    const windows = process.env.SystemRoot ?? 'C:\\Windows';
    const shell = win32.join(windows, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const code =
      '@(Get-Process -Name electron,ScriptLab -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "ScriptLab" -or ($_.Path -and $_.Path.StartsWith($env:SCRIPTLAB_EXPORT_TEST_WURZEL,[StringComparison]::OrdinalIgnoreCase)) }).Count';
    const gelesen = await promisify(execFile)(
      shell,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', code],
      {
        windowsHide: true,
        timeout: 4000,
        maxBuffer: 8192,
        encoding: 'utf8',
        cwd: windows,
        env: {
          ...process.env,
          SCRIPTLAB_EXPORT_TEST_WURZEL: resolve('.'),
          PSModulePath: win32.join(windows, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules'),
        },
      },
    );
    expect(
      Number(gelesen.stdout.trim()),
      'Vor der unabhängigen Exportprüfung muss ScriptLab geschlossen sein.',
    ).toBe(0);
  }
  beforeAll(async () => {
    await appGeschlossenPruefen();
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Pythonexport-'));
    basis = join(ordner, 'Prüfbasis');
    technisch = join(ordner, 'Technisch');
    await mkdir(join(basis, 'Scriptordner ä'), { recursive: true });
    await mkdir(join(basis, 'Anderes Arbeitsverzeichnis'));
    await mkdir(technisch);
    const kandidaten = process.env.SCRIPTLAB_TEST_PYTHON
      ? [{ pfad: process.env.SCRIPTLAB_TEST_PYTHON }]
      : await pythonKandidatenSuchen();
    for (const kandidat of kandidaten) {
      try {
        installation = await pythonPruefen(kandidat.pfad, { helper, technischeOrdner: technisch });
        break;
      } catch (e) {
        if (process.env.SCRIPTLAB_TEST_PYTHON) throw e;
      }
    }
    if (!installation) throw new Error('Keine unterstützte geprüfte Python-Installation vorhanden.');
    if (process.env.SCRIPTLAB_TEST_PYTHON_VERSION)
      expect(installation.version).toBe(process.env.SCRIPTLAB_TEST_PYTHON_VERSION);
  }, 20000);
  afterAll(async () => {
    if (aktiv && aktiv.prozess.exitCode === null && aktiv.prozess.signalCode === null) {
      aktiv.prozess.stdin.end('STOP\n');
      const notbremse = setTimeout(() => aktiv?.prozess.kill(), 500);
      await aktiv.geschlossen;
      clearTimeout(notbremse);
    }
    if (!ordner) return;
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-Pythonexport-')
    )
      throw new Error('Unsicherer temporärer Exportprüfpfad.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  async function exportAusfuehren(python: PythonInstallation): Promise<Ergebnis> {
    await appGeschlossenPruefen();
    const exportpfad = join(basis, 'Scriptordner ä', 'Eigenständiger Export.py');
    await writeFile(exportpfad, exportErzeugen(), 'utf8');
    const quellbytes = await readFile(exportpfad);
    expect(quellbytes.subarray(0, 3)).not.toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(quellbytes.toString('utf8')).not.toMatch(/(?<!\r)\n/);
    await writeFile(join(basis, 'Fester Auftrag.json'), JSON.stringify({ interpreter: python.pfad }), 'utf8');
    const script = join(technisch, `Festes Exportgerüst ${++nummer}.py`);
    await writeFile(script, exportHarness, 'utf8');
    const token = randomBytes(24).toString('hex');
    const ergebnis = await new Promise<Ergebnis>((fertig, ablehnen) => {
      const prozess = spawn(
        helper,
        [
          '--script',
          script,
          '--basis',
          basis,
          '--limit-ms',
          '4000',
          '--token',
          token,
          '--sprache',
          'python',
          '--interpreter',
          python.pfad,
        ],
        { shell: false, windowsHide: true, cwd: technisch, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const geschlossen = new Promise<void>((erledigt) => prozess.once('close', () => erledigt()));
      aktiv = { prozess, geschlossen };
      const dekoder = [new StringDecoder('utf8'), new StringDecoder('utf8')];
      const ausgaben = ['', ''];
      let anzahl = 0,
        grenzfehler = false;
      const notbremse = setTimeout(() => {
        grenzfehler = true;
        prozess.kill();
      }, 8500);
      prozess.stdin.on('error', () => {});
      for (const [index, strom] of [prozess.stdout, prozess.stderr].entries())
        strom.on('data', (daten: Buffer) => {
          anzahl += daten.length;
          if (anzahl > 65536) {
            grenzfehler = true;
            prozess.kill();
            return;
          }
          ausgaben[index] += dekoder[index].write(daten);
        });
      prozess.once('error', (fehler) => {
        clearTimeout(notbremse);
        ablehnen(fehler);
      });
      prozess.once('close', (code) => {
        clearTimeout(notbremse);
        aktiv = null;
        for (let i = 0; i < 2; i++) ausgaben[i] += dekoder[i].end();
        if (grenzfehler) return ablehnen(new Error('Die feste Prozess-/Ausgabegrenze wurde überschritten.'));
        if (code !== 0) return ablehnen(new Error(`Exportgerüst endet mit ${code}: ${ausgaben[1]}`));
        try {
          fertig(JSON.parse(ausgaben[0]) as Ergebnis);
        } catch {
          ablehnen(new Error('Kein gültiger unabhängiger Exportnachweis.'));
        }
      });
    });
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    expect(ergebnis.stderr).toBe('');
    expect(ergebnis.stdout).toBe(ausgabetext + '\r\n');
    expect(ergebnis.befehl).toEqual([python.pfad, exportpfad]);
    expect(ergebnis.cwd).toBe(join(basis, 'Anderes Arbeitsverzeichnis'));
    expect(ergebnis.interpreter.toLowerCase()).toBe(python.pfad.toLowerCase());
    const datei = await readFile(join(basis, 'Scriptordner ä', 'Ergebnis ä.txt'));
    expect(datei).toEqual(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(inhalt, 'utf8')]));
    await expect(stat(join(basis, 'Anderes Arbeitsverzeichnis', 'Ergebnis ä.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    return ergebnis;
  }
  it('läuft bei geschlossener App ohne Testtoken und verwendet den Scriptordner statt des cwd', async () => {
    const ergebnis = await exportAusfuehren(installation);
    expect(ergebnis.version).toBe(installation.version);
  }, 15000);
  it('prüft einen bereits vorhandenen venv-Interpreter und führt denselben eigenständigen Export aus', async (kontext) => {
    const pfad =
      process.env.SCRIPTLAB_TEST_VENV ?? join(homedir(), 'Desktop', '.venv', 'Scripts', 'python.exe');
    const cfg = join(dirname(dirname(pfad)), 'pyvenv.cfg');
    if (!(await stat(cfg).catch(() => null))?.isFile()) {
      if (process.env.SCRIPTLAB_TEST_VENV)
        throw new Error('Der ausdrücklich angegebene bestehende venv besitzt keine pyvenv.cfg.');
      kontext.skip();
      return;
    }
    const konfiguration = await readFile(cfg, 'utf8');
    expect(konfiguration).toMatch(/^home\s*=\s*.+/m);
    const venv = await pythonPruefen(pfad, { helper, technischeOrdner: technisch });
    const ergebnis = await exportAusfuehren(venv);
    expect(ergebnis.venv).toBe(true);
    expect(ergebnis.version).toBe(venv.version);
  }, 20000);
});
