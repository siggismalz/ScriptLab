import { PythonGenerator, Order } from 'blockly/python';
import { projektPruefen, type Projekt } from './projekt';
import { workflowPruefen, type Ausdruck, type Anweisung } from './modell';
import type { GeneratorErgebnis, GeneratorOptionen, ZeilenZuordnung } from './generator';
import { pythonHelfer } from './python-helfer';

const pythonBasis = new PythonGenerator('ScriptLab-Python');
pythonBasis.INDENT = '    ';

/** Blockly kodiert Python-Literale; weitere Steuerzeichen und einzelne Surrogate bleiben Daten. */
export function pythonText(text: string): string {
  return (
    pythonBasis
      .quote_(text)
      // Blockly 13.4 verwendet bei LF eine physische Zeilenfortsetzung. Für einzeilige
      // Modell-Ausdrücke wird daraus vor der weiteren Kodierung die äquivalente Escape-Sequenz.
      .replace(/\\\n/g, '\\n')
      .replace(
        /[\u0000-\u001f\u007f\u2028\u2029\ud800-\udfff]/gu,
        (zeichen) => `\\u${zeichen.charCodeAt(0).toString(16).padStart(4, '0')}`,
      )
  );
}

export const pythonUnterstuetzteTypen = new Set([
  'sl_start',
  'sl_comment',
  'sl_end',
  'sl_if',
  'sl_compare',
  'sl_logic',
  'sl_not',
  'sl_exists',
  'sl_repeat',
  'sl_while',
  'sl_foreach',
  'sl_foreach_file',
  'sl_mkdir',
  'sl_copy',
  'sl_move',
  'sl_rename',
  'sl_list_files',
  'sl_basename',
  'sl_read_text',
  'sl_write_text',
  'sl_append_text',
  'sl_delete',
  'sl_set',
  'sl_get',
  'sl_text',
  'sl_number',
  'sl_bool',
  'sl_list',
  'sl_list_add',
  'sl_list_get',
  'sl_join',
  'sl_newline',
  'sl_replace',
  'sl_len',
  'sl_case',
  'sl_contains',
  'sl_math',
  'sl_round',
  'sl_random',
  'sl_output',
  'sl_message',
  'sl_input',
  'sl_question',
  'sl_log',
  'sl_date',
  'sl_time',
  'sl_date_format',
  'sl_sleep',
]);

function testTokenLesen(optionen: unknown): string | null {
  if (optionen === undefined) return null;
  if (
    !optionen ||
    typeof optionen !== 'object' ||
    Array.isArray(optionen) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(optionen)) ||
    !Object.hasOwn(optionen, 'modus')
  )
    throw new Error('Die Generatoroptionen sind ungültig.');
  const werte = optionen as Record<string, unknown>;
  if (werte.modus === 'export' && Object.keys(werte).every((name) => name === 'modus')) return null;
  if (
    werte.modus === 'test' &&
    Object.hasOwn(werte, 'token') &&
    Object.keys(werte).every((name) => name === 'modus' || name === 'token') &&
    typeof werte.token === 'string' &&
    /^[A-Za-z0-9_-]{32,128}$/.test(werte.token)
  )
    return werte.token;
  throw new Error('Der Generatormodus oder sein Testtoken ist ungültig.');
}

