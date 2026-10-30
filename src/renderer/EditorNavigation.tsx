import { Marke } from './komponenten/Marke';
import { Symbol } from './komponenten/Icon';
import { Menue } from './komponenten/Menue';
import './editor-navigation.css';

type GlobalesZiel = 'start' | 'projekte' | 'beispiele' | 'hilfe';

/** Globale Ziele bleiben von den Arbeitsbereichen des geöffneten Workflows getrennt. */
export function EditorNavigation({
  navigieren,
  einstellungen,
  ueber,
}: {
  navigieren: (ziel: GlobalesZiel) => void;
  einstellungen: () => void;
  ueber: () => void;
}) {
  return (
    <div className="editor-navigation">
      <Marke kompakt />
      <nav aria-label="Globale Navigation" className="editor-navigation-ziele">
        <button type="button" className="editor-navlink" onClick={() => navigieren('start')}>
          <Symbol name="bausteine" />
          <span>Start</span>
        </button>
        <button
          type="button"
          className="editor-navlink"
          aria-current="location"
          onClick={() => navigieren('projekte')}
        >
          <Symbol name="oeffnen" />
          <span>Workflows</span>
        </button>
        <button type="button" className="editor-navlink" onClick={() => navigieren('beispiele')}>
          <Symbol name="buch" />
          <span>Vorlagen</span>
        </button>
        <button
          type="button"
          className="editor-navlink editor-navlink--hilfe"
          onClick={() => navigieren('hilfe')}
        >
          <Symbol name="buch" />
          <span>Hilfe</span>
        </button>
        <button
          type="button"
          className="editor-navlink editor-navlink--unterstuetzung"
          onClick={einstellungen}
        >
          <Symbol name="einstellungen" />
          <span>Einstellungen</span>
        </button>
      </nav>
      <Menue
        beschriftung="Bereiche"
        symbol="unten"
        eintraege={[
          { text: 'Start', aktion: () => navigieren('start') },
          { text: 'Workflows', symbol: 'oeffnen', aktion: () => navigieren('projekte') },
          { text: 'Vorlagen', symbol: 'bausteine', aktion: () => navigieren('beispiele') },
          { text: 'Hilfe', symbol: 'buch', aktion: () => navigieren('hilfe') },
          { text: 'Einstellungen', symbol: 'einstellungen', aktion: einstellungen },
          { text: 'Über ScriptLab', symbol: 'info', aktion: ueber },
        ]}
      />
    </div>
  );
}
