import { describe, expect, test, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdtemp, mkdir, readdir, rm, stat, truncate } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import {
  businessLockPruefen,
  businessWheelPasst,
  businessEinrichten,
  businessStatusPruefen,
  type BusinessPin,
} from '../src/windows/business-laufzeit';
import { pythonPruefen, pythonKandidatenSuchen } from '../src/windows/python';
import type { PythonInstallation } from '../src/gemeinsam/python';

const lockPfad = resolve('laufzeit/requirements-business.lock');
describe('Fester Business-Paketsatz ohne Interpreter- oder Paketstart', () => {
  test('enthält elf vollständige feste Versionen mit SHA-256 und ohne offene Zusatzabhängigkeiten', async () => {
    const pins = businessLockPruefen(await readFile(lockPfad, 'utf8'));
    expect(pins.map((p) => `${p.name}==${p.version}`)).toEqual([
      'duckdb==2.0.0',
      'openpyxl==3.1.5',
      'python-docx==1.2.0',
      'reportlab==5.1.0',
      'pypdf==6.21.2',
      'et-xmlfile==2.0.0',
      'lxml==6.1.3',
      'typing-extensions==4.16.0',
      'pillow==13.0.0',
      'charset-normalizer==3.5.2',
      'defusedxml==0.7.1',
    ]);
    expect(pins.every((p) => p.hashes.length > 0 && p.hashes.every((h) => /^[a-f0-9]{64}$/.test(h)))).toBe(
      true,
    );
  });
  test.each([
    '--extra-index-url https://example.test',
    'evil==1.0 --hash=sha256:' + 'a'.repeat(64),
    'duckdb>=2.0',
    'duckdb @ https://example.test/a.whl',
  ])('weist freie Paketmanageranweisungen zurück: %s', async (zusatz) => {
    expect(() => businessLockPruefen(zusatz)).toThrow();
  });
  test('weist fehlende oder doppelte Pakete zurück', async () => {
    const text = await readFile(lockPfad, 'utf8');
    expect(() => businessLockPruefen(text + '\nduckdb==2.0.0 --hash=sha256:' + 'a'.repeat(64))).toThrow();
    expect(() => businessLockPruefen(text.replace(/duckdb==2\.0\.0[^\n]*\n[^\n]+/, ' '))).toThrow();
  });
  const pin: BusinessPin = { name: 'duckdb', version: '2.0.0', hashes: [] };
  test.each(['cp312', 'cp313', 'cp314', 'cp315'])(
    'erlaubt das tatsächlich verfügbare DuckDB-ABI3-Wheel für %s',
    (tag) => {
      expect(businessWheelPasst('duckdb-2.0.0-cp312-abi3-win_amd64.whl', pin, tag)).toBe(true);
    },
  );
  test.each([
    'duckdb-2.0.0-cp315-cp315t-win_amd64.whl',
    'duckdb-2.0.0-cp312-cp312-win32.whl',
    'duckdb-2.0.0-cp312-cp312-manylinux_x86_64.whl',
    'duckdb-2.0.1-py3-none-any.whl',
    '../duckdb-2.0.0-py3-none-any.whl',
    'duckdb-2.0.0.tar.gz',
  ])('weist unpassende oder freie Archive zurück: %s', (datei) => {
    expect(businessWheelPasst(datei, pin, 'cp312')).toBe(false);
  });
  test('bricht vor jedem Dateizugriff oder Prozessstart bei bereits abgebrochener Einrichtung ab', async () => {
    const signal = AbortSignal.abort();
    await expect(
      businessEinrichten(
        {
          pfad: 'C:\\Nicht vorhanden\\python.exe',
          version: '3.12.6',
          architektur: 'x64',
          implementierung: 'CPython',
          tkinter: null,
        },
        {
          helper: 'NICHT STARTEN',
          technischeOrdner: 'NICHT ANLEGEN',
          paketwurzel: 'NICHT LESEN',
          laufzeitenOrdner: 'NICHT ANLEGEN',
          quelle: 'wheelhouse',
          signal,
        },
      ),
    ).rejects.toThrow(/abgebrochen/);
  });
});

