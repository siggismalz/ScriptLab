import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { testBereit, type TestZustand } from '../src/gemeinsam/testlauf';
import {
  Testbereich,
  ausgabeIstAmEnde,
  laufzeitAnzeigen,
  zeitlimitAusText,
  type TestbereichEigenschaften,
} from '../src/renderer/Testbereich';
import { Laufverwaltung } from '../src/renderer/Laufverwaltung';

function darstellung(zustand = testBereit(), angaben: Partial<TestbereichEigenschaften> = {}): string {
  const nichts = () => {};
  return renderToStaticMarkup(
    createElement(Testbereich, {
      zustand,
      optionen: { basisVerzeichnis: 'C:\\Naechster Test', zeitlimitSekunden: 120 },
      veraltet: false,
      schliessen: nichts,
      starten: nichts,
      stoppen: nichts,
      ordnerWaehlen: nichts,
      optionenAendern: nichts,
      kopieren: nichts,
      leeren: nichts,
      blockAnzeigen: nichts,
      ...angaben,
    }),
  );
}

function knopf(html: string, text: string): string {
  const gefunden = html
    .match(/<button\b[^>]*>[\s\S]*?<\/button>/g)
    ?.find((button) => button.includes(`>${text}<`));
  if (!gefunden) throw new Error(`Die Schaltfläche „${text}“ fehlt.`);
  return gefunden;
}

function lauf(angaben: Partial<TestZustand> = {}): TestZustand {
  return {
    ...testBereit(),
    phase: 'laeuft',
    laufId: 'lauf-1',
    projektKennung: 'projekt-1',
    projektName: 'Gesicherter Teststand',
    standHash: 'a'.repeat(64),
    gestartetAm: '2026-10-26T12:00:00Z',
    optionen: { basisVerzeichnis: 'C:\\Tatsaechlicher Test', zeitlimitSekunden: 7 },
    ausgabe: 'Erste Testzeile\r\n',
    meldung: 'Der Test läuft.',
    ...angaben,
  };
}

