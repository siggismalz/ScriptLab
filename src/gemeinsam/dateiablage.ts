/** Nur die bewusst abgelegte lokale Datei verwenden; Texte, URLs und Dateinamen sind kein Dateipfad. */
export function dateipfadAusAblage(
  daten: Pick<DataTransfer, 'files'>,
  lesen: (datei: File) => string = window.scriptlab.dateipfadAusDatei,
): string {
  if (daten.files.length !== 1)
    throw new Error('Lege genau eine lokale Datei oder einen Ordner auf das passende Pfadfeld.');
  let pfad: string;
  try {
    pfad = lesen(daten.files[0]);
  } catch {
    throw new Error(
      'Der lokale Dateipfad konnte nicht übernommen werden. Wähle die Datei aus oder gib den Pfad ein.',
    );
  }
  if (!pfad || !pfad.trim())
    throw new Error(
      'Diese Ablage enthält keinen lokalen Dateipfad. Speichere die Datei zuerst auf diesem Computer.',
    );
  if (pfad.length > 32768 || /[\0\r\n]/.test(pfad))
    throw new Error('Der abgelegte Pfad ist zu lang oder enthält unzulässige Zeichen.');
  return pfad;
}
