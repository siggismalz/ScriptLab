export type Arbeitsbereich = 'ablauf' | 'daten' | 'laeufe';
const bereiche: { id: Arbeitsbereich; text: string }[] = [
  { id: 'ablauf', text: 'Ablauf' },
  { id: 'daten', text: 'Daten und Parameter' },
  { id: 'laeufe', text: 'Läufe' },
];

export function Arbeitsbereiche({
  wert,
  setzen,
}: {
  wert: Arbeitsbereich;
  setzen: (wert: Arbeitsbereich) => void;
}) {
  return (
    <div className="workflow-bereiche" role="tablist" aria-label="Arbeitsbereiche des Workflows">
      {bereiche.map((bereich, index) => (
        <button
          key={bereich.id}
          id={`bereich-${bereich.id}`}
          role="tab"
          type="button"
          aria-selected={wert === bereich.id}
          aria-controls={`workflow-${bereich.id}`}
          tabIndex={wert === bereich.id ? 0 : -1}
          onClick={() => setzen(bereich.id)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const ziel =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? bereiche.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + bereiche.length) % bereiche.length;
            setzen(bereiche[ziel].id);
            document.getElementById(`bereich-${bereiche[ziel].id}`)?.focus();
          }}
        >
          {bereich.text}
        </button>
      ))}
    </div>
  );
}
