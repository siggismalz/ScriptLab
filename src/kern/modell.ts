import { definitionNachTyp, type WertTyp } from './katalog';
import type { EditorBlock, Projekt } from './projekt';

export interface Meldung { blockId?: string; text: string; stufe: 'fehler' | 'hinweis' }
export interface Ausdruck { id: string; art: string; typ: WertTyp; felder: Record<string, string>; werte: Record<string, Ausdruck> }
export interface Anweisung { id: string; art: string; felder: Record<string, string>; werte: Record<string, Ausdruck>; zweige: Record<string, Anweisung[]> }
export interface Workflow { anweisungen: Anweisung[]; variablen: string[] }
export function variablenSchluessel(name: string): string { return name.trim().normalize('NFC').toLocaleLowerCase('de-DE'); }

export function workflowPruefen(projekt: Projekt): { workflow: Workflow | null; meldungen: Meldung[] } {
  const meldungen: Meldung[] = []; const alle: EditorBlock[] = []; const genutzt = new Set<string>(); const variablen = new Set<string>(); const referenzen: { name: string; blockId: string }[] = [];
  const fehler = (block: EditorBlock, text: string): void => { meldungen.push({ blockId: block.id, text, stufe: 'fehler' }); };
  const aktiv = (b: EditorBlock): boolean => b.enabled !== false && !(b.disabledReasons?.length);
  const sammeln = (b: EditorBlock): void => { alle.push(b); for (const eingang of Object.values(b.inputs ?? {})) { if (eingang.block) sammeln(eingang.block); else if (eingang.shadow) sammeln(eingang.shadow); } if (b.next) sammeln(b.next.block); };
  const wurzeln = projekt.editor.blocks?.blocks ?? []; wurzeln.forEach(sammeln);
  for (const block of alle) if (!definitionNachTyp.has(block.type)) fehler(block, 'Dieser Bausteintyp wird von ScriptLab nicht unterstützt.');
  const starts = alle.filter(b => b.type === 'sl_start' && aktiv(b));
  if (starts.length !== 1) meldungen.push({ text: 'Ein Workflow benötigt genau einen aktiven Startbaustein.', stufe: 'fehler', ...(starts[0] ? { blockId: starts[0].id } : {}) });
  if (starts[0] && !wurzeln.includes(starts[0])) fehler(starts[0], 'Der Startbaustein muss frei am Anfang des Hauptablaufs stehen.');

  function felderLesen(b: EditorBlock): Record<string, string> {
    const def = definitionNachTyp.get(b.type); const felder: Record<string, string> = {};
    if (!def) return felder;
    for (const key of Object.keys(b.fields ?? {})) if (!def.felder.some(f => f.name === key)) fehler(b, 'Der Baustein enthält ein unbekanntes Eingabefeld.');
    for (const f of def.felder) {
      const roh = b.fields?.[f.name] ?? f.standard;
      if (!['string', 'number'].includes(typeof roh)) { fehler(b, 'Ein Eingabefeld hat einen ungültigen Wert.'); continue; }
      const wert = String(roh); felder[f.name] = wert;
      if (f.art === 'auswahl' && !f.optionen?.some(o => o[1] === wert)) fehler(b, 'Eine Auswahl im Baustein ist ungültig.');
      if (f.art === 'zahl' && (!Number.isInteger(Number(wert)) || Number(wert) < (f.min ?? -Infinity) || Number(wert) > (f.max ?? Infinity))) fehler(b, 'Die eingegebene Zahl liegt außerhalb des erlaubten Bereichs.');
      if (f.name === 'VAR') {
        if (!wert.trim() || wert.trim().length > 160 || /[\r\n\t]/.test(wert)) fehler(b, 'Bitte einen Variablennamen mit höchstens 160 Zeichen ohne Zeilenumbrüche angeben.');
        const name = variablenSchluessel(wert);
        if (['sl_set', 'sl_foreach', 'sl_foreach_file'].includes(b.type)) variablen.add(name); else referenzen.push({ name, blockId: b.id });
      }
    }
    if (b.type === 'sl_number') {
      const roh = felder.ZAHL.trim(); const zahl = Number(roh.replace(',', '.'));
      if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(roh) || !Number.isFinite(zahl) || Math.abs(zahl) > 1e15) fehler(b, 'Bitte eine gültige Zahl ohne Tausendertrennzeichen zwischen −10¹⁵ und 10¹⁵ eingeben.');
      else felder.ZAHL = String(zahl);
    }
    return felder;
  }
  function eingabenLesen(b: EditorBlock): { werte: Record<string, Ausdruck>; zweige: Record<string, Anweisung[]> } {
    const werte: Record<string, Ausdruck> = {}; const zweige: Record<string, Anweisung[]> = {}; const def = definitionNachTyp.get(b.type);
    if (!def) return { werte, zweige };
    for (const name of Object.keys(b.inputs ?? {})) if (!def.eingaben.some(e => e.name === name)) fehler(b, 'Der Baustein enthält eine unbekannte Verbindung.');
    for (const e of def.eingaben) {
      const anschluss = b.inputs?.[e.name]; const kind = anschluss?.block ?? anschluss?.shadow;
      if (e.typ === 'Statement') { zweige[e.name] = anweisungenLesen(kind); continue; }
      if (!kind || !aktiv(kind)) { if (!e.optional) fehler(b, `Bitte den Eingang „${e.name.toLocaleLowerCase('de-DE')}“ mit einem passenden Wert verbinden.`); continue; }
      const wert = ausdruckLesen(kind); if (!wert) continue;
      if (e.typ !== 'Any' && wert.typ !== 'Any' && wert.typ !== e.typ) fehler(kind, 'Dieser Wert hat nicht den passenden Typ für die Verbindung.');
      werte[e.name] = wert;
    }
    return { werte, zweige };
  }
  function ausdruckLesen(b: EditorBlock): Ausdruck | null {
    genutzt.add(b.id); const def = definitionNachTyp.get(b.type);
    if (!def || def.form !== 'wert') { fehler(b, 'An dieser Stelle wird ein Wert oder eine Bedingung benötigt.'); return null; }
    if (b.next) fehler(b, 'Ein Wertbaustein darf keinen nachfolgenden Anweisungsbaustein besitzen.');
    const felder = felderLesen(b); const { werte } = eingabenLesen(b);
    if (['sl_exists', 'sl_list_files', 'sl_basename', 'sl_read_text'].includes(b.type)) pfadPruefen(b, werte.PFAD);
    if (b.type === 'sl_replace' && werte.SUCHEN?.art === 'sl_text' && !werte.SUCHEN.felder.TEXT) fehler(b, 'Der zu ersetzende Suchtext darf nicht leer sein.');
    return { id: b.id, art: b.type, typ: def.ausgabe ?? 'Any', felder, werte };
  }
  function pfadPruefen(b: EditorBlock, wert?: Ausdruck): void {
    if (wert?.art === 'sl_text') {
      const pfad = wert.felder.TEXT;
      if (!pfad.trim() || /[\r\n*?]/.test(pfad)) fehler(b, 'Bitte einen Dateipfad ohne Platzhalter oder Zeilenumbrüche angeben.');
    }
  }
  function anweisungenLesen(anfang?: EditorBlock): Anweisung[] {
    const ausgabe: Anweisung[] = []; let b = anfang;
    while (b) {
      genutzt.add(b.id); const naechster = b.next?.block;
      if (!aktiv(b)) { b = naechster; continue; }
      const def = definitionNachTyp.get(b.type);
      if (!def || !['anweisung', 'ende'].includes(def.form)) { fehler(b, 'In einem Ablauf dürfen nur Anweisungsbausteine verbunden sein.'); break; }
      const felder = felderLesen(b); const { werte, zweige } = eingabenLesen(b);
      for (const name of ['PFAD', 'QUELLE', 'ZIEL']) if (werte[name]) pfadPruefen(b, werte[name]);
      if (b.type === 'sl_repeat' && werte.ANZAHL?.art === 'sl_number') { const anzahl = Number(werte.ANZAHL.felder.ZAHL); if (!Number.isInteger(anzahl) || anzahl < 0 || anzahl > 1e6) fehler(b, 'Die Wiederholungsanzahl muss eine ganze Zahl zwischen 0 und 1.000.000 sein.'); }
      if (b.type === 'sl_sleep' && werte.SEKUNDEN?.art === 'sl_number') { const sekunden = Number(werte.SEKUNDEN.felder.ZAHL); if (sekunden < 0 || sekunden > 86400) fehler(b, 'Die Wartezeit muss zwischen 0 und 86.400 Sekunden liegen.'); }
      if (b.type === 'sl_rename' && werte.NAME?.art === 'sl_text' && (!werte.NAME.felder.TEXT.trim() || /[\\/:*?"<>|\r\n]/.test(werte.NAME.felder.TEXT) || ['.', '..'].includes(werte.NAME.felder.TEXT))) fehler(b, 'Der neue Dateiname darf keinen Pfad oder ungültige Windows-Zeichen enthalten.');
      ausgabe.push({ id: b.id, art: b.type, felder, werte, zweige });
      if (def.form === 'ende' && naechster) fehler(naechster, 'Nach „Workflow beenden“ darf kein weiterer Baustein verbunden sein.');
      b = naechster;
    }
    return ausgabe;
  }
  const start = starts[0]; let anweisungen: Anweisung[] = [];
  if (start) {
    genutzt.add(start.id); felderLesen(start); if (Object.keys(start.inputs ?? {}).length) fehler(start, 'Der Startbaustein darf keine Eingänge besitzen.');
    anweisungen = anweisungenLesen(start.next?.block);
    if (!anweisungen.length) fehler(start, 'Verbinde mindestens eine Anweisung mit dem Startbaustein.');
  }
  function unerreichtePruefen(b: EditorBlock, deaktivierterZweig = false, istWurzel = false): void {
    if (!deaktivierterZweig && aktiv(b) && !genutzt.has(b.id)) {
      const def = definitionNachTyp.get(b.type);
      if (def && def.form !== 'wert') fehler(b, 'Dieser aktive Anweisungsbaustein ist nicht mit dem Startablauf verbunden.');
      else if (istWurzel) meldungen.push({ blockId: b.id, text: 'Dieser unverbundene Wert wird nicht verwendet.', stufe: 'hinweis' });
    }
    for (const eingang of Object.values(b.inputs ?? {})) {
      const kind = eingang.block ?? eingang.shadow;
      if (kind) unerreichtePruefen(kind, deaktivierterZweig || !aktiv(b));
    }
    // Ein deaktivierter Baustein deaktiviert seinen nächsten Nachbarn nicht.
    if (b.next) unerreichtePruefen(b.next.block, deaktivierterZweig);
  }
  wurzeln.forEach(b => unerreichtePruefen(b, false, true));
  for (const r of referenzen) if (!variablen.has(r.name)) meldungen.push({ blockId: r.blockId, text: 'Diese Variable wird im verbundenen Ablauf nicht angelegt. Nutze zuerst „Variable anlegen / setzen“.', stufe: 'fehler' });
  // Nur in beiden Bedingungszweigen gesetzte Werte gelten danach als sicher gesetzt.
  // Schleifen können kein einziges Mal laufen. Ihre Zuweisungen sind danach nicht sicher.
  function zuweisungenPruefen(liste: Anweisung[], anfang: Set<string>): Set<string> {
    let gesetzt = new Set(anfang);
    function lesen(a: Ausdruck): void {
      if (a.art === 'sl_get' && variablen.has(variablenSchluessel(a.felder.VAR)) && !gesetzt.has(variablenSchluessel(a.felder.VAR))) meldungen.push({ blockId: a.id, text: 'Diese Variable wird hier möglicherweise vor ihrer ersten Zuweisung gelesen. Setze sie vor der Verwendung.', stufe: 'hinweis' });
      Object.values(a.werte).forEach(lesen);
    }
    for (const a of liste) {
      Object.values(a.werte).forEach(lesen);
      if (a.art === 'sl_list_add' && !gesetzt.has(variablenSchluessel(a.felder.VAR))) meldungen.push({ blockId: a.id, text: 'Die Liste wird hier möglicherweise vor dem Anlegen verwendet.', stufe: 'hinweis' });
      if (a.art === 'sl_set') gesetzt.add(variablenSchluessel(a.felder.VAR));
      if (a.art === 'sl_if') {
        const dann = zuweisungenPruefen(a.zweige.DANN, gesetzt); const sonst = zuweisungenPruefen(a.zweige.SONST, gesetzt);
        gesetzt = new Set([...dann].filter(name => sonst.has(name)));
      } else {
        for (const zweig of Object.values(a.zweige)) {
          const imZweig = new Set(gesetzt);
          if (a.art === 'sl_foreach' || a.art === 'sl_foreach_file') imZweig.add(variablenSchluessel(a.felder.VAR));
          zuweisungenPruefen(zweig, imZweig);
        }
      }
    }
    return gesetzt;
  }
  zuweisungenPruefen(anweisungen, new Set());
  return { workflow: meldungen.some(m => m.stufe === 'fehler') ? null : { anweisungen, variablen: [...variablen].sort() }, meldungen };
}
