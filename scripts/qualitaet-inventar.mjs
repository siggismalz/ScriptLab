import { build } from 'esbuild';
import { readFile, readdir, writeFile } from 'node:fs/promises';

// Inventar aus derselben Quelle wie Blockly; keine zweite handgepflegte Typenliste.
const gebaut = await build({
  stdin: { contents: "export {grundBausteine} from './src/kern/katalog.ts'; export {businessDefinitionen} from './src/kern/business-katalog.ts';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', target: 'node24', write: false,
});
const { grundBausteine, businessDefinitionen } = await import('data:text/javascript;base64,' + Buffer.from(gebaut.outputFiles[0].text).toString('base64'));
const testdateien = [];
async function sammeln(ordner) {
  for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
    const pfad = `${ordner}/${eintrag.name}`;
    if (eintrag.isDirectory()) { if (!['screenshots', 'nachweise', '__pycache__'].includes(eintrag.name)) await sammeln(pfad); }
    else if (/\.(test\.ts|spec\.ts|py)$/.test(pfad)) testdateien.push({ pfad, text: await readFile(pfad, 'utf8') });
  }
}
await sammeln('tests');
const zelle = (wert) => String(wert).replaceAll('|', '\\|').replaceAll('\n', ' ');
const hinweise = (typ, operation) => testdateien.filter(t => t.text.includes(typ) || (operation && t.text.includes(operation))).map(t => `\`${t.pfad}\``).join(', ') || 'Keine direkte Textreferenz gefunden';
const effekte = {
  sl_start: 'Ablaufbeginn', sl_end: 'Beendet den laufenden Workflow', sl_comment: 'Keine',
  sl_if: 'Steuert Zweige', sl_repeat: 'Wiederholt Zweig', sl_while: 'Wiederholt Zweig',
  sl_foreach: 'Setzt Schleifenvariable und wiederholt Zweig', sl_foreach_file: 'Liest Verzeichnis, setzt Variable, wiederholt Zweig',
  sl_exists: 'Liest Dateistatus', sl_list_files: 'Liest Verzeichnis', sl_read_text: 'Liest Datei',
  sl_mkdir: 'Erstellt Ordner', sl_copy: 'Kopiert Datei', sl_move: 'Verschiebt Datei', sl_rename: 'Benennt Datei um',
  sl_write_text: 'Schreibt/ergänzt Datei', sl_delete: 'Löscht Datei/Ordner nach angebotener Bestätigung',
  sl_set: 'Setzt Workflowvariable', sl_list_add: 'Ändert Listenvariable', sl_output: 'Schreibt Textausgabe',
  sl_message: 'Öffnet Dialog', sl_input: 'Öffnet Eingabedialog', sl_question: 'Öffnet Frage', sl_log: 'Schreibt Protokolldatei',
  sl_date: 'Liest Systemdatum', sl_time: 'Liest Systemzeit', sl_random: 'Liest Zufallswert', sl_sleep: 'Wartet im gestarteten Prozess',
};
const zeilen = ['# Registrierte Bausteine', '',
  `Aus Code erzeugt mit \`node scripts/qualitaet-inventar.mjs\`: ${grundBausteine.length} Grundtypen und ${businessDefinitionen.length} Business-Typen.`, '',
  'Jede Zeile nennt den statischen Vertrag. Grundtypen werden durch `projekt.ts`/`modell.ts`, Business zusätzlich durch `business-validierung.ts` und die Laufzeit geprüft. Felder nennen gespeicherte Schlüssel, Vorgaben und Auswahlwerte. Ein optionaler Eingang ist als optional bezeichnet.', '',
  '**Prüfstatus je Typ: nicht einzeln durch diesen Inventarlauf ausgeführt.** Die Testspalte nennt ausschließlich Textreferenzen (bei Business auch gemeinsame Operationen), keine automatisch bewiesene Abdeckung. Parameterisierte Katalogtests können weitere Typen prüfen; erfolgreiche Stichproben bestätigen keine ganze Familie. Tatsächlich ausgeführte Suiten und gezielte Ergebnisprüfungen stehen im Abschlussbericht.', '',
  '| Typ / Familie / Name | Sprache | Eingaben und Felder | Ausgabe | Seiteneffekte / Vertrag | Testreferenzen (kein Ausführungsnachweis) |',
  '|---|---|---|---|---|---|'];
for (const d of grundBausteine) {
  const eingaben = d.eingaben.map(e => `${e.name}: ${e.typ}${e.optional ? ' (optional)' : ''}`);
  const felder = d.felder.map(f => `${f.name}=${JSON.stringify(f.standard)}${f.optionen ? ' [' + f.optionen.map(o => o[1]).join(', ') + ']' : ''}`);
  zeilen.push([`${d.typ} / ${d.kategorie} / ${d.name}`, 'Python, VBS', [...eingaben, ...felder].join('; ') || 'Keine', d.ausgabe ?? d.form, `${effekte[d.typ] ?? 'Keine externen Effekte'}; ${d.hilfe}`, hinweise(d.typ)].map(zelle).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
}
for (const d of businessDefinitionen) {
  zeilen.push([`${d.typ} / ${d.gruppe} / ${d.name}`, 'Python', `${JSON.stringify(d.eingaben)}; Konfiguration: ${JSON.stringify(d.felder)}`, d.ausgabe, `${d.operation}; ${d.schreibt ? 'Fachlich schreibend bei echter Ausführung' : 'Lesend/Verarbeitung; technische Laufdateien möglich'}; ${d.hilfe}; Komponenten: ${d.komponenten.join(', ')}`, hinweise(d.typ, d.operation)].map(zelle).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
}
await writeFile('docs/qualitaet/BAUSTEINREGISTER.md', zeilen.join('\n') + '\n');
console.log(`${grundBausteine.length + businessDefinitionen.length} Typen inventarisiert.`);
