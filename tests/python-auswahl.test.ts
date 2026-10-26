import { describe, expect, test } from 'vitest';
import { pythonAntwortPruefen, pythonDateipfadPruefen } from '../src/windows/python';

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
