// Entpacktes Testpaket mit isoliertem Profil und ohne externes Python prüfen.
// Aufruf: node scripts/qualitaet-paket-pruefen.mjs <ScriptLab.exe> [Bericht.json]
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Bitte die entpackte ScriptLab.exe angeben.');
const programm = resolve(process.argv[2]);
const berichtPfad = resolve(process.argv[3] ?? 'artifacts/qualitaet-paket-smoke.json');
const basis = await mkdtemp(join(tmpdir(), 'ScriptLab-Qualitaet-Paket-'));
const profil = join(basis, 'Profil');
const umgebung = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !/^PYTHON/i.test(name) &&
      ![
        'path',
        'tcl_library',
        'tk_library',
        'tcllibpath',
        'scriptlab_testdaten',
        'electron_run_as_node',
      ].includes(name.toLowerCase()),
  ),
);
const windows = process.env.SystemRoot ?? 'C:\\Windows';
umgebung.PATH = [join(windows, 'System32'), windows].join(';');
umgebung.APPDATA = join(basis, 'Roaming');
umgebung.LOCALAPPDATA = join(basis, 'Local');
for (const pfad of [profil, umgebung.APPDATA, umgebung.LOCALAPPDATA]) await mkdir(pfad);
for (const name of ['TCL_LIBRARY', 'TK_LIBRARY', 'TCLLIBPATH'])
  umgebung[name] = join(basis, 'Fremde-Tcl-Konfiguration');
