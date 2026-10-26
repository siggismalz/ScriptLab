import { neuesProjekt, type EditorBlock, type Projekt } from '../../src/kern/projekt';

/** Ausschließlich Editor-Testdaten. Keine dieser beschriebenen Aktionen wird hier ausgeführt. */
function baustein(
  type: string,
  id: string,
  fields: EditorBlock['fields'] = {},
  eingaben: Record<string, EditorBlock> = {},
): EditorBlock {
  return {
    type,
    id,
    ...(Object.keys(fields).length ? { fields } : {}),
    ...(Object.keys(eingaben).length
      ? { inputs: Object.fromEntries(Object.entries(eingaben).map(([name, block]) => [name, { block }])) }
      : {}),
  };
}
const text = (id: string, TEXT: string) => baustein('sl_text', id, { TEXT });
const zahl = (id: string, ZAHL: string) => baustein('sl_number', id, { ZAHL });
const variable = (id: string, VAR: string) => baustein('sl_get', id, { VAR });

function kette(...bausteine: EditorBlock[]): EditorBlock {
  for (let i = 0; i < bausteine.length - 1; i++) bausteine[i].next = { block: bausteine[i + 1] };
  return bausteine[0];
}
function projekt(name: string, erster: EditorBlock, beschreibung: string): Projekt {
  const p = neuesProjekt();
  p.name = name;
  p.beschreibung = beschreibung;
  p.editor = {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: 'sl_start', id: 'ui-start', x: 72, y: 48, next: { block: erster } }],
    },
  };
  p.ansicht = { zoom: 1, x: 0, y: 0 };
  p.exportOptionen = { signieren: false, zertifikatFingerabdruck: '', zeitstempelUrl: '' };
  return p;
}

export function alltagsworkflow(): Projekt {
  const wiederholung = kette(
    baustein(
      'sl_log',
      'ui-protokoll',
      {},
      {
        PFAD: text('ui-protokollpfad', 'ScriptLab-UI-Testdaten\\Protokoll.txt'),
        TEXT: baustein(
          'sl_join',
          'ui-begruessung',
          {},
          {
            A: text('ui-hallo', 'Hallo '),
            B: variable('ui-name-protokoll', 'Name'),
          },
        ),
      },
    ),
    baustein(
      'sl_message',
      'ui-rueckmeldung',
      {},
      {
        TEXT: text('ui-rueckmeldung-text', 'Die Protokollzeile wurde geschrieben.'),
      },
    ),
  );
  return projekt(
    'UI-Test: Begrüßung mit Protokoll',
    kette(
      baustein('sl_comment', 'ui-kommentar', {
        TEXT: 'Klare Testdaten: Dieser Workflow wird in der UI-Prüfung niemals gestartet.',
      }),
      baustein(
        'sl_set',
        'ui-name-setzen',
        { VAR: 'Name' },
        {
          WERT: baustein(
            'sl_input',
            'ui-name-fragen',
            {},
            {
              TEXT: text('ui-name-frage', 'Wie heißt du?'),
            },
          ),
        },
      ),
      baustein(
        'sl_mkdir',
        'ui-ordner',
        {},
        {
          PFAD: text('ui-ordnerpfad', 'ScriptLab-UI-Testdaten'),
        },
      ),
      baustein(
        'sl_if',
        'ui-wenn-name',
        {},
        {
          BEDINGUNG: baustein(
            'sl_compare',
            'ui-name-vergleich',
            { OP: 'NE' },
            {
              A: variable('ui-name-pruefen', 'Name'),
              B: text('ui-leerer-name', ''),
            },
          ),
          DANN: baustein(
            'sl_repeat',
            'ui-wiederholen',
            {},
            {
              ANZAHL: zahl('ui-wiederholungszahl', '3'),
              ABLAUF: wiederholung,
            },
          ),
          SONST: baustein(
            'sl_message',
            'ui-ohne-eingabe',
            {},
            {
              TEXT: text('ui-ohne-eingabe-text', 'Du hast keinen Namen eingegeben.'),
            },
          ),
        },
      ),
      baustein(
        'sl_set',
        'ui-anzahl-setzen',
        { VAR: 'Wiederholungen' },
        {
          WERT: zahl('ui-anzahl', '3'),
        },
      ),
      baustein(
        'sl_message',
        'ui-fertig',
        {},
        {
          TEXT: baustein(
            'sl_join',
            'ui-fertig-verbinden',
            {},
            {
              A: text('ui-fertig-text', 'Anzahl der Wiederholungen: '),
              B: variable('ui-anzahl-lesen', 'Wiederholungen'),
            },
          ),
        },
      ),
    ),
    'Realistischer Ablauf mit 28 Bausteinen, Texteingabe, Bedingung, Schleife und Dateiprotokoll. Alle Pfade sind ausdrücklich Testdaten.',
  );
}

