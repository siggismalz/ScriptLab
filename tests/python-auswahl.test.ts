import { describe, expect, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pythonAntwortPruefen, pythonDateipfadPruefen, pythonPruefen } from '../src/windows/python';

describe('Vertrauensgrenzen der Python-Auswahl ohne Prozessstart', () => {
  const pfad = 'C:\\Programme mit Leerzeichen\\Python315\\python.exe';
  const antwort = {
    pfad,
    version: '3.15.2',
    implementierung: 'CPython',
    bits: 64,
    plattform: 'win32',
    stabil: true,
    isoliert: true,
    utf8: true,
    tkinter: null,
  };
  test.each([
    'python',
    'python.exe',
    'py.exe',
    'C:python.exe',
    'C:\\Python\\py.exe',
    'C:\\Python\\pymanager.exe',
    'C:\\Users\\Beispiel\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
    'C:\\Python\\python.exe --version',
    'C:\\Python\\python.exe\r\n',
  ])('weist Befehle, Launcher und Aliasse zurück: %s', (wert) => {
    expect(() => pythonDateipfadPruefen(wert)).toThrow();
  });
  test('erhält einen ausdrücklich gewählten absoluten Runtime- oder venv-Pfad', () => {
    expect(pythonDateipfadPruefen(pfad)).toBe(pfad);
    expect(pythonDateipfadPruefen('C:\\Projekt\\.venv\\Scripts\\python.exe')).toBe(
      'C:\\Projekt\\.venv\\Scripts\\python.exe',
    );
  });
  test.skipIf(process.platform !== 'win32')(
    'erkennt fehlende und ungeeignete echte Dateien vor einem Prozessstart',
    async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Python-Dateiguard-'));
      try {
        const interpreter = join(ordner, 'python.exe');
        const optionen = {
          helper: join(ordner, 'Nicht vorhandener Testhost.exe'),
          technischeOrdner: join(ordner, 'Technisch'),
        };
        await expect(pythonPruefen(interpreter, optionen)).rejects.toThrow(
          /Python-Datei konnte nicht gelesen werden/,
        );
        await writeFile(interpreter, 'Dies ist nur eine eigene Testdatei und kein Programm.', 'utf8');
        await expect(pythonPruefen(interpreter, optionen)).rejects.toThrow(
          'Die gewählte Datei ist keine Windows-Python-Laufzeit.',
        );
      } finally {
        if (
          dirname(resolve(ordner)) !== resolve(tmpdir()) ||
          !basename(ordner).startsWith('ScriptLab-Python-Dateiguard-')
        )
          throw new Error('Unsicherer temporärer Dateiguard-Testpfad.');
        await rm(ordner, { recursive: true, force: true });
      }
    },
  );
  test('akzeptiert nur den geprüften CPython-Pfad und trennt ungeprüftes Tk von vorhandenem Tk', () => {
    expect(pythonAntwortPruefen(antwort, pfad.toLowerCase(), false)).toMatchObject({
      version: '3.15.2',
      architektur: 'x64',
      tkinter: null,
    });
    expect(() => pythonAntwortPruefen(antwort, pfad, true)).toThrow(/Tk/);
    expect(pythonAntwortPruefen({ ...antwort, tkinter: true }, pfad, true).tkinter).toBe(true);
  });
  test.each([
    { version: '3.11.9' },
    { version: '3.16.0' },
    { version: '3.15.0rc1' },
    { stabil: false },
    { implementierung: 'PyPy' },
    { bits: 32 },
    { plattform: 'linux' },
    { isoliert: false },
    { utf8: false },
    { pfad: 'C:\\Andere Installation\\python.exe' },
  ])('weist ein ungeeignetes Probeergebnis zurück: %j', (aenderung) => {
    expect(() => pythonAntwortPruefen({ ...antwort, ...aenderung }, pfad, false)).toThrow();
  });
});
