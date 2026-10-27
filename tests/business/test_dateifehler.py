"""Reale Windows-Sperre und gezielte IO-Fault-Injection nur in eigenen Tempordnern."""
from __future__ import annotations

from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import errno
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "laufzeit"))

from scriptlab_business.dateien import publizieren, csv_stapel
from scriptlab_business.ausfuehrung import schritt
from scriptlab_business.kontext import AbbruchFehler, BusinessFehler, Kontext, UnklarerZustand


@contextmanager
def windows_exklusivsperre(pfad: Path):
    """Nur den ausdrücklich übergebenen eigenen Fixturepfad ohne Freigaben öffnen."""
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                  ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    handle = kernel.CreateFileW(str(pfad), 0xC0000000, 0, None, 3, 0x80, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        yield
    finally:
        if not kernel.CloseHandle(handle):
            raise ctypes.WinError(ctypes.get_last_error())


class DateiFehlerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ScriptLab-Dateifehler-")
        self.addCleanup(self.temp.cleanup)
        self.wurzel = Path(self.temp.name).resolve()
        self.basis = self.wurzel / "Fachliche Dateien"
        self.technik = self.wurzel / "Technik"
        self.basis.mkdir()
        self.technik.mkdir()
        self.ziel = self.basis / "Vorhandenes Ziel ä.txt"
        self.quelle = self.basis / "Quelle.txt"
        self.ziel.write_bytes("Bestätigte Originalbytes ä\r\n".encode("utf-8"))
        self.quelle.write_bytes(b"Eindeutige Quelldaten")
        (self.basis / "Unbeteiligte Datei.txt").write_bytes(b"Diese Datei bleibt unveraendert.")
        self.originale = {p.name: p.read_bytes() for p in self.basis.iterdir()}
        self.kontext = Kontext(self.basis, "ausfuehren", workflow_hash="d" * 64,
                               journal_pfad=self.technik / "journal.jsonl",
                               technischer_ordner=self.technik, grenzen={"zeitlimit_sekunden": 5})
        self.addCleanup(self.kontext.schliessen)
        self.staging: list[Path] = []

    def staging_schreiben(self, pfad: Path):
        self.staging.append(pfad)
        self.assertEqual(pfad.parent, self.basis)
        pfad.write_bytes(b"Neue, noch nicht publizierte Daten")

    def originalzustand_pruefen(self, staging_erlaubt=False):
        for name, inhalt in self.originale.items():
            self.assertEqual((self.basis / name).read_bytes(), inhalt, name)
        self.assertEqual(self.kontext.ausgaben, [])
        erwartet = set(self.originale) | ({p.name for p in self.staging} if staging_erlaubt else set())
        self.assertEqual({p.name for p in self.basis.iterdir()}, erwartet)
        if not staging_erlaubt:
            self.assertTrue(all(not p.exists() for p in self.staging))
        if self.kontext._journal:
            self.assertTrue(all(e["zustand"] != "publiziert" for e in self.kontext._journal.eintraege.values()))

    @unittest.skipUnless(os.name == "nt", "Die Exklusivsperre ist ein echter Windows-Test.")
    def test_echte_windows_exklusivsperre_verhindert_ersetzen_und_erhaelt_original(self):
        with windows_exklusivsperre(self.ziel):
            with self.assertRaises(OSError) as aufgetreten:
                publizieren(self.kontext, self.ziel, self.staging_schreiben, konflikt="ERSETZEN")
        self.assertIn(aufgetreten.exception.winerror, {5, 32, 33})
        self.assertEqual(len(self.staging), 1)
        self.originalzustand_pruefen(staging_erlaubt=True)
        self.assertTrue(self.staging[0].is_file())
        self.assertEqual(next(iter(self.kontext.journal.eintraege.values()))["zustand"], "vorbereitet")
        journal = self.kontext.journal_pfad
        self.kontext.schliessen()
        neu = Kontext(self.basis, "ausfuehren", workflow_hash="d" * 64,
                      journal_pfad=journal, fortsetzen=True, technischer_ordner=self.technik)
        self.addCleanup(neu.schliessen)
        with self.assertRaises(UnklarerZustand):
            _ = neu.journal
        self.assertEqual(self.ziel.read_bytes(), self.originale[self.ziel.name])

    def test_simulierter_writer_enospc_publiziert_weder_neues_noch_ersetztes_ziel(self):
        def schreiben(pfad):
            self.staging_schreiben(pfad)
            raise OSError(errno.ENOSPC, "Gezielt simulierter Platzmangel im Writer")
        for ziel in (self.ziel, self.basis / "Neues Ziel.txt"):
            with self.subTest(vorhandenes_ziel=ziel == self.ziel):
                with patch("scriptlab_business.dateien.os.replace") as ersetzen:
                    with self.assertRaises(OSError) as aufgetreten:
                        publizieren(self.kontext, ziel, schreiben, konflikt="ERSETZEN")
                    self.assertEqual(aufgetreten.exception.errno, errno.ENOSPC)
                    ersetzen.assert_not_called()
                self.originalzustand_pruefen()

    def test_abgebrochener_writer_entfernt_nur_seine_unpublizierte_zwischenfassung(self):
        def schreiben(pfad):
            self.staging_schreiben(pfad)
            self.kontext.abgebrochen = True
            self.kontext.pruefen()
        with patch("scriptlab_business.dateien.os.replace") as ersetzen:
            with self.assertRaises(AbbruchFehler):
                publizieren(self.kontext, self.ziel, schreiben, konflikt="ERSETZEN")
            ersetzen.assert_not_called()
        self.originalzustand_pruefen()

    def test_simulierter_quellzugriffsfehler_verhindert_schon_die_staginganlage(self):
        original_oeffnen = Path.open
        def oeffnen(pfad, *args, **kwargs):
            if pfad == self.quelle:
                raise PermissionError(errno.EACCES, "Gezielt simulierter Quellzugriffsfehler", str(pfad))
            return original_oeffnen(pfad, *args, **kwargs)
        with patch.object(Path, "open", oeffnen):
            with self.assertRaises(PermissionError):
                publizieren(self.kontext, self.ziel, self.staging_schreiben,
                             konflikt="ERSETZEN", quellen=[self.quelle])
        self.assertEqual(self.staging, [])
        self.originalzustand_pruefen()

    def test_simulierter_spaeter_quelllesefehler_verhindert_publikation_und_bereinigt_staging(self):
        original_oeffnen = Path.open
        quelllesevorgaenge = 0
        def oeffnen(pfad, *args, **kwargs):
            nonlocal quelllesevorgaenge
            if pfad == self.quelle:
                quelllesevorgaenge += 1
                if quelllesevorgaenge == 2:
                    raise OSError(errno.EIO, "Gezielt simulierter Lesefehler bei erneuter Quellenprüfung")
            return original_oeffnen(pfad, *args, **kwargs)
        with patch.object(Path, "open", oeffnen), patch("scriptlab_business.dateien.os.replace") as ersetzen:
            with self.assertRaises(OSError) as aufgetreten:
                publizieren(self.kontext, self.ziel, self.staging_schreiben,
                             konflikt="ERSETZEN", quellen=[self.quelle])
            self.assertEqual(aufgetreten.exception.errno, errno.EIO)
            ersetzen.assert_not_called()
        self.assertEqual(quelllesevorgaenge, 2)
        self.assertEqual(len(self.staging), 1)
        self.originalzustand_pruefen()

    def test_platzpruefung_real_verwendet_naechsten_vorhandenen_parent(self):
        import shutil
        with patch("scriptlab_business.kontext.shutil.disk_usage", wraps=shutil.disk_usage) as auskunft:
            frei = self.kontext.platz_pruefen(self.basis / "Noch nicht da/Tiefer/Ziel.txt")
            self.assertGreaterEqual(frei, 32 * 1024 * 1024)
            self.assertEqual(auskunft.call_args.args[0], self.basis)
        self.assertGreaterEqual(self.kontext.platz_pruefen(self.ziel), 32 * 1024 * 1024)
        self.originalzustand_pruefen()

    def test_simulierter_platzmangel_beim_kontextaufbau_bereinigt_nur_eigene_tempdir(self):
        marker = self.technik / "Unbeteiligte Technikdatei.txt"
        marker.write_bytes(b"behalten")
        vorher = {p.name for p in self.technik.iterdir()}
        with patch("scriptlab_business.kontext.shutil.disk_usage", return_value=SimpleNamespace(free=31 * 1024 * 1024)):
            with self.assertRaisesRegex(BusinessFehler, "zu wenig freier Speicherplatz"):
                Kontext(self.basis, "ausfuehren", technischer_ordner=self.technik)
        self.assertEqual({p.name for p in self.technik.iterdir()}, vorher)
        self.assertEqual(marker.read_bytes(), b"behalten")
        self.originalzustand_pruefen()

    def test_simuliert_unlesbare_speicherinfo_gilt_nicht_als_genug_platz(self):
        fehler = PermissionError(errno.EACCES, "Simuliert verweigerte Speicherinfo")
        with patch("scriptlab_business.kontext.shutil.disk_usage", side_effect=fehler):
            with self.assertRaisesRegex(BusinessFehler, "freie Speicherplatz konnte nicht geprüft") as aufgetreten:
                self.kontext.platz_pruefen(self.basis)
        self.assertIs(aufgetreten.exception.__cause__, fehler)
        self.originalzustand_pruefen()

    def test_simulierter_platzmangel_verhindert_fachliche_staginganlage(self):
        with patch("scriptlab_business.kontext.shutil.disk_usage", return_value=SimpleNamespace(free=0)):
            with self.assertRaisesRegex(BusinessFehler, "zu wenig freier Speicherplatz"):
                publizieren(self.kontext, self.ziel, self.staging_schreiben, konflikt="ERSETZEN")
        self.assertEqual(self.staging, [])
        self.originalzustand_pruefen()

    def test_runner_uebersetzt_simulierte_lokale_iofehler_und_erhaelt_abbruch_unklar(self):
        gesperrt = PermissionError(errno.EACCES, "Simulierte Windows-Sperre")
        gesperrt.winerror = 32
        for fehler, erwartet in [(OSError(errno.ENOSPC, "Simulierter voller Datenträger"), "Speicherplatz"),
                                  (PermissionError(errno.EACCES, "Simulierte fehlende Berechtigung"), "Berechtigungen"),
                                  (gesperrt, "gesperrt")]:
            with self.subTest(fehler=str(fehler)):
                def handler(_kontext, _config, _eingaben):
                    raise fehler
                with patch("scriptlab_business.ausfuehrung._handler", return_value={"dateien.aktion": handler}):
                    with self.assertRaisesRegex(BusinessFehler, erwartet) as aufgetreten:
                        schritt(self.kontext, "fehlerpruefung", "dateien.aktion", {}, {})
                self.assertIs(aufgetreten.exception.__cause__, fehler)
                self.assertIn(str(fehler), self.kontext.fehler[-1]["technisch"])
                self.assertIn("errno=", self.kontext.fehler[-1]["technisch"])
        for fehler in (AbbruchFehler("Bewusster Abbruch"), UnklarerZustand("Unklare Publikation")):
            def handler(_kontext, _config, _eingaben):
                raise fehler
            with patch("scriptlab_business.ausfuehrung._handler", return_value={"dateien.aktion": handler}):
                with self.assertRaises(type(fehler)) as aufgetreten:
                    schritt(self.kontext, "nicht_verdecken", "dateien.aktion", {}, {})
            self.assertIs(aufgetreten.exception, fehler)
        self.originalzustand_pruefen()

    def test_runner_meldet_simulierte_windows_netzwerkfehler_mit_technischen_originalcodes(self):
        for code in (53, 64, 121):
            with self.subTest(windowsfehler=code):
                fehler = OSError(errno.EIO, "Gezielt simulierter Netzwerkfehler")
                fehler.winerror = code
                def handler(_kontext, _config, _eingaben):
                    raise fehler
                with patch("scriptlab_business.ausfuehrung._handler", return_value={"dateien.aktion": handler}):
                    with self.assertRaisesRegex(BusinessFehler, "Netzwerkpfad") as aufgetreten:
                        schritt(self.kontext, "netzwerkfehler", "dateien.aktion", {}, {})
                self.assertIs(aufgetreten.exception.__cause__, fehler)
                self.assertIn(f"winerror={code}", self.kontext.fehler[-1]["technisch"])
        self.originalzustand_pruefen()


    def test_csv_stapel_erhaelt_konkrete_iofehler_bei_stopp_und_fortsetzen(self):
        for code, erwartet in ((errno.ENOSPC, "Speicherplatz"), (32, "gesperrt")):
            for policy in ("STOPP", "BERICHT"):
                with self.subTest(code=code, policy=policy):
                    ordner = self.wurzel / f"Stapel-{code}-{policy}"
                    for name in ("Eingang", "Ausgabe", "Archiv"):
                        (ordner / name).mkdir(parents=True)
                    quelle = ordner / "Eingang/Test.csv"
                    quelle.write_bytes(b"ID;Wert\r\n001;2\r\n")
                    original = quelle.read_bytes()
                    fehler = OSError(errno.ENOSPC if code == errno.ENOSPC else errno.EACCES, "Simulierter Stapelfehler")
                    if code == 32:
                        fehler.winerror = 32
                    with Kontext(ordner, "ausfuehren") as k:
                        config = {"ordner": "Eingang", "zielordner": "Ausgabe", "archivordner": "Archiv", "bei_fehler": policy}
                        with patch("scriptlab_business.dateien.publizieren", side_effect=fehler):
                            if policy == "STOPP":
                                with self.assertRaisesRegex(BusinessFehler, erwartet) as aufgetreten:
                                    csv_stapel(k, config, {})
                                self.assertIs(aufgetreten.exception.__cause__, fehler)
                            else:
                                r = csv_stapel(k, config, {})
                                self.assertEqual(r["status"], "mit_fehlern")
                                self.assertIn(erwartet, r["dateien"][0]["meldung"])
                        self.assertIn(erwartet, k.fehler[-1]["meldung"])
                        self.assertIn("Simulierter Stapelfehler", k.fehler[-1]["technisch"])
                    self.assertEqual(quelle.read_bytes(), original)
                    self.assertEqual(list((ordner / "Ausgabe").iterdir()), [])
                    self.assertEqual(list((ordner / "Archiv").iterdir()), [])

if __name__ == "__main__":
    unittest.main()
