import type { BusinessDefinition, KonfigFeld } from './business-katalog';
import type { JsonWert, WorkflowParameter } from './business-modell';

type Objekt = Record<string, JsonWert>;
const objekt = (wert: unknown): wert is Objekt =>
  wert !== null && typeof wert === 'object' && !Array.isArray(wert);
const vorhanden = (wert: unknown) => wert !== undefined && wert !== null && wert !== '';
const datentypen = ['TEXT', 'GANZZAHL', 'ZAHL', 'WAHRHEIT', 'DATUM', 'ZEITSTEMPEL', 'DEZIMAL'];
const vergleiche = [
  'EQ',
  'NE',
  'GT',
  'GE',
  'LT',
  'LE',
  'ENTHAELT',
  'BEGINNT',
  'ENDET',
  'IN',
  'IST_LEER',
  'IST_NICHT_LEER',
];
const aggregate = ['SUMME', 'ANZAHL', 'ANZAHL_WERTE', 'ANZAHL_VERSCHIEDEN', 'MIN', 'MAX', 'MITTELWERT'];

export interface BusinessFeldfehler {
  text: string;
  /** Relativ zur Business-Konfiguration; nur ein belegter Feldbezug wird angegeben. */
  feldPfad?: string[];
}

export function businessKonfigurationPruefen(
  def: BusinessDefinition,
  konfiguration: Record<string, JsonWert>,
  parameter: WorkflowParameter[],
): string[] {
  return businessKonfigurationFeldfehler(def, konfiguration, parameter).map((fehler) => fehler.text);
}