export function verschachtelterWorkflow(): Projekt {
  const innereSchleife = baustein(
    'sl_repeat',
    'ui-innere-schleife',
    {},
    {
      ANZAHL: zahl('ui-innere-anzahl', '2'),
      ABLAUF: baustein(
        'sl_log',
        'ui-inneres-protokoll',
        {},
        {
          PFAD: text('ui-innerer-pfad', 'ScriptLab-UI-Testdaten\\Verschachtelt.txt'),
          TEXT: text('ui-innerer-text', 'Nur Testdaten für die Darstellung.'),
        },
      ),
    },
  );
  const bedingung = baustein(
    'sl_if',
    'ui-innere-bedingung',
    {},
    {
      BEDINGUNG: baustein(
        'sl_compare',
        'ui-zaehler-vergleich',
        { OP: 'LT' },
        {
          A: variable('ui-zaehler-pruefen', 'Zähler'),
          B: zahl('ui-grenze', '2'),
        },
      ),
      DANN: innereSchleife,
      SONST: baustein(
        'sl_message',
        'ui-andere-runde',
        {},
        {
          TEXT: text('ui-andere-runde-text', 'Diese Runde enthält keine Protokollzeile.'),
        },
      ),
    },
  );
  return projekt(
    'UI-Test: Verschachtelte Abläufe',
    kette(
      baustein('sl_set', 'ui-zaehler-start', { VAR: 'Zähler' }, { WERT: zahl('ui-null', '0') }),
      baustein(
        'sl_repeat',
        'ui-aeussere-schleife',
        {},
        {
          ANZAHL: zahl('ui-aeussere-anzahl', '3'),
          ABLAUF: kette(
            bedingung,
            baustein(
              'sl_set',
              'ui-zaehler-erhoehen',
              { VAR: 'Zähler' },
              {
                WERT: baustein(
                  'sl_math',
                  'ui-plus',
                  { OP: 'ADD' },
                  {
                    A: variable('ui-zaehler-lesen', 'Zähler'),
                    B: zahl('ui-eins', '1'),
                  },
                ),
              },
            ),
          ),
        },
      ),
      baustein(
        'sl_message',
        'ui-verschachtelt-fertig',
        {},
        {
          TEXT: text('ui-verschachtelt-fertig-text', 'Der verschachtelte Testablauf ist vollständig.'),
        },
      ),
    ),
    'Reine Darstellungstestdaten: äußere Schleife, innere Bedingung und zusätzliche innere Schleife. Kein Scriptstart.',
  );
}

export const langerQuellpfad =
  'C:\\ScriptLab-UI-Testdaten\\Abteilung für ausführliche deutsche Beschriftungen\\Monatsberichte und weitere gemeinsame Arbeitsunterlagen\\Noch ein bewusst langer Ordnername mit Leerzeichen\\Quelle mit Umlauten äöü und mehreren Wörtern.txt';
export const langerZielpfad =
  'C:\\ScriptLab-UI-Testdaten\\Sicherung für die ausschließlich visuelle Prüfung\\Archiv des aktuellen Arbeitsstands\\Berichte mit sehr ausführlichen Namen\\Zieldatei mit Leerzeichen und Umlauten äöü.txt';

