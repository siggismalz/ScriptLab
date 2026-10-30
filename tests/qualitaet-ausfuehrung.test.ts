import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pythonHelfer } from '../src/kern/python-helfer';
import { vbsErzeugen } from '../src/kern/generator';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';

const freigegeben = process.platform === 'win32' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
const python = process.env.SCRIPTLAB_TEST_PYTHON ?? resolve('artifacts/python-buendel/python/python.exe');
const cscript = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cscript.exe');

/** Die unveränderten Produktionshelfer, einschließlich ihrer tatsächlichen Abhängigkeiten. */
function pythonListenHelfer(): string {
  const namen = new Set<string>();
  const code: string[] = [];
  const sammeln = (name: string) => {
    if (namen.has(name)) return;
    namen.add(name);
    for (const abhaengigkeit of pythonHelfer[name].braucht ?? []) sammeln(abhaengigkeit);
    code.push(pythonHelfer[name].code);
  };
  sammeln('eintrag');
  return [...new Set([...namen].flatMap((name) => pythonHelfer[name].importe ?? [])), ...code].join('\n');
}

function vbsListenHelfer(): string {
  const projekt = neuesProjekt('vbs');
  const ausgabe: EditorBlock = {
    type: 'sl_output',
    id: 'ausgabe',
    inputs: {
      TEXT: {
        block: {
          type: 'sl_list_get',
          id: 'eintrag',
          inputs: {
            LISTE: { block: { type: 'sl_list', id: 'liste' } },
            INDEX: { block: { type: 'sl_number', id: 'nummer', fields: { ZAHL: '1' } } },
          },
        },
      },
    },
  };
  projekt.editor.blocks!.blocks[0].next = { block: ausgabe };
  const code = vbsErzeugen(projekt).code;
  expect(code).not.toBeNull();
  return code!.match(/Function SL_Eintrag\(wert, index\)[\s\S]*?End Function/)![0];
}

