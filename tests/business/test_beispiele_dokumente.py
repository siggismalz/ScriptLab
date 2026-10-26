"""Abnahme der vollständigen C/D/E-Pläne statt einzelner nachgebauter Handler."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest

WURZEL = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("business_beispiele", WURZEL / "scripts" / "business-beispiele-pruefen.py")
beispiele = importlib.util.module_from_spec(spec)
spec.loader.exec_module(beispiele)


class VollstaendigeBeispielTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ScriptLab-Business-CDE-")
        self.addCleanup(self.temp.cleanup)
        self.basis = Path(self.temp.name)

    def kopie(self, kennung):
        return beispiele.beispiel_kopieren(kennung, self.basis)

    def test_synthetische_binaere_eingaben_sind_reproduzierbar(self):
        vorher = beispiele.fixtures_erstellen(self.basis)
        self.assertEqual(beispiele.fixtures_erstellen(self.basis), vorher)

    def test_c_vorschau_und_prueflauf_schreiben_keine_ziele(self):
        self.assertEqual(beispiele.pruefe_ohne_ziele(self.kopie("C")), ["vorschau", "prueflauf"])

    def test_c_eine_gruppenbestellung_mit_15_und_12_und_geschuetztem_ziel(self):
        bericht = beispiele.pruefe_c(self.kopie("C"))
        self.assertEqual(bericht["gesamtbestellmenge"], 27)
        self.assertEqual(bericht["dokumente"], 1)

    def test_d_vorschau_und_prueflauf_erhalten_alle_originale(self):
        self.assertEqual(beispiele.pruefe_ohne_ziele(self.kopie("D")), ["vorschau", "prueflauf"])

    def test_d_zwei_kopien_ein_echter_rasterscan_und_geschuetztes_ziel(self):
        bericht = beispiele.pruefe_d(self.kopie("D"))
        self.assertEqual((bericht["abgelegte_kopien"], bericht["scan_hinweise"]), (2, 1))

    def test_e_vorschau_und_prueflauf_archivieren_keine_quellen(self):
        self.assertEqual(beispiele.pruefe_ohne_ziele(self.kopie("E")), ["vorschau", "prueflauf"])

    def test_e_vollstaendige_csvs_archiviert_fehlerhafte_quelle_bleibt(self):
        bericht = beispiele.pruefe_e(self.kopie("E"))
        self.assertTrue(bericht["fehlerhafte_quelle_erhalten"])
        self.assertEqual(bericht["offene_fehler"], 1)

    def test_e_abbruch_und_wiederaufnahme_schreiben_keine_doppelten_dateien(self):
        bericht = beispiele.pruefe_e_abbruch(self.kopie("E"))
        self.assertEqual(bericht["wiederverwendet"], 1)

    def test_e_unklare_publikation_wird_nicht_automatisch_wiederholt(self):
        bericht = beispiele.pruefe_e_unklar(self.kopie("E"))
        self.assertTrue(bericht["automatische_wiederholung_verhindert"])


if __name__ == "__main__":
    unittest.main()
