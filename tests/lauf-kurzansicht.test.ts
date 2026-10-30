import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import { LaufKurzansicht } from '../src/renderer/LaufKurzansicht';

function anzeigen(aenderungen: Partial<TestZustand> = {}, veraltet = false) {
  const details = vi.fn();
  const blockAnzeigen = vi.fn();
  const html = renderToStaticMarkup(
    createElement(LaufKurzansicht, {
      zustand: { ...testBereit(), ...aenderungen },
      veraltet,
      details,
      blockAnzeigen,
    }),
  );
  expect(details).not.toHaveBeenCalled();
  expect(blockAnzeigen).not.toHaveBeenCalled();
  return html;
}

describe('Laufanzeige unmittelbar am Editor', () => {
  it('zeigt vor einem bewussten Start keine Laufanzeige und stößt keine Aktion an', () => {
    expect(anzeigen()).toBe('');
  });

  it.each([
    ['vorbereitung', 'Workflow wird vorbereitet'],
    ['laeuft', 'Workflow läuft'],
    ['stoppt', 'Workflow wird gestoppt'],
    ['beendet', 'Workflow beendet'],
    ['mit_fehlern', 'Workflow mit Fehlern beendet'],
    ['fehlgeschlagen', 'Workflow fehlgeschlagen'],
    ['abgebrochen', 'Workflow abgebrochen'],
    ['zeitlimit', 'Zeitlimit erreicht'],
  ] as const)('zeigt %s mit tatsächlicher Meldung und ohne eigene Prozessknöpfe', (phase, titel) => {
    const html = anzeigen({
      phase,
      meldung: 'Die Quelle C:\\Lange deutsche Pfade\\Eingang.csv wurde geprüft.',
    });
    expect(html).toContain('aria-label="Aktueller Lauf"');
    expect(html).toContain(titel);
    expect(html).toContain('Eingang.csv wurde geprüft.');
    expect(html).toContain('Laufdetails');
    expect(html).not.toContain('Workflow ausführen');
    expect(html).not.toContain('>Stoppen<');
    expect(html).not.toContain('erfolgreich');
    expect(html).not.toContain('Laufausgabe');
  });

  it('zeigt einen fehlgeschlagenen Start ohne Laufkennung mit Fehlerbaustein und Details', () => {
    const html = anzeigen({
      phase: 'fehlgeschlagen',
      laufId: null,
      fehlerBlockId: 'quelle-ungueltig',
      meldung: 'Wähle eine vorhandene Quelldatei.',
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Wähle eine vorhandene Quelldatei.');
    expect(html).toContain('Baustein prüfen');
    expect(html).toContain('Laufdetails');
    expect(anzeigen({ phase: 'fehlgeschlagen' })).not.toContain('Baustein prüfen');
  });

  it('kennzeichnet frühere Workflowstände und sperrt ausschließlich deren Bausteinzuordnung', () => {
    const html = anzeigen({ phase: 'fehlgeschlagen', fehlerBlockId: 'alte-kennung' }, true);
    expect(html).toContain('Dieser Lauf gehört zu einem früheren Workflowstand.');
    expect(html).toContain('Die Bausteinzuordnung ist für den früheren Stand nicht verfügbar.');
    const knoepfe = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)!;
    expect(knoepfe.find((knopf) => knopf.includes('Baustein prüfen'))).toContain('disabled=""');
    expect(knoepfe.find((knopf) => knopf.includes('Laufdetails'))).not.toContain('disabled=""');
  });

  it.each([
    ['vorschau', 'Datenvorschau'],
    ['prueflauf', 'Prüflauf'],
    ['ausfuehren', 'Workflow'],
  ] as const)('benennt den ausdrücklich gewählten Modus %s auch im Kurzstatus', (modus, titel) => {
    const html = anzeigen({
      phase: 'beendet',
      optionen: {
        basisVerzeichnis: null,
        zeitlimitSekunden: 120,
        business: {
          modus,
          parametersatz: 'test',
          parameter: {},
          speicherMB: 512,
          tempGB: 1,
          fortsetzen: false,
        },
      },
    });
    expect(html).toContain(`<strong>${titel} beendet</strong>`);
  });

  it('zeigt nur gemeldete Berichtssummen und unterscheidet geplant von fertig', () => {
    const html = anzeigen({
      phase: 'mit_fehlern',
      exitcode: 0,
      business: {
        schritt: null,
        ereignisse: [{ art: 'abschluss', status: 'erfolgreich', verarbeitet: 999 }],
        vorschau: { zeilen: Array(100).fill('Keine Rohdaten im Kurzstatus') },
        bericht: { summen: { verarbeitet: 2, uebersprungen: 1, geplant: 3 } },
      },
    });
    expect(html).toContain('Workflow mit Fehlern beendet');
    expect(html).toContain('Ausgabedateien: 2 fertig · 1 übersprungen · 3 geplant');
    expect(html).not.toContain('999');
    expect(html).not.toContain('Keine Rohdaten');
    expect(html).not.toContain('erfolgreich');
  });

  it('erfindet aus Exitcode oder ungültigen Summen keine bestätigten Ausgaben', () => {
    const html = anzeigen({
      phase: 'beendet',
      exitcode: 0,
      business: {
        schritt: null,
        ereignisse: [],
        vorschau: null,
        bericht: { summen: { verarbeitet: Infinity, uebersprungen: -2, geplant: '3' } },
      },
    });
    expect(html).not.toContain('Ausgabedateien:');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('3 geplant');
  });

  it('begrenzt eine große Ausgabe auf den aktuellen Textschwanz und rendert Eingaben als Text', () => {
    const ausgabe = `ALTER AUSGABEANFANG\n${'x'.repeat(120000)}\nAKTUELL: <script>alert("Text")</script> 😀`;
    const html = anzeigen({ phase: 'laeuft', ausgabe, meldung: '' });
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Laufausgabe"');
    expect(html).toContain('aria-live="off"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('AKTUELL: &lt;script&gt;alert(&quot;Text&quot;)&lt;/script&gt; 😀');
    expect(html).not.toContain('ALTER AUSGABEANFANG');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Die Ausgabe wurde begrenzt.');
    expect(html.length).toBeLessThan(20000);
  });

  it('erhält Zeichenpaare an der Kürzungsgrenze und zeigt bereits begrenzte Ausgabe ehrlich an', () => {
    const html = anzeigen({ phase: 'laeuft', ausgabe: `😀${'x'.repeat(11999)}` });
    expect(html).not.toContain('\uDE00');
    expect(html).toContain('Die Ausgabe wurde begrenzt.');
    const begrenzt = anzeigen({ phase: 'beendet', ausgabe: 'Letzte Meldung', abgeschnitteneZeichen: 4000 });
    expect(begrenzt).toContain('Letzte Meldung');
    expect(begrenzt).toContain('der verfügbare Verlauf');
    expect(begrenzt).not.toContain('vollständig');
    expect(anzeigen({ phase: 'laeuft', ausgabe: 'Kurze Ausgabe' })).not.toContain('Ausgabe wurde begrenzt');
  });
});
