import { mkdir, open, opendir, lstat, unlink } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import {
  abgeschlosseneLaufphasen,
  type LaufEintrag,
  type LaufListe,
  type TestZustand,
} from '../gemeinsam/testlauf';
import { atomarSchreiben, dateiFehler } from './dateien';

export const laufablageGrenzen = {
  anzahl: 200,
  detailBytes: 8 * 1024 ** 2,
  gesamtBytes: 64 * 1024 ** 2,
  indexBytes: 1024 ** 2,
} as const;
const uuid = z.string().uuid();
const zeit = z.string().datetime();
const text = (maximum: number) => z.string().max(maximum);
const objekt = z.record(z.string(), z.unknown());
const metadatenSchema = z
  .object({
    laufId: uuid,
    projektKennung: uuid,
    projektName: text(160),
    standHash: z.string().regex(/^[a-f0-9]{64}$/),
    sprache: z.enum(['python', 'vbs']),
    phase: z.enum(abgeschlosseneLaufphasen),
    vorbereitetAm: zeit.nullable(),
    gestartetAm: zeit.nullable(),
    beendetAm: zeit,
    modus: z.enum(['vorschau', 'prueflauf', 'ausfuehren']),
    groesse: z.number().int().nonnegative().max(laufablageGrenzen.detailBytes),
  })
  .strict();
type InternerEintrag = z.infer<typeof metadatenSchema>;
const indexSchema = z
  .object({ schemaVersion: z.literal(1), eintraege: z.array(metadatenSchema).max(laufablageGrenzen.anzahl) })
  .strict();
