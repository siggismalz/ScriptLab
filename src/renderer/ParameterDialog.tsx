import { useState, useEffect, useRef } from 'react';
import { Dialog } from './komponenten/Dialog';
import { Feld, Auswahlfeld, Textfeld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import {
  businessProjektPruefen,
  parameterWertePruefen,
  type BusinessProjekt,
  type WorkflowParameter,
} from '../kern/business-modell';
import {
  parameterAenderungenVorbereiten,
  type ParameterBearbeitung,
  type ParameterUmbenennungen,
} from '../kern/parameterAendern';
import './business.css';

type ParameterWert = WorkflowParameter['standard'];

/** Nur die bewusste Formulareingabe wird umgewandelt; ungültige Entwürfe bleiben sichtbar. */
export function parameterWertAusText(typ: WorkflowParameter['typ'], eingabe: string): ParameterWert {
  if (typ !== 'Zahl') return eingabe;
  const text = eingabe.trim();
  if (!text) return null;
  if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) {
    const zahl = Number(text.replace(',', '.'));
    if (Number.isFinite(zahl)) return zahl;
  }
  return eingabe;
}

export function parameterTypWechseln(p: WorkflowParameter, typ: WorkflowParameter['typ']): WorkflowParameter {
  let standard: ParameterWert = p.standard;
  if (typ === 'Wahrheitswert') {
    if (typeof standard !== 'boolean') {
      const wert = String(standard ?? '')
        .trim()
        .toLowerCase();
      standard = ['ja', 'wahr', 'true'].includes(wert)
        ? true
        : ['nein', 'falsch', 'false'].includes(wert)
          ? false
          : null;
    }
  } else if (typ === 'Zahl') {
    standard = parameterWertAusText(typ, String(standard ?? ''));
    if (typeof standard !== 'number') standard = null;
  } else if (standard !== null) standard = String(standard);
  try {
    standard = parameterWertePruefen([{ ...p, typ, erforderlich: false }], { [p.name]: standard })[p.name];
  } catch {
    standard = null;
  }
  return { ...p, typ, standard };
}

export function parameterDialogPruefen(business: BusinessProjekt): BusinessProjekt {
  const geprueft = businessProjektPruefen(business);
  const parameter = geprueft.parameter.map((p) => {
    const standard =
      p.typ === 'Zahl' && typeof p.standard === 'string'
        ? parameterWertAusText(p.typ, p.standard)
        : p.standard;
    // Eine Pflichtangabe braucht keinen Standard: sie darf erst vor dem Lauf befüllt werden.
    const normal = parameterWertePruefen([{ ...p, erforderlich: false }], { [p.name]: standard });
    return { ...p, standard: normal[p.name] };
  });
  const namen = new Set(parameter.map((p) => p.name));
  const filtern = (werte: BusinessProjekt['parametersaetze']['test']) =>
    Object.fromEntries(Object.entries(werte).filter(([name]) => namen.has(name)));
  return {
    ...geprueft,
    parameter,
    parametersaetze: {
      test: filtern(geprueft.parametersaetze.test),
      echt: filtern(geprueft.parametersaetze.echt),
    },
  };
}

