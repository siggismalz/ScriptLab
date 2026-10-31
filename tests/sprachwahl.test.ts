import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SprachwahlDialog } from '../src/renderer/SprachwahlDialog';

it('bietet ohne Vorauswahl drei native Angebote und verhindert Anlegen ohne Entscheidung', () => {
  const erstellen = vi.fn();
  const abbrechen = vi.fn();
  const html = renderToStaticMarkup(
    createElement(SprachwahlDialog, { offen: true, vorauswahl: null, abbrechen, erstellen }),
  );
  expect(html).toContain('Neuer Workflow');
  expect(html).toContain('Was möchtest du automatisieren?');
  expect(html).toContain('Dateien verarbeiten, Tabellen bearbeiten und Dokumente erstellen.');
  expect(html.match(/type="radio"/g)).toHaveLength(3);
  expect(html).toContain('aria-label="Automatisierung"');
  expect(html).toContain('aria-label="Windows-Automatisierung"');
  expect(html).toContain('aria-label="Machine Learning"');
  expect(html).not.toContain('checked=""');
  expect(html).toContain('Wähle eine der drei Aufgabenarten.');
  expect(html).toMatch(/disabled=""[^>]*>[^<]*<span>Workflow erstellen/);
  expect(html).not.toContain('Empfohlen');
  expect(erstellen).not.toHaveBeenCalled();
  expect(abbrechen).not.toHaveBeenCalled();
});
