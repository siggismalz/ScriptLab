import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SignaturDienst, zeitstempelPruefen } from '../src/windows/signatur';

const updateMock = vi.hoisted(() => ({ instanz: null as unknown as Record<string, unknown> & EventEmitter }));
vi.mock('electron-updater', () => ({
  NsisUpdater: class extends EventEmitter {
    autoDownload = true;
    autoInstallOnAppQuit = true;
    autoRunAppAfterInstall = true;
    allowPrerelease = true;
    allowDowngrade = true;
    disableWebInstaller = false;
    fullChangelog = false;
    logger = null;
    checkForUpdates = vi.fn(async () => { this.emit('checking-for-update'); this.emit('update-not-available', { version: '0.1.0' }); });
    downloadUpdate = vi.fn(async () => { this.emit('download-progress', { percent: 45 }); this.emit('update-downloaded', { version: '0.2.0' }); });
    quitAndInstall = vi.fn();
    constructor() { super(); updateMock.instanz = this as unknown as typeof updateMock.instanz; }
  },
}));
import { AktualisierungsDienst, updateKonfigurationPruefen } from '../src/windows/updates';

describe('Windows-Signaturen ohne Workflowausfuehrung', () => {
  it('begrenzt Zeitstempel auf den unterstuetzten Windows-Weg', () => {
    expect(zeitstempelPruefen('')).toBe('');
    expect(zeitstempelPruefen('http://timestamp.example.test/authenticode')).toBe('http://timestamp.example.test/authenticode');
    for (const url of ['https://timestamp.example.test', 'file:///C:/test', 'http://user:pass@example.test', 'http://example.test?token=geheim', 'http://example.test/#teil', 'http://example.test\n']) {
      expect(() => zeitstempelPruefen(url)).toThrow();
    }
  });

  it.runIf(process.platform === 'win32')('prueft eine echte VBS-Datei ohne sie zu aendern oder zu starten', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'scriptlab-signatur-test-'));
    try {
      const pfad = join(ordner, 'Nur Text mit Umlauten.vbs');
      // Eine Ausfuehrung wuerde scheitern; fuer Authenticode ist der Inhalt nur eine Bytefolge.
      const inhalt = Buffer.from('\uFEFFOption Explicit\r\nDies ist absichtlich kein ausfuehrbares VBScript.\r\n', 'utf16le');
      await writeFile(pfad, inhalt);
      const dienst = new SignaturDienst(resolve('scripts/signatur-helper.ps1'));
      const ergebnis = await dienst.exportPruefen(pfad);
      expect(ergebnis.status, ergebnis.meldung).toBe('nicht-signiert');
      expect(await readFile(pfad)).toEqual(inhalt);
      await expect(dienst.exportSignieren(pfad, { zertifikatFingerabdruck: '0'.repeat(40), zeitstempelUrl: '' })).rejects.toThrow(/Zertifikat/);
      expect(await readFile(pfad)).toEqual(inhalt);
      const zertifikate = await dienst.zertifikateAuflisten();
      expect(zertifikate.every((zertifikat) => /^[0-9A-F]{40}$/i.test(zertifikat.fingerabdruck))).toBe(true);
    } finally { await rm(ordner, { recursive: true, force: true }); }
  }, 15_000);

  it('nimmt keine beliebigen Helperpfade oder Dateitypen an', async () => {
    expect(() => new SignaturDienst('relativer-pfad.ps1')).toThrow();
    const dienst = new SignaturDienst(resolve('scripts/signatur-helper.ps1'));
    await expect(dienst.exportPruefen(resolve('package.json'))).rejects.toThrow(/VBS/);
    await expect(dienst.exportSignieren(resolve('package.json'), { zertifikatFingerabdruck: '0'.repeat(40), zeitstempelUrl: '' })).rejects.toThrow(/VBS/);
  });

  it.runIf(process.platform === 'win32')('behandelt einen unbekannten Windows-Status auch mit Zertifikat niemals als bestaetigte Signatur', async () => {
    const ordner = await mkdtemp(join(tmpdir(), 'scriptlab-signatur-status-'));
    try {
      const vbs = join(ordner, 'Statuspruefung.vbs');
      await writeFile(vbs, Buffer.from('\uFEFFNur Bytefolge fuer den Status-Test.\r\n', 'utf16le'));
      const wrapper = join(ordner, 'status-test.ps1');
      await writeFile(wrapper, `param([string] $HelperPfad, [string] $VbsPfad)
function Get-AuthenticodeSignature {
    param([string] $LiteralPath)
    return [pscustomobject]@{ Status = 'UnknownError'; SignerCertificate = [pscustomobject]@{ Thumbprint = ('A' * 40); Subject = 'CN=Nur Testdaten' }; TimeStamperCertificate = $null }
}
& $HelperPfad -Operation Pruefen -Datei $VbsPfad
`, 'utf8');
      const systemOrdner = process.env.SystemRoot ?? 'C:\\Windows';
      const umgebung = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath'));
      umgebung.PSModulePath = join(systemOrdner, 'System32/WindowsPowerShell/v1.0/Modules');
      const { stdout } = await promisify(execFile)(join(systemOrdner, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', wrapper, '-HelperPfad', resolve('scripts/signatur-helper.ps1'), '-VbsPfad', vbs], { encoding: 'utf8', env: umgebung });
      const antwort = JSON.parse(stdout.trim());
      expect(antwort.ok).toBe(true);
      expect(antwort.daten.fingerabdruck).toBe('A'.repeat(40));
      expect(antwort.daten.status).toBe('pruefung-unmoeglich');
    } finally { await rm(ordner, { recursive: true, force: true }); }
  }, 15_000);
});

