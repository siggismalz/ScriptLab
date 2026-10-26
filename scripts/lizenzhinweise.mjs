import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ausschliesslich lokale Paketdaten lesen. Kein npm-Aufruf, kein Netzwerk, keine Geheimnisse.
const projektOrdner = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ziel = join(projektOrdner, 'THIRD_PARTY_NOTICES.md');
const argumente = new Set(process.argv.slice(2));
if ([...argumente].some((wert) => !['--check', '--strict'].includes(wert))) {
  throw new Error(
    'Erlaubte Optionen: --check prueft den vorhandenen Stand; --strict verlangt fuer jedes Paket einen vollstaendigen Lizenztext.',
  );
}
if (process.platform !== 'win32')
  throw new Error('Bitte die Lizenzhinweise auf dem unterstuetzten Windows-Buildsystem erzeugen.');

const normalisieren = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const alphabetisch = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const markdown = (wert) =>
  String(wert)
    .replaceAll('|', '\\|')
    .replace(/[\r\n]/g, ' ');
const lockText = normalisieren(await readFile(join(projektOrdner, 'package-lock.json'), 'utf8'));
const lock = JSON.parse(lockText);
const paket = JSON.parse(await readFile(join(projektOrdner, 'package.json'), 'utf8'));
if (lock.lockfileVersion !== 3 || !lock.packages?.[''])
  throw new Error('Eine unterstuetzte package-lock.json mit packages-Inventar fehlt.');
if (JSON.stringify(lock.packages[''].dependencies) !== JSON.stringify(paket.dependencies)) {
  throw new Error(
    'Produktionsabhaengigkeiten und Lockdatei stimmen nicht ueberein. Bitte npm ci beziehungsweise npm install korrekt abschliessen.',
  );
}

// Der npm-Tarball von saxes 6.0.0 laesst LICENSE aus. Dieser Text stammt aus
// dessen exaktem npm-gitHead; er ist hier unveraendert fuer Offline-Reproduktion abgelegt.
const ergaenzteLizenztexte = {
  'saxes@6.0.0': {
    quelle:
      'https://raw.githubusercontent.com/lddubeau/saxes/211fa0ebec9b628affc09219199639887174bfc3/LICENSE',
    sha256: '0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e',
    text: 'The ISC License\n\nCopyright (c) Contributors\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above\ncopyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES\nWITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF\nMERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR\nANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES\nWHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN\nACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR\nIN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n\n====\n\nThe following license is the one that governed sax, from which saxes\nwas forked. Isaac Schlueter is not *directly* involved with saxes so\ndon\'t go bugging him for saxes issues.\n\nThe ISC License\n\nCopyright (c) Isaac Z. Schlueter and Contributors\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above\ncopyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES\nWITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF\nMERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR\nANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES\nWHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN\nACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR\nIN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n\n====\n\n`String.fromCodePoint` by Mathias Bynens is no longer used, but it can\nstill be found in old commits. It was once used according to terms of\nMIT License, as follows:\n\n    Copyright Mathias Bynens <https://mathiasbynens.be/>\n\n    Permission is hereby granted, free of charge, to any person obtaining\n    a copy of this software and associated documentation files (the\n    "Software"), to deal in the Software without restriction, including\n    without limitation the rights to use, copy, modify, merge, publish,\n    distribute, sublicense, and/or sell copies of the Software, and to\n    permit persons to whom the Software is furnished to do so, subject to\n    the following conditions:\n\n    The above copyright notice and this permission notice shall be\n    included in all copies or substantial portions of the Software.\n\n    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,\n    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\n    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\n    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\n    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\n    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n',
  },
};

async function existiert(pfad) {
  try {
    return (await stat(pfad)).isFile();
  } catch (fehler) {
    if (fehler.code === 'ENOENT') return false;
    throw fehler;
  }
}

async function paketSuchen(name, von) {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) throw new Error('Ein Paketname ist ungueltig.');
  let basis = von;
  while (true) {
    const kandidat = posix.join(basis, 'node_modules', name);
    if (lock.packages[kandidat] && (await existiert(join(projektOrdner, kandidat, 'package.json'))))
      return kandidat;
    const teile = basis.split('/');
    const letzteEbene = teile.lastIndexOf('node_modules');
    if (letzteEbene < 0) return null;
    basis = teile.slice(0, letzteEbene).join('/');
  }
}

