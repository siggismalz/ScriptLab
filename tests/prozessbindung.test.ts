import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';

const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');
const stopExitcode = 0xc000013a;
let ordner: string;
let prozesse: Probe[];
interface Ergebnis {
  code: number | null;
  stdout: string;
  stderr: string;
}
interface Probe {
  prozess: ChildProcessWithoutNullStreams;
  fertig: Promise<Ergebnis>;
  ausgabe: () => string;
  fehlerAusgabe: () => string;
  basis: string;
  token: string;
}

describe.skipIf(process.platform !== 'win32' || process.arch !== 'x64')(
  'Fester Windows-Host und Jobbindung',
  () => {
    beforeAll(async () => {
      await promisify(execFile)(process.execPath, ['scripts/laufzeit-host-bauen.mjs'], {
        cwd: resolve('.'),
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });
    }, 20000);
    beforeEach(async () => {
      ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Jobprobe-'));
      prozesse = [];
    });
    afterEach(async () => {
      for (const probe of prozesse) {
        if (probe.prozess.exitCode === null && probe.prozess.signalCode === null) {
          probe.prozess.stdin.end('STOP\n');
          const abbruch = setTimeout(() => probe.prozess.kill(), 500);
          await probe.fertig.catch(() => {});
          clearTimeout(abbruch);
        }
      }
      const ziel = resolve(ordner);
      if (!ziel.startsWith(resolve(tmpdir()) + sep) || !basename(ziel).startsWith('ScriptLab-Jobprobe-'))
        throw new Error('Unsicheres Testverzeichnis.');
      await rm(ziel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    });

    async function probeStarten(
      source: string,
      limitMs = 4000,
      token = randomUUID().replaceAll('-', ''),
    ): Promise<Probe> {
      const basis = join(ordner, 'Basis ä & (Test)') + sep;
      await mkdir(basis, { recursive: true });
      const script = join(ordner, `Feste Probe ä & (${prozesse.length}).vbs`);
      await writeFile(
        script,
        Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(source.replace(/\r?\n/g, '\r\n'), 'utf16le')]),
      );
      const prozess = spawn(
        helper,
        ['--script', script, '--basis', basis, '--limit-ms', String(limitMs), '--token', token],
        {
          shell: false,
          windowsHide: true,
          cwd: basis,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let stdout = '',
        stderr = '';
      const ausgabe = new StringDecoder('utf16le'),
        fehler = new StringDecoder('utf16le');
      prozess.stdout.on('data', (daten: Buffer) => {
        stdout += ausgabe.write(daten);
      });
      prozess.stderr.on('data', (daten: Buffer) => {
        stderr += fehler.write(daten);
      });
      // Auch ein fehlerhafter Helper bleibt nur bis zur festen Maximaldauer dieses Testprozesses bestehen.
      const notbremse = setTimeout(() => prozess.kill(), Math.min(limitMs + 4000, 10000));
      const fertig = new Promise<Ergebnis>((erledigt, ablehnen) => {
        prozess.once('error', (e) => {
          clearTimeout(notbremse);
          ablehnen(e);
        });
        prozess.once('close', (code) => {
          clearTimeout(notbremse);
          stdout += ausgabe.end();
          stderr += fehler.end();
          erledigt({ code, stdout, stderr });
        });
      });
      // Ein bereits beendeter Prozess kann beim Aufräumen keine unbehandelte EPIPE-Ausnahme auslösen.
      prozess.stdin.on('error', () => {});
      const probe = { prozess, fertig, ausgabe: () => stdout, fehlerAusgabe: () => stderr, basis, token };
      prozesse.push(probe);
      return probe;
    }
    async function bereit(probe: Probe): Promise<void> {
      await expect.poll(probe.ausgabe, { timeout: 3000 }).toContain('BEREIT');
    }
    function startBestaetigen(stderr: string): { pid: number; rest: string } {
      const muster = /^SLHOST\|GESTARTET\|([^|\r\n]+)\|(\d+)\r\n/gm;
      const treffer = [...stderr.matchAll(muster)];
      expect(treffer).toHaveLength(1);
      expect(Number.isNaN(Date.parse(treffer[0][1]))).toBe(false);
      const pid = Number(treffer[0][2]);
      expect(pid).toBeGreaterThan(0);
      return { pid, rest: stderr.replace(muster, '') };
    }
    const schleife = 'Option Explicit\nWScript.StdOut.WriteLine "BEREIT"\nDo\n  WScript.Sleep 20\nLoop\n';

    test('vererbt Unicode-Pipes, übergibt sichere benannte Argumente und erhält den echten Exitcode', async () => {
      const probe = await probeStarten(
        'Option Explicit\nWScript.StdOut.WriteLine Abs(CInt(WScript.Interactive))\nWScript.StdOut.WriteLine "Hallo ä, Ö und €"\nWScript.StdOut.WriteLine WScript.Arguments.Named.Item("ScriptLabBasis")\nWScript.StdOut.WriteLine WScript.Arguments.Named.Item("ScriptLabTestToken")\nWScript.Quit 37\n',
      );
      const ergebnis = await probe.fertig;
      expect(ergebnis.code, JSON.stringify(ergebnis)).toBe(37);
      const zeilen = ergebnis.stdout.split('\r\n');
      expect(zeilen.slice(0, 2)).toEqual(['1', 'Hallo ä, Ö und €']);
      // Windows kann denselben Basisordner als 8.3- oder ausgeschriebenen Pfad zurückgeben.
      expect(await realpath(zeilen[2])).toBe(await realpath(resolve(probe.basis)));
      expect(zeilen.slice(3)).toEqual([probe.token, '']);
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('');
    }, 15000);

    test('bestätigt ein normales Ende nach einer festen kurzen Wartezeit', async () => {
      const probe = await probeStarten(
        'WScript.StdOut.WriteLine "BEREIT"\nWScript.Sleep 200\nWScript.StdOut.WriteLine "FERTIG"\n',
      );
      const ergebnis = await probe.fertig;
      expect(ergebnis.code).toBe(0);
      expect(ergebnis.stdout).toBe('BEREIT\r\nFERTIG\r\n');
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('');
    }, 15000);

    test('schreibt die Startbestätigung vor einer sofortigen langen Fehlerzeile vollständig', async () => {
      const fehlerzeile = `LANGE FEHLERZEILE|${'ä'.repeat(7000)}|ENDE`;
      expect(Buffer.byteLength(fehlerzeile, 'utf16le')).toBeGreaterThan(4096);
      const probe = await probeStarten(
        'Option Explicit\nWScript.StdErr.WriteLine "LANGE FEHLERZEILE|" & String(7000, "ä") & "|ENDE"\nWScript.StdOut.WriteLine "FERTIG"\nWScript.Quit 23\n',
      );
      const ergebnis = await probe.fertig;
      expect(ergebnis.code, JSON.stringify(ergebnis)).toBe(23);
      expect(ergebnis.stdout).toBe('FERTIG\r\n');
      expect(ergebnis.stderr).toMatch(/^SLHOST\|GESTARTET\|[^|\r\n]+\|\d+\r\n/);
      expect(startBestaetigen(ergebnis.stderr).rest).toBe(`${fehlerzeile}\r\n`);
    }, 15000);

    test('beendet ausschließlich seinen laufenden Job nach STOP mit bestätigtem Pipe-Ende', async () => {
      const probe = await probeStarten(schleife);
      await bereit(probe);
      const vorher = Date.now();
      probe.prozess.stdin.write('STOP\n');
      const ergebnis = await probe.fertig;
      expect((ergebnis.code ?? 0) >>> 0).toBe(stopExitcode);
      expect(Date.now() - vorher).toBeLessThan(3000);
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('');
    }, 15000);

    test('beendet den laufenden Job bei EOF der Lebensleitung', async () => {
      const probe = await probeStarten(schleife);
      await bereit(probe);
      probe.prozess.stdin.end();
      const ergebnis = await probe.fertig;
      expect((ergebnis.code ?? 0) >>> 0).toBe(stopExitcode);
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('');
    }, 15000);

    test('führt bei bereits geschlossener Lebensleitung keinen Scriptinhalt aus', async () => {
      const probe = await probeStarten('WScript.StdOut.WriteLine "DARF NICHT STARTEN"\nWScript.Sleep 1000\n');
      probe.prozess.stdin.end();
      const ergebnis = await probe.fertig;
      expect((ergebnis.code ?? 0) >>> 0).toBe(stopExitcode);
      expect(ergebnis.stdout).toBe('');
      expect(ergebnis.stderr).toBe('');
    }, 15000);

    test('meldet das feste Zeitlimit nach bestätigtem Job- und Pipe-Ende', async () => {
      const probe = await probeStarten(schleife, 350);
      const ergebnis = await probe.fertig;
      expect((ergebnis.code ?? 0) >>> 0).toBe(stopExitcode);
      expect(ergebnis.stdout).toContain('BEREIT');
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('\r\nSLHOST|ZEITLIMIT\r\n');
    }, 15000);

    test('räumt den Job auch beim gezielten Beenden seines eigenen Helpers auf', async () => {
      const probe = await probeStarten(schleife);
      await bereit(probe);
      await expect.poll(probe.fehlerAusgabe).toContain('SLHOST|GESTARTET|');
      const { pid } = startBestaetigen(probe.fehlerAusgabe());
      const vorher = Date.now();
      expect(probe.prozess.kill()).toBe(true);
      await probe.fertig;
      // Ausschließlich die bestätigte eigene cscript-PID mit Signal 0 lesend auf Existenz prüfen.
      await expect
        .poll(() => {
          try {
            process.kill(pid, 0);
            return true;
          } catch (e) {
            return (e as NodeJS.ErrnoException).code !== 'ESRCH';
          }
        })
        .toBe(false);
      expect(Date.now() - vorher).toBeLessThan(3000);
    }, 15000);

    test('verwechselt den gültigen Exitcode 259 nicht mit einem noch laufenden Prozess', async () => {
      const probe = await probeStarten('WScript.Quit 259\n');
      const ergebnis = await probe.fertig;
      expect(ergebnis.code).toBe(259);
      expect(startBestaetigen(ergebnis.stderr).rest).toBe('');
    }, 15000);

    test('weist eine ungültige Testkennung zurück, bevor der Scriptinhalt startet', async () => {
      const probe = await probeStarten('WScript.StdOut.WriteLine "DARF NICHT STARTEN"\n', 1000, 'ungueltig');
      const ergebnis = await probe.fertig;
      expect(ergebnis.code).toBe(125);
      expect(ergebnis.stdout).toBe('');
      expect(ergebnis.stderr).toContain('SLHOST|FEHLER|');
    }, 15000);
  },
);