// Vorhandene Umgebung lesen: niemals automatische Einrichtung in einem normalen Testlauf.
const lesenErlaubt =
  process.platform === 'win32' &&
  process.env.SCRIPTLAB_RUNTIME_TESTS === '1' &&
  !!process.env.SCRIPTLAB_BUSINESS_PYTHON;
describe.skipIf(!lesenErlaubt)('Ausdrücklich freigegebene bestehende Business-Laufzeit', () => {
  test('bestätigt alle tatsächlichen Versionen und Importe ohne Netzwerk oder Paketinstallation', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ScriptLab-BusinessLesen-'));
    try {
      const pfad = process.env.SCRIPTLAB_BUSINESS_PYTHON!;
      const installation = await pythonPruefen(pfad, {
        helper: resolve('artifacts/native/ScriptLab.Testhost.exe'),
        technischeOrdner: temp,
      });
      const status = await businessStatusPruefen(installation, {
        helper: resolve('artifacts/native/ScriptLab.Testhost.exe'),
        technischeOrdner: temp,
        paketwurzel: resolve('laufzeit'),
      });
      expect(status, JSON.stringify(status)).toMatchObject({
        zustand: 'bereit',
        profil: 'windows-cpython-312-315-x64-v1',
      });
      expect(status.pakete).toHaveLength(11);
      expect(status.pakete.every((p) => p.version === p.sollVersion && p.importierbar)).toBe(true);
    } finally {
      if (dirname(temp) !== tmpdir() || !basename(temp).startsWith('ScriptLab-BusinessLesen-'))
        throw Error('Unsicherer Tempordner.');
      await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }, 20000);
});

// Separates Einrichtungs-Opt-in; nie aus normalem Workflowtest oder Öffnen erreichbar.
const setupErlaubt =
  process.platform === 'win32' &&
  process.env.SCRIPTLAB_BUSINESS_SETUP_TESTS === '1' &&
  !!process.env.SCRIPTLAB_BUSINESS_WHEELHOUSE;