const instanzen = new Map();
const optionaleFehlende = new Set();
async function aufnehmen(name, von, optional = false) {
  const pfad = await paketSuchen(name, von);
  if (!pfad) {
    if (optional) {
      optionaleFehlende.add(name);
      return;
    }
    throw new Error(
      `Produktionspaket ${name} fehlt unter ${von || '(Projektwurzel)'}. Bitte npm ci ausfuehren.`,
    );
  }
  if (instanzen.has(pfad)) return;
  const manifest = JSON.parse(await readFile(join(projektOrdner, pfad, 'package.json'), 'utf8'));
  const festgelegt = lock.packages[pfad];
  if (festgelegt.link || manifest.version !== festgelegt.version || manifest.name !== name) {
    throw new Error(`Installiertes Paket ${name} stimmt nicht eindeutig mit der Lockdatei ueberein.`);
  }
  instanzen.set(pfad, { pfad, manifest, festgelegt });
  const dependencies = {
    ...festgelegt.dependencies,
    ...festgelegt.optionalDependencies,
    ...festgelegt.peerDependencies,
  };
  for (const abhaengigkeit of Object.keys(dependencies).sort(alphabetisch)) {
    const istOptional =
      Object.hasOwn(festgelegt.optionalDependencies ?? {}, abhaengigkeit) ||
      festgelegt.peerDependenciesMeta?.[abhaengigkeit]?.optional === true;
    await aufnehmen(abhaengigkeit, pfad, istOptional);
  }
}
for (const name of Object.keys(paket.dependencies ?? {}).sort(alphabetisch)) await aufnehmen(name, '');

const lizenzdatei = (name) => /^(?:licen[sc]es?|copying|notice|copyright)(?:$|[._-])/i.test(name);
async function dateienSammeln(paketPfad, relativ = '', inLizenzordner = false) {
  const ergebnisse = [];
  const eintraege = (await readdir(join(projektOrdner, paketPfad, relativ), { withFileTypes: true })).sort(
    (a, b) => alphabetisch(a.name, b.name),
  );
  for (const eintrag of eintraege) {
    if (['node_modules', '.git', '.cache'].includes(eintrag.name)) continue;
    const kind = posix.join(relativ, eintrag.name);
    if (eintrag.isSymbolicLink())
      throw new Error(
        `Ein symbolischer Link verhindert ein eindeutiges Lizenzinventar: ${paketPfad}/${kind}`,
      );
    if (eintrag.isDirectory()) {
      ergebnisse.push(
        ...(await dateienSammeln(paketPfad, kind, inLizenzordner || lizenzdatei(eintrag.name))),
      );
    } else if (eintrag.isFile() && (inLizenzordner || lizenzdatei(eintrag.name))) {
      const bytes = await readFile(join(projektOrdner, paketPfad, kind));
      const text = normalisieren(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!text.trim()) throw new Error(`Die Lizenzdatei ist leer: ${paketPfad}/${kind}`);
      ergebnisse.push({ datei: kind, text });
    }
  }
  return ergebnisse;
}

function lizenzangabe(manifest, festgelegt) {
  if (typeof manifest.license === 'string') return manifest.license;
  if (typeof manifest.license?.type === 'string') return manifest.license.type;
  if (typeof festgelegt.license === 'string') return festgelegt.license;
  return 'Keine Lizenzangabe in den Paketmetadaten';
}

const gruppen = new Map();
for (const instanz of instanzen.values()) {
  const { manifest, festgelegt, pfad } = instanz;
  const kennung = `${manifest.name}@${manifest.version}`;
  const dateien = await dateienSammeln(pfad);
  const ergaenzung = ergaenzteLizenztexte[kennung];
  if (!dateien.length && ergaenzung) {
    if (hash(normalisieren(ergaenzung.text)) !== ergaenzung.sha256)
      throw new Error(`Der fest abgelegte Lizenztext fuer ${kennung} wurde veraendert.`);
    dateien.push({
      datei: 'LICENSE (offizieller Versionscommit)',
      text: normalisieren(ergaenzung.text),
      quelle: ergaenzung.quelle,
    });
  }
  const lizenz = lizenzangabe(manifest, festgelegt);
  if (gruppen.has(kennung)) {
    const vorhanden = gruppen.get(kennung);
    if (vorhanden.lizenz !== lizenz || JSON.stringify(vorhanden.dateien) !== JSON.stringify(dateien)) {
      throw new Error(`Die installierten Instanzen von ${kennung} enthalten unterschiedliche Lizenzdaten.`);
    }
    vorhanden.pfade.push(pfad);
  } else
    gruppen.set(kennung, {
      name: manifest.name,
      version: manifest.version,
      kennung,
      lizenz,
      pfade: [pfad],
      dateien,
    });
}
const geordnet = [...gruppen.values()].sort(
  (a, b) => alphabetisch(a.name, b.name) || alphabetisch(a.version, b.version),
);
const fehlendeTexte = geordnet.filter((eintrag) => !eintrag.dateien.length);

