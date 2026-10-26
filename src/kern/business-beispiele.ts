export const businessBeispiele = [
  {
    id: 'business-monat',
    name: 'Monatliche Auswertung',
    ordner: 'A-Monatsauswertung',
    beschreibung: 'Oktober auswählen und Umsätze nach Region als XLSX und PDF ausgeben.',
    erwartung: '3 Datensätze · Nord 150 · Süd 80 · Gesamt 230',
  },
  {
    id: 'business-bestellungen',
    name: 'Bestellungen mit Stammdaten ergänzen',
    ordner: 'B-Bestellungen',
    beschreibung:
      'Kundennummern kontrolliert zuordnen und fehlende beziehungsweise doppelte Schlüssel erkennen.',
    erwartung: '3 Zuordnungen · K9 als Fehlerhinweis · Nord 45 · Süd 40 · zugeordnet 85',
  },
  {
    id: 'business-bestellvorschlag',
    name: 'Bestellvorschlag als Word-Dokument',
    ordner: 'C-Bestellvorschlag',
    beschreibung: 'Lagerdaten aus Excel lesen, Auffüllmengen berechnen und eine DOCX-Vorlage befüllen.',
    erwartung: 'Lieferant S1 · 2 Positionen · 15 und 12 · insgesamt 27 Einheiten',
  },
  {
    id: 'business-belege',
    name: 'Dokumenteingang geordnet ablegen',
    ordner: 'D-Dokumenteingang',
    beschreibung: 'PDF-Textebenen prüfen und Belege als Kopien nach Monat ablegen.',
    erwartung: '2 Kopien · 1 Scan-Hinweis · unveränderte Originale',
  },
  {
    id: 'business-stapel',
    name: 'Dateistapel verarbeiten und fortsetzen',
    ordner: 'E-Dateistapel',
    beschreibung: 'CSV-Dateien prüfen, bestätigte Ergebnisse schreiben und erfolgreiche Quellen archivieren.',
    erwartung: 'Fehlerhafte Quelle bleibt erhalten · bestätigte Ergebnisse beim Fortsetzen prüfen',
  },
] as const;