export function ParameterWertEingabe({
  typ,
  wert,
  aendern,
  beschriftung,
  hilfe,
  gesperrt = false,
}: {
  typ: WorkflowParameter['typ'];
  wert: ParameterWert;
  aendern: (wert: ParameterWert) => void;
  beschriftung: string;
  hilfe?: string;
  gesperrt?: boolean;
}) {
  const [beruehrt, setBeruehrt] = useState(false);
  // Nur der sichtbare Tippentwurf bleibt lokal, etwa das Komma in „12,“.
  // Vollständige Zahleneingaben erreichen den Aufrufer sofort als Zahl.
  const [tipptext, setTipptext] = useState(String(wert ?? ''));
  const bearbeitet = useRef(false);
  const ungueltigeZahl =
    typ === 'Zahl' &&
    typeof wert === 'string' &&
    wert.trim() !== '' &&
    typeof parameterWertAusText(typ, wert) !== 'number';
  if (typ === 'Wahrheitswert')
    return (
      <Auswahlfeld
        beschriftung={beschriftung}
        hilfe={hilfe}
        value={wert === true ? 'ja' : wert === false ? 'nein' : ''}
        disabled={gesperrt}
        onChange={(e) => aendern(e.target.value === 'ja' ? true : e.target.value === 'nein' ? false : null)}
      >
        <option value="">Bitte auswählen</option>
        <option value="ja">Ja</option>
        <option value="nein">Nein</option>
      </Auswahlfeld>
    );
  return (
    <Feld
      beschriftung={beschriftung}
      value={bearbeitet.current ? tipptext : String(wert ?? '')}
      disabled={gesperrt}
      inputMode={typ === 'Zahl' || typ === 'Dezimalbetrag' ? 'decimal' : undefined}
      fehler={beruehrt && ungueltigeZahl ? 'Gib eine gültige Zahl ein, zum Beispiel 12,5.' : undefined}
      hilfe={
        [
          hilfe,
          typ === 'Zahl'
            ? 'Zahl mit Komma oder Punkt, zum Beispiel 12,5. Leer bleibt ohne Wert.'
            : typ === 'Dezimalbetrag'
              ? 'Exakter Betrag mit Punkt, zum Beispiel 12.50.'
              : typ === 'Datum'
                ? 'Datum im Format JJJJ-MM-TT.'
                : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      onFocus={(e) => {
        bearbeitet.current = true;
        setTipptext(e.target.value);
      }}
      onChange={(e) => {
        setTipptext(e.target.value);
        aendern(parameterWertAusText(typ, e.target.value));
      }}
      onBlur={(e) => {
        bearbeitet.current = false;
        setBeruehrt(true);
        aendern(parameterWertAusText(typ, e.target.value));
      }}
    />
  );
}

export function ParameterDialog({
  offen,
  business,
  speichern,
  schliessen,
}: {
  offen: boolean;
  business: BusinessProjekt;
  speichern: (b: BusinessProjekt, umbenennungen?: ParameterUmbenennungen) => void;
  schliessen: () => void;
}) {
  const [entwurf, setEntwurf] = useState(business),
    [fehler, setFehler] = useState('');
  const naechsteZeile = useRef(business.parameter.length);
  const formular = useRef<HTMLDivElement>(null);
  const [zeilen, setZeilen] = useState<(ParameterBearbeitung & { id: number })[]>(() =>
    business.parameter.map((parameter, id) => ({ id, ursprungsname: parameter.name, parameter })),
  );
  useEffect(() => {
    if (offen) {
      setEntwurf(structuredClone(business));
      setZeilen(
        business.parameter.map((parameter) => ({
          id: naechsteZeile.current++,
          ursprungsname: parameter.name,
          parameter: structuredClone(parameter),
        })),
      );
      setFehler('');
    }
  }, [offen]);
  const setzen = (id: number, parameter: WorkflowParameter) =>
    setZeilen((aktuell) => aktuell.map((zeile) => (zeile.id === id ? { ...zeile, parameter } : zeile)));
  return (
    <Dialog
      offen={offen}
      titel="Workflowparameter"
      onSchliessen={schliessen}
      beschreibung="Einmal definieren und vor jedem Lauf passend befüllen. Testdaten und echte Daten bleiben getrennt. Keine Zugangsdaten in Projektparametern speichern."
      fuss={
        <>
          <Knopf onClick={schliessen}>Abbrechen</Knopf>
          <Knopf
            variante="primaer"
            onClick={() => {
              try {
                const uebernahme = parameterAenderungenVorbereiten(entwurf, zeilen);
                speichern(parameterDialogPruefen(uebernahme.business), uebernahme.umbenennungen);
                schliessen();
              } catch (e) {
                setFehler(e instanceof Error ? e.message : 'Prüfe die Parameter.');
                requestAnimationFrame(() => {
                  formular.current?.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
                    details.open = true;
                  });
                });
              }
            }}
          >
            Übernehmen
          </Knopf>
        </>
      }
    >
      <div ref={formular} className="business-parameter">
        {fehler && <p role="alert">{fehler}</p>}
        {zeilen.map(({ id, parameter: p }, i) => (
          <fieldset key={id}>
            <legend>{p.beschriftung.trim() || `Parameter ${i + 1}`}</legend>
            <Feld
              beschriftung="Bezeichnung"
              value={p.beschriftung}
              onChange={(e) => setzen(id, { ...p, beschriftung: e.target.value })}
            />
            <Auswahlfeld
              beschriftung="Wertart"
              hilfe="Ein passender Standardwert bleibt erhalten. Ein unpassender Standardwert wird beim Typwechsel geleert."
              value={p.typ}
              onChange={(e) =>
                setzen(id, parameterTypWechseln(p, e.target.value as WorkflowParameter['typ']))
              }
            >
              {[
                'Datei',
                'Text',
                'Zahl',
                'Dezimalbetrag',
                'Datum',
                'Wahrheitswert',
                'Dokument',
                'Dokumentvorlage',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Auswahlfeld>
            <label className="business-checkbox">
              <input
                type="checkbox"
                checked={p.erforderlich}
                onChange={(e) => setzen(id, { ...p, erforderlich: e.target.checked })}
              />
              Pflichtangabe
            </label>
            <ParameterWertEingabe
              beschriftung="Standardwert"
              typ={p.typ}
              wert={p.standard}
              aendern={(standard) => setzen(id, { ...p, standard })}
            />
            <details className="business-parameterdetails">
              <summary>Weitere Angaben</summary>
              <Feld
                beschriftung="Interner Name"
                hilfe="Beginnt mit einem Buchstaben, danach Buchstaben, Zahlen oder Unterstriche. Bestehende Verweise werden beim Umbenennen mitgeführt."
                value={p.name}
                onChange={(e) => setzen(id, { ...p, name: e.target.value })}
              />
              <Textfeld
                beschriftung="Kurze Hilfe"
                value={p.hilfe}
                onChange={(e) => setzen(id, { ...p, hilfe: e.target.value })}
              />
              <Knopf
                variante="leise"
                onClick={() => setZeilen((aktuell) => aktuell.filter((zeile) => zeile.id !== id))}
              >
                Parameter entfernen
              </Knopf>
            </details>
          </fieldset>
        ))}
        <Knopf
          onClick={() => {
            const id = naechsteZeile.current++;
            setZeilen((aktuell) => {
              const belegt = new Set(aktuell.map((zeile) => zeile.parameter.name.toLowerCase()));
              let nummer = 1;
              while (belegt.has(`parameter${nummer}`)) nummer++;
              return [
                ...aktuell,
                {
                  id,
                  ursprungsname: null,
                  parameter: {
                    name: `Parameter${nummer}`,
                    beschriftung: 'Neuer Parameter',
                    typ: 'Text',
                    erforderlich: true,
                    standard: '',
                    hilfe: '',
                  },
                },
              ];
            });
          }}
        >
          Parameter hinzufügen
        </Knopf>
      </div>
    </Dialog>
  );
}
