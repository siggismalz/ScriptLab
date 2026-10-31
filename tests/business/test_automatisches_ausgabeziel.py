"""Automatische Tabellenziele: echte Dateien, unabhängige Inhalte, eigene Tempordner."""
from pathlib import Path
import tempfile
import unittest

from openpyxl import load_workbook
from scriptlab_business.kontext import Kontext, BusinessFehler
from scriptlab_business.daten import DatenEngine


class AutomatischesZielTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ScriptLab-Autoziel-")
        self.basis = Path(self.temp.name).resolve()
        self.quelle = self.basis / 'Umsätze ä.csv'
        self.original = 'ID;Name;Umsatz\n001;Müller;12.50\n002;Bär;7.00\n'.encode('utf-8')
        self.quelle.write_bytes(self.original)
        self.kontext = Kontext(self.basis, 'ausfuehren', workflow_hash='automatisches-ziel')
        self.engine = DatenEngine(self.kontext)
        self.tabelle = self.engine.importieren('CSV', str(self.quelle), {'trennzeichen': ';'})

    def tearDown(self):
        self.kontext.schliessen()
        self.temp.cleanup()

    def test_csv_wird_ohne_zielpfad_als_lesbare_xlsx_gespeichert(self):
        self.engine.exportieren(self.tabelle, 'XLSX', '')
        ziel = self.basis / 'Umsätze ä.xlsx'
        buch = load_workbook(ziel, read_only=True)
        try:
            self.assertEqual(list(buch.active.values), [('ID', 'Name', 'Umsatz'), ('001', 'Müller', '12.50'), ('002', 'Bär', '7.00')])
        finally:
            buch.close()
        self.assertEqual(self.quelle.read_bytes(), self.original)
        self.assertEqual(self.kontext.ausgaben[-1]['pfad'], str(ziel))
        self.assertEqual(self.kontext.ausgaben[-1]['status'], 'publiziert')

    def test_wiederholungen_ersetzen_auch_bei_ersetzen_regel_keine_datei(self):
        ziel = self.basis / 'Umsätze ä.xlsx'
        ziel.write_bytes(b'Vorhandene Datei unveraendert')
        self.engine.exportieren(self.tabelle, 'XLSX', '', 'ERSETZEN')
        self.engine.exportieren(self.tabelle, 'XLSX', '')
        self.assertEqual(ziel.read_bytes(), b'Vorhandene Datei unveraendert')
        self.assertTrue((self.basis / 'Umsätze ä (2).xlsx').is_file())
        self.assertTrue((self.basis / 'Umsätze ä (3).xlsx').is_file())

    def test_gleiches_format_schuetzt_die_quelle(self):
        self.engine.exportieren(self.tabelle, 'CSV', '')
        self.assertEqual(self.quelle.read_bytes(), self.original)
        self.assertTrue((self.basis / 'Umsätze ä-Ausgabe.csv').is_file())

    def test_mehrere_quellen_erhalten_einen_neutralen_namen(self):
        zweite = self.basis / 'Andere.csv'
        zweite.write_bytes(self.original)
        t = self.engine.importieren('CSV', str(zweite), {'trennzeichen': ';'})
        vereinigt = self.engine.vereinigen(self.tabelle, t)
        self.engine.exportieren(vereinigt, 'XLSX', '')
        self.assertTrue((self.basis / 'Auswertung.xlsx').is_file())

    def test_explizite_ziele_behalten_ihre_konfliktregel(self):
        ziel = self.basis / 'Mein Ziel.xlsx'
        ziel.write_bytes(b'Original')
        with self.assertRaises(BusinessFehler):
            self.engine.exportieren(self.tabelle, 'XLSX', str(ziel))
        self.assertEqual(ziel.read_bytes(), b'Original')

    def test_ungueltige_werte_werden_nicht_automatisch_ersetzt(self):
        for wert in (None, '   ', '\0', 7):
            with self.subTest(wert=wert), self.assertRaises(BusinessFehler):
                self.engine.exportieren(self.tabelle, 'XLSX', wert)
        self.assertFalse((self.basis / 'Umsätze ä.xlsx').exists())

    def test_leerer_gebundener_parameter_ist_keine_automatische_ausgabe(self):
        from scriptlab_business.ausfuehrung import schritt
        self.kontext.parameter['Ziel'] = ''
        self.kontext.ergebnisse['quelle'] = self.tabelle.json()
        self.kontext.dienste['daten'] = self.engine
        with self.assertRaisesRegex(BusinessFehler, 'Parameter.*leer'):
            schritt(self.kontext, 'speichern', 'daten.exportieren',
                    {'format': 'XLSX', 'pfad': {'parameter': 'Ziel'}},
                    {'tabelle': {'referenz': 'quelle'}})
        self.assertFalse((self.basis / 'Umsätze ä.xlsx').exists())

    def test_prueflauf_veroeffentlicht_keine_xlsx(self):
        self.kontext.modus = 'prueflauf'
        self.engine.exportieren(self.tabelle, 'XLSX', '')
        self.assertFalse((self.basis / 'Umsätze ä.xlsx').exists())
        self.assertEqual(self.kontext.ausgaben[-1]['status'], 'geplant')

    def test_quellenordner_bleibt_unveraendert_bei_anderem_arbeitsordner(self):
        ausgaben = self.basis / 'Arbeitsordner'
        ausgaben.mkdir()
        self.kontext.basis = ausgaben
        self.engine.exportieren(self.tabelle, 'XLSX', '')
        self.assertTrue((ausgaben / 'Umsätze ä.xlsx').exists())
        self.assertFalse((self.basis / 'Umsätze ä.xlsx').exists())
        self.assertEqual(self.quelle.read_bytes(), self.original)


if __name__ == '__main__':
    unittest.main()
