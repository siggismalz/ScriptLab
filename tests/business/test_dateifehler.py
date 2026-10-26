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
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "laufzeit"))

from scriptlab_business.dateien import publizieren
from scriptlab_business.kontext import AbbruchFehler, Kontext, UnklarerZustand


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


if __name__ == "__main__":
    unittest.main()
