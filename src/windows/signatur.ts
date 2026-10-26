import { execFile } from 'node:child_process';
import { isAbsolute, extname, join } from 'node:path';
import { access, stat } from 'node:fs/promises';

export type SignaturStatus =
  'nicht-signiert' | 'gueltig' | 'ungueltig' | 'vertrauen-offen' | 'pruefung-unmoeglich';

export interface Zertifikat {
  fingerabdruck: string;
  betreff: string;
  aussteller: string;
  gueltigVon: string;
  gueltigBis: string;
  speicher: string;
}

export interface SignaturErgebnis {
  status: SignaturStatus;
  meldung: string;
  fingerabdruck?: string;
  herausgeber?: string;
  zeitstempel: boolean;
}

export interface SignaturOptionen {
  zertifikatFingerabdruck: string;
  zeitstempelUrl: string;
}

const statusWerte = new Set<SignaturStatus>([
  'nicht-signiert',
  'gueltig',
  'ungueltig',
  'vertrauen-offen',
  'pruefung-unmoeglich',
]);

export function zeitstempelPruefen(adresse: string): string {
  if (adresse === '') return '';
  if (adresse.length > 2048 || /[\r\n\0]/.test(adresse))
    throw new Error('Die Zeitstempeladresse ist ungueltig.');
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    throw new Error('Bitte eine vollstaendige Zeitstempeladresse eintragen.');
  }
  // Set-AuthenticodeSignature verwendet eine Windows-API ohne HTTPS-Unterstuetzung.
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || !url.hostname) {
    throw new Error(
      'Dieser Windows-Signaturweg unterstuetzt HTTP-Zeitstempel ohne Zugangsdaten oder URL-Parameter. HTTPS wird von der Windows-API nicht unterstuetzt.',
    );
  }
  return url.href;
}

function antwortPruefen(antwort: unknown): SignaturErgebnis {
  if (!antwort || typeof antwort !== 'object')
    throw new Error('Windows lieferte kein lesbares Signaturergebnis.');
  const wert = antwort as Partial<SignaturErgebnis>;
  if (
    !statusWerte.has(wert.status as SignaturStatus) ||
    typeof wert.meldung !== 'string' ||
    typeof wert.zeitstempel !== 'boolean'
  ) {
    throw new Error('Windows lieferte kein gueltiges Signaturergebnis.');
  }
  return {
    status: wert.status as SignaturStatus,
    meldung: wert.meldung.slice(0, 1000),
    zeitstempel: wert.zeitstempel,
    ...(typeof wert.fingerabdruck === 'string' && /^[A-Fa-f0-9]{40}$/.test(wert.fingerabdruck)
      ? { fingerabdruck: wert.fingerabdruck.toUpperCase() }
      : {}),
    ...(typeof wert.herausgeber === 'string' ? { herausgeber: wert.herausgeber.slice(0, 1000) } : {}),
  };
}

/** Nur der Hauptprozess erzeugt diese Instanz. Pfade stammen aus dessen Exportdialog. */
export class SignaturDienst {
  constructor(private readonly helperPfad: string) {
    if (!isAbsolute(helperPfad) || extname(helperPfad).toLowerCase() !== '.ps1')
      throw new Error('Der festgelegte Signaturhelper fehlt.');
  }

