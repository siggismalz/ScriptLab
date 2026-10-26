import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { TestlaufDienst } from '../src/windows/testlauf';
import { testAktiv, type TestOptionen } from '../src/gemeinsam/testlauf';
import { businessTestProjekt } from './hilfen/business-projekt';
import { businessStatusPruefen } from '../src/windows/business-laufzeit';
describe.skipIf(process.platform !== 'win32' || process.env.SCRIPTLAB_BUSINESS_TESTS !== '1')(
  'Business im tatsächlichen kontrollierten Windowsprozess',
  () => {
    it('führt den aktuellen Stand aus, liefert Vorschau ohne Zieldatei und beendet den Job', async () => {
      const ordner = await mkdtemp(join(tmpdir(), 'ScriptLab-Business-QA-'));
      try {
        await writeFile(join(ordner, 'quelle.csv'), 'Nummer;Text\r\n001;Grüße 😀\r\n002;Ende\r\n', 'utf8');
        const installation = JSON.parse(
          await readFile(resolve('artifacts/business-runtime/installation.json'), 'utf8'),
        ).installation;
        const helper = resolve('artifacts/native/ScriptLab.Testhost.exe'),
          wurzel = resolve('laufzeit');
        const dienst = new TestlaufDienst(helper, join(ordner, 'technik'), async () => installation, {
          paketwurzel: wurzel,
          journaleOrdner: join(ordner, 'journale'),
          pruefen: async (i, signal) => {
            const p = await businessStatusPruefen(i, {
              helper,
              technischeOrdner: join(ordner, 'proben'),
              paketwurzel: wurzel,
              signal,
            });
            if (p.zustand !== 'bereit') throw new Error(p.meldung);
          },
        });
        const optionen: TestOptionen = {
          basisVerzeichnis: ordner,
          zeitlimitSekunden: 15,
          business: {
            modus: 'vorschau',
            parametersatz: 'test',
            parameter: {},
            speicherMB: 256,
            tempGB: 1,
            fortsetzen: false,
          },
        };
        const warten = async () => {
          const frist = Date.now() + 25000;
          while (testAktiv(dienst.lesen().phase) && Date.now() < frist)
            await new Promise((r) => setTimeout(r, 80));
          if (dienst.aktiv()) await dienst.stoppen();
          return dienst.lesen();
        };
        dienst.starten(businessTestProjekt(), optionen);
        const v = await warten();
        expect(v.phase, JSON.stringify(v)).toBe('beendet');
        expect(v.business?.vorschau).toBeTruthy();
        await expect(readFile(join(ordner, 'ergebnis.csv'))).rejects.toThrow();
        dienst.starten(businessTestProjekt(), {
          ...optionen,
          business: { ...optionen.business!, modus: 'ausfuehren' },
        });
        const e = await warten();
        expect(e.phase, JSON.stringify(e)).toBe('beendet');
        expect(await readFile(join(ordner, 'ergebnis.csv'), 'utf8')).toContain('001');
        expect(e.business?.bericht).toBeTruthy();
      } finally {
        await rm(ordner, { recursive: true, force: true });
      }
    }, 60000);
  },
);
