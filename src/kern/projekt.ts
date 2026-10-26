import { definitionNachTyp } from './katalog';
import { sprachePruefen, type Skriptsprache } from './sprachen';

/** Das Projekt speichert ausschließlich Daten. Es enthält niemals ausführbaren Anwendungscode. */
export interface EditorBlock {
  type: string;
  id: string;
  x?: number;
  y?: number;
  fields?: Record<string, string | number | boolean | { id: string }>;
  inputs?: Record<string, { block?: EditorBlock; shadow?: EditorBlock }>;
  next?: { block: EditorBlock };
  enabled?: boolean;
  disabledReasons?: string[];
  collapsed?: boolean;
  deletable?: boolean;
  movable?: boolean;
  editable?: boolean;
  inline?: boolean;
  data?: string;
  icons?: Record<string, unknown>;
}

export interface Projekt {
  schemaVersion: 2;
  skriptsprache: Skriptsprache;
  appVersion: string;
  projektKennung?: string;
  name: string;
  beschreibung: string;
  editor: {
    blocks?: { languageVersion: number; blocks: EditorBlock[] };
    variables?: { name: string; id: string; type?: string }[];
    workspaceComments?: {
      id: string;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      collapsed?: boolean;
      editable?: boolean;
      movable?: boolean;
      deletable?: boolean;
    }[];
  };
  ansicht: { zoom: number; x: number; y: number };
  exportOptionen: { signieren: boolean; zertifikatFingerabdruck: string; zeitstempelUrl: string };
}

const objekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === 'object' && wert !== null && !Array.isArray(wert);
const text = (wert: unknown, maximum: number): wert is string =>
  typeof wert === 'string' && wert.length <= maximum && !wert.includes('\u0000');
const zahl = (wert: unknown): wert is number => typeof wert === 'number' && Number.isFinite(wert);
const kennung = (wert: unknown): wert is string =>
  text(wert, 160) &&
  !!wert &&
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(wert);

