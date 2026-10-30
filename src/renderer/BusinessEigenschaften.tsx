import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useId,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from 'react';
import * as Blockly from 'blockly/core';
import { BlockDatenEreignis } from '../editor/parameterEreignis';
import {
  businessDatenLesen,
  businessNachTyp,
  businessEingabeTitel,
  type KonfigFeld,
} from '../kern/business-katalog';
import { parameterWertLesen, type JsonWert, type WorkflowParameter } from '../kern/business-modell';
import { businessQuellenVorBlock } from '../editor/businessQuellen';
import { istQuellenfeld } from '../kern/quellenfeld';
import { Knopf } from './komponenten/Knopf';
import { Feld, Auswahlfeld } from './komponenten/Feld';
import { ParameterWertEingabe, parameterWertAusText } from './ParameterDialog';
import {
  ausdruckArtSetzen,
  bedingungsGruppeSetzen,
  bedingungAufloesen,
  literalTypSetzen,
  neuerVergleich,
  pruefregelArtSetzen,
  pruefregelSpaltenSetzen,
  pruefregelZusammenfassung,
} from './business-regeln';
import { ZuordnungsFeld } from './ZuordnungsFeld';
import { SpaltenAuswahl } from './SpaltenAuswahl';
import './business.css';
const objekt = (w: JsonWert): Record<string, JsonWert> =>
  w && typeof w === 'object' && !Array.isArray(w) ? w : {};
const standard = (felder: KonfigFeld[]) =>
  Object.fromEntries(felder.map((f) => [f.name, structuredClone(f.standard)]));

export interface ParameterKontext {
  parametersatz: 'test' | 'echt';
  laufwerte?: Record<string, string | number | boolean | null>;
  werte: Record<string, WorkflowParameter['standard']>;
  werteOeffnen?: (name: string) => void;
}
export type QuelleWaehlen = (blockId: string, feldPfad: string[]) => Promise<string | null>;
export interface KonfigFeldFehler {
  feldPfad: string[];
  text: string;
}

const FormularKontext = createContext<{
  spalten: string[];
  parameter: WorkflowParameter[];
  variablen: { id: string; name: string }[];
  parameterKontext?: ParameterKontext;
  quelleWaehlen?: QuelleWaehlen;
  blockId?: string;
  blockTyp?: string;
  konfiguration?: Record<string, JsonWert>;
  spaltenNachEingabe: Record<string, string[]>;
  spaltenListe: string;
  feldFehler: KonfigFeldFehler[];
}>({
  spalten: [],
  parameter: [],
  variablen: [],
  spaltenNachEingabe: {},
  spaltenListe: 'business-spalten',
  feldFehler: [],
});

export function businessAuswahlText(wert: string, feld = ''): string {
  if (wert === 'ERSETZEN')
    return feld === 'konflikt' ? 'Bestehende Datei bewusst ersetzen' : 'Ersatzwert verwenden';
  return (
    (
      {
        FEHLER: 'Mit Fehler anhalten',
        STOPP: 'Mit Fehler anhalten',
        UEBERSPRINGEN: 'Überspringen und berichten',
        NEUER_NAME: 'Neuen Namen verwenden',
        AUSLASSEN_MIT_BERICHT: 'Auslassen und Anzahl berichten',
        AUSLASSEN: 'Betroffene Zeilen auslassen',
        NULL: 'Als leeren Wert übernehmen',
        BEHALTEN: 'Beibehalten und später prüfen',
        TEXT: 'Text',
        GANZZAHL: 'Ganze Zahl',
        ZAHL: 'Zahl',
        WAHRHEIT: 'Ja/Nein-Wert',
        DATUM: 'Datum',
        ZEITSTEMPEL: 'Datum und Uhrzeit',
        DEZIMAL: 'Exakter Dezimalbetrag',
        LEFT: 'Alle Zeilen der ersten Tabelle',
        INNER: 'Nur passende Zeilen beider Tabellen',
        FULL: 'Alle Zeilen beider Tabellen',
        'n:1': 'Viele zu einem (n:1)',
        '1:n': 'Einer zu vielen (1:n)',
        '1:1': 'Eindeutig eins zu eins (1:1)',
        'n:m': 'Viele zu vielen (n:m)',
        ASC: 'Aufsteigend (A bis Z, klein zu groß)',
        DESC: 'Absteigend (Z bis A, groß zu klein)',
        ERSTE: 'Erste Zeile behalten',
        LETZTE: 'Letzte Zeile behalten',
        KEINE: 'Alle mehrfach vorkommenden Zeilen entfernen',
        NICHT_LEER: 'Pflichtwerte vorhanden',
        EINDEUTIG: 'Eindeutige Schlüssel',
        BEREICH: 'Werte im erlaubten Bereich',
        TYP: 'Passender Datentyp',
        ERLAUBTE_WERTE: 'Werte aus erlaubter Liste',
        ZEILENZAHL: 'Erwartete Anzahl Zeilen',
        ANZAHL: 'Anzahl aller Zeilen',
        ANZAHL_WERTE: 'Anzahl gefüllter Werte',
        ANZAHL_VERSCHIEDEN: 'Anzahl verschiedener Werte',
        SUMME: 'Summe',
        MITTELWERT: 'Durchschnitt',
        MIN: 'Kleinster Wert',
        MAX: 'Größter Wert',
        BERICHT: 'Fehler berichten und weiterarbeiten',
        UNVERAENDERT: 'Schreibweise beibehalten',
        GROSS: 'Großbuchstaben',
        KLEIN: 'Kleinbuchstaben',
        ISO: 'Jahr-Monat-Tag (JJJJ-MM-TT)',
        DMY: 'Tag.Monat.Jahr (TT.MM.JJJJ)',
        MDY: 'Monat/Tag/Jahr (MM/TT/JJJJ)',
        UTF8: 'UTF-8 ohne BOM',
        UTF8_BOM: 'UTF-8 mit BOM',
        UTF16: 'UTF-16 mit BOM',
        CP1252: 'Windows-Westeuropa (Windows-1252)',
        WERTE: 'Nur gespeicherte Ergebnisse verwenden',
        AUSWAEHLEN: 'Spalten auswählen',
        UMBENENNEN: 'Umbenennen',
        BERECHNEN: 'Berechnen',
        BEREINIGEN: 'Texte bereinigen',
        LEERWERTE: 'Leere Werte behandeln',
        ORDNER: 'Ordner anlegen',
        KOPIEREN: 'Kopieren',
        VERSCHIEBEN: 'Verschieben',
        ZIP_ERSTELLEN: 'ZIP-Archiv erstellen',
        ZIP_ENTPACKEN: 'ZIP-Archiv entpacken',
        ABSATZ: 'Absatz',
        UEBERSCHRIFT: 'Überschrift',
        BILD: 'Bild',
        GANZER_WERT: 'Ganzer Wert',
        TEXTTEIL: 'Teil eines Textes',
        JAHR: 'Jahreszahl aus einem Datum',
        MONAT: 'Monat aus einem Datum',
        TAG: 'Tag aus einem Datum',
        TRIM: 'Rand-Leerzeichen entfernen',
        LAENGE: 'Textlänge',
        REGEX: 'Text anhand eines Suchmusters auslesen',
      } as Record<string, string>
    )[wert] ?? wert
  );
}

function SpaltenFeld(props: ComponentProps<typeof Feld>) {
  const { spalten, spaltenListe } = useContext(FormularKontext);
  return <Feld {...props} list={spalten.length ? spaltenListe : undefined} />;
}