/** Prüft ausschließlich gespeicherte Angaben. Dynamische Werte und Dateiinhalte bleiben Laufzeitprüfungen. */
export function businessKonfigurationFeldfehler(
  def: BusinessDefinition,
  konfiguration: Record<string, JsonWert>,
  parameter: WorkflowParameter[],
): BusinessFeldfehler[] {
  const fehler: BusinessFeldfehler[] = [];
  let feldPfad: string[] | undefined;
  const melden = (text: string) => {
    const bekannt = fehler.find((f) => f.text === text);
    if (!bekannt) fehler.push({ text, ...(feldPfad ? { feldPfad: [...feldPfad] } : {}) });
    else if (!bekannt.feldPfad && feldPfad) bekannt.feldPfad = [...feldPfad];
  };
  const imFeld = (pfad: string[], pruefen: () => void) => {
    const vorher = feldPfad;
    feldPfad = pfad;
    try {
      pruefen();
    } finally {
      feldPfad = vorher;
    }
  };
  const k = { ...Object.fromEntries(def.felder.map((f) => [f.name, f.standard])), ...konfiguration };
  const op = def.operation;
  const steuerung = (def as BusinessDefinition & { steuerung?: string }).steuerung;
  if (steuerung || op.startsWith('ablauf.')) return [];

  function verweis(wert: unknown, titel: string): boolean {
    if (!objekt(wert)) return false;
    if (Object.hasOwn(wert, 'parameter') && Object.keys(wert).length === 1) {
      if (typeof wert.parameter !== 'string' || !parameter.some((p) => p.name === wert.parameter))
        melden(`Wähle für „${titel}“ einen definierten Workflowparameter aus.`);
      return true;
    }
    if (Object.hasOwn(wert, 'variable') && Object.keys(wert).length === 1) {
      if (typeof wert.variable !== 'string' || !wert.variable.trim())
        melden(`Wähle für „${titel}“ eine Variable aus.`);
      return true;
    }
    return false;
  }
  function text(wert: unknown, titel: string, pflicht = true): boolean {
    if (verweis(wert, titel)) return true;
    if (!pflicht && !vorhanden(wert)) return true;
    if (typeof wert !== 'string' || (pflicht && !wert.trim()) || wert.includes('\0')) {
      melden(`Gib für „${titel}“ ${pflicht ? 'einen nicht leeren' : 'einen gültigen'} Text ein.`);
      return false;
    }
    return true;
  }
  function wahl(wert: unknown, erlaubt: readonly string[], titel: string) {
    if (!verweis(wert, titel) && (typeof wert !== 'string' || !erlaubt.includes(wert)))
      melden(`Wähle für „${titel}“ einen angebotenen Wert aus.`);
  }
  function zahl(
    wert: unknown,
    titel: string,
    minimum: number,
    maximum = Number.MAX_SAFE_INTEGER,
    ganz = true,
  ) {
    if (verweis(wert, titel)) return;
    if (
      typeof wert !== 'number' ||
      !Number.isFinite(wert) ||
      wert < minimum ||
      wert > maximum ||
      (ganz && !Number.isInteger(wert))
    )
      melden(
        `Gib für „${titel}“ ${ganz ? 'eine ganze Zahl' : 'eine Zahl'} zwischen ${minimum} und ${maximum} ein.`,
      );
  }
  function pfad(wert: unknown, titel: string, endung?: string) {
    if (verweis(wert, titel)) return;
    if (text(wert, titel) && endung && typeof wert === 'string' && !wert.toLowerCase().endsWith(endung))
      melden(`Wähle für „${titel}“ einen Dateinamen mit ${endung}.`);
  }
  function liste(wert: unknown, titel: string, minimum = 1, maximum = 1000): JsonWert[] {
    if (verweis(wert, titel)) return [];
    if (!Array.isArray(wert) || wert.length < minimum || wert.length > maximum) {
      melden(
        `Ergänze für „${titel}“ ${minimum ? 'mindestens einen Eintrag' : 'eine Liste'} mit höchstens ${maximum} Einträgen.`,
      );
      return [];
    }
    return wert;
  }
  function spalten(wert: unknown, titel: string, minimum = 1) {
    const werte = liste(wert, titel, minimum);
    werte.forEach((w) => text(w, titel));
    const namen = werte.filter((w): w is string => typeof w === 'string');
    if (new Set(namen).size !== namen.length) melden(`Wähle bei „${titel}“ jeden Eintrag nur einmal.`);
  }
  function typ(wert: unknown, titel: string): string | null {
    if (verweis(wert, titel)) return null;
    if (typeof wert === 'string' && datentypen.includes(wert)) return wert;
    if (objekt(wert) && wert.art === 'DEZIMAL') {
      zahl(wert.praezision ?? 18, `${titel}: Gesamtzahl der Ziffern`, 1, 38);
      zahl(
        wert.skala ?? 2,
        `${titel}: Nachkommastellen`,
        0,
        typeof wert.praezision === 'number' ? wert.praezision : 18,
      );
      return 'DEZIMAL';
    }
    melden(`Wähle für „${titel}“ einen unterstützten Datentyp aus.`);
    return null;
  }
  function datum(wert: string) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(wert) &&
      Number.isFinite(Date.parse(wert)) &&
      new Date(wert).toISOString().slice(0, 10) === wert
    );
  }
  function literal(wert: unknown, titel: string, leerErlaubt = true) {
    if (verweis(wert, titel)) return;
    if (!objekt(wert) || wert.art !== 'wert' || !Object.hasOwn(wert, 'wert')) {
      melden(`Ergänze für „${titel}“ einen typisierten Wert.`);
      return;
    }
    const art = typ(wert.typ, `${titel}: Datentyp`),
      roh = wert.wert;
    if (verweis(roh, titel)) return;
    if (roh === null && leerErlaubt) return;
    let gueltig = false;
    switch (art) {
      case 'TEXT':
        gueltig = typeof roh === 'string';
        break;
      case 'GANZZAHL':
        gueltig =
          typeof roh === 'number' &&
          Number.isFinite(roh) &&
          Number.isInteger(roh) &&
          BigInt(roh) >= -(2n ** 63n) &&
          BigInt(roh) < 2n ** 63n;
        break;
      case 'ZAHL':
        gueltig = typeof roh === 'number' && Number.isFinite(roh);
        break;
      case 'WAHRHEIT':
        gueltig = typeof roh === 'boolean';
        break;
      case 'DATUM':
        gueltig = typeof roh === 'string' && datum(roh);
        break;
      case 'ZEITSTEMPEL': {
        const t =
          typeof roh === 'string'
            ? /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?$/.exec(roh)
            : null;
        gueltig = !!t && datum(t[1]) && (!t[2] || (+t[2] <= 23 && +t[3] <= 59 && (!t[4] || +t[4] <= 59)));
        break;
      }
      case 'DEZIMAL': {
        gueltig = typeof roh === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(roh);
        if (gueltig && typeof roh === 'string') {
          const [ganz, nach = ''] = roh.replace(/^[+-]/, '').split('.');
          const p = objekt(wert.typ) ? Number(wert.typ.praezision ?? 18) : 18;
          const s = objekt(wert.typ) ? Number(wert.typ.skala ?? 2) : 2;
          gueltig = nach.length <= s && ganz.replace(/^0+/, '').length <= p - s;
        }
        break;
      }
    }
    if (art && !gueltig)
      melden(
        `Der Wert bei „${titel}“ passt nicht zum gewählten Datentyp${roh === null ? ' und darf hier nicht leer sein' : ''}.`,
      );
  }
  let knoten = 0;
  function astGrenze(tiefe: number) {
    if (++knoten > 500 || tiefe > 20) {
      melden('Vereinfache den stark verschachtelten Ausdruck oder die Bedingung.');
      return true;
    }
    return false;
  }
  function ausdruck(wert: unknown, titel: string, tiefe = 0) {
    if (astGrenze(tiefe) || verweis(wert, titel)) return;
    if (!objekt(wert)) {
      melden(`Ergänze für „${titel}“ einen vollständigen Ausdruck.`);
      return;
    }
    switch (wert.art) {
      case 'spalte':
        text(wert.name, `${titel}: Spalte`);
        break;
      case 'wert':
        literal(wert, titel);
        break;
      case 'rechnen':
        wahl(wert.operator, ['ADD', 'SUB', 'MUL', 'DIV'], `${titel}: Rechenart`);
        ausdruck(wert.links, `${titel}: linker Wert`, tiefe + 1);
        ausdruck(wert.rechts, `${titel}: rechter Wert`, tiefe + 1);
        if (
          wert.operator === 'DIV' &&
          objekt(wert.rechts) &&
          wert.rechts.art === 'wert' &&
          (wert.rechts.wert === 0 ||
            (typeof wert.rechts.wert === 'string' && /^[+-]?0+(?:\.0+)?$/.test(wert.rechts.wert)))
        )
          melden('Eine Division durch den festen Wert 0 ist nicht erlaubt.');
        break;
      case 'funktion':
        wahl(
          wert.funktion,
          ['JAHR', 'MONAT', 'TAG', 'TRIM', 'GROSS', 'KLEIN', 'LAENGE', 'REGEX'],
          `${titel}: Funktion`,
        );
        ausdruck(wert.argument, `${titel}: Funktionswert`, tiefe + 1);
        if (wert.funktion === 'REGEX') {
          text(wert.muster, `${titel}: Suchmuster`);
          zahl(wert.gruppe ?? 0, `${titel}: Ergebnisgruppe`, 0, 99);
          if (typeof wert.muster === 'string' && wert.muster.length > 1000)
            melden('Das Suchmuster darf höchstens 1000 Zeichen enthalten.');
        }
        break;
      default:
        melden(`Wähle für „${titel}“ einen unterstützten Ausdruck aus.`);
    }
  }
  function bedingung(wert: unknown, titel: string, tiefe = 0) {
    if (astGrenze(tiefe) || verweis(wert, titel)) return;
    if (!objekt(wert)) {
      melden(`Ergänze für „${titel}“ eine vollständige Bedingung.`);
      return;
    }
    if (wert.art === 'UND' || wert.art === 'ODER') {
      liste(wert.kinder, `${titel}: Bedingungen`, 1, 100).forEach((w, i) =>
        bedingung(w, `${titel}: Bedingung ${i + 1}`, tiefe + 1),
      );
      return;
    }
    if (wert.art === 'NICHT') {
      bedingung(wert.kind, `${titel}: umgekehrte Bedingung`, tiefe + 1);
      return;
    }
    if (wert.art !== 'vergleich') {
      melden(`Wähle für „${titel}“ einen unterstützten Vergleich aus.`);
      return;
    }
    wahl(wert.operator, vergleiche, `${titel}: Vergleich`);
    ausdruck(
      wert.links ?? { art: 'spalte', name: wert.spalte ?? '' },
      `${titel}: verglichener Wert`,
      tiefe + 1,
    );
    if (wert.operator === 'IN')
      liste(wert.werte, `${titel}: erlaubte Werte`).forEach((w) =>
        literal(w, `${titel}: erlaubter Wert`, false),
      );
    else if (!['IST_LEER', 'IST_NICHT_LEER'].includes(String(wert.operator))) {
      const rechts = wert.rechts ?? wert.wert;
      ausdruck(rechts, `${titel}: Vergleichswert`, tiefe + 1);
      if (objekt(rechts) && rechts.art === 'wert' && rechts.wert === null)
        melden('Prüfe leere Werte mit „ist leer“ oder „ist nicht leer“.');
    }
  }
  function feld(f: KonfigFeld, wert: JsonWert | undefined, titel = f.titel, pfad = [f.name]) {
    imFeld(pfad, () => feldInhalt(f, wert, titel, pfad));
  }
  function feldInhalt(f: KonfigFeld, wert: JsonWert | undefined, titel: string, pfad: string[]) {
    if (verweis(wert, titel)) return;
    if (wert === undefined) wert = f.standard;
    if (f.art === 'text') {
      if (objekt(wert) && wert.art === 'wert' && ['suchen', 'ersatz', 'minimum', 'maximum'].includes(f.name))
        literal(wert, titel);
      else text(wert, titel, false);
    } else if (f.art === 'zahl') {
      if (typeof wert !== 'number' || !Number.isFinite(wert))
        melden(`Gib für „${titel}“ eine endliche Zahl ein.`);
    } else if (f.art === 'wahrheit') {
      if (typeof wert !== 'boolean') melden(`Wähle für „${titel}“ Ja oder Nein aus.`);
    } else if (f.art === 'auswahl') wahl(wert, f.optionen ?? [], titel);
    else if (f.art === 'typ') typ(wert, titel);
    else if (f.art === 'ausdruck') ausdruck(wert, titel);
    else if (f.art === 'bedingung') bedingung(wert, titel);
    else if (f.art === 'spalten') spalten(wert, titel, 0);
    else if (f.art === 'zuordnung') {
      if (!objekt(wert)) melden(`Ergänze für „${titel}“ eine Zuordnung mit benannten Feldern.`);
    } else if (f.art === 'objekt') {
      if (!objekt(wert)) melden(`Prüfe die Angaben für „${titel}“.`);
      else
        f.felder?.forEach((unter) =>
          feld(unter, wert[unter.name], `${titel}: ${unter.titel}`, [...pfad, unter.name]),
        );
    } else if (f.art === 'liste') {
      liste(wert, titel, 0).forEach((eintrag, i) => {
        if (!objekt(eintrag)) melden(`Prüfe Eintrag ${i + 1} bei „${titel}“.`);
        else
          f.felder?.forEach((unter) =>
            feld(unter, eintrag[unter.name], `${titel} ${i + 1}: ${unter.titel}`, [
              ...pfad,
              String(i),
              unter.name,
            ]),
          );
      });
    }
  }
  // Varianten besitzen bewusst unterschiedliche Pflichtfelder. Ihre Listen werden
  // nach der fachlichen Art statt nach unbenutzten Formularfeldern geprüft.
  for (const f of def.felder)
    if (!['regeln', 'abschnitte', 'aggregate', 'formate'].includes(f.name)) feld(f, k[f.name]);
  const benoetigt = (name: string, titel: string, endung?: string) =>
    imFeld([name], () => pfad(k[name], titel, endung));
  const paarVerschieden = (a: string, b: string) => {
    if (typeof k[a] === 'string' && k[a] && k[a] === k[b])
      melden('Quelle, Ausgabe und Archiv müssen verschiedene Pfade verwenden.');
  };
  function eintraege(wert: unknown, titel: string, minimum = 1) {
    return liste(wert, titel, minimum).filter((w, i): w is Objekt => {
      if (!objekt(w)) {
        melden(`Prüfe Eintrag ${i + 1} bei „${titel}“.`);
        return false;
      }
      return true;
    });
  }
  function seiten(wert: unknown, titel: string, optional = false) {
    if (verweis(wert, titel) || (optional && !vorhanden(wert))) return;
    if (!text(wert, titel) || typeof wert !== 'string') return;
    const genutzt = new Set<number>();
    for (const teil of wert.split(',')) {
      const t = /^\s*([1-9][0-9]*)\s*(?:-\s*([1-9][0-9]*)\s*)?$/.exec(teil);
      const a = Number(t?.[1]),
        b = Number(t?.[2] ?? t?.[1]);
      if (!t || !Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a > b || b > 2000) {
        melden(`Gib für „${titel}“ Seiten ab 1 bis höchstens 2000 an, beispielsweise 1-3,5.`);
        return;
      }
      for (let s = a; s <= b; s++) {
        if (genutzt.has(s)) melden(`Eine Seite kommt bei „${titel}“ mehrfach vor.`);
        genutzt.add(s);
      }
    }
  }
  function zelladresse(wert: unknown, titel: string) {
    if (!text(wert, titel) || typeof wert !== 'string') return;
    const t = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(wert);
    const spalte = t?.[1].split('').reduce((sum, z) => sum * 26 + z.charCodeAt(0) - 64, 0) ?? 0;
    if (!t || spalte > 16384 || Number(t[2]) > 1048576)
      melden(`Gib für „${titel}“ eine Excel-Zelle zwischen A1 und XFD1048576 an.`);
  }
  function positionen(wert: unknown) {
    if (verweis(wert, 'Word-Positionstabelle')) return;
    if (!objekt(wert)) {
      melden('Wähle eine Word-Positionstabelle und Musterzeile aus.');
      return;
    }
    zahl(wert.tabelle ?? 0, 'Word-Tabellennummer', 0);
    zahl(wert.zeile ?? 1, 'Word-Musterzeile', 0);
    text(wert.praefix ?? 'Position', 'Positionspräfix');
  }
  if (op === 'daten.importieren' || op === 'daten.exportieren') {
    benoetigt('pfad', 'Dateipfad');
    const o = objekt(k.optionen) ? k.optionen : {};
    if (
      k.format === 'CSV' &&
      o.trennzeichen !== undefined &&
      !verweis(o.trennzeichen, 'Trennzeichen') &&
      (typeof o.trennzeichen !== 'string' || o.trennzeichen.length !== 1 || /[\r\n\0]/.test(o.trennzeichen))
    )
      melden('Wähle genau ein Zeichen als CSV-Trennzeichen.');
    if (k.format === 'XLSX') {
      if (typeof o.blatt === 'string' && (o.blatt.length > 31 || /[\\/*?:\[\]]/.test(o.blatt)))
        melden('Ein Excel-Blattname darf höchstens 31 Zeichen und keine Zeichen \\ / * ? : [ ] enthalten.');
      if (vorhanden(o.bereich) && !verweis(o.bereich, 'Excel-Zellbereich')) {
        const t =
          typeof o.bereich === 'string'
            ? /^\$?([A-Z]{1,3})\$?([1-9][0-9]*):\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/i.exec(o.bereich)
            : null;
        const sp = (s: string) =>
          s
            .toUpperCase()
            .split('')
            .reduce((n, z) => n * 26 + z.charCodeAt(0) - 64, 0);
        if (!t || sp(t[1]) > sp(t[3]) || +t[2] > +t[4] || sp(t[3]) > 16384 || +t[4] > 1048576)
          melden(
            'Wähle einen vollständigen Excel-Zellbereich innerhalb A1:XFD1048576, beispielsweise B2:D100.',
          );
      }
    }
  } else if (op === 'daten.spalten') {
    if (k.aktion === 'AUSWAEHLEN') spalten(k.spalten, 'Ausgewählte Spalten');
    else if (k.aktion === 'UMBENENNEN') {
      if (!objekt(k.namen) || !Object.keys(k.namen).length)
        melden('Ordne mindestens einer vorhandenen Spalte einen neuen Namen zu.');
      else {
        Object.entries(k.namen).forEach(([a, b]) => {
          text(a, 'Bisheriger Spaltenname');
          text(b, 'Neuer Spaltenname');
        });
        const namen = Object.values(k.namen)
          .filter((n): n is string => typeof n === 'string')
          .map((n) => n.toLocaleLowerCase('de'));
        if (new Set(namen).size !== namen.length) melden('Die neuen Spaltennamen müssen eindeutig sein.');
      }
    } else {
      text(k.spalte, 'Spaltenname');
      if (k.aktion === 'TYP' && k.tausendertrennzeichen && k.tausendertrennzeichen === k.dezimaltrennzeichen)
        melden('Dezimal- und Tausendertrennzeichen müssen verschieden sein.');
    }
  } else if (op === 'daten.werte') {
    spalten(k.spalten, 'Bearbeitete Spalten');
    if (k.aktion === 'ERSETZEN') {
      literal(k.suchen, 'Gesuchter Wert');
      literal(k.ersatz, 'Ersatzwert');
    }
    if (k.aktion === 'LEERWERTE' && k.leere === 'ERSETZEN') literal(k.ersatz, 'Ersatzwert');
  } else if (op === 'daten.dubletten') spalten(k.schluessel, 'Verglichene Spalten');
  else if (op === 'daten.sortieren')
    eintraege(k.schluessel, 'Sortierspalten').forEach((s) => text(s.spalte, 'Sortierspalte'));
  else if (op === 'daten.verknuepfen')
    eintraege(k.schluessel, 'Verknüpfungsschlüssel').forEach((s) => {
      text(s.links, 'Schlüssel der ersten Tabelle');
      text(s.rechts, 'Schlüssel der zweiten Tabelle');
    });
  else if (op === 'daten.gruppieren') {
    spalten(k.schluessel, 'Gruppenspalten', 0);
    const namen = Array.isArray(k.schluessel)
      ? k.schluessel.filter((s): s is string => typeof s === 'string').map((s) => s.toLocaleLowerCase('de'))
      : [];
    eintraege(k.aggregate, 'Berechnungen').forEach((a) => {
      wahl(a.funktion, aggregate, 'Zusammenfassung');
      text(a.name, 'Name der Ergebnisspalte');
      if (a.funktion !== 'ANZAHL') text(a.spalte, 'Wertspalte');
      if (typeof a.name === 'string') {
        const name = a.name.toLocaleLowerCase('de');
        if (namen.includes(name)) melden('Ergebnisspalten und Gruppenspalten müssen eindeutige Namen haben.');
        namen.push(name);
      }
    });
  } else if (op === 'daten.pruefen') {
    eintraege(k.regeln, 'Prüfregeln').forEach((r) => {
      wahl(r.art, ['NICHT_LEER', 'EINDEUTIG', 'BEREICH', 'TYP', 'ERLAUBTE_WERTE', 'ZEILENZAHL'], 'Prüfregel');
      if (r.art === 'EINDEUTIG') spalten(r.spalten ?? [r.spalte ?? ''], 'Eindeutige Schlüsselspalten');
      else if (r.art !== 'ZEILENZAHL') text(r.spalte, 'Geprüfte Spalte');
      if (r.art === 'TYP') typ(r.typ, 'Erwarteter Datentyp');
      if (r.art === 'ERLAUBTE_WERTE')
        liste(r.werte, 'Erlaubte Werte').forEach((w) => literal(w, 'Erlaubter Wert', false));
      if (r.art === 'BEREICH' || r.art === 'ZEILENZAHL') {
        if (!vorhanden(r.minimum) && !vorhanden(r.maximum)) melden('Gib mindestens eine Prüfgrenze an.');
        for (const name of ['minimum', 'maximum'])
          if (vorhanden(r[name])) {
            if (r.art === 'ZEILENZAHL')
              zahl(r[name], `Zeilenzahl: ${name === 'minimum' ? 'Minimum' : 'Maximum'}`, 0);
            else literal(r[name], 'Bereichsgrenze', false);
          }
        const min = objekt(r.minimum) ? r.minimum.wert : r.minimum,
          max = objekt(r.maximum) ? r.maximum.wert : r.maximum;
        if (typeof min === 'number' && typeof max === 'number' && min > max)
          melden('Das Minimum einer Prüfregel darf nicht größer als das Maximum sein.');
      }
    });
  } else if (op === 'daten.vorschau') zahl(k.limit, 'Angezeigte Zeilen', 1, 200);
  else if (op === 'dateien.stapel' || op === 'dateien.csv_stapel') {
    benoetigt('ordner', 'Eingangsordner');
    text(k.muster, 'Dateimuster');
    if (typeof k.muster === 'string' && /[\\/]/.test(k.muster))
      melden('Verwende ein einfaches Dateimuster ohne Unterordner, beispielsweise *.csv.');
    if (op === 'dateien.csv_stapel') {
      benoetigt('zielordner', 'Ausgabeordner');
      benoetigt('archivordner', 'Archivordner');
      paarVerschieden('ordner', 'zielordner');
      paarVerschieden('ordner', 'archivordner');
      paarVerschieden('zielordner', 'archivordner');
      if (
        !verweis(k.trennzeichen, 'Trennzeichen') &&
        (typeof k.trennzeichen !== 'string' || k.trennzeichen.length !== 1 || /[\r\n\0]/.test(k.trennzeichen))
      )
        melden('Wähle genau ein Zeichen als CSV-Trennzeichen.');
    }
  } else if (op === 'dateien.aktion') {
    benoetigt('ziel', 'Ziel', k.aktion === 'ZIP_ERSTELLEN' ? '.zip' : undefined);
    if (k.aktion !== 'ORDNER') benoetigt('quelle', 'Quelle');
    paarVerschieden('quelle', 'ziel');
  } else if (op === 'dateien.archivieren') {
    benoetigt('quelle', 'Verarbeitete Quelle');
    benoetigt('ziel', 'Archivziel');
    paarVerschieden('quelle', 'ziel');
  } else if (op === 'dateien.beleg_ablegen') {
    benoetigt('quelle', 'PDF-Beleg');
    benoetigt('zielordner', 'Ablageordner');
  } else if (op.startsWith('dokument.')) {
    if (['dokument.xlsx_vorlage', 'dokument.docx_vorlage', 'dokument.docx_serie'].includes(op))
      benoetigt('vorlage', 'Dokumentvorlage', op === 'dokument.xlsx_vorlage' ? '.xlsx' : '.docx');
    if (
      [
        'dokument.xlsx_vorlage',
        'dokument.docx_vorlage',
        'dokument.docx_erstellen',
        'dokument.pdf_bericht',
        'dokument.pdf_verbinden',
        'dokument.pdf_seiten',
      ].includes(op)
    )
      benoetigt(
        'ziel',
        'Ausgabedatei',
        op === 'dokument.xlsx_vorlage' ? '.xlsx' : op.includes('docx') ? '.docx' : '.pdf',
      );
    if (['dokument.pdf_seiten', 'dokument.pdf_teilen', 'dokument.pdf_text'].includes(op))
      benoetigt('quelle', 'PDF-Quelldatei');
    paarVerschieden('vorlage', 'ziel');
    paarVerschieden('quelle', 'ziel');
    if (op === 'dokument.xlsx_vorlage') {
      for (const name of ['zellen', 'formeln'])
        if (objekt(k[name]))
          Object.entries(k[name]).forEach(([adresse, wert]) => {
            zelladresse(adresse, 'Zelladresse');
            if (
              name === 'formeln' &&
              !verweis(wert, 'Excel-Formel') &&
              (typeof wert !== 'string' || !wert.startsWith('='))
            )
              melden('Eine bewusst geschriebene Excel-Formel muss mit = beginnen.');
          });
      if (
        objekt(k.zellen) &&
        objekt(k.formeln) &&
        Object.keys(k.zellen).some((a) => Object.hasOwn(k.formeln as Objekt, a))
      )
        melden('Ordne Zellwerte und Formeln unterschiedlichen Zellen zu.');
      if (k.formate !== undefined)
        eintraege(k.formate, 'Zellformate', 0).forEach((f) => {
          zelladresse(f.adresse, 'Format-Zelladresse');
          if (f.fett !== undefined && !verweis(f.fett, 'Fettschrift') && typeof f.fett !== 'boolean')
            melden('Die Einstellung Fett benötigt Ja oder Nein.');
          if (
            f.fuellung !== undefined &&
            !verweis(f.fuellung, 'Füllfarbe') &&
            (typeof f.fuellung !== 'string' || !/^[0-9a-f]{6}$/i.test(f.fuellung))
          )
            melden('Die Excel-Füllfarbe benötigt sechs Hexzeichen ohne #.');
          if (f.ausrichtung !== undefined)
            wahl(f.ausrichtung, ['links', 'mitte', 'rechts'], 'Zellausrichtung');
          if (f.zahlformat !== undefined) text(f.zahlformat, 'Zahlenformat');
        });
    }
    if (k.positionen !== undefined) positionen(k.positionen);
    if (op === 'dokument.docx_serie' || op === 'dokument.pdf_teilen') {
      benoetigt('zielordner', 'Ausgabeordner');
      const endung = op === 'dokument.docx_serie' ? '.docx' : '.pdf';
      pfad(k.dateiname, 'Dateinamensmuster', endung);
      if (typeof k.dateiname === 'string' && /[\\/:*?"<>|\r\n]/.test(k.dateiname))
        melden('Das Dateinamensmuster darf keinen Ordnerpfad oder ungültige Windows-Zeichen enthalten.');
    }
    if (op === 'dokument.docx_serie' && k.gruppe_nach !== undefined) {
      if (Array.isArray(k.gruppe_nach)) spalten(k.gruppe_nach, 'Gruppenspalten');
      else text(k.gruppe_nach, 'Gruppenspalte');
      if (k.positionen === undefined)
        melden('Wähle für die gruppierte Dokumentserie eine Positionstabelle aus.');
      if (objekt(k.summen))
        Object.entries(k.summen).forEach(([a, b]) => {
          text(a, 'Summenplatzhalter');
          text(b, 'Summenspalte');
        });
    }
    if (op === 'dokument.docx_erstellen') {
      eintraege(k.abschnitte, 'Dokumentinhalt', 0).forEach((a) => {
        wahl(a.art, ['ABSATZ', 'UEBERSCHRIFT', 'BILD'], 'Abschnittsart');
        if (a.art === 'BILD') {
          pfad(a.pfad, 'Bilddatei');
          zahl(a.breite_cm ?? 12, 'Bildbreite in cm', Number.MIN_VALUE, 20, false);
        } else if (a.art === 'ABSATZ' || a.art === 'UEBERSCHRIFT') {
          text(a.text, 'Abschnittstext');
          if (a.art === 'UEBERSCHRIFT') zahl(a.stufe ?? 1, 'Überschriftenebene', 0, 9);
          else text(a.stil, 'Word-Formatvorlage', false);
        }
      });
    }
    if (op === 'dokument.pdf_bericht') {
      if (k.schrift !== 'INTERN:VERA') pfad(k.schrift, 'TTF-Schriftdatei', '.ttf');
      if (k.rand_mm !== undefined) zahl(k.rand_mm, 'Seitenrand in mm', 5, 40, false);
    }
    if (op === 'dokument.pdf_seiten' || op === 'dokument.pdf_text')
      seiten(k.seiten, 'PDF-Seiten', op === 'dokument.pdf_text');
    if (op === 'dokument.pdf_teilen')
      liste(k.bereiche, 'PDF-Seitenbereiche').forEach((b, i) => seiten(b, `PDF-Seitenbereich ${i + 1}`));
  }
  return fehler;
}