describe.skipIf(!setupErlaubt)('Bewusst freigegebene Business-Einrichtung in isolierten Tempordnern', () => {
  let basis: PythonInstallation, ordner: string, technik: string, umgebungen: string;
  const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');
  beforeAll(async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ScriptLab-BusinessBasis-'));
    try {
      const kandidaten = process.env.SCRIPTLAB_TEST_PYTHON
        ? [{ pfad: process.env.SCRIPTLAB_TEST_PYTHON }]
        : await pythonKandidatenSuchen();
      for (const k of kandidaten) {
        try {
          basis = await pythonPruefen(k.pfad, { helper, technischeOrdner: temp });
          break;
        } catch (e) {
          if (process.env.SCRIPTLAB_TEST_PYTHON) throw e;
        }
      }
      if (!basis) throw Error('Geeignete Basisruntime fehlt.');
    } finally {
      if (dirname(temp) !== tmpdir() || !basename(temp).startsWith('ScriptLab-BusinessBasis-'))
        throw Error('Unsicherer Tempordner.');
      await rm(temp, { recursive: true, force: true });
    }
  }, 15000);
  beforeEach(async () => {
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-BusinessSetup-'));
    technik = join(ordner, 'Technik');
    umgebungen = join(ordner, 'Umgebungen');
    await mkdir(technik);
    await mkdir(umgebungen);
  });
  afterEach(async () => {
    if (dirname(ordner) !== tmpdir() || !basename(ordner).startsWith('ScriptLab-BusinessSetup-'))
      throw Error('Unsicherer Tempordner.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  test('verwirft eine falsche Wheelprüfsumme vor der Paketinstallation und lässt alte Daten unverändert', async () => {
    const alt = join(umgebungen, 'Vorhandene Umgebung');
    await mkdir(alt);
    await writeFile(join(alt, 'Erhalten.txt'), 'UNVERAENDERT');
    const wheels = join(ordner, 'Falsche Wheels');
    await mkdir(wheels);
    await writeFile(join(wheels, 'duckdb-2.0.0-cp312-abi3-win_amd64.whl'), 'KEIN FREIGEGEBENES WHEEL');
    await expect(
      businessEinrichten(basis, {
        helper,
        technischeOrdner: technik,
        paketwurzel: resolve('laufzeit'),
        laufzeitenOrdner: umgebungen,
        quelle: 'wheelhouse',
        wheelhouseOrdner: wheels,
        signal: AbortSignal.timeout(10000),
      }),
    ).rejects.toThrow(/Prüfsumme/);
    expect(await readdir(umgebungen)).toEqual(['Vorhandene Umgebung']);
    expect(await readFile(join(alt, 'Erhalten.txt'), 'utf8')).toBe('UNVERAENDERT');
  }, 20000);
  test('weist ein übergroßes Offline-Wheel vor dem Lesen und Installieren zurück', async () => {
    const wheels = join(ordner, 'Zu grosse Wheels');
    await mkdir(wheels);
    const datei = join(wheels, 'duckdb-2.0.0-cp312-abi3-win_amd64.whl');
    await writeFile(datei, '');
    await truncate(datei, 100 * 1024 * 1024 + 1);
    await expect(
      businessEinrichten(basis, {
        helper,
        technischeOrdner: technik,
        paketwurzel: resolve('laufzeit'),
        laufzeitenOrdner: umgebungen,
        quelle: 'wheelhouse',
        wheelhouseOrdner: wheels,
        signal: AbortSignal.timeout(10000),
      }),
    ).rejects.toThrow(/100 MiB/);
    expect(await readdir(umgebungen)).toEqual([]);
  }, 20000);
  test('richtet die eigene Umgebung nur aus dem festen Offline-Wheelhouse ein und bestätigt alle Imports', async () => {
    const status = await businessEinrichten(basis, {
      helper,
      technischeOrdner: technik,
      paketwurzel: resolve('laufzeit'),
      laufzeitenOrdner: umgebungen,
      quelle: 'wheelhouse',
      wheelhouseOrdner: process.env.SCRIPTLAB_BUSINESS_WHEELHOUSE,
      signal: AbortSignal.timeout(25000),
    });
    expect(status, JSON.stringify(status)).toMatchObject({ zustand: 'bereit' });
    expect(status.pakete.every((p) => p.version === p.sollVersion && p.importierbar)).toBe(true);
    const eigen = dirname(dirname(status.installation.pfad));
    expect(dirname(eigen)).toBe(umgebungen);
    expect(JSON.parse(await readFile(join(eigen, 'scriptlab-business.json'), 'utf8'))).toMatchObject({
      status: 'bereit',
      lockSha256: status.lockSha256,
    });
  }, 40000);
  test('beendet eine echte begonnene venv-Einrichtung nach Abbruch und räumt nur die neue Umgebung auf', async () => {
    const controller = new AbortController();
    let abbruch: Promise<void> | null = null;
    const einrichtung = businessEinrichten(basis, {
      helper,
      technischeOrdner: technik,
      paketwurzel: resolve('laufzeit'),
      laufzeitenOrdner: umgebungen,
      quelle: 'wheelhouse',
      wheelhouseOrdner: process.env.SCRIPTLAB_BUSINESS_WHEELHOUSE,
      signal: controller.signal,
      fortschritt: (stand) => {
        if (stand.phase === 'venv')
          abbruch = (async () => {
            const ende = Date.now() + 8000;
            while (Date.now() < ende) {
              const namen = await readdir(umgebungen);
              if (
                (
                  await Promise.all(
                    namen.map((n) => stat(join(umgebungen, n, 'pyvenv.cfg')).catch(() => null)),
                  )
                ).some(Boolean)
              ) {
                controller.abort();
                return;
              }
              await new Promise((r) => setTimeout(r, 10));
            }
            controller.abort();
            throw Error('Die echte venv-Erzeugung begann nicht.');
          })();
      },
    });
    await expect(einrichtung).rejects.toThrow(/abgebrochen/);
    await abbruch;
    expect(await readdir(umgebungen)).toEqual([]);
  }, 30000);
});
