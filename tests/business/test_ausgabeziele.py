"""Gezielte echte Dateiprüfungen der optionalen App-Ausgabegrenze."""
from pathlib import Path
import os
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "laufzeit"))

from scriptlab_business.kontext import BusinessFehler, Kontext
from scriptlab_business.dateien import datei_aktion, zip_entpacken


class AusgabezielTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ScriptLab-BusinessAusgabe-")
        self.addCleanup(self.temp.cleanup)
        self.wurzel = Path(self.temp.name).resolve()
        self.app = self.wurzel / "Appdaten"
        self.basis = self.app / "Arbeitsdateien" / "Workflow"
        self.fremd = self.wurzel / "Fremde Quellen"
        self.basis.mkdir(parents=True)
        self.fremd.mkdir()
        self.quelle = self.fremd / "Quelle.txt"
        self.quelle.write_text("Originale Quelldaten", encoding="utf-8")
        self.kontext = self.neuer_kontext(self.app)

    def neuer_kontext(self, root):
        kontext = Kontext(self.basis, "ausfuehren", ausgabe_wurzel=root,
                          journal_pfad=self.app / "journal.jsonl", technischer_ordner=self.app / "Technik")
        self.addCleanup(kontext.schliessen)
        return kontext

    def test_externe_quelle_bleibt_lesbar_und_kopie_wird_intern_publiziert(self):
        ergebnis = datei_aktion(self.kontext, {"aktion": "KOPIEREN", "quelle": str(self.quelle), "ziel": "Kopie.txt"}, {})
        self.assertEqual(ergebnis["status"], "publiziert")
        self.assertEqual((self.basis / "Kopie.txt").read_text(encoding="utf-8"), "Originale Quelldaten")
        self.assertTrue(self.quelle.is_file())

    def test_absolute_relative_und_aehnlich_benannte_ausbrueche_schreiben_nichts(self):
        for ziel in (self.fremd / "Verboten.txt", "../../../Fremde Quellen/Traverse.txt", self.wurzel / "Appdaten-Nachbar" / "Datei.txt"):
            with self.subTest(ziel=str(ziel)), self.assertRaisesRegex(BusinessFehler, "Appdatenordner"):
                datei_aktion(self.kontext, {"aktion": "KOPIEREN", "quelle": str(self.quelle), "ziel": str(ziel)}, {})
        self.assertEqual(list(self.fremd.iterdir()), [self.quelle])
        self.assertEqual(self.kontext.ausgaben, [])

    def test_ordner_und_zip_erzeugen_keine_externen_ordner_vor_der_publikation(self):
        ziel = self.fremd / "Verbotener Ordner"
        with self.assertRaisesRegex(BusinessFehler, "Appdatenordner"):
            datei_aktion(self.kontext, {"aktion": "ORDNER", "ziel": str(ziel)}, {})
        archiv = self.fremd / "Quelle.zip"
        with zipfile.ZipFile(archiv, "w") as datei:
            datei.writestr("Unterordner/Datei.txt", "ZIP-Quelldaten")
        with self.assertRaisesRegex(BusinessFehler, "Appdatenordner"):
            zip_entpacken(self.kontext, {"quelle": str(archiv), "ziel": str(ziel)}, {})
        self.assertFalse(ziel.exists())

    @unittest.skipUnless(os.name == "nt", "Echte Windows-Junction")
    def test_junction_elternpfad_wird_vor_dem_schreiben_aufgeloest(self):
        import _winapi
        verweis = self.app / "Verknuepfung"
        _winapi.CreateJunction(str(self.fremd), str(verweis))
        self.addCleanup(os.rmdir, verweis)
        with self.assertRaisesRegex(BusinessFehler, "Appdatenordner"):
            datei_aktion(self.kontext, {"aktion": "ORDNER", "ziel": str(verweis / "Neuer Ordner")}, {})
        self.assertFalse((self.fremd / "Neuer Ordner").exists())

    def test_bewusstes_verschieben_einer_externen_quelle_bleibt_erhalten(self):
        ergebnis = datei_aktion(self.kontext, {"aktion": "VERSCHIEBEN", "quelle": str(self.quelle), "ziel": "Verschoben.txt"}, {})
        self.assertEqual(ergebnis["status"], "publiziert")
        self.assertFalse(self.quelle.exists())
        self.assertTrue((self.basis / "Verschoben.txt").is_file())

    def test_ohne_option_bleiben_absolute_exportziele_erlaubt(self):
        self.kontext.schliessen()
        kontext = self.neuer_kontext(None)
        ziel = self.fremd / "Export.txt"
        ergebnis = datei_aktion(kontext, {"aktion": "KOPIEREN", "quelle": str(self.quelle), "ziel": str(ziel)}, {})
        self.assertEqual(ergebnis["status"], "publiziert")
        self.assertTrue(ziel.is_file())


if __name__ == "__main__":
    unittest.main()
