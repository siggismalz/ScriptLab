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
  it('hält Verlauf und optionale Einstellungen im Ergebniskopf statt zusätzlicher Tabs', () => {
    const html = darstellung(testBereit(), {
      kopfNavigation: createElement('button', { type: 'button' }, 'Verlauf anzeigen'),
      businessVorbereitung: createElement('div', {}, 'Modus und Parameter'),
    });
    const kopf = html.slice(
      html.indexOf('class="testbereich-kopf"'),
      html.indexOf('class="testbereich-inhalt"'),
    );
    expect(kopf).toContain('Verlauf anzeigen');
    expect(kopf).toContain('Laufeinstellungen');
    expect(kopf).not.toContain('Prüflauf starten');
    expect(html).not.toContain('role="tablist"');
  });

  it('zeigt bei zurückgesetzten Business-Optionen bereits vor der Initialisierung einen Prüflauf', () => {
    const html = darstellung(testBereit(), {
      businessVorbereitung: createElement('div', {}, 'Modus und Parameter'),
    });
    expect(knopf(html, 'Prüflauf starten')).toContain('sl-knopf--primaer');
    expect(html).toMatch(/aria-label="Laufeinstellungen"[^>]*hidden=""/);
    const ohneBusiness = darstellung();
    expect(knopf(ohneBusiness, 'Workflow ausführen')).toContain('sl-knopf--primaer');
    const bewusst = darstellung(testBereit(), {
      businessVorbereitung: createElement('div', {}, 'Modus und Parameter'),
      optionen: {
        basisVerzeichnis: 'C:\\Synthetisch',
        zeitlimitSekunden: 47,
        business: {
          modus: 'ausfuehren',
          parametersatz: 'echt',
          parameter: {},
          speicherMB: 512,
          tempGB: 4,
          fortsetzen: false,
        },
      },
    });
    expect(knopf(bewusst, 'Workflow ausführen')).toContain('sl-knopf--primaer');
    expect(bewusst).toMatch(/aria-label="Laufeinstellungen"[^>]*hidden=""/);
  });

  it('ordnet einen historischen Lauf mit Datum und Modus ein und hält seine Standkennung intern', () => {
    const zustand = lauf({ phase: 'beendet', exitcode: 0 });
    const html = darstellung(zustand, {
      historisch: true,
      kopfNavigation: createElement('button', { type: 'button' }, 'Verlauf anzeigen'),
    });
    const kopf = html.slice(
      html.indexOf('class="testbereich-kopf"'),
      html.indexOf('class="testbereich-inhalt"'),
    );
    expect(kopf).toContain('Ausführung vom');
    expect(kopf).toContain('26.10.26');
    expect(kopf).toContain('Echte Ausführung');
    expect(kopf).not.toContain('aaaaaaaa');
    expect(zustand.standHash).toBe('a'.repeat(64));
    expect(zustand.gestartetAm).toBe('2026-10-26T12:00:00Z');
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
    expect(html).toContain('Verlauf anzeigen');
    expect(html).not.toContain('Aktueller Arbeitsstand');
    expect(html).not.toContain('class="laufverwaltung-kontext"');
  });

  it('bietet bei fehlender Umgebung einen Einrichtungsweg und erhält alte Laufversionen nur im Modell', () => {
    const ungeprueft = darstellung(testBereit(), {
      sprache: 'python',
      pythonStatus: null,
      pythonEinrichten: () => {},
    });
    expect(ungeprueft).toContain('Ausführung einrichten');
    const alterStand = lauf({
      phase: 'beendet',
      skriptsprache: 'python',
      pythonVersion: '3.12.8',
      exitcode: 0,
    });
    const vorherigerTest = darstellung(alterStand, {
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
    });
    expect(vorherigerTest).not.toContain('3.12.8');
    expect(vorherigerTest).not.toContain('3.15.0');
    expect(alterStand.pythonVersion).toBe('3.12.8');
    expect(alterStand.skriptsprache).toBe('python');
  });
  it('hält Arbeitsordner und Zeitlimit optional bereit und zeigt vor dem ersten Start keine erfundenen Ausgaben', () => {
    const html = darstellung(testBereit(), { optionen: { basisVerzeichnis: null, zeitlimitSekunden: 120 } });
    expect(html).toContain('Wird von ScriptLab festgelegt.');
    expect(html).toContain('Relative Dateipfade verwenden diesen Ordner der Automatisierung');
    expect(knopf(html, 'Workflow ausführen')).not.toContain('disabled=""');
    expect(knopf(html, 'Workflow ausführen')).toContain('sl-knopf--primaer');
    expect(html).not.toContain('>Stoppen<');
    expect(html).toMatch(/min="1"[^>]+max="28800"[^>]+value="120"/);
    expect(html).toMatch(/<h2[^>]*>Ergebnis<\/h2>/);
    expect(html).toMatch(/aria-label="Laufeinstellungen"[^>]*hidden=""/);
    expect(html).not.toContain('>Ausgabe leeren<');
    expect(html).not.toContain('>Ausgabe kopieren<');
    expect(html).toContain('Noch kein Ergebnis');
  });

  it('verhindert einen zweiten Start und hält Stoppen auch bei sonst gesperrter Oberfläche erreichbar', () => {
    const html = darstellung(lauf(), { gesperrt: true });
    expect(knopf(html, 'Workflow ausführen')).toContain('disabled=""');
    expect(knopf(html, 'Stoppen')).not.toContain('disabled=""');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(knopf(html, 'Ausgabe leeren')).not.toContain('disabled=""');
    expect(knopf(html, 'Ausgabe kopieren')).not.toContain('disabled=""');
    expect(html).not.toContain('Stoppe den Test, bevor du die Anzeige leerst.');
    expect(html).not.toContain('role="tab"');
    expect(html).toContain('C:\\Tatsaechlicher Test');
    expect(html).not.toContain('C:\\Naechster Test');
    expect(html).toMatch(/min="1"[^>]+max="28800"[^>]+value="7"/);
  });

  it('trennt nächste Optionen von tatsächlichem Laufkontext und zeigt das echte Ergebnis', () => {
    const zustand = lauf({
      phase: 'beendet',
      beendetAm: '2026-10-26T12:01:02Z',
      exitcode: 0,
      meldung: 'Test beendet.',
    });
    const vorher = structuredClone(zustand);
    const html = darstellung(zustand);
    expect(html).toContain('C:\\Naechster Test');
    expect(html).not.toContain('Lauf-ID');
    expect(html).not.toContain('Standkennung');
    expect(html).toContain('1 min 02 s');
    expect(html).toContain('Test beendet.');
    expect(knopf(html, 'Laufeinstellungen')).not.toContain('disabled=""');
    expect(html).toContain('aria-label="Laufausgabe"');
    expect(zustand).toEqual(vorher);
    expect(zustand.optionen).toEqual({ basisVerzeichnis: 'C:\\Tatsaechlicher Test', zeitlimitSekunden: 7 });
  });

  it('zeigt Ausgabe als escaped Text, erhält die Fehleraktion und rendert technische Felder nicht', () => {
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
    expect(html).not.toContain('&lt;script&gt;Testtext');
    expect(html).not.toMatch(/<img|<script|contenteditable="true"/);
    expect(html).toContain('role="log"');
    expect(html).not.toContain('Fehler in VBS-Zeile 17.');
    expect(html).not.toContain('15–19');
    expect(html).not.toContain('block-fehler');
    expect(html).toContain('Der Test meldet einen Fehler.');
    expect(knopf(html, 'Baustein anzeigen')).not.toContain('disabled=""');
    expect(darstellung(lauf({ fehlerBlockId: null }))).not.toContain('Baustein anzeigen');
  });

  it('kennzeichnet alte Ausgabe und begrenzte Ausgabe ohne einen erfundenen Erfolg', () => {
    const html = darstellung(lauf({ phase: 'abgebrochen', exitcode: null, abgeschnitteneZeichen: 1200 }), {
      veraltet: true,
    });
    expect(html).toContain('Die Ergebnisse gehören zu einem früheren Stand.');
    expect(html).toContain('1.200 Zeichen werden nicht angezeigt.');
    expect(html).toContain('Abgebrochen');
    expect(html).not.toContain('Exitcode');
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
    const zustand = lauf({
      phase: 'beendet',
      exitcode: 0,
      optionen: { basisVerzeichnis: 'C:\\Prueflauf', zeitlimitSekunden: 60, business },
    });
    const html = darstellung(zustand, {
      optionen: {
        basisVerzeichnis: 'C:\\Echte Daten',
        zeitlimitSekunden: 7200,
        business: { ...business, modus: 'ausfuehren', parametersatz: 'echt' },
      },
    });
    expect(html).toContain('<p class="testbereich-modus">Prüflauf ohne Zieländerungen</p>');
    expect(html).toContain('ohne Zieldateien zu verändern.');
    expect(zustand.optionen).toEqual({ basisVerzeichnis: 'C:\\Prueflauf', zeitlimitSekunden: 60, business });
    expect(html).not.toContain('<p class="testbereich-modus">Echte Ausführung</p>');
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
