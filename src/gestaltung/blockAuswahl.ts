import type * as Blockly from 'blockly/core';

/** Zwei klare Konturen halten Auswahl auf dunklen Blöcken und hellen wie dunklen Canvases erkennbar. */
export function blockAuswahlKennzeichnen(block: Blockly.BlockSvg, ausgewaehlt: boolean): void {
  const gruppe = block.getSvgRoot();
  if (!gruppe) return;
  gruppe.classList.toggle('scriptlabAuswahl', ausgewaehlt);
  if (!ausgewaehlt) {
    gruppe.querySelectorAll('.sl-blockauswahl').forEach((pfad) => pfad.remove());
    return;
  }
  const original = gruppe.querySelector<SVGPathElement>(':scope > .blocklyPath:not(.blocklyPathSelected)');
  if (!original) return;
  for (const art of ['aussen', 'innen']) {
    let pfad = gruppe.querySelector<SVGPathElement>(`.sl-blockauswahl--${art}`);
    if (!pfad) {
      pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pfad.setAttribute('class', `sl-blockauswahl sl-blockauswahl--${art}`);
      pfad.setAttribute('aria-hidden', 'true');
      gruppe.appendChild(pfad);
    }
    pfad.setAttribute('d', original.getAttribute('d') ?? '');
    if (original.hasAttribute('transform'))
      pfad.setAttribute('transform', original.getAttribute('transform')!);
  }
}
