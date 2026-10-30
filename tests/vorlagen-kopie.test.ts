import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { grundvorlageKopieren } from '../src/main/grundvorlagen';

describe('Unabhängige Eingabedaten der vorhandenen Grundvorlagen', () => {
  for (const id of ['backup', 'backup-python', 'dateiliste', 'dateiliste-python'] as const) {
    it(`kopiert für ${id} ausschließlich Testdaten in einen neuen Arbeitsordner`, async () => {
      const basis = await mkdtemp(join(tmpdir(), 'ScriptLab-Vorlagen-Kopie-'));
      try {
        const ziel = join(basis, 'Arbeitsdateien', 'Neue-Kennung');
        expect(await grundvorlageKopieren(resolve('beispiele'), ziel, id)).toBe(true);
        const ordner = id.startsWith('backup') ? 'Backup' : 'Dateiliste';
        const datei = id.startsWith('backup') ? 'Quelle/beispiel.txt' : 'Eingang/02-Notizen Größe.txt';
        expect(await readFile(join(ziel, 'ScriptLab-Testdaten', ordner, datei))).toEqual(
          await readFile(join('beispiele', 'grunddaten', ordner, datei)),
        );
        const ausgabe = join(
          ziel,
          'ScriptLab-Testdaten',
          ordner,
          id.startsWith('backup') ? 'Sicherung/beispiel.txt' : 'Dateinamen.txt',
        );
        await expect(stat(ausgabe)).rejects.toMatchObject({ code: 'ENOENT' });
        // Ein erneuter Aufruf mit belegter Kennung muss auch bearbeitete Dateien erhalten.
        const pfad = join(ziel, 'ScriptLab-Testdaten', ordner, datei);
        await writeFile(pfad, 'Eigener Stand');
        await expect(grundvorlageKopieren(resolve('beispiele'), ziel, id)).rejects.toMatchObject({
          code: 'EEXIST',
        });
        expect(await readFile(pfad, 'utf8')).toBe('Eigener Stand');
        expect(await readFile(join('beispiele', 'grunddaten', ordner, datei), 'utf8')).not.toBe(
          'Eigener Stand',
        );
      } finally {
        await rm(basis, { recursive: true, force: true });
      }
    });
  }
  it('legt für eine reine Nachrichtenvorlage keinen Testdatenordner an', async () => {
    const basis = await mkdtemp(join(tmpdir(), 'ScriptLab-Vorlagen-Ohne-Dateien-'));
    try {
      const ziel = join(basis, 'Unbenutzt');
      expect(await grundvorlageKopieren(resolve('beispiele'), ziel, 'begruessung')).toBe(false);
      await expect(stat(ziel)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(basis, { recursive: true, force: true });
    }
  });
});
