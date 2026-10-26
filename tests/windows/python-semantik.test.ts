import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { neuesProjekt, type Projekt, type EditorBlock } from '../../src/kern/projekt';
import { grundBausteine as bausteinDefinitionen, type BausteinDefinition } from '../../src/kern/katalog';
import { pythonErzeugen } from '../../src/kern/python-generator';
import { vbsErzeugen, vbsText } from '../../src/kern/generator';
import { vbsKodierungsHelfer } from '../../src/kern/vbs-kodierung';
import { vbsKodieren } from '../../src/main/dateien';
import { pythonKandidatenSuchen, pythonPruefen } from '../../src/windows/python';

// Echte, ausdrücklich freigegebene Windows-Proben. Jeder Kindprozess bleibt im festen Jobhelper.
const freigegeben =
  process.platform === 'win32' && process.arch === 'x64' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');
let nummer = 0;
function block(
  type: string,
  fields: EditorBlock['fields'] = {},
  werte: Record<string, EditorBlock> = {},
): EditorBlock {
  return {
    type,
    id: `semantik_${++nummer}`,
    fields,
    inputs: Object.fromEntries(Object.entries(werte).map(([name, kind]) => [name, { block: kind }])),
  };
}
const text = (TEXT: string) => block('sl_text', { TEXT });
const zahl = (ZAHL: string) => block('sl_number', { ZAHL });
const wahr = (wert = true) => block('sl_bool', { WERT: wert ? 'WAHR' : 'FALSCH' });
const lesen = (id: string) => block('sl_get', { VAR: { id } });
const setzen = (id: string, wert: EditorBlock) => block('sl_set', { VAR: { id } }, { WERT: wert });
const ausgabe = (wert: EditorBlock) =>
  block('sl_output', {}, { TEXT: block('sl_join', {}, { A: text(''), B: wert }) });
const rechnen = (OP: string, A: EditorBlock, B: EditorBlock) => block('sl_math', { OP }, { A, B });
function frischeKopie(wert: EditorBlock): EditorBlock {
  const kopie = structuredClone(wert);
  function kennungen(b: EditorBlock): void {
    b.id = `semantik_${++nummer}`;
    for (const eingang of Object.values(b.inputs ?? {})) {
      if (eingang.block) kennungen(eingang.block);
      if (eingang.shadow) kennungen(eingang.shadow);
    }
    if (b.next) kennungen(b.next.block);
  }
  kennungen(kopie);
  return kopie;
}
function projektMit(...anweisungen: EditorBlock[]): Projekt {
  const projekt = neuesProjekt('python');
  projekt.editor.variables = ['A', 'B', 'Leer', 'Zahltext', 'Bool', 'Eintrag'].map((id) => ({
    id,
    name: id,
  }));
  for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
  if (anweisungen.length) projekt.editor.blocks!.blocks[0].next = { block: anweisungen[0] };
  return projekt;
}
function vorlage(def: BausteinDefinition): EditorBlock {
  const felder = Object.fromEntries(
    def.felder.map((feld) => [feld.name, feld.name === 'VAR' ? { id: 'A' } : feld.standard]),
  );
  const werte: Record<string, EditorBlock> = {};
  for (const eingang of def.eingaben) {
    if (eingang.typ === 'Statement') werte[eingang.name] = ausgabe(text('Ablauf'));
    else if (eingang.typ === 'Number')
      werte[eingang.name] = zahl(eingang.name === 'MIN' || eingang.name === 'INDEX' ? '1' : '2');
    else if (eingang.typ === 'Boolean') werte[eingang.name] = wahr();
    else if (eingang.typ === 'Array') werte[eingang.name] = block('sl_list');
    else if (def.typ === 'sl_date_format' && eingang.name === 'WERT') werte[eingang.name] = block('sl_date');
    else
      werte[eingang.name] = text(
        ['PFAD', 'QUELLE', 'ZIEL'].includes(eingang.name)
          ? 'Testdaten\\Datei.txt'
          : eingang.name === 'NAME'
            ? 'Neu.txt'
            : 'Text',
      );
  }
  return block(def.typ, felder, werte);
}