const electronPfad = 'node_modules/electron';
const electronManifest = JSON.parse(
  await readFile(join(projektOrdner, electronPfad, 'package.json'), 'utf8'),
);
if (electronManifest.version !== lock.packages[electronPfad]?.version)
  throw new Error('Electron und Lockdatei stimmen nicht ueberein.');
const electronLizenz = normalisieren(
  await readFile(join(projektOrdner, electronPfad, 'dist', 'LICENSE'), 'utf8'),
);
const chromiumBytes = await readFile(join(projektOrdner, electronPfad, 'dist', 'LICENSES.chromium.html'));

function textblock(inhalt) {
  const laengstes = Math.max(0, ...(inhalt.match(/`+/g) ?? []).map((folge) => folge.length));
  const zaun = '`'.repeat(Math.max(3, laengstes + 1));
  return `${zaun}text\n${inhalt.endsWith('\n') ? inhalt : `${inhalt}\n`}${zaun}`;
}

const zeilen = [
  '# Drittanbieter und Lizenzhinweise',
  '',
  `ScriptLab ${paket.version} · Entwickelt von Leon Stolz.`,
  '',
  'Diese Datei wird mit `node scripts/lizenzhinweise.mjs` aus der eingecheckten Lockdatei und den installierten Produktionspaketen erzeugt. Der Vorgang benoetigt nach `npm ci` keinen Netzwerkzugriff. `--check` prueft den vorhandenen Stand ohne ihn zu veraendern; `--strict` bricht bei fehlenden vollstaendigen Lizenztexten ab.',
  '',
  'Fuer den eigenen ScriptLab-Code ist noch keine Projektlizenz festgelegt. Der Paketwert `UNLICENSED` bezeichnet diesen offenen Stand und erteilt keine allgemeine Nutzungs- oder Weitergabelizenz. Die nachfolgenden Lizenzen gehoeren ausschliesslich zu den jeweils genannten Drittanbietern.',
  '',
  '## Grundlage und Umfang',
  '',
  `- SHA-256 der auf LF normalisierten package-lock.json: \`${hash(lockText)}\``,
  `- ${geordnet.length} verschiedene Produktionspakete in ${instanzen.size} installierten Paketinstanzen; direkte, transitive und installierte Peer-/optionale Abhaengigkeiten sind enthalten.`,
  '- Reine Entwicklungswerkzeuge werden hier nicht als ausgelieferte Produktionspakete aufgefuehrt. Die Electron-Laufzeit wird getrennt behandelt.',
  ...(optionaleFehlende.size
    ? [
        `- Nicht installierte optionale Abhaengigkeiten sind nicht enthalten: ${[...optionaleFehlende]
          .sort(alphabetisch)
          .map((name) => `\`${name}\``)
          .join(', ')}.`,
      ]
    : []),
  '- Die Lizenzbezeichnungen stammen aus den Paketmetadaten. Vorhandene LICENSE-, COPYING-, NOTICE- und COPYRIGHT-Dateien einschliesslich solcher Unterordner werden vollstaendig wiedergegeben. Rechteinhaber und Lizenztexte werden nicht aus Paketnamen erraten.',
  '',
  '## Offene Lizenztexte',
  '',
  ...(fehlendeTexte.length
    ? [
        ...fehlendeTexte.map(
          (eintrag) =>
            `- **${eintrag.kennung}:** Paketmetadaten nennen \`${eintrag.lizenz}\`; im installierten Paket liegt kein vollstaendiger Lizenztext. Fuer diesen offenen Nachweis wird kein Urheberrechtsvermerk erfunden.`,
        ),
        '- Fuer `lazy-val@1.0.5` enthaelt auch der durch npm gemeldete [offizielle Versionscommit](https://github.com/develar/lazy-val/tree/b69ad4119f1b19bdab13c61ee2fcc88d46b89071) keine LICENSE-Datei. Eine vollstaendige upstream Lizenzklarstellung bleibt vor einer abschliessend freigegebenen Weitergabe offen.',
      ]
    : [
        'Fuer jedes aufgefuehrte Produktionspaket ist mindestens eine originale Lizenz-/Hinweisdatei aufgenommen.',
      ]),
  '',
  '## Electron und Chromium',
  '',
  `Electron ${electronManifest.version}: Lizenzangabe \`${lizenzangabe(electronManifest, lock.packages[electronPfad])}\`. Der folgende Lizenztext stammt direkt aus \`${electronPfad}/dist/LICENSE\`.`,
  '',
  textblock(electronLizenz),
  '',
  '`electron-builder` erhaelt die Lizenztexte der Electron-Distribution im Installationsordner neben `ScriptLab.exe`: `dist/LICENSE` wird mit unveraendertem Inhalt als `LICENSE.electron.txt` abgelegt, `LICENSES.chromium.html` behaelt ihren Namen. Die HTML-Datei enthaelt die ausfuehrlichen Einzelhinweise fuer Chromium, Node.js und weitere in der Laufzeit enthaltene Komponenten. Sie wird wegen ihres Umfangs nicht zusaetzlich in diese Markdown-Datei kopiert.',
  '',
  `- Originaldatei: \`${electronPfad}/dist/LICENSES.chromium.html\``,
  `- Dateigroesse: ${chromiumBytes.length} Bytes`,
  `- SHA-256 der unveraenderten HTML-Datei: \`${hash(chromiumBytes)}\``,
  '',
  '## Produktionspakete',
  '',
  '| Paket | Version | Lizenzangabe | Aufgenommene Lizenzdateien |',
  '| --- | --- | --- | --- |',
  ...geordnet.map(
    (eintrag) =>
      `| ${markdown(eintrag.name)} | ${markdown(eintrag.version)} | ${markdown(eintrag.lizenz)} | ${eintrag.dateien.length ? eintrag.dateien.map((datei) => markdown(datei.datei)).join('; ') : '**Textnachweis offen**'} |`,
  ),
  '',
];

