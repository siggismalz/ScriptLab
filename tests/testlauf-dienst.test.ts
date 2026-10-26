import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TestlaufDienst } from '../src/windows/testlauf';
import { testAktiv, type TestZustand } from '../src/gemeinsam/testlauf';
import { neuesProjekt, type EditorBlock, type Projekt } from '../src/kern/projekt';

// Fail-closed: erst nach ausdrücklich bestätigter Helperfreigabe mit diesem Prozessflag ausführen.
// Ein gewöhnlicher npm-test-Lauf startet über diese Datei keine VBS-Inhalte.
const freigegeben = process.platform === 'win32' && process.env.SCRIPTLAB_RUNTIME_TESTS === '1';
const helper = resolve('artifacts/native/ScriptLab.Testhost.exe');

let nummer = 0;
function block(
  typ: string,
  werte: Record<string, EditorBlock> = {},
  felder: EditorBlock['fields'] = {},
): EditorBlock {
  return {
    type: typ,
    id: `dienst_${++nummer}`,
    fields: felder,
    inputs: Object.fromEntries(Object.entries(werte).map(([name, kind]) => [name, { block: kind }])),
  };
}
const text = (TEXT: string) => block('sl_text', {}, { TEXT });
const zahl = (ZAHL: string) => block('sl_number', {}, { ZAHL });
const ausgabe = (TEXT: string) => block('sl_output', { TEXT: text(TEXT) });
const checkpoint = (marke: string) =>
  block('sl_output', {
    TEXT: block('sl_join', { A: text(`${marke}|`), B: block('sl_time') }),
  });
const warten = (sekunden: string) => block('sl_sleep', { SEKUNDEN: zahl(sekunden) });
function projektMit(...anweisungen: EditorBlock[]): Projekt {
  const projekt = neuesProjekt();
  projekt.name = 'Isolierter Diensttest';
  for (let i = 0; i < anweisungen.length - 1; i++) anweisungen[i].next = { block: anweisungen[i + 1] };
  projekt.editor.blocks!.blocks[0].next = { block: anweisungen[0] };
  return projekt;
}

async function standAbwarten(
  dienst: TestlaufDienst,
  pruefen: (stand: TestZustand) => boolean,
  frist = 15_000,
): Promise<TestZustand> {
  const ende = Date.now() + frist;
  while (Date.now() < ende) {
    const stand = dienst.lesen();
    if (pruefen(stand)) return stand;
    await new Promise((fertig) => setTimeout(fertig, 20));
  }
  throw new Error(`Der erwartete Testzustand blieb aus: ${JSON.stringify(dienst.lesen())}`);
}

async function technischeBereinigungAbwarten(ordner: string): Promise<void> {
  const frist = Date.now() + 4_000;
  let rest: string[] = [];
  while (Date.now() < frist) {
    rest = await readdir(ordner);
    if (rest.length === 0) return;
    await new Promise((fertig) => setTimeout(fertig, 20));
  }
  expect(
    rest,
    'Technische Laufdateien müssen anschließend innerhalb von vier Sekunden verschwinden.',
  ).toEqual([]);
}

function abschlussDiagnose(
  stand: TestZustand,
  zeitspur: { ms: number; phase: string; ausgabe: string }[],
): string {
  const zeit = (wert: string | null) => (wert ? Date.parse(wert) : null);
  const vorbereitet = zeit(stand.vorbereitetAm),
    gestartet = zeit(stand.gestartetAm),
    beendet = zeit(stand.beendetAm);
  return JSON.stringify({
    phase: stand.phase,
    ausgabe: stand.ausgabe,
    tech: stand.technischeMeldung,
    exitcode: stand.exitcode,
    zeit: {
      vorbereitet: stand.vorbereitetAm,
      gestartet: stand.gestartetAm,
      beendet: stand.beendetAm,
      vorbereitungMs: vorbereitet !== null && gestartet !== null ? gestartet - vorbereitet : null,
      nativeLaufzeitMs: gestartet !== null && beendet !== null ? beendet - gestartet : null,
    },
    zeitspur,
  });
}

async function diagnostiziertesEnde(dienst: TestlaufDienst) {
  const beginn = Date.now();
  const zeitspur: { ms: number; phase: string; ausgabe: string }[] = [];
  const ende = await standAbwarten(dienst, (stand) => {
    const vorher = zeitspur.at(-1);
    if (!vorher || vorher.phase !== stand.phase || vorher.ausgabe !== stand.ausgabe)
      zeitspur.push({ ms: Date.now() - beginn, phase: stand.phase, ausgabe: stand.ausgabe });
    return !testAktiv(stand.phase);
  });
  return { ende, diagnose: abschlussDiagnose(ende, zeitspur) };
}

