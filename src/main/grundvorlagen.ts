import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BeispielKennung } from '../gemeinsam/bruecke';

/** Nur feste, mitgelieferte Testdaten in einen neuen Workflow-Arbeitsordner kopieren. */
export async function grundvorlageKopieren(basis: string, ziel: string, vorlage: BeispielKennung) {
  const ordner =
    vorlage === 'backup' || vorlage === 'backup-python'
      ? 'Backup'
      : vorlage === 'dateiliste' || vorlage === 'dateiliste-python'
        ? 'Dateiliste'
        : null;
  if (!ordner) return false;
  await mkdir(dirname(ziel), { recursive: true });
  // Eine schon belegte Workflowkennung darf niemals mit Vorlagendaten vermischt werden.
  await mkdir(ziel);
  await cp(join(basis, 'grunddaten', ordner), join(ziel, 'ScriptLab-Testdaten', ordner), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return true;
}
