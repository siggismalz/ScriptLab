import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { appLaufzeitPruefen } from '../src/windows/app-laufzeit';

describe.skipIf(process.platform !== 'win32')('Vollständig mitgelieferte Offline-App-Laufzeit', () => {
  it('prüft die verschobene Runtime mit echtem Tk, elf Paketen und unverändertem Dateibestand', async () => {
    const wurzel = resolve('artifacts/python-buendel/python');
    const manifest = JSON.parse(await readFile(join(wurzel, 'scriptlab-laufzeit.json'), 'utf8'));
    expect(manifest.nachweis).toMatchObject({ python: '3.15.2', isoliert: true, utf8: true });
    const variablen = ['TCL_LIBRARY', 'TK_LIBRARY', 'TCLLIBPATH'] as const;
    const vorher = Object.fromEntries(variablen.map((name) => [name, process.env[name]]));
    let status;
    try {
      // Einstellungen fremder Pythoninstallationen dürfen die mitgelieferten Dialoge nicht umleiten.
      for (const name of variablen)
        process.env[name] = resolve('artifacts/python-buendel/nicht-vorhandene-fremde-tcl-konfiguration');
      status = await appLaufzeitPruefen({
        wurzel,
        helper: resolve('artifacts/native/ScriptLab.Testhost.exe'),
        technischeOrdner: resolve('artifacts/python-buendel/app-pruefung'),
      });
    } finally {
      for (const name of variablen) {
        if (vorher[name] === undefined) delete process.env[name];
        else process.env[name] = vorher[name];
      }
    }
    expect(status.installation).toMatchObject({ version: '3.15.2', architektur: 'x64', tkinter: true });
    expect(status.installation.pfad.toLowerCase()).toBe(join(wurzel, 'python.exe').toLowerCase());
    expect(status.business.zustand).toBe('bereit');
    expect(status.business.pakete).toHaveLength(11);
    expect(status.business.pakete.every((p) => p.version === p.sollVersion && p.importierbar)).toBe(true);
    // -B gilt auch für echte App-Proben: importierte Module verändern das installierte Bündel nicht.
    const finden = async (ordner: string): Promise<number> => {
      let anzahl = 0;
      for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
        if (eintrag.isDirectory()) {
          expect(eintrag.name).not.toBe('__pycache__');
          anzahl += await finden(join(ordner, eintrag.name));
        } else anzahl++;
      }
      return anzahl;
    };
    expect(await finden(wurzel)).toBe(manifest.dateien.length + 1);
  }, 45000);
});