describe.skipIf(!freigegeben)('Freigegebener echter Windows-Testdienst in isolierten Testordnern', () => {
  let ordner: string;
  let basis: string;
  let technisch: string;
  let dienst: TestlaufDienst | null;

  beforeAll(async () => {
    expect((await stat(helper)).isFile(), 'Zuerst den geprüften festen Testhost bereitstellen.').toBe(true);
  });
  beforeEach(async () => {
    ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Dienst-'));
    basis = join(ordner, 'Basis mit Umlauten ä');
    technisch = join(ordner, 'Technische Dateien');
    await mkdir(basis);
    await mkdir(technisch);
    dienst = new TestlaufDienst(helper, technisch);
  });
  afterEach(async () => {
    if (dienst?.aktiv()) await dienst.stoppen();
    dienst = null;
    // Der rekursive Löschbereich ist der ausdrücklich selbst erzeugte direkte Temp-Unterordner.
    if (dirname(resolve(ordner)) !== resolve(tmpdir()) || !basename(ordner).startsWith('ScriptLab-Dienst-'))
      throw new Error('Der Testordner liegt außerhalb des erlaubten temporären Bereichs.');
    await rm(ordner, { recursive: true, force: true });
  });

  it('verwendet den gewählten Basisordner und bereinigt anschließend die technischen Laufdateien', async () => {
    const pfad = 'Ergebnis mit Umlauten ä.txt';
    const inhalt = 'Grüße "Leon"\r\nEine zweite Zeile 😀';
    const schreiben = block('sl_write_text', { PFAD: text(pfad), TEXT: text(inhalt) }, { KODIERUNG: 'UTF8' });
    const lesen = block('sl_output', {
      TEXT: block('sl_read_text', { PFAD: text(pfad) }, { KODIERUNG: 'UTF8' }),
    });
    dienst!.starten(
      projektMit(
        checkpoint('DIAG-VOR-SCHREIBEN'),
        schreiben,
        checkpoint('DIAG-NACH-SCHREIBEN'),
        lesen,
        checkpoint('DIAG-NACH-LESEN'),
      ),
      { basisVerzeichnis: basis, zeitlimitSekunden: 10 },
    );
    const { ende, diagnose: standDiagnose } = await diagnostiziertesEnde(dienst!);
    const ergebnisDatei = await stat(join(basis, pfad))
      .then((s) => ({ vorhanden: true, bytes: s.size }))
      .catch((e: NodeJS.ErrnoException) => ({ vorhanden: false, fehler: e.code }));
    const diagnose = JSON.stringify({ stand: JSON.parse(standDiagnose), ergebnisDatei });
    expect(ende, diagnose).toMatchObject({ phase: 'beendet', exitcode: 0, fehlerBlockId: null });
    expect(ende.beendetAm, diagnose).not.toBeNull();
    expect(ende.ausgabe, diagnose).toContain(inhalt);
    expect(ende.ausgabe, diagnose).toMatch(
      /DIAG-VOR-SCHREIBEN\|[^\r\n]+\r\nDIAG-NACH-SCHREIBEN\|[^\r\n]+\r\n[\s\S]*DIAG-NACH-LESEN\|[^\r\n]+\r\n$/,
    );
    expect((await readFile(join(basis, pfad), 'utf8')).replace(/^\uFEFF/, '')).toBe(inhalt);
    await technischeBereinigungAbwarten(technisch);
  }, 20_000);

  it('behandelt eine normale Textausgabe mit Markertext als Daten und erhält U+FEFF samt Unicode', async () => {
    const inhalt = '\uFEFFGrüße 😀\r\nSLFEHLER|fremdes-token|fremder-block|Normale Ausgabe';
    dienst!.starten(projektMit(ausgabe(inhalt)), { basisVerzeichnis: basis, zeitlimitSekunden: 10 });
    const ende = await standAbwarten(dienst!, (z) => !testAktiv(z.phase));
    expect(ende.phase).toBe('beendet');
    expect(ende.ausgabe).toBe(`${inhalt}\r\n`);
    expect(ende.fehlerBlockId).toBeNull();
    expect(ende.fehlerZeile).toBeNull();
  }, 20_000);

  it('hält große UTF-16LE-Ausgaben begrenzt und verliert weder Abschluss noch ganze Unicodezeichen', async () => {
    const payload = `Grüße 😀 ÄÖß – ${'x'.repeat(700)}`;
    const schleife = block('sl_repeat', { ANZAHL: zahl('400'), ABLAUF: ausgabe(payload) });
    dienst!.starten(projektMit(schleife, ausgabe('ENDE-DER-GROSSEN-AUSGABE')), {
      basisVerzeichnis: basis,
      zeitlimitSekunden: 10,
    });
    const ende = await standAbwarten(dienst!, (z) => !testAktiv(z.phase));
    expect(ende.phase).toBe('beendet');
    expect(ende.abgeschnitteneZeichen).toBeGreaterThan(0);
    expect(ende.ausgabe.length).toBeLessThanOrEqual(131072);
    expect(ende.ausgabe).toContain('Grüße 😀 ÄÖß');
    expect(ende.ausgabe).toMatch(/ENDE-DER-GROSSEN-AUSGABE\r\n$/);
    expect(ende.ausgabe).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    expect(ende.fehlerBlockId).toBeNull();
  }, 20_000);

  it('behält den dekodierten Fehlergrund und erfindet aus Klammern im Dateipfad keine Quelltextzeile', async () => {
    const fehlt = 'Nicht vorhanden (12, 3) – ä.txt';
    const fehler = block('sl_output', {
      TEXT: block('sl_read_text', { PFAD: text(fehlt) }, { KODIERUNG: 'UTF8' }),
    });
    dienst!.starten(projektMit(fehler), { basisVerzeichnis: basis, zeitlimitSekunden: 10 });
    const ende = await standAbwarten(dienst!, (z) => !testAktiv(z.phase));
    expect(ende.phase).toBe('fehlgeschlagen');
    expect(ende.exitcode).not.toBe(0);
    expect(ende.fehlerBlockId).toBe(fehler.id);
    expect(ende.fehlerZeile).toBeNull();
    expect(ende.meldung).toContain(fehlt);
    expect(ende.meldung).not.toContain('SLFEHLER|');
    expect(await readdir(basis)).toEqual([]);
  }, 20_000);

  it('bricht schon während der Vorbereitung ab und startet keine Dateiaktion des Workflows', async () => {
    const ziel = 'DARF-NICHT-ENTSTEHEN.txt';
    const schreiben = block(
      'sl_write_text',
      { PFAD: text(ziel), TEXT: text('Diese Aktion darf nicht erreicht werden.') },
      { KODIERUNG: 'UTF8' },
    );
    const gestartet = dienst!.starten(projektMit(schreiben), {
      basisVerzeichnis: basis,
      zeitlimitSekunden: 10,
    });
    expect(gestartet.phase).toBe('vorbereitung');
    const ende = await dienst!.stoppen();
    expect(ende.phase).toBe('abgebrochen');
    expect(ende.gestartetAm).toBeNull();
    expect(await readdir(basis)).toEqual([]);
    await technischeBereinigungAbwarten(technisch);
  }, 20_000);

  it('stoppt einen laufenden Warteblock und erhält beim direkt folgenden Lauf einen eigenen Lebenszyklus', async () => {
    dienst!.starten(projektMit(ausgabe('VOR-STOPP'), warten('8'), ausgabe('NACH-STOPP')), {
      basisVerzeichnis: basis,
      zeitlimitSekunden: 10,
    });
    const laeuft = await standAbwarten(
      dienst!,
      (z) => z.phase === 'laeuft' && z.ausgabe.includes('VOR-STOPP'),
    );
    const ende = await dienst!.stoppen();
    expect(ende.phase).toBe('abgebrochen');
    expect(ende.ausgabe).not.toContain('NACH-STOPP');
    await technischeBereinigungAbwarten(technisch);
    const neu = dienst!.starten(projektMit(ausgabe('ZWEITER-LAUF'), warten('0,5')), {
      basisVerzeichnis: basis,
      zeitlimitSekunden: 10,
    });
    expect(neu.laufId).not.toBe(laeuft.laufId);
    expect(neu.beendetAm).toBeNull();
    const zweiter = await standAbwarten(
      dienst!,
      (z) => z.phase === 'laeuft' && z.ausgabe.includes('ZWEITER-LAUF'),
    );
    expect(zweiter.beendetAm).toBeNull();
    const zweitesEnde = await standAbwarten(dienst!, (z) => !testAktiv(z.phase));
    expect(zweitesEnde.phase).toBe('beendet');
    expect(zweitesEnde.ausgabe).not.toContain('VOR-STOPP');
  }, 20_000);

  it('meldet das Zeitlimit als Zeitlimit und lässt nachfolgende Anweisungen aus', async () => {
    dienst!.starten(projektMit(checkpoint('VOR-ZEITLIMIT'), warten('5'), ausgabe('NACH-ZEITLIMIT')), {
      basisVerzeichnis: basis,
      zeitlimitSekunden: 1,
    });
    const { ende, diagnose } = await diagnostiziertesEnde(dienst!);
    expect(ende.phase, diagnose).toBe('zeitlimit');
    // Die Frist beginnt bei ResumeThread und umfasst auch die VBScript-Initialisierung.
    expect(ende.gestartetAm, diagnose).not.toBeNull();
    expect(ende.technischeMeldung, diagnose).toMatch(/SLHOST\|GESTARTET\|[^|\r\n]+\|[1-9]\d*\r\n/);
    expect((ende.exitcode ?? 0) >>> 0, diagnose).toBe(0xc000013a);
    expect(ende.ausgabe, diagnose).not.toContain('NACH-ZEITLIMIT');
    expect(ende.beendetAm, diagnose).not.toBeNull();
    await technischeBereinigungAbwarten(technisch);
  }, 20_000);
});