const zustandSchema = z
  .object({
    laufId: uuid,
    projektKennung: uuid,
    projektName: text(160),
    standHash: z.string().regex(/^[a-f0-9]{64}$/),
    skriptsprache: z.enum(['python', 'vbs']),
    pythonVersion: text(160).nullable(),
    phase: z.enum(abgeschlosseneLaufphasen),
    vorbereitetAm: zeit.nullable(),
    gestartetAm: zeit.nullable(),
    beendetAm: zeit,
    prozessId: z.number().int().positive().nullable(),
    exitcode: z.number().int().nullable(),
    optionen: z
      .object({
        basisVerzeichnis: text(32768).nullable(),
        zeitlimitSekunden: z.number().int().min(1).max(28800),
        business: z
          .object({
            modus: z.enum(['vorschau', 'prueflauf', 'ausfuehren']),
            parametersatz: z.enum(['test', 'echt']),
            parameter: z.record(text(64), z.union([text(32768), z.number().finite(), z.boolean(), z.null()])),
            speicherMB: z.number().int().min(64).max(8192),
            tempGB: z.number().int().min(1).max(100),
            fortsetzen: z.boolean(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    ausgabe: text(131072),
    abgeschnitteneZeichen: z.number().int().nonnegative(),
    meldung: text(131072),
    quelltext: text(laufablageGrenzen.detailBytes).nullable(),
    technischeMeldung: text(131072).nullable(),
    zeilenZuordnung: z
      .array(
        z
          .object({ von: z.number().int().positive(), bis: z.number().int().positive(), blockId: text(160) })
          .strict(),
      )
      .max(20000),
    fehlerBlockId: text(160).nullable(),
    fehlerZeile: z.number().int().nonnegative().nullable(),
    business: z
      .object({
        schritt: text(160).nullable(),
        schrittnamen: z.record(text(160), text(32768)).optional(),
        ereignisse: z.array(objekt).max(100),
        vorschau: objekt.nullable(),
        bericht: objekt.nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
const detailsSchema = z.object({ schemaVersion: z.literal(1), zustand: zustandSchema }).strict();

async function begrenztLesen(pfad: string, maximum: number): Promise<string> {
  const info = await lstat(pfad);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum)
    throw new Error('Die lokale Laufdatei ist ungültig oder zu groß.');
  const datei = await open(pfad, 'r');
  try {
    const aktuell = await datei.stat();
    if (!aktuell.isFile() || aktuell.size > maximum) throw new Error('Die lokale Laufdatei ist zu groß.');
    const inhalt = await datei.readFile('utf8');
    if (Buffer.byteLength(inhalt, 'utf8') > maximum) throw new Error('Die lokale Laufdatei ist zu groß.');
    return inhalt;
  } finally {
    await datei.close();
  }
}

function eintragAusZustand(zustand: z.infer<typeof zustandSchema>, groesse: number): InternerEintrag {
  return metadatenSchema.parse({
    laufId: zustand.laufId,
    projektKennung: zustand.projektKennung,
    projektName: zustand.projektName,
    standHash: zustand.standHash,
    sprache: zustand.skriptsprache,
    phase: zustand.phase,
    vorbereitetAm: zustand.vorbereitetAm,
    gestartetAm: zustand.gestartetAm,
    beendetAm: zustand.beendetAm,
    modus: zustand.optionen.business?.modus ?? 'ausfuehren',
    groesse,
  });
}

/** Lokale abgeschlossene Läufe. Die Liste liest ausschließlich den kleinen Index, Details erst bei Auswahl. */
export class Laufablage {
  private eintraege: InternerEintrag[] = [];
  private ladeAuftrag: Promise<void> | null = null;
  private wartend: Promise<void> = Promise.resolve();
  private schreibbar = true;
  private ablageHinweis: string | null = null;
  private fremdvolumen = 0;
  private readonly grenzen: { anzahl: number; detailBytes: number; gesamtBytes: number; indexBytes: number };
  constructor(
    private readonly ordner: string,
    grenzen: Partial<Record<keyof typeof laufablageGrenzen, number>> = {},
  ) {
    this.grenzen = Object.fromEntries(
      Object.entries(laufablageGrenzen).map(([name, standard]) => {
        const wert = grenzen[name as keyof typeof laufablageGrenzen];
        return [
          name,
          typeof wert === 'number' && Number.isSafeInteger(wert) && wert > 0
            ? Math.min(wert, standard)
            : standard,
        ];
      }),
    ) as typeof this.grenzen;
  }
  private get indexPfad() {
    return join(this.ordner, 'index.json');
  }
  private detailPfad(id: string) {
    return join(this.ordner, 'details', `${uuid.parse(id)}.json`);
  }

  laden(): Promise<void> {
    this.ladeAuftrag ??= (async () => {
      try {
        await mkdir(join(this.ordner, 'details'), { recursive: true });
        const ordnerInfo = await lstat(join(this.ordner, 'details'));
        if (!ordnerInfo.isDirectory() || ordnerInfo.isSymbolicLink())
          throw new Error('Der Laufordner ist keine lokale normale Ablage.');
        try {
          const index = indexSchema.parse(
            JSON.parse(await begrenztLesen(this.indexPfad, this.grenzen.indexBytes)),
          );
          if (new Set(index.eintraege.map((e) => e.laufId)).size !== index.eintraege.length)
            throw new Error('Doppelte Laufkennungen im Index.');
          this.eintraege = index.eintraege;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        // Ausschließlich feste eigene UUID-Dateinamen; keine Quell- oder Ausgabedateien berühren.
        // Verwaiste unvollständige Sicherungen belegen ebenfalls das Mengen-/Speicherbudget.
        const details = await opendir(join(this.ordner, 'details'));
        let anzahl = 0;
        for await (const datei of details) {
          if (++anzahl > laufablageGrenzen.anzahl * 2)
            throw new Error('Zu viele Dateien im lokalen Laufordner.');
          const id = datei.name.endsWith('.json') ? datei.name.slice(0, -5) : '';
          if (!uuid.safeParse(id).success) continue;
          const info = await lstat(this.detailPfad(id));
          if (!info.isFile() || info.isSymbolicLink())
            throw new Error('Ungültige Datei im lokalen Laufordner.');
          const eintrag = this.eintraege.find((e) => e.laufId === id);
          if (eintrag) {
            if (info.size > this.grenzen.detailBytes)
              throw new Error('Eine gespeicherte Laufdatei überschreitet die Größenbegrenzung.');
            eintrag.groesse = info.size;
          } else this.fremdvolumen += info.size;
        }
        if (this.fremdvolumen)
          this.ablageHinweis =
            'Im lokalen Laufordner liegen unvollständige frühere Sicherungen. Sie werden nicht als gespeicherte Läufe angezeigt und zählen zum Speicherlimit.';
      } catch {
        this.schreibbar = false;
        this.ablageHinweis =
          'Die lokale Laufhistorie konnte nicht vollständig gelesen werden. Vorhandene Dateien bleiben erhalten; neue Läufe werden vorerst nicht dauerhaft gesichert.';
      }
    })();
    return this.ladeAuftrag;
  }
  async flush(): Promise<void> {
    await this.wartend;
  }
  sichern(zustand: TestZustand): Promise<void> {
    const kopie = structuredClone(zustand);
    this.wartend = this.wartend
      .then(async () => {
        await this.laden();
        if (!this.schreibbar) return;
        const geprueft = zustandSchema.parse(kopie);
        if (this.eintraege.some((e) => e.laufId === geprueft.laufId)) return;
        const inhalt = JSON.stringify({ schemaVersion: 1, zustand: geprueft }) + '\n';
        const groesse = Buffer.byteLength(inhalt, 'utf8');
        if (groesse > this.grenzen.detailBytes)
          throw new Error('Dieser Lauf überschreitet die Größenbegrenzung für lokale Laufdetails.');
        const eintrag = eintragAusZustand(geprueft, groesse);
        const behalten = [...this.eintraege].sort((a, b) => b.beendetAm.localeCompare(a.beendetAm));
        let volumen = behalten.reduce((summe, e) => summe + e.groesse, 0) + this.fremdvolumen;
        const entfernen: InternerEintrag[] = [];
        while (
          behalten.length &&
          (behalten.length >= this.grenzen.anzahl || volumen + groesse > this.grenzen.gesamtBytes)
        ) {
          const alt = behalten.pop()!;
          entfernen.push(alt);
          volumen -= alt.groesse;
        }
        if (volumen + groesse > this.grenzen.gesamtBytes)
          throw new Error('Das lokale Speicherlimit für Laufdetails ist erreicht.');
        if (entfernen.length) {
          await this.indexSchreiben(behalten);
          this.eintraege = behalten;
          for (let n = 0; n < entfernen.length; n++) {
            const alt = entfernen[n];
            try {
              await unlink(this.detailPfad(alt.laufId));
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.fremdvolumen += entfernen.slice(n).reduce((summe, e) => summe + e.groesse, 0);
                throw error;
              }
            }
          }
        }
        await atomarSchreiben(this.detailPfad(geprueft.laufId), inhalt);
        try {
          const neu = [eintrag, ...behalten].sort((a, b) => b.beendetAm.localeCompare(a.beendetAm));
          await this.indexSchreiben(neu);
          this.eintraege = neu;
        } catch (error) {
          await unlink(this.detailPfad(geprueft.laufId)).catch(() => {
            this.fremdvolumen += groesse;
          });
          throw error;
        }
      })
      .catch((error) => {
        this.ablageHinweis = `Der zuletzt abgeschlossene Lauf konnte nicht dauerhaft gesichert werden. ${error instanceof z.ZodError ? 'Die Laufdaten entsprechen nicht dem lokalen Speicherformat.' : error instanceof Error && !('code' in error) ? error.message : dateiFehler(error)}`;
      });
    return this.wartend;
  }
  private async indexSchreiben(eintraege: InternerEintrag[]) {
    const inhalt = JSON.stringify({ schemaVersion: 1, eintraege }) + '\n';
    if (Buffer.byteLength(inhalt, 'utf8') > this.grenzen.indexBytes)
      throw new Error('Der lokale Laufindex ist zu groß.');
    await atomarSchreiben(this.indexPfad, inhalt);
  }
  async liste(projektKennung: string): Promise<LaufListe> {
    uuid.parse(projektKennung);
    await this.flush();
    await this.laden();
    return {
      eintraege: this.eintraege
        .filter((e) => e.projektKennung === projektKennung)
        .map(({ groesse: _groesse, ...rest }) => structuredClone(rest)),
      hinweis: this.ablageHinweis,
    };
  }
  async lesen(projektKennung: string, laufId: string): Promise<TestZustand | null> {
    uuid.parse(projektKennung);
    uuid.parse(laufId);
    await this.flush();
    await this.laden();
    const eintrag = this.eintraege.find((e) => e.laufId === laufId && e.projektKennung === projektKennung);
    if (!eintrag) return null;
    try {
      const details = detailsSchema.parse(
        JSON.parse(await begrenztLesen(this.detailPfad(laufId), this.grenzen.detailBytes)),
      );
      const meta = eintragAusZustand(details.zustand, eintrag.groesse);
      if (JSON.stringify(meta) !== JSON.stringify(eintrag))
        throw new Error('Laufdetails passen nicht zum Index.');
      return details.zustand as TestZustand;
    } catch {
      this.ablageHinweis =
        'Mindestens ein gespeicherter Lauf kann nicht gelesen werden. Die übrigen Einträge bleiben erhalten.';
      throw new Error('Die gespeicherten Details dieses Laufs fehlen oder sind beschädigt.');
    }
  }
}

/** Der Index ist der Originalindex in bericht.ausgaben; geplante/ausgelassene Ziele sind keine Dateien. */
export function laufDateipfad(zustand: TestZustand, art: 'ausgabe' | 'bericht', index = 0): string {
  const bericht = zustand.business?.bericht;
  let pfad: unknown;
  if (art === 'bericht') pfad = bericht?.bericht_pfad;
  else {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error('Wähle eine vorhandene Ausgabe aus.');
    const ausgabe = Array.isArray(bericht?.ausgaben) ? bericht.ausgaben[index] : null;
    if (
      !ausgabe ||
      typeof ausgabe !== 'object' ||
      !['publiziert', 'wiederverwendet'].includes(String((ausgabe as Record<string, unknown>).status))
    )
      throw new Error('Diese Ausgabe wurde nicht als vorhandene Datei bestätigt.');
    pfad = (ausgabe as Record<string, unknown>).pfad;
  }
  if (typeof pfad !== 'string' || !pfad || pfad.length > 32768 || pfad.includes('\0'))
    throw new Error('Für diesen Lauf wurde kein gültiger Dateipfad gemeldet.');
  if (isAbsolute(pfad)) return resolve(pfad);
  if (!zustand.optionen.basisVerzeichnis || !isAbsolute(zustand.optionen.basisVerzeichnis))
    throw new Error('Der Basisordner dieses Laufs ist nicht verfügbar.');
  return resolve(zustand.optionen.basisVerzeichnis, pfad);
}

export function laufProtokollText(zustand: TestZustand): string {
  const modus = zustand.optionen.business?.modus;
  return [
    `Workflow: ${zustand.projektName ?? 'Nicht bekannt'}`,
    `Lauf: ${zustand.laufId ?? 'Nicht bekannt'}`,
    `Workflowstand: ${zustand.standHash ?? 'Nicht bekannt'}`,
    `Modus: ${modus === 'vorschau' ? 'Datenvorschau' : modus === 'prueflauf' ? 'Prüflauf ohne Zieländerungen' : 'Echte Ausführung'}`,
    `Status: ${zustand.phase}`,
    `Gestartet: ${zustand.gestartetAm ?? 'Nicht gestartet'}`,
    `Beendet: ${zustand.beendetAm ?? 'Noch nicht beendet'}`,
    '',
    'Ausgabe',
    zustand.ausgabe || 'Keine Ausgabe.',
    ...(zustand.abgeschnitteneZeichen
      ? [`${zustand.abgeschnitteneZeichen} Zeichen wurden durch die Ausgabegrenze nicht aufbewahrt.`]
      : []),
    ...(zustand.technischeMeldung ? ['', 'Technische Meldungen', zustand.technischeMeldung] : []),
  ]
    .join('\r\n')
    .replace(/\r?\n/g, '\r\n');
}
