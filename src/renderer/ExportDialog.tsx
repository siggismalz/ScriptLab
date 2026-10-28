import { useEffect, useState } from 'react';
import type { Projekt } from '../kern/projekt';
import { Dialog } from './komponenten/Dialog';
import { Knopf } from './komponenten/Knopf';
import { Auswahlfeld } from './komponenten/Feld';
import { businessSchritte } from '../kern/business';

export function ExportDialog({
  offen,
  projekt,
  schliessen,
  projektSpeichern,
  exportieren,
}: {
  offen: boolean;
  projekt: Projekt;
  schliessen: () => void;
  projektSpeichern: () => void;
  exportieren: () => void;
}) {
  const business = businessSchritte(projekt).length > 0;
  const [format, setFormat] = useState('script');
  useEffect(() => {
    if (offen) setFormat(business ? 'paket' : 'script');
  }, [offen, business]);
  return (
    <Dialog
      offen={offen}
      titel="Exportieren"
      onSchliessen={schliessen}
      beschreibung={`Workflow: ${projekt.name}`}
      fuss={
        <>
          <Knopf onClick={schliessen}>Abbrechen</Knopf>
          <Knopf
            variante="primaer"
            symbol="exportieren"
            onClick={() => {
              schliessen();
              if (format === 'projekt') projektSpeichern();
              else exportieren();
            }}
          >
            Ausgabeort auswählen
          </Knopf>
        </>
      }
    >
      <Auswahlfeld beschriftung="Inhalt" value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="projekt">Projektdatei (.scriptlab) · weiterbearbeiten</option>
        <option value="script" disabled={business}>
          {projekt.skriptsprache === 'python' ? 'Python-Script (.py)' : 'VBS-Script (.vbs)'}
          {business ? ' · benötigt Business-Paket' : ''}
        </option>
        <option value="paket" disabled={!business}>
          Business-Paket (.zip){!business ? ' · nur für Workflows mit Business-Bausteinen' : ''}
        </option>
      </Auswahlfeld>
      <section className="export-inhalt">
        {format === 'projekt' ? (
          <p>
            Bausteine, Konfiguration und Parameter als bearbeitbare Projektdatei. Quelldateien bleiben
            separat.
          </p>
        ) : format === 'paket' ? (
          <p>
            Python-Script, Business-Module, Parameter und Anleitung als ZIP. Weitere Dateien wählst du im
            nächsten Schritt aus. Ein Python-Interpreter ist nicht enthalten.
          </p>
        ) : (
          <p>Der erzeugte Quelltext als {projekt.skriptsprache === 'python' ? 'Python' : 'VBS'}-Datei.</p>
        )}
        <details>
          <summary>Voraussetzungen und Hinweise</summary>
          {format === 'projekt' ? (
            <p>
              Die exportierte Kopie lässt sich in ScriptLab öffnen. Dein gespeicherter Workflow bleibt
              erhalten.
            </p>
          ) : format === 'paket' ? (
            <>
              <p>
                Zum Ausführen außerhalb von ScriptLab benötigt der Zielcomputer Python und die in der
                Anleitung genannten Pakete. Der Export richtet dort keine Umgebung ein. Quellen und
                Dokumentvorlagen werden nur nach deiner Auswahl aufgenommen.
              </p>
              <p>Paketsignaturen werden nicht unterstützt.</p>
            </>
          ) : (
            <>
              <p>Die Ausführung verwendet die Dateien, Pfade und Programme des Zielcomputers.</p>
              <p>
                {projekt.skriptsprache === 'python'
                  ? 'Zum Ausführen außerhalb von ScriptLab benötigt der Zielcomputer Python. Python-Scripts werden hier nicht signiert.'
                  : projekt.exportOptionen.signieren
                    ? 'Die eingerichtete Windows-Codesignatur wird angewendet.'
                    : 'VBS-Export ohne Signatur. Eine Codesignatur lässt sich in den Einstellungen einrichten.'}
              </p>
            </>
          )}
        </details>
      </section>
    </Dialog>
  );
}
