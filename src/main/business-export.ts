import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename, resolve, dirname } from 'node:path';
import type { Projekt } from '../kern/projekt';
export interface PaketDatei {
  name: string;
  inhalt: Buffer;
}
const crcTabelle = Uint32Array.from({ length: 256 }, (_, start) => {
  let w = start;
  for (let i = 0; i < 8; i++) w = (w >>> 1) ^ (w & 1 ? 0xedb88320 : 0);
  return w >>> 0;
});
function crc32(daten: Buffer): number {
  let wert = 0xffffffff;
  for (const b of daten) {
    wert = (wert >>> 8) ^ crcTabelle[(wert ^ b) & 255];
  }
  return (wert ^ 0xffffffff) >>> 0;
}
/** Kleines ZIP ohne ausführbaren Packer. Eingaben sind ausschließlich geprüfte eigene Dateien. */
export function zipErzeugen(dateien: PaketDatei[]): Buffer {
  let position = 0;
  const teile: Buffer[] = [],
    verzeichnis: Buffer[] = [];
  const namen = new Set<string>();
  for (const d of dateien) {
    if (
      !d.name ||
      /[\x00-\x1f\\:*?"<>|]/u.test(d.name) ||
      d.name.startsWith('/') ||
      d.name
        .split('/')
        .some(
          (s) =>
            !s ||
            ['.', '..'].includes(s) ||
            /[ .]$/.test(s) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s),
        ) ||
      namen.has(d.name.toLowerCase())
    )
      throw new Error('Ein Paketdateiname ist ungültig oder doppelt.');
    namen.add(d.name.toLowerCase());
    const name = Buffer.from(d.name, 'utf8'),
      crc = crc32(d.inhalt);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50);
    kopf.writeUInt16LE(20, 4);
    kopf.writeUInt16LE(0x800, 6);
    kopf.writeUInt16LE(0x21, 12);
    kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(d.inhalt.length, 18);
    kopf.writeUInt32LE(d.inhalt.length, 22);
    kopf.writeUInt16LE(name.length, 26);
    teile.push(kopf, name, d.inhalt);
    const zentral = Buffer.alloc(46);
    zentral.writeUInt32LE(0x02014b50);
    zentral.writeUInt16LE(20, 4);
    zentral.writeUInt16LE(20, 6);
    zentral.writeUInt16LE(0x800, 8);
    zentral.writeUInt16LE(0x21, 14);
    zentral.writeUInt32LE(crc, 16);
    zentral.writeUInt32LE(d.inhalt.length, 20);
    zentral.writeUInt32LE(d.inhalt.length, 24);
    zentral.writeUInt16LE(name.length, 28);
    zentral.writeUInt32LE(position, 42);
    verzeichnis.push(zentral, name);
    position += 30 + name.length + d.inhalt.length;
  }
  const zentral = Buffer.concat(verzeichnis),
    ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50);
  ende.writeUInt16LE(dateien.length, 8);
  ende.writeUInt16LE(dateien.length, 10);
  ende.writeUInt32LE(zentral.length, 12);
  ende.writeUInt32LE(position, 16);
  return Buffer.concat([...teile, zentral, ende]);
}
export async function businessPaketDateien(
  projekt: Projekt,
  code: string,
  paketwurzel: string,
  ressourcen: string[],
  basis?: string,
): Promise<PaketDatei[]> {
  const dateien: PaketDatei[] = [{ name: 'workflow.py', inhalt: Buffer.from(code, 'utf8') }];
  for (const name of (await readdir(join(paketwurzel, 'scriptlab_business'))).sort())
    if (/^[a-z_]+\.py$/.test(name))
      dateien.push({
        name: `scriptlab_business/${name}`,
        inhalt: await readFile(join(paketwurzel, 'scriptlab_business', name)),
      });
  for (const name of ['Vera.ttf', 'bitstream-vera-license.txt', 'HERKUNFT.md'])
    dateien.push({
      name: `scriptlab_business/schriften/${name}`,
      inhalt: await readFile(join(paketwurzel, 'scriptlab_business', 'schriften', name)),
    });
  for (const name of ['requirements-business.lock', 'requirements-business.in', 'business-notices.md'])
    dateien.push({ name, inhalt: await readFile(join(paketwurzel, name)) });
  dateien.push({ name: 'LICENSE.txt', inhalt: await readFile(join(dirname(paketwurzel), 'LICENSE.txt')) });
  const parameter = Object.fromEntries(projekt.business.parameter.map((p) => [p.name, p.standard ?? '']));
  let summe = dateien.reduce((s, d) => s + d.inhalt.length, 0);
  for (const pfad of ressourcen) {
    const s = await stat(pfad);
    if (!s.isFile() || s.size > 16 * 1024 ** 2 || !/\.(docx|xlsx|ttf|png|jpg|jpeg)$/i.test(pfad))
      throw new Error('Eine ausgewählte Ressource ist ungeeignet oder größer als 16 MiB.');
    summe += s.size;
    if (summe > 64 * 1024 ** 2) throw new Error('Das Business-Paket darf höchstens 64 MiB enthalten.');
    const name = `ressourcen/${basename(pfad)}`;
    dateien.push({ name, inhalt: await readFile(pfad) });
    for (const p of projekt.business.parameter)
      if (
        [p.standard, projekt.business.parametersaetze.test[p.name]].some(
          (w) =>
            typeof w === 'string' &&
            (w === pfad ||
              (basis &&
                resolve(basis, w).toLocaleLowerCase('de-DE') === resolve(pfad).toLocaleLowerCase('de-DE'))),
        )
      )
        parameter[p.name] = name;
  }
  dateien.push({
    name: 'parameter-beispiel.json',
    inhalt: Buffer.from(JSON.stringify(parameter, null, 2) + '\n'),
  });
  dateien.push({
    name: 'ANLEITUNG.txt',
    inhalt: Buffer.from(
      'ScriptLab-Business-Paket – Entwickelt von Leon Stolz\r\n\r\nWindows 11 x64, CPython 3.12–3.15 (64 Bit).\r\nEine eigene vorbereitete Python-Umgebung verwenden. Keine Pakete werden automatisch installiert.\r\nBewusste Einrichtung: python -m venv .venv\r\n.venv\\Scripts\\python.exe -m pip install --require-hashes --only-binary=:all: -r requirements-business.lock\r\nOffline: --no-index --find-links <vorbereiteter Paketordner> ergänzen.\r\nparameter-beispiel.json prüfen und mit eigenen nicht geheimen Werten ergänzen.\r\nPrüflauf: .venv\\Scripts\\python.exe workflow.py --parameter-datei parameter-beispiel.json --modus prueflauf\r\nAusführung: .venv\\Scripts\\python.exe workflow.py --parameter-datei parameter-beispiel.json --modus ausfuehren --zeitlimit 7200\r\nRelative Pfade beziehen sich standardmäßig auf den Scriptordner; --basis <Ordner> legt den Bezug ausdrücklich fest. Absolute Pfade bleiben absolut.\r\n--journal <Datei> wählt ein eigenes Journal; --fortsetzen verlangt denselben Workflow, Parameter und unveränderte Quellen/Ergebnisse. Unklare Schritte werden nicht automatisch wiederholt.\r\nExitcodes: 0 ohne gemeldeten Fehler, 1 fehlgeschlagen/unklar, 2 mit gemeldeten Teilfehlern. Ein Ergebnis muss fachlich geprüft werden.\r\nStoppen macht Dateiänderungen nicht rückgängig. Python-Scripts sind nicht durch die ScriptLab-Installersignatur signiert.\r\nOffice-Konvertierung und OCR sind nicht enthalten. openpyxl berechnet keine Formeln. DOCX unterstützt definierte {{Name}}-Platzhalter. PDF benötigt eine geeignete lokal verfügbare TTF-Schrift.\r\nLizenzen der Abhängigkeiten und ausdrücklich ausgewählten Ressourcen vor Weitergabe prüfen.\r\n',
      'utf8',
    ),
  });
  const anleitung = dateien.find((d) => d.name === 'ANLEITUNG.txt')!;
  anleitung.inhalt = Buffer.concat([
    anleitung.inhalt,
    Buffer.from(
      '\r\nScriptLab-Nutzungsrechte: siehe LICENSE.txt. Private nichtkommerzielle Nutzung ist kostenlos. Kommerzielle Erstellung und Bearbeitung erfordert eine separat erworbene Lizenz von Leon Stolz. Rechtmäßig erzeugte Exporte benötigen beim Empfänger keine zusätzliche ScriptLab-Lizenz. Fremdkomponenten behalten ihre eigenen Lizenzen.\r\n',
      'utf8',
    ),
  ]);
  return dateien;
}
