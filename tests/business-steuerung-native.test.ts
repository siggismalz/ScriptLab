import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TestlaufDienst } from '../src/windows/testlauf';
import { testAktiv, type TestOptionen } from '../src/gemeinsam/testlauf';
import { neuesProjekt, type EditorBlock } from '../src/kern/projekt';
import { skriptErzeugen } from '../src/kern/skript';
describe.skipIf(process.platform !== 'win32' || process.env.SCRIPTLAB_BUSINESS_TESTS !== '1')(
  'Business-Steuerung im echten Windows-Job',
  () => {
    async function sitzung() {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Business-Steuerung-QA-'));
      const installation = JSON.parse(
        await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
      ).installation;
      const dienst = new TestlaufDienst(
        resolve('artifacts/native/ScriptLab.Testhost.exe'),
        join(ordner, 'technik'),
        async () => installation,
        {
          paketwurzel: resolve('laufzeit'),
          journaleOrdner: join(ordner, 'journale'),
          pruefen: async () => {},
        },
      );
      const optionen: TestOptionen = {
        basisVerzeichnis: ordner,
        zeitlimitSekunden: 10,
        business: {
          modus: 'ausfuehren',
          parametersatz: 'test',
          parameter: {},
          speicherMB: 256,
          tempGB: 1,
          fortsetzen: false,
        },
      };
      return { ordner, dienst, optionen };
    }
    async function warten(d: TestlaufDienst) {
      const ende = Date.now() + 16000;
      while (d.aktiv() && Date.now() < ende) await new Promise((r) => setTimeout(r, 40));
      if (d.aktiv()) await d.stoppen();
      return d.lesen();
    }
    const biz = (type: string, id: string, k: object, e: object = {}): EditorBlock => ({
      type,
      id,
      data: JSON.stringify({ konfiguration: k, eingaben: e }),
    });
    const text = (id: string, TEXT: string): EditorBlock => ({ type: 'sl_text', id, fields: { TEXT } });
    it('durchläuft stabile Dateistapel mit Variablen und kopiert genau die gewählten Dateien', async () => {
      const s = await sitzung();
      try {
        await mkdir(join(s.ordner, 'in'));
        await mkdir(join(s.ordner, 'out'));
        await writeFile(join(s.ordner, 'in', 'A.txt'), 'Grüße A');
        await writeFile(join(s.ordner, 'in', 'B.txt'), 'Grüße B');
        await writeFile(join(s.ordner, 'in', 'nicht.csv'), 'bleibt');
        const p = neuesProjekt('python');
        p.editor.variables = [
          { id: 'datei', name: 'Aktuelle Datei' },
          { id: 'ziel', name: 'Zieldatei' },
        ];
        const liste = biz('sl_biz_dateistapel', 'liste', { ordner: 'in', muster: '*.txt' }),
          schleife = biz('sl_biz_stapel_schleife', 'schleife', {}, { dateien: { referenz: 'liste' } });
        schleife.fields = { VAR: { id: 'datei' } };
        const dateiwert: EditorBlock = { type: 'sl_get', id: 'dateiwert', fields: { VAR: { id: 'datei' } } };
        const dateiname: EditorBlock = {
          type: 'sl_basename',
          id: 'dateiname',
          inputs: { PFAD: { block: dateiwert } },
        };
        const zielpfad: EditorBlock = {
          type: 'sl_join',
          id: 'zielpfad',
          inputs: { A: { block: text('ordnertext', join(s.ordner, 'out') + '\\') }, B: { block: dateiname } },
        };
        const setzen: EditorBlock = {
          type: 'sl_set',
          id: 'setzen',
          fields: { VAR: { id: 'ziel' } },
          inputs: { WERT: { block: zielpfad } },
        };
        setzen.next = {
          block: biz('sl_biz_kopieren', 'kopieren', {
            aktion: 'KOPIEREN',
            quelle: { variable: 'datei' },
            ziel: { variable: 'ziel' },
            konflikt: 'FEHLER',
          }),
        };
        schleife.inputs = { ABLAUF: { block: setzen } };
        liste.next = { block: schleife };
        p.editor.blocks!.blocks[0].next = { block: liste };
        expect(skriptErzeugen(p).meldungen.filter((m) => m.stufe === 'fehler')).toEqual([]);
        s.dienst.starten(p, s.optionen);
        const e = await warten(s.dienst);
        expect(e.phase, JSON.stringify(e)).toBe('beendet');
        expect(await readFile(join(s.ordner, 'out', 'A.txt'), 'utf8')).toBe('Grüße A');
        expect(await readFile(join(s.ordner, 'out', 'B.txt'), 'utf8')).toBe('Grüße B');
        await expect(readFile(join(s.ordner, 'out', 'nicht.csv'))).rejects.toThrow();
      } finally {
        await s.dienst.stoppen();
        await rm(s.ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    }, 30000);
    it('führt den bewussten Fehlerzweig aus und meldet den Teilerfolg ehrlich', async () => {
      const s = await sitzung();
      try {
        const p = neuesProjekt('python'),
          versuch = biz('sl_biz_fehlerbehandlung', 'versuch', {});
        versuch.inputs = {
          ABLAUF: {
            block: biz('sl_biz_lesen_csv', 'fehlt', { format: 'CSV', pfad: 'fehlt.csv', optionen: {} }),
          },
          FEHLER: {
            block: {
              type: 'sl_output',
              id: 'fehlertext',
              inputs: { TEXT: { block: text('hinweis', 'Fehler wurde behandelt') } },
            },
          },
        };
        p.editor.blocks!.blocks[0].next = { block: versuch };
        s.dienst.starten(p, s.optionen);
        const e = await warten(s.dienst);
        expect(e.phase, JSON.stringify(e)).toBe('mit_fehlern');
        expect(e.ausgabe).toContain('Fehler wurde behandelt');
      } finally {
        await s.dienst.stoppen();
        await rm(s.ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    }, 30000);
    for (const grund of ['stoppen', 'zeitlimit'] as const)
      it(`${grund} beendet den tatsächlich laufenden Business-Job`, async () => {
        const s = await sitzung();
        try {
          await writeFile(join(s.ordner, 'quelle.csv'), 'Name\r\nTest\r\n');
          const p = neuesProjekt('python');
          const lesen = biz('sl_biz_lesen_csv', 'lesen', { format: 'CSV', pfad: 'quelle.csv', optionen: {} });
          lesen.next = {
            block: {
              type: 'sl_sleep',
              id: 'warten',
              inputs: { SEKUNDEN: { block: { type: 'sl_number', id: 'sekunden', fields: { ZAHL: '20' } } } },
            },
          };
          p.editor.blocks!.blocks[0].next = { block: lesen };
          const vorher = JSON.stringify(p);
          s.dienst.starten(p, { ...s.optionen, zeitlimitSekunden: grund === 'zeitlimit' ? 1 : 10 });
          const frist = Date.now() + 5000;
          while (s.dienst.lesen().phase === 'vorbereitung' && Date.now() < frist)
            await new Promise((r) => setTimeout(r, 30));
          expect(s.dienst.lesen().phase).toBe('laeuft');
          if (grund === 'stoppen') await s.dienst.stoppen();
          const e = await warten(s.dienst);
          expect(e.phase, JSON.stringify(e)).toBe(grund === 'stoppen' ? 'abgebrochen' : 'zeitlimit');
          expect(s.dienst.aktiv()).toBe(false);
          expect(JSON.stringify(p)).toBe(vorher);
        } finally {
          await s.dienst.stoppen();
          await rm(s.ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        }
      }, 30000);
  },
);