export function langeWerteWorkflow(): Projekt {
  return projekt(
    'UI-Test: Lange deutsche Texte und Pfade',
    kette(
      baustein(
        'sl_copy',
        'ui-lange-dateikopie',
        { ZIELREGEL: 'FEHLER' },
        {
          QUELLE: text('ui-lange-quelle', langerQuellpfad),
          ZIEL: text('ui-langes-ziel', langerZielpfad),
        },
      ),
      baustein('sl_comment', 'ui-langer-kommentar', {
        TEXT: 'Dies ist ein bewusst ausführlicher deutscher Erklärungstext. Er dient ausschließlich dazu, Zeilenumbruch, Auswahl, sichtbaren Tastaturfokus und die vollständig erreichbare Bearbeitung im Eigenschaftenbereich zu prüfen. Die Oberfläche darf dafür keine Bedienelemente abschneiden.',
      }),
      baustein(
        'sl_set',
        'ui-langer-text-setzen',
        { VAR: 'Ausführliche Rückmeldung' },
        {
          WERT: text(
            'ui-langer-textwert',
            'Eine sehr ausführliche Rückmeldung bleibt vollständig auswählbar und bearbeitbar. '.repeat(14),
          ),
        },
      ),
      baustein(
        'sl_message',
        'ui-lange-nachricht',
        {},
        {
          TEXT: variable('ui-langen-text-lesen', 'Ausführliche Rückmeldung'),
        },
      ),
    ),
    'Bewusst lange Testtexte und Windows-Pfade. Die beschriebenen Dateien werden weder beim Öffnen noch beim Exportieren verändert.',
  );
}

export function fehlerhafterWorkflow(): Projekt {
  const p = projekt(
    'UI-Test: Fehlende Pflichtwerte',
    kette(
      baustein(
        'sl_copy',
        'ui-fehlendes-ziel',
        { ZIELREGEL: 'FEHLER' },
        {
          QUELLE: text('ui-fehlerquelle', 'ScriptLab-UI-Testdaten\\Quelle.txt'),
        },
      ),
      baustein('sl_message', 'ui-fehlender-text'),
    ),
    'Unvollständiger, speicherbarer Entwurf. Erwartet werden konkrete Hinweise erst passend zur Bearbeitung und beim Exportversuch.',
  );
  p.editor.blocks!.blocks.push({
    type: 'sl_comment',
    id: 'ui-loser-kommentar',
    x: 520,
    y: 160,
    fields: { TEXT: 'Dieser aktive Baustein ist absichtlich nicht verbunden.' },
  });
  return p;
}

export function signaturOhneZertifikatWorkflow(): Projekt {
  const p = langeWerteWorkflow();
  p.name = 'UI-Test: Signatur ohne Zertifikat';
  p.exportOptionen.signieren = true;
  return p;
}

export function bausteineZaehlen(p: Projekt): number {
  function zaehlen(b: EditorBlock): number {
    return (
      1 +
      Object.values(b.inputs ?? {}).reduce(
        (summe, eingang) =>
          summe + (eingang.block ? zaehlen(eingang.block) : eingang.shadow ? zaehlen(eingang.shadow) : 0),
        0,
      ) +
      (b.next ? zaehlen(b.next.block) : 0)
    );
  }
  return (p.editor.blocks?.blocks ?? []).reduce((summe, b) => summe + zaehlen(b), 0);
}

export const uiTestprojekte = {
  '01-Alltagsworkflow.scriptlab': alltagsworkflow(),
  '02-Verschachtelte-Ablaeufe.scriptlab': verschachtelterWorkflow(),
  '03-Lange-Texte-und-Pfade.scriptlab': langeWerteWorkflow(),
  '04-Fehlende-Pflichtwerte.scriptlab': fehlerhafterWorkflow(),
  '05-Signatur-ohne-Zertifikat.scriptlab': signaturOhneZertifikatWorkflow(),
};