describe('Gepruefte Updatequelle und ausdrueckliche Installation', () => {
  let ordner = '';
  const quelle = { provider: 'github', owner: 'siggismalz', repo: 'ScriptLab', publisherName: ['Testidentitaet fuer Unit-Tests'] };
  beforeEach(async () => { ordner = await mkdtemp(join(tmpdir(), 'scriptlab-update-test-')); });
  afterEach(async () => { await rm(ordner, { recursive: true, force: true }); });

  function dienstErstellen(installiert = true) {
    return new AktualisierungsDienst({ installierteVersion: '0.1.0', istInstalliert: installiert, ressourcenPfad: ordner, geaendert: vi.fn() });
  }

  it('verweigert fehlenden Herausgeber, fremde Quellen und eingebettete Tokens', () => {
    expect(updateKonfigurationPruefen(quelle)).toBe(true);
    for (const aenderung of [{ publisherName: null }, { publisherName: [] }, { publisherName: [''] }, { owner: 'fremd' }, { repo: 'Anderes' }, { private: true }, { private: 'true' }, { host: 'fremd.example' }, { protocol: 'http' }, { token: 'nicht-ausliefern' }]) {
      expect(updateKonfigurationPruefen({ ...quelle, ...aenderung })).toBe(false);
    }
  });

  it('schaltet beide gefaehrlichen Defaults und Webinstaller ab', () => {
    dienstErstellen();
    expect(updateMock.instanz.autoDownload).toBe(false);
    expect(updateMock.instanz.autoInstallOnAppQuit).toBe(false);
    expect(updateMock.instanz.allowPrerelease).toBe(false);
    expect(updateMock.instanz.allowDowngrade).toBe(false);
    expect(updateMock.instanz.disableWebInstaller).toBe(true);
  });

  it('fuehrt bei fehlender Konfiguration keinen Netzwerkaufruf aus', async () => {
    const dienst = dienstErstellen();
    expect((await dienst.pruefen()).phase).toBe('nicht-eingerichtet');
    expect(updateMock.instanz.checkForUpdates).not.toHaveBeenCalled();
    expect(updateMock.instanz.downloadUpdate).not.toHaveBeenCalled();
    expect(() => dienst.installieren()).toThrow();
    expect(updateMock.instanz.quitAndInstall).not.toHaveBeenCalled();
  });

  it.runIf(process.platform === 'win32')('meldet Updatefehler und installiert nur nach dem getrennten Aufruf', async () => {
    await writeFile(join(ordner, 'app-update.yml'), JSON.stringify(quelle));
    const dienst = dienstErstellen();
    expect((await dienst.pruefen()).phase).toBe('aktuell');
    updateMock.instanz.emit('update-available', { version: '0.2.0', releaseNotes: '<b>Nur als Text anzeigen</b>' });
    expect(dienst.zustandLesen().aenderungen).toContain('<b>');
    expect((await dienst.herunterladen()).phase).toBe('bereit-zur-installation');
    expect(updateMock.instanz.quitAndInstall).not.toHaveBeenCalled();
    dienst.installieren();
    expect(updateMock.instanz.quitAndInstall).toHaveBeenCalledWith(false, true);
    updateMock.instanz.emit('error', Object.assign(new Error('Technischer Rohtext mit vertraulichem Inhalt'), { code: 'ERR_UPDATER_INVALID_SIGNATURE' }));
    expect(dienst.zustandLesen().phase).toBe('fehler');
    expect(dienst.zustandLesen().meldung).toContain('Windows-Signatur');
    expect(dienst.zustandLesen().meldung).not.toContain('Rohtext');
  });
});
