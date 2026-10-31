import {
  Children,
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EinstellungenDialog } from '../src/renderer/EinstellungenDialog';
import { MlLaufzeit } from '../src/renderer/MlLaufzeit';
import { neuesProjekt } from '../src/kern/projekt';
import type { MLStatus } from '../src/gemeinsam/ml-laufzeit';

const dialog = vi.hoisted(() => ({ inhalt: null as ReactNode, fuss: null as ReactNode }));
vi.mock('../src/renderer/komponenten/Dialog', () => ({
  Dialog: (props: { children: ReactNode; fuss: ReactNode }) => {
    dialog.inhalt = props.children;
    dialog.fuss = props.fuss;
    return props.children;
  },
}));

type Eigenschaften = ComponentProps<typeof EinstellungenDialog>;
type Element = ReactElement<Record<string, unknown>>;
function finden(knoten: ReactNode, passt: (element: Element) => boolean): Element {
  for (const eintrag of Children.toArray(knoten)) {
    if (!isValidElement<Record<string, unknown>>(eintrag)) continue;
    if (passt(eintrag)) return eintrag;
    try {
      return finden(eintrag.props.children as ReactNode, passt);
    } catch {
      /* Der nächste Geschwisterknoten kann das gesuchte Feld enthalten. */
    }
  }
  throw new Error('Das tatsächlich angebotene Bedienelement fehlt.');
}
function feld(titel: string) {
  return finden(dialog.inhalt, (element) => element.props.beschriftung === titel);
}
function aendern(element: Element, wert: string) {
  (element.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: wert } });
}
function props(aenderungen: Partial<Eigenschaften> = {}): Eigenschaften {
  return {
    offen: true,
    schliessen: vi.fn(),
    projekt: neuesProjekt('python'),
    einstellungen: {
      automatischeUpdates: false,
      vorabversionen: false,
      palettenBreite: 272,
      paletteEingeklappt: false,
      eigenschaftenAngeheftet: true,
      textSkalierung: 1,
      letzteSkriptsprache: 'python',
      pythonInterpreter: null,
      darstellung: 'system',
    },
    setzen: vi.fn(),
    exportOptionenSetzen: vi.fn(),
    version: 'TEST-APPVERSION',
    zertifikate: [],
    zertifikateLaden: vi.fn(),
    zertifikatMeldung: '',
    update: null,
    updateAktion: vi.fn(),
    verarbeitung: null,
    fehlerMeldung: null,
    pythonStatus: {
      zustand: 'bereit',
      auswahl: null,
      meldung: 'Technischer Pfad TEST-INTERN',
      installation: {
        pfad: 'C:\\TEST-PYTHON\\python.exe',
        version: 'TEST-VERSION',
        implementierung: 'CPython',
        architektur: 'x64',
        tkinter: true,
      },
    },
    pythonAktion: vi.fn(),
    ...aenderungen,
  };
}
function anzeigen(eigenschaften: Eigenschaften) {
  return renderToStaticMarkup(createElement(EinstellungenDialog, eigenschaften));
}
function fertig() {
  const knopf = finden(dialog.fuss, () => true);
  (knopf.props.onClick as () => void)();
}
beforeEach(() => {
  dialog.inhalt = null;
  dialog.fuss = null;
});

