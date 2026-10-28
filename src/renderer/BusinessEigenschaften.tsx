import {
  createContext,
  useContext,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from 'react';
import * as Blockly from 'blockly/core';
import {
  businessDatenLesen,
  businessNachTyp,
  businessEingabeTitel,
  type KonfigFeld,
} from '../kern/business-katalog';
import type { JsonWert, WorkflowParameter } from '../kern/business-modell';
import { Knopf } from './komponenten/Knopf';
import { Feld, Auswahlfeld } from './komponenten/Feld';
import { ParameterWertEingabe, parameterWertAusText } from './ParameterDialog';
import './business.css';
const objekt = (w: JsonWert): Record<string, JsonWert> =>
  w && typeof w === 'object' && !Array.isArray(w) ? w : {};
const standard = (felder: KonfigFeld[]) =>
  Object.fromEntries(felder.map((f) => [f.name, structuredClone(f.standard)]));

const FormularKontext = createContext<{
  spalten: string[];
  parameter: WorkflowParameter[];
  variablen: { id: string; name: string }[];
}>({
  spalten: [],
  parameter: [],
  variablen: [],
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
  const { spalten } = useContext(FormularKontext);
  return <Feld {...props} list={spalten.length ? 'business-spalten' : undefined} />;
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
}: {
  titel: string;
  wert: JsonWert;
  aendern: (wert: JsonWert) => void;
  gesperrt: boolean;
  parameter: WorkflowParameter[];
  variablen: { id: string; name: string }[];
  leererWert?: JsonWert;
  eingabe: ReactNode;
}) {
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
  const auswahlAngaben = {
    value: quelle,
    disabled: gesperrt,
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
        <Auswahlfeld beschriftung={titel} {...auswahlAngaben}>
          {optionen}
        </Auswahlfeld>
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

/** Formulare bearbeiten strukturierte Daten, niemals Programmtext. */
function AusdruckFeld({
  wert,
  aendern,
  gesperrt,
}: {
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  gesperrt: boolean;
}) {
  const w = objekt(wert);
  const art = String(w.art ?? 'spalte');
  if (!['spalte', 'wert', 'rechnen'].includes(art))
    return (
      <div className="business-untergruppe">
        <p role="status">
          {art === 'funktion'
            ? `Gespeicherte Funktion: ${businessAuswahlText(String(w.funktion ?? ''))}. `
            : 'Gespeicherter Ausdruck. '}
          Diese Form kann hier noch nicht bearbeitet werden. Der Ausdruck bleibt unverändert erhalten.
        </p>
        <details>
          <summary>Gespeicherte Einstellungen ansehen</summary>
          <pre>{JSON.stringify(w, null, 2)}</pre>
        </details>
      </div>
    );
  return (
    <div className="business-untergruppe">
      <Auswahlfeld
        beschriftung="Wert aus"
        value={art}
        disabled={gesperrt}
        onChange={(e) =>
          aendern(
            e.target.value === 'spalte'
              ? { art: 'spalte', name: '' }
              : e.target.value === 'wert'
                ? { art: 'wert', typ: 'TEXT', wert: '' }
                : {
                    art: 'rechnen',
                    operator: 'SUB',
                    links: { art: 'spalte', name: '' },
                    rechts: { art: 'spalte', name: '' },
                  },
          )
        }
      >
        <option value="spalte">Tabellenspalte</option>
        <option value="wert">Fester Wert</option>
        <option value="rechnen">Berechnung</option>
      </Auswahlfeld>
      {art === 'spalte' ? (
        <SpaltenFeld
          beschriftung="Spalte"
          value={String(w.name ?? '')}
          disabled={gesperrt}
          onChange={(e) => aendern({ ...w, name: e.target.value })}
        />
      ) : art === 'wert' ? (
        <>
          <Auswahlfeld
            beschriftung="Datentyp"
            value={typeof w.typ === 'object' ? 'DEZIMAL' : String(w.typ ?? 'TEXT')}
            disabled={gesperrt}
            onChange={(e) =>
              aendern({
                ...w,
                typ: e.target.value,
                wert:
                  e.target.value === 'GANZZAHL' || e.target.value === 'ZAHL'
                    ? 0
                    : e.target.value === 'WAHRHEIT'
                      ? null
                      : '',
              })
            }
          >
            {['TEXT', 'GANZZAHL', 'ZAHL', 'DEZIMAL', 'DATUM', 'ZEITSTEMPEL', 'WAHRHEIT'].map((t) => (
              <option key={t} value={t}>
                {businessAuswahlText(t)}
              </option>
            ))}
          </Auswahlfeld>
          <LiteralEingabe wert={wert} aendern={aendern} gesperrt={gesperrt} />
        </>
      ) : (
        <>
          <AusdruckFeld
            wert={w.links ?? { art: 'spalte', name: '' }}
            aendern={(links) => aendern({ ...w, links })}
            gesperrt={gesperrt}
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
            wert={w.rechts ?? { art: 'spalte', name: '' }}
            aendern={(rechts) => aendern({ ...w, rechts })}
            gesperrt={gesperrt}
          />
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
  if (!['vergleich', 'UND', 'ODER', 'NICHT'].includes(art))
    return (
      <p role="status">
        Diese gespeicherte Bedingung kann hier nicht bearbeitet werden. Ihre Einstellungen bleiben erhalten.
      </p>
    );
  return (
    <div className="business-untergruppe">
      <Auswahlfeld
        beschriftung="Bedingungen verbinden"
        value={art}
        disabled={gesperrt}
        onChange={(e) =>
          aendern(
            e.target.value === 'vergleich'
              ? {
                  art: 'vergleich',
                  links: { art: 'spalte', name: '' },
                  operator: 'EQ',
                  rechts: { art: 'wert', typ: 'TEXT', wert: '' },
                }
              : e.target.value === 'NICHT'
                ? { art: 'NICHT', kind: wert }
                : { art: e.target.value, kinder: [wert] },
          )
        }
      >
        <option value="vergleich">Ein Vergleich</option>
        <option value="UND">Alle Bedingungen (UND)</option>
        <option value="ODER">Mindestens eine (ODER)</option>
        <option value="NICHT">Bedingung umkehren (NICHT)</option>
      </Auswahlfeld>
      {art === 'vergleich' ? (
        <>
          <AusdruckFeld
            wert={vergleich.links}
            aendern={(links) => aendern({ ...vergleich, links })}
            gesperrt={gesperrt}
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
              {(Array.isArray(w.werte) ? w.werte : []).map((v, i) => (
                <div key={i}>
                  <LiteralEingabe
                    titel={`Wert ${i + 1}`}
                    wert={v}
                    gesperrt={gesperrt}
                    aendern={(neu) =>
                      aendern({
                        ...vergleich,
                        werte: (w.werte as JsonWert[]).map((v, n) => (n === i ? neu : v)),
                      })
                    }
                  />
                  <Knopf
                    disabled={gesperrt}
                    onClick={() =>
                      aendern({ ...vergleich, werte: (w.werte as JsonWert[]).filter((_, n) => n !== i) })
                    }
                  >
                    Wert entfernen
                  </Knopf>
                </div>
              ))}
              <Knopf
                disabled={gesperrt}
                onClick={() =>
                  aendern({
                    ...vergleich,
                    werte: [
                      ...(Array.isArray(w.werte) ? w.werte : []),
                      { art: 'wert', typ: 'TEXT', wert: '' },
                    ],
                  })
                }
              >
                Wert hinzufügen
              </Knopf>
            </fieldset>
          ) : (
            !String(w.operator).startsWith('IST_') && (
              <AusdruckFeld
                wert={vergleich.rechts}
                aendern={(rechts) => aendern({ ...vergleich, rechts })}
                gesperrt={gesperrt}
              />
            )
          )}
        </>
      ) : art === 'NICHT' ? (
        <BedingungFeld
          wert={w.kind ?? { art: 'vergleich', spalte: '', operator: 'IST_LEER' }}
          aendern={(kind) => aendern({ ...w, kind })}
          gesperrt={gesperrt}
        />
      ) : (
        <>
          {(Array.isArray(w.kinder) ? w.kinder : []).map((k, i) => (
            <div key={i}>
              <BedingungFeld
                wert={k}
                aendern={(neu) =>
                  aendern({ ...w, kinder: (w.kinder as JsonWert[]).map((a, n) => (n === i ? neu : a)) })
                }
                gesperrt={gesperrt}
              />
              <Knopf
                disabled={gesperrt}
                onClick={() => aendern({ ...w, kinder: (w.kinder as JsonWert[]).filter((_, n) => n !== i) })}
              >
                Bedingung entfernen
              </Knopf>
            </div>
          ))}
          <Knopf
            disabled={gesperrt}
            onClick={() =>
              aendern({
                ...w,
                kinder: [
                  ...((w.kinder as JsonWert[]) ?? []),
                  {
                    art: 'vergleich',
                    links: { art: 'spalte', name: '' },
                    operator: 'EQ',
                    rechts: { art: 'wert', typ: 'TEXT', wert: '' },
                  },
                ],
              })
            }
          >
            Bedingung hinzufügen
          </Knopf>
        </>
      )}
    </div>
  );
}
export function KonfigEingabe({
  feld,
  wert,
  aendern,
  parameter = [],
  gesperrt = false,
}: {
  feld: KonfigFeld;
  wert: JsonWert;
  aendern: (w: JsonWert) => void;
  parameter?: WorkflowParameter[];
  gesperrt?: boolean;
}) {
  const formular = useContext(FormularKontext);
  const w = objekt(wert);
  const teile = Array.isArray(wert) ? wert : [];
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
          />
        ))}
      </fieldset>
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
                    ? 'business-spalten'
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
  if (feld.art === 'zuordnung')
    return (
      <fieldset>
        <legend>{feld.titel}</legend>
        {Object.entries(w).map(([k, v], i) => (
          <div key={i}>
            <Feld
              beschriftung="Ausgangswert / Feldname"
              list={formular.spalten.length && feld.name === 'namen' ? 'business-spalten' : undefined}
              value={k}
              disabled={gesperrt}
              onChange={(e) => {
                const neu = { ...w };
                delete neu[k];
                neu[e.target.value] = v;
                aendern(neu);
              }}
            />
            <KonfigEingabe
              feld={{ name: k, titel: 'Neuer Wert / Zuordnung', art: 'text', standard: '' }}
              wert={v}
              gesperrt={gesperrt}
              parameter={parameter}
              aendern={(neu) => aendern({ ...w, [k]: neu })}
            />
            <Knopf
              disabled={gesperrt}
              onClick={() => {
                const neu = { ...w };
                delete neu[k];
                aendern(neu);
              }}
            >
              Zuordnung entfernen
            </Knopf>
          </div>
        ))}
        <Knopf
          disabled={gesperrt}
          onClick={() => aendern({ ...w, [`Feld${Object.keys(w).length + 1}`]: '' })}
        >
          Zuordnung hinzufügen
        </Knopf>
      </fieldset>
    );
  if (feld.art === 'typ')
    return (
      <>
        <Auswahlfeld
          beschriftung={feld.titel}
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
        value={String(wert)}
        disabled={gesperrt}
        onChange={(e) => aendern(e.target.value)}
      >
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
      variablen={feld.art === 'text' || typeof w.variable === 'string' ? formular.variablen : []}
      eingabe={
        <Feld
          beschriftung={feld.titel}
          list={
            formular.spalten.length && ['spalte', 'links', 'rechts'].includes(feld.name)
              ? 'business-spalten'
              : undefined
          }
          value={typeof wert === 'object' ? '' : String(wert ?? '')}
          disabled={gesperrt}
          type={feld.art === 'zahl' ? 'number' : 'text'}
          onChange={(e) => aendern(feld.art === 'zahl' ? Number(e.target.value) : e.target.value)}
        />
      }
    />
  );
}
export function BusinessEigenschaften({
  ws,
  block,
  parameter,
  gesperrt,
  geaendert,
  spalten = [],
}: {
  ws: Blockly.WorkspaceSvg;
  block: Blockly.Block;
  parameter: WorkflowParameter[];
  gesperrt: boolean;
  geaendert: () => void;
  spalten?: string[];
}) {
  const [, aktualisieren] = useState(0);
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
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'data', null, vorher, block.data));
    aktualisieren((n) => n + 1);
    geaendert();
  };
  const csvEinstellungen = ['sl_biz_lesen_csv', 'sl_biz_schreiben_csv'].includes(def.typ);
  const feldAnzeigen = (f: KonfigFeld) => (
    <KonfigEingabe
      key={f.name}
      feld={f}
      wert={daten.konfiguration[f.name] ?? f.standard}
      aendern={(wert) => setzen({ ...daten, konfiguration: { ...daten.konfiguration, [f.name]: wert } })}
      parameter={parameter}
      gesperrt={gesperrt}
    />
  );
  return (
    <FormularKontext.Provider
      value={{
        parameter,
        variablen: ws
          .getVariableMap()
          .getAllVariables()
          .map((v) => ({ id: v.getId(), name: v.getName() })),
        spalten: [
          ...new Set(spalten.filter((s) => typeof s === 'string' && s.trim() && !s.includes('\0'))),
        ].slice(0, 200),
      }}
    >
      <section className="business-formular">
        <datalist id="business-spalten">
          {[...new Set(spalten)]
            .filter((s) => typeof s === 'string' && s.trim() && !s.includes('\0'))
            .slice(0, 200)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
        {def.schreibt && <p>Verändert Dateien bei echter Ausführung.</p>}
        {Object.entries(def.eingaben).map(([name, typ]) => {
          const titel = businessEingabeTitel(name, typ);
          const referenz = String(objekt(daten.eingaben[name] ?? null).referenz ?? '');
          const quellen = ws.getAllBlocks(false).filter((b) => {
            const quelle = businessNachTyp.get(b.type);
            return (
              b.id !== block.id && quelle?.ausgabe === typ && !('steuerung' in quelle && quelle.steuerung)
            );
          });
          return (
            <Auswahlfeld
              key={name}
              beschriftung={titel}
              value={referenz}
              disabled={gesperrt}
              onChange={(e) =>
                setzen({ ...daten, eingaben: { ...daten.eingaben, [name]: { referenz: e.target.value } } })
              }
            >
              <option value="">{titel} auswählen</option>
              {referenz && !quellen.some((b) => b.id === referenz) && (
                <option value={referenz}>Baustein nicht mehr verfügbar</option>
              )}
              {quellen.map((b) => (
                <option key={b.id} value={b.id}>
                  {String(b.getFieldValue('NAME') ?? businessNachTyp.get(b.type)!.name)}
                </option>
              ))}
            </Auswahlfeld>
          );
        })}
        {def.felder
          .filter((f) => !csvEinstellungen || !['format', 'optionen'].includes(f.name))
          .map(feldAnzeigen)}
        {csvEinstellungen && (
          <details>
            <summary>
              {def.typ === 'sl_biz_lesen_csv' ? 'Importeinstellungen' : 'Ausgabeeinstellungen'}
            </summary>
            <div
              className="business-formular"
              style={{ paddingInlineStart: 'var(--abstand-16)', paddingBlockStart: 'var(--abstand-8)' }}
            >
              {def.felder
                .filter((f) => ['format', 'optionen'].includes(f.name))
                .map((f) =>
                  f.name === 'optionen'
                    ? f.felder!.map((unterfeld) => {
                        const optionen = objekt(daten.konfiguration[f.name] ?? f.standard);
                        return (
                          <KonfigEingabe
                            key={`${f.name}-${unterfeld.name}`}
                            feld={unterfeld}
                            wert={optionen[unterfeld.name] ?? unterfeld.standard}
                            aendern={(wert) =>
                              setzen({
                                ...daten,
                                konfiguration: {
                                  ...daten.konfiguration,
                                  [f.name]: { ...optionen, [unterfeld.name]: wert },
                                },
                              })
                            }
                            parameter={parameter}
                            gesperrt={gesperrt}
                          />
                        );
                      })
                    : feldAnzeigen(f),
                )}
            </div>
          </details>
        )}
        {spalten.length > 0 && (
          <details>
            <summary>Zu den Spaltenvorschlägen</summary>
            <p>
              Die Vorschläge stammen aus der letzten Datenvorschau. Weitere Spaltennamen kannst du direkt
              eingeben.
            </p>
          </details>
        )}
      </section>
    </FormularKontext.Provider>
  );
}