  private async helperAufrufen(
    operation: 'Auflisten' | 'Pruefen' | 'Signieren',
    argumente: string[] = [],
  ): Promise<unknown> {
    if (process.platform !== 'win32')
      throw new Error('VBS-Signaturen werden nur unter Windows unterstuetzt.');
    const systemOrdner = process.env.SystemRoot ?? 'C:\\Windows';
    const powershell = join(systemOrdner, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const prozessUmgebung = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath'),
    );
    prozessUmgebung.PSModulePath = join(systemOrdner, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
    try {
      await Promise.all([access(powershell), access(this.helperPfad)]);
    } catch {
      throw new Error(
        'Windows PowerShell oder der fest installierte Signaturhelper fehlt. Unsignierter Export ist weiterhin moeglich.',
      );
    }
    return new Promise((aufloesen, ablehnen) => {
      // Keine Shell, keine freien Befehle, kein ExecutionPolicy-Bypass, keine Ausfuehrung von VBS.
      execFile(
        powershell,
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-File',
          this.helperPfad,
          '-Operation',
          operation,
          ...argumente,
        ],
        {
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8',
          // Ein Start aus PowerShell 7 kann deren inkompatiblen Modulpfad vererben.
          // Nur die mit Windows PowerShell ausgelieferten Module werden geladen.
          env: prozessUmgebung,
        },
        (fehler, stdout) => {
          try {
            const antwort = JSON.parse(stdout.trim().replace(/^\uFEFF/, '')) as {
              ok?: boolean;
              daten?: unknown;
              fehler?: unknown;
            };
            if (antwort.ok === true && !fehler) {
              aufloesen(antwort.daten);
              return;
            }
            if (antwort.ok === false && typeof antwort.fehler === 'string') {
              ablehnen(new Error(antwort.fehler.slice(0, 1200)));
              return;
            }
          } catch {
            /* Gruppenrichtlinien koennen den Helper vor seiner JSON-Ausgabe sperren. */
          }
          ablehnen(
            new Error(
              'Die Windows-Signaturpruefung konnte nicht abgeschlossen werden. Moeglicherweise sperrt eine Richtlinie den Signaturhelper oder der Vorgang hat zu lange gedauert.',
            ),
          );
        },
      );
    });
  }

  async zertifikateAuflisten(): Promise<Zertifikat[]> {
    const antwort = await this.helperAufrufen('Auflisten');
    if (!Array.isArray(antwort) || antwort.length > 1000)
      throw new Error('Der Windows-Zertifikatspeicher konnte nicht gelesen werden.');
    return antwort.map((eintrag: unknown) => {
      if (!eintrag || typeof eintrag !== 'object')
        throw new Error('Der Zertifikatspeicher enthielt einen unlesbaren Eintrag.');
      const wert = eintrag as Record<string, unknown>;
      for (const feld of ['fingerabdruck', 'betreff', 'aussteller', 'gueltigVon', 'gueltigBis', 'speicher']) {
        if (typeof wert[feld] !== 'string')
          throw new Error('Der Zertifikatspeicher enthielt einen unlesbaren Eintrag.');
      }
      if (!/^[A-Fa-f0-9]{40}$/.test(wert.fingerabdruck as string))
        throw new Error('Ein Zertifikat hat keinen gueltigen Fingerabdruck.');
      return wert as unknown as Zertifikat;
    });
  }

  private async exportpfadPruefen(dateiPfad: string): Promise<void> {
    if (!isAbsolute(dateiPfad) || extname(dateiPfad).toLowerCase() !== '.vbs' || /[\r\n\0]/.test(dateiPfad)) {
      throw new Error('Nur eine vom Export erzeugte VBS-Datei kann signiert oder geprueft werden.');
    }
    const datei = await stat(dateiPfad);
    if (!datei.isFile() || datei.size > 10 * 1024 * 1024)
      throw new Error('Die VBS-Exportdatei fehlt oder ist zu gross.');
  }

  async exportSignieren(dateiPfad: string, optionen: SignaturOptionen): Promise<SignaturErgebnis> {
    await this.exportpfadPruefen(dateiPfad);
    if (!/^[A-Fa-f0-9]{40}$/.test(optionen.zertifikatFingerabdruck))
      throw new Error('Bitte zuerst ein geeignetes Code-Signing-Zertifikat auswaehlen.');
    const zeitstempel = zeitstempelPruefen(optionen.zeitstempelUrl);
    return antwortPruefen(
      await this.helperAufrufen('Signieren', [
        '-Datei',
        dateiPfad,
        '-Fingerabdruck',
        optionen.zertifikatFingerabdruck.toUpperCase(),
        '-ZeitstempelUrl',
        zeitstempel,
      ]),
    );
  }

  async exportPruefen(dateiPfad: string): Promise<SignaturErgebnis> {
    await this.exportpfadPruefen(dateiPfad);
    try {
      return antwortPruefen(await this.helperAufrufen('Pruefen', ['-Datei', dateiPfad]));
    } catch (fehler) {
      return {
        status: 'pruefung-unmoeglich',
        meldung: fehler instanceof Error ? fehler.message : 'Windows konnte die Signatur nicht pruefen.',
        zeitstempel: false,
      };
    }
  }
}
