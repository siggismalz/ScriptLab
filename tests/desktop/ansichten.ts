import { expect, type Locator, type Page } from '@playwright/test';

export async function workflowMenueAktion(seite: Page, name: string) {
  await seite.getByRole('button', { name: 'Workflow', exact: true }).click();
  await seite.getByRole('menuitem', { name, exact: true }).click();
}

export async function ansichtsMenueAktion(seite: Page, name: string) {
  await seite.getByRole('button', { name: 'Ansicht', exact: true }).click();
  await seite.getByRole('menuitem', { name, exact: true }).click();
}

export async function einstellungenOeffnen(seite: Page) {
  const bereiche = seite.getByRole('button', { name: 'Bereiche', exact: true });
  if (await bereiche.isVisible()) {
    await bereiche.click();
    await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  } else await seite.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Ausschließlich echte Navigation; Ansichtswechsel dürfen keinen Lauf auslösen. */
export async function arbeitsbereichWaehlen(seite: Page, name: 'Ablauf' | 'Daten und Parameter' | 'Läufe') {
  await seite
    .getByRole('tablist', { name: 'Arbeitsbereiche des Workflows', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
}

export async function laufansichtWaehlen(
  seite: Page,
  name: 'Vorbereitung' | 'Übersicht' | 'Ergebnisse' | 'Protokoll',
) {
  await arbeitsbereichWaehlen(seite, 'Läufe');
  await seite.getByTestId('test-panel').getByRole('tab', { name, exact: true }).click();
}

export async function startseiteWaehlen(seite: Page) {
  await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
  await seite.getByRole('menuitem', { name: 'Start', exact: true }).click();
}

/** Neue beziehungsweise andere Dateien werden im aktiven Workflow über das benannte Menü gewählt. */
export async function workflowBefehl(seite: Page, befehl: 'neu' | 'oeffnen') {
  const name = befehl === 'neu' ? 'Neuer Workflow' : 'Workflow öffnen';
  const workflow = seite.getByRole('button', { name: 'Workflow', exact: true });
  if (await workflow.isVisible()) {
    await workflow.click();
    await seite.getByRole('menuitem', { name, exact: true }).click();
  } else await seite.getByRole('button', { name, exact: true }).click();
}

/** Bewusster Start nach Prüfung der Vorbereitung, einschließlich vorhandener Kontextbestätigung. */
export async function laufStarten(seite: Page) {
  await laufansichtWaehlen(seite, 'Vorbereitung');
  const vorher = await seite.evaluate(async () => {
    const r = await window.scriptlab.testLesen();
    if (!r.ok) throw Error(r.meldung);
    return r.wert.zustand.laufId;
  });
  const start = seite.getByTestId('test-panel').getByRole('button', {
    name: /^(Workflow ausführen|Prüflauf starten|Datenvorschau laden)$/,
  });
  await start.click();
  let antwort = '';
  await expect
    .poll(
      async () => {
        const z = await seite.evaluate(async () => {
          const r = await window.scriptlab.testLesen();
          if (!r.ok) throw Error(r.meldung);
          return r.wert.zustand;
        });
        antwort =
          z.laufId !== vorher || ['vorbereitung', 'laeuft', 'stoppt'].includes(z.phase)
            ? 'gestartet'
            : (await seite.locator('#status-aktion').textContent())?.includes('Prüfe unter Läufe')
              ? 'kontext-bestaetigen'
              : '';
        return antwort;
      },
      { timeout: 5000 },
    )
    .not.toBe('');
  if (antwort === 'kontext-bestaetigen') await start.click();
  await expect
    .poll(
      async () => {
        const r = await seite.evaluate(() => window.scriptlab.testLesen());
        if (!r.ok) throw Error(r.meldung);
        return r.wert.zustand.laufId;
      },
      { timeout: 15000 },
    )
    .not.toBe(vorher);
}

/** Öffnet nur die Details, die zum gezielt angesprochenen Eingabefeld gehören. */
export async function feldEinblenden(feld: Locator) {
  const bereiche = feld.locator('xpath=ancestor::details');
  for (let index = (await bereiche.count()) - 1; index >= 0; index--) {
    const bereich = bereiche.nth(index);
    if ((await bereich.getAttribute('open')) === null) await bereich.locator(':scope > summary').click();
  }
}