/** Eine gewählte Herkunft ersetzt die direkte Eingabe; alternative Quellen öffnen sich erst bei Bedarf. */
function Wertbindung({
  titel,
  wert,
  aendern,
  gesperrt,
  parameter,
  variablen,
  leererWert = '',
  eingabe,
  feldFehlerId,
  feldUngueltig,
}: {
  titel: string;
  wert: JsonWert;
  aendern: (wert: JsonWert) => void;
  gesperrt: boolean;
  parameter: WorkflowParameter[];
  variablen: { id: string; name: string }[];
  leererWert?: JsonWert;
  eingabe: ReactNode;
  feldFehlerId?: string;
  feldUngueltig?: boolean;
}) {
  const formular = useContext(FormularKontext);
  const bereich = useRef<HTMLDivElement>(null);
  const w = objekt(wert);
  const parameterRef = typeof w.parameter === 'string' ? w.parameter : null;
  const variableRef = typeof w.variable === 'string' ? w.variable : null;
  const gebunden = parameterRef !== null || variableRef !== null;
  const quelle =
    variableRef !== null
      ? `variable:${variableRef}`
      : parameterRef !== null
        ? `parameter:${parameterRef}`
        : 'wert';
  const hatAuswahl = gebunden || parameter.length > 0 || variablen.length > 0;
  const definition = parameter.find((p) => p.name === parameterRef);
  const kontext = formular.parameterKontext;
  const parameterWert = definition ? parameterWertLesen(definition, kontext?.werte ?? {}) : undefined;
  const wertText =
    parameterWert === null || parameterWert === ''
      ? 'Ohne Wert'
      : parameterWert === false
        ? 'Nein'
        : parameterWert === true
          ? 'Ja'
          : String(parameterWert ?? '');
  const auswahlAngaben = {
    value: quelle,
    disabled: gesperrt,
    'aria-invalid': feldUngueltig || undefined,
    'aria-describedby': feldFehlerId,
    title:
      variableRef !== null
        ? `Variable · ${variablen.find((v) => v.id === variableRef)?.name ?? 'Nicht mehr vorhanden'}`
        : parameterRef !== null
          ? `Workflowparameter · ${parameter.find((p) => p.name === parameterRef)?.beschriftung ?? parameterRef}`
          : 'Wert eingeben',
    onChange: (event: ChangeEvent<HTMLSelectElement>) => {
      const neu = event.target.value;
      aendern(
        neu.startsWith('parameter:')
          ? { parameter: neu.slice('parameter:'.length) }
          : neu.startsWith('variable:')
            ? { variable: neu.slice('variable:'.length) }
            : leererWert,
      );
      // Nach dem Wechsel steht entweder die direkte Eingabe oder die neue Quellenauswahl an derselben Stelle.
      requestAnimationFrame(() =>
        bereich.current?.querySelector<HTMLElement>('input, select, textarea')?.focus(),
      );
    },
  };
  const optionen = (
    <>
      <optgroup label="Wert">
        <option value="wert">Wert eingeben</option>
      </optgroup>
      {(parameter.length > 0 || parameterRef !== null) && (
        <optgroup label="Workflowparameter">
          {parameterRef !== null && !parameter.some((p) => p.name === parameterRef) && (
            <option value={`parameter:${parameterRef}`}>
              Workflowparameter · {parameterRef || '(leer)'} (nicht definiert)
            </option>
          )}
          {parameter.map((p) => (
            <option key={p.name} value={`parameter:${p.name}`}>
              Workflowparameter · {p.beschriftung}
            </option>
          ))}
        </optgroup>
      )}
      {(variablen.length > 0 || variableRef !== null) && (
        <optgroup label="Variable">
          {variableRef !== null && !variablen.some((v) => v.id === variableRef) && (
            <option value={`variable:${variableRef}`}>Variable · Nicht mehr vorhanden</option>
          )}
          {variablen.map((v) => (
            <option key={v.id} value={`variable:${v.id}`}>
              Variable · {v.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
  return (
    <div ref={bereich}>
      {gebunden ? (
        <>
          <Auswahlfeld beschriftung={titel} {...auswahlAngaben}>
            {optionen}
          </Auswahlfeld>
          {parameterRef !== null && definition && (
            <div className="business-bindungswert">
              <p title={wertText}>
                <strong>
                  {kontext
                    ? kontext.parametersatz === 'test'
                      ? 'Testdaten'
                      : 'Echte Daten'
                    : 'Standardwert'}
                  :
                </strong>{' '}
                <span>{wertText}</span>
                {kontext && !Object.hasOwn(kontext.werte, definition.name) && <span> · Standardwert</span>}
                {kontext?.laufwerte && Object.hasOwn(kontext.laufwerte, definition.name) && (
                  <span> · Für den nächsten Lauf angepasst</span>
                )}
              </p>
              {kontext?.werteOeffnen && (
                <Knopf variante="leise" onClick={() => kontext.werteOeffnen!(definition.name)}>
                  Wert bearbeiten
                </Knopf>
              )}
            </div>
          )}
          {parameterRef !== null && !definition && !feldUngueltig && (
            <p className="sl-feld-fehler">Dieser Workflowparameter ist nicht definiert.</p>
          )}
          {variableRef !== null && (
            <p className="business-bindungshinweis">Der Variablenwert entsteht während des Laufs.</p>
          )}
        </>
      ) : (
        <>
          {eingabe}
          {hatAuswahl && (
            <details>
              <summary>Wertquelle ändern</summary>
              <div style={{ paddingBlockStart: 'var(--abstand-8)' }}>
                <select className="sl-feld-eingabe" aria-label={`${titel}: Wertquelle`} {...auswahlAngaben}>
                  {optionen}
                </select>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function LiteralEingabe({
  wert,
  aendern,
  gesperrt,
  titel = 'Vergleichswert',
  parameter: parameterVorgabe,
}: {
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  gesperrt: boolean;
  titel?: string;
  parameter?: WorkflowParameter[];
}) {
  const kontext = useContext(FormularKontext);
  const parameter = parameterVorgabe ?? kontext.parameter;
  const w = objekt(wert),
    typ = typeof w.typ === 'string' ? w.typ : String(objekt(w.typ ?? null).art ?? 'TEXT');
  const primitive = w.wert === null || ['string', 'number', 'boolean'].includes(typeof w.wert);
  const wertart: WorkflowParameter['typ'] =
    (
      {
        GANZZAHL: 'Zahl',
        ZAHL: 'Zahl',
        DEZIMAL: 'Dezimalbetrag',
        DATUM: 'Datum',
        WAHRHEIT: 'Wahrheitswert',
      } as Record<string, WorkflowParameter['typ']>
    )[typ] ?? 'Text';
  return (
    <Wertbindung
      titel={titel}
      wert={w.wert ?? null}
      aendern={(neu) => aendern({ ...w, wert: neu })}
      gesperrt={gesperrt}
      parameter={parameter}
      variablen={kontext.variablen}
      leererWert={typ === 'WAHRHEIT' ? null : ''}
      eingabe={
        primitive ? (
          <ParameterWertEingabe
            beschriftung={titel}
            typ={wertart}
            wert={w.wert as WorkflowParameter['standard']}
            gesperrt={gesperrt}
            aendern={(neu) => aendern({ ...w, wert: neu })}
          />
        ) : (
          <p role="status">
            Dieser gespeicherte Wert kann hier nicht direkt bearbeitet werden. Seine Einstellungen bleiben
            erhalten.
          </p>
        )
      }
    />
  );
}

export function vergleichFuerFormular(wert: JsonWert): Record<string, JsonWert> {
  const w = objekt(wert);
  const { spalte, wert: kurzwert, ...rest } = w;
  return {
    ...rest,
    links: w.links ?? { art: 'spalte', name: spalte ?? '' },
    rechts: w.rechts ?? kurzwert ?? { art: 'wert', typ: 'TEXT', wert: '' },
  };
}

export function regelTypAendern(regel: Record<string, JsonWert>, typ: JsonWert): Record<string, JsonWert> {
  const art = typeof typ === 'string' ? typ : objekt(typ).art;
  const umwandeln = (wert: JsonWert): JsonWert => {
    const literal = objekt(wert);
    if (literal.art !== 'wert') return wert;
    let inhalt = literal.wert;
    if (inhalt !== null && typeof inhalt !== 'object') {
      if (art === 'GANZZAHL' || art === 'ZAHL') inhalt = parameterWertAusText('Zahl', String(inhalt));
      else if (art === 'WAHRHEIT' && typeof inhalt !== 'boolean')
        inhalt = ['true', 'wahr', 'ja'].includes(String(inhalt).toLowerCase())
          ? true
          : ['false', 'falsch', 'nein'].includes(String(inhalt).toLowerCase())
            ? false
            : null;
      else if (art !== 'WAHRHEIT') inhalt = String(inhalt);
    }
    return { ...literal, typ, wert: inhalt };
  };
  return {
    ...regel,
    typ,
    ...(regel.minimum !== undefined ? { minimum: umwandeln(regel.minimum) } : {}),
    ...(regel.maximum !== undefined ? { maximum: umwandeln(regel.maximum) } : {}),
    ...(Array.isArray(regel.werte) ? { werte: regel.werte.map(umwandeln) } : {}),
  };
}

function regelTyp(regel: Record<string, JsonWert>, vorgabe: JsonWert): JsonWert {
  if (regel.typ !== undefined) return regel.typ;
  const literale = [regel.minimum, regel.maximum, ...(Array.isArray(regel.werte) ? regel.werte : [])];
  return literale.map((w) => objekt(w ?? null)).find((w) => w.art === 'wert')?.typ ?? vorgabe;
}

const ausdruckTypen = ['TEXT', 'GANZZAHL', 'ZAHL', 'DEZIMAL', 'DATUM', 'ZEITSTEMPEL', 'WAHRHEIT'];
const funktionen = ['JAHR', 'MONAT', 'TAG', 'TRIM', 'GROSS', 'KLEIN', 'LAENGE', 'REGEX'];
const literalFuerFormular = (wert: JsonWert, typ: JsonWert = 'TEXT'): Record<string, JsonWert> => {
  const w = objekt(wert);
  return w.art === 'wert' || (Object.hasOwn(w, 'typ') && Object.hasOwn(w, 'wert'))
    ? { ...w, art: 'wert' }
    : { art: 'wert', typ, wert: wert ?? null };
};

function LiteralTypAuswahl({
  wert,
  aendern,
  gesperrt,
}: {
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  gesperrt: boolean;
}) {
  const w = objekt(wert);
  return (
    <Auswahlfeld
      beschriftung="Datentyp"
      value={typeof w.typ === 'object' ? 'DEZIMAL' : String(w.typ ?? 'TEXT')}
      disabled={gesperrt}
      onChange={(e) => aendern(literalTypSetzen(wert, e.target.value))}
    >
      {ausdruckTypen.map((t) => (
        <option key={t} value={t}>
          {businessAuswahlText(t)}
        </option>
      ))}
    </Auswahlfeld>
  );
}

/** Formulare bearbeiten strukturierte Daten, niemals Programmtext. */
function AusdruckFeld({
  wert,
  aendern,
  gesperrt,
  titel = 'Wert',
  kompakt = false,
}: {
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  gesperrt: boolean;
  titel?: string;
  kompakt?: boolean;
}) {
  const formular = useContext(FormularKontext);
  const w = objekt(wert);
  if (!w.art && (Object.hasOwn(w, 'parameter') || Object.hasOwn(w, 'variable'))) {
    const parameter = formular.parameter.find((p) => p.name === w.parameter);
    const typen: Record<string, string> = {
      Zahl: 'ZAHL',
      Dezimalbetrag: 'DEZIMAL',
      Datum: 'DATUM',
      Wahrheitswert: 'WAHRHEIT',
    };
    return (
      <AusdruckFeld
        wert={{ art: 'wert', typ: typen[parameter?.typ ?? ''] ?? 'TEXT', wert }}
        aendern={aendern}
        gesperrt={gesperrt}
        titel={titel}
        kompakt={kompakt}
      />
    );
  }
  const art = String(w.art ?? 'spalte');
  if (!['spalte', 'wert', 'rechnen', 'funktion'].includes(art))
    return (
      <div className="business-untergruppe">
        <p role="status">Dieser gespeicherte Ausdruck bleibt unverändert erhalten.</p>
        <details>
          <summary>Gespeicherte Einstellungen ansehen</summary>
          <pre>{JSON.stringify(w, null, 2)}</pre>
        </details>
      </div>
    );
  const artwahl = (
    <Auswahlfeld
      beschriftung="Wert aus"
      value={art}
      disabled={gesperrt}
      onChange={(e) => aendern(ausdruckArtSetzen(wert, e.target.value))}
    >
      <option value="spalte">Tabellenspalte</option>
      <option value="wert">Fester Wert oder Eingabe</option>
      <option value="rechnen">Berechnung</option>
      <option value="funktion">Funktion anwenden</option>
    </Auswahlfeld>
  );
  const inhalt =
    art === 'spalte' ? (
      <SpaltenFeld
        beschriftung={titel === 'Wert' ? 'Spalte' : titel}
        value={String(w.name ?? '')}
        disabled={gesperrt}
        onChange={(e) => aendern({ ...w, name: e.target.value })}
      />
    ) : art === 'wert' ? (
      <>
        {!kompakt && <LiteralTypAuswahl wert={wert} aendern={aendern} gesperrt={gesperrt} />}
        <LiteralEingabe titel={titel} wert={wert} aendern={aendern} gesperrt={gesperrt} />
      </>
    ) : art === 'funktion' ? (
      <>
        <Auswahlfeld
          beschriftung="Funktion"
          value={String(w.funktion ?? 'JAHR')}
          disabled={gesperrt}
          onChange={(e) => aendern({ ...w, funktion: e.target.value })}
        >
          {!funktionen.includes(String(w.funktion ?? 'JAHR')) && (
            <option value={String(w.funktion)}>Gespeicherte Funktion · {String(w.funktion)}</option>
          )}
          {funktionen.map((f) => (
            <option key={f} value={f}>
              {businessAuswahlText(f)}
            </option>
          ))}
        </Auswahlfeld>
        <AusdruckFeld
          titel="Angewendet auf"
          wert={w.argument ?? { art: 'spalte', name: '' }}
          aendern={(argument) => aendern({ ...w, argument })}
          gesperrt={gesperrt}
          kompakt
        />
        {w.funktion === 'REGEX' && (
          <details className="business-ausdruckdetails" open>
            <summary>Suchmuster und Ergebnisgruppe</summary>
            <div className="business-formular">
              <Feld
                beschriftung="Suchmuster"
                value={String(w.muster ?? '')}
                disabled={gesperrt}
                onChange={(e) => aendern({ ...w, muster: e.target.value })}
              />
              <Feld
                beschriftung="Ergebnisgruppe"
                type="number"
                min={0}
                max={99}
                hilfe="0 übernimmt den gesamten Treffer; 1 bis 99 eine eingeklammerte Gruppe."
                value={String(w.gruppe ?? 0)}
                disabled={gesperrt}
                onChange={(e) =>
                  aendern({ ...w, gruppe: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
          </details>
        )}
      </>
    ) : (
      <>
        <AusdruckFeld
          titel="Erster Wert"
          wert={w.links ?? { art: 'spalte', name: '' }}
          aendern={(links) => aendern({ ...w, links })}
          gesperrt={gesperrt}
          kompakt
        />
        <Auswahlfeld
          beschriftung="Rechenart"
          value={String(w.operator ?? 'SUB')}
          disabled={gesperrt}
          onChange={(e) => aendern({ ...w, operator: e.target.value })}
        >
          {[
            ['ADD', 'Addieren'],
            ['SUB', 'Subtrahieren'],
            ['MUL', 'Multiplizieren'],
            ['DIV', 'Dividieren'],
          ].map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Auswahlfeld>
        <AusdruckFeld
          titel="Zweiter Wert"
          wert={w.rechts ?? { art: 'spalte', name: '' }}
          aendern={(rechts) => aendern({ ...w, rechts })}
          gesperrt={gesperrt}
          kompakt
        />
      </>
    );
  return (
    <div className="business-ausdruck">
      {kompakt && (art === 'spalte' || art === 'wert') ? (
        <>
          {inhalt}
          <details className="business-ausdruckdetails">
            <summary>{art === 'wert' ? 'Datentyp und Wertquelle' : 'Andere Wertquelle'}</summary>
            <div className="business-formular">
              {art === 'wert' && <LiteralTypAuswahl wert={wert} aendern={aendern} gesperrt={gesperrt} />}
              {artwahl}
            </div>
          </details>
        </>
      ) : (
        <>
          {artwahl}
          {inhalt}
        </>
      )}
    </div>
  );
}

function BedingungFeld({
  wert,
  aendern,
  gesperrt,
}: {
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  gesperrt: boolean;
}) {
  const w = objekt(wert),
    art = String(w.art ?? 'vergleich');
  const vergleich = vergleichFuerFormular(wert);
  const kinder = Array.isArray(w.kinder) ? w.kinder : [];
  if (!['vergleich', 'UND', 'ODER', 'NICHT'].includes(art))
    return (
      <div>
        <p role="status">Diese gespeicherte Bedingung bleibt unverändert erhalten.</p>
        <details>
          <summary>Gespeicherte Einstellungen ansehen</summary>
          <pre>{JSON.stringify(w, null, 2)}</pre>
        </details>
      </div>
    );
  if (art === 'NICHT')
    return (
      <section className="business-bedingungsgruppe" aria-label="Umgekehrte Bedingung">
        <p>Diese Bedingung darf nicht zutreffen.</p>
        <BedingungFeld
          wert={w.kind ?? neuerVergleich()}
          aendern={(kind) => aendern({ ...w, kind })}
          gesperrt={gesperrt}
        />
        <Knopf variante="leise" disabled={gesperrt} onClick={() => aendern(bedingungAufloesen(wert))}>
          Umkehrung aufheben
        </Knopf>
      </section>
    );
  if (art === 'UND' || art === 'ODER')
    return (
      <section className="business-bedingungsgruppe" aria-label="Bedingungsgruppe">
        <Auswahlfeld
          beschriftung="Diese Gruppe trifft zu, wenn"
          value={art}
          disabled={gesperrt}
          onChange={(e) => aendern(bedingungsGruppeSetzen(wert, e.target.value as 'UND' | 'ODER'))}
        >
          <option value="UND">alle Bedingungen zutreffen</option>
          <option value="ODER">mindestens eine Bedingung zutrifft</option>
        </Auswahlfeld>
        {!kinder.length && <p>Füge eine Bedingung hinzu.</p>}
        {kinder.map((kind, i) => (
          <div className="business-bedingung" key={i}>
            <BedingungFeld
              wert={kind}
              aendern={(neu) => aendern({ ...w, kinder: kinder.map((k, n) => (n === i ? neu : k)) })}
              gesperrt={gesperrt}
            />
            <Knopf
              variante="leise"
              disabled={gesperrt}
              onClick={() => aendern({ ...w, kinder: kinder.filter((_, n) => n !== i) })}
            >
              Bedingung entfernen
            </Knopf>
          </div>
        ))}
        <div className="business-regelaktionen">
          <Knopf disabled={gesperrt} onClick={() => aendern({ ...w, kinder: [...kinder, neuerVergleich()] })}>
            Bedingung hinzufügen
          </Knopf>
          <Knopf
            variante="leise"
            disabled={gesperrt}
            onClick={() => aendern({ ...w, kinder: [...kinder, { art: 'UND', kinder: [neuerVergleich()] }] })}
          >
            Untergruppe hinzufügen
          </Knopf>
        </div>
        <details className="business-ausdruckdetails">
          <summary>Gruppenaktionen</summary>
          <div className="business-regelaktionen">
            <Knopf variante="leise" disabled={gesperrt} onClick={() => aendern({ art: 'NICHT', kind: wert })}>
              Gruppe umkehren
            </Knopf>
            {kinder.length === 1 && (
              <Knopf variante="leise" disabled={gesperrt} onClick={() => aendern(bedingungAufloesen(wert))}>
                Gruppe auflösen
              </Knopf>
            )}
          </div>
        </details>
      </section>
    );
  return (
    <div className="business-vergleich">
      <AusdruckFeld
        titel="Spalte"
        wert={vergleich.links}
        aendern={(links) => aendern({ ...vergleich, links })}
        gesperrt={gesperrt}
        kompakt
      />
      <Auswahlfeld
        beschriftung="Vergleich"
        value={String(w.operator ?? 'EQ')}
        disabled={gesperrt}
        onChange={(e) => aendern({ ...vergleich, operator: e.target.value })}
      >
        {[
          ['EQ', 'gleich'],
          ['NE', 'ungleich'],
          ['GT', 'größer'],
          ['GE', 'größer oder gleich'],
          ['LT', 'kleiner'],
          ['LE', 'kleiner oder gleich'],
          ['ENTHAELT', 'enthält'],
          ['BEGINNT', 'beginnt mit'],
          ['ENDET', 'endet mit'],
          ['IST_LEER', 'ist leer'],
          ['IST_NICHT_LEER', 'ist nicht leer'],
          ['IN', 'ist einer der erlaubten Werte'],
        ].map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Auswahlfeld>
      {w.operator === 'IN' ? (
        <fieldset>
          <legend>Erlaubte Vergleichswerte</legend>
          {(Array.isArray(w.werte) ? w.werte : []).map((v, i) => {
            const literal = literalFuerFormular(v);
            return (
              <div className="business-listeneintrag" key={i}>
                <LiteralEingabe
                  titel={'Wert ' + (i + 1)}
                  wert={literal}
                  gesperrt={gesperrt}
                  aendern={(neu) =>
                    aendern({
                      ...vergleich,
                      werte: (w.werte as JsonWert[]).map((v, n) => (n === i ? neu : v)),
                    })
                  }
                />
                <details className="business-ausdruckdetails">
                  <summary>Datentyp</summary>
                  <LiteralTypAuswahl
                    wert={literal}
                    gesperrt={gesperrt}
                    aendern={(neu) =>
                      aendern({
                        ...vergleich,
                        werte: (w.werte as JsonWert[]).map((v, n) => (n === i ? neu : v)),
                      })
                    }
                  />
                </details>
                <Knopf
                  variante="leise"
                  disabled={gesperrt}
                  onClick={() =>
                    aendern({ ...vergleich, werte: (w.werte as JsonWert[]).filter((_, n) => n !== i) })
                  }
                >
                  Wert entfernen
                </Knopf>
              </div>
            );
          })}
          <Knopf
            disabled={gesperrt}
            onClick={() =>
              aendern({
                ...vergleich,
                werte: [...(Array.isArray(w.werte) ? w.werte : []), { art: 'wert', typ: 'TEXT', wert: '' }],
              })
            }
          >
            Wert hinzufügen
          </Knopf>
        </fieldset>
      ) : (
        !String(w.operator).startsWith('IST_') && (
          <AusdruckFeld
            titel="Vergleichswert"
            wert={vergleich.rechts}
            aendern={(rechts) => aendern({ ...vergleich, rechts })}
            gesperrt={gesperrt}
            kompakt
          />
        )
      )}
      <details className="business-ausdruckdetails">
        <summary>Bedingung erweitern</summary>
        <div className="business-regelaktionen">
          <Knopf
            disabled={gesperrt}
            onClick={() => aendern({ art: 'UND', kinder: [wert, neuerVergleich()] })}
          >
            Weitere Bedingung
          </Knopf>
          <Knopf
            variante="leise"
            disabled={gesperrt}
            onClick={() => aendern(bedingungsGruppeSetzen(wert, 'UND'))}
          >
            In Gruppe fassen
          </Knopf>
          <Knopf variante="leise" disabled={gesperrt} onClick={() => aendern({ art: 'NICHT', kind: wert })}>
            Bedingung umkehren
          </Knopf>
        </div>
      </details>
    </div>
  );
}
function PruefregelZahlgrenze({
  titel,
  wert,
  aendern,
  gesperrt,
  feldPfad,
}: {
  titel: string;
  wert: JsonWert;
  aendern: (wert: JsonWert) => void;
  gesperrt: boolean;
  feldPfad: string[];
}) {
  const formular = useContext(FormularKontext);
  const pfad = ['konfiguration', ...feldPfad];
  const fehler = formular.feldFehler.filter((f) => JSON.stringify(f.feldPfad) === JSON.stringify(pfad));
  const roh = objekt(wert).art === 'wert' ? objekt(wert).wert : wert;
  return (
    <div data-konfig-pfad={JSON.stringify(pfad)} role="group" aria-label={titel} tabIndex={-1}>
      <Feld
        beschriftung={titel}
        value={String(roh ?? '')}
        inputMode="numeric"
        disabled={gesperrt}
        fehler={fehler.map((f) => f.text).join(' ') || undefined}
        onChange={(e) => aendern(parameterWertAusText('Zahl', e.target.value))}
      />
    </div>
  );
}

function PruefregelEingabe({
  wert,
  felder,
  feldPfad,
  aendern,
  entfernen,
  gesperrt,
}: {
  wert: JsonWert;
  felder: KonfigFeld[];
  feldPfad: string[];
  aendern: (wert: JsonWert) => void;
  entfernen: () => void;
  gesperrt: boolean;
}) {
  const formular = useContext(FormularKontext);
  const r = objekt(wert);
  const art = String(r.art ?? 'NICHT_LEER');
  const vollPfad = ['konfiguration', ...feldPfad];
  const fehler = formular.feldFehler.filter((f) => vollPfad.every((teil, i) => f.feldPfad[i] === teil));
  const fehlerKennung = fehler.length ? JSON.stringify(fehler) : '';
  const hatGrenze = (name: string) => r[name] !== undefined && r[name] !== null && r[name] !== '';
  const spalten =
    Array.isArray(r.spalten) && r.spalten.length
      ? r.spalten
      : typeof r.spalte === 'string' && r.spalte.trim()
        ? [r.spalte]
        : [];
  const benoetigtSpalte = !['EINDEUTIG', 'ZEILENZAHL'].includes(art);
  const unvollstaendig =
    (benoetigtSpalte && !String(r.spalte ?? '').trim()) ||
    (art === 'EINDEUTIG' && !spalten.length) ||
    (['BEREICH', 'ZEILENZAHL'].includes(art) && !hatGrenze('minimum') && !hatGrenze('maximum')) ||
    (art === 'ERLAUBTE_WERTE' && (!Array.isArray(r.werte) || !r.werte.length));
  const [offen, setOffen] = useState(Boolean(fehlerKennung) || unvollstaendig);
  useEffect(() => {
    if (fehlerKennung) setOffen(true);
  }, [fehlerKennung]);
  const typ = regelTyp(r, 'TEXT');
  const feld = (name: string, aktuellerWert = r[name], setzen?: (neu: JsonWert) => void) => {
    const definition = felder.find((f) => f.name === name)!;
    return (
      <KonfigEingabe
        key={name}
        feld={definition}
        wert={aktuellerWert ?? definition.standard}
        aendern={setzen ?? ((neu) => aendern({ ...r, [name]: neu }))}
        parameter={formular.parameter}
        gesperrt={gesperrt}
        feldPfad={[...feldPfad, name]}
      />
    );
  };
  const grenzeSetzen = (name: string, neu: JsonWert) => {
    const naechste = { ...r };
    const literal = objekt(neu);
    if (literal.wert === null || literal.wert === '') delete naechste[name];
    else naechste[name] = neu;
    aendern(naechste);
  };
  return (
    <details
      className="business-pruefregel"
      open={offen}
      onToggle={(e) => setOffen(e.currentTarget.open)}
      data-konfig-pfad={JSON.stringify(vollPfad)}
      aria-invalid={fehler.length ? true : undefined}
    >
      <summary>
        {pruefregelZusammenfassung(wert)}
        {fehler.length > 0 && (
          <span className="text-fehler">
            {' '}
            · {fehler.length === 1 ? '1 Hinweis' : fehler.length + ' Hinweise'}
          </span>
        )}
      </summary>
      <div className="business-formular">
        {feld('art', art, (neu) => aendern(pruefregelArtSetzen(wert, String(neu))))}
        {!['NICHT_LEER', 'EINDEUTIG', 'BEREICH', 'TYP', 'ERLAUBTE_WERTE', 'ZEILENZAHL'].includes(art) ? (
          <p role="status">
            Diese gespeicherte Prüfregel bleibt erhalten. Wähle eine unterstützte Prüfung, um sie anzupassen.
          </p>
        ) : (
          <>
            {benoetigtSpalte && feld('spalte')}
            {art === 'EINDEUTIG' &&
              feld('spalten', spalten, (neu) => aendern(pruefregelSpaltenSetzen(wert, neu)))}
            {['BEREICH', 'TYP', 'ERLAUBTE_WERTE'].includes(art) &&
              feld('typ', typ, (neu) => aendern(regelTypAendern(r, neu)))}
            {art === 'BEREICH' &&
              ['minimum', 'maximum'].map((name) => (
                <KonfigEingabe
                  key={name}
                  feld={{
                    ...felder.find((f) => f.name === name)!,
                    titel: name === 'minimum' ? 'Untere Grenze (optional)' : 'Obere Grenze (optional)',
                  }}
                  wert={literalFuerFormular(hatGrenze(name) ? r[name] : null, typ)}
                  aendern={(neu) => grenzeSetzen(name, neu)}
                  parameter={formular.parameter}
                  gesperrt={gesperrt}
                  feldPfad={[...feldPfad, name]}
                />
              ))}
            {art === 'ZEILENZAHL' &&
              ['minimum', 'maximum'].map((name) => (
                <PruefregelZahlgrenze
                  key={name}
                  titel={
                    name === 'minimum'
                      ? 'Mindestens so viele Zeilen (optional)'
                      : 'Höchstens so viele Zeilen (optional)'
                  }
                  wert={r[name] ?? null}
                  gesperrt={gesperrt}
                  feldPfad={[...feldPfad, name]}
                  aendern={(neu) => {
                    const naechste = { ...r };
                    if (neu === null || neu === '') delete naechste[name];
                    else naechste[name] = neu;
                    aendern(naechste);
                  }}
                />
              ))}
            {art === 'ERLAUBTE_WERTE' &&
              feld(
                'werte',
                (Array.isArray(r.werte) ? r.werte : []).map((w) => literalFuerFormular(w, typ)),
                (neu) =>
                  aendern({
                    ...r,
                    werte: (Array.isArray(neu) ? neu : []).map((w) => literalFuerFormular(w, typ)),
                  }),
              )}
          </>
        )}
        <Knopf variante="leise" disabled={gesperrt} onClick={entfernen}>
          Prüfregel entfernen
        </Knopf>
      </div>
    </details>
  );
}

interface KonfigEingabeEigenschaften {
  feld: KonfigFeld;
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  parameter?: WorkflowParameter[];
  gesperrt?: boolean;
  feldPfad?: string[];
}

export function KonfigEingabe(eigenschaften: KonfigEingabeEigenschaften) {
  const formular = useContext(FormularKontext);
  const fehlerId = useId();
  const pfad = eigenschaften.feldPfad?.length ? ['konfiguration', ...eigenschaften.feldPfad] : undefined;
  const fehler = pfad
    ? formular.feldFehler.filter((f) => JSON.stringify(f.feldPfad) === JSON.stringify(pfad))
    : [];
  if (
    eigenschaften.feld.art === 'auswahl' &&
    eigenschaften.feld.optionen?.length === 1 &&
    eigenschaften.wert === eigenschaften.feld.optionen[0] &&
    !fehler.length
  )
    return null;
  return (
    <div
      data-konfig-pfad={pfad ? JSON.stringify(pfad) : undefined}
      role="group"
      aria-label={eigenschaften.feld.titel}
      aria-invalid={fehler.length ? true : undefined}
      aria-describedby={fehler.length ? fehlerId : undefined}
      tabIndex={pfad ? -1 : undefined}
    >
      <KonfigEingabeInhalt
        {...eigenschaften}
        feldFehlerId={fehler.length ? fehlerId : undefined}
        feldUngueltig={fehler.length > 0}
      />
      {fehler.length > 0 && (
        <p id={fehlerId} className="sl-feld-fehler">
          {fehler.map((f) => f.text).join(' ')}
        </p>
      )}
    </div>
  );
}

function KonfigEingabeInhalt({
  feld,
  wert,
  aendern,
  parameter = [],
  gesperrt = false,
  feldPfad = [],
  feldFehlerId,
  feldUngueltig,
}: KonfigEingabeEigenschaften & { feldFehlerId?: string; feldUngueltig?: boolean }) {
  const formular = useContext(FormularKontext);
  const [waehlt, setWaehlt] = useState(false);
  const [auswahlFehler, setAuswahlFehler] = useState('');
  const w = objekt(wert);
  const teile = Array.isArray(wert) ? wert : [];
  const seitenspalten = formular.spaltenNachEingabe[feld.name];
  const spaltenListe =
    seitenspalten !== undefined
      ? seitenspalten.length
        ? `${formular.spaltenListe}-${feld.name}`
        : undefined
      : formular.spalten.length
        ? formular.spaltenListe
        : undefined;
  if (w.art === 'wert' && ['text', 'zahl'].includes(feld.art))
    return (
      <LiteralEingabe
        wert={wert}
        aendern={aendern}
        gesperrt={gesperrt}
        titel={feld.titel}
        parameter={parameter}
      />
    );
  if (feld.art === 'bedingung')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        <BedingungFeld wert={wert} aendern={aendern} gesperrt={gesperrt} />
      </fieldset>
    );
  if (feld.art === 'ausdruck')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        <AusdruckFeld wert={wert} aendern={aendern} gesperrt={gesperrt} />
      </fieldset>
    );
  if (feld.art === 'objekt')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        {feld.felder!.map((f) => (
          <KonfigEingabe
            key={f.name}
            feld={f}
            wert={w[f.name] ?? f.standard}
            aendern={(neu) => aendern({ ...w, [f.name]: neu })}
            parameter={parameter}
            gesperrt={gesperrt}
            feldPfad={[...feldPfad, f.name]}
          />
        ))}
      </fieldset>
    );
  if (feld.art === 'liste' && feld.name === 'regeln')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        {teile.map((teil, i) => (
          <PruefregelEingabe
            key={i}
            wert={teil}
            felder={feld.felder!}
            feldPfad={[...feldPfad, String(i)]}
            gesperrt={gesperrt}
            aendern={(neu) => aendern(teile.map((v, n) => (n === i ? neu : v)))}
            entfernen={() => aendern(teile.filter((_, n) => n !== i))}
          />
        ))}
        <Knopf disabled={gesperrt} onClick={() => aendern([...teile, { art: 'NICHT_LEER', spalte: '' }])}>
          Prüfregel hinzufügen
        </Knopf>
      </fieldset>
    );
  if (feld.art === 'spalten' && ['spalten', 'schluessel'].includes(feld.name))
    return (
      <SpaltenAuswahl
        titel={feld.titel}
        werte={teile}
        vorschlaege={formular.spalten}
        aendern={aendern}
        gesperrt={gesperrt}
        renderGebunden={(teil, i, setzen) => (
          <KonfigEingabe
            feld={{ name: String(i), titel: `Spalte ${i + 1}`, art: 'text', standard: '' }}
            wert={teil}
            aendern={setzen}
            parameter={parameter}
            gesperrt={gesperrt}
            feldPfad={[...feldPfad, String(i)]}
          />
        )}
      />
    );
  if (feld.art === 'liste' || feld.art === 'spalten')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        {teile.map((teil, i) => (
          <div className="business-listeneintrag" key={i}>
            {feld.art === 'spalten' && objekt(teil).art === 'wert' ? (
              <LiteralEingabe
                titel={`Eintrag ${i + 1}`}
                wert={teil}
                aendern={(neu) => aendern(teile.map((v, n) => (n === i ? neu : v)))}
                gesperrt={gesperrt}
                parameter={parameter}
              />
            ) : feld.art === 'spalten' ? (
              <Feld
                beschriftung={`Eintrag ${i + 1}`}
                list={
                  formular.spalten.length && ['spalten', 'schluessel'].includes(feld.name)
                    ? formular.spaltenListe
                    : undefined
                }
                value={String(teil)}
                disabled={gesperrt}
                onChange={(e) => aendern(teile.map((v, n) => (n === i ? e.target.value : v)))}
              />
            ) : (
              feld.felder!.map((f) => (
                <KonfigEingabe
                  key={f.name}
                  feld={f}
                  wert={
                    feld.name === 'regeln' && f.name === 'typ'
                      ? regelTyp(objekt(teil), f.standard)
                      : (objekt(teil)[f.name] ?? f.standard)
                  }
                  aendern={(neu) =>
                    aendern(
                      teile.map((v, n) =>
                        n === i
                          ? feld.name === 'regeln' && f.name === 'typ'
                            ? regelTypAendern(objekt(v), neu)
                            : { ...objekt(v), [f.name]: neu }
                          : v,
                      ),
                    )
                  }
                  parameter={parameter}
                  gesperrt={gesperrt}
                  feldPfad={[...feldPfad, String(i), f.name]}
                />
              ))
            )}
            <Knopf disabled={gesperrt} onClick={() => aendern(teile.filter((_, n) => n !== i))}>
              Eintrag entfernen
            </Knopf>
          </div>
        ))}
        <Knopf
          disabled={gesperrt}
          onClick={() => aendern([...teile, feld.art === 'spalten' ? '' : standard(feld.felder!)])}
        >
          Eintrag hinzufügen
        </Knopf>
      </fieldset>
    );
  if (feld.art === 'zuordnung') {
    const schluesselTitel =
      feld.name === 'namen'
        ? 'Vorhandene Spalte'
        : ['zellen', 'formeln'].includes(feld.name)
          ? 'Zelladresse'
          : 'Platzhalter';
    const wertTitel =
      feld.name === 'namen'
        ? 'Neuer Spaltenname'
        : feld.name === 'summen'
          ? 'Wertspalte'
          : feld.name === 'formeln'
            ? 'Excel-Formel'
            : 'Wert';
    return (
      <ZuordnungsFeld
        key={`${formular.blockId}:${JSON.stringify(feldPfad)}`}
        titel={feld.titel}
        wert={w}
        aendern={aendern}
        gesperrt={gesperrt}
        schluesselTitel={schluesselTitel}
        wertTitel={wertTitel}
        vorschlaege={feld.name === 'namen' ? formular.spalten : []}
        renderWert={(name, teil, setzen) => (
          <KonfigEingabe
            feld={{
              name: feld.name === 'summen' ? 'spalte' : name,
              titel: wertTitel,
              art: 'text',
              standard: '',
            }}
            wert={teil}
            gesperrt={gesperrt}
            parameter={parameter}
            aendern={setzen}
            feldPfad={[...feldPfad, name]}
          />
        )}
      />
    );
  }
  if (feld.art === 'typ')
    return (
      <>
        <Auswahlfeld
          beschriftung={feld.titel}
          aria-invalid={feldUngueltig || undefined}
          aria-describedby={feldFehlerId}
          disabled={gesperrt}
          value={typeof wert === 'object' ? 'DEZIMAL' : String(wert)}
          onChange={(e) =>
            aendern(
              e.target.value === 'DEZIMAL' ? { art: 'DEZIMAL', praezision: 18, skala: 2 } : e.target.value,
            )
          }
        >
          {['TEXT', 'GANZZAHL', 'ZAHL', 'WAHRHEIT', 'DATUM', 'ZEITSTEMPEL', 'DEZIMAL'].map((v) => (
            <option key={v} value={v}>
              {businessAuswahlText(v)}
            </option>
          ))}
        </Auswahlfeld>
        {w.art === 'DEZIMAL' && (
          <>
            <Feld
              beschriftung="Gesamtzahl der Ziffern (1–38)"
              type="number"
              value={Number(w.praezision ?? 18)}
              disabled={gesperrt}
              onChange={(e) => aendern({ ...w, praezision: Number(e.target.value) })}
            />
            <Feld
              beschriftung="Nachkommastellen"
              type="number"
              value={Number(w.skala ?? 2)}
              disabled={gesperrt}
              onChange={(e) => aendern({ ...w, skala: Number(e.target.value) })}
            />
          </>
        )}
      </>
    );
  if (feld.art === 'wahrheit')
    return (
      <label className="business-checkbox">
        <input
          type="checkbox"
          aria-invalid={feldUngueltig || undefined}
          aria-describedby={feldFehlerId}
          checked={wert === true}
          disabled={gesperrt}
          onChange={(e) => aendern(e.target.checked)}
        />
        {feld.titel}
      </label>
    );
  if (feld.art === 'auswahl')
    return (
      <Auswahlfeld
        beschriftung={feld.titel}
        aria-invalid={feldUngueltig || !feld.optionen!.includes(String(wert)) || undefined}
        aria-describedby={feldFehlerId}
        value={String(wert)}
        disabled={gesperrt}
        onChange={(e) => aendern(e.target.value)}
      >
        {!feld.optionen!.includes(String(wert)) && (
          <option value={String(wert)}>{String(wert) || 'Keine Auswahl'} · nicht verfügbar</option>
        )}
        {feld.optionen!.map((v) => (
          <option key={v} value={v}>
            {feld.name === 'nullen'
              ? v === 'ERSTE'
                ? 'Leere Werte zuerst'
                : 'Leere Werte zuletzt'
              : businessAuswahlText(v, feld.name)}
          </option>
        ))}
      </Auswahlfeld>
    );
  return (
    <Wertbindung
      titel={feld.titel}
      wert={wert}
      aendern={aendern}
      gesperrt={gesperrt}
      parameter={parameter}
      feldFehlerId={feldFehlerId}
      feldUngueltig={feldUngueltig}
      variablen={feld.art === 'text' || typeof w.variable === 'string' ? formular.variablen : []}
      eingabe={
        <>
          {formular.blockTyp === 'sl_biz_pdf_bericht' && feld.name === 'schrift' ? (
            <>
              <Auswahlfeld
                beschriftung="Schrift"
                aria-invalid={feldUngueltig || undefined}
                aria-describedby={feldFehlerId}
                value={wert === 'INTERN:VERA' ? 'mitgeliefert' : 'eigene'}
                disabled={gesperrt}
                onChange={(e) => aendern(e.target.value === 'mitgeliefert' ? 'INTERN:VERA' : '')}
              >
                <option value="mitgeliefert">Mitgelieferte Schrift</option>
                <option value="eigene">Eigene Schriftdatei</option>
              </Auswahlfeld>
              {wert !== 'INTERN:VERA' && (
                <Feld
                  beschriftung="Pfad zur Schriftdatei (TTF)"
                  value={typeof wert === 'string' ? wert : ''}
                  disabled={gesperrt}
                  aria-invalid={feldUngueltig || undefined}
                  aria-describedby={feldFehlerId}
                  onChange={(e) => aendern(e.target.value)}
                />
              )}
            </>
          ) : (
            <Feld
              beschriftung={feld.titel}
              aria-invalid={feldUngueltig || undefined}
              aria-describedby={feldFehlerId}
              list={['spalte', 'links', 'rechts'].includes(feld.name) ? spaltenListe : undefined}
              value={typeof wert === 'object' ? '' : String(wert ?? '')}
              disabled={gesperrt}
              type={feld.art === 'zahl' ? 'number' : 'text'}
              onChange={(e) => aendern(feld.art === 'zahl' ? Number(e.target.value) : e.target.value)}
            />
          )}
          {formular.quelleWaehlen &&
            formular.blockId &&
            formular.blockTyp &&
            istQuellenfeld(formular.blockTyp, feldPfad, formular.konfiguration ?? {}) && (
              <Knopf
                variante="leise"
                symbol="oeffnen"
                disabled={gesperrt}
                grund="Stoppe den Lauf vor Änderungen."
                verarbeitung={waehlt}
                onClick={async () => {
                  setWaehlt(true);
                  setAuswahlFehler('');
                  try {
                    const pfad = await formular.quelleWaehlen!(formular.blockId!, feldPfad);
                    if (pfad !== null) aendern(pfad);
                  } catch (fehler) {
                    setAuswahlFehler(
                      fehler instanceof Error ? fehler.message : 'Die Quelle konnte nicht ausgewählt werden.',
                    );
                  } finally {
                    setWaehlt(false);
                  }
                }}
              >
                {feld.name === 'ordner'
                  ? 'Ordner auswählen'
                  : feld.name === 'vorlage'
                    ? 'Vorlage auswählen'
                    : 'Datei auswählen'}
              </Knopf>
            )}
          {auswahlFehler && (
            <p className="sl-feld-fehler" role="alert">
              {auswahlFehler}
            </p>
          )}
        </>
      }
    />
  );
}

/** Ein neuer Fehler macht auch seltene Einstellungen sofort erreichbar. */
function WeitereEinstellungen({ fehlerKennung, children }: { fehlerKennung: string; children: ReactNode }) {
  const bereich = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (fehlerKennung && bereich.current) bereich.current.open = true;
  }, [fehlerKennung]);
  return (
    <details className="business-weitere" ref={bereich} open={Boolean(fehlerKennung) || undefined}>
      <summary>Weitere Einstellungen</summary>
      <div className="business-formular">{children}</div>
    </details>
  );
}

export function BusinessEigenschaften({
  ws,
  block,
  parameter,
  gesperrt,
  geaendert,
  spalten = [],
  spaltenNachQuelle,
  parameterKontext,
  quelleWaehlen,
  feldFehler = [],
}: {
  ws: Blockly.WorkspaceSvg;
  block: Blockly.Block;
  parameter: WorkflowParameter[];
  gesperrt: boolean;
  geaendert: () => void;
  spalten?: string[];
  spaltenNachQuelle?: Record<string, string[]>;
  parameterKontext?: ParameterKontext;
  quelleWaehlen?: QuelleWaehlen;
  feldFehler?: KonfigFeldFehler[];
}) {
  const [, aktualisieren] = useState(0);
  const spaltenListe = `business-spalten-${useId()}`;
  const def = businessNachTyp.get(block.type)!;
  let daten: ReturnType<typeof businessDatenLesen>;
  try {
    daten = businessDatenLesen(block.type, block.data ?? undefined);
  } catch (e) {
    return <p role="alert">{String(e)}</p>;
  }
  const setzen = (neu: typeof daten) => {
    if (gesperrt) return;
    const vorher = block.data ?? null;
    block.data = JSON.stringify(neu);
    Blockly.Events.fire(new BlockDatenEreignis(block, vorher, block.data));
    aktualisieren((n) => n + 1);
    geaendert();
  };
  const spaltenNachEingabe = spaltenNachQuelle
    ? Object.fromEntries(
        Object.entries(def.eingaben).map(([name, typ]) => {
          const referenz = objekt(daten.eingaben[name] ?? null).referenz;
          const sicher =
            typeof referenz === 'string' &&
            businessQuellenVorBlock(ws, block.id, typ).some((b) => b.id === referenz);
          return [name, sicher ? (spaltenNachQuelle[referenz as string] ?? []) : []];
        }),
      )
    : {};
  const passendeSpalten = spaltenNachQuelle
    ? [...new Set(Object.values(spaltenNachEingabe).flat())]
    : spalten;
  const felder = def.felder.flatMap((feld) => {
    const wert = daten.konfiguration[feld.name] ?? feld.standard;
    if (
      feld.darstellung === 'flach' &&
      feld.art === 'objekt' &&
      wert &&
      typeof wert === 'object' &&
      !Array.isArray(wert)
    ) {
      return feld.felder!.map((unterfeld) => ({
        feld: unterfeld,
        feldPfad: [feld.name, unterfeld.name],
        wert: wert[unterfeld.name] ?? unterfeld.standard,
        aendern: (neu: JsonWert) =>
          setzen({
            ...daten,
            konfiguration: { ...daten.konfiguration, [feld.name]: { ...wert, [unterfeld.name]: neu } },
          }),
      }));
    }
    return [
      {
        feld,
        feldPfad: [feld.name],
        wert,
        aendern: (neu: JsonWert) =>
          setzen({ ...daten, konfiguration: { ...daten.konfiguration, [feld.name]: neu } }),
      },
    ];
  });
  const weitereFelder = felder.filter((f) => f.feld.darstellung === 'weitere');
  const weitereFehler = feldFehler.filter((fehler) =>
    weitereFelder.some(({ feldPfad }) => {
      const pfad = ['konfiguration', ...feldPfad];
      return fehler.feldPfad
        .slice(0, Math.min(pfad.length, fehler.feldPfad.length))
        .every((teil, i) => teil === pfad[i]);
    }),
  );
  const feldAnzeigen = (f: (typeof felder)[number]) => (
    <KonfigEingabe
      key={JSON.stringify(f.feldPfad)}
      feld={f.feld}
      wert={f.wert}
      aendern={f.aendern}
      parameter={parameter}
      gesperrt={gesperrt}
      feldPfad={f.feldPfad}
    />
  );
  return (
    <FormularKontext.Provider
      value={{
        parameter,
        parameterKontext,
        feldFehler,
        quelleWaehlen,
        blockId: block.id,
        blockTyp: block.type,
        konfiguration: daten.konfiguration,
        spaltenNachEingabe,
        spaltenListe,
        variablen: ws
          .getVariableMap()
          .getAllVariables()
          .map((v) => ({ id: v.getId(), name: v.getName() })),
        spalten: [
          ...new Set(passendeSpalten.filter((s) => typeof s === 'string' && s.trim() && !s.includes('\0'))),
        ].slice(0, 200),
      }}
    >
      <section className="business-formular">
        <datalist id={spaltenListe}>
          {[...new Set(passendeSpalten)]
            .filter((s) => typeof s === 'string' && s.trim() && !s.includes('\0'))
            .slice(0, 200)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        {Object.entries(spaltenNachEingabe).map(([name, spalten]) => (
          <datalist key={name} id={`${spaltenListe}-${name}`}>
            {[...new Set(spalten)]
              .filter((s) => typeof s === 'string' && s.trim() && !s.includes('\0'))
              .slice(0, 200)
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        ))}
        {def.schreibt && <p>Verändert Dateien bei echter Ausführung.</p>}
        {Object.entries(def.eingaben).map(([name, typ]) => {
          const titel = businessEingabeTitel(name, typ);
          const referenz = String(objekt(daten.eingaben[name] ?? null).referenz ?? '');
          const quellen = businessQuellenVorBlock(ws, block.id, typ);
          const ungueltig = Boolean(referenz && !quellen.some((b) => b.id === referenz));
          const bisherigeQuelle = ungueltig ? ws.getAllBlocks(false).find((b) => b.id === referenz) : null;
          const zuordnungsFehler = feldFehler.find(
            (f) => JSON.stringify(f.feldPfad) === JSON.stringify(['eingaben', name]),
          );
          const quellenHinweis = quellen.length
            ? undefined
            : typ === 'Tabelle'
              ? 'Füge vorher eine Datenquelle hinzu und verbinde sie mit dem Ablauf.'
              : typ === 'Dateiliste'
                ? 'Füge vorher „Dateien auflisten und filtern“ hinzu und verbinde den Baustein mit dem Ablauf.'
                : 'Verbinde zuerst einen passenden vorherigen Schritt mit dem Ablauf.';
          return (
            <div
              key={name}
              data-konfig-pfad={JSON.stringify(['eingaben', name])}
              role="group"
              aria-label={titel}
              tabIndex={-1}
            >
              <Auswahlfeld
                beschriftung={titel}
                value={referenz}
                disabled={gesperrt}
                hilfe={quellenHinweis}
                fehler={
                  zuordnungsFehler?.text ??
                  (ungueltig ? 'Wähle einen passenden vorherigen Schritt im selben Ablauf.' : undefined)
                }
                onChange={(e) =>
                  setzen({ ...daten, eingaben: { ...daten.eingaben, [name]: { referenz: e.target.value } } })
                }
              >
                <option value="">{titel} auswählen</option>
                {ungueltig && (
                  <option value={referenz}>
                    {bisherigeQuelle
                      ? String(bisherigeQuelle.getFieldValue('NAME') ?? 'Bisherige Zuordnung')
                      : 'Bisherige Zuordnung'}{' '}
                    · hier nicht verfügbar
                  </option>
                )}
                {quellen.map((b) => (
                  <option key={b.id} value={b.id}>
                    {String(b.getFieldValue('NAME') ?? businessNachTyp.get(b.type)!.name)}
                  </option>
                ))}
              </Auswahlfeld>
            </div>
          );
        })}
        {felder.filter((f) => f.feld.darstellung !== 'weitere').map(feldAnzeigen)}
        {weitereFelder.length > 0 && (
          <WeitereEinstellungen
            key={block.id}
            fehlerKennung={weitereFehler.length ? JSON.stringify(weitereFehler) : ''}
          >
            {weitereFelder.map(feldAnzeigen)}
          </WeitereEinstellungen>
        )}
        {passendeSpalten.length > 0 && (
          <details>
            <summary>Zu den Spaltenvorschlägen</summary>
            <p>
              Die Vorschläge stammen aus der Vorschau der gewählten Eingabetabelle. Weitere Spaltennamen
              kannst du direkt eingeben.
            </p>
          </details>
        )}
      </section>
    </FormularKontext.Provider>
  );
}
