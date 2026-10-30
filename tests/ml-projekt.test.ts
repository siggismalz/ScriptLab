import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { neuesProjekt, projektPruefen } from '../src/kern/projekt';
import { bausteinVerfuegbar } from '../src/kern/workflowarten';
import { projektHash } from '../src/main/projektablage';
import { testStandHash } from '../src/windows/testlauf';
import { jsonSchreiben } from '../src/gemeinsam/json';

describe('Fachliche Workflowarten ohne Änderung alter Abläufe', () => {
  it.each(['python', 'vbs'] as const)(
    'migriert Schema 3 mit %s ohne Inhaltsverlust oder neue Standkennung',
    (sprache) => {
      const { workflowArt: _art, ...alt } = neuesProjekt(sprache);
      const roh = { ...alt, schemaVersion: 3 };
      const original = jsonSchreiben(roh);
      const { ansicht: _ansicht, ...inhalt } = roh;
      const hash = createHash('sha256').update(jsonSchreiben(inhalt)).digest('hex');
      const neu = projektPruefen(roh);
      expect(neu.schemaVersion).toBe(4);
      expect(neu.workflowArt).toBe('allgemein');
      expect(neu.skriptsprache).toBe(sprache);
      expect(neu.editor).toEqual(roh.editor);
      expect(neu.business).toEqual(roh.business);
      expect(projektHash(neu)).toBe(hash);
      expect(testStandHash(neu)).toBe(hash);
      expect(jsonSchreiben(roh)).toBe(original);
    },
  );
  it('erhält Schema-1-VBS und Schema-2-Python als allgemeine Workflows', () => {
    const { workflowArt: _art, business: _business, ...alt } = neuesProjekt('python');
    expect(projektPruefen({ ...alt, schemaVersion: 2 }).skriptsprache).toBe('python');
    const { skriptsprache: _sprache, ...vbs } = alt;
    expect(projektPruefen({ ...vbs, schemaVersion: 1 })).toMatchObject({
      skriptsprache: 'vbs',
      workflowArt: 'allgemein',
    });
  });
  it('legt ML nur ausdrücklich mit Python an und erhält die Art beim Laden', () => {
    const ml = neuesProjekt('python', 'ml');
    expect(projektPruefen(JSON.parse(jsonSchreiben(ml))).workflowArt).toBe('ml');
    expect(() => neuesProjekt('vbs', 'ml')).toThrow('Python');
    expect(() => projektPruefen({ ...ml, skriptsprache: 'vbs' })).toThrow('Python');
    expect(() => projektPruefen({ ...ml, workflowArt: 'smtp' })).toThrow('Workflowart');
    expect(() => projektPruefen({ ...ml, schemaVersion: 5 })).toThrow('neueren');
  });
  it('verschweigt die ML-Art nicht in alten Formaten und verliert keine unbekannten Zusatzdaten', () => {
    expect(() => projektPruefen({ ...neuesProjekt('python', 'ml'), schemaVersion: 3 })).toThrow(
      'Projektformat 4',
    );
    expect(() => projektPruefen({ ...neuesProjekt(), unbekannt: 'erhalten' })).toThrow('Zusatzdaten');
  });
  it('hält die neue Palette klein und beide bisherigen Paletten frei von ML-Bausteinen', () => {
    expect(bausteinVerfuegbar('sl_biz_ml_train', 'python', 'ml')).toBe(true);
    expect(bausteinVerfuegbar('sl_biz_lesen_csv', 'python', 'ml')).toBe(true);
    expect(bausteinVerfuegbar('sl_biz_pdf_text', 'python', 'ml')).toBe(false);
    expect(bausteinVerfuegbar('sl_biz_ml_train', 'python')).toBe(false);
    expect(bausteinVerfuegbar('sl_biz_ml_train', 'vbs')).toBe(false);
    expect(bausteinVerfuegbar('sl_copy', 'vbs')).toBe(true);
  });
});
