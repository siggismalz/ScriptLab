import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat, unlink, rmdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { z } from 'zod';
import { projektPruefen, type Projekt } from '../kern/projekt';
import { vbsErzeugen } from '../kern/generator';
import { vbsKodieren } from '../main/dateien';
import { testAktiv, testBereit, type TestZustand, type TestOptionen } from '../gemeinsam/testlauf';

export const testOptionenSchema = z
  .object({
    basisVerzeichnis: z
      .string()
      .min(1)
      .max(32768)
      .refine((p) => isAbsolute(p) && !p.includes('\0')),
    zeitlimitSekunden: z.number().int().min(1).max(3600),
  })
  .strict();

export function testStandHash(projekt: Projekt): string {
  const { ansicht: _ansicht, ...inhalt } = projekt;
  return createHash('sha256').update(JSON.stringify(inhalt)).digest('hex');
}
interface Lauf {
  id: string;
  token: string;
  ordner: string;
  grund: 'abgebrochen' | 'zeitlimit' | null;
  prozess: ChildProcessWithoutNullStreams | null;
  fertig: Promise<void>;
  beenden: (() => void) | null;
  abbruch: AbortController;
  fehlerText: string | null;
}
interface ProzessErgebnis {
  code: number | null;
  signal: string | null;
  text: string;
  fehler: string | null;
}

/** Ausschließlich geprüfte Workflows; Host und Argumentstruktur sind nicht vom Renderer wählbar. */
export class TestlaufDienst {
  private zustand = testBereit();
  private lauf: Lauf | null = null;
  private laufzeitGeprueft = false;
  constructor(
    private readonly helper: string,
    private readonly technischeOrdner: string,
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
    const projekt = projektPruefen(structuredClone(daten));
    const kontext = testOptionenSchema.parse(optionen);
    const id = randomUUID(),
      token = randomBytes(24).toString('hex');
    const erzeugt = vbsErzeugen(projekt, { modus: 'test', token });
    if (!erzeugt.code)
      throw new Error('Vervollständige den Workflow. Die Hinweise nennen die betroffenen Bausteine.');
    this.zustand = {
      ...testBereit(),
      phase: 'vorbereitung',
      laufId: id,
      projektKennung: projekt.projektKennung ?? null,
      projektName: projekt.name,
      standHash: testStandHash(projekt),
      vorbereitetAm: new Date().toISOString(),
      optionen: kontext,
      quelltext: erzeugt.code,
      zeilenZuordnung: erzeugt.zeilenZuordnung,
      meldung: 'Workflow und Windows-Laufzeit werden vorbereitet.',
    };
    const lauf: Lauf = {
      id,
      token,
      ordner: join(this.technischeOrdner, id),
      grund: null,
      prozess: null,
      fertig: Promise.resolve(),
      beenden: null,
      abbruch: new AbortController(),
      fehlerText: null,
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
    lauf.beenden?.();
    await lauf.fertig;
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
              () =>
                ablehnen(
                  new Error(
                    'Der Testordner ist nicht rechtzeitig erreichbar. Wähle einen lokalen Ordner aus.',
                  ),
                ),
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
        throw new Error('Wähle einen erreichbaren Basisordner aus.');
      await pruefen(mkdir(lauf.ordner, { recursive: true }));
      if (lauf.grund) return;
      if (!this.laufzeitGeprueft) {
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
            'VBScript ist nicht verfügbar oder wird durch Windows-Richtlinien blockiert. Bearbeiten, Speichern und Exportieren bleiben möglich. ScriptLab ändert keine Windows-Einstellungen.',
          );
        }
        this.laufzeitGeprueft = true;
      }
      if (lauf.grund) return;
      const datei = join(lauf.ordner, 'workflow.vbs');
      await pruefen(writeFile(datei, vbsKodieren(code), { flag: 'wx', signal: lauf.abbruch.signal }));
      if (lauf.grund) return;
      const ergebnis = await this.prozessStarten(lauf, datei, optionen, false);
      this.zustand.exitcode = ergebnis.code;
      if (lauf.grund) return;
      if (ergebnis.code === 0 && !ergebnis.fehler) {
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
            : 'Der Test konnte nicht vorbereitet werden. Prüfe Basisordner und Installation.';
        this.zustand.technischeMeldung ??= e instanceof Error ? e.message : String(e);
      }
    } finally {
      // Nur feste technische Dateien dieses Laufs; niemals Basisordner oder Workflowresultate löschen.
      // Das abgeschlossene Prozessende hängt nicht von einem eventuell unerreichbaren Datenträger ab.
      // Die separate Bereinigung schreibt niemals erneut in den globalen Laufzustand.
      void (async () => {
        for (const name of ['workflow.vbs', 'laufzeitprobe.vbs'])
          await unlink(join(lauf.ordner, name)).catch(() => {});
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
        ],
        {
          shell: false,
          windowsHide: true,
          cwd: optionen.basisVerzeichnis!,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      lauf.prozess = prozess;
      let roh = '',
        stderr = '',
        zeile = '',
        fehler: string | null = null;
      let fallback: ReturnType<typeof setTimeout> | null = null;
      const dekoder = [new StringDecoder('utf16le'), new StringDecoder('utf16le')];
      const protokoll = (text: string) => {
        if (text.startsWith('SLHOST|GESTARTET|')) {
          if (!probe && !lauf.grund) {
            this.zustand.phase = 'laeuft';
            const zeit = text.split('|')[2];
            const pid = Number(text.split('|')[3]);
            this.zustand.prozessId = Number.isSafeInteger(pid) && pid > 0 ? pid : null;
            this.zustand.gestartetAm = Number.isFinite(Date.parse(zeit))
              ? new Date(zeit).toISOString()
              : new Date().toISOString();
            this.zustand.meldung = 'Der vollständige Workflow läuft auf diesem Computer.';
          }
          return true;
        }
        if (text === 'SLHOST|ZEITLIMIT') {
          if (probe) fehler = 'Die feste VBScript-Laufzeitprüfung hat ihr Zeitlimit erreicht.';
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
          zeile = teile.pop()!.slice(-32768);
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
      const zeitlimit = setTimeout(
        () => {
          if (probe) fehler = 'Die feste VBScript-Laufzeitprüfung wurde nicht rechtzeitig beendet.';
          else lauf.grund ??= 'zeitlimit';
          if (!probe) {
            this.zustand.phase = 'stoppt';
            this.zustand.meldung = 'Das Zeitlimit ist erreicht. Der Test wird beendet.';
          }
          lauf.beenden?.();
        },
        // Der native Host misst ab ResumeThread. Dieser zusätzliche Wächter darf den
        // CLR-Start des Helpers nicht fälschlich von der Scriptlaufzeit abziehen.
        optionen.zeitlimitSekunden * 1000 + (probe ? 1000 : 3000),
      );
      // close folgt erst nach Prozessende UND geschlossenen Standardstreams, nicht bloß killed=true.
      prozess.once('close', (code, signal) => {
        clearTimeout(zeitlimit);
        if (fallback) clearTimeout(fallback);
        lesen(dekoder[0].end(), 0);
        lesen(dekoder[1].end(), 1);
        if (zeile && !protokoll(zeile) && !probe) this.ausgabeAnhaengen(zeile);
        if (!probe && stderr) {
          this.zustand.technischeMeldung = stderr;
          const dateiname = datei.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const nummer = new RegExp(`^${dateiname}\\s*\\((\\d+),\\s*\\d+\\)\\s`, 'im').exec(stderr);
          if (nummer) {
            const n = Number(nummer[1]);
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
