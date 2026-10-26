import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { pythonKandidatenSuchen, pythonPruefen } from '../src/windows/python';
import { TestlaufDienst, pythonDialogeNoetig } from '../src/windows/testlauf';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import type { PythonInstallation } from '../src/gemeinsam/python';
import { testAktiv } from '../src/gemeinsam/testlauf';

describe('Vertrauensgrenzen der Python-Auswahl ohne Prozessstart', () => {
  test('fordert Tk nur für aktive Dialogbausteine an, einschließlich geschachtelter Werte', () => {
    const p = neuesProjekt();
    const start = p.editor.blocks!.blocks[0];
    expect(pythonDialogeNoetig(p)).toBe(false);
    p.editor.blocks!.blocks.push({
      type: 'sl_input',
      id: 'unbenutzte-eingabe',
      inputs: {
        TEXT: { block: { type: 'sl_text', id: 'unbenutzte-frage', fields: { TEXT: 'Nur ein loser Wert' } } },
      },
    });
    expect(pythonDialogeNoetig(p)).toBe(false);
    start.next = {
      block: {
        type: 'sl_output',
        id: 'ausgabe',
        inputs: { TEXT: { block: { type: 'sl_input', id: 'eingabe' } } },
      },
    };
    expect(pythonDialogeNoetig(p)).toBe(true);
    start.next.block.enabled = false;
    expect(pythonDialogeNoetig(p)).toBe(false);
    start.next = { block: { type: 'sl_delete', id: 'loeschen', fields: { RUECKFRAGE: 'NEIN' } } };
    expect(pythonDialogeNoetig(p)).toBe(false);
    start.next.block.fields!.RUECKFRAGE = 'JA';
    expect(pythonDialogeNoetig(p)).toBe(true);
    delete start.next.block.fields!.RUECKFRAGE;
    expect(pythonDialogeNoetig(p)).toBe(true);
    delete start.next.block.fields;
    expect(pythonDialogeNoetig(p)).toBe(true);
  });
});

const freigegeben =
  process.platform === 'win32' && process.arch === 'x64' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');
const stopExitcode = 0xc000013a;
interface Probe {
  prozess: ChildProcessWithoutNullStreams;
  fertig: Promise<{ code: number | null; stdout: string; stderr: string }>;
  stdout: () => string;
}

