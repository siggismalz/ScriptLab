import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SprachwahlDialog } from '../src/renderer/SprachwahlDialog';

it('bietet ohne Vorauswahl zwei gleichgewichtige native Radios und verhindert Anlegen ohne Entscheidung', () => {
  const erstellen = vi.fn();
  const html = renderToStaticMarkup(
    createElement(SprachwahlDialog, { offen: true, vorauswahl: null, abbrechen: vi.fn(), erstellen }),
  );
  expect(html).toContain('Neuer Workflow');
  expect(html).toContain('Wähle eine Sprache. Du arbeitest anschließend mit Bausteinen.');
  expect(html).toContain('Für Geschäftsprozesse mit Daten, Excel und Dokumenten.');
  expect(html.match(/type="radio"/g)).toHaveLength(2);
  expect(html).not.toContain('checked=""');
  expect(html).toContain('Wähle zuerst Python oder VBScript (VBS).');
  expect(html).toMatch(/disabled=""[^>]*>[^<]*<span>Workflow erstellen/);
  expect(html).not.toContain('Empfohlen');
  expect(erstellen).not.toHaveBeenCalled();
});
