import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir, realpath, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import {
  mlProfilLesen,
  mlStatusPruefen,
  mlEinrichten,
  mlInstallationErmitteln,
  type MLLaufzeitOptionen,
} from '../src/windows/ml-laufzeit';

async function mitOrdner(arbeit: (ordner: string) => Promise<void>) {
  const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-ML-Profil-'));
  try {
    await arbeit(ordner);
  } finally {
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-ML-Profil-')
    )
      throw Error('Unsicherer ML-Testpfad.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
async function profilKopie(ordner: string) {
  await writeFile(join(ordner, 'ml-profil.json'), await readFile('laufzeit/ml-profil.json'));
  await writeFile(join(ordner, 'requirements-ml.lock'), await readFile('laufzeit/requirements-ml.lock'));
}
function optionen(ordner: string): MLLaufzeitOptionen {
  return {
    basisWurzel: resolve('artifacts/python-buendel/python'),
    wurzel: join(ordner, 'Profile'),
    helper: resolve('artifacts/native/ScriptLab.Testhost.exe'),
    technischeOrdner: join(ordner, 'Technik'),
    paketwurzel: resolve('laufzeit'),
  };
}
describe('Festes optionales CPU-ML-Profil', () => {
  it('bindet sämtliche 21 direkten und transitiven Pakete an konkrete Wheels, Größen und Hashes', async () => {
    const p = await mlProfilLesen(resolve('laufzeit'));
    expect(p.pakete).toHaveLength(21);
    expect(new Set(p.pakete.map((p) => p.name)).size).toBe(21);
    expect(p.pakete.find((p) => p.name === 'torch')).toMatchObject({
      version: '2.15.0+cpu',
      bytes: 128632218,
      wheel: 'torch-2.15.0+cpu-cp315-cp315-win_amd64.whl',
    });
    expect(p.pakete.find((p) => p.name === 'skops')?.version).toBe('0.16.0');
    expect(p.pakete.every((p) => p.sha256.length === 64 && p.bytes > 0)).toBe(true);
  });
  it('weist veränderte Lockdateien zurück statt einen Resolver zu starten', async () =>
    mitOrdner(async (ordner) => {
      await profilKopie(ordner);
      await writeFile(join(ordner, 'requirements-ml.lock'), 'torch\n');
      await expect(mlProfilLesen(ordner)).rejects.toThrow('Paketliste');
    }));
  it('weist zusätzliche Lockeinträge auch mit nachgeführtem Dateihash zurück', async () =>
    mitOrdner(async (ordner) => {
      await profilKopie(ordner);
      const lock =
        (await readFile(join(ordner, 'requirements-ml.lock'), 'utf8')) +
        'fremdes-paket==1.0 --hash=sha256:' +
        'a'.repeat(64) +
        '\n';
      await writeFile(join(ordner, 'requirements-ml.lock'), lock);
      const p = JSON.parse(await readFile(join(ordner, 'ml-profil.json'), 'utf8'));
      p.lockSha256 = createHash('sha256').update(lock).digest('hex');
      await writeFile(join(ordner, 'ml-profil.json'), JSON.stringify(p));
      await expect(mlProfilLesen(ordner)).rejects.toThrow('nicht freigegebene Einträge');
    }));
  it('meldet fehlende App-Metadaten als Fehler statt als noch nicht eingerichtetes Profil', async () =>
    mitOrdner(async (ordner) => {
      expect((await mlStatusPruefen({ ...optionen(ordner), paketwurzel: ordner })).zustand).toBe('fehler');
    }));
  it.each(['http://files.pythonhosted.org/torch.whl', 'https://fremd.invalid/torch.whl'])(
    'weist nicht freigegebene Wheelquelle %s zurück',
    async (url) =>
      mitOrdner(async (ordner) => {
        await profilKopie(ordner);
        const p = JSON.parse(await readFile(join(ordner, 'ml-profil.json'), 'utf8'));
        p.pakete[0].url = url;
        await writeFile(join(ordner, 'ml-profil.json'), JSON.stringify(p));
        await expect(mlProfilLesen(ordner)).rejects.toThrow('Paketquelle');
      }),
  );
  it('weist einen fremden Importnamen und doppelte Pins zurück', async () =>
    mitOrdner(async (ordner) => {
      await profilKopie(ordner);
      const p = JSON.parse(await readFile(join(ordner, 'ml-profil.json'), 'utf8'));
      p.pakete[0].modul = 'beliebiger_code';
      await writeFile(join(ordner, 'ml-profil.json'), JSON.stringify(p));
      await expect(mlProfilLesen(ordner)).rejects.toThrow('Paketquelle');
      p.pakete[0] = p.pakete[1];
      await writeFile(join(ordner, 'ml-profil.json'), JSON.stringify(p));
      await expect(mlProfilLesen(ordner)).rejects.toThrow('nicht freigegebene Einträge');
    }));
  it('prüft fehlende Profile ohne Einrichtung oder Download und erhält fremde Dateien', async () =>
    mitOrdner(async (ordner) => {
      const o = optionen(ordner);
      await mkdir(o.wurzel);
      await writeFile(join(o.wurzel, 'Eigene Datei.txt'), 'Original');
      const p = await mlStatusPruefen(o);
      expect(p.zustand).toBe('fehlt');
      expect(p.installation).toBeNull();
      await expect(mlInstallationErmitteln(o)).rejects.toThrow('noch nicht eingerichtet');
      expect(await readdir(o.wurzel)).toEqual(['Eigene Datei.txt']);
      expect(await readFile(join(o.wurzel, 'Eigene Datei.txt'), 'utf8')).toBe('Original');
    }));
  it('weist eine manipulierte aktive Ordnerreferenz zurück, ohne deren Ziel zu berühren', async () =>
    mitOrdner(async (ordner) => {
      const o = optionen(ordner);
      await mkdir(o.wurzel);
      await writeFile(join(ordner, 'Original.txt'), 'Erhalten');
      await writeFile(
        join(o.wurzel, 'aktiv.json'),
        JSON.stringify({ schemaVersion: 1, ordner: '../FremdesProfil', manifestHash: 'a'.repeat(64) }),
      );
      expect((await mlStatusPruefen(o)).zustand).toBe('fehler');
      expect(await readFile(join(ordner, 'Original.txt'), 'utf8')).toBe('Erhalten');
    }));
  it('lehnt relative Offlinepfade und Ziele innerhalb der Basis vor Seiteneffekten ab', async () =>
    mitOrdner(async (ordner) => {
      const o = optionen(ordner);
      await expect(mlEinrichten(o, '')).rejects.toThrow('Wheelhouse');
      await expect(mlEinrichten({ ...o, wurzel: join(o.basisWurzel, 'Falsches Ziel') })).rejects.toThrow(
        'Basis-Python',
      );
    }));
});

describe.skipIf(process.platform !== 'win32' || process.env.SCRIPTLAB_ML_TESTS !== '1')(
  'Echte freigegebene ML-Profilprüfungen unter Windows',
  () => {
    it('bestätigt das tatsächlich vorbereitete Profil mit CPU-Imports und stabilen Konsolenstarterpfaden', async () => {
      const o = { ...optionen(resolve('artifacts/ml')), wurzel: resolve('artifacts/ml/laufzeit') };
      const s = await mlStatusPruefen(o);
      expect(s.zustand, s.meldung).toBe('bereit');
      expect(s.installation?.version).toBe('3.15.2');
      expect(s.pakete.every((p) => p.importierbar && p.version === p.sollVersion)).toBe(true);
      const launcher = await readFile(join(dirname(s.installation!.pfad), 'Scripts', 'torchrun.exe'));
      expect(launcher.includes(Buffer.from(s.installation!.pfad))).toBe(true);
    }, 120000);
    it(
      'bewahrt den aktiven Zeiger und die Basis bei fehlerhaften Offline-Wheels sowie frühem Abbruch',
      async () =>
        mitOrdner(async (ordner) => {
          const o = optionen(ordner);
          await mkdir(o.wurzel);
          await writeFile(join(o.wurzel, 'aktiv.json'), 'VORHERIGER AKTIVER STAND');
          const basisManifest = await readFile(join(o.basisWurzel, 'scriptlab-laufzeit.json'));
          const offline = join(ordner, 'Offline');
          await mkdir(offline);
          await writeFile(join(offline, 'torch-2.15.0+cpu-cp315-cp315-win_amd64.whl'), 'FALSCH');
          await expect(mlEinrichten(o, offline)).rejects.toThrow('Wheel');
          expect(await readFile(join(o.wurzel, 'aktiv.json'), 'utf8')).toBe('VORHERIGER AKTIVER STAND');
          expect(await readdir(o.wurzel)).not.toContain('einrichtung.lock');
          expect((await readdir(o.wurzel)).some((n) => n.startsWith('profil-'))).toBe(false);
          const c = new AbortController();
          c.abort();
          await expect(mlEinrichten({ ...o, signal: c.signal }, offline)).rejects.toThrow();
          expect(await readFile(join(o.basisWurzel, 'scriptlab-laufzeit.json'))).toEqual(basisManifest);
          expect(await readFile(join(o.wurzel, 'aktiv.json'), 'utf8')).toBe('VORHERIGER AKTIVER STAND');
        }),
      120000,
    );
    it(
      'entfernt nach Abbruch hinter der vollständigen Basiskopie nur das eigene neue Profil',
      async () =>
        mitOrdner(async (ordner) => {
          const o = optionen(ordner),
            c = new AbortController();
          const alt = 'profil-11111111-1111-4111-8111-111111111111';
          await mkdir(join(o.wurzel, alt), { recursive: true });
          await writeFile(join(o.wurzel, alt, 'Original.txt'), 'Vorheriges Profil');
          await writeFile(join(o.wurzel, 'aktiv.json'), 'Alter Zeiger');
          let bootstrap = false;
          await expect(
            mlEinrichten(
              {
                ...o,
                signal: c.signal,
                fortschritt: (s) => {
                  if (s.phase === 'bootstrap') {
                    bootstrap = true;
                    c.abort();
                  }
                },
              },
              resolve('artifacts/ml/wheels'),
            ),
          ).rejects.toThrow();
          expect(bootstrap).toBe(true);
          expect((await readdir(o.wurzel)).filter((n) => n.startsWith('profil-'))).toEqual([alt]);
          expect(await readFile(join(o.wurzel, alt, 'Original.txt'), 'utf8')).toBe('Vorheriges Profil');
          expect(await readFile(join(o.wurzel, 'aktiv.json'), 'utf8')).toBe('Alter Zeiger');
          expect(await readdir(o.wurzel)).not.toContain('einrichtung.lock');
        }),
      120000,
    );
    it(
      'akzeptiert echte Windows-Kurzpfade und weist Junctions vor der Profilkopie zurück',
      async (kontext) =>
        mitOrdner(async (ordner) => {
          const lang = join(ordner, 'Profilwurzel mit langem Namen');
          await mkdir(lang);
          const { stdout } = await promisify(execFile)(
            join(
              process.env.SystemRoot ?? 'C:\\Windows',
              'System32',
              'WindowsPowerShell',
              'v1.0',
              'powershell.exe',
            ),
            [
              '-NoLogo',
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              String.raw`
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$fso = New-Object -ComObject Scripting.FileSystemObject
[Console]::Write($fso.GetFolder($env:SCRIPTLAB_ML_KURZPFAD).ShortPath)
`,
            ],
            {
              windowsHide: true,
              timeout: 10000,
              encoding: 'utf8',
              env: { ...process.env, SCRIPTLAB_ML_KURZPFAD: lang },
            },
          );
          const kurz = stdout.trim().replace(/^\uFEFF/, '');
          expect(await realpath(kurz)).toBe(await realpath(lang));
          if (kurz.toLowerCase() === lang.toLowerCase()) {
            kontext.skip();
            return;
          }
          const o = { ...optionen(ordner), wurzel: kurz };
          const offline = join(ordner, 'Fehlende Wheels');
          await mkdir(offline);
          // Erreicht die Wheelprüfung: der echte 8.3-Name wird nicht als Umleitung verworfen.
          await expect(mlEinrichten(o, offline)).rejects.toThrow(/ENOENT.*torch.*whl/);
          const verweis = join(ordner, 'Junction');
          await symlink(lang, verweis, 'junction');
          await expect(mlEinrichten({ ...o, wurzel: verweis }, offline)).rejects.toThrow('Junctions');
          expect(await readdir(lang)).toEqual(['wheels']);
        }),
      120000,
    );
  },
);
