import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { neuesProjekt } from '../src/kern/projekt';
import { EinstellungenDialog } from '../src/renderer/EinstellungenDialog';

const dialog = vi.hoisted(() => ({ fuss: null as ReactElement<{ onClick: () => void }> | null }));
vi.mock('../src/renderer/komponenten/Dialog', () => ({
  Dialog: (angaben: { fuss: ReactElement<{ onClick: () => void }> }) => {
    dialog.fuss = angaben.fuss;
    return null;
  },
}));

for (const sprache of ['python', 'vbs'] as const) {
  it(`${sprache}: Fertig behandelt die gespeicherte HTTPS-Zeitstempeloption ausschließlich im VBS-Kontext`, () => {
    const projekt = neuesProjekt(sprache);
    projekt.exportOptionen.zeitstempelUrl = 'https://zeitstempel.example.test/';
    const vorher = structuredClone(projekt);
    const schliessen = vi.fn(),
      optionenSetzen = vi.fn();
    renderToStaticMarkup(
      createElement(EinstellungenDialog, {
        offen: true,
        projekt,
        schliessen,
        einstellungen: {
          automatischeUpdates: false,
          vorabversionen: false,
          palettenBreite: 272,
          paletteEingeklappt: false,
          eigenschaftenAngeheftet: false,
          textSkalierung: 1,
          letzteSkriptsprache: null,
          pythonInterpreter: null,
        },
        setzen: vi.fn(),
        exportOptionenSetzen: optionenSetzen,
        version: '0.1.0',
        zertifikate: [],
        zertifikateLaden: vi.fn(),
        zertifikatMeldung: '',
        update: null,
        updateAktion: vi.fn(),
        verarbeitung: null,
        fehlerMeldung: null,
        pythonStatus: null,
        pythonAktion: vi.fn(),
      }),
    );
    // Der echte Fertig-Handler arbeitet mit den tatsächlichen initialen React-Hookwerten.
    dialog.fuss!.props.onClick();
    expect(schliessen).toHaveBeenCalledTimes(sprache === 'python' ? 1 : 0);
    expect(optionenSetzen).not.toHaveBeenCalled();
    expect(projekt).toEqual(vorher);
  });
}
