import { spawnSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as Blockly from 'blockly/core';
import { describe, expect, it } from 'vitest';
import { registriereBausteine } from '../src/editor/bausteine';
import { projektPruefen, type EditorBlock, type Projekt } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';

const vorlagen = [
  { datei: '01-Begruessung.scriptlab', sprache: 'vbs', schema: 1, zahl: 3 },
  { datei: '02-Datei-Backup.scriptlab', sprache: 'vbs', schema: 1, zahl: 13 },
  { datei: '03-Dateinamenliste.scriptlab', sprache: 'vbs', schema: 1, zahl: 17 },
  { datei: '04-Python-Begruessung.scriptlab', sprache: 'python', schema: 2, zahl: 3 },
  { datei: '05-Python-Datei-Backup.scriptlab', sprache: 'python', schema: 2, zahl: 13 },
  { datei: '06-Python-Dateinamenliste.scriptlab', sprache: 'python', schema: 2, zahl: 17 },
] as const;
type Sprache = 'vbs' | 'python';
const daten = resolve('beispiele/grunddaten');
const backupQuelle = join('ScriptLab-Testdaten', 'Backup', 'Quelle', 'beispiel.txt');
const backupZiel = join('ScriptLab-Testdaten', 'Backup', 'Sicherung', 'beispiel.txt');
const listenEingang = join('ScriptLab-Testdaten', 'Dateiliste', 'Eingang');
const listenZiel = join('ScriptLab-Testdaten', 'Dateiliste', 'Dateinamen.txt');
const backupErfolg = 'Die Testdatei wurde nach ScriptLab-Testdaten\\Backup\\Sicherung\\beispiel.txt kopiert.';
const listenErfolg = 'Die Dateinamen stehen jetzt in ScriptLab-Testdaten\\Dateiliste\\Dateinamen.txt.';
const ueberschrift = 'Dateinamen im Testordner:\r\n';
const sollListe = ueberschrift + '01-Bericht.txt\r\n02-Notizen Größe.txt\r\n03-Werte.csv\r\n';

function laden(datei: string): Projekt {
  return projektPruefen(JSON.parse(readFileSync(resolve('beispiele', datei), 'utf8')));
}
function fuer(sprache: Sprache, aufgabe: 'Backup' | 'Dateinamenliste'): Projekt {
  return laden(vorlagen.find((v) => v.sprache === sprache && v.datei.includes(aufgabe))!.datei);
}
function bloecke(projekt: Projekt): EditorBlock[] {
  const ergebnis: EditorBlock[] = [];
  const offen = [...(projekt.editor.blocks?.blocks ?? [])];
  while (offen.length) {
    const block = offen.pop()!;
    ergebnis.push(block);
    if (block.next) offen.push(block.next.block);
    for (const eingang of Object.values(block.inputs ?? {})) {
      if (eingang.block) offen.push(eingang.block);
      if (eingang.shadow) offen.push(eingang.shadow);
    }
  }
  return ergebnis;
}
function dateistand(ordner: string): Record<string, string> {
  const ergebnis: Record<string, string> = {};
  const lesen = (pfad: string) => {
    for (const eintrag of readdirSync(pfad, { withFileTypes: true })) {
      const datei = join(pfad, eintrag.name);
      if (eintrag.isDirectory()) lesen(datei);
      else ergebnis[relative(ordner, datei)] = readFileSync(datei).toString('base64');
    }
  };
  lesen(ordner);
  return ergebnis;
}
function mitOrdner(pruefung: (ordner: string) => void): void {
  const ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Grundvorlagen-'));
  try {
    pruefung(ordner);
  } finally {
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-Grundvorlagen-')
    )
      throw new Error('Unsicherer temporärer Vorlagenpfad.');
    rmSync(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
function vorbereiten(ordner: string, art: 'Backup' | 'Dateiliste'): string {
  const basis = join(ordner, 'Arbeitsordner mit Umlaut ä');
  mkdirSync(basis, { recursive: true });
  cpSync(join(daten, art), join(basis, 'ScriptLab-Testdaten', art), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return basis;
}

registriereBausteine();
describe('Grundvorlagen: Dateiformat, Erklärung und nicht ausführende Vorbereitung', () => {
  it.each(vorlagen)('$datei erhält Sprache, Bestandskennungen und Generator-Rundreise', (vorlage) => {
    const roh = JSON.parse(readFileSync(resolve('beispiele', vorlage.datei), 'utf8'));
    expect(roh.schemaVersion).toBe(vorlage.schema);
    expect(roh.skriptsprache).toBe(vorlage.sprache === 'python' ? 'python' : undefined);
    const projekt = projektPruefen(roh);
    expect(projekt.skriptsprache).toBe(vorlage.sprache);
    expect(
      bloecke(projekt)
        .map((b) => b.id)
        .sort(),
    ).toEqual(
      [...Array.from({ length: vorlage.zahl }, (_, i) => `beispiel_${i + 1}`), 'vorlage_hinweis'].sort(),
    );
    expect(projekt.beschreibung).toContain('Ausführen');
    expect(bloecke(projekt).find((b) => b.type === 'sl_comment')?.fields?.TEXT).toBeTruthy();
    const vorher = dateistand(daten);
    const workspace = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(projekt.editor, workspace);
      const erneut = projektPruefen({ ...projekt, editor: Blockly.serialization.workspaces.save(workspace) });
      expect(erneut.skriptsprache).toBe(vorlage.sprache);
      expect(
        bloecke(erneut)
          .map((b) => b.id)
          .sort(),
      ).toEqual(
        bloecke(projekt)
          .map((b) => b.id)
          .sort(),
      );
      const kommentare = (p: Projekt) =>
        bloecke(p)
          .filter((b) => b.icons?.comment)
          .map((b) => [b.id, (b.icons!.comment as { text: string }).text]);
      expect(kommentare(erneut)).toEqual(kommentare(projekt));
      const vorschau = skriptErzeugen(projekt);
      expect(vorschau.meldungen).toEqual([]);
      expect(vorschau.code).toBeTruthy();
      expect(skriptErzeugen(erneut).code).toBe(vorschau.code);
      expect(skriptErzeugen(projekt, { modus: 'export' }).code).toBe(vorschau.code);
      expect(skriptErzeugen(projekt, { modus: 'test', token: 'a'.repeat(48) }).meldungen).toEqual([]);
      expect(dateistand(daten)).toEqual(vorher);
    } finally {
      workspace.dispose();
    }
  });

  it('erklärt dieselben Abläufe in beiden Sprachen und erhält den bewussten Nachrichtendialog', () => {
    for (let i = 0; i < 3; i++) {
      const vbs = laden(vorlagen[i].datei),
        python = laden(vorlagen[i + 3].datei);
      expect(vbs.editor).toEqual(python.editor);
      expect(vbs.beschreibung).toBe(python.beschreibung);
      expect(bloecke(vbs).filter((b) => b.type === 'sl_message')).toHaveLength(i === 0 ? 1 : 0);
      if (i === 1) expect(bloecke(vbs).find((b) => b.type === 'sl_copy')?.fields?.ZIELREGEL).toBe('FEHLER');
    }
  });

  it('liefert ausschließlich synthetische Eingänge, einschließlich einer nicht rekursiv zu lesenden Datei', () => {
    expect(Object.keys(dateistand(daten)).sort()).toEqual(
      [
        join('Backup', 'Quelle', 'beispiel.txt'),
        join('Dateiliste', 'Eingang', '01-Bericht.txt'),
        join('Dateiliste', 'Eingang', '02-Notizen Größe.txt'),
        join('Dateiliste', 'Eingang', '03-Werte.csv'),
        join('Dateiliste', 'Eingang', 'Unterordner', 'nicht-auflisten.txt'),
      ].sort(),
    );
    expect(readFileSync(join(daten, 'Backup', 'Quelle', 'beispiel.txt'), 'utf8')).toContain('Synthetische');
  });
});

// Diese explizit freigegebenen Proben starten ausschließlich eigene erzeugte Skripte im Tempordner.
// WSH-Semantikproben verwenden wie die bestehende Windows-Suite 30 Sekunden pro Hoststart.
const nativeFreigabe = process.platform === 'win32' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
function ausfuehren(projekt: Projekt, basis: string, modus: 'test' | 'export') {
  const sprache = projekt.skriptsprache;
  const token = randomBytes(24).toString('hex');
  const erzeugt = skriptErzeugen(projekt, modus === 'test' ? { modus, token } : { modus });
  expect(erzeugt.meldungen).toEqual([]);
  expect(erzeugt.code).toBeTruthy();
  const technik = join(dirname(basis), 'Technik');
  mkdirSync(technik, { recursive: true });
  // Export muss seine Pfade selbstständig am Skriptort auflösen, selbst bei fremdem cwd.
  const script = join(modus === 'export' ? basis : technik, `probe.${sprache === 'vbs' ? 'vbs' : 'py'}`);
  writeFileSync(
    script,
    sprache === 'vbs'
      ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(erzeugt.code!, 'utf16le')])
      : Buffer.from(erzeugt.code!, 'utf8'),
  );
  const stdoutDatei = join(technik, 'stdout.txt'),
    stderrDatei = join(technik, 'stderr.txt');
  const stdout = openSync(stdoutDatei, 'w'),
    stderr = openSync(stderrDatei, 'w');
  const befehl =
    sprache === 'vbs'
      ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cscript.exe')
      : resolve(process.env.SCRIPTLAB_TEST_PYTHON ?? 'artifacts/python-buendel/python/python.exe');
  const argumente =
    sprache === 'vbs'
      ? [
          '//nologo',
          '//U',
          script,
          ...(modus === 'test' ? [`/ScriptLabBasis:${basis}`, `/ScriptLabTestToken:${token}`] : []),
        ]
      : [
          '-I',
          '-B',
          '-u',
          '-X',
          'utf8',
          script,
          ...(modus === 'test' ? ['--scriptlab-basis', basis, '--scriptlab-token', token] : []),
        ];
  let prozess: ReturnType<typeof spawnSync>;
  try {
    prozess = spawnSync(befehl, argumente, {
      cwd: technik,
      shell: false,
      windowsHide: true,
      timeout: 30000,
      stdio: ['ignore', stdout, stderr],
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  if (prozess.error) throw prozess.error;
  expect(prozess.signal).toBeNull();
  const kodierung = sprache === 'vbs' ? 'utf16le' : 'utf8';
  return {
    status: prozess.status,
    stdout: readFileSync(stdoutDatei, kodierung).replace(/^\uFEFF/, ''),
    stderr: readFileSync(stderrDatei, kodierung).replace(/^\uFEFF/, ''),
    token,
  };
}

describe.skipIf(!nativeFreigabe)('Grundvorlagen: echte Windows-Ergebnisse für Python und VBS', () => {
  for (const sprache of ['vbs', 'python'] as const) {
    for (const modus of ['test', 'export'] as const) {
      it(`${sprache}/${modus}: Backup erstellt eine bytegleiche Sicherung und lässt die Quelle erhalten`, () => {
        mitOrdner((ordner) => {
          const basis = vorbereiten(ordner, 'Backup');
          const original = readFileSync(join(basis, backupQuelle));
          const lauf = ausfuehren(fuer(sprache, 'Backup'), basis, modus);
          expect(lauf.status, lauf.stderr).toBe(0);
          expect(lauf.stdout).toBe(backupErfolg + '\r\n');
          expect(lauf.stderr).toBe('');
          expect(readFileSync(join(basis, backupQuelle))).toEqual(original);
          expect(readFileSync(join(basis, backupZiel))).toEqual(original);
        });
      }, 35000);

      it(`${sprache}/${modus}: Dateiliste liefert unabhängige Sollnamen und erhält sämtliche Eingänge`, () => {
        mitOrdner((ordner) => {
          const basis = vorbereiten(ordner, 'Dateiliste');
          const originale = dateistand(join(basis, listenEingang));
          writeFileSync(join(basis, listenZiel), 'ALTE ERGEBNISLISTE – wird bewusst ersetzt', 'utf8');
          const lauf = ausfuehren(fuer(sprache, 'Dateinamenliste'), basis, modus);
          expect(lauf.status, lauf.stderr).toBe(0);
          expect(lauf.stdout).toBe(listenErfolg + '\r\n');
          expect(lauf.stderr).toBe('');
          expect(readFileSync(join(basis, listenZiel), 'utf8').replace(/^\uFEFF/, '')).toBe(sollListe);
          expect(dateistand(join(basis, listenEingang))).toEqual(originale);
        });
      }, 35000);
    }

    it(`${sprache}: vorhandene Sicherung bleibt bytegleich; kein Erfolg wird gemeldet`, () => {
      mitOrdner((ordner) => {
        const basis = vorbereiten(ordner, 'Backup');
        const original = readFileSync(join(basis, backupQuelle));
        const ziel = join(basis, backupZiel);
        mkdirSync(dirname(ziel), { recursive: true });
        const vorher = Buffer.from('BESTEHENDE SICHERUNG\r\nMit anderen Bytes ä.', 'utf8');
        writeFileSync(ziel, vorher);
        const lauf = ausfuehren(fuer(sprache, 'Backup'), basis, 'test');
        expect(lauf.status).toBe(1);
        expect(lauf.stdout).not.toContain(backupErfolg);
        expect(lauf.stderr).toContain(`SLFEHLER|${lauf.token}|beispiel_5|`);
        expect(readFileSync(ziel)).toEqual(vorher);
        expect(readFileSync(join(basis, backupQuelle))).toEqual(original);
      });
    }, 35000);

    it(`${sprache}: fehlende Backupquelle beendet als Fehler und legt keine Sicherung an`, () => {
      mitOrdner((ordner) => {
        const basis = join(ordner, 'Arbeitsordner ohne Quelle ä');
        mkdirSync(basis);
        const lauf = ausfuehren(fuer(sprache, 'Backup'), basis, 'test');
        expect(lauf.status).toBe(1);
        expect(lauf.stdout).toContain('Die Quelle fehlt.');
        expect(lauf.stdout).not.toContain(backupErfolg);
        expect(lauf.stderr).toContain(`SLFEHLER|${lauf.token}|beispiel_5|`);
        expect(existsSync(join(basis, 'ScriptLab-Testdaten'))).toBe(false);
      });
    }, 35000);

    it(`${sprache}: leerer Eingang ersetzt die Liste nur durch die Überschrift`, () => {
      mitOrdner((ordner) => {
        const basis = join(ordner, 'Leerer Arbeitsordner ä');
        mkdirSync(join(basis, listenEingang), { recursive: true });
        writeFileSync(join(basis, listenZiel), 'ALTE LISTE', 'utf8');
        const lauf = ausfuehren(fuer(sprache, 'Dateinamenliste'), basis, 'test');
        expect(lauf.status, lauf.stderr).toBe(0);
        expect(lauf.stdout).toBe(listenErfolg + '\r\n');
        expect(readFileSync(join(basis, listenZiel), 'utf8').replace(/^\uFEFF/, '')).toBe(ueberschrift);
        expect(readdirSync(join(basis, listenEingang))).toEqual([]);
      });
    }, 35000);

    it(`${sprache}: fehlender Eingang lässt eine vorhandene Ergebnisliste unverändert`, () => {
      mitOrdner((ordner) => {
        const basis = join(ordner, 'Arbeitsordner ohne Eingang ä');
        mkdirSync(dirname(join(basis, listenZiel)), { recursive: true });
        const original = Buffer.from('ERHALTENE LISTE\r\n', 'utf8');
        writeFileSync(join(basis, listenZiel), original);
        const lauf = ausfuehren(fuer(sprache, 'Dateinamenliste'), basis, 'test');
        expect(lauf.status).toBe(1);
        expect(lauf.stdout).not.toContain(listenErfolg);
        // Python ordnet den Fehler dem inneren Wertbaustein zu; VBS der aktiven Zuweisung.
        const fehlerBlock = sprache === 'python' ? 'beispiel_6' : 'beispiel_7';
        expect(lauf.stderr).toContain(`SLFEHLER|${lauf.token}|${fehlerBlock}|`);
        expect(readFileSync(join(basis, listenZiel))).toEqual(original);
        expect(existsSync(join(basis, listenEingang))).toBe(false);
      });
    }, 35000);
  }
});
