import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat, unlink, rmdir, realpath, cp, rm } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { z } from 'zod';
import { projektPruefen, type Projekt, type EditorBlock } from '../kern/projekt';
import { skriptErzeugen } from '../kern/skript';
import { vbsKodieren } from '../main/dateien';
import { testAktiv, testBereit, type TestZustand, type TestOptionen } from '../gemeinsam/testlauf';
import type { PythonInstallation } from '../gemeinsam/python';
import { pythonDateipfadPruefen } from './python';
import { businessSchritte, businessModusPruefen } from '../kern/business';
import { parameterWertePruefen } from '../kern/business-modell';
import { datenvorschauProjekt } from '../kern/datenvorschau';
import { jsonSchreiben } from '../gemeinsam/json';

export const testOptionenSchema = z
  .object({
    basisVerzeichnis: z
      .string()
      .min(1)
      .max(32768)
      .refine((p) => isAbsolute(p) && !p.includes('\0')),
    zeitlimitSekunden: z.number().int().min(1).max(28800),
    business: z
      .object({
        modus: z.enum(['vorschau', 'prueflauf', 'ausfuehren']),
        parametersatz: z.enum(['test', 'echt']),
        parameter: z.record(
          z.string().max(64),
          z.union([z.string().max(32768), z.number().finite(), z.boolean(), z.null()]),
        ),
        speicherMB: z.number().int().min(64).max(8192),
        tempGB: z.number().int().min(1).max(100),
        fortsetzen: z.boolean(),
        vorschauBlockId: z.string().min(1).max(160).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function testStandHash(projekt: Projekt): string {
  const { ansicht: _ansicht, ...inhalt } = projekt;
  return createHash('sha256').update(jsonSchreiben(inhalt)).digest('hex');
}
interface Lauf {
  projekt: Projekt;
  id: string;
  token: string;
  ordner: string;
  grund: 'abgebrochen' | 'zeitlimit' | null;
  prozess: ChildProcessWithoutNullStreams | null;
  fertig: Promise<void>;
  beenden: (() => void) | null;
  abbruch: AbortController;
  fehlerText: string | null;
  sprache: 'vbs' | 'python';
  python: Readonly<PythonInstallation> | null;
  dialogeNoetig: boolean;
}
interface ProzessErgebnis {
  code: number | null;
  signal: string | null;
  text: string;
  fehler: string | null;
}

export function pythonDialogeNoetig(projekt: Projekt): boolean {
  const besuchen = (block?: EditorBlock): boolean => {
    if (!block) return false;
    const aktiv = block.enabled !== false && !block.disabledReasons?.length;
    return (
      (aktiv &&
        (['sl_message', 'sl_input', 'sl_question'].includes(block.type) ||
          (block.type === 'sl_delete' && (block.fields?.RUECKFRAGE ?? 'JA') === 'JA') ||
          Object.values(block.inputs ?? {}).some((eingang) => besuchen(eingang.block ?? eingang.shadow)))) ||
      besuchen(block.next?.block)
    );
  };
  // Lose Werte gehören nicht zum ausgeführten Hauptablauf und benötigen keine Laufzeitkomponenten.
  return projekt.editor.blocks?.blocks.some((block) => block.type === 'sl_start' && besuchen(block)) ?? false;
}

/** Ausschließlich geprüfte Workflows; Host und Argumentstruktur sind nicht vom Renderer wählbar. */
export class TestlaufDienst {
  private zustand = testBereit();
  private lauf: Lauf | null = null;
  private laufzeitGeprueft = false;
  constructor(
    private readonly helper: string,
    private readonly technischeOrdner: string,
    private readonly pythonErmitteln?: (
      tkinterNoetig: boolean,
      signal: AbortSignal,
    ) => Promise<PythonInstallation>,
    private readonly business?: {
      paketwurzel: string;
      journaleOrdner: string;
      pruefen: (installation: PythonInstallation, signal: AbortSignal) => Promise<void>;
    },
    private readonly abgeschlossen?: (zustand: TestZustand) => void | Promise<void>,
    private readonly ausgabeWurzel?: string,
  ) {}

  lesen(): TestZustand {
    return structuredClone(this.zustand);
  }
  aktiv(): boolean {
    return testAktiv(this.zustand.phase);
  }
  leeren(): TestZustand {
    this.zustand.ausgabe = '';
    this.zustand.abgeschnitteneZeichen = 0;
    return this.lesen();
  }
  starten(daten: unknown, optionen: TestOptionen): TestZustand {
    if (this.aktiv()) throw new Error('Es läuft bereits ein Test. Stoppe ihn vor einem neuen Start.');
    const original = projektPruefen(daten);
    const kontext = testOptionenSchema.parse(optionen);
    if (kontext.business?.vorschauBlockId && kontext.business.modus !== 'vorschau')
      throw new Error('Ein Vorschauziel ist ausschließlich für eine Datenvorschau vorgesehen.');
    const projekt = kontext.business?.vorschauBlockId
      ? datenvorschauProjekt(original, kontext.business.vorschauBlockId)
      : original;
    if (kontext.business?.vorschauBlockId) {
      const namen = new Set(projekt.business.parameter.map((p) => p.name));
      kontext.business.parameter = Object.fromEntries(
        Object.entries(kontext.business.parameter).filter(([name]) => namen.has(name)),
      );
      kontext.business.fortsetzen = false;
    }
    const business = businessSchritte(projekt);
    if (business.length) {
      if (!kontext.business) throw new Error('Wähle Modus und Parameter für den Business-Lauf aus.');
      businessModusPruefen(projekt, kontext.business.modus);
    } else if (kontext.business?.modus && kontext.business.modus !== 'ausfuehren')
      throw new Error(
        'Dieser Workflow besitzt keine unterstützte Business-Vorschau. Wähle für einen echten Test bewusst „Ausführen“.',
      );
    const id = randomUUID(),
      token = randomBytes(24).toString('hex');
    const erzeugt = skriptErzeugen(projekt, {
      modus: 'test',
      token,
      ...(this.ausgabeWurzel ? { ausgabeWurzel: this.ausgabeWurzel } : {}),
    });
    if (!erzeugt.code)
      throw new Error('Vervollständige den Workflow. Die Hinweise nennen die betroffenen Bausteine.');
    this.zustand = {
      ...testBereit(),
      phase: 'vorbereitung',
      laufId: id,
      projektKennung: projekt.projektKennung ?? null,
      projektName: projekt.name,
      skriptsprache: projekt.skriptsprache,
      pythonVersion: null,
      standHash: testStandHash(original),
      vorbereitetAm: new Date().toISOString(),
      optionen: kontext,
      quelltext: erzeugt.code,
      zeilenZuordnung: erzeugt.zeilenZuordnung,
      meldung: 'Workflow und Windows-Laufzeit werden vorbereitet.',
      ...(business.length
        ? {
            business: {
              schritt: null,
              schrittnamen: Object.fromEntries(
                business.map((s) => [s.id, s.bezeichnung ?? 'Business-Baustein']),
              ),
              ereignisse: [],
              vorschau: null,
              bericht: null,
            },
          }
        : {}),
    };
    const lauf: Lauf = {
      projekt,
      id,
      token,
      ordner: join(this.technischeOrdner, id),
      grund: null,
      prozess: null,
      fertig: Promise.resolve(),
      beenden: null,
      abbruch: new AbortController(),
      fehlerText: null,
      sprache: projekt.skriptsprache,
      python: null,
      dialogeNoetig: pythonDialogeNoetig(projekt),
    };
    this.lauf = lauf;
    lauf.fertig = this.ausfuehren(lauf, erzeugt.code, kontext);
    return this.lesen();
  }
  async stoppen(grund: 'abgebrochen' | 'zeitlimit' = 'abgebrochen'): Promise<TestZustand> {
    const lauf = this.lauf;
    if (!lauf || !this.aktiv()) return this.lesen();
    lauf.grund ??= grund;
    lauf.abbruch.abort();
    this.zustand.phase = 'stoppt';
    this.zustand.meldung = 'Der Test wird beendet. Bereits erfolgte Änderungen bleiben bestehen.';
    let notbremse: ReturnType<typeof setTimeout> | undefined;
    if (this.zustand.business && lauf.prozess) {
      // Kooperative Schritte erhalten eine kurze Gelegenheit, ihre eigene Ausgabe zu schließen.
      void writeFile(join(lauf.ordner, 'abbruch.signal'), '').catch(() => {});
      notbremse = setTimeout(() => {
        if (this.lauf === lauf) lauf.beenden?.();
      }, 1000);
    } else lauf.beenden?.();
    await lauf.fertig;
    if (notbremse) clearTimeout(notbremse);
    return this.lesen();
  }
  private ausgabeAnhaengen(text: string): void {
    this.zustand.ausgabe += text;
    const zuViel = this.zustand.ausgabe.length - 131072;
    if (zuViel > 0) {
      let anzahl = zuViel;
      if (/[\uDC00-\uDFFF]/.test(this.zustand.ausgabe[anzahl] ?? '')) anzahl++;
      this.zustand.ausgabe = this.zustand.ausgabe.slice(anzahl);
      this.zustand.abgeschnitteneZeichen += anzahl;
    }
  }
  private async ausfuehren(lauf: Lauf, code: string, optionen: TestOptionen): Promise<void> {
    let abschluss: TestZustand['phase'] = 'fehlgeschlagen';
    const pruefen = async <T>(arbeit: Promise<T>): Promise<T> => {
      let timer: ReturnType<typeof setTimeout>;
      let abbrechen = () => {};
      try {
        return await Promise.race([
          arbeit,
          new Promise<never>((_fertig, ablehnen) => {
            abbrechen = () => ablehnen(new Error('Die Vorbereitung wurde abgebrochen.'));
            if (lauf.abbruch.signal.aborted) return abbrechen();
            lauf.abbruch.signal.addEventListener('abort', abbrechen, { once: true });
            timer = setTimeout(
              () => ablehnen(new Error('Der ScriptLab-Arbeitsordner ist nicht rechtzeitig erreichbar.')),
              4000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer!);
        lauf.abbruch.signal.removeEventListener('abort', abbrechen);
      }
    };
    try {
      if (process.platform !== 'win32') throw new Error('Workflowtests benötigen Windows 11 x64.');
      if (!(await pruefen(stat(this.helper))).isFile())
        throw new Error('Das fest mitgelieferte Testwerkzeug fehlt. Bitte installiere ScriptLab erneut.');
      if (lauf.grund) return;
      if (!(await pruefen(stat(optionen.basisVerzeichnis!))).isDirectory())
        throw new Error('Der ScriptLab-Arbeitsordner ist nicht erreichbar.');
      await pruefen(mkdir(lauf.ordner, { recursive: true }));
      if (lauf.grund) return;
      if (lauf.sprache === 'python') {
        if (!this.pythonErmitteln)
          throw new Error(
            'Die mitgelieferte Python-Laufzeit ist nicht verfügbar. Installiere ScriptLab erneut.',
          );
        this.zustand.meldung = lauf.dialogeNoetig
          ? 'Python und die benötigten Tk-Dialoge werden geprüft.'
          : 'Die mitgelieferte Python-Laufzeit wird vorbereitet.';
        const python = await this.pythonErmitteln(lauf.dialogeNoetig, lauf.abbruch.signal);
        if (lauf.grund) return;
        // Dieser Lauf behält genau die geprüfte Datei, auch wenn später Einstellungen geändert werden.
        lauf.python = Object.freeze({ ...python, pfad: pythonDateipfadPruefen(python.pfad) });
        this.zustand.pythonVersion = python.version;
        if (this.zustand.business) {
          if (!this.business) throw new Error('Die Business-Laufzeit ist nicht eingerichtet.');
          await this.business.pruefen(python, lauf.abbruch.signal);
          await pruefen(
            cp(
              join(this.business.paketwurzel, 'scriptlab_business'),
              join(lauf.ordner, 'scriptlab_business'),
              { recursive: true, filter: (p) => !p.includes('__pycache__') && !p.endsWith('.pyc') },
            ),
          );
          const b = optionen.business!;
          await mkdir(join(lauf.ordner, 'arbeitsdaten'), { recursive: true });
          const parameter = parameterWertePruefen(lauf.projekt.business.parameter, {
            ...Object.fromEntries(lauf.projekt.business.parameter.map((p) => [p.name, p.standard])),
            ...lauf.projekt.business.parametersaetze[b.parametersatz],
            ...b.parameter,
          });
          for (const p of lauf.projekt.business.parameter)
            if (
              p.erforderlich &&
              (parameter[p.name] === null || parameter[p.name] === undefined || parameter[p.name] === '')
            )
              throw new Error(`Fülle den Workflowparameter „${p.beschriftung}“ aus.`);
          await mkdir(this.business.journaleOrdner, { recursive: true });
          const journalName = createHash('sha256')
            .update(
              JSON.stringify({ stand: this.zustand.standHash, parameter, basis: optionen.basisVerzeichnis }),
            )
            .digest('hex');
          // Der zufällige Testtoken ist technisch. Die stabile Exportfassung bindet
          // zusätzlich Änderungen am Generator an den fachlichen Wiederanlauf.
          const workflowHash = createHash('sha256')
            .update(this.zustand.standHash!)
            .update('\0')
            .update(skriptErzeugen(lauf.projekt, { modus: 'export' }).code!)
            .digest('hex');
          await writeFile(
            join(lauf.ordner, 'scriptlab-kontext.json'),
            JSON.stringify({
              version: 1,
              basis: optionen.basisVerzeichnis,
              ...(this.ausgabeWurzel ? { ausgabe_wurzel: this.ausgabeWurzel } : {}),
              modus: b.modus,
              parameter,
              grenzen: {
                zeitlimit_sekunden: optionen.zeitlimitSekunden,
                duckdb_speicher: `${b.speicherMB}MB`,
                max_temp_bytes: b.tempGB * 1024 ** 3,
                max_datei_bytes: 16 * 1024 ** 3,
                max_ausgaben: 100000,
                max_zeilen: 1048575,
              },
              journal_pfad: join(this.business.journaleOrdner, `${journalName}.jsonl`),
              fortsetzen: b.fortsetzen,
              workflow_hash: workflowHash,
              technischer_ordner: join(lauf.ordner, 'arbeitsdaten'),
              abbruch_datei: join(lauf.ordner, 'abbruch.signal'),
              lauf_id: lauf.id,
            }),
            { flag: 'wx' },
          );
        }
      } else if (!this.laufzeitGeprueft) {
        const probe = join(lauf.ordner, 'laufzeitprobe.vbs');
        await pruefen(
          writeFile(
            probe,
            vbsKodieren(
              'Option Explicit\r\nWScript.StdOut.WriteLine "SCRIPTLAB_LAUFZEIT_OK"\r\nWScript.Quit 0\r\n',
            ),
            { flag: 'wx', signal: lauf.abbruch.signal },
          ),
        );
        if (lauf.grund) return;
        const ergebnis = await this.prozessStarten(
          lauf,
          probe,
          { basisVerzeichnis: lauf.ordner, zeitlimitSekunden: 8 },
          true,
        );
        if (lauf.grund) return;
        if (ergebnis.code !== 0 || ergebnis.fehler || !ergebnis.text.includes('SCRIPTLAB_LAUFZEIT_OK')) {
          this.zustand.technischeMeldung = ergebnis.text || ergebnis.fehler;
          throw new Error(
            'VBScript ist nicht verfügbar oder die unsignierte Testdatei wird durch Windows-Richtlinien blockiert. Bearbeiten, Speichern und Exportieren bleiben möglich. ScriptLab ändert keine Windows-Einstellungen.',
          );
        }
        this.laufzeitGeprueft = true;
      }
      if (lauf.grund) return;
      const datei = join(lauf.ordner, lauf.sprache === 'python' ? 'workflow.py' : 'workflow.vbs');
      await pruefen(
        writeFile(datei, lauf.sprache === 'python' ? Buffer.from(code, 'utf8') : vbsKodieren(code), {
          flag: 'wx',
          signal: lauf.abbruch.signal,
        }),
      );
      if (lauf.grund) return;
      // CPython normalisiert Windows-Kurzpfade im Traceback. Host und Fehlerzuordnung
      // verwenden deshalb denselben tatsächlichen Pfad statt eines 8.3-Alias.
      const ausgefuehrteDatei = await pruefen(realpath(datei));
      if (lauf.grund) return;
      const ergebnis = await this.prozessStarten(lauf, ausgefuehrteDatei, optionen, false);
      this.zustand.exitcode = ergebnis.code;
      if (lauf.grund) return;
      if (ergebnis.code === 2 && !ergebnis.fehler && this.zustand.business) {
        abschluss = 'mit_fehlern';
        this.zustand.meldung =
          'Mit Fehlern beendet. Erfolgreiche Ergebnisse und offene Einheiten stehen im Laufbericht.';
      } else if (ergebnis.code === 0 && !ergebnis.fehler) {
        abschluss = 'beendet';
        this.zustand.meldung = 'Ohne gemeldeten Fehler beendet. Prüfe die gewünschten Ergebnisse selbst.';
      } else {
        abschluss = 'fehlgeschlagen';
        this.zustand.meldung =
          lauf.fehlerText ?? 'Der Test wurde mit einem Fehler beendet. Die Ausgabe enthält weitere Angaben.';
        this.zustand.technischeMeldung ??=
          ergebnis.fehler ||
          ergebnis.text ||
          `Kein erfolgreicher Prozessabschluss (Exitcode ${ergebnis.code ?? 'nicht vorhanden'}).`;
      }
    } catch (e) {
      if (!lauf.grund) {
        abschluss = 'fehlgeschlagen';
        this.zustand.meldung =
          e instanceof Error && !('code' in e)
            ? e.message
            : 'Der Lauf konnte nicht vorbereitet werden. Prüfe Arbeitsordner und Installation.';
        this.zustand.technischeMeldung ??= e instanceof Error ? e.message : String(e);
      }
    } finally {
      // Nur feste technische Dateien dieses Laufs; niemals Basisordner oder Workflowresultate löschen.
      // Das abgeschlossene Prozessende hängt nicht von einem eventuell unerreichbaren Datenträger ab.
      // Die separate Bereinigung schreibt niemals erneut in den globalen Laufzustand.
      void (async () => {
        for (const name of ['workflow.vbs', 'workflow.py', 'laufzeitprobe.vbs'])
          await unlink(join(lauf.ordner, name)).catch(() => {});
        await unlink(join(lauf.ordner, 'scriptlab-kontext.json')).catch(() => {});
        await unlink(join(lauf.ordner, 'abbruch.signal')).catch(() => {});
        await rm(join(lauf.ordner, 'arbeitsdaten'), { recursive: true, force: true }).catch(() => {});
        await rm(join(lauf.ordner, 'scriptlab_business'), { recursive: true, force: true }).catch(() => {});
        await rmdir(lauf.ordner).catch(() => {});
      })();
      if (lauf.grund) {
        abschluss = lauf.grund;
        this.zustand.meldung =
          lauf.grund === 'zeitlimit'
            ? 'Zeitlimit erreicht. Bereits erfolgte Änderungen bleiben bestehen.'
            : 'Test abgebrochen. Bereits erfolgte Änderungen bleiben bestehen.';
      }
      this.zustand.beendetAm = new Date().toISOString();
      lauf.prozess = null;
      lauf.beenden = null;
      this.zustand.phase = abschluss;
      this.lauf = null;
      // Der unveränderliche Abschluss wird auch bei Vorbereitungsfehlern und sofortigem Abbruch gesichert.
      // Speicherung und ihre Fehler verändern niemals das tatsächliche Prozessergebnis.
      try {
        await this.abgeschlossen?.(this.lesen());
      } catch {
        /* Die Ablage meldet ihren Fehler getrennt. */
      }
    }
  }
  private prozessStarten(
    lauf: Lauf,
    datei: string,
    optionen: TestOptionen,
    probe: boolean,
  ): Promise<ProzessErgebnis> {
    return new Promise((fertig) => {
      const prozess = spawn(
        this.helper,
        [
          '--script',
          datei,
          '--basis',
          optionen.basisVerzeichnis!,
          '--limit-ms',
          String(optionen.zeitlimitSekunden * 1000),
          '--token',
          lauf.token,
          ...(lauf.sprache === 'python' ? ['--sprache', 'python', '--interpreter', lauf.python!.pfad] : []),
        ],
        {
          shell: false,
          windowsHide: true,
          cwd: optionen.basisVerzeichnis!,
          ...(this.zustand.business
            ? {
                env: {
                  ...process.env,
                  TEMP: join(lauf.ordner, 'arbeitsdaten'),
                  TMP: join(lauf.ordner, 'arbeitsdaten'),
                },
              }
            : {}),
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      lauf.prozess = prozess;
      let roh = '',
        stderr = '',
        zeile = '',
        fehler: string | null = null;
      let fallback: ReturnType<typeof setTimeout> | null = null;
      let startBestaetigt = false;
      let waechter: ReturnType<typeof setTimeout>;
      const fristSetzen = (dauer: number, vorStart: boolean) => {
        clearTimeout(waechter);
        waechter = setTimeout(() => {
          if (vorStart)
            fehler = 'Der feste Windows-Testhost hat den Scriptstart nicht rechtzeitig bestätigt.';
          else if (probe) fehler = 'Die feste Laufzeitprüfung wurde nicht rechtzeitig beendet.';
          else lauf.grund ??= 'zeitlimit';
          if (!probe) {
            this.zustand.phase = 'stoppt';
            this.zustand.meldung = vorStart
              ? 'Der Testhost antwortet nicht. Der Start wird beendet.'
              : 'Das Zeitlimit ist erreicht. Der Test wird beendet.';
          }
          lauf.beenden?.();
        }, dauer);
      };
      const kodierung = lauf.sprache === 'python' ? 'utf8' : 'utf16le';
      const dekoder = [new StringDecoder(kodierung), new StringDecoder(kodierung)];
      const protokoll = (text: string) => {
        const businessMarke = `SLBUS|${lauf.token}|`;
        if (!probe && this.zustand.business && text.startsWith(businessMarke)) {
          try {
            const e = JSON.parse(text.slice(businessMarke.length));
            if (e && typeof e === 'object' && !Array.isArray(e)) {
              const b = this.zustand.business;
              b.ereignisse = [...b.ereignisse.slice(-99), e];
              while (b.ereignisse.length > 1 && JSON.stringify(b.ereignisse).length > 524288)
                b.ereignisse.shift();
              if (typeof e.block_id === 'string') b.schritt = e.block_id;
              if (
                e.art === 'fehler' &&
                typeof e.block_id === 'string' &&
                this.zustand.zeilenZuordnung.some((z) => z.blockId === e.block_id)
              )
                this.zustand.fehlerBlockId = e.block_id;
              if (e.art === 'vorschau') b.vorschau = e;
              if (e.art === 'bericht' || e.art === 'abschluss') b.bericht = e;
              if (e.art === 'abschluss' && (e.grund === 'zeitlimit' || e.status === 'zeitlimit'))
                lauf.grund ??= 'zeitlimit';
              if (e.art === 'abschluss' && e.status === 'unklar')
                lauf.fehlerText =
                  'Ein Dateischritt ist nicht eindeutig abgeschlossen. Prüfe den Laufbericht und die betroffenen Dateien vor einem Wiederanlauf.';
              if (typeof e.meldung === 'string') this.ausgabeAnhaengen(e.meldung + '\r\n');
              return true;
            }
          } catch {
            /* Fremde Ausgabe bleibt Text. */
          }
        }
        if (text.startsWith('SLHOST|GESTARTET|')) {
          const zeit = Date.parse(text.split('|')[2]);
          const pid = Number(text.split('|')[3]);
          if (startBestaetigt || !Number.isFinite(zeit) || !Number.isSafeInteger(pid) || pid <= 0)
            return false;
          startBestaetigt = true;
          // Die fachliche Frist zählt ab ResumeThread, unabhängig vom CLR-Start des Helpers.
          // Der native Host beendet zuerst; der zusätzliche Wächter erlaubt eine Sekunde für Abschluss/Pipes.
          fristSetzen(Math.max(1, zeit + optionen.zeitlimitSekunden * 1000 + 1000 - Date.now()), false);
          if (!probe && !lauf.grund) {
            this.zustand.phase = 'laeuft';
            this.zustand.prozessId = pid;
            this.zustand.gestartetAm = new Date(zeit).toISOString();
            this.zustand.meldung = 'Der vollständige Workflow läuft auf diesem Computer.';
          }
          return true;
        }
        if (text === 'SLHOST|ZEITLIMIT') {
          if (probe) fehler = 'Die feste Laufzeitprüfung hat ihr Zeitlimit erreicht.';
          else {
            lauf.grund ??= 'zeitlimit';
            this.zustand.phase = 'stoppt';
          }
          return true;
        }
        const marke = `SLFEHLER|${lauf.token}|`;
        if (text.startsWith(marke)) {
          const trennstelle = text.indexOf('|', marke.length);
          if (trennstelle >= 0)
            try {
              const id = decodeURIComponent(text.slice(marke.length, trennstelle));
              if (this.zustand.zeilenZuordnung.some((z) => z.blockId === id)) this.zustand.fehlerBlockId = id;
              lauf.fehlerText = decodeURIComponent(text.slice(trennstelle + 1));
              if (!probe) this.ausgabeAnhaengen(`Fehler: ${lauf.fehlerText}\r\n`);
              return true;
            } catch {
              /* Eine fremde Textzeile ist kein vertrauenswürdiges Blockprotokoll. */
            }
        }
        return false;
      };
      const lesen = (text: string, kanal: number) => {
        roh = (roh + text).slice(-32768);
        if (!probe && kanal === 0) this.ausgabeAnhaengen(text);
        if (kanal === 1) {
          stderr = (stderr + text).slice(-32768);
          zeile += text;
          const teile = zeile.split(/\r\n|\n/);
          zeile = teile.pop()!.slice(-524288);
          for (const t of teile)
            if (!protokoll(t.replace(/\r$/, '')) && !probe) this.ausgabeAnhaengen(t + '\n');
        }
      };
      prozess.stdout.on('data', (d: Buffer) => lesen(dekoder[0].write(d), 0));
      prozess.stderr.on('data', (d: Buffer) => lesen(dekoder[1].write(d), 1));
      prozess.stdin.on('error', () => {});
      lauf.beenden = () => {
        if (prozess.exitCode !== null || prozess.signalCode !== null) return;
        prozess.stdin.end('STOP\n');
        // Der feste Helper besitzt KILL_ON_JOB_CLOSE; sein Ende beendet auch einen offenen Scriptdialog.
        fallback ??= setTimeout(() => {
          if (prozess.exitCode === null) prozess.kill();
        }, 2500);
      };
      prozess.once('spawn', () => {
        if (lauf.grund) lauf.beenden?.();
      });
      prozess.once('error', (e) => {
        fehler = e.message;
      });
      // Fehlender Hoststart ist ein Infrastrukturfehler, kein abgelaufenes Workflowzeitlimit.
      fristSetzen(10000, true);
      // close folgt erst nach Prozessende UND geschlossenen Standardstreams, nicht bloß killed=true.
      prozess.once('close', (code, signal) => {
        if (fallback) clearTimeout(fallback);
        lesen(dekoder[0].end(), 0);
        lesen(dekoder[1].end(), 1);
        if (zeile && !protokoll(zeile) && !probe) this.ausgabeAnhaengen(zeile);
        clearTimeout(waechter);
        // Exitcode 0 allein belegt keinen tatsächlich bestätigten Scriptstart.
        if (!startBestaetigt && !fehler) fehler = 'Der Scriptstart wurde vom Testhost nicht bestätigt.';
        if (!probe && stderr) {
          this.zustand.technischeMeldung = stderr;
          const dateiname = datei.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const nummern = [
            ...stderr.matchAll(
              lauf.sprache === 'python'
                ? new RegExp(`File "${dateiname}", line (\\d+)`, 'gim')
                : new RegExp(`^${dateiname}\\s*\\((\\d+),\\s*\\d+\\)\\s`, 'gim'),
            ),
          ]
            .map((treffer) => Number(treffer[1]))
            .reverse();
          // Python nennt zuerst den Hauptaufruf und zuletzt interne Hilfsfunktionen.
          // Vorrang hat die tatsächliche Workflowzeile zum bestätigten Fehlerbaustein.
          const zuordnung = this.zustand.zeilenZuordnung;
          const n =
            nummern.find((zeile) =>
              zuordnung.some(
                (z) => z.blockId === this.zustand.fehlerBlockId && zeile >= z.von && zeile <= z.bis,
              ),
            ) ??
            nummern.find((zeile) => zuordnung.some((z) => zeile >= z.von && zeile <= z.bis)) ??
            nummern[0];
          if (n !== undefined) {
            this.zustand.fehlerZeile = n;
            this.zustand.fehlerBlockId ??=
              this.zustand.zeilenZuordnung.find((z) => n >= z.von && n <= z.bis)?.blockId ?? null;
          }
        }
        lauf.prozess = null;
        lauf.beenden = null;
        fertig({ code, signal, text: roh, fehler });
      });
    });
  }
}
