import { jsonSchreiben } from '../gemeinsam/json';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, stat, mkdir, unlink } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { z } from 'zod';
import { projektPruefen, type Projekt } from '../kern/projekt';
import type { ProjektEintrag, EntwurfEintrag, EntwurfStatus, Verfuegbarkeit } from '../gemeinsam/bruecke';
import { atomarSchreiben, MAX_PROJEKT_BYTES, dateiFehler } from './dateien';

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const pfad = z
  .string()
  .min(1)
  .max(32768)
  .refine((s) => win32.isAbsolute(s) && !s.includes('\0') && win32.extname(s).toLowerCase() === '.scriptlab');
const zeit = z.string().datetime();
const eintragSchema = z
  .object({
    id: uuid,
    projektKennung: uuid,
    name: z.string().min(1).max(160),
    beschreibung: z.string().max(10000),
    skriptsprache: z.enum(['python', 'vbs']),
    pfad,
    zuletztGeoeffnet: zeit.nullable(),
    geaendertAm: zeit,
    groesse: z.number().int().nonnegative(),
    hash,
    verfuegbarkeit: z.literal('unbekannt'),
  })
  .strict();
const alterEintragSchema = eintragSchema.extend({ skriptsprache: z.enum(['python', 'vbs']).default('vbs') });
const indexSchema = z.union([
  z.object({ schemaVersion: z.literal(2), projekte: z.array(eintragSchema).max(2000) }).strict(),
  z.object({ schemaVersion: z.literal(1), projekte: z.array(alterEintragSchema).max(2000) }).strict(),
]);
const entwurfSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: uuid,
    projektKennung: uuid,
    gesichertAm: zeit,
    ausgangspfad: pfad.nullable(),
    baselineHash: hash.nullable(),
    projekt: z.unknown(),
  })
  .strict();

/** Windows behandelt unterschiedliche Großschreibung desselben Dateipfads als denselben Verweis. */
export function windowsPfadSchluessel(dateipfad: string): string {
  return win32.normalize(dateipfad).replace(/\\+$/, '').toLowerCase();
}
export function projektHash(projekt: Projekt): string {
  const { ansicht: _ansicht, ...inhalt } = projekt;
  return createHash('sha256').update(jsonSchreiben(inhalt)).digest('hex');
}
export function leererEntwurf(projekt: Projekt): boolean {
  const bloecke = projekt.editor.blocks?.blocks ?? [];
  return (
    projekt.name === 'Mein Workflow' &&
    !projekt.beschreibung &&
    !projekt.editor.variables?.length &&
    !projekt.editor.workspaceComments?.length &&
    bloecke.length === 1 &&
    bloecke[0].type === 'sl_start' &&
    !bloecke[0].next &&
    !bloecke[0].icons &&
    !projekt.exportOptionen.signieren &&
    !projekt.exportOptionen.zeitstempelUrl &&
    !projekt.exportOptionen.zertifikatFingerabdruck
  );
}