describe.skipIf(!freigegeben)('RUN-01: Listenzugriff mit echten Windows-Laufzeiten', () => {
  let ordner: string;
  beforeAll(() => {
    ordner = mkdtempSync(join(tmpdir(), 'ScriptLab-Listen-QA-'));
  });
  afterAll(() => {
    if (!ordner) return;
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-Listen-QA-')
    )
      throw new Error('Unsicherer temporärer Listenprüfpfad.');
    rmSync(ordner, { recursive: true, force: true });
  });
  function ausfuehren(sprache: 'python' | 'vbs', code: string) {
    const datei = join(ordner, sprache === 'python' ? 'probe.py' : 'probe.vbs');
    writeFileSync(
      datei,
      sprache === 'python'
        ? Buffer.from(code, 'utf8')
        : Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(code, 'utf16le')]),
    );
    const ergebnis = spawnSync(
      sprache === 'python' ? python : cscript,
      sprache === 'python' ? ['-I', '-B', '-u', '-X', 'utf8', datei] : ['//nologo', '//U', datei],
      { windowsHide: true, timeout: 15000, maxBuffer: 65536 },
    );
    if (ergebnis.error) throw ergebnis.error;
    return {
      code: ergebnis.status,
      ausgabe: ergebnis.stdout.toString(sprache === 'python' ? 'utf8' : 'utf16le'),
      fehler: ergebnis.stderr.toString(sprache === 'python' ? 'utf8' : 'utf16le'),
    };
  }
  const vbsFehler =
    'Sub SL_Fehler(meldung)\r\nWScript.StdErr.WriteLine meldung\r\nWScript.Quit 1\r\nEnd Sub\r\n';

  it('liest erste und letzte Position und erhält unabhängige verschachtelte Ergebnisse in Python und VBS', () => {
    const py = ausfuehren(
      'python',
      pythonListenHelfer() +
        `
werte = [["Original"], "Ende"]
kopie = sl_eintrag(werte, 1)
kopie[0] = "Geändert"
print(werte[0][0])
print(kopie[0])
print(sl_eintrag(werte, 2))
`,
    );
    const vbs = ausfuehren(
      'vbs',
      'Option Explicit\r\nDim werte, kopie, original\r\n' +
        vbsFehler +
        vbsListenHelfer() +
        `
werte = Array(Array("Original"), "Ende")
kopie = SL_Eintrag(werte, 1)
kopie(0) = "Geändert"
original = werte(0)
WScript.StdOut.WriteLine original(0)
WScript.StdOut.WriteLine kopie(0)
WScript.StdOut.WriteLine SL_Eintrag(werte, 2)
`,
    );
    for (const ergebnis of [py, vbs]) {
      expect(ergebnis.code, ergebnis.fehler).toBe(0);
      expect(ergebnis.ausgabe.trim().split(/\r?\n/)).toEqual(['Original', 'Geändert', 'Ende']);
    }
  });

  for (const [name, pyWert, vbsWert, index] of [
    ['leere Liste', '[]', 'Array()', '1'],
    ['Index null', '["A"]', 'Array("A")', '0'],
    ['fehlender Index', '["A"]', 'Array("A")', '2'],
    ['gebrochener Index', '["A"]', 'Array("A")', '1.5'],
    ['falscher Listentyp', '"Text"', '"Text"', '1'],
  ])
    it(`weist ${name} in beiden Sprachen zurück`, () => {
      const py = ausfuehren('python', pythonListenHelfer() + `\nsl_eintrag(${pyWert}, ${index})\n`);
      const vbs = ausfuehren(
        'vbs',
        'Option Explicit\r\nDim wert\r\n' +
          vbsFehler +
          vbsListenHelfer() +
          `\r\nwert = ${vbsWert}\r\nWScript.StdOut.WriteLine SL_Eintrag(wert, ${index})\r\n`,
      );
      for (const ergebnis of [py, vbs]) {
        expect(ergebnis.code).toBe(1);
        expect(ergebnis.ausgabe).toBe('');
        expect(ergebnis.fehler).toContain(
          name === 'falscher Listentyp'
            ? 'Hier wird eine Liste benötigt'
            : 'Der angeforderte Listeneintrag ist nicht vorhanden',
        );
      }
    });

  it('misst unveränderte Skalarergebnisse bei 100, 10000 und 100000 Listeneinträgen', () => {
    const py = ausfuehren(
      'python',
      pythonListenHelfer() +
        `
import time, statistics, json, tracemalloc, platform, sys
messungen = []
for n in (100, 10000, 100000):
    werte = list(range(n))
    zeiten = []
    for _ in range(3):
        start = time.perf_counter()
        pruefsumme = sum(sl_eintrag(werte, n) for i in range(250))
        zeiten.append((time.perf_counter() - start) * 1000)
    assert pruefsumme == 250 * (n - 1)
    tracemalloc.start()
    assert sl_eintrag(werte, n) == n - 1
    _, maximum = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    messungen.append(dict(eintraege=n, zugriffe=250, median_ms=statistics.median(zeiten), messungen_ms=zeiten, spitzenbytes_einzelzugriff=maximum, pruefsumme=pruefsumme))
print(json.dumps(dict(python=sys.version, plattform=platform.platform(), messungen=messungen)))
`,
    );
    expect(py.code, py.fehler).toBe(0);
    const daten = JSON.parse(py.ausgabe);
    expect(daten.messungen.map((m: { pruefsumme: number }) => m.pruefsumme)).toEqual([
      24750, 2499750, 24999750,
    ]);
    // Zeitwerte sind Messdaten, keine schwankungsanfällige CI-Schwelle.
    writeFileSync(resolve('artifacts/qualitaet-run01-python-messung.json'), JSON.stringify(daten, null, 2));
    const vbs = ausfuehren(
      'vbs',
      'Option Explicit\r\nDim n, werte, i, j, k, start, dauer, summe\r\n' +
        vbsFehler +
        vbsListenHelfer() +
        `
For Each n In Array(100, 10000, 100000)
  ReDim werte(n - 1)
  For i = 0 To n - 1
    werte(i) = i
  Next
  For k = 1 To 3
    summe = 0
    start = Timer
    For j = 1 To 250
      summe = summe + SL_Eintrag(werte, n)
    Next
    dauer = Timer - start
    If dauer < 0 Then dauer = dauer + 86400
    WScript.StdOut.WriteLine n & ";" & dauer * 1000 & ";" & summe
  Next
Next
`,
    );
    expect(vbs.code, vbs.fehler).toBe(0);
    const messungen = vbs.ausgabe
      .trim()
      .split(/\r?\n/)
      .map((zeile) => zeile.split(';').map((wert) => Number(wert.replace(',', '.'))));
    expect(messungen.map(([groesse, , summe]) => [groesse, summe])).toEqual(
      [100, 10000, 100000].flatMap((groesse) =>
        Array.from({ length: 3 }, () => [groesse, 250 * (groesse - 1)]),
      ),
    );
    writeFileSync(
      resolve('artifacts/qualitaet-run01-vbs-messung.json'),
      JSON.stringify({ messungen }, null, 2),
    );
  });
});
