import { open, rename, unlink, readFile, stat } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { projektPruefen, type Projekt } from '../kern/projekt';

export const MAX_PROJEKT_BYTES = 5 * 1024 * 1024;

export function vbsKodieren(code: string): Buffer {
  const normalisiert = code.replace(/\r?\n/g, '\r\n');
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(normalisiert, 'utf16le')]);
}

export async function atomarSchreiben(dateipfad: string, inhalt: string | Buffer): Promise<void> {
  // Temporärdatei im selben Ordner: erst vollständig schreiben, dann atomar ersetzen.
  const zwischenpfad = join(dirname(dateipfad), `.${basename(dateipfad)}.${randomUUID()}.tmp`);
  try {
    const datei = await open(zwischenpfad, 'wx');
    try {
      await datei.writeFile(inhalt);
      await datei.sync();
    } finally {
      await datei.close();
    }
    await rename(zwischenpfad, dateipfad);
  } finally {
    await unlink(zwischenpfad).catch(() => {});
  }
}

export async function projektLesen(dateipfad: string): Promise<Projekt> {
  const info = await stat(dateipfad);
  if (!info.isFile() || info.size > MAX_PROJEKT_BYTES)
    throw new Error('Die Projektdatei ist zu groß oder keine normale Datei.');
  const text = await readFile(dateipfad, 'utf8');
  if (Buffer.byteLength(text, 'utf8') > MAX_PROJEKT_BYTES) throw new Error('Die Projektdatei ist zu groß.');
  let daten: unknown;
  try {
    daten = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Die Datei enthält kein gültiges ScriptLab-Projekt im JSON-Format.');
  }
  return projektPruefen(daten);
}

export async function projektSchreiben(dateipfad: string, projekt: Projekt): Promise<void> {
  const geprueft = projektPruefen(projekt);
  await atomarSchreiben(dateipfad, `${JSON.stringify(geprueft, null, 2)}\n`);
}

export function dateiFehler(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'EACCES' || code === 'EPERM')
    return 'Der Zugriff wurde verweigert. Bitte wähle einen beschreibbaren Ordner.';
  if (code === 'ENOENT') return 'Die Datei oder der gewählte Ordner wurde nicht gefunden.';
  if (code === 'ENOSPC') return 'Auf dem Laufwerk ist nicht genug freier Speicherplatz.';
  if (code === 'EBUSY') return 'Die Datei wird gerade von einem anderen Programm verwendet.';
  return 'Der Dateivorgang ist fehlgeschlagen. Bitte prüfe Datei, Ordner und Zugriffsrechte.';
}
