import { useEffect, useState } from 'react';
import * as Blockly from 'blockly/core';
import { Dialog } from './komponenten/Dialog';
import { Feld } from './komponenten/Feld';
import { Knopf } from './komponenten/Knopf';
import { variablenAntwortAusfuehren } from '../editor/eigenschaften';

/** Die vorgesehenen Blockly-Dialogschnittstellen verwenden dieselben zugänglichen App-Dialoge. */
export function Variablendialoge() {
  const [frage, setFrage] = useState<{ text: string; antwort: (wert: string | null) => void } | null>(null);
  const [bestaetigung, setBestaetigung] = useState<{ text: string; antwort: (ja: boolean) => void } | null>(
    null,
  );
  const [wert, setWert] = useState('');
  useEffect(() => {
    Blockly.dialog.setPrompt((text, vorgabe, antwort) => {
      setWert(vorgabe);
      setFrage({ text, antwort });
    });
    Blockly.dialog.setConfirm((text, antwort) => setBestaetigung({ text, antwort }));
    return () => {
      Blockly.dialog.setPrompt();
      Blockly.dialog.setConfirm();
    };
  }, []);
  function antworten(neu: string | null) {
    const callback = frage?.antwort;
    setFrage(null);
    if (callback) variablenAntwortAusfuehren(() => callback(neu));
  }
  function bestaetigen(ja: boolean) {
    const callback = bestaetigung?.antwort;
    setBestaetigung(null);
    if (callback) variablenAntwortAusfuehren(() => callback(ja));
  }
  return (
    <>
      <Dialog
        offen={!!frage}
        titel="Variable bearbeiten"
        onSchliessen={() => antworten(null)}
        fuss={
          <>
            <Knopf onClick={() => antworten(null)}>Abbrechen</Knopf>
            <Knopf variante="primaer" onClick={() => antworten(wert.trim())}>
              Übernehmen
            </Knopf>
          </>
        }
      >
        <p>{frage?.text}</p>
        <Feld
          beschriftung="Variablenname"
          value={wert}
          maxLength={160}
          onChange={(e) => setWert(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              antworten(wert.trim());
            }
          }}
        />
      </Dialog>
      <Dialog
        offen={!!bestaetigung}
        titel="Änderung bestätigen"
        onSchliessen={() => bestaetigen(false)}
        fuss={
          <>
            <Knopf onClick={() => bestaetigen(false)}>Abbrechen</Knopf>
            <Knopf variante="gefahr" onClick={() => bestaetigen(true)}>
              Löschen
            </Knopf>
          </>
        }
      >
        <p>{bestaetigung?.text}</p>
      </Dialog>
    </>
  );
}