for (const eintrag of geordnet) {
  zeilen.push(
    `## ${eintrag.kennung}`,
    '',
    `Lizenzangabe: \`${eintrag.lizenz}\`.`,
    '',
    'Installierte Paketinstanzen:',
    '',
    ...eintrag.pfade.sort(alphabetisch).map((pfad) => `- \`${pfad}\``),
    '',
  );
  if (!eintrag.dateien.length)
    zeilen.push(
      'Kein vollstaendiger Lizenztext im installierten Paket. Die Lizenzangabe aus package.json ersetzt keinen erfundenen Lizenz- oder Urheberrechtstext; siehe den offenen Nachweis oben.',
      '',
    );
  for (const datei of eintrag.dateien) {
    zeilen.push(`### ${datei.datei}`, '');
    if (datei.quelle)
      zeilen.push(
        `Der npm-Tarball enthaelt diese Datei nicht. Original aus dem [offiziellen Versionscommit](${datei.quelle}), versionsfest offline im Erzeugerscript abgelegt.`,
        '',
      );
    zeilen.push(
      `SHA-256 des auf LF normalisierten Textes: \`${hash(datei.text)}\``,
      '',
      textblock(datei.text),
      '',
    );
  }
}
const ausgabe = `${zeilen.join('\n').replace(/\n+$/, '')}\n`;
if (argumente.has('--check')) {
  const vorhanden = normalisieren(await readFile(ziel, 'utf8'));
  if (vorhanden !== ausgabe)
    throw new Error(
      'THIRD_PARTY_NOTICES.md ist nicht aktuell. Bitte node scripts/lizenzhinweise.mjs ausfuehren.',
    );
} else await writeFile(ziel, ausgabe, 'utf8');
console.log(
  `${argumente.has('--check') ? 'Geprueft' : 'Erstellt'}: ${geordnet.length} Produktionspakete, ${instanzen.size} Paketinstanzen und Electron ${electronManifest.version}.`,
);
if (fehlendeTexte.length) {
  console.warn(
    `Vollstaendige Lizenztexte offen: ${fehlendeTexte.map((eintrag) => eintrag.kennung).join(', ')}.`,
  );
  if (argumente.has('--strict')) process.exitCode = 1;
}
