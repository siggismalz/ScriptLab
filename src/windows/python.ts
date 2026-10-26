import { execFile, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { open, stat, readdir, readFile, mkdir, writeFile, unlink, rmdir, realpath } from 'node:fs/promises';
import { win32, join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { PythonInstallation } from '../gemeinsam/python';

export interface PythonKandidat {
  pfad: string;
  quelle: 'Registry' | 'Lokale Installation' | 'PATH';
}
export interface PythonPruefOptionen {
  helper: string;
  technischeOrdner: string;
  tkinter?: boolean;
  signal?: AbortSignal;
}

// PEP 514 nennt beide Registryansichten. Kein Launcher wird für diese Suche aufgerufen.
const registrySuche = String.raw`
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$pfade = New-Object System.Collections.Generic.List[string]
foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
  foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
    $basis = $null; $python = $null
    try {
      $basis = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
      $python = $basis.OpenSubKey('Software\Python')
      if ($null -eq $python) { continue }
      foreach ($firma in $python.GetSubKeyNames()) {
        if ($firma -eq 'PyLauncher') { continue }
        $anbieter = $python.OpenSubKey($firma)
        try {
          foreach ($tag in $anbieter.GetSubKeyNames()) {
            $installation = $anbieter.OpenSubKey($tag + '\InstallPath')
            try {
              if ($null -eq $installation) { continue }
              $exe = [string]$installation.GetValue('ExecutablePath', '')
              if ($exe) { $pfade.Add($exe) }
              else {
                $ordner = [string]$installation.GetValue('', '')
                if ($ordner) { $pfade.Add([IO.Path]::Combine($ordner, 'python.exe')) }
              }
            } finally { if ($null -ne $installation) { $installation.Dispose() } }
          }
        } finally { $anbieter.Dispose() }
      }
    } catch { } finally {
      if ($null -ne $python) { $python.Dispose() }
      if ($null -ne $basis) { $basis.Dispose() }
    }
  }
}
ConvertTo-Json -Compress -InputObject @($pfade | Select-Object -Unique)
`;
const dateimetadaten = String.raw`
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$v = [Diagnostics.FileVersionInfo]::GetVersionInfo($env:SCRIPTLAB_PYTHON_KANDIDAT)
ConvertTo-Json -Compress -InputObject @{produkt=$v.ProductName; beschreibung=$v.FileDescription; original=$v.OriginalFilename}
`;

function windowsPruefen(): void {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Python-Workflowtests benötigen Windows 11 x64.');
}
async function vorbereitet<T>(arbeit: Promise<T>, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abbrechen = () => {};
  try {
    return await Promise.race([
      arbeit,
      new Promise<never>((_fertig, ablehnen) => {
        abbrechen = () => ablehnen(new Error('Die Python-Prüfung wurde abgebrochen.'));
        if (signal?.aborted) return abbrechen();
        signal?.addEventListener('abort', abbrechen, { once: true });
        timer = setTimeout(
          () =>
            ablehnen(
              new Error(
                'Die Python-Installation ist nicht rechtzeitig erreichbar. Wähle eine lokale Installation.',
              ),
            ),
          4000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abbrechen);
  }
}
async function powershellLesen(befehl: string, pfad?: string, signal?: AbortSignal): Promise<unknown> {
  const system = process.env.SystemRoot ?? 'C:\\Windows';
  const powershell = win32.join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise((fertig, ablehnen) => {
    execFile(
      powershell,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', befehl],
      {
        windowsHide: true,
        timeout: 4000,
        maxBuffer: 262144,
        encoding: 'utf8',
        cwd: system,
        signal,
        env: {
          ...process.env,
          PSModulePath: win32.join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules'),
          SCRIPTLAB_PYTHON_KANDIDAT: pfad ?? '',
        },
      },
      (fehler, stdout) => {
        if (fehler)
          return ablehnen(new Error('Die Python-Installationsangaben konnten nicht gelesen werden.'));
        try {
          fertig(JSON.parse(stdout.trim().replace(/^\uFEFF/, '')));
        } catch {
          ablehnen(new Error('Windows hat keine lesbaren Python-Installationsangaben geliefert.'));
        }
      },
    );
  });
}

/** Keine PATH-Befehle, Store-Aliasse oder frei wählbaren Programmtypen. */
export function pythonDateipfadPruefen(pfad: string): string {
  if (
    typeof pfad !== 'string' ||
    pfad.length > 32768 ||
    /[\0\r\n"]/.test(pfad) ||
    !/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(pfad) ||
    !/^python(?:3(?:\.[0-9]+)?)?\.exe$/i.test(win32.basename(pfad)) ||
    /(?:^|[\\/])WindowsApps(?:[\\/]|$)/i.test(pfad)
  )
    throw new Error(
      'Wähle eine vollständige python.exe einer installierten Python-Laufzeit. Launcher und Store-Aliasse sind nicht geeignet.',
    );
  return win32.normalize(pfad);
}

export async function pythonKandidatenSuchen(): Promise<PythonKandidat[]> {
  windowsPruefen();
  const kandidaten = new Map<string, PythonKandidat>();
  const merken = (wert: unknown, quelle: PythonKandidat['quelle']) => {
    if (typeof wert !== 'string' || kandidaten.size >= 100) return;
    try {
      const pfad = pythonDateipfadPruefen(wert);
      if (!kandidaten.has(pfad.toLowerCase())) kandidaten.set(pfad.toLowerCase(), { pfad, quelle });
    } catch {
      /* Ungültige Registrierung oder Alias wird niemals gestartet. */
    }
  };
  const registriert = await powershellLesen(registrySuche).catch(() => []);
  if (Array.isArray(registriert)) registriert.forEach((pfad) => merken(pfad, 'Registry'));
  const lokal = process.env.LOCALAPPDATA;
  if (lokal && win32.isAbsolute(lokal)) {
    const basis = win32.join(lokal, 'Programs', 'Python');
    const eintraege = await readdir(basis, { withFileTypes: true }).catch(() => []);
    for (const eintrag of eintraege.slice(0, 40))
      if (eintrag.isDirectory()) merken(win32.join(basis, eintrag.name, 'python.exe'), 'Lokale Installation');
  }
  for (const wert of (process.env.PATH ?? '').split(';').slice(0, 80)) {
    const ordner = wert.replace(/^"(.*)"$/, '$1').trim();
    // Eine automatische Suche wartet nicht auf Netzlaufwerke und führt keine Expand-/Shell-Ausdrücke aus.
    if (/^[a-z]:[\\/]/i.test(ordner)) merken(win32.join(ordner, 'python.exe'), 'PATH');
  }
  const vorhanden = await Promise.all(
    [...kandidaten.values()].map(async (kandidat) => {
      const datei = await vorbereitet(stat(kandidat.pfad)).catch(() => null);
      return datei?.isFile() && datei.size > 0 ? kandidat : null;
    }),
  );
  return vorhanden.filter((wert): wert is PythonKandidat => wert !== null);
}

async function laufzeitDateiPruefen(pfad: string, signal?: AbortSignal): Promise<string> {
  const eindeutig = pythonDateipfadPruefen(await realpath(pythonDateipfadPruefen(pfad)));
  const datei = await open(eindeutig, 'r');
  try {
    const kopf = Buffer.alloc(64);
    if ((await datei.read(kopf, 0, kopf.length, 0)).bytesRead < 64 || kopf.toString('ascii', 0, 2) !== 'MZ')
      throw new Error('Die gewählte Datei ist keine Windows-Python-Laufzeit.');
    const adresse = kopf.readUInt32LE(60),
      pe = Buffer.alloc(6);
    if (
      adresse > 16 * 1024 * 1024 ||
      (await datei.read(pe, 0, pe.length, adresse)).bytesRead !== 6 ||
      pe.readUInt32LE(0) !== 0x4550 ||
      pe.readUInt16LE(4) !== 0x8664
    )
      throw new Error('Wähle eine Python-Laufzeit für Windows x64.');
  } finally {
    await datei.close();
  }

  const ordner = win32.dirname(eindeutig);
  const dllVorhanden = async (basis: string) =>
    (await readdir(basis).catch(() => [])).some((name) => /^python3(?:12|13|14|15)t?\.dll$/i.test(name));
  let istVenv = false;
  let hatLaufzeit = await dllVorhanden(ordner);
  if (!hatLaufzeit) {
    // Direkte venv-Pfade dürfen verwendet werden. Ihr Basisinterpreter wird ausschließlich gelesen.
    const cfg = win32.join(win32.dirname(ordner), 'pyvenv.cfg');
    const cfgDatei = await stat(cfg).catch(() => null);
    if (cfgDatei?.isFile() && cfgDatei.size <= 16384) {
      const inhalt = await readFile(cfg, 'utf8');
      const home = /^home\s*=\s*(.+)$/im.exec(inhalt)?.[1].trim();
      if (home && win32.isAbsolute(home) && !/\\WindowsApps\\/i.test(home)) {
        hatLaufzeit = await dllVorhanden(home);
        istVenv = hatLaufzeit;
      }
    }
  }
  if (!hatLaufzeit)
    throw new Error(
      'Diese Datei gehört zu keiner erkennbaren CPython-Installation. Wähle die echte python.exe statt eines Launchers oder Installationsmanagers.',
    );
  if (signal?.aborted) throw new Error('Die Python-Prüfung wurde abgebrochen.');
  const meta = (await powershellLesen(dateimetadaten, eindeutig, signal)) as Record<string, unknown>;
  if (
    !meta ||
    meta.produkt !== 'Python' ||
    typeof meta.original !== 'string' ||
    !/^(?:python(?:3(?:\.[0-9]+)?)?\.exe|venvlauncher\.exe)$/i.test(meta.original) ||
    (!istVenv && /install|manager|launcher/i.test(String(meta.beschreibung)))
  )
    throw new Error(
      'Die Datei ist keine bestätigte CPython-Laufzeit. Launcher und Installationsmanager werden nicht ausgeführt.',
    );
  return eindeutig;
}

const funktionsprobe = (tkinter: boolean) => `import sys, json, struct, platform
tk = None
${
  tkinter
    ? `import tkinter
fenster = tkinter.Tk()
fenster.withdraw()
try:
    fenster.update_idletasks()
    tk = bool(fenster.tk.call("package", "provide", "Tk"))
finally:
    fenster.destroy()`
    : ''
}
print(json.dumps({"pfad": sys.executable, "version": platform.python_version(), "implementierung": platform.python_implementation(), "bits": struct.calcsize("P") * 8, "plattform": sys.platform, "stabil": sys.version_info.releaselevel == "final", "isoliert": sys.flags.isolated == 1, "utf8": sys.flags.utf8_mode == 1, "tkinter": tk}, ensure_ascii=False), flush=True)
`;

export function pythonAntwortPruefen(antwort: unknown, pfad: string, tkinter: boolean): PythonInstallation {
  if (!antwort || typeof antwort !== 'object')
    throw new Error('Python hat kein gültiges Prüfergebnis geliefert.');
  const a = antwort as Record<string, unknown>;
  if (
    typeof a.version !== 'string' ||
    !/^3\.(?:12|13|14|15)\.\d+$/.test(a.version) ||
    a.stabil !== true ||
    a.implementierung !== 'CPython' ||
    a.bits !== 64 ||
    a.plattform !== 'win32' ||
    a.isoliert !== true ||
    a.utf8 !== true ||
    typeof a.pfad !== 'string' ||
    win32.normalize(a.pfad).toLowerCase() !== win32.normalize(pfad).toLowerCase()
  )
    throw new Error('Unterstützt wird eine stabile CPython-Version von 3.12 bis 3.15 für Windows x64.');
  if (tkinter && a.tkinter !== true)
    throw new Error('Diese Python-Installation unterstützt die benötigten Tk-Dialoge nicht.');
  return {
    pfad,
    version: a.version,
    architektur: 'x64',
    implementierung: 'CPython',
    tkinter: tkinter ? true : null,
  };
}

/** Nur dieser feste Metadatentest wird ausgeführt, niemals ein Nutzerworkflow oder freier Befehl. */
export async function pythonPruefen(
  pfad: string,
  optionen: PythonPruefOptionen,
): Promise<PythonInstallation> {
  windowsPruefen();
  if (optionen.signal?.aborted) throw new Error('Die Python-Prüfung wurde abgebrochen.');
  const interpreter = await vorbereitet(laufzeitDateiPruefen(pfad, optionen.signal), optionen.signal).catch(
    (fehler: unknown) => {
      if (fehler instanceof Error && 'code' in fehler)
        throw new Error(
          'Die gewählte Python-Datei konnte nicht gelesen werden. Prüfe, ob sie noch vorhanden und für dich zugänglich ist.',
        );
      throw fehler;
    },
  );
  if (optionen.signal?.aborted) throw new Error('Die Python-Prüfung wurde abgebrochen.');
  const ordner = join(optionen.technischeOrdner, `python-probe-${randomUUID()}`),
    script = join(ordner, 'python-pruefen.py');
  await mkdir(ordner, { recursive: true }).catch(() => {
    throw new Error(
      'ScriptLab konnte keinen technischen Python-Prüfordner anlegen. Prüfe den verfügbaren Speicher und die Zugriffsrechte.',
    );
  });
  try {
    await writeFile(script, funktionsprobe(optionen.tkinter ?? false), {
      encoding: 'utf8',
      flag: 'wx',
      signal: optionen.signal,
    });
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
            '4000',
            '--token',
            randomBytes(24).toString('hex'),
            '--sprache',
            'python',
            '--interpreter',
            interpreter,
          ],
          {
            shell: false,
            windowsHide: true,
            cwd: ordner,
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );
        const dekoder = [new StringDecoder('utf8'), new StringDecoder('utf8')];
        let stdout = '',
          stderr = '',
          fehler: Error | null = null;
        let fallback: ReturnType<typeof setTimeout> | undefined;
        const stoppen = () => {
          prozess.stdin.end('STOP\n');
          fallback ??= setTimeout(() => prozess.kill(), 2500);
        };
        const frist = setTimeout(stoppen, 6000);
        optionen.signal?.addEventListener('abort', stoppen, { once: true });
        if (optionen.signal?.aborted) stoppen();
        prozess.stdout.on('data', (d: Buffer) => {
          stdout = (stdout + dekoder[0].write(d)).slice(-32768);
        });
        prozess.stderr.on('data', (d: Buffer) => {
          stderr = (stderr + dekoder[1].write(d)).slice(-32768);
        });
        prozess.stdin.on('error', () => {});
        prozess.once('error', (e) => {
          fehler = e;
        });
        prozess.once('close', (code) => {
          clearTimeout(frist);
          clearTimeout(fallback);
          optionen.signal?.removeEventListener('abort', stoppen);
          stdout += dekoder[0].end();
          stderr += dekoder[1].end();
          if (optionen.signal?.aborted) ablehnen(new Error('Die Python-Prüfung wurde abgebrochen.'));
          else if (fehler)
            ablehnen(new Error('Das feste Python-Prüfwerkzeug konnte nicht gestartet werden.'));
          else fertig({ code, stdout, stderr });
        });
      },
    );
    if (ergebnis.code !== 0 || !/^SLHOST\|GESTARTET\|[^|\r\n]+\|\d+\r?\n/.test(ergebnis.stderr)) {
      if (
        optionen.tkinter &&
        /(?:ModuleNotFoundError|ImportError):[^\r\n]*(?:tkinter|_tkinter)/i.test(ergebnis.stderr)
      )
        throw new Error(
          'Dieser Python-Installation fehlt Tkinter. Wähle für Dialogbausteine eine Installation mit Tcl/Tk. Workflows ohne Dialoge und der Export bleiben möglich.',
        );
      throw new Error(
        optionen.tkinter
          ? 'Python oder die benötigten Tk-Dialoge konnten nicht bestätigt werden. Prüfe die Installation; ScriptLab installiert keine Komponenten automatisch.'
          : 'Die feste Python-Prüfung ist fehlgeschlagen oder wurde durch Windows blockiert. Bearbeiten und Exportieren bleiben möglich.',
      );
    }
    let antwort: unknown;
    try {
      antwort = JSON.parse(ergebnis.stdout.trim());
    } catch {
      throw new Error('Python hat kein lesbares Prüfergebnis geliefert.');
    }
    return pythonAntwortPruefen(antwort, interpreter, optionen.tkinter ?? false);
  } catch (fehler) {
    if (optionen.signal?.aborted) throw new Error('Die Python-Prüfung wurde abgebrochen.');
    if (fehler instanceof Error && 'code' in fehler)
      throw new Error(
        'Die technische Python-Prüfdatei konnte nicht gespeichert werden. Prüfe Speicher und Zugriffsrechte.',
      );
    throw fehler;
  } finally {
    await unlink(script).catch(() => {});
    await rmdir(ordner).catch(() => {});
  }
}
