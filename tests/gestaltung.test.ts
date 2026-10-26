import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { farben, kategoriefarben, cssVariablen, designTokensAnwenden, masse } from '../src/gestaltung/tokens';
import { scriptlabThema, blockStilNachKategorie } from '../src/gestaltung/blocklyThema';
import { Knopf } from '../src/renderer/komponenten/Knopf';
import { Feld, Textfeld } from '../src/renderer/komponenten/Feld';
import { Symbol, symbolNamen } from '../src/renderer/komponenten/Icon';
import { Statusanzeige } from '../src/renderer/komponenten/Statusanzeige';

// Unabhängige WCAG-Relativluminanz; Grenzwerte werden nicht aufgerundet.
function luminanz(hex: string): number {
  const kanal = hex
    .slice(1)
    .match(/../g)!
    .map((s) => parseInt(s, 16) / 255)
    .map((w) => (w <= 0.04045 ? w / 12.92 : ((w + 0.055) / 1.055) ** 2.4));
  return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
}
function kontrast(vorne: string, hinten: string): number {
  const werte = [luminanz(vorne), luminanz(hinten)].sort((a, b) => b - a);
  return (werte[0] + 0.05) / (werte[1] + 0.05);
}

describe('Tatsächliche Designfarben und Kontraste', () => {
  const flaechen = [farben.arbeitsflaeche, farben.grundflaeche, farben.erhoeht];
  for (const hintergrund of flaechen) {
    for (const textfarbe of [
      farben.text,
      farben.textSekundaer,
      farben.erfolg,
      farben.hinweis,
      farben.fehler,
    ]) {
      it(`${textfarbe} bleibt auf ${hintergrund} als normaler Text lesbar`, () =>
        expect(kontrast(textfarbe, hintergrund)).toBeGreaterThanOrEqual(4.5));
    }
    it(`Feldgrenze und Fokus bleiben auf ${hintergrund} sichtbar`, () => {
      expect(kontrast(farben.kontur, hintergrund)).toBeGreaterThanOrEqual(3);
      expect(kontrast(farben.akzent, hintergrund)).toBeGreaterThanOrEqual(3);
    });
  }
  it('prüft Hauptaktion einschließlich Hover/Gedrückt und deaktivierte Texte', () => {
    for (const hintergrund of [farben.akzent, farben.akzentHover, farben.akzentGedrueckt])
      expect(kontrast(farben.aufAkzent, hintergrund)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(farben.inaktivText, farben.inaktivFlaeche)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(farben.inaktivKontur, farben.inaktivFlaeche)).toBeGreaterThanOrEqual(3);
  });
  for (const [kategorie, farbe] of Object.entries(kategoriefarben)) {
    it(`erhält Text, Auswahl und Einfügemarkierung in ${kategorie}`, () => {
      expect(kontrast(farben.text, farbe)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(farben.auswahl, farbe)).toBeGreaterThanOrEqual(3);
      expect(kontrast(farben.canvasFokus, farbe)).toBeGreaterThanOrEqual(3);
      expect(kontrast(farben.einfuegestelle, farbe)).toBeGreaterThanOrEqual(3);
      const stil =
        scriptlabThema.blockStyles[blockStilNachKategorie[kategorie as keyof typeof kategoriefarben]];
      expect(stil.colourPrimary).toBe(farbe);
      expect(kontrast(farben.text, stil.colourSecondary)).toBeGreaterThanOrEqual(4.5);
      expect(stil.colourSecondary).toBe(farben.arbeitsflaeche);
    });
  }
  it('wendet die HTML-Variablen aus derselben Quelle ohne DOM beim Import an', () => {
    const gesetzt = new Map<string, string>();
    designTokensAnwenden({
      style: {
        setProperty: (name: string, wert: string) => gesetzt.set(name, wert),
      } as unknown as CSSStyleDeclaration,
    });
    expect(Object.fromEntries(gesetzt)).toEqual(cssVariablen);
    expect(gesetzt.get('--farbe-arbeitsflaeche')).toBe(
      scriptlabThema.getComponentStyle('workspaceBackgroundColour'),
    );
    expect(masse.iconZiel).toBeGreaterThanOrEqual(32);
    expect(masse.bedienfeld).toBeGreaterThanOrEqual(36);
  });
});

describe('Beschriftungen und zugängliche Komponenten', () => {
  it('erklärt deaktivierte Aktionen sichtbar und verknüpft den Grund', () => {
    const html = renderToStaticMarkup(
      createElement(
        Knopf,
        { disabled: true, grund: 'Wähle zuerst einen Baustein aus.', symbol: 'kopieren' },
        'Kopieren',
      ),
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('Wähle zuerst einen Baustein aus.');
    const grundId = html.match(/aria-describedby="([^"]+)"/)![1];
    expect(html).toContain(`id="${grundId}"`);
    expect(html).not.toContain('opacity');
  });
  it('verweist kompakt auf einen bereits sichtbaren Vorgangstext', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(Knopf, { verarbeitung: true, grundId: 'status-aktion' }, 'Speichern'),
        createElement('p', { id: 'status-aktion' }, 'Das Projekt wird gespeichert.'),
      ),
    );
    expect(html).toContain('aria-describedby="status-aktion"');
    expect(html).toContain('Das Projekt wird gespeichert.');
    expect(html).not.toContain('sl-knopf-mit-grund');
  });
  it('verbindet dauerhafte Feldbeschriftung, Hilfe und konkrete Fehler ohne Placeholder-Abhängigkeit', () => {
    const html = renderToStaticMarkup(
      createElement(Feld, {
        id: 'zielpfad',
        beschriftung: 'Zieldatei',
        hilfe: 'Zum Beispiel Sicherung\\Bericht.txt',
        fehler: 'Gib einen Dateipfad ein.',
      }),
    );
    expect(html).toContain('<label for="zielpfad">Zieldatei</label>');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="zielpfad-hilfe zielpfad-fehler"');
    expect(html).not.toContain('placeholder=');
    const lang = renderToStaticMarkup(
      createElement(Textfeld, {
        beschriftung: 'Vollständiger Pfad',
        value: 'C:\\Ein langer Windows-Pfad\\Dateiname.txt',
        readOnly: true,
      }),
    );
    expect(lang).toMatch(/readonly=""/i);
    expect(lang).toContain('C:\\Ein langer Windows-Pfad\\Dateiname.txt');
  });
  it('vermittelt Status zusätzlich durch Text und ein unterscheidbares Symbol', () => {
    const html = renderToStaticMarkup(
      createElement(Statusanzeige, { art: 'fehler', children: 'Die Datei konnte nicht gespeichert werden.' }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Die Datei konnte nicht gespeichert werden.');
    expect(html).toContain('<svg');
  });
  it('verwendet für alle Symbole dasselbe lokale SVG-System', () => {
    for (const name of symbolNamen) {
      const html = renderToStaticMarkup(createElement(Symbol, { name }));
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('stroke-width="1.75"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toMatch(/<image|href=|https?:/);
    }
  });
});
