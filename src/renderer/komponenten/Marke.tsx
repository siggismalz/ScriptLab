import signet from '../../../assets/scriptlab-signet.svg?raw';

/** Wortmarke bleibt als echter Text lesbar; das Signet trägt keine zusätzliche Bedeutung. */
export function Marke({ kompakt = false }: { kompakt?: boolean }) {
  return (
    <span className={`sl-marke ${kompakt ? 'sl-marke--kompakt' : ''}`}>
      <span className="sl-marke-signet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: signet }} />
      <span>ScriptLab</span>
    </span>
  );
}
