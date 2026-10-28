import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

// Reale gerenderte Komponenten statt nur Tokenpaare messen. Kein Workflow wird gestartet.
const ziel = resolve('docs/gestaltung/nachher/komponenten-kontrast.json');
const temporaer = await mkdtemp(join(tmpdir(), 'ScriptLab-Komponentenkontrast-'));
const profil = join(temporaer, 'Profil');
await mkdir(profil);
await writeFile(
  join(profil, 'einstellungen.json'),
  JSON.stringify({ automatischeUpdates: false, vorabversionen: false }),
);
await mkdir(resolve('docs/gestaltung/nachher'), { recursive: true });
const app = await electron.launch({
  args: [resolve('.')],
  env: { ...process.env, SCRIPTLAB_TESTDATEN: profil },
});
const seite = await app.firstWindow();
const messungen = [];
const ausgelassen = [];
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
await seite.emulateMedia({ reducedMotion: 'reduce' });

/** Farben werden im Renderer mit dessen tatsächlichen computed styles aufgelöst. */
async function messen(thema, kontext, proben) {
  const ergebnis = await seite.evaluate(
    ({ thema, kontext, proben }) => {
      const daten = [],
        offen = [];
      const transparent = [0, 0, 0, 0];
      function farbe(wert) {
        if (!wert || wert === 'none' || wert === 'transparent') return [...transparent];
        const werte = wert
          .match(/^rgba?\((.*)\)$/)?.[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        if (!werte || werte.some((n) => !Number.isFinite(n)))
          throw new Error(`Nicht unterstützte berechnete Farbe: ${wert}`);
        return [werte[0], werte[1], werte[2], werte[3] ?? 1];
      }
      function mischen(vorn, hinten) {
        const alpha = vorn[3] + hinten[3] * (1 - vorn[3]);
        return [0, 1, 2]
          .map((i) => (alpha ? (vorn[i] * vorn[3] + hinten[i] * hinten[3] * (1 - vorn[3])) / alpha : 0))
          .concat(alpha);
      }
      const deckkraft = (wert, alpha) => [wert[0], wert[1], wert[2], wert[3] * alpha];
      const hex = (wert) =>
        '#' +
        wert
          .slice(0, 3)
          .map((n) => Math.round(n).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
      function luminanz(wert) {
        const linear = wert
          .slice(0, 3)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      }
      function kontrast(a, b) {
        const x = luminanz(a),
          y = luminanz(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      }
      function htmlEbenen(element, mitSelbst = true) {
        const pfad = [];
        for (let el = mitSelbst ? element : element.parentElement; el; el = el.parentElement) {
          const stil = getComputedStyle(el);
          if (stil.backgroundImage !== 'none')
            throw new Error(`Hintergrundbild benötigt eine Pixelprüfung: ${el.className}`);
          if (el instanceof HTMLElement)
            pfad.unshift({
              name: `${el.tagName.toLowerCase()}.${el.className}`,
              farbe: farbe(stil.backgroundColor),
              deckkraft: Number(stil.opacity),
            });
        }
        return pfad;
      }
      // Opazität wird pro Gruppe nach deren Inhalten zusammengesetzt; transparente Flächen werden nicht verworfen.
      function malen(ebenen, vordergrund = null, index = 0, hintergrund = [255, 255, 255, 1]) {
        if (index >= ebenen.length) return vordergrund ? mischen(vordergrund, hintergrund) : hintergrund;
        const e = ebenen[index];
        const innen = malen(ebenen, vordergrund, index + 1, mischen(e.farbe, hintergrund));
        return mischen(deckkraft(innen, e.deckkraft), hintergrund);
      }
      function svgFarbe(element, eigenschaft) {
        const stil = getComputedStyle(element);
        if (eigenschaft === 'fill' && stil.fill.startsWith('url(')) {
          const id = stil.fill.match(/#([^"')]+)/)?.[1];
          const muster = id ? document.getElementById(id) : null;
          if (!(muster instanceof SVGPatternElement)) throw new Error('Nicht auflösbarer SVG-Farbserver.');
          const basis = [...muster.children].find(
            (el) =>
              el instanceof SVGRectElement &&
              (el.getAttribute('width') === '100%' ||
                el.getAttribute('width') === muster.getAttribute('width')) &&
              (el.getAttribute('height') === '100%' ||
                el.getAttribute('height') === muster.getAttribute('height')),
          );
          // Das Blockly-Raster malt nur einzelne dekorative Punkte auf die bereits aufgelöste Canvasfläche.
          return basis ? svgFarbe(basis, 'fill') : [...transparent];
        }
        return deckkraft(
          farbe(stil[eigenschaft]),
          Number(stil[eigenschaft === 'fill' ? 'fillOpacity' : 'strokeOpacity']),
        );
      }
      function svgEbenen(element, mitFeld = true, nurCanvas = false) {
        const svg = element.ownerSVGElement;
        const container = svg?.closest('.blockly-editor');
        if (!container) throw new Error('Kein sichtbarer Blockly-Container.');
        const ebenen = htmlEbenen(container);
        const canvas = svg.querySelector('.blocklyMainBackground');
        if (canvas)
          ebenen.push({
            name: 'SVG-Arbeitsfläche',
            farbe: svgFarbe(canvas, 'fill'),
            deckkraft: Number(getComputedStyle(canvas).opacity),
          });
        if (nurCanvas) return ebenen;
        const gruppen = [];
        for (let el = element.parentElement; el && el !== svg; el = el.parentElement) {
          if (el.matches('g[data-id]')) gruppen.unshift(el);
        }
        for (const gruppe of gruppen) {
          const pfad = gruppe.querySelector(':scope > .blocklyPath:not(.blocklyPathSelected)');
          if (pfad)
            ebenen.push({
              name: `Baustein ${gruppe.getAttribute('data-id')}`,
              farbe: svgFarbe(pfad, 'fill'),
              deckkraft: Number(getComputedStyle(gruppe).opacity),
            });
        }
        if (mitFeld) {
          const feld = element.closest('.blocklyField');
          const rechteck = feld?.querySelector('.blocklyFieldRect, rect');
          if (rechteck)
            ebenen.push({
              name: 'SVG-Eingabefeld',
              farbe: svgFarbe(rechteck, 'fill'),
              deckkraft: Number(getComputedStyle(rechteck).opacity),
            });
        }
        return ebenen;
      }
      function textprobe(el, probe) {
        const stil = getComputedStyle(el);
        const svg = el instanceof SVGTextElement;
        const ebenen = svg ? svgEbenen(el) : htmlEbenen(el);
        const hintergrund = malen(ebenen);
        const vordergrund = malen(ebenen, svg ? svgFarbe(el, 'fill') : farbe(stil.color));
        const groesse = parseFloat(stil.fontSize);
        // Konservativ: Semibold wird nicht automatisch als WCAG-Großtext bei 14 pt gewertet.
        const minimum = groesse >= 24 || (groesse >= 18.6667 && Number(stil.fontWeight) >= 700) ? 3 : 4.5;
        const wert = kontrast(vordergrund, hintergrund);
        return {
          thema,
          kontext,
          art: 'Text',
          probe: probe.name,
          text: el.textContent?.trim().slice(0, 120),
          groesse,
          gewicht: stil.fontWeight,
          vordergrund: hex(vordergrund),
          hintergrund: hex(hintergrund),
          kontrast: +wert.toFixed(3),
          minimum,
          bestanden: wert >= minimum,
          ebenen,
        };
      }
      function konturprobe(el, probe) {
        const stil = getComputedStyle(el);
        const innenEbenen = htmlEbenen(el),
          aussenEbenen = htmlEbenen(el, false);
        const innen = malen(innenEbenen),
          aussen = malen(aussenEbenen);
        const kontur = farbe(stil[probe.art === 'fokus' ? 'outlineColor' : 'borderTopColor']);
        const breite = parseFloat(stil[probe.art === 'fokus' ? 'outlineWidth' : 'borderTopWidth']);
        const innenKontrast = kontrast(malen(innenEbenen, kontur), innen);
        const aussenKontrast = kontrast(malen(aussenEbenen, kontur), aussen);
        return {
          thema,
          kontext,
          art: probe.art === 'fokus' ? 'Fokus' : 'Bedienelementkontur',
          probe: probe.name,
          vordergrund: hex(kontur),
          innen: hex(innen),
          aussen: hex(aussen),
          breite,
          kontrastInnen: +innenKontrast.toFixed(3),
          kontrastAussen: +aussenKontrast.toFixed(3),
          minimum: 3,
          bestanden: breite > 0 && aussenKontrast >= 3 && (probe.art === 'fokus' || innenKontrast >= 3),
          ebenen: innenEbenen,
        };
      }
      function palettensymbol(el, probe) {
        const knopf = el.closest('.paletten-block');
        const hintergrund = malen(htmlEbenen(knopf));
        const fuellung = mischen(svgFarbe(el, 'fill'), hintergrund);
        const kontur = mischen(svgFarbe(el, 'stroke'), hintergrund);
        const flaechenkontrast = kontrast(fuellung, hintergrund),
          konturkontrast = kontrast(kontur, hintergrund);
        return {
          thema,
          kontext,
          art: 'Paletten-Kategorieform',
          probe: probe.name,
          name: knopf.getAttribute('aria-label'),
          fuellung: hex(fuellung),
          kontur: hex(kontur),
          umfeld: hex(hintergrund),
          flaechenkontrast: +flaechenkontrast.toFixed(3),
          konturkontrast: +konturkontrast.toFixed(3),
          minimum: 3,
          bestanden: Math.max(flaechenkontrast, konturkontrast) >= 3,
          begruendung:
            'Kategorie besitzt zusätzlich einen ausgeschriebenen Namen; geprüft wird auch die sichtbare Symbolgrenze.',
        };
      }
      for (const probe of proben) {
        const elemente = [...document.querySelectorAll(probe.selector)].filter((el) => el.checkVisibility());
        if (!elemente.length) {
          offen.push({
            thema,
            kontext,
            probe: probe.name,
            grund: 'Kein sichtbares Element dieses Zustands vorhanden.',
          });
          continue;
        }
        const ausgewaehlt = probe.alle ? elemente : elemente.slice(0, 1);
        const symbolfarben = new Set();
        for (const element of ausgewaehlt) {
          try {
            if (probe.art === 'palettensymbol') {
              const stil = getComputedStyle(element),
                schluessel = stil.fill + stil.stroke;
              if (symbolfarben.has(schluessel)) continue;
              symbolfarben.add(schluessel);
            }
            daten.push(
              probe.art === 'palettensymbol'
                ? palettensymbol(element, probe)
                : probe.art === 'kontur' || probe.art === 'fokus'
                  ? konturprobe(element, probe)
                  : textprobe(element, probe),
            );
          } catch (error) {
            offen.push({ thema, kontext, probe: probe.name, grund: String(error) });
          }
        }
      }
      // Alle tatsächlichen Blockbeschriftungen, Felder und sichtbaren Blockflächen der Fixture.
      if (kontext.endsWith('Editor') || kontext.endsWith('Auswahl')) {
        const canvas = document.querySelector('[data-testid="arbeitsbereich"]');
        const grundgestaltung = kontext.endsWith('Editor');
        for (const text of grundgestaltung ? canvas.querySelectorAll('.blocklyText') : []) {
          try {
            daten.push(textprobe(text, { name: 'Blockly-Beschriftung' }));
          } catch (error) {
            offen.push({ thema, kontext, probe: 'Blockly-Beschriftung', grund: String(error) });
          }
        }
        for (const feld of grundgestaltung ? canvas.querySelectorAll('.blocklyFieldRect') : []) {
          try {
            const hintergrund = malen(svgEbenen(feld, false));
            const innen = mischen(svgFarbe(feld, 'fill'), hintergrund);
            const kontur = svgFarbe(feld, 'stroke');
            const innenKontrast = kontrast(mischen(kontur, innen), innen);
            const aussenKontrast = kontrast(mischen(kontur, hintergrund), hintergrund);
            daten.push({
              thema,
              kontext,
              art: 'Blockly-Feldkontur',
              probe: feld.closest('g[data-id]')?.getAttribute('data-id'),
              vordergrund: hex(kontur),
              innen: hex(innen),
              aussen: hex(hintergrund),
              kontrastInnen: +innenKontrast.toFixed(3),
              kontrastAussen: +aussenKontrast.toFixed(3),
              minimum: 3,
              bestanden: innenKontrast >= 3 && aussenKontrast >= 3,
            });
          } catch (error) {
            offen.push({ thema, kontext, probe: 'Blockly-Feldkontur', grund: String(error) });
          }
        }
        const kategorien = new Set();
        for (const pfad of grundgestaltung
          ? canvas.querySelectorAll('.blocklyPath:not(.blocklyPathSelected)')
          : []) {
          try {
            const ebenen = svgEbenen(pfad, false, true);
            const sichtbareKontur =
              pfad.parentElement.querySelector(':scope > .sl-blockauswahl--aussen') ?? pfad;
            const umfeld = malen(ebenen),
              fuellung = mischen(svgFarbe(pfad, 'fill'), umfeld),
              kontur = mischen(svgFarbe(sichtbareKontur, 'stroke'), umfeld);
            const schluessel = hex(fuellung) + hex(kontur);
            if (kategorien.has(schluessel)) continue;
            kategorien.add(schluessel);
            const flaechenkontrast = kontrast(fuellung, umfeld),
              konturkontrast = kontrast(kontur, umfeld);
            daten.push({
              thema,
              kontext,
              art: 'Blockly-Kategoriegrenze',
              probe: pfad.closest('g[data-id]')?.getAttribute('data-id'),
              fuellung: hex(fuellung),
              kontur: hex(kontur),
              umfeld: hex(umfeld),
              flaechenkontrast: +flaechenkontrast.toFixed(3),
              konturkontrast: +konturkontrast.toFixed(3),
              konturquelle: sichtbareKontur === pfad ? 'Bausteinkontur' : 'Sichtbare äußere Auswahlkontur',
              minimum: 3,
              bestanden: Math.max(flaechenkontrast, konturkontrast) >= 3,
              begruendung:
                'Die Bausteinsilhouette muss sich durch Fläche oder Kontur vom Canvas abheben. Kategorie besitzt zusätzlich Namen und Symbol.',
            });
          } catch (error) {
            offen.push({ thema, kontext, probe: 'Blockly-Kategoriegrenze', grund: String(error) });
          }
        }
        const ausgewaehlt = canvas.querySelector('.scriptlabAuswahl');
        if (ausgewaehlt) {
          const pfad = ausgewaehlt.querySelector(':scope > .blocklyPath');
          const aussen = ausgewaehlt.querySelector(':scope > .sl-blockauswahl--aussen');
          const innen = ausgewaehlt.querySelector(':scope > .sl-blockauswahl--innen');
          const canvasfarbe = malen(svgEbenen(pfad, false, true));
          const blockfarbe = mischen(svgFarbe(pfad, 'fill'), canvasfarbe);
          const aussenfarbe = aussen ? svgFarbe(aussen, 'stroke') : svgFarbe(pfad, 'stroke');
          const innenfarbe = innen ? svgFarbe(innen, 'stroke') : svgFarbe(pfad, 'stroke');
          const zuCanvas = kontrast(mischen(aussenfarbe, canvasfarbe), canvasfarbe),
            zuBlock = kontrast(mischen(innenfarbe, blockfarbe), blockfarbe);
          daten.push({
            thema,
            kontext,
            art: 'Blockly-Auswahl',
            probe: ausgewaehlt.getAttribute('data-id'),
            zweifarbigeKontur: Boolean(aussen && innen),
            aussenkontur: hex(aussenfarbe),
            innenkontur: hex(innenfarbe),
            canvas: hex(canvasfarbe),
            block: hex(blockfarbe),
            kontrastCanvas: +zuCanvas.toFixed(3),
            kontrastBlock: +zuBlock.toFixed(3),
            gestrichelt: innen
              ? getComputedStyle(innen).strokeDasharray
              : getComputedStyle(pfad).strokeDasharray,
            minimum: 3,
            bestanden: zuCanvas >= 3 && zuBlock >= 3,
          });
        } else if (kontext.endsWith('Auswahl'))
          offen.push({
            thema,
            kontext,
            probe: 'Blockly-Auswahl',
            grund: 'Kein ausgewählter Block vorhanden.',
          });
      }
      return { daten, offen };
    },
    { thema, kontext, proben },
  );
  messungen.push(...ergebnis.daten);
  ausgelassen.push(...ergebnis.offen);
}

async function einstellungen(thema) {
  const editor = await seite.getByRole('button', { name: 'Bereiche', exact: true }).isVisible();
  if (editor) {
    await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
    await seite.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  } else await seite.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const dialog = seite.getByRole('dialog', { name: 'Einstellungen', exact: true });
  await dialog.getByRole('combobox', { name: 'Farbschema', exact: true }).selectOption(thema);
  await seite.waitForFunction(
    (wert) => getComputedStyle(document.documentElement).colorScheme === (wert === 'hell' ? 'light' : 'dark'),
    thema,
  );
  await messen(thema, 'Einstellungen', [
    { name: 'Dialogtitel', selector: 'dialog[open] h2' },
    { name: 'Formularbeschriftung', selector: 'dialog[open] .sl-feld label' },
    { name: 'Hilfetext', selector: 'dialog[open] .sl-feld-hilfe' },
    { name: 'Auswahlfeldtext', selector: 'dialog[open] select' },
    { name: 'Auswahlfeldkontur', selector: 'dialog[open] select', art: 'kontur' },
    { name: 'Primäraktion', selector: 'dialog[open] .sl-knopf--primaer span' },
    { name: 'Neutraler Laufzeitstatus', selector: 'dialog[open] .sl-status--neutral span' },
  ]);
  const palettenbreite = dialog.getByRole('spinbutton', { name: 'Breite der Bausteinpalette', exact: true });
  await palettenbreite.fill('239');
  await palettenbreite.press('Tab');
  await messen(thema, 'Tatsächlicher Formularfehler', [
    { name: 'Feldfehlermeldung', selector: 'dialog[open] .sl-feld-fehler' },
    {
      name: 'Fehlerkontur des Feldes',
      selector: 'dialog[open] .sl-feld-eingabe[aria-invalid="true"]',
      art: 'kontur',
    },
  ]);
  await palettenbreite.fill('272');
  await palettenbreite.press('Tab');
  await dialog.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
}

async function oeffnen(datei) {
  // Auch ein normales Speichern darf niemals eine Repository-Fixture verändern.
  const testkopie = join(temporaer, `${Date.now()}-${basename(datei)}`);
  await writeFile(testkopie, await readFile(resolve(datei)));
  await app.evaluate(({ dialog }, pfad) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] });
    dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false });
  }, testkopie);
  const editor = seite.locator('.werkzeugleiste').getByRole('button', { name: 'Öffnen', exact: true });
  if (await editor.isVisible()) await editor.click();
  else await seite.getByRole('button', { name: 'Workflow öffnen', exact: true }).click();
  await seite.getByTestId('arbeitsbereich').waitFor({ state: 'visible' });
  await seite.getByRole('button', { name: 'Neu', exact: true }).waitFor({ state: 'visible' });
  await seite.waitForFunction(async () => {
    const r = await window.scriptlab.laden();
    return r.ok && !r.wert.dokument.darstellungNoetig;
  });
}