describe('Kontrollierte Darstellung des Testbereichs', () => {
  it('hält den Listenrückweg in derselben Kopfleiste wie Ansichten und Startaktion', () => {
    const html = darstellung(testBereit(), {
      kopfNavigation: createElement('button', { type: 'button' }, 'Alle Läufe'),
      businessVorbereitung: createElement('div', {}, 'Modus und Parameter'),
    });
    const kopf = html.slice(
      html.indexOf('class="lauf-kopfleiste"'),
      html.indexOf('class="testbereich-inhalt"'),
    );
    expect(kopf).toContain('Alle Läufe');
    expect(kopf).toContain('Ansichten des Laufs');
    expect(kopf).toContain('Workflow ausführen');
    expect(darstellung()).not.toContain('class="lauf-kopfnavigation"');
  });

  it('ordnet einen historischen Lauf in der Kopfleiste mit Datum, Modus und Stand ein', () => {
    const html = darstellung(lauf({ phase: 'beendet', exitcode: 0 }), {
      historisch: true,
      kopfNavigation: createElement('button', { type: 'button' }, 'Alle Läufe'),
    });
    const kopf = html.slice(
      html.indexOf('class="lauf-kopfleiste"'),
      html.indexOf('class="testbereich-inhalt"'),
    );
    expect(kopf).toContain('Lauf vom');
    expect(kopf).toContain('dateTime="2026-10-26T12:00:00Z"');
    expect(kopf).toContain('Echte Ausführung');
    expect(kopf).toContain('Stand aaaaaaaa');
    expect(kopf).toContain('Neuen Lauf vorbereiten');
    expect(kopf).not.toMatch(/role="tab"[^>]*>Vorbereitung<\/button>/);
  });

  it('zeigt in der Laufverwaltung keinen zusätzlichen Arbeitsstandkopf über der Vorbereitung', () => {
    const nichts = () => {};
    const html = renderToStaticMarkup(
      createElement(Laufverwaltung, {
        projektKennung: 'projekt-1',
        workflowStand: 'stand-1',
        sichtbar: true,
        vorbereitungAnfrage: 0,
        zustand: testBereit(),
        optionen: { basisVerzeichnis: 'C:\\Testdaten', zeitlimitSekunden: 120 },
        veraltet: false,
        schliessen: nichts,
        starten: nichts,
        stoppen: nichts,
        ordnerWaehlen: nichts,
        optionenAendern: nichts,
        kopieren: nichts,
        leeren: nichts,
        blockAnzeigen: nichts,
      }),
    );
    expect(html).toContain('Alle Läufe');
    expect(html).not.toContain('Aktueller Arbeitsstand');
    expect(html).not.toContain('class="laufverwaltung-kontext"');
  });

  it('bietet für ungeprüftes Python den Komponentenstatus und zeigt eine alte Version nur aus dem Teststand', () => {
    const ungeprueft = darstellung(testBereit(), {
      sprache: 'python',
      pythonStatus: null,
      pythonEinrichten: () => {},
    });
    expect(ungeprueft).toContain('Komponentenstatus anzeigen');
    const vorherigerTest = darstellung(
      lauf({ phase: 'beendet', skriptsprache: 'python', pythonVersion: '3.12.8', exitcode: 0 }),
      {
        sprache: 'vbs',
        pythonStatus: {
          zustand: 'bereit',
          auswahl: 'C:\\Python315\\python.exe',
          installation: {
            pfad: 'C:\\Python315\\python.exe',
            version: '3.15.0',
            architektur: 'x64',
            implementierung: 'CPython',
            tkinter: true,
          },
          meldung: 'Aktuelle Installation geprüft.',
        },
        pythonEinrichten: () => {},
      },
    );
    expect(vorherigerTest).toContain('3.12.8');
    expect(vorherigerTest).not.toContain('3.15.0');
    expect(vorherigerTest).toContain('Skriptsprache</dt><dd>Python');
  });
  it('erklärt reale Auswirkungen und zeigt vor dem ersten Test den automatisch verwalteten Arbeitsordner', () => {
    const html = darstellung(testBereit(), { optionen: { basisVerzeichnis: null, zeitlimitSekunden: 120 } });
    expect(html).toContain(
      'Dateiänderungen werden tatsächlich vorgenommen. Stoppen macht sie nicht rückgängig.',
    );
    expect(html).toContain('Keine Sandbox');
    expect(html).toContain('nicht rückgängig');
    expect(html).toContain('Wird von ScriptLab festgelegt.');
    expect(html).toContain('automatisch verwalteten Ordner dieses Workflows');
    expect(knopf(html, 'Workflow ausführen')).not.toContain('disabled=""');
    expect(knopf(html, 'Workflow ausführen')).toContain('sl-knopf--primaer');
    expect(html).not.toContain('>Stoppen<');
    expect(html).toMatch(/min="1"[^>]+max="28800"[^>]+value="120"/);
    expect(html).toMatch(/<h2[^>]*>Läufe<\/h2>/);
    expect(html).toMatch(/role="tab" aria-selected="true"[^>]*>Vorbereitung<\/button>/);
    expect(knopf(html, 'Ausgabe leeren')).toContain('disabled=""');
    expect(knopf(html, 'Ausgabe kopieren')).toContain('disabled=""');
    expect(html).toContain('Für diesen Workflow liegt noch kein Laufprotokoll vor.');
  });

  it('verhindert einen zweiten Start und hält Stoppen auch bei sonst gesperrter Oberfläche erreichbar', () => {
    const html = darstellung(lauf(), { gesperrt: true });
    expect(html).not.toContain('>Workflow ausführen<');
    expect(knopf(html, 'Stoppen')).not.toContain('disabled=""');
    expect(knopf(html, 'Im Explorer anzeigen')).not.toContain('disabled=""');
    expect(knopf(html, 'Ausgabe leeren')).not.toContain('disabled=""');
    expect(knopf(html, 'Ausgabe kopieren')).not.toContain('disabled=""');
    expect(html).not.toContain('Stoppe den Test, bevor du die Anzeige leerst.');
    expect(html).toMatch(/role="tab" aria-selected="true"[^>]*>Übersicht<\/button>/);
    expect(html).toContain('C:\\Tatsaechlicher Test');
    expect(html).not.toContain('C:\\Naechster Test');
    expect(html).toMatch(/min="1"[^>]+max="28800"[^>]+value="7"/);
  });

  it('trennt nächste Optionen von tatsächlichem Laufkontext und zeigt das echte Ergebnis', () => {
    const html = darstellung(
      lauf({ phase: 'beendet', beendetAm: '2026-10-26T12:01:02Z', exitcode: 0, meldung: 'Test beendet.' }),
    );
    expect(html).toContain('C:\\Naechster Test');
    expect(html).toContain('C:\\Tatsaechlicher Test');
    expect(html).toContain('Gesicherter Teststand');
    expect(html).toContain('Lauf-ID');
    expect(html).toContain('Standkennung');
    expect(html).toContain('1 min 02 s');
    expect(html).toContain('<dd>0</dd>');
    expect(knopf(html, 'Neuen Lauf vorbereiten')).not.toContain('disabled=""');
    expect(html.indexOf('Standkennung')).toBeLessThan(html.indexOf('aria-label="Laufprotokoll"'));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Ansichten des Laufs"');
  });

  it('zeigt Ausgabe, Fehler und Quelltext ausschließlich als escaped Text mit konkreter Blockzuordnung', () => {
    const html = darstellung(
      lauf({
        phase: 'fehlgeschlagen',
        exitcode: 1,
        meldung: 'Der Test meldet einen Fehler.',
        ausgabe: '<img src=x onerror="alert(1)">',
        technischeMeldung: '<script>Testtext</script>',
        quelltext: 'WScript.Echo "<script>"',
        fehlerZeile: 17,
        fehlerBlockId: 'block-fehler',
        zeilenZuordnung: [{ von: 15, bis: 19, blockId: 'block-fehler' }],
      }),
    );
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<img|<script|contenteditable="true"/);
    expect(html).toContain('role="log"');
    expect(html).toContain('Fehler in VBS-Zeile 17.');
    expect(html).toContain('15–19');
    expect(html).toContain('block-fehler');
    expect(knopf(html, 'Baustein anzeigen')).not.toContain('disabled=""');
    expect(darstellung(lauf({ fehlerBlockId: null }))).not.toContain('Baustein anzeigen');
  });

  it('kennzeichnet alte Ausgabe und begrenzte Ausgabe ohne einen erfundenen Erfolg', () => {
    const html = darstellung(lauf({ phase: 'abgebrochen', exitcode: null, abgeschnitteneZeichen: 1200 }), {
      veraltet: true,
    });
    expect(html).toContain('Die Ergebnisse gehören zum angezeigten früheren Stand.');
    expect(html).toContain('1.200 Zeichen werden nicht angezeigt.');
    expect(html).toContain('Abgebrochen');
    expect(html).toContain('<dd>Nicht vorhanden</dd>');
    expect(html).not.toContain('sl-status--erfolg');
  });
  it('erhält den Modus eines abgeschlossenen Prüflaufs unabhängig von den nächsten Startoptionen', () => {
    const business = {
      modus: 'prueflauf' as const,
      parametersatz: 'test' as const,
      parameter: {},
      speicherMB: 512,
      tempGB: 4,
      fortsetzen: false,
    };
    const html = darstellung(
      lauf({
        phase: 'beendet',
        exitcode: 0,
        optionen: { basisVerzeichnis: 'C:\\Prueflauf', zeitlimitSekunden: 60, business },
      }),
      {
        optionen: {
          basisVerzeichnis: 'C:\\Echte Daten',
          zeitlimitSekunden: 7200,
          business: { ...business, modus: 'ausfuehren', parametersatz: 'echt' },
        },
      },
    );
    expect(html).toContain('<strong>Modus dieses Laufs:</strong> Prüflauf ohne Zieländerungen');
    expect(html).toContain('<dt>Parametersatz</dt><dd>Testdaten</dd>');
    expect(html).toContain('<dd>C:\\Prueflauf · Zeitlimit 60 s</dd>');
    expect(html).not.toContain('<strong>Modus dieses Laufs:</strong> Echte Ausführung');
  });
});