/** Direkte Übersetzung des gemeinsamen geprüften Modells. Der Generator führt keinen Pythoncode aus. */
export function pythonErzeugen(projekt: Projekt, optionen?: GeneratorOptionen): GeneratorErgebnis {
  let geprueft: Projekt;
  let token: string | null;
  try {
    token = testTokenLesen(optionen);
    geprueft = projektPruefen(projekt);
  } catch (fehler) {
    return {
      code: null,
      zeilenZuordnung: [],
      meldungen: [
        { stufe: 'fehler', text: fehler instanceof Error ? fehler.message : 'Das Projekt ist ungültig.' },
      ],
    };
  }
  if (geprueft.skriptsprache !== 'python')
    return {
      code: null,
      zeilenZuordnung: [],
      meldungen: [{ stufe: 'fehler', text: 'Dieses Projekt verwendet VBS. Verwende den VBS-Generator.' }],
    };
  const { workflow, meldungen } = workflowPruefen(geprueft);
  if (!workflow) return { code: null, meldungen, zeilenZuordnung: [] };
  const variablen = new Map(workflow.variablen.map((id, index) => [id, `v_${index + 1}`]));
  const helfer = new Set<string>();
  const importe = new Set(['import sys']);
  const zeilen: { text: string; ids: string[] }[] = [];
  let intern = 0;
  let fehlerId = workflow.startId;
  const neu = () => `sl_intern_${++intern}`;
  function hilfe(name: string, funktionsname: string): string {
    helfer.add(name);
    return funktionsname;
  }
  function variable(id: string): string {
    const name = variablen.get(id);
    if (!name) throw new Error('Die referenzierte Variable fehlt im Workflow.');
    return name;
  }
  function ausdruckIds(a: Ausdruck): string[] {
    return [a.id, ...Object.values(a.werte).flatMap(ausdruckIds)];
  }
  function wert(a: Ausdruck): string {
    fehlerId = a.id;
    const w = (name: string) => wert(a.werte[name]);
    let code: string;
    let rang = Order.ATOMIC;
    switch (a.art) {
      case 'sl_text':
        code = pythonText(a.felder.TEXT);
        break;
      case 'sl_number':
        code = a.felder.ZAHL;
        break;
      case 'sl_bool':
        code = a.felder.WERT === 'WAHR' ? 'True' : 'False';
        break;
      case 'sl_get':
        code = variable(a.felder.VAR);
        break;
      case 'sl_list':
        code = '[]';
        break;
      case 'sl_compare': {
        // VBS unterscheidet starke Literale von dynamischen Variant-Ausdrücken.
        // Die Information stammt aus dem gemeinsamen Modell, nicht aus geparstem VBS.
        const arten = [a.werte.A.art, a.werte.B.art];
        const modus = arten.some((art) => ['sl_number', 'sl_bool'].includes(art))
          ? 'zahl'
          : arten.some((art) => ['sl_text', 'sl_newline'].includes(art))
            ? 'text'
            : 'variant';
        code = `${hilfe('vergleich', 'sl_vergleichen')}(${w('A')}, ${w('B')}, ${pythonText(a.felder.OP)}, ${pythonText(modus)})`;
        break;
      }
      case 'sl_logic':
        code = `${hilfe('logik', 'sl_logik')}(${w('A')}, ${w('B')}, ${a.felder.OP === 'AND' ? 'True' : 'False'})`;
        break;
      case 'sl_not':
        code = `${hilfe('logik', 'sl_nicht')}(${w('WERT')})`;
        break;
      case 'sl_exists':
        code = `${hilfe('pfad', 'sl_vorhanden')}(${w('PFAD')}, ${a.felder.ART === 'ORDNER' ? 'True' : 'False'})`;
        break;
      case 'sl_list_files':
        code = `${hilfe('dateien', 'sl_dateien')}(${w('PFAD')})`;
        break;
      case 'sl_basename':
        code = `${hilfe('pfad', 'sl_dateiname')}(${w('PFAD')})`;
        break;
      case 'sl_read_text':
        code = `${hilfe('lesen', 'sl_lesen')}(${w('PFAD')}, ${pythonText(a.felder.KODIERUNG)})`;
        break;
      case 'sl_list_get':
        code = `${hilfe('eintrag', 'sl_eintrag')}(${w('LISTE')}, ${w('INDEX')})`;
        break;
      case 'sl_join':
        helfer.add('variante');
        code = `sl_text(${w('A')}) + sl_text(${w('B')})`;
        rang = Order.ADDITIVE;
        break;
      case 'sl_newline':
        code = pythonText('\r\n');
        break;
      case 'sl_replace':
        code = `${hilfe('text', 'sl_ersetzen')}(${w('TEXT')}, ${w('SUCHEN')}, ${w('ERSATZ')})`;
        break;
      case 'sl_len':
        code = `${hilfe('text', 'sl_laenge')}(${w('TEXT')})`;
        break;
      case 'sl_case':
        code = `${hilfe('text', 'sl_schreibweise')}(${w('TEXT')}, ${a.felder.ART === 'GROSS' ? 'True' : 'False'})`;
        break;
      case 'sl_contains':
        code = `${hilfe('text', 'sl_enthaelt')}(${w('TEXT')}, ${w('SUCHEN')})`;
        break;
      case 'sl_math':
        code = `${hilfe('rechnen', 'sl_rechnen')}(${w('A')}, ${w('B')}, ${pythonText(a.felder.OP)})`;
        break;
      case 'sl_round':
        code = `${hilfe('runden', 'sl_runden')}(${w('WERT')}, ${a.felder.STELLEN})`;
        break;
      case 'sl_random':
        code = `${hilfe('zufall', 'sl_zufall')}(${w('MIN')}, ${w('MAX')})`;
        break;
      case 'sl_input':
        code = `${hilfe('dialog', 'sl_dialog')}(${w('TEXT')}, 'EINGABE')`;
        break;
      case 'sl_question':
        code = `${hilfe('dialog', 'sl_dialog')}(${w('TEXT')}, 'FRAGE')`;
        break;
      case 'sl_date':
        code = `${hilfe('datum', 'sl_jetzt')}('DATUM')`;
        break;
      case 'sl_time':
        code = `${hilfe('datum', 'sl_jetzt')}('ZEIT')`;
        break;
      case 'sl_date_format':
        code = `${hilfe('datum', 'sl_datum')}(${w('WERT')}, ${pythonText(a.felder.FORMAT)})`;
        break;
      default:
        throw new Error('Für diesen Baustein fehlt der Python-Generator.');
    }
    // Die Klammerentscheidung benutzt die Rangfolgen der eingesetzten Blockly-Pythonversion.
    const ausdruck = rang > Order.ATOMIC ? `(${code})` : code;
    return `sl_wert(${pythonText(a.id)}, lambda: ${ausdruck})`;
  }
  function ausgeben(text: string, tiefe: number, ids: string[]): void {
    zeilen.push({ text: pythonBasis.prefixLines(text, pythonBasis.INDENT.repeat(tiefe)), ids });
  }
  function anweisungen(liste: Anweisung[], tiefe: number): void {
    if (!liste.length) {
      ausgeben('pass', tiefe, []);
      return;
    }
    for (const a of liste) {
      fehlerId = a.id;
      const ids = [a.id, ...Object.values(a.werte).flatMap(ausdruckIds)];
      const zeile = (text: string, extra = 0) => ausgeben(text, tiefe + extra, ids);
      const w = (name: string) => wert(a.werte[name]);
      zeile(`sl_block = ${pythonText(a.id)}`);
      switch (a.art) {
        case 'sl_comment':
          for (const zeileText of a.felder.TEXT.split(/\r\n|\r|\n|\u2028|\u2029/))
            zeile(`# ${zeileText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')}`);
          break;
        case 'sl_end':
          zeile('raise SystemExit(0)');
          break;
        case 'sl_message':
          zeile(`${hilfe('dialog', 'sl_dialog')}(${w('TEXT')}, 'NACHRICHT')`);
          break;
        case 'sl_output':
          helfer.add('variante');
          zeile(`sys.stdout.write(sl_text(${w('TEXT')}) + '\\r\\n')`);
          zeile('sys.stdout.flush()');
          break;
        case 'sl_set':
          helfer.add('liste');
          zeile(`${variable(a.felder.VAR)} = sl_kopie(${w('WERT')})`);
          break;
        case 'sl_if':
          zeile(`if ${hilfe('wahr', 'sl_wahr')}(${w('BEDINGUNG')}):`);
          anweisungen(a.zweige.DANN, tiefe + 1);
          zeile('else:');
          anweisungen(a.zweige.SONST, tiefe + 1);
          break;
        case 'sl_repeat':
          zeile(`for ${neu()} in range(${hilfe('anzahl', 'sl_anzahl')}(${w('ANZAHL')})):`);
          anweisungen(a.zweige.ABLAUF, tiefe + 1);
          break;
        case 'sl_while':
          zeile('while True:');
          zeile(`sl_block = ${pythonText(a.id)}`, 1);
          zeile(`if not ${hilfe('wahr', 'sl_wahr')}(${w('BEDINGUNG')}):`, 1);
          zeile('break', 2);
          anweisungen(a.zweige.ABLAUF, tiefe + 1);
          break;
        case 'sl_foreach':
        case 'sl_foreach_file': {
          const eintrag = neu();
          const liste =
            a.art === 'sl_foreach' ? w('LISTE') : `${hilfe('dateien', 'sl_dateien')}(${w('PFAD')})`;
          zeile(`for ${eintrag} in ${hilfe('liste', 'sl_liste')}(${liste}):`);
          zeile(`${variable(a.felder.VAR)} = sl_kopie(${eintrag})`, 1);
          anweisungen(a.zweige.ABLAUF, tiefe + 1);
          break;
        }
        case 'sl_mkdir':
          zeile(`${hilfe('ordner', 'sl_ordner')}(${w('PFAD')})`);
          break;
        case 'sl_copy':
        case 'sl_move':
          zeile(
            `${hilfe('kopieren', 'sl_kopieren')}(${w('QUELLE')}, ${w('ZIEL')}, ${a.felder.ZIELREGEL === 'ERSETZEN' ? 'True' : 'False'}, ${a.art === 'sl_move' ? 'True' : 'False'})`,
          );
          break;
        case 'sl_rename':
          zeile(`${hilfe('umbenennen', 'sl_umbenennen')}(${w('QUELLE')}, ${w('NAME')})`);
          break;
        case 'sl_write_text':
        case 'sl_append_text':
          zeile(
            `${hilfe('schreiben', 'sl_schreiben')}(${w('PFAD')}, ${w('TEXT')}, ${pythonText(a.felder.KODIERUNG)}, ${a.art === 'sl_append_text' ? 'True' : 'False'})`,
          );
          break;
        case 'sl_delete':
          if (a.felder.RUECKFRAGE === 'JA') helfer.add('dialog');
          zeile(
            `${hilfe('loeschen', 'sl_loeschen')}(${w('PFAD')}, ${a.felder.RUECKFRAGE === 'JA' ? 'True' : 'False'})`,
          );
          break;
        case 'sl_list_add':
          zeile(
            `${variable(a.felder.VAR)} = ${hilfe('liste', 'sl_anhaengen')}(${variable(a.felder.VAR)}, ${w('WERT')})`,
          );
          break;
        case 'sl_log':
          helfer.add('datum');
          helfer.add('variante');
          zeile(
            `${hilfe('schreiben', 'sl_schreiben')}(${w('PFAD')}, sl_datum(sl_jetzt('BEIDES'), 'BEIDES') + ' ' + sl_text(${w('TEXT')}) + '\\r\\n', 'UTF8', True)`,
          );
          break;
        case 'sl_sleep':
          zeile(`${hilfe('warten', 'sl_warten')}(${w('SEKUNDEN')})`);
          break;
        default:
          throw new Error('Für diesen Baustein fehlt der Python-Generator.');
      }
    }
  }
  try {
    anweisungen(workflow.anweisungen, 1);
  } catch (fehler) {
    return {
      code: null,
      zeilenZuordnung: [],
      meldungen: [
        ...meldungen,
        {
          stufe: 'fehler',
          blockId: fehlerId,
          text:
            fehler instanceof Error
              ? fehler.message
              : 'Der Workflow konnte nicht vollständig in Python übersetzt werden.',
        },
      ],
    };
  }
  if (variablen.size) helfer.add('variante');
  const reihenfolge: string[] = [];
  function aufnehmen(name: string): void {
    if (reihenfolge.includes(name)) return;
    const eintrag = pythonHelfer[name];
    if (!eintrag) throw new Error('Eine fest benötigte Pythonhilfe fehlt.');
    eintrag.braucht?.forEach(aufnehmen);
    eintrag.importe?.forEach((zeile) => importe.add(zeile));
    reihenfolge.push(name);
  }
  [...helfer].sort().forEach(aufnehmen);
  const mitDateien = reihenfolge.includes('pfad');
  if (mitDateien || token) importe.add('import os');
  if (token) {
    importe.add('import argparse');
    importe.add('import traceback');
    importe.add('import urllib.parse');
  }
  const codeZeilen: string[] = [];
  const zeilenZuordnung: ZeilenZuordnung[] = [];
  function hinzufuegen(text: string, ids: string[] = []): void {
    for (const zeile of text.split(/\r\n|\r|\n/)) {
      codeZeilen.push(zeile);
      for (const blockId of new Set(ids))
        zeilenZuordnung.push({ von: codeZeilen.length, bis: codeZeilen.length, blockId });
    }
  }
  hinzufuegen('# Erstellt mit ScriptLab. Entwickelt von Leon Stolz.');
  hinzufuegen('# Die Ausführung kann Dateien verändern.');
  hinzufuegen(
    token
      ? '# Testfassung: Relative Pfade verwenden den ausdrücklich übergebenen Basisordner.'
      : '# Relative Pfade verwenden den Speicherort dieser Pythondatei.',
  );
  hinzufuegen([...importe].sort().join('\n'));
  hinzufuegen('');
  hinzufuegen(`sl_block = ${pythonText(workflow.startId)}`, [workflow.startId]);
  if (mitDateien && !token) hinzufuegen('sl_basis = os.path.dirname(os.path.abspath(__file__))');
  hinzufuegen(`
def sl_wert(kennung, auswerten):
    global sl_block
    vorher = sl_block
    sl_block = kennung
    ergebnis = auswerten()
    sl_block = vorher
    return ergebnis
`);
  for (const name of reihenfolge) {
    hinzufuegen(pythonHelfer[name].code);
    hinzufuegen('');
  }
  hinzufuegen('def sl_haupt():');
  hinzufuegen('    global sl_block');
  for (const name of variablen.values()) hinzufuegen(`    ${name} = sl_leer`);
  for (const zeile of zeilen) hinzufuegen(zeile.text, zeile.ids);
  hinzufuegen('');
  hinzufuegen(`if __name__ == '__main__':
    try:
        for sl_strom in (sys.stdout, sys.stderr):
            if hasattr(sl_strom, 'reconfigure'):
                sl_strom.reconfigure(encoding='utf-8', errors='backslashreplace', newline='')`);
  if (token)
    hinzufuegen(
      `        sl_parser = argparse.ArgumentParser(description='Fest erzeugter ScriptLab-Testkontext')
        sl_parser.add_argument('--scriptlab-basis', required=True)
        sl_parser.add_argument('--scriptlab-token', required=True)
        sl_optionen = sl_parser.parse_args()
        if sl_optionen.scriptlab_token != ${pythonText(token)}:
            raise ValueError('Die Testfreigabe stimmt nicht überein.')
        if not os.path.isabs(sl_optionen.scriptlab_basis) or not os.path.isdir(sl_optionen.scriptlab_basis):
            raise ValueError('Der Test benötigt einen vorhandenen vollständigen Basisordnerpfad.')
        sl_basis = sl_optionen.scriptlab_basis`,
      [workflow.startId],
    );
  hinzufuegen('        sl_haupt()');
  hinzufuegen(`    except Exception as sl_fehler:
        sl_meldung = str(sl_fehler) if isinstance(sl_fehler, (ValueError, RuntimeError)) else 'Die Aktion konnte nicht abgeschlossen werden. Prüfe die technischen Fehlerangaben.'`);
  if (token)
    hinzufuegen(`        sys.stderr.write('SLFEHLER|${token}|' + urllib.parse.quote(sl_block, safe='') + '|' + urllib.parse.quote(sl_meldung, safe='', errors='backslashreplace') + '\\r\\n')
        sys.stderr.flush()
        traceback.print_exc(file=sys.stderr)`);
  else
    hinzufuegen(`        sys.stderr.write('Der Workflow wurde beendet. ' + sl_meldung + ' Baustein: ' + sl_block + '\\r\\n')
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, 'Der Workflow wurde beendet.\\r\\n' + sl_meldung + '\\r\\nBaustein: ' + sl_block, 'ScriptLab', 0x10)
        except Exception:
            pass`);
  hinzufuegen('        raise SystemExit(1)');
  return { code: codeZeilen.join('\r\n') + '\r\n', meldungen, zeilenZuordnung };
}