try {
  for (const thema of ['dunkel', 'hell']) {
    await einstellungen(thema);
    if (await seite.getByRole('button', { name: 'Bereiche', exact: true }).isVisible()) {
      await seite.getByRole('button', { name: 'Bereiche', exact: true }).click();
      await seite.getByRole('menuitem', { name: 'Start', exact: true }).click();
    }
    await seite.getByRole('button', { name: 'Neuer Workflow', exact: true }).waitFor({ state: 'visible' });
    await seite.mouse.move(1, 1);
    await messen(thema, 'Start', [
      { name: 'Seitentitel', selector: '.start-seitenkopf h1' },
      { name: 'Navigation aktiv', selector: '.start-navigation [aria-current="page"]' },
      { name: 'Kartenbeschriftung', selector: '.start-karte-titel', alle: true },
      { name: 'Kartentext sekundär', selector: '.start-karte-beschreibung', alle: true },
      { name: 'Metadaten', selector: '.start-karte-metadaten', alle: true },
      { name: 'Primäraktion normal', selector: '.start-hauptaktionen .sl-knopf--primaer span' },
      { name: 'Standardaktion', selector: '.start-hauptaktionen .sl-knopf--standard span' },
    ]);
    const primaer = seite.getByRole('button', { name: 'Neuer Workflow', exact: true });
    await primaer.hover();
    await messen(thema, 'Start Hover', [
      { name: 'Primäraktion Hover', selector: '.start-hauptaktionen .sl-knopf--primaer span' },
    ]);
    await primaer.focus();
    await seite.keyboard.press('Shift+Tab');
    await seite.keyboard.press('Tab');
    await messen(thema, 'Start Tastaturfokus', [
      { name: 'Fokuskontur Primäraktion', selector: '.start-hauptaktionen .sl-knopf--primaer', art: 'fokus' },
    ]);
    await primaer.click();
    const sprachwahl = seite.getByRole('dialog', {
      name: 'Welche Sprache möchtest du verwenden?',
      exact: true,
    });
    await sprachwahl.waitFor({ state: 'visible' });
    await messen(thema, 'Tatsächlich deaktivierte Aktion', [
      { name: 'Deaktivierte Hauptaktion', selector: 'dialog[open] .sl-knopf:disabled span' },
      { name: 'Erklärung der fehlenden Voraussetzung', selector: 'dialog[open] .sprachwahl-startgrund' },
    ]);
    await sprachwahl.getByRole('button', { name: 'Abbrechen', exact: true }).click();

    for (const [name, datei] of [
      ['VBS', 'tests/ui/fixtures/01-Alltagsworkflow.scriptlab'],
      ['Business', 'beispiele/business/A-Monatsauswertung/workflow.scriptlab'],
    ]) {
      await oeffnen(datei);
      const fixture = JSON.parse(await readFile(resolve(datei), 'utf8'));
      const id = fixture.editor.blocks.blocks[0].id;
      const canvas = seite.getByTestId('arbeitsbereich');
      const rahmen = await canvas.boundingBox();
      await canvas.click({ position: { x: rahmen.width - 40, y: 32 } });
      await seite.waitForFunction(() => !document.querySelector('.scriptlabAuswahl'));
      await messen(thema, `${name} Editor`, [
        { name: 'Workflowtitel', selector: '.workflow-identitaet h1' },
        { name: 'Speicherzustand', selector: '.workflow-identitaet p' },
        { name: 'Aktiver Arbeitsbereich', selector: '.workflow-bereiche [aria-selected="true"]' },
        { name: 'Primäraktion Editor', selector: '.werkzeugleiste .sl-knopf--primaer span' },
        { name: 'Palettenbeschriftung', selector: '.kategorie-kopf', alle: true },
        { name: 'Suchfeldtext', selector: '.palette-suche input' },
        { name: 'Suchfeldkontur', selector: '.palette-suche input', art: 'kontur' },
        { name: 'Statusmetadaten', selector: '.projektstatus' },
      ]);
      await canvas.locator(`g[data-id="${id}"]`).click({ position: { x: 40, y: 16 } });
      await seite.waitForFunction(() => Boolean(document.querySelector('.scriptlabAuswahl')));
      await messen(thema, `${name} Auswahl`, []);
      const suche = seite.getByRole('searchbox', { name: 'Bausteine suchen', exact: true });
      await suche.focus();
      await seite.keyboard.press('Shift+Tab');
      await seite.keyboard.press('Tab');
      await messen(thema, `${name} Feldfokus`, [
        { name: 'Fokus des Palettensuchfelds', selector: '.palette-suche input', art: 'fokus' },
      ]);
      const kategorien = seite.locator('.kategorie-kopf');
      for (let n = 0; n < (await kategorien.count()); n++) {
        const kategorie = kategorien.nth(n);
        const titel = (await kategorie.innerText()).trim();
        if ((await kategorie.getAttribute('aria-expanded')) !== 'true') await kategorie.click();
        await messen(thema, `${name} Palette: ${titel}`, [
          { name: 'Kategoriebezeichnung', selector: '.kategorie-kopf[aria-expanded="true"]' },
          { name: titel, selector: '.palette .block-form path', art: 'palettensymbol', alle: true },
        ]);
      }
      await seite.getByRole('button', { name: 'Eigenschaften', exact: true }).click();
      await messen(thema, `${name} Eigenschaften`, [
        { name: 'Eigenschaftstitel', selector: '.eigenschaften-panel h2' },
        { name: 'Eigenschaftentext', selector: '.eigenschaften-panel .panel-inhalt > p' },
      ]);
      await seite.getByRole('button', { name: 'Eigenschaften schließen', exact: true }).click();
    }
    // Erfolg aus echtem Speichern in einer isolierten Kopie.
    await app.evaluate(
      ({ dialog }, datei) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: datei });
      },
      join(temporaer, `Testdaten-${thema}.scriptlab`),
    );
    await seite.getByRole('button', { name: 'Speichern', exact: true }).click();
    await seite.locator('.status-aktion--erfolg').waitFor();
    await messen(thema, 'Tatsächlich gespeichert', [
      { name: 'Erfolgsstatus', selector: '.status-aktion--erfolg' },
    ]);

    // Warnung aus einer tatsächlich unvollständigen Fixture beim Exportversuch.
    await oeffnen('tests/ui/fixtures/04-Fehlende-Pflichtwerte.scriptlab');
    await seite.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await seite
      .getByRole('dialog', { name: 'Exportieren', exact: true })
      .getByRole('button', { name: 'Ausgabeort auswählen', exact: true })
      .click();
    await seite.locator('.status-aktion--hinweis').waitFor();
    await messen(thema, 'Unvollständiger Workflow', [
      { name: 'Warnstatus', selector: '.status-aktion--hinweis' },
      { name: 'Validierungshinweise', selector: '.hinweise-liste .sl-knopf span', alle: true },
    ]);
    // Handlungsbedürftiger Fehler stammt aus realem Dateiladen, nicht aus einer CSS-Klasse im Test.
    const kaputt = join(temporaer, `Kaputte-Testdaten-${thema}.scriptlab`);
    await writeFile(kaputt, '{absichtlich unvollständige Testdaten', 'utf8');
    await app.evaluate(({ dialog }, datei) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [datei] });
    }, kaputt);
    await seite.getByRole('button', { name: 'Öffnen', exact: true }).click();
    await seite.locator('.aufgabenfehler').waitFor();
    await messen(thema, 'Dateifehler', [
      { name: 'Erklärung des Dateifehlers', selector: '.aufgabenfehler p' },
      { name: 'Fehlerstatus', selector: '.status-aktion--fehler' },
    ]);
    await seite.getByRole('button', { name: 'Fehlermeldung schließen', exact: true }).click();
  }
  const probleme = messungen.filter((m) => !m.bestanden);
  const abdeckung = Object.fromEntries(
    ['dunkel', 'hell'].map((thema) => {
      const auswahl = messungen.filter((m) => m.thema === thema),
        symbole = auswahl.filter((m) => m.art === 'Paletten-Kategorieform');
      return [
        thema,
        {
          messungen: auswahl.length,
          palettenFachgruppen: [...new Set(symbole.map((m) => m.probe))],
          palettenFarben: [...new Set(symbole.map((m) => m.fuellung))],
          textMinimum: Math.min(...auswahl.filter((m) => m.art === 'Text').map((m) => m.kontrast)),
          fokusMinimum: Math.min(...auswahl.filter((m) => m.art === 'Fokus').map((m) => m.kontrastAussen)),
          bedienkonturMinimum: Math.min(
            ...auswahl
              .filter((m) => ['Bedienelementkontur', 'Blockly-Feldkontur'].includes(m.art))
              .flatMap((m) => [m.kontrastInnen, m.kontrastAussen]),
          ),
        },
      ];
    }),
  );
  const bericht = {
    datum: new Date().toISOString(),
    anwendung: 'Windows-Electron, bestehender Produktionsbuild',
    fenster: { breite: 1280, hoehe: 720 },
    methode:
      'getComputedStyle an tatsächlich gerenderten HTML-/Blockly-Komponenten. Alpha und Vorfahrenhintergründe werden in Malreihenfolge zusammengesetzt. Keine Tokenwerte als Messergebnis.',
    grenzen: [
      'Punktuelle Komponentenprüfung, keine vollständige WCAG- oder Barrierefreiheitsprüfung.',
      'Antialiasing an Glyphenkanten ist nicht Teil der WCAG-Farbberechnung.',
      'Keine freie Pixelanalyse von überlagernden Geschwisterelementen oder Bildern. Erkannte Hintergrundbilder werden als nicht messbar ausgewiesen.',
      'Das transparente Blockly-Punktraster ist rein dekorativ; gemessen wird seine tatsächlich darunterliegende Canvasfläche. Vollflächige SVG-Musterrechtecke werden aufgelöst.',
      'Nicht sichtbare oder nicht vorliegende Zustände werden offen ausgewiesen. Dekorative Linien erhalten keine pauschale 3:1-Pflicht.',
      'Baustein-Kategoriegrenzen dürfen durch Fläche oder Kontur gegenüber dem Canvas erkennbar sein. Zweifarbige Auswahl wird innen gegen den Block und außen gegen den Canvas gemessen.',
    ],
    zusammenfassung: {
      messungen: messungen.length,
      bestanden: messungen.length - probleme.length,
      probleme: probleme.length,
      nichtGemessen: ausgelassen.length,
    },
    abdeckung,
    probleme,
    nichtGemessen: ausgelassen,
    messungen,
  };
  await writeFile(ziel, JSON.stringify(bericht, null, 2) + '\n');
  console.log(
    JSON.stringify({ ziel, ...bericht.zusammenfassung, probleme, nichtGemessen: ausgelassen }, null, 2),
  );
  if (probleme.length) process.exitCode = 1;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
