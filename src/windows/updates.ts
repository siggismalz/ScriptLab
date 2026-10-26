import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { NsisUpdater } from 'electron-updater';

export type UpdatePhase = 'nicht-eingerichtet' | 'bereit' | 'prueft' | 'aktuell' | 'verfuegbar' | 'laedt' | 'bereit-zur-installation' | 'fehler';

export interface UpdateZustand {
  phase: UpdatePhase;
  installierteVersion: string;
  verfuegbareVersion: string | null;
  fortschritt: number;
  aenderungen: string;
  meldung: string;
}

interface UpdateUmgebung {
  installierteVersion: string;
  istInstalliert: boolean;
  ressourcenPfad: string;
  geaendert: (zustand: UpdateZustand) => void;
}

function aenderungenLesen(notizen: unknown): string {
  if (typeof notizen === 'string') return notizen.slice(0, 50_000);
  if (Array.isArray(notizen)) return notizen.map((eintrag: unknown) => {
    if (!eintrag || typeof eintrag !== 'object') return '';
    const wert = eintrag as { version?: unknown; note?: unknown };
    return `${typeof wert.version === 'string' ? wert.version : ''}\n${typeof wert.note === 'string' ? wert.note : ''}`.trim();
  }).filter(Boolean).join('\n\n').slice(0, 50_000);
  return 'Fuer diese Version wurden keine Aenderungen beschrieben.';
}

export function updateKonfigurationPruefen(unbekannt: unknown): boolean {
  if (!unbekannt || typeof unbekannt !== 'object' || Array.isArray(unbekannt)) return false;
  const konfiguration = unbekannt as Record<string, unknown>;
  const herausgeber = konfiguration.publisherName;
  const namen = Array.isArray(herausgeber) ? herausgeber : [herausgeber];
  return konfiguration.provider === 'github'
    && konfiguration.owner === 'siggismalz'
    && konfiguration.repo === 'ScriptLab'
    && (konfiguration.private === undefined || konfiguration.private === false)
    && (konfiguration.host === undefined || konfiguration.host === 'github.com')
    && (konfiguration.protocol === undefined || konfiguration.protocol === 'https')
    && !Object.hasOwn(konfiguration, 'token')
    && namen.length > 0
    && namen.every((name: unknown) => typeof name === 'string' && name.trim().length > 0 && name.length < 1000);
}

function updateFehlerErklaeren(fehler: unknown): string {
  const code = fehler && typeof fehler === 'object' && 'code' in fehler ? String(fehler.code) : '';
  if (code.includes('SIGNATURE')) return 'Die Windows-Signatur des Updates ist ungueltig oder gehoert nicht zum erwarteten Herausgeber. Das Update wird nicht installiert.';
  if (code.includes('SHA') || code.includes('CHECKSUM')) return 'Die Integritaetspruefung des Downloads ist fehlgeschlagen. Das Update wird nicht installiert.';
  if (code.includes('LATEST') || code.includes('CHANNEL') || code.includes('HTTP_STATUS')) return 'Die Releasequelle oder die benoetigten Updateartefakte sind derzeit nicht verfuegbar.';
  return 'Die Aktualisierung konnte nicht abgeschlossen werden. Bitte pruefe die Internetverbindung und versuche es spaeter erneut.';
}

/** Nur Anwendungsupdates; die Klasse kennt weder Workflows noch VBS-Dateien. */
export class AktualisierungsDienst {
  private readonly updater: NsisUpdater;
  private zustand: UpdateZustand;
  private eingerichtet = false;
  private initialisiert = false;