describe('Begrenzte Eingabe und Anzeigehilfen', () => {
  it('akzeptiert nur ganze Zeitlimits im vereinbarten Bereich', () => {
    for (const [text, wert] of [
      ['1', 1],
      ['120', 120],
      [' 120 ', 120],
      ['0012', 12],
      ['3600', 3600],
      ['28800', 28800],
    ] as const)
      expect(zeitlimitAusText(text)).toBe(wert);
    for (const text of ['', '0', '-1', '28801', '1,5', '1.5', '1e3', 'NaN', '120x'])
      expect(zeitlimitAusText(text)).toBeNull();
  });
  it('behält eine feste beendete Laufzeit und behandelt fehlende oder falsche Zeitpunkte lesbar', () => {
    expect(laufzeitAnzeigen('2026-10-26T12:00:00Z', '2026-10-26T12:01:02Z', 0)).toBe('1 min 02 s');
    expect(laufzeitAnzeigen('2026-10-26T12:00:00Z', null, Date.parse('2026-10-26T12:00:07Z'))).toBe('7 s');
    expect(laufzeitAnzeigen(null, null, 0)).toBe('Noch nicht gestartet');
    expect(laufzeitAnzeigen('unbekannt', null, 0)).toBe('Noch nicht gestartet');
    expect(laufzeitAnzeigen('2026-10-26T12:00:00Z', 'unbekannt', 0)).toBe('Nicht verfügbar');
  });
  it('unterscheidet Ausgabeende von bewusst nach oben gescrollter Ausgabe', () => {
    expect(ausgabeIstAmEnde({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })).toBe(true);
    expect(ausgabeIstAmEnde({ scrollHeight: 1000, clientHeight: 200, scrollTop: 798 })).toBe(true);
    expect(ausgabeIstAmEnde({ scrollHeight: 1000, clientHeight: 200, scrollTop: 797 })).toBe(false);
    expect(ausgabeIstAmEnde({ scrollHeight: 1000, clientHeight: 200, scrollTop: 200 })).toBe(false);
  });
});