export function projektPruefen(wert: unknown): Projekt {
  const fehler = (meldung: string): never => {
    throw new Error(meldung);
  };
  if (!objekt(wert)) return fehler('Die Projektdatei enthält kein gültiges Projekt.');
  if (wert.schemaVersion !== 1 && wert.schemaVersion !== 2)
    return fehler(
      typeof wert.schemaVersion === 'number' && wert.schemaVersion > 2
        ? 'Dieses Projekt wurde mit einem neueren Dateiformat gespeichert. Bitte ScriptLab aktualisieren.'
        : 'Die Schemaversion der Projektdatei wird nicht unterstützt.',
    );
  if (
    Object.keys(wert).some(
      (k) =>
        ![
          'schemaVersion',
          'skriptsprache',
          'appVersion',
          'projektKennung',
          'name',
          'beschreibung',
          'editor',
          'ansicht',
          'exportOptionen',
        ].includes(k),
    )
  )
    return fehler('Die Projektdatei enthält nicht unterstützte Zusatzdaten.');
  if (wert.schemaVersion === 2 && !Object.hasOwn(wert, 'skriptsprache'))
    return fehler('Im Projekt fehlt die Scriptsprache. Die Datei wird nicht verändert.');
  const skriptsprache = Object.hasOwn(wert, 'skriptsprache') ? sprachePruefen(wert.skriptsprache) : 'vbs';
  if (wert.schemaVersion === 1 && skriptsprache !== 'vbs')
    return fehler('Python-Projekte benötigen das Projektformat 2. Die Datei wird nicht verändert.');
  if (
    wert.projektKennung !== undefined &&
    (typeof wert.projektKennung !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(wert.projektKennung))
  )
    return fehler('Die Projektkennung ist ungültig.');
  if (
    !text(wert.appVersion, 80) ||
    !text(wert.name, 160) ||
    !wert.name.trim() ||
    !text(wert.beschreibung, 10000)
  )
    return fehler('Projektname, Beschreibung oder App-Version sind ungültig.');
  if (
    !objekt(wert.ansicht) ||
    !zahl(wert.ansicht.zoom) ||
    wert.ansicht.zoom < 0.2 ||
    wert.ansicht.zoom > 3 ||
    !zahl(wert.ansicht.x) ||
    !zahl(wert.ansicht.y) ||
    Math.abs(wert.ansicht.x) > 1e7 ||
    Math.abs(wert.ansicht.y) > 1e7
  )
    return fehler('Die gespeicherte Editoransicht ist ungültig.');
  if (
    !objekt(wert.exportOptionen) ||
    typeof wert.exportOptionen.signieren !== 'boolean' ||
    !text(wert.exportOptionen.zertifikatFingerabdruck, 128) ||
    !text(wert.exportOptionen.zeitstempelUrl, 2048)
  )
    return fehler('Die Exportoptionen sind ungültig.');
  if (
    Object.keys(wert.exportOptionen).some(
      (k) => !['signieren', 'zertifikatFingerabdruck', 'zeitstempelUrl'].includes(k),
    ) ||
    Object.keys(wert.ansicht).some((k) => !['zoom', 'x', 'y'].includes(k))
  )
    return fehler('Die Projektoptionen enthalten nicht unterstützte Zusatzdaten.');
  if (
    wert.exportOptionen.zertifikatFingerabdruck &&
    !/^[a-fA-F0-9]{40,64}$/.test(wert.exportOptionen.zertifikatFingerabdruck)
  )
    return fehler('Der Zertifikat-Fingerabdruck ist ungültig.');
  if (wert.exportOptionen.zeitstempelUrl) {
    try {
      const url = new URL(wert.exportOptionen.zeitstempelUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
        return fehler('Die Zeitstempeladresse muss eine HTTP- oder HTTPS-Adresse ohne Zugangsdaten sein.');
    } catch {
      return fehler('Die Zeitstempeladresse ist ungültig.');
    }
  }
  if (
    !objekt(wert.editor) ||
    Object.keys(wert.editor).some((s) => !['blocks', 'variables', 'workspaceComments'].includes(s))
  )
    return fehler('Der gespeicherte Editorzustand ist ungültig.');
  const ids = new Set<string>();
  let anzahl = 0;
  const blockPruefen = (block: unknown, tiefe: number): void => {
    if (++anzahl > 2000 || tiefe > 150)
      return fehler('Das Projekt enthält zu viele oder zu tief verschachtelte Bausteine.');
    if (!objekt(block) || !text(block.type, 80) || !/^sl_[a-z_]+$/.test(block.type) || !kennung(block.id))
      return fehler('Ein Baustein hat einen ungültigen Typ oder keine stabile Kennung.');
    if (!definitionNachTyp.has(block.type))
      return fehler(
        'Das Projekt enthält einen nicht unterstützten Bausteintyp. Die Datei wird nicht verändert.',
      );
    if (ids.has(block.id)) return fehler('Die Projektdatei enthält doppelte Baustein-Kennungen.');
    ids.add(block.id);
    const erlaubt = [
      'type',
      'id',
      'x',
      'y',
      'fields',
      'inputs',
      'next',
      'enabled',
      'disabledReasons',
      'collapsed',
      'deletable',
      'movable',
      'editable',
      'inline',
      'data',
      'icons',
    ];
    if (Object.keys(block).some((s) => !erlaubt.includes(s)))
      return fehler('Ein Baustein enthält nicht unterstützte Zusatzdaten.');
    for (const feld of ['x', 'y'])
      if (block[feld] !== undefined && (!zahl(block[feld]) || Math.abs(block[feld] as number) > 1e7))
        return fehler('Eine Bausteinposition ist ungültig.');
    for (const feld of ['enabled', 'collapsed', 'deletable', 'movable', 'editable', 'inline'])
      if (block[feld] !== undefined && typeof block[feld] !== 'boolean')
        return fehler('Eine Bausteineinstellung ist ungültig.');
    if (
      block.disabledReasons !== undefined &&
      (!Array.isArray(block.disabledReasons) ||
        block.disabledReasons.length > 20 ||
        block.disabledReasons.some((s) => !text(s, 200)))
    )
      return fehler('Die Deaktivierungsangaben sind ungültig.');
    if (block.data !== undefined && !text(block.data, 10000))
      return fehler('Bausteindaten sind zu lang oder ungültig.');
    if (
      block.fields !== undefined &&
      (!objekt(block.fields) ||
        Object.keys(block.fields).length > 30 ||
        Object.entries(block.fields).some(
          ([k, v]) =>
            !/^[A-Z_]+$/.test(k) ||
            !(
              text(v, 32768) ||
              zahl(v) ||
              typeof v === 'boolean' ||
              (k === 'VAR' && objekt(v) && Object.keys(v).length === 1 && kennung(v.id))
            ),
        ))
    )
      return fehler('Ein Bausteinfeld ist ungültig.');
    if (block.icons !== undefined) {
      if (!objekt(block.icons) || Object.keys(block.icons).some((k) => k !== 'comment'))
        return fehler('Nicht unterstützte Bausteinsymbole.');
      const kommentar = block.icons.comment;
      if (
        kommentar !== undefined &&
        (!objekt(kommentar) ||
          !text(kommentar.text, 10000) ||
          Object.keys(kommentar).some((k) => !['text', 'pinned', 'height', 'width'].includes(k)) ||
          (kommentar.pinned !== undefined && typeof kommentar.pinned !== 'boolean') ||
          (kommentar.height !== undefined &&
            (!zahl(kommentar.height) || kommentar.height < 0 || kommentar.height > 10000)) ||
          (kommentar.width !== undefined &&
            (!zahl(kommentar.width) || kommentar.width < 0 || kommentar.width > 10000)))
      )
        return fehler('Ein Bausteinkommentar ist ungültig.');
    }
    if (block.inputs !== undefined) {
      if (!objekt(block.inputs) || Object.keys(block.inputs).length > 20)
        return fehler('Bausteinverbindungen sind ungültig.');
      for (const [name, eingang] of Object.entries(block.inputs)) {
        if (
          !/^[A-Z_]+$/.test(name) ||
          !objekt(eingang) ||
          Object.keys(eingang).some((k) => !['block', 'shadow'].includes(k))
        )
          return fehler('Eine Bausteinverbindung ist ungültig.');
        if (eingang.block !== undefined) blockPruefen(eingang.block, tiefe + 1);
        if (eingang.shadow !== undefined) blockPruefen(eingang.shadow, tiefe + 1);
      }
    }
    if (block.next !== undefined) {
      if (!objekt(block.next) || Object.keys(block.next).some((k) => k !== 'block') || !block.next.block)
        return fehler('Die Verbindung zum nächsten Baustein ist ungültig.');
      blockPruefen(block.next.block, tiefe + 1);
    }
  };
  if (wert.editor.blocks !== undefined) {
    if (
      !objekt(wert.editor.blocks) ||
      wert.editor.blocks.languageVersion !== 0 ||
      !Array.isArray(wert.editor.blocks.blocks) ||
      Object.keys(wert.editor.blocks).some((k) => !['languageVersion', 'blocks'].includes(k))
    )
      return fehler('Die Bausteinliste ist ungültig.');
    for (const block of wert.editor.blocks.blocks) blockPruefen(block, 0);
  }
  if (
    wert.editor.variables !== undefined &&
    (!Array.isArray(wert.editor.variables) ||
      wert.editor.variables.length > 500 ||
      wert.editor.variables.some(
        (v) =>
          !objekt(v) ||
          !text(v.name, 160) ||
          !kennung(v.id) ||
          (v.type !== undefined && !text(v.type, 80)) ||
          Object.keys(v).some((k) => !['name', 'id', 'type'].includes(k)),
      ))
  )
    return fehler('Die Variablenliste ist ungültig.');
  if (wert.editor.workspaceComments !== undefined) {
    if (!Array.isArray(wert.editor.workspaceComments) || wert.editor.workspaceComments.length > 500)
      return fehler('Die Arbeitsbereichskommentare sind ungültig.');
    for (const kommentar of wert.editor.workspaceComments) {
      if (
        !objekt(kommentar) ||
        !kennung(kommentar.id) ||
        ids.has(kommentar.id) ||
        (kommentar.text !== undefined && !text(kommentar.text, 10000)) ||
        Object.keys(kommentar).some(
          (k) =>
            ![
              'id',
              'text',
              'x',
              'y',
              'width',
              'height',
              'collapsed',
              'editable',
              'movable',
              'deletable',
            ].includes(k),
        )
      )
        return fehler('Ein Arbeitsbereichskommentar ist ungültig.');
      ids.add(kommentar.id);
      for (const k of ['x', 'y', 'width', 'height'])
        if (
          kommentar[k] !== undefined &&
          (!zahl(kommentar[k]) ||
            Math.abs(kommentar[k] as number) > (['width', 'height'].includes(k) ? 10000 : 1e7))
        )
          return fehler('Die Größe oder Position eines Kommentars ist ungültig.');
      for (const k of ['collapsed', 'editable', 'movable', 'deletable'])
        if (kommentar[k] !== undefined && typeof kommentar[k] !== 'boolean')
          return fehler('Eine Kommentareinstellung ist ungültig.');
    }
  }
  // Kopieren entfernt geteilte Referenzen und verhindert spätere Änderungen am geprüften Objekt.
  const projekt = { ...JSON.parse(JSON.stringify(wert)), schemaVersion: 2, skriptsprache } as Projekt;
  variablenIdentitaetenErgaenzen(projekt);
  return projekt;
}

/** Alte Namensfelder werden einmalig auf die stabilen Blockly-Variablenkennungen abgebildet. */
function variablenIdentitaetenErgaenzen(projekt: Projekt): void {
  const variablen = projekt.editor.variables ?? [];
  const nachId = new Map(variablen.map((v) => [v.id, v]));
  if (nachId.size !== variablen.length) throw new Error('Die Variablenliste enthält doppelte Kennungen.');
  const schluessel = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase('de-DE');
  const bloecke: EditorBlock[] = [];
  const sammeln = (b: EditorBlock): void => {
    if (definitionNachTyp.get(b.type)?.felder.some((f) => f.name === 'VAR')) bloecke.push(b);
    for (const eingang of Object.values(b.inputs ?? {})) {
      if (eingang.block) sammeln(eingang.block);
      if (eingang.shadow) sammeln(eingang.shadow);
    }
    if (b.next) sammeln(b.next.block);
  };
  projekt.editor.blocks?.blocks.forEach(sammeln);
  const alteNamen = [
    ...new Set(
      bloecke.flatMap((b) => {
        const wert =
          b.fields?.VAR ?? definitionNachTyp.get(b.type)!.felder.find((f) => f.name === 'VAR')!.standard;
        return typeof wert === 'string' && wert.trim() && !nachId.has(wert) ? [schluessel(wert)] : [];
      }),
    ),
  ].sort();
  let nummer = 0;
  for (const name of alteNamen) {
    if (variablen.some((v) => schluessel(v.name) === name)) continue;
    let id: string;
    do {
      id = `sl_variable_${++nummer}`;
    } while (nachId.has(id));
    const block = bloecke.find((b) => typeof b.fields?.VAR === 'string' && schluessel(b.fields.VAR) === name);
    const roh = block?.fields?.VAR ?? name;
    const variable = { name: String(roh).trim(), id };
    variablen.push(variable);
    nachId.set(id, variable);
  }
  for (const block of bloecke) {
    const wert =
      block.fields?.VAR ?? definitionNachTyp.get(block.type)!.felder.find((f) => f.name === 'VAR')!.standard;
    if (typeof wert === 'object') {
      if (!nachId.has(wert.id)) throw new Error('Ein Baustein verweist auf eine unbekannte Variable.');
      continue;
    }
    if (typeof wert !== 'string' || !wert.trim()) continue; // Unvollständige Entwürfe bleiben prüfbar.
    const variable = nachId.get(wert) ?? variablen.find((v) => schluessel(v.name) === schluessel(wert));
    if (!variable) throw new Error('Eine Variable konnte nicht zugeordnet werden.');
    block.fields = { ...block.fields, VAR: { id: variable.id } };
  }
  if (variablen.length) projekt.editor.variables = variablen;
}

export function neuesProjekt(skriptsprache: Skriptsprache = 'vbs'): Projekt {
  sprachePruefen(skriptsprache);
  return {
    schemaVersion: 2,
    skriptsprache,
    appVersion: '0.1.0',
    projektKennung: globalThis.crypto.randomUUID(),
    name: 'Mein Workflow',
    beschreibung: '',
    editor: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'sl_start',
            id: 'start',
            x: 80,
            y: 96,
          },
        ],
      },
    },
    ansicht: { zoom: 1, x: 0, y: 0 },
    exportOptionen: { signieren: false, zertifikatFingerabdruck: '', zeitstempelUrl: '' },
  };
}
