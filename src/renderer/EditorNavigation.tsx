import { Marke } from './komponenten/Marke';
import { Symbol, type SymbolName } from './komponenten/Icon';
import './editor-navigation.css';

type GlobalesZiel = 'start' | 'projekte' | 'beispiele' | 'hilfe';
const hauptziele: { id: GlobalesZiel; text: string; symbol: SymbolName }[] = [
  { id: 'start', text: 'Start', symbol: 'bausteine' },
  { id: 'projekte', text: 'Workflows', symbol: 'oeffnen' },
  { id: 'beispiele', text: 'Vorlagen', symbol: 'buch' },
];

/** Dieselbe globale Orientierung in Bibliothek und Editor, unabhängig vom geöffneten Arbeitsstand. */
export function EditorNavigation({
  aktiv = 'projekte',
  navigieren,
  einstellungen,
  ueber,
}: {
  aktiv?: GlobalesZiel;
  navigieren: (ziel: GlobalesZiel) => void;
  einstellungen: () => void;
  ueber: () => void;
}) {
  return (
    <aside className="editor-navigation">
      <div className="editor-navigation-marke" aria-label="ScriptLab">
        <Marke kompakt />
      </div>
      <nav aria-label="Globale Navigation" className="editor-navigation-ziele">
        <span className="editor-navigation-gruppe" aria-hidden="true">
          Arbeitsbereich
        </span>
        {hauptziele.map((ziel) => (
          <button
            key={ziel.id}
            type="button"
            className="editor-navlink"
            aria-label={ziel.text}
            title={ziel.text}
            aria-current={aktiv === ziel.id ? 'location' : undefined}
            onClick={() => navigieren(ziel.id)}
          >
            <Symbol name={ziel.symbol} />
            <span>{ziel.text}</span>
          </button>
        ))}
        <div className="editor-navigation-unten">
          <button
            type="button"
            className="editor-navlink"
            aria-label="Hilfe"
            title="Hilfe"
            aria-current={aktiv === 'hilfe' ? 'location' : undefined}
            onClick={() => navigieren('hilfe')}
          >
            <Symbol name="buch" />
            <span>Hilfe</span>
          </button>
          <button
            type="button"
            className="editor-navlink"
            aria-label="Einstellungen"
            title="Einstellungen"
            onClick={einstellungen}
          >
            <Symbol name="einstellungen" />
            <span>Einstellungen</span>
          </button>
          <button
            type="button"
            className="editor-navlink"
            aria-label="Über ScriptLab"
            title="Über ScriptLab"
            onClick={ueber}
          >
            <Symbol name="info" />
            <span>Über ScriptLab</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