describe.skipIf(!freigegeben)('Begrenzte Windows-Syntax- und Semantikprüfung für Python', () => {
  let ordner: string, basis: string, technisch: string, python: string;
  let laufGeneration = 0;
  const prozesse = new Set<{ prozess: ChildProcessWithoutNullStreams; geschlossen: Promise<void> }>();
  afterEach(async () => {
    laufGeneration++;
    for (const lauf of prozesse) {
      if (lauf.prozess.exitCode === null && lauf.prozess.signalCode === null) {
        lauf.prozess.stdin.end('STOP\n');
        const notbremse = setTimeout(() => lauf.prozess.kill(), 500);
        await lauf.geschlossen;
        clearTimeout(notbremse);
      }
    }
  });
  beforeAll(async () => {
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-PythonSemantik-'));
    basis = join(ordner, 'Basis ä');
    technisch = join(ordner, 'Technisch');
    await mkdir(basis);
    await mkdir(technisch);
    // Der CI-Pfad stammt nur aus dem Testharness und durchläuft dieselbe echte Laufzeitprüfung.
    const vorgabe = process.env.SCRIPTLAB_TEST_PYTHON;
    if (vorgabe) {
      const installation = await pythonPruefen(vorgabe, { helper, technischeOrdner: technisch });
      if (process.env.SCRIPTLAB_TEST_PYTHON_VERSION)
        expect(installation.version).toBe(process.env.SCRIPTLAB_TEST_PYTHON_VERSION);
      python = installation.pfad;
    }
    const kandidaten = vorgabe ? [] : await pythonKandidatenSuchen();
    for (const kandidat of kandidaten) {
      try {
        python = (await pythonPruefen(kandidat.pfad, { helper, technischeOrdner: technisch })).pfad;
        break;
      } catch {
        /* Erst eine tatsächlich geprüfte Installation wird verwendet. */
      }
    }
    if (!python)
      throw new Error('Keine unterstützte CPython-Laufzeit für die freigegebene Semantikprüfung vorhanden.');
  }, 20000);
  afterAll(async () => {
    if (!ordner) return;
    if (
      dirname(resolve(ordner)) !== resolve(tmpdir()) ||
      !basename(ordner).startsWith('ScriptLab-PythonSemantik-')
    )
      throw new Error('Unsicherer temporärer Semantikpfad.');
    await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  async function ausfuehren(
    code: string,
    sprache: 'python' | 'vbs',
    token = randomBytes(24).toString('hex'),
  ) {
    const script = join(technisch, `probe-${++nummer}.${sprache === 'python' ? 'py' : 'vbs'}`);
    await writeFile(script, sprache === 'python' ? Buffer.from(code, 'utf8') : vbsKodieren(code));
    const argumente = [
      '--script',
      script,
      '--basis',
      basis,
      '--limit-ms',
      sprache === 'vbs' ? '10000' : '4000',
      '--token',
      token,
      ...(sprache === 'python' ? ['--sprache', 'python', '--interpreter', python] : []),
    ];
    const generation = laufGeneration;
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((fertig, ablehnen) => {
      const prozess = spawn(helper, argumente, {
        shell: false,
        windowsHide: true,
        cwd: basis,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const lauf = {
        prozess,
        geschlossen: new Promise<void>((erledigt) => prozess.once('close', () => erledigt())),
      };
      prozesse.add(lauf);
      const dekoder = [
        new StringDecoder(sprache === 'python' ? 'utf8' : 'utf16le'),
        new StringDecoder(sprache === 'python' ? 'utf8' : 'utf16le'),
      ];
      const ausgabe = ['', ''];
      let laenge = 0,
        grenzenfehler = false;
      const notbremse = setTimeout(
        () => {
          grenzenfehler = true;
          prozess.kill();
        },
        sprache === 'vbs' ? 14000 : 8500,
      );
      prozess.stdin.on('error', () => {});
      for (const [index, strom] of [prozess.stdout, prozess.stderr].entries())
        strom.on('data', (daten: Buffer) => {
          laenge += daten.length;
          if (laenge > 65536) {
            grenzenfehler = true;
            prozess.kill();
            return;
          }
          ausgabe[index] += dekoder[index].write(daten);
        });
      prozess.once('error', (fehler) => {
        clearTimeout(notbremse);
        ablehnen(fehler);
      });
      prozess.once('close', (code) => {
        prozesse.delete(lauf);
        clearTimeout(notbremse);
        if (generation !== laufGeneration)
          return ablehnen(new Error('Die Semantikprobe wurde mit ihrem Test beendet.'));
        for (let i = 0; i < 2; i++) ausgabe[i] += dekoder[i].end();
        if (grenzenfehler)
          return ablehnen(
            new Error('Die feste Prozess-/Ausgabegrenze der Semantikprobe wurde überschritten.'),
          );
        fertig({ code, stdout: ausgabe[0], stderr: ausgabe[1] });
      });
    });
  }
  async function workflowAusfuehren(projekt: Projekt, sprache: 'python' | 'vbs') {
    const token = randomBytes(24).toString('hex');
    const stand = { ...projekt, skriptsprache: sprache };
    const erzeugt =
      sprache === 'python'
        ? pythonErzeugen(stand, { modus: 'test', token })
        : vbsErzeugen(stand, { modus: 'test', token });
    expect(erzeugt.code, JSON.stringify(erzeugt.meldungen)).not.toBeNull();
    return ausfuehren(erzeugt.code!, sprache, token);
  }
  async function gleich(projekt: Projekt) {
    const vbs = await workflowAusfuehren(projekt, 'vbs');
    const python = await workflowAusfuehren(projekt, 'python');
    expect(vbs.code, vbs.stderr).toBe(0);
    expect(python.code, python.stderr).toBe(0);
    expect(python.stdout).toBe(vbs.stdout);
    return python.stdout;
  }

  it('parst alle 48 Typen und jede Auswahlvariante ohne Ausführung der erzeugten Workflows', async () => {
    let anzahl = 0;
    for (const def of bausteinDefinitionen) {
      const varianten = [
        null,
        ...def.felder.flatMap((f) => (f.optionen ?? []).map(([, wert]) => ({ feld: f.name, wert }))),
      ];
      for (const variante of varianten) {
        const baustein = vorlage(def);
        if (variante) baustein.fields![variante.feld] = variante.wert;
        const projekt =
          def.form === 'start'
            ? projektMit(ausgabe(text('Start')))
            : projektMit(setzen('A', block('sl_list')), def.form === 'wert' ? ausgabe(baustein) : baustein);
        const erzeugt = pythonErzeugen(projekt);
        expect(erzeugt.code, `${def.typ}: ${JSON.stringify(erzeugt.meldungen)}`).not.toBeNull();
        await writeFile(join(basis, `quelltext-${++anzahl}.py`), erzeugt.code!, 'utf8');
      }
    }
    const ergebnis = await ausfuehren(
      `import ast, pathlib, sys\nbasis=pathlib.Path(sys.argv[sys.argv.index('--scriptlab-basis')+1])\nquellen=list(basis.glob('quelltext-*.py'))\nfor quelle in quellen:\n    ast.parse(quelle.read_text(encoding='utf-8'), filename=quelle.name)\nprint(len(quellen), flush=True)\n`,
      'python',
    );
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    expect(Number(ergebnis.stdout.trim())).toBe(anzahl);
  }, 20000);

  it('erfasst die tatsächlichen VBS-Konvertierungsgrenzen als festen Textnachweis', async () => {
    const code =
      'Option Explicit\r\nWScript.StdOut.WriteLine "IsDateZahl=" & IsDate(45200.5)\r\nWScript.StdOut.WriteLine "IsDateIso=" & IsDate("2024-02-29 12:34:56")\r\nWScript.StdOut.WriteLine "IsDateDeutsch=" & IsDate("29.02.2024 12:34:56")\r\nWScript.StdOut.WriteLine "IsNumericEmpty=" & IsNumeric(Empty)\r\nWScript.StdOut.WriteLine "IsNumericBool=" & IsNumeric(True)\r\nWScript.StdOut.WriteLine "CStrFalse=" & CStr(False)\r\nWScript.StdOut.WriteLine "CStrBool=" & CStr(True)\r\nWScript.Quit 0\r\n';
    const ergebnis = await ausfuehren(code, 'vbs');
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    const werte = Object.fromEntries(
      ergebnis.stdout
        .trim()
        .split('\r\n')
        .map((zeile) => zeile.split('=')),
    );
    expect(werte.IsNumericEmpty).toBe(werte.CStrBool);
    expect(werte.IsDateZahl).toBe(werte.CStrFalse);
    expect(werte.IsNumericBool).toBe(werte.CStrBool);
  });

  it('unterscheidet feste und dynamische VBS-Vergleichstypen mit lokaler Fehlerprobe', async () => {
    const code = `Option Explicit
Dim a,b,c
WScript.StdOut.WriteLine "Wahr=" & CStr(True)
WScript.StdOut.WriteLine "Falsch=" & CStr(False)
 a=1 : b="1" : c="abc"
WScript.StdOut.WriteLine "Variablen=" & (a=b)
WScript.StdOut.WriteLine "Konstanten=" & (1="1")
WScript.StdOut.WriteLine "LinksVariabel=" & (a="1")
WScript.StdOut.WriteLine "RechtsVariabel=" & (1=b)
WScript.StdOut.WriteLine "BstrLinks=" & (CStr(2)<100)
WScript.StdOut.WriteLine "R8Rechts=" & ("2"<CDbl(100))
WScript.StdOut.WriteLine "Zahloperation=" & ((1+0)="1")
WScript.StdOut.WriteLine "Textoperation=" & (("2" & "")<CDbl(100))
WScript.StdOut.WriteLine "Zahlfunktion=" & (CDbl(1)="1")
WScript.StdOut.WriteLine "TextopKlein=" & (("2" & "")<CDbl(3))
WScript.StdOut.WriteLine "TextfnKlein=" & (CStr(2)<CDbl(3))
WScript.StdOut.WriteLine "ZahlopVar=" & ((CDbl(100)+CDbl(0))<"2")
WScript.StdOut.WriteLine "ZahlopConst=" & ((100+0)<"2")
WScript.StdOut.WriteLine "Laenge=" & (Len("abcdefghij")<"2")
On Error Resume Next
WScript.StdOut.WriteLine "Nichtnumerisch=" & (1=c)
WScript.StdOut.WriteLine "Fehler=" & Err.Number
On Error GoTo 0
WScript.Quit 0
`;
    const ergebnis = await ausfuehren(code, 'vbs');
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    const werte = Object.fromEntries(
      ergebnis.stdout
        .trim()
        .split('\r\n')
        .map((zeile) => zeile.split('=')),
    );
    for (const name of [
      'Konstanten',
      'LinksVariabel',
      'RechtsVariabel',
      'BstrLinks',
      'Zahloperation',
      'Zahlfunktion',
      'ZahlopVar',
      'ZahlopConst',
      'Laenge',
    ])
      expect(werte[name], name).toBe(werte.Wahr);
    for (const name of ['Variablen', 'R8Rechts', 'Textoperation', 'TextopKlein', 'TextfnKlein'])
      expect(werte[name], name).toBe(werte.Falsch);
    expect(werte.Fehler).toBe('13');
  });

  it('beendet feste WScript-Quit-Aufrufe in Sub und Ausdruck mit Exitcode 1', async () => {
    const proben = [
      ['direkt', 'WScript.StdOut.WriteLine "VOR"\r\nWScript.Quit 1'],
      [
        'sub',
        'Sub Abbruch()\r\nWScript.StdErr.WriteLine "INNEN"\r\nWScript.Quit 1\r\nEnd Sub\r\nWScript.StdOut.WriteLine "VOR"\r\nAbbruch',
      ],
      [
        'funktion-zuweisung',
        'Function Abbruch()\r\nWScript.StdErr.WriteLine "INNEN"\r\nWScript.Quit 1\r\nEnd Function\r\nDim x\r\nWScript.StdOut.WriteLine "VOR"\r\nx = Abbruch()',
      ],
      [
        'funktion-ausgabe',
        'Function Abbruch()\r\nWScript.StdErr.WriteLine "INNEN"\r\nWScript.Quit 1\r\nEnd Function\r\nWScript.StdOut.WriteLine "VOR"\r\nWScript.StdOut.WriteLine Abbruch()',
      ],
    ];
    const funktion =
      'Function Abbruch()\r\nWScript.StdErr.WriteLine "INNEN"\r\nWScript.Quit 1\r\nEnd Function\r\n';
    const schutz =
      'Sub Geschuetzt()\r\nOn Error Resume Next\r\nHaupt\r\nOn Error GoTo 0\r\nEnd Sub\r\nWScript.StdOut.WriteLine "VOR"\r\nGeschuetzt\r\n';
    proben.push([
      'funktion-geschuetzt',
      funktion + 'Sub Haupt()\r\nDim x\r\nx=Abbruch()\r\nEnd Sub\r\n' + schutz,
    ]);
    proben.push([
      'funktion-logik-geschuetzt',
      funktion + 'Sub Haupt()\r\nDim x\r\nx=False And (Abbruch()=0)\r\nEnd Sub\r\n' + schutz,
    ]);
    for (const [name, code] of proben) {
      const ergebnis = await ausfuehren('Option Explicit\r\n' + code + '\r\n', 'vbs');
      expect(ergebnis.code, `${name}: ${ergebnis.stderr}`).toBe(1);
      expect(ergebnis.stdout).toContain('VOR');
      if (name !== 'direkt') expect(ergebnis.stderr).toContain('INNEN');
    }
  }, 60000);

  it('erhält Empty, CStr, boolesches -1, Variant-Vergleiche, Rundung und lokale Zahltexte', async () => {
    const anweisungen: EditorBlock[] = [
      block('sl_if', {}, { BEDINGUNG: wahr(false), DANN: setzen('Leer', zahl('1')) }),
    ];
    for (const wert of [lesen('Leer'), wahr(), wahr(false), zahl('0'), zahl('-2.5')])
      anweisungen.push(ausgabe(wert));
    let vergleichNummer = 0;
    for (const [a, b] of [
      [lesen('Leer'), zahl('0')],
      [lesen('Leer'), text('')],
      [wahr(), zahl('-1')],
      [wahr(), zahl('1')],
      [zahl('1'), text('1')],
      [text('2'), zahl('100')],
    ])
      for (const OP of ['EQ', 'GT', 'LT'])
        anweisungen.push(
          ausgabe(
            block(
              'sl_join',
              {},
              {
                A: text(`Vergleich ${++vergleichNummer} ${OP}=`),
                B: block('sl_compare', { OP }, { A: frischeKopie(a), B: frischeKopie(b) }),
              },
            ),
          ),
        );
    for (const wert of ['2.675', '1.005', '2.5', '-2.5'])
      anweisungen.push(
        ausgabe(
          block(
            'sl_round',
            { STELLEN: wert.includes('675') || wert.includes('005') ? 2 : 0 },
            { WERT: zahl(wert) },
          ),
        ),
      );
    anweisungen.push(setzen('Zahltext', text('2,5')), ausgabe(rechnen('ADD', lesen('Zahltext'), zahl('1'))));
    await gleich(projektMit(...anweisungen));
  }, 20000);

  it('lokalisiert einen VBS-Ausdruckfehler mit festen Start- und Innenmarkern', async () => {
    const division = rechnen('DIV', zahl('1'), zahl('0'));
    const projekt = projektMit(
      ausgabe(
        block(
          'sl_logic',
          { OP: 'AND' },
          { A: wahr(false), B: block('sl_compare', { OP: 'EQ' }, { A: division, B: zahl('0') }) },
        ),
      ),
    );
    const token = randomBytes(24).toString('hex');
    const erzeugt = vbsErzeugen({ ...projekt, skriptsprache: 'vbs' }, { modus: 'test', token });
    expect(erzeugt.code).not.toBeNull();
    const code = erzeugt
      .code!.replace(
        'Option Explicit\r\n',
        'Option Explicit\r\nWScript.StdOut.WriteLine "DIAG_VOR_HAUPT"\r\n',
      )
      .replace(
        'Function SL_Teilen(a, b)\r\n',
        'Function SL_Teilen(a, b)\r\n  WScript.StdErr.WriteLine "DIAG_IN_TEILEN"\r\n',
      )
      .replace(
        'Sub SL_Fehler(meldung)\r\n',
        'Sub SL_Fehler(meldung)\r\n  WScript.StdErr.WriteLine "DIAG_IN_FEHLER"\r\n',
      );
    const ergebnis = await ausfuehren(code, 'vbs', token);
    expect(ergebnis.code, JSON.stringify(ergebnis)).toBe(1);
    expect(ergebnis.stdout).toContain('DIAG_VOR_HAUPT');
    expect(ergebnis.stderr).toContain('DIAG_IN_TEILEN');
    expect(ergebnis.stderr).toContain('DIAG_IN_FEHLER');
  }, 15000);

  it('wertet Und und Oder vollständig aus und meldet den konkreten fehlerhaften Wert', async () => {
    for (const OP of ['AND', 'OR']) {
      const division = rechnen('DIV', zahl('1'), zahl('0'));
      const bedingung = block(
        'sl_logic',
        { OP },
        { A: wahr(OP === 'OR'), B: block('sl_compare', { OP: 'EQ' }, { A: division, B: zahl('0') }) },
      );
      const projekt = projektMit(ausgabe(bedingung));
      for (const sprache of ['vbs', 'python'] as const) {
        const ergebnis = await workflowAusfuehren(projekt, sprache);
        expect(ergebnis.code, `${sprache}: ${ergebnis.stderr}`).toBe(1);
        expect(ergebnis.stderr).toContain('SLFEHLER|');
        if (sprache === 'python') expect(ergebnis.stderr).toContain(`|${division.id}|`);
      }
    }
  }, 35000);

  it('ordnet eine spätere ungültige Schleifenbedingung wieder dem Schleifenbaustein zu', async () => {
    const setzenText = setzen('Bool', text('kein Wahrheitswert'));
    setzenText.next = { block: block('sl_comment', { TEXT: 'Letzter innerer Marker' }) };
    const schleife = block('sl_while', {}, { BEDINGUNG: lesen('Bool'), ABLAUF: setzenText });
    const ergebnis = await workflowAusfuehren(projektMit(setzen('Bool', wahr()), schleife), 'python');
    expect(ergebnis.code, ergebnis.stderr).toBe(1);
    expect(ergebnis.stderr).toContain(`|${schleife.id}|`);
  });

  it('erhält Unicode-Codeeinheiten, Textregeln, Listenkopien und Datumsformatierung', async () => {
    // Datumstext bewusst aus derselben Windows-Region gewinnen: ein deutscher
    // Literalwert ist auf einem en-US-Runner kein gültiger regionenunabhängiger Test.
    const lokaleDatumprobe = await ausfuehren(
      'Option Explicit\r\nWScript.StdOut.WriteLine CStr(DateSerial(2024, 2, 29) + TimeSerial(12, 34, 56))\r\nWScript.Quit 0\r\n',
      'vbs',
    );
    expect(lokaleDatumprobe.code, lokaleDatumprobe.stderr).toBe(0);
    const lokalerDatumtext = lokaleDatumprobe.stdout.trim();
    expect(lokalerDatumtext.length).toBeGreaterThan(0);
    const projekt = projektMit(
      ausgabe(block('sl_len', {}, { TEXT: text('ä😀') })),
      ausgabe(block('sl_contains', {}, { TEXT: text('Ab😀Cd'), SUCHEN: text('😀') })),
      ausgabe(block('sl_replace', {}, { TEXT: text('Ä a ä a'), SUCHEN: text('a'), ERSATZ: text('XYZ') })),
      ausgabe(block('sl_case', { ART: 'GROSS' }, { TEXT: text('Straße i ä') })),
      setzen('A', block('sl_list')),
      block('sl_list_add', { VAR: { id: 'A' } }, { WERT: text('Original') }),
      setzen('B', lesen('A')),
      block('sl_list_add', { VAR: { id: 'B' } }, { WERT: text('Kopie') }),
      ausgabe(block('sl_list_get', {}, { LISTE: lesen('A'), INDEX: zahl('1') })),
      ausgabe(block('sl_list_get', {}, { LISTE: lesen('B'), INDEX: zahl('2') })),
      ausgabe(block('sl_date_format', { FORMAT: 'DATUM' }, { WERT: block('sl_date') })),
      ausgabe(block('sl_date_format', { FORMAT: 'BEIDES' }, { WERT: text(lokalerDatumtext) })),
    );
    const ausgabeText = await gleich(projekt);
    expect(ausgabeText).toContain('2024-02-29 12:34:56\r\n');
  }, 20000);

  it('erhält Fehlerprotokoll und Originaltraceback bei einem einzelnen Surrogat im Fehlertext', async () => {
    const token = randomBytes(24).toString('hex');
    const erzeugt = pythonErzeugen(projektMit(block('sl_comment', { TEXT: 'Feste Fehlerprobe' })), {
      modus: 'test',
      token,
    });
    expect(erzeugt.code).not.toBeNull();
    const code = erzeugt.code!.replace('        sl_haupt()', "        raise ValueError('Fehler \\ud800')");
    const ergebnis = await ausfuehren(code, 'python', token);
    expect(ergebnis.code, ergebnis.stderr).toBe(1);
    expect(ergebnis.stderr).toContain('SLFEHLER|' + token + '|start|');
    expect(ergebnis.stderr).toContain('%5Cud800');
    expect(ergebnis.stderr).toContain('Traceback');
    expect(ergebnis.stderr).toContain('ValueError: Fehler \\ud800');
    expect(ergebnis.stderr).not.toContain('UnicodeEncodeError');
  });

  it('prüft den neuen VBS-Bytevalidator isoliert mit gültigen und beschädigten Unicodefolgen', async () => {
    const faelle: [string, number[], boolean][] = [
      ['UTF8', [], true],
      ['UTF8', [0x41], true],
      ['UTF8', [0xef, 0xbb, 0xbf, 0x41], true],
      ['UTF8', [0xf0, 0x9f, 0x98, 0x80], true],
      ['UTF8', [0xf4, 0x8f, 0xbf, 0xbf], true],
      ['UTF8', [0xe4], false],
      ['UTF8', [0xc0, 0xaf], false],
      ['UTF8', [0xed, 0xa0, 0x80], false],
      ['UTF8', [0xe2, 0x82], false],
      ['UTF8', [0xc2, 0x20], false],
      ['UTF8', [0xff, 0xfe], false],
      ['UTF16', [], true],
      ['UTF16', [0x41, 0], true],
      ['UTF16', [0xff, 0xfe, 0xe4, 0], true],
      ['UTF16', [0x3d, 0xd8, 0, 0xde], true],
      ['UTF16', [0x3d, 0xd8], false],
      ['UTF16', [0, 0xde], false],
      ['UTF16', [0x3d, 0xd8, 0x41, 0], false],
      ['UTF16', [0xff, 0xfe, 0x41], false],
      ['UTF16', [0xef, 0xbb, 0xbf, 0x41], false],
      ['UTF16', [0xfe, 0xff, 0, 0x41], false],
    ];
    const zeilen = ['Option Explicit', 'Dim meldung', vbsKodierungsHelfer];
    for (const [kodierung, daten] of faelle) {
      zeilen.push(
        `meldung = SL_Kodierungsfehler(${daten.length ? daten.map((byte) => `ChrB(${byte})`).join(' & ') : '""'}, ${daten.length}, "${kodierung}")`,
      );
      zeilen.push(
        'If Len(meldung) = 0 Then',
        'WScript.StdOut.WriteLine "OK"',
        'Else',
        'WScript.StdOut.WriteLine "FEHLER"',
        'End If',
      );
    }
    const ergebnis = await ausfuehren(zeilen.join('\r\n') + '\r\n', 'vbs');
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    expect(ergebnis.stdout.trim().split('\r\n')).toEqual(
      faelle.map(([, , gueltig]) => (gueltig ? 'OK' : 'FEHLER')),
    );
  });

  it('prüft tatsächliche ADODB-Binärbytes vor der Textdekodierung', async () => {
    const pfad = join(basis, 'ADO-Gueltig.txt');
    await writeFile(pfad, Buffer.from('\ufeffErste ä\r\n', 'utf8'));
    const code = `Option Explicit
Dim strom,daten,laenge,meldung
Set strom=CreateObject("ADODB.Stream")
strom.Type=1
strom.Open
strom.LoadFromFile ${vbsText(pfad)}
laenge=strom.Size
daten=strom.Read
WScript.StdOut.WriteLine "TypLaenge=" & TypeName(laenge)
WScript.StdOut.WriteLine "TypDaten=" & TypeName(daten)
WScript.StdOut.WriteLine "Laenge=" & CStr(laenge)
On Error Resume Next
WScript.StdOut.WriteLine "LBound=" & LBound(daten)
WScript.StdOut.WriteLine "IndexNull=" & CInt(daten(0))
WScript.StdOut.WriteLine "IndexFehler=" & Err.Number
Err.Clear
WScript.StdOut.WriteLine "MidBNull=" & AscB(MidB(daten, 1, 1))
WScript.StdOut.WriteLine "MidBFehler=" & Err.Number
Err.Clear
WScript.StdOut.WriteLine "LenBCStr=" & LenB(CStr(daten))
WScript.StdOut.WriteLine "CStrFehler=" & Err.Number
Err.Clear
WScript.StdOut.WriteLine "BinaerConcat=" & LenB(ChrB(239) & ChrB(187) & ChrB(191))
WScript.StdOut.WriteLine "ConcatFehler=" & Err.Number
Err.Clear
meldung=SL_Kodierungsfehler(daten,laenge,"UTF8")
WScript.StdOut.WriteLine "Fehler=" & Err.Number & ":" & Err.Description
On Error GoTo 0
WScript.StdOut.WriteLine "Meldung=" & meldung
strom.Position=0
strom.Type=2
strom.Charset="utf-8"
WScript.StdOut.WriteLine strom.ReadText
strom.Close
${vbsKodierungsHelfer}
`;
    const ergebnis = await ausfuehren(code, 'vbs');
    expect(ergebnis.code, ergebnis.stderr).toBe(0);
    expect(ergebnis.stdout).toContain('Fehler=0:');
    expect(ergebnis.stdout).toContain('Meldung=\r\n');
  });

  it('belegt den Umgang mit ungültigen UTF-8- und ungeraden UTF-16-Altbytes vor dem Anhängen', async () => {
    for (const [kodierung, original] of [
      ['UTF8', Buffer.from([0xe4])],
      ['UTF16', Buffer.from([0xff, 0xfe, 0x41])],
      ['UTF8', Buffer.from([0xc0, 0xaf])],
      ['UTF16', Buffer.from([0x3d, 0xd8])],
      ['UTF16', Buffer.from([0xef, 0xbb, 0xbf, 0x41])],
    ] as const) {
      const pfad = `Ungültig-${kodierung}.txt`;
      const projekt = projektMit(
        block('sl_append_text', { KODIERUNG: kodierung }, { PFAD: text(pfad), TEXT: text('X') }),
      );
      await writeFile(join(basis, pfad), original);
      const vbs = await workflowAusfuehren(projekt, 'vbs');
      const vbsBytes = await readFile(join(basis, pfad));
      await writeFile(join(basis, pfad), original);
      const python = await workflowAusfuehren(projekt, 'python');
      const pythonBytes = await readFile(join(basis, pfad));
      process.stdout.write(
        JSON.stringify({
          kodierung,
          original: original.toString('hex'),
          vbs: { code: vbs.code, bytes: vbsBytes.toString('hex') },
          python: { code: python.code, bytes: pythonBytes.toString('hex') },
        }) + '\n',
      );
      expect(vbs.code, vbs.stderr).toBe(1);
      expect(python.code, python.stderr).toBe(1);
      expect(vbs.stderr).toContain('SLFEHLER|');
      expect(python.stderr).toContain('SLFEHLER|');
      expect(python.stderr).not.toContain('SyntaxError');
      expect(vbsBytes).toEqual(original);
      expect(pythonBytes).toEqual(original);
    }
  }, 35000);

  it('erzeugt Ordner und erhält Kopieren, Verschieben, Umbenennen, Dateilisten und bewusstes Löschen', async () => {
    const ausgaben: string[] = [];
    for (const sprache of ['vbs', 'python'] as const) {
      const relativ = `Dateiproben-${sprache}`;
      const name = (datei: string) => text(relativ + '\\' + datei);
      const projekt = projektMit(
        block('sl_mkdir', {}, { PFAD: text(relativ) }),
        block('sl_write_text', { KODIERUNG: 'UTF8' }, { PFAD: name('a.txt'), TEXT: text('Original ä') }),
        block('sl_copy', { ZIELREGEL: 'FEHLER' }, { QUELLE: name('a.txt'), ZIEL: name('b.txt') }),
        block('sl_move', { ZIELREGEL: 'FEHLER' }, { QUELLE: name('b.txt'), ZIEL: name('c.txt') }),
        block('sl_rename', {}, { QUELLE: name('c.txt'), NAME: text('d.txt') }),
        setzen('A', block('sl_list_files', {}, { PFAD: text(relativ) })),
        block(
          'sl_foreach_file',
          { VAR: { id: 'Eintrag' } },
          { PFAD: text(relativ), ABLAUF: ausgabe(block('sl_basename', {}, { PFAD: lesen('Eintrag') })) },
        ),
        block(
          'sl_foreach',
          { VAR: { id: 'Eintrag' } },
          { LISTE: lesen('A'), ABLAUF: ausgabe(block('sl_basename', {}, { PFAD: lesen('Eintrag') })) },
        ),
        block('sl_delete', { RUECKFRAGE: 'NEIN' }, { PFAD: name('d.txt') }),
        ausgabe(block('sl_exists', { ART: 'DATEI' }, { PFAD: name('d.txt') })),
        ausgabe(block('sl_exists', { ART: 'ORDNER' }, { PFAD: text(relativ) })),
        block('sl_log', {}, { PFAD: name('protokoll.txt'), TEXT: text('Protokoll ä') }),
      );
      const ergebnis = await workflowAusfuehren(projekt, sprache);
      expect(ergebnis.code, ergebnis.stderr).toBe(0);
      expect(await readFile(join(basis, relativ, 'a.txt'))).toEqual(Buffer.from('\ufeffOriginal ä', 'utf8'));
      const protokoll = (await readFile(join(basis, relativ, 'protokoll.txt'))).toString('utf8');
      expect(protokoll).toMatch(/^\ufeff\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Protokoll ä\r\n$/);
      ausgaben.push(ergebnis.stdout);
    }
    expect(ausgaben[1]).toBe(ausgaben[0]);
    expect(ausgaben[0]).toMatch(/^a.txt\r\nd.txt\r\na.txt\r\nd.txt\r\n/);
  }, 35000);

  it('meldet vorhandene Kopierziele ohne Änderung und ersetzt sie nur nach bewusster Auswahl', async () => {
    const quelle = 'Kopierquelle.txt',
      ziel = 'Belegtes Ziel.txt';
    for (const sprache of ['vbs', 'python'] as const) {
      await writeFile(join(basis, quelle), 'Quelle ä', 'utf8');
      await writeFile(join(basis, ziel), 'Ziel bleibt', 'utf8');
      const kopieren = block('sl_copy', { ZIELREGEL: 'FEHLER' }, { QUELLE: text(quelle), ZIEL: text(ziel) });
      const fehler = await workflowAusfuehren(
        projektMit(kopieren, ausgabe(text('DARF NICHT ERSCHEINEN'))),
        sprache,
      );
      expect(fehler.code, fehler.stderr).toBe(1);
      expect(fehler.stdout).not.toContain('DARF NICHT ERSCHEINEN');
      expect(await readFile(join(basis, ziel), 'utf8')).toBe('Ziel bleibt');
      kopieren.fields!.ZIELREGEL = 'ERSETZEN';
      const ersetzt = await workflowAusfuehren(projektMit(kopieren), sprache);
      expect(ersetzt.code, ersetzt.stderr).toBe(0);
      expect(await readFile(join(basis, ziel), 'utf8')).toBe('Quelle ä');
    }
  }, 35000);

  it('erhält endliche geschachtelte Schleifen, Rechenarten, Zufallsgrenzen und erfolgreiches Beenden', async () => {
    const erhoehen = setzen('A', rechnen('ADD', lesen('A'), zahl('1')));
    const schleife = block(
      'sl_while',
      {},
      { BEDINGUNG: block('sl_compare', { OP: 'LT' }, { A: lesen('A'), B: zahl('3') }), ABLAUF: erhoehen },
    );
    const projekt = projektMit(
      setzen('A', zahl('0')),
      schleife,
      block('sl_repeat', {}, { ANZAHL: zahl('2'), ABLAUF: ausgabe(lesen('A')) }),
      ausgabe(rechnen('SUB', zahl('8'), zahl('2'))),
      ausgabe(rechnen('MUL', zahl('3'), zahl('2'))),
      ausgabe(rechnen('DIV', zahl('12'), zahl('2'))),
      ausgabe(block('sl_random', {}, { MIN: zahl('42'), MAX: zahl('42') })),
      ausgabe(block('sl_date_format', { FORMAT: 'DATUM' }, { WERT: block('sl_time') })),
      block('sl_sleep', {}, { SEKUNDEN: zahl('0.001') }),
      block('sl_end'),
      ausgabe(text('NACH ENDE')),
    );
    // Nach einem Endbaustein darf keine Anweisung angeschlossen sein; Prüfschritt separat.
    const ende = projekt.editor.blocks!.blocks[0];
    let b = ende;
    while (b.next && b.type !== 'sl_end') b = b.next.block;
    expect(pythonErzeugen(projekt).code).toBeNull();
    delete b.next;
    const ausgabeText = await gleich(projekt);
    expect(ausgabeText).toBe('3\r\n3\r\n6\r\n6\r\n6\r\n42\r\n1899-12-30\r\n');
  }, 20000);

  it('schreibt echte UTF-8/UTF-16LE-BOMs, erhält CRLF und behandelt vorhandene Ziele ausdrücklich', async () => {
    for (const kodierung of ['UTF8', 'UTF16', 'ANSI']) {
      const pfad = `Text-${kodierung}.txt`;
      const projekt = projektMit(
        block('sl_write_text', { KODIERUNG: kodierung }, { PFAD: text(pfad), TEXT: text('Erste ä\r\n') }),
        block('sl_append_text', { KODIERUNG: kodierung }, { PFAD: text(pfad), TEXT: text('Zweite ä') }),
        ausgabe(block('sl_read_text', { KODIERUNG: kodierung }, { PFAD: text(pfad) })),
      );
      const vbs = await workflowAusfuehren(projekt, 'vbs');
      expect(vbs.code, vbs.stderr).toBe(0);
      const vorher = await readFile(join(basis, pfad));
      const python = await workflowAusfuehren(projekt, 'python');
      expect(python.code, python.stderr).toBe(0);
      expect(python.stdout).toBe(vbs.stdout);
      expect(await readFile(join(basis, pfad))).toEqual(vorher);
    }
  }, 20000);
});
