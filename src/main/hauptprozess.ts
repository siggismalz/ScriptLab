import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
  clipboard,
  type IpcMainInvokeEvent,
  type IpcMainEvent,
} from 'electron';
import { readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { join, resolve, extname, dirname, basename, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { neuesProjekt, projektPruefen, type Projekt } from '../kern/projekt';
import { vbsErzeugen } from '../kern/generator';
import { farben } from '../gestaltung/tokens';
import {
  Projektindex,
  Entwurfspeicher,
  dateistandLesen,
  projektHash,
  leererEntwurf,
  windowsPfadSchluessel,
  type Dateistand,
} from './projektablage';
import { atomarSchreiben, dateiFehler, projektLesen, projektSchreiben, vbsKodieren } from './dateien';
import { SignaturDienst } from '../windows/signatur';
import { AktualisierungsDienst } from '../windows/updates';
import { TestlaufDienst, testOptionenSchema, testStandHash } from '../windows/testlauf';
import type { TestOptionen } from '../gemeinsam/testlauf';
import type { Antwort, Dokument, Einstellungen } from '../gemeinsam/bruecke';

protocol.registerSchemesAsPrivileged([
  { scheme: 'scriptlab', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.setName('ScriptLab');
if (!app.isPackaged && process.env.SCRIPTLAB_TESTDATEN)
  app.setPath('userData', resolve(process.env.SCRIPTLAB_TESTDATEN));
const einstellungenSchema = z
  .object({
    automatischeUpdates: z.boolean(),
    vorabversionen: z.boolean(),
    palettenBreite: z.number().int().min(240).max(400).default(272),
    paletteEingeklappt: z.boolean().default(false),
    eigenschaftenAngeheftet: z.boolean().default(false),
    textSkalierung: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]).default(1),
  })
  .strict();
let einstellungen: Einstellungen = einstellungenSchema.parse({
  automatischeUpdates: false,
  vorabversionen: false,
});
let projekt = neuesProjekt();
let projektPfad: string | null = null;
let gespeichert = JSON.stringify(projekt);
let gespeichertInhalt = projektHash(projekt);
let baselineHash: string | null = null;
let wiederhergestellt = false;
let konflikt = false;
let nachWechselVerwerfen: string | null = null;
let projektindex!: Projektindex;
let entwuerfe!: Entwurfspeicher;
let exportPfad: string | null = null;
let fenster: BrowserWindow;
let darfSchliessen = false;
let dialogAktiv = false;
let signaturDienst: SignaturDienst;
let aktualisierungen: AktualisierungsDienst;
let testDienst: TestlaufDienst;
let testOptionen: TestOptionen = { basisVerzeichnis: null, zeitlimitSekunden: 120 };
let wartetAufDarstellung = true;
let standAnfrage: { kennung: string; uebernehmen: (daten: unknown) => void } | null = null;

function dokument(): Dokument {
  return {
    projekt,
    dateiname: projektPfad ? basename(projektPfad) : null,
    geaendert: wiederhergestellt || JSON.stringify(projekt) !== gespeichert,
    projektKennung: projekt.projektKennung!,
    entwurfStatus: entwuerfe?.status(projekt.projektKennung!) ?? {
      id: null,
      phase: 'kein',
      gesichertAm: null,
      meldung: null,
    },
    konflikt,
    darstellungNoetig: wartetAufDarstellung,
  };
}
function uebernehmen(daten: unknown, sicherungPlanen = true): Projekt {
  const vorher = projektHash(projekt);
  const geprueft = projektPruefen(daten);
  if (testDienst?.aktiv() && testStandHash(geprueft) !== testStandHash(projekt))
    throw new Error('Während des Tests sind Änderungen am Workflow gesperrt. Stoppe den Test zuerst.');
  if (geprueft.projektKennung && geprueft.projektKennung !== projekt.projektKennung)
    throw new Error(
      'Dieser Bearbeitungsstand gehört zu einem anderen Projekt. Bitte verwende den aktuell geöffneten Workflow.',
    );
  // Nur Öffnen/Neu wechseln die Identität, keine vom Renderer übertragene Bearbeitung.
  projekt = { ...geprueft, projektKennung: projekt.projektKennung };
  if (entwuerfe && sicherungPlanen) {
    if (
      projektHash(projekt) !== vorher &&
      !wiederhergestellt &&
      projektHash(projekt) === gespeichertInhalt &&
      entwuerfe.status(projekt.projektKennung!).phase !== 'kein'
    )
      void entwuerfe.aktivenEntwurfEntfernen(projekt.projektKennung!).catch(() => {});
    if (
      projektHash(projekt) !== vorher &&
      projektHash(projekt) !== gespeichertInhalt &&
      !leererEntwurf(projekt)
    )
      entwuerfe.planen(projekt, projektPfad, baselineHash);
    else entwuerfe.ansichtAktualisieren(projekt);
  }
  fensterStatusAktualisieren();
  return projekt;
}
function fensterStatusAktualisieren(): void {
  fenster.setDocumentEdited(dokument().geaendert);
  fenster.setTitle(`${projekt.name}${dokument().geaendert ? ' *' : ''} – ScriptLab`);
}
function einstellungsPfad(): string {
  return join(app.getPath('userData'), 'einstellungen.json');
}

export function absenderPruefen(event: IpcMainInvokeEvent | IpcMainEvent): void {
  if (
    !fenster ||
    event.sender !== fenster.webContents ||
    event.senderFrame !== fenster.webContents.mainFrame ||
    event.senderFrame.url !== 'scriptlab://app/index.html'
  ) {
    throw new Error('Dieser Aufruf ist nicht freigegeben.');
  }
}

async function aktuellenStandAnfordern(): Promise<void> {
  await new Promise<void>((erledigt, abgelehnt) => {
    const kennung = randomUUID();
    const timer = setTimeout(() => {
      standAnfrage = null;
      abgelehnt(
        new Error('Der aktuelle Projektstand konnte nicht gelesen werden. Das Fenster bleibt geöffnet.'),
      );
    }, 5000);
    standAnfrage = {
      kennung,
      uebernehmen: (daten) => {
        clearTimeout(timer);
        standAnfrage = null;
        try {
          uebernehmen(daten);
          erledigt();
        } catch (fehler) {
          abgelehnt(fehler);
        }
      },
    };
    fenster.webContents.send('scriptlab:stand-anfordern', kennung);
  });
}

function registrieren(kanal: string, funktion: (daten: unknown) => unknown | Promise<unknown>): void {
  ipcMain.handle(`scriptlab:${kanal}`, async (event, daten): Promise<Antwort<unknown>> => {
    try {
      absenderPruefen(event);
      // JSON-Daten sind klein begrenzt; Binär- und Fremdobjekte erreichen keine Dateidienste.
      if (daten !== undefined && Buffer.byteLength(JSON.stringify(daten), 'utf8') > 5 * 1024 * 1024)
        throw new Error('Die Anfrage ist zu groß.');
      return { ok: true, wert: await funktion(daten) };
    } catch (error) {
      const bekannteMeldung =
        error instanceof Error &&
        !('code' in error) &&
        !(error instanceof z.ZodError) &&
        !(error instanceof TypeError) &&
        !(error instanceof RangeError) &&
        !(error instanceof SyntaxError);
      return { ok: false, meldung: bekannteMeldung ? error.message : dateiFehler(error) };
    }
  });
}

async function speichern(unter: boolean): Promise<Dokument | null> {
  if (testDienst.aktiv())
    throw new Error('Stoppe den Test vor dem Speichern. Dein Arbeitsstand bleibt erhalten.');
  try {
    await entwurfAktuellSichern();
  } catch {
    /* Eine Projektdatei kann auch bei fehlgeschlagener lokaler Sicherung gespeichert werden. */
  }
  let ziel = projektPfad;
  if (projektPfad && baselineHash) {
    try {
      konflikt = (await dateistandLesen(projektPfad)).hash !== baselineHash;
    } catch {
      konflikt = true;
    }
  }
  if (!ziel || unter || konflikt) {
    const auswahl = await dialog.showSaveDialog(fenster, {
      title: konflikt ? 'Separate Projektkopie speichern' : 'ScriptLab-Projekt speichern',
      defaultPath: `${dateiname(projekt.name)}${konflikt ? '-Kopie' : ''}.scriptlab`,
      filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
    });
    if (auswahl.canceled || !auswahl.filePath) return null;
    ziel = auswahl.filePath;
    if (extname(ziel).toLowerCase() !== '.scriptlab')
      throw new Error('Bitte speichere Projekte mit der Endung .scriptlab.');
  }
  if (konflikt && projektPfad && windowsPfadSchluessel(ziel) === windowsPfadSchluessel(projektPfad))
    throw new Error(
      'Die Ausgangsdatei wurde außerhalb von ScriptLab geändert oder ist nicht mehr erreichbar. Speichere deine Änderungen unter einem anderen Dateinamen.',
    );
  if (projektPfad && baselineHash && windowsPfadSchluessel(ziel) === windowsPfadSchluessel(projektPfad)) {
    try {
      konflikt = (await dateistandLesen(projektPfad)).hash !== baselineHash;
    } catch {
      konflikt = true;
    }
    if (konflikt)
      throw new Error(
        'Die Ausgangsdatei wurde inzwischen geändert. Speichere deine Änderungen als separate Projektkopie.',
      );
  }
  const alteKennung = projekt.projektKennung!;
  const kopie = projektPfad && windowsPfadSchluessel(ziel) !== windowsPfadSchluessel(projektPfad);
  const stand = projektPruefen({
    ...projekt,
    projektKennung: projektindex.kennungFuerPfad(ziel, kopie ? randomUUID() : projekt.projektKennung!),
  });
  await projektSchreiben(ziel, stand);
  const dateistand = await dateistandLesen(ziel);
  await verweisMerken(ziel, { ...dateistand, projekt: stand }, false);
  await entwuerfe.aktivenEntwurfEntfernen(alteKennung);
  projektAktivieren(stand, ziel, dateistand.hash);
  wartetAufDarstellung = false;
  return dokument();
}

async function verweisMerken(
  pfad: string,
  stand: Dateistand,
  geoeffnet: boolean,
  id?: string,
): Promise<void> {
  try {
    const eintrag = await projektindex.merken(pfad, stand, geoeffnet, id);
    stand.projekt.projektKennung = eintrag.projektKennung;
  } catch {
    projektindex.hinweis =
      'Die Projektdatei wurde gelesen oder gespeichert, aber ihre Aufnahme in die lokale Projektliste ist fehlgeschlagen.';
  }
}

function projektAktivieren(
  neu: Projekt,
  pfad: string | null,
  hash: string | null,
  ungespeichert = false,
): void {
  const gleicherWorkflow = neu.projektKennung === projekt.projektKennung;
  projekt = { ...neu, projektKennung: neu.projektKennung ?? randomUUID() };
  entwuerfe.neueBearbeitung(projekt.projektKennung!);
  projektPfad = pfad;
  if (!gleicherWorkflow || (!testOptionen.basisVerzeichnis && pfad))
    testOptionen = { ...testOptionen, basisVerzeichnis: pfad ? dirname(pfad) : null };
  baselineHash = hash;
  gespeichert = JSON.stringify(projekt);
  gespeichertInhalt = ungespeichert ? '' : projektHash(projekt);
  wiederhergestellt = ungespeichert;
  konflikt = false;
  exportPfad = null;
  wartetAufDarstellung = true;
  fensterStatusAktualisieren();
}
async function entwurfAktuellSichern(): Promise<void> {
  if (
    (!leererEntwurf(projekt) && (wiederhergestellt || projektHash(projekt) !== gespeichertInhalt)) ||
    entwuerfe.status(projekt.projektKennung!).id
  )
    entwuerfe.planen(projekt, projektPfad, baselineHash);
  await entwuerfe.flush();
}
async function verworfenenEntwurfBereinigen(): Promise<void> {
  if (nachWechselVerwerfen) await entwuerfe.aktivenEntwurfEntfernen(nachWechselVerwerfen);
  nachWechselVerwerfen = null;
}

function dateiname(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/[. ]+$/, '')
      .slice(0, 100) || 'Mein Workflow'
  );
}

async function aenderungenSichern(): Promise<boolean> {
  if (!(await testBeendenVorWechsel())) return false;
  if (!wiederhergestellt && projektHash(projekt) === gespeichertInhalt) {
    if (entwuerfe.status(projekt.projektKennung!).phase !== 'kein')
      await entwuerfe.aktivenEntwurfEntfernen(projekt.projektKennung!);
    return true;
  }
  if (!dokument().geaendert) return true;
  // Der aktuellste Stand einschließlich Ansicht wird vor jeder Verlustentscheidung gesichert.
  try {
    await entwurfAktuellSichern();
  } catch {
    /* Speichern als Projektdatei bleibt als Alternative möglich. */
  }
  const antwort = await dialog.showMessageBox(fenster, {
    type: 'question',
    title: 'Ungespeicherte Änderungen',
    message: 'Möchtest du deine Änderungen speichern?',
    detail: 'Du kannst eine Projektdatei speichern oder den bearbeitbaren Stand lokal als Entwurf behalten.',
    buttons: ['Speichern', 'Als Entwurf behalten', 'Änderungen verwerfen', 'Abbrechen'],
    defaultId: 0,
    cancelId: 3,
    noLink: true,
  });
  if (antwort.response === 3) return false;
  if (antwort.response === 0) return (await speichern(false)) !== null;
  if (antwort.response === 1) {
    await entwurfAktuellSichern();
    return true;
  }
  nachWechselVerwerfen = projekt.projektKennung!;
  return true;
}

async function testBeendenVorWechsel(): Promise<boolean> {
  if (!testDienst.aktiv()) return true;
  const auswahl = await dialog.showMessageBox(fenster, {
    type: 'question',
    title: 'Ein Test läuft',
    message: 'Den laufenden Test stoppen und fortfahren?',
    detail:
      'Bereits erfolgte Änderungen bleiben bestehen. Dein Projektstand wird anschließend getrennt behandelt.',
    buttons: ['Test stoppen und fortfahren', 'Im Editor bleiben'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (auswahl.response !== 0) return false;
  await testDienst.stoppen();
  return !testDienst.aktiv();
}

async function mitDialog<T>(funktion: () => Promise<T>): Promise<T> {
  if (dialogAktiv) throw new Error('Bitte schließe zuerst den geöffneten Dialog.');
  dialogAktiv = true;
  try {
    return await funktion();
  } finally {
    dialogAktiv = false;
    nachWechselVerwerfen = null;
  }
}

function ipcEinrichten(): void {
  registrieren('test-lesen', () => ({ zustand: testDienst.lesen(), optionen: testOptionen }));
  registrieren('test-starten', (daten) => {
    if (dialogAktiv) throw new Error('Schließe zuerst den geöffneten Dialog.');
    if (testDienst.aktiv()) throw new Error('Es läuft bereits ein Test.');
    const auswahl = z.object({ projekt: z.unknown(), optionen: testOptionenSchema }).strict().parse(daten);
    const stand = structuredClone(uebernehmen(auswahl.projekt));
    testOptionen = auswahl.optionen;
    return testDienst.starten(stand, testOptionen);
  });
  registrieren('test-stoppen', (daten) => {
    const id = z.string().uuid().parse(daten);
    if (testDienst.lesen().laufId !== id) throw new Error('Dieser Testlauf ist nicht mehr aktuell.');
    return testDienst.stoppen();
  });
  registrieren('test-leeren', () => testDienst.leeren());
  registrieren('test-kopieren', async () => {
    await clipboard.writeText(testDienst.lesen().ausgabe);
  });
  registrieren('test-verlassen', () => mitDialog(testBeendenVorWechsel));
  registrieren('test-ordner', () =>
    mitDialog(async () => {
      if (testDienst.aktiv()) throw new Error('Das Basisverzeichnis ist während eines Tests festgelegt.');
      const auswahl = await dialog.showOpenDialog(fenster, {
        title: 'Basisordner für Workflowtests wählen',
        properties: ['openDirectory'],
        ...(testOptionen.basisVerzeichnis ? { defaultPath: testOptionen.basisVerzeichnis } : {}),
      });
      if (auswahl.canceled || auswahl.filePaths.length !== 1) return null;
      testOptionen = { ...testOptionen, basisVerzeichnis: resolve(auswahl.filePaths[0]) };
      return testOptionen.basisVerzeichnis;
    }),
  );
  ipcMain.on('scriptlab:stand-antwort', (event, daten: unknown) => {
    try {
      absenderPruefen(event);
      const antwort = z.object({ kennung: z.string().uuid(), projekt: z.unknown() }).strict().parse(daten);
      if (standAnfrage?.kennung === antwort.kennung) standAnfrage.uebernehmen(antwort.projekt);
    } catch {
      /* Ungültige Antworten erfüllen keine offene Speicheranfrage. */
    }
  });
  registrieren('laden', () => ({ dokument: dokument(), einstellungen, version: app.getVersion() }));
  registrieren('darstellung-bereit', (daten) => {
    if (!wartetAufDarstellung) throw new Error('Der Editor wurde bereits geladen.');
    uebernehmen(daten, false);
    if (!wiederhergestellt) {
      gespeichert = JSON.stringify(projekt);
      gespeichertInhalt = projektHash(projekt);
    } else if (!leererEntwurf(projekt)) entwuerfe.planen(projekt, projektPfad, baselineHash);
    wartetAufDarstellung = false;
    fensterStatusAktualisieren();
    return dokument();
  });
  registrieren('aendern', (daten) => {
    uebernehmen(daten);
  });
  registrieren('neu', (daten) =>
    mitDialog(async () => {
      uebernehmen(daten);
      if (!(await aenderungenSichern())) return null;
      await verworfenenEntwurfBereinigen();
      projektAktivieren(neuesProjekt(), null, null);
      return dokument();
    }),
  );
  registrieren('oeffnen', (daten) =>
    mitDialog(async () => {
      uebernehmen(daten);
      const auswahl = await dialog.showOpenDialog(fenster, {
        title: 'ScriptLab-Projekt öffnen',
        properties: ['openFile'],
        filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
      });
      if (auswahl.canceled || auswahl.filePaths.length !== 1) return null;
      const ziel = auswahl.filePaths[0];
      if (extname(ziel).toLowerCase() !== '.scriptlab')
        throw new Error('Bitte wähle eine .scriptlab-Projektdatei.');
      let geladen = await dateistandLesen(ziel);
      if (!(await aenderungenSichern())) return null;
      // Der Schutzdialog kann genau diese Datei gespeichert haben. Erst danach den aktuellen Stand laden.
      geladen = await dateistandLesen(ziel);
      await verworfenenEntwurfBereinigen();
      await verweisMerken(ziel, geladen, true);
      projektAktivieren(geladen.projekt, ziel, geladen.hash);
      return dokument();
    }),
  );
  registrieren('beispiel', (daten) =>
    mitDialog(async () => {
      const auswahl = z
        .object({ projekt: z.unknown(), beispiel: z.enum(['begruessung', 'backup', 'dateiliste']) })
        .strict()
        .parse(daten);
      uebernehmen(auswahl.projekt);
      const dateien = {
        begruessung: '01-Begruessung.scriptlab',
        backup: '02-Datei-Backup.scriptlab',
        dateiliste: '03-Dateinamenliste.scriptlab',
      } as const;
      const basis = app.isPackaged
        ? join(process.resourcesPath, 'beispiele')
        : join(app.getAppPath(), 'beispiele');
      const geladen = await projektLesen(join(basis, dateien[auswahl.beispiel]));
      if (!(await aenderungenSichern())) return null;
      await verworfenenEntwurfBereinigen();
      projektAktivieren(
        { ...geladen, projektKennung: randomUUID(), name: `${geladen.name} (Kopie)` },
        null,
        null,
        true,
      );
      return dokument();
    }),
  );
  registrieren('speichern', (daten) =>
    mitDialog(async () => {
      const objekt = z.object({ projekt: z.unknown(), unter: z.boolean() }).strict().parse(daten);
      uebernehmen(objekt.projekt);
      return speichern(objekt.unter);
    }),
  );
  const idPruefen = (daten: unknown) => z.string().uuid().parse(daten);
  const auswahlPruefen = (daten: unknown) =>
    z.object({ projekt: z.unknown(), id: z.string().uuid() }).strict().parse(daten);
  registrieren('bibliothek', async () => {
    const liste = await entwuerfe.liste();
    return {
      projekte: projektindex.lesen(),
      entwuerfe: liste,
      hinweis: [projektindex.hinweis, entwuerfe.hinweis].filter(Boolean).join(' ') || null,
    };
  });
  registrieren('projekt-verfuegbarkeit', (daten) => projektindex.verfuegbarkeit(idPruefen(daten)));
  registrieren('projekt-verweis-entfernen', async (daten) => {
    await projektindex.entfernen(idPruefen(daten));
    return true;
  });
  registrieren('projekt-ordner', async (daten) => {
    const eintrag = projektindex.finden(idPruefen(daten));
    const verfuegbarkeit = await projektindex.verfuegbarkeit(eintrag.id);
    if (!['verfuegbar', 'geaendert'].includes(verfuegbarkeit.zustand))
      throw new Error(verfuegbarkeit.meldung);
    // Zeigt nur den Ordner. Eine Projekt- oder Workflowdatei wird niemals gestartet.
    shell.showItemInFolder(eintrag.pfad);
  });
  for (const neuZuordnen of [false, true])
    registrieren(neuZuordnen ? 'bekanntes-neu-zuordnen' : 'bekanntes-oeffnen', (daten) =>
      mitDialog(async () => {
        const auswahl = auswahlPruefen(daten);
        const eintrag = projektindex.finden(auswahl.id);
        uebernehmen(auswahl.projekt);
        let ziel = eintrag.pfad;
        if (neuZuordnen) {
          const datei = await dialog.showOpenDialog(fenster, {
            title: 'Neuen Projekt-Speicherort zuordnen',
            properties: ['openFile'],
            filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
          });
          if (datei.canceled || datei.filePaths.length !== 1) return null;
          ziel = datei.filePaths[0];
          if (extname(ziel).toLowerCase() !== '.scriptlab')
            throw new Error('Bitte wähle eine .scriptlab-Projektdatei.');
        }
        let stand = await dateistandLesen(ziel);
        if (!(await aenderungenSichern())) return null;
        stand = await dateistandLesen(ziel);
        await verworfenenEntwurfBereinigen();
        await verweisMerken(ziel, stand, true, eintrag.id);
        projektAktivieren(stand.projekt, ziel, stand.hash);
        return dokument();
      }),
    );
  registrieren('entwurf-sichern', async (daten) => {
    uebernehmen(daten);
    await entwurfAktuellSichern();
    return dokument();
  });
  registrieren('entwurf-oeffnen', (daten) =>
    mitDialog(async () => {
      const auswahl = auswahlPruefen(daten);
      const entwurf = await entwuerfe.lesen(auswahl.id);
      uebernehmen(auswahl.projekt);
      if (entwurf.id === entwuerfe.status(projekt.projektKennung!).id) {
        await entwurfAktuellSichern();
        return dokument();
      }
      if (!(await aenderungenSichern())) return null;
      await verworfenenEntwurfBereinigen();
      projektAktivieren(entwurf.projekt, entwurf.ausgangspfad, entwurf.baselineHash, true);
      entwuerfe.wiederaufnahme(entwurf);
      if (entwurf.ausgangspfad) {
        try {
          konflikt = (await dateistandLesen(entwurf.ausgangspfad)).hash !== entwurf.baselineHash;
        } catch {
          konflikt = true;
        }
      }
      return dokument();
    }),
  );
  registrieren('entwurf-speichern-als', (daten) =>
    mitDialog(async () => {
      const auswahl = auswahlPruefen(daten);
      let entwurf = await entwuerfe.lesen(auswahl.id);
      if (!(await testBeendenVorWechsel())) return null;
      uebernehmen(auswahl.projekt);
      if (entwurf.id === entwuerfe.status(projekt.projektKennung!).id) {
        await entwurfAktuellSichern();
        entwurf = await entwuerfe.lesen(auswahl.id);
      } else if (!(await aenderungenSichern())) return null;
      const ziel = await dialog.showSaveDialog(fenster, {
        title: 'Entwurf als Projektdatei speichern',
        defaultPath: `${dateiname(entwurf.projekt.name)}.scriptlab`,
        filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
      });
      if (ziel.canceled || !ziel.filePath) return null;
      if (extname(ziel.filePath).toLowerCase() !== '.scriptlab')
        throw new Error('Bitte speichere Projekte mit der Endung .scriptlab.');
      if (
        entwurf.ausgangspfad &&
        windowsPfadSchluessel(ziel.filePath) === windowsPfadSchluessel(entwurf.ausgangspfad)
      )
        throw new Error('Wähle für diese Entwurfskopie einen anderen Dateinamen als die Ausgangsdatei.');
      const stand = {
        ...entwurf.projekt,
        projektKennung: projektindex.kennungFuerPfad(ziel.filePath, randomUUID()),
      };
      await projektSchreiben(ziel.filePath, stand);
      const gelesen = await dateistandLesen(ziel.filePath);
      await verweisMerken(ziel.filePath, gelesen, false);
      await entwuerfe.entfernen(entwurf.id);
      await verworfenenEntwurfBereinigen();
      projektAktivieren(stand, ziel.filePath, gelesen.hash);
      return dokument();
    }),
  );
  registrieren('entwurf-loeschen', (daten) =>
    mitDialog(async () => {
      const entwurf = await entwuerfe.lesen(idPruefen(daten));
      const antwort = await dialog.showMessageBox(fenster, {
        type: 'warning',
        title: 'Entwurf löschen',
        message: `Entwurf „${entwurf.projekt.name}“ löschen?`,
        detail: 'Die lokale Sicherung geht verloren. Eine zugehörige Projektdatei bleibt erhalten.',
        buttons: ['Entwurf löschen', 'Abbrechen'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (antwort.response !== 0) return false;
      await entwuerfe.entfernen(entwurf.id);
      return true;
    }),
  );
  registrieren('exportieren', (daten) =>
    mitDialog(async () => {
      const stand = structuredClone(uebernehmen(daten));
      const ergebnis = vbsErzeugen(stand);
      if (!ergebnis.code || ergebnis.meldungen.some((m) => m.stufe === 'fehler'))
        throw new Error('Der Export ist noch nicht möglich. Bitte korrigiere die markierten Bausteine.');
      const auswahl = await dialog.showSaveDialog(fenster, {
        title: 'Als VBS exportieren',
        defaultPath: `${dateiname(stand.name)}.vbs`,
        filters: [{ name: 'VBScript', extensions: ['vbs'] }],
      });
      if (auswahl.canceled || !auswahl.filePath) return null;
      const ziel = auswahl.filePath;
      if (extname(ziel).toLowerCase() !== '.vbs')
        throw new Error('Bitte verwende die Endung .vbs für den Export.');
      const zwischenpfad = join(dirname(ziel), `.scriptlab-${randomUUID()}.vbs`);
      try {
        await atomarSchreiben(zwischenpfad, vbsKodieren(ergebnis.code));
        const signatur = stand.exportOptionen.signieren
          ? await signaturDienst.exportSignieren(zwischenpfad, stand.exportOptionen)
          : { status: 'nicht-signiert' as const, meldung: 'Nicht signiert', zeitstempel: false };
        if (stand.exportOptionen.signieren && !['gueltig', 'vertrauen-offen'].includes(signatur.status))
          throw new Error(signatur.meldung);
        await rename(zwischenpfad, ziel);
        exportPfad = ziel;
        return { dateiname: basename(ziel), signatur };
      } finally {
        await unlink(zwischenpfad).catch(() => {});
      }
    }),
  );
  registrieren('exportordner', () => {
    if (!exportPfad) throw new Error('Es wurde noch keine Datei exportiert.');
    shell.showItemInFolder(exportPfad);
  });
  registrieren('zertifikate', () => signaturDienst.zertifikateAuflisten());
  registrieren('einstellungen', async (daten) => {
    const neu = einstellungenSchema.parse(daten);
    await atomarSchreiben(einstellungsPfad(), `${JSON.stringify(neu, null, 2)}\n`);
    einstellungen = neu;
    aktualisierungen.vorabversionenSetzen(neu.vorabversionen);
    return einstellungen;
  });
  registrieren('update', (daten) => {
    const aktion = z.enum(['status', 'pruefen', 'laden', 'installieren']).parse(daten);
    if (aktion === 'status') return aktualisierungen.zustandLesen();
    if (aktion === 'pruefen') return aktualisierungen.pruefen();
    if (aktion === 'laden') return aktualisierungen.herunterladen();
    return mitDialog(async () => {
      await aktuellenStandAnfordern();
      if (aktualisierungen.zustandLesen().phase !== 'bereit-zur-installation')
        throw new Error('Es liegt noch kein geprüftes Update zur Installation bereit.');
      const antwort = await dialog.showMessageBox(fenster, {
        type: 'question',
        title: 'Update installieren',
        message: 'ScriptLab jetzt für die Installation schließen und neu starten?',
        buttons: ['Installieren und neu starten', 'Abbrechen'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (antwort.response !== 0 || !(await aenderungenSichern())) return aktualisierungen.zustandLesen();
      await verworfenenEntwurfBereinigen();
      darfSchliessen = true;
      try {
        aktualisierungen.installieren();
      } catch (fehler) {
        darfSchliessen = false;
        throw fehler;
      }
      return aktualisierungen.zustandLesen();
    });
  });
}

async function fensterErstellen(): Promise<void> {
  const rendererOrdner = resolve(__dirname, '../renderer');
  const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.cur': 'image/x-icon',
  };
  protocol.handle('scriptlab', async (anfrage) => {
    const url = new URL(anfrage.url);
    if (url.host !== 'app' || anfrage.method !== 'GET') return new Response(null, { status: 403 });
    let pfad: string;
    try {
      pfad = resolve(rendererOrdner, `.${decodeURIComponent(url.pathname)}`);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (!pfad.startsWith(rendererOrdner + sep)) return new Response(null, { status: 403 });
    try {
      return new Response(await readFile(pfad), {
        headers: {
          'Content-Type': mime[extname(pfad)] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler((_inhalt, _recht, antwort) => antwort(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', (event) => event.preventDefault());
  session.defaultSession.webRequest.onBeforeRequest((details, antwort) => {
    antwort({ cancel: !details.url.startsWith('scriptlab://app/') && !details.url.startsWith('data:') });
  });
  fenster = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: farben.arbeitsflaeche,
    title: 'ScriptLab',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });
  fenster.setMenu(null);
  fenster.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  fenster.webContents.on('will-navigate', (event) => event.preventDefault());
  fenster.webContents.on('will-attach-webview', (event) => event.preventDefault());
  fenster.on('close', (event) => {
    if (darfSchliessen) return;
    event.preventDefault();
    void mitDialog(async () => {
      await aktuellenStandAnfordern();
      if (await aenderungenSichern()) {
        await verworfenenEntwurfBereinigen();
        darfSchliessen = true;
        fenster.close();
      }
    }).catch(() => {});
  });
  ipcEinrichten();
  await fenster.loadURL('scriptlab://app/index.html');
  fensterStatusAktualisieren();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (fenster) {
      if (fenster.isMinimized()) fenster.restore();
      fenster.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (process.platform !== 'win32' || process.arch !== 'x64') {
        dialog.showErrorBox('ScriptLab', 'Diese Version unterstützt Windows 11 x64.');
        app.quit();
        return;
      }
      await mkdir(app.getPath('userData'), { recursive: true });
      projektindex = new Projektindex(join(app.getPath('userData'), 'projektbibliothek.json'));
      await projektindex.initialisieren();
      entwuerfe = new Entwurfspeicher(join(app.getPath('userData'), 'entwuerfe'));
      try {
        einstellungen = einstellungenSchema.parse(JSON.parse(await readFile(einstellungsPfad(), 'utf8')));
      } catch {
        /* Fehlende oder beschädigte Einstellungen verwenden sichere Vorgaben. */
      }
      signaturDienst = new SignaturDienst(
        app.isPackaged
          ? join(process.resourcesPath, 'signatur-helper.ps1')
          : join(app.getAppPath(), 'scripts/signatur-helper.ps1'),
      );
      testDienst = new TestlaufDienst(
        app.isPackaged
          ? join(process.resourcesPath, 'ScriptLab.Testhost.exe')
          : join(app.getAppPath(), 'artifacts/native/ScriptLab.Testhost.exe'),
        join(app.getPath('userData'), 'testlaeufe'),
      );
      aktualisierungen = new AktualisierungsDienst({
        installierteVersion: app.getVersion(),
        istInstalliert: app.isPackaged,
        ressourcenPfad: process.resourcesPath,
        geaendert: () => {},
      });
      await aktualisierungen.initialisieren();
      aktualisierungen.vorabversionenSetzen(einstellungen.vorabversionen);
      app.setAboutPanelOptions({
        applicationName: 'ScriptLab',
        applicationVersion: app.getVersion(),
        authors: ['Leon Stolz'],
        copyright: 'Entwickelt von Leon Stolz',
      });
      await fensterErstellen();
      if (einstellungen.automatischeUpdates) void aktualisierungen.pruefen();
      setInterval(
        () => {
          if (einstellungen.automatischeUpdates) void aktualisierungen.pruefen();
        },
        6 * 60 * 60 * 1000,
      ).unref();
    })
    .catch(() => {
      dialog.showErrorBox(
        'ScriptLab',
        'ScriptLab konnte nicht geöffnet werden. Bitte installiere die Anwendung erneut.',
      );
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
}