describe.skipIf(!freigegeben)('Freigegebene feste Python-Proben im Windows-Job', () => {
  let ordner: string, basis: string, technisch: string;
  let installation: PythonInstallation;
  let prozesse: Probe[] = [];
  let dienst: TestlaufDienst | null = null;
  beforeAll(async () => {
    await promisify(execFile)(process.execPath, ['scripts/laufzeit-host-bauen.mjs'], {
      windowsHide: true,
      timeout: 15000,
    });
  }, 20000);
  beforeEach(async () => {
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Pythonprobe-'));
    basis = join(ordner, 'Basis ä & (Test)');
    technisch = join(ordner, 'Technische Dateien');
    await mkdir(basis);
    await mkdir(technisch);
    prozesse = [];
    if (!installation) {
      // Nur das Testharness darf eine explizite CI-Laufzeit vorgeben, nie die Anwendungserkennung.
      const vorgabe = process.env.SCRIPTLAB_TEST_PYTHON;
      if (vorgabe) {
        installation = await pythonPruefen(vorgabe, { helper, technischeOrdner: technisch });
        if (process.env.SCRIPTLAB_TEST_PYTHON_VERSION)
          expect(installation.version).toBe(process.env.SCRIPTLAB_TEST_PYTHON_VERSION);
      }
      const kandidaten = vorgabe ? [] : await pythonKandidatenSuchen();
      const fehler: string[] = [];
      for (const kandidat of kandidaten) {
        try {
          installation = await pythonPruefen(kandidat.pfad, { helper, technischeOrdner: technisch });
          break;
        } catch (e) {
          fehler.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (!installation)
        throw new Error(
          `Kein unterstütztes CPython für die ausdrücklich freigegebenen Tests vorhanden: ${fehler.join('; ')}`,
        );
    }
  }, 20000);
  afterEach(async () => {
    if (dienst?.aktiv()) await dienst.stoppen();
    dienst = null;
    for (const probe of prozesse) {
      if (probe.prozess.exitCode === null && probe.prozess.signalCode === null) {
        probe.prozess.stdin.end('STOP\n');
        const notbremse = setTimeout(() => probe.prozess.kill(), 500);
        await probe.fertig.catch(() => {});
        clearTimeout(notbremse);
      }
    }
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-Pythonprobe-')
    )
      throw new Error('Unsicherer Testordner.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  async function probeStarten(code: string, limit = 4000): Promise<Probe> {
    const script = join(technisch, 'feste-probe.py');
    await writeFile(script, code, 'utf8');
    const prozess = spawn(
      helper,
      [
        '--script',
        script,
        '--basis',
        basis,
        '--limit-ms',
        String(limit),
        '--token',
        randomBytes(24).toString('hex'),
        '--sprache',
        'python',
        '--interpreter',
        installation.pfad,
      ],
      {
        shell: false,
        windowsHide: true,
        cwd: basis,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONHOME: join(ordner, 'Keine Runtime'),
          PYTHONPATH: basis,
          PYTHONIOENCODING: 'ascii',
        },
      },
    );
    const dekoder = [new StringDecoder('utf8'), new StringDecoder('utf8')];
    let stdout = '',
      stderr = '';
    prozess.stdout.on('data', (d: Buffer) => {
      stdout += dekoder[0].write(d);
    });
    prozess.stderr.on('data', (d: Buffer) => {
      stderr += dekoder[1].write(d);
    });
    prozess.stdin.on('error', () => {});
    const notbremse = setTimeout(() => prozess.kill(), Math.min(limit + 4000, 10000));
    const fertig = new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (erledigt, ablehnen) => {
        prozess.once('error', (e) => {
          clearTimeout(notbremse);
          ablehnen(e);
        });
        prozess.once('close', (code) => {
          clearTimeout(notbremse);
          stdout += dekoder[0].end();
          stderr += dekoder[1].end();
          erledigt({ code, stdout, stderr });
        });
      },
    );
    const probe = { prozess, fertig, stdout: () => stdout };
    prozesse.push(probe);
    return probe;
  }
  function startPruefen(stderr: string): void {
    expect(stderr).toMatch(/^SLHOST\|GESTARTET\|[^|\r\n]+\|\d+\r\n/);
    expect([...stderr.matchAll(/^SLHOST\|GESTARTET\|/gm)]).toHaveLength(1);
  }
  const schleife = 'import time\nprint("BEREIT", flush=True)\nwhile True:\n    time.sleep(0.02)\n';

  test('prüft die echte Laufzeit strukturiert und lässt Tk ohne Dialogbedarf ungeprüft', async () => {
    const geprueft = await pythonPruefen(installation.pfad, { helper, technischeOrdner: technisch });
    expect(geprueft).toMatchObject({
      pfad: installation.pfad,
      implementierung: 'CPython',
      architektur: 'x64',
      tkinter: null,
    });
    expect(geprueft.version).toMatch(/^3\.(12|13|14|15)\.\d+$/);
  }, 15000);

  test('übergibt Basis und Token als Daten und ignoriert Python-Umgebungsmanipulation', async () => {
    await writeFile(join(basis, 'json.py'), 'raise RuntimeError("FREMDES MODUL DARF NICHT LADEN")\n');
    const probe = await probeStarten(
      'import sys, json\nprint(json.dumps({"text": "Grüße 😀", "args": sys.argv[1:], "isoliert": sys.flags.isolated, "utf8": sys.flags.utf8_mode}, ensure_ascii=False), flush=True)\nsys.exit(37)\n',
    );
    const ende = await probe.fertig;
    expect(ende.code, JSON.stringify(ende)).toBe(37);
    startPruefen(ende.stderr);
    const a = JSON.parse(ende.stdout);
    expect(a).toMatchObject({ text: 'Grüße 😀', isoliert: 1, utf8: 1 });
    expect(a.args[0]).toBe('--scriptlab-basis');
    expect(await realpath(a.args[1])).toBe(await realpath(basis));
    expect(a.args[2]).toBe('--scriptlab-token');
    expect(a.args[3]).toMatch(/^[a-f0-9]{48}$/);
  }, 15000);

  test.each(['STOP', 'EOF'] as const)(
    'beendet den eigenen Python-Job kontrolliert nach %s',
    async (befehl) => {
      const probe = await probeStarten(schleife);
      await expect.poll(probe.stdout, { timeout: 4000 }).toContain('BEREIT');
      if (befehl === 'EOF') probe.prozess.stdin.end();
      else probe.prozess.stdin.write('STOP\n');
      const ende = await probe.fertig;
      expect((ende.code ?? 0) >>> 0).toBe(stopExitcode);
      startPruefen(ende.stderr);
    },
    15000,
  );

  test('bestätigt das Python-Zeitlimit nach dem Prozess- und Pipe-Ende', async () => {
    const probe = await probeStarten(schleife, 1000);
    const ende = await probe.fertig;
    expect((ende.code ?? 0) >>> 0).toBe(stopExitcode);
    startPruefen(ende.stderr);
    expect(ende.stderr).toMatch(/\r\nSLHOST\|ZEITLIMIT\r\n$/);
  }, 15000);

  test('verwendet einen gemeinsamen Dienst für Python und VBS und erhält Unicode-Dateiinhalte', async () => {
    const p = neuesProjekt();
    p.skriptsprache = 'python';
    const wert = (id: string, TEXT: string): EditorBlock => ({ type: 'sl_text', id, fields: { TEXT } });
    const schreiben: EditorBlock = {
      type: 'sl_write_text',
      id: 'schreiben',
      fields: { KODIERUNG: 'UTF8' },
      inputs: {
        PFAD: { block: wert('pfad', 'Ergebnis ä.txt') },
        TEXT: { block: wert('inhalt', 'Grüße 😀') },
      },
    };
    schreiben.next = {
      block: {
        type: 'sl_output',
        id: 'ausgabe',
        inputs: { TEXT: { block: wert('ausgabetext', 'FERTIG 😀') } },
      },
    };
    p.editor.blocks!.blocks[0].next = { block: schreiben };
    dienst = new TestlaufDienst(helper, technisch, (tkinter, signal) =>
      pythonPruefen(installation.pfad, { helper, technischeOrdner: technisch, tkinter, signal }),
    );
    dienst.starten(p, { basisVerzeichnis: basis, zeitlimitSekunden: 5 });
    const vbs = structuredClone(p);
    vbs.skriptsprache = 'vbs';
    expect(() => dienst!.starten(vbs, { basisVerzeichnis: basis, zeitlimitSekunden: 5 })).toThrow(/bereits/);
    await expect.poll(() => testAktiv(dienst!.lesen().phase), { timeout: 12000 }).toBe(false);
    const ende = dienst.lesen();
    expect(ende, JSON.stringify(ende)).toMatchObject({
      phase: 'beendet',
      exitcode: 0,
      skriptsprache: 'python',
      pythonVersion: installation.version,
    });
    expect(ende.ausgabe).toContain('FERTIG 😀');
    // Workflow-Textdateien behalten die dokumentierte UTF-8-BOM; der Python-Quelltext hat keine.
    expect(await readFile(join(basis, 'Ergebnis ä.txt'))).toEqual(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Grüße 😀', 'utf8')]),
    );
  }, 15000);

  test('bricht die Interpreterprüfung ab und startet danach keinen vorbereiteten Workflow', async () => {
    const p = neuesProjekt('python');
    p.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_output',
        id: 'ausgabe',
        inputs: {
          TEXT: { block: { type: 'sl_text', id: 'text', fields: { TEXT: 'DARF NICHT ERSCHEINEN' } } },
        },
      },
    };
    let pruefungErreicht = () => {};
    const pruefung = new Promise<void>((fertig) => {
      pruefungErreicht = fertig;
    });
    dienst = new TestlaufDienst(
      helper,
      technisch,
      (_tkinter, signal) =>
        new Promise((_fertig, ablehnen) => {
          signal.addEventListener('abort', () => ablehnen(new Error('Bewusst abgebrochene Probe.')), {
            once: true,
          });
          pruefungErreicht();
        }),
    );
    dienst.starten(p, { basisVerzeichnis: basis, zeitlimitSekunden: 5 });
    await pruefung;
    const ende = await dienst.stoppen();
    expect(ende).toMatchObject({
      phase: 'abgebrochen',
      gestartetAm: null,
      prozessId: null,
      ausgabe: '',
      pythonVersion: null,
    });
    expect(testAktiv(ende.phase)).toBe(false);
    expect(await readdir(basis)).toEqual([]);
  }, 15000);

  test('führt den Hauptablauf trotz unbenutztem Dialogwert ohne Tk-Prüfung aus', async () => {
    const p = neuesProjekt('python');
    p.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_output',
        id: 'nur-ausgabe',
        inputs: {
          TEXT: {
            block: {
              type: 'sl_text',
              id: 'ausgabetext',
              fields: { TEXT: 'Ohne Tk tatsächlich ausgeführt ä' },
            },
          },
        },
      },
    };
    p.editor.blocks!.blocks.push({
      type: 'sl_input',
      id: 'loser-dialog',
      x: 400,
      y: 80,
      inputs: {
        TEXT: {
          block: { type: 'sl_text', id: 'lose-frage', fields: { TEXT: 'Dieser Wert wird nicht verwendet.' } },
        },
      },
    });
    const bedarf: boolean[] = [];
    dienst = new TestlaufDienst(helper, technisch, (tkinter, signal) => {
      bedarf.push(tkinter);
      return pythonPruefen(installation.pfad, { helper, technischeOrdner: technisch, tkinter, signal });
    });
    dienst.starten(p, { basisVerzeichnis: basis, zeitlimitSekunden: 5 });
    await expect.poll(() => testAktiv(dienst!.lesen().phase), { timeout: 12000 }).toBe(false);
    const ende = dienst.lesen();
    expect(ende, ende.technischeMeldung ?? ende.meldung).toMatchObject({
      phase: 'beendet',
      exitcode: 0,
      skriptsprache: 'python',
    });
    expect(bedarf).toEqual([false]);
    expect(ende.ausgabe).toBe('Ohne Tk tatsächlich ausgeführt ä\r\n');
    expect(ende.quelltext).not.toContain('import tkinter');
    expect(await readdir(basis)).toEqual([]);
  }, 15000);

  test('ordnet einen echten Python-Dateifehler dem Wertebaustein und seiner Workflowzeile zu', async () => {
    const p = neuesProjekt('python');
    p.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_output',
        id: 'ausgabe',
        inputs: {
          TEXT: {
            block: {
              type: 'sl_read_text',
              id: 'lesefehler',
              fields: { KODIERUNG: 'UTF8' },
              inputs: {
                PFAD: {
                  block: { type: 'sl_text', id: 'fehlenderpfad', fields: { TEXT: 'Nicht vorhanden.txt' } },
                },
              },
            },
          },
        },
      },
    };
    dienst = new TestlaufDienst(helper, technisch, (tkinter, signal) =>
      pythonPruefen(installation.pfad, { helper, technischeOrdner: technisch, tkinter, signal }),
    );
    dienst.starten(p, { basisVerzeichnis: basis, zeitlimitSekunden: 5 });
    await expect.poll(() => testAktiv(dienst!.lesen().phase), { timeout: 12000 }).toBe(false);
    const ende = dienst.lesen();
    expect(ende, JSON.stringify(ende)).toMatchObject({
      phase: 'fehlgeschlagen',
      exitcode: 1,
      fehlerBlockId: 'lesefehler',
    });
    expect(ende.technischeMeldung).toContain('Traceback');
    expect(ende.fehlerZeile, ende.technischeMeldung ?? '').not.toBeNull();
    expect(
      ende.zeilenZuordnung.some(
        (z) => z.blockId === 'lesefehler' && ende.fehlerZeile! >= z.von && ende.fehlerZeile! <= z.bis,
      ),
    ).toBe(true);
    expect(await readdir(basis)).toEqual([]);
  }, 15000);

  test('ordnet Python-Tracebacks auch bei einem technischen Windows-Kurzpfad der Workflowzeile zu', async (kontext) => {
    const lang = join(technisch, 'Technischer Quellordner mit langem Namen');
    await mkdir(lang);
    const system = process.env.SystemRoot ?? 'C:\\Windows';
    const antwort = await promisify(execFile)(
      join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        String.raw`
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public static class ScriptLabKurzpfad { [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern uint GetShortPathName(string pfad, StringBuilder ziel, uint laenge); }'
$ziel = [Text.StringBuilder]::new(32768)
$laenge = [ScriptLabKurzpfad]::GetShortPathName($env:SCRIPTLAB_KURZPFAD_PROBE, $ziel, 32768)
if ($laenge -eq 0 -or $laenge -ge 32768) { throw 'Der feste Testkurzpfad konnte nicht gelesen werden.' }
[Console]::Write($ziel.ToString())`,
      ],
      {
        windowsHide: true,
        timeout: 4000,
        maxBuffer: 65536,
        encoding: 'utf8',
        env: { ...process.env, SCRIPTLAB_KURZPFAD_PROBE: lang },
      },
    );
    const kurz = antwort.stdout.trim().replace(/^\uFEFF/, '');
    expect(await realpath(kurz)).toBe(await realpath(lang));
    if (kurz.toLowerCase() === lang.toLowerCase()) {
      kontext.skip();
      return;
    }
    const p = neuesProjekt('python');
    p.editor.blocks!.blocks[0].next = {
      block: {
        type: 'sl_output',
        id: 'ausgabe',
        inputs: {
          TEXT: {
            block: {
              type: 'sl_read_text',
              id: 'kurzpfad-lesefehler',
              fields: { KODIERUNG: 'UTF8' },
              inputs: {
                PFAD: {
                  block: { type: 'sl_text', id: 'kurzpfad-datei', fields: { TEXT: 'Nicht vorhanden.txt' } },
                },
              },
            },
          },
        },
      },
    };
    dienst = new TestlaufDienst(helper, kurz, (tkinter, signal) =>
      pythonPruefen(installation.pfad, { helper, technischeOrdner: technisch, tkinter, signal }),
    );
    dienst.starten(p, { basisVerzeichnis: basis, zeitlimitSekunden: 4 });
    await expect.poll(() => testAktiv(dienst!.lesen().phase), { timeout: 10000 }).toBe(false);
    const ende = dienst.lesen();
    let traceback = ende.technischeMeldung ?? '';
    for (const [pfad, ersatz] of [
      [lang, '<TECHNIK_LANG>'],
      [kurz, '<TECHNIK_KURZ>'],
      [ordner, '<TESTORDNER>'],
      [process.env.USERPROFILE ?? '\0', '<BENUTZER>'],
    ]) {
      // Auch der strukturierte Fehlerkanal enthält den Dateipfad, dort URI-kodiert.
      const kodiert = encodeURIComponent(pfad).replace(
        /[!'()*]/g,
        (zeichen) => `%${zeichen.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      traceback = traceback.replaceAll(pfad, ersatz).replaceAll(kodiert, ersatz);
    }
    const diagnose = JSON.stringify({
      phase: ende.phase,
      block: ende.fehlerBlockId,
      zeile: ende.fehlerZeile,
      identischerOrdner: true,
      traceback,
    });
    expect(ende.phase, diagnose).toBe('fehlgeschlagen');
    expect(ende.fehlerBlockId, diagnose).toBe('kurzpfad-lesefehler');
    expect(ende.fehlerZeile, diagnose).not.toBeNull();
    expect(
      ende.zeilenZuordnung.some(
        (z) =>
          z.blockId === 'kurzpfad-lesefehler' && ende.fehlerZeile! >= z.von && ende.fehlerZeile! <= z.bis,
      ),
      diagnose,
    ).toBe(true);
    expect(await readdir(basis)).toEqual([]);
  }, 20000);
});