describe('Verständliche Einstellungen mit erhaltenen Funktionen', () => {
  it('ordnet die vorhandenen Einstellungen in drei Bereiche und zeigt funktionale Bereitschaft', () => {
    const p = props();
    const html = anzeigen(p);
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    for (const titel of [
      'Aussehen',
      'Automatisierungen',
      'Updates',
      'Farben und Lesbarkeit',
      'Bausteinpalette',
      'Bereit zum Ausführen.',
    ])
      expect(html).toContain(titel);
    for (const intern of [
      'TEST-APPVERSION',
      'TEST-VERSION',
      'TEST-PYTHON',
      'TEST-INTERN',
      'Versionen und technische Angaben',
      'Breite der Bausteinpalette',
    ])
      expect(html).not.toContain(intern);
    expect(p.setzen).not.toHaveBeenCalled();
    expect(p.pythonAktion).not.toHaveBeenCalled();
    expect(p.updateAktion).not.toHaveBeenCalled();
  });

  it.each([
    ['Farbschema', 'dunkel', 'darstellung', 'dunkel'],
    ['Textgröße der Oberfläche', '2', 'textSkalierung', 2],
    ['Platz für Bausteine', '336', 'palettenBreite', 336],
  ] as const)(
    'übernimmt %s und bewahrt alle anderen gespeicherten Einstellungen',
    (titel, wert, schluessel, erwartet) => {
      const p = props();
      const vorher = structuredClone(p.einstellungen);
      anzeigen(p);
      aendern(feld(titel), wert);
      expect(p.setzen).toHaveBeenCalledExactlyOnceWith({ ...vorher, [schluessel]: erwartet });
      expect(p.einstellungen).toEqual(vorher);
      expect(p.pythonAktion).not.toHaveBeenCalled();
      expect(p.updateAktion).not.toHaveBeenCalled();
    },
  );

  it('bewahrt eine frühere individuelle Palettenbreite bis zur bewussten Auswahl', () => {
    const p = props();
    p.einstellungen.palettenBreite = 313;
    const html = anzeigen(p);
    expect(html).toContain('value="313" selected="">Eigene Einstellung');
    fertig();
    expect(p.setzen).not.toHaveBeenCalled();
    expect(p.schliessen).toHaveBeenCalledTimes(1);
  });

  it('zeigt echte Fehler erreichbar an, ohne eine technische Bereitschaft vorzutäuschen', () => {
    const p = props({
      pythonStatus: {
        zustand: 'fehler',
        auswahl: null,
        installation: null,
        meldung: 'Die bereitgestellte Installation ist beschädigt.',
      },
    });
    const html = anzeigen(p);
    expect(html).toContain('Zurzeit nicht verfügbar. Prüfe die Verfügbarkeit erneut.');
    expect(html).toContain('Fehlermeldung anzeigen');
    expect(html).toContain('Die bereitgestellte Installation ist beschädigt.');
    expect(html).not.toContain('Bereit zum Ausführen.');
  });

  it.each(['python', 'vbs'] as const)(
    '%s: eine deaktivierte Signatur verändert oder blockiert gespeicherte Optionen nicht',
    (sprache) => {
      const projekt = neuesProjekt(sprache);
      projekt.exportOptionen.zeitstempelUrl = 'https://synthetisch.example.test/';
      projekt.exportOptionen.signieren = false;
      const vorher = structuredClone(projekt);
      const p = props({ projekt });
      const html = anzeigen(p);
      expect(html.includes('Signatur für dieses Projekt')).toBe(sprache === 'vbs');
      expect(html).not.toContain('Zeitstempeldienst (optional)');
      fertig();
      expect(p.schliessen).toHaveBeenCalledTimes(1);
      expect(p.exportOptionenSetzen).not.toHaveBeenCalled();
      expect(projekt).toEqual(vorher);
    },
  );

  it('erhält strikte Zeitstempelprüfung für eine tatsächlich aktivierte VBS-Signatur', () => {
    const projekt = neuesProjekt('vbs');
    projekt.exportOptionen.signieren = true;
    projekt.exportOptionen.zeitstempelUrl = 'https://synthetisch.example.test/';
    const p = props({ projekt });
    anzeigen(p);
    fertig();
    expect(p.schliessen).not.toHaveBeenCalled();
    expect(p.exportOptionenSetzen).not.toHaveBeenCalled();
  });

  it('bietet Projektoptionen im globalen Einstellungskontext nicht an', () => {
    const html = anzeigen(props({ projekt: neuesProjekt('vbs'), projektOptionenAnzeigen: false }));
    expect(html).not.toContain('Signatur für dieses Projekt');
  });

  it('führt eine Updateinstallation erst mit der angebotenen ausdrücklichen Aktion aus', () => {
    const p = props({
      update: {
        phase: 'bereit-zur-installation',
        installierteVersion: '0.2',
        verfuegbareVersion: '0.3',
        fortschritt: 100,
        aenderungen: 'Synthetische Änderungen',
        meldung: 'Das Update ist bereit.',
      },
    });
    const html = anzeigen(p);
    expect(html).toContain('Das Update ist bereit.');
    expect(p.updateAktion).not.toHaveBeenCalled();
    const knopf = finden(
      dialog.inhalt,
      (element) => element.props.children === 'Installieren und neu starten',
    );
    (knopf.props.onClick as () => void)();
    expect(p.updateAktion).toHaveBeenCalledExactlyOnceWith('installieren');
  });
});

describe('Optionale Machine-Learning-Einrichtung', () => {
  const status: MLStatus = {
    zustand: 'fehlt',
    meldung: 'Interne Paketdiagnose',
    installation: {
      pfad: 'TEST-ML-PFAD',
      version: 'TEST-ML-VERSION',
      implementierung: 'CPython',
      architektur: 'x64',
      tkinter: false,
    },
    profilHash: 'TEST-HASH',
    pakete: [{ name: 'TEST-PAKET', sollVersion: 'TEST-PIN', version: null, importierbar: false }],
    fortschritt: null,
  };
  it('zeigt Bereitschaft und ausdrückliche Möglichkeiten ohne Paketinventar oder automatische Aktion', () => {
    const aktion = vi.fn();
    const html = renderToStaticMarkup(
      createElement(MlLaufzeit, { status, aktiv: false, fortschritt: null, aktion }),
    );
    for (const text of [
      'Noch nicht eingerichtet.',
      'Online einrichten',
      'Aus Ordner einrichten',
      'auch ohne Einrichtung möglich',
    ])
      expect(html).toContain(text);
    for (const intern of [
      'TEST-ML-PFAD',
      'TEST-ML-VERSION',
      'TEST-HASH',
      'TEST-PAKET',
      'TEST-PIN',
      'Interne Paketdiagnose',
    ])
      expect(html).not.toContain(intern);
    expect(aktion).not.toHaveBeenCalled();
  });
  it('erhält den bestätigten Fortschritt und Abbruch während laufender Einrichtung', () => {
    const aktion = vi.fn();
    const html = renderToStaticMarkup(
      createElement(MlLaufzeit, {
        status,
        aktiv: true,
        fortschritt: {
          phase: 'pakete',
          meldung: 'Installation wird vorbereitet.',
          fertigePakete: 2,
          gesamtPakete: 4,
        },
        aktion,
      }),
    );
    expect(html).toContain('Installation wird vorbereitet.');
    expect(html).toMatch(/<progress[^>]*value="2"[^>]*max="4"/);
    expect(html.match(/disabled=""/g)).toHaveLength(3);
    expect(html).toContain('Vorgang abbrechen');
    expect(aktion).not.toHaveBeenCalled();
  });
});