  constructor(private readonly umgebung: UpdateUmgebung) {
    this.zustand = {
      phase: 'nicht-eingerichtet', installierteVersion: umgebung.installierteVersion,
      verfuegbareVersion: null, fortschritt: 0, aenderungen: '', meldung: 'Updates werden vorbereitet.',
    };
    this.updater = new NsisUpdater();
    // Beide Defaults sind in electron-updater 6.8.11 true. Bewusst ausschalten.
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.autoRunAppAfterInstall = true;
    this.updater.allowPrerelease = false;
    this.updater.allowDowngrade = false;
    this.updater.disableWebInstaller = true;
    this.updater.fullChangelog = true;
    this.updater.logger = null;
    this.updater.on('checking-for-update', () => this.aktualisieren({ phase: 'prueft', meldung: 'Suche nach Updates ...' }));
    this.updater.on('update-not-available', () => this.aktualisieren({ phase: 'aktuell', verfuegbareVersion: null, meldung: 'ScriptLab ist auf dem neuesten Stand.' }));
    this.updater.on('update-available', (info) => this.aktualisieren({
      phase: 'verfuegbar', verfuegbareVersion: info.version, aenderungen: aenderungenLesen(info.releaseNotes),
      fortschritt: 0, meldung: `Version ${info.version} ist verfuegbar.`,
    }));
    this.updater.on('download-progress', (info) => this.aktualisieren({
      phase: 'laedt', fortschritt: Math.max(0, Math.min(100, info.percent)), meldung: 'Das Update wird heruntergeladen und geprueft.',
    }));
    this.updater.on('update-downloaded', (info) => this.aktualisieren({
      phase: 'bereit-zur-installation', verfuegbareVersion: info.version, fortschritt: 100,
      meldung: 'Das Update wurde heruntergeladen und geprueft. Installation und Neustart beginnen erst nach deiner Bestaetigung.',
    }));
    this.updater.on('error', (fehler) => this.aktualisieren({ phase: 'fehler', meldung: updateFehlerErklaeren(fehler) }));
  }

  private aktualisieren(werte: Partial<UpdateZustand>): void {
    this.zustand = { ...this.zustand, ...werte };
    this.umgebung.geaendert(this.zustandLesen());
  }

  zustandLesen(): UpdateZustand { return { ...this.zustand }; }

  async initialisieren(): Promise<void> {
    if (this.initialisiert) return;
    this.initialisiert = true;
    if (process.platform !== 'win32' || !this.umgebung.istInstalliert) {
      this.aktualisieren({ meldung: 'Updates sind im Entwicklungsmodus nicht aktiv. Installiere eine signierte Releaseversion.' });
      return;
    }
    try {
      const text = await readFile(join(this.umgebung.ressourcenPfad, 'app-update.yml'), 'utf8');
      if (text.length > 100_000 || !updateKonfigurationPruefen(load(text))) {
        this.aktualisieren({ meldung: 'Updates sind fuer diesen Build nicht eingerichtet: Die feste Releasequelle oder der verifizierbare Zertifikatsherausgeber fehlt.' });
        return;
      }
      this.eingerichtet = true;
      this.aktualisieren({ phase: 'bereit', meldung: 'Die signierte GitHub-Releasequelle ist eingerichtet.' });
    } catch {
      this.aktualisieren({ meldung: 'Updates sind fuer diesen Build nicht eingerichtet. Ein signierter Releasebuild mit Updatekonfiguration wird benoetigt.' });
    }
  }

  vorabversionenSetzen(erlaubt: boolean): void {
    this.updater.allowPrerelease = erlaubt;
    this.updater.allowDowngrade = false;
  }

  async pruefen(): Promise<UpdateZustand> {
    await this.initialisieren();
    if (!this.eingerichtet || ['laedt', 'bereit-zur-installation', 'prueft'].includes(this.zustand.phase)) return this.zustandLesen();
    try { await this.updater.checkForUpdates(); } catch (fehler) {
      this.aktualisieren({ phase: 'fehler', meldung: updateFehlerErklaeren(fehler) });
    }
    return this.zustandLesen();
  }

  async herunterladen(): Promise<UpdateZustand> {
    if (!this.eingerichtet || this.zustand.phase !== 'verfuegbar') return this.zustandLesen();
    this.aktualisieren({ phase: 'laedt', fortschritt: 0, meldung: 'Das Update wird heruntergeladen und geprueft.' });
    try { await this.updater.downloadUpdate(); } catch (fehler) {
      this.aktualisieren({ phase: 'fehler', meldung: updateFehlerErklaeren(fehler) });
    }
    return this.zustandLesen();
  }

  /** Erst aufrufen, nachdem der Hauptprozess Projektverlust und Neustart bestaetigt hat. */
  installieren(): void {
    if (!this.eingerichtet || this.zustand.phase !== 'bereit-zur-installation') throw new Error('Es liegt kein geprueftes Update zur Installation bereit.');
    this.updater.quitAndInstall(false, true);
  }
}
