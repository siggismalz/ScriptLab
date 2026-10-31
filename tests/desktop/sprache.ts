import { expect, type Page } from '@playwright/test';

/** Bestehende VBS-Bedienfälle treffen die neue Sprachentscheidung ausdrücklich über dieselbe UI. */
export async function sprachwahlBestaetigen(seite: Page, sprache: 'vbs' | 'python' = 'vbs'): Promise<void> {
  const dialog = seite.getByRole('dialog', { name: 'Neuer Workflow', exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('radio', {
      name: sprache === 'python' ? 'Automatisierung' : 'Windows-Automatisierung',
      exact: true,
    })
    .check();
  await dialog.getByRole('button', { name: 'Workflow erstellen', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