export async function mitZeitlimit<T>(arbeit: Promise<T>, millisekunden = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      arbeit,
      new Promise<never>((_, ablehnen) => {
        timer = setTimeout(
          () =>
            ablehnen(
              new Error(
                'Die Datei ist derzeit nicht erreichbar. Bitte prüfe Laufwerk oder Netzwerkverbindung.',
              ),
            ),
          millisekunden,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

export interface Dateistand {
  projekt: Projekt;
  hash: string;
  groesse: number;
  geaendertAm: string;
}
let laufendeDateizugriffe = 0;
const wartendeDateizugriffe: (() => void)[] = [];
/** Ein blockierter Netzpfad darf nicht sämtliche Dateisystem-Threads für Entwürfe belegen. */
async function dateizugriffBegrenzen<T>(arbeit: () => Promise<T>, signal: AbortSignal): Promise<T> {
  await new Promise<void>((fertig, ablehnen) => {
    if (signal.aborted) {
      ablehnen(new Error('Die Dateiabfrage wurde abgebrochen.'));
      return;
    }
    if (laufendeDateizugriffe < 3) {
      laufendeDateizugriffe++;
      fertig();
      return;
    }
    const starten = () => {
      signal.removeEventListener('abort', abbrechen);
      fertig();
    };
    const abbrechen = () => {
      const position = wartendeDateizugriffe.indexOf(starten);
      if (position >= 0) wartendeDateizugriffe.splice(position, 1);
      ablehnen(new Error('Die Dateiabfrage wurde abgebrochen.'));
    };
    wartendeDateizugriffe.push(starten);
    signal.addEventListener('abort', abbrechen, { once: true });
  });
  try {
    if (signal.aborted) throw new Error('Die Dateiabfrage wurde abgebrochen.');
    return await arbeit();
  } finally {
    const naechste = wartendeDateizugriffe.shift();
    if (naechste) naechste();
    else laufendeDateizugriffe--;
  }
}
export async function dateistandLesen(dateipfad: string): Promise<Dateistand> {
  pfad.parse(dateipfad);
  const controller = new AbortController();
  try {
    return await mitZeitlimit(
      dateizugriffBegrenzen(async () => {
        const vor = await stat(dateipfad);
        if (!vor.isFile() || vor.size > MAX_PROJEKT_BYTES)
          throw new Error('Die Projektdatei ist zu groß oder keine normale Datei.');
        const bytes = await readFile(dateipfad, { signal: controller.signal });
        if (bytes.length > MAX_PROJEKT_BYTES) throw new Error('Die Projektdatei ist zu groß.');
        const nach = await stat(dateipfad);
        if (vor.mtimeMs !== nach.mtimeMs || vor.size !== nach.size)
          throw new Error('Die Datei wurde während des Lesens geändert. Bitte öffne sie erneut.');
        const projekt = projektPruefen(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
        return {
          projekt,
          hash: createHash('sha256').update(bytes).digest('hex'),
          groesse: bytes.length,
          geaendertAm: nach.mtime.toISOString(),
        };
      }, controller.signal),
    );
  } finally {
    controller.abort();
  }
}

class SerielleAblage {
  private letzte: Promise<unknown> = Promise.resolve();
  protected nacheinander<T>(arbeit: () => Promise<T>): Promise<T> {
    const jetzt = this.letzte.then(arbeit, arbeit);
    this.letzte = jetzt.catch(() => {});
    return jetzt;
  }
}

export class Projektindex extends SerielleAblage {
  private projekte: ProjektEintrag[] = [];
  hinweis: string | null = null;
  private gesperrt = false;
  constructor(private readonly datei: string) {
    super();
  }
  async initialisieren(): Promise<void> {
    try {
      this.projekte = indexSchema.parse(JSON.parse(await readFile(this.datei, 'utf8'))).projekte;
      if (
        new Set(this.projekte.map((e) => e.id)).size !== this.projekte.length ||
        new Set(this.projekte.map((e) => e.projektKennung)).size !== this.projekte.length ||
        new Set(this.projekte.map((e) => windowsPfadSchluessel(e.pfad))).size !== this.projekte.length
      )
        throw new Error('Doppelte Projektverweise.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.projekte = [];
        this.gesperrt = true;
        this.hinweis =
          'Die Projektliste konnte nicht gelesen werden. Die vorhandene Liste bleibt unverändert. Projektdateien kannst du weiterhin über „Öffnen“ laden.';
      }
    }
  }
  lesen(): ProjektEintrag[] {
    return structuredClone(this.projekte);
  }
  kennungFuerPfad(dateipfad: string, gewuenscht: string): string {
    uuid.parse(gewuenscht);
    const vorhanden = this.projekte.find(
      (e) => windowsPfadSchluessel(e.pfad) === windowsPfadSchluessel(dateipfad),
    );
    if (vorhanden) return vorhanden.projektKennung;
    return this.projekte.some((e) => e.projektKennung === gewuenscht) ? randomUUID() : gewuenscht;
  }
  finden(id: string): ProjektEintrag {
    uuid.parse(id);
    const eintrag = this.projekte.find((e) => e.id === id);
    if (!eintrag) throw new Error('Dieser Projektverweis ist nicht mehr in der lokalen Liste.');
    return structuredClone(eintrag);
  }
  private async schreiben(projekte: ProjektEintrag[]): Promise<void> {
    if (this.gesperrt) throw new Error(this.hinweis!);
    const daten = indexSchema.parse({ schemaVersion: 2, projekte });
    await atomarSchreiben(this.datei, `${JSON.stringify(daten, null, 2)}\n`);
    this.projekte = daten.projekte;
  }
  merken(
    dateipfad: string,
    stand: Dateistand,
    geoeffnet: boolean,
    bestehendeId?: string,
  ): Promise<ProjektEintrag> {
    return this.nacheinander(async () => {
      const vorhanden = this.projekte.find(
        (e) => windowsPfadSchluessel(e.pfad) === windowsPfadSchluessel(dateipfad),
      );
      const alt = bestehendeId ? this.finden(bestehendeId) : vorhanden;
      const eintrag: ProjektEintrag = {
        id: alt?.id ?? randomUUID(),
        projektKennung:
          alt?.projektKennung ??
          this.kennungFuerPfad(dateipfad, stand.projekt.projektKennung ?? randomUUID()),
        name: stand.projekt.name,
        beschreibung: stand.projekt.beschreibung,
        skriptsprache: stand.projekt.skriptsprache,
        pfad: dateipfad,
        zuletztGeoeffnet: geoeffnet ? new Date().toISOString() : (alt?.zuletztGeoeffnet ?? null),
        geaendertAm: stand.geaendertAm,
        groesse: stand.groesse,
        hash: stand.hash,
        verfuegbarkeit: 'unbekannt',
      };
      await this.schreiben([
        ...this.projekte.filter((e) => e.id !== eintrag.id && e.id !== vorhanden?.id),
        eintrag,
      ]);
      return structuredClone(eintrag);
    });
  }
  entfernen(id: string): Promise<void> {
    return this.nacheinander(async () => {
      this.finden(id);
      await this.schreiben(this.projekte.filter((e) => e.id !== id));
    });
  }
  async verfuegbarkeit(id: string): Promise<Verfuegbarkeit> {
    const eintrag = this.finden(id);
    try {
      const stand = await dateistandLesen(eintrag.pfad);
      return stand.hash === eintrag.hash
        ? { zustand: 'verfuegbar', meldung: 'Die Projektdatei ist verfügbar.' }
        : { zustand: 'geaendert', meldung: 'Die Projektdatei wurde außerhalb von ScriptLab geändert.' };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR')
        return {
          zustand: 'fehlt',
          meldung: 'Die Projektdatei wurde nicht gefunden. Du kannst den neuen Speicherort zuordnen.',
        };
      if (code || (e instanceof Error && e.message.includes('nicht erreichbar')))
        return {
          zustand: 'nicht-erreichbar',
          meldung: 'Die Projektdatei ist derzeit nicht erreichbar. Prüfe Laufwerk und Zugriffsrechte.',
        };
      return {
        zustand: 'ungueltig',
        meldung: 'Die Datei ist kein unterstütztes ScriptLab-Projekt. Sie wurde nicht verändert.',
      };
    }
  }
}

export interface GesicherterEntwurf {
  schemaVersion: 1;
  id: string;
  projektKennung: string;
  gesichertAm: string;
  ausgangspfad: string | null;
  baselineHash: string | null;
  projekt: Projekt;
}
function entwurfPruefen(daten: unknown): GesicherterEntwurf {
  const roh = entwurfSchema.parse(daten);
  const projekt = projektPruefen(roh.projekt);
  if (projekt.projektKennung !== roh.projektKennung)
    throw new Error('Die Kennung des Entwurfs stimmt nicht mit seinem Projekt überein.');
  return { ...roh, projekt };
}
export class Entwurfspeicher extends SerielleAblage {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private vorgemerkt: {
    id: string;
    projekt: Projekt;
    ausgangspfad: string | null;
    baselineHash: string | null;
  } | null = null;
  private folge = 0;
  private zustaende = new Map<string, EntwurfStatus>();
  hinweis: string | null = null;
  constructor(
    private readonly ordner: string,
    private readonly verzoegerung = 1200,
  ) {
    super();
  }
  status(id: string): EntwurfStatus {
    return structuredClone(
      this.zustaende.get(id) ?? { id: null, phase: 'kein', gesichertAm: null, meldung: null },
    );
  }
  wiederaufnahme(entwurf: GesicherterEntwurf): void {
    this.zustaende.set(entwurf.projektKennung, {
      id: entwurf.id,
      phase: 'gesichert',
      gesichertAm: entwurf.gesichertAm,
      meldung: null,
    });
  }
  neueBearbeitung(projektKennung: string): void {
    this.zustaende.delete(projektKennung);
  }
  async aktivenEntwurfEntfernen(projektKennung: string): Promise<void> {
    const id = this.status(projektKennung).id;
    if (id) await this.entfernen(id);
  }
  ansichtAktualisieren(projekt: Projekt): void {
    if (this.vorgemerkt && this.vorgemerkt.projekt.projektKennung === projekt.projektKennung)
      this.vorgemerkt.projekt = projektPruefen(projekt);
  }
  private datei(id: string): string {
    return join(this.ordner, `${uuid.parse(id)}.json`);
  }
  async lesen(id: string): Promise<GesicherterEntwurf> {
    const datei = this.datei(id);
    const info = await stat(datei);
    if (info.size > MAX_PROJEKT_BYTES + 65536) throw new Error('Der lokale Entwurf ist zu groß.');
    const bytes = await readFile(datei);
    if (bytes.length > MAX_PROJEKT_BYTES + 65536) throw new Error('Der lokale Entwurf ist zu groß.');
    const gelesen = entwurfPruefen(JSON.parse(bytes.toString('utf8')));
    if (gelesen.id !== id) throw new Error('Der Entwurf hat keine passende Kennung.');
    return gelesen;
  }
  async liste(): Promise<EntwurfEintrag[]> {
    let namen: string[];
    try {
      namen = await readdir(this.ordner);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    const liste: EntwurfEintrag[] = [];
    this.hinweis = null;
    for (const name of namen.filter((n) => /^[a-f0-9-]{36}\.json$/i.test(n)).slice(0, 2000)) {
      try {
        const e = await this.lesen(name.slice(0, -5));
        liste.push({
          id: e.id,
          projektKennung: e.projektKennung,
          name: e.projekt.name,
          beschreibung: e.projekt.beschreibung,
          skriptsprache: e.projekt.skriptsprache,
          gesichertAm: e.gesichertAm,
          ausgangspfad: e.ausgangspfad,
          baselineHash: e.baselineHash,
        });
      } catch {
        this.hinweis =
          'Mindestens ein lokaler Entwurf konnte nicht gelesen werden und bleibt unverändert erhalten.';
      }
    }
    return liste.sort((a, b) => b.gesichertAm.localeCompare(a.gesichertAm));
  }
  planen(projekt: Projekt, ausgangspfad: string | null, baselineHash: string | null): void {
    const geprueft = projektPruefen(projekt);
    if (!geprueft.projektKennung) throw new Error('Die Projektkennung fehlt.');
    const alt = this.status(geprueft.projektKennung);
    const id = alt.id ?? randomUUID();
    this.vorgemerkt = { id, projekt: geprueft, ausgangspfad, baselineHash };
    this.folge++;
    if (this.timer) clearTimeout(this.timer);
    this.zustaende.set(geprueft.projektKennung, { ...alt, id, phase: 'ausstehend', meldung: null });
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => {});
    }, this.verzoegerung);
  }
  async flush(): Promise<EntwurfStatus | null> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const stand = this.vorgemerkt;
    const folge = this.folge;
    this.vorgemerkt = null;
    if (!stand) return this.nacheinander(async () => null);
    return this.nacheinander(async () => {
      const id = stand.id;
      const projektKennung = stand.projekt.projektKennung!;
      try {
        await mkdir(this.ordner, { recursive: true });
        try {
          await this.lesen(id);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
            throw new Error(
              'Ein vorhandener Entwurf hat ein unbekanntes oder beschädigtes Format und wird nicht überschrieben.',
            );
        }
        const entwurf = entwurfPruefen({
          schemaVersion: 1,
          projektKennung,
          gesichertAm: new Date().toISOString(),
          ...stand,
        });
        const text = `${jsonSchreiben(entwurf)}\n`;
        if (Buffer.byteLength(text, 'utf8') > MAX_PROJEKT_BYTES + 65536)
          throw new Error('Der Entwurf ist zu groß für die lokale Sicherung.');
        await atomarSchreiben(this.datei(id), text);
        const status: EntwurfStatus = {
          id,
          phase: this.folge === folge ? 'gesichert' : 'ausstehend',
          gesichertAm: entwurf.gesichertAm,
          meldung: null,
        };
        if (this.status(projektKennung).id === id) this.zustaende.set(projektKennung, status);
        return status;
      } catch (e) {
        if (this.status(projektKennung).id === id && this.folge === folge)
          this.zustaende.set(projektKennung, {
            ...this.status(projektKennung),
            phase: 'fehler',
            meldung: (e as NodeJS.ErrnoException).code
              ? dateiFehler(e)
              : e instanceof Error
                ? e.message
                : 'Der Entwurf konnte nicht gesichert werden.',
          });
        // Ein fehlgeschlagener Flush bleibt wiederholbar, ohne neuere Änderungen zu ersetzen.
        if (!this.vorgemerkt && this.folge === folge) this.vorgemerkt = stand;
        throw e;
      }
    });
  }
  async entfernen(id: string): Promise<void> {
    uuid.parse(id);
    if ([...this.zustaende.values()].some((zustand) => zustand.id === id)) this.folge++;
    for (const [kennung, zustand] of this.zustaende) if (zustand.id === id) this.zustaende.delete(kennung);
    if (this.vorgemerkt?.id === id) {
      this.folge++;
      this.vorgemerkt = null;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    }
    await this.nacheinander(async () => {
      try {
        await this.lesen(id);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      await unlink(this.datei(id)).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== 'ENOENT') throw e;
      });
      for (const [kennung, zustand] of this.zustaende) if (zustand.id === id) this.zustaende.delete(kennung);
    });
  }
}
