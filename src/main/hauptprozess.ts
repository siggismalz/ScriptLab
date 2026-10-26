import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
  type IpcMainInvokeEvent,
  type IpcMainEvent,
} from 'electron';
import { readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { join, resolve, extname, dirname, basename, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { neuesProjekt, projektPruefen, type Projekt } from '../kern/projekt';
import { vbsErzeugen } from '../kern/generator';
import { atomarSchreiben, dateiFehler, projektLesen, projektSchreiben, vbsKodieren } from './dateien';
import { SignaturDienst } from '../windows/signatur';
import { AktualisierungsDienst } from '../windows/updates';
import type { Antwort, Dokument, Einstellungen } from '../gemeinsam/bruecke';

protocol.registerSchemesAsPrivileged([
  { scheme: 'scriptlab', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.setName('ScriptLab');
if (!app.isPackaged && process.env.SCRIPTLAB_TESTDATEN)
  app.setPath('userData', resolve(process.env.SCRIPTLAB_TESTDATEN));
const einstellungenSchema = z
  .object({ automatischeUpdates: z.boolean(), vorabversionen: z.boolean() })
  .strict();
let einstellungen: Einstellungen = { automatischeUpdates: false, vorabversionen: false };
let projekt = neuesProjekt();
let projektPfad: string | null = null;
let gespeichert = JSON.stringify(projekt);
let exportPfad: string | null = null;
let fenster: BrowserWindow;
let darfSchliessen = false;
let dialogAktiv = false;
let signaturDienst: SignaturDienst;
let aktualisierungen: AktualisierungsDienst;
let wartetAufDarstellung = true;
let standAnfrage: { kennung: string; uebernehmen: (daten: unknown) => void } | null = null;

function dokument(): Dokument {
  return {
    projekt,
    dateiname: projektPfad ? basename(projektPfad) : null,
    geaendert: JSON.stringify(projekt) !== gespeichert,
  };
}
function uebernehmen(daten: unknown): Projekt {
  projekt = projektPruefen(daten);
  fenster.setDocumentEdited(dokument().geaendert);
  return projekt;
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
      if (daten !== undefined && JSON.stringify(daten).length > 5 * 1024 * 1024)
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
  let ziel = projektPfad;
  if (!ziel || unter) {
    const auswahl = await dialog.showSaveDialog(fenster, {
      title: 'ScriptLab-Projekt speichern',
      defaultPath: `${dateiname(projekt.name)}.scriptlab`,
      filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
    });
    if (auswahl.canceled || !auswahl.filePath) return null;
    ziel = auswahl.filePath;
    if (extname(ziel).toLowerCase() !== '.scriptlab')
      throw new Error('Bitte speichere Projekte mit der Endung .scriptlab.');
  }
  const stand = projektPruefen(projekt);
  await projektSchreiben(ziel, stand);
  projektPfad = ziel;
  gespeichert = JSON.stringify(stand);
  fenster.setDocumentEdited(dokument().geaendert);
  return dokument();
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
  if (!dokument().geaendert) return true;
  const antwort = await dialog.showMessageBox(fenster, {
    type: 'question',
    title: 'Ungespeicherte Änderungen',
    message: 'Möchtest du deine Änderungen speichern?',
    detail: 'Ohne Speichern gehen die Änderungen an diesem Projekt verloren.',
    buttons: ['Speichern', 'Verwerfen', 'Abbrechen'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (antwort.response === 2) return false;
  if (antwort.response === 0) return (await speichern(false)) !== null;
  return true;
}

async function mitDialog<T>(funktion: () => Promise<T>): Promise<T> {
  if (dialogAktiv) throw new Error('Bitte schließe zuerst den geöffneten Dialog.');
  dialogAktiv = true;
  try {
    return await funktion();
  } finally {
    dialogAktiv = false;
  }
}

function ipcEinrichten(): void {
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
    uebernehmen(daten);
    gespeichert = JSON.stringify(projekt);
    wartetAufDarstellung = false;
    fenster.setDocumentEdited(false);
    return dokument();
  });
  registrieren('aendern', (daten) => {
    uebernehmen(daten);
  });
  registrieren('neu', (daten) =>
    mitDialog(async () => {
      uebernehmen(daten);
      if (!(await aenderungenSichern())) return null;
      projekt = neuesProjekt();
      projektPfad = null;
      gespeichert = JSON.stringify(projekt);
      exportPfad = null;
      wartetAufDarstellung = true;
      fenster.setDocumentEdited(false);
      return dokument();
    }),
  );
  registrieren('oeffnen', (daten) =>
    mitDialog(async () => {
      uebernehmen(daten);
      if (!(await aenderungenSichern())) return null;
      const auswahl = await dialog.showOpenDialog(fenster, {
        title: 'ScriptLab-Projekt öffnen',
        properties: ['openFile'],
        filters: [{ name: 'ScriptLab-Projekt', extensions: ['scriptlab'] }],
      });
      if (auswahl.canceled || auswahl.filePaths.length !== 1) return null;
      const ziel = auswahl.filePaths[0];
      if (extname(ziel).toLowerCase() !== '.scriptlab')
        throw new Error('Bitte wähle eine .scriptlab-Projektdatei.');
      const geladen = await projektLesen(ziel);
      projekt = geladen;
      projektPfad = ziel;
      gespeichert = JSON.stringify(projekt);
      exportPfad = null;
      wartetAufDarstellung = true;
      fenster.setDocumentEdited(false);
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
    width: 1500,
    height: 940,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: '#10131c',
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
        darfSchliessen = true;
        fenster.close();
      }
    }).catch(() => {});
  });
  ipcEinrichten();
  await fenster.loadURL('scriptlab://app/index.html');
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
