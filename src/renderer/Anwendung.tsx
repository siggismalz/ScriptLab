import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import { bausteinKatalog, registriereBausteine, werkzeugkasten } from '../editor/bausteine';
import { neuesProjekt, type Projekt } from '../kern/projekt';
import { vbsErzeugen } from '../kern/generator';
import type { Antwort, Dokument, Einstellungen, ExportErgebnis } from '../gemeinsam/bruecke';
import type { Zertifikat } from '../windows/signatur';
import type { UpdateZustand } from '../windows/updates';

registriereBausteine();
const thema = Blockly.Theme.defineTheme('scriptlab', {
  name: 'scriptlab',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#131823',
    toolboxBackgroundColour: '#171d2a',
    toolboxForegroundColour: '#e0e6f4',
    flyoutBackgroundColour: '#202839',
    flyoutForegroundColour: '#edf1fa',
    flyoutOpacity: 1,
    scrollbarColour: '#62708a',
    insertionMarkerColour: '#ffffff',
    insertionMarkerOpacity: 0.6,
    cursorColour: '#a5b4fc',
  },
  fontStyle: { family: 'Segoe UI, sans-serif', weight: '500', size: 12 },
});

export function Anwendung() {
  const element = useRef<HTMLDivElement>(null);
  const arbeitsbereich = useRef<Blockly.WorkspaceSvg | null>(null);
  const projektRef = useRef(neuesProjekt());
  const laedt = useRef(false);
  const beschaeftigtRef = useRef(false);
  const [projekt, setProjekt] = useState(projektRef.current);
  const [datei, setDatei] = useState<string | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [vorschau, setVorschau] = useState(true);
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('Bausteine verbinden, prüfen und als VBS speichern.');
  const [fehler, setFehler] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [dialog, setDialog] = useState<'einstellungen' | 'ueber' | null>(null);
  const [einstellungen, setEinstellungen] = useState<Einstellungen>({
    automatischeUpdates: false,
    vorabversionen: false,
  });
  const [version, setVersion] = useState('0.1.0');
  const [zertifikate, setZertifikate] = useState<Zertifikat[]>([]);
  const [update, setUpdate] = useState<UpdateZustand | null>(null);
  const [exportiert, setExportiert] = useState<ExportErgebnis | null>(null);
  const ergebnis = useMemo(() => vbsErzeugen(projekt), [projekt]);
  const ausgewaehlterBlock = auswahl
    ? bausteinKatalog.find((b) => b.typ === arbeitsbereich.current?.getBlockById(auswahl)?.type)
    : undefined;

  function antwort<T>(wert: Antwort<T>): T {
    if (!wert.ok) throw new Error(wert.meldung);
    return wert.wert;
  }
  async function aktion(funktion: () => Promise<void>) {
    if (beschaeftigtRef.current) return;
    beschaeftigtRef.current = true;
    setBeschaeftigt(true);
    try {
      await funktion();
    } catch (problem) {
      setFehler(true);
      setMeldung(
        problem instanceof Error ? problem.message : 'Der Vorgang konnte nicht abgeschlossen werden.',
      );
    } finally {
      beschaeftigtRef.current = false;
      setBeschaeftigt(false);
    }
  }
  function aendern(neu: Projekt) {
    if (JSON.stringify(neu) === JSON.stringify(projektRef.current)) return;
    projektRef.current = neu;
    setProjekt(neu);
    setGeaendert(true);
    setExportiert(null);
    void window.scriptlab.aendern(neu).then((r) => {
      if (!r.ok) {
        setFehler(true);
        setMeldung(r.meldung);
      }
    });
  }
  function standLesen(): Projekt {
    const ws = arbeitsbereich.current;
    return ws
      ? ({
          ...projektRef.current,
          editor: Blockly.serialization.workspaces.save(ws),
          ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY },
        } as Projekt)
      : projektRef.current;
  }
  async function dokumentLaden(neu: Dokument) {
    laedt.current = true;
    try {
      const ws = arbeitsbereich.current!;
      Blockly.serialization.workspaces.load(neu.projekt.editor, ws);
      ws.setScale(neu.projekt.ansicht.zoom);
      ws.scroll(neu.projekt.ansicht.x, neu.projekt.ansicht.y);
      ws.clearUndo();
      // Blockly ergänzt nur technische Standardwerte und Schattenkennungen.
      const stand = {
        ...neu.projekt,
        editor: Blockly.serialization.workspaces.save(ws),
        ansicht: { zoom: ws.scale, x: ws.scrollX, y: ws.scrollY },
      } as Projekt;
      projektRef.current = stand;
      setProjekt(stand);
      setDatei(neu.dateiname);
      setGeaendert(neu.geaendert);
      setAuswahl(null);
      setExportiert(null);
      antwort(await window.scriptlab.darstellungBereit(stand));
    } finally {
      laedt.current = false;
    }
  }
  async function projektAktion(art: 'neu' | 'oeffnen' | 'speichern' | 'unter') {
    await aktion(async () => {
      const stand = standLesen();
      const r =
        art === 'neu'
          ? await window.scriptlab.neu(stand)
          : art === 'oeffnen'
            ? await window.scriptlab.oeffnen(stand)
            : await window.scriptlab.speichern(stand, art === 'unter');
      const neu = antwort(r);
      if (neu) {
        if (art === 'neu' || art === 'oeffnen') await dokumentLaden(neu);
        else {
          setDatei(neu.dateiname);
          setGeaendert(neu.geaendert);
        }
        setFehler(false);
        setMeldung(
          art === 'neu'
            ? 'Ein neues Projekt ist bereit.'
            : art === 'oeffnen'
              ? 'Das Projekt wurde geöffnet.'
              : 'Das Projekt wurde gespeichert.',
        );
      } else {
        // Ein vorgeschaltetes Speichern kann trotz anschließendem Dialogabbruch erfolgreich sein.
        const aktuell = antwort(await window.scriptlab.laden()).dokument;
        setDatei(aktuell.dateiname);
        setGeaendert(aktuell.geaendert);
      }
    });
  }
  async function exportieren() {
    await aktion(async () => {
      const neu = antwort(await window.scriptlab.exportieren(standLesen()));
      if (!neu) return;
      setExportiert(neu);
      setFehler(neu.signatur.status === 'vertrauen-offen');
      setMeldung('Das Script wurde gespeichert. Du kannst es außerhalb von ScriptLab selbst ausführen.');
    });
  }
  function blockAktion(art: 'kopieren' | 'einfuegen' | 'duplizieren' | 'loeschen') {
    const ws = arbeitsbereich.current;
    const block = ws?.getBlockById(auswahl || '');
    if (!ws) return;
    if (art === 'einfuegen') {
      const daten = Blockly.clipboard.getLastCopiedData();
      if (daten) Blockly.clipboard.paste(daten, ws);
      return;
    }
    if (!block) return;
    if (art === 'loeschen') {
      block.dispose(true);
      return;
    }
    const daten = Blockly.clipboard.copy(block);
    if (art === 'duplizieren' && daten) Blockly.clipboard.paste(daten, ws);
  }
  async function updateAktion(art: 'status' | 'pruefen' | 'laden' | 'installieren') {
    await aktion(async () => {
      setUpdate(antwort(await window.scriptlab.updateAktion(art)) as UpdateZustand);
    });
  }

  useEffect(() => {
    const ws = Blockly.inject(element.current!, {
      toolbox: werkzeugkasten,
      theme: thema,
      renderer: 'zelos',
      media: 'scriptlab://app/media/',
      grid: { spacing: 24, length: 2, colour: '#344056', snap: true },
      zoom: { controls: false, wheel: true, startScale: 1, maxScale: 3, minScale: 0.2, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
      sounds: false,
      maxBlocks: 2000,
    });
    arbeitsbereich.current = ws;
    const geaendert = (event: Blockly.Events.Abstract) => {
      if (laedt.current) return;
      if (event.type === Blockly.Events.SELECTED) {
        setAuswahl((event as Blockly.Events.Selected).newElementId ?? null);
        return;
      }
      if (event.isUiEvent && event.type !== Blockly.Events.VIEWPORT_CHANGE) return;
      aendern(standLesen());
    };
    ws.addChangeListener(geaendert);
    const groesse = new ResizeObserver(() => Blockly.svgResize(ws));
    groesse.observe(element.current!);
    void aktion(async () => {
      const start = antwort(await window.scriptlab.laden());
      setVersion(start.version);
      setEinstellungen(start.einstellungen);
      await dokumentLaden(start.dokument);
    });
    const abmelden = window.scriptlab.beiStandAnfrage(standLesen);
    return () => {
      abmelden();
      groesse.disconnect();
      ws.dispose();
    };
  }, []);

  useEffect(() => {
    const ws = arbeitsbereich.current;
    if (!ws) return;
    for (const block of ws.getAllBlocks(false)) {
      const meldungen = ergebnis.meldungen
        .filter((m) => m.blockId === block.id && m.stufe === 'fehler')
        .map((m) => m.text);
      block.setWarningText(meldungen.length ? meldungen.join('\n') : null, 'validierung');
    }
  }, [ergebnis]);
  useEffect(() => {
    const ws = arbeitsbereich.current;
    if (!ws) return;
    const text = suche.trim().toLocaleLowerCase('de');
    if (!text) {
      ws.updateToolbox(werkzeugkasten);
      return;
    }
    const treffer = new Set(
      bausteinKatalog
        .filter((b) => `${b.name} ${b.kategorie} ${b.hilfe}`.toLocaleLowerCase('de').includes(text))
        .map((b) => b.typ),
    );
    const kasten = structuredClone(werkzeugkasten) as {
      kind: string;
      contents: Array<{ kind: string; name: string; contents: Array<{ type: string }> }>;
    };
    kasten.contents = kasten.contents
      .map((k) => ({ ...k, contents: k.contents.filter((b) => treffer.has(b.type)) }))
      .filter((k) => k.contents.length);
    ws.updateToolbox(kasten);
  }, [suche]);
  useEffect(() => {
    if (dialog !== 'einstellungen') return;
    void window.scriptlab.updateAktion('status').then((r) => {
      if (r.ok) setUpdate(r.wert as UpdateZustand);
    });
    const timer = setInterval(() => {
      void window.scriptlab.updateAktion('status').then((r) => {
        if (r.ok) setUpdate(r.wert as UpdateZustand);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [dialog]);
  useEffect(() => {
    const tasten = (event: KeyboardEvent) => {
      const ziel = event.target as HTMLElement;
      if (ziel.matches('input,textarea,select') || ziel.isContentEditable || dialog) return;
      if (event.ctrlKey && ['s', 'o', 'n'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        void projektAktion(
          event.key.toLowerCase() === 's'
            ? event.shiftKey
              ? 'unter'
              : 'speichern'
            : event.key.toLowerCase() === 'o'
              ? 'oeffnen'
              : 'neu',
        );
      }
      if (event.ctrlKey && ['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0') arbeitsbereich.current?.setScale(1);
        else arbeitsbereich.current?.zoomCenter(event.key === '-' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', tasten);
    return () => window.removeEventListener('keydown', tasten);
  }, [dialog]);

  return (
    <div className="anwendung">
      <header className="kopf">
        <div className="marke">
          <span className="markensymbol" aria-hidden="true">
            S
          </span>
          <div>
            <strong>ScriptLab</strong>
            <small>Dein Ablauf. Deine Bausteine.</small>
          </div>
        </div>
        <div className="projekttitel">
          <label htmlFor="projektname">PROJEKT</label>
          <input
            id="projektname"
            aria-label="Projektname"
            value={projekt.name}
            maxLength={160}
            onChange={(e) => aendern({ ...projektRef.current, name: e.target.value || 'Mein Workflow' })}
          />
          <span className="speicherpunkt">{geaendert ? '● Ungespeichert' : '✓ Gespeichert'}</span>
        </div>
        <button className="leise" onClick={() => setDialog('einstellungen')}>
          Einstellungen
        </button>
        <button className="leise" onClick={() => setDialog('ueber')}>
          Über ScriptLab
        </button>
      </header>
      <nav className="werkzeuge" aria-label="Projektaktionen">
        <div className="knopfgruppe">
          <button disabled={beschaeftigt} onClick={() => void projektAktion('neu')}>
            ＋ Neu
          </button>
          <button disabled={beschaeftigt} onClick={() => void projektAktion('oeffnen')}>
            Öffnen
          </button>
          <button disabled={beschaeftigt} onClick={() => void projektAktion('speichern')}>
            Speichern
          </button>
          <button disabled={beschaeftigt} onClick={() => void projektAktion('unter')}>
            Speichern unter
          </button>
        </div>
        <div className="knopfgruppe">
          <button title="Strg+Z" onClick={() => arbeitsbereich.current?.undo(false)}>
            ↶ Rückgängig
          </button>
          <button title="Strg+Y" onClick={() => arbeitsbereich.current?.undo(true)}>
            ↷ Wiederholen
          </button>
          <button aria-pressed={vorschau} onClick={() => setVorschau(!vorschau)}>
            Codevorschau
          </button>
        </div>
        <button className="primaer" disabled={beschaeftigt} onClick={() => void exportieren()}>
          Als VBS exportieren ↗
        </button>
      </nav>
      <main className={`inhalt ${vorschau ? 'mit-vorschau' : ''}`}>
        <section className="editorbereich" aria-label="Visueller Workfloweditor">
          <div className="editorleiste">
            <label className="suche">
              ⌕{' '}
              <input
                aria-label="Bausteine suchen"
                placeholder="Bausteine suchen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </label>
            <span className="hinweis">Verbinde die Bausteine ab „Workflow starten“.</span>
            <span className="etikett">NUR ERSTELLEN & EXPORTIEREN</span>
          </div>
          <div ref={element} className="blockly-editor" data-testid="arbeitsbereich" />
          <div className="editorfuss">
            <div className="knopfgruppe">
              <button onClick={() => blockAktion('kopieren')}>Kopieren</button>
              <button onClick={() => blockAktion('einfuegen')}>Einfügen</button>
              <button onClick={() => blockAktion('duplizieren')}>Duplizieren</button>
              <button onClick={() => blockAktion('loeschen')}>Löschen</button>
            </div>
            <div className="knopfgruppe zoom">
              <button aria-label="Verkleinern" onClick={() => arbeitsbereich.current?.zoomCenter(-1)}>
                −
              </button>
              <button
                title="Auf 100 Prozent zurücksetzen"
                onClick={() => arbeitsbereich.current?.setScale(1)}
              >
                {Math.round(projekt.ansicht.zoom * 100)} %
              </button>
              <button aria-label="Vergrößern" onClick={() => arbeitsbereich.current?.zoomCenter(1)}>
                ＋
              </button>
              <button onClick={() => arbeitsbereich.current?.zoomToFit()}>Einpassen</button>
            </div>
          </div>
        </section>
        {vorschau && (
          <aside className="seitenpanel" aria-label="Codevorschau und Bausteinhilfe">
            <div className="panelkopf">
              <div>
                <span className="augenbraue">VORSCHAU</span>
                <h2>Dein VBScript</h2>
              </div>
              <span className="dateityp">.vbs</span>
            </div>
            <p className="panelbeschreibung">
              Wird aus deinen Bausteinen erzeugt. Diese Vorschau führt keine Aktionen aus.
            </p>
            <pre className="code" tabIndex={0} aria-label="Schreibgeschützte VBS-Codevorschau">
              {ergebnis.code ?? "' Bitte zuerst die markierten Bausteine vervollständigen."}
            </pre>
            <section className="blockhilfe">
              <h3>{ausgewaehlterBlock?.name || 'So geht’s'}</h3>
              <p>
                {ausgewaehlterBlock?.hilfe ||
                  'Wähle links eine Kategorie. Ziehe einen Baustein in den Arbeitsbereich und verbinde ihn mit deinem Ablauf. Werte passen in die passenden Eingaben.'}
              </p>
              <label>
                Projektbeschreibung
                <textarea
                  value={projekt.beschreibung}
                  maxLength={10000}
                  onChange={(e) => aendern({ ...projektRef.current, beschreibung: e.target.value })}
                  placeholder="Was soll dein Workflow später tun?"
                />
              </label>
            </section>
          </aside>
        )}
      </main>
      <section className={`meldungen ${fehler ? 'fehler' : ''}`} aria-live="polite">
        <span>{beschaeftigt ? 'Bitte warten …' : meldung}</span>
        {exportiert && (
          <>
            <strong>{exportiert.signatur.meldung}</strong>
            <button
              onClick={() =>
                void aktion(async () => {
                  antwort(await window.scriptlab.exportOrdnerAnzeigen());
                })
              }
            >
              Speicherordner anzeigen
            </button>
          </>
        )}
      </section>
      {ergebnis.meldungen.length > 0 && (
        <div className="validierung" aria-label="Validierungshinweise">
          {ergebnis.meldungen.map((m, i) => (
            <button
              key={i}
              className={m.stufe}
              onClick={() => {
                if (m.blockId) {
                  arbeitsbereich.current?.getBlockById(m.blockId)?.select();
                  arbeitsbereich.current?.centerOnBlock(m.blockId);
                }
              }}
            >
              {m.stufe === 'fehler' ? '⚠' : 'ⓘ'} {m.text}
            </button>
          ))}
        </div>
      )}
      <footer>
        <span>
          {datei || 'Neues Projekt'} ·{' '}
          {geaendert ? 'Ungespeicherte Änderungen' : 'Keine ungespeicherten Änderungen'}
        </span>
        <span>
          {ergebnis.meldungen.filter((m) => m.stufe === 'fehler').length
            ? 'Bitte Hinweise prüfen'
            : '✓ Workflow ist bereit für den Export'}{' '}
          · Windows 11 x64
        </span>
        <span>Entwickelt von Leon Stolz</span>
      </footer>
      {dialog && (
        <div
          className="modalhintergrund"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDialog(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={dialog === 'ueber' ? 'Über ScriptLab' : 'Einstellungen'}
            className="modal"
          >
            <button
              autoFocus
              className="schliessen"
              aria-label="Dialog schließen"
              onClick={() => setDialog(null)}
            >
              ×
            </button>
            {dialog === 'ueber' ? (
              <>
                <span className="augenbraue">VISUELL GESTALTEN</span>
                <h1>ScriptLab</h1>
                <p>Version {version} · Windows 11 x64</p>
                <p>
                  <strong>Entwickelt von Leon Stolz</strong>
                </p>
                <p>
                  ScriptLab erstellt und exportiert Workflows. Die Ausführung übernimmst du selbst außerhalb
                  dieser Anwendung.
                </p>
                <p>
                  VBScript ist von Microsoft abgekündigt. Die spätere Ausführung hängt von der
                  Windows-VBScript-Komponente und deinen Richtlinien ab.
                </p>
                <p>Mit Electron, React, Vite und Blockly. Lizenzhinweise liegen der Installation bei.</p>
              </>
            ) : (
              <>
                <h1>Einstellungen</h1>
                <h2>VBS-Export signieren</h2>
                <label className="schalter">
                  <input
                    type="checkbox"
                    checked={projekt.exportOptionen.signieren}
                    onChange={(e) =>
                      aendern({
                        ...projektRef.current,
                        exportOptionen: { ...projektRef.current.exportOptionen, signieren: e.target.checked },
                      })
                    }
                  />{' '}
                  Exportierte Datei signieren
                </label>
                <p>
                  Optional: Du benötigst ein gültiges Code-Signing-Zertifikat mit privatem Schlüssel im
                  Windows-Zertifikatspeicher.
                </p>
                <button
                  onClick={() =>
                    void aktion(async () => {
                      const liste = antwort(await window.scriptlab.zertifikate());
                      setZertifikate(liste);
                      setFehler(false);
                      setMeldung(
                        liste.length
                          ? `${liste.length} geeignete Zertifikate gefunden.`
                          : 'Kein geeignetes Zertifikat gefunden. Ein unsignierter Export ist weiterhin möglich.',
                      );
                    })
                  }
                >
                  Zertifikate laden
                </button>
                <label>
                  Zertifikat
                  <select
                    value={projekt.exportOptionen.zertifikatFingerabdruck}
                    onChange={(e) =>
                      aendern({
                        ...projektRef.current,
                        exportOptionen: {
                          ...projektRef.current.exportOptionen,
                          zertifikatFingerabdruck: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Bitte auswählen</option>
                    {projekt.exportOptionen.zertifikatFingerabdruck &&
                      !zertifikate.some(
                        (z) => z.fingerabdruck === projekt.exportOptionen.zertifikatFingerabdruck,
                      ) && (
                        <option value={projekt.exportOptionen.zertifikatFingerabdruck}>
                          Gespeicherte Auswahl: {projekt.exportOptionen.zertifikatFingerabdruck}
                        </option>
                      )}
                    {zertifikate.map((z) => (
                      <option key={z.fingerabdruck} value={z.fingerabdruck}>
                        {z.betreff} · {z.fingerabdruck}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zeitstempeldienst (optional)
                  <input
                    value={projekt.exportOptionen.zeitstempelUrl}
                    placeholder="http://…"
                    onChange={(e) =>
                      aendern({
                        ...projektRef.current,
                        exportOptionen: {
                          ...projektRef.current.exportOptionen,
                          zeitstempelUrl: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <p className="klein">
                  Windows PowerShell unterstützt für diesen optionalen Authenticode-Zeitstempel nur HTTP. Eine
                  Signatur hilft, Herausgeber und Änderungen zu prüfen. Sie garantiert keine Ungefährlichkeit
                  und verhindert keine Windows-Warnungen.
                </p>
                <h2>Anwendungsupdates</h2>
                <p>
                  Installiert: {version}
                  {update?.verfuegbareVersion ? ` · Verfügbar: ${update.verfuegbareVersion}` : ''}
                </p>
                {(['automatischeUpdates', 'vorabversionen'] as const).map((key) => (
                  <label key={key} className="schalter">
                    <input
                      type="checkbox"
                      checked={einstellungen[key]}
                      onChange={(e) =>
                        void aktion(async () => {
                          const neu = { ...einstellungen, [key]: e.target.checked };
                          setEinstellungen(antwort(await window.scriptlab.einstellungenSpeichern(neu)));
                        })
                      }
                    />
                    {key === 'automatischeUpdates'
                      ? 'Automatisch nach Updates suchen'
                      : 'Vorabversionen bewusst zulassen'}
                  </label>
                ))}
                <p>{update?.meldung}</p>
                {update?.phase === 'laedt' && <progress value={update.fortschritt} max={100} />}
                <div className="knopfgruppe">
                  <button disabled={beschaeftigt} onClick={() => void updateAktion('pruefen')}>
                    Nach Updates suchen
                  </button>
                  {update?.phase === 'verfuegbar' && (
                    <button onClick={() => void updateAktion('laden')}>Update herunterladen</button>
                  )}
                  {update?.phase === 'bereit-zur-installation' && (
                    <button onClick={() => void updateAktion('installieren')}>
                      Installieren und neu starten
                    </button>
                  )}
                </div>
                {update?.aenderungen && <pre className="aenderungen">{update.aenderungen}</pre>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