const bericht = {
  erstelltAm: new Date().toISOString(),
  programm,
  bestanden: false,
  grenzen: [
    'Entpacktes Paket; kein Installations- oder Updatevorgang.',
    'Ein synthetischer Grundworkflow; keine vollständige Funktionsabnahme.',
  ],
};
let app;
async function mitFrist(aufgabe, ms) {
  let timer;
  try {
    return await Promise.race([aufgabe, new Promise((fertig) => (timer = setTimeout(fertig, ms)))]);
  } finally {
    clearTimeout(timer);
  }
}
try {
  app = await electron.launch({
    executablePath: programm,
    args: [`--user-data-dir=${profil}`],
    cwd: basis,
    env: umgebung,
  });
  const kontext = await app.evaluate(({ app }) => ({
    profil: app.getPath('userData'),
    paketiert: app.isPackaged,
    ressourcen: process.resourcesPath,
  }));
  if (resolve(kontext.profil).toLowerCase() !== resolve(profil).toLowerCase() || !kontext.paketiert)
    throw new Error('Das tatsächliche Profil oder die Paketidentität stimmt nicht. Keine weitere Appaktion.');
  bericht.profilIsolationBestaetigt = true;
  const seite = await app.firstWindow();
  await seite.waitForFunction(() => Boolean(window.scriptlab?.pythonStatus));
  const python = await seite.evaluate(() => window.scriptlab.pythonStatus());
  if (
    !python.ok ||
    python.wert.zustand !== 'bereit' ||
    python.wert.installation?.tkinter !== true ||
    python.wert.installation.pfad.toLowerCase() !==
      join(kontext.ressourcen, 'python', 'python.exe').toLowerCase()
  )
    throw new Error('Die mitgelieferte Python-/Tk-Laufzeit ist nicht bereit.');
  bericht.pythonVersion = python.wert.installation.version;
  const business = await seite.evaluate(() => window.scriptlab.businessLesen());
  if (
    !business.ok ||
    business.wert.status?.zustand !== 'bereit' ||
    business.wert.status.pakete.length !== 11 ||
    business.wert.status.pakete.some((p) => !p.importierbar || p.version !== p.sollVersion)
  )
    throw new Error('Der mitgelieferte Business-Paketsatz ist nicht vollständig bereit.');
  bericht.businessPakete = business.wert.status.pakete.length;
  const ml = await seite.evaluate(() => window.scriptlab.mlLesen());
  if (!ml.ok || ml.wert.aktiv || ml.wert.status?.zustand !== 'fehlt')
    throw new Error('Das optionale ML-Paket wird im frischen Profil nicht korrekt als fehlend erkannt.');
  bericht.mlStatusOhneEinrichtung = ml.wert.status.zustand;
  const geladen = await seite.evaluate(() => window.scriptlab.laden());
  if (!geladen.ok) throw new Error(geladen.meldung);
  const neu = await seite.evaluate((p) => window.scriptlab.neu(p, 'python'), geladen.wert.dokument.projekt);
  if (!neu.ok || !neu.wert) throw new Error('Der synthetische Python-Workflow konnte nicht angelegt werden.');
  const projekt = neu.wert.projekt;
  const soll = 'ScriptLab-Paketprüfung: Grüße äöü';
  projekt.editor.blocks.blocks[0].next = {
    block: {
      type: 'sl_write_text',
      id: 'paket-schreiben',
      fields: { KODIERUNG: 'UTF8' },
      inputs: {
        PFAD: { block: { type: 'sl_text', id: 'paket-pfad', fields: { TEXT: 'Paketprüfung.txt' } } },
        TEXT: { block: { type: 'sl_text', id: 'paket-text', fields: { TEXT: soll } } },
      },
    },
  };
  const start = await seite.evaluate(
    (p) => window.scriptlab.testStarten(p, { basisVerzeichnis: null, zeitlimitSekunden: 30 }),
    projekt,
  );
  if (!start.ok) throw new Error(start.meldung);
  const frist = Date.now() + 40_000;
  let zustand;
  do {
    const antwort = await seite.evaluate(() => window.scriptlab.testLesen());
    if (!antwort.ok) throw new Error(antwort.meldung);
    zustand = antwort.wert.zustand;
    if (!['vorbereitung', 'laeuft', 'stoppt'].includes(zustand.phase)) break;
    await new Promise((fertig) => setTimeout(fertig, 100));
  } while (Date.now() < frist);
  if (zustand.phase !== 'beendet' || zustand.exitcode !== 0) throw new Error(zustand.meldung);
  const abstand = relative(profil, zustand.optionen.basisVerzeichnis);
  if (abstand.startsWith('..') || isAbsolute(abstand))
    throw new Error('Die Ausgabe liegt außerhalb des Testprofils.');
  const inhalt = await readFile(join(zustand.optionen.basisVerzeichnis, 'Paketprüfung.txt'), 'utf8');
  if (inhalt.replace(/^\uFEFF/, '') !== soll)
    throw new Error('Die unabhängige Dateirücklesung stimmt nicht.');
  bericht.lauf = {
    phase: zustand.phase,
    exitcode: zustand.exitcode,
    pythonVersion: zustand.pythonVersion,
    dateiinhalt: inhalt,
  };
  const vorher = await seite.evaluate(() => window.scriptlab.laden());
  if (!vorher.ok) throw new Error(vorher.meldung);
  const mlNeu = await seite.evaluate(
    (p) => window.scriptlab.neu(p, 'python', 'ml'),
    vorher.wert.dokument.projekt,
  );
  if (!mlNeu.ok || mlNeu.wert?.projekt.workflowArt !== 'ml')
    throw new Error('Die spezialisierte ML-Neuanlage funktioniert im Paket nicht.');
  bericht.mlNeuanlageOhneEinrichtung = true;
  bericht.bestanden = true;
} catch (fehler) {
  bericht.fehler = String(fehler.stack ?? fehler);
} finally {
  if (app) {
    const prozess = app.process();
    const laeuft = () => prozess.exitCode === null && prozess.signalCode === null;
    const ende = laeuft() ? once(prozess, 'exit').catch(() => {}) : Promise.resolve();
    await mitFrist(
      app.evaluate(({ app }) => app.exit(0)).catch(() => {}),
      2_000,
    );
    await mitFrist(ende, 5_000);
    if (laeuft()) {
      // Ausschließlich der von diesem Prüflauf gestartete Prozess samt Nachkommen.
      try {
        execFileSync(join(windows, 'System32', 'taskkill.exe'), ['/PID', String(prozess.pid), '/T', '/F'], {
          windowsHide: true,
          timeout: 5_000,
          stdio: 'ignore',
        });
      } catch (fehler) {
        bericht.beendenFehler = String(fehler);
      }
      await mitFrist(ende, 5_000);
      bericht.bestanden = false;
      bericht.fehler ??= 'Die Anwendung musste nach Ablauf der Beendigungsfrist gestoppt werden.';
    }
    bericht.prozessBeendet = !laeuft();
  }
  await mkdir(dirname(berichtPfad), { recursive: true });
  await writeFile(berichtPfad, JSON.stringify(bericht, null, 2) + '\n');
}
console.log(
  JSON.stringify({ bestanden: bericht.bestanden, bericht: berichtPfad, fehler: bericht.fehler ?? null }),
);
if (!bericht.bestanden) process.exitCode = 1;
