import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const windows = process.platform === 'win32';
const powershell = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
const helfer = resolve('scripts/vbs-syntax-pruefen.ps1');

function syntaxPruefen(argumente: string[]) {
  // Ein festes Entwicklungswerkzeug wird gestartet, niemals eine VBS-Datei.
  const prozess = spawnSync(
    powershell,
    ['-NoProfile', '-NonInteractive', '-File', helfer, ...argumente, '-AlsJson'],
    {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    },
  );
  if (prozess.error) throw prozess.error;
  expect(prozess.stderr).toBe('');
  return { exit: prozess.status, daten: JSON.parse(prozess.stdout.trim()) };
}

describe.skipIf(!windows)('Windows-VBScript-Parser ohne Ausfuehrung', () => {
  it('erkennt Syntaxfehler, bleibt initialisiert und erzeugt keine Sentineldatei', ({ skip }) => {
    const ergebnis = syntaxPruefen(['-Selbsttest']);
    if (ergebnis.exit === 2) skip('Optionale Windows-VBScript-Komponente ist nicht verfuegbar.');
    expect(ergebnis.exit).toBe(0);
    const test = ergebnis.daten[0];
    expect(test.status).toBe('gueltig');
    expect(test.markierungsdateiFehlt).toBe(true);
    expect(test.gueltigerCode.ZustandVorher).toBe(5);
    expect(test.gueltigerCode.ZustandNachher).toBe(5);
    expect(test.gueltigerCode.Ausfuehrungseintritte).toBe(0);
    expect(test.syntaxfehler.Status).toBe('syntaxfehler');
  });

  it('liest UTF-16LE mit BOM und CRLF als gueltigen VBS-Quelltext', ({ skip }) => {
    const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Syntax-Test-'));
    try {
      const datei = join(ordner, 'Umlaute und Leerzeichen.vbs');
      const quelle =
        'Option Explicit\r\nDim text\r\ntext = "Grüße ""aus ScriptLab""" & vbCrLf & "Nächste Zeile"\r\n';
      writeFileSync(datei, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(quelle, 'utf16le')]));
      const ergebnis = syntaxPruefen(['-Datei', datei]);
      if (ergebnis.exit === 2) skip('Optionale Windows-VBScript-Komponente ist nicht verfuegbar.');
      expect(ergebnis.exit).toBe(0);
      expect(ergebnis.daten[0].ergebnis.Status).toBe('gueltig');
      expect(ergebnis.daten[0].ergebnis.Ausfuehrungseintritte).toBe(0);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});
