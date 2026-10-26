import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const result = await build({
  stdin: {
    contents:
      "export {neuesProjekt,projektPruefen} from './src/kern/projekt.ts'; export {businessDefinitionen} from './src/kern/business-katalog.ts';export {businessBeispiele} from './src/kern/business-beispiele.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
});
const { neuesProjekt, projektPruefen, businessDefinitionen, businessBeispiele } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
for (const beispiel of businessBeispiele) {
  const ordner = `beispiele/business/${beispiel.ordner}`,
    plan = JSON.parse(await readFile(`${ordner}/plan.json`, 'utf8')),
    parameter = JSON.parse(await readFile(`${ordner}/parameter.json`, 'utf8'));
  const p = neuesProjekt('python');
  p.name = beispiel.name;
  p.beschreibung = beispiel.beschreibung + ' Erwartung: ' + beispiel.erwartung;
  const hash = createHash('sha256').update(beispiel.id).digest('hex');
  p.projektKennung = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  p.business.parameter = Object.entries(parameter).map(([name, standard]) => ({
    name,
    beschriftung: name.replaceAll('_', ' '),
    typ: /datum|monat/i.test(name)
      ? 'Text'
      : /vorlage/i.test(name)
        ? 'Dokumentvorlage'
        : /datei|ordner|ziel|schrift/i.test(name) || (typeof standard === 'string' && /[\\/]/.test(standard))
          ? 'Datei'
          : 'Text',
    erforderlich: true,
    standard,
    hilfe: 'Synthetische Beispieldaten. Vor einem echten Lauf Pfade und Ziele prüfen.',
  }));
  p.business.parametersaetze.test = parameter;
  const bloecke = plan.schritte.map((s, i) => {
    const k = s.konfiguration;
    let kandidaten = businessDefinitionen.filter((d) => d.operation === s.operation);
    for (const feld of ['format', 'aktion'])
      if (k[feld])
        kandidaten = kandidaten.filter((d) =>
          d.felder.some((f) => f.name === feld && f.standard === k[feld]),
        );
    if (s.operation === 'dokument.docx_vorlage')
      kandidaten = kandidaten.filter(
        (d) => d.typ === (k.positionen ? 'sl_biz_docx_positionen' : 'sl_biz_docx_vorlage'),
      );
    if (s.operation === 'dokument.docx_erstellen')
      kandidaten = kandidaten.filter(
        (d) => d.typ === (s.eingaben.tabelle ? 'sl_biz_docx_tabelle' : 'sl_biz_docx_erstellen'),
      );
    if (s.operation === 'dokument.docx_serie')
      kandidaten = kandidaten.filter(
        (d) => d.typ === (k.gruppe_nach ? 'sl_biz_docx_gruppenserie' : 'sl_biz_docx_serie'),
      );
    const d = kandidaten[0];
    if (!d) throw new Error(`Für ${s.operation} fehlt ein Baustein.`);
    const unbekannt = Object.keys(k).filter((n) => !d.felder.some((f) => f.name === n));
    if (unbekannt.length) throw new Error(`${s.id}: Nicht im Formular enthalten: ${unbekannt}`);
    return {
      type: d.typ,
      id: s.id,
      fields: { NAME: `${d.name} (${i + 1})` },
      data: JSON.stringify({ konfiguration: k, eingaben: s.eingaben }),
    };
  });
  for (let i = 0; i < bloecke.length - 1; i++) bloecke[i].next = { block: bloecke[i + 1] };
  p.editor.blocks.blocks[0].next = { block: bloecke[0] };
  await writeFile(`${ordner}/workflow.scriptlab`, JSON.stringify(projektPruefen(p), null, 2) + '\n');
  console.log(`${beispiel.name}: ${bloecke.length} geprüfte Bausteine`);
}
