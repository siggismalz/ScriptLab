import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { businessPaketDateien, zipErzeugen } from '../src/main/business-export';
import { businessBeispiele } from '../src/kern/business-beispiele';
import { projektPruefen } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';
import { pythonText } from '../src/kern/python-generator';
import { businessPruefjob } from './hilfen/business-job';
describe('Business-Paket', () => {
  it('schreibt bekannte CRC-32, UTF-8-Namen und gültiges festes ZIP-Datum', () => {
    const z = zipErzeugen([{ name: 'Grüße_日本.txt', inhalt: Buffer.from('123456789') }]);
    expect(z.readUInt32LE(14)).toBe(0xcbf43926);
    expect(z.readUInt16LE(12)).toBe(0x21);
    expect(z.readUInt16LE(6)).toBe(0x800);
  });
  it.each(['../fremd', 'C:/fremd', 'a/../../fremd', 'a\\fremd', 'CON.txt', 'a./b'])(
    'weist unzulässigen Paketpfad %s zurück',
    (name) => expect(() => zipErzeugen([{ name, inhalt: Buffer.from('x') }])).toThrow(),
  );
  it.each(businessBeispiele)('erzeugt $name aus der tatsächlich mitgelieferten Workflowdatei', async (b) => {
    const p = projektPruefen(
      JSON.parse(await readFile(`beispiele/business/${b.ordner}/workflow.scriptlab`, 'utf8')),
    );
    const e = skriptErzeugen(p);
    expect(e.meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
    expect(e.code).toBeTruthy();
    const dateien = await businessPaketDateien(p, e.code!, resolve('laufzeit'), []);
    expect(dateien.some((d) => d.name.endsWith('Vera.ttf'))).toBe(true);
    expect(dateien.some((d) => d.name === 'business-notices.md')).toBe(true);
    expect(dateien.find((d) => d.name === 'LICENSE.txt')?.inhalt).toEqual(await readFile('LICENSE.txt'));
    expect(dateien.find((d) => d.name === 'ANLEITUNG.txt')?.inhalt.toString('utf8')).toContain(
      'keine zusätzliche ScriptLab-Lizenz',
    );
    expect(dateien.some((d) => d.name.startsWith('eingaben/'))).toBe(false);
  });
});
describe.skipIf(process.platform !== 'win32' || process.env.SCRIPTLAB_BUSINESS_TESTS !== '1')(
  'Eigenständiges Business-Paket unter Windows ohne laufende Electron-Anwendung',
  () => {
    for (const b of businessBeispiele)
      it(`führt exportiertes ${b.id} eigenständig aus`, async () => {
        const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Business-Paket-QA-'));
        try {
          const vorlage = resolve(`beispiele/business/${b.ordner}`),
            p = projektPruefen(JSON.parse(await readFile(join(vorlage, 'workflow.scriptlab'), 'utf8')));
          const code = skriptErzeugen(p).code!;
          const paket = join(ordner, 'paket');
          await mkdir(paket);
          const ressourcen =
            b.id === 'business-bestellvorschlag' ? [join(vorlage, 'vorlagen', 'Bestellung.docx')] : [];
          const dateien = await businessPaketDateien(p, code, resolve('laufzeit'), ressourcen, vorlage);
          await writeFile(join(ordner, 'Business.zip'), zipErzeugen(dateien));
          await cp(join(vorlage, 'eingaben'), join(paket, 'eingaben'), { recursive: true });
          await cp(join(vorlage, 'ausgaben'), join(paket, 'ausgaben'), { recursive: true });
          if (b.id === 'business-stapel')
            await cp(join(vorlage, 'archiv'), join(paket, 'archiv'), { recursive: true });
          const erwartet = ['business-bestellungen', 'business-stapel'].includes(b.id) ? 2 : 0;
          const pruefung =
            b.id === 'business-monat'
              ? `from openpyxl import load_workbook\nfrom pypdf import PdfReader\nwb=load_workbook(basis/'ausgaben/Monatsauswertung.xlsx',read_only=True,data_only=True)\nrows=list(wb.active.values)\nassert str(rows).count('150') and str(rows).count('80') and str(rows).count('230'), rows\nwb.close()\ntext=''.join(p.extract_text() for p in PdfReader(basis/'ausgaben/Monatsauswertung.pdf').pages)\nassert all(w in text for w in ['Nord','Süd','150','80','230']),text`
              : b.id === 'business-bestellvorschlag'
                ? `from docx import Document\ndoc=Document(basis/'ausgaben/Bestellung-S1.docx')\ntext=' '.join(p.text for p in doc.paragraphs)+' '.join(c.text for t in doc.tables for r in t.rows for c in r.cells)\nassert all(w in text for w in ['15','12','27','S1']) and '{{' not in text,text\nassert not (basis/'vorlagen/Bestellung.docx').exists()\nassert json.loads((basis/'parameter-beispiel.json').read_text())['Bestellvorlage']=='ressourcen/Bestellung.docx'`
                : b.id === 'business-belege'
                  ? `assert len(list((basis/'ausgaben/Ablage/2026-10').glob('*.pdf')))==2\nassert len(list((basis/'eingaben').glob('*.pdf')))==3`
                  : b.id === 'business-stapel'
                    ? `assert len(list((basis/'ausgaben').glob('*.csv')))==2\nassert len(list((basis/'archiv').glob('*.csv')))==2\nassert len(list((basis/'eingaben').glob('*.csv')))==1`
                    : `from openpyxl import load_workbook\nwb=load_workbook(basis/'ausgaben/Bestelluebersicht.xlsx',read_only=True,data_only=True)\nrows=list(wb.active.values)\nassert all(w in str(rows) for w in ['45','40','85']),rows\nwb.close()`;
          const wrapper = join(ordner, 'paket-pruefen.py');
          await writeFile(
            wrapper,
            `import sys,json,zipfile,runpy\nfrom pathlib import Path\nbasis=Path(${pythonText(paket)})\nwith zipfile.ZipFile(${pythonText(join(ordner, 'Business.zip'))}) as z:\n    assert z.testzip() is None\n    z.extractall(basis)\nsys.argv=[str(basis/'workflow.py'),'--parameter-datei',str(basis/'parameter-beispiel.json'),'--basis',str(basis)]\ntry:\n    runpy.run_path(str(basis/'workflow.py'),run_name='__main__')\nexcept SystemExit as e:\n    assert e.code==${erwartet}, e.code\n${pruefung}\nprint('SCRIPTLAB_PAKET_OK')\n`,
            'utf8',
          );
          const python = JSON.parse(
            await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
          ).installation.pfad;
          const e = await businessPruefjob(python, wrapper, ordner, 30);
          expect(e.code, e.ausgabe + '\n' + e.fehler).toBe(0);
          expect(e.ausgabe).toContain('SCRIPTLAB_PAKET_OK');
        } finally {
          await rm(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        }
      }, 45000);
  },
);
